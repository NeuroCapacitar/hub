# Confirmação de compra sem repetir o resumo do Curso

Written against: `1d5f5dc5` (`feature/small-changes`)

## Evidence chain

- Surface: [`src/app/(student)/app/checkout/sucesso/page.tsx`](../src/app/(student)/app/checkout/sucesso/page.tsx) e [`checkout-access-waiter.tsx`](../src/app/(student)/app/checkout/sucesso/checkout-access-waiter.tsx).
- Related stages: o modal de oferta no catálogo e o handoff `/comprar/[slug]` já mostram o resumo completo do Curso antes/durante a preparação do checkout.
- Problem: repetir capa, descrição, preço, Aulas, Módulos e duração na página de sucesso criaria três exposições do mesmo conteúdo na mesma jornada. A confirmação pós-compra precisa responder outra pergunta: “o acesso já foi liberado e o que faço agora?”.
- Runtime evidence: o servidor redireciona quando `getStudentCourseAccessStatus` já permite acesso; caso contrário, o cliente consulta `/api/enrollments/access` a cada 2,5 segundos por até 30 tentativas e redireciona com `window.location.replace` quando `canAccess` fica verdadeiro.
- Design evidence: [`DESIGN.md`](../DESIGN.md) exige uma composição para cada pergunta, hierarquia orientada à tarefa, visibilidade de estado e recuperação próxima da ação.
- Owner: `CheckoutSuccessPage` e `CheckoutAccessWaiter`; o resumo de oferta permanece dono do modal e do handoff.
- Scope and affected surfaces: retorno de compra paga em `/app/checkout/sucesso?courseId=...`; não altera o modal, o handoff, o checkout hospedado ou o webhook.
- Uncertainty: o retorno do provedor não prova sozinho que o pagamento foi confirmado. A página deve evitar “pagamento aprovado” até o acesso server-side estar efetivo.

## Design decision

Manter `/checkout/sucesso` como uma página de status pós-compra, não como uma terceira página de detalhes do Curso.

O fluxo terá uma divisão clara:

```text
Catálogo/modal  -> decidir o que comprar
Handoff         -> preparar e abrir o checkout
Sucesso         -> confirmar/liberar o acesso
Curso           -> consumir o conteúdo
```

A página de sucesso terá:

- marca e superfície centralizadas;
- status neutro, como `Acesso em confirmação`;
- título `Estamos liberando seu acesso`;
- explicação curta de que o retorno do checkout foi recebido e a matrícula está sendo confirmada;
- uma linha compacta de contexto do Curso, opcionalmente com miniatura e título, sem descrição, métricas, preço ou condições repetidas;
- uma sequência curta de estado: retorno recebido → acesso sendo confirmado → Curso será aberto;
- `Verificar agora` enquanto houver polling;
- `Voltar para cursos` como saída segura;
- estado explícito de timeout, sem incentivar uma nova compra.

O resumo completo continua exclusivamente no modal e no handoff. A página de sucesso pode reutilizar tokens, capa compacta e tipografia, mas não o conteúdo inteiro do resumo.

## States

- `courseId` com acesso liberado: redirect imediato para a trilha, sem renderizar a confirmação.
- Esperando: status em andamento, texto curto e linha de contexto do Curso.
- Polling em andamento: atualizar a mensagem sem repetir dados do Curso.
- Timeout após as 30 tentativas: “Ainda não conseguimos confirmar automaticamente”; mostrar `Verificar agora`, `Voltar para cursos` e suporte quando a recuperação estiver disponível.
- Sem `courseId`: estado genérico informando que o retorno não identificou o Curso, com retorno ao catálogo.
- Acesso liberado: redirect existente preservado.

`Ver certificados` não deve ser uma ação principal durante a confirmação. O usuário ainda não tem garantia de acesso ou conclusão; manter esse link nessa primeira leitura desvia da tarefa.

Também é necessário impedir polling sobreposto e comunicar o fim das 30 tentativas. Hoje o intervalo pode continuar disparando enquanto uma requisição anterior ainda está em andamento, e o término não possui uma mensagem distinta.

## Market evidence

- Shopify trata a página pós-compra como uma página de status com agradecimento, detalhes da ordem e número de confirmação, não como uma repetição da página de produto. [Shopify — Order status page](https://help.shopify.com/en/manual/orders/status-tracking?locale=en)
- Stripe recomenda que a página de retorno mostre informações de confirmação, mas reforça que a confirmação real deve vir de notificações server-side/webhooks, não somente da página de sucesso. [Stripe — Fulfillment](https://docs.stripe.com/checkout/fulfillment)
- A Udemy diferencia pagamento iniciado de acesso efetivamente disponível e orienta verificar confirmação e estado do pagamento quando o Curso ainda não aparece. [Udemy — Curso não encontrado após compra](https://support.udemy.com/hc/en-us/articles/229231067-How-to-find-your-missing-course)
- A Nielsen Norman recomenda comunicar o estado continuamente e tornar esperas longas compreensíveis com etapas relativas, sem inventar percentual ou tempo exato. [NN/G — Visibility of System Status](https://www.nngroup.com/articles/visibility-system-status/) [NN/G — Designing for Long Waits](https://www.nngroup.com/articles/designing-for-waits-and-interruptions/)

## Reuse

- Reutilizar apenas a linguagem visual e, se necessário, uma versão compacta de `CourseOfferHero`/`CourseOfferSummary`; não reutilizar o resumo completo nem o shell do Dialog.
- `getStudentCourseAccessStatus` e `/api/enrollments/access` continuam como autoridade de liberação.
- O suporte pode usar `SupportRequestDialog` no timeout, sem criar uma nova rota genérica.

## Changes

1. `src/app/(student)/app/checkout/sucesso/page.tsx`
   - Change: centralizar a superfície e reorganizar o conteúdo para status + contexto mínimo do Curso; remover a ênfase de `Ver certificados` durante a espera.
   - Preserve: redirect server-side quando o acesso já estiver liberado e proteção de sessão/papel.
   - Verify: primeira leitura deixa claro o estado e a próxima ação sem repetir o resumo da compra.

2. `src/app/(student)/app/checkout/sucesso/checkout-access-waiter.tsx`
   - Change: modelar `waiting`, `checking`, `timeout` e `released`; impedir polling sobreposto e comunicar o encerramento das tentativas.
   - Preserve: intervalo, redirect, verificação manual e nenhuma nova compra.
   - Verify: erro de rede, resposta não-OK, acesso liberado, timeout e unmount não deixam timer ou mensagem ambígua.

3. Leitura segura de contexto mínimo
   - Change: se o título/miniatura forem exibidos, obtê-los server-side por `courseId` com autorização e sem retornar preço, currículo completo ou dados de Curso oculto sem relação válida.
   - Preserve: não confiar no `courseId` para expor conteúdo e não usar a página de sucesso como recibo financeiro sem snapshot do Pedido.
   - Verify: `courseId` inválido, Curso oculto e ausência de miniatura caem em fallback genérico.

4. Testes
   - Change: cobrir redirect imediato, espera, contexto mínimo, polling, timeout, erro de rede, ausência de `courseId`, Curso sem miniatura e recuperação manual.
   - Preserve: testes de handoff, webhook, acesso e checkout existentes.
   - Verify: `bun run check`, `bun run typecheck` e testes específicos de checkout/sucesso.

## Alternatives considered

- Repetir o resumo completo do modal e do handoff: rejeitado por carga cognitiva e redundância.
- Deixar apenas spinner e texto: rejeitado por falta de contexto e confiança.
- Mostrar “Pagamento aprovado” imediatamente: rejeitado porque a confirmação server-side ainda pode estar pendente.
- Mostrar preço atual do Curso como recibo: rejeitado sem snapshot confirmado do Pedido.

## Scope

- Inherit: retorno de compra paga com `courseId`.
- Verify: webhook atrasado, polling longo, erro de rede, Curso com/sem miniatura, Curso com/sem Certificado e `courseId` ausente.
- Exclude: modal de oferta, handoff `/comprar/[slug]`, checkout hospedado, webhook, Pedido, preço e página de sucesso financeira do provedor.

## Validation

- Product: o Aluno sabe que a compra retornou, que o acesso ainda está sendo confirmado e qual ação tomar sem rever o mesmo resumo.
- Interface: composição centralizada, status neutro, contexto compacto, timeout acionável e mobile sem repetição.
- System: polling sem sobreposição, redirect preservado, acesso server-side e nenhuma compra duplicada.
- Repository: `bun run check` → sem findings; `bun run typecheck` → sem erros; testes específicos → todos passam.

## Stop conditions

- Parar se o contexto mínimo exigir dados financeiros que não tenham snapshot confirmado do Pedido.
- Parar se o `courseId` não puder ser autorizado antes de retornar título ou miniatura.
- Parar se o novo contexto atrasar ou bloquear o redirect quando o acesso já estiver disponível.

## Design documentation

- Após implementação e validação: nenhuma alteração canônica é necessária, a menos que essa composição se torne o padrão oficial de confirmações pós-compra.
