# Análise individual: Aula com muito início e pouca conclusão

> Status: análise read-only; nenhum código foi alterado nesta etapa.
> Baseline: `e436ae80` (`feature/small-changes`).

## Localização no plano

Esta é a próxima sugestão da **Fase 6 — Analytics/novas features**, logo após
“Maior intervalo até próxima Aula”, na seção `# 59 — Funcionalidades para
Admin` do relatório anexado. O relatório chama a ideia de “outro insight
acionável”.

## Decisão executiva

**Não implementar agora como insight, ranking, badge ou taxa.** A ideia é útil,
mas o contrato atual não permite afirmar que uma Aula teve “muito início e
pouca conclusão”. Os números atuais são contagens agregadas de eventos e
progresso, não uma coorte de pessoas acompanhada entre duas etapas.

O próximo passo correto é uma decisão de domínio sobre coorte, janela de
conclusão e retenção de evidência. Só depois disso a funcionalidade pode ser
implementada com uma taxa interpretável.

## Evidência no código atual

- `started` soma matrículas distintas que emitiram `lesson_started` por Aula e
  período (`src/features/learning-analytics/server.ts:199-219`).
- Para dias anteriores, a consulta usa `learning_analytics_daily_metrics`, que
  preserva contagens agregadas, não a identidade de cada matrícula
  (`src/features/learning-analytics/server.ts:198-213`).
- `completed` conta usuários com `lesson_progress.completed_at` por versão e
  depois soma as versões da mesma `curriculumKey`
  (`src/features/learning-analytics/server.ts:234-249`,
  `src/features/learning-analytics/presentation.ts:45-60`).
- Conclusão manual é válida sem evento de início no domínio
  (`docs/domain/learning-content-and-progress.md:45-47`).
- O denominador `activeEnrollments` é uma fotografia atual das Matrículas, não
  a coorte que iniciou a Aula no período (`src/features/learning-analytics/server.ts:220-233`).

Consequência: `completed / started` pode misturar pessoas diferentes, versões,
momentos de conclusão posteriores e conclusões manuais. A diferença entre dois
números pode ser exibida descritivamente, mas não pode ser nomeada como
drop-off, conversão ou abandono.

## O que uma análise de funil correta exigiria

Uma taxa válida precisaria definir e preservar:

1. **Entrada:** primeira ocorrência de `lesson_started` por matrícula e
   `curriculumKey` na janela escolhida.
2. **Saída:** conclusão da mesma chave curricular pela mesma matrícula, incluindo
   explicitamente a regra para conclusão manual.
3. **Janela:** quanto tempo a coorte tem para concluir; sem isso, inícios no fim
   do período serão penalizados artificialmente.
4. **Versão:** como a conclusão atravessa publicações e como uma Aula removida ou
   substituída é tratada.
5. **Elegibilidade:** acesso ativo, revogação, expiração e Aulas opcionais.
6. **Amostra:** mínimo de observações antes de destacar uma taxa.

O histórico agregado atual não contém identidade de matrícula para todos os
inícios antigos. Portanto, reconstruir esse funil para 1, 3, 6 ou 12 meses
exigiria uma nova projeção persistida ou limitar explicitamente a análise a uma
janela de dados brutos que ainda tenha identidade.

## Pesquisa externa

- O Google Analytics só chama uma visualização de funil quando os passos são
  definidos por usuários, ordem de eventos e regras de entrada; funis fechados
  excluem quem não completou o primeiro passo e sequências podem ter limite de
  tempo. Isso confirma que duas contagens independentes não formam um funil.
  [Google Analytics — Funnel exploration](https://support.google.com/analytics/answer/9327974?hl=en)
- O mesmo produto diferencia funil de exploração de caminho: uma análise de
  caminho serve para investigar trajetórias, enquanto o funil exige passos
  definidos e comparáveis.
  [Google Analytics — Path exploration](https://support.google.com/analytics/answer/9317498?hl=en)
- O Moodle separa analytics descritivo de diagnóstico e preditivo e alerta que
  logs não explicam sozinhos o motivo de um comportamento. A ideia precisa de
  alvo e propósito pedagógico antes de virar classificação.
  [Moodle — Analytics](https://docs.moodle.org/500/en/Analytics)
- Revisões de dashboards educacionais mostram que muitos produtos aumentam
  consciência, mas oferecem pouca ação confiável; recomenda-se ligar o dado a
  reflexão, planejamento e intervenção definidos, não apenas a mais um ranking.
  [Springer — Dashboard checklist](https://link.springer.com/article/10.1186/s41239-023-00394-6)

## Alternativas avaliadas

### Usar `started - completed` como insight

**Rejeitar.** É uma diferença entre populações e não mede pessoas que deixaram
de concluir.

### Usar `completed / started` com os dados atuais

**Rejeitar.** Cria uma taxa visualmente convincente, mas sem coorte, janela ou
identidade histórica suficiente.

### Mostrar somente “inícios” e “conclusões” lado a lado

**Já implementado como descrição, não como drop-off.** A tabela atual comunica
os dois valores com rótulos explícitos e sem afirmar causalidade.

### Criar uma coorte persistida

**Válido para uma fase futura, condicionado à decisão de Produto/Privacidade.**
É a única alternativa que sustenta uma taxa real para períodos históricos, mas
exige contrato de retenção, opt-out, migration/read model e testes de publicação.

## Proposta para uma fase futura

Se a necessidade for confirmada, especificar primeiro um relatório chamado
**Conclusão da coorte por Aula**, com:

- coorte e janela visíveis;
- `iniciaram na coorte`, `concluíram na janela` e taxa calculada sobre a mesma
  população;
- tamanho da amostra e casos sem janela concluída;
- agrupamento por `curriculumKey`, sem expor Aluno ou e-mail;
- link para detalhes da Aula, não para uma intervenção automática;
- estado “dados insuficientes” quando a amostra mínima não for atingida.

## Resultado final

**Não implementar esta sugestão no estado atual.** Marcar como adiada, não como
rejeitada definitivamente. A implementação só deve começar após a decisão do
contrato de coorte e da persistência de evidência necessária.

