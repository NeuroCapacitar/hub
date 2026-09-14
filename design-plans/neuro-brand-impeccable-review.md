# Revisão Impeccable: refinamento do sistema visual

Method: dual-agent (A: `01a09f6b-b1be-7c90-b332-9566e6c799b4` · B: `01a09f6b-b58f-7dc0-8f33-21b7196e0400`)

> Worktree: `codex/design-system-refactor`
> Target principal: `/entrar` e a fixture `/admin/configuracoes/design-system`
> Método: revisão independente + detector Impeccable

## Mudanças aplicadas nesta rodada

- Botões principais voltaram ao petróleo via `button-primary`, sem desfazer o
  laranja de links, seleção, progresso e ênfase.
- Títulos passaram a usar `brand-cream`/`foreground`, mais próximos da areia,
  enquanto descrições e textos de apoio usam um teal-sage transicional explícito.
- Cards, muted, borders, secondary e sidebar retornaram à escala teal anterior;
  a mudança de marca não empurra mais todas as superfícies para o terracota.
- AuthShell deixou de empilhar uma superfície `card` desnecessária atrás do
  Card do formulário.
- A fixture deixou de duplicar “Sistema aplicado” e “Candidata”; agora mostra o
  sistema aplicado e uma matriz explícita de estados, contraste e composição
  Student/Admin.
- `DESIGN.md` foi alinhado com a separação entre `button-primary`, `primary`,
  `support-foreground` e os demais papéis.

## Design Health Score

| Heurística | Score | Observação |
| --- | ---: | --- |
| Visibility of system status | 3/4 | Loading e erros existem; bloqueio de conta ainda usa toast transitório. |
| Match system / real world | 4/4 | Labels em português e fluxo de autenticação familiar. |
| User control and freedom | 3/4 | Recuperação e revelar senha são visíveis; ainda faltam alguns cancelamentos. |
| Consistency and standards | 3/4 | Papéis estão mais claros; alguns consumidores legítimos de `primary` ainda exigem disciplina. |
| Error prevention | 3/4 | Required, autocomplete e bloqueio de duplo envio funcionam. |
| Recognition over recall | 3/4 | Hierarquia e labels são claros; ajuda contextual é limitada. |
| Flexibility and efficiency | 3/4 | Revelar senha agora existe; ainda há poucos aceleradores para usuários avançados. |
| Aesthetic/minimalist design | 3/4 | Mais calmo e coerente após remover a aparência terrosa excessiva. |
| Error recovery | 4/4 | Recuperação de senha, erros persistentes e associação aos campos estão cobertos no Auth. |
| Help and documentation | 2/4 | Existe recuperação, mas não há suporte contextual no login. |
| **Total** | **31/40** | **Bom; próximos ganhos são de polimento e consistência de longo prazo.** |

## Design specificity

O resultado é específico à NeuroCapacitar pela combinação de logo real, mídia
institucional, petróleo, creme claro, suporte aquecido, laranja seletivo,
oliva de aprendizagem e copy em português. A estrutura split-screen de Auth
continua familiar à categoria, mas isso não enfraquece a identidade do produto.

O detector Impeccable retornou `[]`: nenhum padrão mecânico proibido foi
encontrado nos targets analisados.

## O que está funcionando

- A marca aparece sem transformar Admin, Financeiro ou Auditoria em material de
  marketing.
- O botão principal voltou a ter a presença institucional do petróleo sem
  perder o laranja como sinal de atenção e progresso.
- O texto ganhou hierarquia mais segura: títulos creme claros, apoio quente e
  superfícies teal.
- O sistema usa papéis semânticos para foco, seleção, progresso e conclusão.
- A fixture interna agora explica as decisões em vez de duplicar duas colunas
  iguais.

## Correções aplicadas após esta revisão

- `CardTitle` agora aceita `variant="page"`, evitando que títulos Auth herdem
  a escala de título de card.
- Input e links usam a mesma receita de foco creme claro com ring de fundo.
- Falhas de login permanecem no fluxo e são associadas aos inputs por
  `aria-invalid`/`aria-describedby`; bloqueio de conta não depende apenas de
  toast.
- O fluxo de autenticação ganhou revelar/ocultar senha com botão acessível.
- AuthShell usa `100dvh` e uma altura mínima limitada pela viewport mobile.

## Melhorias adicionais recomendadas

### Resolvido: hierarquia de título em `CardTitle`

`CardTitle` adiciona `type-card-title` mesmo quando a tela fornece
`type-page-title`. Em Auth, o `h1` pode ficar visualmente próximo de um título
de card comum.

Implementado com `CardTitle variant="page"` nas telas Auth.

### Resolvido: foco de links e inputs

Botões e tabs usam o foco creme claro com ring de fundo; links e inputs ainda
possuem receitas históricas diferentes.

Implementado para links Auth e `Input`; os demais primitives já usam o mesmo
token `focus` na nova receita.

### Resolvido: falhas de autenticação persistentes e associadas

Erros de credencial são inline, mas bloqueios usam toast. O login não associa
um erro específico a um campo quando a falha é conhecida.

Implementado com status inline, `aria-invalid`, `aria-describedby` e mensagem
de bloqueio persistente.

### Resolvido: custo de Auth em mobile

O shell ainda usa `min-h-[34rem]` no conteúdo. Em telefones baixos, isso pode
criar scroll vertical desnecessário.

Implementado com `100dvh` e altura limitada pela viewport disponível.

### Resolvido: revelar/ocultar senha

Implementado em entrar, cadastro e redefinição de senha por um primitive
compartilhado com label, estado pressionado e foco acessível.

### [P2] Limpar usos residuais de `primary`

Ainda existem usos válidos em seleção de editor, tabs, progresso, capas e drag
state, mas cada um deve continuar registrado na matriz. Qualquer novo uso deve
ser classificado como ação, seleção, progresso, mídia ou ênfase antes de ser
adicionado.

### [P3] Revisar a fixture interna antes de ampliar sua cobertura

A matriz atual é útil para comparar papéis, mas deve permanecer uma ferramenta
de revisão interna e não crescer até virar um catálogo visual pesado. Se novas
variantes forem adicionadas, agrupá-las por intenção e manter uma primeira dobra
curta.

## Personas

- **Jordan:** consegue iniciar o login rapidamente; ainda falta uma rota de ajuda
  contextual além de recuperação de senha.
- **Sam:** labels, headings, foco, erros e controle de senha do Auth estão bons; manter a mesma
  receita nos primitives portaled e nas telas antigas.
- **Casey:** mídia some no mobile, a altura mínima agora respeita a viewport e a
  ação ocupa uma área confortável; ainda vale preservar entrada em interrupções.
- **Alex:** a fixture agora é comparável e sem duplicação, mas a matriz de
  consumidores deve permanecer disponível para manutenção do sistema.

## Limitação da revisão

O detector passou sem findings. A inspeção de browser em subagent não foi
disponível; a aplicação local está aberta em `http://localhost:3002`, e a
revisão humana de viewport estreito, Auth autenticado e fixture continua sendo
o próximo passo de validação visual.
