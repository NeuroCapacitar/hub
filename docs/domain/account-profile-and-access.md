---
status: canonical
owner: engineering
last_verified_commit: 6bf5d693fd565c7c4c0c4bd9b7754efca92c2b44
---

# Perfil da Conta e continuidade de acesso

Este guia detalha a implementação de Perfil e métodos de entrada definida por
[REG-IDA-009](identity-and-authorization.md#reg-ida-009-perfil-compartilhado-e-métodos-de-entrada).
O contrato de reembolso continua em
[REG-COM-008](commerce-and-access.md#reg-com-008-reembolso-exige-confirmação-recente-e-permissão).

## Imagem de perfil privada

A imagem personalizada continua sendo servida por `GET /api/account/avatar`.
O endpoint deriva a Conta exclusivamente da sessão atual, verifica o estado de
suspensão e responde com `Cache-Control: private, no-store`. O navegador nunca
envia um `userId` nem recebe a chave do objeto R2.

O upload limita os bytes reais de todo o multipart antes de materializar campos:
5 MiB de imagem mais 1 MiB para campos e envelope. O limite vale também para
campos excedentes e requisições sem `Content-Length` ou com tamanho declarado
incorreto. A leitura termina em até 15 segundos; excesso retorna `413`, leitura
incompleta por prazo retorna `408`, sem gravar o avatar.

Para que a substituição da imagem seja refletida após `router.refresh()`, a
sessão inclui na URL um `revision` opaco calculado a partir da chave ativa. A
revisão serve apenas para mudar o `src` quando o upload troca o objeto; não
autoriza a leitura, identifica publicamente a Conta nem substitui a verificação
de sessão do endpoint.

## Associação com Google

`linkSocial` retorna ao Perfil após uma associação bem-sucedida e usa um
`errorCallbackURL` apontado para a mesma seção quando o provider retorna uma
falha. A tela traduz somente códigos conhecidos, como cancelamento e e-mail
diferente, em mensagens próprias. `error_description` do provider não é exibido
e os parâmetros transitórios são removidos da URL após a leitura.

Esse retorno contextual não altera a política de identidade: o primeiro vínculo
com uma Conta existente continua exigindo a prova local já definida em
REG-IDA-008.

## Navegação até Perfil administrativo

O atalho **Minha conta** aponta para `/admin/configuracoes?tab=perfil`. As tabs
administrativas são controladas pelo valor da URL e mantêm esse valor atualizado
ao trocar de seção. Assim, o atalho ativa Perfil mesmo quando Configurações já
está montada em Certificados ou Plataforma. Configurações do Student permanece
sem tabs.

## Acesso ao reembolso sem senha local

Uma Conta criada por convite ou vinculada somente ao Google pode não ter uma
credencial local. A interface verifica os métodos da própria sessão ao abrir a
operação de reembolso. Sem credencial, oferece `/recuperar-senha` em outra aba;
depois de definir a senha pelo fluxo Better Auth, a pessoa volta ao Pedido e
atualiza a verificação. A configuração atual não revoga a sessão existente no
reset; a tela do Pedido permanece autenticada na outra aba.

A nova senha não autoriza o reembolso por si só. O fluxo continua exigindo a
senha recém-definida, a confirmação server-side existente, a confirmação do ID
do Pedido, o motivo e a permissão `executeRefund`. A consulta de métodos serve
somente para orientar a interface; nenhuma decisão de autorização financeira é
tomada no cliente.

## Implementação e testes

- `src/lib/session.ts` cria a revisão opaca da imagem privada.
- `src/app/api/account/avatar/route.ts` continua responsável por sessão,
  suspensão e ownership.
- `src/components/account/account-security-panel.tsx` lida com o retorno de
  erro de `linkSocial`.
- `src/components/panel-layout.tsx` e
  `src/app/(admin)/admin/configuracoes/admin-settings-tabs.tsx` mantêm a
  navegação de Perfil consistente com a URL.
- `src/app/(admin)/admin/financeiro/financial-refund-operation.tsx` orienta
  contas sem credencial e preserva a confirmação server-side.
- Os testes desses módulos cobrem troca do `src`, erros do Google, navegação
  entre tabs e os estados de credencial do reembolso.
