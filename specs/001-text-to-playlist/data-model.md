# Data Model: Importador de Playlist por Texto

**Feature**: `001-text-to-playlist` | **Data**: 2026-08-05 | **Fase**: 1

Todas as entidades vivem no navegador. Não há banco de dados nem servidor. As decisões de armazenamento estão em [research.md §8](./research.md); o formato serializado em disco está em [contracts/storage.md](./contracts/storage.md).

---

## Visão geral das relações

```
Credential (1) ──── Session (0..1) ──── SpotifyUser (1)

WorkDraft (0..1)
 ├── rawText: string
 ├── step: WizardStep
 ├── playlistConfig: PlaylistConfig (1)
 ├── items: MatchItem (0..N)  ← ordem = ordem do texto original
 │    ├── line: InputLine (1)
 │    └── candidates: TrackCandidate (0..5)
 └── creation: CreationProgress (0..1)

CreationResult (0..1)  ← efêmero, exibido na etapa 4
```

---

## Entidades

### `Credential`

Client ID informado pelo usuário (spec: **Credencial**).

| Campo      | Tipo     | Regras                                                                                                                                                                                                                      |
| ---------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clientId` | `string` | Obrigatório. `trim()` aplicado ao salvar. 32 caracteres hexadecimais minúsculos no formato emitido pelo Spotify — formato divergente gera **aviso**, não bloqueio (o formato pode mudar; a autorização é a validação real). |

**Invariantes**

- Nunca serializado junto com um `clientSecret` — o tipo não possui tal campo (FR-005).
- Exibido mascarado: últimos 4 caracteres visíveis, precedidos por `•` (FR-003).
- Persistido em `tp.v1.credential`; removido apenas por ação explícita (FR-004).

---

### `Session`

Autorização ativa (spec: **Sessão**).

| Campo          | Tipo                | Regras                                                                 |
| -------------- | ------------------- | ---------------------------------------------------------------------- |
| `accessToken`  | `string`            | Obrigatório                                                            |
| `refreshToken` | `string`            | Obrigatório. Substituído apenas quando a renovação devolve um novo     |
| `expiresAt`    | `number` (epoch ms) | Calculado como `Date.now() + expires_in × 1000` no momento da resposta |
| `scopes`       | `string[]`          | Escopos efetivamente concedidos                                        |
| `user`         | `SpotifyUser`       | Preenchido por `GET /v1/me` logo após a troca do código                |

**Estados**

```
ausente → autorizando → ativa → expirada → (renovação) → ativa
                          │                    └─(falha)→ ausente + rascunho preservado
                          └─(desconectar)────────────────→ ausente
```

**Invariantes**

- `expiresAt - Date.now() < 60_000` ⇒ tratada como expirada (renovação proativa, research §9).
- Encerrar a sessão apaga `tp.v1.session` e **não** toca em `tp.v1.credential` nem em `tp.v1.draft` (US1 cenário 6, FR-044).

---

### `SpotifyUser`

| Campo         | Tipo     | Regras                                                                              |
| ------------- | -------- | ----------------------------------------------------------------------------------- |
| `id`          | `string` | Usado em `POST /v1/users/{id}/playlists` e no filtro `owner.id` da checagem de nome |
| `displayName` | `string` | Compõe o caminho efetivo (FR-036). Se vier vazio/nulo, usa `id` como fallback       |

---

### `InputLine`

Uma linha do texto colado, após a análise (spec: **Linha de Entrada**).

| Campo             | Tipo                     | Regras                                                                                 |
| ----------------- | ------------------------ | -------------------------------------------------------------------------------------- |
| `id`              | `string`                 | Estável durante toda a sessão de trabalho; sobrevive à edição da linha                 |
| `index`           | `number`                 | Base 0, na ordem do texto original. **Nunca reordenado** (FR-019)                      |
| `raw`             | `string`                 | Texto original da linha, sem alterações — é o que se copia na lista de falhas (FR-040) |
| `title`           | `string`                 | Extraído; vazio quando `parseStatus = 'unparsed'`                                      |
| `artist`          | `string`                 | Artista principal extraído                                                             |
| `featuredArtists` | `string[]`               | Extraídos de `feat.` / `ft.` / `com`; reforçam a pontuação (research §6)               |
| `parseStatus`     | `'parsed' \| 'unparsed'` | `'unparsed'` quando nenhum separador reconhecido foi encontrado (FR-015)               |

**Regras de análise** (FR-012 a FR-014)

- Linhas vazias ou só com espaços são descartadas antes de gerar `InputLine` (FR-014) — não ocupam índice.
- Prefixos de numeração (`1.`, `1)`, `-`, `–`, `•`, `*`) removidos antes da divisão.
- Separadores reconhecidos: `-`, `–`, `—`, `by` (FR-013).
- **O último separador da linha delimita o artista**: `Song - Remix - Artist` → título `Song - Remix`, artista `Artist` (edge case da spec).
- `parseStatus = 'unparsed'` não interrompe as demais linhas (FR-015) e é corrigível pelo usuário (FR-016).

---

### `TrackCandidate`

Faixa devolvida pela busca (spec: **Candidata**).

| Campo         | Tipo             | Regras                                                      |
| ------------- | ---------------- | ----------------------------------------------------------- |
| `uri`         | `string`         | `spotify:track:...` — o que é enviado na criação            |
| `id`          | `string`         |                                                             |
| `title`       | `string`         |                                                             |
| `artists`     | `string[]`       | Todos os artistas da faixa                                  |
| `album`       | `string`         |                                                             |
| `durationMs`  | `number`         | Exibida como `m:ss`                                         |
| `coverUrl`    | `string \| null` | Menor imagem disponível; `null` quando o álbum não tem capa |
| `externalUrl` | `string`         | Link para conferência manual                                |
| `score`       | `number`         | 0 a 1, calculado localmente (research §6)                   |

**Invariantes**

- No máximo 5 por item, ordenadas por `score` decrescente (FR-023).
- `score` é sempre calculado localmente — a ordem devolvida pela plataforma não é usada como verdade.

---

### `MatchItem`

Vínculo entre uma linha e a candidata escolhida (spec: **Correspondência**). É a unidade central da etapa de revisão.

| Campo         | Tipo               | Regras                                                                            |
| ------------- | ------------------ | --------------------------------------------------------------------------------- |
| `line`        | `InputLine`        |                                                                                   |
| `status`      | `MatchStatus`      | Ver máquina de estados abaixo                                                     |
| `candidates`  | `TrackCandidate[]` | 0 a 5                                                                             |
| `selectedUri` | `string \| null`   | Deve constar em `candidates`; `null` quando nada foi escolhido                    |
| `included`    | `boolean`          | Entra na playlist. Padrão: `true` só para `confident` (FR-025)                    |
| `duplicateOf` | `string \| null`   | `id` da primeira `InputLine` com a mesma chave; força `included = false` (FR-018) |
| `error`       | `string \| null`   | Falha de busca daquela linha (rede, 4xx não recuperável)                          |

**`MatchStatus`**

| Valor       | Origem                            | `included` inicial |
| ----------- | --------------------------------- | ------------------ |
| `pending`   | ainda não buscada                 | `false`            |
| `searching` | busca em voo                      | `false`            |
| `confident` | `score ≥ 0,82`                    | `true`             |
| `uncertain` | `0,55 ≤ score < 0,82`             | `false`            |
| `not_found` | `score < 0,55` ou zero resultados | `false`            |
| `unparsed`  | `line.parseStatus = 'unparsed'`   | `false`            |
| `discarded` | descartada pelo usuário (FR-024)  | `false`            |

**Máquina de estados**

```
unparsed ──(usuário corrige o texto e confirma)──→ pending
pending ──→ searching ──→ confident | uncertain | not_found
confident|uncertain|not_found ──(usuário edita a linha e confirma)──→ pending   [FR-017]
confident|uncertain           ──(usuário escolhe outra candidata)──→ confident  [FR-024]
qualquer                      ──(usuário descarta)──────────────────→ discarded [FR-024]
discarded                     ──(usuário reinclui)──────────────────→ estado anterior
```

**Invariantes**

- Rebuscar um item **não** altera nenhum outro `MatchItem` (FR-017) — a transição é sempre local.
- `included = true` exige `selectedUri !== null`.
- `status = 'uncertain'` com `included = true` só é alcançável por ação explícita do usuário (SC-003).

---

### `PlaylistConfig`

Spec: **Configuração da Playlist**.

| Campo         | Tipo      | Regras                                                                 |
| ------------- | --------- | ---------------------------------------------------------------------- |
| `name`        | `string`  | **Obrigatório** após `trim()` (FR-028). Só espaços = vazio (edge case) |
| `description` | `string`  | Opcional (FR-030)                                                      |
| `isPublic`    | `boolean` | Padrão `false` — privada (FR-030)                                      |

**Validação antes da criação** (todas devem passar)

1. `name.trim().length > 0` — senão bloqueia (FR-028).
2. Nenhuma playlist **do próprio usuário** com `name.trim().toLocaleLowerCase()` igual — senão bloqueia pedindo outro nome (FR-029).
3. Ao menos um `MatchItem` com `included = true` — senão bloqueia com explicação (FR-035).
4. A consulta de playlists existentes concluiu com sucesso — falha bloqueia com opção de repetir, nunca cria às cegas.

---

### `WorkDraft`

Estado de trabalho gravado no dispositivo (spec: **Rascunho de Trabalho**, FR-043 a FR-045).

| Campo            | Tipo                       | Regras                                                                       |
| ---------------- | -------------------------- | ---------------------------------------------------------------------------- |
| `schemaVersion`  | `number`                   | Rascunho de versão desconhecida é descartado com aviso, não migrado às cegas |
| `savedAt`        | `number` (epoch ms)        | Exibido na oferta de recuperação ("trabalho de …")                           |
| `step`           | `WizardStep`               | `'credential' \| 'input' \| 'review' \| 'result'` — etapa a retomar (FR-044) |
| `rawText`        | `string`                   | Texto colado, íntegro                                                        |
| `playlistConfig` | `PlaylistConfig`           |                                                                              |
| `items`          | `MatchItem[]`              | Correspondências já revisadas                                                |
| `creation`       | `CreationProgress \| null` | Presente só se a criação começou                                             |

**Ciclo de vida**

- Gravado com _debounce_ de 500 ms a cada mudança relevante (digitação, revisão, configuração).
- Restaurado automaticamente na abertura, com aviso e opção de continuar ou descartar (FR-044, US4 cenário 6).
- **Apagado** após criação bem-sucedida (FR-045) ou por "descartar rascunho".
- **Sobrevive** a desconexão, expiração de sessão e reconexão (FR-044, SC-006).
- Nunca contém token nem Client ID — credencial e sessão têm chaves próprias.

---

### `CreationProgress`

Ponto de retomada da adição de faixas (FR-033, SC-009). Existe apenas entre o início e o fim da criação.

| Campo              | Tipo             | Regras                                                                             |
| ------------------ | ---------------- | ---------------------------------------------------------------------------------- |
| `playlistId`       | `string`         | Playlist já criada — a retomada **não** cria outra                                 |
| `playlistUrl`      | `string`         |                                                                                    |
| `orderedUris`      | `string[]`       | Congelado no início; é a fonte da ordem e do particionamento                       |
| `batchSize`        | `100`            | Limite da plataforma                                                               |
| `committedBatches` | `number`         | Lotes confirmados. A retomada parte de `orderedUris.slice(committedBatches × 100)` |
| `failedAt`         | `number \| null` | Índice do lote que falhou                                                          |

**Invariante central**: `committedBatches` só incrementa após resposta de sucesso do lote. Isso é o que impede duplicação na retomada — nenhum lote confirmado é reenviado (SC-009).

---

### `CreationResult`

Spec: **Resultado** (FR-036, FR-039).

| Campo                        | Tipo       | Regras                                                             |
| ---------------------------- | ---------- | ------------------------------------------------------------------ |
| `playlistId` / `playlistUrl` | `string`   | Link direto (FR-039)                                               |
| `playlistName`               | `string`   |                                                                    |
| `effectivePath`              | `string`   | `Sua Biblioteca / {displayName} / {name}` (FR-036)                 |
| `addedCount`                 | `number`   |                                                                    |
| `skippedCount`               | `number`   | Descartadas + duplicatas + não incluídas                           |
| `failedLines`                | `string[]` | `line.raw` dos não encontrados, na ordem original (FR-039, FR-040) |

**Regra de apresentação**: o resultado sempre acompanha o aviso de que a plataforma não permite criar playlists dentro de pastas (FR-037, SC-007). Não existe campo de pasta em nenhuma entidade deste modelo (FR-038).

---

## Regras transversais

- **Ordem**: `InputLine.index` é a única fonte de ordem, da análise ao `orderedUris` (FR-019, SC-005).
- **Nada é escrito na conta antes da etapa de revisão ser confirmada** — nenhuma entidade de escrita é construída fora do fluxo de criação (FR-031).
- **Nenhum dado sai do dispositivo** exceto para os endpoints oficiais do Spotify listados em [contracts/spotify-api.md](./contracts/spotify-api.md) (FR-010).
