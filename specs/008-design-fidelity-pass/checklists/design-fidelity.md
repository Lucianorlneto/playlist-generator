# Conferência de fidelidade ao design oficial

**Origem**: `/Users/bms023/Documents/Workspace/playlist-importer/playlist-importer.pen`, lido
nó a nó pela ferramenta que o edita (MCP `pencil`), **nunca** por captura de tela.

**Papel deste arquivo**: registrar o que o arquivo de design contém, para que toda
divergência apontada na feature 008 tenha um nó de origem citável. A parte **textual** é
verificada por máquina (`tests/unit/design-text-fidelity.spec.ts`, a partir de
`tests/fixtures/design-inventory.json`); o que fica aqui é a parte que a máquina não
verifica — **forma**: composição, espaçamento, alinhamento, ritmo e peso tipográfico
(SC-011, FR-030b).

**Sobre as cores citadas**: o arquivo define **apenas o tema Noite**. Todo hex abaixo é o
valor escuro. O tema Papel não é desenhado pelo arquivo, e a divergência autorizada entre
os dois é **cromática apenas** — estrutura, composição e estados são idênticos (FR-036).

---

## 1. As quatorze telas e os seus nós

| Tela | Nó |
| --- | --- |
| Importador · Configuração | `Sim0L` |
| Importador · Destinos | `uy2ns` |
| Importador · Entrada | `okw1h` |
| Importador · Serviço | `dIPW6` |
| Importador · Serviço · Reconectar | `DP6mq` |
| Importador · Serviço · Orçamento | `TSwx6` |
| Importador · Serviço · YouTube | `ND2Zm` |
| Importador · Serviço · Spotify (Carregando) | `SjphR` |
| Importador · Serviço · Spotify Concluído | `C13Hj` |
| Importador · Serviço · YouTube Concluído | `zCaeY` |
| Importador · Resumo | `w1fTC` |
| Components / Playlist Importer | `G2IsFJ` |
| Components / Serviço | `eckoA` |
| Components / Configuração | `wwUgy` |

---

## 2. O que se repete em todas as telas

Registrado **uma vez**, e não catorze: são as mesmas instâncias de componente em todas as
telas, e repetir o item por tela tornaria o levantamento ilegível sem verificar nada a
mais (`contracts/text-inventory.md` §4).

### 2.1 Barra superior (`Topbar`)

| Nó (em `uy2ns`) | Texto / papel |
| --- | --- |
| `PtPw8` | "Playlist Importer" — nome do produto |
| `Saw4n` | "Texto → Spotify · YouTube" — assinatura |
| `K7h3k`, `bLJbb` | Chips de conexão, instâncias de `Xkztn` |
| `MW4CE` | Nome da conta dentro do chip |
| `ThHZF` | "Reconectar" |
| `vNYHu/MW4CE` | "Não conectado" — estado desconectado do chip |
| `vNYHu/ThHZF` | "Conectar" |
| `P6bsL` | Controle de tema, três segmentos |

**Superfícies**: `S0oHf` barra `--surface-zone` `#12171F` com filete inferior `--rule`;
chip `#FFFFFF0A` sobre `--rule`, raio pílula; botão dentro do chip `#FFFFFF0F`.

### 2.2 Trilha (`Step Rail`)

| Nó (em `uy2ns`) | Texto |
| --- | --- |
| `Gf6oi` | "ETAPAS" |
| `byXHV` / `CHYss` | "Configuração" / "Preferências salvas" |
| `A7mpl` / `dydxN` | "Destinos" / "Spotify e YouTube" |
| `OaSHb` / `j0VSq` | "Entrada" / "Cole a lista de músicas" |
| `f5eC1s` / `O1ZvF3` | "Serviço" / "Criação e resultado" |
| `rhIpE` / `UGKxo` (em `w1fTC`) | "Resumo" / "O que aconteceu em cada serviço" |
| `TKS06` (em `Sim0L`) | "Suas credenciais" — a forma **neutra** da etapa Configuração |
| `lTfCn` | "Recomeçar do início" |

**Superfícies**: `jO0BS` zona `--surface-zone` com filete à direita; discos `28px`,
concluído `#F5B301` cheio, corrente `#F5B3011A` com contorno `#F5B301`, pendente
`#FFFFFF08` com contorno `--rule`; conector `2px` de raio; rodapé `#FFFFFF06`, raio 10.

**Divergência mantida** — `dydxN` diz "Spotify e YouTube" sob Destinos **também na tela de
Configuração** (`CD9SL` em `Sim0L`), onde a escolha ainda não aconteceu. A regra vence o
desenho: FR-029 proíbe a trilha afirmar escolha não feita. Registrado como
`mantido-diferente` no inventário.

---

## 3. Tela a tela — o que é próprio de cada uma

### 3.1 `Sim0L` — Configuração

- **Linha acima do título**: **não existe**. `Sim0L` não tem nó `Greeting`. → FR-009,
  forma `absent`.
- **Superfície**: o conteúdo vive em `Config Card`. É o único cartão de etapa que o
  arquivo desenha, e ele envolve **as seções de credencial**, não o cabeçalho.
- Textos próprios: `auaD2` "Informe suas credenciais", `xkOgw` a introdução, e o par de
  seções por serviço (`IENyq`, `PdpnC`) com instruções numeradas (`j8hQg`), campo de
  credencial mascarado (`hBSil`), campo de código (`OCKo3`) e botão de remoção (`VvVWb`).
- `T9NQ9` "Continuar".

### 3.2 `uy2ns` — Destinos

Composição, na ordem do DOM:

```text
Main
└── Content (gap 36)
    ├── Primary Column (680, vertical, gap 28)
    │   ├── Heading  jHTKw  (vertical, gap 10) ← SEM fill, SEM stroke
    │   │   ├── Greeting  jkrUm  (horizontal, gap 8)
    │   │   │   ├── z60mT "Oi, Luciano"                    #F5B301  13,5
    │   │   │   └── y0ju8J "· vamos levar suas músicas pra casa"  #8A94A6  13,5
    │   │   ├── inrE1 "Para onde vai a playlist?"
    │   │   └── x40AP  descrição
    │   ├── Destinations  tyj6E  (vertical, gap 12)
    │   │   ├── xx0U1 "Serviços de destino"
    │   │   ├── rIM4r  Spotify Destination
    │   │   └── urJhP  YouTube Destination
    │   └── Frame 1 → wv9Cp  Stickers Decor        ← adesivos AQUI, não no painel
    └── Side Panel  T7goKr  (330, vertical, gap 18)
        ├── Panel Head  aAq4V   ícone list-ordered #F5B301 + "Ordem de execução"
        ├── Queue  uFd38
        ├── Hint  Hix5w        #F5B3011A, raio 11, ícone info
        ├── Mood Photo  M0bYb  imagem + véu em degradê
        └── Photo Caption  d5S1gP
```

**A confirmação que a US2 depende**: `jHTKw` é filho direto de `Primary Column`, **sem
`fill` e sem `stroke`**. Nenhuma superfície envolve o cabeçalho da etapa (FR-006, SC-003).

**Cartão de destino** (`j8rruy`, instanciado):

| Parte | Selecionado (`j8rruy`) | Não selecionado (`KAJYs`) |
| --- | --- | --- |
| Cartão | fill `#F5B3011A`, stroke `#F5B301`, raio 14, padding 18 | fill `#161C25`, stroke `#252D3A` |
| Distintivo `kl8Rc` | `#1DB9541F` (Spotify) / `#FF3B301F` (YouTube), raio 13 | idêntico |
| Glifo `WDCUM` | `phosphor/spotify-logo` em `#1DB954` | idêntico |
| Título `RlBSR` | "Criar no Spotify", `#E9EEF5`, 15,5 / 700 | idêntico |
| Sub `v5csuU` | "Conectado como Luciano Rodrigues", `#8A94A6`, 12,5 / 500 | idêntico |
| Controle `T8lli` | fill `#F5B301`, raio 8, check em `#0D1117` | fill transparente, stroke `#252D3A` |

**Item da fila** (`gnfAG`): marcador `#FFFFFF0A` com contorno `--rule`, raio 9, contendo o
glifo do provedor **na cor da marca**; ao lado, nome (13,5) e nota de posição (11,5,
`--ink-muted`). **O marcador não é preenchido com cor de marca** — a exceção nomeada de
FR-004 vale só para o distintivo do cartão.

**Barra de ações** (`XgqFh`): `Selection Status` com ícone + "2 destinos selecionados";
`Back Button` e `Continue Button` à direita.

**Ausente do arquivo**: o parágrafo "Quando você escolhe os dois, executamos um serviço de
cada vez…" no corpo da etapa. A explicação existe **uma vez**, no `Hint` do painel
(FR-019, SC-005).

### 3.3 `okw1h` — Entrada

- `Greeting`: `B3f4v` "Oi, Luciano" + `pA8Er` "· hora de colar sua lista". → forma
  `greeting`.
- `fczJk` "Cole sua lista", `sYv9H` descrição, `Entry Card` com rótulo, área de texto e a
  dica de separadores.
- `hTpw9` na barra de ações: "0 linhas · cole ou digite pelo menos uma para continuar".

### 3.4 `dIPW6` — Serviço · revisão (Spotify) e `ND2Zm` — idem (YouTube)

- `Greeting`: `SusdI` "Spotify — 1 de 2" / `jZ3yz` "YouTube — 2 de 2", em `#8A94A6`, linha
  **inteira** na tinta secundária. → forma `service`, posição na fila.
- **Não há cabeçalho de cartão de fase nestas telas.** A linha de contexto é o único lugar
  em que a posição aparece (research §R2).
- Corpo: `Progress Wrap`, `Selection Head`, quatro instâncias de `g3IhDr — Track Match
  Card`, `Playlist Data` e `Final Actions`.

### 3.5 `DP6mq` — Serviço · reconectar

- `Greeting`: `B8WmIt` "YouTube — 2 de 2". → forma `service`, posição na fila.
- Chip do YouTube no estado desconectado (`NGhDO`), com "Desconectado".
- `QnbVG` "Conectar sua conta do YouTube", `iJ4JF` a introdução, `F0SXx` o botão, `pJ2bk`
  "Pular o YouTube".

### 3.6 `TSwx6` — Serviço · orçamento

- `Greeting`: `iA1Jl` "YouTube · Conferindo o orçamento". → forma `service`, **sem** a
  posição na fila.
- **Cabeçalho do cartão** (`v7c4o`): ícone `phosphor/youtube-logo` em `#FF3B30` + `gnj8L`
  "YouTube — 2 de 2" em `#8A94A6`, 12,5. É a **repetição visual** da posição, dentro do
  cartão (FR-013).
- `Stats Box` com três instâncias de `fycxM — Stat`.
- `fp7Zd` "Nenhuma das 1 linhas deve precisar de segunda tentativa." — **concordância
  errada do mockup**, produzida por dados de exemplo fixos. O vocabulário ("tentativa") é
  adotável; o erro não. → `mantido-diferente` com motivo escrito.

### 3.7 `SjphR` — Serviço · criando (Spotify)

- `Greeting`: `W28iHE` "Spotify · Concluído" — **mesmo enquanto cria**. A linha nomeia o
  cartão em que se está, não o instante da operação (`contracts/header-context.md` §2).
- Cabeçalho do cartão `FWym9` "Spotify — 1 de 2" com o glifo do provedor.

### 3.8 `C13Hj` e `zCaeY` — Serviço · concluído

- `Greeting`: `WRRMa` / `Z5bFJ` "{Serviço} · Concluído". → forma `service`.
- **Cabeçalho do cartão** (`EvlNu`): glifo do provedor na cor da marca + "Spotify — 1 de 2".
- `Stats Grid` (quatro `fycxM`), `Info Box` de pastas, botões finais.

### 3.9 `w1fTC` — Resumo

- **Linha acima do título**: **não existe**. → forma `absent`.
- `k7Qba` "Resumo", `PbcmQ` "O que aconteceu em cada serviço.", duas instâncias de
  `x2kz71 — Service Summary`, e `b828It` "Começar uma nova playlist".

### 3.10 `G2IsFJ`, `eckoA`, `wwUgy` — bibliotecas de componentes

Não são telas: são as definições reutilizáveis instanciadas acima. Os seus textos entram
no inventário **uma vez**, pela definição, e não por cada instância.

---

## 4. Conferência de forma — tela a tela, dois temas, duas larguras

✓ (confere), ✗ (diverge, com a nota) ou — (não se aplica). "Papel" é o tema claro, "Noite" o
escuro; "1280" é o projeto `desktop`, "375" o `narrow-375`.

**O que foi verificado por máquina e o que não foi.** Os itens marcados **[auto]** foram medidos
executando a aplicação nos dois projetos do Playwright e lendo o DOM e o estilo computado; os
marcados **[olho]** dependem de conferência visual do autor e **permanecem em aberto**. Não é
lacuna: é exatamente o que SC-011 reserva para a pessoa, porque desalinhamento de 2px, ritmo e peso
tipográfico não têm asserção que os pegue — foi essa a divisão de trabalho que a spec fixou quando
recusou comparação por imagem de referência.

### 4.1 O que conferir em toda tela

| # | Item de forma | Papel 1280 | Papel 375 | Noite 1280 | Noite 375 |
| --- | --- | --- | --- | --- | --- |
| F1 **[auto]** | Nenhuma superfície com contorno envolve o cabeçalho da etapa (FR-006) | ✓ | ✓ | ✓ | ✓ |
| F2 **[olho]** | O respiro entre linha de contexto, título e descrição é o do bloco de cabeçalho | | | | |
| F3 **[auto]** | Ordem de leitura no DOM = ordem visual | ✓ | ✓ | ✓ | ✓ |
| F4 **[auto]** | Nenhuma rolagem horizontal (SC-007) | ✓ | ✓ | ✓ | ✓ |
| F5 **[olho]** | Selos, campos e superfícies continuam legíveis sobre `--bg` (research §R5) | | | | |
| F6 **[olho]** | Peso tipográfico dos títulos e das linhas de apoio acompanha o arquivo | | | | |

**F1** foi medido percorrendo a cadeia de ancestrais do título de cada etapa à procura de
`app-card`, nas duas larguras, nos dois temas e nas etapas de Configuração, Destinos e Entrada:
zero ocorrências. O mesmo caso existe como teste permanente em
`tests/components/destinations.spec.tsx`.

**F3** é sustentado por `e2e/keyboard.spec.ts` ("a ordem é barra superior → trilha → conteúdo, sem
voltar atrás"), que percorre a ordem de tabulação real — se o DOM e o olho divergissem, a tabulação
voltaria atrás.

**F4** é sustentado por `e2e/narrow-viewport.spec.ts`, que mede `scrollWidth` contra `clientWidth`
de 320 px a 1920 px, nos dois temas.

A paridade **entre os temas** — estrutura, composição e estados idênticos, com divergência cromática
apenas (FR-036) — é verificada por `e2e/theme.spec.ts` com CSS real, comparando a árvore renderizada
nos dois temas item a item.

### 4.2 Por tela

| Tela | Item específico | Verificação | Desfecho |
| --- | --- | --- | --- |
| Configuração | Cabeçalho fora do cartão; o cartão permanece em volta das seções de credencial | **[auto]** F1 + `destinations.spec.tsx` | ✓ |
| Destinos | Cartão selecionado com contorno de acento **e** substrato `--accent-tint` (FR-024) | **[auto]** `theme.spec.ts`, estilo computado nos dois temas | ✓ |
| Destinos | Altura idêntica do cartão nos três estados de conta (FR-021a) | **[auto]** `destinations.spec.tsx`, mesma contagem de filhos e mesmas classes de layout | ✓ |
| Destinos | Distintivo à esquerda, marca de verificação à direita, rótulo entre os dois | **[auto]** `destinations.spec.tsx`, a marca é o último filho | ✓ |
| Destinos | Adesivos na coluna primária, abaixo dos cartões | **[olho]** posição relativa aos cartões | |
| Destinos | Painel presente com seleção vazia, sem mudar a largura da coluna (P1) | **[auto]** `destinations.spec.tsx`, classes de largura idênticas com 2, 1 e 0 destinos | ✓ |
| Destinos | Painel desce para baixo da coluna em largura estreita (FR-020) | **[auto]** `narrow-viewport.spec.ts`, sem rolagem horizontal em 375 px | ✓ |
| Destinos | A explicação da ordem aparece **uma vez** na tela (SC-005) | **[auto]** `destinations.spec.tsx`, uma única folha com o texto | ✓ |
| Entrada | Saudação pessoal presente, com o complemento próprio da etapa | **[auto]** `header-context.spec.ts` + `shell.spec.tsx` | ✓ |
| Serviço · revisão | Linha de contexto com a posição; **sem** cabeçalho de cartão | **[auto]** `steps.spec.tsx`, um portador e uma região viva | ✓ |
| Serviço · reconexão | Idem, com o chip do serviço em estado desconectado | **[auto]** `steps.spec.tsx`, fase `awaiting_reauth` | ✓ |
| Serviço · orçamento | Cabeçalho do cartão com glifo do provedor na cor da marca | **[olho]** a cor do glifo no cabeçalho | |
| Serviço · criando | Linha de contexto já na forma de conclusão | **[auto]** `header-context.spec.ts`, fase `creating` | ✓ |
| Serviço · concluído | Cabeçalho do cartão com glifo e posição | **[auto]** `steps.spec.tsx`, um portador da posição | ✓ |
| Resumo | Nenhuma linha acima do título | **[auto]** `header-context.spec.ts` + `shell.spec.tsx`, verificado como ausência | ✓ |

**O que resta ao autor**, e é pouco: três itens de olho na §4.1 (respiro do bloco de cabeçalho,
legibilidade dos selos sobre `--bg`, peso tipográfico) e dois na tabela acima (posição dos adesivos,
cor do glifo no cabeçalho do cartão de orçamento). Tudo o mais desta seção passou a ter teste
permanente — que é o ponto da feature: o que era conferência a olho virou portão.

### 4.3 Contraste dos substratos tingidos

Medido por `tests/unit/contrast.spec.ts`, não a olho. Registrado aqui porque a conferência
visual do distintivo é o item de maior risco: glifo verde sobre substrato esverdeado é o
caso em que a intuição erra (research §R4).

| Par | Papel (12%) | Noite (15%) | Mínimo |
| --- | --- | --- | --- |
| `--brand-spotify` sobre `--brand-tint-spotify` | **3,20:1** ✓ | **5,20:1** ✓ | 3:1 (`ui`) |
| `--brand-youtube` sobre `--brand-tint-youtube` | **3,10:1** ✓ | **4,20:1** ✓ | 3:1 (`ui`) |

**A margem do tema Papel é estreita e vale ser dita**: 3,10:1 passa por 0,10. O grau de
liberdade disponível, se um acerto futuro no substrato claro derrubar o número, é reduzir
`--brand-tint-amount` do tema Papel — **a cor da marca não é alterada nem removida**
(borda da spec). `tests/unit/contrast.spec.ts` é quem falha, com o par nomeado.

---

## 5. Superfícies que existem na aplicação e não no arquivo

**Silêncio do design não é ordem de remoção** (FR-008). Cada uma permanece, adotando por
analogia a superfície, o contorno e o raio do componente **mais próximo** que o design
define. A analogia fica registrada aqui e no guia de estilo.

| Superfície | O arquivo desenha? | Analogia adotada | Motivo |
| --- | --- | --- | --- |
| `src/ui/Dialog.tsx` | Não | Cartão de fase / painel: `--surface`, `--rule-strong`, `--radius-panel` | É o que segura "nenhuma escrita sem confirmação"; o design não desenha modal algum |
| `src/ui/VersionHintBadge.tsx` | Não | Selo de estado (`wXD9t`): substrato tingido, filete na cor do estado, nunca preenchimento sólido | O design desenha só os três selos de correspondência |
| `src/ui/RateLimitWaiting.tsx` | Não | Caixa de dica / cartão de fase: substrato tingido de "incerta", contorno na cor do estado | Uma pausa por limite de taxa é o serviço pedindo calma, não uma falha |
| `ConnectionChip` estado `no-credential` | Não | Chip desconectado (`vNYHu`), com tinta neutra | O arquivo desenha só "conectado" e "desconectado" |
| Diálogos de confirmação de pulo e de recomeço | Não | Idem `Dialog` | Comportamento da 006, preservado |
| Avisos de cota esgotada e de rascunho | Não | `Info Box` (`hHyQ6`) | O arquivo desenha a caixa, não estes conteúdos |

**Consequência a conferir, não presumir**: com a saída do `app-card` do `Wizard`, o
substrato atrás destas superfícies muda de `--surface` para `--bg`. Cada uma precisa ser
reconferida sobre o novo substrato (research §R5).

---

## 6. Superfícies com contorno ou substrato próprio que permanecem (T021)

| Superfície na aplicação | Corresponde a | Desfecho |
| --- | --- | --- |
| Cartão de destino (`DestinationSelector`) | `j8rruy — Destination Card` | Mantido — o arquivo o desenha |
| Cartão de credencial (`CredentialStep`) | `Config Card` em `Sim0L` | Mantido — o arquivo o desenha |
| Painel lateral (`ExecutionOrderPanel`) | `T7goKr — Side Panel` | Mantido — o arquivo o desenha |
| Linha de correspondência (`MatchRow`) | `g3IhDr — Track Match Card` | Mantido — o arquivo o desenha |
| Cartão de resultado por serviço (`SummaryScreen`) | `x2kz71 — Service Summary` | Mantido — o arquivo o desenha |
| Cartão de orçamento (`QuotaEstimateScreen`) | `Budget Card` em `TSwx6` | Mantido — o arquivo o desenha |
| Selo de estado (`StatusBadge`) | `wXD9t — Status Badge` | Mantido — o arquivo o desenha |
| Caixa de dica (`FolderNotice`) | `hHyQ6 — Info Box` | Mantido — o arquivo o desenha |
| Cartão de resultado do ciclo (`ResultScreen`) | `yTOJb — Success Card` (`C13Hj`), `qBqxK — Service Result · Loading` (`SjphR`) | Mantido — o arquivo o desenha |
| `<div className="app-card">` do `Wizard` | **nada** | **Removido** (FR-006) — o arquivo não desenha cartão em volta de cabeçalho de etapa em nenhuma das quatorze telas |
| `Dialog`, `VersionHintBadge`, `RateLimitWaiting` | nada | Mantidos por FR-008, com a analogia da §5 |

### 6.1 O degrau de luminosidade, conferido e não presumido (T020)

`research.md` §R5 exigia conferir, etapa a etapa, o que dependia do degrau que o
`app-card` do `Wizard` fornecia. A conferência encontrou **três** superfícies que o
perderiam, e todas as três estavam na mesma situação: são caixas que o arquivo desenha em
`--bg` **dentro** de um cartão `--surface`, e sem o cartão em volta virariam `--bg` sobre
`--bg` — a superfície existiria e não se veria.

| Superfície | Onde | Desfecho |
| --- | --- | --- |
| Caixa de números do orçamento (`<dl>` em `QuotaEstimateScreen`) | `p9MMgo — Stats Box` em `TSwx6`, `--bg` sobre `--surface` | Cartão de fase declarado no próprio `QuotaEstimateScreen` |
| `FolderNotice` e `FailedLines` | `hHyQ6 — Info Box`, `--bg` sobre `--surface` | Cartão de fase declarado no próprio `ResultScreen` |
| Painel de alternativas (`Alternatives`) | `bC8Yk`, `--bg` sobre `--surface` | Nenhum — vive dentro do `MatchRow`, que conserva o `app-card` |

**O que isto corrigiu, e por que não é escopo novo**: o levantamento de T001 mostrou que o
arquivo desenha `Budget Card` (`rxIZJ`) e `Success Card` (`yTOJb`) como superfícies
`--surface` com contorno `--rule`, e que o **título** daquelas fases é filho do cartão —
enquanto a **linha de contexto** fica fora, no cabeçalho da etapa. FR-006 remove a moldura
em volta do cabeçalho da etapa, não o cartão de fase; até aqui o cartão de fase existia por
acidente, herdado do `Wizard`, e agora ele é declarado onde o arquivo o desenha. É a
superfície que T021 já listava como esperada.

As demais superfícies com `--bg` interno — `RedirectUriHint` dentro do cartão de credencial
e `Alternatives` dentro da linha de correspondência — conservam o cartão que as envolve e
não foram tocadas.

---

## 7. Testes de comportamento editados (SC-009)

Preencher **apenas** se algum teste de fluxo, validação, cota, retomada ou armazenamento
tiver precisado ser editado. Uma linha por teste, com a justificativa escrita.

**Nenhum teste mudou de resultado.** As três edições abaixo são de **estrutura de
apresentação**, não de comportamento: em cada uma a pergunta que o caso faz permanece
idêntica, e o que mudou foi a suposição sobre qual elemento a responde — suposição que era
detalhe de implementação da feature anterior.

| Teste | O que mudou | Por quê |
| --- | --- | --- |
| `e2e/keyboard.spec.ts` — "fila, estimativa, ajuste de lista e resumo são operáveis por teclado" | A asserção lia `getByLabel(t.queue.label)`; passou a procurar a posição em qualquer `role="status"` da tela | A pergunta continua sendo **"a posição na fila é anunciada?"** (FR-018). O que mudou é o portador: era o `QueueIndicator`, com `role="status"` e `aria-label`, no topo da etapa de serviço; passou a ser a linha de contexto do cabeçalho, que é texto real e existe em todas as fases do ciclo (008/FR-013, research §R2). O caso deixou de afirmar *qual elemento* anuncia — que nunca foi o requisito |
| `e2e/theme.spec.ts` — caso de seleção do cartão | O clique foi do `checkbox` para o `<label>` | O controle real é `sr-only` desde a 008 e não tem área clicável própria. Clicar no rótulo exercita a mesma associação `htmlFor` que FR-025 exige preservar — e é o que o usuário faz |
| `e2e/decor-loading.spec.ts` — painel sem imagens | O seletor do nome do serviço foi restringido ao painel | O painel passou a nomear os serviços (US4), e o nome já aparecia no chip da barra superior. Sem o escopo, o seletor casa com dois elementos e falha por ambiguidade, não por defeito |
| `e2e/narrow-viewport.spec.ts` — "as cinco etapas cabem na largura" | A asserção lia `getByLabel(t.queue.label)`; passou a procurar o texto da posição | Mesma causa da primeira linha, e a mesma pergunta: **"a posição na fila cabe nesta largura?"**. O `aria-label` era do `QueueIndicator`, que deixou de ser o portador anunciado (008/FR-013) |

Nenhuma edição tocou teste de **fluxo, validação, cota, retomada ou armazenamento**.

### 7.1 Um defeito pré-existente, encontrado ao rodar contra o `dist/` (SC-008)

`e2e/narrow-viewport.spec.ts` — "a 200% de zoom de texto as três zonas continuam legíveis e sem
corte" — **falha contra o artefato construído**, nos dois projetos, com:

```text
page.addStyleTag: Applying inline style violates the following
Content Security Policy directive 'style-src 'self''
```

**Não é regressão desta feature.** A falha foi reproduzida na baseline, com as mudanças da 008
guardadas em `git stash`: o caso já falhava contra o `dist/` antes de qualquer linha desta feature
existir. A causa é a CSP, que só é injetada no build — o caso foi escrito na 007 e sempre rodou
contra o servidor de desenvolvimento, onde `addStyleTag` é permitido.

Fica registrado aqui em vez de corrigido porque corrigi-lo é mudança de comportamento de teste
alheio ao escopo desta feature: a correção certa é simular o zoom por `deviceScaleFactor` ou por
`viewport`, em vez de injetar estilo, e isso merece uma decisão própria. Contra o servidor de
desenvolvimento e nos dois projetos do fluxo normal, **os 158 casos passam**.
