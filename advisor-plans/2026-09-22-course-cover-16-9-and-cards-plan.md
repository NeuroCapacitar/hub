---
status: implemented
owner: product-and-engineering
document_type: implementation-plan
date: 2026-09-22
baseline: 3cc70ac6572582354b9f353ae91810f666f3fd10
---

# Plano: capa 16:9 e CourseCards horizontais

> Execução autorizada pelo produto em 2026-09-22. Seguir as etapas e gates
> abaixo; preservar alterações externas fora do escopo.
> Baseline revisado: `feature/small-changes`, commit
> `3cc70ac6572582354b9f353ae91810f666f3fd10`.

## Objetivo

Usar uma única imagem 16:9 de Curso no catálogo do Aluno, no catálogo Admin e
como fallback visual das Aulas. A capa deixa de ser recortada de forma diferente
em cada CourseCard; o LessonCard passa de 16:10 para 16:9. Aluno e Admin usam a
mesma composição horizontal, com imagem à esquerda e informações/ações à direita.

## Decisões ratificadas em 2026-09-22

- Arquivo final único: WebP `1280 × 720`, proporção 16:9.
- Não persistir o arquivo bruto selecionado nem metadados de crop.
- Não gerar `thumb` nem outra variante para novos uploads.
- Manter o limite de 4 MB para o arquivo enviado/cortado; remover o teto de
  950 KB para a imagem gerada. Dimensões fixas e codificação WebP continuam
  limitando o resultado sem esse teto.
- Preservar as imagens antigas no R2. Exibi-las temporariamente em moldura 16:9
  com `object-cover` centralizado; o designer substituirá as capas depois. Não
  executar migração em massa nem sobrescrever os objetos existentes.
- Aluno e Admin usam a mesma estrutura de card; duas colunas no desktop quando
  a largura real do conteúdo comportar, uma coluna em telas/contêineres menores.
- Em desktop: mídia 16:9 à esquerda; status, conteúdo, progresso e ações à
  direita. Em mobile: mídia acima do conteúdo.
- Descrição do Curso volta apenas ao card do Aluno, limitada a duas linhas.
- Admin não mostra a descrição; mantém status, título, módulos/aulas, validade,
  preço e ação de gerenciamento/consulta.
- Os botões ficam junto das informações na coluna direita, depois do conteúdo
  relacionado. Cada estado mantém suas ações e destinos atuais.
- Sem redesenhar Checkout, oferta, agrupamento de Cursos, regra de acesso ou
  estado comercial. Esses consumidores de capa recebem uma checagem de
  compatibilidade, mas mantêm suas composições próprias.

## Evidências do estado atual

- `src/features/storage/course-cover.ts` define `960 × 1000` e duas variantes:
  `thumb` e `card`.
- `src/features/courses/course-cover-crop.ts` gera o recorte no navegador;
  `course-cover-upload.ts` persiste um objeto chamado `original` e gera as duas
  variantes. Esse `original` já é o arquivo recortado pelo navegador; não é a
  imagem bruta escolhida antes do crop.
- `src/app/(student)/app/(dashboard)/page.tsx` e
  `src/app/(admin)/admin/cursos/page.tsx` usam CourseCards 24:25. O card atual
  do Aluno não mostra descrição nesta baseline.
- `src/components/ui/lesson-card.tsx` usa moldura 16:10, e
  `course-overview-client.tsx` passa a capa do Curso como fallback quando a
  Aula não tem thumbnail própria.
- `src/features/courses/course-cover-image.tsx` usa `next/image` com
  `unoptimized`; um único arquivo é enviado inteiro também nos cards menores.
- `getCourseCoverStorageKeys` e `publishCourseCover` em
  `src/features/admin/authoring.ts` incluem as chaves persistidas atuais. O
  parser e a rota de capa precisam continuar lendo registros legados.
- O relatório revisado usava o commit `4320118`; suas referências de descrição,
  opacidade e composição não substituem a evidência da baseline acima.

## Sequência de implementação

### Etapa 0 — preflight e revisão operacional

1. Confirmar baseline e árvore limpa na worktree; preservar alterações externas
   que não pertençam a este plano.
2. Reabrir os arquivos citados e reler
   `docs/operations/code-review-with-coderabbit.md` antes de alterar código,
   conforme o procedimento do projeto.
3. Confirmar os consumidores reais de capas e os contratos de `coverImage` no
   read model, nas Server Actions, na publicação e na limpeza de objetos.
4. Não acessar ou alterar bancos, buckets persistentes, Staging ou Production.

**Gate:** a execução para se o parser, lifecycle R2 ou destino das ações tiver
mudado desde o baseline sem uma decisão correspondente.

### Etapa 1 — contrato de mídia único e compatibilidade de dados

Arquivos principais:

- `src/features/storage/course-cover.ts`
- `src/features/storage/course-cover-upload.ts`
- `src/features/storage/r2.ts`
- `src/features/admin/authoring.ts`
- `src/app/api/courses/[courseId]/cover/[variant]/route.ts`

Trabalho:

1. Definir o recorte canônico em `1280 × 720` e gerar somente a saída WebP
   `card`. Não criar objeto persistente `original`, `thumb` ou crop metadata.
2. Preservar o limite de 4 MB do upload. Remover somente o limite de 950 KB da
   saída; manter validação de tipo, dimensões declaradas, conteúdo e erros do
   processamento Sharp.
3. Tornar o parser compatível com ambos os formatos JSON: legado (`original`,
   `thumb` e `card`) e novo (somente `card` mais blur opcional). Não exigir o
   campo `original` para uma capa nova.
4. Para uploads novos, publicar e servir somente a chave `card`. Continuar
   aceitando o alias de rota `thumb` para registros/URLs legados e encaminhá-lo
   à `card` quando não houver thumb.
5. Publicar somente as variantes visuais; manter a enumeração completa de
   chaves para limpeza. Objetos legados (`original`, `thumb`, `card`) continuam
   removíveis quando um Curso os substitui, sem tornar esses campos
   obrigatórios para novas capas.
6. Remover `getCourseCoverBackgroundImage` se a revisão confirmar que continua
   sem consumidor de produto; ele constrói um `image-set` `thumb`/`card`, hoje
   usado apenas por teste.
7. Manter URLs versionadas e blur placeholder; nova troca de capa continua
   mudando a chave da variante para invalidar o cache.

**Gate:** uma capa nova produz um único objeto público 1280×720; capas JSON
legadas continuam parseáveis e seus objetos não são removidos por simples
leitura ou renderização.

### Etapa 2 — cropper e formulários administrativos

Arquivos principais:

- `src/features/courses/course-cover-crop.ts`
- `src/features/courses/course-cover-crop-dialog.tsx`
- `src/components/course-cover-upload-field.tsx`
- `src/app/(admin)/admin/cursos/course-creation-form.tsx`
- `src/app/(admin)/admin/cursos/[courseId]/course-dialogs-client.tsx`

Trabalho:

1. Mudar proporção, canvas e orientação do cropper para 16:9 e 1280×720.
2. Trocar a copy de 24:25 por 16:9 e `1280 × 720`; manter a orientação de
   formato/tamanho de upload de 4 MB.
3. Exibir a prévia de capa em 16:9. Ajustar a seção de criação e a prévia
   somente o necessário para não esticar a arte nem criar altura vazia; não
   alongar a imagem para combinar com os campos.
4. Preservar o fluxo de upload temporário já existente. O arquivo original
   selecionado existe apenas durante a interação no navegador; após o crop,
   somente a rendition final é persistida e o objeto temporário é reconciliado
   pelo fluxo atual.
5. Trocar a prévia administrativa somente leitura de 24:25 para 16:9.

**Gate:** crop, prévia, edição e criação do Curso mostram a mesma composição
16:9; uma imagem antiga pode ser substituída sem criar objeto raw persistente.

### Etapa 3 — CourseCards do Aluno e Admin

Arquivos principais:

- `src/app/(student)/app/(dashboard)/page.tsx`
- `src/app/(admin)/admin/cursos/page.tsx`
- `src/app/(admin)/admin/cursos/loading.tsx`
- `src/components/page-container.tsx` somente se a grade exigir ajuste
  comprovado; não alterar o contêiner global por antecipação.

Trabalho:

1. Substituir o poster 24:25 por card de altura natural, com uma coluna de mídia
   16:9 à esquerda e uma coluna de conteúdo à direita. Não fazer a imagem
   preencher a altura do card com crop vertical.
2. Usar duas colunas quando houver largura útil suficiente; reflow para uma
   coluna quando a sidebar e o padding deixarem os cards estreitos. Basear o
   reflow na largura disponível, não somente na largura nominal do viewport.
3. Aluno: status, título, descrição de até duas linhas, metadados,
   progresso e ações na coluna direita. Preservar matrícula, compra,
   autoinscrição, interesse, suporte e destinos de navegação por estado.
4. Admin: status, título, módulos/aulas, validade, preço e CTA de
   gerenciamento/consulta na mesma estrutura; não renderizar descrição.
5. Manter o estado visual, radius, paleta, hover e comportamento atuais salvo
   ajustes estritamente necessários para a nova geometria. Usar os tokens
   semânticos existentes (`rounded-surface`, `rounded-media`).
6. Adaptar o tile “Novo curso” à nova grade sem transformá-lo numa ação solta;
   manter o fluxo atual de criação.
7. Atualizar skeleton do catálogo Admin para a mesma geometria. Não alterar
   skeletons de Continue Learning que representem outro componente.

**Gate:** Aluno e Admin compartilham a mesma composição visual, mas cada perfil
conserva seus dados e ações. Nenhum estado atual perde affordance nem destino.

### Etapa 4 — moldura das Aulas e consumidores adjacentes

Arquivos principais:

- `src/components/ui/lesson-card.tsx`
- `src/app/(student)/app/cursos/[courseId]/course-overview-client.tsx`
- `src/app/(student)/app/aulas/loading.tsx` (já usa `aspect-video`; confirmar
  se não requer alteração)
- `src/app/(student)/app/(dashboard)/continue-learning-card.tsx`
- `src/features/courses/course-offer-dialog.tsx`
- `src/app/(student)/app/checkout/sucesso/checkout-access-waiter.tsx`

Trabalho:

1. Mudar a moldura visual do LessonCard de 16:10 para 16:9. Preservar
   `object-cover` para thumbnails próprios de Aula e permitir que a capa 16:9
   ocupe o fallback sem crop adicional.
2. Manter estados bloqueados, progresso assistido, hover e não-interatividade
   exatamente como são.
3. Conferir continue-learning, oferta e conclusão de checkout como consumidores
   adjacentes. Não redesenhar essas superfícies; aceitar seus crops de fundo
   intencionais, desde que não haja distorção, regressão de loading ou 404.
4. Ajustar o pequeno contexto de Curso em checkout-access-waiter.tsx de 1:1
   para 16:9; ele usa a capa como miniatura de reconhecimento, não como fundo.
5. A renderização de uma capa antiga em qualquer novo frame 16:9 é um crop
   central somente visual. Não reprocessar nem sobrescrever objetos R2 antigos.

**Gate:** o fallback de Aula usa a capa 16:9 sem crop; thumbnails próprias e
composições de fundo existentes continuam funcionais.

### Etapa 5 — documentação e verificação

Documentos:

- `docs/integrations/r2.md`
- `DESIGN.md`

Atualizar o contrato de capa para 16:9, 1280×720, saída única `card`, ausência
de armazenamento raw/crop metadata, limite de upload de 4 MB e preservação
transitória de registros legados. Deixar claro que banners, autenticação,
certificados e outros assets conservam suas proporções próprias.

Verificações previstas para a execução:

- testes de crop: saída 1280×720 e WebP;
- testes de storage: uma chave `card` nova, ausência de raw/thumb novo,
  limite de upload mantido e ausência do teto de 950 KB;
- testes de parser/rota/lifecycle: JSON legado e JSON novo, alias `thumb`,
  publicação e limpeza de chaves antigas;
- testes dos CourseCards: descrição só no Aluno, estados, CTAs, links e layout
  de ambas as permissões;
- testes de LessonCard: frame 16:9 e estados de Aula preservados;
- `bun x ultracite fix`, `bun run check`, `bun run typecheck` e
  `bun run docs:check` após editar documentação;
- CodeRabbit conforme o runbook; se indisponível, registrar a razão.

Não acessar localhost com ferramenta visual. Após a execução, informar ao
produto como abrir o servidor e quais rotas revisar por conta própria.

## Critérios de aceite

- Upload novo gera e persiste apenas uma imagem WebP 1280×720 em 16:9.
- Arquivo bruto e coordenadas de crop não persistem; o limite de entrada de
  4 MB continua ativo; a saída não é rejeitada por passar de 950 KB.
- Registros existentes permanecem válidos e não sofrem escrita/migração em
  massa; a exibição central pode cortar temporariamente as capas 24:25 antigas.
- Cards de Aluno e Admin têm mídia à esquerda, conteúdo/ações à direita em
  desktop, duas colunas quando couber e reflow em contêiner estreito.
- A descrição aparece só no card do Aluno; CTAs ficam na coluna direita.
- LessonCard usa 16:9 e exibe o fallback 16:9 sem crop.
- O mini contexto visual do Curso no aguardo de acesso não corta a capa nova em
  uma moldura quadrada.
- Disponibilidade, matrícula, bloqueio, progresso, compra, inscrição gratuita,
  interesse, suporte e gerenciamento continuam com os mesmos significados.
- Skeletons alterados correspondem ao layout final; não há scroll horizontal.
- Documentação descreve o comportamento e lifecycle atuais.

## Fora do escopo

- Redesenhar CourseOfferHero, Checkout ou Continue Learning.
- Gerar arte nova de fallback, copiar a geometria do screenshot ou mudar a
  identidade da plataforma.
- Criar variants por pixel density, crop metadata, um subsistema de migração,
  migration SQL ou um novo primitive genérico para toda mídia.
- Reprocessar/delete em lote qualquer objeto R2 legado.
- Reorganizar estados de Curso ou mudar rotas, regras de acesso e CTAs.

## Riscos e mitigação

- **Capas legadas ficam temporariamente cortadas:** perda visual estimada em
  torno de 46% da altura ao exibir 24:25 em 16:9. Aceito pelo produto; corte é
  apenas de apresentação e as capas serão substituídas pelo designer.
- **Um arquivo serve superfícies de tamanhos diferentes:** `CourseCoverImage`
  é `unoptimized`, então superfícies pequenas recebem o arquivo inteiro. O
  produto escolheu simplicidade e catálogo pequeno; manter compressão WebP e
  reavaliar apenas se houver evidência de custo/performance.
- **JSON legado contém campos removidos do formato novo:** parser, rota e
  limpeza precisam aceitar os dois formatos durante a vida das capas atuais.
- **Conteúdo/ações comprimidos em viewports estreitos:** usar uma coluna antes
  de truncar informação ou reduzir controles; medir a largura do contêiner com
  sidebar aberta.

## Pesquisa de apoio

- [Teachable — Image size guide](https://support.teachable.com/en/articles/11682492-image-size-guide)
- [Circle — Configure lesson settings](https://help.circle.so/p/courses/course-setup/configure-lesson-settings)
- [LearnWorlds — Course cards](https://support.learnworlds.com/support/solutions/articles/12000041917-how-to-customize-the-course-cards-of-your-courses)
- [NN/g — Cards component](https://www.nngroup.com/articles/cards-component/)
- [MDN — `object-fit`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/object-fit)

## Relatório da implementação

Implementação concluída na worktree `feature/small-changes`; as alterações
continuam sem commit, conforme o escopo autorizado.

- Capa única WebP 1280×720, sem objeto raw/thumb novo; validação de upload de
  4 MB mantida e limite de 950 KB removido da saída.
- Capas antigas continuam no R2 e são exibidas com crop central apenas visual.
- Aluno e Admin usam o layout horizontal compartilhado; descrição somente no
  Aluno; Aulas usam moldura 16:9.
- Compatibilidade de leitura e limpeza dos metadados legados preservada.
- CodeRabbit 0.7.6 revisou o diff contra `origin/staging`: um achado menor sobre
  a copy na prévia 16:9 foi corrigido; nenhum outro achado foi retornado.

Validação concluída:

- `bun run verify:quick`: migrations, typecheck, Ultracite e 3.253 testes
  passaram (464 arquivos de teste).
- `bun run build`: Next.js 16.3.3 compilou e gerou as rotas.
- `bun run docs:check`: 51 documentos canônicos válidos.
- Detector de layout Impeccable: sem achados.
- `git diff --check`: sem erros de whitespace.

O gate completo `bun run verify` passou pelos documentos, migrations,
typecheck, lint, testes e build, mas terminou com código 1 no Knip: três exports
não utilizados em `src/components/reui/frame.tsx` e 20 sugestões de configuração.
Esse arquivo e essa configuração não foram alterados nesta implementação.
Não houve inspeção visual abrindo localhost, conforme a instrução do projeto.
