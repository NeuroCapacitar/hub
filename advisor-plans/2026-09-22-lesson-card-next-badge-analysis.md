# Análise: badge “Próxima” do LessonCard

> Status: implementado; badge “Próxima” agora usa a variante de progresso.

## Evidência no projeto

LessonCard é usado na trilha real do aluno, via
src/app/(student)/app/cursos/[courseId]/course-overview-client.tsx.
O status next é atribuído à primeira Aula disponível que o aluno deve seguir.
A badge atual usa variant="secondary", enquanto in_progress usa
variant="progress".

Isso torna “Próxima” visualmente neutra, embora ela responda à principal
pergunta da trilha: “qual Aula devo fazer agora?”. O componente já preserva
texto, contraste, tamanho compacto, hover contido e não interatividade própria.

## Pesquisa

- [Fluent Badge](https://fluent2.microsoft.design/components/web/react/core/badge/usage):
  badges comunicam status ou descrição, devem usar textos curtos e cor
  intencional para concentrar a atenção no que importa.
- [Atlassian Lozenge](https://atlassian.design/components/lozenge/code):
  labels compactos são adequados quando comunicam um atributo relevante para
  priorizar ou agir sobre um objeto.
- [Carbon Tag](https://carbondesignsystem.com/components/tag/usage/):
  tags read-only devem rotular estados/categorias sem adquirir comportamento
  interativo próprio; cores podem diferenciar categorias, mas não devem
  substituir o texto.
- [Moodle Activity Completion](https://docs.moodle.org/dev/Student_activity_completion):
  a experiência deve deixar visível quais atividades exigem atenção e o que o
  aluno precisa completar.
- [Canvas Observer Guide](https://community.canvaslms.com/html/assets/Canvas_Observer_Guide.pdf):
  a navegação de módulos explicita o próximo item por meio da ação “Next” e
  permite identificar o item seguinte.

## Recomendação

Implementar somente a troca da variante da badge next de secondary para
progress.

Motivos:

- usa o token de progresso já existente;
- cria uma hierarquia clara sem novo token ou variante;
- mantém a badge curta, estática e acessível;
- não confunde “Próxima” com alerta, erro ou bloqueio;
- mantém Em andamento e Próxima dentro da mesma família semântica de avanço;
- não exige ícone adicional em uma badge pequena.

Não implementar:

- nova variante de Badge;
- ícone dentro da badge;
- mudança de texto;
- alteração de hover, imagem, barra de progresso ou navegação;
- alteração dos estados bloqueado, concluído ou disponível.

## Resultado implementado

A badge “Próxima” passou de secondary para progress. Nenhum outro estado,
comportamento ou estilo do LessonCard foi alterado.

## Verificação

O teste confirma que status="next" renderiza data-variant="progress" e o texto
“Próxima”, preservando os testes dos demais estados.
