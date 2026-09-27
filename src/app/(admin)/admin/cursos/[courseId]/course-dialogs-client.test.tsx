/**
 * @vitest-environment jsdom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const saveCourseSettingsActionMock = vi.hoisted(() => vi.fn());

vi.mock("@/components/course-cover-upload-field", async () => {
  const React = await import("react");
  return {
    CourseCoverUploadField: ({
      className,
      onUploadingChange,
    }: {
      className?: string;
      onUploadingChange?: (isUploading: boolean) => void;
    }) =>
      React.createElement(
        "div",
        { className },
        React.createElement(
          "button",
          {
            onClick: () => onUploadingChange?.(true),
            type: "button",
          },
          "Enviar capa"
        )
      ),
  };
});

vi.mock("@/features/admin/actions", () => ({
  saveCourseSettingsAction: saveCourseSettingsActionMock,
}));

vi.mock("@/features/admin/course-availability-actions", () => ({
  archiveCourseAction: vi.fn(),
  restoreCourseAction: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    loading: vi.fn(() => "toast-id"),
    success: vi.fn(),
  },
}));

import { formatCurrencyInCents } from "@/lib/formatters";
import { type CourseData, CourseSettingsForm } from "./course-dialogs-client";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

class ResizeObserverMock {
  disconnect = vi.fn();
  observe = vi.fn();
  unobserve = vi.fn();
}

const course: CourseData = {
  accessDurationMonths: 12,
  catalogVisibility: "listed",
  certificateSignerName: "Dra. Maria",
  certificateSignerRole: "Responsável técnica",
  description: "Curso de teste",
  hasCommercialHistory: false,
  id: "course-1",
  interestCount: 0,
  interestNotificationsSent: 0,
  launchDate: null,
  launchLandingUrl: null,
  paymentAllowCreditCard: true,
  paymentAllowPix: true,
  paymentMaxInstallmentCount: 3,
  priceInCents: 1990,
  pendingCheckoutCancellations: 0,
  pendingInterestNotifications: 0,
  salesStatus: "open",
  slug: "curso-teste",
  status: "active",
  thumbnailUrl: null,
  title: "Curso de teste",
  workloadHours: 10,
  workloadHoursOverride: null,
};

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.ResizeObserver = ResizeObserverMock;
  saveCourseSettingsActionMock.mockReset();
  saveCourseSettingsActionMock.mockResolvedValue({ ok: true });
});

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount();
    });
  }
  container?.remove();
  root = null;
  container = null;
  document.body.innerHTML = "";
});

const renderCourseSettingsForm = (courseToRender = course): void => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root?.render(<CourseSettingsForm course={courseToRender} />);
  });
};

const setPrice = (value: string): void => {
  const input = container?.querySelector<HTMLInputElement>(
    'input[name="price"]'
  );
  if (!input) {
    throw new Error("Expected price input.");
  }
  act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
};

const submitSettingsForm = async (): Promise<void> => {
  const form = container?.querySelector("form");
  if (!form) {
    throw new Error("Expected Course settings form.");
  }
  await act(async () => {
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true })
    );
    await Promise.resolve();
  });
};

const findButton = (label: string): HTMLButtonElement => {
  const button = Array.from(document.querySelectorAll("button")).find(
    (candidate) => candidate.textContent === label
  );
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Expected button: ${label}`);
  }
  return button;
};

const clickButton = (label: string): void => {
  act(() => {
    findButton(label).dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true })
    );
  });
};

const clickButtonAsync = async (label: string): Promise<void> => {
  await act(async () => {
    findButton(label).dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true })
    );
    await Promise.resolve();
  });
};

const togglePaymentMethod = (method: "card" | "pix"): void => {
  const checkbox = container?.querySelector<HTMLButtonElement>(
    `#course-payment-${method}`
  );
  if (!checkbox) {
    throw new Error(`Expected ${method} payment method checkbox.`);
  }

  act(() => {
    checkbox.click();
  });
};

describe("course payment settings", () => {
  it("places responsible details in the shared settings form without certificate or signature copy", () => {
    const markup = renderToStaticMarkup(<CourseSettingsForm course={course} />);

    expect(markup).toContain('name="responsibleName"');
    expect(markup).toContain('name="responsibleTitle"');
    expect(markup).toContain("Nome do responsável");
    expect(markup).toContain("Cargo ou título");
    expect(markup).not.toContain("certificado");
    expect(markup).not.toContain("assinatura");
    expect(markup).not.toContain("Salvar responsável");
    expect(markup.match(/<form/g)).toHaveLength(1);
  });

  it("submits availability with course settings instead of rendering a second save button", () => {
    const markup = renderToStaticMarkup(
      <CourseSettingsForm
        course={{ ...course, salesStatus: "closed", status: "draft" }}
      />
    );

    expect(markup).toContain('name="saveCourseAvailability"');
    expect(markup).toContain('name="preset"');
    expect(markup).toContain('name="launchDate"');
    expect(markup).toContain('name="launchLandingUrl"');
    expect(markup).not.toContain("Salvar disponibilidade");
    expect(markup.match(/Salvar configurações/g)).toHaveLength(1);
    expect(markup.match(/<form/g)).toHaveLength(1);
  });

  it("keeps one shared save action when only availability is editable", () => {
    const markup = renderToStaticMarkup(
      <CourseSettingsForm
        availabilityReadOnly={false}
        course={course}
        readOnly
        signatoryReadOnly
      />
    );

    expect(markup).toContain('name="saveCourseAvailability"');
    expect(markup).not.toContain('name="saveCourseDetails"');
    expect(markup).not.toContain('name="saveCourseResponsible"');
    expect(markup).toContain("Salvar configurações");
    expect(markup.match(/>Disponibilidade</g)).toHaveLength(1);
    expect(markup.match(/<form/g)).toHaveLength(1);
  });

  it("does not show a no-op save action for an archived course", () => {
    const markup = renderToStaticMarkup(
      <CourseSettingsForm
        availabilityReadOnly={false}
        course={{
          ...course,
          catalogVisibility: "hidden",
          salesStatus: "closed",
          status: "archived",
        }}
        readOnly
        signatoryReadOnly
      />
    );

    expect(markup).toContain("Restaurar curso");
    expect(markup).not.toContain("Salvar configurações");
  });

  it("saves the responsible person through the shared course settings button", async () => {
    renderCourseSettingsForm();
    const responsibleName = container?.querySelector<HTMLInputElement>(
      'input[name="responsibleName"]'
    );
    expect(responsibleName).not.toBeNull();
    act(() => {
      if (responsibleName) {
        Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value"
        )?.set?.call(responsibleName, "Dra. Joana");
        responsibleName.dispatchEvent(new Event("input", { bubbles: true }));
        responsibleName.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

    await submitSettingsForm();

    expect(saveCourseSettingsActionMock).toHaveBeenCalledOnce();
    const submittedFormData = saveCourseSettingsActionMock.mock.calls[0]?.[0];
    expect(submittedFormData.get("saveCourseDetails")).toBe("on");
    expect(submittedFormData.get("saveCourseResponsible")).toBe("on");
    expect(submittedFormData.get("responsibleName")).toBe("Dra. Joana");
    expect(submittedFormData.get("responsibleTitle")).toBe(
      "Responsável técnica"
    );
    expect(submittedFormData.get("saveCourseAvailability")).toBe("on");
    expect(submittedFormData.get("preset")).toBe("available");
  });

  it("shows the free-course note and hides paid controls for zero price", () => {
    const markup = renderToStaticMarkup(
      <CourseSettingsForm course={{ ...course, priceInCents: 0 }} />
    );

    expect(markup).toContain(
      "Curso gratuito. A inscrição é feita diretamente pelo Hub."
    );
    expect(markup).not.toContain('id="course-payment-pix"');
    expect(markup).not.toContain('id="course-payment-card"');
    expect(markup).not.toContain('id="course-payment-installments"');
    expect(markup).not.toContain("Checkout Asaas");
  });

  it("submits a zero-price Course without payment checkboxes", async () => {
    renderCourseSettingsForm({ ...course, priceInCents: 0 });

    await submitSettingsForm();

    expect(saveCourseSettingsActionMock).toHaveBeenCalledOnce();
    const submittedFormData = saveCourseSettingsActionMock.mock.calls[0]?.[0];
    expect(submittedFormData.get("price")).toBe(formatCurrencyInCents(0));
    expect(submittedFormData.get("paymentAllowPix")).toBeNull();
    expect(submittedFormData.get("paymentAllowCreditCard")).toBeNull();
    expect(submittedFormData.get("paymentMaxInstallmentCount")).toBeNull();
  });

  it("restores paid controls when a free Course becomes paid", () => {
    renderCourseSettingsForm({ ...course, priceInCents: 0 });

    setPrice("19,90");

    expect(container?.querySelector("#course-payment-pix")).not.toBeNull();
    expect(container?.querySelector("#course-payment-card")).not.toBeNull();
    expect(
      container?.querySelector("#course-payment-installments")
    ).not.toBeNull();
    expect(container?.textContent).toContain("Checkout Asaas");
  });

  it("explains when price reduces the effective installment maximum", () => {
    const markup = renderToStaticMarkup(<CourseSettingsForm course={course} />);

    expect(markup).toContain("Checkout será limitado a");
    expect(markup).toContain("1x");
    expect(markup).toContain("3x continua salva");
  });

  it("does not warn when the configured maximum is effective", () => {
    const markup = renderToStaticMarkup(
      <CourseSettingsForm course={{ ...course, priceInCents: 9900 }} />
    );

    expect(markup).not.toContain("Checkout será limitado a");
  });

  it("limits the admin configuration to twelve installments", () => {
    renderCourseSettingsForm({ ...course, priceInCents: 12_000 });
    act(() => {
      container
        ?.querySelector<HTMLButtonElement>("#course-payment-installments")
        ?.click();
    });

    const options = Array.from(
      document.querySelectorAll<HTMLElement>('[role="option"]')
    );
    expect(options).toHaveLength(12);
    expect(options.at(-1)?.textContent).toBe("12x");
    expect(options.at(-1)?.getAttribute("data-disabled")).toBeNull();
  });

  it("keeps installments visible but disabled when card is disabled", async () => {
    renderCourseSettingsForm();

    togglePaymentMethod("card");

    const installments = container?.querySelector<HTMLButtonElement>(
      "#course-payment-installments"
    );
    expect(installments).not.toBeNull();
    expect(installments?.disabled).toBe(true);

    await submitSettingsForm();

    const submittedFormData = saveCourseSettingsActionMock.mock.calls[0]?.[0];
    expect(submittedFormData.get("paymentAllowCreditCard")).toBeNull();
    expect(submittedFormData.get("paymentMaxInstallmentCount")).toBeNull();
  });

  it("restores the previous installment ceiling when card is enabled again", () => {
    renderCourseSettingsForm();

    togglePaymentMethod("card");
    togglePaymentMethod("card");

    const installments = container?.querySelector<HTMLButtonElement>(
      "#course-payment-installments"
    );

    expect(installments?.textContent).toContain("3x");
  });

  it("keeps the final enabled payment method selected", () => {
    renderCourseSettingsForm();

    togglePaymentMethod("card");
    togglePaymentMethod("pix");

    expect(
      container
        ?.querySelector<HTMLButtonElement>("#course-payment-pix")
        ?.getAttribute("aria-checked")
    ).toBe("true");
  });

  it("allows reactivating a payment method when both are disabled", () => {
    renderCourseSettingsForm({
      ...course,
      paymentAllowCreditCard: false,
      paymentAllowPix: false,
    });

    expect(
      container?.querySelector<HTMLButtonElement>("#course-payment-pix")
        ?.disabled
    ).toBe(false);
    expect(
      container?.querySelector<HTMLButtonElement>("#course-payment-card")
        ?.disabled
    ).toBe(false);

    togglePaymentMethod("pix");

    expect(
      container
        ?.querySelector<HTMLButtonElement>("#course-payment-pix")
        ?.getAttribute("aria-checked")
    ).toBe("true");
  });

  it("exposes a compact workload trigger and preserves the manual override", () => {
    const automaticMarkup = renderToStaticMarkup(
      <CourseSettingsForm course={course} />
    );
    const manualMarkup = renderToStaticMarkup(
      <CourseSettingsForm course={{ ...course, workloadHoursOverride: 18 }} />
    );

    expect(automaticMarkup).toContain('name="workloadHoursOverride"');
    expect(automaticMarkup).toContain('id="course-settings-workload"');
    expect(automaticMarkup).toContain('aria-label="Editar carga horária"');
    expect(automaticMarkup).toContain("10 horas");
    expect(manualMarkup).toContain('value="18"');
    expect(manualMarkup).toContain("18 horas");
    expect(automaticMarkup).not.toContain(
      'id="course-settings-workload-hours"'
    );
  });

  it("preserves a zero-hour manual override instead of treating it as empty", () => {
    const markup = renderToStaticMarkup(
      <CourseSettingsForm course={{ ...course, workloadHoursOverride: 0 }} />
    );

    expect(markup).toContain('value="0"');
    expect(markup).toContain("0 horas");
  });

  it("organizes settings into spacious domain sections", () => {
    const markup = renderToStaticMarkup(<CourseSettingsForm course={course} />);

    expect(markup).toContain("Identidade do curso");
    expect(markup).toContain("Acesso e carga horária");
    expect(markup).toContain("Oferta de pagamento");
    expect(markup).toContain("lg:grid-cols-[320px_minmax(0,1fr)]");
    expect(markup).toContain("lg:items-center");
    expect(markup).toContain("sm:w-[320px]");
    expect(markup).toContain("min-h-18");
    expect(markup).toContain("Editar carga horária");
    expect(markup).toContain('name="workloadHoursOverride"');
    expect(markup.indexOf("Carga horária")).toBeLessThan(
      markup.indexOf("Meses de acesso")
    );
    expect(markup).not.toContain('id="course-settings-status"');
    expect(markup.indexOf("Meses de acesso")).toBeLessThan(
      markup.indexOf("Oferta de pagamento")
    );
  });

  it("renders settings as a consultation view without mutation controls", () => {
    const markup = renderToStaticMarkup(
      <CourseSettingsForm course={course} readOnly />
    );

    expect(markup).toContain('data-course-settings-readonly="true"');
    expect(markup).toContain("Você pode consultar os dados gerais");
    expect(markup).toContain(formatCurrencyInCents(course.priceInCents));
    expect(markup).toContain("lg:items-center");
    expect(markup).not.toContain("Salvar configurações");
    expect(markup).not.toContain("<form");
  });

  it("updates the available installment options as the price changes", () => {
    renderCourseSettingsForm({ ...course, priceInCents: 12_000 });
    setPrice("99,00");
    act(() => {
      container
        ?.querySelector<HTMLButtonElement>("#course-payment-installments")
        ?.click();
    });

    const options = Array.from(
      document.querySelectorAll<HTMLElement>('[role="option"]')
    );

    expect(options.at(8)?.textContent).toBe("9x");
    expect(options.at(8)?.getAttribute("data-disabled")).toBeNull();
    expect(options.at(9)?.getAttribute("aria-disabled")).toBe("true");
  });

  it("blocks settings save while the course cover is still uploading", async () => {
    renderCourseSettingsForm();
    act(() => findButton("Enviar capa").click());

    expect(findButton("Salvar configurações").disabled).toBe(true);

    await submitSettingsForm();

    expect(saveCourseSettingsActionMock).not.toHaveBeenCalled();
  });

  it("saves an equivalent price without opening confirmation", async () => {
    renderCourseSettingsForm();
    setPrice("19,90");
    await submitSettingsForm();

    expect(saveCourseSettingsActionMock).toHaveBeenCalledOnce();
    expect(document.body.textContent).not.toContain(
      "Confirmar alteração de preço?"
    );
  });

  it("waits for confirmation before saving a changed price", async () => {
    renderCourseSettingsForm();
    setPrice("29,90");
    await submitSettingsForm();

    expect(saveCourseSettingsActionMock).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(
      "Confirmar alteração de preço?"
    );
    expect(document.body.textContent).toContain(formatCurrencyInCents(1990));
    expect(document.body.textContent).toContain(formatCurrencyInCents(2990));
  });

  it("does not save when the price confirmation is cancelled", async () => {
    renderCourseSettingsForm();
    setPrice("29,90");
    await submitSettingsForm();

    clickButton("Cancelar");

    expect(saveCourseSettingsActionMock).not.toHaveBeenCalled();
  });

  it("saves the original form snapshot after confirming a changed price", async () => {
    renderCourseSettingsForm();
    setPrice("29,90");
    await submitSettingsForm();
    setPrice("39,90");
    await clickButtonAsync("Confirmar alteração");

    expect(saveCourseSettingsActionMock).toHaveBeenCalledOnce();
    const submittedFormData = saveCourseSettingsActionMock.mock.calls[0]?.[0];
    expect(submittedFormData).toBeInstanceOf(FormData);
    expect(submittedFormData.get("price")).toBe("29,90");
  });
});
