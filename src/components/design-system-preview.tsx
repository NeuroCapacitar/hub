import { Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarBadge, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTriggerButton,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

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
      <Button variant="accent">Ação destacada</Button>
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
      <Badge variant="progress">Em andamento</Badge>
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

function PrimitiveSamples(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <p className="font-medium text-sm">Primitivos e estados de apoio</p>
        <p className="mt-1 text-muted-foreground text-xs">
          Estados vazios, feedback, menus, diálogos, links, avatar e upload
          compartilham a mesma linguagem semântica.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Alert variant="info">
          <AlertTitle>Informação de contexto</AlertTitle>
          <AlertDescription>
            O conteúdo continua disponível enquanto a sincronização termina.
          </AlertDescription>
        </Alert>

        <Empty className="min-h-44 border border-border bg-card p-6">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon
                aria-hidden="true"
                icon={Search01Icon}
                strokeWidth={2}
              />
            </EmptyMedia>
            <EmptyTitle as="h3">Nenhum registro encontrado</EmptyTitle>
            <EmptyDescription>
              Ajuste os filtros ou volte para a visão geral.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Link
              className="font-medium text-link text-sm underline underline-offset-4"
              href="/app"
            >
              Voltar para a visão geral
            </Link>
          </EmptyContent>
        </Empty>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-sm">Identidade e navegação</p>
              <p className="mt-1 text-muted-foreground text-xs">
                Avatar, link e ação contextual.
              </p>
            </div>
            <Avatar size="lg">
              <AvatarFallback>NC</AvatarFallback>
              <AvatarBadge aria-hidden="true" />
            </Avatar>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              className="font-medium text-link text-sm underline underline-offset-4"
              href="/app/cursos"
            >
              Ver cursos
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  Mais opções
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Ações do contexto</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Copiar referência</DropdownMenuItem>
                <DropdownMenuItem>Ver detalhes</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Dialog>
              <DialogTriggerButton size="sm" variant="secondary">
                Abrir diálogo
              </DialogTriggerButton>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Prévia de confirmação</DialogTitle>
                  <DialogDescription>
                    O conteúdo explica a consequência antes da ação.
                  </DialogDescription>
                </DialogHeader>
                <DialogBody>
                  <p className="text-muted-foreground text-sm">
                    Este estado valida foco, descrição e superfície portada.
                  </p>
                </DialogBody>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <Label htmlFor="preview-upload">Upload de material</Label>
          <Input accept=".pdf,.doc,.docx" id="preview-upload" type="file" />
          <p className="text-muted-foreground text-xs">
            PDF ou documento de apoio. O estado de erro deve ficar próximo do
            campo quando houver falha.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <Table>
          <TableCaption>Resumo de materiais recentes</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Material</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Atualizado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableRowHeader>Guia de estudo</TableRowHeader>
              <TableCell>
                <Badge variant="success">Disponível</Badge>
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                Hoje
              </TableCell>
            </TableRow>
            <TableRow>
              <TableRowHeader>Atividade prática</TableRowHeader>
              <TableCell>
                <Badge variant="progress">Em andamento</Badge>
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                Ontem
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ControlSamples(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <p className="font-medium text-sm">Controles selecionados</p>
        <p className="mt-1 text-muted-foreground text-xs">
          O mesmo estado é acompanhado por texto, rótulo ou valor.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <label
            className="flex items-center gap-2 text-sm"
            htmlFor="preview-checkbox"
          >
            <Checkbox defaultChecked id="preview-checkbox" />
            Checkbox marcado
          </label>
          <RadioGroup
            aria-label="Opção de exemplo"
            className="gap-2"
            defaultValue="selected"
          >
            <label
              className="flex items-center gap-2 text-sm"
              htmlFor="preview-radio-selected"
            >
              <RadioGroupItem id="preview-radio-selected" value="selected" />
              Radio selecionado
            </label>
            <label
              className="flex items-center gap-2 text-muted-foreground text-sm"
              htmlFor="preview-radio-other"
            >
              <RadioGroupItem id="preview-radio-other" value="other" />
              Radio disponível
            </label>
          </RadioGroup>
          <label
            className="flex items-center justify-between gap-3 text-sm"
            htmlFor="preview-switch"
          >
            Switch ativo
            <Switch defaultChecked id="preview-switch" />
          </label>
        </div>

        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="space-y-2">
            <p className="font-medium text-sm">Slider com valor parcial</p>
            <Slider
              aria-label="Volume de exemplo"
              defaultValue={[62]}
              thumbLabels={["Volume"]}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="preview-select">Select com valor</Label>
            <Select defaultValue="learning">
              <SelectTrigger
                aria-label="Registro de exemplo"
                id="preview-select"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="learning">Aprendizagem</SelectItem>
                <SelectItem value="operation">Operação</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="preview-textarea">Textarea</Label>
            <Textarea
              defaultValue="Texto de apoio para validar altura e foco."
              id="preview-textarea"
              rows={2}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-focus bg-card p-4 outline-2 outline-focus outline-offset-2">
        <p className="font-medium text-sm">Foco de teclado</p>
        <p className="mt-1 text-support-foreground text-xs">
          A borda creme, o outline externo e o ring de fundo formam a receita
          compartilhada pelos controles migrados.
        </p>
      </div>
    </div>
  );
}

const surfaceComparisonSamples = [
  { className: "bg-background", label: "Background" },
  { className: "bg-card", label: "Card" },
  { className: "bg-sidebar", label: "Sidebar" },
] as const;

function SurfaceComparisonSamples(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <p className="font-medium text-sm">Comparação de superfícies</p>
        <p className="mt-1 text-muted-foreground text-xs">
          Os mesmos papéis são comparados sobre fundos estruturais diferentes.
        </p>
      </div>

      <div className="grid gap-3">
        {surfaceComparisonSamples.map((surface) => (
          <div
            className={`${surface.className} rounded-xl border border-border p-4`}
            key={surface.label}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium text-foreground text-sm">
                  {surface.label}
                </p>
                <p className="mt-1 text-support-foreground text-xs">
                  Texto principal e apoio
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-md border border-focus px-2 py-1 font-medium text-foreground text-xs outline-2 outline-focus outline-offset-2">
                  Foco
                </span>
                <span className="rounded-md bg-control-selected px-2 py-1 font-medium text-control-selected-foreground text-xs">
                  Selecionado
                </span>
              </div>
            </div>
          </div>
        ))}
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
        <PrimitiveSamples />
        <ControlSamples />

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

        <SurfaceComparisonSamples />
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
