import { getPool } from "@/db";
import {
  isCourseCoverVariant,
  parseCourseCoverImage,
} from "@/features/storage/course-cover";
import { isCourseCoverKeyForCourse } from "@/features/storage/course-cover-ownership";
import {
  createR2ObjectReadUrl,
  getPublicMediaUrl,
} from "@/features/storage/r2";
import { requirePermission } from "@/lib/auth-permissions";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ courseId: string; variant: string }> }
): Promise<Response> {
  const { courseId, variant } = await context.params;

  if (!isCourseCoverVariant(variant)) {
    return Response.json({ error: "Variante invalida." }, { status: 404 });
  }

  const { rows } = await getPool().query<{
    catalog_visibility: string;
    cover_image_json: unknown;
    status: string;
  }>(
    "select cover_image_json, status, catalog_visibility from courses where id = $1 limit 1",
    [courseId]
  );
  const coverImage = parseCourseCoverImage(rows[0]?.cover_image_json);
  const image = coverImage?.variants[variant] ?? coverImage?.variants.card;

  if (!(image && isCourseCoverKeyForCourse(courseId, image.key))) {
    return Response.json({ error: "Capa nao encontrada." }, { status: 404 });
  }

  if (
    rows[0]?.status === "active" ||
    rows[0]?.catalog_visibility === "listed"
  ) {
    return new Response(null, {
      headers: {
        "Cache-Control": "public, max-age=3600",
        Location: getPublicMediaUrl(image.key),
      },
      status: 302,
    });
  }

  await requirePermission("manageCourseDetails");

  const signedUrl = await createR2ObjectReadUrl({
    key: image.key,
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
