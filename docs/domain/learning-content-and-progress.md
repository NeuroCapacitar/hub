---
status: canonical
owner: engineering
last_verified_commit: e325b7e
---

# Conteúdo, aprendizagem e progresso

## Modelo

`Course` é a identidade comercial. `CoursePublication` é uma revisão interna materializada de Módulos e Aulas, com estados `draft`, `published` e `retired`. Há no máximo uma publicação publicada e uma em rascunho por Curso.

`modules.course_id` e `modules.course_publication_id` são protegidos pela
constraint composta criada na migration
`0078_protect_module_course_publication_ownership`; a Publicação vinculada a um
Módulo precisa pertencer ao mesmo Curso.

`lessons.module_id` e `lessons.course_publication_id` são protegidos pela
constraint composta criada na migration
`0079_protect_lesson_module_publication_ownership`; a Aula precisa pertencer à
mesma Publicação do Módulo.

Matrícula concede acesso comercial ao Curso, não a uma publicação. Portanto, toda Matrícula ativa lê a publicação `published` vigente. Uma publicação nova alcança todas os Alunos com Matrícula ativa; acesso expirado, revogado ou bloqueado não lê conteúdo novo. Ver [ADR-0007](../adr/0007-course-versioning-and-enrollment-curriculum.md).

## Regras de domínio

### REG-LEA-001 Publicação é atômica e em lote

`createCoursePublicationDraft`, em `src/features/admin/authoring.ts`, clona a publicação vigente para um único rascunho. `publishCoursePublication` serializa o Curso com lock transacional, valida o rascunho, rejeita vídeo JMVStream sem player e vídeo JMVStream identificado sem duração sincronizada; links manuais JMVStream sem `video_external_id` podem ser publicados e só aceitam conclusão manual enquanto não houver duração. Só então a capa é copiada fora de uma transação aberta; uma segunda transação adquire o mesmo lock, revalida o estado e aposenta a publicada anterior, publica o rascunho e grava autora/data no audit log. Alterações concorrentes no rascunho são serializadas pelo mesmo lock e não atravessam a fronteira de publicação. Salvar conteúdo só é permitido no rascunho: não há correção direta em conteúdo publicado.

Publicar uma `CoursePublication` não altera visibilidade nem abre vendas. A
disponibilidade comercial é uma decisão administrativa separada, conforme
[ADR-0009](../adr/0009-course-availability-and-sale-interest.md).

Módulos e Aulas continuam ligados à publicação que os materializou. Cada Aula também tem uma chave curricular estável: ao clonar uma Aula para uma nova publicação, a chave é preservada e o `lesson_progress` anterior continua valendo; remover a Aula ou criar outra gera efeito no currículo vivo sem apagar histórico. Watch de vídeo só atravessa a troca quando Curso, `curriculum_key`, provedor JMVStream e `video_external_id` coincidem; o servidor projeta retomada, fronteira validada, posição máxima e bloqueio, mas não transfere tempo reproduzido, sessão ou sequência. Link manual sem identificador começa sem watch herdado. Retirar conteúdo numa nova publicação o oculta do currículo vivo, mas não apaga a publicação anterior, progresso, analytics, ativos R2/JMVStream ou auditoria.

Reordenar conteúdo só aceita o conjunto completo de Módulos ou de Aulas dos Módulos afetados na mesma publicação em rascunho. Mover uma Aula entre Módulos renumera origem e destino em uma única transação; IDs de outra publicação ou Curso são rejeitados.

Módulo ativo pode carregar `release_delay_days`. Em Matrícula `scheduled`, o conteúdo fica disponível em `content_release_started_at + N × 24 horas`; a decisão temporal precede a sequência. O overview preserva título, descrição, contagem, duração agregada, data futura e metadados visuais das Aulas, como título, duração, thumbnail e indicação de vídeo, mas não entrega conteúdo rico, player, materiais ou ações. Aulas bloqueadas aparecem como cards e itens de navegação estáticos, sem link ou foco. Matrícula `full_access` e Aula concluída anteriormente atravessam o atraso.

### REG-LEA-002 Progresso é vivo

`getStudentCourseCatalog`, `getStudentCourseOverview`, `getStudentLessonWorkspace` e `completeLesson`, em `src/features/courses/server.ts`, calculam o progresso pelas Aulas obrigatórias ativas da publicação vigente e reconhecem conclusões da mesma chave curricular em publicação anterior. A projeção também preserva a contagem visual de todas as Aulas separada do denominador obrigatório e fornece o progresso de cada Módulo no servidor. Aulas opcionais não entram no denominador. Publicar Aula obrigatória nova pode reduzir o percentual de um Aluno já certificado; o certificado continua histórico e acessível. As experiências correntes usam `courses.title`; snapshots ficam para publicação, histórico e Certificados já emitidos.

### REG-LEA-003 Sequência e conclusão de Aula

`isLessonAvailable`, em `src/features/progress/rules.ts`, libera a Aula concluída e qualquer Aula cuja posição não tenha uma Aula obrigatória anterior pendente; Aulas opcionais anteriores não bloqueiam. A Aula opcional no início também é acessível, e a próxima recomendação é a primeira Aula pendente disponível em ordem, inclusive opcional depois que as obrigatórias terminarem. No encaminhamento automático após uma conclusão, a busca começa à frente da Aula atual; somente ao concluir a última Aula do currículo ela reinicia desde o início para oferecer uma Aula opcional pulada. `completeLesson` é idempotente. O Aluno pode marcar qualquer Aula manualmente, sem visualização mínima. Evento JMVStream reconhecido com fronteira linear em 100% é apenas uma segunda via automática; a duração usada pelo servidor deve corresponder à duração persistida da Aula e eventos desconhecidos são rejeitados. A posição de retomada é separada da maior posição observada. `validated_position_seconds` é uma fronteira linear que não avança por `skip`; `playing_time_seconds` soma reprodução normal, inclusive depois de um `skip`, para analytics. `max_position_seconds` permanece como posição máxima/legado, e registros antigos não são tratados como fronteira validada. O servidor cria uma sessão para cada abertura; a última sessão vence e eventos de sessões antigas são ignorados. Repetições não duplicam `lesson_progress`.

### REG-LEA-004 Conclusão do Curso é histórica

`CourseCompletion` tem unicidade por Aluno e Curso e registra a primeira publicação/data de conclusão. Somente Cursos com pelo menos uma Aula obrigatória entram no fluxo de conclusão e Certificado; nesses Cursos, a conclusão nasce automaticamente quando todas as Aulas obrigatórias vigentes forem concluídas, ou na emissão manual de certificado se ainda não existir. `lesson_progress` registra a origem manual ou automática por vídeo quando conhecida; linhas históricas sem essa informação permanecem desconhecidas. `completeLesson` serializa por Conta e Curso, antes de gravar progresso e calcular o resumo; somente a transação que insere a primeira `CourseCompletion` pode disparar a emissão automática. Uma tentativa concorrente que encontra a conclusão existente não atualiza a linha e não tenta emitir Certificado ou gravar outbox. Revogar ou reemitir certificado não a apaga nem a reabre. Não existe ação administrativa separada para marcar conclusão. Conclusões históricas sem Certificado só entram no fluxo por reconciliação confirmada de Admin, em lote limitado; não há backfill silencioso.

### REG-LEA-004A Carga horária exibida

O valor exibido no catálogo, na experiência do Aluno e no certificado é a
carga horária efetiva do Curso. Sem override, ela é derivada pela soma das
durações das Aulas da publicação e atualizada quando o conteúdo muda. Um
administrador pode informar `courses.workload_hours_override` nas
configurações do Curso para exibir outro total inteiro não negativo. Remover o
valor manual retorna ao cálculo automático. Certificados já emitidos preservam
o snapshot anterior. A mutação de conteúdo e o recálculo do snapshot do draft e
da carga efetiva usam o mesmo lock de liberação e a mesma transação; chamadas
isoladas de recálculo também devem usar o wrapper transacional. Alterar ou
remover o override recalcula a projeção efetiva; leituras do catálogo e do Curso
usam o override ou o snapshot da publicação vigente, sem tratar a duração do
conteúdo como carga oficial.

### REG-LEA-005 Mídia e histórico

Vídeo usa JMVStream; capa, banner e materiais usam R2. Um ativo R2 referenciado por publicação `published` ou `retired` permanece protegido. Ver [JMVStream](../integrations/jmvstream.md) e [R2](../integrations/r2.md).

## Analytics de aprendizagem

Analytics é minimizado, habilitado por padrão e pode ser desligado em **Conta > Configurações**. Não altera acesso, sequência, progresso, conclusão ou certificado. O servidor deriva Matrícula, Aula e `CoursePublication`; o cliente não escolhe a identidade do evento. Eventos e métricas preservam a publicação para auditoria e comparação histórica, enquanto as consultas de elegibilidade usam a publicação vigente.

O painel administrativo permite selecionar um Curso e um período de 1, 3, 6 ou 12 meses. Para o Curso escolhido, a tabela mostra uma linha por Aula da publicação vigente, na ordem do Curso; as contagens de início, conclusão e falha somam todas as versões da mesma chave curricular, checkpoint e tempos de calendário são recalculados sobre os registros disponíveis das versões, e o tempo reproduzido total soma a reprodução normal registrada no período. O KPI de visualização média do Curso calcula, para cada Matrícula ativa com analytics habilitado, a média da fronteira linear validada registrada em cada Aula ativa; uma Aula concluída vale 100% e uma Aula sem registro vale 0%, inclusive quando o registro veio de uma versão anterior da mesma Aula. Matrículas ativas representam a fotografia atual do Curso e não são somadas entre versões. As versões históricas ficam disponíveis nos detalhes, e os KPIs e a exportação CSV ficam limitados ao Curso e período selecionados. Não exibe Aluno, Conta, e-mail, inatividade ou automação de reengajamento.

## Evidências

- schema: `coursePublications`, `courseCompletions`, `modules`, `lessons`, `enrollments`, `certificates` em `src/db/schema.ts`;
- autoria: `createCoursePublicationDraft` e `publishCoursePublication` em `src/features/admin/authoring.ts`;
- leitura/progresso: `src/features/courses/server.ts`;
- analytics: `src/features/learning-analytics/server.ts`;
- migration: `src/db/migrations/0035_course_publications_and_completions.sql`.

## Pendências

- não há coortes ou drip: só serão criados diante de calendário/grupo real;
- a migration 0035 precisa ser validada em banco descartável antes de promoção compartilhada;
- o racional histórico de 260 palavras/minuto para leitura não foi localizado.
