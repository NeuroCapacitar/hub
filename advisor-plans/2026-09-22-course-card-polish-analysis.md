# Análise: refinamento dos Course Cards do Aluno

> Status: **não aprovada pelo produto**; nenhum código de produto foi alterado.
> Baseline: `6848a28b` (`feature/small-changes`).

## Escopo

Esta é a próxima sugestão válida do relatório depois das decisões de não
implementar o header da página de Curso, `surface-warm` e Auth. O foco é o
`CourseCard` da Home do Aluno, não a trilha nem os LessonCards.

## Estado atual

`src/app/(student)/app/(dashboard)/page.tsx` já tem uma composição madura:

- imagem full bleed, fallback, gradiente e status;
- `rounded-surface` e escala de imagem `1.02` no hover;
- progresso textual e barra;
- ações separadas por estado de acesso;
- link de card e controles acima dele com `z-index` próprio.

Isso significa que parte do relatório já foi implementada. Não faz sentido
reabrir radius global, trocar a arquitetura do card ou aumentar o hover.

## Pontos ainda avaliáveis

### CTA

Os controles de Curso ativo usam `Button size="sm"`, cuja altura no primitive é
32px. O CTA primário e `Trilha` têm a mesma altura, mas a ação de continuar é
mais importante e a experiência do Aluno foi definida como confortável.

W3C 2.5.8 estabelece 24×24px como mínimo AA, portanto 32px não é uma falha de
acessibilidade por si só. O próprio W3C, porém, observa que alvos maiores
ajudam pessoas com menor precisão; Fluent usa 44×44px como referência de área
touch-friendly em layouts responsivos. Fontes: [W3C Target Size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
e [Fluent Layout](https://fluent2.microsoft.design/layout).

### Progresso

A barra do Course Card usa `h-1` (4px). Como ela é a única evidência visual de
avanço no card, `h-1.5` (6px) pode melhorar a leitura sem criar um novo bloco.
Isso deve ser testado junto com títulos longos e descrições ausentes para não
comprimir a área de ação do card fixo `aspect-[24/25]`.

### Imagem e hover

O hover já está em `scale-[1.02]`, alinhado ao movimento mais contido adotado
no projeto. A opacidade de `0.70` e o gradiente protegem a leitura, mas mudar
para `0.78–0.82` é uma hipótese visual, não uma correção determinística. Sem
inspeção renderizada em temas, títulos longos e capas claras, não há base para
alterar isso agora.

## Decisão original da análise

A análise recomendou implementar em um incremento pequeno apenas:

1. elevar os CTAs do Curso ativo para o tamanho padrão confortável, mantendo
   ambos alinhados;
2. testar a barra de progresso em 6px, preservando o mesmo token e a mesma
   semântica.

Não recomendo alterar opacidade, gradiente, raio ou hover nesta etapa.

O produto não aprovou essa proposta. Nenhuma alteração de CTA ou progresso
deve ser feita com base nesta nota.

## Guardrails

- manter o card inteiro e seus destinos atuais;
- não aumentar CTAs de compra/inscrição automaticamente sem revisar o modal e
  os estados de carregamento;
- manter o bloqueio visual e a não-interatividade de Cursos sem acesso;
- validar mobile, título longo, descrição ausente, Curso concluído e Curso sem
  capa;
- verificar que o card não cria overflow vertical por causa do aspect ratio.

## Resultado

**Não implementar nesta rodada.** O card permanece como está; a sugestão de
CTA/progresso foi rejeitada.
