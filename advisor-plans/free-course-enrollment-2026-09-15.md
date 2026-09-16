---
status: in-progress
owner: product-and-engineering
last_verified_commit: 2bfcf38e
document_type: implementation-plan
date: 2026-09-15
---

# Plano de implementação: autoinscrição gratuita em Cursos

> **Instruções para quem executar:** este documento é um plano, não uma
> autorização automática para alterar o produto. Siga as etapas na ordem, rode
> cada verificação e só avance quando o resultado esperado for obtido. Leia o
> documento inteiro antes de editar qualquer arquivo.
>
> O plano foi escrito contra o commit
> 2bfcf38e7f33762c31a1e89ab71281ae7259057a, branch local staging. Se o
> código divergir das evidências abaixo, pare na condição de STOP e reporte o
> drift. Não improvise uma nova arquitetura, não crie uma compra de R$ 0 e não
> altere os valores de .env.local.

## Verificação de drift

Execute antes de qualquer alteração:

~~~powershell
git rev-parse HEAD
git status --short --branch
git diff --stat 2bfcf38e7f33762c31a1e89ab71281ae7259057a..HEAD -- src/db src/features/enrollments src/features/payments src/features/courses src/features/admin src/app tests scripts
~~~

Resultado esperado no início do trabalho:

- HEAD é o SHA planejado ou um SHA explicitamente aprovado pelo operador;
- nenhuma alteração de código fora do escopo aparece;
- os arquivos de planejamento em advisor-plans/ e a pesquisa em research/
  permanecem preservados;
- .env.local não aparece no status.

Se houver alteração em qualquer arquivo listado no escopo desde o SHA
planejado, reabra a seção **Current state** deste plano, compare símbolos e
queries com o código vivo e pare se uma decisão, lock, enum ou retorno tiver
mudado.

## Status

- **Prioridade:** P1
- **Esforço:** L, multi-dia, incluindo migrations, autenticação, Admin, testes
  PostgreSQL e E2E
- **Risco:** MED/HIGH; a feature não toca dinheiro, mas altera autorização e
  projeção de acesso
- **Depende de:** ratificação da política de reentrada após expiração e
  autorização para cadastro público de visitantes
- **Categoria:** correctness, security, migration, tests, docs
- **Planejado em:** commit 2bfcf38e, 2026-09-15
- **Issue:** não publicada

### Acompanhamento da execução

- [x] Etapa 0 — preparação, drift e gates de produto
- [x] Etapa 1 — enums e migrations forward-only
- [x] Etapa 2 — eventos e mutações administrativas source-neutral
- [x] Etapa 3 — serviço transacional de autoinscrição
- [x] Etapa 4 — Server Action e CTA
- [x] Etapa 5 — retorno seguro de autenticação
- [x] Etapa 6 — handoff e página pública
- [x] Etapa 7 — disponibilidade e link público
- [x] Etapa 8 — formulário de preço e apresentação Admin
- [x] Etapa 9 — Auditoria e read models
- [x] Etapa 10 — integração PostgreSQL e concorrência
- [x] Etapa 11 — jornada E2E
- [ ] Etapa 12 — documentação canônica
- [ ] Etapa 13 — gates finais e release handoff

> Etapa 10 concluída em branch Neon temporária do projeto de CI: migrations
> E2E aplicadas, suíte PostgreSQL executada com 12/12 testes e cleanup
> confirmado por consulta posterior (0 fixtures restantes). A branch não era
> `production`/`staging` e possui expiração automática.
>
> Etapa 11 concluída em branches Neon temporárias e descartáveis: a fixture
> agora contém Curso gratuito publicado com conteúdo mínimo; as jornadas
> pública e Student autenticada passaram sem POST de Checkout, sem mutação no
> fake Asaas e com uma Concessão, uma Matrícula, um evento e zero Orders
> confirmados no PostgreSQL. O projeto desktop passou 40/40 casos além do
> reembolso validado isoladamente (1/1), e o mobile passou 9/9 além do mesmo
> reembolso (1/1). A execução combinada inicial foi interrompida pelo launcher
> `bun.cmd`/Windows; a validação equivalente por projeto passou após o runner
> usar `process.execPath`. As branches têm expiração automática e não são
> `production`/`staging`.
>
> Etapa 12 em progresso: o glossário, Produto, guias de domínio, arquitetura,
> registro de decisões, índice canônico e ADR-0013 foram atualizados. O produto
> ratificou o cadastro público como ponte e a reentrada após expiração em
> 2026-09-16, e o ADR está `accepted`. Os metadados
> `last_verified_commit` dos documentos canônicos também permanecem nos commits
> existentes até haver um commit que contenha esta implementação; não será usado
> o SHA do plano como prova.

## Objetivo

Permitir que uma Conta com papel student se inscreva em um Curso cujo preço
seja zero, esteja ativo, com vendas abertas e Publicação de Curso publicada.
Essa operação deve criar uma Concessão de acesso free_enrollment, recompor a
Matrícula e encaminhar o Aluno ao Curso.

O fluxo pago deve continuar inalterado:

~~~text
price = 0
  -> action autenticada local
  -> enrollment_grant.free_enrollment
  -> rebuildEnrollmentProjection
  -> enrollment

price >= 1000 centavos
  -> Pedido
  -> Checkout Asaas
  -> webhook autoritativo
  -> enrollment_grant.paid_order
  -> rebuildEnrollmentProjection
  -> enrollment
~~~

## Por que isso importa

O Hub já possui a separação correta entre Concessão de acesso e Matrícula, mas
o estado atual ainda não permite abrir vendas de um Curso gratuito, não
mostra o novo evento na Auditoria e não bloqueia/ajusta corretamente uma
Matrícula sustentada por grant não pago. Sem as correções, o botão poderia
parecer funcional enquanto o Admin não consegue publicar a oferta, o bloqueio
de matrícula deixaria acesso residual e uma chamada direta poderia explorar um
estado antigo exibido pela página.

O plano mantém a mudança pequena: uma origem de grant, uma action, um CTA, dois
gates de aquisição e os consumidores obrigatórios. Não introduz um agregado de
oferta, um endpoint REST público ou um fluxo financeiro artificial.

## Decisões obrigatórias antes de começar

O executor não deve escolher silenciosamente uma política que altera direitos
de acesso. O responsável pelo produto precisa ratificar as decisões abaixo.
As opções recomendadas são as que tornam o plano executável e preservam
histórico.

### 1. O que é um Curso gratuito

Recomendação: um Curso é gratuito quando courses.price_in_cents = 0. Ele só
aceita autoinscrição quando todos os estados forem verdadeiros:

~~~text
status = active
sales_status = open
catalog_visibility = listed
existe course_publications.status = published
price_in_cents = 0
cronograma de módulos cabe em access_duration_months
~~~

Preço entre 1 e 999 centavos continua inválido. Preço igual ou superior a
1.000 centavos continua sendo pago e segue Asaas.

### 2. Duração e reentrada

Recomendação: usar access_duration_months como duração da inscrição gratuita.
O início é o instante da transação e base_expires_at/effective_expires_at
recebem a janela calculada.

Depois de expirar, um novo clique explícito pode reativar a mesma linha
free_enrollment, substituindo sua janela e registrando no evento a janela
anterior e a nova. Isso mantém uma identidade única por Conta + Curso e evita
uma coleção ilimitada de grants.

Não reativar automaticamente, não reativar uma linha cancelada por Bloqueio de
matrícula e não reativar uma linha terminada por política de acesso. Se o
produto quiser acesso vitalício, novos episódios, limite de reentradas ou
reentrada após revogação, pare: isso é outro contrato.

### 3. Acesso já existente

Recomendação: sob o lock, se houver qualquer Concessão de acesso efetiva
(paid_order, manual ou free_enrollment), não criar outra Concessão
gratuita. Retornar sucesso idempotente para uma repetição do mesmo acesso ou
encaminhar para o Curso na camada de UI.

Isso é necessário mesmo que o handoff já retorne kind: access. O handoff é
uma leitura; uma chamada direta da Server Action não passa por ele. Criar um
grant gratuito ao lado de um grant pago faria o acesso sobreviver a um
reembolso do pagamento.

### 4. Bloqueio e validade administrativos

Recomendação: as operações genéricas de Matrícula devem considerar grants
active/expired de todas as origens atuais (paid_order, free_enrollment e
manual). O bloqueio cancela os grants elegíveis com razão
manual_access_block; a restauração reativa somente grants cancelados por
essa razão, sem tocar refunded ou disputed.

A UI já mostra Ajustar validade, Bloquear acesso e Restaurar acesso para
uma Matrícula sem distinguir origem. Se o produto quiser excluir manual, o
executor deve parar e alterar a UI/read model para expressar essa exceção; não
deve deixar uma UI genérica com um filtro oculto que falha em runtime.

### 5. Cadastro público

Recomendação: para o fluxo visitante -> cadastro -> Curso, habilitar
explicitamente AUTH_PUBLIC_SIGNUP_ENABLED=true no ambiente aprovado. O
default atual continua false; não o altere globalmente e não edite
.env.local.

Se o produto não autorizar cadastro público, o escopo precisa ser reduzido a
Contas Student existentes, e o CTA Criar conta para se inscrever não pode
ser entregue como se funcionasse.

### 6. Autenticação não inscreve automaticamente

Recomendação: login/cadastro apenas retorna a pessoa para
/comprar/<slug>. O Aluno clica uma segunda vez em Inscrever-se grátis. Não
persistir uma intenção de aquisição na primeira versão.

## Current state

### Banco e schema

src/db/schema.ts:71-92 define:

~~~ts
export const enrollmentGrantSourceTypeEnum = pgEnum(
  "enrollment_grant_source_type",
  ["paid_order", "manual"]
);

export const enrollmentEventTypeEnum = pgEnum("enrollment_event_type", [
  "access_manual_block_removed",
  "access_manually_blocked",
  "manual_access_granted",
  "payment_paid",
  "payment_refunded",
  "payment_disputed",
  "expiration_extended",
  "expiration_set",
  "expiration_adjustment_reversed",
  "projection_rebuilt",
  "content_release_scheduled",
  "content_full_access_granted",
]);
~~~

src/db/schema.ts:732-776 possui enrollment_grants com order_id,
manual_reference, status e as janelas de acesso. A constraint atual aceita
somente estas formas:

~~~text
paid_order -> order_id não nulo, manual_reference nulo
manual     -> order_id nulo, manual_reference não nulo
~~~

src/db/schema.ts:354-410 já aceita zero em courses.price_in_cents, mas
mantém a exigência de pelo menos um método de pagamento. Essa exigência pode
continuar para valores armazenados de Cursos gratuitos; os campos são
ignorados pelo ramo gratuito.

O histórico termina em 0079_protect_lesson_module_publication_ownership, com
80 entradas no journal. O runbook exige migrations geradas pelo Drizzle,
forward-only e replay em PostgreSQL descartável.

**Sutileza de migration:** PostgreSQL documenta que um valor de enum adicionado
dentro de uma transação só pode ser usado depois do commit. Como a migration
do enum roda em transação e a constraint/index precisará mencionar
free_enrollment, gerar duas migrations sequenciais:

~~~text
0080 -> adiciona os dois valores aos enums; não usa os valores em constraint/index
0081 -> atualiza constraint e cria o índice parcial; roda após o commit de 0080
~~~

Não editar migrations históricas, journal ou snapshots manualmente.

### Projeção de acesso

src/features/enrollments/enrollment-aggregate-lock.ts:5-14 adquire:

1. lock advisory do conteúdo do Curso;
2. lock advisory da chave Conta + Curso.

rebuildEnrollmentProjection, em src/features/enrollments/server.ts:209-447,
relê a Publicação publicada, expira grants ativos vencidos, agrega qualquer
grant ativo e atualiza uma única Matrícula. A rotina de manutenção em
src/features/enrollments/maintenance.ts:82-99 expira qualquer grant ativo,
sem filtrar paid_order.

Os criadores atuais estão em src/features/enrollments/server.ts:449-592:
applyPaidWebhookAccess e createManualAccessGrant. O novo criador deve
seguir o mesmo boundary transacional e chamar a projeção antes do commit.

### Bloqueio e ajustes administrativos

src/features/enrollments/server.ts:643-677 procura um grant pago para ajuste
de validade. src/features/enrollments/server.ts:730-758 procura grants pagos
para bloqueio/restauração; as mutações em :969-1115 dependem desses helpers.

src/features/admin/enrollment-expiration-controls.tsx:55-72 exibe os
controles para toda Matrícula ativa/expirada. O contrato visível da UI é
source-neutral, portanto manter o filtro pago produz uma falha concreta para
uma nova Matrícula gratuita.

applyPaymentRevocation, em server.ts:598-639, deve continuar filtrando
source_type = 'paid_order': reembolso e disputa são efeitos financeiros e
não devem ser aplicados a grant gratuito.

### Handoff público e página

src/features/payments/purchase-handoff.ts:13-153 define os estados do
handoff. resolveOpenCheckoutView exige Curso ativo, vendas abertas,
publicação publicada, preço positivo, PAYMENTS_CHECKOUT_MODE e cronograma
compatível.

src/features/payments/purchase-handoff.ts:177-246 aplica a precedência de
Conta de equipe, bloqueio de plataforma, Matrícula revogada e acesso efetivo
antes de resolver a aquisição.

src/features/payments/course-purchase-link.ts:24-62 exige modo public e
preço mínimo antes de produzir /comprar/<slug>.

src/app/comprar/[slug]/page.tsx:165-204 renderiza somente checkout, acesso,
bloqueio, vendas fechadas, Em breve, redirect externo ou indisponibilidade.
PurchaseHandoffClient é específico de Checkout: cria UUID, faz POST,
persiste tentativa e faz polling. Não o reutilizar para a inscrição gratuita.

### Autenticação

src/app/(auth)/entrar/sign-in-form.tsx:18-85 e
src/app/(auth)/cadastro/sign-up-form.tsx:21-87 chamam
/api/auth/redirect sem contexto. src/app/api/auth/redirect/route.ts:5-32
retorna /app para Student e /admin para Admin/Support.

src/lib/env.ts:36-39 define AUTH_PUBLIC_SIGNUP_ENABLED com default false.
src/app/api/auth/[...all]/route.ts:28-43 bloqueia o POST de cadastro quando
a variável está desligada.

### Administração e auditoria

src/features/admin/server.ts:2761-2779 e :2899-2915 possuem listas
explícitas de eventos de Matrícula. src/features/admin/audit-presentation.ts:29-45
possui labels fixos. Um evento novo precisa entrar nos dois SQLs, no label e
nos testes; alterar somente o enum não o tornará visível no painel.

hasCommercialHistory, em src/features/courses/availability-server.ts:68-112
e src/features/admin/server.ts:1249-1257, considera orders,
enrollment_grants e enrollments. Não alterar essa regra: uma primeira
inscrição gratuita passa a contar como histórico do Curso e impede retorno a
Rascunho/Em breve conforme a decisão atual.

### Administração do preço e disponibilidade

src/features/admin/authoring.ts:359-390 parseia a oferta de pagamento antes
de persistir preço; src/app/(admin)/admin/cursos/[courseId]/course-dialogs-client.tsx:274-369
renderiza Pix, cartão e parcelamento mesmo quando o preço é zero.

src/features/courses/availability-server.ts:201-249 rejeita o preset
available se o preço estiver abaixo do mínimo Asaas. Esse gate precisa aceitar
zero e continuar rejeitando preços positivos submínimos.

### Baseline

Executado contra o SHA planejado:

~~~text
bun run docs:check          -> Documentação válida: 45 documentos canônicos.
bun run db:migrations:check -> Migrations validas.
bun run verify:quick        -> exit 0; 415 arquivos, 2873 testes.
bun run typecheck           -> exit 0.
bun run check               -> exit 0; 1033 arquivos verificados.
bun run knip                -> exit 0; somente 17 configuration hints.
bun run verify              -> docs, migrations, typecheck, check, testes,
                               build e knip concluídos sem erro fatal.
~~~

## Commands you will need

| Objetivo | Comando | Resultado esperado |
|---|---|---|
| Contrato rápido | bun run verify:quick | exit 0; migrations, typecheck, check e testes passam |
| Migrations | bun run db:migrations:check | Migrations validas. |
| Documentação | bun run docs:check | documentos canônicos válidos |
| Teste focal | bun run test -- <arquivos> | todos os testes selecionados passam |
| Integração PostgreSQL | bun run test:certificates:integration ou o comando de integração definido pelo CI | banco descartável, sem URL Neon |
| Migration descartável E2E | bun run db:migrate:e2e | cadeia completa aplicada no banco E2E |
| E2E | bun run test:e2e | jornadas desktop/mobile passam |
| Tipos | bun run typecheck | exit 0, sem erro TypeScript |
| Lint/check | bun run check | exit 0, nenhum problema Ultracite |
| Full gate | bun run verify | docs, migrations, typecheck, check, testes, build e knip passam |
| Auditoria de dependências | bun audit --production | sem advisory crítico/alto alcançável |

Use bun run test, não bun test. Os testes unitários usam tests/setup.ts.
Integração e E2E exigem PostgreSQL descartável e os guardas existentes; nunca
apontar esses comandos para Development, Staging ou Production.

## Referências que o executor deve consultar

Leia antes das etapas correspondentes:

- docs/README.md;
- docs/domain/identity-and-authorization.md;
- docs/domain/commerce-and-access.md;
- docs/domain/learning-content-and-progress.md;
- docs/architecture.md;
- docs/adr/0004-access-grants-and-enrollment-projection.md;
- docs/adr/0007-course-versioning-and-enrollment-curriculum.md;
- docs/adr/0009-course-availability-and-sale-interest.md;
- docs/operations/database-and-migrations.md;
- docs/operations/testing-and-ci.md;
- docs/operations/code-review-with-coderabbit.md;
- research/2026-09-15-free-course-external-research.md;
- documentação local do Next.js em
  node_modules/next/dist/docs/01-app/02-guides/server-actions.md,
  forms.md, data-security.md e redirecting.md.

Fontes externas decisivas:

- [Next.js Mutating Data](https://nextjs.org/docs/app/getting-started/mutating-data);
- [Next.js Server Actions and Mutations](https://nextjs.org/docs/app/guides/server-actions);
- [React useActionState](https://react.dev/reference/react/useActionState);
- [Asaas Checkout](https://docs.asaas.com/docs/asaas-checkout);
- [PostgreSQL ALTER TYPE](https://www.postgresql.org/docs/18/sql-altertype.html);
- [PostgreSQL constraints](https://www.postgresql.org/docs/18/ddl-constraints.html);
- [OWASP redirects](https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html);
- [Thinkific free product](https://support.thinkific.com/hc/en-us/articles/360062349633-How-do-students-enroll-in-my-free-product);
- [Teachable free pricing](https://support.teachable.com/en/articles/15627279-price-your-products);
- [Moodle self enrolment](https://docs.moodle.org/405/en/admin/setting/enrolsettingsself);
- [Open edX auto-enrollment](https://docs.openedx.org/en/latest/site_ops/install_configure_run_guide/configuration/tpa/tpa_advanced_features.html);
- [Kajabi Grant an Offer](https://help.kajabi.com/articles/sales/offers/how-to-grant-an-offer).

## Scope

### Arquivos que podem mudar

Schema e migration:

- src/db/schema.ts;
- src/db/migrations/0080_free_enrollment_enums.sql e
  src/db/migrations/0081_free_enrollment_contract.sql, ou os nomes gerados
  pelo Drizzle com esses números e intenção;
- snapshots e _journal.json gerados automaticamente;
- src/db/asaas-schema-contract.test.ts;
- novo src/db/free-enrollment-migration.test.ts.

Domínio e actions:

- novo src/features/enrollments/free-enrollment.ts;
- src/features/enrollments/server.ts apenas para exportar o writer de evento,
  atualizar o union de eventos e tornar as leituras administrativas
  source-neutral;
- src/features/enrollments/server-sql.test.ts e
  src/features/enrollments/server-revocation.test.ts;
- novo src/features/enrollments/free-enrollment.test.ts;
- novo src/features/enrollments/free-enrollment.integration.test.ts;
- src/app/(student)/app/actions.ts e actions.test.ts;
- novo src/app/comprar/[slug]/free-enrollment-button.tsx e teste.

Handoff, disponibilidade e Admin:

- src/features/payments/purchase-handoff.ts e teste;
- src/app/comprar/[slug]/page.tsx e teste;
- src/features/payments/course-purchase-link.ts e teste;
- src/features/courses/availability-server.ts e teste;
- src/app/(admin)/admin/cursos/[courseId]/course-purchase-link.tsx e teste;
- src/app/(admin)/admin/cursos/[courseId]/course-dialogs-client.tsx e teste;
- src/features/admin/presentation.test.ts somente para regressão de estado
  ready de um Curso gratuito;
- src/features/admin/server.ts;
- src/features/admin/audit-presentation.ts;
- src/features/admin/audit-enrollment-events.test.ts;
- testes de src/features/admin/enrollment-* que enumeram a origem.

Autenticação e E2E:

- novo src/lib/auth-return-to.ts;
- src/app/api/auth/redirect/route.ts e teste;
- src/app/(auth)/entrar/page.tsx, sign-in-form.tsx e testes;
- src/app/(auth)/cadastro/page.tsx, sign-up-form.tsx e testes;
- scripts/seed-e2e.ts;
- tests/e2e/critical-journeys.spec.ts;
- tests/e2e/payment-helpers.ts apenas para a leitura segura do resultado
  gratuito, se necessário.

Documentação canônica da implementação autorizada:

- CONTEXT.md;
- PRODUCT.md;
- docs/domain/identity-and-authorization.md;
- docs/domain/commerce-and-access.md;
- docs/architecture.md;
- novo docs/adr/0013-free-course-self-enrollment.md;
- docs/decisions.md;
- docs/README.md;
- docs/operations/database-and-migrations.md.

### Arquivos e comportamentos explicitamente fora do escopo

- qualquer migration histórica anterior a 0080;
- main e staging diretamente, reset, rebase ou force-push;
- .env.local, .env, segredos de CI, Vercel, Neon, Asaas, R2, Resend ou
  JMVStream;
- src/features/payments/checkout.ts, public-checkout.ts, adapter Asaas,
  inbox/webhook, processor financeiro, refund, conciliação e regras de
  precedência financeira, exceto testes que provem ausência de regressão;
- criação de qualquer linha em orders para um Curso gratuito;
- qualquer chamada a Asaas ou import de adapter/provider pelo serviço gratuito;
- course_offers, múltiplos planos, cupons, trials, freemium, assinaturas,
  vagas, convites, waitlist, coortes, matrícula vitalícia ou autoinscrição no
  cadastro;
- novo tópico de outbox, e-mail ou analytics de aquisição;
- alteração das regras de publicação, sequência de Aulas, Certificados ou
  learning analytics, além de verificar que o acesso gratuito usa as mesmas
  projeções existentes;
- abrir URL local ou usar inspeção visual como critério de validação;
- instalar dependências, chamar providers reais, executar migrations em
  ambientes persistentes, fazer commit, push ou abrir Pull Request sem ordem
  explícita do operador.

## Contrato técnico invariável

Ao final, todas as afirmações abaixo devem ser demonstráveis por código e
testes:

1. free_enrollment é uma origem do enum, não um status de matrícula.
2. Uma linha gratuita sempre tem order_id IS NULL e
   manual_reference IS NULL.
3. Há no máximo uma linha gratuita por (user_id, course_id), inclusive após
   expiração ou bloqueio.
4. A inscrição gratuita nunca insere em orders.
5. A inscrição gratuita não importa, instancia ou chama Asaas.
6. A action deriva userId da sessão, nunca do formulário.
7. O serviço relê preço, status, vendas, duração e publicação depois de obter
   os locks e usa o Curso do banco, não o estado renderizado.
8. Preço zero é permitido no preset available; preço positivo submínimo não
   é permitido.
9. PAYMENTS_CHECKOUT_MODE pode esconder o Checkout pago, mas não esconde o
   link/handoff de um Curso gratuito elegível.
10. Conta de equipe, Conta bloqueada e Matrícula revogada não recebem grant
    gratuito.
11. Acesso efetivo existente não gera novo grant gratuito.
12. Repetição com grant gratuito ativo não duplica grant nem evento de
    free_enrollment_granted.
13. Reentrada após expiração, se ratificada, reusa a linha e registra janela
    anterior/nova sem apagar histórico de evento.
14. Bloqueio administrativo remove todos os grants de acesso elegíveis que
    sustentam a Matrícula; restauração não reativa grants financeiros
    terminados por reembolso/disputa.
15. Eventos gratuitos aparecem no feed e nos labels da Auditoria.
16. Mudança 0 -> pago não revoga grants gratuitos já concedidos; mudança
    pago -> 0 não altera Orders/grants pagos existentes.
17. A manutenção existente expira grants gratuitos normalmente.
18. O cadastro público continua desabilitado por default e só o ambiente
    explicitamente aprovado o habilita.

## Etapas

### Etapa 0: preparar o trabalho e confirmar os gates

1. Execute a verificação de drift e o inventário de higiene acima.
2. Crie uma branch de trabalho com o padrão do repositório, por exemplo
   codex/free-course-enrollment, somente se o operador tiver autorizado a
   implementação. Não altere a branch staging.
3. Confirme com o responsável do produto as oito decisões da seção anterior.
4. Confirme no ambiente alvo, sem imprimir valores, se
   AUTH_PUBLIC_SIGNUP_ENABLED será true para permitir o fluxo de visitante.
5. Leia novamente docs/operations/release-flow.md e
   docs/operations/database-and-migrations.md antes de qualquer migration.

**Verifique:**

~~~powershell
git status --short --branch
git worktree list
git stash list
~~~

**Esperado:** branch de trabalho isolada quando autorizada, nenhum worktree
extra sendo usado pelo executor, stashes existentes preservados e nenhum
arquivo de ambiente no status. Se a autorização para cadastro público ou
reentrada não existir, pare antes da Etapa 1.

### Etapa 1: adicionar os valores dos enums em migration separada

1. Em src/db/schema.ts, adicione free_enrollment ao final de
   enrollmentGrantSourceTypeEnum.
2. Adicione free_enrollment_granted ao final de
   enrollmentEventTypeEnum.
3. Gere somente a primeira migration:

   ~~~powershell
   bun run db:generate -- --name free-enrollment-enums
   ~~~

4. Confirme que a migration recebeu o número 0080 e contém somente os
   ALTER TYPE ... ADD VALUE necessários, sem constraint ou índice que use os
   valores novos.
5. Agora adicione no schema a terceira alternativa da constraint:

   ~~~text
   source_type = free_enrollment
   order_id IS NULL
   manual_reference IS NULL
   ~~~

6. Adicione no schema o índice parcial único
   enrollment_grants_free_user_course_unique_idx em user_id, course_id
   com predicado source_type = 'free_enrollment'.
7. Gere a segunda migration:

   ~~~powershell
   bun run db:generate -- --name free-enrollment-contract
   ~~~

8. Confirme que a migration recebeu 0081 e que a constraint/index não foram
   colocados na 0080.
9. Não altere snapshots antigos. O snapshot e o journal novos devem ser os
   artefatos produzidos pelo comando de geração.

**Verifique:**

~~~powershell
bun run db:migrations:check
bun run test -- src/db/asaas-schema-contract.test.ts src/db/free-enrollment-migration.test.ts
~~~

**Esperado:** Migrations validas. e todos os testes passarem. O teste novo de
migration deve comprovar que 0080 não menciona constraint/index com o enum
novo e que 0081 contém a constraint de três alternativas e o índice parcial.
Se o Drizzle gerar uma única migration ou tentar recriar o enum, pare.

### Etapa 2: atualizar o contrato de eventos e tornar as mutações administrativas source-neutral

1. Em src/features/enrollments/server.ts, inclua
   free_enrollment_granted no union EnrollmentEventInput.eventType.
2. Exporte apenas o writer de evento existente, ou extraia-o para um módulo
   interno compartilhado, para que o novo serviço não duplique SQL. Não crie
   um segundo formato de evento.
3. Renomeie getActivePaidGrantForEnrollment para uma intenção
   source-neutral, por exemplo getActiveGrantForEnrollment. Mantenha o filtro
   de status active/expired, remova somente o filtro de origem e mantenha a
   ordenação atual.
4. Renomeie getPaidAccessGrantsForEnrollment para, por exemplo,
   getAccessGrantsForEnrollment. Faça a mesma alteração para bloqueio e
   restauração.
5. Faça extendEnrollmentExpiration e setEnrollmentExpiration operarem no
   grant de acesso escolhido pela regra já existente, independentemente de ser
   pago, gratuito ou manual.
6. Faça blockEnrollmentAccess buscar todos os grants active/expired do
   Aluno no Curso e cancelar os elegíveis em uma única transação. Preserve:
   manual_access_block, actor, motivo, eventos e rebuildEnrollmentProjection.
7. Faça restoreEnrollmentAccess considerar somente grants cancelled cujo
   motivo seja exatamente manual_access_block; preserve a decisão de voltar
   para active ou expired conforme a data.
8. Não altere applyPaymentRevocation: ele deve continuar filtrando
   paid_order e order_id.
9. Atualize server-sql.test.ts para verificar o novo nome, a ordem de lock e
   a ausência do filtro pago nas operações administrativas. Mantenha um teste
   explícito de que a revogação financeira continua paga-only.

**Verifique:**

~~~powershell
bun run test -- src/features/enrollments/server-sql.test.ts src/features/enrollments/server-revocation.test.ts src/features/admin/enrollment-actions.test.ts
~~~

**Esperado:** todos passam; nenhuma query financeira muda. Se a regra de
manual não tiver sido ratificada para bloqueio/validade, pare em vez de
escolher uma exceção silenciosa.

### Etapa 3: criar o serviço transacional de autoinscrição

Crie src/features/enrollments/free-enrollment.ts com import "server-only".
Esse arquivo não pode importar src/features/payments, Asaas, gateway,
orders ou public-checkout. Ele pode importar o lock compartilhado, as regras
de datas, rebuildEnrollmentProjection e o writer de evento do domínio de
Matrículas.

Use uma função pública como:

~~~ts
enrollInFreeCourse({
  courseId,
  userId,
  now?,
})
~~~

O retorno deve ser pequeno e tipado, por exemplo created, reactivated ou
already_active, sem devolver row bruto, PII, Order ou provider ID.

Implemente a transação nesta ordem:

1. Valide o formato do courseId no boundary do serviço. Aceite uma Conta
   userId recebida somente da action; a action não deve aceitar userId do
   formulário.
2. Faça pool.connect(), BEGIN e try/catch/finally com ROLLBACK e
   release em qualquer erro.
3. Chame lockEnrollmentAggregate(client, userId, courseId). Isso mantém a
   ordem course-content-release antes de user:course.
4. Depois do lock, leia a linha de courses com FOR UPDATE, incluindo:
   status, sales_status, price_in_cents, access_duration_months e
   existência de course_publications.status = 'published'.
5. Leia o maior atraso de Módulo publicado, ou a mesma projeção já usada pelo
   domínio, e preserve a validação de que o cronograma cabe na duração de
   acesso. Se faltar Publicação ou o cronograma for inválido, rejeite com erro
   seguro.
6. Rejeite com mensagens de domínio seguras, sem SQL bruto:

   ~~~text
   Curso inexistente, arquivado, draft ou inativo
   Estado de vendas fechado
   Publicação de Curso ausente
   preço diferente de zero
   duração de acesso inválida
   cronograma incompatível
   ~~~

7. Leia a Matrícula da Conta + Curso com FOR UPDATE, se existir.
8. Leia o grant gratuito existente por user_id, course_id e
   source_type, com FOR UPDATE.
9. Se a Matrícula estiver revoked, rejeite. Se o grant gratuito estiver
   cancelled ou em estado terminal, rejeite; não transforme bloqueio ou
   reembolso em novo acesso.
10. Consulte grants de acesso efetivos de qualquer origem no instante now.
    Se existir acesso efetivo, não insira free_enrollment. Retorne
    already_active sem novo evento. Essa regra cobre paid, manual e free.
11. Se não houver grant gratuito e não houver acesso efetivo, prepare uma
    janela startsAt = now e expiresAt = addMonths(now,
    access_duration_months).
12. Se houver grant gratuito expirado, prepare uma nova janela. Preserve o
    mesmo id via upsert e marque o resultado como reactivated.
13. Faça o insert/upsert com order_id e manual_reference explicitamente
    nulos. O alvo do conflito deve ser o índice parcial
    (user_id, course_id) WHERE source_type = 'free_enrollment'.
14. Ao criar ou reativar, insira um evento free_enrollment_granted na mesma
    transação. Metadata segura deve conter apenas accessDurationMonths,
    startsAt, expiresAt, reactivated, previousStartsAt e
    previousExpiresAt; não inclua e-mail, nome, IP, token, Order ou Asaas.
15. Chame rebuildEnrollmentProjection antes do commit. Não implemente uma
    segunda projeção. O lock reentrante existente é esperado.
16. Faça COMMIT e só então retorne o resultado.

O evento não deve ser inserido no caminho already_active. Double-click,
duas abas e retry devem resultar em uma linha gratuita e um evento de concessão
por episódio criado/reativado.

**Verifique:**

~~~powershell
bun run test -- src/features/enrollments/free-enrollment.test.ts src/features/enrollments/server-sql.test.ts
~~~

**Esperado:** testes de criação, no-op ativo, reativação, revogação, curso
fechado, preço alterado, publicação ausente e rollback passam. Inclua uma
asserção de boundary no teste: o novo arquivo não contém imports de payments,
Asaas ou orders. Se a única forma de criar o evento for duplicar seu SQL,
pare e extraia o writer compartilhado.

### Etapa 4: adicionar a Server Action e um CTA com feedback seguro

Em src/app/(student)/app/actions.ts:

1. Adicione enrollFreeCourseAction(formData: FormData).
2. Chame requireRole(["student"]) antes da operação. Esse guard já rejeita
   ausência de sessão, papel incorreto e Student bloqueada.
3. Leia somente courseId do formulário e valide sua forma antes do serviço.
4. Passe session.user.id ao serviço; nunca leia userId, papel, preço,
   status, slug ou duração do formulário.
5. Capture somente erros de domínio conhecidos e devolva um resultado seguro:

   ~~~ts
   { ok: true; courseId }
   { ok: false; message }
   ~~~

   Erro desconhecido deve virar mensagem genérica e log operacional seguro, não
   mensagem de banco.
6. Revalide /app, /app/cursos/<courseId> e a superfície de aquisição que
   depender de cache. Faça a revalidação depois do commit feito pelo serviço.
7. Como a UI precisa mostrar a corrida preço mudou entre render e clique,
   use um retorno tipado e navegação do cliente após sucesso, seguindo o
   padrão de CourseInterestButton. Não capture ou disfarce um redirect do
   framework como sucesso.

Crie src/app/comprar/[slug]/free-enrollment-button.tsx como Client Component
pequeno:

- useTransition para estado pendente;
- <form> com courseId hidden e botão semântico;
- botão desabilitado/loading durante a própria submissão;
- erro conhecido em role="alert" ou toast seguro;
- router.push('/app/cursos/<id>') somente quando ok: true;
- sem UUID, localStorage, sessionStorage, polling ou fetch para Checkout.

O servidor continua autoritativo mesmo com o botão desabilitado. A action pode
ser invocada diretamente por POST.

**Verifique:**

~~~powershell
bun run test -- 'src/app/(student)/app/actions.test.ts' 'src/app/comprar/[slug]/free-enrollment-button.test.tsx'
~~~

**Esperado:** Student válida chama o serviço com o ID da sessão; Admin,
Support, Conta bloqueada e input inválido não persistem; resultado de erro é
seguro; sucesso navega ao Curso; o botão não chama /api/checkouts/course.

### Etapa 5: preservar retorno seguro de login/cadastro

Crie src/lib/auth-return-to.ts, sem server-only, para compartilhar a regra
de validação entre página e Route Handler. Exponha uma função como
getSafeAuthReturnTo(value: unknown): string | null.

Aceite somente:

~~~text
/comprar/<slug-canonico>
~~~

Use uma allowlist positiva de slug e limite máximo de tamanho. Rejeite:

- string vazia, nula ou não-string;
- https://outro-host, http://, //outro-host e userinfo;
- barras invertidas, caracteres de controle e encoding malformado;
/app, /admin, /comprar, /comprar/, .., query string ou fragmento;
- slug vazio, maiúsculas se o contrato de slug for minúsculo, espaços e
  sequências que não pertençam ao formato canônico.

Atualize as páginas:

1. src/app/(auth)/entrar/page.tsx e cadastro/page.tsx devem ler o
   searchParams Promise do App Router e passar somente o valor já validado
   ao formulário.
2. Se uma Student já autenticada visitar uma página de auth com retorno válido,
   redirecione para o retorno; Admin/Support continuam em /admin.
3. SignInForm e SignUpForm devem acrescentar o retorno validado na chamada
   GET de /api/auth/redirect usando URLSearchParams, nunca concatenando
   valor cru.
4. O link “Já tenho uma conta” de cadastro deve preservar o retorno validado.
5. src/app/api/auth/redirect/route.ts deve receber Request, validar
   novamente a query e retornar o path somente para sessão student não
   bloqueada. Ausente/inválido usa /app; Admin/Support usam /admin.
6. O retorno nunca pode contornar o 403 de Student bloqueada.
7. Não altere o fluxo de recuperação de senha nesta V1; se o executor desejar
   propagá-lo, pare e reporte a expansão de escopo.

**Verifique:**

~~~powershell
bun run test -- src/lib/auth-return-to.test.ts 'src/app/api/auth/redirect/route.test.ts' 'src/app/(auth)/entrar/sign-in-form.test.tsx' 'src/app/(auth)/cadastro/sign-up-form.test.tsx'
~~~

**Esperado:** path interno de compra retorna corretamente; todas as variações
externas/malformadas caem no destino padrão; Admin/Support nunca recebem um
retorno Student; bloqueio continua 403. Se o teste conseguir produzir um
redirect para host externo, pare imediatamente.

### Etapa 6: separar aquisição gratuita do handoff pago

Em src/features/payments/purchase-handoff.ts:

1. Adicione uma variante PurchaseHandoffView com kind:
   free_enrollment, courseId, courseSlug e courseTitle.
2. Renomeie o resolver para uma intenção de aquisição, ou crie um ramo
   explícito antes do ramo Checkout. Não misture snapshot/digest financeiro no
   retorno gratuito.
3. Preserve esta ordem exata:

   ~~~text
   Curso ausente/arquivado
   -> team_account
   -> account_blocked
   -> course_revoked
   -> access efetivo
   -> coming_soon/sales_closed
   -> aquisição aberta
   ~~~

4. Na aquisição aberta, depois de validar status, vendas e Publicação, se
   price_in_cents === 0, devolva free_enrollment.
5. O ramo gratuito deve preservar a validação do cronograma, mas não deve
   chamar assertCheckoutAvailable, ler PAYMENTS_CHECKOUT_MODE, construir
   digest financeiro ou importar provider.
6. Para price_in_cents > 0, preserve exatamente o ramo Checkout atual:
   mínimo Asaas, mode, snapshot/digest, PurchaseHandoffClient.
7. Preço positivo submínimo/invalidado continua course_unavailable.

Em src/app/comprar/[slug]/page.tsx:

- crie uma pequena renderização de Curso gratuito;
- Student autenticada vê Curso gratuito e FreeEnrollmentButton;
- visitante vê Criar conta para se inscrever e Entrar, ambos com
  returnTo seguro para a mesma URL;
- Student com acesso continua vendo Acessar curso;
- Student revogada, Conta bloqueada, Admin e Support não veem CTA de inscrição;
- vendas fechadas e Curso sem publicação continuam sem criar acesso;
- nenhum texto do ramo gratuito deve dizer Checkout, Pedido ou Asaas.

**Verifique:**

~~~powershell
bun run test -- src/features/payments/purchase-handoff.test.ts 'src/app/comprar/[slug]/page.test.tsx'
~~~

**Esperado:** visitante/Student recebem o estado gratuito somente quando
elegíveis; acesso, bloqueio e revogação têm precedência; fixture gratuita com
getServerEnv lançando erro ainda retorna free_enrollment, demonstrando que
Asaas não é lido pelo ramo; Curso pago continua checkout.

### Etapa 7: permitir preço zero na disponibilidade e no link público

Em src/features/courses/availability-server.ts:

1. Altere somente o gate do preset available para aceitar
   price_in_cents = 0.
2. Continue rejeitando preço positivo abaixo de
   ASAAS_MINIMUM_CHECKOUT_VALUE_IN_CENTS.
3. Continue rejeitando oferta paga sem Pix/cartão.
4. Continue validando Publicação e cronograma de Módulos.
5. Não altere resolveCourseAvailability; ele continua tratando estado de
   entrega, catálogo e vendas, não preço.

Atualize availability-server.test.ts com:

- Curso zero + publicação + vendas fechadas -> pode abrir;
- Curso zero + métodos armazenados válidos -> pode abrir;
- Curso 999 -> rejeitado;
- Curso 1000 -> comportamento pago preservado;
- cronograma incompatível -> rejeitado também para zero.

Em src/features/payments/course-purchase-link.ts:

1. Valide status, vendas e Publicação para os dois tipos.
2. Valide que preço é inteiro e não negativo.
3. Se o preço for exatamente zero, devolva URL disponível sem consultar o
   modo do Checkout.
4. Se o preço for positivo, preserve mode public, piso Asaas e
   invalid_price.

Atualize src/app/(admin)/admin/cursos/[courseId]/course-purchase-link.tsx:

- use texto Link público/Link público do Curso, não Link público de
  compra quando o link também inscreve gratuitamente;
- para falha paga, explique Checkout pago e mantenha o código seguro;
- não esconda a URL estável já copiada pela Administração.

Atualize os testes de link para free + disabled, free + closed/unpublished,
paid + disabled, paid + subminimum e URL/slug codificado.

**Verifique:**

~~~powershell
bun run test -- src/features/courses/availability-server.test.ts src/features/payments/course-purchase-link.test.ts 'src/app/(admin)/admin/cursos/[courseId]/course-purchase-link.test.tsx'
~~~

**Esperado:** Curso gratuito ativo/publicado pode abrir e gerar link mesmo com
Checkout desabilitado; Curso pago não ganha essa exceção.

### Etapa 8: ajustar formulário de preço e apresentação administrativa

Em src/features/admin/authoring.ts:

1. Leia e valide priceInCents antes de interpretar a oferta de pagamento.
2. Quando o preço for zero, use DEFAULT_COURSE_PAYMENT_OFFER no valor
   persistido e ignore os campos de método enviados. Isso mantém as colunas
   válidas sem transformar a configuração de pagamento em parte do contrato
   gratuito; não preserve configurações pagas específicas nesta V1.
3. Quando o preço for positivo, continue exigindo pelo menos um método e
   validando 1–12 parcelas.
4. Não remova colunas de pagamento nem faça migration de limpeza nesta V1.

Em course-dialogs-client.tsx:

- calcule o preço digitado com o parser existente;
- quando for zero, oculte os controles Pix/cartão/parcelamento e mostre uma
  explicação curta: Curso gratuito. A inscrição é feita diretamente pelo
  Hub.;
- não envie checkboxes desabilitados como se fossem uma oferta paga; o parser
  server-side deve aplicar o fallback válido definido acima;
- quando o valor deixar de ser zero, restaure os controles sem apagar estado
  válido inesperadamente;
- mantenha confirmação de alteração de preço.

Atualize a descrição de configurações em
src/app/(admin)/admin/cursos/[courseId]/page.tsx para falar de página pública
de aquisição, não somente checkout externo.

Adicione testes para:

- preço zero renderiza nota e não renderiza controles interativos de pagamento;
- submit com preço zero chega ao action sem falhar “Pix, cartão ou ambos”;
- preço pago preserva controles e validações;
- troca zero -> pago mantém oferta válida;
- operational state de Curso gratuito disponível é ready, não
  commercial_incomplete nem checkout_unavailable.

**Verifique:**

~~~powershell
bun run test -- 'src/app/(admin)/admin/cursos/[courseId]/course-dialogs-client.test.tsx' src/features/admin/authoring.test.ts src/features/admin/presentation.test.ts
~~~

**Esperado:** preço zero salva com colunas válidas; valores pagos continuam
exigindo oferta; nenhum teste antigo de preço/parcelamento regrede.

### Etapa 9: propagar evento na Auditoria e manter read models coerentes

1. Em src/features/admin/server.ts, inclua
   free_enrollment_granted nas duas listas de enrollment_events da
   consulta de Auditoria.
2. Em src/features/admin/audit-presentation.ts, inclua um label estável,
   por exemplo enrollment.free_enrollment_granted: “Inscrição gratuita”.
3. Atualize audit-enrollment-events.test.ts para testar a presença do evento
   no SQL e do label.
4. Confirme que getAdminStudentDetail, getSupportCourseStudentContext e a
   lista de Matrículas já projetam enrollments; não crie uma tabela ou
   consulta paralela para free.
5. Confirme que Orders/receita/ticket/conversão permanecem baseados em
   orders, enquanto Matrículas ativas continuam baseadas em enrollments.
6. Não inclua evento gratuito no financial_events nem em dashboards
   financeiros.

**Verifique:**

~~~powershell
bun run test -- src/features/admin/audit-enrollment-events.test.ts src/features/admin/server-read-projections.test.ts src/features/admin/support-server.test.ts
~~~

**Esperado:** o evento gratuito aparece no histórico administrativo com label
legível e nenhum agregado financeiro muda.

### Etapa 10: integrar PostgreSQL e testar concorrência real

Crie src/features/enrollments/free-enrollment.integration.test.ts seguindo o
padrão de src/features/enrollments/content-release.integration.test.ts:

1. Exija CERTIFICATE_CONCURRENCY_DATABASE_URL ou a URL de integração já
   aceita pelo repositório.
2. Use withVerifiedSslMode, pool separado e fixtures com IDs aleatórios.
3. Crie Conta Student, Perfil, Curso zero active/listed/open, Publicação
   publicada e pelo menos um Módulo/Aula quando a jornada precisar de conteúdo.
4. Limpe somente as fixtures criadas e feche o pool em afterAll.
5. Não use .env.local implicitamente nem banco Neon persistente.

Cubra obrigatoriamente:

- inscrição única cria um grant free_enrollment, uma Matrícula ativa e um
  evento, sem Order;
- duas chamadas concorrentes concluem sem erro de unicidade e deixam um grant,
  uma Matrícula e um evento de concessão;
- retry depois de resposta perdida é no-op enquanto o grant é efetivo;
- grant expirado é reativado conforme a decisão ratificada, com mesmo ID e
  metadata de janela anterior/nova;
- Matrícula revoked/grant cancelado por bloqueio não pode ser reativado pelo
  Aluno;
- grant manual ou pago efetivo impede novo free grant;
- preço alterado para pago antes da leitura final é rejeitado;
- Curso fechado, arquivado, draft ou sem Publicação é rejeitado;
- select count(*) from orders para a Conta + Curso permanece zero;
- enrollment_grants.order_id e manual_reference são nulos;
- manutenção expira grant gratuito e Matrícula conforme o contrato existente;
- bloqueio de grant gratuito isolado cancela acesso;
- bloqueio de paid + free cancela ambos e restauração só retorna grants com
  manual_access_block.

Para a corrida de preço, use dois clientes: segure a linha do Curso em uma
transação, inicie a action/serviço que aguarda o lock e altere/commite o preço
antes de liberar a leitura. Se o teste não for determinístico, não use sleep
cego; crie um ponto de sincronização observável no fixture ou mantenha a prova
no contrato de lock e reporte a limitação.

**Verifique:**

~~~powershell
bun run db:migrate:e2e
bun run test:certificates:integration -- src/features/enrollments/free-enrollment.integration.test.ts
~~~

Se o script de integração do repositório não aceitar filtro, execute a suite
de integração conforme docs/operations/testing-and-ci.md. **Esperado:** todos
os testes PostgreSQL passam com banco descartável. Um teste apenas com mock de
SQL não substitui a concorrência real.

### Etapa 11: adicionar jornada E2E sem Asaas

Atualize scripts/seed-e2e.ts:

1. Adicione uma fixture freeCourse com id, slug, lessonId opcional e
   Curso price_in_cents = 0, status = active, catalog_visibility = listed,
   sales_status = open.
2. Crie Publicação publicada, Módulo ativo e Aula ativa suficientes para a
   rota de Curso abrir.
3. Não crie grant para o usuário que fará o teste de autoinscrição.
4. Inclua o Curso no conjunto de limpeza e na interface E2eFixture.
5. Preserve course pago existente; os testes Asaas dependem dele.

Adicione a tests/e2e/critical-journeys.spec.ts:

1. Visite /comprar/<freeSlug> anonimamente.
2. Confirme que aparecem Criar conta para se inscrever e Entrar, sem
   iniciar /api/checkouts/course.
3. Crie uma Conta pelo fluxo público E2E, que já usa
   AUTH_PUBLIC_SIGNUP_ENABLED=true no runtime descartável.
4. Confirme que o cadastro retorna exatamente a /comprar/<freeSlug> segura,
   não /app.
5. Clique Inscrever-se grátis; confirme URL /app/cursos/<freeCourseId> e
   conteúdo do Curso.
6. Conte requests: zero POST de Checkout e zero request ao fake Asaas
   causado por essa jornada.
7. Consulte o banco pela helper segura e confirme uma Concessão gratuita, uma
   Matrícula e zero Orders.
8. Adicione uma jornada Student autenticada para a inscrição direta, além das
   jornadas existentes de acesso, revogação, bloqueio e Conta de equipe.

Não torne os testes concorrentes E2E por causa de um double-click; a
concorrência pertence à Etapa 10. Não abra URL local manualmente.

**Verifique:**

~~~powershell
bun run db:migrate:e2e
bun run test:e2e
~~~

**Esperado:** desktop/mobile passam; o fluxo pago existente continua criando
um único Checkout; o fluxo gratuito não toca o endpoint de Checkout.

### Etapa 12: atualizar documentação canônica junto do contrato

Somente depois de código/testes aprovados:

1. CONTEXT.md: atualizar Concessão de acesso para incluir origem gratuita
   e manter distinção de Aluno, Conta, Compradora, Pedido e Matrícula.
2. PRODUCT.md: documentar a jornada de Curso gratuito e registrar que
   cadastro público depende de flag explícita; manter os não-objetivos.
3. docs/domain/identity-and-authorization.md: documentar retorno seguro
   /comprar/<slug>, papel Student na action e que signup continua não criando
   Concessão automaticamente.
4. docs/domain/commerce-and-access.md: atualizar REG-COM-004, REG-COM-006 e
   REG-COM-007 para explicar free_enrollment, duração, reentrada, bloqueio,
   no-op por acesso existente e ausência de Orders/Asaas. Se for criada uma
   regra nova, use o próximo ID estável, por exemplo REG-COM-011, sem
   duplicar IDs.
5. Criar docs/adr/0013-free-course-self-enrollment.md somente com decisão
   ratificada. Registrar alternativas rejeitadas e consequências. Não marcar
   accepted se o produto não aprovou reentrada/cadastro.
6. docs/decisions.md: adicionar o próximo DEC-DISC-017 e apontar para
   ADR/guia.
7. docs/architecture.md: adicionar o ramo local no fluxo de aquisição,
   listar a nova action/serviço e afirmar que o fluxo não usa provider.
8. docs/README.md: indexar ADR novo, se existir, e manter o mapa canônico.
9. docs/operations/database-and-migrations.md: depois da migration aplicada
   no change set, atualizar current_migration_tag para 0081...,
   migration_entry_count para 82 e o last_verified_commit para um commit
   existente da implementação. Não atualizar o número antes de os arquivos
   existirem.
10. Atualize last_verified_commit dos documentos canônicos para o SHA que
    realmente contém o contrato verificado. Não use o SHA do plano como prova
    da implementação.

**Verifique:**

~~~powershell
bun run docs:check
bun run db:migrations:check
~~~

**Esperado:** Documentação válida e Migrations validas. Links relativos,
IDs estáveis, metadados e fatos da cadeia devem passar.

### Etapa 13: gates finais, revisão e release handoff

Execute nesta ordem, registrando a saída e o SHA:

~~~powershell
bun run test -- src/features/enrollments/free-enrollment.test.ts src/features/payments/purchase-handoff.test.ts src/features/payments/course-purchase-link.test.ts
bun run db:migrations:check
bun run docs:check
bun run typecheck
bun run check
bun run verify:quick
bun audit --production
bun run verify
~~~

Depois, em banco descartável:

~~~powershell
bun run db:migrate:e2e
bun run test:certificates:integration
bun run test:e2e
~~~

Para uma mudança de schema/auth/integração, tente o CodeRabbit conforme
docs/operations/code-review-with-coderabbit.md, primeiro verificando CLI e
autenticação. Se estiver indisponível, registre CodeRabbit: skipped — motivo
na revisão; não instale ferramenta nem exponha segredo.

O handoff de release deve conter:

- SHA exato com CI verde;
- migration 0080 e 0081 revisadas e replayadas em PostgreSQL descartável;
- E2E gratuito e pago verdes;
- confirmação de AUTH_PUBLIC_SIGNUP_ENABLED no ambiente aprovado;
- nenhum orders criado pela fixture gratuita;
- confirmação de que migrations persistentes serão aplicadas somente pelo fluxo
  oficial, com backup/lock/readiness conforme o runbook;
- nenhum segredo, dump, .env.local ou dado real no diff.

Não executar migration em Staging/Production como parte deste plano sem ordem
explícita e sem os gates do release flow.

## Test plan consolidado

### Domínio e banco

- enum de origem contém paid_order, manual, free_enrollment;
- enum de eventos contém free_enrollment_granted;
- constraint rejeita shape inválido e aceita somente nulos no free;
- índice parcial impede duas linhas free por Conta + Curso;
- migration vazia e migration incremental passam no replay;
- grant free não possui vínculo financeiro ou manual.

### Autorização

- ausência de sessão;
- Admin;
- Support;
- Student bloqueada;
- Matrícula revogada;
- acesso ativo pago/manual/free;
- tentativa com courseId inválido ou de outro estado;
- preço, vendas, duração e publicação relidos no servidor.

### Handoff e UI

- visitante gratuito;
- Student gratuita;
- Curso pago sem regressão;
- checkout disabled + gratuito disponível;
- checkout disabled + pago indisponível;
- Curso fechado, arquivado, draft e sem Publicação;
- link público gratuito disponível somente com status/vendas/publicação;
- returnTo válido, ausente, externo, protocol-relative, barra invertida,
  query/hash, .., slug inválido e valor grande;
- label/CTA não chama uma inscrição gratuita de compra ou Checkout.

### Concorrência e ciclo de vida

- double-click;
- duas abas;
- retry após timeout;
- expiração por maintenance;
- reentrada explícita após expiração;
- bloqueio/restauração free isolado;
- bloqueio paid + free + manual conforme política ratificada;
- pagamento refund/dispute não é alterado pela action gratuita;
- 0 -> pago preserva janela existente;
- pago -> 0 preserva Order/grant pago.

### Financeiro e auditoria

- zero inserts em orders;
- zero chamadas/imports Asaas;
- receita, ticket, pedidos e conversão inalterados;
- Matrícula ativa/contagem de acesso aumentam;
- evento aparece uma vez no feed de Auditoria;
- metadata não contém PII ou provider IDs.

## Done criteria

Todos devem ser verdadeiros:

- [ ] Produto ratificou duração, reentrada, acesso misto, bloqueio source-neutral
  e cadastro público.
- [ ] free_enrollment existe no schema e nas duas migrations forward-only.
- [ ] 0080 adiciona enums e 0081 usa os valores após o commit anterior.
- [ ] order_id e manual_reference nulos são exigidos para grant gratuito.
- [ ] Há unicidade parcial por (user_id, course_id) para a origem gratuita.
- [ ] Serviço usa locks existentes, courses FOR UPDATE, transação e
  rebuildEnrollmentProjection.
- [ ] Action exige student, usa ID de sessão e devolve somente dados seguros.
- [ ] Curso gratuito não importa ou chama Asaas e não insere orders.
- [ ] Acesso efetivo existente não cria grant gratuito adicional.
- [ ] Double-click, duas abas e retry convergem para um grant e uma Matrícula.
- [ ] Handoff/link gratuitos ignoram somente gates do Checkout pago.
- [ ] Preço zero pode abrir disponibilidade; preço pago submínimo continua
  rejeitado.
- [ ] UI de preço zero não falha por checkboxes de pagamento ausentes.
- [ ] Bloqueio, restauração e validade administrativas não falham em Matrícula
  gratuita e não reativam estados financeiros terminais.
- [ ] Evento gratuito aparece no feed e no label de Auditoria.
- [ ] Visitante retorna a /comprar/<slug> somente por path validado.
- [ ] Cadastro público continua fechado por default e é habilitado apenas no
  ambiente aprovado.
- [ ] bun run docs:check, bun run db:migrations:check, bun run typecheck,
  bun run check, bun run verify:quick, bun audit --production e
  bun run verify exitam 0.
- [ ] Integração PostgreSQL e bun run test:e2e passam em ambiente descartável.
- [ ] git status --short contém apenas arquivos autorizados; nenhum segredo,
  dump, artefato ou alteração não relacionada aparece.

## STOP conditions

Pare e reporte, sem improvisar, se ocorrer qualquer situação abaixo:

- o SHA, enum, schema, lock, query ou ordem de transação não coincidir com
  Current state;
- o produto não ratificar reentrada ou cadastro público;
- for necessário criar course_offers, Pedido gratuito, Asaas, novo REST
  público, autoinscrição no signup ou um segundo sistema de Matrícula;
- Drizzle tentar recriar enum, editar migration histórica ou produzir
  constraint com enum novo na mesma migration do ALTER TYPE;
- a action puder ser chamada sem autenticação Student ou confiar em userId,
  preço/status/publicação enviados pelo cliente;
- returnTo aceitar host externo, //, barra invertida ou path fora de
  /comprar/<slug>;
- bloqueio de Matrícula deixar um grant ativo ou restauração tocar
  refunded/disputed;
- o serviço gratuito importar payment/provider/order ou inserir em orders;
- uma segunda chamada ativa emitir novo evento de concessão;
- integração não puder rodar contra banco PostgreSQL descartável;
- qualquer gate falhar duas vezes após tentativa focada de diagnóstico;
- alguma saída contiver valor de segredo. Redija novamente a saída sem o valor e
  recomende rotação; nunca coloque o valor em código, teste, log ou documento;
- aparecer mudança fora do escopo, .env.local, dump, fixture real ou arquivo
  não explicado no git status.

## Maintenance notes

- A origem gratuita deve continuar pequena enquanto houver uma oferta por
  Curso. Se aparecer necessidade de campanhas, múltiplos preços, bundles,
  cupons, assinaturas ou um Curso em várias ofertas, pare de ampliar o enum e
  faça uma decisão separada sobre Offer/aquisição.
- A política de reentrada é parte do contrato de acesso. Mudá-la pode alterar
  suporte, métricas e interpretação histórica; registre nova decisão antes de
  alterar código.
- O preço zero é um sinal de aquisição gratuita nesta V1, não uma autorização
  para remover colunas de pagamento ou alterar a semântica de Orders.
- applyPaymentRevocation permanece paid-only. Reembolso não é bloqueio manual
  e não pode restaurar ou cancelar um grant gratuito por acidente.
- Se futuramente houver e-mail de boas-vindas, crie tópico outbox com chave de
  idempotência, payload versionado, classificação PII, retenção e runbook; não
  adicione isso como efeito escondido desta feature.
- Revisores devem conferir primeiro: lock de conteúdo + Curso FOR UPDATE,
  unicidade parcial, no-op por acesso efetivo, gates free/paid, allowlist de
  retorno e ausência de imports/queries financeiras.
- Depois de cada etapa de código, atualize somente o status do trabalho e
  mantenha este plano; não marque DONE com base em intenção ou em teste não
  executado.
