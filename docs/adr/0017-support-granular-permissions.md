---
status: accepted
owner: product-and-engineering
last_verified_commit: 146909c3f72173ff5b73f11c0229ee8be5e4c194
---

# ADR-0017: superfície compartilhada e permissões granulares para Suporte

O papel global continua sendo `admin`, `support` ou `student`. Admin e Suporte
compartilham a área administrativa, mas o acesso a dados sensíveis e as
capacidades de alteração são decisões separadas por Conta.

## Decisão

O Painel é uma superfície global para Admin e Suporte e não possui checkbox
próprio. Cursos, Alunos, Aprendizagem, Operação e Configurações padrão têm
leitura compartilhada. FAQ, mídias da Tela de acesso e Banners do Dashboard
também têm leitura e alteração compartilhadas, sempre auditadas.

Financeiro e Auditoria têm visualização protegida. O Financeiro é dividido em
Análise, Pedidos e Revisões; Auditoria filtra fontes e tipos de alvo conforme as
áreas que a Conta pode consultar.

As alterações delegáveis são persistidas em `profiles.support_permission_grants`:

- `createCourse`;
- `manageCourseDetails`;
- `manageCourseContent`;
- `manageCourseAvailability`;
- `manageCourseCertificate`;
- `manageEnrollmentSupport`;
- `manageEnrollmentAccess`;
- `reissueCertificates`;
- `manageCertificateIssuerProfile`;
- `executeRefund`;
- `manageFinancialOperations`;
- `manageFinancialReviews`;
- `manageOperations`.

As visualizações protegidas são persistidas em
`profiles.support_permission_views`:

- `viewFinancialAnalysis`;
- `viewFinancialOrders`;
- `viewFinancialReviews`;
- `viewAudit`.

Alteração financeira exige a view financeira correspondente. As demais
alterações dependem de leituras padrão resolvidas server-side. O modal da
Equipe lista somente capacidades configuráveis; acessos padrão não são
duplicados como checkboxes.

`manageStaffAccess`, bootstrap, credenciais, autenticação/segurança,
manutenção de banco, impersonação, emissão/revogação/reconciliação histórica de
Certificados e operações que não foram explicitamente separadas continuam
Admin-only. `manageContent` permanece Admin-only para moderação de comentários.

`support_permission_views` e `support_permission_grants` são arrays `text[]
NOT NULL DEFAULT '{}'` em `profiles`, validados por TypeScript e PostgreSQL.
Admin e Student sempre persistem arrays vazios. Suportes existentes e novos
começam sem views/grants configuráveis; isso não remove as capacidades padrão
compartilhadas.

Toda rota, loader, Server Action e Route Handler aplica autorização no servidor.
O Painel e Auditoria nunca carregam dados não autorizados para depois escondê-los
no React. Mudança de grant passa a valer na próxima resolução server-side sem
logout; mudança de papel revoga as sessões do alvo.

A área `/admin/equipe` continua Admin-only, não cria Contas ou credenciais e
protege autoalteração e remoção do último Admin. Alterações de acesso registram
before/after, ator, alvo, motivo e correlação.

## Consequências

- `requirePermission` avalia o sujeito completo, não apenas a role.
- Dados financeiros e eventos de Auditoria são filtrados antes de chegar à UI.
- A matriz mantém RBAC próprio com allowlist por usuário; não há ABAC, ACL por
  Curso, engine externo ou plugin Better Auth.
- A migration `0085_superb_wonder_man` limpa grants/views configuráveis antigos
  antes de instalar a allowlist refinada no Development.
- Se surgirem expiração, aprovador, escopo ou lifecycle por grant, uma tabela
  normalizada será discutida em ADR separado.

## Histórico

`DEC-DISC-014` permanece recuperável como histórico do papel operacional fixo
anterior. Esta decisão e a migration 0085 representam o contrato implementado
atual.
