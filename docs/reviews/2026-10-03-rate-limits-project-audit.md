---
status: proposed
owner: engineering
last_verified_commit: d27d9a1b77914192e31c1b3c8c28c516d8f6e3a5
---

# Auditoria de rate limits do Hub e pesquisa de arquitetura

## Escopo e método

Pesquisa de fontes oficiais consultadas em 2026-10-03 para auditar o rate limiting do Hub em Next.js/Vercel/Postgres e comparar uma camada de borda Cloudflare com uma migração progressiva para Workers, mantendo Neon. Esta nota documenta opções e trade-offs; não aprova fornecedor, limiares de produto nem implementação. As afirmações sobre recursos, limites e preço são retratos das páginas oficiais na data da consulta.

As fontes usadas são documentação e páginas de produto dos próprios fornecedores e documentação oficial do PostgreSQL. Context7 resolveu a biblioteca oficial Upstash como `/websites/upstash_redis_sdks_ratelimit-`; a documentação atual confirmou que o SDK usa Redis por HTTP para serverless, que timeout permite a requisição por padrão (fail-open) e que `MultiRegionRatelimit` replica assincronamente e admite excedente pequeno. Esses pontos foram conferidos também nas páginas oficiais Upstash citadas abaixo. A investigação não consultou credenciais nem criou recursos externos.

## Conclusão de pesquisa

Uma instância local em memória não fornece limite compartilhado entre instâncias serverless: ela só observa chamadas que chegam àquela instância, e instâncias diferentes podem aceitar cada uma seu próprio orçamento. O runtime pode reutilizar instância aquecida, mas isso não transforma memória de processo em estado distribuído. Para proteção contra tráfego abusivo, a camada de firewall reduz chamadas caras antes de chegarem à aplicação. Para quotas de produto por usuário/organização e invariantes de segurança com exigência de contagem compartilhada, uma decisão síncrona em armazenamento compartilhado é necessária.

Não há uma solução única para todos esses objetivos. A documentação atual da Vercel oferece WAF rate limiting em todos os planos, com contadores por região; Hobby inclui até 1 milhão de requisições permitidas, Pro é cobrado por uso e a tabela publicada indica US$0,50 por milhão de requisições permitidas, enquanto Enterprise tem preço customizado. Esse recurso é adequado para limites de tráfego baseados em atributos de request, mas não garante quota global exata por usuário autenticado. Upstash Ratelimit oferece uma decisão compartilhada via Redis, compatível com serverless por HTTP, com custo variável por comandos e opção fail-open por timeout; uma instância regional evita a replicação assíncrona entre regiões ao custo do round-trip até a região do banco, enquanto MultiRegion retorna antes da replicação e admite excedente pequeno. PostgreSQL pode manter um contador transacional por chave/bucket, mas cada verificação compete por conexão, transação e escrita no banco principal, adicionando contenção e custo ao caminho crítico. Não se deve escolher Postgres só porque já existe. [Vercel rate limiting e limites](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting), [Vercel preço](https://vercel.com/docs/vercel-firewall/vercel-waf/usage-and-pricing), [Upstash serverless e multi-region](https://upstash.com/docs/redis/sdks/ratelimit-ts/features)

**Recomendação provisória atualizada:** manter o Postgres como limiter compartilhado da aplicação e fazer dele o próximo storage do Better Auth por meio de uma migration Drizzle. Para tráfego público antes da aplicação, o alvo de borda passa a ser Cloudflare WAF depois que o hostname estiver proxied e a origem Vercel protegida contra bypass. WAF Cloudflare só contém volume por IP/rota e não substitui quota exata de negócio. Redis permanece adiado até métricas mostrarem contenção/custo ou uma quota global que Postgres/Cloudflare não atendam. A transferência de DNS/proxy e os limiares ainda não foram aplicados nem aprovados.

## Comparação de opções

| Camada | Chave / escopo útil | Consistência e latência | Falha e comportamento | Custo e implantação | Melhor encaixe |
| --- | --- | --- | --- | --- | --- |
| Vercel Firewall WAF | IP, JA4; Enterprise também User-Agent e header arbitrário. Regras para caminhos/métodos/condições. | Contadores por região. Usuário acessando mais de uma região pode passar do limite agregado. Decisão acontece na borda e não requer chamada síncrona ao banco da aplicação. | Configurável para log, deny, challenge ou rate-limit/429. Mudanças de regra sem redeploy. Não substitui identidade autenticada da aplicação, a menos que se use um atributo de request apropriado. | Compatibilidade mais direta com deployment Vercel. Tabela atual: Hobby 1 regra e 1M de requisições permitidas incluídas; Pro até 40 regras e cobrança por uso; Enterprise até 1000 regras, contagem token bucket disponível. Preço publicado: US$0,50 por 1M de requisições permitidas, regional; Enterprise customizado. Confirmar plano e faturamento efetivo antes de release. | Mitigação de bots/abuso por IP/rota antes de consumir Function, DB ou chamadas SaaS; logging inicial para calibrar. |
| Cloudflare WAF Rate Limiting | IP e campos condicionados ao plano; características configuráveis, contagem por combinações de valores. | Contadores são locais ao data center Cloudflare (`cf.colo.id` é característico obrigatório); não há contador global único. Há atraso de até alguns segundos na detecção/atualização, então excesso pode chegar à origem. | Ação por mitigation timeout; pode desafiar/bloquear. Planos Free/Pro/Business têm limitações de campos, janelas e ações; regras não prometem precisão exata de número até a origem. | Funciona como camada de borda quando DNS/proxy do domínio está no Cloudflare. Usar atrás dele com Vercel exige validar caminho, cabeçalhos de IP e cobertura de hostname; é uma dependência e camada operacional adicional. Recursos e limites variam muito por plano. | Alternativa de borda se Cloudflare já estiver no caminho de tráfego e requisitos couberem nos limites do plano. Não é um contador de quota de usuário global. |
| Upstash `@upstash/ratelimit` + Redis REST | Identificador arbitrário passado pelo servidor: ID de usuário/organização/API key; também IP quando confiável. | Uma Redis regional concentra o estado em uma instância e cada `limit()` faz operações Redis síncronas até essa região. MultiRegion decide no Redis mais próximo e replica depois; admite que o limite seja excedido por pequena margem. Isso é opção de menor latência inter-regional, não enforcement estrito. | A lib permite `timeout`; ao estourá-lo, request passa independentemente do limite (fail-open), comportamento que precisa ser explícito. Cache efêmero de chaves já bloqueadas evita chamadas repetidas enquanto uma instância está aquecida, mas não serve como estado global. Analytics e replicação usam promessa `pending`, que precisa completar no runtime serverless. | Compatível com Vercel/Next serverless via HTTP REST, sem socket Redis persistente. Página de preço consultada: $0,20/100K comandos no plano pay-as-you-go; Fixed a partir de $10/mês; analytics soma comando por verificação, algoritmo também altera comando/latência. Prod Pack é adicional. Confirmar preço/termos vigentes no momento da adoção. | Quotas por tenant/usuário, proteção contra abuso que depende de identidade autenticada, consumo de operação dispendiosa e orçamento por janela. |
| Postgres/Neon transacional | Chave autenticada arbitária, combinada com bucket/janela e limites por operação. | Contador pode ser serializado corretamente com `INSERT ... ON CONFLICT DO UPDATE` em linha única, ou com advisory transaction lock. Em alta concorrência para mesma chave, a linha/lock vira fila; todas as decisões adicionam round-trip, transação e escrita no DB. | Dá para escolher resposta ao erro de DB: falhar fechado (nega uso legítimo se banco indisponível) ou aberto (quota deixa de proteger). A política é código da aplicação, não propriedade automática do banco. Advisory locks esperam conflito até recurso desbloquear, ou variante `try` retorna false. | Evita serviço de dados adicional, mas usa capacidade e conexões do DB principal. Serverless e Postgres requerem atenção a pool/conexões; comparar latência e capacidade real do Neon. Dados por janela precisam TTL/limpeza ou buckets com expiração lógica. | Regra que precisa ser atômica com uma escrita/estado de negócio no Postgres, quota pouco concorrida, ou quando simplicidade operacional superar o custo de acoplar cada request ao DB. |
| Memória local em função | Chave vista dentro de um só processo. | Isolada por instância e pode desaparecer em cold start/redeploy; contadores se dividem entre instâncias/regions. | Não tem falha de rede adicional, mas deixa bypass por distribuição natural do tráfego. | Sem serviço/custo, porém não é limite compartilhado em deployment horizontal. | Apenas heurística/best-effort local adicional; não como segurança, quota de produto nem limite confiável. |

Fontes Vercel: [WAF Rate Limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting), [Usage & Pricing](https://vercel.com/docs/vercel-firewall/vercel-waf/usage-and-pricing), [guia WAF e SDK](https://vercel.com/kb/guide/add-rate-limiting-vercel). Fontes Cloudflare: [Rate Limiting Rules](https://developers.cloudflare.com/waf/rate-limiting-rules/), [Request Rate Calculation](https://developers.cloudflare.com/waf/rate-limiting-rules/request-rate/), [parâmetros e disponibilidade](https://developers.cloudflare.com/waf/rate-limiting-rules/parameters/). Fontes Upstash: [features, timeout e multi-region](https://upstash.com/docs/redis/sdks/ratelimit-ts/features), [algoritmos](https://upstash.com/docs/redis/sdks/ratelimit-ts/algorithms), [custos em comandos](https://upstash.com/docs/redis/sdks/ratelimit-ts/costs), [preço Redis](https://upstash.com/pricing/redis).

## O que as opções significam na prática

### Limite de tráfego na borda não é quota autenticada global

Vercel WAF permite limitar requests e atualmente expõe IP/JA4 em todos os planos; header arbitrário como counting key consta na tabela Enterprise. A própria documentação declara contadores por região. Assim, limite por IP/rota serve para reduzir bots e volume antes do backend, mas não deve ser apresentado como limite estrito de “N operações por usuário por dia”. Um header `user-id` vindo diretamente do cliente não identifica usuário com segurança; só usar um valor cuja origem e integridade a regra verificou, ou fazer a decisão após autenticação no backend. [Vercel WAF](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting)

Cloudflare também mantém counters localizados por data center e alerta que não é desenhado para número preciso de requests chegarem à origem; atraso pode permitir excesso. O Free oferece apenas IP como characteristic, e recurso/planos são limitados. Esse rate limit deve ser tratado como mitigação de tráfego, não estado monetário global. [Cloudflare request rate calculation](https://developers.cloudflare.com/waf/rate-limiting-rules/request-rate/), [availability](https://developers.cloudflare.com/waf/rate-limiting-rules/)

### Redis é estado central, com custo e falha explícitos

Upstash Ratelimit executa contra Redis via REST, documenta integração Vercel e algoritmos Fixed Window, Sliding Window e Token Bucket. Janela fixa é barata, mas deixa bursts atravessarem fronteiras de janela; sliding window suaviza a borda mas é aproximada e mais cara; token bucket admite bursts controlados e custa mais computação. MultiRegion não oferece garantia de não exceder por pequeno margem devido à replicação assíncrona. Não escolher MultiRegion para enforcement financeiro estrito. [Getting Started](https://upstash.com/docs/redis/sdks/ratelimit-ts/gettingstarted), [algorithms](https://upstash.com/docs/redis/sdks/ratelimit-ts/algorithms), [features](https://upstash.com/docs/redis/sdks/ratelimit-ts/features)

O SDK Upstash documenta timeout padrão de cinco segundos; ao timeout, permite a requisição para não rejeitar por falha de rede. Essa política é fail-open, adequada talvez a disponibilidade de conteúdo, mas inadequada sem avaliação para login abuse, emissão paga, SMS/e-mail custoso, geração de documentos cara ou quota que previne gasto. Configurar timeout curto reduz cauda de latência, mas também aumenta ocasiões em que o limite é ignorado. Implementação deve distinguir explicitamente `success=false` de timeout e outras falhas. [Upstash timeout](https://upstash.com/docs/redis/sdks/ratelimit-ts/features)

Upstash informa cobrança por comando: exemplo oficial para Fixed Window indica até 3 comandos na primeira entrada e 2 nas subsequentes; Sliding Window 5/4 e Token Bucket 4; analytics soma um comando; cache local pode evitar comandos só para identificadores já bloqueados naquela instância. A estimativa de custo precisa multiplicar requests efetivamente submetidas por comandos/algoritmo e incluir estratégia MultiRegion; uma chamada `limit()` não equivale necessariamente a uma operação faturada. [Upstash costs](https://upstash.com/docs/redis/sdks/ratelimit-ts/costs), [pricing](https://upstash.com/pricing/redis)

### Postgres pode ser correto, mas é outro caminho síncrono no banco primário

PostgreSQL documenta que `INSERT ... ON CONFLICT DO UPDATE` garante resultado atômico de INSERT ou UPDATE sob concorrência, quando não existe erro independente. Isso permite implementar incremento/decisão transacional com chave única, sem o padrão inseguro “SELECT count, depois INSERT”. A linha da chave vira ponto de serialização. Advisory transaction locks são por recurso de aplicação e bloqueiam até libertar; locks `try` retornam imediatamente se indisponível. Essas primitivas tornam implementação possível, mas não provam que seja mais rápida/segura que Redis para a carga deste Hub. [PostgreSQL INSERT](https://www.postgresql.org/docs/current/sql-insert.html), [advisory locks](https://www.postgresql.org/docs/current/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS)

Para janela fixa, uma modelagem possível é `(scope_key, window_start)` como chave única e incremento condicional atômico com `RETURNING`, definindo uma resposta quando o contador já ultrapassou limite. Para janela deslizante com timestamps, queries de eventos crescem em custo e exigem índice/retention. Não armazenar cada request individualmente sem justificar cardinalidade e retenção. A expiração pode ser lógica por bucket temporal, com limpeza assíncrona. Se cota for parte de uma alteração financeira ou acesso, preservar a decisão e a mudança de domínio na mesma transação elimina uma janela de concorrência entre “checar” e “consumir”. Estas são inferências de desenho a validar com schema, isolamento, driver e workload; não são exemplos aprovados por Neon.

O risco prático do Neon/Postgres é adicionar ao hot path uma consulta e escrita por ação autenticada, elevar conexões/contenda e interferir com transações do produto quando há pico. Um pool ajuda na gestão de conexões, mas não elimina RTT ou serialização de uma chave concorrida. A auditoria confirmou que o projeto usa node-postgres e que o runbook documenta conexão pooled para a aplicação. Não há base para estimar a latência atual de Neon versus Upstash sem métricas do projeto.

### Integrações SaaS têm limites que não substituem o limite do Hub

O Hub controla demanda **antes** de chamar provedor. O limite do provedor é uma cota independente, frequentemente por chave, conta ou endpoint, que pode ser compartilhada com outros consumidores da mesma credencial. Para chamadas de saída, tratar HTTP 429, `Retry-After` quando fornecido, retry com backoff exponencial e jitter, limite de concorrência e orçamento por operação. Repetição imediata amplifica saturação. Stripe documenta `429` quando as próprias taxas são excedidas e recomenda backoff exponencial em erros de rate limit. [Stripe rate limits](https://docs.stripe.com/rate-limits)

Não aplicar um rate limiter genérico a webhook recebido como substituto de assinatura, deduplicação/idempotência ou fila. Provedores podem reentregar legitimamente quando há erro ou timeout. Validar assinatura/autenticidade, idempotência por evento e processamento durável; usar rate limiting de borda apenas contra flood claramente abusivo, sem descartar reentregas válidas. O detalhe de cada provider precisa vir da integração e dos documentos oficiais do provedor em uso; esta pesquisa não consolida suas quotas contratuais.

## Práticas de implementação que independem do fornecedor

1. Definir limite pelo recurso que se quer proteger. Exemplos distintos: tentativas de login por IP e por conta; emissão/certificado por usuário; envio de e-mail por conta e por destino; chamada cara por organização; endpoint público por IP. Uma única quota genérica não atende todos.
2. Chamar o limiter depois de extrair identidade confiável e antes da query/chamada que se quer proteger. Para endpoints anônimos, usar IP vindo de header de proxy confiável documentado para a deployment. Nunca aceitar `x-forwarded-for` arbitrário como identidade em deployment acessível fora da borda confiável.
3. Responder `429 Too Many Requests`, incluir `Retry-After` quando se puder calcular, e não vazar IDs/contadores internos. O cliente deve desacelerar e não repetir imediatamente.
4. Decidir fail-open/fail-closed por risco da ação. Fail-closed em bypass da quota pode impedir acesso legítimo durante indisponibilidade do Redis/DB; fail-open em endpoint de alto custo abre a possibilidade de gasto. Instrumentar timeout, falha de backend e request permitido por fallback separadamente de sucesso normal.
5. Distinguir check de consume. Para quotas com pesos/custos, descontar unidades antes da ação protegida e reconciliar erros/retries com idempotência. Um simples check seguido de trabalho concorrente pode ultrapassar teto se não reservar atomicamente.
6. Medir falsos positivos e impacto legítimo. Começar WAF em log/observação quando disponível; inspecionar distribuições por IP/identidade, aplicar exceções controladas a webhook/monitoramento e validar tráfego multi-region. Não tratar limite “por IP” como substituto para autenticação.
7. Contabilizar custo em nível de chamada e algoritmos, além de observabilidade. Criar métricas para permitido, bloqueado, timeout/fail-open, latência do backend e retries de provider. Alertar próximo de throughput/custo e verificar se logs/analytics retêm identificadores pessoais.
8. Não reutilizar resposta 429 para contenção de concorrência temporária se o cliente puder tentar depois: fila/semáforo/queue pode ser mais apropriado para serviço externo lento. Rate limit controla ritmo; limite de concorrência controla requests simultâneas; são controles distintos.

As recomendações acima são síntese/inferência das propriedades das fontes, não requisito diretamente prescrito por cada fornecedor.

## Auditoria do Hub no commit verificado

### Resumo e evidência

- O código já mantém limites compartilhados no Postgres para cadastro/verificação, recuperação de senha, checkout público, consulta pública de Certificados e pedidos de Suporte. Esses contadores usam SQL atômico e hashes HMAC; o projeto não está sem proteção.
- O risco de abuso mais claro no código é o limite geral do Better Auth: o Hub não configura storage compartilhado nem regra de produção específica para login. Better Auth habilita seu limite padrão em Production, mas o storage padrão é memória do processo. Em múltiplas instâncias Vercel, cada processo aplica seu próprio contador.
- Não há evidência de limites excedidos hoje. A consulta dos logs de runtime Vercel para HTTP 429 nos últimos sete dias não encontrou rotas; a agregação geral de status expirou. Não há métricas atuais do Neon nem confirmação das regras WAF/plano efetivo da Vercel.
- Não recomendo adicionar Upstash agora apenas para substituir os contadores Postgres existentes. Primeiro verificar a WAF da Vercel e obter métricas de tráfego, pool/compute Neon e uso dos provedores. Redis passa a fazer sentido para limites compartilhados por identidade ou orçamento global se as medições mostrarem contenção ou risco de custo.
- O ponto externo mais sensível é Asaas: há quota por conta e limite de concorrência GET; o projeto coordena algumas consultas somente dentro de cada processo e não lê o RateLimit-Reset documentado pelo provedor.

O mapa Graphify existente tinha 8.461 nós e foi consultado antes da inspeção direta. Depois conferi código, testes e configuração. O inventário encontrou 46 arquivos route.ts sob src/app e 11 módulos com diretiva use server. A contagem cobre os pontos de entrada versionados; não estima volume ou intenção de tráfego.

Depois de registrar esta revisão no índice de documentação, tentei atualizar o grafo. graphify . --update recusou a extração porque 67 documentos precisam de extração semântica e não havia chave de LLM disponível. Não configurei chave nem backend de outro provedor. Mantive o grafo existente e confirmei os achados nas fontes canônicas/código; a atualização semântica do grafo permanece pendente.

Na consulta read-only da Vercel, o projeto hub foi encontrado. O filtro de logs Production por HTTP 429, agrupado por caminho e últimos sete dias, retornou vazio. A consulta agregada de todos os status codes expirou; logs de Function não mostram bloqueios que ocorram antes da Function em uma WAF. A chamada de leitura das configurações do projeto falhou por incompatibilidade de schema no conector, e o repositório não contém .vercel/project.json. Uma leitura de deployments encontrou um deploy Production READY em 2026-10-03, no commit main 07b955399a15f7db94e2f80f3182b5139750514d; o vercel.json desse commit declara quatro crons de 15 minutos. Como a Vercel documenta que Hobby rejeita crons mais frequentes que diariamente, isso é evidência forte de plano não-Hobby se essa configuração estava ativa no deploy. Não distingue Pro de Enterprise e não revela as regras WAF nem a cobrança real. [Cron da Vercel](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

As fontes locais documentam Hostinger como autoridade DNS e Cloudflare apenas para R2; não encontrei prova de zona de aplicação proxied pela Cloudflare. Isso não substitui uma leitura DNS atual. O runbook também alerta que CLIENT_IP_SOURCE=cloudflare só é seguro quando a origem não aceita requests fora da Cloudflare.

O conector Neon respondeu que precisa de project_id e não está vinculado a um projeto específico. Sem esse identificador no repositório, não consultei plano, conexões, queries lentas ou uso do compute; não li .env.local nem segredos para contornar essa ausência. A configuração real de BETTER_AUTH_API_KEY e das quotas/plano Asaas/JMVStream também não pode ser deduzida do código.

### Controles existentes confirmados

| Superfície | Controle implementado | Observação |
| --- | --- | --- |
| Cadastro e desafios de e-mail | 3 tentativas por identidade e 10 por IP por hora, contador Postgres com HMAC | email-challenges.ts e account-rate-limits.ts; IP desconhecido em Production bloqueia o fluxo. |
| Recuperação de senha | 3 por e-mail/hora, 10 por IP/hora e 10 por token/hora; contador HMAC/Postgres | password-reset-operations.ts; emissão tem resposta neutra. |
| Checkout público | 5 novas intenções por IP + Curso em 10 minutos; resposta 429 com Retry-After | public-checkout.ts; incremento condicional atômico e limpeza de linhas expiradas. |
| Certificados públicos | 20 consultas por IP por minuto | Página, preview e PDF chamam public-rate-limit.ts; a chave persistida é HMAC do IP. |
| Pedidos de Suporte | 3 por usuário em 10 minutos | support/server.ts serializa a decisão com advisory transaction lock. |
| Webhooks e jobs | Assinatura/autorização, deduplicação, leases Postgres, outbox/inbox e retries próprios | Autenticidade, idempotência e concorrência são controles diferentes de rate limiting. |
| Uploads via Function | Limite de bytes e timeout em multipart | request-body-limits.ts é usado em avatar e alguns uploads administrativos; não define frequência global. |

Os contadores de conta, checkout e Certificado têm limpeza pela rotina de manutenção. A limpeza é periódica, não uma expiração física imediata da linha.

### Achados que merecem ação

#### P1 — O storage do rate limit do Better Auth era por processo

Correção factual: Better Auth 1.7.6 já aplica regras especiais de 3 requisições por 10 segundos a `/sign-in`, `/sign-up`, `/change-password` e `/change-email`, além de 3 por 60 segundos para endpoints selecionados de recuperação/OTP. O Hub substitui a regra de `/send-verification-email` por 3 por hora. A configuração anterior não escolhia storage distribuído; o default é `memory`, que não coordena Functions distintas. O plugin Sentinel contra credential stuffing também só é registrado quando `BETTER_AUTH_API_KEY` está configurada; a presença da variável e o estado do serviço em Production não foram verificados.

Impacto comprovado: os limites especiais existiam, mas eram independentes por processo. Não há evidência de ataque ou falhas de autenticação. A remediação usa storage customizado atômico no PostgreSQL, compartilhado entre instâncias, e persiste somente HMAC-SHA-256 da chave Better Auth (IP e path); não usa o storage database nativo porque ele persistiria a chave bruta. A migration `0106_better_auth_rate_limits` foi aplicada em Development em 2026-10-03; a leitura posterior confirmou tabela, índice, registro no journal e zero buckets. Um smoke sintético com 12 consumos concorrentes e limite 3 permitiu exatamente 3 e bloqueou 9; o bucket temporário foi removido. Isso verifica concorrência, não estabelece baseline de tráfego. O estado distribuído não substitui regra por identidade nem proteção contra credential stuffing. Sentinel continua sendo controle separado a confirmar. Fontes: [opções oficiais do Better Auth](https://better-auth.com/docs/reference/options), [rate limiting](https://better-auth.com/docs/concepts/rate-limit).

#### P1 — Limites por IP reduzem abuso por origem, mas continuam acionando o Postgres

`consumePublicCertificateLookup` e os limites de conta incrementavam a linha a cada chamada, inclusive depois do bloqueio. A remediação condiciona o `ON CONFLICT DO UPDATE` ao bucket estar expirado ou abaixo do limite; chamadas já bloqueadas deixam de gravar novamente. O checkout já tinha essa condição e consulta `expires_at` para montar `Retry-After`. O limite Better Auth agora também evita atualizar buckets bloqueados. Essas verificações ainda consultam o PostgreSQL e, portanto, não eliminam custo de Function/DB sob flood ou tráfego distribuído; isso exige uma borda ativa.

O limite continua por IP, não por identidade global. Contadores IP persistidos permanecem HMAC. A WAF da Vercel foi substituída como destino por Cloudflare, condicionada à zona proxied e ao fechamento do acesso direto à origem. Os detalhes de plano Cloudflare e suas limitações estão na [pesquisa específica](2026-10-03-cloudflare-rate-limit-research.md).

Recomendação de borda alinhada ao destino Cloudflare: pilotar Rate Limiting Rules em um hostname proxied de não-Produção à frente da Vercel, medir tráfego e confirmar TLS, cache e origem antes de aplicar na produção. Cloudflare WAF só vê requests que passam pelo hostname proxied; o acesso direto por aliases/deployments *.vercel.app pode contornar essa camada e precisa ser verificado. No Free há uma regra, expressão limitada a Path/Verified Bot, contador por IP e janela/mitigation de 10 segundos. A ação Log é Enterprise; no Free/Pro/Business a calibração precisa usar staging, Security Events e telemetria da aplicação, não um WAF Log inexistente. Os contadores são por data center e atualizam com atraso de alguns segundos; servem para contenção volumétrica, não para quota global exata. [Disponibilidade e parâmetros Cloudflare](https://developers.cloudflare.com/waf/rate-limiting-rules/), [ações Cloudflare](https://developers.cloudflare.com/ruleset-engine/rules-language/actions/), [escopo de contagem](https://developers.cloudflare.com/waf/rate-limiting-rules/request-rate/).

Até fechar o bypass da origem, manter a detecção de IP atual da Vercel e não confiar em CF-Connecting-IP na aplicação. O runbook do Hub torna esse header confiável somente se a origem não puder ser acessada fora da Cloudflare. Validar essa condição também para crons, webhooks, preview e aliases antes de trocar CLIENT_IP_SOURCE.

#### P2 — Quotas Asaas e coordenação entre instâncias

A Asaas publica 25.000 requisições por conta a cada 12 horas, no máximo 50 GET concorrentes e os headers `RateLimit-Limit`, `RateLimit-Remaining` e `RateLimit-Reset`. A regra oficial define `RateLimit-Reset` em segundos restantes. O cliente já tratava `Retry-After`; agora usa `RateLimit-Reset` como fallback e a política não repete antes do reset. O teto de 30 segundos se aplica a cada espera; com até duas repetições, a espera acumulada pode chegar a 60 segundos. Quando o reset exige mais de 30 segundos, a consulta devolve o 429 ao chamador para tratamento posterior. `runCoordinatedAsaasQuery` serializa em memória do processo e tenta no máximo três vezes; isso não coordena a conta entre Functions. Correção factual: `listInstallmentPayments` da reconciliação já passa pela fila; não havia chamada fora dela nesse trecho. A quota real consumida não está disponível, portanto não é possível afirmar proximidade do limite. [Limites oficiais Asaas](https://docs.asaas.com/reference/api-limits).

Continuam pendentes telemetria de `RateLimit-*`, taxa 429, volume por tipo de operação e concorrência; um coordenador compartilhado só se justifica se métricas mostrarem necessidade. Para mutation com resultado incerto, preservar a política de não repetir automaticamente.

#### P2 — Escritas autenticadas sem orçamento explícito de frequência

createLessonCommentAction exige sessão e validação do comentário, mas não aplica limite de frequência por Aluno. Ações de watch progress/start/complete também exigem sessão e verificam sequência/progresso, mas não estabelecem teto de chamadas por usuário; atualizações frequentes são parte legítima do player, portanto limite genérico pode quebrar o acompanhamento. setCourseSaleInterestAction mantém no máximo uma linha por usuário/Curso, mas chamadas repetidas ainda chegam à aplicação e executam o fluxo transacional.

Recomendação: comentários devem ter política anti-spam por usuário/Curso; progresso deve preferir batch, debounce e idempotência/monotonicidade sobre rate limit rígido; interesse por Curso deve evitar revalidar e gravar quando o estado não mudou. A decisão de frequência deve considerar uso normal do player. O risco é possível; não há evidência de automação abusiva.

Status: não foi introduzido um teto arbitrário. A frequência legítima de eventos do player e a política anti-spam de comentários precisam de baseline e regra de produto. O limite de checkout e as chaves/índices únicos existentes seguem protegendo as invariantes de negócio.

#### P2 — JSON público não tem limite menor de bytes na aplicação

Cadastro, consumo de desafio, preview/consumo de mudança de e-mail, preview/aceite de convite interno e checkout agora leem JSON por stream limitado a 4 KiB, com timeout de 15 segundos. Erros de tamanho e timeout retornam HTTP 413 e 408; JSON inválido permanece 400. Os campos validados nessas rotas são tokens curtos, identificadores e dados textuais limitados. [Limite oficial de payload Vercel](https://vercel.com/docs/functions/limitations).

#### P2 — Capacidade Postgres e telemetria são por instância/insuficientes para concluir volume

pool-policy.ts configura max 3 para cada pool de aplicação em Vercel e max 1 para readiness. Cada instância de Function pode criar seu próprio pool; o número 3 não limita a soma da aplicação. O pool de aplicação é singleton por processo e usa pg; o runbook documenta URL de banco pooled. Não encontrei exportação de totalCount/idleCount/waitingCount, nem amostras de conexões/queries lentas nesta auditoria. Sem esses dados não se pode calcular se um rate limiter no Postgres ficaria caro, nem se Upstash reduziria pressão materialmente.

Esse ponto não foi alterado por código: exportar métricas úteis depende de escolher backend de telemetria, cardinalidade e retenção; a auditoria não encontrou base para inferir limite de capacidade nem pressão material. Antes de adotar um backend ou alarmes, medir em Staging `totalCount`/`idleCount`/`waitingCount`, latência das consultas de limite, conexões Neon e volume das tabelas. Alertar por fila/backlog, não somente por HTTP 429.

#### Outros provedores externos

- Resend: o limite publicado como padrão é 10 requests/s por customer, com headers de limite/reset e resposta 429. A chamada real de envio no Hub é sequencial e a outbox tem leases/idempotência. O plano/quota configurado pode diferir: desde 2026-10-01 a API oficial GET /usage também retorna rate_limit atual da equipe; a chave não foi consultada nesta auditoria. Não há evidência de aproximação do teto. [Rate limit Resend](https://resend.com/changelog/api-rate-limit), [Usage API](https://resend.com/changelog/account-usage-api).
- JMVStream: o FAQ comercial publica 60 requests/min no Starter, 600 no Professional e 6.000 no Full; Enterprise é por contrato. A documentação pública da API não apresenta esses valores como cabeçalhos/contrato técnico. O projeto limita sincronização de players a 20 itens por execução de 15 minutos, mas o upload permite até quatro partes em paralelo por upload, não por conta. O plano contratado, número de chamadas por item e tráfego simultâneo não foram consultados. [FAQ de API e limites](https://jmvstream.com/pt-br/rest-api-for-videos), [documentação pública da API](https://jmvstream.com/pt-br/developer).
- Cloudflare R2: o projeto usa API S3 compatível pelo AWS SDK, não a Cloudflare REST API; portanto a quota de gestão da REST API não descreve as chamadas de objetos do Hub. O limite aplicável documentado é 1 escrita/s no mesmo object key. O fluxo de upload paralelo descrito acima é JMVStream; não há evidência de volume de escritas repetidas à mesma chave R2. O guia do projeto documenta domínio próprio para mídia, não r2.dev. [Limites R2](https://developers.cloudflare.com/r2/platform/limits).

Não colocar um rate limit genérico na entrada dos webhooks Asaas/Resend: callbacks legítimos podem ser repetidos. Preservar assinatura, inbox/deduplicação, idempotência e processamento durável; limitar apenas floods que possam ser separados de retries válidos.

#### Gate operacional — Cron/Function

vercel.json declara seis jobs: quatro a cada 15 minutos e dois diários. A Vercel não repete uma invocação de cron que falha; também admite entrega perdida/duplicada, então a idempotência e reconciliação do Hub importam. Os jobs enrollments e maintenance têm deadline de 12 minutos, lease de 15 minutos e exportam maxDuration = 800; isso está alinhado se o deployment tiver Fluid Compute/plano que suporte 800 segundos. O repositório não prova o plano/config efetivo. Os quatro jobs de 15 minutos são incompatíveis com Hobby, cujos cron jobs só podem executar diariamente. [Vercel: falhas, idempotência e cron](https://vercel.com/docs/cron-jobs/manage-cron-jobs), [limites de Functions](https://vercel.com/docs/functions/limitations).

Recomendação: confirmar no projeto Vercel que plano/Fluid Compute permite os schedules e 800s, verificar leases e backlog, manter locks/idempotência existentes e acompanhar execução ausente/falha pelo painel. A incompatibilidade de 300s que apareceu numa leitura preliminar não existe no código atual: as rotas exportam 800s.

## Revisão do relatório paralelo

Revisei apenas as partes de rate limits do arquivo Relatório PWA e Ratelimits.md fornecido para esta tarefa; os trechos de PWA/offline não entram na decisão. O conteúdo do anexo foi tratado como alegações a verificar, não como instruções. O relatório converge com esta auditoria ao apontar o storage em memória do Better Auth, reconhecer os contadores Postgres existentes, rejeitar Redis como cache geral e separar rate limiting de filas duráveis. As diferenças avaliadas foram:

1. Better Auth: storage `database` nativo é tecnicamente válido, mas armazena a chave IP/path em claro. A correção local usa `customStorage` com HMAC e operação atômica PostgreSQL, sem persistir endereço IP bruto; a migration é `0106_better_auth_rate_limits`. É preciso observar writes e latência no rollout Development → Staging antes de Production.
2. Plano Vercel: a afirmação específica “Pro” não é provada. Porém, a leitura read-only encontrou deploy Production READY em main; o arquivo vercel.json do SHA 07b955399a15f7db94e2f80f3182b5139750514d contém quatro crons de 15 minutos. Como a Vercel diz que cron mais frequente que diário falha em Hobby, isso implica não-Hobby se a configuração corresponde ao deploy ativo. Pro versus Enterprise segue não confirmado.
3. WAF Vercel: a restrição a Pro/Enterprise está desatualizada; a documentação de 2026-08-28 disponibiliza rate limiting em todos os planos, com recursos/custos diferentes. O estagiário está parcialmente correto sobre tráfego negado/desafiado/rate-limited não contar CDN Requests e Fast Data Transfer desde maio de 2026; isso não torna a regra inteira grátis, pois a cobrança WAF é por requests permitidos segundo o plano. Como a direção escolhida é Cloudflare, a alternativa Vercel fica somente como comparação.
4. Cloudflare: a recomendação só vale quando o hostname está proxied e a origem não pode ser contornada. A zona ainda é documentada com DNS Hostinger, e Cloudflare está documentada para R2, não como proxy de entrada do Hub. WAF limita por data center; Workers Rate Limiting binding é permissivo/local; Durable Objects podem fornecer contador fortemente consistente por chave com custo/latência e risco de gargalo se usados como objeto único. Ver [pesquisa Cloudflare](2026-10-03-cloudflare-rate-limit-research.md).

Conclusão do confronto: o relatório está alinhado na lacuna de storage distribuído Better Auth e na rejeição de Upstash como cache geral; a implementação local usa HMAC por privacidade e requer rollout/métricas. A afirmação “Vercel Pro” é mais específica do que a evidência permite, embora o cron ativo exclua Hobby. A leitura atual da disponibilidade/custo WAF discorda do relatório em disponibilidade, mas confirma parte da isenção de faturamento CDN/FDT. A recomendação de edge foi substituída por Cloudflare condicionada à migração DNS/proxy; nenhuma regra foi alterada.

## Decisão recomendada sobre Upstash e Cloudflare

Não instalar Upstash para substituir os limites Postgres existentes. Os upserts são atômicos, compartilhados e preservam as quotas ligadas ao estado do negócio. O storage distribuído Better Auth e os limites de bytes JSON foram implementados localmente; validar a migration em Development/Staging e observar writes/latência antes de Production. Confirmar Sentinel e política de login em separado.

Para a borda, adotar Cloudflare WAF Rate Limiting Rules quando a zona da aplicação for transferida/proxied pela Cloudflare. O DNS documentado hoje continua na Hostinger e o app aponta para Vercel; portanto Cloudflare ainda não está na entrada do Hub. Fazer primeiro um piloto em hostname não produtivo, validar origem, cache, TLS e headers, e fechar acesso direto ao origin antes de depender da WAF. No Free há uma regra de IP/path de 10 segundos; não há ação Log nesse plano. Não usar WAF para quota por usuário nem contabilização exata, pois a contagem é local por colo e permissiva.

Quando uma API for movida para Cloudflare Worker, o binding Rate Limiting pode atuar como filtro leve no próprio Worker, mas continua local ao location e eventual; não é contador de negócio. Reservar Durable Objects por usuário/tenant para uma quota realmente global e estrita que não possa permanecer no Postgres, evitando um único objeto global que se torne gargalo. Hyperdrive permite testar a continuidade com Neon/Postgres, mas exige validação de driver, transações e latência. Não migrar banco nem adotar DO só para trocar o provedor de WAF.

## Plano progressivo atualizado

1. Storage compartilhado Better Auth e limite de bytes JSON implementados localmente; migration `0106_better_auth_rate_limits` aplicada e verificada em Development. O smoke concorrente passou e removeu o bucket sintético; a tabela está vazia porque o runtime da mudança ainda não foi promovido. Para Staging, abrir PR com CI verde, aplicar pelo fluxo de merge e observar writes/latência real. Confirmar em paralelo a presença do Sentinel em Production sem ler ou publicar valor de segredo.
2. Inventariar registros DNS, nomes canônicos, preview/staging, webhooks, crons, CORS, aliases vercel.app e acesso direto ao origin. Confirmar o plano Cloudflare e usar hostname não produtivo proxied para ensaiar Vercel como origin.
3. Corrigir bypass de hostname/origin e validar TLS, cache, headers/IP confiável e comportamentos autenticados. Não mudar CLIENT_IP_SOURCE para cloudflare antes de impedir acesso direto à origem e testar cabeçalhos spoofados.
4. Aplicar rate limit Cloudflare em um único caminho público no piloto; baseline via Security Events/telemetria ou homologação, pois Log é Enterprise. Com Free, respeitar 1 regra, IP/path e 10s; subir plano somente se a necessidade exigir mais regras/campos/janelas.
5. Manter limites de identidade e negócio no Postgres. Adicionar limitadores Workers somente a rotas que migrarem para Workers e sejam aceitavelmente permissivas; considerar DO por chave só com requisito global comprovado. Não instalar Upstash sem medição de contenção/custo que justifique um terceiro armazenamento.
6. Depois, continuar migração de rotas independentes via Worker Routes e validar Hyperdrive/Neon; a migração do Next.js 16 deve seguir compatibility checks de vinext (beta) ou OpenNext e testes reais, não assumir compatibilidade completa.
7. Limites de bytes JSON, condição que evita escritas em buckets já bloqueados e tratamento de `RateLimit-Reset` foram corrigidos localmente. Política anti-spam de comentários, cadência do player, métricas de pool e coordenação Asaas entre instâncias continuam dependendo de baseline de uso, critérios de produto e/ou telemetria.

As alterações de runtime continuam no working tree. A migration está aplicada somente em Development; leitura posterior confirmou o registro `0106`, o índice de expiração e zero buckets após o smoke concorrente. Staging, Production, DNS e WAF não foram alterados. O runtime ainda não foi promovido; o próximo gate é PR/CI/merge em Staging e observação controlada de tráfego real. O documento não afirma que qualquer mudança já esteja ativa em Production nem que exista abuso em curso.

## Decisões pendentes para uma escolha baseada no projeto

Depois da aplicação em Development, revisar `0106` e medir writes, concorrência e latência durante o deploy de runtime; repetir a observação em Staging após PR/CI/merge. Antes de depender de Cloudflare WAF, confirmar zona/plano, DNS proxied, TLS/cache, todos os hostnames/aliases de origem, bypass direto, comportamento de cookies/Server Actions/webhooks/crons e cadeia de IP confiável. O projeto documenta que CLIENT_IP_SOURCE=cloudflare só é seguro quando a origem não aceita tráfego direto. Upstash ou Durable Objects continuam condicionados a dados de custo/latência, volume por identidade e política fail-open/closed; sem esses dados não devem ser adotados como requisito factual.

## Fontes primárias

- [Vercel WAF Rate Limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting)
- [Vercel WAF Usage & Pricing](https://vercel.com/docs/vercel-firewall/vercel-waf/usage-and-pricing)
- [Vercel WAF: tráfego mitigado sem custo CDN/FDT](https://vercel.com/changelog/web-application-firewall-mitigated-traffic-is-free-on-vercel)
- [Vercel: implementação via Firewall e `@vercel/firewall`](https://vercel.com/kb/guide/add-rate-limiting-vercel)
- [Cloudflare Rate Limiting Rules](https://developers.cloudflare.com/waf/rate-limiting-rules/)
- [Cloudflare Request Rate Calculation](https://developers.cloudflare.com/waf/rate-limiting-rules/request-rate/)
- [Cloudflare Rate Limiting Parameters](https://developers.cloudflare.com/waf/rate-limiting-rules/parameters/)
- [Cloudflare DNS Proxy Status](https://developers.cloudflare.com/dns/proxy-status/)
- [Cloudflare Rate Limiting API para Workers](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [Cloudflare actions e disponibilidade de Log](https://developers.cloudflare.com/ruleset-engine/rules-language/actions/)
- [Cloudflare Durable Objects: desenho e gargalo de objeto global](https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/)
- [Cloudflare Durable Objects pricing e limites](https://developers.cloudflare.com/durable-objects/platform/limits/)
- [Cloudflare Hyperdrive: bancos compatíveis](https://developers.cloudflare.com/hyperdrive/reference/supported-databases-and-features/)
- [Cloudflare Workers Routes](https://developers.cloudflare.com/workers/configuration/routing/routes/)
- [Cloudflare Next.js on Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
- [Cloudflare OpenNext adapter](https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/)
- [Upstash Rate Limit Getting Started](https://upstash.com/docs/redis/sdks/ratelimit-ts/gettingstarted)
- [Upstash Rate Limit Algorithms](https://upstash.com/docs/redis/sdks/ratelimit-ts/algorithms)
- [Upstash Rate Limit Features](https://upstash.com/docs/redis/sdks/ratelimit-ts/features)
- [Upstash Rate Limit Costs](https://upstash.com/docs/redis/sdks/ratelimit-ts/costs)
- [Upstash Redis pricing](https://upstash.com/pricing/redis)
- [Resend API rate limits](https://resend.com/changelog/api-rate-limit)
- [Resend Account Usage API](https://resend.com/changelog/account-usage-api)
- [JMVStream FAQ de limites da API](https://jmvstream.com/pt-br/rest-api-for-videos)
- [JMVStream API pública](https://jmvstream.com/pt-br/developer)
- [Cloudflare R2 limits](https://developers.cloudflare.com/r2/platform/limits/)
- [Better Auth rate limit options](https://better-auth.com/docs/reference/options)
- [Better Auth: database rate limit storage e schema de ORM](https://better-auth.com/docs/concepts/rate-limit)
- [Better Auth CLI e geração de schema](https://better-auth.com/docs/concepts/cli)
- [Asaas API limits](https://docs.asaas.com/reference/api-limits)
- [Vercel cron management](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
- [Vercel Functions limitations](https://vercel.com/docs/functions/limitations)
- [PostgreSQL `INSERT`](https://www.postgresql.org/docs/current/sql-insert.html)
- [PostgreSQL advisory lock functions](https://www.postgresql.org/docs/current/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS)
- [Stripe API rate limits and retries](https://docs.stripe.com/rate-limits)
