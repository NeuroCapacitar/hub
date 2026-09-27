---
status: accepted
owner: engineering
last_verified_commit: 7d096bee
---

# Plano aprovado: código de Certificado em Base64URL

**Objetivo:** reduzir o identificador de novas emissões para um token curto,
URL-safe e imprevisível, sem alterar nenhum código, link, PDF, snapshot ou QR já
emitido.

**Contrato aprovado:** gerar 16 bytes aleatórios com CSPRNG e codificá-los em
Base64URL canônico sem padding. O resultado tem 22 caracteres, 128 bits
aleatórios e não usa o prefixo `PRT-`. O prefixo atual é constante para toda a
plataforma, não identifica o Curso nem acrescenta entropia. Códigos existentes
continuam válidos no formato antigo.

**Arquitetura:** `certificates.code` continua sendo a chave pública única; o
lookup continua exato. Não criar um segundo alias público, não normalizar caixa,
não reescrever registros históricos e não adicionar coluna ou migration se os
preflight checks confirmarem que o schema e a collation atuais são compatíveis.
QR e link compartilhável permanecem os caminhos primários; o código impresso é
uma referência alternativa.

**Base verificada:** commit `7d096bee` (`fix: align certificate text
rendering`). A proposta foi aprovada em 2026-09-25 e a implementação foi
autorizada. A liberação de novas emissões em Staging/Production continua sujeita
aos gates externos de compatibilidade descritos neste plano.

## Estado da execução

- Implementados: codificador Base64URL de 16 bytes, os dois writers, testes de
  formato/lookup e redaction do Sentry para códigos antigos e novos.
- Verificados localmente: `bun run docs:check`, `bun run verify:quick` e
  redaction focalizada do Sentry passaram.
- Pendente antes de liberar o writer: confirmar collation case-sensitive,
  Hosted Template/arte publicada e ausência de dependência externa do prefixo.
- Não executada: integração concorrente em PostgreSQL, que exige banco dedicado
  e trunca tabelas de fixtures; não foi presumido seguro sem validar o alvo.
- Não incluído: ocultar códigos em cartões/tabelas/e-mails; é um refinamento de
  UX separado, não necessário para esta migração.

## 1. Contrato ratificado

1. **Formato novo:** 16 bytes aleatórios criptograficamente seguros, Base64URL
   sem `=`, exatamente 22 caracteres do alfabeto `A-Z`, `a-z`, `0-9`, `-` e
   `_`. RFC 4648 define o alfabeto URL-safe e permite omitir padding quando o
   comprimento original é conhecido; Node.js v24 documenta `randomBytes` como
   gerador criptográfico e a saída `Buffer` Base64URL sem padding. [RFC 4648,
   §§3.2 e 5](https://www.rfc-editor.org/rfc/rfc4648), [Node.js Buffer —
   Base64URL](https://nodejs.org/docs/latest-v24.x/api/buffer.html#buffers-and-character-encodings),
   [Node.js Crypto — `randomBytes`](https://nodejs.org/docs/latest-v24.x/api/crypto.html#cryptorandombytessize-callback).
2. **Prefixo:** remover `PRT-` somente dos códigos novos. Isso reduz quatro
   caracteres adicionais, sem reduzir entropia. A proposta pressupõe que o
   rótulo “Código de validação”, o domínio Hub e a marca do Certificado dão o
   contexto necessário. Antes da implementação, confirmar que nenhum parceiro,
   template, importação ou procedimento de atendimento espera literalmente
   `PRT-`.
3. **Caixa:** Base64URL é case-sensitive. O código canônico não pode passar por
   `toUpperCase()`, `toLowerCase()`, remoção de `_` ou outra normalização. O
   link/QR e “Copiar código” devem preservar o valor byte a byte.
4. **Compatibilidade:** emissões novas usam Base64URL; códigos `PRT-...`
   existentes continuam consultáveis e não são atualizados. Uma reemissão cria
   novo Certificado no formato novo e preserva o registro revogado anterior.
5. **Acesso:** o código permanece localizador público, não senha nem prova
   criptográfica. Manter rate limit, consulta de status, estados revogados e
   redaction. Não enfraquecer o token para obter um número mais curto.

### Base de entropia e economia

O código atual tem 36 caracteres (`PRT-` + 32 hex) e 122 bits aleatórios,
porque os seis bits de versão/variante de UUIDv4 são fixos. A proposta usa 128
bits aleatórios em 22 caracteres Base64URL sem prefixo: 14 caracteres a menos
(aproximadamente 39%). Com o prefixo, seriam 26 caracteres, mas o prefixo não é
um requisito de lookup ou de unicidade. A RFC 9562 define os 122 bits de UUIDv4;
Node `randomBytes(16)` evita os seis bits estruturais e gera 128 bits aleatórios.
[RFC 9562, §5.4](https://www.rfc-editor.org/rfc/rfc9562.html#section-5.4),
[Node.js Crypto](https://nodejs.org/docs/latest-v24.x/api/crypto.html#cryptorandombytessize-callback).

**Limite de usabilidade:** Base64URL é menor, mas letras maiúsculas/minúsculas
são diferentes e alguns caracteres podem ser confundidos ao digitar. O Hub não
tem formulário de busca manual; o caminho existente é URL/QR, então a proposta
mantém cópia/link como operação preferida. Se a digitação a partir do papel for
requisito frequente, interromper a escolha de Base64URL e comparar um alfabeto
case-insensitive como Crockford Base32 antes de fechar o contrato.

## 2. Preflight obrigatório — sem emissão nova ainda

### 2.1 Compatibilidade de dados e banco

- Consultar somente metadados e contagens agregadas no ambiente descartável ou
  Staging aprovado; não exportar códigos nem PII. Classificar registros
  existentes em padrões conhecidos e “outros”, sem presumir que todos são
  `PRT-` + 32 hex: `certificates.code` é `text`, aceita valores legados e não
  tem constraint de comprimento/formato.
- Confirmar que a collation usada por `certificates.code` e pela constraint
  `certificates_code_unique` compara caixa de forma determinística. Base64URL
  diferencia caixa; se o banco considerar `Ab...` e `aB...` equivalentes, parar
  e decidir entre índice/collation case-sensitive com migration ou outro
  alfabeto. Não seguir com base apenas no schema TypeScript.
- Provar no PostgreSQL descartável que dois tokens que diferem só por caixa
  continuam valores distintos, que cada código novo é único e que a constraint
  atual detecta colisões entre códigos antigos e novos.

### 2.2 Compatibilidade fora do código-fonte

- Revisar o Hosted Template `certificate-issued` publicado no Resend. O checker
  local garante as variáveis, não verifica o markup/editorial; confirmar que o
  template não adiciona `PRT-`, não força caixa e não trunca o valor.
- Revisar as artes A4 atualmente publicadas para ver se `PRT-` foi desenhado
  dentro do fundo em vez de vir do campo dinâmico. Não substituir arte nem
  alterar snapshots como parte desta migração.
- Confirmar com Suporte/operadores se algum validador externo, empregador,
  processo de importação ou instrução impressa exige `PRT-` ou aceita
  Base64URL. A busca local não encontra parser externo, mas não cobre práticas
  de terceiros.
- Registrar que nenhum consumidor manual deve normalizar caixa. Como a rota
  pública recebe o código no path e a consulta é igualdade exata, link/QR
  resolvem o caso normal; qualquer digitador externo precisa preservar o texto.

**Gate:** qualquer dependência de prefixo, formato/case incompatível, arte
estática com `PRT-` embutido ou collation não determinística interrompe a
migração até o plano ser ajustado e ratificado.

## 3. Inventário técnico verificado

### Geração e persistência

- Antes da mudança, `rules.ts` continha `createCertificateCode`, que sanitizava
  seed, convertia para maiúsculas e acrescentava `PRT-`; essa lógica foi
  removida porque destruiria `-`, `_` e distinção de caixa.
- `src/features/certificates/certificate-code.ts` agora valida exatamente 16
  bytes e codifica Base64URL. `server.ts` usa `randomBytes` na fronteira
  server-only nos dois caminhos de emissão e mantém retry de até três tentativas
  para a constraint única.
- `src/db/schema.ts` e a migration inicial: `certificates.code` é texto único,
  sem tamanho ou regex no banco. `parseCertificateRenderSnapshot` requer apenas
  uma string não vazia.
- Snapshots guardam o código exato, e os renderers usam esse valor no PDF, no
  texto e no QR. PDF/R2 e preview R2 são endereçados pelo UUID interno do
  Certificado, não pelo código público.

### Readers, URLs e compatibilidade

- `getCertificateByCode` faz lookup exato por `code = $1`; preview e rotas de
  PDF/PNG também usam o valor sem aplicar formato ou caixa.
- `getCertificateValidationPath` e os links de e-mail encodam o segmento; há
  também algumas construções diretas de rota no dashboard, detalhe Admin e
  Curso. Base64URL é composto por caracteres URL-safe, mas todos esses caminhos
  devem ser testados com `_`, `-`, maiúsculas e minúsculas.
- Rotas envolvidas: `/certificados/[code]`, `/certificados/[code]/preview`,
  `/certificados/[code]/pdf` e `/app/certificados/[code]/pdf`. Não existe
  parser público que imponha o prefixo `PRT-`.
- O e-mail recebe `CERTIFICATE_CODE` como string e constrói `ACTION_URL`; o
  outbox guarda `certificateId` e resolve o código atual ao entregar, sem
  serializar o formato no payload da mensagem.

### Segurança e telemetria

- `src/lib/sentry-options.ts` redige genericamente o segmento em URLs
  `/certificados/<code>`, mas o padrão de texto avulso reconhece apenas
  `PRT-[0-9A-Z-]{6,}`. Código Base64URL sem prefixo escaparia quando aparecesse
  em mensagens, breadcrumbs, transactions ou spans fora de uma URL.
- A alteração de redaction precisa preceder a primeira emissão Base64URL e
  testar old/new, caixa, `_`, `-`, rotas e texto contextual. Evitar um regex tão
  genérico que apague indiscriminadamente qualquer sequência Base64URL
  equivalente em logs sem contexto.
- O rate limit atual é 20 consultas por minuto por IP; manter o limite. Não
  trocar o token por sequência incremental, Hashids ou fragmento truncado.

## 4. Plano de execução proposto

### Sprint 0 — contrato aprovado; fechar preflight externo

- Aprovado: 22 caracteres Base64URL sem padding, 16 bytes aleatórios e prefixo
  removido somente para novas emissões.
- Ainda exige confirmação antes de liberar o writer: histórico/collation, Resend
  Hosted, artes publicadas e consumidores externos.
- Documentar “identificador público de Certificado” como localizador opaco,
  distinto do Certificado/da prova criptográfica; a interface continua podendo
  rotular “Código de validação”. Atualizar glossário/ADR apenas após a decisão
  ser aprovada.

### Sprint 1 — redaction e caracterização de formato

- Primeiro ampliar `src/lib/sentry-options.ts` para proteger códigos Base64URL
  sem prefixo, preservando redaction PRT legado.
- Testar o valor novo em URL pública/autenticada e como texto contextual em
  evento, breadcrumb, transaction e span. Incluir tokens com `_` e `-` nas
  posições de borda para expor problemas de `\b`.
- Preferir um helper que entende o contexto de certificado; se a regex precisar
  aceitar códigos avulsos, limitar ao formato exato de 22 caracteres e provar
  que os limites não vazam nem contaminam texto adjacente.
- Implementado: o sanitizer preserva a regra `PRT-` legada e redige somente
  tokens Base64URL canônicos de 22 caracteres (incluindo o conjunto válido do
  último caractere), além de remover atributos chamados `certificateCode`.
- Recomendação operacional: liberar essa mudança de observabilidade antes do
  writer novo, para não haver período no qual os logs de erros possam carregar
  códigos Base64URL sem redaction.

### Sprint 2 — codificador puro + testes primeiro

- Substituir a função de normalização por um codec explicitamente tipado para
  16 bytes. Manter `randomBytes(16)` na fronteira server-only; não importar
  `node:crypto` para um módulo compartilhado com Client Components.
- Usar Base64URL canônico sem padding. Não aplicar `trim` além da validação de
  forma, nem `toUpperCase`/`toLowerCase`, substituições de caracteres ou
  separadores de apresentação no valor persistido.
- Testar bytes determinísticos conhecidos: saída com 22 caracteres,
  `[A-Za-z0-9_-]`, sem `=`, sem `PRT-`; decode/encode retorna os mesmos 16
  bytes e nunca acrescenta caixa normalizada. Testar erro para entrada que não
  tenha exatamente 16 bytes.
- Separar `generate random bytes` de `format bytes` para os testes não
  dependerem de aleatoriedade real nem de probabilidades de colisão.
- Implementado: `encodeCertificateCode` valida 16 bytes e usa o encoding
  Base64URL nativo do Node; testes cobrem vetor conhecido, `-`, `_`, caixa,
  ausência de padding e comprimentos inválidos.

### Sprint 3 — escrever novos códigos mantendo readers legados

- Trocar somente os dois call sites de geração em `server.ts`; reemissões e
  reconciliação entram pelo caminho comum e precisam receber o mesmo formato.
- Preservar advisory locks, transações, savepoints, `MAX_CERTIFICATE_CODE_ATTEMPTS`
  e `certificates_code_unique`. Cada retry pede novo `randomBytes(16)`.
- Implementado nos dois escritores de emissão. `randomUUID()` permanece para
  claim tokens; não houve alteração do schema nem dos códigos armazenados.
- Não alterar `certificates.code`, não criar coluna, alias, migration ou
  backfill. A consulta exata e o texto único continuam aceitando códigos
  antigos, novos e demais registros legados.
- Manter `randomUUID()` para claim tokens e outros UUIDs; só retirar seu uso
  como fonte do código público.

### Sprint 4 — transportes, documentos e superfícies

- Validar links diretos e `encodeURIComponent` em `certificate-links.ts`,
  `getCertificateValidationPath`, dashboard, detalhe Admin, página do Curso,
  e-mail e rotas públicas. Base64URL `-`/`_` não devem ser removidos; caixa
  precisa sobreviver ao route param e à query SQL.
- Atualizar amostras determinísticas do editor e testes de geração da prévia/QR.
  Confirmar `validationCode`, URL de QR, campo PDF, PNG e metadados recebem o
  mesmo valor sem transformações.
- Conferir a variável `CERTIFICATE_CODE` do Hosted Template; o contrato de
  variáveis permanece string, sem mudança de alias. Não publicar alteração no
  Resend automaticamente.
- Preservar PDFs/QRs já emitidos. Testar arte impressa real com um novo código,
  rótulo explícito e QR; não supor que retirar `PRT-` do dado dinâmico seja
  seguro se a arte também tiver prefixo estático.
- **Refinamento visual opcional, separado do writer:** ocultar códigos completos
  em cartões/histórico do Aluno, tabela recente do Dashboard e texto de e-mail
  quando já houver link/ação. Manter code completo no PDF, na página pública e
  sob demanda no suporte. Se aprovado, prever “Copiar código” explicitamente;
  “Copiar link” continua principal. Isso corrige repetição, não faz parte da
  compatibilidade Base64URL e pode ser enviado em uma alteração separada.
- A amostra visual do editor agora usa um código de 22 caracteres. Hosted
  Template e arte publicada ainda precisam ser verificados externamente antes
  de liberar o writer.

### Sprint 5 — documentação e verificação

- Atualizar `REG-DAT-003A` em
  `docs/domain/certificates-and-data-rights.md` para explicar o formato novo e
  manter códigos PRT legados. Emendar `docs/adr/0006-certificate-lifecycle.md`
  com o racional, o caráter case-sensitive, o prefixo removido e a política de
  não reescrever registros históricos. Manter `version: 1` do snapshot, pois o
  valor do código muda mas o schema JSON não.
- Atualizar os testes de padrão do gerador (`certificate-code.test.ts`,
  `server.test.ts`, `certificate-issuance.integration.test.ts`), as rotas
  (pública, preview, PDF autenticado e público), `sentry-options.test.ts` e
  fixtures do editor/e-mail.
- Executar testes unitários focalizados, integração de emissão em Postgres
  descartável, `bun run verify:quick`, `bun run docs:check` e `git diff --check`.

### Staging e rollback

- Não abrir Production diretamente: seguir o fluxo normal branch `staging` →
  homologação → release protegida.
- Em Staging emitir um certificado por conclusão automática e outro pelo fluxo
  manual/reconciliação; conferir o formato, URL, QR, PDF, preview, e-mail,
  revogação e reemissão. Testar um código Base64URL com letras minúsculas,
  `-` e `_`; escanear o QR do PDF real em mais de um leitor.
- Validar ao mesmo tempo um Certificado legado `PRT-...`, inclusive seu PDF/QR
  existentes, e uma emissão nova. A mudança deve ser aditiva: os caminhos
  velhos nunca redirecionam nem mudam de identificador.
- Rollback do writer pode voltar a emitir PRT para novas emissões, sem quebrar
  Base64URL já armazenado, desde que readers permaneçam sem validação de prefixo
  e Sentry continue redigindo ambos. Não reverter ou atualizar os dados
  emitidos; identificar deployment anterior compatível pela política de release.

## Arquivos previstos

Modificar geração e testes em `src/features/certificates/rules.ts`,
`src/features/certificates/server.ts`, `src/features/certificates/rules.test.ts`,
`src/features/certificates/server.test.ts` e
`src/features/courses/certificate-issuance.integration.test.ts`; redaction em
`src/lib/sentry-options.ts` e `.test.ts`; referências públicas, amostra e testes
de rotas/editor; e documentação de domínio/ADR. A apresentação dos códigos nos
cartões e tabelas fica em um bloco de UX separado se não for aprovada no mesmo
escopo.

**DDL previsto:** nenhum. Se o preflight descobrir collation case-insensitive ou
uma constraint/integração externa não conhecida, interromper e revisar o plano
antes de gerar novos códigos.

## Critérios de conclusão

- Novas emissões contêm exatamente 16 bytes CSPRNG codificados em 22 caracteres
  Base64URL canônicos e não aplicam prefixo se a decisão de Sprint 0 for
  confirmada.
- Todo código `PRT-` já armazenado continua validando, abrindo QR/link e
  mostrando seu artefato histórico.
- Nenhum código novo ou antigo aparece integral em evento/breadcrumb/span do
  Sentry.
- Links/QR/e-mails preservam caixa e caracteres; unicidade e retries continuam
  funcionando.
- Não houve update de código histórico, renderização de PDF ou migration de
  dados.
- Staging mostrou, em PDF real, que QR e fallback textual são legíveis e
  consultam o estado vigente.
