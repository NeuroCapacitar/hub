import "server-only";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";

export const CERTIFICATE_CODE_RANDOM_BYTE_LENGTH = 16;

export const encodeCertificateCode = (bytes: Uint8Array): string => {
  if (bytes.byteLength !== CERTIFICATE_CODE_RANDOM_BYTE_LENGTH) {
    throw new RangeError("Certificate codes require exactly 16 random bytes.");
  }

  return Buffer.from(bytes).toString("base64url");
};

export const hashCertificateVerificationCode = (code: string): string =>
  createHash("sha256").update(code).digest("hex");
