# Análise individual: tintas de severidade em Operação

> Status: análise read-only; nenhum código foi alterado nesta etapa.
> Baseline: `96c5924d` (`feature/small-changes`).

## Localização no plano

Esta é a sugestão `# 45 — Operação` do relatório anexado. A recomendação é
manter a organização semântica atual e diferenciar `Crítico`, `Alta prioridade`
e `Atenção` com pequenas tintas, nunca com cards inteiramente vermelhos.

## Estado atual confirmado

- A página já separa alertas, saúde da JMVStream, webhooks, Outbox e outros
  sinais.
- `SEVERITY_PRESENTATION` já possui variantes semânticas para `critical`, `high`
  e `warning` (`src/app/(admin)/admin/operacao/page.tsx:116-130`).
- Cada alerta já mostra título, badge de severidade, descrição, idade, data e
  ação `Abrir fila` (`src/app/(admin)/admin/operacao/page.tsx:365-409`).
- A linha atual usa `border bg-muted/10` para todos os alertas; a diferença de
  severidade fica concentrada no badge.

## Avaliação

A sugestão ainda é válida: uma pequena diferença de superfície ajuda a localizar
urgência antes de ler todos os badges. Porém, o estado textual já existe, então
a cor deve ser apenas reforço, nunca a única comunicação.

Implementação recomendada:

- `critical`: `bg-destructive/5` com borda destrutiva sutil;
- `high`: `bg-warning/5` com borda warning sutil;
- `warning`: `bg-muted/10` e borda neutra;
- manter badge e label textual em todos os casos;
- não adicionar sombra colorida, faixa lateral grossa ou card vermelho inteiro;
- manter a mesma ação, espaçamento e hierarquia de cada linha.

## Pesquisa externa

- Atlassian recomenda cores de status/severidade para reforçar significado, mas
  alerta que elas podem ser difíceis de distinguir por deficiência de cor; outros
  indicadores devem permanecer presentes.
  [Atlassian — Data visualization color](https://atlassian.design/foundations/color/data-visualization-color)
- Carbon diferencia tiles simples de cards complexos e recomenda reservar peso
  visual para a função da unidade, evitando elevação decorativa.
  [Carbon — Tile usage](https://carbondesignsystem.com/components/tile/usage/)
- GOV.UK recomenda hierarquia e estrutura cuidadosas para que dashboards não
  sobrecarreguem ou deixem o usuário interpretar tudo sozinho.
  [GOV.UK — Dashboards](https://brand.design-system.service.gov.uk/data/dashboards/)

## Decisão

**Implementar a tinta sutil por severidade.** É um refinamento localizado, não
altera contrato operacional, não cria novos estados e mantém Operação sóbria.

Cobertura necessária:

- zero alertas;
- apenas warning;
- alta prioridade;
- crítico junto com outros níveis;
- contraste e leitura sem cor;
- foco, teclado, links e ações inalterados.

## Resultado final

Sugestão válida para implementação cautelosa: aplicar pequenas tintas nos itens
de alerta, preservando badge, texto e ação como fontes principais de significado.

