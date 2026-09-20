export interface CourseOfferSummaryData {
  accessDurationMonths: number;
  certificateEnabled: boolean;
  coverBlurDataUrl: string | null;
  description: string | null;
  lessonCount: number;
  moduleCount: number;
  paymentAllowCreditCard: boolean;
  paymentAllowPix: boolean;
  paymentMaxInstallmentCount: number;
  priceInCents: number;
  thumbnailUrl: string | null;
  title: string;
  workloadHours: number;
}
