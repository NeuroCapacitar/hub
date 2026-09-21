"use client";

import { Delete02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { CoursePublicationActionResult } from "@/features/admin/actions";
import {
  createCoursePublicationDraftAction,
  discardCoursePublicationDraftAction,
  publishCoursePublicationAction,
} from "@/features/admin/actions";

type CoursePublicationActionType = "prepare" | "publish";

const ACTION_COPY = {
  prepare: {
    idle: "Preparar alterações",
    pending: "Preparando…",
    success: "Alterações preparadas.",
  },
  publish: {
    idle: "Publicar alterações",
    pending: "Publicando…",
    success: "Alterações publicadas.",
  },
} as const;

interface CoursePublicationActionProps {
  action: CoursePublicationActionType;
  courseId: string;
}

export function CoursePublicationAction({
  action,
  courseId,
}: CoursePublicationActionProps): React.JSX.Element {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const submissionInFlight = useRef(false);
  const copy = ACTION_COPY[action];

  const submit = (): Promise<CoursePublicationActionResult> =>
    action === "prepare"
      ? createCoursePublicationDraftAction(courseId)
      : publishCoursePublicationAction(courseId);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (submissionInFlight.current) {
      return;
    }

    submissionInFlight.current = true;
    setErrorMessage(null);
    const toastId = toast.loading(copy.pending);

    startTransition(async () => {
      try {
        const result = await submit();
        if (!result.ok) {
          setErrorMessage(result.message);
          toast.error(result.message, { id: toastId });
          return;
        }

        toast.success(copy.success, { id: toastId });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Não foi possível concluir a operação. Tente novamente.";
        setErrorMessage(message);
        toast.error(message, { id: toastId });
      } finally {
        submissionInFlight.current = false;
      }
    });
  };

  return (
    <form className="flex flex-col items-start gap-2" onSubmit={handleSubmit}>
      <Button loading={isPending} size="sm" type="submit">
        {copy.idle}
      </Button>
      {errorMessage ? (
        <p
          aria-live="assertive"
          className="text-destructive text-xs"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}
    </form>
  );
}

export function CoursePublicationDiscardAction({
  courseId,
}: {
  courseId: string;
}): React.JSX.Element {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const submissionInFlight = useRef(false);

  const handleDiscard = (): void => {
    if (submissionInFlight.current) {
      return;
    }

    submissionInFlight.current = true;
    setErrorMessage(null);
    const toastId = toast.loading("Descartando alterações…");

    startTransition(async () => {
      try {
        const result = await discardCoursePublicationDraftAction(courseId);
        if (!result.ok) {
          setErrorMessage(result.message);
          toast.error(result.message, { id: toastId });
          return;
        }

        setIsOpen(false);
        toast.success("Alterações descartadas.", { id: toastId });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Não foi possível descartar as alterações. Tente novamente.";
        setErrorMessage(message);
        toast.error(message, { id: toastId });
      } finally {
        submissionInFlight.current = false;
      }
    });
  };

  return (
    <AlertDialog onOpenChange={setIsOpen} open={isOpen}>
      <AlertDialogTrigger asChild>
        <Button
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={isPending}
          size="sm"
          type="button"
          variant="outline"
        >
          <HugeiconsIcon
            aria-hidden="true"
            data-icon="inline-start"
            icon={Delete02Icon}
            size={16}
            strokeWidth={2}
          />
          Descartar
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <HugeiconsIcon aria-hidden="true" icon={Delete02Icon} />
          </AlertDialogMedia>
          <AlertDialogTitle>Descartar preparação?</AlertDialogTitle>
          <AlertDialogDescription>
            Todas as alterações preparadas serão removidas e o curso voltará a
            mostrar a última publicação. Essa ação não pode ser desfeita.
          </AlertDialogDescription>
          {errorMessage ? (
            <p
              aria-live="assertive"
              className="text-destructive text-sm"
              role="alert"
            >
              {errorMessage}
            </p>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(event) => {
              event.preventDefault();
              handleDiscard();
            }}
            variant="destructive"
          >
            {isPending ? "Descartando…" : "Descartar preparação"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
