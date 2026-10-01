import { AvatarImageValidationError } from "@/features/account/avatar-image";
import { USER_AVATAR_MAX_BYTES } from "@/features/account/avatar-policy";
import {
  readCurrentUserAvatar,
  saveUserAvatar,
} from "@/features/account/avatar-storage";
import { getServerEnv } from "@/lib/env";
import {
  CORRELATION_ID_HEADER,
  createCorrelationId,
  logOperationalEvent,
} from "@/lib/observability";
import { type AppSession, getCurrentSession } from "@/lib/session";
import { parseTrustedOrigins } from "@/lib/trusted-origins";

export const dynamic = "force-dynamic";

const noStoreHeaders = {
  "cache-control": "private, no-store",
  "x-content-type-options": "nosniff",
};
const MAX_MULTIPART_REQUEST_BYTES = USER_AVATAR_MAX_BYTES + 1 * 1024 * 1024;

const isBlockedStudent = (session: AppSession): boolean =>
  session.role === "student" && session.platformBlockedAt !== null;

const hasTrustedOrigin = (request: Request): boolean => {
  const requestOrigin = request.headers.get("origin");
  if (!requestOrigin) {
    return false;
  }
  const environment = getServerEnv();
  const trustedOrigins = parseTrustedOrigins({
    defaults: [environment.BETTER_AUTH_URL, environment.NEXT_PUBLIC_APP_URL],
    extraOrigins: environment.BETTER_AUTH_TRUSTED_ORIGINS,
  });
  return trustedOrigins.includes(requestOrigin);
};

export const GET = async (): Promise<Response> => {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return Response.json(
        { error: "unauthenticated" },
        { headers: noStoreHeaders, status: 401 }
      );
    }
    if (isBlockedStudent(session)) {
      return Response.json(
        { error: "account_suspended" },
        { headers: noStoreHeaders, status: 403 }
      );
    }
    const body = await readCurrentUserAvatar(session.user.id);
    if (!body) {
      return new Response(null, { headers: noStoreHeaders, status: 404 });
    }
    return new Response(new Uint8Array(body), {
      headers: {
        ...noStoreHeaders,
        "content-length": String(body.byteLength),
        "content-type": "image/webp",
      },
    });
  } catch {
    return Response.json(
      { error: "avatar_unavailable" },
      { headers: noStoreHeaders, status: 503 }
    );
  }
};

export const POST = async (request: Request): Promise<Response> => {
  const correlationId = createCorrelationId(
    request.headers.get(CORRELATION_ID_HEADER)
  );
  if (!hasTrustedOrigin(request)) {
    return Response.json(
      { error: "untrusted_origin" },
      { headers: noStoreHeaders, status: 403 }
    );
  }
  const contentLength = Number(request.headers.get("content-length"));
  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_MULTIPART_REQUEST_BYTES
  ) {
    return Response.json(
      { error: "avatar_too_large" },
      { headers: noStoreHeaders, status: 413 }
    );
  }

  let session: AppSession | null;
  try {
    session = await getCurrentSession();
  } catch {
    return Response.json(
      { error: "avatar_temporarily_unavailable" },
      { headers: noStoreHeaders, status: 503 }
    );
  }
  if (!session) {
    return Response.json(
      { error: "unauthenticated" },
      { headers: noStoreHeaders, status: 401 }
    );
  }
  if (isBlockedStudent(session)) {
    return Response.json(
      { error: "account_suspended" },
      { headers: noStoreHeaders, status: 403 }
    );
  }
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json(
      { error: "invalid_avatar_request" },
      { headers: noStoreHeaders, status: 400 }
    );
  }
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json(
      { error: "invalid_avatar_request" },
      { headers: noStoreHeaders, status: 400 }
    );
  }

  try {
    await saveUserAvatar({ file, userId: session.user.id });
    logOperationalEvent({
      correlationId,
      operation: "account.avatar_upload",
      outcome: "success",
    });
    return Response.json({ status: "uploaded" }, { headers: noStoreHeaders });
  } catch (error) {
    if (error instanceof AvatarImageValidationError) {
      return Response.json(
        { error: error.message },
        { headers: noStoreHeaders, status: 400 }
      );
    }
    logOperationalEvent({
      correlationId,
      errorCode: "avatar_upload_failed",
      operation: "account.avatar_upload",
      outcome: "failure",
      provider: "r2",
    });
    return Response.json(
      { error: "avatar_upload_failed" },
      { headers: noStoreHeaders, status: 503 }
    );
  }
};
