import { APP_TIME_ZONE } from "@/lib/timezone";

const WHITESPACE_RE = /\s+/u;

const getSalutation = (now: Date): string | null => {
  if (!Number.isFinite(now.getTime())) {
    return null;
  }

  try {
    const hourValue = new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      hourCycle: "h23",
      timeZone: APP_TIME_ZONE,
    })
      .formatToParts(now)
      .find((part) => part.type === "hour")?.value;
    const hour = Number(hourValue);

    if (!(Number.isInteger(hour) && hour >= 0 && hour <= 23)) {
      return null;
    }
    if (hour >= 5 && hour < 12) {
      return "Bom dia";
    }
    if (hour >= 12 && hour < 18) {
      return "Boa tarde";
    }
    return "Boa noite";
  } catch {
    return null;
  }
};

export const getStudentDashboardGreeting = (
  name: string | null | undefined,
  now: Date = new Date()
): string => {
  const firstName = name?.trim().split(WHITESPACE_RE)[0];
  const salutation = getSalutation(now);

  if (!salutation) {
    return firstName ? `Olá, ${firstName}.` : "Olá!";
  }

  return firstName ? `${salutation}, ${firstName}.` : `${salutation}!`;
};
