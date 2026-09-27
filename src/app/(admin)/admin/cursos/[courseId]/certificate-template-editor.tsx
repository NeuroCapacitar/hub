"use client";

import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { FormSubmitButton } from "@/components/form-submit-button";
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
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  disableCertificateForCourseAction,
  enableCertificateForCourseAction,
} from "@/features/admin/actions";
import { reconcileHistoricalCertificatesAction } from "@/features/certificates/actions";
import {
  type CertificateTemplateSpec,
  isCertificateSignatoryConfigured,
} from "@/features/certificates/template-rules";
import {
  type CertificateTemplateEditorTemplate,
  CertificateTemplateForm,
} from "./certificate-template-form";
import { getCertificateEditorStatus } from "./certificate-template-view-model";

const getVersionStatusLabel = (
  status: CertificateTemplateEditorTemplate["status"]
): string => {
  if (status === "published") {
    return "Ativa";
  }
  if (status === "draft") {
    return "Rascunho";
  }
  return "Substituida";
};

const CertificateActivationMenuItem = ({
  canEnable,
  certificateEnabled,
  courseId,
  disabledMessage,
}: {
  canEnable: boolean;
  certificateEnabled: boolean;
  courseId: string;
  disabledMessage: string;
}): React.JSX.Element => {
  if (certificateEnabled) {
    return (
      <AlertDialogTrigger asChild>
        <DropdownMenuItem variant="destructive">
          Desligar certificado
        </DropdownMenuItem>
      </AlertDialogTrigger>
    );
  }
  if (canEnable) {
    return (
      <form action={enableCertificateForCourseAction.bind(null, courseId)}>
        <DropdownMenuItem asChild>
          <FormSubmitButton className="w-full" type="submit">
            Ligar certificado
          </FormSubmitButton>
        </DropdownMenuItem>
      </form>
    );
  }
  return <DropdownMenuItem disabled>{disabledMessage}</DropdownMenuItem>;
};

const PendingCertificateReconciliation = ({
  count,
  courseId,
  courseSignatoryConfigured,
}: {
  count: number;
  courseId: string;
  courseSignatoryConfigured: boolean;
}): React.JSX.Element | null => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (count <= 0) {
    return null;
  }

  const batchSize = Math.min(count, 100);
  const reconcile = (): void => {
    const formData = new FormData();
    formData.set("confirmed", "yes");
    formData.set("courseId", courseId);
    startTransition(async () => {
      const result = await reconcileHistoricalCertificatesAction(formData);
      if (result.status === "error") {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <p className="font-medium text-sm">
          {count} conclusões aguardam certificado
        </p>
        <p className="text-muted-foreground text-xs">
          {courseSignatoryConfigured
            ? "A emissão ocorre em lotes de até 100."
            : "Configure o responsável em Configurações do curso. O Curso também precisa ter um modelo publicado antes da emissão."}
        </p>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            disabled={isPending || !courseSignatoryConfigured}
            size="sm"
            variant="outline"
          >
            Emitir certificados pendentes
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Emitir certificados pendentes?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação inicia a geração do PDF e o envio do e-mail para cada
              aluno elegível. Certificados com qualquer histórico, inclusive
              revogados, não serão duplicados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={isPending} onClick={reconcile}>
              Emitir {batchSize} certificados
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export function CertificateTemplateEditor({
  certificateEnabled,
  courseId,
  courseTitle,
  courseWorkloadHours = 0,
  issuerCnpj,
  issuerConfigured,
  issuerDisplayName,
  pendingCertificateReconciliationCount = 0,
  signerName,
  signerRole,
  templates,
}: {
  certificateEnabled: boolean;
  courseId: string;
  courseTitle: string;
  courseWorkloadHours?: number;
  issuerCnpj: string | null;
  issuerConfigured: boolean;
  issuerDisplayName: string | null;
  pendingCertificateReconciliationCount?: number;
  signerName?: string | null;
  signerRole?: string | null;
  templates: Array<
    CertificateTemplateEditorTemplate & { spec: CertificateTemplateSpec }
  >;
}): React.JSX.Element {
  const draft = templates.find((template) => template.status === "draft");
  const active = templates.find((template) => template.status === "published");
  const editable = draft ?? active;
  const courseSignatoryConfigured = isCertificateSignatoryConfigured(
    signerName,
    signerRole
  );
  const status = getCertificateEditorStatus({
    certificateEnabled,
    hasDraft: Boolean(draft),
    hasPublished: Boolean(active),
    signatoryConfigured: courseSignatoryConfigured,
  });
  const canEnable = Boolean(
    active && issuerConfigured && courseSignatoryConfigured
  );
  let activationDisabledMessage =
    "Configure nome e cargo em Configurações do curso";
  if (!active) {
    activationDisabledMessage =
      "Publique um template para ativar o certificado";
  }
  if (!issuerConfigured) {
    activationDisabledMessage = "Configure o perfil emissor antes de ativar";
  }

  return (
    <Card className="gap-0 py-0">
      <PendingCertificateReconciliation
        count={pendingCertificateReconciliationCount}
        courseId={courseId}
        courseSignatoryConfigured={courseSignatoryConfigured}
      />
      <CertificateTemplateForm
        courseId={courseId}
        courseTitle={courseTitle}
        courseWorkloadHours={courseWorkloadHours}
        hasPublishedTemplate={Boolean(active)}
        issuerCnpj={issuerCnpj}
        issuerConfigured={issuerConfigured}
        issuerDisplayName={issuerDisplayName}
        signerName={signerName ?? null}
        signerRole={signerRole ?? null}
        status={status}
        template={editable}
      >
        <Sheet>
          <AlertDialog>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button aria-label="Mais ações" size="icon" variant="ghost">
                  <HugeiconsIcon aria-hidden="true" icon={MoreHorizontalIcon} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <SheetTrigger asChild>
                    <DropdownMenuItem>Histórico de versões</DropdownMenuItem>
                  </SheetTrigger>
                  <CertificateActivationMenuItem
                    canEnable={canEnable}
                    certificateEnabled={certificateEnabled}
                    courseId={courseId}
                    disabledMessage={activationDisabledMessage}
                  />
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <SheetContent>
              <SheetHeader className="p-4 pr-14">
                <SheetTitle>Histórico de versões</SheetTitle>
                <SheetDescription>
                  Versões anteriores continuam como evidência dos certificados
                  emitidos.
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 flex flex-col gap-3">
                {templates.length > 0 ? (
                  templates.map((template) => (
                    <div
                      className="flex min-h-10 items-center justify-between gap-4 rounded-lg bg-muted/50 px-3 py-2 text-sm"
                      key={`${template.version}-${template.status}`}
                    >
                      <span className="tabular-nums">
                        Versão {template.version}
                      </span>
                      <Badge
                        variant={
                          template.status === "published"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {getVersionStatusLabel(template.status)}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <Empty className="p-8">
                    <EmptyHeader>
                      <EmptyTitle as="h3">Nenhuma versão</EmptyTitle>
                      <EmptyDescription>
                        Salve o primeiro rascunho para iniciar o histórico.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}
              </div>
            </SheetContent>

            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Desligar certificado?</AlertDialogTitle>
                <AlertDialogDescription>
                  Novas emissões serão interrompidas. Certificados existentes
                  permanecem válidos e disponíveis.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <form
                  action={disableCertificateForCourseAction.bind(
                    null,
                    courseId
                  )}
                >
                  <AlertDialogAction type="submit">
                    Sim, desligar certificado
                  </AlertDialogAction>
                </form>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Sheet>
      </CertificateTemplateForm>
    </Card>
  );
}
