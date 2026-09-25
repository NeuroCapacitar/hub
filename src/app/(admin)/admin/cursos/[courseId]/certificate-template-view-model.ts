export type CertificateEditorStatusTone = "default" | "outline" | "secondary";

export interface CertificateEditorStatus {
  label: string;
  tone: CertificateEditorStatusTone;
}

export const getCertificateEditorStatus = ({
  certificateEnabled,
  hasDraft,
  hasPublished,
  signatoryConfigured,
}: {
  certificateEnabled: boolean;
  hasDraft: boolean;
  hasPublished: boolean;
  signatoryConfigured: boolean;
}): CertificateEditorStatus => {
  if (certificateEnabled && !(hasPublished && signatoryConfigured)) {
    return { label: "Configuração incompleta", tone: "outline" };
  }
  if (certificateEnabled && hasDraft) {
    return { label: "Ativo + alterações", tone: "outline" };
  }
  if (certificateEnabled) {
    return { label: "Ativo", tone: "default" };
  }
  if (hasDraft) {
    return { label: "Rascunho", tone: "secondary" };
  }
  return { label: "Desligado", tone: "secondary" };
};
