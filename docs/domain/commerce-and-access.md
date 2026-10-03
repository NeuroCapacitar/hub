---
status: canonical
owner: engineering
last_verified_commit: 6bf5d693fd565c7c4c0c4bd9b7754efca92c2b44
---

# Comércio e acesso

## Escopo

Une checkout, Pedido, webhook, revisão, reembolso, Concessão, Matrícula, expiração e bloqueio por curso.

## Estados

O processor Asaas aplica estes estados sobre o Pedido bloqueado:

- Pedido: `pending`, `paid`, `refunded`, `disputed`, `cancelled`.
- Webhook: `received`, `processing`, `retryable`, `processed`, `ignored`, `failed`.
- Revisão: `pending`, `approved`, `rejected`; tipos `amount_mismatch`,
  `terminal_conflict`, `event_anomaly`, `partial_refund` e `uncertain_result`.
- Reembolso: `requested`, `processing`, `uncertain`, `failed`, `confirmed`.
- Concessão: `active`, `expired`, `refunded`, `disputed`, `cancelled`.
- Matrícula: `active`, `expired`, `revoked`.

### REG-COM-001 Pedido preserva o contrato vendido

Ao criar checkout, o Pedido captura preço, duração de acesso, Curso, identidade da compra e o snapshot server-side do cronograma de Módulos. Alterar o Curso depois não altera o Pedido histórico.

Quando há Módulos atrasados, a compradora precisa revisar o cronograma antes do primeiro POST financeiro. O servidor compara o digest canônico exibido com a publicação vigente antes de rate limit, INSERT ou provider; uma mudança exige nova revisão.

**Contrato aprovado:** Curso pago custa no mínimo `1000` centavos, equivalentes a
R$ 10. A autoria valida o preço ao criar ou editar o Curso, e o checkout repete a
validação antes de criar o Pedido ou chamar o provider. Dados de teste abaixo desse
mínimo devem ser ajustados ou removidos.

**Implementação atual:** a autoria persiste `price_in_cents` localmente ao criar ou
editar Curso, aceita zero para Curso gratuito e rejeita Curso pago abaixo de `1000`
centavos sem depender de gateway ou produto remoto. O núcleo Asaas em
`src/features/payments/checkout.ts` repete o mínimo, persiste o Pedido antes do efeito
externo e usa exclusivamente os snapshots obrigatórios de nome, descrição, valor e
duração. As entradas autenticada e pública usam esse mesmo núcleo. O limite público é
coordenado no PostgreSQL por HMAC de IP e ID canônico do Curso, com cinco novas intenções
por dez minutos; uma tentativa já persistida não consome novamente o limite. As migrations
`0044` a `0051` foram promovidas a Production em 2026-07-31; o journal de
Production acompanhou todas as promoções seguintes até `0064`.

Toda alteração de oferta ou identidade do Curso gera `course.created` ou
`course.updated` em `audit_logs`. O metadata estruturado preserva, sem dados de Aluno,
o antes/depois de preço, Pix, cartão, parcelamento, duração de acesso, título, descrição,
carga horária e estado da capa. Alterações de disponibilidade e de conteúdo seguem a
mesma trilha com seus próprios eventos e ator.

Quando a criação retorna `processing`, a página pública consulta a mesma tentativa por
UUID opaco e slug, sem criar outro Checkout automaticamente. O navegador compartilha esse
UUID sem PII entre abas por até 60 minutos, aplica polling limitado em 1, 2, 4, 8 e 16
segundos e então oferece somente verificação manual. A leitura exige a dupla exata, não
aceita `orderId` enumerável separado, responde com `Cache-Control: no-store` e retorna
apenas estado seguro e URL quando o Pedido correspondente já está `active`.

**Falha:** preço abaixo de `1000` centavos, Curso indisponível, limite público ou provider
sem configuração impedem checkout.

Quando o Curso está `active`, `listed`, com vendas abertas e Publicação publicada,
`price_in_cents = 0` usa a aquisição gratuita. `getPurchaseHandoffView` devolve
`free_enrollment` depois de validar o mesmo cronograma de Módulos, sem Pedido,
Checkout, digest financeiro ou provider; a Student usa a action de autoinscrição e
visitantes seguem para login/cadastro com retorno interno seguro. Preço positivo
continua sujeito ao piso de `1000` centavos e aos gates do Checkout.

### REG-COM-002 Webhook é autenticado e idempotente

Para Asaas, `POST /api/webhooks/asaas` compara somente o header `asaas-access-token` com
o segredo server-only, limita o corpo antes de JSON e persiste eventos estruturalmente
válidos antes de responder `200`. Duplicata também responde `200`; falha de banco não.
O worker genérico separado possui claim, posse, stale-lock recovery, retry e conclusão
CAS. A rota cron está agendada a cada quinze minutos em `vercel.json`, sob kill switch, lease e
deadline; está ativa em Production desde 2026-08-21.
Payload vencido nunca volta ao worker: a manutenção sanitiza a evidência bruta e
terminaliza qualquer evento não concluído com código seguro.

**Invariantes:**

- responder sucesso só após persistir o desfecho;
- uma repetição não duplica Pedido, Concessão ou efeito;
- evento desconhecido pode ser ignorado sem abrir acesso;
- payload externo é tolerante a campos adicionais.

**Concorrência:** o processor correlaciona identificadores exatos, bloqueia o Pedido antes
de ler seu snapshot e associa o Webhook por CAS. Depois da confirmação financeira, o
Hub cria uma única intenção `email.purchase-confirmed` por Pedido na mesma transação da
Concessão e Matrícula. `purchase_confirmation_intents` conserva o marcador idempotente
além da retenção da outbox; Pedidos pagos com identidade resolvida antes da migration são
registrados como históricos, evitando que uma conciliação posterior dispare novamente um
e-mail antigo. Pedidos que estavam em Revisão permanecem elegíveis após a resolução.
Uma intenção nova começa com `purchase_confirmation_intents.verification_required`
nulo. Na primeira preparação da entrega, antes de chamar o provider, um `UPDATE`
condicional registra a situação atual de `users.email_verified`. Se a Conta já
foi confirmada enquanto a mensagem aguardava, o CTA é **Acessar Curso**; caso
contrário, o delivery cria/recupera o desafio `purchase_verification` e envia
**Compra confirmada** com CTA de confirmação. Depois de registrada, essa decisão
permanece estável nos retries, mesmo que o estado da Conta mude. Se um Pedido
legado resolvido ainda não tiver snapshot
de comprador, o e-mail/nome da Conta vinculada são gravados no Pedido nessa
transação; snapshots já recebidos do checkout/provider prevalecem. A entrega não
usa valores mutáveis da Conta como fallback. Para quem já estava verificado, a mensagem aponta à rota
de compra do Curso, que preserva o retorno ao acesso após login. Se o desafio
estiver perto de vencer antes da primeira tentativa ao provider, ele é renovado;
depois dela, token, prazo e conteúdo permanecem estáveis durante a janela de
retry/idempotência. A confirmação comprova somente posse da caixa: não cria
sessão, senha, nova Concessão ou Matrícula. `auth.account-activation` e
`email.access-released` continuam reconhecidos apenas para mensagens legadas; não são
enfileirados para novos Pedidos.

### REG-COM-003 Estado terminal não é sobrescrito silenciosamente

**Contrato aprovado para Asaas:**

- `CHECKOUT_PAID` não libera acesso;
- PIX libera em `PAYMENT_RECEIVED`;
- cartão libera em `PAYMENT_CONFIRMED` quando não há `provider_risk_status`
  `AWAITING_RISK_ANALYSIS` ou `REPROVED_BY_RISK_ANALYSIS`; aprovação de risco posterior
  pode destravar uma confirmação já armazenada;
- o valor bruto `value` deve corresponder exatamente ao snapshot do Pedido em centavos,
  com tolerância zero;
- divergência não libera e abre revisão;
- Revisão pendente criada pelo evento atual ou anterior mantém o Pedido pendente,
  preservando somente evidência segura do provider e bloqueando Concessão/outbox;
- reembolso confirmado, disputa e chargeback prevalecem e revogam;
- Revisão bloqueia concessão, não a revogação de um evento adverso autoritativo; sem
  Conta ou Concessão paga `active`/`expired`, a revogação é no-op; Pedido já adverso ou
  conflito terminal não impede revogar uma Concessão ainda efetiva; a transição da
  Concessão filtra seu estado no `UPDATE` atômico e só então gera evento/projeção;
- `provider_payment_status` avança de `CONFIRMED` para `RECEIVED`, mas não regride por
  `CONFIRMED`, `OVERDUE`, `DELETED` ou `PENDING` tardio;
- pagamento tardio não reativa estado adverso;
- checkout `cancelled`/`expired` não regride para `active`; terminais divergentes preservam
  o primeiro e abrem Revisão;
- cancelamento ou expiração tardios não revogam Pedido já pago;
- evento parcial, desconhecido, regressivo ou contraditório abre revisão ou alerta;
- decisão manual exige permissão, motivo e auditoria.

**Implementação atual:** `decideAsaasFinancialEvent` produz a decisão pura para webhook
e `decideQueriedAsaasPayment` adapta a consulta da conciliação para a mesma matriz.
`applyConfirmedPaymentAccess` converge identidade autenticada ou pública, estado pago,
Concessão, Matrícula e outbox sob o lock do Pedido. Valor divergente, anomalia,
reembolso parcial e conflito terminal criam uma Revisão; identificadores ambíguos não
escolhem Pedido nem produzem efeito. PIX `CONFIRMED` consultado não libera; PIX
`RECEIVED` e cartão `CONFIRMED`/`RECEIVED` podem recuperar o acesso, respeitando risco,
estado terminal e Revisão pendente.

### REG-COM-004 Concessão é a origem; Matrícula é a projeção

Concessão é o ledger e a fonte do direito; Matrícula é a projeção de Conta + Curso. Fluxos
financeiros alteram a Concessão e recompõem a Matrícula, sem criar Matrícula diretamente.
As origens aprovadas de Concessão são explícitas: `paid_order`, `manual` e
`free_enrollment`. `paid_order` representa a origem financeira; `manual` e
`free_enrollment` representam origens locais de acesso, sem acoplamento ao
provider de pagamentos.

**Implementação atual:** `applyPaidWebhookAccess` cria ou reativa a Concessão associada
ao Pedido e `rebuildEnrollmentProjection` consolida as Concessões.

**Invariantes implementados:**

- `paid_order` representa Pedido financeiro em `order_id`; `manual` representa concessão
  auditável sem Pedido em `manual_reference`, usada pelo bootstrap local;
- `free_enrollment` representa concessão gratuita sem Pedido nem referência manual; há
  no máximo uma concessão gratuita por usuário e Curso;
- cada Pedido e cada referência manual possuem Concessão única;
- Concessão financeira terminal não é reativada por novo evento pago do mesmo Pedido;
- Matrícula ativa usa a janela efetiva das Concessões ativas;
- sem Concessão elegível, projeção vira `expired` ou `revoked` conforme o último estado.

`enrollInFreeCourse`, chamado pela action autenticada de Student, é o caso de uso da
autoinscrição. Sob lock de Conta + Curso, ele relê preço, estado de entrega, vitrine,
vendas, Publicação e duração; somente `price_in_cents = 0`, Curso ativo/listado com
vendas abertas, Publicação publicada e cronograma compatível podem criar a Concessão
`free_enrollment`. O fluxo registra evento, recompõe Matrícula e não cria Pedido,
`orders` ou chamada ao Asaas. Qualquer Concessão efetiva de outra origem torna a
operação um no-op; repetição de uma Concessão gratuita ativa não cria novo evento.

O modelo de ledger e projeção foi aceito em
[ADR-0004](../adr/0004-access-grants-and-enrollment-projection.md). O schema e o módulo de
Matrículas usam origens explícitas; revogações financeiras usam razões neutras
`payment_refund` e `payment_dispute`.

### REG-COM-005 Acesso exige Conta e Matrícula efetivas

`resolveCourseAccess` e `resolveLessonAccess` consideram papel, bloqueio de plataforma, Matrícula, expiração, Módulo e disponibilidade do conteúdo. A mesma decisão server-side é exigida por workspace, conclusão, player, comentários e materiais; o cliente não decide acesso. Matrícula `full_access` ignora tempo, enquanto `scheduled` sem âncora falha fechado.

Admin pode conceder `full_access` uma vez no episódio atual com motivo, evento e auditoria. Support recebe modo, âncora e próxima liberação apenas para diagnóstico.

Admin pode usar preview; a mutação de experiência do Aluno continua proibida no preview.

### REG-COM-006 Expiração é calculada sobre a Concessão de acesso

`extendEnrollmentExpiration` e `setEnrollmentExpiration` alteram a janela efetiva, registram `enrollment_expiration_adjustments` e eventos.

**Autorização atual:** `manageEnrollmentAccess` permanece exclusiva de Admin.
Conforme o [DEC-DISC-014](../decisions.md#dec-disc-014), `support` usa
`manageEnrollmentSupport` para ajustar validade e bloquear/restaurar a Matrícula
com motivo e auditoria.

**Invariantes:**

- motivo é obrigatório e normalizado por `validateEnrollmentAdjustmentReason`;
- extensão aceita dias/meses; definição exata registra antes/depois;
- ajuste não deve mudar carga horária ou duração pedagógica;
- manutenção expira Concessões vencidas e recompõe Matrículas.
- autoinscrição gratuita inicia sua janela pela duração de acesso definida no Curso;
  a manutenção existente a expira como qualquer outra Concessão elegível;
- após expiração, a implementação permite nova ação explícita que reutiliza a mesma
  Concessão gratuita e registra a janela anterior/nova; Concessão terminal ou Matrícula
  revogada não é reativada. Essa política foi ratificada em
  [DEC-DISC-017](../decisions.md#dec-disc-017).
- aviso de expiração carrega a validade exata como geração. Se validade, estado
  ou janela mudar antes do delivery, a outbox termina como `superseded` e não
  chama o adapter de e-mail; o scheduler pode criar a nova geração idempotente.

**Histórico:** existiu `reverseExpirationAdjustment`, removida por ser inalcançável e por restaurar às cegas o valor anterior, podendo sobrescrever ajustes posteriores encadeados. Se a reversão voltar a ser necessária, deve nascer com guarda de ordem, idempotência e recomputação de status. A coluna `reversed_adjustment_id` e o valor de evento `expiration_adjustment_reversed` permanecem no schema por o banco ser forward-only.

### REG-COM-007 Bloqueio manual é reversível e auditável

`blockEnrollmentAccess` cancela Concessões de acesso elegíveis com motivo `manual_access_block`; `restoreEnrollmentAccess` restaura apenas Concessões canceladas por esse motivo. A seleção inclui Concessões `paid_order`, `manual` e `free_enrollment` nos estados `active` ou `expired`; revogações financeiras continuam restritas à origem `paid_order`.

Isso também vale para `free_enrollment`: bloqueio de Matrícula encerra o acesso
projetado, e restauração pode reativar somente a Concessão cancelada por esse bloqueio.
Não há restauração de Concessão gratuita terminalizada por outra política, nem
reativação automática durante o bloqueio.

Não confundir com reembolso/disputa nem bloqueio da plataforma. Ambos registram eventos.

### REG-COM-008 Reembolso exige confirmação recente e permissão

`confirmRefundPasswordAction` emite confirmação; `requestFullRefundAction`/`requestFullRefund`
reservam a intenção local, chamam o Asaas uma única vez e persistem em
`refund_requests` somente a evidência de valor integral correlacionada ao mesmo
pagamento. Todos os identificadores presentes precisam convergir e ao menos um dos
identificadores do Pedido precisa corresponder: `externalReference` exata ou
`checkoutSession` exata. Isso admite `externalReference=null` no Payment de Checkout
sem admitir referência ou sessão conflitante.

**Autorização:** `executeRefund`.

**Falhas:** ausência de ID externo, Pedido incompatível, senha não confirmada, resposta
mal correlacionada ou falha do provedor deixam rastro e não devem revogar acesso por
suposição. Rejeição definitiva vira `failed`; resultado desconhecido vira `uncertain` e
exige conciliação, sem repetição cega.

O token de confirmação e sua auditoria usam uma transação local. A reserva e sua
auditoria usam outra transação local antes da mutação externa. A persistência da
evidência ou da falha ocorre depois da resposta do provider.

Quando Admin/Suporte não possui credencial local, a interface pode consultar os
métodos da sessão e orientar a criação da primeira senha pelo fluxo aprovado de
`/recuperar-senha`. A recuperação abre em outra aba para preservar o Pedido em
andamento; depois, a pessoa volta à operação e atualiza a verificação. Essa
consulta só ajusta a orientação visual: a autorização continua exigindo a
confirmação server-side de senha em `confirmRefundPasswordAction`. Consulte
[Perfil da Conta e continuidade de acesso](account-profile-and-access.md).

Conciliação por pagamento e sincronização local do extrato exigem
`manageFinancialOperations`. Toda resolução manual de Revisão exige
`manageFinancialReviews`; `viewFinancials` autoriza somente leitura. Admin recebe
as capacidades administrativas; Suporte pode receber cada grant financeiro de forma
independente conforme a matriz do [ADR-0017](../adr/0017-support-granular-permissions.md).
`amount_mismatch` pode aceitar uma decisão explícita de
liberar ou manter o bloqueio. A aprovação só libera o acesso quando não existe
outra Revisão pendente no mesmo Pedido; a Revisão selecionada não bloqueia sua
própria aprovação. Rejeitar a divergência resolve somente essa Revisão, sem
marcar o Pedido como pago ou conceder acesso, e as demais Revisões pendentes
mantêm o bloqueio. `buyer_identity` exige reembolso integral;
`event_anomaly`, `terminal_conflict` e `uncertain_result` exigem
conciliação/reprocessamento; e `partial_refund` exige tratamento financeiro
específico. Esses tipos não aceitam aprovação ou rejeição genérica. Uma conciliação
iniciada a partir de uma Revisão só a encerra quando não há nova divergência e o
resultado financeiro é seguro. A interface e o servidor exibem e autorizam cada ação
segundo o grant correspondente; possuir leitura não concede mutações.

**Projeção administrativa:** o resumo separa Pedidos pendentes de **potencial em
Checkouts ativos**. O potencial soma o valor nominal do Pedido somente quando o
Pedido está `pending`, o Checkout está `active`, o Hub preserva o ID e a URL da
sessão do provedor e não há ID nem status de cobrança registrados. Isso comprova a
existência local do link sem evidência de cobrança no Hub, não que a pessoa o abriu
ou preencheu; portanto, não é recebível, receita confirmada ou saldo disponível.
Checkouts que o Asaas marcou como pagos, sem evidência financeira de cobrança no Hub,
ficam fora do potencial e aparecem como pendência de confirmação. Checkouts em criação,
ativos, incertos e encerrados são classificados em filas distintas. A
visão por período considera esses links
ativos entre Pedidos criados no intervalo e ainda ativos no momento da consulta,
não um saldo histórico no fim de cada dia. Estados `failed`, `cancelled` e
`expired` ficam fora desse potencial.

Tentativas de Checkout `failed`, `cancelled` ou `expired` sem pagamento aparecem
separadamente. A consulta inclui Pedidos `pending` ou `cancelled`, para que eventos
de cancelamento e expiração aplicados pelo provedor não desapareçam da lista; Pedidos
pagos, reembolsados ou em disputa não entram, inclusive quando chega um evento tardio
de Checkout. `failed` pode representar falha local antes da criação de uma sessão no
provedor, por isso a interface chama o conjunto de tentativas encerradas, não de
abandonos comprovados.

Webhooks falhos, em retry e em processamento são apresentados como estados distintos;
a lista completa e o reprocessamento ficam em Admin > Operação, enquanto o histórico
administrativo permanece em Admin > Auditoria. Análises por período usam a data de
pagamento informada pelo Asaas quando disponível; sem ela, usam `paid_at`, que registra
a confirmação no Hub. O número de pedidos com fallback fica explícito. O bruto inclui
Pedidos `paid`, `refunded` e `disputed` somente quando há evidência de pagamento
(`paid_at`, `paid_amount_in_cents` e identificador Asaas); estados posteriores não
apagam vendas confirmadas do histórico. Reembolsos são movimentos do período e a razão
“Reembolsos / recebimentos” é uma comparação por contagem, não uma taxa de coorte; pode
superar 100%. O líquido é uma estimativa dos snapshots do Pedido, marcada como
incompleta quando faltam dados de taxa/líquido ou há Revisão de reembolso parcial
pendente. Valores de reembolso parcial não são inferidos do total do Pedido.
As filas de reembolso do Painel mostram a idade do item mais antigo e o valor dos
Pedidos envolvidos em solicitações integrais abertas, incertas ou falhas; esse valor
é exposição operacional, não perda nem estorno confirmado.

O Hub não apresenta links ativos como cobranças pendentes: eventos suficientes para
projetar cobranças não pagas ainda não fazem parte desta métrica. O Hub registra uma
compra parcelada uma vez pelo total agregado nos resumos; quando a conciliação valida o
parcelamento, também sincroniza as cobranças individuais em
`asaas_installment_payments`.
O detalhe do Pedido apresenta o status de cada cobrança e um resumo de valores
confirmados e ainda não confirmados, sempre como evidência do Asaas, não como prova de
saldo disponível ou liquidação bancária. Uma trilha append-only em `financial_events`
também registra ocorrências futuras de Pedido, webhook, sincronização, reembolso e
Revisão; snapshots de backfill não reconstituem transições anteriores à sua criação.

### REG-COM-009 Oferta de pagamento pertence ao Curso e ao Pedido

**Decisão de produto:** cada Curso pago deve definir preço, métodos permitidos e política
de cartão. Admin poderá oferecer Pix, cartão ou ambos; cartão à vista ou parcelado; e
limite máximo próprio. A oferta efetiva precisa ser copiada para o Pedido.

**Implementação atual:** preço, Pix, cartão e o teto de 1 a 12 parcelas são configuráveis
por Curso. O padrão de novos Cursos é Pix + cartão em até 3x. A oferta é copiada para o
Pedido e convertida em `billingTypes`, `chargeTypes` e
`installment.maxInstallmentCount` somente na borda Asaas. O item possui um único preço
para Pix, cartão à vista e cartão parcelado. A Vendedora absorve as taxas descontadas pelo
Asaas do recebível; a quantidade escolhida não altera o total pago pela Compradora.

O teto efetivo respeita o piso comercial aprovado de `1000` centavos por parcela,
equivalente ao preço mínimo de um Curso pago. O Asaas permite configurar na conta o valor
mínimo da cobrança e o valor mínimo por parcela; o ambiente usado pelo projeto mantém o
piso externo abaixo ou igual ao contrato interno. O Admin continua salvando o teto
desejado; preço baixo reduz apenas o snapshot do novo Pedido e a tela explica a redução.
Assim, o padrão comercial permanece 3x e um reajuste futuro pode tornar o teto configurado
efetivo sem reescrever compras anteriores.

Para cartão parcelado, `provider_installment_id` identifica o agregado e
`provider_payment_id` preserva a primeira cobrança observada. Antes da transação local, o
processor consulta `GET /v3/installments/{id}` e usa o bruto e o líquido do agregado na
decisão derivada; o payload original permanece na inbox. ID, Checkout, quantidade e valor
total devem coincidir com o snapshot. Eventos das demais parcelas são aceitos somente
quando mantêm o mesmo agregado. Conciliação lista todas as cobranças, e reembolso integral
usa `POST /v3/installments/{id}/refund`.

Quando o agregado é validado, o processor também persiste a quantidade efetiva em
`orders.payment_installment_count`. O valor permanece nulo quando a evidência histórica
não está disponível; a interface comunica essa limitação e não confunde o teto de parcelas
da oferta com a escolha feita pela Compradora.

Na conciliação, `GET /v3/installments/{id}/payments` é consultado e cada cobrança
individual é atualizada por `provider_payment_id`. O Hub preserva vencimento, datas
do provedor como texto, status, valor, líquido, tarifa e antecipação. A tela pode
somar cobranças com status confirmado ou ainda não confirmado para facilitar o
acompanhamento diário, mas status de pagamento não é convertido em saldo de caixa;
o fechamento oficial continua no Asaas.

**Limitação do fornecedor:** o Checkout hospedado não aceita preço diferente por método
ou quantidade de parcelas e não documenta, por sessão, quem absorve o custo do
parcelamento. O Hub não apresenta uma opção fictícia “cliente/vendedor”; no contrato de
lançamento, o preço é único e a Vendedora absorve as taxas. O campo `interest` de outras
APIs é juros por atraso e não pode ser reutilizado para essa finalidade.

Ver [DEC-DISC-011](../decisions.md#dec-disc-011) e a
[pesquisa oficial](../reviews/2026-07-30-asaas-payment-configuration-research.md).

### REG-COM-010 Disponibilidade comercial não decide acesso adquirido

Estado de entrega, visibilidade de catálogo e estado de vendas são dimensões
independentes. Matrícula efetiva continua acessível quando vendas estão pausadas,
mesmo com o Curso oculto. Rascunho e Arquivado bloqueiam entrega; somente
Arquivado representa retirada histórica.

“Em breve” é visível, não vende e aceita Interesse de venda autenticado. Abrir
vendas enfileira um aviso por Interesse; fechar vendas bloqueia novos checkouts e
enfileira cancelamento dos Checkouts Asaas ativos. Pagamento confirmado antes do
cancelamento preserva a precedência financeira e concede acesso.

Ver [ADR-0009](../adr/0009-course-availability-and-sale-interest.md).

## Evidências

- schema: `orders`, `purchaseConfirmationIntents`, `webhookEvents`, `paymentReviews`, `refundRequests`, `enrollmentGrants`, `enrollments`, `enrollmentExpirationAdjustments`, `enrollmentEvents`;
- implementação: `src/features/payments`, `src/features/enrollments/server.ts`;
- testes: `src/features/payments/*.test.ts`, `src/features/enrollments/*.test.ts`,
  `src/features/admin/enrollment-*.test.ts` e `tests/e2e/critical-journeys.spec.ts`;
- endpoints: `src/app/api/checkouts/course/route.ts`, `src/app/api/webhooks/asaas/route.ts`, `src/app/api/cron/enrollments/route.ts`.

## Decisões e bloqueios

- [ADR-0004](../adr/0004-access-grants-and-enrollment-projection.md), aceito e implementado
  com origens explícitas e razões de revogação neutras.
- [ADR-0005](../adr/0005-financial-precedence-and-manual-review.md), aceito e implementado
  pela decisão pura e pelo processor transacional Asaas.
- `db:seed:student` cria Concessão `manual` e recompõe a Matrícula pela projeção oficial.
- A confirmação de compra guarda somente `orderId` e `userId` na outbox e usa o
  ledger `purchase_confirmation_intents` como dedupe permanente por Pedido, com a
  decisão de verificação congelada na criação da intenção. Desafio de e-mail HMAC
  é persistido sem token/URL e gerado no delivery; nenhum e-mail de compra cria
  senha ou sessão. `auth.account-activation` permanece apenas para v1
  histórico. Veja o [runbook de outbox](../operations/outbox-and-transactional-effects.md).
- Adapter, schema, checkout, inbox, processor, worker agendado, reembolso e conciliação
  Asaas existem em código. As migrations e os fluxos PIX, cartão, cancelamento,
  expiração, reembolso, conciliação e retry após indisponibilidade passaram em
  PostgreSQL descartável e Sandbox antes do novo handoff. O Sandbox não emitiu eventos de risco na compra de
  cartão observada; esse ramo está coberto por testes automatizados. O corte comercial de
  Production aconteceu em 2026-08-21, após o deployment `177259f`, com credencial real
  e webhook ativo. A jornada pública nova passou no servidor Asaas fake, no E2E com
  PostgreSQL e em uma compra PIX Sandbox até a criação da senha, login e abertura do
  Curso.
