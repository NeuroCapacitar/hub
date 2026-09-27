# Métricas financeiras e operacionais para vendas únicas de cursos

> Baseline: `f2b3f030` (`feature/small-changes`). Auditoria read-only do código, contratos e superfícies Admin/Suporte. Sem consulta a banco real, conta Asaas, dados de vendas ou captura visual.

## Auditoria do Hub

### Veredito executivo

**A base operacional é sólida; a semântica e a cobertura de algumas métricas ainda não são suficientemente uniformes para tratar toda a tela como um painel financeiro confiável.** Não recomendo redesenhar do zero nem adicionar mais cartões agora. Recomendo primeiro corrigir quatro pontos de exatidão, depois alinhar nomes, períodos e filas; só então decidir se vale projetar cobranças pendentes reais ou repasses dentro do Hub.

O projeto acerta ao separar o Pedido local da evidência do Asaas, exigir evidência financeira para liberar acesso, manter Revisões e eventos duráveis, proteger operações por grants e deixar explícito que receita do Hub não é saldo disponível. A rota tem Visão geral, Pedidos e Análise; o dashboard também distingue exceções que exigem ação de itens em acompanhamento. Isso é uma boa estrutura para uma operação pequena de vendas avulsas.

O maior problema não é falta de KPI: é que alguns valores mudam de significado entre superfícies ou não cobrem eventos que a própria operação trata. Adicionar gráficos ou métricas SaaS genéricas antes de resolver isso aumentaria a carga cognitiva sem melhorar a confiança.

### Design language e escopo da revisão

- **Superfície auditada:** Painel Administrativo e `/admin/financeiro` (Visão geral, Pedidos e Análise), com links para `/admin/operacao`.
- **Fontes de design:** `DESIGN.md` define que Admin/Suporte precisam localizar estados, evidências e próxima ação; métricas devem declarar período, população, denominador, fonte e se são observadas ou estimadas. `PRODUCT.md` define uma plataforma de compra avulsa de Cursos, não um SaaS de assinatura.
- **Decisões relevantes:** ADR-0005 fixa precedência de pagamentos/Revisões; ADR-0017 aceita grants financeiros delegáveis para Suporte. O guia de domínio financeiro ainda contradiz parte desse contrato.
- **Limite visual:** não houve screenshot nem inspeção de navegador; não classifico espaçamento, hierarquia gráfica ou contraste visual. A auditoria de UI abaixo se limita a rótulos, contexto temporal, destinos de links, estados e fluxo provados pelo código.
- **Exceções de design documentadas:** nenhuma específica para a família Financeiro.

### O que está bem encaminhado

- **Separação correta de conceitos:** o resumo recente chama links sem cobrança registrada de “potencial em checkouts ativos”, não de dinheiro a receber. Isso é mais seguro do que usar o preço de todo Pedido pendente como recebível.
- **Integridade financeira e acesso:** a matriz Asaas impede `CHECKOUT_PAID` de conceder acesso por si só; confirmação, risco, disputas e reembolsos passam por decisões explícitas, Revisões e auditoria.
- **Fila útil:** Revisões pendentes aparecem antes do resumo financeiro; o dashboard já agrupa incertos, falhas e itens de acompanhamento, em vez de tratar todo estado como alerta.
- **Granularidade para Suporte:** o código oferece visualizações e mutações financeiras por permissões distintas. Isso segue ADR-0017; a restrição “Admin-only” ainda escrita no guia de comércio é documentação desatualizada, não o contrato vigente.
- **Sem métricas de assinatura indevidas:** MRR, ARR e churn não são KPIs centrais para o modelo atual de compras avulsas.

### Achados priorizados

#### [CORRECTNESS-01] O filtro manual de Checkouts encerrados ainda esconde Pedidos cancelados

- **Evidência:** `src/app/(admin)/admin/financeiro/financial-orders-filter-menu.tsx:190-198` define `status: "pending"` ao escolher qualquer estado de Checkout. `src/features/admin/server.ts:2042-2048` permite que o filtro “closed” inclua Pedidos `pending` ou `cancelled`; porém o status adicional `pending` volta a excluir os cancelados.
- **Impacto:** o link contextual “Ver tentativas encerradas” consegue abrir a consulta sem status, mas o mesmo filtro dentro da tabela não mostra os Checkouts cancelados/expirados processados normalmente. A equipe vê duas respostas diferentes para o mesmo filtro.
- **Esforço:** S. **Risco da correção:** baixo, se o filtro remover o status ao selecionar “Encerrado” e preservar os demais filtros. **Confiança:** alta.
- **Recomendação:** deixar o filtro “Encerrado” sem status fixo (ou selecionar explicitamente os status permitidos) e cobrir o caminho menu → URL → query com Pedido `cancelled`.

#### [CORRECTNESS-02] `CHECKOUT_PAID` pode continuar dentro do potencial de Checkout ativo

- **Evidência:** `src/features/payments/asaas-financial-events.ts:210-220` mapeia `CHECKOUT_CREATED`, cancelado e expirado, mas não `CHECKOUT_PAID`; `:267-280` ainda persiste `providerCheckoutStatus`. `src/features/admin/server.ts:2054-2057` calcula Checkout potencial por `checkout_status = 'active'` e ausência de dados de cobrança, sem excluir `provider_checkout_status = 'PAID'`; o valor é somado em `:2328-2333`.
- **Impacto:** após evento `CHECKOUT_PAID`, o estado local pode continuar `active`. Como `PAYMENT_CREATED` não é aceito pelo conjunto de eventos atual, a cobrança ainda pode não ter ID/status local para acionar a exclusão. O card então pode incluir uma sessão que o próprio Asaas já marca como paga, embora não deva liberar acesso sem o evento financeiro autoritativo.
- **Esforço:** S–M. **Risco:** médio; é preciso separar “Checkout pago, aguardando evidência financeira” de “link ativo sem cobrança”. **Confiança:** alta.
- **Recomendação:** excluir `provider_checkout_status = 'PAID'` do valor potencial e expor esse caso como pendência de confirmação/reconciliação, preservando a precedência do ADR-0005.

#### [CORRECTNESS-03] O histórico bruto muda quando o estado atual do Pedido muda

- **Evidência:** o resumo global usa `status = 'paid'` em `src/features/admin/server.ts:2325-2326`; a receita por Curso repete esse filtro em `:2631-2632`. Já a Análise por período inclui `paid`, `refunded` e `disputed` em `:2392-2400`.
- **Impacto:** quando uma compra já paga passa para `refunded` ou `disputed`, ela some da receita bruta e da contagem “Pedidos pagos” do resumo global/por Curso, mas continua no recebido bruto da Análise por período. Isso torna a comparação entre telas dependente do estado atual do Pedido e pode reescrever para baixo a leitura histórica de vendas.
- **Esforço:** M. **Risco:** médio, pois exige definir a evidência histórica que conta como pagamento e manter refunds/disputes como movimentos separados. **Confiança:** alta.
- **Recomendação:** definir uma única base de “vendas com pagamento confirmado” (e.g. `paid_at` + valor pago/evidência) para resumo, ticket médio e receita por Curso, independente do estado terminal posterior. Mostrar estornos/disputas como ajustes separados; validar o comportamento em pedidos integralmente reembolsados e em disputa.

#### [CORRECTNESS-04] Reembolso parcial em Revisão não sinaliza que o líquido está incompleto

- **Evidência:** `src/features/payments/asaas-financial-events.ts:462-479` registra `PAYMENT_PARTIALLY_REFUNDED` como Revisão `partial_refund`, sem persistir ali um valor devolvido próprio. `src/features/admin/server.ts:2424-2453` calcula reembolsos usando somente `refund_requests` confirmados ou Pedidos `refunded`; `:2474-2476` subtrai apenas esse total do líquido. `src/app/(admin)/admin/financeiro/financial-analysis.tsx:39-42` só marca a estimativa como parcial quando faltam dados de taxa/líquido.
- **Impacto:** enquanto um reembolso parcial aguarda tratamento manual, a tela pode mostrar líquido sem avisar que há uma reversão não incorporada. O valor não deve ser inferido a partir do valor total da cobrança.
- **Esforço:** M. **Risco:** médio; evitar dupla contagem entre Revisão, estado do Pedido e eventual solicitação de reembolso. **Confiança:** alta.
- **Recomendação:** até haver valor parcial reconciliado, sinalizar a estimativa afetada como incompleta/exposta. Depois, persistir valor e data do reembolso parcial com idempotência e incluir somente evidência confirmada na fórmula.

#### [WORKFLOW-01] Alertas de reembolso não abrem uma lista dos Pedidos afetados

- **Evidência:** `src/app/(admin)/admin/(dashboard)/page.tsx:218-225,297-303` cria alertas para reembolsos falhos/em processamento, mas aponta para `/admin/financeiro`. A rota filtra `status`, `checkout`, `paymentMethod` e busca, sem filtro de `refund_requests.status` (`src/app/(admin)/admin/financeiro/page.tsx:36-55`); o estado do reembolso só aparece ao abrir detalhes do Pedido.
- **Impacto:** o dashboard conhece a quantidade da fila, mas Admin/Suporte precisa abrir a lista geral e encontrar os Pedidos individualmente. Uma falha operacional não tem destino acionável correspondente.
- **Esforço:** M. **Risco:** médio; cada ação deve respeitar grants diferentes de leitura, conciliação e execução de reembolso. **Confiança:** alta.
- **Recomendação:** criar filtro/fila de Reembolsos por estado (solicitado, processamento, incerto, falho, confirmado), com links dos alertas para a lista filtrada e valor/status do Pedido junto ao reembolso.

#### [PERMISSIONS-01] O link de recuperação de Webhook confunde `viewOperations` com Auditoria

- **Evidência:** `src/app/(admin)/admin/financeiro/financial-overview.tsx:497-535` mostra “Abrir Operação” somente se `canViewGlobalAudit`; a rota `/admin/operacao` exige `viewOperations` (`src/app/(admin)/admin/operacao/page.tsx:317`). `viewOperations` é leitura padrão de Suporte e `manageOperations` é grant separado (`src/lib/auth-policy.ts:95-135`).
- **Impacto:** um Suporte pode ter acesso à Operação e até `manageOperations`, mas a área Financeiro esconde o link e diz para encaminhar a recuperação a Admin apenas por não ter `viewGlobalAudit`.
- **Esforço:** S. **Risco:** baixo se a navegação usar `viewOperations` e as mutações continuarem protegidas por `manageOperations`. **Confiança:** alta.
- **Recomendação:** condicionar o link à permissão de leitura da Operação; orientar separadamente quem pode apenas investigar e quem pode executar a recuperação.

#### [WORKFLOW-02] “Pedidos aguardando confirmação” se sobrepõe a “Resultados financeiros incertos”

- **Evidência:** `src/features/admin/server.ts:248-253` conta como pendentes todos os Pedidos `pending` cujo Checkout não está terminal, incluindo `uncertain`. O dashboard conta checkouts incertos à parte (`src/app/(admin)/admin/(dashboard)/page.tsx:188-215`) e também cria “Pedidos aguardando confirmação” para a contagem ampla (`:280-286`).
- **Impacto:** o mesmo Pedido incerto pode aparecer em “Ação necessária” e em “Acompanhar” como se fossem dois itens. “Checkout ainda aberto” também não descreve criação `pending`/`creating` nem resultado `uncertain` com precisão.
- **Esforço:** S. **Risco:** baixo se as categorias forem particionadas ou a sobreposição declarada. **Confiança:** alta.
- **Recomendação:** usar estados sem sobreposição: incerteza/erro em ação necessária; link ativo sem cobrança em acompanhamento do cliente; criação em processamento em fila técnica. Não somar essas categorias como clientes diferentes.

#### [METRIC-01] “Taxa de reembolso” é razão de fluxos de período, não taxa por coorte

- **Evidência:** recebimentos são agrupados por `paid_at`/`created_at` (`src/features/admin/server.ts:2391-2411`); reembolsos, por `confirmed_at`/`refunded_at` (`:2424-2451`); `refundRatePercent` divide contagem de reembolsos no período pela contagem de recebimentos do período (`:2464-2471`). A interface chama isso de “Taxa de reembolso” (`src/app/(admin)/admin/financeiro/financial-analysis.tsx:154-157`).
- **Impacto:** o numerador pode conter compras antigas reembolsadas neste período e o denominador só compras pagas neste período; a proporção pode passar de 100% e não mede a parcela da coorte atual que foi reembolsada. O help descreve a fórmula de fluxos, mas não destaca a consequência.
- **Esforço:** S para renomear/explicar; M para uma taxa por coorte. **Risco:** médio se mudar a definição, pois altera comparabilidade histórica. **Confiança:** alta para a fórmula; média para qual métrica o negócio quer.
- **Recomendação:** para leitura financeira do período, renomear como razão de reembolsos confirmados por recebimentos do período (preferencialmente explicitar se é por valor ou contagem). Só chamar de “taxa de reembolso” se numerador e denominador forem a mesma coorte de Pedidos e uma janela de maturação estiver definida.

#### [METRIC-02] A data dos períodos é a confirmação no Hub, não necessariamente a data efetiva do pagamento

- **Evidência:** o processor passa `dependencies.now()` ao conceder (`src/features/payments/asaas-webhook-processor.ts:929-934`) e o projeta em `orders.paid_at` (`src/features/payments/apply-authoritative-financial-evidence.ts:149-153`). A aprovação manual também preenche `paid_at` com `now()` (`src/features/payments/payment-reviews.ts:73-80`). A Análise usa `paid_at` para a janela (`src/features/admin/server.ts:2391-2400`), mas o guia descreve “data de pagamento” (`docs/domain/commerce-and-access.md:267-269`). O payload/documentação Asaas disponibiliza `confirmedDate`, `paymentDate` e `clientPaymentDate` ([eventos para cobranças Asaas](https://docs.asaas.com/docs/webhook-para-cobrancas)).
- **Impacto:** Webhook atrasado ou Revisão manual pode deslocar um recebimento para o período em que o Hub processou/aprovou o evento, e não para a data efetiva reportada pelo provedor. A comparação por período fica dependente do atraso da fila.
- **Esforço:** M. **Risco:** médio; datas podem faltar ou ser ambíguas e não se deve inventar data histórica. **Confiança:** alta.
- **Recomendação:** ratificar a base. Para vendas por pagamento, persistir a data efetiva do provedor quando confiável, com proveniência e fallback; se a intenção é medir confirmação local, nomear e documentar como “confirmado no Hub”. Preservar separadamente a data de processamento/revisão.

#### [UX-01] “Resumo do dia” apresenta valores de todo o histórico

- **Evidência:** a seção se chama `Resumo do dia` (`src/app/(admin)/admin/(dashboard)/page.tsx:493-498`), enquanto `getAdminOverview` soma Pedidos pagos sem intervalo de datas (`src/features/admin/server.ts:234-240,248-253`). O card é descrito como “Histórico”.
- **Impacto:** o helper reduz o risco, mas o título pode sugerir venda/receita de hoje para uma pessoa que está fazendo a operação diária.
- **Esforço:** S. **Risco:** baixo para renomear; médio para trocar a lógica para “hoje”. **Confiança:** alta sobre a diferença temporal; média sobre interpretação sem teste com usuários.
- **Recomendação:** corrigir o nome para “Resumo da operação” e manter o valor histórico explicitamente qualificado, ou transformar a seção em uma janela de tempo real com timezone/denominadores definidos. Não misturar os dois.

#### [DOCS-01] Alinhe Produto, guia financeiro e permissões antes de novas métricas

- **Evidência:** `PRODUCT.md:153-154` ainda promete “recebimentos em aberto”, enquanto o indicador atual é potencial em links sem cobrança (`src/app/(admin)/admin/financeiro/financial-analysis.tsx:147-152`). `docs/domain/commerce-and-access.md:240-249` ainda declara conciliação e Revisões exclusivas de Admin, mas ADR-0017 aceita grants delegáveis para Suporte; `src/lib/auth-policy.ts:129-135` implementa esses grants. O guia de comércio também repete o bloco de parcelamento/`financial_events` em `:274-288`.
- **Impacto:** documentação de produto pode prometer recebíveis inexistentes, a autorização de Suporte fica contraditória e a duplicação enfraquece a leitura do contrato canônico.
- **Esforço:** S. **Risco:** baixo; alinhar à decisão aceita e remover repetição sem mudar autorização. **Confiança:** alta.
- **Recomendação:** reconciliar o texto de Produto e do guia de domínio com o código e ADR-0017; preservar “recebível” apenas para cobrança do provedor, e limpar o parágrafo duplicado.

#### [TESTS-01] As projeções financeiras não têm teste de execução da consulta

- **Evidência:** `src/features/admin/server-read-projections.test.ts:263-327,383-446` usa `vi.mock("@/db", () => ({ getPool: () => ({ query }) }))`, injeta linhas e verifica trechos da string SQL. Os testes não executam as agregações em PostgreSQL.
- **Impacto:** regressões de filtro/joins/temporalidade ou relações entre cobranças e Pedidos podem preservar os fragmentos assertados e ainda devolver valores errados. Isso é particularmente sensível para status pós-refund, eventos tardios e parcelas.
- **Esforço:** M. **Risco:** baixo, usando a infraestrutura PostgreSQL de CI já existente. **Confiança:** alta.
- **Recomendação:** adicionar testes de integração que executem as projeções com cenários de pagamento, disputa/refund parcial ou total, refund de período anterior, checkout pago sem confirmação e linhas de parcelamento; manter os testes rápidos existentes como testes de contrato SQL.

### Lacuna de produto: cobranças reais pendentes

O novo “Potencial em checkouts ativos” é uma proxy comercial corretamente qualificada; **não é uma métrica de cobrança a receber**. A lista Asaas inclui `PAYMENT_CREATED` como criação de cobrança, `PAYMENT_CONFIRMED` como pagamento efetuado ainda sem saldo disponível e `PAYMENT_RECEIVED` como valor disponível na conta ([eventos para cobranças Asaas](https://docs.asaas.com/docs/webhook-para-cobrancas)). Esse `PAYMENT_CREATED` não está no `knownPaymentWebhookEvents` atual (`src/features/payments/asaas-financial-events.ts:99-110`). O endpoint do Asaas soma cobranças `PENDING` segundo os filtros e o chama de total a receber ([estatísticas de cobranças](https://docs.asaas.com/reference/estatisticas-de-cobrancas)).

**Recomendação:** não inventar esse valor a partir de `orders.amount_in_cents` ou URL ativa. Se o Hub precisar operar cobranças pendentes, planejar uma projeção própria de cobranças correlacionadas por ID/external reference, com status, valor, data e idempotência; tratar cada parcela sem somar o total do Pedido novamente. Até lá, mantenha o valor de Checkout como potencial nominal e mande conferir recebíveis/saldo no Asaas. O saldo disponível atual tem endpoint próprio ([saldo da conta Asaas](https://docs.asaas.com/reference/recuperar-saldo-da-conta)); o extrato é um ledger de movimentos, pode ter múltiplos lançamentos por operação e serve para histórico/conciliação ([extrato Asaas](https://docs.asaas.com/reference/recuperar-extrato)).

### Métricas recomendadas para este produto

Para vendas avulsas de Cursos, priorizaria poucas métricas com denominadores explícitos:

1. **Vendas com pagamento confirmado no período:** valor bruto e número de Pedidos únicos com evidência financeira, data-basis claramente definida.
2. **Reembolsos confirmados:** valor e número, separados de solicitações em processamento, falhas, reembolsos parciais em Revisão e disputas.
3. **Líquido estimado do período:** bruto menos taxas e reembolsos confirmados, marcado como parcial se houver taxa ausente, partial refund em revisão ou evidência incompleta; não chamar de lucro nem saldo bancário.
4. **Cobranças pendentes/vencidas:** apenas depois de guardar e correlacionar cobranças reais do Asaas; status de Pedido e sessão de Checkout não substituem o objeto de cobrança.
5. **Fila de ação:** Revisões, incertezas, reembolsos falhos/em processamento, disputas e falhas de Webhook com idade, valor exposto e destino direto, respeitando grants.
6. **Quebra por Curso/método:** útil para decisão comercial, mas ligada ao mesmo período e ao mesmo conceito de venda; a tabela atual é só histórica.

Não adicionaria MRR, ARR ou churn de assinatura ao modelo atual de compra única; nem conversão/abandono de visitantes com base em pedido registrado ou `PAYMENT_CHECKOUT_VIEWED`. O segundo é visualização da fatura da cobrança, não evento confiável de preenchimento do Checkout segundo o próprio Asaas. Também não importaria o saldo do Asaas para o card de receita: se o negócio quiser uma visão de caixa no Hub, ela deve ser uma seção separada, com fonte, horário da última atualização e status de repasse explícitos.

### Resultado após aprovação e implementação

1. Filtros de Checkout encerrado preservam Pedidos cancelados; Checkouts ativos, em criação, incertos e marcados como pagos sem confirmação foram separados. `PAYMENT_CREATED`/`PAYMENT_UPDATED` são registrados sem conceder acesso; a precedência de evidências do ADR-0005 permanece.
2. Vendas brutas usam pagamento confirmado com valor e identificador Asaas, permanecem no histórico após reembolso/disputa e usam data efetiva do provedor, ou `paid_at` do Hub quando ausente. A razão de reembolsos está explicitada como contagem de fluxos no período, não coorte. Revisões parciais pendentes deixam o líquido marcado como incompleto.
3. A lista de Pedidos filtra estados de reembolso e pagamentos sem vínculo, mostra o estado do reembolso por linha e recebe destinos diretos do Painel. Filas financeiras mostram idade e valor dos Pedidos envolvidos, sem chamar exposição de perda. A navegação para Operação usa `viewOperations`; mutações seguem grants próprios. Resumos global, por Curso e da área de Suporte usam a mesma definição histórica de pagamento confirmado.
4. Produto e guia de comércio foram alinhados ao runtime e ao ADR-0017; o bloco duplicado no guia foi removido.
5. Foi criado teste PostgreSQL de integração para a projeção por período e transições `paid`/`refunded`/`disputed`, incluindo reembolso de período posterior e fallback de data. Não foi executado localmente porque `INTEGRATION_DATABASE_URL` não está configurada; a CI executa os arquivos `*.integration.test.ts` com banco descartável.

**Fora deste patch:** projeção de cobranças pendentes/vencidas reais do Asaas e importação de saldo/repasse. A própria recomendação condiciona essas métricas a um modelo de cobrança correlacionada por ID, com regras próprias para parcelas; não usei `orders.amount_in_cents` como recebível. Comparação com período anterior também não foi adicionada: os períodos existentes foram mantidos enquanto se estabilizam as bases dos indicadores, sem introduzir novos sinais não validados.

**Verificação:** `bun run verify:quick` passou (492 arquivos, 3.441 testes). `bun run docs:check`, `bun run db:migrations:check`, typecheck e Ultracite passaram. A revisão CodeRabbit apontou três itens aplicáveis (junção ausente na contagem de fallback, combinação de filtros incompatíveis e rótulo divergente); todos foram corrigidos e revalidados. `bun run verify` concluiu esses gates e os testes; o build compilou, mas o prerender falhou porque `.env.local` não contém variáveis obrigatórias de Production. Knip encontrou três exports não usados preexistentes de `src/components/reui/frame.tsx` (`FrameDescription`, `FrameFooter`, `FrameHeader`) e dicas de configuração; esse componente não faz parte do diff. A migration `0094_provider_payment_date` foi aplicada apenas ao Development em 2026-09-26 e validada por leitura; Staging e Production não foram tocados.

**O que não foi auditado:** dados financeiros de Development, bancos de Staging/Production, conta/valores reais Asaas, export contábil, screenshots ou testes com Admin/Suporte. Em Development foi verificado somente o alvo e a aplicação da migration. Não é parecer contábil/tributário.

## Pesquisa externa

**Acesso às fontes: 26/09/2026.** Pesquisa de documentação primária de Asaas, Stripe, Shopify e Teachable. Relatos comunitários aparecem somente como evidência anedótica, não como padrão. Não foram avaliados código, dados de uma plataforma específica nem normas contábeis.

### Não existe um vocabulário universal de KPIs

As plataformas documentam objetos, status, datas e relatórios próprios; os nomes parecidos não garantem que os valores contem a mesma coisa. A documentação da Shopify, por exemplo, separa relatórios de vendas (atividade de pedidos), relatórios de pagamentos (dinheiro pago) e atividade de saldo/repasse. A Teachable também separa transações, ganhos líquidos e repasses. Isso sustenta a inferência de que não há uma definição universal única de “vendas”, “recebíveis” ou “saldo” aplicável a todos os painéis; cada indicador precisa declarar sua base e período. [Shopify — Finance reports](https://help.shopify.com/en/manual/reports-and-analytics/shopify-reports/report-types/default-reports/finances-report), [Teachable — Transaction history and reports](https://support.teachable.com/en/articles/11682567-transaction-history-and-reports)

### Objetos e estados que não devem ser confundidos

| Conceito | O que mede | O que não permite concluir sozinho |
|---|---|---|
| **Sessão/link de checkout** | Uma tentativa ou página hospedada para o cliente iniciar/concluir a compra. No Asaas, criar o checkout devolve uma página/link; o cliente ainda precisa agir. No Stripe, `open`, `complete` e `expired` descrevem a sessão, enquanto `payment_status` é um campo separado. | Checkout criado ou ativo não prova que a pessoa abriu a página, preencheu dados, tentou pagar ou gerou uma cobrança. `complete` também não é sinônimo universal de dinheiro liquidado: no Stripe o processamento pode continuar. [Asaas — Checkout](https://docs.asaas.com/docs/asaas-checkout), [Stripe — Checkout Session object](https://docs.stripe.com/api/checkout/sessions/object) |
| **Visualização do checkout/fatura** | Sinal de que uma página específica foi visualizada, quando o provedor fornece esse evento. | Não prova intenção de compra nem pagamento. No Asaas, `PAYMENT_CHECKOUT_VIEWED` significa visualização da fatura da cobrança, e não deve ser interpretado como evento geral de conclusão do formulário do checkout. [Asaas — Eventos para cobranças](https://docs.asaas.com/docs/webhook-para-cobrancas) |
| **Cobrança/pagamento gerado** | Um valor formalmente registrado para cobrança, vinculado a um meio e estado de pagamento. No Asaas, `PAYMENT_CREATED` é geração de cobrança; a API de estatísticas permite somar cobranças por status, inclusive `PENDING` (“valor total a receber” no exemplo da própria documentação). | Não é igual a uma intenção de compra ou ao valor de uma sessão de checkout; também não prova que o valor já está disponível em conta. [Asaas — Estatísticas de cobranças](https://docs.asaas.com/reference/estatisticas-de-cobrancas), [Asaas — Eventos para cobranças](https://docs.asaas.com/docs/webhook-para-cobrancas) |
| **Pagamento concluído/confirmado** | Uma transação que atingiu o critério de sucesso definido pelo provedor. O Stripe separa status do PaymentIntent, incluindo `processing`, `requires_capture` e `succeeded`. No Asaas, `PAYMENT_CONFIRMED` indica pagamento efetuado, mas com saldo ainda indisponível. | “Sucesso” no fluxo do comprador não implica necessariamente liquidação, disponibilidade imediata ou repasse bancário. É necessário explicitar se o indicador conta pagamento autorizado, capturado, confirmado ou recebido. [Stripe — PaymentIntent](https://docs.stripe.com/api/payment_intents), [Asaas — Eventos para cobranças](https://docs.asaas.com/docs/webhook-para-cobrancas) |
| **Recebido/liquidado** | Estado financeiro posterior: no Asaas, `PAYMENT_RECEIVED` indica que os fundos estão disponíveis na conta. Em Stripe, transações de saldo têm valor bruto, tarifa, valor líquido, status `pending`/`available` e data `available_on`. | Não é sinônimo de venda por data do pedido nem de depósito bancário já concluído. [Asaas — Eventos para cobranças](https://docs.asaas.com/docs/webhook-para-cobrancas), [Stripe — Balance Transaction object](https://docs.stripe.com/api/balance_transactions/object) |
| **Estorno, reembolso ou disputa** | Eventos que revertem ou contestam uma transação. Asaas diferencia reembolso em processamento, total/parcial e chargeback; Stripe mantém objetos de reembolso e disputa, com status e valor próprios. | Não convém somá-los como falhas de checkout nem tratá-los como um único evento: uma disputa pode estar aberta sem ter sido decidida, e um reembolso pode estar pendente. [Asaas — Eventos para cobranças](https://docs.asaas.com/docs/webhook-para-cobrancas), [Stripe — Disputes](https://docs.stripe.com/api/disputes) |
| **Saldo disponível/pendente** | Posição atual do dinheiro dentro do provedor. Stripe distingue fundos disponíveis para repasse de fundos ainda pendentes; Asaas oferece consulta de saldo e extrato para movimentos registrados. | Não representa as vendas de um período: inclui efeitos de liquidação, tarifas, reembolsos, transferências e outros movimentos. [Stripe — Balance object](https://docs.stripe.com/api/balance/balance_object), [Asaas — Saldo da conta](https://docs.asaas.com/reference/recuperar-saldo-da-conta), [Asaas — Extrato](https://docs.asaas.com/reference/recuperar-extrato) |
| **Repasse/payout** | Uma transferência de saldo do provedor para uma conta bancária. Stripe documenta status como `pending`, `in_transit`, `paid`, `canceled` e `failed`, além de data esperada de chegada. | Não equivale ao total vendido ou recebido no período. Reembolsos, tarifas, disputas, calendário de liquidação e transações de outros dias podem compor o repasse. [Stripe — Payouts](https://docs.stripe.com/api/payouts), [Stripe — Balance object](https://docs.stripe.com/api/balance/balance_object) |

### Como os produtos organizam a visão diária

- **Asaas:** a API de estatísticas agrega contagem e valores brutos/líquidos de cobranças com filtros por status, meio e datas; a documentação usa `PENDING` como exemplo de valor a receber e `RECEIVED` para valor recebido. A consulta de saldo responde à posição atual, enquanto o extrato registra movimentos efetivos para conciliação. São recortes diferentes, não cartões intercambiáveis. [Estatísticas de cobranças](https://docs.asaas.com/reference/estatisticas-de-cobrancas), [Saldo](https://docs.asaas.com/reference/recuperar-saldo-da-conta), [Extrato](https://docs.asaas.com/reference/recuperar-extrato)
- **Stripe:** a documentação divide pagamentos/PaymentIntents, transações de saldo, disputas e payouts. O saldo disponível e pendente é distinto dos relatórios de atividade; transações carregam `amount`, `fee`, `net`, `status`, `created` e `available_on`, permitindo explicar como o dinheiro mudou e quando ficou disponível. [PaymentIntents](https://docs.stripe.com/api/payment_intents), [Balance transactions](https://docs.stripe.com/api/balance_transactions/object), [Payouts](https://docs.stripe.com/api/payouts)
- **Shopify:** o painel de Analytics combina cartões personalizáveis para indicadores de vendas, sessões e operação; seus relatórios distinguem vendas de pagamentos. A documentação define “gross sales” como preço × quantidade antes de descontos e reversões e inclui pedidos pendentes, cancelados e não pagos. “Net sales” subtrai descontos e reversões; “total sales” também incorpora tributos, frete e taxas. Portanto, a etiqueta do indicador e sua fórmula importam mais que o nome isolado. [Analytics overview](https://help.shopify.com/en/manual/reports-and-analytics/shopify-reports/overview-dashboard), [Sales reports](https://help.shopify.com/en/manual/reports-and-analytics/shopify-reports/report-types/default-reports/sales-report), [Finance reports](https://help.shopify.com/en/manual/reports-and-analytics/shopify-reports/report-types/default-reports/finances-report)
- **Teachable (plataforma de cursos):** o histórico de transações apresenta vendas, ganhos, reembolsos e chargebacks e permite filtrar/exportar por intervalo de datas; o detalhe pode separar valor bruto, taxas, tributos, valor líquido, histórico de estorno e disputa. A documentação também explica que repasses são líquidos de taxas, tributos, reembolsos e chargebacks. Uma página de Analytics da Teachable enumera contagem de transações bem-sucedidas, valor médio por transação, percentual e contagem de reembolsos; ela é indicada como beta e também cobre outros modelos. Aqui só são considerados os indicadores transacionais aplicáveis a compra única, não MRR, churn ou renovação. [Transaction history](https://support.teachable.com/en/articles/15628302-view-your-sales-and-transaction-history), [Sales analytics dashboard](https://support.teachable.com/en/articles/11682566-sales-analytics-dashboard)

Em conjunto, essas fontes mostram famílias práticas de métricas, sem estabelecer um pacote obrigatório: **compras/pagamentos concluídos** (contagem e valor), **valor médio por transação**, **descontos e reembolsos**, **disputas/chargebacks**, **cobranças emitidas e ainda pendentes**, **funil de checkout quando há eventos suficientes**, **saldo disponível/pendente**, **repasses e tarifas**, e **atividade que exige ação** (reembolso ou disputa pendente, falha de repasse, cobrança vencida). A escolha depende do que os eventos e dados realmente permitem observar.

### Definição temporal é parte da métrica

Os provedores oferecem e usam eixos de data diferentes. Asaas permite filtrar por criação, vencimento, data de pagamento e data estimada de crédito. Shopify pode atribuir a venda à data em que o pedido foi colocado e a entrada de pagamento à data em que foi paga; atividade de saldo/refund e payout seguem seus próprios momentos. O Stripe separa `created` da data em que os fundos ficam `available_on`, e seus payouts têm chegada/status próprios. Teachable declara que calcula timestamps de transação em UTC. [Asaas — Estatísticas](https://docs.asaas.com/reference/estatisticas-de-cobrancas), [Asaas — Listar cobranças](https://docs.asaas.com/reference/list-payments), [Shopify — discrepância entre vendas e pagamentos](https://help.shopify.com/en/manual/reports-and-analytics/shopify-reports/report-types/default-reports/finances-report), [Stripe — Balance transactions](https://docs.stripe.com/api/balance_transactions/object), [Teachable — Transaction history](https://support.teachable.com/en/articles/15628302-view-your-sales-and-transaction-history)

Consequência geral: totais de “hoje”, “mês” ou “últimos 30 dias” podem divergir sem que haja erro, se um relatório agrupa por pedido e outro por pagamento, liquidação, reembolso ou repasse. Um relatório confiável informa o evento contado, a data usada, o fuso horário, o tratamento de estornos e se o valor é bruto ou líquido. Shopify documenta explicitamente a diferença entre período de pedido e período de pagamento; a Teachable documenta UTC; a Stripe fornece fuso de relatório selecionável e usa UTC como padrão em alguns relatórios. [Shopify — Finance reports](https://help.shopify.com/en/manual/reports-and-analytics/shopify-reports/report-types/default-reports/finances-report), [Stripe — Report Run object](https://docs.stripe.com/api/reporting/report_run/object), [Teachable — Transaction history](https://support.teachable.com/en/articles/15628302-view-your-sales-and-transaction-history)

### Checkout abandonado não é falha de pagamento

A Shopify documenta sua definição legada de checkout abandonado como processo incompleto por mais de 10 minutos depois de o cliente informar o e-mail; a mesma página descreve eventos de pagamento que podem indicar falha. Isso é um critério da Shopify, não uma regra universal. A distinção útil em nível de produto é entre saída antes de uma tentativa de pagamento identificável e tentativa que falhou/foi recusada; as contagens exigem eventos de funil e de pagamento correlacionáveis. [Shopify — Recovering abandoned checkouts](https://help.shopify.com/en/manual/orders/abandoned-checkouts)

**Evidência anedótica de fórum:** um participante da comunidade Shopify, em agosto de 2026, relata que a lista de checkouts abandonados e os eventos de pagamento recusado ficam em lugares distintos e representam etapas diferentes. É um relato de operador e serve apenas como ilustração de confusão operacional; a definição normativa continua sendo a documentação oficial da Shopify. [Shopify Community — Checkout drop-off is not the same as payment failure](https://community.shopify.com/t/checkout-drop-off-is-not-the-same-as-payment-failure/669091/5)

### Limites e inferências

Não foi encontrada uma norma transversal que imponha os mesmos KPIs, fórmulas ou datas a um painel financeiro de cursos vendidos uma única vez. “Receita” pode ainda ter significado contábil próprio conforme política e jurisdição; relatórios de vendas ou de gateway não substituem automaticamente escrituração ou conciliação contábil. A conclusão sobre ausência de padrão universal é uma inferência da comparação das definições oficiais acima, não uma citação de norma contábil. Métricas de recorrência foram excluídas porque não são necessárias para descrever venda única de curso.
