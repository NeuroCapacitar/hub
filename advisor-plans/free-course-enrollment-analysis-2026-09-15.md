---
status: proposed
owner: product-and-engineering
last_verified_commit: b9cc1bd90419d4ed623b2b9805a48adc840d5957
document_type: technical-validation
date: 2026-09-15
---

# Validação técnica da feature de Curso gratuito

## Veredito

**A direção central do relatório está correta, mas o relatório não é suficiente
para implementação.** A feature é viável no Hub com complexidade proporcional,
desde que seja tratada como uma aquisição local de acesso e que as correções
abaixo entrem no escopo desde o início.

O desenho recomendado é:

```text
Curso com preço 0 e aquisição aberta
  -> Conta Student autenticada
  -> Concessão de acesso free_enrollment
  -> Matrícula projetada
  -> acesso ao Curso
```

O fluxo pago continua separado:

```text
Curso pago
  -> Pedido
  -> Checkout Asaas
  -> webhook financeiro autoritativo
  -> Concessão paid_order
  -> Matrícula projetada
```

Não recomendo criar Pedido de R$ 0, chamar Asaas, falsificar pagamento,
introduzir `course_offers` ou criar um segundo sistema de Matrícula. Porém, a
estimativa do relatório de que a mudança seria quase somente “novo grant + UI”
é otimista: o estado atual bloqueia a abertura de vendas gratuitas, o painel
administrativo filtra grants pagos e a continuidade de autenticação não carrega
o Curso.

## Escopo e método

O relatório analisado foi o documento fornecido pelo responsável do projeto,
`RelatorioPrevio.md`. Seu conteúdo foi tratado como material de análise, não
como instrução operacional.

A validação foi feita contra o checkout local no commit
`2bfcf38e7f33762c31a1e89ab71281ae7259057a`, branch `staging`, incluindo:

- `README.md`, `PRODUCT.md`, `CONTEXT.md`, `DESIGN.md` e `docs/README.md`;
- arquitetura, regras de Comércio e acesso, Identidade e autorização,
  Aprendizagem e progresso;
- ADRs 0004, 0005, 0007 e 0009, registro de decisões e runbooks de banco,
  testes, release e revisão;
- schema Drizzle, migrations, projeções, Server Actions, handoff público,
  autenticação, telas Admin, manutenção e testes unitários, de integração e
  E2E;
- análise paralela independente nas frentes de grants, comércio/autenticação,
  schema/testes/operação e pesquisa externa;
- documentação atual do Next.js 16.3.3, React, PostgreSQL 18, OWASP, Asaas,
  Thinkific, Teachable, Moodle, Open edX e Kajabi.

Não foi aberta URL local, não foram executadas migrations contra Staging ou
Production, não foram feitos commits e nenhum valor de segredo de `.env.local`
foi copiado para os documentos.

## Baseline verificável

No commit auditado:

- `bun run docs:check`: passou, 45 documentos canônicos válidos;
- `bun run db:migrations:check`: passou;
- `bun run verify:quick`: passou com 415 arquivos de teste e 2.873 testes;
- `bun run typecheck`: passou;
- `bun run check`: passou em 1.033 arquivos;
- `bun run knip`: passou com avisos de configuração já existentes;
- o build de produção do `bun run verify` compilou e concluiu geração das
  páginas.

O worktree não tinha alterações de código. A branch local `staging` estava 24
commits atrás de `origin/staging`, havia dois stashes existentes e os Pull
Requests abertos observados eram #218, #213, #212 e #211. Esses itens foram
preservados; o plano deve ser executado sobre um SHA explicitamente escolhido,
não sobre uma atualização implícita da branch.

## Matriz de validação do relatório

| Afirmação do relatório | Veredito | Evidência e correção necessária |
|---|---|---|
| Curso gratuito não deve ser um pagamento de R$ 0 | **Validada, com ressalva** | `enrollment_grants` é o ledger correto e o Checkout Asaas é financeiro e assíncrono. A documentação Asaas consultada não prova universalmente que todo valor zero é tecnicamente rejeitado; a justificativa correta é que não há necessidade de cobrança, confirmação, webhook ou conciliação. |
| `price_in_cents = 0` já existe no domínio | **Parcialmente validada** | `src/features/payments/course-price.ts` e `src/db/schema.ts` aceitam zero, mas `validateTarget` em `src/features/courses/availability-server.ts` rejeita qualquer preço abaixo do mínimo ao abrir vendas. |
| Grants e Matrículas podem ser reutilizados | **Validada** | `rebuildEnrollmentProjection` em `src/features/enrollments/server.ts` lê qualquer Concessão ativa e calcula a janela consolidada da Matrícula. |
| Um terceiro `source_type` é melhor que `manual` | **Validada** | `paid_order`, `manual` e `free_enrollment` expressam origens diferentes e mantêm auditoria sem contaminar o agregado financeiro. |
| Índice parcial por Conta + Curso resolve duplicidade | **Validada, mas não sozinho** | O índice parcial é a garantia final do banco; o serviço ainda precisa de lock, leitura do estado atual e no-op sem novo evento quando o acesso já está válido. |
| `lockEnrollmentAggregate` é suficiente para a transação | **Incompleta** | O helper adquire o lock de conteúdo do Curso e depois o advisory lock Conta/Curso. A nova operação também precisa ler `courses ... FOR UPDATE` depois desse lock para serializar mudança de preço, vendas e duração. |
| Server Action é apropriada | **Validada** | A action é uma mutação interna do app e segue o padrão atual. Next.js lembra que Server Actions são endpoints POST alcançáveis diretamente: autenticação, autorização e validação devem ocorrer na própria action. |
| Handoff `/comprar/[slug]` deve receber um estado gratuito | **Validada** | Reutiliza o link estável já aprovado e evita nova URL. O ramo gratuito deve ser resolvido antes de `PAYMENTS_CHECKOUT_MODE` e sem digest/polling financeiro. |
| Visitante deve voltar ao Curso depois do login | **Validada, com segurança obrigatória** | Hoje `/api/auth/redirect` sempre retorna `/app` ou `/admin`. `returnTo` deve aceitar somente `/comprar/<slug>` válido e ser validado de novo no Route Handler. |
| Expiração existente já funciona | **Validada** | `maintenance.ts` expira qualquer grant ativo, sem filtrar `paid_order`. Ajustes, bloqueio e restauração, porém, filtram grants pagos e precisam ser tratados. |
| Reativar o mesmo grant após expiração é a melhor política | **Recomendação, não fato atual** | O schema atual não define reentrada gratuita. A opção mais simples é uma linha por Conta/Curso, reativável somente após expiração e com evento que guarda a janela anterior e a nova; exige ratificação do produto. |
| Admin já consegue bloquear o acesso gratuito | **Refutada** | `getPaidAccessGrantsForEnrollment` é usado por bloqueio/restauração e filtra `source_type = 'paid_order'`. A UI promete bloquear a Matrícula de forma genérica. |
| Ajuste de validade pode permanecer pago | **Refutada como comportamento de superfície** | `EnrollmentExpirationControls` mostra “Ajustar validade” para toda Matrícula não revogada, mas o backend lança “Matrícula sem pagamento ajustável” para uma Matrícula gratuita. É preciso generalizar o serviço ou ocultar o controle por origem. |
| Controles de pagamento podem apenas desaparecer da UI | **Incompleta** | O formulário envia `paymentOfferPresent`; checkboxes desabilitados não entram no `FormData`, e o parser pode rejeitar a oferta com ambos os métodos falsos. O parser deve ler o preço antes da oferta e preservar/fallback para valores válidos. |
| `hasCommercialHistory` já cobre a nova origem | **Validada, com consequência** | `src/features/courses/availability-server.ts` e `src/features/admin/server.ts` consideram grants e Matrículas. Depois da primeira inscrição gratuita, o Curso não deve voltar a Rascunho/Em breve segundo a regra atual. |
| Finanças quase não mudam | **Validada** | Sem Pedido, o Curso não entra em receita, ticket, reembolso ou conversão financeira. A Matrícula ativa e as contagens de acesso continuam aumentando, como esperado. |

## Evidências do modelo atual

### Concessão e Matrícula

`src/db/schema.ts` define somente `paid_order` e `manual` em
`enrollmentGrantSourceTypeEnum`. A constraint
`enrollment_grants_source_shape_check` exige `order_id` para o primeiro e
`manual_reference` para o segundo.

`rebuildEnrollmentProjection`, em `src/features/enrollments/server.ts`,
adquire o lock compartilhado, exige uma Publicação de Curso publicada, expira
grants vencidos, consulta qualquer grant `active` cuja janela cubra o instante
atual e grava uma única Matrícula por Conta e Curso. Nenhuma parte dessa
projeção conhece Asaas.

Isso confirma a fronteira conceitual do relatório:

- Comércio decide e registra dinheiro quando existe compra;
- a Concessão de acesso registra a origem do direito;
- a Matrícula é a projeção efetiva que o restante do produto consulta.

### Preço e disponibilidade

`parseCoursePriceToCents` aceita exatamente zero ou valores pagos a partir de
1.000 centavos. A tabela `courses` repete essa regra em
`courses_price_in_cents_zero_or_minimum`.

O problema é o segundo gate. `validateTarget` em
`src/features/courses/availability-server.ts` atualmente impede o preset
`available` quando `price_in_cents < ASAAS_MINIMUM_CHECKOUT_VALUE_IN_CENTS`.
Assim, o fluxo oficial não consegue produzir o estado necessário para um
Curso gratuito (`active + listed + open + publication published`). A regra deve
ser dividida:

```text
price = 0       -> aquisição gratuita pode abrir
price >= 1000   -> checkout pago pode abrir
1 <= price < 1000 -> inválido
```

O teste de cronograma relativo ainda deve valer para os dois tipos de Curso.
Preço gratuito remove o requisito financeiro, não a necessidade de conteúdo
publicado e cronograma compatível com a duração de acesso.

### Handoff e link público

`src/features/payments/purchase-handoff.ts` chama
`resolveOpenCheckoutView`. Esse resolver rejeita preço `<= 0`, exige
`PAYMENTS_CHECKOUT_MODE` e constrói o snapshot/digest do Checkout.

`src/features/payments/course-purchase-link.ts` verifica o modo público antes
de verificar o preço e devolve `invalid_price` para zero. Os dois módulos devem
usar o mesmo conceito de aquisição aberta, mas manter os gates separados:

```text
Curso gratuito elegível -> link/handoff gratuito, sem configuração Asaas
Curso pago elegível      -> link/handoff Checkout, com modo e piso Asaas
```

A precedência segura é:

```text
Curso ausente/arquivado
  -> Conta de equipe
  -> Conta bloqueada
  -> Matrícula revogada
  -> acesso efetivo existente
  -> Em breve / vendas fechadas
  -> aquisição gratuita ou Checkout pago
```

O estado retornado pela leitura nunca é autorização. A action precisa repetir a
decisão com dados atuais.

### Concorrência e idempotência

`lockEnrollmentAggregate` chama `lockCourseContentRelease` e depois
`pg_advisory_xact_lock` com a chave Conta/Curso. As mutações de autoria usam o
mesmo lock de conteúdo antes de `SELECT ... FOR UPDATE` no Curso.

A nova operação deve seguir essa ordem. Depois de adquirir o lock, deve reler o
Curso com `FOR UPDATE`. Isso resolve a corrida em que a página exibiu “Grátis”,
mas o Admin alterou o preço ou fechou as vendas antes do clique.

O índice recomendado é:

```sql
CREATE UNIQUE INDEX enrollment_grants_free_user_course_unique_idx
ON enrollment_grants (user_id, course_id)
WHERE source_type = 'free_enrollment';
```

Ele deve cobrir também grants expirados e cancelados para que a V1 possa
reativar uma única linha histórica. Sob o lock, uma inscrição repetida que já
tem janela válida deve ser no-op: um grant e um evento de inscrição, não um
novo evento a cada double-click ou retry.

Há uma proteção adicional que o relatório não explicita: se a Conta já tem
acesso efetivo por grant pago, manual ou gratuito, a action não deve adicionar
um `free_enrollment` novo. Isso evita criar uma concessão gratuita que
permaneceria ativa depois de um reembolso do grant pago. A página já manda a
Conta ao Curso, mas essa é apenas uma leitura de UI e não pode ser a defesa.

### Bloqueio, restauração e validade no Admin

`EnrollmentExpirationControls` exibe ajuste, bloqueio e restauração para uma
Matrícula genérica. No backend:

- `getActivePaidGrantForEnrollment` alimenta extensão e definição de validade;
- `getPaidAccessGrantsForEnrollment` alimenta bloqueio e restauração;
- `applyPaymentRevocation` deve continuar filtrando exclusivamente
  `paid_order`, porque reembolso/disputa são eventos financeiros.

Recomendação para manter a UI e o domínio coerentes: renomear os dois helpers
de leitura para uma forma source-neutral e considerar `active`/`expired` de
`paid_order`, `free_enrollment` e `manual` em ajustes e bloqueio. A restauração
continua limitada a linhas `cancelled` com `revoked_reason =
'manual_access_block'`. Grants `refunded`/`disputed` não podem ser restaurados
por essa operação.

Se o produto decidir que uma concessão manual de fixture ou exceção não pode
ser bloqueada por essa ação, essa decisão precisa ser implementada como
controle de origem na projeção e na UI. Deixar a UI genérica e filtrar somente
pagamento é o estado mais perigoso, pois não cumpre a promessa de remover o
acesso quando existem grants mistos.

### Cadastro e retorno pós-autenticação

`SignInForm` e `SignUpForm` chamam `/api/auth/redirect`, que hoje devolve
somente `/app` para Student e `/admin` para Admin/Support. As páginas de
autenticação não leem query params.

O produto também mantém `AUTH_PUBLIC_SIGNUP_ENABLED=false` como padrão em
`src/lib/env.ts` e `.env.example`. Portanto, o fluxo “visitante cria conta”
exige uma pré-condição operacional explícita: habilitar o cadastro público no
ambiente destinado ao Curso gratuito. Não se deve alterar o default global ou
editar `.env.local` no change set.

O retorno deve ser limitado a um path interno desta feature:

```text
/comprar/<slug-canonico>
```

Rejeitar URL absoluta, `//host`, barra invertida, query/hash, caracteres de
controle, path com `..`, slug inválido e valor excessivamente grande. Validar
na página para compor links e novamente no Route Handler para impedir que um
POST manipulado altere o destino. Admin/Support continuam indo para `/admin`.

Não recomendo autoinscrição durante cadastro na primeira versão: isso exige
persistir intenção pendente, expirações, replays e mais casos de recuperação.
Voltar à página e clicar uma vez é simples, explícito e fácil de testar.

## Política de produto recomendada

Estas decisões não são provadas pelo código atual. Devem ser ratificadas antes
da execução do plano.

1. **Elegibilidade:** `price_in_cents = 0`, Curso `active`, Estado de vendas
   `open`, Publicação de Curso `published` e cronograma válido.
2. **Público:** somente uma Conta autenticada com papel `student`. Admin,
   Support, Conta bloqueada e Matrícula revogada não recebem o direito por essa
   action.
3. **Duração:** `access_duration_months` é a duração gratuita. O grant guarda
   a janela calculada no momento da inscrição; não há acesso vitalício nesta
   V1.
4. **Reentrada:** após expiração, um clique explícito pode reativar a mesma
   linha `free_enrollment` com nova janela e metadata anterior/nova. Uma linha
   cancelada por Bloqueio de matrícula ou terminada por política de acesso não
   pode ser reativada pelo Aluno.
5. **Acesso misto:** acesso efetivo existente produz no-op/encaminhamento e não
   cria grant gratuito adicional. Grants ativos continuam unidos pela projeção;
   nenhuma precedência financeira artificial é criada.
6. **Mudança de preço:** `0 -> pago` afeta novas aquisições; a janela gratuita
   já concedida continua até expirar. `pago -> 0` não apaga Pedido ou grant
   pago; novas aquisições podem ser gratuitas.
7. **Admin:** bloqueio, restauração e ajuste de validade devem continuar
   coerentes para todos os grants que sustentam uma Matrícula; reembolso/disputa
   permanecem operações exclusivas de `paid_order`.
8. **Cadastro público:** se visitantes puderem usar o Curso como lead magnet,
   `AUTH_PUBLIC_SIGNUP_ENABLED=true` deve ser aprovado e configurado no
   ambiente. Se o cadastro continuar fechado, o escopo público deve ser
   reduzido a Contas existentes e o CTA de cadastro não deve ser prometido.

## Decisões de arquitetura

### Fazer

- adicionar `free_enrollment` ao enum de origem;
- adicionar `free_enrollment_granted` ao enum de eventos;
- exigir `order_id IS NULL` e `manual_reference IS NULL` nessa origem;
- criar índice parcial único por Conta/Curso;
- reutilizar lock, projeção, expiração, Publicação e acesso já existentes;
- manter a URL `/comprar/[slug]` e separar aquisição gratuita de Checkout pago;
- registrar evento de inscrição sem PII, Order ou ID de provider;
- manter no Banco as colunas de pagamento válidas, mas ignoradas quando o preço
  é zero;
- atualizar todos os consumidores explícitos do evento: auditoria, labels e
  testes.

### Não fazer nesta V1

- `orders` para inscrição gratuita;
- import ou chamada de Asaas, Checkout, webhook, polling ou rate limit de
  Checkout;
- entidade `course_offers`, múltiplas ofertas, campanhas ou cupons de 100%;
- free trial, freemium, assinatura, vagas, convite, waitlist ou coorte;
- inscrição automática no cadastro;
- e-mail novo ou tópico de outbox sem requisito de produto;
- analytics específico de aquisição;
- renomear todo o módulo `payments` para `commerce`;
- acesso de visitante sem Conta/Matrícula efetivas.

## Pesquisa externa e comparação de soluções

O material completo está em
[`research/2026-09-15-free-course-external-research.md`](../research/2026-09-15-free-course-external-research.md).

As fontes mais decisivas foram:

- [Next.js: Mutating Data](https://nextjs.org/docs/app/getting-started/mutating-data)
  e [Server Actions and Mutations](https://nextjs.org/docs/app/guides/server-actions):
  Server Actions usam POST, suportam formulário/progressive enhancement e
  exigem autenticação/autorização dentro de cada função.
- [Next.js: `use server`](https://nextjs.org/docs/app/api-reference/directives/use-server):
  reforça tratar cada action como entrada pública não confiável.
- [React: `useActionState`](https://react.dev/reference/react/useActionState):
  permite devolver erro conhecido ao formulário, útil para a corrida de preço
  alterado entre render e clique.
- [Asaas Checkout](https://docs.asaas.com/docs/asaas-checkout): descreve uma
  página hospedada para concluir compra, com métodos, tipos de cobrança,
  callbacks e webhooks. A fonte não documenta uma modalidade de autoinscrição
  gratuita; não deve ser usada para afirmar que todo valor zero é impossível.
- [PostgreSQL `ALTER TYPE`](https://www.postgresql.org/docs/18/sql-altertype.html):
  um valor de enum adicionado dentro de uma transação só pode ser usado depois
  do commit. Isso exige migrations separadas para enum e constraint/index.
- [PostgreSQL constraints](https://www.postgresql.org/docs/18/ddl-constraints.html):
  uma unicidade que cobre somente parte das linhas é implementada por índice
  parcial único.
- [OWASP: Unvalidated Redirects and Forwards](https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html):
  recomenda allowlist e, quando possível, mapear um identificador curto para o
  destino no servidor.
- [Thinkific: free product](https://support.thinkific.com/hc/en-us/articles/360062349633-How-do-students-enroll-in-my-free-product)
  e [Teachable: price your products](https://support.teachable.com/en/articles/15627279-price-your-products):
  confirmam conta, CTA explícito e acesso gratuito sem tratar o fluxo como
  cobrança financeira.
- [Moodle: self enrolment](https://docs.moodle.org/405/en/admin/setting/enrolsettingsself),
  [Open edX: auto-enrollment](https://docs.openedx.org/en/latest/site_ops/install_configure_run_guide/configuration/tpa/tpa_advanced_features.html)
  e [Kajabi: Grant an Offer](https://help.kajabi.com/articles/sales/offers/how-to-grant-an-offer):
  separam autenticação, autoinscrição/concessão, publicação e acesso.

Players comerciais usam `Offer`, múltiplos planos e cupons para necessidades
que o Hub ainda não possui. Isso não é razão para importar o modelo inteiro.
Para a necessidade atual, `price_in_cents = 0` mais uma origem explícita de
Concessão é menor e suficiente.

Fóruns e debates foram consultados apenas como sinal de problemas recorrentes,
não como autoridade: discussões de Stack Overflow sobre unicidade de
Conta/Curso e login seguido de self-enrolment reforçam a necessidade de uma
garantia no Banco e de um retorno contextual, mas são antigas, específicas e
não alteram o contrato do Hub.

## Conclusão operacional

O relatório deve ser **aceito como direção arquitetural** e **corrigido antes de
ser entregue a um estagiário**. O esforço real é L, não S: inclui duas
migrations sequenciais, serviço transacional, action, CTA/erros, handoff/link,
abertura de vendas, autenticação contextual, contratos administrativos,
auditoria, integração PostgreSQL, E2E e documentação.

O plano associado transforma essas conclusões em etapas verificáveis e contém
STOP conditions para as duas decisões ainda dependentes do produto: reentrada
após expiração e habilitação do cadastro público.
