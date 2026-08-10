# Research — Correções de fidelidade ao design oficial

Fase 0 do plano. Cada seção registra **decisão**, **razão** e **alternativas
descartadas**. Nenhum `NEEDS CLARIFICATION` sobreviveu: as oito perguntas que mudariam
o escopo foram resolvidas na sessão de clarificação e estão no topo da spec; o que resta
aqui é escolha técnica.

O arquivo de design foi lido nó a nó pela ferramenta que o edita, e não por captura de
tela. Os identificadores citados (`uy2ns`, `Sim0L`, …) são os do arquivo.

---

## R1 — Onde vive a decisão da linha de contexto

**Decisão**: um módulo puro novo, `src/domain/header/`, com uma função
`headerContext(snapshot): HeaderContext` que devolve uma união discriminada de três
formas — `absent`, `greeting`, `service`. O componente que a consome é
`src/app/StepContextLine.tsx`, renderizado pelo `Shell` no lugar onde o `Greeting` está
hoje. `src/app/Greeting.tsx` é removido.

**Razão**: a tabela de FR-009 tem sete linhas, três formas de saída e duas condições de
degradação (sem conta conectada, destino único). Isso é o mesmo tipo de coisa que a 007
tirou do `StepRail` e pôs em `src/domain/rail/`: *quando* uma linha pode afirmar algo. O
Princípio III não fala de "cálculo complexo", fala de regra — e "a etapa Configuração não
tem linha de contexto" é regra tanto quanto "a etapa Resumo só existe com mais de um
destino". Com o módulo puro, as sete linhas da tabela viram sete casos de
`tests/unit/header-context.spec.ts` sem renderizar nada; dentro de um componente, cada
uma custaria uma montagem de DOM com store preparada.

O módulo importa `@/i18n/pt-BR` — dependência de mão única já estabelecida por
`src/domain/rail/index.ts`, e justificada lá: o dicionário é um objeto congelado de
strings, um módulo de dados. O que o Princípio III isola é I/O, e não há nenhum.

**Alternativas descartadas**:

- **Um `switch` dentro do `StepContextLine`.** É onde a regra estaria hoje se ninguém
  perguntasse, e é exatamente o formato em que ela está errada nas cinco etapas: a
  implementação atual exibe "Olá, {nome completo}" em tinta secundária sempre, e ninguém
  notou porque não havia nada que pudesse falhar.
- **Passar a linha por `prop` do `StepHeading`.** Obrigaria as oito superfícies que usam
  `StepHeading` a calcular a própria linha, e a etapa Serviço tem seis fases — seriam
  seis chamadas repetindo a mesma decisão. É a duplicação que `src/domain/rail/` existe
  para não ter.
- **Renderizar dentro do `StepHeading`, lendo a store ali.** `src/ui/` é a camada sem
  estado do projeto; um `useAppStore` ali seria o primeiro, e abriria a porta para o
  segundo.

**Sobre a posição no DOM**: o arquivo põe a linha em `Content > Primary Column > Heading
> Greeting`, isto é, **dentro** do bloco de cabeçalho. A implementação a mantém como
irmã imediatamente anterior ao `<section>` da etapa, que é onde o `Greeting` já está. A
ordem de leitura e a ordem no DOM ficam idênticas às do arquivo; o que difere é o
agrupamento, e o agrupamento não é observável. O ajuste é de espaçamento — o respiro
entre a linha e o título passa a ser o do bloco de cabeçalho, não o do `gap` da coluna.

---

## R2 — FR-013 e a posição na fila, anunciada uma vez só

**Decisão**: a linha de contexto é **texto real e anunciado** em todas as suas formas.
Onde o arquivo repete a posição no cabeçalho do cartão da fase — `Budget Card` em
`TSwx6`, `Success Card` em `C13Hj` —, a repetição é **visual**: o `QueueIndicator` passa
a ser renderizado dentro daqueles cartões, com `aria-hidden`, porque a linha de contexto
já disse a mesma coisa alguns pixels acima.

**Razão**: FR-013 tem duas metades que puxam para lados opostos — "não pode ser o único
portador da posição" e "MUST ser informação redundante para tecnologia assistiva onde o
mesmo dado já é anunciado". A leitura que satisfaz as duas é: **um anúncio, dois
lugares visíveis**. A linha de contexto é um parágrafo de texto, não uma cor nem um
ícone, então ela não é o tipo de portador que a acessibilidade recusa; e o cabeçalho do
cartão de fase repete a informação para quem está lendo o cartão sem ter voltado o olho
ao topo da tela.

Nas fases em que o arquivo **não** desenha o cabeçalho de cartão — conexão, reconexão,
busca, revisão —, a linha de contexto é o único lugar em que a posição aparece, visual e
anunciada, e é o que o arquivo mostra (`dIPW6`, `DP6mq`).

Esta é uma leitura de um requisito que admite mais de uma; está escrita aqui para poder
ser contestada em revisão em vez de ficar implícita no código.

**Alternativas descartadas**:

- **Manter o `QueueIndicator` no topo do `ServiceStep` como hoje.** Produziria "Spotify
  — 1 de 2" duas vezes na mesma tela, uma como linha de contexto e outra logo abaixo —
  a mesma falha que FR-019 corrige no painel de Destinos.
- **Apagar o `QueueIndicator`.** Perderia a repetição visual que o arquivo desenha nos
  cartões de orçamento e de resultado, e deixaria a posição sem `role="status"` — hoje é
  ele quem anuncia a troca de serviço quando ela acontece sem transição de etapa.

---

## R3 — O substrato de identidade por provedor

**Decisão**: dois tokens derivados novos, `--brand-tint-spotify` e
`--brand-tint-youtube`, declarados **uma única vez** fora dos blocos de tema como
`color-mix(in srgb, var(--brand-*) var(--brand-tint-amount), var(--surface))`, com
`--brand-tint-amount` valendo `12%` no claro e `15%` no escuro. Emitidos no
`@theme inline` como `--color-brand-tint-*`. O consumo é `bg-brand-tint-spotify` /
`bg-brand-tint-youtube`, **exclusivamente** em `src/features/destinations/DestinationSelector.tsx`.

**Razão**: é a técnica que o projeto já usa para `--state-*-tint` e `--accent-tint` —
derivar em vez de declarar, para que trocar o verde do Spotify não exija editar dois
valores e esquecer um. A quantidade de tinta difere por tema pelo mesmo motivo que a de
estado difere: 12% sobre branco lê como 15% sobre quase-preto. O arquivo usa `#1DB9541F`
sobre `#161C25`, que é 12,2% — dentro do degrau já praticado.

**A fechadura de FR-004 é tripla, e a redundância é deliberada**:

1. **Nome próprio.** `bg-brand-spotify` continua proibido; `bg-brand-tint-spotify` é
   outro utilitário, com outro token. Não há como alcançar a exceção "por acidente de
   opacidade".
2. **Allowlist de arquivo na regra de lint.** `tp/no-raw-visual-values` passa a aceitar
   `bg-brand-tint-*` **apenas** no arquivo do cartão de destino. Usar em outro lugar é
   erro de lint, e autorizar outro lugar custa editar a regra — que é a revisão que se
   quer forçar.
3. **Teste de ponto único.** `tests/unit/no-orphan-tokens.spec.ts` ganha a asserção de
   que o utilitário aparece em exatamente um arquivo de `src/`. Se alguém desativar a
   regra de lint com um comentário, o teste ainda falha.

**Alternativas descartadas**:

- **Limiar de opacidade** ("preenchimento de marca é permitido abaixo de N%"). Recusado
  na própria spec, e com razão: um limiar é alegável por qualquer tela nova sem revisão,
  e a regra vira argumento em vez de fechadura.
- **Opacidade aplicada no componente** (`bg-brand-spotify/10`). Reintroduz valor visual
  decidido caso a caso, que é o que FR-035 proíbe, e deixaria o número fora da camada de
  tokens.
- **Um único `--brand-tint` genérico.** Não existe: a cor é por provedor, e um token
  genérico exigiria interpolação em tempo de execução — que é justamente o que
  `tp/no-dynamic-classname` recusa.

---

## R4 — Contraste do ícone sobre o substrato da mesma matiz

**Decisão**: os dois pares entram na lista fechada — `--brand-spotify` sobre
`--brand-tint-spotify` e `--brand-youtube` sobre `--brand-tint-youtube`, uso `ui`
(mínimo 3:1). `APPROVED_PAIR_COUNT` vai de **27 para 29**. `tests/unit/contrast.spec.ts`
ganha um resolvedor que calcula a mistura em TypeScript, a partir dos mesmos hex de
`tokens.css`, para poder medir um substrato que só existe como `color-mix`.

**Razão**: ícone verde sobre fundo esverdeado é o caso em que a intuição erra. Os
`--state-*-tint` existentes escaparam da medição porque o selo mede a cor do estado
contra `--surface`, e o tingimento é um detalhe atrás do texto; aqui o **glifo inteiro**
fica sobre o tingido, e é o único portador visual da identidade do serviço. Assumir que
12% "não muda nada" seria exatamente o tipo de decisão a olho que esta feature existe
para desfazer.

Se um valor reprovar, a borda que a spec já fixou vale: **a correção é o valor por tema,
não a remoção da cor**. O grau de liberdade disponível é a quantidade de tinta do
substrato, que pode cair por tema sem tocar na cor da marca.

**Alternativas descartadas**:

- **Não medir, por analogia com `--state-*-tint`.** A analogia não se sustenta: lá o
  contraste medido é texto-sobre-superfície, aqui é glifo-sobre-mistura-de-si-mesmo.
- **Fazer `contrast.spec.ts` ler o `color-mix` já resolvido do navegador.** Exigiria
  navegador no teste de unidade. O cálculo em sRGB é aritmética simples e determinística,
  e a fórmula fica ao lado dos valores que ela mistura.

---

## R5 — A moldura que sai, e as que ficam

**Decisão**: sai **apenas** o `<div className="app-card">` de `src/app/Wizard.tsx`, que
envolve o conteúdo de toda etapa. O utilitário `app-card` **permanece** em
`src/styles/index.css` e continua sendo usado por `MatchRow` e `SummaryScreen`.

**Razão**: o arquivo desenha cartão para a linha de correspondência (`g3IhDr — Track
Match Card`) e para o resultado por serviço (`x2kz71 — Service Summary`), e não desenha
cartão em volta do cabeçalho de etapa nenhuma — `Heading` é filho direto de `Primary
Column`, sem preenchimento nem contorno, em todas as quatorze telas. Remover o utilitário
junto com o uso errado seria trocar um defeito por outro.

**Consequência que precisa ser conferida, não presumida**: o conteúdo das etapas passa de
`--surface` para `--bg`. Os pares `--ink sobre --bg` e `--ink-muted sobre --bg` já estão
aprovados, mas os selos de estado e os campos que hoje contam com o degrau de
luminosidade do cartão passam a se apoiar no substrato da área principal. É item da
conferência de forma (`checklists/design-fidelity.md`), etapa a etapa, e não uma
suposição do plano.

**Alternativas descartadas**:

- **Trocar `app-card` por um utilitário sem contorno.** Manteria a superfície e o degrau
  de luminosidade, que é metade do que o pedido reclama ("uma div com borda e cor").
- **Remover o utilitário inteiro.** Quebraria os dois cartões que o arquivo desenha.

---

## R6 — O painel lateral deixa de ser decoração

**Decisão**: `MoodPanel.tsx` é substituído por `ExecutionOrderPanel.tsx`, com a
composição do arquivo (`uy2ns > Side Panel`), nesta ordem: cabeçalho com o papel de ícone
`queue` em âmbar e o título "Ordem de execução"; a fila numerada dos destinos
selecionados; o aviso de execução em série sobre substrato de âmbar tingido; a fotografia
com o seu véu; e a legenda. Os adesivos **saem do painel** e vão para a coluna primária,
abaixo dos cartões de destino, que é onde o arquivo os põe (`Primary Column > Frame 1 >
Stickers Decor`).

**Razão**: a decisão da 007 de deixar o painel sem texto foi tomada para não repetir na
lateral o título e a introdução da etapa — e essa razão continua boa. O que o arquivo põe
ali não é repetição: é a ordem de execução, que hoje aparece como parágrafo solto no
corpo da etapa. Mover é o que FR-019 pede, e o resultado é uma frase a menos na tela, não
uma a mais.

A exigência que sobrevive da 007 é outra e permanece literal: **a informação do painel
precisa ser completa sem as imagens** (FR-018). Fotografia e adesivos continuam
decorativos, com `alt` vazio, `aria-hidden` e carregamento diferido; o texto vem antes
deles no DOM.

**Sobre o estado vazio** (FR-015a): o painel nunca some nem colapsa. Cabeçalho, aviso,
fotografia e legenda permanecem, e no lugar da fila entra uma frase curta convidando a
escolher um destino. É a diferença entre um painel que responde "nada escolhido ainda" e
um layout que se reorganiza a cada marcação de caixa.

**Alternativas descartadas**:

- **Renderizar o painel só quando há seleção.** Faria a coluna primária mudar de largura
  a cada clique — o pior comportamento possível numa tela cuja única tarefa é clicar.
- **Manter os adesivos no painel.** Divergência de forma sem ganho; e no painel eles
  competem com a fotografia, que já é a decoração daquela coluna.

---

## R7 — A regra única de derivação da trilha, e o valor certo para a etapa Serviço

**Decisão**: `supportFor` em `src/domain/rail/index.ts` perde a guarda
`if (state !== 'done')`. A regra passa a ser uma só — **deriva quando há valor decidido,
fica neutra quando não há** —, aplicada igualmente a degrau concluído, corrente ou à
frente. Junto com isso, o `RailSnapshot` ganha um campo: a etapa Serviço deixa de derivar
da contagem de destinos e passa a derivar da contagem de execuções **encerradas**.

**Razão da segunda metade**: sem ela, a regra nova produz uma afirmação falsa. Hoje
`service` deriva de `snapshot.destinations.length > 0`, o que era inofensivo enquanto só
degrau concluído derivava — a etapa Serviço concluída de fato abrangeu aqueles serviços.
Com a guarda removida, a trilha passaria a dizer "2 serviços concluídos" já na etapa
Destinos, no instante em que o segundo destino é marcado. Isso é exatamente o que FR-029
proíbe, e a correção não é uma exceção à regra nova: é aplicá-la corretamente. O "valor
decidido" da etapa Serviço não é quantos destinos existem, é quantos serviços terminaram.

**Alternativas descartadas**:

- **Manter a guarda só para `service`.** Seria a regra dupla que FR-028 existe para
  eliminar, com a diferença de agora estar escondida num caso especial.
- **Derivar `service` da fase corrente do ciclo.** Recusado desde a 007 (FR-014): seis
  fases por serviço são informação de apoio da própria tela, não da trilha.

---

## R8 — Como a fidelidade textual passa a ser verificada por máquina

**Decisão**: um inventário versionado, `tests/fixtures/design-inventory.json`, organizado
por tela, em que cada texto do arquivo de design carrega o seu desfecho. Um teste novo,
`tests/unit/design-text-fidelity.spec.ts`, percorre o inventário e, para cada item
**adotado**, resolve a chave em `src/i18n/pt-BR.ts`, aplica `format`/`plural` com as
amostras registradas, e compara **caractere a caractere** com a string do arquivo.

O esquema completo está em `contracts/text-inventory.md`. Os três pontos que definem o
mecanismo:

1. **A comparação é sobre o texto renderizado, não sobre o template.** O arquivo de
   design contém "Conectado como Luciano Rodrigues", e o dicionário contém um template
   com `{name}`. Comparar template com string literal seria impossível; comparar o
   template **renderizado com a amostra que o arquivo usa** verifica as duas coisas ao
   mesmo tempo — o texto e a interpolação.
2. **`mantido diferente` exige motivo escrito.** O teste falha se um item não tiver nem
   chave nem motivo. É o que impede o inventário de virar uma lista de itens
   silenciosamente ignorados.
3. **O teste falha por ausência, não só por divergência.** Chave que não existe mais no
   dicionário é falha, com o caminho nomeado — é o modo de falha real, porque renomear
   uma chave é mais comum do que reescrever uma frase.

**Razão**: o que falhou na 007 foi o método. A conferência era guiada por lista e feita a
olho, e divergência de texto não falha em lugar nenhum — passa por lint, por `typecheck`,
por todos os testes de comportamento. O inventário é o que transforma "conferimos" em
"a máquina confere de novo a cada `npm test`".

**Alternativas descartadas**:

- **Ler o `.pen` no teste.** Amarraria a suíte a um arquivo fora do repositório e a uma
  ferramenta externa. O `.pen` é fonte de verdade **em tempo de autoria**; o que entra no
  repositório é o resultado da leitura.
- **Captura de pixel / baseline de imagem.** Recusada na spec, e por um motivo medido: a
  instabilidade entre plataformas custaria mais do que protege. A divisão adotada é por
  natureza — **texto** por máquina, **forma** por asserção estrutural mais conferência
  manual.
- **Ampliar `i18n-stability.spec.ts` para fazer os dois papéis.** São verificações
  opostas: aquele teste garante que os textos **não mudaram**, este garante que eles
  **coincidem com o design**. Ver R9.

---

## R9 — O que fazer com `i18n-stability.spec.ts`

**Decisão**: o instantâneo é rebaselinado (`ATUALIZAR_I18N=1`) e o comentário do topo do
teste é reescrito. Ele deixa de significar "esta feature não muda texto nenhum" — que era
verdade na 007 e é falso agora — e passa a significar "mudança de texto é deliberada e
aparece no diff do instantâneo". As duas verificações convivem com papéis distintos:

| Teste | Garante |
| --- | --- |
| `i18n-stability.spec.ts` | Nenhum texto muda **por acidente**. O diff do instantâneo é a revisão. |
| `design-text-fidelity.spec.ts` | Todo texto marcado como adotado **coincide com o arquivo de design**. |

**Razão**: rebaselinar sem tocar no comentário deixaria no repositório um teste cujo
docblock afirma o contrário do que a feature fez — e o comentário desatualizado é pior
que a ausência dele, porque é lido como verdade. O instantâneo continua sendo assimétrico
(aceita chave nova, recusa valor alterado), que é o que faz a mudança de texto aparecer
como uma linha para aprovar em vez de um arquivo regravado por hábito.

---

## R10 — A anatomia do cartão de destino sem perder o controle nativo

**Decisão**: o `<input type="checkbox">` continua sendo o controle, com `sr-only`, e a
marca de verificação visível é um `<span aria-hidden>` irmão, estilizado por
`peer-checked:` e `peer-focus-visible:`. O `<label htmlFor>` continua associado, e o
cartão inteiro continua sendo rótulo clicável.

**Razão**: FR-023 pede a marca de verificação preenchida à direita, e FR-025 pede
operação por teclado com foco visível e rótulo associado. Trocar o controle nativo por
`role="checkbox"` em uma `div` custaria reimplementar espaço, seleção, estado
`indeterminate` e o comportamento de formulário — pela aparência. O controle nativo
escondido com `sr-only` continua focável, continua na ordem de tabulação, continua
anunciando estado, e o anel de foco vai para o elemento visível através da variante
`peer-focus-visible`.

**Sobre a altura constante** (FR-021a): a linha secundária existe nos três estados e
sempre ocupa uma linha. No estado sem credencial, o motivo e o atalho continuam presentes
como hoje — o que muda é que eles deixam de ser um bloco que aparece e some, e passam a
ocupar a mesma faixa que a conta ocuparia. É o que faz o cartão não pular quando a sessão
é obtida.

**Alternativas descartadas**:

- **`appearance-none` no próprio input.** Funciona para o quadrado, mas não permite pôr
  o glifo de verificação dentro dele sem `background-image` — que seria valor visual
  literal, recusado por FR-035.
- **Reservar a altura com `min-h-*`.** Resolve o salto, mas não resolve o buraco: um
  cartão com espaço reservado e nada escrito é o "espaço vazio" que a spec recusa em
  FR-011 pelo mesmo motivo.
