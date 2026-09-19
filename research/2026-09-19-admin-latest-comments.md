---
title: "Últimos comentários no dashboard administrativo"
date: 2026-09-19
status: research
scope: "Somente pesquisa e recomendação; nenhum código da aplicação foi alterado por esta investigação."
---

# Últimos comentários no dashboard administrativo

## Resumo executivo

É viável adicionar uma seção de comentários ao dashboard, mas a primeira versão deve ser um **feed de atividade recente**, não uma inbox de atendimento.

O projeto já tem:

- comentários persistidos em `lesson_comments`;
- vínculo seguro com Aula, Módulo, Curso e `curriculum_key`;
- estado `visible`/`hidden`;
- árvore de respostas;
- identificação do autor e do papel;
- rota administrativa de Aula que já contém a seção de comentários;
- permissão server-side para a superfície administrativa;
- índice suficiente para leitura por Aula.

O projeto ainda não tem:

- estado de leitura por Admin;
- atribuição a Admin/Suporte;
- estado de atendimento como pendente, respondido ou resolvido;
- rota global de comentários;
- permissão separada para leitura de comentários por Suporte;
- notificações ou assinaturas de discussão.

Portanto, o melhor encaixe agora é:

1. carregar no dashboard os últimos 5 comentários **visíveis** de alunos;
2. mostrar Curso, Aula, autor, data e um trecho curto do texto;
3. levar cada item diretamente para a Aula administrativa, com a aba Comentários aberta e o comentário focalizado;
4. não introduzir unread/read, badge global, atribuição ou promessa de “pendências” nesta etapa;
5. manter o recurso restrito a Admin até existir uma decisão explícita para leitura e resposta por Suporte.

Isso melhora a descoberta e reduz o caminho até a resposta sem criar uma fila operacional cujo ciclo de vida o domínio ainda não modela.

## Data e fontes consultadas

Consulta realizada em **19/09/2026**, no fuso `America/Sao_Paulo`.

Fontes primárias de produtos e design systems:

- [GitHub — managing notifications from the inbox](https://docs.github.com/en/subscriptions-and-notifications/how-tos/viewing-and-triaging-notifications/managing-notifications-from-your-inbox): filtros, separação entre lidas/não lidas, salvar, concluir e cancelar inscrição.
- [GitHub — REST API de notifications](https://docs.github.com/en/rest/activity/notifications): estado de leitura e atualização por ponto temporal.
- [GitHub Primer — View](https://primer.style/product/scenario-patterns/view/): combinar a superfície ao volume de conteúdo, usar divulgação progressiva e side sheet para detalhes substanciais.
- [GitHub Primer — TimelineItem](https://primer.style/product/getting-started/rails/components/timeline/): timeline com avatar, badge e corpo como composição de atividade.
- [GitHub Primer — notification messaging](https://www.primer.style/product/ui-patterns/notification-messaging/): proximidade da mensagem com a ação e uso proporcional de estados.
- [Linear — Inbox](https://linear.app/docs/inbox): inbox como centro de notificações acionáveis, com abrir o item, marcar lida/não lida, snooze, filtros e busca.
- [Slack — view all unread messages](https://slack.com/help/articles/226410907-View-all-your-unread-messages): triagem de não lidas, ações explícitas de marcar como lida/não lida e navegação para o contexto original.
- [Intercom — The Inbox explained](https://www.intercom.com/help/en/articles/6258745-the-inbox-explained): inbox como espaço de trabalho para conversas, contexto e ações sem abandonar a conversa.
- [Intercom — organize your Inbox with views and folders](https://www.intercom.com/help/en/articles/6588834-organize-your-inbox-with-custom-views-and-folders): distinção entre visão “All” e “Unassigned”, sem confundir filtro com atribuição.
- [Moodle — Forum activity](https://docs.moodle.org/500/en/Forum): discussões em threads, permalink, assinatura e ferramentas adicionais para professores.
- [Moodle — Forum FAQ](https://docs.moodle.org/30/en/Forum_FAQ): rastreamento de posts lidos/não lidos no dashboard e no fórum.
- [Open edX — best practices for moderating course discussions](https://docs.openedx.org/en/ulmo/educators/concepts/communication/best_practices_moderating_discussions.html): separar não lidas, não respondidas e sinalizadas; indicar visualmente novas respostas; orientar moderadores a consolidar perguntas repetidas.
- [PostgreSQL — multicolumn indexes](https://www.postgresql.org/docs/current/indexes-multicolumn.html): colunas à esquerda em índices B-tree e uso parcimonioso de índices compostos.
- [PostgreSQL — partial indexes](https://www.postgresql.org/docs/current/indexes-partial.html): quando índices parciais podem reduzir custo e por que exigem correspondência exata da predicação.
- [PostgreSQL — EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html): validar o plano e as estimativas com o formato real da consulta.

Discussões de desenvolvedores/comunidade usadas como sinal, não como autoridade de contrato:

- [GitHub Community Discussion #2844 — notifications for Discussions](https://github.com/orgs/community/discussions/2844): pedidos recorrentes para diferenciar atividade geral de notificações de comentários e respostas.
- [UX Stack Exchange — why leave read notifications in an inbox?](https://ux.stackexchange.com/questions/118890/why-leave-read-notifications-in-an-inbox): debate sobre histórico, relevância e descarte de notificações lidas.

## Leitura do código atual

### Dashboard Admin

`src/app/(admin)/admin/(dashboard)/page.tsx` compõe o dashboard com:

- `DashboardSummary`;
- `OperationsOverview`;
- `OperationalContext`;
- `RecentActivity`, atualmente para pedidos e certificados;
- solicitações de suporte quando existe alguma.

`RecentActivity` recebe dados de `getAdminDashboardProjection()` e renderiza somente quando há pedidos ou certificados. O padrão atual é uma projeção limitada a cinco registros por tipo, dentro de Cards e tabelas compactas. Esse padrão é compatível com adicionar uma terceira superfície compacta, mas o conteúdo de comentários é mais textual e não deve ser forçado em uma tabela larga.

`getAdminDashboardProjection()` em `src/features/admin/server.ts` exige `viewAdminPanel` antes de consultar as projeções. A função hoje retorna saúde de catálogo, operações, pedidos recentes e certificados recentes; comentários ainda não fazem parte dela.

### Modelo de comentários

`src/db/schema.ts` define `lesson_comments` com:

- `id` UUID;
- `lesson_id` obrigatório;
- `author_user_id` anulável, com `on delete set null`;
- `parent_id` para uma resposta, com cascade;
- `body`;
- `status` (`visible` ou `hidden`);
- `hidden_by_user_id` e `hidden_at`;
- `created_at` e `updated_at`.

Os índices atuais são:

- `(lesson_id, created_at)`;
- `(parent_id, created_at)`;
- `(author_user_id)`.

Eles atendem bem à leitura atual por Aula e árvore de respostas. Não há hoje um índice diretamente orientado a “últimos comentários visíveis globalmente”.

### Leitura atual e autorização

`getLessonComments()` em `src/features/comments/server.ts`:

- valida o acesso à Aula antes da leitura;
- para Admin, permite ler a Aula sem Matrícula;
- exige que a Aula esteja em publicação `published` ou `retired`;
- para Admin, inclui comentários ocultos, pois a moderação precisa vê-los;
- para demais leitores permitidos, retorna apenas comentários visíveis e respostas cujo pai também está visível;
- monta a árvore por `parent_id`.

O dashboard não deve reutilizar diretamente `getLessonComments()` para cada Aula. Isso criaria N+1 consultas, repetiria a autorização por Aula e traria uma árvore inteira quando a seção precisa somente de uma projeção curta. Deve existir uma leitura administrativa específica, com autorização no servidor e uma única consulta limitada.

### UI da Aula e destino do clique

`src/components/lesson-comments-section.tsx` exibe:

- nome do autor;
- selo de verificação para Admin/Suporte;
- data e hora;
- texto completo, salvo comentário oculto;
- respostas;
- ação de ocultar/desocultar quando `canModerate` é verdadeiro.

As páginas de Aula do Aluno e de edição administrativa usam o componente. A página administrativa é:

`/admin/cursos/[courseId]/aulas/[lessonId]`

Ela possui uma aba `comments`, mas atualmente usa `defaultValue="video"` e não lê `searchParams`. Portanto, um link para `?tab=comments` só funcionará de fato depois de a rota aceitar esse parâmetro. Também não existe ainda um `id` estável em cada comentário para um fragmento como `#comment-<id>`.

O destino recomendado exige duas pequenas capacidades de navegação na implementação futura:

- aceitar `?tab=comments` na página administrativa;
- colocar `id="comment-<id>"` no elemento raiz de cada thread.

O link completo poderia ser `/admin/cursos/{courseId}/aulas/{lessonId}?tab=comments#comment-{commentId}`. O usuário chega à superfície de moderação correta, vê a conversa no contexto curricular e não perde o foco em uma rota do Aluno.

### Regras de resposta e Suporte

`src/features/comments/actions.ts` exige `manageContent` para comentar no contexto Admin e para ocultar/restaurar comentários.

`src/lib/auth-policy.ts` não inclui `manageContent` nas permissões padrão ou delegáveis de Suporte. O ADR-0017 afirma explicitamente que `manageContent` continua Admin-only para moderação de comentários.

Além disso, `ensureCanCommentOnLesson()` e `createLessonComment()` rejeitam `role === "support"` com acesso ao conteúdo não permitido. Isso significa que o código atual não modela Suporte como participante de comentários de Aula, mesmo que uma tela administrativa genérica seja visível para Suporte.

Conclusão de autorização:

- Admin pode ser autorizado a receber e responder ao feed;
- Support não deve receber o corpo dos comentários por acidente apenas por ter `viewAdminPanel`;
- esconder a seção em React não basta; a projeção server-side precisa devolver `[]` para Support, ou a superfície precisa exigir uma permissão nova;
- se no futuro Suporte precisar participar, deve existir uma decisão explícita com permissões separadas, por exemplo `viewComments` e `replyComments`, sem reutilizar `manageContent`.

## O que exatamente deve aparecer

### Feed de atividade versus inbox

Os produtos consultados separam duas ideias:

**Feed de atividade**

- mostra o que aconteceu recentemente;
- é informativo e geralmente ordenado por tempo;
- pode funcionar sem estado pessoal de leitura;
- o item aponta para o objeto original;
- não promete que cada item exige ação.

**Inbox operacional**

- mostra trabalho que precisa da atenção de uma pessoa;
- precisa de triagem, leitura, conclusão, snooze, atribuição ou filtro;
- possui semântica de “pendente”, “resolvido” ou “não lido”;
- normalmente abre um detalhe persistente ou uma conversa em contexto.

GitHub, Linear e Slack possuem ações explícitas para leitura/não leitura e triagem. Intercom possui atribuição e visões como “All” e “Unassigned”. Open edX e Moodle distinguem não lido, não respondido e sinalizado. Esses estados não são apenas decoração; eles representam dados e regras do produto.

O projeto só possui `visible`/`hidden`. Não existe evidência de que o Admin tenha pedido para acompanhar uma fila de atendimento de comentários. Portanto, chamar a nova seção de “Caixa de entrada”, mostrar um número vermelho ou usar “pendente” seria enganoso.

### Escopo mínimo recomendado

Nome: **Últimos comentários**.

Cada item deve conter:

- avatar ou iniciais do autor;
- nome de exibição do autor, sem e-mail;
- trecho do comentário limitado visualmente, sem renderizar HTML rico;
- título do Curso;
- título da Aula;
- data/hora curta e absoluta conforme o formatter já usado no projeto;
- indicador discreto se o item é resposta, se isso for necessário para compreensão;
- ação ou link de destino “Abrir comentário”.

Quantidade inicial: 5 itens. O dashboard já usa esse limite para pedidos e certificados; manter o mesmo orçamento deixa a leitura previsível. Se os textos forem mais longos, 5 Cards/list items são preferíveis a uma tabela horizontal.

Ordenação:

```text
order by lesson_comments.created_at desc, lesson_comments.id desc
limit 5
```

O segundo critério é necessário para uma ordem estável quando dois comentários compartilham o mesmo timestamp.

Filtro inicial:

- `status = 'visible'`;
- Aula vinculada a publicação `published` ou `retired`, mantendo a regra já usada pela discussão;
- autor existente ou fallback seguro `Usuário removido`;
- apenas para Admin na primeira versão.

Não incluir no feed inicial:

- corpo de comentários ocultos;
- e-mail, telefone, ID interno ou dados de matrícula;
- código de Certificado ou dados financeiros;
- stack técnico ou motivo de moderação;
- indicador de não respondido sem regra definida;
- contador global de não lidas;
- botão de responder dentro do dashboard.

O dashboard deve ser uma porta de entrada. A resposta continua na página da Aula, onde o componente já conhece a árvore, a permissão de moderação, o formulário e o contexto do Curso.

### Filtro por autor

Não recomendo filtrar apenas comentários de alunos sem uma decisão de produto, mas recomendo que a primeira versão apresente principalmente conteúdo iniciado por aluno. A razão é operacional: respostas do Admin são parte da conversa, mas raramente são o trabalho que o dashboard precisa redescobrir.

Há duas opções coerentes:

1. **Feed de atividade real:** incluir todos os comentários visíveis, inclusive respostas de Admin, e aceitar que ele é histórico recente.
2. **Feed de trabalho:** incluir apenas comentários de alunos e nomear a seção “Novos comentários de alunos”.

Para este dashboard, recomendo a opção 1 com a seção “Últimos comentários”, porque corresponde ao pedido literal e não inventa o conceito de “sem resposta”. A UI pode mostrar o papel apenas como contexto visual discreto; o selo verificado já existe para equipe, mas não deve virar uma tag operacional.

Se a equipe perceber que respostas internas dominam a lista, a evolução correta é criar uma visão “Perguntas de alunos” ou uma inbox de comentários com regras explícitas, não esconder silenciosamente parte do feed.

## Modelo de consulta e segurança

### Projeção administrativa

Adicionar à projeção do dashboard uma estrutura específica, por exemplo:

```text
AdminDashboardRecentComment {
  id
  authorName
  authorRole
  bodyPreview
  createdAt
  courseId
  courseTitle
  lessonId
  lessonTitle
  parentId
}
```

O campo `bodyPreview` deve ser derivado no servidor a partir de texto simples e limitado antes de chegar ao componente. O limite visual do CSS continua necessário, mas não deve ser a única proteção contra payloads grandes.

A consulta deve:

- chamar `requirePermission("viewAdminPanel")` na fronteira pública da projeção;
- obter a sessão e negar a projeção de comentários para Support enquanto não houver permissão explícita;
- fazer uma única consulta com `lesson_comments` como tabela principal;
- juntar `lessons`, `modules`, `courses`, `course_publications`, `users` e `profiles`;
- selecionar somente os campos necessários;
- filtrar `lesson_comments.status = 'visible'`;
- usar `course_publications.status in ('published', 'retired')` conforme a regra da discussão;
- ordenar por `created_at desc, id desc`;
- limitar a 5.

O caminho de resposta não deve aceitar `courseId`, `lessonId` ou `authorUserId` como prova de autorização. Ele apenas aponta para uma rota que revalida a sessão, a permissão e a existência da Aula.

### Publicação e histórico

O ADR-0014 define que os comentários acompanham Curso + `curriculum_key` e não são copiados entre publicações. A consulta do dashboard precisa evitar duplicidade conceitual e não pode tratar a nova publicação como uma discussão nova.

Para uma primeira versão, o item pode usar o título atual do Curso e o título da Aula relacionada à linha do comentário. O destino administrativo precisa carregar a Aula física do comentário; não deve reconstruir a rota usando somente `curriculum_key`.

Se a experiência precisar sempre abrir a publicação atualmente publicada, será necessário resolver a Aula correspondente pela combinação Curso + `curriculum_key` antes de construir o link. Isso é uma evolução de navegação, não uma razão para copiar comentários ou alterar a regra do domínio.

### PII e LGPD

O comentário pode conter informação pessoal escrita pelo Aluno. Mesmo dentro do Admin, o princípio de minimização recomenda:

- nome de exibição, não e-mail;
- trecho curto no dashboard, texto completo apenas na conversa contextual;
- nenhum telefone, CPF, payload de matrícula ou dado financeiro;
- comentário oculto fora do feed;
- usuário excluído exibido como `Usuário removido`;
- ausência de logs com o corpo do comentário;
- sem copiar texto para auditoria, outbox ou analytics.

O projeto já segue uma linha semelhante em analytics: os agregados não expõem Aluno, Conta ou e-mail. A nova projeção deve manter esse limite e não criar retenção paralela.

## Paginação e crescimento

### Dashboard

Não recomendo paginação na seção embutida. Um dashboard deve responder “o que está acontecendo agora?” e não virar o arquivo completo de discussões. Cinco itens, com ação “abrir o contexto”, são suficientes para a primeira entrega.

### Futuro arquivo/inbox

Se o volume crescer ou se a equipe quiser buscar por Curso, Aula, autor ou período, a solução não é aumentar o `limit` do dashboard. Deve nascer uma superfície própria, por exemplo `/admin/comentarios`, com:

- paginação por cursor (`created_at`, `id`), não `offset` crescente;
- filtros por Curso, estado e autoria;
- busca textual somente se houver necessidade real;
- acesso ao thread completo;
- triagem e moderação conforme autorização;
- leitura/não leitura somente depois de definir o que isso significa.

Cursor por `(created_at, id)` preserva a ordem estável quando novos comentários entram enquanto o Admin navega. Uma paginação global baseada em `offset` pode pular ou repetir itens sob escrita concorrente.

## Índices possíveis

O índice atual `(lesson_id, created_at)` não é o índice natural para uma leitura global ordenada por `created_at` com filtro por `status`. Antes de adicionar uma migration, medir com `EXPLAIN (ANALYZE, BUFFERS)` em dados representativos, como recomenda a documentação do PostgreSQL.

Possíveis opções, em ordem de prudência:

1. **Sem novo índice inicialmente.** Para o volume atual e `limit 5`, testar a consulta real. O planner pode preferir uma varredura simples se a tabela for pequena.
2. **Índice composto global:** `(status, created_at desc, id desc)`. Ajuda quando o filtro por status é seletivo, mas o primeiro campo tem baixa cardinalidade e pode não ser o melhor para todas as distribuições.
3. **Índice parcial de visíveis:** `(created_at desc, id desc) where status = 'visible'`. Pode ser bom se a maioria dos acessos administrativos realmente ignora ocultos e a predicação da consulta for escrita de forma reconhecível pelo planner.
4. **Índice de relacionamento para a consulta de detalhe:** manter ou avaliar índices nos caminhos `lessons.course_publication_id`, `modules.course_publication_id` e `course_publications.course_id/status`, que já existem em grande parte no schema.

Não recomendo criar vários índices parciais por Curso, Aula ou papel. A documentação do PostgreSQL alerta que índices parciais são especializados e exigem predicados que o planner consiga reconhecer; muitos índices podem aumentar manutenção sem resolver a consulta principal. A ordem das colunas também deve seguir as condições e a ordenação reais, não uma combinação genérica.

## Alternativas avaliadas

### 1. Tabela com os últimos comentários

**Vantagens:** acompanha visualmente as tabelas atuais de compras e certificados; é simples de implementar.

**Problemas:** texto de comentário não é uma coluna tabular confortável; exige truncamento agressivo em telas estreitas; o contexto Curso/Aula e a ação ficam apertados.

**Decisão:** rejeitada para a primeira versão.

### 2. Timeline vertical

**Vantagens:** combina naturalmente autor, timestamp, evento e contexto; é coerente com o padrão TimelineItem do Primer.

**Problemas:** pode ficar ornamental e consumir altura; não deve parecer um log técnico.

**Decisão:** boa opção visual para um Card compacto, desde que cada item seja um row clicável acessível e a hierarquia não use grandes ícones.

### 3. Inbox global de comentários

**Vantagens:** melhor para operação contínua; permite unread, assignee, filtros, fila e SLA.

**Problemas:** exige novo modelo de dados, novas permissões, semântica de resposta, concorrência entre Admin/Suporte e uma rota dedicada. Implementar só o visual produziria uma inbox falsa.

**Decisão:** futuro possível, não primeira entrega.

### 4. Modal ou side sheet no dashboard

**Vantagens:** permite ler sem abandonar o dashboard.

**Problemas:** a resposta continua precisando do contexto da Aula; side sheet com árvore completa aumenta complexidade, foco e sincronização; modal é inadequado para uma conversa que pode crescer.

**Decisão:** usar link para a Aula administrativa. Se uma inbox existir no futuro, o padrão de side sheet do Primer é mais apropriado que um modal central para detalhe substancial.

### 5. Link direto para a página do Aluno

**Vantagens:** já existe o componente de comentários no fluxo do Aluno.

**Problemas:** expõe o contexto errado para Admin, pode acionar regras de acesso de Aluno/preview e não oferece moderação administrativa de forma clara.

**Decisão:** rejeitada. O destino deve ser a página administrativa da Aula.

### 6. Exibir unread derivado do tempo

**Vantagens:** não requer migration.

**Problemas:** “novo desde a última visita” não é leitura; dois Admins terão estados diferentes; múltiplas abas e dispositivos quebram a semântica; não há ação de concluir ou reabrir.

**Decisão:** rejeitada. Sem modelo de leitura, usar apenas recência factual.

## UX recomendada

Composição sugerida:

- seção após `RecentActivity` ou como parte da mesma área de atividade, sem competir com filas críticas;
- título `Últimos comentários`;
- descrição curta: `As interações mais recentes nas Aulas.`;
- Card de largura completa, visualmente mais leve que `OperationsOverview`;
- cinco itens em lista vertical;
- avatar pequeno, nome e tempo na primeira linha;
- Curso e Aula na segunda linha, com truncagem segura;
- trecho do comentário em duas linhas no máximo;
- ação contextual no fim: `Abrir comentário` ou item inteiro como link, com nome acessível;
- hover/focus cobrindo todo o item, sem criar uma affordance diferente para o texto;
- empty state somente quando não houver comentários: `Ainda não há comentários nas Aulas.`;
- não ocultar a seção por falta de comentários se o objetivo for descoberta? Recomendo ocultar como as outras atividades vazias do dashboard, desde que o KPI/estado de saúde continue visível. Se a equipe quiser ensinar a existência do recurso, uma única blankslate curta pode ser usada em vez de um Card vazio.

No mobile, o item deve empilhar contexto e ação; o corpo não deve forçar uma tabela horizontal. O link precisa ser teclado-acessível e anunciar Curso, Aula e autor, não apenas “Abrir”.

## Testes e critérios de aceite para implementação futura

### Servidor

- Admin com `viewAdminPanel` recebe no máximo cinco comentários visíveis.
- Comentários ocultos não entram na projeção.
- Autor removido vira `Usuário removido`.
- Nenhum e-mail ou dado financeiro é selecionado.
- Ordenação é `created_at desc, id desc`.
- Aula em publicação não permitida não vaza no feed.
- Support sem permissão específica recebe lista vazia e não corpo de comentários.
- Falha na consulta não é convertida em lista vazia silenciosamente; segue o padrão de erro do dashboard.

### Navegação

- O link aceita `?tab=comments` e ativa a aba correta.
- O fragmento focaliza o thread correto.
- A rota administrativa revalida autorização independentemente do link.
- Comentário removido ou ocultado entre as duas requisições resulta em estado seguro, não em conteúdo vazado.

### UI

- O texto é truncado sem perder o nome do Curso e da Aula.
- O item completo possui foco visível.
- O destino é compreensível por leitor de tela.
- A seção desaparece ou mostra empty state de forma consistente com `RecentActivity`.
- Skeleton, erro local e carregamento seguem o padrão do dashboard.

### Performance

- Uma consulta limitada, sem N+1 por Aula.
- Medir com `EXPLAIN (ANALYZE, BUFFERS)` antes de adicionar índice.
- Se surgir arquivo global, usar cursor por timestamp + ID.

## Recomendação final

Implementar primeiro **Últimos comentários** como feed administrativo, somente para Admin, com cinco comentários visíveis, preview mínimo e link direto para a Aula administrativa com aba e âncora de comentário.

Não implementar agora:

- inbox global;
- unread/read;
- atribuição;
- snooze;
- “não respondido”;
- badge de contagem na navegação;
- leitura por Suporte;
- resposta inline no dashboard;
- índice ou migration sem medir a consulta real.

Depois de observar o uso real, decidir entre duas evoluções:

1. manter como feed leve, se o objetivo for apenas descoberta;
2. transformar em inbox de comentários, se houver volume e necessidade operacional comprovada. Nesse caso, criar primeiro a autorização e o modelo de triagem, depois a UI.

Essa ordem preserva o princípio já adotado no projeto: a interface administrativa aponta para o agregado que possui a regra e a ação; não duplica o domínio em uma projeção que pareça mais poderosa do que realmente é.

## Clarificação de produto posterior à pesquisa

As decisões abaixo substituem as recomendações iniciais desta nota onde houver
conflito:

- esta entrega terá somente o feed necessário; não haverá uma segunda fase de
  inbox ou triagem futura incluída no plano;
- Admin e Suporte terão a mesma liberdade de ler, criar, responder, ocultar e
  restaurar comentários, sem nova permissão na matriz;
- o feed incluirá comentários de Alunos tanto na raiz quanto dentro de threads;
- comentários escritos por Admin ou Suporte ficam fora do feed de descoberta,
  mas continuam visíveis na Aula e entram na auditoria quando forem ações de
  gerenciamento;
- a implementação deve auditar criação de comentário pela equipe, ocultação e
  restauração sem registrar o corpo ou outras informações pessoais.

O plano executável atualizado é
`plans/013-admin-latest-comments-feed.md`.
