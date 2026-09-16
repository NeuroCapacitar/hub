---
status: canonical
owner: product
last_verified_commit: b9cc1bd90419d4ed623b2b9805a48adc840d5957
---

# Glossário do Hub

Este arquivo fixa vocabulário de produto. Regras, implementação e decisões vivem na [documentação canônica](docs/README.md).

## Pessoas e identidades

**Aluno**

Pessoa que consome Cursos no Hub. É papel de negócio e não prova que tenha efetuado a compra.

**Conta**  
Identidade autenticável do Hub, identificada por e-mail e protegida por credenciais e sessões. Seu papel técnico é `student`, `support` ou `admin`.

**Compradora**  
Pessoa que informa dados no checkout e assume a relação financeira do Pedido. Pode ser ou não o Aluno; e-mail de compra e e-mail de Conta não são sinônimos sem regra explícita de vínculo.

**Especialista**  
Responsável pelo conteúdo, experiência pedagógica e decisões de produto. No escopo atual há uma única especialista, sem marketplace ou tenancy por especialista.

**Admin**  
Operadora com todas as permissões administrativas. O termo descreve autorização, não propriedade comercial.

**Suporte**  
Operadora com subconjunto explícito de permissões administrativas; não é um Admin limitado por convenção.

## Comércio e acesso

**Pedido**  
Registro da intenção e resultado financeiro de compra, com preço, duração e identidade como snapshots.

**Concessão de acesso**  
Direito de uma Conta acessar Curso, originado em fonte identificável como Pedido
pago, concessão manual ou autoinscrição gratuita. A origem e a janela do direito
continuam distinguíveis mesmo quando o acesso expira ou é bloqueado.

**Autoinscrição gratuita**
Aquisição direta de acesso por uma Conta Student a um Curso oferecido sem cobrança. É
uma forma de obter Concessão, não é Pedido, compra ou Matrícula independente.

**Matrícula**  
Projeção consolidada do acesso atual de uma Conta a um Curso. Pode refletir mais de uma Concessão e não é a origem do direito. Matrícula ativa lê a publicação vigente do Curso.

**Liberação programada**
Modo de Matrícula que libera Módulos em `D+N`, com cada dia representando 24 horas decorridas desde a âncora do episódio. A sequência pedagógica continua sendo uma decisão separada.

Na sequência pedagógica, somente Aulas obrigatórias anteriores formam pré-requisito. Aulas opcionais ficam acessíveis quando as obrigatórias anteriores foram concluídas, não bloqueiam a próxima Aula obrigatória e podem ser recomendadas; após uma conclusão, a recomendação segue para frente e só reinicia no começo ao terminar a última Aula do currículo.

**Acesso integral**
Modo de Matrícula que ignora atrasos temporais. Admin pode concedê-lo uma vez no episódio atual com motivo e auditoria; Support apenas diagnostica.

**Bloqueio de matrícula**  
Revogação manual de acesso a Curso específico; não bloqueia automaticamente a Conta inteira.

**Bloqueio de plataforma**  
Suspensão da Conta na experiência do Aluno, mais ampla que bloqueio de Matrícula e sem apagar histórico.

## Acesso à plataforma

**Mídia da tela de acesso**
Imagem visual administrada para compor a entrada pública do Hub. Não contém
CTA, texto editorial ou dados do Aluno e não concede acesso por si só.

**Revisão financeira**  
Fila humana quando o sistema não pode aplicar evento financeiro com segurança, como conflito entre estados terminais ou valor divergente.

**Estado de entrega do Curso**
Define se o conteúdo pode ser entregue: rascunho, ativo ou arquivado. Não define vitrine nem novas vendas.

**Visibilidade de catálogo**
Define se pessoas sem Matrícula descobrem o Curso na vitrine. Ocultar não revoga acesso adquirido.

**Estado de vendas**
Define se o Hub aceita novas aquisições do Curso, por compra ou autoinscrição gratuita.
Fechar vendas não altera Concessões ou Matrículas existentes.

**Interesse de venda**
Manifestação reversível de uma Conta Student para receber um único aviso na próxima abertura de vendas. Não é Pedido, Concessão ou Matrícula.

## Aprendizagem e conteúdo

**Curso**  
Produto educacional publicável, composto por Módulos e Aulas, que pode ser vendido ou
oferecido gratuitamente.

**Publicação de Curso (`CoursePublication`)**
Revisão interna materializada de Módulos e Aulas, com estados rascunho, publicada e aposentada. A publicação vigente define o currículo vivo de todas as Matrículas ativas do Curso; não é produto nem direito comercial individual.

**Conclusão de Curso (`CourseCompletion`)**
Primeira conclusão histórica de um Aluno em um Curso, com data e publicação de origem. Somente Cursos com pelo menos uma Aula obrigatória entram no fluxo de conclusão e Certificado; a transação que cria essa primeira evidência pode iniciar a emissão automática. Não é apagada por publicação posterior, revogação ou reemissão de certificado.

**Módulo**  
Agrupamento ordenado de Aulas dentro de Curso e unidade de disponibilidade temporal. Todas as Aulas herdam o momento de liberação do Módulo atual.

**Aula**  
Unidade ordenada de aprendizagem que pode combinar vídeo, texto rico e materiais.

**Identidade curricular (`curriculum_key`)**
Chave pedagógica estável que liga a mesma Aula entre publicações do mesmo Curso. Mudança grande de conteúdo cria outra identidade.

**Identidade de mídia**
Combinação do provedor e do identificador persistido do vídeo que permite reconhecer a mesma mídia entre publicações. URL manual sem identificador estável não prova continuidade.

**Discussão da Aula**
Thread de comentários que acompanha Curso + identidade curricular, sem copiar registros quando uma publicação nova materializa outra Aula física.

**Progresso**  
Evidência de consumo de Aulas e Curso. Não é direito de acesso.

**Posição de retomada**
Último ponto válido reproduzido que o Aluno deve reencontrar ao reabrir um vídeo. Um salto para frente não substitui esse ponto até que exista reprodução real depois dele.

**Fronteira linear validada**
Maior ponto alcançado por reprodução normal a partir do conteúdo já validado, sem contar saltos para frente. É a referência da conclusão automática de vídeo em Cursos lineares.

**Tempo de reprodução**
Tempo em que o vídeo avançou normalmente, separado de pausas, buscas, buffering e posição máxima. Pode contar novamente um trecho revisto e serve aos analytics, não substitui a fronteira linear.

**Conclusão**  
Estado em que Aula ou Curso satisfaz a regra vigente de completude. É independente de expiração.

**Origem da conclusão**
Indica se uma Aula foi concluída manualmente pelo Aluno ou automaticamente após reprodução validada do vídeo. Conclusões antigas sem essa informação são históricas ou desconhecidas.

**Disponibilidade temporal do Módulo**
Condição que define quantos períodos de 24 horas após o início da entrega devem transcorrer antes do consumo de um Módulo. Não concede acesso ao Curso, não altera sua validade e não substitui a sequência pedagógica.

**Início da entrega de conteúdo**
Âncora do episódio contínuo em que uma Matrícula efetiva recebe conteúdo programado. Renovação contínua preserva a âncora; novo direito após perda total inicia outra.

**Certificado**  
Documento para um Aluno e Curso, com snapshots exibidos. O lifecycle é serializado por Conta e Curso; o preparo do PDF pode estar pendente, pronto ou falho. Pode ser válido, revogado ou reemitido.

**Evento de aprendizagem**
Registro técnico minimizado e idempotente de início, checkpoint, conclusão ou falha. É analytics, não autoridade de Progresso, acesso ou Certificado.

**Preferência de analytics de aprendizagem**
Controle de opt-out do Aluno para os eventos técnicos opcionais. Por padrão, analytics está habilitado; desativar não muda acesso, sequência, progresso, conclusão ou Certificado.

**Métrica agregada de aprendizagem**
Contagem ou medida por Aula e Publicação de Curso que não apresenta Conta, Matrícula, Aluno, e-mail ou lista de inatividade.

## Integrações e operação

**Provedor**

Serviço externo responsável pela execução técnica de uma integração do Hub, como entrega de e-mail ou processamento de vídeo. Não é a autoridade sobre as regras de negócio do Hub.

**Projeção de integração**

Estado local resumido do último resultado conhecido de um Provedor, mantido para contexto, reconciliação e decisão do Hub. Não substitui o estado externo.

**Evento de Provedor não reconciliado**

Notificação externa recebida pelo Hub que ainda não foi associada ou consolidada no estado local. Exige investigação, mas não prova sozinho que o efeito externo falhou.

**Operação técnica do Provedor**

Detalhe de entrega, reputação, conversão, armazenamento, player ou outro processamento específico do serviço externo.

**Operação de negócio do Hub**

Intenção, associação, acesso, publicação, conclusão, Certificado, idempotência ou consequência de produto que o Hub deve decidir.

## Durações

**Duração pedagógica da Aula**  
Estimativa de consumo: vídeo mais leitura. Serve à experiência.

**Carga horária do Curso**  
Valor oficial do Curso: soma das durações pedagógicas das Aulas ou override
manual configurado; não define validade de acesso.

**Duração comercial de acesso**  
Quantidade de meses definida para o acesso e registrada no Pedido ou na Concessão; não é
carga horária pedagógica.

**Janela efetiva de acesso**  
Intervalo real entre liberação e expiração após extensões, reduções, renovação ou bloqueio.

**Duração de upload**  
Validade técnica de URLs temporárias e sessões de envio; não é duração pedagógica ou comercial.

## Estados documentais

**Implementado**: comportamento comprovado no `HEAD`, sem pressupor aprovação de produto.
**Aprovado**: decisão com trade-off e autoridade registrada, ainda que não implementada.
**Aguardando ratificação**: comportamento existe, mas a aprovação histórica não foi comprovada.
**Pendente**: pergunta real sem decisão ou implementação conclusiva.
