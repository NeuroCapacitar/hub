---
target: "Ajuda do aluno: FAQ, suporte e recuperação"
total_score: 28
max_score: 40
na_heuristics: ""
p0_count: 0
p1_count: 0
target_identity: "file:C:\\Users\\Junior\\.config\\superpowers\\worktrees\\hub\\small-changes\\src\\app\\(student)\\app\\perguntas-frequentes\\page.tsx"
target_fingerprint: "sha256:0c76bfad800246e046eb8395e700ddf1e8edf12a8b5c0ea6b57e983b8cd30650"
target_path: "C:\\Users\\Junior\\.config\\superpowers\\worktrees\\hub\\small-changes\\src\\app\\(student)\\app\\perguntas-frequentes\\page.tsx"
timestamp: 2026-09-24T03-52-16Z
slug: src-app-student-app-perguntas-frequentes-page-tsx
---
Method: dual-agent (A: 01a0d169-c4e8-7b71-b040-f6753dadad12 · B: 01a0d176-4192-72c0-afdd-6ec78b327e6e)

# Ajuda do aluno: FAQ e contato com suporte

## Design language

- **Audited surface:** navegação autenticada do aluno, página de perguntas frequentes, formulário de suporte e seus acionadores contextuais.
- **Design sources:** `DESIGN.md`, `PRODUCT.md`, `CONTEXT.md`, componentes e ações atuais.
- **Documented decisions:** a FAQ é conteúdo editorial editável; o pedido de suporte é registrado e enviado por outbox. O sistema visual pede que tarefa e próxima ação sejam claras e que ajuda complemente, sem repetir labels.
- **Governing owners and consumers:** `StudentFaqPage`, `SupportSidebarItem`, `SupportRequestDialog`, `sendSupportRequestAction`, `createSupportRequest` e CTAs em Curso, certificado, checkout e vídeo.
- **Explicit exceptions:** None documented.

## Design Health Score

| # | Heurística | Nota | Questão principal |
|---|---|---:|---|
| 1 | Visibilidade do estado | 3/4 | O FAQ e o formulário estão identificados; o envio tem feedback. |
| 2 | Correspondência com o mundo real | 3/4 | Os termos são familiares, mas dois destinos atendem à mesma necessidade geral. |
| 3 | Controle e liberdade | 3/4 | Há autosserviço, contato e atalhos contextuais. |
| 4 | Consistência | 2/4 | Duas implementações de formulário servem a mesma ação. |
| 5 | Prevenção de erro | 2/4 | Um formulário não limita no cliente o tamanho que o servidor rejeita. |
| 6 | Reconhecimento | 3/4 | As entradas são visíveis; ainda exigem escolha antecipada entre FAQ e suporte. |
| 7 | Eficiência | 3/4 | Há atalhos contextuais, mas a navegação geral pode ser simplificada. |
| 8 | Minimalismo visual | 3/4 | A estrutura de código é contida; não houve inspeção renderizada. |
| 9 | Recuperação | 3/4 | Estados de Curso/certificado/vídeo têm contato; login bloqueado não expõe um canal. |
| 10 | Ajuda e documentação | 3/4 | A FAQ mostra respostas abertas e tem CTA final; não há busca. |
| **Total** | | **28/40 (70%)** | **Bom, com refinamento de arquitetura de informação e consistência.** |

## Design Specificity Verdict

O uso de `Frame` para perguntas/respostas abertas e um card final de contato é coerente com os componentes existentes e com a meta de reduzir cliques. A página já cumpre grande parte do conceito de central Ajuda. A falha principal não exige uma nova interface visual: são duas entradas gerais e duas implementações do mesmo formulário. A hierarquia renderizada e o comportamento em mobile não foram inspecionados.

## Overall Impression

A intenção de centralizar é boa e a base já existe na página de FAQ. O avanço principal é tornar essa página o destino único de ajuda geral e eliminar o modal duplicado no sidebar, preservando o formulário compartilhado e os atalhos contextuais.

## What's Working

- As respostas ficam abertas, sem exigir interação em acordeão.
- A página de FAQ já termina com `SupportRequestDialog`, logo FAQ e contato já coexistem.
- Curso, certificado, checkout e processamento de vídeo mantêm caminhos contextuais de recuperação.
- O pedido não é um `mailto`: é persistido e enfileirado para email com resposta ao email da Conta.

## Priority Issues

1. **[P2] Duas entradas gerais para a mesma necessidade.** No grupo “Suporte”, um item abre um formulário e outro leva à FAQ, que já oferece o mesmo contato. **Correção:** centralizar a navegação geral em “Ajuda” e usar essa página como entrada única, idealmente em `/app/ajuda` com redirect da rota antiga. **Suggested command:** `$impeccable distill`.
2. **[P2] Formulário duplicado e limites diferentes.** `SupportSidebarItem` duplica o diálogo compartilhado; seus campos não declaram os limites máximos que o outro componente informa e que o servidor valida. **Correção:** remover o formulário independente e usar `SupportRequestDialog` em Ajuda e nos demais contextos. **Suggested command:** `$impeccable harden`.
3. **[P2] Contato pode ficar distante se a FAQ crescer.** O CTA aparece depois de todas as respostas, e a lista é editável sem limite de conteúdo. **Correção:** manter o card final e oferecer um atalho secundário de contato junto ao título da Ajuda, usando o mesmo diálogo. **Suggested command:** `$impeccable layout`.

## Persona Red Flags

- **Jordan, primeiro uso:** precisa decidir entre “Suporte” e “Perguntas frequentes” antes de ver que FAQ já contém o mesmo contato.
- **Casey, mobile:** pode ter de atravessar uma lista longa para chegar ao CTA final; os CTAs contextuais atuais são úteis e devem permanecer.

## Minor Observations

- O seed inicia com 3 FAQs, mas a lista é administrável. Carbon recomenda não adicionar busca quando há poucos itens fáceis de examinar; reavaliar quando o volume real crescer.
- O modal responde pelo email da Conta; manter essa expectativa explícita na copy.
- A página Ajuda exige login. O erro de login bloqueado manda contatar o Suporte, mas não oferece contato acionável. Fallback público é uma decisão adjacente, não resolvida pela central autenticada.
- As fontes consultadas documentam padrões de produto, não medem que centralizar reduz tempo ou volume de suporte.

## Questions to Consider

- Você quer uma ação curta de contato já no cabeçalho além do card final, ou prefere contato só depois da FAQ?
- O estado de login bloqueado deve ganhar um fallback público de suporte fora do dashboard?

## Research basis

- W3C WCAG 2.2 SC 3.2.6 recomenda localização consistente para mecanismos de ajuda existentes e permite que eles apontem para outra página; não exige uma central nem que todo contato esteja num rodapé: https://www.w3.org/WAI/WCAG22/Understanding/consistent-help.html
- Carbon recomenda busca para conjuntos grandes/complexos e não para poucos itens fáceis de percorrer: https://carbondesignsystem.com/components/search/usage/
- Teachable, Thinkific e Canvas documentam combinações de autosserviço, contato da escola/instrutor e suporte de plataforma, com responsabilidades distintas; Zendesk e Intercom documentam conhecimento e contato na mesma área, mas não provam que isso reduza chamados: https://support.teachable.com/en/articles/11682436-student-guide-contact-a-school · https://support.thinkific.com/hc/en-us/articles/360030719413-How-to-Get-Help-and-Contact-Thinkific-Support · https://community.instructure.com/en/kb/articles/662779-how-do-i-get-help-with-canvas · https://support.zendesk.com/hc/en-us/articles/4408846795674-Getting-started-with-your-help-center · https://www.intercom.com/help/en/articles/5241719-let-customers-search-for-articles-in-the-messenger
- A lente Revenue-Centric usada foi “support volume as a design problem, not a staffing one”; trata-se de princípio de design, não de experimento do Hub: https://x.com/richardrx/status/2047289409238712726
- Pesquisa completa, datas e limitações: `design-plans/2026-09-24-help-center-self-service-contact-research.md`.
