---
status: accepted
owner: product-and-engineering
last_verified_commit: 258beae3
---

# ADR-0018 Persistência da identidade estável das discussões de Aula

## Contexto

Uma `CoursePublication` materializa novas linhas físicas de Módulo e Aula. A
discussão, porém, deve acompanhar a mesma identidade pedagógica entre
publicações. O ID físico de `lessons` é útil para saber qual instância recebeu o
comentário, mas não deve definir sozinho a thread.

O modelo anterior guardava somente `lesson_comments.lesson_id`. Isso permitia
que a leitura dependesse acidentalmente do status da publicação e que uma
resposta gravada em `draft` desaparecesse de consultas que só consideravam
`published` e `retired`.

## Decisão

`course_id + curriculum_key` é a identidade materializada de uma discussão de
Aula.

`lesson_comments` passa a armazenar:

- `course_id`, derivado da Aula no servidor;
- `curriculum_key`, derivado da Aula no servidor;
- `lesson_id`, mantido inicialmente como origem física e contexto histórico.

Regras:

- publicações que preservam `curriculum_key` compartilham a mesma discussão;
- publicações não copiam comentários;
- uma mudança pedagógica grande cria outro `curriculum_key` e outra discussão;
- Admin/Suporte e Alunos consultam a mesma discussão lógica;
- Alunos continuam sujeitos ao acesso à Aula e ao estado `visible`, mas a origem
  `draft`, `published` ou `retired` não filtra a thread;
- respostas validam a identidade materializada do comentário pai;
- auditoria registra a identidade e o contexto, nunca o corpo.

A migration `0088_archive_lesson_comment_source` tornou essa origem anulável,
renomeou-a para `source_lesson_id` e trocou cascade por `set null`. A conversa
continua preservada quando a instância física é removida.

## Alternativas consideradas

- **Somente `lesson_id`:** rejeitada; confunde instância de publicação com
  identidade da discussão.
- **Copiar comentários por publicação:** rejeitada; duplica histórico, respostas
  e moderação.
- **Criar imediatamente `lesson_discussions`:** é o modelo mais completo, mas
  foi adiado para evitar uma nova entidade antes de a necessidade de retenção
  independente da Aula física justificar seu custo.
- **Campos enviados pelo cliente:** rejeitados; a identidade é sempre derivada
  dentro da transação.

## Consequências

- O schema contém dados denormalizados; as mutações e o backfill precisam manter
  a consistência entre os campos e a Aula de origem.
- A leitura por discussão pode usar um índice composto por Curso, identidade e
  data, validado com `EXPLAIN` antes de promover a migration em bases maiores.
- A publicação continua sendo contexto de visibilidade e navegação, não de
  identidade.
- O Curso continua sendo parte da chave para impedir que Cursos diferentes
  compartilhem comentários mesmo quando UUIDs curriculares coincidirem.
