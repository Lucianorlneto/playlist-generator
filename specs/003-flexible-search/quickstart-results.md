# Resultado da validação — Busca Sem Separador e por Título Isolado

**Feature**: `003-flexible-search` · **Data**: 2026-08-07 · **Branch**: `feat/name-match`

Execução dos 10 cenários de [quickstart.md](./quickstart.md), como foi feito na 001 e na 002.

## Portão local

| Comando | Resultado |
| --- | --- |
| `npm run lint` | ✅ sem apontamentos |
| `npm run typecheck` | ✅ sem erros |
| `npm test` | ✅ **611 testes**, 52 arquivos |
| `npm run test:e2e` | ✅ **56 testes**, 2 viewports (desktop e 375 px) |

---

## Ressalva sobre o método, declarada antes dos resultados

Sete dos dez cenários foram validados por **verificação executável equivalente** —
o mesmo comportamento, exercitado por teste automatizado contra provedores
mockados, e não por operação manual da interface em um navegador.

Três itens **não foram executados** e estão marcados como tal: a medição de
usabilidade de SC-008, a passagem manual com leitor de tela do cenário 9, e a
atualização real de uma instalação com rascunho antigo do cenário 8. Os três
exigem um humano operando o navegador, e nenhum deles tem substituto honesto em
teste automatizado. Registrá-los como aprovados seria falso.

---

## Cenário 1 — Linha sem separador é buscada (FR-001, US1)

✅ **Passa** — `tests/integration/search-free-shape.spec.ts` (9/9).

Uma lista em que nenhuma linha tem separador produz candidatas nos **dois**
provedores, e a faixa vencedora é a mesma da forma explícita equivalente
(SC-001). O portão de `parseLine` saiu: as linhas chegam com
`shape: 'free'` e `parseStatus: 'parsed'`.

Verificado também que `nao sei viver sem ter voce cpm 22` resolve **sozinha** —
a linha reivindica `CPM 22` na candidata e é tratada como se tivesse declarado o
artista (research §4).

## Cenário 2 — Acento e caixa são irrelevantes (SC-006)

✅ **Passa** — `tests/unit/reference-shapes.spec.ts` (9/9) e
`tests/unit/dedupe.spec.ts` (11/11).

Medido contra as **50 faixas** da lista de referência escritas em quatro formas:
100% delas dão o mesmo desfecho e a **mesma pontuação** (até 10 casas decimais)
com e sem acento, em caixa baixa.

A chave de duplicata unificada atravessa as duas formas: `Zoio de Lula - Charlie
Brown Jr` e `zoio de lula charlie brown jr` colapsam na mesma chave (FR-020). O
limite conhecido — `feat.` extraído na forma explícita não colapsa com a livre —
está registrado em teste, não escondido.

## Cenário 3 — Título isolado com candidata dominante (US2, FR-014)

✅ **Passa** — `tests/unit/scoring-margin.spec.ts` (16/16) e
`tests/unit/attention-reason.spec.ts` (12/12).

Com margem larga sobre a segunda candidata, o item sai **Confiante** e marcado.
Sem margem, sai **Incerta** com `attentionReason: 'no_artist_ambiguous'` — e a
revisão diz por extenso *por que* pede atenção, não apenas deixa desmarcado.

Candidata única vira `uncertain` (FR-014b): não há segunda contra a qual medir.

## Cenário 4 — Título genérico não é escolhido sozinho (SC-004, FR-016)

✅ **Passa** — `tests/unit/reference-shapes.spec.ts` e a calibração de
[research §5](./research.md).

Medição contra `reference-titles-30.json` na margem adotada (Spotify `0,10`):

| | |
| --- | --- |
| Resolvidas automaticamente **e corretas** | 20 de 30 (**67%**) |
| Resolvidas automaticamente e **erradas** | **0** |
| Enviadas para escolha manual | 10 de 30 |

SC-004 (teto: zero erros) e SC-010 (piso: ≥ 60% automático no catálogo musical)
fecham **juntos**, com folga. A opção B do D1 da spec não foi necessária, e a
regra de margem permanece em `classifyLine`.

⚠️ **Limite desta medição**, registrado em research §5: o resultado é insensível
ao valor da margem em toda a faixa varrida (0,02 a 0,30), porque a fixture é
bimodal — títulos genéricos empatam em 0 e distintivos abrem ~1. A medição
sustenta que a regra funciona e que o valor adotado satisfaz os critérios; **não**
sustenta que 0,10 seja ótimo.

Verificado à parte que, nas 50 faixas de referência, nenhuma linha só-título
escolhe sozinha o tributo de mesmo título, e nenhuma versão de karaokê é marcada
como Confiante em forma alguma.

## Cenário 5 — Falso corte recuperado sem gastar cota (research §7)

✅ **Passa** — `tests/unit/scoring-combined.spec.ts` (21/21) e
`tests/integration/search-retry.spec.ts` (12/12).

`Marília Mendonça - Ao Vivo` é cortada em título `Marília Mendonça` / artista
`Ao Vivo`, pontua **abaixo do piso** pela via declarada, e é recuperada pela
comparação combinada sobre a linha inteira.

No catálogo de vídeo, o número de buscas emitidas para essa linha é **1**, não 2:
a retentativa seria a mesma consulta normalizada e é descartada antes de custar
unidade alguma (research §6). Verificado por contagem de requisições no mock.

Verificado também o contrapeso de SC-011: uma linha explícita **acima** do piso
não é reavaliada, então nenhuma linha hoje corretamente classificada pode mudar
de classe.

## Cenário 6 — Não regressão do formato explícito (SC-005, SC-011)

✅ **Passa** — `scoring-reference.spec.ts`, `scoring-youtube-reference.spec.ts`,
`throughput.spec.ts` e `no-secrets.spec.ts` passam **sem uma linha alterada**
(confirmado por `git diff --stat`: vazio).

São a prova de não regressão de SC-005, SC-009 e SC-011, e de "zero host novo".
A cláusula de SC-009 que `throughput.spec.ts` não exercita — vazão **com**
retentativa — está em `tests/unit/throughput-retry.spec.ts`, suíte separada, para
não tocar na intocável. Ela mede o pior caso (todas as linhas retentando) e
confirma o piso de 2 linhas/s nos dois provedores.

## Cenário 7 — Reserva de retentativa e teto (SC-007, FR-010a)

✅ **Passa** — `tests/integration/youtube-retry-budget.spec.ts` (9/9) e
`tests/unit/quota.spec.ts` (25/25).

Forçado o cenário em que **todas** as linhas retentariam: o número de chamadas de
busca é exatamente `N + retryReserve`, e nunca mais. Com orçamento parcial, o teto
é respeitado exatamente; com orçamento zero, nenhuma retentativa sai.

Verificado com 20 linhas em paralelo e teto 5 que o decremento é sequencialmente
consistente — 25 buscas, não 25+n. É o ponto em que uma leitura concorrente do
saldo estouraria o limite sem ninguém notar.

A linha barrada pelo teto recebe `attentionReason: 'retry_skipped_quota'`, **não**
`not_found` puro (invariante M2). A linha inelegível, que não retentaria de
qualquer forma, recebe `not_found` — a distinção não é decorativa: ela muda o que
o usuário deve fazer.

Confirmado que omitir a reserva reproduz **exatamente** os números anteriores da
fórmula de cota, e que com reserva zero o teto prático de linhas do YouTube não
se move.

## Cenário 8 — Rascunho antigo volta melhor (research §11, W5)

✅ **Passa em teste** — `tests/unit/storage-migration.spec.ts` (29/29).

Um rascunho v2 com linhas inválidas por falta de separador volta com essas linhas
**válidas e buscáveis**, na forma livre. A invariante W5 é verificada
diretamente: a migração nunca aumenta o número de linhas inválidas. Escolhas de
faixa já feitas permanecem intactas, e a execução concluída atravessa a migração
byte a byte (`002/SC-018`).

Também verificados: idempotência (W4), cadeia v1→v2→v3 sequencial, rascunho
corrompido descartado com aviso e sem exceção, versão desconhecida descartada em
vez de lida às cegas.

⚠️ **Não executado**: a atualização real de uma instalação existente, com rascunho
gravado antes desta feature e reaberto depois do deploy. O teste cobre a
transformação; ele não cobre o ciclo de vida real de bootstrap em um navegador
com dados antigos de verdade.

## Cenário 9 — Acessibilidade dos motivos de atenção

✅ **Parcial** — `tests/a11y/steps.spec.tsx` (13/13), zero violações no axe-core.

A revisão com lista de títulos isolados e os quatro motivos de atenção passa sem
violação séria ou crítica. O motivo é **texto de verdade** na árvore acessível,
não `aria-label` de ícone nem indicação por cor.

**Defeito real encontrado e corrigido por este cenário**: `VersionHintBadge`
usava `aria-label` em um `<span>` — `role="generic"`, para o qual o ARIA proíbe
nome acessível. O atributo era ignorado por parte dos leitores de tela, ou seja,
o selo prometia acessibilidade que não entregava. Substituído por texto
`sr-only`. O defeito é anterior a esta feature e passou despercebido porque
nenhum teste renderizava a revisão com indício de versão.

⚠️ **Não executado**: a passagem manual com leitor de tela real. O axe-core
verifica conformidade estrutural; ele não substitui ouvir o que o VoiceOver ou o
NVDA anunciam de fato.

## Cenário 10 — Ponta a ponta sem separador

✅ **Passa** — `e2e/flexible-search.spec.ts`, 4 execuções (2 testes × 2 viewports).

Fluxo completo com todos os provedores mockados: colar uma lista **sem separador
algum**, buscar, ver as duas linhas com artista embutido resolverem sozinhas, ler
o motivo de atenção do título genérico, escolher manualmente entre as candidatas,
confirmar e criar a playlist com as três linhas.

O segundo teste confirma o contrapeso de FR-011: `---` e `🎵` continuam recusados,
antes de custar qualquer requisição.

`e2e/narrow-viewport.spec.ts` ganhou a revisão com motivo de atenção em 375 px —
o texto mais longo da tela nova — sem rolagem horizontal e sem empurrar os
controles para fora da largura.

---

## SC-008 — medição manual de usabilidade

❌ **Não executado.**

SC-008 exige que 20 títulos isolados sejam revisados e confirmados em menos de 4
minutos. É uma métrica de **usabilidade**, medida com um humano cronometrado
operando a interface, e não tem verificação automatizável honesta: um teste de
Playwright mede a velocidade do Playwright, não a de uma pessoa lendo candidatas
e decidindo entre elas.

O que a implementação oferece a favor do critério, sem provar que ele é atingido:
a escolha é um clique por linha na lista de alternativas já aberta, o motivo de
atenção é exibido junto do item, e nenhuma linha exige digitação.

**Pendência declarada**: medir com um usuário real antes de considerar SC-008
satisfeito.

---

## Resumo

| Cenário | Situação |
| --- | --- |
| 1 — Linha sem separador é buscada | ✅ verificado por teste |
| 2 — Acento e caixa irrelevantes | ✅ verificado por teste |
| 3 — Título isolado com candidata dominante | ✅ verificado por teste |
| 4 — Título genérico não escolhido sozinho | ✅ verificado por teste, com limite registrado |
| 5 — Falso corte recuperado sem cota | ✅ verificado por teste |
| 6 — Não regressão do formato explícito | ✅ suítes intocadas passam |
| 7 — Reserva e teto de retentativa | ✅ verificado por teste |
| 8 — Rascunho antigo volta melhor | ✅ em teste · ⚠️ atualização real não executada |
| 9 — Acessibilidade dos motivos | ✅ axe-core limpo · ⚠️ leitor de tela real não executado |
| 10 — Ponta a ponta sem separador | ✅ verificado por teste |
| SC-008 — esforço de revisão < 4 min | ❌ não executado (métrica de usabilidade) |
