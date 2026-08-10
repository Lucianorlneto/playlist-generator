# Implementation Plan: Estado de carregamento da criação de playlist

**Branch**: `feat/loadings-and-animations` | **Date**: 2026-08-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-creating-loading-state/spec.md`

## Summary

A 008 trouxe o **cartão de fase** e o seu cabeçalho; esta feature preenche o que o arquivo
de design desenha **dentro** dele enquanto a requisição de criação está em voo. É a
terceira passada sobre a mesma fonte de verdade, e a primeira que introduz movimento.

Quatro frentes, em ordem de risco:

1. **A reorganização do `ResultScreen`.** Hoje ele retorna duas árvores diferentes
   conforme `result` seja nulo ou não; com isso o React desmonta a seção inteira quando o
   resultado chega, e a fusão cruzada do FR-010a é impossível de implementar por cima
   dessa estrutura. O cartão, o cabeçalho e o título passam a ser renderizados **uma vez**,
   e só o corpo troca. É o que torna o SC-004 verdadeiro por construção.
2. **O movimento entra, com fechadura.** `motion@13` é importada em **um único
   diretório**, `src/ui/motion/`, que exporta exatamente três primitivas — uma por
   movimento autorizado pelo FR-010b. A fechadura é a mesma dos ícones: regra de lint
   local com allowlist de diretório, mais um teste que falha se aparecer uma quarta.
   Sem isso, "o movimento autorizado é exatamente três" é prosa.
3. **Duas tintas novas, e a que não pode ser um par.** O substrato do disco é derivado por
   `color-mix` e entra na lista fechada de pares medidos. O token de esqueleto **não pode**
   entrar: `#252d3a` sobre `#161c25` dá 1,24:1, e uma barra de esqueleto a 3:1 é lida como
   conteúdo. Ele segue o precedente literal de `--rule` — token sem par — e ganha um portão
   próprio, uma **faixa de perceptibilidade** com piso e teto, que é a forma executável do
   FR-008a.
4. **O rodapé acumula dois papéis, e o aviso de espera chega à criação.** O rodapé é uma
   região viva só, que diz "aguardando" antes do primeiro lote e progresso depois. O aviso
   de limitação de taxa passa a aparecer também na criação inicial, sem ícone giratório e
   sem saída de cancelamento.

**O que não muda**: a criação em si. `creationRunner.ts`, `run/machine.ts`, lotes, índice
de confirmação, retomada, cota, tratamento de 429, rede e armazenamento ficam byte a byte
como estão. `review_confirmed` continua sendo o único caminho para `creating`. O SC-008 é
o portão: a suíte existente passa **sem alteração de asserção**.

O risco maior não é o movimento — são os dois pontos em que a fidelidade ao arquivo colide
com uma regra do sistema, e os dois foram resolvidos a favor da regra, com o motivo
escrito: o título do carregamento adota o degrau `text-step` em vez dos 18px do arquivo
(research §R3), e a terceira tinta do rodapé é recusada em favor de `--ink-muted`
(FR-020, o mesmo desfecho que a 007 deu a `--ink-faint`).

## Technical Context

**Language/Version**: TypeScript 5 em modo `strict` (`noUncheckedIndexedAccess`), React 19.2

**Primary Dependencies**: Vite 7 · Tailwind CSS 4.3.3 (`@theme inline`) · Zustand 5 ·
`react-icons` · **`motion` 13.1 — dependência nova**, já instalada pelo autor, registrada
em Complexity Tracking

**Storage**: `localStorage`, chaves versionadas e tipadas. **Sem mudança** — nenhuma chave
nova, nenhum formato alterado, nenhuma migração

**Testing**: Vitest + Testing Library · MSW (`onUnhandledRequest: 'error'`) · axe-core
(`tests/a11y/`) · Playwright (`e2e/`, projetos `desktop`, `narrow-375` e **`reduced-motion`**,
novo) · regras de lint locais em `eslint-rules/`

**Target Platform**: navegadores modernos de mesa e telefone; artefato estático servível de
qualquer diretório

**Project Type**: aplicação web de página única, sem servidor próprio

**Performance Goals**: a busca continua sustentando ≥ 2 linhas/s (`throughput.spec.ts` não
é tocado). O acréscimo desta feature é **animação contínua durante requisição em voo**, e é
por isso que o FR-017a restringe as três animações a `transform` e `opacity` — o pior caso
é o YouTube, cujo lote é de um item e faz uma requisição por faixa

**Constraints**: nenhum valor visual literal · nenhuma medida fora da escala finita ·
contraste medido nos dois temas · nenhuma rolagem horizontal de 320px a 1920px · nenhum
destino de rede novo · nenhuma alteração de asserção na suíte existente (SC-008)

**Scale/Scope**: 1 tela em 1 fase do ciclo · 2 serviços · 2 temas · 2 larguras + 1 projeto
de movimento reduzido · +1 token declarado (19 → 20 nomes de cor) · +1 token derivado ·
+1 par aprovado (31 → 32) · +3 chaves de texto · 3 movimentos · ~7 arquivos de `src/`
tocados · **0 arquivos de regra de negócio tocados**

**Fonte de verdade**: `/Users/bms023/Documents/Workspace/playlist-importer/playlist-importer.pen`,
lido pela ferramenta que o edita (MCP `pencil`), nunca por captura de tela. A geometria nó
a nó está transcrita em `research.md` §R1.

## Constitution Check

_GATE: obrigatório antes da Fase 0; reavaliado após a Fase 1._

### Avaliação inicial (antes da Fase 0)

| Princípio / Regra | Situação | Como esta feature se comporta |
| --- | --- | --- |
| **I. Sem Servidor Próprio** (NN) | ✅ Passa | Nenhum endpoint, processo ou função. O movimento é código local; nada é buscado em tempo de execução. |
| **II. Nenhum Segredo, Superfície de Rede Fechada** (NN) | ✅ Passa | Nenhum host novo, nenhuma fonte remota, nenhum recurso carregado de terceiro (FR-027). A biblioteca de movimento é empacotada no `dist/`. `e2e/no-remote-origin.spec.ts` continua sendo o portão. |
| **III. Domínio Puro, I/O Isolado** | ⚠️ Ponto de atenção | Duas coisas atravessam a fronteira e precisam ficar do lado certo: a conversão de `resumesAt` em segundos é **regra**, vai para `src/domain/retry/countdown.ts` com `agora` como parâmetro; o `setInterval` e a leitura de `matchMedia` são **I/O**, ficam no componente. Nenhuma regra de negócio entra em componente. |
| **IV. Invariante Sem Teste Não É Invariante** | ✅ Passa | É onde esta feature gasta o esforço. FR-010b vira regra de lint **mais** teste de superfície; FR-008a vira faixa de perceptibilidade medida; FR-016 vira teste com `matchMedia` mocado e projeto Playwright dedicado; SC-004 vira medição de pixel com diferença exigida **zero**. |
| **V. Nenhuma Escrita Sem Confirmação** (NN) | ✅ Passa | Nenhum caminho de escrita é tocado. `creationRunner.ts` e `run/machine.ts` não são editados. SC-008 é o portão: nenhuma asserção existente muda. |
| **Honestidade sobre limites da plataforma** | ✅ Passa | O FR-018 é aplicação direta: uma pausa por limite de taxa passa a ser **dita**, em vez de deixar a tela muda. E o FR-020 recusa a terceira tinta do arquivo porque ela reprova de fato, não por preferência. |
| **Assimetria entre provedores** | ✅ Passa | Nenhum arquivo novo ramifica por `ProviderId` (FR-023). Nada que a feature introduz é colorido pela marca: o disco é âmbar, as barras são neutras, os textos vêm da tinta principal e da secundária. O nome do serviço chega já resolvido. |
| **Idioma pt-BR, texto em `src/i18n/`** | ✅ Passa | Três chaves novas, todas no dicionário; `tp/no-ui-text-literals` é o portão. As três entram no inventário versionado (FR-021). |
| **Acessibilidade** | ⚠️ Ponto de atenção | O risco desta feature é **anúncio repetido**, não foco. Duas regiões vivas convivem na mesma tela e a contagem regressiva muda a cada segundo. A resolução está no contrato: uma região viva de conteúdo próprio, o aviso como segunda e última, e a contagem `aria-hidden`. |
| **Desempenho** | ✅ Passa | FR-017a restringe as três animações a `transform` e `opacity`, compostas sem recálculo de layout. Nada no caminho de busca é tocado. |
| **Simplicidade proporcional** | ❌ Exceção registrada | Dependência nova. As três animações são escrevíveis em CSS puro, e a supressão por `prefers-reduced-motion` viria de graça da regra global que já existe. Ver Complexity Tracking. |
| **Armazenamento** | ✅ Passa | Nenhuma chave, nenhum formato, nenhuma migração. |
| **Fluxo Spec Kit** | ✅ Passa | `/speckit-specify` → `/speckit-clarify` (5 decisões) → este plano. |
| **Rastreabilidade** | ✅ Passa | Todo teste novo cita o `FR-xxx` / `SC-xxx` que garante. |

**Veredito**: portão **passa**, com uma exceção registrada em Complexity Tracking — a
dependência de animação, que a constituição exige justificar por escrito contra a
alternativa de escrever à mão.

### Reavaliação (após a Fase 1)

Os artefatos da Fase 1 não introduziram violação nova, e fecharam os dois pontos de
atenção acima:

- **Domínio puro** — a única regra que a feature acrescenta é
  `segundosRestantes(resumesAt, agora)`, pura e com o relógio como parâmetro
  (`data-model.md` §3). O resto do que parecia estado é **derivação** de estado que já
  existe: a condição de exibição do cartão e o texto do rodapé são funções de
  `run.phase`, `run.creation` e `committedItemCount`, que já é a fonte de verdade da
  retomada. Nenhum contador novo, nenhum campo novo, nenhum evento novo no redutor.
- **Acessibilidade** — `contracts/loading-card.md` §4 fixa a conta: uma região viva de
  conteúdo próprio, com **um** nó e não dois em revezamento; o aviso de espera como
  segunda e última; a contagem regressiva `aria-hidden`, porque um número que muda a cada
  segundo dentro de um `role="status"` é um anúncio por segundo.

E a Fase 1 **descobriu** duas coisas que a avaliação inicial não tinha:

- **A fusão cruzada obriga a reorganizar o `ResultScreen`** (research §R7). Não é
  refinamento: sem o cartão e o cabeçalho sendo os mesmos nós de DOM nos dois estados, o
  React desmonta a seção e não existe transição a executar. É o item de maior risco da
  feature e está isolado em `contracts/loading-card.md` §5.
- **O inventário de textos precisa de uma reversão, não só de entradas novas.** O item de
  `yjjDB/FeEHR` está hoje como `mantido-diferente`, e o motivo escrito afirma que as
  frases de espera substituiriam o progresso real. Nesta feature elas não substituem nada
  — o progresso continua, no rodapé. Deixar o motivo antigo documentaria uma decisão que a
  própria feature reverteu (`contracts/text-inventory.md` §1).

**Veredito**: portão **passa**. Complexity Tracking permanece com uma única linha.

## Project Structure

### Documentation (this feature)

```text
specs/009-creating-loading-state/
├── plan.md                       # Este arquivo
├── spec.md                       # Entrada
├── research.md                   # Fase 0 — onze decisões
├── data-model.md                 # Fase 1 — as três derivações
├── quickstart.md                 # Fase 1 — guia de validação
├── contracts/                    # Fase 1 — definição normativa
│   ├── loading-card.md           # Composição, medidas, regiões vivas, SC-004
│   ├── tokens.md                 # As duas tintas e a faixa de perceptibilidade
│   ├── motion.md                 # Os três movimentos e a fechadura da biblioteca
│   └── text-inventory.md         # Delta do inventário da 008
├── checklists/
│   └── requirements.md           # Existente
└── tasks.md                      # Fase 2 — /speckit-tasks, não criado aqui
```

### Source Code (repository root)

Somente o que esta feature toca. Arquivo marcado com **novo** não existe hoje.

```text
src/
├── domain/
│   ├── retry/countdown.ts              # **novo** — segundos restantes, `agora` por parâmetro
│   └── theme/approvedPairs.ts          # +1 token, +1 derivado, +1 par (31 → 32)
├── ui/
│   ├── motion/                         # **novo** — o único importador de `motion`
│   │   ├── index.ts                    # exporta exatamente três primitivas
│   │   ├── SpinningDisc.tsx            # **novo** — giro, `transform`
│   │   ├── PulsingBar.tsx              # **novo** — pulsação, `opacity`
│   │   └── CrossFade.tsx               # **novo** — fusão cruzada, `opacity`, 200ms
│   └── RateLimitWaiting.tsx            # variante `countdown` (FR-018a, FR-018b)
├── features/result/
│   ├── ResultScreen.tsx                # a reorganização — cartão, cabeçalho e a célula do CrossFade renderizados uma vez
│   ├── CreatingBody.tsx                # **novo** — `CreatingIntro` (indicador, descrição, aviso) e `CreatingFootnote` (rodapé)
│   └── ResultSkeleton.tsx              # **novo** — a grade, `aria-hidden`, no slot de saída do CrossFade
├── i18n/pt-BR.ts                       # +3 chaves
└── styles/
    ├── tokens.css                      # `--skeleton` por tema · `--accent-tint-surface` derivado
    └── index.css                       # os dois nomes no `@theme inline`

eslint-rules/index.js                   # `tp/no-motion-library-import`, no molde da regra de ícones

docs/style-guide.md                     # §Movimento deixa de dizer "quase não tem movimento"

tests/
├── fixtures/design-inventory.json              # 1 reversão + 3 entradas
├── fixtures/design-inventory-exclusions.json   # o motivo do prefixo `result.` é reescrito
├── fixtures/i18n-pt-BR.snapshot.json           # rebaselinado
├── unit/contrast.spec.ts                       # +1 par, +1 derivado, faixa de perceptibilidade
├── unit/motion-surface.spec.ts                 # **novo** — a fechadura (FR-010b, SC-011)
├── unit/countdown.spec.ts                      # **novo** — a função pura
├── unit/design-text-fidelity.spec.ts           # passa a cobrir as três chaves novas
├── components/creating-card.spec.tsx           # **novo** — composição, regiões vivas, mov. reduzido
├── a11y/steps.spec.tsx                         # reexecutado na fase `creating`
└── e2e/creating-loading.spec.ts                # **novo** — SC-004 por medição de pixel

playwright.config.ts                    # projeto `reduced-motion` (SC-003)
```

**Structure Decision**: nenhuma estrutura nova de domínio. A feature adiciona **um**
diretório em `src/ui/` — `src/ui/motion/` — pelo mesmo motivo pelo qual `src/ui/icons.ts`
é um arquivo só: uma biblioteca externa entra por um ponto, e o ponto é fechado por lint e
por teste. Todo o resto é edição no lugar onde a coisa já mora, e o único movimento de
código relevante é a reorganização do `ResultScreen`, que não cria arquivo e sim desfaz
uma bifurcação de árvore que impedia a transição.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| **Dependência de animação (`motion` 13.1)**, contra a regra de simplicidade proporcional — "o ônus da prova é de quem quer adicionar", e o projeto não usa biblioteca de UI nem SDK de provedor, nem os oficiais | O pedido do autor a nomeia explicitamente ("toda parte de animações… utilizarão o Motion, que acabei de instalar, juntamente com o kit de AI"), e a biblioteca já está instalada no `package.json`. A escolha da ferramenta é decisão do autor do projeto, não da implementação. O que a biblioteca entrega de concreto aqui: `useReducedMotion` como interruptor uniforme e testável, e a orquestração da fusão cruzada sem escrever máquina de estado de transição à mão. | **Escrever as três animações em CSS puro** é tecnicamente superior e foi honestamente avaliado: `@keyframes` de `rotate` e de `opacity` custam zero byte de execução, o giro já existe no projeto (`motion-safe:animate-spin` em `RateLimitWaiting`), e a supressão por `prefers-reduced-motion` viria **de graça** da regra global de `index.css` — que, com a biblioteca, precisa ser substituída por um interruptor em JavaScript, porque a `motion` anima por WAAPI e não por `@keyframes` que o CSS possa encurtar (research §R6). A alternativa foi recusada por decisão do autor, não por limitação técnica, e o registro fica aqui para que a decisão seja revisável. **A mitigação adotada é a fechadura**: um único diretório importa a biblioteca, ele exporta exatamente três primitivas, e duas verificações independentes — regra de lint com allowlist de diretório e teste de superfície — falham no dia em que a quarta animação tentar entrar. É o mesmo arranjo que a 007 usou para `react-icons`, pelo mesmo motivo: o custo de perder a fechadura é uma varredura por todo o `src/`. |
