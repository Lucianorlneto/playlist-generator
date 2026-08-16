# Feature Specification: Sistema de movimento do aplicativo

**Feature Branch**: `feat/motion-system` (o diretório da spec é `010-app-motion-system`; este
projeto não tem o hook de criação de branch e nomeia branch por intenção)

**Created**: 2026-08-16

**Status**: Draft

**Input**: User description: "Vamos analisar o app para implementar animações utilizando o motion. Utilize o mcp do motion para aplicar as animações. Identifique, com o mcp do pencil no projeto `playlist-importer.pen` onde talvez seja aplicável adição de animações mais complexas."

## Clarifications

### Session 2026-08-16

- Q: Quais fatias entram nesta feature? → A: **US1 a US4, todas.** O catálogo nasce com o
  tamanho real do sistema, e a escala de movimento é exercitada por casos diferentes —
  transição de bloco, entrada escalonada de lista, microinteração de periferia e entrada
  escalonada decorativa. Uma escala calibrada num caso só é uma escala que será refeita na feature
  seguinte, e o custo de refazê-la é maior do que o de acertá-la agora.
- Q: A proibição categórica de animar posição e dimensão (`009/FR-010b`) é levantada? →
  A: **Levantada apenas fora de voo.** Animação de posição passa a ser admitida em
  superfície ociosa — reordenação do painel de fila, acomodação da lista após um descarte
  na revisão — e continua proibida onde há requisição em voo: linhas chegando durante a
  busca e cartão de criação. O que se preserva é a **razão** da proibição original, não o
  texto dela: medir layout a cada quadro competiria com o trabalho que a tela está
  esperando, e o pior caso é o YouTube, cujo lote é de um item e faz uma requisição por
  faixa.
- Q: Movimento ocioso contínuo — adesivos flutuando, fundo derivando — é admitido? →
  A: **Não.** Os adesivos assentam escalonados e ficam imóveis; o fundo ambiente não se
  mexe. A 009 fixou que movimento contínuo significa "trabalho em curso", e é esse
  significado que torna o giro do disco legível. Decoração que se mexe para sempre
  converteria movimento contínuo em textura, e o giro passaria a não dizer nada.

### Session 2026-08-16 (segunda rodada, após o plano)

- Q: As trocas de fase **dentro** da etapa Serviço também recebem a transição de tela? →
  A: **Não.** Só as cinco etapas do assistente animam. A proibição de
  `009/contracts/motion.md` §3 — "conexão, estimativa, busca e revisão ficam exatamente como
  estão" — permanece **intacta**. As fases do ciclo são progresso dentro de um trabalho, não
  navegação, e várias trocam sozinhas: a busca termina, a criação termina. Uma transição com
  direção sugere avanço comandado, e aplicá-la a uma troca autônoma mentiria sobre quem
  agiu. Evita também sobrepor movimento ao cartão de criação, que já tem o seu pela 009.
- Q: Marcar um cartão de destino precisa de retorno em transformação? → A: **Não.** Apenas
  uma fusão das cores que mudam ao acionar — nada exagerado. Sem encolher, sem pressão, sem
  escala. O cartão é uma área clicável grande, e transformá-lo deslocaria texto que a pessoa
  está lendo; a marcação já é legível por forma e por cor. A US3 fica inteiramente em
  transição de cor, e o catálogo permanece em seis entradas.
- Q: Os adesivos reanimam a cada entrada na etapa Destinos? → A: **Uma vez por sessão.**
  Assentam na primeira vez que Destinos aparece; nas visitas seguintes já estão postos.
  Voltar para corrigir a lista ou trocar de destino é caminho comum, e reencenar decoração a
  cada volta chama atenção para o que menos importa na tela. O sinalizador vive **em
  memória** e nunca no armazenamento — um rascunho não carrega o que já foi encenado.
- Q: Transição interrompida parte de onde estava, ou corta para o final e recomeça? →
  A: **Parte de onde estava.** A nova transição assume os valores correntes e segue dali. É
  o que faz cliques rápidos parecerem responsivos em vez de engasgados — cortar produziria um
  piscar a cada interrupção, que é o que a feature existe para remover. O SC-013 afirma
  ausência de nó preso e correção do estado final; ele **não** afirma nada sobre os quadros
  intermediários, e não deve.
- Q: O aviso de recuperação de rascunho entra na transição de etapa? → A: **Fica fora dela,
  mas ganha entrada própria.** Ele não pertence a nenhuma etapa — sobrevive a todas —, então
  transitá-lo junto o faria sair e voltar a cada avanço, sugerindo que sumiu. Fica imóvel
  durante a troca de etapa e anima quando **ele mesmo** aparece: chamar atenção para trabalho
  recuperável tem valor real. Não custa entrada nova no catálogo — é o mesmo papel de entrada
  que a lista de revisão usa, com um irmão só e portanto sem defasagem.

## Contexto

A feature 009 trouxe o primeiro movimento contínuo do produto e, junto com ele, uma
**fechadura**: `src/ui/motion/` é o único diretório autorizado a importar a biblioteca,
exporta **exatamente três** primitivas, e duas verificações independentes falham no dia em
que a quarta tentar entrar — a regra de lint `tp/no-motion-library-import` e
`tests/unit/motion-surface.spec.ts`. O guia de estilo registra a contagem literal, e
`009/contracts/motion.md` §3 lista as proibições que a mantêm de pé.

Esta feature **abre essa fechadura de propósito**, e o problema central que ela precisa
resolver não é escrever animação: é continuar tendo uma fechadura depois. Uma quarta
primitiva sem decisão de método transforma "exatamente três" em "os que forem
aparecendo", e o próximo requisito visual entra sem discussão nenhuma. O que substitui a
contagem é um **catálogo nomeado e fechado**: cada movimento existe com um papel
declarado, e a verificação passa a afirmar a identidade do catálogo em vez do seu tamanho.

O segundo problema é de escala de valores. Hoje o sistema tem **um** orçamento de
transição — 200ms, do conector da trilha, reaproveitado pela fusão cruzada da 009 — e
`tp/no-raw-visual-values` já impede que valor visual apareça cru no ponto de uso. Duração
e curva de animação ainda não têm essa disciplina, porque com três movimentos não
precisavam. Com um catálogo, precisam: sem escala finita, cada superfície nova traz o seu
próprio "0,35s, quase-ease-out", e o sistema perde a propriedade que o torna reconhecível.

### O que o arquivo de design mostra

Conferido nó a nó em `playlist-importer.pen`, o arquivo desenha **quatorze telas** que
compartilham a mesma casca — `Topbar`, `Step Rail`, `Ambient Backdrop` + `Backdrop Fade`,
`Content`, `Action Bar` — e trocam apenas o miolo de `Primary Column`. O arquivo é
estático e não anota movimento em lugar nenhum; o que ele oferece é a **evidência de
quais superfícies mudam de estado**, e é dela que sai o inventário abaixo.

| # | Superfície | Nós do arquivo | O que muda de estado | Complexidade |
| --- | --- | --- | --- | --- |
| 1 | Miolo da etapa | `Content` / `Primary Column` em todas as quatorze telas | O bloco inteiro é substituído a cada etapa; a casca em volta não | Média |
| 2 | Trilha de etapas | `Steps` → `Indicator Col` (`Dot` + `Connector`), `Step Text` | Disco pendente → atual → concluído; conector se preenche | Média |
| 3 | Lista de correspondências | `Cards Column` (`LNNaE`, `rwYsk`, `I7CapD`, `KbgMi`), `Status Badge` | A lista inteira aparece quando a busca termina; linhas saem quando descartadas; a contagem de seleção acompanha | **Alta** |
| 4 | Adesivos de Destinos | `Stickers Decor` `wv9Cp` — onze grupos com rotação própria de −10° a +15° | Nada: é composição decorativa, e é o único lugar do arquivo desenhado como cena | **Alta** |
| 5 | Chips de conexão | `Chip Spotify` / `Chip YouTube` na `Topbar` de todas as telas | Desconectado → conectado → sessão perdida | Baixa |
| 6 | Painel de fila | `Queue` → `Queue Spotify` / `Queue YouTube` com `Marker Col` | Conteúdo e ordem mudam conforme a seleção de destinos | Média |
| 7 | Cartões de destino | `Destination Card` `j8rruy`, dois por tela | Selecionado / não selecionado | Baixa |
| 8 | Grade de números | `Stats Grid` + `Stat` `fycxM` em `C13Hj`, `zCaeY`, `w1fTC` | Aparece pronta ao fim de cada serviço | Baixa |
| 9 | Fundo ambiente | `Ambient Backdrop` + `Backdrop Fade` | Nada; é substrato fixo | Baixa |
| 10 | Barra de progresso | `Progress Wrap` → `Progress Track` | Avança durante a busca | — |

Os dois candidatos de **animação mais complexa** que o arquivo revela são o **3** e o
**4**, e por motivos opostos. A lista de correspondências é complexa pela quantidade —
até cento e vinte elementos aparecendo de uma vez, com entrada, saída e acomodação de
posição, na única superfície que vizinha diretamente com trabalho em voo. Os adesivos são
complexos porque são onze objetos com transformação individual e nenhuma informação: é a
única superfície onde o movimento pode ser generoso sem custo semântico, e a única que o
arquivo já desenha como composição.

O **10** é fronteira negativa e está registrado aqui para não ser redescoberto: a barra é
o `<progress>` nativo, escolhido por acessibilidade, e o `value` dela já avança sozinho.
Substituí-la por um elemento animável trocaria semântica nativa por aparência.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Perceber o avanço no fluxo (Priority: P1)

Quem completa uma etapa vê a tela inteira ser substituída num único quadro. Nada indica
que houve avanço — nem que direção ele teve. Voltar de Entrada para Destinos e avançar de
Destinos para Entrada produzem exatamente a mesma imagem: um corte seco. A trilha à
esquerda é a única testemunha do movimento, e ela troca o estado do degrau também num
quadro, com o conector sendo a única coisa que transita.

Com a transição de etapa, o miolo sai numa direção e o novo entra na oposta, dentro do
orçamento do sistema, enquanto a casca — barra superior, trilha, barra de ação, fundo —
fica parada. O degrau que se completa preenche o disco e o conector abaixo dele.

**Why this priority**: é a única superfície que **todo** uso do produto atravessa, quatro
ou cinco vezes por sessão. É também a que mais depende do movimento para comunicar
direção, porque o layout de uma etapa e o da seguinte são estruturalmente iguais.

**Independent Test**: percorrer Configuração → Destinos → Entrada e voltar, verificando
que o conteúdo transita com direção, que nenhuma zona da casca se desloca, e que o foco
chega ao título da nova etapa no mesmo quadro em que chega hoje.

**Acceptance Scenarios**:

1. **Given** a etapa Destinos concluída, **When** o usuário avança, **Then** o miolo da
   etapa transita para o da Entrada com direção de avanço, e a barra superior, a trilha e
   a barra de ação não se deslocam em nenhum quadro.
2. **Given** a etapa Entrada, **When** o usuário volta para Destinos, **Then** a
   transição tem a direção oposta à do avanço.
3. **Given** uma transição de etapa em curso, **When** ela ainda não terminou, **Then** o
   título da nova etapa já recebeu o foco e os controles da nova etapa já respondem.
4. **Given** o degrau Destinos como atual, **When** ele se completa, **Then** o disco
   passa a preenchido com o glifo de conclusão e o conector abaixo se preenche, dentro do
   orçamento de transição do sistema.
5. **Given** uma recarga da página no meio do fluxo, **When** a etapa restaurada é
   renderizada, **Then** ela aparece sem animação de entrada.

---

### User Story 2 - Ver a revisão se formar (Priority: P2)

A busca de correspondências é a fase mais longa do produto: a vazão contratada é de duas
linhas por segundo, então uma lista de sessenta linhas leva meio minuto. Durante esse
tempo a tela mostra uma barra que avança e uma contagem que sobe, e as linhas encontradas
aparecem **de uma vez**, cada uma surgindo num quadro sem nenhuma relação visual com a
anterior. O resultado é uma lista que pisca em vez de crescer.

Com a entrada escalonada, as primeiras linhas se assentam em sequência em vez de a lista
inteira surgir num quadro. Quando o usuário descarta uma linha na revisão, ela sai animada
em vez de desaparecer, e as de baixo assumem a nova posição.

**Why this priority**: é a superfície de maior densidade de mudança do produto e a que o
arquivo desenha com mais elementos. É também o caso difícil, mas por quantidade e por
vizinhança: até cento e vinte elementos aparecem juntos, na única tela que fica ao lado de
uma requisição em voo — e é o que torna o teto de defasagem um requisito, não um refinamento.

**Independent Test**: rodar uma busca com rede mockada e verificar que, ao terminar, as
linhas entram escalonadas dentro do teto; que nada anima durante a busca; e que a contagem
anunciada a leitor de tela é idêntica à de hoje.

**Acceptance Scenarios**:

1. **Given** uma busca em curso, **When** ela termina e a lista aparece, **Then** as linhas
   entram escalonadas em vez de todas no mesmo quadro.
2. **Given** uma busca de cento e vinte linhas, **When** a lista aparece, **Then** a
   defasagem da última linha não excede o teto do sistema — o escalonamento não cresce com
   o tamanho da lista.
3. **Given** a revisão aberta, **When** o usuário descarta uma linha, **Then** ela sai
   animada e as linhas abaixo assumem a nova posição sem salto.
4. **Given** uma busca em curso, **When** ela está em voo, **Then** nenhuma animação nova
   está acontecendo na tela e a vazão permanece igual ou superior a duas linhas por segundo.
5. **Given** a busca cancelada, **When** o cancelamento é processado, **Then** as linhas já
   obtidas permanecem em cena e nenhuma fica presa num estado intermediário.
6. **Given** uma execução retomada, com linhas já em cena antes de a busca começar,
   **When** a busca termina, **Then** essas linhas permanecem imóveis e só as novas entram.

---

### User Story 3 - Reconhecer mudança de estado sem reler a tela (Priority: P3)

Três superfícies mudam de estado longe do ponto em que o usuário está olhando: o chip de
conexão na barra superior quando a autorização volta, o painel de fila quando a seleção
de destinos muda, e o próprio cartão de destino ao ser marcado. Hoje as três trocam num
quadro, e a mudança na periferia da tela é fácil de perder — especialmente o chip, que
fica no canto oposto ao do botão que o usuário acabou de acionar.

**Why this priority**: são microinterações de baixo custo e alto retorno de legibilidade,
mas nenhuma delas é bloqueante: o produto funciona sem elas, e a informação que carregam
já está escrita em texto.

**Independent Test**: conectar um serviço e verificar que o chip correspondente transita
de estado; alternar a seleção de destinos e verificar que a fila reflete a nova ordem com
movimento em vez de salto.

**Acceptance Scenarios**:

1. **Given** um serviço desconectado, **When** a autorização retorna com sucesso,
   **Then** o chip daquele serviço transita para o estado conectado.
2. **Given** os dois destinos selecionados, **When** o usuário desmarca o primeiro,
   **Then** o painel de fila remove a entrada e a restante assume a nova posição com
   movimento, sem salto.
3. **Given** um cartão de destino não selecionado, **When** o usuário o marca, **Then**
   a marcação tem retorno visual em movimento, e o estado permanece legível por forma.

---

### User Story 4 - A cena de Destinos (Priority: P4)

`Stickers Decor` é a única composição do arquivo desenhada como cena: onze objetos —
vinis, fitas, fones, estrelas, um botão de play, um rádio — espalhados no pé da coluna,
cada um com rotação própria. Hoje eles aparecem todos de uma vez, junto com o resto da
tela, e a composição perde exatamente a qualidade que a rotação individual sugere.

Com a entrada escalonada, os objetos assentam um a um quando a etapa entra em cena.

**Why this priority**: é puramente decorativo, não carrega informação nenhuma, e é o
primeiro item a ser cortado sob qualquer restrição — de movimento reduzido, de cores
forçadas ou de orçamento. Está na spec porque é o candidato de animação mais complexa que
o arquivo de design revela, e porque decidir explicitamente o seu limite é o que impede
que ele cresça depois.

**Independent Test**: entrar na etapa Destinos e verificar que os adesivos assentam
escalonados; ativar movimento reduzido e verificar que eles aparecem estáticos, sem
nenhuma etapa intermediária.

**Acceptance Scenarios**:

1. **Given** a etapa Destinos entrando em cena, **When** ela é renderizada, **Then** os
   adesivos assentam escalonados e a faixa não desloca nenhum conteúdo acima dela.
2. **Given** a preferência de movimento reduzido ativa, **When** a etapa Destinos entra,
   **Then** os adesivos aparecem no estado final, sem animação alguma.
3. **Given** o modo de cores forçadas, **When** a etapa Destinos é renderizada, **Then**
   nenhum tratamento é adicionado para preservar os adesivos.

---

### Edge Cases

- **Transição interrompida por outra transição.** O usuário avança e volta antes da
  primeira transição terminar; ou o retorno da autorização remonta a etapa no meio dela.
  Nenhum quadro pode ficar preso, e o estado final é sempre o da última intenção.
- **Diálogo abrindo sobre uma transição em curso.** A reautorização e a confirmação de
  descarte podem abrir a qualquer momento. O diálogo é o que segura o Princípio V e não
  pode esperar animação nenhuma para ficar operável.
- **Cancelamento durante a busca.** O cancelamento resolve a busca e a lista parcial aparece
  como qualquer outra; nenhuma linha pode ficar a meio caminho da entrada.
- **Lista longa.** Cento e vinte linhas aparecendo de uma vez; o escalonamento não pode
  acumular defasagem proporcional ao tamanho.
- **Troca de tema durante uma animação.** A árvore de zonas é idêntica entre os temas e a
  única divergência autorizada é cromática; a troca não pode disparar transição de layout.
- **Tela estreita e zoom de texto a 200%.** A casca colapsa em 64rem e a trilha deixa de
  ser renderizada; o movimento não pode introduzir rolagem horizontal nem depender de uma
  zona que não existe naquela largura.
- **Aviso de recuperação de rascunho aparecendo acima do miolo da etapa.** Ele entra e sai
  do fluxo e empurra o conteúdo abaixo.
- **Retorno a um serviço já concluído.** Reentrar numa fase concluída não é uma troca de
  estado e não deve animar — é o precedente que a fusão cruzada da 009 já estabeleceu.
- **Sessão perdida no meio da busca.** A fase muda para reautorização com resultado parcial
  guardado; ao retomar, as linhas já obtidas não são novidade e não entram animadas.

## Requirements _(mandatory)_

### O catálogo e a fechadura

- **FR-001**: O conjunto de movimentos autorizados MUST ser um **catálogo nomeado e
  fechado**. Cada movimento MUST existir com um nome, um papel declarado e a propriedade
  que anima.
- **FR-002**: A verificação executável MUST passar a afirmar a **identidade** do catálogo —
  cada movimento pelo nome e pela propriedade — em vez da contagem literal "exatamente
  três" de `009/FR-010b` e `009/SC-011`. Acrescentar movimento MUST exigir alterar o
  catálogo e a verificação no mesmo commit.
- **FR-003**: `src/ui/motion/` MUST continuar sendo o **único** diretório de `src/`
  autorizado a importar a biblioteca de movimento, e MUST NOT reexportá-la sob nenhuma
  forma.
- **FR-004**: As superfícies MUST pedir um **papel**, nunca configurar uma animação. Uma
  superfície que precise de duração, curva ou propriedade próprias MUST virar papel novo
  no catálogo, não parâmetro no ponto de uso — é a mesma disciplina de
  `<Icon role="advance" />`.
- **FR-005**: Os três movimentos da feature 009 — giro do disco, pulsação das barras e
  fusão cruzada — MUST permanecer com comportamento idêntico e MUST entrar no catálogo
  como estão.

### A escala de movimento

- **FR-006**: Duração e curva MUST vir de uma **escala finita** de tokens de movimento.
  Nenhum valor de duração ou de curva MUST aparecer cru no ponto de uso.
- **FR-007**: A escala MUST preservar o orçamento de **200ms** já fixado para o conector
  da trilha e para a fusão cruzada. Cada degrau adicional MUST ter justificativa registrada
  e um papel que só ele atende.
- **FR-008**: Uma verificação executável MUST falhar quando um valor de movimento aparecer
  fora da camada de tokens — no mesmo molde de `tp/no-raw-visual-values`.

### Propriedades, custo e trabalho em voo

- **FR-009**: Todo movimento do catálogo MUST animar apenas propriedades que não disparam
  recálculo de layout nem repintura da árvore. Isso mantém `009/FR-017a` e o estende ao
  catálogo inteiro.
- **FR-010**: A proibição categórica de animar posição e dimensão (`009/FR-010b`) MUST ser
  substituída por uma fronteira: animação de posição é admitida **apenas em superfície
  ociosa** — reordenação do painel de fila, acomodação da lista de revisão depois de um
  descarte. Fora dessas, permanece proibida.
- **FR-010a**: O que se preserva é a **razão** da proibição, não o texto dela. Cada
  superfície que anima posição MUST declarar que nenhuma requisição está em voo enquanto
  ela anima, e essa declaração MUST ser verificável.
- **FR-011**: Nenhuma superfície MUST animar posição ou dimensão **enquanto uma requisição
  daquele serviço estiver em voo** — linhas chegando durante a busca e cartão de criação
  são os dois casos concretos. Esse tipo de animação exige medir o layout a cada mudança e
  competiria com o trabalho que a tela está esperando; o pior caso é o YouTube, cujo lote é
  de um item e faz uma requisição por faixa.
- **FR-012**: A vazão contratada de **duas linhas por segundo** MUST permanecer intocada.
  Esta feature MUST NOT introduzir animação em nenhum momento com requisição em voo
  (FR-026a), e é isso — não uma medição nova — que preserva a vazão. `throughput.spec.ts`
  mede domínio puro e MUST continuar passando **sem alteração**: alterá-lo para "medir com
  movimento" seria encenar uma verificação, porque ele não renderiza nada.
- **FR-013**: O escalonamento de entrada MUST ter **teto absoluto** de defasagem: a última
  linha de uma lista longa MUST NOT esperar mais do que a de uma lista curta.

### Acessibilidade e informação

- **FR-014**: Cada movimento do catálogo MUST consultar a preferência de movimento
  reduzido e, sob ela, devolver o **estado final estático**. Sem animação, sem transição,
  sem exceção — a regra global de CSS não alcança a biblioteca, que anima por atualização
  de valor.
- **FR-015**: Nenhuma informação MUST depender exclusivamente de movimento. A contagem de
  textos exibidos e de controles alcançáveis MUST ser idêntica com e sem a preferência.
- **FR-016**: Nenhuma animação MUST atrasar a chegada do foco, o anúncio a leitor de tela
  ou a disponibilidade de um controle. O foco do título de etapa MUST chegar no mesmo
  quadro em que chega hoje.
- **FR-017**: Nenhuma animação MUST alterar a ordem de leitura nem a contagem anunciada
  pelas regiões vivas existentes.
- **FR-018**: Animação interrompida MUST resolver no estado final da última intenção, sem
  quadro preso e sem estado intermediário persistente.
- **FR-018a**: A animação que substitui uma interrompida MUST partir dos **valores
  correntes**, não do início nem do fim da anterior. Nenhum salto ao estado final precede a
  troca. Os quadros intermediários MUST NOT ser objeto de asserção — o que se afirma é o
  estado final e a ausência de nó preso.
- **FR-019**: No modo de cores forçadas MUST NOT ser adicionado tratamento para preservar
  elemento decorativo que o modo remove.
- **FR-020**: As superfícies animadas MUST continuar sem violação séria ou crítica no
  axe-core, nos dois temas e nas duas larguras verificadas.

### Transição de etapa (US1)

- **FR-021**: A troca de etapa MUST animar apenas o miolo da coluna principal. Barra
  superior, trilha, barra de ação e fundo ambiente MUST permanecer imóveis em todos os
  quadros.
- **FR-021a**: A transição MUST alcançar **apenas** as cinco etapas do assistente. As trocas
  de fase dentro da etapa Serviço — conexão, estimativa, busca, revisão, criação, conclusão —
  MUST NOT animar, preservando literalmente a proibição de `009/contracts/motion.md` §3. Uma
  fase que troca sozinha, sem ação do usuário, não tem direção a comunicar.
- **FR-021b**: O aviso de recuperação de rascunho MUST ficar **fora** do bloco que transita e
  MUST permanecer imóvel durante a troca de etapa — ele não pertence a nenhuma etapa e
  sobrevive a todas. Quando **ele mesmo** aparece, MUST animar a entrada, com o mesmo papel
  de entrada que a lista de revisão usa. Sendo um irmão só, a defasagem é zero. O descartar
  MUST continuar sendo imediato.
- **FR-022**: A transição MUST ter **direção**, e a direção do avanço MUST ser oposta à do
  retorno.
- **FR-023**: A transição MUST NOT produzir salto de altura da coluna, inclusive quando a
  etapa que entra é mais alta ou mais baixa que a que sai.
- **FR-024**: Montar já na etapa restaurada — recarga, retorno de autorização — MUST NOT
  animar entrada. Animar só existe quando uma etapa **substitui** outra em cena.
- **FR-025**: A mudança de estado do degrau da trilha MUST ser animada dentro do orçamento
  de transição, e a distinção entre pendente, atual e concluído MUST continuar sendo por
  **forma**, sem estado intermediário ambíguo.

### Revisão (US2)

- **FR-026**: A lista de correspondências MUST entrar escalonada quando a busca termina e
  ela aparece. _(Precisado na análise de artefatos: as linhas **não chegam em fluxo**. O
  ciclo despacha `search_done` com a lista inteira depois que a busca resolve, e durante a
  busca só a contagem avança. A entrada escalonada acontece, portanto, num momento em que
  **não há requisição em voo** — o que a mantém do lado permitido do FR-010.)_
- **FR-026a**: Durante a busca, nenhuma animação nova MUST ser introduzida. A tela continua
  com a barra nativa e a contagem, e as linhas de uma execução retomada — que já estão em
  cena antes da busca começar — MUST permanecer imóveis.
- **FR-027**: A saída de uma linha descartada na revisão MUST ser animada, e as linhas
  abaixo MUST assumir a nova posição com movimento, sem salto. Aqui a busca já terminou, e
  a fronteira do FR-010 admite a animação de posição.
- **FR-028**: A barra de progresso da busca MUST NOT ser animada nem substituída: ela é o
  `<progress>` nativo, escolhido por acessibilidade, e o `value` já avança sozinho. _(A
  justificativa original citava a CSP, e a análise de artefatos mostrou que essa parte não
  se sustenta — ver `research.md` §R2. A razão que sobra é a acessibilidade, e ela basta.)_

### Periferia (US3)

- **FR-029**: A troca de estado do chip de conexão MUST ser animada, e o estado MUST
  continuar legível por texto e por forma.
- **FR-030**: A mudança de conteúdo e de ordem do painel de fila MUST ser animada, sem
  salto das entradas remanescentes.
- **FR-031**: A marcação e a desmarcação de um cartão de destino MUST ter retorno visual por
  **fusão das cores que mudam** — preenchimento, contorno e a caixa de marcação. O cartão
  MUST NOT ser transformado: nada de escala, pressão ou deslocamento. O cartão é uma área
  clicável grande, e transformá-lo moveria texto que a pessoa está lendo.

### Adesivos (US4)

- **FR-032**: Os adesivos MUST entrar escalonados na **primeira** vez que a etapa Destinos
  aparece na sessão, e MUST permanecer `aria-hidden`.
- **FR-032a**: Nas visitas seguintes a Destinos os adesivos MUST aparecer já postos, sem
  animação. O sinalizador que registra a encenação MUST viver em memória e MUST NOT ser
  persistido — nem no rascunho, nem em chave nova de armazenamento.
- **FR-033**: A faixa de adesivos MUST NOT deslocar nenhum conteúdo acima dela em nenhum
  quadro.
- **FR-034**: Movimento **ocioso contínuo** MUST NOT ser introduzido. Os adesivos assentam
  e ficam imóveis; o fundo ambiente não se mexe. Movimento contínuo MUST continuar
  significando **trabalho em curso** — é o significado que a 009 fixou e o que torna o giro
  do disco legível. As únicas animações contínuas do produto permanecem sendo as duas da
  009, e ambas só existem enquanto uma requisição está em voo.

### Escopo

- **FR-035**: Esta feature MUST entregar as quatro histórias — US1 a US4 — sobre o mesmo
  catálogo e a mesma escala. A escala de movimento MUST ser exercitada por casos de
  natureza diferente: troca de bloco com direção, entrada escalonada de lista longa,
  acomodação de posição, transição de cor de periferia e entrada escalonada decorativa.
- **FR-036**: A entrada e a saída dos diálogos MUST NOT ser animada nesta feature. O
  elemento nativo abre e fecha por chamada imperativa e vive na camada de topo do
  navegador; animar a saída exigiria segurá-lo em cena depois do fechamento, e o diálogo de
  confirmação é o que segura o Princípio V.
- **FR-037**: Nenhuma regra de negócio MUST ser tocada. Fila, ciclo por serviço, cota,
  busca, revisão, criação, armazenamento e rede ficam exatamente como estão — esta é uma
  feature de superfície.
- **FR-038**: Nenhuma dependência nova MUST ser adicionada, e nenhum destino de rede MUST
  ser acrescentado.

### Documentação

- **FR-039**: `docs/style-guide.md` §Movimento MUST ser reescrito: a contagem "exatamente
  três" deixa de valer, e o catálogo, a escala de movimento e a fronteira do que não anima
  passam a ser o que a seção descreve.
- **FR-040**: `009/contracts/motion.md` MUST registrar que os seus §1 e §3 foram
  substituídos por esta feature, sem que os três movimentos da 009 mudem de comportamento.

### Key Entities

- **Movimento**: uma entrada do catálogo. Tem nome, papel declarado, propriedade animada,
  degrau da escala e comportamento sob movimento reduzido.
- **Catálogo de movimento**: o conjunto fechado de movimentos autorizados. É a estrutura
  que substitui a contagem literal como objeto da verificação.
- **Papel de movimento**: o que uma superfície pede. É a única coisa que uma superfície
  conhece; ela não conhece duração, curva nem propriedade.
- **Escala de movimento**: o conjunto finito de durações e curvas. Origem única dos
  valores, no molde da camada de tokens visuais.
- **Superfície animada**: uma região da interface que pede um papel. Declara se há
  requisição em voo enquanto ela anima — é o que decide se animação de posição é admitida
  ali.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: O catálogo de movimentos é fechado: a verificação nomeia cada movimento
  autorizado e falha tanto por movimento ausente quanto por movimento excedente.
- **SC-002**: Nenhum arquivo fora do diretório de movimento importa a biblioteca, e o
  diretório não a reexporta.
- **SC-003**: Nenhum valor de duração ou de curva aparece fora da camada de tokens de
  movimento.
- **SC-004**: Com a preferência de movimento reduzido ativa, a contagem de textos exibidos
  e de controles alcançáveis em cada tela é **idêntica** à contagem sem a preferência.
- **SC-005**: Nenhuma animação está em curso sob movimento reduzido, em nenhuma das telas.
- **SC-006**: A busca sustenta pelo menos **duas linhas por segundo**, e a verificação de
  vazão passa sem alteração — a feature não toca o caminho que ela mede.
- **SC-007**: Durante uma transição de etapa, o deslocamento das zonas da casca — barra
  superior, trilha, barra de ação — é **zero** em todos os quadros.
- **SC-008**: O foco chega ao título da nova etapa dentro do mesmo quadro em que chega
  hoje, e nenhum controle da nova etapa fica indisponível durante a transição.
- **SC-009**: A defasagem da última linha de uma lista de cento e vinte é igual à de uma
  lista de oito — o escalonamento tem teto e não cresce com a lista.
- **SC-010**: O acionamento do avanço e a etapa seguinte estar operável são separados por
  **zero** espera artificial: nenhum controle fica indisponível e nenhum foco espera
  animação. Medido pela ausência de atraso, não por cronômetro.
- **SC-011**: Nenhuma violação séria ou crítica no axe-core em nenhuma das telas animadas,
  nos dois temas.
- **SC-012**: De 320px a 1920px, nenhuma rolagem horizontal em nenhum quadro de nenhuma
  animação.
- **SC-013**: Interromper qualquer animação pela metade — avançar e voltar, cancelar a
  busca, abrir um diálogo — deixa a tela no estado final correto, sem elemento preso. Os
  quadros intermediários não são objeto de asserção.
- **SC-014**: Com a tela em repouso — nenhuma requisição em voo em nenhum serviço —
  nenhuma animação está em curso em nenhuma das telas.
- **SC-015**: Nenhuma animação de posição ou de dimensão ocorre em superfície que anima
  enquanto há requisição em voo.
- **SC-016**: Percorrer o ciclo completo de um serviço — conectar, estimar, buscar, revisar,
  criar, concluir — não produz nenhuma transição de tela. O movimento visível nesse trecho é
  exatamente o que a feature 009 já entregava, nem mais nem menos.
- **SC-017**: Entrar na etapa Destinos pela segunda vez numa mesma sessão mostra os adesivos
  já postos, sem animação.

## Assumptions

- A biblioteca de movimento **já está instalada** e foi escolhida pelo autor do projeto na
  feature 009, com a exceção à simplicidade proporcional registrada no Complexity Tracking
  de `009/plan.md`. Esta feature não reabre a escolha da ferramenta; ela estende a
  fechadura em volta dela.
- O arquivo de design **não anota movimento**. Todo movimento desta spec é derivado das
  mudanças de estado que o arquivo evidencia, não de especificação visual dele — o que
  significa que o guia de estilo passa a ser a origem única do movimento, e não o arquivo.
- O orçamento de 200ms permanece o degrau de referência do sistema, herdado do conector da
  trilha e reaproveitado pela fusão cruzada da 009.
- O projeto Playwright de movimento reduzido **já existe** e é o mecanismo de verificação
  de ponta a ponta da preferência.
- A árvore de zonas é idêntica entre os temas, e a única divergência autorizada continua
  sendo cromática — nenhuma animação é específica de um tema.
- Nenhum texto de interface novo é esperado. Se algum for necessário, ele vem de `src/i18n/`
  como qualquer outro.
- As superfícies fora do inventário adotado — grade de números, fundo ambiente, entrada de
  diálogo — ficam como estão, e a decisão está registrada aqui para não ser redescoberta.
