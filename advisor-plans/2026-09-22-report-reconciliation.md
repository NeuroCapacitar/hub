# Reconciliação do relatório de direção visual

> Baseline: `f115568a` (`feature/small-changes`).
> Escopo: verificar o relatório `C:\Users\Junior\Desktop\relatorio de ux.md`
> contra o histórico desta worktree e o código atual. Nenhum código de produto
> foi alterado nesta revisão.

## Decisão explícita

A sugestão de reformar o header da página de Curso foi **pulada por decisão do
produto**. A nota correspondente foi marcada como rejeitada e não deve voltar
à fila sem nova autorização.

## Estado das fases

| Área do relatório | Estado atual | Evidência / observação |
| --- | --- | --- |
| Fundação visual e densidade | Implementada com ajustes | Tokens semânticos de forma, base confortável global e exceções locais `size="sm"`. A troca global de `--radius` foi rejeitada. |
| Home do Aluno | Implementada | `ContinueLearningCard`, próximo passo, progresso e ação contextual. |
| Header da página de Curso | **Descartada** | Não implementar capa no header, remoção de métricas ou remoção do CTA. Só volta com nova decisão explícita. |
| Módulos, LessonCards e movimento | Parcialmente implementada | Hover/motion já foram refinados; separadores e alguns microajustes continuam opcionais. |
| Certificados | Implementada | Arquivo, preview, histórico, estados, revogação e ações foram refinados. |
| Auth | Analisada, não implementada como nova direção | A estrutura atual já é sólida; art direction institucional exigiria mock e pesquisa própria. |
| Checkout e estados do sistema | Implementada | Fluxos de compra, sucesso, cancelamento, expiração, erro e manutenção foram tratados. |
| Dashboard Admin | Parcial | Conteúdo e prioridades foram preservados, mas ainda há nesting visual em agrupadores. |
| Financeiro, Operação e tabelas | Implementada / preservada | Densidade operacional, severidade e tabelas foram mantidas ou refinadas. |
| Aprendizagem Admin | Implementada em incrementos | Atividade, amostra, erros, pausas e contexto foram adicionados/refinados. |
| FAQ, Configurações e navegação | Implementada | Scrollspy, configurações e FAQ do Aluno foram tratados. |
| Novas features de produto | Não adotadas | Metas, aulas salvas, novidades, streaks, rankings e novos KPIs continuam fora do sprint. |

## Próxima sugestão válida

### Limpeza de superfícies aninhadas no Dashboard Admin

O relatório e a pesquisa existente em
`research/2026-09-21-admin-dashboard-surface-hierarchy-ux-research.md`
convergem para um refinamento, não uma reorganização ampla.

O código atual ainda mostra:

- `IssueGroup` como `Card` com linhas internas delimitadas por separadores;
- `CatalogHealthCard` com resumo interno contornado e lista de Cursos;
- `CertificateQueueCard` com itens internos em caixas próprias;
- `ContextCard` com métricas apresentadas como caixas dentro de outro `Card`;
- tabelas em `Card` com um segundo contêiner bordado.

### Decisão da análise

**É válido implementar em pequenos incrementos**, começando por `ContextCard`:

1. transformar as métricas internas em linhas planas de `<dl>`;
2. preservar label, valor, unidade e helper;
3. testar depois uma versão mais plana de `IssueGroup`;
4. remover somente a moldura interna do resumo de prontidão se o contraste do
   `Card` externo continuar suficiente;
5. manter tabelas, métricas independentes e fila de suporte como estão.

Essa direção é coerente com Shopify, Carbon e Fluent: listas compactas servem
para coleções pequenas e escaneáveis; tiles simples não precisam da mesma
complexidade de cards; proximidade e espaço devem criar agrupamento antes de
adicionar mais bordas.

## Itens ainda abertos, mas já analisados

1. **`surface-warm`**: usar de forma controlada em certificado, conclusão ou
   onboarding; não espalhar areia em cards comuns e não criar cor global nova.
2. **Auth mais institucional**: possível, mas requer mock isolado e validação
   de mobile/peso visual antes de tocar no shell compartilhado.
3. **Separadores da trilha e microajustes de LessonCard**: hipóteses de polish,
   sem prioridade antes do Dashboard Admin.
4. **Metas de estudo, aulas salvas, novidades e novos analytics**: hipóteses de
   produto; não são refinamentos puramente visuais e continuam fora do sprint.

## Itens rejeitados ou encerrados

- troca global direta de `--radius` para `0.5rem`;
- aumento global do header;
- blobs, glow, gradientes decorativos e nova biblioteca visual;
- KPIs, streaks, ranking, XP e comparação entre alunos;
- transformar tabelas administrativas em cards confortáveis;
- hero/header da página de Curso nesta rodada.

## Resultado

Ainda há trabalho no plano, mas não há outra grande fase não mapeada. A próxima
análise/implementação deve ser o polimento estrutural do Dashboard Admin,
começando pelo `ContextCard`, sem remover informação operacional nem alterar a
densidade das tabelas.
