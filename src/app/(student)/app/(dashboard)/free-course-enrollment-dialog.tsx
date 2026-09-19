"use client";

import {
  BookOpen01Icon,
  Certificate01Icon,
  Folder01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { FreeEnrollmentButton } from "@/app/comprar/[slug]/free-enrollment-button";
import { Button } from "@/components/ui/button";
import { DialogClose } from "@/components/ui/dialog";
import {
  CourseOfferAccessNote,
  CourseOfferDialog,
  type CourseOfferFact,
  type CourseOfferTriggerKind,
} from "@/features/courses/course-offer-dialog";

type FreeEnrollmentAccessStatus = "expired" | "none";

interface FreeCourseEnrollmentDialogProps {
  accessStatus: FreeEnrollmentAccessStatus;
  certificateEnabled: boolean;
  courseId: string;
  coverBlurDataUrl: string | null;
  description: string | null;
  lessonCount: number;
  moduleCount: number;
  thumbnailUrl: string | null;
  title: string;
  triggerKind?: CourseOfferTriggerKind;
}

export function FreeCourseEnrollmentDialog({
  accessStatus,
  certificateEnabled,
  courseId,
  coverBlurDataUrl,
  description,
  lessonCount,
  moduleCount,
  thumbnailUrl,
  title,
  triggerKind = "action",
}: FreeCourseEnrollmentDialogProps): React.JSX.Element {
  const isReactivation = accessStatus === "expired";
  const triggerLabel = isReactivation
    ? "Reativar acesso gratuito"
    : "Inscrever-se grátis";
  const dialogDescription = isReactivation
    ? "Seu acesso anterior expirou. Reative-o em uma etapa."
    : "Confira o que está incluído antes de começar.";
  let freeAccessNoteDescription =
    "Aulas publicadas para você começar no seu ritmo, sem cobrança.";
  const facts: CourseOfferFact[] = [];

  if (isReactivation) {
    freeAccessNoteDescription = "Seu acesso será reativado imediatamente.";
  } else if (certificateEnabled) {
    freeAccessNoteDescription =
      "Aulas publicadas e Certificado ao concluir, sem cobrança.";
  }

  if (lessonCount > 0) {
    const contentFact: CourseOfferFact = {
      icon: BookOpen01Icon,
      label: "Conteúdo",
      value: `${lessonCount} ${lessonCount === 1 ? "aula" : "aulas"}`,
    };
    if (moduleCount > 0) {
      contentFact.secondaryValue = `${moduleCount} ${
        moduleCount === 1 ? "módulo" : "módulos"
      }`;
    }
    facts.push(contentFact);
  } else if (moduleCount > 0) {
    facts.push({
      icon: Folder01Icon,
      label: "Conteúdo",
      value: `${moduleCount} ${moduleCount === 1 ? "módulo" : "módulos"}`,
    });
  }

  if (certificateEnabled) {
    facts.push({
      icon: Certificate01Icon,
      label: "Certificado",
      value: "Ao concluir",
    });
  }

  return (
    <CourseOfferDialog
      badgeLabel={isReactivation ? "Reativação gratuita" : "Curso gratuito"}
      courseDescription={description}
      courseTitle={title}
      coverBlurDataUrl={coverBlurDataUrl}
      dialogDescription={dialogDescription}
      facts={facts}
      footer={
        <>
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
        </>
      }
      thumbnailUrl={thumbnailUrl}
      trigger={
        triggerKind === "card" ? (
          <Button
            aria-label={`Abrir resumo do Curso ${title}`}
            className="absolute inset-0 z-10 h-full w-full rounded-xl bg-transparent p-0 opacity-0 hover:bg-transparent focus-visible:opacity-100"
            type="button"
            variant="ghost"
          >
            <span className="sr-only">Abrir resumo do Curso {title}</span>
          </Button>
        ) : (
          <Button className="relative z-20 w-full" size="sm" type="button">
            <HugeiconsIcon
              aria-hidden="true"
              data-icon="inline-start"
              icon={BookOpen01Icon}
              size={16}
            />
            {triggerLabel}
          </Button>
        )
      }
    >
      <CourseOfferAccessNote
        description={freeAccessNoteDescription}
        title={isReactivation ? "Reativação imediata" : "O que você recebe"}
      />
    </CourseOfferDialog>
  );
}
