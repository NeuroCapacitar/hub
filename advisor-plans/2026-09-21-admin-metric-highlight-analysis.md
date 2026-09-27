# Análise individual: destaque seletivo do AdminMetricCard

> Status: análise read-only; nenhum código foi alterado nesta etapa.
> Baseline: `96c5924d` (`feature/small-changes`).

## Localização no plano

Esta é a sugestão `# 42 — AdminMetricCard` do relatório anexado. O relatório
propõe uma variante opcional `highlight`, usando oliva ou laranja de forma rara,
para criar foco seletivo no Dashboard Admin.

A sugestão anterior, `# 41 — Admin Dashboard: menos cards`, já foi implementada
no commit `6dcaee58`: pendências, prontidão do catálogo e contexto operacional
deixaram de usar caixas internas repetidas, mantendo listas e tabelas.

## Estado atual

`AdminMetricCard` é usado em várias superfícies, não apenas no Dashboard Admin:

- Dashboard Admin;
- Alunos;
- Aprendizagem;
- Financeiro e Análises.

O componente atual usa uma superfície neutra, ring discreto, valor tabular e
ícone secundário. Não há um caso de produto aprovado que precise destacar uma
métrica específica com cor de marca.

## Pesquisa externa

- Carbon diferencia tiles simples de cards complexos e recomenda reservar
  hierarquia forte para unidades de informação/ação coerentes, não colorir cada
  módulo de um dashboard.
  [Carbon — Tile usage](https://carbondesignsystem.com/components/tile/usage/)
- Material recomenda usar hierarquia interna para guiar atenção e alerta que
  cards em excesso dificultam a leitura de listas homogêneas.
  [Material — Cards](https://m1.material.io/components/cards.html)
- Atlassian recomenda usar uma cor de marca por padrão em visualizações e
  adicionar cores apenas quando houver uma diferença semântica real.
  [Atlassian — Data visualization color](https://atlassian.design/foundations/color/data-visualization-color)

## Avaliação

### Valor potencial

Uma métrica realmente prioritária poderia receber uma ênfase discreta se houver
uma decisão clara associada a ela, por exemplo uma fila crítica ou uma ação
imediata. O destaque deveria ser contextual e raro.

### Riscos atuais

- A mesma variante seria usada em Dashboard, Financeiro e Aprendizagem com
  significados diferentes.
- Uma prop `highlight` sem caso concreto aumentaria a API do componente antes
  de existir uma regra de conteúdo.
- Oliva/laranja podem ser interpretados como sucesso/atenção e competir com os
  estados semânticos existentes.
- A alteração reforçaria o padrão “mais cor para criar importância”, quando o
  trabalho recente já melhorou hierarquia por espaço, texto e agrupamento.

## Decisão

**Não implementar a variante `highlight` agora.**

Manter o `AdminMetricCard` neutro até que uma tela específica tenha:

1. uma métrica com ação inequívoca;
2. uma regra semântica aprovada para sua ênfase;
3. um caso de uso que não seja resolvido por título, helper, badge ou ordem;
4. validação de contraste e leitura nos contextos Admin, Financeiro e
   Aprendizagem.

Se esse caso surgir, preferir uma composição local ou um token semântico
específico, em vez de transformar a variante em linguagem global do componente.

## Resultado final

**Sugestão considerada, mas adiada por falta de caso de uso real.** A limpeza do
Dashboard Admin já está implementada; não há alteração de código válida nesta
etapa.

