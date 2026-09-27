export const CERTIFICATE_RENDER_CLAIM_LEASE_MINUTES = 10;
export const REVOKED_CERTIFICATE_DATA_RETENTION_DAYS = 60;

export const canIssueCertificate = ({
  totalLessons,
  completedLessons,
}: {
  totalLessons: number;
  completedLessons: number;
}): boolean => totalLessons > 0 && completedLessons >= totalLessons;

export const getCertificateValidationPath = (code: string): string =>
  `/certificados/${encodeURIComponent(code)}`;
