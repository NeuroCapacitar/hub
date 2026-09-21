# Análise da próxima etapa: progressão pelas Aulas

> Status: análise read-only; nenhuma alteração de produto foi implementada nesta etapa.
> Baseline: `5aca12a2` (`feature/small-changes`).

## Decisão executiva

O bloco de fundação visual e Financeiro está concluído no commit atual. A próxima
etapa do plano original é **Analytics/novas features**, começando pela ideia de
“Progressão pelas Aulas” na rota `/admin/aprendizagem`.

A oportunidade é válida, mas a sugestão original de desenhar duas barras de
“iniciaram” e “concluíram” como se fossem um funil não deve ser implementada
literalmente ainda. Os números atuais não representam a mesma coorte nem têm a
mesma janela semântica; uma taxa visual de queda poderia induzir uma conclusão
falsa.

## Estado atual confirmado

- `src/app/(admin)/admin/aprendizagem/page.tsx` seleciona Curso, período de 1, 3,
  6 ou 12 meses e página pela URL (`:45-85`).
- `src/app/(admin)/admin/aprendizagem/learning-analytics-report.tsx` já oferece
  quatro KPIs, tabela ordenada pela sequência do Curso, detalhes por Aula e
  exportação (`:119-228`, `:327-374`).
- `src/features/learning-analytics/presentation.ts` agrega versões pela
  `curriculumKey` e exclui rascunhos (`:34-68`); a tabela já distingue estado
  atual de histórico (`:70-96`).
- A consulta atual preserva o período no URL e limita a lista a 20 Aulas; os
  relatórios já contam com caption semântica e rolagem horizontal local.
- O contrato de aprendizagem diz que o painel é descritivo, agregado por Aula e
  período, sem Aluno, Conta, e-mail, inatividade ou automação de reengajamento
  (`docs/domain/learning-content-and-progress.md:72-76`).

## O problema de semântica da visualização proposta

Os valores parecem comparáveis, mas não são uma coorte única:

1. `started` soma matrículas distintas que emitiram `lesson_started` no período
   (`src/features/learning-analytics/server.ts:199-219`).
2. `completed` conta usuários com `lesson_progress.completed_at` no período,
   por versão da Aula, e depois é agregado entre versões
   (`src/features/learning-analytics/server.ts:234-249` e
   `src/features/learning-analytics/presentation.ts:20-31`).
3. `activeEnrollments` é uma fotografia das Matrículas ativas agora, não o
   denominador da mesma janela analítica (`src/features/learning-analytics/server.ts:220-233`).
4. Conclusão manual é válida no domínio e não exige um evento de início; portanto
   “concluíram ÷ iniciaram” pode ultrapassar ou parecer uma conversão sem que
   exista erro no sistema (`docs/domain/learning-content-and-progress.md:45-47`).

Conclusão: barras lado a lado podem ser exibidas apenas como **contagens
descritivas do período**, nunca como taxa de conclusão, drop-off ou evidência de
que uma Aula causou abandono.

## Validação contra padrões externos

- O GOV.UK recomenda dashboards para indicadores de alto nível e alerta que eles
  não destacam automaticamente os insights; hierarquia, estrutura e explicações
  concisas são necessárias. Isso favorece uma seção pequena e interpretável,
  não mais um painel de métricas.
  [GOV.UK — Dashboards](https://brand.design-system.service.gov.uk/data/dashboards/)
- O Open edX Aspects separa relatórios de matrícula, engajamento e desempenho e
  permite observar o engajamento sequencial do conteúdo. O padrão é útil como
  referência de navegação e contexto, mas não autoriza copiar dashboards de
  risco ou dados individuais para o Hub.
  [Open edX — Course Dashboard Reports](https://docs.openedx.org/projects/openedx-aspects/en/open-release-sumac.master/reference/course_overview_dashboard.html)
- O Moodle distingue análise descritiva de preditiva/diagnóstica e recomenda que
  indicadores tenham um alvo e um propósito interpretável. Isso reforça não
  chamar a primeira visualização de “risco de abandono”.
  [Moodle — Analytics](https://docs.moodle.org/500/en/Analytics)
- O W3C exige alternativa textual para informação relevante apresentada por
  gráfico. A tabela existente deve permanecer como fonte acessível e precisa,
  mesmo que uma visualização seja adicionada.
  [W3C G103 — visual illustrations](https://www.w3.org/WAI/WCAG22/Techniques/general/G103)

## Recomendações priorizadas

### [DIR-01] Implementar uma visualização descritiva de Progressão pelas Aulas — condicional

- **Impacto:** ajuda a localizar rapidamente Aulas com baixa atividade registrada,
  muitos erros ou ausência de início, sem obrigar a leitura inicial de dez
  colunas.
- **Esforço:** M, se usar dados já agregados; L, se exigir coorte real ou novo
  read model.
- **Risco:** MED. Um gráfico mal rotulado vira uma taxa de abandono fictícia.
- **Confiança:** HIGH quanto à oportunidade; MED quanto à composição final.
- **Decisão:** implementar somente como composição descritiva, com título,
  período, Curso e legenda explícitos. A tabela continua sendo a fonte principal
  e a alternativa textual.

### [DIR-02] Definir o contrato de métrica antes do gráfico — implementar primeiro

- **Impacto:** impede que versões, períodos e denominadores sejam misturados.
- **Esforço:** S para documentar/testar o contrato; M se a decisão pedir query
  nova.
- **Risco:** LOW; pode atrasar um pouco a camada visual, mas reduz retrabalho.
- **Confiança:** HIGH.
- **Decisão:** a primeira fatia deve fixar nomes visíveis como “inícios
  registrados no período”, “conclusões registradas no período” e “erros
  registrados no período”. Proibir “taxa de conclusão”, “conversão” e
  “drop-off” até existir coorte comum.

### [DIR-03] Usar ranking de atenção apenas com regras aprovadas — investigar

- **Impacto:** pode transformar a visualização em decisão operacional, por
  exemplo “revisar esta Aula”.
- **Esforço:** M.
- **Risco:** HIGH; limiares arbitrários podem classificar Cursos pequenos de forma
  injusta e criar pressão por métricas sem evidência.
- **Confiança:** MED.
- **Decisão:** não criar score, cor de risco ou limiar nesta rodada. Se Produto
  definir um alvo pedagógico, abrir decisão própria com população, amostra,
  janela e ação de recuperação.

### [DIR-04] Preservar detalhes por Aula, exportação e histórico de versões — manter

- **Impacto:** evita que um resumo visual apague contexto necessário para
  interpretar mudanças de conteúdo.
- **Esforço:** S; já existe.
- **Risco:** LOW.
- **Confiança:** HIGH.
- **Decisão:** não substituir a tabela por gráfico nem esconder os detalhes. A
  visualização deve apontar para a mesma linha/Sheet quando houver ação de
  investigação.

## Fora de escopo

- risco individual, inatividade, ranking, streak, objetivo pessoal ou
  reengajamento;
- identificação de Alunos, Contas, e-mails ou coortes pessoais;
- nova biblioteca de gráficos;
- nova métrica global no Dashboard Admin;
- cálculo de conversão/drop-off sem coorte e denominador aprovados;
- alteração de progresso, conclusão, Certificado ou autorização.

## Próxima implementação recomendada

1. Criar testes de apresentação para os rótulos e estados vazios da nova seção.
2. Definir se a visualização usará todas as Aulas do Curso ou somente a página
   atual; preferir um read model resumido se a seção ficar acima da paginação.
3. Prototipar uma composição compacta e horizontal com contagens textuais e
   barras não interativas; manter a tabela abaixo.
4. Verificar desktop, viewport estreito, Curso com muitos Módulos, Aulas sem
   início, sem checkpoint, com erro e com histórico de versões.
5. Só depois avaliar se os dados sustentam uma coorte de progressão real.

O próximo trabalho de código deve começar por `DIR-02`, não pela aparência do
gráfico. A decisão visual está aprovada apenas para uma leitura descritiva e
reversível.

