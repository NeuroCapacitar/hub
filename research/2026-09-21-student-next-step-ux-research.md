# Pesquisa: próximo passo do Aluno no dashboard

> Escopo: validar a primeira etapa do sprint: transformar a Home do Aluno em
> uma entrada orientada à continuidade da aprendizagem.
> Código analisado: `feature/small-changes` em `8ecf677b`.

## Evidências do Hub

- `src/app/(student)/app/(dashboard)/page.tsx` já separa Cursos ativos,
  concluídos, disponíveis e próximos.
- A variável `_nextCourse` é calculada, mas não chega à renderização.
- `StudentCatalogCourseCard` já possui `nextLessonId`, `nextReleaseAt`,
  `progressPercent`, `completedCount`, `totalCount`, capa e validade do acesso.
- A projeção não possui título, módulo ou duração da próxima Aula, nem uma
  marca de último acesso por Curso.
- `getStudentCourseCatalog` ordena o catálogo por `created_at desc`; o primeiro
  Curso não é evidência de que foi o último Curso acessado.
- `nextLessonId` é a próxima Aula elegível segundo sequência e liberação
  temporal; não significa necessariamente a Aula em que o Aluno parou.

## Padrões externos

1. A documentação oficial do LinkedIn Learning separa Cursos “In Progress”,
   “Saved” e histórico, e permite consultar o conteúdo em andamento em uma
   visão própria. A página de ajuda também descreve o Curso em andamento com a
   Aula atual e sua duração, não somente uma porcentagem.
   - https://www.linkedin.com/help/linkedin/answer/a704819/my-learning-page-of-linkedin-learning-overview?lang=en-US
   - https://www.linkedin.com/help/learning/answer/a1346436

2. A documentação oficial do Moodle oferece filtros de cursos em andamento e
   ordenação por “last accessed” ou título. Isso é um sinal importante: quando
   um produto escolhe um Curso principal automaticamente, a base esperada é
   atividade recente ou preferência explícita, não apenas a ordem do catálogo.
   - https://docs.moodle.org/502/en/Course_overview

3. Estudos sobre learning analytics distinguem mostrar métricas de apoiar uma
   decisão. Exposição a dashboards sem contexto pode não melhorar
   autorregulação; mensagens acionáveis e contextualizadas são mais úteis para
   planejar o próximo passo.
   - https://www.sciencedirect.com/science/article/pii/S0360131520302839
   - https://www.sciencedirect.com/science/article/pii/S266655732600056X

4. Fluent recomenda usar espaço e proximidade para criar relação e hierarquia,
   enquanto Atlassian recomenda escalas de espaço consistentes e distintas por
   contexto. Isso apoia um bloco de continuidade mais destacado sem aumentar
   padding e métricas em toda a tela.
   - https://fluent2.microsoft.design/layout
   - https://atlassian.design/foundations/spacing

5. O Web Interface Guidelines recomenda links semânticos para navegação,
   texto explícito para a ação, `min-w-0`/truncagem para conteúdo longo,
   progresso textual além da cor e reflow responsivo.
   - https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md

## Decisão

Implementar a ideia é válido, mas em uma versão mais cautelosa:

- se houver exatamente um Curso ativo, mostrar um bloco de continuidade com
  capa, Curso, próxima Aula, duração da próxima Aula, progresso e uma ação
  “Continuar aula”;
- se houver vários Cursos ativos, não escolher silenciosamente o primeiro
  Curso do catálogo. Manter a lista de Cursos em andamento ou introduzir uma
  regra explícita baseada em último acesso/preferência antes de destacar um
  único Curso;
- se não houver próxima Aula porque o próximo Módulo está bloqueado por tempo,
  mostrar a data de liberação e “Ver trilha”, sem fingir que existe uma Aula
  pronta;
- se o Curso estiver em zero por cento, usar “Começar”/“Iniciar curso”, não
  “Continuar”;
- não adicionar streak, ranking, metas, horas acumuladas ou alertas de culpa.

## Dados necessários para uma versão completa

Para o bloco ser realmente contextual, a projeção deveria expor metadados da
próxima Aula (`title`, `durationSeconds`, `moduleTitle` e ordem do Módulo). Isso
parece caber na consulta e agregação existentes, sem migration.

Para escolher um único Curso entre vários, o produto precisa decidir entre:

1. adicionar `lastAccessedAt`/última atividade essencial e ordenar por ela;
2. permitir uma preferência explícita do Aluno;
3. não destacar um Curso quando houver ambiguidade.

A opção 3 é a mais segura para a primeira entrega; a opção 1 é a melhor
evolução se houver evidência de uso de múltiplos Cursos.

## Limitações

Não há telemetria de último acesso no modelo retornado ao dashboard e não foi
feita inspeção visual em navegador nesta etapa. As referências de mercado
confirmam padrões de organização, mas não provam que um hero único seja melhor
para os Alunos do Hub; isso deve ser validado com a tela real e tarefas simples.
