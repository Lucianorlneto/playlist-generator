# Contrato: armazenamento local

**Feature**: `001-text-to-playlist` | **Fase**: 1

Formato serializado das chaves gravadas no dispositivo do usuário. Nenhum dado sai daqui (FR-010). O modelo lógico está em [data-model.md](../data-model.md).

**Prefixo de chave**: `tp.v1.` — o `v1` é o `schemaVersion`. Chave com versão desconhecida é **descartada com aviso**, nunca migrada às cegas.

---

## `tp.v1.credential` — `localStorage`

```json
{ "schemaVersion": 1, "clientId": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6" }
```

Vida: até "Remover credencial" (FR-004). **Não** é apagada ao desconectar a sessão.

---

## `tp.v1.session` — `localStorage`

```json
{
  "schemaVersion": 1,
  "accessToken": "BQ…",
  "refreshToken": "AQ…",
  "expiresAt": 1786060800000,
  "scopes": ["playlist-modify-private", "playlist-modify-public", "playlist-read-private"],
  "user": { "id": "spotifyuser", "displayName": "Fulano" }
}
```

Vida: até "Desconectar" ou falha de renovação. Apagá-la **não** apaga credencial nem rascunho (FR-044).

**Nota de segurança**: o `refreshToken` fica exposto a XSS. É consequência inevitável da restrição "sem servidor próprio"; mitigações em [research.md §8](../research.md).

---

## `tp.v1.pkce` — `sessionStorage`

```json
{ "codeVerifier": "…", "state": "…", "createdAt": 1786060800000 }
```

Vida: da ida ao consentimento até o consumo do `code`. **Destruída imediatamente após a troca**, com ou sem sucesso. `sessionStorage` (não `localStorage`) para morrer com a aba.

---

## `tp.v1.draft` — `localStorage`

```json
{
  "schemaVersion": 1,
  "savedAt": 1786060800000,
  "step": "review",
  "rawText": "Bohemian Rhapsody - Queen\nImagine - John Lennon",
  "playlistConfig": { "name": "Clássicos", "description": "", "isPublic": false },
  "items": [
    {
      "line": {
        "id": "l0",
        "index": 0,
        "raw": "Bohemian Rhapsody - Queen",
        "title": "Bohemian Rhapsody",
        "artist": "Queen",
        "featuredArtists": [],
        "parseStatus": "parsed"
      },
      "status": "confident",
      "selectedUri": "spotify:track:3z8h0TU7ReDPLIbEnYhWZb",
      "included": true,
      "duplicateOf": null,
      "error": null,
      "candidates": [
        {
          "uri": "spotify:track:3z8h0TU7ReDPLIbEnYhWZb",
          "id": "3z8h0TU7ReDPLIbEnYhWZb",
          "title": "Bohemian Rhapsody",
          "artists": ["Queen"],
          "album": "A Night at the Opera",
          "durationMs": 354320,
          "coverUrl": "https://i.scdn.co/image/…",
          "externalUrl": "https://open.spotify.com/track/…",
          "score": 0.98
        }
      ]
    }
  ],
  "creation": {
    "playlistId": "37i9dQZF1DXcBWIGoYBM5M",
    "playlistUrl": "https://open.spotify.com/playlist/…",
    "orderedUris": ["spotify:track:…"],
    "batchSize": 100,
    "committedBatches": 1,
    "failedAt": 2
  }
}
```

`creation` é `null` enquanto a criação não começou.

**Gravação**: debounce de 500 ms sobre mudanças de `rawText`, `items`, `playlistConfig`, `step`. A gravação de `creation.committedBatches` é **imediata e síncrona** após cada lote confirmado — é a garantia de SC-009 e não pode ficar pendurada em debounce.

**Nunca contém**: token, Client ID, ou qualquer dado de sessão.

**Orçamento e degradação** (research §8): ~400 KB no pior caso previsto (250 linhas × 5 candidatas). Em `QuotaExceededError`: (1) regravar mantendo só a candidata selecionada de cada item; (2) se ainda falhar, avisar o usuário de que o rascunho não pôde ser gravado e prosseguir em memória.

---

## Invariantes verificáveis por teste

1. Nenhuma chave contém a substring `client_secret` ou um campo `clientSecret` (FR-005).
2. `tp.v1.draft` nunca contém `accessToken` nem `refreshToken`.
3. Apagar `tp.v1.session` preserva `tp.v1.credential` e `tp.v1.draft` (FR-044, SC-006).
4. Criação bem-sucedida apaga `tp.v1.draft` e preserva as outras duas (FR-045).
5. Toda leitura passa por validação de forma; conteúdo corrompido ou de versão desconhecida é descartado com aviso, sem quebrar a aplicação.
