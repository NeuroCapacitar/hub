# Pesquisa: saudação personalizada na página inicial do aluno

**Pesquisado em:** 24/09/2026 (America/Sao_Paulo)

**Código local verificado em:** `8c6359e9`
**Escopo:** viabilidade de uma saudação breve, personalizada por nome e possivelmente por horário, em `/app`. Pesquisa documental e de código; não houve teste com alunos nem inspeção visual do site.

## Resposta curta

A ideia é viável e tem um precedente concreto em um LMS: o dashboard móvel do Canvas oferece um controle opcional “Hello [Student Name]”. Isso comprova que uma saudação personalizada pode ser uma preferência do aluno, mas não prova que ela aumente engajamento, retenção ou sensação de acolhimento. As fontes de outras plataformas consultadas tendem a documentar como o dashboard ajuda a retomar cursos, localizar tarefas e acompanhar progresso; não sustentam uma saudação como padrão universal.

Para o Hub, recomendo testar uma versão pequena, dentro do cabeçalho existente, sem card, slogan extra ou variações aleatórias. Uma saudação por período do dia é tecnicamente simples se seguir o fuso já adotado pelo produto, `America/Sao_Paulo`; ainda é uma escolha de produto, pois esse fuso não representa necessariamente a hora local de todo aluno. A eficácia emocional continua sendo hipótese, não fato de mercado.

## Estado atual do Hub

- `StudentDashboardPage` é um Server Component dinâmico. Busca a sessão, o catálogo de cursos e os banners; atualmente não inclui o nome na saudação. Os banners são renderizados antes do `PageHeader`, que mantém o título de rota oculto visualmente. A tela então prioriza “Continue aprendendo”, o próximo passo do curso e os demais grupos de cursos. Ver [dashboard](../src/app/%28student%29/app/%28dashboard%29/page.tsx), `StudentDashboardPage`.
- A rota `/app` está no conjunto compacto: `PanelLayout` mantém “Seu espaço de aprendizagem” no breadcrumb e inclui um `<h1>` apenas para leitores de tela quando não há título visível. Uma saudação visível pode entrar no cabeçalho de conteúdo após os banners, mas não deve criar um segundo `<h1>` nem substituir o rótulo estável da rota. Ver [metadata de rotas](../src/lib/panel-page-titles.ts), `COMPACT_PAGE_TITLES`/`getPanelRouteMeta`, e [shell](../src/components/panel-layout.tsx), `PanelLayout`.
- A sessão já fornece `session.user.name`; o layout do aluno passa esse nome para o shell, que já o mostra junto ao e-mail no menu de conta. Não seria necessário coletar um novo dado para personalizar a página. Ver [sessão](../src/lib/session.ts), `AppSession`, e [layout do aluno](../src/app/%28student%29/app/layout.tsx), `StudentLayout`.
- O nome atual vem de `users.name` e também alimenta o campo “Nome no certificado”; não há um campo separado de nome preferido. Extrair a primeira palavra é uma heurística e pode cortar nomes próprios compostos ou usar um nome formal que a pessoa não escolheria para tratamento cotidiano. A orientação do GOV.UK alerta, no contexto de formulários, que não se pode extrair com confiabilidade partes de um único campo de nome; isso é uma cautela aplicável por analogia, não uma regra específica para saudações. [GOV.UK — Names](https://design-system.service.gov.uk/patterns/names/).
- O produto já centraliza a zona de horário em `APP_TIME_ZONE = "America/Sao_Paulo"`, usada pelos formatadores de data. Não foi encontrada preferência de fuso por aluno. Ver [timezone](../src/lib/timezone.ts), `APP_TIME_ZONE`, e [formatters](../src/lib/formatters.ts).
- O contrato visual pede que o primeiro viewport priorize tarefa, estado e ação, sem uma introdução ornamental antes do conteúdo útil. Uma saudação só se encaixa se for compacta e não empurrar o curso/próxima aula para baixo de forma relevante. Ver [DESIGN.md](../DESIGN.md), “Escolher a composição”.

Essa leitura comprova a estrutura e os dados disponíveis; sem observação de alunos, não comprova que a página atual pareça impessoal nem que a saudação vá resolver essa percepção.

## O que as plataformas consultadas documentam

| Fonte | Evidência documentada | O que isso sustenta — e o que não sustenta |
| --- | --- | --- |
| [Canvas — dashboard móvel para Android](https://community.instructure.com/en/kb/articles/664524-how-do-i-use-the-customizable-dashboard-in-the-canvas-app-on-my-android-device) | A configuração do dashboard inclui o controle “Hello [Student Name]”; cursos, notas, resumo semanal e lista diária também podem ser ativados e reorganizados. | É evidência direta de uma saudação por nome em um LMS e de que ela é opcional/configurável naquela experiência móvel. Não demonstra que seja padrão na web, que use o horário do dia ou que tenha melhorado resultados. |
| [Canvas — dashboard personalizável de alunos, release notes de abril de 2026](https://community.instructure.com/en/kb/articles/664389-canvas-release-notes-2026-04-18) e [anúncio do produto](https://community.instructure.com/en/discussion/665850/empowering-learners-introducing-the-new-customizable-dashboard) | A experiência web recente enfatiza tarefas, prazos, notas, feedback e personalização; a Instructure diz ter trabalhado com centenas de alunos durante descoberta e Early Adopter Program. | A prioridade declarada é orientar a próxima ação e trazer informação de curso à frente. O anúncio não apresenta resultados específicos de teste para a saudação; o guia móvel é evidência separada. |
| [Coursera — homepage personalizada](https://blog.coursera.org/introducing-new-platform-innovations-as-demand-for-online-learning-grows/) | O anúncio descreve retomar um curso em um clique, recomendações pessoais e certificados na homepage. Publicado em 2019. | Um exemplo histórico de homepage centrada em continuidade e relevância do conteúdo. Não prova a composição atual da Coursera nem o valor de uma saudação. |
| [Duolingo — redesign da tela inicial](https://blog.duolingo.com/new-duolingo-home-screen-design/) | O post descreve um caminho de aprendizagem guiado, aulas ordenadas e prática incorporada; o redesign foi lançado em 2022. | Evidência da decisão declarada de orientar o próximo passo de estudo. É antigo e não é uma auditoria da UI atual; não comprova ausência de saudação. |
| [LinkedIn Learning — recomendações organizacionais](https://www.linkedin.com/help/learning/answer/a700799) | Cursos/caminhos recomendados pela organização aparecem também na homepage e são alinhados a função, metas da equipe e desenvolvimento profissional. A página foi atualizada há cerca de um ano. | Exemplo de personalização ligada à relevância do conteúdo, não apenas à fórmula de tratamento. Não mede o efeito de saudação nem descreve recomendações individuais por histórico. |
| [Udemy — experiência do curso e “My learning”](https://support.udemy.com/hc/en-us/sections/206457187-Course-Player) | O material orienta o aluno a iniciar em “My learning”, retomar cursos e consultar progresso. A nova experiência é descrita como piloto contínuo. | Demonstra navegação para retomar aprendizagem; não sustenta uma saudação nem permite generalizar o piloto a todas as contas. |
| [Moodle 5.2 — Dashboard e My courses](https://docs.moodle.org/502/en/Dashboard_and_My_courses) | O Dashboard resume cursos e próximos prazos; alunos podem personalizar os itens exibidos. A página foi atualizada em junho de 2026. | Demonstra utilidade baseada em cursos/prazos e personalização de blocos. Não documenta uma saudação neste guia. |

**Limite da comparação:** páginas de ajuda e anúncios oficiais não mostram todas as variantes de UI e não permitem concluir que uma plataforma “não usa” saudação. O conjunto é uma amostra documentada, não uma contagem de mercado nem uma comparação de usabilidade.

## Debates de comunidade e limites da evidência

- Em uma discussão de UI de dashboard no Reddit, uma pessoa comenta que “Good afternoon, Hardik” consome espaço e poderia ser temporário. É uma opinião isolada sobre um mockup, sem teste ou credencial verificável; serve como alerta para densidade, não como regra de design. [Discussão em r/UI_Design](https://www.reddit.com/r/UI_Design/comments/1klj08e/give_me_design_feedback/)
- Em uma discussão recente do repositório Next.js, desenvolvedores discutem divergência de hora/fuso entre SSR e navegador. Um participante também esclarece que um Server Component puro não deve ser tratado como se fosse necessariamente reexecutado como Client Component durante a hidratação. É uma conversa técnica comunitária, não fonte normativa de UX. [Discussão #95004 do Next.js](https://github.com/vercel/next.js/discussions/95004)
- Não encontrei evidência confiável de que sortear frases (“O que vamos estudar hoje?”, “Preparado para aprender?” etc.) aumente engajamento. A variação pode ser uma escolha de voz, mas não deve ser descrita como prática comprovada.

## Avaliação das opções

### 1. Saudação simples por nome

**Boa relação entre acolhimento e custo, com ressalva de identidade.** Uma linha breve pode personalizar o início sem alterar a jornada. Para a V1, não recomendo criar outra configuração só para nome preferido. Se o produto aceitar a heurística, usar a primeira palavra de `users.name` com espaços normalizados e fallback neutro; nunca inferir o nome pelo e-mail. Caso seja importante respeitar nomes de tratamento diferentes do nome no certificado, isso exige uma decisão separada sobre um campo “Como prefere ser chamado(a)?”.

### 2. Saudação por horário

**Viável com o fuso do produto, mas não equivale à hora local individual.** O Hub já usa `America/Sao_Paulo` para datas. Calcular a faixa horária no servidor com esse fuso explícito e renderizar o resultado no Server Component evita depender do relógio/fuso do host. Isso é coerente com a convenção atual do produto. Um aluno em outro fuso ou viajando pode receber uma saudação que não corresponde ao próprio relógio; não há preferência individual para resolver isso hoje.

O Next.js explica que estado de timezone do navegador não está disponível durante SSR; renderizar primeiro com uma regra e substituir após `useEffect` evita o mismatch, mas pode causar um flash. A alternativa de renderizar só no servidor é estável, porém usa o fuso do servidor/produto, não o fuso individual. A documentação demonstra esse tradeoff para datas/locale; aplicá-lo à saudação é uma inferência técnica análoga. [Next.js — Preventing Flash before Hydration, “Dates and formatting”](https://nextjs.org/docs/app/guides/preventing-flash-before-hydration#dates-and-formatting)

As faixas de “bom dia”, “boa tarde” e “boa noite” não são definidas pelo projeto nem pelas fontes consultadas. Qualquer horário de corte deve ser declarado como convenção editorial do Hub e coberto por testes em limites de faixa. Não adicionar `useEffect`, timezone por navegador, script inline ou nova dependência só por essa microcopy.

### 3. Várias frases aleatórias

**Não recomendo na primeira versão.** A saudação por período já oferece variação significativa e previsível. Variantes aleatórias elevam o volume de copy para revisar sem evidência de benefício. Se a frase for sorteada de forma independente no servidor e no primeiro render do cliente, os textos podem divergir; essa aplicação decorre do requisito do React de que o primeiro render coincida com o HTML do servidor, não de uma recomendação oficial específica contra `Math.random`. Se a escolha acontecer apenas no servidor e for enviada no HTML/RSC, esse risco de hidratação desaparece, mas a aleatoriedade continua sem valor demonstrado. [React — `hydrateRoot`](https://react.dev/reference/react-dom/client/hydrateRoot) · [Next.js — Preventing Flash before Hydration](https://nextjs.org/docs/app/guides/preventing-flash-before-hydration)

### 4. Segunda frase “O que vamos estudar hoje?”

**Dispensável neste contexto.** A página já possui a seção “Continue aprendendo” e, quando aplicável, um card com a próxima aula e ação para continuar. Uma pergunta/slogan logo antes repetiria a orientação que o conteúdo já fornece. A saudação deve acolher; o card deve orientar a ação.

Essa conclusão é uma recomendação de economia de atenção baseada na hierarquia descrita no `DESIGN.md`; não há teste com alunos que demonstre que a segunda linha cause carga cognitiva. Se o usuário valorizar explicitamente a pergunta, ela pode ser avaliada como copy, mas deve desaparecer no estado sem cursos acessíveis em vez de prometer uma ação inexistente.

## Recomendação para decisão

**Aprovar uma saudação curta e contextual, sem transformá-la em novo bloco visual:**

1. Usar somente a área de cabeçalho já existente, após o carrossel de banners e antes das seções de Curso; não criar card/hero próprio.
2. Usar `Bom dia/Boa tarde/Boa noite, [primeiro nome].` calculado no servidor pelo `APP_TIME_ZONE` do Hub. Se preferir evitar a ressalva de fuso, a alternativa segura é “Olá, [primeiro nome].” sem referência ao horário.
3. Não sortear frases extras nem acrescentar “O que vamos estudar hoje?” na V1. Manter o restante do dashboard como fonte da orientação (“Continue aprendendo” / próxima aula). Se ainda assim for aprovada uma segunda linha, exibi-la só quando há Curso acessível ou disponível para começar.
4. Não criar configuração para desligar a saudação no primeiro corte: o Canvas mostra uma opção desse tipo em sua experiência móvel, mas o Hub ainda não tem evidência de demanda que justifique adicionar essa preferência.
5. Usar um nível de heading abaixo do `<h1>` oculto que já identifica a rota; manter o nome de rota atual no breadcrumb. Incluir placeholder compatível no `loading.tsx` para não mudar o ritmo quando a tela carregar.
6. Definir explicitamente as faixas de horário e o fallback do nome antes de implementar. Não afirmar que a saudação aumenta retenção; validar primeiro a leitura/aceitação com o próprio usuário e observar se desloca o conteúdo principal.

**Conclusão:** recomendação favorável à saudação por nome; favorável à versão por horário se `America/Sao_Paulo` for aceita como relógio editorial do Hub; contrária a múltiplas frases aleatórias e ao subtítulo “O que vamos estudar hoje?” no primeiro corte. Esta pesquisa não implementa nada.

## Refinamento escolhido após a análise

Na revisão seguinte, o responsável pelo produto preferiu substituir “Seu espaço de aprendizagem” pela saudação no header do shell, em vez de deixá-la solta acima das seções. Essa decisão substitui a recomendação inicial dos itens 1 e 5 acima.

No desktop e tablet, o shell mostra a saudação completa no breadcrumb. No mobile, sidebar, marca central e ações dividem a faixa superior; ali o breadcrumb usa “Início” e a saudação completa aparece como título do conteúdo, para não cortar o nome. A página de carregamento reserva esse mesmo espaço só no mobile. O título original continua como fallback para preview de Admin/Suporte, que não deve cumprimentar o estudante pelo nome.

## Fontes técnicas e de produto

- [React — `hydrateRoot`](https://react.dev/reference/react-dom/client/hydrateRoot)
- [Next.js — Preventing Flash before Hydration](https://nextjs.org/docs/app/guides/preventing-flash-before-hydration)
- [Revenue-Centric Design — disciplina de escopo de features](https://x.com/richardrx/status/2059236567533650119) (lente para pesar custo cognitivo e manutenção; não é estudo de saudações nem evidência de resultado)
