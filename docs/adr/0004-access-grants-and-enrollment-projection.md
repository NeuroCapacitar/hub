---
status: accepted
owner: product
last_verified_commit: 9419c09b9c7f4a4f3f977e896f51374548080dd8
---

# ADR-0004 Concessão como fonte e Matrícula como projeção

## Contexto

Uma Conta pode adquirir o mesmo Curso mais de uma vez. Reembolso, disputa, renovação e ajuste pertencem à origem individual; a experiência do Aluno precisa de um único acesso atual.

## Decisão

Tratar Concessão como ledger e fonte dos direitos por origem, e Matrícula como projeção
de Conta + Curso. Toda mutação financeira altera a Concessão e recompõe a Matrícula;
nenhum fluxo financeiro cria ou altera Matrícula diretamente.

As origens de Concessão aprovadas são explícitas: `paid_order`, `manual` e
`free_enrollment`. `paid_order` representa uma origem financeira; `manual` e
`free_enrollment` representam origens locais de acesso. Nomes de providers pertencem
à integração e aos identificadores externos, não ao domínio de acesso.

## Alternativas

- Matrícula como fonte única: simples, mas perde origem e combina mal múltiplas compras.
- uma Matrícula por Pedido: preserva origem, mas complica autorização e UI.

## Consequências

- reconciliação pode reconstruir a projeção;
- regras de precedência entre múltiplas Concessões precisam ser formais;
- seeds e ferramentas devem criar fonte antes da projeção;
- mais tabelas e eventos, em troca de rastreabilidade.

## Estado

Decisão aceita. Schema, código e testes usam origens explícitas. `free_enrollment`
não possui `order_id` nem `manual_reference` e é limitada a uma Concessão por Conta e
Curso. Razões de revogação do módulo de Matrículas também são neutras:
`payment_refund` e `payment_dispute`. O processor financeiro Asaas aplica a Concessão
`paid_order` e recompõe a Matrícula na mesma transação do evento financeiro.

O bootstrap local cria uma Concessão `manual` idempotente, identificada por
`manual_reference`, e recompõe a Matrícula. O corte de Production da migração financeira
permanece pendente.
