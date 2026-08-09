# Contrato — Tokens de Design

**Feature**: 007-official-design-alignment

Este documento é **normativo** e substitui `specs/005-ui-design-system/contracts/tokens.md`.
Os valores aqui são a origem única de todo valor visual; `src/styles/tokens.css`
os implementa e `docs/style-guide.md` os descreve. Divergência entre os três se
resolve por este contrato e pelo código, nunca duplicando valor.

**A autoridade sobre as razões de contraste é `tests/unit/contrast.spec.ts`.** Os
números da §2 foram calculados durante a Fase 0 pela mesma fórmula; se o teste
discordar desta tabela, o teste está certo e a tabela se corrige.

---

## 1. Cor — 18 tokens

| Token | Papel | Papel (claro) | Noite (escuro) | Origem |
| --- | --- | --- | --- | --- |
| `--bg` | Fundo da página e da área principal | `#faf7f0` | `#0D1117` | design `pl-bg` |
| `--surface-zone` | **Novo.** Barra superior e trilha de etapas | `#f1ece0` | `#12171F` | design `pl-surface` |
| `--surface` | Cartão, painel | `#ffffff` | `#161C25` | design `pl-surface-2` |
| `--surface-raised` | Hover, linha alternada, campo focado | `#f4efe4` | `#1E2632` | design `pl-elevated` |
| `--rule` | Filete decorativo, divisor em repouso | `#e3dccd` | `#252D3A` | design `pl-border` |
| `--rule-strong` | Contorno **significante**: controle, imagem de terceiro | `#8B8476` | `#5E7A9D` | ajustado (§3 da pesquisa) |
| `--ink` | Texto principal | `#141c26` | `#E9EEF5` | design `pl-text` |
| `--ink-muted` | Texto secundário **e etapa pendente** | `#5a6473` | `#8A94A6` | design `pl-muted` |
| `--accent` | **Primária.** Preenchimento de ação | `#F5B301` | `#F5B301` | design `pl-accent` |
| `--accent-deep` | Hover e ativo do preenchimento | `#DFA301` | `#DFA301` | derivado |
| `--accent-ink` | Texto sobre preenchimento âmbar | `#141c26` | `#0D1117` | design |
| `--accent-text` | Âmbar para texto, link, borda, foco | `#816001` | `#F5B301` | ajustado ×2 — ver nota |
| `--state-confident` | Correspondência confiante | `#1F766E` | `#4FD1C5` | design `pl-confident`, ajustado no claro |
| `--state-uncertain` | Correspondência incerta | `#7A5C00` | `#F0C04A` | ajustado — **não** pode ser `--accent` |
| `--state-missing` | Não encontrada, erro | `#D31608` | `#F97066` | design `pl-danger`, ajustado no claro |
| `--state-live` | **Novo.** Sessão viva no chip de conexão | `#349842` | `#3FB950` | design `pl-success` |
| `--brand-spotify` | **Novo.** Acento identificador do provedor | `#189946` | `#1DB954` | design `pl-spotify` |
| `--brand-youtube` | **Novo.** Acento identificador do provedor | `#FF3126` | `#FF3B30` | design `pl-youtube` |

**Fundos tingidos de estado**: continuam **derivados** por `color-mix` do token de
estado com `--surface`, a 12% no claro e 15% no escuro. Não são tokens próprios —
derivar impede que trocar uma cor de estado exija editar dois valores e esquecer
um.

### Notas de intenção

- **`--accent` é idêntico nos dois temas.** É a âncora da identidade: a cor da ação não muda quando o substrato muda. O deslocamento de `#f4a900` (005) para `#F5B301` (design) é a única mudança.
- **Não existe `--ink-faint`.** O design usa uma terceira tinta (`#5F6878`) para a etapa pendente; ela reprova em todos os substratos, e todo valor que passa fica indistinguível de `--ink-muted`. A etapa pendente se distingue por **forma**, não por tinta (`research.md` §3, achado 1).
- **`--rule` não é contorno significante.** `#252D3A` sobre `--bg` dá 1,37:1. É separação decorativa. Tudo que carregue significado usa `--rule-strong`.
- **`--state-uncertain` é deliberadamente deslocado do âmbar de ação** nos dois temas. Os dois aparecem na mesma tela, e o selo "incerta" não pode ser o mesmo hex do botão primário.
- **As cores de marca e de estado divergem por tema.** Foram escolhidas contra um substrato quase-preto e não sobrevivem ao off-white: `#1DB954` sobre `#faf7f0` dá 2,42:1. As variantes claras são escurecidas preservando matiz e saturação.
- **`--surface-zone` inverte a direção entre os temas.** No escuro é mais claro que `--bg`; no claro é mais escuro. É o degrau de luminosidade que separa a zona do conteúdo, e ele só funciona afastando-se do substrato.

### Ajustes feitos na implementação (T008)

A Fase 0 mediu os dezoito tokens propostos e **nenhum reprovou**: as 27 razões da
§2 passaram na primeira execução de `tests/unit/contrast.spec.ts`. Um único valor
mudou, e por margem em vez de reprovação:

| Token | De | Para | Razão |
| --- | --- | --- | --- |
| `--accent-text` (claro) | `#896401` | `#816001` | Dava 4,58:1 sobre `--surface-zone` — passava por 0,08 no par #10, que é `text`. Qualquer acerto futuro no substrato da zona o derrubaria, e a falha apareceria como numeral ilegível na trilha. Escurecido um degrau preservando matiz e saturação: 4,94:1 |

**Os cinco pares que T008 previa escurecer não foram tocados**, e a razão é que a
previsão lia os números contra o piso errado. `--state-live`, `--brand-spotify`,
`--brand-youtube` e `--rule-strong` sobre `--surface-zone` pousam entre 3,11 e
3,15 — mas são pares `ui`, cujo mínimo é **3**, não 4,5. Passam com folga de 4% a
5% sobre o próprio piso. Escurecê-los custaria a função que FR-023 lhes dá: o
verde do Spotify escurecido mais um degrau deixa de identificar o Spotify, e um
acento identificador que não identifica é pior do que um contraste justo. Os
valores da §1 permanecem como estão, e `contrast.spec.ts` é a prova.

---

## 2. Pares aprovados

**Lista fechada.** Combinação que não está aqui é proibida em qualquer
componente. O teste percorre esta tabela nos dois temas e falha por par
reprovado **ou ausente**.

Mínimos: `text` = 4,5:1 · `large-text` = 3:1 · `ui` (borda, ícone, anel de foco) = 3:1.

| # | Frente | Fundo | Uso | Onde aparece | Claro | Escuro |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `--ink` | `--bg` | text | Texto corrido da área principal | 16,04 | 16,23 |
| 2 | `--ink` | `--surface-zone` | text | Marca, título da trilha, nome de etapa | 14,56 | 15,42 |
| 3 | `--ink` | `--surface` | text | Texto dentro de cartão | 17,16 | 14,68 |
| 4 | `--ink` | `--surface-raised` | text | Texto em linha destacada | 14,96 | 13,07 |
| 5 | `--ink-muted` | `--bg` | text | Meta, legenda, ajuda | 5,60 | 6,19 |
| 6 | `--ink-muted` | `--surface-zone` | text | Linha de apoio da trilha, etapa pendente | 5,08 | 5,88 |
| 7 | `--ink-muted` | `--surface` | text | Meta dentro de cartão | 5,99 | 5,60 |
| 8 | `--ink-muted` | `--surface-raised` | text | Meta em linha destacada | 5,22 | 4,98 |
| 9 | `--accent-text` | `--bg` | text | Link, texto de acento | 5,44 | 10,21 |
| 10 | `--accent-text` | `--surface-zone` | text | Numeral da etapa atual | 4,94 | 9,70 |
| 11 | `--accent-text` | `--surface` | text | Link dentro de cartão | 5,82 | 9,24 |
| 12 | `--accent-ink` | `--accent` | text | Rótulo do botão primário | 9,26 | 10,21 |
| 13 | `--accent-ink` | `--accent-deep` | text | Rótulo do botão primário em hover | 7,66 | 8,45 |
| 14 | `--state-confident` | `--surface` | text | Selo "confiante" | 5,42 | 9,18 |
| 15 | `--state-uncertain` | `--surface` | text | Selo "incerta" | 6,25 | 10,06 |
| 16 | `--state-missing` | `--surface` | text | Selo "não encontrada", erro | 5,40 | 6,14 |
| 17 | `--state-confident` | `--bg` | text | Selo fora de cartão | 5,07 | 10,15 |
| 18 | `--state-uncertain` | `--bg` | text | Selo fora de cartão | 5,84 | 11,12 |
| 19 | `--state-missing` | `--bg` | text | Mensagem de erro na página | 5,05 | 6,79 |
| 20 | `--state-live` | `--surface-zone` | ui | Ponto de sessão viva no chip | 3,12 | 7,08 |
| 21 | `--brand-spotify` | `--surface-zone` | ui | Ícone do provedor no chip | 3,13 | 6,95 |
| 22 | `--brand-youtube` | `--surface-zone` | ui | Ícone do provedor no chip | 3,11 | 5,07 |
| 23 | `--brand-spotify` | `--surface` | ui | Ícone do provedor em cartão | 3,69 | 6,62 |
| 24 | `--brand-youtube` | `--surface` | ui | Ícone do provedor em cartão | 3,67 | 4,83 |
| 25 | `--rule-strong` | `--bg` | ui | Contorno de controle | 3,47 | 4,28 |
| 26 | `--rule-strong` | `--surface` | ui | Contorno de campo, borda de capa | 3,71 | 3,87 |
| 27 | `--rule-strong` | `--surface-zone` | ui | Divisor significante da barra superior | 3,15 | 4,06 |

27 pares. Todos verificados na Fase 0; nenhum reprova.

**Pares deliberadamente ausentes**, e por quê:

- `--brand-*` como **texto** — proibido por FR-023: cor de marca é acento identificador, nunca portadora de conteúdo. `#FF3B30` sobre `--surface-raised` dá 4,29:1 e reprovaria como texto; a restrição do requisito tem base medida.
- `--accent` como texto sobre qualquer substrato claro — 1,73:1. Só preenchimento (FR-022).
- Qualquer coisa sobre `--rule` — `--rule` é filete, não substrato.

---

## 3. Tipografia — 6 degraus

Família única: **Space Grotesk**, variável, subsetada, com substituta de métrica
compatível. Inalterada em relação à 005 (FR-027).

| Degrau | Tamanho | Uso | Agrupa do design |
| --- | --- | --- | --- |
| `--text-data` | 0,75rem (12px) | Rótulo tabular, numeral, selo | 11 · 11,5 · 12 |
| `--text-meta` | 0,8125rem (13px) | Meta, legenda, linha de apoio | 12,5 · 13 |
| `--text-body` | 0,875rem (14px) | Texto corrido, rótulo de item | 13,5 · 14 · 14,5 |
| `--text-section` | 1rem (16px) | Título de seção, título de cartão | 15 · 15,5 · 16 · 17 · 18 |
| `--text-step` | 1,5rem (24px) | Título de etapa | 22 · 24 · 26 |
| `--text-page` | 2rem (32px) | **Novo.** Título de tela | 32 |

**Piso de legibilidade**: `--text-data` é reservado a rótulo tabular, numeral e
selo. **Nenhum texto que carregue conteúdo desce abaixo de `--text-meta`.** O
tamanho mais frequente do arquivo de design é 12,5px (98 ocorrências), abaixo do
degrau `meta`; adotá-lo literalmente encolheria a interface inteira. O agrupamento
preserva a proporção do desenho e descarta a precisão falsa de meio pixel
(`research.md` §2).

**Pesos**: 500 (corrente), 600 (ênfase), 700 (título). O peso 800 aparece 7 vezes
no design e é normalizado para 700.

---

## 4. Espaçamento, raio, profundidade

**Espaçamento** — 8 degraus, nada fora deles:

`--spacing-0.5: 0.125rem` (2px) · `--spacing-1: 0.25rem` · `--spacing-2: 0.5rem` ·
`--spacing-3: 0.75rem` · `--spacing-4: 1rem` · `--spacing-6: 1.5rem` ·
`--spacing-8: 2rem` · `--spacing-12: 3rem`

Os nomes seguem o espaço de nome `--spacing-*` que o Tailwind reconhece, como a
005 já fazia.

O degrau de 2px entra porque o design o usa 73 vezes — é o respiro entre título e
linha de apoio, e colapsá-lo em 4px engordaria toda a trilha.

**Raio** — 5 degraus:

| Token | Valor | Uso | Agrupa do design |
| --- | --- | --- | --- |
| `--radius-hair` | 2px | Conector, barra de progresso | 2 |
| `--radius-control` | 8px | Botão, campo, caixa de seleção | 4 · 5 · 6 · 8 · 9 |
| `--radius-card` | 12px | Cartão, painel | 10 · 11 · 12 · 13 |
| `--radius-panel` | 16px | Zona, cartão de destino | 14 · 16 |
| `--radius-pill` | 9999px | Chip, selo | 999 |

O raio de cartão sobe de 8px (005) para 12px. É a mudança de tese: a 005 fechou
os cantos para fugir do painel de SaaS genérico; o design oficial os reabre.

**Profundidade** — continua assimétrica por tema, e continua sendo escolha:

| Tema | Mecanismo |
| --- | --- |
| Claro | Um nível: `0 1px 2px rgb(20 28 38 / 6%), 0 4px 12px rgb(20 28 38 / 5%)` |
| Escuro | **Nenhuma sombra.** Profundidade por degrau de luminosidade (`--bg` → `--surface-zone` → `--surface` → `--surface-raised`) e filete de 1px |

---

## 5. Layout

Os nomes seguem os espaços de nome que o Tailwind reconhece; medidas estruturais
que não pertencem a nenhum deles vivem como propriedade customizada simples, como
`--gutter` fazia na 005.

| Token | Valor | Papel | Namespace |
| --- | --- | --- | --- |
| `--container-measure` | 42.5rem (680px) | Coluna primária de leitura — **era 46rem** | `--container-*` |
| `--container-panel` | 32rem | Largura do painel modal — **inalterado** | `--container-*` |
| `--rail-width` | 18.5rem (296px) | Largura da trilha de etapas | simples |
| `--side-panel-width` | 20.625rem (330px) | Painel lateral de apoio | simples |
| `--topbar-height` | 4.25rem (68px) | Altura da barra superior | simples |
| `--breakpoint-shell` | **64rem** (1024px) | Abaixo daqui a casca colapsa | `--breakpoint-*` |

**`--breakpoint-shell` foi medido em T042 e fixado em 64rem.** A conta é
fechada, não estimada:

| Parcela | Medida |
| --- | --- |
| Trilha de etapas (`--rail-width`) | 18,5rem |
| Coluna primária de leitura (`--container-measure`) | 42,5rem |
| Respiro lateral da área principal (`p-4` dos dois lados) | 2rem |
| **Mínimo absoluto** | **63rem** |

64rem é o primeiro rem inteiro acima do mínimo, com 1rem de folga. Abaixo disso
a coluna de leitura teria de encolher, e encolher a medida de leitura para caber
a trilha inverteria a prioridade — a trilha existe para servir o conteúdo.

O painel lateral de Destinos (20,625rem) **não** cabe nesta largura, e não
deveria: a soma com o gap daria 85,125rem. Ele desce para baixo da coluna por
`flex-wrap`, que é a forma executável de FR-020 — o painel nunca rouba a largura
de leitura, em nenhuma janela.

Ele **substitui** `--breakpoint-gutter`, que sai com a goteira. O número existe
também em `src/styles/breakpoints.ts`, porque CSS não lê constante de JavaScript;
`tests/components/shell.spec.tsx` falha se as duas cópias divergirem.

---

## 6. Regras de consumo

1. Componente consome **nome**, nunca valor. Verificado por `tp/no-raw-visual-values`.
2. Combinação de cor não listada na §2 é proibida.
3. Preenchimento sólido significa **acionável**. Estado usa fundo tingido + contorno + ícone + rótulo (FR-024).
4. Texto claro sobre `--accent` é proibido em qualquer contexto (FR-022).
5. Cor de marca é acento identificador: ícone e filete. Nunca ação, nunca estado, nunca texto (FR-023).
6. Foco usa `outline`, nunca `box-shadow` — `box-shadow` desaparece em modo de cores forçadas.
7. Todo token de cor existe nos dois temas. Definição parcial é erro (SC-005).
8. Substrato de par aprovado é **opaco**. Sobreposição translúcida do design vira valor opaco declarado (FR-028, FR-047).
