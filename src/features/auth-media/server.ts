import "server-only";
import { getPool } from "@/db";
import type {
  AdminAuthMediaSlide,
  AuthMediaSlide,
} from "@/features/auth-media/types";
import { getPublicMediaUrl } from "@/features/storage/r2";
import { requirePermission } from "@/lib/auth-permissions";
import { isAuthMediaObjectKey, isAuthMediaSlideId } from "./contract";

interface AuthMediaRow {
  blur_data_url: string;
  id: string;
  image_url: string;
  is_active: boolean;
  sort_order: number;
  updated_at: Date;
}

const AUTH_MEDIA_SELECT =
  "select id, image_url, blur_data_url, is_active, sort_order, updated_at from auth_media_slides";

const versionPublicMediaUrl = (imageKey: string, updatedAt: Date): string => {
  const url = new URL(getPublicMediaUrl(imageKey));
  url.searchParams.set("v", String(updatedAt.getTime()));
  return url.toString();
};

const toAdminSlide = (row: AuthMediaRow): AdminAuthMediaSlide => ({
  blurDataUrl: row.blur_data_url,
  id: row.id,
  imageUrl: `/api/admin/auth-media/${encodeURIComponent(row.id)}/image`,
  isActive: row.is_active,
  sortOrder: row.sort_order,
});

export const getAdminAuthMediaData = async (): Promise<{
  slides: AdminAuthMediaSlide[];
}> => {
  await requirePermission("manageSettings");
  const { rows } = await getPool().query<AuthMediaRow>(
    `${AUTH_MEDIA_SELECT} order by sort_order, id`
  );

  return { slides: rows.map(toAdminSlide) };
};

export const getActiveAuthMediaData = async (): Promise<{
  slides: AuthMediaSlide[];
}> => {
  const { rows } = await getPool().query<AuthMediaRow>(
    `${AUTH_MEDIA_SELECT} where is_active = true order by sort_order, id`
  );

  return {
    slides: rows.flatMap((row) => {
      if (!isAuthMediaObjectKey(row.image_url)) {
        return [];
      }

      return [
        {
          blurDataUrl: row.blur_data_url,
          id: row.id,
          imageUrl: versionPublicMediaUrl(row.image_url, row.updated_at),
          sortOrder: row.sort_order,
        },
      ];
    }),
  };
};

export const getAdminAuthMediaImageKey = async (
  slideId: string
): Promise<string | null> => {
  await requirePermission("manageSettings");
  if (!isAuthMediaSlideId(slideId)) {
    return null;
  }

  const { rows } = await getPool().query<{ image_url: string }>(
    "select image_url from auth_media_slides where id = $1",
    [slideId]
  );
  const imageKey = rows[0]?.image_url;
  return imageKey && isAuthMediaObjectKey(imageKey) ? imageKey : null;
};
