import { z } from "zod";

const emailSchema = z.string().trim().min(1).max(254).email();

export const parseEmailChangeInput = (formData: FormData): string => {
  const value = formData.get("newEmail");
  const parsed = emailSchema.safeParse(typeof value === "string" ? value : "");
  if (!parsed.success) {
    throw new Error("Informe um endereço de e-mail válido.");
  }
  return parsed.data.toLowerCase();
};
