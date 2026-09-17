---
status: research
owner: product-and-engineering
research_date: 2026-09-17
repository_branch: codex/ajustes-staging
repository_commit: 146909c3f72173ff5b73f11c0229ee8be5e4c194
---

# Pesquisa: autorização granular para o painel Admin/Suporte

## Escopo e método

Esta pesquisa avalia práticas atuais para autorização granular em painéis
administrativos e suas implicações para o Hub. O foco foi:

- deny-by-default e least privilege;
- separação entre acesso à superfície, leitura de dados e ações;
- filtragem server-side por permissão;
- autorização por seção e por função;
- auditoria de decisões e alterações de privilégios;
- migração de capacidades implícitas para grants explícitos;
- riscos de esconder apenas a interface.

As fontes foram consultadas em 17 de setembro de 2026. Foram usados somente
documentos primários ou mantidos diretamente pela organização responsável:
OWASP, NIST, AWS, Microsoft e Google Research. Não foram usados fóruns,
artigos de opinião ou comparativos comerciais como evidência normativa.

O estado do código foi lido no worktree `codex/ajustes-staging`, no commit
`146909c3f72173ff5b73f11c0229ee8be5e4c194`. O worktree já contém alterações
anteriores de autorização não pertencentes a esta pesquisa; este arquivo é a
única alteração produzida nesta tarefa.

## Conclusão executiva

O refinamento aprovado para o Hub é tecnicamente coerente e mais simples que
transformar cada rota em uma permissão. A separação recomendada é:

1. **Superfície:** a casca administrativa e suas seções de navegação.
2. **Capacidade de leitura:** quais dados uma requisição pode consultar.
3. **Ação:** qual mutação, operação ou exportação a Conta pode executar.

O painel deve ser uma superfície comum para Admin e Suporte, sem checkbox
próprio. Um Suporte sem grants configuráveis deve conseguir entrar em um
painel seguro, mas o servidor deve montar uma projeção vazia ou somente com os
blocos padrão. A ausência de um grant nunca pode significar que o servidor
consulta todos os dados e confia no navegador para ocultá-los.

O modelo final recomendado para este produto é um RBAC simples com capacidades
por seção e grants por usuário para ações de maior impacto. Não há evidência de
que o Hub precise de ABAC completo, Zanzibar, um PDP externo ou uma tabela
normalizada de ACLs neste momento. A matriz deve continuar centralizada,
allowlisted e testável.

## Evidências das fontes primárias

### 1. Deny-by-default é a regra de segurança; defaults de produto precisam ser explícitos

A [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
recomenda negar por padrão, validar a permissão em toda requisição, aplicar
least privilege e revisar periodicamente o privilege creep. A orientação não é
que toda tela precise de um checkbox: é que cada recurso e operação tenha uma
decisão de autorização justificável, sem depender de uma regra genérica que
acabe concedendo acesso a funcionalidades novas.

O modelo de políticas da [AWS IAM](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic_policy-eval-denyallow.html)
é uma referência operacional útil: solicitações são implicitamente negadas até
que exista uma permissão aplicável, e uma negação explícita prevalece sobre uma
concessão. O Hub não deve copiar a complexidade ou a semântica inteira do IAM,
mas a distinção ajuda a evitar o erro de tratar a ausência de um checkbox como
uma autorização global.

O [NIST SP 800-53 Rev. 5](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final)
organiza esse raciocínio em controles como AC-3 (Access Enforcement), AC-5
(Separation of Duties), AC-6 (Least Privilege) e AU-2/AU-3/AU-6/AU-12 para
eventos, conteúdo, revisão e geração de auditoria. A lista de controles do
[NIST RMF](https://csrc.nist.gov/projects/risk-management/about-rmf/assess-step/assessment-cases-download-page)
confirma essas fronteiras como responsabilidades distintas.

**Implicação para o Hub:** “leitura padrão para Admin e Suporte” é uma decisão
de produto válida, mas precisa ser representada por uma política explícita e
centralizada, como `supportDefaultCapabilities`. Não deve ser implementada por
um bypass genérico do tipo `role === "support"`, nem pela ausência de uma
checagem em uma action. Toda nova rota ou ação começa negada até ser classificada
como leitura padrão, grant configurável ou Admin-only.

### 2. Superfície, função e ação são dimensões diferentes

A [documentação de autorização da Microsoft](https://learn.microsoft.com/en-us/entra/identity-platform/authorization-basics)
separa autorização de autenticação e descreve RBAC aplicado à aplicação inteira,
a áreas, funcionalidades e métodos de API. Também descreve o uso de papéis
compostos por permissões granulares.

O [OWASP ASVS 5.0, capítulo V8](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x17-V8-Authorization.md)
exige documentar e restringir acesso em níveis de função, dados e campos. O
mesmo capítulo trata explicitamente de permissões de leitura e escrita em campos
e de autorização de operação em uma camada confiável.

Isso sustenta a seguinte distinção no Hub:

- **Acesso à superfície:** permite renderizar o shell, a rota ou a seção.
- **Leitura:** permite obter uma projeção de dados daquela seção.
- **Ação:** permite uma operação específica, como reembolso, publicação,
  alteração de disponibilidade ou reemissão.

Uma rota não deve ser o único item de permissão quando contém operações com
risco diferente. A UI pode agrupar as ações por rota para facilitar o uso, mas
os identificadores de segurança devem representar a ação real. “Financeiro” é
um agrupador; `viewFinancials`, `refund`, `operateFinancialOperations` e
`resolveFinancialReviews` são capacidades distintas.

O [NIST SP 800-162](https://csrc.nist.gov/pubs/sp/800/162/upd2/final) define
ABAC como uma decisão baseada em atributos do sujeito, objeto, operação e
contexto. Essa definição é útil para reconhecer que a operação importa, mas
não obriga o Hub a adotar ABAC: para o escopo atual, role + allowlist de
capacidades por usuário cobre o requisito sem introduzir política dinâmica,
condições de contexto ou um motor externo.

### 3. Esconder UI não protege dados nem operações

O [OWASP Cornucopia FRE8](https://cornucopia.owasp.org/cards/FRE8) é direto:
decisões de autorização devem estar no servidor; rotas e elementos ocultos no
cliente são apenas apresentação; a API deve devolver somente os dados que o
consumidor pode ver.

O [OWASP API Security Top 10 2023](https://api-security.owasp.org/editions/2023/en/0x11-t10/)
classifica como riscos separados:

- BOLA, quando a autorização do objeto não é verificada em toda função que
  acessa uma fonte de dados;
- BOPLA, quando propriedades são expostas ou alteradas sem autorização no
  nível do campo;
- Broken Function Level Authorization, quando uma função administrativa pode
  ser alcançada por um usuário com papel ou hierarquia inadequados.

O [OWASP Web Security Testing Guide](https://wstg.owasp.org/latest/4-Web_Application_Security_Testing/12-API_Testing/03-Excessive_Data_Exposure/)
explica o risco de serializar o objeto inteiro e depender de filtragem no
cliente. Uma pessoa pode inspecionar a resposta HTTP mesmo que o React não
renderize um card.

**Implicação para o Hub:** o dashboard deve montar projeções por domínio. Se o
Suporte não possui `viewFinancials`, a consulta financeira não deve ser
executada e a resposta não deve conter contagens financeiras como zero,
`null` ou campos escondidos. O mesmo vale para a consulta da Auditoria:
`viewAudit` permite a superfície, mas o resultado deve ser filtrado pelos
domínios que a Conta pode consultar. Uma Server Action deve repetir sua própria
checagem; a condição que esconde o botão é somente uma melhoria de UX.

### 4. Autorização por seção é preferível a uma permissão de rota ampla

O [OWASP Authorization Testing Automation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Testing_Automation_Cheat_Sheet.html)
recomenda formalizar uma matriz de autorização, com pelo menos a combinação de
função e feature e, quando necessário, uma terceira dimensão de dados. A
matriz deve ser legível por pessoas, processável por testes e independente da
tecnologia de apresentação.

O [OWASP ASVS V8.2](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x17-V8-Authorization.md)
reforça função, dado e campo como unidades verificáveis. Isso favorece o
seguinte desenho para o Hub:

- o **Painel** é shell global, sem permissão configurável;
- **Cursos, Alunos, Aprendizagem e Operação** têm leituras padrão para Admin e
  Suporte; escritas relevantes são grants separados;
- **Financeiro** mantém leitura protegida e ações separadas;
- **Auditoria** mantém leitura protegida e filtra seus eventos por domínio;
- **Configurações** mantém FAQ, banners e mídias da tela de acesso liberados e
  auditados, mas exige grant para alterar perfil e assinatura de Certificados;
- **Equipe** permanece Admin-only.

Essa estrutura evita duas distorções opostas: um Suporte que precisa de uma
permissão ampla para simplesmente abrir uma rota e um modal com dezenas de
checkboxes para capacidades sem risco real.

### 5. Auditoria não substitui autorização

O NIST separa enforcement de acesso (AC) de auditabilidade (AU). O registro de
uma alteração depois que ela aconteceu não torna a alteração autorizada. A
[OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
também alerta que falhas de logging tornam violações não detectáveis ou não
atribuíveis.

O [OWASP Cornucopia AZK](https://cornucopia.owasp.org/edition/webapp/AZK/2.2/en)
recomenda proteger rigorosamente os mecanismos que alteram autorizações,
monitorar mudanças não autorizadas e revisar periodicamente se os privilégios
continuam adequados.

Para o Hub, uma alteração sensível deve registrar, no mínimo:

- ator autenticado e papel no momento da decisão;
- conta alvo, quando houver;
- capacidade ou conjunto de capacidades alterado;
- estado anterior e posterior, sem senha, token ou segredo;
- operação, recurso alvo, resultado e motivo informado;
- horário e identificador de correlação quando disponível.

As próprias permissões de Equipe devem ser auditadas. A visualização da
Auditoria deve ser uma capacidade protegida; para Suporte, o SQL precisa
excluir eventos de domínios que ele não pode consultar. A existência de um
evento financeiro não deve ser uma forma indireta de descobrir informação
financeira para quem não possui acesso ao Financeiro.

### 6. Migração de permissões implícitas para grants explícitos

Não existe uma receita única de migração aplicável a todos os produtos. A
recomendação abaixo é uma inferência operacional baseada em deny-by-default,
least privilege, revisão de privilégios e na decisão de produto já tomada para
este projeto.

O caminho seguro é:

1. Inventariar cada página, Server Action, Route Handler, consulta e projeção,
   identificando leitura, escrita, exportação e efeitos colaterais.
2. Classificar cada capacidade como leitura padrão, ação delegável,
   leitura protegida ou Admin-only.
3. Criar uma matriz versionada antes de retirar a regra implícita. A matriz deve
   ser a fonte dos testes de autorização.
4. Fazer a política nova aceitar somente chaves allowlisted e rejeitar grants
   desconhecidos tanto no TypeScript quanto no banco.
5. Migrar as Contas de Suporte existentes para **zero permissões
   configuráveis**, conforme a decisão aprovada. Não converter silenciosamente
   um acesso amplo antigo em vários grants novos; exigir revisão e concessão
   manual por Admin.
6. Registrar a transição e manter uma forma administrativa segura de regrantar
   o acesso necessário. A ordem de rollout precisa evitar que a tela de Equipe
   fique inacessível ou que uma regra antiga continue concedendo acesso por um
   caminho alternativo.
7. Remover ou neutralizar a interpretação das permissões legadas depois que
   todos os caminhos server-side usam a matriz nova. Manter o nome antigo no
   banco sem retirar seu efeito cria uma falsa sensação de migração concluída.
8. Fazer uma revisão posterior de privilege creep: contas, grants, ações novas,
   rotas adicionadas e divergências entre a documentação e o código.

O ponto mais importante é a ordem: uma migration que zera grants antes de todos
os endpoints consultarem a nova política pode bloquear operações legítimas; uma
migration que preserva o grant antigo enquanto a UI mostra a matriz nova pode
conceder mais acesso do que o Admin percebe. O rollout precisa ter um snapshot
de leitura, uma matriz de equivalência e testes de negação antes da aplicação.

## Aplicação ao estado atual do Hub

### Fundamentos que devem ser preservados

O worktree já possui bons fundamentos para uma evolução incremental:

- papel global separado entre `admin`, `support` e `student`;
- função central `canPerform` e fronteiras server-side com
  `requirePermission`;
- allowlists de valores persistidos no perfil e no schema;
- grants por Conta, em vez de confiar em cookie ou payload do cliente;
- área de Equipe restrita a Admin;
- auditoria de alterações sensíveis e revogação de sessão quando o papel muda.

Isso é compatível com RBAC por capacidades. Não há necessidade de introduzir
ABAC ou um provedor externo apenas para resolver o refinamento solicitado.

### Divergências atuais que a próxima implementação precisa resolver

O modelo presente ainda é intermediário e não coincide com as decisões finais:

1. `viewAdminPanel` aparece como view configurável e `canPerform` exige todas
   as views de rota para concedê-la. Isso contradiz o painel global: Admin e
   Suporte devem poder abrir o shell, mesmo quando o Suporte não tem nenhuma
   permissão configurável.
2. `DELEGABLE_SUPPORT_VIEWS` trata Cursos, Alunos, Operação, Configurações e
   Aprendizagem como views concedidas individualmente. Pela decisão final,
   essas leituras são padrão para Admin e Suporte; somente Financeiro e
   Auditoria permanecem como leituras protegidas.
3. `getAdminOverview` e `getAdminDashboardProjection` exigem Financeiro e
   Auditoria e carregam projeções amplas antes de renderizar o painel. Isso
   impede o comportamento aprovado de ocultar cards e não consultar dados
   financeiros sem autorização.
4. `readAuditLogs` usa um escopo de Suporte que remove Equipe, Configurações e
   autenticação, mas esse filtro não é equivalente a “somente os domínios que
   a Conta pode consultar”. Ele precisa derivar o conjunto permitido da
   política do sujeito, incluindo a exclusão de eventos Financeiros quando
   `viewFinancials` estiver ausente.
5. `manageCourses` ainda concentra várias alterações de Curso. A decisão final
   pede ações separadas para criação/exclusão, dados gerais, conteúdo,
   matrículas, disponibilidade/vendas e Certificado.
6. FAQ, banners e mídias da tela de acesso devem continuar no conjunto padrão
   de leitura e escrita auditada. Não devem reaparecer como grants artificiais
   apenas porque o sistema passou a ter uma matriz granular.
7. Alterar perfil e assinatura de Certificados deve permanecer como grant
   explícito. A leitura da configuração continua padrão.
8. `exportLearningAnalytics`, se permanecer disponível, deve ser tratado como
   exportação de dados e não como uma simples leitura de tela. A decisão de
   Aprendizagem removeu a necessidade de controlar a leitura, mas não torna uma
   exportação automaticamente inofensiva. É preciso decidir entre remover a
   exportação para Suporte ou mantê-la como ação explícita.
9. Operações de bloqueio amplo de plataforma e alterações de acesso de maior
   impacto não devem ser colocadas em um grant genérico de Alunos sem confirmar
   a fronteira de risco. Até essa decisão, a política mais segura é mantê-las
   Admin-only ou em uma ação própria.

### Matriz recomendada, em nível de produto

| Área | Admin | Suporte sem grants configuráveis | Grants configuráveis recomendados |
| --- | --- | --- | --- |
| Painel | Shell e todas as projeções autorizadas | Shell seguro, somente blocos padrão | Nenhum grant de painel |
| Aprendizagem | Leitura | Leitura padrão | Nenhuma ação prevista; exportação exige decisão própria |
| Cursos | Leitura e todas as ações | Leitura | Criar/excluir; alterar dados; alterar conteúdo; gerenciar alunos/matrículas; alterar disponibilidade/vendas; alterar Certificado |
| Alunos | Leitura e ações | Leitura | Alterar matrícula/acesso; reemitir Certificado; outras ações de alto impacto somente após decisão explícita |
| Operação | Leitura e operação | Leitura | Operar Operação, como ação única |
| Financeiro | Leitura e ações | Sem leitura | Ver Financeiro; realizar reembolso; operar Financeiro; resolver revisões |
| Auditoria | Leitura global | Sem leitura | Ver Auditoria, sempre filtrada pelos domínios consultáveis |
| Configurações | Todas as ações | FAQ, banners e mídias de acesso liberados e auditados; leitura de Certificados | Alterar perfil e assinatura de Certificados |
| Equipe | Gerenciar | Sem acesso | Nenhum grant delegável |

“Sem grants” não significa “sem política”. Significa que a Conta recebe apenas
as capacidades padrão deliberadamente definidas, não Financeiro, Auditoria ou
ações delegáveis. A matriz também deve deixar claro que leitura padrão não
autoriza automaticamente ações de mutação.

## Regras de implementação que a pesquisa recomenda

### Política central

Manter uma única fonte de verdade para:

- catálogo de capacidades;
- domínio e seção de cada capacidade;
- se a capacidade é padrão, protegida, delegável ou Admin-only;
- dependência entre ação e leitura;
- domínio de auditoria que pode ser visto.

O modal deve consumir esse catálogo, mas nunca ser a fonte de segurança. A
função de autorização deve receber o sujeito resolvido no servidor e uma chave
de capacidade. Não deve aceitar `role`, `userId`, grants ou “canEdit” enviados
pelo cliente como prova.

### Projeções server-side

O dashboard deve ser dividido em leitores independentes, por exemplo:

- projeção padrão de alunos, cursos, certificados e operação;
- projeção financeira, somente quando `viewFinancials` for verdadeira;
- atividade/auditoria, somente quando `viewAudit` for verdadeira e com filtro
  de domínio.

O contrato da resposta deve omitir blocos não autorizados, em vez de enviá-los
com zero. O mesmo padrão deve ser aplicado a rotas, dialogs, exportações,
imagens protegidas, campos sensíveis e links de navegação.

### Relação leitura/escrita

Toda ação delegável deve declarar a leitura necessária. O servidor deve rejeitar
uma ação quando o grant de escrita existir sem a leitura correspondente. A UI
deve refletir a mesma relação, mas o teste decisivo é server-side.

Para conteúdo de baixo risco que o produto decidiu deixar liberado, a leitura e
a escrita padrão devem continuar passando por uma capacidade nomeada ou por
um helper de “default capabilities”, além da auditoria. Isso evita que uma
nova action seja incluída acidentalmente no conjunto liberado.

### Auditoria filtrada

O filtro da Auditoria deve acontecer dentro da consulta/projeção, não depois
que todos os eventos chegaram ao React. O conjunto de fontes e tipos de alvo
permitidos deve ser derivado do sujeito. A ausência de Financeiro deve excluir
eventos financeiros, inclusive quando eles surgem em uma tabela de eventos
unificada ou como metadado de um Pedido.

### Testes orientados por matriz

O [OWASP Authorization Testing Automation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Testing_Automation_Cheat_Sheet.html)
é uma boa base para tornar a matriz executável. O conjunto mínimo de testes
deve provar:

- Admin mantém acesso total às capacidades administrativas previstas;
- Student nunca recebe capacidade administrativa;
- Suporte sem grants abre o shell, vê somente leituras padrão e não recebe
  Financeiro, Auditoria ou mutações delegáveis;
- cada grant de ação exige a view correspondente quando a área é protegida;
- ação direta por URL, Server Action ou Route Handler não contorna a UI;
- dashboard sem Financeiro não executa consulta nem devolve campos financeiros;
- Auditoria sem Financeiro não devolve eventos financeiros;
- FAQ, banners e mídias de acesso permanecem alteráveis e auditados, sem
  aparecer no modal como grants artificiais;
- migração é idempotente e coloca Suportes existentes sem grants
  configuráveis;
- alteração de permissões registra before/after, ator, alvo, motivo e
  resultado sem persistir segredo.

## Riscos e decisões ainda necessárias

1. **Exportação de Aprendizagem:** leitura padrão não deve ser confundida com
   exportação em massa. A exportação pode causar exfiltração maior que a tela e
   precisa de uma decisão de produto própria.
2. **Acesso de Alunos:** bloqueio global da plataforma, alteração de matrícula,
   validade e reemissão de Certificado têm impactos diferentes. Uma permissão
   única é simples, mas pode ser ampla demais; a decisão deve ser baseada no
   efeito real de cada action.
3. **Escrita padrão de conteúdo:** liberar FAQ, banners e mídias é uma escolha
   de confiança operacional. Auditoria fornece rastreabilidade, não impede
   erro ou abuso. A revisão periódica dos eventos e dos usuários continua
   necessária.
4. **Migração com perda intencional de acesso:** zerar os grants existentes é
   coerente com least privilege e com a decisão aprovada, mas exige que um
   Admin reconfigure as Contas antes de uma operação de suporte depender delas.
5. **Crescimento do catálogo:** se o número de ações crescer muito, o catálogo
   deve continuar agrupado por seção no modal, mas não deve voltar a uma
   permissão ampla por rota. Se surgirem escopo por Curso, expiração,
   aprovação em duas pessoas ou condições por contexto, isso será um novo
   problema de domínio e poderá justificar uma tabela de grants própria.

## Fontes primárias consultadas

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [OWASP Authorization Testing Automation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Testing_Automation_Cheat_Sheet.html)
- [OWASP ASVS 5.0, V8 Authorization](https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x17-V8-Authorization.md)
- [OWASP API Security Top 10 2023](https://api-security.owasp.org/editions/2023/en/0x11-t10/)
- [OWASP Web Security Testing Guide: Excessive Data Exposure](https://wstg.owasp.org/latest/4-Web_Application_Security_Testing/12-API_Testing/03-Excessive_Data_Exposure/)
- [OWASP Cornucopia FRE8: Frontend authorization bypass](https://cornucopia.owasp.org/cards/FRE8)
- [OWASP Cornucopia AZK: Authorization controls](https://cornucopia.owasp.org/edition/webapp/AZK/2.2/en)
- [NIST SP 800-162: Guide to ABAC](https://csrc.nist.gov/pubs/sp/800/162/upd2/final)
- [NIST SP 800-53 Rev. 5](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final)
- [NIST RMF assessment cases and control families](https://csrc.nist.gov/projects/risk-management/about-rmf/assess-step/assessment-cases-download-page)
- [AWS IAM policy evaluation logic](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic_policy-eval-denyallow.html)
- [Microsoft authorization basics](https://learn.microsoft.com/en-us/entra/identity-platform/authorization-basics)
- [Google Research: Zanzibar](https://research.google/pubs/zanzibar-googles-consistent-global-authorization-system/)
