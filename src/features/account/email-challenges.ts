import "server-only";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { z } from "zod";
import { withPostgresTransaction } from "@/db/transaction";
import { consumeAccountRateLimit } from "@/features/account/account-rate-limits";
import { lockAccountEmailIdentity } from "@/features/account/email-identity-lock";
import { createEmailVerificationMessage } from "@/features/outbox/rules";
import { enqueueOutboxMessage } from "@/features/outbox/server";
import { getAuthSignInPath, getSafeAuthReturnTo } from "@/lib/auth-return-to";
import { getClientIpAddress } from "@/lib/client-ip";
import { normalizeBuyerEmail } from "@/lib/email-identity";
import { getServerEnv } from "@/lib/env";
import { verifyEmailChallengeToken } from "./email-challenge-token";
import type { PublicSignupInput } from "./public-signup-input";

const EMAIL_CHALLENGE_TTL_MS = 60 * 60 * 1000;
const EMAIL_REQUEST_LIMIT = 3;
const IP_REQUEST_LIMIT = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const verificationEmailSchema = z.string().trim().min(1).max(254).email();

type ChallengeRequestOutcome = "queued" | "rate_limited" | "suppressed";

interface AccountIdentityRow {
  email: string;
  email_verified: boolean;
  id: string;
  role: "admin" | "support" | "student" | null;
}

interface PendingSignupRow {
  generation: number;
  id: string;
}

interface EmailChallengeRow {
  generation: number;
  id: string;
}

interface StoredEmailChallengeRow {
  consumed_at: Date | null;
  expires_at: Date;
  generation: number;
  id: string;
  order_id: string | null;
  pending_email: string | null;
  pending_signup_id: string | null;
  purpose: string;
  user_id: string | null;
}

interface EmailChallengeOwnerPreview extends StoredEmailChallengeRow {
  owner_email: string | null;
}

interface PendingSignupAcceptanceRow {
  course_slug: string | null;
  email: string;
  expires_at: Date;
  generation: number;
  id: string;
  name: string;
  status: "completed" | "expired" | "pending" | "superseded";
}

interface AccountClaimRow {
  email: string;
  email_verified: boolean;
}

const isRateLimited = async ({
  canonicalEmail,
  client,
  requestHeaders,
}: {
  canonicalEmail: string;
  client: PoolClient;
  requestHeaders: Headers;
}): Promise<boolean> => {
  const env = getServerEnv();
  const emailAllowed = await consumeAccountRateLimit({
    client,
    key: `email:${canonicalEmail}`,
    limit: EMAIL_REQUEST_LIMIT,
    namespace: "hub:account-email-challenge-rate-limit:v1",
    windowMs: RATE_LIMIT_WINDOW_MS,
  });
  const ipAddress = getClientIpAddress(requestHeaders, env.CLIENT_IP_SOURCE);
  if (ipAddress === "unknown" && env.NODE_ENV === "production") {
    return true;
  }
  const ipAllowed = await consumeAccountRateLimit({
    client,
    key: `ip:${ipAddress}`,
    limit: IP_REQUEST_LIMIT,
    namespace: "hub:account-email-challenge-rate-limit:v1",
    windowMs: RATE_LIMIT_WINDOW_MS,
  });

  return !(emailAllowed && ipAllowed);
};

const queueVerificationMessage = async ({
  challenge,
  client,
}: {
  challenge: EmailChallengeRow;
  client: PoolClient;
}): Promise<void> => {
  await enqueueOutboxMessage({
    client,
    message: createEmailVerificationMessage({
      challengeId: challenge.id,
      generation: challenge.generation,
    }),
  });
};

const issueUnverifiedAccountVerificationChallenge = async ({
  client,
  userId,
}: {
  client: PoolClient;
  userId: string;
}): Promise<ChallengeRequestOutcome> => {
  const result = await client.query<AccountIdentityRow>(
    `
      select
        users.id,
        users.email,
        users.email_verified,
        profiles.role
      from users
      left join profiles on profiles.user_id = users.id
      where users.id = $1
      limit 1
      for update of users
    `,
    [userId]
  );
  const user = result.rows[0];
  if (!(user && !user.email_verified)) {
    return "suppressed";
  }

  const expiresAt = new Date(Date.now() + EMAIL_CHALLENGE_TTL_MS);
  const challengeResult = await client.query<EmailChallengeRow>(
    `
      insert into account_email_challenges (
        purpose,
        user_id,
        generation,
        expires_at
      )
      values ('verify_email', $1, 1, $2)
      on conflict (user_id, purpose)
        where user_id is not null and order_id is null
      do update set
        generation = account_email_challenges.generation + 1,
        expires_at = excluded.expires_at,
        consumed_at = null,
        updated_at = now()
      returning id, generation
    `,
    [user.id, expiresAt]
  );
  const challenge = challengeResult.rows[0];
  if (!challenge) {
    throw new Error("email_challenge_creation_failed");
  }
  await queueVerificationMessage({ challenge, client });
  return "queued";
};

const getCanonicalAccountCandidates = async ({
  canonicalEmail,
  client,
}: {
  canonicalEmail: string;
  client: PoolClient;
}): Promise<AccountIdentityRow[]> => {
  const result = await client.query<AccountIdentityRow>(
    `
      select
        users.id,
        users.email,
        users.email_verified,
        profiles.role
      from users
      left join profiles on profiles.user_id = users.id
      where public.canonicalize_auth_email_identity(users.email) = $1
      limit 2
      for update of users
    `,
    [canonicalEmail]
  );
  return result.rows;
};

const issuePendingSignup = async ({
  client,
  input,
}: {
  client: PoolClient;
  input: PublicSignupInput;
}): Promise<EmailChallengeRow> => {
  const expiresAt = new Date(Date.now() + EMAIL_CHALLENGE_TTL_MS);
  await client.query(
    `
    delete from pending_signups
    where status = 'pending'
      and expires_at <= now()
      and public.canonicalize_auth_email_identity(email) = $1
    `,
    [normalizeBuyerEmail(input.email)]
  );

  const existing = await client.query<PendingSignupRow>(
    `
      select id, generation
      from pending_signups
      where status = 'pending'
        and public.canonicalize_auth_email_identity(email) = $1
      limit 1
      for update
    `,
    [normalizeBuyerEmail(input.email)]
  );
  const prior = existing.rows[0];
  let pending: PendingSignupRow;
  if (prior) {
    const updated = await client.query<PendingSignupRow>(
      `
        update pending_signups
        set name = $2,
            email = $3,
            course_slug = $4,
            generation = generation + 1,
            expires_at = $5,
            updated_at = now()
        where id = $1 and status = 'pending'
        returning id, generation
      `,
      [prior.id, input.name, input.email, input.courseSlug, expiresAt]
    );
    pending = updated.rows[0] as PendingSignupRow;
  } else {
    const inserted = await client.query<PendingSignupRow>(
      `
        insert into pending_signups (
          name,
          email,
          course_slug,
          generation,
          expires_at
        )
        values ($1, $2, $3, 1, $4)
        returning id, generation
      `,
      [input.name, input.email, input.courseSlug, expiresAt]
    );
    pending = inserted.rows[0] as PendingSignupRow;
  }
  if (!pending) {
    throw new Error("pending_signup_creation_failed");
  }

  const challengeResult = await client.query<EmailChallengeRow>(
    `
      insert into account_email_challenges (
        purpose,
        pending_signup_id,
        generation,
        expires_at
      )
      values ('signup', $1, $2, $3)
      on conflict (pending_signup_id, purpose)
        where pending_signup_id is not null
      do update set
        generation = excluded.generation,
        expires_at = excluded.expires_at,
        consumed_at = null,
        updated_at = now()
      returning id, generation
    `,
    [pending.id, pending.generation, expiresAt]
  );
  const challenge = challengeResult.rows[0];
  if (!challenge) {
    throw new Error("email_challenge_creation_failed");
  }
  return challenge;
};

export const requestPublicAccountRegistration = async ({
  input,
  requestHeaders,
}: {
  input: PublicSignupInput;
  requestHeaders: Headers;
}): Promise<ChallengeRequestOutcome> => {
  const canonicalEmail = normalizeBuyerEmail(input.email);

  return await withPostgresTransaction(async (client) => {
    await lockAccountEmailIdentity(client, canonicalEmail);
    if (await isRateLimited({ canonicalEmail, client, requestHeaders })) {
      return "rate_limited";
    }

    const candidates = await getCanonicalAccountCandidates({
      canonicalEmail,
      client,
    });
    if (candidates.length > 1) {
      return "suppressed";
    }

    const existing = candidates[0];
    if (existing) {
      if (
        !existing.email_verified &&
        (existing.role ?? "student") === "student"
      ) {
        return await issueUnverifiedAccountVerificationChallenge({
          client,
          userId: existing.id,
        });
      }
      return "suppressed";
    }

    const challenge = await issuePendingSignup({ client, input });
    await queueVerificationMessage({ challenge, client });
    return "queued";
  });
};

export const requestAccountEmailVerificationByAddress = async ({
  email,
  requestHeaders,
}: {
  email: string;
  requestHeaders: Headers;
}): Promise<ChallengeRequestOutcome> => {
  const parsedEmail = verificationEmailSchema.safeParse(email);
  if (!parsedEmail.success) {
    return "suppressed";
  }
  const canonicalEmail = normalizeBuyerEmail(parsedEmail.data);

  return await withPostgresTransaction(async (client) => {
    await lockAccountEmailIdentity(client, canonicalEmail);
    if (await isRateLimited({ canonicalEmail, client, requestHeaders })) {
      return "rate_limited";
    }

    const candidates = await getCanonicalAccountCandidates({
      canonicalEmail,
      client,
    });
    if (candidates.length !== 1) {
      return "suppressed";
    }
    const account = candidates[0];
    if (!account || account.email_verified) {
      return "suppressed";
    }
    return await issueUnverifiedAccountVerificationChallenge({
      client,
      userId: account.id,
    });
  });
};

export const requestExistingAccountEmailVerification = async ({
  requestHeaders,
  userId,
}: {
  requestHeaders: Headers;
  userId: string;
}): Promise<ChallengeRequestOutcome> =>
  await withPostgresTransaction(async (client) => {
    const userResult = await client.query<{ email: string }>(
      "select email from users where id = $1 limit 1",
      [userId]
    );
    const email = userResult.rows[0]?.email;
    if (!email) {
      return "suppressed";
    }
    const canonicalEmail = normalizeBuyerEmail(email);
    await lockAccountEmailIdentity(client, canonicalEmail);
    if (await isRateLimited({ canonicalEmail, client, requestHeaders })) {
      return "rate_limited";
    }
    return await issueUnverifiedAccountVerificationChallenge({
      client,
      userId,
    });
  });

const signInPathAfterVerification = (returnTo: string | null): string => {
  const path = getAuthSignInPath(returnTo);
  const url = new URL(path, "https://hub.invalid");
  url.searchParams.set("emailVerified", "1");
  return `${url.pathname}${url.search}`;
};

const resolveChallengeClaims = (token: string) => {
  const secret = getServerEnv().BETTER_AUTH_SECRET;
  for (const purpose of [
    "purchase_verification",
    "signup",
    "verify_email",
  ] as const) {
    const claims = verifyEmailChallengeToken({ purpose, secret, token });
    if (claims) {
      return claims;
    }
  }
  return null;
};

const isValidStoredEmailChallenge = (
  challenge: StoredEmailChallengeRow | undefined,
  claims: NonNullable<ReturnType<typeof resolveChallengeClaims>>,
  now: Date
): challenge is StoredEmailChallengeRow =>
  Boolean(
    challenge &&
      challenge.purpose === claims.purpose &&
      challenge.generation === claims.generation &&
      challenge.expires_at.getTime() === claims.expiresAt.getTime() &&
      challenge.expires_at.getTime() > now.getTime() &&
      !challenge.consumed_at
  );

type LockedEmailChallengeOwner =
  | { account: AccountClaimRow; pending: null }
  | { account: null; pending: PendingSignupAcceptanceRow };

const lockEmailChallengeOwner = async ({
  client,
  preview,
}: {
  client: PoolClient;
  preview: EmailChallengeOwnerPreview;
}): Promise<LockedEmailChallengeOwner | null> => {
  if (!preview.owner_email) {
    return null;
  }

  const canonicalEmail = normalizeBuyerEmail(preview.owner_email);
  await lockAccountEmailIdentity(client, canonicalEmail);

  if (preview.pending_signup_id) {
    const result = await client.query<PendingSignupAcceptanceRow>(
      `select id, name, email, course_slug, status, generation, expires_at
       from pending_signups
       where id = $1
       limit 1
       for update`,
      [preview.pending_signup_id]
    );
    const pending = result.rows[0];
    if (!pending || normalizeBuyerEmail(pending.email) !== canonicalEmail) {
      return null;
    }
    return { account: null, pending };
  }

  if (preview.user_id) {
    const result = await client.query<AccountClaimRow>(
      `select email, email_verified
       from users
       where id = $1
       limit 1
       for update`,
      [preview.user_id]
    );
    const account = result.rows[0];
    if (!account || normalizeBuyerEmail(account.email) !== canonicalEmail) {
      return null;
    }
    return { account, pending: null };
  }

  return null;
};

const getPurchaseChallengeReturnTo = async ({
  challenge,
  client,
}: {
  challenge: StoredEmailChallengeRow;
  client: PoolClient;
}): Promise<string | null> => {
  if (!(challenge.order_id && challenge.user_id)) {
    return null;
  }
  const result = await client.query<{ checkout_course_slug: string }>(
    `select checkout_course_slug
     from orders
     where id = $1 and user_id = $2
     limit 1`,
    [challenge.order_id, challenge.user_id]
  );
  const slug = result.rows[0]?.checkout_course_slug;
  if (!slug) {
    return null;
  }
  return getSafeAuthReturnTo(`/comprar/${slug}`);
};

const consumeVerifiedEmailChallenge = async ({
  account,
  challenge,
  client,
}: {
  account: AccountClaimRow;
  challenge: StoredEmailChallengeRow;
  client: PoolClient;
}): Promise<{ confirmed: false } | { confirmed: true; nextPath: string }> => {
  const returnTo =
    challenge.purpose === "purchase_verification"
      ? await getPurchaseChallengeReturnTo({ challenge, client })
      : null;
  return await consumeUnverifiedAccount({
    account,
    challenge,
    client,
    returnTo,
  });
};

const markEmailChallengeConsumed = async ({
  challenge,
  client,
}: {
  challenge: StoredEmailChallengeRow;
  client: PoolClient;
}): Promise<void> => {
  await client.query(
    `update account_email_challenges
     set consumed_at = now(), updated_at = now()
     where id = $1 and generation = $2 and consumed_at is null`,
    [challenge.id, challenge.generation]
  );
};

const supersedePendingSignup = async ({
  client,
  pendingSignupId,
}: {
  client: PoolClient;
  pendingSignupId: string;
}): Promise<{ confirmed: false }> => {
  await client.query(
    `delete from pending_signups
     where id = $1`,
    [pendingSignupId]
  );
  return { confirmed: false };
};

const consumePendingSignup = async ({
  challenge,
  client,
  now,
  pending,
}: {
  challenge: StoredEmailChallengeRow;
  client: PoolClient;
  now: Date;
  pending: PendingSignupAcceptanceRow;
}): Promise<{ confirmed: false } | { confirmed: true; nextPath: string }> => {
  if (pending?.status !== "pending") {
    return { confirmed: false };
  }
  if (pending.generation !== challenge.generation) {
    return { confirmed: false };
  }
  if (pending.expires_at.getTime() <= now.getTime()) {
    await client.query("delete from pending_signups where id = $1", [
      pending.id,
    ]);
    return { confirmed: false };
  }

  const canonicalEmail = normalizeBuyerEmail(pending.email);
  await lockAccountEmailIdentity(client, canonicalEmail);
  const accountCandidates = await client.query<{ id: string }>(
    `
      select id
      from users
      where public.canonicalize_auth_email_identity(email) = $1
      limit 1
      for update
    `,
    [canonicalEmail]
  );
  if (accountCandidates.rows.length > 0) {
    return await supersedePendingSignup({
      client,
      pendingSignupId: pending.id,
    });
  }

  const insertedAccount = await client.query<{ id: string }>(
    `
      insert into users (id, name, email, email_verified)
      values ($1, $2, $3, true)
      on conflict do nothing
      returning id
    `,
    [randomUUID(), pending.name, pending.email]
  );
  if (!insertedAccount.rows[0]) {
    return await supersedePendingSignup({
      client,
      pendingSignupId: pending.id,
    });
  }

  await client.query("delete from pending_signups where id = $1", [pending.id]);
  return {
    confirmed: true,
    nextPath: signInPathAfterVerification(
      pending.course_slug ? `/comprar/${pending.course_slug}` : null
    ),
  };
};

const consumeUnverifiedAccount = async ({
  account,
  challenge,
  client,
  returnTo,
}: {
  account: AccountClaimRow;
  challenge: StoredEmailChallengeRow;
  client: PoolClient;
  returnTo: string | null;
}): Promise<{ confirmed: false } | { confirmed: true; nextPath: string }> => {
  if (account.email_verified) {
    if (!(challenge.purpose === "purchase_verification" && returnTo)) {
      return { confirmed: false };
    }
    await markEmailChallengeConsumed({ challenge, client });
    return {
      confirmed: true,
      nextPath: signInPathAfterVerification(returnTo),
    };
  }

  await client.query(
    `delete from accounts
     where user_id = $1 and provider_id = 'credential'`,
    [challenge.user_id]
  );
  await client.query("delete from sessions where user_id = $1", [
    challenge.user_id,
  ]);
  await client.query(
    `update users
     set email_verified = true, updated_at = now()
     where id = $1 and email_verified = false`,
    [challenge.user_id]
  );
  await markEmailChallengeConsumed({ challenge, client });
  return {
    confirmed: true,
    nextPath: signInPathAfterVerification(returnTo),
  };
};

export const consumeAccountEmailChallenge = async (
  token: string
): Promise<{ confirmed: false } | { confirmed: true; nextPath: string }> => {
  const claims = resolveChallengeClaims(token);
  if (!claims) {
    return { confirmed: false };
  }

  return await withPostgresTransaction(async (client) => {
    const previewResult = await client.query<EmailChallengeOwnerPreview>(
      `
        select
          challenge.id,
          challenge.purpose,
          challenge.user_id,
          challenge.pending_signup_id,
          challenge.order_id,
          challenge.pending_email,
          challenge.generation,
          challenge.expires_at,
          challenge.consumed_at,
          coalesce(pending_signups.email, users.email) as owner_email
        from account_email_challenges as challenge
        left join pending_signups
          on pending_signups.id = challenge.pending_signup_id
        left join users on users.id = challenge.user_id
        where challenge.id = $1
        limit 1
      `,
      [claims.challengeId]
    );
    const preview = previewResult.rows[0];
    if (!preview) {
      return { confirmed: false };
    }
    const owner = await lockEmailChallengeOwner({ client, preview });
    if (!owner) {
      return { confirmed: false };
    }

    const challengeResult = await client.query<StoredEmailChallengeRow>(
      `
        select
          id,
          purpose,
          user_id,
          pending_signup_id,
          order_id,
          pending_email,
          generation,
          expires_at,
          consumed_at
        from account_email_challenges
        where id = $1
        limit 1
        for update
      `,
      [claims.challengeId]
    );
    const challenge = challengeResult.rows[0];
    const now = new Date();
    if (
      challenge?.purpose === "purchase_verification" &&
      challenge.consumed_at &&
      challenge.user_id &&
      owner.account?.email_verified
    ) {
      return await consumeVerifiedEmailChallenge({
        account: owner.account,
        challenge,
        client,
      });
    }
    if (!isValidStoredEmailChallenge(challenge, claims, now)) {
      return { confirmed: false };
    }

    if (
      challenge.purpose === "signup" &&
      challenge.pending_signup_id &&
      !challenge.user_id &&
      owner.pending
    ) {
      return await consumePendingSignup({
        challenge,
        client,
        now,
        pending: owner.pending,
      });
    }

    if (
      (challenge.purpose === "verify_email" ||
        challenge.purpose === "purchase_verification") &&
      challenge.user_id &&
      !challenge.pending_signup_id &&
      owner.account
    ) {
      return await consumeVerifiedEmailChallenge({
        account: owner.account,
        challenge,
        client,
      });
    }

    return { confirmed: false };
  });
};
