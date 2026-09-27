# Análise: `surface-warm` e direção visual da autenticação

> Status: **pulada por decisão do produto**; nenhum código de produto foi alterado.
> Baseline: `6848a28b` (`feature/small-changes`).

## 1. `surface-warm`

### Estado atual

`surface-warm` já é um token semântico baseado em `brand-sand`, com foreground
escuro pareado. No produto, ele aparece no preview do Certificado; o restante
dos usos está restrito à fixture do design system. Isso é coerente com o
contrato atual de `DESIGN.md`, que define a superfície como institucional e de
uso raro.

### Avaliação

Não há evidência suficiente para pintar mais Cards com areia. O preview do
Certificado já usa a cor em um objeto que realmente tem materialidade e
significado de conquista. Aplicar o mesmo fundo a um empty state, CTA ou card
comum poderia comunicar um estado de sucesso onde existe apenas uma ação ou
uma ausência de dados.

### Decisão original da análise

**Não implementar uma ampliação agora.** Manter o token e o uso atual. Uma
experimentação futura pode comparar uma faixa sutil no arquivo de Certificados
para o estado `available`, mas isso deve ser validado como uma variação isolada,
sem alterar estados `pending`, `failed` ou `revoked`.

## 2. Autenticação como próxima superfície de expressão

### Estado atual

`src/components/auth-shell.tsx` já possui:

- formulário limitado a `max-w-[30rem]`;
- logo da plataforma separada do formulário;
- mídia institucional administrável no desktop;
- fallback, autoplay, pausa em hover e indicadores acessíveis;
- layout responsivo que oculta a mídia em telas menores.

`auth-shell-frame` hoje é deliberadamente transparente, ocupa a viewport e não
cria um segundo card em torno do fluxo.

### Oportunidade

O relatório sugere uma moldura externa para transformar o split em uma
superfície mais institucional e memorável. A ideia é válida, mas afeta entrar,
cadastro, recuperação e redefinição de senha ao mesmo tempo.

### Riscos

- formulários de cadastro e recuperação são mais altos que login e podem criar
  scroll ou uma moldura desproporcional;
- aplicar a mesma moldura no mobile, onde a mídia desaparece, pode gerar uma
  caixa vazia ou excessivamente pesada;
- borda, sombra e radius adicionais podem fazer o formulário parecer um modal,
  reduzindo a sensação de página confiável;
- o foco visível e a leitura linear precisam continuar intactos;
- uma imagem ou copy institucional nova não deve ser inventada sem asset e
  texto aprovados.

### Pesquisa externa

Auth0 recomenda separar personalização de marca de alterações estruturais mais
arriscadas e manter a experiência de autenticação centralizada e segura:
[Auth0 — Universal Login](https://auth0.com/docs/brand-and-customize/universal-login-page-templates).
Clerk também trata layout, links e tema como camadas independentes de
customização: [Clerk — Appearance](https://clerk.com/docs/js-frontend/guides/customizing-clerk/appearance-prop/overview).

### Decisão original da análise

**Não aplicar a moldura diretamente ainda.** O produto decidiu pular esta
sugestão. Primeiro criar um mock/fixture
com três estados reais:

1. login curto;
2. cadastro longo;
3. recuperação/redefinição de senha.

O mock deve comparar: sem moldura, moldura desktop com margem e moldura
adaptada no mobile. Só implementar depois de confirmar que a variante escolhida
preserva altura, foco, scroll, copy, mídia e links de recuperação.

## Resultado

`surface-warm` não é a próxima alteração de código; a frequência atual é
intencional e suficiente. A próxima sugestão de alto impacto é a direção visual
da autenticação, mas ela também foi **descartada pelo produto**. Esta nota é
apenas o registro das decisões rejeitadas.
