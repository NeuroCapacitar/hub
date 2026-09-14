---
status: accepted
owner: product
last_verified_commit: d33c9eb645db9c985c9381dfd60e4031e5a1f8ad
---

# Identidade de Aula e estado entre publicações

Uma `CoursePublication` materializa novas linhas físicas de Módulo e Aula, mas
nem todo estado deve acompanhar esse novo identificador. Esta decisão separa a
identidade pedagógica estável (`curriculum_key`) da identidade física da
publicação e define quando um estado pode atravessar essa fronteira.

## Decisão

| Estado | Identidade e regra |
| --- | --- |
| Conteúdo | Pertence à Aula física da publicação. Alteração pedagógica grande cria novo `curriculum_key`. |
| Conclusão da Aula | Persiste por Aluno + Curso + `curriculum_key`. |
| Conclusão do Curso | Persiste por Aluno + Curso e continua histórica. |
| Analytics | Permanece associado à publicação e à Aula física que originou o evento. Não há reescrita ao publicar. |
| Watch de vídeo | Pode ser projetado para a Aula atual somente no mesmo Curso, mesmo `curriculum_key`, `video_provider = 'jmvstream'` e mesmo `video_external_id` não vazio. |
| Links manuais | Não possuem identidade de mídia confiável para transferência automática; começam sem watch na publicação nova. Se tiverem duração válida, continuam podendo usar tracking na publicação atual. |
| Campos transferíveis de watch | Retomada, fronteira validada, posição máxima e bloqueio linear, sempre recalculados contra a duração atual. Tempo reproduzido, sessão, sequência e eventos não são transferidos. |
| Registros legados | A retomada antiga é preservada, mas não vira fronteira validada. A conclusão automática exige reprodução linear desde o início; conclusão manual continua disponível. |
| Sessão de vídeo | O servidor emite o token da sessão. A última sessão aberta vence; eventos de token anterior não alteram o estado atual. |
| Discussão | Comentários acompanham Curso + `curriculum_key`. Não são copiados e não recebem indicação de versão na experiência do Aluno. |
| Título corrente | Experiências atuais usam `courses.title`. `title_snapshot` e snapshots de Certificado são históricos. Um novo Certificado captura o título atual no momento da emissão; Certificados existentes não mudam. |
| DLQ de suporte | Se o `support_request` não existir, a entrega termina como `support_request_unavailable`; Admin pode encerrar explicitamente a mensagem como `superseded`. O payload não recebe dados pessoais. |

## Identidade de mídia

`curriculum_key` sozinho nunca autoriza a transferência de watch. Para o
provedor atual, a identidade mínima é a combinação do provedor JMVStream com o
`video_external_id` persistido. Um identificador ausente ou pertencente a outro
provedor impede a transferência automática.

## Publicação e histórico

Projetar watch é uma leitura de compatibilidade e materialização sob demanda,
não uma migração dos eventos históricos. O registro da publicação anterior
continua disponível para auditoria e analytics. A publicação nova recebe uma
linha local somente quando o aluno inicia ou assume uma sessão nela.

## Alternativas rejeitadas

- Transferir todo watch por `curriculum_key`: poderia aplicar a retomada de um vídeo antigo a uma mídia diferente.
- Usar somente URL manual como identidade: normalização, parâmetros e redirecionamentos não provam que a mídia é a mesma.
- Converter `current_seconds` legado em validação: transformaria observação histórica em evidência nova.
- Usar timestamp enviado pelo navegador para ordenar abas: o valor é manipulável e não resolve eventos atrasados.
- Copiar comentários na publicação: duplicaria moderação e quebraria a continuidade da discussão.
- Guardar assunto, mensagem, nome ou e-mail no payload da Outbox: prolongaria retenção de dados pessoais.

## Consequências

O modelo preserva o que é pedagógico ou histórico sem misturar mídia,
analytics e sessão. Vídeos manuais podem ser publicados sem duração, mas não
terão conclusão automática até que uma duração positiva seja persistida; o
Aluno continua podendo concluir manualmente. A interface informa bloqueios de
progresso linear e a operação informa quando uma DLQ não pode mais ser
reprocessada.
