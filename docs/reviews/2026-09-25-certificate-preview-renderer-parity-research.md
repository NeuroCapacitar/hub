---
status: research_only
owner: design-and-engineering
last_verified_commit: 676290f533cbf9caa967b8c889b99e895b2b8281
last_verified_at: 2026-09-25
---

# Paridade tipográfica entre preview e certificado PDF — 2026-09-25

## Conclusão executiva

A suspeita procede em parte, mas a fonte não está trocada no fluxo atual: o PDF
emitido, o editor interativo e o PNG público usam os mesmos arquivos locais
Inter Regular e Inter Bold. Os nomes `Helvetica` e `Helvetica-Bold` persistem
como aliases de compatibilidade no modelo, e o seletor do editor também os
mostra ao Admin; portanto, há uma inconsistência real de nomenclatura, não uma
substituição do Inter por Helvetica no PDF.

A paridade ainda não é exata. O editor usa layout de texto do navegador; o PDF
usa PDFKit; e o PNG público monta SVG com uma heurística própria de quebra por
quantidade aproximada de caracteres. Mesmo com a mesma família e arquivos de
fonte, esses caminhos podem produzir quebras, alturas e alinhamentos diferentes.
Além disso, a fonte CSS usa `font-display: swap`, então pode haver fallback
temporário enquanto Inter carrega. O maior achado é a heurística do PNG, seguida
pela falta de identificação da versão de renderer/fonte no snapshot imutável,
que pode fazer um PNG histórico regenerado deixar de corresponder ao PDF
original.

Conclusão prática: não trocar Inter por Helvetica. Corrigir os rótulos visíveis,
sincronizar medições com o carregamento real da fonte e aproximar os três
renderers por um algoritmo/layout comum. Para visualização pública com paridade
forte, preferir rasterizar o PDF efetivamente emitido, se a infraestrutura
suportar isso com segurança e custo aceitável.

## Escopo e método

Verifiquei o código na revisão `676290f533cbf9caa967b8c889b99e895b2b8281`,
incluindo o editor interativo, os renderers PDF e PNG, os arquivos TTF, testes,
snapshot de emissão e fluxo de regeneração do PNG. A pesquisa externa foi feita
em 25/09/2026 com especificação W3C, MDN, documentação oficial do PDFKit
JavaScript, upstream oficial do Inter e, apenas para contexto de produto,
documentação oficial do Thinkific e LearnWorlds.

Não abri uma URL local nem comparei visualmente um PDF de produção com seus
previews. Assim, as divergências abaixo são riscos comprovados pela arquitetura
e pelo código, não uma alegação de que todo certificado já apresenta diferença
visível. A inspeção do PDF real e uma comparação automatizada de saída ficam
como verificação de implementação.

## O que cada superfície realmente renderiza

| Superfície | Fonte configurada | Motor e regra de texto | Resultado |
| --- | --- | --- | --- |
| PDF emitido | `Helvetica` → `Inter-Regular.ttf`; `Helvetica-Bold` → `Inter-Bold.ttf` | PDFKit; `heightOfString` e `text` recebem a largura do campo e fazem layout no motor PDF | Inter incorporado no PDF pelo PDFKit; não é Helvetica Base-14 |
| Editor Admin | `Certificate Inter`, carregada dos mesmos TTFs em `public/fonts/certificates` | DOM/CSS do navegador; tamanho em CSS px escalado da página A4, `line-height: 1.15`, alinhamento flex e quebra CSS | Mesma família/arquivos e pesos; motor e quebra diferentes de PDFKit |
| PNG público do certificado | SVG declara `Inter`; Fontconfig aponta para `public/fonts/certificates` | Sharp/librsvg; quebra manual aproximada com `floor(largura / (tamanho × 0.56))` e entrelinha `1.15` | Mesmo conjunto de fonte, mas algoritmo de texto mais distante do PDF |

Evidência no repositório: `src/features/certificates/font-assets.ts` mapeia os
aliases para os TTFs; `src/features/certificates/rendering.ts` passa o caminho
do arquivo ao `document.font(...)`; `src/app/globals.css` define `Certificate
Inter` com os mesmos TTFs e pesos 400/700; e
`src/app/(admin)/admin/cursos/[courseId]/certificate-template-preview-layout.ts`
usa essa família no DOM. O renderizador público em
`src/features/certificates/preview.ts` declara `font-family="Inter"` e configura
Fontconfig por `configureCertificateFontRuntime()`.

A documentação oficial do PDFKit confirma que passar um arquivo TTF à API
`font` usa fonte customizada incorporável e documenta `widthOfString`,
`heightOfString` e `boundsOfString`, incluindo opções de layout e quebra. A
documentação não promete que essas métricas coincidam com as métricas de CSS ou
de outro rasterizador. [PDFKit — Text](https://pdfkit.org/docs/text.html)

O upstream do Inter identifica-o como uma família própria, fornece faces
estáticas e variável, e mapeia Regular para peso 400 e Bold para 700. Portanto,
o uso dos dois TTFs e pesos no Hub é coerente com o pacote oficial do Inter.
[Inter — README oficial](https://github.com/rsms/inter)

## Por que a mesma fonte não garante o mesmo preview

### Medição e quebra

No PDF, `rendering.ts` mede a altura usando `document.heightOfString(value,
{ align, width })` e depois chama `document.text` com `width` e `height`. No
editor, `getCertificatePreviewTextStyle` aplica caixa CSS, `line-height: 1.15`,
`text-pretty` e `break-words`; isso deixa a quebra e as métricas a cargo do
navegador. O próprio teste
`certificate-template-preview-layout.test.ts` chama o mapeamento de
“closest browser metrics” e registra que PDFKit e browsers usam engines
diferentes. Essa é uma aproximação deliberada, não evidência de equivalência
pixel a pixel.

O PNG é o ponto mais frágil: `preview.ts` estima a quantidade máxima de
caracteres pela largura e pelo fator fixo `0.56`, antes de emitir linhas SVG.
Isso não mede a largura real de cada string nem considera o desenho de cada
glifo, espaçamento, kerning ou sequência de caracteres. “W” e “i”, por
exemplo, não ocupam a mesma largura em Inter. PDFKit, por outro lado, layouta a
string usando a fonte selecionada e a largura disponível. Assim, nomes longos,
títulos, acentos, códigos sem espaços e combinações de caracteres têm risco
maior de divergir no PNG. O código comprova o risco; não foi feita uma
comparação rasterizada para quantificar a frequência.

A especificação W3C define CSS como seleção de faces por família e outras
propriedades, além de prever fallback. Ela também registra que agentes de
usuário podem obter métricas de partes diferentes do arquivo de fonte e que
isso pode resultar em layouts de texto distintos. A especificação não define
equivalência de layout entre browser CSS e PDFKit. [W3C — CSS Fonts Module
Level 4](https://www.w3.org/TR/css-fonts-4/)

### Carregamento da fonte no browser

As regras `@font-face` do Hub usam `font-display: swap`. Esse modo permite texto
temporário em fonte de fallback e posterior troca para a fonte web quando ela
carrega. O CSS Font Loading API expõe `document.fonts.ready`, resolvida quando
as fontes necessárias foram tratadas e o layout do documento terminou.
[MDN — `font-display`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40font-face/font-display),
[MDN — CSS Font Loading API](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Font_Loading_API)

No editor, a medição para “ajustar ao conteúdo” usa `getBoundingClientRect`,
`scrollWidth` e `scrollHeight`; a detecção de overflow também usa medidas DOM.
As rotinas não aguardam explicitamente o carregamento das faces Inter. Com
`swap`, é possível que uma operação rápida leia temporariamente as métricas do
fallback e não seja recalculada quando Inter substituir a fonte. Isso é um
risco de corrida de layout, não prova de que aconteça em toda abertura: arquivos
locais e cache reduzem a janela, mas não a tornam uma garantia.

Manter `swap` pode continuar sendo correto para não esconder texto. A correção
deve sincronizar ações sensíveis a medidas com `document.fonts.load()`/
`document.fonts.ready` e repetir a verificação de overflow após a troca, sem
bloquear todo o editor. A recomendação da API é controlar e observar o
carregamento quando o desenho/medição depende da fonte. [MDN — CSS Font Loading
API](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Font_Loading_API)

### O rótulo “Helvetica” é uma inconsistência de produto

O contrato de dados ainda aceita os valores `Helvetica` e `Helvetica-Bold` por
compatibilidade, mas `certificate-template-fields.tsx` mostra exatamente esses
nomes no seletor. Como `font-assets.ts` os resolve para Inter, o Admin escolhe
uma opção cujo nome não descreve o que será emitido. Isso explica diretamente a
suspeita e pode induzir a escolha errada, ainda que os glifos no arquivo sejam
Inter.

Recomendação: exibir “Inter” e “Inter Bold” na interface, preservando por ora
os valores persistidos e as regras de validação antigas. Renomear o enum/schema
não é necessário para corrigir a comunicação e aumenta o risco de quebrar
templates/snapshots legados. O próprio guia de domínio já documenta os aliases
como compatibilidade para Inter: `docs/domain/certificates-and-data-rights.md`.

## Risco adicional: regenerar preview de Certificado histórico

O `CertificateRenderSnapshot` registra campos, dados, ids e versão do template,
mas não registra a versão/hash dos arquivos de fonte nem a versão do algoritmo
de layout. O PDF emitido é persistido como evidência imutável. Já
`preview-server.ts`, quando o PNG está ausente ou seu digest diverge, regenera o
PNG pelo renderer atualmente implantado a partir do snapshot.

Consequência: depois de substituir Inter ou alterar algoritmo/renderer, um
PNG histórico regenerado pode não ser visualmente idêntico ao PDF original,
mesmo que o snapshot de conteúdo continue igual. Isso não reescreve o PDF e não
afeta PNGs existentes com hash válido; é um risco do caminho de recuperação. O
guia de domínio já menciona a geração sob demanda, mas não especifica versionar
fontes/renderer para reprodução histórica.

Recomendação: antes de atualizar os TTFs ou mudar os renderers, escolher um
contrato de reprodutibilidade histórica. Preferência: gerar o PNG público a
partir do PDF imutável efetivamente emitido, caso um rasterizador compatível
possa ser operado com custo e segurança aceitáveis. Alternativa: gravar uma
versão/hash do renderer e da fonte no snapshot e conservar assets versionados
necessários para regenerá-lo. Não sobrescrever silenciosamente os assets atuais
sem essa decisão.

## Evidência de produto de outros editores

Thinkific documenta que o designer tem preview do certificado, dados do curso
e campos dinâmicos de aluno/curso, e que detalhes da certificação são salvos
antes da personalização visual. Também afirma que mudanças de design afetam
novas emissões, sem alterar certificados previamente emitidos. A documentação
não especifica se o preview e a emissão compartilham motor de renderização ou
métricas tipográficas; não serve como prova de paridade técnica.
[Thinkific — Certificate Designer](https://support.thinkific.com/hc/en-us/articles/41803314085783-Designing-Your-Certificate-with-the-Certificate-Designer)

LearnWorlds descreve certificados fictícios gerados por submissão administrativa
como instrumentos de teste/preview e documenta o uso de PDF customizado e campos
dinâmicos. Isso sustenta testar exemplos de dados sem emitir um certificado
real, mas também não demonstra identidade visual entre editor, PNG e PDF.
[LearnWorlds — Certificate of Completion](https://support.learnworlds.com/support/solutions/articles/12000087212-how-to-create-a-certificate-of-completion)

Os dois players oferecem evidência de produto para uma prévia/teste com dados
dinâmicos. Nenhum dos artigos consultados especifica o renderer, o algoritmo de
medição ou uma garantia de paridade pixel a pixel. As conclusões de engenharia
devem vir do código e de testes do Hub, não de inferência sobre a arquitetura
interna desses serviços.

## Recomendações priorizadas

1. **Corrigir os nomes de fonte na UI.** Mostrar “Inter”/“Inter Bold”; manter
   aliases persistidos até eventual migração explícita. É uma correção segura,
   pequena e diretamente sustentada pelo código.
2. **Eliminar a heurística de caracteres no PNG.** Preferir PNG derivado do PDF
   emitido. Se isso for inviável, compartilhar uma única lógica de largura,
   quebra, baseline e alinhamento baseada na fonte real entre PDF e PNG. Não
   duplicar um terceiro conjunto de aproximações.
3. **Sincronizar medidas do editor com as fontes carregadas.** Aguardar as faces
   Regular/Bold antes de “ajustar ao conteúdo”; recalcular overflow quando a
   troca para Inter terminar. Manter fallback durante carregamento para não
   bloquear a tela inteira.
4. **Adicionar teste de conformidade entre renderers.** Usar fixtures longas e
   difíceis (nome extenso com acentos, título longo, código sem espaços, CNPJ,
   alinhamentos e pesos Regular/Bold). Verificar fontes selecionadas, quebras e
   limites/posições dentro de tolerâncias definidas. Não exigir igualdade de
   pixels antialiasados entre engines distintas.
5. **Versionar a reprodução histórica.** Antes de atualizar TTFs ou o renderer,
   garantir que PNG regenerado continue representando o PDF emitido, via
   rasterização do PDF ou assets/renderer versionados no snapshot.
6. **Otimização opcional do carregamento web.** Os dois TTFs atualmente somam
   832.068 bytes no repositório. Avaliar WOFF2 só depois de medir a transferência
   real do editor; se adotado, gerar o web asset da mesma versão dos TTFs usados
   pelo PDF e manter cobertura dos caracteres portugueses. O MDN documenta
   suporte amplo a fontes web e WOFF2, e o upstream Inter distribui assets para
   web; isso é otimização de entrega, não requisito de paridade.
   [MDN — Web fonts](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Text_styling/Web_fonts),
   [Inter — distribuição oficial](https://github.com/rsms/inter)

## O que não recomendo

- Não substituir Inter por Helvetica para fazer o nome do seletor coincidir com
  o renderer atual; o contrato aprovado e os assets do projeto dizem Inter.
- Não prometer que mesma família significa medidas idênticas: browser, PDFKit e
  librsvg continuam motores distintos.
- Não mudar `font-display: swap` para `block` sem medir a experiência. A ação
  sensível à geometria deve aguardar a fonte; o restante da tela pode continuar
  aparecendo.
- Não alterar certificados já emitidos nem recalcular seus PDFs. O PDF
  persistido permanece a autoridade histórica; a melhoria deve preservar esse
  invariante.
- Não adotar a saída aproximada de um player como prova de paridade, pois as
  páginas oficiais consultadas não documentam esse contrato.

## Fontes primárias consultadas

- [PDFKit — Text: fonte incorporada e métricas](https://pdfkit.org/docs/text.html)
- [W3C — CSS Fonts Module Level 4](https://www.w3.org/TR/css-fonts-4/)
- [MDN — CSS `font-display`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@font-face/font-display)
- [MDN — CSS Font Loading API](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Font_Loading_API)
- [MDN — Web fonts e fallback](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Text_styling/Web_fonts)
- [Inter — repositório e distribuição oficial](https://github.com/rsms/inter)
- [Thinkific — Certificate Designer](https://support.thinkific.com/hc/en-us/articles/41803314085783-Designing-Your-Certificate-with-the-Certificate-Designer)
- [LearnWorlds — Certificate of Completion](https://support.learnworlds.com/support/solutions/articles/12000087212-how-to-create-a-certificate-of-completion)
