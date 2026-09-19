"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
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
  DialogFooter,
  DialogTriggerButton,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { changeStaffAccessAction } from "@/features/admin/staff-actions";
import {
  STAFF_ROLES,
  type StaffRole,
} from "@/features/admin/staff-command-input";
import type {
  StaffPromotionCandidate,
  StaffPromotionCandidatesResult,
} from "@/features/admin/staff-server";
import {
  SUPPORT_PERMISSION_GROUPS,
  SUPPORT_PERMISSION_VIEW_REQUIREMENTS,
  type SupportPermission,
  type SupportPermissionDefinition,
  type SupportViewPermission,
} from "@/lib/support-permissions";
import { STAFF_ROLE_LABELS, StaffAccessEditor } from "./staff-access-dialog";

const MIN_SEARCH_LENGTH = 2;
type PromotionStep = 1 | 2 | 3;

const steps = [
  { description: "Encontre a conta", label: "Encontrar", value: 1 },
  { description: "Defina o acesso", label: "Configurar", value: 2 },
  { description: "Confirme a alteração", label: "Revisar", value: 3 },
] as const;

const emptyPermissionState = {
  grants: [] as SupportPermission[],
  views: [] as SupportViewPermission[],
};

const getSelectedPermissionCount = (
  definitions: readonly SupportPermissionDefinition[],
  views: readonly SupportViewPermission[],
  grants: readonly SupportPermission[]
): number =>
  definitions.filter((definition) =>
    definition.kind === "view"
      ? views.includes(definition.key as SupportViewPermission)
      : grants.includes(definition.key as SupportPermission)
  ).length;

function PromotionSearchResults({
  isSearching,
  onSelect,
  result,
}: {
  isSearching: boolean;
  onSelect: (candidate: StaffPromotionCandidate) => void;
  result: StaffPromotionCandidatesResult | null;
}): React.JSX.Element | null {
  if (isSearching) {
    return (
      <p
        aria-live="polite"
        className="py-6 text-center text-muted-foreground text-sm"
        role="status"
      >
        Procurando contas…
      </p>
    );
  }

  if (!result) {
    return null;
  }

  if (!result.candidates.length) {
    return (
      <Empty className="rounded-lg border border-dashed py-6">
        <EmptyHeader>
          <EmptyTitle as="h3">Nenhum Aluno encontrado</EmptyTitle>
          <EmptyDescription>
            Tente outro nome ou e-mail. Apenas contas com papel de Aluno podem
            ser promovidas.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <ul aria-label="Alunos encontrados" className="divide-y">
        {result.candidates.map((candidate) => (
          <li
            className="flex flex-wrap items-center justify-between gap-3 p-3"
            key={candidate.userId}
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-sm">{candidate.name}</p>
              <p className="truncate text-muted-foreground text-xs">
                {candidate.email}
              </p>
            </div>
            <Button
              className="min-h-10"
              onClick={() => onSelect(candidate)}
              type="button"
              variant="outline"
            >
              Selecionar
            </Button>
          </li>
        ))}
      </ul>
      {result.hasMore ? (
        <p className="border-t px-3 py-2 text-muted-foreground text-xs">
          Mostrando os 10 primeiros resultados. Refine a busca para encontrar
          outra Conta.
        </p>
      ) : null}
    </div>
  );
}

function PromotionReview({
  candidate,
  grants,
  reason,
  role,
  views,
}: {
  candidate: StaffPromotionCandidate;
  grants: readonly SupportPermission[];
  reason: string;
  role: StaffRole;
  views: readonly SupportViewPermission[];
}): React.JSX.Element {
  const selectedPermissions = SUPPORT_PERMISSION_GROUPS.map((group) => ({
    count: getSelectedPermissionCount(group.permissions, views, grants),
    label: group.label,
    total: group.permissions.length,
  })).filter((group) => group.count > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border bg-muted/20 p-4">
        <p className="font-medium text-sm">Conta selecionada</p>
        <p className="mt-1 font-semibold">{candidate.name}</p>
        <p className="mt-1 text-muted-foreground text-sm">{candidate.email}</p>
      </div>
      <dl className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground text-xs">Papel</dt>
          <dd className="mt-1">
            <Badge variant={role === "admin" ? "default" : "secondary"}>
              {STAFF_ROLE_LABELS[role]}
            </Badge>
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Permissões extras</dt>
          <dd className="mt-1 font-medium text-sm">
            {role === "support" && selectedPermissions.length
              ? selectedPermissions
                  .map(
                    (group) => `${group.label} (${group.count}/${group.total})`
                  )
                  .join(" · ")
              : "Nenhuma"}
          </dd>
        </div>
      </dl>
      <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
        <p className="font-medium text-warning">Efeito da promoção</p>
        <p className="mt-1 text-warning/90">
          Esta conta deixará de usar a área do Aluno. Matrículas, pedidos,
          progresso e certificados serão preservados.
        </p>
      </div>
      <div className="rounded-lg border p-4">
        <p className="text-muted-foreground text-xs">Motivo registrado</p>
        <p className="mt-1 text-sm">{reason}</p>
      </div>
    </div>
  );
}

export function StaffPromotionDialog({
  trigger,
}: {
  trigger?: React.ReactNode;
}): React.JSX.Element {
  const router = useRouter();
  const formId = useId();
  const roleId = useId();
  const reasonId = useId();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<PromotionStep>(1);
  const [search, setSearch] = useState("");
  const [result, setResult] = useState<StaffPromotionCandidatesResult | null>(
    null
  );
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<StaffPromotionCandidate | null>(
    null
  );
  const [role, setRole] = useState<StaffRole | null>(null);
  const [grants, setGrants] = useState<SupportPermission[]>(
    emptyPermissionState.grants
  );
  const [views, setViews] = useState<SupportViewPermission[]>(
    emptyPermissionState.views
  );
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!(open && search.trim().length >= MIN_SEARCH_LENGTH)) {
      setIsSearching(false);
      setResult(null);
      setSearchError(null);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      setIsSearching(true);
      setSearchError(null);
      fetch(
        `/api/admin/staff/promotion-candidates?q=${encodeURIComponent(search.trim())}`,
        { cache: "no-store", signal: controller.signal }
      )
        .then(async (response) => {
          if (!response.ok) {
            throw new Error("Não foi possível buscar Alunos agora.");
          }
          return (await response.json()) as StaffPromotionCandidatesResult;
        })
        .then(setResult)
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }
          setResult(null);
          setSearchError(
            error instanceof Error
              ? error.message
              : "Não foi possível buscar Alunos agora."
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsSearching(false);
          }
        });
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [open, search]);

  const reset = (): void => {
    setStep(1);
    setSearch("");
    setResult(null);
    setIsSearching(false);
    setSearchError(null);
    setCandidate(null);
    setRole(null);
    setGrants(emptyPermissionState.grants);
    setViews(emptyPermissionState.views);
    setReason("");
  };

  const handleOpenChange = (nextOpen: boolean): void => {
    setOpen(nextOpen);
    if (!nextOpen) {
      reset();
    }
  };

  const handleSelectCandidate = (nextCandidate: StaffPromotionCandidate) => {
    setCandidate(nextCandidate);
    setRole(null);
    setGrants(emptyPermissionState.grants);
    setViews(emptyPermissionState.views);
    setReason("");
    setStep(2);
  };

  const handleRoleChange = (value: string): void => {
    if (!STAFF_ROLES.includes(value as StaffRole)) {
      return;
    }
    const nextRole = value as StaffRole;
    setRole(nextRole);
    if (nextRole !== "support") {
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
              (candidatePermission) =>
                candidatePermission.kind === "change" &&
                (
                  SUPPORT_PERMISSION_VIEW_REQUIREMENTS[
                    candidatePermission.key as SupportPermission
                  ] ?? []
                ).includes(permission)
            )
            .map((candidatePermission) => candidatePermission.key)
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

  const canReview = Boolean(role && reason.trim().length >= 3);
  const handleStepChange = (nextStep: number): void => {
    if (nextStep === 2 && !candidate) {
      return;
    }
    if (nextStep === 3 && !canReview) {
      return;
    }
    if (nextStep >= 1 && nextStep <= 3) {
      setStep(nextStep as PromotionStep);
    }
  };

  return (
    <DiscardAwareDialog
      className="max-w-2xl"
      description="Encontre a conta, configure o acesso e revise a promoção antes de confirmar."
      onOpenChange={handleOpenChange}
      title="Adicionar à equipe"
      trigger={
        trigger ?? (
          <DialogTriggerButton className="min-h-10" variant="default">
            Adicionar à equipe
          </DialogTriggerButton>
        )
      }
    >
      <AdminMutationForm
        action={changeStaffAccessAction}
        className="flex min-h-0 flex-1 flex-col"
        closeOnSuccess
        id={formId}
        onSuccess={() => {
          router.refresh();
        }}
      >
        <DialogBody className="overscroll-contain p-4 sm:p-6">
          <div className="flex flex-col gap-6">
            {candidate && role ? (
              <input name="role" type="hidden" value={role} />
            ) : null}
            {candidate ? (
              <input
                name="targetUserId"
                type="hidden"
                value={candidate.userId}
              />
            ) : null}
            {step === 3 ? (
              <input name="reason" type="hidden" value={reason} />
            ) : null}
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

            <Stepper
              className="gap-3"
              onValueChange={handleStepChange}
              value={step}
            >
              <StepperNav className="gap-1">
                {steps.map((item, index) => (
                  <StepperItem
                    completed={item.value < step}
                    disabled={
                      item.value > step ||
                      (item.value === 2 && !candidate) ||
                      (item.value === 3 && !canReview)
                    }
                    key={item.value}
                    step={item.value}
                  >
                    <StepperTrigger className="min-w-0 flex-1 justify-start px-1 py-1.5 text-left">
                      <StepperIndicator>{item.value}</StepperIndicator>
                      <span className="hidden min-w-0 flex-col items-start sm:flex">
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
                <StepperContent className="pt-2" value={1}>
                  <div className="flex flex-col gap-4">
                    <Field className="gap-2">
                      <FieldLabel htmlFor={`${formId}-search`}>
                        Buscar Aluno
                      </FieldLabel>
                      <Input
                        aria-describedby={`${formId}-search-help`}
                        aria-label="Buscar Aluno"
                        autoComplete="off"
                        id={`${formId}-search`}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Digite nome ou e-mail…"
                        value={search}
                      />
                      <FieldDescription id={`${formId}-search-help`}>
                        Os resultados aparecem enquanto você digita. Use pelo
                        menos 2 caracteres.
                      </FieldDescription>
                    </Field>
                    {search.length > 0 &&
                    search.trim().length < MIN_SEARCH_LENGTH ? (
                      <p className="text-muted-foreground text-sm">
                        Digite mais um caractere para iniciar a busca.
                      </p>
                    ) : null}
                    {searchError ? (
                      <Alert variant="destructive">
                        <AlertTitle>Busca indisponível</AlertTitle>
                        <AlertDescription>{searchError}</AlertDescription>
                      </Alert>
                    ) : null}
                    <PromotionSearchResults
                      isSearching={isSearching}
                      onSelect={handleSelectCandidate}
                      result={result}
                    />
                  </div>
                </StepperContent>
                <StepperContent className="pt-2" value={2}>
                  {candidate ? (
                    <div className="flex flex-col gap-5">
                      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-muted/20 p-4">
                        <div className="min-w-0">
                          <p className="font-medium text-sm">
                            Conta selecionada
                          </p>
                          <p className="mt-1 truncate font-semibold">
                            {candidate.name}
                          </p>
                          <p className="mt-1 truncate text-muted-foreground text-sm">
                            {candidate.email}
                          </p>
                        </div>
                        <Button
                          onClick={() => setStep(1)}
                          type="button"
                          variant="ghost"
                        >
                          Trocar conta
                        </Button>
                      </div>
                      <StaffAccessEditor
                        grants={grants}
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
                    </div>
                  ) : null}
                </StepperContent>
                <StepperContent className="pt-2" value={3}>
                  {candidate && role ? (
                    <PromotionReview
                      candidate={candidate}
                      grants={grants}
                      reason={reason}
                      role={role}
                      views={views}
                    />
                  ) : null}
                </StepperContent>
              </StepperPanel>
            </Stepper>
          </div>
        </DialogBody>
        <DialogFooter className="px-4 sm:px-6">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </DialogClose>
          {step > 1 ? (
            <Button
              onClick={() =>
                setStep((current) => (current - 1) as PromotionStep)
              }
              type="button"
              variant="ghost"
            >
              Voltar
            </Button>
          ) : null}
          {step === 2 ? (
            <Button
              disabled={!canReview}
              onClick={() => setStep(3)}
              type="button"
            >
              Revisar promoção
            </Button>
          ) : null}
          {step === 3 ? (
            <AdminMutationSubmitButton type="submit">
              Confirmar promoção
            </AdminMutationSubmitButton>
          ) : null}
        </DialogFooter>
      </AdminMutationForm>
    </DiscardAwareDialog>
  );
}
