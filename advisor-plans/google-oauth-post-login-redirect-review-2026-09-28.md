# Revisão do destino após login Google

## Conclusão

O endereço persistir em `/oauth/callback` não é o comportamento final esperado pelo Hub. No fluxo atual, essa rota é uma página intermediária de aplicação: ela consulta `/api/auth/redirect` e, com a sessão já criada, navega para o destino adequado. Se o navegador permanece nela, a transição final não se completou; ainda não há evidência para apontar se falhou a hidratação/execução do cliente, a chamada do endpoint ou a resposta dessa chamada.

## Dois redirects diferentes

- **Redirect URI do Google:** o endpoint que recebe a resposta OAuth e o código de autorização. No Better Auth, o padrão é `${BETTER_AUTH_URL}/api/auth/callback/google`; essa URI precisa estar cadastrada exatamente no cliente OAuth do Google. Não é a página final do usuário. [Better Auth 1.6: Google](https://better-auth.com/docs/1.6/authentication/google), [Google: OAuth para aplicações web server](https://developers.google.com/identity/protocols/oauth2/web-server)
- **Destino após autenticação (`callbackURL`):** valor enviado a `authClient.signIn.social`. Better Auth guarda esse destino no estado OAuth e redireciona a ele depois de concluir o callback do provedor. O projeto passa `/oauth/callback` com um `returnTo` opcional; a página intermediária então pede o destino final à rota autenticada `/api/auth/redirect`. [Better Auth 1.6: OAuth](https://better-auth.com/docs/1.6/concepts/oauth)

Assim, `/api/auth/callback/google` e `/oauth/callback` têm papéis distintos. Alterar a URI registrada no Google para `/app` confundiria o callback de protocolo com a navegação de produto e quebraria o fluxo OAuth.

## Padrões documentados em outros provedores

- **Supabase:** `redirectTo` é um destino da aplicação e pode apontar para uma rota de callback própria; essa rota troca o código e estabelece a sessão. A lista de redirect URLs permitidos valida o destino. Isso confirma que uma rota intermediária não precisa ser a tela final do usuário. [Supabase: redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [Supabase: Google OAuth](https://supabase.com/docs/guides/auth/social-login/auth-google)
- **Clerk:** o fluxo preserva o `redirect_url` de origem quando existe; fallback é usado quando ele não existe. Um redirect forçado substitui a intenção anterior e pode interromper a jornada. [Clerk: customize redirect URLs](https://clerk.com/docs/guides/development/customize-redirect-urls)

O padrão comum é manter separados o retorno do provedor, o callback da aplicação e o destino final; preservar um retorno interno válido e aplicar um fallback explícito quando não há intenção anterior. Para o Hub, a escolha do destino também deve respeitar papel, bloqueio e compra guest-first.

## Evidência no Hub

- `src/components/google-auth-button.tsx` passa o `callbackURL` recebido ao `signIn.social`.
- `src/lib/auth-return-to.ts` constrói `/oauth/callback` e só preserva `returnTo` se ele for o caminho interno permitido `/comprar/{slug}`.
- `src/app/(auth)/oauth/callback/oauth-callback-client.tsx` consulta `/api/auth/redirect` e executa `window.location.replace` com o destino validado.
- `src/app/api/auth/redirect/route.ts` escolhe `/app` como padrão para Aluno, mantém o retorno seguro de compra e envia equipe para seu destino administrativo.
- O teste `src/app/(auth)/oauth/callback/oauth-callback-client.test.tsx` cobre redirecionamento final para equipe com `returnTo`; não cobre o caminho exato Aluno + sem `returnTo`. Os testes da API cobrem o fallback `/app` para `returnTo` inválido/repetido.
- A versão instalada é Better Auth `1.6.25`; a documentação oficial 1.6 descreve o contrato de `callbackURL` acima.
- Os testes focados de callback, redirect e validação de `returnTo` passaram (51 testes). O E2E Playwright anterior passou 52 testes, mas as credenciais Google foram neutralizadas; nenhum deles reproduz um login Google real.

## Recomendação

Manter a página intermediária e o destino final role-aware. Ela permite concluir a sessão, respeitar a política de bloqueio e encaminhar Aluno para `/app` ou para um `returnTo` interno previamente validado; a equipe vai para a área administrativa. Não mandar todo mundo diretamente a `/app`: isso ignora as diferenças de papel e o fluxo administrativo. Não usar `returnTo` arbitrário nem URL externa.

**Inferência de produto:** o comportamento mais simples e seguro é tratar `/app` como destino padrão apenas para Aluno sem `returnTo` válido, mantendo a decisão final no endpoint do servidor, que lê a sessão autenticada. O Hub já segue esse padrão; o relato indica uma falha operacional nessa última transição, não uma razão para trocar o redirect URI do Google.

## Próxima verificação se persistir

Em uma sessão autorizada, confirmar no Network se a página intermediária faz `GET /api/auth/redirect` e verificar apenas status e campo `redirectTo` da resposta:

| Evidência | Interpretação a investigar |
|---|---|
| Nenhuma chamada | Hydration/execução do cliente ou erro JavaScript na página intermediária. |
| `401` | O endpoint não leu uma sessão; conferir cookie e sessão após o callback do provedor. |
| `403` | Conta Student bloqueada; o fluxo deveria mostrar a orientação de bloqueio e encerrar a sessão. |
| `200` com `redirectTo: "/app"`, mas a URL não muda | Navegação cliente (`window.location.replace`) ou interceptação posterior da rota `/app`. |
| Outro status/destino | Investigar a consulta de sessão, papel e eventual `returnTo`. |

São hipóteses de localização, não causas confirmadas. Não registrar tokens, cookies ou dados pessoais. Esta nota não altera código nem conclui a causa-raiz.
