---
status: research
owner: product-and-engineering
research_date: 2026-09-24
repository_branch: feature/small-changes
repository_commit: 40e00626
---

# Pesquisa: escopo do signatário em certificados

## Conclusão

No Hub, a identidade da organização emissora deve continuar global; a pessoa
signatária (nome, cargo/função e imagem visual da assinatura) pertence ao
certificado do Curso. Um padrão global pode continuar existindo para Cursos que
realmente compartilham o mesmo signatário, mas seu uso deve ser explícito e
visível no editor — não inferido silenciosamente de campos vazios.

Isso não é uma regra universal do mercado nem uma conclusão jurídica. As fontes
mostram tanto certificados compartilháveis entre Cursos quanto assinaturas
configuradas no contexto do Curso. O modelo recomendado é uma decisão de produto
para o Hub, dado que seus Cursos podem ter responsáveis diferentes.

## Estado atual do Hub

- O guia canônico separa o perfil emissor global (razão social, marca e CNPJ)
  dos dados opcionais de responsável/assinatura por Curso. O schema confirma
  `certificate_issuer_profiles` como perfil global e `certificate_templates`
  ligado a `course_id`, com `signer_name`, `signer_role` e `signature_key`.
- A configuração global persiste nome e cargo padrão; a imagem da assinatura
  não tem configuração global. Na emissão, `COALESCE` usa o nome/cargo do
  template do Curso e recorre ao padrão global quando o valor do Curso é nulo.
  A imagem, por sua vez, vem do template do Curso. Os valores resolvidos são
  congelados no snapshot da emissão; certificados existentes não mudam.
- Há uma lacuna de transparência: o editor do Curso inicializa os campos a
  partir do template e seu preview substitui campos vazios por nomes de exemplo.
  O editor não recebe os valores globais efetivos, embora a emissão os use como
  fallback. Logo, o preview vazio não mostra necessariamente o signatário que
  será emitido.
- O fallback é aplicado campo a campo (`signer_name` e `signer_role` em
  `COALESCE` separados). Um Curso pode definir o nome e herdar o cargo global,
  combinando duas identidades sem controle explícito. A descrição da interface
  fala da assinatura padrão como unidade, sem deixar essa precedência parcial
  evidente.
- O diagnóstico de origem do editor chama signatário e imagem visual de
  assinatura de “Emissor”, embora a imagem só exista no template do Curso. A
  permissão global (`manageCertificateIssuerProfile`) também é distinta da
  permissão do template (`manageCourseCertificate`); mudar o ownership afeta
  quem pode editar esses dados conforme as concessões de Suporte atuais.

Evidência local: `docs/domain/certificates-and-data-rights.md` (incluindo
REG-DAT-003A), `docs/adr/0006-certificate-lifecycle.md`,
`src/db/schema.ts`, `src/app/(admin)/admin/configuracoes/certificate-settings-form.tsx`,
`src/app/(admin)/admin/cursos/[courseId]/certificate-template-form.tsx`,
`src/app/(admin)/admin/cursos/[courseId]/certificate-template-preview.tsx` e
`src/features/certificates/server.ts`.

## Fontes primárias consultadas

- [Teachable Help Center — Certificates of Completion](https://support.teachable.com/en/articles/11682466-certificates-of-completion), publicado em **20 fev. 2026**, consultado em **24 set. 2026**. A configuração é acessada dentro do Curso; o editor lista “Signature” entre os campos editáveis e permite um certificado ativo por Curso. É evidência direta de escopo de Curso para a assinatura visual, não prova que todo LMS deva seguir esse desenho.
- [MoodleDocs 5.2 — Add/edit certificate module](https://docs.moodle.org/502/en/Add/edit_certificate_module), consultado em **24 set. 2026**; o rodapé informa que a página foi editada pela última vez em **4 fev. 2021**. A documentação descreve a criação do módulo de certificado a partir de um Curso e oferece, nas opções desse certificado, nome(s) do professor do Curso e imagem de assinatura. É um exemplo de contexto de Curso; a própria página identifica o módulo como plugin, portanto não o trato como função nativa do núcleo Moodle.
- [MoodleDocs 5.2 — Custom certificate module](https://docs.moodle.org/502/en/Custom_certificate_module), consultado em **24 set. 2026**. O plugin permite templates compartilhados em nível de site que podem ser carregados e adaptados numa atividade de certificado dentro de um Curso. Isso demonstra reutilização de layout sem exigir que a identidade variável do signatário seja global.
- [Thinkific — Thinkific Certificates](https://support.thinkific.com/hc/en-us/articles/360040594393-Thinkific-Certificates) e [How to Assign a Certificate to a Course](https://support.thinkific.com/hc/en-us/articles/360042356493-How-to-Assign-a-Certificate-to-a-Course), consultados em **24 set. 2026**; as páginas não exibem uma data de publicação/atualização. Um certificado pode ser atribuído a um ou vários Cursos; a documentação também permite criar certificados distintos para designs ou textos específicos. É evidência de um objeto reutilizável com associação explícita a Cursos, mas não encontrei nessas páginas uma regra específica para signatário humano.
- [Open edX — Enabling Course Certificates](https://docs.openedx.org/en/latest/site_ops/install_configure_run_guide/configuration/enable_certificates.html), consultado em **24 set. 2026**. A documentação diz que equipes do Curso configuram certificados para aquele Curso, incluindo signatários, logo da organização e imagem de assinatura dos signatários. É uma separação especialmente próxima do caso do Hub: identidade de organização e pessoa signatária são elementos distintos, embora ambos possam participar da configuração do certificado.
- [1EdTech — Open Badges Implementation Guide, v3.0](https://standards.1edtech.org/open-badges/guides/standards/v3p0/impl), consultado em **24 set. 2026**; a especificação Open Badges 3.0 foi finalizada em 2024. O modelo distingue a organização/emissor, a conquista definida e a credencial individual do aluno; credenciais Open Badges são assinadas criptograficamente pelo emissor. Isso ajuda a separar “quem emite” de uma imagem manuscrita impressa, mas não especifica onde LMSs devem guardar um signatário visual nem substitui aconselhamento jurídico.

## Discussão de desenvolvedores (evidência anedótica)

- [GitHub issue #354 — Teacher name does not show, Moodle mod_customcert](https://github.com/mdjnelson/moodle-mod_customcert/issues/354). A discussão pergunta como exibir diferentes professores em cursos que compartilham um certificado; a resposta do mantenedor aponta que a lista de professores disponível é específica ao Curso. O exemplo reforça a necessidade prática de resolver a identidade no contexto certo, mas é uma discussão antiga de plugin e não prova consenso de mercado.

## Aplicação recomendada ao Hub

1. Manter razão social, marca e CNPJ no perfil emissor global.
2. Manter nome, cargo e imagem do signatário no template do Curso, preservando
   a possibilidade de não exibir assinatura humana quando o certificado não a
   exigir.
3. Não deixar campo vazio herdar silenciosamente. A escolha mais simples é
   remover o fallback global e manter os dados de signatário apenas no Curso.
   Se houver uso real para reutilizar uma pessoa em vários Cursos, conservar
   um padrão institucional como opção explícita e atômica (“usar padrão” ou
   “definir neste Curso”), nunca como fallback independente por campo.
4. Antes de retirar o fallback, inventariar templates publicados que hoje
   dependem dos valores globais. Planejar uma transição que preserve esses
   valores efetivos como dados do Curso e permita revisar casos com outra
   pessoa signatária. Não alterar snapshots de certificados já emitidos.
5. Não criar agora um cadastro global de pessoas/assinaturas: as fontes não
   demonstram que o Hub precise dessa camada. Se a repetição virar custo real,
   uma biblioteca reutilizável pode ser avaliada separadamente, mantendo a
   escolha e o snapshot associados ao Curso/versão do certificado.
