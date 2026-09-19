# Resumo de oferta do Curso antes da inscrição ou compra

Written against: `1d5f5dc5` (`feature/small-changes`)

## Evidence chain

- Surface: dashboard do Aluno, cards de Curso e o modal `FreeCourseEnrollmentDialog`.
- Problem: o modal atual funciona somente para inscrição gratuita, usa um cabeçalho genérico com ícone, repete explicações técnicas e sempre dá o mesmo destaque para aulas e carga horária. O fluxo pago sai diretamente do card para `/comprar/[slug]`, sem uma etapa de resumo consistente.
- Design evidence: [`DESIGN.md`](../DESIGN.md), [`PRODUCT.md`](../PRODUCT.md), [`src/components/ui/dialog.tsx`](../src/components/ui/dialog.tsx), [`src/features/courses/course-cover-image.tsx`](../src/features/courses/course-cover-image.tsx) e [`src/lib/formatters.ts`](../src/lib/formatters.ts).
- Owner: [`src/app/(student)/app/(dashboard)/page.tsx`](../src/app/(student)/app/(dashboard)/page.tsx) e a composição compartilhada de diálogo em `src/features/courses/`.
- Scope and affected surfaces: inscrição gratuita, reativação gratuita, compra/renovação paga iniciada no catálogo do Aluno; o handoff e o checkout continuam sendo a autoridade da compra.
- Uncertainty: uma data exata de expiração não existe antes da confirmação da aquisição; o resumo deve exibir a duração configurada do acesso, como “12 meses de acesso”, e não inventar uma data.

## Design decision

Criar uma composição compartilhada de resumo de oferta do Curso, usada por inscrição gratuita e compra paga, mantendo os comportamentos de ação separados.

O diálogo terá um cabeçalho visual com uma faixa da capa do Curso ocupando a largura, degradê progressivo até a superfície do modal e o título do Curso ancorado na base. A capa deve ser conteúdo visual do Curso, não decoração de estado; quando não houver imagem, usar o fallback existente do card.

O conteúdo será orientado à decisão do Aluno:

- título e descrição curta do Curso;
- quantidade de Aulas e Módulos, somente quando maiores que zero;
- carga horária somente para ofertas pagas e somente quando houver valor útil;
- duração de acesso, especialmente na oferta paga;
- Certificado somente quando o fluxo efetivo do Curso permitir emissão;
- preço destacado somente na oferta paga;
- uma explicação curta da próxima etapa, sem detalhes técnicos de Pedido, Checkout ou Concessão.

Para o Curso gratuito, a carga horária não será exibida no resumo. O fato principal será o acesso gratuito e imediato. Para a compra paga, a ação primária continuará levando para `/comprar/[slug]`; o diálogo não criará Pedido, checkout paralelo ou estado financeiro próprio.

## Reuse

- `Dialog`, `DialogContent`, `DialogHeader`, `DialogBody`, `DialogFooter`, `DialogClose`, `DialogTitle` e `DialogDescription` de [`src/components/ui/dialog.tsx`](../src/components/ui/dialog.tsx).
- `CourseCoverImage` de [`src/features/courses/course-cover-image.tsx`](../src/features/courses/course-cover-image.tsx), incluindo `coverBlurDataUrl`, fallback de erro e `unoptimized`.
- `formatCurrencyInCents` e os formatadores existentes de [`src/lib/formatters.ts`](../src/lib/formatters.ts).
- `FreeEnrollmentButton` para preservar a Server Action, loading, erro inline e redirecionamento atuais.
- `getStudentCourseCatalog` e `StudentCatalogCourseCard` como fonte do resumo do catálogo; a autoridade final de disponibilidade, preço e checkout continua em `getPurchaseHandoffView` e no endpoint de checkout.
- Exemplar de elegibilidade de Certificado: `getEnrolledCourseOverview` já reduz `certificateEnabled` ao fluxo efetivo (`certificate_enabled` mais existência de Aulas obrigatórias ou Certificado histórico). O catálogo deve aplicar a mesma regra de forma segura antes de exibir a promessa.

## Changes

1. `src/features/courses/server.ts` e `StudentCatalogCourseCard`
   - Change: projetar os dados necessários ao resumo: `accessDurationMonths`, `certificateEnabled` efetivo, Módulos e a oferta de pagamento configurada.
   - Preserve: ordenação do catálogo, estados de acesso, disponibilidade comercial, `thumbnailUrl`, blur, preço e todos os campos usados pelos cards atuais.
   - Verify: cursos sem capa, sem descrição, sem Aulas, sem carga horária e sem Certificado continuam válidos e não exibem placeholders inventados.

2. `src/features/courses/course-offer-dialog.tsx` (novo componente compartilhado)
   - Change: concentrar a estrutura visual do diálogo, hero de capa com degradê, resumo, fatos condicionais e footer; receber a ação primária por composição para não acoplar o componente à inscrição ou ao checkout.
   - Preserve: foco, Escape, fechamento pelo overlay, botão de fechar acessível, `DialogBody` rolável e footer persistente do primitive existente.
   - Verify: título longo, descrição longa, ausência de imagem, falha de imagem, viewport estreito e zoom não quebram a hierarquia nem escondem a ação principal.

3. `src/app/(student)/app/(dashboard)/free-course-enrollment-dialog.tsx`
   - Change: tornar o modal gratuito um adaptador da composição compartilhada; usar a capa, esconder carga horária, mostrar Aulas e Certificado apenas quando aplicáveis e reduzir a copy técnica.
   - Preserve: `none` versus `expired`, textos de reativação, `FreeEnrollmentButton`, erro inline, loading e redirecionamento após inscrição.
   - Verify: inscrição nova, reativação, erro de Server Action, estado pendente e fechamento sem mutação.

4. `src/app/(student)/app/(dashboard)/course-purchase-dialog.tsx` (novo adaptador)
   - Change: substituir o Link direto de aquisição no card por um trigger do mesmo resumo; mostrar preço, condições de Pix/parcelamento efetivas, duração de acesso, Aulas, Módulos, carga horária útil e Certificado efetivo; CTA “Comprar” mantém o href atual para `/comprar/[slug]`.
   - Preserve: renovação de acesso expirado, bloqueio de revogado, interesse em Curso futuro/inscrições pausadas e validação server-side do handoff.
   - Verify: clicar no card abre o diálogo; cancelar não navega; CTA segue para o mesmo slug; mudanças de preço/disponibilidade continuam sendo resolvidas pelo checkout.

5. Testes afetados
   - Change: ampliar os testes do modal para gratuito, reativação, pago, capa presente/ausente, certificado presente/ausente, carga horária omitida para gratuito, duração de acesso e títulos/descrições longos.
   - Preserve: testes existentes de `FreeEnrollmentButton`, `PurchaseHandoffClient` e `getPurchaseHandoffView`.
   - Verify: `bun x vitest run` nos testes de catálogo, modal e purchase handoff; `bun run check`; `bun run typecheck`.

## Scope

- Inherit: todos os Cursos exibidos no catálogo do Aluno que usam `CoursePurchaseForm` ou `FreeCourseEnrollmentDialog`.
- Verify: renovação de Curso pago expirado, Curso gratuito expirado, estados `coming_soon` e `sales_paused`, card sem thumbnail e Cursos com certificado habilitado.
- Exclude: redesign da página pública `/comprar/[slug]`, mudanças no endpoint de checkout, alteração de preço, duração, regras de Certificado ou migrations de negócio.

## Validation

- Product: o Aluno entende o que receberá antes de se inscrever/comprar e diferencia claramente acesso gratuito, preço, duração e Certificado.
- Interface: verificar desktop e mobile, título com duas linhas, descrição longa, ausência de capa, carga horária `0`, Certificado desligado, botão primário em loading/erro e modal rolável.
- System: confirmar que existe uma única composição visual compartilhada e que a ação gratuita/paga permanece em adaptadores pequenos, sem duplicar regras de compra.
- Repository: `bun run check` → sem findings; `bun run typecheck` → sem erros; testes direcionados → todos passam.

## Stop conditions

- Parar se a data de expiração exata for exigida antes da aquisição; o contrato atual só fornece a duração configurada nesse momento.
- Parar se o Certificado exibido no catálogo não puder ser reduzido à mesma elegibilidade efetiva usada na trilha do Aluno.
- Parar se a compra exigir preço/oferta diferente da informação disponível no catálogo; nesse caso, ampliar primeiro o contrato do handoff, sem duplicar regra financeira no cliente.

## Design documentation

- Após implementação e validação: registrar em `DESIGN.md` somente se o padrão de resumo de oferta se tornar um componente oficial para outras superfícies; caso contrário, nenhuma documentação canônica adicional.
