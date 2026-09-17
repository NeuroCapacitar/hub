---
status: complete
owner: product-and-engineering
date: 2026-09-17
base_commit: 146909c3f72173ff5b73f11c0229ee8be5e4c194
worktree: codex/ajustes-staging
scope: support-permission-surface-refinement
supersedes: advisor-plans/admin-support-granular-permissions-implementation-plan-2026-09-16.md
---

# Plano: refinamento das permissões de Admin e Suporte

## Resultado pretendido

Admin e Suporte continuam compartilhando a mesma área administrativa. A
diferença passa a ser limitada a três situações:

1. dados cuja leitura é sensível, como Financeiro e Auditoria;
2. alterações que podem mudar estado, acesso, venda, conteúdo ou documento;
3. ações operacionais de recuperação.

O modelo não terá uma permissão configurável para o Painel. O Painel é uma
casca comum e seus cards são montados de acordo com os dados que o sujeito pode
consultar. Um Suporte sem grants ainda consegue trabalhar nas superfícies
operacionais padrão, mas não recebe Financeiro, Auditoria ou alterações
delegáveis por acidente.

Este plano é somente para implementação local em Development. Não autoriza
alteração em Staging ou Production, não cria deploy e não inclui commit ou push.

## Status de execução

| Fase | Status | Evidência |
| --- | --- | --- |
| Fase 0 — contrato e inventário | **COMPLETE** | Worktree/branch/HEAD confirmados; callers de autorização, loaders do Painel, ações amplas e rotas protegidas inventariados sem operação mutável. |
| Fase 1 — catálogo e política | **COMPLETE** | Allowlist reduzida a views financeiras/Auditoria e grants por capacidade; política de defaults para Suporte vazio; 172 testes focados, typecheck e Ultracite aprovados. Callers amplos antigos permanecem somente como compatibilidade até as fases 3/4. |
| Fase 2 — migration e arrays | **COMPLETE** | `0085_superb_wonder_man` gerada e ajustada para limpar arrays configuráveis de Support antes das novas constraints; aplicada no Development durante a Fase 8; checks, migration check, 12 testes de migration, typecheck e Ultracite aprovados. |
| Fase 3 — projeções server-side | **COMPLETE** | Painel facetado sem queries financeiras indevidas; Financeiro exibe somente abas/views autorizadas; Auditoria filtra fontes financeiras no servidor; Operação omite o card financeiro sem view. 75 testes focados, typecheck e Ultracite aprovados. |
| Fase 4 — guards e mutações | **COMPLETE** | Guards amplos substituídos por capacidades granulares/defaults auditados; uploads, Server Actions, Financeiro, Operação, Cursos e Configurações verificados; 219 testes focados, typecheck e Ultracite aprovados. |
| Fase 5 — UI | **COMPLETE** | Modal exibe somente capacidades delegáveis; Financeiro usa views por facet; Configurações, Cursos e editor de Aula preservam superfícies originais em read-only; 38 testes focados, typecheck e Ultracite aprovados. |
| Fase 6 — auditoria e sessões | **COMPLETE** | Auditoria de grants/defaults e filtros por fonte/tipo de alvo; revogação de role preservada; 195 testes focados de política, auditoria, Equipe e projeções aprovados. |
| Fase 7 — testes | **COMPLETE** | Suíte ampla: 450 arquivos e 3.186 testes; migration check, typecheck e Ultracite aprovados. |
| Fase 8 — Development local | **COMPLETE** | Runner oficial aplicou `0085_superb_wonder_man` no Development; auditoria read-only pós-migration marcou todos os checks como `present`, sem operação em Staging/Production. |
| Fase 9 — documentação e gates | **COMPLETE** | ADR, Produto, identidade, decisões, índice e runbook atualizados; `docs:check`, migrations check, typecheck, Ultracite, 450 testes, build, Knip, `bun audit --production` e CodeRabbit contra `staging` aprovados. |

## Validação por pesquisa

Uma pesquisa independente em fontes primárias confirmou o desenho e foi
registrada em
`advisor-plans/admin-support-granular-permissions-research-2026-09-17.md`.
Os pontos aplicados neste plano são:

- deny-by-default continua sendo aplicado a cada recurso e operação, mesmo
  quando o produto decide que uma capacidade é padrão para Admin e Suporte;
- superfície, leitura e ação devem ser decisões separadas;
- esconder cards ou botões não é autorização e não pode substituir filtragem de
  dados no servidor;
- a matriz deve ser centralizada, allowlisted e testada como combinação de
  sujeito, superfície e operação;
- Auditoria é rastreabilidade, não substituto de autorização;
- a migração aprovada deve zerar grants configuráveis antigos e impedir que a
  regra legada continue concedendo acesso por outro caminho.

Fontes primárias usadas na pesquisa: [OWASP Authorization Cheat
Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html),
[OWASP Authorization Testing Automation Cheat
Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Testing_Automation_Cheat_Sheet.html),
[OWASP ASVS V8](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x17-V8-Authorization.md),
[OWASP API Security Top 10](https://api-security.owasp.org/editions/2023/en/0x11-t10/),
[NIST SP 800-53](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final),
[NIST SP 800-162](https://csrc.nist.gov/pubs/sp/800/162/upd2/final) e
[AWS IAM policy evaluation](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic_policy-eval-denyallow.html).

## Decisões confirmadas

- “Todos” significa todos os `admin` e `support`; `student` nunca entra na área
  administrativa.
- O Painel é global para Admin e Suporte e não aparece no modal de permissões.
- Cursos, Alunos, Operação e Aprendizagem têm leitura padrão para Admin e
  Suporte.
- FAQ, mídias da Tela de acesso e Banners do Dashboard têm leitura e alteração
  padrão para Admin e Suporte. Essas mutações continuam auditadas.
- Perfil e assinatura globais de Certificados têm leitura padrão, mas a alteração
  exige grant.
- Financeiro mantém visualizações protegidas e alterações individualmente
  selecionáveis.
- Auditoria mantém visualização protegida e filtra os eventos pelas superfícies
  permitidas ao Suporte.
- Operação tem leitura padrão e uma única permissão configurável para alterar ou
  recuperar qualquer fila operacional.
- Alterações de Cursos, Alunos e Certificados são grants configuráveis.
- Ver é sempre pré-requisito para alterar quando a superfície possui leitura
  protegida. Para superfícies de leitura padrão, esse pré-requisito é implícito.
- O modal deve exibir somente capacidades configuráveis. Acessos padrão não
  devem virar checkboxes desabilitados nem ocupar espaço na matriz.
- Contas Suporte existentes e novas começam sem views ou grants configuráveis.
  Isso não remove os acessos padrão definidos acima.
- Admin continua com todas as capacidades; Equipe, bootstrap, credenciais,
  autenticação e segurança continuam Admin-only.

## O que será removido do modelo configurável

Estas chaves não devem mais ser persistidas como escolha individual do Suporte:

- `viewAdminPanel`;
- `viewLearningAnalytics`;
- `viewCourses`;
- `viewStudents`;
- `viewOperations`;
- `viewSettings`;
- `exportLearningAnalytics`;
- `manageSettings` como grant amplo;
- `manageCourses` como grant amplo.

As capacidades acima não desaparecem necessariamente do runtime. Algumas viram
capacidades internas derivadas, resolvidas pela política base de Admin/Suporte,
mas deixam de ser oferecidas como toggles e de ser armazenadas nos arrays de
grants do Suporte.

## Catálogo final de capacidades configuráveis

Os nomes abaixo são o contrato proposto para a nova allowlist. Antes da
migration, conferir cada nome contra os callers reais; não criar uma chave para
uma ação que não existe no código.

### Visualizações protegidas

Persistidas em `support_permission_views`:

- `viewFinancialAnalysis`: ver análise e indicadores financeiros;
- `viewFinancialOrders`: ver pedidos, detalhes e estados financeiros;
- `viewFinancialReviews`: ver a fila de revisões financeiras;
- `viewAudit`: ver Auditoria administrativa, com escopo filtrado.

O runtime pode derivar `viewFinancials` quando houver qualquer uma das três
visualizações financeiras, mas a página não pode tratar essa derivação como
autorização para carregar todas as seções.

### Alterações de Cursos

Persistidas em `support_permission_grants`:

- `createCourse`: criar Curso pelo catálogo;
- `manageCourseDetails`: alterar dados gerais e configurações editoriais do
  Curso, sem incluir disponibilidade e vendas;
- `manageCourseContent`: criar, editar, ordenar e publicar conteúdo curricular
  conforme os guards existentes;
- `manageCourseAvailability`: alterar visibilidade, estado de entrega e vendas;
- `manageCourseCertificate`: alterar o modelo de Certificado do Curso.

A aba Visão geral permanece somente leitura. A permissão `createCourse` cobre a
ação “Novo curso” do catálogo. Não adicionar uma permissão de exclusão enquanto
não existir uma ação de exclusão suportada pelo produto.

### Alterações de Alunos e Certificados

- `manageEnrollmentSupport`: ajustar validade, bloquear, restaurar e operar o
  suporte normal de Matrículas;
- `manageEnrollmentAccess`: conceder ou revogar acesso integral e operações de
  impacto amplo na Conta ou Matrícula;
- `reissueCertificates`: reemitir o Certificado mais recente de um Aluno;
- `manageCertificateIssuerProfile`: alterar o perfil e a assinatura global
  usados em novas emissões.

`manageEnrollmentSupport` é a capacidade usada tanto na lista de Alunos quanto
na aba “Alunos do Curso”; não duplicar o mesmo grant em dois grupos.

### Alterações de Financeiro

- `executeRefund`: realizar reembolso;
- `manageFinancialOperations`: importar e conciliar operações;
- `manageFinancialReviews`: registrar decisões em revisões financeiras.

Dependências obrigatórias:

- `executeRefund` e `manageFinancialOperations` exigem
  `viewFinancialOrders`;
- `manageFinancialReviews` exige `viewFinancialReviews`;
- qualquer alteração financeira exige a visualização da mesma superfície antes
  de ser autorizada no servidor.

O reembolso continua sendo um item individual dentro do grupo Financeiro, mas
não é um mecanismo separado do sistema de permissões por usuário.

### Alteração de Operação

- `manageOperations`: recuperar webhooks, Outbox, eventos de e-mail e operações
  de vídeo cobertas pela página de Operação.

Não criar um grant separado para cada fila. A leitura das filas permanece
implícita; a única alteração configurável é “Operar Operação”.

### Capacidades padrão, fora do modal

Estas capacidades devem continuar sendo perguntas internas explícitas de
autorização, mas sempre retornar verdadeiro para `admin` e `support`:

- acesso ao Painel;
- leitura de Aprendizagem, Cursos, Alunos, Operação e Configurações padrão;
- leitura das abas de Curso, inclusive Alunos e Certificado;
- leitura de FAQ, mídias de acesso e Banners;
- alteração de FAQ, mídias de acesso e Banners.

O fato de não aparecerem no modal não significa remover o guard server-side.
Cada loader e Server Action continuará declarando a capacidade interna
correspondente, evitando que uma rota sem guard vire uma exceção acidental.

## Semântica do Painel

O `/admin` deve poder ser aberto por qualquer Admin ou Suporte. O servidor deve
calcular um `DashboardAccessScope` a partir da sessão antes de buscar dados.

| Bloco | Regra de leitura | Comportamento sem acesso |
| --- | --- | --- |
| Receita bruta e pedidos pagos | `viewFinancialAnalysis` ou `viewFinancialOrders`, conforme o dado | Não consultar nem renderizar |
| Pedidos pendentes, disputas e estado de pagamento | `viewFinancialOrders` | Ocultar card e link |
| Revisões financeiras | `viewFinancialReviews` | Ocultar sinal e link |
| Reembolsos pendentes/incertos | `viewFinancialOrders` | Ocultar sinal e link |
| Alunos, acessos e vencimentos | leitura padrão de Alunos | Renderizar |
| Saúde do catálogo | leitura padrão de Cursos | Renderizar |
| Certificados pendentes ligados ao catálogo | leitura padrão de Cursos | Renderizar |
| Vídeos, e-mails, webhooks e Outbox | leitura padrão de Operação | Renderizar |
| Sinais financeiros dentro de Operação | view financeiro específico do sinal | Ocultar somente o sinal financeiro |
| Solicitações de suporte | leitura padrão de Operação | Renderizar |

Regras de implementação:

1. `getAdminOverview` e `getAdminDashboardProjection` não podem continuar
   buscando o pacote financeiro completo para qualquer Suporte.
2. Separar queries ou receber um escopo explícito para que cada consulta só seja
   executada quando seu facet estiver autorizado.
3. Componentes do Painel devem aceitar dados opcionais por facet e omitir o
   card inteiro quando o facet não existir.
4. Links para Financeiro, filtros financeiros e descrições financeiras também
   devem desaparecer junto com o card.
5. O Painel não deve usar valor `0` como substituto de dado não autorizado.

## Semântica das rotas

- Sidebar sempre mostra Painel, Aprendizagem, Cursos, Alunos, Operação e
  Configurações para Admin/Suporte.
- Sidebar mostra Financeiro somente quando houver pelo menos uma view financeira.
- Sidebar mostra Auditoria somente quando houver `viewAudit`.
- Equipe permanece exclusiva de Admin.
- Uma rota padrão pode renderizar todas as suas superfícies em modo leitura; os
  botões e formulários de alteração usam os grants correspondentes.
- Financeiro deve renderizar somente as abas/seções autorizadas, e não apenas
  desabilitar dados não permitidos.
- Auditoria deve filtrar no servidor por categoria de superfície antes de
  paginar, contar ou carregar detalhes.
- Acesso direto a Financeiro ou Auditoria sem a view correspondente deve usar a
  política existente de redirecionamento seguro, sem renderizar dados parciais.

## Plano de implementação por fases

### Fase 0 — congelar o contrato e os callers

1. Conferir que a worktree continua em `codex/ajustes-staging` baseada em
   `origin/staging` `146909c3f72173ff5b73f11c0229ee8be5e4c194`.
2. Não alterar a branch `staging`, Production ou qualquer deploy.
3. Atualizar o inventário de todos os usos de:
   - `requirePermission`;
   - `canPerform`;
   - `manageCourses`, `manageSettings`, `manageContent`;
   - `viewFinancials`, `viewAudit` e permissões derivadas;
   - loaders do Painel, Financeiro, Auditoria, Operação e Configurações.
4. Confirmar quais ações realmente existem antes de criar cada chave. Em
   especial, não inventar exclusão de Curso nem novos fluxos de reembolso.
5. Registrar qualquer caller que misture duas superfícies e precise ser
   dividido antes de receber um grant.

**STOP:** não iniciar migration se houver uma ação sem superfície definida,
uma operação sensível sem decisão ou uma chave antiga que ainda seja autoridade
em outro caminho.

### Fase 1 — catálogo tipado e política central

Arquivos principais:

- `src/lib/support-permissions.ts`;
- `src/lib/auth-policy.ts`;
- `src/lib/auth-permissions.ts`;
- `src/lib/session.ts`;
- `src/app/(admin)/admin/layout.tsx`;
- `src/app/api/auth/redirect/route.ts`.

Passos:

1. Substituir as allowlists antigas pelas views financeiras/auditoria e pelos
   grants granulares definidos acima.
2. Criar metadados centralizados para grupo, rótulo, descrição, tipo (`view` ou
   `change`), dependência de view e superfície de auditoria.
3. Separar três conceitos no código:
   - capacidade runtime;
   - capacidade padrão do Suporte;
   - grant configurável persistido.
4. Fazer `admin` passar em todas as capacidades e `student` em nenhuma
   capacidade administrativa.
5. Fazer `support` passar nas capacidades padrão e somente nos grants/views
   persistidos para as capacidades delegáveis.
6. Remover `viewAdminPanel` como requisito configurável. O Suporte deve abrir o
   Painel mesmo com arrays vazios.
7. Fazer `hasAdminSurfaceAccess` e `getAdminLandingPath` refletirem a nova
   regra; Suporte sem grant deve cair no Painel.
8. Garantir que grants de Financeiro exijam a view financeira correta, não
   apenas uma view financeira qualquer.
9. Manter `manageContent` Admin-only onde ele ainda representar comentários,
   publicação especial ou operação não separada; usar `manageCourseContent`
   somente para autoria curricular aprovada.

Testes antes de continuar:

- Suporte vazio vê Painel, Aprendizagem, Cursos, Alunos, Operação e
  Configurações.
- Suporte vazio não vê Financeiro nem Auditoria.
- Suporte vazio pode consultar e alterar FAQ, Banners e mídias de acesso.
- Suporte vazio não pode alterar Curso, Matrícula, Financeiro, Operação ou
  Certificado global.
- Cada grant financeiro falha sem sua view dependente.
- Admin mantém o comportamento completo.
- Student continua sem qualquer capacidade administrativa.

### Fase 2 — migration aditiva e limpeza dos arrays antigos

Arquivos principais:

- `src/db/schema.ts`;
- nova migration posterior à `0084_support_permission_views`;
- snapshot e journal gerados pelo fluxo oficial;
- testes de migration e checks de estado.

Passos:

1. Atualizar os checks para aceitar somente as novas views e grants.
2. Gerar uma migration aditiva; não editar, apagar ou renumerar migrations
   aplicadas.
3. Converter o contrato das colunas existentes sem criar novos campos se os
   arrays atuais forem suficientes.
4. Limpar `support_permission_views` e `support_permission_grants` de todos os
   Support existentes, conforme a decisão Q7.
5. Garantir arrays vazios para Admin e Student.
6. Manter `NOT NULL`, default vazio, deduplicação e check de allowlist.
7. Não persistir permissões padrão de leitura ou escrita; elas pertencem à
   política de base.
8. Verificar a migration em banco descartável antes de usar o Development.

Verificações SQL mínimas, sem imprimir PII:

- quantidade de perfis por role com arrays não vazios;
- quantidade de itens fora da allowlist;
- quantidade de duplicidades;
- combinação inválida entre grant financeiro e view dependente;
- existência das constraints e do default vazio.

**STOP:** qualquer divergence do journal, migration desconhecida, array antigo
não mapeado ou necessidade de reset destrutivo.

### Fase 3 — loaders e filtragem server-side

Arquivos principais:

- `src/app/(admin)/admin/(dashboard)/page.tsx`;
- `src/features/admin/server.ts`;
- `src/app/(admin)/admin/financeiro/page.tsx`;
- loaders e páginas de Auditoria, Operação e Configurações;
- `src/features/admin/audit-filters.ts` e `audit-presentation.ts`.

Passos:

1. Criar um escopo de leitura derivado da sessão no servidor; nunca aceitar
   escopo enviado por hidden input, query string ou componente Client.
2. Dividir `getAdminOverview` e `getAdminDashboardProjection` em facets ou
   aplicar condições SQL por facet.
3. Fazer a página do Painel renderizar cards somente quando recebeu o facet
   autorizado.
4. Dividir Financeiro em análise, pedidos e revisões; cada loader deve exigir a
   view correspondente e retornar somente sua projeção.
5. Ocultar tabs, filtros, contagens, exportações e detalhes de Financeiro sem a
   view da superfície.
6. Fazer Operação esconder apenas os sinais financeiros quando o Suporte não
   tiver a view financeira; as filas técnicas continuam visíveis.
7. Fazer Auditoria mapear cada evento para uma superfície e aplicar o filtro
   antes de `count`, paginação, busca detalhada ou abertura do sheet.
8. Remover qualquer caminho que carregue um objeto financeiro completo e só
   depois tente esconder campos na UI.
9. Manter Configurações, Cursos, Alunos e Aprendizagem em leitura padrão,
   preservando as projeções sanitizadas atuais.

### Fase 4 — guards e mutações granulares

Arquivos principais:

- `src/features/admin/actions.ts`;
- `src/features/admin/course-availability-actions.ts`;
- `src/features/payments/actions.ts`;
- componentes/ações de Financeiro, Alunos, Cursos e Configurações;
- `src/features/admin/staff-actions.ts`.

Passos:

1. Trocar `manageCourses` por grants específicos em cada Server Action:
   criação, detalhes, conteúdo, disponibilidade e certificado.
2. Separar ações de edição de Curso de ações de leitura e publicação que tenham
   regra diferente.
3. Trocar `manageSettings` por:
   - capacidade padrão auditada para FAQ;
   - capacidade padrão auditada para mídias;
   - capacidade padrão auditada para Banners;
   - `manageCertificateIssuerProfile` para perfil/assinatura global.
4. Trocar ações de Alunos para os grants de matrícula, acesso e reemissão.
5. Trocar Financeiro para `executeRefund`, `manageFinancialOperations` e
   `manageFinancialReviews`, com dependência de view específica.
6. Trocar todas as recuperações de Operação para `manageOperations`.
7. Garantir que cada ação execute o guard no servidor antes de banco, storage,
   provedor externo, revalidação ou auditoria.
8. Garantir que FAQ, mídia e Banners continuem auditando ator, alvo, before/after
   e motivo/correlação quando o fluxo já exigir esses dados.
9. Não liberar publicação, segurança, equipe, credenciais, bootstrap,
   impersonação ou manutenção de banco para Suporte.
10. Manter Aprendizagem como leitura padrão e não criar grant separado para
    exportação, conforme a decisão aprovada. Antes de liberar o export para
    Suporte, confirmar que o relatório continua agregado; se o contrato passar
    a devolver dados identificáveis por Aluno, interromper essa parte e tratá-la
    como uma nova decisão de produto.

### Fase 5 — UI das páginas e componentes originais

Passos:

1. Manter os componentes originais para leitura padrão, usando estado disabled
   ou read-only apenas nos grants de escrita que faltarem.
2. Remover texto alternativo que substitua completamente previews, thumbnails,
   tabelas ou formulários quando a pessoa pode consultar a superfície.
3. No modal de Equipe, renderizar somente grupos configuráveis:
   - Cursos;
   - Alunos;
   - Financeiro;
   - Operação;
   - Auditoria;
   - Configurações de Certificados.
4. Não renderizar grupos de Painel, Aprendizagem, Cursos-read, Alunos-read,
   Operação-read, FAQ, Banners ou Tela de acesso.
5. Em Financeiro, exibir views e alterações em pares por superfície; alterações
   ficam desabilitadas enquanto a view dependente não estiver marcada.
6. Para grants de escrita com leitura padrão, exibir somente o controle de
   alteração, sem checkbox redundante de leitura.
7. Remover qualquer controle nativo do browser em favor dos componentes shadcn
   existentes no projeto.
8. Manter o corpo do modal com scroll interno, cabeçalho e rodapé fixos.
9. Atualizar o resumo da Equipe para contar somente views protegidas e grants
   configuráveis; não sugerir que a conta não possui os acessos padrão.

### Fase 6 — Auditoria, sessões e revogação

1. Alterações de grants/views continuam transacionais, com before/after, ator,
   alvo, motivo e correlação.
2. Mudança de grant passa a valer na próxima resolução server-side sem revogar
   sessão por padrão.
3. Mudança de role continua revogando as sessões do alvo.
4. Concessões e remoções de acesso padrão não devem ser simuladas como grants no
   banco.
5. FAQ, Banners e mídias devem registrar alterações feitas por Support, mesmo
   sem toggle configurável.
6. A consulta de Auditoria deve impedir que detalhes de um evento financeiro
   apareçam para Support sem a view financeira correspondente.
7. Testar acesso direto a endpoint, Server Action e URL, não apenas visibilidade
   do sidebar.

### Fase 7 — matriz de testes

Adicionar ou atualizar testes para cada combinação relevante:

1. Política pura:
   - Admin completo;
   - Student sem Admin;
   - Support vazio;
   - Support somente `viewFinancialOrders`;
   - Support somente `viewFinancialReviews`;
   - Support com Auditoria;
   - Support com cada grant de Curso, Aluno e Operação.
2. Painel:
   - cards financeiros ausentes sem Financeiro;
   - cards financeiros presentes com a view correta;
   - queries financeiras não executadas quando o facet não foi autorizado;
   - links e contagens coerentes com os cards.
3. Financeiro:
   - análise, pedidos e revisões isolados;
   - reembolso sem `viewFinancialOrders` rejeitado;
   - revisão sem `viewFinancialReviews` rejeitada.
4. Auditoria:
   - eventos padrão visíveis para Support autorizado;
   - eventos financeiros filtrados sem view financeira;
   - detalhes e paginação não vazam contagens filtradas.
5. Mutations:
   - FAQ, Banners e mídias permitidos e auditados sem grant;
   - cada alteração de Curso exige seu grant;
   - alterações de Alunos exigem o grant correto;
   - `manageOperations` cobre todas as filas aprovadas;
   - ações sem grant falham mesmo com FormData manual.
6. Equipe:
   - modal lista somente capacidades configuráveis;
   - dependências financeiras funcionam;
   - Support não acessa Equipe;
   - último Admin, autoalteração, role change e revogação permanecem protegidos.
7. Layout:
   - permissões continuam roláveis no modal;
   - cabeçalho e rodapé permanecem acessíveis;
   - controles continuam shadcn e acessíveis por teclado.

### Fase 8 — migração e Development local

1. Conferir branch, worktree, env carregado e alvo do banco antes de qualquer
   comando mutável.
2. Rodar o check oficial de migrations contra o Development configurado.
3. Aplicar somente a nova migration de refinamento pelo runner oficial.
4. Confirmar que Support existente tem arrays configuráveis vazios.
5. Confirmar que Admin/Student não carregam arrays de Support.
6. Confirmar constraints, defaults, allowlists e ausência de duplicidades.
7. Testar login/redirect do Suporte vazio apenas por HTTP/servidor, sem abrir URL
   local visualmente.
8. Não executar seed, reset, SQL manual destrutivo, deploy ou operação em
   Production.

**STOP:** alvo diferente de Development local, erro parcial de migration, arrays
com dados inesperados, retorno de PII em logs ou necessidade de intervenção
manual fora do runbook.

### Fase 9 — documentação e gates finais

Atualizar na mesma mudança de código:

- `docs/adr/0017-support-granular-permissions.md` ou criar ADR de refinamento
  que o superseda;
- `docs/domain/identity-and-authorization.md`;
- `PRODUCT.md`;
- `docs/decisions.md`;
- runbook de migration, se o contrato de Development mudar;
- plano anterior, marcando-o como superseded e apontando para este documento.

Executar:

- `bun run db:migrations:check`;
- `bun run typecheck`;
- `bun x ultracite check`;
- testes focados da autorização, Painel, Financeiro, Auditoria, Equipe e
  migrations;
- `bun run verify:quick`;
- `bun run verify`;
- `bun audit --production`;
- `bun run docs:check`;
- CodeRabbit contra `staging`, se disponível; registrar o motivo caso seja
  pulado.

## Critérios de aceite

- [x] O modal não oferece `viewAdminPanel` nem permissões padrão.
- [x] Suporte vazio entra no Painel e vê somente dados padrão.
- [x] Financeiro e Auditoria não aparecem sem view correspondente.
- [x] Aprendizagem é leitura padrão e não tem grant de exportação separado.
- [x] Exportação de Aprendizagem, se mantida para Suporte, continua agregada e
  não expõe dados identificáveis por Aluno.
- [x] FAQ, Banners e mídias podem ser alterados por Admin/Suporte e são
  auditados.
- [x] Perfil/assinatura global de Certificados exige grant de alteração.
- [x] Cursos têm grants separados para criação, detalhes, conteúdo,
  disponibilidade e certificado.
- [x] Alunos têm leitura padrão e grants separados para matrícula, acesso e
  reemissão.
- [x] Operação tem leitura padrão e um único grant de operação.
- [x] Financeiro tem três views protegidas e três alterações com dependências
  corretas.
- [x] Auditoria filtra no servidor por superfície autorizada.
- [x] O Painel não consulta nem retorna dados financeiros não autorizados.
- [x] Ações não autorizadas falham no servidor mesmo com requisição manual.
- [x] Migration de Development limpa grants/views antigos sem tocar histórico.
- [x] Testes, typecheck, migrations, docs, build, audit e review passam.

## Riscos e mitigação

| Risco | Mitigação |
| --- | --- |
| Suporte com acesso padrão pode alterar conteúdo editorial | Mutação explícita, auditoria obrigatória, before/after e revisão posterior |
| Painel vaza dados por query agregada | Facets autorizados antes da query; nunca usar `0` como máscara |
| Nova matriz deixa um caller antigo usando grant amplo | Inventário de callers, testes de contrato e remoção das chaves antigas |
| Auditoria vira canal lateral para dados financeiros | Filtro server-side por superfície antes de count/paginação/detalhe |
| Migration apaga acesso esperado | Development apenas, arrays antigos verificados antes/depois e plano de recuperação |
| Modal fica complexo demais | Não listar acessos padrão; agrupar somente capacidades configuráveis |
| Mudança de nome quebra política ou dados | Migration aditiva, allowlist central e teste de compatibilidade |

## Evidências que devem ser anexadas ao concluir

- lista de arquivos alterados;
- resultado dos testes por fase;
- resultado da verificação da migration no Development;
- contagens não-PII dos arrays por role;
- confirmação de que nenhuma operação ocorreu em Staging/Production;
- saída de `verify`, `docs:check`, `audit` e review.
