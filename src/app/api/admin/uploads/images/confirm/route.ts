import {
  getStagedAdminImagePermission,
  parseStagedAdminImageReference,
  type StagedAdminImageReference,
} from "@/features/storage/staged-image-upload";
import { confirmStagedAdminImageUpload } from "@/features/storage/staged-image-upload-registry";
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
  const reference = isRecord(body)
    ? parseStagedAdminImageReference(body.reference)
    : null;
  if (!reference) {
    return Response.json({ error: "Dados invalidos." }, { status: 400 });
  }

  const session = await requirePermission(
    getStagedAdminImagePermission(reference.purpose)
  );

  try {
    await confirmStagedAdminImageUpload({
      actorUserId: session.user.id,
      reference,
    });
    return Response.json({
      reference: reference satisfies StagedAdminImageReference,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível confirmar o upload.",
      },
      { status: 400 }
    );
  }
};
