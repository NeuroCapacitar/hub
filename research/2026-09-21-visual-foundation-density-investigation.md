# Investigação: fundação visual, densidade e superfícies

> Escopo: validar a próxima etapa do sprint visual após a Home do Aluno, a
> limpeza estrutural do Admin e o refinamento dos Certificados.
> A página de Curso permanece explicitamente fora do escopo.
> Data: 2026-09-21. Commit de referência: `6dcaee58`.
> Nenhum código de produção foi alterado nesta investigação.

## Decisão executiva

> Atualização de produto: após a investigação, a decisão mudou de dois papéis
> persistentes (`comfortable` e `operational`) para uma base confortável global.
> A redução de espaço agora é uma exceção local, feita com `size="sm"` e
> classes específicas, sem uma API de densidade compacta.

A próxima etapa deve ser a fundação visual por contexto, mas não deve começar
com uma troca global de `--radius`.

O Hub já possui tokens, primitives e uma base cromática consistente. A decisão
agora é usar uma linguagem confortável em todo o produto e reservar redução de
densidade somente para detalhes em que a comparação rápida seja a tarefa
principal.

O primeiro incremento deve ser um contrato de tokens e uma fixture comparando
os dois contextos. A migração dos primitives e das telas deve vir depois da
comparação, em pequenos lotes.

## O que existe hoje

### Radius

`src/app/globals.css` define `--radius: 0.25rem`, e a escala do Tailwind é
derivada dele. O sistema também usa muitos valores explícitos nos consumidores:

- `rounded-lg`: 112 ocorrências;
- `rounded-xl`: 79 ocorrências;
- `rounded-md`: 62 ocorrências;
- `rounded-full`: 55 ocorrências;
- `rounded-2xl`: 26 ocorrências.

Isso significa que alterar apenas o valor-base não controla toda a linguagem:
os valores relativos e os overrides continuariam produzindo diferenças entre
componentes.

### Card e densidade

`src/components/ui/card.tsx` já possui:

- `Card` usa a forma e o espaçamento confortáveis diretamente no primitive;
- `size="default" | "sm"`;
- `--card-spacing` derivado do tamanho;
- superfície `bg-card`, sombra e ring padrão.

As exceções de menor padding aparecem principalmente em Auditoria, editor de
Certificado e alguns detalhes de Aula. Elas agora devem usar `size="sm"` e
classes locais, sem criar uma segunda densidade global.

Também há aproximadamente 233 usos de `<Card>` em rotas de Aluno/Admin. Uma
mudança global de radius, sombra ou padding teria alcance alto e poderia
reintroduzir inconsistências em dialogs, sheets, tabelas e formulários.

### Superfícies

O projeto possui uma hierarquia cromática válida:

- `background` para o canvas;
- `card` para agrupamentos reais;
- `muted` para apoio e separação;
- `popover` para superfícies portadas;
- `surface-warm` para momentos especiais.

O problema é composicional: muitos agrupamentos ainda recebem simultaneamente
card, borda e sombra, ou um card interno com outra borda. A limpeza do Admin
Dashboard reduziu parte desse problema, mas não criou uma regra reutilizável.

### Acessibilidade e foco

Buttons, inputs, dialogs e sheets já possuem foco visível. Qualquer contrato de
radius precisa preservar essa relação: a área de foco deve acompanhar o raio
do controle e não ser cortada por `overflow-hidden` ou por uma superfície
portada.

## Pesquisa comparativa

### Fluent 2

Fluent separa tokens globais de tokens semânticos/alias. Seu sistema de layout
usa uma escala consistente de espaço, mas recomenda usar proximidade e espaço
para comunicar relações, em vez de adicionar linhas a todo agrupamento. A
escala de radius usa 4px como padrão de muitos componentes e valores maiores
para superfícies grandes.

Fontes: [Design tokens](https://fluent2.microsoft.design/design-tokens),
[Layout](https://fluent2.microsoft.design/layout) e
[Shapes](https://fluent2.microsoft.design/shapes).

### Atlassian

Atlassian separa radius por papel: detalhes pequenos, elementos de suporte,
controles interativos, cards, containers grandes e video players. Também
mantém tokens de foco associados ao radius do componente. Isso valida uma
escala semântica, não uma troca global cega.

Fontes: [Radius](https://atlassian.design/foundations/radius),
[Spacing](https://atlassian.design/foundations/spacing) e
[Design tokens](https://atlassian.design/foundations/design-tokens).

### Material

Material trata cards como containers de uma unidade coerente, com mídia,
conteúdo e ações opcionais. Em desktop, cards podem ter elevação de repouso
baixa ou nula; a elevação deve comunicar relação espacial, não decorar todo
bloco da tela.

Fonte: [Material Cards](https://m1.material.io/components/cards.html).

## Recomendações

### 1. Não alterar `--radius` global agora

**Decisão:** não implementar a troca direta para `0.5rem`.

**Motivo:** o Hub tem muitos overrides, consumidores portados e componentes
com responsabilidades diferentes. O valor-base sozinho não produziria a
diferença semântica desejada e poderia alterar shell, menus, inputs e tabelas
ao mesmo tempo.

### 2. Criar um contrato de papéis de forma

**Decisão:** implementar depois da fixture.

Valores iniciais para teste, não para aprovação automática:

- detalhe/badge: 2–4px;
- controle interativo: 4–6px;
- card de entidade: 8px;
- sheet/dialog/container grande: 10–12px;
- mídia ou superfície de aprendizagem destacada: 12–16px.

Os valores precisam ser aplicados por token semântico e revisados com foco,
mobile e componentes aninhados.

### 3. Formalizar a densidade confortável global

**Decisão:** `comfortable` é o padrão compartilhado; exceções locais usam
`size="sm"` e classes de espaçamento explícitas.

`comfortable` orienta Home do Aluno, Certificados, Auth, Checkout, Admin e
estados vazios. Auditoria, Financeiro, Operação, tabelas e detalhes podem
reduzir padding localmente quando mais informação precisa caber sem perder
comparação. O componente `Card` não oferece uma estética operacional separada.

### 4. Reduzir superfícies antes de aumentar radius

**Decisão:** manter como princípio de implementação.

Uma seção não deve receber card apenas para ganhar peso visual. Primeiro usar
espaço, alinhamento e mudança tonal; reservar borda/sombra para delimitar uma
unidade interativa, uma evidência ou uma superfície portada.

### 5. Criar uma fixture de fundação visual

Antes de migrar o produto, comparar em uma tela interna:

- Card confortável e exceção local `size="sm"`;
- Button/Input/Select/Dialog/Sheet;
- foco, hover, disabled e erro;
- superfície `background`, `card`, `muted`, `popover` e `surface-warm`;
- tabela compacta e empty state confortável;
- tema escuro e viewport estreito.

A fixture deve usar os primitives existentes, não criar uma segunda biblioteca.

## Próximo plano de implementação

1. Mapear os consumidores dos tokens e definir nomes semânticos no contrato
   visual.
2. Adicionar variantes/props mínimas aos primitives somente onde a fixture
   provar necessidade.
3. Migrar dois protótipos reais: um bloco da Home/Certificados do Aluno e um
   agrupamento do Dashboard/Admin.
4. Comparar densidade, foco, overflow, contraste e hierarquia.
5. Só então migrar outros primitives e documentar a decisão em `DESIGN.md`.

## Fora de escopo

- página de Curso/hero, explicitamente pulada;
- mudança de tema ou light mode;
- nova biblioteca visual;
- analytics, streaks, ranking ou novas métricas;
- alteração global de radius sem fixture;
- redesign de Financeiro/Auditoria para uma densidade confortável.

## Critérios de aprovação

- a mesma unidade semântica tem aparência consistente em todas as páginas;
- Student e Admin podem ter densidades diferentes sem classes ad hoc em cada
  tela;
- foco, contraste e targets continuam acessíveis;
- cards internos deixam de ser usados como separadores genéricos;
- cards desktop podem ser flat/outlined quando a elevação não comunica uma
  relação real;
- não há regressão em dialogs, sheets, tabelas ou sidebar;
- `bun run verify:quick`, `bun x ultracite check` e `bun run docs:check` quando
  `DESIGN.md` for alterado passam.
