import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({ getPool: vi.fn() }));
const LEGACY_SIGNER_TABLE_PATTERN = /certificate_templates|app_settings/i;

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));

import { saveCourseCertificateSignatory } from "./course-signatory";

const createDatabase = (current: {
  certificate_signer_name: string | null;
  certificate_signer_role: string | null;
}) => {
  const query = vi.fn((statement: string, _values?: unknown[]) => {
    if (statement.includes("select certificate_signer_name")) {
      return { rows: [current] };
    }
    return { rowCount: 1, rows: [] };
  });
  const release = vi.fn();
  const client = { query, release };
  dependencies.getPool.mockReturnValue({
    connect: vi.fn().mockResolvedValue(client),
  });
  return { query, release };
};

describe("course certificate signatory settings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("saves the course signatory and audits only course-level values", async () => {
    const { query, release } = createDatabase({
      certificate_signer_name: null,
      certificate_signer_role: null,
    });

    await saveCourseCertificateSignatory({
      actorUserId: "admin-1",
      courseId: "course-1",
      signerName: "  Dra. Maria  ",
      signerRole: "  Responsável técnica  ",
    });

    const update = query.mock.calls.find(
      ([statement]) =>
        statement.includes("update courses") &&
        statement.includes("certificate_signer_name = $2")
    );
    expect(update?.[1]).toEqual([
      "course-1",
      "Dra. Maria",
      "Responsável técnica",
    ]);
    expect(
      query.mock.calls.some(([statement]) =>
        LEGACY_SIGNER_TABLE_PATTERN.test(statement)
      )
    ).toBe(false);

    const audit = query.mock.calls.find(([statement]) =>
      statement.includes("insert into audit_logs")
    );
    expect(audit?.[1]?.slice(0, 4)).toEqual([
      "admin-1",
      "certificate.course_signatory_updated",
      "course",
      "course-1",
    ]);
    expect(JSON.parse(String(audit?.[1]?.[4]))).toMatchObject({
      changes: {
        certificateSignerName: { after: "Dra. Maria", before: null },
        certificateSignerRole: {
          after: "Responsável técnica",
          before: null,
        },
      },
    });
    expect(release).toHaveBeenCalledOnce();
  });

  it("rejects saving only one half of the signatory pair", async () => {
    const { query, release } = createDatabase({
      certificate_signer_name: null,
      certificate_signer_role: null,
    });

    await expect(
      saveCourseCertificateSignatory({
        actorUserId: "admin-1",
        courseId: "course-1",
        signerName: "Dra. Maria",
        signerRole: "   ",
      })
    ).rejects.toThrow("Informe nome e cargo juntos");

    expect(
      query.mock.calls.some(
        ([statement]) =>
          statement.includes("update courses") &&
          statement.includes("certificate_signer_name = $2")
      )
    ).toBe(false);
    expect(dependencies.getPool).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
  });
});
