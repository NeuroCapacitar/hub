"use client";

import { UserGroupIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  getStaffLastAccessLabel,
  STAFF_ROLE_LABELS,
  STAFF_ROLE_VARIANTS,
  StaffAccessDialog,
  type StaffAccessMember,
} from "@/components/admin/staff-access-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
} from "@/components/ui/table";

const getAccessSummary = (member: StaffAccessMember): React.JSX.Element => {
  if (member.role !== "support") {
    return <Badge variant="secondary">Acesso total</Badge>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge
        variant={member.supportPermissionViews.length ? "outline" : "secondary"}
      >
        {member.supportPermissionViews.length
          ? `${member.supportPermissionViews.length} leituras protegidas`
          : "Leituras padrão"}
      </Badge>
      <Badge
        variant={
          member.supportPermissionGrants.length ? "secondary" : "outline"
        }
      >
        {member.supportPermissionGrants.length
          ? `${member.supportPermissionGrants.length} alterações delegadas`
          : "Sem alterações delegadas"}
      </Badge>
    </div>
  );
};

export function StaffAccessTable({
  actorUserId,
  members,
}: {
  actorUserId: string;
  members: StaffAccessMember[];
}): React.JSX.Element {
  return (
    <div className="rounded-lg border">
      <Table className="min-w-[900px]">
        <TableCaption className="sr-only">
          Membros da equipe e respectivos níveis de acesso
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Pessoa</TableHead>
            <TableHead>Papel</TableHead>
            <TableHead>Acesso</TableHead>
            <TableHead className="whitespace-nowrap">Último acesso</TableHead>
            <TableHead className="whitespace-nowrap text-right">
              Ações
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.length ? (
            members.map((member) => {
              const isSelf = member.userId === actorUserId;
              return (
                <TableRow key={member.userId}>
                  <TableRowHeader>
                    <div className="font-medium">{member.name}</div>
                    <div className="text-muted-foreground text-xs">
                      {member.email}
                    </div>
                  </TableRowHeader>
                  <TableCell>
                    <Badge variant={STAFF_ROLE_VARIANTS[member.role]}>
                      {STAFF_ROLE_LABELS[member.role]}
                    </Badge>
                  </TableCell>
                  <TableCell>{getAccessSummary(member)}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {getStaffLastAccessLabel(member.lastAccessAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    {isSelf ? (
                      <span className="text-muted-foreground text-xs">
                        Sua conta
                      </span>
                    ) : (
                      <StaffAccessDialog member={member} />
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell className="h-48 p-0" colSpan={5}>
                <Empty className="rounded-none border-0">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <HugeiconsIcon aria-hidden="true" icon={UserGroupIcon} />
                    </EmptyMedia>
                    <EmptyTitle as="h3">Nenhuma conta na equipe</EmptyTitle>
                    <EmptyDescription>
                      Convide alguém para a equipe. O acesso será aplicado
                      somente depois que a pessoa aceitar o convite.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
