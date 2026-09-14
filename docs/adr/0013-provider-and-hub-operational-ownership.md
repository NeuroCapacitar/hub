---
status: accepted
owner: product
last_verified_commit: 2bfcf38e7f33762c31a1e89ab71281ae7259057a
---

# ADR-0013 Ownership operacional entre Hub e provedores

O Hub integra serviços externos para executar tarefas técnicas, mas não deve
reproduzir seus portais nem transferir para eles decisões de negócio. O Hub
deve manter o contexto e a projeção mínima necessários para proteger o produto;
Resend e JMVStream devem continuar sendo as autoridades sobre sua execução
técnica.

## Decisão

O Hub é responsável pela intenção de negócio, pela associação com Conta,
Pedido, Matrícula, Curso, Aula ou Certificado, pela idempotência, pela
reconciliação e pela decisão sobre impacto no produto. O provedor é responsável
por sua execução externa, detalhes técnicos, logs, reputação, processamento e
controles específicos do serviço.

O Hub persiste somente uma projeção operacional mínima: último estado conhecido,
correlação, identificadores externos necessários, tentativa, erro seguro e
auditoria. Essa projeção não substitui o estado do provedor nem tenta copiar seu
Dashboard.

Problemas técnicos de entrega de e-mail, bounce, supressão, domínio, reputação,
logs e replay de webhook devem direcionar o Admin ao Resend. Problemas de
codec, conversão, armazenamento externo, player e thumbnail devem direcionar o
Admin à JMVStream. Problemas de intenção, associação, publicação, acesso,
idempotência ou estado local devem permanecer no Hub.

Eventos externos continuam sendo recebidos, validados e processados de forma
assíncrona no Hub, porque o provedor pode considerar o webhook entregue antes
de o worker local concluir. Duplicatas, ordem de chegada e retries não podem
alterar essa fronteira.

Falha de notificação não bloqueia, por si só, acesso, conclusão, Certificado,
publicação ou disponibilidade do conteúdo. Qualquer replay ou retry que possa
repetir efeito externo exige motivo, idempotência quando possível, autorização
e auditoria.

## Consequências

O Admin recebe alertas simples, contexto mínimo e o próximo destino, sem uma
segunda console do Resend ou da JMVStream. A Outbox, a inbox de webhooks do
Resend e os estados locais de mídia permanecem necessários, mas cada um deve
ser exibido com seu nome e sua responsabilidade corretos.

Uma operação local pode existir mesmo quando o detalhe ou a correção final
pertence ao provedor. Isso permite sobreviver a quedas, reconciliar estados e
relacionar uma falha externa ao negócio sem armazenar payloads ou PII.

## Alternativas consideradas

- **Somente o provedor:** rejeitada porque um webhook aceito pelo Hub pode falhar
  no processamento posterior e porque o provedor não conhece o contexto de
  negócio, a associação local ou as regras de acesso e Certificado.
- **Duplicar o provedor no Hub:** rejeitada porque aumenta superfície, custo,
  manutenção e risco de divergência sem melhorar a autoridade técnica.
- **Modelo híbrido:** escolhido porque mantém o Hub simples como orquestrador e
  o provedor como executor, com uma ponte local mínima e observável.
