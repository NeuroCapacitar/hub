# Análise individual: imagens como parte do sistema visual

> Status: análise read-only; nenhum código foi alterado nesta etapa.
> Baseline: `e436ae80` (`feature/small-changes`).

## Localização no plano

Esta é a sugestão `# 39 — Imagens da NeuroCapacitar precisam virar parte do
sistema`, imediatamente após a proposta de direção visual da autenticação no
relatório anexado.

O relatório classifica os usos assim:

- **alto:** autenticação, banner, checkout, empty state importante, conclusão e
  certificados;
- **médio:** Dashboard do Aluno e hero de Curso;
- **praticamente zero:** Financeiro, Operação, Auditoria, tabelas e formulários
  Admin.

## Estado atual confirmado

A maior parte da sugestão já está materializada:

- Autenticação possui galeria administrável, carousel, fallback, blur, autoplay
  controlado e navegação acessível em `src/features/auth-media/`.
- Banners têm galeria e ordenação próprias.
- Checkout e catálogo usam Capa do Curso, que é conteúdo da entidade em foco.
- Certificados usam preview gerado do documento real, não imagem decorativa.
- Dashboard do Aluno usa carousel de banners e capas de Cursos.
- Superfícies técnicas permanecem predominantemente sem imagens, alinhadas ao
  contrato de Operação em `DESIGN.md`.

O sistema visual também proíbe criar stock art, ilustrações genéricas ou
screenshots falsos para preencher espaço. A mídia precisa ter ownership,
fallback, crop, alt e ciclo de publicação definidos.

## Pesquisa externa

- O USWDS recomenda que autenticação seja clara, simples e sem distrações; uma
  imagem pode compor a marca, mas não deve competir com a tarefa de entrar ou
  criar conta.
  [USWDS — Sign-in](https://designsystem.digital.gov/templates/authentication-pages/sign-in/)
- O Auth0 separa branding básico — logo, cores e fundo — de customização
  estrutural avançada, que aumenta a responsabilidade de manutenção e segurança.
  [Auth0 — Customize Login Pages](https://auth0.com/docs/customize/login-pages/classic-login/customization-classic)
- Diretrizes de acessibilidade exigem que a imagem informativa tenha alternativa
  textual e que a mídia decorativa não seja usada como único veículo de sentido.
  [W3C G103](https://www.w3.org/WAI/WCAG22/Techniques/general/G103)

## Avaliação

### O que já está correto

- A imagem aparece onde acrescenta contexto ou identidade.
- Conteúdo técnico não recebe decoração visual arbitrária.
- Assets administráveis têm fallback e tratamento de falha.
- Capa, banner, mídia de autenticação e preview de Certificado têm contratos
  diferentes, em vez de uma única imagem genérica para tudo.

### O que não deve ser implementado agora

- adicionar novas imagens decorativas a empty states sem asset aprovado;
- usar a mesma Capa de Curso como marca global;
- criar blobs, ilustrações genéricas ou overlays só para preencher espaço;
- adicionar imagens a Financeiro, Operação, Auditoria ou tabelas;
- adicionar copy hardcoded sobre slides cuja imagem pode ser trocada pelo Admin.

### Lacuna real

A autenticação suporta imagens, mas os slides não possuem copy editorial, tema
ou intenção declarada. Resolver isso exigiria ampliar o contrato de mídia, o
editor Admin, preview, acessibilidade e publicação. Não é um ajuste visual
isolado e não deve ser feito sem assets e textos aprovados.

## Decisão

**A sugestão está majoritariamente implementada e não precisa de uma nova
alteração global.** O uso atual de imagens deve ser preservado e governado por
ownership e contexto.

A única evolução futura válida seria uma segunda etapa editorial da mídia de
autenticação — copy por slide, alt/contexto e preview — depois de uma decisão
de conteúdo. Sem esse material, não há implementação visual segura nesta
sugestão.

## Resultado final

**Não implementar alterações agora.** Marcar a sistematização de imagens como
atendida no nível de arquitetura visual; a próxima sugestão ainda não atendida
do relatório passa a ser a revisão de movimento (`# 40`), que deve ser analisada
separadamente antes de qualquer código.

