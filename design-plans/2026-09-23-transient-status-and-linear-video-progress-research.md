# Pesquisa: mensagens de status e progresso linear em vídeo

**Pesquisa realizada em:** 23/09/2026 (America/Sao_Paulo)

**Escopo:** padrões oficiais W3C/WAI e documentação oficial de sistemas de design, LMS e players. A pesquisa distingue regra normativa, comportamento de produto documentado e inferência para o Hub. Não busca estimar prevalência de mercado.

## Fatos documentados

### Mensagens transitórias, orientação persistente e acessibilidade

- **WCAG 2.2 trata semântica, não aparência de toast.** A SC 4.1.3 cobre mensagens de sucesso, resultado, espera, progresso ou erro que aparecem sem mudar o contexto. Quando a mensagem é apresentada, sua função e atualização precisam ser determináveis por tecnologia assistiva sem exigir foco. A SC não obriga o produto a criar uma mensagem nem define duração ou formato visual. A técnica W3C ARIA22 documenta role="status" como uma forma suficiente, com anúncio educado (polite) sem mover o foco. [WAI: Understanding SC 4.1.3](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) · [WAI: ARIA22](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA22.html)

- **Alertas importantes não devem sumir rápido nem interromper com frequência.** O padrão Alert do WAI-ARIA APG recomenda evitar desaparecimento automático de alertas e alerta que interrupções frequentes prejudicam a usabilidade. É orientação para alertas importantes; não significa que todo toast precise permanecer. A WAI também adverte contra usar anúncio assertivo para mensagens que não sejam importantes e sensíveis ao tempo. [WAI-ARIA APG: Alert Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/alert/) · [WAI: Understanding SC 4.1.3](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)

- **Sistemas de design separam feedback após uma ação de orientação contextual.** O Carbon define toast como mensagem curta e temporária; inline persiste até ser resolvida ou dispensada; callout é contextual, carrega junto com a página e não pode ser dispensado. O padrão recomenda colocar mensagens inline junto ao elemento relacionado e informar próximos passos. Android descreve Snackbar como feedback breve após uma operação, normalmente desaparecendo em segundos, com duração configurável inclusive indefinida. O Adobe Spectrum recomenda pelo menos cinco segundos para toast auto-dispensável e que a ação continue disponível em outro lugar. [Carbon: Notification usage](https://carbondesignsystem.com/components/notification/usage/) · [Carbon: Notification pattern](https://carbondesignsystem.com/patterns/notification-pattern/) · [Android Developers: Snackbar](https://developer.android.com/develop/ui/compose/components/snackbar) · [Adobe Spectrum: Toast](https://spectrum.adobe.com/page/toast/)

- **Cor não pode carregar o significado sozinha.** Para indicar que um trecho está pendente ou concluído, cor deve vir acompanhada de texto ou outra indicação visual perceptível. [WAI: Understanding SC 1.4.1 Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)

### LMS e players: progresso, reprodução e seek

- **Canvas separa requisitos de módulo de analytics de vídeo.** O guia do aluno lista requisitos como visualizar, marcar como feito, contribuir, enviar ou atingir uma nota; mostra ícones de não iniciado, concluído e bloqueado. A documentação da visão analítica Canvas Studio Insights apresenta taxa de conclusão por espectador e gráficos por linha do tempo cujos vales indicam trechos pulados ou paradas. Ela não explica se o movimento do seek, por si só, conta como trecho assistido ou satisfaz uma conclusão linear, nem descreve feedback ao aluno após esse seek. [Instructure: View Modules as a student](https://community.instructure.com/en/kb/articles/661313-how-do-i-view-modules-as-a-student) · [Instructure: Studio Insights](https://community.instructure.com/en/kb/articles/660525-how-do-i-use-the-canvas-studio-insights-page)

- **Moodle core explicita critérios e tarefas pendentes, sem definir seek de vídeo.** A documentação 5.2 permite configurar conclusão por visualização, nota ou marcação manual; o aluno vê uma lista “To do” com o que falta. O índice do curso sinaliza atividades completas. Essas páginas não especificam como um player contabiliza saltos ou cobertura de vídeo. [MoodleDocs 5.2: Activity completion](https://docs.moodle.org/502/en/Activity_completion) · [MoodleDocs 5.2: Using Activity completion](https://docs.moodle.org/502/en/Using_Activity_completion)

- **Uma integração opcional FastPix para Moodle documenta cobertura assistida, não posição do playhead.** O plugin permite definir um limiar percentual, mostra um indicador de progresso e um marcador “Completed”; a conclusão usa segundos únicos assistidos, deduplicados. Arrastar o playhead até o fim não conclui, e avançar sobre conteúdo não assistido não credita esses segundos. É um contrato de um plugin mantido pela FastPix, não do Moodle core. Além disso, cobertura pode acumular trechos fora de ordem; portanto, não equivale à fronteira linear contínua adotada pelo Hub. [FastPix: Set up the Moodle activity plugin](https://fastpix.com/docs/moodle/mod-plugin) · [MoodleDocs: mod_fastpix, maintainer FastPix Inc.](https://docs.moodle.org/502/en/mod_fastpix)

- **Teachable documenta seek e conclusão automática, mas não sua interação.** O guia permite avançar ou retroceder dez segundos pelas setas; uma opção de autocomplete marca a aula quando o último vídeo termina. Para seções sequenciais, o guia diz que é preciso ver o vídeo inteiro. Não esclarece se avançar por seek satisfaz o autocomplete, nem como a cobertura é computada. [Teachable Help Center: Navigate and View Course Content](https://support.teachable.com/en/articles/11682425-navigate-and-view-course-content)

## Inferências e opções para o Hub

O contrato local já distingue posição de retomada, posição máxima observada, fronteira linear validada e tempo reproduzido. Um seek à frente não avança a fronteira validada; reprodução fora de ordem ainda pode entrar no tempo de analytics; conclusão automática exige fronteira validada em 100%, enquanto a conclusão manual continua disponível. Essa regra vem do [guia de domínio de aprendizagem e progresso](../docs/domain/learning-content-and-progress.md) e do [ADR-0012](../docs/adr/0012-linear-validated-video-progress.md).

1. **Manter a regra junto ao player enquanto ela for relevante.** A orientação sobre como satisfazer conclusão é requisito para a tarefa e pode ser necessária após um seek. Uma mensagem inline ou texto persistente próximo ao indicador de conclusão é mais adequada do que depender de toast que desaparece. Exemplo de cópia: “Para concluir automaticamente, reproduza os trechos em ordem. Pular para frente não valida o intervalo. Você também pode concluir a Aula manualmente.” A forma exata é proposta, não conteúdo prescrito pelas fontes.

2. **Separar posição atual de progresso validado.** Se o player pula para 08:00, o indicador de conclusão não deve sugerir que os minutos anteriores foram validados. Exibir a posição atual para retomada e a fronteira validada para conclusão como conceitos distintos reduz a ambiguidade. Evitar dizer que o trecho reproduzido após o seek “não conta para nada”: no contrato do Hub, esse tempo pode entrar em analytics, embora não libere a conclusão automática.

3. **Após um seek relevante, dar feedback sem tirar o foco.** Uma mensagem visível e contextual pode explicar que o salto não validou o intervalo e indicar de onde a reprodução precisa continuar. Para a atualização dinâmica, role="status"/aria-live="polite" é uma opção coerente com a técnica W3C; anúncio assertivo e foco forçado não parecem proporcionais a um seek comum. Agrupar ou limitar anúncios repetidos é uma inferência apoiada pela orientação WAI/Carbon contra interrupções frequentes.

4. **Reservar toast/snackbar para confirmação curta e recuperável.** Por exemplo, confirmação de posição salva pode ser transitória. Não usar esse formato como único lugar para explicar a regra de conclusão ou o próximo passo, pois a informação some antes de o aluno poder consultá-la novamente.

5. **Usar texto além de cor.** Rótulos como “Trecho validado”, “Pendente para conclusão automática” e “Aula concluída” permitem distinguir estados sem depender apenas de verde, cinza ou vermelho; formas/ícones podem complementar, nunca substituir o texto.

## Limites da pesquisa

- Não há base nesta amostra para dizer o que “a maioria dos LMS” faz. Canvas e Moodle core documentam estado de curso/atividade, mas não a semântica de seek para conclusão de vídeo.
- A página oficial da Panopto intitulada [How to Disable Variable Speed Playback and Seek](https://support.panopto.com/s/article/How-to-Disable-Variable-Speed-Playback-and-Seek) foi localizada, mas a leitura falhou com erro HTTP 502 nesta consulta. Não foi usada para afirmar como Panopto computa progresso.
- Não localizei, nesta rodada, uma página pública oficial da Coursera que esclareça a relação entre seek e progresso/conclusão de vídeo. Isso não prova que tal documentação não exista.
- O exemplo FastPix é um plugin de fornecedor para Moodle e usa cobertura percentual; não deve ser apresentado como padrão nativo do Moodle nem como evidência de prática geral de mercado.

## Fontes e datas

Todas as páginas abaixo foram acessadas em **23/09/2026**. Datas de revisão são incluídas quando exibidas pela fonte.

- [WAI: Understanding SC 4.1.3 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) — atualizado em 11/05/2026.
- [WAI: ARIA22, role=status](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA22.html) — atualizado em 12/01/2026.
- [WAI-ARIA APG: Alert Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/alert/) — sem data de atualização visível.
- [WAI: Understanding SC 1.4.1 Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html) — atualizado em 16/09/2025.
- [Carbon: Notification usage](https://carbondesignsystem.com/components/notification/usage/) e [Notification pattern](https://carbondesignsystem.com/patterns/notification-pattern/) — página de uso indica última atualização em 23/09/2026.
- [Android Developers: Snackbar](https://developer.android.com/develop/ui/compose/components/snackbar) — atualizado em 22/09/2026.
- [Adobe Spectrum: Toast](https://spectrum.adobe.com/page/toast/) — versão 6.0.0; histórico indica 06/04/2022.
- [Instructure: View Modules as a student](https://community.instructure.com/en/kb/articles/661313-how-do-i-view-modules-as-a-student) e [Studio Insights](https://community.instructure.com/en/kb/articles/660525-how-do-i-use-the-canvas-studio-insights-page) — sem data de revisão visível.
- [MoodleDocs 5.2: Activity completion](https://docs.moodle.org/502/en/Activity_completion) — editado em 18/06/2026; [Using Activity completion](https://docs.moodle.org/502/en/Using_Activity_completion) — editado em 19/06/2026.
- [FastPix: Moodle activity plugin](https://fastpix.com/docs/moodle/mod-plugin) e [MoodleDocs: mod_fastpix](https://docs.moodle.org/502/en/mod_fastpix) — sem data de revisão visível.
- [Teachable Help Center: Navigate and View Course Content](https://support.teachable.com/en/articles/11682425-navigate-and-view-course-content) — sem data de revisão visível.
- [Panopto Support: Disable Variable Speed Playback and Seek](https://support.panopto.com/s/article/How-to-Disable-Variable-Speed-Playback-and-Seek) — tentativa de acesso em 23/09/2026 retornou HTTP 502; conteúdo não verificado.
