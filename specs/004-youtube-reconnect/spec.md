# Feature Specification: Reconexão Sem Descartar o Trabalho (YouTube Reconnect)

**Feature Directory**: `specs/004-youtube-reconnect`

**Feature Branch**: `004-youtube-reconnect` (trabalho em `feat/youtube-reconnect`)

**Created**: 2026-08-07

**Status**: Draft — esclarecimentos resolvidos (sessão 2026-08-07), pronta para `/speckit-plan`

**Input**: User description: "Quando o youtube está desconectado, atualmente o usuário precisa descartar a playlist atual e começar do 0 para pedir o login no youtube. Se por acaso, no momento da primeira busca das músicas no youtube, for retornado algo que revele que o token foi desconectado, deve ser apresentado um modal para o usuário reconectar o youtube, então as buscas devem ser feitas novamente. Também devemos ter algum botão na interface para reconectar o youtube manualmente ao invés de apenas desconectar."

**Convenção de referência**: requisitos das features anteriores aparecem como `001/FR-xxx`, `002/FR-xxx` e `003/FR-xxx`. Requisitos sem prefixo pertencem a este documento.

---

## Contexto — o que acontece hoje

O relato do usuário está correto e o comportamento observável foi verificado. Vale registrar **exatamente** onde a promessa existente é quebrada, porque isso delimita o trabalho.

O sistema **já promete** o que o usuário está pedindo. `002/FR-035` diz que a expiração de sessão pede reautorização preservando o trabalho, e `002/SC-014` mede que nenhuma decisão de revisão é perdida. Os textos da interface para esse caminho **já existem** ("Reconectar ao {serviço}", "Sua autorização do {serviço} expirou. Reconecte para continuar — seu trabalho foi mantido", "Ao reconectar, você volta para: {onde}"). A rotina que preserva o rascunho, encerra apenas a sessão daquele serviço e sinaliza o pedido de reautorização **também já existe**.

O que falha é a costura entre essas peças, em três pontos observáveis. O primeiro foi **verificado por execução** durante o planejamento, e o resultado contrariou a suposição inicial deste documento — a descrição abaixo é a corrigida ([research §1](./research.md)):

1. **A perda de autorização durante a busca é confundida com "música não encontrada", linha por linha.** O isolamento de falha por linha — que existe para que uma linha ruim não derrube as outras — não distingue falha *daquela linha* de falha *da sessão inteira*. Quando a autorização cai, cada linha captura o erro individualmente e vira "Não encontrada", carregando no detalhe da fileira o texto "Autorize o YouTube de novo para continuar". A busca **conclui normalmente** e a execução avança para a revisão. Não há desfecho de falha, a sessão não é encerrada, o pedido de reautorização nunca é registrado, e o cabeçalho continua exibindo a conta como conectada. O usuário chega a uma revisão com todas as linhas "Não encontrada" e nenhum sinal legível de que o problema é a autorização.

2. **Nada na interface oferece reconectar.** A lista de contas do cabeçalho mostra apenas serviços **conectados**, cada um com um botão "Desconectar". Assim que a sessão cai, o serviço some da lista — junto com o único ponto de interação que ele tinha. Os textos de reconexão citados acima nunca são exibidos por tela nenhuma.

3. **A busca não pode ser refeita, e a única saída é destrutiva.** Com a execução já na etapa de revisão, não há como mandar buscar de novo aquele destino. Resta descartar o rascunho e recomeçar do zero — a lista colada, o nome da playlist, a revisão linha a linha e, no caso do YouTube, a cota já gasta.

O caso mais provável é o descrito no pedido: o app é aberto no dia seguinte, o rascunho é restaurado, a sessão do YouTube já venceu, e a **primeira** busca volta com um sinal de autorização inválida. Mas nada no mecanismo é específico da primeira busca — o mesmo acontece na centésima linha.

### Por que o YouTube é o caso de referência, e por que a correção não é só dele

O YouTube usa um fluxo de autorização que, sem servidor próprio, **não renova a sessão em silêncio** — a constituição aceita isso explicitamente e manda tratar a reautorização como comportamento previsto da interface, "nunca como erro". Reautorização periódica no YouTube não é falha: é o funcionamento normal. Hoje ela é tratada como falha terminal, que é precisamente o que a constituição proíbe.

O Spotify renova em silêncio na maior parte do tempo, mas quando a renovação falha (token de renovação revogado, credencial trocada) ele encerra a sessão e registra o pedido de reautorização — e ainda assim **cai no mesmo ponto 1 acima**, com a revisão igualmente poluída de "Não encontrada". O caminho está meio-consertado no Spotify e não-consertado no YouTube. A diferença entre os provedores é a frequência, não o desfecho. Corrigir o mecanismo para os dois é o mesmo trabalho; corrigir só para um exigiria bifurcar por provedor um caminho que hoje é comum — mais código, não menos.

---

## Clarifications

### Sessão 2026-08-07

Duas decisões de escopo foram levantadas e resolvidas. Ambas **ampliam** o pedido original, e a razão de cada ampliação está registrada porque ela justifica trabalho que o pedido literal não pedia.

**Q1 — Linhas já resolvidas quando a autorização cai no meio da busca: preservar e refazer só o restante.**

O pedido dizia "as buscas devem ser feitas novamente", o que sugeriria refazer tudo. A decisão foi contrária ao literal, e o motivo é a cota: refazer a lista inteira cobraria de novo o custo das linhas já pagas, e o consumo real ultrapassaria a estimativa exibida antes de começar. A constituição exige honestidade sobre limites da plataforma e proíbe apresentar ao usuário um custo que não corresponde ao real — refazer tudo obrigaria a spec a admitir que a estimativa é excedida por desenho.

Consequência assumida: a busca precisa entregar **resultado incremental** em vez de tudo-ou-nada. Hoje ela resolve a lista inteira e só então devolve; uma interrupção descarta tudo. Isso é ampliação real de escopo, no caminho de busca compartilhado pelos dois provedores.

**Q2 — A recuperação cobre a fase de criação da playlist, não só a busca.**

O pedido citava explicitamente "no momento da primeira busca". A decisão amplia para a escrita na conta, e o motivo é a consequência: a adição acontece em lotes com índice de confirmação persistido, então perder a autorização no meio deixa uma playlist pela metade na conta do usuário — hoje sem nenhum caminho de recuperação, e com risco de duplicar faixas se ele refizer manualmente. O índice de confirmação que torna a retomada possível **já existe** por exigência do Princípio V; o que falta é o caminho de reautorização chegar até ele.

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Reconectar quando a busca revela sessão perdida (Priority: P1)

O usuário volta ao app no dia seguinte, recupera o rascunho e chega à etapa do YouTube. A busca começa e a primeira resposta do serviço revela que a autorização não vale mais. Em vez de ver a execução do YouTube ser dada como falhada, ele vê um aviso em primeiro plano dizendo que a autorização do YouTube expirou, que nada do trabalho foi perdido e oferecendo reconectar. Ele reconecta, autoriza no serviço e volta ao app exatamente na etapa do YouTube, com a busca recomeçando sozinha.

**Why this priority**: é a dor relatada e a única história que, sozinha, elimina a perda de trabalho no caminho mais frequente. Sem ela, as demais são conveniências.

**Independent Test**: com um rascunho na etapa do YouTube e a busca respondendo autorização inválida na primeira linha, verificar que (a) o aviso em primeiro plano aparece, (b) a execução do YouTube **não** aparece como falhada, (c) após reconectar, a busca recomeça e o rascunho — texto, nome da playlist e decisões de revisão de destinos já concluídos — continua íntegro.

**Acceptance Scenarios**:

1. **Given** a etapa do YouTube na fase de busca e uma sessão inválida, **When** a primeira resposta revela autorização inválida, **Then** um aviso em primeiro plano é exibido pedindo reconexão, a busca é interrompida e a execução do YouTube permanece **retomável**, sem desfecho de falha.
2. **Given** o aviso de reconexão exibido, **When** o usuário aciona "Reconectar", **Then** o rascunho é gravado antes da saída da página e o usuário é levado à autorização do serviço.
3. **Given** o retorno bem-sucedido da autorização, **When** o app recarrega, **Then** ele retoma na etapa do YouTube e a busca daquele destino recomeça sem intervenção.
4. **Given** a autorização cai depois de N linhas já resolvidas, **When** o usuário reconecta, **Then** apenas as linhas ainda não resolvidas são buscadas, e os resultados das N primeiras aparecem na revisão sem terem sido buscados de novo.
5. **Given** um destino anterior já concluído na mesma execução, **When** a sessão do YouTube cai e é reconectada, **Then** o resultado e o relato do destino anterior permanecem inalterados.
6. **Given** o aviso de reconexão do YouTube exibido, **When** ele é atendido, **Then** a sessão e a credencial do Spotify permanecem intactas.

---

### User Story 2 - Reconectar durante a criação, sem duplicar faixas (Priority: P2)

O usuário confirmou a revisão e a playlist começou a ser criada no YouTube. No meio da adição das faixas a autorização vence. Em vez de ficar com uma playlist pela metade na conta e nenhuma saída, ele vê o mesmo aviso de reconexão — agora dizendo quantas faixas já entraram — reconecta, e a adição continua exatamente da faixa seguinte à última confirmada.

**Why this priority**: é o caso de maior consequência real — mexe no que já existe na conta do usuário. Fica abaixo da US1 porque é menos frequente: a janela de escrita é curta comparada à da busca.

**Independent Test**: com a criação em andamento e a autorização caindo após o primeiro lote confirmado, verificar que a playlist criada não é removida, que o aviso informa o que já foi escrito, e que após reconectar a adição retoma sem repetir nenhuma faixa e sem pular nenhuma.

**Acceptance Scenarios**:

1. **Given** a criação em andamento com lotes já confirmados, **When** a autorização cai, **Then** o aviso de reconexão é exibido informando quantas faixas já entraram, e a execução permanece retomável em vez de encerrar como parcial.
2. **Given** a criação interrompida por perda de autorização, **When** o usuário reconecta, **Then** a adição retoma a partir do lote seguinte ao último confirmado — nenhuma faixa é adicionada duas vezes e nenhuma é pulada.
3. **Given** a criação interrompida por perda de autorização, **When** o usuário reconecta, **Then** a playlist já criada na conta **não** é removida nem recriada.
4. **Given** a criação interrompida por perda de autorização, **When** o usuário recarrega a página sem reconectar, **Then** o app retoma na mesma execução com o pedido de reautorização, e o índice de confirmação continua válido.
5. **Given** a criação interrompida por perda de autorização, **When** o usuário opta por não reconectar e encerrar, **Then** o destino é relatado como **parcial**, com a contagem real do que foi escrito.

---

### User Story 3 - Reconectar manualmente, a qualquer momento (Priority: P2)

O usuário percebe que se conectou à conta errada do YouTube, ou simplesmente quer trocar de conta antes de confirmar a criação. Hoje ele só encontra "Desconectar" — e desconectar não oferece nenhum caminho de volta. Ele quer um botão que reconecte diretamente.

**Why this priority**: resolve a segunda metade do pedido e é a saída para quem já ficou preso no estado atual. Depende do mesmo caminho de retomada da US1, mas entrega valor mesmo sem falha nenhuma acontecer.

**Independent Test**: com o YouTube conectado, acionar "Reconectar" no cabeçalho e verificar que o fluxo de autorização é iniciado e o rascunho sobrevive à ida e à volta. Com o YouTube desconectado, verificar que a linha do YouTube continua visível no cabeçalho, oferecendo reconectar.

**Acceptance Scenarios**:

1. **Given** um serviço com credencial salva e sessão ativa, **When** o cabeçalho é exibido, **Then** ele oferece **"Reconectar"** e **"Desconectar"** para aquele serviço.
2. **Given** um serviço com credencial salva e **sem** sessão, **When** o cabeçalho é exibido, **Then** aquele serviço continua listado, identificado como desconectado, oferecendo **"Reconectar"**.
3. **Given** o usuário aciona "Reconectar" com trabalho em andamento, **When** ele retorna da autorização, **Then** o app retoma na mesma etapa e no mesmo serviço, com o rascunho íntegro.
4. **Given** o usuário reconecta a uma conta **diferente** da anterior, **When** ele retorna, **Then** o nome exibido no cabeçalho é o da conta nova, antes de qualquer confirmação de criação.
5. **Given** um serviço sem credencial salva, **When** o cabeçalho é exibido, **Then** aquele serviço não é listado — não há o que reconectar.

---

### User Story 4 - Adiar a reconexão sem perder nada (Priority: P3)

O usuário recebe o aviso de reconexão mas não quer autorizar agora — talvez precise revisar a lista antes, ou trocar de conta. Ele fecha o aviso e o app não fica em um estado sem saída: a etapa daquele serviço mostra o pedido de reautorização com o botão de reconectar, e nada foi descartado.

**Why this priority**: evita que o modal vire uma armadilha modal-ou-nada. É pequeno, mas é a diferença entre "recuperável" e "recuperável se você clicar no lugar certo".

**Independent Test**: exibir o aviso, fechá-lo sem reconectar, e verificar que a etapa do serviço mostra o pedido de reautorização com ação de reconectar, sem desfecho de falha e sem rascunho descartado.

**Acceptance Scenarios**:

1. **Given** o aviso de reconexão exibido, **When** o usuário o fecha sem reconectar, **Then** a etapa daquele serviço exibe o pedido de reautorização com ação de reconectar, e a execução permanece retomável.
2. **Given** a etapa exibindo o pedido de reautorização, **When** o usuário aciona "Pular este serviço", **Then** aquele destino é encerrado como pulado e a fila avança para o próximo, preservando o que já foi feito.
3. **Given** o aviso de reconexão exibido, **When** o usuário recarrega a página sem reconectar, **Then** o app retoma na etapa daquele serviço com o pedido de reautorização, sem perder o rascunho.

---

### Edge Cases

- **Perda de sessão no meio da busca, não na primeira linha**: as linhas já resolvidas foram pagas em cota. Elas são preservadas e não são buscadas de novo (FR-013a a FR-013c).
- **Perda de sessão durante a criação da playlist**, e não durante a busca: parte das faixas pode já estar na conta. Retoma do lote confirmado (FR-027 a FR-031).
- **Reconexão a uma conta diferente da que originou o rascunho**: as decisões de revisão referenciam faixas do catálogo, não da conta, então continuam válidas; mas a checagem de nome de playlist duplicado foi feita contra a conta antiga. FR-015 trata. Se a interrupção foi durante a **criação**, a playlist parcial pertence à conta antiga e a nova conta não a enxerga — FR-031 trata.
- **Credencial removida enquanto o aviso está na tela**: não há como reconectar sem Client ID. FR-016a trata.
- **A própria reconexão falha** (usuário nega consentimento, Redirect URI errado): o erro de autorização precisa aparecer sem desfazer a preservação do trabalho. FR-016 trata.
- **Zero linhas resolvidas antes da queda** (o caso do pedido original): a preservação parcial degrada para o comportamento simples — todas as linhas são buscadas ao retomar, e o custo informado é o da lista inteira.
- **Todas as linhas já resolvidas quando a queda acontece** (falha na última resposta): nada a rebuscar; retomar leva direto à revisão, sem consumir cota.
- **Sessão perdida no primeiro serviço da fila enquanto o segundo ainda nem começou**: reconectar não pode adiantar, reordenar nem iniciar o serviço seguinte.
- **Duas buscas em voo recebem autorização inválida ao mesmo tempo**: um único pedido de reautorização, não dois avisos empilhados.
- **Cancelamento pelo usuário durante a busca coincidindo com a perda de sessão**: cancelamento explícito prevalece; nenhum aviso de reconexão é exibido por algo que o usuário mandou parar.
- **Cota diária do YouTube esgotada e sessão expirada ao mesmo tempo**: cota esgotada encerra o serviço sem repetir (`002/FR-031`); reconectar não daria cota nova. O desfecho de cota prevalece sobre o pedido de reconexão.
- **Serviço sem sessão quando a etapa começa** (e não durante a busca): já é tratado hoje — a etapa abre na fase de conexão. Nenhuma regressão pode ser introduzida aí.

---

## Requirements _(mandatory)_

### Detecção e preservação

- **FR-001**: O sistema MUST tratar qualquer resposta de um serviço que revele autorização inválida ou expirada, recebida durante a busca, como **pedido de reautorização** — e não como falha de execução daquele destino.
- **FR-002**: O sistema MUST NOT atribuir desfecho de falha, nem qualquer outro desfecho terminal, à execução de um destino cuja única causa de interrupção foi perda de autorização. A execução MUST permanecer retomável.
- **FR-003**: Ao detectar perda de autorização, o sistema MUST gravar o rascunho **antes** de qualquer alteração de estado, preservando texto de entrada, nome e configuração da playlist, seleção de destinos, decisões de revisão já tomadas e resultados de destinos já concluídos.
- **FR-004**: A perda de autorização de um serviço MUST NOT afetar a sessão, a credencial nem o resultado de qualquer outro serviço.
- **FR-005**: A perda de autorização MUST NOT remover a credencial (Client ID) do serviço afetado.
- **FR-006**: Buscas em andamento do serviço afetado MUST ser interrompidas ao detectar a perda de autorização, sem emitir novas requisições àquele serviço até que a sessão seja restabelecida.
- **FR-007**: Múltiplas respostas de autorização inválida recebidas na mesma execução MUST produzir **um único** pedido de reautorização.
- **FR-008**: Interrupção causada por cancelamento explícito do usuário MUST NOT ser apresentada como pedido de reautorização.

### Aviso em primeiro plano

- **FR-009**: Ao registrar um pedido de reautorização durante a busca, o sistema MUST exibir um aviso em primeiro plano que interrompe o fluxo, identificando o serviço afetado, afirmando que o trabalho foi preservado e informando de onde a execução será retomada.
- **FR-010**: O aviso MUST oferecer, no mínimo: **reconectar agora** e **fechar sem reconectar**.
- **FR-011**: O aviso MUST ser operável por teclado, com foco movido para dentro dele ao aparecer, foco contido enquanto estiver aberto, fechamento por `Esc`, retorno do foco ao ponto de origem ao fechar, e MUST ser anunciado a leitores de tela como conteúdo que exige atenção.
- **FR-012**: Fechar o aviso sem reconectar MUST deixar a etapa daquele serviço exibindo o mesmo pedido de reautorização com ação de reconectar, e MUST preservar a opção de pular o serviço.
- **FR-013**: Quando o serviço afetado tiver orçamento diário de cota, o aviso MUST informar o custo em cota da retomada, calculado **apenas sobre as linhas ainda não resolvidas**, e MUST deixar claro que o já buscado não será cobrado de novo.

### Preservação parcial da busca (decisão Q1)

- **FR-013a**: A busca MUST preservar o resultado de cada linha já resolvida no momento em que a autorização é perdida. Interrupção por perda de autorização MUST NOT descartar trabalho de busca já pago.
- **FR-013b**: Ao retomar, o sistema MUST buscar **apenas** as linhas ainda não resolvidas daquele destino. Nenhuma requisição MUST ser emitida para linha já resolvida.
- **FR-013c**: O consumo real de cota da execução, somando a tentativa interrompida e a retomada, MUST NOT exceder o que seria consumido por uma execução única e ininterrupta da mesma lista, descontada a reserva de retentativa já contratada por `003/FR-010`.
- **FR-013d**: Os itens preservados MUST manter a ordem original das linhas e MUST chegar à revisão indistinguíveis dos que foram buscados na retomada — inclusive quanto à marcação de duplicidade, que MUST ser recalculada sobre o conjunto completo.
- **FR-013e**: A preservação parcial MUST NOT alterar o comportamento de uma busca que termina sem interrupção, nem o de uma busca cancelada explicitamente pelo usuário.

### Retomada após reconectar

- **FR-014**: Após reconexão bem-sucedida, o sistema MUST retomar na mesma etapa, no mesmo serviço e na mesma fase em que a autorização caiu, e MUST prosseguir sem exigir ação adicional do usuário — buscando as linhas restantes (fase de busca) ou continuando a adição (fase de criação).
- **FR-015**: Após reconexão a uma conta diferente da anterior, o sistema MUST exibir o nome da conta atual antes de qualquer confirmação de criação e MUST refazer, contra a conta atual, a checagem de nome de playlist já existente.
- **FR-016**: O sistema MUST NOT retomar automaticamente busca nem criação sem sessão válida; se a reconexão falhar, o erro de autorização MUST ser exibido com causa e próximo passo, e o trabalho preservado MUST permanecer intacto.
- **FR-016a**: Se a credencial do serviço for removida enquanto há pedido de reautorização aberto, o sistema MUST informar que o Client ID precisa ser cadastrado novamente e MUST oferecer o caminho para isso, sem descartar o trabalho preservado.
- **FR-017**: Reconectar MUST NOT alterar a ordem da fila de destinos, iniciar um destino que ainda não chegou a sua vez, nem reabrir a execução de um destino já encerrado.
- **FR-018**: A retomada após reconexão MUST usar o mesmo caminho de restauração de rascunho já usado por recarga e reabertura do app, sem caminho alternativo próprio.

### Reconexão manual

- **FR-019**: A lista de contas MUST listar todo serviço que tenha credencial salva **e** esteja entre os **destinos selecionados** para o trabalho corrente, esteja ele conectado ou não. Antes de o usuário chegar à etapa de seleção de destinos o conjunto está vazio, e a lista MUST NOT exibir serviço algum.

  > _"Destinos selecionados" é a seleção de destinos da execução em curso, não "todo provedor com credencial cadastrada". Listar um serviço não selecionado convidaria a autorizar o que não vai ser usado, e o Princípio II proíbe emitir requisição a provedor não selecionado. Com a lista vazia antes da etapa de seleção, não há trabalho a preservar ainda._
- **FR-020**: Para cada serviço listado, o sistema MUST indicar se ele está conectado (com o nome da conta) ou desconectado.
- **FR-021**: Todo serviço listado MUST oferecer ação de **reconectar**, disponível tanto quando conectado quanto quando desconectado.
- **FR-022**: Serviço conectado MUST continuar oferecendo **desconectar**, como ação distinta e rotulada de forma inequívoca em relação a reconectar.
- **FR-023**: Serviço sem credencial salva MUST NOT ser listado.
- **FR-024**: Acionar reconectar MUST gravar o rascunho antes de sair da página e MUST iniciar a autorização apenas do serviço acionado.
- **FR-025**: Desconectar MUST NOT deixar o usuário sem caminho de volta: após desconectar, o serviço MUST permanecer listado com ação de reconectar.
- **FR-026**: Nenhuma ação desta seção MUST criar, alterar ou remover qualquer coisa na conta do usuário.

### Fase de criação (decisão Q2)

- **FR-027**: Perda de autorização durante a criação da playlist MUST ser tratada como pedido de reautorização, com o mesmo aviso em primeiro plano, e MUST NOT encerrar a execução daquele destino.
- **FR-028**: O aviso exibido durante a criação MUST informar quantas faixas já foram adicionadas e quantas faltam.
- **FR-029**: Após reconexão, a adição MUST retomar a partir do lote seguinte ao último confirmado. Nenhuma faixa MUST ser adicionada duas vezes e nenhuma MUST ser pulada.
- **FR-030**: A playlist já criada na conta MUST NOT ser removida, recriada nem renomeada em consequência da perda de autorização ou da reconexão.
- **FR-031**: Se o usuário optar por não reconectar e encerrar o destino, o desfecho MUST ser **parcial** com a contagem real do que foi escrito — nunca "concluído" nem "falhado" quando a playlist existe na conta. Se a reconexão for feita a uma conta diferente daquela que criou a playlist parcial, o sistema MUST informar que a retomada não é possível naquela conta e MUST encerrar o destino como parcial em vez de criar uma segunda playlist.
- **FR-032**: A retomada da criação MUST NOT exigir nova confirmação de revisão — a confirmação já dada continua valendo para a mesma execução —, e MUST NOT escrever nada antes da reconexão bem-sucedida.

### Texto e verificação

- **FR-033**: Todo texto novo visível ao usuário MUST estar em pt-BR e vir do catálogo central de textos. Os textos de reconexão já existentes MUST ser reutilizados em vez de duplicados.
- **FR-034**: Cada requisito acima com consequência observável MUST ter verificação executável que o cite, e nenhum teste MUST tocar a rede real.

### Key Entities

- **Pedido de reautorização**: registra que um serviço específico perdeu autorização e precisa de consentimento novo. Atributos observáveis: serviço afetado, causa apresentável ao usuário, fase em que a execução parou e o que já foi feito nela (linhas resolvidas ou faixas escritas). É transitório — some quando a sessão daquele serviço é restabelecida ou quando o destino é encerrado. MUST NOT conter token nem credencial.
- **Execução de destino** (existente, `002`): ganha a noção de estar **aguardando reautorização** — interrompida, mas sem desfecho e retomável —, hoje inexistente entre "em andamento" e "encerrada". Passa a carregar também o **resultado parcial de busca**: as linhas já resolvidas de uma tentativa interrompida, que hoje são descartadas.
- **Progresso de criação** (existente, `002`): inalterado em forma. O índice de confirmação de lote, que já existe e já sobrevive a recarga, passa a ser também o ponto de retomada após reautorização.
- **Sessão de serviço** (existente, `002`): inalterada. Continua isolada por provedor.

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Em 100% dos casos de perda de autorização detectada durante a busca, o usuário consegue retomar o trabalho sem descartar o rascunho.
- **SC-002**: Nenhuma decisão de revisão, nome de playlist, linha de entrada ou resultado de destino já concluído é perdido em consequência de perda de autorização ou de reconexão — verificado em 100% das execuções de teste do cenário.
- **SC-003**: Do aviso de reconexão até a busca recomeçar, o usuário executa no máximo **duas** ações no app: acionar reconectar e conceder consentimento no serviço.
- **SC-004**: Nenhum caminho da interface leva a um estado em que um serviço com credencial salva esteja desconectado e sem ação visível de reconexão.
- **SC-005**: Perda de autorização em um serviço não altera sessão, credencial nem resultado de outro serviço, em 100% dos casos.
- **SC-006**: O fluxo completo — aviso, reconexão, retomada — é operável somente por teclado e não apresenta violação séria ou crítica de acessibilidade.
- **SC-007**: Nenhuma requisição é emitida ao serviço afetado entre a detecção da perda de autorização e o restabelecimento da sessão.
- **SC-008**: O consumo de cota informado ao usuário antes de retomar corresponde ao consumo real, com desvio nulo em cenário determinístico de teste.
- **SC-009**: Uma busca interrompida por perda de autorização e retomada consome, no total, a mesma cota que a mesma busca consumiria sem interrupção — nenhuma linha é buscada duas vezes.
- **SC-010**: Uma criação interrompida por perda de autorização e retomada produz playlist com exatamente as mesmas faixas, na mesma ordem, que a criação ininterrupta produziria: zero faixas duplicadas e zero faixas ausentes.
- **SC-011**: Nenhuma faixa é escrita na conta do usuário entre a detecção da perda de autorização e o restabelecimento da sessão.
- **SC-012**: Zero regressão nos cenários já cobertos de expiração de sessão, recuperação de rascunho, isolamento entre provedores e encerramento por cota esgotada.

---

## Assumptions

- **Escopo por provedor**: a correção é do mecanismo comum a todos os provedores, não um caminho específico do YouTube. O YouTube é o caso de referência por não renovar sessão em silêncio, mas o Spotify cai no mesmo desfecho terminal quando a renovação falha, e bifurcar o caminho por provedor custaria mais do que corrigi-lo uma vez. A interface continua expondo a assimetria real onde ela muda o que o usuário pode fazer.
- **"Modal" significa aviso em primeiro plano que interrompe o fluxo**, com foco contido e fechamento por teclado — não uma janela do navegador nem uma nova aba.
- **A autorização continua sendo uma navegação de página inteira**, sem servidor próprio e sem segredo de cliente. Portanto "reconectar" sempre implica sair do app e voltar, e a preservação do rascunho antes da saída é parte do requisito, não detalhe de implementação.
- **Nenhum escopo de autorização novo** é solicitado a nenhum provedor. Reconectar pede exatamente o que conectar já pedia.
- **Nenhum destino de rede novo** é introduzido. A lista fechada de hosts permanece como está.
- **Sinal de "autorização inválida"**: entende-se qualquer resposta do serviço que o app já classifica como sessão expirada ou reautorização necessária. Esta feature não amplia o conjunto de respostas assim classificadas — ela muda o que o app faz depois de classificar.
- **Fechar o aviso é permitido** e não é um caminho destrutivo (US4). O contrário transformaria o modal em armadilha, e o app já oferece "pular este serviço" como saída legítima.
- **A recuperação de rascunho existente é suficiente** como mecanismo de preservação; nenhum armazenamento novo é necessário.
- **O relatório final continua distinguindo** destino concluído, parcial, pulado e falhado. Esta feature não cria desfecho novo — ela impede que um destino recuperável seja rotulado como falhado.
- **A preservação parcial da busca vale para os dois provedores**, ainda que só o YouTube tenha orçamento de cota. Bifurcar o comportamento por provedor custaria mais do que aplicá-lo uma vez, e o benefício secundário — não desperdiçar tempo de busca já gasto — existe em ambos.
- **A confirmação de revisão já dada continua valendo** através de uma reautorização dentro da mesma execução. Reautorizar é restabelecer acesso à mesma conta para a mesma escrita já autorizada pelo usuário, não uma escrita nova — o Princípio V é atendido pela confirmação original. A exceção é reconectar a uma conta **diferente** durante a criação, tratada por FR-031.
- **Cota esgotada continua prevalecendo** sobre pedido de reautorização: reconectar não devolve cota, e repetir contra cota esgotada é proibido por `002/FR-031`.

---
