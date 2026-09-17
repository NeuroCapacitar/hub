import { createStagedAdminImageUploadUrl } from "@/features/storage/r2";
import {
  getStagedAdminImagePermission,
  isStagedAdminImagePurpose,
  parseStagedAdminImageReference,
} from "@/features/storage/staged-image-upload";
import { registerStagedAdminImageUpload } from "@/features/storage/staged-image-upload-registry";
import { requirePermission } from "@/lib/auth-permissions";

export const runtime = "nodejs";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const POST = async (request: Request): Promise<Response> => {
  await requirePermission("viewAdminPanel");
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Dados invalidos." }, { status: 400 });
  }

  if (!isRecord(body)) {
    return Response.json({ error: "Dados invalidos." }, { status: 400 });
  }

  const { aggregateId, contentType, fileName, purpose, sizeBytes } = body;
  if (
    typeof aggregateId !== "string" ||
    typeof contentType !== "string" ||
    typeof fileName !== "string" ||
    typeof purpose !== "string" ||
    !isStagedAdminImagePurpose(purpose) ||
    typeof sizeBytes !== "number"
  ) {
    return Response.json({ error: "Dados invalidos." }, { status: 400 });
  }

  const session = await requirePermission(
    getStagedAdminImagePermission(purpose)
  );

  try {
    const prepared = await createStagedAdminImageUploadUrl({
      actorUserId: session.user.id,
      aggregateId,
      contentType,
      fileName,
      purpose,
      sizeBytes,
    });
    const reference = parseStagedAdminImageReference(prepared.reference);
    if (!reference) {
      throw new Error("Upload temporario invalido.");
    }
    await registerStagedAdminImageUpload({
      actorUserId: session.user.id,
      reference,
    });
    return Response.json(prepared);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível preparar o upload.",
      },
      { status: 400 }
    );
  }
};
