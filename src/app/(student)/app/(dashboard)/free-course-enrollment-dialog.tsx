"use client";

import {
  BookOpen01Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { FreeEnrollmentButton } from "@/app/comprar/[slug]/free-enrollment-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTriggerButton,
} from "@/components/ui/dialog";
import { formatCourseWorkloadHours } from "@/features/courses/presentation";

type FreeEnrollmentAccessStatus = "expired" | "none";

interface FreeCourseEnrollmentDialogProps {
  accessStatus: FreeEnrollmentAccessStatus;
  courseId: string;
  description: string | null;
  lessonCount: number;
  title: string;
  workloadHours: number;
}

export function FreeCourseEnrollmentDialog({
  accessStatus,
  courseId,
  description,
  lessonCount,
  title,
  workloadHours,
}: FreeCourseEnrollmentDialogProps): React.JSX.Element {
  const isReactivation = accessStatus === "expired";
  const triggerLabel = isReactivation
    ? "Reativar acesso gratuito"
    : "Inscrever-se grátis";
  const dialogTitle = isReactivation
    ? "Retome seu acesso gratuito"
    : "Comece este Curso gratuitamente";
  const dialogDescription = isReactivation
    ? "Seu acesso anterior expirou. Confirme para reativar a inscrição e continuar sua jornada."
    : "Uma trilha pronta para você começar agora, sem cobrança ou Checkout.";
  const lessonLabel = `${lessonCount} ${lessonCount === 1 ? "aula" : "aulas"}`;

  return (
    <Dialog>
      <DialogTriggerButton
        className="relative z-20 w-full"
        size="sm"
        type="button"
      >
        <HugeiconsIcon
          aria-hidden="true"
          data-icon="inline-start"
          icon={BookOpen01Icon}
          size={16}
        />
        {triggerLabel}
      </DialogTriggerButton>

      <DialogContent className="max-w-xl">
        <DialogHeader className="border-0 bg-linear-to-br from-primary/10 via-card to-card p-6 pr-14 pb-5">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <HugeiconsIcon
                aria-hidden="true"
                icon={BookOpen01Icon}
                size={24}
                strokeWidth={1.8}
              />
            </div>
            <div className="min-w-0 space-y-2">
              <Badge variant="success">Curso gratuito</Badge>
              <DialogTitle className="text-xl tracking-tight">
                {dialogTitle}
              </DialogTitle>
              <DialogDescription>{dialogDescription}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="space-y-5 p-5 sm:p-6">
          <div>
            <p className="font-semibold text-foreground">{title}</p>
            <p className="mt-1 text-muted-foreground text-sm leading-6">
              {description ??
                "Acompanhe o conteúdo publicado no seu ritmo e retome quando quiser dentro da janela de acesso."}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <FreeCourseDetail
              icon={BookOpen01Icon}
              label="Conteúdo"
              value={lessonLabel}
            />
            <FreeCourseDetail
              icon={Clock01Icon}
              label="Carga horária"
              value={formatCourseWorkloadHours(workloadHours)}
            />
          </div>

          <section className="rounded-2xl border border-success/30 bg-success/10 p-4">
            <div className="flex items-start gap-3">
              <HugeiconsIcon
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-success"
                icon={CheckmarkCircle02Icon}
                size={20}
              />
              <div>
                <h3 className="font-semibold text-sm">O que acontece agora?</h3>
                <p className="mt-1 text-muted-foreground text-sm leading-6">
                  Seu acesso será liberado imediatamente. Não há cobrança, dados
                  de pagamento ou pedido financeiro envolvidos.
                </p>
              </div>
            </div>
          </section>

          <p className="text-muted-foreground text-xs leading-5">
            Você pode fechar esta janela sem alterar nada. A inscrição só será
            criada depois da confirmação.
          </p>
        </DialogBody>

        <DialogFooter className="gap-3 px-5 py-4 sm:px-6">
          <DialogClose asChild>
            <Button
              className="w-full sm:w-auto"
              type="button"
              variant="outline"
            >
              Agora não
            </Button>
          </DialogClose>
          <FreeEnrollmentButton
            className="w-full sm:w-auto"
            courseId={courseId}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FreeCourseDetail({
  icon,
  label,
  value,
}: {
  icon: typeof BookOpen01Icon;
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <div className="rounded-2xl border bg-muted/20 p-4">
      <HugeiconsIcon
        aria-hidden="true"
        className="text-primary"
        icon={icon}
        size={19}
        strokeWidth={1.8}
      />
      <p className="mt-3 text-muted-foreground text-xs uppercase tracking-[0.12em]">
        {label}
      </p>
      <p className="mt-1 font-semibold text-sm">{value}</p>
    </div>
  );
}
