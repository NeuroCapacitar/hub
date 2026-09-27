"use client";

import { ShoppingBasketDone01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DialogClose } from "@/components/ui/dialog";
import {
  CourseOfferDialog,
  CourseOfferInfoNote,
  CourseOfferPrice,
  type CourseOfferTriggerKind,
} from "@/features/courses/course-offer-dialog";
import {
  getCourseOfferFacts,
  getCourseOfferPaymentDetails,
} from "@/features/courses/course-offer-facts";
import type { StudentCatalogCourseCard } from "@/features/courses/server";
import { formatCurrencyInCents } from "@/lib/formatters";
import { route } from "@/lib/routes";

export function CoursePurchaseDialog({
  course,
  triggerKind = "action",
}: {
  course: StudentCatalogCourseCard;
  triggerKind?: CourseOfferTriggerKind;
}): React.JSX.Element {
  const isRenewal = course.accessStatus === "expired";
  const facts = getCourseOfferFacts(course);
  const paymentDetails = getCourseOfferPaymentDetails(course);

  return (
    <CourseOfferDialog
      badgeLabel={isRenewal ? "Renovação de acesso" : "Compra do Curso"}
      courseDescription={course.description}
      courseTitle={course.title}
      coverBlurDataUrl={course.coverBlurDataUrl}
      dialogDescription={
        isRenewal
          ? "Renove seu acesso e retome o Curso de onde parou."
          : "Confira os detalhes antes de seguir para a compra."
      }
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
          <Button asChild className="w-full sm:w-auto">
            <Link href={route(`/comprar/${course.slug}`)}>
              {isRenewal ? "Renovar acesso" : "Comprar agora"}
            </Link>
          </Button>
        </>
      }
      thumbnailUrl={course.thumbnailUrl}
      trigger={
        triggerKind === "card" ? (
          <Button
            aria-label={`Abrir resumo do Curso ${course.title}`}
            className="absolute inset-0 z-10 h-full w-full rounded-surface bg-transparent p-0 opacity-0 hover:bg-transparent focus-visible:opacity-100"
            type="button"
            variant="ghost"
          >
            <span className="sr-only">
              Abrir resumo do Curso {course.title}
            </span>
          </Button>
        ) : (
          <Button className="relative z-20 w-full" size="sm" type="button">
            <HugeiconsIcon
              aria-hidden="true"
              data-icon="inline-start"
              icon={ShoppingBasketDone01Icon}
            />
            {isRenewal ? "Renovar acesso" : "Adquirir acesso"}
          </Button>
        )
      }
    >
      <CourseOfferPrice
        {...(paymentDetails ? { details: paymentDetails } : {})}
        value={formatCurrencyInCents(course.priceInCents)}
      />
      <CourseOfferInfoNote
        description="A compra será concluída na próxima etapa. O acesso será liberado após a confirmação."
        title="Próxima etapa"
      />
    </CourseOfferDialog>
  );
}
