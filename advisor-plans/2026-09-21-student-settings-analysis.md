# Análise individual: Configurações do Aluno

> Status: análise read-only; nenhum código foi alterado nesta etapa.
> Baseline: `c717f227` (`feature/small-changes`).

## Localização no plano

Esta é a sugestão `# 47 — Configurações do Aluno` do relatório anexado. O
relatório recomenda apenas refinamento de radius, padding, separação de seções,
menos rings e uma navegação lateral mais quieta; rejeita a criação de hero.

## Estado atual confirmado

A tela já incorpora quase toda a recomendação:

- usa `Scrollspy` para navegação contextual;
- mantém distância ampla entre seções (`gap-16`);
- usa títulos e descrições fora dos cards;
- usa `Card size="sm"` nos conteúdos, reduzindo o peso das sessões;
- separa Nome no certificado de Privacidade e Dados;
- usa tooltip apenas para informação complementar da preferência de analytics;
- não possui hero nem métricas decorativas.

A navegação lateral ainda está dentro de uma superfície com ring discreto. Isso
é intencional e já foi validado no fluxo anterior: o card Scrollspy foi ajustado
para ficar alinhado ao topo e funcionar como âncora persistente, não como um
bloco de conteúdo concorrente.

## Pesquisa externa

- Material recomenda que configurações sejam organizadas, previsíveis, com as
  opções importantes no topo e agrupamento por seções específicas.
  [Material — Settings](https://m1.material.io/patterns/settings.html)
- O sistema também recomenda usar navegação lateral para configurações quando
  há grupos de preferências e evitar separar cada item em superfícies semânticas
  independentes.
  [Material — Navigation](https://m1.material.io/patterns/navigation.html)
- Atlassian trata SideNav como navegação específica da aplicação e separa
  navegação de painéis suplementares; isso apoia manter o Scrollspy como
  navegação contextual, não removê-lo por princípio.
  [Atlassian — Navigation system](https://atlassian.design/components/navigation-system/migration-guide)

## Decisão

**Não implementar novo refinamento agora.** A sugestão está atendida dentro da
linguagem atual do projeto:

- o raio e o padding já foram refinados pelos tokens e `Card size="sm"`;
- a separação vertical já é generosa;
- o Scrollspy precisa continuar com uma superfície discreta para permanecer
  legível e alinhado;
- remover o card lateral agora seria regressão em relação à decisão visual
  validada anteriormente.

Não há motivo para adicionar hero, métricas, novas seções ou outra navegação.

## Resultado final

**Sugestão atendida.** A tela de Configurações do Aluno deve permanecer quieta,
orientada a preferências e sem novas alterações nesta etapa.

