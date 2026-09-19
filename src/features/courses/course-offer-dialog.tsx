"use client";

import {
  BookOpen01Icon,
  Calendar03Icon,
  Certificate01Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  Folder01Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getEffectiveMaxInstallmentCount } from "@/features/payments/course-payment-offer";
import { cn } from "@/lib/utils";
import { CourseCoverImage } from "./course-cover-image";
import type { CourseOfferSummaryData } from "./course-offer-summary";

export interface CourseOfferFact {
  icon: typeof BookOpen01Icon;
  label: string;
  secondaryValue?: string;
  value: string;
}

export type CourseOfferTriggerKind = "action" | "card";

export const getCourseOfferFacts = (
  offer: CourseOfferSummaryData
): CourseOfferFact[] => {
  const facts: CourseOfferFact[] = [];

  if (offer.lessonCount > 0) {
    const contentFact: CourseOfferFact = {
      icon: BookOpen01Icon,
      label: "Conteúdo",
      value: `${offer.lessonCount} ${offer.lessonCount === 1 ? "aula" : "aulas"}`,
    };
    if (offer.moduleCount > 0) {
      contentFact.secondaryValue = `${offer.moduleCount} ${
        offer.moduleCount === 1 ? "módulo" : "módulos"
      }`;
    }
    facts.push(contentFact);
  } else if (offer.moduleCount > 0) {
    facts.push({
      icon: Folder01Icon,
      label: "Conteúdo",
      value: `${offer.moduleCount} ${
        offer.moduleCount === 1 ? "módulo" : "módulos"
      }`,
    });
  }

  if (offer.workloadHours > 0) {
    facts.push({
      icon: Clock01Icon,
      label: "Carga horária",
      value: `${offer.workloadHours} ${
        offer.workloadHours === 1 ? "hora" : "horas"
      }`,
    });
  }

  if (offer.accessDurationMonths > 0) {
    facts.push({
      icon: Calendar03Icon,
      label: "Acesso",
      value: `${offer.accessDurationMonths} ${
        offer.accessDurationMonths === 1 ? "mês" : "meses"
      }`,
    });
  }

  if (offer.certificateEnabled) {
    facts.push({
      icon: Certificate01Icon,
      label: "Certificado",
      value: "Ao concluir",
    });
  }

  return facts;
};

export const getCourseOfferPaymentDetails = (
  offer: CourseOfferSummaryData
): string | undefined => {
  const paymentMethods: string[] = [];

  if (offer.paymentAllowPix) {
    paymentMethods.push("Pix");
  }

  if (offer.paymentAllowCreditCard) {
    const maxInstallments = getEffectiveMaxInstallmentCount({
      configuredMaxInstallmentCount: offer.paymentMaxInstallmentCount,
      priceInCents: offer.priceInCents,
    });
    paymentMethods.push(
      maxInstallments > 1 ? `cartão em até ${maxInstallments}x` : "cartão"
    );
  }

  return paymentMethods.length > 0
    ? `Aceita ${paymentMethods.join(" ou ")}`
    : undefined;
};

interface CourseOfferHeroProps {
  badgeLabel: string;
  coverBlurDataUrl: string | null;
  description: ReactNode;
  thumbnailUrl: string | null;
  title: ReactNode;
}

export function CourseOfferHero({
  badgeLabel,
  coverBlurDataUrl,
  description,
  thumbnailUrl,
  title,
}: CourseOfferHeroProps): React.JSX.Element {
  return (
    <header className="relative isolate min-h-40 justify-end overflow-hidden border-0 pr-14">
      <div className="absolute inset-0">
        {thumbnailUrl ? (
          <CourseCoverImage
            alt=""
            blurDataUrl={coverBlurDataUrl}
            className="opacity-75"
            sizes="(max-width: 672px) 100vw, 672px"
            src={thumbnailUrl}
          />
        ) : (
          <div className="absolute inset-0 bg-linear-to-br from-card via-card to-primary/25">
            <HugeiconsIcon
              aria-hidden="true"
              className="absolute top-1/2 left-1/2 size-20 -translate-x-1/2 -translate-y-1/2 text-primary/25"
              icon={BookOpen01Icon}
              strokeWidth={1.2}
            />
          </div>
        )}
        <div className="absolute inset-0 bg-linear-to-b from-background/10 via-card/35 to-popover" />
        <div className="absolute inset-x-0 bottom-0 h-3/4 bg-linear-to-t from-popover via-popover/85 to-transparent" />
      </div>

      <div className="relative z-10 flex flex-col gap-2 px-5 pt-24 pb-5 sm:px-6 sm:pt-28">
        <Badge className="w-fit" variant="secondary">
          {badgeLabel}
        </Badge>
        {title}
        {description}
      </div>
    </header>
  );
}

interface CourseOfferDetailsProps {
  children?: ReactNode;
  className?: string;
  courseDescription: string | null;
  facts: readonly CourseOfferFact[];
}

export function CourseOfferDetails({
  children,
  className,
  courseDescription,
  facts,
}: CourseOfferDetailsProps): React.JSX.Element {
  return (
    <div className={cn("flex flex-col gap-5", className)}>
      {courseDescription ? (
        <p className="text-pretty text-muted-foreground text-sm leading-6">
          {courseDescription}
        </p>
      ) : null}

      {facts.length > 0 ? (
        <dl
          className={cn(
            "grid gap-x-5 gap-y-4 border-border/70 border-y py-4",
            facts.length === 1 ? "grid-cols-1" : "grid-cols-2"
          )}
        >
          {facts.map((fact) => (
            <div className="flex min-w-0 items-start gap-3" key={fact.label}>
              <HugeiconsIcon
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-primary"
                icon={fact.icon}
                size={19}
                strokeWidth={1.8}
              />
              <div className="min-w-0">
                <dt className="text-muted-foreground text-xs">{fact.label}</dt>
                <dd className="mt-0.5 flex items-baseline gap-2 font-semibold text-sm">
                  {fact.value}
                  {fact.secondaryValue ? (
                    <span className="font-normal text-muted-foreground text-xs">
                      {fact.secondaryValue}
                    </span>
                  ) : null}
                </dd>
              </div>
            </div>
          ))}
        </dl>
      ) : null}

      {children}
    </div>
  );
}

interface CourseOfferDialogProps {
  badgeLabel: string;
  children?: ReactNode;
  courseDescription: string | null;
  courseTitle: string;
  coverBlurDataUrl: string | null;
  dialogDescription: string;
  facts: readonly CourseOfferFact[];
  footer: ReactNode;
  thumbnailUrl: string | null;
  trigger: ReactNode;
}

export function CourseOfferDialog({
  badgeLabel,
  children,
  courseDescription,
  courseTitle,
  coverBlurDataUrl,
  dialogDescription,
  facts,
  footer,
  thumbnailUrl,
  trigger,
}: CourseOfferDialogProps): React.JSX.Element {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent className="max-w-2xl">
        <CourseOfferHero
          badgeLabel={badgeLabel}
          coverBlurDataUrl={coverBlurDataUrl}
          description={
            <DialogDescription className="max-w-[38rem] text-pretty text-card-foreground/75">
              {dialogDescription}
            </DialogDescription>
          }
          thumbnailUrl={thumbnailUrl}
          title={
            <DialogTitle className="max-w-[38rem] text-balance text-xl tracking-tight sm:text-2xl">
              {courseTitle}
            </DialogTitle>
          }
        />

        <DialogBody className="p-5 sm:p-6">
          <CourseOfferDetails
            courseDescription={courseDescription}
            facts={facts}
          >
            {children}
          </CourseOfferDetails>
        </DialogBody>

        <DialogFooter>{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CourseOfferPrice({
  details,
  label = "Preço",
  value,
}: {
  details?: string;
  label?: string;
  value: string;
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
      <div className="min-w-0">
        <p className="text-muted-foreground text-sm">{label}</p>
        {details ? (
          <p className="mt-1 text-muted-foreground text-xs">{details}</p>
        ) : null}
      </div>
      <span className="font-semibold text-lg tabular-nums">{value}</span>
    </div>
  );
}

export function CourseOfferAccessNote({
  description,
  title,
}: {
  description: string;
  title: string;
}): React.JSX.Element {
  return (
    <Alert variant="success">
      <HugeiconsIcon
        aria-hidden="true"
        icon={CheckmarkCircle02Icon}
        size={19}
      />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
    </Alert>
  );
}

export function CourseOfferInfoNote({
  description,
  title,
}: {
  description: string;
  title: string;
}): React.JSX.Element {
  return (
    <Alert variant="info">
      <HugeiconsIcon
        aria-hidden="true"
        icon={InformationCircleIcon}
        size={19}
      />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
    </Alert>
  );
}
