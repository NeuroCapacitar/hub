import type { PoolClient } from "pg";
import { isCertificateTemplateAssetKey as isCataloguedTemplateAssetKey } from "./template-asset-key";
import { CertificateTemplateDomainError } from "./template-errors";

export type CertificateTemplateAsset = "background" | "signature";

export const isCertificateTemplateAssetKey = ({
  asset,
  courseId,
  key,
}: {
  asset: CertificateTemplateAsset;
  courseId: string;
  key: string;
}): boolean => isCataloguedTemplateAssetKey({ courseId, key, kind: asset });

export const assertCertificateTemplateAssetNamespace = ({
  backgroundKey,
  courseId,
  signatureKey,
}: {
  backgroundKey: string;
  courseId: string;
  signatureKey: string | null;
}): void => {
  if (
    !isCertificateTemplateAssetKey({
      asset: "background",
      courseId,
      key: backgroundKey,
    }) ||
    (signatureKey !== null &&
      !isCertificateTemplateAssetKey({
        asset: "signature",
        courseId,
        key: signatureKey,
      }))
  ) {
    throw new CertificateTemplateDomainError(
      "A imagem não pertence ao template deste Curso."
    );
  }
};

export const assertCertificateTemplateAssetOwnership = async ({
  backgroundKey,
  client,
  courseId,
  signatureKey,
  uploadedAssetKeys,
}: {
  backgroundKey: string;
  client: Pick<PoolClient, "query">;
  courseId: string;
  signatureKey: string | null;
  uploadedAssetKeys: readonly string[];
}): Promise<void> => {
  const references: Array<{ asset: CertificateTemplateAsset; key: string }> = [
    { asset: "background", key: backgroundKey },
  ];
  if (signatureKey !== null) {
    references.push({ asset: "signature", key: signatureKey });
  }
  assertCertificateTemplateAssetNamespace({
    backgroundKey,
    courseId,
    signatureKey,
  });

  const preserved = references.filter(
    ({ key }) => !uploadedAssetKeys.includes(key)
  );
  if (preserved.length === 0) {
    return;
  }
  const existing = await client.query<{
    background_key: string;
    signature_key: string | null;
  }>(
    `select background_key, signature_key
     from certificate_templates
     where course_id = $1
     for share`,
    [courseId]
  );
  for (const { asset, key } of preserved) {
    const owned = existing.rows.some((template) =>
      asset === "background"
        ? template.background_key === key
        : template.signature_key === key
    );
    if (!owned) {
      throw new CertificateTemplateDomainError(
        "Envie a imagem antes de salvar o template deste Curso."
      );
    }
  }
};
