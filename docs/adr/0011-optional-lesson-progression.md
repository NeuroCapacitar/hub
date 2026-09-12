---
status: accepted
owner: product
last_verified_commit: e0a55d04884851c21bd55fe605afd05cc52c5a4e
---

# ADR-0011 Sequência com Aulas opcionais não bloqueadoras

## Contexto

`is_required` define se uma Aula é necessária para a conclusão do Curso, mas não deve transformar Aulas opcionais em barreiras de navegação. O Curso pode intercalar Aulas obrigatórias e opcionais, e a experiência precisa permitir conteúdo opcional sem comprometer conclusão, certificado ou liberação das próximas obrigatórias.

## Decisão

Para uma Aula não concluída, a sequência fica disponível quando todas as Aulas obrigatórias anteriores estiverem concluídas; Aulas opcionais anteriores são ignoradas como pré-requisito. Aulas opcionais no início ficam acessíveis, e concluir a última obrigatória libera as opcionais pendentes posteriores. Após concluir uma Aula, o encaminhamento automático procura a primeira Aula pendente disponível à frente; somente quando a Aula concluída é a última do currículo a busca reinicia desde o início. A próxima recomendação pode ser opcional; se não houver nenhuma disponível, retorna `null`. A disponibilidade temporal do Módulo, matrícula, expiração e revogação continuam sendo aplicadas antes dessa regra.

Cursos sem Aulas obrigatórias não entram no fluxo de certificado porque a elegibilidade exige pelo menos uma Aula obrigatória. A publicação não é bloqueada por ausência de obrigatórias; Cursos sem certificado podem permanecer somente com Aulas opcionais, e uma eventual configuração de certificado sem obrigatórias não produz emissão.

## Consequências

Dashboard, overview, workspace e ações de conclusão podem apontar para a mesma próxima Aula pendente disponível. Ações de conclusão preservam a direção da trilha e só retornam a uma opcional pulada ao terminar a última Aula. Aulas opcionais não reduzem o progresso obrigatório nem bloqueiam uma obrigatória posterior, mas podem continuar sendo recomendadas até serem concluídas. A interface identifica cada Aula como obrigatória ou opcional. Testes devem cobrir opcionais no início, entre obrigatórias, depois da última obrigatória, opcionais puladas e publicação anterior via `curriculum_key`.
