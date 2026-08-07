# Contrato — Consultas por forma de linha e por provedor

**Feature**: `003-flexible-search` · **Fase**: 1

Como cada adaptador traduz uma `InputLine` em consulta, e quando existe uma segunda consulta. Complementa `002/contracts/provider-contract.md` §3.

---

## 1. Tabela de consultas

| Provedor | `shape`    | Consulta primária                        | Consulta de retentativa      | Elegível a retentativa?          |
| -------- | ---------- | ---------------------------------------- | ---------------------------- | -------------------------------- |
| Spotify  | `explicit` | `track:"{título}" artist:"{artista}"`    | `{linha inteira}` texto livre | **sim** (primária é por campos)  |
| Spotify  | `free`     | `{linha inteira}` texto livre            | —                            | não (seria a mesma consulta)     |
| YouTube  | `explicit` | `{título} {artista}` texto livre         | `{linha inteira}` texto livre | só se as normalizadas diferirem  |
| YouTube  | `free`     | `{linha inteira}` texto livre            | —                            | não (seria a mesma consulta)     |

A regra é **uma só**, aplicada uniformemente aos dois provedores (decisão Q2 da spec): retenta quando a consulta alternativa é de fato outra. A tabela é o que essa regra produz, não um conjunto de casos especiais.

**Spotify `explicit` é sempre elegível** porque a consulta por campos é estruturalmente diferente do texto livre — restringe a correspondência a campos específicos e falha quando a grafia do artista diverge. É o fallback que já existe hoje em `searchTrack`, agora contabilizado.

**YouTube `free` nunca retenta**: a primeira consulta já é a linha inteira em texto livre. Repeti-la custaria 100 unidades para receber a mesma resposta.

---

## 2. Comparação de equivalência

```text
elegível(linha) =
  fieldedPrimary
    ? retry !== null
    : retry !== null && normalizeText(primary) !== normalizeText(retry)
```

`normalizeText` é a mesma função do domínio — sem acento, sem caixa, sem pontuação, sem ruído promocional, sem espaço múltiplo. É por isso que `Zoio de Lula - Charlie Brown Jr` e a linha inteira colapsam na mesma string: o hífen vira espaço e é absorvido.

**Exemplos verificados** (research §6):

| Linha                             | Primária (norm.)                | Retentativa (norm.)             | Elegível |
| --------------------------------- | ------------------------------- | ------------------------------- | -------- |
| `Zoio de Lula - Charlie Brown Jr` | `zoio de lula charlie brown jr` | `zoio de lula charlie brown jr` | não      |
| `Song (Official Video) - Artist`  | `song artist`                   | `song artist`                   | não      |
| `Song feat. X - Artist A & B`     | `song artist a`                 | `song feat x artist a b`        | **sim**  |
| `Marília Mendonça - Ao Vivo`      | `marilia mendonca ao vivo`      | `marilia mendonca ao vivo`      | não      |

A última merece nota: é o caso de falso corte, e ele **não** é resolvido por retentativa no YouTube — a consulta seria idêntica. É resolvido na pontuação (research §7), sem custo de rede.

---

## 3. Gatilho da retentativa

A retentativa é emitida quando **todas** valem:

1. a linha é elegível (§2);
2. a primeira consulta não devolveu **nenhuma candidata acima do piso `uncertain`** — zero resultados e resultados todos abaixo do piso contam igualmente (FR-009);
3. há orçamento de retentativa disponível na execução (`retriesUsed < retryReserve`, invariante O4).

Falhando (3) com (1) e (2) satisfeitos, o item recebe `attentionReason: 'retry_skipped_quota'` — não `not_found` puro. A distinção existe porque a ação do usuário é diferente (research §10).

**No máximo uma** retentativa por linha e por serviço. Não há terceira tentativa em nenhuma circunstância.

---

## 4. O que **não** muda

- Nenhum host novo. As consultas vão para `api.spotify.com` e `www.googleapis.com`, já na lista fechada do Princípio II.
- Nenhum escopo novo. A busca não exige escopo adicional em nenhum dos dois provedores.
- Nenhum parâmetro novo de requisição. `limit`/`maxResults` continuam em 5; `part`, `type` e a ausência de `market` permanecem como estão.
- O enriquecimento em lote do YouTube (`videos.list`) é indiferente à forma da linha e continua custando 1 unidade por lote de 50.

Consequência: `tests/unit/no-secrets.spec.ts` deve continuar passando **sem alteração**. Se ela quebrar, a implementação saiu do contrato.
