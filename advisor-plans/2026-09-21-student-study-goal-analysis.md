# Análise individual: objetivo pessoal de estudo

> Status: análise read-only; nenhum código foi alterado nesta etapa.
> Baseline: `e436ae80` (`feature/small-changes`).

## Localização no plano

Depois de validar que “Publicação e certificado” já existe e que Financeiro
deve permanecer separado, a próxima sugestão ainda não implementada do relatório
é **Objetivo pessoal de estudo**, em `# 56 — Funcionalidades que eu consideraria
para o Aluno`, classificada como “Boa hipótese futura”.

Exemplo proposto pelo relatório:

```text
Quanto tempo você gostaria de reservar?
15 min · 30 min · 45 min
```

E, a partir disso, ajudar o Aluno a escolher uma Aula compatível.

## Estado atual do Hub

- A Home do Aluno já tem um próximo Curso/Aula e duração, implementados no
  fluxo de continuidade (`src/app/(student)/app/(dashboard)/continue-learning-card.tsx`).
- A projeção de Curso já fornece duração e próxima Aula; não existe objetivo
  pessoal persistido, seleção de faixa de tempo ou recomendação por preferência.
- Não há campo de usuário, tabela ou preferência existente que represente uma
  meta de estudo. `learning_analytics_preferences` não deve ser reutilizada:
  ela controla opt-out de coleta técnica, não preferências pedagógicas.
- A recomendação não pode alterar sequência, disponibilidade, conclusão ou
  Certificado. A Aula compatível deve ser uma sugestão entre Aulas já
  disponíveis.

## Pesquisa externa

- O My Learning Analytics, da Universidade de Michigan, foi desenhado para
  apoiar consciência, reflexão e planejamento, e incorporou voz dos Alunos e
  análise de uso antes de consolidar a experiência.
  [EDUCAUSE — MyLA](https://er.educause.edu/articles/2021/7/show-students-their-data-using-dashboards-to-support-self-regulated-learning)
- Uma revisão sistemática de intervenções de learning analytics encontrou efeito
  positivo em apenas 46% dos estudos e recomenda contemplar planejamento,
  execução e reflexão, não apenas expor métricas.
  [Springer — Self-regulated learning interventions](https://link.springer.com/article/10.1007/s10639-022-11281-4)
- Uma revisão de dashboards teacher-facing mostra que muitos aumentam
  consciência, mas oferecem poucas ações efetivamente acionáveis; propósito,
  participação dos usuários e avaliação precisam ser definidos antes de
  adicionar a visualização.
  [Springer — Dashboard checklist](https://link.springer.com/article/10.1186/s41239-023-00394-6)

## Avaliação da ideia

### O que é válido

- É mais alinhado à autorregulação do que streak, ranking ou comparação social.
- Usa um dado compreensível para o Aluno: tempo disponível agora.
- Pode tornar o próximo passo mais humano sem adicionar vários KPIs.
- Aproveita duração de Aula já existente.

### Riscos

- Uma meta pode virar pressão se aparecer como cobrança, atraso ou falha.
- Recomendar uma Aula posterior pode quebrar a sequência pedagógica ou sugerir
  conteúdo bloqueado.
- Faixas fixas de 15/30/45 minutos podem não representar Cursos de texto,
  materiais curtos ou Aulas longas.
- Persistir a preferência exige uma decisão de domínio, migration e controle de
  edição; localStorage não funciona bem entre dispositivos.
- Sem evidência de uso, o controle pode ser mais uma configuração órfã na Home.

## Decisão

**Validar como experimento pequeno, não implementar como feature completa ainda.**

A proposta merece um protótipo porque responde às perguntas certas — “quanto
tempo tenho?” e “o que consigo fazer agora?” —, mas o relatório a classifica
corretamente como hipótese futura, não como requisito de alta confiança.

## Forma recomendada para um experimento futuro

1. Preferência opcional, com estados `sem preferência`, `15 min`, `30 min` e
   `45 min`; permitir limpar a escolha.
2. Persistência em uma preferência pedagógica própria, separada de analytics
   opt-out e sem enviar novos eventos técnicos por padrão.
3. Controle compacto junto de **Seu próximo passo**, não uma nova seção de KPIs.
4. A recomendação nunca pula a sequência: prioriza a próxima Aula disponível.
   Se ela exceder o tempo escolhido, exibe a duração real e permite iniciar
   mesmo assim, sem escolher silenciosamente outra Aula.
5. Aulas sem duração recebem fallback neutro, como “Tempo não informado”, sem
   inventar compatibilidade.
6. Copy sem cobrança: “Escolha um tempo para encontrar uma boa sessão” em vez
   de “Você precisa estudar”.
7. Medir apenas uso da preferência e clique na recomendação, respeitando a
   política de analytics existente; não criar streak, lembrete ou ranking junto.

## O que não implementar

- notificações ou lembretes automáticos;
- metas diárias obrigatórias;
- pontuação, streak ou comparação com outros Alunos;
- recomendação que pule Aulas disponíveis anteriores;
- novos KPIs de horas estudadas;
- persistência dentro da preferência de analytics.

## Resultado final

**Sugestão válida, mas ainda não pronta para implementação integral.** O próximo
passo recomendado é um protótipo/validação de uso da preferência junto ao bloco
de continuidade. Só depois de evidência de uso deve-se criar a persistência e a
recomendação completa.

