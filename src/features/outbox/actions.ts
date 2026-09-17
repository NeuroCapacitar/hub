"use server";

import { requirePermission } from "@/lib/auth-permissions";
import {
  reprocessOutboxDeadLetter,
  supersedeUnavailableSupportDeadLetterMessage,
} from "./server";

const readString = (formData: FormData, key: string): string =>
  String(formData.get(key) ?? "").trim();

export const reprocessOutboxDeadLetterAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requirePermission("manageOperations");
  const messageId = readString(formData, "messageId");

  if (!messageId) {
    throw new Error("Mensagem da outbox invalida.");
  }

  await reprocessOutboxDeadLetter({
    actorUserId: session.user.id,
    messageId,
    reason: readString(formData, "reason"),
  });
};

export const supersedeUnavailableSupportDeadLetterAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requirePermission("manageOperations");
  const messageId = readString(formData, "messageId");

  if (!messageId) {
    throw new Error("Mensagem da outbox invalida.");
  }

  await supersedeUnavailableSupportDeadLetterMessage({
    actorUserId: session.user.id,
    messageId,
  });
};
