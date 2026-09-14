# Plano corrigido: refatoração do sistema visual NeuroCapacitar Hub

> Status: implemented
> Owner: design-and-engineering
> Baseline analisado: `aa3119c28414100e9d18b1b85bf55607d722225c`
> Relatório de origem: `C:\Users\Junior\Desktop\rebrand.md`
> Manual de identidade: `C:\Users\Junior\Desktop\IDV NEURO.CAPACITAR.pdf`
> Relatório de implementação: `design-plans/neuro-brand-system-implementation-report.md`

## Objetivo

Fazer a identidade NeuroCapacitar aparecer de forma consistente no Hub sem
reconstruir o frontend, trocar a fundação técnica ou transformar o produto em
uma interface saturada de cor.

O resultado esperado mantém o petróleo como ambiente estrutural e acrescenta
funções controladas para areia, laranja, oliva e terracota:

- petróleo constrói o ambiente;
- areia aquece conteúdo e texto quando houver contraste comprovado;
- laranja orienta ação e atenção;
- oliva marca avanço de aprendizagem quando esse significado estiver explícito;
- terracota oferece expressão editorial pontual, sem representar erro;
- `success`, `warning`, `info` e `destructive` continuam semânticos e
  independentes da decoração de marca.

O plano é uma migração coordenada de tokens e consumidores. Não é uma troca de
valores no `globals.css` seguida de publicação.

## Decisões preservadas

- Geist permanece a tipografia da UI do Hub; Lexend não será introduzida na
  aplicação sem uma decisão específica.
- OKLCH permanece o formato da UI web.
- O produto permanece dark-only.
- Radix/shadcn local, Hugeicons, Tailwind, `PanelLayout`, `PageContainer`,
  `PageHeader` e os primitives existentes permanecem como fundação.
- PROTEA-R continua uma identidade de Curso, não a identidade global da
  plataforma.
- Não serão adicionados Storybook, outra biblioteca visual, CSS externo ou um
  design system paralelo.
- Não serão adicionados gradientes, blobs, glow, glass, texturas ou sombras
  decorativas a superfícies operacionais. Formas orgânicas só podem aparecer
  em uma exceção institucional explicitamente aprovada.
- Nenhuma cor será o único indicador de estado, seleção, erro, sucesso,
  progresso ou bloqueio.
- E-mails, cores persistidas de templates, renderização de certificados e
  imagens de conteúdo permanecem fora desta migração web, salvo contrato
  separado.

## Evidências e limites da análise

O manual confirma os anchors da página 8:

| Anchor | HEX | Papel inicial |
| --- | --- | --- |
| petróleo | `#326C71` | identidade e superfícies de marca |
| areia | `#F1E8DA` | texto/superfície quente quando houver contraste |
| laranja queimado | `#D97B34` | ação e atenção pontual |
| oliva | `#9EAD7C` | cuidado e avanço de aprendizagem |
| terracota | `#C56A4C` | expressão editorial não destrutiva |

As páginas editoriais do manual também usam magenta, preto e composições
orgânicas. Isso será tratado como linguagem editorial até que uma decisão
explícita determine outro uso no produto; não será convertido automaticamente
em token de dashboard.

O relatório foi escrito contra `staging` em `2bfcf38e`. Esse commit é o
ancestral direto do baseline desta worktree; os commits seguintes não alteram
os arquivos centrais do sistema visual. A worktree principal, entretanto,
possui alterações não commitadas de marca (`public/brand`, `brand.ts`,
`AuthShell` e `icon.svg`). Esse trabalho deve ser reconciliado antes de
duplicar ou remover assets.

As referências externas sustentam a arquitetura, não valores visuais prontos:

- [Fluent 2 Color](https://fluent2.microsoft.design/color) separa
  `neutral`, `shared` e `brand`, e recomenda uso parcimonioso de brand colors;
- [Primer Color usage](https://www.primer.style/product/getting-started/foundations/color-usage/)
  separa `base`, `functional` e `component/pattern`;
- [Atlassian Color](https://atlassian.design/foundations/color-new/) nomeia
  tokens por propriedade, papel, ênfase e estado;
- [Geist Colors](https://vercel.com/geist/colors) organiza escalas por
  background, componente, borda, alto contraste e texto/ícone;
- [MDN OKLCH](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/oklch)
  sustenta luminosidade percebida, chroma e hue, mas não garante contraste;
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) define os gates de texto, componentes,
  estados e foco.

## Arquitetura de tokens

### Camada 1: anchors de marca

Adicionar anchors documentais em `src/app/globals.css`, sem permitir que
componentes consumam esses valores diretamente:

```css
--brand-petroleum
--brand-sand
--brand-orange
--brand-olive
--brand-terracotta
```

O grafite do manual não entra como base global enquanto não houver decisão de
produto para uma superfície clara ou neutra específica.

### Camada 2: tokens funcionais

Preservar os aliases existentes do shadcn e introduzir papéis independentes
onde `primary` hoje acumula significados:

| Papel | Decisão de uso |
| --- | --- |
| `background`, `card`, `popover`, `muted` | superfícies estruturais; não recebem cor de ação por conveniência |
| `foreground`, `muted-foreground` | texto; a areia é candidata, não valor automático |
| `primary` | alias compatível para ação primária; só será remapeado após a classificação dos consumidores |
| `selection` | seleção de texto, controle e seleção visual; não depender de `primary` por acidente |
| `focus` | indicador de teclado; deve passar contraste contra cada superfície e controle |
| `link` | links de alta intenção; não assumir que todo `primary` é link |
| `progress-active` | progresso corrente, candidato a laranja |
| `learning-complete` | conclusão de aprendizagem, candidato a oliva |
| `success`, `warning`, `info`, `destructive` | estados técnicos e ações semânticas; permanecem independentes da marca |
| `surface-warm` | superfície quente rara para Auth, onboarding, checkout ou callout institucional |
| `sidebar-*` | navegação; não herdar `primary` sem decisão específica |
| `chart-1` a `chart-5` | subpaleta de dados, testada por série e alternativa textual |

`accent` permanece laranja durante a migração inicial. Não será alterado para
oliva, porque já controla foco de menus, hover de `LessonCard` e estados de
certificado. Se a experiência de aprendizagem precisar de oliva, usará
`learning-complete` ou uma variante explícita, não um remapeamento silencioso
de `accent`.

### Camada 3: tokens de componente e estado

Criar tokens de componente somente quando o papel funcional não for suficiente,
por exemplo para `button-primary`, `sidebar-active`, `progress-complete` ou
`badge-learning-complete`. Esses tokens devem ficar no owner do componente e
referenciar tokens funcionais, nunca HEX ou anchors diretamente.

O mapeamento em `@theme inline`, os blocos `:root` e `.dark`, os tokens de
sidebar e as variantes com alpha precisam permanecer sincronizados.

## Escopo e invariantes por superfície

| Superfície | Aplicação da marca | Proteções |
| --- | --- | --- |
| Auth e páginas institucionais | logo da plataforma, areia, laranja e eventualmente `surface-warm` | não reutilizar identidade de Curso; não criar hero decorativo por padrão |
| Checkout público | logo, CTA laranja e hierarquia de confiança | não alterar contrato de compra, preço, pagamento ou URLs |
| Student | ação laranja, progresso ativo laranja, conclusão de aprendizagem oliva | não transformar `success` técnico em oliva automaticamente |
| Aula | texto, ritmo e foco; cor mínima | mídia é protagonista; não espalhar as cinco cores |
| Certificados web | status de certificado e ações | não alterar a arte/renderizador do PDF nesta linha |
| Admin e Support | superfícies neutras, CTA e estados semânticos | não usar marca como legenda financeira ou operacional |
| Financeiro, Auditoria e Operação | semântica e densidade primeiro | dinheiro, risco e erro mantêm papéis previsíveis |
| Charts | subpaleta discriminável | legenda, alternativa textual, contraste e daltonismo |

## Plano de execução

### Fase 0: ratificar o contrato antes do código

**Arquivos de entrada:** `DESIGN.md`, `src/app/globals.css`, relatório,
manual, pesquisa independente e esta especificação.

- [ ] Registrar no `DESIGN.md` a separação `brand/base → functional/semantic →
  component/state`.
- [ ] Registrar a regra de que anchors de marca não são consumidos diretamente
  por componentes.
- [ ] Registrar `accent` como laranja existente e `learning-complete` como
  papel separado, sem decidir que oliva é `success`.
- [ ] Registrar os limites para `surface-warm`, formas orgânicas, magenta,
  checkout e Auth.
- [ ] Registrar que dark-only, Geist e OKLCH continuam vigentes.
- [ ] Atualizar `last_verified_commit` somente quando a documentação refletir
  o commit que contém a mudança.
- [ ] Executar `bun run docs:check`.

**Gate:** nenhuma migração global começa enquanto a taxonomia e as exceções
não estiverem aprovadas no documento canônico.

### Fase 1: inventário e matriz de consumidores

**Arquivos de entrada:** `src/app/globals.css`, `src/components/ui`,
`src/components/panel-layout.tsx`, superfícies Student/Admin/Auth/Checkout e
todos os usos de `primary` e `accent`.

- [ ] Catalogar todos os usos de `bg-primary`, `text-primary`,
  `border-primary`, `ring-primary`, `primary/*`, `bg-accent`, `text-accent` e
  `accent/*`.
- [ ] Classificar cada uso como ação, seleção, foco, progresso, avatar, badge,
  link, superfície, drag state, upload state, chart ou estado semântico.
- [ ] Registrar o owner do uso e o token funcional de destino.
- [ ] Catalogar `:root`, `.dark`, `sidebar-*`, `chart-*`, `::selection` e todos
  os valores com alpha.
- [ ] Catalogar cores hardcoded em CSS/TSX, separando UI web de contratos de
  e-mail, certificado, banco e mídia.
- [ ] Marcar como já existente, no plano de execução, a migração de Auth e
  assets da worktree principal; não reimplementar nem remover assets até o
  change set de marca estar completo.

**Gate:** zero consumidores sem classificação; a matriz deve permitir prever
quais telas mudam quando cada token funcional for alterado.

### Fase 2: laboratório visual isolado

**Arquivos novos planejados:**

- `src/app/(admin)/admin/configuracoes/design-system/page.tsx`, sem link na
  navegação e protegido pelo layout administrativo existente;
- composição de fixture em `src/components/design-system-preview.tsx`;
- testes de fonte/contrato para a fixture, quando necessário.

- [ ] Renderizar em paralelo a paleta atual e a candidata, sem alterar ainda o
  tema global das demais telas.
- [ ] Cobrir Button, Badge, Card, Input, Select, Checkbox, Radio, Switch,
  Slider, Tabs, Progress, Alert, Empty, Dropdown, Dialog/Sheet, Sidebar,
  Table, links, avatar e estados de upload.
- [ ] Cobrir repouso, hover, foco, ativo, selecionado, disabled, loading,
  erro, sucesso, warning, vazio, progresso corrente e conclusão.
- [ ] Testar a candidata no background atual, card, muted, sidebar e petróleo
  oficial `#326C71`.
- [ ] Comparar Student e Admin na mesma fixture, preservando a diferença de
  registro por frequência de uso dos tokens, não por segundo tema.
- [ ] Verificar conteúdo longo, viewport estreito, teclado, foco visível e
  leitura sem depender de cor.
- [ ] Produzir evidência renderizada determinística para revisão; screenshots
  não substituem testes semânticos e de contraste.

**Gate:** a paleta candidata não entra em `:root`/`.dark` até que a fixture
prove a hierarquia e os estados principais.

### Fase 3: tokens e primitives

**Arquivos principais:** `src/app/globals.css`,
`src/components/ui/button.tsx`, `badge.tsx`, `progress.tsx`, `tabs.tsx`,
`dropdown-menu.tsx`, `sidebar.tsx`, `avatar.tsx`, `checkbox.tsx`,
`radio-group.tsx`, `slider.tsx`, `switch.tsx`, `calendar.tsx`, `field.tsx`.

- [ ] Adicionar os anchors de marca e os aliases funcionais aprovados.
- [ ] Atualizar `:root`, `.dark`, `@theme inline`, `sidebar-*`, `chart-*` e
  `::selection` de forma sincronizada.
- [ ] Remapear `Button` sem alterar a API pública de variantes.
- [ ] Remover usos acidentais de `primary` em Avatar, Progress, links,
  selection, focus e estados de aprendizagem.
- [ ] Criar variantes explícitas quando um primitive tiver papéis distintos,
  em vez de depender do valor global de `primary`.
- [ ] Manter `success`, `warning`, `info` e `destructive` independentes.
- [ ] Criar testes de contrato para impedir que os primitives consumam
  `--brand-*` diretamente e para verificar os papéis funcionais.

**Gate:** testes afetados, `bun run check` e `bun run typecheck` passam; a
matriz de consumidores está atualizada; nenhum uso não classificado foi
introduzido.

### Fase 4: shell, Auth e superfícies públicas

**Arquivos principais:** `src/components/panel-layout.tsx`,
`src/components/auth-shell.tsx`, `src/lib/brand.ts`, `src/app/icon.svg`,
`public/brand/*`, páginas de compra, certificado público, manutenção e
not-found.

- [ ] Integrar a mudança de assets da worktree principal sem duplicar ou
  apagar a identidade de Curso antes de validar o novo asset.
- [ ] Corrigir fallbacks de Avatar do shell para não depender de `primary`.
- [ ] Definir sidebar normal, hover, active, focus e mobile com `sidebar-*`.
- [ ] Manter header, skip link, logo e dimensões estruturais existentes.
- [ ] Aplicar `surface-warm` e formas orgânicas somente nas superfícies
  institucionais aprovadas; nenhuma tabela ou operação recebe decoração.
- [ ] Dar ao Checkout um CTA laranja e marca explícita sem modificar a jornada
  de pagamento, o handoff ou contratos de compra.

**Gate:** Auth, shell, Checkout e certificado público passam por evidência
renderizada desktop/estreita, teclado e contraste; não há referência global a
PROTEA-R como marca da plataforma.

### Fase 5: registro de aprendizagem

**Superfícies:** dashboard do Aluno, Curso, Módulos, `LessonCard`, Aula,
progresso, certificados, FAQ e configurações do Aluno.

- [ ] Usar ação laranja somente onde há ação principal.
- [ ] Usar `progress-active` para andamento e `learning-complete` para
  conclusão, sempre com texto/ícone/estado além da cor.
- [ ] Manter Aula como superfície de concentração, com cor mínima e largura de
  leitura existente.
- [ ] Reduzir dependência de `primary` em gradientes, hover borders e fallback
  de cards sem remover a mídia de conteúdo aprovada.
- [ ] Preservar a distinção entre status de aprendizagem e sucesso técnico.
- [ ] Verificar Student em conteúdo longo, sem dados, loading, erro, progresso
  parcial, conclusão e viewport estreito.

**Gate:** nenhuma tela de aprendizagem usa uma cor apenas porque ela está
disponível; cada uso aparece na matriz de consumidores.

### Fase 6: registro operacional

**Superfícies:** Admin Dashboard, Cursos, Alunos, Aprendizagem, Financeiro,
Operação, Auditoria e Configurações.

- [ ] Aplicar a nova hierarquia de superfícies e ações sem aumentar densidade
  ornamental.
- [ ] Manter financeiro, auditoria e operação com estados semânticos
  independentes da paleta de marca.
- [ ] Revisar AdminMetricCard, tabelas, filtros, banners, estados vazios e
  formulários somente quando a matriz demonstrar necessidade.
- [ ] Criar ou revisar a subpaleta de charts separadamente, com legenda,
  alternativa textual, contraste e teste de distinção entre séries.
- [ ] Não alterar unidades, fórmulas, permissões, labels de negócio ou dados
  para alcançar uma aparência mais branded.

**Gate:** Student e Admin compartilham os mesmos papéis funcionais, mas não
precisam compartilhar a mesma frequência cromática; Financeiro e Auditoria
não usam marca como semântica de dados.

### Fase 7: limpeza e verificação final

- [ ] Reexecutar a matriz de `primary`/`accent` e eliminar usos não
  classificados.
- [ ] Localizar cores hardcoded restantes e documentar exceções de e-mail,
  certificado, banco, mídia e conteúdo.
- [ ] Confirmar que ambos os blocos de tema continuam equivalentes e dark-only.
- [ ] Confirmar que nenhum componente consome anchor de marca diretamente.
- [ ] Verificar repouso, hover, foco, ativo, disabled, loading, sucesso, erro,
  vazio e seleção em cada superfície alterada.
- [ ] Verificar texto normal em `4,5:1`, texto grande em `3:1` e informação
  visual de componente/estado em `3:1`, contra as cores adjacentes exatas.
- [ ] Verificar foco visível e foco não oculto por header, sheet ou overlay.
- [ ] Verificar grayscale e uma condição de visão de cores sem depender de
  cor como único significado.
- [ ] Executar testes afetados, `bun run check`, `bun run typecheck` e
  `bun run docs:check`.
- [ ] Atualizar documentação e `last_verified_commit` no mesmo change set.
- [ ] Registrar limitações e quaisquer pares de cor deliberadamente não
  utilizados por contraste insuficiente.

## Ordem de integração e rollback

Cada fase deve ser uma unidade revisável e reversível:

1. documentação e matriz, sem mudança visual global;
2. fixture candidata, sem mudança visual global;
3. tokens funcionais e primitives;
4. shell/Auth/público;
5. Student;
6. Admin;
7. limpeza e documentação final.

Nenhuma fase altera banco, migrations, contratos de compra, permissões,
templates de e-mail ou renderização de certificados. Se uma fase falhar na
validação, seu remapeamento de tokens deve poder ser revertido sem desfazer a
fixture, a matriz ou as decisões documentadas.

Antes da primeira implementação, registrar o baseline de verificação da
worktree. A execução anterior de `bun test` encontrou dependências incompletas
e falhas de infraestrutura de teste (`1473 pass`, `237 fail`, `214 errors`),
incluindo pacotes ausentes e APIs de Vitest incompatíveis. Esses resultados não
podem ser usados como evidência de regressão desta refatoração. A baseline deve
ser reexecutada em um ambiente com dependências completas, ou cada bloqueio
deve ser documentado e separado dos resultados dos testes visuais.

## Riscos e mitigação

| Risco | Mitigação obrigatória |
| --- | --- |
| troca global de `primary` muda centenas de estados | matriz completa antes do remapeamento e rollout por coortes |
| `accent` oliva altera foco e hover existentes | manter `accent` laranja; criar papel de conclusão separado |
| OKLCH parece correto, mas falha contraste | matriz de pares por superfície, estado e alpha |
| Student e Admin parecem dois temas diferentes | mesmos tokens funcionais; diferença apenas de composição e frequência |
| Auth/brand assets divergem entre worktrees | reconciliar change set existente antes de remover assets antigos |
| fixture vira rota de produção sem ownership | rota administrativa sem link, documentada e revisada como ferramenta interna |
| claims subjetivos viram critério de aceite | combinar evidência renderizada, contrato, contraste, teclado e comandos |
| alterações visuais atingem contratos externos | manter e-mail, certificado, banco e mídia fora do escopo explícito |

## Critérios de aceitação final

O redesign só estará aceito quando todos os itens forem verdadeiros:

- o petróleo continua reconhecível como base, sem dominar ação, foco e todos
  os estados;
- anchors de marca e tokens funcionais estão separados;
- cada consumidor de `primary` e `accent` está classificado;
- ação, seleção, foco, progresso e semântica não dependem do mesmo token por
  acidente;
- nenhum estado importante depende somente de cor;
- os pares exatos de texto, controles, foco, bordas e superfícies passam os
  limiares definidos;
- Student é mais caloroso por composição, não por saturação indiscriminada;
- Admin, Financeiro e Auditoria continuam densos, legíveis e operacionais;
- Auth e Checkout comunicam a plataforma sem usar PROTEA-R como marca global;
- não há novos efeitos decorativos fora das exceções aprovadas;
- `bun run check`, `bun run typecheck`, `bun run docs:check` e os testes
  afetados passam, ou o bloqueio exato está documentado;
- a documentação canônica aponta para o contrato implementado e para o commit
  verificado.

## Resultado esperado desta especificação

Esta correção mantém a intenção do relatório original — tornar a NeuroCapacitar
mais humana, reconhecível e funcional — mas impede que a implementação trate a
paleta de marca como uma substituição global de tokens. A primeira mudança
executável deve ser a Fase 0, seguida da fixture isolada; nenhuma troca global
de `--primary` está autorizada antes desses gates.
