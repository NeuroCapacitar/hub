# Pesquisa: estados de sistema e recuperação

> Nota de pesquisa, 19/09/2026. Pesquisa de UX e comportamento técnico; não é
> decisão de produto nem plano de implementação.

## Pergunta e escopo

Como refinar 404, falhas recuperáveis, falha global, manutenção e erro da área
do aluno sem transformar estados diferentes em uma mensagem genérica de erro?

Foram consultadas apenas fontes primárias ou oficiais: documentação do Next.js
e Vercel, RFC do IETF, documentação do Stripe/Sentry e documentação oficial do
Atlassian Statuspage. Todas as fontes abaixo foram consultadas em 19/09/2026.

## Leitura do estado atual do Hub

O código já possui uma base operacional correta:

- `src/app/not-found.tsx` evita detalhes técnicos e oferece retorno aos cursos,
  mas a frase atual mistura recurso inexistente, indisponibilidade e falta de
  permissão. São situações diferentes do ponto de vista da pessoa usuária.
- `src/app/error.tsx`, `src/app/global-error.tsx`,
  `src/app/(student)/app/error.tsx` e
  `src/app/(admin)/admin/(dashboard)/error.tsx` usam retry, foco no título,
  captura no Sentry e identificador de correlação.
- `global-error.tsx` já respeita a exigência estrutural de fornecer seu próprio
  documento HTML, porque substitui o layout raiz quando ocorre uma falha nele.
- `src/app/manutencao/page.tsx` tem marca e mensagem curta, mas não informa
  escopo, previsão, última atualização, canal de status ou alternativa de
  recuperação.

O principal problema não é falta de componentes decorativos. É falta de uma
linguagem comum de decisão: o que aconteceu, se a pessoa precisa agir agora,
qual ação é segura e quando suporte/status deve entrar.

## O que as fontes oficiais estabelecem

### Next.js App Router

O Next.js separa erros esperados de exceções não capturadas. Erros esperados,
como validação ou falha conhecida de requisição, devem ser modelados como
valores retornados à interface; exceções não capturadas devem cair em um
`error.tsx`. A documentação recomenda que o boundary ofereça retry para
refazer a renderização e a busca do segmento.

`error.tsx` é um Error Boundary de segmento e precisa ser Client Component.
`global-error.tsx` cobre falhas do layout raiz, também precisa ser Client
Component e deve incluir seu próprio `<html>` e `<body>`. Portanto, o erro
global não pode depender do shell, da sidebar ou de componentes que podem ter
falhado junto com o layout.

`not-found.tsx` é a UI de um recurso que não foi encontrado ou de uma chamada a
`notFound()`. O Next.js injeta `noindex` para respostas 404. A versão global
de 404 pode ignorar o layout normal e, nesse caso, precisa carregar
explicitamente estilos, fontes e demais dependências essenciais.

Fontes:

- [Next.js: Error Handling](https://nextjs.org/docs/app/getting-started/error-handling)
- [Next.js: `error.js`](https://nextjs.org/docs/app/api-reference/file-conventions/error)
- [Next.js: `not-found.js`](https://nextjs.org/docs/app/api-reference/file-conventions/not-found)
- [Next.js: `notFound()`](https://nextjs.org/docs/app/api-reference/functions/not-found)
- [Next.js: Production Checklist](https://nextjs.org/docs/app/guides/production-checklist)

### Vercel e manutenção

A documentação oficial da Vercel demonstra manutenção por regra de roteamento
que envia as demais rotas para uma página de manutenção e exclui a própria
rota de destino, evitando loop infinito. Isso confirma que manutenção deve ser
tratada como um estado de entrada/roteamento, não apenas como um card mostrado
casualmente dentro do dashboard.

Quando houver um modo de manutenção real, a resposta HTTP deve ser coerente
com o estado. O RFC 9110 define `503 Service Unavailable` tanto para
indisponibilidade temporária quanto para manutenção programada e permite
`Retry-After` para indicar quando o cliente deve tentar novamente.

Fontes:

- [Vercel: `vercel.json`, exemplo de maintenance page](https://vercel.com/docs/project-configuration/vercel-json)
- [Vercel: Maintenance Page template](https://vercel.com/templates/edge-middleware/maintenance-page)
- [IETF RFC 9110: 503 Service Unavailable e Retry-After](https://www.rfc-editor.org/rfc/rfc9110.html#name-503-service-unavailable)
- [IETF RFC 9110: 404 Not Found](https://www.rfc-editor.org/rfc/rfc9110.html#name-404-not-found)

### Suporte, correlação e privacidade

O Stripe usa um request ID opaco para localizar uma requisição específica no
suporte e recomenda fornecê-lo ao entrar em contato. A documentação do Sentry
também associa feedback a um `event_id`. O padrão útil para o Hub é expor
somente um identificador seguro e curto, com instrução clara de quando copiá-lo
ou informá-lo ao suporte; mensagem de exceção, stack trace, nome de provedor,
URL interna, digest bruto ou dados da conta não pertencem à UI de usuário.

Fontes:

- [Stripe: Request IDs](https://docs.stripe.com/api/request_ids)
- [Stripe: Errors](https://docs.stripe.com/api/errors)
- [Sentry: Submit User Feedback](https://docs.sentry.io/api/projects/submit-user-feedback/)

### Comunicação de incidentes

O Atlassian Statuspage distingue manutenção agendada de incidente em curso e
usa uma progressão compreensível: investigando, identificado, monitorando e
resolvido. A orientação oficial é comunicar cedo, atualizar com frequência
adequada, explicar impacto em linguagem simples, manter consistência entre
canais e assumir a responsabilidade pela experiência. Isso é aplicável à tela
de manutenção, mas não significa que toda falha local de uma pessoa precise
virar incidente público.

Fontes:

- [Atlassian Statuspage: What is an incident?](https://support.atlassian.com/statuspage/docs/what-is-an-incident/)
- [Atlassian Statuspage: incident statuses e componentes](https://support.atlassian.com/statuspage/docs/what-is-statuspage/)
- [Atlassian Statuspage: incident communication tips](https://support.atlassian.com/statuspage/docs/incident-communication-tips/)
- [Atlassian Statuspage: incident and maintenance communication](https://support.atlassian.com/statuspage/docs/communicate-incidents-and-maintenance-with-statuspage/)

## Princípio visual recomendado

Criar uma família de `RecoveryShell`/estado de sistema, mas com conteúdo e
ênfase específicos por estado:

1. Marca discreta e consistente.
2. Um status curto, quando ajudar a orientar a leitura.
3. Título que descreve o impacto, não o mecanismo técnico.
4. Uma explicação de uma ou duas frases: o que a pessoa pode esperar agora.
5. Ação primária única e segura.
6. Ação secundária contextual, sem competir com a primária.
7. Identificador de suporte apenas quando houver falha técnica e somente em
   nível secundário.

O card pode permanecer centralizado na viewport, mas o conteúdo interno deve
ser alinhado à esquerda para suportar frases longas, códigos e múltiplas ações.
Em telas estreitas, as ações devem ocupar a largura disponível e empilhar sem
perder a ordem. O título deve receber foco após uma falha de boundary; o status
de carregamento e a conclusão de retry precisam ser anunciados sem depender da
cor.

Não usar ilustração grande, animação ou código HTTP como a principal mensagem.
O peso visual deve vir de tipografia, espaço, marca e contraste semântico dos
tokens existentes. O código de suporte pode usar tipografia monoespaçada e
quebra segura; nunca deve causar overflow horizontal.

## Matriz de conteúdo e ações

| Estado | Mensagem principal | Ação primária | Ação secundária | Suporte/correlação |
| --- | --- | --- | --- | --- |
| 404 | A página ou recurso não foi encontrado | Voltar ou ir para uma área conhecida | Meus cursos/Início, conforme contexto | Não mostrar ID; 404 não é falha técnica por si só |
| Erro de segmento recuperável | Não foi possível carregar esta área agora | Tentar novamente | Voltar para o contexto seguro | Mostrar correlação de forma discreta se retry falhar ou sempre que o suporte precisar investigar |
| Erro da área do aluno | Não foi possível carregar seus cursos/conteúdo | Tentar novamente | Voltar aos meus cursos | Correlação visível, copiável e sem digest bruto |
| Erro do painel admin | Não foi possível carregar o painel | Tentar novamente | Nenhuma ou voltar à operação, se seguro | Correlação visível para suporte/operação |
| Erro global | O Hub encontrou um problema inesperado | Tentar novamente | Ir para uma rota pública/entrada, se disponível | Correlação; não depender do shell nem expor stack/digest |
| Manutenção agendada | A plataforma estará temporariamente indisponível | Voltar depois / atualizar | Status ou suporte | Horário e fuso somente se a previsão for confiável |
| Manutenção em curso | Estamos realizando uma manutenção | Tentar novamente mais tarde | Ver status | Última atualização e próxima atualização; `Retry-After` no HTTP quando aplicável |

O texto não deve afirmar que algo “não existe” quando o recurso pode estar
privado ou sem permissão. O RFC permite responder 404 para ocultar a existência
de um recurso proibido, mas isso é uma decisão de segurança do backend; a UI
deve ser neutra nesses casos e não revelar autorização ou existência de dados.

## Recomendações por superfície

### 1. `/not-found`

Refinar para um estado calmo de navegação, não para um erro alarmante. Trocar a
mensagem que mistura três causas por algo neutro como “Não encontramos essa
página” e uma linha curta orientando o retorno. Manter “Voltar aos meus cursos”
quando a entrada vier do fluxo autenticado; considerar um destino público ou
“Ir para o início” quando a rota puder ser acessada sem sessão.

Não exibir 404 grande, path completo, slug ou detalhes de autorização. O
primeiro botão deve levar a um lugar útil, não apenas repetir a navegação que
falhou.

### 2. `/error` e erros de segmento

Manter retry como primário e foco no título. Padronizar o texto entre raiz,
aluno e admin, trocando apenas o contexto (“esta página”, “seus cursos”, “o
painel”). O identificador de correlação deve ser uma linha de suporte com ação
de copiar, ou pelo menos uma apresentação que não pareça conteúdo principal.

O `digest` recebido pelo Next.js é útil para diagnóstico interno, mas não há
necessidade de expô-lo junto com a correlação. Se for mantido por exigência
operacional, rotulá-lo como referência adicional e ocultá-lo em disclosure;
isso evita uma parede de identificadores técnicos.

### 3. `/global-error`

Usar a mesma hierarquia de recuperação, mas com uma composição autossuficiente:
marca, título, explicação, retry e uma rota de entrada segura. Não importar
componentes que dependam do root layout sem verificar que são independentes.
Garantir `<html lang="pt-BR">`, estilos mínimos, foco e contraste mesmo quando
o restante da aplicação não renderiza.

A diferença visual para `/error` deve ser pequena. A diferença de conteúdo é
que a recuperação alternativa precisa funcionar sem assumir sessão, sidebar,
toast, provider ou contexto de rota.

### 4. `/manutencao`

Tratar como comunicação operacional confiável, não como uma tela vazia. A
versão mínima deve conter: “o que está indisponível”, “o que está sendo feito”,
quando haverá nova atualização e um link para status/suporte, se esses canais
existirem. Mostrar janela de término somente quando houver compromisso real;
caso contrário, usar “próxima atualização até [hora]”. Não inventar countdown.

Separar visualmente manutenção agendada de incidente ativo. Para a primeira,
informar janela; para o segundo, informar impacto conhecido e última
atualização. Se a manutenção for somente de uma área, não bloquear nem
descrever a plataforma inteira como indisponível.

### 5. Erro da área do aluno

Este é o estado com maior valor de recuperação contextual. O texto deve dizer
que cursos/conteúdo não carregaram, manter retry como ação principal e oferecer
“Voltar aos meus cursos” como ação secundária. O identificador deve acompanhar
o fluxo de suporte. A mesma receita pode ser aplicada ao erro admin, trocando
apenas o destino seguro e o contexto textual.

## Responsividade e acessibilidade

- Primeiro viewport com título, motivo e ação sem exigir rolagem em mobile.
- Largura limitada para leitura, mas sem `min-width` que force overflow.
- Ações com `flex-wrap`/empilhamento e área de toque confortável.
- Foco no título depois de renderizar uma falha; foco no botão depois de uma
  tentativa de retry somente se isso não esconder o novo resultado.
- `aria-live` para mudança de estado de retry/manutenção, sem anunciar texto
  repetitivo a cada renderização.
- Contraste e significado sem depender só de vermelho, verde ou ícone.
- Identificadores longos devem quebrar, ser selecionáveis e ter alternativa de
  cópia; nunca incluir token, e-mail, stack ou URL privada.
- Metadados 404 devem continuar `noindex`; manutenção e falhas temporárias
  não devem ser indexadas como páginas de conteúdo.

## Ordem recomendada para uma futura implementação

1. Extrair a linguagem visual compartilhada e alinhar `/error`,
   `/(student)/app/error` e `/(admin)/admin/(dashboard)/error`, preservando
   os handlers de Sentry e os contratos de retry.
2. Refinar `/global-error` de modo independente do layout raiz.
3. Refinar `/not-found` com destino contextual e copy neutra.
4. Refinar `/manutencao` com estados agendado/ativo, última atualização e
   canal oficial de status, somente se o produto fornecer esses dados.
5. Adicionar testes de acessibilidade/comportamento para foco, retry,
   correlação, texto longo, viewport estreito e ausência de detalhes técnicos.

Não recomendo adicionar uma nova biblioteca visual, uma ilustração externa ou
um status page falso para preencher espaço. A melhoria de maior impacto é
padronizar o contrato de recuperação e deixar cada estado honesto sobre o que
aconteceu e o que a pessoa pode fazer a seguir.
