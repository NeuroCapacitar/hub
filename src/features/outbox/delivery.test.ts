import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getPool: vi.fn(),
  createEmailChangeToken: vi.fn(),
  getEmailChangeConfirmationDeliveryData: vi.fn(),
  getEmailChangeNoticeDeliveryData: vi.fn(),
  getAuth: vi.fn(),
  getApplicationUrl: vi.fn(),
  getAsaasProviderClient: vi.fn(),
  getServerEnv: vi.fn(),
  renderPendingCertificate: vi.fn(),
  sendAccessExpiryWarningEmail: vi.fn(),
  sendAccessReleasedEmail: vi.fn(),
  sendCertificateIssuedEmail: vi.fn(),
  sendCourseSalesOpenedEmail: vi.fn(),
  sendEmailVerificationEmail: vi.fn(),
  sendEmailChangeConfirmationEmail: vi.fn(),
  sendEmailChangeNoticeEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  sendPurchaseConfirmedEmail: vi.fn(),
  sendStaffInvitationEmail: vi.fn(),
  sendSupportRequestEmail: vi.fn(),
  createStaffInvitationUrlToken: vi.fn(),
  getStaffInvitationDeliveryData: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));
vi.mock("@/lib/auth", () => ({ getAuth: dependencies.getAuth }));
vi.mock("@/lib/env", () => ({ getServerEnv: dependencies.getServerEnv }));
vi.mock("@/features/payments/provider", () => ({
  getApplicationUrl: dependencies.getApplicationUrl,
  getAsaasProviderClient: dependencies.getAsaasProviderClient,
}));
vi.mock("@/features/certificates/server", () => ({
  renderPendingCertificate: dependencies.renderPendingCertificate,
}));
vi.mock("@/features/admin/staff-invitations", () => ({
  createStaffInvitationUrlToken: dependencies.createStaffInvitationUrlToken,
  getStaffInvitationDeliveryData: dependencies.getStaffInvitationDeliveryData,
}));
vi.mock("@/features/account/email-change", () => ({
  createEmailChangeToken: dependencies.createEmailChangeToken,
  getEmailChangeConfirmationDeliveryData:
    dependencies.getEmailChangeConfirmationDeliveryData,
  getEmailChangeNoticeDeliveryData:
    dependencies.getEmailChangeNoticeDeliveryData,
}));
vi.mock("@/features/email/server", () => ({
  sendAccessExpiryWarningEmail: dependencies.sendAccessExpiryWarningEmail,
  sendAccessReleasedEmail: dependencies.sendAccessReleasedEmail,
  sendCertificateIssuedEmail: dependencies.sendCertificateIssuedEmail,
  sendCourseSalesOpenedEmail: dependencies.sendCourseSalesOpenedEmail,
  sendEmailVerificationEmail: dependencies.sendEmailVerificationEmail,
  sendEmailChangeConfirmationEmail:
    dependencies.sendEmailChangeConfirmationEmail,
  sendEmailChangeNoticeEmail: dependencies.sendEmailChangeNoticeEmail,
  sendPasswordResetEmail: dependencies.sendPasswordResetEmail,
  sendPurchaseConfirmedEmail: dependencies.sendPurchaseConfirmedEmail,
  sendStaffInvitationEmail: dependencies.sendStaffInvitationEmail,
  sendSupportRequestEmail: dependencies.sendSupportRequestEmail,
}));

import { verifyEmailChallengeToken } from "@/features/account/email-challenge-token";
import {
  ACCOUNT_ACTIVATION_IDEMPOTENCY_HEADER,
  deriveAccountActivationEmailIdempotencyKey,
} from "@/lib/account-activation-idempotency";
import { sendBetterAuthPasswordResetEmail } from "@/lib/auth-password-reset";
import { deliverOutboxMessage } from "./delivery";

const PAID_ASAAS_ORDER_PATTERN =
  /orders\.provider = 'asaas'[\s\S]*orders\.status = 'paid'/i;

interface PasswordResetApiInput {
  body: {
    email: string;
  };
  request?: Request;
}

const invokePasswordResetCallback = async ({
  body,
  request,
}: PasswordResetApiInput): Promise<{ status: true }> => {
  try {
    await sendBetterAuthPasswordResetEmail(
      {
        url: `https://auth.example.test/reset/${body.email}`,
        user: {
          email: body.email,
          name: "Student",
        },
      },
      request
    );
  } catch {
    // Better Auth logs and swallows callback failures before resolving its API.
  }
  return { status: true };
};

describe("outbox email delivery", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    dependencies.sendPasswordResetEmail.mockResolvedValue(undefined);
    dependencies.sendEmailVerificationEmail.mockResolvedValue(undefined);
    dependencies.sendEmailChangeConfirmationEmail.mockResolvedValue(undefined);
    dependencies.sendEmailChangeNoticeEmail.mockResolvedValue(undefined);
    dependencies.createEmailChangeToken.mockReturnValue(
      "signed-email-change-token"
    );
    dependencies.sendPurchaseConfirmedEmail.mockResolvedValue(undefined);
    dependencies.sendStaffInvitationEmail.mockResolvedValue(undefined);
    dependencies.createStaffInvitationUrlToken.mockReturnValue(
      "signed-invite-token"
    );
    dependencies.getServerEnv.mockReturnValue({
      BETTER_AUTH_SECRET: "auth-secret",
      BETTER_AUTH_URL: "https://auth.example.test",
    });
    dependencies.getAsaasProviderClient.mockReturnValue({
      cancelCheckout: vi.fn(),
    });
  });

  it("reconstructs a staff invitation link at delivery time", async () => {
    const invitationId = "8b5f2d8e-dc4d-43a3-9c1b-35dcac2a2a32";
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    dependencies.getStaffInvitationDeliveryData.mockResolvedValue({
      email: "new-staff@example.test",
      expiresAt,
      generation: 4,
      inviterName: "Admin Teste",
      role: "support",
    });
    dependencies.getApplicationUrl.mockImplementation(
      (path: string) => `https://hub.example.test${path}`
    );

    await deliverOutboxMessage({
      aggregateId: invitationId,
      aggregateType: "staff_invitation",
      attempts: 1,
      id: "outbox-staff-invitation",
      idempotencyKey: `auth.staff-invitation/${invitationId}/4/v1`,
      payload: { generation: 4, invitationId },
      payloadVersion: 1,
      topic: "auth.staff-invitation",
    });

    expect(dependencies.createStaffInvitationUrlToken).toHaveBeenCalledWith({
      expiresAt,
      generation: 4,
      invitationId,
    });
    expect(dependencies.sendStaffInvitationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        actionUrl:
          "https://hub.example.test/convites/equipe/aceitar#token=signed-invite-token",
        deliveryContext: expect.objectContaining({
          idempotencyKey: `auth.staff-invitation/${invitationId}/4/v1`,
          topic: "auth.staff-invitation",
        }),
        inviterName: "Admin Teste",
        roleLabel: "Suporte",
        to: "new-staff@example.test",
      })
    );
  });

  it("supersedes a stale staff invitation without sending it", async () => {
    dependencies.getStaffInvitationDeliveryData.mockResolvedValue(null);
    const invitationId = "8b5f2d8e-dc4d-43a3-9c1b-35dcac2a2a32";

    await expect(
      deliverOutboxMessage({
        aggregateId: invitationId,
        aggregateType: "staff_invitation",
        attempts: 1,
        id: "outbox-stale-staff-invitation",
        idempotencyKey: `auth.staff-invitation/${invitationId}/2/v1`,
        payload: { generation: 2, invitationId },
        payloadVersion: 1,
        topic: "auth.staff-invitation",
      })
    ).rejects.toMatchObject({ code: "staff_invitation_stale" });
    expect(dependencies.sendStaffInvitationEmail).not.toHaveBeenCalled();
  });

  it("delivers the current stage of an email change with a purpose-bound fragment token", async () => {
    const changeRequestId = "44b1793a-6381-48a2-9002-6acfe70a0a20";
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    dependencies.getEmailChangeConfirmationDeliveryData.mockResolvedValue({
      changeRequestId,
      currentEmail: "old@example.test",
      expiresAt,
      generation: 2,
      newEmail: "new@example.test",
      stage: "pending_current",
      to: "old@example.test",
      userName: "Pessoa",
    });
    dependencies.getApplicationUrl.mockImplementation(
      (path: string) => `https://hub.example.test${path}`
    );

    await deliverOutboxMessage({
      aggregateId: changeRequestId,
      aggregateType: "account_email_change",
      attempts: 1,
      id: "outbox-email-change",
      idempotencyKey: `auth.email-change-confirmation/${changeRequestId}/2/v1`,
      payload: { changeRequestId, generation: 2 },
      payloadVersion: 1,
      topic: "auth.email-change-confirmation",
    });

    expect(dependencies.createEmailChangeToken).toHaveBeenCalledWith({
      changeRequestId,
      expiresAt,
      generation: 2,
    });
    expect(dependencies.sendEmailChangeConfirmationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        actionUrl:
          "https://hub.example.test/confirmar-troca-email#token=signed-email-change-token",
        currentEmail: "old@example.test",
        newEmail: "new@example.test",
        stepLabel: "Confirmar e-mail atual",
        to: "old@example.test",
      })
    );
  });

  it("sends the completed email-change notice to the selected old or new address", async () => {
    const changeRequestId = "44b1793a-6381-48a2-9002-6acfe70a0a20";
    dependencies.getServerEnv.mockReturnValue({
      BETTER_AUTH_SECRET: "auth-secret",
      BETTER_AUTH_URL: "https://auth.example.test",
      RESEND_FROM_EMAIL: "hub@example.test",
      SUPPORT_EMAIL: "support@example.test",
    });
    dependencies.getEmailChangeNoticeDeliveryData.mockResolvedValue({
      completedAt: new Date("2026-09-29T14:00:00.000Z"),
      currentEmail: "old@example.test",
      newEmail: "new@example.test",
      to: "new@example.test",
      userName: "Pessoa",
    });

    await deliverOutboxMessage({
      aggregateId: changeRequestId,
      aggregateType: "account_email_change",
      attempts: 1,
      id: "outbox-email-change-notice",
      idempotencyKey: `email.email-change-notice/${changeRequestId}/new/v1`,
      payload: { changeRequestId, recipient: "new" },
      payloadVersion: 1,
      topic: "email.email-change-notice",
    });

    expect(dependencies.sendEmailChangeNoticeEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        currentEmail: "old@example.test",
        newEmail: "new@example.test",
        supportEmail: "support@example.test",
        to: "new@example.test",
      })
    );
  });

  it("reconstructs an email challenge link from current persisted identifiers", async () => {
    const challengeId = "f5c60626-5c2f-4f2a-8d2d-03c28e47b68c";
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          challenge_id: challengeId,
          consumed_at: null,
          expires_at: expiresAt,
          generation: 3,
          pending_signup_id: challengeId,
          pending_signup_email: "student@example.test",
          pending_signup_name: "Student Example",
          pending_signup_status: "pending",
          purpose: "signup",
          recipient_email: "student@example.test",
          recipient_name: "Student Example",
          user_id: null,
          user_email: null,
          user_name: null,
        },
      ],
    });
    dependencies.getPool.mockReturnValue({ query });
    dependencies.getApplicationUrl.mockImplementation(
      (path: string) => `https://hub.example.test${path}`
    );

    await deliverOutboxMessage({
      aggregateId: challengeId,
      aggregateType: "account_email_challenge",
      attempts: 1,
      id: "outbox-email-challenge",
      idempotencyKey: `auth.email-verification/${challengeId}/3/v1`,
      payload: { challengeId, generation: 3 },
      payloadVersion: 1,
      topic: "auth.email-verification",
    });

    expect(dependencies.sendEmailVerificationEmail).toHaveBeenCalledOnce();
    const email = dependencies.sendEmailVerificationEmail.mock.calls[0]?.[0];
    expect(email).toMatchObject({
      deliveryContext: {
        idempotencyKey: `auth.email-verification/${challengeId}/3/v1`,
        outboxMessageId: "outbox-email-challenge",
        topic: "auth.email-verification",
      },
      to: "student@example.test",
      userName: "Student Example",
    });
    const verificationUrl = new URL(email.verificationUrl);
    expect(verificationUrl.pathname).toBe("/confirmar-email");
    const token = new URLSearchParams(verificationUrl.hash.slice(1)).get(
      "token"
    );
    expect(token).toBeTruthy();
    expect(
      verifyEmailChallengeToken({
        purpose: "signup",
        secret: "auth-secret",
        token: token ?? "",
      })
    ).toMatchObject({ challengeId, generation: 3, purpose: "signup" });
    expect(verificationUrl.toString()).not.toContain("student@example.test");
  });

  it("sends a verified buyer to the purchased course without a password reset URL", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          course_slug: "curso-teste",
          course_title: "Curso de teste",
          email_verified: true,
          purchase_verification_required: false,
          student_email: "student@example.test",
          student_name: "Student Example",
        },
      ],
    });
    dependencies.getPool.mockReturnValue({ query });
    dependencies.getApplicationUrl.mockImplementation(
      (path: string) => `https://hub.example.test${path}`
    );

    await deliverOutboxMessage({
      aggregateId: "order-1",
      aggregateType: "order",
      attempts: 1,
      id: "outbox-purchase-confirmed",
      idempotencyKey: "email.purchase-confirmed/order-1/v1",
      payload: { orderId: "order-1", userId: "student-1" },
      payloadVersion: 1,
      topic: "email.purchase-confirmed",
    });

    expect(dependencies.sendPurchaseConfirmedEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        actionLabel: "Acessar Curso",
        actionUrl: "https://hub.example.test/comprar/curso-teste",
        courseTitle: "Curso de teste",
        deliveryContext: expect.objectContaining({
          outboxMessageId: "outbox-purchase-confirmed",
          topic: "email.purchase-confirmed",
        }),
        to: "student@example.test",
        userName: "Student Example",
      })
    );
    expect(dependencies.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("uses a purpose-bound purchase verification challenge for an unverified buyer", async () => {
    const challengeId = "f5c60626-5c2f-4f2a-8d2d-03c28e47b68c";
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            course_slug: "curso-teste",
            course_title: "Curso de teste",
            email_verified: false,
            purchase_verification_required: true,
            student_email: "student@example.test",
            student_name: "Student Example",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            challenge_id: challengeId,
            consumed_at: null,
            expires_at: expiresAt,
            generation: 4,
            purpose: "purchase_verification",
            user_id: "student-1",
          },
        ],
      });
    dependencies.getPool.mockReturnValue({ query });
    dependencies.getApplicationUrl.mockImplementation(
      (path: string) => `https://hub.example.test${path}`
    );

    await deliverOutboxMessage({
      aggregateId: "order-1",
      aggregateType: "order",
      attempts: 1,
      id: "outbox-purchase-unverified",
      idempotencyKey: "email.purchase-confirmed/order-1/v1",
      payload: { orderId: "order-1", userId: "student-1" },
      payloadVersion: 1,
      topic: "email.purchase-confirmed",
    });

    const email = dependencies.sendPurchaseConfirmedEmail.mock.calls[0]?.[0];
    expect(email).toMatchObject({
      actionLabel: "Confirmar e-mail",
      courseTitle: "Curso de teste",
      to: "student@example.test",
      userName: "Student Example",
    });
    const actionUrl = new URL(email.actionUrl);
    const token = new URLSearchParams(actionUrl.hash.slice(1)).get("token");
    expect(actionUrl.pathname).toBe("/confirmar-email");
    expect(
      verifyEmailChallengeToken({
        purpose: "purchase_verification",
        secret: "auth-secret",
        token: token ?? "",
      })
    ).toMatchObject({
      challengeId,
      generation: 4,
      purpose: "purchase_verification",
    });
  });

  it("keeps the purchase email action and recipient stable after account state changes", async () => {
    const challengeId = "f5c60626-5c2f-4f2a-8d2d-03c28e47b68c";
    const deliveryExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    let deliveryStarted = false;
    const query = vi.fn((statement: string, _values: unknown[] = []) => {
      if (statement.includes("from orders")) {
        return {
          rows: [
            {
              course_slug: "curso-teste",
              course_title: "Curso de teste",
              email_verified: deliveryStarted,
              purchase_verification_required: true,
              student_email: "buyer-at-purchase@example.test",
              student_name: "Nome na compra",
            },
          ],
        };
      }
      if (statement.includes("update account_email_challenges")) {
        if (deliveryStarted) {
          return { rows: [] };
        }
        deliveryStarted = true;
        return {
          rows: [
            {
              challenge_id: challengeId,
              consumed_at: null,
              expires_at: deliveryExpiry,
              generation: 5,
              purpose: "purchase_verification",
              user_id: "student-1",
            },
          ],
        };
      }
      if (statement.includes("from account_email_challenges")) {
        return {
          rows: [
            {
              challenge_id: challengeId,
              consumed_at: null,
              expires_at: deliveryExpiry,
              generation: 5,
              purpose: "purchase_verification",
              user_id: "student-1",
            },
          ],
        };
      }
      return { rows: [] };
    });
    dependencies.getPool.mockReturnValue({ query });
    dependencies.getApplicationUrl.mockImplementation(
      (path: string) => `https://hub.example.test${path}`
    );
    const message = {
      aggregateId: "order-1",
      aggregateType: "order",
      attempts: 1,
      id: "outbox-purchase-v1",
      idempotencyKey: "email.purchase-confirmed/order-1/v1",
      payload: { orderId: "order-1", userId: "student-1" },
      payloadVersion: 1,
      topic: "email.purchase-confirmed",
    } as const;

    await deliverOutboxMessage(message);
    await deliverOutboxMessage({ ...message, attempts: 2 });

    const deliveries = dependencies.sendPurchaseConfirmedEmail.mock.calls.map(
      ([input]) => input
    );
    expect(deliveries).toHaveLength(2);
    expect(deliveries[0]).toMatchObject({
      actionLabel: "Confirmar e-mail",
      to: "buyer-at-purchase@example.test",
      userName: "Nome na compra",
    });
    expect(deliveries[1]).toMatchObject(deliveries[0]);
    expect(String(query.mock.calls[0]?.[0])).toContain("orders.customer_email");
    expect(String(query.mock.calls[0]?.[0])).toContain("orders.customer_name");
    expect(String(query.mock.calls[0]?.[0])).not.toContain(
      "coalesce(orders.customer_email"
    );
    expect(String(query.mock.calls[0]?.[0])).not.toContain(
      "coalesce(orders.customer_name"
    );
    expect(String(query.mock.calls[0]?.[0])).toContain(
      "purchase_confirmation_intents.verification_required"
    );
    expect(String(query.mock.calls[1]?.[0])).toContain("interval '23 hours'");
    expect(String(query.mock.calls[1]?.[0])).toContain(
      "email_messages.first_provider_attempt_at"
    );
    expect(query.mock.calls[1]?.[1]).toEqual([
      "order-1",
      "student-1",
      "outbox-purchase-v1",
    ]);
  });

  it("recreates a proof removed by maintenance before the first provider attempt", async () => {
    const challengeId = "f5c60626-5c2f-4f2a-8d2d-03c28e47b68c";
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const query = vi.fn((statement: string, _values: unknown[] = []) => {
      if (statement.includes("from orders")) {
        return {
          rows: [
            {
              course_slug: "curso-teste",
              course_title: "Curso de teste",
              email_verified: false,
              purchase_verification_required: true,
              student_email: "buyer@example.test",
              student_name: "Comprador",
            },
          ],
        };
      }
      if (statement.includes("update account_email_challenges")) {
        return { rows: [] };
      }
      if (statement.includes("from account_email_challenges")) {
        return { rows: [] };
      }
      if (
        statement.includes("select exists") &&
        statement.includes("email_messages")
      ) {
        return { rows: [{ attempted: false }] };
      }
      if (statement.includes("insert into account_email_challenges")) {
        return {
          rows: [
            {
              challenge_id: challengeId,
              consumed_at: null,
              expires_at: expiresAt,
              generation: 1,
              purpose: "purchase_verification",
              user_id: "student-1",
            },
          ],
        };
      }
      return { rows: [] };
    });
    dependencies.getPool.mockReturnValue({ query });
    dependencies.getApplicationUrl.mockImplementation(
      (path: string) => `https://hub.example.test${path}`
    );

    await deliverOutboxMessage({
      aggregateId: "order-1",
      aggregateType: "order",
      attempts: 25,
      id: "outbox-purchase-no-first-attempt",
      idempotencyKey: "email.purchase-confirmed/order-1/v1",
      payload: { orderId: "order-1", userId: "student-1" },
      payloadVersion: 1,
      topic: "email.purchase-confirmed",
    });

    const email = dependencies.sendPurchaseConfirmedEmail.mock.calls[0]?.[0];
    expect(email?.actionLabel).toBe("Confirmar e-mail");
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("insert into account_email_challenges"),
      ["order-1", "student-1"]
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("select exists"),
      ["outbox-purchase-no-first-attempt"]
    );
    const url = new URL(email?.actionUrl ?? "https://hub.example.test");
    const token = new URLSearchParams(url.hash.slice(1)).get("token");
    expect(
      verifyEmailChallengeToken({
        purpose: "purchase_verification",
        secret: "auth-secret",
        token: token ?? "",
      })
    ).toMatchObject({
      challengeId,
      generation: 1,
      purpose: "purchase_verification",
    });
  });

  it("does not replace a missing proof after the provider attempt has started", async () => {
    const query = vi.fn((statement: string) => {
      if (statement.includes("from orders")) {
        return {
          rows: [
            {
              course_slug: "curso-teste",
              course_title: "Curso de teste",
              email_verified: false,
              purchase_verification_required: true,
              student_email: "buyer@example.test",
              student_name: "Comprador",
            },
          ],
        };
      }
      if (statement.includes("update account_email_challenges")) {
        return { rows: [] };
      }
      if (statement.includes("from account_email_challenges")) {
        return { rows: [] };
      }
      if (
        statement.includes("select exists") &&
        statement.includes("email_messages")
      ) {
        return { rows: [{ attempted: true }] };
      }
      return { rows: [] };
    });
    dependencies.getPool.mockReturnValue({ query });

    await expect(
      deliverOutboxMessage({
        aggregateId: "order-1",
        aggregateType: "order",
        attempts: 2,
        id: "outbox-purchase-attempted",
        idempotencyKey: "email.purchase-confirmed/order-1/v1",
        payload: { orderId: "order-1", userId: "student-1" },
        payloadVersion: 1,
        topic: "email.purchase-confirmed",
      })
    ).rejects.toMatchObject({
      code: "purchase_verification_challenge_missing",
    });

    expect(
      query.mock.calls.some(([statement]) =>
        String(statement).includes("insert into account_email_challenges")
      )
    ).toBe(false);
    expect(dependencies.sendPurchaseConfirmedEmail).not.toHaveBeenCalled();
  });

  it("resolves the current account email when delivering an eligible activation", async () => {
    const requestPasswordReset = vi
      .fn()
      .mockImplementation(invokePasswordResetCallback);
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          has_credential: false,
          has_google_account: false,
          student_email: "current@example.test",
        },
      ],
    });
    dependencies.getPool.mockReturnValue({ query });
    dependencies.getAuth.mockReturnValue({
      api: { requestPasswordReset },
    });
    dependencies.getApplicationUrl.mockReturnValue(
      "https://hub.example.test/redefinir-senha"
    );
    await deliverOutboxMessage({
      aggregateId: "order-1",
      aggregateType: "order",
      attempts: 1,
      id: "outbox-activation",
      idempotencyKey: "auth.account-activation/order-1/v1",
      payload: { orderId: "order-1", userId: "user-1" },
      payloadVersion: 1,
      topic: "auth.account-activation",
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringMatching(PAID_ASAAS_ORDER_PATTERN),
      ["order-1", "user-1"]
    );
    expect(String(query.mock.calls[0]?.[0])).toContain(
      "accounts.password is not null"
    );
    expect(requestPasswordReset).toHaveBeenCalledWith({
      asResponse: false,
      body: {
        email: "current@example.test",
        redirectTo: "https://hub.example.test/redefinir-senha",
      },
      headers: {
        [ACCOUNT_ACTIVATION_IDEMPOTENCY_HEADER]:
          deriveAccountActivationEmailIdempotencyKey({
            authSecret: "auth-secret",
            outboxIdempotencyKey: "auth.account-activation/order-1/v1",
          }),
      },
      request: expect.any(Request),
    });
    const request: unknown = requestPasswordReset.mock.calls[0]?.[0]?.request;
    expect(request).toBeInstanceOf(Request);
    if (!(request instanceof Request)) {
      throw new Error("Expected a Better Auth request.");
    }
    expect(request.headers.get(ACCOUNT_ACTIVATION_IDEMPOTENCY_HEADER)).toBe(
      deriveAccountActivationEmailIdempotencyKey({
        authSecret: "auth-secret",
        outboxIdempotencyKey: "auth.account-activation/order-1/v1",
      })
    );
    expect(dependencies.sendPasswordResetEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: deriveAccountActivationEmailIdempotencyKey({
          authSecret: "auth-secret",
          outboxIdempotencyKey: "auth.account-activation/order-1/v1",
        }),
      })
    );
  });

  it("rejects an activation when the paid Asaas order does not match", async () => {
    const requestPasswordReset = vi.fn();
    dependencies.getPool.mockReturnValue({
      query: vi.fn().mockResolvedValue({ rows: [] }),
    });
    dependencies.getAuth.mockReturnValue({
      api: { requestPasswordReset },
    });

    await expect(
      deliverOutboxMessage({
        aggregateId: "order-1",
        aggregateType: "order",
        attempts: 1,
        id: "outbox-activation",
        idempotencyKey: "auth.account-activation/order-1/v1",
        payload: { orderId: "order-1", userId: "wrong-user" },
        payloadVersion: 1,
        topic: "auth.account-activation",
      })
    ).rejects.toMatchObject({
      code: "aggregate_not_deliverable",
      retryable: false,
    });
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it("rejects malformed activation delivery data", async () => {
    const requestPasswordReset = vi.fn();
    dependencies.getPool.mockReturnValue({
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            has_credential: "false",
            has_google_account: false,
            student_email: 123,
          },
        ],
      }),
    });
    dependencies.getAuth.mockReturnValue({
      api: { requestPasswordReset },
    });

    await expect(
      deliverOutboxMessage({
        aggregateId: "order-1",
        aggregateType: "order",
        attempts: 1,
        id: "outbox-activation",
        idempotencyKey: "auth.account-activation/order-1/v1",
        payload: { orderId: "order-1", userId: "user-1" },
        payloadVersion: 1,
        topic: "auth.account-activation",
      })
    ).rejects.toMatchObject({
      code: "aggregate_not_deliverable",
      retryable: false,
    });
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it("delivers activation as a no-op when credentials already exist", async () => {
    const requestPasswordReset = vi.fn();
    dependencies.getPool.mockReturnValue({
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            has_credential: true,
            has_google_account: false,
            student_email: "current@example.test",
          },
        ],
      }),
    });
    dependencies.getAuth.mockReturnValue({
      api: { requestPasswordReset },
    });

    await deliverOutboxMessage({
      aggregateId: "order-1",
      aggregateType: "order",
      attempts: 1,
      id: "outbox-activation",
      idempotencyKey: "auth.account-activation/order-1/v1",
      payload: { orderId: "order-1", userId: "user-1" },
      payloadVersion: 1,
      topic: "auth.account-activation",
    });

    expect(requestPasswordReset).not.toHaveBeenCalled();
    expect(dependencies.sendAccessReleasedEmail).not.toHaveBeenCalled();
  });

  it("does not send a password-activation link when an enabled Google login already exists", async () => {
    const requestPasswordReset = vi.fn();
    dependencies.getPool.mockReturnValue({
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            has_credential: false,
            has_google_account: true,
            student_email: "google-only@example.test",
          },
        ],
      }),
    });
    dependencies.getServerEnv.mockReturnValue({
      BETTER_AUTH_SECRET: "auth-secret",
      BETTER_AUTH_URL: "https://auth.example.test",
      GOOGLE_CLIENT_ID: "google-client-id",
      GOOGLE_CLIENT_SECRET: "google-client-secret",
    });
    dependencies.getAuth.mockReturnValue({
      api: { requestPasswordReset },
    });

    await deliverOutboxMessage({
      aggregateId: "order-1",
      aggregateType: "order",
      attempts: 1,
      id: "outbox-activation",
      idempotencyKey: "auth.account-activation/order-1/v1",
      payload: { orderId: "order-1", userId: "user-1" },
      payloadVersion: 1,
      topic: "auth.account-activation",
    });

    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it("keeps email activation when a Google account exists but the provider is disabled", async () => {
    const requestPasswordReset = vi
      .fn()
      .mockImplementation(invokePasswordResetCallback);
    dependencies.getPool.mockReturnValue({
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            has_credential: false,
            has_google_account: true,
            student_email: "google-only@example.test",
          },
        ],
      }),
    });
    dependencies.getAuth.mockReturnValue({
      api: { requestPasswordReset },
    });

    await deliverOutboxMessage({
      aggregateId: "order-1",
      aggregateType: "order",
      attempts: 1,
      id: "outbox-activation",
      idempotencyKey: "auth.account-activation/order-1/v1",
      payload: { orderId: "order-1", userId: "user-1" },
      payloadVersion: 1,
      topic: "auth.account-activation",
    });

    expect(requestPasswordReset).toHaveBeenCalledOnce();
  });

  it("classifies Better Auth failures without exposing their cause", async () => {
    dependencies.getPool.mockReturnValue({
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            has_credential: false,
            has_google_account: false,
            student_email: "private@example.test",
          },
        ],
      }),
    });
    dependencies.getAuth.mockReturnValue({
      api: {
        requestPasswordReset: vi
          .fn()
          .mockRejectedValue(new Error("SMTP private@example.test failed")),
      },
    });

    await expect(
      deliverOutboxMessage({
        aggregateId: "order-1",
        aggregateType: "order",
        attempts: 1,
        id: "outbox-activation",
        idempotencyKey: "auth.account-activation/order-1/v1",
        payload: { orderId: "order-1", userId: "user-1" },
        payloadVersion: 1,
        topic: "auth.account-activation",
      })
    ).rejects.toMatchObject({
      code: "account_activation_failed",
      message: "account_activation_failed",
      retryable: true,
    });
  });

  it("fails when Better Auth resolves after swallowing the email callback failure", async () => {
    dependencies.getPool.mockReturnValue({
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            has_credential: false,
            has_google_account: false,
            student_email: "private@example.test",
          },
        ],
      }),
    });
    dependencies.sendPasswordResetEmail.mockRejectedValue(
      new Error(
        "Resend failed for private@example.test at https://auth.example.test/reset/private-token"
      )
    );
    dependencies.getAuth.mockReturnValue({
      api: {
        requestPasswordReset: vi
          .fn()
          .mockImplementation(invokePasswordResetCallback),
      },
    });

    await expect(
      deliverOutboxMessage({
        aggregateId: "order-1",
        aggregateType: "order",
        attempts: 1,
        id: "outbox-activation",
        idempotencyKey: "auth.account-activation/order-1/v1",
        payload: { orderId: "order-1", userId: "user-1" },
        payloadVersion: 1,
        topic: "auth.account-activation",
      })
    ).rejects.toMatchObject({
      code: "account_activation_failed",
      message: "account_activation_failed",
      retryable: true,
    });
  });

  it("fails when Better Auth resolves without invoking the email callback", async () => {
    dependencies.getPool.mockReturnValue({
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            has_credential: false,
            has_google_account: false,
            student_email: "missing@example.test",
          },
        ],
      }),
    });
    dependencies.getAuth.mockReturnValue({
      api: {
        requestPasswordReset: vi.fn().mockResolvedValue({ status: true }),
      },
    });

    await expect(
      deliverOutboxMessage({
        aggregateId: "order-1",
        aggregateType: "order",
        attempts: 1,
        id: "outbox-activation",
        idempotencyKey: "auth.account-activation/order-1/v1",
        payload: { orderId: "order-1", userId: "user-1" },
        payloadVersion: 1,
        topic: "auth.account-activation",
      })
    ).rejects.toMatchObject({
      code: "account_activation_failed",
      retryable: true,
    });
  });

  it("isolates concurrent activation callback results", async () => {
    const successCallbackStarted = Promise.withResolvers<void>();
    const releaseSuccessCallback = Promise.withResolvers<void>();
    dependencies.getPool.mockReturnValue({
      query: vi
        .fn()
        .mockImplementation(
          async (_query: string, parameters: [string, string]) => ({
            rows: [
              {
                has_credential: false,
                has_google_account: false,
                student_email:
                  parameters[0] === "order-success"
                    ? "success@example.test"
                    : "failure@example.test",
              },
            ],
          })
        ),
    });
    dependencies.sendPasswordResetEmail.mockImplementation(
      async ({ to }: { to: string }) => {
        if (to === "success@example.test") {
          successCallbackStarted.resolve();
          await releaseSuccessCallback.promise;
          return;
        }
        await successCallbackStarted.promise;
        releaseSuccessCallback.resolve();
        throw new Error("provider unavailable");
      }
    );
    dependencies.getAuth.mockReturnValue({
      api: {
        requestPasswordReset: vi
          .fn()
          .mockImplementation(invokePasswordResetCallback),
      },
    });

    const results = await Promise.allSettled([
      deliverOutboxMessage({
        aggregateId: "order-success",
        aggregateType: "order",
        attempts: 1,
        id: "outbox-success",
        idempotencyKey: "auth.account-activation/order-success/v1",
        payload: { orderId: "order-success", userId: "user-success" },
        payloadVersion: 1,
        topic: "auth.account-activation",
      }),
      deliverOutboxMessage({
        aggregateId: "order-failure",
        aggregateType: "order",
        attempts: 1,
        id: "outbox-failure",
        idempotencyKey: "auth.account-activation/order-failure/v1",
        payload: { orderId: "order-failure", userId: "user-failure" },
        payloadVersion: 1,
        topic: "auth.account-activation",
      }),
    ]);

    expect(results[0]).toMatchObject({ status: "fulfilled" });
    expect(results[1]).toMatchObject({
      reason: expect.objectContaining({
        code: "account_activation_failed",
        retryable: true,
      }),
      status: "rejected",
    });
  });

  it("renders the immutable PDF before enqueueing the certificate email", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    dependencies.getPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue({
        query,
        release: vi.fn(),
      }),
    });
    dependencies.renderPendingCertificate.mockResolvedValue(true);

    await deliverOutboxMessage({
      aggregateId: "certificate-1",
      aggregateType: "certificate",
      attempts: 1,
      id: "outbox-1",
      idempotencyKey: "certificate.render/certificate-1/v1",
      payload: { certificateId: "certificate-1" },
      payloadVersion: 1,
      topic: "certificate.render",
    });

    expect(dependencies.renderPendingCertificate).toHaveBeenCalledWith(
      "certificate-1"
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("insert into outbox_messages"),
      expect.arrayContaining(["email.certificate-issued/certificate-1/v1"])
    );
  });

  it("does not enqueue a certificate email before the artifact is ready", async () => {
    const query = vi.fn();
    dependencies.getPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue({ query, release: vi.fn() }),
    });
    dependencies.renderPendingCertificate.mockResolvedValue(false);

    await expect(
      deliverOutboxMessage({
        aggregateId: "certificate-1",
        aggregateType: "certificate",
        attempts: 1,
        id: "outbox-1",
        idempotencyKey: "certificate.render/certificate-1/v1",
        payload: { certificateId: "certificate-1" },
        payloadVersion: 1,
        topic: "certificate.render",
      })
    ).rejects.toMatchObject({ code: "aggregate_not_deliverable" });

    expect(query).not.toHaveBeenCalled();
  });

  it("classifies certificate rendering failures independently from email provider failures", async () => {
    dependencies.renderPendingCertificate.mockRejectedValue(
      new Error("certificate_background_unavailable")
    );

    await expect(
      deliverOutboxMessage({
        aggregateId: "certificate-1",
        aggregateType: "certificate",
        attempts: 1,
        id: "outbox-1",
        idempotencyKey: "certificate.render/certificate-1/v1",
        payload: { certificateId: "certificate-1" },
        payloadVersion: 1,
        topic: "certificate.render",
      })
    ).rejects.toMatchObject({
      code: "certificate_render_failed",
      retryable: true,
    });
  });

  it("loads certificate recipient data at delivery time and passes its idempotency key", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          certificate_code: "PRT-001",
          course_title: "Curso de teste",
          student_email: "student@example.test",
          student_name: "Aluno Teste",
        },
      ],
    });
    dependencies.getPool.mockReturnValue({ query });
    dependencies.sendCertificateIssuedEmail.mockResolvedValue(undefined);

    await deliverOutboxMessage({
      aggregateId: "certificate-1",
      aggregateType: "certificate",
      attempts: 1,
      id: "outbox-1",
      idempotencyKey: "email.certificate-issued/certificate-1/v1",
      payload: { certificateId: "certificate-1" },
      payloadVersion: 1,
      topic: "email.certificate-issued",
    });

    expect(dependencies.sendCertificateIssuedEmail).toHaveBeenCalledWith({
      certificateCode: "PRT-001",
      courseTitle: "Curso de teste",
      deliveryContext: {
        correlationId: "outbox-1",
        idempotencyKey: "email.certificate-issued/certificate-1/v1",
        outboxMessageId: "outbox-1",
        topic: "email.certificate-issued",
      },
      idempotencyKey: "email.certificate-issued/certificate-1/v1",
      to: "student@example.test",
      userName: "Aluno Teste",
    });
  });

  it("delivers a sales-opened email and removes the consumed nominal interest", async () => {
    const transactionQuery = vi.fn(async (sql: string) => ({
      rows: sql.includes("delete from course_sale_interests")
        ? [{ id: "interest-1" }]
        : [],
    }));
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          course_id: "course-1",
          course_slug: "curso-publico",
          course_title: "Curso público",
          sales_status: "open",
          student_email: "student@example.test",
          student_name: "Aluno Teste",
        },
      ],
    });
    dependencies.getPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue({
        query: transactionQuery,
        release: vi.fn(),
      }),
      query,
    });
    dependencies.sendCourseSalesOpenedEmail.mockResolvedValue(undefined);

    await deliverOutboxMessage({
      aggregateId: "interest-1",
      aggregateType: "course_interest",
      attempts: 1,
      id: "outbox-1",
      idempotencyKey: "email.course-sales-opened/interest-1/v1",
      payload: { interestId: "interest-1" },
      payloadVersion: 1,
      topic: "email.course-sales-opened",
    });

    expect(dependencies.sendCourseSalesOpenedEmail).toHaveBeenCalledWith({
      courseSlug: "curso-publico",
      courseTitle: "Curso público",
      deliveryContext: {
        correlationId: "outbox-1",
        idempotencyKey: "email.course-sales-opened/interest-1/v1",
        outboxMessageId: "outbox-1",
        topic: "email.course-sales-opened",
      },
      idempotencyKey: "email.course-sales-opened/interest-1/v1",
      to: "student@example.test",
      userName: "Aluno Teste",
    });
    expect(transactionQuery).toHaveBeenCalledWith(
      expect.stringContaining("delete from course_sale_interests"),
      ["interest-1"]
    );
    expect(transactionQuery).toHaveBeenCalledWith(
      expect.stringContaining("interest_notifications_sent + 1"),
      ["course-1"]
    );
  });

  it("defers a sales-opened email while the course sales are closed", async () => {
    dependencies.getPool.mockReturnValue({
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            course_id: "course-1",
            course_slug: "curso-publico",
            course_title: "Curso público",
            sales_status: "closed",
            student_email: "student@example.test",
            student_name: "Aluno Teste",
          },
        ],
      }),
    });

    await expect(
      deliverOutboxMessage({
        aggregateId: "interest-1",
        aggregateType: "course_interest",
        attempts: 1,
        id: "outbox-1",
        idempotencyKey: "email.course-sales-opened/interest-1/v1",
        payload: { interestId: "interest-1" },
        payloadVersion: 1,
        topic: "email.course-sales-opened",
      })
    ).rejects.toMatchObject({
      code: "course_sales_closed",
      deferred: true,
    });
    expect(dependencies.sendCourseSalesOpenedEmail).not.toHaveBeenCalled();
  });

  it("delivers a support request email with data read at delivery time", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          course_title: "Curso de suporte",
          message: "Mensagem de teste controlada.",
          student_email: "student@example.test",
          student_name: "Aluno Teste",
          subject: "Dúvida controlada",
        },
      ],
    });
    dependencies.getPool.mockReturnValue({ query });
    dependencies.sendSupportRequestEmail.mockResolvedValue(undefined);

    await deliverOutboxMessage({
      aggregateId: "request-1",
      aggregateType: "support_request",
      attempts: 1,
      id: "outbox-1",
      idempotencyKey: "email.support-request/request-1/v1",
      payload: { requestId: "request-1" },
      payloadVersion: 1,
      topic: "email.support-request",
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("from support_requests"),
      ["request-1"]
    );
    expect(dependencies.sendSupportRequestEmail).toHaveBeenCalledWith({
      courseTitle: "Curso de suporte",
      deliveryContext: {
        correlationId: "outbox-1",
        idempotencyKey: "email.support-request/request-1/v1",
        outboxMessageId: "outbox-1",
        topic: "email.support-request",
      },
      idempotencyKey: "email.support-request/request-1/v1",
      message: "Mensagem de teste controlada.",
      studentEmail: "student@example.test",
      studentName: "Aluno Teste",
      subject: "Dúvida controlada",
    });
  });

  it("rejects a support request whose stored aggregate no longer exists", async () => {
    dependencies.getPool.mockReturnValue({
      query: vi.fn().mockResolvedValue({ rows: [] }),
    });

    await expect(
      deliverOutboxMessage({
        aggregateId: "request-1",
        aggregateType: "support_request",
        attempts: 1,
        id: "outbox-1",
        idempotencyKey: "email.support-request/request-1/v1",
        payload: { requestId: "request-1" },
        payloadVersion: 1,
        topic: "email.support-request",
      })
    ).rejects.toMatchObject({ code: "support_request_unavailable" });

    expect(dependencies.sendSupportRequestEmail).not.toHaveBeenCalled();
  });

  it("cancels an active unpaid Asaas checkout without changing a paid order", async () => {
    const cancelCheckout = vi.fn().mockResolvedValue({
      id: "checkout-1",
      link: "https://asaas.example/checkout-1",
      status: "CANCELED",
    });
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            checkout_status: "active",
            order_status: "pending",
            provider_checkout_id: "checkout-1",
          },
        ],
      })
      .mockResolvedValue({ rows: [] });
    dependencies.getPool.mockReturnValue({ query });
    dependencies.getAsaasProviderClient.mockReturnValue({ cancelCheckout });

    await deliverOutboxMessage({
      aggregateId: "order-1",
      aggregateType: "order",
      attempts: 1,
      id: "outbox-1",
      idempotencyKey: "payments.checkout-cancel/order-1/v1",
      payload: { orderId: "order-1" },
      payloadVersion: 1,
      topic: "payments.checkout-cancel",
    });

    expect(cancelCheckout).toHaveBeenCalledWith("checkout-1");
    expect(query).toHaveBeenLastCalledWith(
      expect.stringContaining("and status = 'pending'"),
      ["order-1", "CANCELED"]
    );
  });

  it("treats checkout cancellation as a no-op after payment wins the race", async () => {
    const cancelCheckout = vi.fn();
    dependencies.getPool.mockReturnValue({
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            checkout_status: "active",
            order_status: "paid",
            provider_checkout_id: "checkout-1",
          },
        ],
      }),
    });
    dependencies.getAsaasProviderClient.mockReturnValue({ cancelCheckout });

    await deliverOutboxMessage({
      aggregateId: "order-1",
      aggregateType: "order",
      attempts: 1,
      id: "outbox-1",
      idempotencyKey: "payments.checkout-cancel/order-1/v1",
      payload: { orderId: "order-1" },
      payloadVersion: 1,
      topic: "payments.checkout-cancel",
    });

    expect(cancelCheckout).not.toHaveBeenCalled();
  });

  it("delivers only the current v2 expiry generation in its exact window", async () => {
    const expiresAt = new Date(Date.now() + 6 * 86_400_000);
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          course_id: "course-1",
          course_title: "Course",
          expires_at: expiresAt,
          status: "active",
          student_email: "student@example.test",
          student_name: "Student",
        },
      ],
    });
    dependencies.getPool.mockReturnValue({ query });

    await deliverOutboxMessage({
      aggregateId: "enrollment-1",
      aggregateType: "enrollment",
      attempts: 1,
      id: "outbox-expiry",
      idempotencyKey: `email.access-expiry-warning/enrollment-1/7d/${expiresAt.getTime()}/v2`,
      payload: {
        enrollmentId: "enrollment-1",
        expectedExpiresAt: expiresAt.toISOString(),
        warningKind: "7d",
      },
      payloadVersion: 2,
      topic: "email.access-expiry-warning",
    });

    expect(String(query.mock.calls[0]?.[0])).not.toContain(
      "enrollments.status = 'active'"
    );
    expect(dependencies.sendAccessExpiryWarningEmail).toHaveBeenCalledOnce();
  });

  it("supersedes legacy, changed and inactive expiry warnings before Resend", async () => {
    dependencies.getPool.mockReturnValue({
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            course_id: "course-1",
            course_title: "Course",
            expires_at: new Date(Date.now() + 10 * 86_400_000),
            status: "active",
            student_email: "student@example.test",
            student_name: "Student",
          },
        ],
      }),
    });
    const expectedExpiresAt = new Date(Date.now() + 6 * 86_400_000);
    const base = {
      aggregateId: "enrollment-1",
      aggregateType: "enrollment",
      attempts: 1,
      id: "outbox-expiry",
      topic: "email.access-expiry-warning" as const,
    };

    await expect(
      deliverOutboxMessage({
        ...base,
        idempotencyKey: "email.access-expiry-warning/enrollment-1/7d/v1",
        payload: { enrollmentId: "enrollment-1", warningKind: "7d" },
        payloadVersion: 1,
      })
    ).rejects.toMatchObject({ code: "expiry_payload_v1" });
    await expect(
      deliverOutboxMessage({
        ...base,
        idempotencyKey: `email.access-expiry-warning/enrollment-1/7d/${expectedExpiresAt.getTime()}/v2`,
        payload: {
          enrollmentId: "enrollment-1",
          expectedExpiresAt: expectedExpiresAt.toISOString(),
          warningKind: "7d",
        },
        payloadVersion: 2,
      })
    ).rejects.toMatchObject({ code: "expiry_generation_changed" });
    dependencies.getPool.mockReturnValue({
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            expires_at: expectedExpiresAt,
            status: "revoked",
          },
        ],
      }),
    });
    await expect(
      deliverOutboxMessage({
        ...base,
        idempotencyKey: `email.access-expiry-warning/enrollment-1/7d/${expectedExpiresAt.getTime()}/v2`,
        payload: {
          enrollmentId: "enrollment-1",
          expectedExpiresAt: expectedExpiresAt.toISOString(),
          warningKind: "7d",
        },
        payloadVersion: 2,
      })
    ).rejects.toMatchObject({ code: "expiry_inactive" });
    expect(dependencies.sendAccessExpiryWarningEmail).not.toHaveBeenCalled();
  });

  it("does not try delivery for an unsupported payload version", async () => {
    await expect(
      deliverOutboxMessage({
        aggregateId: "certificate-1",
        aggregateType: "certificate",
        attempts: 1,
        id: "outbox-1",
        idempotencyKey: "email.certificate-issued/certificate-1/v2",
        payload: { certificateId: "certificate-1" },
        payloadVersion: 2,
        topic: "email.certificate-issued",
      })
    ).rejects.toMatchObject({
      code: "unknown_payload_version",
      retryable: false,
    });
  });
});
