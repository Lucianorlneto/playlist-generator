# Implementation Plan: Busca Sem Separador e por Título Isolado

**Branch**: `003-flexible-search` (checkout atual: `feat/name-match`) | **Data**: 2026-08-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-flexible-search/spec.md`

## Summary

Tornar pesquisável qualquer linha não vazia, com ou sem separador, e tornar a confiança honesta com o que a linha declarou. O separador deixa de ser condição de admissão e vira uma **informação opcional que aumenta a precisão**; a linha sem separador é consultada inteira, e a linha sem artista é decidida por uma regra de margem em vez de por um teto de pontuação que só existia por artefato de fórmula.

**Abordagem técnica**: três mudanças no domínio puro, nenhuma na superfície de rede.

1. **`InputLine` ganha uma forma declarada** (`explicit` | `free`). O parser deixa de reprovar por ausência de separador; `unparsed` fica reservado para linha sem conteúdo alfanumérico. A forma é o que decide como a linha é consultada e pontuada — não um `if` espalhado ([research §1](./research.md), [data-model §1](./data-model.md)).
2. **A pontuação passa a ter duas vias.** A forma explícita mantém `0,6·título + 0,4·artista`, byte a byte como hoje, porque SC-011 exige zero mudanças de classe nela. A forma livre usa **cobertura assimétrica combinada por média harmônica**, que satisfaz literalmente FR-013: termos do artista presentes contam a favor, sua ausência não conta contra ([research §3](./research.md)).
3. **A confiança de linha sem artista exige margem.** Passar o limiar não basta: a melhor candidata precisa se destacar da segunda por `soloMargin`. É o que separa `Não sei viver sem ter você` — que tem uma dona clara — de `Amor`, que tem cinquenta ([research §5](./research.md)).

Duas descobertas da Fase 0 mudaram o custo da feature em relação ao que a spec previa, ambas para melhor:

**A retentativa é quase de graça no serviço que tem cota.** No YouTube a consulta primária de uma linha explícita já é `"{título} {artista}"` em texto livre, e a consulta de retentativa é a linha inteira — normalizadas, quase sempre a **mesma string**. Uma retentativa idêntica não é retentativa: é a mesma requisição pela segunda vez. Emitindo-a apenas quando a consulta difere de fato, a decisão Q2 ("retentar nos dois serviços") é aplicada uniformemente e o teto prático de linhas do YouTube **não se move** — permanece 60, contra os 36 que a leitura literal de "reservar para todas as linhas" produziria ([research §6](./research.md), [§8](./research.md)).

**O falso corte não precisa de segunda consulta.** `Marília Mendonça - Ao Vivo` é cortada errado, mas no YouTube a segunda consulta seria idêntica à primeira. O reparo é na **pontuação**: uma linha explícita que fica abaixo do piso é reavaliada pela comparação combinada sobre a linha inteira, e prevalece a maior das duas. Custo em rede: zero ([research §7](./research.md)).

E uma descoberta que **não** era desta feature: a estimativa de cota de hoje exclui deliberadamente o fallback de busca (`src/domain/quota/index.ts:62`), então o fallback que já existe pode estourar o que foi prometido ao usuário — em uma lista de 50 linhas, a margem de 10% cobre 7,5 buscas extras e a oitava já ultrapassa. Esta feature fecha esse buraco de passagem, com contagem exata de linhas elegíveis mais teto de execução ([research §8](./research.md)).

## Technical Context

**Language/Version**: TypeScript 5.x em modo `strict`, alvo ES2022 · Node.js ≥ 22 apenas para build e testes — inalterado

**Primary Dependencies**: React 19 · Vite 7 · Tailwind CSS 4.3 · Zustand · **nenhuma dependência nova**. Bibliotecas de correspondência aproximada (Fuse.js, fast-fuzzy) recusadas por escrito em [research §12](./research.md)

**Storage**: `localStorage`/`sessionStorage` como na 002, chaves inalteradas. Esquema do rascunho **v2 → v3** com migração explícita ([contracts/storage.md](./contracts/storage.md))

**Testing**: Vitest + Testing Library + happy-dom · MSW · Playwright · axe-core — inalterado. 6 suítes novas, 6 estendidas, 3 que devem passar **sem alteração** como prova de não regressão ([research §14](./research.md))

**Target Platform**: navegadores modernos de desktop; telas estreitas suportadas — inalterado

**Project Type**: aplicação web estática de página única, sem backend — inalterado

**Performance Goals**: ≥ 2 linhas/s sustentadas (constituição, SC-009), inclusive nas linhas que retentam. A comparação combinada é O(|L|·|T∪A|) sobre conjuntos de ~10 termos — irrelevante ao lado da latência de rede

**Constraints**: **nenhum host novo** — a lista fechada do Princípio II permanece em 6 hosts · nenhum escopo novo · nenhum parâmetro de requisição novo · consumo real de cota ≤ estimativa **por construção** (invariante O4) · teto prático do YouTube preservado em 60 linhas · toda a interface em pt-BR

**Scale/Scope**: 2 provedores · 3 formas de linha (2 no parser + 1 derivada de dados) · 4 motivos de atenção · 2 valores novos de calibração · ~10 arquivos de `src/` alterados, 2 criados

## Constitution Check

_GATE: deve passar antes da Fase 0. Reavaliado após a Fase 1._

Constituição avaliada: **v1.1.0**.

| Princípio / Seção | Exigência | Pré-Fase 0 | Pós-Fase 1 |
| --- | --- | --- | --- |
| **I. Sem Servidor Próprio** | artefato estático, sem endpoint próprio | ✅ | ✅ Nenhum componente novo; toda a lógica nova é aritmética no navegador |
| **II. Superfície de rede fechada** | lista fechada por provedor, escopo mínimo | ✅ | ✅ **Zero hosts novos, zero escopos novos, zero parâmetros novos** ([contracts/search-queries.md §4](./contracts/search-queries.md)). `no-secrets.spec.ts` deve passar **sem alteração** — se quebrar, a implementação saiu do contrato |
| **II. Nenhum segredo** | Client Secret nunca tocado | ✅ | ✅ Nenhum tipo novo tem campo de credencial (W3) |
| **III. Domínio puro, I/O isolado** | regra de negócio em `src/domain/` | ✅ | ✅ Cobertura, margem, elegibilidade e reserva são funções puras. O runner só orquestra e conta orçamento ([contracts/domain-api.md](./contracts/domain-api.md) §3–§7) |
| **IV. Invariante sem teste** | verificação executável para cada regra | ✅ | ✅ 16 verificações mapeadas ([research §14](./research.md)), incluindo 3 suítes de não regressão que não podem ser editadas |
| **V. Nenhuma escrita sem confirmação** | revisão obrigatória; rascunho preservado | ✅ | ✅ **Reforçado**: mais linhas chegam à revisão humana, e a regra de margem existe precisamente para não marcar sozinha o que não é claro (M1, FR-016) |
| **Honestidade sobre limites** | não simular o que a API não oferece | ✅ | ✅ `retry_skipped_quota` é dito como o que é — o app desistiu, não o catálogo — em vez de disfarçado de "não encontrada" ([research §10](./research.md)) |
| **Assimetria entre provedores** | expor a diferença onde ela muda o que o usuário pode fazer | ✅ | ⚠️ Cumprido, mas **expõe uma divergência com SC-010** — ver D1 abaixo |
| **Idioma / Acessibilidade** | pt-BR de `src/i18n/`; teclado, foco, axe-core | ✅ | ✅ Motivo de atenção é **dado**, traduzido por i18n; anunciado a leitor de tela, não só por cor (quickstart cenário 9) |
| **Desempenho** | ≥ 2 linhas/s | ✅ | ✅ `throughput.spec.ts` inalterada; retentativa passa pelo mesmo limitador |
| **Simplicidade proporcional** | dependência nova exige justificativa | ✅ | ✅ **Zero** dependências novas ([research §12](./research.md)) |
| **Armazenamento** | chaves versionadas, migração explícita | ✅ | ✅ v3 com migração idempotente e testada; W5 garante que a migração só reduz linhas inválidas |

**Veredito**: sem violação. **Complexity Tracking permanece vazio.**

## Divergências com a spec — **resolvidas**

> **Situação em 2026-08-06, após `/speckit-analyze`**: as duas divergências que pediam ajuste de redação foram **corrigidas na spec**, cada uma na direção que este plano já adotava. O texto é mantido por rastreabilidade — descreve o que estava errado e como ficou. **Nenhuma ação pendente.**
>
> | # | Resolução registrada na spec |
> | --- | --- |
> | D1 | SC-010 qualificado com "no catálogo musical", e a inaplicabilidade no catálogo de vídeo declarada, remetendo a SC-003 |
> | D2 | FR-010 reescrito para "as linhas efetivamente elegíveis a retentativa"; a fração saiu das Assumptions, que agora listam um único valor de calibração |
>
> A mesma sessão corrigiu duas inconsistências que **não** eram divergências plano×spec: FR-002/FR-008/FR-013 passaram a declarar que (b) e (c) são a mesma forma de análise, distinguidas por dado em tempo de pontuação; e a regra 4 de `contracts/domain-api.md` §3 ganhou a regra 5, que estende o rebaixamento por indício de versão às três formas de linha (FR-015).

Duas divergências e uma correção de premissa. Nenhuma bloqueia a implementação; as duas primeiras pediam ajuste de redação na spec.

### D1 — SC-010 não é atingível no catálogo de vídeo

SC-010 exige que ≥ 60% dos títulos isolados sejam resolvidos automaticamente pela regra de margem, sem indicar provedor. No catálogo de vídeo isso **não é alcançável honestamente**: um título isolado devolve clipe, áudio oficial, ao vivo, cover e versão acelerada, todos com títulos quase idênticos entre si. A margem entre a 1ª e a 2ª candidata é estruturalmente pequena, e forçá-la a abrir significaria escolher o cover em silêncio — exatamente o erro que o limiar de 0,88 da 002 existe para evitar.

Essa é a seção "Assimetria entre provedores" da constituição operando como projetada: a limitação afeta um provedor e precisa ser dita no contexto dele.

**Resolução adotada**: SC-010 é medido no **catálogo musical**. No catálogo de vídeo, a métrica correta é a de SC-003 (a faixa certa está **entre as candidatas**), que não pressupõe resolução automática. **Ação requerida na spec**: qualificar SC-010 com "no catálogo musical" e registrar a expectativa menor no de vídeo.

### D2 — FR-010 pede fração; o plano entrega contagem exata

FR-010 manda a estimativa reservar tentativa extra para "uma fração limitada" das linhas. O plano faz melhor: conta **exatamente** quantas linhas são elegíveis, o que é possível porque a elegibilidade depende só do texto da linha, já analisado antes da estimativa ([research §8](./research.md)).

A contagem exata é superior em todos os aspectos — nunca subestima, não desperdiça orçamento com linhas que comprovadamente não retentam, e dispensa um valor de calibração que a spec previa. Mas é **mais estrita** do que a letra de FR-010, e a diferença é observável: uma lista atipicamente cheia de linhas com `feat.` reserva mais do que qualquer fração fixa reservaria.

**Resolução adotada**: contagem exata (invariantes O4/O5). **Ação requerida na spec**: reescrever FR-010 trocando "fração limitada" por "as linhas efetivamente elegíveis a retentativa", e remover a fração da lista de valores de calibração das Assumptions — sobra apenas `soloMargin`.

### D3 — Premissa corrigida: o falso corte não é problema de consulta

A spec trata o falso corte (`Marília Mendonça - Ao Vivo`) como motivo para a retentativa de FR-009, e usa esse caso para justificar a política. A Fase 0 mostrou que, no catálogo de vídeo, a retentativa desse caso seria **a mesma consulta** — não recupera nada. O problema é de **pontuação**, e é resolvido em [research §7](./research.md) sem custo de rede.

Sem efeito sobre os requisitos: FR-009 continua válido e útil (no Spotify a retentativa é real, e no YouTube ela existe para as linhas cuja consulta de fato difere). É a **justificativa** citada na spec que estava incompleta. Registrado aqui; nenhuma ação obrigatória.

## Project Structure

### Documentation (this feature)

```text
specs/003-flexible-search/
├── plan.md                      # Este arquivo
├── spec.md                      # Especificação da feature
├── research.md                  # Fase 0 — 14 decisões técnicas
├── data-model.md                # Fase 1 — deltas de entidade e invariantes
├── quickstart.md                # Fase 1 — 10 cenários de validação
├── contracts/                   # Fase 1
│   ├── domain-api.md            #   assinaturas dos módulos puros novos e alterados
│   ├── search-queries.md        #   consultas por forma e por provedor; elegibilidade
│   └── storage.md               #   esquema v3 e migração v2→v3
├── checklists/
│   └── requirements.md          # Qualidade da spec (16/16)
└── tasks.md                     # Fase 2 — /speckit-tasks, NÃO criado aqui
```

### Source Code (repository root)

```text
src/
├── domain/                      # puro — o grosso da feature vive aqui
│   ├── parser/index.ts          # ALT: forma declarada; fim do portão de admissão
│   ├── normalize/index.ts       # ALT: tokenSet, tokensMatch, coverage
│   ├── scoring/
│   │   ├── index.ts             # ALT: scoreCombined, artistClaimed, classifyLine
│   │   └── thresholds.ts        # ALT: SOLO_MARGIN por provedor
│   ├── retry/index.ts           # NOVO: planQueries, retryReserveFor
│   ├── dedupe/index.ts          # ALT: chave unificada
│   ├── quota/index.ts           # ALT: retryReserve na fórmula e em maxLinesThatFit
│   ├── providers.ts             # ALT: thresholds.soloMargin
│   └── types.ts                 # ALT: LineShape, AttentionReason, SCHEMA_VERSION 3
├── services/
│   ├── providers/
│   │   ├── searchRunner.ts      # ALT: retentativa, orçamento, classifyLine
│   │   ├── spotify/search.ts    # ALT: consulta por forma
│   │   └── youtube/search.ts    # ALT: consulta por forma
│   └── storage/migrations.ts    # ALT: migrateToV3
├── features/
│   ├── input/InputScreen.tsx    # ALT: dica de separador opcional; previsão de esforço
│   ├── review/MatchRow.tsx      # ALT: exibe o motivo de atenção
│   ├── review/LineEditor.tsx    # ALT: refazer a busca de uma linha só
│   └── quota/                   # ALT: reserva visível na estimativa
└── i18n/pt-BR.ts                # ALT: textos novos

tests/
├── unit/
│   ├── scoring-combined.spec.ts     # NOVO: §3, §4, §7
│   ├── scoring-margin.spec.ts       # NOVO: §5, candidata única
│   ├── retry-eligibility.spec.ts    # NOVO: §6
│   ├── attention-reason.spec.ts     # NOVO: §10, precedência M3
│   ├── parser.spec.ts               # EST: formas e invalidez
│   ├── dedupe.spec.ts               # EST: chave unificada
│   ├── quota.spec.ts                # EST: reserva
│   ├── storage-migration.spec.ts    # EST: v2→v3, W4, W5
│   ├── scoring-reference.spec.ts         # EST c/ fixtures novas; casos antigos INTOCADOS
│   ├── scoring-youtube-reference.spec.ts # INALTERADA — prova de SC-005/SC-011
│   ├── throughput.spec.ts                # INALTERADA
│   └── no-secrets.spec.ts                # INALTERADA — prova de "zero host novo"
├── integration/
│   └── youtube-retry-budget.spec.ts # NOVO: SC-007, teto de execução
├── fixtures/                        # EST: as mesmas faixas nas três formas (§13)
└── e2e/flexible-search.spec.ts      # NOVO: fluxo completo sem separador
```

**Structure Decision**: estrutura inalterada — a feature não introduz camada nem diretório de topo. O único módulo novo, `src/domain/retry/`, entra como irmão de `scoring/` e `quota/` porque a elegibilidade de retentativa é regra de negócio pura: depende só do texto da linha e é decidida antes de qualquer I/O. Colocá-la em `services/` violaria o Princípio III e a tornaria intestável sem mock.

## Ordem de implementação sugerida

Dependências reais entre as mudanças, para orientar `/speckit-tasks`:

1. **`types.ts` + `parser/`** — nada compila sem a forma declarada.
2. **`normalize/`** (`coverage`, `tokensMatch`) — base de tudo em pontuação.
3. **`scoring/`** (`scoreCombined`, `artistClaimed`, `classifyLine`) + **`fixtures`** — aqui acontece a calibração de `soloMargin`, e ela precisa das fixtures das três formas.
4. **`retry/`** e **`quota/`** — independentes de (3), podem ir em paralelo.
5. **`searchRunner`** + adaptadores — junta (3) e (4).
6. **`migrations.ts`** — depende de (1); pode ir em paralelo a (5).
7. **Interface e i18n** — depende de (5) para ter o motivo de atenção a exibir.
8. **E2E e a11y** — por último, sobre o fluxo já montado.

O passo (3) é o de risco: se a calibração não fechar SC-004 e SC-010 simultaneamente, a saída mapeada é a opção B do D1 da spec (nunca automática para linha sem artista), que elimina `soloMargin` e simplifica `classifyLine`. Vale decidir isso antes de investir na interface.

## Complexity Tracking

> Preenchido apenas se o Constitution Check tiver violações a justificar.

**Vazio** — nenhuma violação. Zero dependências novas, zero hosts novos, zero exceções a princípio.
