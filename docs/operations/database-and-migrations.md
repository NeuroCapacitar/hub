---
status: canonical
owner: engineering
last_verified_commit: b9cc1bd90419d4ed623b2b9805a48adc840d5957
current_migration_tag: 0085_superb_wonder_man
migration_entry_count: 86
schema_table_count: 50
---

# Banco e migrations

## Ambientes

Production e Staging são branches Neon persistentes e independentes no uso da
aplicação. A CI usa PostgreSQL local e não cria branches Neon.

| Ambiente | Uso | Migration automática |
|---|---|---|
| Development | desenvolvimento compartilhado/local | workflow manual |
| CI | integração e E2E descartáveis | PostgreSQL local do runner |
| Staging | homologação online | operação após `push` em `staging` |
| Production | dados reais | workflow de release |

Branch Git e branch Neon são conceitos diferentes. Trocar a branch Git não
altera o banco conectado.

## Criar migration

Quando `src/db/schema.ts` mudar:

```powershell
bun run db:generate -- --name nome_objetivo
bun run db:migrations:check
```

Revise SQL, journal e snapshot. Nunca edite journal ou snapshot manualmente e
não use `db:push` para acelerar uma release.

`bun run db:migrate:development`, `bun run db:migrate:staging` e
`bun run db:migrate:production` usam o endpoint direto, lock compartilhado e uma
transação por arquivo de migration. `bun run db:migrate:e2e` usa a mesma
separação no banco descartável. A separação é necessária quando uma migration
adiciona um valor de enum que será usado por uma migration posterior; o PostgreSQL
exige que o primeiro `ALTER TYPE ... ADD VALUE` esteja commitado antes desse uso.
Staging, Production e E2E validam os hashes do journal; Development avança pelos
timestamps já registrados, preservando somente linhas históricas cujo hash possa
divergir de uma fonte que não é autoridade. Para registros legados
identificados por timestamp e hash exatos, o runner de Development usa uma
allowlist explícita de compatibilidade: ele reconhece as linhas já aplicadas sem
editar o ledger, reordenar migrations ou executar SQL histórico desconhecido.
Essa compatibilidade nunca é habilitada em Staging, Production ou E2E.
`db:migrations:check` valida a cadeia local e `db:migrations:inspect` audita o banco
somente para leitura.

## Índice do histórico de liberação

A migration `0071_content_release_observability_indexes` adiciona
`enrollment_events_course_event_idx` para a consulta de histórico que filtra
`course_id` e `event_type`. Antes de aplicar em um ambiente com dados grandes,
capture o plano real com o mesmo filtro usado pela publicação:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT EXISTS (
  SELECT 1
  FROM enrollment_events
  WHERE course_id = '<course-id>'
    AND event_type = 'content_release_scheduled'
);
```

Depois da migration, repita o comando e arquive o plano sem dados pessoais.
Aceite a mudança somente se o plano deixar de fazer um `Seq Scan` relevante ou
reduzir o custo/leituras de forma observável; se o ambiente tiver poucos
eventos, registre que o ganho é preventivo e não faça benchmark artificial.

A migration `0072_admin_order_installment_count` adiciona
`orders.payment_installment_count` para preservar a quantidade efetiva de
parcelas retornada pelo agregado Asaas. O campo é opcional porque pedidos
históricos podem ter somente o ID do parcelamento ou não ter passado pelo
enriquecimento do agregado; o limite máximo configurado da oferta não é usado
como substituto da quantidade escolhida.

A migration `0073_strange_inertia` adiciona um índice composto pela data e pelo
ID do Pedido para manter a ordenação paginada do Financeiro determinística e
eficiente. A consulta deve continuar usando os dois campos na mesma ordem;
antes de aplicar em uma base grande, capture o plano real com `EXPLAIN`.

A migration `0074_boring_nitro` cria `financial_events`, uma trilha financeira
append-only com chave idempotente, data de ocorrência, vínculos opcionais ao
Pedido, webhook, reembolso e Revisão, identificadores do Asaas e valores
normalizados. Registros existentes entram como snapshots de backfill marcados
em `metadata`; eles não reconstroem transições anteriores à migration. Triggers
registram criações e mudanças financeiras futuras em Pedido, webhook,
sincronização de movimentações, reembolso e Revisão. Payloads brutos não são
copiados para essa trilha e continuam sujeitos à retenção própria da inbox.

A migration `0075_installment_schedule_and_observed_evidence` adiciona a fonte
`installment` à trilha financeira, persiste as cobranças individuais de um
parcelamento Asaas quando a conciliação as valida e guarda valores observados
nas Revisões de divergência. Datas das parcelas permanecem texto do provedor,
sem assumir fuso horário; ausência de taxa ou líquido continua sendo evidência
incompleta, não taxa zero confirmada.

A migration `0076_linear_validated_video_progress` separa retomada, posição
máxima observada, fronteira linear validada e tempo de reprodução. Ela inicializa
a posição de retomada histórica a partir de `current_seconds`, mas deixa a
fronteira e o tempo validados em zero; portanto, não transforma registros antigos
em prova de reprodução. Também registra a origem manual ou automática da
conclusão e permite agregar tempo de reprodução nos analytics.

A migration `0077_analytics_completion_source` acrescenta a origem manual ou de
vídeo aos eventos brutos de conclusão. O agregado diário continua combinando a
contagem por evento; a origem detalhada permanece na linha de progresso e no
evento bruto dentro do período de retenção.

A migration `0078_protect_module_course_publication_ownership` cria a chave
única composta de `course_publications(id, course_id)` e a chave estrangeira
composta correspondente em `modules(course_publication_id, course_id)`. Antes
de promovê-la a Staging ou Production, executar o preflight de inconsistências
do plano de remediação no banco alvo; qualquer linha divergente exige STOP e
investigação manual antes da migration.

A migration `0079_protect_lesson_module_publication_ownership` cria a chave
única composta de `modules(id, course_publication_id)` e a chave estrangeira
composta correspondente em `lessons(module_id, course_publication_id)`. Ela
impede que uma Aula use um Módulo de uma Publicação e o identificador de outra.
O preflight de Aulas deve ser repetido em cada ambiente antes da promoção;
qualquer divergência exige STOP e investigação manual.

A migration `0080_auth_media_slides` cria a coleção independente da mídia da
tela de acesso. O contrato final é WebP `1200×1050` (8:7), com no máximo cinco
slides, ordem positiva única e chaves sob `auth-media/`. A publicação no
bucket público acontece somente depois da confirmação do objeto privado; a
manutenção repõe cópias ativas e limpa objetos sem referência após a janela
de segurança. Antes de promover, confira também o prefixo público, a URL base
e a permissão exclusiva de Admin descritos no ADR-0015.

A migration `0081_free_enrollment_enums` adiciona os valores
`free_enrollment` e `free_enrollment_granted` aos enums de concessões e
eventos de matrícula. Ela deve ser aplicada separadamente da alteração de
constraint porque o PostgreSQL não permite usar um valor de enum recém-criado
na mesma transação que o adicionou.

A migration `0082_free_enrollment_contract` permite que uma concessão de
matrícula gratuita não tenha Pedido nem referência manual e cria um índice
único parcial por usuário e curso para impedir mais de uma concessão gratuita,
independentemente do status. O código que concede acesso ainda deve validar
preço, publicação, duração e concessões ativas; o índice é uma proteção final
contra concorrência e duplicidade.

A migration `0083_support_permission_grants` adiciona os arrays de grants do
papel `support`; `0084_support_permission_views` adiciona as views de rota da
implementação inicial. Essas migrations permanecem no histórico e não são
editadas.

A migration `0085_superb_wonder_man` substitui a matriz inicial por views
protegidas de Financeiro/Auditoria e grants granulares de Cursos, Alunos,
Certificados, Financeiro e Operação. Antes de recriar as constraints, ela limpa
os arrays configuráveis de todos os Supports existentes, conforme a decisão de
reconfiguração manual. Acesso padrão a Painel, Aprendizagem, Cursos, Alunos,
Operação, FAQ, Banners e mídias de acesso não é persistido como grant.

O runner de Development aplicou `0085` em 2026-09-17. A auditoria read-only
confirmou o check `allowlist refinada e grants configuráveis limpos` e nenhum
Support permaneceu com view/grant configurável. Não houve alteração em Staging
ou Production.

Na verificação de escala do Financeiro em Development, a base tinha 8 Pedidos e a
busca textual usou `Seq Scan` com 2 buffers e 0,111 ms de execução; a ordenação por
status usou 2 buffers e 0,092 ms. Como a população é pequena e não há evidência de
ganho prático para um índice trigram ou cache, nenhum índice adicional foi criado.
Repetir a medição antes de alterar essa decisão quando a população crescer.

## CI

O runner cria dois bancos PostgreSQL locais, aplica a cadeia completa e executa
integração e E2E. Nenhum banco Neon é usado para validar migrations de PR.

Isso remove custo, quota e risco de branches Neon de teste abandonadas. A
migration ainda é exercitada numa implementação PostgreSQL real; somente o
provedor de hospedagem muda.

## Staging

Depois de um merge em `staging`, o workflow pequeno de preparação aplica
migrations no branch Neon de Staging. Ele valida hostname e branch configurados
antes de abrir conexão. A Git Integration da Vercel publica o código de forma
independente.

Staging não é apagado ou recriado a cada release. O banco mantém seus dados de
sandbox; reset é uma operação manual protegida e não copia dados reais.

O seed `db:seed:staging-admin` mantém uma única conta Admin controlada, com senha
de pelo menos oito caracteres, transação única e revogação das sessões existentes.
Não há conta de recuperação nem seed de fator adicional.

## Production

O workflow de Production detecta migrations entre o deployment promovido e o
candidato.

Sem migration:

- não cria branch Neon de release;
- não exige backup de release adicional;
- não executa migration;
- valida apenas o deployment e os smokes aplicáveis.

Com migration:

1. a build Production termina sem domínio;
2. um backup independente de até seis horas e meia é exigido;
3. uma branch Neon de recuperação é criada com expiração;
4. a migration é aplicada com lock;
5. o journal é auditado;
6. readiness é testado;
7. somente então o deployment é promovido.

Migrations Production são forward-only e devem ser compatíveis com o código
anterior durante a janela entre alteração do banco e promoção.

A migration histórica `0065_gray_siren` contém estruturas de uma tentativa de MFA
administrativo. Elas permanecem no schema e no histórico para evitar uma remoção
destrutiva, mas não são registradas no adaptador Better Auth nem usadas pelo
runtime atual. Não crie uma nova migration para removê-las sem decisão explícita.

## Backup e restore

O backup criptografado PostgreSQL continua a cada seis horas no R2 privado.
Branches de recuperação de release só são criadas para alterações de schema.
Use o runbook [Backup Production e restauração](production-backup-restore.md)
para qualquer restore; não execute SQL manual de reversão.

## Neon Free

Production e Non-production devem usar projetos Neon separados para impedir que
homologação consuma a cota de Production. Computes não produtivos usam
scale-to-zero e limites conservadores. O projeto exclusivo da CI será
desativado somente após observação e inventário.

Quando uma migration, reset ou mudança de conexão falhar, pare o fluxo e
registre o ambiente, branch, migration e etapa. Não substitua o alvo por outra
URL sem revisar a segurança do destino.
