# Relatório de implementação: sistema visual NeuroCapacitar Hub

> Estado: implementado na worktree `codex/design-system-refactor`
> Baseline: `aa3119c28414100e9d18b1b85bf55607d722225c`
> Data: 2026-09-14
> Worktree: `C:\Users\Junior\.config\superpowers\worktrees\hub\design-system-refactor`

## Resultado

O plano corrigido foi implementado sem alterar a worktree principal e sem
introduzir uma biblioteca visual paralela.

O sistema agora separa anchors de marca dos papéis funcionais. A mudança
visual mais ampla é a promoção do laranja para ação principal, enquanto areia,
oliva, terracota e petróleo recebem usos delimitados. Estados técnicos
continuam independentes.

## Fases executadas

### Fases 0–1: contrato e inventário

- Atualizado `DESIGN.md` com `selection`, `focus`, `progress-active`,
  `learning-complete`, `link` e `surface-warm`.
- Registrada a matriz de consumidores em
  [neuro-brand-token-consumer-matrix.md](./neuro-brand-token-consumer-matrix.md).
- Documentados os anchors `brand-*` e a regra de que componentes não devem
  consumir anchors diretamente.
- Mantidos Geist, OKLCH, dark-only, Radix/shadcn, Hugeicons e os shells
  existentes.
- `accent` permaneceu laranja; não foi remapeado para oliva.

### Fase 2: fixture visual

Criada a rota administrativa sem item de navegação:

- `/admin/configuracoes/design-system`
- [design-system-preview.tsx](../src/components/design-system-preview.tsx)

A fixture cobre ações, badges, estados técnicos, progresso ativo/concluído,
cards, superfície quente, input, tabs e amostras da paleta.

### Fase 3: tokens e primitives

Atualizados:

- [globals.css](../src/app/globals.css)
- [button.tsx](../src/components/ui/button.tsx)
- [badge.tsx](../src/components/ui/badge.tsx)
- [progress.tsx](../src/components/ui/progress.tsx)
- [tabs.tsx](../src/components/ui/tabs.tsx)
- checkbox, radio, slider, switch e calendar
- links, avatares, seleção e foco

O foco passou a usar uma composição de outline claro e ring de fundo para
continuar distinguível tanto em controles escuros quanto em ações laranja.

### Fase 4: shell, Auth e superfícies públicas

Alterações visíveis em:

- AuthShell, com shell arredondado, mídia da plataforma e logo global;
- `public/brand/logo-negativo.svg` e `public/brand/login-capa.webp`;
- `src/lib/brand.ts` e `src/app/icon.svg`;
- `/comprar/[slug]`;
- `/checkout/sucesso`;
- `/app/checkout/sucesso`;
- certificado público e seu status de preparação/validação.

A feature dinâmica de mídia de Auth que existe como alteração independente na
worktree principal não foi duplicada nesta branch; apenas os assets estáticos
de plataforma foram incorporados.

### Fase 5: aprendizagem

Alterações visíveis em:

- dashboard do Aluno;
- cards de Curso;
- visão de Curso e progresso de Módulos;
- LessonCard;
- barra de progresso da Aula;
- estados “Em andamento” e “Concluída”;
- processamento de vídeo e upload de vídeo.

Progresso em andamento usa laranja; conclusão de aprendizagem usa oliva;
sucesso técnico não foi substituído.

### Fase 6: operação

O novo tema funcional alcança todas as superfícies Admin e Support através dos
tokens compartilhados. Foram feitos ajustes diretos em:

- cards de Cursos do Admin, que ficaram menos cromáticos;
- editor de template de Certificado, separando seleção de foco;
- aviso de conteúdo fora da área, agora semanticamente warning;
- upload e processamento, agora semanticamente informativos;
- avatar, sidebar, tabelas, métricas e controles compartilhados.

Financeiro, Auditoria e Operação não receberam marca como legenda de dados.

### Fase 7: limpeza e verificação

- Corrigidos testes que codificavam o antigo logo PROTEA-R global.
- Adicionado contrato de tokens em
  [brand-token-contract.test.tsx](../src/components/ui/brand-token-contract.test.tsx).
- Atualizado o teste do editor para o novo foco de duas camadas.
- Mantidos fora do escopo e sem alteração: e-mails, schema, migrations,
  renderização de PDF e cores persistidas de templates.

## Onde as alterações são visualmente perceptíveis

### Em todas as páginas

- Texto principal mais quente, próximo da areia da marca.
- Cards, muted e bordas menos azulados e mais neutros.
- Botões primários, links de alta intenção e ações principais em laranja.
- Foco de teclado mais claro e visível.
- Seleção de texto e controles com papel próprio.
- Sidebar com estados ativos menos dependentes de `primary`.

### Auth

Rotas `/entrar`, `/cadastro`, `/recuperar-senha` e `/redefinir-senha`:

- logo NeuroCapacitar em vez do asset global de PROTEA-R;
- moldura arredondada e mídia institucional da plataforma;
- maior contraste entre mídia, formulário e shell.

### Compra e Checkout

Rotas `/comprar/[slug]`, `/checkout/sucesso` e `/app/checkout/sucesso`:

- logo da plataforma no topo;
- card de compra com borda e raio mais refinados;
- CTA principal laranja;
- estados de indisponibilidade, interesse, processamento e retry dentro da
  mesma hierarquia visual.

### Student

- cards de Curso com ação e hover mais quentes;
- andamento em laranja;
- conclusão em oliva;
- LessonCard com badge “Em andamento” laranja e “Concluída” oliva;
- barra de vídeo/processamento usando estado informativo;
- links e foco mais visíveis.

### Certificados

- logo global na página pública;
- status “válido” continua semântico em verde;
- status “em preparação” usa warning, não accent decorativo;
- ações de download/compartilhamento seguem a nova hierarquia de botão.

### Admin e Support

- Cursos do Admin com hover e fallback menos saturados;
- ações primárias em laranja;
- métricas e tabelas com texto areia e superfícies neutras;
- seleção/foco do editor de certificado separados visualmente;
- upload, processamento e avisos com papéis informativos/warning;
- Financeiro, Auditoria e Operação preservam semântica própria.

### Fixture interna

Em `/admin/configuracoes/design-system`, a equipe pode revisar:

- anchors da marca;
- botões e links;
- badges neutras, técnicas e de aprendizagem;
- progresso ativo e completo;
- input/foco;
- tabs;
- superfície operacional e superfície quente.

## Verificação executada

- `bun install --frozen-lockfile`: 550 pacotes instalados.
- `bun run check`: passou.
- `bun run typecheck`: passou.
- `bun run docs:check`: passou; 47 documentos canônicos válidos.
- Testes focados iniciais: 42/42 passaram.
- Testes focados de regressão após ajustes: 46/46 passaram.
- Suíte completa: 418 arquivos, 2.899 testes, 0 falhas.
- `NEXT_PUBLIC_APP_URL=http://localhost:3000 bun run build`: passou.
- `git diff --check`: sem erros de whitespace.

A primeira tentativa de build sem `NEXT_PUBLIC_APP_URL` falhou pela validação
esperada de ambiente de produção; a segunda tentativa com a URL explícita
passou compilação, TypeScript, coleta de páginas e otimização.

## Limites restantes

- A inspeção visual manual em navegador não foi executada; a fixture foi
  criada e o build/testes confirmam sua integração, mas a revisão humana de
  viewport estreito e contraste deve ser feita ao abrir a rota em ambiente
  autorizado.
- `DESIGN.md` mantém o `last_verified_commit` canônico anterior porque esta
  implementação ainda não foi commitada; o hash deve ser atualizado no commit
  de integração.
- O relatório original e os arquivos de pesquisa permanecem como artefatos de
  referência; não foram sobrescritos.
- A branch ainda não foi commitada ou integrada, conforme a autorização atual.

## Refinamentos posteriores

Após a primeira implementação, a revisão Impeccable orientou uma segunda
passada:

- `button-primary` permaneceu petróleo, enquanto `primary` continuou laranja
  para ênfase, seleção e progresso;
- o texto principal passou a usar um creme claro já próximo da areia;
- `support-foreground` foi refinado para um teal-sage transicional, mais harmônico com o petróleo;
- cards, muted, secondary e sidebar foram reposicionados entre a escala original
  e a primeira proposta terrosa;
- títulos Auth usam o papel tipográfico explícito `CardTitle variant="page"`;
- foco de inputs e links foi unificado com o tratamento creme claro;
- erros de login usam status persistente e associação acessível aos campos;
- o AuthShell limita a altura mínima à viewport disponível em mobile;
- links e inputs passaram a usar a mesma receita de foco;
- falhas de login passaram a permanecer no fluxo com associação aos campos;
- a fixture passou a comparar papéis e estados reais, sem duplicar colunas.

O relatório completo da revisão está em
[neuro-brand-impeccable-review.md](./neuro-brand-impeccable-review.md).
