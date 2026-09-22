# Análise: refinamento do header da página de Curso

> Status: **pulada por decisão do produto**; nenhuma alteração de produto foi feita nesta análise.
> Baseline: `f115568a` (`feature/small-changes`).

## Etapa identificada

Esta é a próxima recomendação válida do relatório visual: **Fase 3 — Página de
Curso**, especialmente os itens 27–29 e a recomendação de refinamento
incremental do header. Checkout, estados de sistema, Configurações e FAQ já
foram tratados ou estão fora desta etapa.

## Evidência no código atual

- `src/app/(student)/app/cursos/[courseId]/page.tsx` concentra título,
  descrição, dois `CourseMetric` com borda, um bloco de progresso também com
  borda e uma ação de entrada no mesmo header.
- `src/app/(student)/app/cursos/[courseId]/course-overview-client.tsx` mostra
  logo abaixo uma seção `Continuar assistindo`, com a próxima Aula e a Aula
  seguinte. Portanto, a mesma intenção de reentrada aparece em dois lugares.
- `getStudentCourseOverview` já entrega `thumbnailUrl`, descrição, contagem de
  Aulas, carga horária e progresso. Não há necessidade de migration nem de
  novo contrato para introduzir uma capa compacta.
- O painel de Certificado já é o dono da ação `Ver certificado`; o header não
  deve ganhar uma segunda ação para o mesmo destino.

## Diagnóstico

### 1. O header mistura contexto e reentrada

O header deveria responder “que Curso é este e como estou nele?”. A próxima
Aula e o CTA de retomada respondem “o que faço agora?”. Hoje as duas perguntas
competem no mesmo topo e reaparecem em `Continuar assistindo`.

### 2. As métricas estão fragmentadas

`Aulas`, `Carga horária` e `Progresso` recebem contornos equivalentes. Isso faz
metadados auxiliares parecerem ações ou unidades independentes. A informação é
útil, mas uma linha sem caixas separadas cria uma hierarquia mais calma.

### 3. A página não usa a capa já disponível como contexto

O Curso já possui imagem e a Home do Aluno usa essa mídia. O header da página de
Curso é uma superfície de alta relevância para identidade, mas atualmente é
apenas tipografia, métricas e borda.

## Pesquisa externa

- O Open edX descreve a Course Home como um hub e separa um bloco de progresso
  e reentrada, com a próxima subseção inacabada e ações de retomar ou consultar
  o outline. Isso apoia uma única entrada de retomada, separada da estrutura
  curricular: [Open edX — New Course Home](https://docs.openedx.org/en/latest/community/release_notes/ulmo/ulmo_mobile_updates.html).
- O Moodle separa progresso, cursos em andamento e visão do conteúdo; também
  oferece diferentes formas de visualizar cursos sem transformar cada dado em
  um card independente: [Moodle — My courses](https://docs.moodle.org/502/en/Course_overview).
- O Fluent 2 recomenda proximidade para indicar relação, espaço para criar
  hierarquia e consistência de grid para facilitar decisões. A composição atual
  usa o mesmo peso visual para dados que têm papéis diferentes: [Fluent 2 — Layout](https://fluent2.microsoft.design/layout).
- A orientação de Cards do Material reforça que um card deve representar uma
  unidade independente de conteúdo, não ser o contêiner padrão de cada métrica:
  [Material — Cards](https://m2.material.io/develop/web/components/cards).

## Decisão original da análise

A análise considerou o refinamento válido, mas o produto decidiu **não
implementar esta sugestão**. O header atual deve permanecer como está nesta
rodada; esta recomendação não deve voltar para a fila sem uma nova decisão
explícita.

### Composição recomendada

```text
[ capa compacta ]  Título do Curso
                    Descrição
                    Aulas · Carga horária
                    Progresso  42%  ━━━━━━━

Continuar assistindo
[ próxima Aula ] [ Aula seguinte ]

Trilha do curso
Módulo 1 ...
```

- Usar a capa em uma moldura horizontal compacta; no mobile, ela fica acima do
  resumo. Sem capa, o bloco de mídia desaparece e não deixa espaço vazio.
- Transformar `Aulas` e `Carga horária` em metadados inline, mantendo o
  progresso como a única evidência visual de avanço.
- Remover a ação de iniciar/continuar do header. `Continuar assistindo` fica
  como o único dono da reentrada para a próxima Aula.
- Não repetir `Ver certificado` no header; o painel de Certificado continua
  sendo a única composição desse fluxo.
- Atualizar o skeleton para acompanhar a nova relação entre capa, resumo,
  metadados e progresso.

## Estados preservados

- Curso em andamento: a reentrada continua apontando para a próxima Aula.
- Curso concluído: progresso completo e ação de Certificado permanecem no
  painel próprio.
- Próximo Módulo bloqueado: a data continua no Módulo, sem cópia adicional no
  header.
- Preview administrativo: o aviso de preview continua separado do conteúdo.
- Mobile: título longo quebra naturalmente, capa reflowa e nenhum controle
  cria rolagem horizontal.

## Fora do escopo desta etapa

- Não criar migration ou rastreamento de último acesso.
- Não escolher silenciosamente um Curso entre vários no dashboard.
- Não alterar a estrutura dos Módulos ou os LessonCards.
- Não aplicar `surface-warm` globalmente ainda. A frequência cromática é uma
  etapa transversal posterior; misturá-la agora ao header dificultaria avaliar
  se a melhoria veio da hierarquia ou da cor.
- Não criar tabs sticky.

## Resultado da análise

Resultado final: **não implementar e seguir para a próxima sugestão do
relatório**. O conteúdo desta nota permanece como registro da decisão
rejeitada, não como plano ativo.
