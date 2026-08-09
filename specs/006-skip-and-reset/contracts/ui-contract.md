# Contrato — interface, textos e acessibilidade

**Feature**: 006-skip-and-reset

---

## §1 — Botão global de recomeço

**Onde**: cabeçalho de `Wizard.tsx`, no mesmo agrupamento de `ThemeControl` e
`SessionHeader` — o único ponto renderizado em todas as etapas (FR-013).

**Ordem de tabulação**: `ThemeControl` → `SessionHeader` → **Recomeçar**. Entra
por último no grupo, ainda antes do conteúdo principal. É a única adição desta
feature à ordem de tabulação.

**Componente**: `src/app/ResetFlow.tsx`. Fica em `app/`, não em `features/`,
porque é cromo de aplicação e não pertence a nenhuma etapa — mesmo critério que
já colocou `StepIndicator` e `DraftRecoveryBanner` ali.

| Propriedade | Valor | Requisito |
| --- | --- | --- |
| Variante | `ghost`, tamanho `sm` | FR-026 — não compete com a ação primária |
| Rótulo | `t.flow.reset` | FR-025 |
| Visibilidade | só quando `hasWork(state, { queueCounts: true })` | FR-021 |
| Teclado | `Button` já traz `focus-ring` e é `<button>` nativo | FR-023 |

**Por que `ghost` e não `danger`**: o botão não descarta — ele **pergunta**. O
peso destrutivo pertence ao botão de confirmação dentro do diálogo, que é
`danger`. Um `danger` permanente no cabeçalho de todas as etapas competiria com
a ação primária de cada uma delas, que é exatamente o que FR-026 proíbe e o que
a 005 corrigiu no `DraftRecoveryBanner` ([005/design.md §FR-047](../../005-ui-design-system/design.md)).

## §2 — Diálogo de recomeço

Sobre `Dialog` (`<dialog>` nativo, trazido pela 004). Estrutura:

```text
┌─ título: t.flow.resetTitle                        ← id do aria-labelledby
├─ corpo:  t.flow.resetBody          (o que se perde)
├─         t.flow.resetKeeps         (credenciais, conexões)
├─         t.flow.resetKeepsPlaylist (só se alguma execução tem result)
└─ ações:  [danger] t.flow.resetConfirm   [ghost] t.common.cancel
```

| Regra | Requisito |
| --- | --- |
| A linha da playlist só aparece quando existe `result !== null` em alguma execução | FR-015, US4 |
| `Esc` e o véu fecham sem descartar | FR-020 |
| Fechar por qualquer caminho deixa o estado intacto | FR-020 |
| O foco inicial vai para o primeiro focável do diálogo | herdado de `Dialog` |
| O foco volta ao botão de recomeço ao fechar | herdado de `Dialog` |

**Ordem dos botões**: confirmar primeiro, cancelar depois. É a ordem que
`Dialog.focusFirst` já pressupõe e a que `reauth-dialog` adota. O peso
destrutivo está na cor e no rótulo, não na posição — e o rótulo diz o que vai
acontecer, não "OK".

## §3 — Diálogo de "pular encerra o fluxo"

Aparece **apenas** quando `exitAfterSkip` devolve `discard` (FR-005, FR-012).

```text
┌─ título: t.queue.skipEndsFlowTitle
├─ corpo:  t.queue.skipEndsFlowBody   (pular encerra e descarta)
├─         t.flow.resetKeeps          (reúso — o que é preservado é o mesmo)
└─ ações:  [danger] t.common.discard   [ghost] t.common.cancel
```

Reúsa `t.flow.resetKeeps` de propósito: o que é preservado é literalmente o
mesmo conjunto, e duas redações do mesmo fato divergiriam com o tempo.

**Não confundir com `t.queue.skipConfirm`**, que existe no catálogo desde a 002
e nunca foi renderizado. Aquele texto tranquiliza sobre o que já foi criado em
outros serviços — é a mensagem do caso em que **algo rodou**, e FR-012 proíbe
confirmar nesse caso. Permanece morto ([research §11](./research.md)).

## §4 — Os seis pontos de pulo

Todos passam a chamar o mesmo componente de gatilho, que consulta
`exitAfterSkip` e decide entre agir e confirmar.

| # | Arquivo | Fase | Alvo |
| --- | --- | --- | --- |
| 1 | `ServiceStep.tsx` | `connect` | corrente |
| 2 | `ServiceStep.tsx` | `awaiting_reauth` | corrente |
| 3 | `QuotaEstimateScreen.tsx` | `estimate` | corrente |
| 4 | `QuotaEstimateScreen.tsx` | `estimate` (bloqueado) | corrente |
| 5 | `ReviewScreen.tsx` | `search` \| `review` | corrente |
| 6 | `ResultScreen.tsx` | resultado do anterior | **próximo** |

O caso 6 pula um destino que não é o corrente. `exitAfterSkip(queue,
nextProvider)` responde `summary` — porque o destino de onde o usuário está
olhando rodou — e o comportamento observável não muda.
`e2e/multi-destination.spec.ts:156` passa **sem edição**, e isso é o teste do
contrato, não um efeito colateral feliz.

**Rótulo inalterado em cada um dos seis** — o que não quer dizer o mesmo rótulo
nos seis. Os casos 1, 2, 5 e 6 usam `t.queue.skipService`; os casos 3 e 4 usam
`t.quota.skipDestination` ("Pular o {serviço} desta vez"), porque na estimativa
a decisão é sobre o orçamento do dia e não sobre o destino em si. O `SkipButton`
aceita `label`, `variant` e `size` justamente para preservar isso: o que esta
feature unifica é **comportamento**, e uniformizar a escrita seria uma revisão de
copy que nenhum requisito pediu.

Nenhum texto existente muda — `i18n-stability.spec.ts` passa sem regravação de
instantâneo.

## §5 — Foco

| Transição | Comportamento | Requisito |
| --- | --- | --- |
| serviço → próximo serviço | foco no cabeçalho da nova fase | FR-024 |
| último serviço → resumo | foco no cabeçalho do resumo | FR-024 |
| descarte → seleção de serviços | foco no cabeçalho da etapa | FR-024 |
| diálogo recusado | foco volta ao botão que o abriu | FR-020 |

O mecanismo é o que já existe: `StepHeading` move o foco quando `focusToken`
muda, e `advance()` passa a incrementar `stepToken`. Nenhum `focus()` manual
novo é escrito ([research §7](./research.md)).

## §6 — Acessibilidade

| Exigência | Como |
| --- | --- |
| Sem violação séria ou crítica no axe | V15 audita as etapas com cada diálogo aberto |
| Operável por teclado | V16, em Playwright, percorre pular e recomeçar sem mouse |
| Estados anunciados | os diálogos são `<dialog>` nativo, rotulados por `aria-labelledby` |
| Sem rolagem horizontal em tela estreita | `max-panel` de `Dialog`, já verificado por `narrow-viewport.spec.ts` |

## §7 — Textos novos

Todos em `src/i18n/pt-BR.ts`, sob `tp/no-ui-text-literals`. Nenhum valor
existente é alterado.

```ts
flow: {
  reset: 'Recomeçar',
  resetTitle: 'Recomeçar do zero?',
  resetBody: 'A lista colada, as correções e a configuração da playlist serão descartadas.',
  resetKeeps: 'Suas credenciais e as contas conectadas continuam salvas.',
  resetKeepsPlaylist: 'As playlists já criadas permanecem nas suas contas — nada é removido.',
  resetConfirm: 'Descartar e recomeçar',
},
```

```ts
queue: {
  // …existentes, inalterados
  skipEndsFlowTitle: 'Pular o {service} encerra o fluxo',
  skipEndsFlowBody:
    'Este é o último serviço e nenhum outro foi concluído. Pular descarta a lista colada e a configuração da playlist.',
},
```

**Voz**: ativa, sem desculpa, dizendo o que acontece em vez de perguntar se o
usuário tem certeza. É a orientação de escrita que a 005 registrou como
candidata a feature própria e que aqui se aplica só ao texto **novo** — nenhuma
linha existente é reescrita, para não misturar revisão de copy com correção de
fluxo.
