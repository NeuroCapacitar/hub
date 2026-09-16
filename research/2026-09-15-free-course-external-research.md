---
date: 2026-09-15
scope: Pesquisa externa independente para a feature de curso gratuito do Hub
status: research
---

# Pesquisa externa: curso gratuito

## Escopo e método

Pesquisa realizada em 2026-09-15. O objetivo foi comparar a proposta do
`RelatorioPrevio.md` com documentação oficial atual de Next.js, React, Asaas,
Thinkific, Teachable, Moodle, Open edX e Kajabi.

As fontes abaixo são primárias: documentação dos próprios projetos e
documentação oficial dos provedores. A seção **Fatos** registra somente o que a
fonte afirma. A seção **Inferências para o Hub** registra conclusões aplicadas
ao código e ao escopo desta feature; elas não são contratos externos.

## Next.js e React

### Fatos

- O Next.js documenta Server Functions usadas como Server Actions quando
  conectadas a `form action` ou `button formAction`. Essas funções são
  invocáveis por `POST`, portanto autenticação e autorização precisam ser
  verificadas dentro de cada função. A documentação também descreve
  progressive enhancement para formulários em Server Components.
- O Next.js documenta `revalidatePath`/`revalidateTag` após uma mutação e
  `redirect` ao final do fluxo. `redirect` interrompe o fluxo por uma exceção
  tratada pelo framework; chamadas que precisam ocorrer antes dele, como
  revalidação, devem vir antes do redirect.
- O React documenta que uma função de servidor passada a `form action` pode
  operar com os recursos de formulário do React 19. `useActionState` é a opção
  documentada para expor estado de retorno e pendência quando a UI precisar
  tratar erro sem navegação imediata.

Fontes oficiais:

- [Next.js: Mutating Data](https://nextjs.org/docs/app/getting-started/mutating-data)
- [Next.js: `use server`](https://nextjs.org/docs/app/api-reference/directives/use-server)
- [Next.js: App Router Mutating Data](https://nextjs.org/learn/dashboard-app/mutating-data)
- [React: Server Functions](https://react.dev/reference/rsc/server-functions)
- [React: `use server`](https://react.dev/reference/rsc/use-server)
- [React 19](https://react.dev/blog/2024/12/05/react-19)

### Inferências para o Hub

- A escolha do relatório por uma Server Action é compatível com a plataforma,
  desde que a action receba apenas dados mínimos do formulário, releia o Curso
  no servidor, exija a sessão `student` e trate a mutação como um POST direto e
  não confiável.
- O serviço de domínio deve terminar a transação antes de chamar
  `revalidatePath` e `redirect`. Como a página `/comprar/[slug]` é
  `force-dynamic` no commit auditado, a revalidação do handoff pode ser uma
  garantia explícita de coerência futura, mas não deve substituir a releitura
  server-side da autorização.
- O relatório usa a expressão “Server Action” corretamente para o ecossistema
  atual, mas o plano precisa incluir autenticação, autorização, validação e
  tratamento de erros; a forma do formulário, isoladamente, não é uma barreira
  de segurança.

## Asaas

### Fatos

- O Asaas descreve o Checkout como uma página hospedada para o pagador concluir
  uma compra com Pix, cartão, assinaturas ou parcelamento.
- A criação do Checkout exige ao menos uma forma de pagamento em
  `billingTypes`, ao menos um tipo em `chargeTypes`, `callback` e `items`.
  `minutesToExpire` é documentado entre 10 e 1440 minutos.
- A criação do Checkout não confirma pagamento. O Asaas orienta acompanhar o
  resultado por eventos/webhooks; a URL de callback não deve ser usada como
  confirmação financeira.
- A documentação oficial consultada não apresenta um contrato de Checkout
  gratuito com item de valor zero e não afirma explicitamente, na referência
  consultada, uma regra universal “valor zero é rejeitado”. Portanto, não é
  seguro transformar essa rejeição em fato externo sem uma confirmação
  específica do Asaas para a conta/API usada.

Fontes oficiais:

- [Asaas Checkout](https://docs.asaas.com/docs/asaas-checkout)
- [Criar novo Checkout](https://docs.asaas.com/reference/criar-novo-checkout)
- [Guia de cobranças](https://docs.asaas.com/docs/guia-de-cobrancas)
- [Como informar os dados do cliente](https://docs.asaas.com/docs/como-informar-os-dados-do-cliente)

### Inferências para o Hub

- A conclusão do relatório de não chamar Asaas para autoinscrição gratuita é
  correta, mas a justificativa deve ser precisa: curso gratuito não precisa de
  confirmação financeira, cobrança, webhook ou conciliação; além disso, o
  contrato oficial consultado não oferece uma modalidade de autoinscrição
  gratuita no Checkout.
- O limite comercial interno do Hub de R$ 10 deve continuar sendo tratado como
  regra do próprio domínio e como validação da integração atual. A documentação
  oficial consultada não deve ser citada como prova única de que todo Checkout
  de valor zero é tecnicamente impossível.

## Plataformas de aprendizagem

### Thinkific

#### Fatos

- Para um produto com preço gratuito, o aluno pode se inscrever e acessar pela
  landing page.
- Um aluno já autenticado é levado diretamente ao produto; um visitante é
  levado a criar uma conta antes de se inscrever.
- O botão padrão é dinâmico: pode mostrar inscrição, retomada ou abertura,
  conforme o estado do produto e do aluno.
- Um produto gratuito pode ter duração de matrícula; a documentação também
  distingue produtos públicos, privados e ocultos.

Fonte oficial:

- [How do students enroll in my free product?](https://support.thinkific.com/hc/en-us/articles/360062349633-How-do-students-enroll-in-my-free-product)
- [How to Set Your Product to Free](https://support.thinkific.com/hc/en-us/articles/360038156174-How-to-Set-Your-Product-to-Free)
- [Private and Hidden Products](https://support.thinkific.com/hc/en-us/articles/360030738053-Private-and-Hidden-Products)

### Teachable

#### Fatos

- Teachable modela uma opção de preço `Free` em que estudantes se inscrevem
  sem custo.
- Publicação, visibilidade e abertura para novas inscrições são condições
  separadas; um produto publicado pode continuar fechado sem uma opção de
  preço ou quando a inscrição está encerrada.
- O produto pode ter duração limitada de acesso também para planos gratuitos.
  Depois do fim, a documentação descreve nova inscrição pelo plano quando ele
  ainda estiver disponível.
- Teachable também suporta múltiplos planos por produto, links diretos por
  plano e cupons de 100% para um produto pago.

Fontes oficiais:

- [Price your products](https://support.teachable.com/en/articles/15627279-price-your-products)
- [Publishing and product visibility](https://support.teachable.com/en/articles/11682484-publishing-and-product-visibility)
- [Product Access Duration](https://support.teachable.com/en/articles/11682480-product-access-duration)

### Moodle

#### Fatos

- O Moodle separa criação de conta por auto-registro de autoinscrição no
  Curso.
- A autoinscrição permite ao usuário escolher a própria entrada, opcionalmente
  com chave de inscrição.
- O administrador pode definir período e duração da inscrição; quando a
  duração está habilitada, ela começa no momento da autoinscrição.

Fonte oficial:

- [Self enrolment](https://docs.moodle.org/405/en/admin/setting/enrolsettingsself)

### Open edX

#### Fatos

- O Open edX exige que o aluno tenha uma conta registrada e ativada antes da
  autoinscrição; a autoinscrição depende do período de inscrição do Curso.
- Depois da inscrição, o Curso aparece no dashboard e o aluno pode iniciar o
  conteúdo quando a data de início tiver passado.
- A experiência pode oferecer opções de inscrição distintas, incluindo uma
  trilha de auditoria gratuita e uma trilha paga de certificado.
- O Open edX também documenta links de autoinscrição após autenticação, mas o
  material consultado trata isso como mecanismo próprio da plataforma, não
  como requisito para o Hub.

Fontes oficiais:

- [Enrollment Requirements](https://docs.openedx.org/en/latest/educators/references/student_management/enrollment_requirements.html)
- [Enrolling in a Course](https://docs.openedx.org/en/latest/learners/OpenSFD_enrolling.html)
- [Advanced Third Party Authentication: Auto-enrollment](https://docs.openedx.org/en/latest/site_ops/install_configure_run_guide/configuration/tpa/tpa_advanced_features.html)

### Kajabi

#### Fatos

- Kajabi usa o conceito de `Offer` para conceder acesso gratuito a produtos,
  como lead magnet, preview ou acesso adicional.
- A concessão de uma Offer pode ser manual ou automatizada e bypassa a etapa de
  pagamento.
- O modelo de Offer permite que uma mesma unidade educacional seja incluída em
  diferentes ofertas, com a regra comercial separada do produto.

Fonte oficial:

- [Grant an Offer](https://help.kajabi.com/articles/sales/offers/how-to-grant-an-offer)

### Inferências para o Hub

- O padrão comum relevante é: conta/identidade, Curso publicável e aberto,
  ação explícita de inscrição, matrícula/acesso e duração opcional. Isso
  confirma a direção do relatório de preservar o ledger de concessões e a
  projeção de matrícula, em vez de fabricar um Pedido de R$ 0.
- O fluxo visitante → cadastro/login → retorno ao Curso é compatível com
  Thinkific, Moodle e Open edX. A inscrição automática durante o cadastro é
  uma otimização de UX, não uma obrigação do modelo; mantê-la fora da primeira
  versão reduz estado pendente e superfície de segurança.
- A existência de Offers, múltiplos planos e cupons em plataformas comerciais
  não justifica criar `course_offers` agora. Essa abstração só passa a ser
  necessária se o Hub precisar de múltiplos preços, campanhas, cupons, trilhas
  ou produtos diferentes apontando para o mesmo Curso.
- Duração limitada é compatível com a proposta do Hub de reutilizar
  `access_duration_months`, mas a regra de reentrada depois da expiração é uma
  decisão local ainda não documentada. O plano deve escolher explicitamente
  entre reativar a concessão gratuita existente ou criar uma nova unidade de
  histórico, sem inferir a política apenas do comportamento de terceiros.

## Conclusão comparativa

O relatório está arquiteturalmente correto ao separar:

`Curso gratuito → autoinscrição local → Concessão → Matrícula → acesso`

e manter:

`Curso pago → Pedido → Asaas → webhook → Concessão → Matrícula`

As correções principais são:

1. tratar a rejeição de valor zero pelo Asaas como limitação não completamente
   documentada nas fontes oficiais consultadas, não como fato universal;
2. separar a disponibilidade do link gratuito da disponibilidade do Checkout
   pago, porque `PAYMENTS_CHECKOUT_MODE` e o piso Asaas são gates financeiros;
3. documentar no plano a política de retorno seguro após autenticação e a regra
   de reentrada após expiração;
4. usar as referências externas como confirmação de padrões, não como autoridade
   para alterar os contratos canônicos do Hub.

## Sinais de fóruns e debates comunitários

Esta seção não é autoridade técnica nem substitui documentação oficial. Foi
consultada somente para identificar problemas recorrentes de experiência e
modelagem relatados por outros desenvolvedores.

- A pergunta [Check for conflicts / student cannot Enroll twice in same
  course](https://stackoverflow.com/questions/59283441/check-for-conflicts-student-cannot-enroll-twice-in-same-course)
  mostra o problema recorrente de impedir duas inscrições para a mesma Conta e
  Curso. As respostas são antigas e inconsistentes, portanto não servem como
  especificação; o único sinal útil é que a unicidade deve ser uma garantia do
  banco, não apenas um `SELECT` anterior ao `INSERT`.
- A discussão [Moodle: open course with a
  link](https://stackoverflow.com/questions/57955212/moodle-open-course-with-a-link)
  descreve a expectativa de login seguido de autoinscrição quando um link de
  Curso é compartilhado. É um caso de uma versão antiga do Moodle e não prova
  como o Hub deve funcionar, mas reforça que retornar ao Curso antes do clique
  final é uma UX compreensível.
- Discussões da comunidade Moodle sobre [self-enrolment após login e
  reentrada](https://www.reddit.com/r/moodle/comments/1ni7mdu/customize_course_enrollment_email/)
  também apontam notificações e reentrada como preocupações posteriores. A
  fonte é anedótica e não altera o escopo; não foi usada para decidir e-mail,
  duração ou revogação no Hub.

Nenhum sinal comunitário foi forte o bastante para justificar `course_offers`,
cupons, inscrição automática no cadastro, notificações ou um segundo agregado.
