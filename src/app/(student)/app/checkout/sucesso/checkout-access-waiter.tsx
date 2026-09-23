"use client";

import { BookOpen01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { SupportRequestDialog } from "@/components/support-request-dialog";
import { Button } from "@/components/ui/button";
import type { StudentCheckoutCourseContext } from "@/features/courses/checkout-course-context";
import { CourseCoverImage } from "@/features/courses/course-cover-image";

interface AccessResponse {
  canAccess?: boolean;
  redirectTo?: string;
}

const POLL_INTERVAL_MS = 2500;
const MAX_ATTEMPTS = 30;

export function CheckoutAccessWaiter({
  courseId,
  courseContext,
}: {
  courseId: string | null;
  courseContext: StudentCheckoutCourseContext | null;
}): React.JSX.Element {
  const [isChecking, setIsChecking] = useState(false);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const [pollingCycle, setPollingCycle] = useState(0);
  const [statusText, setStatusText] = useState(
    courseId
      ? "Estamos confirmando seu acesso automaticamente."
      : "Volte para seus cursos para conferir o acesso."
  );
  const attemptsRef = useRef(0);
  const checkingRef = useRef(false);
  const stoppedRef = useRef(false);

  const checkAccess = useCallback(async (): Promise<void> => {
    if (!(courseId && !stoppedRef.current && !checkingRef.current)) {
      return;
    }

    checkingRef.current = true;
    setIsChecking(true);

    try {
      const response = await fetch(
        `/api/enrollments/access?courseId=${encodeURIComponent(courseId)}`,
        {
          cache: "no-store",
          credentials: "same-origin",
          headers: { "ngrok-skip-browser-warning": "true" },
        }
      );

      if (!response.ok) {
        setStatusText("Ainda estamos confirmando seu acesso.");
        return;
      }

      const data = (await response.json()) as AccessResponse;

      if (data.canAccess && data.redirectTo) {
        stoppedRef.current = true;
        setStatusText("Acesso liberado. Abrindo seu curso…");
        window.location.replace(data.redirectTo);
        return;
      }

      setStatusText("Ainda estamos confirmando seu acesso.");
    } finally {
      const nextAttempt = attemptsRef.current + 1;
      attemptsRef.current = nextAttempt;
      checkingRef.current = false;
      setIsChecking(false);
      if (!stoppedRef.current && nextAttempt >= MAX_ATTEMPTS) {
        setHasTimedOut(true);
        setStatusText(
          "Ainda não conseguimos confirmar seu acesso automaticamente."
        );
      }
    }
  }, [courseId]);

  const scheduleCheckAccess = useCallback((): void => {
    checkAccess().catch(() => {
      setStatusText("Ainda estamos confirmando seu acesso.");
    });
  }, [checkAccess]);

  const handleManualCheck = (): void => {
    attemptsRef.current = 0;
    setHasTimedOut(false);
    setStatusText("Estamos confirmando seu acesso automaticamente.");
    setPollingCycle((cycle) => cycle + 1);
  };

  useEffect(() => {
    if (!courseId) {
      return;
    }

    if (pollingCycle > 0) {
      attemptsRef.current = 0;
      stoppedRef.current = false;
    }

    scheduleCheckAccess();
    const interval = window.setInterval(() => {
      if (stoppedRef.current || attemptsRef.current >= MAX_ATTEMPTS) {
        window.clearInterval(interval);
        return;
      }

      scheduleCheckAccess();
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [courseId, pollingCycle, scheduleCheckAccess]);

  return (
    <div className="mt-5 flex flex-col gap-4">
      {courseContext ? (
        <div className="flex max-w-full items-center gap-3 rounded-lg border bg-background/45 p-3">
          <div className="relative aspect-video w-16 shrink-0 overflow-hidden rounded-md bg-muted">
            {courseContext.thumbnailUrl ? (
              <CourseCoverImage
                alt=""
                blurDataUrl={courseContext.coverBlurDataUrl}
                sizes="64px"
                src={courseContext.thumbnailUrl}
              />
            ) : (
              <HugeiconsIcon
                aria-hidden="true"
                className="absolute top-1/2 left-1/2 size-6 -translate-x-1/2 -translate-y-1/2 text-muted-foreground"
                icon={BookOpen01Icon}
              />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs">Curso</p>
            <p className="truncate font-medium text-sm">
              {courseContext.title}
            </p>
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border bg-muted/40 p-4">
        <p
          aria-live="polite"
          className="text-muted-foreground text-sm leading-6"
        >
          {statusText}
        </p>
        {courseId ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              loading={isChecking}
              onClick={handleManualCheck}
              type="button"
              variant="outline"
            >
              {hasTimedOut ? "Verificar novamente" : "Verificar agora"}
            </Button>
            {hasTimedOut && courseContext ? (
              <SupportRequestDialog
                courseTitle={courseContext.title}
                triggerSize="sm"
                triggerVariant="ghost"
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
