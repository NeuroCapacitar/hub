# Plan 014: Materializar a identidade estável da discussão nos comentários

> Plano de migração de domínio. Não altera código da aplicação nesta etapa.
> A decisão de produto é que uma discussão pertence a `course_id` +
> `curriculum_key`, e não à publicação física da Aula. O `lesson_id` atual
> será preservado inicialmente como contexto histórico e de navegação.

## Status

- Status: DONE
- Priority: P1
- Effort: L/XL
- Risk: HIGH
- Depends on: 013
- Planned at: commit 258beae3, 2026-09-19
- Drift: o feed administrativo e os ajustes de comentários da Plan 013 estão
  não commitados nesta worktree; preservar esse diff.

## Objetivo

Permitir que comentários, respostas e moderação continuem existindo e sendo
encontrados quando a mesma Aula pedagógica atravessar publicações `draft`,
`published` e `retired`.

Resultado obrigatório:

- a identidade lógica é exatamente `(course_id, curriculum_key)`;
- uma publicação que preserva `curriculum_key` reutiliza a mesma discussão;
- mudança pedagógica grande cria novo `curriculum_key` e nova discussão;
- comentários não são copiados entre publicações;
- `lesson_id` é origem histórica, não autoridade da thread;
- Admin/Suporte leem comentários originados em `draft`;
- Alunos veem comentários visíveis quando têm acesso à Aula atual; a publicação
  não filtra a identidade da discussão;
- uma futura remoção de instância física não apaga a conversa.

## Decisão de arquitetura

Esta entrega materializa `course_id` e `curriculum_key` diretamente em
`lesson_comments`, por ser uma mudança incremental menor que criar
imediatamente `lesson_discussions`.

`lesson_comments.source_lesson_id` permanece como proveniência histórica
anulável. O código não o usa como identidade da discussão e a remoção da Aula
física usa `on delete set null`.

## Invariantes obrigatórias

1. `course_id` e `curriculum_key` são derivados da Aula dentro da transação;
   nunca vêm do formulário, URL ou cliente.
2. A Aula de origem pertence ao mesmo Curso e tem o mesmo `curriculum_key`
   gravado no comentário.
3. `parent_id` só aponta para comentário da mesma discussão lógica.
4. Publicar, aposentar ou clonar uma publicação não copia comentários.
5. Staff e Aluno podem ler a mesma discussão quando o Aluno tem acesso à Aula;
   `draft` não é uma categoria de comentário interno.
6. A migration termina sem identidade nula ou divergente.
7. Auditoria registra identidade, contexto e transição, nunca o corpo.

## Evidência atual

- `CONTEXT.md` e ADR-0014 já definem Discussão da Aula como Curso +
  `curriculum_key`.
- `src/features/admin/authoring.ts` preserva `curriculum_key` ao clonar.
- `src/db/schema.ts` prende hoje `lesson_comments.lesson_id` por FK com
  `on delete cascade`, sem materializar Curso ou identidade curricular.
- `src/features/comments/server.ts` já lê por Curso + `curriculum_key`,
  mas filtra a publicação física e exclui respostas staff em `draft`.
- A pesquisa externa está em
  `research/2026-09-19-comment-discussion-versioning.md`.

## Escopo

### Incluído

- schema de `lesson_comments`;
- migration e backfill;
- criação de comentários e respostas;
- leitura da árvore por papel;
- ocultação/restauração e auditoria;
- projeção do dashboard;
- deep links e contexto histórico;
- testes de migration, invariantes e publicação.

### Fora de escopo

- inbox global, unread/read, atribuição, SLA e notificações;
- copiar comentários por publicação;
- mesclar Cursos diferentes;
- mesclar automaticamente novos `curriculum_key`;
- redesign de comentários;
- aplicação da migration em qualquer ambiente nesta fase.

## Etapas de implementação

### 0. Congelar o contrato

1. Registrar a diferença entre nova publicação, nova identidade curricular e novo
   Curso.
2. Criar ADR de persistência se o responsável confirmar que a desnormalização é
   a decisão definitiva; ADR-0014 continua sendo a autoridade de domínio.
3. Definir que `lesson_id` é apenas contexto histórico na primeira fase.

STOP se o produto quiser que uma mudança pedagógica grande preserve a mesma
discussão sem criar novo `curriculum_key`.

### 1. Preflight read-only

Antes de editar schema:

1. Inventariar todos os writers de `lesson_comments`, inclusive scripts,
   seeds e SQL direto.
2. Medir total de comentários, nulos/origens ausentes, divergências de Curso e
   `curriculum_key`, pais em discussões diferentes e distribuição por status
   de publicação.
3. Capturar `EXPLAIN (ANALYZE, BUFFERS)` da leitura por
   `course_id + curriculum_key` e do dashboard.
4. Emitir somente contagens e IDs técnicos necessários; não expor corpos,
   e-mails ou nomes.

STOP diante de comentário sem origem, pai incompatível ou identidade ambígua.

### 2. Migration expand/backfill

Gerar pela ferramenta oficial:

~~~powershell
bun run db:generate -- --name stable_lesson_discussion_fields
bun run db:migrations:check
~~~

A migration deve:

1. adicionar `course_id` e `curriculum_key` inicialmente anuláveis;
2. backfillar por `lesson_comments.lesson_id` → `lessons` → `modules`;
3. validar ausência de nulos e divergências;
4. adicionar FK de `course_id` para `courses`;
5. aplicar `not null` depois do preflight;
6. adicionar índice por `(course_id, curriculum_key, created_at, id)`
   somente se o plano medido justificar;
7. manter `lesson_id` nesta primeira fase para rollback e auditoria.

A migration deve ser compatível com o código anterior durante a promoção.

### 3. Escrita transacional

Em `src/features/comments/server.ts`:

1. Dentro de `createLessonComment`, carregar Curso e `curriculum_key` da
   Aula informada.
2. Inserir `lesson_id`, `course_id` e `curriculum_key` na mesma transação.
3. Para replies, comparar identidade derivada com a do pai, não somente IDs
   físicos.
4. Manter auditoria staff na mesma transação.
5. Não aceitar identidade enviada pelo cliente.
6. Manter hide/restore com a mesma identidade e sem corpo na auditoria.

### 4. Leitura por identidade lógica

Em `getLessonComments` e projeções administrativas:

1. Resolver a identidade da Aula de entrada uma vez.
2. Buscar comentários por `course_id + curriculum_key`.
3. Admin/Suporte e Alunos usam a mesma identidade; não filtrar por origem
   `draft`, `published` ou `retired`.
4. Alunos continuam vendo somente comentários `visible` e continuam sujeitos à
   autorização de acesso à Aula.
5. Manter árvore por `parent_id` e uma camada de resposta.
6. Dashboard usa identidade direta para leitura e Aula atual só para título,
   contexto e navegação.
7. Instância histórica removida deve resultar em estado arquivado no Admin, não
   `notFound` genérico.

### 5. Desacoplar retenção física — concluída em 0088

Após a Etapa 4, a migration 0088:

1. renomeou para `source_lesson_id` anulável;
2. trocou cascade por `on delete set null`;
3. preservou identidade, autoria, data, parent e moderação sem Aula física;
4. fez o dashboard exibir `Histórico` quando não existe destino navegável.

O teste de deleção física real permanece fora do banco Development compartilhado;
a FK e o contrato SQL foram validados sem apagar dados reais.

### 6. Testes

Adicionar testes de contrato e, obrigatoriamente, integração PostgreSQL:

- backfill de todos os comentários legados;
- criação grava identidade derivada;
- reply entre publicações da mesma Aula funciona;
- reply com pai de outra discussão falha;
- staff lê `draft`;
- Aluno lê comentário visível de origem `draft` quando tem acesso à discussão;
- após publicar, a mesma linha aparece sem cópia;
- novo `curriculum_key` não herda thread;
- hide/restore preserva identidade e audita;
- dashboard/deep link mantém `commentId`;
- remoção física preserva comentário com origem nula.

Mocks SQL não substituem o teste entre duas publicações físicas.

### 7. Verificação operacional

~~~text
bun x vitest run src/features/comments src/features/admin/server-read-projections.test.ts "src/app/(admin)/admin/(dashboard)/page.test.tsx"
bun run db:migrations:check
bun run check
bun run typecheck
bun run docs:check
~~~

Antes de Development:

- revisar SQL, journal e contagens do preflight;
- aplicar `bun run db:migrate:development` somente com autorização explícita;
- repetir invariantes e `EXPLAIN`;
- registrar mudança de retenção/índice no runbook;
- tentar CodeRabbit conforme o runbook ou registrar o motivo do skip.

## Rollback e compatibilidade

- Primeira migration é expand/backfill e não remove `lesson_id`.
- Em falha de leitura, o código pode voltar temporariamente à leitura física
  enquanto os campos novos permanecem.
- Não inverter migration em Production.
- A fase `set null` é separada e exige backup e validação de restore.

## Critérios de conclusão

- todos os comentários legados têm identidade materializada;
- nenhuma mutação aceita identidade do cliente;
- replies entre publicações da mesma Aula funcionam;
- Alunos não veem comentários restritos ao draft;
- publicações não duplicam threads;
- PostgreSQL comprova backfill, publicação, moderação e replies;
- migrations check, testes, check, typecheck e docs passam;
- ambiente autorizado foi migrado e o preflight pós-migration não encontrou
  divergências;
- ADR/runbook/schema refletem a decisão final.

## STOP conditions

Pare antes de implementar se:

- houver comentário sem Aula ou identidade divergente;
- existir writer não atualizável;
- remoção de Aula precisar apagar comentários;
- o mesmo `curriculum_key` precisar de duas discussões simultâneas;
- a solução exigir copiar threads;
- a migration exigir operação destrutiva em banco compartilhado.
