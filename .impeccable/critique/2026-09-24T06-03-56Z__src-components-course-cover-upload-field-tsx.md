---
target: Auditoria das experiências de upload de imagens do NeuroCapacitar Hub
total_score: 25
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 2
target_identity: "file:C:\\Users\\Junior\\.config\\superpowers\\worktrees\\hub\\small-changes\\src\\components\\course-cover-upload-field.tsx"
target_fingerprint: "sha256:ea9f26035754c1e38668d467d260a1d5eb9c37116e33c5f06afd51bfddbf2ef4"
target_path: "C:\\Users\\Junior\\.config\\superpowers\\worktrees\\hub\\small-changes\\src\\components\\course-cover-upload-field.tsx"
timestamp: 2026-09-24T06-03-56Z
slug: src-components-course-cover-upload-field-tsx
closed: true
---
Method: dual-agent (A: 01a0d1e4-ddaa-7852-9d93-ed62d1e19e99 · B: 01a0d1e4-e345-77d2-abd1-03a8e5958fa6)

## Design Health Score

| # | Heurística | Nota | Evidência |
|---|---|---:|---|
| 1 | Visibilidade do estado | 2/4 | Feedback desigual; alguns uploads não mostram estado. |
| 2 | Correspondência com a tarefa | 3/4 | Rótulos, formatos e recortes geralmente concretos. |
| 3 | Controle e liberdade | 2/4 | Cancelamento ativo e retry variam entre fluxos. |
| 4 | Consistência e padrões | 2/4 | Upload, staging, salvamento e publicação têm feedback distinto. |
| 5 | Prevenção de erro | 3/4 | Validação de arquivo, limites e crop no cliente e servidor. |
| 6 | Reconhecimento | 3/4 | Regras aparecem em alguns campos; outros dependem do seletor/erro. |
| 7 | Eficiência | 3/4 | Seletor e drag-and-drop; mídia da tela aceita múltiplos arquivos. |
| 8 | Estética/minimalismo | 3/4 | Tokens e componentes do Hub presentes; avaliação apenas por código. |
| 9 | Recuperação | 2/4 | Anexos têm retry; outras famílias dependem de selecionar novamente. |
| 10 | Ajuda contextual | 2/4 | Instruções de crop existem, mas recuperação não é uniforme. |
| **Total** | | **25/40** | **Aceitável (62,5%); fonte apenas, sem inspeção visual.** |

## Especificidade e impressão

Os recortes, proporções e formatos são específicos do Hub. A camada de transferência é menos coerente: “enviado” pode significar pronto para salvar, gravado ou publicado. A incerteza principal ocorre durante o envio e quando a prévia local substitui uma imagem persistida sem um rótulo de fase.

O armazenamento direto em R2 privado, URLs temporárias, confirmação server-side, limites por finalidade, crop e normalização são bons fundamentos. Criação de Curso e anexos de Aula mostram algum status; galerias mostram toast/skeleton. Edição de Curso e imagens do Certificado não explicam o upload em andamento.

## Achados prioritários

1. **[P1] Referência de anexo perdida ao trocar de aba.** O painel Anexos não usa `forceMount`, ao contrário de Vídeo/Texto. Upload e recursos vivem no estado local do painel; campos ocultos do formulário somem quando ele desmonta, embora o request possa concluir e mostrar sucesso. Salvar após voltar pode omitir o arquivo. Corrigir preservando o estado fora do painel ou mantendo-o montado; teste com request adiado + troca de aba. Esforço M; risco médio; confiança alta.
2. **[P1] Status não aparece em edição de Curso e Certificado.** Edição não passa `onUploadingChange`; o backend rejeita salvar enquanto envia. Certificado só desabilita salvar/publicar via `isBusy`, sem dizer que a arte está enviando. O cliente de imagem aguarda `fetch`/PUT/confirm sem callback de bytes. Renderizar status inline por arquivo/campo; diferenciar enviando, confirmando e pronto para salvar/publicar. Esforço M; risco baixo; confiança alta.
3. **[P2] Reentrada pode disparar fetch novo de arte de Certificado e capa.** A navegação por query volta a renderizar a aba; os templates recebem URLs R2 assinadas novas de 5 minutos e o preview usa `unoptimized`. O fundo também é 2376×1680. Capas passam por uma rota não otimizada que consulta o banco e redireciona. Medir URL, cache hit, TTFB e bytes antes de alterar cache. Esforço M; risco médio; confiança média-alta.
4. **[P2] Falha na cópia pública deixa Banner ativo apontando para chave não publicada.** Persistência do novo `image_url` precede `publishR2Object`; se a cópia falhar, não há rollback/compensação. Publicar primeiro, depois trocar o ponteiro e remover o anterior; cobrir falha em teste. Esforço M; risco médio; confiança alta.
5. **[P2] Anexo de imagem grande é decodificado antes da validação de 150 MiB.** A prévia é criada antes de `validateLessonAttachmentUpload`; o PUT materializa um `ArrayBuffer` integral e não há cancelamento ativo. Validar metadados cedo, limitar decodificação e instrumentar cancelamento/transferência; medir em dispositivo limitado antes de escolher estratégia de memória. Esforço M; risco médio; confiança média.

Uma rota de capa privada também responde com `Cache-Control: public, max-age=300` enquanto redireciona a um URL assinado de cinco minutos. A semântica pública merece correção/validação (`private, no-store`), mas a resposta não tem `s-maxage` e não foi demonstrado cache compartilhado na Vercel; não há evidência de vazamento efetivo.

## Carga cognitiva e personas

Falha confirmada: o usuário precisa inferir se a prévia local já foi gravada quando o status está ausente. Alex encontra envio sem feedback na edição de Curso; Sam não recebe o mesmo anúncio acessível nessas telas e no Certificado. A hierarquia visual não foi julgada sem screenshot/render.

## Perguntas para a próxima etapa

- Prioridade: corrigir primeiro a perda ao trocar de aba e status visível, ou incluir também resiliência de Banner/cache agora?
- Padrão de progresso: estado inline por item, porcentagem real apenas quando calculável e toast para resultado; ou toast como canal principal?
