"use server";

import { revalidatePath } from "next/cache";
import { getPool } from "@/db";
import { writeAuditLog } from "@/features/admin/audit-log";
import {
  AUTH_MEDIA_MAX_SLIDES,
  isAuthMediaObjectKey,
  isAuthMediaSlideId,
} from "@/features/auth-media/contract";
import {
  removeAuthMediaObject,
  synchronizeAuthMediaPublicObject,
} from "@/features/auth-media/storage";
import { uploadAuthMediaFile } from "@/features/storage/r2";
import {
  parseStagedAdminImageReference,
  type StagedAdminImageReference,
} from "@/features/storage/staged-image-upload";
import { consumeStagedAdminImageUpload } from "@/features/storage/staged-image-upload-registry";
import { requirePermission } from "@/lib/auth-permissions";

interface AuthMediaRow {
  blur_data_url: string;
  id: string;
  image_url: string;
  is_active: boolean;
  sort_order: number;
}

const AUTH_MEDIA_REVALIDATE_PATHS = [
  "/admin/configuracoes",
  "/entrar",
  "/cadastro",
  "/recuperar-senha",
  "/redefinir-senha",
] as const;

const readString = (formData: FormData, key: string): string =>
  String(formData.get(key) ?? "").trim();

const readCheckbox = (formData: FormData, key: string): boolean =>
  formData.get(key) === "on";

const revalidateAuthMedia = (): void => {
  for (const path of AUTH_MEDIA_REVALIDATE_PATHS) {
    revalidatePath(path);
  }
};

const requireSlideId = (value: string): string => {
  if (!isAuthMediaSlideId(value)) {
    throw new Error("Identificador da mídia da tela de acesso inválido.");
  }
  return value;
};

const parseImageUpload = (value: string): StagedAdminImageReference | null => {
  if (!value) {
    return null;
  }

  let parsedValue: unknown;
  try {
    parsedValue = JSON.parse(value) as unknown;
  } catch {
    throw new Error("Upload temporário inválido.");
  }

  const reference = parseStagedAdminImageReference(parsedValue);
  if (!reference) {
    throw new Error("Upload temporário inválido.");
  }
  return reference;
};

const readAuthMediaSlide = async (
  slideId: string
): Promise<AuthMediaRow | null> => {
  const { rows } = await getPool().query<AuthMediaRow>(
    "select id, image_url, blur_data_url, is_active, sort_order from auth_media_slides where id = $1",
    [slideId]
  );
  return rows[0] ?? null;
};

const normalizeAuthMediaOrder = async (client: {
  query: <Row = Record<string, unknown>>(
    sql: string,
    values?: unknown[]
  ) => Promise<{ rows: Row[]; rowCount?: number | null }>;
}): Promise<void> => {
  await client.query(
    "update auth_media_slides set sort_order = sort_order + 1000000 where sort_order > 0"
  );
  await client.query(
    "with ranked as (select id, row_number() over (order by sort_order, id) as next_sort_order from auth_media_slides) update auth_media_slides slides set sort_order = ranked.next_sort_order, updated_at = now() from ranked where slides.id = ranked.id"
  );
};

interface PreparedAuthMediaImage {
  blurDataUrl: string;
  imageKey: string;
  uploadedNewObject: boolean;
}

const assertAuthMediaSlideAvailability = async ({
  existingSlideId,
  slideId,
}: {
  existingSlideId: string | null;
  slideId: string;
}): Promise<AuthMediaRow | null> => {
  if (existingSlideId) {
    const previous = await readAuthMediaSlide(existingSlideId);
    if (!previous) {
      throw new Error("Mídia da tela de acesso não encontrada.");
    }
    return previous;
  }

  if (await readAuthMediaSlide(slideId)) {
    throw new Error("Mídia da tela de acesso já existe.");
  }
  return null;
};

const prepareAuthMediaImage = async ({
  imageFile,
  previous,
  slideId,
}: {
  imageFile: File | null;
  previous: AuthMediaRow | null;
  slideId: string;
}): Promise<PreparedAuthMediaImage> => {
  if (imageFile) {
    const uploaded = await uploadAuthMediaFile({
      file: imageFile,
      slideId,
    });
    return {
      blurDataUrl: uploaded.blurDataUrl,
      imageKey: uploaded.key,
      uploadedNewObject: true,
    };
  }

  const imageKey = previous?.image_url ?? "";
  const blurDataUrl = previous?.blur_data_url ?? "";
  if (!(blurDataUrl && isAuthMediaObjectKey(imageKey))) {
    throw new Error("A mídia da tela de acesso está incompleta.");
  }
  return { blurDataUrl, imageKey, uploadedNewObject: false };
};

const getNextAuthMediaSortOrder = async (client: {
  query: <Row = Record<string, unknown>>(
    sql: string,
    values?: unknown[]
  ) => Promise<{ rows: Row[]; rowCount?: number | null }>;
}): Promise<number> => {
  const countResult = await client.query<{ count: string }>(
    "select count(*)::text as count from auth_media_slides"
  );
  if (Number(countResult.rows[0]?.count ?? 0) >= AUTH_MEDIA_MAX_SLIDES) {
    throw new Error("Limite de cinco imagens da tela de acesso atingido.");
  }

  const orderResult = await client.query<{ sort_order: number }>(
    "select sort_order from auth_media_slides order by sort_order, id for update"
  );
  const usedOrders = new Set(orderResult.rows.map((row) => row.sort_order));
  return (
    Array.from({ length: AUTH_MEDIA_MAX_SLIDES }, (_, index) => index + 1).find(
      (candidate) => !usedOrders.has(candidate)
    ) ?? 0
  );
};

const persistAuthMediaRecord = async ({
  existingSlideId,
  imageFile,
  isActive,
  image,
  pool,
  slideId,
}: {
  existingSlideId: string | null;
  imageFile: File | null;
  isActive: boolean;
  image: PreparedAuthMediaImage;
  pool: ReturnType<typeof getPool>;
  slideId: string;
}): Promise<number> => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "LOCK TABLE auth_media_slides IN SHARE ROW EXCLUSIVE MODE"
    );

    if (existingSlideId) {
      const current = await client.query<AuthMediaRow>(
        "select id, image_url, blur_data_url, is_active, sort_order from auth_media_slides where id = $1 for update",
        [existingSlideId]
      );
      const currentRow = current.rows[0];
      if (!currentRow) {
        throw new Error("Mídia da tela de acesso não encontrada.");
      }
      const imageKey = imageFile ? image.imageKey : currentRow.image_url;
      const blurDataUrl = imageFile
        ? image.blurDataUrl
        : currentRow.blur_data_url;
      if (!(blurDataUrl && isAuthMediaObjectKey(imageKey))) {
        throw new Error("Chave da mídia da tela de acesso inválida.");
      }
      await client.query(
        "update auth_media_slides set image_url = $1, blur_data_url = $2, is_active = $3, updated_at = now() where id = $4",
        [imageKey, blurDataUrl, isActive, existingSlideId]
      );
      await client.query("COMMIT");
      return currentRow.sort_order;
    }

    const sortOrder = await getNextAuthMediaSortOrder(client);
    if (!sortOrder) {
      throw new Error("Não há uma posição disponível para a nova mídia.");
    }
    await client.query(
      "insert into auth_media_slides (id, image_url, blur_data_url, is_active, sort_order) values ($1, $2, $3, $4, $5)",
      [slideId, image.imageKey, image.blurDataUrl, isActive, sortOrder]
    );
    await client.query("COMMIT");
    return sortOrder;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const persistAuthMediaSlide = async ({
  actorUserId,
  existingSlideId,
  imageFile,
  isActive,
  slideId,
}: {
  actorUserId: string;
  existingSlideId: string | null;
  imageFile: File | null;
  isActive: boolean;
  slideId: string;
}): Promise<{ slideId: string }> => {
  const pool = getPool();
  const previous = await assertAuthMediaSlideAvailability({
    existingSlideId,
    slideId,
  });
  const image = await prepareAuthMediaImage({
    imageFile,
    previous,
    slideId,
  });
  let recordCommitted = false;

  try {
    await synchronizeAuthMediaPublicObject({
      isActive,
      key: image.imageKey,
    });

    const sortOrder = await persistAuthMediaRecord({
      existingSlideId,
      imageFile,
      image,
      isActive,
      pool,
      slideId,
    });
    recordCommitted = true;
    if (imageFile && previous && previous.image_url !== image.imageKey) {
      await removeAuthMediaObject(previous.image_url).catch(() => undefined);
    }

    await writeAuditLog({
      action: existingSlideId
        ? "auth_media_slide.updated"
        : "auth_media_slide.created",
      actorUserId,
      metadata: {
        changes: {
          imageKey: {
            after: image.imageKey,
            before: previous?.image_url ?? null,
          },
          isActive: {
            after: isActive,
            before: previous?.is_active ?? null,
          },
          sortOrder: {
            after: sortOrder,
            before: previous?.sort_order ?? null,
          },
        },
        targetLabelAfter: "Mídia da tela de acesso",
        ...(previous ? { targetLabelBefore: "Mídia da tela de acesso" } : {}),
      },
      targetId: slideId,
      targetType: "auth_media_slide",
    });
    revalidateAuthMedia();

    return { slideId };
  } catch (error) {
    if (image.uploadedNewObject && !recordCommitted) {
      await removeAuthMediaObject(image.imageKey).catch(() => undefined);
    }
    throw error;
  }
};

export const saveAuthMediaAction = async (
  formData: FormData
): Promise<{ slideId: string }> => {
  const session = await requirePermission("manageAuthMedia");
  const existingSlideIdValue = readString(formData, "slideId");
  const existingSlideId = existingSlideIdValue
    ? requireSlideId(existingSlideIdValue)
    : null;
  const imageUpload = parseImageUpload(readString(formData, "imageUpload"));
  const slideId = requireSlideId(
    existingSlideId ??
      imageUpload?.aggregateId ??
      readString(formData, "newSlideId")
  );

  if (imageUpload && imageUpload.aggregateId !== slideId) {
    throw new Error("Upload temporário não pertence à mídia informada.");
  }
  if (!(existingSlideId || imageUpload)) {
    throw new Error("A imagem da nova mídia é obrigatória.");
  }

  const persist = (imageFile: File | null) =>
    persistAuthMediaSlide({
      actorUserId: session.user.id,
      existingSlideId,
      imageFile,
      isActive: readCheckbox(formData, "isActive"),
      slideId,
    });

  if (!imageUpload) {
    return await persist(null);
  }

  return await consumeStagedAdminImageUpload({
    actorUserId: session.user.id,
    aggregateId: slideId,
    operation: persist,
    purpose: "auth-media",
    reference: imageUpload,
  });
};

export const toggleAuthMediaActiveAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requirePermission("manageAuthMedia");
  const slideId = requireSlideId(readString(formData, "slideId"));
  const isActive = readCheckbox(formData, "isActive");
  const previous = await readAuthMediaSlide(slideId);

  if (!(previous && isAuthMediaObjectKey(previous.image_url))) {
    throw new Error("Mídia da tela de acesso não encontrada.");
  }

  await synchronizeAuthMediaPublicObject({
    isActive,
    key: previous.image_url,
  });

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "LOCK TABLE auth_media_slides IN SHARE ROW EXCLUSIVE MODE"
    );
    await client.query(
      "update auth_media_slides set is_active = $1, updated_at = now() where id = $2",
      [isActive, slideId]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    await synchronizeAuthMediaPublicObject({
      isActive: previous.is_active,
      key: previous.image_url,
    }).catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  await writeAuditLog({
    action: "auth_media_slide.updated",
    actorUserId: session.user.id,
    metadata: {
      changes: {
        isActive: {
          after: isActive,
          before: previous.is_active,
        },
      },
      targetLabelAfter: "Mídia da tela de acesso",
      targetLabelBefore: "Mídia da tela de acesso",
    },
    targetId: slideId,
    targetType: "auth_media_slide",
  });
  revalidateAuthMedia();
};

export const deleteAuthMediaAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requirePermission("manageAuthMedia");
  const slideId = requireSlideId(readString(formData, "slideId"));
  const previous = await readAuthMediaSlide(slideId);

  if (!(previous && isAuthMediaObjectKey(previous.image_url))) {
    throw new Error("Mídia da tela de acesso não encontrada.");
  }

  await synchronizeAuthMediaPublicObject({
    isActive: false,
    key: previous.image_url,
  });

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "LOCK TABLE auth_media_slides IN SHARE ROW EXCLUSIVE MODE"
    );
    await client.query("delete from auth_media_slides where id = $1", [
      slideId,
    ]);
    await normalizeAuthMediaOrder(client);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    await synchronizeAuthMediaPublicObject({
      isActive: previous.is_active,
      key: previous.image_url,
    }).catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  await removeAuthMediaObject(previous.image_url).catch(() => undefined);
  await writeAuditLog({
    action: "auth_media_slide.deleted",
    actorUserId: session.user.id,
    metadata: {
      changes: {
        imageKey: {
          after: null,
          before: previous.image_url,
        },
        isActive: {
          after: null,
          before: previous.is_active,
        },
        sortOrder: {
          after: null,
          before: previous.sort_order,
        },
      },
      targetLabelBefore: "Mídia da tela de acesso",
    },
    targetId: slideId,
    targetType: "auth_media_slide",
  });
  revalidateAuthMedia();
};

export const reorderAuthMediaAction = async (
  orderedSlideIds: string[]
): Promise<void> => {
  const session = await requirePermission("manageAuthMedia");
  const normalizedIds = orderedSlideIds.map(requireSlideId);
  if (
    normalizedIds.length === 0 ||
    normalizedIds.length > AUTH_MEDIA_MAX_SLIDES ||
    new Set(normalizedIds).size !== normalizedIds.length
  ) {
    throw new Error("Ordem da mídia da tela de acesso inválida.");
  }

  const client = await getPool().connect();
  let previousOrder: string[] = [];
  try {
    await client.query("BEGIN");
    await client.query(
      "LOCK TABLE auth_media_slides IN SHARE ROW EXCLUSIVE MODE"
    );
    const current = await client.query<{
      id: string;
      sort_order: number;
    }>(
      "select id, sort_order from auth_media_slides order by sort_order, id for update"
    );
    previousOrder = current.rows.map((row) => row.id);
    if (
      previousOrder.length !== normalizedIds.length ||
      previousOrder.some((id) => !normalizedIds.includes(id))
    ) {
      throw new Error("Ordem da mídia da tela de acesso inválida.");
    }

    await client.query(
      "update auth_media_slides set sort_order = sort_order + 1000000 where sort_order > 0"
    );
    for (const [index, slideId] of normalizedIds.entries()) {
      await client.query(
        "update auth_media_slides set sort_order = $1, updated_at = now() where id = $2",
        [index + 1, slideId]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  await writeAuditLog({
    action: "auth_media_slides.reordered",
    actorUserId: session.user.id,
    metadata: {
      changes: {
        order: {
          after: normalizedIds,
          before: previousOrder,
        },
      },
      targetLabelAfter: "Mídia da tela de acesso",
      targetLabelBefore: "Mídia da tela de acesso",
    },
    targetType: "auth_media_slide",
  });
  revalidateAuthMedia();
};
