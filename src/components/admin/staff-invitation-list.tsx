"use client";

import {
  AdminMutationForm,
  AdminMutationSubmitButton,
} from "@/components/admin-mutation-form";
import { Badge } from "@/components/ui/badge";
import {
  resendStaffInvitationAction,
  revokeStaffInvitationAction,
} from "@/features/admin/staff-invitation-actions";
import type { StaffInvitationSummary } from "@/features/admin/staff-invitations";
import { STAFF_ROLE_LABELS } from "./staff-access-dialog";

const formatExpiry = (value: Date): string =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(value);

export function StaffInvitationList({
  invitations,
}: {
  invitations: StaffInvitationSummary[];
}): React.JSX.Element {
  if (!invitations.length) {
    return (
      <p className="text-muted-foreground text-sm">
        Não há convites pendentes. O acesso só será concedido depois que a
        pessoa aceitar o link enviado por e-mail.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {invitations.map((invitation) => (
        <li
          className="flex flex-col gap-4 rounded-card border bg-card/40 p-4 sm:flex-row sm:items-center sm:justify-between"
          key={invitation.id}
        >
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="break-all font-medium">{invitation.email}</p>
              <Badge
                variant={invitation.role === "admin" ? "default" : "secondary"}
              >
                {STAFF_ROLE_LABELS[invitation.role]}
              </Badge>
              {invitation.status === "expired" ? (
                <Badge variant="outline">Expirado</Badge>
              ) : (
                <Badge variant="outline">Aguardando aceite</Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm">
              {invitation.status === "expired"
                ? "O link expirou"
                : "Expira em " +
                  formatExpiry(invitation.expiresAt) +
                  " (horário de Brasília)"}
              {" · "}Enviado por {invitation.inviterName}
            </p>
            <p className="text-muted-foreground text-xs">
              Motivo: {invitation.reason}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
            <AdminMutationForm
              action={resendStaffInvitationAction}
              pendingMessage="Reenviando convite…"
              successMessage="Solicitação de reenvio registrada. Os links anteriores não funcionam mais; a fila processará o novo e-mail."
            >
              <input name="invitationId" type="hidden" value={invitation.id} />
              <AdminMutationSubmitButton type="submit" variant="outline">
                Reenviar
              </AdminMutationSubmitButton>
            </AdminMutationForm>
            {invitation.status === "pending" ? (
              <AdminMutationForm
                action={revokeStaffInvitationAction}
                pendingMessage="Cancelando convite…"
                successMessage="Convite cancelado."
              >
                <input
                  name="invitationId"
                  type="hidden"
                  value={invitation.id}
                />
                <AdminMutationSubmitButton type="submit" variant="destructive">
                  Cancelar
                </AdminMutationSubmitButton>
              </AdminMutationForm>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
