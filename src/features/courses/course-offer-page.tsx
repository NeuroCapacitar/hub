import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { PageContainer } from "@/components/page-container";
import { CourseOfferDetails, CourseOfferHero } from "./course-offer-dialog";
import type { CourseOfferFact } from "./course-offer-facts";

export function CourseOfferPageFrame({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  return (
    <PageContainer
      as="main"
      className="min-h-screen bg-background text-foreground"
    >
      <BrandLogo className="mx-auto mb-8 h-9 w-auto" preload />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        {children}
      </div>
    </PageContainer>
  );
}

export function CourseOfferSummarySurface({
  badgeLabel,
  children,
  courseDescription,
  coverBlurDataUrl,
  facts,
  heroDescription,
  thumbnailUrl,
  title,
}: {
  badgeLabel: string;
  children?: ReactNode;
  courseDescription: string | null;
  coverBlurDataUrl: string | null;
  facts: readonly CourseOfferFact[];
  heroDescription: ReactNode;
  thumbnailUrl: string | null;
  title: ReactNode;
}): React.JSX.Element {
  return (
    <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/90 shadow-sm">
      <CourseOfferHero
        badgeLabel={badgeLabel}
        coverBlurDataUrl={coverBlurDataUrl}
        description={heroDescription}
        thumbnailUrl={thumbnailUrl}
        title={title}
      />
      <div className="p-5 sm:p-6">
        <CourseOfferDetails courseDescription={courseDescription} facts={facts}>
          {children}
        </CourseOfferDetails>
      </div>
    </section>
  );
}
