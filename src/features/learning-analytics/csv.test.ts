import { describe, expect, it } from "vitest";
import { escapeAnalyticsCsv } from "./csv";

describe("analytics CSV text safety", () => {
  it.each([
    "=SUM(1,2)",
    "+command",
    "-command",
    "@SUM(1)",
    "  =formula",
    "\tformula",
    "\rformula",
    "\nformula",
  ])("neutralizes spreadsheet expression text %s", (value) => {
    expect(escapeAnalyticsCsv(value)).toBe(`"'${value}"`);
  });
  it("keeps numeric values numeric while quoting data and embedded quotes", () => {
    expect(escapeAnalyticsCsv(-5)).toBe('"-5"');
    expect(escapeAnalyticsCsv('Aula "Olá"')).toBe('"Aula ""Olá"""');
    expect(escapeAnalyticsCsv(null)).toBe('""');
  });
});
