---
status: research
owner: product-and-engineering
researched_on: 2026-09-27
scope: document-only; guest-first course checkout and post-purchase identity
---

# Pesquisa documental: compra guest-first e identidade após a compra

## Pergunta e resposta curta

Como manter o checkout do Hub simples sem obrigar a pessoa a criar uma conta
antes de pagar, e como isso se relaciona com login Google?

**Recomendação:** manter a compra guest-first. Não exigir login, cadastro, senha
nem OAuth antes de iniciar ou concluir o checkout. Usar o e-mail fornecido na
compra como endereço de recibo e como chave operacional de acesso; só criar ou
ativar a Conta Hub e conceder acesso após a confirmação financeira autoritativa.
Depois, orientar o primeiro acesso pelo e-mail de ativação. O Google deve ser
uma opção de autenticação da Conta já identificada, não uma etapa adicional do
checkout.

Isto é uma recomendação de produto inferida dos padrões documentados, não uma
conclusão experimental de que um fluxo específico converte mais. As fontes
públicas consultadas não expõem testes controlados comparando cadastro antes e
depois do pagamento para o mesmo público, curso, preço e método de pagamento.

## Padrões encontrados em fontes primárias

| Produto | Fato documentado | O que isso informa ao Hub | Limite da evidência |
|---|---|---|---|
| **Teachable** | No fluxo atual de Teachable Payments, a pessoa informa o e-mail, paga e, após a compra, é encaminhada à página pós-compra para entrar ou se cadastrar. Para uma primeira compra, recebe um e-mail de matrícula que inicia o cadastro, com nome e senha. O artigo atual diz que o e-mail também identifica a Conta e gera uma sessão de checkout. [Compra de produto](https://support.teachable.com/en/articles/15628322-buy-a-product-on-teachable), [checkout atual](https://support.teachable.com/en/articles/15646496-customize-your-checkout-page) | É o paralelo mais próximo para preservar o momento de pagamento antes de completar as credenciais. O e-mail é coletado para a transação; a criação/ativação de acesso fica no pós-compra. | O fluxo varia por gateway e configurações da escola. A Teachable descreve seu desenho e intenção; a afirmação de que foi “designed to maximize conversion” não fornece experimento público, grupo de controle ou tamanho de efeito para a decisão do Hub. |
| **Hotmart** | A Central de Ajuda informa que a primeira compra cria automaticamente uma Conta com o e-mail usado no pagamento; para o primeiro acesso, a pessoa registra uma senha. O acesso pode começar pelo e-mail de confirmação. A Hotmart lista login com Google/Apple, alerta que outra Conta Google pode levar a um cadastro diferente sem as compras e recomenda usar o e-mail da compra. [Primeiro acesso ao produto](https://help.hotmart.com/pt-br/article/215827338/como-acesso-o-produto-que-comprei-na-hotmart), [opções de login](https://help.hotmart.com/pt-br/article/39413024793613) | Reforça a importância de uma identidade pós-compra ligada ao e-mail da transação e de explicar claramente que o login social precisa corresponder à identidade que tem as compras. | Não é um checkout sem criação de Conta: a Hotmart cria a Conta automaticamente. A documentação não prova que vincula automaticamente um login Google à Conta criada na compra, nem que o fluxo de Conta é idêntico em todos os produtos/regiões. |
| **Thinkific** | A documentação do checkout atual diz que estudantes fornecem os dados durante a compra e criam senha para configurar a Conta antes de obter acesso. Outra página distingue o checkout de performance do checkout legado; no legado, a criação de Conta ocorria antes do pagamento e podia deixar perfis sem matrícula quando a pessoa abandonava a etapa de pagamento. [Experiência do estudante](https://support.thinkific.com/hc/en-us/articles/360030353834-The-Thinkific-Student-Experience), [cadastros versus matrículas](https://support.thinkific.com/hc/en-us/articles/360030369874-Understanding-User-Sign-Ups-Versus-Enrollments) | Mostra que existe uma alternativa com cadastro durante checkout, mas também explicita a separação entre Conta e matrícula e o risco operacional de usuários sem compra em um fluxo de duas etapas. Isso não é motivo para mover o cadastro do Hub para antes do pagamento. | A documentação descreve vários modos/versões e diz que a experiência depende dos recursos habilitados. A observação de abandono refere-se ao fluxo legado de duas etapas; não mede causalmente a diferença de conversão. |
| **Shopify** | A loja pode configurar a exigência de login antes do checkout como opcional. A documentação alerta que, se o login for obrigatório, opções de checkout acelerado como Apple Pay podem deixar de aparecer para evitar que contornem a exigência. [Opções de checkout](https://help.shopify.com/en/manual/checkout-settings/checkout-form-options) | É evidência de que a exigência de autenticação pode interferir em caminhos rápidos de pagamento e é tratada como escolha de configuração, não requisito universal de e-commerce. Apoia não acrescentar autenticação obrigatória ao caminho de pagamento do Hub. | Comércio de bens/lojas não é idêntico a uma plataforma educacional; o efeito específico sobre conversão de cursos do Hub não pode ser inferido da documentação Shopify. |
| **Stripe Checkout** | Uma sessão de pagamento pode operar sem Customer pré-existente; quando não há Customer, os dados podem ficar associados a um “guest customer”. A API permite configurar se cria Customer na confirmação da sessão. Stripe esclarece que esse agrupamento de convidados é somente leitura e não equivale a uma Conta com credenciais. [Guest customers](https://docs.stripe.com/payments/checkout/guest-customers), [criar Checkout Session](https://docs.stripe.com/api/checkout/sessions/create) | Confirma uma distinção arquitetural importante: identidade de pagamento/recibo pode existir sem Conta de login. O Hub não precisa antecipar cadastro só para permitir a transação. | Stripe documenta infraestrutura de pagamento, não a experiência educacional, ativação de acesso ou vinculação de Google. “Guest customer” não deve ser confundido com aluno autenticável. |

## Síntese para o fluxo do Hub

### Fluxo recomendado

1. **Descoberta e checkout:** permitir abrir o checkout sem sessão e sem formulário
   de Conta. Coletar apenas os dados necessários à cobrança e à entrega do
   acesso; não inserir o botão Google no caminho obrigatório do pagamento.
2. **Confirmação:** considerar a compra concluída apenas após confirmação
   financeira autoritativa, não por retorno do navegador ou início do checkout.
3. **Reconciliação de identidade:** usar o e-mail associado à compra para
   localizar/criar a Conta Hub e projetar o acesso conforme as regras comerciais
   existentes. Não conceder matrícula por um login social isolado.
4. **Primeiro acesso:** comunicar com clareza que a compra foi aprovada e como
   acessar. Enviar ativação ao e-mail da compra; a Conta e o acesso não devem
   depender de o usuário completar cadastro antes de pagar.
5. **Login posterior:** apresentar Google na rota de entrar como login de Conta
   existente. Se a pessoa quiser criar uma Conta social sem uma compra, fazê-lo
   apenas na rota explícita de cadastro e sob a flag de cadastro público do Hub.
   Para encontrar uma compra, usar a identidade verificada correspondente ao
   e-mail da compra; não criar uma Conta vazia silenciosamente quando a intenção
   era entrar.

Essa sequência evita interromper a compra com uma etapa de senha/conta, mas
preserva uma ação pós-compra de ativação. A ativação não deve ser escondida ou
descrita como se o acesso já estivesse ativo quando ainda depende da confirmação
do e-mail.

### Fricção que permanece e como reduzi-la sem enfraquecer identidade

- **Ativação por e-mail é uma etapa real.** A evidência de Teachable e Hotmart
  mostra que ativação/primeiro acesso após a compra é um padrão de mercado, não
  prova de que seja indolor. O Hub deve usar assunto e CTA explícitos, explicar
  que a compra está aprovada, dizer qual e-mail recebeu o link, fornecer
  reenvio seguro e apresentar “já tenho acesso / entrar” para compradores
  recorrentes.
- **Não forçar senha se o objetivo é só provar posse da caixa postal.** Isso é
  uma oportunidade de desenho, não uma conclusão das fontes pesquisadas. O
  plano de implementação deve comparar o fluxo atual de criação de senha com
  uma ativação por link/código de uso único, mas manter ambos depois do pagamento
  e sem criar vínculo Google a uma Conta local não verificada. Qualquer mudança
  precisa preservar recuperação de Conta, expiração/uso único do token e
  proteção contra pré-sequestro de Conta.
- **Google com e-mail diferente pode parecer perda de compra.** A documentação
  Hotmart demonstra que um login Google diferente pode abrir uma identidade
  separada sem as compras. O Hub deve, portanto, explicar “use o mesmo e-mail da
  compra” no primeiro acesso e oferecer recuperação/vinculação segura, sem
  revelar se um e-mail existe no sistema.
- **Compradores recorrentes:** oferecer entrar antes de pagar como ação opcional
  ou reconhecer a Conta sem torná-la requisito. Não converter isso em uma
  barreira obrigatória ao checkout, especialmente no mobile ou em pagamento
  acelerado.

## Avaliação da simplicidade

O fluxo com menor fricção **antes do pagamento** é manter a compra guest-first.
O comprador faz a transação sem criar senha e sem decidir qual provedor de
identidade usar; a conta de acesso é tratada após o evento financeiro. Esta
conclusão é uma inferência de UX apoiada por:

- Teachable e Hotmart documentarem criação/configuração de Conta depois da
  compra ou a partir do e-mail de compra;
- Shopify permitir checkout sem login obrigatório e alertar sobre caminhos de
  pagamento acelerado quando se exige login;
- Stripe separar a sessão/registro de pagamento de uma Conta de autenticação.

Isso **não** determina que ativação por e-mail seja sempre superior a um login
Google imediato. Para o Hub, não se deve trocar a segurança de vinculação por uma
suposição de conveniência. Uma ativação por Google antes de verificar o e-mail
local comprado requer prova forte de que a Conta específica é derivada de uma
compra válida, e desenho próprio para conflitos de email/alias, conta existente,
reembolso, bloqueio e concorrência. As fontes de checkout consultadas não
resolvem esses detalhes.

## Opções descartadas nesta análise

### Exigir `/entrar` ou `/cadastro` antes do checkout

**Não recomendado.** Adiciona uma decisão de identidade e potencial criação de
senha à compra; o checkout pode ser interrompido sem pagamento. Plataformas
documentam fluxos que adiam o cadastro para depois, e Shopify alerta que tornar
login obrigatório pode suprimir opções aceleradas. Não há benefício demonstrado
pelas fontes públicas que justifique transformar isso em requisito do Hub.

### Colocar Google como etapa obrigatória dentro do checkout

**Não recomendado.** Login social resolve autenticação, não pagamento nem
concessão; introduz redirecionamento externo no instante de maior intenção de
compra e gera decisão adicional. Nenhuma fonte consultada mostra que OAuth
obrigatório em checkout de curso melhora conversão ou reduz abandono.

### Criar automaticamente uma Conta quando Google é usado na rota de entrar

**Não recomendado para o Hub.** Mistura login e cadastro, pode deixar perfis
sem compra/acesso e pode separar a Conta Google da identidade da compra. A
Hotmart documenta o risco percebido pelo aluno ao entrar com outro Google e não
ver compras. No Hub, a rota explícita `/cadastro` continua sendo a intenção de
criar conta.

## Medição para validar a escolha no Hub

Implementar guest-first não deve ser tratado como hipótese permanentemente
verdadeira. Medir sem registrar dados pessoais desnecessários:

- checkout iniciado → pagamento confirmado;
- tempo entre confirmação financeira e primeiro acesso;
- percentual de compradores que completam ativação em 24 horas e 7 dias;
- falhas/reenvios de ativação e contatos de suporte por acesso;
- casos de conta duplicada ou “curso não aparece” após entrar com Google;
- conversão segmentada por dispositivo e método de pagamento, sem confundir
  esses fatores com efeito de autenticação.

Só comparar checkout com exigência de cadastro se houver uma hipótese de negócio,
experimento controlado, critério de sucesso e salvaguarda para não bloquear
compras. A documentação de fornecedores não substitui essa medição local.

## Fatos, inferências e limites

### Fatos das fontes

- Teachable descreve entrada de e-mail e pagamento antes do cadastro de novos
  alunos no pós-compra, em seu fluxo Teachable Payments atual.
- Hotmart diz que cria a Conta a partir do e-mail de compra e permite primeiro
  acesso via e-mail para cadastrar senha; login Google/Apple existe e entrar com
  outra identidade pode mostrar outra Conta sem compras.
- Thinkific documenta configuração de Conta durante compra e também descreve
  que o antigo checkout de duas etapas podia deixar Conta sem matrícula quando
  havia abandono antes do pagamento.
- Shopify permite definir se login antes do checkout é exigido e registra uma
  consequência para opções de checkout acelerado.
- Stripe diferencia convidados de Customers/Accounts autenticáveis e admite
  sessões de Checkout sem Customer pré-existente.

### Inferências deste relatório

- Para Hub, não impor conta antes do pagamento reduz um bloqueio estrutural e
  mantém a sequência existente de compra independente da autenticação.
- O e-mail de compra deve ser o ponto de reconciliação da ativação e da
  identidade social; instruções explícitas de “mesmo e-mail” tendem a reduzir
  confusão sobre curso ausente.
- A opção de ativar por Google sem criar senha pode ser melhor para parte dos
  compradores, mas requer avaliação técnica e validação com dados de uso; não é
  provada pelos padrões públicos consultados.

### O que fontes públicas não provam

- Qual padrão tem melhor conversão para o público NeuroCapacitar, seus cursos,
  preços, Asaas, Pix/cartão, região e proporção de tráfego mobile.
- Que Teachable/Hotmart sejam tecnicamente “guest checkout” no sentido estrito
  de não haver Conta antes da conclusão; a Teachable coleta e-mail para
  identificar a Conta e Hotmart cria Conta automaticamente após primeira compra.
- Que um comprador possa vincular sua Conta social à Conta criada pela compra
  sem uma etapa prévia de verificação, nem como cada plataforma resolve aliases,
  emails divergentes, reembolsos ou concorrência.
- Que o fluxo atual do Hub esteja implementado corretamente. Este documento é
  comparação documental do fluxo de produto; não inspeciona ou testa a
  implementação, credenciais, callback OAuth, gateway nem banco.
- Que alteração de checkout, criação de Conta ou login social melhore conversão
  sem experimento local. Alegações de marketing dos fornecedores não são
  evidência independente comparativa.

## Fontes consultadas

Fontes primárias de produto/API, consultadas em 2026-09-27. Links apontam para
documentação oficial/help centers dos fornecedores:

1. Teachable, [Buy a product on Teachable](https://support.teachable.com/en/articles/15628322-buy-a-product-on-teachable) — compra, identificação por e-mail e ativação de primeira Conta.
2. Teachable, [Customize your checkout page](https://support.teachable.com/en/articles/15646496-customize-your-checkout-page) — fluxo atual em duas etapas e ação pós-pagamento.
3. Hotmart, [Como acesso o produto que comprei?](https://help.hotmart.com/pt-br/article/215827338/como-acesso-o-produto-que-comprei-na-hotmart) — Conta criada após primeira compra e primeiro acesso.
4. Hotmart, [Quais são as opções de login para acessar minha conta?](https://help.hotmart.com/pt-br/article/39413024793613) — login Google/Apple e orientação para usar identidade/e-mail associado às compras.
5. Thinkific, [The Thinkific Student Experience](https://support.thinkific.com/hc/en-us/articles/360030353834-The-Thinkific-Student-Experience) — coleta de dados, criação de Conta e acesso após compra.
6. Thinkific, [Understanding User Sign Ups Versus Enrollments](https://support.thinkific.com/hc/en-us/articles/360030369874-Understanding-User-Sign-Ups-Versus-Enrollments) — diferença entre usuário, checkout, abandono e matrícula; distinção de checkout legado.
7. Shopify, [Editing the checkout form options](https://help.shopify.com/en/manual/checkout-settings/checkout-form-options) — login opcional/obrigatório e efeito em opções aceleradas.
8. Stripe, [Guest customers](https://docs.stripe.com/payments/checkout/guest-customers) e [Create a Checkout Session](https://docs.stripe.com/api/checkout/sessions/create) — Customer opcional e semântica de convidado na camada de pagamentos.
