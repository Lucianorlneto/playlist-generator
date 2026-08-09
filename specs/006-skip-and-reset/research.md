# Fase 0 — Pesquisa: pular sem tela fantasma e recomeçar de qualquer ponto

**Feature**: 006-skip-and-reset · **Data**: 2026-08-08

Tudo aqui foi medido contra o código real, com sonda temporária em
`tests/components/` executada pelo Vitest e apagada depois. A linha de base
antes de qualquer mudança é **69 arquivos, 902 testes, todos passando**.

---

## §1 — O defeito, medido

`dispatchRun({ type: 'skipped' })` faz exatamente uma coisa: `finish(run,
'skipped', 'skipped')` em `machine.ts:208`. A fila **não anda** — `advance()` é
uma ação separada, do `runSlice`, que ninguém chama nesse caminho.

`ServiceStep.tsx:305` renderiza `ResultScreen` quando `run.phase === 'creating'
|| finished`, e `finished` é `run.outcome !== null`. Uma execução pulada é
`finished`. `ResultScreen` com `result === null` (linha 60) entra no ramo
"criação em andamento", cujo título é `t.playlistConfig.creating`.

Sonda, fila de dois destinos, pulando o primeiro na fase `connect`:

```text
currentIndex: 0            ← a fila não andou
faseSpotify: "skipped"
headings:    ["Criando playlist no Spotify…"]
botoes:      ["Continuar para o YouTube"]
```

É literalmente o que a spec relata. O botão está certo e leva ao lugar certo —
mas atrás de um título que descreve um trabalho que não existe e de um clique
que ninguém pediu.

## §2 — O defeito é pior do que o relatado: destino único é beco sem saída

Com **um** destino, `ResultScreen` calcula `isLast = true` e oferece um único
botão, "Começar uma nova playlist". No ramo `result === null` (linhas 96–110) o
`onClick` é `advance()` seguido de `goToStep(queue.order.length > 1 ? 'summary'
: 'service')` — e **não** chama `resetWork()`, ao contrário do botão de mesmo
rótulo do ramo concluído (linha 210).

Com um destino: `advance()` leva `currentIndex` a `1`, que é
`order.length`; `goToStep('service')` não muda nada porque a etapa já é
`service`. `ServiceStep` então retorna `null` em `provider === null`.

Sonda, destino único, pulando na revisão e clicando no único botão oferecido:

```text
currentIndex:       1
step:               "service"
stepToken:          0          ← o foco não se move
headings:           []
botoes:             []
telaEmBranco:       true       ← container.innerHTML === ''
rawTextPreservado:  "Bohemian Rhapsody - Queen"
linhasPreservadas:  1
```

**Tela em branco, sem cabeçalho, sem botão, sem saída.** O trabalho continua no
estado — e inalcançável. A única saída é recarregar a página. Isso não estava na
spec porque o relato parou na primeira tela; a spec não muda, porque FR-004 e
FR-007 já proíbem os dois passos. Mas muda a prioridade: não é só uma tela
confusa, é um beco.

**Decisão**: o caminho de destino único vira o primeiro cenário de verificação
(V1 do quickstart), não um caso de borda.

## §3 — Onde a decisão deve morar

A pergunta "para onde vai o usuário depois de pular?" tem três respostas
possíveis e depende só da fila. O Princípio III manda que isso seja função pura
em `src/domain/`, e o IV, que tenha teste sem DOM.

**Decisão**: uma função pura `exitAfterSkip(queue, provider)` em
`src/domain/run/exit.ts`, retornando um valor de três estados:

```ts
type FlowExit =
  | { kind: 'next'; provider: ProviderId }  // há próximo destino
  | { kind: 'summary' }                     // último, mas algo rodou
  | { kind: 'discard' };                    // último e todos pulados
```

O critério de "algo rodou" é `outcome !== null && outcome !== 'skipped'`. Não é
`phase`, porque a fase de uma execução encerrada é derivada do desfecho e não
distingue "falhou depois de criar" de "falhou antes" — o desfecho distingue, e
FR-003 se apoia exatamente nessa fronteira.

**Alternativa recusada**: calcular na `ServiceStep` a partir de `queue.order` e
`currentIndex`. Seria o quarto lugar do código a reimplementar aritmética de
fila (já existe em `advanceQueue`, em `ResultScreen` e no `StepIndicator`), e o
Princípio IV não teria onde prender o teste sem montar componente.

**Segunda decisão**: a função é chamada **antes** do pulo, sobre a fila
corrente. A interface precisa saber se vai descartar para decidir se confirma
(FR-005), e a ação precisa saber para onde navegar. Duas chamadas à mesma
função pura sobre o mesmo estado dão a mesma resposta — é o mesmo padrão de
fonte única que `remainingLineIds` já usa na 004 para o custo da retomada.

## §4 — O ato de pular vira uma ação só

Hoje o pulo está espalhado em cinco chamadas a `dispatchRun` — `ServiceStep`
(conexão e reautorização), `QuotaEstimateScreen` (duas), `ReviewScreen` — e uma
sexta em `ResultScreen`, que pula o **próximo** destino e é a única que já
avança e navega corretamente.

**Decisão**: uma ação de store `skipService(provider)` que faz o ato inteiro —
cancelar a busca em voo, despachar `skipped`, avançar a fila e aplicar o
`FlowExit`. As seis chamadas passam a apontar para ela.

Isso não é centralização por gosto: FR-008 exige comportamento **idêntico** nas
quatro fases, e cinco cópias de uma sequência de quatro passos é como um dos
cinco acaba diferente. Com uma ação só, o teste de FR-008 é o mesmo teste rodado
quatro vezes.

Nota sobre a sexta chamada: em `ResultScreen`, pular o **próximo** destino
acontece a partir de um destino que rodou. `exitAfterSkip` devolve `summary`, e
o comportamento observável não muda — é por isso que
`e2e/multi-destination.spec.ts:156` ("pular o segundo serviço preserva a
playlist do primeiro") deve passar **sem edição**. Se ele precisar ser editado, a
implementação saiu do contrato.

## §5 — A busca não é cancelada ao pular

`ReviewScreen` renderiza durante `search` e `review` (`ServiceStep.tsx:303`) e
oferece o botão de pular nas duas. Pular durante a busca hoje não aborta nada: o
`AbortController` fica no store até `finishSearch`, e a busca segue consumindo
rede e cota até terminar sozinha. O resultado tardio é inofensivo — `reduceRun`
é identidade sobre execução encerrada (invariante R2) —, mas as requisições
saem.

**Decisão**: `skipService` chama `cancelSearch()` antes de despachar. O
comentário de `itemsSlice.ts:141` registra que o mesmo sinal atravessa o
limitador de taxa e o backoff do cliente HTTP, então o cancelamento também
encerra espera por `Retry-After`. FR-011 fica satisfeito pelo mecanismo que já
existe.

## §6 — Defeito latente: `resetWork` e `discardDraft` largam a busca em voo

`blankWork()` em `draftSlice.ts:28` zera `searchAbort: null` **sem abortar**.
Medido:

```text
resetWork() com busca em voo
  controller.signal.aborted:  false      ← nunca abortada
  searchAbort no store:       null       ← o controlador foi largado
  step:                       destinations
```

O controlador é descartado sem que ninguém possa mais abortá-lo. A busca segue
até o fim, gastando cota de um trabalho que o usuário acabou de jogar fora.

Hoje isso é raro: `discardDraft` só é alcançável pelo banner de rascunho, que
aparece na recuperação, na migração e no esgotamento de cota — situações em que
raramente há busca em voo. **O botão global de recomeço torna esse caminho
comum**, alcançável de dentro da própria tela de busca.

**Decisão**: `discardDraft` e `resetWork` passam a abortar antes de zerar. É
pré-requisito de FR-022, não um extra — e é o mesmo tipo de conserto de
pré-requisito que a 004 fez com a cota fantasma.

## §7 — O foco não se move entre serviços

`StepHeading` move o foco quando `focusToken` muda, e o token é `stepToken`, que
só é incrementado por `goToStep`/`goNext`/`goBack` **quando a etapa muda**.
Medido na sonda: passar do Spotify para o YouTube dentro da etapa `service`
deixa `stepToken: 0`.

Ou seja: hoje, quem usa leitor de tela avança de um serviço para o outro sem que
nada seja anunciado. FR-024 pede que o foco vá para o cabeçalho da tela que
passa a ser exibida.

**Decisão**: `advance()` incrementa `stepToken`. É uma linha, e conserta a
transição entre serviços em geral — inclusive a que já existe hoje pelo botão
"Continuar para o YouTube".

**Verificado que é seguro**: nenhum teste do repositório afirma foco em
transição de etapa (`toHaveFocus`/`activeElement` aparecem só em
`theme-control`, `dialog`, `reauth-dialog` e nos dois e2e de reconexão e
teclado, nenhum deles sobre `advance`).

## §8 — Confirmação: `Dialog` nativo, não `window.confirm`

O projeto tem os dois: `window.confirm` em `DraftRecoveryBanner` (duas
chamadas) e o componente `Dialog` sobre `<dialog>` nativo, trazido pela 004 com
contenção de foco, `Esc` e camada de topo.

**Decisão**: as confirmações desta feature usam `Dialog`.

| Critério | `window.confirm` | `Dialog` |
| --- | --- | --- |
| Conteúdo condicional de FR-015 ("a playlist já criada permanece") | uma string só, sem estrutura | natural |
| Rótulo do botão destrutivo | fixo pelo navegador, em inglês em alguns locales | `t.*`, sob `tp/no-ui-text-literals` |
| Verificação no portão local | exige forjar global do navegador | `dialog.spec.tsx` já é o padrão |
| Identidade visual (005) | nenhuma | `--surface`, `--rule-strong`, `backdrop:bg-scrim` |

**Alternativa recusada**: `window.confirm`, por consistência com o banner. Seria
consistência com o membro mais fraco: o texto de FR-015 é condicional e o
rótulo do botão de confirmação não seria nosso. Migrar as duas chamadas do
banner é a consistência na direção certa, mas **fica fora de escopo** — nenhum
FR pede, e misturar isso aqui é a mudança que a spec da 005 recusou fazer com
copy. Registrado como candidato a trabalho próprio.

## §9 — Visibilidade do comando de recomeço (FR-021)

`restoreDraft.ts:26` já tem o predicado de "há trabalho": texto não vazio, ou
linhas, ou alguma execução com item ou criação. É exatamente a pergunta que
FR-021 faz.

**Decisão**: extrair esse predicado para `src/domain/work.ts` como função pura
`hasWork({ rawText, lines, queue })` e usá-lo nos dois lugares —
`restoreDraft` e o botão. Duas definições de "há trabalho" que discordassem
produziriam um botão oferecido onde não há nada a descartar, ou escondido onde
há.

Uma diferença: o predicado da restauração exige item ou criação na execução,
porque um rascunho com fila vazia e nada digitado não vale restaurar. Para o
botão, uma fila **montada** já é trabalho — o usuário escolheu destinos e
avançou. A função ganha o parâmetro que distingue os dois usos, e o teste cobre
os dois.

## §10 — Persistência: nada muda

`SCHEMA_VERSION` **não muda** e não há migração. Nenhum campo novo é persistido:
`FlowExit` é derivado, e nem `exitAfterSkip` nem `hasWork` guardam estado.

Um ponto de ordem que já está resolvido no código e não pode ser quebrado:
`draftSlice` apaga o rascunho **depois** do `set()`, de propósito. Zerar o
trabalho notifica a assinatura de `draftPersistence`, cuja mudança de assinatura
de desfechos dispara `flushDraftNow` **síncrono** — apagar antes deixaria um
rascunho vazio de volta no disco. O caminho de descarte do FR-004 usa a mesma
ação e herda a ordem correta.

## §11 — Textos

Duas chaves existem no catálogo e nunca foram renderizadas: `queue.skipConfirm`
e `queue.endService`. `skipConfirm` diz "O que já foi criado nos outros serviços
continua intacto e será relatado" — é uma tranquilização para o caso em que
**algo rodou**, e FR-012 proíbe confirmar justamente nesse caso. Não serve.
Permanecem mortas; `i18n-stability.spec.ts` aceita adição de chave e recusa
modificação de valor existente, então nada a fazer.

Chaves novas, todas sob um bloco `flow` novo mais duas em `queue`:

| Chave | Uso |
| --- | --- |
| `flow.reset` | rótulo do botão global |
| `flow.resetTitle` | título do diálogo |
| `flow.resetBody` | o que será descartado |
| `flow.resetKeeps` | o que é preservado (FR-015) |
| `flow.resetKeepsPlaylist` | linha extra quando já existe playlist criada |
| `flow.resetConfirm` | rótulo do botão destrutivo |
| `queue.skipEndsFlowTitle` | título do diálogo de FR-005 |
| `queue.skipEndsFlowBody` | pular encerra o fluxo e descarta |

## §12 — Mapa de verificações

| # | Verificação | Onde | Requisito |
| --- | --- | --- | --- |
| V0 | `exitAfterSkip` nos três desfechos, fila de 1 e de 2 | `tests/unit/flow-exit.spec.ts` | FR-002, FR-003, FR-004 |
| V1 | `hasWork` com e sem fila montada | `tests/unit/has-work.spec.ts` | FR-021 |
| V2 | pular nas quatro fases leva ao próximo | `tests/components/skip-service.spec.tsx` | FR-002, FR-008 |
| V3 | destino único: pular leva à seleção, sem tela em branco | idem | FR-004, FR-007 |
| V4 | destino anterior concluído: pular o último leva ao resumo | idem | FR-003 |
| V5 | recusar a confirmação não pula nem descarta | idem | FR-005 |
| V6 | pular durante a busca aborta o controlador | `tests/integration/skip-aborts.spec.ts` | FR-011 |
| V7 | nenhuma requisição de escrita ao pular | idem | FR-009 |
| V8 | botão de recomeço ausente sem trabalho, presente com | `tests/components/reset-flow.spec.tsx` | FR-021 |
| V9 | recomeço confirmado zera trabalho, preserva credenciais e sessões | idem | FR-016, FR-018 |
| V10 | recomeço recusado não muda nada | idem | FR-020 |
| V11 | diálogo cita a playlist criada quando existe | idem | FR-015 |
| V12 | recomeço aborta a busca em voo | `tests/integration/reset-aborts.spec.ts` | FR-022 |
| V13 | rascunho apagado: recarregar não restaura | idem | FR-017 |
| V14 | `advance` move o foco para o cabeçalho | `tests/components/skip-service.spec.tsx` | FR-024 |
| V15 | axe sem violação com os dois diálogos abertos | `tests/a11y/steps.spec.tsx` | FR-023, SC-008 |
| V16 | fluxo por teclado: pular e recomeçar | `e2e/keyboard.spec.ts` | FR-023 |
| V17 | ponta a ponta: pular único destino não deixa tela em branco | `e2e/multi-destination.spec.ts` | SC-001, SC-002 |
| V18 | **sem edição**: `multi-destination.spec.ts:156` continua verde | e2e | FR-003, não regressão |
| V19 | **sem edição**: `run-machine.spec.ts` continua verde | unit | R2, não regressão |
| V20 | **sem edição**: `draft-recovery`, `draft-after-quota` continuam verdes | integração | não regressão |

Cinco suítes devem passar **sem edição**. Precisar editá-las é o sinal de que a
implementação saiu do contrato.
