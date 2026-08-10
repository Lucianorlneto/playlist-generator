# Implementation Plan: Correções de fidelidade ao design oficial

**Branch**: `refactor/design` | **Date**: 2026-08-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-design-fidelity-pass/spec.md`

## Summary

A 007 trocou o esqueleto e a paleta; esta feature é a **segunda passada sobre a mesma
fonte de verdade**, corrigindo o que a conferência a olho deixou passar. Nenhuma regra
de negócio é tocada: o que muda é onde a informação aparece, que superfícies existem e
quais palavras são usadas.

Quatro frentes, em ordem de risco:

1. **A linha de contexto do cabeçalho vira regra, não componente.** A tabela de FR-009
   tem sete linhas e três formas — ausente, saudação pessoal, contexto de serviço — e
   depende da etapa e, no ciclo do serviço, da fase. Isso é decisão, não apresentação:
   vai para um módulo puro novo, `src/domain/header/`, no mesmo molde de
   `src/domain/rail/`. O `Greeting` atual, que exibe "Olá, {nome completo}" nas cinco
   etapas, é substituído pelo consumidor desse módulo.
2. **A moldura da etapa sai.** O `<div className="app-card">` do `Wizard` envolve o
   conteúdo de **toda** etapa e é a caixa que o pedido aponta em volta de "Para onde vai
   a playlist?". Ele sai; o utilitário `app-card` **permanece**, porque `MatchRow` e
   `SummaryScreen` correspondem a cartões que o arquivo desenha.
3. **O painel lateral ganha conteúdo e o cartão de destino ganha anatomia.** O
   `MoodPanel` — decoração pura por decisão da 007, revogada aqui — vira o painel
   "Ordem de execução"; o parágrafo de ordem sai do corpo da etapa. O cartão de destino
   ganha distintivo tingido pela cor da marca, linha de estado da conta e marca de
   verificação à direita.
4. **A fidelidade textual passa a ser verificada por máquina.** O que falhou na 007 foi
   o método, não a atenção: conferência guiada por lista, feita a olho. O arquivo de
   design entra no repositório como inventário versionado, e um teste renderiza cada
   template do `src/i18n/` com as amostras registradas e compara com a string do arquivo.

A maquinaria não muda de forma em lugar nenhum: `tokens.css` continua sendo a origem
única dos valores por tema, `approvedPairs.ts` continua sendo a lista fechada,
`contrast.spec.ts` continua sendo a autoridade sobre os números, e as regras de lint
locais continuam sendo o portão dos valores visuais. O trabalho é **acrescentar dois
tokens derivados, um módulo de domínio, um inventário e um teste** — e mover informação
para onde o arquivo a põe.

O risco maior é o mesmo da 007, e é por isso que a spec exigiu verificação executável:
divergência de texto **não falha em lugar nenhum**. Uma frase que diverge do design
passa por lint, por `typecheck`, por todos os testes de comportamento e só é percebida
quando alguém abre as duas telas lado a lado.

## Technical Context

**Language/Version**: TypeScript 5 em modo `strict` (`noUncheckedIndexedAccess`), React 19.2

**Primary Dependencies**: Vite 7 · Tailwind CSS 4.3.3 (`@theme inline`) · Zustand 5 · `react-icons` (já presente desde a 007). **Nenhuma dependência nova.**

**Storage**: `localStorage`, chaves versionadas e tipadas. **Sem mudança** — nenhuma chave nova, nenhum formato alterado, nenhuma migração.

**Testing**: Vitest + Testing Library · MSW (`onUnhandledRequest: 'error'`) · axe-core (`tests/a11y/`) · Playwright (`e2e/`, projetos `desktop` e `narrow-375`) · regras de lint locais em `eslint-rules/`

**Target Platform**: navegadores modernos de mesa e telefone; artefato estático servível de qualquer diretório

**Project Type**: aplicação web de página única, sem servidor próprio

**Performance Goals**: inalterados. A busca continua sustentando ≥ 2 linhas/s (`throughput.spec.ts` não é tocado). O painel lateral ganha texto **acima** da fotografia, o que só melhora o que SC-019 mede: o conteúdo passa a ser legível antes da decoração por composição, não só por diferimento.

**Constraints**: nenhum valor visual literal (FR-035) · nenhuma rolagem horizontal em 375px (SC-007) · contraste medido nos dois temas, inclusive nos substratos tingidos novos · nenhum teste de comportamento muda de resultado (SC-009)

**Scale/Scope**: 14 telas no arquivo de design · 5 etapas · 6 fases do ciclo do serviço · 2 temas · 2 larguras · +2 tokens derivados (20 nomes de cor no total) · ~12 componentes tocados · 0 arquivos de `src/domain/` de negócio tocados

**Fonte de verdade**: `/Users/bms023/Documents/Workspace/playlist-importer/playlist-importer.pen`, lido pela ferramenta que o edita (MCP `pencil`), nunca por captura de tela. Os identificadores de nó citados no inventário são os daquele arquivo.

## Constitution Check

_GATE: obrigatório antes da Fase 0; reavaliado após a Fase 1._

### Avaliação inicial (antes da Fase 0)

| Princípio / Regra | Situação | Como esta feature se comporta |
| --- | --- | --- |
| **I. Sem Servidor Próprio** (NN) | ✅ Passa | Nenhum endpoint, processo ou função. Nada novo é buscado em tempo de execução; a fotografia e os adesivos já são recursos empacotados. |
| **II. Nenhum Segredo, Superfície de Rede Fechada** (NN) | ✅ Passa | Nenhum destino de rede novo, nenhum host tocado. O inventário de textos é lido do arquivo de design **em tempo de autoria**, e o que entra no repositório é o resultado — o teste lê um JSON versionado, não o `.pen`, e não abre rede nenhuma. `e2e/no-remote-origin.spec.ts` continua sendo o portão. |
| **III. Domínio Puro, I/O Isolado** | ✅ Passa | A tabela de FR-009 e a fila exibida do painel são **regra**, e vão para `src/domain/header/` e `src/domain/run/selection.ts` — puros, sem DOM, sem store, sem relógio. Precedente literal: `src/domain/rail/`, criado pela 007 pelo mesmo motivo. |
| **IV. Invariante Sem Teste Não É Invariante** | ✅ Passa | É o eixo da feature. FR-030b vira `tests/unit/design-text-fidelity.spec.ts`; FR-004 vira regra de lint com allowlist de arquivo **mais** teste de ponto único de uso; FR-009 e FR-028 viram testes de unidade sobre módulos puros; FR-006 e FR-019 viram asserções estruturais de componente. |
| **V. Nenhuma Escrita Sem Confirmação** (NN) | ✅ Passa | Nenhum caminho de escrita é tocado. `review_confirmed` continua sendo o único caminho para `creating`. SC-009 é o portão: nenhum teste de comportamento muda de resultado. |
| **Honestidade sobre limites da plataforma** | ✅ Passa | FR-029 é a aplicação direta do princípio: onde o mockup mostra "Spotify e YouTube" sob Destinos numa tela em que a escolha não aconteceu, a regra vence o desenho. |
| **Assimetria entre provedores** | ✅ Passa | Nenhum arquivo novo ramifica por `ProviderId`. A cor de marca e o substrato tingido entram como **mapas de literais** indexados por provedor, como `BRAND_INK` já faz — dado, não `if`. A ordem continua vindo só de `PROVIDER_ORDER`. |
| **Idioma pt-BR, texto em `src/i18n/`** | ✅ Passa | FR-031 o exige explicitamente. Todo texto novo do painel e do cartão entra no dicionário; `tp/no-ui-text-literals` é o portão. O nome do produto **permanece** em pt-BR (decisão registrada na spec). |
| **Acessibilidade** | ✅ Passa | FR-013, FR-025, FR-033. O cartão troca o controle nativo visível por controle nativo com apresentação própria (`sr-only` + `peer-focus-visible`), mantendo foco, rótulo associado e operação por teclado. `tests/a11y/` e `e2e/keyboard.spec.ts` são os portões. |
| **Desempenho** | ✅ Passa | Nada no caminho de busca é tocado. O painel passa a ter texto acima da imagem, o que reduz — não aumenta — a dependência de decoração. |
| **Simplicidade proporcional** | ✅ Passa | Nenhuma dependência nova. Um módulo de domínio novo e um teste novo; o resto é edição do que existe. |
| **Armazenamento** | ✅ Passa | Nenhuma chave, nenhum formato, nenhuma migração. |
| **Fluxo Spec Kit** | ✅ Passa | `/speckit-specify` → `/speckit-clarify` (8 decisões) → este plano. |
| **Rastreabilidade** | ✅ Passa | Todo teste novo cita o `FR-xxx` / `SC-xxx` que garante. |

**Veredito**: portão **passa**, com uma exceção registrada em Complexity Tracking — a
permissão nomeada de cor de marca como preenchimento, que a própria spec exige que seja
exceção com nome e não limiar numérico (FR-004).

### Reavaliação (após a Fase 1)

Os artefatos da Fase 1 não introduziram nenhuma violação nova, e fecharam dois pontos
que a avaliação inicial deixara em aberto:

- **Contraste dos substratos tingidos** (`contracts/tokens.md` §2). O distintivo do
  cartão põe o ícone da marca sobre um substrato da **mesma matiz**, o que reduz o
  contraste em vez de preservá-lo. Em vez de assumir que 12–15% "não muda nada", os dois
  pares entram na lista fechada e são medidos: `APPROVED_PAIR_COUNT` vai de 27 para 29,
  e `contrast.spec.ts` ganha o resolvedor do `color-mix` para poder medi-los. Se um valor
  reprovar, a correção é o valor por tema — nunca a remoção da cor (borda da spec).
- **FR-013 e a posição na fila** (`research.md` §R2). A leitura adotada está escrita e é
  revisável: a linha de contexto é texto real e anunciado, o cabeçalho do cartão de fase
  repete a posição **visualmente** onde o arquivo a desenha, e a repetição visual é
  `aria-hidden` para que a tecnologia assistiva ouça a posição uma vez só.

Um ponto que a Fase 1 **descobriu** e que não estava na avaliação inicial: a regra nova
de derivação da trilha (FR-028) faz a linha de apoio da etapa Serviço afirmar "2 serviços
concluídos" a partir do momento em que dois destinos existem — muito antes de qualquer
serviço concluir. A correção é do valor, não da regra: a etapa Serviço passa a derivar da
contagem de execuções **encerradas**, e não da contagem de destinos. Está em
`data-model.md` §3 e é FR-028 aplicado literalmente, não uma exceção a ele.

**Veredito**: portão **passa**. Complexity Tracking permanece com uma única linha.

## Project Structure

### Documentation (this feature)

```text
specs/008-design-fidelity-pass/
├── plan.md                       # Este arquivo
├── spec.md                       # Entrada
├── research.md                   # Fase 0
├── data-model.md                 # Fase 1
├── quickstart.md                 # Fase 1
├── contracts/                    # Fase 1 — definição normativa
│   ├── header-context.md         # A tabela de FR-009 como contrato
│   ├── destinations.md           # Painel lateral e anatomia do cartão
│   ├── tokens.md                 # Os dois tokens derivados e os pares novos
│   └── text-inventory.md         # Esquema do inventário e do teste que o lê
├── checklists/
│   ├── requirements.md           # Existente
│   └── design-fidelity.md        # Conferência **de forma**, tela a tela (FR-030b)
└── tasks.md                      # Fase 2 — /speckit-tasks, não criado aqui
```

### Source Code (repository root)

Somente o que esta feature toca. Arquivo marcado com **novo** não existe hoje.

```text
src/
├── domain/
│   ├── header/
│   │   └── index.ts              # **novo** — a tabela de FR-009 como função pura
│   ├── rail/index.ts             # regra de derivação: FR-028, FR-029
│   └── run/selection.ts          # projeção da fila exibida (FR-015)
├── app/
│   ├── Wizard.tsx                # sai o `app-card` que envolve a etapa (FR-006)
│   ├── Shell.tsx                 # o painel de Destinos deixa de ser `MoodPanel`
│   ├── StepContextLine.tsx       # **novo** — substitui `Greeting.tsx`
│   ├── Greeting.tsx              # **removido**
│   └── StepRail.tsx              # consome as linhas de apoio novas
├── features/
│   ├── destinations/
│   │   ├── DestinationSelector.tsx     # anatomia do cartão (FR-021 a FR-025)
│   │   ├── DestinationsStep.tsx        # sai o parágrafo de ordem (FR-019)
│   │   ├── ExecutionOrderPanel.tsx     # **novo** — substitui `MoodPanel.tsx`
│   │   └── MoodPanel.tsx               # **removido**
│   ├── queue/QueueIndicator.tsx        # passa a ser repetição visual (FR-013)
│   └── connect/ConnectionChip.tsx      # sem mudança de cor; conferido no inventário
├── i18n/pt-BR.ts                       # textos adotados do arquivo de design
├── styles/
│   ├── tokens.css                      # `--brand-tint-*` derivados
│   └── index.css                       # `--color-brand-tint-*` no `@theme inline`
├── domain/theme/approvedPairs.ts       # +2 pares, contagem 27 → 29
├── ui/Icon.tsx, ui/icons.ts            # sem mudança — os papéis já existem
└── ui/Dialog.tsx, ui/VersionHintBadge.tsx, ui/RateLimitWaiting.tsx
                                        # redesenho por analogia (FR-008), agora sobre `--bg`

eslint-rules/index.js                   # `bg-brand-tint-*` como exceção nomeada

tests/
├── fixtures/design-inventory.json      # **novo** — o inventário (FR-030a)
├── fixtures/design-inventory-exclusions.json  # **novo** — cobertura inversa (SC-001)
├── fixtures/i18n-pt-BR.snapshot.json   # rebaselinado, com o motivo registrado
├── unit/design-text-fidelity.spec.ts   # **novo** — FR-030b
├── unit/header-context.spec.ts         # **novo** — FR-009 a FR-012
├── unit/rail-composition.spec.ts       # FR-027 a FR-029
├── unit/contrast.spec.ts               # +2 pares e o resolvedor de `color-mix`
├── unit/no-orphan-tokens.spec.ts       # ponto único de uso de `bg-brand-tint-*`
├── components/destinations.spec.tsx    # cartão, painel, ausência de moldura
└── a11y/steps.spec.tsx                 # inalterado em forma, reexecutado
```

**Structure Decision**: nenhuma estrutura nova. A feature adiciona **um** diretório de
domínio (`src/domain/header/`) pelo mesmo motivo que a 007 adicionou `src/domain/rail/`:
a decisão é uma tabela com sete linhas e três formas de saída, e uma tabela dessas dentro
de um componente é uma decisão que só pode ser verificada renderizando DOM. Todo o resto
é edição no lugar onde a coisa já mora.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| **Cor de marca como preenchimento**, hoje proibida sem exceção por `tp/no-raw-visual-values` (007/FR-023, FR-024) | O arquivo de design desenha o distintivo do cartão de destino com o substrato tingido pela cor do serviço (`#1DB9541F` no Spotify, `#FF3B301F` no YouTube). Sem ele, o cartão perde a única marca de identidade que o design lhe dá, e FR-003 fica sem como ser cumprido. | **Afrouxar a regra por limiar de opacidade** ("cor de marca como preenchimento é permitida abaixo de 20%") foi recusado na própria spec: um limiar é alegável por qualquer tela nova sem passar por revisão, e a regra deixaria de ser uma fechadura para virar um argumento. A exceção adotada é **nomeada em três lugares ao mesmo tempo** — dois tokens com nome próprio (`--brand-tint-*`), uma allowlist de **arquivo** na regra de lint, e um teste que falha se o utilitário aparecer em mais de um arquivo. Usar a exceção fora do ponto autorizado custa editar a regra de lint, que é exatamente a revisão que se quer forçar. |
