import {
  SystemStateRetryButton,
  SystemStateShell,
} from "@/components/system-state-shell";
import { Badge } from "@/components/ui/badge";

export default function MaintenancePage(): React.JSX.Element {
  return (
    <SystemStateShell>
      <Badge variant="warning">Manutenção em andamento</Badge>
      <h1 className="type-page-title mt-4">Ambiente em manutenção</h1>
      <p className="type-body-sm mt-4 max-w-xl text-muted-foreground">
        Estamos realizando uma manutenção temporária para preparar a plataforma.
        Tente novamente em alguns minutos.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <SystemStateRetryButton />
      </div>
    </SystemStateShell>
  );
}
