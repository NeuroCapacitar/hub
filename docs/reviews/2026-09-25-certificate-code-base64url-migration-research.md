---
status: research_only
owner: product_and_engineering
last_verified_commit: 7d096bee
last_verified_at: 2026-09-25
---

# Migração do código público de Certificado para Base64URL — pesquisa e plano

## Conclusão executiva

**Base64URL sem prefixo é uma opção tecnicamente válida para novos Certificados**: gerar 16 bytes criptograficamente aleatórios e codificá-los como Base64URL sem padding produz 22 caracteres e preserva 128 bits de aleatoriedade. Comparado ao formato atual de 36 caracteres (`PRT-` + 32 hexadecimais), reduz 14 caracteres (38,9%). Manter `PRT-` resultaria em 26 caracteres, economia de 10 (27,8%). O prefixo fixo não adiciona entropia; só contexto visual. [RFC 4648, §§3.2 e 5](https://www.rfc-editor.org/rfc/rfc4648#section-3.2), [Node.js Buffer](https://nodejs.org/docs/latest-v24.x/api/buffer.html#buffers-and-character-encodings)

**Recomendação para decisão:** adotar o formato canônico de 22 caracteres sem `PRT-` para emissões e reemissões futuras, desde que o Hub trate QR e link copiável como caminhos principais e preserve o código completo legível como alternativa. O código deve ser rotulado (“Código de validação”), não apresentado como um token de acesso. Não reescrever códigos, PDFs, snapshots, QR ou links já emitidos.

Esta análise refina a nota preliminar `2026-09-25-certificate-validation-code-research.md`: aquela recomendava manter o formato atual até se separar claramente truncamento (perde entropia) de re-encoding Base64URL (preserva 128 bits com `randomBytes(16)`). A proposta atual aceita a mudança de formato, condicionada aos gates abaixo.

O principal custo do Base64URL é operacional, não criptográfico: ele distingue maiúsculas de minúsculas e contém caracteres visualmente parecidos. É melhor para link, QR e copiar/colar do que para ditado ou transcrição manual. Se a digitação a partir do papel for um caso frequente, essa decisão deve ser testada antes do lançamento; o formato compacto não deve piorar a verificação humana.

## Baseline verificado no Hub

- `createCertificateCode` recebe atualmente um `randomUUID()`, remove os hífens, converte para maiúsculas e antepõe `PRT-`. UUIDv4 tem 122 bits aleatórios: seis posições do campo de 128 bits são definidas para versão e variante. O formato atual, portanto, não tem 128 bits aleatórios, apesar de possuir 32 dígitos hexadecimais. [RFC 9562, §5.4](https://www.rfc-editor.org/rfc/rfc9562.html#section-5.4)
- `PRT-` é uma constante aplicada a todos os Cursos; não codifica `course_id` nem varia por Curso. Sua remoção economiza quatro caracteres e não reduz entropia, mas perde o contexto visual do namespace quando o código é separado do link.
- O código fica em `certificates.code`, tipo `text`, com unicidade no banco; o snapshot exige apenas uma string não vazia. O lookup compara o valor exato recebido com a coluna. Não há, no schema atual, limite de comprimento ou constraint de formato que exija DDL para códigos menores ou mistos.
- As rotas públicas são identificadas por `/certificados/[code]`; o certificado contém o código e um QR, e a página é a fonte viva do estado. Há rate limit da consulta pública. O código é um localizador público e opaco, não uma senha, um segredo de autorização ou uma assinatura criptográfica. A validação de integridade/status é responsabilidade do registro consultado; os padrões Open Badges também distinguem identificador de credencial, prova e estado. [1EdTech Open Badges 3.0 — verificação e status](https://standards.1edtech.org/open-badges/specifications/standards/v3p0/cert)
- O servidor já trata colisão contra a constraint única com retry. Há dois pontos de geração no ciclo de emissão/reconciliação; ambos devem usar o mesmo gerador novo.
- **Incompatibilidade importante:** a função atual normaliza a entrada para letras maiúsculas e remove caracteres não alfanuméricos. Ela não pode ser reaproveitada para Base64URL: isso alteraria a identidade do token, removeria `-` e `_` e quebraria a distinção entre maiúsculas e minúsculas. Separar geração, validação de formato e lookup literal é requisito da migração.
- **Redaction:** o redactor do Sentry substitui genericamente o segmento de URL `/certificados/<code>`, mas a regra de texto avulso reconhece somente `PRT-...`. Um token novo sem prefixo pode escapar em mensagens, breadcrumbs, spans ou transactions fora de URLs. Ampliar e testar essa redação antes da primeira emissão Base64URL, sem uma regex tão genérica que apague qualquer sequência de 22 caracteres sem contexto.
- **Contratos externos:** o checker local do Resend valida as variáveis `CERTIFICATE_CODE` e `ACTION_URL`, mas não o conteúdo do Hosted Template. Antes de remover `PRT-`, revisar o template publicado e as artes A4 ativas para saber se prefixo, caixa ou comprimento foram fixados editorialmente.

Evidências locais: `src/features/certificates/rules.ts`, `src/features/certificates/server.ts`, `src/features/certificates/public-rate-limit.ts`, `src/features/certificates/render-snapshot.ts`, `src/db/schema.ts`, `src/app/certificados/[code]/page.tsx` e `docs/domain/certificates-and-data-rights.md`.

## Formatos comparados

| Formato futuro | Comprimento visível | Aleatoriedade | Redução frente ao código atual | Trade-off principal |
| --- | ---: | ---: | ---: | --- |
| Atual: `PRT-` + UUIDv4 em hex | 36 | 122 bits | — | Simples e insensível a caixa, mas longo. |
| Base64URL sem prefixo | 22 | 128 bits | 14 caracteres / 38,9% | Mais curto; case-sensitive e menos amigável para digitação. |
| `PRT-` + Base64URL | 26 | 128 bits | 10 caracteres / 27,8% | Mantém contexto textual, mas o prefixo é informação redundante e não acrescenta segurança. |

Para 16 bytes, Base64 padrão usa 24 caracteres incluindo dois sinais de padding. RFC 4648 permite omitir o padding quando o comprimento original é conhecido; o Node.js faz isso ao codificar com `base64url`. O alfabeto troca `+` e `/` por `-` e `_`, apropriados para identificadores em URL. O resultado tem 22 caracteres; os bits de preenchimento finais não representam entropia adicional. [RFC 4648, §§3.2, 3.5 e 5](https://www.rfc-editor.org/rfc/rfc4648), [Node.js Buffer encodings](https://nodejs.org/docs/latest-v24.x/api/buffer.html#buffers-and-character-encodings)

A geração proposta é baseada em `randomBytes(16)`, não em truncar o UUID atual: isso oferece 128 bits aleatórios completos, e não os 122 bits de UUIDv4. O Node documenta `crypto.randomBytes` como gerador de dados pseudoaleatórios criptograficamente fortes. A recomendação OWASP de CSPRNG e pelo menos 128 bits é para identificadores de sessão, que são mais sensíveis que um código de verificação público; serve aqui como referência conservadora de imprevisibilidade, não como requisito direto do produto. [Node.js Crypto](https://nodejs.org/docs/latest-v24.x/api/crypto.html#cryptorandombytessize-callback), [OWASP Session ID Entropy](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html#session-id-entropy)

## Compartilhar, verificar e resgatar são fluxos diferentes

- **Identificador/URL de verificação:** aponta para um registro de uma credencial já emitida e permite consultar seu estado atual. O modelo Open Badges 3.0 contempla credenciais verificáveis, prova e status; não estabelece que um identificador humano deva ter determinado número de caracteres. A Credly orienta compartilhar o “Public Link”. A Accredible descreve QR impresso que abre o registro digital vivo, refletindo mudanças de status como revogação. Esses exemplos favorecem URL/QR como percurso principal; não especificam uma codificação pública curta que o Hub deva copiar. [1EdTech](https://standards.1edtech.org/open-badges/guides/standards/v3p0/impl), [Credly — Public Link](https://support.credly.com/hc/en-us/articles/360041543152-Can-I-attach-my-badge-to-my-email-signature), [Accredible — QR em certificados impressos](https://www.accredible.com/blog/an-introduction-to-accredibles-design-tools), [Accredible — verificação por QR/URL](https://www.accredible.com/solutions/testing-awarding-bodies)
- **Código digitável para verificação:** a documentação oficial da EV.G orienta localizar o código identificador no verso do certificado e inseri-lo no validador; oferece QR como alternativa. É evidência de que um código manual pode coexistir com QR, não evidência de comprimento ideal ou de prevalência entre plataformas. [EV.G — FAQ de certificados](https://www.evatalk.escolavirtual.gov.br/perguntas-frequentes)
- **Código de claim/resgate:** o material oficial da Instructure/Parchment descreve claim codes para conceder/reivindicar uma badge, com URL de claim e possibilidades de expiração e limite de uso. Isso controla entrega/claim; não é um localizador estável para validar uma credencial já emitida. Os dez dígitos documentados ali não são comparação apropriada para encurtar o código de validação do Hub. [Instructure — award/claim com QR e claim codes](https://community.instructure.com/en/kb/articles/663768-awarding-and-claiming-a-badge-using-qr-and-claim-codes)

**Os exemplos acima são uma amostra documental, não evidência de market share ou de uma convenção universal.** A documentação consultada não sustenta a alegação de que “todos os players usam códigos curtos” nem de que exista um tamanho padrão para códigos de validação.

## Cópia e digitação: impacto da escolha

Base64URL distingue caixa: letras maiúsculas e minúsculas representam valores diferentes. Seu alfabeto também contém `0/O`, `1/I/l`, além de `-` e `_`; portanto, reduzir caracteres não garante menor esforço de transcrição. A EV.G oferece o código manual e o QR como alternativas e alerta para confusões de caracteres/capitalização; isso é um bom precedente para redundância de canais, mas não elimina esses riscos. [RFC 4648, tabela do alfabeto Base64URL](https://www.rfc-editor.org/rfc/rfc4648#section-5), [EV.G — FAQ de certificados](https://www.evatalk.escolavirtual.gov.br/perguntas-frequentes)

Recomendações de UX e contrato:

1. Manter o QR e o link canônico como forma mais fácil de validar.
2. Nas superfícies digitais, disponibilizar “Copiar código” copiando o valor canônico exato, sem transformações; “Copiar link” continua sendo o compartilhamento mais direto.
3. No PDF, mostrar o código integral junto a um rótulo claro. Preservar capitalização; escolher fonte monoespaçada/legível e espaçamento que ajude a leitura sem mudar os caracteres gravados.
4. Não inserir hífens de agrupamento no valor: hífen já pertence ao alfabeto Base64URL. Se o design separar visualmente grupos com espaços, o código copiado deve continuar sem espaços; qualquer formulário futuro deve remover apenas espaços de apresentação, nunca mudar caixa ou eliminar `-`/ `_`.
5. Não colocar o token em minúsculas/maiúsculas para “ajudar”, nem aceitar uma versão normalizada como equivalente. Isso cria identificadores ambíguos e pode direcionar para outro registro. Tratar o código como dado opaco e fazer lookup exato.
6. Se a validação manual a partir de papel se mostrar comum, comparar Base64URL com um alfabeto orientado à leitura humana antes de fechar o contrato. Isso pode custar alguns caracteres, mas não deve ser confundido com claim codes ou com redução de entropia.

## Plano cauteloso de migração

### 1. Fechar o contrato antes de codificar

Decisão recomendada: **novas emissões usam exatamente 16 bytes aleatórios, Base64URL canônico sem padding, 22 caracteres, sem `PRT-`**. O prefixo não é dado de segurança e o contexto será expresso pelo texto “Código de validação”, pela marca do certificado e pelo domínio/rota. Manter uma especificação que declare explicitamente: alfabeto permitido, tamanho, caixa significativa e comportamento do lookup.

### 2. Gerar o formato novo sem tocar nos antigos

Criar um gerador distinto, baseado em CSPRNG de 16 bytes e codificação Base64URL. Substituí-lo nos dois caminhos de emissão/reconciliação, mantendo retry limitado em colisões contra a constraint `certificates_code_unique`. Cada retry deve gerar bytes novos. Não converter os UUIDs armazenados, não trocar o `code` de linhas existentes e não re-renderizar PDFs históricos.

O schema atual `text UNIQUE` e o parser permissivo de snapshot indicam que **não há motivo conhecido para migration de banco**. Antes de release, confirmar essa conclusão contra o schema/migrations de cada ambiente; não acrescentar constraint de formato que exclua códigos legados.

### 3. Preservar lookup e artefatos dos dois formatos

O lookup deve continuar consultando o código exato, sem normalizar. Códigos antigos `PRT-…` permanecem válidos; códigos novos com caixa mista, `-` ou `_` devem resolver exatamente. Não é necessário alias ou redirect para códigos existentes, porque as URLs antigas não mudam.

O mesmo código persistido deve alimentar snapshot, PDF, QR, e-mail, página pública, preview/download e operações Admin/Suporte. Reemissão continua criando novo identificador: o link antigo deve continuar mostrando o histórico revogado, e o novo link deve mostrar a substituição válida. Confirmar que logs/redação de observabilidade não dependem do padrão `PRT-hex`.

### 4. Testar em Staging e liberar como mudança somente de novas emissões

Cobertura mínima:

- teste determinístico do gerador: 16 bytes ⇒ exatamente 22 caracteres do alfabeto Base64URL, sem padding/prefixo; decodificar e confirmar retorno aos mesmos 16 bytes;
- assegurar que mudanças de caixa produzam lookup distinto; validar explicitamente `-` e `_`;
- emitir por conclusão normal, emissão manual/reconciliação e reemissão; provocar colisão e confirmar retry, mantendo unicidade;
- abrir certificado novo via QR, URL copiada, PDF, preview, link de e-mail e página pública em estados válido/revogado; provar que links antigos ainda resolvem;
- conferir legibilidade e encaixe do código real no template de Certificado e na página Admin; assegurar que copiar código/link preserve o valor sem alteração;
- verificar rate limit e redaction/telemetria com novos tokens; nenhum código deve vazar em logs de erro;
- testar lookup no release anterior antes de permitir rollback de aplicação: embora o caminho atual faça igualdade exata e o campo aceite texto, isso deve ser provado no artefato de rollback efetivamente usado.

O rollout não exige backfill: depois do deploy, o banco terá temporariamente códigos antigos e novos. Isso é esperado. Monitorar erros de lookup, falhas de renderização/QR e conflitos únicos; pausar novas emissões Base64URL se algum leitor, renderer, proxy ou integração externa modificar caixa/caracteres. Rollback reverte somente a geração para o formato anterior; não deve invalidar os tokens novos já gravados.

## Limitações da pesquisa

- A requisição do Context7 para a página de Crypto falhou; os fatos de Node foram confirmados na documentação oficial Node.js v24 por pesquisa e abertura web. A consulta de Buffer no Context7 funcionou.
- A abertura direta da página de validação EV.G retornou HTTP 502; usei a FAQ oficial da ENAP para confirmar o fluxo código + QR, sem tratar orientações de caixa vistas em resultado indexado como contrato de produção.
- Encontrei documentação da Accredible sobre sua própria integração com Blackboard, mas não uma documentação Blackboard-owned que estabeleça formato de código de credencial. Não atribuo práticas da integração à Blackboard nativa.
- Fontes são especificações, docs de emissores e páginas de produto selecionadas. **Não medem participação de mercado**, adoção relativa nem taxas de erro de usuários.

## Fontes primárias

- [RFC 4648 — Base-N Encodings](https://www.rfc-editor.org/rfc/rfc4648), §§3.2, 3.5 e 5.
- [RFC 9562 — UUIDs](https://www.rfc-editor.org/rfc/rfc9562.html), §5.4.
- [Node.js v24 Buffer — encodings](https://nodejs.org/docs/latest-v24.x/api/buffer.html#buffers-and-character-encodings).
- [Node.js v24 Crypto — randomBytes](https://nodejs.org/docs/latest-v24.x/api/crypto.html#cryptorandombytessize-callback).
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html#session-id-entropy).
- [1EdTech Open Badges 3.0 — Implementation Guide](https://standards.1edtech.org/open-badges/guides/standards/v3p0/impl) e [Conformance Guide](https://standards.1edtech.org/open-badges/specifications/standards/v3p0/cert).
- [Credly — compartilhar via Public Link](https://support.credly.com/hc/en-us/articles/360041543152-Can-I-attach-my-badge-to-my-email-signature).
- [Accredible — QR em certificados impressos](https://www.accredible.com/blog/an-introduction-to-accredibles-design-tools); [Accredible — verificação por QR ou URL](https://www.accredible.com/solutions/testing-awarding-bodies).
- [EV.G — FAQ de certificados](https://www.evatalk.escolavirtual.gov.br/perguntas-frequentes); [SENASP — validação por código ou QR](https://www.gov.br/mj/pt-br/assuntos/sua-seguranca/seguranca-publica/dep/ead-senasp/perguntas-frequentes/sobre-as-regras-dos-cursos).
- [Instructure/Parchment — claim codes de badge](https://community.instructure.com/en/kb/articles/663768-awarding-and-claiming-a-badge-using-qr-and-claim-codes).
