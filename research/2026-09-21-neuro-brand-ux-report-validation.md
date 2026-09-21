# Validação do relatório de direção visual do Hub

> Status: revisão read-only; nenhum código foi alterado.
> Worktree auditada: `feature/small-changes` em `8ecf677b`.
> Relatório analisado: `C:\Users\Junior\Desktop\relatorio de ux.md`.

## Veredito

O relatório é uma boa direção de produto, mas não deve ser tratado como uma
auditoria visual conclusiva nem executado literalmente. Ele identifica uma
oportunidade real: a fundação da marca existe, porém a Aprendizagem ainda usa
uma composição muito próxima do padrão “título + cards + metadados”. O texto
extrapola quando transforma sensação em fato, números de design em decisões
finais e referências visuais sem URL em evidência de mercado.

Há também drift de baseline: o relatório declara ter analisado `65e6634` (PR
#233), enquanto esta worktree está em `8ecf677b` e o Staging avançou pelo PR
#236. As conclusões de direção continuam úteis; as afirmações sobre o estado
literal das telas precisam ser confirmadas no código atual.

## Recomendações que valido e implementaria

1. **Personalidade por composição, não por mais cores ou efeitos.** Validado.
   `globals.css` já separa petróleo, creme, areia, laranja, oliva e terracota,
   enquanto `DESIGN.md` diferencia Aprendizagem de Operação. A próxima etapa
   deve dar mais escala, imagem e hierarquia a poucos momentos importantes,
   sem transformar Admin, Financeiro e Auditoria em superfícies promocionais.

2. **Dashboard do Aluno orientado ao próximo passo.** Validado e prioritário.
   `src/app/(student)/app/(dashboard)/page.tsx:67` calcula `_nextCourse`, mas
   não o utiliza; a tela continua organizada principalmente por seções de
   catálogo (`:76`). Implementaria um bloco “Continue de onde parou” para o
   próximo Curso/Aula, com capa existente, progresso, contexto da próxima Aula
   e uma única ação principal. Os demais Cursos permanecem abaixo; não criaria
   quatro KPIs para preencher o primeiro viewport.

3. **Página do Curso com presença editorial moderada.** Validado como segundo
   foco. O header atual (`src/app/(student)/app/cursos/[courseId]/page.tsx:135`)
   expõe título, descrição, aulas, carga horária, progresso e CTA, mas não usa a
   capa do Curso. Um hero compacto com capa, progresso e continuidade pode dar
   identidade sem esconder a trilha. O conteúdo, os números e o CTA devem
   permanecer; a proposta não justifica uma tela de marketing.

4. **Reduzir cards aninhados e bordas repetidas no Admin.** Validado com
   evidência direta. `IssueGroup` é um `Card` com `IssueRow` novamente bordada
   em `src/app/(admin)/admin/(dashboard)/page.tsx:642` e `:670`; o catálogo
   repete o padrão em `:712` e `:743`. Simplificaria agrupadores usando espaço,
   alinhamento e listas; manteria bordas onde elas ajudam a comparar linhas,
   preservar foco ou delimitar uma tabela. Não removeria todas as bordas em
   lote.

5. **Densidade por registro.** Validado como regra, não como pacote de números.
   O Aluno já usa intervalos mais amplos e o Admin mais compactos. Formalizaria
   isso primeiro em dois protótipos reais; só depois decidiria se `PageContainer`
   precisa de uma prop de densidade. Não adotaria automaticamente os valores
   `36–40`, `48–56` e `24–28px` do relatório.

## Recomendações válidas, mas que exigem experimento

- **Radius por papel:** a percepção de rigidez é plausível. Porém, o token atual
  é `--radius: 0.25rem` (`src/app/globals.css:163`), e `Card`/`Button` e vários
  primitives dependem dele. Testaria primeiro cards de Aprendizagem, hero e
  certificado; não mudaria a escala global sem comparar menu, input, diálogo,
  sidebar e tabelas.
- **Menos movimento nos cards:** reduzir `scale-105` no CourseCard e no
  LessonCard é um refinamento de baixo risco (`student/page.tsx:349`,
  `lesson-card.tsx:91`), mas não é a mudança que dará personalidade sozinha.
  O `scale-110` do play button também deve ser avaliado por estado e foco.
- **CTA do Aluno um pouco maior:** faz sentido apenas para a ação primária de
  continuar/iniciar; não para todos os botões. WCAG 2.2 estabelece 24×24 CSS px
  como mínimo AA com exceções, não 40–44px como obrigação.
- **Remover divisores entre Módulos:** o relatório sugere trocar o `hr` em
  `course-overview-client.tsx:326` por whitespace. É uma hipótese visual; o
  divisor também comunica separação de Módulos. Comparar uma versão com espaço
  e uma com divisor antes de remover.
- **Certificados mais celebratórios:** a intenção é correta, sem confete,
  medalhas ou gamificação. A composição atual em `certificate-card.tsx` é
  funcional e deve receber apenas uma hierarquia mais humana, preservando
  status técnico, titular, carga horária, código e ações.
- **Auth mais expressivo:** o split atual já tem logo, mídia administrável e
  `AuthMediaSlot` (`src/components/auth-shell.tsx:21-50`). Um frame externo ou
  copy institucional adicional deve ser um mock isolado; não aplicar moldura
  global antes de verificar mobile, altura e peso visual.
- **Surface warm:** o token existe, mas é deliberadamente raro. Usaria uma
  única aplicação controlada em conclusão/certificado ou onboarding, sempre com
  contraste verificado. Não espalharia areia por cards comuns.

## Recomendações que rejeito ou corrijo

- **`--radius: 0.25rem → 0.5rem` como primeira mudança global:** rejeitado.
  Fluent usa uma escala por forma e tamanho, não prova que 8px seja correto
  para todos os componentes. No Hub, a troca também alteraria consumidores
  `rounded-2xl`/`rounded-3xl` de menus e superfícies portadas. A decisão correta
  é por componente, depois de prototipar.
- **Blobs, glow, gradientes ou formas orgânicas novas para “dar marca”:**
  rejeitado no estado atual. `DESIGN.md` proíbe decoração como substituto de
  hierarquia; os únicos assets aprovados são logo, mídia institucional e capas.
  Uma nova forma de marca exige asset oficial e decisão própria.
- **Adicionar KPIs, streaks, ranking, XP ou dashboard pessoal cheio de dados:**
  rejeitado. O próprio relatório reconhece que métricas só ajudam quando
  orientam uma próxima decisão. O produto deve responder “onde estou, quanto
  avancei e o que faço agora”.
- **Aumentar o header global para 68–72px:** rejeitado por enquanto. O header é
  shell compartilhado entre registros diferentes; a mudança não resolve a
  ausência de foco composicional no Aluno e aumenta risco global.
- **Transformar tabelas Admin em cards confortáveis:** rejeitado. Financeiro,
  Auditoria, Operação e Aprendizagem precisam de comparação densa, alinhamento
  e evidência. O relatório acerta ao preservar essa austeridade.
- **“As 15 referências comprovam” o diagnóstico:** não validável como escrito.
  O arquivo cita princípios e nove fontes, mas não contém URLs ou identificadores
  das 15 referências visuais. É possível aproveitar os princípios, não afirmar
  que cada composição é uma prática de mercado comprovada.
- **Analytics de drop-off e objetivos pessoais agora:** não implementar nesta
  rodada. São hipóteses de produto, não apenas refinamentos visuais; exigem
  confirmar dados, privacidade, utilidade e decisão de produto.

## O que o projeto já atende

- Compra/handoff já possui hero com capa, resumo e superfície `rounded-2xl` em
  `src/features/courses/course-offer-page.tsx:45` e
  `src/features/courses/course-offer-dialog.tsx:37`; não é necessário duplicar
  essa proposta no checkout.
- Estados do sistema já usam uma superfície calma e consistente em
  `src/components/system-state-shell.tsx:9`.
- A Aula já preserva foco de leitura em `max-w-[68ch]`, com conteúdo acima de
  ornamentação.
- A distinção semântica de tokens, progresso de Aprendizagem e densidade já
  está documentada; não é necessário criar outra biblioteca visual.

## Ordem recomendada

1. Desenhar/prototipar três superfícies: Home do Aluno, página do Curso e
   agrupamento de pendências do Admin.
2. Implementar apenas a composição do próximo passo e a redução de nesting,
   preservando dados, permissões e rotas.
3. Refinar radius, hover, CTA e certificados com base no resultado dessas telas.
4. Só então considerar novas features de analytics.

## Conclusão

Concordo com a direção, não com a execução literal. O relatório encontrou a
melhor oportunidade no eixo **composição + hierarquia + contexto da próxima
ação**, não em trocar fonte, tema, biblioteca ou pintar mais cards. O próximo
trabalho deve ser um refinamento controlado de Aprendizagem e uma limpeza
estrutural do Admin, com validação visual e funcional antes de qualquer mudança
global.

## Referências consultadas

- [Fluent 2 — Shapes](https://fluent2.microsoft.design/shapes)
- [Fluent 2 — Layout](https://fluent2.microsoft.design/layout)
- [Atlassian Design — Spacing](https://atlassian.design/foundations/spacing)
- [Material 3 — Cards](https://developer.android.com/develop/ui/compose/components/card)
- [W3C — Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- [W3C — Focus Appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance)
- [NN/g — The Aesthetic-Usability Effect](https://www.nngroup.com/articles/aesthetic-usability-effect/)
