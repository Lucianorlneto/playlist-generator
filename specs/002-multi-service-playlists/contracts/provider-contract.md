# Contrato — Interface de Provedor de Playlist

**Feature**: 002-multi-service-playlists

Contrato **interno** entre a orquestração (fila, ciclo, telas) e os adaptadores de provedor. É o que permite escrever o fluxo de FR-016 uma única vez. Vive em `src/services/providers/types.ts`.

Regra que este contrato existe para impor: **nenhum arquivo fora de `src/services/providers/{provider}/` pode ramificar por `ProviderId`**. Diferença de comportamento é dado em `capabilities`, não `if`. A exceção deliberada é a camada de i18n, que precisa de texto específico por provedor.

---

## 1. Interface

```ts
export interface PlaylistProvider {
  readonly id: ProviderId;
  readonly capabilities: ProviderCapabilities;

  /** Instruções e Redirect URI a exibir na configuração (FR-005). */
  readonly setup: {
    consoleUrl: string;             // link exibido, nunca destino de requisição
    instructionsKey: string;        // chave de i18n
    needsJavaScriptOrigin: boolean; // YouTube: true
  };

  // --- Autorização ---------------------------------------------------------
  /** Monta a URL de consentimento e persiste o registro de autorização. */
  buildAuthorizeUrl(clientId: string, redirectUri: string): Promise<string>;
  /** Interpreta o retorno (query no Spotify, fragmento no YouTube). */
  completeAuthorization(params: CallbackParams): Promise<ProviderSession>;
  /** Só existe quando `capabilities.canRefreshSilently === true`. */
  refresh?(session: ProviderSession, clientId: string): Promise<ProviderSession>;

  // --- Catálogo ------------------------------------------------------------
  /** Candidatas já pontuadas e ordenadas, no máximo 5 (FR-023). */
  search(lines: InputLine[], ctx: SearchContext): Promise<MatchItem[]>;

  // --- Playlists -----------------------------------------------------------
  listPlaylistNames(session: ProviderSession, signal?: AbortSignal): Promise<string[]>;
  createPlaylist(params: CreateParams): Promise<{ id: string; url: string }>;
  /** Adiciona **um lote** de `capabilities.batchSize` itens. */
  addItems(playlistId: string, uris: string[], signal?: AbortSignal): Promise<void>;
  /** `Sua Biblioteca / … / {nome}` — texto real do provedor (FR-027). */
  effectivePath(displayName: string, playlistName: string): string;

  // --- Cota (só quando `capabilities.quota !== null`) -----------------------
  estimate?(lineCount: number, selectedCount: number, now: number): QuotaEstimate;
  /** Registra consumo após cada resposta (research §5). */
  recordConsumption?(operation: QuotaOperation, count?: number): void;
}
```

---

## 2. Contrato de erros

Todo método rejeita com `AppError`, nunca com erro cru. As classes que a orquestração distingue:

| Classe | Origem típica | Efeito na `ServiceRun` |
| --- | --- | --- |
| `session_expired` | 401 com renovação possível | renova e repete, transparente |
| `reauth_required` | 401 com `canRefreshSilently: false` | pausa, pede reautorização, **preserva** o rascunho (FR-035) |
| `quota_exhausted` | 403 `quotaExceeded` / `dailyLimitExceeded` | encerra o serviço sem repetir (FR-031) |
| `rate_limited` | 429, 403 `rateLimitExceeded` | backoff e repetição, dentro do limite de tentativas |
| `name_duplicate` | checagem local de nomes | bloqueia **só aquele** serviço (FR-022) |
| `create_playlist_failed` | falha na criação | `outcome: 'failed'` daquele serviço (FR-021) |
| `add_items_failed` | falha ao adicionar | `outcome: 'partial'`, retomável na mesma execução |

**Invariante E1**: toda `AppError` carrega `provider`, e a mensagem exibida identifica o serviço, a causa provável e o próximo passo (FR-046).

**Invariante E2**: `quota_exhausted` **nunca** entra no caminho de repetição. Verificado contando as requisições emitidas em teste de integração (SC-009).

---

## 3. Obrigações de quem implementa

1. **Rede só pelos hosts do provedor.** Toda URL sai de `hosts.ts`; nenhum literal de URL absoluta nos adaptadores fora dele (Princípio II).
2. **Nenhuma requisição quando não selecionado.** O adaptador só é instanciado para provedores presentes em `selection.selected` (Princípio II, SC-005).
3. **`AbortSignal` propagado** em todas as chamadas de rede, inclusive durante espera de backoff (`001/FR-026`).
4. **Sem regra de negócio.** Pontuação, classificação, deduplicação e particionamento vêm de `src/domain/` (Princípio III). O adaptador traduz formato e nada mais.
5. **Sem texto de interface.** Adaptadores devolvem chaves de i18n, nunca frases (Princípio de idioma, regra `tp/no-ui-text-literals`).

---

## 4. Registro de provedores

```ts
// src/services/providers/registry.ts
export const PROVIDERS: Record<ProviderId, PlaylistProvider>;
/** Ordem fixa: Spotify antes de YouTube (FR-015). */
export function orderedProviders(selected: ProviderId[]): PlaylistProvider[];
```

**Invariante G1**: `orderedProviders` respeita `PROVIDER_ORDER` e é a **única** fonte de ordenação da fila e do seletor.

**Invariante G2**: provedor com `capabilities.quota !== null` nunca precede um sem cota (FR-015). Teste unitário sobre o registro.

---

## 5. Capacidades declaradas

| Capacidade | Spotify | YouTube | Requisito |
| --- | --- | --- | --- |
| `canRefreshSilently` | `true` | `false` | FR-035 |
| `quota` | `null` | `{ dailyBudget: 10000, … }` | FR-029 |
| `batchSize` | `100` | `1` | research §9 |
| `showsAlbum` | `true` | `false` | FR-024 |
| `thresholds.confident` | `0.82` | `0.88` | FR-023 |
| `thresholds.uncertain` | `0.55` | `0.55` | FR-023 |
