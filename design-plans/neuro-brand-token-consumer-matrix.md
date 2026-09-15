# Matriz de consumidores de tokens NeuroCapacitar

> Status: implementado como inventário documental e guardrail da execução
> Owner: design-and-engineering
> Baseline verificado: `ef34238`
> Fonte dos valores: `src/app/globals.css`
> Escopo: UI web estática em `src/`, sem alterar consumidores nesta rodada

## Objetivo

Esta matriz é o guardrail da migração visual. Ela registra o papel que cada
token exerce hoje, o owner do consumidor e os usos que ainda precisam de
refinamento. Não é uma segunda fonte de valores: os valores executáveis vivem
em `src/app/globals.css`; as regras de uso vivem em `DESIGN.md`.

Uma nova utilização de `primary`, `accent` ou de um anchor `brand-*` deve ser
classificada nesta matriz antes de ser adicionada. O fato de uma cor parecer
adequada não é motivo suficiente para reutilizar o token.

## Método e limites

O inventário foi conferido estaticamente contra os arquivos TypeScript,
TSX e CSS em `src/`, com foco nos usos diretos de `primary`, `accent`,
`brand-*`, `selection`, `focus`, progresso, sidebar e charts.

Foram excluídos falsos positivos sem relação com a UI:

- `primary key`, `primaryHref`, `primaryAction` e outros identificadores de
  domínio ou banco;
- valores de contratos de e-mail, PDF, banco, migração e mídia;
- cores pretas/brancas usadas como overlay de fotografia, vídeo ou editor;
- os valores declarados no próprio `globals.css`, que são a definição dos
  tokens, não consumidores de componentes.

Usos gerados dinamicamente por bibliotecas ou classes montadas fora desses
arquivos exigem revisão adicional quando forem introduzidos.

## Camadas e mapeamentos atuais

### Anchors de marca

| Anchor | Tokens funcionais que o referenciam | Uso autorizado atual |
|---|---|---|
| `brand-petroleum` | `button-primary`, `sidebar-primary` | ação institucional e navegação |
| `brand-cream` | `foreground`, foregrounds de superfícies, `button-primary-foreground`, `focus` | texto, ícones e foco; token derivado da aplicação, não anchor adicional do manual |
| `brand-sand` | `secondary-foreground`, `surface-warm`, `sidebar-primary-foreground` | apoio quente e superfície institucional rara |
| `brand-orange` | `primary`, `accent`, `link`, `progress-active`, `chart-2` | atenção, interação de marca, links e progresso ativo |
| `brand-olive` | `progress-complete`, `learning-complete`, `chart-3` | conclusão de aprendizagem e série de dados |
| `brand-terracotta` | `chart-4` | expressão editorial/dados; não representa erro |

Componentes não devem consumir esses anchors diretamente. A exceção
intencional é a paleta de amostras da fixture interna, que precisa exibir os
anchors para revisão humana.

### Tokens funcionais e owners

| Token/papel | Consumidores principais | Owner | Decisão atual |
|---|---|---|---|
| `background`, `card`, `popover`, `muted`, `secondary` | `Card`, `Dialog`, `Popover`, `PanelLayout`, páginas Student/Admin/Auth | primitives e shells compartilhados | superfícies estruturais; não usar cor de ação por conveniência |
| `foreground`, `card-foreground`, `popover-foreground` | texto geral, títulos, conteúdo de cards e diálogos | base e primitives | texto principal em creme derivado |
| `support-foreground`, `muted-foreground` | `CardDescription`, helpers, metadados, descrições, links secundários | base e superfícies | teal-sage de suporte; não usar como estado semântico |
| `button-primary`, `button-primary-foreground` | variante `default` de `Button`, amostra de ação principal na fixture | `src/components/ui/button.tsx` | botão padrão petróleo, estável durante a transição |
| `Button variant="accent"` | amostra “Ação destacada” da fixture; nenhum CTA de produção ainda | `src/components/ui/button.tsx` | ação laranja opt-in; exige consumidor aprovado antes de rollout |
| `primary`, `primary-foreground` | usos diretos classificados na seção seguinte, `Badge default` em consumidores ainda não migrados, `Badge progress`, indicador de tabs e amostras | primitives e superfícies específicas | laranja funcional; não é sinônimo de botão padrão |
| `accent`, `accent-foreground` | `DropdownMenu` em foco/abertura; hover de título em `LessonCard` | primitives e aprendizagem | laranja existente; não remapear para oliva |
| `text-selection`, `text-selection-foreground` | `::selection` | seleção textual | preserva os valores atuais; independente dos controles |
| `control-selected`, `control-selected-foreground` | `Calendar`, `Checkbox`, `RadioGroup`, `Switch`, `Slider.Range` | controles selecionados | preserva os valores atuais; independente da seleção textual |
| `selection`, `selection-foreground` | alias legado para `control-selected` | compatibilidade | não adicionar novos consumidores; remover somente em etapa de limpeza |
| `slider-thumb` | `SliderPrimitive.Thumb` | Slider | foreground do thumb inicialmente pareado com `control-selected-foreground`; não depende de `primary-foreground` |
| `focus`, `focus-foreground`, `ring` | receita canônica em `Button`, `Input`, `Tabs`, `Textarea`, `SelectTrigger`, `Checkbox`, `RadioGroupItem`, `Switch` e `ResourceItemDragHandle`; receita própria em Slider, Accordion, Table e Sidebar | primitives e editor | consumidores simples e geometrias próprias usam a mesma intenção semântica, preservando suas áreas de interação |
| `link` | `Button`/`Badge` link, `Empty`, `Field`, controles de tipo de Aula e `.lesson-rich-text a` | primitives e conteúdo | links de alta intenção; rich text usa `var(--link)` para não herdar ação primária por acidente |
| `progress-active` | `Progress`, `LessonCard`, upload/processamento JMVStream | aprendizagem e processamento | andamento mensurável em laranja |
| `progress-complete` | `Progress` com `tone="complete"` | `src/components/ui/progress.tsx` | conclusão visual de barra; separado de `success` técnico |
| `learning-complete` | `Badge variant="learning"` em `LessonCard` | aprendizagem | conclusão de Curso/Aula em oliva |
| `surface-warm` | amostra da fixture | design-system preview | superfície quente preparada para Auth, checkout e onboarding; sem uso global |
| `success`, `warning`, `info`, `destructive` | estados de Admin, Financeiro, upload, certificado e operação | features e primitives semânticos | estados técnicos; não substituir por cores decorativas da marca |
| `sidebar-*` | `Sidebar`, `PanelLayout` e navegação autenticada | shell compartilhado | navegação em escala própria; itens ativos preservam `sidebar-accent`, enquanto links não ativos usam `muted-foreground`; não herdar `primary` global |
| `chart-1` a `chart-5` | série de dados e fallback visual de `LessonCard` via `chart-4` | charts e aprendizagem | subpaleta discriminável; legenda e texto continuam necessários |

## Consumidores diretos de `primary`

`primary` resolve para `brand-orange` no HEAD verificado. Estes são os usos
diretos encontrados e sua classificação atual:

| Consumidor | Uso observado | Classificação | Owner/destino | Decisão |
|---|---|---|---|---|
| `src/components/ui/badge.tsx` — `badgeVariants`, `default` | fundo e foreground do Badge sem variante; o dashboard Student deixou de usá-lo para acesso | estado genérico; ainda usado para andamento e outros consumidores | Badge/Student | manter por compatibilidade; não remapear globalmente até inventariar todos os consumidores |
| `src/components/ui/badge.tsx` — `variant="progress"` | mesmo papel visual laranja com intenção explícita | progresso de aprendizagem | Badge/LessonCard/fixture | criado nesta unidade; migrado apenas para `Em andamento` |
| `src/app/(admin)/admin/cursos/[courseId]/certificate-template-editor.tsx` | template publicado → `default` | status operacional “Ativo” | Admin/Certificados | manter até decidir entre `secondary` e `success`; não é progresso |
| `src/app/(student)/app/certificados/certificate-list-view-model.ts` | certificado pronto → `badgeVariant: "default"` | disponibilidade técnica positiva | Student/Certificados | candidato a `success`; não usar `learning` automaticamente |
| `src/components/lesson-comments-section.tsx` | papel `admin` → `default` | identidade de papel | Student/Aula | candidato a `secondary` ou `info`; requer decisão de hierarquia de papéis |
| `src/components/ui/button.tsx` — `variant="accent"` | `bg-primary` e `text-primary-foreground` | ação laranja opt-in | Button/fixture | criado nesta unidade; sem consumidor de produção aprovado |
| `src/app/(student)/app/(dashboard)/page.tsx` — `CourseCard` | `Matriculado` → `secondary`; expiração → `warning`; conclusão → `learning`; indisponível → `outline` | acesso, atenção e conclusão de aprendizagem | Student dashboard | corrigido nesta unidade sem alterar `Badge default` |
| `src/components/ui/slider.tsx` — `SliderPrimitive.Thumb` | `bg-slider-thumb` no thumb | foreground do controle de faixa | Slider | corrigido nesta unidade; valor inicial referencia `control-selected-foreground` e pode evoluir sem alterar ações |
| `src/components/ui/tabs.tsx` — variante `line` | indicador ativo da tab | seleção de navegação | Tabs | uso classificado e mantido |
| `src/app/(student)/app/(dashboard)/page.tsx` — card de Curso | borda de hover e gradiente sutil | presença da marca em aprendizagem | Student CourseCard | uso intencional; manter Student mais quente que Admin |
| `src/app/(student)/app/(dashboard)/student-banners-carousel.tsx` — CTA de banner | botão contextual do banner | ação de conteúdo Student | Student banner | uso local; não representa o botão primário global |
| `src/app/(admin)/admin/configuracoes/banners/banner-gallery.tsx` — `ResourceListContainer` | borda/fundo durante arraste | drag/upload state | Admin banner upload | válido como feedback de interação; pode receber token de drag próprio futuramente |
| `src/components/certificate-image-upload-field.tsx` — estado `data-dragging` | borda/fundo durante arraste | drag/upload state | upload de certificado | válido como feedback; não confundir com sucesso de upload |
| `src/app/(admin)/admin/cursos/[courseId]/certificate-template-preview.tsx` — preview | seleção de fundo/campo, handle, label e snap guides | seleção/drag state do editor | CertificateTemplatePreview | uso local; candidato a tokens de seleção/foco do editor, não a `button-primary` |
| `src/components/design-system-preview.tsx` — amostra “Ação de atenção” | demonstração do papel | fixture interna | Design-system preview | exceção intencional e documentada |

O link de rich text foi retirado desta lista nesta unidade e agora está
registrado como consumidor de `link`.

Os usos de `primary` acima não são equivalentes. Uma alteração de `--primary`
deve ser avaliada separadamente para Badge, tabs, Student, drag state, editor,
links e fixture.

### Inventário restante de `Badge default`

O inventário estático não encontrou `<Badge>` sem `variant` em superfícies de
produção. Os consumidores restantes são explícitos ou derivados de view models:

- `certificate-template-editor.tsx`: “Ativo” para template publicado;
- `certificate-list-view-model.ts`: “Disponível” para PDF pronto;
- `lesson-comments-section.tsx`: “Admin” como papel de autora;
- `LessonCard` e a fixture já usam `progress` para “Em andamento”;
- o dashboard Student já usa `secondary`, `warning`, `learning` e `outline`
  conforme o estado de acesso.

Os três casos não devem ser migrados por aparência. Cada um precisa de uma
decisão semântica própria antes de tornar `Badge default` neutro.

## Consumidores diretos de `accent`

`accent` também resolve para laranja, mas tem responsabilidades distintas:

| Consumidor | Uso observado | Classificação | Decisão |
|---|---|---|---|
| `src/components/ui/dropdown-menu.tsx` — itens e submenus | `focus:bg-accent`, `data-open:bg-accent` e foreground pareado | foco/seleção de menu | manter durante a transição; revisar junto da futura unificação geométrica de foco |
| `src/components/ui/lesson-card.tsx` — título em hover | `group-hover:text-accent` | hover de aprendizagem | manter como acento de interação; não transformar em conclusão |

`sidebar-accent` é outro token, próprio da navegação, e não deve ser contado
como consumidor de `accent` global.

## Seleção, foco e estados de aprendizagem

| Papel | Consumidores verificados | Risco conhecido | Próxima decisão, fora desta rodada |
|---|---|---|---|
| `text-selection` | `::selection` | fundo opaco laranja e foreground petróleo mantêm contraste no texto selecionado | manter separado dos controles e validar renderização |
| `control-selected` | `Calendar`, `Checkbox`, `RadioGroup`, `Switch`, `Slider.Range` | fundo opaco laranja e foreground petróleo mantêm distinção nos estados selecionados | manter separado da seleção textual e validar renderização |
| `slider-thumb` | `SliderPrimitive.Thumb` | token de componente agora separado de `primary-foreground` | parear com `control-selected-foreground` |
| `focus`/`ring` | `Button`, `Input`, `Tabs`, editor de certificado, `Select`, `Textarea`, `Checkbox`, `RadioGroup`, `Switch`, `ResourceItemDragHandle`, Slider, Accordion, Table e Sidebar | consumidores simples usam a receita canônica; exceções usam border/outline/ring próprios para preservar geometria | manter a separação e testar cada primitive em teclado |
| `progress-active` | `Progress`, `LessonCard`, painel de upload/processamento | estado pode ser confundido com ação se usado fora de aprendizagem/processamento | preservar owner e rótulo/valor |
| `progress-complete` | `Progress tone="complete"` | não deve virar sucesso técnico automaticamente | manter separado |
| `learning-complete` | `Badge variant="learning"` no `LessonCard` | sem risco se rótulo acompanha a cor | manter oliva para conclusão de aprendizagem |

## Exceções e regras de manutenção

1. `src/app/globals.css` pode referenciar anchors para construir tokens
   funcionais; essa é a camada de mapeamento, não um consumidor de UI.
2. `src/components/design-system-preview.tsx` pode exibir `brand-*`
   diretamente nas amostras de paleta; a exceção existe para inspeção humana.
3. Overlays de fotografia, vídeo e canvas podem usar preto/branco ou alpha
   quando a função for legibilidade sobre conteúdo visual, não expressão de
   marca.
4. Estados técnicos devem continuar com texto, ícone, valor ou status
   programático. A matriz não autoriza comunicar um estado somente por cor.
5. Cada novo uso direto de `primary`, `accent` ou `brand-*` deve acrescentar
   uma linha nesta matriz com arquivo/símbolo, intenção, owner e justificativa.
6. Alterar um token funcional exige revisar os consumidores listados, a fixture
   e os pares de contraste das superfícies afetadas.

## Gate desta unidade

- Todos os usos diretos estáticos relevantes de `primary` e `accent` estão
  classificados.
- Os usos residuais foram registrados como pendências, sem serem alterados
  silenciosamente.
- O link existente no relatório de implementação agora aponta para um arquivo
  real.
- Os consumidores de foco e links foram atualizados sem alterar a API pública
  dos primitives.
- A fixture cobre os primitives de maior risco e os estados de upload, tabela,
  vazio, menu, diálogo, avatar e link.
