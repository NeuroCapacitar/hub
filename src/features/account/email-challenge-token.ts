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
const SIGNATURE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const TOKEN_VERSION = "ec1";
const SIGNATURE_DOMAIN = "hub:account-email-challenge:v1\0";

const isEmailChallengePurpose = (
  value: string
): value is EmailChallengePurpose =>
  EMAIL_CHALLENGE_PURPOSES.some((purpose) => purpose === value);

const assertChallengeClaims = ({
  challengeId,
  expiresAt,
  generation,
  purpose,
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
  if (!secret) {
    throw new Error("Email challenge signing secret is required.");
  }

  return Math.trunc(expiresAt.getTime());
};

const createSignature = (payload: string, secret: string): Buffer =>
  createHmac("sha256", secret)
    .update(SIGNATURE_DOMAIN)
    .update(payload)
    .digest();

export const createEmailChallengeToken = (
  input: CreateEmailChallengeTokenInput
): string => {
  const expiresAtMs = assertChallengeClaims(input);
  const payload = [
    input.challengeId,
    String(input.generation),
    String(expiresAtMs),
    input.purpose,
  ].join(".");
  const signature = createSignature(payload, input.secret).toString(
    "base64url"
  );

  return [TOKEN_VERSION, payload, signature].join(".");
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
    signature,
    ...rest
  ] = token.split(".");
  if (
    version !== TOKEN_VERSION ||
    rest.length > 0 ||
    !challengeId ||
    !UUID_PATTERN.test(challengeId) ||
    !generationValue ||
    !expiresAtValue ||
    !purpose ||
    !signature ||
    !SIGNATURE_PATTERN.test(signature) ||
    !isEmailChallengePurpose(purpose) ||
    purpose !== expectedPurpose
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

  const payload = [challengeId, generationValue, expiresAtValue, purpose].join(
    "."
  );
  const expectedSignature = createSignature(payload, secret);
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
  };
};
