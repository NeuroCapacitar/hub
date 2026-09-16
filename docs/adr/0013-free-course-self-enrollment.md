---
status: accepted
owner: product
last_verified_commit: 48110385a7097084c42b9b862b57c66ed311898d
---

# Autoinscrição gratuita em Curso

O Hub precisa oferecer Cursos de preço zero sem misturar aquisição gratuita com
Pedido financeiro ou com o provider Asaas. Esta decisão foi ratificada pelo produto
em 2026-09-16 e registra o contrato da autoinscrição gratuita e seus limites.

## Decisão

Um Curso gratuito é um Curso ativo, listado, com vendas abertas, Publicação publicada,
cronograma compatível com a duração de acesso e `price_in_cents = 0`. Uma Conta com papel
Student usa `enrollFreeCourseAction`, que deriva a identidade da sessão e chama
`enrollInFreeCourse`. O caso de uso relê o Curso sob lock de Conta + Curso e, na mesma
transação, cria ou reativa a Concessão `free_enrollment`, registra
`free_enrollment_granted` e recompõe a Matrícula. Não cria Pedido, `orders`, Checkout,
digest financeiro ou chamada ao Asaas.

A janela gratuita usa `access_duration_months`. Uma Concessão gratuita ativa torna uma
repetição um no-op; uma Concessão expirada pode ser reativada somente por ação explícita,
reutilizando a mesma linha e registrando a janela anterior e a nova. Concessões
terminalizadas e Matrículas revogadas não são reativadas. Bloqueio de Matrícula cancela
Concessões elegíveis, inclusive gratuitas, e restauração só desfaz esse bloqueio manual.

Visitantes chegam ao handoff `/comprar/<slug>` e podem seguir para login ou cadastro com
retorno interno validado. `AUTH_PUBLIC_SIGNUP_ENABLED` permanece `false` por padrão; o
cadastro cria somente a Conta, nunca Concessão ou Matrícula. A action gratuita continua
restrita a Student autenticada.

## Alternativas rejeitadas

- Criar Pedido ou Checkout de valor zero: contaminaria o ledger financeiro, as métricas
  e a integração Asaas sem representar uma compra.
- Criar uma tabela ou projeção paralela de inscrição: duplicaria a autoridade de acesso
  já existente em Concessão + Matrícula.
- Conceder acesso automaticamente no cadastro: permitiria acesso sem uma intenção
  explícita para um Curso e ampliaria o impacto do cadastro público.
- Aceitar `userId`, preço ou estado do Curso enviados pelo navegador: permitiria que o
  cliente escolhesse a identidade ou contornasse os gates de disponibilidade.

## Consequências

- O caminho gratuito é local, pequeno e independente de credenciais Asaas.
- Concessões gratuitas aparecem no mesmo ledger, projeção, manutenção e auditoria dos
  demais direitos, preservando a operação existente.
- A unicidade por Conta + Curso evita duplicidade em retry e concorrência, enquanto a
  política de reentrada precisa ser tratada como contrato de produto.
- O cadastro público continua com default `false`; habilitá-lo é uma decisão de
  configuração e release por ambiente, não um efeito automático deste ADR.
