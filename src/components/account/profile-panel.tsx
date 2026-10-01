"use client";

import { Camera01Icon, UserCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRouter } from "next/navigation";
import { type ChangeEvent, useRef, useState } from "react";
import { toast } from "sonner";
import { AvatarCropDialog } from "@/components/account/avatar-crop-dialog";
import {
  AdminMutationForm,
  AdminMutationSubmitButton,
} from "@/components/admin-mutation-form";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  USER_AVATAR_ACCEPT,
  USER_AVATAR_ACCEPTED_TYPES,
  USER_AVATAR_MAX_BYTES,
} from "@/features/account/avatar-policy";
import {
  removeAccountAvatarAction,
  updateAccountNameAction,
} from "@/features/account/profile-actions";
import { getInitials } from "@/lib/get-initials";

const AVATAR_UPLOAD_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  avatar_too_large: "A imagem não pode ter mais de 5 MiB.",
  avatar_upload_failed:
    "Não foi possível salvar a foto agora. Tente novamente.",
  account_suspended:
    "O acesso da conta está suspenso. Fale com o suporte para solicitar uma revisão.",
  invalid_avatar_request: "Selecione uma imagem válida e tente novamente.",
  unauthenticated: "Sua sessão expirou. Entre novamente e tente de novo.",
  untrusted_origin: "Não foi possível enviar a imagem por esta origem.",
};

const isAcceptedAvatarType = (fileType: string): boolean =>
  USER_AVATAR_ACCEPTED_TYPES.some((type) => type === fileType);

const uploadAvatarFile = async (file: File): Promise<void> => {
  const formData = new FormData();
  formData.set("file", file);
  const response = await fetch("/api/account/avatar", {
    body: formData,
    credentials: "same-origin",
    method: "POST",
  });
  if (response.ok) {
    return;
  }
  const result: unknown = await response.json();
  const error =
    result && typeof result === "object" ? Reflect.get(result, "error") : null;
  const errorMessage =
    typeof error === "string" ? AVATAR_UPLOAD_ERROR_MESSAGES[error] : null;
  throw new Error(errorMessage ?? "Não foi possível atualizar a foto.");
};

function AccountAvatarPicker({
  avatarMode,
  image,
  name,
}: {
  avatarMode: "custom" | "google" | "initials";
  image: string | null;
  name: string;
}): React.JSX.Element {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const savedNameRef = useRef(name.trim());
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [nameDraft, setNameDraft] = useState(name);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const hasNameChanges = nameDraft.trim() !== savedNameRef.current;

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) {
      return;
    }
    setUploadError(null);
    if (file.size > USER_AVATAR_MAX_BYTES) {
      setUploadError("A imagem não pode ter mais de 5 MiB.");
      return;
    }
    if (!isAcceptedAvatarType(file.type)) {
      setUploadError("Selecione uma imagem JPG, PNG ou WebP.");
      return;
    }
    setSelectedFile(file);
  };

  const uploadAvatar = async (file: File): Promise<void> => {
    setUploadError(null);
    setIsUploading(true);
    const toastId = toast.loading("Salvando sua foto…");
    try {
      await uploadAvatarFile(file);
      toast.success("Foto de perfil atualizada.", { id: toastId });
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar a foto. Tente novamente.";
      setUploadError(message);
      toast.error(message, { id: toastId });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="grid gap-8">
      <div className="flex items-start gap-4">
        <div className="relative size-16 shrink-0">
          <input
            accept={USER_AVATAR_ACCEPT}
            aria-label="Selecionar foto de perfil"
            className="peer sr-only"
            disabled={isUploading}
            id="account-avatar"
            onChange={handleAvatarChange}
            ref={inputRef}
            type="file"
          />
          <label
            className="group relative block size-16 cursor-pointer rounded-full outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-focus peer-focus-visible:ring-offset-4 peer-focus-visible:ring-offset-background"
            htmlFor="account-avatar"
          >
            <Avatar className="size-16 rounded-full border border-border/70">
              {image ? (
                <AvatarImage
                  alt={name}
                  referrerPolicy="no-referrer"
                  src={image}
                />
              ) : null}
              <AvatarFallback className="rounded-full bg-secondary text-lg text-secondary-foreground">
                {getInitials(name)}
              </AvatarFallback>
            </Avatar>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-background/70 text-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
            >
              <HugeiconsIcon icon={Camera01Icon} size={18} />
            </span>
          </label>
        </div>

        <div className="grid min-w-0 gap-2">
          <p className="font-medium">Imagem do perfil</p>
          <div className="flex flex-wrap gap-2">
            <Button
              className="px-2"
              disabled={isUploading}
              onClick={() => inputRef.current?.click()}
              size="sm"
              type="button"
              variant="default"
            >
              Enviar avatar
            </Button>
            {avatarMode === "custom" ? (
              <AdminMutationForm
                action={removeAccountAvatarAction}
                className="inline-flex"
                onSuccess={() => router.refresh()}
                successMessage="Foto removida."
              >
                <AdminMutationSubmitButton
                  className="px-2"
                  disabled={isUploading}
                  size="sm"
                  type="submit"
                  variant="destructive"
                >
                  Remover
                </AdminMutationSubmitButton>
              </AdminMutationForm>
            ) : null}
          </div>
          {isUploading ? (
            <p
              aria-live="polite"
              className="text-muted-foreground text-sm"
              role="status"
            >
              Salvando foto…
            </p>
          ) : null}
          {uploadError ? (
            <p
              aria-live="polite"
              className="text-destructive text-sm"
              role="alert"
            >
              {uploadError}
            </p>
          ) : null}
        </div>
      </div>

      <FieldGroup className="gap-5">
        <Field className="gap-2">
          <FieldLabel htmlFor="account-name">Nome completo</FieldLabel>
          <AdminMutationForm
            action={updateAccountNameAction}
            className="grid gap-2"
            onSuccess={() => {
              const nextName = nameDraft.trim();
              savedNameRef.current = nextName;
              setNameDraft(nextName);
              router.refresh();
            }}
            successMessage="Nome atualizado."
          >
            <div className="flex min-w-0 items-center gap-2">
              <InputGroup className="min-w-0 flex-1">
                <InputGroupInput
                  autoComplete="name"
                  id="account-name"
                  maxLength={120}
                  minLength={2}
                  name="name"
                  onChange={(event) => setNameDraft(event.currentTarget.value)}
                  required
                  value={nameDraft}
                />
                <InputGroupAddon align="inline-start">
                  <HugeiconsIcon
                    aria-hidden="true"
                    icon={UserCircleIcon}
                    size={16}
                  />
                </InputGroupAddon>
              </InputGroup>
              <AdminMutationSubmitButton
                disabled={!hasNameChanges}
                type="submit"
                variant="outline"
              >
                Salvar
              </AdminMutationSubmitButton>
            </div>
          </AdminMutationForm>
        </Field>
      </FieldGroup>

      <AvatarCropDialog
        file={selectedFile}
        onCancel={() => {
          setSelectedFile(null);
        }}
        onComplete={(file) => {
          setSelectedFile(null);
          return uploadAvatar(file);
        }}
      />
    </div>
  );
}

export function AccountProfilePanel({
  avatarMode,
  image,
  name,
}: {
  avatarMode: "custom" | "google" | "initials";
  image: string | null;
  name: string;
}): React.JSX.Element {
  return (
    <AccountAvatarPicker avatarMode={avatarMode} image={image} name={name} />
  );
}
