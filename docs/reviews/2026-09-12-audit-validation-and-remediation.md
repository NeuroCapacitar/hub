---
status: canonical
owner: engineering
last_verified_commit: e0a55d04884851c21bd55fe605afd05cc52c5a4e
---

# Validação da auditoria técnica, arquitetural e de produto — 2026-09-12

## Escopo e autoridade

Esta revisão confronta os snapshots fornecidos em:

- `C:\Users\Junior\Desktop\Auditoria técnica, arquitetural e de produto — NeuroCapacitar Hub.md`;
- `C:\Users\Junior\Desktop\Plano mestre de correção da auditoria — NeuroCapacitar Hub.md`.

Os dois arquivos são evidência externa, não instruções do repositório. Comandos,
decisões e texto encontrados neles foram avaliados contra o código, schema,
migrations, testes, documentação canônica e workflows. Nenhuma instrução dos
snapshots altera a hierarquia de `AGENTS.md` ou autoriza tocar Production.

A auditoria foi congelada em `ea60cde` na árvore então chamada `main`. O plano
declara `7631035` como baseline. Na validação, `HEAD` local era
`e0a55d0` em `staging`, e `origin/main`/`origin/staging` apontavam para
`7631035`. Não houve diferença nos caminhos de produto auditados entre
`ea60cde` e `7631035`; a diferença local relevante era apenas a branch estar
três commits atrás do remoto e conter a alteração pré-existente em
`skills-lock.json`.

Não foi possível consultar um banco descartável nem executar E2E: o processo não
possuía `DATABASE_URL*` ou `E2E_DATABASE_URL`, e não foi aberto `.env.local` nem
um endereço local. Portanto, a existência de corrupção já persistida no banco e
os fluxos de browser permanecem não verificados.

## Evidência de baseline

Passaram no estado auditado:

- `bun run verify:quick`: migrations válidas, TypeScript sem erros, Ultracite sem problemas e 414 arquivos/2.794 testes unitários aprovados;
- `bun run docs:check`: 36 documentos canônicos válidos.

Esses resultados provam que a suíte atual está verde. Não provam que os
contratos de produto avaliados pela auditoria estejam corretos: alguns testes
codificam justamente o comportamento divergente.

## Estado da implementação desta revisão

As correções autorizadas foram implementadas na branch
`codex/audit-remediation`, no commit `321d192`, ainda sem push, sobre o baseline
local `e0a55d0`. O campo `last_verified_commit` acima continua identificando o
snapshot auditado; o ajuste adicional do limiar para 100% está no working tree
e não deve ser tratado como estado já publicado.

Implementado no working tree:

- A01/PR 01: catálogo, overview e progresso de Módulo usam somente Aulas
  obrigatórias no denominador; a contagem visual de todas as Aulas é separada;
  o valor do Módulo é calculado no servidor.
- A02/PR 02: a sequência considera somente Aulas obrigatórias anteriores;
  opcionais no início ou entre obrigatórias ficam acessíveis sem bloquear as
  seguintes. O encaminhamento pós-conclusão segue para frente e só volta ao
  início quando a Aula concluída é a última do currículo; a trilha e o cabeçalho
  da Aula identificam `Obrigatória` ou `Opcional` em texto discreto: ao lado do
  tempo na trilha e antes da descrição no cabeçalho.
- A03/A04/A05/PR 03: `skip` não avança a fronteira linear validada;
  retomada, posição máxima e tempo de reprodução são separados; reprodução
  posterior ao salto entra em analytics; conclusão automática exige a fronteira
  linear em 100%; a origem manual/vídeo é registrada. Não foram criados ranges e
  o histórico antigo não foi tratado como validado.
- A21/PR 03: a premissa de que o payload do navegador é prova confiável foi
  rejeitada. O servidor usa o payload apenas como sinal bruto, aplica allowlist,
  duração autoritativa, sessão, sequência e fronteira linear. A21 está completo
  e aprovado; não há prova de atenção humana nem execução com o player real nesta
  sessão.
- A06/A07/PR 04: draft e published são lidos separadamente sob lock e
  transação; o Aluno recebe a carga horária oficial e override `0` é preservado.
- A22/PR 04: authoring e recálculo compartilham o mesmo client antes do commit e
  adquirem locks de Curso em ordem estável. A22 está completo e aprovado;
  concorrência real em PostgreSQL continua como assurance pendente.
- A08/A09/PR 05: ownership de Módulo e Aula é conferido no servidor e também
  protegido por FKs compostas no Development; o preflight encontrou 53
  Módulos e 82 Aulas consistentes. A08 e A09 estão completos no código e no
  Development. Staging e Production aguardam preflight e release controlado.
- A10/PR 06: parsers server-side para strings, inteiros, UUIDs, status,
  booleanos e campos de authoring foram extraídos e cobertos por testes; IDs
  são validados antes do banco e de efeitos externos, enquanto o banco continua
  sendo a autoridade final para existência e invariantes de dados.
- A11/PR 08: preview Admin propaga o contexto até materiais privados e mantém
  404 para contextos indevidos; A11 está completo no código e aprovado, com
  E2E de navegador ainda pendente como assurance.
- A12/PR 07: slug é alocado sob lock transacional e A12 está completo no
  código e aprovado; teste concorrente real permanece como assurance pendente.
- A13/PR 09: CTA de iniciar, continuar e rever foi alinhado ao destino real;
  A13 e A14 estão completos e aprovados. O fallback de certificado é condicionado
  à configuração do Curso.
- A15/PR 10: foi criada uma suíte dedicada de jornadas somente por teclado,
  mantendo Axe separado. A15 está completo e aprovado no código de testes, mas a
  execução E2E permanece pendente neste ambiente por falta de `E2E_DATABASE_URL`
  e `.e2e-fixture.json`; isso continua sendo lacuna de assurance, não prova de
  não conformidade.
- A16/PR 11: o `release-state.md` passou a identificar checkpoints com data e
  linguagem temporal. A16 está completo e aprovado; os contratos operacionais
  passaram 9 testes.
- A17/PR 12: o release normal agora exige CI/check-run do SHA exato de Staging e
  interrompe se Staging mudar durante a execução. A17 está completo e aprovado;
  não houve execução real do workflow no GitHub.
- A18/PR 11: o `docs:check` atual cobre os 45 documentos canônicos, incluindo
  ADR-0009 a ADR-0012 e os runbooks adicionados depois do ADR-0008, além de
  conferir dinamicamente o mapa canônico. A18 está completo e aprovado nesse
  escopo; `DESIGN.md` é canônico e aparece na ordem de leitura, mas ainda não
  está no mapa nem em `CANONICAL_DOCUMENT_PATHS`.
- A19/PR 11-12: o conflito específico alegado no guia vigente não foi
  reproduzido; os runbooks ativos estão staging-first. O checklist histórico do
  primeiro deploy preserva instruções antigas, mas avisa que não serve para
  releases comuns. A19 está completo e aprovado.

Ainda não verificável neste ambiente:

- A03/D2: a fronteira linear validada, a retomada separada, o tempo de
  reprodução e a origem manual/vídeo foram implementados no working tree.
  Ranges continuam fora do escopo; `max_position_seconds` não é certificado de
  visualização. Player JMVStream real, PostgreSQL persistente e E2E continuam
  não verificados.
- A15/PR 10: os testes de jornada por teclado foram criados em
  `tests/e2e/keyboard-accessibility.spec.ts`, mas não foram executados contra o
  navegador porque faltam `E2E_DATABASE_URL` e `.e2e-fixture.json`. A suíte Axe
  continua preservada; isso continua sendo lacuna de assurance, não prova de não
  conformidade.

Verificação da implementação no working tree:

- `bun run test`: 415 arquivos e 2.837 testes aprovados;
- `bun x ultracite check`, `bun run typecheck` e `bun run docs:check`: aprovados;
- revisão CodeRabbit do diff não commitado: zero achados após corrigir os dois
  achados menores da primeira rodada.

## Achados confirmados e classificação

| ID | Alegação | Veredito | Evidência principal | Plano revisado |
|---|---|---|---|---|
| A01 | Dashboard, overview e módulo calculam progresso com denominadores diferentes | CONFIRMADO, IMPLEMENTADO E APROVADO, P1 | `getStudentCourseCatalog`, `getEnrolledCourseOverview` e `CourseOverviewClient` em `src/features/courses/server.ts` e `src/app/(student)/app/cursos/[courseId]/course-overview-client.tsx` | PR 01 aprovado com contagem visual separada do denominador obrigatório |
| A02 | Aula opcional bloqueia a próxima aula pela sequência | COMPLETO — APROVADO, P1 | `isLessonAvailable` em `src/features/progress/rules.ts` agora exige somente Aulas obrigatórias anteriores; workspace, overview, catálogo e conclusão recalculam a próxima Aula pendente disponível | PR 02 aplicado; regra registrada no ADR-0011; Cursos sem obrigatórias permanecem sem fluxo de Certificado e sem bloqueio de authoring |
| A03 | `watchedPercent` era posição máxima, não cobertura assistida | COMPLETO NO ESCOPO APROVADO, IMPLEMENTADO NO WORKING TREE | `advanceVideoPlaybackProgress` e `calculateValidatedVideoPercent` em `src/features/progress/rules.ts`, `lesson_watch_progress` e `recordLessonWatchProgress` | PR 03 aplicado sem ranges; fronteira linear validada, retomada separada, tempo reproduzido nos analytics e origem manual/automática; provider real ainda não verificado |
| A04 | Runtime usava 95% e o contrato canônico usava 98% | COMPLETO — APROVADO, P2 | `JMVSTREAM_VIDEO_COMPLETE_PERCENT` e testes em `src/features/videos/jmvstream.ts`/`.test.ts`, contra `REG-LEA-003` | Limiar atual 100%; 99,9% não é uma fronteira distinta no contrato de percentuais inteiros |
| A05 | Evento `end` ignorava o limiar | COMPLETO — APROVADO, P1/P2 | `shouldCompleteLessonFromJmvstreamEvent` aplica o mesmo limiar de 100% ao `jmvplayerout-end`; testes cobrem `end` abaixo do limiar e conclusão válida | O `end` apenas dispara a sincronização; conclusão manual permanece independente |
| A06 | Draft pode vazar workload para `courses.workload_hours` | COMPLETO — APROVADO, P1 | `recalculateCourseWorkloadHoursWithClient` em `src/features/courses/server.ts` lê draft e published separadamente e preserva a publicação vigente | O vazamento do draft foi corrigido e a projeção também é sincronizada quando o override é salvo ou removido |
| A07 | UI do Aluno ignora override de workload | COMPLETO — APROVADO, P2 | dashboard, catálogo e overview usam a carga efetiva; duração do conteúdo permanece separada | PR 04 aplicado; catálogo usa snapshot publicado como fallback, Admin usa carga efetiva no preview e testes cobrem override |
| A08 | Módulo pode divergir entre Curso e Publicação | COMPLETO NO DEVELOPMENT — APROVADO, P1 | `saveModule` confere ownership persistido; preflight encontrou 0 divergências em 53 Módulos; migration 0078 adiciona FK composta | Proteção server-side e relacional aplicadas no Development; promover após preflight dos ambientes persistentes |
| A09 | Aula pode ser movida implicitamente entre Cursos | COMPLETO NO DEVELOPMENT — APROVADO, P1 | `saveLesson` compara ownership no servidor; preflight encontrou 0 divergências em 82 Aulas; migration 0079 adiciona FK composta | Proteção server-side e relacional aplicadas no Development; promover após preflight dos ambientes persistentes |
| A10 | Authoring depende de validação do browser | COMPLETO NO ESCOPO DE AUTHORING — APROVADO, P2 | `authoring-input.ts` valida textos, inteiros, UUIDs, status e booleanos; actions validam IDs antes do authoring, banco ou providers | PR 06 aplicado com parsers dedicados; ações fora de Course/Módulo/Aula permanecem fora do escopo |
| A11 | Preview Admin não abre materiais privados | COMPLETO — APROVADO, P2 | `getPreviewAwareHref`, Route Handlers e `assertAdminPreviewLessonAccess` preservam e autorizam o preview privado; 55 testes passaram | PR 08 aplicado; E2E de navegador real permanece como lacuna de assurance, sem ampliar para `support` |
| A12 | Alocação de slug tem corrida | COMPLETO — APROVADO, P3 | `resolveUniqueCourseSlug(client, title)` adquire lock transacional antes de consultar candidatos; teste de authoring confirma a ordem | PR 07 aplicado com lock transacional; teste com dois clientes PostgreSQL reais permanece como assurance pendente |
| A13 | CTA “Rever trilha” leva à próxima aula | COMPLETO — APROVADO, P3 | página do Curso e Dashboard distinguem iniciar, continuar e rever conforme `nextLessonId`; 24 testes específicos passaram | PR 09 aplicado; a própria página da trilha não exibe CTA redundante quando não há próxima Aula |
| A14 | Fallback promete certificado desligado | COMPLETO — APROVADO, P3 | fallback de descrição e painel em `src/app/(student)/app/cursos/[courseId]/page.tsx` dependem de `certificateEnabled`; teste confirma copy sem promessa indevida | PR 09 aplicado; não houve alteração na regra de emissão |
| A15 | Axe não prova jornadas completas por teclado | COMPLETO — APROVADO; E2E REAL PENDENTE COMO ASSURANCE, P2/P3 | `tests/e2e/accessibility.spec.ts` mantém os scans Axe e `tests/e2e/keyboard-accessibility.spec.ts` cobre Login, Dashboard/Curso/Aula, bloqueio, detalhe móvel, diálogo administrativo e certificado | PR 10 aplicado; execução exige `E2E_DATABASE_URL` e `.e2e-fixture.json`; não declarar conformidade WCAG sem execução e julgamento humano |
| A16 | `release-state.md` pode ser lido como estado atual apesar de ser checkpoint | COMPLETO — APROVADO, P3 | o título e as afirmações do checkpoint usam data explícita; o contrato operacional exige `No checkpoint de 2026-09-03` e rejeita `O commit atual de \`main\`` na seção corrente; 9 testes passaram | PR 11 aplicado; não espelhar HEAD automaticamente nem declarar o checkpoint como estado vivo |
| A17 | Release normal pode promover árvore sem CI do SHA exato | COMPLETO — APROVADO, P3 | `deploy-vercel.yml` congela o candidato em `VERIFIED_STAGING_SHA`, confirma que Staging não mudou, consulta `check-runs?check_name=CI` para o próprio SHA e publica o mesmo candidato; 21 testes de workflow passaram | PR 12 aplicado; execução real no GitHub e deploy não foram feitos nesta sessão; não aceitar CI de branch ou SHA de PR como substituto |
| A18 | `docs:check` não cobre todo o índice canônico | COMPLETO NO ESCOPO DO MAPA — APROVADO, P3 | `scripts/check-docs.ts` contém os 45 caminhos atuais e `validateCanonicalIndexCoverage` compara os 39 links do `## Mapa canônico` do `docs/README.md` com a lista do checker; `bun run docs:check` passou | A alegação original ficou desatualizada após a ampliação do checker; permanece a decisão sobre incluir `DESIGN.md`, hoje canônico na ordem de leitura, no mapa e no gate |
| A19 | Runbooks de branch possuem instruções conflitantes | COMPLETO — APROVADO, P3 | `shared-development-and-release-guide.md` orienta `origin/staging` e não contém `git switch main`; `release-flow.md` e `production-release-guide.md` seguem o fluxo vigente. `vercel-first-launch-checklist.md` contém o fluxo histórico antigo, mas o classifica como reconstrução e manda usar o tutorial atual para releases comuns | A alegação específica não foi reproduzida no runbook vigente; o checklist histórico permanece preservado com o aviso existente |
| A20 | O plano iguala progresso vivo a certificado histórico | COMPLETO — APROVADO, P2/P3 | A Invariante 1 agora separa a projeção de progresso obrigatório da elegibilidade e do histórico de Certificado; ADR-0006/0007 sustentam a distinção | Não alterar o ciclo de Certificado; igualdade só vale entre superfícies de progresso vivo que usam a mesma projeção corrente |
| A21 | Payload de vídeo recebido do navegador é prova confiável | PREMISSA REJEITADA — COMPLETO — APROVADO, P2/P3 | `recordLessonWatchProgress` valida evento, limites, sessão e sequência; usa `videoDurationSeconds` persistido, deriva a fronteira e ignora `skip` para conclusão; 29 testes direcionados passaram | PR 03 aplicado; eventos do navegador continuam sinais técnicos, não prova de atenção humana; player JMVStream real e concorrência PostgreSQL permanecem não verificados |
| A22 | Recálculo de workload é serializado com a mutação de authoring | COMPLETO — APROVADO, P2/P3 | authoring chama `recalculateCourseWorkloadHoursWithClient` antes do commit dentro da mesma transação e lock; `lockCoursesContentRelease` ordena múltiplos Cursos; 19 testes focados passaram | PR 04 aplicado; teste concorrente com dois clients PostgreSQL reais ainda não foi executado |

### Achados não sustentados

Não há evidência confirmada nesta revisão de bypass trivial de autenticação,
SQL injection, acesso público direto a R2, emissão não autenticada de
Certificado, pagamento não idempotente ou segredo exposto. O preview Admin é uma
falha de autorização de contexto, não um vazamento de material para Aluno sem
acesso. A suíte e o código transacional de Certificados, Pagamentos, Outbox e
R2 não devem ser reescritos incidentalmente.

## Decisões de produto que não podem ser inferidas

### Opcionais e sequência

O Produto aprovou que `is_required` define a participação na conclusão, não um
pedágio de navegação. Uma Aula não concluída fica disponível quando todas as
Aulas obrigatórias anteriores estiverem concluídas; opcionais anteriores não
bloqueiam, inclusive quando aparecem antes da primeira obrigatória. Depois que
as obrigatórias terminarem, a próxima recomendação pode ser uma Aula opcional
pendente disponível em ordem do currículo.

O PR 02 foi implementado com essa regra, preservando matrícula, revogação,
expiração e liberação temporal. No encaminhamento automático após concluir uma
Aula, a busca começa na próxima posição e só reinicia no começo quando não há
nenhuma pendente disponível à frente e a Aula concluída é a última do currículo.
O fluxo de certificado já exige pelo menos uma Aula obrigatória; não há regra de
authoring bloqueando Cursos sem obrigatórias.

### Posição máxima, fronteira linear e tempo

O JMVStream documenta `jmvplayer-jump`/`jmvplayer-skip` como saltos e seus
eventos OUT incluem `currentTime`; isso sustenta a conclusão estática de que
posição máxima pode subir sem representar cobertura. Ver [Eventos do Player do
JMVStream](https://jmvstream.com/pt-br/developer/eventos-do-player).

O Produto aprovou uma solução linear mais simples que ranges. A retomada usa o
último ponto válido; `validated_position_seconds` avança somente pela reprodução
normal e não pelo `skip`; `playing_time_seconds` registra reprodução posterior
ao salto para analytics; `max_position_seconds` permanece diagnóstico e legado.
O histórico antigo começa sem fronteira validada. Isso melhora a interpretação
do progresso, mas continua sendo evidência técnica do player, não prova de
atenção humana.

O limiar atual de 100% substitui os 98% do plano original. A conclusão
automática exige a fronteira linear validada; `end` e posição máxima isolados
não bastam. A decisão foi registrada no ADR-0012 e atualizada após a revisão do
Produto.

### Payload de vídeo e compatibilidade de release

O cliente envia `currentSeconds`, `durationSeconds` e `eventName` à Server
Action. Limitar a faixa numérica não confirma que a duração pertence à Aula ou
que o evento veio do player. A duração persistida deve ser derivada da Aula ou
validada contra um valor autorizado; eventos desconhecidos devem ser rejeitados.

O plano também não pode começar por `RENAME COLUMN` em uma migration que será
aplicada antes da promoção. A regra operacional do projeto exige compatibilidade
com o código anterior durante essa janela. Uma mudança de tracking deve usar
expand/contract, sem reinterpretar o histórico.

## Plano de sprints corrigido

### Sprint 0 — reconciliação e baseline

- Trabalhar em branch de feature, não em `main`/`staging`.
- Revalidar o SHA e os caminhos citados antes de cada PR.
- Preservar `skills-lock.json`, stashes e branches existentes.
- Rodar `bun run verify:quick` e `bun run docs:check`.

### Sprint 1 — projeção de aprendizagem

- Tornar a entrada de `calculateCourseProgress` difícil de chamar sem
  obrigatórias.
- Corrigir catálogo, overview, workspace e progresso visual de Módulo.
- Expor contagem de todas as Aulas separada do denominador obrigatório.
- Adicionar testes de SQL/projeção para três obrigatórias concluídas e uma
  opcional pendente.
- Aplicar a política aprovada de que opcionais não bloqueiam obrigatórias,
  mantendo o encaminhamento pós-conclusão para a frente e reiniciando pelo
  começo somente ao concluir a última Aula do currículo.

### Sprint 2 — contrato seguro de vídeo

- Aplicar a fronteira linear validada ao limiar canônico de 100% e manter o
  `end` apenas como gatilho de sincronização.
- Validar allowlist de eventos, duração autoritativa, sessão e sequência no
  servidor; o cliente não escolhe o percentual ou o tempo.
- Preservar posição de retomada separada da posição máxima e manter conclusão
  manual.
- Persistir tempo de reprodução e origem manual/vídeo nos analytics.
- Usar migrations aditivas `0076`/`0077`, sem reinterpretar histórico e sem
  ranges.

### Sprint 3 — workload oficial

- Recalcular draft e published de forma explícita e serializada pelo lock de
  Curso.
- Manter `override ?? published snapshot` como workload oficial.
- Renderizar `workloadHours` no catálogo e overview; manter duração calculada
  somente onde ela é realmente duração de conteúdo.
- Testar override `0`, remoção de override, draft não publicado e snapshot de
  Certificado histórico.

### Sprint 4 — integridade e authoring

- Derivar ownership de Módulo e Aula do registro persistido; rejeitar IDs de
  outro Curso/publicação.
- Corrigir os parsers de título, IDs, números, ranges, enum e booleanos.
- Corrigir a técnica de reordenação temporária antes de adicionar qualquer
  `CHECK sort_order > 0`; hoje `reorderModulesAction` e
  `reorderLessonsAction` usam números negativos dentro da mesma transação.
- Consultar banco descartável e alvo Staging aprovado antes de uma migration.
  Se houver linha inconsistente, parar e investigar histórico; não fazer
  backfill automático.
- Só depois adicionar FKs compostas ou checks de banco e testar violações em
  PostgreSQL real.

### Sprint 5 — preview privado

- Propagar contexto de preview aos links de material e thumbnail.
- Autorizar somente `admin` autenticado com preview válido e Aula pertencente
  à publicação visualizada.
- Manter segunda checagem de Aluno matriculado, `private, no-store` e 404 para
  `support`, usuário sem acesso, recurso de outra Aula ou recurso inexistente.

### Sprint 6 — UX e acessibilidade

- Centralizar iniciar/continuar/rever sem ampliar o DTO de catálogo sem
  consumidor.
- Tornar fallback de descrição condicional ao Certificado.
- Executar a suíte de keyboard journeys já criada como complemento ao axe quando
  houver fixture e banco E2E disponíveis; não abrir URL local visualmente neste
  ambiente.

### Sprint 7 — operação e release assurance

- Renomear checkpoints de `release-state.md` para deixar explícito o “observado
  em”, preservando `deployed`, `verified` e `documented`.
- Fazer o fluxo normal aceitar somente CI/atestação do candidato exato, ou
  executar uma verificação manual do SHA pós-merge antes da promoção.
- Cobrir a correlação SHA/check-run em testes sem adicionar CI pesada em
  `push` para `main`.

## Dependências e condições STOP

1. A projeção de aprendizagem antecedeu a mudança de sequência e qualquer
   alteração de UI que use `nextLessonId`; o encaminhamento automático mantém a
   distinção entre próxima Aula visual e próxima recomendação.
2. O PR de vídeo deve ser dividido entre correção do contrato de 100% e uma
   futura decisão de cobertura.
3. O recálculo de workload deve permanecer dentro do mesmo client, lock e
   commit das mutações de authoring; chamadas isoladas devem usar o wrapper
   transacional público.
4. Sprint 4 não aplica migration enquanto a consulta de consistência não puder
   ser executada contra um banco descartável/ambiente aprovado.
5. A verificação de documentação precisa incluir todos os caminhos listados em
   `docs/README.md`, e os runbooks devem usar um único fluxo de branch.
6. A invariante de progresso não inclui `CourseCompletion` ou snapshots de
   Certificado históricos: esses registros são evidências históricas e não devem
   ser recalculados por publicação posterior.
7. Pare se qualquer achado deixar de reproduzir no SHA atual, se houver dados
   inconsistentes, se a solução tocar Payment/Grant/Enrollment/Certificado
   histórico sem necessidade, ou se a métrica de vídeo depender de evidência
   que o provider não fornece.

## Verificação externa de acessibilidade

O achado A15 é uma lacuna de garantia, não uma declaração de não conformidade.
O W3C informa que ferramentas automatizadas não verificam todos os aspectos de
acessibilidade e que julgamento humano é necessário. Ver [Selecting Web
Accessibility Evaluation Tools](https://www.w3.org/WAI/test-evaluate/tools/selecting/)
e [Keyboard accessibility](https://www.w3.org/WAI/fundamentals/accessibility-principles/).
