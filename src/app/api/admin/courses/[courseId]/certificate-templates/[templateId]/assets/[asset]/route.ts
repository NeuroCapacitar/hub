import { getPool } from "@/db";
import { isCertificateTemplateAssetKey } from "@/features/certificates/template-asset-key";
import { createR2ObjectReadUrl } from "@/features/storage/r2";
import { requirePermission } from "@/lib/auth-permissions";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      asset: string;
      courseId: string;
      templateId: string;
    }>;
  }
): Promise<Response> {
  await requirePermission("viewCourses");
  const { asset, courseId, templateId } = await context.params;
  if (asset !== "background" && asset !== "signature") {
    return Response.json(
      { error: "Imagem não encontrada." },
      { headers: { "Cache-Control": "no-store" }, status: 404 }
    );
  }

  const result = await getPool().query<{
    background_key: string;
    signature_key: string | null;
  }>(
    `select background_key, signature_key
     from certificate_templates
     where course_id = $1 and id = $2
     limit 1`,
    [courseId, templateId]
  );
  const row = result.rows[0];
  const key = asset === "background" ? row?.background_key : row?.signature_key;
  const requestedVersion = new URL(request.url).searchParams.get("v");

  if (
    !key ||
    requestedVersion !== key ||
    !isCertificateTemplateAssetKey({ courseId, key, kind: asset })
  ) {
    return Response.json(
      { error: "Imagem não encontrada." },
      { headers: { "Cache-Control": "no-store" }, status: 404 }
    );
  }

  const signedUrl = await createR2ObjectReadUrl({
    key,
    responseCacheControl: "private, max-age=240",
  });
  return new Response(null, {
    headers: {
      "Cache-Control": "private, max-age=240",
      Location: signedUrl,
      Vary: "Cookie",
    },
    status: 302,
  });
}
