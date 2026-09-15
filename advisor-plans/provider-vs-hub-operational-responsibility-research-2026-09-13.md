---
status: research
owner: product-and-engineering
research_date: 2026-09-13
repository_branch: staging
repository_commit: 2bfcf38e7f33762c31a1e89ab71281ae7259057a
---

# Pesquisa externa: responsabilidade do Hub e dos provedores

## Escopo e método

Esta nota avalia se o Hub deve reproduzir operações que já existem nos portais
do Resend e da JMVStream ou se deve manter somente o estado necessário para o
negócio, alertar e encaminhar a operadora ao provedor. Foram consultados o
código e os documentos canônicos do Hub e documentação oficial atual do
Resend, JMVStream, Stripe, Mux e Cloudflare Stream.

As conclusões abaixo distinguem fato documentado de inferência aplicada ao Hub.
Nenhum segredo, payload, endereço de e-mail ou credencial é reproduzido.

## Fatos dos provedores

### Resend

O Resend documenta que webhooks são notificações de eventos, podem ser
reenviados manualmente pelo Dashboard e possuem entrega pelo menos uma vez.
Também documenta que a ordem dos eventos não é garantida e que o endpoint deve
tratar duplicatas pelo identificador do evento. O provedor tenta novamente
quando não recebe resposta 2xx, usando backoff; a página de retries permite
replay manual de eventos.

Fontes: [Managing Webhooks](https://resend.com/docs/webhooks/introduction),
[Retries and Replays](https://resend.com/docs/webhooks/retries-and-replays).

O Dashboard do Resend é a superfície de detalhe para mensagens enviadas: ele
mostra eventos como `sent`, `delivered`, `delayed`, `bounced`, `failed`,
`suppressed` e `complained`, além de logs associados à mensagem. Isso é
responsabilidade do provedor, não precisa ser reconstruído na interface do
Hub.

Fonte: [Managing Emails](https://resend.com/docs/dashboard/emails/introduction).

### JMVStream e plataformas de vídeo equivalentes

A API pública da JMVStream documenta consulta de vídeo, status de conversão,
deleção assíncrona e upload multipart direto. O detalhe do processamento e do
ativo externo pertence à API/portal da JMVStream; o Hub deve apenas manter o
vínculo do ativo com a Aula e consultar o estado necessário para publicação e
reprodução.

Fonte: [Public API JMVStream](https://jmvstream.com/en/developer).

Mux documenta o mesmo limite: webhooks avisam o sistema da aplicação quando um
ativo fica pronto ou apresenta erro, enquanto o Dashboard configura os
endpoints e o recurso externo permanece consultável. A entrega pode ser
repetida e continuar por 24 horas; a aplicação deve aceitar duplicatas e
processar assincronamente. A documentação recomenda webhooks para acompanhar
status de ativos em vez de polling contínuo.

Fonte: [Listen for webhooks](https://www.mux.com/docs/core/listen-for-webhooks).

Cloudflare Stream também separa o processamento externo da projeção da
aplicação: o webhook informa que o vídeo está pronto ou em erro, e a API
continua sendo a fonte de detalhes do ativo.

Fonte: [Use webhooks](https://developers.cloudflare.com/stream/manage-video-library/using-webhooks/).

### Stripe como referência de integração assíncrona

O Stripe mantém no Dashboard uma área de entregas de eventos com status,
tentativas e horário do próximo retry, oferece reenvio manual e recomenda que
os handlers sejam assíncronos, idempotentes e independentes da ordem de
chegada. Isso combina visibilidade no provedor com uma projeção local mínima
na aplicação.

Fontes: [Receive Stripe events](https://docs.stripe.com/webhooks?lang=node),
[Manage event destinations](https://docs.stripe.com/workbench/event-destinations).

## Modelo recomendado para o Hub

O modelo mais simples e seguro não é escolher entre “tudo no Hub” e “tudo no
provedor”. É um modelo híbrido com ownership explícito:

- o provedor é dono da execução técnica: SMTP, reputação, bounce, supressão,
  detalhes de entrega, transcodificação, armazenamento externo e logs de
  tentativas;
- o Hub é dono do negócio: qual Aluno, Curso, Aula, Certificado ou Pedido deu
  origem à operação, se a intenção deveria existir, qual publicação está
  vigente e quais consequências o estado tem para o produto;
- o Hub mantém uma projeção local mínima, com correlação, estado conhecido,
  tentativa, erro seguro e vínculo com o agregado. Essa projeção não tenta ser
  uma cópia do Dashboard do provedor;
- a interface do Hub mostra o alerta e o próximo destino: “revisar no Hub”
  quando a causa é local, ou “abrir Resend/JMVStream” quando a causa exige
  detalhe ou mutação no provedor;
- qualquer ação local que possa produzir duplicata exige idempotência, motivo,
  auditoria e confirmação do agregado. A presença de um botão de retry não deve
  transformar o Hub em uma segunda console do provedor.

## Aplicação ao código atual

O desenho de e-mail já tem bons fundamentos. `outbox_messages` registra a
intenção local; `email_messages` registra uma projeção do lifecycle; e
`resend_webhook_events` guarda uma inbox mínima para que um webhook aceito com
HTTP 200 ainda possa ser processado depois. Essa inbox é necessária: depois que
o Hub persiste e confirma o webhook, uma falha posterior do worker não deve
depender de o Resend enviar novamente o mesmo evento.

O problema atual está na superfície administrativa, não na existência da
projeção local. O alerta de dead letter de e-mail conta a inbox de webhooks do
Resend, mas a tabela aberta lista a Outbox. A solução coerente é mostrar o
resumo local e direcionar o detalhe para o Resend ou para uma lista local de
eventos não correlacionados, sem renomear o problema para dead letter da
Outbox.

Para JMVStream, o desenho está mais próximo do recomendado: o Hub guarda
sessões, vínculo, estado de upload/deleção e bloqueia publicação sem player
pronto; a tela mostra sinais locais e oferece o portal JMVStream para o detalhe
externo. Retry local continua justificável para uma intenção iniciada no Hub,
como confirmar, sincronizar ou excluir um ativo associado. Erros de codec,
transcodificação ou estado detalhado do ativo devem ser resolvidos na JMVStream.

## Limites que não devem ser misturados

- Bounce ou supressão: o Resend explica o motivo; o Hub decide se o endereço da
  Conta ou a regra de negócio precisa ser corrigida.
- Webhook do Resend não correlacionado: o Resend pode replayar o evento, mas o
  Hub precisa corrigir a associação ou o processamento local antes; replay
  sozinho pode repetir o mesmo erro.
- Falha de envio do certificado: o Resend é responsável pela entrega; o Hub
  continua responsável por manter o Certificado válido e disponível. Falha de
  notificação não deve invalidar o Certificado.
- Vídeo em processamento: a JMVStream é responsável pela conversão; o Hub
  decide se a Aula pode ser publicada ou reproduzida.
- Ativo apagado ou desvinculado manualmente no provedor: o Hub precisa detectar
  a divergência porque conhece a relação com a Aula e a publicação vigente.

## Decisão ainda pendente

Antes de implementar, o produto precisa ratificar três escolhas: se o alerta
de e-mail será apenas um aviso de prioridade alta ou crítico; se o Hub terá uma
lista mínima de eventos Resend dead letter ou somente link externo; e se a ação
de recuperação de um evento não correlacionado será replay no Resend, retry
local após correção ou apenas reconhecimento/auditoria. Essas escolhas mudam o
contrato operacional e devem ser registradas em ADR antes de uma alteração
irreversível.
