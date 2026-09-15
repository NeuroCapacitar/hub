---
status: accepted
owner: product-design-engineering
last_verified_commit: d33c9eb645db9c985c9381dfd60e4031e5a1f8ad
---

# Mídia administrável da tela de acesso

A tela pública de acesso precisa de uma composição visual própria sem acoplar
autenticação aos banners do Dashboard. A mídia da tela de acesso será mantida
em uma coleção independente, administrada somente por Admin, publicada no
bucket público apenas depois da confirmação do objeto privado e exibida sem
texto ou CTA.

## Decisão

- uploads finais usam contrato 8:7, WebP `1200×1050` e validação server-side;
- a coleção admite no máximo cinco slides, com ordem e chave validadas;
- não havendo slide ativo ou havendo falha de mídia, a interface usa o fallback
  local da plataforma;
- o autoplay de seis segundos é autorizado nesta superfície, com navegação
  manual por indicadores, pausa/retomada acessível e pausa em foco/hover;
- a navegação manual usa somente indicadores compactos, com o indicador ativo
  alongado e sem setas laterais;
- as transições não consultam preferências de movimento do sistema;
- a mídia não é renderizada nem requisitada em viewport mobile;
- a lógica de Conta, sessão, credenciais, autorização e recuperação de senha
  permanece fora do recurso.

## Consequências

A coleção, o prefixo de storage, o staged upload, a publicação, a limpeza, a
revalidação, a auditoria e a área administrativa possuem contratos próprios.
Falhas entre banco e R2 não são tratadas como transação única: a aplicação
preserva o registro ou a chave necessária para retry/reconciliação e nunca
expõe um objeto que não foi publicado.
