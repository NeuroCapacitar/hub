import {
  BookOpen01Icon,
  Calendar03Icon,
  Certificate01Icon,
  Clock01Icon,
  Folder01Icon,
} from "@hugeicons/core-free-icons";
import { getEffectiveMaxInstallmentCount } from "@/features/payments/course-payment-offer";
import type { CourseOfferSummaryData } from "./course-offer-summary";

export interface CourseOfferFact {
  icon: typeof BookOpen01Icon;
  label: string;
  secondaryValue?: string;
  value: string;
}

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

export const getFreeCourseOfferFacts = ({
  certificateEnabled,
  lessonCount,
  moduleCount,
}: Pick<
  CourseOfferSummaryData,
  "certificateEnabled" | "lessonCount" | "moduleCount"
>): CourseOfferFact[] => {
  const facts: CourseOfferFact[] = [];

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
