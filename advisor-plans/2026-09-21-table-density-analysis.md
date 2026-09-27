# Análise individual: densidade das tabelas

> Status: análise read-only; nenhum código foi alterado nesta etapa.
> Baseline: `c717f227` (`feature/small-changes`).

## Localização no plano

Esta é a sugestão `# 46 — Tabelas não devem ficar “confortáveis demais”` do
relatório anexado. Ela não pede uma nova tela; pede preservar uma linguagem
densa para comparação administrativa sem contaminar Aluno e superfícies
editoriais.

## Estado atual confirmado

O contrato atual já separa os contextos:

- `TableHead` usa altura de 40px e células usam `py-2`/`px-3`;
- tabelas mantêm alinhamento numérico, `tabular-nums`, captions e headers
  semânticos;
- Financeiro, Auditoria, Operação e Aprendizagem usam rolagem horizontal local e
  larguras mínimas quando necessário;
- cards globais estão confortáveis, mas as tabelas não receberam padding de
  Card nem radius/sombra de entidade;
- `DESIGN.md` já determina exceções locais para comparação rápida, sem criar uma
  densidade global separada.

Isso significa que a sugestão já foi absorvida pela fundação visual. A tabela de
Aprendizagem, inclusive, recebeu a visualização inline sem criar um painel alto
ou cards por Aula.

## Pesquisa externa

- Material recomenda tabelas para dados crus e comparação, com alinhamento,
  headers e controles diretamente associados ao conjunto de dados.
  [Material — Data tables](https://m2.material.io/components/data-tables/web)
- Shopify descreve resource lists como compactas e escaneáveis para coleções
  menores, levando ao detalhe completo quando necessário.
  [Shopify — Resource list](https://shopify.dev/docs/api/app-home/latest/patterns/compositions/resource-list)
- Atlassian separa valores pequenos para células e listas compactas de espaços
  maiores usados entre regiões da página, em vez de aplicar o mesmo respiro a
  todos os elementos.
  [Atlassian — Spacing](https://atlassian.design/foundations/spacing)

## Avaliação

### O que já está correto

- A tabela permanece densa onde comparação é a tarefa principal.
- Aumentar o respiro acontece entre seções, não dentro de cada célula.
- Números e status têm alinhamento e hierarquia próprios.
- Conteúdo longo recebe rolagem local ou truncamento controlado.
- O padrão confortável global não transformou ledgers em cards grandes.

### O que não implementar agora

- nova API global `compact`/`operational` para tabelas;
- reduzir padding em todos os usos do primitive;
- transformar tabelas Finance/Admin em grids de cards;
- remover rolagem horizontal para forçar quebra de colunas;
- adicionar bordas e sombras apenas para criar peso visual.

Uma variante de tamanho no primitive poderia parecer elegante, mas hoje seria
abstração sem uma necessidade repetida suficientemente estável: os consumidores
já usam classes locais quando a comparação exige densidade.

## Decisão

**Sugestão atendida e encerrada sem nova implementação.** O projeto está
alinhado à recomendação: confortável entre regiões, denso dentro de tabelas e
com exceções locais documentadas.

Se uma tabela concreta provar excesso de altura, o ajuste deve ser localizado,
com teste de viewport estreito, caption, foco e estado vazio preservados.

