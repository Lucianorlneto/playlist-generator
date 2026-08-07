# Quickstart — Validação da Busca Flexível

**Feature**: `003-flexible-search` · **Fase**: 1

Como executar e como provar que a feature funciona. Detalhes de assinatura estão em [contracts/domain-api.md](./contracts/domain-api.md); detalhes de entidade em [data-model.md](./data-model.md).

---

## Pré-requisitos

Os mesmos da 002 — nada novo:

```bash
npm install
npm run dev          # http://localhost:5173
```

Client ID de pelo menos um provedor cadastrado pela própria interface. Nenhuma variável de ambiente, nenhum segredo, nenhum servidor.

## Portão local

```bash
npm run lint && npm run typecheck && npm test
npm run test:e2e     # obrigatório: esta feature altera o fluxo de busca
```

---

## Cenário 1 — Linha sem separador é buscada (FR-001, US1)

1. Etapa de entrada, colar exatamente:

   ```text
   nao sei viver sem ter voce cpm 22
   Não sei viver sem ter você - CPM 22
   ```

2. Iniciar a busca no Spotify.

**Esperado**: as **duas** linhas produzem candidatas, e a faixa vencedora é a mesma nas duas. Hoje a primeira linha nem chega a ser buscada.

**Como falha**: se a primeira linha aparecer como inválida, o portão de `parseLine` não foi removido (research §1).

---

## Cenário 2 — Acento e caixa são irrelevantes (SC-006)

Colar as quatro formas da mesma faixa:

```text
Não Sei Viver Sem Ter Você - CPM 22
nao sei viver sem ter voce - cpm 22
Não sei viver sem ter você cpm 22
nao sei viver sem ter voce cpm 22
```

**Esperado**: quatro linhas, mesma faixa vencedora, e **três** delas marcadas como duplicata da primeira (FR-020 — a chave unificada atravessa as duas formas).

---

## Cenário 3 — Título isolado com candidata dominante (US2, FR-014)

```text
Não sei viver sem ter voce
```

**Esperado**: a faixa correta vence. Se a margem sobre a segunda candidata for ≥ `soloMargin`, o item sai **Confiante** e já marcado. Caso contrário, sai **Incerta** com o motivo "sem artista informado".

**O que observar**: a revisão precisa dizer *por que* o item pede atenção — não basta ficar desmarcado (FR-017).

---

## Cenário 4 — Título genérico não é escolhido sozinho (SC-004, FR-016)

```text
Amor
Fire
```

**Esperado**: nenhum dos dois é marcado por padrão. Motivo exibido: sem artista informado e sem candidata dominante. As 5 alternativas estão disponíveis para escolha manual.

**Como falha**: se qualquer um sair Confiante e marcado, a margem está frouxa demais — recalibrar `soloMargin` para cima e reexecutar `scoring-reference.spec.ts`.

---

## Cenário 5 — Falso corte é recuperado sem gastar cota (research §7)

```text
Marília Mendonça - Ao Vivo
```

**Esperado**: a linha é cortada em título `Marília Mendonça` / artista `Ao Vivo`, pontua mal pela via declarada, e é **recuperada** pela comparação combinada sobre a linha inteira. A faixa aparece entre as candidatas em vez de "não encontrada".

**O que observar no YouTube**: o número de buscas emitidas para esta linha é **1**, não 2 — a retentativa seria a mesma consulta e é pulada (research §6). Conferir no painel de rede ou no consumo de cota registrado.

---

## Cenário 6 — Não regressão do formato explícito (SC-005, SC-011)

```bash
npm test -- scoring-reference scoring-youtube-reference
```

**Esperado**: as duas suítes passam **sem alteração de fixture**. Nenhuma linha da lista de referência muda de classe. É o critério que impede a feature de ser uma troca em vez de um ganho.

---

## Cenário 7 — Reserva de retentativa e teto (SC-007, FR-010a)

1. Preparar uma lista de ~30 linhas para o YouTube, várias com `feat.` no título (elegíveis a retentativa, research §6).
2. Observar a estimativa antes de iniciar: ela deve incluir a reserva.
3. Executar até o fim.

**Esperado**: o consumo real registrado **nunca** ultrapassa a estimativa apresentada. Ao esgotar a reserva, as linhas seguintes que retentariam chegam à revisão com o motivo "não tentei de novo — reserva de cota esgotada", distinto de "não encontrada".

**Verificação automatizada**: `tests/integration/youtube-retry-budget.spec.ts` força o cenário em que **todas** as linhas retentariam e assere que o número de chamadas de busca é exatamente `N + retryReserve`.

---

## Cenário 8 — Rascunho antigo volta melhor (research §11, W5)

1. Antes de atualizar, criar um rascunho com linhas sem separador (que ficam inválidas na versão antiga).
2. Atualizar a aplicação.
3. Reabrir.

**Esperado**: o rascunho é recuperado, e as linhas antes inválidas aparecem **válidas e buscáveis**. Escolhas de faixa já feitas em outras linhas permanecem intactas.

---

## Cenário 9 — Acessibilidade dos motivos de atenção (Princípio: Acessibilidade)

```bash
npm test -- tests/a11y
```

Manualmente: navegar a revisão só pelo teclado com uma lista de títulos isolados. O motivo de atenção precisa ser **anunciado por leitor de tela**, não apenas indicado por cor ou ícone. Nenhuma violação séria ou crítica no axe-core.

---

## Cenário 10 — Ponta a ponta sem separador

```bash
npm run test:e2e -- flexible-search
```

Cobre o fluxo completo com todos os provedores mockados: colar lista sem separador, buscar, escolher manualmente entre candidatas de um título isolado, confirmar e criar a playlist. Nenhum teste toca a rede real (Princípio IV).
