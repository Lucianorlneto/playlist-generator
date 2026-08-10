# Feature Specification: Readequação da interface ao design oficial

**Feature Branch**: `refactor/design`

**Created**: 2026-08-08

**Status**: Draft

**Input**: User description: "Agora temos um design oficial! Vamos readequar o app para seguir o design do `playlist-importer.pen`"

## Clarifications

### Session 2026-08-08

- Q: O design oficial define apenas o tema escuro, mas exibe o seletor de três estados em todas as telas. O tema claro é derivado da nova paleta ou a aplicação passa a ser exclusivamente escura? → A: Os dois temas permanecem. O tema claro **herda a estrutura de tokens do tema Papel da 005 e é apenas recolorido** para a nova âncora âmbar e a nova tinta — não é redesenhado do zero. A divergência de caráter que isso cria (o escuro ganha estrutura nova; o claro conserva o substrato da 005) é aceita conscientemente, e a estrutura de três zonas se aplica igualmente aos dois.
- Q: Os elementos decorativos do design — fundo ambiente, adesivos e imagem de clima — entram no escopo? → A: Sim, entram. Os recursos gráficos foram fornecidos e versionados em `src/assets/` pelo próprio autor do design.
- Q: O esqueleto de três zonas só existe em 1440px. O que acontece com a trilha de etapas em telas estreitas? → A: Ela **colapsa num resumo compacto no topo** — posição no fluxo e nome da etapa atual, com indicação de progresso. As linhas de apoio e a visão do trajeto completo são perdidas nessa largura, e essa perda é aceita: nenhum estado novo de abertura é introduzido.
- Q: De onde vêm os ícones de interface, já que os PNGs fornecidos não são recoloríveis? → A: Da biblioteca **`react-icons`**, pelos subcaminhos dos conjuntos que o próprio design referencia — **Lucide** para os quinze ícones de interface e **Phosphor** para os dois logotipos de provedor. Importação individual por subcaminho, empacotada no build, atrás de um ponto único de mapeamento de papel para componente. É a única dependência de runtime que a feature acrescenta. — **Parcialmente substituída em 2026-08-09**: a marca saiu da biblioteca e passou a vir de `Logo Mark.png`, restando quatorze do Lucide. Ver a clarificação correspondente adiante.
- Q: O fundo ambiente da área principal aponta para uma URL de terceiro no arquivo de design. → A: Resolvido na origem — o recurso foi produzido e versionado em `src/assets/imgs/`. Nenhuma referência remota sobrevive. Resta ao planejamento decidir formato e estratégia de carregamento, dado o peso do arquivo entregue.

### Session 2026-08-09

- Q: A barra de ações no rodapé deve existir só nas duas telas em que o design a desenha (Destinos e Entrada), ou deve ser generalizada para todas as etapas? → A: **Só em Destinos e Entrada**, como o design desenha. As demais etapas mantêm suas ações dentro do cartão da fase que as explica — "Pular o {serviço}" continua colado ao cartão de revisão, de orçamento, de reconexão e de sucesso, como está hoje e como o design mostra. Redesenhadas, não realocadas.
- Q: O que governa as superfícies que existem na aplicação mas que o design não desenha — o diálogo de confirmação antes de descartar, o selo de versão, o aviso de espera por limite de taxa? → A: **Silêncio do design não é ordem de remoção.** Tudo que existe permanece e é redesenhado com o vocabulário oficial, por analogia com os componentes mais próximos que o design define. Nenhuma superfície é apagada por ausência de desenho. Verificado no arquivo: o design não desenha modal algum, e a tela "Reconectar" é a fase de conexão inicial — o pedido de reautorização no meio da execução cai sob esta regra.
- Q: Qual orçamento de peso os recursos decorativos devem respeitar, já que somam cerca de 930 KB? → A: **Nenhum teto numérico.** Os recursos ficam com o peso entregue. A exigência é de comportamento, não de tamanho: carregamento diferido e não bloqueante, com o conteúdo da etapa legível e interativo antes de qualquer decoração terminar de carregar. Decisão tomada com a consequência conhecida — a primeira visita carrega cerca de 930 KB de recurso decorativo.
- Q: A linha de apoio de cada etapa na trilha é derivada do estado real ou é texto fixo por etapa? → A: **Híbrida.** Derivada onde a aplicação já tem o valor à mão — destinos efetivamente escolhidos, quantidade de linhas coladas — e texto neutro de descrição enquanto a decisão ainda não foi tomada. O "Spotify e YouTube" que o design mostra sob Destinos mesmo na tela de Configuração é mockup ilustrativo, não regra: a trilha MUST NOT afirmar uma escolha que o usuário ainda não fez.
- Q: Como a fidelidade ao design deve ser verificada, já que SC-001 depende de avaliação humana? → A: **Asserções estruturais automatizadas** — presença e composição das zonas, componente correto em cada tela, tokens aplicados, nenhum valor literal — somadas à conferência manual guiada por lista para a fidelidade fina. **Sem captura de pixel e sem baseline de imagem**, cuja instabilidade entre plataformas custaria mais do que protege.
- Q: A pasta `src/assets/icons/` foi removida, e com ela os nove PNGs que eram ícone de interface. `Logo Mark.png` sobreviveu, em `src/assets/imgs/`. A marca vem dele ou do `list-music` do Lucide? → A: **Do arquivo.** A marca do produto é arte, não ícone de interface: não se tinge pelo contexto e não existe em biblioteca alguma. É a exceção declarada de FR-060 e, por ser arte composta contra o quase-preto, cai sob FR-049 — exige tratamento declarado nos dois temas. Os demais dezesseis papéis continuam vindo de `react-icons`. A remoção dos outros nove PNGs satisfaz FR-060 **na origem**, em vez de por denylist.

## Contexto

A feature 005 construiu uma identidade visual a partir de uma descrição textual:
duas paletas, escalas finitas, a goteira numerada como assinatura e uma coluna
única centralizada de 46rem. Ela foi desenhada **sem** um arquivo de design —
o próprio spec 005 registra que o tema claro ficava "a critério" de quem
implementasse.

Agora existe um arquivo de design oficial (`playlist-importer.pen`, 11 telas e
27 componentes reutilizáveis). Ele **não é uma variação** do que foi construído:
propõe um outro esqueleto de aplicação. A coluna única centralizada dá lugar a
uma casca de três zonas — barra superior de marca e conexões, trilha vertical de
etapas à esquerda, e barra de ações fixa no rodapé da área principal. A goteira
numerada, assinatura da 005, não existe no design; a numeração migrou para a
trilha lateral.

A paleta também se desloca: o substrato deixa de ser o marinho `#1a2332` e passa
ao quase-preto azulado `#0D1117`, o âmbar `#f4a900` cede lugar ao `#F5B301`, e
entram famílias que a 005 não tinha — cores de marca por provedor (verde Spotify,
vermelho YouTube), uma família de superfícies em quatro degraus e um raio base
maior. A tipografia é a única âncora preservada: Space Grotesk continua.

Esta feature **substitui parcialmente a 005**. Onde as duas divergirem, o design
oficial vence, e os requisitos da 005 afetados estão listados nominalmente na
seção "Relação com a feature 005". O que a 005 estabeleceu como método — token
com papel semântico, escalas finitas, informação nunca só por cor, foco visível,
verificação de contraste por teste — continua valendo integralmente e não é
objeto desta feature.

**Nenhum comportamento funcional muda.** O fluxo continua sendo
`Configuração → Destinos → Entrada → [ciclo por serviço] → Resumo`, com as mesmas
decisões, os mesmos dados e as mesmas confirmações. Esta feature move, recolore e
renomeia superfícies; não cria, remove nem reordena passos.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - A aplicação se apresenta como um produto, não como um formulário (Priority: P1)

Quem abre a aplicação encontra, no topo, uma barra permanente que diz o nome do
produto, o que ele faz, e — lado a lado — o estado de cada serviço de destino:
qual conta está conectada, se a conexão está viva, e um caminho direto para
reconectar. O controle de tema fica nessa mesma barra. Essa faixa acompanha o
usuário em todas as etapas e nunca muda de lugar.

**Why this priority**: é a mudança que o usuário percebe primeiro e a que carrega
mais informação nova. Hoje o estado de conexão de cada provedor está espalhado
entre etapas; o design o promove a informação permanente. Entregue sozinha, a
barra superior já dá identidade ao produto e responde "estou conectado?" sem
navegação.

**Independent Test**: pode ser testada abrindo a aplicação em cada uma das cinco
etapas, com zero, um e dois provedores conectados, e verificando que a barra
mostra marca, chips de conexão coerentes com o estado real e o controle de tema —
sem que nenhuma outra parte da tela tenha sido redesenhada.

**Acceptance Scenarios**:

1. **Given** a aplicação em qualquer etapa do fluxo, **When** a tela é exibida, **Then** a barra superior mostra o nome do produto, sua descrição curta e o controle de tema, na mesma posição em todas as etapas.
2. **Given** um provedor conectado, **When** a barra superior é exibida, **Then** o chip daquele provedor mostra o ícone do serviço, um indicador de conexão viva, o identificador da conta conectada e uma ação de reconectar.
3. **Given** um provedor desconectado ou com sessão expirada, **When** a barra superior é exibida, **Then** o chip daquele provedor se distingue do estado conectado por rótulo textual e forma, além da cor, e oferece a ação de conectar.
4. **Given** um provedor sem credencial configurada, **When** a barra superior é exibida, **Then** nenhuma informação de conta falsa é exibida para ele.
5. **Given** um usuário navegando apenas pelo teclado, **When** ele percorre a barra superior, **Then** todos os controles dela recebem foco visível e são acionáveis, e o controle de tema continua contando como uma única parada de tabulação.
6. **Given** uma tela estreita de telefone, **When** a barra superior é exibida, **Then** nenhuma rolagem horizontal da página ocorre e todos os alvos de toque permanecem acionáveis.

---

### User Story 2 - As etapas viram uma trilha lateral persistente (Priority: P1)

O usuário vê, à esquerda e em todas as etapas, uma trilha vertical intitulada
"Etapas". Cada etapa aparece com seu número, seu nome e uma linha curta que diz
o que ela contém ou o que já foi decidido nela. Etapas concluídas são marcadas
como concluídas; a etapa atual é destacada; as futuras ficam apagadas. Um traço
vertical liga uma etapa à seguinte e mostra até onde o fluxo chegou. No rodapé da
trilha, sempre disponível, fica "Recomeçar do início".

**Why this priority**: é a substituição do indicador de etapas atual e o novo lar
da numeração — a informação que a goteira da 005 carregava. Sem ela, a barra
superior da P1 fica sobre uma tela que ainda usa o esqueleto antigo. Entregue
junto com a P1, a casca da aplicação está completa e as telas internas podem
migrar uma a uma.

**Independent Test**: pode ser testada percorrendo o fluxo do começo ao fim e
verificando, a cada etapa, que a trilha marca a posição correta, descreve as
etapas já decididas com o que foi decidido, e que "Recomeçar do início" continua
acessível e continua pedindo confirmação antes de descartar.

**Acceptance Scenarios**:

1. **Given** o usuário em qualquer etapa, **When** a trilha é exibida, **Then** as etapas anteriores aparecem como concluídas, a atual como atual e as seguintes como pendentes, distinguíveis entre si por forma e rótulo, não apenas por cor.
2. **Given** o usuário na etapa de Entrada, **When** a trilha é exibida, **Then** a etapa de Destinos mostra, na sua linha de apoio, os destinos efetivamente escolhidos.
2a. **Given** o usuário na etapa de Configuração, com nenhum destino ainda escolhido, **When** a trilha é exibida, **Then** a linha de apoio da etapa de Destinos exibe uma descrição neutra da etapa e não nomeia nenhum destino.
3. **Given** um único destino selecionado, **When** a trilha é exibida, **Then** a etapa "Resumo" não aparece na trilha, coerentemente com o fluxo, que não passa por ela.
4. **Given** dois ou mais destinos selecionados, **When** a trilha é exibida, **Then** a etapa "Resumo" aparece na trilha.
5. **Given** qualquer etapa do fluxo, **When** o usuário aciona "Recomeçar do início", **Then** a confirmação existente é exibida antes de qualquer descarte, com o mesmo comportamento de hoje.
6. **Given** um leitor de tela percorrendo a página, **When** a trilha é anunciada, **Then** a posição atual é anunciada uma única vez, sem duplicar a informação já dada pelo título da etapa.
7. **Given** uma tela estreita de telefone, **When** a trilha é exibida, **Then** ela não ocupa a largura de leitura do conteúdo e nenhuma rolagem horizontal ocorre.

---

### User Story 3 - Destinos e Entrada ganham uma barra de ações com o motivo do bloqueio (Priority: P2)

Nas duas etapas de escolha — Destinos e Entrada — o usuário encontra as ações
numa faixa no rodapé da área de conteúdo, com o estado da etapa dito por extenso
à esquerda ("2 destinos selecionados", "0 linhas · cole ou digite pelo menos uma
para continuar") e os botões à direita: retornar como ação discreta, avançar como
ação primária em âmbar sólido. Quando o avanço não é possível, a faixa diz o
motivo em vez de apenas desabilitar o botão em silêncio.

Nas demais etapas nada se move: as ações do ciclo de serviço continuam dentro do
cartão que as explica — "Pular o Spotify" ao lado da revisão, "Pular o YouTube"
ao lado do orçamento — porque ali a ação depende do que o cartão acabou de dizer.

**Why this priority**: transforma a validação em texto legível em vez de um botão
inerte, exatamente nas duas etapas em que o usuário pode ficar preso sem entender
por quê. Depende da casca (P1 e P2 anteriores) existir, mas é independente do
recolorir de cada tela.

**Independent Test**: pode ser testada nas etapas de Destinos e Entrada,
verificando que os botões estão na faixa inferior, que o texto de estado
corresponde ao estado real e que o motivo do bloqueio aparece por escrito quando
o avanço não é permitido — e, no ciclo de serviço, que as ações continuam onde
estavam.

**Acceptance Scenarios**:

1. **Given** a etapa de Destinos sem nenhum destino selecionado, **When** a barra de ações é exibida, **Then** o texto de estado diz que nenhum destino está selecionado e a ação de avançar não está disponível.
2. **Given** a etapa de Destinos com dois destinos selecionados, **When** a barra de ações é exibida, **Then** o texto de estado informa a quantidade selecionada e a ação de avançar está disponível.
3. **Given** a etapa de Entrada com a lista vazia, **When** a barra de ações é exibida, **Then** o motivo do bloqueio é dito por escrito na própria faixa.
4. **Given** qualquer uma das duas etapas com barra de ações, **When** um leitor de tela é usado, **Then** a indisponibilidade da ação de avançar e seu motivo são perceptíveis sem depender da cor do botão.
5. **Given** a primeira etapa do fluxo, **When** a barra de ações é exibida, **Then** nenhuma ação de retorno inoperante é oferecida.
6. **Given** qualquer fase do ciclo de serviço, **When** a tela é exibida, **Then** nenhuma barra de ações no rodapé existe e a ação de pular o serviço permanece adjacente ao cartão da fase, com o mesmo comportamento entregue pela feature 006.

---

### User Story 4 - Cada tela adota o vocabulário visual oficial (Priority: P2)

Quem percorre o fluxo encontra em todas as telas o mesmo vocabulário do design
oficial: o substrato quase-preto azulado com superfícies em degraus, o âmbar como
única cor de ação, os cartões de destino e de correspondência com sua nova
anatomia, os selos de estado, os campos, os passos numerados da configuração e as
cores de marca de cada provedor onde o provedor é o assunto. Nenhum resquício da
paleta anterior sobrevive.

**Why this priority**: é o volume do trabalho e o que faz o resultado parecer o
design, mas depende da casca e dos tokens já estarem no lugar. Pode ser entregue
tela a tela.

**Independent Test**: pode ser testada percorrendo as onze telas do design lado a
lado com a aplicação e verificando que cada componente presente no design tem
correspondente na aplicação com a mesma anatomia, e que nenhum valor visual fora
das escalas declaradas aparece no código.

**Acceptance Scenarios**:

1. **Given** o fluxo completo, **When** percorrido tela a tela, **Then** todo botão, campo, cartão, selo, painel, diálogo e mensagem usa exclusivamente as cores, tipos, espaçamentos e raios declarados pelo sistema — nenhum valor visual avulso.
2. **Given** a etapa de revisão com correspondências confiantes, incertas e não encontradas, **When** exibida, **Then** os três estados permanecem distinguíveis por rótulo textual, ícone e forma, além da cor.
3. **Given** qualquer superfície em que um provedor específico é o assunto, **When** exibida, **Then** a cor de marca daquele provedor é usada apenas como acento identificador, nunca como cor de ação primária.
4. **Given** qualquer etapa, **When** auditada por ferramenta automatizada de acessibilidade, **Then** nenhuma violação séria ou crítica é reportada.
5. **Given** o fluxo completo, **When** comparado ao comportamento anterior, **Then** nenhuma etapa, clique ou decisão adicional foi introduzida para concluir as mesmas tarefas.
6. **Given** uma busca no código por valores de cor, medida, raio ou tipo escritos literalmente, **When** executada, **Then** nenhum valor visual literal é encontrado fora do ponto único de definição dos tokens.

---

### User Story 5 - O guia de estilo passa a descrever o design oficial (Priority: P3)

Quem for evoluir a aplicação consulta um guia que descreve o sistema oficial —
as famílias de cor com seus papéis, as escalas, a anatomia de cada componente e
seus estados — e o encontra coerente com o que existe na tela e com o arquivo de
design. As decisões que a 005 registrou e que o design oficial substituiu ficam
marcadas como substituídas, com o motivo, em vez de simplesmente apagadas.

**Why this priority**: impede que a interface volte a divergir e evita que o guia
antigo continue sendo citado como norma. Não altera nada que o usuário final veja.

**Independent Test**: pode ser testada pedindo a alguém que não participou da
implementação para descrever, só com o guia em mãos, como deve ser um chip de
conexão desconectado — e conferindo com o que existe na aplicação e no arquivo de
design.

**Acceptance Scenarios**:

1. **Given** o guia atualizado, **When** um leitor procura por qualquer componente presente na aplicação, **Then** encontra sua definição visual, seus estados e quando usá-lo.
2. **Given** o guia atualizado, **When** um leitor procura por uma decisão da 005 que o design oficial substituiu, **Then** encontra a decisão marcada como substituída, com o motivo, e não como norma vigente.
3. **Given** uma mudança futura na paleta, **When** o valor é alterado no ponto único de definição, **Then** a mudança se propaga a todos os componentes sem edição individual.

---

### Edge Cases

- **Sessão parcial**: um provedor conectado e outro não — os dois chips coexistem na barra superior com estados diferentes, sem que o desconectado pareça um erro da aplicação.
- **Nome de conta muito longo** no chip de conexão: trunca com reticências e permanece disponível por completo ao leitor de tela; nunca empurra o controle de tema para fora da barra.
- **Nenhuma credencial configurada** (primeira visita): a barra superior não exibe chips de conta, e a trilha lateral mostra a Configuração como etapa atual.
- **Trilha em tela estreita**: abaixo do ponto de corte a trilha vira um resumo compacto no topo do conteúdo e o painel lateral desce para baixo da coluna primária; a ação de recomeçar precisa de um lar nessa largura, já que o rodapé da trilha deixa de existir.
- **Decoração sobre o substrato claro**: os adesivos e a imagem de clima foram compostos contra o quase-preto; sobre o off-white do tema claro exigem tratamento próprio, sob pena de sumirem ou de gritarem.
- **Etapa "Resumo" ausente**: com destino único a etapa não existe — a trilha nunca a exibe, e a numeração das demais permanece contígua.
- **Etapa de serviço com fases internas**: as seis fases do ciclo de um serviço não viram etapas da trilha; a fase corrente aparece como informação de apoio, não como novo degrau.
- **Preferência de movimento reduzido**: transições da trilha e da barra de ações são suprimidas sem perda de informação.
- **Modo de alto contraste ou cores forçadas**: superfícies construídas por sobreposição translúcida perdem a distinção; a separação entre zonas precisa sobreviver via contorno, não apenas via preenchimento.
- **Capas de álbum e miniaturas de terceiros**: continuam precisando de contorno próprio para se separarem do substrato quase-preto.
- **Zoom de texto a 200%**: as três zonas continuam legíveis e nenhuma delas corta conteúdo.
- **Saudação personalizada**: o design exibe uma saudação com o nome do usuário; quando nenhuma conta está conectada não existe nome a exibir.

## Requirements _(mandatory)_

### Funcionais — Origem normativa

- **FR-001**: O arquivo de design oficial MUST ser a origem normativa de toda decisão visual desta feature. Onde ele e a feature 005 divergirem, o design oficial vence.
- **FR-002**: Os valores do design MUST ser transcritos para o ponto único de definição de tokens do projeto, e todo componente MUST consumir esses nomes — nunca valores literais. Nenhuma superfície pode citar um valor do arquivo de design diretamente.
- **FR-003**: Os valores do design são **ponto de partida**: cada token MUST ter seu valor ajustado até satisfazer os limites de contraste declarados em SC-002, e o valor ajustado — não o valor de origem — é o normativo. Todo ajuste MUST ser registrado com sua razão.
- **FR-004**: O conjunto de variáveis auxiliar presente no arquivo de design e não referenciado por nenhum nó MUST NOT ser adotado; apenas as variáveis efetivamente consumidas pelas telas são normativas.
- **FR-005**: Nenhum comportamento funcional MUST ser alterado: o fluxo, as etapas, as decisões, as confirmações de escrita e os dados persistidos permanecem exatamente como estão.
- **FR-063**: A ausência de uma superfície no arquivo de design MUST NOT ser interpretada como ordem de removê-la. Toda superfície existente na aplicação e não desenhada — o diálogo de confirmação antes de descartar, o selo de versão da API, o aviso de espera por limitação de taxa, entre outras — MUST ser preservada e redesenhada segundo o vocabulário oficial.
- **FR-064**: Uma superfície não desenhada MUST derivar sua forma, por analogia, do componente mais próximo que o design define, e a analogia adotada MUST ser registrada no guia de estilo. Nenhuma delas MAY introduzir cor, medida, raio ou tipo fora das escalas declaradas.
- **FR-065**: A confirmação prévia ao descarte do trabalho em andamento, entregue pela feature 006, MUST sobreviver a esta feature sem alteração de comportamento. Removê-la ou torná-la opcional MUST NOT ocorrer, por ser salvaguarda e não decoração.

### Funcionais — Casca da aplicação

- **FR-006**: O sistema MUST exibir uma barra superior permanente, presente e idêntica em todas as etapas, contendo a marca do produto (símbolo, nome e descrição curta), o estado de conexão de cada provedor e o controle de tema.
- **FR-007**: O estado de conexão de cada provedor MUST ser exibido como um chip que informa: o serviço, se a conexão está viva, o identificador da conta conectada e a ação de reconectar ou conectar.
- **FR-008**: O chip de conexão MUST distinguir os estados conectado, desconectado e sem credencial por rótulo textual e forma, além da cor.
- **FR-009**: O chip de um provedor sem credencial configurada MUST NOT exibir identificador de conta.
- **FR-010**: O sistema MUST exibir uma trilha vertical de etapas, presente em todas as etapas do fluxo, com título próprio e, para cada etapa, seu número, seu nome e uma linha de apoio.
- **FR-011**: A trilha MUST distinguir etapas concluídas, a etapa atual e etapas pendentes por forma e rótulo, além da cor, e MUST indicar visualmente a ligação entre etapas consecutivas e até onde o fluxo chegou.
- **FR-012**: A linha de apoio de uma etapa MUST refletir o estado real do fluxo sempre que a aplicação já dispuser do valor — os destinos efetivamente escolhidos, a quantidade de linhas coladas. Enquanto a decisão daquela etapa não tiver sido tomada, a linha MUST exibir uma descrição neutra do que a etapa contém.
- **FR-066**: A linha de apoio MUST NOT afirmar uma escolha que o usuário ainda não fez. Exibir os destinos antes de a etapa de Destinos ter sido concluída é defeito, ainda que o arquivo de design o mostre — ali é texto ilustrativo de mockup.
- **FR-067**: A linha de apoio da etapa atual MAY diferir da que ela exibe depois de concluída, como o design mostra para a Configuração ("Suas credenciais" enquanto corrente, "Preferências salvas" depois de concluída).
- **FR-013**: A trilha MUST omitir a etapa "Resumo" quando o fluxo não passa por ela, mantendo a numeração das demais contígua.
- **FR-014**: As fases internas do ciclo de um serviço MUST NOT virar degraus da trilha; a fase corrente MAY aparecer como informação de apoio.
- **FR-015**: A ação de recomeçar o fluxo MUST estar no rodapé da trilha, disponível em todas as etapas, e MUST preservar integralmente a confirmação prévia de descarte existente.
- **FR-016**: O sistema MUST exibir uma barra de ações no rodapé da área de conteúdo **nas etapas de Destinos e Entrada**, e apenas nelas, com o estado da etapa em texto à esquerda e as ações à direita. É o que o design desenha, e a lista é fechada.
- **FR-061**: Nas demais etapas — Configuração, o ciclo de serviço e o Resumo — as ações MUST permanecer dentro do cartão da fase que as explica, na posição que ocupam hoje. Elas MUST ser redesenhadas segundo o vocabulário oficial, e MUST NOT ser realocadas para uma faixa inferior.
- **FR-062**: A ação de pular um serviço MUST continuar adjacente ao cartão da fase em que é oferecida — conexão, reautorização, orçamento e revisão —, preservando integralmente o comportamento estabelecido pela feature 006. Esta feature MUST NOT alterar onde essa ação aparece nem o que ela faz.
- **FR-017**: A ação de avançar MUST ser a única ação primária de cada tela e MUST ser preenchimento âmbar sólido com texto quase-preto. A ação de retornar MUST ser discreta e nunca competir com ela. A regra vale igualmente para as ações que ficam inline.
- **FR-018**: Quando o avanço não for possível, a barra de ações MUST dizer o motivo por escrito, e a indisponibilidade MUST ser perceptível sem depender de cor.
- **FR-019**: A primeira etapa do fluxo MUST NOT oferecer ação de retorno inoperante.
- **FR-020**: A área principal de conteúdo MUST acomodar, quando a tela o previr, uma coluna primária de leitura e um painel lateral de apoio, sem que o painel roube a largura de leitura da coluna primária.

### Funcionais — Paleta e escalas

- **FR-021**: O substrato MUST ser a família de superfícies do design oficial, em degraus distintos para fundo da página, superfície de zona, superfície de cartão e superfície elevada, com uma cor de contorno própria.
- **FR-022**: A cor primária MUST ser o âmbar do design oficial e MUST permanecer a única cor de ação primária. Texto claro sobre preenchimento âmbar MUST NOT existir em nenhum componente.
- **FR-023**: O sistema MUST declarar cores de marca por provedor e MUST usá-las apenas como acento identificador do provedor — nunca como cor de ação, nunca como cor de estado.
- **FR-024**: Os estados de correspondência — confiante, incerta e não encontrada — MUST usar as cores do design oficial e MUST continuar sendo comunicados por fundo tingido, contorno, ícone e rótulo, jamais por preenchimento sólido, que continua significando "clicável".
- **FR-025**: O sistema MUST declarar escalas discretas e finitas para tipografia, espaçamento, raio de canto e profundidade a partir dos valores do design, e todo componente MUST usar apenas valores dessas escalas.
- **FR-026**: Onde o design usar valores próximos entre si sem distinção de papel, eles MUST ser normalizados a um único degrau de escala, e a normalização MUST ser registrada.
- **FR-027**: A família tipográfica MUST permanecer a mesma já adotada, com o mesmo tratamento de carregamento e de substituta de métrica compatível.
- **FR-028**: Superfícies que o design constrói por sobreposição translúcida sobre o substrato MUST ter equivalente opaco declarado ou MUST manter contorno próprio, de modo que a separação entre zonas sobreviva a cores forçadas pelo sistema.
- **FR-029**: A goteira numerada introduzida pela 005 MUST ser removida, e a numeração das etapas passa a viver exclusivamente na trilha lateral.

### Funcionais — Temas

- **FR-030**: O controle de tema MUST permanecer com as três opções existentes — claro, escuro e acompanhar o sistema — presente em todas as etapas, como o próprio design oficial exibe.
- **FR-031**: Todo o comportamento de tema estabelecido pela 005 MUST ser preservado sem alteração: aplicação no primeiro quadro sem piscada, troca imediata sem recarregar e sem perder trabalho, persistência da escolha manual, retorno silencioso à preferência do sistema quando o armazenamento falha, e isolamento da chave de preferência em relação a credenciais, sessões e rascunhos.
- **FR-032**: O design oficial define apenas o tema escuro. O tema claro MUST ser mantido como opção completa e MUST ser obtido por **recoloração do tema Papel existente**, conservando sua estrutura de tokens, seu substrato off-white e sua tinta marinho, e trocando apenas a âncora âmbar e os valores que dela derivam para os do design oficial. O tema claro MUST NOT ser redesenhado do zero nesta feature.
- **FR-033**: O tema claro MUST compartilhar com o escuro a mesma cor primária e a mesma família de tinta, e MUST cobrir todas as telas, componentes e estados, sem token definido em apenas um dos temas.
- **FR-046**: A estrutura de três zonas, a trilha de etapas, a barra superior e a barra de ações MUST existir de forma idêntica nos dois temas. A divergência autorizada entre eles é **cromática apenas** — a temperatura do substrato do claro continua vindo da 005 enquanto a do escuro vem do design oficial. Nenhuma divergência estrutural entre os temas é aceitável.
- **FR-047**: Superfícies que o escuro constrói por sobreposição translúcida clara sobre o substrato MUST ter, no tema claro, equivalente próprio declarado — nunca a mesma sobreposição, que sobre off-white não produz degrau visível.

### Funcionais — Ilustração e conteúdo decorativo

- **FR-034**: Os elementos decorativos do design — o fundo ambiente da área principal, o conjunto de adesivos da etapa de Destinos e a imagem de clima do painel lateral — MUST ser adotados, a partir dos recursos gráficos já versionados no repositório.
- **FR-035**: Qualquer elemento decorativo adotado MUST ser marcado como decorativo para tecnologias assistivas, MUST NOT carregar informação que não exista em texto, e MUST ser suprimido ou tornado estático sob preferência de movimento reduzido.
- **FR-048**: Todo recurso gráfico MUST ser servido pela própria origem da aplicação, versionado no repositório. Nenhuma referência a imagem hospedada por terceiros MUST sobreviver à transcrição do design, coerente com a restrição de superfície de rede fechada do projeto.
- **FR-049**: Os elementos decorativos MUST ter tratamento declarado nos dois temas. Uma decoração legível sobre o substrato quase-preto MAY exigir opacidade, mistura ou variante distinta sobre o off-white; entregar um único tratamento para os dois substratos é erro, não simplificação.
- **FR-050**: Nenhum recurso decorativo MUST bloquear a primeira pintura nem a interatividade. O conteúdo de cada etapa MUST estar legível e operável antes de qualquer decoração terminar de carregar, e a ausência de qualquer uma delas MUST deixar a tela plenamente utilizável.
- **FR-068**: Os recursos decorativos MUST ser carregados de forma diferida e não bloqueante. Nenhum deles MUST participar do caminho crítico de renderização, e nenhum MUST ser buscado antes do conteúdo da etapa em que aparece.
- **FR-069**: **Nenhum teto de peso é imposto** aos recursos decorativos: eles são usados com o peso em que foram entregues. A garantia de desempenho vem do modo de carregamento (FR-050, FR-068), não do tamanho dos arquivos. A consequência aceita e registrada é que a primeira visita transfere cerca de 930 KB de recurso decorativo.
- **FR-070**: O espaço reservado a uma decoração MUST estar dimensionado antes de ela chegar, de modo que o conteúdo não se desloque quando o recurso terminar de carregar.
- **FR-051**: Os ícones de interface MUST ser recoloríveis pelo token do estado em que aparecem e MUST acompanhar o tamanho de tipo do contexto. Um ícone que não possa assumir a cor exigida pelo seu contexto MUST NOT ser usado como ícone de interface.
- **FR-055**: Os ícones de interface MUST vir da biblioteca **`react-icons`**, pelos seus subcaminhos por conjunto: **Lucide** para os quatorze ícones de interface e **Phosphor** para os dois logotipos de provedor. Nenhum ícone de interface MUST ser desenhado à mão nem transcrito para dentro de um componente.
- **FR-056**: Os ícones MUST ser importados individualmente, pelo subcaminho do seu conjunto, de modo que apenas os efetivamente usados entrem no pacote entregue. Importação do índice raiz da biblioteca MUST NOT ocorrer.
- **FR-057**: Os ícones MUST ser servidos pela própria origem, empacotados no build. Nenhuma requisição a fonte de ícones de terceiros em tempo de execução MUST existir.
- **FR-058**: Todo ícone MUST ser marcado como decorativo para tecnologias assistivas quando acompanhar um rótulo textual, e MUST receber nome acessível próprio quando for o único conteúdo de um controle. Ícone MUST NOT ser a única forma de comunicar um estado (FR-042).
- **FR-059**: O mapeamento entre cada ícone do arquivo de design e o componente correspondente da biblioteca MUST ser declarado em um ponto único, e os componentes MUST consumir esse ponto único em vez de importar da biblioteca diretamente. Trocar o ícone de um papel MUST custar uma edição.
- **FR-060**: Os arquivos PNG de ícone versionados no repositório MUST NOT ser usados como ícones de interface. Eles permanecem apenas como origem dos adesivos decorativos, da fotografia **e da marca do produto**, onde são arte e não precisam de recoloração. A marca MUST receber tratamento declarado nos dois temas (FR-049), por ser arte composta contra o quase-preto. Os nove PNGs que eram de fato ícone de interface foram removidos do repositório em 2026-08-09, o que satisfaz este requisito **na origem** — remover o perigo vence guardá-lo por denylist.
- **FR-036**: A saudação personalizada exibida no cabeçalho de conteúdo MUST degradar para uma forma impessoal quando nenhuma conta estiver conectada, sem espaço vazio nem nome inventado.

### Funcionais — Acessibilidade e adaptação

- **FR-037**: O esqueleto de três zonas do design existe apenas em largura de desktop. Abaixo do ponto de corte, a trilha de etapas MUST colapsar num resumo compacto no topo do conteúdo, informando a posição no fluxo, o nome da etapa atual e o progresso. As linhas de apoio e a visão do trajeto completo MAY ser omitidas nessa largura.
- **FR-052**: O resumo compacto MUST NOT introduzir estado de abertura, controle acionável novo nem parada de tabulação adicional. Ele é informação, não navegação.
- **FR-053**: Na mesma largura estreita, o painel lateral de apoio MUST ser reposicionado abaixo da coluna primária, preservando sua ordem de leitura, e a barra de ações MUST permanecer acessível sem exigir rolagem até o fim de listas longas.
- **FR-054**: A informação essencial da trilha — em que etapa o usuário está e quantas existem — MUST permanecer disponível em toda largura. A ação de recomeçar o fluxo MUST continuar acessível em telas estreitas, ainda que fora da trilha.
- **FR-038**: Em qualquer largura, o sistema MUST NOT produzir rolagem horizontal da página, e todos os alvos de toque MUST permanecer acionáveis.
- **FR-039**: Todo elemento interativo introduzido ou movido por esta feature MUST ter indicador de foco por teclado visível, atendendo ao contraste mínimo contra o fundo adjacente.
- **FR-040**: A ordem de tabulação MUST seguir a ordem visual de leitura — barra superior, trilha, conteúdo, barra de ações — e o controle de tema MUST continuar contando como uma única parada de tabulação.
- **FR-041**: A posição atual no fluxo MUST ser anunciada uma única vez a leitores de tela, sem duplicação entre trilha e título da etapa.
- **FR-042**: Nenhuma informação MUST ser transmitida apenas por cor em nenhum componente novo ou redesenhado.

### Funcionais — Documentação

- **FR-043**: O guia de estilo do projeto MUST ser atualizado para descrever o sistema oficial: famílias de cor com seus papéis, escalas, anatomia de cada componente e seus estados.
- **FR-044**: As decisões da 005 substituídas por esta feature MUST ser marcadas como substituídas, com o motivo, em vez de removidas sem registro.
- **FR-045**: A regra automatizada que recusa valores visuais literais no código MUST ser mantida e atualizada para o novo conjunto de tokens.

### Funcionais — Verificação da fidelidade

- **FR-071**: A fidelidade ao design MUST ser verificada por **asserções estruturais automatizadas**: presença e composição das três zonas em cada etapa, componente correto em cada tela, tokens efetivamente aplicados e ausência de valor visual literal.
- **FR-072**: A verificação MUST NOT usar comparação de captura de tela nem baseline de imagem. Nenhuma infraestrutura de regressão visual por pixel MUST ser introduzida por esta feature.
- **FR-073**: A fidelidade fina — proporção, ritmo, peso tipográfico, alinhamento — MUST ser conferida manualmente contra o arquivo de design, guiada por uma lista de conferência tela a tela versionada junto com a feature.
- **FR-074**: As asserções estruturais MUST falhar quando uma zona desaparecer, quando um componente for substituído por outro, quando um token deixar de ser aplicado ou quando um valor literal reaparecer — cobrindo as duas larguras (ampla e estreita) e os dois temas.

### Key Entities

- **Token visual**: um nome com papel semântico declarado e um valor por tema. É a única forma pela qual um componente pode se referir a uma cor, medida, raio, tipo ou profundidade. Origem: o arquivo de design, ajustado por contraste.
- **Zona da casca**: uma das três regiões permanentes da aplicação — barra superior, trilha de etapas, área principal com sua barra de ações. Cada zona tem substrato próprio e posição fixa em todas as etapas.
- **Degrau da trilha**: uma etapa do fluxo, com número, nome, linha de apoio derivada do estado real e um entre três estados — concluída, atual, pendente.
- **Chip de conexão**: a representação permanente do vínculo com um provedor — serviço, vitalidade da sessão, identificador da conta e ação de conexão.
- **Componente do sistema**: uma peça reutilizável com anatomia declarada e definição visual explícita para repouso, foco, hover, ativo, desabilitado e, quando aplicável, erro e carregando.
- **Papel de ícone**: um nome do vocabulário da aplicação — "avançar", "recomeçar", "confiante", "provedor Spotify" — associado a exatamente um componente de ícone da biblioteca. É a única forma pela qual uma superfície pode se referir a um ícone; nenhum componente importa da biblioteca por conta própria.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A composição de zonas, o conjunto de componentes e a hierarquia de cada uma das onze telas correspondem ao design — verificado por asserções estruturais automatizadas que cobrem as onze telas nos dois temas e nas duas larguras, e que falham quando uma zona, um componente ou um token deixa de estar presente.
- **SC-001a**: A conferência manual guiada por lista, tela a tela contra o arquivo de design, está registrada e concluída para as onze telas, sem discrepância aberta de proporção, ritmo, peso tipográfico ou alinhamento.
- **SC-002**: Toda combinação de texto e fundo produzida pelo sistema atinge, em cada tema entregue, os limites mínimos de contraste para o seu tamanho de texto, e todo indicador de foco e todo contorno que carregue significado atinge o limite mínimo de contraste contra o fundo adjacente — verificado por teste automatizado que falha quando um valor regride.
- **SC-003**: Uma auditoria automatizada de acessibilidade em todas as etapas e em cada tema entregue reporta zero violações sérias ou críticas.
- **SC-004**: Uma varredura do código não encontra nenhum valor de cor, medida, raio ou tipo escrito literalmente fora do ponto único de definição dos tokens.
- **SC-005**: Nenhum token de cor está definido em apenas um dos temas entregues.
- **SC-006**: O número de passos, cliques e decisões necessários para concluir cada tarefa do fluxo é idêntico ao anterior à mudança — verificado percorrendo o fluxo completo com um e com dois destinos.
- **SC-007**: Em larguras de 320px a 1920px, nenhuma etapa produz rolagem horizontal da página e nenhum alvo de toque fica menor que o mínimo acionável.
- **SC-008**: Percorrendo o fluxo completo apenas pelo teclado, todos os controles são alcançáveis, o foco é visível em todos eles e a ordem de tabulação segue a ordem visual de leitura.
- **SC-009**: Um leitor que não participou da implementação consegue, apenas com o guia atualizado, descrever corretamente a anatomia e os estados de qualquer componente da aplicação.
- **SC-010**: A troca de tema em qualquer etapa não interrompe operação em andamento, não altera a etapa atual e não descarta dados já informados.
- **SC-011**: Nenhum valor da paleta anterior sobrevive no código após a migração.
- **SC-012**: Nenhuma referência a recurso hospedado por terceiros existe no código entregue — verificado por varredura que falha quando uma reaparece.
- **SC-013**: Todo elemento decorativo tem tratamento declarado nos dois temas, e nenhum deles é anunciado por leitor de tela.
- **SC-014**: Desabilitar o carregamento de imagens deixa todas as etapas plenamente utilizáveis, sem perda de informação e sem espaço vazio que quebre o layout.
- **SC-019**: Em cada etapa, o conteúdo está legível e operável antes de qualquer recurso decorativo terminar de carregar — verificado sob rede lenta simulada, em todas as etapas.
- **SC-020**: A chegada de um recurso decorativo não desloca nenhum conteúdo já pintado, em nenhuma etapa e em nenhuma largura.
- **SC-015**: A estrutura de zonas, a composição de cada tela e os estados de cada componente são idênticos nos dois temas — a única diferença observável entre eles é cromática.
- **SC-016**: Todo ícone presente na aplicação corresponde a um papel declarado no ponto único de mapeamento, e nenhuma superfície importa um ícone da biblioteca diretamente — verificado por varredura que falha quando uma importação avulsa aparece.
- **SC-017**: Todo ícone assume a cor do token do seu contexto em ambos os temas; nenhum ícone aparece com cor fixa que não acompanhe o tema.
- **SC-018**: O acréscimo da biblioteca de ícones não aumenta o pacote entregue além do peso dos ícones efetivamente usados — verificado comparando o tamanho do pacote antes e depois.

## Relação com a feature 005

Esta feature mantém integralmente o **método** estabelecido pela 005 — token com
papel semântico, escalas finitas, informação nunca só por cor, foco visível,
verificação de contraste por teste, ponto único de definição — e substitui os
**valores e a estrutura**.

Requisitos da 005 substituídos por esta feature:

| Requisito 005 | O que dizia | O que passa a valer |
| ------------- | ----------- | ------------------- |
| FR-041 | Paletas semeadas por `#1a2332` + `#f4a900` | Substrato e âmbar do design oficial (FR-021, FR-022) |
| FR-049 | Tema claro em off-white com bege dessaturado | **Preservado.** O tema claro conserva substrato e tinta da 005 e é apenas recolorido na âncora âmbar (FR-032) |
| FR-002 | Escuro sobre preto e azul-marinho | Preservado em espírito; os valores mudam |
| Goteira numerada (design.md §4 e §5) | Coluna reservada à esquerda com numeral, assinatura da identidade | Removida; a numeração migra para a trilha lateral (FR-029) |
| Coluna única de 46rem centralizada | Único contêiner de leitura do fluxo | Casca de três zonas com coluna primária e painel lateral (FR-020) |
| Indicador de etapas horizontal com régua | Lista horizontal acima do conteúdo | Trilha vertical persistente (FR-010, FR-011) |

Requisitos da 005 **preservados sem alteração**: todo o comportamento de tema
(FR-005 a FR-013), a disciplina de tokens (FR-004, FR-014), os estados de
componente (FR-015), o foco visível (FR-016), a proibição de informação só por
cor (FR-017), a família tipográfica Space Grotesk e seu tratamento de
carregamento (FR-034, FR-037), e a proibição de texto claro sobre âmbar (FR-046).

## Assumptions

- O arquivo de design em `~/Documents/Workspace/playlist-importer/playlist-importer.pen` é a versão oficial e estável; nenhuma tela adicional está pendente de desenho.
- As telas do design são todas de largura de desktop (1440px). O comportamento em larguras menores não foi desenhado e será derivado conforme FR-037 e FR-052 a FR-054, respeitando FR-038.
- **Todos os recursos gráficos necessários estão versionados em `src/assets/imgs/`**: o fundo ambiente da área principal, a fotografia da loja de discos que é a imagem de clima do painel lateral, os onze adesivos da etapa de Destinos — vinis, cassetes, fones, boombox, estrelas e botão de play — e a marca do produto (`Logo Mark.png`). A pasta `src/assets/icons/` foi removida em 2026-08-09. Nenhuma referência remota do arquivo de design precisa sobreviver, o que satisfaz FR-048 sem trabalho pendente.
- **Peso a vigiar**: o fundo ambiente entregue tem cerca de 600 KB e aparece em todas as etapas. FR-050 exige que ele não bloqueie a primeira pintura; o planejamento MUST decidir formato, dimensão e estratégia de carregamento, e MAY reduzir o arquivo. É a única decisão pendente sobre recursos gráficos.
- Os arquivos PNG de ícone de interface que também foram fornecidos — sol, lua, monitor, `check`, reconectar e dica — **não serão usados** (FR-060): o design tinge cada ícone pelo token do contexto, e `check` sozinho aparece em trinta e quatro pontos com tintas diferentes, o que PNG não atende. Foram removidos do repositório em 2026-08-09. **A marca é a exceção**: `Logo Mark.png` permanece e é adotada como arte, porque não se tinge pelo contexto e não existe em biblioteca alguma.
- Os dezesseis ícones de interface distintos do design vêm de `react-icons` (FR-055): quatorze do conjunto **Lucide** — `arrow-left`, `arrow-right`, `check`, `circle-check`, `external-link`, `gem`, `info`, `list-ordered`, `loader-circle`, `monitor`, `moon`, `refresh-cw`, `rotate-ccw`, `sun` — e dois do conjunto **Phosphor**, os logotipos de Spotify e YouTube. O `list-music`, que o design usava como símbolo da marca, sai da lista: a marca passa a vir de `Logo Mark.png`. Os nomes de exportação exatos de cada componente serão confirmados contra a versão instalada durante o planejamento; os conjuntos de origem e os papéis é que são normativos aqui.
- `react-icons` é a única dependência de runtime que esta feature acrescenta. Ela é empacotada no build e não introduz destino de rede novo, portanto não toca a lista fechada de hosts do Princípio II nem exige emenda à constituição.
- Os textos que aparecem no design são ilustrativos onde citam dados de conta ou de faixa; os textos de interface reais continuam vindo do dicionário existente da aplicação, ajustados apenas onde o design introduzir um rótulo que hoje não existe.
- A biblioteca de ícones usada no design será incorporada como recursos versionados do próprio build, sem requisição a terceiros em tempo de execução, coerente com a restrição de superfície de rede fechada do projeto.
- As cores de marca por provedor (verde Spotify, vermelho YouTube) são usadas como identificação, não como endosso, e não implicam qualquer mudança de integração.
- A saudação personalizada usa o identificador de conta que a aplicação já possui do provedor conectado; nenhum dado pessoal novo é coletado ou persistido.
- Os valores de raio e de tamanho de tipo que o design usa em degraus muito próximos (raios de 8, 10, 12, 13 e 14; tipos de 12, 12,5, 13, 14 e 15,5) serão normalizados a uma escala finita, conforme FR-025 e FR-026.
- Nenhuma mudança de comportamento de rede, de armazenamento ou de domínio é feita por esta feature; a constituição do projeto não é tocada.
