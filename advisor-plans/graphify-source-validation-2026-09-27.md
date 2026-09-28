# Validação oficial do Graphify — 27/09/2026

Escopo inicial: branch `v8` do repositório oficial; essa pesquisa foi read-only. O pacote declara versão `0.9.69`, nome PyPI `graphifyy` e licença `Apache-2.0`; o repositório também distribui `LICENSE-MIT`, então não concluo, só pelo arquivo de metadados, que todo o conteúdo esteja sob licença dupla. ([metadados](https://github.com/Graphify-Labs/graphify/blob/v8/pyproject.toml#L3-L10), [licenças do repositório](https://github.com/Graphify-Labs/graphify/tree/v8))

## Codex e arquivos alterados

- Codex é oficialmente listado. O comando bare `graphify install` é single-platform (Claude); para instalar a skill no projeto, a documentação oferece `graphify install --project --platform codex` ou `graphify codex install --project`. ([README: instalação](https://github.com/Graphify-Labs/graphify/blob/v8/README.md#L136-L209))
- `graphify codex install` sem `--project` acrescenta/atualiza a seção Graphify em `AGENTS.md` e registra uma entrada `PreToolUse` para Bash em `.codex/hooks.json`. Essa entrada executa `graphify hook-check`, mas é intencionalmente no-op; a orientação efetiva vem de `AGENTS.md`. Se a configuração JSON já existir e mudar, o instalador cria uma cópia rotativa `.codex/hooks.json.graphify-bak`; ele mescla a configuração existente. ([instalador](https://github.com/Graphify-Labs/graphify/blob/v8/graphify/install.py#L1450-L1518), [backup](https://github.com/Graphify-Labs/graphify/blob/v8/graphify/install.py#L792-L823), [explicação oficial](https://github.com/Graphify-Labs/graphify/blob/v8/README.md#L272-L279))
- Com `--project`, o instalador também copia `.codex/skills/graphify/SKILL.md`, referências e `.graphify_version`; se substituir uma skill local diferente, conserva uma cópia `.bak`. A seção marcada em `AGENTS.md` é substituída/atualizada sem ser uma substituição integral do arquivo. ([destino e instalação](https://github.com/Graphify-Labs/graphify/blob/v8/graphify/install.py#L179-L242), [fluxo de projeto](https://github.com/Graphify-Labs/graphify/blob/v8/graphify/install.py#L1570-L1594))

## Grafo, atualizações, exclusões e dados

- A geração produz `graphify-out/graph.html`, `GRAPH_REPORT.md` e `graph.json`. `graphify hook install` é outro comando: instala hooks Git para atualizar a parte AST após commit/troca de branch; após pull/merge, a documentação pede `graphify update .`. A entrada Codex no `hooks.json` não faz essa atualização. ([saídas](https://github.com/Graphify-Labs/graphify/blob/v8/README.md#L36-L56), [workflow](https://github.com/Graphify-Labs/graphify/blob/v8/README.md#L385-L418))
- A extração AST de código é local e sem LLM. Documentos, PDFs e imagens passam pelo modelo do assistente ou backend configurado; áudio/vídeo é transcrito localmente. `--code-only` evita a etapa semântica desses documentos. O registro de consultas local é opt-in; pode registrar pergunta e caminho do corpus. Ressalva: a promessa “local” descreve o processamento AST do Graphify, não o tratamento normal do resultado quando Codex/um provedor de modelo o recebe como contexto. ([privacidade e logs](https://github.com/Graphify-Labs/graphify/blob/v8/README.md#L497-L508))
- O Graphify respeita `.gitignore`; `.graphifyignore` é combinado depois e pode excluir mais, não re-incluir o que `.gitignore` excluiu. `--no-gitignore` ignora `.gitignore` e `.git/info/exclude`, mas mantém `.graphifyignore`. O `.gitignore` upstream exclui `graphify-out/`; o instalador Codex não adiciona regras ao `.gitignore` do projeto consumidor, então essa exclusão precisa ser conferida no `hub`. ([regras](https://github.com/Graphify-Labs/graphify/blob/v8/README.md#L367-L382), [`.gitignore` upstream](https://github.com/Graphify-Labs/graphify/blob/v8/.gitignore), [instalador](https://github.com/Graphify-Labs/graphify/blob/v8/graphify/install.py#L1450-L1518))

## Limite da extração

O mapa de código deriva de AST Tree-sitter e classifica relações como `EXTRACTED`, `INFERRED` ou `AMBIGUOUS`; não é telemetria de execução, verificação de tipos nem prova de comportamento. É uma inferência técnica que dispatch dinâmico, reflection e wiring por configuração podem não ser representados completamente; o README atual não lista um catálogo exaustivo dessas lacunas. Verificar no código/testes continua necessário. ([método e confiança](https://github.com/Graphify-Labs/graphify/blob/v8/README.md#L24-L27), [tipos de relação](https://github.com/Graphify-Labs/graphify/blob/v8/README.md#L286-L291))

## Correções decisivas ao relatório recebido

O suporte Codex, a licença Apache declarada e o caráter local da extração AST são sustentados. Duas qualificações mudam a proposta: (1) o hook Codex instalado é no-op, enquanto o hook de atualização Git é independente; (2) incluir docs/PDFs/imagens pode enviar esse conteúdo ao modelo configurado. E `graphify codex install` altera `AGENTS.md` e `.codex/hooks.json`; não se deve tratá-lo como uma instalação sem mudanças de configuração. No levantamento read-only inicial, nenhum comando foi executado; a autorização posterior iniciou o piloto documentado abaixo.

## Alternativas citadas

As descrições gerais do anexo estão corretas, mas as opções não são substitutos idênticos. Serena prioriza navegação e operações semânticas via LSP/MCP; sua aplicação está sob GPL-3.0-or-later e SolidLSP sob MIT. CodeGraphContext oferece indexação/consulta por grafo e MCP, com mais opções de banco. GitNexus é PolyForm Noncommercial. Essas licenças e arquiteturas estão descritas pelos próprios projetos. ([Serena](https://github.com/oraios/serena), [CodeGraphContext](https://github.com/CodeGraphContext/CodeGraphContext), [GitNexus license](https://github.com/abhigyanpatwari/GitNexus/blob/main/CONTRIBUTING.md))

Isso sustenta Graphify como um primeiro candidato prático — local-first, foco em grafo persistente e baixo acoplamento ao app — mas não prova que seja superior no Hub. A comparação do anexo deve ser lida como triagem para um piloto, não benchmark independente; a tabela de preços do Cloud não participa desta decisão e não foi usada.

## Encaixe no Hub

Esta leitura foi feita na worktree isolada baseada em `origin/staging`, commit `c0cddcce6e01ba606664636c6df0a172733be4bf`. Não examinei nem alterei as mudanças não commitadas do checkout compartilhado.

- O Hub tem 1.505 arquivos rastreados, 1.012 arquivos TypeScript/TSX em `src` e 208 arquivos Markdown. `src/features` tem 19 áreas de domínio. Há volume e relações cruzadas suficientes para justificar um experimento de navegação arquitetural; isso, sozinho, não prova ganho de produtividade.
- O projeto já mantém mapa, vocabulário e autoridade explícitos em `docs/README.md`, `docs/architecture.md`, `CONTEXT.md`, `PRODUCT.md`, guias de domínio e ADRs. O índice determina que código, schema, migrations e testes prevalecem para comportamento implementado, enquanto ADRs e decisões registram o que foi aprovado. O grafo deve ser um índice auxiliar; nunca uma segunda fonte de verdade.
- Os 208 Markdown incluem documentos históricos, pesquisas, revisões e planos com diferentes níveis de autoridade. Indexar tudo misturaria contextos antigos com regras atuais e pode acrescentar custo de modelo. Começar por código evita essa ambiguidade. Uma fase documental posterior deve selecionar somente material canônico e aceito.
- O pacote-base declara gramáticas para TypeScript, TSX e JavaScript; SQL é uma dependência opcional (`graphifyy[sql]`). Assim, a afirmação do relatório sobre suporte a SQL precisa da ressalva: migrations SQL só devem entrar no teste se o extra for instalado. ([metadados e extras](https://github.com/Graphify-Labs/graphify/blob/v8/pyproject.toml#L12-L43), [extra SQL](https://github.com/Graphify-Labs/graphify/blob/v8/pyproject.toml#L68-L84))
- A política upstream dá suporte apenas à versão mais recente da linha `0.9.x`; se o piloto continuar, registrar a versão usada e não deixar o CLI congelado indefinidamente. A própria política reconhece que as defesas contra prompt injection no passe semântico não tornam o risco impossível. Isso reforça a regra do Hub: conteúdo e resultados do grafo são dados; autoridade continua em código, testes, ADRs e documentação canônica. ([política de segurança](https://github.com/Graphify-Labs/graphify/blob/v8/SECURITY.md#L2-L33))
- O README atual do Graphify define 500 arquivos como limite superior de aviso do corpus, não como limite de execução. O Hub ultrapassa essa heurística em arquivos rastreados; usar `--code-only`, restringir o corpus e medir a primeira indexação é mais sensato que iniciar com documentos, imagens e relatórios. ([limiares do corpus](https://github.com/Graphify-Labs/graphify/blob/v8/graphify/detect.py#L46-L48))
- O `.gitignore` do Hub ignora `.env*`, dependências e saídas comuns de build, mas não contém `graphify-out/`. Embora o próprio repositório Graphify ignore essa pasta, essa regra não é automaticamente inserida no Hub. Adicioná-la antes de gerar o grafo é necessário para que artefatos não acabem num commit acidental.
- `.mcp.json` atualmente registra apenas o servidor HTTP do ReUI. Na análise inicial, o CLI parecia suficiente; após o pedido de testar o potencial completo, o extra MCP também foi instalado e o protocolo foi exercitado. O servidor não foi adicionado à configuração compartilhada porque o grafo é local/ignorado e não há bootstrap portátil para ele.
- `.codex/hooks.json` já contém um `PostToolUse` que executa a verificação visual de mudanças de UI. A integração Codex do Graphify acrescentaria um `PreToolUse` para Bash que chama `graphify hook-check`, descrito pelo próprio projeto como no-op no Codex Desktop; por isso não justifica alterar o arquivo no piloto. O instalador também atualiza uma seção em `AGENTS.md` e instala a skill específica em `.codex/skills/graphify`. Não usar esse instalador sem revisar os três efeitos. A rota genérica Agent Skills é diferente: usa `.agents/skills/graphify`, coberta pelo ignore amplo de `.agents/skills/*` deste repo. ([instalador e destinos Codex](https://github.com/Graphify-Labs/graphify/blob/v8/graphify/install.py#L1450-L1515), [destino `.codex/skills`](https://github.com/Graphify-Labs/graphify/blob/v8/graphify/install.py#L391-L403))

## Síntese executiva

**Decisão pós-piloto: manter Graphify como ferramenta auxiliar local e opcional; não torná-lo obrigatório nem fonte de verdade.** O teste cobriu AST de código/SQL, extração semântica de documentação canônica, consultas CLI/MCP e memória local. Não adiciona dependência de runtime, Graphify Cloud, Gemini/API externa, registro MCP compartilhado, CI gate ou hooks de atualização automática.

Três de quatro fluxos tiveram navegação útil, mas o grafo não capturou completamente o pagamento por causa de uma dependência injetada. Não houve benchmark cronometrado independente; portanto, o ganho real de tempo ainda não está demonstrado. As estimativas do Graphify não substituem essa medição.

O relatório acerta que Graphify complementa TypeScript, testes, Knip e CodeRabbit para descoberta entre arquivos. Porém, resultados devem ser validados no código, testes e documentação canônica. Não adotar Cloud, CI gate, dados de produção, hooks Git automáticos ou artefatos gráficos compartilhados. A visualização HTML foi gerada localmente, mas não foi aberta.

## Plano do piloto

### 1. Preparação aprovada e executada na worktree isolada

- Usar `codex/graphify-adoption`, baseado em `origin/staging`, sem tocar no checkout compartilhado.
- Instalar `uv` e o pacote oficial por usuário. A extração inicial usou `graphifyy[sql]` 0.9.69; ao testar MCP, o servidor indicou que o extra `mcp` era separado. O pacote foi atualizado para `graphifyy[sql,mcp]` 0.9.70. Nenhuma dependência foi adicionada a `package.json`/`bun.lock`.
- Instalar a skill Codex do Graphify no projeto. O instalador adicionou um hook Bash no-op; ele foi removido após revisão. O hook existente de verificação visual foi preservado. A seção de `AGENTS.md` foi ajustada manualmente para manter o grafo auxiliar e validado, sem impor uma consulta antes de toda busca.
- Adicionar `/graphify-out/` ao `.gitignore` e criar `.graphifyignore` para código/scripts/testes, documentação canônica e workflows atuais. Revisões, pesquisas, planos históricos e mídia ficam excluídos. Não usar `--no-gitignore`.
- Gerar AST local para TypeScript/TSX/JavaScript/SQL e usar o modelo da sessão para a semântica dos 62 documentos permitidos. Não usar Graphify Cloud, Gemini, API externa, MCP ou hooks Git. Gerar os artefatos locais, inclusive HTML, sem abrir a visualização.

### 2. Resultado do benchmark em fluxos reais

O piloto processou o projeto inteiro dentro do corpus curado e testou consultas focadas nos fluxos abaixo. Cada conclusão foi confrontada com código e documentação canônica; o grafo foi tratado como índice de navegação, não como prova.

1. **Pagamento Asaas confirmado → evidência → concessão → matrícula → outbox:** o grafo não encontrou o caminho de chamada completo por causa da dependência injetada `applyPaidAccess`. A inspeção do código confirmou o fluxo real, mas isso foi uma lacuna do Graphify, não uma relação inferida que possa ser aceita sem validação.
2. **Autoinscrição gratuita:** útil; conectou `enrollInFreeCourse` a `insertOrReactivateFreeGrant` e `rebuildEnrollmentProjection`. Código e `docs/architecture.md` confirmaram que não há Pedido nem provedor de pagamento.
3. **Acesso curricular:** útil; conectou `resolveLessonAccess()` a `resolveModuleContentRelease()`.
4. **Conclusão e certificado:** útil; ligou `completeLessonInTransaction()` à emissão elegível, que cria a mensagem `certificate.render` e a envia à outbox; confirmado no código.

**Resultado:** 3 de 4 fluxos produziram um mapa útil; a meta mínima do piloto foi atingida para navegação arquitetural, mas não para confiar no grafo como rastreador completo de fluxo. Não foi feita comparação cronometrada ou controlada de buscas antes/depois, portanto não há evidência independente de ganho de tempo. O Graphify reportou benchmark próprio de ~485 mil tokens ingênuos contra custo médio estimado de 328 tokens por consulta (~1.480×); são estimativas da ferramenta, não medição independente de uso real no Hub. A medição de tokens/custo da sessão semântica não ficou disponível e não deve ser interpretada como zero.

O passe AST gerou 7.106 nós e 21.173 arestas a partir de 1.344 arquivos; após a extração semântica dos 62 documentos selecionados e a construção do grafo, o resultado estável contém 7.280 nós, 20.905 arestas e 336 comunidades rotuladas. A exportação agregada contém 336 comunidades e 1.626 relações entre comunidades. O diagnóstico encontrou arestas pendentes, referências externas, auto-laços e colapsos de relações paralelas: limitações adicionais que reforçam a revisão humana.

Quatro memórias Q&A locais foram testadas com fontes: três úteis e uma marcada como corrigida para registrar a lacuna do fluxo de pagamento. `graphify reflect` gerou lições locais. Uma atualização completa posterior foi recusada pelo guard de redução do Graphify (candidato com 7.271 nós contra 7.280 existentes); não foi usado force. Assim, o grafo estável não contém essa atualização de memória nem a reextração mais recente do guia de ambiente. A memória permanece em `graphify-out/memory/` e a lição em `graphify-out/reflections/`, ambos locais/ignorados pelo Git.

O servidor MCP inicialmente falhou porque o extra `mcp` estava ausente; após instalar `graphifyy[sql,mcp]`, o handshake stdio MCP (`2024-11-05`), `tools/list`, `graph_stats` e `query_graph` funcionaram em `0.9.70`. A consulta BFS genérica retornou 197 nós e truncou no orçamento de 1.000 tokens, então consultas MCP também precisam ser estreitas/contextualizadas. O servidor lista ainda ferramentas de leitura de PRs GitHub, que não foram chamadas. O processo foi encerrado após o smoke test; nenhuma configuração persistente MCP foi adicionada.

**Decisão:** manter Graphify como ferramenta de desenvolvimento opcional para descoberta e navegação cross-file na worktree/projeto. O teste não sustenta torná-lo obrigatório, fonte de verdade, gate de CI ou base para decisões de domínio sem validação. O extra MCP foi instalado e testado localmente, mas o servidor não foi registrado no `.mcp.json` compartilhado: o grafo é local/ignorado e um registro compartilhado iniciaria um processo que pode falhar quando o grafo ainda não existir. Cloud, Gemini/API externa, hooks Git e dependência de runtime seguem fora. A instalação global de usuário (`uv tool`) fornece o CLI; skill, instruções e política de corpus são específicas deste projeto e desta worktree.

### 3. Integração aplicada após o piloto

- A skill Codex foi instalada e revisada para este projeto; a seção de `AGENTS.md` é opcional, limitada a perguntas amplas e exige verificação no código/testes/docs. O hook Codex no-op do instalador foi removido; o hook visual preexistente foi preservado.
- `.graphifyignore` limita o corpus a código, testes/scripts, workflows e documentos canônicos. O guia operacional registra privacidade, limitações, atualização e que os artefatos são auxiliares. `/graphify-out/` está no `.gitignore`; grafo, relatório, HTML, cache e memória não são versionados.
- CLI `graphifyy 0.9.70` foi instalado por usuário com extras SQL e MCP (`uv tool`); não houve alteração de `package.json`, `bun.lock` ou runtime do Hub. A skill/referências vendorizadas vieram de `0.9.69`; as referências foram comparadas com `0.9.70` e não mudaram. A skill inclui licenças/avisos do upstream e orientação de versão/atualização.
- A atualização semântica incremental e o guard contra redução foram exercitados. Não forçar atualização que Graphify não consegue validar; refazer a extração completa apenas quando necessário e após preservar o grafo anterior.
- CodeRabbit CLI estava instalado e autenticado, mas sem assento atribuído no plano Free; revisão opcional foi pulada por esse motivo.

## Estado final e limites

- O teste ocorreu apenas na worktree `codex/graphify-adoption`, baseada em `origin/staging` (`c0cddcce6e01ba606664636c6df0a172733be4bf`). Não foram tocados checkout compartilhado, runtime do Hub, banco, staging ou produção. Nenhum commit foi criado.
- A detecção final incluiu 1.406 arquivos: 1.344 de código e 62 documentos canônicos selecionados. A detecção não marcou arquivos sensíveis. O aviso de 500 arquivos do Graphify é heurístico, não bloqueio; relatórios e documentos históricos permaneceram fora do corpus.
- A geração AST e a extração semântica foram executadas com `0.9.69`; CLI e MCP foram testados com `0.9.70`. A regra de segurança contra encolhimento bloqueou uma atualização semântica posterior; o grafo anterior foi preservado em vez de forçar a substituição.
- O HTML agregado foi gerado como artefato local, mas não foi aberto. `graphify-out/` é ignorado pelo Git.
- O link compartilhado do ChatGPT não abriu na pesquisa; o texto anexado foi revisado e afirmações técnicas foram confrontadas com README, metadados, instalador, licença e política de segurança oficiais.
- O relatório recebido era majoritariamente coerente. As qualificações principais: SQL exige extra opcional; extração semântica usa o modelo configurado e não é puramente local; artefatos precisam ser ignorados no Hub; o instalador Codex também altera instruções/configuração; o grafo não representa com completude dispatch dinâmico nem relações paralelas.
