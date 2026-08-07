# Resultado da validação — Reconexão Sem Descartar o Trabalho

**Feature**: `004-youtube-reconnect` · **Data**: 2026-08-07 · **Branch**: `feat/youtube-reconnect`

Execução dos cenários de [quickstart.md](./quickstart.md), como foi feito na 001, na 002 e na 003.

## Portão local

| Comando | Antes | Depois |
| --- | --- | --- |
| `npm run lint` | ✅ sem apontamentos | ✅ sem apontamentos |
| `npm run typecheck` | ✅ sem erros | ✅ sem erros |
| `npm test` | ✅ 611 testes, 52 arquivos | ✅ **761 testes**, 62 arquivos |
| `npm run test:e2e` | ✅ 56 testes | ✅ **66 testes**, 2 viewports |

150 verificações novas, 10 arquivos de teste novos. Nenhuma dependência nova.

---

## Ressalva sobre o método, declarada antes dos resultados

Os cenários foram validados por **verificação executável** — comportamento
exercitado por teste automatizado contra provedores mockados (MSW no portão
local, rotas interceptadas no Playwright).

**O roteiro manual de `quickstart.md` § "Verificação manual" não foi executado.**
Ele exige um humano operando o navegador com Client IDs reais, apagando a chave
de sessão do `localStorage` à mão. Registrá-lo como aprovado seria falso. O que
ele verifica está coberto por V16 e V32 em `e2e/reconnect.spec.ts`, com a sessão
morta de verdade no navegador — mas contra um Google simulado, não o real.

---

## V0 — a linha de base, demonstrada

✅ **Executado como exige o método.** Com o conserto de `searchOne` revertido,
`tests/integration/reauth-search.spec.tsx` falha exatamente como previsto:

```text
× a busca interrompida devolve interrupção, e nenhuma linha sai not_found
  AssertionError: expected null not to be null   (interruption)
× as linhas não buscadas voltam `pending`, não "não encontrada" (A3)
  AssertionError: expected false to be true
```

Restaurado o conserto, os 15 casos do arquivo passam. O defeito existia, e o
teste o pega pela razão certa.

O mesmo foi feito na cota fantasma, antes do conserto: `quota-401.spec.ts` media
**100 unidades por linha** que respondia `401` — `expected 100 to be +0`.

---

## Cenários de aceitação

### C1 — Sessão cai na primeira busca (US1, P1)

✅ **Passa** — `tests/integration/reauth-search.spec.tsx` (15/15).

| Verificado | Requisito |
| --- | --- |
| `401` não vira item `not_found`; as linhas voltam `pending` | FR-001, FR-002 |
| execução em `awaiting_reauth` com `outcome` ainda `null` | FR-002 |
| rascunho gravado antes de qualquer mudança de estado | FR-003 |
| nenhuma requisição após a detecção; enriquecimento não roda | FR-006, SC-007 |
| 100 linhas falhando juntas produzem **uma** interrupção | FR-007 |
| cancelamento explícito **não** vira pedido de reautorização | FR-008 |
| sessão, credencial e resultado do outro provedor intactos | FR-004, FR-005, SC-005 |
| a fila não é reordenada; o destino seguinte não começa antes da vez | FR-017 |
| `existingNames` da conta antiga é invalidado na perda de sessão | FR-015 |

### C2 — Preservação parcial e retomada (Q1)

✅ **Passa** — `reauth-partial-search.spec.tsx` (8/8) e `quota-401.spec.ts` (5/5).

As N linhas resolvidas antes da queda sobrevivem; as demais voltam `pending`; a
retomada emite requisição **só** para as que faltam (4 de 6 no cenário medido); o
consumo somado iguala o de uma execução ininterrupta. Casos de borda cobertos:
zero resolvidas degrada para a lista inteira, todas resolvidas não emite
requisição de busca nem consome cota de busca.

`401` deixou de registrar consumo; `403`, `5xx` e sucesso continuam registrando.

### C3 — Sessão cai durante a criação (US2, Q2)

✅ **Passa** — `reauth-creation.spec.ts` (11/11) e `partial-failure.spec.ts`
**sem edição** (6/6).

A playlist parcial não é removida, recriada nem renomeada; nada é escrito entre a
interrupção e a reconexão; a retomada à mesma conta completa sem duplicar nem
pular faixa; reconectar a uma **conta diferente** encerra como parcial com a
contagem real, sem criar segunda playlist.

### C4 — Modal (US1, US4)

✅ **Passa** — `reauth-dialog.spec.tsx` (22/22) e `dialog.spec.tsx` (10/10).

Abre por estado derivado; título nomeia o serviço; progresso de busca e de
criação; custo da retomada só no provedor com orçamento diário e sobre
`remainingLineIds`; credencial ausente muda a mensagem sem descartar o trabalho;
`Esc` fecha; foco inicial dentro e devolvido ao fechar; a dispensa **não** é
persistida.

Verificado também que nada do que o diálogo renderiza contém token ou Client ID —
consequência de ele ser estado derivado, não registro próprio.

### C5 — Retomada sem recarga (armadilha `startedFor`)

✅ **Passa** — `reauth-resume.spec.tsx` (6/6).

Reconectar **na mesma montagem** reinicia a busca, busca só o que falta, e a
estimativa não é reexibida. Voltar para `creating` chama a retomada por lote sem
repedir a confirmação de revisão.

### C6 — Cabeçalho de contas (US3)

✅ **Passa** — `session-header.spec.tsx` (15/15).

Desconectado com credencial continua listado com **Reconectar**; conectado
oferece as duas ações com rótulos inequívocos; sem credencial não é listado;
fora dos destinos selecionados não é listado; desconectar mantém o serviço na
lista; nenhuma ação do cabeçalho emite requisição.

### C7 — Precedência de cota esgotada

✅ **Passa** — `youtube-quota.spec.ts` (9/9, os 6 casos existentes intocados).

Cota esgotada encerra sem passar por `awaiting_reauth` e **não** derruba a
sessão. O contraste está no mesmo arquivo: credencial inválida, no mesmo ponto do
código, vira pedido de reconexão.

### C8 — Acessibilidade

✅ **Passa** — `tests/a11y/steps.spec.tsx` (17/17) e `e2e/reconnect.spec.ts` (5/5
por viewport).

axe-core sem violação com o diálogo aberto nas três variantes (busca, criação,
sem credencial) e com o cabeçalho desconectado. No navegador real: **contenção de
foco** provada, fluxo operável só por teclado, sem rolagem horizontal em 375 px.

---

## D1 do plano — o limite declarado, e como foi fechado

A contenção de foco **não** é afirmada no portão local: happy-dom expõe
`showModal()` e marca `open`, mas não emula a camada de topo. A prova está em
`e2e/reconnect.spec.ts`, no Chromium real, onde `dialog.matches(':modal')` é
verdadeiro e 18 tabulações (12 diretas, 6 inversas) nunca alcançam um controle
fora do diálogo.

**Nota sobre a forma da asserção**, registrada porque ela quase virou um teste
falso: o ciclo de foco do navegador passa por um ponto neutro — o próprio
documento — entre o último e o primeiro controle. Uma asserção "o foco está
sempre dentro do `<dialog>`" reprova o comportamento **correto**. O que se afirma
é o que a contenção de fato significa: o foco nunca alcança um controle fora do
diálogo, e retorna a ele em no máximo três tabulações.

---

## Não regressão — o que foi tocado, e por quê

Das 8 suítes listadas no plano:

| Suíte | Estado |
| --- | --- |
| `tests/unit/no-secrets.spec.ts` | ✅ **intocada** |
| `tests/unit/throughput.spec.ts` | ✅ **intocada** |
| `tests/integration/partial-failure.spec.ts` | ✅ **intocada** |
| `tests/integration/draft-recovery.spec.ts` | ✅ **apenas acrescida** (+58 −0) |
| `tests/integration/search.spec.ts` | ⚠️ desestruturação (+6 −6) |
| `tests/integration/search-free-shape.spec.ts` | ⚠️ desestruturação (+10 −10) |
| `tests/integration/search-retry.spec.ts` | ⚠️ desestruturação (+2 −2) |
| `tests/integration/session-recovery.spec.ts` | ⚠️ **um caso mudou de desfecho** |

**As três marcadas "desestruturação" não tiveram nenhuma asserção alterada.** A
mudança é literalmente `const items = await runMatching(...)` →
`const { items } = await runMatching(...)`, imposta pelo contrato novo de
`search` (provider-contract §1, tarefa T019). O plano contou 4 chamadores em
`src/` e não contou os arquivos de teste que consomem `runMatching` — a lista de
"passar sem edição" e a tarefa T019 são, nesse ponto, incompatíveis entre si.

A alternativa — manter `runMatching` devolvendo `MatchItem[]` e criar uma segunda
função para o desfecho — foi considerada e **recusada**: as suítes de não
regressão passariam a exercitar um caminho que a produção não usa, e deixariam de
guardar justamente o que existem para guardar.

**`session-recovery.spec.ts` é o caso substantivo**, e não é adaptação: o caso
"um segundo 401 não entra em laço de renovação" afirmava
`expect(items[0]?.error).not.toBeNull()` — isto é, afirmava **o defeito que esta
feature existe para remover**. FR-001 e FR-002 exigem que aquela linha volte
`pending` com a interrupção relatada. O invariante que o caso sempre guardou — uma
renovação, duas buscas, sem laço — está intocado e continua verde; o que mudou é
o desfecho, deliberadamente.

---

## Extensões além do que o plano previu

Duas, ambas registradas aqui porque não estão em `data-model.md`:

1. **`CreationProgress.accountId`.** FR-031 exige distinguir "reconectou à mesma
   conta" de "reconectou a outra", e nenhum campo existente responde isso. Segue a
   mesma regra de `resumeFrom`: `SCHEMA_VERSION` **não** muda, ausente lê como
   `null`, e desconhecido **não** bloqueia a retomada — tratar ausência como
   divergência encerraria como parcial uma execução perfeitamente retomável.
2. **`ConnectButton` ganhou modo `compact`.** O cabeçalho precisa do rótulo
   "Reconectar" e sem os avisos de escopo repetidos em toda tela. O
   comportamento é o mesmo — este continua sendo o **único** caminho de
   autorização do app, e é isso que garante que reconectar do cabeçalho grave o
   rascunho antes de navegar exatamente como reconectar do diálogo.

Uma lacuna encontrada e fechada durante a validação ponta a ponta: o retorno do
consentimento apenas repõe a sessão (`bootstrap` chama `setSession` e nada mais),
e o ramo `awaiting_reauth` precisava despachar `authorized` ao ver sessão válida —
como o ramo `connect` já fazia. Sem isso a reconexão deixava a execução parada
para sempre, e nenhum teste de unidade a pegava: só o e2e, com a navegação real.
