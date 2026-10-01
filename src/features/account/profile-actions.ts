"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getPool } from "@/db";
import { removeUserAvatar } from "@/features/account/avatar-storage";
import { requestExistingAccountEmailVerification } from "@/features/account/email-challenges";
import {
  cancelEmailChangeRequest,
  createOrRefreshEmailChangeRequest,
} from "@/features/account/email-change";
import { parseEmailChangeInput } from "@/features/account/email-change-input";
import { scheduleOutboxDrainAfterResponse } from "@/features/outbox/background-drain";
import { requireAccountSession } from "@/lib/session";

const readText = (formData: FormData, key: string): string => {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
};

const refreshAccount = (): void => {
  revalidatePath("/admin/configuracoes");
  revalidatePath("/app/configuracoes");
  revalidatePath("/admin", "layout");
  revalidatePath("/app", "layout");
  revalidatePath("/app/cursos", "layout");
};

export const updateAccountNameAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requireAccountSession();
  const name = readText(formData, "name");
  if (name.length < 2 || name.length > 120) {
    throw new Error("Informe um nome entre 2 e 120 caracteres.");
  }
  await getPool().query(
    "update users set name = $2, updated_at = now() where id = $1",
    [session.user.id, name]
  );
  refreshAccount();
};

export const requestAccountEmailVerificationAction =
  async (): Promise<void> => {
    const session = await requireAccountSession();
    const result = await requestExistingAccountEmailVerification({
      requestHeaders: await headers(),
      userId: session.user.id,
    });
    if (result !== "queued") {
      throw new Error(
        "Não foi possível enviar a confirmação agora. Aguarde um pouco e tente novamente."
      );
    }
    scheduleOutboxDrainAfterResponse();
    refreshAccount();
  };

export const removeAccountAvatarAction = async (): Promise<void> => {
  const session = await requireAccountSession();
  await removeUserAvatar({ userId: session.user.id });
  refreshAccount();
};

export const requestAccountEmailChangeAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requireAccountSession();
  if (!session.emailVerified) {
    throw new Error(
      "Confirme seu e-mail atual antes de solicitar uma alteração."
    );
  }
  await createOrRefreshEmailChangeRequest({
    newEmail: parseEmailChangeInput(formData),
    userId: session.user.id,
  });
  scheduleOutboxDrainAfterResponse();
  refreshAccount();
};

export const cancelAccountEmailChangeAction = async (): Promise<void> => {
  const session = await requireAccountSession();
  await cancelEmailChangeRequest({ userId: session.user.id });
  refreshAccount();
};
