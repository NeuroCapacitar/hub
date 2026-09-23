import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { PageContainer } from "@/components/page-container";
import { PanelPageTitle } from "@/components/panel-page-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { StudentCheckoutCourseContext } from "@/features/courses/checkout-course-context";
import { canMutateStudentExperience } from "@/features/courses/preview";
import {
  getStudentCheckoutCourseContext,
  getStudentCourseAccessStatus,
} from "@/features/courses/server";
import { route } from "@/lib/routes";
import { requireSession } from "@/lib/session";
import { CheckoutAccessWaiter } from "./checkout-access-waiter";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ courseId?: string }>;
}): Promise<React.JSX.Element> {
  const session = await requireSession();

  if (!canMutateStudentExperience(session.role)) {
    redirect(route("/admin"));
  }

  const { courseId = null } = await searchParams;
  let courseContext: StudentCheckoutCourseContext | null = null;

  if (courseId) {
    const access = await getStudentCourseAccessStatus({
      courseId,
      userId: session.user.id,
    });

    if (access.canAccess) {
      redirect(route(access.redirectTo));
    }

    courseContext = await getStudentCheckoutCourseContext({
      courseId,
      userId: session.user.id,
    });
  }

  return (
    <>
      <PanelPageTitle title="Seu acesso está sendo liberado" visibleHeading />
      <PageContainer className="min-h-screen bg-background text-foreground">
        <BrandLogo className="mx-auto mb-8 h-9 w-auto" preload />
        <section className="mx-auto w-full max-w-2xl rounded-2xl border border-border/70 bg-card/90 p-6 shadow-sm sm:p-8">
          <Badge variant="outline">Pagamento em verificação</Badge>
          <h1 className="type-section-title mt-4">
            Seu acesso está sendo liberado
          </h1>
          <p className="mt-3 max-w-xl text-muted-foreground text-sm leading-6">
            Recebemos o retorno do checkout e estamos confirmando sua matrícula.
            Não é necessário iniciar outra compra.
          </p>
          <CheckoutAccessWaiter
            courseContext={courseContext}
            courseId={courseId}
          />
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link href={route("/app")}>Voltar para cursos</Link>
            </Button>
          </div>
        </section>
      </PageContainer>
    </>
  );
}
