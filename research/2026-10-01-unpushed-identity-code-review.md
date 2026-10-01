# Revisão das alterações de identidade ainda fora de Staging

Data: 2026-10-01, America/Sao_Paulo.

## Parecer

**Não recomendar promoção para Production neste estado.** A arquitetura escolhida atende à direção do produto, mas há falhas de segurança, integração financeira e transição operacional que precisam ser corrigidas. Testes e build verdes não cobrem esses contratos.

Escopo fixado após consulta e fetch da referência remota:

- Staging remoto: `a02df60a517ee4d8072beb6d13365b37a61734cc`.
- Base comum: `abb3b3ecae681dd5eea4da839ace41e2b926431c`.
- Candidato: `6bf5d693`, único commit da branch ausente de Staging.
- Comparação: `git diff abb3b3ec...6bf5d693`; 180 arquivos, 56.362 inserções e 2.131 remoções. Grande parte das inserções é snapshot de migration.
- Requisitos: plano aceito `docs/superpowers/plans/2026-09-29-identity-onboarding-profile.md`, guias de identidade/comércio/outbox e solicitações posteriores sobre Configurações.

Revisão por quatro agentes independentes, conferência pelo agente principal, leitura do Better Auth 1.6.25 instalado e consulta de documentação atual pelo Context7. Nenhuma correção de aplicação, commit, push, migration ou deploy nesta revisão. Nenhum navegador ou URL local aberto; nenhum banco ou storage real acessado.

## Achados novos e de integração

P1 exige correção antes de release. P2 representa falha funcional ou regressão relevante; as de fluxo devem ser corrigidas antes da homologação final. Referências de linha correspondem ao candidato revisado.

### F01 — P1: recuperação antiga continua válida depois da troca de e-mail

Local: `src/features/account/email-change.ts:814`, `:841`; Better Auth instalado em `node_modules/better-auth/dist/api/routes/password.mjs`.

Solicitar recuperação no endereço antigo, concluir as duas provas de troca e consumir o reset ainda válido permite alterar a senha da Conta já associada ao endereço novo. O token Better Auth identifica somente o `userId`; a conclusão da troca revoga sessões, mas não invalida `verifications`. Isso também permite criar a primeira senha em uma Conta Google-only. Uma reprodução em memória do handler instalado confirmou a alteração.

Correção: invalidar recuperações anteriores e associar emissão/consumo à identidade atual, contemplando solicitações concorrentes. Apagar somente sessões não fecha esse caminho. Testar reset iniciado antes da troca, reset iniciado durante ela e reset solicitado ao novo endereço depois da conclusão.

### F02 — P1: o índice canônico novo quebra a resolução de algumas compras

Local: `src/db/migrations/0097_identity_email_challenges.sql:100`; `src/features/payments/order-identity.ts:76`, `:227`; lookup Google em `src/lib/auth.ts:98` também precisa ser alinhado.

Exemplo: Conta existente com `first.last@gmail.com`; compra pública chega como `firstlast@gmail.com`. O lookup compara `lower(email)` com as strings original e normalizada, não a função canônica aplicada ao endereço armazenado. Não encontra a Conta e tenta inserir outra. O `ON CONFLICT (lower(email))` não trata a colisão no novo índice `users_email_identity_unique_idx`.

Resultado: violação `23505`, rollback do processamento e ausência de Concessão/confirmacão naquele processamento; a repetição mantém a causa. A rota foi confirmada por simulação do query client. É uma incompatibilidade introduzida pela nova restrição, inclusive relevante durante a janela em que a migration já existe e o deployment anterior ainda atende tráfego.

Correção: aplicar o mesmo resolvedor canônico a compra, Google e demais entradas; tratar disputas de inserção por releitura e validação do candidato, sem merge automático. Testar pontos, `+tag`, Googlemail e disputa entre signup/compra. Atende REG-IDA-001.

### F03 — P1: o comando de transição dos e-mails legados não inicia

Local: `package.json:125`.

`bun run ops:reconcile:legacy-purchase-confirmations` importa um módulo `server-only` sem `--conditions=react-server`. Falha antes de validar argumentos ou conectar ao banco. Reproduzido: `This module cannot be imported from a Client Component module.` Dry-run e execução ficam indisponíveis.

Correção: ajustar o comando conforme os outros scripts operacionais server-side e testar o entrypoint real, além de testes do módulo com mocks.

### F04 — P1: a consulta da transição usa comparação SQL incompatível

Local: `src/tooling/purchase-confirmation-cutover.ts:226`.

`email_status` é `email_message_status`, um enum PostgreSQL, mas a expressão compara com `ANY($1::text[])`. Não existe operador de igualdade enum/text correspondente. Tanto dry-run quanto execução chegam a essa consulta antes de reconciliar. O problema foi comprovado pelo schema e pela consulta; não foi executado em banco nesta revisão.

Correção: cast consistente da coluna ou do array e teste com PostgreSQL real. A [documentação de enums do PostgreSQL](https://www.postgresql.org/docs/current/datatype-enum.html#DATATYPE-ENUM-TYPE-SAFETY) explica a necessidade de tipos compatíveis.

### F05 — P2: o inventário de transição perde compras posteriores ao backfill

Local: `src/tooling/purchase-confirmation-cutover.ts:209`, `:257`; migration 0098.

A migration registra os Pedidos pagos existentes. Se o deployment anterior processar outro pagamento após esse backfill, publica v1 sem uma linha no ledger novo. Inventário e seleção começam exclusivamente no ledger histórico e não encontram esse Pedido. Podem declarar o lote concluído com mensagens antigas ainda pendentes; o código novo também bloqueia retry manual dos tópicos v1.

Correção: inventariar os tópicos legados independentemente da existência de ledger e classificá-los em transação. Documentar e testar a janela migration → promoção, incluindo workers anteriores em atividade.

### F06 — P2: dry-run exclui mensagens nunca tentadas

Local: `src/tooling/purchase-confirmation-cutover.ts:226`.

Após corrigir F04, a comparação com `email_status = NULL` produz NULL; `bool_or(false OR NULL)` fica NULL para mensagem pendente sem registro de entrega. `replaceable AND NOT ambiguous` deixa de contar o Pedido, embora o modo execute possa substituí-lo.

Correção: tratar ausência de evidência de aceitação explicitamente, com `coalesce` apropriado. O teste deve conferir que a previsão corresponde às mutações executadas para status NULL, failed, aceito e incerto.

### F07 — P2: várias solicitações de e-mail não acionam entrega rápida

Locais: `src/app/api/account/registrations/route.ts:46`; `src/app/api/auth/[...all]/route.ts` em `handleVerificationEmailRequest`; `src/features/admin/staff-invitation-actions.ts:29`; `src/app/api/account/email-changes/consume/route.ts:52`.

Cadastro, reenvio de confirmação no login, criação/reenvio de convite e a segunda etapa da troca de endereço só enfileiram. O mecanismo existente `scheduleOutboxDrainAfterResponse` não é chamado nessas fronteiras. Sem outra atividade que esvazie a fila, a entrega espera o cron de 15 minutos em Production; Staging depende do job manual. Na troca, a primeira solicitação possui drain, mas a confirmação que enfileira a segunda prova não.

Correção: agendar entrega limitada depois do commit nas fronteiras de requisição que geraram mensagens. Preservar a intenção durável e o cron de recuperação. Não chamar o provider dentro da transação.

### F08 — P2: expiração da prova pode eliminar a confirmação da compra

Local: `src/features/outbox/delivery.ts:530`; `src/features/payments/purchase-confirmation.ts:122`, `:190`.

O desafio da compra vence uma hora depois do enqueue. Se a primeira entrega atrasar, ou o provider falhar até depois dessa janela, o worker classifica a confirmação inteira como `superseded`. O ledger `current` impede novo enqueue. Uma compra paga pode ficar sem o e-mail de confirmação, não apenas com um link vencido.

Correção: garantir que o ciclo da prova não descarte o recibo de compra. Renovação antes da primeira tentativa pode ser transacional; depois de uma tentativa é necessário respeitar estabilidade do payload e resultado incerto (F09). Cobrir backlog, indisponibilidade, maintenance removendo o desafio e retry tardio. CodeRabbit confirmou o achado.

### F09 — P2: retry da mesma compra pode reconstruir outro payload

Local: `src/features/outbox/delivery.ts:526`; contrato em `src/features/email-delivery/server.ts:220`.

Primeira tentativa com Conta não verificada usa `Confirmar e-mail` e token. Se a Conta for verificada por outro caminho antes do retry, a mesma chave reconstrói `Acessar Curso` e outra URL. Alterações de nome/e-mail também afetam o envelope. O lifecycle identifica fingerprint diferente e marca `acceptance_unknown`, mesmo quando a primeira tentativa teve rejeição explícita.

Uma execução direta de `beginEmailDeliveryAttempt` com query client em memória retornou `resultAction=unresolved` e `markedAcceptanceUnknown=true` para esse cenário. A [Resend exige a repetição da mesma requisição para a mesma chave](https://resend.com/docs/dashboard/emails/idempotency-keys); a deduplicação externa dura 24 horas.

Correção: definir o envelope estável da tentativa, separar mudança de intenção de retry e preservar a política de resultado incerto. Não regenerar token/conteúdo cegamente para a mesma chave. O plano aprovado exige esse contrato.

### F10 — P2: cancelar a troca pode cancelar o histórico errado

Local: `src/features/account/email-change.ts:944`.

O cancelamento busca estados pendentes e `expired` com `LIMIT 1` sem ordenação. Havendo uma solicitação antiga expirada e outra ativa, pode cancelar somente a antiga e informar sucesso. O token ativo continua podendo concluir a troca. A reprodução em memória confirmou o cenário.

Correção: cancelar a solicitação ativa sob o lock existente; tratar registros históricos separadamente. Testar histórico expirado + nova solicitação pendente.

### F11 — P2: uma reserva vencida mantém o e-mail indisponível

Local: `src/features/account/email-change.ts:274`.

A consulta de disponibilidade e o índice parcial dependem do status pendente, sem liberar uma solicitação cujo prazo já venceu. Uma Conta pode reservar um endereço não usado por uma hora e deixá-lo bloqueado para outra até o maintenance diário, aproximadamente mais 23 horas.

Correção: expirar reservas vencidas durante a operação sob os locks pertinentes; ajustar só o SELECT não libera o índice parcial.

### F12 — P2: falha de transporte vira convite inválido

Local: `src/app/(auth)/convites/equipe/aceitar/invitation-acceptance.tsx:118`, `:201`.

Erro de rede ou 503 com corpo não JSON cai no estado terminal de convite inválido e remove a retentativa. A operação pode estar pendente ou já ter sido confirmada pelo servidor. O aceite é idempotente, mas a UI não permite aproveitar essa recuperação.

Correção: interpretar o status antes do JSON; manter estado de resultado incerto para erro de transporte. Invalidar a UI somente por rejeição explícita. CodeRabbit e reprodução em memória confirmaram.

### F13 — P2: substituir avatar pode manter a foto antiga na tela

Local: `src/lib/session.ts:47`; upload em `src/components/account/profile-panel.tsx:109`.

Todo avatar custom usa a mesma URL `/api/account/avatar`. `router.refresh()` preserva componentes cliente; o Avatar instalado só recarrega ao mudar `src`. `no-store` não obriga um elemento já carregado a refazer a requisição. O probe do componente confirmou uma única carga mesmo após substituição.

Correção: incluir revisão opaca do avatar na URL da sessão, derivada do objeto ativo. A leitura continua derivando dono e objeto da sessão, nunca de uma chave arbitrária enviada pelo navegador.

### F14 — P2: falha ao conectar Google perde o contexto de Perfil

Local: `src/components/account/account-security-panel.tsx:36`.

`linkSocial` fornece `callbackURL`, mas não `errorCallbackURL`. Cancelar ou selecionar uma Conta diferente pode retornar ao erro padrão Better Auth e depois ao dashboard em Production, perdendo o motivo. `result.error` cobre o início da operação, não erros posteriores do callback.

Correção: retorno de erro para Configurações/Perfil com código allowlisted e mensagem segura, mantendo uma retentativa contextual. Comportamento conferido no Better Auth instalado.

### F15 — P2: atalho Minha conta não ativa a tab Perfil

Local: `src/components/panel-layout.tsx:68`; `src/app/(admin)/admin/configuracoes/page.tsx:172`.

Na página administrativa, selecionar Plataforma ou Certificados e depois Minha conta muda apenas o hash. A tab é não controlada, com `defaultValue`; Perfil continua escondido. Alterar só o default ou acrescentar query não basta para uma instância já montada.

Correção: sincronizar a tab ativa com a intenção da navegação e revelar Perfil antes de tentar focar/rolar ao destino. Probe com Radix confirmou retenção da tab anterior.

### F16 — P2: novo Staff Google-only não consegue autorizar reembolso

Local de integração: `src/features/admin/staff-invitations.ts:805`; `src/features/payments/refunds.ts:103`; `src/app/(admin)/admin/financeiro/financial-refund-operation.tsx:154`.

O convite cria Staff sem credential, conforme aprovado. Reembolso continua exigindo exclusivamente a senha local e não apresenta alternativa nem orientação para a Conta sem senha. Um Admin/Suporte que usa o fluxo principal Google e tem a permissão correta não consegue concluir essa operação; suas tentativas contam como senha inválida.

Correção: manter a proteção da operação financeira e compatibilizá-la com os métodos de entrada. Se a senha continuar obrigatória especificamente para reembolso, explicar e oferecer seu estabelecimento via fluxo já aprovado antes de pedir uma senha inexistente. Se adotar outra confirmação, especificar o contrato e testá-lo. Não remover a proteção silenciosamente. É uma incompatibilidade entre a nova criação de Staff e um consumidor preexistente.

## Pendência preexistente que impede aceitar o contrato completo

**Suspensão não alcança as APIs nativas Better Auth.** Em `src/app/api/auth/[...all]/route.ts:233`, o handler nativo não consulta `platformBlockedAt`. Uma Conta suspensa ainda pode obter sessão e chamar `update-user`, `get-session` e `list-accounts` diretamente. O probe em memória confirmou login e mutação com 200 tanto na base quanto no candidato. As páginas e APIs próprias novas bloqueiam corretamente, mas o contrato aprovado de suspensão total permanece incompleto.

Correção: aplicar o estado autoritativo às fronteiras nativas pertinentes e à criação de sessão, preservando explicação pública da suspensão e saída. Cobrir sessões já existentes; não basta esconder UI. A orientação oficial do [Better Auth sobre callbacks e bloqueio de sessão](https://better-auth.com/docs/concepts/users-accounts#callbacks) confirma essa separação de responsabilidades; usar apenas hooks disponíveis na versão instalada.

## Polimentos adicionais

- O e-mail genérico afirma “Nenhuma senha ou acesso será alterado” (`src/features/email/server.ts:193`), mas o claim legado remove a credential anterior. Corrigir essa promessa e explicar o próximo passo de entrada quando ocorrer reivindicação.
- A documentação de identidade contém afirmações antigas: migration fora do journal, Etapa 3 pendente e referências de implementação anteriores. Corrigir junto com a remediação; o registro de execução já descreve outra situação.
- Manter o resolvedor de identidade compartilhado como fronteira clara. Evitar que compra, signup, convite, troca e Google tenham interpretações diferentes de “mesmo e-mail”. Não recomendo uma refatoração ampla antes de corrigir os contratos demonstrados.

## Standards e Spec, avaliados separadamente

**Standards:** F02 viola REG-IDA-001; F04/F06 mostram consultas não validadas pelo PostgreSQL; F07 diverge do padrão documentado de entrega após resposta; F09 viola estabilidade/idempotência. Demais achados são funcionais, não problemas cosméticos. Não foram contados alertas mecânicos já cobertos pelo formatter. A garantia de compatibilidade com o deployment anterior precisa ser demonstrada para F02/F05.

**Spec:** há lacunas de rollout nos F03–F06; de entrega e retry nos F07–F09; de cancelamento/expiração e recuperação de erro nos F10–F12; e de perfil/navegação nos F13–F15. F01 compromete a segurança da troca; F16 torna a senha opcional incompatível com uma operação existente. Suspensão total permanece incompleta por uma falha preexistente, não por nova regressão. As decisões aprovadas de senha opcional, prova local do primeiro vínculo Google, papel único, ausência de MFA e organização visual não foram tratadas como defeitos.

**Falso positivo descartado:** a revogação de sessões na promoção de Student verificado é feita pelo trigger `profiles_revoke_sessions_after_role_change`, migrations 0065 e 0089. O probe inicial de um agente não simulava triggers. Não há achado de sobrevivência de sessão após essa promoção na cadeia de migrations esperada.

## Verificações e limites

- `bun run verify:quick`: passou; migrations, typecheck, Ultracite e **3.654 testes em 516 arquivos**.
- Build com os overrides sintéticos do verificador: passou (`next build`, compilação, tipos e geração das rotas).
- `bun run knip` com os overrides sintéticos do verificador: passou, exit 0; exibiu 20 recomendações de configuração, sem bloqueio de código morto.
- `bun run docs:check` e `bun run db:migrations:check`: passaram na revisão independente.
- `git diff --check`: passou.
- Probes em memória: reset depois de troca, cancelamento com histórico expirado, erros de aceite, refresh de avatar, tabs e APIs nativas de Conta suspensa. Não substituem PostgreSQL/provider reais.
- CodeRabbit 0.7.6: revisão global recusada por limite de 150 arquivos; revisão focada em `src` concluída com **dois achados**, ambos validados e incorporados (F08/F12). Não foi feita atualização da CLI durante a tarefa.
- Graphify consultado como mapa auxiliar; seu relatório informa baseline `abb3b3ec` e não representa sozinho o candidato atual. A revisão se baseou no diff e no código atual, sem afirmar grafo atualizado.
- E2E/concorrência PostgreSQL e provider real não executados nesta revisão. Nenhuma URL local aberta.

Os testes existentes de cutover usam query clients mockados, portanto aceitam SQL inválido. Não há jornada nova completa de convite com PostgreSQL. A jornada alterada de Curso gratuito verifica signup/retorno, mas não conclui a inscrição autenticada nessa mesma jornada. Fixtures Staff pré-verificadas com senha não provam a operação financeira Google-only. Esses são gaps de evidência, não prova de novas falhas além das listadas.

## Prontidão operacional

O catálogo documentado ainda marca `purchase-confirmed`, `staff-invitation`, `email-change-confirmation` e `email-change-notice` como pendentes de publicação manual. Isso é estado documental, não consulta live ao Resend nesta revisão. Precisam ser conferidos/publicados e ter entrega real homologada antes da ativação.

Também faltam evidência de preflight no alvo compartilhado, transição corrigida dos dois tópicos v1, smoke Staging dos fluxos completos e CI do SHA candidato conforme o runbook. A implementação passa os gates locais, mas a Etapa 6 não está encerrada.

Ordem recomendada: segurança/reset e suspensão; identidade canônica/compra; comando e SQL da transição; estabilidade/entrega de e-mail; cancelamento/reservas; integração Staff sem senha; regressões de Perfil e erros. Depois, testes reais dos contratos afetados e homologação Staging, seguindo o runbook de release. Production só após esses gates.

Contagem consolidada: quatro P1 e doze P2 novos/de integração, uma lacuna preexistente de suspensão e os polimentos/documentação descritos acima. O achado de sessões sobrevivendo à promoção foi retirado após a conferência do trigger PostgreSQL.

Revisão original concluída; consulte abaixo o resultado da remediação.

## Acompanhamento da remediação na worktree

Data: 2026-10-01. Escopo: correção do código e dos documentos desta worktree;
sem commit, push, deploy, publicação de template externo ou aplicação de
migration em banco.

- **F01 e suspensão:** reset Better Auth é cercado por marcador temporário sob
  o mesmo advisory lock transacional da troca. A troca preserva o próprio link
  quando há reset em andamento e invalida tokens restantes antes de mudar o
  endereço. APIs nativas protegidas, criação de sessão e revogação no bloqueio
  também foram cobertas.
- **F02:** compra, Google e lookup da Conta usam a identidade canônica. Disputa
  concorrente é relida e conflito de múltiplas Contas falha sem merge.
- **F03–F06:** entrypoint do cutover roda com `react-server`, valida argumentos
  antes de abrir o banco, compara o enum PostgreSQL corretamente, trata status
  nulo e inventaria Pedidos pagos sem ledger. O preflight exige também a coluna
  de decisão do ledger.
- **F07–F09:** fronteiras de cadastro, verificação, convite e troca agendam a
  outbox após commit. A decisão de confirmação fica no ledger; snapshots de
  comprador ausentes são preenchidos no Pedido na transação da intenção. CTA,
  token e destinatário permanecem estáveis durante a janela de retry. Um desafio
  removido pela manutenção só é recriado antes da primeira tentativa ao provider;
  depois disso, não há rotação de payload.
- **F10–F12:** expiração libera reservas vencidas, cancelamento seleciona só a
  solicitação ativa, e falhas transitórias/malformadas no aceite do convite
  permitem nova tentativa sem classificar o link como inválido.
- **F13–F16:** revisão opaca do avatar altera o `src`, linking Google retorna
  falhas para Perfil, tabs administrativas acompanham a URL e Staff sem senha
  local recebe um caminho de recuperação sem remover a confirmação exigida
  pelo reembolso.
- **Documentação e copy:** alegações antigas sobre migrations, cutover, Google
  e a corrida de reset foram atualizadas; a confirmação de e-mail não promete
  que credenciais não serão alteradas.

### Verificação desta remediação

- `bun run verify:quick`: passou — 521 arquivos de teste, 3.704 testes
  aprovados; um teste PostgreSQL condicional ficou pulado porque
  `CI_POSTGRES_ADMIN_URL` não está disponível.
- `bun run docs:check`: passou — 52 documentos canônicos.
- `bun run db:migrations:check`: passou.
- `git diff --check`: passou.
- O comando do cutover sem argumentos exibiu validação de uso antes de tentar
  conectar a qualquer banco.
- CodeRabbit CLI 0.7.6 está instalada e autenticada, mas o plano não tem seat;
  revisão adicional da remediação foi pulada por indisponibilidade de acesso.
- As migrations 0101/0102 foram geradas e revisadas localmente, mas não foram
  aplicadas em Development, Staging ou Production. Publicação/verificação real
  de templates Resend, preflight remoto, smoke de Staging e CI do SHA candidato
seguem como gates operacionais de release, fora desta alteração local.

## Seguimento da revisão de execução — 2026-10-01

- `Reflect.get` foi removido dos dois readers de body no caminho de verificação
  e recuperação; o objeto é estreitado uma vez para `Record<string, unknown>`.
- A fronteira externa de recuperação aplica rate limit HMAC antes de lookup,
  lock ou marcador: por IP e e-mail na solicitação; por IP e token no consumo.
  Solicitação limitada conserva HTTP 200 e `{ status: true }`; token limitado
  retorna 429 com código genérico. Limite de IP confiável ausente em Production
  falha fechado. O endpoint de pedido também aplica piso de resposta de 250 ms
  para reduzir a diferença de tempo causada pelo trabalho do guard. O limitador
  nativo Better Auth segue ativo depois do wrapper.
- Wrappers de transação e advisory locks canônicos de e-mail foram centralizados
  sem alterar os namespaces/chaves PostgreSQL existentes. A limpeza de manutenção
  agora remove globalmente marcadores expirados de reset abandonados.
- Compra: intenção não fixa mais verificação no pagamento. Primeiro preparo de
  entrega resolve o estado atual por `UPDATE` condicional e persiste a escolha;
  retries permanecem idempotentes. Migration `0103_purchase_confirmation_delivery_decision`
  ajusta o schema e reabre somente decisões ainda sem tentativa ao provider.
- E2E de Curso gratuito agora inclui confirmação, definição da primeira senha
  pelo fluxo público de recuperação, login, retorno preservado e matrícula
  explícita pela mesma Conta. O token de reset é lido somente pelo helper que
  exige o banco isolado E2E.
- Pesquisa primária arquivada em
  `research/2026-10-01-auth-review-remediation-research.md`.
- Migration 0103 foi gerada e revisada localmente, mas **não aplicada** a nenhum
  banco. Staging/Production, push e deploy não foram tocados. O E2E foi ampliado,
  mas não executado porque `E2E_DATABASE_URL` não está disponível nesta worktree.
- `bun run verify:quick`: passou — 524 arquivos de teste, 3.715 aprovados e um
  teste PostgreSQL condicional pulado por ausência de `CI_POSTGRES_ADMIN_URL`.
  `bun run docs:check`, `bun run db:migrations:check`, typecheck e Ultracite
  também passaram.
- CodeRabbit 0.7.6 está autenticado, mas sem seat atribuído; a revisão externa
  opcional permanece indisponível.
