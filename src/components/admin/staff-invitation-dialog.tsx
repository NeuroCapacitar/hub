"use client";

import { Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import {
  AdminMutationForm,
  AdminMutationSubmitButton,
} from "@/components/admin-mutation-form";
import { DiscardAwareDialog } from "@/components/discard-aware-dialog";
import {
  Stepper,
  StepperContent,
  StepperDescription,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperPanel,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from "@/components/reui/stepper";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DialogBody,
  DialogClose,
  DialogTriggerButton,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createStaffInvitationAction } from "@/features/admin/staff-invitation-actions";
import {
  STAFF_INVITATION_ROLES,
  type StaffInvitationRole,
} from "@/features/admin/staff-invitation-input";
import {
  SUPPORT_PERMISSION_GROUPS,
  SUPPORT_PERMISSION_VIEW_REQUIREMENTS,
  type SupportPermission,
  type SupportPermissionDefinition,
  type SupportViewPermission,
} from "@/lib/support-permissions";
import { STAFF_ROLE_LABELS, StaffAccessEditor } from "./staff-access-dialog";

type InvitationStep = 1 | 2;
const INVITATION_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const steps = [
  { description: "E-mail e acesso", label: "Configurar", value: 1 },
  { description: "Revise antes do envio", label: "Revisar", value: 2 },
] as const;

const emptyPermissionState = {
  grants: [] as SupportPermission[],
  views: [] as SupportViewPermission[],
};

const isInvitationRole = (value: string): value is StaffInvitationRole =>
  STAFF_INVITATION_ROLES.includes(value as StaffInvitationRole);

const getPermissionSummary = (
  grants: readonly SupportPermission[],
  views: readonly SupportViewPermission[]
): string[] =>
  SUPPORT_PERMISSION_GROUPS.map((group) => {
    const selected = group.permissions.filter((permission) =>
      permission.kind === "view"
        ? views.includes(permission.key as SupportViewPermission)
        : grants.includes(permission.key as SupportPermission)
    );
    return selected.length
      ? `${group.label}: ${selected.map((item) => item.label).join(", ")}`
      : null;
  }).filter((value): value is string => value !== null);

export function StaffInvitationDialog({
  trigger,
}: {
  trigger?: React.ReactNode;
}): React.JSX.Element {
  const router = useRouter();
  const formId = useId();
  const emailId = useId();
  const roleId = useId();
  const reasonId = useId();
  const [step, setStep] = useState<InvitationStep>(1);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffInvitationRole | null>(null);
  const [grants, setGrants] = useState<SupportPermission[]>(
    emptyPermissionState.grants
  );
  const [views, setViews] = useState<SupportViewPermission[]>(
    emptyPermissionState.views
  );
  const [reason, setReason] = useState("");

  const reset = (): void => {
    setStep(1);
    setEmail("");
    setRole(null);
    setGrants(emptyPermissionState.grants);
    setViews(emptyPermissionState.views);
    setReason("");
  };

  const handleOpenChange = (nextOpen: boolean): void => {
    if (!nextOpen) {
      reset();
    }
  };

  const handleRoleChange = (value: string): void => {
    if (!isInvitationRole(value)) {
      return;
    }
    setRole(value);
    if (value !== "support") {
      setGrants([]);
      setViews([]);
    }
  };

  const togglePermission = (definition: SupportPermissionDefinition): void => {
    if (definition.kind === "view") {
      const permission = definition.key as SupportViewPermission;
      const wasSelected = views.includes(permission);
      setViews((current) =>
        wasSelected
          ? current.filter((value) => value !== permission)
          : [...current, permission]
      );
      if (wasSelected) {
        const dependentChanges = new Set(
          SUPPORT_PERMISSION_GROUPS.flatMap((group) => group.permissions)
            .filter(
              (candidate) =>
                candidate.kind === "change" &&
                (
                  SUPPORT_PERMISSION_VIEW_REQUIREMENTS[
                    candidate.key as SupportPermission
                  ] ?? []
                ).includes(permission)
            )
            .map((candidate) => candidate.key)
        );
        setGrants((current) =>
          current.filter((grant) => !dependentChanges.has(grant))
        );
      }
      return;
    }

    const permission = definition.key as SupportPermission;
    setGrants((current) =>
      current.includes(permission)
        ? current.filter((value) => value !== permission)
        : [...current, permission]
    );
  };

  const canReview =
    email.trim().length <= 254 &&
    INVITATION_EMAIL_PATTERN.test(email.trim()) &&
    Boolean(role) &&
    reason.trim().length >= 3;
  const handleStepChange = (nextStep: number): void => {
    if (nextStep === 2 && !canReview) {
      return;
    }
    if (nextStep === 1 || nextStep === 2) {
      setStep(nextStep);
    }
  };
  const permissionSummary = getPermissionSummary(grants, views);

  return (
    <DiscardAwareDialog
      className="max-w-2xl"
      description="Convide alguém para a equipe; o acesso só muda depois que a pessoa aceitar pelo e-mail."
      onOpenChange={handleOpenChange}
      title="Convidar para a equipe"
      trigger={
        trigger ?? (
          <DialogTriggerButton className="min-h-10" variant="default">
            Convidar para a equipe
          </DialogTriggerButton>
        )
      }
    >
      <AdminMutationForm
        action={createStaffInvitationAction}
        className="flex min-h-0 flex-1 flex-col"
        closeOnSuccess
        id={formId}
        onSuccess={() => router.refresh()}
        pendingMessage="Enviando convite…"
        successMessage="Convite registrado; o e-mail está na fila de envio. O acesso só muda após o aceite."
      >
        <DialogBody className="overscroll-contain p-4 sm:p-6">
          <Stepper
            aria-label="Convite para a equipe"
            className="gap-4"
            indicators={{
              completed: (
                <HugeiconsIcon
                  aria-hidden="true"
                  icon={Tick02Icon}
                  size={14}
                  strokeWidth={2.5}
                />
              ),
            }}
            onValueChange={handleStepChange}
            value={step}
          >
            <StepperNav aria-label="Etapas do convite" className="gap-1">
              {steps.map((item, index) => (
                <StepperItem
                  completed={item.value < step}
                  disabled={item.value > step && !canReview}
                  key={item.value}
                  step={item.value}
                >
                  <StepperTrigger className="min-w-0 flex-1 justify-start px-1 py-1.5 text-left">
                    <StepperIndicator>{item.value}</StepperIndicator>
                    <span className="flex min-w-0 flex-col items-start">
                      <StepperTitle>{item.label}</StepperTitle>
                      <StepperDescription className="truncate text-xs">
                        {item.description}
                      </StepperDescription>
                    </span>
                  </StepperTrigger>
                  {index < steps.length - 1 ? <StepperSeparator /> : null}
                </StepperItem>
              ))}
            </StepperNav>
            <StepperPanel>
              <StepperContent className="flex flex-col gap-5 pt-2" value={1}>
                <Field className="gap-2">
                  <FieldLabel htmlFor={emailId}>E-mail de trabalho</FieldLabel>
                  <Input
                    autoComplete="email"
                    id={emailId}
                    maxLength={254}
                    name="email"
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="nome@empresa.com"
                    required
                    type="email"
                    value={email}
                  />
                  <FieldDescription>
                    O link expira em 7 dias. A Conta e o papel só são criados
                    depois do aceite explícito.
                  </FieldDescription>
                </Field>
                <StaffAccessEditor
                  grants={grants}
                  invitationMode
                  memberRole="student"
                  onReasonChange={setReason}
                  onRoleChange={handleRoleChange}
                  onToggle={togglePermission}
                  reason={reason}
                  reasonId={reasonId}
                  role={role}
                  roleId={roleId}
                  views={views}
                />
              </StepperContent>
              <StepperContent className="flex flex-col gap-4 pt-2" value={2}>
                {role ? (
                  <>
                    <input name="email" type="hidden" value={email.trim()} />
                    <input name="role" type="hidden" value={role} />
                    <input name="reason" type="hidden" value={reason.trim()} />
                    {grants.map((permission) => (
                      <input
                        key={`grant-${permission}`}
                        name="supportPermissionGrants"
                        type="hidden"
                        value={permission}
                      />
                    ))}
                    {views.map((permission) => (
                      <input
                        key={`view-${permission}`}
                        name="supportPermissionViews"
                        type="hidden"
                        value={permission}
                      />
                    ))}
                    <dl className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
                      <div className="min-w-0">
                        <dt className="text-muted-foreground text-xs">
                          E-mail
                        </dt>
                        <dd className="mt-1 break-all font-medium text-sm">
                          {email.trim()}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground text-xs">Papel</dt>
                        <dd className="mt-1">
                          <Badge
                            variant={role === "admin" ? "default" : "secondary"}
                          >
                            {STAFF_ROLE_LABELS[role]}
                          </Badge>
                        </dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-muted-foreground text-xs">
                          Permissões configuráveis
                        </dt>
                        <dd className="mt-1 text-sm">
                          {role === "support" && permissionSummary.length
                            ? permissionSummary.join(" · ")
                            : "Acesso total"}
                        </dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-muted-foreground text-xs">
                          Motivo do convite
                        </dt>
                        <dd className="mt-1 text-sm">{reason.trim()}</dd>
                      </div>
                    </dl>
                    <Alert variant="warning">
                      <AlertTitle>O acesso só muda após o aceite</AlertTitle>
                      <AlertDescription>
                        Se o e-mail já pertencer a um Aluno, a aceitação troca o
                        papel e revoga as sessões atuais. A área de aprendizagem
                        deixa de estar disponível; pedidos, matrículas,
                        progresso e certificados são preservados. Nenhum dado é
                        apagado.
                      </AlertDescription>
                    </Alert>
                  </>
                ) : null}
              </StepperContent>
            </StepperPanel>
          </Stepper>
        </DialogBody>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t px-4 py-3 sm:px-6">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </DialogClose>
          {step === 2 ? (
            <Button onClick={() => setStep(1)} type="button" variant="outline">
              Voltar
            </Button>
          ) : null}
          {step === 1 ? (
            <Button
              disabled={!canReview}
              onClick={() => setStep(2)}
              type="button"
            >
              Revisar convite
            </Button>
          ) : (
            <AdminMutationSubmitButton type="submit">
              Enviar convite
            </AdminMutationSubmitButton>
          )}
        </div>
      </AdminMutationForm>
    </DiscardAwareDialog>
  );
}
