# Contrato — Armazenamento local, esquema v2

**Feature**: 002-multi-service-playlists · **Substitui**: `001/contracts/storage.md`

---

## 1. Chaves

| Chave | Área | Conteúdo | Requisito |
| --- | --- | --- | --- |
| `tp.v2.credential.spotify` | `localStorage` | `{ schemaVersion: 2, clientId }` | FR-001, FR-003 |
| `tp.v2.credential.youtube` | `localStorage` | idem | FR-001, FR-003 |
| `tp.v2.session.spotify` | `localStorage` | tokens + usuário (`refreshToken: string`) | FR-036 |
| `tp.v2.session.youtube` | `localStorage` | tokens + usuário (`refreshToken: null`) | FR-035, FR-036 |
| `tp.v2.authreq.spotify` | `sessionStorage` | `{ state, codeVerifier, createdAt }` | PKCE |
| `tp.v2.authreq.youtube` | `sessionStorage` | `{ state, createdAt }` | implicit |
| `tp.v2.draft` | `localStorage` | rascunho estendido | FR-037 a FR-039 |
| `tp.v2.quota.youtube` | `localStorage` | `{ schemaVersion: 2, ptDate, units }` | FR-029, FR-030 |

**Invariante 1 — isolamento por provedor**: cada chave pertence a **exatamente um** provedor. Remover credencial ou sessão de um serviço não tem como alcançar a chave de outro (FR-006, Princípio de armazenamento). Garantido pela assinatura dos repositórios, que recebem `ProviderId`.

**Invariante 2 — nenhum segredo no rascunho**: `tp.v2.draft` não contém token, `clientId` nem `codeVerifier`. Serialização campo a campo, sem `...spread` do estado (Princípio V).

**Invariante 3 — nunca lança**: armazenamento indisponível, JSON corrompido, forma inesperada ou versão desconhecida produzem `null` + aviso. Mantido da 001.

**Invariante 4 — sem segredo de cliente em lugar nenhum**: não existe caminho de código capaz de gravar `client_secret` (FR-004, Princípio II).

---

## 2. Formas

```jsonc
// tp.v2.session.youtube
{
  "schemaVersion": 2,
  "provider": "youtube",
  "accessToken": "ya29…",
  "refreshToken": null,          // ausência de renovação silenciosa é dado, não erro
  "expiresAt": 1785000000000,
  "scopes": ["https://www.googleapis.com/auth/youtube"],
  "user": { "id": "UC…", "displayName": "Nome do canal" }
}
```

```jsonc
// tp.v2.quota.youtube
{ "schemaVersion": 2, "ptDate": "2026-08-05", "units": 7556 }
```

```jsonc
// tp.v2.draft (recorte)
{
  "schemaVersion": 2,
  "savedAt": 1785000000000,
  "step": "service",
  "rawText": "…",
  "lines": [ { "id": "l0", "index": 0, "raw": "…", "title": "…", "artist": "…",
               "featuredArtists": [], "parseStatus": "parsed" } ],
  "playlistConfig": { "name": "…", "description": "", "isPublic": false },
  "destinations": { "selected": ["spotify", "youtube"], "locked": true },
  "queue": {
    "order": ["spotify", "youtube"],
    "currentIndex": 1,
    "runs": {
      "spotify": { "provider": "spotify", "phase": "done", "outcome": "completed",
                   "lineIds": ["l0", "l1"], "items": [ /* … */ ],
                   "frozenLines": [ /* … */ ], "estimate": null,
                   "creation": null, "result": { /* … */ }, "error": null },
      "youtube": { "provider": "youtube", "phase": "review", "outcome": null,
                   "lineIds": ["l0"], "items": [ /* … */ ],
                   "frozenLines": null,
                   "estimate": { "estimatedUnits": 7556, "availableUnits": 10000,
                                 "blocked": false, "maxLinesThatFit": 66 },
                   "creation": null, "result": null, "error": null }
    }
  }
}
```

---

## 3. Ciclo de vida do rascunho

| Evento | Efeito | Requisito |
| --- | --- | --- |
| Digitação, revisão, configuração | grava com debounce de 500 ms | mantido da 001 |
| `committedItems` muda | grava **síncrono**, sem debounce | SC-010, Princípio V |
| Todos os serviços concluídos com sucesso | apaga | Princípio V |
| "Descartar rascunho" | apaga | `001/FR-045` |
| Execução encerrada por cota | **preserva** — descarte só por ação explícita | Princípio V (ver nota) |
| Sessão expira / recarga / fechamento | preserva integralmente | SC-014 |

> **Nota — Princípio V vs. FR-038.** O Princípio V é literal: "o trabalho em andamento MUST ser apagado apenas após sucesso ou por ação explícita de descarte". A emenda constitucional v1.1.0 registrou que essa colisão seria resolvida **na spec**, preservando o rascunho — e a redação atual de FR-038 ("apagar quando todos tiverem terminado — concluídos, pulados ou **encerrados**") ainda não foi ajustada. Este contrato segue a constituição, que prevalece. Ver [plan.md](../plan.md#divergências-internas-da-spec).

---

## 4. Migração v1 → v2

Executada uma vez na inicialização, antes de qualquer leitura de estado.

| Origem (v1) | Destino (v2) | Regra |
| --- | --- | --- |
| `tp.v1.credential` | `tp.v2.credential.spotify` | cópia direta |
| `tp.v1.session` | `tp.v2.session.spotify` | acrescenta `provider: 'spotify'` |
| `tp.v1.pkce` | `tp.v2.authreq.spotify` | cópia; efêmero, pode ser descartado |
| `tp.v1.draft` | `tp.v2.draft` | ver abaixo |

**Rascunho v1 → v2** (FR-042):

```text
lines           ← items[].line, na ordem de index
destinations    ← { selected: ['spotify'], locked: creation !== null }
queue.order     ← ['spotify']
queue.currentIndex ← 0
runs.spotify    ← { phase: derivado de step, lineIds: todos, items: items,
                    creation: creation com committedItems = committedBatches × 100 }
step            ← 'credential' | 'input' → igual · 'review' | 'result' → 'service'
```

**Regras**:

1. A chave v1 é removida **apenas após** a gravação v2 bem-sucedida. Falha de gravação preserva o original.
2. `committedBatches × batchSize(spotify)` = `committedItems` — a retomada continua exata.
3. Rascunho v1 ilegível ⇒ descarte com aviso, como já acontece hoje.
4. Nenhum aviso adicional ao usuário além do banner de recuperação existente (FR-042).
5. Se o Client ID do Spotify tiver sido removido desde então, a restauração acontece e o destino aparece não selecionável até recadastro (caso de borda da spec).

**Invariante M1**: nenhuma leitura interpreta conteúdo v1 como se fosse v2. A migração é explícita e testada (`tests/unit/storage-migration.spec.ts`).

---

## 5. Orçamento de tamanho

O rascunho passa a guardar itens de **dois** serviços. Pior caso previsto (50 linhas × 2 serviços × 5 candidatas) ≈ 800 KB — dentro do limite típico de 5 MB do `localStorage`, mas com menos folga que na 001.

A degradação em dois passos é mantida e estendida: (1) descartar as candidatas alternativas, mantendo só a escolhida; (2) se ainda não couber, descartar as alternativas das execuções **já concluídas**, cujo resultado já está congelado; (3) devolver `failed` e avisar o usuário. Nunca falha em silêncio.
