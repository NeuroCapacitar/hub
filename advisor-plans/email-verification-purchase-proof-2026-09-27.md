# Compra, prova de controle do e-mail e verificação

**Data:** 2026-09-27
**Escopo:** avaliar se uma compra aprovada pelo Asaas prova que a pessoa controla o e-mail usado no pedido e se o Hub deve ativar verificação de e-mail globalmente ou apenas no fluxo de ativação/vinculação.
**Natureza:** parecer baseado em documentação oficial e no código/documentação local do Hub. Não é parecer jurídico nem auditoria antifraude do Asaas.

## Parecer executivo

**Pagamento confirmado não deve, por si só, marcar o e-mail da Conta como verificado.** O evento do Asaas comprova o estado financeiro que o provedor comunica; os materiais oficiais consultados descrevem `customerData.email` como dado do pagador usado para preencher o checkout, e webhooks como mecanismo para acompanhar o estado do pagamento. Eles não documentam que a aprovação do pagamento confirma que o pagador abriu ou controla aquela caixa postal.

Isso não significa que o modelo atual de compra antes da Conta esteja errado. O Hub já separa a compra da criação/ativação da credencial: após pagamento autoritativo, consulta os dados do cliente no Asaas, cria ou associa uma Conta com `email_verified = false` e envia um e-mail de ativação. A ação de abrir esse e-mail e concluir a definição da senha é a evidência de acesso à caixa postal no fluxo atual; **a transação financeira não é essa evidência**. Há, porém, uma diferença importante entre a ação realizada e o estado persistido: o fluxo atual mantém `email_verified = false`, mesmo após a ativação por e-mail, segundo o contrato e o código examinados.

### Recomendação

1. **Preservar compra guest-first.** Não exigir cadastro nem confirmação de e-mail antes de pagar.
2. **Não confiar no pagamento como prova de posse do e-mail.** Manter `email_verified = false` ao criar a Conta derivada do pedido.
3. **Não habilitar uma barreira global de verificação como consequência automática desta mudança.** O caso que exige prova é a ativação/vinculação da identidade e, em especial, o vínculo automático de um Google já autenticado a uma Conta local preexistente.
4. **Registrar como verificado somente após uma ação que prove acesso à caixa postal**, como o uso bem-sucedido do link de ativação enviado para o endereço da Conta. A implementação pode reaproveitar o fluxo de ativação existente, desde que a transição do estado seja explícita, idempotente e recuperável em caso de falha parcial.
5. Tratar a flag `email_verified` como **estado de prova de controle do endereço**, não como prova de identidade civil, titularidade do cartão, legitimidade do pagamento ou garantia de que o endereço continuará acessível.

## Fatos documentados

### Asaas

- O Asaas descreve `customerData` como dados do pagador que podem ser enviados para pré-preencher campos do Checkout. Se a aplicação não envia `customer` nem `customerData`, o pagador preenche os dados diretamente na página do Checkout. A referência de criação do Checkout identifica `customerData` como informação do pagador, não como resultado de verificação de endereço. ([Como informar os dados do cliente](https://docs.asaas.com/docs/como-informar-os-dados-do-cliente), [referência para criar Checkout](https://docs.asaas.com/reference/criar-novo-checkout))
- A documentação distingue criar o Checkout de confirmar o pagamento: o resultado acontece posteriormente e deve ser acompanhado por API/Webhook. A confirmação financeira é sobre o ciclo do pagamento; a documentação consultada não descreve um desafio de e-mail que o pagador precise devolver para comprovar acesso à caixa postal. ([referência para criar Checkout](https://docs.asaas.com/reference/criar-novo-checkout), [eventos para cobranças](https://docs.asaas.com/docs/webhook-para-cobrancas))
- A documentação de cliente descreve e-mail como dado de contato/notificação. Isso, isoladamente, não demonstra validação da posse do endereço. ([referência para criar cliente](https://docs.asaas.com/reference/criar-novo-cliente))

**Limite da conclusão sobre o Asaas:** não encontrei, nas páginas oficiais consultadas, uma declaração de que o Asaas nunca verifica e-mail em nenhum produto, canal, regra antifraude ou configuração. A ausência de uma etapa de verificação na documentação citada **não prova que tal verificação inexista**. O que podemos afirmar com segurança é mais estreito: a API e os eventos consultados não fornecem ao Hub uma garantia documentada de posse da caixa postal por meio da confirmação do pagamento. Para afirmar algo além disso seria necessário obter do Asaas documentação específica ou confirmação formal sobre as regras aplicadas ao Checkout usado pelo Hub.

### NIST SP 800-63

- O NIST define códigos de confirmação como mecanismo para confirmar que a pessoa tem acesso a um endereço físico, e-mail ou telefone. O retorno de um código enviado ao e-mail prova acesso ao endereço para comunicações futuras; não equivale, por si, a comprovar identidade civil. ([NIST SP 800-63A-4, requisitos de códigos de confirmação](https://pages.nist.gov/800-63-4/sp800-63a/ial-general/))
- O NIST separa autenticação — controle de autenticadores associados à Conta — de identity proofing. A publicação trata confirmação de endereço e autenticação como coisas distintas; não define uma transação de compra como prova de controle de uma caixa postal. ([NIST SP 800-63B-4, introdução e autenticação](https://pages.nist.gov/800-63-4/sp800-63b.html))
- A SP 800-63B afirma que e-mail não deve ser usado como autenticador out-of-band de autenticação. Isso **não invalida** um link de confirmação para verificar acesso ao endereço; são propósitos diferentes. ([NIST SP 800-63B-4, seção sobre out-of-band authentication](https://pages.nist.gov/800-63-4/sp800-63b.html))

**Limite de aplicação:** NIST SP 800-63 é uma diretriz de identidade digital para seus contextos de aplicação, não uma exigência automaticamente vinculante ao Hub. Aqui ela serve para separar conceitos corretamente, não para alegar conformidade ou obrigação regulatória.

### Plataformas de cursos

- A Teachable documenta que, na primeira compra, a pessoa recebe um e-mail de matrícula/ativação após o pagamento, completa a configuração da Conta e então obtém acesso imediato ao produto. Compradores que já têm Conta entram nela após informar o e-mail. ([Buy a product on Teachable](https://support.teachable.com/en/articles/15628322-buy-a-product-on-teachable))
- A Hotmart documenta que uma Conta pode ser criada com o e-mail informado no pagamento, mas o primeiro acesso inclui instrução enviada por e-mail para cadastrar a senha; também instrui a pessoa a usar o mesmo e-mail da compra para localizar o produto. ([Como acessar um produto comprado](https://help.hotmart.com/en/article/215827338/como-accedo-al-producto-que-compre-en-hotmart), [acesso à Área de Membros](https://help.hotmart.com/pt-br/article/360038506812/comment-acceder-a-hotmart-club))

Esses exemplos sustentam que compra sem cadastro prévio e ativação posterior por e-mail são padrões viáveis em LMS. Não provam que todas as plataformas verificam o endereço da mesma forma, nem que copiar exatamente uma implementação externa seja necessário.

## O que o Hub efetivamente faz

Verificado na worktree isolada `codex/graphify-adoption`, consultando `docs/domain/identity-and-authorization.md`, `docs/domain/commerce-and-access.md`, `docs/integrations/asaas.md` e os símbolos citados abaixo:

1. O Checkout público começa sem PII local. `src/features/payments/asaas-client.ts` monta o corpo de criação sem `customer` e sem `customerData`; `src/features/payments/asaas-client.test.ts` verifica explicitamente essa omissão. Portanto, neste fluxo, o Hub não envia previamente um e-mail ao Asaas para ser confirmado.
2. Após evidência financeira autoritativa, `src/features/payments/asaas-customer-enrichment.ts` correlaciona o evento e consulta o cliente do Asaas. Só então a identidade de compra é resolvida.
3. `src/features/payments/order-identity.ts` cria a Conta derivada do pedido com `email_verified = false`, preservando a regra aprovada em `DEC-DISC-007`/`REG-IDA-005` de que os dados de compra não verificam a Conta.
4. `src/features/payments/apply-authoritative-financial-evidence.ts` enfileira `auth.account-activation` quando a Conta ainda não tem credencial. `src/features/outbox/delivery.ts` envia o fluxo chamando Better Auth `requestPasswordReset`, para a pessoa abrir o e-mail e definir a senha.
5. A documentação local afirma que a criação da senha e o login foram homologados, mas a Conta criada pela compra permanece com `email_verified = false`. Assim, o evento de pagamento não é a prova; a ativação por e-mail é o passo que demonstra acesso à caixa postal. O estado persistido não registra hoje essa evidência.

## Fatos, inferências e decisão

| Tipo | Conclusão |
| --- | --- |
| Fato do provedor | Asaas documenta dados de pagador e status de pagamento; as referências consultadas não documentam que pagamento aprovado comprove acesso ao e-mail informado. |
| Fato do Hub | O checkout público não envia `customerData`; o Hub busca dados do cliente depois do evento financeiro e cria a Conta com `email_verified = false`. |
| Fato do Hub | A ativação de Conta usa um e-mail com link para definir senha. |
| Inferência | Aprovar uma cobrança comprova uma transação financeira segundo o Asaas, não que a pessoa que a iniciou controla o endereço de e-mail armazenado no cliente. A pessoa pode digitar outro endereço, errar a digitação ou usar um e-mail de terceiro; nada nas fontes consultadas elimina esses casos. |
| Inferência | O clique e uso bem-sucedido do link de ativação é a evidência disponível no fluxo Hub para posse operacional da caixa postal; não comprova identidade civil nem titularidade do meio de pagamento. |
| Decisão recomendada | Compra continua antes da Conta; não transformar pagamento em `email_verified`; não ativar uma exigência global de confirmação por causa do login Google. Registrar a verificação após prova efetiva de controle no fluxo de ativação, com persistência consistente e testes de falha/repetição. |

## Implicação para login Google

O risco concreto aparece quando o Hub tenta unir o Google autenticado a uma Conta local pelo e-mail. O e-mail usado em um pedido pago, sozinho, não deve autorizar essa união. A Conta local precisa ter uma prova de controle do mesmo endereço registrada de modo confiável antes de o vínculo automático ser permitido; no fluxo atual, a pessoa já recebe e usa um link de ativação, mas o indicador `email_verified` permanece falso. O plano OAuth deve corrigir essa lacuna no ponto de ativação, sem passar a exigir verificação global antes da compra ou de toda navegação.

Se o e-mail do Google divergir do endereço da compra, o Hub não deve mover matrícula ou mesclar Contas automaticamente. A pessoa deve entrar com o endereço usado na compra/ativá-lo e, já autenticada, vincular explicitamente outra identidade ou acionar suporte. Não expor se um endereço possui pedido/Conta em mensagens públicas.

## Verificação global ou específica?

### O que a versão instalada permite

O projeto usa Better Auth `1.6.25`. Nessa versão, `emailAndPassword.requireEmailVerification` **existe**, mas só bloqueia sessões de email/senha. Para funcionar, exige um sender `emailVerification.sendVerificationEmail`; `sendOnSignIn` pode disparar o e-mail de confirmação quando uma Conta não verificada tenta entrar.

Ligá-lo sem outra mudança quebraria o cadastro atual: Better Auth cria o usuário com `emailVerified=false`, não cria a sessão e retorna `token: null`; o formulário do Hub espera sessão imediata e chama `/api/auth/redirect`. A autoinscrição gratuita também depende dessa sessão e de preservar o retorno para o Curso. O Hub não tem sender de verificação configurado hoje.

O flag de senha também **não** torna a verificação global. O gate equivalente em `socialProviders.google` não está na API tipada `1.6.25`; ele foi adicionado posteriormente. Em `1.6.25`, o callback social pode criar sessão de uma Conta cujo Google informou `email_verified=false`. Portanto, habilitar apenas `emailAndPassword.requireEmailVerification` mudaria signup e login por senha, mas não protegeria todos os fluxos sociais.

Referências: [opções tipadas v1.6.25](https://github.com/better-auth/better-auth/blob/v1.6.25/packages/core/src/types/init-options.ts), [sign-up v1.6.25 — envio e ausência de sessão](https://github.com/better-auth/better-auth/blob/v1.6.25/packages/better-auth/src/api/routes/sign-up.ts), [sign-in v1.6.25 — gate de senha](https://github.com/better-auth/better-auth/blob/v1.6.25/packages/better-auth/src/api/routes/sign-in.ts), [changelog do gate social posterior](https://github.com/better-auth/better-auth/blob/main/packages/core/CHANGELOG.md).

### Parecer

**Não habilitar verificação global por causa do login Google.** Isso não é necessário para manter checkout guest-first nem para liberar uma compra paga, e a opção não cobre Google no Better Auth instalado. Também imporia uma nova barreira aos cadastros/free-enrollments que hoje recebem sessão imediata.

Isso não significa considerar o pagamento como verificação. A recomendação específica é:

1. Manter `emailAndPassword.requireEmailVerification` desativado e não enviar confirmação automática em cada cadastro/login.
2. Para Conta derivada de compra sem credencial, manter o link de primeiro acesso. Só depois que a pessoa abrir o e-mail e concluir a ação o Hub deve registrar `email_verified=true`; não fazer isso no webhook de pagamento.
3. Contas locais antigas criadas por email/senha também podem estar com `emailVerified=false`. Quando o vínculo Google for bloqueado por essa razão, oferecer uma confirmação de e-mail **sob demanda**, sem dizer se existe Conta. Better Auth 1.6.25 oferece `POST /send-verification-email`; sem sessão, retorna resposta genérica também para e-mail inexistente/já verificado e usa uma espera constante para reduzir enumeração. O Hub teria de configurar o sender, deixar `sendOnSignUp`/`sendOnSignIn` desligados e expor uma pequena ação “Enviar link de confirmação”. Depois do clique, a pessoa tenta Google de novo.
4. Se a pessoa já estiver autenticada com senha, o vínculo explícito Better Auth (`linkSocial`) é outra opção segura: exige sessão, claim Google verificado e e-mail correspondente; não exige que a Conta local já tenha `emailVerified=true`. O Hub ainda não expõe essa ação nas configurações.

No estado atual, a outbox envia `auth.account-activation` apenas quando a Conta paga ainda não tem credencial. Portanto, uma Conta antiga que já tem senha mas continua com `email_verified=false` não recebe essa ativação ao comprar; ela continua conseguindo entrar com senha hoje e pode usar o fluxo pontual caso queira conectar Google. Não se deve tornar a senha globalmente bloqueada sem também rever essa classificação e garantir entrega da verificação.

**Preferência para o Hub:** confirmação sob demanda após erro de vínculo, pois preserva o login/cadastro atual, serve para Student/Admin/Suporte sem migrar toda a UI de Conta e evita pedir que a pessoa redefina uma senha. A ativação paga já existente continua sendo o caminho mais direto para quem ainda não possui credencial.

Referências: [endpoint `send-verification-email` v1.6.25](https://github.com/better-auth/better-auth/blob/v1.6.25/packages/better-auth/src/api/routes/email-verification.ts), [callback explícito `linkSocial` v1.6.25](https://github.com/better-auth/better-auth/blob/v1.6.25/packages/better-auth/src/api/routes/callback.ts), [Configurações de identidade do Hub](../src/lib/auth.ts), [formulário atual de cadastro](<../src/app/(auth)/cadastro/sign-up-form.tsx>) e [configurações do Aluno](<../src/app/(student)/app/configuracoes/page.tsx>).

## Limitações e perguntas não respondidas

- A documentação pública do Asaas examinada não esclarece eventual validação silenciosa do e-mail, heurísticas antifraude específicas, confirmação por canal externo ou diferenças entre métodos de pagamento. Não se deve converter essa lacuna documental em afirmação de inexistência.
- Não inspecionei uma transação real nem registros privados da conta Asaas; não usei banco, credenciais ou payloads de cliente.
- Confirmações adicionais do banco/emissor do cartão ou validação do instrumento financeiro não significam automaticamente controle do e-mail digitado no Checkout.
- As páginas públicas de Teachable/Hotmart descrevem a experiência de acesso, mas não detalham todos os controles internos contra fraude ou vinculação de identidades.
- Um link de ativação pode ser encaminhado ou a caixa postal pode estar comprometida; ele prova acesso ao canal naquele momento, não identidade civil nem controle perpétuo.

## Fontes primárias

- Asaas, [Como informar os dados do cliente no Checkout](https://docs.asaas.com/docs/como-informar-os-dados-do-cliente)
- Asaas, [Criar novo Checkout (referência da API)](https://docs.asaas.com/reference/criar-novo-checkout)
- Asaas, [Eventos para cobranças](https://docs.asaas.com/docs/webhook-para-cobrancas)
- Asaas, [Criar novo cliente (referência da API)](https://docs.asaas.com/reference/criar-novo-cliente)
- NIST, [SP 800-63A-4 — Identity Proofing Requirements](https://pages.nist.gov/800-63-4/sp800-63a/ial-general/)
- NIST, [SP 800-63B-4 — Digital Authentication](https://pages.nist.gov/800-63-4/sp800-63b.html)
- Teachable, [Buy a product on Teachable](https://support.teachable.com/en/articles/15628322-buy-a-product-on-teachable)
- Hotmart, [How do I access the product I bought on Hotmart?](https://help.hotmart.com/en/article/215827338/como-accedo-al-producto-que-compre-en-hotmart)
- Hub, `docs/domain/identity-and-authorization.md` (REG-IDA-005 e REG-IDA-006), `docs/domain/commerce-and-access.md` (REG-COM-002 a REG-COM-005), `docs/integrations/asaas.md`, `src/features/payments/asaas-client.ts`, `src/features/payments/asaas-customer-enrichment.ts`, `src/features/payments/order-identity.ts`, `src/features/payments/apply-authoritative-financial-evidence.ts`, `src/features/outbox/delivery.ts`.
