# Análise individual: refinamento do Financeiro

> Status: análise read-only; nenhum código foi alterado nesta etapa.
> Baseline: `96c5924d` (`feature/small-changes`).

## Localização no plano

Esta é a sugestão `# 43 — Financeiro` do relatório anexado, dentro da Fase 5 —
Admin. O relatório recomenda preservar os dados, reduzir nesting, separar
resumo de indicadores operacionais e só usar sparklines se houver série temporal
confiável.

## Estado atual confirmado

A sugestão já foi implementada no commit `5aca12a2`:

- `Resumo financeiro` e `Indicadores operacionais` estão separados;
- a hierarquia não depende de um card externo pesado para cada detalhe;
- tabelas, revisões, reembolsos e pedidos usam superfícies próprias;
- `AdminMetricCard` permanece neutro e reutilizável;
- não foram adicionados gráficos decorativos ou sparklines sem série confiável;
- loading e detalhes acompanham a composição atual.

## Validação contra padrões externos

Dashboards devem priorizar indicadores de alto nível e uma hierarquia que ajude
a interpretação, não apenas aumentar a quantidade de visualizações. ([GOV.UK —
Dashboards](https://brand.design-system.service.gov.uk/data/dashboards/))

Cards e tiles devem agrupar unidades coerentes; tabelas continuam adequadas
quando comparação precisa ser a tarefa principal. ([Material — Cards](https://m1.material.io/components/cards.html), [Material — Data tables](https://m2.material.io/components/data-tables/web))

## Decisão

**Não implementar nova alteração nesta sugestão.** O Financeiro já está alinhado
ao plano. Sparklines continuam adiadas porque não há uma série temporal confiável
aprovada para representar tendência, e inventar uma comparação visual poderia
confundir histórico operacional com saldo ou previsão.

## Resultado final

**Sugestão atendida.** O próximo bloco restante do relatório é a revisão de
Operação/Admin, que também deve ser verificada contra o código antes de qualquer
implementação nova.

