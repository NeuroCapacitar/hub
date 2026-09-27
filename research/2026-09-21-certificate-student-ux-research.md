# Pesquisa: próxima etapa do sprint de Certificados do Hub

> Escopo: investigação somente leitura da experiência do Aluno para Certificados.
> Data: 2026-09-21.
> Código observado no worktree `small-changes`; nenhum código foi alterado.

## Conclusão executiva

O próximo passo deve preservar três superfícies com funções diferentes:

1. **Entrada contextual:** o Curso é o lugar certo para comunicar que aquela
   conclusão foi registrada e conduzir ao Certificado daquela conclusão.
2. **Arquivo global:** `/app/certificados` deve continuar sendo a biblioteca
   autenticada de recuperação de todos os Certificados, não a página principal
   de celebração nem o destino de compartilhamento.
3. **Página pública:** `/certificados/[code]` é a página canônica para um
   terceiro verificar o estado atual e, quando pronto, abrir o documento e
   baixar o PDF.

O produto deve falar de uma conquista real e verificável, sem converter a
conclusão em pontos, ranking, streak, medalhas ou pressão social. A mensagem
principal é factual: o Curso foi concluído, o Certificado está em determinado
estado e há uma ação proporcional para consultar, compartilhar ou baixar.

## Evidências do Hub

### Arquivo global autenticado

`src/app/(student)/app/certificados/page.tsx` busca todos os registros do Aluno
com `getCertificatesForUser`, ordenados pelo servidor por `issued_at desc`, e
renderiza `CertificateCard` para cada um. O estado vazio aponta de volta para
`/app`. Isso é uma biblioteca de documentos, não uma escolha contextual de
próximo passo.

`src/app/(student)/app/certificados/certificate-card.tsx` já apresenta os
elementos que um arquivo precisa: Curso, titular, carga horária, data de
emissão, código, estado operacional, download quando pronto, suporte quando há
falha, atualização manual durante preparo e cópia do link público. A lista não
adiciona métricas agregadas ou elementos decorativos de gamificação; os testes
explicitam essa intenção.

### Entrada contextual no Curso

`CourseCertificatePanel` não é um arquivo separado: é uma função local em
`src/app/(student)/app/cursos/[courseId]/page.tsx`. Ela aparece somente quando
há `certificateEnabled` e `certificateCode`.

O Curso também coloca `Ver certificado` como ação primária quando existe um
Certificado. O painel diferencia quatro situações úteis:

- `ready`: “Seu certificado está pronto” e “Conquista concluída”, com link para
  a página pública;
- `pending`: “Certificado em preparação”, informando que a conclusão foi
  registrada e oferecendo atualização automática/manual;
- `failed`: informa que o Curso continua concluído e conduz ao Suporte;
- `revoked`: informa que o Certificado não é mais válido e mantém o link para
  consulta do status público.

Essa separação é conceitualmente correta: **conclusão do Curso** e
**disponibilidade do artefato PDF** não são o mesmo estado.

### Documento e status públicos

`src/app/certificados/[code]/page.tsx` é `force-dynamic`, aplica rate limit antes
da consulta, usa `noindex,nofollow` e expõe somente um resumo contextual:
Aluno, Curso, código, estado e documento quando `status = valid` e
`renderStatus = ready`. O PDF e o preview passam por rotas mediadoras; a chave
privada do R2 não é publicada.

`CertificatePublicStatus` comunica quatro estados de forma explícita:
válido, em preparação, indisponível e revogado. `CertificatePublicActions`
oferece somente Baixar PDF e Copiar link quando o documento está pronto.

O domínio canônico reforça a mesma fronteira: o Certificado é um artefato
imutável com snapshots; a revogação preserva o histórico; a consulta pública
mostra o estado atual com o mínimo de contexto; `/app/certificados` é o arquivo
global e a página do Curso é a entrada contextual.

## Padrões oficiais comparados

### Thinkific: curso e conta são duas entradas, página pública é o compartilhamento

Thinkific documenta dois caminhos internos: o Aluno acessa o Certificado no
próprio Curso e também em `My Account > Certificates`. A página pública possui
URL própria e oferece `Copy Link` e `Download PDF`; terceiros conseguem ver a
situação atual, inclusive expiração. Isso valida a arquitetura híbrida do Hub:
entrada contextual para o momento da conclusão, arquivo global para reencontro
posterior e página pública para verificação.

Thinkific também distingue Certificados de Digital Badges. Na própria
documentação, Certificados são associados à prova de conclusão, enquanto
badges são apresentados como mecanismo para reconhecer comportamentos variados
e gamificar a experiência. Para o Hub, isso é argumento contra introduzir
badges apenas como decoração de uma conclusão.

**Decisão para o Hub:** manter a dupla Course + arquivo global; não duplicar o
documento completo dentro do arquivo nem transformar o arquivo em feed de
conquistas. Usar a página pública como unidade de compartilhamento.

### LinkedIn Learning: compartilhar é opcional e pode ser desligado

LinkedIn Learning permite criar um link de compartilhamento por Certificado,
desligá-lo depois e também baixar o PDF sem criar link. O link é acessível a
qualquer pessoa que o possua; a página pode incluir nome, headline e foto de
perfil conforme configurações de visibilidade. A documentação também chama os
Certificados de Completion de registro de progresso/formação e os diferencia de
certificações profissionais e exames de terceiros.

**Decisão para o Hub:** o link público deve ser uma ação explícita do Aluno,
com texto que diga que quem possuir o link verá o resumo público e o estado
atual. O MVP pode manter `Copiar link` e `Baixar PDF`, mas não deve insinuar que
um Certificado de conclusão é uma certificação profissional ou acreditação. Uma
futura preferência de visibilidade por Certificado só deve ser criada se o
produto precisar oferecer revogação do compartilhamento sem revogar a
credencial.

### Credly: a credencial é um registro verificável, com controle de visibilidade

Credly trata badge como representação digital de resultado de aprendizagem,
experiência ou competência, ligada a metadados de contexto e verificação. A
plataforma permite compartilhar para LinkedIn, Facebook, Twitter, e-mail e
embed; o clique retorna à página de detalhes. Ela também permite tornar o
perfil e badges individuais públicos ou privados.

**Decisão para o Hub:** copiar o princípio de voltar sempre à página do emissor
para verificar, já presente em `/certificados/[code]`, mas não copiar a
superfície de portfólio, os embeds ou as integrações sociais nesta etapa. O
Certificado do Hub é um documento de conclusão de Curso com código e status,
não ainda uma credencial interoperável de competência.

### Udemy: o PDF é um comprovante compartilhável, mas não uma acreditação

Udemy oferece Certificado de conclusão após completar os itens exigidos,
permite baixar PDF/JPG e compartilhar por URL ou redes sociais. A documentação
é explícita de que o Certificado demonstra habilidades e conquistas, mas não é
acreditação formal; também diferencia compartilhar o Certificado de adicioná-lo
a perfis online.

**Decisão para o Hub:** usar linguagem de “conclusão”, “documento” e
“verificação”. A ação de compartilhar deve levar ao link canônico, enquanto o
download deve entregar o PDF imutável. Não prometer equivalência acadêmica,
licença profissional, certificação de software ou validação de competência que
o fluxo atual não mede.

### Open Badges 3.0 e W3C VC: interoperabilidade futura, não requisito de UI agora

1EdTech define Open Badges como um pacote de uma conquista individual com
metadados ricos: quem recebeu, quem emitiu, critérios, possível evidência,
alinhamentos e prova de verificação. Open Badges 3.0 é compatível com o modelo
de Verifiable Credentials e pode ser compartilhado como arquivo/imagem e
importado em carteiras.

O W3C define a separação entre emissor, titular e verificador e alerta que os
dados do titular em uma credencial podem causar exposição, rastreamento e
correlação quando compartilhados. A recomendação de privacidade é minimizar o
que se revela e, quando fizer sentido, suportar divulgação seletiva.

**Decisão para o Hub:** não chamar o Certificado atual de Open Badge ou
Verifiable Credential. Se uma etapa futura exigir portabilidade para carteira,
metadados de competências ou verificação por máquinas, deve ser um projeto de
modelo de dados e emissão assinado, com critérios/evidência e revisão de
privacidade; não uma simples troca do rótulo ou inclusão de um ícone de badge.

## Sugestões para a próxima etapa, com decisão

### 1. Preservar a arquitetura contextual + global + pública

**Sugestão:** tratar o `CourseCertificatePanel` como o momento da conquista;
manter `/app/certificados` como arquivo; manter `/certificados/[code]` como
destino de compartilhamento e verificação.

**Decisão:** **adotar sem mudança estrutural.** O código e a documentação de
domínio já implementam essa separação e os padrões Thinkific/LinkedIn Learning
confirmam que acesso contextual e biblioteca global cumprem necessidades
distintas.

**Critério de UX:** depois da conclusão, o Aluno deve encontrar “Curso
concluído” e “Ver certificado” no Curso sem precisar navegar primeiro ao
arquivo. Em outro dia, deve conseguir reencontrar o mesmo registro no arquivo.

### 2. Tornar explícita a separação entre conquista, estado e documento

**Sugestão:** conservar duas linhas semânticas: “Você concluiu o Curso” e
“Seu PDF está pronto/em preparação/indisponível”. Na página pública, priorizar
“Certificado válido” ou “Certificado revogado” como estado de confiança e
mostrar o documento somente quando pronto.

**Decisão:** **adotar e revisar apenas a microcopy se testes de conteúdo
mostrarem ambiguidade.** A implementação atual já evita prometer PDF durante
`pending`, não transforma falha operacional em falha de conclusão e impede
download quando revogado.

**Não fazer:** usar “quase certificado”, percentual de renderização ou um
estado visual de celebração que pareça confirmar validade antes de o documento
estar pronto.

### 3. Manter compartilhamento simples, verificável e intencional

**Sugestão:** manter `Copiar link` + `Baixar PDF`; compartilhar primeiro o link
canônico, que expõe o status atual, e deixar o PDF como cópia documental.

**Decisão:** **adotar para o MVP; não adicionar integrações sociais agora.**
Thinkific, LinkedIn Learning, Credly e Udemy comprovam o valor do link/PDF; as
integrações sociais são extensões de distribuição, não requisito para provar a
conclusão.

**Ajuste de copy recomendado:** perto de `Copiar link`, explicar que o link é
público para quem o possuir e serve para verificar o status. O CTA não deve ser
“Publicar conquista” nem sugerir obrigação de postar.

### 4. Tratar o link público como compartilhamento de dados, não como segredo

**Sugestão:** manter o resumo público mínimo e informar claramente a
visibilidade. Considerar no futuro uma preferência “link público ativo” por
Certificado, separada de revogação.

**Decisão:** **não criar controle de privacidade por Certificado nesta etapa;
registrar como limite explícito.** O Hub já reduz exposição com `noindex`, rate
limit, código não enumerável, ausência de detalhes internos e rotas privadas
para R2. Isso é mitigação, não autenticação: qualquer pessoa com o código/link
pode consultar o resumo público e o estado.

**Limite atual:** o nome do Aluno aparece na página pública e no documento. O
produto não oferece divulgação seletiva, pseudônimo, esconder apenas o nome ou
desligar um link já compartilhado sem revogar o Certificado.

### 5. Comunicar conquista sem gamificação

**Sugestão:** celebrar por reconhecimento direto e utilidade: confirmação da
conclusão, nome do Curso, data/estado, documento e escolha de compartilhar.

**Decisão:** **adotar.** Não incluir pontos, níveis, streaks, ranking, contagem
de Certificados, medalhas, “colecione todos”, urgência ou comparação entre
Alunos. A conquista é uma evidência histórica e uma ferramenta de continuidade
profissional, não um loop de recompensa.

**Copy preferida:** “Curso concluído”, “Conquista concluída”, “Certificado
pronto”, “Consultar página pública”, “Baixar PDF”, “Copiar link”. Evitar
“vença”, “suba de nível”, “não perca sua sequência” e “certificação” quando o
fluxo só comprova conclusão.

### 6. Adiar Open Badges/VC até existir uma necessidade de interoperabilidade

**Sugestão:** criar Open Badge/VC somente se houver requisito de carteira,
portabilidade, critérios de competência, evidências, alinhamento curricular ou
verificação externa automatizada.

**Decisão:** **não incluir no próximo incremento de UX.** O Certificado atual
já tem código público, snapshot, PDF imutável e status verificável; isso resolve
o caso de conclusão documentada. Adoção de Open Badges exigiria contrato de
dados, assinatura, endpoints, status/revogação interoperável, governança do
emissor e tratamento de PII.

## Limitações e riscos

- A investigação foi somente leitura; não houve alteração de código, teste de
  interface em navegador ou entrevista com Alunos.
- `CourseCertificatePanel` é função local em `page.tsx`, não um componente em
  arquivo próprio; qualquer evolução deverá respeitar essa realidade ou criar
  uma extração deliberada, sem inferir que ela já é um módulo independente.
- O arquivo global e o painel contextual não expõem uma preferência de
  visibilidade por Certificado. A recomendação de manter o link público assume
  que o objetivo atual é verificação simples por URL.
- `noindex,nofollow` reduz descoberta por buscadores, mas não torna o link
  privado; cópias do PDF e links já compartilhados não podem ser recolhidos.
- O modelo atual registra conclusão, estado, snapshots, código e PDF; não há
  evidência de avaliação de competência, rubrica, habilidades alinhadas ou
  divulgação seletiva suficientes para afirmar um Open Badge/VC.
- Documentação de terceiros muda com o tempo e seus fluxos refletem produtos e
  contratos diferentes. Eles servem como padrões comparativos, não como prova
  de que uma opção é melhor para os Alunos do Hub.
- A documentação do LinkedIn Learning mistura Certificados de Completion e
  Professional Certificates em páginas relacionadas; a decisão acima usa a
  distinção explícita entre conclusão de conteúdo e certificação/avaliação de
  terceiros, não uma equivalência entre os produtos.

## Fontes oficiais

### Evidência interna

- `src/app/(student)/app/certificados/page.tsx`
- `src/app/(student)/app/certificados/certificate-card.tsx`
- `src/app/(student)/app/cursos/[courseId]/page.tsx`, incluindo
  `CourseCertificatePanel`
- `src/app/certificados/[code]/page.tsx`
- `src/app/certificados/[code]/certificate-public-actions.tsx`
- `src/app/certificados/[code]/certificate-public-status.tsx`
- `docs/domain/certificates-and-data-rights.md`
- `docs/adr/0006-certificate-lifecycle.md`

### Documentação externa

- Thinkific, [Sharing Thinkific Certificates](https://support.thinkific.com/hc/en-us/articles/360049252673-Sharing-Thinkific-Certificates)
- Thinkific, [How can a student access their certificate?](https://support.thinkific.com/hc/en-us/articles/360052406593-How-can-a-student-access-their-certificate)
- Thinkific, [Thinkific Certificates](https://support.thinkific.com/hc/en-us/articles/360040594393-Thinkific-Certificates)
- LinkedIn Learning, [Share Certificates of Completion FAQ](https://www.linkedin.com/help/learning/answer/a706118)
- LinkedIn Learning, [Learning Overview: Certificates of Completion in Learning](https://www.linkedin.com/help/learning/answer/a705867/learning-certificates-of-completion-overview?lang=en)
- Credly, [How do I manage my privacy?](https://support.credly.com/hc/en-us/articles/360021220971-How-do-I-manage-my-privacy)
- Credly, [What is a badge?](https://support.credly.com/hc/en-us/articles/360021222071-What-is-a-badge)
- Udemy, [Certificates of completion](https://support.udemy.com/hc/en-us/sections/360011037194-Certificates-of-)
- 1EdTech, [Open Badges](https://www.1edtech.org/standards/open-badges)
- 1EdTech, [Open Badges Specification Conformance and Certification Guide](https://standards.1edtech.org/open-badges/specifications/standards/v3p0/cert)
- W3C, [Verifiable Credentials Data Model v2.0](https://www.w3.org/TR/vc-data-model-2.0/)

