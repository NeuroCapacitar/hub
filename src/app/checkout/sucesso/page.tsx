import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { PageContainer } from "@/components/page-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { route } from "@/lib/routes";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default function PublicCheckoutSuccessPage(): React.JSX.Element {
  return (
    <PageContainer className="min-h-screen bg-background text-foreground">
      <BrandLogo className="mb-8 h-9 w-auto" preload />
      <section className="max-w-2xl rounded-2xl border border-border/70 bg-card/90 p-6 shadow-sm sm:p-8">
        <Badge variant="outline">Pagamento em confirmação</Badge>
        <h1 className="type-section-title mt-4">
          Seu acesso está sendo preparado
        </h1>
        <p className="mt-3 text-muted-foreground text-sm leading-6">
          Assim que o pagamento for confirmado, enviaremos as instruções de
          acesso para o e-mail usado na compra. Se esta for sua primeira compra,
          o e-mail terá um link para criar sua senha.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild>
            <Link href={route("/entrar")}>Ir para login</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={route("/recuperar-senha")}>Reenviar acesso</Link>
          </Button>
        </div>
      </section>
    </PageContainer>
  );
}
