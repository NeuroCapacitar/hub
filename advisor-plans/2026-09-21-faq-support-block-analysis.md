# Análise individual: FAQ e entrada para suporte

> Status: análise read-only; nenhum código foi alterado nesta etapa.
> Baseline: `96c5924d` (`feature/small-changes`).

## Localização no plano

Esta é a sugestão `# 48 — FAQ` do relatório anexado. O relatório considera a
ideia correta e propõe apenas refinamentos de espaçamento, área clicável, radius
e um bloco final acolhedor para suporte.

## Estado atual confirmado

A FAQ já atende quase todo o diagnóstico:

- conteúdo limitado a `max-w-3xl`;
- Accordion único, com radius `2xl` e borda;
- trigger ocupa a largura inteira, tem área clicável e foco visível;
- conteúdo aberto usa superfície tonal diferente;
- primeiro item abre por padrão;
- suporte aparece depois da lista e usa `SupportRequestDialog`.

O ponto que permanece inferior à proposta é o suporte: hoje existe somente um
botão alinhado à direita, sem contexto textual. Ele é funcional, mas não traduz
acolhimento nem deixa claro quando recorrer à equipe.

## Pesquisa externa

- Material define expansion panels como containers leves para revelar conteúdo e
  preservar foco em tarefas relacionadas; o Accordion atual está alinhado a
  esse uso.
  [Material — Expansion panels](https://m1.material.io/components/expansion-panels.html)
- Material também recomenda navegação e estrutura simples quando a tarefa é
  simples, evitando regiões desnecessárias.
  [Material — Navigation](https://m1.material.io/patterns/navigation.html)
- Atlassian diferencia mensagens de seção, banners e estados vazios para
  comunicação contextual e ação relacionada, em vez de deixar uma ação isolada.
  [Atlassian — Components](https://atlassian.design/components)

## Avaliação

### Accordion

**Decisão: manter.** Não aumentar animação, não criar cards por pergunta e não
alterar o padrão global novamente. O primitive já possui trigger acessível,
estado aberto/fechado e superfície interna distinta.

### Suporte isolado

**Decisão: implementar um callout compacto.** A proposta do relatório é válida e
de baixo risco:

```text
Não encontrou sua resposta?
Nossa equipe pode ajudar.
[Falar com suporte]
```

O bloco deve ser uma única superfície leve, com título, descrição curta e o
trigger existente. Não deve virar um banner de erro nem uma nova seção pesada.

## Resultado final

**Sugestão parcialmente atendida.** A FAQ e o Accordion devem permanecer como
estão; a única melhoria válida é transformar o botão isolado de suporte em um
callout contextual, mantendo o mesmo diálogo e a mesma ação.

