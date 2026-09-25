import type { CertificateField } from "@/features/certificates/template-rules";

export type CertificateFieldGroupId =
  | "automatic"
  | "issuer"
  | "signature"
  | "validation";

export interface CertificateFieldMetadata {
  description: string;
  group: CertificateFieldGroupId;
  label: string;
  source: "course" | "emission" | "issuer" | "template" | "validation";
}

export interface CertificateFieldGroup {
  description: string;
  fields: readonly CertificateField[];
  id: CertificateFieldGroupId;
  label: string;
}

export const certificateFieldMetadata: Record<
  CertificateField,
  CertificateFieldMetadata
> = {
  studentName: {
    description: "Nome do aluno conforme o perfil no momento da emissão.",
    group: "automatic",
    label: "Nome no certificado",
    source: "emission",
  },
  courseTitle: {
    description: "Título publicado do curso.",
    group: "automatic",
    label: "Título do curso",
    source: "course",
  },
  workloadHours: {
    description: "Carga horária efetiva definida na configuração do curso.",
    group: "automatic",
    label: "Carga horária",
    source: "course",
  },
  completedAt: {
    description: "Data em que o aluno concluiu os requisitos.",
    group: "automatic",
    label: "Data de conclusão",
    source: "emission",
  },
  issuedAt: {
    description: "Data em que o certificado foi emitido.",
    group: "automatic",
    label: "Data de emissão",
    source: "emission",
  },
  issuerName: {
    description: "Nome da organização configurado no perfil emissor.",
    group: "issuer",
    label: "Nome do emissor",
    source: "issuer",
  },
  issuerCnpj: {
    description: "CNPJ informado no perfil emissor.",
    group: "issuer",
    label: "CNPJ do emissor",
    source: "issuer",
  },
  signerName: {
    description:
      "Nome definido em Configurações do curso; obrigatório para publicar.",
    group: "signature",
    label: "Nome do signatário",
    source: "course",
  },
  signerRole: {
    description:
      "Cargo definido em Configurações do curso; obrigatório para publicar.",
    group: "signature",
    label: "Cargo do signatário",
    source: "course",
  },
  signatureImage: {
    description: "Imagem visual opcional mantida neste modelo de certificado.",
    group: "signature",
    label: "Assinatura visual",
    source: "template",
  },
  validationCode: {
    description: "Código único usado para consultar a autenticidade.",
    group: "validation",
    label: "Código de validação",
    source: "validation",
  },
  qrCode: {
    description: "QR Code que aponta para a página de validação.",
    group: "validation",
    label: "QR de validação",
    source: "validation",
  },
};

export const certificateFieldGroups: readonly CertificateFieldGroup[] = [
  {
    description: "Preenchidos automaticamente a partir do curso e da emissão.",
    fields: [
      "studentName",
      "courseTitle",
      "workloadHours",
      "completedAt",
      "issuedAt",
    ],
    id: "automatic",
    label: "Dados automáticos",
  },
  {
    description: "Dados da organização que emite o certificado.",
    fields: ["issuerName", "issuerCnpj"],
    id: "issuer",
    label: "Emissor",
  },
  {
    description:
      "Nome e cargo vêm das Configurações do curso; a imagem é definida no modelo.",
    fields: ["signerName", "signerRole", "signatureImage"],
    id: "signature",
    label: "Assinatura",
  },
  {
    description: "Elementos usados para verificar autenticidade.",
    fields: ["validationCode", "qrCode"],
    id: "validation",
    label: "Validação",
  },
];

export const getCertificateFieldMetadata = (
  field: CertificateField
): CertificateFieldMetadata => certificateFieldMetadata[field];
