# Pesquisa independente: arquitetura de cores e design systems do relatório Neuro.Capacitar

Consulta: 14 de setembro de 2026, `America/Sao_Paulo`.

Relatório analisado: `C:\Users\Junior\Desktop\rebrand.md`, especialmente as seções 3.1–3.3, 4–9, 41 e 45–47 e as referências [1]–[5] do próprio relatório.

Escopo: validar somente as afirmações sobre Fluent 2, Primer, Atlassian Color, Vercel Geist Colors, MDN/OKLCH e WCAG/W3C. As fontes abaixo são páginas oficiais dos próprios projetos ou a especificação/guidance oficial do W3C. Não validei o manual de marca, as afirmações sobre Teachable/Kajabi nem a inspeção visual do produto; elas estão fora deste recorte. Não houve implementação.

## Conclusão

A direção arquitetural do relatório é defensável: separar valores de marca de papéis semânticos, evitar que uma única cor assuma superfície, interação e estado, nomear tokens por função e verificar contraste por contexto. Isso é sustentado, com nuances, por Fluent 2, Primer, Atlassian e Geist.

As principais correções são:

1. Fluent 2 usa oficialmente três paletas: `neutral`, `shared` e `brand`. Cores semânticas são uma seleção da paleta `shared`; `shared-semantic` não é o nome de uma quarta camada oficial.
2. Primer chama as camadas de tokens de `base`, `functional` e `component/pattern`. “Primitive” é o nome da família/produto Primer Primitives, não o nome da primeira categoria no guia de nomenclatura.
3. MDN sustenta que OKLCH expõe luminosidade percebida, chroma e hue e oferece ajustes relativos; não sustenta que alterar `L` e `C` em torno de anchors garante contraste, gamut ou uma família visual adequada.
4. WCAG 2.2 classifica `Contrast (Minimum)`, `Non-text Contrast` e `Focus Visible` como AA. `Focus Appearance` (2.4.13), com perímetro de 2 CSS px e mudança de contraste de 3:1, é AAA, não AA.
5. Os cálculos do relatório para texto branco sobre `#D97B34` (`3,07:1`) e fundo escuro atual sobre o laranja (`5,36:1`) estão corretos quando o segundo valor é o `--background` atual. Eles não valem para o petróleo de marca `#326C71`, que tem somente `1,94:1` contra o laranja. A afirmação de que o oliva tem “excelente contraste contra o petróleo” também não é geral: `#9EAD7C` contra `#326C71` resulta em aproximadamente `2,48:1`.

## Matriz de validação

| Afirmação do relatório | Veredito | O que a fonte permite afirmar |
|---|---|---|
| Separar `neutral`, `shared/semantic` e `brand` no Fluent 2 | Parcial, com correção terminológica | O Fluent documenta `neutral`, `shared` e `brand`. Semantic colors são uma seleção dentro de `shared`. |
| Usar brand/accent com parcimônia | Sustentada no princípio | Fluent recomenda usar shared colors para acentuar áreas importantes e evitar brand colors em excesso ou em grandes superfícies. Isso não define um token universal chamado `accent`. |
| Primer: primitive → functional → component | Sustentada no desenho, incorreta no nome | A taxonomia atual do guia é `base` → `functional` → `component/pattern`; base mapeia para valores brutos e não deve ser usado diretamente. |
| Componentes não devem conhecer valores brutos | Inferência bem apoiada | Primer diz que base values servem para construir tokens funcionais e component/pattern e nunca devem ser usados diretamente. A frase sobre “não conhecer” é uma regra arquitetural derivada, não uma citação literal. |
| Atlassian trata tokens como source of truth e nomeia por papel | Sustentada | Atlassian descreve tokens como fonte única, com propriedade, papel, ênfase e estado de interação no nome. |
| Accent pode representar progresso, sucesso ou cuidado | Não sustentada e potencialmente conflituosa | Atlassian define `accent` como cor sem significado específico, intercambiável, e manda não usá-la quando a cor tiver significado semântico. Sucesso, warning e danger devem permanecer papéis distintos. |
| Geist organiza background, component background, borders, high-contrast e text/icon por função | Sustentada, com ajuste de termos | A página oficial descreve Backgrounds, Colors 1–3 para componentes, Colors 4–6 para borders, Colors 7–8 para high-contrast backgrounds e Colors 9–10 para text/icons. |
| Geist é um sistema monocromático intencional | Extrapolação | A página atual também publica escalas Gray, Blue, Red, Amber, Green, Teal, Purple e Pink. A lição segura é a atribuição por papel, não uma caracterização de monocromia. |
| OKLCH torna a criação de famílias e estados previsível | Parcial/extrapolação | MDN sustenta uniformidade perceptiva e `L` como luminosidade percebida; não garante contraste, legibilidade, gamut ou adequação sem testes por uso. |
| Contraste AA é o piso e foco precisa ser visível | Sustentada, mas incompleta | WCAG 2.2 exige 4,5:1 para texto normal, 3:1 para texto grande, 3:1 para informação visual essencial de componentes/estados e foco visível para controles operáveis por teclado. A regra detalhada de Focus Appearance é AAA. |
| Laranja deve ser o focus ring | Recomendação local, não conclusão das fontes | As fontes exigem indicador visível e contrastado; nenhuma delas escolhe laranja. A cor precisa ser verificada em cada superfície adjacente e no estado anterior. |
| A distribuição 70–80% petróleo, 15–20% areia, 5–10% atenção é uma boa arquitetura | Heurística de composição | É explicitamente uma proporção proposta no relatório, não uma regra derivada das fontes. Deve ser tratada como hipótese de design, não como evidência externa. |

## 1. Fluent 2

Fonte oficial: [Fluent 2 — Color](https://fluent2.microsoft.design/color), consultada em 2026-09-14.

O que a página sustenta:

- Fluent define três paletas: `neutral`, `shared` e `brand`.
- `neutral` ancora superfícies, texto e elementos de layout; neutros também podem comunicar mudança de estado em componentes.
- `shared` é usada em componentes reutilizáveis de alto valor, como avatars, calendars e badges. A recomendação é usar shared colors com parcimônia para acentuar e destacar áreas importantes.
- Algumas cores de `shared` são semantic colors para feedback, status e urgência. A própria página diz para não usar cores semânticas como decoração.
- `brand` ancora a experiência do produto, mas a página recomenda evitar o uso excessivo e o uso em grandes superfícies porque isso pode diluir a hierarquia e dificultar a navegação.
- Para estados de interação, Fluent descreve uma progressão rest → hover → selected; para foco, o controle não muda de cor e o contêiner recebe um traço mais espesso.
- A página também exige contraste e que cor não seja o único meio de comunicar informação.

Portanto, a ideia do relatório de impedir que o petróleo seja simultaneamente superfície, marca e toda a paleta de interação está alinhada com o princípio do Fluent. A formulação precisa ser corrigida: `shared-semantic` não é uma das três paletas apresentadas pela fonte. A forma fiel é `neutral` + `shared` (com um subconjunto semântico) + `brand`.

O Fluent não sustenta que a cor de ação ou de foco deva ser laranja. A recomendação de laranja para CTA, link de alta intenção ou foco é uma decisão de produto do relatório. Para foco, a própria fonte enfatiza a distinção visual do contêiner, não uma tonalidade específica.

## 2. Primer

Fontes oficiais: [Primer — Color usage](https://www.primer.style/product/getting-started/foundations/color-usage/) e [Primer — Token names](https://primer.style/product/primitives/token-names/), consultadas em 2026-09-14.

O que a documentação sustenta:

- Os tokens de cor são abstrações para manutenção, consistência e theming.
- As três categorias são `Base`, `Functional` e `Component/pattern`.
- Base tokens são o nível mais baixo e mapeiam diretamente para valores brutos; a documentação diz que devem servir de referência para outros tokens e nunca ser usados diretamente em código ou design.
- Functional tokens representam padrões globais, como texto, borders, shadows e backgrounds, e são os mais usados no sistema.
- Component/pattern tokens são para valores mais específicos; são limitados e a documentação prefere functional tokens quando eles resolvem o caso.
- O guia de nomenclatura diz que component/pattern tokens devem ser usados somente no CSS do componente.
- Nos color roles de Primer, `accent` cobre links, selected, active, focus e informação neutra; `success` cobre primary buttons, mensagens positivas e estados bem-sucedidos.

O relatório acerta o sentido da dependência: anchors/base não deveriam ser consumidos arbitrariamente por componentes; componentes deveriam receber papéis funcionais ou tokens de componente. A correção importante é usar a nomenclatura atual `base` → `functional` → `component/pattern`, não `primitive` → `functional` → `component`. “Primer Primitives” identifica a família de fundamentos/pacote, mas não substitui o nome da categoria `Base` no guia citado.

Também não é possível importar diretamente a conclusão “laranja = primary action” de Primer. No modelo documentado por Primer, primary buttons aparecem no papel `success`, enquanto `accent` cobre links, seleção, ativo e foco. O Hub pode deliberadamente divergir, mas deve registrar isso como decisão local, separar ação de sucesso quando necessário e não apresentar a escolha como consequência da fonte.

## 3. Atlassian Color

Fontes oficiais: [Atlassian — Color](https://atlassian.design/foundations/color-new/), [Atlassian — Accents](https://atlassian.design/foundations/color/accents/) e [Atlassian — Design tokens](https://atlassian.design/tokens/design-tokens), consultadas em 2026-09-14.

O que é sustentado:

- Atlassian recomenda aplicar cores por design tokens, em vez de escolher valores isolados.
- Tokens são descritos como uma fonte única de verdade para decisões visuais repetíveis e temas.
- O nome começa por `color`, seguido pela propriedade aplicada (`background`, `border`, `icon` etc.) e pode receber modificadores de papel, ênfase e estado de interação.
- A regra é escolher por significado, não porque uma cor “parece combinar”; usar um token apenas por aparência pode quebrar a experiência em outros temas.
- `accent` é reservado para cores sem significado específico. A página de accents diz que deve ser possível trocar uma accent por outra sem mudar a experiência ou seu significado. Accent não deve substituir `information`, `warning` ou `success`.
- Há níveis de ênfase e estados como hovered, pressed, selected, focused e disabled.

Isso confirma boa parte do resumo do relatório (“source of truth”, papel semântico e estados). A frase “modifier de state/emphasis só quando necessário” é uma política de projeto proposta pelo relatório, não uma regra textual que a fonte apresente nesses termos. A política mais fiel é escolher o papel e o estado corretos e não usar um token só por semelhança visual.

Para o Hub, o ponto mais importante é manter `accent` diferente de `success`, `warning`, `danger` e `info`. Oliva pode ser uma cor de marca para um destaque de aprendizagem, ou pode participar de um papel positivo; não deve fazer as duas coisas com o mesmo token sem uma decisão explícita de semântica e sem testes de contraste.

## 4. Vercel Geist Colors

Fonte oficial: [Geist — Colors](https://vercel.com/geist/colors), consultada em 2026-09-14.

A página atual descreve uma escala funcional de dez degraus:

- `Background 1` para o fundo padrão e `Background 2` para diferenciação sutil, com recomendação de usar o segundo com parcimônia;
- `Colors 1–3` para background padrão, hover e active de componentes;
- `Colors 4–6` para border padrão, hover e active;
- `Colors 7–8` para high-contrast backgrounds;
- `Colors 9–10` para text e icons secundários e primários, descritos como apropriados para texto e ícones acessíveis.

Isso sustenta a leitura do relatório de que uma escala por papel é mais útil do que alterar apenas a luminosidade de uma cor sem decidir sua função. Sustenta também a ideia de reduzir superfícies secundárias e reservar diferenciações cromáticas para papéis previsíveis.

Duas extrapolações devem ser removidas ou suavizadas:

- A página não define o Geist como monocromático; ela publica escalas Gray, Gray alpha e várias escalas cromáticas, incluindo Blue, Red, Amber, Green, Teal, Purple e Pink.
- “High-contrast fills” é uma paráfrase aceitável, mas o termo da fonte é `High Contrast Backgrounds`; “accessible text and icons” não significa que toda combinação local do Hub estará em conformidade sem medição.

É seguro importar a organização funcional como referência. Não é seguro importar valores, preto/branco, P3 ou qualquer combinação do Geist como contrato do Hub. O próprio material consultado informa que usa P3 em browsers e displays compatíveis, outro detalhe que reforça a necessidade de testar o espaço e o fallback usados pelo produto.

## 5. MDN e OKLCH

Fontes oficiais: [MDN — `oklch()`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/oklch) e [MDN — CSS color values](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Colors/Color_values), consultadas em 2026-09-14.

MDN sustenta que:

- `oklch()` expressa cor no espaço Oklab em forma cilíndrica, usando `L` (lightness), `C` (chroma) e `H` (hue), além de alpha opcional;
- `L` representa luminosidade percebida, diferente da interpretação de lightness em HSL;
- `C` representa aproximadamente a quantidade de cor e `H` representa o ângulo de hue;
- Oklab foi construído para ser mais uniforme perceptualmente, e MDN descreve a vantagem de uma luminosidade percebida em relação às funções HSL/HWB;
- a sintaxe relativa permite derivar uma cor e alterar, por exemplo, apenas `L` com `calc()`.

Isso torna OKLCH uma escolha plausível para organizar escalas e estados. Mas a fonte não autoriza três conclusões fortes presentes ou implícitas no relatório:

1. Alterar `L` e `C` preservando `H` não garante uma escala que passe WCAG. Luminosidade percebida em OKLCH não é a luminância relativa usada no cálculo de contraste do WCAG.
2. A operação pode produzir cores fora do gamut do destino ou combinações inadequadas para texto, borda, ícone ou foco; é necessário testar no espaço/renderização efetivos.
3. “Mais previsível que HSL” é uma síntese de design, não uma promessa normativa de que qualquer ajuste terá o resultado desejado. A formulação mais precisa é: OKLCH foi desenhado para ajustes mais perceptualmente uniformes, mas cada papel ainda precisa de validação de contraste, estado, gamut e percepção.

## 6. WCAG 2.2 e foco

Fontes oficiais: [WCAG 2.2 — especificação](https://www.w3.org/TR/WCAG22/), com as seções [1.4.1 Use of Color](https://www.w3.org/TR/WCAG22/#use-of-color), [1.4.3 Contrast (Minimum)](https://www.w3.org/TR/WCAG22/#contrast-minimum), [1.4.11 Non-text Contrast](https://www.w3.org/TR/WCAG22/#non-text-contrast), [2.4.7 Focus Visible](https://www.w3.org/TR/WCAG22/#focus-visible), [2.4.11 Focus Not Obscured (Minimum)](https://www.w3.org/TR/WCAG22/#focus-not-obscured-minimum) e [2.4.13 Focus Appearance](https://www.w3.org/TR/WCAG22/#focus-appearance); e [WAI Understanding 2.4.13](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html). Consulta: 2026-09-14.

O contrato relevante é:

- 1.4.1, nível A: cor não pode ser o único meio visual de transmitir informação, indicar ação ou distinguir elemento.
- 1.4.3, nível AA: texto normal precisa de pelo menos `4,5:1`; texto grande, `3:1`, com as exceções da própria norma.
- 1.4.11, nível AA: a informação visual necessária para identificar componentes de interface e estados precisa de pelo menos `3:1` contra cores adjacentes; o mesmo vale para partes relevantes de gráficos.
- 2.4.7, nível AA: toda interface operável por teclado precisa ter um modo em que o indicador de foco seja visível.
- 2.4.11, nível AA: o componente focado não pode ficar inteiramente oculto por conteúdo criado pelo autor.
- 2.4.13, nível AAA: quando o indicador está visível, a área deve ser pelo menos a de um perímetro de 2 CSS px e a mudança entre os mesmos pixels nos estados focado e não focado deve ter contraste de pelo menos `3:1`, salvo as exceções normativas.

Correção importante: “AA permanece como piso” é uma boa política local, mas não se deve chamar o requisito completo de Focus Appearance de AA. Para uma implementação que mira somente WCAG AA, ainda são obrigatórios foco visível e contraste não textual de componentes/estados; adotar também 2.4.13 pode ser um objetivo AAA deliberado.

O relatório também transforma “focus ring laranja” em uma decisão de cor. Isso é válido como hipótese de branding, não como conclusão de acessibilidade. Um anel laranja precisa ser testado contra cada fundo e contra o estado não focado; a razão entre texto laranja e fundo não responde sozinha ao teste de foco.

## 7. Verificação independente dos números de contraste

Usei os HEX e o `--background` OKLCH apresentados no relatório, convertendo o OKLCH escuro atual para aproximadamente `#0F2224` e aplicando a definição de contraste relativo do WCAG. Os valores abaixo são arredondados:

| Par | Razão aproximada | Leitura |
|---|---:|---|
| branco `#FFFFFF` sobre laranja `#D97B34` | `3,07:1` | Não passa texto normal AA (`4,5:1`); pode atingir o limite de texto grande, se o caso realmente se enquadrar nessa definição. |
| fundo atual `#0F2224` sobre laranja `#D97B34` | `5,36:1` | Passa o limite de texto normal AA. Isso confirma a direção “texto escuro no CTA laranja” para esse fundo específico. |
| petróleo de marca `#326C71` contra laranja `#D97B34` | `1,94:1` | Não passa `3:1` para informação não textual nem `4,5:1` para texto normal. Não tratar “petróleo” como um único fundo. |
| oliva `#9EAD7C` contra petróleo de marca `#326C71` | `2,48:1` | Não sustenta a frase “excelente contraste contra o petróleo” para texto/ícone/componente. |
| oliva `#9EAD7C` contra o fundo atual `#0F2224` | `6,84:1` | O oliva funciona bem nesse fundo escuro específico, mas isso não prova segurança sobre cards, borders ou o petróleo de marca. |
| terracota `#C56A4C` contra o fundo atual `#0F2224` | `4,35:1` | Fica abaixo de `4,5:1` para texto normal, embora acima de `3:1` para texto grande e informação não textual. |
| areia `#F1E8DA` contra petróleo de marca `#326C71` | `4,91:1` | Passa texto normal AA, mas com margem menor do que a frase “muito acima” sugere. |

Assim, o relatório está correto ao rejeitar branco como foreground padrão do botão laranja e ao preferir um foreground escuro para o CTA. A correção é explicitar que `5,36:1` foi calculado contra o fundo escuro atual, não contra todo valor chamado petróleo, e que cada token de superfície precisa de sua própria matriz de pares.

## 8. Disposição recomendada para o relatório

Pode permanecer como conclusão de design, desde que seja rotulada como decisão do Hub:

- separar anchors de marca dos tokens semânticos/funcionais;
- usar neutros para estrutura e reservar cores cromáticas para papéis definidos;
- manter `success`, `warning`, `danger` e `info` independentes de cores decorativas;
- tratar orange/olive/terracotta como candidatos de marca, não como significados universais;
- testar cada combinação de texto, ícone, border, estado selected e foco por superfície;
- manter a regra de que informação não pode depender somente da cor.

Deve ser corrigido no relatório:

- trocar “neutral / shared-semantic / brand” por “neutral / shared (incluindo semantic colors) / brand” ao descrever Fluent;
- trocar “primitive / functional / component tokens” por “base / functional / component/pattern tokens” ao descrever Primer;
- retirar a caracterização de Geist como monocromático ou apresentá-la como interpretação visual, não como fato da página de cores;
- suavizar “OKLCH torna previsível” para “OKLCH favorece ajustes perceptualmente uniformes, ainda sujeitos a testes”;
- não classificar Focus Appearance 2.4.13 como requisito AA;
- qualificar todos os números de contraste com os dois tokens exatos usados no cálculo;
- substituir “oliva tem excelente contraste contra o petróleo” por uma afirmação condicionada ao fundo escuro específico, ou revisar o valor/uso.

## Fontes primárias consultadas

Todas consultadas em 2026-09-14, `America/Sao_Paulo`:

1. [Microsoft Fluent 2 — Color](https://fluent2.microsoft.design/color)
2. [Primer — Color usage](https://www.primer.style/product/getting-started/foundations/color-usage/)
3. [Primer — Token names](https://primer.style/product/primitives/token-names/)
4. [Atlassian Design — Color](https://atlassian.design/foundations/color-new/)
5. [Atlassian Design — Accents](https://atlassian.design/foundations/color/accents/)
6. [Atlassian Design — Design tokens](https://atlassian.design/tokens/design-tokens)
7. [Vercel Geist — Colors](https://vercel.com/geist/colors)
8. [MDN — `oklch()` CSS function](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/oklch)
9. [MDN — CSS color values](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Colors/Color_values)
10. [W3C — Web Content Accessibility Guidelines (WCAG) 2.2](https://www.w3.org/TR/WCAG22/)
11. [W3C WAI — Understanding Success Criterion 2.4.13: Focus Appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html)
