"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { FinanceHelp } from "@/components/admin/finance-help";
import {
  AdminMutationForm,
  AdminMutationSubmitButton,
} from "@/components/admin-mutation-form";
import { DiscardAwareDialog } from "@/components/discard-aware-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DialogBody,
  DialogClose,
  DialogFooter,
  DialogTriggerButton,
} from "@/components/ui/dialog";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { changeStaffAccessAction } from "@/features/admin/staff-actions";
import {
  STAFF_ROLES,
  type StaffRole,
} from "@/features/admin/staff-command-input";
import { formatDateTime } from "@/lib/formatters";
import {
  SUPPORT_PERMISSION_GROUPS,
  SUPPORT_PERMISSION_VIEW_REQUIREMENTS,
  type SupportPermission,
  type SupportPermissionDefinition,
  type SupportViewPermission,
} from "@/lib/support-permissions";

export interface StaffAccessMember {
  email: string;
  lastAccessAt: Date | null;
  name: string;
  role: StaffRole;
  supportPermissionGrants: SupportPermission[];
  supportPermissionViews: SupportViewPermission[];
  userId: string;
}

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  admin: "Admin",
  student: "Aluno",
  support: "Suporte",
};

export const STAFF_ROLE_VARIANTS: Record<
  StaffRole,
  "default" | "outline" | "secondary"
> = {
  admin: "default",
  student: "outline",
  support: "secondary",
};

const formatLastAccess = (value: Date | null): string =>
  value ? formatDateTime(value) : "Sem registro";

function isChecked(
  definition: SupportPermissionDefinition,
  views: readonly SupportViewPermission[],
  grants: readonly SupportPermission[]
): boolean {
  return definition.kind === "view"
    ? views.includes(definition.key as SupportViewPermission)
    : grants.includes(definition.key as SupportPermission);
}

function isChangeEnabled(
  definition: SupportPermissionDefinition,
  views: readonly SupportViewPermission[]
): boolean {
  if (definition.kind === "view") {
    return true;
  }

  const requiredViews =
    SUPPORT_PERMISSION_VIEW_REQUIREMENTS[definition.key as SupportPermission] ??
    [];
  return requiredViews.every((view) => views.includes(view));
}

function getSupportViewLabel(permission: SupportViewPermission): string {
  return (
    SUPPORT_PERMISSION_GROUPS.flatMap((group) => group.permissions).find(
      (definition) =>
        definition.kind === "view" && definition.key === permission
    )?.label ?? permission
  );
}

function getPermissionDisabledDescription(
  definition: SupportPermissionDefinition
): string {
  const requiredViews =
    SUPPORT_PERMISSION_VIEW_REQUIREMENTS[definition.key as SupportPermission] ??
    [];
  const requiredLabels = requiredViews.map(getSupportViewLabel);

  return requiredLabels.length
    ? `Requer ${requiredLabels.join(" e ")}.`
    : "Selecione a visualização desta área primeiro.";
}

function formatSelectionCount(
  count: number,
  singularNoun: string,
  pluralNoun: string
): string {
  return `${count} ${count === 1 ? singularNoun : pluralNoun}`;
}

function StaffPermissionSection({
  definitions,
  grants,
  onToggle,
  title,
  views,
}: {
  definitions: readonly SupportPermissionDefinition[];
  grants: readonly SupportPermission[];
  onToggle: (definition: SupportPermissionDefinition) => void;
  title: string | null;
  views: readonly SupportViewPermission[];
}): React.JSX.Element {
  const selectedCount = definitions.filter((definition) =>
    isChecked(definition, views, grants)
  ).length;

  return (
    <div className="flex flex-col gap-2.5">
      {title ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium text-muted-foreground text-xs">{title}</p>
          <span className="text-muted-foreground text-xs tabular-nums">
            {selectedCount}/{definitions.length}
          </span>
        </div>
      ) : null}
      <FieldGroup
        className={
          definitions.length > 2 ? "gap-2 sm:grid sm:grid-cols-2" : "gap-2"
        }
      >
        {definitions.map((definition) => {
          const inputId = `support-permission-${definition.key}`;
          const enabled = isChangeEnabled(definition, views);
          return (
            <Field
              className="rounded-lg border bg-background px-3 py-2.5 transition-colors hover:bg-muted/40"
              data-disabled={!enabled || undefined}
              key={definition.key}
              orientation="horizontal"
            >
              <Checkbox
                checked={isChecked(definition, views, grants)}
                disabled={!enabled}
                id={inputId}
                onCheckedChange={() => onToggle(definition)}
              />
              <FieldContent>
                <FieldLabel htmlFor={inputId}>{definition.label}</FieldLabel>
                <FieldDescription className="text-xs">
                  {definition.description}
                </FieldDescription>
                {enabled ? null : (
                  <FieldDescription className="text-warning text-xs">
                    {getPermissionDisabledDescription(definition)}
                  </FieldDescription>
                )}
              </FieldContent>
            </Field>
          );
        })}
      </FieldGroup>
    </div>
  );
}

function getGroupSelectionCount(
  group: (typeof SUPPORT_PERMISSION_GROUPS)[number],
  grants: readonly SupportPermission[],
  views: readonly SupportViewPermission[]
): number {
  return group.permissions.filter((definition) =>
    isChecked(definition, views, grants)
  ).length;
}

function StaffPermissionGroup({
  grants,
  group,
  onToggle,
  views,
}: {
  grants: readonly SupportPermission[];
  group: (typeof SUPPORT_PERMISSION_GROUPS)[number];
  onToggle: (definition: SupportPermissionDefinition) => void;
  views: readonly SupportViewPermission[];
}): React.JSX.Element {
  const viewDefinitions = group.permissions.filter(
    (definition) => definition.kind === "view"
  );
  const changeDefinitions = group.permissions.filter(
    (definition) => definition.kind === "change"
  );
  const selectionCount = getGroupSelectionCount(group, grants, views);

  return (
    <AccordionItem value={group.label}>
      <AccordionTrigger className="items-center px-4 py-3 hover:no-underline">
        <span className="type-card-title min-w-0 flex-1 text-left">
          {group.label}
        </span>
        <Badge
          aria-label={`${selectionCount} de ${group.permissions.length} permissões selecionadas`}
          className="mr-2 tabular-nums"
          variant={selectionCount ? "secondary" : "outline"}
        >
          {selectionCount}/{group.permissions.length}
        </Badge>
      </AccordionTrigger>
      <AccordionContent className="px-4">
        <div className="flex flex-col gap-5">
          {viewDefinitions.length ? (
            <StaffPermissionSection
              definitions={viewDefinitions}
              grants={grants}
              onToggle={onToggle}
              title="Leitura"
              views={views}
            />
          ) : null}
          {changeDefinitions.length ? (
            <StaffPermissionSection
              definitions={changeDefinitions}
              grants={grants}
              onToggle={onToggle}
              title={viewDefinitions.length ? "Alterações" : null}
              views={views}
            />
          ) : null}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function StaffPermissionSummary({
  grants,
  views,
}: {
  grants: readonly SupportPermission[];
  views: readonly SupportViewPermission[];
}): React.JSX.Element {
  return (
    <div
      aria-live="polite"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-xs"
    >
      <span>
        {formatSelectionCount(
          views.length,
          "leitura protegida",
          "leituras protegidas"
        )}
      </span>
      <span aria-hidden="true">·</span>
      <span>
        {formatSelectionCount(
          grants.length,
          "alteração delegada",
          "alterações delegadas"
        )}
      </span>
    </div>
  );
}

function getInitialOpenGroups(
  grants: readonly SupportPermission[],
  views: readonly SupportViewPermission[]
): string[] {
  const groupsWithSelections = SUPPORT_PERMISSION_GROUPS.filter(
    (group) => getGroupSelectionCount(group, grants, views) > 0
  ).map((group) => group.label);

  return groupsWithSelections.length
    ? groupsWithSelections
    : [SUPPORT_PERMISSION_GROUPS[0]?.label ?? "Cursos"];
}

const getRoleWarning = (
  memberRole: StaffRole,
  role: StaffRole | null,
  invitationMode: boolean
): React.JSX.Element | null => {
  if (invitationMode && role !== null) {
    return (
      <p
        aria-live="polite"
        className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning"
        role="status"
      >
        Se este e-mail já pertencer a um Aluno, aceitar o convite trocará o
        papel. A área de aprendizagem ficará indisponível, mas matrículas,
        pedidos, progresso e certificados serão preservados.
      </p>
    );
  }

  if (memberRole === "student" && role !== null) {
    return (
      <p
        aria-live="polite"
        className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning"
        role="status"
      >
        Esta Conta deixará de usar a área do Aluno. Matrículas, pedidos,
        progresso e certificados serão preservados.
      </p>
    );
  }

  if (memberRole !== "student" && role === "student") {
    return (
      <p
        aria-live="polite"
        className="rounded-lg border bg-muted/30 px-3 py-2 text-muted-foreground text-sm"
        role="status"
      >
        As permissões administrativas serão removidas e as sessões atuais serão
        revogadas.
      </p>
    );
  }

  return null;
};

const getRoleChangeConfirmation = (
  isPromotion: boolean,
  role: StaffRole | null
): string => {
  if (isPromotion) {
    return "A Conta deixará de usar a área do Aluno e passará a acessar a área administrativa. Os dados de aprendizagem serão preservados.";
  }

  if (role === "student") {
    return "As permissões administrativas serão removidas e as sessões atuais da Conta serão revogadas.";
  }

  return "As sessões atuais da Conta serão revogadas para aplicar o novo papel.";
};

export function StaffAccessEditor({
  grants,
  invitationMode = false,
  memberRole,
  onReasonChange,
  onRoleChange,
  onToggle,
  reason,
  reasonId,
  role,
  roleId,
  views,
}: {
  grants: readonly SupportPermission[];
  invitationMode?: boolean;
  memberRole: StaffRole;
  onReasonChange?: ((value: string) => void) | undefined;
  onRoleChange: (value: string) => void;
  onToggle: (definition: SupportPermissionDefinition) => void;
  reason?: string | undefined;
  reasonId: string;
  role: StaffRole | null;
  roleId: string;
  views: readonly SupportViewPermission[];
}): React.JSX.Element {
  const isStudentCandidate = memberRole === "student";
  const roleWarning = getRoleWarning(memberRole, role, invitationMode);

  return (
    <div className="flex flex-col gap-5">
      <Field className="gap-2">
        <FieldLabel htmlFor={roleId}>Papel</FieldLabel>
        <Select name="role" onValueChange={onRoleChange} value={role ?? ""}>
          <SelectTrigger id={roleId}>
            <SelectValue placeholder="Selecione o papel" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {STAFF_ROLES.filter((option) =>
                invitationMode
                  ? option !== "student"
                  : !(isStudentCandidate && option === "student")
              ).map((option) => (
                <SelectItem key={option} value={option}>
                  {STAFF_ROLE_LABELS[option]}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>

      {roleWarning}

      {role === "support" ? (
        <FieldSet className="gap-3">
          <FieldLegend
            className="mb-0 flex items-center gap-1.5"
            variant="label"
          >
            Permissões configuráveis
            <FinanceHelp
              description="Configure apenas as exceções de acesso deste Suporte. Os acessos padrão são compartilhados e não precisam ser escolhidos."
              details={[
                "Financeiro e Auditoria aparecem como leituras protegidas; as demais leituras administrativas são padrão.",
                "Uma alteração financeira só fica disponível quando a leitura correspondente também está liberada.",
                "Ao remover uma leitura protegida, as alterações que dependem dela também são removidas.",
              ]}
              title="Como funcionam as permissões"
            />
          </FieldLegend>
          <StaffPermissionSummary grants={grants} views={views} />
          <Accordion
            className="rounded-xl"
            defaultValue={getInitialOpenGroups(grants, views)}
            type="multiple"
          >
            {SUPPORT_PERMISSION_GROUPS.map((group) => (
              <StaffPermissionGroup
                grants={grants}
                group={group}
                key={group.label}
                onToggle={onToggle}
                views={views}
              />
            ))}
          </Accordion>
        </FieldSet>
      ) : null}

      <FieldSet className="gap-3 border-t pt-5">
        <FieldLegend className="mb-0" variant="label">
          Justificativa
        </FieldLegend>
        <FieldDescription>Fica disponível na auditoria.</FieldDescription>
        <Field className="gap-2">
          <FieldLabel htmlFor={reasonId}>
            {invitationMode ? "Motivo do convite" : "Motivo da alteração"}
          </FieldLabel>
          <Textarea
            id={reasonId}
            maxLength={500}
            minLength={3}
            name="reason"
            onChange={
              onReasonChange
                ? (event) => onReasonChange(event.target.value)
                : undefined
            }
            placeholder="Ex.: ajuste de função após revisão…"
            required
            rows={3}
            {...(reason === undefined ? {} : { value: reason })}
          />
        </Field>
      </FieldSet>
    </div>
  );
}

export function StaffAccessDialog({
  member,
  onSuccess,
  trigger,
}: {
  member: StaffAccessMember;
  onSuccess?: (() => void | Promise<void>) | undefined;
  trigger?: React.ReactNode;
}): React.JSX.Element {
  const router = useRouter();
  const roleId = useId();
  const reasonId = useId();
  const formId = useId();
  const didSave = useRef(false);
  const [role, setRole] = useState<StaffRole | null>(
    member.role === "student" ? null : member.role
  );
  const [grants, setGrants] = useState<SupportPermission[]>(
    member.supportPermissionGrants
  );
  const [views, setViews] = useState<SupportViewPermission[]>(
    member.supportPermissionViews
  );
  const roleChanged = role !== null && member.role !== role;
  const isStudentCandidate = member.role === "student";
  const isPromotion = isStudentCandidate && role !== null;

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
        const changeKeys = new Set(
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
          current.filter((grant) => !changeKeys.has(grant))
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

  const title = isStudentCandidate
    ? `Promover ${member.name} para a equipe`
    : `Alterar acesso de ${member.name}`;
  const description = isStudentCandidate
    ? "Defina o papel administrativo e registre o motivo da promoção."
    : "Configure o papel e as permissões adicionais desta Conta.";
  const roleChangeConfirmation = getRoleChangeConfirmation(isPromotion, role);

  return (
    <DiscardAwareDialog
      className="max-w-2xl"
      description={description}
      onOpenChange={(open) => {
        if (!open && didSave.current) {
          didSave.current = false;
          onSuccess?.();
        }
      }}
      title={title}
      trigger={
        trigger ?? (
          <DialogTriggerButton
            className="min-h-10"
            size="default"
            variant="outline"
          >
            {isStudentCandidate ? "Promover para equipe" : "Alterar acesso"}
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
          didSave.current = true;
          router.refresh();
        }}
      >
        <DialogBody className="overscroll-contain p-4 sm:p-6">
          <div className="flex flex-col gap-5">
            <input name="targetUserId" type="hidden" value={member.userId} />
            {role ? <input name="role" type="hidden" value={role} /> : null}
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

            <StaffAccessEditor
              grants={grants}
              memberRole={member.role}
              onRoleChange={handleRoleChange}
              onToggle={togglePermission}
              reasonId={reasonId}
              role={role}
              roleId={roleId}
              views={views}
            />
          </div>
        </DialogBody>
        <DialogFooter className="px-4 sm:px-6">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </DialogClose>
          {roleChanged ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button">Revisar mudança</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Confirmar mudança de papel
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {roleChangeConfirmation}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Voltar</AlertDialogCancel>
                  <AlertDialogAction form={formId} type="submit">
                    Confirmar e salvar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <AdminMutationSubmitButton
              disabled={isStudentCandidate && role === null}
              type="submit"
            >
              {isStudentCandidate ? "Escolha um papel" : "Salvar acesso"}
            </AdminMutationSubmitButton>
          )}
        </DialogFooter>
      </AdminMutationForm>
    </DiscardAwareDialog>
  );
}

export const getStaffLastAccessLabel = formatLastAccess;
