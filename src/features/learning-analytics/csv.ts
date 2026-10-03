const SPREADSHEET_FORMULA_PREFIX = /^[\t\r\n]|^\s*[=+@-]/;

export const escapeAnalyticsCsv = (value: number | string | null): string => {
  const text = String(value ?? "");
  const safeText =
    typeof value === "string" && SPREADSHEET_FORMULA_PREFIX.test(text)
      ? `'${text}`
      : text;
  return `"${safeText.replaceAll('"', '""')}"`;
};
