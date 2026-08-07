---
description: 'Lista de tarefas — Busca Sem Separador e por Título Isolado'
---

# Tasks: Busca Sem Separador e por Título Isolado

**Input**: Documentos de desenho em `/specs/003-flexible-search/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: **Obrigatórios.** O Princípio IV da constituição é explícito — "toda regra desta constituição e todo requisito funcional com consequência observável MUST ter verificação executável". Tarefas de teste não são opcionais neste projeto. O mapa completo está em [research §14](./research.md).

**Organization**: agrupadas por user story, para que cada uma seja implementável e testável de forma independente.

**Revisão pós-`/speckit-analyze` (2026-08-06)**: 58 tarefas. As correções de spec (D1/D2/I4) e de contrato (U1) **já foram aplicadas** aos documentos — não há tarefa para elas. Acrescentadas 5 tarefas de verificação que fechavam lacunas do Princípio IV: T017 (FR-018), T028 (FR-019), T030 (SC-002/003/006), T040 (SC-009 com retentativa) e T055 (heranças de FR-022).

## Format: `[ID] [P?] [Story] Descrição`

- **[P]**: pode rodar em paralelo (arquivo diferente, sem dependência pendente)
- **[Story]**: US1, US2, US3, US4 — só nas fases de user story
- Todo caminho de arquivo é relativo à raiz do repositório

## Path Conventions

Projeto único na raiz: `src/`, `tests/`, `e2e/`. Sem backend (Princípio I).

## Três suítes que NÃO podem ser editadas

`tests/unit/scoring-youtube-reference.spec.ts`, `tests/unit/throughput.spec.ts` e `tests/unit/no-secrets.spec.ts` devem continuar passando **sem nenhuma alteração**. São a prova executável de SC-005, SC-009, SC-011 e de "zero host novo". Editar qualquer uma delas para fazer a feature passar é violação do Princípio IV — se quebrarem, a implementação saiu do contrato.

A cláusula nova de SC-009 (vazão **com** retentativa) é coberta por uma suíte separada, T040, justamente para não tocar na intocável.

---

## Phase 1: Setup (Infraestrutura Compartilhada)

**Purpose**: preparar as fixtures antes de qualquer código. A calibração de `soloMargin` depende delas, e é o passo de risco da feature ([plan.md](./plan.md), "Ordem de implementação").

- [X] T001 [P] Criar `tests/fixtures/reference-shapes.json` com as **mesmas** 50 faixas de `reference-50.json` escritas nas três formas (`título - artista`, `título artista` sem separador, `título` isolado) e a `uri` esperada por faixa — é a fixture que valida SC-002, SC-003, SC-005 e SC-006 ([research §13](./research.md))
- [X] T002 [P] Criar `tests/fixtures/reference-titles-30.json` com 30 faixas escritas **só com o título**, marcando quais têm candidata dominante e quais são título genérico — alimenta a calibração de `soloMargin` e mede SC-004 e SC-010
- [X] T003 [P] Estender `tests/msw/handlers.ts` com respostas que devolvem apenas candidatas **abaixo do piso** `uncertain` (0,55), para exercitar o gatilho de retentativa de FR-009 sem depender de zero resultados

---

## Phase 2: Foundational (Pré-requisitos Bloqueantes)

**Purpose**: a forma declarada e as primitivas de comparação. Nada de user story compila antes disso.

**⚠️ CRÍTICO**: nenhuma user story pode começar antes desta fase terminar.

### Tipos e esquema

- [X] T004 Estender `src/domain/types.ts`: `LineShape`, `AttentionReason`, `InputLine.shape`, `MatchItem.attentionReason`, `ServiceRun.retriesUsed`, `QuotaEstimate.retryReserve`, e `SCHEMA_VERSION` de 2 para 3 ([data-model §1, §2, §4, §5, §6](./data-model.md))

### Primitivas de comparação

- [X] T005 [P] Implementar `tokenSet`, `tokensMatch` (igualdade tolerante, `levenshteinRatio ≥ 0,85`) e `coverage` (assimétrica) em `src/domain/normalize/index.ts` ([contracts/domain-api.md §2](./contracts/domain-api.md))
- [X] T006 [P] Criar `tests/unit/normalize-coverage.spec.ts` cobrindo a assimetria de `coverage` (`coverage(A,B) ≠ coverage(B,A)`), a tolerância a erro de digitação e o caso de conjunto vazio

### Parser sem portão de admissão

- [X] T007 Reescrever `parseLine` em `src/domain/parser/index.ts`: devolver `shape: 'explicit' | 'free'`, aplicar a invariante L2 (`unparsed` ⟺ `normalizeText(raw) === ''`) e garantir L1 (`free` ⟹ `artist === ''`) — depende de T004 ([data-model §1](./data-model.md))
- [X] T008 Estender `tests/unit/parser.spec.ts` com a tabela de derivação do data-model §1, mais os casos de borda que a spec exige explicitamente: `Jay-Z - 99 Problems` (hífen sem espaços **dentro** do nome do artista, US3/AC2, FR-003), `- Artista` (lado esquerdo vazio), `---`, `3.`, `🎵`, uma linha muito longa (frase inteira colada por engano) e a garantia de que `raw` continua byte a byte o original (L3)

### Elegibilidade de retentativa (puro)

- [X] T009 [P] Criar `src/domain/retry/index.ts` com `planQueries` e `retryReserveFor`, comparando `normalizeText(primary)` com `normalizeText(retry)` ([contracts/domain-api.md §4](./contracts/domain-api.md))
- [X] T010 [P] Criar `tests/unit/retry-eligibility.spec.ts` com a tabela verificada de [contracts/search-queries.md §2](./contracts/search-queries.md) — em especial que `Zoio de Lula - Charlie Brown Jr` **não** é elegível no YouTube e que `Song feat. X - Artist A & B` é

### Migração de armazenamento

- [X] T011 Implementar `migrateToV3()` em `src/services/storage/migrations.ts` conforme [contracts/storage.md §3](./contracts/storage.md), encadeada após `migrateToV2()` no bootstrap — depende de T004 e T007
- [X] T012 Estender `tests/unit/storage-migration.spec.ts`: rascunho v2 com linhas inválidas por falta de separador volta válido (W5), idempotência (W4), cadeia v1→v2→v3, desfecho concluído imutável (`002/SC-018`), rascunho corrompido descartado sem exceção

**Checkpoint**: `npm run lint && npm run typecheck && npm test` passa. O comportamento observável ainda é o de hoje — nenhuma linha nova é buscada, porque o runner ainda não usa `shape`.

---

## Phase 3: User Story 1 — Linha sem separador é buscada (Priority: P1) 🎯 MVP

**Goal**: qualquer linha com conteúdo alfanumérico chega à busca, e `nao sei viver sem ter voce cpm 22` encontra a faixa certa.

**Independent Test**: colar uma lista em que nenhuma linha tem separador e verificar que todas produzem candidatas — hoje nenhuma é sequer buscada.

### Testes para US1

- [X] T013 [P] [US1] Criar `tests/unit/scoring-combined.spec.ts` cobrindo a tabela de research §3: os dois exemplos do pedido em 1,00, `amor` vs `Amor Perfeito` em ~0,67 e `cpm 22` (só artista) em 0,00 pela média harmônica
- [X] T014 [P] [US1] Acrescentar a `tests/unit/scoring-combined.spec.ts` os casos de `artistClaimed` de research §4: `charlie brown` reivindica `Charlie Brown Jr` (2/3 ≥ 0,6), coincidência de uma palavra em nome longo não reivindica
- [X] T015 [P] [US1] Criar `tests/integration/search-free-shape.spec.ts` (MSW): lista sem separador algum produz candidatas em ambos os provedores, e a faixa vencedora é a mesma da forma explícita equivalente (SC-001)
- [X] T016 [P] [US1] Estender `tests/unit/dedupe.spec.ts`: `Zoio de Lula - Charlie Brown Jr` e `zoio de lula charlie brown jr` produzem a **mesma** chave (FR-020); guarda vazia passa a ser `key !== ''`
- [X] T017 [P] [US1] Acrescentar a `tests/integration/search-free-shape.spec.ts` a asserção de **FR-018**: linha na forma livre e linha só-título recebem até 5 candidatas alternativas, com os mesmos campos exibíveis das linhas explícitas (`001/FR-023`, `002/FR-024`) — o requisito hoje é herança presumida, sem verificação

### Implementação de US1

- [X] T018 [US1] Implementar `scoreCombined` e `artistClaimed` em `src/domain/scoring/index.ts` — depende de T005 ([contracts/domain-api.md §3](./contracts/domain-api.md))
- [X] T019 [US1] Implementar a seleção de via de pontuação por `shape` em `src/domain/scoring/index.ts` (`scoreForShape`, **sem** o reparo de falso corte — ele é de US3), preservando `scoreCandidate` intocada para `explicit`
- [X] T020 [P] [US1] Alterar `fieldedQuery`/`freeTextQuery` em `src/services/providers/spotify/search.ts` para respeitar `shape` conforme [contracts/search-queries.md §1](./contracts/search-queries.md)
- [X] T021 [P] [US1] Alterar a montagem de consulta em `src/services/providers/youtube/search.ts` para respeitar `shape` — linha `free` consulta a linha inteira e **não** retenta
- [X] T022 [US1] Passar `searchOne` de `src/services/providers/searchRunner.ts` a usar `scoreForShape`. **A guarda `if (line.parseStatus === 'unparsed') return …` PERMANECE**: após T007 ela significa "linha sem conteúdo alfanumérico", e removê-la faria o sistema consultar `---` e `🎵`, violando FR-011 e gastando cota. O que deixa de reprovar linhas é o parser (T007), não o runner — depende de T018, T019
- [X] T023 [US1] Alterar `inputKey` em `src/domain/dedupe/index.ts` para `normalizeText(textoPesquisável)` e ajustar a guarda de chave vazia ([research §9](./research.md))
- [X] T024 [P] [US1] Atualizar `t.input.separatorsHint` e `t.input.placeholder` em `src/i18n/pt-BR.ts`: o separador é **opcional**, e declarar o artista aumenta o acerto automático (FR-006)
- [X] T025 [US1] Ajustar `src/features/input/InputScreen.tsx` para exibir a dica nova — depende de T024

**Checkpoint**: US1 funciona sozinha. Uma lista inteiramente sem separador vira playlist. Os cenários 1 e 2 do [quickstart](./quickstart.md) passam.

---

## Phase 4: User Story 2 — Título isolado e escolha entre candidatas (Priority: P2)

**Goal**: `Não sei viver sem ter voce` traz candidatas ordenadas, resolve sozinha quando há dona clara, e pede escolha humana quando não há.

**Independent Test**: colar uma lista só de títulos e verificar que cada linha traz candidatas e que a revisão diz **por que** cada item pede atenção.

> **Passo de risco.** T029 é um portão de decisão: se a calibração não fechar SC-004 e SC-010 ao mesmo tempo, a saída mapeada é a opção B do D1 da spec (nunca automática para linha sem artista), que elimina `soloMargin` e simplifica `classifyLine`. Decidir **antes** de T033–T036 (interface).

### Testes para US2

- [X] T026 [P] [US2] Criar `tests/unit/scoring-margin.spec.ts`: `confident` exige limiar **e** margem; candidata única vira `uncertain` (FR-014b); empate técnico entre 1ª e 2ª vira `uncertain`; linha **com** artista declarado ignora a margem (FR-014a); **indício de versão rebaixa em linha sem artista declarado também** (FR-015, regra 5 de [contracts/domain-api.md §3](./contracts/domain-api.md))
- [X] T027 [P] [US2] Criar `tests/unit/attention-reason.spec.ts` cobrindo os quatro motivos e a precedência fixa M3 (`retry_skipped_quota` > `not_found` > `version_hint` > `no_artist_ambiguous`), mais M1 (`confident` ⟹ motivo `null`)
- [X] T028 [P] [US2] Criar `tests/integration/review-research-line.spec.ts` (MSW) para **FR-019**: corrigir o texto de uma linha na revisão refaz a busca **apenas daquela linha** — as demais mantêm candidatas e escolhas intactas —, e no provedor com cota a nova busca debita exatamente uma operação no consumo do dia

### Domínio de US2

- [X] T029 [US2] **Portão de calibração**: acrescentar `soloMargin` a `thresholds` em `src/domain/providers.ts` e `src/domain/scoring/thresholds.ts` (sementes 0,10 Spotify / 0,12 YouTube) e calibrar contra `reference-titles-30.json` até SC-004 (zero seleções automáticas erradas) e SC-010 (≥ 60% automático **no catálogo musical**) fecharem juntos — registrar o valor final e a medição em [research §5](./research.md)
- [X] T030 [US2] Criar `tests/unit/reference-shapes.spec.ts` medindo os critérios comparativos contra `reference-shapes.json`: **SC-002** (acerto automático sem separador fica ≤ 5 pontos percentuais abaixo do formato explícito), **SC-003** (≥ 90% das faixas só-título têm a gravação pretendida entre as candidatas) e **SC-006** (100% de equivalência entre a forma acentuada/capitalizada e a sem acento em caixa baixa) — depende de T029, porque as três medidas dependem da calibração fixada
- [X] T031 [US2] Implementar `classifyLine` em `src/domain/scoring/index.ts` com as seis regras de [contracts/domain-api.md §3](./contracts/domain-api.md), incluindo o rebaixamento por indício de versão nos **dois** ramos (regra 5), e mantendo `classifyFor` e `classify` exportadas e inalteradas — depende de T029
- [X] T032 [US2] Substituir `classifyFor` por `classifyLine` em `src/services/providers/searchRunner.ts` e passar a gravar `attentionReason` no `MatchItem` — depende de T031

### Interface de US2

- [X] T033 [P] [US2] Acrescentar os textos dos quatro motivos de atenção a `src/i18n/pt-BR.ts` (FR-017), distinguindo "não encontrada" de "não tentei de novo — reserva de cota esgotada"
- [X] T034 [US2] Exibir o motivo de atenção em `src/features/review/MatchRow.tsx`, anunciado a leitor de tela e não apenas por cor ou ícone — depende de T033
- [X] T035 [US2] Permitir completar/corrigir o texto de uma linha e **refazer a busca apenas daquela linha** em `src/features/review/LineEditor.tsx` (FR-019). **Dependência entre stories**: o débito no consumo do dia exige a contabilidade de T047/T048 (US4). Enquanto US4 não estiver pronta, a rebusca funciona e registra o custo pelo caminho de consumo já existente da 002; a reconciliação com a reserva entra em T049 — depende de T028
- [X] T036 [P] [US2] Estender `tests/a11y/` para a revisão com lista de títulos isolados: motivo anunciado, foco visível, zero violação séria ou crítica

**Checkpoint**: US1 e US2 funcionam de forma independente. Os cenários 3 e 4 do [quickstart](./quickstart.md) passam.

---

## Phase 5: User Story 3 — Formato explícito não perde precisão (Priority: P3)

**Goal**: quem escreve `música - artista` continua tendo o melhor resultado, e o falso corte deixa de condenar a linha.

**Independent Test**: rodar a lista de referência no formato explícito e comparar a taxa de acerto automático antes e depois — nenhuma linha pode mudar de classe.

### Testes para US3

- [X] T037 [P] [US3] Confirmar que `tests/unit/scoring-reference.spec.ts` e `tests/unit/scoring-youtube-reference.spec.ts` passam **sem alteração de fixture nem de asserção** (SC-005, SC-011) — se falharem, `scoreForShape` está alcançando a via explícita indevidamente
- [X] T038 [P] [US3] Acrescentar a `tests/unit/scoring-combined.spec.ts` os casos de reparo de falso corte de research §7: `Marília Mendonça - Ao Vivo` recuperada pela comparação combinada, e uma linha explícita **acima** do piso que **não** é reavaliada
- [X] T039 [P] [US3] Criar `tests/integration/search-retry.spec.ts` (MSW): no Spotify, a consulta por campos sem resultado utilizável dispara exatamente **uma** retentativa em texto livre; nunca uma segunda
- [X] T040 [P] [US3] Criar `tests/unit/throughput-retry.spec.ts` medindo a vazão no cenário em que uma fração das linhas exige segunda tentativa, para cobrir a cláusula de **SC-009** que `throughput.spec.ts` não exercita. A suíte original permanece **intocada** — são duas garantias distintas convivendo, não uma substituindo a outra

### Implementação de US3

- [X] T041 [US3] Acrescentar o reparo de falso corte a `scoreForShape` em `src/domain/scoring/index.ts`: linha `explicit` abaixo do piso `uncertain` é reavaliada por `scoreCombined`, prevalecendo a maior das duas ([research §7](./research.md)) — depende de T019
- [X] T042 [US3] Acrescentar `retryLine` a `ProviderSearchDeps` e orquestrar a retentativa em `src/services/providers/searchRunner.ts`: só quando a linha é elegível (T009) **e** nenhuma candidata passou do piso — depende de T009, T022 ([contracts/search-queries.md §3](./contracts/search-queries.md))
- [X] T043 [US3] Ligar o fallback já existente de `searchTrack` em `src/services/providers/spotify/search.ts` ao caminho de retentativa do runner, para que ele passe a ser contabilizado em vez de invisível — depende de T042

**Checkpoint**: as três user stories funcionam. O cenário 5 do [quickstart](./quickstart.md) passa, e o cenário 6 prova a não regressão.

---

## Phase 6: User Story 4 — Custo e esforço conhecidos de antemão (Priority: P4)

**Goal**: a estimativa conta a retentativa, o consumo real nunca a excede, e o usuário sabe quantas linhas exigirão clique antes de começar.

**Independent Test**: preparar lista majoritariamente sem artista, conferir o aviso antes de iniciar, e verificar ao final que o consumo real ficou dentro da estimativa.

### Testes para US4

- [X] T044 [P] [US4] Estender `tests/unit/quota.spec.ts`: `nominalCost` com `retryReserve` omitido reproduz **exatamente** os valores atuais (compatibilidade), e com `R > 0` acrescenta `100·R`; `maxLinesThatFit` continua sem laço (reduzir para o número exibido não pode rebloquear)
- [X] T045 [P] [US4] Criar `tests/integration/youtube-retry-budget.spec.ts`: forçar cenário em que **todas** as linhas retentariam e asserir que o número de chamadas de busca é exatamente `N + retryReserve`, nunca mais (invariante O4, SC-007)
- [X] T046 [P] [US4] Acrescentar a `tests/integration/youtube-retry-budget.spec.ts` a asserção de que a linha barrada pelo teto recebe `attentionReason: 'retry_skipped_quota'` e **não** `not_found` puro (M2)

### Domínio e execução de US4

- [X] T047 [US4] Acrescentar o parâmetro `retryReserve` a `nominalCost`, `costWithMargin`, `maxLinesThatFit` e `estimateQuota` em `src/domain/quota/index.ts`, atualizando o comentário de `src/domain/quota/index.ts:62` que hoje declara o fallback fora da conta ([research §8](./research.md))
- [X] T048 [US4] Calcular `retryReserve` por `retryReserveFor` no ponto onde a estimativa é montada e persistir `ServiceRun.retriesUsed` no rascunho, para que a retomada não gaste a reserva duas vezes — depende de T009, T047
- [X] T049 [US4] Aplicar o teto em `src/services/providers/searchRunner.ts`: decremento sequencialmente consistente do orçamento, sem que a decisão em paralelo estoure o limite. Reconciliar aqui o débito da rebusca por linha de T035, para que ela consuma da mesma reserva — depende de T035, T042, T048

### Interface de US4

- [X] T050 [P] [US4] Exibir a reserva de retentativa na tela de estimativa em `src/features/quota/`, no contexto do provedor que tem cota (seção "Assimetria entre provedores" da constituição)
- [X] T051 [US4] Exibir, antes de iniciar a busca, quantas linhas provavelmente exigirão escolha manual, em `src/features/input/InputScreen.tsx` (US4/AC1) — depende de T025
- [X] T052 [P] [US4] Acrescentar os textos de reserva e de previsão de esforço a `src/i18n/pt-BR.ts`

**Checkpoint**: as quatro user stories estão completas e independentes. O cenário 7 do [quickstart](./quickstart.md) passa.

---

## Phase 7: Polish & Cross-Cutting

- [X] T053 [P] Criar `e2e/flexible-search.spec.ts`: colar lista sem separador, buscar, escolher manualmente entre as candidatas de um título isolado, confirmar e criar a playlist — todos os provedores mockados, nenhuma rede real
- [X] T054 [P] Estender `e2e/narrow-viewport.spec.ts` para a revisão com motivo de atenção em 375 px, sem rolagem horizontal
- [X] T055 [P] Fechar **FR-022** — as garantias herdadas sob as formas novas, hoje presumidas: estender `tests/integration/no-write-before-review.spec.ts`, `tests/unit/line-propagation.spec.ts` e `tests/unit/line-subset.spec.ts` com pelo menos uma linha na forma livre, cobrindo também os dois casos de borda associados (correção de texto propagada entre serviços e lista reduzida para o destino seguinte)
- [X] T056 [P] Atualizar `README.md`: o separador passa a ser opcional, e explicar em uma frase o que declarar o artista muda
- [X] T057 Executar os 10 cenários de [quickstart.md](./quickstart.md) e registrar o resultado em `specs/003-flexible-search/quickstart-results.md`, como foi feito na 001 e na 002. Incluir a medição manual de **SC-008** (20 títulos isolados revisados e confirmados em < 4 min), que é métrica de usabilidade e não tem verificação automatizável
- [X] T058 Portão local completo: `npm run lint && npm run typecheck && npm test && npm run test:e2e` — obrigatório antes de publicar, porque esta feature altera o fluxo de busca

---

## Dependencies & Execution Order

### Dependências entre fases

- **Setup (Phase 1)**: sem dependências. As fixtures são pré-requisito da calibração de T029 e da medição de T030.
- **Foundational (Phase 2)**: depende do Setup. **Bloqueia todas as user stories** — `shape` não existe antes de T004/T007.
- **US1 (Phase 3)**: depende da Foundational. Independente das demais.
- **US2 (Phase 4)**: depende da Foundational. Usa a pontuação de US1 (T018) para decidir a margem sobre candidatas reais.
- **US3 (Phase 5)**: depende da Foundational e de T019 (US1) para acrescentar o reparo a `scoreForShape`.
- **US4 (Phase 6)**: depende da Foundational (T009), de T042 (US3) para ter o que limitar, e de T035 (US2) para reconciliar o débito da rebusca por linha.
- **Polish (Phase 7)**: depende das user stories desejadas.

### Dentro de cada user story

- Testes primeiro, falhando, antes da implementação. **Exceção justificada**: T030 mede critérios comparativos que só existem depois da calibração, então vem logo após T029 em vez de antes.
- Domínio puro antes de serviço; serviço antes de interface.
- Em US2, o portão de calibração (T029) antes de qualquer tarefa de interface.

### Oportunidades de paralelismo

- **Phase 1**: T001, T002, T003 são três arquivos distintos — tudo em paralelo.
- **Phase 2**: T005+T006 (normalize) e T009+T010 (retry) são independentes entre si; T007 e T011 dependem de T004.
- **US1**: T013–T017 em paralelo (cinco arquivos de teste); T020 e T021 em paralelo (dois adaptadores).
- **US2**: T026, T027, T028 em paralelo; T033 e T036 em paralelo com o domínio.
- **US3**: T037–T040 em paralelo (quatro suítes distintas).
- **US4**: T044, T045, T046 em paralelo; T050 e T052 em paralelo com o domínio.
- **Phase 7**: T053, T054, T055, T056 em paralelo.

### Cadeia crítica

`T004 → T007 → T018/T019 → T022 → T029 → T031 → T032 → T042 → T048 → T049 → T058`

É a sequência que não admite paralelismo. Tudo o mais pende dela.

---

## Parallel Example: User Story 1

```bash
# Os cinco testes de US1, juntos:
Task: "tests/unit/scoring-combined.spec.ts — tabela de cobertura combinada"
Task: "tests/unit/scoring-combined.spec.ts — casos de artistClaimed"
Task: "tests/integration/search-free-shape.spec.ts — lista sem separador"
Task: "tests/integration/search-free-shape.spec.ts — FR-018, 5 candidatas"
Task: "tests/unit/dedupe.spec.ts — chave unificada"

# Os dois adaptadores, juntos:
Task: "src/services/providers/spotify/search.ts — consulta por shape"
Task: "src/services/providers/youtube/search.ts — consulta por shape"
```

---

## Implementation Strategy

### MVP (US1 apenas)

1. Phase 1: Setup — fixtures.
2. Phase 2: Foundational — forma declarada, primitivas, migração.
3. Phase 3: US1.
4. **PARAR E VALIDAR**: cenários 1 e 2 do quickstart. Uma lista inteiramente sem separador vira playlist — que é a metade do pedido original já entregue.

### Entrega incremental

1. Setup + Foundational → base pronta.
2. US1 → validar → o separador deixou de ser obrigatório (MVP).
3. US2 → validar → título isolado com escolha assistida. **Antes da interface, resolver T029.**
4. US3 → validar → precisão do formato explícito preservada e falso corte recuperado.
5. US4 → validar → custo e esforço visíveis, consumo dentro da estimativa.

### Ordem recomendada se houver dúvida sobre a calibração

Adiantar T029 e T030 para logo após T018, ainda dentro de US1. O valor de `soloMargin` decide se `classifyLine` terá a regra de margem ou não, e essa resposta muda o escopo de US2 inteira. Custa pouco antecipar e evita retrabalho de interface. Se optar por isso, ignore a posição de T029/T030 no corpo do documento — a dependência real é apenas T001/T002 (fixtures) e T018 (pontuação).

---

## Notes

- `[P]` = arquivo diferente, sem dependência pendente.
- As três suítes intocáveis estão listadas no topo deste documento. Quebrou uma delas, a implementação saiu do contrato — não edite o teste.
- **T022 é a tarefa mais fácil de errar**: a guarda de `unparsed` no runner permanece. O que muda é o significado de `unparsed`, não a existência da guarda. Removê-la faz o sistema gastar cota com linhas de lixo (FR-011).
- `git commit` a cada tarefa ou grupo lógico coerente.
- Nenhum teste toca a rede real: integração usa MSW, ponta a ponta usa Playwright com provedores mockados (Princípio IV).
- Nenhuma dependência nova em nenhuma tarefa. Precisou de uma, pare e justifique por escrito contra a alternativa de escrever à mão (Princípio: Simplicidade proporcional).
- Todo teste que existe para garantir um requisito deve citá-lo (`FR-xxx`, `SC-xxx`) em nome ou comentário — prática já estabelecida no projeto.
