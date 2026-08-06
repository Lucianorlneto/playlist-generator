# Contrato — Superfície consumida da YouTube Data API v3

**Feature**: 002-multi-service-playlists

Documento exaustivo do que a aplicação chama do segundo provedor. O que não está aqui não é chamado.

---

## 1. Hosts autorizados

| Host | Uso |
| --- | --- |
| `https://accounts.google.com` | autorização (**navegação**, não `fetch`) |
| `https://www.googleapis.com` | YouTube Data API v3 |
| `https://i.ytimg.com` | miniaturas |

Espelham a tabela do Princípio II. `https://www.youtube.com/playlist?list=…` e `https://console.cloud.google.com/…` aparecem **apenas como link exibido**, nunca como destino de requisição — mesma exceção já concedida a `open.spotify.com`.

---

## 2. Autorização — Implicit Flow

**Requisição** (navegação de página inteira):

```text
GET https://accounts.google.com/o/oauth2/v2/auth
  ?client_id={clientId}
  &redirect_uri={redirectUri}
  &response_type=token
  &scope=https%3A//www.googleapis.com/auth/youtube
  &state={aleatório}
  &include_granted_scopes=true
```

**Retorno** — fragmento da URL de origem do app:

```text
{redirectUri}#access_token=ya29…&token_type=Bearer&expires_in=3599&scope=…&state=…
```

**Obrigações do adaptador**:

1. Conferir `state` contra `tp.v2.authreq.youtube`; divergência ⇒ `AppError('auth_state_mismatch')`, sem usar o token.
2. Limpar o fragmento com `history.replaceState` **antes** de qualquer outra coisa — token não pode sobreviver no histórico nem no `Referer`.
3. `refreshToken: null`; `expiresAt = Date.now() + expires_in·1000`.
4. Erro do usuário volta como `#error=access_denied` ⇒ aquele destino falha, o outro continua (caso de borda da spec).

**Não há renovação silenciosa.** Expirado ⇒ `reauth_required` (FR-035).

**Identificação da conta**: `GET /youtube/v3/channels?part=snippet&mine=true` (custo **1**) devolve `items[0].snippet.title` como `displayName` e `items[0].id` como `id`. É o mínimo para FR-036 ("deixar claro em qual conta cada playlist foi criada") sem pedir escopo de perfil.

---

## 3. Buscar candidatos

```http
GET /youtube/v3/search?part=snippet&type=video&maxResults=5&q={consulta}
Authorization: Bearer {accessToken}
```

**Custo: 100 unidades.** Consulta: `"{title} {artist}"`; fallback único com o título isolado quando `items` vier vazio (research §7).

Campos usados: `items[].id.videoId`, `snippet.title`, `snippet.channelTitle`, `snippet.thumbnails.default.url`.

`snippet.title` chega com entidades HTML (`&amp;`, `&#39;`) — decodificação obrigatória antes de pontuar.

---

## 4. Enriquecer com duração

```http
GET /youtube/v3/videos?part=contentDetails,snippet&id={até 50 ids separados por vírgula}
```

**Custo: 1 unidade por chamada.** `contentDetails.duration` em ISO-8601 (`PT3M52S`) → milissegundos por função pura. Sem esta chamada não há duração (FR-024) nem o indício de duração destoante (FR-025).

---

## 5. Listar playlists do usuário

```http
GET /youtube/v3/playlists?part=snippet&mine=true&maxResults=50&pageToken={…}
```

**Custo: 1 unidade por página.** Pagina por `nextPageToken`. Alimenta a checagem de nome duplicado local ao serviço (FR-022), com a mesma normalização já usada no Spotify: comparação sem diferenciar maiúsculas/minúsculas e ignorando espaços nas bordas.

---

## 6. Criar playlist

```http
POST /youtube/v3/playlists?part=snippet,status
Content-Type: application/json

{
  "snippet": { "title": "{nome}", "description": "{descrição}" },
  "status":  { "privacyStatus": "private" | "public" }
}
```

**Custo: 50 unidades.** `private` é o padrão (FR-026). `unlisted` existe na API e está **fora de escopo** por decisão da spec.

Resposta: `id`. URL exibida: `https://www.youtube.com/playlist?list={id}` (link, não destino de rede).

**Caminho efetivo** (FR-027): `Você / Playlists / {nome}`, com o aviso de que a aplicação não gerencia pastas — o YouTube não as expõe.

---

## 7. Adicionar um vídeo

```http
POST /youtube/v3/playlistItems?part=snippet
Content-Type: application/json

{
  "snippet": {
    "playlistId": "{playlistId}",
    "resourceId": { "kind": "youtube#video", "videoId": "{videoId}" }
  }
}
```

**Custo: 50 unidades por vídeo.** **Um vídeo por requisição** — não existe endpoint de lote. Envio **serial**, na ordem original; `committedItems` incrementa só após sucesso e é gravado de forma síncrona (SC-010).

`snippet.position` é omitido deliberadamente: sem ela, cada inserção vai para o fim, o que preserva a ordem e mantém a retomada idempotente.

---

## 8. Erros — desambiguação obrigatória do 403

O corpo de erro traz `error.errors[0].reason`:

| Status | `reason` | Classe | Comportamento |
| --- | --- | --- | --- |
| 401 | — | `reauth_required` | pede reautorização, preserva o rascunho (FR-035) |
| 403 | `quotaExceeded`, `dailyLimitExceeded` | `quota_exhausted` | **encerra sem repetir** (FR-031, SC-009) |
| 403 | `rateLimitExceeded`, `userRateLimitExceeded` | `rate_limited` | backoff exponencial, repetição limitada |
| 403 | `forbidden`, `insufficientPermissions` | permissão | mensagem sobre escopo/consentimento |
| 403 | `playlistItemsNotAccessible` | item | falha da linha, não da execução |
| 404 | `playlistNotFound`, `videoNotFound` | item | falha da linha |
| 409 | `conflict` | conflito | repetir uma vez |
| 5xx | — | transitório | backoff, como no Spotify |

**Invariante A1**: repetir uma requisição após `quota_exhausted` é violação de SC-009. Verificado por contagem de requisições em teste.

**App em modo de teste**: a tela de consentimento avisa que o app não é verificado e só aceita contas na lista de testadores do projeto do usuário. Quando a autorização falhar por isso, a mensagem precisa dizer exatamente isso (caso de borda da spec, FR-046).

---

## 9. Orçamento diário

| Operação | Custo |
| --- | --- |
| `search.list` | 100 |
| `videos.list` | 1 |
| `playlists.list` | 1 |
| `channels.list` | 1 |
| `playlists.insert` | 50 |
| `playlistItems.insert` | 50 |

**Orçamento padrão**: 10 000 unidades/dia, por projeto do usuário, renovado à **meia-noite Pacific Time**.

**Estimativa** (research §3): `(100·N + ceil(5N/50) + 1 + 50 + 50·S) × 1,10`.

O provedor **não expõe** o consumo já feito. O saldo é sempre inferido do Registro de Consumo Diário local (FR-029, Assumption da spec).
