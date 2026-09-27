# Plano: conforto global, tabelas sem Card e ritmo do Admin

> Status: plano proposto; nenhum código foi alterado nesta análise.
> Baseline: `6848a28b` (`feature/small-changes`).

## Correções de entendimento

### `comfortable` não é sinônimo de `--radius: 0.5rem`

O projeto decidiu usar `comfortable` globalmente no sentido de espaçamento,
ritmo, leitura e targets. Isso não obriga um único raio global: o repositório
possui consumidores explícitos (`rounded-lg`, `rounded-xl`, `rounded-2xl` etc.)
e já criou tokens semânticos:

- `--shape-radius-detail`;
- `--shape-radius-control`;
- `--shape-radius-card`;
- `--shape-radius-surface`;
- `--shape-radius-media`.

Trocar somente `--radius` para `0.5rem` alteraria componentes que ainda usam a
escala legada, mas deixaria intactos consumidores explícitos e poderia produzir
uma mistura ainda maior. Fluent e Atlassian também usam papéis de forma, não
um único raio para toda a interface: [Fluent Shapes](https://fluent2.microsoft.design/shapes)
e [Atlassian Radius](https://atlassian.design/foundations/radius).

### Decisão de forma

Não fazer uma troca cega do valor-base. Tornar o conforto global consistente
por migração semântica:

1. `Button`, `Input`, `Select`, `Textarea`, `Popover` e controles equivalentes
   devem usar `rounded-control`/papel equivalente;
2. Cards de entidade devem usar `rounded-card` ou `rounded-surface` conforme a
   composição;
3. Sheets, dialogs, mídia e superfícies grandes devem manter seus papéis
   próprios;
4. `--radius` permanece como compatibilidade até que os consumidores legados
   sejam auditados;
5. a fixture do design system deve comparar os papéis com foco, hover,
   disabled, erro, mobile e superfícies aninhadas antes de decidir valores
   maiores.

O resultado continua confortável globalmente, mas evita fazer menus, inputs,
sidebar, dialogs e tabelas mudarem sem revisão.

## Tabelas: contrato novo

Uma tabela não deve ser colocada dentro de um `Card` apenas para ganhar peso.
O padrão será:

```text
<section>
  título + descrição + filtros/ações
  superfície única da tabela
    overflow-x-auto + borda/radius local
    <Table />
</section>
```

A borda/radius do wrapper da tabela continua permitida para delimitar o ledger
e proteger o overflow horizontal. O que será removido é o `Card` externo com
`CardHeader`/`CardContent` envolvendo a tabela.

### Escopo de migração

#### Prioridade 1 — tabelas administrativas principais

- `src/app/(admin)/admin/alunos/page.tsx` — `StudentsTable`.
- `src/app/(admin)/admin/equipe/page.tsx` — `StaffAccessTable`.
- `src/app/(admin)/admin/auditoria/page.tsx` — tabela de auditoria.
- `src/app/(admin)/admin/financeiro/page.tsx` — `FinancialOrdersTable`.
- `src/app/(admin)/admin/financeiro/financial-overview.tsx` —
  `CoursesRevenueTable`.
- `src/app/(admin)/admin/operacao/cursos/[courseId]/alunas/page.tsx` —
  `SupportCourseStudentsTable`.

Para cada rota, mover o título, descrição, filtros e ações para um `section`
sem card e manter somente o wrapper da tabela.

#### Prioridade 2 — tabelas do Dashboard Admin

Em `src/app/(admin)/admin/(dashboard)/page.tsx`:

- `RecentOrdersCard`;
- `RecentCertificatesCard`;
- `RecentCommentsCard`;
- `SupportRequestsSection`.

Esses componentes devem deixar de ser Cards. Cada tabela continuará com seu
título, descrição, caption e wrapper horizontal local. A seção `Atividade
recente` continuará agrupando as três listas, mas sem uma parede de Cards.

#### Prioridade 3 — Operação e casos restantes

- tabelas de Webhooks, Resend dead letter e Outbox em
  `src/app/(admin)/admin/operacao/page.tsx`;
- wrappers de tabela usados em `src/app/(admin)/admin/configuracoes/faq/faq-table.tsx`
  permanecem sem Card;
- tabelas em Sheets/Dialogs permanecem dentro do próprio overlay quando o
  overlay é a unidade de tarefa, mas não devem ganhar um Card adicional;
- `design-system-preview.tsx` é fixture, não tela de produto, e só muda se a
  fixture precisar documentar o novo contrato.

Não converter tabelas em listas de Cards. A forma tabular continua sendo a
correta para comparação, auditoria, financeiro e operação.

## Espaçamento confortável do Admin

Adicionar ritmo maior entre sessões e grupos, sem transformar Financeiro,
Auditoria e Operação em telas frouxas:

1. stacks principais de Dashboard e Alunos passam de `gap-6` para o padrão
   confortável `gap-8`, incluindo seus loadings;
2. sessões independentes do Admin mantêm `gap-8` quando já usam esse contrato;
3. dentro de uma sessão de tabela, usar gap menor entre título, filtros e tabela
   (`gap-4`/`gap-5`), preservando a relação entre esses elementos;
4. entre tabelas irmãs em `Atividade recente`, usar `gap-6`;
5. grids de Cards operacionais usam `gap-5` quando houver mais de uma unidade
   independente;
6. não alterar gaps internos de linhas/tabelas que já servem à comparação;
7. skeletons devem espelhar os mesmos gaps e a mesma ausência de Card da tela
   final.

O espaçamento deve criar hierarquia antes de novas linhas ou superfícies. Esse
princípio é consistente com [Fluent Layout](https://fluent2.microsoft.design/layout)
e [Atlassian Spacing](https://atlassian.design/foundations/spacing).

## Sequência de implementação

### Etapa 1 — contrato e fixture

- validar/migrar os primitives de controle para os tokens semânticos de forma;
- atualizar a fixture de design system;
- confirmar foco, contraste, overflow e radius concêntrico;
- não alterar `--radius` global ainda.

### Etapa 2 — tabelas sem Card

- migrar Alunos, Equipe, Auditoria e Financeiro;
- migrar Dashboard Admin;
- migrar Operação e Alunos de Curso;
- atualizar loading e testes de layout de cada rota;
- manter wrappers locais de overflow/borda, sem Card externo.

### Etapa 3 — ritmo do Admin

- ajustar stacks e gaps de sessões conforme o contrato acima;
- atualizar skeletons correspondentes;
- verificar que headings, ações e tabelas continuam alinhados;
- não alterar a densidade interna de Financeiro, Auditoria ou Operação.

### Etapa 4 — radius final

- depois dos consumidores migrarem, comparar a fixture e as telas reais;
- se a linguagem ainda estiver rígida, ajustar tokens semânticos por papel;
- só considerar alterar o fallback `--radius` se nenhum consumidor relevante
  continuar dependente dele sem revisão.

## Critérios de conclusão

- nenhuma tabela de produto fica dentro de `Card` sem justificativa explícita;
- não há `Card` apenas para envolver um título e uma tabela;
- cada tabela conserva caption, overflow, foco, paginação e estado vazio;
- Admin tem separação vertical mais confortável entre sessões;
- Financeiro, Auditoria e Operação mantêm comparação densa dentro das tabelas;
- controles usam tokens de radius coerentes e foco continua visível;
- títulos/descrições/ações continuam fora e alinhados à superfície da tabela;
- `bun run verify:quick`, `bun x ultracite check` e testes de layout passam;
- `bun run docs:check` passa se `DESIGN.md` for atualizado.

## Riscos e limites

- remover Cards pode deixar títulos órfãos se o cabeçalho não for recomposto
  como seção;
- tabelas largas não podem criar scroll horizontal no viewport inteiro;
- overlays com tabela precisam preservar sua superfície própria;
- não usar a migração para remover informação, paginação ou ações;
- não aplicar o radius novo em lote antes da fixture provar a coerência.
