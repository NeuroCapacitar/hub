import {
  Alert02Icon,
  Certificate01Icon,
  Loading02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { CertificateListViewModel } from "./certificate-list-view-model";
import { CertificatePreviewThumbnail } from "./certificate-preview-thumbnail";

const getUnavailableMedia = (
  kind: Exclude<CertificateListViewModel["kind"], "available">
): { icon: typeof Certificate01Icon; label: string } => {
  if (kind === "preparing") {
    return { icon: Loading02Icon, label: "Prévia em preparo" };
  }

  if (kind === "failed") {
    return { icon: Alert02Icon, label: "Prévia indisponível" };
  }

  return { icon: Certificate01Icon, label: "Certificado revogado" };
};

export function CertificateCardMedia({
  kind,
  previewHref,
}: {
  kind: CertificateListViewModel["kind"];
  previewHref: string;
}): React.JSX.Element {
  if (kind === "available") {
    return <CertificatePreviewThumbnail previewHref={previewHref} />;
  }

  const media = getUnavailableMedia(kind);

  return (
    <div
      aria-hidden="true"
      className="flex h-full min-h-[10rem] w-full flex-col items-center justify-center gap-3 px-4 text-center text-muted-foreground"
      data-certificate-preview-slot={kind}
    >
      <HugeiconsIcon
        aria-hidden="true"
        className="text-muted-foreground/80"
        icon={media.icon}
        size={36}
        strokeWidth={1.35}
      />
      <span className="type-label">{media.label}</span>
    </div>
  );
}
