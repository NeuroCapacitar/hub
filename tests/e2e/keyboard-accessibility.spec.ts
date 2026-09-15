import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, type Locator, type Page, test } from "@playwright/test";
import type { E2eFixture } from "../../scripts/seed-e2e";

const fixturePath = resolve(
  process.env.E2E_FIXTURE_PATH ?? ".e2e-fixture.json"
);
const ADMIN_URL_PATTERN = /\/admin$/;
const APP_URL_PATTERN = /\/app$/;
const COURSE_ACTION_NAME_PATTERN = /^(Iniciar curso|Continuar curso)$/;
const MAX_TAB_STEPS = 100;

interface E2eCredentials {
  email: string;
  password: string;
}

const readFixture = async (): Promise<E2eFixture> =>
  JSON.parse(await readFile(fixturePath, "utf8")) as E2eFixture;

const signInWithKeyboard = async (
  page: Page,
  credentials: E2eCredentials,
  expectedPath: RegExp
): Promise<void> => {
  await page.goto("/entrar");

  const emailInput = page.getByLabel("E-mail");
  const passwordInput = page.getByLabel("Senha");
  const passwordVisibilityToggle = page.getByRole("button", {
    name: "Mostrar conteúdo confidencial",
  });
  const submitButton = page.getByRole("button", { name: "Entrar" });

  await page.keyboard.press("Tab");
  await expect(emailInput).toBeFocused();
  await page.keyboard.type(credentials.email);
  await page.keyboard.press("Tab");
  await expect(passwordInput).toBeFocused();
  await page.keyboard.type(credentials.password);
  await page.keyboard.press("Tab");
  await expect(passwordVisibilityToggle).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(submitButton).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(expectedPath, { timeout: 15_000 });
};

const focusWithTab = async (
  page: Page,
  target: Locator,
  maxSteps = MAX_TAB_STEPS
): Promise<void> => {
  await expect(target).toBeVisible();

  for (let step = 0; step < maxSteps; step += 1) {
    if (
      await target.evaluate((element) => element === document.activeElement)
    ) {
      return;
    }
    await page.keyboard.press("Tab");
  }

  throw new Error(
    `O elemento esperado não recebeu foco após ${maxSteps} teclas Tab.`
  );
};

test("login pode ser concluído somente com teclado", async ({ page }) => {
  const fixture = await readFixture();

  await signInWithKeyboard(page, fixture.studentWithGrant, APP_URL_PATTERN);
  await expect(
    page.getByRole("heading", { name: "Seu espaço de aprendizagem" })
  ).toBeVisible();
});

test("aluno navega do Dashboard ao Curso e à primeira Aula com teclado", async ({
  page,
}) => {
  const fixture = await readFixture();

  await signInWithKeyboard(page, fixture.studentWithGrant, APP_URL_PATTERN);

  const skipLink = page.getByRole("link", {
    name: "Pular para o conteúdo principal",
  });
  await page.keyboard.press("Tab");
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();

  const courseLink = page
    .locator("#main-content")
    .getByRole("link", { exact: true, name: "Curso E2E" });
  await focusWithTab(page, courseLink);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/app/cursos/${fixture.course.id}$`));
  await expect(
    page.getByRole("heading", { name: "Trilha do curso" })
  ).toBeVisible();

  const courseAction = page.getByRole("link", {
    name: COURSE_ACTION_NAME_PATTERN,
  });
  await focusWithTab(page, courseAction);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(
    new RegExp(`/app/aulas/${fixture.course.lessonOneId}$`)
  );
  await expect(
    page.getByRole("heading", { name: "Primeira aula" })
  ).toBeVisible();
});

test("Aula expõe conclusão e não libera a próxima Aula fora da sequência", async ({
  page,
}) => {
  const fixture = await readFixture();

  await signInWithKeyboard(page, fixture.studentWithGrant, APP_URL_PATTERN);
  await page.goto(`/app/aulas/${fixture.course.lessonOneId}`);

  const completionButton = page.getByRole("button", {
    name: "Concluir aula no cabeçalho",
  });
  await focusWithTab(page, completionButton);
  await expect(completionButton).toBeFocused();
  await expect(page.locator(":focus-visible")).toHaveCount(1);

  const secondLessonLink = page.getByRole("link", {
    exact: true,
    name: "Segunda aula",
  });
  await expect(secondLessonLink).toHaveCount(0);

  const lockedNextAction = page.getByRole("button", {
    name: "Aula bloqueada",
  });
  await focusWithTab(page, lockedNextAction);
  await expect(lockedNextAction).toBeFocused();
  await expect(
    lockedNextAction.locator("xpath=ancestor::*[@aria-disabled='true'][1]")
  ).toBeVisible();

  const lessonUrl = page.url();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(lessonUrl);
});

test("navegação móvel do conteúdo da Aula abre com Enter @mobile-only", async ({
  page,
}) => {
  const fixture = await readFixture();

  await signInWithKeyboard(page, fixture.studentWithGrant, APP_URL_PATTERN);
  await page.goto(`/app/aulas/${fixture.course.lessonOneId}`);

  const courseNavigation = page
    .locator("#main-content details")
    .filter({ hasText: "Conteúdo do curso" });
  const summary = courseNavigation.locator("summary");

  await focusWithTab(page, summary);
  await expect(summary).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(courseNavigation).toHaveAttribute("open", "");
  await expect(
    courseNavigation.getByText("Segunda aula", { exact: true })
  ).toBeVisible();
  await expect(
    courseNavigation.getByRole("link", {
      exact: true,
      name: "Segunda aula",
    })
  ).toHaveCount(0);
});

test("admin abre e fecha um Sheet pelo teclado e recupera o foco", async ({
  page,
}) => {
  const fixture = await readFixture();

  await signInWithKeyboard(page, fixture.admin, ADMIN_URL_PATTERN);
  await page.goto(`/admin/cursos/${fixture.course.id}?tab=students`);

  const studentRow = page
    .locator("tbody tr")
    .filter({ hasText: fixture.studentWithGrant.email });
  const manageButton = studentRow.getByRole("button", {
    name: `Ações de ${fixture.studentWithGrant.name}`,
  });

  await focusWithTab(page, manageButton);
  await expect(manageButton).toBeFocused();
  await page.keyboard.press("Enter");

  const detailsMenuItem = page.getByRole("menuitem", {
    name: "Ver detalhes",
  });
  await expect(detailsMenuItem).toBeFocused();
  await page.keyboard.press("Enter");

  const studentSheet = page.getByRole("dialog");
  await expect(studentSheet).toBeVisible();
  await expect(studentSheet.getByText("Curso em contexto")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(studentSheet).toBeHidden();
  await expect(manageButton).toBeFocused();
});

test("aluno percorre o certificado e alcança as ações públicas com teclado", async ({
  page,
}) => {
  const fixture = await readFixture();

  await signInWithKeyboard(page, fixture.studentWithGrant, APP_URL_PATTERN);
  await page.goto("/app/certificados");

  const certificateLink = page.getByRole("link", {
    exact: true,
    name: fixture.certificate.ready.courseTitle,
  });
  await focusWithTab(page, certificateLink);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(
    new RegExp(`/certificados/${fixture.certificate.ready.code}$`)
  );
  await expect(
    page.getByRole("heading", { name: "Verificação de certificado" })
  ).toBeVisible();

  const downloadLink = page.getByRole("link", { name: "Baixar PDF" });
  const copyLinkButton = page.getByRole("button", { name: "Copiar link" });
  await focusWithTab(page, downloadLink);
  await expect(downloadLink).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(copyLinkButton).toBeFocused();
});
