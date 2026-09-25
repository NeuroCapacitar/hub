import "server-only";
import { Buffer } from "node:buffer";

export const CERTIFICATE_CODE_RANDOM_BYTE_LENGTH = 16;

export const encodeCertificateCode = (bytes: Uint8Array): string => {
  if (bytes.byteLength !== CERTIFICATE_CODE_RANDOM_BYTE_LENGTH) {
    throw new RangeError("Certificate codes require exactly 16 random bytes.");
  }

  return Buffer.from(bytes).toString("base64url");
};
