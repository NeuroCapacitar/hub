---
status: canonical
owner: engineering
last_verified_commit: e0a55d04884851c21bd55fe605afd05cc52c5a4e
---

# Fluxo de release do Hub

Este é o procedimento vigente para levar alterações até
`https://app.neurocapacitar.com.br`.

## Regra das branches

`main` é a branch padrão do GitHub e representa o último candidato de
Production. `staging` é a branch permanente de homologação online.

Branches de trabalho nascem de `staging`:

```text
feature/*, fix/*, chore/* → staging → main → Production
```

Um PR normal deve ter `staging` como base. O merge em `staging` inicia o
workflow `Prepare Vercel staging`. Quando a variável de repositório GitHub
`STAGING_TARGET_READY` está ativada, o workflow aplica e audita
migrations antes de construir e publicar o mesmo SHA no Custom Environment
`staging`, disponível em `https://preview.neurocapacitar.com.br`. Enquanto a
flag estiver ausente ou falsa, migrations e deploy ficam bloqueados.

Como `main` é a branch padrão do GitHub, a CI também roda PRs direcionados a
ela, mas falha deliberadamente para PRs normais e orienta a trocar a base para
`staging`. A exceção exige simultaneamente uma branch `hotfix/*` e o label
`hotfix`.

No GitHub, o ruleset geral mantém `main` e `staging` protegidas contra deleção,
force-push e merges sem o check `CI`; um ruleset separado exige Pull Request
para `staging`. `main` é avançada somente pelo workflow de release depois dos
gates descritos abaixo. Não faça push manual em `main`.

O backup operacional aceita somente `main`; o cleanup de backups Neon exige
`main` para Production e `staging` para Staging. Ambos fixam o checkout no SHA
do evento, verificam branch/SHA antes de executar código e limitam secrets ao
step operacional. Os Environments correspondentes devem ter allowlists de
branch explícitas; o gate no YAML não substitui a proteção externa da própria
definição do workflow.

Depois de uma release normal, `main` e `staging` apontam para o mesmo commit.
A promoção de `staging` para `main` usa fast-forward; não se deve criar um
segundo PR de release, fazer squash da promoção ou criar uma branch de
reconciliação quando as branches já estiverem alinhadas.

## Hotfix

Um hotfix pode entrar diretamente em `main` quando o tempo de recuperação for
mais importante que a homologação de Staging. Esse estado é permitido:

```text
main → Production + hotfix
staging → Production anterior + alterações acumuladas
```

Novos PRs ainda podem entrar em `staging`. Antes da próxima release, execute
`Prepare Production release`. Se houver commits exclusivos de `main`, o
workflow cria uma branch `sync/production-into-staging-*`, incorpora `main`,
dispara a CI e abre um PR para `staging`. Resolva conflitos somente nessa PR,
homologue a árvore combinada e só então execute `Deploy Vercel production`.

Quando o merge automático encontra conflitos, o workflow preserva `staging`,
publica uma variante da branch de sincronização baseada em `main` e abre o PR
já com a divergência visível. A resolução continua restrita ao PR; não se
editam branches persistentes diretamente.

Hotfixes não podem conter migrations. Uma alteração de banco segue o fluxo
normal de Staging, backup e promoção.

Em uma indisponibilidade, o primeiro recurso é rollback para o deployment
Production anterior compatível. O forward-fix só começa depois que o rollback
for descartado ou insuficiente.

## CI

A CI completa executa uma vez por PR para `staging` ou `main`. Ela usa
PostgreSQL 18 local no runner, com bancos separados para integração e E2E.
Não cria branches Neon, não usa dados Production e não executa em todo push.

O workflow `Prepare Vercel staging` serializa migration, inspeção do journal,
build e deploy. O job de deploy usa o SHA validado e emitido pelo job de
migration, confere a ponta da branch Staging antes do build e repete a checagem
imediatamente antes da publicação. Se a branch avançar durante a preparação, o
workflow aborta sem publicar um deployment desatualizado. O push do Git não
inicia um deploy Vercel concorrente.

As operações manuais `migration-only`, `seed-only` e `migrate-and-deploy` exigem
confirmação explícita e branch `staging`. O smoke do deploy verifica apenas
readiness, compatível com manutenção integral. A operação manual `verify`
exige confirmação de que `APPLICATION_MAINTENANCE_MODE=off` e testa readiness
mais a rejeição de um POST sem assinatura ao webhook Resend, que deve retornar
HTTP 400. O fluxo não repete a CI.

Antes de abrir o Pull Request, tente a revisão opcional do [runbook do
CodeRabbit](code-review-with-coderabbit.md), usando `staging` como base para o
fluxo normal e `main` somente para hotfix. Verifique a CLI e a autenticação; se
o CodeRabbit não estiver disponível, registre o motivo do skip e continue. A
revisão é assistiva e nunca substitui o check `CI`.

## Release normal

1. Homologue o deployment atual de Staging.
2. Execute `Deploy Vercel production` com `mode=release-staging`.
   O gate consulta o alias `preview.neurocapacitar.com.br` pela Vercel CLI,
   exige um deployment `READY` cujo `meta.githubCommitSha` seja exatamente o
   SHA atual de `staging` e então executa readiness e smoke do webhook Resend.
3. O workflow confirma que `main` é ancestral de `staging`.
4. O workflow confirma que o SHA candidato possui um check `CI` verde associado
   ao próprio SHA. Um check verde somente no head do PR não autoriza a promoção;
   nesse caso, execute a CI manualmente para a referência candidata e repita a
   release.
5. `main` avança por fast-forward para o SHA homologado.
6. O workflow aguarda a build Production automática sem domínio.
7. Sem migration, não há branch Neon de release nem migration de banco.
8. Com migration, o workflow exige backup independente recente, cria branch de
   recuperação sem compute, aplica a migration e audita o journal.
9. Readiness, R2 e smoke público precisam passar antes da promoção.
10. A promoção usa o mesmo deployment validado, sem rebuild.

O domínio Production permanece apontando para a versão anterior até a etapa de
promoção. Falha de build, migration ou smoke não deve alterar o tráfego público.

## Vercel

O Git Integration não publica `staging` diretamente: `vercel.json` desabilita
esse caminho para impedir que o deploy corra junto com as migrations. O
workflow GitHub usa Vercel CLI para publicar o Custom Environment `staging`
depois dos gates do banco. O verificador de release usa a Vercel CLI para
confirmar que o alias estável aponta para um deployment pronto com o SHA exato
de `staging`. O Git Integration cria a build Production quando o workflow
avança `main`. Feature branches não geram previews automáticos porque
o `ignoreCommand` encerra essas builds. O domínio Production não é
autoatribuído durante a build; o workflow aguarda a build do SHA exato, executa
os gates e promove o mesmo deployment.

Não execute `vercel deploy` manualmente para corrigir uma variável de ambiente
ou repetir uma release. Atualize a variável no ambiente correto e use o
workflow; deploys manuais quebram a rastreabilidade do SHA e podem criar builds
duplicadas.

## Cron e workers

A configuração de `vercel.json` agenda os workers de Asaas, JMVStream, outbox e
Resend a cada trinta minutos, nos minutos 15 e 45 UTC;
matrículas diariamente às 10:00 UTC e manutenção diariamente às 04:00 UTC.

O cron JMVStream permanece ativo em Production a cada 30 minutos. Ele busca
vídeos em `processing`, atualiza player e thumbnail, reconcilia a pasta do curso
e expira uploads abandonados. Uploads completados também têm sincronização
imediata; o cron recupera processamento que permaneceu pendente.

Em Staging, os workers são executados somente pela operação manual
`Run Staging jobs`, depois que a variável de repositório
`STAGING_TARGET_READY` confirma GitHub/Vercel configurados. O agendamento
periódico anterior do GitHub Actions foi removido.

As inboxes Asaas/Resend, leases, retries, dead-letter e outbox são mantidos.
Qualquer redução adicional de frequência exige evidência de que o processamento
imediato e a recuperação continuam funcionando. A recuperação Asaas tenta drenar
a outbox depois de confirmar eventos processados. A compra segue pelo caminho
imediato; em falhas combinadas ou backlog, o e-mail pode precisar de outra execução
da outbox, também a cada trinta minutos.

## Backups e Neon

O backup PostgreSQL Production continua a cada seis horas, criptografado e
publicado no bucket privado de backups. Branch Neon de recuperação só é criada
quando a release contém migration.

Production não deve compartilhar cota com CI. A CI usa PostgreSQL local. O
plano de separação futura mantém Production e Non-production em projetos Neon
distintos, ambos com limite de compute conservador e scale-to-zero quando
aplicável.

Branches temporárias de recuperação são criadas pelo helper
`scripts/create-neon-recovery-branch.ts`. A requisição envia somente nome,
parent e `expires_at`; não envia `endpoints`, portanto não provisiona compute.
Release Production usa expiração de 14 dias, reset de Staging usa sete dias e
backup de cleanup Production usa 14 dias. O inventário e a exclusão de
branches antigas continuam operações manuais, sempre começando por dry-run.

`Cleanup Neon release backups` exige que a branch selecionada no dispatch
corresponda ao ambiente: `staging` para Staging e `main` para Production. O
gate fica no job, antes do acesso ao Environment; o checkout usa explicitamente
a mesma branch persistente. Tags, branches de trabalho e combinações trocadas
são recusadas. As políticas de branches dos Environments `vercel-staging` e
`vercel-production` devem manter essas mesmas restrições, inclusive contra
definições de workflow modificadas em branches não aprovadas.

## Checklist de segurança

Antes de promover:

- CI verde para o candidato;
- deployment Staging e domínio estável saudáveis;
- `main` e `staging` reconciliadas;
- backup recente quando houver migration;
- nenhum segredo impresso em log ou commit;
- readiness e R2 verdes;
- smoke de `/`, `/entrar`, `/admin`, checkout e webhook;
- Sentry e logs Vercel sem erro novo relevante;
- rollback compatível identificado.

Toda alteração em branch, workflow, environment, migration, cron ou backup
deve atualizar este documento e o guia operacional específico. Rode
`bun run docs:check` antes de abrir o PR.
