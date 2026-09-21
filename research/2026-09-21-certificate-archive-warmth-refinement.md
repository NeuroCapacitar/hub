# Pesquisa: calor visual do arquivo de certificados e preview PNG

> Escopo: investigação somente leitura da experiência autenticada do arquivo de
> certificados do Hub e da hipótese de usar o preview PNG como miniatura visual.
> Data: 2026-09-21. Worktree: `small-changes`. Código não foi alterado.

## Decisão

Usar o preview PNG no arquivo privado é recomendável, mas apenas como miniatura
lazy/progressiva para certificados `valid + ready`. A imagem deve reforçar a
conquista e a recuperação visual do documento, sem substituir título, status,
código, PDF ou link público.

Guardrails da decisão:

- manter a estrutura textual atual como fallback imediato e acessível;
- carregar somente quando próximo da viewport ou após uma ação explícita;
- não carregar previews de `pending`, `failed` ou `revoked`;
- preservar `Baixar PDF`, `Copiar link` e a página pública como ações
  distintas;
- usar a miniatura como reconhecimento visual, não como prova de competência,
  badge ou Open Badge;
- tratar falha de imagem como falha visual recuperável;
- se “privado” significar somente o titular autenticado, criar antes uma rota
  autenticada: a rota existente de preview é pública por código, embora o objeto
  R2 seja privado.

Não recomendo gerar uma nova imagem derivada, criar galeria ou fazer o PNG
dominar cada card. PDF e página canônica continuam os artefatos de download e
verificação.

## Evidência interna

`src/app/(student)/app/certificados/page.tsx` busca todos os certificados com
`getCertificatesForUser` e renderiza um `CertificateCard` por registro. O
estado vazio explica a condição de emissão e volta aos Cursos.

`certificate-card.tsx` já oferece Curso, status, data, carga horária, código,
download quando pronto, suporte em falha, atualização em preparo e cópia do link.
O arquivo é uma biblioteca de documentos e estados; a miniatura deve adicionar
reconhecimento e escaneabilidade, não uma segunda página pública em cada card.

`src/app/certificados/[code]/page.tsx` é a página pública canônica, com
`noindex,nofollow`, rate limit antes do lookup e imagem apenas para
`valid + ready`. O preview é A4 horizontal em `1200x848`.

`src/app/certificados/[code]/preview/route.ts` valida o limite e redireciona
com `307` para URL assinada do R2, `image/png` e `inline`. Erros retornam
`404` ou `503`, `no-store` e `retry-after`.

`src/features/certificates/preview-server.ts` verifica o digest do PNG e
reutiliza o objeto quando o hash confere. Objeto ausente, legado sem digest ou
com hash divergente pode disparar Sharp, fetch de arte/assinatura, geração de QR,
upload e persistência de `preview_sha256`.

`src/features/certificates/public-rate-limit.ts` permite 20 consultas por
janela de 60 segundos por hash de IP. O preview continua sendo uma rota pública
rate-limited mesmo quando chamado pelo arquivo autenticado.

## Comparação oficial

### Thinkific

Thinkific oferece acesso ao certificado dentro do Curso e também nas
configurações da conta, inclusive após o fim do acesso. O aluno vê/baixa um PDF,
e o certificado é tratado como snapshot do momento da emissão.

Aplicação: manter a entrada contextual no Curso e o arquivo global. A miniatura
ajuda a reencontrar o documento, mas não substitui o PDF.

Fonte: [Thinkific Certificates](https://support.thinkific.com/hc/en-us/articles/360040594393-Thinkific-Certificates)

### LinkedIn Learning

O link de compartilhamento é separado do download do PDF. A página de link pode
ser vista por quem o possuir, pode ser desligada pelo usuário, e o PDF pode ser
compartilhado sem criar a página.

Aplicação: manter `Copiar link` e `Baixar PDF` como ações diferentes. A
miniatura não deve parecer publicação automática; o link deve ser tratado como
público para quem o possui.

Fontes: [Share Certificates of Completion FAQ](https://www.linkedin.com/help/learning/answer/a706118) e [View and download Certificates](https://www.linkedin.com/help/learning/answer/a700836/view-and-download-learning-certificates-of-completion?lang=en)

### Credly

Credly usa imagem como porta de entrada, mas o clique retorna à página com
metadados e verificação. Perfil e badges individuais têm controles público/
privado.

Aplicação: miniatura melhora reconhecimento, mas título, status, código e link
canônico continuam obrigatórios. O PNG não deve ser chamado de badge: o Hub não
tem ainda critérios, evidências e metadados interoperáveis equivalentes.

Fontes: [What is a badge?](https://support.credly.com/hc/en-us/articles/360021222071-What-is-a-badge) e [How do I manage my privacy?](https://support.credly.com/hc/en-us/articles/360021220971-How-do-I-manage-my-privacy)

### Udemy

Udemy permite salvar o certificado como PDF ou JPG e compartilhar por URL.
Também declara que o certificado demonstra habilidades/conquistas, mas não é
acreditação formal.

Aplicação: usar linguagem de “Curso concluído”, “Certificado pronto”,
“Ver documento” e “Verificar”, sem prometer certificação profissional.

Fonte: [How to download your certificate](https://support.udemy.com/hc/en-us/articles/229603868-How-to-download-your-certificate-of-completion-on-a-browser)

### Open Badges e W3C VC

1EdTech define Open Badges como arquivos JSON/JSON-LD com metadados de emissor,
pessoa, conquista e possível evidência; a imagem PNG/SVG é uma camada visual que
pode ser compartilhada ou enviada a uma carteira. W3C VC 2.0 separa issuer,
holder e verifier e inclui segurança e privacidade como parte do modelo.

Aplicação: reutilizar o PNG não transforma o certificado em Open Badge ou VC.
Portabilidade, assinatura, critérios, evidência, status/revogação e divulgação
seletiva exigiriam projeto separado.

Fontes: [1EdTech Open Badges](https://www.1edtech.org/standards/open-badges), [W3C VC Data Model 2.0](https://www.w3.org/TR/vc-data-model/) e [W3C VC Data Integrity 1.1](https://www.w3.org/TR/vc-data-integrity-1.1/)

### Design systems

Carbon recomenda que estados vazios expliquem o que aparecerá, orientem o
próximo passo e evitem conteúdo excessivo. Para carregamento progressivo, a
estrutura e o texto vêm primeiro; imagens e conteúdo secundário entram depois.
Material descreve cards como entradas para detalhe e alerta contra excesso de
conteúdo/ações. GOV.UK usa summary cards para resumo e ações do mesmo registro.

Aplicação: a miniatura é apoio do card, em moldura A4 pequena e estável, com
`alt` factual e fallback. Título e status devem continuar legíveis antes ou
junto da imagem.

Fontes: [Carbon empty states](https://carbondesignsystem.com/patterns/empty-states-pattern/), [Carbon loading](https://preview.carbondesignsystem.com/building-blocks/core/patterns/loading), [Material cards](https://m1.material.io/components/cards.html) e [GOV.UK summary list](https://design-system.service.gov.uk/components/summary-list/)

## Avaliação

### Calor visual e conquista

A forma, cor, assinatura, QR e nome do documento tornam o arquivo menos parecido
com uma tabela operacional e mais parecido com um arquivo de conquistas. O
ganho vem da presença consistente do artefato, não de brilho, animação ou
gamificação.

O limite é exposição repetida: o PNG contém nome do Aluno, Curso e dados
impressos. A miniatura deve ser pequena e apoiar o título/status; não deve virar
uma galeria de documentos.

### Legibilidade

`1200x848` é suficiente para a página pública, mas uma miniatura abaixo de
400px não torna texto fino, código ou QR confiável. Usar a imagem para
reconhecimento, nunca para substituir código, status ou metadados textuais. O
`alt` deve ser curto, por exemplo `Prévia do certificado de Curso X`.

### Custo de carregamento

O arquivo atual não baixa mídia. Para cada PNG pronto, o fluxo atual tende a
produzir:

1. GET do navegador para a rota de preview;
2. consulta ao banco e verificação `HEAD` do digest;
3. `307` para URL assinada;
4. download do PNG original.

O tamanho real comprimido não foi medido porque não há objeto R2 de produção
disponível. Como a página pública usa `unoptimized`, não há evidência de
redimensionamento/compressão do Next.js. Uma lista longa pode causar `n`
fetches, `n` lookups e `n` verificações. Não carregar tudo acima da dobra.

### Rate limit, regeneração e cache

O limite de 20/min/IP é compartilhado por página pública, PDF e preview. Abrir
um arquivo com dezenas de miniaturas pode consumir a quota usada para validação
pública.

Se houver preview sem digest ou inconsistente, a primeira leitura pode executar
Sharp e upload. A lógica verifica integridade, mas não é barata em fan-out.

A URL assinada dura cinco minutos; a resposta 307 não declara política explícita
de cache no código observado. Hit rate e reutilização devem ser medidos, não
presumidos.

### Segurança e privacidade

R2 continua privado, a chave física não é publicada, e estados não prontos são
bloqueados. Isso é uma boa base.

Mas `noindex` não é autenticação. A rota é pública por código e o código aparece
no arquivo. Usar essa rota em uma página privada não torna o PNG privado: quem
possui o código pode consultar o resumo/preview segundo o contrato público.

Não adicionar analytics de impressão sem necessidade; isso criaria correlação de
visualização de uma credencial com PII. Não expor e-mail, ID interno, CNPJ ou
motivo de revogação em `alt`, URL ou metadados.

### Fallback por estado

- `ready`: miniatura lazy; erro => moldura de mesma proporção, “Prévia
  indisponível” e “Abrir certificado”;
- `pending`: bloco neutro ou skeleton curto, “Certificado em preparação”, sem
  tentar preview;
- `failed`: bloco de erro e suporte, sem imagem quebrada;
- `revoked`: estado de revogação, sem miniatura e sem download;
- vazio: estado textual atual e uma única ação para voltar aos Cursos.

A moldura deve preservar altura para evitar layout shift. O estado textual deve
continuar sendo a fonte de verdade.

## Guardrails para implementação futura

1. Renderizar título, status e ação no HTML inicial; imagem é conteúdo secundário.
2. Usar lazy loading próximo da viewport ou ação “Ver prévia”; não usar
   `priority` para todos os cards.
3. Preservar proporção A4; não cortar o QR nem transformar o PNG em capa de Curso.
4. Garantir `alt`, teclado, foco e equivalentes textuais para ações/status.
5. Manter o mesmo slot/fallback para todos os estados, variando copy e ações.
6. Medir bytes reais, latência, hits de digest, chamadas e listas de 1, 5 e 20
   itens em 3G/4G.
7. Considerar rota autenticada específica do arquivo se “privado” for requisito
   de autorização, e separar esse tráfego do rate limit público.
8. Não recalcular PNG durante render do card; preservar `preview_sha256` e
   comportamento fail-closed do preview.
9. Documentar explicitamente que o link público e o PNG expõem o conteúdo
   impresso a quem possui o código.
10. Não adicionar métricas, ranking, streak, medalhas ou integrações sociais
    como condição para a sensação de conquista.

## Limitações

- Investigação somente leitura; sem alteração de código, teste em navegador,
  profiling, medição de PNG em R2 ou entrevista com Alunos.
- O worktree já tinha alterações e relatórios não commitados; foram preservados.
- Não foi possível medir tamanho dos PNGs, latência do R2, hit rate do digest ou
  volume típico de certificados por conta.
- Endpoint autenticado é recomendação futura, não propriedade implementada.
- Fontes externas descrevem produtos próprios e servem como comparação, não
  prova causal de uma decisão visual.
- Open Badges/W3C VC delimitam o que o PNG não significa; não há proposta de
  conformidade nesta pesquisa.

## Fontes oficiais consultadas

- [Thinkific Certificates](https://support.thinkific.com/hc/en-us/articles/360040594393-Thinkific-Certificates)
- [LinkedIn Learning: Share Certificates FAQ](https://www.linkedin.com/help/learning/answer/a706118)
- [LinkedIn Learning: View/download Certificates](https://www.linkedin.com/help/learning/answer/a700836/view-and-download-learning-certificates-of-completion?lang=en)
- [Credly: What is a badge?](https://support.credly.com/hc/en-us/articles/360021222071-What-is-a-badge)
- [Credly: Privacy](https://support.credly.com/hc/en-us/articles/360021220971-How-do-I-manage-my-privacy)
- [Udemy: Download certificate](https://support.udemy.com/hc/en-us/articles/229603868-How-to-download-your-certificate-of-completion-on-a-browser)
- [1EdTech: Open Badges](https://www.1edtech.org/standards/open-badges)
- [W3C: VC Data Model 2.0](https://www.w3.org/TR/vc-data-model/)
- [W3C: VC Data Integrity 1.1](https://www.w3.org/TR/vc-data-integrity-1.1/)
- [Carbon: Empty states](https://carbondesignsystem.com/patterns/empty-states-pattern/)
- [Carbon: Loading](https://preview.carbondesignsystem.com/building-blocks/core/patterns/loading)
- [Material: Cards](https://m1.material.io/components/cards.html)
- [GOV.UK: Summary list](https://design-system.service.gov.uk/components/summary-list/)

## Evidência interna

- `src/app/(student)/app/certificados/page.tsx`
- `src/app/(student)/app/certificados/certificate-card.tsx`
- `src/app/(student)/app/certificados/certificate-list-view-model.ts`
- `src/app/certificados/[code]/page.tsx`
- `src/app/certificados/[code]/preview/route.ts`
- `src/features/certificates/preview-server.ts`
- `src/features/certificates/preview.ts`
- `src/features/certificates/public-rate-limit.ts`
- `src/features/storage/r2.ts`
- `docs/domain/certificates-and-data-rights.md`
- `docs/adr/0006-certificate-lifecycle.md`
- `DESIGN.md`

