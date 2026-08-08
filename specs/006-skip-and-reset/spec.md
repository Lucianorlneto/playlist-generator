# Feature Specification: Pular serviço sem tela fantasma e recomeçar de qualquer ponto

**Feature Branch**: `006-skip-and-reset`

**Created**: 2026-08-08

**Status**: Draft

**Input**: User description: "Quando o usuário pressiona o botão para pular o spotify ou pular o youtube, a tela que aparece é 'criando playlist' do serviço pulado. Quando o usuário pula um serviço, deve ir direto para a primeira fase do próximo ou, se for o último, direto para a tela de seleção de serviços. Também deve haver um botão global para resetar todo o fluxo, independente do serviço, descartando o que foi feito até aquele momento e retornando o usuário para a tela de seleção de serviços."

## Contexto do defeito

Hoje, "Pular o {serviço}" apenas marca aquela execução como encerrada. A etapa
continua exibindo a mesma execução — que agora está encerrada e sem resultado —
e a tela resultante é a de criação de playlist, com o título "Criando playlist
do {serviço}" e nenhum progresso, para um serviço que o usuário acabou de
dispensar. O usuário fica em uma tela que descreve um trabalho que não existe e
cujo único botão o leva adiante por um caminho que ele não pediu.

O botão de pular aparece em quatro momentos do ciclo de um serviço — conexão,
pedido de reautorização, estimativa de cota e revisão — e o defeito é idêntico
nos quatro.

Além disso, uma vez dentro do ciclo de um serviço não existe saída para
recomeçar: só é possível descartar o trabalho pela faixa de rascunho, que só
aparece em situações específicas (recuperação, migração, cota esgotada).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Pular um serviço leva ao próximo, não a uma tela fantasma (Priority: P1)

O usuário está no ciclo de um serviço — na conexão, na estimativa de cota, na
revisão das faixas ou diante de um pedido de reautorização — e decide que não
quer aquele destino. Ele pressiona "Pular o {serviço}". A aplicação encerra
aquele destino como pulado e o coloca imediatamente na primeira fase do próximo
destino da fila, sem passar por nenhuma tela intermediária que fale do serviço
dispensado.

**Why this priority**: é o defeito relatado. Sem isto, pular um serviço leva a
uma tela que mente sobre o estado do sistema, e o usuário precisa clicar em um
botão que fala do serviço errado para escapar dela.

**Independent Test**: com dois destinos selecionados, pular o primeiro em cada
uma das quatro fases em que o botão existe e verificar que a tela seguinte é a
de conexão do segundo destino, sem exibir em nenhum momento o título de criação
de playlist do destino pulado.

**Acceptance Scenarios**:

1. **Given** dois destinos selecionados e o primeiro na fase de conexão, **When** o usuário pula o primeiro, **Then** a tela exibida é a primeira fase do segundo destino e nenhuma tela de criação de playlist do primeiro é exibida.
2. **Given** dois destinos e o primeiro na fase de estimativa de cota, **When** o usuário pula o primeiro, **Then** a tela exibida é a primeira fase do segundo destino.
3. **Given** dois destinos e o primeiro na fase de revisão das faixas, **When** o usuário pula o primeiro, **Then** a tela exibida é a primeira fase do segundo destino e nenhuma faixa é escrita na conta do primeiro.
4. **Given** dois destinos e o primeiro parado à espera de reautorização, **When** o usuário pula o primeiro, **Then** a tela exibida é a primeira fase do segundo destino.
5. **Given** um destino já concluído com playlist criada e o segundo destino em qualquer fase, **When** o usuário pula o segundo, **Then** o relato do destino concluído permanece intacto e continua acessível.

---

### User Story 2 - Pular o último serviço encerra o fluxo pelo caminho certo (Priority: P1)

O usuário está no último destino da fila e decide pulá-lo. Como não há próximo
serviço, o fluxo encerra — e para onde ele encerra depende de haver algo a
relatar:

- **algum destino da fila chegou a rodar** (concluído, parcial ou falhado): o
  usuário vai para o resumo consolidado, onde encontra o relato e o link da
  playlist que existe. Dali ele sai por "Começar uma nova playlist", que já
  descarta o trabalho hoje;
- **todos os destinos foram pulados**: não há nada a relatar e nada a
  aproveitar. O trabalho em andamento é descartado e o usuário volta à tela de
  seleção de serviços, com o fluxo limpo.

**Why this priority**: é a outra metade do mesmo defeito. Com destino único —
que é o caso mais comum — pular hoje leva o usuário direto para a tela fantasma
sem nenhuma saída natural.

**Independent Test**: com um único destino selecionado, pular na fase de conexão
e verificar que a tela seguinte é a de seleção de serviços com o trabalho
zerado; com dois destinos, concluir o primeiro, pular o segundo e verificar que
a tela seguinte é o resumo consolidado com o link do primeiro.

**Acceptance Scenarios**:

1. **Given** um único destino selecionado na fase de conexão, **When** o usuário o pula e confirma, **Then** o trabalho é descartado, a tela exibida é a de seleção de serviços e nenhuma tela de criação de playlist é exibida.
2. **Given** dois destinos, ambos pulados, **When** o usuário pula o segundo e confirma, **Then** o trabalho é descartado e a tela exibida é a de seleção de serviços.
3. **Given** dois destinos e o primeiro concluído com playlist criada, **When** o usuário pula o segundo, **Then** a tela exibida é o resumo consolidado, com o relato e o link do primeiro, sem confirmação e sem descarte.
4. **Given** dois destinos e o primeiro encerrado como parcial ou falhado, **When** o usuário pula o segundo, **Then** a tela exibida é o resumo consolidado — o desfecho do primeiro não muda o destino da navegação, desde que ele não seja "pulado".
5. **Given** o usuário chegou ao resumo consolidado por ter pulado o último destino, **When** ele aciona "Começar uma nova playlist", **Then** o trabalho é descartado e ele volta à tela de seleção de serviços, como já acontece hoje.
6. **Given** o usuário pulou o último de todos os destinos e o trabalho foi descartado, **When** ele recarrega a página, **Then** o trabalho descartado não reaparece.
7. **Given** o usuário pula o último destino de uma fila em que nada rodou, **When** ele recusa a confirmação, **Then** nada é pulado, nada é descartado e ele permanece exatamente onde estava.

---

### User Story 3 - Recomeçar todo o fluxo de qualquer lugar (Priority: P2)

Em qualquer etapa do fluxo, e independentemente do serviço em que esteja, o
usuário encontra um comando único para recomeçar do zero. Ao acioná-lo e
confirmar, todo o trabalho em andamento é descartado e ele volta à tela de
seleção de serviços. As credenciais e as conexões já estabelecidas são
preservadas — recomeçar o trabalho não é desconectar-se das contas.

**Why this priority**: é uma capacidade nova, não a correção de um defeito. O
fluxo funciona sem ela, mas hoje um usuário que se arrependeu no meio do
caminho não tem saída visível.

**Independent Test**: entrar em qualquer etapa após a seleção de serviços,
acionar o comando de recomeçar, confirmar, e verificar que o usuário está na
tela de seleção de serviços com o trabalho zerado e as credenciais intactas.

**Acceptance Scenarios**:

1. **Given** o usuário em qualquer etapa do fluxo com trabalho em andamento, **When** ele aciona o comando de recomeçar e confirma, **Then** ele é levado à tela de seleção de serviços e todo o trabalho em andamento é descartado.
2. **Given** o usuário aciona o comando de recomeçar, **When** ele recusa a confirmação, **Then** nada é descartado e ele permanece exatamente onde estava.
3. **Given** o usuário tem credenciais salvas e uma ou mais contas conectadas, **When** ele recomeça o fluxo, **Then** as credenciais e as conexões continuam disponíveis e ele não precisa reautorizar para rodar de novo.
4. **Given** o usuário recomeçou o fluxo, **When** ele recarrega a página, **Then** o trabalho descartado não reaparece.
5. **Given** o usuário está na tela de seleção de serviços sem nenhum trabalho iniciado, **When** ele observa a interface, **Then** o comando de recomeçar não é oferecido, porque não há nada a descartar.

---

### User Story 4 - Recomeçar não apaga playlist já criada (Priority: P3)

O usuário criou uma playlist com sucesso em um destino e, antes de terminar o
segundo, decide recomeçar. O descarte atinge apenas o trabalho local em
andamento: a playlist que já existe na conta do usuário não é tocada, e o
usuário é avisado disso antes de confirmar.

**Why this priority**: protege o usuário de uma expectativa errada sobre o que
"descartar" significa, mas não bloqueia o uso do recurso.

**Independent Test**: concluir a criação em um destino, acionar o comando de
recomeçar e verificar que a confirmação diz o que será e o que não será
descartado, e que nenhuma requisição de remoção é emitida.

**Acceptance Scenarios**:

1. **Given** uma playlist já criada em um destino, **When** o usuário aciona o comando de recomeçar, **Then** a confirmação informa que o trabalho local será descartado e que a playlist já criada permanece na conta.
2. **Given** o usuário confirma o recomeço após uma criação bem-sucedida, **When** o descarte acontece, **Then** nenhuma remoção ou alteração é feita em qualquer conta do usuário.

---

### Edge Cases

- **Pular durante uma busca em andamento**: pular na fase de revisão implica que a busca daquele destino já terminou; se houver qualquer trabalho de rede ainda em curso quando o destino é pulado, ele MUST ser cancelado antes da transição, sem deixar resultado tardio chegando a um destino encerrado.
- **Pular o último destino com destino anterior falhado**: o fluxo encerra no resumo consolidado, pelo mesmo caminho de um destino anterior concluído — entre os desfechos que efetivamente rodaram, qual deles ocorreu não muda o destino da navegação. A única fronteira que importa é "algum destino rodou" contra "todos foram pulados".
- **Recomeçar durante a criação de uma playlist**: a confirmação MUST deixar claro que a adição em andamento será interrompida e que as faixas já adicionadas permanecem na playlist; nada é removido da conta.
- **Recomeçar durante uma busca em andamento**: a busca MUST ser cancelada antes do descarte, sem erro visível ao usuário.
- **Recomeçar a partir de um pedido de reautorização**: o pedido desaparece junto com o trabalho; o usuário não fica preso ao diálogo.
- **Pular todos os destinos de uma fila de dois**: o fluxo encerra sem exibir nenhuma tela de criação de playlist e sem passar pelo resumo consolidado — não há nada a relatar. O trabalho é descartado após confirmação e nenhuma playlist é criada em nenhum serviço.
- **Recarregar a página logo após pular o último destino**: o estado restaurado MUST corresponder ao que a tela mostrava antes da recarga, sem ressuscitar a execução pulada como se estivesse aberta. Quando o pulo descartou o trabalho, não há rascunho a restaurar.
- **Pular o último destino a partir do próprio resumo do destino anterior**: o comando que hoje pula o destino seguinte a partir da tela de resultado MUST obedecer às mesmas regras — encerra a fila e leva ao resumo consolidado, porque o destino anterior rodou.

## Requirements _(mandatory)_

### Functional Requirements

#### Pular um serviço

- **FR-001**: Ao pular um destino, o sistema MUST encerrá-lo com desfecho "pulado" e avançar a fila imediatamente, no mesmo ato do usuário, sem exigir nenhum clique adicional.
- **FR-002**: Quando existir um destino seguinte na fila, o sistema MUST exibir a primeira fase daquele destino imediatamente após o pulo.
- **FR-003**: Quando o destino pulado for o último da fila e **pelo menos um** destino da fila tiver desfecho diferente de "pulado", o sistema MUST exibir o resumo consolidado, sem descartar nada e sem pedir confirmação.
- **FR-004**: Quando o destino pulado for o último da fila e **todos** os destinos tiverem desfecho "pulado", o sistema MUST descartar o trabalho em andamento e levar o usuário à tela de seleção de serviços.
- **FR-005**: O descarte previsto em FR-004 MUST ser precedido de confirmação explícita que diga que pular encerra o fluxo e descarta o texto e a configuração informados. Recusar a confirmação MUST deixar o destino não pulado e o estado inteiramente inalterado.
- **FR-006**: O descarte previsto em FR-004 MUST seguir as mesmas regras do comando de recomeço quanto ao que preserva: credenciais salvas, sessões autorizadas e qualquer playlist já criada permanecem intactas, e o rascunho persistido é apagado de modo que recarregar a página não o restaure.
- **FR-007**: O sistema MUST NOT exibir, em nenhum momento e por nenhuma fração de tempo, a tela de criação de playlist de um destino cujo desfecho seja "pulado".
- **FR-008**: O comportamento definido em FR-001 a FR-007 MUST ser idêntico nas quatro fases em que o comando de pular é oferecido: conexão, pedido de reautorização, estimativa de cota e revisão das faixas.
- **FR-009**: Pular um destino MUST NOT criar, alterar ou remover nada na conta do usuário naquele destino nem em qualquer outro.
- **FR-010**: Pular um destino MUST NOT alterar o relato, o desfecho ou a lista congelada de nenhum destino já encerrado.
- **FR-011**: Qualquer trabalho de rede em andamento do destino pulado MUST ser cancelado antes da transição, e nenhum resultado tardio pode alterar o estado daquele destino depois de encerrado.
- **FR-012**: Pular um destino que **não** encerra o fluxo MUST NOT pedir confirmação nem apagar trabalho algum — a confirmação de FR-005 existe apenas no caso em que pular descarta.

#### Recomeçar todo o fluxo

- **FR-013**: O sistema MUST oferecer um comando único de recomeço, alcançável de qualquer etapa do fluxo e sempre no mesmo lugar da interface, independentemente do destino corrente e da fase em que ele estiver.
- **FR-014**: O comando de recomeço MUST pedir confirmação explícita antes de descartar qualquer coisa.
- **FR-015**: A confirmação MUST informar o que será descartado — o trabalho local em andamento — e o que será preservado: as credenciais salvas, as conexões estabelecidas e qualquer playlist já criada na conta do usuário.
- **FR-016**: Ao ser confirmado, o comando de recomeço MUST descartar o texto colado, as linhas analisadas, a configuração da playlist, a fila de execução e a seleção de destinos, e MUST levar o usuário à tela de seleção de serviços.
- **FR-017**: Ao ser confirmado, o comando de recomeço MUST apagar o rascunho persistido, de modo que recarregar a página não o restaure.
- **FR-018**: O comando de recomeço MUST NOT remover credenciais salvas nem encerrar sessões já autorizadas.
- **FR-019**: O comando de recomeço MUST NOT emitir nenhuma requisição de escrita, remoção ou alteração a qualquer provedor.
- **FR-020**: Recusar a confirmação MUST deixar o estado inalterado, com o usuário na mesma etapa, na mesma fase e com o mesmo trabalho.
- **FR-021**: O comando de recomeço MUST NOT ser oferecido quando não houver trabalho a descartar — em particular, na tela de seleção de serviços de uma sessão recém-iniciada.
- **FR-022**: Qualquer trabalho de rede em andamento MUST ser cancelado antes do descarte, sem erro visível ao usuário.

#### Interface e acessibilidade

- **FR-023**: O comando de recomeço MUST ser operável por teclado, com foco visível, e MUST ter rótulo que diga o que ele faz sem depender de contexto visual.
- **FR-024**: Após pular um destino ou recomeçar o fluxo, o foco MUST ser movido para o cabeçalho da tela que passa a ser exibida, como já ocorre nas demais transições do fluxo.
- **FR-025**: Todo texto novo introduzido por esta feature MUST estar em pt-BR e vir do catálogo de textos da aplicação.
- **FR-026**: O comando de recomeço MUST NOT competir visualmente com a ação primária da etapa em que aparece.

### Key Entities

- **Execução de serviço**: o ciclo de um destino. Ganha aqui a garantia de que o desfecho "pulado" nunca é apresentado pela tela de criação de playlist.
- **Fila de execução**: a ordem dos destinos e o índice corrente. Passa a avançar como parte do ato de pular, e não em um passo separado disparado pelo usuário.
- **Trabalho em andamento**: texto colado, linhas analisadas, configuração da playlist, seleção de destinos e fila. É exatamente o conjunto descartado pelo comando de recomeço e pelo pulo do último destino de uma fila em que nada rodou.
- **Credenciais e sessões**: cadastro por provedor e autorizações vigentes. Ficam fora do escopo do descarte, em ambos os comandos.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Em 100% das tentativas de pular um destino, em qualquer uma das quatro fases, a tela de criação de playlist daquele destino não é exibida.
- **SC-002**: Pular um destino leva o usuário à tela correta em um único acionamento, sem clique adicional: primeira fase do próximo quando há próximo; resumo consolidado quando é o último e algum destino rodou; seleção de serviços quando é o último e todos foram pulados.
- **SC-003**: Nenhuma playlist é criada, alterada ou removida em consequência de pular um destino ou de recomeçar o fluxo, em 100% dos casos.
- **SC-004**: O comando de recomeço é alcançável de todas as etapas do fluxo posteriores à seleção de serviços, sem exceção.
- **SC-005**: Após confirmar o recomeço, o usuário está na tela de seleção de serviços com o trabalho zerado, e recarregar a página não traz o trabalho de volta.
- **SC-006**: Após recomeçar, o usuário consegue iniciar uma nova execução sem reautorizar nenhuma conta e sem recadastrar nenhuma credencial.
- **SC-007**: Recusar a confirmação preserva 100% do trabalho em andamento.
- **SC-008**: O fluxo completo, incluindo os dois comandos, permanece operável por teclado e sem violação séria ou crítica de acessibilidade.
- **SC-009**: Nenhum trabalho em andamento é descartado sem confirmação explícita do usuário, em 100% dos caminhos desta feature.

## Assumptions

- "Tela de seleção de serviços" é a etapa em que o usuário escolhe os destinos da playlist — a mesma para onde o descarte de rascunho e o recomeço após sucesso já levam hoje.
- "Primeira fase do próximo destino" é a fase de conexão daquele destino, que é onde a fila já coloca um serviço ao iniciá-lo; quando a conta correspondente já está autorizada, a interface avança dali sozinha, exatamente como faz hoje.
- O comando de recomeço pede confirmação porque descarta trabalho, seguindo o padrão já adotado pelo descarte de rascunho.
- **Resolução da tensão com o Princípio V**: a decisão de produto é que pular o último destino de uma fila em que nada rodou descarta o trabalho. O Princípio V exige que trabalho em andamento seja apagado "apenas após sucesso ou por ação explícita de descarte", e um botão rotulado "Pular o {serviço}" não anuncia um descarte. Esta spec concilia as duas coisas exigindo confirmação **apenas nesse caso** (FR-005): a confirmação é o que torna a ação explícita, e o caso é raro o bastante para não pesar no fluxo normal. Nos demais caminhos, pular continua sendo um clique só, sem diálogo (FR-012). Se o planejamento preferir outra conciliação — por exemplo, mudar o rótulo do botão nesse caso em vez de confirmar —, a exigência é que o usuário saiba que está descartando antes de descartar.
- "Algum destino rodou" significa ter desfecho diferente de "pulado" — concluído, parcial ou falhado. Um destino sem nenhuma linha, que o sistema já apresenta como pulado, conta como pulado para esta regra.
- Chegar ao resumo consolidado por FR-003 não muda nada no que o resumo mostra nem em como se sai dele: "Começar uma nova playlist" continua sendo o descarte de lá.
- FR-003 e a regra existente de que o resumo consolidado só existe com mais de um destino não colidem: com um único destino, pular o último **é** pular o único, e nenhum destino da fila rodou — o caso cai sempre em FR-004.
- O comando de recomeço preserva credenciais e sessões, pelo mesmo critério já adotado pelo descarte de rascunho: cadastro e conexão são coisas separadas do trabalho.
- O lugar do comando de recomeço é o cabeçalho da aplicação, junto aos controles que já são globais — é o único ponto presente em todas as etapas.
- O comando de recomeço é a única adição desta feature à ordem de tabulação.
- Não há mudança no comportamento do resumo consolidado para destinos que efetivamente rodaram, nem na fronteira entre "concluído", "parcial" e "falhou".
- Esta feature não altera quais provedores existem, quais escopos são pedidos nem quais hosts são contatados.
