# Fase 1 — Roteiro de Validação

**Feature**: 005-ui-design-system | **Data**: 2026-08-07

Como provar que a feature funciona. Cenários executáveis, na ordem em que fazem sentido rodar.
Detalhes de valores estão em [contracts/tokens.md](./contracts/tokens.md); anatomia em
[contracts/components.md](./contracts/components.md); formato do registro em
[contracts/storage.md](./contracts/storage.md).

---

## Pré-requisitos

```bash
node --version    # >= 22
npm ci
```

Nenhuma credencial é necessária: os cenários de tema não tocam provedor nenhum. Os cenários que
percorrem o fluxo completo usam os mocks já existentes.

---

## Portão local

```bash
npm run lint        # inclui tp/no-raw-visual-values (novo)
npm run typecheck
npm test            # inclui contraste, resolução de tema, sincronia do theme-boot
npm run test:e2e    # obrigatório: esta feature altera o fluxo do assistente
```

Os quatro precisam passar. `test:e2e` não é opcional aqui — a constituição o exige para mudanças
que alterem o fluxo do assistente, e esta altera todas as telas.

---

## Verificações que precedem o código

Três itens da Fase 0 bloqueiam trabalho dependente e devem ser confirmados primeiro.

### V1 — `@theme inline` na Tailwind 4.3.3 *(bloqueia toda a migração)*

```bash
npm run build
grep -o 'var(--[a-z-]*)' dist/assets/*.css | sort -u | head
```

**Esperado**: os utilitários emitem `var(--bg)`, `var(--ink)` etc., e não os hex resolvidos. Se
os hex aparecerem inlinados, `@theme inline` não está surtindo efeito e a troca por atributo não
vai funcionar — pare e reveja research §1 antes de migrar qualquer componente.

### V2 — licença da fonte *(bloqueia o embarque)*

Conferir que o arquivo baixado traz OFL 1.1 e versionar o texto da licença junto do `.woff2`.

### V3 — algarismos tabulares *(bloqueia a assinatura)*

Renderizar duas linhas com numerais de larguras diferentes (`08` e `11`) em `--text-data` e
confirmar que a coluna alinha. Se não alinhar, aplicar o plano B de research §4 — largura fixa
no contêiner — antes de construir `MatchRow`.

---

## Cenário 1 — Tema segue o sistema, sem piscada *(FR-005, FR-010, SC-004)*

```bash
npm run build && npm run preview
```

1. Com o sistema operacional em modo escuro, abrir `http://127.0.0.1:4173`.
2. **Esperado**: o tema escuro já está no primeiro quadro. Nenhum lampejo claro.
3. Repetir com o sistema em modo claro.

Verificação mais dura, para o caso que o script resolve: gravar `{"schemaVersion":2,
"preference":"light"}` em `tp.v2.theme`, deixar o sistema em escuro, recarregar. O tema claro
deve aparecer já no primeiro quadro — é exatamente a divergência que `public/theme-boot.js`
existe para cobrir.

Automatizado em `e2e/theme.spec.ts`, comparando a cor de fundo no primeiro quadro pintado.

---

## Cenário 2 — Troca de tema não perturba o trabalho *(FR-007, SC-003)*

1. Avançar até a etapa de entrada e colar uma lista de várias linhas.
2. Iniciar a busca e, **com ela em andamento**, trocar de tema.
3. **Esperado**: a interface inteira troca; a etapa não muda; o texto colado permanece; a busca
   continua sem reiniciar nem cancelar; o progresso não regride.
4. Repetir durante a criação em lote e durante uma espera por limitação de taxa.

Este é o cenário que prova que o tema é fatia de estado independente e não passa pelo caminho de
reidratação do rascunho.

---

## Cenário 3 — Persistência e retorno ao sistema *(FR-008, FR-009, SC-005)*

1. Escolher "Claro". Fechar a aba. Reabrir.
2. **Esperado**: abre em claro, mesmo com o sistema em escuro.
3. Escolher "Sistema". Alterar a preferência do sistema operacional com a aba aberta.
4. **Esperado**: a interface acompanha a mudança ao vivo.
5. Escolher "Escuro". Alterar de novo a preferência do sistema.
6. **Esperado**: a interface **ignora** — a escolha manual vence.

---

## Cenário 4 — Degradação do armazenamento *(FR-011, casos de borda)*

| Situação a induzir | Esperado |
| --- | --- |
| `localStorage` bloqueado | Troca funciona na sessão; **nenhuma mensagem ao usuário** |
| `tp.v2.theme` com JSON inválido | Descarte silencioso, volta a seguir o sistema |
| `preference` com valor desconhecido | Idem |
| `schemaVersion` divergente | Idem |

Em nenhum caso a aplicação quebra ou exibe aviso. Coberto por
`tests/integration/theme-persistence.spec.ts`.

---

## Cenário 5 — Contraste *(FR-030, SC-001)*

```bash
npx vitest run tests/unit/contrast.spec.ts
```

Percorre a lista fechada de pares aprovados nos dois temas. Falha por par reprovado **ou
ausente**.

⚠ **Pendência conhecida**: o par 13 (`--rule-strong` sobre `--bg`) está reprovado na tabela e
exige decisão durante a implementação — ver contracts/tokens.md §2. O teste vai falhar até que
seja resolvido, e isso é intencional.

---

## Cenário 6 — Acessibilidade nos dois temas *(FR-031, SC-002, SC-010)*

```bash
npx vitest run tests/a11y
npx playwright test e2e/keyboard.spec.ts
```

Cinco etapas × dois temas, zero violação séria ou crítica. O fluxo completo concluível só por
teclado, com foco visível em ambos os temas — inclusive no `ThemeControl`, que é elemento novo
no caminho de tabulação do cabeçalho.

---

## Cenário 7 — Nenhuma origem remota *(FR-039, SC-014)*

```bash
npx vitest run tests/unit/no-secrets.spec.ts
npm run test:e2e
```

O unitário recusa `url(http…)`, `@import` externo e `@font-face` apontando para fora. O e2e
escuta as requisições da página e falha se alguma escapar da lista de hosts autorizados.

Conferência manual complementar:

```bash
npm run build && grep -rE 'https?://' dist/assets/*.css
```

**Esperado**: nenhuma ocorrência.

---

## Cenário 8 — Peso da tipografia *(SC-013)*

```bash
npm run build && find dist -name '*.woff2' -exec ls -l {} \;
```

**Esperado**: soma abaixo de 80 KB. O `.woff2` já é comprimido, então o tamanho em disco é a
medida válida.

---

## Cenário 9 — Tela estreita *(FR-023, SC-011)*

```bash
npx playwright test e2e/narrow-viewport.spec.ts
```

Em 320 px, nas cinco etapas e nos dois temas: nenhuma rolagem horizontal da página, todos os
alvos acionáveis, e a goteira colapsada em prefixo sem perder o alinhamento tabular.

---

## Cenário 10 — Fluxo inalterado *(FR-019, FR-035, FR-038, SC-006, SC-012, SC-016)*

```bash
npm test && npm run test:e2e
```

A suíte inteira passa **sem que nenhuma expectativa de comportamento tenha sido alterada**.
Ajuste de seletor e de estrutura em teste é aceitável; mudança no que um teste afirma sobre o
comportamento não é — e um diff que altere asserções de comportamento é sinal de que a feature
saiu do escopo.

Conferência manual: percorrer o fluxo e confirmar que nenhuma etapa foi fundida, dividida,
removida ou reordenada, e que a ordem de tabulação de cada tela é equivalente à anterior, exceto
pela entrada do `ThemeControl` no cabeçalho.

---

## Cenário 11 — Movimento reduzido *(FR-020)*

Com `prefers-reduced-motion: reduce` ativo, percorrer o fluxo.
**Esperado**: a régua do indicador de etapa muda de estado sem animar; nenhuma transição
decorativa; nenhuma informação perdida.
