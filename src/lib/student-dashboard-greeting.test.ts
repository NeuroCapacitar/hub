import { describe, expect, it } from "vitest";
import { getStudentDashboardGreeting } from "./student-dashboard-greeting";

const atSaoPauloTime = (hour: number, minute = 0): Date =>
  new Date(Date.UTC(2026, 8, 24, hour + 3, minute));

describe("getStudentDashboardGreeting", () => {
  it.each([
    [4, 59, "Boa noite"],
    [5, 0, "Bom dia"],
    [11, 59, "Bom dia"],
    [12, 0, "Boa tarde"],
    [17, 59, "Boa tarde"],
    [18, 0, "Boa noite"],
    [23, 0, "Boa noite"],
  ])("uses the Hub time zone at %s:%s", (hour, minute, salutation) => {
    expect(
      getStudentDashboardGreeting(
        "  Júnior   da Silva ",
        atSaoPauloTime(hour, minute)
      )
    ).toBe(`${salutation}, Júnior.`);
  });

  it("falls back to a neutral hello if the time cannot be resolved", () => {
    expect(
      getStudentDashboardGreeting("Júnior da Silva", new Date(Number.NaN))
    ).toBe("Olá, Júnior.");
  });

  it("does not add an empty name when the account name is blank", () => {
    expect(getStudentDashboardGreeting("   ", new Date(Number.NaN))).toBe(
      "Olá!"
    );
  });
});
