# Quickstart — Validação da Reconexão

**Feature**: `specs/004-youtube-reconnect` · **Fase 1**

Como provar que a feature funciona. Nenhum cenário toca a rede real: integração usa MSW, ponta a ponta usa Playwright com os dois provedores mockados (Princípio IV).

---

## Pré-requisitos

```bash
npm ci
```

## Portão local (obrigatório antes de qualquer commit)

```bash
npm run lint && npm run typecheck && npm test
```

Esta feature altera o fluxo do assistente e a autorização, então o portão de publicação também se aplica:

```bash
npm run test:e2e
```

---

## V0 — Linha de base: o defeito antes do conserto

Roda **antes** de implementar, para provar que o teste falha pela razão certa.

```bash
npx vitest run tests/integration/reauth-search.spec.ts
```

**Esperado antes**: falha mostrando todas as linhas com `status: 'not_found'` e `error: "Autorize o YouTube de novo para continuar"`, com `interruption` inexistente.
**Esperado depois**: passa, com `interruption` classificada e linhas não buscadas em `pending`.

> Este é o cenário que refutou o diagnóstico original ([research §1](./research.md)). Se ele passar antes da implementação, a suíte não está exercitando o que se pensa.

---

## Cenários de aceitação

### C1 — Sessão cai na primeira busca (US1, P1)

```bash
npx vitest run tests/integration/reauth-search.spec.ts
```

| Verifica | Requisito |
| --- | --- |
| `401` não vira item `not_found` | FR-001, FR-002 |
| execução vai a `awaiting_reauth`, `outcome` continua `null` | FR-002 |
| rascunho gravado antes de qualquer mudança de estado | FR-003 |
| nenhuma requisição após a detecção | FR-006, SC-007 |
| uma interrupção com 100 linhas falhando juntas | FR-007 |
| sessão e credencial do outro provedor intactas | FR-004, FR-005, SC-005 |

### C2 — Preservação parcial e retomada (Q1)

```bash
npx vitest run tests/integration/reauth-partial-search.spec.ts
npx vitest run tests/integration/quota-401.spec.ts   # pré-requisito, roda antes do resto
```

Sessão cai após N linhas resolvidas.

| Verifica | Requisito | Arquivo |
| --- | --- | --- |
| as N resolvidas sobrevivem como resultado | FR-013a | `reauth-partial-search` |
| as demais voltam `pending`, não `not_found` | FR-013a, A3 | `reauth-partial-search` |
| a retomada emite requisição **só** para as que faltam | FR-013b, SC-009 | `reauth-partial-search` |
| consumo total = execução ininterrupta | FR-013c, SC-008 | `reauth-partial-search` |
| ordem preservada, duplicidade recalculada no conjunto completo | FR-013d | `reauth-partial-search` |
| **`401` não registra cota** | Q1, SC-008 | `quota-401` |

O caso de cota vive em arquivo próprio porque é pré-requisito da Fase 2, e não trabalho de US1 — a Fase Foundational não compartilha arquivo de teste com nenhuma história.

Casos de borda em `reauth-partial-search.spec.ts`: zero resolvidas (degrada para lista inteira) e todas resolvidas (retomada não consome nada).

### C3 — Sessão cai durante a criação (US2, Q2)

```bash
npx vitest run tests/integration/reauth-creation.spec.ts
npx vitest run tests/integration/partial-failure.spec.ts   # deve passar SEM EDIÇÃO
```

| Verifica | Requisito |
| --- | --- |
| `401` na adição leva a `awaiting_reauth`, não a desfecho | FR-027 |
| playlist criada não é removida nem recriada | FR-030 |
| retomada não duplica nem pula faixa | FR-029, SC-010 |
| nada escrito entre a interrupção e a reconexão | FR-032, SC-011 |
| reconexão a conta diferente encerra como parcial | FR-031 |
| `retryRemaining` segue intocado | não regressão |

> `partial-failure.spec.ts` passar **sem edição** é a prova de que a retomada por lote já existente não foi alterada ([research §5](./research.md)).

### C4 — Modal (US1, US4)

```bash
npx vitest run tests/components/reauth-dialog.spec.tsx
```

| Verifica | Requisito |
| --- | --- |
| abre por estado derivado, com título, progresso e ações | FR-009, FR-010, FR-028 |
| custo da retomada só no provedor com cota, sobre o que falta | FR-013, C4 |
| `Esc` fecha; foco inicial dentro; foco devolvido ao fechar | FR-011 |
| fechar deixa a etapa com pedido, reconectar e pular | FR-012, US4 |
| dispensa **não** é persistida — recarregar reapresenta | US4 cenário 3 |
| credencial ausente muda a mensagem sem descartar trabalho | FR-016a |

### C5 — Retomada sem recarga (armadilha `startedFor`)

```bash
npx vitest run tests/components/reauth-resume.spec.tsx
```

Reconecta **sem** recarregar a página e verifica que a busca reinicia. É o único teste que pega a guarda de efeito descrita em [research §4](./research.md) — na navegação real o `ref` zera e o defeito ficaria escondido até alguém mudar o fluxo.

| Verifica | Requisito |
| --- | --- |
| voltar a `search` reinicia a busca | FR-014, T2 |
| busca só o que falta | FR-013b, T3 |
| voltar a `creating` chama `retryRemaining` | FR-014, T4 |
| estimativa **não** é reexibida | T5 |

### C6 — Cabeçalho de contas (US3)

```bash
npx vitest run tests/components/session-header.spec.tsx
```

| Verifica | Requisito |
| --- | --- |
| desconectado com credencial continua listado, com reconectar | FR-019 a FR-021, SC-004 |
| conectado oferece reconectar **e** desconectar | FR-021, FR-022 |
| sem credencial não é listado | FR-023 |
| desconectar mantém o serviço listado | FR-025, SC-004 |
| nada é escrito na conta | FR-026 |

### C7 — Precedência de cota esgotada

```bash
npx vitest run tests/integration/youtube-quota.spec.ts
```

Cota esgotada **não** exibe modal de reconexão e continua encerrando sem repetir ([research §12](./research.md)). Os casos existentes devem passar sem edição.

### C8 — Acessibilidade

```bash
npx vitest run tests/a11y/
npm run test:e2e -- --grep "reconex"
```

| Verifica | Requisito | Onde |
| --- | --- | --- |
| axe-core sem violação séria/crítica com o modal aberto | SC-006 | a11y |
| **contenção de foco** | FR-011 | **e2e** — happy-dom não a emula ([research §8](./research.md)) |
| fluxo completo só por teclado | SC-006 | e2e |
| sem rolagem horizontal em tela estreita | A5 | e2e |

---

## Não regressão — devem passar **sem edição**

Editar qualquer um destes é sinal de que a implementação saiu do contrato:

```bash
npx vitest run tests/unit/no-secrets.spec.ts        # zero hosts/escopos novos (N4)
npx vitest run tests/integration/search.spec.ts     # busca sem interrupção intocada (FR-013e)
npx vitest run tests/integration/search-free-shape.spec.ts
npx vitest run tests/integration/search-retry.spec.ts
npx vitest run tests/integration/partial-failure.spec.ts
npx vitest run tests/integration/draft-recovery.spec.ts
npx vitest run tests/integration/session-recovery.spec.ts  # serviço sem sessão ao começar a etapa
npx vitest run tests/unit/throughput.spec.ts        # ≥ 2 linhas/s
```

---

## Verificação manual (opcional)

```bash
npm run dev
```

1. Configure o Client ID do YouTube, conecte, cole uma lista, avance até a busca.
2. Nas ferramentas do navegador, apague a chave `tp.v2.session.youtube` do `localStorage`.
3. Dispare a busca.

**Esperado**: modal de reconexão nomeando o YouTube, dizendo que o trabalho foi preservado e mostrando o custo da retomada — **não** uma revisão cheia de "Não encontrada".

4. Feche sem reconectar: a etapa mostra o pedido, com reconectar e pular.
5. Reconecte: volta à mesma etapa e busca **só** o que faltava.
6. No cabeçalho, confirme que o YouTube aparece mesmo desconectado, com **Reconectar**.
