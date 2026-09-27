# Análise: FAQ do Aluno como conteúdo visível

> Status: análise read-only; nenhum código foi alterado nesta etapa.
> Baseline: `96c5924d` (`feature/small-changes`).

## Decisão executiva

A proposta de remover o Accordion para a experiência do Aluno é melhor para o
estado atual do Hub. A página tem largura limitada, não possui busca, categorias
ou paginação e o volume de FAQ é administrável. Esconder cada resposta atrás de
um clique adiciona uma decisão antes da leitura e dificulta escanear várias
perguntas.

Recomendo uma lista de perguntas e respostas sempre visíveis, em uma coluna
confortável, com separadores discretos e bastante espaço vertical. O Accordion
continua adequado como primitive do projeto e pode permanecer em outras
superfícies; a mudança é específica da FAQ do Aluno.

## Comparação das alternativas

### Accordion atual

Vantagens: economiza altura, mantém a lista organizada e possui foco/estado
acessíveis. Desvantagem neste contexto: a resposta não é reconhecível sem uma
interação adicional; para comparar duas respostas, o Aluno precisa abrir e
fechar itens.

### Lista aberta recomendada

Cada item será um `<article>` com:

- pergunta como `h2`/`h3`;
- resposta logo abaixo, sempre disponível;
- espaçamento amplo entre itens;
- divisor sutil apenas entre grupos;
- sem card individual por pergunta.

Isso reduz a carga cognitiva, melhora busca visual/browser e não depende de
estado client-side ou animação para acessar o conteúdo.

### Busca futura

Não adicionar agora. Se a quantidade de perguntas crescer, busca por texto e
categorias serão mais úteis que voltar a esconder todas as respostas. O modelo
atual não possui categoria e a lista ainda não demonstra necessidade de um
novo filtro.

## Callout de suporte

Manter o `SupportRequestDialog`, mas substituir o botão isolado por uma única
superfície contextual no final:

```text
Não encontrou sua resposta?
Nossa equipe pode ajudar.
[Falar com suporte]
```

O callout não deve ser um alerta nem competir com as respostas. Ele só oferece
uma próxima ação quando a leitura não resolveu a dúvida.

## Pesquisa e referências

- Material descreve expansion panels como containers leves para revelar conteúdo
  ou editar algo; não exige que todo conteúdo de ajuda seja escondido. A escolha
  deve seguir o volume e a tarefa de leitura.
  [Material — Expansion panels](https://m1.material.io/components/expansion-panels.html)
- Material recomenda navegação simples e previsível, com estrutura proporcional
  à complexidade da tarefa.
  [Material — Navigation](https://m1.material.io/patterns/navigation.html)
- O design system do projeto já diferencia superfície de conteúdo e controle,
  usa `text-pretty`, headings e spacing para leitura, e evita cards decorativos
  como separadores genéricos.

## Resultado

**Implementar a lista aberta somente na página do Aluno**, preservando o
gerenciamento Admin, e transformar o suporte em callout contextual. Essa é a
solução mais confortável e de menor carga cognitiva para o estado atual. Se o
volume de FAQ crescer, a próxima evolução deve ser busca/categorias, não uma
camada adicional de acordeons aninhados.

