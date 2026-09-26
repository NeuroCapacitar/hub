---
status: research
owner: product
last_verified: 2026-09-25
---

# Versionamento de templates de Certificado e publicações de Curso

## Resumo executivo

Recomendação: manter versões das configurações publicadas de Certificado e o modelo de publicações de Curso. Não transformar cada salvamento de rascunho em versão imutável. O fluxo atual já faz isso corretamente: o rascunho é editável; publicar cria um limite histórico. O ponto fraco é de recuperação e apresentação: o histórico de templates informa apenas número e estado e não permite inspecionar nem restaurar uma versão.

Se houver necessidade de rollback, restaurar uma versão anterior como um novo rascunho e publicá-la normalmente. Não reativar nem sobrescrever a versão histórica. Isso mantém a sequência e a auditoria e deixa explícito que a correção ocorreu agora.

## O que o código faz hoje

### Templates de Certificado

- `saveCertificateTemplateDraft` atualiza o rascunho existente no mesmo registro. Se não existir rascunho, cria outro com `max(version) + 1`.
- `publishCertificateTemplate` marca o publicado anterior como `superseded` e promove o rascunho. Uma versão publicada não é editada pelo fluxo normal.
- A interface tem um sheet “Histórico de versões”, mas lista somente número e estado. Não mostra o design anterior, data de publicação nem oferece restauração.
- A emissão copia no `render_snapshot` os campos visuais, assets, signatário, emissor, ID e versão do template. O PDF e a prévia são renderizados a partir desse snapshot. Alterar o template do curso não reescreve certificados já emitidos.
- O relacionamento `certificate_template_id` é útil como proveniência e o snapshot também registra ID/versão. O histórico publicado, portanto, não é necessário para renderizar novamente o certificado: esse comportamento usa o snapshot; ainda assim, o registro publicado facilita rastreio e restauração futura.
- A limpeza de assets considera referências de todas as linhas em `certificate_templates` e dos snapshots retidos. Assim, manter versões antigas também pode manter imagens antigas no R2. A política de arquivos deve ser tratada explicitamente se o histórico crescer; não é uma razão isolada para eliminar a semântica de versões.

Evidências no código: `src/features/certificates/templates.ts`, `src/features/certificates/server.ts`, `src/features/certificates/template-asset-cleanup.ts`, `src/app/(admin)/admin/cursos/[courseId]/certificate-template-editor.tsx` e `src/db/schema.ts`.

### Curso (`CoursePublication`)

- Criar uma revisão copia a publicação vigente para um rascunho novo.
- O Admin prepara as mudanças sem alterar o currículo ativo; a publicação troca a versão vigente atomicamente e aposenta a anterior.
- Matrículas ativas passam a ler a publicação vigente. A identidade curricular estável preserva continuidade de progresso e analytics entre publicações; conclusões e certificados mantêm o contexto de origem.
- Publicações aposentadas são preservadas, mas não há fluxo administrativo para restaurar uma delas. O fluxo atual cria rascunho a partir da publicação vigente, não de uma escolhida no histórico.

Esse contrato está descrito no [ADR-0007](../adr/0007-course-versioning-and-enrollment-curriculum.md) e implementado em `src/features/admin/authoring.ts`.

## São o mesmo tipo de versionamento?

Não.

- **Template de Certificado:** controla o visual de documentos emitidos no futuro. Cada Certificado emitido congela os dados de emissão e o template usado; uma edição posterior deve afetar somente emissões futuras.
- **Publicação de Curso:** controla qual currículo está ativo para todos os alunos matriculados. Uma publicação muda conteúdo, progressão e disponibilidade efetivamente entregues.

Ambos se beneficiam de rascunho mutável, publicação explícita e histórico append-only. Mas o impacto e os dados preservados são diferentes; um não prova que o outro precisa da mesma interface ou da mesma política de retenção.

## Evidência de outros produtos

As fontes oficiais consultadas descrevem principalmente o comportamento oferecido ao usuário; não revelam necessariamente a implementação interna de versionamento.

- A Thinkific declara que mudanças no design do certificado afetam emissões futuras e que certificados já emitidos permanecem inalterados. Sua documentação também recomenda considerar os efeitos da edição de cursos já publicados com alunos ativos. [Certificate Designer](https://support.thinkific.com/hc/en-us/articles/41803314085783-Designing-Your-Certificate-with-the-Certificate-Designer), [edição de cursos publicados](https://support.thinkific.com/hc/en-us/articles/360030371214-Editing-Published-Courses).
- A Teachable permite editar/ativar certificados do curso e descreve a ativação para alunos que concluem depois; a documentação separa o design do certificado do documento já emitido. Isso sustenta o modelo de configuração vigente + evidência de emissão, mas não prova que a Teachable mantenha um histórico restaurável de templates. [Certificates of Completion](https://support.teachable.com/en/articles/11682466-certificates-of-completion).
- Para conteúdo de curso, há estratégias diferentes. Moodle documenta backup/restauração/importação de conteúdo, e Canvas documenta histórico de páginas com restauração. O Canvas restaura o conteúdo antigo como revisão atual e mantém a trilha, em vez de apagar a sequência histórica. São precedentes para recuperação controlada, não prova de que todo LMS versione publicações curriculares completas. [Moodle: backup e restore](https://docs.moodle.org/500/en/Backup_and_restore_FAQ), [Canvas: histórico de páginas](https://community.instructure.com/en/kb/articles/660960-how-do-i-view-the-history-of-a-page-in-a-course).

## Avaliação e decisão recomendada

### Manter

1. **Uma versão por publicação real do template.** Mudanças repetidas no rascunho não precisam gerar registros; a sequência deve representar publicações que podem ser ligadas às emissões.
2. **Snapshots imutáveis em cada Certificado.** Esse é o fundamento para preservar o que o aluno recebeu; manter somente uma configuração global mutável enfraqueceria a proveniência histórica.
3. **Publicações de Curso separadas.** O curso muda o currículo vivo de uma coorte existente, e seu histórico sustenta progressão, analytics e contexto de conclusão.

### Melhorar se recuperação for uma necessidade operacional

1. No histórico de Certificado, permitir visualizar uma versão anterior e “Restaurar como rascunho”. A restauração deve copiar a configuração para a próxima versão, passar pela prévia e validações atuais e exigir publicação explícita.
2. No histórico do Curso, oferecer recuperação equivalente apenas se a operação precisar: copiar uma publicação aposentada para um novo rascunho e republicar. Não reativar a publicação antiga nem alterar progresso como efeito colateral.
3. Exibir datas/estados de publicação úteis no histórico de template. Hoje apenas “Versão N” e o estado não tornam o histórico suficientemente informativo.
4. Definir uma política para assets antigos. Templates publicados podem continuar sendo úteis para recuperação; snapshots de Certificados retidos são necessários para renderização fiel. Não excluir imagens sem verificar ambos os tipos de referência.

## Conclusão

Remover o versionamento porque as configurações podem ser editadas a qualquer momento confundiria **capacidade de mudar o estado atual** com **necessidade de preservar o estado que foi publicado**. O projeto deve manter versões publicadas, mas não precisa criar histórico a cada salvamento. A lacuna real é que o histórico existente não recupera configurações. A restauração segura, caso aprovada, deve sempre gerar uma nova revisão e jamais modificar o passado.
