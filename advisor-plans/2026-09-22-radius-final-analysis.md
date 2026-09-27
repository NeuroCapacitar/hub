# Análise: Etapa 6 — radius final

> Status: implementado; baseline global e escala semântica recalibrados.

## Estado atual

O Hub já possui uma escala semântica em src/app/globals.css:

- detalhe: 6px;
- controle: 8px;
- card: 10px;
- superfície: 12px;
- mídia: 16px.

O baseline global agora é --radius: 0.5rem. Os papéis semânticos derivam desse
valor para manter a escala centralizada. Os primitives principais já
usam os papéis semânticos:

- Button, Input, Select e Textarea: rounded-control;
- SelectContent: rounded-card;
- PasswordInput: rounded-e-control.

A fixture do design system já exibe e nomeia os cinco papéis. O contrato de
tokens também testa os controles compartilhados.

## O que a auditoria encontrou

Ainda existem muitos consumidores explícitos de rounded-md, rounded-lg e
rounded-xl em:

- Dialog, Popover, Tabs e Tooltip;
- Sidebar e navegação;
- wrappers locais de tabelas;
- skeletons;
- cards administrativos de Curso;
- detalhes e superfícies internas.

Como esses consumidores dependem da escala global, o novo baseline melhora sua
linguagem sem exigir uma alteração manual em cada componente. Papéis
semânticos continuam disponíveis quando um contexto precisa de um raio
deliberadamente diferente.

Também existe uma divergência objetiva: o Course Card do Aluno usa
rounded-surface, enquanto o card de gerenciamento Admin ainda usa rounded-xl
legado. Como ambos representam a mesma entidade visual, devem compartilhar o
mesmo papel.

## Comparação com referências

- [Atlassian Radius](https://atlassian.design/foundations/radius) usa 2px para
  detalhes, 4px para labels/lozenges, 6px para controles, 8px para cards, 12px
  para superfícies grandes e 16px para vídeo.
- [Fluent Shapes](https://fluent2.microsoft.design/shapes) recomenda uma
  progressão por tamanho e contexto: 4px como base, 8px para componentes
  grandes e 12px para superfícies maiores; também recomenda evitar arredondar
  elementos quando isso cria gaps artificiais.

A escala do Hub continua alinhada ao primeiro sistema e agora usa um baseline
mais confortável para controles e componentes legados.

## Implementação

- --radius passou para 0.5rem;
- rounded-control passou a acompanhar o baseline global;
- rounded-card passou a 1.25 vezes o baseline;
- rounded-surface passou a 1.5 vezes o baseline;
- rounded-media passou a 2 vezes o baseline;
- a fixture exibe Controle · 8px e Card · 10px;
- o contrato de tokens verifica a escala centralizada.

Após a revisão de impacto, algumas exceções que teriam ficado arredondadas
demais foram alinhadas a papéis semânticos:

- menus dropdown: card para a superfície e control para os itens;
- AlertDialog: surface;
- Alert: card;
- Tooltip: detail;
- Skeleton: control;
- Calendar: card;
- Sidebar: control como baseline local;
- Frame: surface como raio padrão.

Accordion, Empty, checkout, crop dialogs e superfícies grandes mantiveram seus
raios confortáveis porque a topologia e a proporção justificam a escolha.
Não houve substituição textual global nem alteração de comportamento,
overflow ou foco.
