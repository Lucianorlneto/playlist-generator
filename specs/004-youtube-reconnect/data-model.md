# Data Model — Reconexão Sem Descartar o Trabalho

**Feature**: `specs/004-youtube-reconnect` · **Fase 1** · 2026-08-07

Só o **delta** sobre o modelo da 002/003. Tudo que não aparece aqui permanece literalmente como está.

---

## §1. `RunPhase` — um valor novo

```ts
export type RunPhase =
  | 'pending' | 'connect' | 'estimate' | 'search' | 'review' | 'creating'
  | 'awaiting_reauth'   // ← novo
  | 'done' | 'skipped' | 'failed';
```

`awaiting_reauth` entra em `OPEN_PHASES`, portanto `isActive(run) === true` e `isFinished(run) === false`. É o que sustenta FR-002: a execução está parada, não encerrada.

**Invariante A1**: uma execução em `awaiting_reauth` tem `outcome === null`. Um `outcome` não-nulo com esta fase é estado impossível — `reduceRun` nunca o produz, porque `isFinished` corta na entrada (R2).

---

## §2. `ServiceRun` — um campo novo

```ts
export interface ServiceRun {
  // … todos os campos atuais, inalterados …

  /**
   * Para onde voltar quando a sessão for restabelecida. Não-nulo **apenas**
   * enquanto `phase === 'awaiting_reauth'`.
   */
  resumeFrom: 'search' | 'creating' | null;
}
```

**Por que explícito e não derivado**: derivar de `creation !== null` erra quando o `401` acontece na própria criação da playlist, antes do primeiro lote — `creation` ainda é `null` e a derivação mandaria a retomada refazer a busca inteira, queimando cota já gasta ([research §4](./research.md)).

**Invariante A2**: `resumeFrom !== null` ⟺ `phase === 'awaiting_reauth'`. Sair da fase zera o campo.

`emptyRun()` passa a inicializar `resumeFrom: null`.

---

## §3. `RunEvent` — um evento novo

```ts
| { type: 'session_lost'; from: 'search' | 'creating'; items?: MatchItem[] }
```

`items` só é enviado quando `from === 'search'` — carrega o resultado parcial. Ausente na criação, onde o ponto de retomada é `creation.committedItems`, que já é persistido.

Transições, todas puras em `reduceRun`:

| Fase atual | Evento | Resultado |
| --- | --- | --- |
| `search` | `session_lost {from:'search', items}` | `phase: 'awaiting_reauth'`, `resumeFrom: 'search'`, `items` gravados |
| `creating` | `session_lost {from:'creating'}` | `phase: 'awaiting_reauth'`, `resumeFrom: 'creating'` |
| `awaiting_reauth` | `authorized` | `phase: resumeFrom`, `resumeFrom: null` |
| `awaiting_reauth` | `skipped` | encerra `skipped` |
| `awaiting_reauth` | `quota_exhausted` | encerra como já faz |
| qualquer outra | `session_lost` | **identidade** |
| encerrada (`outcome !== null`) | qualquer | **identidade** (R2) |

`authorized` sobre `connect` continua se comportando exatamente como hoje — a fase nova não altera o caminho de primeira conexão.

---

## §4. Itens parciais

Nenhum tipo novo. O resultado parcial usa `MatchItem` como está:

- linha **resolvida** antes da interrupção → item com `status` de pontuação normal (`confident` / `uncertain` / `not_found`);
- linha **não buscada** → `pendingItem(line)`, isto é `status: 'pending'`, `candidates: []`, `error: null`.

**Invariante A3**: `status === 'pending'` significa "ainda não busquei", nunca "busquei e não achei". É a distinção que `runProviderSearch` já faz para cancelamento (`LineOutcome.resolved`) e que a retomada passa a usar como critério de "o que falta".

**Derivação pura**, em `src/domain/run/lines.ts`:

```ts
/** Ids das linhas deste destino ainda não resolvidas. Fonte única de FR-013b e FR-013. */
export function remainingLineIds(run: ServiceRun): string[];
```

Usada por **dois** consumidores que precisam concordar: o texto de custo do modal (FR-013) e a lista efetivamente buscada na retomada (FR-013b). Uma função só é o que faz SC-008 (desvio nulo entre informado e real) verdadeiro por construção.

**Invariante A4**: `remainingLineIds(run)` ⊆ `run.lineIds`, preservando a ordem de `run.lineIds`.

---

## §5. Resultado da busca — forma de retorno

```ts
export interface SearchOutcome {
  /** Um por linha de entrada, na ordem original. Sempre completo. */
  items: MatchItem[];
  /** Não-nulo quando a execução foi interrompida por falha de sessão. */
  interruption: AppError | null;
}
```

Substitui `MatchItem[]` no retorno de `PlaylistProvider.search` e de `runProviderSearch`. Detalhes e propagação em [contracts/provider-contract.md](./contracts/provider-contract.md) §1.

**Invariante A5**: `items.length === lines.length` sempre, interrompida ou não. A interrupção nunca encurta a lista — ela só faz mais itens saírem `pending`.

---

## §6. Estado transitório do pedido de reautorização

**Nenhuma entidade nova.** O pedido é derivado, não armazenado:

| Informação | Origem |
| --- | --- |
| há pedido aberto? | `run.phase === 'awaiting_reauth'` |
| qual serviço | `run.provider` |
| de onde retomar | `run.resumeFrom` |
| causa exibível | `authError` (já existe em `sessionSlice`) |
| quanto já foi feito (busca) | `run.items` menos `remainingLineIds(run)` |
| quanto já foi feito (criação) | `committedItemCount(run.creation)` |

Consequência direta: o pedido **não pode** conter token nem credencial, porque não existe como registro próprio — satisfaz a exigência da spec sobre a entidade "Pedido de reautorização" por construção, não por disciplina.

**O modal é aberto por estado derivado**, não por um sinalizador imperativo: ele aparece quando a execução corrente está em `awaiting_reauth` e o usuário não o dispensou nesta visita. O "dispensado" é estado local do componente (US4/FR-012) e **não** é persistido — recarregar reapresenta o pedido na etapa, como FR-012 e o cenário 3 de US4 exigem.

---

## §7. Sessões e credenciais

**Inalteradas.** Nenhum campo novo, nenhuma chave nova, isolamento por provedor intacto (`002` invariante S2).

O que muda é **quem chama o quê**: a perda de sessão em qualquer provedor passa a percorrer `handleSessionLoss`, que já existe e já faz a ordem correta (gravar rascunho → limpar sessão daquele provedor → registrar `authError`). Hoje só o caminho de falha de renovação do Spotify a alcança.

---

## §8. Armazenamento

`SCHEMA_VERSION` **não muda** e não há migração — justificativa completa em [research §13](./research.md). Resumo: rascunho antigo nunca contém os valores novos (`resumeFrom` lê como `null`), e código antigo lendo rascunho novo já descarta com aviso pela validação de forma existente, que é o descarte seguro que o Princípio de armazenamento pede.

`draftRepo` ganha:

- `resumeFrom` na serialização de `ServiceRun`, validado contra exatamente `'search' | 'creating'` — qualquer outro conteúdo lê como `null`;
- `'awaiting_reauth'` em `RUN_PHASES`.

**Invariante A6**: um rascunho gravado em `awaiting_reauth` e relido reconstrói a mesma fase e o mesmo `resumeFrom`. É o que faz o cenário 3 de US4 e o cenário 4 de US2 (recarregar sem reconectar) funcionarem pelo caminho de restauração já existente, sem caminho alternativo (FR-018).

---

## §9. Tabela de mudanças

| Arquivo | Mudança |
| --- | --- |
| `src/domain/types.ts` | `RunPhase` +1 valor; `ServiceRun` +1 campo; `SearchOutcome` novo |
| `src/domain/run/machine.ts` | `RunEvent` +1; transições de §3; `OPEN_PHASES` +1; `emptyRun` +1 campo |
| `src/domain/run/lines.ts` | `remainingLineIds` novo |
| `src/services/providers/errors.ts` | `isSessionLevel` novo |
| `src/services/providers/types.ts` | assinatura de `search` |
| `src/services/providers/searchRunner.ts` | interrupção, abort encadeado, retorno novo |
| `src/services/providers/http.ts` | não registrar cota em `401` |
| `src/services/storage/draftRepo.ts` | `resumeFrom` + fase nova na validação |
| `src/features/input/matchRunner.ts` | propaga `SearchOutcome` |
| `src/features/review/LineEditor.tsx` | consome `.items[0]` |
| `src/features/service/ServiceStep.tsx` | ramo `awaiting_reauth`; busca só o que falta; guarda `startedFor` |
| `src/features/result/creationRunner.ts` | despacha `session_lost` em erro de sessão |
| `src/features/connect/SessionHeader.tsx` | lista por destino+credencial; ação de reconectar |
| `src/features/connect/ReauthDialog.tsx` | **novo** |
| `src/ui/Dialog.tsx` | **novo** |
| `src/i18n/pt-BR.ts` | textos novos; reúso dos de reconexão existentes |
| `src/services/providers/youtube/index.ts`, `youtube/search.ts` | propagam `SearchOutcome` |
| `src/services/providers/spotify/index.ts`, `spotify/search.ts` | propagam `SearchOutcome` |
| `src/features/connect/reconnect.ts` | `resumePointOf` deriva de `resumeFrom` na fase nova |
| `src/features/result/RetryRemaining.tsx` | retomada acionada a partir de `awaiting_reauth` |
| `src/features/review/nameCheck.ts` | recheca o nome contra a conta atual após reconexão, invalidando o `existingNames` do store |

**Armadilha em `resumePointOf`**: a função devolve hoje `run.phase`, e o texto
`connect.resumeAt` ("Ao reconectar, você volta para: {where}") a consome. No
instante em que o diálogo renderiza, a fase **já é** `awaiting_reauth` — o texto
diria a fase de espera em vez de `search` ou `creating`, quebrando FR-009
exatamente no ponto que ele exige. A derivação passa a ler `resumeFrom` quando a
fase é `awaiting_reauth`. Verificado por V34.

**Onde vive o resultado obsoleto da checagem de nome**: `refreshExistingNames`
grava a lista em `existingNames` no store e **não** a limpa quando a sessão cai —
`handleSessionLoss` não a toca. Reconectar a uma conta diferente deixa, portanto,
a lista da conta **antiga** disponível para leitura. FR-015 não é satisfeito só
por rodar a checagem de novo: o valor velho precisa ser invalidado no momento da
perda de sessão, senão um consumidor pode lê-lo antes de a nova checagem
terminar. Verificado por V36.
