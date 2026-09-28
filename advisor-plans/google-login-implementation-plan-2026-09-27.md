---
status: proposed
owner: product-and-engineering
last_verified_commit: c0cddcce
second_reviewed_on: 2026-09-27
---

# Login Google com separação entre entrar e criar conta

> **Executor:** este documento é um plano, não autorização de execução. Não altere
> staging/produção, credenciais OAuth, variáveis Vercel, banco ou migrations sem
> autorização específica. Preserve os arquivos não commitados do piloto Graphify
> que já existem nesta worktree.
>
> **Drift check:** antes de iniciar, confira `git status` e compare os arquivos
> em escopo com `c0cddcce`. Se autenticação, compra ou identidade tiver mudado
> desde esse commit, releia os trechos abaixo e replaneje antes de editar.

## Status

- **Prioridade:** P1
- **Esforço:** L (configuração, callback, migration defensiva, primeiro acesso e prova de compra)
- **Risco:** HIGH (contas, vinculação de identidade e acesso pago)
- **Dependências:** migration única de identidade validada em Development;
  credenciais Google separadas por ambiente para homologação real
- **Categoria:** security / feature / tests / docs
- **Planejado em:** commit `c0cddcce`, 2026-09-27; segunda revisão independente em 2026-09-27
- **Issue:** —

## Por que isso importa

O Hub precisa distinguir autenticação de registro: entrar com Google deve
reutilizar uma Conta existente, enquanto criar uma Conta social só pode ocorrer
no fluxo explícito `/cadastro` e sob a mesma política de cadastro público já
existente. A configuração incorreta pode criar perfis Student por acidente,
duplicar identidade de Compradora ou vincular uma Conta não verificada a uma
identidade externa. A compra pública pode criar a Conta antes da primeira
autenticação; por isso o ciclo de ativação por e-mail precisa continuar
coerente com a nova vinculação.

## Decisões de produto e recomendação

1. **Separar entrar e cadastrar — decisão esclarecida pelo produto:** `/entrar`
   usa Google somente para autenticar uma Conta existente; `/cadastro` pode
   iniciar criação Google explicitamente. A flag atual
   `AUTH_PUBLIC_SIGNUP_ENABLED` continua valendo para cadastro social e por
   e-mail; não há exceção de provider.
2. **Compra antes da Conta — recomendação desta revisão:** manter checkout
   guest-first, sem pedir conta, senha ou Google antes de pagar. A Conta e o
   acesso continuam sendo resolvidos depois da evidência financeira autoritativa.
   Esse fluxo é o mais simples no momento de maior intenção de compra e não
   mistura autorização com checkout. É uma recomendação de UX/arquitetura, não
   uma alegação de aumento comprovado de conversão.
3. **Conta local ainda não verificada:** não vincular automaticamente enquanto
   `users.email_verified=false`. O comprador conclui o link de primeiro acesso
   já existente; após o token de e-mail ser consumido e a senha gravada, o Hub
   marca a verificação local. Depois, Google pode vincular à mesma Conta. Não
   desativar a proteção anti-pre-account-takeover do Better Auth.
4. **Escopo de papéis:** o `/entrar` atual é compartilhado por Student,
   Admin e Suporte. O plano preserva o papel local após OAuth, sem inferir papel
   de claims Google. O login Google não é apresentado como MFA do Hub; o projeto
   não impõe um segundo fator interno atualmente.
5. **Verificação global — recomendação:** não ativar
   `emailAndPassword.requireEmailVerification` como consequência do login
   Google. O pagamento autoriza o acesso comercial, mas não comprova controle da
   caixa postal. O link pós-compra é a prova no fluxo guest-first; cadastros de
   e-mail existentes e ainda não verificados precisam de uma saída específica
   para vincular Google, sem bloquear globalmente login ou autoinscrição.
6. **Contas legadas não verificadas — recomendação:** quando o vínculo implícito
   falhar por `emailVerified=false`, oferecer confirmação de e-mail somente se a
   pessoa solicitar. Usar o endpoint `send-verification-email` com retorno
   genérico; não ativar `sendOnSignUp` ou `sendOnSignIn`. Após confirmar, a
   pessoa tenta Google novamente. Isso preserva o login/cadastro atuais e não
   transforma confirmação em barreira global.

O fluxo completo de compra/ativação e as comparações de mercado estão em
[`google-oauth-plan-second-review-2026-09-27.md`](google-oauth-plan-second-review-2026-09-27.md)
e [`google-oauth-checkout-ux-review-2026-09-27.md`](google-oauth-checkout-ux-review-2026-09-27.md).

## Contrato de fluxo

| Intenção | Estado local | Resultado obrigatório |
|---|---|---|
| `/entrar` com Google, sem Conta correspondente e sem vínculo Google | nenhuma Conta | falhar sem inserir `users`, `accounts`, `profiles`, Pedido, Concessão ou Matrícula |
| `/entrar` com Google já vinculado pelo `sub` | Conta existente | autenticar a mesma `users.id`; não trocar nome, e-mail, papel ou acesso |
| `/entrar` com Google verificado e mesmo e-mail de uma Conta local verificada | Conta existente, Google ainda não vinculado | vincular `accounts` à `users.id` existente; não criar Conta/projeção duplicada |
| `/cadastro` com Google e cadastro público habilitado | não existe Conta | criar Conta Student e vínculo Google; não criar Pedido, Concessão ou Matrícula; só após intenção explícita |
| `/cadastro` com Google e cadastro público desabilitado | não existe Conta | falhar sem escrita, mesmo com `requestSignUp` explícito |
| Google encontra Conta local com `emailVerified=false` | Conta existente ainda sem prova local | falhar fechado; não criar segunda Conta nem vincular antes da ativação |
| Google `sub` já vinculado a outra `users.id` | identidade externa já pertence a uma Conta | não transferir nem mesclar; resposta pública genérica e evento operacional sem PII |
| Compra guest-first com Conta local inexistente | checkout ainda sem pagamento autoritativo | não criar `users`, `profiles`, Concessão ou Matrícula só por iniciar/retornar do checkout |
| Compra confirmada, Conta sem credencial ou OAuth | evidência financeira autoritativa | criar/reutilizar uma única `users.id`, manter grant/enrollment idempotentes e enviar primeiro acesso ao e-mail do pedido |
| Primeiro acesso por e-mail seguido de Google | Conta paga agora verificada localmente | criar somente o vínculo Google sob o mesmo `user_id`; manter pedidos, papel e acesso |

## Estado atual verificado

### Autenticação e cadastro

- `src/lib/auth.ts` cria Better Auth `1.6.25`, com Drizzle, email/senha,
  `nextCookies()` e os plugins operacionais; ainda não declara `socialProviders`.
- `src/lib/auth.ts` não configura `emailVerification`. O cadastro atual cria
  Conta com sessão imediata e `emailVerified=false`; o checkout pago é
  independente do signup público.
- `src/lib/auth-policy.ts:isBlockedAuthEndpoint` bloqueia somente
  `POST sign-up/email` quando `AUTH_PUBLIC_SIGNUP_ENABLED=false`.
- `src/app/api/auth/[...all]/route.ts` aplica esse bloqueio antes de delegar a
  requisição ao Better Auth. O endpoint social `/sign-in/social` não tem hoje
  política própria.
- `src/app/(auth)/entrar/sign-in-form.tsx` envia email/senha para
  `/api/auth/sign-in/email`; `src/app/(auth)/cadastro/sign-up-form.tsx` envia
  email/senha para `/api/auth/sign-up/email`. Nenhum deles tem CTA Google.
- `AUTH_PUBLIC_SIGNUP_ENABLED` tem default `false`. A página `/cadastro` é
  renderizada, mas a API de email signup é que atualmente recusa a criação.
- `src/lib/auth.ts` não configura `emailVerification` nem
  `emailAndPassword.requireEmailVerification`. A rota Better Auth de sign-up
  cria user com `emailVerified=false` e a tela atual espera sessão imediata; a
  autoinscrição gratuita volta ao Curso pela sessão criada.
- `src/app/api/auth/redirect/route.ts` devolve JSON consumido pelo formulário de
  email. OAuth redireciona o navegador ao `callbackURL`; não se deve apontá-lo
  diretamente para esse endpoint JSON.
- A rota `GET` do catch-all delega diretamente ao Better Auth; hoje os logs
  operacionais de autenticação cobrem principalmente sign-in por email. A
  revisão inclui eventos OAuth sanitizados, sem query string, e-mail ou tokens.

Trechos de referência no commit planejado:

```ts
// src/lib/auth-policy.ts — bloqueio atual restrito ao cadastro por email
!allowPublicSignUp &&
method.toUpperCase() === "POST" &&
pathSegments.join("/") === "sign-up/email";
```

```ts
// src/lib/auth.ts — configuração atual da sessão do servidor
emailAndPassword: { ...AUTH_PASSWORD_POLICY, enabled: true, ... },
plugins: [...infraPlugins, nextCookies()],
```

### Identidade, compra e primeiro acesso

- `src/db/schema.ts` já contém as tabelas Better Auth `users`, `accounts`,
  `sessions`, `verifications`; `accounts` tem `provider_id`, `account_id`,
  `user_id` e campos de token. `users.email_verified` defaulta para `false`.
- A migration `0041_public_signup_student_profiles.sql` cria `profiles.role`
  `student` depois de qualquer nova linha `users`. Sign-up, por si só, não cria
  acesso comercial.
- O Google integrado de Better Auth 1.6.25 usa `sub` como `accountId`, valida
  issuer/audience/expiração/nonce e mapeia `email_verified` para
  `user.emailVerified`. O fluxo padrão exige code verifier (PKCE) no redirect.
- `src/features/payments/order-identity.ts` cria Conta de compradora pública
  somente depois da evidência financeira autoritativa, normaliza o email via
  `normalizeBuyerEmail`, cria o Perfil Student e deixa `email_verified=false`.
  Conta de equipe, bloqueada ou revogada entra em revisão; não recebe Concessão.
- O grant `paid_order` e a projeção de Matrícula continuam sob o fluxo financeiro
  existente; login Google não pode chamar o processor, conceder acesso ou alterar
  Pedido.
- `src/features/outbox/delivery.ts` e `order-identity.ts` consideram atualmente
  apenas `provider_id='credential'` para decidir se é preciso ativar Conta.
  Uma Conta Google-only pode, portanto, receber um reset de senha mesmo tendo um
  método de login funcional. A decisão futura deve considerar credencial ou
  provider social atualmente configurado, e trocar a ativação por uma mensagem
  de acesso liberado quando já existe um método utilizável.
- A ativação `auth.account-activation` envia o link de reset pelo
  `requestPasswordReset` do Better Auth. A rota Better Auth `1.6.25` consome o
  token, cria/atualiza a credencial e chama `onPasswordReset`, mas não marca
  `emailVerified` por conta própria. O Hub ainda não configura `onPasswordReset`.
  A página atual de reset confirma a senha definida e manda a pessoa para
  `/entrar`; não cria sessão automaticamente. O caminho é pós-pagamento e não
  interrompe o checkout.
- `normalizeBuyerEmail` canoniza endereços no fluxo de compra; Better Auth
  1.6.25 procura o primeiro vínculo por e-mail em minúsculas, sem aplicar esse
  normalizador. Não prometer correspondência automática para toda combinação de
  alias. A implementação não deve fazer merge aproximado nem criar outra Conta
  silenciosamente quando o estado for ambíguo; a ativação por e-mail/senha
  permanece um fallback seguro.
- `accounts` possui `accounts_user_id_idx`, mas o schema atual e as migrations
  não impõem unicidade em `(provider_id, account_id)`. O adapter Better Auth
  localiza por esse par e `linkAccount` insere uma linha. A revisão adiciona uma
  migration defensiva precedida por uma consulta de duplicidades; conflito não
  pode ser resolvido apagando linhas automaticamente.

### Regras de segurança Better Auth/Google que este plano preserva

- **Criação vs. login:** no Better Auth 1.6.25,
  `disableImplicitSignUp: true` barra criação implícita, mas `requestSignUp:true`
  habilita signup explícito. `disableSignUp:true` barra qualquer criação e,
  portanto, não serve como opção global neste requisito. Configurar
  `disableSignUp` dinamicamente a partir de `AUTH_PUBLIC_SIGNUP_ENABLED` e
  `disableImplicitSignUp:true` em todo caso.
- **Vinculação:** manter o comportamento padrão de link implícito somente para
  provider com email verificado e Conta local com `emailVerified=true`. Para
  localizar uma Conta comprada que já foi canonizada, o mapper pode consultar
  somente o endereço informado pelo Google e o resultado de
  `normalizeBuyerEmail`; usar um candidato local apenas quando ambos apontarem
  para uma única `users.id`. Se houver zero, manter o email do provider; se
  houver ambiguidade, falhar fechado. O mapper nunca muda `sub`,
  `emailVerified`, nome, papel ou dados de acesso. Não adicionar `google` a
  `trustedProviders`, não configurar `requireLocalEmailVerified:false` e não
  ativar `disableImplicitLinking`.
- **Risco conhecido:** GHSA-g38m-r43w-p2q7 descreve takeover quando uma Conta
  local não verificada é vinculada a OAuth verificado; versão 1.6.11 corrigiu o
  comportamento e 1.6.25 preserva a verificação local. O bypass
  `requireLocalEmailVerified:false` está depreciado e planejado para remoção.
- **Verificação por senha e versão instalada:**
  `emailAndPassword.requireEmailVerification` existe em Better Auth 1.6.25, mas
  só bloqueia sessões de email/senha. Se ligado, o sign-up retorna sem sessão e
  a tela atual falha ao chamar `/api/auth/redirect`; além disso, o callback de
  verificação precisa estar configurado. Portanto, mantê-lo desligado neste
  plano. O gate por provider social (`socialProviders.google.requireEmailVerification`)
  e `user.validateUserInfo` não existem na API tipada 1.6.25; não tratá-los como
  controles globais nem usar exemplos de 1.7.x sem upgrade separado.
- **Contas locais preexistentes não verificadas:** contas criadas por email/senha
  também podem ter `emailVerified=false` e sessão ativa. O link implícito Google
  deve continuar falhando fechado. A interface precisa oferecer um passo
  pontual de confirmação de e-mail antes de tentar vincular, sem revelar se a
  Conta existe. Não exigir nova senha se o objetivo for apenas provar acesso à
  caixa postal.
- **Cadastro Google com email de provider não verificado:** Better Auth 1.6.25
  pode criar Conta explicitamente em `/cadastro` com `emailVerified=false`; isso
  é consistente com o cadastro atual por email, que também não exige verificação.
  Se produto quiser bloquear a criação quando `email_verified=false`, pare e
  decida um guard social pré-criação ou um upgrade separado. A opção
  `emailAndPassword.requireEmailVerification` existente em 1.6.25 só cobre
  sessão de email/senha; não valida o Google antes de criar Conta.
- **Dados do perfil:** deixar `updateUserInfoOnLink=false` e
  `allowDifferentEmails=false`; a Conta local conserva nome/email/papel. Não
  usar scopes além de `openid email profile`, sem Google Drive ou APIs extras.
  Google `sub` é a identidade externa persistente; o e-mail serve apenas para
  localizar um candidato no primeiro vínculo. Endereços canônicos conflitantes
  nunca são resolvidos por escolha arbitrária.
- **Tokens:** habilitar `account.encryptOAuthTokens=true`; Better Auth 1.6.25
  armazena tokens OAuth em texto puro por padrão. Manter o segredo Better Auth
  estável entre início e callback.
- **Retorno:** usar apenas `getSafeAuthReturnTo` para `/comprar/<slug>`; Admin e
  Suporte continuam em `/admin`, Student bloqueado continua sem sessão ativa.

## Arquivos em escopo

- `src/lib/auth.ts` — registro condicional do provider, controles de signup,
  vinculação e criptografia de tokens; callback `onPasswordReset` para marcar
  email verificado após reset consumido com sucesso; sender de verificação
  chamado somente por pedido pontual, sem exigência global.
- `src/db/schema.ts` e nova migration sequencial após `0094` — unicidade do par
  `(provider_id, account_id)` para proteger vínculo contra callbacks concorrentes;
  aplicar no banco de Development somente após o pré-flight de duplicidades.
- `src/lib/env.ts` e `.env.example` — par opcional `GOOGLE_CLIENT_ID` /
  `GOOGLE_CLIENT_SECRET`; ou ambos ausentes (provider desligado) ou ambos
  presentes (configuração ativa). Não colocar credenciais em `NEXT_PUBLIC_*`.
- `src/lib/auth-policy.ts` e `src/app/api/auth/[...all]/route.ts` — manter o
  bloqueio de signup por email e fazer `disableSignUp` social seguir a mesma
  flag pública; não confiar apenas no estado visual da página; registrar eventos
  OAuth com códigos sanitizados e sem PII/tokens.
- `src/app/(auth)/entrar/sign-in-form.tsx` e
  `src/app/(auth)/entrar/page.tsx` — CTA “Entrar com Google”, sem
  `requestSignUp`; estado de erro/carregamento; callback seguro e ação
  pontual de confirmação para Conta local ainda não verificada.
- `src/app/(auth)/cadastro/sign-up-form.tsx` e
  `src/app/(auth)/cadastro/page.tsx` — CTA “Criar conta com Google” com
  `requestSignUp:true`, apenas quando Google está configurado e cadastro público
  habilitado; perfil novo continua Student.
- Novo callback/continuação sob `src/app/(auth)/` — completar OAuth, chamar a
  política de sessão/retorno do Hub, lidar com Student bloqueado por meio do
  fluxo de sign-out já existente e evitar a navegação a uma resposta JSON.
- `src/features/payments/order-identity.ts` e
  `src/features/outbox/delivery.ts` — reconhecer qualquer conta de autenticação
  funcional, incluindo Google, ao selecionar ativação por senha versus aviso de
  acesso; resolver primeiro email exato e depois o endereço canonizado, somente
  quando o resultado for único e não ambíguo.
- `src/features/email/server.ts` e `src/features/email/templates.tsx` — e-mail
  de confirmação enviado somente quando a pessoa solicitar o vínculo de uma
  Conta local não verificada; sem envio automático global.
- Testes atuais dos arquivos acima, mais testes de integração de Better Auth,
  `src/features/payments/order-identity.test.ts`,
  `src/features/outbox/delivery.test.ts` e jornada E2E quando houver um provider
  simulado seguro.
- Documentação canônica de identidade/comércio/ambiente e
  `advisor-plans/README.md`.

## Fora de escopo

- Google OAuth One Tap, SSO/Organization, provider diferente de Google, Google
  Drive/API de produto, login nativo móvel, sincronização de perfil em cada
  login, troca de email e recuperação/transferência de Conta.
- Merge, transferência ou consolidação de duas Contas. A única reconciliação
  adicional permitida é localizar uma única Conta existente usando o email
  Google exato ou seu `normalizeBuyerEmail`; ambiguidade para sem escrita. Não
  canonizar globalmente todos os logins por email nem mudar o comportamento do
  cadastro por email neste sprint.
- Alterar regras de preço, identidade Asaas, Concessões, Matrículas ou
  precedência financeira. Os únicos ajustes de integração pagos são a busca
  segura por email exato/canonizado sem ambiguidades, a verificação após
  ativação e a classificação de uma Conta Google já funcional.
- Aplicar a migration em Staging/Production, alterar dados para resolver
  duplicidades, configurar clientes/consentimento no Google Cloud, gravar
  variáveis na Vercel, homologar no Staging ou publicar para Production. Cada
  passo exige autorização operacional separada. Esta implementação prevê
  migration somente em Development.
- Upgrade de Better Auth ou dependência npm adicional.
- Alterar arquivos do piloto Graphify (`.codex/skills/`, `.graphifyignore`,
  `AGENTS.md`, `.gitignore`, `graphify-out/`) ou reverter seus diffs locais.

## Plano de execução

### Etapa 0 — Pré-flight de identidade e integridade do banco

1. Em Development, executar somente leitura para localizar duplicidades em
   `accounts(provider_id, account_id)`. Se houver qualquer linha duplicada,
   parar e apresentar os IDs envolvidos para revisão controlada; nunca excluir
   ou mover vínculos automaticamente.
2. Rodar um relatório somente leitura que agrupe `users.email` pelo resultado
   de `normalizeBuyerEmail`, reutilizando `bun run ops:audit:buyer-identities`
   em modo `--summary`. Se houver colisões, não exibir e-mails no log; só abrir
   detalhes em Development com a confirmação read-only já exigida pelo script.
   Não publicar Google até essas colisões serem resolvidas ou explicitamente
   excluídas da reconciliação.
3. Adicionar ao schema Drizzle e migration o índice único
   `accounts_provider_account_unique_idx` em `(provider_id, account_id)`.
   Essa migration é uma nova dependência do plano: Better Auth 1.6.25 lê a
   identidade pelo par e insere o vínculo; o schema atual não garante
   unicidade sob concorrência.
4. Aplicar a migration somente no banco Development autorizado; conferir
   `db:migrations:check` e consulta pós-migration. Staging/Production não fazem
   parte desta execução e precisam de aprovação própria, preflight próprio e
   runbook correspondente.

**Verificar:**

```powershell
bun run db:migrations:check
bun run test -- src/db/course-certificate-signatory-migration.test.ts src/features/payments/identity-collision-audit.test.ts
```

Esperado: pré-flight sem conflito ou parada explícita; migration registrada no
ledger; o banco impede um segundo registro do mesmo provider/account, sem
alterar pedidos, users, perfis ou concessões.

### Etapa 1 — Caracterizar as intenções de entrar e cadastrar

1. Estender testes de `isBlockedAuthEndpoint`/política para provar que:
   - cadastro por email continua bloqueado com `AUTH_PUBLIC_SIGNUP_ENABLED=false`;
   - signup social com flag false ativa `disableSignUp` e não cria registros;
   - com flag true, signup explícito pode prosseguir;
   - tentativa comum de login social nunca passa `requestSignUp:true`.
2. Adicionar teste de configuração pura para Google ausente/parcial/completo e
   para combinação `disableImplicitSignUp=true` + `disableSignUp=!flag`.
3. Não mockar uma resposta feliz como evidência de não criação: verificar que
   Better Auth não recebe o pedido de signup no fluxo `/entrar` e que nenhum
   `users/accounts/profiles` é inserido no cenário sem Conta.
4. Especificar e testar a reconciliação do e-mail em um seam puro: comparar o
   e-mail Google exato e o endereço retornado por `normalizeBuyerEmail`; aceitar
   somente uma única Conta existente, rejeitar candidatos ambíguos e nunca
   transformar esse matching em merge.

**Verificar:**

```powershell
bun run test -- src/lib/auth-policy.test.ts src/app/api/auth/[...all]/route.test.ts
bun run typecheck
```

Esperado: testes do gate passam; nenhum signup social ocorre com a flag false;
login social sem `requestSignUp` não cria Conta; matching ambíguo falha sem
escrita.

### Etapa 2 — Configurar Google sem mudar a infraestrutura do Hub

1. Validar `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` como um par opcional;
   somente ambos presentes ativam o provider. Um par incompleto deve falhar
   fechando o processo com mensagem sem valor de segredo.
2. Em `createAuth`, registrar `socialProviders.google` somente com o par
   presente, usando o provider built-in e callback URI
   `${BETTER_AUTH_URL}/api/auth/callback/google`.
3. Definir `disableImplicitSignUp:true`, `disableSignUp:!AUTH_PUBLIC_SIGNUP_ENABLED`
   e `disableIdTokenSignIn:true`. Não habilitar `trustedProviders` para Google.
4. Preservar link implícito same-email do Better Auth para Conta local verificada;
   não ativar `disableImplicitLinking`. Deixar `updateUserInfoOnLink:false` e
   `allowDifferentEmails:false` explícitos ou cobertos por teste do default.
5. Usar `mapProfileToUser` de Better Auth 1.6.25 sem alterar `sub` nem
   `emailVerified`. Primeiro verificar se o mesmo `(google, sub)` já está
   vinculado; se estiver, deixar o lookup account-first do Better Auth autenticar
   essa Conta mesmo se o e-mail Google mudou. Para `sub` novo, comparar somente
   e-mail Google exato e `normalizeBuyerEmail`; mapear `email` ao candidato local
   apenas se ambos resultarem em uma única `users.id`. Zero candidatos mantém o
   e-mail Google para signup explícito; múltiplos abortam antes de qualquer
   criação/vínculo. Nunca mapear nome, papel ou campos financeiros. Testar a
   ordem account-first e o comportamento de erro do mapper na versão 1.6.25.
6. Definir `account.encryptOAuthTokens:true`; não pedir acesso offline/refresh nem
   scopes de produto. O código Google 1.6.25 usa OIDC `sub`, valida issuer,
   audience, expiração e nonce e exige code verifier no fluxo redirect.
7. Passar para páginas de login/cadastro apenas um booleano público
   `googleLoginEnabled`; nunca enviar client secret nem tornar credenciais
   `NEXT_PUBLIC_*`.
8. Configurar `emailVerification.sendVerificationEmail` para uma ação de
   confirmação solicitada pelo usuário, mantendo
   `emailAndPassword.requireEmailVerification` desativado e
   `emailVerification.sendOnSignUp`/`sendOnSignIn` falsos. Não transformar a
   confirmação pontual em gate global.

**Verificar:**

```powershell
bun run test -- src/lib/env.test.ts src/lib/auth-policy.test.ts
bun run typecheck
```

Esperado: sem credenciais o provider não está registrado e o restante do Hub
inicia como hoje; credenciais parciais falham no preflight; par completo constrói
o provider; nenhum segredo aparece em erro/HTML/log.

### Etapa 3 — Separar Google login de Google signup na interface e callback

1. Em `/entrar`, adicionar botão “Entrar com Google” somente quando o provider
   está configurado; iniciar `authClient.signIn.social({provider:"google"})`
   sem `requestSignUp`.
2. Refletir `AUTH_PUBLIC_SIGNUP_ENABLED` na página `/cadastro`: quando false,
   ocultar os formulários/CTAs de criação e mostrar estado claro com retorno a
   `/entrar`. Quando true, mostrar o cadastro por email atual e o CTA “Criar conta
   com Google” somente se o provider estiver configurado.
3. O CTA Google de `/cadastro` passa `requestSignUp:true`; o de `/entrar` nunca
   passa esse campo. Se a flag estiver desligada, a configuração Better Auth
   `disableSignUp:true` impede também o cadastro social explícito.
4. Preservar `returnTo` usando `getSafeAuthReturnTo`; passar `callbackURL`,
   `newUserCallbackURL` e `errorCallbackURL` apenas como destinos internos.
5. Criar callback/continuação de navegador que consome sessão e aplica a política
   existente: Student ao retorno `/comprar/<slug>` ou `/app`, Admin/Suporte a
   `/admin`, Student bloqueado encerra sessão e recebe a mesma orientação de
   suporte. `/api/auth/redirect` atual retorna JSON e deve continuar compatível
   com os formulários de email.
6. Erros de provider, email inexistente, `account_not_linked` e falha de callback
   devem usar mensagem pública genérica; não exibir token, email de outro usuário
   nem erro cru do OAuth. Cancelamento voluntário volta à página apropriada sem
   alarme de erro. Em caso de Conta ainda não ativada ou endereço divergente, a
   mesma mensagem genérica oferece recuperação/primeiro acesso pelo e-mail da
   compra, sem confirmar a existência de Conta.
7. Para uma Conta local existente e não verificada que bloqueou o vínculo
   implícito, oferecer uma ação pontual “Enviar link de confirmação” com campo
   de e-mail e mensagem pública genérica. O endpoint `/send-verification-email`
   do Better Auth só envia para Conta real não verificada, mas responde de modo
   indistinguível para inexistente/já verificada; validar também rate limit. O
   link retorna a `/entrar` para tentar Google novamente. Não enviar em todo
   callback OAuth nem tornar o cadastro globalmente dependente de confirmação.
8. Registrar início/falha/sucesso do fluxo OAuth com códigos operacionais
   sanitizados. Não registrar query string, endereço de e-mail, `sub`, token,
   `state`, `code` nem `error_description` do provider.

**Verificar:**

```powershell
bun run test -- "src/app/(auth)/entrar/sign-in-form.test.tsx" "src/app/(auth)/cadastro/sign-up-form.test.tsx" src/app/api/auth/redirect/route.test.ts
bun run typecheck
```

Esperado: `/entrar` nunca pede signup; `/cadastro` só oferece criação com flag
habilitada; retorno inválido cai em `/app`/`/admin` conforme papel; blocked
Student é deslogado; erros não enumeram Conta; resposta JSON atual de email
continua sem regressão.

### Etapa 4 — Garantir a reconciliação segura do primeiro acesso pago

1. Adicionar `emailAndPassword.onPasswordReset` com atualização idempotente de
   `users.email_verified=true` somente depois de Better Auth consumir o token
   único de reset e atualizar a senha. O token é enviado ao email já cadastrado;
   o clique e a senha definida passam a ser a prova local de controle. Não usar
   `requireLocalEmailVerified:false`.
2. O callback roda após a gravação da credencial, não na mesma transação. Tratar
   falha de atualização como estado recuperável: não dizer que ativou; preservar
   o erro genérico da UI; instruir a solicitar novo link em `/recuperar-senha`;
   logar código técnico sem email, token ou URL. O reenvio deve funcionar mesmo
   que a credencial já exista. Testar repetição, token inválido e falha da
   segunda escrita após a senha mudar.
3. Após o reset, login Google com mesmo email verificado deve vincular o provider
   ao `users.id` original. `users`, `profiles`, `orders`, Concessões e Matrículas
   não são recriados nem alterados por vínculo; apenas nova linha
   `accounts(provider_id="google", account_id=Google sub, user_id=existing id)`.
4. Ajustar a classificação da ativação no processor/outbox para considerar
   método realmente disponível: credencial local ou provider social com vínculo
   e configuração ativa no ambiente. Conta Google-only que compra recebe aviso
   de acesso; Conta sem método utilizável continua recebendo ativação por email.
5. Manter payment-first: Checkout guest continua sem login; conta, perfil,
   Concessão e Matrícula só surgem após evidência financeira autoritativa. Login
   Google nunca cria grant. O login de Admin/Suporte preserva papel; bloqueio de
   plataforma, conta de equipe e matrícula revogada continuam falhando fechado
   no resolver financeiro.
6. Na reconciliação de compra, procurar primeiro o e-mail original informado e
   depois o endereço canonizado do comprador; se ambos apontarem a `users.id`
   diferentes, abrir falha de identidade e não conceder nem duplicar Conta.
   Isso permite que uma compra guest com o mesmo endereço de um Google signup
   reutilize aquela Conta sem alterar a precedência financeira.

**Verificar:**

```powershell
bun run test -- src/features/payments/order-identity.test.ts src/features/outbox/delivery.test.ts
bun run typecheck
```

Esperado: usuário comprado permanece `emailVerified=false` antes da ativação;
token de reset consumido com sucesso define true; falha da atualização é
recuperável; Google vincula ao mesmo usuário após a ativação; provider Google
preexistente elimina email de ativação por senha; evento financeiro, grant,
auditoria e matrícula seguem idempotentes; lookup de email ambíguo falha sem
duplicar identidade.

### Etapa 5 — Provar os fluxos sem depender de credencial Google real

1. Usar um provider simulado/fake no teste de integração Better Auth (ou um seam
   de teste pequeno e explícito) para exercer a callback completa. Não acessar
   Google externo na CI e não salvar tokens reais em fixtures.
2. Cobrir pelo menos:
   - `/entrar`, Google `sub` existente: sessão da mesma Conta;
   - `/entrar`, email sem Conta: signup implícito negado e zero writes;
   - `/cadastro`, flag false: signup negado;
   - `/cadastro`, flag true: um user/account/profile Student, sem Pedido/Grant;
   - signup por email permanece com sessão imediata e retorno de Curso quando
     a verificação global está desligada;
   - mesma Conta verificada, `sub` Google novo: link automático sem atualizar
     nome/email/papel;
   - email original e canonizado apontando à mesma Conta: reutilizar essa
     `users.id`; candidatos apontando a duas Contas: falhar sem escrita;
   - Conta local não verificada: nenhum link/Conta duplicada até email activation;
   - Conta email/password local não verificada: implicit link falha sem escrita;
     pedir confirmação tem resposta genérica; após o link de verificação, Google
     vincula à mesma `users.id`;
   - endereço inexistente ou já verificado no endpoint de confirmação: mesma
     resposta pública e nenhum e-mail indevido;
   - `sub` já linkado: email atual diferente não move a Conta para outro `userId`;
   - Admin/Suporte, Student bloqueado, returnTo externo, repetido ou inválido;
   - free-course signup volta ao handoff e só a action autenticada cria
     `free_enrollment`;
   - guest paid checkout + webhook + ativação + Google: mesma Conta, um grant,
     uma matrícula, nenhum efeito financeiro duplicado;
   - Google-only account + compra: aviso de acesso, não reset de senha.
   - duas callbacks concorrentes para o mesmo `(provider_id, account_id):`
     no máximo uma linha de vínculo e nenhuma associação do `sub` a duas Contas;
   - reset grava credencial, falha a escrita de verificação e permite reenvio
     seguro de link sem registrar PII.
3. Fazer um smoke manual em Development quando um Client ID/secret de teste
   estiver configurado. O smoke confirma cadastro social com flag true, logout,
   login existente, callback/returnTo e erro para unknown email. Não usar dados ou
   credenciais reais de comprador.

**Verificar:**

```powershell
bun run test -- src/app/api/auth/[...all]/route.test.ts src/app/api/auth/redirect/route.test.ts "src/app/(auth)" src/features/payments/order-identity.test.ts src/features/outbox/delivery.test.ts
bun run test -- tests/e2e/critical-journeys.spec.ts
bun run typecheck
bun run check
bun run docs:check
```

Esperado: unit/component/route tests e E2E relevante passam; OAuth e checkout
preservam o mesmo `users.id`; índice evita vínculo duplicado; lint/typecheck/docs
sem erro. E2E deve usar provider simulado ou ambiente Development explicitamente
preparado, nunca depender de conta Google real em CI.

### Etapa 6 — Configuração operacional e homologação

1. Documentar o par opcional de credenciais em `.env.example` e no runbook de
   ambiente; registrar que o segredo não pode ser `NEXT_PUBLIC_*` nem commitado.
2. No Google Cloud Console, configurar OAuth Web Client com URI exata
   `${BETTER_AUTH_URL}/api/auth/callback/google` para localhost, Staging e
   Production, e origem JavaScript conforme o domínio. Usar HTTPS fora de
   localhost. Separar client IDs por ambiente quando viável.
3. Configurar credenciais Development primeiro; validar consent screen, domínio
   verificado e política Google atual. Credenciais Vercel Staging/Production,
   mudança de `AUTH_PUBLIC_SIGNUP_ENABLED` e deploy não fazem parte deste plano
   sem autorização operacional específica.
4. Em uma etapa operacional futura, homologar em Staging: cadastro novo somente
   em `/cadastro` quando flag ligada; login de unknown sem criação; paid checkout
   guest do início à ativação e Google; role/admin/support; free course return.
   Preflight e migração devem ser avaliados no ambiente alvo antes de habilitar
   credenciais. Isso requer autorização separada; só outra decisão autoriza
   Production.

**Verificar:** OAuth callback contém os IDs/cookies esperados sem logs de tokens;
URIs registradas correspondem exatamente a `BETTER_AUTH_URL`; credenciais
Development e outros ambientes separados; Staging/Production permanecem
inalterados nesta execução.

## Plano de testes

- Unitários: política do signup request/flag, config pair de Google, verificação
  após reset, fluxo pontual de envio de verificação, lookup exato/canonizado sem
  ambiguidade e erro OAuth genérico.
- Route/component: mock dos resultados de `authClient.signIn.social`; login não
  envia `requestSignUp`; cadastro envia somente com feature disponível; callback
  segue `/api/auth/redirect`, encerra sessão bloqueada e não registra dados
  sensíveis.
- Integração DB/Better Auth: `users`, `accounts`, `profiles`; comprovar zero
  criação em login unknown, vínculo exato, preservação de `userId`/papel e
  rejeição de local `emailVerified=false`; unicidade de `(provider_id,
  account_id)` e falha fechada para candidatos canônicos ambíguos.
- E2E: estender `tests/e2e/critical-journeys.spec.ts` para o caminho de
  ativação/primeiro acesso e free signup; provider simulado. Smoke com Google real
  somente manual no Development/Staging configurado.
- Verificação global permanece desligada: email signup mantém sessão e
  `returnTo`; somente a solicitação explícita de vínculo usa
  `/send-verification-email`, com resposta anti-enumeração.
- Cobertura de compra: modelar activation intent, `provider_id='credential'`
  versus Google-only, ordem financeira idempotente, sem criar acesso no login.
- Migration: preflight interrompe diante de duplicidade; índice rejeita segundo
  insert; aplicar somente em Development nesta etapa.

## STOP conditions

- `better-auth` não estiver em `1.6.25` no início do trabalho; revalidar as
  opções e security advisory do pacote exato, sem atualizar automaticamente.
- Pré-flight de `accounts(provider_id, account_id)` encontrar duplicidade; não
  criar o índice até revisão e decisão manual para cada par.
- Pré-flight de `normalizeBuyerEmail(users.email)` encontrar mais de uma
  `users.id` para uma identidade canônica; não escolher uma nem mesclar.
- Uma Conta existente tem `emailVerified=false` e o produto não aceita concluir
  primeiro a ativação email; não desativar a guarda local para avançar.
- Contas locais não verificadas não têm um caminho testado para solicitar
  confirmação pontual e depois repetir Google; não habilitar vínculo implícito
  sem essa recuperação.
- A configuração necessária para login e signup separados exigir
  `disableSignUp:true` global ou impedir `requestSignUp:true` no signup; reavaliar
  o provedor antes de editar UI.
- `AUTH_PUBLIC_SIGNUP_ENABLED` estiver desligado mas a decisão de produto for
  permitir cadastro social; pedir ratificação em vez de criar um bypass da flag.
- Produto passar a exigir que um Google signup só crie Conta quando
  `email_verified=true`; a versão instalada não tem o gate de validação pré-
  criação documentado nas versões posteriores. Definir versão/hook e testes
  próprios antes de prosseguir.
- Um email Google normalizado encontra múltiplas Contas/candidatos ou colide com
  o buyer normalizer; não escolher uma identidade automaticamente nem migrar
  emails sem plano separado.
- O callback social não puder reutilizar a validação de papel, bloqueio e
  returnTo sem permitir open redirect ou manter sessão Student bloqueada.
- `mapProfileToUser` não puder abortar com segurança quando houver candidatos
  locais ambíguos, sem gravar uma Conta para contornar a colisão.
- Não houver forma de testar callback e zero writes sem segredo ou conta Google
  real; criar um seam de teste, não colocar segredo em CI.
- Falha de `onPasswordReset` produzir senha alterada mas email ainda não
  verificado sem caminho testado para solicitar novo link; não habilitar OAuth.

## Critérios de conclusão

- [ ] Login Google desconhecido nunca cria `users`, `accounts`, `profiles`, Pedido,
      Concessão ou Matrícula.
- [ ] Social signup cria uma Conta apenas quando iniciado explicitamente no
      `/cadastro` e `AUTH_PUBLIC_SIGNUP_ENABLED=true`; signup email existente
      permanece compatível.
- [ ] Same-email link válido preserva `users.id`, perfil/role, perfil local,
      histórico financeiro e grants; o Google `sub` fica vinculado a essa Conta.
- [ ] Conta local não verificada continua protegida até prova de controle do
      email; não se usa o bypass depreciado `requireLocalEmailVerified:false`.
- [ ] `emailAndPassword.requireEmailVerification` permanece desligado; signup
      atual mantém sessão/retorno. Contas locais antigas não verificadas têm
      confirmação pontual anti-enumeração para vincular Google.
- [ ] Conta Google-only paga não recebe password activation se já tem método de
  login ativo; compra guest continua payment-first.
- [ ] O checkout não solicita login/cadastro; antes da evidência financeira não
      cria identidade/acesso; depois da compra, ativação e Google preservam a
      mesma `users.id`.
- [ ] Índice único de identidade provider passou pelo preflight e foi testado
      somente em Development; Staging/Production não foram alterados.
- [ ] Admin/Suporte/blocked Student/returnTo mantêm autorização, redirecionamento
      e mensagens sem enumeração.
- [ ] Não houve dependência NPM adicional; somente a migration defensiva foi
      aplicada em Development após preflight; Staging/Production e credenciais
      externas ficaram intocados.
- [ ] `bun run typecheck`, os testes indicados, `bun run check` e
      `bun run docs:check` passam.
- [ ] Todos os arquivos do piloto Graphify preexistentes foram preservados; não
      há commit/push sem solicitação.

## Git workflow

- Trabalhar em worktree isolada. A worktree atual `codex/graphify-adoption` tem
  alterações Graphify não commitadas; preserve-as e não misture/suprima seus
  arquivos. Se o executor precisar de isolamento adicional, crie uma nova
  worktree e inclua a skill Graphify como ferramenta de trabalho, sem copiar
  artefatos `graphify-out`.
- Não commitar, pushar, abrir PR nem alterar `staging`/`main` sem pedido explícito.
- Antes do commit autorizado, usar `bun x ultracite fix`, `bun run check` e
  CodeRabbit conforme `docs/operations/code-review-with-coderabbit.md`.

## Manutenção

- Better Auth `disableImplicitSignUp`, `requestSignUp` e account-linking guard
  são contratos de segurança; revisar changelog e tipos da versão instalada antes
  de upgrades. Não adotar APIs documentadas somente em Better Auth 1.7.x sem
  revisão e testes do upgrade.
- Se um segundo provider for incluído, não herdar automaticamente o trust do
  Google; reavaliar email-verification claims, aliases e linking por provider.
- Matching por `normalizeBuyerEmail` só localiza uma Conta existente quando o
  preflight confirma unicidade; nunca converte alias em merge ou transferência.
  A política global de normalização dos demais cadastros continua fora deste
  escopo.
