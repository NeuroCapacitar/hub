---
status: accepted
owner: product
last_verified_commit: b226ee5
---

# ADR-0006 Snapshots, revogação e reemissão de Certificados

## Contexto

Certificado é evidência histórica enquanto retido. Nome, Curso e carga horária podem mudar; fraude ou erro pode exigir invalidação imediata, seguida de retenção detalhada limitada e uma confirmação pública mínima após a purga.

## Proposta

O Certificado é evidência histórica com snapshot imutável durante a retenção. O PDF renderizado é imutável enquanto retido e a imagem de prévia é derivada; a política de retenção dos Certificados revogados está registrada na emenda abaixo. Após 60 dias, o registro detalhado é purgado e somente o status público mínimo permanece. O Admin configura por Curso uma arte A4 horizontal privada e campos padronizados posicionados manualmente; HTML/CSS livre não é uma opção. A emissão cria um registro pendente e uma mensagem `certificate.render`; a worker usa somente o snapshot para gerar o PDF com PDFKit e o grava no R2 privado. `/certificados/[code]` é a página pública canônica de validação, preview e compartilhamento. Para Certificado `valid` e `ready`, `/certificados/[code]/preview` gera ou reutiliza uma imagem PNG da primeira página a partir do mesmo snapshot e arte, enquanto `/certificados/[code]/pdf` aplica rate limit, verifica o digest SHA-256 e redireciona para uma URL assinada curta do PDF privado. Os demais estados não expõem preview, download, chave ou URL assinada. Página e redirects são não indexáveis.

O template publicado é a autoridade visual: o worker usa a posição, a área e a fonte configuradas sem autoajuste. Se um dado exceder o retângulo, o PDF preserva o recorte definido pela operação; o editor avisa antes do salvamento e pede confirmação adicional antes da publicação.

O contrato aceito para o runtime é que os renderizadores de PDF e PNG usem o
mesmo conjunto de assets TTF Inter Regular e Inter Bold empacotados com a
aplicação. Os aliases lógicos persistidos `Helvetica` e `Helvetica-Bold`
permanecem compatíveis, mas resolvem internamente para Inter Regular e Inter
Bold, respectivamente. A geração de PNG usa Sharp/librsvg com Fontconfig
empacotado no runtime Node.js e não depende de fontes instaladas no sistema.

Emenda de renderização: snapshots de emissão novos registram
`rendererVersion: 2`, separado de `version: 1` do formato do snapshot. PDF e PNG
compartilham medição de largura, quebra de linha, altura de linha e alinhamento
vertical via PDFKit; o PDF recorta o texto ao retângulo configurado. Snapshots
sem versão de renderer e os marcados como versão 1 preservam o comportamento
legado, inclusive ao regenerar uma miniatura ausente. O editor aguarda os assets
Inter antes de validar overflow e ajustar campos; se a fonte falhar, informa a
limitação e suspende essas validações. A renderização no navegador continua sendo
uma aproximação visual, sem promessa de identidade pixel a pixel.

As dimensões A4 do preview, em 1200x848, a chave de armazenamento, o contrato de
redirect e a validação de integridade por `preview_sha256` permanecem
inalterados. Snapshot e histórico permanecem imutáveis durante o período de
retenção. Enquanto retido, o PDF também não é reescrito. Não há backfill:
qualquer PNG novo ou regenerado usa a versão registrada no snapshot e não
reescreve a evidência do Certificado.

Persistir snapshots no momento da emissão. Revogar com motivo, autoria e data. Reemitir criando novo Certificado e novo código, preservando o anterior revogado durante sua retenção. Admin pode executar emissão, revogação e reemissão de registros ainda retidos, sempre com motivo obrigatório e confirmação validada na interface e novamente no servidor. Após 60 dias, o registro antigo não pode ser selecionado para reemissão. Conforme [DEC-DISC-014](../decisions.md#dec-disc-014), `support` pode somente reemitir o Certificado existente mais recente do Aluno no Curso; emissão, revogação e reconciliação permanecem exclusivas de Admin. A capacidade é validada na action e a regra adicional de registro mais recente é validada no comando sob lock transacional.

Uma nova emissão comum usa o `courses.title` vigente no instante da emissão e
grava esse valor no snapshot do Certificado. Certificados já emitidos nunca são
reescritos. A reconciliação histórica é a exceção deliberada: ela usa o
`title_snapshot` da publicação de origem para que a correção de um registro
antigo continue representando o contexto histórico da conclusão.

A emissão automática pertence exclusivamente à transação que insere a primeira `CourseCompletion`. Emissão, reemissão e progresso final compartilham lock transacional por Conta e Curso; encontrar uma Conclusão existente não tenta Certificado nem outbox.

Conclusões históricas podem ser reconciliadas somente por Admin, após confirmação explícita validada no servidor, em lotes de até 100. São elegíveis apenas conclusões de Curso com Certificado habilitado, template publicado, perfil emissor global, nenhum Certificado anterior e `certificate_ever_issued = false` para a combinação de Conta e Curso. Um Certificado revogado continua bloqueando emissão automática e reconciliação mesmo depois da purga do registro, por meio desse marcador booleano mínimo. Migration, deploy e leitura não executam backfill silencioso.

A reconciliação preserva a publicação e a data da Conclusão, usa título e carga horária daquela publicação, nome atual da Conta e template/emissor publicados no momento do lote. Cada emissão registra `origin: admin_reconciliation` na auditoria e enfileira `certificate.render` na mesma transação; geração de PDF, acesso ao R2 e envio de e-mail permanecem fora dela.

O motivo usa uma categoria padronizada e um detalhe interno. Durante a retenção, a consulta pública de um Certificado revogado mostra o estado, a data e a categoria legível; não expõe o detalhe, que pode conter dados pessoais ou uma apuração sensível. Depois da purga, mostra somente o estado e a data, sem nome, Curso ou categoria.

O e-mail de emissão aponta para a página pública canônica, não para o arquivo global autenticado nem para a URL assinada. A página do Curso oferece a entrada contextual do Certificado daquela conclusão; `/app/certificados` permanece como arquivo global autenticado de todos os registros do Aluno.

## Alternativas

- renderizar sempre dados atuais: simples, mas reescreve documento histórico;
- apagar e recriar: perde auditoria e permite ambiguidade do código;
- editar snapshots: resolve erro, mas oculta a correção.

## Consequências

- histórico detalhado de Certificado revogado é recuperável por até 60 dias;
- após a purga, somente hash do código + data de revogação permanecem para validação pública, sem vínculo ao Aluno ou Curso;
- `course_completions.certificate_ever_issued` permanece como marcador de prevenção de emissão duplicada, sem manter identidade do Certificado;
- UI precisa explicar revogação e reemissão;
- revogação bloqueia novos previews e downloads pelo Hub, mas um download já realizado não pode ser recolhido nem uma cópia anterior desfeita; a invalidação passa a ser verificável pelo código público;
- o detalhe do motivo fica restrito à operação e à auditoria.
- lotes podem exigir execuções sucessivas; o resultado informa quantos foram emitidos e quantos ainda restam;
- retries são idempotentes porque qualquer histórico de Certificado remove a conclusão da elegibilidade.

## Estado

### Emenda aprovada em 2026-09-24

O perfil da organização emissora permanece global. O nome e o cargo/função do
signatário pertencem ao Curso e são obrigatórios para publicar ou ativar a
emissão; a imagem visual opcional e o layout dos campos permanecem no template.
Não existe fallback global. Cursos publicados legados sem nome ou cargo não
podem originar novas emissões automáticas, manuais, reemissões ou reconciliações
até os dados serem preenchidos em Configurações do curso. Depois de salvar, não
é necessário republicar o template. Conclusões sem Certificado podem ser
reconciliadas após a correção; snapshots de registros retidos permanecem
imutáveis até o prazo de purge aplicável.

A migration transfere valores locais que já estavam gravados no template,
priorizando o publicado, mas nunca copia o padrão global de `app_settings`.
Cursos sem valor local permanecem pendentes para revisão explícita.

As colunas legadas de signatário em `app_settings` ficam sem uso pelo runtime e
são retidas temporariamente para rollback compatível; sua remoção física exige
uma etapa posterior de limpeza após a janela de compatibilidade.
As antigas colunas de nome/cargo em `certificate_templates` seguem a mesma
política de retenção; `courses` é a fonte canônica a partir desta emenda.

### Emenda aprovada em 2026-09-25

Novas emissões usam identificadores públicos de 16 bytes CSPRNG em Base64URL
canônico sem padding (22 caracteres), sem o prefixo constante `PRT-`. O valor é
opaco, case-sensitive e permanece o código de consulta pública; link e QR
continuam sendo os meios preferidos para abri-lo. O writer gera bytes novos a
cada tentativa e preserva a constraint única existente. Códigos antigos,
snapshots e artefatos permanecem byte a byte inalterados e consultáveis; não há
alias, backfill, alteração de schema ou mudança do formato do snapshot. A
liberação do writer fica condicionada a validar a collation do banco e os
templates/consumidores externos que possam assumir prefixo ou caixa.

### Emenda aprovada em 2026-09-25 — retenção de Certificados revogados

Esta emenda substitui a política anterior de 90 dias aplicada somente ao PDF.
Ao revogar ou reemitir um Certificado, a prévia PNG derivada é removida do R2
imediatamente após o commit; falhas de armazenamento ficam sujeitas à
retentativa diária. PDF e dados detalhados permanecem até 60 dias contados de
`revoked_at`. Depois do prazo, uma única transação apaga o registro de
`certificates`, snapshot, dados de identificação, código, hashes, detalhes de
revogação, auditoria e outbox após confirmar a remoção do PDF privado e ausência
de renderização em processamento.

Na transação de purge, o Hub grava em `certificate_revocation_tombstones`
somente SHA-256 do código público e `revoked_at`. O tombstone não tem chaves
para Conta, Curso ou Certificado; permanece enquanto a validação pública desses
códigos estiver ativa e não é declarado anônimo. `course_completions` conserva
`certificate_ever_issued`, um booleano sem código ou snapshot, para manter o
bloqueio de reemissão automática/manual duplicada depois da purga. A UI pública
continua diferenciando código revogado de código inexistente, mas não revela
mais pessoa, Curso, motivo nem PDF após os 60 dias. Cópias baixadas antes da
revogação não podem ser removidas pelo Hub.

A conservação do hash de verificação e do marcador de conclusão requer política
formal de base legal, finalidade e revisão periódica antes da promoção a
Staging/Production; o prazo de 60 dias para o registro detalhado não substitui
essa avaliação.

Implementado por `issueManualCertificate`, `revokeCertificate`, `reissueCertificate` e `reconcileHistoricalCourseCertificates`. A política
de que revogação bloqueia nova emissão automática, exigindo reemissão manual, foi ratificada em
2026-07-20. Autoridade, motivos e informação pública foram ratificados em 2026-07-21; veja
[DEC-DISC-006](../decisions.md#dec-disc-006).
