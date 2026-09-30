import "server-only";
import { getPool } from "@/db";
import { createEmailChallengeToken } from "@/features/account/email-challenge-token";
import {
  createEmailChangeToken,
  getEmailChangeConfirmationDeliveryData,
  getEmailChangeNoticeDeliveryData,
} from "@/features/account/email-change";
import {
  createStaffInvitationUrlToken,
  getStaffInvitationDeliveryData,
} from "@/features/admin/staff-invitations";
import { renderPendingCertificate } from "@/features/certificates/server";
import type { HostedEmailDeliveryContext } from "@/features/email/server";
import {
  sendAccessExpiryWarningEmail,
  sendAccessReleasedEmail,
  sendCertificateIssuedEmail,
  sendCourseSalesOpenedEmail,
  sendEmailChangeConfirmationEmail,
  sendEmailChangeNoticeEmail,
  sendEmailVerificationEmail,
  sendPurchaseConfirmedEmail,
  sendStaffInvitationEmail,
  sendSupportRequestEmail,
} from "@/features/email/server";
import {
  EMAIL_DELIVERY_TOPIC_TAGS,
  type EmailDeliveryTopic,
} from "@/features/email-delivery/server";
import {
  getApplicationUrl,
  getAsaasProviderClient,
} from "@/features/payments/provider";
import { runWithAccountActivationDeliveryContext } from "@/lib/account-activation-delivery-context";
import {
  ACCOUNT_ACTIVATION_IDEMPOTENCY_HEADER,
  deriveAccountActivationEmailIdempotencyKey,
} from "@/lib/account-activation-idempotency";
import { getAuth } from "@/lib/auth";
import { getSafeAuthReturnTo } from "@/lib/auth-return-to";
import { getServerEnv } from "@/lib/env";
import {
  classifyExpiryWarningGeneration,
  createCertificateIssuedMessage,
  OUTBOX_TOPICS,
  type OutboxPayload,
  parseOutboxPayload,
} from "./rules";
import { enqueueOutboxMessage } from "./server";
import {
  type ClaimedOutboxMessage,
  OutboxDeliveryError,
  OutboxSupersededError,
} from "./worker";

const unavailableAggregate = (): OutboxDeliveryError =>
  new OutboxDeliveryError("aggregate_not_deliverable", { retryable: false });

const unavailableSupportRequest = (): OutboxSupersededError =>
  new OutboxSupersededError("support_request_unavailable");

const deliveryFailure = (): OutboxDeliveryError =>
  new OutboxDeliveryError("resend_delivery_failed", { retryable: true });

const certificateRenderFailure = (): OutboxDeliveryError =>
  new OutboxDeliveryError("certificate_render_failed", { retryable: true });

const accountActivationFailure = (): OutboxDeliveryError =>
  new OutboxDeliveryError("account_activation_failed", { retryable: true });

const purchaseConfirmationFailure = (): OutboxDeliveryError =>
  new OutboxDeliveryError("purchase_confirmation_failed", { retryable: true });

const staffInvitationFailure = (): OutboxDeliveryError =>
  new OutboxDeliveryError("staff_invitation_delivery_failed", {
    retryable: true,
  });

const checkoutCancellationFailure = (): OutboxDeliveryError =>
  new OutboxDeliveryError("checkout_cancellation_failed", { retryable: true });

const courseSalesClosed = (): OutboxDeliveryError =>
  new OutboxDeliveryError("course_sales_closed", {
    deferred: true,
    retryable: true,
  });

const unexpectedDeliveryFailure = (topic: string): OutboxDeliveryError => {
  if (topic === OUTBOX_TOPICS.certificateRender) {
    return certificateRenderFailure();
  }
  if (topic === OUTBOX_TOPICS.accountActivation) {
    return accountActivationFailure();
  }
  if (topic === OUTBOX_TOPICS.purchaseConfirmed) {
    return purchaseConfirmationFailure();
  }
  if (topic === OUTBOX_TOPICS.checkoutCancellation) {
    return checkoutCancellationFailure();
  }
  return deliveryFailure();
};

const createEmailDeliveryContext = (
  message: ClaimedOutboxMessage
): HostedEmailDeliveryContext => {
  if (!(message.topic in EMAIL_DELIVERY_TOPIC_TAGS)) {
    throw new OutboxDeliveryError("unknown_email_delivery_topic", {
      retryable: false,
    });
  }
  return {
    correlationId: message.id,
    idempotencyKey: message.idempotencyKey,
    outboxMessageId: message.id,
    topic: message.topic as EmailDeliveryTopic,
  };
};

interface AccountActivationDeliveryData {
  hasCredential: boolean;
  hasGoogleAccount: boolean;
  studentEmail: string;
}

const parseAccountActivationDeliveryData = (
  row: unknown
): AccountActivationDeliveryData | null => {
  if (!row || typeof row !== "object") {
    return null;
  }
  const hasCredential = Reflect.get(row, "has_credential");
  const hasGoogleAccount = Reflect.get(row, "has_google_account");
  const studentEmail = Reflect.get(row, "student_email");
  if (
    typeof hasCredential !== "boolean" ||
    typeof hasGoogleAccount !== "boolean" ||
    typeof studentEmail !== "string" ||
    !studentEmail
  ) {
    return null;
  }
  return { hasCredential, hasGoogleAccount, studentEmail };
};

const getAccountActivationDeliveryData = async ({
  orderId,
  userId,
}: {
  orderId: string;
  userId: string;
}) => {
  const result = await getPool().query(
    `select
       users.email as student_email,
       exists (
         select 1
         from accounts
         where accounts.user_id = users.id
           and accounts.provider_id = 'credential'
           and accounts.password is not null
       ) as has_credential,
       exists (
         select 1
         from accounts
         where accounts.user_id = users.id
           and accounts.provider_id = 'google'
       ) as has_google_account
     from orders
     join users on users.id = orders.user_id
     where orders.id = $1
       and orders.user_id = $2
       and orders.provider = 'asaas'
       and orders.status = 'paid'
     limit 1`,
    [orderId, userId]
  );
  const row: unknown = result.rows[0];
  return parseAccountActivationDeliveryData(row);
};

interface EmailChallengeDeliveryData {
  challenge_id: string;
  consumed_at: Date | null;
  email_verified: boolean | null;
  expires_at: Date;
  generation: number;
  pending_signup_email: string | null;
  pending_signup_id: string | null;
  pending_signup_name: string | null;
  pending_signup_status: string | null;
  purpose: string;
  user_email: string | null;
  user_id: string | null;
  user_name: string | null;
}

interface ResolvedEmailChallengeDeliveryData
  extends EmailChallengeDeliveryData {
  recipient_email: string;
  recipient_name: string;
}

const getEmailChallengeDeliveryData = async (
  challengeId: string
): Promise<ResolvedEmailChallengeDeliveryData | null> => {
  const result = await getPool().query<EmailChallengeDeliveryData>(
    `
      select
        challenge.id as challenge_id,
        challenge.purpose,
        challenge.generation,
        challenge.expires_at,
        challenge.consumed_at,
        challenge.pending_signup_id,
        pending_signups.status as pending_signup_status,
        pending_signups.name as pending_signup_name,
        pending_signups.email as pending_signup_email,
        challenge.user_id,
        users.email as user_email,
        users.name as user_name,
        users.email_verified
      from account_email_challenges as challenge
      left join pending_signups
        on pending_signups.id = challenge.pending_signup_id
      left join users on users.id = challenge.user_id
      where challenge.id = $1
      limit 1
    `,
    [challengeId]
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }

  const recipientEmail = row.pending_signup_email ?? row.user_email;
  const recipientName = row.pending_signup_name ?? row.user_name;
  if (!(recipientEmail && recipientName)) {
    return null;
  }

  return {
    ...row,
    recipient_email: recipientEmail,
    recipient_name: recipientName,
  };
};

const deliverEmailVerification = async ({
  message,
  payload,
}: {
  message: ClaimedOutboxMessage;
  payload: OutboxPayload;
}): Promise<boolean> => {
  if (
    message.topic !== OUTBOX_TOPICS.emailVerification ||
    !("challengeId" in payload && "generation" in payload)
  ) {
    return false;
  }
  if (message.aggregateId !== payload.challengeId) {
    throw unavailableAggregate();
  }

  const challenge = await getEmailChallengeDeliveryData(payload.challengeId);
  if (
    !challenge ||
    challenge.generation !== payload.generation ||
    challenge.consumed_at ||
    challenge.expires_at.getTime() <= Date.now()
  ) {
    throw new OutboxSupersededError("email_challenge_stale");
  }

  const signupChallenge =
    challenge.purpose === "signup" &&
    challenge.pending_signup_id !== null &&
    challenge.pending_signup_status === "pending";
  const userVerificationChallenge =
    challenge.purpose === "verify_email" &&
    challenge.user_id !== null &&
    challenge.email_verified === false;
  if (!(signupChallenge || userVerificationChallenge)) {
    throw new OutboxSupersededError("email_challenge_unsupported");
  }

  const verificationUrl = new URL(getApplicationUrl("/confirmar-email"));
  verificationUrl.hash = new URLSearchParams({
    token: createEmailChallengeToken({
      challengeId: challenge.challenge_id,
      expiresAt: challenge.expires_at,
      generation: challenge.generation,
      purpose: challenge.purpose as "signup" | "verify_email",
      secret: getServerEnv().BETTER_AUTH_SECRET,
    }),
  }).toString();
  await sendEmailVerificationEmail({
    deliveryContext: createEmailDeliveryContext(message),
    to: challenge.recipient_email as string,
    userName: challenge.recipient_name as string,
    verificationUrl: verificationUrl.toString(),
  });
  return true;
};

const deliverAccountActivation = async ({
  message,
  payload,
}: {
  message: ClaimedOutboxMessage;
  payload: OutboxPayload;
}): Promise<boolean> => {
  if (
    message.topic !== OUTBOX_TOPICS.accountActivation ||
    !("orderId" in payload) ||
    !("userId" in payload)
  ) {
    return false;
  }
  if (message.aggregateId !== payload.orderId) {
    throw unavailableAggregate();
  }
  const data = await getAccountActivationDeliveryData(payload);
  if (!data) {
    throw unavailableAggregate();
  }
  const env = getServerEnv();
  const googleProviderEnabled = Boolean(
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
  );
  const hasUsableSignInMethod =
    data.hasCredential || (data.hasGoogleAccount && googleProviderEnabled);
  if (!hasUsableSignInMethod) {
    const idempotencyKey = deriveAccountActivationEmailIdempotencyKey({
      authSecret: env.BETTER_AUTH_SECRET,
      outboxIdempotencyKey: message.idempotencyKey,
    });
    const headers = {
      [ACCOUNT_ACTIVATION_IDEMPOTENCY_HEADER]: idempotencyKey,
    };
    const emailDelivered = await runWithAccountActivationDeliveryContext({
      emailDeliveryContext: createEmailDeliveryContext(message),
      idempotencyKey,
      operation: async () => {
        await getAuth().api.requestPasswordReset({
          asResponse: false,
          body: {
            email: data.studentEmail,
            redirectTo: getApplicationUrl("/redefinir-senha"),
          },
          headers,
          request: new Request(env.BETTER_AUTH_URL, {
            headers,
            method: "POST",
          }),
        });
      },
    });
    if (!emailDelivered) {
      throw accountActivationFailure();
    }
  }
  return true;
};

const getCertificateDeliveryData = async (certificateId: string) => {
  const result = await getPool().query<{
    certificate_code: string;
    course_title: string;
    student_email: string;
    student_name: string;
  }>(
    `
      select
        certificates.code as certificate_code,
        certificates.course_title_snapshot as course_title,
        users.email as student_email,
        certificates.student_name_snapshot as student_name
      from certificates
      join users on users.id = certificates.user_id
      where certificates.id = $1 and certificates.status = 'valid' and certificates.render_status = 'ready'
      limit 1
    `,
    [certificateId]
  );
  return result.rows[0] ?? null;
};

const getAccessReleasedDeliveryData = async ({
  courseId,
  userId,
}: {
  courseId: string;
  userId: string;
}) => {
  const result = await getPool().query<{
    course_title: string;
    student_email: string;
    student_name: string;
  }>(
    `
      select
        courses.title as course_title,
        users.email as student_email,
        users.name as student_name
      from enrollments
      join users on users.id = enrollments.user_id
      join courses on courses.id = enrollments.course_id
      where enrollments.user_id = $1
        and enrollments.course_id = $2
        and enrollments.status = 'active'
      limit 1
    `,
    [userId, courseId]
  );
  return result.rows[0] ?? null;
};

interface PurchaseConfirmedDeliveryData {
  course_slug: string;
  course_title: string;
  email_verified: boolean;
  student_email: string;
  student_name: string;
}

const getPurchaseConfirmedDeliveryData = async ({
  orderId,
  userId,
}: {
  orderId: string;
  userId: string;
}): Promise<PurchaseConfirmedDeliveryData | null> => {
  const result = await getPool().query<PurchaseConfirmedDeliveryData>(
    `
      select
        orders.checkout_course_slug as course_slug,
        orders.checkout_item_name as course_title,
        users.email_verified,
        users.email as student_email,
        users.name as student_name
      from orders
      join users on users.id = orders.user_id
      where orders.id = $1
        and orders.user_id = $2
        and orders.provider = 'asaas'
        and orders.status = 'paid'
      limit 1
    `,
    [orderId, userId]
  );
  return result.rows[0] ?? null;
};

interface PurchaseVerificationChallengeDeliveryData {
  challenge_id: string;
  consumed_at: Date | null;
  expires_at: Date;
  generation: number;
  purpose: string;
  user_id: string;
}

const getPurchaseVerificationChallenge = async ({
  orderId,
  userId,
}: {
  orderId: string;
  userId: string;
}): Promise<PurchaseVerificationChallengeDeliveryData | null> => {
  const result =
    await getPool().query<PurchaseVerificationChallengeDeliveryData>(
      `
      select
        id as challenge_id,
        user_id,
        purpose,
        generation,
        expires_at,
        consumed_at
      from account_email_challenges
      where order_id = $1
        and user_id = $2
        and purpose = 'purchase_verification'
      limit 1
    `,
      [orderId, userId]
    );
  return result.rows[0] ?? null;
};

const deliverPurchaseConfirmed = async ({
  message,
  payload,
}: {
  message: ClaimedOutboxMessage;
  payload: OutboxPayload;
}): Promise<boolean> => {
  if (
    message.topic !== OUTBOX_TOPICS.purchaseConfirmed ||
    !("orderId" in payload && "userId" in payload)
  ) {
    return false;
  }
  if (message.aggregateId !== payload.orderId) {
    throw unavailableAggregate();
  }

  const data = await getPurchaseConfirmedDeliveryData(payload);
  if (!data) {
    throw unavailableAggregate();
  }

  const safePurchaseReturnTo = getSafeAuthReturnTo(
    `/comprar/${data.course_slug}`
  );
  if (!safePurchaseReturnTo) {
    throw unavailableAggregate();
  }

  let actionUrl: string;
  let actionLabel: "Acessar Curso" | "Confirmar e-mail";
  if (data.email_verified) {
    actionUrl = getApplicationUrl(safePurchaseReturnTo);
    actionLabel = "Acessar Curso";
  } else {
    const challenge = await getPurchaseVerificationChallenge(payload);
    if (
      challenge?.purpose !== "purchase_verification" ||
      challenge.user_id !== payload.userId ||
      challenge.consumed_at ||
      challenge.expires_at.getTime() <= Date.now()
    ) {
      throw new OutboxSupersededError(
        "purchase_verification_challenge_missing"
      );
    }

    const verificationUrl = new URL(getApplicationUrl("/confirmar-email"));
    verificationUrl.hash = new URLSearchParams({
      token: createEmailChallengeToken({
        challengeId: challenge.challenge_id,
        expiresAt: challenge.expires_at,
        generation: challenge.generation,
        purpose: "purchase_verification",
        secret: getServerEnv().BETTER_AUTH_SECRET,
      }),
    }).toString();
    actionUrl = verificationUrl.toString();
    actionLabel = "Confirmar e-mail";
  }

  try {
    await sendPurchaseConfirmedEmail({
      actionLabel,
      actionUrl,
      courseTitle: data.course_title,
      deliveryContext: createEmailDeliveryContext(message),
      idempotencyKey: message.idempotencyKey,
      to: data.student_email,
      userName: data.student_name,
    });
  } catch {
    throw deliveryFailure();
  }
  return true;
};

const deliverStaffInvitation = async ({
  message,
  payload,
}: {
  message: ClaimedOutboxMessage;
  payload: OutboxPayload;
}): Promise<boolean> => {
  if (
    message.topic !== OUTBOX_TOPICS.staffInvitation ||
    !("invitationId" in payload && "generation" in payload)
  ) {
    return false;
  }
  if (message.aggregateId !== payload.invitationId) {
    throw unavailableAggregate();
  }

  const invitation = await getStaffInvitationDeliveryData(payload);
  if (!invitation) {
    throw new OutboxSupersededError("staff_invitation_stale");
  }
  const invitationUrl = new URL(getApplicationUrl("/convites/equipe/aceitar"));
  invitationUrl.hash = new URLSearchParams({
    token: createStaffInvitationUrlToken({
      expiresAt: invitation.expiresAt,
      generation: invitation.generation,
      invitationId: payload.invitationId,
    }),
  }).toString();

  try {
    await sendStaffInvitationEmail({
      actionUrl: invitationUrl.toString(),
      deliveryContext: createEmailDeliveryContext(message),
      expiresAt: new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "long",
        timeZone: "America/Sao_Paulo",
      }).format(invitation.expiresAt),
      inviterName: invitation.inviterName,
      roleLabel: invitation.role === "admin" ? "Admin" : "Suporte",
      to: invitation.email,
    });
  } catch {
    throw staffInvitationFailure();
  }
  return true;
};

const deliverEmailChangeConfirmation = async ({
  message,
  payload,
}: {
  message: ClaimedOutboxMessage;
  payload: OutboxPayload;
}): Promise<boolean> => {
  if (
    message.topic !== OUTBOX_TOPICS.emailChangeConfirmation ||
    !("changeRequestId" in payload && "generation" in payload)
  ) {
    return false;
  }
  if (message.aggregateId !== payload.changeRequestId) {
    throw unavailableAggregate();
  }
  const request = await getEmailChangeConfirmationDeliveryData(payload);
  if (!request) {
    throw new OutboxSupersededError("email_change_request_stale");
  }

  const actionUrl = new URL(getApplicationUrl("/confirmar-troca-email"));
  actionUrl.hash = new URLSearchParams({
    token: createEmailChangeToken({
      changeRequestId: payload.changeRequestId,
      expiresAt: request.expiresAt,
      generation: request.generation,
    }),
  }).toString();
  try {
    await sendEmailChangeConfirmationEmail({
      actionUrl: actionUrl.toString(),
      currentEmail: request.currentEmail,
      deliveryContext: createEmailDeliveryContext(message),
      newEmail: request.newEmail,
      stepLabel:
        request.stage === "pending_current"
          ? "Confirmar e-mail atual"
          : "Confirmar novo e-mail",
      to: request.to,
      userName: request.userName,
    });
  } catch {
    throw deliveryFailure();
  }
  return true;
};

const deliverEmailChangeNotice = async ({
  message,
  payload,
}: {
  message: ClaimedOutboxMessage;
  payload: OutboxPayload;
}): Promise<boolean> => {
  if (
    message.topic !== OUTBOX_TOPICS.emailChangeNotice ||
    !("changeRequestId" in payload && "recipient" in payload)
  ) {
    return false;
  }
  if (message.aggregateId !== payload.changeRequestId) {
    throw unavailableAggregate();
  }
  const notice = await getEmailChangeNoticeDeliveryData(payload);
  if (!notice) {
    throw new OutboxSupersededError("email_change_request_stale");
  }
  const environment = getServerEnv();
  try {
    await sendEmailChangeNoticeEmail({
      changeDate: new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: "America/Sao_Paulo",
      }).format(notice.completedAt),
      currentEmail: notice.currentEmail,
      deliveryContext: createEmailDeliveryContext(message),
      newEmail: notice.newEmail,
      supportEmail: environment.SUPPORT_EMAIL ?? environment.RESEND_FROM_EMAIL,
      to: notice.to,
      userName: notice.userName,
    });
  } catch {
    throw deliveryFailure();
  }
  return true;
};

interface ExpiryWarningState {
  expires_at: Date;
  status: "active" | "expired" | "revoked";
}

const getExpiryWarningState = async (
  enrollmentId: string
): Promise<ExpiryWarningState | null> => {
  const result = await getPool().query<ExpiryWarningState>(
    `
      select status, expires_at
      from enrollments
      where id = $1
      limit 1
    `,
    [enrollmentId]
  );
  return result.rows[0] ?? null;
};

const getExpiryWarningDeliveryData = async (enrollmentId: string) => {
  const result = await getPool().query<{
    course_id: string;
    course_title: string;
    expires_at: Date;
    status: "active" | "expired" | "revoked";
    student_email: string;
    student_name: string;
  }>(
    `
      select
        courses.id as course_id,
        courses.title as course_title,
        enrollments.status,
        enrollments.expires_at,
        users.email as student_email,
        users.name as student_name
      from enrollments
      join users on users.id = enrollments.user_id
      join courses on courses.id = enrollments.course_id
      where enrollments.id = $1
      limit 1
    `,
    [enrollmentId]
  );
  return result.rows[0] ?? null;
};

const expirySupersededReason = (
  state: ReturnType<typeof classifyExpiryWarningGeneration>
):
  | "expiry_generation_changed"
  | "expiry_inactive"
  | "expiry_window_elapsed" => {
  if (state === "changed") {
    return "expiry_generation_changed";
  }
  if (state === "wrong_window") {
    return "expiry_window_elapsed";
  }
  return "expiry_inactive";
};

const assertCurrentExpiryWarning = ({
  expiresAt,
  expectedExpiresAt,
  status,
  warningKind,
}: {
  expiresAt: Date;
  expectedExpiresAt: string;
  status: "active" | "expired" | "revoked";
  warningKind: "1d" | "7d";
}): void => {
  const state = classifyExpiryWarningGeneration({
    currentExpiresAt: expiresAt,
    expectedExpiresAt,
    now: new Date(),
    status,
    warningKind,
  });
  if (state !== "current") {
    throw new OutboxSupersededError(expirySupersededReason(state));
  }
};

const getCourseSalesOpenedDeliveryData = async (interestId: string) => {
  const result = await getPool().query<{
    course_id: string;
    course_slug: string;
    course_title: string;
    sales_status: "closed" | "open";
    student_email: string;
    student_name: string;
  }>(
    `
      select
        courses.id as course_id,
        courses.slug as course_slug,
        courses.title as course_title,
        courses.sales_status,
        users.email as student_email,
        users.name as student_name
      from course_sale_interests
      join courses on courses.id = course_sale_interests.course_id
      join users on users.id = course_sale_interests.user_id
      where course_sale_interests.id = $1
        and course_sale_interests.notification_enqueued_at is not null
      limit 1
    `,
    [interestId]
  );
  return result.rows[0] ?? null;
};

const consumeDeliveredCourseSaleInterest = async ({
  courseId,
  interestId,
}: {
  courseId: string;
  interestId: string;
}): Promise<void> => {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const deleted = await client.query<{ id: string }>(
      `
        delete from course_sale_interests
        where id = $1 and notification_enqueued_at is not null
        returning id
      `,
      [interestId]
    );
    if (deleted.rows[0]) {
      await client.query(
        `
          update courses
          set interest_notifications_sent = interest_notifications_sent + 1,
              updated_at = now()
          where id = $1
        `,
        [courseId]
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

const deliverCourseSalesOpened = async ({
  message,
  payload,
}: {
  message: ClaimedOutboxMessage;
  payload: OutboxPayload;
}): Promise<boolean> => {
  if (
    message.topic !== OUTBOX_TOPICS.courseSalesOpened ||
    !("interestId" in payload)
  ) {
    return false;
  }
  if (message.aggregateId !== payload.interestId) {
    throw unavailableAggregate();
  }
  const data = await getCourseSalesOpenedDeliveryData(payload.interestId);
  if (!data) {
    return true;
  }
  if (data.sales_status !== "open") {
    throw courseSalesClosed();
  }
  await sendCourseSalesOpenedEmail({
    courseSlug: data.course_slug,
    courseTitle: data.course_title,
    deliveryContext: createEmailDeliveryContext(message),
    idempotencyKey: message.idempotencyKey,
    to: data.student_email,
    userName: data.student_name,
  });
  await consumeDeliveredCourseSaleInterest({
    courseId: data.course_id,
    interestId: payload.interestId,
  });
  return true;
};

const deliverCheckoutCancellation = async ({
  message,
  payload,
}: {
  message: ClaimedOutboxMessage;
  payload: OutboxPayload;
}): Promise<boolean> => {
  if (
    message.topic !== OUTBOX_TOPICS.checkoutCancellation ||
    !("orderId" in payload) ||
    "userId" in payload
  ) {
    return false;
  }
  if (message.aggregateId !== payload.orderId) {
    throw unavailableAggregate();
  }
  const result = await getPool().query<{
    checkout_status: string;
    order_status: string;
    provider_checkout_id: string | null;
  }>(
    `
      select
        status as order_status,
        checkout_status,
        provider_checkout_id
      from orders
      where id = $1 and provider = 'asaas'
      limit 1
    `,
    [payload.orderId]
  );
  const order = result.rows[0];
  if (
    order?.order_status !== "pending" ||
    order.checkout_status !== "active" ||
    !order.provider_checkout_id
  ) {
    return true;
  }
  const checkout = await getAsaasProviderClient().cancelCheckout(
    order.provider_checkout_id
  );
  if (checkout.status !== "CANCELED" && checkout.status !== "EXPIRED") {
    throw checkoutCancellationFailure();
  }
  await getPool().query(
    `
      update orders
      set checkout_status = case
            when $2 = 'CANCELED' then 'cancelled'::checkout_status
            else 'expired'::checkout_status
          end,
          provider_checkout_status = $2,
          updated_at = now()
      where id = $1
        and status = 'pending'
        and checkout_status = 'active'
    `,
    [payload.orderId, checkout.status]
  );
  return true;
};

interface SupportRequestDeliveryData {
  course_title: string | null;
  message: string;
  student_email: string;
  student_name: string;
  subject: string;
}

const parseSupportRequestDeliveryData = (
  row: unknown
): SupportRequestDeliveryData | null => {
  if (!row || typeof row !== "object") {
    return null;
  }
  const courseTitle = Reflect.get(row, "course_title");
  const message = Reflect.get(row, "message");
  const studentEmail = Reflect.get(row, "student_email");
  const studentName = Reflect.get(row, "student_name");
  const subject = Reflect.get(row, "subject");
  if (
    typeof message !== "string" ||
    !message ||
    typeof studentEmail !== "string" ||
    !studentEmail ||
    typeof studentName !== "string" ||
    !studentName ||
    typeof subject !== "string" ||
    !subject ||
    (courseTitle !== null && typeof courseTitle !== "string")
  ) {
    return null;
  }
  return {
    course_title: courseTitle,
    message,
    student_email: studentEmail,
    student_name: studentName,
    subject,
  };
};

const getSupportRequestDeliveryData = async (
  requestId: string
): Promise<SupportRequestDeliveryData | null> => {
  const result = await getPool().query(
    `
      select
        support_requests.subject,
        support_requests.message,
        support_requests.course_title,
        users.email as student_email,
        users.name as student_name
      from support_requests
      join users on users.id = support_requests.user_id
      where support_requests.id = $1
      limit 1
    `,
    [requestId]
  );
  return parseSupportRequestDeliveryData(result.rows[0]);
};

const deliverSupportRequest = async ({
  message,
  payload,
}: {
  message: ClaimedOutboxMessage;
  payload: OutboxPayload;
}): Promise<boolean> => {
  if (
    message.topic !== OUTBOX_TOPICS.supportRequest ||
    !("requestId" in payload)
  ) {
    return false;
  }
  if (message.aggregateId !== payload.requestId) {
    throw unavailableAggregate();
  }
  const data = await getSupportRequestDeliveryData(payload.requestId);
  if (!data) {
    throw unavailableSupportRequest();
  }
  await sendSupportRequestEmail({
    ...(data.course_title ? { courseTitle: data.course_title } : {}),
    deliveryContext: createEmailDeliveryContext(message),
    idempotencyKey: message.idempotencyKey,
    message: data.message,
    studentEmail: data.student_email,
    studentName: data.student_name,
    subject: data.subject,
  });
  return true;
};

const deliverCertificateRender = async (
  certificateId: string
): Promise<void> => {
  const isReady = await renderPendingCertificate(certificateId);
  if (!isReady) {
    throw unavailableAggregate();
  }
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await enqueueOutboxMessage({
      client,
      message: createCertificateIssuedMessage({ certificateId }),
    });
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

const parseClaimedOutboxPayload = (
  message: ClaimedOutboxMessage
): OutboxPayload => {
  try {
    return parseOutboxPayload(message);
  } catch {
    throw new OutboxDeliveryError("unknown_payload_version", {
      retryable: false,
    });
  }
};

export const deliverOutboxMessage = async (
  message: ClaimedOutboxMessage
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: one explicit dispatcher keeps every outbox topic and error class visible in a single audited seam.
): Promise<void> => {
  const payload = parseClaimedOutboxPayload(message);

  try {
    if (await deliverPurchaseConfirmed({ message, payload })) {
      return;
    }

    if (await deliverEmailVerification({ message, payload })) {
      return;
    }

    if (await deliverStaffInvitation({ message, payload })) {
      return;
    }

    if (await deliverEmailChangeConfirmation({ message, payload })) {
      return;
    }

    if (await deliverEmailChangeNotice({ message, payload })) {
      return;
    }

    if (await deliverAccountActivation({ message, payload })) {
      return;
    }

    if (await deliverCourseSalesOpened({ message, payload })) {
      return;
    }

    if (await deliverCheckoutCancellation({ message, payload })) {
      return;
    }

    if (await deliverSupportRequest({ message, payload })) {
      return;
    }

    if (
      message.topic === OUTBOX_TOPICS.certificateRender &&
      "certificateId" in payload
    ) {
      await deliverCertificateRender(payload.certificateId);
      return;
    }

    if (
      message.topic === OUTBOX_TOPICS.certificateIssued &&
      "certificateId" in payload
    ) {
      const data = await getCertificateDeliveryData(payload.certificateId);
      if (!data) {
        throw unavailableAggregate();
      }
      await sendCertificateIssuedEmail({
        certificateCode: data.certificate_code,
        courseTitle: data.course_title,
        deliveryContext: createEmailDeliveryContext(message),
        idempotencyKey: message.idempotencyKey,
        to: data.student_email,
        userName: data.student_name,
      });
      return;
    }

    if (
      message.topic === OUTBOX_TOPICS.accessReleased &&
      "courseId" in payload &&
      "userId" in payload
    ) {
      const data = await getAccessReleasedDeliveryData(payload);
      if (!data) {
        throw unavailableAggregate();
      }
      await sendAccessReleasedEmail({
        courseId: payload.courseId,
        courseTitle: data.course_title,
        deliveryContext: createEmailDeliveryContext(message),
        idempotencyKey: message.idempotencyKey,
        to: data.student_email,
        userName: data.student_name,
      });
      return;
    }

    if (
      message.topic === OUTBOX_TOPICS.accessExpiryWarning &&
      "enrollmentId" in payload &&
      "warningKind" in payload
    ) {
      if (!("expectedExpiresAt" in payload)) {
        throw new OutboxSupersededError("expiry_payload_v1");
      }
      const state = await getExpiryWarningState(payload.enrollmentId);
      if (!state) {
        throw new OutboxSupersededError("expiry_inactive");
      }
      assertCurrentExpiryWarning({
        expiresAt: state.expires_at,
        expectedExpiresAt: payload.expectedExpiresAt,
        status: state.status,
        warningKind: payload.warningKind,
      });
      const data = await getExpiryWarningDeliveryData(payload.enrollmentId);
      if (!data) {
        throw new OutboxSupersededError("expiry_inactive");
      }
      assertCurrentExpiryWarning({
        expiresAt: data.expires_at,
        expectedExpiresAt: payload.expectedExpiresAt,
        status: data.status,
        warningKind: payload.warningKind,
      });
      await sendAccessExpiryWarningEmail({
        courseId: data.course_id,
        courseTitle: data.course_title,
        daysRemaining: payload.warningKind === "1d" ? 1 : 7,
        deliveryContext: createEmailDeliveryContext(message),
        idempotencyKey: message.idempotencyKey,
        to: data.student_email,
        userName: data.student_name,
      });
      return;
    }
  } catch (error) {
    if (
      error instanceof OutboxDeliveryError ||
      error instanceof OutboxSupersededError
    ) {
      throw error;
    }
    throw unexpectedDeliveryFailure(message.topic);
  }

  throw new OutboxDeliveryError("unknown_payload_version", {
    retryable: false,
  });
};
