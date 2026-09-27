# Análise individual: refinamento de movimento

> Status: análise read-only; nenhum código foi alterado nesta etapa.
> Baseline: `e436ae80` (`feature/small-changes`).

## Localização no plano

Esta é a sugestão `# 40 — Movimento` do relatório anexado, após a análise de
imagens. O relatório recomenda reduzir movimentos de cards, manter a pressão de
botões e usar timings mais curtos e previsíveis.

## Estado atual confirmado

- `LessonCard` aplica `scale-105` na imagem e `scale-110` no botão de play,
  ambos com `duration-500`/`duration-300`
  (`src/components/ui/lesson-card.tsx:90-92`, `:131-132`).
- CourseCards do Aluno e do Admin também usam `scale-105` e `duration-500` nas
  imagens (`src/app/(student)/app/(dashboard)/page.tsx:362`,
  `src/app/(admin)/admin/cursos/page.tsx:100`).
- Botões usam `active:scale-[0.96]` e transições específicas no primitive
  compartilhado (`src/components/ui/button.tsx:12`).
- O projeto evita `transition-all`, bounce e movimento decorativo; o contrato
  visual autoriza autoplay somente para os carrosséis já existentes.

## Pesquisa externa

- A Apple recomenda movimento com propósito, breve, preciso e cancelável, e
  alerta contra animação frequente sem função de entendimento.
  [Apple — Motion](https://developer.apple.com/design/human-interface-guidelines/motion)
- O Fluent 2 recomenda escolher duração conforme o tamanho/distância do elemento
  e manter transições rápidas e naturais.
  [Fluent 2 — Motion](https://fluent2.microsoft.design/motion)
- As Web Interface Guidelines recomendam animar propriedades específicas, evitar
  `transition: all` e tratar movimento reduzido como requisito de acessibilidade.
  [Vercel — Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md)

## Avaliação

### Escala de imagem `1.05`

**Decisão: implementar redução para aproximadamente `1.02–1.03`.**

O zoom atual é perceptível em várias superfícies e aproxima a interface de um
template SaaS. A imagem pode responder ao hover sem o card parecer pular.

### Botão de play `1.10`

**Decisão: reduzir para aproximadamente `1.04–1.05` e encurtar o timing.**

O botão continua recebendo feedback, mas não deve dominar a thumbnail nem
competir com o status da Aula.

### Botão pressionado `0.96`

**Decisão: manter.**

É um feedback direto de ativação, curto e consistente no primitive global. Não há
razão para alterá-lo junto com o hover de imagens.

### Timing

**Decisão: reduzir imagens de `500ms` para cerca de `300–350ms`; controles para
`150–220ms`.**

O objetivo é feedback perceptível sem fazer o usuário esperar. A mudança deve
ficar limitada a `transform`, `color`, `background-color`, borda e sombra já
usadas pelos componentes.

### Reduced motion

As diretrizes externas recomendam responder à preferência de movimento reduzido,
mas o contrato atual do Hub registra explicitamente que não deve adicionar
`prefers-reduced-motion` nesta linha. Não vou introduzir uma exceção silenciosa;
isso precisa ser uma decisão transversal de acessibilidade antes de alterar o
contrato.

## Escopo recomendado

Implementar somente:

- `LessonCard` de Aprendizagem;
- CourseCard do Dashboard do Aluno;
- CourseCard do catálogo Admin;
- play button e imagem, sem alterar conteúdo ou comportamento de navegação.

Não alterar:

- autoplay dos banners ou da mídia de autenticação;
- drag-and-drop, accordion, Sheet ou Dialog;
- loading `animate-pulse`/`animate-spin`;
- movimento de Operação, Financeiro ou Auditoria;
- adicionar biblioteca de animação.

## Resultado final

**Sugestão válida para implementação.** É um refinamento de baixo risco, melhora
conforto e personalidade sem alterar contratos de produto. A próxima fatia de
código deve reduzir escala e duração apenas nos cards de Aprendizagem e Cursos,
preservando o press feedback dos botões.

