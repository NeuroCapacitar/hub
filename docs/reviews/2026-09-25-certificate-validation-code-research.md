---
status: research_only
owner: product_and_engineering
last_verified_commit: 7d096bee
last_verified_at: 2026-09-25
---

# UX e formato do código público de Certificado — 2026-09-25

## Conclusão executiva

O código atual não está tecnicamente errado: são 32 dígitos hexadecimais mais
`PRT-`, derivados de UUIDv4, com 122 bits aleatórios. A dimensão, porém, está
sendo exposta em mais contextos do que o usuário precisa. No Hub, a verificação
já acontece ao abrir o link público ou escanear o QR; não há uma tela na qual o
Aluno precise digitar o código. Assim, reduzir a repetição do identificador nas
listas e manter o código completo apenas nos pontos que ajudam a comparar ou
recuperar o certificado é a melhoria de UX mais segura e de menor custo.

Não recomendo truncar o valor atual para 8, 12 ou 16 caracteres. Se, depois de
remover a exposição redundante, o código impresso ainda parecer longo, uma
codificação mais compacta pode preservar a imprevisibilidade sem alterar
certificados antigos. Para uso humano, Crockford Base32 é mais apropriado que
Base64URL, embora economize menos caracteres. Nenhum formato alternativo foi
implementado nesta análise.

## O que existe no Hub

### Geração e validação

`createCertificateCode` remove os hífens de `randomUUID()`, converte os dígitos
para maiúsculas, conserva 32 caracteres hexadecimais e acrescenta `PRT-`. UUIDv4
tem 128 bits no total, dos quais 122 são aleatórios; os outros seis identificam
versão e variante. Portanto, o código não é “32 bits”: são 32 caracteres que
representam até 128 bits, com 122 bits de entropia. A RFC define essa composição
e o Node documenta `randomUUID()` como UUIDv4 gerado com um PRNG criptográfico.
[RFC 9562, §5.4](https://www.rfc-editor.org/rfc/rfc9562.html#section-5.4),
[Node.js `crypto.randomUUID`](https://nodejs.org/api/crypto.html#cryptorandomuuidoptions).

O campo do banco é texto único, sem limite de comprimento; o servidor ainda
repete a tentativa até três vezes quando a constraint de unicidade encontra uma
colisão. A consulta pública é pelo código exato e a rota pública limita a busca
a 20 solicitações por minuto por IP. O valor funciona como localizador opaco de
uma página pública, não como senha ou prova criptográfica por si só; a página
consultada mostra informações do Certificado e seu estado. Referências OWASP a
IDs de sessão e tokens servem como comparação de imprevisibilidade, não como
requisito normativo específico para este Certificado. [OWASP — Session ID
Entropy](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html#session-id-entropy),
[OWASP — Forgot Password URL Tokens](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html#url-tokens).

### Onde o código completo aparece

| Superfície | Situação atual | Leitura de UX |
| --- | --- | --- |
| PDF do Certificado | Código e QR que abre a URL pública | Manter um código legível como alternativa ao QR; não há razão para removê-lo do documento sem validar a necessidade de uso manual. |
| Página pública de validação | Mostra o código completo e oferece “Copiar link” | O código ajuda a comparar a página aberta com o documento, mas falta uma ação explícita para copiar somente o código. |
| Cartão do Aluno | Código completo no cartão, além de ações de visualizar/baixar | Duplicado para navegação; ocupa altura e não é necessário para abrir ou compartilhar o Certificado. |
| Histórico de revogados | Código completo no card e ação “Visualizar” | A ação abre a página que já identifica o registro; a repetição parece dispensável. |
| Dashboard Admin | Coluna “Código” com o texto completo e ação “Ver” | A coluna aumenta a largura/altura da tabela mesmo quando a ação já abre o registro. Melhor remover ou tornar o código uma ação secundária copiável. |
| Operações de Certificados no Admin | Código truncado no contexto da pessoa, com valor completo no `title` | Já reduz ruído visual; uma ação de copiar seria mais acessível que depender de hover/title. |
| E-mail de emissão | Repete o código no texto e oferece link “Ver e validar certificado” | Redundância: o link já resolve a consulta; manter o código só se houver uma necessidade comprovada de digitação a partir do e-mail. |
| Página do Curso do Aluno | Mostra link “Ver certificado”, não o código | É um bom padrão de navegação por link sem repetir o identificador. |

Evidências de implementação: `src/features/certificates/rules.ts`,
`src/features/certificates/server.ts`,
`src/features/certificates/public-rate-limit.ts`,
`src/app/certificados/[code]/page.tsx`,
`src/app/certificados/[code]/certificate-public-code.tsx`,
`src/app/(student)/app/certificados/certificate-card.tsx`,
`src/app/(student)/app/certificados/certificate-history-card.tsx`,
`src/app/(admin)/admin/(dashboard)/page.tsx`,
`src/components/admin/student-certificate-operations.tsx` e
`src/features/email/templates.tsx`. A rota pública é parametrizada pelo código e
não oferece uma tela de busca manual; QR e links já carregam o identificador.

## O que os padrões e plataformas consultados mostram

### Padrões de credenciais digitais

O TrustEd Credential Profile da 1EdTech define o `id` de uma credencial como uma
URI de referência não ambígua. Um `humanCode` opcional aparece no objeto
Achievement, associado à realização, sem comprimento prescrito; isso não define
um código curto para localizar cada certificado emitido. O guia de implementação
descreve URL como mecanismo universal e fácil de compartilhar, ao mesmo tempo
que recomenda controle do titular sobre a publicação dos próprios dados.
[1EdTech — TrustEd Credential Profile](https://standards.1edtech.org/open-badges/specifications/standards/ob-trustedcredential/v1p0),
[1EdTech — Implementation Guide, URL sharing](https://standards.1edtech.org/open-badges/guides/standards/v3p0/impl).

O guia também descreve um código de seis dígitos lido de volta pelo candidato em
uma verificação verbal de identidade. Esse é um desafio de confirmação entre
duas pessoas, não um identificador público permanente para substituir a URL do
Certificado. [1EdTech — Recipient identity example](https://www.imsglobal.org/node/208021).

### Exemplos de emissores e plataformas

- **Credly:** a documentação instrui o titular a copiar o “Public Link” e
  hiperlinkar a imagem da badge; quem clica volta à Credly para ver os detalhes.
  A documentação consultada não prescreve um código de validação digitável ou
  seu tamanho. [Credly — Share a badge in an email signature](https://support.credly.com/hc/en-us/articles/360041543152-Can-I-attach-my-badge-to-my-email-signature),
  [Credly — What is a badge?](https://support.credly.com/hc/en-us/articles/360021222071-What-is-a-badge).
- **Accredible:** seu QR abre a página hospedada e atual do Certificado; a
  plataforma também documenta verificação por QR ou URL. O link/QR é a rota de
  consulta, não um número que o verificador precise transcrever. [Accredible — QR
  verification](https://www.accredible.com/blog/an-introduction-to-accredibles-design-tools),
  [Accredible — Testing and Awarding Bodies](https://www.accredible.com/solutions/testing-awarding-bodies).
- **Blackboard Course Catalog:** o titular copia um link de autenticidade; a
  página exibe o ID único, a validade e os detalhes relevantes. O fluxo
  documentado começa pelo link, e não por uma busca manual do ID. [Anthology —
  Certificate Authenticity](https://help.anthology.com/course-catalog/en/learners/dashboard.html).
- **Brasil, validação de cursos:** a SENASP informa que seus certificados podem
  ser validados pelo código alfanumérico impresso ou pelo QR Code. A EV.G também
  documenta código identificador e QR, e alerta para erros de transcrição entre
  caracteres parecidos. São exemplos úteis de redundância para documentos
  impressos, não evidência de um tamanho universal de código. [SENASP — Regras dos
  cursos, pergunta 46](https://www.gov.br/mj/pt-br/assuntos/sua-seguranca/seguranca-publica/dep/ead-senasp/perguntas-frequentes/sobre-as-regras-dos-cursos),
  [EV.G — FAQ de certificados](https://www.evatalk.escolavirtual.gov.br/perguntas-frequentes).
- **Parchment Digital Badges:** a documentação cita um código de dez dígitos,
  mas é para *claim* (resgatar/receber uma badge), não para validar uma credencial
  já emitida. Não deve ser usado como evidência de que 10 dígitos bastariam para
  o código público do Hub. [Instructure — Awarding and claiming a badge using QR
  and claim codes](https://community.instructure.com/en/kb/articles/663768-awarding-and-claiming-a-badge-using-qr-and-claim-codes).

O conjunto não mostra um único padrão de comprimento. Mostra dois caminhos
complementares: URL/QR para consulta direta e, em certificados impressos, um
código de fallback que pode ser digitado. A maioria dos materiais oficiais
consultados descreve com mais destaque o link compartilhável; não informa que o
ID canônico deva ser mostrado por extenso em todas as telas do titular.

### Discussões de desenvolvedores

Uma discussão do Stack Overflow sobre encurtar UUIDs distingue truncar os bits
de re-encodar os mesmos bytes: truncar aumenta colisões; codificar os bytes crus
em Base64 reduz caracteres sem o mesmo corte de informação. Respostas mais
recentes na mesma conversa sugerem manter o ID completo como chave e, quando
realmente necessário, separar um código curto de apresentação. É opinião de
comunidade e a discussão é antiga; serve como validação qualitativa da distinção
entre truncamento e codificação, não como norma de segurança. [Stack Overflow —
UUID to a short code](https://stackoverflow.com/questions/4564112/is-it-safe-to-turn-a-uuid-into-a-short-code-only-use-first-8-chars).

## Opções avaliadas

### 1. Manter o código e exibi-lo completo em todos os lugares

**Não recomendo como padrão de UX.** A integridade do identificador permanece,
mas os cartões, a tabela, o e-mail e a página pública repetem um token longo em
superfícies cuja ação principal já é abrir ou baixar o Certificado. A tabela
fica especialmente penalizada porque quebra uma sequência grande em várias
linhas e disputa espaço com aluno, curso, status e data.

### 2. Truncar o UUID ou usar só um prefixo/sufixo

**Não recomendo como ID de validação.** O valor reduz a entropia e aumenta a
probabilidade de colisão; o prefixo `PRT-` é fixo e não acrescenta aleatoriedade.
Mostrar `PRT-…AB12` pode servir como resumo visual, desde que a UI o chame de
“final do código” e mantenha uma ação clara para copiar o valor completo. Não
deve ser usado como substituto ambíguo em URL ou busca.

### 3. Re-encodar a mesma quantidade de aleatoriedade

**Viável se a redução no próprio PDF for importante depois de refinar as
superfícies.** Com 16 bytes aleatórios, Base64URL resulta em 22 caracteres
(mais `PRT-`, total 26), mas diferencia maiúsculas e minúsculas e pode ser mais
difícil de ditar. Crockford Base32 usa 26 caracteres para 128 bits (total 30
com prefixo) e evita parte dos caracteres ambíguos, mas exige encoder/decoder e
testes próprios. O código atual tem 36 caracteres com prefixo; Base32 reduziria
seis, Base64URL dez. Os ganhos são reais, mas não enormes, e o alfabeto precisa
ser avaliado no certificado impresso.

Se adotado, o novo formato deve ser usado apenas para Certificados novos; links
e PDFs existentes continuam válidos e não são reescritos. A coluna `code` é
texto com unicidade, mas geração, padrão de testes, QR, PDF, e-mail e lookup
precisariam continuar aceitando o formato legado. Qualquer campo de digitação
futuro também precisaria normalizar caixa e tratar erros sem relaxar o rate
limit.

### 4. Separar código canônico de código curto de apresentação

**Não recomendo no sprint atual.** Criar um segundo identificador curto implica
armazenamento, garantia de unicidade, busca pública, tratamento de colisões,
suporte e coordenação entre o ID de referência e o ID de compartilhamento. O
Hub não oferece formulário para digitar o código: o caminho principal já é a
URL do certificado ou o QR. Esse custo parece maior que a necessidade
demonstrada.

## Recomendação para o Hub

1. **Manter o código canônico atual enquanto a geração não for decidida.** É um
   UUIDv4 compacto, com 122 bits aleatórios, e a base hex tem uma vantagem
   humana: usa só dígitos e `A-F`, sem letras maiúsculas/minúsculas ou confusão
   `O/0` e `I/1`.
2. **Reduzir onde o código integral aparece.** Retirar do cartão do Aluno, do
   card de histórico revogado, da tabela de certificados recentes do Dashboard
   e do corpo do e-mail, salvo se uma necessidade operacional concreta for
   confirmada. Preservar link “Ver/Visualizar” e o link de compartilhamento.
3. **No detalhe de suporte/Admin, manter acesso sob demanda.** O código completo
   pode continuar no painel de detalhes, com botão de copiar, sem ocupar uma
   coluna no Dashboard. O `title`/hover sozinho não é um mecanismo suficiente
   para copiar ou descobrir o valor em tela touch.
4. **Na página pública, manter o código completo como referência secundária.**
   O usuário chegou pela URL/QR, então essa página não precisa induzi-lo a
   digitar o código; um botão “Copiar código” seria a ação explícita para o caso
   de precisar compartilhar apenas o identificador. O botão atual “Copiar link”
   continua sendo a ação principal.
5. **No PDF, manter um fallback de texto e o QR.** Não remover o código do
   documento impresso. Primeiro confirmar a leitura real do campo de 10 pt e da
   arte em tamanho 100%; se ainda estiver excessivo, testar um formato
   re-encodado que conserve 122–128 bits e medir legibilidade/erros de
   transcrição antes de decidir.

Essa ordem trata primeiro a exposição redundante, sem mexer nos links de
Certificados já distribuídos. Se o problema restante for só a altura/largura do
campo impresso, a decisão sobre formato pode ser tomada com um teste visual
isolado do PDF, não com uma migração geral antecipada.

## Limites da pesquisa

Os exemplos de plataforma são uma amostra documental, não um levantamento de
market share. Vários fornecedores não publicam o comprimento de IDs ou usam
formatos internos não exibidos ao Aluno. A pesquisa não prova que todos os
verificadores aceitam URL/QR nem que códigos manuais estejam obsoletos. O
relatório não recomenda alterar certificados emitidos ou apagar seus códigos.
