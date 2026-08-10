# Feature Specification: Correções de fidelidade ao design oficial

**Feature Branch**: `refactor/design`

**Created**: 2026-08-09

**Status**: Draft

**Input**: User description: "Precisamos fazer umas correções no design. Olhe novamente o `playlist-importer.pen` e faça as correções. Por exemplo: alguns textos não são os mesmos presentes no design, os ícones do spotify e youtube não estão coloridos de acordo com a cor da brand, existem delimitadores hoje que não existem no design oficial. […] O texto abaixo da imagem da loja de discos não está o mesmo do design, o texto 'Oi, {nome do usuário}' não está colorido e também não temos o texto 'vamos levar suas músicas pra casa', existe uma div com borda e cor na sessão 'pra onde vai a playlist', coisa que não tem no design oficial, entre outros pontos. […] A tela em questão é a 'Importador · Destinos', porém existem problemas parecidos nas outras telas também."

## Clarifications

### Session 2026-08-09

- Q: O design nomeia o produto como "Playlist Importer" com a assinatura "Texto → Spotify · YouTube". O que adotar? → A: **Só a assinatura curta.** O nome permanece "Importador de Playlist por Texto" — a constituição exige interface em pt-BR, e trocar o nome do produto é decisão de produto, não de fidelidade visual. A assinatura longa atual dá lugar à do design.
- Q: A saudação do design é "Oi, {primeiro nome}" em âmbar seguida de um complemento em cinza. Qual o alcance? → A: **Integralmente o que está no arquivo, e o arquivo não repete a saudação em todas as telas.** Conferido tela a tela: Configuração e Resumo **não têm linha de contexto**; Destinos e Entrada têm saudação pessoal mais complemento; as seis telas do ciclo do serviço têm **apenas** a linha de contexto do serviço, sem saudação. A implementação atual exibe "Olá, {nome completo}" em tinta secundária nas cinco etapas — errado nas cinco.
- Q: O painel lateral de Destinos deve adotar o do design? → A: **Sim, integralmente** — cabeçalho "Ordem de execução", a fila numerada dos destinos, o aviso de execução em série, a fotografia e a legenda. O painel deixa de ser decoração pura, e a decisão da 007 de mantê-lo sem texto é revogada aqui. A exigência que sobrevive é outra: a informação do painel precisa continuar legível **sem** as imagens.
- Q: Como a fidelidade dos textos ao design é verificada, já que a conferência manual da 007 foi o que deixou passar estas divergências? → A: **Inventário versionado mais verificação automatizada.** Os textos do arquivo de design entram no repositório como artefato, tela a tela, cada um com o desfecho — adotado, ou mantido diferente com o motivo. Uma verificação executável confere que todo texto marcado como adotado está presente no módulo de textos e falha se algum sumir ou divergir depois. A conferência manual continua existindo para o que é forma, não texto.
- Q: A permissão de usar cor de marca como substrato tingido é uma exceção nomeada ou uma regra geral por opacidade? → A: **Exceção nomeada.** Existe um substrato de identidade por provedor, com nome e valor próprios, usável **apenas** onde o design o desenha — hoje, o distintivo do cartão de destino. Todo outro preenchimento com cor de marca continua barrado. A permissão é uma decisão visível em revisão, não um limiar numérico que qualquer tela nova possa alegar.
- Q: O que a linha secundária do cartão de destino diz quando há Client ID cadastrado mas ainda não há conexão ativa? → A: **Diz quando a conexão vai acontecer**, não apenas que ela não existe — a autorização só ocorre quando aquele serviço é executado, e a linha responde à pergunta que ela mesma levanta. O cartão mantém a mesma altura nos três estados, então nada salta quando a sessão é obtida.
- Q: A linha de apoio de um degrau que está **à frente** da etapa corrente deve derivar quando o valor já existe — por exemplo, voltar à Configuração depois de já ter escolhido os dois destinos? → A: **Sim.** A regra passa a ser uma só: **deriva quando há valor decidido, fica neutra quando não há**, sem olhar se o degrau está concluído, corrente ou à frente. Ela não contradiz a proibição de afirmar uma escolha não feita, porque o valor só existe se a decisão aconteceu.
- Q: O que o painel "Ordem de execução" mostra quando nenhum destino está selecionado? → A: **Permanece inteiro, com um convite no lugar da fila.** Cabeçalho, aviso, fotografia e legenda continuam; onde estaria a fila aparece uma frase curta convidando a escolher um destino. O painel nunca some nem colapsa por causa da seleção vazia — o layout não se reorganiza a cada marcação, e o painel nunca vira um buraco sem explicação.

## Contexto

A feature 007 realinhou a aplicação ao arquivo de design oficial. A conferência de
fidelidade que a encerrou era guiada por lista e feita a olho, e deixou passar um
conjunto de divergências que só aparecem quando as duas telas são postas lado a lado.
Esta feature é a segunda passada: **mesma fonte de verdade, mesmo escopo de telas,
nenhuma mudança de comportamento**.

As três famílias de divergência que o pedido nomeia, confirmadas contra o arquivo:

1. **Cor de marca ausente.** Os ícones de Spotify e YouTube são desenhados no design
   nas cores dos serviços — em todos os lugares onde aparecem. Na aplicação eles saem
   na tinta do contexto, o que apaga a única pista de identidade que o design usa.
2. **Molduras que o design não desenha.** O cabeçalho de cada etapa — linha de
   contexto, título, descrição — fica no design **sobre o substrato da área
   principal**, sem cartão em volta. Na aplicação o conteúdo inteiro de toda etapa é
   envolvido por uma superfície com contorno, e o resultado é a caixa que o pedido
   aponta em volta de "Para onde vai a playlist?".
3. **Textos que divergem.** Assinatura da marca, as quatro linhas de apoio da trilha,
   a linha de contexto do cabeçalho e o painel lateral inteiro.

O que **não** muda: o fluxo, as validações, a ordem de execução, o cálculo de cota, a
retomada, o armazenamento e a superfície de rede. Nada nesta feature toca regra de
negócio.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Reconhecer o serviço pela cor (Priority: P1)

Quem chega à barra superior ou aos cartões de destino identifica Spotify e YouTube
pela cor da marca, como em qualquer produto que integra os dois. Hoje os dois símbolos
saem na mesma tinta neutra, e a distinção depende inteiramente de ler o nome.

**Why this priority**: é a divergência mais visível e a que o pedido cita primeiro.
Afeta todas as telas ao mesmo tempo, porque o chip de conexão é permanente.

**Independent Test**: abrir qualquer etapa com os dois serviços cadastrados e conferir
que o símbolo do Spotify sai em verde e o do YouTube em vermelho, nos dois temas, em
todos os lugares onde o design os desenha.

**Acceptance Scenarios**:

1. **Given** a barra superior com os dois chips, **When** a tela é exibida em qualquer
   etapa, **Then** cada símbolo de provedor aparece na cor da sua marca.
2. **Given** a etapa Destinos, **When** os cartões são exibidos, **Then** cada cartão
   traz o símbolo do serviço na cor da marca, sobre um distintivo tingido pela mesma
   cor em baixa opacidade.
3. **Given** o tema claro e o tema escuro, **When** o usuário alterna entre eles,
   **Then** a cor de marca permanece reconhecível nos dois, sem reprovar contraste.
4. **Given** qualquer superfície, **When** ela é inspecionada, **Then** nenhum texto,
   botão ou estado usa cor de marca, e o **único** preenchimento com cor de marca em
   todo o produto é o substrato de identidade do distintivo do cartão de destino.

---

### User Story 2 - Ler a etapa sem moldura em volta (Priority: P1)

O cabeçalho da etapa — linha de contexto, título e descrição — e o conteúdo que o
segue aparecem diretamente sobre a área principal, como o design desenha. Nenhuma
caixa com contorno envolve a etapa inteira.

**Why this priority**: é a divergência estrutural que o pedido aponta com exemplo
concreto, e ela afeta as cinco etapas de uma vez.

**Independent Test**: percorrer as cinco etapas e confirmar que nenhuma delas tem uma
superfície com contorno envolvendo todo o conteúdo, e que cada cartão remanescente
corresponde a um cartão desenhado no arquivo.

**Acceptance Scenarios**:

1. **Given** a etapa Destinos, **When** ela é exibida, **Then** o título "Para onde vai
   a playlist?" e a descrição ficam sobre o substrato da área principal, sem cartão.
2. **Given** a etapa Configuração, **When** ela é exibida, **Then** o cartão que o
   design desenha continua existindo, e não há um segundo cartão em volta dele.
3. **Given** qualquer etapa, **When** as superfícies são enumeradas, **Then** cada uma
   corresponde a uma superfície do arquivo de design ou a uma exceção registrada.

---

### User Story 3 - Ser recebido pelo nome, onde o design recebe (Priority: P1)

A linha acima do título muda de natureza conforme a etapa, e em duas delas ela não
existe. Onde há saudação, o primeiro nome aparece destacado em âmbar, seguido de um
complemento que diz o que vem a seguir. Nas telas do ciclo do serviço a linha diz em
que serviço e em que ponto da fila o trabalho está.

**Why this priority**: é o exemplo que o pedido descreve com mais detalhe, e a
implementação atual erra nas cinco etapas — inclusive nas duas em que a linha não
deveria existir.

**Independent Test**: percorrer as cinco etapas e as fases do ciclo do serviço com uma
conta conectada, conferindo a presença, o conteúdo e o destaque da linha contra a
tabela de FR-008.

**Acceptance Scenarios**:

1. **Given** a etapa Destinos com uma conta conectada, **When** ela é exibida, **Then**
   a linha diz "Oi, {primeiro nome}" em âmbar, seguida de "· vamos levar suas músicas
   pra casa" em tinta secundária.
2. **Given** a etapa Entrada com uma conta conectada, **When** ela é exibida, **Then** o
   complemento é "· hora de colar sua lista".
3. **Given** a etapa Configuração ou a etapa Resumo, **When** elas são exibidas,
   **Then** não há linha de contexto acima do título.
4. **Given** a fase de revisão do primeiro de dois destinos, **When** ela é exibida,
   **Then** a linha diz "{Serviço} — 1 de 2", sem saudação.
5. **Given** a fase de orçamento e a de resultado, **When** elas são exibidas, **Then**
   a linha diz "{Serviço} · Conferindo o orçamento" e "{Serviço} · Concluído".
6. **Given** nenhuma conta conectada nas etapas Destinos ou Entrada, **When** elas são
   exibidas, **Then** a linha exibe apenas o complemento — nunca um nome inventado,
   nunca um espaço vazio.

---

### User Story 4 - Ver a ordem de execução no painel lateral (Priority: P2)

Na etapa Destinos, o painel lateral apresenta a fila de execução: os destinos
escolhidos, na ordem em que serão executados, com a posição de cada um; o aviso de que
os serviços rodam um por vez; e a fotografia de clima com a sua legenda.

**Why this priority**: o painel hoje é decoração pura e a ordem de execução está
escrita como parágrafo solto no corpo da etapa. O design põe as duas coisas no mesmo
lugar, e a informação fica onde a decisão está sendo tomada.

**Independent Test**: selecionar os dois destinos e conferir que o painel lista Spotify
como primeiro e YouTube como segundo, com o aviso e a legenda do design, e que a
explicação de ordem não aparece duplicada no corpo da etapa.

**Acceptance Scenarios**:

1. **Given** os dois destinos selecionados, **When** a etapa Destinos é exibida,
   **Then** o painel traz "Ordem de execução", Spotify com a nota de primeiro e YouTube
   com a nota de segundo.
2. **Given** a seleção muda, **When** um destino é desmarcado, **Then** o painel reflete
   a nova seleção — nunca lista um destino que não foi escolhido.
3. **Given** nenhum destino selecionado, **When** a etapa é exibida, **Then** o painel
   continua no lugar, com cabeçalho, aviso, fotografia e legenda, e convida a escolher um
   destino no lugar da fila — sem mudar a largura da coluna primária.
4. **Given** o painel exibido, **When** as imagens estão desabilitadas, **Then** o
   cabeçalho, a fila, o aviso e a legenda continuam legíveis.
5. **Given** a etapa Destinos, **When** o corpo da etapa é lido, **Then** a explicação
   da ordem de execução aparece uma única vez na tela.

---

### User Story 5 - Reconhecer o estado da conta no cartão de destino (Priority: P2)

Cada cartão de destino mostra, sob o rótulo, o estado da conta daquele serviço — quem
está conectado, ou o que falta para o destino ficar disponível. O controle de seleção
fica à direita, como marca de verificação.

**Why this priority**: é a anatomia que o design desenha e a informação que falta hoje;
o usuário decide para onde a playlist vai sem ver em qual conta ela cairia.

**Independent Test**: cadastrar um serviço, conectar apenas ele, e conferir que o
cartão conectado nomeia a conta e o outro explica o que falta, com atalho para resolver.

**Acceptance Scenarios**:

1. **Given** um serviço conectado, **When** o cartão é exibido, **Then** a linha
   secundária nomeia a conta conectada.
2. **Given** um serviço com credencial cadastrada e sem sessão, **When** o cartão é
   exibido, **Then** a linha secundária diz que a autorização acontece ao executar aquele
   serviço, e o cartão tem a mesma altura do cartão conectado.
3. **Given** um serviço sem credencial cadastrada, **When** o cartão é exibido, **Then**
   o motivo continua escrito e o atalho para a Configuração continua disponível.
4. **Given** o cartão, **When** ele é operado por teclado, **Then** o controle é
   alcançável, tem foco visível e o rótulo continua associado a ele.

---

### User Story 6 - Ler os mesmos textos do design (Priority: P3)

Os textos visíveis correspondem aos do arquivo de design: a assinatura da marca, as
linhas de apoio das quatro etapas na trilha e o que mais divergir no levantamento tela
a tela.

**Why this priority**: são divergências pontuais, cada uma de baixo impacto isolado,
mas somadas produzem a sensação de que a aplicação e o design são dois produtos.

**Independent Test**: comparar, tela a tela, cada texto visível contra o texto do
arquivo, e confirmar que toda diferença remanescente está na lista de divergências
registradas com o motivo.

**Acceptance Scenarios**:

1. **Given** a barra superior, **When** ela é exibida, **Then** a assinatura sob o nome
   é "Texto → Spotify · YouTube".
2. **Given** a trilha de etapas, **When** a etapa Configuração ainda não foi concluída,
   **Then** a sua linha de apoio é "Suas credenciais"; **When** já foi concluída,
   **Then** é "Preferências salvas".
3. **Given** a trilha, **When** as etapas Entrada e Serviço ainda não têm valor
   decidido, **Then** as linhas de apoio são "Cole a lista de músicas" e "Criação e
   resultado".
4. **Given** os dois destinos já escolhidos, **When** a etapa Destinos é a etapa
   corrente, **Then** a sua linha de apoio já exibe os destinos escolhidos.
5. **Given** os dois destinos já escolhidos, **When** o usuário volta para a etapa
   Configuração e a etapa Destinos fica à frente da corrente, **Then** a linha de apoio
   de Destinos continua exibindo os destinos escolhidos.
6. **Given** a etapa Configuração, **When** nenhum destino foi escolhido ainda,
   **Then** a linha de apoio de Destinos **não** afirma nenhuma escolha.

---

### Edge Cases

- **Nome de exibição de uma palavra só.** O primeiro nome é o próprio nome — nunca uma
  linha truncada nem um espaço vazio.
- **Nome de exibição ausente ou vazio na sessão.** A linha degrada para o complemento
  sozinho, como no caso sem conta conectada.
- **Dois serviços conectados com contas diferentes.** A saudação usa a conta do
  primeiro serviço na ordem do produto, como já faz hoje; o cartão de cada destino
  nomeia a conta **daquele** serviço.
- **Um único destino selecionado.** A linha de contexto do ciclo do serviço omite a
  posição na fila — "1 de 1" seria informação sem função —, e o painel lateral lista o
  único destino sem nota de ordem relativa.
- **Nenhum destino selecionado.** O painel lateral não afirma ordem nenhuma: mantém
  cabeçalho, aviso, fotografia e legenda, e no lugar da fila convida a escolher um
  destino (FR-015a). A barra de ações continua bloqueando o avanço com a mensagem que já
  existe.
- **Imagens desabilitadas ou ainda carregando.** Nada da informação do painel depende
  delas, e nada se desloca quando elas chegam.
- **Tela estreita.** O painel desce para baixo da coluna primária, preservando a ordem
  de leitura; a linha de contexto e os cartões continuam legíveis sem rolagem
  horizontal.
- **Cor de marca sobre substrato claro.** O verde e o vermelho das marcas precisam
  continuar aprovados como elemento de interface nos dois temas; se um valor reprovar,
  a correção é o valor por tema, não a remoção da cor.

## Requirements _(mandatory)_

### Functional Requirements

#### Identidade de serviço pela cor

- **FR-001**: Todo símbolo de provedor MUST ser exibido na cor da marca daquele
  provedor em todos os lugares em que o design a usa — chip da barra superior, cartão
  de destino, marcador da fila no painel lateral e cabeçalho dos cartões do ciclo do
  serviço.
- **FR-002**: Nenhum tratamento de contexto — herança de tinta, estado de foco, tema —
  MUST sobrepor a cor de marca de um símbolo de provedor. A cor sobrevive à troca de
  tema e à mudança de estado do elemento que a contém.
- **FR-003**: O cartão de destino MUST exibir o símbolo do provedor dentro de um
  distintivo cujo substrato é tingido pela cor da marca. O tingimento MUST vir de um
  **substrato de identidade nomeado por provedor**, com valor próprio na camada de
  tokens — não de uma opacidade aplicada caso a caso.
- **FR-004**: O substrato de identidade do FR-003 é uma **exceção nomeada** e MUST ser
  usável apenas onde o design o desenha, hoje o distintivo do cartão de destino.
  Qualquer outra superfície preenchida com cor de marca — chip, marcador da fila, botão,
  selo, cabeçalho — **permanece proibida**. A verificação MUST recusar o uso fora do
  ponto autorizado, e não afrouxar para um limiar de opacidade que uma tela nova possa
  alegar sem revisão.
- **FR-004a**: A cor de marca MUST NOT ser usada como cor de texto, de ação nem de
  estado.
- **FR-005**: A cor de marca MUST NOT ser o único portador de qualquer informação — o
  nome do serviço permanece escrito em todos os lugares onde o símbolo aparece.

#### Superfícies e molduras

- **FR-006**: Nenhuma superfície MUST envolver o conteúdo de uma etapa numa moldura que
  o arquivo de design não desenha. O cabeçalho da etapa — linha de contexto, título e
  descrição — fica sobre o substrato da área principal.
- **FR-007**: Cartões MUST existir apenas onde o design os desenha. O levantamento
  MUST enumerar, etapa a etapa, cada superfície com contorno ou substrato próprio e
  casá-la com a superfície correspondente do arquivo.
- **FR-008**: Superfícies que existem na aplicação e que o design não desenha —
  diálogos, selo de versão, aviso de espera por limite de taxa, estados de erro —
  MUST permanecer, redesenhadas por analogia com o componente mais próximo que o design
  define. **Silêncio do design não é ordem de remoção**, como já decidido na 007.

#### Linha de contexto do cabeçalho

- **FR-009**: A linha acima do título MUST seguir esta tabela, que é o que o arquivo de
  design contém, conferido tela a tela:

  | Etapa / fase | Linha de contexto |
  | --- | --- |
  | Configuração | **ausente** |
  | Destinos | saudação pessoal + "· vamos levar suas músicas pra casa" |
  | Entrada | saudação pessoal + "· hora de colar sua lista" |
  | Ciclo do serviço — conexão, reconexão, busca, revisão | "{Serviço} — {posição} de {total}", **sem saudação** |
  | Ciclo do serviço — orçamento | "{Serviço} · Conferindo o orçamento", **sem saudação** |
  | Ciclo do serviço — resultado | "{Serviço} · Concluído", **sem saudação** |
  | Resumo | **ausente** |

- **FR-010**: A saudação pessoal MUST usar o **primeiro nome** da conta conectada,
  destacado com a cor de acento; o complemento MUST usar a tinta secundária.
- **FR-011**: Sem conta conectada — ou sem nome de exibição utilizável —, a linha das
  etapas Destinos e Entrada MUST exibir apenas o complemento. **Nunca um nome
  inventado, nunca um espaço vazio.**
- **FR-012**: Com um único destino selecionado, a linha do ciclo do serviço MUST omitir
  a posição na fila.
- **FR-013**: A linha de contexto MUST ser informação redundante para tecnologia
  assistiva onde o mesmo dado já é anunciado pela trilha ou pelo cabeçalho da fase —
  ela não pode ser o único portador da posição na fila.

#### Painel lateral da etapa Destinos

- **FR-014**: A etapa Destinos MUST exibir um painel lateral com o título "Ordem de
  execução".
- **FR-015**: O painel MUST listar **apenas os destinos efetivamente selecionados**, na
  ordem fixa de execução do produto, cada um com o nome do serviço e a nota da sua
  posição na fila.
- **FR-015a**: Sem nenhum destino selecionado, o painel MUST permanecer no lugar e com a
  mesma composição — cabeçalho, aviso, fotografia e legenda —, exibindo no lugar da fila
  um convite curto a escolher um destino. O painel MUST NOT desaparecer nem colapsar por
  causa da seleção vazia: o layout não se reorganiza a cada marcação, e o cabeçalho nunca
  fica seguido de nada.
- **FR-016**: O painel MUST exibir o aviso de execução em série: os serviços rodam um
  por vez, a falha de um não interrompe o outro, e o resultado de cada um é
  apresentado.
- **FR-017**: O painel MUST exibir a fotografia de clima com a legenda do design.
- **FR-018**: Toda a informação textual do painel MUST permanecer legível e completa
  **sem** as imagens. A fotografia e os adesivos continuam decorativos, diferidos, e
  nada da etapa depende deles.
- **FR-019**: A explicação da ordem de execução MUST aparecer **uma única vez** na
  tela. O parágrafo que hoje a repete no corpo da etapa sai.
- **FR-020**: O painel MUST NOT roubar a largura de leitura da coluna primária, e em
  largura estreita MUST descer para baixo dela preservando a ordem de leitura.

#### Cartões de destino

- **FR-021**: Cada cartão de destino MUST exibir uma linha secundária com o estado da
  conta daquele serviço, nos três estados possíveis:

  | Estado do serviço | Linha secundária |
  | --- | --- |
  | Sessão ativa | nomeia a conta conectada |
  | Credencial cadastrada, sem sessão | diz **quando** a autorização vai acontecer — ao executar aquele serviço |
  | Sem credencial | o motivo do bloqueio, com o atalho para resolvê-lo |

- **FR-021a**: A linha secundária MUST ocupar o mesmo espaço nos três estados, de modo
  que o cartão não mude de altura quando a sessão é obtida ou perdida.
- **FR-022**: O motivo do bloqueio e o atalho para resolvê-lo MUST continuar escritos no
  cartão quando o serviço não tem credencial cadastrada.
- **FR-023**: O controle de seleção MUST aparecer à direita do cartão, como marca de
  verificação preenchida quando o destino está selecionado.
- **FR-024**: O cartão selecionado MUST se distinguir do não selecionado por contorno
  **e** por substrato, além do estado do controle.
- **FR-025**: O cartão MUST permanecer inteiramente operável por teclado, com foco
  visível e rótulo associado ao controle.

#### Textos

- **FR-026**: A assinatura sob o nome do produto MUST ser "Texto → Spotify · YouTube".
  O nome do produto **permanece** "Importador de Playlist por Texto".
- **FR-027**: As linhas de apoio da trilha MUST adotar os textos do design:

  | Etapa | Enquanto não há valor decidido | Depois de decidido |
  | --- | --- | --- |
  | Configuração | "Suas credenciais" | "Preferências salvas" |
  | Destinos | texto neutro de descrição | os destinos escolhidos |
  | Entrada | "Cole a lista de músicas" | a quantidade de linhas coladas |
  | Serviço | "Criação e resultado" | o que a etapa abrangeu |

- **FR-028**: A linha de apoio MUST ser governada por **uma regra única**: deriva assim
  que o valor decidido existir, permanece neutra enquanto ele não existe. O estado do
  degrau na trilha — concluído, corrente ou à frente da etapa corrente — **não** entra na
  decisão. Substitui a regra da 007, que só derivava em degrau concluído.
- **FR-029**: Onde o mockup contradiz a regra de derivação — o arquivo mostra "Spotify e
  YouTube" sob Destinos já na tela de Configuração —, **a regra vence**: a trilha
  MUST NOT afirmar uma escolha que o usuário ainda não fez.
- **FR-030**: O levantamento de divergências textuais MUST cobrir **todas as telas** do
  arquivo de design, não apenas as citadas no pedido. Cada divergência encontrada é
  corrigida ou registrada com o motivo de ser mantida.
- **FR-030a**: O inventário MUST ser um artefato versionado no repositório, organizado
  por tela, em que cada texto do design carrega o seu desfecho: **adotado** ou **mantido
  diferente**, este último sempre com o motivo escrito.
- **FR-030b**: Uma verificação executável MUST conferir que todo texto marcado como
  adotado está presente no módulo de textos da aplicação, e MUST falhar quando um deles
  desaparecer ou divergir. A conferência manual guiada por lista permanece **apenas para
  o que é forma** — composição, espaçamento, alinhamento —, nunca para texto.
- **FR-031**: Todo texto visível MUST continuar vindo do módulo único de textos, em
  pt-BR.

#### Não regressão

- **FR-032**: Nenhum comportamento MUST mudar. Fluxo, validações, ordem de execução,
  cálculo e bloqueio de cota, retomada após perda de sessão, armazenamento e superfície
  de rede permanecem idênticos.
- **FR-033**: A operação completa por teclado, o foco visível, os rótulos associados e
  os estados anunciados MUST ser preservados, sem violação séria ou crítica de
  acessibilidade.
- **FR-034**: Em telas estreitas o fluxo MUST permanecer utilizável, sem rolagem
  horizontal da página.
- **FR-035**: Todo valor visual MUST continuar vindo da camada de tokens. Nenhum valor
  literal avulso entra com esta feature — inclusive as cores de marca e o tingimento de
  baixa opacidade do FR-003.
- **FR-036**: Os dois temas MUST manter estrutura, composição e estados idênticos. A
  divergência autorizada entre eles continua sendo **cromática apenas**.

### Key Entities

- **Linha de contexto do cabeçalho**: o que aparece acima do título de uma etapa. Tem
  três formas — ausente, saudação pessoal com complemento, e contexto de serviço — e
  qual delas vale é função da etapa e, no ciclo do serviço, da fase.
- **Fila de execução exibida**: a projeção dos destinos selecionados na ordem fixa do
  produto, com a posição de cada um. Deriva da seleção real; não é uma segunda fonte de
  ordem.
- **Inventário de divergências**: o levantamento tela a tela que esta feature produz,
  **versionado no repositório**. Cada item registra a superfície ou o texto, o que o
  design mostra, o que a aplicação mostra, e o desfecho — adotado, ou mantido diferente
  com o motivo. Os itens de texto são a entrada da verificação executável de FR-030b.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Em cada tela do arquivo de design, **100%** dos textos visíveis
  correspondem ao texto do arquivo ou constam do inventário com o motivo registrado —
  **conferido por verificação executável**, não a olho. Nenhuma divergência textual sem
  registro, e a verificação falha se alguma reaparecer depois.
- **SC-002**: O símbolo do provedor aparece na cor da marca em **100%** dos lugares em
  que o design a usa, nos dois temas.
- **SC-003**: Nenhuma das cinco etapas apresenta moldura envolvendo o cabeçalho da
  etapa, e cada superfície com contorno restante está casada com uma superfície do
  arquivo de design.
- **SC-004**: A linha de contexto do cabeçalho corresponde à tabela de FR-009 em
  **todas** as etapas e fases — incluindo as duas em que ela deve estar ausente.
- **SC-005**: A ordem de execução aparece exatamente **uma vez** na etapa Destinos.
- **SC-006**: Com o carregamento de imagens desabilitado, **toda** a informação da
  etapa Destinos, painel incluído, permanece legível.
- **SC-007**: O fluxo completo permanece utilizável em 375 px de largura, sem rolagem
  horizontal da página.
- **SC-008**: Auditoria automatizada de acessibilidade sem violação séria ou crítica em
  todas as etapas.
- **SC-009**: **Nenhum** teste de comportamento existente muda de resultado por causa
  desta feature.
- **SC-010**: Nenhum valor visual literal entra no código — a verificação automatizada
  que já existe continua passando, estendida às cores de marca introduzidas.
- **SC-011**: A conferência de fidelidade tela a tela é concluída e registrada, com o
  desfecho de cada item do inventário.

## Assumptions

- **Primeiro nome** é o primeiro termo do nome de exibição que a conta informa. Nome de
  um termo só é o próprio primeiro nome. Nada novo é coletado nem persistido para isso.
- **Sem conta conectada** nas etapas Destinos e Entrada, a linha exibe só o complemento.
  O design não desenha esse estado; a escolha segue a regra que a 007 já fixou de nunca
  inventar nome e nunca deixar buraco.
- **Com um único destino**, a posição na fila é omitida da linha de contexto e a nota de
  ordem relativa some do painel. O design só desenha o caso de dois destinos.
- **Estados que o design não desenha** — cartão de destino não selecionado, destino sem
  credencial, chip desconectado ou sem credencial, diálogos, selo de versão, espera por
  limite de taxa — permanecem, redesenhados por analogia. Precedente da 007, reafirmado
  em FR-008.
- **A ação de desconectar no chip permanece.** O design não a desenha, e retirá-la
  deixaria quem quer trocar de conta sem caminho.
- **O tema claro continua sendo o tema Papel recolorido**, não um redesenho. O arquivo
  define apenas o tema escuro, e a divergência de caráter entre os dois segue aceita
  como decidido na 007.
- **A fotografia e os adesivos continuam decorativos e diferidos**, sem teto de peso,
  com o conteúdo legível e interativo antes de qualquer decoração terminar de carregar.
- **A verificação de fidelidade se divide por natureza**: **texto** passa a ser
  verificado por máquina contra o inventário versionado (FR-030a, FR-030b); **forma** —
  composição, presença de superfície, espaçamento, alinhamento — continua sendo asserção
  estrutural mais conferência manual guiada por lista. Sem captura de pixel e sem
  baseline de imagem em nenhum dos dois casos: a instabilidade entre plataformas custaria
  mais do que protege.
- **O arquivo de design é a fonte de verdade**, e ele é lido pela ferramenta que o
  edita, não por captura de tela. Onde o arquivo se contradiz entre telas — a linha de
  apoio de Entrada aparece como "Cole a lista de músicas" tanto pendente quanto
  concluída —, a regra de derivação vence o mockup.
