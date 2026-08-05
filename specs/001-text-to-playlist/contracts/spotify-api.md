# Contrato: superfície consumida da Spotify Web API

**Feature**: `001-text-to-playlist` | **Fase**: 1

Este é o **contrato externo completo** da aplicação. Nenhuma requisição de rede pode ser feita para qualquer destino fora desta lista (FR-010). O contrato é executável: cada entrada abaixo tem um handler correspondente em MSW nos testes de integração.

**Hosts autorizados**: `accounts.spotify.com`, `api.spotify.com`, `i.scdn.co` (imagens de capa).

---

## 1. Autorização — `GET https://accounts.spotify.com/authorize`

Redirecionamento do navegador (não é `fetch`).

| Parâmetro               | Valor                                                                  |
| ----------------------- | ---------------------------------------------------------------------- |
| `client_id`             | Client ID informado pelo usuário                                       |
| `response_type`         | `code`                                                                 |
| `redirect_uri`          | URL raiz da aplicação, calculada em tempo de execução (research §2)    |
| `code_challenge_method` | `S256`                                                                 |
| `code_challenge`        | base64url(SHA-256(`code_verifier`))                                    |
| `state`                 | 32 bytes aleatórios, base64url — validado no retorno                   |
| `scope`                 | `playlist-modify-private playlist-modify-public playlist-read-private` |

**Retorno**: `{redirect_uri}?code=…&state=…` ou `{redirect_uri}?error=…&state=…`.

**Contrato de erro** (FR-042, US4 cenário 4):

| `error`                                                           | Causa provável exibida ao usuário                                                           |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `invalid_client`                                                  | Client ID incorreto ou app inexistente                                                      |
| `redirect_uri_mismatch` \| `INVALID_CLIENT: Invalid redirect URI` | Redirect URI não cadastrado — a mensagem exibe o URI exato a cadastrar, com botão de copiar |
| `access_denied`                                                   | Usuário recusou o consentimento                                                             |
| `unsupported_response_type` / demais                              | Mensagem genérica + o valor bruto do erro                                                   |

Além disso: `state` divergente ⇒ o `code` é **descartado** e o fluxo reinicia. Conta fora da lista de permitidos de um app em modo de desenvolvimento aparece como `access_denied`; a mensagem cita essa hipótese (Assumptions da spec).

---

## 2. Troca de código — `POST https://accounts.spotify.com/api/token`

`Content-Type: application/x-www-form-urlencoded`. **Sem header `Authorization`** — o fluxo PKCE não usa segredo de cliente.

**Corpo**: `grant_type=authorization_code`, `code`, `redirect_uri`, `client_id`, `code_verifier`.

**Resposta 200** (campos consumidos):

```json
{
  "access_token": "…",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "…",
  "scope": "playlist-modify-private …"
}
```

**Erros**: `400` `invalid_grant` (código expirado/reutilizado ⇒ reiniciar autorização), `400` `invalid_client` (Client ID inválido ⇒ voltar à etapa de credencial).

---

## 3. Renovação — `POST https://accounts.spotify.com/api/token`

**Corpo**: `grant_type=refresh_token`, `refresh_token`, `client_id`.

**Resposta 200**: mesma forma. `refresh_token` **pode estar ausente** — nesse caso o anterior é mantido (research §1).

**Erro `400 invalid_grant`**: refresh token revogado ⇒ limpar sessão, pedir reconexão, **preservar o rascunho** (FR-044).

---

## 4. Perfil — `GET https://api.spotify.com/v1/me`

Campos consumidos: `id`, `display_name`. Nenhum escopo adicional necessário (research §3).

---

## 5. Playlists existentes — `GET https://api.spotify.com/v1/me/playlists`

`?limit=50&offset={n}` — paginado até `next === null`. Escopo: `playlist-read-private`.

Campos consumidos por item: `name`, `owner.id`.

**Uso**: checagem de nome duplicado (FR-029). Comparação por `name.trim().toLocaleLowerCase()`, **apenas** sobre itens com `owner.id === me.id`.

**Falha**: qualquer erro não recuperável **bloqueia a criação** com opção de repetir. A aplicação nunca cria sem ter concluído a verificação.

---

## 6. Busca — `GET https://api.spotify.com/v1/search`

| Parâmetro | Valor                                                                                         |
| --------- | --------------------------------------------------------------------------------------------- |
| `q`       | `track:"{título}" artist:"{artista}"` — fallback texto livre em zero resultados (research §5) |
| `type`    | `track`                                                                                       |
| `limit`   | `5`                                                                                           |
| `market`  | _omitido_ — `from_token` exigiria `user-read-private` (research §3)                           |

Campos consumidos por item de `tracks.items[]`: `uri`, `id`, `name`, `artists[].name`, `album.name`, `album.images[]` (menor), `duration_ms`, `external_urls.spotify`.

**Contrato de falha**:

| Status                        | Comportamento                                                                                 |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| `200` com `tracks.items = []` | fallback texto livre; se também vazio ⇒ `not_found`                                           |
| `401`                         | uma renovação + repetição (research §9)                                                       |
| `429`                         | espera `Retry-After` e repete; **cancelável durante a espera** (FR-026, SC-011)               |
| `5xx` / rede                  | até 3 tentativas com backoff; depois marca só aquela linha com `error`, sem abortar as demais |

---

## 7. Criar playlist — `POST https://api.spotify.com/v1/users/{user_id}/playlists`

**Corpo**: `{ "name": string, "description": string, "public": boolean }`.

Campos consumidos da resposta `201`: `id`, `external_urls.spotify`.

**Chamada única por criação.** Uma retomada após falha parcial **nunca** repete este passo — reutiliza `CreationProgress.playlistId`.

---

## 8. Adicionar faixas — `POST https://api.spotify.com/v1/playlists/{playlist_id}/tracks`

**Corpo**: `{ "uris": string[] }` — **máximo 100 URIs** por requisição (limite da plataforma). Sem `position`: cada lote é anexado ao final, o que preserva a ordem original desde que os lotes sejam sequenciais.

Lotes são enviados **em série**. `committedBatches` incrementa somente após `201`.

**Contrato de falha**: `429` ⇒ espera e repete o **mesmo** lote. `5xx`/rede ⇒ até 3 tentativas; esgotadas, a criação para com `failedAt` gravado e a interface oferece "tentar novamente" apenas para os lotes restantes (FR-033, SC-009).

---

## Endpoints deliberadamente ausentes

- **Pastas de playlist**: não existem na Web API. Nenhuma requisição relacionada a pastas é feita, e nenhuma é simulada (FR-038).
- `user-read-email` / `user-read-private`: fora dos escopos mínimos (FR-007).
- Qualquer endpoint de leitura/edição de playlists existentes além da listagem de nomes: fora de escopo.
