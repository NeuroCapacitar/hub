# Pesquisa: remediação de recuperação de senha e E2E

Data da pesquisa: 2026-10-01 (America/Sao_Paulo). As páginas vivas abaixo não exibem uma data de publicação verificável; datas de publicação são informadas quando a fonte as apresenta. Todas foram consultadas em 2026-10-01.

## Recuperação de senha e enumeração de contas

O endpoint `POST /request-password-reset` do Better Auth procura o usuário e, se não o encontra, simula geração de token e consulta de verificação antes de retornar `status: true` com a mesma mensagem neutra usada no fluxo normal. Quando encontra a conta, gera o token, chama o envio de e-mail e retorna a mesma resposta. Isso é uma proteção deliberada, mas não prova que todo wrapper da aplicação preserve a mesma latência. [Implementação oficial do endpoint](https://github.com/better-auth/better-auth/blob/main/packages/better-auth/src/api/routes/password.ts).

O OWASP recomenda mensagem idêntica para contas existentes e inexistentes, tempo de resposta uniforme e limitação por conta contra envios automatizados. Portanto, o limite da solicitação de reset deve ser calculado a partir dos dados recebidos — por exemplo, um hash com chave do e-mail normalizado — sem consultar primeiro se a conta existe. O cliente também não deve receber uma diferença de status/corpo que revele a conta; o bloqueio interno pode simplesmente suprimir o envio e manter a resposta neutra. [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html) e [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html).

## Limitação de taxa e ordem do Better Auth

O Better Auth aplica sua limitação de taxa no pipeline de `auth.handler`; o código atual da branch `main` executa o limitador antes dos hooks `plugin.onRequest`. Assim, um wrapper do Next.js que faça lookup, lock ou gravação antes de chamar `auth.handler` executa antes dessa proteção. A posição deve ser conferida na versão instalada do pacote antes de escolher a seam definitiva. [Pipeline oficial](https://github.com/better-auth/better-auth/blob/main/packages/better-auth/src/api/index.ts).

O Better Auth documenta regras configuráveis por endpoint e armazenamento em memória, banco, secondary storage ou custom storage. Seu post da versão 1.5 descreve defaults mais estritos: 3 requisições/10 s para sign-in/sign-up e 3/60 s para reset de senha/OTP. O custom storage exige `consume` atômico (verificar e incrementar em uma única operação), evitando que requisições concorrentes ultrapassem o limite. O limitador interno é uma defesa por IP/endpoint, não substitui o limite por conta recomendado pelo OWASP. [Documentação de rate limit](https://better-auth.com/docs/concepts/rate-limit) e [post Better Auth 1.5](https://better-auth.com/blog/1-5); a data de publicação não aparece na página consultada.

Implicação para a remediação: aplicar o limite de IP antes do trabalho caro e adicionar um bucket por e-mail normalizado, sem consultar usuário para formar a chave. Usar armazenamento compartilhado/atômico se houver múltiplas instâncias; armazenamento somente em memória não compartilha o contador entre processos. Manter resposta externa, entrega de e-mail e trabalho observável neutros para contas existentes/inexistentes. Não fixar números além do default documentado sem validar volume e risco do produto.

## E2E de confirmação de e-mail seguida de matrícula

O Playwright recomenda testar comportamento visível ao usuário, isolar cada teste e controlar os dados do banco; também recomenda não depender de serviços de terceiros fora do controle do teste. Isso sustenta um cenário independente, com usuário/dados isolados e entrega de e-mail/token controlada pelo ambiente de teste, que confirme o e-mail, autentique a mesma conta e então execute a matrícula gratuita explícita. A asserção deve verificar o resultado visível de matrícula, não detalhes internos de funções ou classes. A documentação não especifica a regra de negócio deste Hub nem uma estratégia de captura de e-mail; essas partes continuam sendo contratos locais do projeto. [Playwright Best Practices](https://playwright.dev/docs/best-practices), [Test Fixtures](https://playwright.dev/docs/test-fixtures).

## Limites da evidência

As páginas Better Auth são documentação e código vivos. O pipeline citado é `main`, não necessariamente a cópia exata do Better Auth instalada no candidato; confirmar o comportamento na versão lockfile antes da mudança. O post 1.5 documenta os limites de reset mencionados, enquanto a documentação atual apresenta a configuração de regras customizadas; não presumir que qualquer wrapper externo esteja coberto pelo default. Não foi encontrada orientação oficial específica para o caminho de negócio “confirmar e-mail e depois autoinscrever-se em curso gratuito”; Playwright informa práticas de determinismo, não a semântica do produto.
