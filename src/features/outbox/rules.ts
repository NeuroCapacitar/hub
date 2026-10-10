export const OUTBOX_TOPICS = {
  accountActivation: "auth.account-activation",
  emailVerification: "auth.email-verification",
  accessExpiryWarning: "email.access-expiry-warning",
  accessReleased: "email.access-released",
  emailChangeConfirmation: "auth.email-change-confirmation",
  emailChangeNotice: "email.email-change-notice",
  certificateIssued: "email.certificate-issued",
  certificateRender: "certificate.render",
  checkoutCancellation: "payments.checkout-cancel",
  courseSalesOpened: "email.course-sales-opened",
  purchaseConfirmed: "email.purchase-confirmed",
  staffInvitation: "auth.staff-invitation",
  supportRequest: "email.support-request",
} as const;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COURSE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type OutboxTopic = (typeof OUTBOX_TOPICS)[keyof typeof OUTBOX_TOPICS];

type OutboxPayloadV1 =
  | { changeRequestId: string; generation: number }
  | { changeRequestId: string; recipient: "current" | "new" }
  | { certificateId: string }
  | { challengeId: string; generation: number }
  | { courseId: string; userId: string }
  | { enrollmentId: string; warningKind: "1d" | "7d" }
  | { interestId: string }
  | { invitationId: string; generation: number }
  | { orderId: string }
  | { orderId: string; userId: string }
  | { requestId: string };

export interface ExpiryWarningPayloadV2 {
  enrollmentId: string;
  expectedExpiresAt: string;
  warningKind: "1d" | "7d";
}

export interface EmailVerificationPayloadV2 {
  challengeId: string;
  generation: number;
  returnToCourseSlug: string;
}

export type OutboxPayload =
  | OutboxPayloadV1
  | EmailVerificationPayloadV2
  | ExpiryWarningPayloadV2;

interface OutboxMessageBase {
  aggregateId: string;
  aggregateType:
    | "certificate"
    | "account_email_challenge"
    | "account_email_change"
    | "course_interest"
    | "enrollment"
    | "order"
    | "staff_invitation"
    | "support_request";
  idempotencyKey: string;
}

interface OutboxMessageInputV1 extends OutboxMessageBase {
  payload: OutboxPayloadV1;
  payloadVersion: 1;
  topic: OutboxTopic;
}

interface ExpiryWarningMessageInputV2 extends OutboxMessageBase {
  aggregateType: "enrollment";
  payload: ExpiryWarningPayloadV2;
  payloadVersion: 2;
  topic: typeof OUTBOX_TOPICS.accessExpiryWarning;
}

interface EmailVerificationMessageInputV2 extends OutboxMessageBase {
  aggregateType: "account_email_challenge";
  payload: EmailVerificationPayloadV2;
  payloadVersion: 2;
  topic: typeof OUTBOX_TOPICS.emailVerification;
}

export type OutboxMessageInput =
  | EmailVerificationMessageInputV2
  | ExpiryWarningMessageInputV2
  | OutboxMessageInputV1;

const RETRY_BASE_DELAY_MS = 60_000;
const RETRY_MAX_JITTER_RATIO = 0.125;

const unsupportedPayloadVersion = (): Error =>
  new Error("Versao de payload nao suportada.");

const parseAccountActivationPayload = (
  payload: object
): { orderId: string; userId: string } | null => {
  const { orderId, userId } = payload as {
    orderId?: unknown;
    userId?: unknown;
  };
  if (
    Object.keys(payload).length !== 2 ||
    typeof orderId !== "string" ||
    !orderId ||
    typeof userId !== "string" ||
    !userId
  ) {
    return null;
  }
  return { orderId, userId };
};

export const createCertificateIssuedMessage = ({
  certificateId,
}: {
  certificateId: string;
}): OutboxMessageInput => ({
  aggregateId: certificateId,
  aggregateType: "certificate",
  idempotencyKey: `${OUTBOX_TOPICS.certificateIssued}/${certificateId}/v1`,
  payload: { certificateId },
  payloadVersion: 1,
  topic: OUTBOX_TOPICS.certificateIssued,
});

export const createAccountActivationMessage = ({
  orderId,
  userId,
}: {
  orderId: string;
  userId: string;
}): OutboxMessageInput => ({
  aggregateId: orderId,
  aggregateType: "order",
  idempotencyKey: `${OUTBOX_TOPICS.accountActivation}/${orderId}/v1`,
  payload: { orderId, userId },
  payloadVersion: 1,
  topic: OUTBOX_TOPICS.accountActivation,
});

export const createEmailVerificationMessage = ({
  challengeId,
  generation,
  returnToCourseSlug,
}: {
  challengeId: string;
  generation: number;
  returnToCourseSlug?: string | null;
}): OutboxMessageInput => {
  if (!Number.isSafeInteger(generation) || generation < 1) {
    throw new Error("Email challenge generation must be a positive integer.");
  }

  const hasCourseReturn =
    returnToCourseSlug !== undefined && returnToCourseSlug !== null;
  if (
    hasCourseReturn &&
    (returnToCourseSlug.length > 247 ||
      !COURSE_SLUG_PATTERN.test(returnToCourseSlug))
  ) {
    throw new Error("Email challenge course return is invalid.");
  }

  if (hasCourseReturn) {
    return {
      aggregateId: challengeId,
      aggregateType: "account_email_challenge",
      idempotencyKey: `${OUTBOX_TOPICS.emailVerification}/${challengeId}/${generation}/v2`,
      payload: { challengeId, generation, returnToCourseSlug },
      payloadVersion: 2,
      topic: OUTBOX_TOPICS.emailVerification,
    };
  }

  return {
    aggregateId: challengeId,
    aggregateType: "account_email_challenge",
    idempotencyKey: `${OUTBOX_TOPICS.emailVerification}/${challengeId}/${generation}/v1`,
    payload: { challengeId, generation },
    payloadVersion: 1,
    topic: OUTBOX_TOPICS.emailVerification,
  };
};

export const createStaffInvitationMessage = ({
  generation,
  invitationId,
}: {
  generation: number;
  invitationId: string;
}): OutboxMessageInput => {
  if (!UUID_PATTERN.test(invitationId)) {
    throw new Error("Staff invitation id must be a UUID.");
  }
  if (!Number.isSafeInteger(generation) || generation < 1) {
    throw new Error("Staff invitation generation must be a positive integer.");
  }

  return {
    aggregateId: invitationId,
    aggregateType: "staff_invitation",
    idempotencyKey: `${OUTBOX_TOPICS.staffInvitation}/${invitationId}/${generation}/v1`,
    payload: { invitationId, generation },
    payloadVersion: 1,
    topic: OUTBOX_TOPICS.staffInvitation,
  };
};

export const createEmailChangeConfirmationMessage = ({
  changeRequestId,
  generation,
}: {
  changeRequestId: string;
  generation: number;
}): OutboxMessageInput => {
  if (!UUID_PATTERN.test(changeRequestId)) {
    throw new Error("Email change request id must be a UUID.");
  }
  if (!Number.isSafeInteger(generation) || generation < 1) {
    throw new Error("Email change generation must be a positive integer.");
  }
  return {
    aggregateId: changeRequestId,
    aggregateType: "account_email_change",
    idempotencyKey: `${OUTBOX_TOPICS.emailChangeConfirmation}/${changeRequestId}/${generation}/v1`,
    payload: { changeRequestId, generation },
    payloadVersion: 1,
    topic: OUTBOX_TOPICS.emailChangeConfirmation,
  };
};

export const createEmailChangeNoticeMessage = ({
  changeRequestId,
  recipient,
}: {
  changeRequestId: string;
  recipient: "current" | "new";
}): OutboxMessageInput => {
  if (!UUID_PATTERN.test(changeRequestId)) {
    throw new Error("Email change request id must be a UUID.");
  }
  return {
    aggregateId: changeRequestId,
    aggregateType: "account_email_change",
    idempotencyKey: `${OUTBOX_TOPICS.emailChangeNotice}/${changeRequestId}/${recipient}/v1`,
    payload: { changeRequestId, recipient },
    payloadVersion: 1,
    topic: OUTBOX_TOPICS.emailChangeNotice,
  };
};

export const createCertificateRenderMessage = ({
  certificateId,
}: {
  certificateId: string;
}): OutboxMessageInput => ({
  aggregateId: certificateId,
  aggregateType: "certificate",
  idempotencyKey: `${OUTBOX_TOPICS.certificateRender}/${certificateId}/v1`,
  payload: { certificateId },
  payloadVersion: 1,
  topic: OUTBOX_TOPICS.certificateRender,
});

export const createPaidAccessReleasedMessage = ({
  courseId,
  orderId,
  userId,
}: {
  courseId: string;
  orderId: string;
  userId: string;
}): OutboxMessageInput => ({
  aggregateId: orderId,
  aggregateType: "order",
  idempotencyKey: `${OUTBOX_TOPICS.accessReleased}/${orderId}/v1`,
  payload: { courseId, userId },
  payloadVersion: 1,
  topic: OUTBOX_TOPICS.accessReleased,
});

export const createPurchaseConfirmedMessage = ({
  orderId,
  userId,
}: {
  orderId: string;
  userId: string;
}): OutboxMessageInput => ({
  aggregateId: orderId,
  aggregateType: "order",
  idempotencyKey: `${OUTBOX_TOPICS.purchaseConfirmed}/${orderId}/v1`,
  payload: { orderId, userId },
  payloadVersion: 1,
  topic: OUTBOX_TOPICS.purchaseConfirmed,
});

export const createEnrollmentExpiryWarningMessage = ({
  enrollmentId,
  expectedExpiresAt,
  warningKind,
}: {
  enrollmentId: string;
  expectedExpiresAt: Date;
  warningKind: "1d" | "7d";
}): OutboxMessageInput => {
  if (Number.isNaN(expectedExpiresAt.getTime())) {
    throw new Error("Validade esperada invalida.");
  }
  const expectedExpiresAtIso = expectedExpiresAt.toISOString();
  return {
    aggregateId: enrollmentId,
    aggregateType: "enrollment",
    idempotencyKey: `${OUTBOX_TOPICS.accessExpiryWarning}/${enrollmentId}/${warningKind}/${expectedExpiresAt.getTime()}/v2`,
    payload: {
      enrollmentId,
      expectedExpiresAt: expectedExpiresAtIso,
      warningKind,
    },
    payloadVersion: 2,
    topic: OUTBOX_TOPICS.accessExpiryWarning,
  };
};

export const createCourseSalesOpenedMessage = ({
  interestId,
}: {
  interestId: string;
}): OutboxMessageInput => ({
  aggregateId: interestId,
  aggregateType: "course_interest",
  idempotencyKey: `${OUTBOX_TOPICS.courseSalesOpened}/${interestId}/v1`,
  payload: { interestId },
  payloadVersion: 1,
  topic: OUTBOX_TOPICS.courseSalesOpened,
});

export const createCheckoutCancellationMessage = ({
  orderId,
}: {
  orderId: string;
}): OutboxMessageInput => ({
  aggregateId: orderId,
  aggregateType: "order",
  idempotencyKey: `${OUTBOX_TOPICS.checkoutCancellation}/${orderId}/v1`,
  payload: { orderId },
  payloadVersion: 1,
  topic: OUTBOX_TOPICS.checkoutCancellation,
});

export const createSupportRequestMessage = ({
  requestId,
}: {
  requestId: string;
}): OutboxMessageInput => ({
  aggregateId: requestId,
  aggregateType: "support_request",
  idempotencyKey: `${OUTBOX_TOPICS.supportRequest}/${requestId}/v1`,
  payload: { requestId },
  payloadVersion: 1,
  topic: OUTBOX_TOPICS.supportRequest,
});

export const parseOutboxPayload = ({
  idempotencyKey,
  payload,
  payloadVersion,
  topic,
}: {
  idempotencyKey?: string;
  payload: unknown;
  payloadVersion: number;
  topic: string;
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: validates a closed discriminated union without accepting extra fields.
}): OutboxPayload => {
  if (!(payload && typeof payload === "object")) {
    throw unsupportedPayloadVersion();
  }

  if (topic === OUTBOX_TOPICS.accessExpiryWarning) {
    const { enrollmentId, expectedExpiresAt, warningKind } = payload as {
      enrollmentId?: unknown;
      expectedExpiresAt?: unknown;
      warningKind?: unknown;
    };
    const validIdentity =
      typeof enrollmentId === "string" &&
      Boolean(enrollmentId) &&
      (warningKind === "1d" || warningKind === "7d");
    if (
      payloadVersion === 1 &&
      Object.keys(payload).length === 2 &&
      validIdentity
    ) {
      return { enrollmentId, warningKind } as {
        enrollmentId: string;
        warningKind: "1d" | "7d";
      };
    }
    if (
      payloadVersion === 2 &&
      Object.keys(payload).length === 3 &&
      validIdentity &&
      typeof expectedExpiresAt === "string" &&
      idempotencyKey
    ) {
      const parsedDate = new Date(expectedExpiresAt);
      if (
        !Number.isNaN(parsedDate.getTime()) &&
        parsedDate.toISOString() === expectedExpiresAt &&
        idempotencyKey ===
          `${OUTBOX_TOPICS.accessExpiryWarning}/${enrollmentId}/${warningKind}/${parsedDate.getTime()}/v2`
      ) {
        return {
          enrollmentId,
          expectedExpiresAt,
          warningKind,
        } as ExpiryWarningPayloadV2;
      }
    }
    throw unsupportedPayloadVersion();
  }

  if (topic === OUTBOX_TOPICS.emailVerification && payloadVersion === 2) {
    const { challengeId, generation, returnToCourseSlug } = payload as {
      challengeId?: unknown;
      generation?: unknown;
      returnToCourseSlug?: unknown;
    };
    if (
      Object.keys(payload).length === 3 &&
      typeof challengeId === "string" &&
      UUID_PATTERN.test(challengeId) &&
      Number.isSafeInteger(generation) &&
      Number(generation) > 0 &&
      typeof returnToCourseSlug === "string" &&
      returnToCourseSlug.length <= 247 &&
      COURSE_SLUG_PATTERN.test(returnToCourseSlug) &&
      idempotencyKey ===
        `${OUTBOX_TOPICS.emailVerification}/${challengeId}/${Number(generation)}/v2`
    ) {
      return {
        challengeId,
        generation: Number(generation),
        returnToCourseSlug,
      };
    }
    throw unsupportedPayloadVersion();
  }

  if (payloadVersion !== 1) {
    throw unsupportedPayloadVersion();
  }

  if (
    topic === OUTBOX_TOPICS.certificateIssued ||
    topic === OUTBOX_TOPICS.certificateRender
  ) {
    const certificateId = (payload as { certificateId?: unknown })
      .certificateId;
    if (typeof certificateId === "string" && certificateId) {
      return { certificateId };
    }
  }

  if (topic === OUTBOX_TOPICS.accountActivation) {
    const activationPayload = parseAccountActivationPayload(payload);
    if (activationPayload) {
      return activationPayload;
    }
  }

  if (topic === OUTBOX_TOPICS.purchaseConfirmed) {
    const { orderId, userId } = payload as {
      orderId?: unknown;
      userId?: unknown;
    };
    if (
      Object.keys(payload).length === 2 &&
      typeof orderId === "string" &&
      orderId &&
      typeof userId === "string" &&
      userId &&
      idempotencyKey === `${OUTBOX_TOPICS.purchaseConfirmed}/${orderId}/v1`
    ) {
      return { orderId, userId };
    }
  }

  if (topic === OUTBOX_TOPICS.emailVerification) {
    const { challengeId, generation } = payload as {
      challengeId?: unknown;
      generation?: unknown;
    };
    if (
      Object.keys(payload).length === 2 &&
      typeof challengeId === "string" &&
      UUID_PATTERN.test(challengeId) &&
      Number.isSafeInteger(generation) &&
      Number(generation) > 0 &&
      idempotencyKey ===
        `${OUTBOX_TOPICS.emailVerification}/${challengeId}/${generation}/v1`
    ) {
      return { challengeId, generation: Number(generation) };
    }
  }

  if (topic === OUTBOX_TOPICS.staffInvitation) {
    const { invitationId, generation } = payload as {
      generation?: unknown;
      invitationId?: unknown;
    };
    if (
      Object.keys(payload).length === 2 &&
      typeof invitationId === "string" &&
      UUID_PATTERN.test(invitationId) &&
      Number.isSafeInteger(generation) &&
      Number(generation) > 0 &&
      idempotencyKey ===
        `${OUTBOX_TOPICS.staffInvitation}/${invitationId}/${generation}/v1`
    ) {
      return { generation: Number(generation), invitationId };
    }
  }

  if (topic === OUTBOX_TOPICS.emailChangeConfirmation) {
    const { changeRequestId, generation } = payload as {
      changeRequestId?: unknown;
      generation?: unknown;
    };
    if (
      Object.keys(payload).length === 2 &&
      typeof changeRequestId === "string" &&
      UUID_PATTERN.test(changeRequestId) &&
      Number.isSafeInteger(generation) &&
      Number(generation) > 0 &&
      idempotencyKey ===
        `${OUTBOX_TOPICS.emailChangeConfirmation}/${changeRequestId}/${generation}/v1`
    ) {
      return { changeRequestId, generation: Number(generation) };
    }
  }

  if (topic === OUTBOX_TOPICS.emailChangeNotice) {
    const { changeRequestId, recipient } = payload as {
      changeRequestId?: unknown;
      recipient?: unknown;
    };
    if (
      Object.keys(payload).length === 2 &&
      typeof changeRequestId === "string" &&
      UUID_PATTERN.test(changeRequestId) &&
      (recipient === "current" || recipient === "new") &&
      idempotencyKey ===
        `${OUTBOX_TOPICS.emailChangeNotice}/${changeRequestId}/${recipient}/v1`
    ) {
      return { changeRequestId, recipient };
    }
  }

  if (topic === OUTBOX_TOPICS.accessReleased) {
    const { courseId, userId } = payload as {
      courseId?: unknown;
      userId?: unknown;
    };
    if (
      typeof courseId === "string" &&
      courseId &&
      typeof userId === "string" &&
      userId
    ) {
      return { courseId, userId };
    }
  }

  if (topic === OUTBOX_TOPICS.courseSalesOpened) {
    const { interestId } = payload as { interestId?: unknown };
    if (
      Object.keys(payload).length === 1 &&
      typeof interestId === "string" &&
      interestId
    ) {
      return { interestId };
    }
  }

  if (topic === OUTBOX_TOPICS.checkoutCancellation) {
    const { orderId } = payload as { orderId?: unknown };
    if (
      Object.keys(payload).length === 1 &&
      typeof orderId === "string" &&
      orderId
    ) {
      return { orderId };
    }
  }

  if (topic === OUTBOX_TOPICS.supportRequest) {
    const { requestId } = payload as { requestId?: unknown };
    if (
      Object.keys(payload).length === 1 &&
      typeof requestId === "string" &&
      requestId
    ) {
      return { requestId };
    }
  }

  throw unsupportedPayloadVersion();
};

const MILLISECONDS_PER_DAY = 86_400_000;

export type ExpiryWarningGenerationState =
  | "changed"
  | "current"
  | "expired"
  | "inactive"
  | "wrong_window";

export const classifyExpiryWarningGeneration = ({
  currentExpiresAt,
  expectedExpiresAt,
  now,
  status,
  warningKind,
}: {
  currentExpiresAt: Date;
  expectedExpiresAt: string;
  now: Date;
  status: "active" | "expired" | "revoked";
  warningKind: "1d" | "7d";
}): ExpiryWarningGenerationState => {
  if (status !== "active") {
    return "inactive";
  }
  if (currentExpiresAt.getTime() <= now.getTime()) {
    return "expired";
  }
  if (currentExpiresAt.toISOString() !== expectedExpiresAt) {
    return "changed";
  }
  const daysRemaining = Math.ceil(
    (currentExpiresAt.getTime() - now.getTime()) / MILLISECONDS_PER_DAY
  );
  const isCurrentWindow =
    warningKind === "7d"
      ? daysRemaining >= 2 && daysRemaining <= 7
      : daysRemaining >= 0 && daysRemaining <= 1;
  return isCurrentWindow ? "current" : "wrong_window";
};

export const getRetryDelayMs = ({
  attempt,
  random = Math.random,
}: {
  attempt: number;
  random?: () => number;
}): number => {
  const exponentialDelay = RETRY_BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1);
  const jitter = Math.round(
    exponentialDelay * RETRY_MAX_JITTER_RATIO * random()
  );
  return exponentialDelay + jitter;
};
