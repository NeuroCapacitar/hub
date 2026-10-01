---
status: runbook
owner: operations
last_verified_commit: 6bf5d693fd565c7c4c0c4bd9b7754efca92c2b44
---

# Outbox e efeitos transacionais

## Objetivo

Uma alteração de domínio não chama um provedor externo dentro da transação do banco. Ela grava uma intenção durável em `outbox_messages`; o consumidor entrega essa intenção depois do commit. Isso evita perder um e-mail quando o processo cai entre o commit e a chamada externa.

O contrato está em `src/features/outbox/rules.ts`, a persistência em `src/features/outbox/server.ts`, o consumidor em `src/features/outbox/runner.ts` e o adaptador Resend em `src/features/outbox/delivery.ts`.

Nas operações iniciadas por uma requisição, a intenção continua sendo gravada
antes do commit e o provedor só é chamado depois dele. Quando há uma entrega
que deve ser rápida, a ação agenda `scheduleOutboxDrainAfterResponse` depois
que a transação terminou. Esse drain é limitado a cinco mensagens e quinze
segundos; uma falha não altera nem remove a intenção durável. O cron de outbox
continua sendo a recuperação para indisponibilidade, timeout ou queda do
processo. Em particular, conclusão de aula que emite certificado, suporte,
criação/atualização e reenvio de convites da equipe, alteração de disponibilidade
do curso e comandos administrativos de certificado usam o drain imediato. A
ação agenda o drain somente depois que a transação do convite confirma a intenção
na outbox. A confirmação do e-mail atual numa troca de endereço também agenda o
drain da prova para o novo endereço; a confirmação final agenda os avisos aos dois
endereços. Replays idempotentes não agendam outro drain. Se o agendamento imediato
falhar depois do commit, a rota mantém a confirmação bem-sucedida e registra a
falha; a intenção durável continua recuperável pelo cron. Manutenção de matrículas
e entregas encadeadas do próprio worker permanecem cron/worker-only para evitar
recursão e concorrência desnecessárias.

## Catálogo aprovado

`certificate.render` é idempotente por certificado. A entrega reivindica um Certificado `pending` e `valid` com token persistido e lease de dez minutos, sem manter conexão Postgres durante o trabalho externo. Ela gera o PDF privado e tenta criá-lo com PUT condicional; uma disputa relê o objeto vencedor e usa o hash desses bytes. Depois salva hash e chave R2, muda para `ready` somente se ainda possuir o token e se o Certificado continuar válido, e só então enfileira `email.certificate-issued`. Falha recuperável libera o claim condicionalmente. O lease aplica fencing à conclusão do artefato, não execução exatamente uma vez: depois da expiração pode haver IO duplicado, mas o token antigo não sobrescreve o objeto nem altera o estado final. Uma tentativa repetida encontra o mesmo certificado/artefato e não cria novo documento ou e-mail; a unicidade da chave da outbox torna o enfileiramento do e-mail idempotente.

Falhas inesperadas de `certificate.render` usam o código operacional `certificate_render_failed`; `resend_delivery_failed` fica restrito às entregas que realmente chamam o provedor de e-mail. Ambos são recuperáveis enquanto houver tentativas.

Se a renderização esgota tentativas, uma única instrução transacional e fenced move a
mensagem para `dead_letter` e muda o Certificado ainda `pending`, sem claim ativo, para
`failed`. Se a mensagem já pertence a outro consumidor, nenhuma das duas transições
ocorre. Outros tópicos alteram somente a mensagem. O reprocessamento manual autorizado
devolve o certificado a `pending` antes de reentregar a mesma mensagem.

- `certificate.render`: emitido na transação de emissão; agregado `certificate`; chave `certificate.render/<certificate-id>/v1`; payload somente `certificateId`. Ele é o único evento que pode criar o PDF.
- `email.certificate-issued`: emitido somente pela entrega bem-sucedida de `certificate.render`, depois que o Certificado está `ready`; agregado `certificate`; chave `email.certificate-issued/<certificate-id>/v1`; payload somente `certificateId`.
- `email.access-released`: tópico v1 histórico; agregado `order`; payload
  somente `userId` e `courseId`. Não é publicado para novos Pedidos nem pode
  ser reprocessado manualmente após o corte.
- `email.access-expiry-warning`: emitido pela manutenção de Matrícula; agregado
  `enrollment`; payload v2 fechado com `enrollmentId`, janela `1d`/`7d` e
  `expectedExpiresAt` ISO UTC exato. A chave inclui Matrícula, janela, epoch da
  validade e `/v2`. O epoch precisa corresponder ao payload. Payload v1 é aceito
  apenas para classificação segura e nunca é enviado.
- `auth.account-activation`: tópico v1 histórico do processor Asaas, mantido
  para delivery/supersession seguro durante o corte; agregado `order`; payload
  exatamente `userId` e `orderId`. Novos Pedidos usam
  `email.purchase-confirmed`; reprocessamento manual de v1 foi bloqueado.
- `auth.email-verification`: desafio de cadastro ou confirmação local; agregado
  `account_email_challenge`; chave
  `auth.email-verification/<challenge-id>/<generation>/v1`; payload exatamente
  `challengeId` e `generation`. O delivery relê propósito, geração, prazo,
  destinatário e estado atual; deriva o token HMAC somente ao enviar. A URL
  coloca o token no fragmento do navegador, não na requisição GET, e o `GET`
  apenas apresenta a confirmação. Somente um `POST` explícito consome o desafio
  em transação. Geração antiga, desafio expirado/consumido ou origem não mais
  elegível termina como `superseded`; payload e logs não contêm e-mail, token
  ou URL.
- `auth.staff-invitation`: emitido na transação do convite; agregado
  `staff_invitation`; chave por convite e geração; payload somente
  `invitationId` e `generation`. A entrega relê o convite e o Admin
  convidante, gera o HMAC no último momento e envia um link com token no
  fragmento. Geração vencida/substituída, convite cancelado ou convidante sem
  acesso ativo termina como `superseded`. O preview por POST é somente leitura;
  outro POST explícito consome o convite e aplica a role na mesma transação.
  Nome, e-mail, papel, token e URL não entram no payload da outbox.
- `auth.email-change-confirmation`: intenção por solicitação e geração;
  payload somente `changeRequestId` e `generation`. Primeiro vai ao e-mail
  atual para autorização; só depois vai ao novo e-mail para confirmar posse.
  O token HMAC é reconstruído no delivery e fica no fragmento.
- `email.email-change-notice`: duas intenções por alteração concluída,
  distinguindo somente destinatário `current` ou `new`. Os endereços ficam
  no registro temporário da solicitação e são resolvidos na entrega, não na
  outbox. A alteração e as duas intenções são gravadas na mesma transação;
  sessões anteriores são revogadas e nenhum link autentica.
- `email.purchase-confirmed`: confirmação de um Pedido Asaas `paid`; agregado
  `order`; chave `email.purchase-confirmed/<order-id>/v1`; payload somente
  `orderId` e `userId`. `purchase_confirmation_intents` é a barreira durável
  por Pedido que sobrevive à retenção de 30 dias das mensagens. O ledger só é
  gravado na mesma transação do acesso e do enqueue; `verification_required`
  congela se a pessoa precisava confirmar o endereço quando a intenção nasceu.
  Retry não recalcula essa escolha pelo estado atual da Conta. A entrega usa os
  snapshots do Pedido/Curso para manter destinatário, nome e CTA consistentes.
  Se um Pedido resolvido legado ainda não tiver snapshot de comprador, a mesma
  transação os preenche com a identidade da Conta vinculada; valores presentes
  do checkout/provider nunca são substituídos.
  Desafio perto de vencer só é renovado antes da primeira tentativa ao provider;
  se a manutenção já o removeu antes dessa tentativa, o worker cria outro sob a
  chave única do Pedido. Depois de tentativa externa, desafio ausente não é
  recriado nem rotacionado: token e envelope permanecem estáveis durante a janela
  de idempotência. A migration 0098 registra
  como `historical` Pedidos pagos cuja identidade já estava resolvida, sem copiar PII;
  Pedidos em Revisão continuam elegíveis para confirmação depois da resolução. O publisher normal
  não reenvia esses Pedidos por uma reconciliação tardia. Uma rotina de corte
  explícita pode substituir somente mensagens v1 elegíveis sem aceitação
  confirmada/incerta; ela nunca reabre o ledger histórico após envio/ambiguidade.
- `email.course-sales-opened`: emitido ao abrir vendas; agregado `course_interest`; chave por Interesse; payload somente `interestId`. Vendas novamente fechadas adiam sem consumir tentativa.
- `payments.checkout-cancel`: emitido ao fechar vendas; agregado `order`; chave por Pedido; payload somente `orderId`. Pedido já pago ou Checkout já terminal conclui como no-op.
- `email.support-request`: emitido quando um Aluno envia o formulário de suporte;
  agregado `support_request`; chave `email.support-request/<request-id>/v1`;
  payload somente `requestId`. A ação normaliza e valida antes de conectar, abre
  uma transação, adquire advisory lock por `support-request:<userId>`, conta,
  insere e enfileira pelo mesmo client. Assim quatro requisições simultâneas da
  mesma Conta resultam em três commits e uma rejeição, enquanto Contas diferentes
  usam locks independentes. Assunto continua limitado a 160, mensagem a 1800,
  janela a três pedidos em dez minutos e retenção a 90 dias.

O payload nunca contém nome, e-mail, token de redefinição, senha, chave de API ou URL secreta. O adaptador consulta os dados atuais somente no momento da entrega.

### Confirmação de e-mail

O signup por e-mail não chama `signUpEmail` do Better Auth e não grava senha
antes da confirmação. `pending_signups` contém apenas nome, e-mail, slug interno
validado, geração e prazo; `account_email_challenges` é a autoridade de consumo
único. O primeiro cadastro cria `users` verificado sem credential e sem sessão.
Para Conta legada não verificada, o claim confirmado apaga credenciais e sessões
anteriores antes de atualizar `email_verified`, na mesma transação. O rate limit
armazena apenas hashes HMAC de identidade/IP. O endpoint Better Auth de envio é
mantido como entrada compatível, mas seu callback cria o desafio do Hub; o GET
Better Auth de verificação não altera estado. Redefinição de senha permanece um
fluxo separado e só ocorre por pedido explícito. Em produção, ausência de IP
resolvido pela origem de proxy configurada falha fechado; em desenvolvimento,
o bucket `unknown` continua limitado.

Solicitações de troca de e-mail expiram em uma hora. A linha temporária mantém
os dois endereços somente até a entrega das notificações e, no máximo, por 30
dias depois de um estado terminal; mensagens ainda pendentes, retryable ou em
dead-letter impedem a limpeza até serem concluídas ou superseded. Avatares
privados não referenciados são removidos após a janela de segurança de 24 horas.

### Ativação legada de Conta

`sendPasswordResetEmail` continua no callback do Better Auth para recuperação e
mensagens v1 históricas. A URL contém token secreto e nunca entra na outbox.
O delivery legado de `auth.account-activation` exige Pedido Asaas `paid`,
`orders.user_id` igual ao payload e Conta existente. Ele resolve o e-mail atual da Conta e
chama `requestPasswordReset` com `/redefinir-senha`; se credential já existe, conclui como
no-op sem enviar `email.access-released`.

Antes de chamar Better Auth, o delivery deriva por HMAC-SHA256 uma chave opaca e estável
da `idempotencyKey` da outbox com `BETTER_AUTH_SECRET`. Um header interno transporta
somente essa chave derivada. O callback exige digest e tag HMAC no formato estrito
`auth-account-activation-v1-<digest-hex>-<tag-hex>`, valida a tag com o secret e encaminha
a chave ao Resend somente quando também existe um contexto assíncrono local associado à
mesma chave. Recuperação pública, header ausente, valor forjado ou chave sem contexto
correspondente continuam no caminho normal, sem chave de idempotência.

Better Auth cria e persiste o token, chama o callback e captura qualquer erro de envio
antes de resolver `requestPasswordReset`; Conta inexistente também resolve sem chamar o
callback. Por isso, sucesso da API isoladamente não confirma entrega. O delivery abre um
contexto `AsyncLocalStorage` contendo apenas chave HMAC e resultado, chama a API e exige
que o callback tenha registrado sucesso. Falha de Resend ou allowlist, callback ausente e
Conta não encontrada deixam a intenção retryable como `account_activation_failed`.
Contextos concorrentes são isolados e não guardam e-mail, token, URL ou payload.
Quando o contexto interno está ativo, o callback registra a falha e lança ao Better Auth
somente `account_activation_email_delivery_failed`, sem causa nem mensagem do provedor;
o caminho público continua propagando seu erro original para o tratamento público.

Pedido inelegível usa `aggregate_not_deliverable`, sem retry. Falha do Better Auth usa
`account_activation_failed`, com retry e sem causa ou PII. Este ramo não é
enfileirado para novos Pedidos; o corte o mantém somente para v1 histórica.

## Entrega, concorrência e idempotência

`runOutboxWorker` é chamado por `GET /api/cron/outbox` a cada quinze minutos. A rota exige `Authorization: Bearer <CRON_SECRET>` em produção. O drain iniciado após a resposta reutiliza o mesmo `runOutboxJob`, lease, limite e transições; ele não substitui o cron.
O worker da inbox Asaas é separado da outbox e roda por
`GET /api/cron/asaas-webhooks` a cada quinze minutos, mas reutiliza o mesmo guard de
`CRON_SECRET`, kill switch e padrão de lease/deadline.

- A rota só executa com `SCHEDULED_JOBS_ENABLED=true` e adquire um lease
  persistente por nome de job.
- O worker reivindica uma mensagem por vez e encerra antes do prazo interno da
  função; uma nova execução retoma o backlog.
- O claim é uma atualização atômica com `FOR UPDATE SKIP LOCKED`.
- Cada mensagem recebe lease de dez minutos com `locked_at` e `locked_by`.
- Lease abandonado fica elegível novamente; dois consumidores não devem entregar a mesma linha ativa.
- Toda transição para `delivered`, `retrying`, `dead_letter` ou `superseded` confirma
  `status = processing` e `locked_by` do consumidor. Se a ownership foi perdida, o
  worker retorna `lease_lost` e o runner encerra o lote sem contabilizar a mensagem
  como entregue, adiada, repetida ou morta.
- Nenhuma conexão do pool permanece reservada durante PDFKit, R2 ou Resend.
- Uma mensagem é `delivered` somente depois de o adaptador confirmar a chamada ao Resend.
- `email.certificate-issued` só é criado após o Certificado ficar `ready`; sua mensagem
  aponta para `/app/certificados`, que exige sessão, e não contém URL assinada de PDF.
- Há no máximo cinco tentativas, com backoff exponencial de um minuto e jitter de até 12,5%.
- Versão desconhecida de payload ou agregado não entregável vai para `dead_letter`.
- `superseded` é terminal e separado de falha de entrega. O worker preenche
  `superseded_at`, limpa o lease, preserva `delivered_at` nulo e não incrementa
  tentativa nem cria dead letter. O snapshot operacional conta esse estado sem
  payload.

### Gerações do aviso de expiração

Antes de resolver nome/e-mail e imediatamente antes de chamar Resend, o delivery
relê `status` e `expires_at` sem filtrar Matrícula ativa. A geração é:

- `current`: validade idêntica e janela ainda correta; somente esta envia;
- `changed`: epoch/ISO não corresponde à validade atual;
- `inactive`: Matrícula revogada/expirada ou ausente;
- `expired`: validade já passou;
- `wrong_window`: `7d` fora de 2–7 dias ou `1d` fora de 0–1 dia, pela mesma regra
  UTC do scheduler.

Os quatro últimos resultados geram, respectivamente,
`expiry_generation_changed`, `expiry_inactive` ou `expiry_window_elapsed` e
terminam como `superseded`. Payload v1 termina com `expiry_payload_v1`. Uma
extensão redefine os marcadores da Matrícula; o scheduler cria uma nova chave
v2. Retry da mesma validade preserva a chave.

Depois de promover `0066`, mantenha jobs desligados e execute primeiro:

```powershell
bun run ops:supersede:expiry-warning-v1 -- --environment=staging --dry-run
```

O comando recusa host divergente, URL pooled, migration ausente e qualquer v1
em `processing`. Confira somente as contagens sanitizadas. Para executar no alvo
confirmado, defina `EXPIRY_WARNING_V1_CONFIRMATION` exatamente como
`SUPERSEDE_EXPIRY_WARNING_V1`, troque `--dry-run` por `--execute` e rode uma vez.
Ele altera apenas v1 `pending`/`retrying`, limpa o marcador correspondente em
Matrículas ainda ativas e não toca mensagens entregues. Reative jobs somente
depois de confirmar zero v1 elegível e permitir que o scheduler gere v2.

O adaptador envia a `idempotencyKey` para o Resend. Em
`auth.account-activation`, retries do Better Auth geram novos tokens válidos, mas usam a
mesma chave Resend derivada enquanto a intenção da outbox for a mesma. Como a URL muda, o
Resend responde `invalid_idempotent_request` ao payload diferente dentro de 24 horas; para
uma chave de ativação no formato estrito, o adaptador considera esse resultado satisfeito,
pois a chave confirma que o primeiro e-mail foi aceito e o token anterior permanece
válido. O lifecycle grava esse resultado como terminal `accepted`, mesmo sem um
novo `provider_message_id`; retries seguintes retornam satisfeitos e não chamam
o Resend novamente. Outros erros continuam falhando. Depois de 24 horas o provedor esquece a chave e
um retry pode enviar outro e-mail. A entrega é ao menos uma vez e não promete execução
exatamente uma vez além da janela.

## Dead letter e incidente

Somente Admin pode usar `retryOutbox`. A página **Admin > Operação** lista dead letters sem expor payload. O reprocessamento exige motivo, não permite editar payload e grava `outbox.requeued` em `audit_logs` na mesma transação.

Para `email.support-request`, se a solicitação original já não existir, a
entrega não tenta chamar o Resend: termina como `support_request_unavailable` e
o worker move a mensagem para `superseded`. A tela identifica que o reprocessamento
não é possível e oferece ao Admin a ação explícita **Encerrar sem reprocessar**.
Essa ação é atômica, grava `outbox.superseded` com somente o motivo e preserva no
payload apenas o identificador técnico que já existia; nome, e-mail, assunto e
mensagem nunca são copiados para a Outbox ou para a auditoria.

Depois de 24 horas, o Resend não consegue mais deduplicar a mesma chave. Antes de reprocessar uma mensagem antiga, a administradora deve confirmar o estado do agregado e aceitar explicitamente o risco de e-mail duplicado. Não reprocessar automaticamente um resultado ambíguo.

1. Confira tópico, tentativas, código de erro e data da última tentativa.
2. Confirme que o Certificado ou acesso ainda está válido.
3. Para erro de versão ou agregado ausente, corrija a causa antes de reprocessar.
4. Registre motivo no formulário; o sistema reativa uma vez a mesma mensagem.
5. Confira a próxima execução do cron e o estado final.

Se o tópico for `email.support-request` e a origem tiver sido removida, não há
reenvio possível nem desejável. Confirme `support_request_unavailable` e use
**Encerrar sem reprocessar**; não recrie a solicitação apenas para fazer a
mensagem passar.

A Administração do Hub é a dona operacional de dead letters, inclusive
`auth.account-activation`, e incidentes de e-mail.

Após o corte para `email.purchase-confirmed`, dead letters legadas
`auth.account-activation` e `email.access-released` não podem ser reprocessadas
manualmente, pois seus templates podem reiniciar o fluxo antigo de senha. A
reconciliação do corte só substitui uma mensagem v1 quando não há evidência de
aceitação; `accepted`, `acceptance_unknown`, `processing` e `delivered` nunca
geram uma segunda confirmação. Os tópicos v1 permanecem registrados para
entrega/supersession segura durante o rollout.
O backfill 0098 não cobre mensagens v1 criadas depois da migration: a rotina
também inventaria Pedidos sem linha no ledger, mantém estados aceitos/ambíguos
sem um novo envio e bloqueia as linhas que vai reconciliar. Siga o procedimento
de dry-run, execução e drenagem em
[Banco e migrations](database-and-migrations.md).

Essa seção de dead letter descreve a **Outbox**. Eventos de lifecycle recebidos
do Resend possuem uma inbox separada, `resend_webhook_events`, com estados e
causas próprias. Um dead letter Resend significa que o evento externo não foi
reconciliado localmente ou chegou com schema inválido; não significa que exista
uma mensagem da Outbox aguardando reprocessamento. O detalhe técnico e o replay
do evento podem ser feitos no portal Resend, mas a correção de correlação,
intenção ou estado local pertence ao Hub.

## Retenção

Cada execução do consumidor remove:

- mensagens `delivered` há mais de 30 dias;
- mensagens `dead_letter` cuja última falha tem mais de 180 dias;
- mensagens `superseded` há mais de 30 dias;
- auditorias `outbox.requeued` e `outbox.superseded` com mais de 180 dias.

Essa retenção cobre somente a outbox e sua auditoria operacional. Não autoriza apagar auditorias financeiras, dados de Conta ou outros registros sujeitos a política jurídica própria.

O job de maintenance também minimiza o ciclo de vida de cadastro: apaga
`pending_signups` expirados e pendências em estado terminal com mais de uma hora,
remove desafios de e-mail consumidos ou vencidos e elimina rate limits quando a
janela HMAC expira. Uma confirmação de signup apaga imediatamente a pendência
que continha nome/e-mail; a Conta final mantém os dados necessários. Desafio
expirado removido da tabela não pode ser reproduzido mesmo que a mensagem
idempotente da outbox ainda exista. No evento `maintenance.executed`,
`directAccountEmailChallengesRemoved` conta apenas deleções diretas; desafios
removidos por cascade ao apagar uma pendência não são somados novamente.

Todos os tópicos usam a outbox existente. `auth.account-activation` é classificado como
payload sem PII por conter somente identificadores locais; segue a mesma retenção de 30
dias para `delivered` e 180 dias para `dead_letter`.

## Evidências

- schema e migrations: `outboxMessages` em `src/db/schema.ts`,
  `0023_lyrical_lucky_pierre.sql`, `0024_light_stature.sql` e
  `0066_gifted_retro_girl.sql`, `0097_identity_email_challenges.sql` e
  `0098_purchase_confirmed_email.sql`;
- transações: `completeLesson`, `processAsaasWebhookEvent` e `processEnrollmentMaintenance`;
- testes: `src/features/outbox/*.test.ts`, `outbox.integration.test.ts`,
  `expiry-warning.integration.test.ts`, `server.integration.test.ts` de suporte e
  `certificate-issuance.integration.test.ts`;
- idempotência de ativação: `src/lib/account-activation-idempotency.ts`,
  `src/lib/auth-password-reset.ts` e testes correspondentes;
- drain imediato: `src/features/outbox/background-drain.ts` e os testes das ações
  de aluno, disponibilidade de curso e certificado;
- provedor: [documentação de idempotência da Resend](https://resend.com/docs/dashboard/emails/idempotency-keys).

Todo tópico novo precisa definir versão de payload, chave idempotente, dona operacional, retenção, classificação de PII e runbook antes de ser gravado na outbox.
