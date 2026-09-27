# Refinamentos para o fluxo de Ajuda do estudante

**Verificado em:** 24/09/2026. Auditoria documental de fontes primárias; sem inspeção da implementação ou teste com estudantes.

## Conclusões

### Contato no fim da FAQ

**Fonte:** WCAG 2.2, critério 3.2.6, exige que mecanismos de ajuda repetidos em várias páginas do mesmo conjunto mantenham a mesma ordem relativa. Ele permite que a página ofereça ajuda diretamente ou por link e não exige contato humano, posição acima da dobra nem uma posição específica dentro de uma única página. A orientação suplementar de acessibilidade cognitiva da WAI recomenda que seja fácil pedir ajuda no ponto em que a pessoa trava, que haja opções de comunicação e que um formulário simples tenha no máximo três campos obrigatórios; essa orientação suplementar não é requisito de conformidade WCAG. [WCAG 3.2.6](https://www.w3.org/WAI/WCAG22/Understanding/consistent-help.html) · [WAI: ajuda e feedback fáceis de encontrar](https://www.w3.org/WAI/WCAG2/supplemental/patterns/o7p05-findable-support/)

**Inferência para `/app/ajuda`:** se o único contato está depois de uma FAQ longa, ele existe, mas não é uma saída facilmente encontrável para quem já sabe que precisa de uma pessoa. Mantenha um link/botão de contato no bloco inicial e repita-o em resultados sem resposta e no fim de respostas relevantes. Isso é uma decisão de encontrabilidade, não uma exigência normativa de “acima da dobra”.

### Respostas sempre abertas ou disclosure

**Fonte:** o GOV.UK Design System recomenda `<details>` para conteúdo que apenas parte do público precisa e diz para não esconder informação necessária à maioria. O padrão WAI de disclosure inclui respostas de FAQ entre seus exemplos e especifica controle acionável por Enter/Espaço e estado expandido recolhido corretamente exposto. [GOV.UK: Details](https://design-system.service.gov.uk/components/details/) · [WAI-ARIA APG: Disclosure](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)

**Inferência:** não recolha automaticamente todas as respostas por padrão. Deixe visíveis respostas curtas, frequentes ou críticas para concluir uma tarefa; use disclosure para explicações longas ou menos comuns, com a pergunta sempre legível e acionável. As fontes consultadas não comparam resultados de FAQs totalmente abertas contra recolhidas, nem estabelecem um limite de comprimento.

### Busca e categorias em uma FAQ pequena e dinâmica

**Fonte:** Carbon recomenda busca para conjuntos grandes/complexos e desaconselha quando há poucos dados ou quando a informação cabe facilmente em uma visualização. Não fornece contagem-limite. WCAG 2.4.5 trata de maneiras de localizar páginas dentro de um conjunto de páginas; não determina que cada FAQ ofereça simultaneamente busca e categorias. [Carbon: Search](https://carbondesignsystem.com/components/search/usage/) · [WAI: WCAG 2.4.5](https://www.w3.org/WAI/WCAG22/Understanding/multiple-ways)

**Inferência:** para um conjunto curto que cabe em uma visualização, mostre as perguntas diretamente; busca acrescenta pouco. Use categorias quando os temas forem distintos e reconhecíveis. Como o conjunto é dinâmico, reavalie a decisão quando volume, extensão ou variedade crescerem; não há número universal de perguntas que justifique busca. Não trate a WCAG como mandato de busca dentro da FAQ.

### Alternativa para quem não consegue autenticar

**Fonte:** a orientação atual da Thinkific diz que seu chatbot e contato pelo produto exigem login, mas oferece formulário sem login para quem está bloqueado, não consegue usar o chat ou ainda não tem conta. O GOV.UK recomenda uma forma simples de obter ajuda humana quando alguém trava e alerta contra excluir pessoas por exigir um único canal. São exemplos e princípios de produto, não uma regra WCAG que obrigue um formulário público. [Thinkific: contato e suporte](https://support.thinkific.com/hc/en-us/articles/360030719413-How-to-Get-Help-and-Contact-Thinkific-Support) · [GOV.UK: desenho de serviços](https://www.gov.uk/service-manual/design/introduction-designing-government-services)

**Inferência:** problemas de autenticação não devem depender exclusivamente de um canal que exige autenticação. Disponibilize o mesmo caminho de suporte por uma rota pública — por exemplo, formulário ou email — e indique quem responde, para quais assuntos e quando esperar retorno. Se a solicitação envolver dados privados, a verificação pode ocorrer no atendimento; não faça o login ser pré-requisito para relatar que não é possível entrar.

### Contexto pré-preenchido e atrito do formulário

**Fonte:** WCAG 3.3.7 cobre dados já fornecidos na mesma atividade e pede que sejam pré-preenchidos ou selecionáveis, com exceções por segurança, validade e necessidade essencial; não cria uma exigência geral de transportar contexto entre páginas. WCAG 1.3.5 pede que campos sobre a pessoa tenham finalidade programaticamente identificável. O GOV.UK recomenda justificar cada pergunta e reduzir a entrada repetida; a orientação cognitiva suplementar da WAI sugere até três campos obrigatórios no contato. [WAI: Redundant Entry](https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry) · [WAI: Identify Input Purpose](https://www.w3.org/WAI/WCAG22/Understanding/identify-input-purpose) · [GOV.UK: estrutura de formulários](https://www.gov.uk/service-manual/design/form-structure) · [GOV.UK: redução de passos e reaproveitamento de informações](https://www.gov.uk/service-manual/design/introduction-designing-government-services) · [WAI: ajuda fácil de encontrar e formulários simples](https://www.w3.org/WAI/WCAG2/supplemental/patterns/o7p05-findable-support/)

**Inferência:** quando conhecidos e pertinentes, passe para o contato o email da conta e o curso/aula de origem; mostre esses dados para revisão e permita corrigi-los. Peça só o canal de retorno e uma descrição curta do problema como campos obrigatórios; use categoria opcional se ajudar o encaminhamento. Em uma rota pública de recuperação, não presuma contexto que o sistema não possui e não peça informação já conhecida sem motivo. Prefill de curso/aula é uma hipótese de redução de esforço, não uma regra de WCAG; minimize o contexto armazenado por privacidade.

## Limite da evidência

Essas fontes sustentam requisitos de acessibilidade e recomendações dos próprios sistemas de design, não uma comparação experimental de layouts. Não provam que essas escolhas reduzam tempo, chamados ou abandono, nem indicam prevalência de um padrão no mercado. Validar tais efeitos exigiria pesquisa com estudantes ou dados de uso do próprio fluxo.
