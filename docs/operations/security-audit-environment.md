---
status: runbook
owner: engineering
last_verified_commit: 62e7a195013a996b0586ea73089de3e8d06ef114
---

# Ambiente para auditoria de segurança completa

Este guia prepara a execução isolada da auditoria e a validação das correções.
Os comandos de instalação ficam fora da execução de teste. Não usar `.env.local`,
credenciais de Development/Staging/Production, contas reais ou providers reais.
Consulte também [Testes e CI](testing-and-ci.md) e
[Ambiente e desenvolvimento](environment-and-local-development.md).

## Bloqueios observados em 2026-10-02

Na remediação autorizada em 2026-10-03, as dependências do lockfile foram
instaladas com scripts desabilitados, e testes locais com mocks, TypeScript,
Ultracite, documentação, migrations, Knip e build sintético foram executados.
Isso resolve a falta de pacotes para verificação funcional nesta worktree;
não transforma essa verificação em auditoria completa pelo protocolo de
sandbox descrito abaixo. Nenhuma credencial de banco/provider foi utilizada.

A worktree não possui `node_modules`. Node 24.21.0 está disponível; o Bun local
responde 1.4.2, diferente do 1.3.11 fixado pelo projeto. WSL não está instalado e
Docker não foi encontrado. Os validadores CLI do
skill security-audit recusam o Node nativo Windows por falta de abertura
`O_NOFOLLOW`/`O_NONBLOCK`. Instalar somente as dependências JavaScript não resolve
esse bloqueio nem cria o sandbox exigido pelo skill.

CodeRabbit 0.7.6 está instalado, mas `coderabbit auth status` informa `signed out`.
A revisão opcional permanece dispensada por autenticação ausente; seguir o
[runbook CodeRabbit](code-review-with-coderabbit.md) para uma preparação posterior.

## Runtime e dependências

1. Instale WSL 2 com Ubuntu e reinicie quando o instalador solicitar. Em PowerShell
   administrativo, `wsl --install -d Ubuntu-24.04`; confirme depois com
   `wsl --list --verbose`. O procedimento é descrito pela
   [Microsoft](https://learn.microsoft.com/en-us/windows/wsl/install).
2. Prepare uma cópia descartável do estado atual, incluindo diff não commitado e
   arquivos novos da correção, no filesystem Linux. Não usar apenas `git archive
   HEAD`, porque ele omite essas mudanças. Não copiar `.env*`, dumps, chaves,
   credenciais, configurações pessoais de agentes ou caches com dados sensíveis.
   Uma clone Linux isolada com patch e arquivos novos revisados é uma opção.
3. Instale Node 24.x e Bun **1.3.11**, as versões contratuais de `package.json`,
   no ambiente de preparação. Para baixar os pacotes sem executar lifecycle,
   confirme `--ignore-scripts` no help da versão fixada e use
   `bun install --frozen-lockfile --ignore-scripts`, preservando `bun.lock`. Isso fixa as versões
   do lockfile; se o manifesto divergir, a instalação deve falhar. Consulte a
   [documentação Bun](https://bun.sh/docs/pm/cli/install).
4. Revise os scripts de instalação antes dessa etapa. O repositório possui
   `prepare` e dependências nativas confiáveis explicitamente declaradas; não
   ampliar automaticamente essa allowlist. Execute somente esses scripts
   necessários no ambiente isolado, sem rede, com todos os pacotes já em cache,
   antes de congelar a imagem. Prepare Sharp e demais binários para a plataforma
   Linux, sem copiar `node_modules` do Windows. Se a versão fixada tentar buscar
   inputs ausentes, pare e complete a preparação; não liberar rede ao alvo.
5. Disponibilize PostgreSQL **18** descartável, dois bancos de teste e fixtures
   dos providers, conforme Testes e CI. Chromium só é necessário se jornadas de
   navegador forem autorizadas posteriormente; não é necessário para as
   regressões unitárias destas correções.

A instalação pode usar rede em uma etapa de preparação sem segredos. Depois,
congele imagem, toolchain e dependências. O processo que executa código do alvo
não pode instalar pacotes ou obter fontes/fontes web. Uma instalação frozen não
é, por si só, um sandbox ou uma verificação de vulnerabilidades.

## Isolamento obrigatório antes de executar

Use um host Linux ou container/VM configurado por um operador com todos os
controles exigidos pelo skill. WSL ou Docker Desktop instalados, sem configuração
adicional, não comprovam esses controles:

- Rede externa negada. Integrações usam mocks; quando necessário, PostgreSQL e
  serviços fictícios compartilham somente uma rede/namespace interno isolado.
- Ambiente inicialmente vazio, com allowlist de valores fictícios; diretórios
  de home, cache e temporários exclusivos de scratch. Não herdar o ambiente da
  estação nem montar o home do operador.
- Alvo e toolchain somente leitura. Caso o build precise escrever ao lado da
  fonte, o operador prepara antes uma cópia descartável em scratch; somente
  essa cópia é gravável. Não montar o socket Docker, credentials ou filesystem
  da máquina como escape do isolamento.
- Limites de CPU, memória, processos, tamanho de arquivo, disco e tempo de
  execução explicitamente aplicados. Exemplos de mecanismos: cgroups, ulimits,
  volumes/tmpfs com quota, root filesystem read-only e timeout pelo supervisor.
- Arquivos de evidência só são promovidos após encerramento dos processos,
  usando a travessia no-follow, descritores, arquivos regulares exclusivos e
  limites de bytes especificados no skill. Não copiar scratch recursivamente.

O pai da auditoria registra limites e nomes/valores fictícios da allowlist.
Não registrar o ambiente herdado para depois tentar remover segredos. O sistema
de arquivos Linux é necessário para os validadores oficiais; não alterar seus
checks ou fabricar constantes no Node Windows para fazê-los passar.

## Verificação em ordem

Somente depois do gate de isolamento, executar os testes estreitos:

```text
bun run test -- src/features/certificates/template-asset-ownership.test.ts src/features/certificates/templates.test.ts src/features/comments/actions.test.ts src/features/comments/rules.test.ts
bun run test -- src/features/payments/payment-reviews.test.ts
bun run test -- src/features/jmvstream/asset-deletion.test.ts src/features/jmvstream/lesson-lifecycle.test.ts src/features/jmvstream/asset-persistence.test.ts src/features/jmvstream/upload-completion.test.ts
bun run test -- src/features/admin/publication-materials.test.ts src/features/admin/authoring.test.ts src/features/storage/r2.test.ts src/features/storage/published-lesson-resource.test.ts src/features/storage/lesson-resource-upload-cleanup.test.ts src/features/storage/lesson-resource-upload-registry.test.ts src/tooling/production-backup-workflow.test.ts
bun run docs:check
bun run verify:quick
```

Usar PostgreSQL/mocks isolados para as reproduções de concorrência: aprovação com
duas revisões; complete pausado durante publicação; dois completes com cleanup
intercalado; cópia R2 durante overwrite da fonte; commit incerto na publicação e
reconciliação de cópias/sources. Mocks unitários e inspeção de SQL não comprovam
sozinhos o resultado concorrente real.

O build usa `next/font/google`; disponibilizar os inputs offline ou um fixture
de build revisado no ambiente descartável, sem permitir rede ao alvo. O guia
empacotado em `node_modules/next/dist/docs/` passa a estar disponível após a
instalação e deve ser consultado para a versão realmente instalada. Não habilitar
Sentry/provider real para contornar um erro de build.

Por último, no Linux, executar os validadores oficiais do skill instalado:

```text
node <skill-dir>/validate-findings.cjs <audit-dir>/findings.json
node <skill-dir>/validate-coverage-ledger.cjs <audit-dir>/coverage-ledger.json
```

O relatório somente recebe conclusão de auditoria completa após os gates, as
reproduções necessárias, revisores/críticos independentes e fechamento das
lacunas do ledger. Checagem de sintaxe estática, lint ou CI comum não equivalem
isoladamente a esse resultado.

## Fatos externos que dependências não resolvem

Inspecionar por metadados as allowlists explícitas dos GitHub Environments:
`production-backup` para `main`. Nas allowlists de `vercel-production` e
`vercel-staging`, preservar somente as branches protegidas realmente usadas pelo
fluxo aprovado: `vercel-staging` também participa da verificação de Staging e
preparação da release disparadas de `main`, não apenas dos jobs de `staging`.
Conferir os workflows vigentes antes de alterar essa configuração para não
bloquear a release. Confirmar proteção da definição de workflow, permissões de dispatch,
aprovação e menor privilégio dos secrets. Não dispatchar workflows operacionais
em branches de teste. Consulte a
[documentação de Environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).

Também permanecem externos o IAM/retention do R2, a semântica operacional de
deleção JMVStream, as configurações OAuth, o proxy confiável e o estado aplicado
das migrations. Esses fatos exigem observação autorizada, não instalação de npm
packages nem testes com dados reais.
