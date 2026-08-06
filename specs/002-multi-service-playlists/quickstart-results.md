# Resultado dos cenários de validação (002)

**Feature**: 002-multi-service-playlists
**Data**: 2026-08-06
**Origem**: execução dos cenários V1 a V8 de [quickstart.md](./quickstart.md) (T107, T125)

## Portão local

| Comando | Resultado |
| --- | --- |
| `npm run lint` | ✅ sem erro |
| `npm run typecheck` | ✅ sem erro |
| `npm test` | ✅ **440 testes** em 41 arquivos |
| `npm run test:e2e` | ✅ **50 testes** (6 arquivos × projetos `desktop` e `narrow-375`) |

Nenhuma execução tocou a rede real: integração por MSW, ponta a ponta com **os
dois** provedores mockados por rotas do Playwright.

---

## V1 — Credenciais opcionais e seletor ✅

| Passo do quickstart | Verificação | Resultado |
| --- | --- | --- |
| 1. Avanço bloqueado sem credencial (FR-002) | `tests/unit/validation-destinations.spec.ts`, `tests/components/credential-form.spec.tsx` | ✅ |
| 2. Só YouTube ⇒ Spotify desabilitado com motivo e atalho (SC-002) | `tests/components/destinations.spec.tsx`, `e2e/connect.spec.ts` | ✅ |
| 3. Duas credenciais ⇒ ambos marcados (SC-003) | `tests/components/destinations.spec.tsx`, `e2e/multi-destination.spec.ts` | ✅ |
| 4. Zero destinos ⇒ bloqueado (FR-011) | `tests/unit/validation-destinations.spec.ts`, `tests/components/destinations.spec.tsx` | ✅ |
| 5. Remover uma credencial não afeta a outra (FR-006) | `tests/unit/storage.spec.ts`, `tests/components/destinations.spec.tsx` | ✅ |
| 6. Credencial mascarada por padrão (FR-003) | `e2e/connect.spec.ts`, `tests/components/credential-form.spec.tsx` | ✅ |

**SC-001** (≤ 2 min do zero até o seletor) é observação humana com os Client IDs
em mãos; não é cronometrável em suíte automatizada. O caminho que ela mede — três
cliques da configuração ao seletor — está coberto por `e2e/connect.spec.ts`.

## V2 — Fluxo só YouTube ✅

| Passo | Verificação | Resultado |
| --- | --- | --- |
| 2. Estimativa antes de qualquer busca (SC-011) | `e2e/multi-destination.spec.ts`, `e2e/draft-recovery.spec.ts` | ✅ |
| 3. Canal e duração, **sem** campo de álbum (FR-024) | `tests/components/review.spec.tsx` | ✅ |
| 4. Indício de versão nunca vem `Confiante` (FR-025) | `tests/unit/version-hints.spec.ts`, `tests/unit/scoring-youtube-reference.spec.ts` | ✅ |
| 5. Resultado com link, totais e não encontradas copiáveis (FR-041) | `tests/components/result-youtube.spec.tsx`, `e2e/multi-destination.spec.ts` | ✅ |
| 6. Mesmo nome ⇒ bloqueado (FR-022) | `e2e/create-playlist.spec.ts` | ✅ |
| 7. Caminho efetivo e aviso de pastas (FR-027, FR-028) | `tests/components/result-youtube.spec.tsx` | ✅ |

**SC-006**: `tests/unit/scoring-youtube-reference.spec.ts` mede ≥ 75% de
`Confiante` correta contra `reference-50-youtube.json` — passa, junto das
verificações de que nenhuma versão de karaokê, cover ou ao vivo é classificada
como `Confiante`.

**Correção aplicada durante esta validação**: a tela de estimativa nunca chegava
a aparecer. `ServiceStep` despachava `estimate_ok` no mesmo efeito que calculava
a estimativa, tornando o botão "Continuar e buscar" código morto e violando
SC-011 — a estimativa só era *exibida* quando **bloqueava**. Agora quem emite
`estimate_ok` é o usuário.

## V3 — Dois destinos em sequência ✅

| Passo | Verificação | Resultado |
| --- | --- | --- |
| 1. Texto, nome e visibilidade informados uma vez (FR-013) | `e2e/multi-destination.spec.ts` | ✅ |
| 2. "Spotify — 1 de 2" em todas as telas do ciclo (FR-018) | `e2e/multi-destination.spec.ts`, `e2e/keyboard.spec.ts` | ✅ |
| 3. Nenhuma requisição ao YouTube antes do ciclo dele (SC-005) | `e2e/multi-destination.spec.ts` (contadores do mock em zero) | ✅ |
| 4. Autorização e revisão independentes por serviço (FR-017, FR-019) | `tests/integration/no-write-before-review.spec.ts`, `e2e/multi-destination.spec.ts` | ✅ |
| 5. Correção de texto propaga; escolha de candidata não (SC-013) | `tests/unit/line-propagation.spec.ts` | ✅ |
| 6. Resumo por serviço (FR-040) | `tests/unit/summary.spec.ts`, `e2e/multi-destination.spec.ts` | ✅ |

**SC-004**: duas playlists, ordem original preservada, sem duplicata — verificado
por igualdade de array exata em `e2e/multi-destination.spec.ts`
(`spotify:track:bohemian-rhapsody`, `…:imagine`, `…:smells-like-teen-spirit` e os
`videoId` correspondentes).

**SC-015** (50 linhas nos dois destinos em ≤ 2 min): `tests/unit/throughput.spec.ts`
mede a soma dos dois limitadores — os serviços rodam um depois do outro, então o
orçamento é a soma, nunca o máximo.

## V4 — Cota e expiração ✅

| Passo | Verificação | Resultado |
| --- | --- | --- |
| 1. Bloqueio na estimativa, com duas saídas e a premissa declarada (FR-029, SC-008) | `tests/unit/quota.spec.ts`, `tests/a11y/steps.spec.tsx` | ✅ |
| 2. `quotaExceeded` encerra em uma mensagem, sem laço (FR-031, SC-009) | `tests/integration/youtube-quota.spec.ts` (conta requisições emitidas) | ✅ |
| 2. Playlist incompleta não é removida, com aviso de nome duplicado (FR-032) | `tests/components/result-youtube.spec.tsx`, `e2e/multi-destination.spec.ts` | ✅ |
| 3. Reautorização preserva a revisão (FR-035) | `tests/integration/session-recovery.spec.ts`, `tests/integration/youtube-auth.spec.ts` | ✅ |
| 4. Retomada sem faixa duplicada nem faltante (SC-010) | `tests/integration/partial-failure.spec.ts`, `e2e/create-playlist.spec.ts` | ✅ |
| 5. Um serviço concluído e outro pendente sobrevivem à recarga (SC-014) | `e2e/draft-recovery.spec.ts` | ✅ |

**Correção aplicada durante esta validação**: o rascunho não era gravado antes da
navegação de autorização. O debounce de 500 ms morria com o documento, e o
retorno do consentimento caía na etapa de destinos em vez do serviço e da etapa
exatos (FR-037). `ConnectButton` agora força a gravação antes de navegar.

## V5 — Rascunho legado ✅

`tests/unit/storage-migration.spec.ts` (16 testes) cobre a v1 → v2 completa:
rascunho v1 restaurado como fluxo Spotify de destino único na etapa gravada,
`committedBatches × 100 = committedItems`, chave v1 preservada em falha de
gravação e rascunho ilegível descartado com aviso (FR-042).

## V6 — Divergência de listas ✅

| Passo | Verificação | Resultado |
| --- | --- | --- |
| 1. Reduzir entre serviços é permitido | `e2e/keyboard.spec.ts` (ajuste de lista pelo teclado) | ✅ |
| 2. Acrescentar ou editar é bloqueado (FR-013) | `tests/unit/line-subset.spec.ts` | ✅ |
| 3. Resumo declara a divergência; o relato do concluído não muda (SC-018) | `tests/unit/summary.spec.ts`, `tests/unit/run-machine.spec.ts` (invariante R2) | ✅ |

## V7 — Superfície fechada e privacidade ✅

```
npm test -- no-secrets                       → 12 testes, todos passam
grep -ri "client_secret\|clientSecret" src/  → nenhuma ocorrência
```

`tests/unit/no-secrets.spec.ts` compara `PROVIDER_HOSTS` entrada a entrada,
falhando tanto por host **ausente** quanto por host **excedente**.
`e2e/multi-destination.spec.ts` fecha o cerco de fato: registra a origem de toda
requisição da página e falha em qualquer origem fora da lista.

**SC-017**: `accounts.google.com` recebe apenas navegação de página inteira,
nunca `fetch` — por isso está em `form-action` e **fora** de `connect-src` na CSP
de `vite.config.ts`.

## V8 — Acessibilidade e telas estreitas ✅

- `tests/a11y/steps.spec.tsx`: 12 telas sem violação séria ou crítica, incluindo
  as novas — destinos (habilitado e desabilitado), fila, estimativa (dentro do
  saldo e bloqueada), ajuste de lista e resumo consolidado.
- `e2e/narrow-viewport.spec.ts`: fluxo completo com **dois destinos** em 375 px,
  sem rolagem horizontal, com verificação em cada uma das cinco etapas mais a
  estimativa de cota (SC-016).
- `e2e/keyboard.spec.ts`: fila, estimativa, ajuste de lista e resumo operáveis só
  pelo teclado (FR-047).
- `npm run lint` passa — a regra `tp/no-ui-text-literals` falharia se algum texto
  de interface escapasse de `src/i18n/pt-BR.ts`.

---

## Pendências conhecidas

**Validação contra contas reais.** Todos os cenários acima foram executados com
os provedores mockados, como o próprio quickstart prevê. A primeira execução
contra contas Spotify e Google reais ainda não foi feita, e é o que pode revelar
divergência entre o contrato documentado e o comportamento efetivo das APIs —
particularmente o cadastro do cliente OAuth do Google, cujos passos de origem
JavaScript e usuário de teste são a fonte mais provável de atrito.
