import { describe, expect, it } from "vitest";
import {
  getAdminAuditActionLabel,
  hasAdminAuditActionLabel,
} from "./audit-presentation";

describe("certificate artifact purge audit label", () => {
  it("presents retention cleanup as a recognized certificate audit action", () => {
    expect(getAdminAuditActionLabel("certificate.artifact_purged")).toBe(
      "Artefato do Certificado removido"
    );
    expect(hasAdminAuditActionLabel("certificate.artifact_purged")).toBe(true);
  });
});
