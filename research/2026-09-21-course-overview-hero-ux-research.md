# Pesquisa: hero e reentrada na página de Curso

> Escopo: validar a segunda etapa do sprint: dar presença editorial à página
> de Curso sem repetir a trilha, o progresso ou os Certificados.
> Código analisado: `feature/small-changes` em `8ecf677b`.

## Estado atual do Hub

- O header atual em `src/app/(student)/app/cursos/[courseId]/page.tsx` apresenta
  título, descrição, quantidade de Aulas, carga horária, progresso e uma ação.
- O mesmo Curso aparece logo depois em uma seção `Continuar assistindo`, com a
  próxima Aula e a seguinte, e depois novamente na `Trilha do curso`.
- Quando existe `certificateCode`, o header mostra `Ver certificado` e o painel
  de Certificado também mostra uma ação para ver o mesmo certificado.
- `nextReleaseAt` já aparece na trilha do Módulo; o teste da página preserva a
  decisão de não repetir a liberação no header.
- A projeção do Curso já entrega a capa, Módulos, Aulas, duração, progresso,
  próxima Aula e estados de Certificado. Não é necessário adicionar migration
  para um hero editorial.

## Padrões externos

1. O Open edX descreve a Course Home como um hub e usa um bloco/carrossel de
   progresso e reentrada com progresso total, próxima subseção inacabada e uma
   ação de retomar ou consultar o outline. O padrão valida uma entrada clara,
   mas também separa essa entrada do conteúdo completo.
   - https://docs.openedx.org/en/latest/community/release_notes/ulmo/ulmo_mobile_updates.html
   - https://docs.openedx.org/en/ulmo/learners/SFD_start_course.html

2. O Moodle trata o progresso como uma visão de acompanhamento e mantém o
   conteúdo do Curso organizado em seções/atividades. Isso reforça que resumo,
   progresso e conteúdo devem ter relações claras, sem transformar cada métrica
   em um card independente.
   - https://docs.moodle.org/502/en/Course_overview
   - https://docs.moodle.org/500/en/Tracking_progress

3. O LinkedIn Learning mantém a visão de progresso e Cursos em andamento
   separada da navegação de conteúdo. A Aula atual e a duração ajudam a
   reentrada, mas o produto não precisa repetir o outline inteiro no resumo.
   - https://www.linkedin.com/help/learning/answer/a1346436

4. Fluent recomenda proximidade, espaço e escala para criar hierarquia; Atlassian
   recomenda usar tokens de espaço e agrupamento semântico, em vez de adicionar
   bordas a cada fragmento.
   - https://fluent2.microsoft.design/layout
   - https://atlassian.design/foundations/spacing

## Diagnóstico

O problema principal não é ausência de informação. É a coexistência de três
entradas concorrentes:

1. CTA e progresso no header;
2. `Continuar assistindo` com a mesma próxima Aula;
3. `Trilha do curso` com a mesma estrutura curricular.

Adicionar uma capa e mais conteúdo ao header sem reorganizar isso aumentaria a
repetição. O contrato visual do Hub também determina que uma seção responda a
uma pergunta nova e que duplicatas sejam combinadas.

## Decisão recomendada

Implementar um único **hero de reentrada do Curso**:

- capa existente do Curso como conteúdo visual, com fallback simples;
- título e descrição do Curso;
- metadados compactos em linha: Aulas e carga horária;
- progresso textual e barra de progresso;
- uma ação de entrada coerente com o estado: iniciar/continuar quando há
  próxima Aula;
- estado concluído sem CTA duplicado de Certificado no header;
- liberação futura continua sendo explicada no Módulo, onde a data tem contexto.

O bloco atual `Continuar assistindo` deve ser absorvido pelo hero ou removido
quando o hero passar a ser a entrada de recomeço. Manter ambos com o mesmo CTA
não é recomendado.

O painel de Certificado deve continuar sendo a única composição responsável por
mostrar estado e ação do Certificado. O header pode indicar conclusão por
progresso, mas não repetir `Ver certificado`.

## Estados que precisam ser preservados

- **Curso novo:** “Iniciar curso”, sem dizer “continuar”.
- **Curso em andamento:** “Continuar curso”, direcionando para a próxima Aula.
- **Próximo Módulo bloqueado:** não inventar CTA; manter a informação de
  liberação na trilha.
- **Curso concluído:** progresso completo e painel de Certificado como ação
  principal.
- **Preview de Admin:** manter o aviso de preview e não criar ação de aluno que
  altere estado.
- **Mobile:** imagem acima do conteúdo, título quebrável, metadados refluindo e
  ação utilizável sem rolagem horizontal.

## Limitações

Não há evidência renderizada nesta etapa; a avaliação combina código, contrato
visual e documentação externa. O hero deve ser validado com Cursos sem capa,
descrições longas, progresso zero, progresso parcial, conteúdo programado,
Certificado pronto e viewport estreito.
