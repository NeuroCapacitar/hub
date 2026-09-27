import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  deleteR2Objects: vi.fn(),
  getPool: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));
vi.mock("@/features/storage/r2", () => ({
  deleteR2Objects: dependencies.deleteR2Objects,
}));

import {
  purgeRevokedCertificatePreview,
  reconcileRevokedCertificateArtifacts,
} from "./artifact-reconciliation";

describe("purgeRevokedCertificatePreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes a revoked preview and records its purge", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [{ preview_purged_at: null, status: "revoked" }],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ target_id: "certificate-1" }],
      });
    dependencies.getPool.mockReturnValue({ query });
    dependencies.deleteR2Objects.mockResolvedValue(undefined);

    await expect(
      purgeRevokedCertificatePreview({
        actorUserId: "admin-1",
        certificateId: "certificate-1",
      })
    ).resolves.toBe(true);

    expect(dependencies.deleteR2Objects).toHaveBeenCalledWith([
      "certificates/certificate-1/certificate-preview.png",
    ]);
    expect(query.mock.calls[1]?.[0]).toContain("preview_sha256 = null");
    expect(query.mock.calls[1]?.[0]).toContain("preview_purged_at = now()");
    expect(query.mock.calls[1]?.[0]).toContain("certificate.artifact_purged");
    expect(query.mock.calls[1]?.[1]).toEqual(["certificate-1", "admin-1"]);
  });

  it("does not delete a preview while its certificate is valid", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ preview_purged_at: null, status: "valid" }],
    });
    dependencies.getPool.mockReturnValue({ query });

    await expect(
      purgeRevokedCertificatePreview({ certificateId: "certificate-1" })
    ).resolves.toBe(false);

    expect(dependencies.deleteR2Objects).not.toHaveBeenCalled();
  });
});

describe("reconcileRevokedCertificateArtifacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clears stale revoked claims and deletes only twice-verified orphan keys", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "certificate-1" }] })
      .mockResolvedValueOnce({ rows: [{ id: "certificate-1" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    dependencies.getPool.mockReturnValue({ query });
    dependencies.deleteR2Objects.mockResolvedValue(undefined);

    await expect(reconcileRevokedCertificateArtifacts()).resolves.toBe(1);

    expect(query.mock.calls[0]?.[0]).toContain("status = 'revoked'");
    expect(query.mock.calls[0]?.[0]).toContain("render_claimed_at < now()");
    expect(query.mock.calls[2]?.[0]).toContain("pdf_storage_key is null");
    expect(query.mock.calls[2]?.[0]).toContain(
      "render_status in ('pending', 'failed')"
    );
    expect(query.mock.calls[2]?.[0]).toContain("message.status = 'processing'");
    expect(query.mock.calls[2]?.[0]).toContain(
      "certificate.artifact_reconciled"
    );
    expect(query.mock.calls[3]?.[0]).toContain("certificate.id = $1");
    expect(dependencies.deleteR2Objects).toHaveBeenCalledWith([
      "certificates/certificate-1/certificate.pdf",
    ]);
    expect(query.mock.calls[3]?.[0]).toContain(
      "certificate.artifact_reconciled"
    );
  });

  it("does not delete when the final database verification no longer qualifies", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "certificate-1" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    dependencies.getPool.mockReturnValue({ query });

    await expect(reconcileRevokedCertificateArtifacts()).resolves.toBe(0);
    expect(dependencies.deleteR2Objects).not.toHaveBeenCalled();
  });

  it("purges all revoked certificate data after 60 days and retains only a code-hash tombstone", async () => {
    const revokedAt = new Date("2026-07-20T12:00:00.000Z");
    const certificate = {
      code: "PRT-REVOKED-CODE",
      id: "certificate-1",
      pdf_storage_key: "certificates/certificate-1/certificate.pdf",
      revoked_at: revokedAt,
    };
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [certificate] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: certificate.id }] });
    const transactionQuery = vi.fn((statement: string, _values?: unknown[]) => {
      if (
        statement.includes("from certificates") &&
        statement.includes("for update")
      ) {
        return { rows: [certificate] };
      }
      if (statement.includes("from outbox_messages")) {
        return { rows: [] };
      }
      return { rowCount: 1, rows: [] };
    });
    const client = { query: transactionQuery, release: vi.fn() };
    dependencies.getPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue(client),
      query,
    });
    dependencies.deleteR2Objects.mockResolvedValue(undefined);

    await expect(reconcileRevokedCertificateArtifacts()).resolves.toBe(1);

    expect(query.mock.calls[3]?.[0]).toContain(
      "revoked_at <= now() - ($2 * interval '1 day')"
    );
    expect(query.mock.calls[3]?.[0]).toContain("preview_purged_at is not null");
    expect(query.mock.calls[3]?.[1]).toEqual([100, 60]);
    expect(query.mock.calls[4]?.[0]).toContain("pdf_storage_key = null");
    expect(query.mock.calls[4]?.[0]).toContain("pdf_sha256 = null");
    expect(dependencies.deleteR2Objects).toHaveBeenCalledWith([
      "certificates/certificate-1/certificate.pdf",
    ]);

    const tombstoneInsert = transactionQuery.mock.calls.find(([statement]) =>
      statement.includes("insert into certificate_revocation_tombstones")
    );
    expect(tombstoneInsert?.[1]).toEqual([
      createHash("sha256").update(certificate.code).digest("hex"),
      revokedAt,
    ]);
    expect(
      transactionQuery.mock.calls.some(([statement]) =>
        statement.includes("delete from audit_logs")
      )
    ).toBe(true);
    expect(
      transactionQuery.mock.calls.some(([statement]) =>
        statement.includes("delete from outbox_messages")
      )
    ).toBe(true);
    expect(
      transactionQuery.mock.calls.some(([statement]) =>
        statement.includes("delete from certificates")
      )
    ).toBe(true);
  });

  it("does not purge the certificate row while a certificate outbox message is processing", async () => {
    const certificate = {
      code: "PRT-REVOKED-CODE",
      id: "certificate-1",
      pdf_storage_key: "certificates/certificate-1/certificate.pdf",
      revoked_at: new Date("2026-07-20T12:00:00.000Z"),
    };
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [certificate] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: certificate.id }] });
    const transactionQuery = vi.fn((statement: string) => {
      if (statement === "begin" || statement === "rollback") {
        return { rowCount: 0, rows: [] };
      }
      if (
        statement.includes("from certificates") &&
        statement.includes("for update")
      ) {
        return { rows: [certificate] };
      }
      if (statement.includes("from outbox_messages")) {
        return { rows: [{ status: "processing" }] };
      }
      return { rowCount: 1, rows: [] };
    });
    const client = { query: transactionQuery, release: vi.fn() };
    const connect = vi.fn().mockResolvedValue(client);
    dependencies.getPool.mockReturnValue({ connect, query });
    dependencies.deleteR2Objects.mockResolvedValue(undefined);

    await expect(reconcileRevokedCertificateArtifacts()).resolves.toBe(0);

    expect(transactionQuery).toHaveBeenCalledWith("rollback");
    expect(transactionQuery).not.toHaveBeenCalledWith("commit");
    expect(
      transactionQuery.mock.calls.some(([statement]) =>
        statement.includes("insert into certificate_revocation_tombstones")
      )
    ).toBe(false);
    expect(
      transactionQuery.mock.calls.some(([statement]) =>
        statement.includes("delete from certificates")
      )
    ).toBe(false);
    expect(client.release).toHaveBeenCalledOnce();
  });
});
