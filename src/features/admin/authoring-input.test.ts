import { describe, expect, it } from "vitest";
import {
  readAuthoringContentStatus,
  readAuthoringNonNegativeInteger,
  readAuthoringPositiveInteger,
  readAuthoringRequiredBoolean,
  readRequiredAuthoringString,
} from "./authoring-input";

describe("authoring input contracts", () => {
  it("rejects blank required text independently of browser validation", () => {
    const formData = new FormData();
    formData.set("title", "   ");

    expect(() =>
      readRequiredAuthoringString({
        field: "title",
        formData,
        label: "o título",
      })
    ).toThrow("Informe o título.");
  });

  it.each([
    "0",
    "-1",
    "1.5",
    "abc",
  ])("rejects invalid positive integer %s", (value) => {
    const formData = new FormData();
    formData.set("sortOrder", value);

    expect(() => readAuthoringPositiveInteger(formData, "sortOrder")).toThrow();
  });

  it("accepts an integer and preserves an explicit zero for non-negative fields", () => {
    const formData = new FormData();
    formData.set("sortOrder", "2");
    expect(readAuthoringPositiveInteger(formData, "sortOrder")).toBe(2);

    formData.set("durationSeconds", "0");
    expect(readAuthoringNonNegativeInteger(formData, "durationSeconds")).toBe(
      0
    );
  });

  it("rejects unknown content status instead of silently demoting it to draft", () => {
    const formData = new FormData();
    formData.set("status", "unexpected");

    expect(() => readAuthoringContentStatus(formData)).toThrow(
      "O status do conteúdo é inválido."
    );
  });

  it("accepts the hidden false plus checked on representation of a required lesson", () => {
    const formData = new FormData();
    formData.append("isRequired", "false");
    formData.append("isRequired", "on");

    expect(readAuthoringRequiredBoolean(formData, "isRequired", false)).toBe(
      true
    );
  });

  it("rejects arbitrary boolean values from a hidden field", () => {
    const formData = new FormData();
    formData.set("isRequired", "yes");

    expect(() =>
      readAuthoringRequiredBoolean(formData, "isRequired", true)
    ).toThrow("O campo isRequired é inválido.");
  });
});
