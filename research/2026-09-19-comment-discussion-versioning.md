---
title: "Identidade e versionamento das discussões de Aulas"
date: 2026-09-19
status: research
scope: "Investigação de domínio e pesquisa externa; nenhum código da aplicação foi alterado."
---

# Identidade e versionamento das discussões de Aulas

## Resumo executivo

**Recomendação:** comentários não devem depender da publicação física do Curso.
Devem pertencer à identidade curricular estável da Aula dentro do Curso: `Curso +
curriculum_key`. A publicação deve continuar registrando o contexto histórico da
Aula que recebeu cada comentário, mas não deve definir a identidade da discussão.

Isso significa:

- uma nova publicação que mantém a mesma Aula curricular continua mostrando a
  mesma discussão;
- comentários não são copiados quando uma publicação é criada;
- uma mudança pedagógica grande cria uma nova identidade curricular e, portanto,
  uma nova discussão;
- remover uma Aula da publicação vigente não apaga a discussão histórica;
- a moderação pode ocultar/restaurar comentários sem apagar a thread;
- a interface atual do Aluno deve exibir a discussão da identidade curricular
  vigente, enquanto a interface administrativa precisa conseguir abrir também o
  histórico.

O schema atual ainda guarda `lesson_comments.lesson_id`, e `lesson_id` pertence a
uma publicação física. Isso não invalida a decisão de domínio já registrada no
ADR-0014, porque o serviço atual resolve comentários por `course_id +
curriculum_key` entre publicações `published` e `retired`. Porém, o FK físico deixa
uma dependência estrutural da publicação que pode voltar a causar bugs, como o
carregamento de respostas administrativas em `draft` e links para Aulas históricas.

## Escopo e distinção de termos

### Fato do projeto

No Hub existem três conceitos diferentes:

1. **Publicação:** revisão física de Módulos e Aulas, com estado `draft`,
   `published` ou `retired`.
2. **Identidade curricular:** a Aula pedagógica que permanece reconhecível entre
   publicações por `curriculum_key`.
3. **Discussão:** uma thread com comentários raiz e respostas, moderável e
   navegável a partir da Aula.

O erro conceitual seria tratar o ID físico de `lessons` como se fosse a identidade
pedagógica da Aula. São IDs diferentes por publicação; `curriculum_key` é o elo
estável.

### Recomendação

Usar o termo **discussão da Aula** para o agregado estável e **instância da Aula**
para a linha física em uma publicação. Um comentário pode ter um contexto
histórico (`lesson_id` da instância que existia quando foi escrito), mas sua
thread pertence ao agregado `Curso + curriculum_key`.

Essa distinção evita que “versão”, “publicação” e “Aula” sejam usados como
sinônimos na UI, no schema e nas consultas.

## Estado atual do Hub

### Fatos observados no código e na documentação

- `CoursePublication` materializa novas linhas físicas de Módulo e Aula.
- Matrícula concede acesso ao Curso, não a uma publicação individual.
- A publicação `published` é o currículo vivo; publicações anteriores ficam
  `retired` para preservar histórico.
- `lessons.curriculum_key` permanece quando a Aula é clonada para uma nova
  publicação; uma mudança grande cria outra identidade.
- O ADR-0014 já define: “Discussão acompanha Curso + `curriculum_key`”, não é
  copiada e não recebe indicação de versão na experiência do Aluno.
- `lesson_comments` hoje possui `lesson_id`, `parent_id`, corpo, status de
  moderação e timestamps, mas não possui `course_id`, `curriculum_key` ou uma
  tabela explícita de discussão.
- A leitura de comentários já faz a ponte lógica: encontra a instância da Aula,
  obtém Curso e `curriculum_key`, e busca comentários em instâncias `published`
  ou `retired` com a mesma identidade curricular.

### Diagnóstico

A regra lógica está mais correta que a forma física de persistência. O sistema
quer uma discussão estável, mas a tabela de comentários ainda aponta diretamente
para uma instância versionada.

Essa assimetria explica dois riscos:

- consultas que filtram somente `published`/`retired` podem excluir respostas
  criadas na Aula de `draft`, apesar de a thread ser a mesma;
- uma Aula histórica removida do currículo vivo pode continuar tendo comentários,
  mas não há uma entidade explícita que preserve a discussão sem depender da
  linha física.

O deep link pode resolver o ID histórico para o ID correspondente no `draft`, mas
isso é uma solução de navegação. Não substitui uma decisão de persistência de
domínio.

## Pesquisa em produtos e plataformas

As fontes abaixo são documentação oficial ou schema/código de primeira parte.
Elas não provam que existe uma única solução universal; mostram como produtos
reais separam o contexto da conversa do conteúdo e como tratam cópia, histórico e
moderação.

### Moodle

#### Fatos

O [Forum activity do Moodle](https://docs.moodle.org/500/en/Forum_module) trata
o fórum como uma atividade do Curso em que alunos e professores publicam
comentários em uma thread. O objeto operacional é o fórum/atividade, que contém
discussões e posts; respostas e permissões de professores são parte da mesma
conversa.

A documentação oficial de [permalinks de posts](https://docs.moodle.org/36/en/Using_Forum)
mostra que um post individual possui um destino estável dentro da discussão. A
documentação também descreve rastreamento de posts lidos/não lidos e moderação no
nível da atividade.

O relatório oficial de [atividade em fóruns](https://docs.moodle.org/400/en/ad_hoc_contributed_reports)
faz a relação `forum -> discussion -> post -> course`; o post não é modelado como
uma revisão do conteúdo da Aula. A documentação de [backup e restore](https://docs.moodle.org/500/en/Backup_and_restore_FAQ)
trata posts, tentativas e uploads como dados de participação que precisam ser
associados aos usuários corretos durante a restauração.

#### Interpretação

Moodle favorece uma discussão pertencente a uma atividade contextual do Curso,
não a cada edição do texto pedagógico. Quando uma atividade é realmente
substituída ou restaurada como outra atividade, não há motivo para presumir que a
conversa deva migrar automaticamente; o vínculo é com a atividade que os
participantes enxergaram.

Isso sustenta um modelo híbrido no Hub: continuidade quando a identidade
curricular é preservada; separação quando o autor cria uma nova identidade.

### Canvas

#### Fatos

A [API oficial de Discussion Topics do Canvas](https://canvas.instructure.com/doc/api/all_resources.html)
expõe discussões pelo caminho `courses/:course_id/discussion_topics/:topic_id`.
Entradas de primeiro nível e respostas são subrecursos do mesmo tópico, com
paginação, atualização e exclusão. A API documenta tipos de discussão como
`threaded`, `not_threaded` e `side_comment`.

A [API de Content Migrations](https://canvas.instructure.com/doc/api/content_migrations.html)
separa a cópia do conteúdo (`discussion_topics`) da migração e fornece um
`asset_id_mapping` para IDs criados no Curso de destino. Isso indica que uma cópia
de conteúdo é uma operação explícita entre contextos, não uma consequência
automática de editar o tópico original.

#### Interpretação

Canvas trata a discussão como um agregado próprio do Curso, com entradas e
respostas dependentes do tópico. Uma nova materialização de conteúdo pode gerar
outro tópico por uma operação de cópia; a plataforma não usa “versão da Aula”
como chave implícita para juntar conversas.

Para o Hub, a lição é separar duas operações que hoje podem parecer iguais:

- **publicar uma nova revisão mantendo a Aula:** preservar a discussão;
- **duplicar/criar uma nova identidade pedagógica:** iniciar outra discussão.

### Open edX

#### Fatos

O [guia oficial de Course Reruns](https://docs.openedx.org/en/latest/educators/references/course_development/course_reruns.html)
é a evidência mais direta sobre versionamento e discussões. Ao criar uma nova
oferta do Curso, a plataforma duplica estrutura e conteúdo, mas declara
explicitamente que **discussion posts, responses, comments e outros dados não são
duplicados**. A nova oferta é independente da original.

Na documentação de [criação de discussões específicas de conteúdo](https://docs.openedx.org/en/open-release-redwood.master/educators/migration_wip/17_manage_discussions/discussions.html),
uma discussão é associada a uma unidade. Quando a discussão é desativada:

- se já existem threads, o tópico vai para uma área arquivada;
- se não há threads, o tópico pode ser removido;
- ao habilitar novamente, um tópico arquivado e suas threads podem ser restaurados.

A [API oficial de discussões](https://docs.openedx.org/projects/edx-platform/en/latest/references/lms_apis.html)
usa `course_id`, `thread_id` e `comment`/`response` como contextos diferentes.
Os eventos oficiais distinguem thread criada, response criada e comment criado;
ver [Student Events](https://docs.openedx.org/en/release-teak/developers/references/internal_data_formats/tracking_logs/student_event_types.html).

#### Interpretação

Open edX faz uma distinção importante para este caso:

- entre **ofertas/execuções independentes**, as discussões não atravessam a
  fronteira;
- dentro da mesma oferta e unidade, desabilitar e reabilitar pode preservar a
  thread por arquivamento.

Isso não contradiz o modelo estável do Hub. No Hub, publicações são revisões
internas do mesmo Curso e chegam às mesmas Matrículas; não são novas ofertas
independentes. Portanto, a discussão deve atravessar publicações enquanto a
identidade curricular continuar a mesma. Se o produto futuramente criar um novo
Curso ou uma nova identidade curricular, a discussão deve ser separada, como no
rerun do Open edX.

### GitHub Discussions

#### Fatos

A [referência oficial GraphQL de Discussions](https://docs.github.com/en/graphql/reference/discussions)
modela `Discussion` como um objeto pertencente a um `Repository`. A discussão
possui comentários, resposta aceita, fechamento e bloqueio. Cada
`DiscussionComment` pode ter `replyTo`, respostas, edição, exclusão e estado
minimizado.

A documentação de [moderação de comentários](https://docs.github.com/en/communities/moderating-comments-and-conversations/managing-disruptive-comments)
explica que conteúdo pode ser ocultado/minimizado por motivos como off-topic,
outdated, resolved, duplicate ou spam, e restaurado sem destruir a conversa. A
remoção gera um evento de timeline visível conforme as regras de acesso.

#### Interpretação

GitHub não prende uma Discussion a uma branch ou commit para preservar a
continuidade da conversa sobre o repositório. A discussão é um agregado estável;
o estado do conteúdo técnico evolui ao redor dela. Ao mesmo tempo, a plataforma
mantém ações de fechamento, resposta, moderação e histórico editável como parte
do agregado.

Para o Hub, o equivalente é: a thread deve manter seu ID próprio e sua história,
enquanto a Aula física e a publicação servem como contexto de navegação e
auditoria.

### Discourse

#### Fatos

O código oficial do [modelo `Topic` do Discourse](https://github.com/discourse/discourse/blob/main/app/models/topic.rb)
define o tópico como agregado que possui muitos posts. O [modelo `Post`](https://github.com/discourse/discourse/blob/main/app/models/post.rb)
mantém `topic_id`, número do post, edição, flags e estados de moderação.

As APIs oficiais do projeto também listam tópicos por recência/atividade e
permitem recuperar posts de um tópico específico; o schema de resposta conserva
ID, número, autor, corpo, data e estado de exclusão.

#### Interpretação

Discourse reforça a mesma separação: o tópico é a identidade da conversa; posts
e respostas são eventos dentro dele. Categoria, tags e contexto podem mudar sem
transformar cada mudança em uma nova conversa.

## Comparação por preocupação de domínio

### Threads e respostas

**Fato comparativo:** Moodle, Canvas, Open edX, GitHub e Discourse tratam a
conversa como um agregado com identidade própria. O primeiro comentário cria ou
representa a thread; respostas apontam para a thread ou para um comentário pai.

**Recomendação para o Hub:** manter `parent_id` para respostas, mas fazer a
subárvore pertencer a uma discussão estável. O comentário não deve determinar sua
identidade apenas pela Aula física em que foi inserido.

### Moderação

**Fato comparativo:** os produtos mantêm o registro e aplicam estado de
visibilidade, fechamento, lock, minimização ou exclusão lógica. A moderação não é
tratada como publicação de conteúdo pedagógico.

**Recomendação para o Hub:** `hidden` deve continuar sendo estado do comentário e
deve ser auditado com ator/data/transição. Ocultar uma Aula ou aposentar uma
publicação não deve apagar a thread; são decisões diferentes.

### Histórico

**Fato comparativo:** Open edX arquiva tópicos com participação quando a unidade
deixa de oferecer discussão; GitHub mantém histórico de edição/moderação; Moodle
preserva dados em backup/restore; Canvas expõe operações de cópia e exclusão
separadas.

**Recomendação para o Hub:** preservar a discussão e o comentário mesmo que a
Aula deixe de estar na publicação vigente. A UI de Aluno pode deixar de oferecer o
acesso quando a Aula foi removida do currículo vivo; a UI administrativa deve
continuar encontrando o histórico por Curso + `curriculum_key` ou, se a identidade
foi encerrada, por uma entidade de discussão arquivada.

### Edição do conteúdo

**Fato comparativo:** as plataformas distinguem copiar/duplicar conteúdo de
continuar uma discussão existente. Open edX deixa claro que um novo rerun é
independente e não leva posts; Canvas realiza cópias por migração; Moodle liga
posts à atividade; GitHub liga discussão ao repositório, não ao snapshot de um
arquivo.

**Recomendação para o Hub:** editar título, descrição, mídia ou texto da mesma
Aula preserva a discussão. O produto deve aceitar que uma pergunta antiga pode
ficar contextualizada por conteúdo novo; a resposta é mostrar o histórico e a
data, não apagar a conversa silenciosamente.

### Remoção da Aula

**Fato comparativo:** remover ou desabilitar conteúdo não significa sempre apagar
dados sociais. Open edX arquiva tópicos que contêm threads e restaura-os ao
reativar a discussão; GitHub minimiza ou fecha conversas sem destruir todo o
histórico.

**Recomendação para o Hub:** remoção da Aula da publicação deve ser um estado de
disponibilidade curricular, não um cascade destrutivo sobre comentários. Se a Aula
for substituída por outra identidade curricular, não migrar automaticamente a
thread; oferecer ao Admin um vínculo explícito apenas se houver uma necessidade
de produto comprovada.

## Alternativas arquiteturais

### Alternativa A — manter somente `lesson_id` físico

**Vantagens:** nenhuma migração; consultas simples quando a Aula não muda.

**Problemas:** a discussão fica acidentalmente versionada; apagar a última
instância física pode apagar comentários; cada leitura precisa procurar todas as
publicações; respostas criadas em `draft` podem desaparecer de consultas que só
consideram publicações entregáveis; a FK não expressa a regra de domínio.

**Decisão:** não recomendada como modelo final. Pode continuar temporariamente
como compatibilidade de armazenamento, desde que o serviço trate `lesson_id` como
contexto histórico e não como identidade da discussão.

### Alternativa B — `course_id + curriculum_key` diretamente em cada comentário

**Vantagens:** expressa a regra; permite uma leitura global estável; evita depender
de uma publicação para localizar a thread.

**Problemas:** repete a chave em todos os comentários; exige constraints para
garantir consistência; respostas precisam herdar a mesma discussão; uma mudança
de identidade exige uma decisão explícita.

**Decisão:** boa transição, especialmente para o volume atual, desde que o
schema mantenha também `lesson_id` histórico opcional para auditoria e navegação.

### Alternativa C — tabela `lesson_discussions` estável

Modelo sugerido:

```text
lesson_discussions
- id
- course_id
- curriculum_key
- status: active | archived
- created_at
- archived_at

lesson_comments
- id
- discussion_id
- parent_id
- author_user_id
- body
- status: visible | hidden
- created_at
- updated_at
- lesson_id opcional como contexto histórico
```

**Vantagens:** uma identidade própria para a thread; replies não precisam saber
qual publicação estava ativa; arquivamento e remoção deixam de depender de
cascade; permite no futuro mover a UI sem reescrever comentários; facilita
auditoria e deep links.

**Problemas:** migration e backfill; precisa decidir unicidade de
`(course_id, curriculum_key)`; comentários órfãos ou identidades removidas
precisam de política; aumenta o número de joins.

**Decisão:** melhor modelo de longo prazo. Não é necessário implementá-lo nesta
investigação; deve ser tratado como uma mudança de domínio/schema separada, com
backfill e testes de publicação.

### Alternativa D — copiar comentários para cada publicação

**Vantagens:** leitura local simples; cada publicação parece autônoma.

**Problemas:** duplica respostas e estados de moderação; cria duas verdades para
o mesmo comentário; exige sincronização quando Admin oculta/restaura; quebra
permalinks e histórico; contraria explicitamente o ADR-0014.

**Decisão:** rejeitada.

## Cenários de decisão

| Cenário | Identidade curricular | Discussão recomendada | Motivo |
| --- | --- | --- | --- |
| Novo rascunho clonado sem mudança semântica | igual | mesma discussão | é a mesma Aula pedagógica |
| Correção de texto, vídeo ou material | igual | mesma discussão | conteúdo evoluiu, identidade não |
| Título da Aula alterado | igual | mesma discussão | o título é atributo, não identidade |
| Aula movida de Módulo | igual | mesma discussão | posição não define a Aula |
| Aula removida da publicação vigente | encerrada/ausente | preservar e arquivar discussão | histórico e auditoria não somem |
| Aula substituída por refilmagem ou objetivo diferente | nova | nova discussão | perguntas antigas podem não se aplicar |
| Curso novo criado como produto independente | novo Curso | nova discussão | não é a mesma comunidade/contexto |
| Publicação antiga aposentada | igual | mesma discussão, com contexto histórico | `retired` é histórico, não novo produto |
| Comentário ocultado por moderação | igual | mesma discussão, comentário oculto | moderação não é versionamento |
| Resposta de Admin/Suporte | igual | mesma discussão | papel do autor não muda a identidade |

## Recomendação para o Hub

### Regra de domínio

Adotar e tornar explícita a seguinte regra:

> Uma discussão pertence a um Curso e a uma identidade curricular estável. A
> publicação fornece a instância de conteúdo e o contexto histórico do comentário,
> mas não cria uma nova discussão por si só.

### Persistência

Para o curto prazo, manter a compatibilidade com `lesson_id`, mas tratar a chave
lógica como `course_id + curriculum_key` em toda leitura, criação, resposta e
moderação. Não usar `course_publication_id` como parte da identidade da thread.

Para o médio prazo, migrar para `lesson_discussions` e fazer `lesson_comments`
referenciar `discussion_id`. Preservar `lesson_id` histórico opcional, ou um
snapshot mínimo de contexto, para explicar onde o comentário foi criado sem fazer
dele a chave da conversa.

### Leitura e navegação

- Aluno lê a discussão da Aula vigente pela identidade curricular.
- Admin/Suporte podem ler a mesma discussão ao abrir qualquer instância
  `published`, `retired` ou `draft`, respeitando sua autorização administrativa.
- Links devem carregar o ID físico disponível para a rota e resolver a discussão
  pela identidade estável; não assumir que o comentário pertence exclusivamente
  à instância exibida.
- Se a identidade não existir mais no currículo vivo, a interface administrativa
  deve oferecer contexto histórico e estado arquivado, não `notFound` genérico.
- O hash do comentário deve continuar apontando para o comentário, não para a
  publicação.

### Moderação e auditoria

- Ocultar/restaurar muda o estado do comentário, não a identidade da discussão.
- Criar respostas de Admin/Suporte continua sendo uma ação auditável.
- A auditoria deve registrar `discussion_id` quando ele existir, além do
  `lesson_id` histórico e da transição de estado quando aplicável.
- O corpo do comentário não deve ser duplicado na auditoria.

### Performance e consistência

- Não adicionar índice ou migration somente por esta análise.
- Antes de migrar, medir as consultas por `(course_id, curriculum_key)` e por
  `discussion_id` com `EXPLAIN (ANALYZE, BUFFERS)` em dados representativos.
- Garantir uma única discussão ativa por `(course_id, curriculum_key)`.
- Respostas devem validar que o comentário pai pertence à mesma discussão.
- Publicar, aposentar, remover e clonar uma Aula não devem copiar ou apagar
  comentários automaticamente.

## Decisão final

O projeto **não deve ligar semanticamente comentários à versão/publicação**. A
decisão correta é ligá-los à identidade curricular estável, com a publicação
preservada apenas como contexto histórico e de navegação.

O comportamento atual já aponta nessa direção por meio de `curriculum_key`, mas a
persistência em `lesson_comments.lesson_id` ainda deixa uma dependência física
mais forte do que o domínio pretende. A próxima alteração estrutural, caso seja
priorizada, deve introduzir uma entidade de discussão estável ou materializar
explicitamente `course_id + curriculum_key` nos comentários. Não se deve copiar
threads para cada publicação.

Esta nota não altera código, schema, migrations, ADRs ou o glossário canônico.
Ela registra a recomendação para uma futura decisão de domínio e implementação.

## Fontes primárias consultadas

- [Moodle — Forum activity](https://docs.moodle.org/500/en/Forum_module)
- [Moodle — Using Forum e permalinks](https://docs.moodle.org/36/en/Using_Forum)
- [Moodle — relatórios oficiais de posts e discussões](https://docs.moodle.org/400/en/ad_hoc_contributed_reports)
- [Moodle — backup e restore FAQ](https://docs.moodle.org/500/en/Backup_and_restore_FAQ)
- [Canvas — REST API de Discussion Topics, entries e replies](https://canvas.instructure.com/doc/api/all_resources.html)
- [Canvas — Content Migrations API](https://canvas.instructure.com/doc/api/content_migrations.html)
- [Open edX — Guide to Course Reruns](https://docs.openedx.org/en/latest/educators/references/course_development/course_reruns.html)
- [Open edX — discussões específicas de conteúdo](https://docs.openedx.org/en/open-release-redwood.master/educators/migration_wip/17_manage_discussions/discussions.html)
- [Open edX — LMS discussion APIs](https://docs.openedx.org/projects/edx-platform/en/latest/references/lms_apis.html)
- [Open edX — Student Events de threads, responses e comments](https://docs.openedx.org/en/release-teak/developers/references/internal_data_formats/tracking_logs/student_event_types.html)
- [GitHub — GraphQL Discussions schema](https://docs.github.com/en/graphql/reference/discussions)
- [GitHub — moderação de comentários](https://docs.github.com/en/communities/moderating-comments-and-conversations/managing-disruptive-comments)
- [Discourse — modelo Topic](https://github.com/discourse/discourse/blob/main/app/models/topic.rb)
- [Discourse — modelo Post](https://github.com/discourse/discourse/blob/main/app/models/post.rb)
