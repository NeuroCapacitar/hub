import "server-only";
import { randomUUID } from "node:crypto";
import {
  CopyObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { buildAuthMediaObjectKey } from "@/features/auth-media/contract";
import { BANNER_STORAGE_PREFIX } from "@/features/storage/banner-image";
import type { CourseCoverImage } from "@/features/storage/course-cover";
import type { CourseCoverFile } from "@/features/storage/course-cover-upload";
import type {
  LessonResourceUploadReference,
  PreparedLessonResourceUpload,
} from "@/features/storage/lesson-resource-upload";
import {
  assertPublicMediaKey,
  buildPublicMediaUrl,
} from "@/features/storage/public-media";
import { isPublishedLessonResourceKey } from "@/features/storage/published-lesson-resource";
import { resolveR2ClientEndpoint } from "@/features/storage/r2-endpoint";
import { createR2ObjectNamespace } from "@/features/storage/r2-object-namespace";
import {
  buildLessonResourceObjectKey,
  buildLessonResourcePreviewObjectKey,
  validateLessonAttachmentUpload,
  validateLessonImagePreviewUpload,
} from "@/features/storage/r2-objects";
import {
  assertStagedAdminImageOwnership,
  buildStagedAdminImageUpload,
  STAGED_ADMIN_IMAGE_PREFIX,
  type StagedAdminImagePurpose,
  type StagedAdminImageReference,
} from "@/features/storage/staged-image-upload";
import { getServerEnv } from "@/lib/env";
import { readBoundedBody } from "@/lib/request-body-limits";

export const R2_UPLOAD_URL_EXPIRES_SECONDS = 10 * 60;
const DOWNLOAD_URL_EXPIRES_SECONDS = 5 * 60;
const DELETE_OBJECTS_BATCH_SIZE = 1000;
const PRIVATE_MEDIA_CACHE_CONTROL = "private, max-age=240";
const PUBLIC_VERSIONED_MEDIA_CACHE_CONTROL = "public, max-age=3600, immutable";

interface R2Config {
  accessKeyId: string;
  accountId: string;
  bucketName: string;
  namespace: ReturnType<typeof createR2ObjectNamespace>;
  secretAccessKey: string;
}

interface PublicR2Config extends R2Config {
  publicBucketName: string;
}

type R2LessonResource = LessonResourceUploadReference;

const requireEnvValue = (value: string | undefined, key: string): string => {
  if (!value) {
    throw new Error(`Configure ${key} para usar anexos R2.`);
  }

  return value;
};

const getR2Config = (): R2Config => {
  const env = getServerEnv();

  return {
    accessKeyId: requireEnvValue(env.R2_ACCESS_KEY_ID, "R2_ACCESS_KEY_ID"),
    accountId: requireEnvValue(env.R2_ACCOUNT_ID, "R2_ACCOUNT_ID"),
    bucketName: requireEnvValue(env.R2_BUCKET_NAME, "R2_BUCKET_NAME"),
    namespace: createR2ObjectNamespace(env.R2_OBJECT_PREFIX),
    secretAccessKey: requireEnvValue(
      env.R2_SECRET_ACCESS_KEY,
      "R2_SECRET_ACCESS_KEY"
    ),
  };
};

const getPublicR2Config = (): PublicR2Config => {
  const env = getServerEnv();

  return {
    ...getR2Config(),
    publicBucketName: requireEnvValue(
      env.R2_PUBLIC_BUCKET_NAME,
      "R2_PUBLIC_BUCKET_NAME"
    ),
  };
};

const getR2Client = (config: R2Config): S3Client => {
  const env = getServerEnv();
  const endpoint = resolveR2ClientEndpoint({
    accountId: config.accountId,
    e2eTestMode: env.E2E_TEST_MODE,
    ...(env.R2_ENDPOINT ? { endpointOverride: env.R2_ENDPOINT } : {}),
  });

  return new S3Client({
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    endpoint: endpoint.endpoint,
    forcePathStyle: endpoint.forcePathStyle,
    region: "auto",
  });
};

export const createLessonResourceUploadUrl = async ({
  contentType,
  fileName,
  lessonId,
  preview,
  sizeBytes,
}: {
  contentType: string;
  fileName: string;
  lessonId: string;
  preview?:
    | {
        contentType: "image/webp";
        height: number;
        sizeBytes: number;
        width: number;
      }
    | undefined;
  sizeBytes: number;
}): Promise<{
  expiresAt: string;
  resource: R2LessonResource;
  previewUploadUrl?: string;
  reference: R2LessonResource;
  uploadUrl: string;
}> => {
  validateLessonAttachmentUpload({ contentType, fileName, sizeBytes });
  if (preview) {
    validateLessonImagePreviewUpload(preview);
  }

  const nonce = randomUUID();
  const key = buildLessonResourceObjectKey({
    fileName,
    lessonId,
    nonce,
  });
  const previewKey = preview
    ? buildLessonResourcePreviewObjectKey({ lessonId, nonce })
    : null;
  const resource: R2LessonResource = {
    contentType,
    fileName,
    id: `resource-${randomUUID()}`,
    key,
    label: fileName,
    ...(preview && previewKey
      ? {
          preview: {
            contentType: preview.contentType,
            height: preview.height,
            key: previewKey,
            sizeBytes: preview.sizeBytes,
            width: preview.width,
          },
        }
      : {}),
    sizeBytes,
    storage: "r2",
  };
  const prepared = await createLessonResourceUploadUrlForReference({
    reference: resource,
  });

  return { ...prepared, resource };
};

export const createLessonResourceUploadUrlForReference = async ({
  reference,
}: {
  reference: R2LessonResource;
}): Promise<PreparedLessonResourceUpload> => {
  if (
    isPublishedLessonResourceKey(reference.key) ||
    (reference.preview && isPublishedLessonResourceKey(reference.preview.key))
  ) {
    throw new Error("Material publicado nao aceita uma URL de upload.");
  }
  validateLessonAttachmentUpload({
    contentType: reference.contentType,
    fileName: reference.fileName,
    sizeBytes: reference.sizeBytes,
  });
  if (reference.preview) {
    validateLessonImagePreviewUpload(reference.preview);
  }

  const config = getR2Config();
  const client = getR2Client(config);
  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: config.bucketName,
      IfNoneMatch: "*",
      Key: config.namespace.toPhysicalKey(reference.key),
    }),
    {
      expiresIn: R2_UPLOAD_URL_EXPIRES_SECONDS,
      signableHeaders: new Set(["if-none-match"]),
    }
  );
  const previewUploadUrl = reference.preview
    ? await getSignedUrl(
        client,
        new PutObjectCommand({
          Bucket: config.bucketName,
          IfNoneMatch: "*",
          Key: config.namespace.toPhysicalKey(reference.preview.key),
        }),
        {
          expiresIn: R2_UPLOAD_URL_EXPIRES_SECONDS,
          signableHeaders: new Set(["if-none-match"]),
        }
      )
    : undefined;
  const expiresAt = new Date(
    Date.now() + R2_UPLOAD_URL_EXPIRES_SECONDS * 1000
  ).toISOString();

  return {
    expiresAt,
    ...(previewUploadUrl ? { previewUploadUrl } : {}),
    reference,
    uploadUrl,
  };
};

const copyValidatedLessonResourceObject = async ({
  contentType,
  destinationKey,
  sizeBytes,
  sourceKey,
}: {
  contentType: string;
  destinationKey: string;
  sizeBytes: number;
  sourceKey: string;
}): Promise<void> => {
  const config = getR2Config();
  const client = getR2Client(config);
  const physicalSourceKey = config.namespace.toPhysicalKey(sourceKey);
  const source = await client.send(
    new HeadObjectCommand({
      Bucket: config.bucketName,
      Key: physicalSourceKey,
    })
  );
  if (
    source.ContentLength !== sizeBytes ||
    source.ContentType !== contentType ||
    !source.ETag
  ) {
    throw new Error("O material mudou antes da publicacao.");
  }
  await client.send(
    new CopyObjectCommand({
      Bucket: config.bucketName,
      CacheControl: PRIVATE_MEDIA_CACHE_CONTROL,
      ContentType: contentType,
      CopySource: `/${config.bucketName}/${encodeURIComponent(physicalSourceKey)}`,
      CopySourceIfMatch: source.ETag,
      Key: config.namespace.toPhysicalKey(destinationKey),
      MetadataDirective: "REPLACE",
    })
  );
  await confirmLessonResourceUpload({
    contentType,
    key: destinationKey,
    sizeBytes,
  });
};

export const copyLessonResourceForPublication = async ({
  destination,
  resource,
}: {
  destination: R2LessonResource;
  resource: R2LessonResource;
}): Promise<void> => {
  validateLessonAttachmentUpload(resource);
  if (
    !isPublishedLessonResourceKey(destination.key) ||
    destination.key === resource.key
  ) {
    throw new Error("Destino do material publicado invalido.");
  }
  if (resource.preview) {
    validateLessonImagePreviewUpload(resource.preview);
    if (
      !(
        destination.preview &&
        isPublishedLessonResourceKey(destination.preview.key)
      ) ||
      destination.preview.key === resource.preview.key
    ) {
      throw new Error("Destino do preview publicado invalido.");
    }
  } else if (destination.preview) {
    throw new Error("Preview publicado nao corresponde ao material preparado.");
  }
  await copyValidatedLessonResourceObject({
    contentType: resource.contentType,
    destinationKey: destination.key,
    sizeBytes: resource.sizeBytes,
    sourceKey: resource.key,
  });
  if (resource.preview && destination.preview) {
    await copyValidatedLessonResourceObject({
      contentType: resource.preview.contentType,
      destinationKey: destination.preview.key,
      sizeBytes: resource.preview.sizeBytes,
      sourceKey: resource.preview.key,
    });
  }
};

export const createStagedAdminImageUploadUrl = async ({
  actorUserId,
  aggregateId,
  contentType,
  fileName,
  purpose,
  sizeBytes,
}: {
  actorUserId: string;
  aggregateId: string;
  contentType: string;
  fileName: string;
  purpose: StagedAdminImagePurpose;
  sizeBytes: number;
}): Promise<{
  reference: StagedAdminImageReference;
  uploadUrl: string;
}> => {
  const reference = buildStagedAdminImageUpload({
    actorUserId,
    aggregateId,
    contentType,
    fileName,
    nonce: randomUUID(),
    purpose,
    sizeBytes,
  });
  const config = getR2Config();
  const uploadUrl = await getSignedUrl(
    getR2Client(config),
    new PutObjectCommand({
      Bucket: config.bucketName,
      ContentType: reference.contentType,
      Key: config.namespace.toPhysicalKey(reference.key),
    }),
    {
      expiresIn: R2_UPLOAD_URL_EXPIRES_SECONDS,
      signableHeaders: new Set(["content-type"]),
    }
  );

  return { reference, uploadUrl };
};

export const uploadStagedAdminImageFile = async ({
  actorUserId,
  file,
  reference,
}: {
  actorUserId: string;
  file: File;
  reference: StagedAdminImageReference;
}): Promise<void> => {
  assertStagedAdminImageOwnership({
    actorUserId,
    aggregateId: reference.aggregateId,
    purpose: reference.purpose,
    reference,
  });

  if (
    file.size !== reference.sizeBytes ||
    file.type !== reference.contentType
  ) {
    throw new Error("O arquivo enviado nao corresponde ao upload preparado.");
  }

  const config = getR2Config();
  await getR2Client(config).send(
    new PutObjectCommand({
      Body: Buffer.from(await file.arrayBuffer()),
      Bucket: config.bucketName,
      ContentType: reference.contentType,
      Key: config.namespace.toPhysicalKey(reference.key),
    })
  );
};

export const readStagedAdminImageFile = async ({
  actorUserId,
  aggregateId,
  purpose,
  reference,
}: {
  actorUserId: string;
  aggregateId: string;
  purpose: StagedAdminImagePurpose;
  reference: StagedAdminImageReference;
}): Promise<File> => {
  assertStagedAdminImageOwnership({
    actorUserId,
    aggregateId,
    purpose,
    reference,
  });

  const etag = await verifyStagedAdminImageObject(reference);

  const config = getR2Config();
  const client = getR2Client(config);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const object = await client.send(
      new GetObjectCommand({
        Bucket: config.bucketName,
        IfMatch: etag,
        Key: config.namespace.toPhysicalKey(reference.key),
      }),
      { abortSignal: controller.signal }
    );
    if (!object.Body) {
      throw new Error("O arquivo temporario nao esta disponivel.");
    }
    const stream = object.Body.transformToWebStream();
    if (
      object.ETag !== etag ||
      object.ContentLength !== reference.sizeBytes ||
      object.ContentType !== reference.contentType
    ) {
      stream.cancel().catch(() => undefined);
      throw new Error("O arquivo enviado nao corresponde ao upload preparado.");
    }
    const body = await readBoundedBody(stream, reference.sizeBytes);
    if (body.byteLength !== reference.sizeBytes) {
      throw new Error("O arquivo enviado nao corresponde ao upload preparado.");
    }
    return new File([body.buffer], reference.fileName, {
      type: reference.contentType,
    });
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
};

export const verifyStagedAdminImageObject = async (
  reference: StagedAdminImageReference
): Promise<string> => {
  // Revalidate even references constructed outside the JSON parser.
  buildStagedAdminImageUpload({
    actorUserId: reference.key.split("/")[2] ?? "",
    aggregateId: reference.aggregateId,
    contentType: reference.contentType,
    fileName: reference.fileName,
    nonce: "validation",
    purpose: reference.purpose,
    sizeBytes: reference.sizeBytes,
  });
  const config = getR2Config();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const objectHead = await getR2Client(config).send(
      new HeadObjectCommand({
        Bucket: config.bucketName,
        Key: config.namespace.toPhysicalKey(reference.key),
      }),
      { abortSignal: controller.signal }
    );
    if (
      objectHead.ContentLength !== reference.sizeBytes ||
      objectHead.ContentType !== reference.contentType ||
      !objectHead.ETag
    ) {
      throw new Error("O arquivo enviado nao corresponde ao upload preparado.");
    }
    return objectHead.ETag;
  } finally {
    clearTimeout(timer);
  }
};

export const createLessonResourceDownloadUrl = async ({
  fileName,
  key,
}: {
  fileName: string;
  key: string;
}): Promise<string> => {
  const config = getR2Config();
  const client = getR2Client(config);

  await client.send(
    new HeadObjectCommand({
      Bucket: config.bucketName,
      Key: config.namespace.toPhysicalKey(key),
    })
  );

  return await getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: config.bucketName,
      Key: config.namespace.toPhysicalKey(key),
      ResponseContentDisposition: `attachment; filename="${fileName.replaceAll('"', "")}"`,
    }),
    { expiresIn: DOWNLOAD_URL_EXPIRES_SECONDS }
  );
};

export const uploadCourseCoverFile = async ({
  courseId,
  file,
}: {
  courseId: string;
  file: CourseCoverFile;
}): Promise<CourseCoverImage> => {
  const { createCourseCoverUploadParts } = await import(
    "@/features/storage/course-cover-upload"
  );
  const { coverImage, objects } = await createCourseCoverUploadParts({
    courseId,
    file,
    nonce: randomUUID(),
  });
  const config = getR2Config();
  const client = getR2Client(config);

  for (const object of objects) {
    await client.send(
      new PutObjectCommand({
        Body: object.body,
        Bucket: config.bucketName,
        CacheControl: PRIVATE_MEDIA_CACHE_CONTROL,
        ContentType: object.contentType,
        Key: config.namespace.toPhysicalKey(object.key),
      })
    );
  }

  return coverImage;
};

export const createR2ObjectReadUrl = async ({
  key,
  responseContentDisposition,
  responseCacheControl,
}: {
  key: string;
  responseContentDisposition?: "attachment" | "inline";
  responseCacheControl?: string;
}): Promise<string> => {
  const config = getR2Config();

  return await getSignedUrl(
    getR2Client(config),
    new GetObjectCommand({
      Bucket: config.bucketName,
      Key: config.namespace.toPhysicalKey(key),
      ...(responseCacheControl
        ? { ResponseCacheControl: responseCacheControl }
        : {}),
      ...(responseContentDisposition
        ? { ResponseContentDisposition: responseContentDisposition }
        : {}),
    }),
    { expiresIn: DOWNLOAD_URL_EXPIRES_SECONDS }
  );
};

export const uploadPrivateR2Object = async ({
  body,
  contentType,
  key,
}: {
  body: Buffer;
  contentType: string;
  key: string;
}): Promise<void> => {
  const config = getR2Config();
  await getR2Client(config).send(
    new PutObjectCommand({
      Body: body,
      Bucket: config.bucketName,
      CacheControl: PRIVATE_MEDIA_CACHE_CONTROL,
      ContentType: contentType,
      Key: config.namespace.toPhysicalKey(key),
    })
  );
};

const isPreconditionFailed = (error: unknown): boolean => {
  if (!(error instanceof Object && "$metadata" in error)) {
    return false;
  }
  const metadata = error.$metadata;
  return (
    metadata instanceof Object &&
    "httpStatusCode" in metadata &&
    metadata.httpStatusCode === 412
  );
};

export const uploadPrivateR2ObjectIfAbsent = async ({
  body,
  contentType,
  key,
  metadata,
}: {
  body: Buffer;
  contentType: string;
  key: string;
  metadata?: Record<string, string>;
}): Promise<"created" | "existing"> => {
  const config = getR2Config();
  try {
    await getR2Client(config).send(
      new PutObjectCommand({
        Body: body,
        Bucket: config.bucketName,
        ContentType: contentType,
        IfNoneMatch: "*",
        Key: config.namespace.toPhysicalKey(key),
        ...(metadata ? { Metadata: metadata } : {}),
      })
    );
    return "created";
  } catch (error) {
    if (isPreconditionFailed(error)) {
      return "existing";
    }
    throw error;
  }
};

export type PrivateR2ObjectHashStatus =
  | "match"
  | "mismatch"
  | "missing"
  | "unknown"
  | "unavailable";

const isNotFoundError = (error: unknown): boolean => {
  if (!(error instanceof Object && "$metadata" in error)) {
    return false;
  }
  const metadata = error.$metadata;
  return (
    metadata instanceof Object &&
    "httpStatusCode" in metadata &&
    metadata.httpStatusCode === 404
  );
};

export const verifyPrivateR2ObjectSha256 = async ({
  expectedSha256,
  key,
}: {
  expectedSha256: string;
  key: string;
}): Promise<PrivateR2ObjectHashStatus> => {
  try {
    const config = getR2Config();
    const objectHead = await getR2Client(config).send(
      new HeadObjectCommand({
        Bucket: config.bucketName,
        Key: config.namespace.toPhysicalKey(key),
      })
    );

    const metadataHash = Object.entries(objectHead.Metadata ?? {}).find(
      ([name]) => name.toLowerCase() === "sha256"
    )?.[1];
    if (!metadataHash) {
      return "unknown";
    }

    return metadataHash.toLowerCase() === expectedSha256.toLowerCase()
      ? "match"
      : "mismatch";
  } catch (error) {
    return isNotFoundError(error) ? "missing" : "unavailable";
  }
};

export const getPublicMediaUrl = (key: string): string => {
  const config = getR2Config();
  return buildPublicMediaUrl({
    baseUrl: requireEnvValue(
      getServerEnv().R2_PUBLIC_BASE_URL,
      "R2_PUBLIC_BASE_URL"
    ),
    key,
    physicalKey: config.namespace.toPhysicalKey(key),
  });
};

export interface R2ObjectSummary {
  key: string;
  lastModified: Date;
}

const listR2Objects = async ({
  bucketName,
  config,
  logicalPrefix,
}: {
  bucketName: string;
  config: R2Config;
  logicalPrefix: string;
}): Promise<R2ObjectSummary[]> => {
  const objects: R2ObjectSummary[] = [];
  const client = getR2Client(config);
  let continuationToken: string | undefined;

  do {
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        ContinuationToken: continuationToken,
        Prefix: config.namespace.toPhysicalPrefix(logicalPrefix),
      })
    );

    for (const object of page.Contents ?? []) {
      if (!(object.Key && object.LastModified)) {
        continue;
      }
      objects.push({
        key: config.namespace.toLogicalKey(object.Key),
        lastModified: object.LastModified,
      });
    }

    continuationToken = page.IsTruncated
      ? page.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return objects;
};

export const listPrivateR2Objects = async (
  logicalPrefix: string
): Promise<R2ObjectSummary[]> => {
  const config = getR2Config();
  return await listR2Objects({
    bucketName: config.bucketName,
    config,
    logicalPrefix,
  });
};

export const listPublicR2Objects = async (
  logicalPrefix: string
): Promise<R2ObjectSummary[]> => {
  const config = getPublicR2Config();
  return await listR2Objects({
    bucketName: config.publicBucketName,
    config,
    logicalPrefix,
  });
};

export const checkR2ObjectStorage = async (): Promise<void> => {
  const config = getR2Config();
  const client = getR2Client(config);
  const key = `diagnostics/health/${randomUUID()}.txt`;
  const physicalKey = config.namespace.toPhysicalKey(key);

  try {
    await client.send(
      new PutObjectCommand({
        Body: Buffer.from("r2-healthcheck"),
        Bucket: config.bucketName,
        ContentType: "text/plain",
        Key: physicalKey,
      })
    );
    await client.send(
      new HeadObjectCommand({
        Bucket: config.bucketName,
        Key: physicalKey,
      })
    );
  } finally {
    await client
      .send(
        new DeleteObjectsCommand({
          Bucket: config.bucketName,
          Delete: {
            Objects: [{ Key: physicalKey }],
            Quiet: true,
          },
        })
      )
      .catch(() => undefined);
  }
};

export const publishR2Object = async (key: string): Promise<void> => {
  assertPublicMediaKey(key);
  const config = getPublicR2Config();
  const physicalKey = config.namespace.toPhysicalKey(key);
  const client = getR2Client(config);
  const sourceMetadata = await client.send(
    new HeadObjectCommand({
      Bucket: config.bucketName,
      Key: physicalKey,
    })
  );

  await client.send(
    new CopyObjectCommand({
      Bucket: config.publicBucketName,
      CacheControl: PUBLIC_VERSIONED_MEDIA_CACHE_CONTROL,
      CopySource: `/${config.bucketName}/${encodeURIComponent(physicalKey)}`,
      ContentDisposition: sourceMetadata.ContentDisposition,
      ContentEncoding: sourceMetadata.ContentEncoding,
      ContentLanguage: sourceMetadata.ContentLanguage,
      ContentType: sourceMetadata.ContentType ?? "application/octet-stream",
      Expires: sourceMetadata.Expires,
      Key: physicalKey,
      Metadata: sourceMetadata.Metadata,
      MetadataDirective: "REPLACE",
    })
  );
};

export const confirmLessonResourceUpload = async ({
  contentType,
  key,
  sizeBytes,
}: {
  contentType: string;
  key: string;
  sizeBytes: number;
}): Promise<void> => {
  const config = getR2Config();
  const object = await getR2Client(config).send(
    new HeadObjectCommand({
      Bucket: config.bucketName,
      Key: config.namespace.toPhysicalKey(key),
    })
  );

  if (
    object.ContentLength !== sizeBytes ||
    object.ContentType !== contentType
  ) {
    throw new Error("O arquivo enviado não corresponde ao material preparado.");
  }
};

const chunkKeys = (keys: string[]): string[][] => {
  const chunks: string[][] = [];

  for (let index = 0; index < keys.length; index += DELETE_OBJECTS_BATCH_SIZE) {
    chunks.push(keys.slice(index, index + DELETE_OBJECTS_BATCH_SIZE));
  }

  return chunks;
};

export const deleteR2Objects = async (keys: string[]): Promise<void> => {
  const uniqueKeys = Array.from(new Set(keys.filter(Boolean)));

  if (uniqueKeys.length === 0) {
    return;
  }

  const config = getR2Config();
  const client = getR2Client(config);

  for (const keyBatch of chunkKeys(uniqueKeys)) {
    const result = await client.send(
      new DeleteObjectsCommand({
        Bucket: config.bucketName,
        Delete: {
          Objects: keyBatch.map((key) => ({
            Key: config.namespace.toPhysicalKey(key),
          })),
          Quiet: true,
        },
      })
    );

    if (result.Errors?.length) {
      throw new Error("Nao foi possivel apagar arquivos do R2.");
    }
  }
};

const USER_AVATAR_PREFIX = "user-avatars";
const SAFE_AVATAR_OWNER_PATTERN = /^[A-Za-z0-9_-]{1,200}$/;
const SAFE_AVATAR_FILE_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/i;

const assertUserAvatarObjectKey = ({
  key,
  userId,
}: {
  key: string;
  userId: string;
}): void => {
  if (
    !(
      SAFE_AVATAR_OWNER_PATTERN.test(userId) &&
      key.startsWith(`${USER_AVATAR_PREFIX}/${userId}/`) &&
      SAFE_AVATAR_FILE_PATTERN.test(key.split("/").at(-1) ?? "")
    )
  ) {
    throw new Error("Avatar privado inválido.");
  }
};

export const uploadPrivateUserAvatarObject = async ({
  body,
  key,
  userId,
}: {
  body: Buffer;
  key: string;
  userId: string;
}): Promise<void> => {
  assertUserAvatarObjectKey({ key, userId });
  const config = getR2Config();
  await getR2Client(config).send(
    new PutObjectCommand({
      Body: body,
      Bucket: config.bucketName,
      CacheControl: "private, no-store",
      ContentType: "image/webp",
      Key: config.namespace.toPhysicalKey(key),
    })
  );
};

export const readPrivateUserAvatarObject = async ({
  key,
  userId,
}: {
  key: string;
  userId: string;
}): Promise<Buffer | null> => {
  assertUserAvatarObjectKey({ key, userId });
  const config = getR2Config();
  const object = await getR2Client(config).send(
    new GetObjectCommand({
      Bucket: config.bucketName,
      Key: config.namespace.toPhysicalKey(key),
    })
  );
  if (!object.Body) {
    return null;
  }
  return Buffer.from(await object.Body.transformToByteArray());
};

export const deletePrivateUserAvatarObject = async ({
  key,
  userId,
}: {
  key: string;
  userId: string;
}): Promise<void> => {
  assertUserAvatarObjectKey({ key, userId });
  await deleteR2Objects([key]);
};

export const deletePublicR2Objects = async (keys: string[]): Promise<void> => {
  const uniqueKeys = Array.from(new Set(keys.filter(Boolean)));

  if (uniqueKeys.length === 0) {
    return;
  }

  const config = getPublicR2Config();
  const client = getR2Client(config);

  for (const keyBatch of chunkKeys(uniqueKeys)) {
    await client.send(
      new DeleteObjectsCommand({
        Bucket: config.publicBucketName,
        Delete: {
          Objects: keyBatch.map((key) => ({
            Key: config.namespace.toPhysicalKey(key),
          })),
          Quiet: true,
        },
      })
    );
  }
};

export const deleteExpiredStagedAdminImages = async ({
  olderThan,
  shouldContinue = async () => true,
}: {
  olderThan: Date;
  shouldContinue?: () => Promise<boolean>;
}): Promise<number> => {
  const config = getR2Config();
  const client = getR2Client(config);
  let continuationToken: string | undefined;
  let removed = 0;

  do {
    if (!(await shouldContinue())) {
      break;
    }
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: config.bucketName,
        ContinuationToken: continuationToken,
        Prefix: config.namespace.toPhysicalPrefix(
          `${STAGED_ADMIN_IMAGE_PREFIX}/`
        ),
      })
    );
    const expiredKeys = (page.Contents ?? [])
      .filter(
        (object) =>
          object.Key &&
          object.LastModified &&
          object.LastModified.getTime() < olderThan.getTime()
      )
      .map((object) => config.namespace.toLogicalKey(object.Key as string));

    if (expiredKeys.length > 0) {
      if (!(await shouldContinue())) {
        break;
      }
      await deleteR2Objects(expiredKeys);
      removed += expiredKeys.length;
    }
    continuationToken = page.IsTruncated
      ? page.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return removed;
};

export const uploadDashboardBannerFile = async ({
  file,
}: {
  file: File;
}): Promise<{ blurDataUrl: string; key: string }> => {
  const { createBannerBlurDataUrl, validateBannerImageFile } = await import(
    "@/features/storage/banner-upload"
  );
  await validateBannerImageFile(file);
  const config = getR2Config();
  const client = getR2Client(config);

  const [blurDataUrl, buffer] = await Promise.all([
    createBannerBlurDataUrl(file),
    file.arrayBuffer(),
  ]);
  const extension = file.name.split(".").pop()?.toLowerCase() || "webp";
  const key = `${BANNER_STORAGE_PREFIX}${randomUUID()}.${extension}`;

  await client.send(
    new PutObjectCommand({
      Body: Buffer.from(buffer),
      Bucket: config.bucketName,
      CacheControl: PRIVATE_MEDIA_CACHE_CONTROL,
      ContentType: file.type,
      Key: config.namespace.toPhysicalKey(key),
    })
  );

  return { blurDataUrl, key };
};

export const uploadAuthMediaFile = async ({
  file,
  slideId,
}: {
  file: File;
  slideId: string;
}): Promise<{ blurDataUrl: string; key: string }> => {
  const { createAuthMediaBlurDataUrl, validateAuthMediaImageFile } =
    await import("@/features/storage/auth-media-image");
  const key = buildAuthMediaObjectKey(slideId, randomUUID());
  await validateAuthMediaImageFile(file);
  const [blurDataUrl, buffer] = await Promise.all([
    createAuthMediaBlurDataUrl(file),
    file.arrayBuffer(),
  ]);
  const config = getR2Config();

  await getR2Client(config).send(
    new PutObjectCommand({
      Body: Buffer.from(buffer),
      Bucket: config.bucketName,
      CacheControl: PRIVATE_MEDIA_CACHE_CONTROL,
      ContentType: "image/webp",
      Key: config.namespace.toPhysicalKey(key),
    })
  );

  return { blurDataUrl, key };
};
