import { z } from "zod";
import { getSafeAuthReturnTo } from "@/lib/auth-return-to";

const CONTROL_CHARACTER_PATTERN = /\p{Cc}/u;

const signupInputSchema = z
  .object({
    email: z.string().trim().min(1).max(254).email(),
    name: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .refine((value) => !CONTROL_CHARACTER_PATTERN.test(value)),
    returnTo: z.string().max(256).nullable().optional(),
  })
  .strict();

export interface PublicSignupInput {
  courseSlug: string | null;
  email: string;
  name: string;
}

export const parsePublicSignupInput = (
  input: unknown
): PublicSignupInput | null => {
  const parsed = signupInputSchema.safeParse(input);
  if (!parsed.success) {
    return null;
  }

  let courseSlug: string | null = null;
  if (parsed.data.returnTo !== undefined && parsed.data.returnTo !== null) {
    const safeReturnTo = getSafeAuthReturnTo(parsed.data.returnTo);
    if (!safeReturnTo) {
      return null;
    }
    courseSlug = safeReturnTo.slice("/comprar/".length);
  }

  return {
    courseSlug,
    email: parsed.data.email.trim(),
    name: parsed.data.name.trim(),
  };
};
