# Pesquisa: posição máxima do vídeo versus cobertura real assistida

> Nota de pesquisa, 12/09/2026. Esta nota não é decisão de produto nem autorização para alterar o schema. As URLs abaixo são documentação, especificação ou código oficial do responsável pela tecnologia consultada.

## Pergunta

O NeuroCapacitar Hub deve continuar usando a maior posição alcançada como
percentual de vídeo, ou deve migrar para uma métrica de cobertura real? Como a
retomada deve funcionar quando o Aluno volta à Aula? Quais limites existem nas
informações recebidas do navegador e do player JMVStream?

## Conclusão executiva

O achado A03 é correto, mas há três problemas diferentes sendo tratados como se
fossem um só:

1. **Retomada**: em que segundo o vídeo deve reabrir.
2. **Tempo de reprodução**: quanto tempo o player ficou avançando.
3. **Cobertura**: quais partes da linha do tempo foram reproduzidas pelo menos
   uma vez.

`max_position_seconds` responde apenas à pergunta "qual foi o ponto mais à
frente observado?". É útil como indicador simples e pode ajudar a mostrar um
avanço aproximado, mas não comprova que o trecho entre o início e esse ponto
foi reproduzido. Um salto de 30 para 950 segundos produz exatamente o falso
positivo descrito no relatório.

Não recomendo substituir `max_position_seconds` por `watch_time_seconds` e
chamar isso de cobertura. Tempo acumulado pode contar o mesmo trecho várias
vezes e pode incluir tempo de inicialização, busca ou rebuffering, dependendo da
definição adotada. A documentação do Mux faz essa distinção explicitamente:
`Watch Time` é tempo cumulativo da tentativa de assistir, enquanto `Playing
Time` exclui busca, rebuffering e pausa. [Mux: definição de métricas](https://www.mux.com/docs/guides/understand-metric-definitions)

Se o produto precisa apenas permitir que o Aluno continue a Aula e marque a
conclusão manualmente, manter a posição máxima é viável, desde que o nome e a
interface não prometam "percentual assistido". Se o produto precisa afirmar
que partes do vídeo foram vistas para liberar conclusão automática, certificado
ou uma obrigação regulatória, a métrica correta é uma cobertura por intervalos.
Mesmo assim, ela será uma evidência técnica de reprodução, não uma prova de
atenção humana.

Minha recomendação para o Hub é **não remover a posição máxima agora**. Mantê-la
como dado compatível e separado da retomada; corrigir a nomenclatura; preservar
conclusão manual; e só adicionar cobertura real depois de validar o contrato do
JMVStream em player real. A própria documentação oficial de eventos do JMVStream
é marcada como referência antiga e informa `currentTime`, `duration` e eventos,
mas não define que o percentual resultante seja cobertura única do vídeo.
[JMVStream: eventos do player](https://jmvstream.com/pt-br/developer/eventos-do-player)

## 1. Conceitos que não devem ser misturados

### 1.1 Playhead, posição atual e posição de retomada

O playhead é o cursor atual do vídeo. Em um elemento HTML, `currentTime`
representa a posição oficial de reprodução e também pode ser definido para
fazer seek. A especificação HTML distingue a posição de reprodução da ação de
buscar outro ponto e descreve os eventos `seeking` e `seeked` durante essa
operação. [WHATWG HTML: `currentTime` e seeking](https://html.spec.whatwg.org/multipage/media.html#dom-media-currenttime)

Essa posição muda tanto quando o vídeo avança normalmente quanto quando o
Aluno arrasta a barra, usa um comando de salto ou o próprio sistema restaura a
reprodução. Portanto:

- `currentTime = 950` significa que o cursor está em 950 segundos;
- não significa que os segundos 30 a 949 foram reproduzidos;
- não significa que o Aluno estava olhando para a tela;
- não significa que o servidor recebeu todos os eventos anteriores.

A posição de retomada é um **snapshot operacional**. Ela deve responder:
"onde o Aluno estava quando o último checkpoint confiável foi salvo?". Em uma
retomada normal, o valor adequado é o último `current_seconds` salvo, por
exemplo o ponto de uma pausa ou o último checkpoint periódico.

No código atual do Hub, o servidor devolve `current_seconds` e o cliente envia
um comando `jmvplayer-jump` usando essa posição. Isso é conceitualmente correto
para retomada. O valor de `max_position_seconds` não deve ser usado como
substituto silencioso: se o Aluno assistiu até 30, saltou para 950 e fechou a
página, reabrir em 950 faria o Aluno perder a possibilidade de continuar do
ponto em que efetivamente estava.

**Regra recomendada:**

- retomada usa a última posição atual confiável;
- posição máxima fica disponível para análise ou indicação aproximada;
- cobertura, se existir, é calculada separadamente;
- um dado antigo que só tenha posição máxima pode ser usado como fallback de
  compatibilidade, mas deve ser tratado como posição aproximada, não como prova
  de cobertura.

### 1.2 Watch time e playing time

Tempo de reprodução é uma medida de duração, não de localização. O Mux define
`Playing Time` como o tempo em que conteúdo está efetivamente sendo reproduzido,
excluindo rebuffering, seeking e pausa. Já `Watch Time` inclui reprodução,
inicialização, rebuffering e seeking, e pode contar novamente um trecho quando
há rewind. O Mux também explica que assistir em velocidade 2x reduz o Watch
Time porque a medida acompanha o tempo transcorrido, não a duração do conteúdo
consumido. [Mux: Viewer Engagement](https://www.mux.com/docs/guides/data-engagement-metric)

Exemplo:

- vídeo de 10 minutos;
- Aluno assiste os primeiros 2 minutos;
- volta e assiste esses mesmos 2 minutos novamente;
- depois assiste do minuto 8 ao 10.

O tempo reproduzido pode chegar a 6 minutos, mas a cobertura única é 40%:
intervalos cobertos de 0 a 2 e de 8 a 10. Nenhuma das duas métricas é
intercambiável com a outra.

O tempo também pode ser uma métrica útil para analytics administrativo, como
"quanto tempo os Alunos passaram no conteúdo". Ele não é adequado, sozinho,
para a pergunta "o Aluno passou por todos os trechos?".

### 1.3 Viewed ranges e cobertura por união de intervalos

O elemento HTML expõe `HTMLMediaElement.played`, um objeto `TimeRanges` com os
intervalos que o agente de usuário considera reproduzidos. Isso é diferente de
`buffered`, que representa dados carregados, e de `seekable`, que representa
posições para as quais é possível buscar. [WHATWG HTML: `played`, `buffered` e `seekable`](https://html.spec.whatwg.org/multipage/media.html#dom-media-played)

Uma cobertura simples pode ser calculada assim:

1. coletar os intervalos reproduzidos;
2. unir intervalos sobrepostos ou muito próximos;
3. dividir a soma dos intervalos unidos pela duração oficial do vídeo;
4. limitar o resultado entre 0 e 100%.

Se os intervalos forem `[0, 120]`, `[115, 180]` e `[480, 600]`, a união é
`[0, 180]` e `[480, 600]`, totalizando 300 segundos. Não se deve somar 120 +
65 + 120, porque isso contaria a sobreposição duas vezes.

Há limites importantes:

- `played` só pode ser lido diretamente quando o código controla o elemento de
  mídia; em um iframe de outro domínio, a política de mesma origem impede o
  acesso ao elemento interno;
- o valor descreve reprodução observada pelo agente de usuário, não atenção,
  entendimento ou presença diante da tela;
- o objeto é uma fotografia local no instante da leitura, não um registro
  persistido pelo servidor;
- a especificação não transforma esse dado em uma política de conclusão de
  curso.

Os três últimos pontos são aplicação da semântica da especificação ao produto,
portanto são inferências de engenharia, não promessas da API HTML.

## 2. O que os players oficiais realmente oferecem

### 2.1 YouTube IFrame Player API

A API oficial do YouTube documenta:

- `getCurrentTime()` para obter o tempo transcorrido em segundos;
- `seekTo()` para mover o player a um ponto;
- estados como playing, paused, buffering e ended;
- eventos de mudança de estado.

[YouTube IFrame Player API Reference](https://developers.google.com/youtube/iframe_api_reference)

O contrato consultado não documenta, na API IFrame, uma propriedade de
intervalos individuais assistidos nem um mecanismo de persistência por Aluno.
Isso não prova que nenhuma camada interna do YouTube possua analytics de
retenção; apenas significa que o embed não deve ser tratado como fonte de uma
API de cobertura individual. A recomendação oficial de `seekTo` confirma que
seek é uma operação de mudança de posição, não um evento de visualização
completa.

Na API de Analytics, o YouTube separa métricas agregadas como duração média,
percentual médio e retenção por segmentos. A própria definição de retenção
admite que uma parte pode ser vista mais de uma vez e que o valor pode superar
1 em determinados relatórios. [YouTube Analytics: métricas](https://developers.google.com/youtube/analytics/metrics)

**Fato documentado:** o embed fornece posição, seek e estado.

**Inferência não permitida:** converter `getCurrentTime()` em cobertura ou
tratar `onStateChange = ended` como prova de que todos os trechos foram vistos.

### 2.2 Vimeo Player SDK

O SDK oficial mantido no repositório da organização Vimeo documenta:

- `getCurrentTime()` como posição atual em segundos;
- `setCurrentTime()` como seek;
- `timeupdate`, normalmente a cada 250 ms, com variação conforme o player;
- `seeking` e `seeked`;
- `progress` como quantidade carregada/buffered, não como quantidade assistida.

[Vimeo Player SDK: repositório oficial e referência](https://github.com/vimeo/player.js/blob/master/README.md)

Essa distinção entre `progress` e `timeupdate` é especialmente importante:
usar progresso de carregamento para concluir uma Aula confundiria download com
reprodução. O SDK oferece os sinais necessários para um aplicativo manter sua
própria posição e seu próprio cálculo, mas a referência consultada não promete
persistência de progresso por usuário nem um vetor de segundos únicos
assistidos.

**Fato documentado:** há posição atual, eventos de tempo e eventos explícitos
de seek.

**Inferência não permitida:** `timeupdate` isolado não prova que nenhum salto
ocorreu entre duas amostras nem que o intervalo foi recebido pelo servidor.

### 2.3 Mux Player e Mux Data

O Mux Player para Web expõe os eventos do elemento HTML5 e recomenda o evento
`timeupdate` para acompanhar o quanto de um vídeo está sendo visto. A própria
documentação também diz que os eventos não ficam disponíveis quando se usa o
embed HTML via `player.mux.com`, diferença que afeta a arquitetura possível.
[Mux Player: uso avançado e eventos](https://www.mux.com/docs/guides/player-advanced-usage)

O Mux Data é mais explícito sobre analytics:

- uma View representa uma tentativa de reproduzir;
- pausar e retomar em até 60 minutos pode permanecer na mesma View;
- seeking e looping podem fazer o mesmo vídeo ser visto várias vezes em uma
  View;
- `Playing Time` e `Content Playing Time` são baseados no avanço do playhead e
  excluem pausa, busca e, conforme a métrica, rebuffering;
- o SDK é client-side e pode ser bloqueado por ad blockers.

[Mux: definição de Views e Watch Time](https://www.mux.com/docs/guides/understand-metric-definitions)

O Mux demonstra um padrão de analytics de alta qualidade, com eventos de
reprodução, estado e playhead, mas não afirma que `Playing Time` seja cobertura
única nem que possa ser usado como certificado acadêmico. O fato de o Mux
agrupar sessões e expor métricas de engajamento não elimina a necessidade de o
Hub definir sua própria regra de conclusão.

**Fato documentado:** o Mux separa posição, tempo reproduzido, tempo de
tentativa e qualidade de experiência.

**Inferência não permitida:** adotar uma métrica de analytics do Mux como se
fosse automaticamente uma prova de cobertura para o Hub.

### 2.4 Wistia

O Wistia fornece a evidência oficial mais próxima do conceito de cobertura
única entre as fontes consultadas:

- `secondsWatched()` retorna o número de segundos únicos assistidos e não inclui
  segundos pulados por seeking;
- `percentWatched()` é calculado a partir desses segundos e da duração;
- `secondsWatchedVector()` permite saber quantas vezes cada segundo foi visto e
  localizar trechos não vistos ou revistos;
- a própria documentação informa que esses métodos não funcionam em embeds por
  iframe.

[Wistia JavaScript Player API: `secondsWatched` e vetor](https://docs.wistia.com/docs/javascript-player-api)

O player Aurora também documenta eventos de `time-update`, `seeking`, `seeked` e
`percent-watched-change`. [Wistia: eventos do player](https://docs.wistia.com/docs/player-events)

**Fato documentado:** um player pode oferecer contagem de segundos únicos e um
vetor de visualização.

**Limite prático:** essa capacidade não está disponível pelo método de iframe
descrito na própria documentação, e o Wistia não define que "percent watched"
seja suficiente para uma política de certificado de terceiros.

### 2.5 JMVStream, o provider atual do Hub

A documentação oficial antiga do JMVStream documenta o envio de
`jmvplayer-sync` e eventos OUT com `currentTime`, `duration`, `paused` e o nome
do evento. Também documenta eventos de play, pause, skip, status e end.
[JMVStream: eventos do player](https://jmvstream.com/pt-br/developer/eventos-do-player)

O documento é expressamente marcado como referência antiga. A documentação
Pública atual da API é voltada principalmente a vídeos, galerias, upload e
operações do serviço, não a uma definição de cobertura individual no player.
[JMVStream: Public API](https://jmvstream.com/en/developer)

No Hub, o evento é tratado como entrada não confiável, sua origem é validada e
a duração persistida na Aula é usada como autoridade. Isso é uma boa fronteira
de segurança. Ainda assim, o contrato consultado não comprova que:

- `currentTime` exclua seeks;
- `status` represente somente avanço contínuo;
- `end` garanta que os intervalos anteriores chegaram ao sistema;
- o player ofereça ranges ou um vetor de segundos únicos;
- um evento recebido pelo parent window seja prova de atenção.

## 3. Riscos de confiar somente em eventos do navegador

### 3.1 `timeupdate` não é um relógio de auditoria

A especificação HTML limita a frequência de `timeupdate`: durante avanço normal,
o agente de usuário pode aguardar entre 15 e 250 ms conforme o estado do loop e
dos handlers. O evento é rate-limited e não representa cada frame. [WHATWG HTML: algoritmo de `timeupdate`](https://html.spec.whatwg.org/multipage/media.html#event-media-timeupdate)

Consequências:

- dois eventos podem estar separados por um intervalo maior que o esperado;
- uma queda de evento pode criar um buraco aparente na cobertura;
- assumir que cada diferença de `currentTime` foi reprodução contínua pode
  contar um seek como tempo visto;
- enviar uma requisição para cada evento sobrecarrega o servidor sem melhorar a
  certeza proporcionalmente.

O player também pode emitir um `timeupdate` depois de uma operação de seek. A
sequência `seeking`, mudança de posição, `seeked` e `timeupdate` precisa ser
interpretada, não apenas somada.

### 3.2 O fechamento da página pode perder o último evento

Não é seguro depender de `unload` ou de uma promessa assíncrona comum para
salvar o último checkpoint. A especificação do ciclo de vida HTML admite que
`unload` só ocorra em determinadas condições. A documentação do Chrome explica
que o estado de término pode não ser detectado de forma confiável, sobretudo em
dispositivos móveis, e recomenda tratar `visibilitychange` como oportunidade
mais confiável para salvar estado. [Chrome: Page Lifecycle API](https://developer.chrome.com/docs/web-platform/page-lifecycle-api)

O Beacon API existe para enviar pequenos dados sem bloquear a navegação e é
disparado de forma apropriada quando a página passa a `hidden`. Porém, `true` em
`sendBeacon()` significa apenas que o navegador colocou o pedido na fila; não
confirma que o servidor o recebeu. O API também não oferece callback, não é fila
offline e tem limite de payload. [W3C: Beacon](https://www.w3.org/TR/beacon/)

Portanto, o último checkpoint deve ser salvo **antes** do encerramento, em
intervalos regulares e em eventos de pausa/visibilidade. Beacon ou Fetch com
`keepalive` é uma última tentativa de transporte, não uma garantia de
persistência.

### 3.3 O navegador e o cliente podem ser adulterados

Qualquer valor enviado pelo navegador pode ser alterado antes de chegar ao
servidor. Um aluno pode fabricar `currentTime`, `duration`, nome de evento ou
percentual. Mesmo sem má-fé, extensões, automações, múltiplas abas, replay de
mensagens, mudanças de velocidade, buffering e bugs do provider podem produzir
sequências inesperadas.

Isso não torna o tracking inútil. Significa que o servidor deve:

- validar origem e formato;
- usar duração persistida, não a duração declarada pelo cliente;
- rejeitar eventos desconhecidos e posições impossíveis;
- separar sinal de reprodução de autorização para conclusão;
- aplicar idempotência e operações monotônicas apenas onde monotonicidade faz
  sentido;
- manter a conclusão manual como caminho de correção e suporte.

## 4. Persistência, retomada e idempotência

### 4.1 Quatro dados diferentes

Um desenho mais claro para evolução futura teria quatro conceitos, mesmo que
alguns continuem na mesma tabela inicialmente:

1. `resume_position_seconds`: último checkpoint de posição para reabrir o vídeo.
2. `max_position_seconds`: maior posição observada, sem alegar cobertura.
3. `playing_time_seconds`: tempo acumulado em que o player efetivamente avançou,
   podendo contar reprises.
4. `coverage_ranges` ou uma projeção equivalente: união dos intervalos
   reproduzidos ao menos uma vez.

No schema atual, `current_seconds` cumpre aproximadamente a primeira função e
`max_position_seconds` cumpre a segunda. `watched_percent` é o nome mais
perigoso, pois sugere cobertura, mas hoje é calculado a partir da maior posição.
Enquanto a semântica não mudar, o campo deve ser tratado como percentual de
posição máxima, não como percentual assistido.

### 4.2 Retomada após pausa, troca de aba ou fechamento abrupto

Fluxo recomendado:

1. ao iniciar, carregar a última posição salva;
2. depois de confirmar que o player está pronto, restaurar essa posição uma vez;
3. durante reprodução, salvar checkpoints em uma cadência moderada, por exemplo
   a cada 10 segundos ou em avanço mínimo relevante;
4. ao pausar, buscar o ponto atual e salvar imediatamente;
5. ao `visibilitychange` para `hidden`, tentar salvar o último ponto conhecido
   com transporte de encerramento;
6. ao voltar, continuar do checkpoint confirmado pelo servidor;
7. não mover o Aluno para `max_position_seconds` apenas porque é maior.

Se o fechamento ocorreu entre dois checkpoints, o sistema pode perder alguns
segundos. Esse é um trade-off normal entre frequência de gravação, custo,
bateria e precisão. Salvar a posição máxima não corrige essa perda; apenas pode
produzir uma retomada à frente do ponto realmente acompanhado.

### 4.3 Idempotência e concorrência

O Hub já usa uma linha única por Aluno e Aula e faz upsert do progresso. Isso
evita duplicar a linha quando o mesmo evento é repetido. Porém, há uma diferença
entre "não duplicar a linha" e "não corromper a ordem".

Exemplo de risco: uma requisição com posição 80 demora na rede e chega depois de
uma requisição com posição 100. Se a atualização de `current_seconds` aceitar
cegamente a última requisição recebida, a retomada pode voltar para 80. Para a
posição atual, a maior posição não é sempre a resposta correta, porque o Aluno
pode ter voltado voluntariamente. É necessário distinguir:

- posição mais recente por sequência de sessão;
- posição máxima histórica;
- intervalos cobertos.

Padrão recomendado para uma futura implementação:

- gerar um `session_id` por abertura do player;
- gerar um contador de sequência no cliente para checkpoints da mesma sessão;
- aceitar cada evento no máximo uma vez por chave de idempotência;
- comparar sequência somente dentro da sessão, sem confiar no relógio do
  cliente;
- usar o servidor para registrar o instante de recebimento;
- fazer merge de cobertura como união, operação naturalmente idempotente;
- manter uma projeção resumida para leitura rápida e, se a exigência justificar,
  um registro de eventos suficiente para reconstrução.

Para cobertura, uma linha única com `GREATEST` não basta. O merge correto deve
unir intervalos. Reprocessar o mesmo intervalo não pode aumentar a cobertura;
reprocessar dois intervalos sobrepostos também não pode contá-los duas vezes.

### 4.4 O que não deve ser feito

- Não usar `buffered` ou `progress` como prova de visualização.
- Não usar `end` como prova automática de cobertura sem validar a política.
- Não calcular cobertura somando diferenças de posição sem separar seeks.
- Não confiar em `unload` como único salvamento.
- Não aceitar a duração do navegador para alterar o denominador oficial.
- Não converter silenciosamente o histórico de `watched_percent` em cobertura.
- Não apagar `max_position_seconds` antes de entender consumidores, analytics e
  dados existentes.

## 5. Viabilidade das alternativas

### Alternativa A: manter posição máxima, com semântica honesta

**Viabilidade:** alta. **Custo:** baixo. **Risco:** baixo se a conclusão manual
continuar sendo a autoridade.

Manter `current_seconds`, `max_position_seconds` e a retomada atual. Renomear
conceitualmente `watched_percent` para percentual de posição máxima em código,
documentação e analytics futuros. A interface pode mostrar "progresso do vídeo"
somente se ficar claro que é aproximação; para certificado, usar `lesson_progress`
manual, como já ocorre no Hub.

Vantagens:

- não exige migration estrutural;
- preserva dados e comportamento existentes;
- funciona com JMVStream iframe;
- é simples de testar e operar;
- não cria falsa sensação de precisão se for nomeado corretamente.

Desvantagens:

- um seek para frente ainda infla a métrica;
- não permite afirmar quais trechos foram vistos;
- analytics de percentual continuará limitado.

### Alternativa B: substituir tudo por tempo assistido

**Viabilidade:** média. **Recomendação:** não adotar como substituto de
cobertura.

É possível acumular segundos de reprodução entre eventos de play/pause/status,
mas isso mede esforço temporal, não trechos únicos. Rewind pode contar duas
vezes; velocidade alterada muda a relação entre tempo de relógio e conteúdo; e
buffering precisa de uma definição explícita. Essa alternativa é boa para
analytics de engajamento, não para liberar certificado.

### Alternativa C: adicionar cobertura real por intervalos

**Viabilidade conceitual:** alta em um `<video>` controlado diretamente.
**Viabilidade atual com JMVStream iframe:** não comprovada. **Custo:** médio a
alto. **Risco:** médio a alto até validar o provider.

O algoritmo é conhecido: registrar apenas avanço contínuo, ignorar o intervalo
de seek, unir ranges e calcular a fração coberta. O problema não é a soma dos
intervalos; é obter intervalos suficientemente confiáveis do player e persistir
sem perder eventos.

Com o JMVStream atual, a documentação pública consultada não garante que o
parent window receba ranges nem um sinal contínuo capaz de distinguir todo seek
de todo avanço. Antes de migration, seria necessário um teste controlado no
player real para observar:

- frequência e perda de `status`;
- sequência exata de play, pause, skip, seek e end;
- comportamento após `jmvplayer-jump` de retomada;
- eventos durante buffering e troca de aba;
- se `currentTime` salta diretamente após seek;
- se o iframe continua enviando eventos quando a página fica oculta;
- se o player fornece alguma API oficial de ranges ou segundos únicos.

Sem essa validação, implementar ranges no servidor a partir de `currentTime`
seria apenas trocar uma aproximação por outra mais complexa.

### Alternativa D: cobertura híbrida por provider

**Viabilidade:** alta como arquitetura de longo prazo. **Custo:** alto.

Cada provider pode fornecer uma capacidade diferente. Um player direto poderia
usar `played`; Wistia oferece segundos únicos no embed não-iframe; JMVStream pode
ficar inicialmente com posição máxima; outro provider pode fornecer apenas
tempo reproduzido. Isso exige que o domínio declare a qualidade da evidência,
em vez de fingir que todos os percentuais têm a mesma origem.

É uma boa arquitetura para uma plataforma multi-provider, mas não é necessário
para resolver o problema imediato do Hub.

## 6. Melhores práticas deduzidas das fontes oficiais

As fontes não apresentam uma norma única para plataformas LMS. Elas convergem,
porém, em padrões importantes:

- separar posição atual, seek, estado do player, tempo reproduzido e cobertura;
- tratar eventos como sinais amostrados, não como log perfeito de cada frame;
- distinguir buffer carregado de conteúdo reproduzido;
- persistir retomada fora do provider quando a experiência precisa continuar em
  outro dispositivo;
- fazer a gravação no servidor ser idempotente;
- tolerar repetição, perda, atraso e reordenação de mensagens;
- usar pausa, visibilidade e checkpoints periódicos, sem depender apenas do
  encerramento da página;
- manter a duração oficial no servidor;
- evitar usar métrica de analytics diretamente como autorização de negócio;
- preservar um caminho manual para correção, suporte e casos em que o tracking
  falha.

O Beacon API reforça que envio no encerramento é assíncrono e sem confirmação.
O Mux reforça que métricas client-side dependem do player e podem ser bloqueadas.
O Wistia mostra que cobertura por segundos únicos é possível, mas também expõe
limitação explícita em iframe. Em conjunto, isso sugere que a melhor prática é
usar uma cadeia de evidências com níveis claros, não um único `percent`.

## 7. Recomendações específicas para o NeuroCapacitar Hub

### Decisão recomendada agora

1. **Não marcar A03 como resolvido.** O diagnóstico continua válido.
2. **Não remover `max_position_seconds`.** Ele tem valor para retomada
   aproximada, analytics e compatibilidade histórica, desde que não seja
   apresentado como cobertura.
3. **Não usar `max_position_seconds` para retomar por padrão.** Retomar de
   `current_seconds`, ou do último checkpoint confiável.
4. **Não substituir por tempo acumulado.** Se for criado, deve receber nome e
   uso próprios.
5. **Não liberar certificado com base na métrica atual.** A conclusão manual e
   as regras de `lesson_progress` devem permanecer a autoridade.
6. **Registrar no domínio a distinção entre posição máxima, tempo reproduzido e
   cobertura.** O campo `watched_percent` não deve ganhar semântica nova sem
   migration, inventário e decisão explícita.

### Próximo sprint seguro, sem migration

- validar com testes unitários que retorno normal usa `current_seconds`;
- testar concorrência e requisições atrasadas para não regredir a retomada de
  uma sessão mais nova;
- conferir que `max_position_seconds` nunca libera conclusão sozinho;
- manter a limitação de 98% como posição máxima apenas enquanto essa for a
  política atual;
- executar teste controlado contra player JMVStream real, sem dados de alunos e
  sem alterar vídeos Production;
- registrar a sequência observada e obter confirmação do contrato do provider.

### Se a decisão futura for cobertura real

Implementar em fases:

1. aprovar política de produto: seek conta ou não, velocidade, mute, replay,
   buffering, aba em segundo plano e tolerância de lacunas;
2. validar a capacidade do JMVStream ou escolher um player com ranges oficiais;
3. criar um modelo separado para intervalos e uma projeção `coverage_percent`;
4. adicionar `session_id`, sequência e idempotência;
5. manter `resume_position_seconds` e `max_position_seconds` separados;
6. testar pausa, seek, rewind, duas abas, rede lenta, reload, mobile e perda de
   eventos;
7. executar a nova métrica em paralelo, sem alterar certificado;
8. comparar resultados reais e só depois decidir se o percentual de cobertura
   terá efeito na conclusão automática.

## 8. Respostas objetivas às dúvidas centrais

### Quando o Aluno volta, deve retornar ao ponto máximo ou ao ponto marcado?

Ao último ponto atual confiável salvo. Se ele parou no segundo 30, deve voltar
próximo do segundo 30, mesmo que tenha saltado anteriormente para o segundo 950.
Se o fechamento abrupto impediu o último salvamento, volta ao último checkpoint
periódico confirmado, não automaticamente ao ponto máximo.

### Devemos abandonar `max_position_seconds`?

Não agora. Devemos abandonar a interpretação de que ele representa cobertura.
O campo pode continuar como high-water mark. Em uma evolução maior, o nome
externo pode mudar para `max_position_percent`, enquanto um campo novo e
independente representa cobertura real.

### A cobertura real é viável?

Sim, como algoritmo e modelo de dados. Com o JMVStream iframe atual, a
viabilidade operacional ainda não está provada. Sem um contrato mais forte do
provider, o resultado seria uma estimativa baseada em amostras de eventos.

### O que outros players fazem?

As fontes oficiais mostram abordagens diferentes:

- YouTube e Vimeo expõem posição, seek e eventos para o integrador;
- Mux separa playing time, watch time e métricas de View para analytics;
- Wistia expõe segundos únicos e vetor de visualização em sua API JavaScript,
  mas não no iframe indicado pela documentação;
- JMVStream expõe eventos com `currentTime` e `duration`, sem documentar ranges
  únicos na referência pública consultada.

Não foi encontrada nas fontes oficiais consultadas uma promessa universal de que
um embed de vídeo, por si só, forneça prova individual de cobertura suficiente
para certificado de um LMS externo.

## 9. Fatos, inferências e limites da evidência

### Fatos diretamente afirmados pelas fontes

- HTML define `currentTime`, `played`, `buffered`, `seeking`, `seeked` e
  `timeupdate` com semânticas distintas.
- YouTube documenta posição, seek, estados e eventos no IFrame API.
- Vimeo documenta posição, seek, `timeupdate`, `progress`, `seeking` e
  `seeked`.
- Mux documenta eventos de playhead e separa Watch Time de Playing Time.
- Wistia documenta segundos únicos assistidos e vetor por segundo, com a
  limitação declarada para iframe.
- JMVStream documenta eventos OUT com `currentTime` e `duration`, mas marca a
  página de eventos como documentação antiga.
- Beacon não confirma recebimento no servidor e não fornece armazenamento
  offline.

### Inferências de engenharia usadas nesta análise

- maior posição não prova cobertura do caminho entre início e fim;
- `currentTime` recebido em um evento não prova atenção humana;
- um embed cross-origin não deve ser presumido capaz de expor `played` ao parent;
- checkpoint periódico é necessário para reduzir perda de dados;
- união de intervalos é a forma conceitualmente correta de cobertura única;
- uma métrica de analytics não deve liberar certificado sem regra de domínio
  aprovada.

Essas inferências são consequências práticas das definições oficiais e do
contexto do Hub, não afirmações de que YouTube, Vimeo, Mux, Wistia ou JMVStream
tenham aprovado a política do NeuroCapacitar.

### Limites

- não foi possível confirmar o comportamento do player JMVStream em uma sessão
  real nesta pesquisa;
- a referência oficial de eventos do JMVStream é antiga;
- documentação pública de player não substitui teste de rede, múltiplas abas,
  mobile e perda de conexão;
- nenhuma fonte fornece garantia de atenção ou aprendizagem humana;
- não foi feito backfill nem migration, conforme o escopo solicitado;
- esta nota não decide a política de certificado nem muda o código.

## Fontes oficiais consultadas

- [WHATWG HTML Living Standard: mídia](https://html.spec.whatwg.org/multipage/media.html)
- [WHATWG HTML: `currentTime`](https://html.spec.whatwg.org/multipage/media.html#dom-media-currenttime)
- [WHATWG HTML: `played`, `buffered` e `seekable`](https://html.spec.whatwg.org/multipage/media.html#dom-media-played)
- [WHATWG HTML: `timeupdate`, `seeking` e `seeked`](https://html.spec.whatwg.org/multipage/media.html#event-media-timeupdate)
- [W3C Beacon](https://www.w3.org/TR/beacon/)
- [Chrome for Developers: Page Lifecycle API](https://developer.chrome.com/docs/web-platform/page-lifecycle-api)
- [Google: YouTube IFrame Player API Reference](https://developers.google.com/youtube/iframe_api_reference)
- [Google: YouTube Analytics metrics](https://developers.google.com/youtube/analytics/metrics)
- [Vimeo: player.js, repositório oficial do SDK](https://github.com/vimeo/player.js/blob/master/README.md)
- [Mux: Player advanced usage](https://www.mux.com/docs/guides/player-advanced-usage)
- [Mux: playback events](https://www.mux.com/docs/guides/mux-data-playback-events)
- [Mux: Viewer Engagement](https://www.mux.com/docs/guides/data-engagement-metric)
- [Mux: metric definitions](https://www.mux.com/docs/guides/understand-metric-definitions)
- [Mux: Data FAQs](https://www.mux.com/docs/guides/mux-data-faqs)
- [Wistia: JavaScript Player API](https://docs.wistia.com/docs/javascript-player-api)
- [Wistia: player events](https://docs.wistia.com/docs/player-events)
- [JMVStream: eventos do player](https://jmvstream.com/pt-br/developer/eventos-do-player)
- [JMVStream: Public API](https://jmvstream.com/en/developer)
