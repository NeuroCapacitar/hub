# Pesquisa: checkout aberto, cobrança pendente e valor a receber

Data: 2026-09-26
Commit auditado: 0fd52bc5, branch feature/small-changes
Escopo: análise somente leitura. Fontes externas limitadas a documentação oficial primária, conforme solicitado.

## Conclusão executiva

A preocupação de UX é válida, mas a descrição do cálculo atual precisa de uma correção: **o valor em aberto não soma checkouts falhos, cancelados ou expirados**. O SQL exclui esses estados. O problema real é mais sutil: soma o preço integral de qualquer Pedido ainda pendente cujo Checkout não esteja marcado como terminal. Isso inclui um link de Checkout ativo mesmo quando o Hub não tem evidência de que a pessoa abriu, preencheu ou tentou pagar; inclui também estados internos de criação ou resultado incerto.

Assim, o indicador atual é melhor entendido como **valor nominal de Pedidos ainda pendentes com Checkout não encerrado no estado local**, não como recebível confirmado nem como cobrança efetivamente gerada. Ele pode assustar ou induzir uma leitura financeira errada, especialmente porque aparece como “Valor em aberto”.

Recomendação: separar três conceitos:

1. **Cobranças pendentes:** valor ligado a cobranças reais identificadas no Asaas, ainda não pagas, conforme estados e evidências do provedor. É a melhor substituição para o valor financeiro principal, depois de fechar a lacuna de captura de eventos.
2. **Checkouts ativos:** contagem de links/sessões disponíveis. Se houver valor, apresentá-lo em contexto comercial como potencial nominal, nunca como “a receber”; sessão ativa não prova visita ou preenchimento.
3. **Checkouts encerrados e falhas operacionais:** contagens distintas. Cancelamento/expiração sem pagamento não é valor a receber; falha ou resultado incerto de criação exige reconciliação, não projeção de receita.

“A pessoa preencheu o checkout, mas não pagou” é uma condição que o Hub não consegue afirmar com os eventos e dados atualmente considerados pelo cálculo. O Asaas hospeda a tela, e seus eventos documentados de Checkout cobrem criação, cancelamento, expiração e pagamento, não uma etapa de visualização/preenchimento. Um evento de cobrança criada seria um sinal mais forte de tentativa real, mas não equivale a uma métrica completa de funil.

## Termos que não devem ser misturados

| Conceito | Evidência mínima | O que pode responder |
|---|---|---|
| Sessão/link de Checkout ativo | Checkout criado e ainda não encerrado | Há uma oportunidade de pagamento ainda disponível? |
| Tentativa/cobrança pendente | Objeto de cobrança do provedor, identificável, com estado não pago | Há uma cobrança real aguardando pagamento? |
| Recebível contábil | Direito presente e incondicional à contraprestação, conforme a política contábil aplicável | O valor atende à definição contábil de recebível? |
| Abandono/conversão do funil | Eventos de sessão/interação e conclusão com denominador consistente | Onde as pessoas deixam a jornada e qual é a conversão? |

O CPC 47 define recebível como direito incondicional à contraprestação — em termos simplificados, quando só a passagem do tempo resta antes de o pagamento vencer. Uma página de Checkout criada, isoladamente, não demonstra esse direito. A aplicabilidade contábil ao contrato concreto deve ser validada pelo responsável contábil; este relatório não é parecer contábil. [CPC 47, itens 105–108](https://www.cpc.org.br/Arquivos/Documentos/527_CPC_47_Rev%2021.pdf)

## O que o Hub faz hoje

### O valor principal

Em **src/features/admin/server.ts**, a função **getCheckoutPredicate** define “aberto” como Pedido com status pendente e checkout_status fora de failed, cancelled e expired. O resumo **readFinancialHealth** soma **orders.amount_in_cents** e conta Pedidos usando esse predicado. Portanto:

- **Excluídos do valor:** Checkout failed, cancelled ou expired.
- **Incluídos:** Checkout pending, creating, active ou uncertain, desde que o Pedido continue pending.
- **Base monetária:** preço total do Pedido, não valor de uma cobrança pendente lido de um objeto de cobrança do Asaas.

O Painel principal usa a mesma ideia: soma o valor dos Pedidos pendentes com Checkout fora dos estados terminais. A interface de Financeiro também informa que falhas, cancelamentos e expirações ficam fora do valor. Logo, a hipótese “soma todos os encerrados” não bate com a implementação atual.

### Por que “ativo” não significa “preenchido”

Em **src/features/payments/checkout.ts**, o Hub primeiro persiste uma reserva local com Pedido pendente e sem provider_checkout_id, provider_payment_id ou URL. Depois tenta criar o Checkout no Asaas; quando recebe o resultado, armazena o ID e o link e muda o estado para active.

O Asaas descreve a criação como emissão de uma página/link hospedado. O pagamento ocorre posteriormente, quando o pagador completa a jornada; o estado de pagamento deve ser acompanhado por API ou webhook. Portanto, o estado local active confirma que o Hub criou/persistiu uma sessão, não que o cliente abriu a página ou informou dados. [Asaas: criação de Checkout](https://docs.asaas.com/reference/create-new-checkout)

O domínio de integração do Hub também registra que o Checkout coleta dados do pagador na tela hospedada e que o Hub não envia customerData. A documentação oficial do Asaas confirma que, quando esses campos não são enviados, o pagador pode informar os próprios dados na página. Isso não torna os dados preenchidos observáveis pelo Hub antes de existir evidência posterior do provedor. [Asaas: como fornecer dados do cliente](https://docs.asaas.com/docs/how-to-provide-customer-data)

O evento Asaas CHECKOUT_CREATED é a criação, não uma visita do cliente. A lista documentada de eventos de Checkout inclui CHECKOUT_CREATED, CHECKOUT_CANCELED, CHECKOUT_EXPIRED e CHECKOUT_PAID; não documenta um evento de visualização ou preenchimento nessa lista. [Eventos de Checkout do Asaas](https://docs.asaas.com/docs/checkout-events)

### Estados internos que não são recebíveis

- **creating** significa que a chamada de criação está em andamento.
- **uncertain** significa que o resultado externo não pôde ser determinado com segurança.
- **pending** pode representar a reserva local antes de a URL existir; o cron remove reservas antigas ainda sem qualquer evidência externa após 15 minutos (**src/features/maintenance/server.ts**, limpeza de stale_reservations).
- Há uma janela de falha adicional: o pedido muda para `creating` antes da chamada ao Asaas. A recuperação pública devolve `processing` nesse estado, e a manutenção observada limpa reservas antigas `pending`, não `creating`. Se o processo morrer após a transição, a linha pode permanecer no agregado até uma reconciliação; o código auditado não apresentou um timeout específico para esse estado.

Esses estados têm valor operacional, mas não provam cobrança aberta. Especialmente uncertain deve aparecer como alerta de reconciliação, sem entrar silenciosamente numa soma financeira.

### Falha de semântica e possível estado desatualizado

O predicado do resumo consulta somente os estados locais e não considera a idade ou expiração temporal da sessão. O Asaas permite configurar expiração de Checkout e envia evento de expiração; seus webhooks têm entrega pelo menos uma vez, retry e possibilidade de interrupção da fila após falhas consecutivas. **Inferência:** se o evento de expiração não for aplicado, um Checkout já expirado externamente pode continuar contado como ativo localmente até outra reconciliação ou mutação. [Criação e expiração do Checkout](https://docs.asaas.com/reference/create-new-checkout), [entrega de eventos de Checkout](https://docs.asaas.com/docs/checkout-events)

### Lacuna: evento de cobrança criada

Em **src/features/payments/asaas-financial-events.ts**, o conjunto **knownPaymentWebhookEvents** não inclui PAYMENT_CREATED. O reducer encaminha para a decisão de pagamento apenas eventos presentes nesse conjunto; o evento desconhecido retorna decisão ignore. Logo, este caminho não registra PAYMENT_CREATED como a evidência inicial de cobrança pendente.

Isso importa porque a métrica desejada — cobrança gerada, ainda não paga — exige um objeto de cobrança, ID do provedor, estado/valor e associação segura ao Pedido. A documentação do Asaas distingue o Checkout da cobrança e documenta PAYMENT_CREATED como geração de uma nova cobrança. [Eventos de cobrança do Asaas](https://docs.asaas.com/docs/webhook-para-cobrancas)

O Asaas oferece uma estatística explicitamente baseada em cobranças, usando status=PENDING como exemplo de “valor total a receber”. Isso é conceitualmente mais próximo de “cobranças pendentes” do que somar Pedidos com links de Checkout ativos. Não significa, porém, que o resultado do Hub deva copiar sem validação o total do Asaas: o Hub precisa correlacionar suas próprias vendas, estados, reembolsos e parcelas. [Estatísticas de cobranças do Asaas](https://docs.asaas.com/reference/estatisticas-de-cobrancas)

### Achado adjacente: checkouts encerrados podem sumir da contagem/link

Há uma inconsistência provável no indicador auxiliar de Checkouts encerrados:

- **getCheckoutPredicate(..., "closed")** exige simultaneamente status do Pedido pending e checkout_status em failed, cancelled ou expired.
- Em **decideCheckoutEvent**, um CHECKOUT_CANCELED ou CHECKOUT_EXPIRED recebido enquanto o Pedido está pending muda também orderStatus para cancelled.
- A nota de “checkouts encerrados sem pagamento” e seu link filtram pelo grupo closed e pelo status do Pedido pending.

Consequência: cancelamentos e expirações processados normalmente deixam de satisfazer o próprio filtro de “closed”. A contagem tende a capturar falhas de criação que continuaram com Pedido pending, mas pode omitir checkouts cancelados/expirados cujo Pedido foi corretamente cancelado. Isso não faz esses valores entrarem no KPI principal; é um problema separado de contagem/filtro e deve ser coberto por teste antes de ajustar.

### Outro detalhe: visão por período

**readFinancialAnalytics** aplica a mesma condição de Checkout e filtra por **orders.created_at** no intervalo selecionado. Portanto a métrica de “Recebimentos em aberto” nessa análise representa Pedidos **criados naquele período e ainda pendentes no momento da consulta**, não o saldo aberto histórico exatamente no fim de cada dia e nem todas as cobranças geradas durante o período. O helper da interface parcialmente explicita isso (“criados no período”); o nome e o escopo devem continuar juntos para evitar leitura como série histórica de recebíveis.

## Comparação com documentação oficial de produtos

### Asaas

O produto documenta separadamente a criação de um Checkout hospedado e a confirmação posterior do pagamento. Já suas estatísticas de “valor a receber” consultam cobranças por estado, com PENDING como exemplo. Isso apoia a separação entre oportunidade de Checkout e valor de cobrança, sem impor um único KPI universal.

### Stripe

A API da Stripe modela Checkout Session status e Checkout Session payment_status como propriedades distintas. Uma sessão pode estar aberta, completa ou expirada, enquanto o pagamento tem estado próprio; até uma sessão complete pode ainda estar em processamento. A separação reforça que “sessão aberta” não é sinônimo de cobrança/recebível. [Stripe: objeto Checkout Session](https://docs.stripe.com/api/checkout/sessions/object)

Na Stripe Invoicing, por outro lado, uma fatura open é uma fatura finalizada aguardando pagamento e com saldo remanescente. Essa é uma entidade mais próxima de um compromisso/cobrança emitida do que uma sessão aberta de Checkout. [Stripe: ciclo e estados de invoices](https://docs.stripe.com/invoicing/overview)

### Shopify

Shopify separa relatórios de sessões e funil — sessões que chegaram ao Checkout e sessões que o concluíram — de eventos de pagamento associados a um Checkout abandonado. O relatório do funil define “reached checkout” por sessão e interação do usuário, e permite observar abandono entre etapas. [Shopify: relatórios de comportamento e funil](https://help.shopify.com/en/manual/reports-and-analytics/shopify-reports/report-types/default-reports/behaviour-reports), [Shopify: checkouts abandonados e eventos de pagamento](https://help.shopify.com/en/manual/promoting-marketing/create-marketing/abandoned-checkouts)

Isso não significa que o Hub deva replicar Shopify Analytics. Shopify controla a loja/funil e instrumenta sessões; no fluxo atual, o Hub cria uma tentativa e redireciona para uma tela hospedada por terceiro. O nível de observabilidade é diferente. **Não há um padrão universal demonstrado pelas fontes para um KPI chamado “Valor em aberto”; o nome só é confiável quando sua definição de negócio e sinais de origem são explícitos.**

## Decisão recomendada para o projeto

### Não chamar o valor atual de “a receber”

Não manteria a soma atual como principal métrica financeira sem ressalva. Ela é útil como **potencial nominal associado a Pedidos pendentes**, mas pode incluir sessão não visitada e estados técnicos. Se for mantida temporariamente, o rótulo deve deixar claro que é operacional/potencial, e o texto explicativo deve dizer explicitamente que não comprova cobrança criada, tentativa iniciada ou recebimento no Asaas.

### KPI financeiro principal

Recomendação de destino: **“Cobranças pendentes”**, calculado a partir de cobranças reais do Asaas correlacionadas ao Pedido e ainda não pagas, não apenas a partir de orders.status e checkout_status.

Antes de implementar, definir com precisão:

1. Quais estados do Asaas entram: PENDING e se OVERDUE será incluído ou mostrado separadamente. Não incluir CONFIRMED como “disponível”: Asaas diferencia confirmação de pagamento e disponibilidade do saldo, e o Hub também não deve insinuar saldo bancário.
2. Qual valor representa o saldo pendente: total do Pedido, valor da cobrança ou saldo remanescente. Isso é especialmente importante em compras parceladas, para evitar somar o Pedido cheio várias vezes ou misturar recebimento do consumidor com cronograma de liquidação ao vendedor.
3. Como PAYMENT_CREATED será reconhecido, correlacionado e persistido idempotentemente sem liberar acesso; qual regra de precedência mantém pagamentos tardios, duplicados, recusados ou fora de ordem seguros.
4. Como fazer backfill/reconciliação das cobranças já existentes sem inferir tentativa a partir de uma URL ativa.

### Checkouts e abandono

- Se útil para operação comercial, mostrar separadamente **Checkouts ativos** como contagem de links criados ainda não encerrados.
- Se mostrar o preço dos cursos desses links, chamar de **potencial nominal em checkout**, declarar que não é cobrança nem receita e evitar colocá-lo no mesmo bloco visual de recebimentos confirmados.
- Não afirmar “cliente preencheu o checkout” ou “checkout abandonado” com base apenas no status active. Para medir preenchimento/abandono, seria necessária uma fonte de eventos de interação confiável, com consentimento/privacidade e um denominador coerente. O evento PAYMENT_CREATED, se corretamente recebido, sustenta “cobrança criada aguardando pagamento”, não todo o funil.
- failed e uncertain devem continuar fora do valor a receber. uncertain deve ser indicador de reconciliação; falha deve ser operacional. Cancelados/expirados ficam como histórico, sem valor financeiro projetado.

### Correções independentes antes/depois do KPI

1. Corrigir a consulta e o link de checkouts encerrados para incluir os estados terminais cujo Pedido foi corretamente marcado cancelled, sem incluir Pedidos pagos que receberam eventos tardios do Checkout. Criar testes de projeção com cancelamento e expiração processados.
2. Distinguir internamente a métrica de cobrança pendente da oportunidade de Checkout, em vez de reutilizar o campo pendingRevenueInCents para ambos.
3. Tratar expiração como dado temporal do provedor ou reconciliar Checkouts ativos periodicamente. Hoje o agregador confia somente no estado persistido; não filtra por expiração.
4. Revisar a cópia de todas as superfícies: Visão geral do Financeiro, Painel Admin e análise por período. A visão por período atual mostra Pedidos criados no recorte que ainda estão pendentes agora, não um histórico diário de saldo aberto.
5. Validar os nomes “recebido”, “pago”, “confirmado” e “disponível” com o contrato financeiro do Asaas. O saldo no Asaas continua sendo a fonte para caixa/liquidação, como a interface já ressalva.

## Resposta direta

Sim, um valor elevado de sessões ainda abertas pode assustar o financeiro se parecer dinheiro devido. Porém, a implementação **não inclui checkouts falhos, cancelados ou expirados na soma**. O que inclui indevidamente para uma leitura de “a receber” são Pedidos pendentes cujo Checkout ainda parece não terminal, mesmo sem evidência de cobrança ou de preenchimento; estados creating/uncertain também entram. A melhor direção não é simplesmente “contar quem preencheu” — o Hub não observa esse fato — mas usar **cobranças efetivamente criadas e não pagas** no KPI financeiro, e manter sessões/abandono como métricas comerciais separadas.

## Limites e método

Foram auditados os trechos relevantes do fluxo Asaas, projeções administrativas, textos dos KPIs, estados e documentos de domínio; não foi feita consulta ao banco ou à conta Asaas. A pesquisa externa usou documentação oficial primária do Asaas, Stripe, Shopify e CPC. Foram usados dois subagentes em tarefas paralelas (auditoria somente leitura do código e pesquisa de fontes oficiais); os achados foram conferidos contra os arquivos citados. Nenhum dado sensível foi consultado ou reproduzido.
