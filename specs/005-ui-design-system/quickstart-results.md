# Resultado da validação — Identidade Visual e Sistema de Design

**Feature**: `005-ui-design-system` · **Data**: 2026-08-07 · **Branch**: `refactor/ui`

Execução dos cenários de [quickstart.md](./quickstart.md), como foi feito na 001, na 002, na 003
e na 004.

## Portão local

| Comando | Antes | Depois |
| --- | --- | --- |
| `npm run lint` | ✅ sem apontamentos | ✅ sem apontamentos (mais `tp/no-raw-visual-values`) |
| `npm run typecheck` | ✅ sem erros | ✅ sem erros |
| `npm test` | ✅ 874 testes, 68 arquivos | ✅ **902 testes**, 69 arquivos |
| `npm run test:e2e` | ✅ 80 testes | ✅ **98 testes**, 2 viewports |

Nenhuma dependência nova no `package.json`. A tipografia entrou como arquivo versionado.

---

## Ressalva sobre o método, declarada antes dos resultados

Os cenários foram validados por **verificação executável** — comportamento exercitado por teste
automatizado contra provedores mockados — mais **inspeção visual por captura de tela** nos dois
temas, feita no Chromium via Playwright.

**O que não foi feito**: nenhum humano operou a interface com o sistema operacional realmente em
modo escuro, nem com leitor de tela real, nem com `prefers-reduced-motion` ligado no sistema. O
Playwright emula `colorScheme` e o axe-core aproxima a árvore de acessibilidade. Registrar esses
três como "aprovados por uso" seria falso; o que está aprovado é a verificação automatizada
descrita em cada cenário.

---

## Verificações que precedem o código

### V1 — `@theme inline` na Tailwind 4.3.3 ✅

Sondagem descartável com um token, `npm run build`, inspeção do CSS emitido:

```text
.bg-probe{background-color:var(--probe-raw)}
:root{--probe-raw:#f4a900}
[data-theme=dark]{--probe-raw:#0d1219}
```

O utilitário emite a **referência**, não o hex resolvido. A migração de componentes foi liberada.
Registrado em research §1.

**Achado colateral que vale mais que a confirmação**: um token declarado em `@theme inline` só
aparece no CSS se algum utilitário derivado dele for encontrado pelo scanner. Token cujo utilitário
ninguém usa não gera erro — apenas não existe. É o mesmo modo de falha silenciosa que motivou T009
e T012, confirmado na prática.

### V2 — licença da fonte ✅

`OFL.txt` do repositório de origem declara "SIL Open Font License, Version 1.1", copyright 2020 The
Space Grotesk Project Authors. Texto integral versionado em `src/assets/fonts/OFL.txt`.

### V3 — algarismos tabulares ✅ — **plano B não foi necessário**

Duas camadas. No arquivo: `tnum` sobreviveu ao subset, com os dez algarismos em 620 unidades cada.
No navegador, medindo largura renderizada em `--text-data`:

| Amostra | Com `tabular-nums` | Sem |
| --- | --- | --- |
| `08` | 15,609 px | 15,797 px |
| `11` | 15,609 px | 11,172 px |

**Os algarismos de Space Grotesk são proporcionais por padrão**, com 4,6 px de diferença entre `08`
e `11`. A goteira sem `tabular-nums` não ficaria levemente irregular — ficaria visivelmente torta.
A declaração é obrigatória, e por isso mora dentro do utilitário `data-numeral`, não em cada uso.

---

## Cenário 1 — Tema segue o sistema, sem piscada ✅

Automatizado em `e2e/theme.spec.ts`, com **método declarado**: um ouvinte de `readystatechange`
registra o valor de `data-theme` em cada estado do documento. A asserção é sobre o estado
`interactive` — o momento do `DOMContentLoaded`, **antes** de o `<script type="module">` executar,
porque módulo é adiado por definição.

| Situação | Esperado | Medido |
| --- | --- | --- |
| Preferência "Claro" gravada, sistema em escuro | `data-theme=light` em `interactive` | ✅ `light` |
| Idem, cor pintada | `rgb(250, 247, 240)` | ✅ |
| Sem preferência, sistema em escuro | `rgb(13, 18, 25)` na primeira pintura | ✅ |
| Sem preferência, sistema em claro | `rgb(250, 247, 240)` | ✅ |

O caso sem preferência **não usa script nenhum** — é o `@media (prefers-color-scheme: dark)` de
`tokens.css`. `public/theme-boot.js` existe apenas para a divergência, e essa separação é o que
limita o dano se ele falhar em carregar.

## Cenário 2 — Troca de tema não perturba o trabalho ✅

`e2e/theme.spec.ts`: com a busca **em andamento**, a troca para o tema escuro repinta a interface,
a etapa atual não muda, e a execução chega ao fim sem reiniciar nem ser cancelada — as três linhas
aparecem na revisão.

**Correção de asserção durante a execução, registrada por honestidade**: a primeira versão comparava
o texto inteiro da navegação e falhou, porque o rótulo da fase avança sozinho ("Conectando" →
"Revisando") enquanto o trabalho progride. A asserção passou a olhar só o elemento com
`aria-current="step"`. O invariante do FR-007 é que a etapa não mude, não que a tela congele — a
asserção anterior confundiria progresso legítimo com regressão.

## Cenário 3 — Persistência e retorno ao sistema ✅

Persistência entre cargas, retorno a "Sistema" e a escolha manual vencendo o sistema: cobertos em
`e2e/theme.spec.ts` e em `tests/unit/theme-resolution.spec.ts` (as quatro combinações da tabela de
`data-model.md` §2, mais nove formas de valor inválido).

## Cenário 4 — Degradação do armazenamento ✅

`tests/integration/theme-persistence.spec.ts`, 18 casos:

| Situação induzida | Resultado |
| --- | --- |
| Chave ausente | `'system'`, **nenhum aviso emitido** |
| JSON corrompido | Descarte + `'system'` |
| Forma inválida / preferência desconhecida / não textual | Descarte + `'system'` |
| `schemaVersion` divergente | Descarte + `'system'` |
| `getItem` lançando | `'system'`, sem exceção |
| `setItem` estourando cota | Não lança para quem chamou |

Em nenhum caso a aplicação quebra. O aviso emitido é sempre da chave de tema e só dela, e o
consumidor em `bootstrap.ts` a filtra — falha ao gravar preferência de cor nunca vira mensagem
visível (FR-011).

## Cenário 5 — Contraste ✅ — **a pendência conhecida foi resolvida**

`tests/unit/contrast.spec.ts`: **37 casos, todos passando**.

Na primeira execução, como o contrato previa: **31 passaram e 2 falharam**, exatamente o par 13,
medindo 1,7:1 no claro e 2,2:1 no escuro. A estimativa manual do contrato dizia 2,0 e 2,3 — errada
nos dois, e para menos no claro. O portão também corrigiu outros quatro números estimados, entre
eles o par 6, estimado em 10,4:1 e medido em 6,8:1.

**Resolução de T016**: `--rule-strong` passou a `#8f887a` no claro e `#5e7a9d` no escuro.

A escolha entre as duas saídas admitidas se resolveu por uma observação de sistema: **a separação
por superfície já estava implementada, em outro token**. `--rule` é o divisor discreto e continua
sem mínimo de contraste, porque reforça uma separação que a luminosidade já faz. O que sobra para
`--rule-strong` são os dois casos em que o traço **é** o delimitador e não há superfície
intermediária a que delegar — borda de campo e contorno de capa de álbum.

Dois desdobramentos:

1. O alvo passou a ser **as três superfícies**, não só `--bg`. Um campo em foco troca o fundo para
   `--surface-raised`, e esse caso — o mais estreito nos dois temas — ficava fora do portão. A
   lista fechada foi de **13 para 15 pares**.
2. `--rule` e `--rule-strong` deixaram de ser intercambiáveis. São funções diferentes, com
   requisitos diferentes. É isso que a decisão muda no sistema inteiro, e o motivo de ela vir antes
   de qualquer componente.

## Cenário 6 — Acessibilidade nos dois temas ✅

`tests/a11y/steps.spec.tsx` parametrizado por tema: **30 casos** (eram 15). Zero violação séria ou
crítica nos dois.

**Dito com honestidade**: as regras de contraste ficam desligadas porque o happy-dom não calcula
estilo o bastante, então a duplicação **não** verifica cor. O que ela verifica é que nenhuma etapa
introduza estrutura condicional ao tema. A verificação de contraste de verdade é o Cenário 5. As
duas se complementam — a matriz cobre pares declarados, o axe cobre a árvore renderizada.

Teclado nos dois temas, em `e2e/keyboard.spec.ts`: o anel de foco é `outline` sólido de 2px, sem
`box-shadow`, com a cor acompanhando o tema (`rgb(154, 91, 0)` no claro, `rgb(244, 169, 0)` no
escuro). O `ThemeControl` é **uma parada única de Tab** — os dois segmentos não selecionados ficam
com `tabindex="-1"`.

**Correção de método durante a execução**: a primeira versão usava `element.focus()` e media o anel
padrão do navegador, porque foco programático não casa `:focus-visible` no Chromium. O teste passou
a alcançar o controle por `Tab`.

## Cenário 7 — Nenhuma origem remota ✅

Duas camadas, como research §6 previu.

**Unitário** (`tests/unit/no-secrets.spec.ts`, estendido): nenhum `url(http…)` em CSS, nenhum
`@import` externo, todo `src:` de `@font-face` apontando para caminho local, licença OFL presente,
peso dentro do teto.

**Ponta a ponta** (`e2e/no-remote-origin.spec.ts`, novo): ouvinte de requisições com lista fechada
de hosts. A carga inicial e o fluxo até a revisão não escapam. A fonte vem de `127.0.0.1` e é
**uma só** (FR-034).

Conferência manual do artefato:

```console
$ npm run build && grep -coE 'https?://' dist/assets/*.css
0
```

**Correção de método durante a execução**: a primeira versão do teste de fonte ouvia respostas e
falhava de forma intermitente no viewport estreito. `font-display: swap` torna o carregamento
assíncrono por definição, e um ouvinte corre com ele. O teste passou a ler
`performance.getEntriesByType('resource')` **depois** de `document.fonts.ready`.

## Cenário 8 — Peso da tipografia ✅

```console
$ find dist -name '*.woff2' -exec ls -l {} \;
24008 dist/assets/space-grotesk-subset-C1XTsZ_s.woff2
```

**23,4 KB** contra o teto de 80 KB do SC-013 — 29% do orçamento, com ele inteiro consumido por um
único arquivo.

## Cenário 9 — Tela estreita ✅

`e2e/narrow-viewport.spec.ts` estendido para 320 px **nos dois temas**: nenhuma rolagem horizontal
nas etapas de configuração, destinos, entrada e revisão, com a goteira colapsada em prefixo e o
`ThemeControl` acionável no modo só-ícone.

A suíte inteira também roda no projeto `narrow-375`, então cada cenário desta lista foi verificado
duas vezes em largura.

## Cenário 10 — Fluxo inalterado ✅

`npm test` e `npm run test:e2e` passam **sem que nenhuma expectativa de comportamento tenha sido
alterada**. Os 874 testes que existiam antes da feature continuam passando com as mesmas asserções;
os 28 novos verificam o que a feature acrescentou.

**Textos**: `tests/unit/i18n-stability.spec.ts` compara a árvore de `src/i18n/pt-BR.ts` com um
instantâneo de 414 chaves do estado anterior à feature. Nenhum valor modificado, nenhuma chave
removida, e as **cinco** chaves novas são todas do prefixo `theme.` (FR-022). O `git diff` do
arquivo confirma: 14 inserções, zero deleções.

**Estrutura**: as cinco etapas continuam cinco, na mesma ordem, sem fusão, divisão ou remoção.

## Cenário 11 — Movimento reduzido ✅

Bloco `prefers-reduced-motion: reduce` em `index.css` suprime animação e transição. A régua do
indicador de etapa muda de estado sem animar, e **nenhuma informação se perde**: ela já é
`aria-hidden`, e o estado que ela mostra está dito por escrito na lista de etapas com
`aria-current="step"` e a contagem "N de T".

Verificado no CSS emitido; **não** exercitado com a preferência ligada no sistema operacional.

---

## Inspeção visual — o que a captura de tela encontrou

Capturas do fluxo nos dois temas, em 1280 px, revelaram **dois defeitos que nenhum portão pegou**.
Vale registrar porque os dois são do tipo que só aparece olhando.

### 1. A barra de progresso saía **verde**

`accent-accent` (`accent-color: var(--accent)`) estava corretamente emitido no CSS, e ainda assim a
barra aparecia verde nos dois temas.

**Causa**: dar `background-color` ao `<progress>` faz o Chromium abandonar o desenho nativo — e com
ele o `accent-color` — caindo no `-webkit-progress-value` legado, cujo padrão é verde. O estilo que
eu havia acrescentado para o trilho foi o que quebrou o preenchimento.

**Correção**: estilizar `::-webkit-progress-bar`, `::-webkit-progress-value` e `::-moz-progress-bar`
explicitamente, o que resolve nos dois motores sem depender do suporte a `accent-color` para este
elemento.

Nenhum teste pegaria isso: o CSS estava correto, a classe estava aplicada, e o valor computado de
`accent-color` era o âmbar certo. O que estava errado era o que o motor desenhava.

### 2. O marcador "Sem capa" transbordava a moldura

Duas palavras num quadrado de 32px, quebrando em duas linhas para fora da borda. Já era apertado
antes (com 40px e um valor arbitrário `text-[0.6rem]`); a escala finita tornou visível.

**Correção**: o texto continua presente como `sr-only` — o FR-035 o congela e removê-lo custaria
informação a quem não vê a imagem — e o que se desenha é a mesma moldura das capas reais, vazia,
com um traço. Ocupar o mesmo espaço mantém a coluna de título alinhada entre linhas com e sem
imagem.

---

## O que o portão de tokens órfãos mediu

`tests/unit/no-orphan-tokens.spec.ts` (T012) começou **vermelho de propósito**, com **256
ocorrências** em 38 arquivos, e terminou verde. É o que tornou a Phase 4 verificável em vez de
lembrada.

O inventário de T009 também encontrou, antes de qualquer código, uma lacuna que nenhuma tarefa
cobria: **quatro arquivos** (`App.tsx`, `LiveRegion.tsx`, `QueueIndicator.tsx`, `ConnectButton.tsx`)
consumiam token antigo e não estavam no escopo de T049–T058. Nenhum quebraria o build; todos
ficariam sem estilo em produção. O escopo de T056 foi ampliado.

---

## Divergências entre o planejado e o executado

| O quê | Como estava | Como ficou | Por quê |
| --- | --- | --- | --- |
| Lista de pares aprovados | 13 pares | **15** | O campo em foco pousa em `--surface-raised`, superfície que ficava fora do portão |
| Escopo de T056 | 3 arquivos | **7** | Lacuna encontrada pelo inventário de T009 |
| `CreationResult` | `failedLines: string[]` | mais `failedIndices: number[]` | T045 exige o numeral sobreviver até o relatório de falhas. Campo **aditivo**: rascunho antigo não o traz e a leitura devolve lista vazia, sem invalidar o registro |
| Cabeçalho de colunas da revisão | Existia | Removido | `MatchRow` deixou de ser linha de tabela e virou entrada de documento; era `aria-hidden` e não encabeçava mais nada |
| `src/features/review/reviewGrid.ts` | Existia | Removido | Sem consumidor após a reestruturação |

---

## T075 — executada sob confirmação

A tarefa se declarava "pendência combinada fora do escopo da spec, a ser confirmada com o usuário
antes de executar". A confirmação foi pedida e concedida; a skill
`.claude/skills/playlist-brand/SKILL.md` foi criada.

Ela **descreve**, não define: paleta, tipografia, escalas, a assinatura da goteira e as três
armadilhas conhecidas, com uma tabela final apontando para a origem única de cada valor no código.
As razões de contraste que ela cita são as medidas pelo portão, não recalculadas.

`brand-guidelines`, a skill da Anthropic, não foi tocada — a nova vive em diretório próprio, com
nome próprio, e o cabeçalho de cada uma avisa para nunca aplicar as duas ao mesmo artefato.
