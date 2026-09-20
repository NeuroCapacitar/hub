# Plan 013: Adicionar feed administrativo de últimos comentários

> **Executor instructions**: Siga este plano em ordem. Ele incorpora as decisões de
> produto aprovadas nesta conversa: haverá somente um feed de atividade, sem uma
> segunda fase de inbox; Admin e Suporte terão as mesmas capacidades de leitura,
> resposta, ocultação e restauração; o feed incluirá comentários de alunos em
> threads e respostas, mas excluirá comentários escritos por Admin ou Suporte.
> Não introduza permissões novas sem parar e reportar.
>
> **Drift check**: o plano foi escrito contra o commit 258beae3, mas a worktree
> contém uma alteração não commitada anterior em
> src/app/(admin)/admin/(dashboard)/page.tsx que remove estados vazios
> inalcançáveis. Preserve essa alteração e compare o arquivo vivo antes de editar.

## Status

- Priority: P1
- Effort: L
- Risk: HIGH
- Depends on: none
- Category: product, security, tests, performance
- Planned at: commit 258beae3, 2026-09-19

## Why this matters

O Dashboard Admin mostra compras, certificados e filas operacionais, mas não oferece
uma entrada rápida para dúvidas recentes nas Aulas. Os comentários já possuem
árvore de respostas, moderação e contexto curricular; duplicar essa lógica no
Dashboard criaria risco de autorização e N+1 consultas. O resultado deve ser um
feed curto de atividade que leve diretamente à Aula administrativa correta, sem
fingir que já existe uma inbox com estados de leitura, atribuição ou resolução.

## Decisões obrigatórias

1. A única entrega é uma seção "Últimos comentários" no Dashboard Admin. Não criar
   inbox global, unread/read, atribuição, snooze, "não respondido", SLA, badge
   global ou rota /admin/comentarios.
2. Admin e Suporte possuem a mesma liberdade de gerenciamento: ler, criar
   comentário, responder, ocultar e restaurar. Isso é uma regra de papel, não uma
   nova permissão delegável. Não reutilizar manageContent como autorização para
   Support.
3. O feed inclui comentários escritos por Alunos quando parent_id é nulo ou quando
   o comentário é uma resposta de thread.
4. O feed não inclui comentários escritos por Admin ou Suporte. As respostas da
   equipe continuam visíveis dentro da Aula, mas não ocupam o feed de descoberta.
5. Comentários ocultos de Alunos continuam sendo registros de gerenciamento e devem
   aparecer no feed com o estado "Oculto". O conteúdo deve respeitar a regra de
   moderação já existente: somente Admin/Suporte verão o corpo de comentário oculto.
6. Cada item leva à Aula administrativa com a aba de comentários selecionada e o
   thread focalizado. Não abrir modal, side sheet ou composer inline no Dashboard.
7. A seção desaparece quando não há comentários de Alunos para mostrar, seguindo o
   padrão de RecentActivity; não renderizar um Card vazio.

## Current state

### Dashboard

- src/app/(admin)/admin/(dashboard)/page.tsx compõe o Dashboard.
- RecentActivity, em torno das linhas 1144–1174, retorna null quando não há
  compras nem certificados; esse é o padrão de visibilidade a reutilizar.
- O arquivo possui uma alteração não commitada anterior que remove empty states
  defensivos das tabelas de atividade. Não revertê-la.
- src/app/(admin)/admin/(dashboard)/page.test.tsx já testa projeções vazias,
  filas parciais e atividade recente.

### Projeção administrativa

- getAdminDashboardProjection, em src/features/admin/server.ts, exige
  viewAdminPanel e retorna courseHealth, operations, recentCertificates e
  recentOrders.
- Adicionar recentComments ao retorno, sem colocá-los dentro de operations:
  comentários são atividade contextual, não fila operacional.
- A sessão retornada por requirePermission("viewAdminPanel") deve proteger a
  leitura. A projeção de comentários só deve ser calculada para admin e support.

### Modelo e leitura atual

- src/db/schema.ts define lesson_comments com lesson_id, author_user_id,
  parent_id, body, status, hidden_by_user_id, hidden_at, created_at e updated_at.
- Índices atuais: lesson_id + created_at, parent_id + created_at e author.
  Não presumir que sirvam para ordenação global sem medir a consulta.
- getLessonComments, em src/features/comments/server.ts, valida a Aula e monta a
  árvore. Não reutilizar essa função em loop no Dashboard: isso criaria N+1 e
  carregaria threads completas.
- Criar uma leitura administrativa única, limitada a cinco, juntando comments,
  lessons, modules, courses, course_publications, users e profiles.

### Autorização a ajustar

- A página administrativa da Aula hoje define canManageComments com
  canPerform(session, "manageContent"), bloqueando Support.
- actions.ts exige manageContent para criar no contexto Admin e para
  ocultar/restaurar.
- ensureCanCommentOnLesson e createLessonComment rejeitam Support
  explicitamente.
- Alterar esses pontos para uma regra explícita admin | support, sem criar
  permissão nova.
- Manter intacta a autorização de comentários na área do Aluno e sua validação
  de matrícula/acesso.

### Auditoria

- writeAuditLog, em src/features/admin/audit-log.ts, é o escritor comum.
- src/features/admin/audit-presentation.ts contém os labels dos eventos.
- Auditar as ações de gerenciamento da equipe:
  lesson_comment.created, lesson_comment.hidden e lesson_comment.restored.
- Usar target_type = "lesson_comment", target_id = commentId e metadata mínima:
  courseId, lessonId, parentId quando aplicável e transição de status.
- Nunca registrar corpo, e-mail, payload ou dados de matrícula.
- Gravar auditoria na mesma transação da mutação.
- Comentários escritos por Alunos não são ações administrativas e não precisam
  gerar eventos de auditoria nesta entrega.

### Navegação

- A página administrativa da Aula usa Tabs defaultValue="video" e não lê
  searchParams.
- Aceitar apenas tab=comments como valor alternativo.
- Adicionar id="comment-{id}" ao elemento raiz de threads e respostas.
- Destino: /admin/cursos/{courseId}/aulas/{lessonId}?tab=comments#comment-{commentId}.
- Comentário removido entre consulta e clique deve resultar em estado seguro, sem
  erro ou exposição indevida.

## Data shape

Adicionar um tipo próximo dos read models administrativos:

~~~ts
interface AdminDashboardRecentComment {
  authorName: string;
  authorRole: "admin" | "student" | "support";
  bodyPreview: string;
  commentId: string;
  courseId: string;
  courseTitle: string;
  createdAt: Date;
  isHidden: boolean;
  isReply: boolean;
  lessonId: string;
  lessonTitle: string;
}
~~~

Regras:

- authorRole vem de profiles.role, com fallback student para usuário removido.
- Filtrar authorRole = student, sem filtrar parent_id.
- Filtrar publicações published ou retired.
- Ordenar created_at desc, id desc e limitar a 5.
- bodyPreview é texto simples, limitado no servidor, sem HTML.
- `lessonId` do read model é o destino navegável na publicação `draft` atual,
  resolvido por `course_id + curriculum_key`; o ID físico histórico do
  comentário não é usado diretamente no link.
- Comentário oculto aparece com "Comentário oculto" ou prévia segura conforme a
  regra de moderação; não descartar o registro.
- Nenhum e-mail ou dado financeiro deve chegar ao componente.

## Design

Integrar os comentários dentro da seção existente
`src/app/(admin)/admin/(dashboard)/page.tsx`, sem criar uma segunda seção de
dashboard ou um inbox paralelo.

Estrutura:

- `RecentActivity` mantém um único título e uma única descrição;
- compras, certificados e comentários são cards irmãos no mesmo fluxo vertical;
- o card de comentários reutiliza `CardHeader`, `CardContent` e a moldura de
  tabela dos dois cards existentes;
- tabela compacta com Aluno, Curso e aula, Comentário, data e ação;
- Aluno e contexto curricular usam duas linhas; o comentário recebe a maior
  coluna e fica limitado a duas linhas com truncamento seguro;
- indicação "Resposta" e "Oculto" fica junto dos metadados do Aluno;
- layout fixo mantém data e ação compactas e entrega o espaço restante ao
  comentário;
- cada ação leva à aba de comentários da aula e focaliza o comentário;
- tabela mantém rolagem horizontal acessível em telas estreitas;
- sem botão "Ver todos" até existir uma rota de gerenciamento global.

Renderizar dentro de `RecentActivity`, depois de compras e certificados, sem
reorganizar as filas críticas. Não transformar comentários em uma nova fila
vermelha de pendências.

## Steps

### Step 1: Regra compartilhada de gerenciamento

Adicionar helper explícito, por exemplo isLessonCommentManager(role), que retorne
true somente para admin e support.

Usar em:

- AdminLessonEditPage para canComment e canModerate;
- createLessonCommentAction no contexto Admin;
- hideLessonCommentAction;
- restoreLessonCommentAction;
- ensureCanCommentOnLesson e createLessonComment no caminho administrativo.

Manter a guarda de acesso de Student.

**Verify**: testes comprovam que Admin e Support podem ler, criar, responder,
ocultar e restaurar no contexto Admin; Student permanece protegido.

### Step 2: Auditoria transacional

Alterar os serviços de comentário para gravar audit log na mesma transação da
criação, ocultação e restauração. Adicionar labels e testes.

Casos:

- lesson_comment.created para comentário/resposta de Admin/Suporte;
- lesson_comment.hidden;
- lesson_comment.restored.

**Verify**: falha na auditoria faz rollback da mutação; corpo do comentário não
aparece no metadata.

### Step 3: Projeção limitada

Adicionar readDashboardRecentComments em src/features/admin/server.ts e incluí-la
em getAdminDashboardProjection.

Uma única query deve:

- juntar Curso, Módulo, Aula, publicação, usuário e perfil;
- incluir raízes e respostas de Alunos;
- excluir autores Admin/Suporte;
- preservar status oculto;
- aceitar published/retired;
- ordenar por data e ID;
- limitar a cinco;
- selecionar apenas campos necessários.

Não chamar getLessonComments por Aula.

**Performance gate**: executar EXPLAIN (ANALYZE, BUFFERS) com dados
representativos antes de criar migration. Não criar índice automaticamente.

### Step 4: Feed do Dashboard

Criar o componente visual e renderizá-lo somente quando recentComments.length > 0.
Cada item aponta para a Aula administrativa com tab=comments e hash do comentário.

**Verify**: teste cobre feed oculto quando vazio, raiz, resposta, oculto e link
correto.

### Step 5: Deep link da Aula

Adicionar searchParams e defaultValue comments quando tab=comments. Aceitar
somente valores conhecidos e manter video como fallback. Adicionar IDs de
threads e respostas.

**Verify**: teste cobre parâmetro válido, inválido e ID do comentário.

### Step 6: Testes e checks

Atualizar testes frágeis que esperam manageContent para comentários. Adicionar
casos de Support e auditoria sem remover os casos de Student.

Executar:

~~~text
bun x vitest run src/features/comments src/app/(admin)/admin/(dashboard)/page.test.tsx src/app/(admin)/admin/cursos/[courseId]/aulas/[lessonId]
bun run check
bun run typecheck
bun run docs:check
~~~

Se verify:quick repetir falha preexistente fora do escopo, registrar sem mascarar
os testes direcionados.

## Scope

### In scope

- read model limitado de últimos comentários;
- feed visual do Dashboard Admin;
- raízes e respostas de Alunos;
- exclusão de comentários da equipe do feed;
- gerenciamento compartilhado Admin/Suporte na Aula;
- auditoria transacional de criação da equipe, ocultação e restauração;
- navegação profunda para aba e thread;
- testes server/UI/authorization/audit.

### Out of scope

- inbox global;
- unread/read, atribuição, snooze, resolução, SLA ou não respondido;
- nova permissão na matriz de Support;
- resposta inline no Dashboard;
- busca, filtros e paginação globais;
- notificações e e-mails;
- mudança de schema sem evidência do EXPLAIN;
- auditoria do texto escrito por Alunos;
- comunidade fora de comentários por Aula.

## Done criteria

- [ ] Admin e Support leem e gerenciam comentários no contexto Admin.
- [ ] Student mantém proteção por matrícula e acesso à Aula.
- [ ] Criação, ocultação e restauração da equipe geram audit log na mesma transação.
- [ ] Dashboard mostra no máximo cinco comentários de Alunos, incluindo respostas.
- [ ] Comentários da equipe não aparecem no feed.
- [ ] Comentários ocultos de Alunos aparecem com estado claro.
- [ ] Item abre a Aula na aba e thread corretas.
- [ ] Feed vazio não cria seção vazia.
- [ ] Não existe N+1 query.
- [ ] bun run check passa.
- [ ] bun run typecheck passa.
- [ ] Testes direcionados passam.
- [ ] Nenhuma permissão nova foi criada.

## STOP conditions

Parar se:

- não for possível distinguir Aluno, Admin e Support com segurança;
- liberar Support também liberar acesso indevido à área do Aluno;
- auditoria não puder ser gravada na mesma transação;
- consulta exigir índice novo sem EXPLAIN;
- deep link alterar sem segurança a semântica das outras abas;
- alguém tentar incluir unread/read, atribuição ou inbox nesta entrega.

## Maintenance notes

- O feed é projeção de atividade, não fonte de verdade.
- A Aula administrativa continua sendo o destino canônico.
- Qualquer inbox futura é um projeto separado com modelo de triagem.
- Índices novos dependem de volume e plano PostgreSQL reais.
