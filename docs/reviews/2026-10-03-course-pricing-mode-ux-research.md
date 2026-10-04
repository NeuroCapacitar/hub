---
status: proposed
owner: product
last_verified_commit: ee0baa396cbb38d76cd2a0e168e8738aea751bd8
---

# Pesquisa de UX: preço gratuito ou pago para Cursos

## Escopo e estado

Pesquisa de referências oficiais e revisão da implementação no commit
`ee0baa396cbb38d76cd2a0e168e8738aea751bd8`, consultados em 2026-10-03. Esta nota
registra uma recomendação de UX para avaliação do Produto; não aprova uma decisão nem
altera código, schema ou o contrato vigente de preço.

## Recomendação focal

Apresentar a modalidade como uma escolha explícita e visível: um `fieldset` com radios
**Gratuito** e **Pago**. Não usar switch nem select. Na criação, nenhuma opção deve vir
pré-selecionada; o Admin escolhe a modalidade deliberadamente. Ao selecionar Pago,
mostrar o campo de preço e uma ajuda visível com o piso aprovado de R$ 10,00. Mostrar
erros de preço junto ao campo.

Na edição, derivar a opção selecionada da oferta salva: `price_in_cents = 0` significa
Gratuito; um valor positivo significa Pago. O radio pode ser estado transitório da tela;
ao salvar, a modalidade continua persistida somente pelo campo existente `price_in_cents`
(`0` ou valor a partir de `1000` centavos). Não adicionar boolean ou enum de modalidade
ao banco, pois duplicaria o estado atual.

O texto de apoio deve explicar a consequência do modo Gratuito: a nova inscrição é uma
aquisição direta pelo Hub e não gera Pedido financeiro nem Checkout Asaas. Ela continua
sujeita aos gates vigentes de disponibilidade, publicação e cronograma; a opção Gratuito
não significa publicar ou abrir automaticamente um Curso.

## Evidências internas no commit verificado

- `src/app/(admin)/admin/cursos/course-creation-form.tsx`, `CourseCreationFields`:
  criação usa um único campo obrigatório `price`. A explicação de `0,00` e do piso de
  R$ 10,00 aparece na ajuda acionada pelo tooltip. `getErrorMessage` mapeia a mensagem de
  validação para `fieldErrors.price`, renderizada em texto inline no campo.
- `src/app/(admin)/admin/cursos/[courseId]/course-dialogs-client.tsx`,
  `CourseSettingsEditor` e apresentação de oferta: edição também usa um único input de
  preço, sem ajuda do piso. `isFreeCourse` é derivado de preço parseado igual a zero. O
  aviso “Curso gratuito. A inscrição é feita diretamente pelo Hub.” só aparece nesse
  modo. Uma alteração numérica abre confirmação antes de salvar.
- `src/features/payments/course-price.ts`, `parseCoursePriceToCents`: aceita zero ou
  valores de pelo menos `1000` centavos; rejeita de R$ 0,01 a R$ 9,99. A autoria aplica
  essa validação no servidor em `src/features/admin/authoring.ts`,
  `readCourseFormValues`. `src/features/payments/checkout.ts` repete o piso antes de
  criar o Pedido ou chamar o provider.
- `src/features/payments/checkout.ts` importa `ASAAS_MINIMUM_CHECKOUT_VALUE_IN_CENTS`,
  definido localmente como `1000` em `src/features/payments/asaas.ts`. O nome do símbolo
  não torna o piso obrigação contratual do Asaas: R$ 10,00 é o contrato comercial aprovado
  do Hub em `DEC-DISC-010` e `REG-COM-001`.
- `src/db/schema.ts`, tabela `courses`, persiste o valor em `priceInCents`/
  `price_in_cents`; a migration `0044_asaas_commerce_persistence.sql` permite zero ou
  valores a partir de `1000`. `DEC-DISC-011` mantém um preço por Curso pago, compartilhado
  por Pix e cartão.
- `docs/domain/commerce-and-access.md`, `REG-COM-001`, e
  `docs/adr/0016-free-course-self-enrollment.md` definem a autoinscrição. Para acesso
  gratuito, o Curso precisa estar ativo, listado, com vendas abertas, publicação
  publicada e cronograma compatível. A ação exige Student autenticada; visitantes seguem
  o handoff de login/cadastro. A operação não cria Pedido, registro em `orders`, Checkout
  nem chamada ao Asaas.

## Referências externas oficiais consultadas em 2026-10-03

### Hotmart

O fluxo documentado separa oferta comercial de liberação de conteúdo: uma oferta cadastra
nome interno, descrição exibida no pagamento, moeda, forma de pagamento e valor. Para
cursos, a Área de Membros também permite liberar o curso completo gratuitamente ou abrir
módulos como amostra; o módulo gratuito depende de “Cadastro gratuito”. Assim, “gratuito”
pode descrever preço/acesso ou uma prévia, e não deve ser presumido como um único fluxo.
Não encontrei piso público e explícito para o preço de uma oferta Hotmart. O limiar de
R$ 10,00 na [Política de Pagamentos](https://hotmart.com/pt-br/legal/politicas-de-pagamento),
versão atualizada em 2026-09-21, classifica microtransações para cálculo de taxas; não é
uma regra publicada de preço mínimo.

Fontes: [criação de oferta de pagamento único](https://help.hotmart.com/pt-br/article/215827788/como-crear-una-oferta-para-mi-producto),
[configuração de módulos gratuitos](https://help.hotmart.com/pt-BR/article/360000645592/como-criar-e-gerenciar-modulos-na-area-de-membros),
[como funciona o acesso gratuito](https://help.hotmart.com/en/article/14739941395725/how-does-my-free-access-to-a-product-work/).

### Kiwify

O cadastro documenta seletores em sequência: tipo de pagamento (“pagamento único” ou
“assinatura recorrente”) e formato de entrega. O valor mínimo publicado para produtos é
R$ 5,00; no parcelamento, o mínimo informado é R$ 5,00 por parcela. O material consultado
não descreve uma opção de produto gratuito, portanto não permite concluir que ela inexista.
O artigo de cadastro foi atualizado em 2026-03-19.

Fontes: [cadastrar produto](https://ajuda.kiwify.com.br/pt-br/article/como-cadastrar-o-seu-produto-1lxh5g7/),
[parcelamento no checkout](https://ajuda.kiwify.com.br/pt-br/article/como-funciona-o-parcelamento-no-checkout-1um5p52/).

### Udemy

O instrutor configura o curso em **Preços**, selecionando um nível ou preço secundário.
Cobrar exige cadastro como instrutor premium. O artigo diz que a transição de gratuito
para pago só pode ocorrer uma vez; alternar novamente depois da publicação desativa os
anúncios promocionais. No Programa de Ofertas, o piso promocional publicado é US$ 9,99
ou equivalente local, salvo vendas a revendedores/distribuidores. A plataforma pode
ajustar preço de tabela por mercado. Não usar a matriz BRL ligada pelo suporte como piso
atual confirmado: o nome do arquivo contém `09-17`, sem confirmação de atualização da
tabela.

Fontes: [definir preço do curso](https://support.udemy.com/hc/pt/articles/229605668-Instrutores-como-definir-o-pre%C3%A7o-do-seu-curso),
[Programa de Ofertas e pisos locais](https://support.udemy.com/hc/pt/articles/229232827-Acordos-promocionais-do-instrutor-Ofertas-da-Udemy-e-o-Programa-de-Assinatura-da-Udemy),
[matriz ligada pelo suporte](https://s3.amazonaws.com/udemy-images/support/Udemy%20Price%20Tier%20Matrix%20-%20EN%2009-17%20Matrix.pdf).
As páginas de suporte exibem ©2026; não informam data individual de atualização.

### Teachable e Thinkific

Teachable apresenta quatro tipos de preço: **Free**, compra única, plano de pagamentos e
assinatura. Para gratuito, o aluno cria uma conta e acessa sem checkout; a própria ajuda
cita lead magnets, mini-cursos e previews como usos. O mínimo pago publicado é US$ 1 ou
equivalente aproximado na moeda selecionada. É possível criar planos com checkout URLs
distintas. O artigo foi publicado em 2025-11-08.

Thinkific coloca tipos de cobrança na aba **Pricing**: gratuito, pagamento único,
assinatura ou plano mensal. Para gratuito, a ajuda documenta o CTA **“Enroll for free”**,
cadastro em conta e acesso ao produto; a duração pode ser limitada. Outra página distingue
essa opção de prévia gratuita, teste de assinatura e cupom de 100% de desconto. Se o curso
passar a ser pago, quem entrou gratuitamente mantém o acesso; novos alunos pagam.
As páginas consultadas não exibem um piso pago. A documentação do construtor informa que
sites criados a partir de 2026-01-28 têm acesso ao novo Course Builder.

Fontes: [preços de produto no Teachable](https://support.teachable.com/en/articles/11682476-price-your-products),
[curso gratuito no Thinkific](https://support.thinkific.com/hc/en-us/articles/360038156174-How-to-Set-Your-Product-to-Free),
[CTA e inscrição gratuita no Thinkific](https://support.thinkific.com/hc/en-us/articles/360062349633-How-do-students-enroll-in-my-free-product),
[adicionar preço depois](https://support.thinkific.com/hc/en-us/articles/360051793733-Can-I-set-my-course-to-free-and-add-a-price-later),
[acesso grátis a curso pago](https://support.thinkific.com/hc/en-us/articles/360030356714-Give-Free-Access-to-a-Paid-Course).
Teachable informa a data do artigo; as páginas Thinkific não exibem data de atualização e
foram consultadas em 2026-10-03.

## Inferências

Nas fontes comparadas, preço gratuito, prévia gratuita, teste, desconto de 100% e forma de
cobrança aparecem como conceitos distintos. É razoável expor Gratuito/Pago como decisão
principal e tratar prévias ou acesso promocional em controles separados, caso o Hub venha
a oferecer esses recursos. O `fieldset` com radios torna a escolha binária e suas
consequências explícitas sem criar uma segunda autoridade persistida para a modalidade.

O R$ 5,00 da Kiwify é um limite daquela plataforma e não substitui o piso aprovado de
R$ 10,00 do Hub. Da mesma forma, o piso promocional da Udemy, o limiar de microtransação
da Hotmart e os valores de outros gateways não redefinem `REG-COM-001`.
