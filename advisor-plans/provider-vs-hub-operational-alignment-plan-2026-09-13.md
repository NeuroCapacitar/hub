---
status: in-progress
owner: product-and-engineering
plan_date: 2026-09-13
repository_branch: staging
repository_commit: 2bfcf38e7f33762c31a1e89ab71281ae7259057a
research: provider-vs-hub-operational-responsibility-research-2026-09-13.md
---

# Plano de alinhamento operacional entre Hub, Resend e JMVStream

## Objetivo

Estabelecer e implementar uma fronteira simples entre o que o Hub deve
controlar e o que deve ser resolvido nos portais Resend e JMVStream.

O resultado desejado é um painel administrativo que:

- preserve no Hub somente o contexto necessário para o negócio, a correlação,
  a idempotência, o último estado conhecido e a auditoria;
- não tente reproduzir as consoles técnicas dos provedores;
- indique claramente quando a próxima ação é no Hub ou no provedor;
- encaminhe o Admin ao portal correto para detalhes, logs, replay ou correção
  técnica;
- não esconda falhas locais atrás de um link externo;
- não transforme uma falha de notificação em bloqueio de acesso, Certificado,
  Curso ou Aula.

Este plano é de alinhamento e implementação posterior. Nenhuma alteração de
código é autorizada por este arquivo sozinho.

## Status da implementação — 2026-09-13

O plano foi autorizado e está em execução na branch `codex/provider-boundary`.
Os Sprints 0, 1 e 2 foram implementados localmente:

- ownership entre Hub, Resend e JMVStream foi registrado no ADR-0013,
  `CONTEXT.md` e nos runbooks relacionados;
- o snapshot passou a separar `emailDelivery.resendWebhook` de outras métricas;
- a idade do dead letter Resend passou a ser calculada separadamente da idade de
  retry;
- a severidade de uma ocorrência Resend isolada passou de crítico para alta
  prioridade;
- foi criada a leitura paginada e sanitizada de
  `resend_webhook_events` em dead letter;
- o Admin passou a exibir uma seção própria para eventos Resend, com tipo,
  motivo, tentativas, datas, correlação e link para o Dashboard Resend;
- alertas no Dashboard e em Operação passaram a apontar para a seção correta;
- Outbox, eventos Resend, webhooks Asaas e JMVStream continuam sendo
  superfícies separadas;
- foram adicionados testes para provar que um dead letter Resend pode existir
  sem uma mensagem dead letter na Outbox.

O Sprint 3 não criou retry ou replay local. A decisão depende de consultar os
registros reais de Production e de distinguir `invalid_event_schema` de
`email_message_unresolved`. O Sprint 4 não exigiu alteração de código: a
integração JMV já mantinha estado local mínimo e linkava o Admin ao portal
externo. O Sprint 5 de PR, Staging e Production ainda não foi executado nesta
branch.

Não foram alterados schema, payloads armazenados, credenciais, envio de e-mail,
templates, contrato de upload JMV ou regras de acesso/Certificado. Nenhum
commit, push ou deploy foi feito nesta etapa.

## Decisão proposta

Adotar o modelo **Hub-orientador, provedor-executor**.

### O Hub é dono de

- intenção de negócio: se o e-mail deveria ser enviado e qual operação o
  originou;
- vínculo com Conta, Pedido, Matrícula, Curso, Aula ou Certificado;
- publicação e disponibilidade do conteúdo;
- associação entre um vídeo externo e uma Aula;
- projeção local mínima do estado do provedor;
- correlação, idempotência, leases e retries necessários para sobreviver a
  falhas do próprio Hub;
- decisão sobre impacto no produto;
- auditoria de ações administrativas;
- indicação do próximo destino operacional.

### O Resend é dono de

- aceitação técnica da mensagem;
- entrega no servidor destinatário;
- bounce, supressão, reclamação e atraso;
- reputação, domínio, DNS, limites e logs de entrega;
- detalhes completos do e-mail;
- tentativas e replay de webhook no portal do provedor.

### A JMVStream é dona de

- armazenamento e processamento externo do vídeo;
- conversão, codec, player e thumbnail;
- estado técnico do ativo externo;
- detalhes de erro de upload e transcodificação;
- logs e operações específicas do provedor.

### Responsabilidade compartilhada

O Hub recebe eventos do provedor, valida assinatura, persiste uma evidência
mínima, processa de forma assíncrona e atualiza uma projeção local. O provedor
continua sendo a autoridade sobre sua execução técnica; o Hub continua sendo a
autoridade sobre a relação dessa execução com o negócio.

## Por que não usar somente o portal do provedor

O endpoint do webhook Resend grava o evento e responde HTTP 200 antes do
processamento em segundo plano. Se o worker falhar depois disso, o Resend pode
considerar o webhook entregue e não repetir a entrega automaticamente. A
inbox local `resend_webhook_events` é necessária para que o Hub não perca o
evento aceito.

O mesmo princípio vale para JMVStream: uma operação iniciada pelo Hub, como
upload, sincronização ou exclusão, precisa de um registro local para sobreviver
a timeout, queda da aplicação e processamento assíncrono. Isso não transforma
o Hub em uma cópia do portal; transforma a operação local em uma intenção
durável e reconciliável.

## Evidência do problema atual

O alerta `email_delivery_dead_letter` conta:

```sql
select count(*)
from resend_webhook_events
where status = 'dead_letter'
```

Esse cálculo está em `getOperationalBacklogSnapshot`, em
`src/features/operations/server.ts`.

A tabela apresentada como “Mensagens em dead letter” consulta outra fonte:

```sql
select ...
from outbox_messages
where status = 'dead_letter'
```

Essa consulta está em `listOutboxDeadLetters`, em
`src/features/outbox/server.ts`.

`getAdminOperationsData`, em `src/features/admin/server.ts`, carrega o
indicador Resend, a lista da Outbox e a lista de webhooks Asaas como coleções
independentes. Não há uma lista administrativa de
`resend_webhook_events` em `dead_letter`.

Consequentemente, o estado abaixo é possível e atualmente esperado pelo
código:

```text
Eventos Resend em dead letter: 1
Mensagens da Outbox em dead letter: 0
```

O alerta aparece, mas a tabela de Outbox fica vazia. Isso é um defeito de
observabilidade e navegação, não uma justificativa para remover a inbox local
ou trocar o contador para a Outbox.

Há ainda uma segunda inconsistência: o contexto de idade do alerta de dead
letter usa `oldestRetryAt`, que representa somente eventos em `retrying`. O
snapshot não calcula a data do evento Resend dead letter mais antigo.

## Comportamento que deve permanecer

Não alterar, como parte deste plano:

- validação da assinatura Svix do webhook Resend;
- resposta rápida do endpoint e processamento assíncrono;
- deduplicação por `provider_event_id`/`svix-id`;
- ordenação por timestamp e precedência do lifecycle;
- projeção em `email_messages`;
- idempotência do envio da Outbox;
- separação entre `outbox_messages`, `resend_webhook_events` e
  `email_messages`;
- bloqueio de publicação de Aula sem player JMV pronto;
- vínculo local entre Aula e ativo JMVStream;
- retries locais necessários para operações iniciadas pelo Hub;
- ausência de payload completo, token, URL assinada e PII nas telas e logs.

## Escopo funcional aprovado para a próxima implementação

### 1. Contrato de ownership e vocabulário

Criar um ADR com o próximo número disponível após ADR-0012, depois de uma
checagem de drift, registrando:

- Provedor como autoridade da execução técnica;
- Hub como autoridade do negócio e da correlação;
- projeção local como último estado conhecido, não como cópia do Dashboard;
- regra para encaminhar problemas ao provedor;
- regra para manter no Hub falhas de intenção, associação, idempotência,
  publicação ou auditoria;
- distinção entre envio do e-mail, entrega do e-mail, entrega do webhook e
  processamento local do webhook.

Atualizar `CONTEXT.md` somente com termos de domínio, sem detalhes de
implementação. Os termos mínimos a avaliar são:

- Estado do provedor;
- Projeção de integração;
- Evento de provedor não reconciliado;
- Operação pertencente ao provedor;
- Operação pertencente ao Hub.

Atualizar os documentos canônicos relacionados:

- `docs/architecture.md`;
- `docs/integrations/resend.md`;
- `docs/integrations/jmvstream.md`;
- `docs/operations/outbox-and-transactional-effects.md`;
- `docs/operations/observability-and-recovery.md`;
- `docs/README.md`, se o novo ADR ou o novo contrato exigir inclusão no mapa.

Os documentos devem explicar a ação seguinte, não apenas descrever tabelas.

### 2. Projeção operacional explícita

Refinar o contrato de `OperationalBacklogSnapshot` sem alterar o schema por
conveniência. O nome do campo deve deixar claro que o contador pertence à
inbox Resend, por exemplo `resendWebhookDeadLetters`, ou um objeto
`resendWebhook` separado.

O contrato final deve conter, no mínimo:

- quantidade de eventos Resend em dead letter;
- data do evento Resend dead letter mais antigo;
- quantidade de eventos Resend em retry;
- data do retry mais antigo;
- quantidade e idade da Outbox em dead letter;
- quantidade e idade da Outbox pronta ou atrasada.

Não renomear tabelas, estados ou migrations existentes sem necessidade. A
mudança de nomenclatura é de projeção e apresentação; o estado persistido
continua sendo o contrato atual.

### 3. Fila mínima de eventos Resend no Admin

Adicionar uma leitura administrativa específica para
`resend_webhook_events where status = 'dead_letter'`.

A leitura deve:

- exigir a mesma permissão de auditoria global usada pela página de Operação;
- aceitar paginação estável;
- ordenar pelo estado mais recente de investigação, depois pela data do evento;
- retornar apenas metadados seguros;
- nunca retornar payload bruto, destinatário, assunto, corpo, token, URL ou
  credencial;
- expor o código seguro da falha (`invalid_event_schema` ou
  `email_message_unresolved`), o tipo, tentativas, datas e indicadores de
  correlação;
- permitir identificar o evento no portal Resend sem exibir informação
  sensível.

O nome da seção deve ser “Eventos Resend em dead letter” ou “Eventos Resend
que precisam de investigação”, e não “Mensagens da Outbox”.

### 4. Navegação correta

Alterar os destinos dos alertas:

- alerta de Outbox dead letter => seção da Outbox;
- alerta de evento Resend dead letter => seção de eventos Resend;
- alerta de retry Resend => seção de eventos Resend;
- alerta JMV => seção de saúde JMV e portal JMVStream;
- alerta Asaas => seção de webhooks Asaas.

O Dashboard deve apontar para a seção específica, não somente para o topo de
`/admin/operacao`.

Adicionar um link externo para o Dashboard Resend, usando destino estável e
verificado. Se não houver deep link confiável para um evento, usar a página
geral de Webhooks e mostrar o identificador seguro que a operadora deve
consultar. Não inventar URL de detalhe do provedor.

Manter o padrão já usado para JMVStream em
`src/app/(admin)/admin/operacao/page.tsx`: link externo, `target="_blank"` e
`rel="noopener noreferrer"`.

### 5. Política de ação

Na primeira versão da correção, não criar um botão de retry genérico para todo
evento Resend dead letter.

Classificar a ação pelo motivo:

- `invalid_event_schema`: abrir Resend para verificar o evento e o contrato;
  não oferecer replay cego, porque o Hub não armazenou o payload completo e o
  mesmo formato pode falhar novamente;
- `email_message_unresolved`: revisar no Hub a mensagem e a correlação; só
  depois avaliar replay no Resend ou reprocessamento local;
- falha de Outbox: usar a recuperação local existente, depois de confirmar o
  agregado e aceitar risco de duplicidade;
- bounce, suppress, failed ou delayed do e-mail: consultar o detalhe no
  Resend; corrigir no Hub endereço, regra ou operação quando o problema for de
  negócio;
- processamento/codec/thumbnail JMV: consultar e resolver na JMVStream;
- vínculo Aula/ativo, publicação ou remoção iniciada pelo Hub: resolver no
  Hub e reconciliar com a JMVStream.

Qualquer retry ou replay que possa repetir efeito externo deve exigir motivo,
ser idempotente quando possível, registrar auditoria e deixar explícito se a
ação ocorre no Hub ou no provedor.

### 6. Severidade dos alertas

Não manter automaticamente “crítico” para qualquer evento isolado sem antes
separar impacto técnico de impacto de negócio.

Recomendação inicial:

- evento Resend isolado não reconciliado => atenção ou alta prioridade;
- acúmulo persistente, falha generalizada do worker ou impacto em notificações
  críticas => crítico;
- Outbox que impede um efeito local essencial => seguir o nível crítico já
  aprovado para essa fila;
- falhas individuais de entrega do provedor => mostrar estado e link, sem
  bloquear o negócio.

Os limites quantitativos e temporais devem ser definidos a partir de uma linha
de base real ou mantidos como decisão explícita. Não introduzir número mágico
somente para silenciar o alerta.

## Sprints recomendados

### Sprint 0 — Ratificar o contrato e documentar

Dependências: nenhuma.

Entregas:

1. Confirmar o ADR-0013 ou próximo número disponível.
2. Atualizar termos de `CONTEXT.md` sem colocar implementação no glossário.
3. Atualizar arquitetura, integração Resend, integração JMV e observabilidade.
4. Registrar o que é “último estado conhecido” e o que é autoridade externa.
5. Registrar a política de severidade e a política de replay.

Critério de aceite: uma pessoa operadora consegue decidir, lendo os
documentos, se deve abrir o Hub, o Resend ou a JMVStream para cada cenário sem
interpretar nomes de tabelas.

Verificação:

```text
bun run docs:check
```

Resultado esperado: documentação canônica válida e mapa sem referência
quebrada.

### Sprint 1 — Corrigir o modelo de leitura operacional

Dependência: Sprint 0.

Entregas:

1. Tornar explícito no snapshot que o indicador é da inbox Resend.
2. Calcular `oldestResendWebhookDeadLetterAt` separadamente de
   `oldestResendWebhookRetryAt`.
3. Manter Outbox, Resend e Asaas como filas distintas.
4. Atualizar os testes de `src/features/operations/server.test.ts` para provar
   o caso em que existe dead letter Resend e zero dead letter Outbox.
5. Garantir que a severidade escolhida no ADR seja aplicada somente ao tipo de
   sinal correto.

Critério de aceite: o snapshot nunca usa a idade de retry para representar
dead letter Resend, e nenhum contador troca de tabela para fazer a tela parecer
vazia.

Verificação:

```text
bun run test -- src/features/operations/server.test.ts
bun run typecheck
bun x ultracite check
```

Resultado esperado: testes, TypeScript e Ultracite aprovados.

### Sprint 2 — Criar a superfície mínima Resend

Dependência: Sprint 1.

Entregas:

1. Criar query/read model paginado para eventos Resend dead letter.
2. Integrar o read model a `getAdminOperationsData`.
3. Criar seção compacta no Admin > Operação.
4. Mostrar tipo, motivo, tentativas, datas e correlação segura.
5. Adicionar link para o Dashboard Resend, sem transportar credencial ou PII.
6. Deixar claro que “aceito”, “entregue”, “evento recebido” e “processado
   localmente” são estados diferentes.
7. Não exibir payload nem criar retry genérico nesta etapa.

Critério de aceite: quando o alerta de Resend estiver ativo, a operadora
consegue ver a fila correspondente ou abrir o Resend; a tabela de Outbox não é
apresentada como resposta para esse alerta.

Verificação:

```text
bun run test -- src/app/(admin)/admin/operacao/page.test.tsx src/features/admin/server-read-projections.test.ts
bun run typecheck
bun x ultracite check
```

Resultado esperado: a página renderiza separadamente Outbox, Resend, Asaas e
JMV; testes de leitura e acessibilidade permanecem aprovados.

### Sprint 3 — Resolver a política de recuperação

Dependência: Sprint 2 e análise de registros reais de Production.

Entregas:

1. Consultar registros sanitizados e classificar ocorrências por código.
2. Para `email_message_unresolved`, verificar se há uma associação local que
   possa ser corrigida com segurança.
3. Para `invalid_event_schema`, verificar o contrato do evento no Dashboard e
   no endpoint, sem armazenar payload.
4. Decidir se o primeiro mecanismo será replay no Resend, reprocessamento local
   ou somente reconhecimento/auditoria.
5. Implementar apenas a ação aprovada, com permissão de Admin, motivo,
   idempotência e auditoria.
6. Adicionar testes para corrida, duplicata, evento já processado e evento sem
   mensagem local.

Critério de aceite: nenhum botão de recuperação pode repetir envio ou alterar
estado sem indicar seu dono, sua consequência e sua evidência de auditoria.

Verificação:

```text
bun run test -- src/features/email-delivery/resend-webhook.test.ts src/features/email-delivery/worker.test.ts src/features/email-delivery/server.test.ts
bun run test -- src/features/outbox/server.test.ts src/features/outbox/worker.test.ts
bun run typecheck
```

Resultado esperado: a recuperação aprovada converge o estado local sem criar
duplicata silenciosa.

### Sprint 4 — Refinar a experiência JMVStream

Dependência: Sprint 0; pode ocorrer em paralelo com Sprint 2 se não houver
alteração compartilhada no read model.

Entregas:

1. Manter o padrão atual de métricas locais mais link para o portal JMVStream.
2. Diferenciar no texto “pendência local” de “detalhe técnico no provedor”.
3. Confirmar se o link genérico do portal é suficiente ou se existe deep link
   estável por ativo.
4. Revisar se a consulta de saúde ao provedor deve ter timeout, cache curto ou
   atualização explícita, para que uma indisponibilidade JMV não torne o painel
   administrativo lento.
5. Não duplicar logs de conversão nem controles técnicos da JMVStream.

Critério de aceite: upload, processamento, associação, publicação e exclusão
indicam claramente o sistema responsável pela próxima ação.

Verificação:

```text
bun run test -- src/features/jmvstream/*.test.ts src/app/(admin)/admin/operacao/page.test.tsx
bun run typecheck
```

Resultado esperado: as métricas locais e o link externo continuam funcionando
sem alterar o contrato de upload multipart.

### Sprint 5 — Verificação e rollout

Dependência: Sprints 0 a 3; Sprint 4 se houver mudança JMV.

Entregas:

1. Rodar todas as verificações locais.
2. Abrir PR para `staging` pelo fluxo de release vigente.
3. Validar em Staging com registros controlados, sem destinatário real fora da
   allowlist.
4. Confirmar que o alerta Resend aponta para a seção Resend e o alerta Outbox
   aponta para a Outbox.
5. Confirmar link externo, permissão, ausência de payload e comportamento em
   lista vazia.
6. Registrar a evidência no runbook e no ADR.
7. Promover para Production somente pelo fluxo normal, após CI verde e
   autorização explícita.

Verificação mínima:

```text
bun run test
bun run typecheck
bun x ultracite check
bun run docs:check
bun run verify:quick
```

Se o ambiente descartável de E2E estiver disponível, executar também a suíte
Chromium. Sem `E2E_DATABASE_URL` e fixture autorizada, registrar a lacuna sem
apontar para banco compartilhado.

## Arquivos prováveis

### Documentação

- `advisor-plans/provider-vs-hub-operational-responsibility-research-2026-09-13.md`;
- este plano;
- `advisor-plans/README.md`;
- `CONTEXT.md`;
- `docs/architecture.md`;
- `docs/integrations/resend.md`;
- `docs/integrations/jmvstream.md`;
- `docs/operations/outbox-and-transactional-effects.md`;
- `docs/operations/observability-and-recovery.md`;
- `docs/adr/0013-*.md`, usando o próximo número disponível.

### Leitura operacional e UI

- `src/features/operations/server.ts`;
- `src/features/operations/server.test.ts`;
- `src/features/admin/server.ts`;
- `src/features/admin/server-read-projections.test.ts`;
- `src/app/(admin)/admin/(dashboard)/page.tsx`;
- `src/app/(admin)/admin/operacao/page.tsx`;
- `src/app/(admin)/admin/operacao/page.test.tsx`.

### Resend

- `src/features/email-delivery/resend-webhook.ts`;
- `src/features/email-delivery/worker.ts`;
- `src/features/email-delivery/runner.ts`;
- `src/features/email-delivery/server.ts`;
- `src/features/email-delivery/*.test.ts`;
- `src/app/api/webhooks/resend/route.ts`;
- `src/app/api/cron/resend-webhooks/route.ts`.

### JMVStream

- `src/features/jmvstream/server.ts`;
- `src/features/jmvstream/asset-persistence.ts`;
- `src/features/jmvstream/asset-deletion.ts`;
- `src/features/jmvstream/player-sync.ts`;
- `src/app/api/cron/jmvstream/route.ts`;
- `src/features/jmvstream/*.test.ts`.

## Fora do escopo

- substituir Resend ou JMVStream;
- criar uma console completa do Resend ou da JMVStream dentro do Hub;
- armazenar payload bruto, conteúdo de e-mail, destinatários ou URLs assinadas;
- alterar templates, domínio, DNS, reputação ou credenciais do Resend;
- criar webhook JMVStream sem contrato oficial validado;
- trocar polling JMV por webhook sem prova controlada;
- alterar o fluxo de conclusão, Certificado, acesso ou publicação;
- mudar a Outbox para depender do Dashboard Resend;
- limpar ou apagar registros de Production para fazer o alerta desaparecer;
- usar `db:push`, `db:reset`, alteração manual de Production ou mutação direta
  de tabelas;
- promover para `main` ou Production como parte deste plano.

## Riscos e salvaguardas

### Risco: esconder uma falha local atrás do link Resend

Salvaguarda: manter lista mínima local, código seguro de erro, correlação e
estado conhecido antes de oferecer o link externo.

### Risco: criar duplicatas ao permitir replay

Salvaguarda: não oferecer retry genérico na primeira versão; exigir confirmação
do agregado, idempotência quando possível, motivo e auditoria.

### Risco: o provedor não ter deep link estável

Salvaguarda: verificar a URL no portal; usar link geral e identificador seguro
para busca quando necessário.

### Risco: painel ficar dependente da disponibilidade do provedor

Salvaguarda: manter o snapshot local como base; tratar consulta externa como
enriquecimento com timeout ou atualização explícita.

### Risco: severidade gerar ruído

Salvaguarda: distinguir ocorrência isolada de falha sistêmica e revisar a
severidade com base em linha de base real.

### Risco: documentação e código divergirem

Salvaguarda: atualizar ADR, glossário, runbook e testes na mesma mudança e
rodar `bun run docs:check`.

## Critérios finais de conclusão

O plano só será considerado implementado quando todos estes pontos forem
verdadeiros:

- o alerta Resend e a fila Resend consultam a mesma fonte;
- o alerta Outbox e a fila Outbox consultam a mesma fonte;
- o botão “Abrir fila” leva à seção correspondente;
- a operadora sabe quando abrir Hub, Resend ou JMVStream;
- a tela não apresenta uma falha técnica do provedor como mensagem vazia da
  Outbox;
- o estado local é explicitamente apresentado como projeção/último estado
  conhecido;
- o Hub não replica logs, payloads ou controles do provedor;
- retries têm dono, consequência, autorização e auditoria;
- falha de e-mail não bloqueia Certificado, acesso ou conteúdo;
- o fluxo JMV mantém associação e publicação no Hub e detalhes técnicos na
  JMVStream;
- testes cobrem os estados independentes e o caso que originou o alerta atual;
- CI, TypeScript, Ultracite e documentação passam;
- a alteração foi promovida por PR para `staging`, sem push direto em branch
  protegida.

## Dependências e pontos de parada

Pare e peça revisão de produto antes de continuar se:

- o registro real de Production tiver motivo diferente dos dois códigos
  atualmente previstos;
- a correção exigir armazenar payload ou dado pessoal;
- a ação de replay puder enviar uma mensagem nova, e não apenas reaplicar
  estado;
- o Dashboard Resend não permitir identificar o evento com segurança;
- a API JMV exigir mutação manual que contradiga a associação local;
- a severidade mudar de aviso para bloqueio de negócio;
- surgir necessidade de migration ou alteração de schema não prevista.

## Ordem recomendada

`Sprint 0 → Sprint 1 → Sprint 2 → Sprint 3 → Sprint 5`

`Sprint 4` pode ocorrer em paralelo com `Sprint 2`, desde que não altere o
contrato compartilhado de `OperationalBacklogSnapshot` sem coordenar a revisão.
