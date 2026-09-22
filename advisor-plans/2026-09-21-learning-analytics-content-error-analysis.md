# Análise individual: conteúdo com erro

> Status: análise read-only; nenhum código foi alterado nesta etapa.
> Baseline: `e436ae80` (`feature/small-changes`).

## Localização no plano

Esta é a sugestão seguinte à análise de “Aula com muito início e pouca
conclusão” na **Fase 6 — Analytics/novas features**, seção `# 59 —
Funcionalidades para Admin` do relatório anexado. O relatório registra apenas:

> “Conteúdo com erro — Já existe.”

## Estado atual confirmado

A capacidade já existe em duas superfícies diferentes:

### Aprendizagem

- O KPI `Aulas com erro` conta Aulas cujo agregado possui eventos de erro.
- A tabela mostra `Erros` por Aula.
- O Sheet de detalhes mostra `Erros` por versão.
- Os eventos usados são `player_error` e `resource_open_failed`, agregados no
  período (`src/features/learning-analytics/server.ts:214-219`).

### Operação

- Falhas de vídeo e saúde da JMVStream ficam em **Admin > Operação**.
- O Dashboard Admin encaminha `Falhas de vídeo` para a fila operacional, em vez
  de tratá-las como métrica pedagógica
  (`src/app/(admin)/admin/(dashboard)/page.tsx:240-259`).
- O guia de domínio também define que diagnóstico da JMVStream pertence à
  Operação (`docs/domain/certificates-and-data-rights.md:30`).

Essa separação é correta: analytics responde “o que foi registrado durante a
aprendizagem”; Operação responde “qual integração ou fluxo precisa de
recuperação”.

## Limitações da métrica atual

`errorCount` é uma contagem de eventos, não de Alunos afetados. Uma pessoa pode
gerar várias falhas; uma Aula popular também tende a acumular mais eventos.
Portanto, o número não sustenta sozinho:

- classificar uma Aula como defeituosa;
- criar um alerta vermelho;
- comparar Cursos de tamanhos diferentes;
- afirmar que o conteúdo, e não o player, causou a falha.

Para uma fila de recuperação seriam necessários pelo menos tipo de erro,
severidade, matrículas afetadas, primeira/última ocorrência e ação responsável.
Esses dados pertencem à observabilidade/Operação, não à tabela descritiva de
Aprendizagem.

## Pesquisa externa

- O Open edX separa relatórios de engajamento e desempenho e usa o relatório de
  Curso para observar comportamento do conteúdo, mantendo a análise técnica e
  operacional em contextos próprios.
  [Open edX — Course Dashboard Reports](https://docs.openedx.org/projects/openedx-aspects/en/open-release-sumac.master/reference/course_overview_dashboard.html)
- O Moodle diferencia analytics descritivo de diagnóstico e preditivo; logs
  informam o que aconteceu, mas não explicam sozinhos por que aconteceu.
  [Moodle — Analytics](https://docs.moodle.org/500/en/Analytics)
- Revisões de dashboards educacionais recomendam transformar dados em ação
  somente quando existe contexto e intervenção definida, em vez de adicionar
  mais indicadores ao painel.
  [Springer — Checklist para dashboards](https://link.springer.com/article/10.1186/s41239-023-00394-6)

## Decisão

**Não implementar uma nova seção para “Conteúdo com erro”.** A sugestão do
relatório já está atendida no código atual.

Manter:

- `Aulas com erro` como resumo descritivo;
- `Erros` por Aula e por versão;
- falhas técnicas e recuperação na Operação/JMVStream;
- ausência de alerta ou ranking baseado somente em volume de eventos.

Uma melhoria futura, caso haja necessidade real, deve ser uma evolução do
contrato operacional — eventos afetados por matrícula, severidade e ação de
recuperação — e não mais um card visual em Aprendizagem.

## Resultado final

**Sugestão validada como já implementada.** Nenhum ajuste de UI é necessário
nesta etapa; adicionar outra composição criaria duplicação e poderia confundir
erro técnico com desempenho pedagógico.

