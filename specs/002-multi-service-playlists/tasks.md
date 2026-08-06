---
description: 'Lista de tarefas — Destinos Múltiplos (Spotify e YouTube)'
---

# Tasks: Destinos Múltiplos — Spotify e YouTube

**Input**: Documentos de desenho em `/specs/002-multi-service-playlists/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: **Obrigatórios.** O Princípio IV da constituição é explícito — "toda regra desta constituição e todo requisito funcional com consequência observável MUST ter verificação executável". Tarefas de teste não são opcionais neste projeto.

**Organization**: agrupadas por user story, para que cada uma seja implementável e testável de forma independente.

## Format: `[ID] [P?] [Story] Descrição`

- **[P]**: pode rodar em paralelo (arquivo diferente, sem dependência pendente)
- **[Story]**: US1, US2, US3, US4 — só nas fases de user story
- Todo caminho de arquivo é relativo à raiz do repositório

## Path Conventions

Projeto único na raiz: `src/`, `tests/`, `e2e/`. Sem backend (Princípio I).

---

## Phase 1: Setup (Infraestrutura Compartilhada)

**Purpose**: preparar a superfície de rede e as fixtures antes de qualquer código de provedor.

- [X] T001 Atualizar a CSP de produção em `vite.config.ts`: `img-src` + `https://i.ytimg.com`, `connect-src` + `https://www.googleapis.com`, `form-action` + `https://accounts.google.com`. `accounts.google.com` **não** entra em `connect-src` — a autorização é navegação, não `fetch` ([research §14](./research.md))
- [X] T002 [P] Criar `tests/fixtures/reference-50-youtube.json` com as mesmas 50 faixas de `reference-50.json`, cada uma com até 5 candidatas de vídeo (id, título com decorações reais, canal, duração ISO-8601) e o `videoId` esperado — é a fixture que valida SC-006
- [X] T003 [P] Estender `tests/msw/handlers.ts` com os cinco endpoints do YouTube (`search`, `videos`, `playlists`, `playlistItems`, `channels`) conforme [contracts/youtube-api.md](./contracts/youtube-api.md), incluindo respostas de erro `403` com `error.errors[0].reason` distintos

---

## Phase 2: Foundational (Pré-requisitos Bloqueantes)

**Purpose**: generalizar o núcleo de um provedor para dois. Nada de user story pode começar antes.

**⚠️ CRÍTICO**: esta fase reescreve as fronteiras de I/O e de armazenamento. O Spotify deve continuar funcionando exatamente como antes ao final dela — é o critério de aceitação da fase.

### Domínio e tipos

- [X] T004 Criar `src/domain/providers.ts` com `ProviderId`, `PROVIDER_ORDER` (`['spotify','youtube']`), `QuotaModel`, `ProviderCapabilities` e `capabilitiesOf()`, conforme [data-model §1](./data-model.md)
- [X] T005 Alterar `src/domain/types.ts`: `Session` → `ProviderSession` (com `provider` e `refreshToken: string | null`), `SpotifyUser` → `ProviderUser`, `AuthRequest` no lugar de `PkceRecord`, `SCHEMA_VERSION = 2`, `WizardStep` = `credential|destinations|input|service|summary`
- [X] T006 Alterar `src/domain/types.ts`: `TrackCandidateRaw` ganha `channel?` e `versionHints?`; `CreationProgress.committedBatches` → `committedItems`; `CreationResult` ganha `provider` e `incompleteByQuota` ([data-model §6, §11](./data-model.md))
- [X] T007 Alterar `src/domain/batching/index.ts` para receber `batchSize` como parâmetro e contar em itens (`remainingItems`), preservando a ordem original ([contracts/domain-api.md §6](./contracts/domain-api.md))
- [X] T008 [P] Atualizar `tests/unit/batching.spec.ts` para cobrir `batchSize` 100 e 1, e retomada a partir de `committedItems` arbitrário (SC-010)

### Superfície de rede

- [X] T009 Criar `src/services/providers/hosts.ts` movendo `src/services/spotify/hosts.ts`: `PROVIDER_HOSTS` com as duas linhas da tabela do Princípio II, `isAllowedUrl`, e construtores de URL por provedor. Apagar o módulo antigo e corrigir todos os importadores
- [X] T010 Estender `tests/unit/no-secrets.spec.ts`: comparar `PROVIDER_HOSTS` entrada a entrada (falhando por host **ausente** e por host **excedente**), ampliar a varredura de segredos para qualquer provedor, e acrescentar `www.youtube.com` e `console.cloud.google.com` à exceção de "link exibido, não destino de rede" ([research §14, §15](./research.md))

### Contrato de provedor e cliente HTTP

- [X] T011 Criar `src/services/providers/types.ts` com a interface `PlaylistProvider`, `CallbackParams`, `SearchContext`, `CreateParams` e `QuotaOperation`, conforme [contracts/provider-contract.md](./contracts/provider-contract.md)
- [X] T012 Criar `src/services/providers/http.ts` movendo `src/services/spotify/client.ts`: cliente genérico parametrizado por provedor (Bearer, 401 → renovar **ou** `reauth_required`, 429 → `Retry-After`, 5xx → backoff, `AbortSignal`), sem nenhuma referência a Spotify
- [X] T013 Alterar `src/services/spotify/errors.ts` → `src/services/providers/errors.ts`: `AppError` ganha `provider`, e as classes `reauth_required`, `quota_exhausted` e `rate_limited` entram no catálogo ([contracts/provider-contract.md §2](./contracts/provider-contract.md))
- [X] T014 Mover `src/services/spotify/{auth,search,playlists,profile,pkce,offline}.ts` para `src/services/providers/spotify/` e adaptá-los à interface `PlaylistProvider`, expondo um objeto `spotifyProvider` em `src/services/providers/spotify/index.ts`
- [X] T015 Criar `src/services/providers/registry.ts` com `PROVIDERS` e `orderedProviders()`, garantindo por construção que provedor com cota nunca precede provedor sem cota (FR-015)
- [X] T016 [P] Criar `tests/unit/provider-registry.spec.ts` verificando `PROVIDER_ORDER`, a invariante de ordenação por cota (FR-015) e as capacidades declaradas de cada provedor
- [X] T017 Alterar `src/services/rate-limiter.ts` para expor uma instância por provedor em vez de um limitador global compartilhado

### Armazenamento e migração

- [X] T018 Alterar `src/services/storage/schema.ts`: `STORAGE_KEYS` passa a ser função de `ProviderId` para credencial, sessão e registro de autorização; acrescentar as chaves `tp.v2.draft` e `tp.v2.quota.{provider}` ([contracts/storage.md §1](./contracts/storage.md))
- [X] T019 [P] Alterar `src/services/storage/credentialRepo.ts` para receber `ProviderId` em todas as operações, garantindo que remover uma credencial não alcança a chave de outro provedor (FR-006)
- [X] T020 [P] Alterar `src/services/storage/sessionRepo.ts` para receber `ProviderId` e aceitar `refreshToken: null`; `isExpired` continua valendo para os dois provedores
- [X] T021 [P] Substituir `src/services/storage/pkceRepo.ts` por `src/services/storage/authRequestRepo.ts`, guardando `{ state, codeVerifier? }` por provedor em `sessionStorage`
- [X] T022 Criar `src/services/storage/quotaRepo.ts` com leitura e gravação de `DailyConsumption` por provedor, tolerante a registro ausente ou corrompido (tratado como zero)
- [X] T023 Alterar `src/services/storage/draftRepo.ts` para serializar e validar `WorkDraft` v2 — `lines`, `destinations`, `queue.runs` — mantendo a serialização campo a campo que impede token e Client ID de vazarem (invariante 2 de [contracts/storage.md](./contracts/storage.md))
- [X] T024 Estender a degradação por cota de armazenamento em `draftRepo.ts` para três passos: sem alternativas → sem alternativas das execuções concluídas → `failed` ([contracts/storage.md §5](./contracts/storage.md))
- [X] T025 Criar `src/services/storage/migrations.ts` com a migração v1 → v2 completa (credencial, sessão, PKCE e rascunho), removendo a chave v1 **apenas** após gravação bem-sucedida da v2 ([contracts/storage.md §4](./contracts/storage.md), FR-042)
- [X] T026 Alterar `src/app/bootstrap.ts` para executar a migração antes de qualquer restauração de estado
- [X] T027 [P] Criar `tests/unit/storage-migration.spec.ts` cobrindo: rascunho v1 vira fluxo Spotify de destino único na etapa gravada, `committedBatches × 100 = committedItems`, chave v1 preservada em falha de gravação, e rascunho v1 ilegível descartado com aviso (FR-042)
- [X] T028 [P] Atualizar `tests/unit/storage.spec.ts` para as chaves por provedor e o isolamento entre elas (FR-006)

### Estado

- [X] T029 Alterar `src/store/credentialSlice.ts` para `Record<ProviderId, Credential | null>`, com `setCredential(provider, clientId)` e `removeCredential(provider)`
- [X] T030 Alterar `src/store/sessionSlice.ts` para `Record<ProviderId, ProviderSession | null>`, com desconexão por provedor sem afetar os demais (FR-036)
- [X] T031 Alterar `src/store/types.ts` e `src/store/index.ts` para compor os slices novos e refletir o `AppState` multi-provedor

**Checkpoint**: o fluxo Spotify da 001 deve passar em `npm run lint && npm run typecheck && npm test && npm run test:e2e` sem nenhuma mudança de comportamento observável.

---

## Phase 3: User Story 1 — Credenciais opcionais e seletor de destinos (Priority: P1) 🎯 MVP

**Goal**: cada serviço tem seu campo de credencial, nenhum obrigatório isoladamente, e o usuário escolhe para onde a playlist vai — com o motivo escrito quando um destino não está disponível.

**Independent Test**: cadastrar apenas o Client ID do YouTube e verificar que o seletor habilita YouTube e mantém Spotify desabilitado com motivo visível; cadastrar o do Spotify e verificar que ambos vêm marcados; remover um e verificar que ele volta a desabilitado sem afetar o outro.

### Testes para US1

- [X] T032 [P] [US1] Criar `tests/unit/validation-destinations.spec.ts` para `validateAtLeastOneCredential` e `validateSelection`, incluindo o caso de zero credenciais e o de zero destinos (FR-002, FR-011)
- [X] T033 [P] [US1] Criar `tests/components/destinations.spec.tsx`: padrão marcado = exatamente os provedores com credencial (SC-003), desabilitado com motivo e atalho (SC-002), avanço bloqueado com zero seleção (FR-011), e remoção de credencial que desmarca só aquele destino (FR-006)
- [X] T034 [P] [US1] Estender `tests/components/credential-form.spec.tsx` para dois formulários independentes, mascaramento por provedor e presença do aviso de amplitude de escopo no YouTube (FR-003, FR-045)

### Implementação de US1

- [X] T035 [P] [US1] Criar `src/domain/run/selection.ts` com `DestinationSelection`, inicialização a partir das credenciais cadastradas (FR-010) e a trava pós-criação (FR-012)
- [X] T036 [P] [US1] Acrescentar a `src/domain/validation/index.ts` as funções `validateAtLeastOneCredential` e `validateSelection`, com as razões `no_credential`, `no_destination` e `selection_locked` ([contracts/domain-api.md §7](./contracts/domain-api.md))
- [X] T037 [US1] Criar `src/store/destinationsSlice.ts` com seleção, alternância, trava e reação à remoção de credencial (FR-006, FR-012)
- [X] T038 [US1] Alterar `src/features/credential/CredentialStep.tsx` para renderizar um `CredentialForm` por provedor, cada um com suas instruções, seu Redirect URI copiável e o aviso de escopo quando aplicável (FR-001, FR-005, FR-045)
- [X] T039 [P] [US1] Alterar `src/features/credential/redirectUri.ts` para expor também a **origem** JavaScript autorizada, exigida pelo cadastro do YouTube ([quickstart §1](./quickstart.md))
- [X] T040 [US1] Criar `src/features/destinations/DestinationSelector.tsx`: caixas por provedor, estado desabilitado com motivo escrito e atalho para cadastrar a credencial (FR-008, FR-009)
- [X] T041 [US1] Criar `src/features/destinations/DestinationsStep.tsx` com a validação de avanço e a mensagem de bloqueio (FR-011)
- [X] T042 [US1] Alterar `src/app/Wizard.tsx` e `src/app/StepIndicator.tsx` para incluir a etapa `destinations` entre `credential` e `input` (FR-043)
- [X] T043 [US1] Acrescentar a `src/i18n/pt-BR.ts` os textos de credencial por serviço, instruções do YouTube, aviso de amplitude do escopo, rótulos do seletor e motivos de bloqueio
- [X] T044 [US1] Persistir `destinations` no rascunho e restaurá-lo em `src/store/restoreDraft.ts` (FR-037)
- [X] T045 [P] [US1] Estender `tests/a11y/steps.spec.tsx` com a etapa de destinos: operável por teclado, rótulos associados, motivo anunciado a leitor de tela (FR-047)

**Checkpoint**: US1 funciona sozinha. O fluxo Spotify da 001 continua completo, agora com o destino visível e confirmado.

---

## Phase 4: User Story 2 — Criar a playlist no YouTube (Priority: P2)

**Goal**: com apenas o YouTube selecionado, o fluxo inteiro funciona — busca no catálogo de vídeos, revisão com canal e duração, sinalização de versão diferente, criação e resultado.

**Independent Test**: com apenas YouTube selecionado, executar o fluxo com 50 linhas e verificar a playlist criada na conta, com ordem preservada e o consumo de cota informado antes de começar.

### Testes para US2

- [X] T046 [P] [US2] Criar `tests/unit/version-hints.spec.ts`: léxico com fronteira de palavra ("Livermore" não é `live`), insensível a acento e caixa, `stripDecorations` idempotente, e desvio de 25% da mediana (FR-025)
- [X] T047 [P] [US2] Criar `tests/unit/quota.spec.ts` para `nominalCost`, `estimateQuota` e `maxLinesThatFit`, com a fórmula de [research §3](./research.md) e a monotonia em `lineCount` (FR-029)
- [X] T048 [P] [US2] Criar `tests/unit/scoring-youtube-reference.spec.ts` medindo ≥ 75% de `Confiante` correta contra `reference-50-youtube.json` (SC-006)
- [X] T049 [P] [US2] Criar `tests/integration/youtube-auth.spec.ts`: `state` divergente recusa o token, fragmento limpo após a leitura, `refreshToken: null`, e `#error=access_denied` falha só aquele destino ([contracts/youtube-api.md §2](./contracts/youtube-api.md))
- [X] T050 [P] [US2] Criar `tests/integration/youtube-search.spec.ts`: consulta livre com fallback único, decodificação de entidades HTML do título, enriquecimento em lotes de 50 e limite de 5 candidatas ([contracts/youtube-api.md §3, §4](./contracts/youtube-api.md))
- [X] T113 [P] [US2] Criar `tests/integration/youtube-playlists.spec.ts`: `playlists.insert` envia `status.privacyStatus: 'private'` por padrão (FR-026), `playlists.list` pagina por `nextPageToken` até o fim (FR-022), e `playlistItems.insert` envia **um** vídeo por requisição sem `snippet.position` ([contracts/youtube-api.md §7](./contracts/youtube-api.md))
- [X] T114 [P] [US2] Criar `tests/components/result-youtube.spec.tsx`: o resultado do YouTube declara que a playlist criada é uma playlist do YouTube e nunca do YouTube Music (FR-028), exibe o caminho efetivo daquele provedor e o aviso de que a aplicação não gerencia pastas (FR-027)
- [X] T051 [P] [US2] Estender `tests/components/review.spec.tsx`: canal e duração exibidos, **nenhum** campo de álbum quando `showsAlbum` é falso, e indício de versão visível rebaixando o item para `Incerta` (FR-024, FR-025)

### Domínio de US2

- [X] T052 [P] [US2] Criar `src/domain/quota/index.ts` com `providerDay` (via `Intl` e `now` injetado), `consumptionToday`, `nominalCost`, `estimateQuota`, `maxLinesThatFit` e `addConsumption` ([contracts/domain-api.md §2](./contracts/domain-api.md), FR-029, FR-030)
- [X] T053 [P] [US2] Criar `src/domain/versionHints/index.ts` com `stripDecorations`, `lexicalHints`, `durationHint` e `versionHints` ([research §8](./research.md), FR-025)
- [X] T054 [US2] Alterar `src/domain/scoring/thresholds.ts` para limiares por provedor (Spotify 0,82 · YouTube 0,88) e acrescentar `CHANNEL_TOPIC_BONUS` e `CHANNEL_VEVO_BONUS` ([research §7](./research.md), FR-023)
- [X] T055 [US2] Acrescentar a `src/domain/scoring/index.ts` as funções `channelBonus` e `classifyFor`, esta última rebaixando para `uncertain` sempre que houver indício de versão (FR-023, FR-025)

### Adaptador YouTube

- [X] T056 [P] [US2] Criar `src/services/providers/youtube/auth.ts`: monta a URL do implicit flow com `state`, lê o fragmento no retorno, limpa o histórico com `history.replaceState` e devolve `ProviderSession` com `refreshToken: null` ([contracts/youtube-api.md §2](./contracts/youtube-api.md), FR-035)
- [X] T057 [P] [US2] Criar `src/services/providers/youtube/errors.ts` mapeando `403` por `error.errors[0].reason` para `quota_exhausted`, `rate_limited` e erro de permissão, e `401` para `reauth_required` ([contracts/youtube-api.md §8](./contracts/youtube-api.md))
- [X] T058 [US2] Criar `src/services/providers/youtube/search.ts`: consulta livre, fallback único, decodificação de entidades HTML e mapeamento para `TrackCandidateRaw` com `channel`
- [X] T059 [US2] Criar `src/services/providers/youtube/videos.ts`: enriquecimento por `videos.list` em lotes de 50 e conversão de duração ISO-8601 para milissegundos ([contracts/youtube-api.md §4](./contracts/youtube-api.md), FR-024)
- [X] T060 [US2] Criar `src/services/providers/youtube/playlists.ts` com `listPlaylistNames` (paginado), `createPlaylist` (`privacyStatus` privado por padrão), `addItems` (um vídeo por requisição, sem `position`) e `effectivePath` (FR-022, FR-026, FR-027)
- [X] T061 [US2] Criar `src/services/providers/youtube/quota.ts` registrando consumo após cada resposta, de forma síncrona, com virada de dia no fuso do provedor ([research §5](./research.md), FR-030)
- [X] T062 [US2] Criar `src/services/providers/youtube/index.ts` compondo o `youtubeProvider` com as capacidades declaradas em [contracts/provider-contract.md §5](./contracts/provider-contract.md), e registrá-lo em `registry.ts`

### Interface de US2

- [X] T063 [US2] Alterar `src/features/review/MatchRow.tsx` e `src/features/review/Alternatives.tsx` para exibir canal e duração quando `showsAlbum` for falso, nunca prometendo álbum (FR-024)
- [X] T064 [P] [US2] Criar `src/ui/VersionHintBadge.tsx` para o marcador visível de versão diferente, com rótulo acessível (FR-025)
- [X] T065 [US2] Criar `src/features/quota/QuotaEstimateScreen.tsx` exibindo consumo previsto e fração do orçamento **antes** de qualquer requisição de busca (FR-029, SC-011)
- [X] T066 [US2] Alterar `src/features/input/matchRunner.ts` para receber o provedor, disparar o enriquecimento e aplicar `classifyFor` com os limiares e indícios daquele catálogo
- [X] T067 [US2] Alterar `src/features/result/creationRunner.ts` e `src/features/result/effectivePath.ts` para usar o provedor da execução, com `batchSize` e caminho efetivo próprios (FR-027)
- [X] T068 [US2] Alterar `src/features/result/ResultScreen.tsx` e `src/features/result/FolderNotice.tsx` para o aviso de pastas por provedor e a declaração de que a playlist é do YouTube, não do YouTube Music (FR-027, FR-028)
- [X] T069 [US2] Acrescentar a `src/i18n/pt-BR.ts` os textos de estimativa de cota, bloqueio por saldo insuficiente, indícios de versão, canal/duração, caminho efetivo do YouTube e erros do provedor de vídeo (FR-046)

### Bloqueio por cota — completa FR-029 dentro de US2

- [X] T094 [US2] Alterar `src/features/quota/QuotaEstimateScreen.tsx` para bloquear o destino quando a estimativa exceder o saldo, com exatamente duas ações — reduzir a lista (informando quantas linhas cabem) e pular o destino — mais a declaração de que o cálculo parte do orçamento padrão e que ampliar a cota junto ao provedor não altera esse cálculo (FR-029, FR-034, SC-008)
- [X] T115 [P] [US2] Criar `src/domain/run/lines.ts` com `isSubsetOf` e o teste `tests/unit/line-subset.spec.ts`, recusando acréscimo, alteração e reordenação (FR-013)
- [X] T116 [US2] Criar `src/features/input/ListReduction.tsx` — lista em modo somente remoção, validada por `isSubsetOf`, apresentando lista vazia como "pular destino" (FR-013)
- [X] T095 [US2] Ligar a saída "reduzir a lista" de T094 ao `ListReduction` de T116, aplicando o ajuste **antes** da busca daquele destino (FR-013, FR-029)
- [X] T096 [US2] Garantir que nenhuma requisição de busca seja emitida quando `blocked` for verdadeiro, verificado por handler MSW que falha o teste se tocado (SC-008, SC-011)

**Checkpoint**: um usuário que só tem YouTube conclui o fluxo inteiro, **incluindo o bloqueio quando a lista não cabe no orçamento** — FR-029 completo. US1 continua funcionando.

---

## Phase 5: User Story 3 — Criar nos dois serviços, um depois do outro (Priority: P3)

**Goal**: com os dois destinos, o sistema executa o ciclo completo de um serviço por vez, indicando sempre onde está, e termina com um resumo consolidado.

**Independent Test**: selecionar os dois destinos, executar com a mesma lista e verificar duas playlists — uma em cada conta — com ordem preservada, mais um resumo final por serviço.

### Testes para US3

- [X] T070 [P] [US3] Criar `tests/unit/run-machine.spec.ts`: no máximo uma execução ativa (Q1), próximo só após `outcome` do anterior (Q2), `reduceRun` como identidade sobre execução concluída (R2), **nenhuma transição alcança `creating` sem o evento `review_confirmed` daquele serviço (FR-019, Princípio V)**, e desfechos de FR-040 sem limiar percentual
- [X] T071 [P] [US3] Criar `tests/unit/summary.spec.ts` para `buildSummary`: `listsDiverged` quando os tamanhos divergem, contagens por serviço e linhas removidas (FR-040, SC-018)
- [ ] T072 [P] [US3] Criar `e2e/multi-destination.spec.ts` com ambos os provedores mockados: duas playlists, ordem preservada, indicador de fila visível, nenhuma requisição ao segundo provedor antes do ciclo dele (SC-004, SC-005, SC-012)
- [X] T109 [P] [US3] Criar `tests/integration/no-write-before-review.spec.ts`: handlers MSW de escrita — `POST /v1/users/:id/playlists`, `POST /v1/playlists/:id/tracks`, `POST /youtube/v3/playlists`, `POST /youtube/v3/playlistItems` — falham o teste se tocados antes da confirmação da revisão **daquele** serviço; cobre os dois provedores e o caso de dois destinos, onde confirmar o primeiro não pode liberar escrita no segundo (FR-019, Princípio V)
- [X] T110 [P] [US3] Estender `tests/integration/draft-recovery.spec.ts`: recarga no meio do ciclo do segundo serviço, com o primeiro já concluído, preserva texto, nome, seleção de destinos, itens revisados do serviço corrente e o `result` congelado do serviço concluído; a retomada volta ao serviço e à etapa exatos (SC-014, FR-037, FR-039)
- [X] T111 [P] [US3] Criar `tests/unit/line-propagation.spec.ts`: `applyTextCorrection` altera `title`, `artist` e `featuredArtists` na fonte única sem tocar `raw`, `id` nem `index`; a linha corrigida é a que alimenta a busca do serviço seguinte; e escolha de candidata, inclusão e exclusão permanecem confinadas à `ServiceRun` de origem (FR-014, SC-013)
- [ ] T112 [P] [US3] Estender `e2e/multi-destination.spec.ts` com três cenários: pular o segundo serviço mantendo a playlist do primeiro intacta e reportada (FR-020); desconectar um provedor sem afetar a sessão nem o resultado do outro (FR-036); copiar em bloco as linhas não encontradas de cada serviço separadamente (FR-041)

### Domínio de US3

- [X] T073 [US3] Criar `src/domain/run/queue.ts` com `ExecutionQueue`, `buildQueue`, `advanceQueue` e o congelamento de `frozenLines` na conclusão ([contracts/domain-api.md §5](./contracts/domain-api.md), FR-037)
- [X] T074 [US3] Criar `src/domain/run/machine.ts` com `RunEvent`, `reduceRun` e `outcomeOf`, aplicando os critérios de FR-040 e o isolamento entre execuções (FR-021)
- [X] T075 [P] [US3] Acrescentar `applyTextCorrection` a `src/domain/run/lines.ts` — altera `title`, `artist` e `featuredArtists`, nunca `raw`, `id` nem `index` (FR-014)
- [X] T076 [P] [US3] Criar `src/domain/run/summary.ts` com `buildSummary` e `ConsolidatedSummary` ([data-model §13](./data-model.md), FR-040)

### Orquestração e interface de US3

- [X] T077 [US3] Criar `src/store/runSlice.ts` com a fila, a execução corrente, os eventos do ciclo e a leitura derivada do resumo
- [X] T078 [US3] Alterar `src/app/Wizard.tsx` para as etapas `service` (ciclo por provedor) e `summary`, com o ciclo `connect → estimate? → search → review → creating → result` ([research §12](./research.md), FR-016, FR-043)
- [X] T079 [US3] Criar `src/features/queue/QueueIndicator.tsx` exibindo "Spotify — 1 de 2" em todas as telas do ciclo, e **nada** quando houver um único destino (FR-018)
- [X] T080 [US3] Alterar `src/features/connect/ConnectButton.tsx` e `src/features/connect/callback.ts` para autorizar apenas o provedor cujo ciclo começou, roteando o retorno por query (Spotify) ou fragmento (YouTube) (FR-017, SC-005)
- [X] T081 [US3] Alterar `src/features/review/nameCheck.ts` para resolver o nome duplicado **localmente a cada serviço**, sem invalidar o que já foi criado (FR-022)
- [X] T082 [US3] Propagar correções de texto da revisão para a fonte única de linhas, sem transferir escolha de candidata, seleção ou exclusão (FR-014, SC-013)
- [X] T083 [US3] Acrescentar ao `ListReduction` de T116 o segundo ponto de entrada — a partir do resultado do serviço anterior —, aplicando o ajuste antes da busca do destino seguinte (FR-013)
- [X] T084 [US3] Criar `src/features/summary/SummaryScreen.tsx` com estado, link, conta, totais e não encontradas por serviço, declarando a divergência de listas quando houver (FR-040, FR-041, SC-018)
- [X] T085 [US3] Alterar `src/features/connect/SessionHeader.tsx` para exibir a conta conectada de cada provedor e permitir desconectar de um sem afetar o outro (FR-036)
- [X] T086 [US3] Permitir pular ou encerrar um serviço pendente sem desfazer nem ocultar o que já foi criado em outro (FR-020)
- [X] T087 [US3] Persistir `queue` no rascunho e retomar no serviço e na etapa exatos em `src/store/restoreDraft.ts` e `src/store/draftPersistence.ts` (FR-037, FR-039, SC-014)
- [X] T088 [US3] Acrescentar a `src/i18n/pt-BR.ts` os textos de fila, resumo consolidado, divergência de listas, ajuste de lista e encerramento de serviço
- [X] T089 [P] [US3] Estender `tests/a11y/steps.spec.tsx` com a indicação de fila, o ajuste de lista e o resumo consolidado (FR-047)

**Checkpoint**: o cenário completo pedido funciona. US1 e US2 seguem independentes.

---

## Phase 6: User Story 4 — Cota e expiração (Priority: P4)

**Goal**: o esgotamento de cota durante a execução encerra com relato preciso e sem repetição em laço, e a expiração da autorização nunca custa trabalho revisado. O bloqueio prévio (FR-029) foi entregue em US2, junto da tela que ele completa.

**Independent Test**: forçar `quotaExceeded` no meio da adição e verificar encerramento em uma única mensagem, com a playlist incompleta relatada e o rascunho preservado; separadamente, simular expiração durante a revisão e verificar que nenhuma decisão é perdida.

### Testes para US4

- [X] T090 [P] [US4] Criar `tests/integration/youtube-quota.spec.ts` contando as requisições emitidas: `quotaExceeded` encerra sem **nenhuma** repetição, `rateLimitExceeded` repete com backoff (SC-009, invariante A1 de [contracts/youtube-api.md](./contracts/youtube-api.md))
- [X] T091 [P] [US4] Estender `tests/unit/quota.spec.ts` com a virada do dia em `America/Los_Angeles` nos dois sentidos do horário de verão, e registro ausente ou corrompido tratado como zero (FR-030)
- [X] T092 [P] [US4] Estender `tests/integration/partial-failure.spec.ts` para `batchSize` 1 e para reautorização no meio da adição: retomada sem faixa duplicada nem faltante (FR-033, SC-010)
- [X] T093 [P] [US4] Criar `tests/integration/draft-after-quota.spec.ts`: encerramento por cota **preserva** o rascunho, e a reabertura oferece relato e descarte, sem retomada (FR-038)

### Implementação de US4

- [X] T097 [US4] Tratar `quota_exhausted` durante a execução: encerrar aquele serviço sem repetir em laço, com relato de quais linhas entraram e quais faltaram, e orientação sobre como ampliar o orçamento junto ao provedor (FR-031, FR-034)
- [X] T098 [US4] Marcar `incompleteByQuota` no resultado, informar que a playlist existe incompleta e advertir que repetir com o mesmo nome será bloqueado pela checagem de nome duplicado (FR-032)
- [X] T099 [US4] Implementar o caminho de reautorização em `src/features/connect/reconnect.ts`: detectar `reauth_required`, preservar o rascunho integralmente e informar de onde o trabalho será retomado (FR-035)
- [X] T100 [US4] Alterar `src/services/storage/draftRepo.ts` e o orquestrador para **preservar** o rascunho após encerramento por cota, oferecendo apenas relato e descarte explícito na reabertura (FR-038, Princípio V)
- [X] T101 [US4] Acrescentar a `src/i18n/pt-BR.ts` os textos de bloqueio por cota, esgotamento em execução, playlist incompleta e reautorização (FR-046)

**Checkpoint**: as quatro histórias estão completas e independentes.

---

## Phase 7: Polish & Cross-Cutting

- [ ] T102 [P] Estender `e2e/narrow-viewport.spec.ts` para o fluxo completo com dois destinos em 375 px, sem rolagem horizontal (SC-016)
- [ ] T103 [P] Estender `e2e/keyboard.spec.ts` para as telas novas: destinos, fila, estimativa, ajuste de lista e resumo (FR-047)
- [X] T104 [P] Estender `tests/unit/throughput.spec.ts` para a vazão por provedor e o orçamento de tempo de SC-015 (50 linhas nos dois destinos em ≤ 2 min)
- [X] T105 [P] Atualizar `README.md`: cadastro das duas credenciais, risco registrado do implicit flow sem renovação silenciosa, e a superfície de rede por provedor (Princípio II)
- [X] T106 Remover código morto de `src/services/spotify/` e corrigir importações remanescentes; confirmar que o diretório antigo não existe mais
- [ ] T107 Executar todos os cenários de [quickstart.md](./quickstart.md) (V1 a V8) e registrar o resultado em `specs/002-multi-service-playlists/quickstart-results.md`
- [ ] T108 Rodar o portão local completo — `npm run lint && npm run typecheck && npm test && npm run test:e2e` — e corrigir o que falhar

---

## Dependencies & Execution Order

### Dependências entre fases

- **Setup (Fase 1)**: sem dependências
- **Foundational (Fase 2)**: depende do Setup — **bloqueia todas as user stories**
- **US1 (Fase 3)**: depende da Fase 2
- **US2 (Fase 4)**: depende da Fase 2. Não depende de US1 para funcionar, mas na prática é exercitada através do seletor entregue por US1
- **US3 (Fase 5)**: depende de US1 (seleção) e de US2 (o segundo provedor precisa existir para haver fila de dois)
- **US4 (Fase 6)**: depende **apenas** de US2 (adaptador, cota e sessão do YouTube). Não depende de US3 — o bloqueio prévio e o `ListReduction` foram entregues em US2, e US4 trata só do esgotamento em execução, da reautorização e do rascunho preservado
- **Polish (Fase 7)**: depende das histórias desejadas

### Dentro de cada user story

- Testes escritos primeiro e falhando antes da implementação
- Domínio puro antes dos adaptadores de serviço
- Adaptadores antes das telas
- Textos de i18n junto da tela que os usa — nenhum literal fora de `src/i18n/`

### Oportunidades de paralelismo

- Fase 1: T002 e T003 em paralelo
- Fase 2: T019, T020, T021 (repositórios distintos) · T008, T016, T027, T028 (arquivos de teste distintos)
- Fase 3: T032, T033, T034 juntos · T035, T036, T039, T045 juntos
- Fase 4: T046 a T051, T113 e T114 juntos · T052, T053, T056, T057, T064, T115 juntos
- Fase 5: T070, T071, T072 e T109 a T112 juntos · T075, T076 juntos
- Fase 6: T090 a T093 juntos
- Fase 7: T102 a T105 juntos

---

## Parallel Example: User Story 2

```bash
# Testes de US2, todos em arquivos distintos:
Task: "tests/unit/version-hints.spec.ts"
Task: "tests/unit/quota.spec.ts"
Task: "tests/unit/scoring-youtube-reference.spec.ts"
Task: "tests/integration/youtube-auth.spec.ts"
Task: "tests/integration/youtube-search.spec.ts"

# Domínio e adaptador, arquivos distintos:
Task: "src/domain/quota/index.ts"
Task: "src/domain/versionHints/index.ts"
Task: "src/services/providers/youtube/auth.ts"
Task: "src/services/providers/youtube/errors.ts"
```

---

## Implementation Strategy

### MVP (US1 apenas)

1. Fase 1 — Setup
2. Fase 2 — Foundational (**crítica**: o Spotify precisa continuar idêntico ao final dela)
3. Fase 3 — US1
4. **PARAR E VALIDAR**: cenário V1 do quickstart
5. Entregável: o fluxo Spotify da 001, agora com credenciais opcionais e destino explícito

### Entrega incremental

1. Setup + Foundational → base multi-provedor pronta
2. + US1 → seletor de destinos (MVP)
3. + US2 → o YouTube passa a ser um destino utilizável sozinho, já com o bloqueio por cota
4. + US3 → os dois destinos em sequência, com resumo
5. + US4 → esgotamento em execução, reautorização e rascunho preservado
6. + Polish → acessibilidade, desempenho, documentação

Cada incremento entrega valor sem quebrar o anterior.

---

## Notes

- `[P]` = arquivos diferentes, sem dependência pendente
- **Numeração**: T109 a T116 foram acrescentadas depois, por `/speckit-analyze`, e T094–T096 migraram da Fase 6 para a Fase 4 — por isso a sequência não é contígua dentro de cada fase. A ordem de execução é a ordem em que as tarefas aparecem no arquivo, não a numérica. Renumerar quebraria as referências cruzadas do plano e do quickstart sem ganho algum
- Todo teste que existe para garantir um requisito **deve citá-lo** (`FR-xxx`, `SC-xxx`) em nome ou comentário — exigência de rastreabilidade da constituição
- Nenhum teste toca a rede real: integração usa MSW, ponta a ponta usa Playwright com **os dois** provedores mockados
- Nenhum literal de texto de interface fora de `src/i18n/` — a regra `tp/no-ui-text-literals` falha o build
- Commit a cada tarefa ou grupo lógico; parar em qualquer checkpoint para validar a história isoladamente
