---
target: Aviso de progresso linear após seek
total_score: 28
max_score: 40
na_heuristics: ""
p0_count: 0
p1_count: 0
target_identity: "file:C:\\Users\\Junior\\.config\\superpowers\\worktrees\\hub\\small-changes\\src\\components\\lesson-video-player.tsx"
target_fingerprint: "sha256:4f91e0d6bb3cff9c355db7a1f6de6a536525f955030d49110bb99c8e603fd328"
target_path: "C:\\Users\\Junior\\.config\\superpowers\\worktrees\\hub\\small-changes\\src\\components\\lesson-video-player.tsx"
timestamp: 2026-09-24T01-09-36Z
slug: src-components-lesson-video-player-tsx
---
Method: dual-agent (A: 01a0d0de-6d7f-7b72-b167-e12a4ef9c25d · B: 01a0d0de-7945-7792-82e9-a285ed4fb7fa)

# Aviso de conclusão automática após seek

## Design language

- **Audited surface:** aviso condicional no `LessonVideoPlayer` abaixo do iframe.
- **Design sources:** `DESIGN.md`, `docs/domain/learning-content-and-progress.md`, `docs/adr/0012-linear-validated-video-progress.md`.
- **Documented decisions:** seek para frente não avança a fronteira validada; conclusão automática requer reprodução linear até 100%; conclusão manual não exige visualização mínima. Feedback não urgente pode usar status polido e toast.
- **Governing owners and consumers:** `advanceVideoPlaybackProgress` em `src/features/progress/rules.ts`; progresso persistido e sessão em `src/features/courses/server.ts`; `LessonVideoPlayer`; cabeçalho da aula com `CompleteLessonButton`; Sonner global.
- **Explicit exceptions:** None documented.

## Design Health Score

| # | Heurística | Nota | Questão principal |
|---|---|---:|---|
| 1 | Visibilidade do estado | 3/4 | O estado aparece, mas a mudança não é anunciada pela mensagem visível. |
| 2 | Correspondência com o mundo real | 2/4 | “Volte ao início” pode implicar rever o vídeo todo. |
| 3 | Controle e liberdade | 3/4 | Há conclusão manual, mas a alternativa aparece também no texto. |
| 4 | Consistência e padrões | 3/4 | Regra consistente; feedback pode seguir melhor o contrato de status não urgente. |
| 5 | Prevenção de erro | 4/4 | Avançar o playhead não conta como reprodução linear validada. |
| 6 | Reconhecimento em vez de lembrança | 3/4 | A explicação está presente, mas não localiza o ponto de retomada. |
| 7 | Eficiência e flexibilidade | 3/4 | Dois caminhos: reproduzir o trecho ou concluir manualmente. |
| 8 | Estética e minimalismo | 2/4 | O usuário relata ruído do texto fixo; sem renderização não foi possível verificar sua composição. |
| 9 | Recuperação | 2/4 | A instrução de recuperação é imprecisa. |
| 10 | Ajuda contextual | 3/4 | Ajuda ligada ao player, mas com explicação mais longa do que o necessário. |
| **Total** | | **28/40 (70%)** | **Bom, com refinamentos necessários. Avaliação limitada ao aviso.** |

## Design Specificity Verdict

A regra é específica do progresso linear do Hub e está respaldada pelo ADR-0012. Visualmente, o código usa uma linha de texto neutra, mas não há evidência renderizada suficiente para julgar a identidade visual da página. O usuário relata que o aviso fixo pesa; essa percepção é tratada como evidência, sem afirmar medidas de layout não inspecionadas.

## Overall Impression

O aviso comunica uma regra válida, porém mistura a causa, a recuperação e uma alternativa manual que já está disponível no cabeçalho. A melhor oportunidade é separar o feedback imediato do estado ainda ativo: reduzir muito o texto persistente e usar toast informativo apenas como confirmação da mudança.

## What's Working

- O servidor não confunde um salto para frente com vídeo assistido; a fronteira validada só avança com reprodução linear.
- A regra não bloqueia completamente o aluno: concluir manualmente continua disponível.
- O aviso só aparece enquanto `linearProgressBlocked` está ativo, em vez de poluir todas as aulas.

## Priority Issues

1. **[P2] Explicação persistente ocupa mais espaço e duplica ação.** O parágrafo condicional explica o estado, mas o texto de conclusão manual repete o botão `Concluir aula`, renderizado logo depois no cabeçalho da aula. **Correção:** remover o parágrafo longo; mostrar toast `info` uma vez quando o estado bloqueado surgir e manter somente um indicador curto e discreto, próximo à ação, enquanto o bloqueio persistir. Se a aula abrir com o bloqueio persistido, mostrar o toast uma vez nessa abertura. Não repetir em cada sincronização periódica.
2. **[P2] Copy generaliza o ponto de recuperação.** O texto manda “voltar ao início”, enquanto a regra libera o avanço novamente ao retornar à fronteira validada, que pode não ser o início do vídeo. **Correção:** dizer “Volte ao começo do trecho pulado e reproduza dali sem avançar.” Remover a frase sobre conclusão manual, pois o CTA já está visível.

## Persona Red Flags

- **Jordan, primeiro uso:** pode interpretar “volte ao início” como recomeçar a aula inteira.
- **Casey, mobile:** o texto persistente consome espaço vertical abaixo do player; um toast muito breve ou sem repetição ao retornar também pode ser perdido.

## Minor Observations

- O toast global do produto está configurado no canto superior direito; manter um indicador mínimo junto à ação preserva proximidade contextual.
- Se houver atualização dinâmica, a mensagem deve ser anunciada uma vez como status polido, sem mover foco nem anunciar cada atualização de progresso.
- Os testes cobrem o estado inicial, mas não a transição após seek, a persistência/reabertura, a recuperação ou a ausência de toast repetido.

## Questions to Consider

O contrato do produto já determina a regra de progresso; não resta uma decisão de domínio em aberto. A recomendação desta análise é híbrida e não altera o contrato.

## Research basis

- W3C/WAI exige que mudanças importantes de status sejam determináveis por tecnologia assistiva sem receber foco; WCAG não determina se o formato visual precisa ser toast ou inline: https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
- Carbon diferencia inline contextual, que persiste enquanto relevante, de toast curto que desaparece; mensagens necessárias depois do timeout precisam continuar acessíveis: https://carbondesignsystem.com/components/notification/usage/ e https://carbondesignsystem.com/patterns/notification-pattern/
- Moodle, Canvas e Teachable documentam completion/estados de curso, mas os guias consultados não esclarecem a semântica de seek para conclusão; FastPix documenta um plugin opcional de cobertura por segundos únicos, não Moodle core nem a fronteira linear do Hub.
- A pesquisa com fontes, datas e limitações está em `design-plans/2026-09-23-transient-status-and-linear-video-progress-research.md`.
