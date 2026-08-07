# Implementation Plan: Reconexão Sem Descartar o Trabalho

**Branch**: `004-youtube-reconnect` (checkout atual: `feat/youtube-reconnect`) | **Data**: 2026-08-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-youtube-reconnect/spec.md`

## Summary

Fazer com que a perda de autorização durante a busca ou a criação seja tratada como **pedido de reautorização retomável**, e não como falha — preservando o que já foi feito, oferecendo um modal para reconectar e um botão permanente de reconexão no cabeçalho.

**A Fase 0 refutou o diagnóstico da spec.** A spec supunha que a perda de sessão encerrava a execução com desfecho "falhou". Executado contra o código com MSW, isso é falso: `runMatching` **não lança**, `handleSessionLoss` **nunca roda** no YouTube, a sessão **não** é encerrada e `authError` **nunca** é registrado. O que acontece é que `searchOne` captura o erro **linha por linha** e o transforma em "Não encontrada" — a mensagem certa é escrita cem vezes, enterrada no detalhe de cada fileira, enquanto o cabeçalho segue mostrando a conta como conectada. A seção "Contexto" da spec foi corrigida; os requisitos não mudaram, porque FR-001 e FR-002 já pediam a coisa certa ([research §1](./research.md)).

**Abordagem técnica**: uma regra nova, três costuras e um conserto de pré-requisito.

1. **A regra**: *falha de linha vira item; falha de sessão derrompe a execução.* `isSessionLevel(error)` em `errors.ts` — genérica, sem `ProviderId`, porque a distinção não é do catálogo de vídeo. `searchOne` relança em vez de engolir; a primeira falha aborta as demais por um `AbortController` interno, então há **um** pedido de reautorização e não cem ([research §2](./research.md), §10).
2. **A fase `awaiting_reauth`** em `reduceRun`, com `resumeFrom: 'search' | 'creating'` explícito. Não reusar `connect` porque `authorized` de lá leva a `estimate`, que reexibiria o custo da **lista inteira** e contradiria FR-013 no primeiro clique ([research §4](./research.md)).
3. **O modal**, sobre `<dialog>` nativo — o navegador já entrega contenção de foco, `Esc` e camada de topo, e a constituição põe o ônus da prova em quem quer adicionar dependência ([research §8](./research.md)).

Três descobertas da Fase 0 mudaram o custo em relação ao que a spec previa — duas para menos, uma para mais:

**A preservação parcial (Q1) é quase de graça.** A spec a chamou de "maior mudança estrutural desta feature". Verificado: `runProviderSearch` **já** produz item para toda linha, com as não buscadas voltando `pending` (é assim que o cancelamento funciona hoje), e `ServiceRun.items` **já** é persistido no rascunho. Não há chave nova, campo de armazenamento novo nem migração. Sobra uma mudança de contrato — `search` passa a devolver `{ items, interruption }` ([research §3](./research.md)).

**A retomada da criação (Q2) já existe.** `sendRemainingItems` já incrementa `committedItems` só após sucesso e grava síncrono; `retryRemaining()` já parte do `playlistId` e não cria segunda playlist; `partial-failure.spec.ts` já cobre SC-010. Verificado: um erro que não é de cota deixa a execução **na fase `creating`, com `outcome: null`** — ela já é retomável, só não sabe pedir reautorização. FR-029, FR-030 e FR-032 saem satisfeitos pelo que existe ([research §5](./research.md)).

**E um pré-requisito que não estava na spec: o `401` grava cota fantasma.** Medido: 3 linhas com `401` gravam 300 unidades no registro local. `http.ts:212` contabiliza assim que a resposta chega, antes de olhar o status, e o comentário que justifica isso ("a resposta chegou, logo o provedor contabilizou") é falso para `401` — requisição rejeitada por credencial não é cobrada. Em uma lista de 100 linhas isso são **10.000 unidades fantasma**, e o usuário reconectaria para ser barrado por um esgotamento que não provocou. Sem esse conserto, SC-008 é falso e o modal mente sobre o custo ([research §6](./research.md)).

## Technical Context

**Language/Version**: TypeScript 5.x em modo `strict`, alvo ES2022 · Node.js ≥ 22 só para build e testes — inalterado

**Primary Dependencies**: React 19 · Vite 7 · Tailwind CSS 4.3 · Zustand · **nenhuma dependência nova**. Biblioteca de modal/foco recusada por escrito em [research §8](./research.md) — o elemento `<dialog>` nativo cobre o requisito

**Storage**: `localStorage`/`sessionStorage` como na 003, chaves inalteradas. **`SCHEMA_VERSION` não muda e não há migração** — a mudança é compatível nas duas direções, e um bump invalidaria o rascunho de quem atualizasse no meio do trabalho, provocando a perda que a feature existe para evitar ([research §13](./research.md), [data-model §8](./data-model.md))

**Testing**: Vitest + Testing Library + happy-dom · MSW · Playwright · axe-core — inalterado. 37 verificações mapeadas ([research §14](./research.md)), das quais **8 suítes devem passar sem edição** como prova de não regressão

**Target Platform**: navegadores modernos de desktop; telas estreitas suportadas — inalterado

**Project Type**: aplicação web estática de página única, sem backend — inalterado

**Performance Goals**: ≥ 2 linhas/s sustentadas (constituição, `003/SC-009`) — inalterado. O abort encadeado reduz requisições, nunca as aumenta

**Constraints**: **zero hosts novos** (lista fechada permanece em 6) · zero escopos novos · zero parâmetros de requisição novos · consumo real ≤ estimativa **por construção**, agora também através de uma interrupção · nenhuma escrita na conta sem a confirmação já dada · toda a interface em pt-BR

**Scale/Scope**: 2 provedores · 1 fase nova · 1 evento novo · 1 campo novo em `ServiceRun` · 2 componentes novos · ~20 arquivos de `src/` alterados, 2 criados

## Constitution Check

_GATE: deve passar antes da Fase 0. Reavaliado após a Fase 1._

Constituição avaliada: **v1.1.0**.

| Princípio / Seção | Exigência | Pré-Fase 0 | Pós-Fase 1 |
| --- | --- | --- | --- |
| **I. Sem Servidor Próprio** | artefato estático, sem endpoint próprio | ✅ | ✅ Nenhum componente novo de servidor. A reautorização explícita é tratada como **comportamento previsto da interface**, que é literalmente o que o princípio manda fazer quando o fluxo sem segredo não renova em silêncio |
| **II. Superfície de rede fechada** | lista fechada por provedor, escopo mínimo | ✅ | ✅ **Zero hosts, escopos e parâmetros novos** ([contracts/provider-contract §6](./contracts/provider-contract.md)). `no-secrets.spec.ts` deve passar **sem edição** |
| **II. Provedor não selecionado não recebe requisição** | — | ✅ | ✅ **Reforçado**: o abort de §10 garante que nenhuma requisição sai após a interrupção (SC-007), e o cabeçalho só lista destinos selecionados (H4) |
| **II. Nenhum segredo** | Client Secret nunca tocado | ✅ | ✅ O pedido de reautorização é **estado derivado**, não registro — não pode conter token nem credencial por construção ([data-model §6](./data-model.md)) |
| **III. Domínio puro, I/O isolado** | regra de negócio em `src/domain/` | ✅ | ✅ Transições em `reduceRun` (puro); `remainingLineIds` pura; `isSessionLevel` é predicado sobre `kind`, sem I/O. Componentes só orquestram |
| **IV. Invariante sem teste** | verificação executável para cada regra | ✅ | ⚠️ Cumprido **com um limite declarado** — ver D1 |
| **V. Nenhuma escrita sem confirmação** | revisão obrigatória; rascunho preservado | ✅ | ✅ **Reforçado**: nada é escrito entre a interrupção e a reconexão (SC-011), e a retomada não duplica. Ver D2 sobre a confirmação através da reautorização |
| **V. Rascunho apagado só por sucesso ou descarte** | — | ✅ | ✅ Nenhum caminho novo apaga rascunho. `clearDraftIfAllSucceeded` intocado |
| **Honestidade sobre limites** | não simular o que a API não oferece | ✅ | ✅ **Reforçado**: o conserto da cota fantasma é exatamente isto — parar de afirmar um consumo que não houve ([research §6](./research.md)) |
| **Assimetria entre provedores** | expor a diferença onde ela muda o que o usuário pode fazer | ✅ | ✅ O custo da retomada só aparece no provedor com orçamento diário (C4, R6). O mecanismo é comum; a exibição é assimétrica porque a realidade é |
| **Armazenamento versionado** | mudança incompatível exige migração ou descarte seguro | ✅ | ✅ Mudança compatível nas duas direções; descarte seguro do código antigo já existe pela validação de forma ([research §13](./research.md)) |
| **Idioma pt-BR, texto em `src/i18n/`** | — | ✅ | ✅ Reúsa os textos de reconexão que já existem e nunca foram renderizados. `tp/no-ui-text-literals` cobre o resto |
| **Acessibilidade** | teclado, foco, leitor de tela, axe-core | ✅ | ⚠️ Cumprido **com divisão de responsabilidade de prova** — ver D1 |
| **Simplicidade proporcional** | dependência nova exige justificativa escrita | ✅ | ✅ Nenhuma dependência nova. `<dialog>` nativo justificado contra biblioteca de modal ([research §8](./research.md)) |
| **Spec antes de código** | mudança de comportamento passa por spec | ✅ | ✅ Spec corrigida na Fase 0 quando a premissa colidiu com a realidade verificada, como a seção "Restrições de Plataforma e Produto" exige |

Nenhuma violação sem justificativa. Os dois ⚠️ estão registrados em Complexity Tracking, com a alternativa mais simples e o motivo da recusa.

## Project Structure

### Documentation (this feature)

```text
specs/004-youtube-reconnect/
├── plan.md                        # Este arquivo
├── spec.md                        # Corrigida na Fase 0 (§ Contexto)
├── research.md                    # Fase 0
├── data-model.md                  # Fase 1
├── quickstart.md                  # Fase 1
├── contracts/
│   ├── provider-contract.md       # Busca, erros de sessão, cota
│   └── ui-contract.md             # Modal, etapa, cabeçalho, a11y
├── checklists/requirements.md
└── tasks.md                       # /speckit-tasks — NÃO criado aqui
```

### Source Code (repository root)

```text
src/
├── domain/
│   ├── types.ts                   # RunPhase +1, ServiceRun +1 campo, SearchOutcome
│   └── run/
│       ├── machine.ts             # evento session_lost, transições, OPEN_PHASES
│       └── lines.ts               # remainingLineIds (nova, pura)
├── services/
│   ├── providers/
│   │   ├── errors.ts              # isSessionLevel (novo)
│   │   ├── types.ts               # assinatura de search
│   │   ├── searchRunner.ts        # relança sessão, abort encadeado, retorno novo
│   │   └── http.ts                # 401 não registra cota
│   └── storage/
│       └── draftRepo.ts           # resumeFrom + fase nova na validação
├── features/
│   ├── connect/
│   │   ├── ReauthDialog.tsx       # NOVO
│   │   └── SessionHeader.tsx      # lista por destino+credencial, reconectar
│   ├── input/matchRunner.ts       # propaga SearchOutcome
│   ├── review/LineEditor.tsx      # consome .items[0]
│   ├── result/creationRunner.ts   # despacha session_lost
│   └── service/ServiceStep.tsx    # ramo awaiting_reauth, busca só o que falta
├── ui/Dialog.tsx                  # NOVO
└── i18n/pt-BR.ts                  # textos novos; reúso dos existentes

tests/
├── unit/            # isSessionLevel, reduceRun, remainingLineIds
├── integration/     # reauth-search, reauth-partial-search, reauth-creation
├── components/      # reauth-dialog, reauth-resume, session-header
├── a11y/            # axe com o modal aberto
└── e2e/             # contenção de foco, teclado, tela estreita
```

**Structure Decision**: estrutura da 002/003 mantida sem alteração. A feature encaixa nas camadas existentes — regra no domínio, I/O em `services/`, orquestração em `features/` — e acrescenta um único primitivo em `src/ui/`, que é onde os componentes sem regra de negócio já vivem.

## Ordem de implementação sugerida

Cada etapa é verificável isoladamente; nenhuma depende de uma posterior.

1. **Pré-requisito** — `401` não registra cota (Q1–Q3). Isolado, mensurável, destrava a honestidade de custo do resto.
2. **Regra** — `isSessionLevel` + `searchOne` relança + abort encadeado + `SearchOutcome`. Aqui V0 vira verde.
3. **Domínio** — fase, evento, `resumeFrom`, `remainingLineIds`, serialização no rascunho.
4. **Orquestração** — ramo `awaiting_reauth` em `ServiceStep` (com a atribuição de `startedFor`), busca só o que falta, `creationRunner` despachando `session_lost`.
5. **Interface** — `Dialog`, `ReauthDialog`, `SessionHeader`, textos.
6. **Acessibilidade e ponta a ponta** — axe, teclado, contenção de foco.

O passo 1 antes do 2 não é arbitrário: com a cota fantasma ainda gravando, os testes de consumo do passo 2 mediriam um valor que a própria feature vai mudar.

## Complexity Tracking

| Violação | Por que é necessária | Alternativa mais simples, e por que foi recusada |
| --- | --- | --- |
| **D1 — Contenção de foco (FR-011) não é provada por teste automatizado no portão local; só em e2e** | O Princípio IV exige verificação executável para todo invariante. Verificado na Fase 0: happy-dom expõe `showModal()` e marca `open === true`, mas **não** emula a contenção de foco da camada de topo do navegador. Um teste em happy-dom passaria sem provar nada | *Escrever armadilha de foco à mão e testá-la em happy-dom*: provaria o nosso código e não o comportamento real, além de adicionar dezenas de linhas de comportamento sutil que o navegador já implementa — contra "Simplicidade proporcional". *Afirmar a contenção com base no `<dialog>` nativo sem teste*: seria exatamente o "invariante que só existe em prosa" que o Princípio IV proíbe. A escolha adotada é declarar o limite e mover a prova para Playwright (V16), onde o navegador é real. O portão local continua cobrindo abrir/fechar/`Esc`/foco inicial/foco devolvido |
| **D2 — A confirmação de revisão sobrevive a uma reautorização sem ser repedida** | O Princípio V é NÃO NEGOCIÁVEL: nenhuma escrita sem confirmação humana explícita. A retomada da criação escreve na conta **sem** nova confirmação | *Repedir a confirmação após reconectar*: rejeitada porque a escrita retomada é **a mesma** que o usuário já autorizou — mesma conta, mesma playlist, mesmas faixas, mesma execução. Reautorizar restabelece acesso; não altera o que será escrito. Repedir treinaria o usuário a clicar em confirmações sem ler, que é o oposto do que o princípio protege. **O limite é explícito**: se a reconexão for a uma conta **diferente**, FR-031 proíbe a retomada e encerra o destino como parcial — a confirmação original não se transfere para outra conta. Verificado por V27 |

## Riscos e mitigações

| Risco | Mitigação |
| --- | --- |
| A guarda `startedFor` de `ServiceStep` bloquear a retomada silenciosamente | Identificado na Fase 0 ([research §4](./research.md)). O ramo novo atribui a chave, e **V19 retoma sem recarregar** — na navegação real o `ref` zera e o defeito ficaria escondido |
| `SearchOutcome` quebrar chamadores esquecidos | `strict` + `typecheck` no portão local pegam todos em tempo de compilação. São 4 chamadores conhecidos ([data-model §9](./data-model.md)) |
| Cota fantasma mascarar a medição de SC-008 | Ordem de implementação: o conserto de cota é o passo 1, antes de qualquer teste de consumo |
| Regressão silenciosa na busca sem interrupção | 8 suítes devem passar **sem edição**; editá-las é o sinal de que a implementação saiu do contrato ([quickstart](./quickstart.md)) |
| `<dialog>` com suporte irregular em navegador antigo | Alvo declarado é "navegadores modernos de desktop", onde `<dialog>` é suportado universalmente desde 2022. Fora do alvo já hoje |
