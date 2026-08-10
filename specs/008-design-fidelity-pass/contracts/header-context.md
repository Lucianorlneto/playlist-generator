# Contrato — Linha de contexto do cabeçalho

Definição normativa de FR-009 a FR-013. Onde este documento e o código divergirem, a
divergência é defeito de um dos dois — nunca licença para duplicar a regra.

Módulo: `src/domain/header/index.ts` · Consumidor: `src/app/StepContextLine.tsx` ·
Portão: `tests/unit/header-context.spec.ts`

---

## 1. A tabela, conferida nó a nó

Cada linha registra o nó do arquivo de design de onde a forma foi lida. O slot chama-se
`Greeting` no arquivo em todas as telas — o nome é histórico e não implica saudação.

| Etapa / fase | Nó de origem | Forma | Conteúdo |
| --- | --- | --- | --- |
| Configuração | `Sim0L` | `absent` | — |
| Destinos | `uy2ns > … > Greeting` | `greeting` | "Oi, {primeiro nome}" + "· vamos levar suas músicas pra casa" |
| Entrada | `okw1h > … > Greeting` | `greeting` | "Oi, {primeiro nome}" + "· hora de colar sua lista" |
| Serviço · conexão | `dIPW6 > … > Greeting` | `service` | "{Serviço} — {posição} de {total}" |
| Serviço · reconexão | `DP6mq > … > Greeting` | `service` | "{Serviço} — {posição} de {total}" |
| Serviço · busca | `dIPW6` | `service` | "{Serviço} — {posição} de {total}" |
| Serviço · revisão | `dIPW6` | `service` | "{Serviço} — {posição} de {total}" |
| Serviço · orçamento | `TSwx6 > … > Greeting` | `service` | "{Serviço} · Conferindo o orçamento" |
| Serviço · criação e resultado | `C13Hj`, `zCaeY`, `SjphR` | `service` | "{Serviço} · Concluído" |
| Resumo | `w1fTC` | `absent` | — |

**As duas ausências são normativas.** A implementação atual exibe uma saudação nas cinco
etapas, e as duas telas em que a linha não deve existir são tão erradas quanto as três em
que ela existe com o texto trocado. Um teste que só verificasse presença passaria com o
defeito intacto — `header-context.spec.ts` verifica `kind === 'absent'` explicitamente.

---

## 2. Mapeamento das fases da máquina de execução

`src/domain/run/machine.ts` tem mais fases do que o arquivo de design desenha telas. O
mapeamento é total — nenhuma fase fica sem linha:

| Fase | Linha |
| --- | --- |
| `pending` | posição na fila |
| `connect` | posição na fila |
| `awaiting_reauth` | posição na fila |
| `search` | posição na fila |
| `review` | posição na fila |
| `estimate` | "· Conferindo o orçamento" |
| `creating` | "· Concluído" |
| execução com `outcome !== null` | "· Concluído" |

`creating` recebe a linha de conclusão porque é a tela `SjphR` do arquivo — "Criando
playlist no Spotify…" — e ali o slot já mostra "Spotify · Concluído". A leitura é que a
linha nomeia **o cartão em que se está**, não o instante exato da operação.

---

## 3. Degradação

| Situação | Comportamento | Requisito |
| --- | --- | --- |
| Sem sessão em nenhum provedor | `firstName: null` → o componente exibe **só** o complemento, sem vírgula solta nem espaço duplo | FR-011 |
| `displayName` ausente, vazio ou só espaços | idem | FR-011 |
| `displayName` de um termo só | o primeiro nome é o termo inteiro | Premissa |
| Dois provedores conectados com contas diferentes | usa a conta do primeiro provedor de `PROVIDER_ORDER` com sessão, como hoje | Borda da spec |
| `total === 1` | "{Serviço}", sem " — 1 de 1" | FR-012 |

**Nunca um nome inventado, nunca um espaço vazio.** As duas alternativas que a 007 já
descartou continuam descartadas; o que muda é a forma da degradação — de "Olá" sozinho
para o complemento sozinho.

---

## 4. Apresentação

| Fragmento | Token de tinta | Requisito |
| --- | --- | --- |
| Primeiro nome | `--accent-text` (`text-accent-text`) | FR-010 |
| Complemento | `--ink-muted` (`text-ink-muted`) | FR-010 |
| Linha de serviço, inteira | `--ink-muted` | Arquivo: `#8A94A6` |

O arquivo desenha o nome em `#F5B301`, que é `--accent` cheio. **A implementação usa
`--accent-text`**: em tema claro `--accent` dá 1,73:1 como texto e é preenchimento, nunca
tinta — decisão da 007 registrada em `docs/style-guide.md` e imposta por
`tp/no-raw-visual-values`. No tema escuro os dois tokens têm o mesmo valor, então a tela
escura fica idêntica ao arquivo; a divergência existe apenas no tema claro, que o arquivo
não define.

Corpo tipográfico: `--text-meta`, o degrau já usado pelo `Greeting` atual (arquivo: 13,5
contra 14,5 da descrição da etapa — a linha é menor que a descrição, e o degrau da escala
que corresponde a isso é `meta`).

---

## 5. Acessibilidade

- A linha é um `<p>` com texto real, **anunciado** em todas as suas formas.
- Onde o arquivo repete a posição no cabeçalho do cartão de fase — `TSwx6 > Budget Card >
  Card Header`, `C13Hj > Success Card > Card Header` —, a repetição é **visual**:
  `QueueIndicator` renderizado ali com `aria-hidden`. A posição é anunciada uma vez só
  (FR-013). Ver [`research.md` §R2](../research.md).
- O `role="status"` passa para o `StepContextLine`, **apenas** na forma `service`: é ele o
  elemento anunciado, e é ele que muda quando o serviço corrente troca sem transição de
  etapa. As formas `absent` e `greeting` não são região viva — uma saudação anunciada a
  cada troca de etapa é ruído, não informação.
- Cada forma da união renderiza um elemento próprio, com `key` distinta, para que a região
  viva seja criada e destruída em vez de reaproveitada — região viva reaproveitada pelo
  React não dispara o anúncio.
- As cópias visuais nos cartões de orçamento e de resultado são `aria-hidden`, e o
  `QueueIndicator` deixa de carregar `role="status"` e `aria-label` quando renderizado ali.

---

## 6. Portões

| Verificação | Onde | Requisito |
| --- | --- | --- |
| As dez linhas da tabela §1, uma a uma | `tests/unit/header-context.spec.ts` | FR-009 |
| Ausência em Configuração e Resumo, verificada como ausência | idem | FR-009, SC-004 |
| Recorte do primeiro nome, incluindo termo único e espaços em excesso | idem | FR-010 |
| Degradação sem sessão e sem nome | idem | FR-011 |
| Omissão da posição com destino único | idem | FR-012 |
| Cobertura total das fases de `RunPhase` (nenhuma fase sem linha) | idem, por exaustão do tipo | FR-009 |
| Tinta do nome e do complemento | `tests/components/` | FR-010 |
| Posição anunciada uma única vez | `tests/a11y/steps.spec.tsx` | FR-013 |
