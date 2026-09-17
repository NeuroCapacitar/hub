---
status: superseded
owner: product-and-engineering
date: 2026-09-16
base_commit: 146909c3f72173ff5b73f11c0229ee8be5e4c194
scope: per-user-support-permissions
---

Este plano foi superseded pelo refinamento aprovado em
`advisor-plans/admin-support-permission-refinement-plan-2026-09-17.md`.

# Plano: permissões individuais de Suporte

## Status de execução

| Fase | Status | Evidência |
| --- | --- | --- |
| Fase 0 — base e decisão | **COMPLETE** | Worktree `codex/ajustes-staging` criada sobre `origin/staging` `146909c3`; ADR-0017/DEC-DISC-018 e documentação atualizados. |
| Fase 1 — núcleo tipado e sessão | **COMPLETE** | Allowlist, normalização, sessão e `requirePermission` dinâmico; 122 testes focados, typecheck e Ultracite aprovados. |
| Fase 2 — schema e migration | **COMPLETE** | Migration `0084_support_permission_views` aplicada no Development; visualizações por rota, allowlist ampliada, backfill, snapshot e constraints verificados. |
| Fase 3 — leitura e superfície compartilhada | **COMPLETE** | Sidebar ordenado com Equipe acima de Alunos; visualizações por rota; redirecionamento para a primeira rota autorizada; Configurações e Cursos preservam os componentes originais em estado disabled/read-only. |
| Fase 4 — mutações delegáveis | **COMPLETE** | `manageCourses`, exportação de aprendizagem e vínculo obrigatório entre alteração e visualização de rota adicionados; guards server-side e UI verificados na suíte completa. |
| Fase 5 — Equipe, auditoria e revogação | **IN PROGRESS** | `/admin/equipe` agrupada por rota com views/alterações em controles shadcn; action transacional, auditoria e revogação preservadas; cobertura PostgreSQL descartável ainda pendente. |
| Fase 6 — verificação local | **COMPLETE** | `bun run verify` aprovado até build; Knip aprovado após remoção de export morto; `bun audit --production` sem vulnerabilidades; CodeRabbit contra `staging` sem achados aplicáveis (um alerta sobre journal foi falso positivo e validado contra o arquivo). |
| Fase 7 — Development | **COMPLETE** | `0084_support_permission_views` aplicado pelo runner oficial; visualizações, grants, constraints e backfill auditados sem alteração em Staging/Production. |
| Fase 8 — integração e verificação final | TODO | Banco descartável e gates finais. |

### Evidência adicional do preflight e aplicação Development

O banco `development/neondb` continha as migrations atuais `0080`–`0082`, a
entrada legada `1789584189002` referente à implementação abandonada de
`support_mode` e duas entradas sem fonte no journal atual:
`1785793942565` e `1785974378129`. O runner oficial parou inicialmente antes
de qualquer escrita. Depois foi criada uma compatibilidade local, exclusiva do
Development, com os três pares exatos timestamp/hash; ela preserva o ledger e
não executa SQL histórico desconhecido. O runner oficial então aplicou somente
`0083_support_permission_grants` e depois `0084_support_permission_views`,
seguidos de auditoria do journal, objetos, backfill e combinações inválidas.

## Decisão de escopo

O papel global continua sendo `admin`, `support` ou `student`. Todo `support`
recebe visualizações por rota e alterações delegáveis persistidas por Conta. Não
será criado um quarto papel, grupo,
ACL por Curso, ABAC, engine externo ou permissão arbitrária recebida do cliente.

Esta decisão revisa a proposta anterior de `support_mode = reader | operator`.
O campo legado não será usado como fonte de autorização nesta implementação. A
worktree antiga com `reader/operator` permanece intacta apenas como referência.

## Allowlist inicial

Estas alterações podem ser concedidas individualmente a `support`:

- `executeRefund`;
- `exportLearningAnalytics`;
- `manageCourses`;
- `manageEnrollmentSupport`;
- `reissueCertificates`;
- `manageFinancialOperations`;
- `manageFinancialReviews`.

Ficam permanentemente fora da allowlist: `manageStaffAccess`, bootstrap,
credenciais, autenticação/segurança, manutenção de banco, impersonação,
`manageSettings`, publicação, emissão/revogação de Certificado, bloqueio global
de plataforma, `retryOutbox` e `retryWebhook`. `manageContent` continua
Admin-only; `manageCourses` é o recorte delegável de autoria e disponibilidade
de Cursos.

## Modelo de dados

Adicionar a `profiles` as colunas `support_permission_grants text[] NOT NULL` e
`support_permission_views text[] NOT NULL`, ambas com default vazio. A aplicação
deve normalizar, deduplicar e validar cada lista contra sua allowlist antes de
salvar ou autorizar.

O Postgres deve impor simultaneamente:

1. cada item pertence à allowlist fixa;
2. `admin` e `student` sempre têm array vazio;
3. `support` pode ter array vazio ou qualquer subconjunto válido;
4. não há `NULL`, duplicidade ou valor desconhecido persistido;
5. o backfill de Support existente preserva exatamente as três mutações legadas;
6. Support criado depois começa com array vazio.

A migration nova deve ser gerada depois das migrations `0080_auth_media_slides`,
`0081_free_enrollment_enums` e `0082_free_enrollment_contract` da base atual.
Nunca reutilizar o número `0080` desta worktree antiga. Antes de tocar o banco
Development, comparar o journal remoto com o local e tratar a coluna legada
`support_mode` já existente como compatibilidade, sem reset, drop destrutivo ou
edição de migrations históricas.

## Contrato de autorização

`canPerform(subject, permission)` será a única pergunta de autorização:

- `admin`: todas as capacidades atuais;
- `student`: nenhuma capacidade administrativa;
- `support`: somente as visualizações contidas em `supportPermissionViews` e as
  alterações contidas em `supportPermissionGrants`; uma alteração exige a
  visualização da rota correspondente. O Painel exige todas as visualizações.

`requirePermission` deve carregar a sessão uma vez e avaliar o sujeito completo;
não pode derivar autorização dinâmica por `rolesForPermission`. Campos hidden,
disabled, sidebar ou payload do cliente nunca são fonte de segurança.

`getCurrentSession` deve ler views e grants do perfil no servidor. A sessão Better Auth
continua sendo identidade; views e grants não entram em cookie/token como autoridade de
negócio. Alteração de views ou grants passa a valer na próxima resolução server-side. Uma
mudança de papel continua revogando as sessões do alvo.

## Gestão pela Equipe

`/admin/equipe` continua Admin-only e trabalha apenas com Contas existentes. A
projeção retorna nome, e-mail, papel, views, grants e último acesso; nunca senha, token,
chave, URL assinada ou payload de autenticação.

O comando transacional deve:

1. exigir `manageStaffAccess` e motivo;
2. validar papel, views e grants no servidor;
3. rejeitar qualquer view ou grant fora das allowlists;
4. exigir visualização da rota para cada alteração;
5. limpar views e grants ao transformar a Conta em `admin` ou `student`;
6. impedir autoalteração e remoção do último Admin;
7. revogar sessão somente quando o papel mudar;
8. auditar before/after, ator, alvo, motivo e correlação na mesma transação;
9. revalidar a Equipe e o Dashboard após commit.

## Execução por fases

### Fase 0 — base, decisão e inventário

- Confirmar `origin/staging` em `146909c3` como base fixa.
- Manter a worktree `codex/ajustes` antiga sem alterações adicionais.
- Registrar ADR e decisão de produto para grants individuais.
- Inventariar `AuthPermission`, `requirePermission`, `canPerform`, loaders,
  Server Actions, Route Handlers, UI e testes na base atual.
- Listar explicitamente cada mutação delegável e cada superfície Admin-only.

**STOP:** base local diferente da base fixa, migration numerada em conflito,
caller com contrato incompatível ou allowlist ainda ambígua.

### Fase 1 — núcleo tipado e sessão

- Criar `SupportPermission` derivado da allowlist constante.
- Criar parser/normalizador puro para grants desconhecidos, duplicados, `NULL` e
  entrada não-array; qualquer valor inválido deve falhar fechado.
- Alterar `AuthorizationSubject` e `AppSession` para transportar grants seguros.
- Fazer `getCurrentSession` buscar grants junto do perfil.
- Alterar `requirePermission` para avaliar o sujeito completo.
- Atualizar todos os callers de `canPerform` para passar a sessão/sujeito.
- Remover a dependência de `rolesForPermission` onde ela impedir autorização por
  usuário.

### Fase 2 — schema e migration aditiva

- Adicionar a coluna array no schema Drizzle.
- Gerar a migration no número posterior a `0082`.
- Implementar a allowlist/check no Postgres sem enum por permission.
- Fazer backfill idempotente dos Support existentes com as três capacidades
  atuais; demais papéis recebem array vazio.
- Adicionar teste estático do schema, da migration e das combinações válidas.
- Validar em banco descartável preparado, nunca em Staging/Production.

### Fase 3 — leitura e superfície compartilhada

- Separar capacidades `view*` das mutações em cada loader.
- Preservar projeções sanitizadas de certificados, mídia, auditoria e analytics.
- Manter `viewAudit` restrito e `viewGlobalAudit` Admin-only.
- Manter exportações, provider calls, comentários e operações técnicas com guards
  próprios.
- Unificar navegação e Dashboard somente onde a permissão de leitura permitir.

### Fase 4 — mutações delegáveis

- Migrar somente callers aprovados para `requirePermission` dinâmico.
- Manter publicação, configurações, segurança, equipe e operações técnicas
  Admin-only.
- Verificar que cada Server Action e Route Handler repete o guard no servidor.
- Não usar grants para liberar uma mutação que mistura leitura sensível, segredo,
  publicação e edição sem antes separar o caso de uso.

### Fase 5 — Equipe, auditoria e revogação

- Adaptar parser, projeção e action da Equipe para grants.
- Renderizar toggles somente para `DELEGABLE_SUPPORT_PERMISSIONS`.
- Testar grant vazio, grant único, combinação múltipla, remoção, duplicidade e
  valor desconhecido.
- Testar mudança de grant sem logout e mudança de papel com revogação.
- Testar concorrência, último Admin, autoalteração e consistência role/grants.

### Fase 6 — verificação local

- Rodar policy/session/read-model/mutation tests para Admin, Student, Support sem
  grants e Support com cada grant.
- Iniciar `bun run dev` com o ambiente Development oficial, sem copiar `.env`.
- Fazer smoke HTTP não visual de redirect/guards; não criar contas reais nem
  executar seed/reset remoto.
- Rodar migrations check, typecheck, Ultracite, docs check, build e Knip.
- Rodar `bun audit --production` e CodeRabbit quando o diff estiver fechado.

### Fase 7 — Development remoto somente para o schema

- Conferir branch, hostname, journal e existência da migration antes de operar.
- Reconciliar o banco Development que recebeu a migration antiga de `support_mode`;
  não apagar dados nem reordenar histórico aplicado.
- Aplicar somente a migration nova com `bun run db:migrate:development`.
- Verificar coluna, constraint, backfill e ausência de combinações inválidas sem
  retornar PII.

**STOP:** alvo inesperado, ledger divergente sem procedimento aprovado, perfil
inconsistente, migration parcialmente aplicada ou necessidade de SQL manual.

### Fase 8 — integração descartável e verificação final

- Executar a suíte PostgreSQL somente em banco descartável já preparado.
- Provar concessão/revogação de grants e concorrência sem alterar o Development
  compartilhado.
- Rodar `bun run verify`, `bun audit --production` e `bun run docs:check`.
- Marcar a fase completa somente com todos os gates aprovados e sem risco de
  downgrade para código que ignore os grants.

## Critérios de conclusão

- [ ] `origin/staging` atual é a base da branch de trabalho.
- [ ] ADR/decisão descrevem grants individuais e a allowlist não delegável.
- [ ] Postgres e TypeScript rejeitam grants desconhecidos.
- [ ] Support existente preserva as três mutações anteriores.
- [ ] Support novo começa sem mutações.
- [ ] Leitura base não depende de grants de escrita.
- [ ] `requirePermission` usa o sujeito completo em todas as fronteiras.
- [ ] Equipe não expõe credenciais e não permite autoalteração/último Admin.
- [ ] Grant-only aplica na próxima requisição sem exigir logout.
- [ ] Mudança de papel revoga sessões.
- [ ] Dados acadêmicos/comerciais permanecem preservados ao trocar papel.
- [ ] Testes unitários, integração descartável, build, lint, docs e audit passam.
- [ ] Nenhum commit, push, Staging ou Production foi alterado sem ordem explícita.

## Riscos e decisões fora de escopo

- `text[]` foi escolhido para manter a primeira versão pequena; se surgirem
  expiração, aprovador, escopo ou lifecycle por concessão, migrar para tabela
  normalizada em decisão própria.
- `manageContent` permanece bloqueado até separar publicação de edição.
- A migration antiga de `support_mode` do Development não deve ser apagada ou
  renumerada; sua compatibilidade será tratada no preflight e na migration nova.
- A worktree antiga contém mudanças baseadas em `2bfcf38e` e não pode ser usada
  como fonte para promoção sobre o `staging` atual sem port seletivo.
