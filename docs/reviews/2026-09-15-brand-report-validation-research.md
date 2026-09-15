---
status: research_only
owner: design-and-engineering
last_verified_commit: cb3cbb9b73918d7a720a8cb2d7931ecb53afda15
last_verified_at: 2026-09-15
---

# Validação externa do relatório de marca — 2026-09-15

## Escopo e método

Esta pesquisa valida as recomendações do relatório `C:\Users\Junior\Desktop\Relatorio Brand.md` sobre foco, contraste, seleção, tokens, variantes de `Button`, cor em `Badge` e `Progress` e documentação. Foram consultadas em 2026-09-15 fontes primárias atuais: especificações W3C, a especificação estável 2025.10 do Design Tokens Community Group (DTCG) e documentação oficial de GOV.UK, USWDS, Carbon, Atlassian, Storybook e Backstage. As conclusões distinguem requisito normativo, orientação de design system e inferência aplicável ao Hub. Esta pesquisa não redefine o contrato visual nem substitui `DESIGN.md`, código, testes ou decisão de produto.

## Resultado executivo

- A recomendação de tornar foco visível, não coberto por overlays e suficientemente contrastado é válida. O piso normativo aplicável combina WCAG 2.4.7 (foco visível), 2.4.11 (foco não totalmente oculto, AA), 1.4.11 (componentes e estados não textuais a 3:1, AA) e 1.4.3 para texto. O critério específico de área/contraste de `Focus Appearance` (2.4.13) é AAA, não um requisito AA. [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum), [Focus Appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html)
- A separação entre seleção de texto e seleção de controles é uma boa decisão semântica de design system, mas não existe um número WCAG genérico que valide qualquer cor de `::selection`. Cada apresentação precisa ser testada nos pares realmente adjacentes; seleção que comunica estado também não pode depender somente de cor. [Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html), [Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color)
- Tokens por papel semântico, em vez de nomes baseados em aparência, são coerentes com o DTCG e com sistemas maduros que separam papel de valor. O DTCG define formato de troca, aliases e metadados; não impõe a taxonomia da aplicação nem é padrão W3C. Carbon, como evidência de prática oficial, nomeia tokens por elemento, papel e estado. [DTCG Format 2025.10](https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/), [DTCG FAQ](https://www.designtokens.org/faq/), [Carbon: color tokens](https://carbondesignsystem.com/elements/color/overview/)
- Uma variante de `Button` para o acento laranja é uma estratégia de evolução de API, não exigência de acessibilidade. USWDS oferece variantes explícitas `accent-cool` e `accent-warm` e orienta destacar a ação mais importante. Logo, adicionar `accent` como opt-in, sem remapear `default`, é uma inferência de rollout compatível com práticas oficiais e reduz o raio de mudança. [USWDS: Button](https://designsystem.digital.gov/components/button/)
- `Badge` deve comunicar um estado rotulado; `Progress` deve comunicar andamento mensurável com valor/estado textual ou programático. Cor pode reforçar a semântica, mas não pode ser o único canal. Laranja para andamento e oliva para conclusão é aceitável se rótulo, valor e estado acessíveis forem preservados. [WCAG 1.4.1](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color), [GOV.UK: Tag](https://design-system.service.gov.uk/components/tag/), [Carbon: Progress bar](https://carbondesignsystem.com/components/progress-bar/usage/), [WAI-ARIA 1.2: progressbar](https://www.w3.org/TR/wai-aria-1.2/#progressbar)
- Manter documentação canônica sincronizada com CSS e componentes é governança, não regra WCAG. DTCG descreve uma fonte única de tokens sincronizando design e desenvolvimento; Storybook trata histórias executáveis como documentação viva; Backstage recomenda docs-as-code junto da implementação. Para o Hub, a consequência é derivar ou validar fatos documentados contra o código, sem transformar o relatório externo em autoridade. [DTCG Format 2025.10](https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/), [Storybook: Why Storybook](https://storybook.js.org/docs/get-started/why-storybook), [Backstage TechDocs](https://backstage.io/docs/features/techdocs/how-to-guides/)

## 1. Foco, contraste e seleção

### Requisito normativo

WCAG 2.2 exige que o foco de teclado seja visível (2.4.7), que o componente focado não fique totalmente oculto por conteúdo criado pelo autor (2.4.11, AA), e que a informação visual necessária para identificar componentes e estados tenha pelo menos 3:1 contra as cores adjacentes (1.4.11, AA). Texto normal continua sujeito a 4,5:1 e texto grande a 3:1 em 1.4.3. [WCAG 2.2](https://www.w3.org/TR/WCAG22/), [Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum), [Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)

O relatório acerta ao pedir consistência de `focus-visible`, `outline`/`ring` e proteção contra header sticky ou overlay. Deve-se, porém, rotular corretamente a severidade: o critério 2.4.13 exige área equivalente a um perímetro de 2 CSS px e contraste de 3:1 entre estados, mas é AAA. Pode ser o alvo do sistema, não deve ser apresentado como mínimo AA. [Focus Appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html), [What's New in WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/)

### Orientação de design system

Um token `focus` separado de `primary`, `selection` e `button-primary` reduz o risco de trocar acidentalmente o foco ao mudar a cor de uma ação. Uma borda ou anel de duas camadas é uma técnica de robustez visual, não uma obrigação universal; o W3C lista a técnica de indicador bicolor para funcionar sobre fundos variados. GOV.UK aplica esse princípio com amarelo e preto e reutiliza largura e cores funcionais em componentes distintos. Isso sustenta padronizar cor e geometria nos primitives do Hub sem afirmar que todos precisam ter CSS idêntico. [W3C: Focus Appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html), [W3C: Techniques](https://www.w3.org/WAI/WCAG22/Understanding/understanding-techniques), [GOV.UK: Focus states](https://design-system.service.gov.uk/get-started/focus-states/)

Para seleção, separar `text-selection` de `control-selected` é semanticamente justificável: são estados e fundos adjacentes diferentes. A cor de seleção de texto deve ser avaliada com o texto selecionado e o fundo efetivo; a seleção de controle deve continuar distinguível por forma, texto, borda, marcador ou estado programático. Não há base oficial para aceitar a razão aproximada de um par isolado do relatório sem testar todas as superfícies consumidoras. [Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html), [Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color)

### Inferência aplicável ao Hub

Manter `focus` estável e verificar Button, Input, Tabs, Slider, Select e itens de navegação em `background`, `card` e superfícies portadas é a consequência mais segura. A matriz deve incluir foco parcialmente coberto por header, sidebar, dialog, popover e toast, além de zoom/reflow.

As razões do relatório foram recalculadas pela fórmula WCAG a partir dos valores sRGB aproximados informados nele. Os resultados reproduzem os números reportados:

| Par aproximado do relatório | Razão recalculada |
| --- | ---: |
| cream / background | 13,97:1 |
| cream / card | 12,56:1 |
| support / background | 7,81:1 |
| support / card | 7,02:1 |
| cream / petroleum | 5,06:1 |
| background / orange | 5,36:1 |
| background / olive | 6,84:1 |
| petroleum / background | 2,76:1 |
| petroleum / card | 2,48:1 |

Isso valida a aritmética aproximada, não a conformidade final. OKLCH, alpha, composição, antialiasing e o fundo efetivo podem alterar o resultado renderizado. Texto selecionado precisa ser testado como texto contra o highlight resultante; controles selecionados precisam ser testados como componentes/estados contra cores adjacentes. [WCAG 2.2: Contrast Minimum](https://www.w3.org/TR/WCAG22/#contrast-minimum), [WCAG 2.2: Non-text Contrast](https://www.w3.org/TR/WCAG22/#non-text-contrast), [CSS Pseudo-Elements Level 4: `::selection`](https://www.w3.org/TR/css-pseudo-4/#selectordef-selection)

## 2. Semântica de design tokens

### Requisito normativo da especificação de tokens

O DTCG 2025.10 define um formato de intercâmbio: tokens têm nome legível, valor e metadados como tipo e descrição; grupos organizam coleções, mas ferramentas não devem inferir tipo ou propósito apenas do agrupamento. Aliases permitem que nomes diferentes apontem para o mesmo valor e são descritos como úteis para expressar decisões, eliminar repetição e criar relações semânticas. A especificação é estável, mas declara expressamente que não é um padrão W3C nem está no W3C Standards Track. [DTCG Format 2025.10](https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/), [DTCG: aliases](https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/#aliases-references)

Logo, `brand-orange` e `button-primary` podem coexistir: o primeiro expressa uma âncora de identidade; o segundo expressa um papel de consumo. A especificação não obriga nomes como `semantic`, `component` ou `primitive`, nem prova que uma taxonomia específica é correta para este produto. [DTCG Format 2025.10 — terminology and groups](https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/#terminology), [DTCG FAQ](https://www.designtokens.org/faq/)

### Orientação e inferência aplicável ao Hub

O relatório está correto ao preferir `button-primary`, `focus`, `selection`, `progress-active` e `learning-complete` no consumidor, deixando anchors de marca como referências intermediárias. Isso preserva a possibilidade de trocar o valor sem renomear componentes. Carbon documenta a mesma separação entre papel e valor: os nomes carregam elemento, papel e, quando necessário, estado, enquanto temas mudam o valor. É orientação arquitetural, não requisito normativo. Ela coincide com `DESIGN.md`, que proíbe componentes consumirem diretamente anchors de marca e define tokens por papel. [Carbon: Color overview](https://carbondesignsystem.com/elements/color/overview/)

A separação proposta entre `text-selection` e `control-selected` é consistente com essa disciplina: ambos podem resolver hoje para cores próximas, mas possuem contratos, superfícies e critérios de verificação diferentes. O mesmo vale para `progress-complete` e `learning-complete`: aliasar valores hoje preserva a possibilidade de divergirem depois sem acoplar consumidores.

`--brand-cream` pode ser mantido se representa uma decisão de aplicação documentada; renomeá-lo para `warm-foreground` só é necessário se a equipe decidir que `brand-*` deve ficar reservado ao manual de identidade. O relatório identifica corretamente um problema de taxonomia possível, mas não demonstra uma falha funcional.

## 3. Variantes de Button e rollout gradual

### Requisito normativo

WCAG não exige uma variante chamada `accent`, nem determina qual cor deve ser o botão primário. O requisito é que o controle seja operável por teclado, tenha foco perceptível, nome/estado acessíveis e contraste aplicável ao texto e às partes visuais. [Keyboard](https://www.w3.org/WAI/WCAG22/Understanding/keyboard), [Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible), [Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum)

### Orientação de design system

Uma variante explícita torna a intenção do consumidor legível e evita que a cor de `primary` carregue simultaneamente ação, seleção e progresso. USWDS expõe variantes de botão secundária, `accent-cool`, `accent-warm`, base, outline e inverse; também orienta dar estilo distintivo à ação mais importante e testar a implementação no contexto do produto. A existência dessas variantes valida o mecanismo, mas não determina o nome `accent`, a cor laranja nem o local do primeiro uso no Hub. [USWDS: Button variants and guidance](https://designsystem.digital.gov/components/button/)

Adicionar `accent` sem remapear o default é uma estratégia de compatibilidade e rollout. Exige inventário dos consumidores, estados hover/active/disabled/focus e testes de contraste para cada combinação. O rollout gradual em si é uma decisão de API e produto do Hub, não uma exigência da fonte externa.

### Inferência aplicável ao Hub

A recomendação do relatório é validada como mudança de baixo risco: criar uma variante opt-in e experimentá-la primeiro em um CTA delimitado, mantendo `button-primary` para o default. Isso reduz o raio de mudança. Checkout é apenas um candidato do relatório; o primeiro uso precisa ser definido por intenção e evidência de produto. A variante deve permanecer ausente dos consumidores até haver essa decisão, em vez de ser usada apenas para justificar sua criação.

## 4. Badge, Progress e uso de cor

### Requisito normativo

Cor não pode ser o único meio visual de comunicar informação, ação, resposta ou distinção (WCAG 1.4.1, nível A). Para controles e estados, a informação visual necessária deve atingir 3:1 contra cores adjacentes (1.4.11, AA). [Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color), [Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)

Uma barra de progresso precisa expor seu valor/estado de forma programática quando aplicável. O papel ARIA `progressbar` define `aria-valuenow`, `aria-valuemin` e `aria-valuemax` quando o valor é determinável; `aria-valuenow` deve ser omitido no caso indeterminado, e o componente precisa de nome acessível. [WAI-ARIA 1.2: progressbar](https://www.w3.org/TR/wai-aria-1.2/#progressbar)

### Orientação de design system

GOV.UK orienta usar tags para estados, começar com o menor número de estados útil, manter a mesma cor consistente para o mesmo estado e usar cor para distinção ou atenção sem depender só dela. Atlassian documenta que maior contraste visual produz maior ênfase e atenção. Essas fontes sustentam reservar a cor mais chamativa para informação que merece destaque; não impõem que “Acesso ativo” seja neutro. Essa escolha continua sendo uma hipótese de hierarquia visual a validar no contexto do Hub. [GOV.UK: Tag](https://design-system.service.gov.uk/components/tag/), [Atlassian: Color emphasis](https://atlassian.design/foundations/color)

Carbon oferece estados active, success e error para progresso, mas combina a cor de success com checkmark e a de error com ícone e helper text. Também exige rótulo, ainda que visualmente oculto, e recomenda valor auxiliar para progresso determinável. Isso valida laranja para andamento e oliva para conclusão como gramática própria de aprendizagem, desde que rótulo, porcentagem, etapa, ícone ou mensagem carreguem o significado. A cor reforça a semântica; não a substitui. [Carbon: Progress bar](https://carbondesignsystem.com/components/progress-bar/usage/)

### Inferência aplicável ao Hub

A recomendação de revisar `Badge default` e diferenciar `progress`/`learning` é válida como governança semântica. Tornar o default neutro reduziria o uso acidental da cor mais forte, mas é quebra visual para todo consumidor implícito; inventariar badges sem variante é pré-condição. Uma mudança menor é tornar apenas “Acesso ativo” neutro e criar `progress` para usos novos.

Para `Progress`, manter `progress-active` e `progress-complete` separados de `success` técnico é semanticamente coerente. Cada uso deve confirmar se representa percentual, etapa, estado indeterminado ou mera decoração. O relatório não fornece evidência suficiente para afirmar que todos os contrastes atuais de Badge/Progress passam sem inspeção dos pares renderizados.

## 5. Documentação como fonte de verdade

### Requisito normativo

Não há requisito WCAG que determine qual arquivo é a fonte de verdade de um design system. WCAG regula resultado acessível, não governança documental.

### Orientação do repositório

Neste repositório, `docs/README.md` estabelece a ordem de leitura e declara `DESIGN.md` como sistema visual canônico. O próprio contrato de manutenção exige `status`, `owner` e commit verificado, e a hierarquia de conflitos coloca contrato externo oficial, código/schema/testes, ADR e guias canônicos em ordem explícita. Essa regra local prevalece sobre recomendações genéricas do relatório.

O DTCG descreve como objetivo manter uma única fonte de verdade para tokens e sincronizar ferramentas de design e desenvolvimento. Storybook propõe histórias executáveis como diretório das variações reais e documentação gerada; Backstage recomenda documentação em Markdown versionada junto do código. São modelos de redução de drift, não exigências de ferramenta. [DTCG Format 2025.10](https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/), [Storybook: Why Storybook](https://storybook.js.org/docs/get-started/why-storybook), [Storybook: Autodocs](https://storybook.js.org/docs/writing-docs/autodocs), [Backstage TechDocs](https://backstage.io/docs/features/techdocs/how-to-guides/)

### Inferência aplicável ao Hub

O relatório está correto em tratar drift entre `DESIGN.md` e `globals.css` como risco P0 de governança, mas a correção deve seguir a hierarquia do repositório: verificar o commit e o código atual, decidir qual comportamento foi aprovado e então sincronizar a documentação canônica.

Aplicação recomendada, sem impor nova dependência:

1. Tratar definições executáveis de token e variantes como fonte dos fatos mecânicos.
2. Manter `DESIGN.md` como contrato de papel, uso autorizado, racional e exceções.
3. Fazer a fixture interna cobrir Button, Badge, Progress, seleção e todos os primitives focáveis nas superfícies relevantes.
4. Estender testes/checagens para detectar nomes, aliases, variantes e referências documentais divergentes; `docs:check` estrutural sozinho não prova equivalência visual.
5. Atualizar contrato, preview e verificação na mesma mudança que alterar tokens ou variantes.

Uma página de preview é evidência útil e teste humano; não substitui CSS, componentes, testes ou decisão registrada. Storybook é evidência de abordagem, não recomendação automática de adoção para este repositório.

## Conclusão validada

As recomendações do relatório são aproveitáveis com quatro qualificações:

1. Classificar corretamente AA versus AAA em foco.
2. Não tratar razões aproximadas de contraste como prova sem testar pares renderizados e estados.
3. Tratar DTCG e taxonomias externas como orientação/interoperabilidade, não como norma que determine a arquitetura do Hub.
4. Tratar neutralidade de “Acesso ativo”, nome `accent` e primeiro CTA como decisões de produto/design, não conclusões impostas pelas fontes.

A direção aplicável permanece: tokens por papel; `focus`, `text-selection` e `control-selected` com contratos distintos; semântica textual/programática além da cor; `Button` opt-in para rollout; Badge default revisada somente após inventário; progresso ativo/concluído preservado; documentação canônica sincronizada com definições executáveis e coberta por verificação de drift.

## Fontes primárias consultadas

- [W3C — WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [W3C WAI — Focus Not Obscured (2.4.11)](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum)
- [W3C WAI — Focus Appearance (2.4.13)](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html)
- [W3C WAI — Contrast Minimum (1.4.3)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum)
- [W3C WAI — Non-text Contrast (1.4.11)](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
- [W3C WAI — Use of Color (1.4.1)](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color)
- [W3C — CSS Pseudo-Elements Level 4, `::selection`](https://www.w3.org/TR/css-pseudo-4/#selectordef-selection)
- [W3C — Design Tokens Format Module 2025.10](https://www.w3.org/community/reports/design-tokens/CG-FINAL-format-20251028/)
- [DTCG — FAQ e status da especificação](https://www.designtokens.org/faq/)
- [W3C WAI-ARIA 1.2 — progressbar](https://www.w3.org/TR/wai-aria-1.2/#progressbar)
- [GOV.UK Design System — Focus states](https://design-system.service.gov.uk/get-started/focus-states/)
- [GOV.UK Design System — Tag](https://design-system.service.gov.uk/components/tag/)
- [USWDS — Button](https://designsystem.digital.gov/components/button/)
- [Carbon Design System — Color overview](https://carbondesignsystem.com/elements/color/overview/)
- [Carbon Design System — Progress bar](https://carbondesignsystem.com/components/progress-bar/usage/)
- [Atlassian Design System — Color](https://atlassian.design/foundations/color)
- [Storybook — Why Storybook](https://storybook.js.org/docs/get-started/why-storybook)
- [Storybook — Autodocs](https://storybook.js.org/docs/writing-docs/autodocs)
- [Backstage TechDocs — docs-like-code](https://backstage.io/docs/features/techdocs/how-to-guides/)
