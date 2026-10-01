---
status: canonical
owner: engineering
last_verified_commit: 6bf5d693fd565c7c4c0c4bd9b7754efca92c2b44
---

# Identidade e autorização

## Escopo

Define Conta, sessão, perfil, papéis, permissões e bloqueios. Termos comerciais como Compradora e Concessão ficam em [Comércio e acesso](commerce-and-access.md).

## Modelo e estados

- `users`: identidade Better Auth e credenciais básicas da Conta.
- `accounts`: credenciais e provedores da identidade.
- `sessions`: sessões revogáveis.
- `verifications`: tokens de verificação e recuperação.
- `pending_signups`: dados mínimos e temporários de um cadastro ainda sem Conta.
- `account_email_challenges`: finalidade, geração, prazo e consumo dos desafios
  próprios do Hub para provar posse de uma caixa postal.
- `account_email_challenge_rate_limits`: somente hashes HMAC de destinatário/IP,
  contagem e janela; não armazena e-mail ou endereço IP em claro.
- `account_email_change_requests`: etapas e prazos de troca de e-mail;
  endereços pendentes são temporários e removidos após a entrega dos avisos e
  retenção terminal curta.
- `account_password_reset_operations`: marcadores temporários que coordenam
  solicitação/consumo de recuperação de senha com a troca de identidade.
- `staff_invitations`: convites internos pendentes, papel proposto, grants
  allowlisted, Admin convidante, geração e prazo. Um convite não cria Conta,
  sessão ou acesso antes do aceite.
- `two_factors`: estrutura legada de uma tentativa anterior de autenticação,
  mantida apenas para preservar o histórico de migrations; não é registrada nem
  consultada pela aplicação atual.
- `profiles`: papel, bloqueio de plataforma, modo de avatar e chave R2
  privada da imagem personalizada, além de dados complementares do Aluno.
- papéis: `admin`, `support`, `student`.

Não existe Better Auth Admin Plugin nem Organization Plugin. Não há organização,
tenant ou equipe de cliente; a equipe interna usa o lifecycle próprio de
`staff_invitations`.

### REG-IDA-001 E-mail identifica a Conta sem distinção de caixa

**Invariante:** duas Contas não podem representar a mesma identidade canônica de e-mail.
Além de espaços e caixa, Gmail/Googlemail convergem domínio, removem pontos e `+tag`;
provedores reconhecidos pelo Sentinel removem `+tag`. Essa mesma regra deve ser aplicada
antes de procurar ou criar a Conta da Compradora.

**Implementado:** a migration `0097_identity_email_challenges.sql` está no
journal e adiciona a função canônica e seu índice único; conflitos legados fazem
a migration falhar fechada. Compra e vínculo Google consultam a mesma função
canônica. Disputas concorrentes de criação são relidas sob essa identidade e
colisões com mais de uma Conta são recusadas sem merge automático. O estado de
aplicação em cada banco compartilhado deve ser confirmado pelo preflight e pelo
runbook; esta implementação local não aplicou migration em nenhum ambiente.

`scanBuyerIdentityCollisions`, em `src/features/payments/identity-collision-audit.ts`,
é uma auditoria somente leitura em lotes por cursor. Ela agrupa somente colisões da
política já implementada, preserva os e-mails originais para a investigação
administrativa e não altera Conta, Pedido ou Matrícula. Nenhum resultado da auditoria
autoriza merge automático: cada conflito legado exige decisão explícita.

O comando `bun run ops:audit:buyer-identities` exibe por padrão apenas quantidade,
quantidade de Contas e hash do agrupamento. A forma detalhada exige a confirmação
local `IDENTITY_AUDIT_CONFIRMATION=read-only`; nunca execute essa forma em CI ou
redirecione sua saída para logs compartilhados.

### REG-IDA-002 Cadastro público é desabilitado por padrão

`AUTH_PUBLIC_SIGNUP_ENABLED` tem default `false`. O endpoint nativo Better Auth `POST sign-up/email` é sempre bloqueado, inclusive quando o cadastro público está habilitado, pois persiste a senha antes da prova da caixa. Quando a flag está ligada, o fluxo próprio de `/cadastro` é `/api/account/registrations`; login Google desconhecido nunca cria Conta. Contas também podem entrar por fluxo financeiro, convite ou bootstrap operacional.

**Autorização:** o endpoint de bootstrap Admin só existe fora de produção, exige `INTERNAL_BOOTSTRAP_SECRET` e retorna 404 em produção por `getBootstrapAdminDecision`.

**Falhas:** sem Resend, recuperação de senha e e-mails de acesso falham; isso não reabre cadastro. O formulário público de recuperação sempre usa a mesma mensagem para Conta existente, inexistente ou falha de entrega, evitando enumeração visível no navegador. Depois de uma resposta aceita, ele substitui os campos por uma confirmação e só permite nova solicitação após a ação explícita de tentar com outro e-mail.

### REG-IDA-002A Cadastro público cria apenas a Conta

`AUTH_PUBLIC_SIGNUP_ENABLED` continua com default `false`. Quando habilitado, `/cadastro` coleta nome e e-mail, nunca senha. A resposta externa é neutra para e-mail novo, existente, limitado ou suprimido. Antes da prova da caixa, só existe uma pendência temporária e um desafio HMAC com finalidade, geração, prazo e uso único; não há Conta, Perfil, credencial, sessão, Pedido, Concessão ou Matrícula. Abrir o link por `GET` não altera estado: o token fica no fragmento da URL, é removido do histórico do navegador e só é consumido após ação explícita por `POST`. A confirmação cria uma Conta Student verificada sem credencial nem sessão, e direciona para entrar; senha pode ser criada depois. Colisão canônica nunca faz merge ou substituição. A inscrição gratuita continua sendo uma ação autenticada separada.

A confirmação remove imediatamente a pendência que continha nome/e-mail;
pendências abandonadas são apagadas após o vencimento pelo maintenance. Desafios
consumidos/vencidos e buckets HMAC expirados também são removidos pelo mesmo job.

Para Conta local legada não verificada, a confirmação funciona como reivindicação: numa transação, consome o desafio, apaga credential e sessões criados antes da prova, e só então marca o e-mail como verificado. Cadastro público não inicia reivindicação para Admin/Suporte; esses papéis podem pedir confirmação explicitamente pelo fluxo de verificação, que também invalida credential pré-prova. A troca de e-mail e convites têm finalidades próprias e não reutilizam o desafio de signup.

### REG-IDA-002B Convite de equipe exige aceite explícito

Somente Admin com acesso ativo pode criar, atualizar, reenviar ou cancelar um
convite. O registro pendente guarda o e-mail, papel, grants/views permitidos,
motivo, Admin convidante, geração e expiração de sete dias. A outbox guarda
somente `invitationId` e geração. O delivery revalida estado, prazo e Admin
convidante e gera um token HMAC de propósito `staff_invitation`; o token fica
no fragmento da URL e não é persistido em fila, log ou auditoria.

O GET da página e o POST de preview não alteram Conta ou convite. Um POST
explícito valida novamente geração, prazo, e-mail canônico e estado do
convidante; em uma única transação consome o convite e cria/atualiza o Perfil.
A interface só encerra o fluxo como convite inválido quando recebe o código
explícito `invalid_or_expired_staff_invitation` com HTTP 400. Falhas de rede,
HTTP 5xx, outros status ou respostas JSON malformadas mantêm o resultado como
incerto e oferecem nova tentativa. Repetir o POST de aceite é seguro: um
convite já aceito retorna o mesmo destino de login sem reaplicar a promoção.
Conta nova nasce verificada, sem credencial ou sessão. A aceitação de um Aluno
existente converte o papel único, revoga sessões e preserva matrícula, pedidos,
progresso e certificados. Para Student legado não verificado, o próprio convite
prova a posse da caixa: credenciais e sessões anteriores são invalidadas antes
de marcar o e-mail verificado. A pessoa precisa entrar novamente pelo método de
login escolhido; o aceite não autentica.

Convites expirados são marcados pelo maintenance; reenvio rotaciona geração e
invalida links/outbox antigos. A equipe continua single-role: Admin/Suporte já
existentes não recebem uma segunda atribuição por convite. A tabela de membros
mantém edição, auditoria e proteção contra rebaixar o último Admin.

### REG-IDA-009 Perfil compartilhado e métodos de entrada

Não existe rota separada para a Conta. Dados pessoais e métodos de entrada
integram as configurações existentes: `/app/configuracoes` para Student e
`/admin/configuracoes` para Admin/Support. Na rota administrativa, a seção
pessoal está sempre disponível; sem a capacidade `viewSettings`, ela não carrega
nem exibe configurações do Hub.

Configurações Student permanece sob o layout normal de `/app` e os mesmos
guards de sessão. Uma Conta com acesso à plataforma suspenso não pode entrar em
nenhuma área interna, inclusive Configurações; o guard redireciona para
`/entrar`, que informa a suspensão e oferece contato com o Suporte. A navegação
e o endpoint privado de avatar também negam acesso. Nenhuma preferência ou dado
de aprendizagem é carregado para uma Conta suspensa. A restauração do acesso é
uma ação administrativa auditada, não uma ação disponível ao próprio Aluno.

O nome continua em `users.name` e alimenta novos Certificados; snapshots já
emitidos não mudam. O e-mail atual fica visível e sua troca requer Conta
verificada, mas não exige reautenticação por idade da sessão. São exigidas duas
provas em ordem: um link HMAC de uso único ao endereço atual autoriza a
solicitação; outro ao endereço novo comprova posse. Somente após ambas as
provas o Hub atualiza `users.email`, invalida sessões anteriores e envia avisos
aos dois endereços. Nenhum link cria sessão. Solicitações expiram em uma hora;
um novo pedido rotaciona a geração e invalida os links anteriores.

Os endpoints Better Auth de solicitar e consumir reset registram uma operação
temporária em `account_password_reset_operations`, sob o mesmo advisory lock
transacional da troca. Ao concluir a segunda prova, a transação recusa
temporariamente a troca se houver reset em andamento; a pessoa pode tentar o
mesmo link novamente. Sem operação ativa, bloqueia a Conta e a credencial local,
apaga os registros `reset-password:%` ainda pendentes em `verifications` e só
então altera o e-mail. As linhas de `accounts` não são apagadas nem têm a senha
ou vínculos Google alterados. Marcadores são removidos quando o handler termina
e expiram em 15 minutos após falha inesperada do processo. Se o guard não puder
acessar o banco, os endpoints de reset falham fechados com HTTP 503. Reservas de
endereço vencidas são marcadas `expired` e têm sua geração rotacionada sob o lock
advisory do endereço canônico antes da checagem de disponibilidade; a mensagem
pendente correspondente é superseded. Cancelamento seleciona apenas pedido
pendente ainda dentro do prazo, rotaciona sua geração e supersedes sua mensagem.

O fluxo sempre adquire primeiro o advisory da Conta e depois os advisories dos
endereços canônicos em ordem lexical. Na criação/renovação, bloqueia a linha do
usuário atual, expira e bloqueia reservas vencidas do destino, verifica a
disponibilidade e então bloqueia o pedido ativo próprio. Na confirmação, bloqueia
o pedido e depois a Conta; na conclusão, também bloqueia o usuário que já ocupa o
destino, a credencial local e, por fim, apaga os tokens de reset pendentes. O
cancelamento bloqueia o advisory da Conta antes do pedido ativo. A limpeza de
reservas vencidas acontece sob o advisory do endereço de destino e antes da
verificação de disponibilidade. Essa ordem serializa concorrentes que reservam
o mesmo endereço e invalida links que ainda estavam pendentes.

O cancelamento bloqueia o advisory da Conta antes do pedido ativo. A limpeza de
reservas vencidas acontece sob o advisory do endereço de destino e antes da
verificação de disponibilidade. Essa ordem serializa concorrentes que reservam
o mesmo endereço e invalida links que ainda estavam pendentes. Os dois endpoints
Better Auth são envolvidos pelo guard do Hub, cobrindo tanto a emissão quanto o
intervalo entre consumo do token e gravação da credencial.

A senha é opcional. Configurações não cria nem altera senha e não consulta se uma
credential existe. A pessoa solicita um link em `/recuperar-senha`, pelo link
`Esqueci minha senha` da tela de login. O link leva a `/redefinir-senha`; o token de uso único permite definir a
primeira senha de uma Conta Google-only ou atualizar uma credential existente.
O fluxo Better Auth continua responsável por expiração, validação, verificação
local do e-mail e revogação de sessões conforme a configuração atual. Não há
link de reset nem formulário de senha nas Configurações. O Hub nunca lê nem
exibe hash. Vincular Google é uma ação autenticada e mantém a prova local
exigida para o primeiro vínculo.

O avatar apresentado segue uma ordem automática: imagem personalizada privada,
foto Google disponível e, por último, iniciais. Iniciais não são uma opção de
perfil. Remover a foto personalizada limpa a referência ativa e o objeto antigo
no R2; o próximo fallback é aplicado sem uma escolha de modo. A imagem é
validada pelo conteúdo, permite enquadramento manual antes do envio e é
processada para quadrado WebP de 512×512. São aceitos somente JPG/PNG/WebP
estáticos de até 5 MiB. A chave R2 inclui o `userId` obtido da sessão; a leitura
usa rota autenticada própria, sem URL pública ou chave fornecida pelo navegador.
O perfil mantém uma única referência ativa; substituição troca a referência em
transação e remove o objeto anterior. Se a remoção falhar, o reconciliador apaga
órfãos válidos após 24 horas, com falhas registradas sem dados pessoais nos
logs operacionais.

As páginas `/entrar` e `/cadastro` aceitam retorno somente para a rota interna
canônica `/comprar/<slug>`, validada por `getSafeAuthReturnTo` em
`src/lib/auth-return-to.ts`. A allowlist exige slug minúsculo, sem query,
fragmento, barra invertida, encoding ou host externo, e possui limite de tamanho.
O formulário usa `URLSearchParams` para transportar o valor validado até
`/api/auth/redirect`; o Route Handler valida novamente. Student autenticada pode
voltar ao Curso, enquanto Admin e Support permanecem na primeira superfície
administrativa autorizada; Student bloqueada continua recebendo `403`. O fluxo de
recuperação de senha não carrega
esse retorno.

O trigger `users_create_student_profile`, da migration `0041_public_signup_student_profiles.sql`, cria o Perfil `student` junto com cada Conta criada pelo signup confirmado. A migration também preenche Perfis ausentes de Contas legadas, para que as novas Contas apareçam na administração sem depender de hook assíncrono da aplicação.

Quando a Conta Student retorna de `/comprar/<slug>`, somente
`enrollFreeCourseAction`, em `src/app/(student)/app/actions.ts`, pode iniciar a
autoinscrição. A action aceita apenas o Curso informado pela interface, deriva o
`userId` da sessão autenticada e delega a validação do Curso e a mutação ao caso de uso
de acesso. Login e cadastro apenas preservam o retorno seguro; criar uma Conta nunca
cria Concessão ou Matrícula por si só.

### REG-IDA-003 Autorização é por capacidade

`canPerform`, em `src/lib/auth-policy.ts`, é a fonte do RBAC e recebe o sujeito
completo:

- `admin`: todas as capacidades;
- `support`: visualizações de rota persistidas em
  `profiles.support_permission_views` e alterações delegáveis persistidas em
  `profiles.support_permission_grants`;
- `student`: nenhuma capacidade administrativa.

Essa matriz central já representa a fronteira aprovada no
[DEC-DISC-014](../decisions.md#dec-disc-014) e refinada em
[ADR-0017](../adr/0017-support-granular-permissions.md). O Painel é uma
capacidade padrão do shell para Admin e Suporte; Financeiro e Auditoria têm
views protegidas, enquanto Cursos, Alunos, Aprendizagem e Operação têm leitura
padrão. Toda leitura e mutação de domínio ainda exige sua capacidade específica.
Páginas, Route Handlers, Server Actions e projeções aplicam essas capacidades no
servidor. O Painel e Auditoria não carregam primeiro uma projeção ampla para
filtrá-la depois.

A ficha contextual de `support` combina somente dados do Aluno no Curso
selecionado: estado e validade da Matrícula, bloqueio contextual, progresso das
Aulas obrigatórias, Certificado mais recente, Pedidos e reembolsos associados e
auditoria restrita aos agregados permitidos. Ela não consulta nem mostra edição
de conteúdo, configuração da plataforma, auditoria global ou controles Admin.
Admin continua usando sua projeção própria e não herda a restrição de
Certificado mais recente aplicada ao Suporte.

`manageFinancialOperations`, `manageFinancialReviews` e `executeRefund` são
capacidades mutáveis que o Admin pode conceder individualmente. Cada uma exige a
view financeira correspondente. `viewFinancials` é uma derivação interna para
navegação e não substitui as três views protegidas: Análise, Pedidos e Revisões.

### REG-IDA-003A Permissões delegáveis de Suporte

As views protegidas e alterações de `SUPPORT_PERMISSION_GROUPS` aparecem na
Equipe; acessos padrão não viram checkboxes. O catálogo inclui grants granulares
para Cursos, Alunos, Certificados, Financeiro e Operação, além de
`viewFinancialAnalysis`, `viewFinancialOrders`, `viewFinancialReviews` e
`viewAudit`. FAQ, Banners e mídias da Tela de acesso são padrão para Admin e
Suporte e continuam auditados. O Postgres e o TypeScript rejeitam qualquer
outro valor. A migration 0085 limpou views/grants configuráveis de Supports
existentes; novas Contas começam da mesma forma. Admin e Student não persistem
grants ou views. Alterar apenas grants ou views não revoga a sessão, pois a
policy relê o Perfil na próxima resolução server-side; alterar o papel revoga as
sessões do alvo.

Server Actions e páginas devem checar a capacidade apropriada; esconder botão não é autorização.

### Segurança de Admin/Suporte

MFA administrativo não faz parte do produto atual. `admin` e `support` entram
com sessão Better Auth válida e são autorizados pela matriz RBAC, pelos grants do
Perfil, pelas regras de
bloqueio e pelas confirmações próprias de cada operação sensível. Uma adoção
futura de MFA exigirá nova decisão de produto, especificação, implementação e
requalificação; a tabela legada `two_factors` não representa um recurso ativo.

O servidor verifica a sessão, o papel, o bloqueio e a capacidade da operação em
cada fronteira sensível.

Os fluxos sensíveis continuam exigindo as confirmações próprias da operação e
auditoria. A tabela legada `two_factors` não é lida nem escrita pela aplicação.

### REG-IDA-004 Bloqueio de plataforma prevalece sobre Matrículas

`blockStudentPlatformAccessAction` e `restoreStudentPlatformAccessAction`, em `src/features/admin/actions.ts`, alteram o bloqueio amplo da Conta. Uma Matrícula ativa não contorna esse bloqueio.

**Invariantes:**

- bloquear não apaga Conta, Pedido, progresso ou Certificado;
- bloqueio por curso é outra operação;
- restaurar a plataforma não recria Concessões;
- sessão bloqueada não inicia Checkout;
- compra anônima identificada após pagamento como Conta bloqueada abre Revisão sem acesso
  e exige reembolso pelo Suporte.

### REG-IDA-005 Checkout público usa identidade coletada pelo provider

**Contrato aprovado e implementado em código para Asaas:**

- checkout autenticado vincula a Conta da sessão;
- o provider não altera nome, e-mail, verificação ou credenciais;
- checkout público nasce sem PII local e omite `customer`/`customerData` na criação;
- depois do evento financeiro autoritativo, o Hub consulta nome/e-mail do cliente Asaas;
- no checkout público, Compradora = Aluno;
- compra pública pode acontecer antes de existir Conta com credencial;
- Conta criada a partir da compra não é considerada verificada pelo provider;
- Conta existente não é sobrescrita pelos dados do checkout;
- compra como presente ou para terceiro fica fora do escopo.

Esse contrato está aprovado em [DEC-DISC-007](../decisions.md#dec-disc-007) e detalhado na
[especificação de compra pública](../superpowers/specs/2026-07-30-public-course-purchase-handoff-design.md).
A ação autenticada ignora identidade enviada pelo formulário e usa somente `session.user`.
O handoff público não recebe PII: o Pedido nasce com identidade `pending`, o processor
consulta o cliente Asaas fora da transação e persiste somente nome/e-mail uma vez.

`resolveLocalOrderIdentity`, em `src/features/payments/order-identity.ts`, resolve a
identidade pública a partir desse snapshot minimizado, preserva o índice
`users_email_lower_unique_idx` e mantém Conta nova com `email_verified=false`. Papel,
bloqueio geral e Matrícula revogada no Curso são verificados antes da Concessão. Colisão
abre Revisão `buyer_identity`, que não aceita decisão genérica e só encerra após reembolso
integral confirmado. A prova E2E PostgreSQL passou e a homologação Sandbox pós-mudança
comprovou PIX, vínculo, acesso, entrega do e-mail de ativação, criação da senha, login e
abertura do Curso.

### REG-IDA-006 Confirmação de compra é durável sem persistir segredo

Para Pedidos novos, `email.purchase-confirmed` guarda somente `orderId` e `userId`;
`purchase_confirmation_intents` é o marcador durável único por Pedido e sobrevive à
limpeza de mensagens entregues da outbox. A migration registra Pedidos já pagos como
históricos para que reconciliação tardia não reenvie confirmação. O processor enfileira
marcador e intenção na mesma transação da Concessão e Matrícula.

Na mesma transação que registra a intenção e enfileira a mensagem, o ledger captura
`verification_required` a partir do estado de verificação naquele momento. Retry não
muda de confirmação de e-mail para acesso ao Curso só porque a Conta mudou enquanto a
mensagem aguardava. A entrega usa os dados imutáveis do Pedido, o snapshot do Curso e
essa decisão durável; nenhum token, e-mail ou URL secreta entra na outbox. Se a prova
estiver perto de vencer antes da primeira tentativa ao provider, o desafio é renovado.
Depois da primeira tentativa, geração, prazo e envelope permanecem estáveis durante a
janela idempotente do provider. O desafio não cria sessão, senha ou acesso adicional;
reset/criação de senha permanece uma ação separada iniciada pelo usuário.

`auth.account-activation` e `email.access-released` continuam implementados somente
para mensagens v1 históricas. Não são escolhidos para novos Pedidos; o corte deduplica
as duas versões, bloqueia retry manual legado e nunca envia uma segunda confirmação se
há aceitação confirmada/incerta.

## Autenticação

`getAuth`, em `src/lib/auth.ts`, configura Better Auth com adaptador Drizzle para
`users`, `accounts`, `sessions` e `verifications`; e-mail e senha;
token de redefinição por uma hora; revogação das sessões após redefinição;
origens confiáveis de `parseTrustedOrigins`; e
`nextCookies()` como último plugin.

### REG-IDA-007 Senha tem mínimo único de oito caracteres

Cadastro, redefinição, bootstrap operacional e Better Auth usam
`PASSWORD_MIN_LENGTH = 8`, de `src/lib/password-policy.ts`. Sete caracteres são
rejeitados e oito são aceitos; a confirmação deve ser idêntica. A mesma política
preserva token de redefinição por uma hora e revoga as sessões existentes depois
da troca. Mensagens públicas de recuperação continuam indistinguíveis para Conta
existente, inexistente ou falha de entrega.

Após uma redefinição bem-sucedida, a interface remove o formulário e oferece entrada pelo fluxo normal de login; o mesmo token não é submetido novamente pela tela.

No reset de senha, `INVALID_TOKEN` mostra **Link inválido ou expirado** e oferece
`/recuperar-senha`; `PASSWORD_TOO_LONG` mostra mensagem segura de senha muito
longa sem link. Códigos desconhecidos, `429`, `5xx`, corpos vazios ou malformados
e erros de rede usam a mensagem genérica de tentar novamente, sem link. O guard
de token ausente preserva o link de recuperação exigido.

As páginas `/` e `/entrar` aguardam uma requisição antes de resolver a sessão: uma Conta já autenticada é redirecionada para sua área, e essa leitura nunca ocorre durante o build.

### REG-IDA-008 Login Google não cria Conta implicitamente

**Contrato implementado:** `/entrar` usa Google somente para
autenticar uma Conta existente; o pedido de signup explícito nunca é
enviado nessa rota. `disableImplicitSignUp` permanece ativo, e a opção de
signup Google segue `AUTH_PUBLIC_SIGNUP_ENABLED`. `/cadastro` pode criar uma
Conta Google somente quando a pessoa escolhe essa ação e o cadastro público
está habilitado; esse fluxo cria apenas Conta, vínculo Google e Perfil Student,
sem Pedido, Concessão ou Matrícula.

O primeiro vínculo local usa o `sub` Google como identidade estável e exige
`email_verified=true` no provider e `users.email_verified=true` local. Um
endereço original ou canonizado pelo normalizador de Compradora só identifica
uma Conta quando há um único candidato; conflito é rejeitado sem merge ou
transferência. Linking não atualiza e-mail, nome, papel ou dados financeiros da
Conta local. A foto do Google pode preencher `users.image` quando a Conta ainda
não tem imagem; uma imagem já cadastrada prevalece. O avatar é lido da sessão
server-side e exibido no menu da Conta. Tokens OAuth ficam cifrados no banco;
não há escopos de produto nem ID-token sign-in.

`emailAndPassword.requireEmailVerification` está ativo para bloquear login por
senha em Conta não verificada. O cadastro local e a confirmação pontual usam
desafios do Hub entregues pela outbox; `GET /api/auth/verify-email` não marca
estado e encaminha links Better Auth antigos à orientação para solicitar novo
link. Em uma reivindicação legada, credential e sessões anteriores são
invalidados antes de `users.email_verified=true`. Depois de redefinição de
senha, `onPasswordReset` também atualiza esse campo idempotentemente porque o
link de reset foi enviado à caixa cadastrada; se a escrita falhar, a tela não
afirma sucesso e permite solicitar outro link em `/recuperar-senha`.

O envio de confirmação só ocorre após ação explícita; a resposta pública não
enumera Contas e há limite por identidade e IP. Se o IP confiável não puder ser
resolvido em produção, o pedido é recusado sem revelar a causa. Para qualquer primeiro vínculo
Google, inclusive Gmail/Workspace, exige-se prova local. A exceção condicional
por domínio foi adiada porque a versão instalada não expõe um hook de
autorização seguro; não configurar `requireLocalEmailVerified:false` nem
`trustedProviders`. Essa política está em
[DEC-DISC-020](../decisions.md#dec-disc-020). Compra pública continua
guest-first conforme [DEC-DISC-007](../decisions.md#dec-disc-007); a confirmação
da compra usa o ledger durável descrito em REG-IDA-006 e não reabre o fluxo
legado de reset por compra.

Na interface, `/entrar` inicia Google sem `requestSignUp`; `/cadastro` só mostra
criação social quando cadastro público está habilitado e, quando está desligado,
exibe apenas a indisponibilidade e um retorno seguro para entrar. O callback
`/oauth/callback` nunca exibe mensagens/códigos crus do provider: sucesso usa
`/api/auth/redirect` para reaplicar papel e bloqueio, e cancelamento volta ao
login. A tentativa de confirmar e-mail é revelada por ação explícita; a rota
`send-verification-email` normaliza respostas e falhas para HTTP 200 com
`{ status: true }`, sem distinguir Conta inexistente, já confirmada, envio
aceito, limite ou falha de entrega. O retorno do link distingue confirmação
concluída de token inválido/expirado sem exibir o código Better Auth.

## Fronteira Admin e Aluno

`getStudentPreviewMode`, `canAccessStudentRoute` e `canMutateStudentExperience`, em `src/features/courses/preview.ts`, permitem visualização controlada da experiência do Aluno. Preview de Admin não deve gravar progresso nem simular autorização real.

## Concorrência e segurança

- sessão deve ser resolvida no servidor a cada operação sensível;
- permissão não deve ser recebida do cliente;
- e-mail, ID de usuário e papel não devem ser aceitos como prova de identidade sem sessão;
- redefinição revoga sessões existentes;
- mudança de papel revoga sessões existentes;
- credenciais e secrets nunca entram em logs ou documentação versionada.

## Evidências

- schema: `roleEnum`, `users`, `sessions`, `accounts`, `verifications`,
  `pendingSignups`, `accountEmailChallenges`, `accountEmailChallengeRateLimits`,
  `accountEmailChangeRequests`, `accountPasswordResetOperations`, `profiles`
  e estruturas legadas de migration em `src/db/schema.ts`;
- implementação: `getAuth`, `canPerform`,
  `isBlockedAuthEndpoint`, `getBootstrapAdminDecision` e o serviço de
  desafios/guard de reset em `src/features/account/`;
- testes: `src/lib/auth-policy.test.ts`, `src/lib/session.test.ts`,
  `src/lib/trusted-origins.test.ts`,
  `src/lib/allowed-dev-origins.test.ts` e `src/features/account/*.test.ts`;
- rotas: `src/app/api/auth/[...all]/route.ts`,
  `src/app/api/account/registrations/route.ts`,
  `src/app/api/account/email-challenges/consume/route.ts`,
  `src/app/api/account/email-changes/consume/route.ts`,
  `src/app/api/auth/redirect/route.ts` e
  `src/app/api/auth/dev/bootstrap-admin/route.ts`.

## Decisões e pendências

- [ADR-0001](../adr/0001-custom-rbac.md): RBAC próprio, aceito.
- [DEC-DISC-001](../decisions.md#dec-disc-001): ativação durável somente com `userId` e
  `orderId`, sem outros dados pessoais nem token persistido, implementada na outbox e
  enfileirada pelo processor Asaas;
- [DEC-DISC-007](../decisions.md#dec-disc-007): identidade de checkout e verificação,
  aprovadas e integradas ao processor Asaas; homologação externa pendente.
- [DEC-DISC-014](../decisions.md#dec-disc-014): matriz granular de `support`,
  projeções por Curso e negações diretas implementadas; MFA administrativo está
  fora do escopo atual;
- [DEC-DISC-020](../decisions.md#dec-disc-020): separação entre login Google,
  cadastro social explícito, vínculo verificado e checkout guest-first;
- racional histórico para Better Auth e autenticação por e-mail e senha não localizado.
