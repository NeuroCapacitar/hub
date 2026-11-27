import { getPool } from "@/db";
import { getCourseCoverPublicStorageKeys } from "@/features/storage/course-cover";
import { publishCourseCover } from "@/features/storage/course-cover-publication";

/**
 * Republishes the cover of every Course whose cover route redirects to the
 * public bucket: active delivery or listed in the catalog ("Em breve").
 */
const publishActiveCourseCovers = async (): Promise<number> => {
  const { rows } = await getPool().query<{ cover_image_json: unknown }>(
    `
      select cover_image_json
      from courses
      where (status = 'active' or catalog_visibility = 'listed')
        and cover_image_json is not null
    `
  );
  let publishedObjectCount = 0;

  for (const row of rows) {
    await publishCourseCover(row.cover_image_json);
    publishedObjectCount += getCourseCoverPublicStorageKeys(
      row.cover_image_json
    ).length;
  }

  return publishedObjectCount;
};

if (import.meta.main) {
  try {
    const publishedObjectCount = await publishActiveCourseCovers();
    process.stdout.write(
      `Published ${publishedObjectCount} public course cover objects.\n`
    );
  } finally {
    await getPool().end();
  }
}

export { publishActiveCourseCovers };
