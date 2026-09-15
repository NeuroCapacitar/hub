# Validação do relatório Brand

> Status: revisão read-only; nenhuma alteração de código foi feita nesta validação.
> Worktree analisada: `C:\Users\Junior\.config\superpowers\worktrees\hub\design-system-refactor`
> Branch: `codex/design-system-refactor`
> HEAD: `cb3cbb9b73918d7a720a8cb2d7931ecb53afda15`
> Relatório analisado: `C:\Users\Junior\Desktop\Relatorio Brand.md`

## Veredito executivo

O relatório é bom como revisão de direção visual e como lista de próximos
refinamentos, mas não está correto como fotografia literal da worktree desta
refatoração.

O motivo é objetivo: o relatório declara ter auditado o commit `d6207226`, que
é a `staging` após o PR #227. A worktree analisada aqui está no commit
`cb3cbb9b`, baseado em `aa3119c2`; os dois são linhas irmãs. Por isso, algumas
conclusões do relatório descrevem corretamente outro estado do projeto, mas não
o código que foi implementado nesta worktree.

Minha decisão é:

- aprovar a direção de transição gradual, a separação entre cor de marca e
  papel funcional, o botão padrão petróleo, o progresso laranja/oliva e a
  contenção do branding em Admin, Financeiro, Auditoria e Operação;
- aprovar, com correções, os achados sobre documentação, `Slider`, foco,
  seleção e `Badge`;
- adiar experimentos visuais opcionais até existir uma hipótese de produto e
  uma verificação no contexto real;
- rejeitar como desatualizadas as afirmações sobre `AuthMediaSlot`, favicons
  públicos e `CardTitle` em Auth;
- não aplicar agora as mudanças futuras sugeridas. Este documento apenas
  valida e prioriza; não implementa a fase 1.5.

## Evidências que mudam a leitura do relatório

- `--button-primary` continua petróleo e `--primary` continua laranja em
  `src/app/globals.css`.
- `--selection` é laranja com alpha de `0.45` no HEAD atual, não petróleo como
  o relatório afirma para a `staging` auditada.
- `CardTitle` já usa `variant="page"` nas quatro telas Auth.
- `src/app/icon.svg` existe nesta worktree e referencia
  `/brand/logo-negativo.svg`; não há o contrato `/favicon/*` descrito no
  relatório.
- O Auth desta worktree usa imagem estática via
  `PLATFORM_LOGIN_IMAGE_SRC`; não há `AuthMediaSlot` dinâmico.
- A matriz de consumidores referenciada pelo relatório de implementação não
  existe em `design-plans/`.
- `neuro-brand-impeccable-review.md` também tem um drift menor: o score de
  visibilidade ainda menciona bloqueio de conta dependente de toast, embora a
  própria seção de correções diga que o status agora é persistente.
- `DESIGN.md` ainda tem drift real: a tabela de valores não acompanha todos os
  tokens atuais, o caminho do logo do favicon está antigo e o
  `last_verified_commit` é anterior ao HEAD.
- `Slider` ainda usa `bg-primary-foreground` no thumb, apesar de a cor de
  `primary` ter mudado de papel.
- O foco possui duas receitas: `Button`, `Input` e `Tabs` usam a composição
  nova; vários primitives ainda usam apenas `ring`/`border` históricos.
- `Badge` sem variante continua laranja, e o card Student usa essa variante
  para qualquer caso de acesso ativo.
- A fixture existe, mas ainda não apresenta Checkbox, Radio, Switch, Slider,
  Select e Textarea nem uma matriz dedicada de `background`/`card`/`sidebar`.

## Decisão por seção do relatório

1. **Conclusão geral — aprovada com ressalva.** A caracterização de “transição
   gradual” corresponde ao objetivo da worktree. A nota e a afirmação de que o
   usuário não percebe a mudança são avaliações qualitativas, não medições.
   O baseline usado pelo relatório precisa ser corrigido.

2. **`button-primary` petróleo — aprovada e já aplicada.** É a decisão certa
   para preservar familiaridade sem perder `primary` como papel funcional de
   ênfase. Não remapear o botão padrão para laranja.

3. **Foreground creme — aprovada e já aplicada.** O valor atual é a transição
   deliberada entre branco frio e areia. Não há motivo técnico para alterá-lo
   novamente nesta etapa.

4. **`support-foreground` teal-sage — aprovada e já aplicada.** O valor atual
   mantém a ponte com o teal sem voltar ao cinza frio ou aquecer todos os
   textos auxiliares. A recomendação de não aquecer mais é adequada.

5. **Identidade sem “tema novo” — aprovada como direção.** Tokens e usos
   confirmam a intenção, mas a sensação final só pode ser aprovada por revisão
   humana de telas e usuários; não é prova derivável do CSS.

6. **Student mais branded que Admin — aprovada e confirmada.** O Student usa
   calor em hover, progresso e aprendizagem; o Admin preserva densidade e
   neutralidade. Essa diferença é coerente com as tarefas de cada área.

7. **Progresso laranja e conclusão oliva — aprovada e confirmada.** A separação
   entre aprendizagem e `success` técnico é correta. Texto, percentual, ícone ou
   estado programático continuam necessários; cor não deve carregar o sentido
   sozinha.

8. **`LessonCard` — aprovada e confirmada.** O mapeamento de andamento,
   conclusão, bloqueio e estados técnicos está mais claro. A descrição do
   relatório é incompleta porque terracota também aparece em uma composição
   visual do card, além de `chart-4`.

9. **Auth estrutural — parcialmente aprovada.** Logo e mídia estáticas da
   plataforma estão presentes. A afirmação sobre `AuthMediaSlot` e mídia
   configurável descreve a linha `d6207226`, não esta worktree. Não deve ser
   contada como implementação feita aqui.

10. **Composição do Auth — aprovada com correção factual.** O split, o shell
    arredondado e a ausência de decoração genérica estão presentes. O grid
    atual não é `1.08fr/0.92fr`; usa uma coluna de formulário e uma coluna de
    mídia de `440px`.

11. **Não adicionar mais branding ao Auth agora — aprovada.** A superfície já
    tem logo, mídia e hierarquia suficientes. Congelar a composição evita
    ornamentação sem benefício comprovado.

12. **Manter Admin contido — aprovada.** Não mudar globalmente `card`, `muted`,
    `secondary` ou sidebar é coerente com o objetivo de transição e com o
    pedido de não tornar o sistema terroso.

13. **Corrigir drift documental — aprovada como P0, com evidência corrigida.**
    `DESIGN.md` diverge de `globals.css` em valores de `card`, `muted`,
    `muted-foreground` e `focus`, entre outros. O relatório erra ao atribuir a
    divergência de `selection` ao HEAD: atualmente ambos registram laranja
    alpha. O caminho antigo do logo em `DESIGN.md` também precisa ser corrigido.
    O `implementation-report` ainda mistura CTA laranja com botão petróleo e
    diz que a branch não foi commitada, embora já exista o commit atual.
    A revisão Impeccable tem a mesma classe de problema no score de
    visibilidade: conserva uma observação pré-correção sobre toast, contrariada
    pela própria seção de remediações.

14. **`Slider` — achado real, prioridade P0/P1 aprovada.** O thumb usa
    `bg-primary-foreground`, enquanto o range usa `bg-selection`; isso cria um
    acoplamento residual. O efeito visual descrito pelo relatório está
    desatualizado porque o range atual é laranja translúcido. Trocar para
    `foreground`, `focus` ou um token de componente exige testar os pares
    renderizados antes de escolher a classe.

15. **Unificar foco — aprovada como P1.** A inconsistência geométrica existe e
    aparece em Select, Textarea, Checkbox, Radio, Switch, Slider, Accordion,
    Table, ResourceList e sidebar. `PasswordInput` é uma exceção descrita de
    forma errada: ele compõe `Input` e `Button`, portanto herda as receitas
    desses primitives. Padronizar a receita sem apagar necessidades de hit area
    ou componentes portaled.

16. **Separar seleção de texto e controles — aprovada como decisão
    arquitetural P1, não como urgência cromática.** Um token atende hoje
    `::selection`, Checkbox, Radio, Switch, Slider e Calendar. A separação é
    semanticamente boa, mas as razões do relatório foram calculadas para o
    petróleo antigo; no HEAD atual a seleção é laranja alpha. Medir os estados
    compostos sobre cada superfície antes de escolher os novos valores.

17. **Adicionar variante laranja opt-in ao Button — aprovada em princípio como
    P2.** Manter o default petróleo e criar uma variante explícita é uma boa
    API para rollout gradual. O nome exato (`accent`, `highlight` ou outro) e a
    receita de estados precisam ser decididos antes de codificar. Não adicionar
    uma variante sem um primeiro consumidor aprovado.

18. **Usar laranja primeiro no checkout — aprovada somente como experimento.**
    A ausência de uma variante laranja é confirmada, mas o relatório pressupõe
    um CTA comercial explícito que não existe nessa forma na página atual; o
    fluxo inicia handoff e expõe acesso, interesse, retry e verificação. Definir
    a ação exata antes de migrá-la.

19. **Usar laranja depois em “Continuar aula” — aprovada como segunda etapa,
    não simultânea.** Só testar depois do primeiro CTA, comparando hierarquia e
    compreensão. Não aplicar globalmente a todas as ações Student.

20. **Tornar “Acesso ativo” neutro — aprovada como correção local P1.** Hoje
    `hasActiveAccess` usa `Badge default`, que é laranja. Como o texto pode ser
    “Matriculado”, “Acesso expira…” ou “Curso concluído”, o inventário precisa
    preceder a escolha final. `secondary` ou `outline` são candidatos melhores
    para o estado normal do que a cor de atenção.

21. **Criar variante `progress` para Badge — aprovada como opção, não como
    bloqueio.** É uma boa proteção para novos usos, mas não justifica mudar
    `default` global sem inventariar os consumidores existentes. Primeiro
    corrigir a instância de acesso e definir o contrato de `default`.

22. **Clarear levemente o petróleo do botão — não aprovada para aplicação
    imediata.** A ideia de testar a separação do botão é válida, mas o valor
    `oklch(0.515...)` é apenas uma hipótese. Texto creme está legível; a
    exigência de contraste da borda/forma depende do contexto e do modo como o
    botão é reconhecido. Fazer matriz de contraste e revisão de tela antes.

23. **Hover sólido via `color-mix` — aprovada como P3.** A opacidade `/80`
    depende da superfície inferior e pode variar entre background, card e
    dialog. Um hover sólido previsível é uma melhoria plausível, mas deve ser
    testado para não perder a hierarquia atual.

24. **Micro-acento laranja na sidebar — adiado.** Ícone ou marcador discreto
    pode funcionar, mas é escolha estética sem evidência de necessidade. A
    sidebar é persistente; manter o estado atual é mais seguro até uma revisão
    visual específica.

25. **Reduzir chroma de borders/input — adiada como experimento P2.** A hipótese
    é tecnicamente plausível, porém o refinamento deve ser isolado e comparado
    no preview. Não alterar junto com card, muted, secondary e sidebar.

26. **Manter `card` — aprovada.** O valor intermediário atual funciona como
    âncora de familiaridade e não deve ser suavizado novamente sem evidência.

27. **Usar pouco terracota — aprovada.** Terracota não precisa aparecer em
    todos os contextos nem virar status. O relatório só subestima seus usos
    atuais; isso não muda a decisão de contenção.

28. **Manter `surface-warm` raro — aprovada.** Token preparado para Auth,
    checkout, onboarding ou callout não precisa ser forçado em páginas comuns.

29. **Renomear `brand-cream` — adiada.** O manual não trata “cream” como
    anchor explícito, então há uma questão taxonômica real. Porém renomear agora
    causaria churn sem benefício visual. Melhor documentar `brand-cream` como
    decisão de aplicação ou reservar um refactor futuro para `warm-foreground`.

30. **Encadear `progress-complete` por `learning-complete` — aprovada como
    melhoria de baixa prioridade.** O alias explicita a hierarquia e não altera
    pixels. Não é necessário para estabilizar a implementação.

31. **Aplicar `CardTitle variant="page"` no Auth — rejeitada como achado atual.**
    As quatro páginas já usam `as="h1" variant="page"`. Reaplicar a sugestão
    seria duplicar trabalho; o relatório está olhando um estado anterior.

32. **Substituir logo rasterizado por vetor — aprovada como backlog futuro.** O
    SVG atual contém uma imagem base64 e não paths vetoriais. Só substituir com
    o asset oficial; não vetorizar artificialmente a imagem.

33. **Revisar favicon — parcialmente aprovada, com baseline corrigido.** Nesta
    worktree o contrato é `src/app/icon.svg`, com fundo petróleo; o retângulo
    branco e `/favicon/favicon.svg` pertencem a outra linha. Ainda vale testar
    o ícone em 16/32/96 px, navegadores escuros, bookmark e avaliar um Apple
    touch icon dedicado.

34. **Manter a fixture interna — aprovada.** A rota existe e é adequada ao
    estágio do projeto. Não adotar Storybook apenas por esta recomendação; isso
    seria uma decisão de infraestrutura separada e o `DESIGN.md` já evita
    dependência visual paralela.

35. **Adicionar controles à fixture — aprovada como P1.** Incluir Checkbox,
    Radio, Switch, Slider, Select e Textarea em estados unchecked/checked/focus
    cobre justamente os pontos residuais mais arriscados.

36. **Comparar background/card/sidebar lado a lado — aprovada como P1.** A
    fixture atual não faz essa comparação com os mesmos foreground, apoio,
    foco e seleção. É uma adição de verificação, não uma mudança de produção.

37. **Contraste geral “muito bom” — parcialmente aprovado.** Os cálculos
    centrais de cream, support e petroleum reproduzem aproximadamente os
    números do relatório, mas foram feitos para valores e estados específicos.
    A seleção atual mudou e alpha/composição podem alterar o resultado. Não
    declarar conformidade global sem medir pares renderizados por superfície.

38. **Aula pouco branded — aprovada.** Vídeo, leitura e controles devem ser o
    foco; progresso e estados semânticos já entregam identidade suficiente.

39. **Certificados sem trocar sucesso técnico por oliva — aprovada.** Validade,
    preparação e ações têm significados diferentes; manter `success`/`warning`
    técnicos é mais previsível.

40. **Não adicionar branding ao Financeiro — aprovada.** A marca já aparece na
    fundação e no shell; valores financeiros não devem virar decoração laranja,
    oliva ou terracota.

41. **Não adicionar branding a Auditoria/Operação — aprovada.** Nessas áreas,
    semântica, evidência e recuperação prevalecem sobre expressão de marca.

42. **Lista do que não fazer agora — aprovada como guardrail.** Não trocar
    botões globalmente, não remodelar superfícies, não mudar fonte/radius/tema
    nem criar biblioteca paralela. Isso não suspende correções objetivas de
    acessibilidade e documentação.

43. **Fase 1.5 — aprovada com reordenação.** A ordem recomendada é: (1)
    sincronizar `DESIGN.md` e o relatório de implementação, corrigir caminhos e
    decidir o destino da matriz; (2) corrigir Slider e foco; (3) neutralizar o
    acesso ativo e ampliar a fixture; (4) separar seleção; (5) só então testar
    borders e a variante opt-in do Button.

44. **Ordem em três PRs — aprovada como estratégia.** A separação entre
    documentação/consistência, ajustes semânticos e um único experimento de CTA
    reduz o risco. O primeiro CTA ainda precisa ser identificado no fluxo real.

45. **Preservar as camadas brand/functional/semantic — aprovada.** É a decisão
    arquitetural mais importante. Deve ser complementada com documentação de
    `brand-cream`, `support-foreground`, aliases e regras de uso; nomes por
    função não substituem testes de contraste.

46. **Narrativa da evolução visual — aprovada como resumo qualitativo.** A
    sequência “antes → proposta completa → transição atual” descreve bem a
    intenção, mas não deve ser apresentada como métrica de satisfação.

47. **Acolhimento além da cor — aprovada.** Hierarquia, copy, espaço, estados
    vazios, progresso compreensível e mídia institucional são alavancas mais
    seguras do que aquecer toda a interface.

48. **Tabela por área e veredito final — aprovados após correção.** A maioria
    das recomendações de contenção permanece válida. Devem ser corrigidas as
    linhas que tratam `AuthMediaSlot`, favicon público, `CardTitle` ou CTA de
    checkout como fatos desta worktree, além de marcar Slider, foco, Badge e
    documentação como pendências reais.

## Fundamentação externa e limites

As referências atuais confirmam a direção, mas não transformam preferências em
regras universais:

- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) exige contraste mínimo de texto,
  visibilidade de foco e contraste não textual de componentes/estados; o
  critério detalhado de `Focus Appearance` é AAA, não AA.
- [Fluent 2 — Color](https://fluent2.microsoft.design/color) recomenda separar
  neutros, marca e cores compartilhadas/semânticas, usar semântica para
  mensagens importantes e não usar cores semânticas como decoração.
- [Material color roles](https://developer.android.com/design/ui/wear/guides/styles/color/roles-tokens)
  e [Primer color usage](https://primer.style/product/getting-started/foundations/color-usage/)
  sustentam papéis/aliases e pares de foreground/background, mas não impõem
  que o botão do Hub seja laranja.
- [USWDS Button](https://designsystem.digital.gov/components/button/) sustenta
  variantes explícitas como mecanismo de evolução, não o nome `accent` nem o
  checkout como primeiro consumidor.
- [GOV.UK Tag](https://design-system.service.gov.uk/components/tag/) e
  [Carbon Progress](https://carbondesignsystem.com/components/progress-bar/usage/)
  reforçam que cor deve acompanhar rótulo, valor, ícone ou estado programático.
- A pesquisa consolidada está em
  [2026-09-15-brand-report-validation-research.md](../docs/reviews/2026-09-15-brand-report-validation-research.md).

Não encontrei no repositório pesquisa, telemetria ou feedback real de usuários
que prove frases como “os usuários não perceberão” ou que determine o primeiro
CTA laranja. Essas frases devem ser tratadas como hipóteses de design e
validadas manualmente ou com pesquisa de produto.

## Verificação da análise

- `bun run docs:check`: passou; 47 documentos válidos.
- A implementação atual já tinha passado por `bun run check`, `bun run
  typecheck`, suíte completa (418 arquivos, 2.899 testes, 0 falhas), build e
  `git diff --check` antes desta validação.
- O detector Impeccable havia retornado `[]`; a revisão de browser automatizada
  não estava disponível para os subagentes. A revisão humana no servidor local
  continua sendo a evidência apropriada para foco, Slider, favicon e viewport.
- CodeRabbit foi executado contra `cb3cbb9b` usando `aa3119c2` como base e
  encontrou um único achado menor, exclusivamente documental: o score antigo
  de visibilidade no relatório Impeccable. Ele foi registrado acima e não foi
  corrigido porque esta tarefa é de validação read-only.
- Nenhum arquivo de código foi alterado nesta validação. Permanecem apenas os
  artefatos de revisão `.impeccable/`, a pesquisa externa e este documento.

## Próximo gate

Antes de implementar a fase 1.5, corrigir a documentação factual e executar
uma revisão manual de teclado/contraste nos primitives listados. Só depois
    decidir se o primeiro CTA laranja será realmente o checkout. Esta unidade
    foi adiada porque o Checkout atual não possui um CTA comercial explícito.
