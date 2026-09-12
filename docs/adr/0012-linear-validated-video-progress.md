---
status: accepted
owner: product
last_verified_commit: e0a55d04884851c21bd55fe605afd05cc52c5a4e
---

# ADR-0012 Progresso linear validado em vídeo

O Hub deve impedir que um salto para frente seja interpretado como vídeo assistido, mas manter a experiência simples. A posição de retomada, a posição máxima observada, a fronteira de reprodução validada e o tempo de reprodução são conceitos diferentes; a conclusão automática usa somente a fronteira linear validada, enquanto o Aluno continua podendo concluir manualmente.

## Decisão

Um evento de `skip` para frente não avança a fronteira linear validada nem libera conclusão automática. Reprodução normal pode avançar essa fronteira somente a partir do ponto validado, com a tolerância técnica aprovada para eventos amostrados. O tempo realmente reproduzido depois de um `skip` entra nos analytics, mas não libera conclusão até que o trecho anterior seja percorrido linearmente. A conclusão automática exige a fronteira validada em pelo menos 98%; o evento `end` apenas dispara a sincronização e não substitui o limiar. A ação manual continua disponível sem requisito de vídeo.

A retomada usa o último ponto válido reproduzido. Um `skip` para frente não substitui essa posição até que exista reprodução real depois do salto. `max_position_seconds` é preservado como posição máxima observada e compatibilidade histórica, mas não é usado para retomada, progresso validado ou conclusão automática. Conclusões manuais e automáticas devem ser identificáveis nos analytics. Registros históricos de posição não são tratados como progresso validado.

Não serão persistidos ranges de cobertura nesta etapa. Se o produto futuramente quiser creditar trechos assistidos fora de ordem, essa será uma decisão e uma mudança de modelo separadas.

## Consequências

O desenho é menor e mais previsível para Cursos lineares, funciona com o iframe atual e evita migration de ranges. Um trecho assistido fora de ordem pode aparecer no tempo de reprodução, mas não avança a conclusão automática até preencher a lacuna anterior. Eventos do navegador continuam sendo evidência técnica de reprodução, não prova de atenção humana; o servidor mantém a autoridade sobre duração, acesso, ordem, idempotência e conclusão.

Dados antigos podem continuar sendo usados como retomada de compatibilidade, mas não como fronteira validada. Uma implementação futura precisa distinguir sessão e ordem de eventos para não deixar uma mensagem atrasada regredir a retomada.

## Alternativas consideradas

- Ranges persistidos: adiados por complexidade, dependência do contrato do JMVStream e ausência de necessidade para a regra linear.
- Conclusão somente pelo botão: mais simples e mais rígida, mas elimina a conveniência da conclusão automática após reprodução normal.
- Maior posição como progresso: rejeitada para conclusão automática porque um `skip` pode alcançar 98% sem percorrer o conteúdo.
