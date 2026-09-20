"use client";

import { ViewIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { AdminCourseStudentAction } from "@/features/admin/student-navigation";
import {
  StudentActionDialog,
  type StudentActionDialogAction,
} from "./student-action-dialog";
import { StudentManagementSheet } from "./student-management-sheet";
import type { StudentManagementCapabilities } from "./student-management-types";

export interface StudentActionMenuStudent {
  email: string;
  name: string;
  platformBlockedAt: string | null;
  platformBlockedReason: string | null;
  userId: string;
}

type StudentActionOverlay = "details" | StudentActionDialogAction | null;

const readOnlyStudentCapabilities: StudentManagementCapabilities = {
  canManageCertificates: false,
  canManageEnrollmentAccess: false,
  canManageEnrollmentSupport: false,
  canManagePlatformAccess: false,
  canReissueCertificates: false,
};

const globalPlatformCapabilities: StudentManagementCapabilities = {
  ...readOnlyStudentCapabilities,
  canManagePlatformAccess: true,
};

const courseEnrollmentCapabilities: StudentManagementCapabilities = {
  ...readOnlyStudentCapabilities,
  canManageEnrollmentAccess: true,
  canManageEnrollmentSupport: true,
};

const courseCertificateCapabilities: StudentManagementCapabilities = {
  ...readOnlyStudentCapabilities,
  canManageCertificates: true,
  canReissueCertificates: true,
};

function getDetailsCapabilities({
  certificateCapabilities,
  enrollmentCapabilities,
  isCourseContext,
  platformCapabilities,
}: {
  certificateCapabilities: StudentManagementCapabilities;
  enrollmentCapabilities: StudentManagementCapabilities;
  isCourseContext: boolean;
  platformCapabilities: StudentManagementCapabilities;
}): StudentManagementCapabilities {
  if (isCourseContext) {
    return {
      canManageCertificates: certificateCapabilities.canManageCertificates,
      canManageEnrollmentAccess:
        enrollmentCapabilities.canManageEnrollmentAccess ?? false,
      canManageEnrollmentSupport:
        enrollmentCapabilities.canManageEnrollmentSupport,
      canManagePlatformAccess: false,
      canReissueCertificates: certificateCapabilities.canReissueCertificates,
    };
  }

  return {
    ...readOnlyStudentCapabilities,
    canManagePlatformAccess: platformCapabilities.canManagePlatformAccess,
  };
}

function StudentActionOverlays({
  activeOverlay,
  certificateCapabilities,
  courseId,
  dataUrl,
  enrollmentCapabilities,
  isCourseContext,
  onDetailsCloseAutoFocus,
  onOpenChange,
  platformCapabilities,
  student,
}: {
  activeOverlay: StudentActionOverlay;
  certificateCapabilities: StudentManagementCapabilities;
  courseId?: string;
  dataUrl?: string;
  enrollmentCapabilities: StudentManagementCapabilities;
  isCourseContext: boolean;
  onDetailsCloseAutoFocus: (event: Event) => void;
  onOpenChange: (open: boolean) => void;
  platformCapabilities: StudentManagementCapabilities;
  student: StudentActionMenuStudent;
}): React.JSX.Element | null {
  if (activeOverlay === "details") {
    return (
      <StudentManagementSheet
        capabilities={getDetailsCapabilities({
          certificateCapabilities,
          enrollmentCapabilities,
          isCourseContext,
          platformCapabilities,
        })}
        {...(courseId ? { courseId } : {})}
        {...(dataUrl ? { dataUrl } : {})}
        onCloseAutoFocus={onDetailsCloseAutoFocus}
        onOpenChange={onOpenChange}
        open
        showActions={isCourseContext}
        trigger={null}
        userId={student.userId}
      />
    );
  }

  if (isCourseContext && activeOverlay === "enrollment") {
    return (
      <StudentActionDialog
        action="enrollment"
        capabilities={enrollmentCapabilities}
        {...(courseId ? { courseId } : {})}
        {...(dataUrl ? { dataUrl } : {})}
        onOpenChange={onOpenChange}
        open
        trigger={null}
        userId={student.userId}
      />
    );
  }

  if (isCourseContext && activeOverlay === "certificate") {
    return (
      <StudentActionDialog
        action="certificate"
        capabilities={certificateCapabilities}
        {...(courseId ? { courseId } : {})}
        {...(dataUrl ? { dataUrl } : {})}
        onOpenChange={onOpenChange}
        open
        trigger={null}
        userId={student.userId}
      />
    );
  }

  if (!isCourseContext && activeOverlay === "platform") {
    return (
      <StudentActionDialog
        action="platform"
        capabilities={platformCapabilities}
        onOpenChange={onOpenChange}
        open
        platformStudent={student}
        trigger={null}
        userId={student.userId}
      />
    );
  }

  return null;
}

export function StudentActionsMenu({
  certificateCapabilities = courseCertificateCapabilities,
  courseId,
  dataUrl,
  enrollmentCapabilities = courseEnrollmentCapabilities,
  initialOverlay,
  onInitialOverlayClose,
  platformCapabilities = globalPlatformCapabilities,
  student,
}: {
  certificateCapabilities?: StudentManagementCapabilities;
  courseId?: string;
  dataUrl?: string;
  enrollmentCapabilities?: StudentManagementCapabilities;
  initialOverlay?: AdminCourseStudentAction | undefined;
  onInitialOverlayClose?: (() => void) | undefined;
  platformCapabilities?: StudentManagementCapabilities;
  student: StudentActionMenuStudent;
}): React.JSX.Element {
  const [activeOverlay, setActiveOverlay] =
    useState<StudentActionOverlay>(null);
  const actionTriggerRef = useRef<HTMLButtonElement | null>(null);
  const hasAutoOpened = useRef(false);
  const isCourseContext = Boolean(courseId);

  useEffect(() => {
    if (!(initialOverlay && !hasAutoOpened.current)) {
      return;
    }
    hasAutoOpened.current = true;
    setActiveOverlay(initialOverlay);
  }, [initialOverlay]);

  const handleOverlayChange = (open: boolean): void => {
    if (!open) {
      const closedOverlay = activeOverlay;
      setActiveOverlay(null);
      if (closedOverlay === initialOverlay) {
        onInitialOverlayClose?.();
      }
    }
  };

  const restoreDetailsFocus = (event: Event): void => {
    event.preventDefault();
    actionTriggerRef.current?.focus();
  };

  return (
    <>
      <Button
        aria-label={`Abrir ficha de ${student.name}`}
        className="min-h-10"
        onClick={() => setActiveOverlay("details")}
        ref={actionTriggerRef}
        type="button"
        variant="outline"
      >
        <HugeiconsIcon
          aria-hidden="true"
          data-icon="inline-start"
          icon={ViewIcon}
          size={16}
          strokeWidth={2}
        />
        Abrir ficha
      </Button>
      <StudentActionOverlays
        activeOverlay={activeOverlay}
        certificateCapabilities={certificateCapabilities}
        {...(courseId ? { courseId } : {})}
        {...(dataUrl ? { dataUrl } : {})}
        enrollmentCapabilities={enrollmentCapabilities}
        isCourseContext={isCourseContext}
        onDetailsCloseAutoFocus={restoreDetailsFocus}
        onOpenChange={handleOverlayChange}
        platformCapabilities={platformCapabilities}
        student={student}
      />
    </>
  );
}
