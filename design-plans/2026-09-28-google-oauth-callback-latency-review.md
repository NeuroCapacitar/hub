# Análise do tempo no callback de login Google

**Verificado em:** 28/09/2026. Revisão do fluxo no código e documentação primária; o tempo total de 1–2 s foi observado pelo usuário, mas não foi separado por etapa no Network.

## Design language

- **Superfície auditada:** continuação após Google OAuth em `/oauth/callback`.
- **Fontes de design e produto:** `DESIGN.md`; `docs/domain/identity-and-authorization.md` (REG-IDA-008); `docs/decisions.md` (DEC-DISC-020).
- **Decisão governante:** login e cadastro social são separados; o destino final continua sensível a papel, bloqueio e `returnTo` de compra validado.
- **Owners/runtime:** `getGoogleOAuthCallbackUrl`, `GoogleAuthButton`, `GoogleOAuthCallbackPage`, `GoogleOAuthCallbackClient`, `/api/auth/redirect` e `getCurrentSession`.
- **Exceções explícitas:** nenhuma documentada.

## Findings

| # | Problema | Evidência | Mudança proposta | Escopo | Confiança |
| --- | --- | --- | --- | --- | --- |
| 1 | O sucesso OAuth passa por uma página visível, hidratação do cliente, GET adicional de sessão/role e navegação seguinte; isso cria um intervalo observável antes do destino. | O usuário percebe 1–2 s. O callback cliente faz `fetch('/api/auth/redirect')` e só então `window.location.replace`; a API lê a sessão, o perfil e registra último acesso. Não há trace que atribua toda a latência a essa sequência. | Resolver o destino role-aware no servidor durante a renderização do callback e redirecionar antes de renderizar a interface de espera; preservar a tela cliente apenas para erro/bloqueio e reutilizar uma única política de destino. | `oauth/callback/page.tsx`, política de redirect compartilhada, `/api/auth/redirect` e testes de callback. | Alta para a existência do salto adicional; média para quanto dos 1–2 s ele explica. |

## Alternativas consideradas

- **Manter a página cliente e polir o estado de espera:** preserva a lógica existente e pode tornar o intervalo mais compreensível; não remove hidratação nem a chamada adicional. A tela atual já comunica “Concluindo seu acesso” e “Aguarde um instante…”. `DESIGN.md` permite um `animate-spin` discreto acompanhado de texto, mas isso só reduz a incerteza percebida.
- **Redirecionar diretamente a `/app`:** não recomendado. Ignora o destino de Admin/Suporte, o tratamento de Conta bloqueada e o retorno seguro a `/comprar/<slug>`.
- **Redirecionar no servidor após ler a sessão:** recomendado para o fluxo de sucesso. Mantém o callback de protocolo do Google separado do destino do Hub, preserva a regra por papel e remove a dependência de hidratação e do GET do cliente. Em Next.js, `redirect()` pode encerrar uma Server Component/Route Handler; se a resposta já estiver em streaming, Next pode emitir um redirect via meta tag, então a decisão deve ocorrer antes de renderizar/streamar o shell.
- **Deixar a chamada direta `/api/auth/redirect` como `callbackURL`:** não recomendado porque a rota retorna JSON para consumidores internos, não uma navegação de documento.

## Evidência e referências

O Google deve continuar retornando ao endpoint de protocolo `${BETTER_AUTH_URL}/api/auth/callback/google`; `callbackURL` é o destino posterior controlado pela aplicação. Better Auth documenta os destinos pós-login e novos usuários separadamente. [Better Auth 1.6 social sign-in](https://better-auth.com/docs/1.6/basic-usage) · [Better Auth 1.6 OAuth](https://better-auth.com/docs/1.6/concepts/oauth) · [Google OAuth para aplicações web server](https://developers.google.com/identity/protocols/oauth2/web-server)

Outros provedores seguem a mesma distinção: Supabase envia `redirectTo` para uma rota de callback da aplicação e restringe os destinos por allowlist; Clerk preserva `redirect_url` quando existe e usa fallback quando não existe. [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls) · [Clerk customize redirect URLs](https://clerk.com/docs/guides/development/customize-redirect-urls)

Next.js 16 documenta `redirect()` em Server Components e Route Handlers; em streaming, o redirect pode virar uma meta tag entregue ao cliente. [Next.js redirect](https://nextjs.org/docs/app/api-reference/functions/redirect)

## Improve first

Não remova `/oauth/callback` nem altere o URI cadastrado no Google. Prefira mover somente o **caminho de sucesso** para um redirect role-aware no servidor, mantendo a experiência atual de bloqueio/erro. Antes de implementar, confirme o perfil de tempo com Network: duração do documento `/oauth/callback`, `GET /api/auth/redirect` e navegação subsequente para `/app`. O teste focado atual passou (51/51), mas não cobre diretamente Aluno sem `returnTo` na callback cliente; o E2E Playwright passou (52/52) com OAuth real desativado.

Se a sessão não for reconhecida, esse redirect de servidor não resolverá a causa: o próximo diagnóstico deve verificar somente status e campo `redirectTo` de `/api/auth/redirect`, sem registrar cookies, códigos ou tokens.
