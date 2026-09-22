# Análise individual: intervalo para a próxima Aula

> Status: análise read-only; nenhum código foi alterado nesta etapa.
> Baseline: `591af7c5` (`feature/small-changes`).

## Localização no plano

Esta é a segunda sugestão da **Fase 6 — Analytics/novas features** do relatório
anexado. O relatório descreve a ideia em dois pontos:

- `# 59 — Funcionalidades para Admin`: “Maior intervalo até próxima Aula”,
  usando os dados já existentes e destacando como insight, não como KPI.
- `# 71 — Fase 6`: depois do fluxo de progressão por Aula, experimentar
  “intervalo para próxima Aula”.

O fluxo de progressão descritiva foi implementado no commit `591af7c5` dentro da
tabela de Aprendizagem. Portanto, esta é a próxima sugestão concreta, não uma
nova etapa genérica de redesign do Admin.

## Estado atual do código

- A métrica `medianHoursToNextLesson` já é calculada em
  `src/features/learning-analytics/server.ts:308-333`.
- A tabela principal já mostra `Até próxima Aula` em
  `src/app/(admin)/admin/aprendizagem/learning-analytics-report.tsx:266-270`.
- O Sheet de versões também exibe `TP — Tempo mediano até próxima Aula` em
  `src/app/(admin)/admin/aprendizagem/lesson-analytics-details-sheet.tsx:86-96`.
- O cálculo usa o intervalo entre uma conclusão e o início posterior da Aula
  seguinte. Ele não mede o `release_delay_days` do Módulo, nem prova que o
  Aluno ficou bloqueado.
- O contrato atual não informa quantas observações formaram a mediana. Uma
  mediana com uma observação pode ser apresentada hoje como se tivesse a mesma
  estabilidade de uma mediana com dezenas.

## Pesquisa externa

- O Moodle diferencia analytics descritivo, diagnóstico, preditivo e
  prescritivo. Um intervalo observado descreve o que aconteceu; não explica
  por que aconteceu nem autoriza classificar a Aula como problema.
  [Moodle — Analytics](https://docs.moodle.org/500/en/Analytics)
- O Open edX separa engajamento e desempenho em relatórios de Curso e mantém
  filtros/contexto para a investigação. Isso favorece uma leitura contextual
  ligada à Aula, não mais um KPI global isolado.
  [Open edX — Course Dashboard Reports](https://docs.openedx.org/projects/openedx-aspects/en/open-release-sumac.master/reference/course_overview_dashboard.html)
- Revisões de dashboards de learning analytics mostram que muitos produtos
  aumentam consciência, mas oferecem poucas ações realmente acionáveis. A
  métrica precisa estar ligada a reflexão, investigação ou decisão clara.
  [Springer — Checklist para dashboards](https://link.springer.com/article/10.1186/s41239-023-00394-6),
  [Springer — Dashboards além de analytics](https://link.springer.com/article/10.1007/s10639-023-12401-4)
- A SoLAR recomenda começar pelo propósito da visualização — por que, o quê e
  como — em vez de criar uma visualização somente porque o dado existe.
  [SoLAR — Data visualisation and effective dashboard design](https://www.solaresearch.org/events/lasi-4/lasi20/lasi20-workshops-tutorials/)

## Avaliação da sugestão

### O que é válido

- O intervalo pode revelar fricção na sequência, dificuldade de retomada ou
  efeito de liberação temporal.
- A métrica já existe, então a sugestão não exige criar um novo evento de
  aprendizagem.
- Um insight contextual pode ser mais útil que outro KPI numérico.

### O que precisa ser corrigido

- “Maior intervalo” é sensível a amostras pequenas e outliers.
- A mediana mistura comportamento do Aluno com bloqueios temporais; não deve
  ser rotulada como “Aula problemática” ou “abandono”.
- Como a tabela já mostra o valor por Aula, um card repetindo o maior número
  seria redundante.
- Sem tamanho de amostra, a interface não dá evidência suficiente para uma
  decisão operacional.

## Decisão

**A sugestão é válida e deve ser implementada, mas em duas fatias.**

### Fatia 1 — contrato da métrica, implementar primeiro

Adicionar contagens de observações para as medianas de tempo até concluir e
tempo até a próxima Aula. Exibir a amostra no Sheet de detalhes, sem aumentar a
largura da tabela principal.

Copy recomendada:

> Mediana observada até a próxima Aula · 2,4 h · 8 observações

Também deixar claro que o valor representa registros observados no período e
não a regra de liberação do Curso.

### Fatia 2 — insight contextual, implementar depois da decisão de amostra

Criar uma lista pequena e plana, não um novo KPI, com as Aulas que apresentam
maior mediana **entre aquelas que atingirem a amostra mínima aprovada**.

Cada item deve mostrar:

- posição e nome da Aula;
- mediana observada;
- tamanho da amostra;
- período selecionado;
- ação `Ver detalhes` ou foco na linha existente.

Não usar vermelho, “risco”, “gargalo” ou “problema” automaticamente. A
interface deve permitir investigação, não substituir o julgamento pedagógico.

## Não implementar nesta sugestão

- comparar com outras turmas ou Alunos;
- classificar abandono ou desempenho individual;
- usar `release_delay_days` como se fosse comportamento observado;
- criar alerta sem amostra mínima;
- adicionar outro card de KPI;
- ordenar a tabela permanentemente pelo maior intervalo — a ordem curricular
  deve continuar sendo o padrão.

## Veredito final

**Implementar com ressalvas:** primeiro tornar a amostra e a semântica visíveis;
depois adicionar um insight contextual pequeno. A sugestão original está correta
ao pedir um insight em vez de outro KPI, mas precisa dessa proteção para não
transformar uma mediana observacional em diagnóstico de conteúdo.

