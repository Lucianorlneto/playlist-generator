# Implementation Plan: Pular sem tela fantasma e recomeçar de qualquer ponto

**Branch**: `006-skip-and-reset` (checkout atual: `main`) | **Data**: 2026-08-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-skip-and-reset/spec.md`

## Summary

Fazer com que pular um serviço **seja** o ato de sair dele — encerrar, avançar a
fila e chegar à tela certa em um clique — e dar ao usuário um comando de
recomeço alcançável de qualquer etapa.

**A Fase 0 confirmou o defeito relatado e encontrou um agravante que a spec não
descrevia.** Medido com sonda no Vitest, contra o código real:

**O defeito, exatamente como relatado.** `dispatchRun({ type: 'skipped' })` só
encerra a execução; a fila não anda, e `ServiceStep` continua exibindo a mesma
execução — que agora é `finished`, e portanto cai no ramo `ResultScreen`. Com
`result === null`, o título é "Criando playlist no Spotify…"
([research §1](./research.md)).

**O agravante: com destino único, o único botão oferecido leva a uma tela em
branco.** No ramo `result === null`, "Começar uma nova playlist" faz
`advance()` + `goToStep('service')` e **não** chama `resetWork()` — ao
contrário do botão de mesmo rótulo do ramo concluído. `currentIndex` vai a
`order.length`, `ServiceStep` devolve `null`, e a sonda mede
`container.innerHTML === ''`: sem cabeçalho, sem botão, sem saída, com o
trabalho preservado e inalcançável. Só recarregando ([research §2](./research.md)).
A spec não muda — FR-004 e FR-007 já proíbem os dois passos —, mas a prioridade
sim: não é uma tela confusa, é um beco.

**Abordagem técnica**: duas funções puras, uma ação de store e três consertos de
pré-requisito.

1. **`exitAfterSkip(queue, provider)`** em `src/domain/run/exit.ts` — pura,
   total, três estados: `next`, `summary`, `discard`. É onde a pergunta "para
   onde o usuário vai?" passa a ser respondida, com teste sem DOM
   ([contracts/flow-contract §1](./contracts/flow-contract.md)).
2. **`skipService(provider)`** no `runSlice` — cancela, despacha, avança,
   navega. As **seis** chamadas espalhadas hoje passam a apontar para ela:
   FR-008 exige comportamento idêntico nas quatro fases, e seis cópias de uma
   sequência de quatro passos é como uma delas acaba diferente
   ([research §4](./research.md)).
3. **`hasWork`** em `src/domain/work.ts` — extraído do predicado já embutido em
   `restoreDraft`, agora fonte única de "há o que descartar" (FR-021).

Três consertos que não estavam na spec e sem os quais os requisitos não se
sustentam:

**`resetWork` e `discardDraft` largam a busca em voo.** Medido:
`controller.signal.aborted === false` depois de `resetWork()`, com o
controlador descartado do store — ninguém mais pode abortá-lo. A busca segue
gastando cota de um trabalho jogado fora. Hoje é raro, porque o descarte só é
alcançável pelo banner de rascunho; **o botão global de recomeço torna esse
caminho comum**, alcançável de dentro da própria tela de busca. FR-022 depende
disso ([research §6](./research.md)).

**Pular durante a busca também não cancela nada.** O botão de pular é oferecido
durante `search`, e as requisições continuam saindo depois da desistência. FR-011
depende disso ([research §5](./research.md)).

**O foco não se move entre serviços.** `stepToken` só é incrementado quando a
*etapa* muda, e passar do Spotify para o YouTube acontece dentro da etapa
`service`. Sonda: `stepToken: 0`. Quem usa leitor de tela troca de serviço sem
que nada seja anunciado — hoje, não só depois desta feature. FR-024 é uma linha
em `advance()` ([research §7](./research.md)).

O que **não** muda é o que mais importa: `reduceRun` fica intocado. O defeito
nunca esteve no redutor — ele já encerrava a execução corretamente. Faltava
alguém agir sobre o encerramento.

## Technical Context

**Language/Version**: TypeScript 5.9 em modo `strict`, alvo ES2022 · Node.js ≥ 22 só para build e testes — inalterado

**Primary Dependencies**: React 19 · Vite 7 · Tailwind CSS 4.3 · Zustand 5 · **nenhuma dependência nova**. A confirmação usa o `Dialog` sobre `<dialog>` nativo que a 004 já trouxe ([research §8](./research.md))

**Storage**: `localStorage`/`sessionStorage` com as chaves da 004. **`SCHEMA_VERSION` não muda, nenhum campo novo é persistido e não há migração** — `FlowExit` e `hasWork` são derivados ([data-model §5](./data-model.md), [flow-contract §6](./contracts/flow-contract.md))

**Testing**: Vitest + Testing Library + happy-dom · MSW · Playwright · axe-core — inalterado. Linha de base medida: **69 arquivos, 902 testes, verdes**. 21 verificações mapeadas ([research §12](./research.md)), das quais **5 suítes devem passar sem edição** como prova de não regressão

**Target Platform**: navegadores modernos de desktop; telas estreitas suportadas — inalterado

**Project Type**: aplicação web estática de página única, sem backend — inalterado

**Performance Goals**: ≥ 2 linhas/s sustentadas — inalterado. A feature só **reduz** tráfego: cancela buscas que hoje seguem até o fim depois da desistência

**Constraints**: **zero hosts novos** (a lista fechada segue nos 6) · zero escopos novos · zero parâmetros de requisição novos · nenhuma escrita em conta por nenhum caminho desta feature · nenhum descarte de trabalho sem confirmação explícita · toda a interface em pt-BR

**Scale/Scope**: 2 funções puras novas · 1 ação de store nova · 3 ações existentes ajustadas · 2 componentes novos · 8 chaves de texto novas, **nenhum texto existente alterado** · ~10 arquivos de `src/` alterados, 4 criados · 0 entidades novas

## Constitution Check

_GATE: deve passar antes da Fase 0. Reavaliado após a Fase 1._

Constituição avaliada: **v1.1.0**.

| Princípio / Seção | Exigência | Pré-Fase 0 | Pós-Fase 1 |
| --- | --- | --- | --- |
| **I. Sem Servidor Próprio** | artefato estático, sem endpoint próprio | ✅ | ✅ Nenhum componente de servidor. A feature é inteiramente navegação e estado local |
| **II. Superfície de rede fechada** | lista fechada por provedor, escopo mínimo | ✅ | ✅ **Zero hosts, escopos e parâmetros novos** ([flow-contract §5](./contracts/flow-contract.md)). `no-secrets.spec.ts` passa **sem edição** |
| **II. Provedor não selecionado não recebe requisição** | — | ✅ | ✅ **Reforçado**: o cancelamento de §5 e §6 da pesquisa faz parar tráfego que hoje continua depois de o usuário desistir do destino |
| **II. Nenhum segredo** | Client Secret nunca tocado | ✅ | ✅ `FlowExit` e `hasWork` são derivados da fila e do texto; nenhum novo dado persistido, nenhum campo novo onde um token caberia |
| **III. Domínio puro, I/O isolado** | regra de negócio em `src/domain/` | ✅ | ✅ As duas decisões da feature — para onde ir, e se há o que descartar — são funções puras em `src/domain/`. `skipService` orquestra e não decide; os componentes só chamam |
| **IV. Invariante sem teste não é invariante** | verificação executável para cada regra | ✅ | ✅ 21 verificações mapeadas, cobrindo cada FR ([research §12](./research.md)). A tabela de verdade de `exitAfterSkip` é percorrida inteira por V0 |
| **V. Nenhuma escrita sem confirmação** | revisão obrigatória; nada escrito sem confirmar | ✅ | ✅ **Reforçado**: nenhum caminho desta feature emite escrita, e V7 conta requisições no MSW para provar |
| **V. Rascunho apagado só por sucesso ou descarte** | — | ⚠️ | ⚠️ Cumprido **com uma decisão de produto registrada** — ver D1 |
| **Honestidade sobre limites** | não simular o que a API não oferece | ✅ | ✅ **Reforçado**: a tela de criação deixa de ser exibida para um serviço em que nada será criado. O defeito era literalmente a interface afirmando um trabalho inexistente |
| **Assimetria entre provedores** | expor a diferença onde ela muda o que o usuário pode fazer | ✅ | ✅ Nada nesta feature é específico de provedor. `exitAfterSkip` opera sobre a fila e não consulta capacidades — a simetria aqui é real |
| **Armazenamento versionado** | mudança incompatível exige migração ou descarte seguro | ✅ | ✅ `SCHEMA_VERSION` inalterado, nenhum campo novo. Um estado herdado que deixa de ser produzível é tratado por decisão registrada, não por migração ([flow-contract §6](./contracts/flow-contract.md)) |
| **Idioma pt-BR, texto em `src/i18n/`** | — | ✅ | ✅ 8 chaves novas, **nenhum valor existente alterado**. `i18n-stability.spec.ts` passa sem regravação. `tp/no-ui-text-literals` cobre o resto |
| **Acessibilidade** | teclado, foco, leitor de tela, axe-core | ✅ | ✅ **Reforçado**: FR-024 conserta uma falha de foco que já existe hoje na transição entre serviços ([research §7](./research.md)) |
| **Simplicidade proporcional** | dependência nova exige justificativa escrita | ✅ | ✅ Nenhuma dependência nova. `Dialog` nativo reusado; `window.confirm` recusado por escrito ([research §8](./research.md)) |
| **Spec antes de código** | mudança de comportamento passa por spec | ✅ | ✅ Spec e plano precedem o código. O agravante encontrado na Fase 0 não exigiu emenda: FR-004 e FR-007 já o proibiam |

Uma única entrada ⚠️, registrada em Complexity Tracking com a alternativa mais
simples e o motivo da recusa.

## Project Structure

### Documentation (this feature)

```text
specs/006-skip-and-reset/
├── plan.md                     # Este arquivo
├── spec.md
├── research.md                 # Fase 0 — medições contra o código real
├── data-model.md               # Fase 1
├── quickstart.md               # Fase 1
├── contracts/
│   ├── flow-contract.md        # exitAfterSkip, hasWork, skipService, descarte
│   └── ui-contract.md          # botão global, diálogos, foco, textos
├── checklists/requirements.md
└── tasks.md                    # /speckit-tasks — NÃO criado aqui
```

### Source Code (repository root)

```text
src/
├── domain/
│   ├── work.ts                     # NOVO — hasWork, fonte única de "há trabalho"
│   └── run/
│       └── exit.ts                 # NOVO — FlowExit, exitAfterSkip
├── store/
│   ├── types.ts                    # assinatura de skipService
│   ├── runSlice.ts                 # skipService; advance passa a mover o foco
│   ├── draftSlice.ts               # resetWork e discardDraft abortam a busca
│   └── restoreDraft.ts             # passa a chamar hasWork
├── app/
│   ├── ResetFlow.tsx               # NOVO — botão global + diálogo
│   └── Wizard.tsx                  # ResetFlow no cabeçalho
├── features/
│   ├── service/
│   │   ├── ServiceStep.tsx         # 2 pontos de pulo → SkipButton
│   │   └── SkipButton.tsx          # NOVO — gatilho único, decide se confirma
│   ├── quota/QuotaEstimateScreen.tsx   # 2 pontos de pulo
│   ├── review/ReviewScreen.tsx         # 1 ponto de pulo
│   └── result/ResultScreen.tsx         # 1 ponto de pulo (o do próximo destino)
└── i18n/pt-BR.ts                   # bloco flow + 2 chaves em queue

tests/
├── unit/            # flow-exit, has-work
├── integration/     # skip-aborts, reset-aborts
├── components/      # skip-service, reset-flow
├── a11y/            # steps.spec.tsx — axe com os dois diálogos
└── e2e/             # keyboard, multi-destination
```

**Structure Decision**: estrutura da 002–005 mantida sem alteração. A feature
encaixa nas camadas existentes — decisão pura em `src/domain/`, orquestração em
`src/store/`, apresentação em `features/` e cromo de aplicação em `app/` — e não
cria nenhuma camada nem primitivo novo em `src/ui/`.

## Ordem de implementação sugerida

Cada etapa é verificável isoladamente; nenhuma depende de uma posterior.

1. **Pré-requisitos** — `cancelSearch` em `resetWork`/`discardDraft`;
   `stepToken` em `advance`. Isolados, mensuráveis, e destravam FR-022 e FR-024
   sem depender de nada mais.
2. **Domínio** — `exitAfterSkip` e `hasWork`, com V0 e V1. Aqui a tabela de
   verdade inteira fica verde antes de qualquer componente existir.
3. **Orquestração** — `skipService` no `runSlice`; `restoreDraft` passa a usar
   `hasWork`. V6 e V7.
4. **Pontos de pulo** — `SkipButton` e as seis substituições. V2 a V5.
   `e2e/multi-destination.spec.ts:156` deve continuar verde sem edição.
5. **Recomeço** — `ResetFlow`, textos, cabeçalho. V8 a V13.
6. **Acessibilidade e ponta a ponta** — axe, teclado, o cenário do beco sem
   saída. V14 a V17.

O passo 1 antes do 2 não é arbitrário: sem o cancelamento, os testes de FR-011 e
FR-022 do passo 3 mediriam um comportamento que a própria feature vai mudar.

O passo 2 inteiro antes do 4 também não: a tabela de verdade de `exitAfterSkip`
é o contrato que os seis pontos de pulo consomem. Escrevê-los antes dela é
escrever seis vezes a mesma suposição.

## Complexity Tracking

| Violação | Por que é necessária | Alternativa mais simples, e por que foi recusada |
| --- | --- | --- |
| **D1 — pular o último destino descarta trabalho, e "pular" não é a palavra "descartar"** | O Princípio V é NÃO NEGOCIÁVEL e exige que trabalho em andamento seja apagado "apenas após sucesso ou por ação explícita de descarte". A decisão de produto registrada na spec é que pular o último de uma fila em que nada rodou descarta o trabalho e volta à seleção de serviços. Um botão rotulado "Pular o Spotify" não anuncia um descarte, e sem anúncio a ação não é explícita | *Preservar o trabalho e apenas navegar*: contradiz a decisão de produto tomada com o usuário. *Descartar sem confirmar*: seria a violação literal — trabalho apagado por uma ação que não se apresenta como descarte. **A escolha adotada é confirmar apenas nesse caminho** (FR-005): a confirmação é o que torna o descarte explícito, e o caso é o único dos seis pontos de pulo em que ele ocorre — nos outros cinco, pular continua sendo um clique só, sem diálogo (FR-012). O custo é um diálogo a mais em um caso raro; o ganho é o Princípio V cumprido na letra. Uma segunda alternativa, mudar o rótulo do botão nesse caso em vez de confirmar, foi considerada e recusada: um rótulo que muda sozinho conforme o estado da fila é mais difícil de descobrir do que um diálogo, e não dá ao usuário como voltar atrás depois do clique |

## Riscos e mitigações

| Risco | Mitigação |
| --- | --- |
| Centralizar os seis pontos de pulo mudar o comportamento do caso 6 (`ResultScreen`, que já funciona) | `exitAfterSkip` devolve `summary` ali, porque o destino de onde o usuário olha rodou. A prova é `e2e/multi-destination.spec.ts:156` passar **sem edição** — se precisar ser editado, a implementação saiu do contrato ([ui-contract §4](./contracts/ui-contract.md)) |
| `advance()` incrementar `stepToken` mexer em foco onde algum teste já dependia do contrário | Verificado na Fase 0: nenhum teste do repositório afirma foco em transição de etapa. `toHaveFocus`/`activeElement` só aparecem em `theme-control`, `dialog`, `reauth-dialog` e nos e2e de reconexão e teclado, nenhum sobre `advance` ([research §7](./research.md)) |
| `hasWork` extraído mudar o comportamento da restauração | O parâmetro `queueCounts` é o que separa os dois usos, e `restoreDraft` chama **sem** ele. `draft-recovery.spec.ts` e `draft-after-quota.spec.ts` passam sem edição ([flow-contract §2](./contracts/flow-contract.md)) |
| Abortar dentro de `resetWork` disparar um caminho de erro na busca em voo | `runMatching` já trata `signal.aborted` — é o mesmo caminho de `cancelSearch`, exercitado hoje pelo botão "Cancelar busca". O `.catch` de `ServiceStep` despacha `failed` sobre uma execução já zerada, e `dispatchRun` devolve o estado intacto quando a execução não existe mais |
| Dois diálogos diferentes na mesma aplicação, mais os dois `window.confirm` do banner de rascunho | Inconsistência reconhecida e **deixada fora de escopo**: nenhum FR pede a migração do banner, e misturá-la aqui repetiria o erro que a 005 recusou cometer com copy. Registrada como candidata a trabalho próprio ([research §8](./research.md)) |
| Um rascunho já gravado no estado de tela em branco continuar restaurando para ela | Decisão registrada de não migrar ([flow-contract §6](./contracts/flow-contract.md)). O botão de recomeço no cabeçalho passa a ser a saída, que é exatamente o caso de uso de FR-013 |
