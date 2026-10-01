---
status: accepted
owner: engineering
last_verified_commit: 1281437830592c795035659c26cfb6fb6a20c66e
---

# Plano aceito: identidade, entrada social, convites e perfil

## Registro de execução

| Etapa | Status | Resumo |
|---|---|---|
| 0. Decisões, baseline e gates | Concluída | DEC-DISC-020 foi identificado como contrato a emendar; Graphify atualizado e consultado; baseline e testes auth passaram. Contagem de dados compartilhados foi adiada ao gate de rollout; nenhum banco foi acessado. |
| 1. Cadastro social-first e desafios de e-mail | Concluída (código local; migration aplicada em Development isolado) | Cadastro e-mail agora é confirmação-first, sem senha, Conta ou sessão antes da prova; desafio HMAC de uso único e propósito, rate limit HMAC por e-mail/IP e falha fechada se IP confiável faltar em produção, outbox, GET sem mutação e POST explícito. Ordem de locks alinhada; pendências/desafios/limites têm cleanup no maintenance. Migration 0097 aplicada ao Neon isolado indicado pelo usuário. |
| 2. Política de associação Google | Concluída com escopo ajustado | Mantida prova local para todo primeiro vínculo, em linha com DEC-DISC-020/REG-IDA-008. Exceção condicional Gmail/Workspace adiada por falta de hook suportado no Better Auth 1.6.25; nenhum bypass global foi criado. |
| 3. Confirmação de compra e outbox | Concluída; decisão de entrega refinada no review de 2026-10-01 | Novos Pedidos usam `email.purchase-confirmed` e ledger durável. O CTA é resolvido na primeira preparação da entrega com o estado atual da Conta, depois persistido para retries. Migration 0103 aplicada somente no Neon isolado de E2E; Development compartilhado, Staging e Production não foram alterados. Publicação Hosted e cutover das mensagens legadas continuam gates editoriais/operacionais. |
| 4. Convites Admin/Suporte | Concluída (código local; migration aplicada em Development isolado) | Fluxo antigo de promoção direta removido e bloqueado no servidor; convite Admin/Suporte com geração HMAC, preview sem mutação e aceite POST atômico, expiração de 7 dias, reenvio/cancelamento, grants allowlisted, conversão segura de Student legado, auditoria e outbox. Revisão independente identificou e corrigiu seis falhas/riscos. Expiração ligada ao job de manutenção e coberta por teste. Migration 0099 aplicada; concorrência real no PostgreSQL e publicação do alias `staff-invitation` seguem pendentes. |
| 5. Perfil compartilhado | Refinada em 2026-09-30 (OAuth real pendente de ambiente) | Student não usa Tabs/Scrollspy; seções verticais em coluna centralizada `max-w-4xl`. Um Card reúne avatar, nome e e-mail; métodos de entrada Google ficam na mesma área Perfil. Admin/Support com acesso global usa três tabs amplas no estilo da edição de Aula: Perfil, Certificados e Plataforma. A largura de toda a página de Configurações Admin/Support é `max-w-4xl`; Support sem `viewSettings` vê Perfil diretamente, sem barra de tabs. URLs antigas `?tab=acesso` mapeiam para Perfil e os tabs legados da Plataforma continuam mapeados para Plataforma. Painéis montados preservam estado e conteúdo inativo é ocultado explicitamente. Nome/e-mail usam InputGroups com ação alinhada; avatar pode ser alterado pelo clique na imagem ou por botão, e removido pelo botão textual. Criação/alteração de senha saíram das Configurações; o link por e-mail em `/recuperar-senha` continua sendo a única forma de definir/recuperar credencial. Nenhuma migration nova. Verificação desta atualização: testes dirigidos, typecheck, Ultracite e documentação. OAuth real depende de credenciais/callback; CodeRabbit sem seat. |
| 6. Rollout e homologação | Em andamento (E2E isolado concluído; Staging/Production intocados) | Preflight de identidades Google passou (`safeToApply=true`, sem colisões); cadeia de migrations aplicada ao Neon isolado indicado pelo usuário até 0103 e ledger conferido. O marcador semântico do inspetor para 0085 fica `absent` porque há grants válidos em um perfil Support; hash e constraints estão presentes/validados. E2E completo: 52/52 passaram em Chromium desktop e mobile no Neon dedicado; migrations, seed, servidor e teardown carregam `.env.e2e.local` sem alterar `.env.local`. `verify:quick`: 525 arquivos de teste, 3.718 passaram e 1 skip condicional; typecheck, Ultracite, `docs:check` e migrations também passaram. Corrigida corrida na confirmação de reembolso: o formulário não aparece enquanto a consulta assíncrona de credenciais está pendente, evitando perda da senha e submit inválido no desktop. O plugin Vercel confirma Staging READY no SHA `a02df60a517ee4d8072beb6d13365b37a61734cc`, anterior ao candidato local; busca GitHub não encontrou PR aberto para a branch atual. O catálogo Resend compartilhado tem 6/10 aliases publicados; `purchase-confirmed`, `email-change-confirmation`, `email-change-notice` e `staff-invitation` aguardam revisão editorial, teste controlado e publicação manual. CodeRabbit sem seat. Nenhuma migration ou deploy foi feita em Staging/Production. |

## Objetivo e decisão executiva

Reorganizar os fluxos de identidade como um único ciclo coerente, sem misturar prova de e-mail, confirmação de compra, autenticação, criação de senha e concessão de papel.

Recomendação:

1. Manter Google como entrada principal, mas preservar a separação entre **Entrar** e **Criar conta**. Login nunca provisiona uma Conta nova.
2. Continuar exigindo prova local de e-mail antes de associar automaticamente Google a uma Conta já existente. Não remover o bloqueio local de vinculação.
3. Não persistir uma senha escolhida pelo visitante antes de provar acesso à caixa. Apenas ligar a opção de verificação do Better Auth não basta para este contrato.
4. Enviar uma única confirmação de compra depois do evento pago autoritativo. Se o e-mail ainda não estiver verificado, o botão principal confirma o e-mail; se já estiver verificado, leva ao Curso. Nenhum desses e-mails redefine senha.
5. Usar convite pendente e aceitação explícita para Admin/Suporte. O papel só é aplicado na aceitação; convite não habilita cadastro público.
6. Integrar “Minha conta” às Configurações próprias de cada papel: `/app/configuracoes` para Student e `/admin/configuracoes` para Admin/Support. Não manter rota alternativa ou redirecionamento de Conta. Sem `viewSettings`, Support acessa somente seus dados pessoais; nunca configurações globais.
7. Preservar o RBAC e a decisão atual de não adotar MFA administrativo. MFA fica fora deste escopo, embora continue sendo um risco residual relevante para papéis privilegiados.

O plano mantém compra antes da criação/ativação da Conta, não transforma pagamento Asaas em prova de posse do e-mail, não cria compra para terceiros e não altera a regra de inscrição gratuita: autenticação e confirmação explícita de inscrição continuam sendo ações separadas.

## Estado atual verificado

Auditoria read-only do worktree codex/staging-oauth-rebuild, commit abb3b3ecae681dd5eea4da839ace41e2b926431c. Não foram consultados bancos nem alterados código, migrations ou templates externos.

- AUTH_PUBLIC_SIGNUP_ENABLED tem padrão false. Quando habilitado, /cadastro aceita email/senha e Google explícito. O login Google não deve criar Conta; os testes atuais cobrem essa distinção.
- A tela de cadastro usa signUpEmail, exige senha e espera uma sessão logo após a criação. emailAndPassword.requireEmailVerification e emailVerification.sendOnSignUp estão desligados.
- A associação automática de Google usa o sub como identidade do provedor e preserva nome, e-mail e papel locais. Better Auth 1.6.25 exige e-mail local verificado para associação implícita por padrão. Essa proteção foi mantida na reversão anterior.
- DEC-DISC-020, aprovado em 2026-09-27, mantém verificação global desligada, confirmação local apenas sob pedido explícito de associação Google e confirmação de compra como primeiro acesso à caixa. Este plano altera esse contrato: cadastro por e-mail e compra terão verificação explícita e a decisão será emendada, não ignorada.
- Checkout público começa sem PII. Depois do evento financeiro autorizado, Asaas fornece identidade declarada; order-identity.ts cria ou associa uma Conta Student. Uma Conta nova fica com email_verified=false.
- Para Conta sem método utilizável, auth.account-activation usa requestPasswordReset e envia auth-password-reset; o token não fica na outbox. Para Conta com método, o Hub enfileira email.access-released.
- A verificação por e-mail existente só é oferecida após falha de associação OAuth. Usa link de uma hora, não inicia sessão e diz que a finalidade é associar Google. O e-mail é enviado diretamente, não pela outbox.
- /admin/equipe promove uma Conta Student já existente; não há convite externo. A ação atual audita mudanças e revoga sessões quando muda o papel.
- profiles.invitedAt existe no schema, mas não implementa o lifecycle de convite.
- /app/configuracoes só é acessível ao papel Student e o campo “Nome no certificado” atualiza users.name, usado também como nome da Conta e em futuros snapshots de certificados. /admin/configuracoes é configuração global.
- users.image serve o avatar exibido nos dois shells e pode receber a foto Google. O mapper preserva uma imagem local existente; ainda não há edição de avatar no perfil.
- DEC-DISC-015 diz que apenas recuperação de senha está fora da outbox, mas a verificação atual também envia diretamente. A documentação e a arquitetura estão divergentes.

### Gate de segurança: cadastro com senha antes de verificar

O código instalado em node_modules/better-auth/dist/api/routes/sign-up.mjs de Better Auth 1.6.25 cria users e accounts.provider_id=credential antes de enviar o link de verificação. Em node_modules/better-auth/dist/api/routes/email-verification.mjs, verifyEmail valida o JWT e marca o e-mail como verificado; não consome um registro de challenge e não troca nem remove essa senha. Portanto, não é seguro simplesmente ativar requireEmailVerification e manter a tela atual: alguém pode iniciar cadastro usando o e-mail de outra pessoa e escolher uma senha que a pessoa real não conhece.

O advisory oficial de Better Auth documenta a classe de pré-sequestro de Conta em associação OAuth e afirma que requireEmailVerification sozinho não a resolve. O patch local já contém o bloqueio de e-mail local não verificado, mas isso não substitui o teste do fluxo de reivindicação de uma Conta criada sem consentimento. A implementação precisa provar que uma senha escolhida antes da posse da caixa nunca continua sendo credencial válida após a vítima confirmar o e-mail.

**Direção recomendada:** no cadastro público por e-mail, manter um registro temporário de cadastro sem Conta Better Auth, sessão ou senha. Só depois de consumir o token de prova da caixa criar users com email_verified=true e Perfil Student, sem credential. A pessoa então entra com Google ou solicita “Criar ou redefinir senha”; Better Auth já suporta criar uma credencial quando o reset token é consumido e ainda não existe credential.

Para Contas legadas com email_verified=false e credential existente, a confirmação deve ser uma reivindicação segura: invalidar credenciais e sessões criadas antes da prova, marcar o e-mail verificado de forma atômica e orientar a pessoa a entrar com Google ou definir uma nova senha. Não marcar em massa como verificados nem apagar credenciais sem um fluxo de recuperação apresentado ao usuário.

## Pesquisa e referências

### Better Auth, Google e risco de associação

- Better Auth documenta disableImplicitSignUp para manter criação social explícita, disableImplicitLinking para exigir associação autenticada e linkSocial para associar um provider numa sessão válida. O setPassword é server-side e pensado para Contas OAuth sem senha.
- O projeto está em Better Auth 1.6.25. O advisory de associação OAuth foi corrigido na linha estável em 1.6.11. Não baixar requireLocalEmailVerified, não marcar Google como trustedProvider e não usar e-mail como chave de identidade do provider.
- Google define sub como ID estável. email_verified=true não é prova universal de controle atual da caixa: Google é autoritativo para Gmail e Workspace com hd; para Conta Google baseada em endereço de terceiro, a caixa pode ter mudado de dono. A política de auto-link para esse caso precisa de um teste técnico na versão instalada antes de ser promovida.
- Google pode criar Conta somente no cadastro explicitamente iniciado. Para qualquer Conta local existente, manter a prova local antes do primeiro vínculo, inclusive Gmail/Workspace. A versão instalada não oferece o hook de autorização condicional descrito no plano inicial; não usar `requireLocalEmailVerified: false`, opção obsoleta que relaxaria o gate para todos. Uma exceção por domínio fica adiada até existir um seam próprio, suportado e testado; não é requisito para concluir o restante do plano.
- Não adicionar Magic Link ou Email OTP nesta etapa. Além de não terem sido solicitados, são outra modalidade de login/cadastro e a documentação de Better Auth mostra configuração de criação de Conta e riscos próprios. Login por link só deve ser reconsiderado como decisão independente.

### Convite de equipe e autorização

Clerk e Better Auth Organization modelam convites como recursos pendentes com destinatário, expiração e aceitação. Better Auth Organization também exige schema de organização, membros e campos de sessão que não existem no Hub. O Hub tem equipe interna global, sem tenant ou organização de cliente, e RBAC próprio em profiles; adotar o plugin Organization inteiro seria um modelo maior que a necessidade.

Recomendação: entidade própria de convite, com lifecycle mínimo, reutilizando regras e auditoria de equipe existentes. Uma visita GET ao link não consome convite nem altera papel; a aceitação explícita ocorre por POST. Isso evita que scanners de segurança de e-mail aceitem convites automaticamente.

### Verificação, e-mail e entregabilidade

OWASP recomenda prova de posse com token seguro, expiração e uso único; resposta uniforme para reduzir enumeração; reautenticação e confirmação do endereço novo para mudança de e-mail. A Resend mantém chaves idempotentes por 24 horas, não uma garantia permanente de entrega exatamente uma vez. A outbox e o lifecycle local do Hub continuam sendo a autoridade para retries e estado da intenção.

Referências primárias:

- [Better Auth: contas e associação](https://better-auth.com/docs/concepts/users-accounts)
- [Better Auth: e-mail e verificação](https://better-auth.com/docs/concepts/email)
- [Better Auth: validação de identidade OAuth](https://better-auth.com/docs/concepts/oauth)
- [Better Auth: convite de organização, referência de lifecycle e não recomendação de instalar o plugin](https://better-auth.com/docs/plugins/organization)
- [Better Auth advisory: associação OAuth e pré-sequestro](https://github.com/better-auth/better-auth/security/advisories/GHSA-g38m-r43w-p2q7)
- [Better Auth advisory: passwordless e pré-sequestro](https://github.com/better-auth/better-auth/security/advisories/GHSA-qq9h-g4jm-xgf3)
- [Google: validar identidade no backend e limites de email_verified](https://developers.google.com/identity/sign-in/web/backend-auth)
- [Google: claims OIDC e estabilidade de sub](https://developers.google.com/identity/openid-connect/reference)
- [OWASP: verificação, alteração e canonicalização de e-mail](https://cheatsheetseries.owasp.org/cheatsheets/Email_Validation_and_Verification_Cheat_Sheet.html)
- [OWASP: autorização e menor privilégio](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [Clerk: convites, expiração e aceitação](https://clerk.com/docs/guides/users/inviting)
- [Resend: chaves idempotentes](https://resend.com/docs/dashboard/emails/idempotency-keys)
- [USENIX Security 2022: pré-sequestro de Contas](https://www.usenix.org/conference/usenixsecurity22/presentation/sudhodanan)

## Experiência final proposta

### Entrar e criar Conta

1. /entrar permanece login-only. Google é a ação principal; senha continua disponível para quem tem uma credencial. E-mail desconhecido nunca cria Conta nessa rota.
2. /cadastro mantém a escolha explícita de cadastro. Google abre o fluxo de sign-up existente, preservando requestSignUp, disableImplicitSignUp e a flag pública.
3. Cadastro por e-mail pede nome e endereço, mas não senha. A confirmação vai para a caixa indicada. A interface sempre mostra a mesma confirmação neutra, sem dizer se o e-mail já existe.
4. O registro temporário não cria users, profiles, accounts, sessão, Pedido, Concessão ou Matrícula. O token tem propósito de cadastro, uso único, prazo curto (recomendação: uma hora), canonicalização aprovada e rate limit.
5. Ao confirmar, uma única transação consome o token, verifica colisões da identidade canônica e cria Student verificado sem credential. Se já existir Conta, não fundir nem substituir dados; direcionar ao fluxo de entrar/recuperar senha sem revelar qual caso ocorreu.
6. Após confirmar, a pessoa volta ao login com returnTo validado. Google continua como principal; quem quiser senha usa “Criar ou redefinir senha”. Não criar sessão automaticamente a partir do link de verificação.
7. Curso gratuito mantém a ordem: criar/confirmar Conta, entrar e executar a ação POST explícita de autoinscrição. A URL de retorno continua limitada a /comprar/<slug>.

### Compra de Curso

1. Só o evento financeiro pago e autoritativo inicia o e-mail. Checkout iniciado, falho, cancelado, vencido ou CHECKOUT_PAID sem confirmação continuam sem ativação.
2. O processor cria ou associa a Conta Student como hoje; pagamento/Asaas não marca email_verified=true.
3. Uma nova intenção de outbox email.purchase-confirmed por Pedido substitui o branch de e-mail “reset para criar senha” versus “acesso liberado”.
4. O delivery reconsulta Pedido pago, Conta e estado atual do e-mail:
   - e-mail não verificado: mensagem única “Compra confirmada” com nome do Curso e CTA “Confirmar e-mail”;
   - e-mail verificado: a mesma confirmação com CTA “Acessar Curso” (ou login com returnTo quando a sessão ainda não existe).
5. Após confirmar o e-mail, a pessoa entra normalmente pelo Google ou define uma senha separadamente. A confirmação não cria sessão, não define senha e não concede uma segunda matrícula.
6. Remover link de redefinição de senha do template de confirmação/acesso. Reset só é enviado quando pedido pelo usuário.
7. A outbox guarda IDs locais, não destinatário, token ou URL. O delivery gera link no último momento usando o padrão HMAC/AsyncLocalStorage existente.

### Convites Admin/Suporte

1. Uma única ação “Convidar para equipe” aceita e-mail, papel e, para Suporte, as views/grants allowlisted atuais.
2. Somente Admin pode criar, reenviar, cancelar ou editar convites. Continua proibido autoalterar papel e remover o último Admin.
3. O convite expira em sete dias (recomendação), é vinculado ao e-mail canônico, tem geração rotativa em reenvio e um token opaco assinado/validado no servidor. O token bruto nunca é persistido, enviado à auditoria ou registrado em log.
4. Criar convite não cria Conta nem concede acesso. GET só exibe quem convidou, papel e prazo; botão explícito confirma a aceitação.
5. Aceitação valida token, prazo, geração, e-mail canônico, papel/grants, estado do inviter e colisões canônicas em transação. O token de convite prova a posse da caixa e pode criar Conta de equipe sem uma segunda verificação genérica.
6. Nova Conta recebe nome no aceite, e-mail verificado e método de login ainda vazio. Depois pode usar Google ou criar senha por ação separada. Convite continua funcionando quando cadastro público está desligado.
7. Conta Student existente não ganha um segundo papel: o schema é de papel único. Aceitar convite converte Student para Support/Admin e revoga sessões como a política atual. Antes do envio e no aceite, mostrar a consequência: a área de cursos deixa de estar disponível; pedidos, matrículas e dados não são apagados. Se o produto quiser permitir que alguém seja simultaneamente Aluno e equipe, isso exigirá uma decisão e refatoração de autorização separadas.
8. Reenvio invalida a geração anterior. Convite vencido, revogado ou aceito nunca é reutilizável. Eventos de criação, reenvio, cancelamento e aceite são auditados com motivo/contexto mínimo.

### Minha conta

Integrar perfil pessoal à rota de Configurações de cada papel, com atalho “Minha conta” no menu de usuário. Não criar uma rota separada de Conta nem enviar Admin/Support às configurações Student.

Seções:

- **Perfil:** nome completo, avatar, e-mail e estado verificado.
- **Métodos de entrada:** Google conectado ou disponível para vínculo. Configurações não exibe se há senha nem oferece criação/alteração; senha é definida ou atualizada apenas pelo link de recuperação por e-mail.
- **E-mail:** reenvio de confirmação para Conta autenticada; troca exige confirmação do endereço atual e prova do novo, sem reautenticação por idade da sessão. O e-mail atual só muda depois da nova confirmação; conflitos canônicos falham sem merge. Notificar endereço antigo e novo; revogar sessões anteriores após a mudança.

users.name continua sendo o campo de nome. Mostrar que ele será usado em próximos certificados; snapshots emitidos não mudam. Não criar um segundo campo de nome sem decisão de produto.

Avatar deve aceitar foto Google como opção inicial sem substituir escolha local. Upload/remoção usa validação existente, ownership do próprio userId, limite único, recorte quadrado antes do envio e cleanup seguro; cliente não fornece URL arbitrária. Guardar origem/override ou ajustar o mapper para que foto Google não volte depois que o usuário escolher/remover avatar; testar login Google após upload e remoção.

## Plano de implementação por etapas

### Etapa 0 — decisões, baseline e gates

- Registrar as decisões desta proposta antes do código: significado de “senha opcional”; comportamento de conversão Student para equipe; política para Google com e-mail de terceiro; MFA fica fora por DEC-DISC-014.
- Em Development e Staging, rodar consulta read-only sanitizada com contagens por papel, email_verified, existência de credential e Google account. Não retornar endereços. Production exige autorização e runbook separados; não modificar dados nesta etapa.
- Inspecionar profiles.invitedAt apenas para decidir se é legado inerte; não reutilizar como lifecycle de convite.
- Adicionar testes de ameaça antes do rollout: signup de endereço da vítima por atacante; vítima confirma; senha escolhida pelo atacante não funciona. Fazer teste equivalente no fluxo de Conta existente não verificada que tentou associar Google.
- Verificar APIs/typings Better Auth 1.6.25 para validateUserInfo, claims hd, changeEmail, sendVerificationEmail e setPassword. Não copiar comportamento da documentação de 1.7 sem demonstrar compatibilidade local.
- Gate: não ativar novo cadastro público nem trocar template de compra antes dos testes de pré-sequestro e da contagem da coorte legada.
- Resultado da etapa: comparação fonte a fonte confirmou a separação atual entre login e signup e a proteção local de vínculo; Graphify foi atualizado incrementalmente e consultado para autenticação, compra/outbox, equipe e perfil. DEC-DISC-020 foi identificado como contrato a emendar. Contagem de Contas em DB compartilhado não foi executada; permanece gate de rollout, não bloqueia implementação local.

### Etapa 1 — fronteira de identidade, desafio por e-mail e cadastro social-first

Criar serviço de domínio próprio para registro pendente e prova de e-mail. Não usar endpoint público signUpEmail com senha fornecida pelo navegador antes da prova.

Novos dados:

- pending_signups: nome, e-mail original, forma canônica conforme REG-IDA-001, destino interno seguro (preferir courseId a URL), estado, generation, timestamps e expiração. Não guardar senha ou hash de senha.
- account_email_challenges: userId ou pendingSignupId, purpose, generation, expiração, consumo e timestamps. Um desafio não serve para reset, convite e alteração de e-mail ao mesmo tempo.
- Token de alta entropia assinado por HMAC com finalidade/domain separation; hash/geração vinculados ao desafio, validação em tempo constante, expiração curta, uso único e consumo na mesma transação da mutação.

Fluxo:

1. POST /api/account/registrations valida flag pública, nome, e-mail, curso/returnTo permitido, rate limit e origem. Não chama criação Better Auth ainda.
2. Armazena somente o cadastro temporário e enfileira envio. Resposta é neutra para e-mail novo, existente, collision ou supressão.
3. GET da URL não altera dados. Um botão explícito envia POST; isso evita consumo por scanner e reduz risco de token em navegação automática. O POST usa o serviço de challenges do Hub, não o verify-email JWT padrão do Better Auth, que não registra consumo único nem remove credenciais criadas antes da prova.
4. O POST consome o desafio uma vez e cria Conta Student verificada sem credential, no mesmo limite transacional. Conflito de e-mail canônico não sobrescreve, funde ou revela outra Conta.
5. Direciona a entrar, com Google primeiro e retorno seguro. Para password-only, a ação “Criar ou redefinir senha” usa o fluxo de reset atual, que cria credential se ainda não existir.
6. Google login continua sem criação. Google signup só ocorre pelo botão explícito de /cadastro, autorizado pela flag.

Para Conta legada não verificada com credential, emitir challenge de reivindicação separado: após prova da caixa, consumir o challenge, invalidar credentials e sessões pré-prova e marcar o e-mail verificado na mesma transação; depois mostrar que a pessoa pode entrar com Google ou criar uma senha nova. O worker nunca deve marcar uma Conta desse estado como verificada preservando silenciosamente um credential que pode ter sido escolhido por outra pessoa.

Arquivos de referência: src/lib/auth.ts, src/lib/auth-policy.ts, src/app/(auth)/cadastro/*, src/app/(auth)/entrar/*, src/app/(auth)/oauth/callback/*, src/lib/auth-return-to.ts, src/lib/session.ts, src/db/schema.ts, migration trigger 0041_public_signup_student_profiles.sql.

Critérios:

- /entrar email e Google desconhecidos não criam users, accounts, profiles, sessão ou matrícula.
- Email signup cria apenas pendência antes da verificação e Conta verificada sem credential depois dela.
- Google signup só cria em cadastro explicitamente iniciado; login-only continua sem criação.
- Nenhum token torna a Conta autenticada sozinho; autoSignInAfterVerification permanece falso.
- Email collision segundo REG-IDA-001 é falha neutra, nunca merge automático.
- returnTo após signup verificado continua limitado a /comprar/<slug>; autoinscrição ainda depende de POST autenticado.

### Etapa 2 — Google e política de associação

- Manter disableImplicitSignUp, a flag pública e accountLinking.requireLocalEmailVerified no valor seguro padrão. Não configurar Google em trustedProviders.
- Emendar DEC-DISC-020/REG-IDA-008: a verificação de e-mail deixa de ser globalmente desligada para cadastros locais novos e vínculos não confiáveis; login ainda não cria Conta.
- requireEmailVerification do provider Google é somente um gate de sessão e Better Auth ainda pode criar/vincular user/account antes de aplicá-lo; não usar essa opção para separar login de cadastro. Só manter sessão Google quando a política abaixo aprovar as claims.
- emailVerified local só é verdadeiro por confirmação local ou por um sinal Google considerado autoritativo pela política aprovada.
- A versão instalada Better Auth 1.6.25 não contém `user.validateUserInfo`; embora o perfil possa expor `hd`, o mapper não é um hook de autorização com contexto de login/associação. Portanto não implementar exceção por domínio nem definir `requireLocalEmailVerified: false`.
- Manter prova local para todo primeiro vínculo automático Google, conforme DEC-DISC-020/REG-IDA-008. Login Google de Conta já vinculada permanece direto; Conta nova só pode nascer pelo botão explícito de cadastro e flag habilitada. Associação por sessão autenticada pode ser avaliada depois, mas não deve criar bypass neste escopo.
- Garantir que mapGoogleProfileToUser preserve nome, e-mail, role e avatar custom. O sub continua sendo identidade do provider; mudança de e-mail não cria nem funde outra Conta.

Testes de integração: email_verified false; Gmail verificado; Workspace com hd; Google com e-mail externo e sem hd; local verified/unverified; duplicate canonical email; Google de usuário diferente; login-only versus signup explícito; retorno de rota; papel Admin/Support sem alteração pelo profile Google.

### Etapa 3 — compra confirmada, verificação e outbox

- Adicionar `email.purchase-confirmed` com chave idempotente por Pedido e um ledger mínimo `purchase_confirmation_intents` (somente orderId/origem), persistente além da retenção de 30 dias da outbox. Enfileirar a nova intenção e o marcador na mesma transação da Concessão; migration backfill cria origem `historical` para Pedidos já pagos com identidade resolvida, sem atualizar Conta/Pedido nem copiar PII. Pedidos em revisão ficam disponíveis para a confirmação nova quando a identidade for resolvida.
- Adicionar variação do template Hosted purchase-confirmed; manter auth-email-verification genérico para cadastro sem compra; manter auth-password-reset somente para ação de senha; novo alias staff-invitation para convite.
- A intenção inicia com `verification_required = NULL`. Na primeira preparação do delivery, um `UPDATE` concorrente-seguro lê o estado atual de `users.email_verified` e congela a decisão antes da chamada ao provider. Se o estado mudou enquanto o envio aguardava, o CTA reflete o estado mais recente; retries mantêm a decisão persistida.
- O `purchase_verification` challenge é criado/recuperado no delivery somente quando a decisão persistida exige confirmação. O payload `email.purchase-confirmed` contém somente `orderId`/`userId`; o token HMAC é derivado no delivery a partir do challengeId, generation, purpose e expiração e consumido na transação de confirmação. Nunca gravar URL ou token na outbox, fingerprint, log ou tag Resend.
- Retry do mesmo evento deve reconstruir o mesmo token e payload; reenvio explícito incrementa generation e invalida a anterior. Testar aceitação ambígua, retry antes/depois da janela Resend de 24 horas e token já consumido.
- Não tratar Resend 24h como exactly-once; geração de link só roda no delivery, idempotência local decide retry, resultados desconhecidos ficam em acceptance_unknown.
- email.access-released deixa de receber novos Pedidos depois do corte. Remover PASSWORD_RESET_URL do conteúdo novo.
- Mensagens legadas `auth.account-activation/v1` **e** `email.access-released/v1` não podem ser reinterpretadas como `email.purchase-confirmed`; ambas podem conter o caminho antigo de redefinição de senha. Como a chave nova é diferente, o corte precisa deduplicar entre versões por Pedido: transacionalmente bloquear/inspecionar mensagens antigas do mesmo `orderId`; se uma estiver `processing`, `delivered`, aceita ou `acceptance_unknown`, ela permanece a única intenção e nenhuma nova é criada. `pending`/`retrying`/`dead_letter` sem evidência de aceitação são superseded com causa auditável e substituídos pela nova intenção. Impedir requeue manual incompatível de v1 depois do corte. Mensagem já aceita não pode ser “desenviada”; links antigos continuam válidos até expirar e não devem conceder acesso extra.
- Migrar confirmação de associação Google, confirmação de cadastro, aceite de convite e mudança de e-mail para o serviço de challenges e outbox. Bloquear/encaminhar os endpoints Better Auth send-verification-email, verify-email e change-email para impedir uma segunda rota que marque emailVerified ou crie sessão sem as regras do Hub. Reconciliar DEC-DISC-015 para que reset público seja a única exceção fora da outbox, conforme contrato atual.

Arquivos de referência: src/features/payments/order-identity.ts, src/features/payments/apply-authoritative-financial-evidence.ts, src/features/outbox/rules.ts, src/features/outbox/delivery.ts, src/features/outbox/server.ts, src/features/email/server.ts, src/features/email/templates.tsx, src/features/email/templates-contract.ts, src/features/email-delivery/server.ts, src/db/schema.ts, docs/operations/outbox-and-transactional-effects.md, docs/integrations/resend-templates.md, docs/decisions.md DEC-DISC-001/007/015.

Publicação externa dos Hosted Templates continua manual: preparar, revisar links/variáveis/plain text, testar com allowlist, publicar no catálogo único Resend e rodar bun run check:resend-templates -- --environment=staging. Não publicar automaticamente por build ou migration.

### Etapa 4 — convite pendente de Admin e Suporte

- Criar staff_invitations com e-mail original/canônico, papel, suporte views/grants allowlisted, inviter, generation, estado, expiração, aceite/revogação e timestamps. Unique constraint parcial para um convite pendente por identidade canônica.
- Criar intenção auth.staff-invitation na outbox com somente invitationId/generation. Derivar link determinístico protegido por HMAC no delivery, sem persistir token bruto. Reenvio incrementa generation e invalida links anteriores.
- Substituir StaffPromotionDialog por convite. Manter a tabela de membros e as ações de permissões atuais; mudança de acesso continua Admin-only, auditada, com motivo, proteção do último Admin e revogação de sessão.
- Rotas/ações server-side verificam manageStaffAccess; Support nunca ganha permissão de convidar por grant configurável.
- GET só apresenta convite e não consome token. POST de aceite revalida token, expiry, generation, e-mail canônico, role/grants, estado do inviter e colisões canônicas; consome convite e cria/atualiza Perfil na mesma transação.
- Para Student existente, tornar explícita a conversão de papel único e indisponibilidade da área Student. Não apagar Pedido/Matrícula/Certificado. Se o produto quiser permitir que alguém seja simultaneamente Aluno e equipe, isso exigirá uma decisão e refatoração de autorização separadas.
- Para conta existente email_verified=false, usar o fluxo de reivindicação segura da etapa 1 antes de conceder role. Não conservar credencial anterior à prova.
- Revogar sessões antigas após promoção e confirmar ao convidado que deve entrar novamente. Sem novas sessões com role antigo.
- Bootstrap Admin de Development e seed Staging continuam sendo exceções operacionais explícitas; marcar verificado somente no seed protegido do ambiente controlado, nunca no caminho de signup público.

Arquivos de referência: src/app/(admin)/admin/equipe/page.tsx, src/components/admin/staff-promotion-dialog.tsx, src/features/admin/staff-server.ts, src/features/admin/staff-actions.ts, src/lib/auth-permissions.ts, src/lib/auth-policy.ts, src/db/schema.ts, src/db/staging-admin-seed.ts, src/app/api/auth/dev/bootstrap-admin/route.ts, docs/decisions.md DEC-DISC-014/018.

### Etapa 5 — perfil compartilhado e métodos de entrada

- Integrar a seção “Minha conta” às rotas `/app/configuracoes` (Student) e `/admin/configuracoes` (Admin/Support). O menu de usuário aponta diretamente para essa seção; não há uma rota alternativa de Conta.
- Em `/admin/configuracoes`, manter os dados globais protegidos por `viewSettings`. Support sem essa capacidade pode abrir a seção pessoal, mas a página não deve consultar nem renderizar dados do Hub.
- Manter `/app/configuracoes` dentro do layout protegido normal de Student. Conta suspensa é redirecionada para `/entrar` e não pode acessar perfil, avatar, preferências ou qualquer outra rota interna; a tela informa a suspensão e oferece contato com Suporte e saída. Não carregar dados Student para essa Conta. Student ativo mantém as preferências de privacidade na mesma tela, sem Tabs ou Scrollspy, em uma coluna centralizada de largura limitada.
- Preservar `/admin/configuracoes` para ajustes globais e a seção de privacidade em `/app/configuracoes`; o nome pessoal, avatar, métodos de entrada e e-mail passam a compor cada uma dessas telas.
- Expor emailVerified na AppSession, mas nunca confiar no valor enviado pelo navegador. Verificação/reenvio deve derivar userId da sessão.
- Mostrar o vínculo Google dentro da seção de Perfil, sem uma tab exclusiva de Acesso. Configurações não mostra estado de senha nem formulário de criação/alteração; `Esqueci minha senha` em `/entrar` envia o link de redefinição por e-mail e a tela pública `/redefinir-senha` define ou atualiza a credencial por token.
- Alterar e-mail: não exigir sessão recente; enviar confirmação ao endereço atual e depois prova ao novo; usar canonicalização REG-IDA-001; não trocar o e-mail até a confirmação; enviar alertas às duas caixas e invalidar sessões anteriores. Não usar o comportamento de email-change padrão sem provar na versão instalada que não cria sessão indevida pelo link. Senha continua opcional e usa somente o fluxo público de recuperação por e-mail.
- Nome continua sendo users.name; mostrar que ele será usado em próximos certificados. Certificados emitidos preservam snapshots.
- Upload de avatar: manter `users.image` como foto de origem Google e gravar imagem personalizada em objeto R2 privado, referenciado por `profiles.avatar_key` e uma escolha explícita de origem/modo (Google, customizada ou iniciais). Não liberar rotas administrativas de upload/leitura; criar fronteira user-scoped que derive o dono da sessão, gere a chave no servidor, valide bytes/conteúdo/tamanho/dimensão, normalize/crop e limpe temporários/órfãos. Servir a imagem por rota autenticada da própria Conta. A escolha “iniciais” não deve ser desfeita no próximo login Google.

Testes de autorização: Student só altera própria Conta; Support/Admin idem; nenhum ID de usuário vindo do form escolhe alvo; não há endpoint/página alternativa de Conta; Aluno com acesso à plataforma suspenso não acessa páginas, ações nem avatar privados e vê o estado de suspensão em `/entrar`; Support sem `viewSettings` não carrega dados globais; Admin/Support com acesso continuam vendo configurações globais.

### Etapa 6 — compatibilidade, rollout e homologação

1. Migration aditiva em Development: schema de pendências/convites/challenges, ledger de uma confirmação por Pedido e enums da outbox. A única backfill registra `orderId`/origem para Pedidos já pagos, sem PII nem alteração de estado financeiro. Não aplicar migration em Staging/Production nesta etapa.
2. Executar inventário sanitizado por ambiente para Contas unverified, credenciais, Google account, role, Pedidos e mensagens legadas **dos dois tópicos** (`auth.account-activation` e `email.access-released`). Nenhum endereço/token em log ou saída. Para Production, exigir autorização e runbook.
3. Homologar primeiro em Development com DB isolado: login existente, signup email verification-first, Google signup, login desconhecido sem criação, curso gratuito com returnTo, compra no servidor Asaas fake, convite novo e de Student existente, reset criando primeira senha, profile/email/avatar e account claim de credential legado.
4. Atualizar e publicar templates Resend em Development/Shared catalog de modo explícito. Testar destinatários controlados; validar que nenhum assunto/conteúdo confunde compra, confirmação, convite ou senha.
5. Staging: migrations pelo runbook, templates publicados, allowlist ativa, requalificação de dados e smoke de todos os fluxos. Aplicar deduplicação/supersession dos dois tópicos legados antes de ativar o novo publisher e impedir retry manual dos v1 incompatíveis.
6. Production só depois de aprovação e runbook específico. Não mudar AUTH_PUBLIC_SIGNUP_ENABLED por consequência desta implementação; continua fechado por padrão. Se/quando abrir cadastro para visitantes de Cursos gratuitos, fazê-lo em alteração/configuração separada após teste.
7. Monitorar apenas contagens e causas allowlisted: verification requested/accepted/expired, signup collision, invite accepted/revoked/expired, outbox retry/dead-letter, email delivery. Nunca logar e-mail completo, token ou URL.

## Arquivos e decisões canônicas a atualizar

Código provável: src/lib/auth.ts, src/lib/auth-policy.ts, src/lib/session.ts, src/lib/email-identity.ts, rotas /entrar, /cadastro, /oauth/callback, novo módulo de pending signup/challenge, order-identity.ts, payments outbox, email server/templates/contracts, staff server/actions/page, PanelLayout, Configurações de Student/Admin, avatar upload purpose, bootstrap e staging seed.

Dados: migrations aditivas em src/db/schema.ts; não alterar a semântica dos tokens, eventos ou mensagens v1 em lugar. Novas intenções têm payload versionado e chaves novas.

Documentação canônica no mesmo PR:

- docs/domain/identity-and-authorization.md: estados de email, credenciais opcionais, signup pendente, convite Staff e claim de Conta legada.
- docs/domain/commerce-and-access.md e PRODUCT.md: pagamento não verifica caixa; e-mail de compra é confirmação/verificação; não cria matrícula pela confirmação.
- docs/decisions.md: emendar DEC-DISC-001, 007 e 015; registrar política de convite e clareza sobre role único; não apagar decisão de MFA.
- docs/operations/outbox-and-transactional-effects.md: novos tópicos, versão de payload, keys, PII, retries, retenção, resend manual e compatibilidade v1.
- docs/integrations/resend-templates.md: aliases, variáveis e ownership editorial.
- docs/README.md e CONTEXT.md se os conceitos Conta, método de entrada, convite e verificação mudarem.

## Verificação obrigatória e critérios de aceite

Teste primeiro contratos de domínio; depois endpoints/UI; por último jornadas end-to-end em PostgreSQL descartável:

- login por senha/Google com e-mail desconhecido não cria registros;
- Google signup só cria em cadastro explicitamente iniciado e permitido;
- signup de e-mail não aceita/guarda senha antes da prova da caixa; token expirado, já consumido, resend antigo, colisão ou redirect externo falham fechados;
- teste de pré-sequestro: atacante inicia fluxo com e-mail alheio; owner confirma; senha anterior à prova nunca autentica;
- Asaas paid cria Conta sem credential, confirma compra e pede prova; cancel/failure/checkout não pago não emite e-mail;
- confirmação não inicia sessão e não cria matrícula adicional; login Google liga só sob política aprovada; reset/set password cria credential somente após prova;
- convite pendente não cria papel, Conta ou sessão antes de aceite; token não pode ser usado por endereço diferente, GET scanner, duplicado, vencido, revogado ou geração substituída;
- reenvio idempotente, aceitação atômica, audit log e revogação de sessões; proteção de último Admin, grants Support e limite de invite só Admin;
- mudança de e-mail mantém o atual até o novo estar provado, alerta as caixas e não abre sessão por token isolado;
- avatar cross-user, SVG/script, URL externa, excesso de tamanho/dimensão e upload pendente não alteram Conta; custom photo sobrevive login Google;
- erro/retentativa de Resend, acceptance_unknown, retry após 24h, duplicate webhook, dead letter e dados mínimos na outbox;
- E2E cobre rota paga existente, visitante de Curso gratuito, convite novo e Account Student existente.

Comandos mínimos após cada fatia: teste mais estreito, bun run docs:check quando docs mudarem, bun run verify:quick, verificação de migrations e E2E/PostgreSQL antes do handoff. Para mudanças em auth/email/RBAC, consultar o runbook CodeRabbit e registrar se a revisão opcional for concluída ou indisponível.

## Aprovações registradas e gates remanescentes

O usuário aprovou o plano em 2026-09-29. Estão aprovadas a senha pós-verificação opcional, a semântica de papel único com aviso na conversão Student→Staff e a política mais restrita de auto-link Google para e-mail de terceiro sem hd. A implementação técnica ainda precisa provar os gates abaixo:

1. **Exceção condicional Gmail/Workspace adiada.** Better Auth 1.6.25 não fornece `user.validateUserInfo`; manter prova local em todos os primeiros vínculos Google. Não desligar o gate nem usar `trustedProviders` como atalho.
2. A contagem sanitizada de Contas legadas email_verified=false com credential, sessões e role é gate para qualquer ativação em Development/Staging/Production. Nenhum dado será marcado, removido ou enviado antes do plano de migração específico.
3. Templates Resend e migrations são alterações externas/operacionais: aplicar/publicar primeiro nos ambientes autorizados e manter Development isolado de Staging/Production.
