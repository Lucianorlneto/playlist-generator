# Feature Specification: Estado de carregamento da criação de playlist

**Feature Branch**: `refactor/design`

**Created**: 2026-08-10

**Status**: Draft

**Input**: User description: "Vamos agora adicionar a variação da tela de 'criando playlist', durante o loading da requisição, para refletir o design em `playlist-importer.pen` da tela Importador · Serviço · Spotify (Carregando). Mesma estrutura tanto para o carregamento do Spotify quanto para o carregamento do YouTube. Toda parte de animações, como os skeletons propostos no design, utilizarão o Motion, que acabei de instalar, juntamente com o kit de AI; utilizar a skill motion quando for trabalhar nas animações."

## Clarifications

### Session 2026-08-10

- Q: Durante a criação, quando o serviço responde com limitação de taxa e o app precisa esperar, o que o cartão deve mostrar? → A: **O aviso de espera passa a ser exibido também na criação inicial**, onde hoje não aparece. O disco segue girando e é o único elemento em movimento; o aviso perde o ícone giratório e fica texto mais contagem. _(Precisado depois, na análise de artefatos: "único elemento em movimento" resolvia a questão de **dois giros lado a lado**, que era o que a pergunta tinha diante de si, e alcançava largo demais — a pulsação do esqueleto não estava em jogo. FR-018a e SC-010 dizem "único elemento em **rotação**".)_ A lacuna que isso fecha é real: hoje um backoff no meio da primeira criação deixa a tela muda, e o disco girando não distingue "trabalhando" de "esperando o serviço liberar".
- Q: Como as barras do esqueleto devem obter a sua cor na camada de tokens? → A: **Um único token novo, de papel próprio**, com o mesmo tom nas duas barras. Apuração que motivou a decisão: no arquivo as duas barras não são dois tons — rótulo `#252D3A` opaco e valor branco a 8% sobre `#161C25` resolvem em 1,02:1, ou seja, indistinguíveis. O que separa rótulo de valor é **dimensão**, não cor. Reaproveitar `--rule` foi descartado: seria a primeira vez que um token de filete pinta superfície.
- Q: Quando o resultado chega e os esqueletos dão lugar às quatro informações reais, essa troca deve ser animada? → A: **Fusão cruzada curta**, dentro do orçamento de 200 ms que o guia de estilo já fixa para o conector da trilha, e nada além disso. Sem animação de layout e sem entrada/saída animada do cartão: trocar barras pulsando por texto num único quadro é abrupto, mas resolver isso não justifica trazer a maquinaria de transição de posição do Motion.
- Q: A repetição de "Isso pode levar alguns segundos" entre o subtítulo e a descrição deve ser adotada como está no arquivo? → A: **Não.** O subtítulo do arquivo é mantido verbatim — é ele que fica colado no disco, o lugar natural da expectativa de duração. A descrição é reescrita sem a oração repetida, preservando "Estamos enviando sua lista para o {serviço}" e "não feche esta janela". Os dois nós do arquivo continuam existindo; o que sai é a leitura dupla que um leitor de tela produziria.

## Contexto

O arquivo de design tem uma variação dedicada ao momento em que a playlist está sendo
criada: a tela `SjphR — Importador · Serviço · Spotify (Carregando)`, cujo miolo é a
instância `yjjDB` do componente reutilizável `qBqxK — Service Result · Loading`.

A feature 008 já trouxe o **cartão de fase** e o seu cabeçalho para a aplicação: hoje a
fase `creating` renderiza a superfície certa, com o ícone do serviço na cor da marca e a
posição na fila. O que ela não trouxe foi o **conteúdo** que o arquivo desenha dentro
desse cartão enquanto a requisição está em voo. Conferido nó a nó, faltam quatro blocos:

1. **O disco do indicador** (`oENUo` + `ee41i`) — um círculo de 44px em âmbar tingido
   com o glifo de carregamento no centro. Hoje não há indicador visual algum: a tela
   mostra um título e, quando há lotes, uma linha de contagem.
2. **O par título + subtítulo** (`gT44B`, `FeEHR`) — o título "Criando playlist no
   Spotify…" já existe; o subtítulo "Isso pode levar alguns segundos." não.
3. **A grade de esqueleto** (`SxRFw`) — quatro blocos em 2×2, cada um com uma barra de
   rótulo e uma barra de valor, ocupando exatamente o lugar das quatro informações que
   o cartão de resultado exibe quando a criação termina.
4. **A descrição e o rodapé** (`G37LNR`, `mJCdf`) — a frase que pede para não fechar a
   janela e a linha "Aguardando confirmação do Spotify…".

O que **não** muda: a criação em si. Lotes, índice de confirmação, retomada, cota,
tratamento de 429, perda de sessão, rede e armazenamento ficam exatamente como estão.
Esta feature é de superfície — mesma fonte de verdade da 007 e da 008, mesmo escopo de
telas, nenhuma regra de negócio tocada.

A novidade de método é o movimento. O sistema hoje é quase estático de propósito
(`docs/style-guide.md` §Movimento: conector da trilha e transição de estado em 200ms, o
resto instantâneo), e o único movimento contínuo existente é o giro do ícone em
`RateLimitWaiting`. O design pede dois movimentos contínuos novos — o giro do disco e a
pulsação dos esqueletos — e o pedido determina a ferramenta: a biblioteca `motion`, já
instalada.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Saber que a criação está em curso (Priority: P1)

Quem confirma a revisão fica olhando para uma tela até a playlist existir. Hoje essa
tela é praticamente muda: um título e, se houver mais de um lote, uma contagem. Não há
nada em movimento, nada que diga quanto isso costuma demorar, e nada que avise para não
fechar a janela — e fechar a janela no meio é justamente o que perde trabalho.

A partir desta feature a mesma espera mostra um disco girando, o título, o subtítulo com
a expectativa de duração, a frase que pede para não fechar a janela, e uma linha de
rodapé que diz o que está sendo aguardado.

**Why this priority**: é o motivo pelo qual a variação existe no arquivo de design. Sem
ela a fase mais longa e mais arriscada do fluxo é a que menos comunica.

**Independent Test**: confirmar a criação com a rede lenta o suficiente para a fase
`creating` durar, e verificar que os cinco elementos estão na tela, na ordem do arquivo.
Entrega valor sozinha, mesmo sem os esqueletos.

**Acceptance Scenarios**:

1. **Given** a revisão do Spotify confirmada e a criação em voo, **When** a tela da
   etapa Serviço é exibida, **Then** o cartão mostra, nesta ordem: cabeçalho do cartão,
   disco do indicador com título e subtítulo à direita, descrição, grade de esqueleto e
   rodapé.
2. **Given** a criação em voo e nenhum lote confirmado ainda, **When** o usuário lê o
   rodapé, **Then** ele diz que a confirmação daquele serviço está sendo aguardada.
3. **Given** a criação em voo com mais de um lote e o primeiro lote já confirmado,
   **When** o rodapé é lido, **Then** ele mostra o progresso em itens — a informação que
   a tela já dá hoje continua sendo dada.
4. **Given** um leitor de tela ativo, **When** o rodapé muda de "aguardando" para
   progresso, **Then** a mudança é anunciada uma única vez, e o disco e os esqueletos
   não são anunciados.
5. **Given** a criação em voo, **When** a criação falha ou a sessão se perde, **Then** o
   disco e os esqueletos somem e o erro e as saídas ocupam o lugar deles — nenhum
   indicador de carregamento sobrevive a um erro.

---

### User Story 2 - Antever a forma do resultado (Priority: P2)

O cartão de resultado mostra quatro informações — nome da playlist, itens adicionados,
itens ignorados e caminho efetivo — em duas colunas. Enquanto a criação corre, o design
desenha exatamente essa forma em esqueleto: quatro blocos, dois por linha, cada um com
uma barra curta de rótulo e uma barra mais larga de valor.

O ganho não é decorativo. O esqueleto ocupa o espaço que o resultado vai ocupar, então o
cartão não cresce de repente quando a resposta chega — o cabeçalho e o título ficam onde
estavam, e o olho de quem esperava não precisa reencontrar a tela.

**Why this priority**: depende da US1 estar no lugar para fazer sentido, e o valor é
menor que o de comunicar a espera. Mas é o item que o pedido nomeia explicitamente
("como os skeletons propostos no design").

**Independent Test**: comparar a posição vertical do cabeçalho e do título do cartão
durante a criação e imediatamente após o resultado chegar; devem ser a mesma.

**Acceptance Scenarios**:

1. **Given** a criação em voo, **When** o cartão é exibido, **Then** há quatro blocos de
   esqueleto dispostos em duas linhas de dois.
2. **Given** o resultado recebido, **When** o cartão se atualiza, **Then** os quatro
   blocos dão lugar às quatro informações reais no mesmo cartão, sem que o cabeçalho e o
   título mudem de posição vertical.
3. **Given** um leitor de tela ativo, **When** o cartão em carregamento é percorrido,
   **Then** nenhum dos blocos de esqueleto é alcançado ou anunciado.
4. **Given** uma tela de 375px, **When** o cartão em carregamento é exibido, **Then** os
   blocos colapsam para uma coluna e não há rolagem horizontal.

---

### User Story 3 - A mesma espera nos dois serviços (Priority: P2)

Quem escolhe os dois destinos vê esta tela duas vezes na mesma sessão. As duas precisam
ser a mesma tela: mesma estrutura, mesma ordem, mesmo movimento. A única diferença é o
que a identidade do serviço legitimamente muda — o símbolo, a cor da marca e o nome
dentro das frases.

**Why this priority**: é requisito explícito do pedido e é o que impede que a variação
nasça como um caso especial do Spotify.

**Independent Test**: rodar o ciclo com YouTube como destino único e conferir a mesma
lista de elementos da US1, com o símbolo e a cor do YouTube e o nome do serviço nos
textos.

**Acceptance Scenarios**:

1. **Given** o YouTube como destino em execução, **When** a criação está em voo,
   **Then** o cartão tem a mesma estrutura e a mesma ordem de elementos do Spotify.
2. **Given** o YouTube em execução, **When** o cabeçalho e as frases são lidos, **Then**
   o símbolo e a cor são os do YouTube e o nome do serviço aparece nos textos.
3. **Given** os dois destinos na fila, **When** o segundo serviço entra em criação,
   **Then** a posição na fila no cabeçalho do cartão reflete o segundo serviço.

---

### User Story 4 - Movimento que respeita a preferência do usuário (Priority: P3)

Esta é a primeira tela do produto com movimento contínuo em dois lugares ao mesmo tempo.
Quem configurou o sistema para reduzir movimento — por enxaqueca, por vertigem, por
preferência — não pode receber uma tela que gira e pulsa, e também não pode receber uma
tela com menos informação em troca.

**Why this priority**: é uma condição de qualidade, não uma capacidade nova, e vale para
tudo que a US1 e a US2 introduzem. Ainda assim é verificável sozinha.

**Independent Test**: ativar a preferência de movimento reduzido, entrar na fase de
criação e conferir que nada anima e que todos os textos continuam presentes e anunciados.

**Acceptance Scenarios**:

1. **Given** a preferência de movimento reduzido ativa, **When** a criação está em voo,
   **Then** o disco não gira, os esqueletos não pulsam e nenhum elemento entra ou sai com
   transição.
2. **Given** a preferência de movimento reduzido ativa, **When** o cartão é lido,
   **Then** o título, o subtítulo, a descrição e o rodapé estão todos presentes — nenhuma
   informação dependia do movimento.
3. **Given** a preferência ausente, **When** a criação está em voo, **Then** o disco gira
   continuamente e os esqueletos pulsam.

---

### Edge Cases

- **A criação termina antes de a tela ser vista.** Uma lista de uma linha pode resolver
  em menos de um segundo. O carregamento não pode piscar: ele aparece enquanto a fase
  durar e some quando ela acabar, sem tempo mínimo artificial e sem deixar rastro.
- **A criação para no meio por perda de sessão.** A execução vai para
  `awaiting_reauth`, que tem tela própria. O cartão de carregamento cede o lugar por
  inteiro — não fica um disco girando atrás do pedido de reconexão.
- **A criação para por cota esgotada.** O resultado existe e é parcial. O cartão de
  carregamento dá lugar ao cartão de resultado com o aviso de cota, pelo caminho já
  existente.
- **Retomada da criação interrompida.** Ao retomar os itens restantes, a tela volta ao
  mesmo estado de carregamento, com o rodapé refletindo o progresso já confirmado — não
  volta para "aguardando confirmação".
- **Espera por limitação de taxa durante a criação.** Hoje o aviso de espera só aparece
  na busca e na retomada; a criação inicial fica muda. O aviso passa a aparecer também
  aqui, sem o ícone giratório — o disco do cartão é o único **giro**, e o aviso entra
  com o que só ele tem: o texto e a contagem. Duas regiões vivas na mesma tela é o risco
  a evitar; o aviso já é uma, e o rodapé é a outra. O esqueleto continua pulsando: o que
  a espera muda é a explicação na tela, não o estado do cartão.
- **Cores forçadas / alto contraste.** O navegador descarta os preenchimentos, e os
  esqueletos — que são só preenchimento — desaparecem. Nenhuma informação se perde,
  porque eles não carregam nenhuma; o texto do cartão continua inteiro.
- **Tema claro.** O tom de esqueleto do arquivo é do tema escuro, e uma das duas barras
  lá é branco translúcido — invisível sobre substrato claro. O token precisa de valor
  próprio e verificado no claro, e não de herança do escuro.
- **Zoom de texto a 200%.** O disco tem tamanho fixo e o texto ao lado cresce; a linha
  precisa continuar legível e não pode empurrar conteúdo para fora do cartão.

## Requirements _(mandatory)_

### Functional Requirements

#### Composição do cartão

- **FR-001**: Durante a fase de criação, o cartão da etapa Serviço MUST apresentar, nesta
  ordem: o cabeçalho do cartão já existente, a linha do indicador, a descrição, a grade de
  esqueleto e o rodapé — a ordem dos nós filhos de `qBqxK`.
- **FR-002**: A linha do indicador MUST ser composta por um disco circular com substrato
  âmbar tingido e um glifo de carregamento âmbar no centro, e, ao lado, o título e o
  subtítulo empilhados.
- **FR-003**: O disco e o glifo MUST ser decorativos: não recebem foco, não têm nome
  acessível e não são anunciados.
- **FR-004**: O título MUST continuar sendo "Criando playlist no {serviço}…", agora como
  parte da linha do indicador.
- **FR-005**: O subtítulo MUST dizer que a operação pode levar alguns segundos, verbatim
  como o arquivo o escreve.
- **FR-006**: A descrição MUST dizer que a lista está sendo enviada ao serviço e pedir que
  a janela não seja fechada, **sem** repetir a expectativa de duração que o subtítulo já
  deu — o arquivo repete a oração nos dois nós, e lidas em sequência por um leitor de tela
  elas viram a mesma frase dita duas vezes.

#### Grade de esqueleto

- **FR-007**: A grade MUST ter quatro blocos, dispostos em duas linhas de dois em tela
  larga e em uma coluna em tela estreita, ocupando a mesma posição que as quatro
  informações do resultado ocupam quando a criação termina.
- **FR-008**: Cada bloco MUST ser composto por uma barra de rótulo e uma barra de valor,
  ambas no **mesmo** tom — o arquivo as desenha praticamente idênticas em cor (1,02:1) e
  as distingue por **dimensão**: a de rótulo mais curta e mais baixa, a de valor mais
  larga e mais alta. A proporção entre as duas MUST ser preservada.
- **FR-008a**: Esse tom MUST ser perceptivelmente distinto do substrato do cartão nos dois
  temas — as barras não carregam informação, mas precisam ser vistas para que a forma do
  resultado seja antecipada.
- **FR-009**: A grade inteira MUST ser inacessível à navegação e ao leitor de tela — ela
  não carrega informação.
- **FR-010**: A troca da grade pelas quatro informações reais MUST acontecer dentro do
  mesmo cartão, sem que a posição vertical do cabeçalho e do título mude.
- **FR-010a**: Essa troca MUST ser uma fusão cruzada curta, dentro do mesmo orçamento de
  200 ms que o guia de estilo já fixa para o conector da trilha.
- **FR-010b**: A feature MUST NOT introduzir animação de posição ou de dimensão, nem
  entrada e saída animadas do cartão. O movimento autorizado é exatamente três: o giro do
  disco, a pulsação das barras e a fusão cruzada do FR-010a.

#### Rodapé e progresso

- **FR-011**: Enquanto nenhum lote tiver sido confirmado, o rodapé MUST dizer que a
  confirmação daquele serviço está sendo aguardada.
- **FR-012**: A partir do primeiro lote confirmado, o rodapé MUST mostrar o progresso em
  itens que a tela já mostra hoje — nenhuma informação existente pode ser perdida na
  troca de superfície.
- **FR-013**: O rodapé MUST ser a única região viva do **conteúdo próprio** do cartão em
  carregamento, para que a mudança de "aguardando" para progresso seja anunciada uma vez
  só. O aviso de espera do FR-018 é a segunda e última região viva admitida na tela, e
  só existe enquanto a espera dura; nenhuma outra pode ser introduzida.
- **FR-013a**: As duas regiões vivas MUST NOT anunciar a mesma informação — o rodapé diz
  o progresso da escrita, o aviso diz que o serviço pediu pausa e por quanto tempo.

#### Movimento

- **FR-014**: O glifo do disco MUST girar continuamente enquanto a criação estiver em voo.
- **FR-015**: As barras do esqueleto MUST pulsar continuamente enquanto a criação estiver
  em voo.
- **FR-016**: Sob preferência de movimento reduzido, o giro, a pulsação e qualquer
  transição de entrada ou saída MUST ser suprimidos, e todo o conteúdo textual MUST
  permanecer presente e anunciado.
- **FR-017**: Nenhuma informação MUST depender exclusivamente de movimento — o estado
  "criação em curso" está escrito no título, no subtítulo e no rodapé.
- **FR-017a**: Os três movimentos MUST animar apenas propriedades que não disparam
  recálculo de layout. A tela anima de forma contínua enquanto uma requisição está em voo,
  e movimento que força recálculo a cada quadro competiria com o próprio trabalho que a
  tela está esperando.
- **FR-018**: O aviso de espera por limitação de taxa MUST passar a ser exibido também
  durante a **criação inicial**, e não apenas durante a busca e a retomada como hoje —
  uma pausa por limite de taxa no meio da primeira criação não pode deixar a tela sem
  explicação.
- **FR-018a**: Enquanto essa espera durar, o disco do indicador MUST continuar girando e
  MUST ser o **único elemento em rotação** na tela; o aviso de espera MUST perder o seu
  ícone giratório e permanecer como texto com a contagem. A pulsação do esqueleto MUST
  continuar: ela não é indicador de progresso, e sim a textura que reserva o espaço do
  resultado. Congelá-la faria a grade pedir atenção no instante da pausa — o oposto exato
  do papel que o contrato de movimento lhe dá (`contracts/motion.md` §2.2) — e poria o
  sinal distintivo no único elemento `aria-hidden` do cartão.
- **FR-018b**: A saída de cancelamento que o aviso de espera oferece durante a busca MUST
  NOT ser introduzida na criação — cancelar uma escrita já confirmada em voo não é a mesma
  ação que cancelar uma busca, e esta feature não abre esse caminho.

#### Camada visual

- **FR-019**: As tintas novas MUST vir da camada de tokens, com valor próprio e verificado
  em **ambos** os temas. São exatamente duas: **um** token de esqueleto, nomeado pelo
  papel e usado nas duas barras, e o substrato tingido do disco. Nenhum valor visual cru
  pode aparecer nos componentes.
- **FR-019a**: O token de esqueleto MUST NOT ser um alias nem um reaproveitamento de
  `--rule`. Token de filete pinta contorno; pintar superfície com ele abriria precedente
  na camada mais rígida do sistema.
- **FR-020**: O rodapé MUST usar a tinta secundária já existente. A terceira tinta que o
  arquivo usa nesse nó reprova contraste em ambos os temas e MUST NOT ser adotada — a
  mesma decisão que a 007 registrou ao recusar uma tinta apagada para a etapa pendente da
  trilha.
- **FR-021**: Os textos novos MUST entrar no inventário de textos versionado da 008, cada
  um com o desfecho registrado — adotado, ou mantido diferente com o motivo.

#### Paridade e não regressão

- **FR-022**: A estrutura MUST ser idêntica para os dois serviços; apenas o símbolo, a cor
  da marca e o nome do serviço dentro das frases variam.
- **FR-023**: Nenhum arquivo fora de `src/services/providers/{provider}/` MUST passar a
  ramificar por identificador de provedor por causa desta feature, salvo o módulo de
  textos, que já é a exceção nomeada.
- **FR-024**: Quando a criação para por erro, por perda de sessão ou por cota, o indicador
  e a grade MUST desaparecer e a superfície correspondente — erro com as saídas, pedido de
  reconexão, ou resultado parcial — MUST ocupar o lugar.
- **FR-025**: Ao retomar os itens restantes de uma criação interrompida, a tela MUST
  reapresentar o mesmo estado de carregamento, com o rodapé refletindo o progresso já
  confirmado.
- **FR-026**: O comportamento de criação MUST permanecer inalterado: lotes, índice de
  confirmação, retomada, cota, tratamento de limitação de taxa, rede e armazenamento.
- **FR-027**: Nenhum destino de rede novo MUST ser introduzido, e nenhum recurso MUST ser
  carregado de origem remota — o movimento é código local.
- **FR-028**: A fase de criação MUST continuar sem violação séria ou crítica no auditor de
  acessibilidade, nos dois serviços e nos dois temas.
- **FR-029**: De 320px a 1920px MUST NOT haver rolagem horizontal da página durante a fase
  de criação.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Os cinco blocos do nó `qBqxK` — cabeçalho, linha do indicador, descrição,
  grade de esqueleto e rodapé — estão presentes e na ordem do arquivo em 100% das
  execuções da fase de criação, nos dois serviços.
- **SC-002**: Todas as tintas introduzidas passam pelo portão de contraste do projeto nos
  dois temas; nenhum par fica ausente e nenhum par reprova.
- **SC-003**: Sob preferência de movimento reduzido, nenhum elemento do cartão anima, e a
  contagem de textos exibidos é a mesma que sem a preferência.
- **SC-004**: Quando o resultado chega, a posição vertical do cabeçalho e do título do
  cartão é a mesma que era durante a criação — sem salto de layout.
- **SC-005**: Em nenhuma condição de erro, de perda de sessão ou de cota esgotada o
  indicador de carregamento continua visível.
- **SC-006**: A 375px de largura não há rolagem horizontal e a grade está em uma coluna.
- **SC-007**: O auditor de acessibilidade reporta zero violações sérias ou críticas na
  fase de criação, nos dois serviços e nos dois temas.
- **SC-008**: A suíte existente de criação, cota, retomada e rede passa **sem alteração de
  asserção** — a prova de que nenhuma regra de negócio foi tocada.
- **SC-009**: Nenhuma requisição a host fora da lista fechada é emitida durante a fase de
  criação, e o portão de hosts continua passando sem nova entrada.
- **SC-010**: Quando o serviço responde com limitação de taxa durante a criação inicial, o
  aviso de espera aparece — hoje ele não aparece — e a tela tem **exatamente um** elemento
  em rotação e **no máximo duas** regiões vivas, que nunca dizem a mesma coisa.
- **SC-011**: O conjunto de movimentos da tela é exatamente três — giro, pulsação e fusão
  cruzada —, todos em propriedades que não disparam recálculo de layout.

## Assumptions

- **Escopo é a fase de criação.** As demais fases do ciclo — conexão, estimativa, busca,
  revisão — ficam exatamente como estão. O arquivo de design tem telas próprias para elas
  e nenhuma foi citada no pedido.
- **A biblioteca de animação é a `motion`, já instalada** (`motion@13`), e o "kit de AI"
  citado é a skill `motion`, a ser usada durante a implementação. A constituição exige
  justificativa escrita para dependência nova contra a alternativa de escrever à mão; ela
  entra no Complexity Tracking do plano, não aqui.
- **Os quatro blocos do esqueleto correspondem às quatro informações do resultado** — nome
  da playlist, itens adicionados, itens ignorados e caminho efetivo. O arquivo desenha
  quatro blocos em 2×2 e o cartão de resultado tem exatamente quatro campos em duas
  colunas; a correspondência é a leitura natural e é o que faz o esqueleto evitar o salto
  de layout.
- **O rodapé acumula os dois papéis.** O arquivo mostra só "Aguardando confirmação do
  Spotify…", mas a tela atual mostra a contagem de itens, que é informação real. O rodapé
  passa a ser o lugar dos dois: a frase do arquivo antes do primeiro lote confirmado, o
  progresso depois. Perder a contagem seria regressão; criar uma segunda linha viva seria
  anunciar duas vezes.
- **A divergência de texto em relação ao arquivo é uma só e está registrada**: a oração
  repetida sai da descrição (FR-006). Todo o resto dos textos novos é adotado verbatim. O
  inventário da 008 carrega os dois desfechos — adotado, e mantido diferente com o motivo.
- **O disco reaproveita a receita de tingimento já existente** (cor a uma porcentagem
  sobre a superfície), em vez de introduzir um mecanismo novo — é o mesmo padrão dos selos
  de estado e do substrato de identidade por provedor.
- **A conferência de fidelidade segue o método da 008**: inventário versionado mais
  verificação executável para texto, conferência manual para forma.
- **Nenhuma capacidade de provedor muda.** `ProviderCapabilities` não ganha campo por
  causa desta feature; a diferença entre os serviços aqui é só identidade visual e nome.

## Dependencies

- **Feature 008** — o cartão de fase e o seu cabeçalho, que esta feature preenche; e o
  mecanismo de inventário de textos, que ela estende.
- **Feature 007** — a camada de tokens em dois níveis e o portão de contraste, onde as
  tintas novas precisam entrar.
- **`motion@13`** — já instalada no projeto pelo usuário.
- **Arquivo de design `playlist-importer.pen`** — nós `SjphR`, `yjjDB` e `qBqxK`, fonte de
  verdade da composição.
