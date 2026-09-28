---
status: reviewed
owner: product-and-engineering
reviewed_on: 2026-09-27
scope: second review of Google OAuth plan, purchase-first access, identity reconciliation
---

# Segunda revisão do plano de Login Google

## Veredito

A direção do plano está correta, mas a versão anterior ainda não estava pronta
para implementação: preservava a compra sem cadastro prévio e separava
`/entrar` de `/cadastro`, porém não protegia a unicidade da identidade OAuth no
banco e deixava a ativação pós-compra pouco especificada. O plano principal foi
refinado para incluir esses controles e testes antes de habilitar o provider.

Não recomendo pedir cadastro, senha ou Google antes do pagamento. A solução
mais simples para quem compra continua sendo concluir o checkout primeiro e
resolver a Conta depois da confirmação financeira.

## Fluxo de compra recomendado

1. A pessoa abre `/comprar/[slug]` e paga como visitante. Login e Google são
   opcionais, nunca uma barreira do checkout.
2. Só a evidência financeira autoritativa cria/resume a identidade local e
   projeta a concessão e a matrícula. Um retorno do navegador ou login Google
   isolado não concede curso.
3. Para uma Conta sem método de acesso, o Hub envia o link de primeiro acesso
   para o e-mail do pedido. Hoje ele permite criar a senha e, depois, ir para
   `/entrar`; não é um login automático. Após consumir esse link, o Hub também
   precisa marcar o e-mail local como verificado, para que o primeiro vínculo
   Google preserve a proteção da biblioteca.
4. Depois da ativação, “Entrar com Google” reconcilia a identidade verificada
   com o `users.id` original. A pessoa mantém o mesmo perfil, pedido, concessão
   e matrícula.
5. Se alguém tenta Google antes de ativar uma Conta de compra, não se cria uma
   segunda Conta nem se revela se o e-mail existe. A mensagem deve orientar,
   sem acusar erro, a abrir o link de primeiro acesso ou usar a recuperação de
   senha com o e-mail da compra.

Esse desenho mantém a compra sem interrupção e limita a etapa adicional à
ativação que o Hub já envia depois da compra. Não transforma o pagamento em uma
decisão de autenticação.

### O que dizem as fontes de produto

- A Teachable documenta coleta do e-mail e pagamento antes de concluir o
  cadastro de primeira compra; a ativação começa no pós-compra. [Compra de um
  produto](https://support.teachable.com/en/articles/15628322-buy-a-product-on-teachable),
  [checkout atual](https://support.teachable.com/en/articles/15646496-customize-your-checkout-page).
- A Hotmart cria a Conta a partir do e-mail da primeira compra e documenta que
  entrar com outra Conta Google pode mostrar uma Conta sem as compras. Isso
  reforça a importância de reconciliar a identidade da compra, mas não prova
  como ela vincula identidades OAuth. [Primeiro
  acesso](https://help.hotmart.com/pt-br/article/215827338/como-acesso-o-produto-que-comprei-na-hotmart),
  [opções de login](https://help.hotmart.com/pt-br/article/39413024793613).
- Shopify deixa o login pré-checkout configurável e alerta que exigir login
  pode suprimir métodos acelerados; Stripe permite Checkout sem Customer
  preexistente e diferencia Customer de Conta autenticável. São analogias de
  e-commerce/pagamentos, não prova direta para cursos ou Asaas. [Shopify:
  checkout](https://help.shopify.com/en/manual/checkout-settings/checkout-form-options),
  [Stripe: guest customers](https://docs.stripe.com/payments/checkout/guest-customers).
- Nenhuma fonte consultada demonstra por experimento qual variante converte
  melhor no público, preço, região, gateway ou tráfego do Hub. Se o funil de
  ativação pós-pagamento apresentar abandono, medir o funil real antes de mudar
  a regra de segurança.

## Achados que mudam o plano

### 1. A tabela `accounts` precisa de uma invariante no banco

No Hub, `accounts` tem apenas o índice por `user_id`; não há unicidade para o
par de identidade do provider. No Better Auth 1.6.25, o callback localiza por
`(provider_id, account_id)` e `linkAccount` insere uma linha. Dois callbacks
concorrentes podem ultrapassar a leitura prévia e inserir a mesma identidade
Google duas vezes. A verificação da aplicação não substitui uma restrição
única.

O plano agora inclui índice único em `(provider_id, account_id)` e um
pré-flight de duplicidades. Se já houver pares repetidos, parar para
reconciliação manual: não remover, reatribuir ou mesclar `accounts` sem decisão.
Essa mudança adiciona uma migration; o plano anterior estava errado ao dizer
que nenhuma era necessária. A migration fica local/Development nesta fase; não
autoriza aplicar nada em Staging ou Production.

Referências: [Better Auth 1.6.25 — link account](https://github.com/better-auth/better-auth/blob/v1.6.25/packages/better-auth/src/oauth2/link-account.ts),
[internal adapter: busca e insert](https://github.com/better-auth/better-auth/blob/v1.6.25/packages/better-auth/src/db/internal-adapter.ts),
[schema atual do Hub](../src/db/schema.ts) e
[migration inicial](../src/db/migrations/0000_fast_firelord.sql).

### 2. Ativação paga e segurança precisam falhar de forma recuperável

O comprador pago nasce com `email_verified=false`. O link de primeiro acesso
consome um token do Better Auth e cria/atualiza a credencial, mas a versão
1.6.25 não marca esse e-mail como verificado. O callback `onPasswordReset` roda
depois da gravação da credencial; portanto essa atualização de verificação não
é atômica com a senha. Se a segunda escrita falhar, a senha pode estar pronta,
o token consumido e o e-mail ainda não verificado.

O plano passa a exigir comportamento idempotente, alerta público neutro,
telemetria sem PII e caminho de recuperação por um novo link. O estado atual
`/redefinir-senha` já permite solicitar outra recuperação quando o token é
inválido; o teste deve cobrir também falha da escrita de `email_verified` após
reset. Não baixar a guarda de vinculação local para contornar essa lacuna.

Referência: [Better Auth 1.6.25 — reset-password callback](https://github.com/better-auth/better-auth/blob/v1.6.25/packages/better-auth/src/api/routes/password.ts).

### 3. E-mail é âncora inicial; `sub` é a identidade durável

O código 1.6.25 do Better Auth procura uma Conta existente por `sub` e provider;
sem vínculo, usa e-mail em minúsculas para encontrar o usuário local. O Hub
normaliza endereços de compra (incluindo regras de Gmail e `+tag`), enquanto o
Better Auth não aplica essa regra automaticamente. A versão 1.6.25 permite
mapear o perfil Google antes da busca local; o plano agora usa esse seam de
forma restrita: primeiro preservar o lookup account-first para um `sub` já
vinculado (mesmo se o e-mail mudar); para um `sub` novo, procurar o e-mail exato
e canonizado e selecionar apenas uma Conta local, preservando os claims `sub`
e `emailVerified` do provider. A mesma busca considera o e-mail original e
canonizado na resolução pós-pagamento.

Se mais de uma `users.id` corresponder, falhar antes de qualquer criação ou
vínculo. Reutilizar `ops:audit:buyer-identities` para detectar colisões
canônicas antes de habilitar OAuth; não mesclar nem escolher por ordem. Esse
matching não transforma aliases em uma política global de login nem cobre toda
variação arbitrária futura; a ativação por e-mail/senha continua sendo fallback.
Uma identidade canônica global ainda seria trabalho separado.

Referências: [Better Auth 1.6.25 — `findOAuthUser`](https://github.com/better-auth/better-auth/blob/v1.6.25/packages/better-auth/src/db/internal-adapter.ts),
[Google OIDC](https://developers.google.com/identity/openid-connect/openid-connect)
e [normalizador de compradores do Hub](../src/features/payments/buyer-identity.ts).

### 4. Login desconhecido, cadastro e mensagens públicas

`/entrar` nunca envia `requestSignUp`; com `disableImplicitSignUp`, Google
desconhecido falha sem criar user, account, profile ou acesso. `/cadastro` pode
enviar `requestSignUp: true` apenas quando `AUTH_PUBLIC_SIGNUP_ENABLED=true`.
Com a flag desligada, a página de cadastro precisa mostrar estado indisponível
em vez de um formulário que o servidor recusará.

Mensagens de OAuth — e-mail desconhecido, Conta local ainda não ativada, login
cancelado ou falha de provider — não devem revelar existência/estado de uma
Conta. Para não deixar um comprador perdido, sempre oferecer o caminho geral de
primeiro acesso/recuperação e o link de cadastro, sem dizer qual caso ocorreu.
Para uma Conta local existente mas não verificada, o plano recomendado oferece
uma ação opcional para pedir um link de confirmação; o endpoint do Better Auth
responde de forma não enumerável. Não envia verificação automaticamente em
todo cadastro ou login.

### 5. O callback precisa preservar o fluxo do Hub

`/api/auth/redirect` é uma resposta JSON usada pelos formulários de e-mail; não
é destino final para redirecionamento de navegador OAuth. A continuação deve
consultar a sessão criada no callback, reaproveitar papel/bloqueio/retorno
seguro, encerrar sessão de Student bloqueado e voltar à compra com o
`returnTo` validado. O callback não pode inferir papel do Google nem mostrar
query/token bruto.

O `/entrar` é compartilhado por Student, Admin e Suporte. Se Google for
habilitado ali, pode autenticar todos esses papéis quando o e-mail local for
elegível; o perfil/role existente continua sendo a fonte de autorização. O
Hub não impõe MFA interno atualmente, então Google não deve ser apresentado
como MFA garantido. Não ampliar para Google One Tap nesta entrega.

### 6. Verificação global não é a escolha recomendada

Better Auth 1.6.25 tem `emailAndPassword.requireEmailVerification`, mas ele
barra sessões por email/senha, não sessões Google. Se ligado, o signup por email
cria a Conta sem sessão e exige o callback de envio; a tela atual supõe sessão
imediata para preservar o retorno de autoinscrição gratuita. O callback global
também não seria enviado hoje para usuários não verificados. Portanto, não
recomendo ligar essa flag como parte do Google login.

Isso não significa que a compra verifica o email. O pagamento autoriza o grant;
o clique no link de primeiro acesso prova controle da caixa postal. Para os
usuários antigos de email/senha que continuam `emailVerified=false`, uma
confirmação solicitada quando tentam conectar Google resolve o vínculo sem
forçar confirmação de todos os cadastros nem mudar o checkout.

## Alternativas rejeitadas

- **Cadastro antes de pagar:** aumenta decisões antes da confirmação e não é
  necessário para conceder o acesso depois do webhook. Mantê-lo opcional, nunca
  requisito.
- **Permitir Google fazer login e cadastro indistintamente:** contraria a
  intenção separada definida pelo produto e pode criar Conta Student vazia.
- **Ignorar `email_verified` local para vincular compra:** contorna uma proteção
  de pré-sequestro de Conta corrigida no Better Auth 1.6.11; não é uma
  simplificação aceitável. [Advisory](https://github.com/better-auth/better-auth/security/advisories/GHSA-g38m-r43w-p2q7).
- **Usar API de Better Auth 1.7 sem atualizar o pacote:** o Hub está em
  1.6.25; upgrade também altera schema/identidade e fica fora do sprint.

## Go/no-go atualizado

Antes de habilitar Google num ambiente:

1. Confirmar que Better Auth ainda é 1.6.25 e revisar opções no código/tipos da
   versão instalada.
2. Rodar pré-flight read-only de duplicidades `(provider_id, account_id)`;
   duplicidade => parar e resolver manualmente.
3. Aplicar e testar o índice único somente em Development com migration do
   projeto; ambientes compartilhados exigem aprovação operacional própria.
4. Testar login unknown (zero writes), `/cadastro` com flag ligada/desligada,
   signup com sessão imediata, local não verificado -> link genérico -> Google,
   compra guest -> ativação -> Google no mesmo `users.id`, retorno seguro, perfil
   Admin/Suporte/Student, bloqueio, alias e callbacks concorrentes. Garantir que
   `emailAndPassword.requireEmailVerification` continua desligado.
5. Só então configurar credenciais próprias para Development. Não gravar
   segredo em `.env.example`, logs, CI ou `NEXT_PUBLIC_*`.

O plano final e sua sequência detalhada estão em
[`google-login-implementation-plan-2026-09-27.md`](google-login-implementation-plan-2026-09-27.md).
