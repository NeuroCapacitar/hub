# Pesquisa: refinamento incremental do header da página de Curso

> Escopo: polir o header existente sem substituir a composição da página.
> Código analisado: `feature/small-changes` em `8ecf677b`.

## Diagnóstico do estado atual

O header atual funciona, mas concentra quatro pesos visuais independentes no
mesmo eixo: dois `CourseMetric` com borda, um bloco de progresso também com
borda e um CTA. O título e a descrição ficam em uma região, enquanto os
controles ficam visualmente separados em outra.

Logo abaixo, `Continuar assistindo` apresenta a próxima Aula e links para ela.
Isso faz o CTA do header e a próxima Aula responderem à mesma pergunta em dois
lugares. Quando existe um Certificado, `Ver certificado` também aparece no
header e no painel de Certificado.

## Princípios externos aplicáveis

- Fluent recomenda proximidade para comunicar relação, espaço para hierarquia e
  alinhamento previsível para organizar uma composição. Isso favorece uma linha
  de metadados plana em vez de vários pequenos cards.
  - https://fluent2.microsoft.design/layout
- Atlassian recomenda uma escala de espaçamento e agrupamento semântico; cada
  espaçamento deve reforçar a relação entre os itens, não apenas aumentar o
  tamanho da tela.
  - https://atlassian.design/foundations/spacing
- Material trata Card como um contêiner de uma unidade coerente de conteúdo,
  não como o contêiner padrão de cada métrica.
  - https://developer.android.com/develop/ui/compose/components/card
- Open edX usa a Course Home como ponto de progresso e reentrada, com uma ação
  de retomada e o outline como camada de conteúdo. Isso sustenta manter uma só
  área de reentrada, sem repetir a mesma ação no resumo e na trilha.
  - https://docs.openedx.org/en/latest/community/release_notes/ulmo/ulmo_mobile_updates.html
  - https://docs.openedx.org/en/ulmo/learners/SFD_start_course.html
- Moodle separa acompanhamento de progresso da visão de cursos/conteúdo, e o
  LinkedIn Learning mostra Aula atual e duração na visão de progresso. Ambos
  apoiam contexto suficiente para reentrada, mas não um painel cheio de KPIs.
  - https://docs.moodle.org/502/en/Course_overview
  - https://www.linkedin.com/help/learning/answer/a1346436

## Recomendações individuais

### 1. Simplificar os metadados do header — implementar

Remover as caixas individuais de “Aulas” e “Carga horária” e transformá-las em
um `<dl>` compacto, com alinhamento e separação por espaço. Manter o progresso
como a única evidência visual de avanço, com percentual e denominador textual.

Impacto: reduz ruído sem remover informação. Risco baixo.

### 2. Adicionar capa compacta — implementar depois da simplificação

Usar a capa existente somente quando disponível, em uma moldura horizontal
compacta ao lado do título. Não criar um hero alto, gradiente novo, fundo
fotográfico em tela inteira ou superfície aninhada. Se não houver capa, o
header deve ocupar o espaço normalmente, sem deixar um bloco vazio.

Impacto: adiciona personalidade ao Curso sem reconstruir a página. Risco
baixo/médio; precisa validar título longo, imagem ausente e mobile.

### 3. Remover o CTA duplicado do header — implementar

`Continuar assistindo` já contém a próxima Aula e os links de reentrada. O
header deve resumir o Curso e o progresso; a seção de reentrada deve ser a
única dona da ação de iniciar/continuar.

Para Curso concluído, `Ver certificado` deve permanecer somente no painel de
Certificado. Isso elimina duas ações para a mesma finalidade.

Impacto: reduz ambiguidade e carga cognitiva. Risco baixo, desde que a seção
de reentrada continue visível quando houver próxima Aula.

### 4. Não repetir liberação temporal no header — manter como está

O Módulo já apresenta “Em breve” e a data no contexto correto. Repetir a data
no header faria a página voltar ao problema de conteúdo duplicado. O header
deve permanecer neutro quando não houver próxima Aula elegível.

### 5. Não remover a trilha nem alterar seus acordeons nesta etapa — manter

A trilha é a função principal da página. O refinamento deve melhorar a entrada
na trilha, não substituir a navegação curricular nem misturar metadados de
Curso com cada Módulo.

### 6. Atualizar o skeleton junto com o header — implementar

O loading deve espelhar a nova relação visual: capa opcional, título/descrição,
linha de metadados, progresso e reentrada. Não deve inventar painéis de
Certificado ou métricas extras.

## Composição recomendada

```text
[ capa compacta ]  Título do Curso
                    Descrição
                    Aulas · Carga horária
                    Progresso  40%  ━━━━━━━━

Continuar assistindo
[ próxima Aula ] [ aula seguinte ]

Trilha do curso
Módulo 1 ...
```

O header fica mais calmo e a ação aparece onde o usuário encontra o conteúdo
que realmente será retomado.

## Fora do escopo

- nova migration ou novo dado de analytics;
- último acesso por Curso;
- novos KPIs, streaks ou metas;
- redesign completo da página;
- alteração de radius global, tema ou biblioteca visual;
- remoção dos separadores de Módulo, que deve ser uma análise separada.

## Limitações

A revisão foi feita por código, contrato visual e pesquisa documental. Não foi
feita inspeção de navegador local por restrição do projeto. A implementação deve
ser validada com: Curso com e sem capa, título/descrição longos, progresso zero,
progresso parcial, Curso concluído, Certificado pendente/revogado e viewport
estreito.
