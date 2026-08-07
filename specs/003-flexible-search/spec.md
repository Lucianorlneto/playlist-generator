# Feature Specification: Busca Sem Separador e por Título Isolado (Flexible Search)

**Feature Directory**: `specs/003-flexible-search`

**Feature Branch**: `003-flexible-search` (trabalho em `feat/name-match`)

**Created**: 2026-08-06

**Status**: Draft — esclarecimentos resolvidos (sessão 2026-08-06), pronta para `/speckit-plan`

**Input**: User description: "Vamos agora mudar um pouco como funciona a busca. Primeiro analisar se é possível buscarmos apenas pelo nome da música e, utilizando a feature de escolher entre os resultados mais aproximados, selecionar a música correta. É necessário colocar o nome do artista? Também vamos analisar se é possível tirar o separator de -, by ou qualquer outro e colocar direatmente, por exemplo "Não sei viver sem ter voce" ou "nao sei viver sem ter voce cpm 22" e a busca funciona."

**Convenção de referência**: requisitos das features anteriores aparecem como `001/FR-xxx` e `002/FR-xxx`. Requisitos sem prefixo pertencem a este documento.

---

## Análise de Viabilidade (resposta direta às duas perguntas)

O pedido é, antes de tudo, um pedido de análise. As duas perguntas têm resposta objetiva contra o comportamento atual, e é dela que os requisitos abaixo derivam.

### Pergunta 1 — É possível buscar só pelo nome da música? É necessário o artista?

**Sim, é possível. E não, o artista não é necessário para a busca funcionar** — mas hoje ele é o que separa acerto automático de escolha manual, e essa diferença é grande demais para ficar implícita.

Os dois catálogos aceitam consulta só de título. O que trava não é a busca, é a **classificação**: a confiança de um item é composta por título e artista, e o artista pesa uma fração fixa do total. Quando a linha não declara artista, não há nada a comparar daquele lado — a pontuação máxima alcançável fica **abaixo do limiar de "Confiante" dos dois serviços**, por construção. O efeito prático é que **toda** linha sem artista cairia em "Incerta" e exigiria uma escolha manual, uma por linha.

Isso não é um defeito: é exatamente a "feature de escolher entre os resultados mais aproximados" que o pedido menciona, e ela já existe (`001/FR-023`, `002/FR-024`). Mas transforma uma lista de 100 títulos isolados em 100 interações. O trabalho desta feature, portanto, não é "fazer funcionar" — é **tornar a matemática de confiança honesta com o que a linha declarou** e decidir quando uma linha sem artista pode ser confiada sozinha. É a única questão desta spec com resposta não óbvia, e está em Clarifications.

**Contrapartida que não pode ser escondida do usuário**: sem artista, "Amor" ou "Fire" devolvem dezenas de gravações diferentes, todas legítimas. Nenhuma pontuação resolve isso — só o olho humano. A interface precisa dizer por que aquela linha exige atenção, em vez de deixar o usuário adivinhar.

### Pergunta 2 — É possível tirar o separador e escrever direto?

**Sim, e o obstáculo é menor do que parece.**

Hoje o separador (`-`, `–`, `—`, `by`) **não é uma questão de busca — é um portão de admissão**. Uma linha sem separador reconhecível é marcada como inválida e **nunca chega a ser buscada**: nenhuma requisição é emitida para ela. Os dois exemplos do pedido, `Não sei viver sem ter voce` e `nao sei viver sem ter voce cpm 22`, falham hoje **antes** de qualquer chamada de rede. Não é o catálogo que os rejeita; é o app.

Remover o portão é viável e **não exige adivinhar onde termina o título e começa o artista**. Adivinhar seria a abordagem frágil: qualquer heurística de corte erraria em "Nossa Senhora Aparecida", "CPM 22" e "Charlie Brown Jr." A alternativa robusta é não cortar — mandar a linha inteira como consulta de texto livre e comparar o **conjunto de termos da linha** contra **título e artista da candidata tomados juntos**:

| Linha escrita                          | Candidata "Não Sei Viver Sem Ter Você" — CPM 22           | Leitura                                                        |
| -------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------- |
| `nao sei viver sem ter voce cpm 22`    | todos os termos da linha encontram destino (título + artista) | correspondência forte, artista confirmado sem ter sido declarado |
| `Não sei viver sem ter voce`           | os termos cobrem o título; o artista fica sem reivindicação   | correspondência de título, artista desconhecido                  |

É justamente essa diferença — termos do artista reivindicados ou não — que distingue os dois exemplos do pedido **sem precisar de separador algum**. Acento e caixa já são irrelevantes hoje: a normalização remove ambos antes de qualquer comparação, então `voce` e `você` já são a mesma coisa.

**Três riscos reais**, endereçados nos requisitos:

1. **Perda de precisão onde ela existia.** O formato explícito permite consulta por campos no catálogo musical, que é mais precisa que texto livre. A solução é não trocar uma coisa pela outra: quem escrever com separador continua tendo o caminho preciso (FR-007).
2. **Falso corte, que já existe hoje.** `Marília Mendonça - Ao Vivo` é hoje partido em título `Marília Mendonça` e artista `Ao Vivo`. Tirar a obrigatoriedade do separador não cria esse problema, mas abre a saída para ele: quando o corte não produzir nada utilizável, a linha inteira pode ser tentada como texto livre (FR-009).
3. **Custo de cota.** No serviço de vídeo cada busca custa uma fatia fixa e considerável do orçamento diário. Uma segunda tentativa por linha não é grátis, e a estimativa que hoje bloqueia listas grandes precisa contar com ela. É o segundo esclarecimento pendente.

### O que muda nas features anteriores

| Requisito herdado | Situação                                                                                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `001/FR-012`      | **Ampliado**: o formato `música - artista` deixa de ser o único aceito e passa a ser o formato **recomendado**, não o obrigatório.                |
| `001/FR-013`      | **Mantido**: os separadores continuam reconhecidos, com a mesma regra do último separador e do espaço obrigatório em volta do hífen.              |
| `001/FR-015`      | **Substituído**: linha sem separador deixa de ser inválida. Só permanece inválida a linha sem qualquer conteúdo alfanumérico.                     |
| `001/FR-020`      | **Condicionado**: a busca por campos continua obrigatória **onde a linha declarou os campos**; a linha livre usa texto livre por não ter campos.  |
| `001/FR-021`      | **Ajustado**: a comparação passa a considerar o que a linha declarou, em vez de assumir sempre título e artista.                                  |
| `002/FR-023`      | **Mantido**: as três classes e os limiares por serviço continuam; muda o que entra na conta antes do limiar.                                     |
| Demais            | Intactos, inclusive a revisão obrigatória antes de qualquer escrita (`001/FR-031`) e a propagação de correções de texto entre serviços (`002/FR-014`). |

### Gate constitucional

Esta feature **não** exige emenda. Nenhum destino de rede novo (Princípio II — a busca usa os mesmos endpoints já autorizados), nenhum componente de servidor (Princípio I), e a mudança **reforça** o Princípio V em vez de afrouxá-lo: mais linhas chegam à revisão humana, e nenhuma linha nova é escrita sem confirmação. Toda a lógica nova é determinística e pertence ao domínio puro (Princípio III), com verificação executável exigida por FR-020 e FR-022 (Princípio IV).

---

## Clarifications

### Session 2026-08-06

- **Q**: Quando uma linha **sem artista declarado** pode ser marcada como Confiante automaticamente? → **A**: Confiante com **margem** — a melhor candidata precisa passar o limiar do serviço **e** abrir uma margem mínima sobre a segunda. Títulos distintivos passam sozinhos; títulos genéricos caem em escolha manual. (FR-014, FR-016)
- **Q**: A segunda tentativa de busca vale também no serviço de vídeo, onde ela consome cota? → **A**: Sim, nos dois serviços, com a estimativa de cota já contando com a tentativa extra. (FR-009, FR-010)

**Consequência derivada da segunda decisão, decidida junto**: reservar a tentativa extra para **todas** as linhas dobraria o custo de busca previsto e bloquearia por cota listas que hoje passam — uma regressão que a decisão não pretendia comprar. A estimativa portanto reserva a tentativa extra apenas para as **linhas efetivamente elegíveis** (aquelas cuja consulta alternativa difere da primária), e a execução **respeita essa reserva como teto**: esgotada a reserva, nenhuma nova tentativa é feita. É o que torna SC-007 demonstrável sem estrangular o serviço de vídeo. A elegibilidade é contagem exata, determinística e calculável antes de qualquer requisição — não um valor de calibração. (FR-010, FR-010a)

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Colar uma lista sem separador e a busca funcionar (Priority: P1)

Uma pessoa copia a lista de músicas de onde ela existe — uma conversa, um bloco de notas, a descrição de um vídeo — e cola no app. As linhas vêm como as pessoas escrevem: `nao sei viver sem ter voce cpm 22`, `Charlie Brown Jr Zoio de Lula`, sem hífen, sem acento, sem padrão. Hoje nenhuma dessas linhas é sequer buscada. Depois desta feature, todas são.

**Why this priority**: é o portão. Sem isso, nada mais desta feature tem efeito — as linhas não chegam à busca, então não há o que classificar nem o que escolher. É também o único item que sozinho já entrega valor completo: uma lista inteira que antes era rejeitada passa a virar playlist.

**Independent Test**: colar uma lista em que nenhuma linha tem separador, verificar que todas entram na busca e que a revisão apresenta candidatas para cada uma.

**Acceptance Scenarios**:

1. **Given** a linha `nao sei viver sem ter voce cpm 22` sem separador algum, **When** a busca do serviço é executada, **Then** a linha é buscada e a gravação de CPM 22 aparece como a candidata mais bem pontuada.
2. **Given** a linha `Não sei viver sem ter você - CPM 22` no formato explícito, **When** a busca é executada, **Then** o resultado é equivalente ao da linha sem separador — o formato não muda qual faixa vence.
3. **Given** uma lista com as duas formas misturadas na mesma colagem, **When** a busca é executada, **Then** cada linha é tratada pela forma que ela própria declarou, sem que uma contamine a outra.
4. **Given** a linha `nao sei viver sem ter voce cpm 22` escrita sem acento e em caixa baixa, **When** a busca é executada, **Then** o resultado é idêntico ao da mesma linha acentuada e capitalizada.

---

### User Story 2 — Buscar só pelo título e escolher a certa entre as candidatas (Priority: P2)

Alguém lembra do nome da música mas não do artista — ou não quer digitar o artista de 40 linhas. Escreve só `Não sei viver sem ter voce`, vê as candidatas mais próximas lado a lado e aponta a certa.

**Why this priority**: é a segunda metade do pedido e o caso que mais depende de julgamento humano. Depende da US1 apenas por conveniência de teste, mas entrega valor próprio: encurta a digitação em troca de uma escolha por linha.

**Independent Test**: colar uma lista só de títulos, verificar que cada linha traz candidatas ordenadas por proximidade e que a escolha manual leva a faixa correta à playlist.

**Acceptance Scenarios**:

1. **Given** a linha `Não sei viver sem ter voce` sem artista, **When** a busca é executada, **Then** a linha recebe candidatas ordenadas por proximidade e a revisão indica que não houve artista informado.
2. **Given** uma linha sem artista com várias gravações diferentes do mesmo título, **When** a revisão é aberta, **Then** as candidatas exibem o que as distingue — artista ou canal, duração, e o indício de versão quando houver — de modo que a escolha seja possível sem sair do app.
3. **Given** uma linha sem artista já buscada, **When** o usuário completa a linha com o nome do artista na revisão, **Then** apenas aquela linha é buscada de novo e as demais permanecem intactas.
4. **Given** um título genérico como `Amor`, que não tem candidata dominante, **When** a busca é executada, **Then** o item não é selecionado por padrão e a interface deixa claro que a escolha é do usuário.

---

### User Story 3 — Quem escreve no formato completo não perde precisão (Priority: P3)

Quem já usa `música - artista` continua tendo o melhor resultado possível: a informação extra que essa pessoa se deu ao trabalho de fornecer continua sendo usada como informação, não descartada em nome da uniformidade.

**Why this priority**: é garantia de não regressão. Não entrega capacidade nova, mas protege o que a feature 001 calibrou. Sem ela, a feature seria uma troca em vez de um ganho.

**Independent Test**: rodar a lista de referência da feature 001, no formato explícito, e comparar a taxa de acerto automático antes e depois da mudança.

**Acceptance Scenarios**:

1. **Given** a lista de referência escrita no formato explícito, **When** a busca é executada após esta feature, **Then** a taxa de acerto automático não é inferior à medida antes dela.
2. **Given** a linha `Jay-Z - 99 Problems`, cujo artista contém hífen sem espaços, **When** a linha é analisada, **Then** ela continua sendo lida como título e artista, sem corte no meio do nome.
3. **Given** uma linha com separador cujo corte não produz nenhuma candidata utilizável, **When** a busca é executada, **Then** o sistema tenta a linha inteira como texto livre antes de declarar que não encontrou.

---

### User Story 4 — Saber de antemão o custo e o esforço (Priority: P4)

Antes de começar, a pessoa vê quantas linhas provavelmente exigirão escolha manual e — no serviço com orçamento diário — se a lista ainda cabe considerando a possibilidade de uma segunda tentativa por linha.

**Why this priority**: evita duas surpresas caras: descobrir no meio da revisão que 80 das 100 linhas precisam de clique, e descobrir no meio da execução que a cota acabou porque a estimativa não contava com as novas tentativas.

**Independent Test**: preparar uma lista majoritariamente sem artista, verificar o aviso antes de iniciar e conferir que a estimativa de cota apresentada não fica abaixo do consumo real ao final.

**Acceptance Scenarios**:

1. **Given** uma lista em que a maioria das linhas não declara artista, **When** o usuário está prestes a iniciar a busca, **Then** o sistema informa quantas linhas provavelmente exigirão escolha manual.
2. **Given** uma lista destinada ao serviço com orçamento diário, **When** a estimativa é apresentada, **Then** ela já considera a possibilidade da segunda tentativa e o consumo real ao final da execução não a excede.

---

### Edge Cases

- **Linha só com pontuação, numeração ou emoji** (`---`, `3.`, `🎵`): sem conteúdo alfanumérico após normalização, permanece inválida — é o único caso de invalidez restante.
- **Linha com separador e um dos lados vazio** (`- Artista`, `Música -`): hoje é inválida; passa a ser tratada como texto livre do que sobrou, sem lado vazio.
- **Título que contém o separador** (`Marília Mendonça - Ao Vivo`, `Killed by Death`): o corte pelo último separador continua valendo, e o texto livre da linha inteira é a rede de segurança quando ele erra.
- **Reserva de nova tentativa esgotada no meio da lista** (FR-010a): as linhas seguintes que precisariam de segunda tentativa seguem para a revisão como não encontradas. O usuário precisa entender que foi teto de cota, não ausência no catálogo — caso contrário, corrigirá a linha achando que escreveu errado.
- **Linha sem artista com uma única candidata**: não há segunda contra a qual medir a margem; a linha fica Incerta (FR-014b).
- **Empate técnico entre a 1ª e a 2ª candidata** de uma linha sem artista (duas gravações do mesmo título por artistas diferentes, ambas acima do limiar): margem insuficiente, escolha humana obrigatória — é exatamente o caso que a regra de margem existe para pegar.
- **Linha que é só o nome do artista** (`CPM 22`): o catálogo devolve gravações daquele artista, nenhuma correspondendo ao que foi pedido. O item não pode ser selecionado por padrão; a ausência de correspondência de título é o sinal.
- **Título genérico e curto** (`Amor`, `Fire`, `Eu`): muitas candidatas plausíveis, nenhuma dominante. Escolha humana obrigatória.
- **Mesma faixa escrita em formatos diferentes na mesma lista** (`Zoio de Lula - Charlie Brown Jr` e `zoio de lula charlie brown jr`): é duplicata de entrada e precisa ser reconhecida como tal antes da busca, não só depois da escolha.
- **Linha muito longa** (uma frase inteira colada por engano): é buscada como qualquer outra e provavelmente não encontra nada; não pode travar nem consumir tentativa extra indefinidamente.
- **Linha sem artista que resolve para a mesma gravação de outra linha**: continua sendo tratada pela deduplicação por resultado já existente.
- **Correção de texto propagada entre serviços** (`002/FR-014`): completar o artista de uma linha na revisão do primeiro serviço vale para a busca do segundo, incluindo quando a linha original não tinha separador.
- **Lista reduzida para o serviço seguinte** (`002/FR-013`): a redução opera sobre as mesmas linhas, independentemente da forma em que foram escritas.

---

## Requirements _(mandatory)_

### Functional Requirements

#### Entrada e leitura da linha

- **FR-001**: O sistema DEVE aceitar como pesquisável **qualquer linha não vazia** que contenha ao menos um caractere alfanumérico, com ou sem separador. A presença de separador NÃO DEVE ser condição para que a linha seja buscada. Substitui `001/FR-015`.
- **FR-002**: O sistema DEVE distinguir três formas de linha e tratar cada uma pelo que ela declarou: **(a)** título e artista separados por separador reconhecido; **(b)** texto livre sem separador, que pode ou não conter o artista; **(c)** título isolado. Na forma (b) o sistema NÃO DEVE tentar inferir onde termina o título e começa o artista.

  **Nota sobre (b) e (c)**: no momento da leitura da linha, (b) e (c) são **indistinguíveis** — sem separador não há como saber se o artista está ali. As duas são, portanto, uma **única forma de análise** (a forma livre), e a distinção entre elas é **derivada dos dados** em tempo de pontuação: se os termos do artista da melhor candidata foram reivindicados pela linha, ela se comportou como (b); se não, como (c). Onde este documento diz "forma (b)" ou "forma (c)" isoladamente, leia-se "a forma livre no comportamento correspondente".
- **FR-003**: O sistema DEVE continuar reconhecendo os separadores de `001/FR-013` com as mesmas regras: o **último** separador da linha define o corte, e o hífen e os travessões exigem espaço em volta, para que nomes como `Jay-Z` não sejam partidos.
- **FR-004**: Uma linha DEVE ser considerada inválida **apenas** quando não restar conteúdo alfanumérico após a normalização. Linha inválida NÃO DEVE interromper o processamento das demais (mantém a garantia de `001/FR-015`).
- **FR-005**: Prefixo de numeração, espaços de borda, acentuação e diferença de caixa DEVEM continuar irrelevantes para o resultado, em todas as três formas.
- **FR-006**: O texto da interface na etapa de entrada DEVE informar que o separador é **opcional** e explicar, em uma frase, que declarar o artista aumenta o acerto automático e reduz a escolha manual. NÃO DEVE apresentar o formato com separador como obrigatório.

#### Busca

- **FR-007**: Para a linha na forma (a), o sistema DEVE usar a busca por campos onde o catálogo a oferecer, preservando a precisão de `001/FR-020`.
- **FR-008**: Para a linha na forma livre (b/c), o sistema DEVE consultar o catálogo com a linha inteira como texto livre.
- **FR-009**: Quando a primeira consulta de uma linha não produzir nenhuma candidata utilizável, o sistema DEVE fazer **no máximo uma** nova tentativa por linha e por serviço, com a linha inteira como texto livre. A política é **a mesma nos dois serviços**, inclusive no que tem orçamento diário — sujeita ao teto de FR-010a. Uma candidata é "utilizável" quando alcança ao menos o piso de pontuação abaixo do qual o resultado é considerado ruído; zero resultados e resultados todos abaixo do piso contam igualmente como não utilizáveis.
- **FR-010**: A estimativa de cota do serviço com orçamento diário DEVE contabilizar as novas tentativas de FR-009 e NÃO DEVE subestimar o consumo real da execução. A estimativa NÃO DEVE, porém, reservar tentativa extra para todas as linhas: a reserva DEVE cobrir exatamente **as linhas efetivamente elegíveis a retentativa** — aquelas cuja consulta alternativa difere da primária —, para não bloquear por cota listas que hoje cabem. A elegibilidade DEVE ser determinística e calculável antes de qualquer requisição.
- **FR-010a**: A reserva de FR-010 DEVE funcionar como **teto de execução**: enquanto houver reserva, a nova tentativa de FR-009 é feita; esgotada a reserva, nenhuma nova tentativa é feita naquela execução, e as linhas afetadas seguem para a revisão como não encontradas. É esse teto que torna o consumo real limitado pela estimativa por construção, e não por estimativa otimista.
- **FR-011**: O sistema NÃO DEVE emitir consulta alguma para linha inválida (FR-004), nem consumir cota por ela.

#### Pontuação e classificação

- **FR-012**: A pontuação de proximidade DEVE ser calculada **sobre o que a linha declarou**. Quando a linha não declara artista, a ausência NÃO DEVE ser contada como divergência: a comparação se concentra no que foi declarado, sem penalidade estrutural que impeça a linha de alcançar as classes superiores.
- **FR-013**: Para a linha na **forma livre** — isto é, (b) e (c) igualmente, que são a mesma forma de análise segundo FR-002 —, o sistema DEVE comparar o conjunto de termos da linha contra **título e artista da candidata tomados em conjunto**, de modo que termos do artista presentes na linha contem a favor da candidata que os satisfaz, e sua ausência não conte contra.
- **FR-014**: A classificação nas três classes existentes e os limiares por serviço de `002/FR-023` DEVEM ser preservados. Para a linha **sem artista declarado**, a classe Confiante DEVE exigir **duas condições simultâneas**: a melhor candidata alcança o limiar de Confiante do serviço **e** supera a segunda melhor por uma **margem mínima**. Falhando qualquer uma das duas, a linha é Incerta.
- **FR-014a**: A margem mínima de FR-014 DEVE ser um valor de calibração por serviço, fixado contra a lista de referência, e DEVE ser aplicada **apenas** às linhas sem artista declarado — a classificação das linhas que declaram artista permanece exatamente como hoje (FR-021).
- **FR-014b**: Quando existir apenas **uma** candidata para uma linha sem artista declarado, não há segunda contra a qual medir margem. Nesse caso a linha DEVE ser tratada como Incerta: candidata única não é evidência de que ela seja a certa, apenas de que o catálogo devolveu pouco.
- **FR-015**: Os indícios de versão diferente DEVEM continuar rebaixando a classificação como em `002/FR-025`, em todas as três formas de linha.
- **FR-016**: Nenhuma faixa DEVE ser marcada para inclusão por padrão quando a linha não declarou artista e a regra de FR-014 não a classificou como Confiante.

#### Revisão

- **FR-017**: A revisão DEVE informar, por item, **por que** aquele item exige atenção, distinguindo ao menos quatro situações entre si: (i) a linha não declarou artista e nenhuma candidata se destacou por margem suficiente; (ii) há indício de versão diferente; (iii) a busca não encontrou nada; (iv) a segunda tentativa não foi feita porque a reserva de cota se esgotou (FR-010a). O caso (iv) NÃO DEVE ser apresentado como "não encontrada", porque a causa e a ação do usuário são diferentes.
- **FR-018**: As até 5 candidatas alternativas de `001/FR-023` e `002/FR-024` DEVEM estar disponíveis para **qualquer** linha buscada, inclusive as das formas (b) e (c).
- **FR-019**: O usuário DEVE poder completar ou corrigir o texto de uma linha na revisão e refazer a busca **apenas daquela linha**, sem refazer as demais. No serviço com orçamento diário, o custo dessa nova busca DEVE ser contabilizado no consumo do dia.

#### Duplicatas e compatibilidade

- **FR-020**: A detecção de duplicata de entrada DEVE reconhecer como a mesma linha a mesma faixa escrita em formas diferentes — com e sem separador —, produzindo a mesma chave para ambas. A deduplicação por resultado já existente permanece inalterada.
- **FR-021**: Nenhuma linha hoje corretamente interpretada no formato explícito PODE passar a ser interpretada de forma diferente por causa desta mudança.
- **FR-022**: As garantias herdadas DEVEM permanecer válidas para as novas formas de linha, em especial: revisão obrigatória antes de qualquer escrita (`001/FR-031`), propagação de correções de texto entre serviços (`002/FR-014`), redução da lista para destinos posteriores (`002/FR-013`) e ordem original das linhas preservada (`001/FR-019`).

### Key Entities _(include if feature involves data)_

- **Linha de entrada**: ganha a noção de **forma declarada** — explícita (título e artista), livre (texto único que pode conter o artista) ou título isolado. É essa forma que determina como a linha é consultada e como é pontuada. O texto original continua preservado sem alterações.
- **Item de correspondência**: ganha o **motivo de atenção** — o que faz aquele item exigir olhar humano: artista não informado, ausência de candidata dominante, indício de versão diferente, ou nada encontrado. É o que a revisão exibe.
- **Estimativa de cota**: passa a considerar a política de nova tentativa por linha ao calcular o consumo previsto.

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% das linhas com ao menos um caractere alfanumérico chegam à busca, contra 0% das linhas sem separador hoje.
- **SC-002**: Em uma lista de referência de 50 faixas escritas **sem separador mas com o artista** (`título artista`), a taxa de acerto automático fica no máximo **5 pontos percentuais** abaixo da taxa das mesmas 50 faixas escritas no formato explícito, no catálogo musical.
- **SC-003**: Em uma lista de referência de 30 faixas escritas **só com o título**, a gravação pretendida está entre as candidatas apresentadas em pelo menos **90%** dos casos.
- **SC-004**: Em nenhuma linha sem artista declarado o sistema marca para inclusão, por padrão, uma gravação de artista diferente do pretendido na lista de referência — **zero ocorrências**.
- **SC-005**: A taxa de acerto automático da lista de referência no **formato explícito** não cai em relação à medição anterior a esta feature — nenhuma regressão.
- **SC-006**: Escrever uma linha sem acento e em caixa baixa produz exatamente o mesmo resultado que escrevê-la acentuada e capitalizada, em **100%** dos casos da lista de referência.
- **SC-007**: O consumo real de cota de uma execução no serviço com orçamento diário **nunca excede** a estimativa apresentada antes de iniciar — inclusive no cenário em que **todas** as linhas precisam de segunda tentativa, caso em que o teto de FR-010a é atingido e as tentativas param.
- **SC-008**: Uma lista de 20 títulos isolados é revisada e confirmada por um usuário em menos de **4 minutos**, contando as escolhas manuais.
- **SC-009**: A vazão mínima de 2 linhas por segundo exigida pela constituição é mantida, inclusive nas linhas que exigem segunda tentativa.
- **SC-010**: Na lista de referência de 30 faixas escritas **só com o título**, **no catálogo musical**, ao menos **60%** são resolvidas automaticamente pela regra de margem, sem exigir escolha manual — é o que separa a decisão adotada da alternativa "nunca automática", que resolveria 0%. Combinado com SC-004 (zero seleções automáticas erradas), define a calibração aceitável da margem. **No catálogo de vídeo a meta não se aplica**: um título isolado devolve clipe, áudio, ao vivo e cover com títulos quase idênticos entre si, e forçar a margem a abrir ali significaria escolher o cover em silêncio. Lá o critério é SC-003, que não pressupõe resolução automática.
- **SC-011**: Nenhuma linha que **declara** artista muda de classificação por causa desta feature: a regra de margem não as alcança (FR-014a) — **zero** mudanças de classe na lista de referência em formato explícito.

---

## Assumptions

- **A lista de referência existe e é a mesma da 001/002**, estendida com as três formas de escrita. Sem um conjunto com resposta esperada, SC-002 a SC-006 não são verificáveis; a extensão dessa lista faz parte do trabalho.
- **Não haverá inferência de onde termina o título.** Qualquer heurística de corte em linha sem separador erraria sistematicamente em nomes de artista com várias palavras e em títulos longos. A comparação conjunta de FR-013 foi adotada por ser mais robusta e por não exigir adivinhação.
- **A ordem das candidatas devolvida pela plataforma continua não sendo tratada como verdade**: a ordenação exibida é sempre a da pontuação local, como já é hoje.
- **O formato explícito continua sendo o recomendado na interface**, por dar acesso à busca por campos e por produzir mais acerto automático. Recomendado, não obrigatório.
- **Nenhum destino de rede novo é necessário**: as consultas usam os mesmos endpoints de busca já autorizados por provedor.
- **O limite de 5 candidatas por linha permanece.** Ampliá-lo para linhas ambíguas custaria mais cota no serviço de vídeo sem ganho demonstrado; se a lista de referência mostrar que 5 é insuficiente para títulos genéricos, isso vira feature própria.
- **A calibração de limiares é trabalho de planejamento**, não desta spec: os valores por serviço são fixados contra a lista de referência, e SC-002 a SC-005 são o critério que os valida. Esta feature acrescenta **um único** valor de calibração: a margem mínima de FR-014a, validada por SC-004 (teto) e SC-010 (piso). A reserva de FR-010 **não** é valor de calibração — é contagem exata das linhas elegíveis.
- **A reserva de nova tentativa é por execução de serviço**, não por dia: ela é dimensionada junto com a estimativa daquela lista e não se acumula entre execuções.

---

## Out of Scope

- Inferir o artista a partir de fontes externas ao texto colado (histórico do usuário, playlists existentes, catálogo local).
- Sugerir correções de digitação ao usuário ("você quis dizer…") antes da busca.
- Importar de URL, arquivo ou imagem — a entrada continua sendo texto colado.
- Ampliar o número de candidatas exibidas por linha.
- Busca incremental ou autocompletar enquanto o usuário digita.
- Aprender com as escolhas anteriores do usuário para melhorar a pontuação de linhas futuras.

---

## Decisões e Alternativas Descartadas

Registro das duas decisões da sessão de 2026-08-06, com as alternativas que foram consideradas e recusadas. Serve ao planejamento: se a calibração mostrar que a decisão adotada não atinge SC-004 ou SC-010, é aqui que estão as saídas já mapeadas.

### D1 — Confiança para linha sem artista declarado → **opção A adotada**

**Contexto**: sem artista declarado, a pontuação máxima alcançável fica abaixo do limiar de Confiante dos dois serviços, o que jogaria **toda** linha sem artista em escolha manual.

**Decisão**: Confiante exige limiar **e** margem mínima sobre a segunda candidata (FR-014).

**Alternativas consideradas**:

| Opção                  | Regra                                                                        | Por que foi (ou não foi) adotada                                                                                                                                                              |
| ---------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A — adotada**        | Limiar do serviço **e** margem mínima sobre a segunda candidata               | Títulos distintivos passam sozinhos; genéricos caem em escolha manual. Equilibra esforço e segurança ao custo de um valor de calibração a mais.                                                  |
| B — descartada         | Nunca automática: toda linha sem artista nasce Incerta                        | Seria a regra mais simples de explicar e testar, mas cobra uma interação por linha sempre — 100 títulos isolados viram 100 cliques, o que inviabiliza listas grandes. **Saída se SC-004 falhar.** |
| C — descartada         | Só o limiar, sem margem                                                       | Menor esforço manual, mas escolheria em silêncio a gravação de outro artista quando o título é comum — o erro que a constituição chama de "o pior erro possível neste produto".                    |

### D2 — Segunda tentativa de busca no serviço com orçamento diário → **opção A adotada, com teto**

**Contexto**: a segunda tentativa recupera falso corte e grafia divergente, mas no serviço de vídeo cada busca consome fatia fixa e considerável do orçamento diário.

**Decisão**: vale nos dois serviços, com a estimativa contabilizando a tentativa extra (FR-009, FR-010) — **acrescida** do teto de reserva de FR-010a, que não estava na pergunta original e foi adicionado para que a decisão não bloqueasse por cota listas que hoje passam.

**Alternativas consideradas**:

| Opção                  | Regra                                                     | Por que foi (ou não foi) adotada                                                                                                                                            |
| ---------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A — adotada**        | Nos dois serviços, com estimativa contando a tentativa     | Melhor recall e comportamento uniforme. O teto de FR-010a evita a contrapartida natural da opção (estimativa conservadora demais bloqueando listas viáveis).                 |
| B — descartada         | Só no catálogo musical; no vídeo, nunca                    | Protegeria a cota sem mudar a estimativa, mas empurraria o falso corte para correção manual na revisão — que gasta a mesma cota, só que de forma imprevisível.               |
| C — descartada         | No vídeo, só com folga de cota no momento da busca         | Aproveitaria o saldo quando existe, mas tornaria o resultado irreproduzível: a mesma lista se comportaria diferente conforme a hora do dia, difícil de testar e de explicar. |
