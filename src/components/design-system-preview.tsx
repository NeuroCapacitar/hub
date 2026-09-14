import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const colorSwatches = [
  { className: "bg-[var(--brand-petroleum)]", label: "Petróleo" },
  { className: "bg-[var(--brand-orange)]", label: "Laranja" },
  { className: "bg-[var(--brand-olive)]", label: "Oliva" },
  { className: "bg-[var(--brand-terracotta)]", label: "Terracota" },
  { className: "bg-[var(--brand-sand)] text-background", label: "Areia" },
] as const;

function ColorSwatches(): React.JSX.Element {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {colorSwatches.map((swatch) => (
        <div
          className={`${swatch.className} rounded-lg px-3 py-4 font-medium text-xs`}
          key={swatch.label}
        >
          {swatch.label}
        </div>
      ))}
    </div>
  );
}

function ActionSamples(): React.JSX.Element {
  return (
    <div className="flex flex-wrap gap-2">
      <Button>Continuar aula</Button>
      <Button variant="secondary">Ação secundária</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destrutiva</Button>
      <Button variant="link">Link de alta intenção</Button>
    </div>
  );
}

function StatusSamples(): React.JSX.Element {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge>Em andamento</Badge>
      <Badge variant="learning">Concluída</Badge>
      <Badge variant="success">Processado</Badge>
      <Badge variant="warning">Atenção</Badge>
      <Badge variant="info">Informação</Badge>
      <Badge variant="destructive">Erro</Badge>
      <Badge variant="outline">Neutro</Badge>
    </div>
  );
}

function ProgressSamples(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex justify-between text-muted-foreground text-xs">
          <span>Em andamento</span>
          <span>62%</span>
        </div>
        <Progress aria-label="Progresso em andamento: 62%" value={62} />
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-muted-foreground text-xs">
          <span>Concluído</span>
          <span>100%</span>
        </div>
        <Progress
          aria-label="Progresso concluído: 100%"
          tone="complete"
          value={100}
        />
      </div>
    </div>
  );
}

function SurfaceSamples(): React.JSX.Element {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Superfície operacional</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Cards continuam neutros; a cor aparece quando há ação ou estado.
        </CardContent>
      </Card>
      <div className="rounded-xl bg-surface-warm p-5 text-surface-warm-foreground">
        <p className="font-medium text-sm">Superfície quente</p>
        <p className="mt-2 text-sm/relaxed opacity-80">
          Uso reservado para Auth, checkout, onboarding ou callouts
          institucionais.
        </p>
      </div>
    </div>
  );
}

function PreviewColumn(): React.JSX.Element {
  return (
    <section aria-labelledby="system-preview-title">
      <div className="space-y-6 rounded-2xl border bg-background p-5 text-foreground shadow-sm sm:p-7">
        <div>
          <p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.16em]">
            Sistema aplicado
          </p>
          <h2
            className="mt-2 font-semibold text-xl tracking-tight"
            id="system-preview-title"
          >
            Papéis, estados e superfícies
          </h2>
        </div>

        <ColorSwatches />

        <div className="space-y-3">
          <p className="font-medium text-sm">Ações</p>
          <ActionSamples />
        </div>

        <div className="space-y-3">
          <p className="font-medium text-sm">Estados</p>
          <StatusSamples />
        </div>

        <ProgressSamples />
        <SurfaceSamples />

        <div className="space-y-3">
          <Label htmlFor="system-preview-input">Campo com foco</Label>
          <Input id="system-preview-input" placeholder="Digite um valor…" />
        </div>

        <Tabs defaultValue="learning">
          <TabsList variant="line">
            <TabsTrigger value="learning">Aprendizagem</TabsTrigger>
            <TabsTrigger value="operation">Operação</TabsTrigger>
          </TabsList>
          <TabsContent
            className="pt-4 text-muted-foreground text-sm"
            value="learning"
          >
            O registro de aprendizagem usa ação e progresso com mais calor.
          </TabsContent>
          <TabsContent
            className="pt-4 text-muted-foreground text-sm"
            value="operation"
          >
            O registro operacional prioriza densidade e estados semânticos.
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
}

function StateMatrix(): React.JSX.Element {
  return (
    <section aria-labelledby="state-matrix-title">
      <div className="space-y-6 rounded-2xl border bg-background p-5 text-foreground shadow-sm sm:p-7">
        <div>
          <p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.16em]">
            Revisão de estados
          </p>
          <h2
            className="mt-2 font-semibold text-xl tracking-tight"
            id="state-matrix-title"
          >
            O que muda e por quê
          </h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-focus bg-card p-4 outline-2 outline-focus outline-offset-2">
            <p className="font-medium text-sm">Foco de teclado</p>
            <p className="mt-2 text-sm/relaxed text-support-foreground">
              Creme claro no contorno; o ring escuro mantém contraste sobre
              ações coloridas.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="font-medium text-sm">Ação principal</p>
            <div className="mt-3 inline-flex rounded-lg bg-button-primary px-3 py-2 font-medium text-button-primary-foreground text-sm">
              Petróleo
            </div>
          </div>
          <div className="rounded-xl border border-border bg-muted p-4">
            <p className="font-medium text-sm">Texto de apoio</p>
            <p className="mt-2 text-sm/relaxed text-support-foreground">
              Teal-sage transicional para descrições, helpers e contexto
              secundário.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="font-medium text-sm">Ação de atenção</p>
            <div className="mt-3 inline-flex rounded-lg bg-primary px-3 py-2 font-medium text-primary-foreground text-sm">
              Laranja
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <p className="font-medium text-sm">Composição Student/Admin</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="font-medium text-sm">Student</p>
              <p className="mt-2 text-sm/relaxed text-support-foreground">
                Mais calor em progresso, conclusão e ações de aprendizagem.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="font-medium text-sm">Admin</p>
              <p className="mt-2 text-sm/relaxed text-support-foreground">
                Mesmas cores funcionais, com densidade e semântica operacional.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function DesignSystemPreview(): React.JSX.Element {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <PreviewColumn />
      <StateMatrix />
    </div>
  );
}
