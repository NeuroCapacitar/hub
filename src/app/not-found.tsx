import Link from "next/link";
import { SystemStateShell } from "@/components/system-state-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { route } from "@/lib/routes";

export default function NotFound(): React.JSX.Element {
  return (
    <SystemStateShell>
      <Badge variant="outline">Página indisponível</Badge>
      <h1 className="type-page-title mt-4">Não encontramos essa página</h1>
      <p className="type-body-sm mt-4 max-w-xl text-muted-foreground">
        A página ou conteúdo que você tentou abrir não está disponível. Volte ao
        início para continuar.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild>
          <Link href={route("/")}>Ir para o início</Link>
        </Button>
      </div>
    </SystemStateShell>
  );
}
