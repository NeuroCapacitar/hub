# Fonte de verdade para o nome da plataforma

**Data:** 2026-09-25

**Escopo:** decisão de produto/arquitetura; sem alterações no código
**Código de referência:** `bf74ec30` (`feature/small-changes`), por corresponder ao modelo de responsável por Curso descrito pelo produto. A árvore já continha alterações documentais não relacionadas, preservadas.
**Divergência entre checkouts:** `bea618fe` (`staging`) ainda mantém uma assinatura global como fallback; não corresponde ao comportamento aprovado no DEC-DISC-019. A análise abaixo usa a worktree de feature como estado funcional de referência. A divergência de `staging` não foi alterada.

## Conclusão

É tecnicamente viável guardar um nome de exibição da plataforma em Configurações e usá-lo em partes dinâmicas do produto. Mas **um único campo não consegue renomear, de forma completa e segura, todas as superfícies e dependências**. Parte da marca está em assets e texto legal; o corpo dos e-mails é publicado no Resend; o remetente depende de um endereço/domínio verificado; e a identidade do emissor de certificados é outro dado.

Para este Hub, recomendo **manter o nome de produto como identidade controlada pelo código e centralizada em `src/lib/brand.ts`**, em vez de adicionar agora uma configuração que sugira alcance global. O projeto tem uma única marca de plataforma, já usa constantes compartilhadas para os usos centrais, e o código inspecionado não demonstra uma necessidade operacional atual de trocar o nome sem release. Uma renomeação pontual ainda exige revisão coordenada de textos, templates e assets, independentemente de onde o valor principal esteja armazenado.

Se a necessidade concreta for permitir que uma pessoa administradora troque o nome sem deploy, isso também é uma opção válida — mas deve ser um campo separado, chamado **Nome da plataforma** ou **Marca da plataforma**, com escopo e limites explícitos. Não reutilizar `Marca exibida` do perfil emissor nem prometer que o campo atualize automaticamente “todas as dependências”.

## O que o projeto faz hoje

- `DESIGN.md` define `NeuroCapacitar` como marca e `NeuroCapacitar Hub` como nome da aplicação, estabelece `src/lib/brand.ts` como fonte e requer reutilização em metadata, shell, autenticação, certificados públicos e comunicações geradas pelo Hub. `src/lib/brand.ts` centraliza `PLATFORM_BRAND` e `PLATFORM_NAME`, além de referências estáticas a logo e imagem da tela de acesso. `src/app/layout.tsx` consome os nomes em metadata do site; `src/components/brand-logo.tsx` consome o nome e o asset do logo.
- O literal de marca não está repetido em muitos arquivos de interface. As referências textuais diretas remanescentes incluem a página pública de validação de Certificado, o fallback de título em `src/lib/panel-page-titles.ts` e a política de privacidade; verificações de ambiente/domínio são técnicas, não texto de marca. A busca não cobre texto rasterizado/vetorial, conteúdo remoto do Resend nem texto externo ao repositório.
- O Hub gera os assuntos de algumas mensagens com `PLATFORM_NAME` em `src/features/email/server.ts`. Entretanto, os corpos publicados são **Hosted Templates no Resend**: o contrato em `src/features/email/templates-contract.ts` não inclui hoje uma variável de marca; `docs/integrations/resend-templates.md` diz que o conteúdo visual fica no Resend e que mudanças visuais exigem editar, testar e publicar os templates lá.
- O remetente completo vem de `RESEND_FROM_EMAIL`; o `Reply-To` padrão e a caixa de suporte são configurações separadas (`SUPPORT_EMAIL`). Portanto, alterar as constantes não altera por si só o nome do remetente, o endereço de resposta ou a caixa de suporte.
- A tela de Configurações Globais tem o campo `Marca exibida`, mas ele pertence ao `certificate_issuer_profiles` e é passado à emissão de certificados. A ação salva perfil emissor, razão social e CNPJ e registra auditoria. **Não é a marca geral do Hub.** O nome do responsável pelo certificado ainda é outra configuração, conforme o modelo por curso já adotado.
- A permissão `manageCertificateIssuerProfile` é delegável ao Suporte. Reutilizá-la para mudar a marca global seria uma ampliação pouco óbvia; se a marca for configurável, a ação precisa de autorização explícita apropriada, em vez de ser acoplada à action do emissor.
- A metadata do Next é declarada estaticamente em `src/app/layout.tsx`. Fazê-la refletir um valor editável em banco exige introduzir leitura do valor em runtime e definir atualização/cache. A mudança não é somente trocar a origem de uma string.
- Logo, favicon, imagens da tela de acesso e o HTML dos templates são assets/conteúdo estáticos ou externos. Alterar o nome em banco não recria esses materiais. A política de privacidade também requer revisão editorial/legal, e não substituição automática de palavra.

## Distinções que não devem ser colapsadas

1. **Marca da plataforma:** nome usado no shell, metadata e comunicações institucionais, como “NeuroCapacitar”.
2. **Nome da aplicação:** atualmente “NeuroCapacitar Hub”. A relação entre os dois precisa ser definida se a marca mudar; não presumir que qualquer novo nome de marca deva gerar mecanicamente `<marca> Hub` em todos os contextos.
3. **Emissor legal/de certificado:** razão social, CNPJ e marca que aparece no certificado. Pode coincidir com a marca comercial, mas tem responsabilidade documental própria. Certificados já emitidos são snapshots e não devem mudar retroativamente.
4. **Identidade de envio de e-mail:** nome amigável do remetente, endereço `From`, domínio autenticado, `Reply-To` e caixa de suporte são campos diferentes. Uma mudança no nome comercial não autoriza trocar endereço/domínio nem reconfigurar DNS.
5. **Identidade visual e textos externos:** logo, favicon, imagens e Hosted Templates precisam de alterações e publicação próprias. Nomes de cursos, assinaturas por curso e identidade do provedor de checkout também não são a marca geral da plataforma.

## Pesquisa em produtos e documentação oficial

Os players consultados sustentam um padrão útil: **nome de site/escola editável, com identidade legal e e-mail configurados separadamente**. Isso é evidência de comportamento público documentado, não prova de como cada produto implementa seus bancos ou serviços internos.

- A [Shopify permite editar o nome da loja](https://help.shopify.com/en/manual/intro-to-shopify/initial-setup/setup-business-settings), que aparece nas páginas do site, mas documenta o nome legal da empresa como campo distinto e ressalta que mudar o nome da loja não muda o domínio `myshopify.com`. A [configuração de e-mail da Shopify](https://help.shopify.com/en/manual/intro-to-shopify/initial-setup/setup-your-email) separa o endereço de contato do endereço remetente usado nas notificações.
- A [Thinkific documenta o nome do site](https://support.thinkific.com/hc/en-us/articles/360030354734-Change-Your-Site-URL-and-Site-Name) como algo que aparece no cabeçalho e nas notificações padrão. Também distingue nome do site de URL; alterar a URL pode tornar a anterior inválida. Em [Site Settings](https://support.thinkific.com/hc/en-us/articles/360030719753-Site-Settings), e-mail de resposta e e-mail de suporte são configurações próprias. Seu [email de boas-vindas](https://support.thinkific.com/hc/en-us/articles/360038656974-Site-Welcome-Email) mostra o nome do site por variável e trata branding do conteúdo e domínio remetente como assuntos separados.
- A [Teachable separa](https://support.teachable.com/en/articles/11682438-general-settings) `School Name` (nome exibido no site), `Business Name` (se diferente, aparece nos recibos), `Reply To Email` e `Email sender name`. É o paralelo mais explícito para não confundir marca pública, empresa e identidade do e-mail.
- A API do [Resend aceita nome amigável junto do endereço `From`](https://resend.com/docs/api-reference/emails/send-email); a documentação também exige ao menos um [domínio verificado](https://resend.com/docs/dashboard/domains/introduction) para envio. Isso torna possível compor um nome de exibição variável mantendo endereço e domínio sob controle separado — não significa que editar uma marca altere DNS, autenticação ou conteúdo hospedado.
- O [Twelve-Factor App](https://12factor.net/config) trata como configuração os valores que variam entre deploys, citando hosts e recursos externos; também exclui configuração interna da aplicação dessa definição. Portanto, não é um argumento automático para guardar qualquer texto em variável de ambiente, nem para criar um campo editável no banco. A escolha entre constante e configuração de produto depende de quem deve poder alterar a identidade e com que frequência.

Esses exemplos vêm de plataformas de escola/loja configuráveis por seus clientes. São uma referência relevante para capacidades de administração, mas **não equivalem ao Hub**, que é uma plataforma única de marca própria, sem evidência de múltiplas organizações/tenants gerenciando suas próprias identidades.

## Trade-offs para o Hub

### Manter o nome no código

**Vantagens:** identidade aprovada junto com o release; consistência com logo e templates; sem leitura de banco em metadata/e-mails; menos risco de alterar acidentalmente o nome que alunos veem; renomeação global permanece revisável e testável. Como os textos internos principais já usam `brand.ts`, trocar a definição não exige localizar uma cópia em cada componente.

**Custos:** mesmo uma renomeação só textual exige deploy; é necessário manter uma lista de ocorrências fora do código. Isso é aceitável se mudanças forem raras e realizadas com apoio de desenvolvimento/design.

### Tornar o nome editável em Configurações

**Vantagens:** nome visível pode mudar sem deploy e a pessoa responsável consegue ajustar rapidamente um rebrand textual. Isso segue o precedente de plataformas de escola/loja que entregam identidade configurável a cada cliente.

**Custos e limites:** vira dado operacional mutável, exigindo autorização apropriada, validação, auditoria, cache/revalidação e comportamento de fallback. A configuração pode aparecer em Development, Staging e Production em momentos diferentes. Se metadata ou tarefas assíncronas mantiverem valores em cache/snapshot, a atualização pode não ser instantânea em todos os lugares. Mais importante, o campo não muda sozinho assets, corpo remoto de e-mail, documentos legais, domínio ou configuração do provedor. Uma configuração com a promessa de “renomear tudo” criaria falsa confiança e inconsistência visual.

## Recomendação aplicada ao caso

**Não reutilizar o nome da empresa/emissora em Configurações Globais como fonte da marca da plataforma e não adicionar agora um único campo genérico “nome da empresa”.** Para uma plataforma de marca própria e sem white-label, uma alteração da marca é rara e exige revisão de conteúdo, assets e comunicações; manter `PLATFORM_BRAND` e `PLATFORM_NAME` em `src/lib/brand.ts` como fonte controlada por release preserva o contrato atual de `DESIGN.md` e evita sugerir que um campo renomeia “todas as dependências”. O pequeno conjunto de referências textuais remanescentes pode ser alinhado à fonte existente sem trocar a fonte de verdade. Perfil emissor, signatário por Curso, remetente e caixas de e-mail continuam independentes.

Se surgir uma necessidade confirmada de alteração independente de release, criar um setting explícito **Nome público da plataforma**. O contrato deve limitar-se a superfícies textuais do Hub que realmente leem esse valor. O assunto e o corpo de cada template devem receber o valor por caminho suportado e testado; o `From` pode compor o nome amigável separadamente, mantendo endereço/domínio autenticados. A nova action não deve reutilizar a permissão delegável do perfil emissor. A interface deve explicar que o valor não troca logotipo, URL/domínio, nome legal do emissor, CNPJ, textos legais, assinatura por Curso ou branding configurado em serviços externos. Mudanças de logo e templates continuam exigindo seu fluxo editorial/de publicação. Como `PLATFORM_BRAND` e `PLATFORM_NAME` diferem, ratificar se o sufixo “Hub” permanece, sai ou vira parte do campo antes de migrar.

Para um rebrand real de NeuroCapacitar para Neuro, a opção mais segura hoje é uma mudança coordenada: revisar as constantes compartilhadas, assunto/corpo dos e-mails, nome amigável do remetente, logo/favicon/imagens, política de privacidade e marca do emissor de certificados quando aplicável; testar Development/Staging e preservar os snapshots já emitidos. Alterar o campo atual `Marca exibida` isoladamente seria incompleto e poderia trocar apenas o nome impresso nos novos certificados.

## Limites desta pesquisa

Os materiais oficiais descrevem opções e efeitos visíveis ao administrador/cliente; não permitem inferir a implementação interna desses produtos. Não foi inspecionado o conteúdo ativo no painel remoto do Resend nem a conta/checkout Asaas; logo, não se afirma qual identidade esses serviços atualmente mostram em cada notificação. A análise do código cobre as superfícies e arquivos citados, não todas as imagens/curvas vetoriais e estados armazenados fora do repositório.
