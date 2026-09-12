import { LessonAuthoringError } from "./lesson-authoring-errors";

const INTEGER_PATTERN = /^-?\d+$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONTENT_STATUSES = new Set(["draft", "active", "archived"]);

export type AuthoringContentStatus = "active" | "archived" | "draft";

const getStringValue = (formData: FormData, key: string): string | null => {
  const value = formData.get(key);

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new LessonAuthoringError(`O campo ${key} é inválido.`);
  }

  return value.trim();
};

export const readAuthoringString = (formData: FormData, key: string): string =>
  getStringValue(formData, key) ?? "";

export const parseAuthoringUuid = (value: unknown, field: string): string => {
  if (typeof value !== "string") {
    throw new LessonAuthoringError(`O campo ${field} é inválido.`);
  }

  const normalized = value.trim();
  if (!UUID_PATTERN.test(normalized)) {
    throw new LessonAuthoringError(`O campo ${field} é inválido.`);
  }

  return normalized;
};

export const readAuthoringUuid = ({
  field,
  formData,
  required = false,
  requiredMessage,
}: {
  field: string;
  formData: FormData;
  required?: boolean;
  requiredMessage?: string;
}): string | null => {
  const value = readAuthoringString(formData, field);
  if (!value) {
    if (required) {
      throw new LessonAuthoringError(
        requiredMessage ?? `Informe o campo ${field}.`
      );
    }
    return null;
  }

  return parseAuthoringUuid(value, field);
};

export const parseAuthoringUuidList = (
  value: unknown,
  field: string
): string[] => {
  if (!Array.isArray(value)) {
    throw new LessonAuthoringError(`O campo ${field} é inválido.`);
  }

  return value.map((item, index) =>
    parseAuthoringUuid(item, `${field}[${index}]`)
  );
};

export const readRequiredAuthoringString = ({
  field,
  formData,
  label,
}: {
  field: string;
  formData: FormData;
  label: string;
}): string => {
  const value = readAuthoringString(formData, field);
  if (!value) {
    throw new LessonAuthoringError(
      `Informe ${label}.`,
      field === "title" ? "title" : "general"
    );
  }
  return value;
};

const readInteger = ({
  fallback,
  formData,
  key,
}: {
  fallback: number | undefined;
  formData: FormData;
  key: string;
}): number => {
  const rawValue = getStringValue(formData, key);
  if (rawValue === null || rawValue === "") {
    if (fallback !== undefined) {
      return fallback;
    }
    throw new LessonAuthoringError(`Informe um valor para ${key}.`);
  }

  if (!INTEGER_PATTERN.test(rawValue)) {
    throw new LessonAuthoringError(
      `O campo ${key} deve ser um número inteiro.`
    );
  }

  const value = Number(rawValue);
  if (!Number.isSafeInteger(value)) {
    throw new LessonAuthoringError(`O campo ${key} está fora do limite.`);
  }

  return value;
};

export const readAuthoringNonNegativeInteger = (
  formData: FormData,
  key: string,
  fallback?: number
): number => {
  const value = readInteger({ fallback, formData, key });
  if (value < 0) {
    throw new LessonAuthoringError(`O campo ${key} não pode ser negativo.`);
  }
  return value;
};

export const readAuthoringPositiveInteger = (
  formData: FormData,
  key: string,
  fallback?: number
): number => {
  const value = readInteger({ fallback, formData, key });
  if (value <= 0) {
    throw new LessonAuthoringError(`O campo ${key} deve ser maior que zero.`);
  }
  return value;
};

export const readAuthoringContentStatus = (
  formData: FormData,
  fallback: AuthoringContentStatus = "draft"
): AuthoringContentStatus => {
  const value = readAuthoringString(formData, "status");
  if (!value) {
    return fallback;
  }
  if (!CONTENT_STATUSES.has(value)) {
    throw new LessonAuthoringError("O status do conteúdo é inválido.");
  }
  return value as AuthoringContentStatus;
};

export const readAuthoringRequiredBoolean = (
  formData: FormData,
  key: string,
  fallback: boolean
): boolean => {
  const values = formData.getAll(key);
  if (values.length === 0) {
    return fallback;
  }

  const normalizedValues = values.map((value) =>
    typeof value === "string" ? value : null
  );
  if (
    normalizedValues.some(
      (value) => value !== "on" && value !== "true" && value !== "false"
    )
  ) {
    throw new LessonAuthoringError(`O campo ${key} é inválido.`);
  }

  return normalizedValues.includes("on") || normalizedValues.includes("true");
};
