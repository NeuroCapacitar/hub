"use client";

import {
  BookOpen01Icon,
  CheckmarkCircle02Icon,
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
import { cn } from "@/lib/utils";
import { CourseCoverImage } from "./course-cover-image";
import type { CourseOfferFact } from "./course-offer-facts";

export type CourseOfferTriggerKind = "action" | "card";

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
            <div className="min-w-0" key={fact.label}>
              <dt className="flex min-w-0 items-start gap-3 text-muted-foreground text-xs">
                <HugeiconsIcon
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-primary"
                  icon={fact.icon}
                  size={19}
                  strokeWidth={1.8}
                />
                {fact.label}
              </dt>
              <dd className="mt-0.5 flex items-baseline gap-2 pl-8 font-semibold text-sm">
                {fact.value}
                {fact.secondaryValue ? (
                  <span className="font-normal text-muted-foreground text-xs">
                    {fact.secondaryValue}
                  </span>
                ) : null}
              </dd>
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
