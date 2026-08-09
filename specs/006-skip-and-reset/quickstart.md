# Quickstart — como validar a feature 006

**Feature**: 006-skip-and-reset

Guia de validação, não de implementação. Os detalhes de contrato estão em
[flow-contract.md](./contracts/flow-contract.md) e
[ui-contract.md](./contracts/ui-contract.md); a modelagem, em
[data-model.md](./data-model.md).

---

## Pré-requisitos

```bash
node --version    # ≥ 22
npm ci
npx playwright install chromium   # só na primeira vez
```

Nenhuma credencial real é necessária: os testes usam MSW e mocks de rota do
Playwright. **Nenhum teste toca a rede real** (Princípio IV).

## Linha de base

Antes de qualquer mudança, e de novo ao final:

```bash
npm run lint && npm run typecheck && npm test
```

Medido em 2026-08-08, antes desta feature: **69 arquivos, 902 testes, todos
passando**. Ao final, o número de testes deve ter **crescido** e nenhum
existente pode ter virado vermelho.

```bash
npm run test:e2e
```

Obrigatório antes de publicar, porque esta feature altera o fluxo do assistente
(portão da constituição).

## As cinco suítes que não podem ser editadas

A prova de não regressão desta feature é negativa: cinco suítes existentes devem
passar **sem uma linha alterada**. Precisar editá-las é o sinal de que a
implementação saiu do contrato.

```bash
npx vitest run tests/unit/run-machine.spec.ts \
               tests/unit/no-secrets.spec.ts \
               tests/unit/i18n-stability.spec.ts \
               tests/integration/draft-recovery.spec.ts \
               tests/integration/draft-after-quota.spec.ts

npx playwright test e2e/multi-destination.spec.ts
```

| Suíte | O que ela prova aqui |
| --- | --- |
| `run-machine` | `reduceRun` ficou intocado — o defeito nunca esteve no redutor |
| `no-secrets` | nenhum host, escopo ou segredo novo |
| `i18n-stability` | nenhum texto existente foi alterado (só adição de chave) |
| `draft-recovery`, `draft-after-quota` | extrair `hasWork` não mudou a restauração |
| `multi-destination` | o sexto ponto de pulo, que já funcionava, continua igual |

## Cenários de validação

### V1 — O beco sem saída deixou de existir (SC-001, SC-002, FR-004, FR-007)

O cenário que a Fase 0 mediu como pior defeito. Manual, em `npm run dev`:

1. cadastre uma credencial, selecione **apenas um** destino, cole 3 linhas;
2. avance até a revisão daquele destino;
3. acione "Pular o {serviço}".

**Esperado**: um diálogo diz que pular encerra o fluxo e descarta a lista.
Confirmando, a tela seguinte é **a seleção de serviços**, com a lista zerada.

**Não pode acontecer**, em nenhum instante: o título "Criando playlist…", nem
uma tela sem cabeçalho e sem botão.

Automatizado em `e2e/multi-destination.spec.ts` (V17) e
`tests/components/skip-service.spec.tsx` (V3).

### V2 — Pular leva ao próximo, nas quatro fases (FR-002, FR-008)

```bash
npx vitest run tests/components/skip-service.spec.tsx
```

Com dois destinos, pular o primeiro em `connect`, `estimate`, `search`/`review`
e `awaiting_reauth`. Em todas: a tela seguinte é a primeira fase do segundo
destino, sem diálogo de confirmação e sem passar por tela de criação.

### V3 — Pular o último com algo já criado vai ao resumo (FR-003)

Mesma suíte. Primeiro destino concluído com playlist, segundo pulado em qualquer
fase: a tela é o **resumo consolidado**, com o link do primeiro, sem confirmação
e sem descarte. Repetido com o primeiro em `partial` e em `failed` — a fronteira
é "rodou", não "deu certo".

### V4 — A tabela de verdade inteira (FR-002, FR-003, FR-004)

```bash
npx vitest run tests/unit/flow-exit.spec.ts
```

Percorre as seis linhas de [flow-contract §1](./contracts/flow-contract.md), sem
DOM. É o teste que precisa ficar verde antes de qualquer componente ser escrito.

### V5 — Recusar a confirmação não muda nada (FR-005, FR-020, SC-007)

```bash
npx vitest run tests/components/skip-service.spec.tsx tests/components/reset-flow.spec.tsx
```

Nos dois diálogos: recusar, fechar pelo véu e fechar por `Esc` deixam etapa,
fase, fila e trabalho idênticos, e devolvem o foco ao botão que abriu.

### V6 — Nada sai para a rede, nada é escrito (FR-009, FR-016, FR-019, SC-003)

```bash
npx vitest run tests/integration/skip-aborts.spec.ts tests/integration/reset-aborts.spec.ts
```

Contando requisições no MSW: pular e recomeçar não emitem nenhuma requisição de
criação nem de adição, em nenhum provedor. E o que estava em voo é **abortado** —
`signal.aborted === true`, que é o que hoje não acontece
([research §5](./research.md), §6).

### V7 — Recomeço zera o trabalho e preserva o resto (FR-016, FR-017, FR-018, SC-005, SC-006)

```bash
npx vitest run tests/components/reset-flow.spec.tsx
```

Depois de confirmar: texto, linhas, configuração, fila e seleção zerados; etapa
`destinations`; **credenciais e sessões intactas**; rascunho apagado, de modo
que uma restauração subsequente não o traga de volta.

Manual, para SC-006: recomece e inicie outra execução — não pode haver pedido de
reautorização de nenhuma conta.

### V8 — O botão só aparece quando há o que descartar (FR-021)

```bash
npx vitest run tests/unit/has-work.spec.ts tests/components/reset-flow.spec.tsx
```

Sessão recém-iniciada na seleção de serviços: ausente. Depois de escolher
destinos e avançar: presente.

### V9 — Foco e acessibilidade (FR-023, FR-024, SC-008)

```bash
npx vitest run tests/a11y/steps.spec.tsx
npx playwright test e2e/keyboard.spec.ts e2e/narrow-viewport.spec.ts
```

Axe sem violação séria ou crítica com cada diálogo aberto. Percurso completo por
teclado, pulando e recomeçando sem mouse. Em tela estreita, os diálogos não
produzem rolagem horizontal.

**Atenção ao que V9 conserta e não só preserva**: hoje passar de um serviço para
o outro **não** move o foco ([research §7](./research.md)). Depois desta
feature, move — inclusive pelo botão "Continuar para o {serviço}" que já existe.

## Critério de pronto

- [ ] `npm run lint`, `npm run typecheck`, `npm test` verdes
- [ ] `npm run test:e2e` verde
- [ ] As cinco suítes da lista acima passam **sem edição**
- [ ] V1 verificado à mão, no navegador, com um destino só
- [ ] Nenhum texto existente de `src/i18n/pt-BR.ts` foi alterado
- [ ] `git diff` não toca `src/domain/run/machine.ts`
