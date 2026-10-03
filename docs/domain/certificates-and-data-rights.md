---
status: canonical
owner: engineering
last_verified_commit: c10f0d2
---

# Certificados e dados técnicos

## Certificados

Cada Curso pode habilitar certificado e possuir um template publicado por vez.
O template tem arte A4 horizontal privada, campos padronizados e coordenadas
normalizadas. A administração recorta a arte na proporção A4 e envia o resultado
diretamente ao R2 por URL assinada. A Server Action recebe somente a referência
temporária; o servidor confirma tipo e tamanho, decodifica e normaliza a imagem
em WebP. Fundo e assinatura aceitam, respectivamente, até 10 MiB e 2 MiB.
O salvamento e a entrega privada do editor aceitam apenas chaves geradas para
imagens do mesmo Curso em `certificates/templates/<courseId>/`: fundo na raiz,
assinatura em `signatures/`, nome UUID v4 e extensão WebP. Imagens PNG e JPG
legadas geradas pelo mesmo fluxo continuam aceitas. Referências a PDFs, outros
Cursos, uploads temporários ou caminhos arbitrários são rejeitadas, inclusive
quando já constam em um template salvo. Uma referência nova precisa ter sido
produzida pelo upload server-side da mesma mutação; sem upload, o salvamento só
preserva uma referência já registrada no mesmo campo de um template desse Curso.
Remover a assinatura continua permitido. A rota de artes revalida namespace,
tipo de campo e Curso antes de assinar a leitura, inclusive para referências
legadas; chaves de PDFs de Certificados e de outros Cursos não são aceitas como
imagens.
Publicação, emissão do snapshot e regeneração de PDF/PNG repetem a validação
semântica por Curso e campo antes de ler a arte no R2. Na renderização, o Curso
vem do registro do Certificado, não de uma referência informada no snapshot.
Estado legado com referência fora desse contrato falha sem assinar a arte; a
operação deve revisar e salvar novamente o template. PDFs históricos já
renderizados não são reescritos por essa validação.
O download autenticado exige digest persistido e correspondência exata com a
metadata privada; digest ausente ou objeto não verificável retorna 503 sem URL
assinada. Reconciliação de integridade precisa preservar o PDF histórico,
sem regenerar ou alterar silenciosamente sua evidência.
Rascunho e publicação são separados; publicar substitui a versão ativa apenas
para emissões futuras. O perfil emissor global, com razão social, marca e CNPJ,
é obrigatório para publicar. O nome e o cargo/função do signatário devem ser
configurados em **Configurações do curso** e são obrigatórios para publicar; o
modelo controla o layout dos campos e mantém a imagem visual opcional da
assinatura. Não há fallback global de signatário, HTML livre, campos arbitrários
ou inferência automática de posicionamento.

A prévia interativa do editor fica indisponível até que o perfil emissor esteja
completo e o Curso tenha nome e cargo do responsável. O editor continua
permitindo salvar rascunhos e selecionar campos pela lista enquanto esses dados
são corrigidos; erros de layout não bloqueiam a prévia, pois ela é necessária
para corrigir o próprio layout. Quando liberada, a prévia usa os dados salvos do
emissor, do Curso e do responsável. Nome do Aluno, datas, código e QR de
validação são exemplos determinísticos, nunca dados de Alunos reais.

O perfil emissor global é administrado em **Admin > Configurações**. Razão social
e CNPJ são uma unidade: estado parcial é rejeitado antes da transação. O salvamento
de `certificate_issuer_profiles` é atômico e registra `settings.updated` com os
valores anterior e novo; o CNPJ é mascarado na auditoria. Nome e cargo do
signatário pertencem ao Curso, não ao modelo nem às Configurações globais.
O CNPJ pode ser informado com ou sem máscara, mas precisa conter 14 dígitos,
passar pelos dígitos verificadores e é normalizado para o formato brasileiro
antes de ser salvo. A tela informa quais dados impedem o perfil de ficar pronto.
O diagnóstico da JMVStream pertence a **Admin > Operação**.

Na composição do template, a arte de fundo A4, o nome do Aluno, o código de
validação e o QR de validação são obrigatórios e devem permanecer visíveis no
layout. O título do Curso e o nome do emissor continuam disponíveis e são
preenchidos automaticamente, mas podem ficar ocultos. O perfil emissor global,
com razão social, nome de exibição/marca e CNPJ, continua obrigatório para a
publicação.

Sobreposições geométricas entre campos visíveis são permitidas: podem ser uma
decisão intencional de composição. O editor calcula os pares sobrepostos,
mostra um aviso acessível e destaca os retângulos no preview, mas não bloqueia
salvar o rascunho nem publicar. Continuam bloqueantes a ausência da arte,
campos fora da área imprimível, campos duplicados, campos obrigatórios ocultos,
cores inválidas, fontes não permitidas e tamanhos de fonte fora do limite.

O certificado sempre usa a carga horária efetiva do Curso. A configuração do
Curso pode deixar `courses.workload_hours_override` nulo para calcular
automaticamente a soma arredondada das aulas, ou informar um inteiro não
negativo para substituir o valor exibido aos alunos e usado nas próximas
emissões. A emissão grava somente a carga efetiva em
`certificates.workload_hours_snapshot`; certificados já emitidos permanecem
imutáveis durante sua retenção. Campos de texto usam `verticalAlign` (`top`, `middle` ou `bottom`),
com `middle` como default compatível para specs legados, tanto no preview quanto
no PDF. O antigo campo de curso livre não faz parte do perfil emissor, template
ou novas emissões; snapshots históricos que ainda o contenham são somente
leitura. A migration de contrato transfere para o Curso um override manual
existente no template ativo antes de remover a coluna legada.

Na renderização, o template publicado é a autoridade visual: posição, área e
fonte são usadas exatamente como configuradas. Se nomes ou textos variáveis
excederem o retângulo, o PDF preserva o recorte definido pela operação; o
editor avisa antes do salvamento e pede confirmação adicional antes da
publicação. Nenhum autoajuste ocorre no worker.

Para Certificados futuros, os renderizadores de PDF e PNG usam o mesmo conjunto
de assets TTF Inter Regular e Inter Bold empacotados com a aplicação. Os aliases
lógicos persistidos `Helvetica` e `Helvetica-Bold` permanecem compatíveis, mas
são resolvidos internamente para Inter Regular e Inter Bold, respectivamente. A
geração de PNG usa Sharp/librsvg com Fontconfig empacotado no runtime Node.js e
não depende de fontes instaladas no sistema. Snapshots novos registram
`rendererVersion: 2`: PDF e PNG compartilham medição de largura, quebra de linha,
altura de linha e alinhamento vertical via PDFKit; o PDF também recorta o texto
ao retângulo configurado. Snapshots sem essa propriedade e os explicitamente
marcados como versão 1 continuam no caminho legado, inclusive quando uma
miniatura ausente for regenerada. Essa versão é independente de `version: 1`, que
continua identificando o formato do snapshot.

O editor administrativo usa os mesmos arquivos Inter e aguarda sua carga antes
de validar overflow ou ajustar campos ao conteúdo; se a fonte não carregar, avisa
que a prévia pode divergir e suspende essas validações. Como o editor é renderizado
no navegador, sua rasterização não promete identidade pixel a pixel com PDF/PNG.
As dimensões A4 do preview, em 1200x848, a chave de armazenamento, o contrato de
redirect e a validação de integridade por `preview_sha256` permanecem
inalterados. PDFs e snapshots são imutáveis durante a retenção. Previews
existentes e previews de teste não recebem backfill; um PNG novo ou regenerado
usa a versão registrada no snapshot e não reescreve o PDF nem a evidência do
Certificado.

Quando um rascunho substitui fundo ou assinatura, a chave anterior entra em
`certificate_template_asset_cleanup` com carência de 24 horas. A manutenção
reconfirma que nenhum template referencia a chave antes de excluir no R2. O
delete ocorre fora da transação Postgres, possui claim recuperável e mantém um
tombstone depois do sucesso; assim, formulário antigo não ressuscita uma arte
já removida e falha de provider pode ser repetida.

Certificado preserva código público, Conta, Curso, publicação interna de origem, data, carga horária e snapshots de nome e título. Seus estados são `valid` e `revoked`.

Uma emissão comum usa o título atual de `courses` no momento da emissão e o
grava no snapshot; Certificados já emitidos não acompanham renomeações. A
reconciliação histórica usa deliberadamente o `title_snapshot` da publicação
de origem para preservar o significado da conclusão antiga.

### REG-DAT-001 Emissão exige conclusão e unicidade válida

`issueManualCertificate` cria `CourseCompletion` se ela ainda não existir e somente quando não há Certificado anterior para o Aluno no Curso. `completeLesson` cria a primeira conclusão quando todas as Aulas obrigatórias da publicação vigente estão concluídas. Somente a transação que insere essa primeira `CourseCompletion` pode iniciar a emissão automática; conflito com uma conclusão já existente encerra o caminho sem tentar Certificado ou outbox. Depois de uma revogação, somente `reissueCertificate` pode criar nova evidência, sempre na publicação de origem.

**Invariantes:** `CourseCompletion` é única por Conta e Curso; o código público é único; não há segundo Certificado válido para a mesma Conta e Curso sem lifecycle explícito; Certificado revogado bloqueia emissão automática; `course_completions.certificate_ever_issued` mantém esse bloqueio depois da purga do registro detalhado. Publicação posterior não reabre a conclusão nem gera novo certificado automaticamente.

**Concorrência:** `lockCourseCertificateLifecycleInTransaction` exige uma transação aberta e usa advisory lock transacional por Conta e Curso. `completeLesson` o adquire antes de gravar `lesson_progress` e antes de calcular o resumo de conclusão; emissão automática, emissão manual e reemissão usam a mesma interface para suas decisões de lifecycle. A criação de `CourseCompletion` usa `INSERT ... ON CONFLICT DO NOTHING RETURNING`; somente a inserção vencedora chama a emissão automática. A criação do Certificado também usa `INSERT ... ON CONFLICT DO NOTHING RETURNING code`. Somente a transação vencedora grava a mensagem de renderização na outbox; o e-mail continua condicionado à renderização pronta e sem PII na mensagem. Veja [Outbox](../operations/outbox-and-transactional-effects.md).

### REG-DAT-001A Renderização e arquivo imutáveis

A transação vencedora de emissão grava `certificate.render`. A worker obtém um claim atômico persistido por Certificado antes de renderizar; o token e o instante do claim formam um lease de dez minutos. Claim ativo impede outro renderizador, lease abandonado pode ser retomado e falha recuperável libera somente o token pertencente à tentativa. Nenhuma conexão Postgres permanece reservada durante leitura do R2, Sharp, PDFKit ou upload. A worker lê somente o snapshot validado e grava o PDF em chave privada determinística no R2. Se cair depois do upload, a próxima tentativa finaliza o mesmo artefato, sem reconstruí-lo. A rota `/certificados/[code]/preview` cria sob demanda uma imagem PNG determinística da primeira página usando o mesmo snapshot, arte, QR e campos; ela também grava o PNG no R2 privado para as próximas visualizações. O fencing não promete computação única: quando o lease expira durante uma operação lenta, duas workers podem executar IO, mas somente a dona do token vigente pode concluir o único artefato persistido. A conclusão também exige que o Certificado continue `valid`; revogação durante o IO impede `ready` e o e-mail. Somente depois de `render_status = ready` a worker grava `email.certificate-issued`. O snapshot registra template/versionamento, arte, campos, marca, razão social, CNPJ, conclusão e hash SHA-256. Reemissão cria nova evidência e preserva a anterior durante a retenção. O objeto permanece no R2 privado, mas Certificado `valid` e `ready` pode ser visualizado por PNG e baixado publicamente pela página canônica `/certificados/[code]`; as rotas mediadoras nunca publicam a chave do objeto.

O upload de novos PDFs também grava o digest SHA-256 como metadata privada do objeto R2. A rota pública confere essa metadata antes de emitir uma URL assinada de cinco minutos. Digest ausente não libera o arquivo; divergência ou falha de verificação retorna indisponibilidade sem redirecionar. Objetos legados sem metadata permanecem explicitamente não verificáveis até backfill/reconciliação.

Na área autenticada, Certificado `pending` aparece como “Preparando” e atualiza a lista enquanto houver preparo; `ready` aponta para a página pública canônica; `failed` bloqueia preview/download e oferece contato com Suporte. A página do Curso é a entrada contextual do Certificado daquela conclusão. `/app/certificados` é o arquivo global autenticado para acompanhar todos os registros, não o destino canônico de compartilhamento. O e-mail só nasce depois de `ready` e aponta para `/certificados/[code]`, nunca diretamente para a URL assinada do R2.

Na revogação, o PNG de prévia derivado é removido do R2 imediatamente após o
commit do estado. Falhas do R2 ficam pendentes para retentativa pela manutenção
diária. O PDF e os dados detalhados do Certificado revogado permanecem por até
60 dias contados de `revoked_at`. Depois desse prazo, a manutenção remove o PDF,
apaga o registro de `certificates`, snapshot, código, hashes, dados de
identificação, vínculo com Conta/Curso/Publicação, motivo, autoria, auditoria e
mensagens de outbox associadas. A remoção só é finalizada após os artefatos
privados serem apagados e não haver renderização em processamento.

Na mesma transação, o sistema grava em `certificate_revocation_tombstones`
somente SHA-256 do código público e `revoked_at`. Esse tombstone não tem vínculo
com Conta, Curso ou ID do Certificado, não é considerado dado anonimizado e é
mantido enquanto a validação pública desses códigos estiver ativa. A página
pública continua informando que o código foi revogado, sem nome, Curso ou
documento; um código desconhecido continua retornando não encontrado. Em
`course_completions`, `certificate_ever_issued` permanece como um marcador
booleano mínimo para impedir que uma Conclusão histórica gere uma emissão
automática ou manual duplicada depois da purga. Ele não permite consultar ou
reemitir o Certificado antigo. Cópias de PDF já baixadas não podem ser removidas
pelo Hub.

### REG-DAT-002 Revogação bloqueia validade e preserva evidência temporária

`revokeCertificate` altera estado, categoria, detalhe interno, autoria e data; esses dados ficam disponíveis para a operação durante até 60 dias. Admin pode emitir, revogar, reemitir registros históricos retidos e reconciliar Certificados. `support` não emite, revoga nem reconcilia; pode somente reemitir o Certificado existente mais recente do Aluno no Curso, conforme [DEC-DISC-014](../decisions.md#dec-disc-014). Depois da purga de 60 dias, o registro não pode mais ser reemitido pelo seu ID; a marcação em `course_completions.certificate_ever_issued` continua impedindo uma emissão duplicada. A action exige a capacidade correspondente e o comando reaplica a regra de registro mais recente dentro do lock transacional. A confirmação é validada novamente no parser server-side da action; remover ou forjar o controle visual não autoriza o comando. A consulta pública mostra estado, data e categoria legível durante a retenção; depois, o tombstone mostra somente o estado e a data de revogação. A revogação bloqueia imediatamente novos previews e downloads nas rotas do Hub, mas não consegue recolher PDFs já baixados nem desfazer cópias compartilhadas anteriormente.

### REG-DAT-003 Reemissão cria nova evidência

`reissueCertificate` revoga o anterior e cria novo código e snapshots, mantendo vínculo auditável enquanto o Certificado predecessor estiver retido. Depois da purga de 60 dias, o predecessor não está mais disponível para reemissão e somente a verificação pública mínima da revogação permanece. As categorias canônicas são `identity_correction`, `course_snapshot_correction`, `duplicate_or_technical_issue`, `eligibility_correction`, `integrity_review`, `legal_or_compliance` e `other`; `other` exige detalhe interno. Veja [DEC-DISC-006](../decisions.md#dec-disc-006) e [ADR-0006](../adr/0006-certificate-lifecycle.md).

### REG-DAT-003A Hardening do ciclo e da rastreabilidade

Reemissão por `support` somente pode partir do registro histórico mais recente da
Aluno no Curso enquanto ele estiver retido. Admin pode selecionar um registro
histórico anterior, também somente enquanto retido, para a correção excepcional.
Ambos os caminhos usam lock transacional por par
Aluno/Curso; o predecessor revogado não é reescrito e duas reemissões
concorrentes não criam ramificação. A UI aplica a mesma fronteira por papel.
Novas emissões usam um código Base64URL canônico sem padding, derivado de 16
bytes aleatórios criptograficamente seguros (22 caracteres), sem prefixo fixo e
sem normalização de caixa. Códigos legados `PRT-...` permanecem inalterados e
consultáveis; a migração não atualiza snapshots, PDFs, PNGs ou QR já emitidos.
Antes de liberar o novo writer em Staging, o preflight deve confirmar que a
collation do banco distingue caixa e que nenhum template ou consumidor externo
depende do prefixo antigo.

O nome e o cargo/função do signatário são próprios do Curso, ficam em
**Configurações do curso** e precisam estar preenchidos para publicar ou ativar
a emissão. Não há fallback global. O modelo versionado controla a posição e a
visibilidade dos campos; a imagem visual da assinatura é opcional e permanece
no modelo. Cursos publicados legados sem responsável não emitem certificados
automáticos; emissão manual, reemissão e reconciliação rejeitam o mesmo estado.
Depois de preencher os dados do Curso, novas emissões podem ser retomadas sem
republicar o modelo; as Conclusões que ficaram sem Certificado podem então ser
reconciliadas. Certificados permanecem imutáveis durante a retenção; registros
revogados são removidos após 60 dias. A alteração do
responsável registra valores anterior e novo em `audit_logs` na mesma transação.
Salvar rascunho e publicar também são auditados; o rascunho inclui o digest
SHA-256 do spec e a publicação inclui o template publicado.

A migration transfere para o Curso valores locais explícitos já gravados no
modelo, priorizando o publicado. Não copia valores de `app_settings`; Cursos sem
valor local continuam pendentes para revisão.

As colunas globais legadas `app_settings.certificate_signer_name` e
`app_settings.certificate_signer_role` permanecem temporariamente no banco para
compatibilidade com rollback durante a janela de release. O runtime atual não
as lê nem grava; sua remoção física deve ocorrer em uma etapa posterior, após a
confirmação de que versões antigas da aplicação não podem voltar a acessá-las.
As colunas antigas `certificate_templates.signer_name` e `signer_role` também
ficam sem uso pelo runtime atual e serão removidas na mesma etapa posterior.

`reconcileHistoricalCourseCertificates` é exclusivo de Admin e exige confirmação
server-side. Cada execução seleciona em ordem estável no máximo 100 Conclusões do Curso
que ainda não possuem nenhum Certificado, preserva publicação/data/carga histórica e
enfileira a renderização na mesma transação. Certificado revogado também conta como
histórico e `certificate_ever_issued` continua bloqueando reconciliação depois da
purga; migrations, deploy e leitura não disparam backfill silencioso.

A migration `0056_certificate_state_invariants` normaliza registros legados,
restringe exclusão física do Curso e valida a coerência entre `status`, campos
de revogação e categorias canônicas. Em 2026-08-07, a migration foi aplicada
pelo runner oficial e verificada em staging; a promoção para Production ainda
deve seguir o workflow protegido após preflight e backup.

### REG-DAT-004 Consulta pública é limitada

`/certificados/[code]` é a página canônica de validação, preview e compartilhamento. `consumePublicCertificateLookup`, em `src/features/certificates/public-rate-limit.ts`, aplica limite antes de `getCertificateByCode`; a mesma barreira antecede a leitura da rota `/certificados/[code]/pdf`. Código inexistente não revela outros Certificados da pessoa. Até 60 dias após revogação, a página mostra o resumo contextual retido; depois, consulta somente o hash do código e retorna o estado de revogação, sem identificação pessoal ou do Curso.

A página mantém apenas o resumo contextual do Aluno e do Curso, o estado e o código público; os demais claims permanecem no PDF. Somente `status = valid` e `render_status = ready` mostra a imagem de preview e a ação de download. `pending`, `failed` e `revoked` permanecem consultáveis com seu estado seguro, sem preview, download ou URL assinada. A rota do PNG gera ou reutiliza o artefato privado e responde com redirect inline; a rota do PDF repete a validação de estado, exige chave e digest, verifica o SHA-256 no R2 e só então responde com redirect temporário para uma URL assinada curta. A página publica `noindex,nofollow`; as respostas de redirect publicam `X-Robots-Tag: noindex, nofollow`. Códigos de Certificado são redigidos no pathname enviado ao Sentry, e respostas de erro não incluem detalhes do provider.

## Dados técnicos e manutenção

### REG-DAT-005 Não existe workflow de solicitações de dados

O Hub não expõe página, API, cron, permissão ou tabela para registrar, aprovar ou executar solicitações de dados. Não há política jurídica formal, caso operacional recorrente nem garantia de uma anonimização correta para justificar manter esse mecanismo inativo.

Uma solicitação real é um incidente excepcional: registrar o caso no canal operacional apropriado, preservar evidências e buscar orientação jurídica antes de alterar dados. Não há anonimização parcialmente implementada disponível para ser acionada.

### REG-DAT-006 Manutenção técnica tem retenção limitada

`runMaintenance`, em `src/features/maintenance/server.ts`, executa diariamente por `GET /api/cron/maintenance`, protegido por `CRON_SECRET`. A rotina não é um mecanismo de direitos de dados nem afirma conformidade LGPD. Ela apenas:

- remove sessões expiradas;
- remove limites expirados da consulta pública de certificados;
- consolida eventos de analytics anteriores ao dia atual em métricas diárias;
- remove eventos brutos de analytics após 12 meses e métricas diárias após 13 meses;
- remove uploads administrativos temporários abandonados após 24 horas;
- reconcilia artes de template substituídas por uma fila persistente, com
  carência, claim, nova verificação de referência e retry;
- reconcilia PDFs determinísticos órfãos de Certificados revogados somente após expirar o lease, confirmar ausência de claim e de mensagem de renderização em processamento e repetir a verificação imediatamente antes da exclusão.
- após 60 dias da revogação, remove o PDF, registro detalhado, auditoria e outbox do Certificado em transação; preserva somente o tombstone de validação e o marcador de emissão na Conclusão.

As preferências de analytics do Aluno estão em [Aprendizagem e progresso](learning-content-and-progress.md). Base legal, canal de direitos, retenção de registros financeiros e qualquer anonimização exigem decisão jurídica futura.

## Concorrência e falhas

- emissão e intenção de e-mail compartilham transação; falha ao gravar a outbox desfaz emissão;
- reemissões concorrentes exigem revisão do estado final;
- a manutenção é idempotente: agregados diários usam upsert e exclusões por prazo podem ser repetidas;
- a falha do cron é observável como `maintenance_cron_failed`; dados antigos permanecem até uma execução posterior.

## Evidências

- schema: `certificates`, `publicCertificateRateLimits`, `learningAnalyticsEvents`, `learningAnalyticsDailyMetrics` em `src/db/schema.ts`;
- certificados: `src/features/certificates/server.ts`, `src/features/certificates/rules.ts`;
- manutenção: `src/features/maintenance/server.ts`, `src/app/api/cron/maintenance/route.ts`;
- testes: `src/features/certificates/*.test.ts`, `src/features/maintenance/server.test.ts`.

## Pendências

- definir política jurídica de retenção, direitos de dados e anonimização antes de criar novo workflow;
- recovery/ativação por senha permanece fora da outbox porque contém token secreto;
- infraestrutura de cron e base legal de produção não foram verificadas externamente.
