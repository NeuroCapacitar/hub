import { createHmac, timingSafeEqual } from "node:crypto";

export const EMAIL_CHALLENGE_PURPOSES = [
  "change_email",
  "purchase_verification",
  "signup",
  "staff_invitation",
  "verify_email",
] as const;

export type EmailChallengePurpose = (typeof EMAIL_CHALLENGE_PURPOSES)[number];

export interface EmailChallengeClaims {
  challengeId: string;
  expiresAt: Date;
  generation: number;
  purpose: EmailChallengePurpose;
  returnToCourseSlug?: string;
}

interface CreateEmailChallengeTokenInput extends EmailChallengeClaims {
  secret: string;
}

interface VerifyEmailChallengeTokenInput {
  now?: Date;
  purpose: EmailChallengePurpose;
  secret: string;
  token: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COURSE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SIGNATURE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const TOKEN_VERSION = "ec1";
const TOKEN_VERSION_WITH_RETURN = "ec2";
const SIGNATURE_DOMAIN = "hub:account-email-challenge:v1\0";
const SIGNATURE_DOMAIN_WITH_RETURN = "hub:account-email-challenge:v2\0";

const isEmailChallengePurpose = (
  value: string
): value is EmailChallengePurpose =>
  EMAIL_CHALLENGE_PURPOSES.some((purpose) => purpose === value);

const assertChallengeClaims = ({
  challengeId,
  expiresAt,
  generation,
  purpose,
  returnToCourseSlug,
  secret,
}: CreateEmailChallengeTokenInput): number => {
  if (!UUID_PATTERN.test(challengeId)) {
    throw new Error("Email challenge id must be a UUID.");
  }
  if (!Number.isSafeInteger(generation) || generation < 1) {
    throw new Error("Email challenge generation must be a positive integer.");
  }
  if (!Number.isFinite(expiresAt.getTime())) {
    throw new Error("Email challenge expiration must be a valid date.");
  }
  if (!isEmailChallengePurpose(purpose)) {
    throw new Error("Email challenge purpose is invalid.");
  }
  if (
    returnToCourseSlug !== undefined &&
    (purpose !== "verify_email" ||
      returnToCourseSlug.length > 247 ||
      !COURSE_SLUG_PATTERN.test(returnToCourseSlug))
  ) {
    throw new Error("Email challenge return course is invalid.");
  }
  if (!secret) {
    throw new Error("Email challenge signing secret is required.");
  }

  return Math.trunc(expiresAt.getTime());
};

const createSignature = (
  payload: string,
  secret: string,
  signatureDomain: string
): Buffer =>
  createHmac("sha256", secret).update(signatureDomain).update(payload).digest();

export const createEmailChallengeToken = (
  input: CreateEmailChallengeTokenInput
): string => {
  const expiresAtMs = assertChallengeClaims(input);
  const payloadParts = [
    input.challengeId,
    String(input.generation),
    String(expiresAtMs),
    input.purpose,
  ];
  if (input.returnToCourseSlug !== undefined) {
    payloadParts.push(input.returnToCourseSlug);
  }
  const payload = payloadParts.join(".");
  const tokenVersion = input.returnToCourseSlug
    ? TOKEN_VERSION_WITH_RETURN
    : TOKEN_VERSION;
  const signatureDomain = input.returnToCourseSlug
    ? SIGNATURE_DOMAIN_WITH_RETURN
    : SIGNATURE_DOMAIN;
  const signature = createSignature(
    payload,
    input.secret,
    signatureDomain
  ).toString("base64url");

  return [tokenVersion, payload, signature].join(".");
};

export const verifyEmailChallengeToken = ({
  now = new Date(),
  purpose: expectedPurpose,
  secret,
  token,
}: VerifyEmailChallengeTokenInput): EmailChallengeClaims | null => {
  if (!secret || token.length > 512 || !Number.isFinite(now.getTime())) {
    return null;
  }

  const [
    version,
    challengeId,
    generationValue,
    expiresAtValue,
    purpose,
    contextOrSignature,
    contextSignature,
    ...rest
  ] = token.split(".");
  const hasReturnContext = version === TOKEN_VERSION_WITH_RETURN;
  const returnToCourseSlug = hasReturnContext ? contextOrSignature : undefined;
  const signature = hasReturnContext ? contextSignature : contextOrSignature;
  const signatureDomain = hasReturnContext
    ? SIGNATURE_DOMAIN_WITH_RETURN
    : SIGNATURE_DOMAIN;
  if (
    (version !== TOKEN_VERSION && !hasReturnContext) ||
    (hasReturnContext && token.split(".").length !== 7) ||
    (!hasReturnContext && token.split(".").length !== 6) ||
    rest.length > 0 ||
    !challengeId ||
    !UUID_PATTERN.test(challengeId) ||
    !generationValue ||
    !expiresAtValue ||
    !purpose ||
    !signature ||
    !SIGNATURE_PATTERN.test(signature) ||
    !isEmailChallengePurpose(purpose) ||
    purpose !== expectedPurpose ||
    (hasReturnContext &&
      (purpose !== "verify_email" ||
        !returnToCourseSlug ||
        returnToCourseSlug.length > 247 ||
        !COURSE_SLUG_PATTERN.test(returnToCourseSlug)))
  ) {
    return null;
  }

  const generation = Number(generationValue);
  const expiresAtMs = Number(expiresAtValue);
  if (
    !Number.isSafeInteger(generation) ||
    generation < 1 ||
    !Number.isSafeInteger(expiresAtMs) ||
    expiresAtMs <= now.getTime()
  ) {
    return null;
  }

  const payloadParts = [challengeId, generationValue, expiresAtValue, purpose];
  if (returnToCourseSlug) {
    payloadParts.push(returnToCourseSlug);
  }
  const payload = payloadParts.join(".");
  const expectedSignature = createSignature(payload, secret, signatureDomain);
  const suppliedSignature = Buffer.from(signature, "base64url");
  if (
    suppliedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(suppliedSignature, expectedSignature)
  ) {
    return null;
  }

  return {
    challengeId,
    expiresAt: new Date(expiresAtMs),
    generation,
    purpose,
    ...(returnToCourseSlug ? { returnToCourseSlug } : {}),
  };
};
