---
status: canonical
owner: engineering
last_verified_commit: 4b3c9b8a80b3bf3628b53c983dfd56d7ebec5b8d
---

# JMVStream

## Responsabilidade

Hospedar vídeo, organizar galerias por Curso e fornecer player/thumbnail. O Hub persiste a sessão operacional e relaciona `video_hash` à Aula.

Contrato oficial consultado: [Public API JMVStream](https://jmvstream.com/en/developer), que documenta upload multipart direto e `gallery` opcional no complete. Em 2026-07-27, o recurso configurado autenticou e a consulta somente leitura retornou as três pastas reais. CORS, upload multipart e o contrato `gallery` continuam dependendo de um envio funcional controlado.

## Configuração correta

- `JMVSTREAM_API_BASE_URL`: default `https://api.jmvstream.com`.
- `JMVSTREAM_AUTH_RESOURCE`: UUID do recurso/aplicação enviado a `/v2/authenticate`; não é e-mail, senha nem JWT.
- `JMVSTREAM_API_TOKEN`: JWT opcional de fallback.
- `JMVSTREAM_PLAN_ID`: identificador usado em operações que exigem plano.
- `DEVELOPMENT_JMVSTREAM_USES_PRODUCTION`: confirmação explícita exigida quando
  o desenvolvimento local reutiliza o plano Production.

Preferir `JMVSTREAM_AUTH_RESOURCE`; `authenticateJmvstreamApi` renova token. `assertValidJmvstreamResource` rejeita valor que não pareça UUID e orienta quando recebeu JWT.

### Development compartilhando o plano Production

Por decisão operacional, o ambiente Development reutiliza o plano Production.
A API oficial autoriza upload por token e exclusão por `video_hash` mais Plan
ID; portanto, a credencial local possui capacidade de alterar ativos reais.

O preflight exige `DEVELOPMENT_JMVSTREAM_USES_PRODUCTION=true`. Essa confirmação
não cria isolamento técnico. Em Development:

- envie somente vídeos descartáveis, sem dados pessoais;
- não associe manualmente hashes de vídeos preexistentes;
- não teste deleção, movimentação ou retry com hashes que não foram criados
  pelo próprio ambiente Development;
- confira o hash antes de qualquer operação destrutiva;
- trate vazamento da credencial local como incidente Production.

## Modelo local

- `jmvstream_folders`: pasta por Curso/Módulo, estados `active`, `failed`, `needs_review`.
- `jmvstream_video_assets`: upload, player, thumbnail e deleção.
- estados de upload incluem sessão ativa, processamento, pronto e falha conforme enums de `src/db/schema.ts`.

O registro local não substitui o ativo externo; ambos precisam ser reconciliados.

## Upload multipart

1. `ensureJmvstreamCourseFolder` localiza/cria galeria do Curso.
2. `initJmvstreamUpload` valida arquivo, calcula partes e chama `/v2/upload/multipart/s3`.
3. O navegador executa `uploadFileParts` diretamente nas URLs assinadas.
4. Cada PUT retorna ETag; o cliente coleta `{ partNumber, etag }`.
5. `completeJmvstreamUpload` chama `/v2/upload/multipart/complete`.
6. `syncJmvstreamLessonPlayer` busca player/thumbnail e associa à Aula.

Parâmetros em `src/features/jmvstream/upload-config.ts`:

- chunk 64 MiB;
- concorrência 4;
- mínimo multipart 5 MiB;
- máximo 10.000 partes;
- máximo 5 TiB.

Arquitetura e racional: [ADR-0003](../adr/0003-jmvstream-direct-multipart-upload.md).

## Contradição `gallery`

A documentação histórica do projeto orientava omitir `gallery` no complete. `createJmvstreamClient.completeMultipartUpload`, no `HEAD`, sempre envia `gallery: input.galleryUuid`; a documentação oficial atual define o campo como opcional.

Isso permanece bloqueio de contrato, não uma correção assumida. Antes de mudar:

1. capturar request/response em ambiente de teste sem secrets;
2. confirmar se o UUID de `jmvstream_folders` é o valor aceito no complete;
3. testar com e sem o campo;
4. registrar o contrato validado e adicionar teste.

Até lá, a documentação descreve o payload real do código e não promete compatibilidade de produção.

## Sincronização e limpeza

- cron `/api/cron/jmvstream` adquire o lease, expira sessões de upload stale e
  chama `syncPendingJmvstreamPlayers` a cada quinze minutos;
- a execução adquire advisory lock de sessão; uma segunda invocação retorna
  `skipped` sem repetir chamadas externas;
- `expireStaleJmvstreamUploads` marca sessões abandonadas;
- remoções chamam funções por Aula/Módulo/Curso e persistem falha para retry;
- `retryJmvstreamAssetDelete` só deve operar após conferir o hash;
- upload manual por URL usa `syncManualJmvstreamVideoAsset`.

`getJmvstreamHealthSummary`, usado em Admin > Configurações, é somente leitura:
ele não expira uploads nem altera `jmvstream_video_assets`. A tela exibe apenas
pendências/falhas locais acionáveis e aponta a operadora para o portal JMVStream
quando a investigação pertence ao provider.

O portal JMVStream é a autoridade para processamento, conversão, armazenamento,
player, thumbnail e detalhes técnicos do ativo. O Hub é a autoridade para a
associação do ativo com a Aula, a publicação e o efeito de uma falha na
experiência do Aluno. A tela não deve reproduzir logs ou controles do provedor;
deve mostrar o estado local mínimo e encaminhar o detalhe externo ao portal.

## Falhas e recuperação

- 401/403 => conferir resource/token e autenticação, sem expor valores;
- CORS/ETag ausente => conferir origem, métodos PUT e headers expostos no provedor;
- parte falhou => repetir a parte, preservando ETags válidos;
- complete falhou => não criar nova sessão até consultar estado da atual;
- player pendente => cron/manual sync;
- player com ativo local `failed` => a experiência do Aluno interrompe o polling e oferece suporte; não expor `last_error` do provedor;
- deleção falhou => manter registro `needs_review` e tentar pelo comando autorizado;
- hash já associado => `assertJmvstreamVideoHashAvailable` deve impedir duplicidade.

## Segurança

URLs assinadas são temporárias; credenciais ficam server-only. Validar tipo/tamanho antes de iniciar. Não logar token, URLs assinadas completas ou payload com credenciais.

O cron JMVStream permanece ativo em Production para reconciliar vídeos que ainda
estão em processamento, mas não roda automaticamente em Staging. Em Staging,
use `Run Staging jobs` durante a homologação. O intervalo de quinze minutos
reduz despertares do Neon sem remover a recuperação automática.

## Retomada de reprodução

O Hub persiste a posição observada (`current_seconds`), a posição de retomada
(`resume_position_seconds`), a maior posição observada (`max_position_seconds`),
a fronteira linear validada (`validated_position_seconds`) e o tempo de
reprodução (`playing_time_seconds`). Depois de receber um evento válido do player
em resposta a `jmvplayer-sync`, envia `jmvplayer-jump` com a posição de retomada
(`jump`) para restaurar a Aula sem iniciar nem concluir automaticamente. A
primeira resposta após o salto é descartada pela gravação de progresso para
impedir conclusão por reabertura.

O endpoint de progresso trata `current_seconds`, `duration_seconds` e o nome do
evento vindos do navegador como entrada não confiável: somente eventos OUT
reconhecidos são aceitos, a duração do player passa por validação de faixa e o
servidor usa a duração de vídeo persistida na Aula como autoridade. O valor do
navegador não substitui a duração persistida. `max_position_seconds` permanece
a posição máxima observada; `watched_percent`, para registros do tracking novo,
é a projeção da fronteira linear validada, enquanto registros antigos não são
tratados como validados. Nenhum desses valores prova atenção humana. Um `skip` não avança a fronteira linear nem
libera conclusão automática; a reprodução posterior pode aumentar o tempo
analítico, mas precisa retornar ao trecho pendente para continuar a fronteira.

O comando é documentado na página oficial de eventos do player, marcada pelo próprio provedor como referência antiga; ele deve ser confirmado contra um player real antes de promover uma mudança de versão da integração.

## Evidências

- cliente: `src/features/jmvstream/client.ts`;
- upload browser: `src/features/jmvstream/upload.ts`;
- orquestração: `src/features/jmvstream/server.ts`;
- ações: `initJmvstreamUploadAction`, `completeJmvstreamUploadAction`;
- cron: `src/app/api/cron/jmvstream/route.ts`;
- testes: `src/features/jmvstream/*.test.ts`.
