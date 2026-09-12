---
status: canonical
owner: engineering
last_verified_commit: e0a55d04884851c21bd55fe605afd05cc52c5a4e
---

# Plano mestre de correção da auditoria
## NeuroCapacitar Hub

**Repositório:** `NeuroCapacitar/hub`  
**Baseline do plano:** `763103546139e5663c4203943830d290347aff4f`  
**Branch base normal:** `staging`  
**Objetivo:** corrigir integralmente os problemas confirmados na auditoria técnica sem introduzir regressões em acesso, certificado, pagamento, publicação, histórico ou experiência do aluno.

---

> **Cópia anotada do plano mestre — 12/09/2026.**
>
> O texto do plano mestre foi preservado como base. As notas inseridas abaixo de cada problema, decisão ou bloco de solução registram o que foi confirmado, implementado, alterado ou bloqueado nesta revisão.
>
> Esta cópia descreve o working tree da branch `codex/audit-remediation`; não representa commit, deploy ou estado publicado.

# 1. Objetivo deste documento

Este documento deve ser utilizável por:

- desenvolvedor pleno/sênior;
- estagiário acompanhado;
- agente de IA de implementação;
- reviewer;
- QA.

Não é uma lista resumida de tarefas.

Para cada problema, o plano informa:

1. como confirmar que o erro existe;
2. qual é a regra correta;
3. por que o erro acontece;
4. quais arquivos precisam ser inspecionados;
5. quais arquivos provavelmente serão alterados;
6. como implementar;
7. o que **não** alterar;
8. quais testes escrever antes/depois;
9. como confirmar que a correção realmente resolveu o problema;
10. quais regressões devem ser procuradas;
11. quando interromper a implementação e pedir revisão.

---

> **Relatório de implementação — status: cumprido como documentação.**
>
> **Feito:** Foi criado este documento centralizado, mantendo o plano original e anexando o resultado da implementação no ponto correspondente.
>
> **Não feito:** O arquivo original do Desktop não foi alterado e esta cópia não autoriza mudanças em Production.
>
> **Diferença/motivo:** O plano continua sendo uma referência operacional; fatos do repositório, ADRs, schema, testes e estado do working tree prevalecem.
>
> **Verificação:** O documento foi adicionado ao índice canônico e `bun run docs:check` foi executado ao final.

# 2. Decisões de produto assumidas pelo plano

Estas decisões são necessárias para não deixar comportamento implícito.

## D1. Aula opcional

Uma aula com:

```text
is_required = false
```

não deve:

- entrar no percentual obrigatório do curso;
- impedir 100% de conclusão;
- impedir certificado;
- bloquear a próxima aula obrigatória.

Ela pode continuar visível e acessível quando os pré-requisitos obrigatórios anteriores tiverem sido cumpridos.

> **Relatório de implementação — status: aprovado e implementado.**
>
> **Feito:** Foi corrigido o denominador de progresso e a regra de sequência: somente obrigatórias anteriores formam pré-requisito; opcionais anteriores não bloqueiam.
>
> **Não feito:** Não foi criada uma barreira de authoring para exigir Aula obrigatória em todo Curso.
>
> **Diferença/motivo:** A regra foi aprovada pelo Produto nesta revisão e registrada no ADR-0011; a política de Curso sem obrigatórias ficou isolada para não misturar duas decisões.
>
> **Verificação:** Testes de regras, workspace, overview, conclusão e próxima recomendação passaram.

### Exemplo

```text
A obrigatória ✓
B opcional     ✗
C obrigatória  ✗
```

Depois de concluir A:

```text
B = acessível
C = acessível
```

B é conteúdo opcional, não um pedágio para chegar a C.

---

## D2. Conclusão automática por vídeo

Conclusão manual continua permitida.

A conclusão automática por vídeo deve usar:

```text
fronteira linear validada = 100%
```

e não:

```text
maior posição alcançada = 100%
```

O plano original usava 98%. Após a revisão do Produto, o valor atual é 100%: o contrato de percentuais inteiros não dá a 99,9% um comportamento distinto e previsível.

Se futuramente produto decidir 95%, deve mudar **código + testes + documentação na mesma alteração**.

---

> **Relatório de implementação — status: COMPLETO no escopo aprovado; implementado no working tree.**
>
> **Feito:** O limiar atual é 100%, eventos desconhecidos são rejeitados, `end` não ignora o limiar e a conclusão usa a fronteira linear validada.
>
> **Não feito:** Não foi criada cobertura por intervalos, conforme decisão do Produto; a migração não transforma o histórico antigo em progresso validado.
>
> **Diferença/motivo:** O Produto aprovou fronteira linear para manter o Hub simples; a posição máxima continua disponível para diagnóstico, mas não é usada para conclusão automática.
>
> **Verificação:** Testes unitários, SQL e suíte completa cobrem 100%, 99%, `end`, `skip`, evento inválido e a fronteira linear.

## D3. Carga horária

Existem dois conceitos diferentes:

### Carga horária oficial

É:

```text
courses.workload_hours_override
    ??
publicação publicada.workload_hours_snapshot
```

É o valor usado em:

- catálogo;
- dashboard do aluno;
- página do curso;
- certificado;
- comunicação oficial de carga horária.

### Duração calculada dos conteúdos

É:

```text
soma das durações de vídeo/texto
```

Pode aparecer como informação complementar, mas não deve ser apresentada como a carga horária oficial quando existe override.

---

> **Relatório de implementação — status: COMPLETO — APROVADO.**
>
> **Feito:** A aplicação passou a separar carga horária oficial (`override ?? publicação publicada`) da duração calculada pela soma dos conteúdos; dashboard, catálogo e overview usam o workload oficial. Salvar ou remover o override também recalcula a projeção no mesmo lock e transação da alteração.
>
> **Não feito:** Certificados históricos não foram recalculados e a duração calculada não foi removida das superfícies em que ainda representa conteúdo.
>
> **Diferença/motivo:** O draft é recalculado para manter seu snapshot, mas não substitui a publicação vigente enquanto houver uma publicação publicada. A prévia administrativa usa a carga efetiva, enquanto a duração real do conteúdo continua sendo exibida separadamente.
>
> **Verificação:** Testes SQL, apresentação, dashboard, página de Curso, typecheck, Ultracite, `docs:check` e revisão CodeRabbit passaram; permanecem apenas dois testes temporais preexistentes fora deste escopo.

## D4. CI

Não adicionar CI completa em `push` para `main`.

Preservar:

```text
feature/fix → staging → SHA com CI → homologação → fast-forward → main
```

O trabalho relacionado a CI deve garantir que o SHA promovido continue sendo exatamente o SHA testado.

---

> **Relatório de implementação — status: implementado.**
>
> **Feito:** O release normal, migrations de Development, cleanup de Production e hotfix exigem check-run CI concluído para o SHA exato que será usado.
>
> **Não feito:** Não foi adicionada CI completa em `push` para `main`, nem foi executado release real.
>
> **Diferença/motivo:** O fallback que aceitava CI do SHA da PR foi removido porque a árvore promovida pode ser diferente do SHA testado.
>
> **Verificação:** Testes de workflows e contrato Vercel passaram.

# 3. Regra fundamental de execução

Não implementar tudo em um PR gigante.

A sequência recomendada é:

```text
PR 01 — verdade única de progresso
PR 02 — progressão e aulas opcionais
PR 03 — tracking real de vídeo
PR 04 — carga horária e draft/publicado
PR 05 — integridade relacional
PR 06 — validação server-side
PR 07 — concorrência de slug
PR 08 — preview administrativo de materiais
PR 09 — refinamentos de UX/copy
PR 10 — acessibilidade por teclado
PR 11 — release-state
PR 12 — hardening do contrato de CI/release
PR 13 — revisão transversal final
```

A separação importa porque, se algo der errado, é possível descobrir qual mudança alterou o comportamento.

---

> **Relatório de implementação — status: aplicado com ressalva.**
>
> **Feito:** A sequência de dependências foi respeitada: projeção antes de UI, workload antes de constraints e decisão de produto antes da sequência.
>
> **Não feito:** Não foi possível executar o fluxo de atualização/pull indicado porque havia alterações e stashes pré-existentes a preservar.
>
> **Diferença/motivo:** Foi preferível preservar o estado do usuário e validar drift dos caminhos auditados em vez de sobrescrever mudanças existentes.
>
> **Verificação:** O baseline local foi comparado com `ea60cde` e `7631035`; não havia diferença relevante nos caminhos auditados.

# 4. Preparação obrigatória antes de qualquer código

> **Relatório de implementação — status: parcial.**
>
> **Feito:** Branch, SHA, estado Git e baseline foram registrados; o relatório documenta as limitações ambientais.
>
> **Não feito:** Não houve banco descartável, E2E, build completo ou validação de deploy.
>
> **Diferença/motivo:** O ambiente não tinha `DATABASE_URL*`, `E2E_DATABASE_URL` nem Docker disponível; `.env.local` não foi aberto nem exposto.
>
> **Verificação:** Baseline inicial: 414 arquivos/2.794 testes; validação final: `bun run verify:quick` aprovado.

## 4.1 Atualizar a branch

O fluxo normal do projeto usa `staging`.

Antes de começar:

```bash
git fetch origin
git switch staging
git pull --ff-only origin staging
git status
```

O diretório deve estar limpo.

Criar branch específica, por exemplo:

```bash
git switch -c fix/learning-domain-consistency
```

Não trabalhar diretamente em:

```text
main
staging
```

---

## 4.2 Registrar o SHA real utilizado

Executar:

```bash
git rev-parse HEAD
```

Colocar esse SHA na descrição do PR.

Se ele for diferente do baseline deste documento, executar um drift check nos arquivos citados antes de alterar qualquer coisa.

---

## 4.3 Rodar baseline

Antes da primeira modificação:

```bash
bun install --frozen-lockfile
bun run verify:quick
```

Para PRs maiores ou antes de considerar a tarefa pronta:

```bash
bun run verify
```

Se a baseline já estiver quebrada:

**não consertar incidentalmente dentro deste trabalho.**

Registrar a falha existente separadamente.

---

# 5. PR 01 — Criar uma única verdade de progresso

## Problema

Dashboard, página do curso e módulos podem apresentar percentuais diferentes porque nem todos usam `is_required`.

---

> **Relatório de implementação — status: aprovado pelo usuário.**
>
> **Feito:** A divergência dashboard 75% versus overview 100% foi provada no código: o catálogo não carregava `is_required` e o overview já usava aulas obrigatórias.
>
> **Não feito:** Não foi criado E2E porque não havia banco/ambiente E2E disponível.
>
> **Diferença/motivo:** A solução foi limitada à projeção de progresso e não alterou a política de sequência.
>
> **Verificação:** Testes SQL, regras, apresentação, dashboard e página de Curso passaram; A01 foi revisado e aprovado pelo usuário.

## 5.1 Como confirmar o erro antes de alterar

Criar primeiro um teste que demonstre:

```text
A obrigatória ✓
B obrigatória ✓
C obrigatória ✓
D opcional     ✗
```

Resultado esperado correto:

```text
requiredCompleted = 3
requiredTotal = 3
progressPercent = 100
```

Atualmente:

```text
getStudentCourseCatalog → 75%
getStudentCourseOverview → 100%
```

### Arquivos para inspeção

```text
src/features/courses/server.ts
src/features/progress/rules.ts
src/features/courses/presentation.ts

src/app/(student)/app/(dashboard)/page.tsx
src/app/(student)/app/cursos/[courseId]/page.tsx
src/app/(student)/app/cursos/[courseId]/course-overview-client.tsx
```

### Testes existentes relevantes

```text
src/features/progress/rules.test.ts
src/features/courses/server-sql.test.ts
src/features/courses/presentation.test.ts
tests/e2e/critical-journeys.spec.ts
```

---

# 5.2 Corrigir a projeção de domínio antes da UI

Hoje existem arrays separados:

```text
lessonIds
requiredLessonIds
completedLessonIds
```

Isso permite que um chamador esqueça `requiredLessonIds`.

Criar uma representação mais difícil de usar incorretamente.

Exemplo conceitual:

```ts
interface CourseProgressLesson {
  id: string;
  isCompleted: boolean;
  isRequired: boolean;
}
```

e:

```ts
calculateCourseProgress({
  lessons: [...]
})
```

Resultado:

```ts
interface CourseProgressProjection {
  completedCount: number;
  totalCount: number;
  percent: number;

  optionalCompletedCount: number;
  optionalTotalCount: number;
}
```

Os campos opcionais podem ser omitidos da primeira versão se não forem necessários na UI, mas a função precisa conhecer `isRequired`.

---

> **Relatório de implementação — status: implementado com desenho mais estreito.**
>
> **Feito:** `calculateCourseProgress` passou a exigir `requiredLessonIds`; catálogo, overview e módulos fornecem essa informação.
>
> **Não feito:** Não foi introduzido o DTO conceitual único `lessons: CourseProgressLesson[]` nem contadores opcionais.
>
> **Diferença/motivo:** Arrays separados foram mantidos para reduzir churn de DTO e preservar contratos existentes; o denominador obrigatório ficou explícito e obrigatório na função.
>
> **Verificação:** Typecheck e testes de regras/projeção passaram.

# 5.3 Regra canônica

O denominador oficial deve ser:

```text
aulas ativas obrigatórias da publicação vigente
```

Não:

```text
todas as aulas
```

---

# 5.4 Corrigir `getStudentCourseCatalog`

Arquivo:

```text
src/features/courses/server.ts
```

A query precisa carregar:

```sql
l.is_required
```

Adicionar esse campo ao tipo da row.

Ao montar o aggregate, guardar `isRequired`.

Não chamar mais `calculateCourseProgress()` sem essa informação.

---

> **Relatório de implementação — status: implementado.**
>
> **Feito:** A query carrega `l.is_required`, agrega IDs obrigatórios separadamente e expõe `lessonCount` visual.
>
> **Não feito:** Não foi alterado o campo `nextLessonId` para a política de opcionais; isso pertence ao PR 02.
>
> **Diferença/motivo:** O catálogo agora usa obrigatórias no percentual, mas continua usando a sequência existente para disponibilidade.
>
> **Verificação:** Teste SQL comprova a leitura de `is_required` e o denominador correto.

# 5.5 Corrigir o overview do curso

`getEnrolledCourseOverview()` já conhece `is_required`.

Alterá-lo apenas para utilizar a nova API comum.

Não recriar outra fórmula.

---

> **Relatório de implementação — status: implementado.**
>
> **Feito:** Overview matriculado e preview passaram a expor contagem visual, `isRequired` e denominador obrigatório.
>
> **Não feito:** Não foi feita alteração de conteúdo, matrícula ou certificado histórico.
>
> **Diferença/motivo:** O preview também passou a usar `requiredLessonIds` no `totalCount`, sem exibir progresso como concluído.
>
> **Verificação:** Testes de overview matriculado e preview passaram.

# 5.6 Corrigir o progresso de módulo

Hoje:

```text
completed module lessons
/
all module lessons
```

Isso deve ser alinhado à mesma política.

O servidor deve fornecer, por módulo:

```text
requiredLessonCount
completedRequiredLessonCount
progressPercent
```

Preferir calcular server-side.

Não deixar:

```text
course-overview-client.tsx
```

inventar novamente a regra.

O componente deve apenas renderizar o valor calculado.

---

> **Relatório de implementação — status: implementado.**
>
> **Feito:** O servidor calcula `requiredLessonCount`, `completedRequiredLessonCount` e `progressPercent` por módulo.
>
> **Não feito:** Não foram adicionados contadores opcionais à UI.
>
> **Diferença/motivo:** O cliente deixou de inventar a fórmula e apenas renderiza a projeção server-side.
>
> **Verificação:** Testes de SQL e do cliente verificam o progresso obrigatório do módulo.

# 5.7 Contagem visual de aulas

Separar:

```text
quantidade de aulas
```

de:

```text
quantidade de aulas obrigatórias usadas no progresso
```

Exemplo:

```text
4 aulas
3 obrigatórias
100% concluído
```

Não é obrigatório mostrar “3 obrigatórias” imediatamente, mas internamente os conceitos precisam ser diferentes.

---

> **Relatório de implementação — status: implementado.**
>
> **Feito:** Catálogo e overview diferenciam quantidade total de aulas do total obrigatório.
>
> **Não feito:** Não foi adicionada uma segunda etiqueta visual de obrigatórias em todas as superfícies.
>
> **Diferença/motivo:** A separação foi feita primeiro no contrato de dados para não misturar métrica comercial com elegibilidade.
>
> **Verificação:** Testes cobrem uma opcional pendente junto de obrigatórias concluídas.

# 5.8 Agrupamento do dashboard

Arquivo:

```text
src/features/courses/presentation.ts
```

`groupStudentCatalogCourses()` pode continuar usando:

```text
progressPercent >= 100
```

desde que `progressPercent` seja a projeção correta.

Depois da correção:

```text
3/3 obrigatórias + 1 opcional pendente
```

deve entrar em:

```text
Cursos concluídos
```

---

> **Relatório de implementação — status: implementado.**
>
> **Feito:** O agrupamento continua baseado em `progressPercent >= 100`, agora calculado sobre aulas obrigatórias.
>
> **Não feito:** Não foi feita jornada E2E do dashboard.
>
> **Diferença/motivo:** A regra de apresentação não foi duplicada; o dado corrigido alimenta o agrupamento existente.
>
> **Verificação:** Testes de apresentação e dashboard passaram.

# 5.9 Certificado

Não reimplementar a regra de certificado.

A emissão já conta:

```sql
filter (where l.is_required)
```

O objetivo é fazer dashboard/overview concordarem com essa verdade.

Adicionar um teste que prove:

```text
UI progress == certificate eligibility progress
```

---

> **Relatório de implementação — status: preservado.**
>
> **Feito:** A emissão de certificado não foi reimplementada; a UI foi alinhada à mesma elegibilidade obrigatória.
>
> **Não feito:** Não foi alterado `CourseCompletion` nem snapshot de certificado existente.
>
> **Diferença/motivo:** Isso evita regressão em histórico e respeita ADR-0007.
>
> **Verificação:** Testes de integração de certificado permaneceram aprovados.

# 5.10 Testes obrigatórios

> **Relatório de implementação — status: parcialmente implementado.**
>
> **Feito:** Foram adicionados/ajustados testes unitários, SQL, apresentação, páginas e contratos de cliente.
>
> **Não feito:** O E2E indicado no plano não foi executado.
>
> **Diferença/motivo:** A ausência de banco E2E impediu provar a jornada completa no navegador.
>
> **Verificação:** `bun run verify:quick` final passou com 415 arquivos e 2.819 testes.

### Unitário

`src/features/progress/rules.test.ts`

Casos:

```text
3 required concluídas + optional pendente = 100%
2/3 required = 67%
optional concluída não altera percentual
duplicata de conclusão não altera contagem
nenhuma required = comportamento explicitamente definido
```

### SQL/servidor

Garantir em:

```text
server-sql.test.ts
```

que catálogo lê:

```text
l.is_required
```

### Presentation

Testar que 100% obrigatório entra em `completed`.

### E2E

Criar fixture com:

```text
required ✓
required ✓
optional ✗
```

Confirmar:

```text
dashboard = 100%
course = 100%
```

---

# 5.11 Critério de pronto

A mesma matrícula nunca pode apresentar:

```text
dashboard 75%
course 100%
```

ou:

```text
course 100%
module 75%
```

quando a diferença for causada apenas por aula opcional.

---

> **Relatório de implementação — status: atendido no código não-E2E.**
>
> **Feito:** Dashboard, overview e módulo recebem o mesmo denominador obrigatório.
>
> **Não feito:** Não foi comprovado o fluxo completo de browser com uma matrícula real.
>
> **Diferença/motivo:** A garantia é de projeção e testes de servidor; a garantia visual E2E permanece pendente.
>
> **Verificação:** Testes de regras, SQL, apresentação e componentes passaram.

# 6. PR 02 — Separar conclusão de progressão

## Problema

`isRequired` significa “necessária para concluir”, mas a sequência atual também a transforma em “necessária para avançar”.

---

> **Relatório de implementação — status: COMPLETO E APROVADO pelo usuário.**
>
> **Feito:** `isLessonAvailable` agora libera uma Aula quando as Aulas obrigatórias anteriores estão concluídas; opcionais no início ou entre obrigatórias não bloqueiam.
>
> **Não feito:** Não foi criada uma validação de authoring para impedir Curso com zero obrigatórias, conforme decisão do Produto.
>
> **Diferença/motivo:** A alteração foi autorizada pelo usuário, preservando a liberação temporal, matrícula, expiração e revogação.
>
> **Verificação:** A regra foi registrada no ADR-0011, coberta por testes unitários e SQL, e A02 foi revisado, marcado como completo e aprovado pelo usuário.

# 6.1 Reproduzir primeiro

Teste:

```text
A required ✓
B optional ✗
C required ✗
```

Antes da correção:

```text
C bloqueada
```

Depois:

```text
B acessível
C acessível
```

---

# 6.2 Arquivos principais

```text
src/features/progress/rules.ts
src/features/progress/rules.test.ts

src/features/courses/server.ts
src/features/enrollments/access.ts

src/app/(student)/app/aulas/[lessonId]/page.tsx
src/app/(student)/app/cursos/[courseId]/course-overview-client.tsx

docs/domain/learning-content-and-progress.md
```

---

# 6.3 Não usar apenas `lessonIds`

Mudar a regra de sequência para receber estrutura semelhante a:

```ts
interface ProgressionLesson {
  id: string;
  isCompleted: boolean;
  isRequired: boolean;
}
```

---

> **Relatório de implementação — status: implementado com desenho mais estreito.**
>
> **Feito:** A sequência passou a receber e usar `requiredLessonIds` para encontrar obrigatórias anteriores pendentes.
>
> **Não feito:** A estrutura conceitual única `ProgressionLesson[]` não foi introduzida.
>
> **Diferença/motivo:** Foi preferida uma alteração pequena e compatível com os DTOs existentes; o comportamento agora é explícito na regra pura.
>
> **Verificação:** Testes cobrem opcionais no início, entre obrigatórias e obrigatórias posteriores.

# 6.4 Regra de disponibilidade

### Aula já concluída

Sempre acessível enquanto o curso/módulo continuar acessível.

### Aula obrigatória

Disponível quando todas as aulas **obrigatórias anteriores** tiverem sido concluídas.

### Aula opcional

Disponível quando todas as aulas **obrigatórias anteriores** tiverem sido concluídas.

Aulas opcionais anteriores incompletas não bloqueiam.

---

# 6.5 Exemplo

```text
1. Required A ✓
2. Optional B  ✗
3. Optional C  ✗
4. Required D  ✗
5. Required E  ✗
```

Depois de A:

```text
B = disponível
C = disponível
D = disponível
E = bloqueada
```

Depois de D:

```text
E = disponível
```

---

# 6.6 Próxima aula primária

Após concluir uma Aula, o encaminhamento automático deve apontar para a primeira Aula pendente e disponível à frente na ordem do currículo, seja obrigatória ou opcional. Só quando a Aula concluída for a última do currículo, sem nenhuma pendente disponível à frente, a busca deve reiniciar do começo para oferecer uma Aula opcional que tenha sido pulada.

Política recomendada:

1. após uma conclusão, procurar a primeira Aula pendente e disponível à frente, obrigatória ou opcional;
2. se houver Aulas à frente, mas nenhuma estiver disponível por tempo ou sequência, não voltar para trás;
3. se a Aula concluída for a última do currículo, procurar desde o início a primeira Aula pendente e disponível;
4. se não houver nenhuma, retornar `null`;
5. liberação temporal e acesso continuam sendo aplicados.

Assim, depois de concluir todas as obrigatórias:

```text
progress = 100%
nextLessonId = primeira opcional pendente disponível à frente
```

Se não existirem Aulas pendentes à frente e a Aula concluída for a última do currículo, a busca reinicia desde o início. Se não existir nenhuma Aula pendente disponível, `nextLessonId = null`.

---

> **Relatório de implementação — status: implementado e aprovado.**
>
> **Feito:** A recomendação de próxima Aula pode apontar para uma opcional pendente; após uma conclusão, a busca começa à frente e só reinicia desde o início quando a Aula concluída é a última do currículo.
>
> **Não feito:** Não foi criado um campo público separado com esses nomes; a navegação visual adjacente continua usando seu próprio `nextLessonId` no workspace.
>
> **Diferença/motivo:** O Produto decidiu que a ação principal também deve conduzir a opcionais pendentes, mas não deve levar o aluno para trás antes do fim da trilha; a navegação lateral mantém a próxima visual.
>
> **Verificação:** Testes SQL cobrem A/B/C opcionais disponíveis, D obrigatória liberada e próxima opcional após todas as obrigatórias.

# 6.7 Navegação anterior/próxima

Diferenciar:

```text
próxima aula visual na trilha
```

de:

```text
próxima aula necessária para continuar
```

Se os dois conceitos usam hoje o mesmo campo, criar nomes diferentes.

Exemplo:

```text
nextRequiredLessonId
nextVisibleLessonId
```

Não é obrigatório usar exatamente esses nomes, mas a semântica precisa ser clara.

---

# 6.8 Curso sem nenhuma aula obrigatória

Não inventar uma nova regra silenciosamente.

Antes de implementar, consultar se existem publicações ativas com:

```text
0 required lessons
```

Cursos sem Aulas obrigatórias não entram no fluxo de conclusão ou Certificado.
Aulas opcionais ficam acessíveis desde o início, pois não existe Aula
obrigatória anterior para bloqueá-las.

Se uma publicação existente tiver Certificado habilitado e zero obrigatórias,
trata-se de uma configuração sem fluxo de Certificado que não deve emitir
documento; ela pode ser investigada separadamente, sem backfill automático.
Não haverá bloqueio de authoring somente por ausência de obrigatórias.

Até essa decisão, preservar a regra de segurança:

```text
0 aulas obrigatórias não gera conclusão automática
```

---

> **Relatório de implementação — status: regra parcialmente implementada.**
>
> **Feito:** Cursos sem obrigatórias não emitem Certificado, porque a elegibilidade exige `totalLessons > 0`; aulas opcionais ficam acessíveis quando não há obrigatórias anteriores.
>
> **Não feito:** Não foi criada uma regra de authoring para impedir a publicação de Cursos com zero obrigatórias.
>
> **Diferença/motivo:** O Produto decidiu manter Cursos sem obrigatórias; eles não entram no fluxo de certificado, sem bloquear a publicação de Cursos que não oferecem certificado.
>
> **Verificação:** Foi adicionado teste de overview sem fluxo de certificado; não há migration ou consulta de dados necessária para manter essa decisão.

# 6.9 Documentação

Atualizar `REG-LEA-003`.

A documentação deve afirmar explicitamente que:

> aulas opcionais não bloqueiam a primeira aula obrigatória pendente.

---

> **Relatório de implementação — status: implementado.**
>
> **Feito:** `REG-LEA-003` foi atualizado para registrar que somente Aulas obrigatórias anteriores bloqueiam a sequência e que opcionais podem ser a próxima recomendação.
>
> **Não feito:** Não foram alteradas regras de acesso temporal, matrícula, expiração ou revogação.
>
> **Diferença/motivo:** A documentação agora registra a decisão aprovada no ADR-0011, sem transformar aulas opcionais em requisito.
>
> **Verificação:** `bun run docs:check` passou.

# 6.10 Testes

Cobrir:

```text
required → optional → required
required → optional → optional → required
optional no início
optional depois de todas required
required concluída em publicação anterior via curriculum_key
módulo time_locked
aula anteriormente concluída
```

Também garantir que a mudança não atravesse:

```text
content release schedule
enrollment expiration
revocation
```

---

> **Relatório de implementação — status: implementação de A02 completa; cobertura de testes complementares parcial.**
>
> **Feito:** Foram adicionados testes para opcional entre obrigatórias, opcionais liberadas em conjunto, opcional no próximo CTA e Curso sem obrigatórias.
>
> **Não feito:** Ainda faltam testes reais de matrícula histórica, scheduled release completo, expiração, revogação e E2E.
>
> **Diferença/motivo:** A regra de Produto foi aprovada; os cenários restantes dependem de banco/fixture E2E e serão adicionados sem alterar acesso.
>
> **Verificação:** `bun run verify:quick` passou com 415 arquivos e 2.829 testes; a implementação de A02 foi revisada e aprovada. Permanecem apenas os cenários E2E e de ambiente real descritos acima.

# 7. PR 03 — Corrigir tracking de vídeo e regra 100%

Este é um trabalho maior e deve ser dividido internamente em duas etapas.

---

# 7.1 Estado atual

Hoje:

```text
watchedPercent
```

é derivado de:

```text
maxPositionSeconds / durationSeconds
```

Isso é posição máxima, não cobertura assistida.

Além disso:

```text
runtime = 95%
documentação no baseline = 98%; decisão atual = 100%
```

e o evento `end` atualmente pode concluir mesmo com percentual muito baixo.

---

> **Relatório de implementação — status: COMPLETO no escopo aprovado; implementado no working tree.**
>
> **Feito:** Foi corrigida a confusão entre posição máxima e reprodução validada: `skip` não avança a fronteira linear, a retomada fica separada, o tempo de reprodução é registrado e conclusão manual/vídeo é distinguível.
>
> **Não feito:** Não foi criada cobertura por ranges, conforme decisão do Produto. Não foi executado player JMVStream real nem migration em banco persistente nesta sessão.
>
> **Diferença/motivo:** O Produto escolheu uma solução menor que ranges: `skip` não avança conclusão, reprodução posterior entra no tempo analítico e a conclusão automática exige reprodução linear validada.
>
> **Verificação:** Eventos oficiais foram confrontados com a documentação do JMVStream; `bun run test`, typecheck, Ultracite, migration check e docs check passaram.

# 7.2 Cenários aprovados antes de mudar

O comportamento aprovado deve ser demonstrado por estes cenários:

```text
Aluno reproduz de 0 até 30
Aluno faz skip para 950
Aluno encerra a Aula

retomada = ponto válido próximo de 30
fronteira validada = 30
conclusão automática = false
```

Outro teste:

```text
Aluno faz skip para 950
Aluno reproduz de 950 até 1000

tempo de reprodução aumenta
fronteira validada continua em 30
conclusão automática = false
```

```text
Aluno retorna ao ponto 30
Aluno reproduz linearmente até 100%

fronteira validada = 100%
conclusão automática = true
```

```text
eventName = jmvplayerout-end
fronteira validada = 20

completed = false
```

---

> **Relatório de implementação — status: implementado e coberto no escopo local.**
>
> **Feito:** Foram cobertos reprodução normal, `skip` grande, reprodução após `skip`, retorno à fronteira, restore, limiar, evento inválido, duração autoritativa e progresso analítico.
>
> **Não feito:** A validação do player real, concorrência contra PostgreSQL e jornada E2E continuam fora do ambiente disponível.
>
> **Diferença/motivo:** A cobertura por ranges foi retirada do escopo. A solução aprovada usa uma fronteira linear validada para manter o Hub simples.
>
> **Verificação:** A suíte direcionada passou com 82 testes e a suíte completa passou com 415 arquivos e 2.837 testes.

# 7.3 Arquivos

```text
src/features/progress/rules.ts
src/features/progress/rules.test.ts

src/features/videos/jmvstream.ts
src/features/videos/jmvstream.test.ts

src/components/lesson-video-player.tsx

src/app/(student)/app/actions.ts

src/features/courses/server.ts

src/features/learning-analytics/rules.ts
src/features/learning-analytics/server.ts

src/db/schema.ts
src/db/migrations/*

docs/domain/learning-content-and-progress.md
```

---

# 7.4 Separar retomada e progresso validado

`current_seconds` deve representar a posição válida usada para retomar o vídeo.
Um `skip` para frente não deve substituir essa posição enquanto não houver
reprodução real depois do salto.

`max_position_seconds` continua existindo para:

```text
diagnóstico e compatibilidade histórica
```

Ele não deve ser usado para retomar, validar progresso ou concluir uma Aula.

---

> **Relatório de implementação — status: implementado.**
>
> **Feito:** A página retoma a partir de `resume_position_seconds`; um `skip` para frente não substitui a posição até haver reprodução real posterior.
>
> **Não feito:** A confirmação do último checkpoint no encerramento continua limitada ao comportamento assíncrono do navegador e ao provider real.
>
> **Diferença/motivo:** O campo histórico foi preservado; a migration adicionou estado novo sem reinterpretar dados antigos.
>
> **Verificação:** Testes de restore, skip, retorno à fronteira e suíte completa passaram.

# 7.5 Separar quatro conceitos

A partir desta mudança:

```text
currentSeconds
```

significa:

> posição atual.

```text
maxPositionSeconds
```

significa:

> ponto mais distante observado, sem alegar que o caminho até ele foi reproduzido.

```text
validatedPositionSeconds
```

significa:

> fronteira linear alcançada por reprodução normal, sem contar `skip` para frente.

```text
playingTimeSeconds
```

significa:

> tempo de reprodução normal acumulado, que pode contar reprises e não substitui a fronteira.

Não será criado `coveragePercent` por ranges nesta etapa.

---

# 7.6 Migration mínima recomendada

A migration vigente mais recente no baseline é `0075`.

Se nenhuma outra migration entrar antes, a próxima será a seguinte na sequência. Não assumir o número sem rebasing.

Usar:

```bash
bun run db:generate
```

quando aplicável e conferir manualmente o SQL gerado.

> **Relatório de implementação — status: migration criada e validada estaticamente.**
>
> **Feito:** As migrations `0076_linear_validated_video_progress` e `0077_analytics_completion_source` foram geradas; a posição de retomada histórica é copiada de `current_seconds`, enquanto fronteira e tempo começam em zero.
>
> **Não feito:** As migrations não foram aplicadas a Staging/Production nem a um PostgreSQL descartável nesta sessão.
>
> **Diferença/motivo:** A solução aprovada não adiciona ranges; as novas colunas são aditivas e compatíveis com o código anterior, sem validar o histórico.
>
> **Verificação:** `bun run db:migrations:check` passou; o SQL foi revisado e inclui os checks de não negatividade e versão de tracking.

### Mudança conceitual aprovada

Preservar semanticamente as colunas históricas:

```text
current_seconds       → retomada compatível, com nova regra de atualização
max_position_seconds  → maior posição observada/legado
watched_percent       → não usar como prova de vídeo validado
```

preservando os valores existentes.

Adicionar:

```text
validated_position_seconds
playing_time_seconds
tracking_session_id
last_event_sequence
```

### Histórico

Não transformar registros históricos de posição em progresso validado.

Seria inventar dados.

Preferível:

```text
validated_position_seconds = 0
playing_time_seconds = 0
tracking_session_id = NULL
last_event_sequence = 0
```

para registros anteriores.

Registros novos passam a possuir estado validado somente depois de receber
eventos processados pela regra nova. Dados antigos podem manter sua posição de
retomada de compatibilidade, mas não liberam conclusão automática.

---

# 7.7 Ranges fora do escopo atual

Não será criado um modelo de ranges nesta etapa.

Se no futuro for necessário creditar trechos assistidos fora de ordem, será
preciso abrir uma nova decisão sobre cobertura, provider e migration. Não
misturar essa necessidade com a correção atual de `skip`.

---

# 7.8 Criar helpers puros

Criar regras puras em `src/features/progress/rules.ts` para:

```text
classifyVideoProgressEvent()
advanceValidatedPosition()
calculatePlayingTimeDelta()
```

Esses helpers recebem apenas posições, duração, estado do player, sessão e
sequência. Não devem viver dentro de React nem decidir autorização de Aula.

Regras mínimas:

- `skip` para frente não avança `validatedPositionSeconds`;
- posição restaurada automaticamente não conta como reprodução;
- avanço normal só pode ampliar a fronteira linear validada;
- tempo reproduzido pode aumentar com reprodução posterior ao `skip`;
- posição máxima pode ser mantida para diagnóstico, mas não decide conclusão;
- eventos duplicados ou atrasados não podem aumentar tempo ou regredir retomada.

Esse helper deve receber apenas dados simples e possuir muitos testes.

---

# 7.9 Comportamento no player

Em `lesson-video-player.tsx`, manter estado/ref local da sessão e da posição
válida. Não avançar a fronteira quando o evento representar:

```text
skip
restore automático de posição
jump
```

Avançar a fronteira e o tempo somente quando houver progressão normal observada,
com `paused` e a sequência de eventos interpretados. Ao pausar ou ocultar a
página, tentar salvar o último ponto válido; checkpoints periódicos continuam
necessários.

Como conclusão manual permanece disponível, esse mecanismo é uma regra de
conclusão automática, não uma prova antifraude de atenção humana.

---

> **Relatório de implementação — status: implementado.**
>
> **Feito:** O player mantém uma sessão e sequência, envia `paused`, força salvamento em pausa/visibilidade e descarta a primeira resposta do restore automático.
>
> **Não feito:** O provider real ainda precisa ser observado em dispositivos e condições de rede reais.
>
> **Diferença/motivo:** A decisão aprovada substituiu ranges por fronteira linear para manter o fluxo simples.
>
> **Verificação:** Testes de componente, regras, SQL e suíte completa passaram.

# 7.10 Servidor continua sendo autoridade de persistência

O cliente pode informar eventos e posições observadas.

O servidor deve:

- validar formato, duração e allowlist de eventos;
- rejeitar ou ignorar `skip` para avanço da fronteira;
- derivar a fronteira validada e o tempo de reprodução;
- controlar sessão e sequência para duplicação, atraso e reordenação;
- atualizar a posição de retomada somente conforme a regra aprovada;
- nunca aceitar percentual ou tempo arbitrário enviado pelo navegador como verdade;
- manter transação, autorização e duração persistida como autoridade.

O navegador envia evidência bruta.

O servidor deriva o progresso validado e o tempo contabilizado.

---

> **Relatório de implementação — status: implementado.**
>
> **Feito:** O servidor valida allowlist, limites numéricos, duração persistida, sessão e sequência; deriva fronteira, tempo e percentual validado; duração ausente gera no-op seguro.
>
> **Não feito:** A confirmação do comportamento do provider real e da concorrência em PostgreSQL persistente não foi executada nesta sessão.
>
> **Diferença/motivo:** O cliente continua enviando sinais, mas o servidor calcula a fronteira e o tempo; `skip` e percentual arbitrário não são aceitos como prova.
>
> **Verificação:** Testes SQL cobrem skip, fronteira bloqueada, reprodução posterior, tempo e origem manual; migration check passou.

# 7.11 Nova regra automática

Em:

```text
shouldCompleteLessonFromJmvstreamEvent
```

remover a exceção:

```text
end = concluído independentemente do percentual
```

Nova regra:

```text
recognized event
AND
validatedPositionSeconds / authoritativeDurationSeconds = 100%
```

Evento `end` pode provocar sync imediato, mas não ignora o limiar nem
transforma um `skip` anterior em reprodução linear. `status` abaixo da fronteira
validada não conclui. O botão manual continua independente.

---

> **Relatório de implementação — status: implementado.**
>
> **Feito:** Conclusão automática exige evento JMV reconhecido e fronteira linear validada em 100%; `skip`, posição máxima e `end` isolado não concluem.
>
> **Não feito:** Nenhuma cobertura por ranges foi criada, conforme decisão aprovada.
>
> **Diferença/motivo:** A regra foi ligada à fronteira linear aprovada, sem exigir ranges nem reinterpretar histórico.
>
> **Verificação:** Testes unitários e SQL confirmam `end` abaixo de 100%, skip, fronteira bloqueada e evento reconhecido somente após 100% linear.

# 7.12 Manual continua funcionando

`completeLessonAction()` deve continuar permitindo conclusão manual exatamente como hoje.

Não condicionar o botão manual a 100%.

---

> **Relatório de implementação — status: preservado.**
>
> **Feito:** Conclusão manual continua sem depender de 100% de vídeo.
>
> **Não feito:** Nenhuma barreira antifraude foi adicionada.
>
> **Diferença/motivo:** Vídeo automático é uma segunda via; a ação manual existente permaneceu intacta.
>
> **Verificação:** Testes de conclusão manual e integração passaram.

# 7.13 Analytics

Revisar toda query que hoje usa ou expõe:

```text
watched_percent
max_position_seconds
```

Classificar cada consulta entre:

```text
posição máxima para diagnóstico
fronteira linear para progresso de vídeo
tempo de reprodução para engajamento
tempo até conclusão para jornada
origem manual/automática para interpretação
```

`watch_checkpoint` deve ser emitido com base na fronteira validada, não em
`max_position_seconds`. O tempo após `skip` entra como tempo de reprodução, mas
não como progresso linear. A conclusão manual não deve parecer conclusão por
vídeo.

> **Relatório de implementação — status: implementado no armazenamento e no contrato de eventos.**
>
> **Feito:** Analytics agora recebe checkpoints da fronteira validada, eventos separados de tempo reproduzido e origem manual/vídeo na conclusão. O painel administrativo exibe o tempo reproduzido total por Aula na tabela, nos detalhes por versão e na exportação CSV.
>
> **Não feito:** Não foi criada uma métrica de tempo médio individual nem uma cobertura por ranges. O tempo exibido é um total agregado por Aula e período.
>
> **Diferença/motivo:** O Produto aprovou tempo após `skip` nos analytics, mas rejeitou ranges e a interpretação histórica como validada.
>
> **Verificação:** Testes de analytics, migration e suíte completa passaram; eventos de `watch_progress` carregam o tempo derivado pelo servidor.

### Retomada e posição máxima

usar:

```text
current_seconds para retomada
max_position_seconds para diagnóstico
```

### Engajamento reproduzido

usar:

```text
playing_time_seconds
```

Não usar fallback silencioso de posição antiga como progresso validado.

Se analytics precisar mostrar histórico, identificar dados legados como posição
não validada.

---

# 7.14 UI do aluno

Se algum componente exibe o atual `watchedPercent` como progresso do vídeo,
renomear a apresentação para não prometer cobertura que o contrato linear não
mede. A interface pode mostrar progresso validado do vídeo; a posição máxima e
o tempo de reprodução são dados de analytics, não uma segunda barra concorrente.

Não mostrar o destino de um `skip` como progresso validado.

---

# 7.15 Testes

Cobrir:

```text
visualização contínua
skip grande sem concluir
skip grande seguido de reprodução sem concluir
skip pequeno sem avançar indevidamente
rewind dentro de trecho validado
assistir trecho duas vezes aumenta tempo, não fronteira indevidamente
restore inicial
vídeo 100%
vídeo 99%
end com 20%
end com 99%
pausa salva posição válida
visibilidade salva posição válida
duas abas e eventos fora de ordem
conclusão manual
conclusão automática
histórico antigo não validado
```

---

> **Relatório de implementação — status: matriz principal implementada.**
>
> **Feito:** Testes cobrem reprodução contínua, skip grande/pequeno, reprodução posterior, retorno à fronteira, restore, limiar, pausa, visibilidade, sequência, conclusão manual e automática, além de histórico não validado.
>
> **Não feito:** Concorrência em PostgreSQL real, player real e E2E continuam pendentes de ambiente.
>
> **Diferença/motivo:** Esses testes dependem do contrato de fronteira linear agora aprovado.
>
> **Verificação:** A suíte completa passou com 415 arquivos e 2.837 testes.

# 7.16 Critério de pronto

Os seguintes cenários não podem mais acontecer:

```text
aluno assiste 30s
pula para 95%
sistema valida 95% de progresso linear

aluno pula para 95%
fecha a Aula
retomada volta para 95% sem reprodução real posterior

aluno conclui pelo botão
analytics registra a conclusão como se tivesse sido automática por vídeo
```

---

> **Relatório de implementação — status: implementado no escopo local.**
>
> **Feito:** O sistema não valida posição de `skip` como progresso linear, não retoma no destino de um salto sem reprodução posterior, separa tempo analítico e mantém conclusão manual disponível.
>
> **Não feito:** Não há cobertura por ranges, conforme decisão aprovada; a execução contra player real e banco persistente ainda não foi feita.
>
> **Diferença/motivo:** A decisão do Produto substituiu a dependência da posição máxima por fronteira linear, sem criar ranges.
>
> **Verificação:** `bun run test`, `bun run typecheck`, Ultracite, migration check e docs check passaram.

# 8. PR 04 — Corrigir carga horária, draft/publicado e override

Este PR corrige dois problemas relacionados.

---

# 8.1 Bug A — draft alterando carga pública

Arquivo:

```text
src/features/courses/server.ts
```

Função:

```text
recalculateCourseWorkloadHours()
```

Hoje a query retorna apenas uma publicação:

```text
draft OU published
```

mas o código tenta procurar as duas no array.

---

> **Relatório de implementação — status: confirmado e corrigido.**
>
> **Feito:** Foi reproduzido no código: a query limitava a uma publicação e a lógica tentava encontrar draft e published no mesmo array.
>
> **Não feito:** Não foi feito backfill de valores já persistidos.
>
> **Diferença/motivo:** O recálculo agora lê ambos, atualiza snapshot do draft e usa o snapshot publicado para o valor público quando ambos existem.
>
> **Verificação:** Teste SQL cobre published 10h + draft 13h resultando em carga pública de 10h.

# 8.2 Confirmar com teste

Cenário:

```text
published = 10h
draft = 13h
override = null
```

Ao editar uma aula no draft:

correto:

```text
draft snapshot = 13h
courses.workload_hours = 10h
```

Hoje pode virar:

```text
courses.workload_hours = 13h
```

---

# 8.3 Implementação

Buscar draft e published separadamente ou retornar ambos.

Não usar:

```sql
limit 1
```

se depois a lógica precisa dos dois estados.

---

# 8.4 Regra

> **Relatório de implementação — status: implementado.**
>
> **Feito:** Override tem precedência; com published e draft, o efetivo usa published; sem published inicial, usa draft.
>
> **Não feito:** Não foi alterado o snapshot de certificados já emitidos.
>
> **Diferença/motivo:** O comportamento foi implementado dentro de transação e lock de conteúdo.
>
> **Verificação:** Testes SQL e de apresentação passaram.

### Existe publicação publicada

```text
courses.workload_hours
=
override ?? published.workload_hours_snapshot
```

### Só existe draft inicial

```text
courses.workload_hours
=
override ?? draft.workload_hours_snapshot
```

### Depois da publicação

O valor efetivo deve ser atualizado para o novo snapshot publicado.

---

# 8.5 Publicação

Revisar:

```text
runCoursePublicationTransaction()
publishCoursePublication()
```

Garantir que a mudança:

```text
draft → published
```

também atualize a carga efetiva do curso de maneira consistente.

Preferir que a mudança aconteça dentro da mesma fronteira transacional que define qual publicação passou a ser a vigente.

---

> **Relatório de implementação — status: preservado e conferido.**
>
> **Feito:** Publicação já atualizava `courses.workload_hours` dentro da transação de publicação; essa regra foi mantida.
>
> **Não feito:** Não foi reescrito o fluxo de publicação além do necessário.
>
> **Diferença/motivo:** A alteração evitou tocar em histórico, grants, enrollment ou certificado.
>
> **Verificação:** Testes de publicação e certificado passaram.

# 8.6 Bug B — UI ignora override

Backend já entrega:

```text
workloadHours
```

mas UI recalcula por segundos.

Alterar:

```text
dashboard
course page
public catalog/purchase se aplicável
```

para usar carga oficial.

---

> **Relatório de implementação — status: corrigido.**
>
> **Feito:** Dashboard, catálogo e página do Curso passaram a usar a carga efetiva; o Admin também usa esse valor no preview do certificado e mantém a duração do conteúdo separada. Salvar ou remover o override atualiza a projeção no mesmo lock e transação.
>
> **Não feito:** Duração agregada continua sendo exibida somente onde representa duração de conteúdo.
>
> **Diferença/motivo:** Foi separado formatter de carga oficial de formatter baseado em segundos.
>
> **Verificação:** Testes de dashboard, catálogo, página, apresentação e authoring passaram.

# 8.7 Criar formatter específico

Hoje:

```text
formatCourseWorkload(totalSeconds)
```

na prática formata duração.

Criar algo semanticamente explícito:

```text
formatCourseWorkloadHours(hours)
```

Exemplo:

```text
0 → 0h
1 → 1h
20 → 20h
```

O formatter de duração por segundos pode permanecer para:

- módulos;
- aulas;
- duração dos conteúdos.

---

> **Relatório de implementação — status: implementado.**
>
> **Feito:** Foi criado `formatCourseWorkloadHours`, inclusive preservando `0h`.
>
> **Não feito:** Não foi removido o formatter antigo porque ainda possui consumidores de duração calculada.
>
> **Diferença/motivo:** A nomenclatura agora comunica se o valor é workload oficial ou duração de conteúdo.
>
> **Verificação:** Testes unitários cobrem zero e valores inteiros.

# 8.8 Buscar todas as superfícies

Antes de concluir:

```bash
git grep -n "formatCourseWorkload"
git grep -n "workloadHours"
git grep -n "totalDurationSeconds"
```

Classificar cada ocorrência.

---

# 8.9 Não alterar certificados históricos

Certificados emitidos possuem snapshot.

Nunca recalcular certificado existente.

Só novas emissões devem usar a carga efetiva atual.

---

> **Relatório de implementação — status: preservado.**
>
> **Feito:** Nenhuma emissão histórica foi recalculada.
>
> **Não feito:** Não foi criado backfill de certificados.
>
> **Diferença/motivo:** O workload oficial só influencia novas leituras/emissões.
>
> **Verificação:** Testes de certificado permaneceram aprovados.

# 8.10 Testes

```text
published 10 / draft 13 → aluno vê 10
publica draft → aluno vê 13

published 10 / override 20 → aluno vê 20
draft 13 / override 20 → aluno vê 20
publica → aluno continua vendo 20

remove override → volta ao published snapshot
```

E verificar:

```text
certificado novo = workload oficial
certificado antigo = snapshot antigo
```

---

> **Relatório de implementação — status: parcialmente implementado.**
>
> **Feito:** Foi coberto draft/published, override, zero, UI e snapshot de publicação.
>
> **Não feito:** Não houve teste de concorrência em PostgreSQL real nem todos os cenários históricos do plano.
>
> **Diferença/motivo:** A fronteira transacional foi implementada no código, mas o comportamento sob concorrência real ainda precisa de banco.
>
> **Verificação:** `bun run verify:quick` passou.

# 9. PR 05 — Proteger integridade Course → Publication → Module → Lesson

Este PR contém migration.

Deve ser tratado com cuidado.

---

# 9.1 Primeiro: procurar corrupção existente

Antes de adicionar qualquer constraint, executar em PostgreSQL descartável e depois, no processo operacional aprovado, em Staging.

> **Relatório de implementação — status: A08 e A09 implementados no Development; Staging e Production pendentes.**
>
> **Feito:** O preflight somente-leitura foi executado no Development com o guard de destino do projeto: 53 Módulos conferem com suas Publicações, nenhum Módulo está divergente, e 82 Aulas não têm Publicação diferente da do Módulo.
>
> **Não feito:** O preflight ainda não foi executado em banco descartável, Staging ou Production; nenhuma linha legada precisou ser corrigida.
>
> **Diferença/motivo:** Como o Development estava íntegro, a migration foi aplicada somente nele. A promoção para Staging/Production continua seguindo o fluxo de release, com novo preflight no alvo.
>
> **Verificação:** `bun run db:migrate:development`, `bun run db:migrations:check` e `bun run db:migrations:inspect -- --environment=development` passaram; as constraints de Módulo e Aula foram confirmadas como validadas no PostgreSQL.

### Módulos inconsistentes

```sql
select
  m.id,
  m.course_id as module_course_id,
  cp.course_id as publication_course_id,
  m.course_publication_id
from modules m
join course_publications cp
  on cp.id = m.course_publication_id
where m.course_id <> cp.course_id;
```

Resultado esperado:

```text
0 rows
```

---

# 9.2 Aulas inconsistentes

```sql
select
  l.id,
  l.module_id,
  l.course_publication_id as lesson_publication_id,
  m.course_publication_id as module_publication_id
from lessons l
join modules m
  on m.id = l.module_id
where l.course_publication_id <> m.course_publication_id;
```

Resultado esperado:

```text
0 rows
```

---

# 9.3 Se retornar alguma linha

**STOP.**

Não executar update automático.

Descobrir:

- quando foi criada;
- publicação correta;
- curso correto;
- audit log;
- referências JMVStream;
- progresso;
- materiais.

Corrigir dados incorretos exige decisão baseada no histórico.

---

> **Relatório de implementação — status: não aplicável ainda.**
>
> **Feito:** A regra STOP foi mantida.
>
> **Não feito:** Nenhuma linha inconsistente foi consultada ou corrigida.
>
> **Diferença/motivo:** Não há evidência suficiente para inferir a causa de eventual corrupção.
>
> **Verificação:** Nenhuma atualização estrutural foi executada.

# 9.4 Corrigir `saveModule`

Arquivo:

```text
src/features/admin/authoring.ts
```

Hoje um `courseId` vindo do `FormData` pode alterar:

```text
modules.course_id
```

sem realinhar:

```text
course_publication_id
```

Para módulo existente:

> **Relatório de implementação — status: implementado e protegido no banco em Development.**
>
> **Feito:** Edição de módulo compara o `courseId` enviado com o ownership persistido e não atualiza mais `modules.course_id` a partir do hidden input. A migration `0078_protect_module_course_publication_ownership` agora exige no banco que `modules(course_publication_id, course_id)` corresponda a `course_publications(id, course_id)`.
>
> **Não feito:** A constraint ainda não foi promovida para Staging/Production; isso ocorrerá pelo fluxo de release após o preflight de cada ambiente.
>
> **Diferença/motivo:** A proteção server-side continua sendo a primeira barreira para mensagens manipuladas, e a constraint composta passou a ser a barreira definitiva para gravações incompatíveis. A migração de Aulas permanece no A09 e não foi misturada neste item.
>
> **Verificação:** Teste adversarial rejeita Curso manipulado; teste de migration garante a ordem da chave única antes da FK; uma tentativa transacional inválida no Development foi rejeitada pela constraint `modules_course_publication_course_fk` e sofreu rollback.

### Não confiar em `courseId`

Usar:

```text
moduleId
```

para buscar server-side:

```text
current.course_id
current.course_publication_id
```

O curso do módulo é derivado do registro persistido.

Se o formulário ainda enviar `courseId`, usá-lo somente como check:

```text
submittedCourseId !== currentCourseId
→ reject
```

Nunca como autoridade para mover módulo entre cursos.

---

# 9.5 Movimento entre cursos

Se um dia produto quiser mover um módulo entre cursos:

isso deve ser uma operação própria.

Não acontecer incidentalmente via “Editar módulo”.

---

# 9.6 Constraints compostas

A relação precisa ser protegida pelo banco.

Adicionar constraint que garanta conceitualmente:

```text
modules(course_publication_id, course_id)
→
course_publications(id, course_id)
```

Para isso, a tabela referenciada precisa possuir chave/unique compatível.

Adicionar também a invariante:

```text
lessons(module_id, course_publication_id)
→
modules(id, course_publication_id)
```

Assim uma aula não pode apontar para:

```text
module da publicação A
+
course_publication_id da publicação B
```

---

> **Relatório de implementação — status: implementado para Módulos e Aulas no Development.**
>
> **Feito:** O schema e as migrations adicionam a unique composta de `course_publications(id, course_id)` com a FK composta de `modules(course_publication_id, course_id)`, e a unique composta de `modules(id, course_publication_id)` com a FK composta de `lessons(module_id, course_publication_id)`. O inspector de migrations valida as quatro partes.
>
> **Não feito:** Staging e Production ainda aguardam promoção controlada após o preflight de cada ambiente. Não houve correção automática de dados.
>
> **Diferença/motivo:** O preflight do Development retornou zero inconsistências, permitindo aplicar as duas proteções nesse ambiente. A09 foi implementado separadamente, sem misturar regras de produto com a integridade estrutural.
>
> **Verificação:** `bun run db:migrations:check`, testes de contrato das migrations e `db:migrations:inspect` passaram; as constraints rejeitaram combinações inválidas em transações revertidas.

# 9.7 Não remover imediatamente as FKs simples

Na primeira migration, é aceitável manter:

```text
FK simples existente
+
FK composta nova
```

Depois que a constraint estiver comprovada em produção, uma simplificação pode ser avaliada separadamente.

Não misturar limpeza estrutural com correção crítica.

---

# 9.8 Sort order

Adicionar invariantes de banco:

```text
modules.sort_order > 0
lessons.sort_order > 0
```

Antes:

consultar se existem `<= 0`.

Se existirem:

STOP para investigar.

---

> **Relatório de implementação — status: parcial.**
>
> **Feito:** Authoring passou a rejeitar sort order não positivo e reorder deixou de usar temporários negativos.
>
> **Não feito:** Não foi adicionado `CHECK sort_order > 0` no banco.
>
> **Diferença/motivo:** O reorder foi corrigido antes da futura constraint para evitar conflito dentro da própria transação.
>
> **Verificação:** Testes de input e actions passaram.

# 9.9 Títulos

Adicionar, se não houver dados legados incompatíveis:

```text
trim(courses.title) <> ''
trim(modules.title) <> ''
trim(lessons.title) <> ''
```

A validação principal continua no servidor.

Constraint é defesa adicional.

---

# 9.10 Schema

Atualizar:

```text
src/db/schema.ts
```

para refletir exatamente as constraints da migration.

O schema Drizzle e o banco não podem discordar.

---

> **Relatório de implementação — status: não alterado estruturalmente.**
>
> **Feito:** O schema existente foi usado como evidência para a análise.
>
> **Não feito:** Não foram adicionadas FKs/checks novos.
>
> **Diferença/motivo:** Alterar o schema sem migration validada quebraria a compatibilidade operacional.
>
> **Verificação:** `bun run db:migrations:check` passou sem migration nova.

# 9.11 Migration

Depois de alterar schema:

```bash
bun run db:generate
bun run db:migrations:check
```

Ler o SQL gerado inteiro.

Não aplicar:

```text
db:push
```

em ambiente compartilhado.

---

# 9.12 Testes

Criar teste de schema/migration que prove:

```text
module publication/course mismatch → FK violation
lesson/module publication mismatch → FK violation
sort_order 0 → check violation
```

Também testar via Server Action:

```text
moduleId do Curso A
courseId manipulado para Curso B
→ rejeitado
```

---

> **Relatório de implementação — status: parcial.**
>
> **Feito:** Testes de Server Action, ownership, movimento entre Cursos e reorder foram adicionados.
>
> **Não feito:** Não existem ainda testes de violação contra PostgreSQL real para FKs compostas/checks.
>
> **Diferença/motivo:** Esses testes só podem ser finalizados depois da migration e do banco de validação.
>
> **Verificação:** Testes unitários e de contrato passaram.

# 10. PR 06 — Validar todo input administrativo no servidor

## Problema

Parte do authoring depende de:

```text
required
min
hidden input
select
```

do navegador.

Isso é UX, não regra de servidor.

---

> **Relatório de implementação — status: COMPLETO NO ESCOPO DE AUTHORING — APROVADO.**
>
> **Feito:** A entrada do authoring passou a validar IDs UUID, inteiros, status, booleanos e listas de reordenação no limite das ações administrativas de conteúdo. A validação ocorre antes de consultas ao banco e antes do processamento de conteúdo ou uploads.
>
> **Não feito:** Não foram alteradas ações administrativas independentes de Course/Módulo/Aula, como Financeiro, FAQ e banners; elas permanecem com seus próprios contratos. Não foi adicionado um schema monolítico para substituir todos os contratos existentes.
>
> **Diferença/motivo:** Foi criado um parser pequeno e reutilizável em `authoring-input.ts`, sem adicionar Zod ou duplicar regras. O `courseId` continua opcional apenas no formulário de criação de Curso; quando presente, precisa ser UUID.
>
> **Verificação:** Testes de parser, authoring, actions e disponibilidade passaram; typecheck e Ultracite também passaram.

# 10.1 Dependência

`zod` já faz parte do projeto.

Não adicionar nova biblioteca de validação.

---

> **Relatório de implementação — status: preservado.**
>
> **Feito:** Nenhuma biblioteca nova foi adicionada.
>
> **Não feito:** Não foi introduzido Zod adicional nem duplicada regra de domínio.
>
> **Diferença/motivo:** Parsers puros foram suficientes para o escopo atual e reduziram dependências.
>
> **Verificação:** Typecheck e lockfile permaneceram válidos.

# 10.2 Criar módulo dedicado

Sugestão:

```text
src/features/admin/authoring-input.ts
```

ou:

```text
src/features/admin/authoring-schema.ts
```

Não colocar todos os schemas dentro de `authoring.ts`, que já é grande.

---

> **Relatório de implementação — status: implementado.**
>
> **Feito:** Foi criado `src/features/admin/authoring-input.ts` com testes próprios.
>
> **Não feito:** Não foi criado um schema monolítico dentro de `authoring.ts`.
>
> **Diferença/motivo:** A separação reduz complexidade no arquivo de authoring e torna os parsers reutilizáveis.
>
> **Verificação:** Testes de `authoring-input` passaram.

# 10.3 Course schema

Validar no mínimo:

```text
title.trim().length > 0
workload override válido
price válido
payment methods
installment count
access duration
status/availability permitidos
IDs UUID quando aplicável
```

Reutilizar parsers de domínio existentes em vez de duplicar regra.

---

> **Relatório de implementação — status: implementado no escopo de Course authoring.**
>
> **Feito:** Título, duração de acesso, workload override, pagamento numérico e `courseId` opcional passaram a ser validados no servidor. Ações de publicação, certificado e pasta JMVStream também validam o `courseId` antes da operação.
>
> **Não feito:** Não foi criado um parser genérico para todos os campos de ações administrativas fora do authoring de Course; os presets de disponibilidade continuam usando sua allowlist existente.
>
> **Diferença/motivo:** O identificador ausente continua significando criação; somente um identificador presente é validado como UUID.
>
> **Verificação:** Testes de authoring, parser e ações passaram; typecheck passou.

# 10.4 Module schema

Validar:

```text
moduleId UUID quando presente
courseId UUID
title não vazio
sortOrder inteiro > 0
releaseMode enum
releaseDelayDays inteiro válido
status enum
```

Mesmo depois do schema:

`courseId` de edição não deve virar autoridade sobre ownership.

Isso pertence ao PR anterior.

---

> **Relatório de implementação — status: implementado.**
>
> **Feito:** Título, `courseId`, `moduleId` quando presente, ordem positiva, modo de liberação, atraso estritamente decimal, status e ownership foram validados no servidor.
>
> **Não feito:** Nenhuma alteração de produto foi adicionada ao fluxo de edição ou movimentação de Módulos.
>
> **Diferença/motivo:** O parser é aplicado na Server Action antes de chamar o authoring; a checagem de ownership continua sendo responsabilidade da operação transacional.
>
> **Verificação:** Testes adversariais de módulo e casos de formatos numéricos incomuns passaram.

# 10.5 Lesson schema

Preservar os bons erros específicos existentes.

Validar:

```text
lessonId UUID
moduleId UUID
title não vazio
sortOrder > 0
isRequired boolean
status conhecido
```

---

> **Relatório de implementação — status: implementado.**
>
> **Feito:** `moduleId` obrigatório, `lessonId` opcional, título, ordem positiva, booleano `isRequired`, status, duração não negativa e identificadores das ações de vídeo foram validados antes de processar conteúdo ou mídia.
>
> **Não feito:** O conteúdo rico continua usando seus parsers específicos; não foi criado um contrato monolítico para todo o FormData da Aula.
>
> **Diferença/motivo:** A validação de ID ficou na entrada da Server Action, enquanto a Aula existente continua passando pela conferência de Publicação e Curso alvo.
>
> **Verificação:** Testes de authoring, input e ações passaram.

# 10.6 Erros

Não transformar toda validação em:

```text
throw new Error("invalid")
```

Manter mensagens que indiquem:

```text
campo
motivo
```

Para aula, continuar aproveitando:

```text
LessonAuthoringError
```

quando fizer sentido.

---

> **Relatório de implementação — status: implementado.**
>
> **Feito:** Foram mantidos `LessonAuthoringError` e mensagens com campo/motivo nos parsers.
>
> **Não feito:** Não foi uniformizado todo erro legado do arquivo.
>
> **Diferença/motivo:** A mudança foi cirúrgica para não alterar contratos de erro fora do escopo.
>
> **Verificação:** Testes verificam mensagens de campos inválidos.

# 10.7 Testes adversariais

Não testar apenas formulário normal.

Criar `FormData` manualmente.

Casos:

```text
title = ""
title = "   "
sortOrder = "0"
sortOrder = "-1"
sortOrder = "abc"
moduleId inválido
courseId inválido
status arbitrário
isRequired inesperado
```

---

> **Relatório de implementação — status: implementado.**
>
> **Feito:** Foram cobertos vazio, espaços, zero, negativo, decimal/texto inválido, notação numérica incomum, UUID inválido, listas de UUID, status arbitrário, booleanos e hidden inputs.
>
> **Não feito:** Não foram enumeradas todas as combinações possíveis de objetos malformados recebidos pelas ações de upload; cada operação de provider continua com sua validação própria.
>
> **Diferença/motivo:** UUIDs de Course/Módulo/Aula agora têm parser dedicado antes do banco; a validação final de existência e ownership continua no banco e no domínio.
>
> **Verificação:** Testes de `authoring-input`, authoring, actions e disponibilidade passaram.

# 10.8 Hidden inputs

Adicionar pelo menos um teste cuja intenção seja explicitamente:

> hidden input é dado não confiável.

---

> **Relatório de implementação — status: implementado.**
>
> **Feito:** Os parsers e as ações foram preparados para tratar hidden inputs, IDs de reordenação e valores enviados fora do navegador como não confiáveis.
>
> **Não feito:** Não foi criado um teste E2E de adulteração de requisição; os testes unitários de `FormData` cobrem a fronteira lógica.
>
> **Diferença/motivo:** A proteção foi colocada antes do authoring e dos efeitos externos, mantendo o fluxo simples.
>
> **Verificação:** Testes adversariais de `FormData` passaram.

---

# 11. PR 07 — Eliminar race condition de slug

## Problema

Hoje existe:

```text
SELECT slug
↓
livre
↓
mais tarde INSERT
```

Duas requisições podem escolher o mesmo slug.

---

# 11.1 Não capturar qualquer erro `23505`

Isso pode esconder conflitos de outras constraints.

---

> **Relatório de implementação — status: COMPLETO — APROVADO; teste concorrente real pendente.**
>
> **Feito:** A alocação usa advisory lock global durante a transação e consulta/inserção no mesmo client.
>
> **Não feito:** Não foi adicionado retry genérico de qualquer `23505`.
>
> **Diferença/motivo:** Retry amplo poderia mascarar conflito de outra constraint; o lock resolve a corrida de slug da aplicação.
>
> **Verificação:** Teste de slug confirma a ordem transacional e a seleção de sufixos; a concorrência com dois clientes PostgreSQL reais permanece como validação operacional pendente.

# 11.2 Estratégia recomendada para este projeto

O projeto já utiliza advisory locks.

Mover a alocação de slug para a mesma transação da criação e serializar pelo slug-base.

Fluxo:

```text
BEGIN

baseSlug = createCourseSlug(title)

pg_advisory_xact_lock(hash(baseSlug))

consultar slugs base/base-2/base-3...
escolher disponível

INSERT course
INSERT publication
audit

COMMIT
```

Duas criações cujo título gera o mesmo `baseSlug` serão serializadas.

---

> **Relatório de implementação — status: implementado.**
>
> **Feito:** O lock `course-slug-allocation` é adquirido antes de procurar candidatos.
>
> **Não feito:** Não foi adicionado lock de linha inexistente, que não resolveria `foo` versus `foo-2`.
>
> **Diferença/motivo:** O lock global cobre o pool de slugs e evita colisão entre candidatos gerados pela aplicação.
>
> **Verificação:** Testes de authoring verificam o advisory lock.

# 11.3 Alterar helper

Hoje:

```text
resolveUniqueCourseSlug(title)
```

usa pool global.

Alterar para algo como:

```text
resolveUniqueCourseSlug(client, title)
```

e só chamá-lo dentro da transação.

---

# 11.4 Teste concorrente

Usar PostgreSQL real de teste.

Disparar duas transações concorrentes para:

```text
"Curso Teste"
"Curso Teste"
```

Resultado:

```text
curso-teste
curso-teste-2
```

Nenhuma requisição deve falhar.

---

> **Relatório de implementação — status: completo no código; teste concorrente real pendente.**
>
> **Feito:** Há teste de contrato do lock e seleção dentro da transação, e a criação real usa o mesmo client desde `BEGIN` até `COMMIT`.
>
> **Não feito:** Não foi executado teste concorrente com dois clientes PostgreSQL reais.
>
> **Diferença/motivo:** O ambiente disponível permite validar o caminho transacional, mas o teste com dois clientes simultâneos deve rodar no PostgreSQL efêmero da CI para não inserir dados de teste no Development.
>
> **Verificação:** Migrations, typecheck, lint e suíte unitária passaram.

# 12. PR 08 — Fazer preview administrativo abrir materiais privados

## Problema

Admin pode visualizar a aula como aluno, mas download/preview R2 exige matrícula real.

---

> **Relatório de implementação — status: COMPLETO — APROVADO; E2E de navegador pendente.**
>
> **Feito:** O preview administrativo agora preserva `preview=student` nos links da Aula, materiais, thumbnails e navegação. Os Route Handlers distinguem o contexto Admin do contexto de Aluno e usam autorização própria.
>
> **Não feito:** Não foi ampliado o acesso público, não foi removida a proteção de matrícula e não foi executada a jornada E2E em navegador real.
>
> **Diferença/motivo:** Foi criada autorização explícita para Admin em preview, separada do caminho de Aluno; `support` continua sem esse acesso.
>
> **Verificação:** 55 testes de preview, download, autorização, navegação e página administrativa passaram; a ausência do E2E ficou registrada como lacuna de assurance.

# 12.1 Não remover a segunda checagem

Não resolver assim:

```text
remover assertProtectedLessonAccess()
```

Isso diminuiria segurança do aluno.

---

> **Relatório de implementação — status: preservado.**
>
> **Feito:** A checagem server-side continua ocorrendo no Route Handler.
>
> **Não feito:** Não foi confiada apenas na query de conteúdo nem no parâmetro de URL.
>
> **Diferença/motivo:** Preview é contexto de autorização, não segredo; o recurso continua privado e sem cache.
>
> **Verificação:** Testes verificam 404 para contexto indevido.

# 12.2 Criar autorização explícita de preview

Existem dois contextos legítimos.

> **Relatório de implementação — status: implementado.**
>
> **Feito:** Foi criado `assertAdminPreviewLessonAccess`, conferindo Aula, Módulo e Publicação.
>
> **Não feito:** Não foi criado acesso para suporte.
>
> **Diferença/motivo:** Admin preview é autorizado somente quando a sessão e o parâmetro são válidos.
>
> **Verificação:** Testes de autorização passaram.

### Aluno

```text
session student
+
matrícula real
+
lesson allowed
```

### Admin preview

```text
session admin
+
preview=student
+
aula pertence à publicação visualizada
```

---

# 12.3 Propagar preview para URLs de recurso

Hoje os helpers geram:

```text
/api/lessons/:lessonId/resources/:resourceId/download
```

Modificar a cadeia:

```text
LessonMainContent
→ LessonContentFrame
→ LessonResources
→ LessonResourceItem
→ getLessonResourceHref()
```

para conhecer `previewMode`.

Em preview:

```text
...?preview=student
```

Fazer o mesmo com:

```text
/preview
```

do thumbnail/material.

---

> **Relatório de implementação — status: implementado.**
>
> **Feito:** Download e thumbnail/preview recebem `preview=student` quando o contexto é administrativo.
>
> **Não feito:** Links externos não receberam parâmetro desnecessário.
>
> **Diferença/motivo:** A propagação ficou centralizada no helper de URL existente.
>
> **Verificação:** Teste adicional cobre fallback de erro preservando o preview.

# 12.4 Route Handlers

Arquivos:

```text
src/app/api/lessons/[lessonId]/resources/[resourceId]/download/route.ts

src/app/api/lessons/[lessonId]/resources/[resourceId]/preview/route.ts
```

Ler query param.

Se:

```text
session.role === admin
AND preview válido
```

usar a política de preview.

Caso contrário:

continuar exigindo matrícula real.

---

> **Relatório de implementação — status: implementado.**
>
> **Feito:** Rotas aceitam query, mantêm `private, no-store` e devolvem 404 para recurso/contexto inválido.
>
> **Não feito:** Não foi feita validação visual no browser.
>
> **Diferença/motivo:** A autorização fica em duas camadas: workspace e acesso ao recurso.
>
> **Verificação:** Testes direcionados e suíte completa passaram.

# 12.5 Não autorizar support

O preview atual é de admin.

Não ampliar implicitamente para:

```text
support
```

sem regra de produto.

---

# 12.6 Testes

```text
student matriculado → 302
student não matriculado → 404
admin sem preview → 404
admin preview=student → 302
support preview=student → rejeitado
resource de outra aula → 404
resource inexistente → 404
```

E2E:

```text
admin
→ Ver como aluno
→ aula com PDF
→ abrir material
→ sucesso
```

---

> **Relatório de implementação — status: implementado sem E2E.**
>
> **Feito:** Admin válido, admin sem preview, aluno, suporte, módulo futuro, R2 indisponível e preview inválido foram cobertos.
>
> **Não feito:** Não houve teste de browser real.
>
> **Diferença/motivo:** O comportamento de Route Handler foi validado por testes de unidade.
>
> **Verificação:** Testes de rotas passaram.

# 13. PR 09 — Corrigir inconsistências pequenas de UX e copy

Este PR não deve alterar regras de negócio.

---

# 13.1 CTA “Rever trilha”

Arquivo:

```text
src/app/(student)/app/cursos/[courseId]/page.tsx
```

Hoje:

```text
progress 0 → Iniciar curso
qualquer outro → Rever trilha
```

mesmo quando o link aponta para uma próxima aula.

Centralizar em:

```text
src/features/courses/presentation.ts
```

Regra:

```text
0% + next lesson       → Iniciar curso
>0% + next lesson      → Continuar curso
sem next lesson        → Rever trilha
```

Dashboard e overview devem utilizar o mesmo helper.

---

> **Relatório de implementação — status: implementado.**
>
> **Feito:** CTA agora escolhe iniciar, continuar ou rever conforme progresso e próxima aula.
>
> **Não feito:** Não foi criado um campo público separado para cada tipo de próxima Aula; a navegação visual e a recomendação pós-conclusão têm responsabilidades diferentes.
>
> **Diferença/motivo:** A recomendação do PR 02 agora considera a decisão aprovada, enquanto este PR mantém a copy de iniciar, continuar ou rever sem reimplementar a regra de acesso.
>
> **Verificação:** Testes da página, apresentação e próxima recomendação passaram.

> **Relatório de implementação — identificação de obrigatoriedade: implementado.**
>
> **Feito:** A trilha mostra o texto sutil `Obrigatória` ou `Opcional` ao lado da duração, abaixo do título e fora da thumbnail; a página da Aula mostra a mesma identificação antes da descrição, no cabeçalho.
>
> **Não feito:** Não foi usado somente ícone, porque o texto é mais claro e acessível; não foi criado um destaque visual grande nem uma badge sobre a thumbnail.
>
> **Diferença/motivo:** A identificação continua presente tanto na trilha quanto dentro da Aula, mas foi refinada para texto inline e discreto: ao lado do tempo na trilha e antes da descrição na página, reduzindo a competição visual com a imagem e com as ações principais.
>
> **Verificação:** Teste do componente `LessonCard` cobre os dois estados; os dados vêm de `is_required` no servidor.

# 13.2 Fallback de descrição e certificado

Hoje um curso sem subtitle/description pode dizer:

```text
conclua o curso para liberar o certificado
```

mesmo com:

```text
certificateEnabled = false
```

Corrigir:

> **Relatório de implementação — status: implementado.**
>
> **Feito:** Fallback é condicional a `certificateEnabled`.
>
> **Não feito:** Não foi criada nova regra de emissão.
>
> **Diferença/motivo:** A UI não promete certificado quando o recurso está desligado.
>
> **Verificação:** Testes cobrem certificado ligado e desligado.

### Certificado ligado

```text
"... conclua o curso para liberar o certificado."
```

### Certificado desligado

```text
"... acompanhe seu progresso e conclua sua trilha."
```

---

# 13.3 Não inferir “certificado pronto” apenas de 100%

Em:

```text
getCourseAccessPresentation()
```

existe helper:

```text
"Certificado pronto para emitir ou baixar."
```

baseado apenas em:

```text
progressPercent >= 100
```

Isso não conhece:

- `certificateEnabled`;
- existência de template;
- emissão;
- `render_status`;
- falha de render.

Não permitir que um helper genérico de progresso faça promessa sobre estado do certificado.

Substituir por algo neutro:

```text
"Todas as aulas obrigatórias foram concluídas."
```

Estado de certificado deve ser apresentado apenas em componente que realmente possua:

```text
certificateEnabled
certificateCode
certificateStatus
certificateRenderStatus
```

---

> **Relatório de implementação — status: preservado e esclarecido.**
>
> **Feito:** A UI usa o estado do certificado para pronto, preparação, falha ou revogação.
>
> **Não feito:** Não foi criada emissão baseada somente no percentual.
>
> **Diferença/motivo:** Progresso vivo e certificado histórico permanecem conceitos separados.
>
> **Verificação:** Testes de apresentação e certificado passaram.

# 13.4 Testes

`presentation.test.ts`:

```text
0 + next → Iniciar
50 + next → Continuar
100 + no next → Rever
100% não afirma certificado ready
```

Render test:

```text
certificate disabled + no description
→ texto não menciona certificado
```

---

> **Relatório de implementação — status: implementado.**
>
> **Feito:** Foram adicionados testes de labels, href, fallback e estado de certificado.
>
> **Não feito:** Não houve E2E visual.
>
> **Diferença/motivo:** A validação ficou em funções e Server Components testáveis sem abrir URL local.
>
> **Verificação:** Testes direcionados passaram.

# 14. PR 10 — Criar cobertura real de navegação por teclado

Axe já existe e deve ser preservado.

Este trabalho é complementar.

---

# 14.1 Novo arquivo recomendado

```text
tests/e2e/keyboard-accessibility.spec.ts
```

Não transformar `accessibility.spec.ts` em um arquivo gigante.

---

> **Relatório de implementação — status: não implementado.**
>
> **Feito:** A lacuna foi confirmada e documentada; testes de acessibilidade axe existentes foram preservados.
>
> **Não feito:** Não foi criado novo arquivo de keyboard journeys.
>
> **Diferença/motivo:** Não havia ambiente E2E e a instrução do projeto proíbe abrir URL local como apoio visual.
>
> **Verificação:** O relatório classifica A15 como assurance gap.

# 14.2 Jornada 1 — Login

Usar teclado para:

```text
focar e-mail
digitar
Tab
digitar senha
Tab
Enter
```

Confirmar entrada no dashboard.

---

# 14.3 Jornada 2 — Dashboard do aluno

Com teclado:

```text
Tab até um curso
Enter
```

Confirmar página correta.

Depois:

```text
Tab até Continuar
Enter
```

---

# 14.4 Jornada 3 — Aula

Verificar:

- foco no controle de conclusão;
- navegação mobile/details quando aplicável;
- links anterior/próxima;
- foco visível;
- nenhuma aula bloqueada recebe interação indevida.

---

# 14.5 Jornada 4 — Admin

Cobrir:

```text
abrir dialog de módulo
percorrer inputs
alterar campo
fechar com Escape
```

Confirmar que o foco retorna ao trigger.

Depois testar salvar pelo teclado.

---

# 14.6 Jornada 5 — Certificado

Percorrer:

```text
curso
→ certificado
→ ação pública
```

sem mouse.

---

> **Relatório de implementação — status: não executado.**
>
> **Feito:** Foi revisada a existência de testes de contrato e interações parciais.
>
> **Não feito:** Login, dashboard, aula, admin e certificado não foram percorridos end-to-end por teclado.
>
> **Diferença/motivo:** Axe não foi tratado como prova suficiente, em linha com o W3C.
>
> **Verificação:** Nenhum claim de conformidade WCAG foi feito.

# 14.7 Dialogs/dropdowns

Sempre verificar:

```text
trigger focado
abre
foco entra no modal
Tab fica contido quando apropriado
Escape fecha
foco volta ao trigger
```

---

# 14.8 Axe continua

Não remover os testes atuais.

Precisamos dos dois:

```text
axe
+
keyboard journeys
```

---

> **Relatório de implementação — status: preservado.**
>
> **Feito:** Os scans axe existentes continuam no projeto.
>
> **Não feito:** Não foi ampliado o escopo para substituir julgamento humano.
>
> **Diferença/motivo:** A ferramenta é útil para sinais automatizados, não para provar jornadas completas.
>
> **Verificação:** A suíte atual passou; E2E continua pendente.

# 14.9 Teste manual

Criar pequena seção no runbook de acessibilidade com:

- teclado;
- zoom;
- leitor de tela básico quando disponível;
- mobile;
- reduced motion.

Não declarar:

```text
“WCAG compliant”
```

apenas porque os testes passaram.

---

> **Relatório de implementação — status: não executado.**
>
> **Feito:** A necessidade de teste manual foi mantida no plano.
>
> **Não feito:** Não foi feita inspeção visual, browser ou teste manual nesta sessão.
>
> **Diferença/motivo:** Isso respeita a restrição explícita de não abrir URL local.
>
> **Verificação:** A pendência está explicitamente registrada.

# 15. PR 11 — Corrigir envelhecimento de `release-state.md`

## Problema

O arquivo contém checkpoints históricos que usam linguagem como:

```text
“O commit atual de main é...”
```

Essas frases envelhecem assim que `main` avança.

---

> **Relatório de implementação — status: confirmado e corrigido.**
>
> **Feito:** O documento misturava checkpoint observado com estado atual.
>
> **Não feito:** Não foi atualizado automaticamente para HEAD nem declarado como deploy atual.
>
> **Diferença/motivo:** A linguagem passou a registrar o momento observado, preservando deployed/verified/documented como conceitos distintos.
>
> **Verificação:** Testes de contrato operacional e `docs:check` passaram.

# 15.1 Não atualizar `deployed_commit` para HEAD indiscriminadamente

`main` e Production não são sinônimos.

Preservar a distinção já documentada entre:

```text
deployed
verified
documented
```

---

> **Relatório de implementação — status: preservado.**
>
> **Feito:** O SHA documentado não foi substituído por HEAD.
>
> **Não feito:** Não foi afirmado deploy de código que não foi publicado.
>
> **Diferença/motivo:** Essa distinção evita falsificar estado operacional.
>
> **Verificação:** O relatório identifica o snapshot auditado e a branch de implementação separadamente.

# 15.2 Corrigir linguagem temporal

Trocar:

```text
“O commit atual de main é X”
```

por:

```text
“No checkpoint de 2026-09-03, main apontava para X.”
```

Todo bloco histórico deve dizer quando aquele fato foi observado.

---

> **Relatório de implementação — status: implementado.**
>
> **Feito:** O texto foi alterado para “último checkpoint operacional documentado” e “no checkpoint”.
>
> **Não feito:** Não foi reescrita a história de deploy.
>
> **Diferença/motivo:** A correção é temporal, não uma tentativa de sincronização automática.
>
> **Verificação:** Testes de documentação operacional passaram.

# 15.3 Frontmatter

Continuar tratando o frontmatter como estado observado, não como espelho automático de HEAD.

Não fazer CI sobrescrever o arquivo automaticamente.

---

# 15.4 `docs:check`

Adicionar regra que impeça novas frases perigosas nesse documento, por exemplo:

```text
commit atual de main
main atual é
staging atual é
```

dentro de seções históricas sem escopo temporal.

O checker deve procurar padrões de linguagem, não exigir:

```text
documented_commit == HEAD
```

porque isso seria semanticamente incorreto.

---

> **Relatório de implementação — status: implementado.**
>
> **Feito:** O checker agora cobre todos os caminhos canônicos listados no índice.
>
> **Não feito:** Não foi criado gate de deploy novo além do contrato existente.
>
> **Diferença/motivo:** Foi adicionada validação dinâmica da cobertura do mapa canônico.
>
> **Verificação:** `bun run docs:check` aprovou 41 documentos.

# 15.5 Critério

Daqui a três meses, uma pessoa deve conseguir ler um checkpoint antigo sem confundi-lo com estado atual.

---

# 16. PR 12 — Confirmar e endurecer a garantia de CI do SHA promovido

Este item foi reclassificado após nova análise.

---

# 16.1 O que NÃO fazer

Não adicionar:

```yaml
on:
  push:
    branches: [main]
```

à CI completa.

Isso contradiz o desenho atual.

Existem testes inclusive exigindo que CI não rode em `push`.

---

# 16.2 O modelo correto

Preservar:

```text
PR candidate
↓
CI no SHA
↓
merge em staging
↓
homologação do SHA
↓
release verifica candidato
↓
fast-forward de main para o mesmo SHA
```

---

> **Relatório de implementação — status: implementado.**
>
> **Feito:** O release normal exige CI/check-run do SHA exato candidato.
>
> **Não feito:** Não foi adicionada CI pesada em push para main.
>
> **Diferença/motivo:** O fallback para SHA de PR foi removido porque não prova a árvore promovida.
>
> **Verificação:** Testes de workflows e contrato Vercel passaram.

# 16.3 Arquivos

```text
.github/workflows/ci.yml
.github/workflows/deploy-vercel.yml

src/tooling/release-workflows.test.ts
src/tooling/simplified-release-flow.test.ts

docs/operations/testing-and-ci.md
docs/operations/release-flow.md
```

---

# 16.4 Confirmar a garantia normal

Adicionar ou fortalecer um teste que não procure apenas texto genérico:

```text
check-runs?check_name=CI
```

Ele deve provar que, no caminho:

```text
mode = release-staging
```

o SHA utilizado na promoção é exatamente o candidato previamente validado.

---

# 16.5 Casos que o teste deve impedir

Falhar se alguém mudar futuramente para:

```text
pegar qualquer CI verde da branch
```

em vez de:

```text
CI verde para candidate_sha
```

Falhar se:

```text
main
```

puder ser avançada para um SHA diferente depois da verificação.

---

> **Relatório de implementação — status: implementado.**
>
> **Feito:** Workflows de deploy, migration e cleanup rejeitam ausência de CI no SHA exato.
>
> **Não feito:** Não foi testado contra GitHub real nem executado deploy.
>
> **Diferença/motivo:** A garantia foi fortalecida estaticamente sem alterar o fluxo de branches.
>
> **Verificação:** Testes de contrato passaram.

# 16.6 Hotfix

Preservar a regra já existente:

```text
hotfix precisa de CI própria
```

e:

```text
hotfix não pode incluir migration
```

---

> **Relatório de implementação — status: implementado.**
>
> **Feito:** Hotfix agora exige CI bem-sucedida para o SHA exato de `main` e mantém label/limite de migration.
>
> **Não feito:** Não foi criado nem executado hotfix real.
>
> **Diferença/motivo:** O comportamento fail-closed foi mantido.
>
> **Verificação:** Testes de release passaram.

# 16.7 Critério de pronto

Não é “mais CI”.

É:

> provar automaticamente que nenhum SHA não testado consegue chegar a Production pelo fluxo normal.

---

# 17. Revisão arquitetural transversal depois dos PRs

Depois das correções, fazer uma revisão específica para procurar regra duplicada.

---

> **Relatório de implementação — status: parcialmente concluído.**
>
> **Feito:** Foram revisados progresso, sequência, workload, vídeo e ownership sem tocar pagamentos, grants, enrollment ou histórico.
>
> **Não feito:** Sequência opcional, cobertura real, constraints e E2E continuam pendentes.
>
> **Diferença/motivo:** A revisão transversal não transformou decisões não ratificadas em código.
>
> **Verificação:** O relatório consolidado lista A01-A22 e os STOPs.

# 17.1 Progresso

Buscar:

```bash
git grep -n "completedCount"
git grep -n "progressPercent"
git grep -n "requiredLesson"
git grep -n "isRequired"
```

Para cada fórmula, perguntar:

> deveria esta função calcular progresso ou deveria consumir a projeção canônica?

---

# 17.2 Sequência

Buscar:

```bash
git grep -n "isLessonAvailable"
git grep -n "nextLessonId"
git grep -n "getNextAvailable"
```

Verificar que nenhum chamador voltou a usar apenas IDs ignorando `isRequired`.

---

# 17.3 Carga horária

Buscar:

```bash
git grep -n "workloadHours"
git grep -n "workload_hours"
git grep -n "totalDurationSeconds"
```

Classificar:

```text
workload oficial
duration calculada
snapshot histórico
```

---

# 17.4 Vídeo

Buscar:

```bash
git grep -n "watchedPercent"
git grep -n "maxPosition"
git grep -n "coveragePercent"
```

Depois da migração não deve existir variável ambígua chamada `watchedPercent` se ela na verdade representar posição.

---

# 17.5 Ownership estrutural

Buscar todas as mutações de:

```text
modules.course_id
modules.course_publication_id
lessons.module_id
lessons.course_publication_id
```

Verificar que nenhuma action aceita o relacionamento vindo diretamente do cliente sem revalidar.

---

# 18. Testes de contrato que devem existir ao final

Criar uma suíte mental de invariantes.

## Invariante 1

```text
progress dashboard
==
progress course
==
progress module policy
==
certificate eligibility policy
```

---

## Invariante 2

```text
optional != prerequisite
```

a menos que futuramente exista configuração explícita dizendo o contrário.

---

## Invariante 3

```text
max playback position
!=
watched coverage
```

---

## Invariante 4

```text
workload oficial
=
override
??
published snapshot
```

---

## Invariante 5

```text
draft nunca altera uma verdade pública antes de publish
```

salvo campos explicitamente definidos como live.

---

## Invariante 6

```text
module.course_id
==
module.coursePublication.course_id
```

---

## Invariante 7

```text
lesson.course_publication_id
==
lesson.module.course_publication_id
```

---

## Invariante 8

```text
FormData
!=
trusted data
```

---

## Invariante 9

```text
admin preview pode visualizar
admin preview não pode mutar progresso
```

---

## Invariante 10

```text
Production SHA
==
SHA homologado
==
SHA cuja CI foi comprovada
```

no fluxo normal.

---

> **Relatório de implementação — status: respeitado.**
>
> **Feito:** Certificados, CourseCompletion, Pagamentos, Outbox, R2 e Auth não foram refatorados incidentalmente.
>
> **Não feito:** Não foram feitos ajustes oportunistas fora da auditoria.
>
> **Diferença/motivo:** A redução de escopo protege contra regressões em domínios não comprovadamente defeituosos.
>
> **Verificação:** A suíte completa permaneceu verde.

# 19. O que não deve ser refatorado junto

Para reduzir risco, não aproveitar estes PRs para reescrever subsistemas que já estão bons.

Preservar:

## Certificados

Não reescrever:

- lifecycle;
- snapshot;
- code generation;
- render lease;
- outbox;
- SHA-256;
- revogação;
- reemissão.

Modificar apenas pontos diretamente necessários para progresso/carga horária.

---

## CourseCompletion

Preservar:

```text
conclusão histórica != percentual atual
```

Não transformar conclusão histórica em valor recalculado.

---

## Pagamentos

Não tocar incidentalmente em:

- Asaas;
- grants;
- enrollment projection;
- financial evidence;
- refund;
- review.

---

## Outbox

Não substituir por efeitos síncronos.

---

## R2

Não tornar material público para corrigir preview.

---

## Auth

Não alterar Better Auth/RBAC para resolver validação de FormData.

São problemas diferentes.

---

> **Relatório de implementação — status: executado parcialmente.**
>
> **Feito:** Foram executados testes focados por domínio e depois `bun run verify:quick`.
>
> **Não feito:** Não foi executado `bun run verify` completo nem E2E.
>
> **Diferença/motivo:** A ordem prática foi adaptada às limitações de banco e browser.
>
> **Verificação:** Quick verification passou.

# 20. Ordem de testes por PR

Durante desenvolvimento:

```bash
bun run test -- <arquivo focado>
```

ou comando Vitest equivalente usado pelo projeto.

Depois dos testes focados:

```bash
bun run typecheck
bun run check
```

Antes do PR:

```bash
bun run verify:quick
```

Antes de considerar mudança crítica pronta:

```bash
bun run verify
```

---

> **Relatório de implementação — status: bloqueado.**
>
> **Feito:** A regra de não aplicar migration sem preflight foi seguida.
>
> **Não feito:** Nenhuma migration nova foi gerada, aplicada ou enviada.
>
> **Diferença/motivo:** Sem dados reais, não é possível garantir que constraints não quebrem legado.
>
> **Verificação:** `db:migrations:check` passou para o conjunto existente.

# 21. PRs que envolvem migration

Para qualquer PR com alteração em:

```text
src/db/schema.ts
src/db/migrations
```

seguir obrigatoriamente:

```bash
bun run db:generate
bun run db:migrations:check
```

Aplicar a migration apenas em PostgreSQL descartável para desenvolvimento/testes.

Usar:

```text
db:migrate:e2e
```

ou fluxo local documentado.

Nunca testar a migration diretamente em Production.

---

> **Relatório de implementação — status: não executado.**
>
> **Feito:** O checklist foi mantido como próximo passo operacional.
>
> **Não feito:** Não houve consulta de inconsistências, backfill, `db:generate` ou teste real de violação.
>
> **Diferença/motivo:** O STOP de dados foi aplicado.
>
> **Verificação:** Nenhuma alteração estrutural foi feita.

# 22. Checklist específico para a migration de integridade

Antes da migration:

```text
[ ] zero modules com course/publication mismatch
[ ] zero lessons com module/publication mismatch
[ ] zero module sort_order <= 0
[ ] zero lesson sort_order <= 0
[ ] zero titles vazios, caso a constraint seja adicionada
```

Depois:

```text
[ ] migration em banco vazio
[ ] migration em fixture E2E
[ ] migration em cópia compatível do schema existente
[ ] db:migrations:check verde
[ ] schema Drizzle == SQL
```

---

> **Relatório de implementação — status: parcial.**
>
> **Feito:** Curso normal, progresso, workload, preview e estados de certificado foram cobertos por funções, SQL mocks e testes de componentes.
>
> **Não feito:** Aula opcional pulável, scheduled release em browser, expiração e revogação não foram percorridos E2E.
>
> **Diferença/motivo:** A validação de servidor não substitui a jornada real.
>
> **Verificação:** 415 arquivos e 2.819 testes passaram.

# 23. Checklist de regressão da experiência do aluno

Depois dos PRs de domínio:

## Curso normal

```text
[ ] iniciar curso
[ ] concluir aula
[ ] avançar
[ ] voltar para aula concluída
```

## Aula opcional

```text
[ ] aparece na trilha
[ ] pode ser aberta
[ ] não bloqueia required
[ ] não altera denominador
```

## Scheduled release

```text
[ ] módulo futuro continua bloqueado
[ ] optional não atravessa time lock
```

## Acesso expirado

```text
[ ] continua bloqueado
```

## Revogado

```text
[ ] continua bloqueado
```

## Certificado

```text
[ ] conclusão continua histórica
[ ] emissão automática continua idempotente
[ ] pending/ready/failed continuam corretos
```

---

> **Relatório de implementação — status: parcialmente implementado.**
>
> **Feito:** Casos adversariais de FormData, ownership, cross-course, slug e reorder foram testados.
>
> **Não feito:** Não houve PostgreSQL real para constraints e concorrência.
>
> **Diferença/motivo:** Ações administrativas foram endurecidas sem alterar o banco.
>
> **Verificação:** Testes de authoring passaram.

# 24. Checklist de regressão de authoring

```text
[ ] criar curso
[ ] editar curso
[ ] criar draft
[ ] publicar
[ ] criar módulo
[ ] editar módulo
[ ] reordenar módulos
[ ] criar aula
[ ] editar aula
[ ] reordenar aulas
[ ] mudar required/optional
[ ] publicar nova versão
```

Confirmar principalmente que as novas constraints não quebram operações legítimas.

---

> **Relatório de implementação — status: não executado.**
>
> **Feito:** Contratos de analytics e mensagens de erro foram revisados.
>
> **Não feito:** Não houve deploy, leitura de logs ou observação de Production.
>
> **Diferença/motivo:** Sem release real não seria correto afirmar comportamento operacional.
>
> **Verificação:** Nenhum dado de Production foi consultado.

# 25. Checklist de observabilidade depois do deploy

As mudanças não devem simplesmente “parar de lançar exceção”.

Observar em Staging:

```text
lesson save failed
course publication failed
module update failed
resource preview 404
video watch persistence failure
certificate issuance failure
```

Verificar Sentry/logs após exercitar as jornadas.

Nenhum novo erro relevante deve aparecer.

---

> **Relatório de implementação — status: não executado.**
>
> **Feito:** A ordem de rollout foi preservada como plano para as migrations e E2E futuras.
>
> **Não feito:** Não houve rollout, Staging, smoke test ou promoção.
>
> **Diferença/motivo:** A branch continua não publicada.
>
> **Verificação:** Estado Git confirma ausência de commit/push.

# 26. Estratégia de rollout

## Etapa 1

PRs sem migration:

```text
progress
optional/progression
UX
```

São mais fáceis de validar.

---

## Etapa 2

Tracking de vídeo.

Ele altera persistência e analytics e merece homologação isolada.

---

## Etapa 3

Carga horária.

Homologar draft vs published antes de avançar.

---

## Etapa 4

Constraints relacionais + validação de authoring.

É o ponto de maior risco de migration.

---

## Etapa 5

Preview, acessibilidade e documentação operacional.

---

> **Relatório de implementação — status: respeitado.**
>
> **Feito:** Foram interrompidos migration, sequência opcional e cobertura real quando faltavam dados ou decisão.
>
> **Não feito:** Não foram contornados os STOPs por backfill automático ou suposição de produto.
>
> **Diferença/motivo:** A implementação priorizou reversibilidade e evidência.
>
> **Verificação:** Nenhuma ação destrutiva ou externa foi executada.

# 27. Condições STOP gerais

O executor deve interromper e pedir revisão se encontrar qualquer uma destas situações.

## STOP 1

Um achado do relatório não reproduz mais no SHA atual.

Não implementar “a correção” de algo que já não existe.

---

## STOP 2

Migration encontra dados inconsistentes existentes.

Não fazer backfill automático sem entender a origem.

---

## STOP 3

A correção exigiria alterar:

```text
payment lifecycle
certificate historical semantics
grant/enrollment ledger
```

sem ser estritamente necessária.

---

## STOP 4

Aula opcional tem hoje algum uso real que depende de bloquear a seguinte.

Pesquisar fixtures/dados antes.

---

## STOP 5

Existem cursos ativos com zero aulas obrigatórias e certificado habilitado.

Isso exige decisão específica.

---

## STOP 6

Se o tracking de vídeo não fornecer eventos suficientes para construir uma
fronteira linear minimamente confiável, parar antes da migration e validar o
player real.

Para a solução aprovada:

```text
skip não avança a fronteira
reprodução normal avança a fronteira
tempo reproduzido continua sendo analytics
```

Não transformar posição máxima em progresso validado e não inventar cobertura
por ranges.

---

## STOP 7

Alguma constraint composta conflita com o modelo real de publicação.

Revisar ADR-0007 antes de forçar o banco.

---

> **Relatório de implementação — status: parcial.**
>
> **Feito:** Progresso, workload, authoring, preview, documentação e CI foram corrigidos no código.
>
> **Não feito:** Vídeo de cobertura real, integridade estrutural de banco, acessibilidade E2E e deploy real continuam pendentes.
>
> **Diferença/motivo:** Não foi declarado “pronto para Production” sem os gates externos.
>
> **Verificação:** Quick verification e docs check passaram; full verification/E2E não foram executados.

# 28. Critério de conclusão global

Este plano só deve ser considerado encerrado quando todos os itens abaixo forem verdadeiros.

### Progresso

```text
[ ] dashboard/course/module usam mesma política
[ ] opcionais não entram no denominador
[ ] opcionais não bloqueiam required
```

### Vídeo

```text
[ ] posição de retomada, posição máxima, fronteira linear e tempo são distintos
[ ] seek não vira progresso linear
[ ] skip não altera a retomada sem reprodução posterior
[ ] tempo após skip entra nos analytics
[ ] threshold é 100% em código/teste/docs
[ ] end não ignora threshold
[ ] manual completion continua disponível
[ ] origem manual/automática é identificável
```

### Workload

```text
[ ] draft não vaza carga para published
[ ] override aparece ao aluno
[ ] certificado usa mesmo valor oficial
[ ] snapshots históricos permanecem imutáveis
```

### Dados

```text
[ ] module/course/publication protegidos no servidor
[ ] module/course/publication protegidos no banco
[ ] lesson/module/publication protegidos no banco
[ ] sortOrder inválido é rejeitado
```

### Authoring

```text
[ ] title vazio rejeitado server-side
[ ] IDs manipulados rejeitados
[ ] enums/números validados
```

### Concorrência

```text
[ ] duas criações iguais geram slugs distintos sem erro
```

### Preview

```text
[ ] admin preview abre R2
[ ] aluno sem acesso continua recebendo 404
```

### UX

```text
[ ] iniciar/continuar/rever são semanticamente corretos
[ ] certificado não é prometido quando desabilitado
[ ] 100% sozinho não afirma PDF pronto
```

### Acessibilidade

```text
[ ] axe continua verde
[ ] jornadas principais funcionam por teclado
```

### Operação

```text
[ ] release-state não possui “estado atual” histórico enganoso
[ ] CI continua PR-only
[ ] SHA promovido continua exigindo evidência de CI do mesmo SHA
```

---

> **Relatório de implementação — status: parcialmente aproximado.**
>
> **Feito:** O código agora separa progresso obrigatório, workload oficial, posição de vídeo, preview e autorização server-side.
>
> **Não feito:** Ainda faltam constraints compostas, API de progressão opcional e modelo de cobertura.
>
> **Diferença/motivo:** A arquitetura desejada foi usada como direção, mas não foram inventadas decisões ausentes.
>
> **Verificação:** O relatório consolidado contém as dependências para completar a arquitetura.

# 29. Definição final de arquitetura desejada

Quando todo o plano estiver implementado, as dependências conceituais devem se aproximar disto:

```text
CoursePublication
       │
       ├── Module
       │     │
       │     └── Lesson
       │
       ↓
Canonical Learning Projection
       │
       ├── completion progress
       ├── progression availability
       ├── next required lesson
       └── module progress
       │
       ├── dashboard
       ├── course overview
       ├── lesson workspace
       └── certificate eligibility
```

Carga horária:

```text
Published CoursePublication
       │
       └── derived workload
                │
                ↓
Course effective workload
       = override ?? published derived value
                │
                ├── dashboard
                ├── course page
                ├── catalog
                └── future certificate snapshot
```

Vídeo:

```text
player event
    │
    ├── resume position
    ├── maximum observed position
    ├── validated linear frontier
    └── playing time
             │
             ↓
       validated progress
             │
             ├── analytics
             └── auto completion = 100%

manual completion
             │
             └── continua independente
```

Relacionamentos:

```text
Course
  │
  └── CoursePublication
          │
          └── Module
                 │
                 └── Lesson
```

Essas relações devem ser verdadeiras não apenas porque o TypeScript “normalmente faz isso”, mas porque:

```text
UI
+
Server Action
+
domínio
+
PostgreSQL
+
testes
```

concordam.

---

# 30. Resultado esperado

O objetivo final não é somente corrigir os bugs individualmente.

É remover as condições estruturais que permitiram que eles existissem.

Antes:

```text
várias superfícies
→ várias fórmulas
→ várias verdades
```

Depois:

```text
uma regra de domínio
→ várias projeções
→ mesma verdade
```

Esse é o principal ganho arquitetural deste plano.

> **Relatório de implementação — status: atendido nos escopos liberados.**
>
> **Feito:** Foram implementadas as correções não dependentes de decisão de produto, banco real ou deploy.
>
> **Não feito:** O resultado global ainda não pode ser considerado encerrado enquanto os STOPs permanecerem.
>
> **Diferença/motivo:** Este documento centraliza exatamente o plano original e o estado real de cada item.
>
> **Verificação:** Final: `bun run verify:quick`, `bun run docs:check` e CodeRabbit sem achados.
