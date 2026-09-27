# Análise individual: Progressão pelas Aulas

> Status: análise read-only; nenhum código foi alterado nesta etapa.
> Baseline: `96c5924d` (`feature/small-changes`).

## Localização no plano

Esta é a sugestão `# 44 — Aprendizagem Admin` do relatório anexado: uma
visualização de progressão pelas Aulas para ajudar a localizar diferenças entre
inícios e conclusões.

## Estado atual

A sugestão já foi implementada em três incrementos:

- `591af7c5`: atividade inline na tabela, com barras de Inícios e Conclusões;
- `cdd93746`: amostras por mediana no Sheet de detalhes;
- `e436ae80`: seção `Pausas observadas`, com amostra agregada e navegação para
  a linha da Aula.

O resultado mantém a tabela como fonte principal, preserva a ordem curricular e
evita transformar as contagens em taxa de drop-off.

## Divergência intencional em relação ao relatório

O relatório original usa “encontrar onde a jornada perde alunos”. O Hub não
afirma isso porque `started` e `completed` não são uma coorte comum. Uma análise
de funil real precisa definir usuários/matrículas, ordem dos passos e janela de
tempo; ferramentas de analytics tratam essas regras explicitamente.
[Google Analytics — Funnel exploration](https://support.google.com/analytics/answer/9327974?hl=en)

Portanto, a implementação atual responde uma pergunta mais segura:

> “Como os registros de atividade se distribuem pelas Aulas e quais pausas foram
> observadas?”

Ela não responde “qual Aula causou abandono”.

## Validação externa

Open edX separa matrícula, engajamento e desempenho em relatórios com contexto
de Curso, enquanto revisões de dashboards educacionais alertam que consciência
de dados não é suficiente sem uma ação interpretável e avaliação de impacto.
[Open edX](https://docs.openedx.org/projects/openedx-aspects/en/open-release-sumac.master/reference/course_overview_dashboard.html),
[Springer — Dashboard checklist](https://link.springer.com/article/10.1186/s41239-023-00394-6)

## Decisão

**Considerar a sugestão implementada na forma segura e adequada ao contrato
atual.** Não adicionar outro gráfico, KPI ou ranking nesta etapa.

Uma versão futura de drop-off só deve existir após uma decisão própria de coorte,
retenção de identidade agregada, janela de conclusão e amostra mínima. Isso será
uma nova feature de dados, não um refinamento visual da tela atual.

