import type { CertificateImageKind } from "./template-image-contract";

const TEMPLATE_IMAGE_FILENAME =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:webp|png|jpg)$/;
const COURSE_KEY_SEGMENT = /^[^/\\.]+$/;

export const isCertificateTemplateAssetKey = ({
  courseId,
  key,
  kind,
}: {
  courseId: string;
  key: string;
  kind: CertificateImageKind;
}): boolean => {
  if (!COURSE_KEY_SEGMENT.test(courseId)) {
    return false;
  }
  const prefix = `certificates/templates/${courseId}/${kind === "signature" ? "signatures/" : ""}`;
  const filename = key.slice(prefix.length);
  return (
    key.startsWith(prefix) &&
    filename === filename.trim() &&
    TEMPLATE_IMAGE_FILENAME.test(filename)
  );
};
