# Research — Reconexão Sem Descartar o Trabalho

**Feature**: `specs/004-youtube-reconnect` · **Fase 0** · 2026-08-07

Todas as afirmações sobre comportamento atual desta seção foram **verificadas por execução**, não por leitura. Os experimentos foram feitos com a infraestrutura de teste do próprio projeto (Vitest + MSW, `YT_RESPONSES.unauthorized()`) e removidos depois. Onde o resultado contraria a spec, a spec é corrigida — a §1 é o caso.

---

## §1. O diagnóstico da spec estava errado. O mecanismo real é outro

A spec afirmava que a perda de autorização durante a busca **encerra a execução do destino com desfecho "falhou"**, tornando-a imutável por R2. Executado contra o código, isso é falso. O que acontece é pior e mais silencioso.

**Experimento**: `runMatching('youtube', [3 linhas])` com `search.list` respondendo `401 authError`.

| Hipótese da spec                               | Resultado observado                                                        |
| ---------------------------------------------- | -------------------------------------------------------------------------- |
| `runMatching` lança                            | **Não lança.** Resolve normalmente                                          |
| `dispatchRun({type:'failed'})` dispara         | **Não dispara.** O `.catch` de `ServiceStep` nunca é alcançado               |
| Execução termina com `outcome: 'failed'`       | Execução vai para a fase **`review`**, com `outcome: null`                   |
| `handleSessionLoss` roda, sessão é limpa        | **`clearSession` chamado 0 vezes.** A sessão permanece no store              |
| `authError` é registrado                        | **Nunca é registrado.** `AuthError` não tem o que renderizar                 |

O que de fato sai de `runMatching` são todas as linhas assim:

```json
{ "status": "not_found", "candidates": [], "attentionReason": "not_found",
  "error": "Autorize o YouTube de novo para continuar" }
```

**A causa raiz é `searchOne`, em `src/services/providers/searchRunner.ts:170-174`**:

```ts
} catch (error) {
  if (isAbortError(error)) throw error;
  const message = error instanceof AppError ? error.info.title : t.errors.searchLineFailed.title;
  return { raw: [], error: message, resolved: true, retrySkipped: false };
}
```

O isolamento de falha por linha — que existe por um bom motivo, e que `001/FR-026` exige — **não distingue falha da linha de falha da execução**. `videoNotFound` e `reauth_required` recebem o mesmo tratamento: viram texto de erro dentro do item. O resultado é que a mensagem correta ("Autorize o YouTube de novo para continuar") é escrita cem vezes, uma por linha, enterrada no detalhe de cada fileira da revisão, enquanto o cabeçalho continua exibindo a conta como conectada.

**Consequência para o usuário**, e é exatamente o que ele relatou: ele chega à revisão com todas as linhas "Não encontrada", o YouTube ainda aparece conectado, não há botão de reconectar, e a busca **não pode ser refeita** — a fase já é `review` e a guarda `startedFor` de `ServiceStep` impede repetir o efeito. Descartar o rascunho é literalmente a única saída.

**Verificado também para o Spotify**: lá a renovação silenciosa falha em `ensureFreshSession` e chama `clearSession()` → `handleSessionLoss`, então a sessão *é* limpa e `authError` *é* registrado. Mas o erro lançado continua sendo capturado por `searchOne` linha a linha, então a revisão fica igualmente poluída de `not_found`. O caminho é meio-consertado no Spotify e não-consertado no YouTube.

**Correção decorrente**: a seção "Contexto" da spec foi reescrita para descrever este mecanismo. Os requisitos não mudaram — FR-001 e FR-002 já diziam a coisa certa ("tratar como pedido de reautorização, não como falha de execução"); apenas o diagnóstico de *como* a promessa é quebrada estava errado.

### Descoberta lateral: `isItemLevel` é código morto

`src/services/providers/youtube/errors.ts:80` exporta `isItemLevel(error)`, escrita na 002 justamente para separar falha de linha de falha de execução. **Nenhum arquivo a importa.** A distinção foi projetada e nunca ligada. Esta feature a liga — mas no lugar certo, ver §2.

---

## §2. Onde a distinção pertence: genérica, não no adaptador do YouTube

**Decisão**: a predicação vive em `src/services/providers/errors.ts`, como `isSessionLevel(error: AppError): boolean`, verdadeira para `reauth_required` e `session_expired`.

**Racional**: a distinção não é do catálogo de vídeo. `session_expired` é do Spotify; `reauth_required` é dos dois. `isItemLevel` no adaptador do YouTube é o lugar errado por construção — o `searchRunner` é compartilhado e o contrato do provedor proíbe ramificar por `ProviderId` fora de `src/services/providers/{provider}/`. Uma predicação genérica sobre `AppError.kind` respeita isso; injetá-la por provedor seria repetir a mesma regra duas vezes.

**Alternativas descartadas**:

- *Injetar `isItemLevel` no `ProviderSearchDeps`*: reproduziria a regra em dois adaptadores e permitiria que divergissem. A regra é uma só.
- *Usar `AppError.terminal`*: já significa outra coisa — "não repetir a requisição" (cota esgotada). Sobrecarregar o campo faria `quota_exhausted` cair no caminho de reautorização, que é justamente o que §12 proíbe.
- *Reaproveitar `isItemLevel` invertida*: ela lista `not_found`, uma lista de exclusão. Listar o que **derruba a execução** é a lista curta e a que erra para o lado seguro: um `kind` novo desconhecido continua sendo falha de linha, como hoje.

`isItemLevel` fica como está — código morto que esta feature não usa nem remove, para não misturar limpeza com mudança de comportamento.

---

## §3. Preservação parcial custa quase nada: os itens já são persistidos

A spec previa que a decisão Q1 seria "a maior mudança estrutural desta feature" e exigiria repensar onde o parcial é acumulado. **Verificado: não exige.** Duas peças já existem.

**1. `runProviderSearch` já produz item para toda linha, buscada ou não.** `outcomes` é pré-preenchido com `UNRESOLVED` (`resolved: false`) e `toItem` converte não-resolvida em `pendingItem(line)` — comentado no código como "Cancelada antes de ser buscada: continua aguardando, não 'não encontrada'". O retorno já é exatamente a forma que a retomada parcial precisa: resolvidas com resultado, restantes como `pending`.

**2. `ServiceRun.items` já é persistido no rascunho.** `draftPersistence.toWorkDraft` grava `state.queue` inteira, e `draftRepo` serializa `items: run.items.map(serializeItem)`. Guardar o parcial não requer chave nova, campo novo de armazenamento nem migração de esquema.

**Decisão**: a preservação parcial é implementada gravando os itens parciais em `run.items` no mesmo evento que leva a execução a `awaiting_reauth`, e a retomada busca `run.lineIds` filtrados por "item ainda `pending`".

**Consequência sobre a estrutura**: `runProviderSearch` precisa devolver, além dos itens, o fato de ter sido interrompido e por quê. O retorno passa de `Promise<MatchItem[]>` para `Promise<SearchOutcome>` com `{ items, interruption: AppError | null }`. É mudança de contrato em `PlaylistProvider.search`, propagada a dois adaptadores, ao `matchRunner` e ao `LineEditor` — mecânica, mas real, e está em [contracts/provider-contract.md](./contracts/provider-contract.md) §1.

**Alternativa descartada** — *lançar um `PartialSearchError` carregando os itens*: usar exceção para devolver resultado bem-sucedido-porém-incompleto obriga todo chamador a capturar para ler o caso normal, e `matchLine` (re-busca de uma linha só) passaria a ter dois caminhos de sucesso. Retorno explícito é mais honesto e tipa melhor.

---

## §4. Nova fase `awaiting_reauth`, não reúso de `connect`

**Decisão**: acrescentar `awaiting_reauth` a `RunPhase`, incluída em `OPEN_PHASES`, com um campo novo `resumeFrom: 'search' | 'creating' | null` em `ServiceRun`.

**Por que não voltar para `connect`**: `connect` é a porta de entrada do ciclo, e `reduceRun` responde a `authorized` levando para `needsEstimate(run) ? 'estimate' : 'search'`. No YouTube isso reexibiria a tela de estimativa calculada sobre `run.lineIds.length` — **a lista inteira**, não o que falta —, contradizendo FR-013 e SC-008 no primeiro clique. Consertar isso dentro de `connect` exigiria que `connect` soubesse se é primeira conexão ou reconexão, que é a informação que a fase nova carrega explicitamente.

**Por que `resumeFrom` explícito e não derivado de `creation !== null`**: a derivação parece funcionar e falha num caso real. Se o `401` acontece em `createPlaylist` — antes de qualquer lote —, `creation` ainda é `null`, e a derivação mandaria a retomada para `search`, refazendo a busca inteira já concluída e queimando cota. O campo é persistido junto com o resto de `ServiceRun`; ver §13 sobre esquema.

**Transições** (todas em `reduceRun`, puras e testáveis sem DOM):

| Fase de origem       | Evento                         | Destino           |
| -------------------- | ------------------------------ | ----------------- |
| `search`             | `session_lost` (items parciais) | `awaiting_reauth` com `resumeFrom: 'search'` |
| `creating`           | `session_lost`                  | `awaiting_reauth` com `resumeFrom: 'creating'` |
| `awaiting_reauth`    | `authorized`                    | `resumeFrom` (`search` ou `creating`) |
| `awaiting_reauth`    | `skipped`                       | encerra como `skipped` |
| `awaiting_reauth`    | `quota_exhausted`               | encerra conforme já faz (§12) |
| qualquer encerrada   | `session_lost`                  | **identidade** — R2 preservado |

R2 continua intacto: `awaiting_reauth` tem `outcome: null`, e `reduceRun` já devolve `run` sem tocar quando `isFinished(run)`.

### Armadilha verificada: a guarda `startedFor` bloquearia a retomada

`ServiceStep` guarda o efeito por `key = ${provider}:${run.phase}`, para o StrictMode não disparar a busca duas vezes. Se o ramo de `awaiting_reauth` **não** atribuir `startedFor.current`, a chave continua `youtube:search`; ao voltar para `search`, a guarda reconhece a chave antiga e **a busca não recomeça** — FR-014 quebraria silenciosamente, sem erro visível.

Na prática o caminho de reconexão é sempre navegação de página inteira, o que zera o `ref`; mas depender disso é depender de um efeito colateral. **Decisão**: o ramo de `awaiting_reauth` atribui a chave como todos os outros, e existe teste dedicado que retoma **sem** recarregar, provando que a busca reinicia.

---

## §5. A retomada da criação já existe. Q2 é muito mais barata do que a spec supunha

A spec tratou FR-029 (retomar do lote confirmado, sem duplicar) como trabalho novo. **Ele já está implementado e testado.**

- `creationRunner.sendRemainingItems` incrementa `committedItems` só após resposta de sucesso e grava de forma síncrona;
- `retryRemaining()` parte do `playlistId` gravado e reenvia só o que falta, sem criar segunda playlist;
- `RetryRemaining.tsx` já oferece o botão;
- `tests/integration/partial-failure.spec.ts` já cobre "não duplica nem falta faixa", "não cria segunda playlist" e "nenhum item confirmado é reenviado" (SC-010).

Verificado no código: no `catch` de `sendRemainingItems`, um erro que não é `quota_exhausted` cai em `setCreationError(appError)` e **retorna sem despachar evento**. A execução permanece na fase `creating`, com `outcome: null`. Ou seja, a fase de criação **já é retomável** — ela só não sabe pedir reautorização.

**Consequência para o plano**: FR-029, FR-030 e FR-032 são satisfeitos pelo que existe. O trabalho real de Q2 se reduz a: reconhecer o erro de sessão em `sendRemainingItems` e despachar `session_lost` em vez de apenas `setCreationError`; e fazer a retomada pós-reconexão chamar `retryRemaining()`. FR-028 (informar quantas faixas entraram) já tem os dados em `committedItemCount(creation)` — hoje exibidos por `RetryRemaining`, agora também no modal.

---

## §6. Cota fantasma: o `401` é contabilizado como se tivesse custado

**Experimento**: 3 linhas, todas com `401`. Registro de consumo antes: `null`. Depois: `{"units": 300}`.

`http.ts:212-213` registra o consumo assim que a resposta chega, **antes** de olhar o status:

```ts
// A resposta chegou: o provedor contabilizou a operação, então nós também.
if (operation !== undefined) deps.recordConsumption?.(operation);
```

A premissa do comentário é falsa para `401`: uma requisição rejeitada por credencial inválida não é cobrada da cota do projeto — ela nem chega a ser executada do lado do provedor. O efeito é que uma perda de sessão em uma lista de 100 linhas grava **10.000 unidades fantasma** no registro local.

**Por que isso é desta feature e não de outra**: FR-013 manda informar o custo da retomada e SC-008 exige desvio nulo entre informado e real. Com a cota fantasma, o usuário reconecta e a tela de estimativa pode declará-lo **bloqueado por esgotamento** de um orçamento que ele não gastou — transformando o conserto em uma segunda parede. É pré-requisito, não escopo adjacente.

**Decisão**: não registrar consumo quando `response.status === 401`. Mantém-se o registro para todos os demais status, inclusive `403 quotaExceeded` (onde é irrelevante mas inofensivo) e `5xx` (onde o provedor de fato processou).

**Alternativa descartada** — *deduzir 100 unidades ao detectar a perda de sessão*: exigiria saber quantas linhas falharam por autenticação e reconstruir a conta para trás. Não registrar o que não foi cobrado é a correção na origem.

---

## §7. O custo da retomada é o das linhas que faltam

FR-013 pede o custo adicional; SC-008 pede desvio nulo. `nominalCost` já aceita `lineCount` e `retryReserve` arbitrários, então a conta da retomada é a mesma função aplicada ao subconjunto pendente:

- `N` = linhas de `run.lineIds` cujo item ainda está `pending`;
- `R` = `retryReserveOf(provider, essas linhas)`, recontado sobre o subconjunto — a reserva já gasta está em `run.retriesUsed` e continua descontada como hoje;
- `S` (itens confirmados) **não entra**: a retomada é de busca, e a criação tem custo próprio já contado quando a revisão for confirmada.

**Decisão**: nenhuma fórmula nova. Uma função pura `remainingLineIds(run)` em `src/domain/run/` alimenta tanto o texto do modal quanto a busca da retomada — **a mesma fonte para o que é dito e para o que é feito**, que é o que torna SC-008 verdadeiro por construção em vez de por coincidência.

---

## §8. Modal: `<dialog>` nativo

**Decisão**: um componente `src/ui/Dialog.tsx` sobre o elemento `<dialog>` nativo com `showModal()`.

**Racional**: a constituição proíbe biblioteca de componentes e coloca o ônus da prova em quem quer adicionar. O `<dialog>` nativo entrega de graça, no navegador, o que FR-011 exige: contenção de foco, fechamento por `Esc`, camada de topo sem `z-index`, e semântica de diálogo modal para leitor de tela. A alternativa manual seria escrever armadilha de foco, gestão de `inert` e pilha de camadas — dezenas de linhas de comportamento sutil que o navegador já implementa.

**Verificado no ambiente de teste**: `document.createElement('dialog').showModal()` existe e funciona no happy-dom (`open === true` após a chamada). Portanto os testes de componente podem exercitar abrir/fechar/`Esc` sem navegador.

**Limite honesto do happy-dom**: ele expõe a API, mas **não** emula a contenção real de foco da top layer. Logo, a contenção de foco de FR-011 não pode ser provada em happy-dom. **Decisão de verificação**: o contrato de abertura, fechamento, foco inicial e retorno de foco é testado em componente; a contenção é verificada em Playwright, no navegador real, junto do fluxo ponta a ponta. Afirmar contenção com base em teste de happy-dom seria um invariante falsamente verificado, que é o que o Princípio IV proíbe.

---

## §9. `SessionHeader`: a lista passa a ser de destinos, não de sessões

Hoje: `PROVIDER_ORDER.filter((p) => sessions[p] !== null)`. Um serviço desconectado desaparece com o seu único ponto de interação.

**Decisão**: a lista passa a ser dos provedores com **credencial salva** que estejam em `destinations.selected`, ordenada por `PROVIDER_ORDER`, cada um exibindo estado (conectado com nome da conta, ou desconectado) e as ações cabíveis — `Reconectar` sempre, `Desconectar` só quando conectado (FR-019 a FR-025).

**Por que filtrar por destino selecionado e não por credencial apenas**: FR-019 diz "credencial salva **e** entre os destinos relevantes". Listar um provedor que o usuário não escolheu convidaria a autorizar um serviço que não vai ser usado, e o Princípio II proíbe emitir requisição a provedor não selecionado. Antes da etapa de destinos, `selected` está vazio e o cabeçalho não lista nada — que é o comportamento correto: não há trabalho para preservar ainda.

`ConnectButton` já recebe o provedor por propriedade e já grava o rascunho antes de navegar (`flushDraftNow`), satisfazendo FR-024 sem alteração. A ação de reconectar do cabeçalho reutiliza o mesmo caminho.

---

## §10. Um pedido de reautorização, não cem

FR-007 exige um único pedido por execução. Com `Promise.allSettled` sobre 100 linhas, todas as 100 podem receber `401` antes de qualquer uma ser tratada.

**Decisão**: `runProviderSearch` mantém um `AbortController` interno encadeado ao `ctx.signal`. A primeira linha que falha com erro de sessão registra a interrupção e **aborta as demais**; as linhas ainda não emitidas nunca chegam a virar requisição (FR-006, SC-007), e as em voo caem no caminho de cancelamento já existente, voltando como `pending`. O `AppError` guardado é o da primeira falha.

**Efeito colateral desejável**: a cota fantasma de §6 fica limitada às poucas requisições já em voo, em vez de uma por linha.

---

## §11. Cancelamento do usuário prevalece sobre perda de sessão

FR-008 proíbe apresentar como reautorização algo que o usuário mandou parar. Como o abort interno de §10 e o cancelamento do usuário usam o mesmo mecanismo, a distinção precisa ser explícita.

**Decisão**: a interrupção só é reportada como perda de sessão se `ctx.signal.aborted === false` no momento em que a interrupção é consolidada. Se o sinal externo já abortou, o desfecho é cancelamento, e nenhum `session_lost` é despachado. `ServiceStep` já distingue cancelamento por `controller.signal.aborted` ao chamar `finishSearch`.

---

## §12. Cota esgotada continua vencendo

Se `quota_exhausted` e `reauth_required` acontecem na mesma execução, reconectar não devolveria cota, e `002/FR-031` proíbe repetir contra cota esgotada.

**Decisão**: `quota_exhausted` é terminal em `AppError.terminal` e já sai por `throw classified` em `http.ts:226-229`, antes do tratamento de `401`. A ordem já está correta e não muda. `isSessionLevel` retorna `false` para `quota_exhausted` por não estar na lista de §2 — a precedência é estrutural, não um `if` de desempate. Teste dedicado prova que uma execução com cota esgotada não exibe modal de reconexão.

---

## §13. Esquema de armazenamento: sem migração

Duas adições tocam o rascunho persistido: o valor novo `awaiting_reauth` em `RunPhase` e o campo novo `resumeFrom` em `ServiceRun`.

**Decisão**: `SCHEMA_VERSION` **não** é incrementada, e nenhuma migração é escrita.

**Justificativa contra a regra do Princípio de armazenamento** ("mudança incompatível de formato MUST incluir migração ou descarte seguro"): a mudança não é incompatível em nenhuma direção.

- *Código novo lendo rascunho antigo*: rascunhos existentes nunca contêm `awaiting_reauth` nem `resumeFrom`. `resumeFrom` é lido com padrão `null`, que é exatamente o estado de quem nunca perdeu sessão.
- *Código antigo lendo rascunho novo*: `readVersioned` valida a forma e `RUN_PHASES.includes(phase)` recusaria a fase desconhecida, resultando em descarte com aviso — que é o "descarte seguro" que a regra pede, já implementado.

Incrementar a versão seria pior: invalidaria o rascunho de todo usuário que atualizasse no meio de um trabalho — provocando exatamente a perda que esta feature existe para evitar.

`resumeFrom` entra na serialização de `draftRepo` com validação de forma restrita aos dois valores aceitos, e qualquer outro conteúdo lê como `null`.

---

## §14. Mapa de verificações

Cada linha é uma verificação executável exigida pelo Princípio IV. Testes que **devem passar sem edição** são prova de não regressão; editá-los para acomodar a mudança é sinal de que a mudança saiu do contrato.

| # | Verificação | Requisito | Onde |
| --- | --- | --- | --- |
| V1 | `isSessionLevel` é verdadeira só para `reauth_required` e `session_expired` | FR-001 | unit |
| V2 | `401` na busca **não** produz item `not_found`; produz interrupção | FR-001, FR-002 | integração |
| V3 | linhas resolvidas antes do `401` sobrevivem como resultado | FR-013a | integração |
| V4 | linhas não buscadas voltam `pending`, não `not_found` | FR-013a | integração |
| V5 | a retomada busca só o que falta — contagem de requisições | FR-013b, SC-009 | integração |
| V6 | consumo total (interrompida + retomada) = execução ininterrupta | FR-013c, SC-008 | integração |
| V7 | `401` não registra consumo de cota | FR-013, SC-008 | integração: `quota-401.spec.ts` |
| V8 | ordem preservada e duplicidade recalculada sobre o conjunto completo | FR-013d | unit |
| V9 | busca sem interrupção e busca cancelada permanecem idênticas | FR-013e | **sem edição**: `search.spec.ts`, `search-free-shape.spec.ts`, `search-retry.spec.ts` |
| V10 | `reduceRun`: todas as transições da tabela de §4, inclusive identidade sob R2 | FR-002, FR-014 | unit |
| V11 | uma única interrupção com 100 linhas falhando juntas | FR-007 | integração |
| V12 | nenhuma requisição ao provedor após a interrupção | FR-006, SC-007 | integração |
| V13 | cancelamento do usuário não vira pedido de reautorização | FR-008 | integração |
| V14 | cota esgotada não exibe modal de reconexão | §12 | integração |
| V15 | modal: abre, fecha por `Esc`, foco inicial dentro, foco devolvido ao fechar | FR-011 | componente |
| V16 | contenção de foco e operação só por teclado | FR-011, SC-006 | **e2e** (Playwright) |
| V17 | axe-core sem violação séria/crítica com o modal aberto | SC-006 | a11y |
| V18 | fechar sem reconectar deixa a etapa com pedido e opção de pular | FR-012, US4 | componente |
| V19 | retomada **sem recarga** reinicia a busca (armadilha `startedFor` de §4) | FR-014 | componente |
| V20 | cabeçalho lista serviço desconectado com credencial e oferece reconectar | FR-019 a FR-021, SC-004 | componente |
| V21 | desconectar deixa o serviço listado com ação de reconectar | FR-025 | componente |
| V22 | serviço sem credencial não é listado | FR-023 | componente |
| V23 | perda de sessão em um provedor não toca sessão/credencial do outro | FR-004, FR-005, SC-005 | **sem edição**: `draft-recovery.spec.ts` estendido |
| V23a | serviço sem sessão quando a etapa começa continua abrindo na fase de conexão | § Edge Cases | **sem edição**: `session-recovery.spec.ts` |
| V24 | `401` na criação leva a `awaiting_reauth`, não a desfecho | FR-027 | integração |
| V25 | retomada da criação não duplica nem pula faixa | FR-029, SC-010 | **sem edição**: `partial-failure.spec.ts` |
| V26 | nada é escrito na conta entre a interrupção e a reconexão | FR-032, SC-011 | integração |
| V27 | reconexão a conta diferente durante a criação encerra como parcial | FR-031 | integração |
| V28 | nenhum host novo | Princípio II | **sem edição**: `no-secrets.spec.ts` |
| V29 | nenhum literal de texto de interface fora de `src/i18n/` | FR-033 | lint |
| V30 | reconexão que **falha** (consentimento negado, Redirect URI inválido) exibe o erro com causa e próximo passo, sem desfazer a preservação | FR-016 | integração |
| V31 | retomar de `awaiting_reauth` não altera a ordem da fila, não inicia destino fora de vez nem reabre destino encerrado | FR-017 | unit + integração |
| V32 | do aviso até a busca recomeçar, no máximo **duas** ações do usuário | SC-003 | **e2e** |
| V33 | `Dialog`: `showModal`/`close`, `onClose` uma vez, foco inicial e devolvido, `aria-labelledby`, papel de diálogo anunciado | U1–U6, A3 | componente |
| V34 | o ponto de retomada exibido vem de `resumeFrom`, nunca da fase corrente | FR-009 | componente |
| V35 | progresso de criação no diálogo: faixas já adicionadas e faltantes | FR-028 | componente |
| V36 | reconexão a conta diferente durante a busca refaz a checagem de nome de playlist contra a conta atual | FR-015 | integração |

---

## §15. Resumo das decisões

| # | Decisão | Alternativa principal descartada |
| --- | --- | --- |
| D1 | `isSessionLevel` genérica em `errors.ts` | injetar por provedor (duplicaria a regra) |
| D2 | `search` devolve `{ items, interruption }` | lançar exceção com itens (dois caminhos de sucesso) |
| D3 | fase `awaiting_reauth` + `resumeFrom` explícito | voltar a `connect` (reexibiria estimativa da lista inteira) |
| D4 | abort interno encadeado, primeira falha vence | tratar linha a linha (cem pedidos de reautorização) |
| D5 | não registrar cota em `401` | deduzir depois (reconstrução para trás) |
| D6 | `<dialog>` nativo | armadilha de foco manual (o navegador já resolve) |
| D7 | sem migração de esquema | bump de versão (invalidaria rascunho em andamento) |
| D8 | contenção de foco verificada só em e2e | afirmar com base em happy-dom (invariante falso) |
