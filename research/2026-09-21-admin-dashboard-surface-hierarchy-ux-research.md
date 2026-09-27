# Pesquisa: hierarquia de superfícies no dashboard Admin

> Escopo: validar a próxima etapa do sprint após a Home do Aluno; investigar a
> proposta de reduzir cards aninhados e tornar o Painel Admin mais sóbrio.
> Código analisado: `feature/small-changes` em `8ecf677b`.

## Estado atual

O dashboard Admin já possui uma ordem operacional clara:

1. Resumo do dia;
2. Pendências para resolver;
3. Conteúdo e certificados;
4. Contexto operacional;
5. Atividade recente;
6. Solicitações de suporte, quando existem.

Os agrupamentos têm responsabilidades diferentes. `IssueGroup` reúne filas que
exigem ação ou acompanhamento; `CatalogHealthCard` e `CertificateQueueCard`
tratam prontidão; `ContextCard` mostra contexto; `RecentActivity` usa tabelas
para compras, Certificados e comentários.

Há, entretanto, alguns níveis visuais repetidos:

- `Card` com `IssueRow` novamente contornada;
- `Card` de prontidão com resumo interno contornado e linhas de Cursos;
- `ContextCard` com métricas internas contornadas;
- tabelas dentro de um Card e de um contêiner com borda.

Isso é um candidato de polimento, não prova de que a página inteira deva ser
reorganizada.

## Evidência interna que limita a mudança

O plano anterior de reorganização do Admin já removeu Webhooks detalhados,
atalhos estáticos e blocos duplicados. A revisão posterior registrou que a Home
estava equilibrada para o estágio atual, mantendo compras recentes, emissões,
pendências e triagem operacional. Ver:

- `advisor-plans/admin-dashboard-review-2026-09-08.md`, seções 17 e 18;
- `advisor-plans/admin-dashboard-implementation-plan-2026-09-08.md`;
- `DESIGN.md`, regras de composição e de superfícies.

Esses documentos não substituem inspeção visual renderizada, mas tornam uma
remoção ampla de conteúdo uma decisão de baixa confiança. A operação Admin
precisa ser densa e acionável; não deve virar uma Home minimalista apenas para
parecer mais leve.

## Pesquisa externa

1. O GOV.UK recomenda dashboards para indicadores de alto nível, alertando que
   dashboards não destacam automaticamente os insights e podem sobrecarregar
   quando misturam informação detalhada. A recomendação é usar hierarquia,
   estrutura e explicações concisas.
   - https://brand.design-system.service.gov.uk/data/dashboards/

2. A lista de recursos da Shopify recomenda listas compactas e escaneáveis para
   coleções pequenas, levando a pessoa ao detalhe completo. Isso apoia manter
   tabelas/linhas de pendência e evitar transformar cada item em um card grande.
   - https://shopify.dev/docs/api/app-home/latest/patterns/compositions/resource-list

3. O Carbon distingue tiles simples de Cards mais complexos: tiles agrupam
   informações ou ações relacionadas, enquanto Cards podem conter múltiplas
   interações. Isso sugere reservar superfícies fortes para unidades de decisão,
   não para cada métrica ou linha interna.
   - https://v10.carbondesignsystem.com/components/tile/usage/

4. Atlassian recomenda tokens de espaçamento, agrupamento por proximidade e
   ritmo consistente; Fluent recomenda usar espaço para criar hierarquia antes
   de adicionar linhas ou outras superfícies.
   - https://atlassian.design/foundations/spacing
   - https://fluent2.microsoft.design/layout

5. Material define Card como contêiner de uma unidade coerente de conteúdo.
   Isso sustenta questionar o contêiner externo mais o contêiner interno, mas
   não exige remover toda delimitação de uma tabela ou fila operacional.
   - https://developer.android.com/develop/ui/compose/components/card

## Decisão por grupo

### Resumo do dia — manter

`AdminMetricCard` representa métricas independentes e comparáveis. Os tiles são
adequados para essa função. Não adicionar mais métricas nem colorir cada tile.

### Pendências — polir, não remover

Manter `Ação necessária` e `Acompanhar`, os badges e os links de recuperação.
Investigar uma composição mais plana para o `IssueGroup`: título e descrição
fora de uma borda pesada, seguida de linhas acionáveis com separação discreta.
As linhas precisam continuar visualmente distinguíveis porque cada uma tem
contagem e ação própria.

### Conteúdo e certificados — polir o nesting

Manter prontidão do catálogo e certificados pendentes como duas decisões
distintas. Remover apenas a moldura interna do resumo de prontidão se o Card
externo já fornecer contraste suficiente; manter as linhas de Cursos pendentes
como lista acionável.

### Contexto operacional — maior candidato a simplificação

`ContextCard` agrupa contexto, mas cada `ContextMetric` vira outra caixa. O
refinamento mais coerente seria trocar essas caixas por um `<dl>` com linhas
planas/divisores sutis, mantendo label, valor, unidade e helper. Isso reduz
“card dentro de card” sem retirar evidência operacional.

### Atividade recente — manter as tabelas

As tabelas são a forma correta para compras, Certificados e comentários. O
contêiner com rolagem/borda protege a leitura em viewport estreito e não deve
ser convertido em cards. O refinamento deve ficar em espaçamento de header,
caption, largura de colunas e hierarquia, não em trocar o padrão.

### Solicitações de suporte — manter como fila

É uma fila condicional com decisão própria. Não deve ser incorporada a métricas
ou escondida em um card genérico; deve continuar aparecendo somente quando há
solicitações.

## Recomendação final

Não implementar a reorganização ampla sugerida pelo relatório do estagiário.
Marcar essa proposta ampla como não implementada.

Implementar apenas uma próxima rodada de polimento estrutural, em ordem:

1. reduzir as caixas internas do `ContextCard`;
2. testar uma versão mais plana de `IssueGroup`;
3. revisar a moldura interna de prontidão do catálogo;
4. preservar tabelas, métricas e filas sem adicionar novos KPIs.

Cada mudança deve ser isolada e validada antes da seguinte. Sem pesquisa de uso
real ou inspeção renderizada, não há base para remover compras recentes,
Certificados recentes ou pendências acionáveis novamente.

## Limitações

A revisão é baseada em código, contratos, pesquisas oficiais e documentação
existente. Não foi feita inspeção em navegador local, conforme a restrição do
projeto. A confirmação visual deve cobrir Admin, Support, dados vazios, quatro
pendências, texto longo, viewport estreito e tabelas com rolagem.
