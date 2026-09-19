import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { PageContainer } from "@/components/page-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { resolveCheckoutRetryPath } from "@/features/payments/checkout";
import { route } from "@/lib/routes";

interface CheckoutExpiredPageProps {
  searchParams: Promise<{ attemptId?: string }>;
}

export default async function CheckoutExpiredPage({
  searchParams,
}: CheckoutExpiredPageProps): Promise<React.JSX.Element> {
  const { attemptId } = await searchParams;
  const retryPath = await resolveCheckoutRetryPath(attemptId);

  return (
    <PageContainer className="min-h-screen bg-background text-foreground">
      <BrandLogo className="mb-8 h-9 w-auto" preload />
      <section className="max-w-2xl rounded-2xl border border-border/70 bg-card/90 p-6 shadow-sm sm:p-8">
        <Badge variant="warning">Prazo encerrado</Badge>
        <h1 className="type-section-title mt-4">Checkout expirado</h1>
        <p className="mt-3 text-muted-foreground text-sm leading-6">
          {retryPath
            ? "O prazo desta tentativa terminou sem confirmação. Volte ao curso para iniciar um novo checkout."
            : "Não encontramos esta tentativa. Entre no Hub ou fale com o suporte para continuar."}
        </p>
        <Button asChild className="mt-6">
          <Link href={route(retryPath ?? "/entrar")}>
            {retryPath ? "Tentar novamente" : "Ir para login"}
          </Link>
        </Button>
      </section>
    </PageContainer>
  );
}
