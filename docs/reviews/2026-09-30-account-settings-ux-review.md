---
status: accepted
owner: design-and-engineering
last_verified_commit: abb3b3ecae681dd5eea4da839ace41e2b926431c
---

# Revisão do perfil, métodos de login e ambiente de teste

## Decisões posteriores de composição

O usuário decidiu remover das Configurações tanto a criação quanto a alteração
de senha. O fluxo padrão de recuperação por e-mail permanece em
`/recuperar-senha` e `/redefinir-senha`; não há botão, card, formulário ou
accordion de senha na Conta. O token de recuperação define a primeira senha de
uma Conta Google-only ou atualiza a credencial existente, pela API Better Auth
já configurada.

Student não usa Tabs nem Scrollspy nas Configurações: as seções aparecem em uma
coluna centralizada de largura limitada. Admin/Support com `viewSettings` usa
três Tabs amplas (`Perfil`, `Certificados` e `Plataforma`); métodos de entrada
ficam dentro de Perfil, e Tela de acesso, Banners e FAQ ficam empilhados em
`Plataforma`. Support sem `viewSettings` vê a seção pessoal sem Tabs. Dados de
avatar, nome e e-mail ficam no mesmo Card; a conta Google permanece em um Card
de método de entrada dentro do grupo Perfil.

## Escopo e conclusão

Pesquisa e revisão de código em 2026-09-30, incluindo alterações locais ainda não commitadas da worktree `graphify-evaluation/hub`. O SHA acima identifica a base, não representa a implementação local inteira.

A apresentação anterior não deve permanecer. A recomendação aprovada organiza dados pessoais e Google em Perfil; Student mantém suas seções empilhadas e centralizadas, enquanto Admin/Support usa poucas Tabs globais. A alteração de e-mail continua sob demanda. A senha só é criada ou alterada pelo fluxo de recuperação por link de e-mail. Não é necessário substituir Better Auth, o crop ou o armazenamento.

Esta revisão não altera código, banco, credenciais nem o servidor. A inspeção foi baseada em fontes, implementação e referências existentes, sem abrir URLs locais, conforme a restrição do projeto. Não houve validação visual renderizada nem teste real de Google/e-mail nesta revisão. Não havia ferramenta de subagentes disponível; a pesquisa foi conduzida diretamente.

## Resultado da implementação

O usuário aprovou a direção e pediu a implementação cautelosa. A interface foi reestruturada em uma coluna; o avatar segue a interação recomendada (a própria foto abre o seletor, com botões `Enviar avatar` e `Remover` ao lado), mantendo o crop e a validação já existentes. A troca de e-mail fica sob demanda. O hook `use-file-upload` retornado pelo registry não foi mantido: além de ser genérico, falhou no typecheck estrito e apresentou dez achados do Ultracite; a seleção nativa acessível cobre o caso sem duplicar a pipeline de crop/upload do Hub. O botão Google continua visível quando o provedor não está configurado, mas fica desabilitado com aviso.

Na revisão via MCP, o exemplo [Input Group com ação](https://reui.io/preview/base/components/c-input-group-10?ref=mcp) usa a primitiva Input Group do shadcn; não é um componente próprio do ReUI. O padrão de botão no sufixo foi aproveitado, mas os arquivos locais de `Button`, `Input` e `Textarea` foram preservados. A composição nova adota os tokens e os controles customizados do Hub.

Verificação desta atualização: `bun run typecheck` passou; `bun x ultracite check` passou nos 8 arquivos TypeScript afetados; `bun run docs:check` validou 51 documentos; 50 testes em 13 arquivos relacionados a Configurações, Conta, sessão e ações passaram. O teste de interação confirma que admin seleciona Plataforma pelo `mousedown` primário e monta as três sessões agrupadas; Student não renderiza tabs. O primeiro teste diagnóstico enviava apenas `click`, mas a implementação Radix ativa a tab no `mousedown` primário; após simular a interação realista, o teste passou. A revisão CodeRabbit foi pulada após checar a CLI autenticada: a conta não tem seat. Não houve teste OAuth com Google real: o servidor E2E atual foi iniciado com as credenciais vazias e o callback `127.0.0.1:3100` não consta entre os callbacks autorizados previamente informados. Não houve homologação visual porque as instruções do projeto proíbem abrir URLs locais.

### Correção posterior — tabs, perfil e acesso por e-mail

Na revisão seguinte, o usuário relatou que parte das tabs Admin/Support ainda
parecia não trocar corretamente o conteúdo. A causa foi comprovada no código da
versão Radix instalada: `TabsContent` calcula `present` como
`forceMount || isSelected` e aplica `hidden={!present}`. Assim, os painéis com
`forceMount` permaneciam sempre presentes; o wrapper compartilhado não escondia
os estados inativos. O teste regressivo ficou vermelho antes da correção e
verifica a navegação por cada tab para Admin e Support, inclusive o ramo de
Support sem `viewSettings`.

A correção acrescenta ocultação de `data-state="inactive"` ao `TabsContent`
compartilhado, preservando painéis e rascunhos montados. A barra e os triggers de
Configurações passaram a usar a mesma composição responsiva da edição de Aula.
Na nova revisão, Admin/Support usa três Tabs; o provider Google fica dentro de
Perfil, e Support sem acesso global não vê uma tab isolada. A página inteira de
Configurações Admin/Support usa a mesma largura centralizada do Aluno. O perfil
usa a seção `Minha conta` com descrição, seguida por um Card `Informações
pessoais`; o separador entre nome e e-mail e a descrição de certificado foram
removidos. Os grupos da página e o conteúdo do Card usam gaps verticais maiores,
sem ampliar o espaço entre cada título e seu próprio conteúdo. Os campos mantêm
ícones dentro do InputGroup, mas `Salvar` e `Alterar` ficam ao lado; `Salvar` só
habilita quando o nome normalizado muda e volta a desabilitar após o sucesso.
E-mail confirmado usa o `IconCircleCheck` customizado dentro do sufixo do input,
com tooltip `Confirmado` acionado apenas pelo ícone; e-mail não confirmado
mantém o aviso textual. Os botões de avatar têm hierarquia distinta, com envio
primário e remoção destrutiva, separados visualmente. Ficam ao lado da imagem de
64px, mantendo o clique na própria imagem; a linha permanente sobre
formatos/tamanho foi removida. As ações customizadas de criar/alterar senha
foram removidas; recuperação por e-mail continua intacta.
Nesta correção passaram os testes dirigidos de perfil/configurações e fluxo de
recovery, typecheck, lint e documentação. CodeRabbit foi ignorado porque a
conta autenticada não tem seat. Não houve inspeção em navegador local.

Verificação do refinamento mais recente: 73 testes em 17 arquivos,
`bun run typecheck`, `bun run docs:check` (51 documentos), `git diff --check` e
Ultracite nos arquivos TypeScript desta alteração passaram. A checagem global do
Ultracite ainda aponta um único erro de formatação em `package.json`, fora desta
alteração; não foi aplicado autofix global para evitar reformatar mudanças
operacionais pendentes na worktree.

## Problemas comprovados

### 1. Google ausente no login: configuração do teste

`src/app/(auth)/entrar/page.tsx` conserva a integração: `googleLoginEnabled` depende de ambas as credenciais Google. O servidor E2E iniciado para o teste recebeu essas variáveis vazias, desabilitando o botão. Não houve remoção do componente.

Esse ambiente não representa o fluxo social completo. Corrigir o teste requer credenciais e endereço de callback compatíveis com o origin utilizado, mantendo o banco isolado. Não basta forçar a exibição do botão: isso produziria uma ação sem provider configurado. O Google exige correspondência da URI de redirecionamento com as URIs autorizadas. [Documentação Google](https://developers.google.com/identity/protocols/oauth2/web-server).

### 2. Grade incompatível com a tarefa

`account-settings-sections.tsx` aplica duas colunas em `xl`. `profile-panel.tsx` cria mais duas colunas em `md`. O resultado distribui foto, nome, e-mail e acesso entre hierarquias concorrentes. Não é um defeito de breakpoint apenas: a arquitetura visual deve mudar.

O `DESIGN.md` determina agrupamentos por tarefa, fundação visual existente, ritmo confortável e ausência de mosaicos genéricos. Na área administrativa já existe uma coluna de conteúdo ao lado do Scrollspy; não se justifica inserir outro painel lateral dentro dela.

### 3. Avatar expõe estados internos como opções

O perfil mostra badge de modo e botões para foto personalizada, Google e iniciais. Isso transfere ao usuário a responsabilidade de entender a origem da imagem. Iniciais devem ser fallback, não uma escolha adicional.

O exemplo [Avatar upload do ReUI](https://reui.io/preview/base/components/c-file-upload-2?ref=mcp), consultado pelo MCP e pelo registry `radix-luma`, usa o próprio avatar como área de seleção/arraste e uma remoção discreta. O [hook documentado](https://reui.io/docs/components/base/file-upload?ref=mcp) controla arquivos/previews/validação local, não realiza upload remoto, crop nem exclusão persistida.

O exemplo precisa ser adaptado para botão semântico, teclado, nome acessível e tokens do Hub. Seu `div` clicável não deve ser copiado literalmente. A remoção do arquivo selecionado no exemplo também não substitui uma ação de remoção no servidor.

### 4. E-mail: ações raras ocupam o estado inicial

O endereço atual é um parágrafo, enquanto o formulário de troca fica permanentemente aberto. Avisos explicam sessões, prova de posse, ordem de mensagens e fila de envio antes de o usuário iniciar uma tarefa. Pendências mostram datas extensas e exigem cancelamento manual para recomeçar após expirar.

A direção correta é manter o endereço atual em input somente leitura e oferecer `Alterar`. O modal concentra a edição e uma única explicação pertinente. Confirmação pendente deve apresentar somente o próximo passo real. Não esconder estado importante, mas não apresentar a máquina de estados inteira.

### 5. Métodos de login: mensagem e ação divergem

`account-security-panel.tsx` afirma que Google continua disponível em um estado no qual o controle de vínculo está desabilitado. Também não recebe a disponibilidade do provider, embora o login receba. Disponibilidade, vínculo existente e necessidade de confirmação são estados diferentes e precisam de tratamento coerente.

O vínculo usado é `linkSocial`; não é sincronização contínua. A documentação distingue vínculo de atualização de perfil, e o projeto mantém `updateUserInfoOnLink: false`. Recomenda-se `Conectar Google`, não `Sincronizar`. Uma conta conectada não deve receber um botão redundante que refaça o vínculo. [Better Auth: contas](https://better-auth.com/docs/concepts/users-accounts).

### 6. Senha: formulário e saída forçada aumentam atrito

O formulário de criação fica exposto e cria outra grade. Após dez minutos, a interface exige sair e entrar novamente. Esse prazo vem também de `requireRecentAccountSession`, regra própria do Hub; não se deve apresentá-lo como única exigência possível do Better Auth.

Na versão instalada, 1.6.25, `setPassword` é server-only e usa middleware de sessão sensível. O fluxo `resetPassword` consegue criar credencial ausente e atualizar uma existente mediante token. Isso permite oferecer recuperação por link quando a sessão não permite criação direta, sem obrigar logout prévio. Não remover proteção de sessão apenas para esconder o atrito.

## Referências e interpretação

- **Notion:** foto/inicial é acionável; senha é configurada mediante ação; mudanças de e-mail continuam exigindo confirmação. Seu produto atualmente admite aliases, complexidade desnecessária para o Hub. Aproveitar a interação, não copiar a arquitetura. [Configurações do Notion](https://www.notion.com/en-gb/help/account-settings).
- **Slack:** alteração de foto inclui ajuste do enquadramento. Sustenta preservar nosso crop, não introduzir upload sem enquadramento. [Foto de perfil no Slack](https://slack.com/intl/en-gb/help/articles/115005506003-Upload-a-profile-photo).
- **NN/G:** divulgação progressiva adia controles raros sem ocultar as ações principais. A aplicação ao Hub é uma inferência de design: edição de e-mail em dialog; a senha segue exclusivamente o fluxo de recuperação por e-mail, sem duplicação em Configurações. [Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/).
- **Better Auth:** métodos pertencem à mesma identidade; vínculo social e senha opcional são suportados. Manter APIs públicas e políticas aprovadas. Docs online já descrevem versão posterior à instalada; APIs relevantes foram conferidas no código local, sem recomendar atualização nesta tarefa.

## Composição aprovada após revisão

### Perfil

Uma seção, com título fora das superfícies, seguindo as configurações existentes. Dados pessoais e e-mail ficam no mesmo Card, sem colunas aninhadas.

1. Um Card `Informações pessoais` agrupa avatar, `Nome completo` e e-mail, sem Card aninhado. Avatar abre o crop ao clicar; os botões `Enviar avatar` e `Remover` ficam ao lado da imagem. Remover só aparece para uma imagem personalizada ativa. O nome e o e-mail usam InputGroups para manter labels, ícones, estado e ações alinhados. E-mail permanece readonly até a ação `Alterar`; conta não confirmada recebe `Confirmar e-mail` e uma frase curta.

Fallback da foto: personalizada existente; senão Google disponível; senão iniciais. Remover uma foto personalizada restaura automaticamente o fallback. Os modos persistidos legados não precisam de migration destrutiva para eliminar suas opções da interface; a transição de comportamento deve ser testada e documentada.

### Métodos de login

Uma seção abaixo do Perfil, na mesma coluna. Título curto, sem subtítulo técnico.

- Google: um card compacto na seção `Métodos de entrada`, dentro do mesmo grupo Perfil. Mostra a marca, o estado e `Conectar Google` quando ainda não vinculado. Vinculado: `Conectado`, sem ação falsa de sincronização. Não adicionar desconexão nesta tarefa nem permitir remover o único método de acesso.
- Senha: não renderizar controles de criação ou alteração em Configurações. A pessoa usa `Esqueci minha senha` no login e conclui a ação no link enviado por e-mail. Não duplicar esse fluxo na área autenticada.

Usar os tokens, raio, tipografia, alinhamentos e espaçamentos existentes. Não modificar tokens globais nem introduzir outro design system. Avatar pode manter foto e legenda lado a lado: isso não equivale a uma grade de duas colunas para campos independentes.

### Modal de e-mail

Título `Alterar e-mail`; campo `Novo e-mail`; ações `Cancelar` e `Continuar`. A explicação deve ser curta e verdadeira: a troca só termina após confirmar os endereços. O e-mail antigo permanece ativo enquanto a solicitação não for concluída.

Na página, mostrar somente a pendência atual com próxima ação. Para prazo expirado, oferecer `Tentar novamente`, sem exigir um cancelamento administrativo. Reenvio/cancelamento precisam respeitar geração, uso único e limites atuais do servidor, não apenas alterar a aparência.

## O que preservar

- Separação login/cadastro: login Google não cria Conta implicitamente.
- Política aprovada de prova local no primeiro vínculo, sem patches internos no Better Auth.
- Duas confirmações para troca de e-mail e ausência de reautenticação por idade nessa troca.
- Conta suspensa sem acesso às rotas internas, incluindo Configurações.
- Google principal, senha opcional; compra/convite/cadastro não passam a exigir senha.
- Crop, validação de conteúdo, limite de 5 MiB e processamento do avatar no servidor.
- Uma referência ativa de avatar, troca transacional, limpeza do anterior e recuperação de órfãos. Uma falha de exclusão pode deixar objeto temporário: não prometer inexistência imediata de órfãos.

## Sequência de implementação e critérios

1. Corrigir a representatividade do teste Google sem usar banco compartilhado nem alterar credenciais de Staging/Production. Conferir origin/callback antes de reiniciar.
2. Reorganizar somente os componentes compartilhados de conta, preservando as demais seções das configurações. Remover ambas as grades de campos e opções visuais de modo de avatar.
3. Reutilizar a composição de Avatar upload com controles acessíveis, crop, loading, cancelamento e remoção persistida. Não deixar o preview local parecer salvo antes da confirmação do servidor.
4. Implementar modal de e-mail e estados compactos; não enfraquecer a regra de confirmação.
5. Simplificar Google, tratar erros e retorno OAuth junto da seção, consultar uma única decisão de disponibilidade do provider para login e perfil. Senha permanece fora das Configurações e usa apenas a recuperação por e-mail.
6. Atualizar documentação de domínio e surface brief somente após implementar o comportamento; executar testes dirigidos, typecheck, checks de estilo e documentação.

Cobertura mínima: Aluno/Admin/Suporte; Google habilitado/desabilitado; vinculado/não vinculado; confirmação pendente; Google com e-mail diferente/cancelamento/erro; recuperação de senha por token válido/inválido/expirado; troca de e-mail concluída/expirada/cancelada; foto Google/personalizada/iniciais; cancelar crop; upload falho; substituição/remoção; conta suspensa; teclado/foco de dialogs; conteúdo longo e mobile sem overflow.

Homologação de Google e entrega de e-mail exige providers reais. O E2E com mocks cobre contratos locais, não comprova esses serviços externos.
