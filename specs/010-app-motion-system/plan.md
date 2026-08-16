# Implementation Plan: Sistema de movimento do aplicativo

**Branch**: `feat/motion-system` | **Date**: 2026-08-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/010-app-motion-system/spec.md`

## Summary

A feature 009 trancou o movimento do produto em **exatamente três** primitivas, com regra de
lint e teste afirmando a contagem literal. Esta feature abre essa fechadura de propósito e
precisa continuar tendo uma fechadura depois: a contagem é substituída por um **catálogo
nomeado**, verificado por identidade, e por uma **escala finita de tokens de tempo** com
origem única — o par de `tp/no-raw-visual-values` para valores que hoje ainda entram crus.

Sobre essa base entram três primitivas — `StepTransition`, `Stagger` e `Settle` — que
atendem as quatro histórias da spec. Boa parte da periferia **não** precisa de JavaScript:
chip de conexão, cartão de destino e o preenchimento do disco da trilha são
`transition-colors`, e a troca de numeral por glifo no disco é o `CrossFade` da 009 usado
num lugar novo. O catálogo vai de três a seis, e não de três a onze.

Duas apurações da Fase 0 mudaram o desenho e estão registradas na spec: as linhas da revisão
**não chegam em fluxo** — `search_done` despacha a lista inteira, num momento sem requisição
em voo —, e a CSP `style-src 'self'` **não** alcança a biblioteca, porque escrita via CSSOM
não passa pelo analisador de CSP.

## Technical Context

**Language/Version**: TypeScript 5.9 em modo `strict`, com `noUncheckedIndexedAccess` e
`verbatimModuleSyntax`. Alvo `es2022`.

**Primary Dependencies**: React 19.2, Zustand 5, Tailwind CSS 4.3, `motion` 13.1 — **todas
já instaladas**. Esta feature não adiciona nenhuma.

**Storage**: nenhuma chave nova, nenhuma versão de esquema nova, nenhuma migração. A
preferência de movimento vem do sistema operacional, não do armazenamento.

**Testing**: Vitest com `happy-dom` para unidade, componente e acessibilidade; MSW com
`onUnhandledRequest: 'error'` para integração; Playwright com os projetos `desktop`,
`narrow-375` e `reduced-motion`, este último já existente.

**Target Platform**: SPA estática, 100% cliente, servível de qualquer subpasta. Navegadores
com suporte a `inert` — Baseline desde 2023, e o atributo degrada para "sem contenção" em
navegador antigo, não para tela quebrada.

**Project Type**: aplicação de página única, sem servidor próprio.

**Performance Goals**: a vazão contratada de **2 linhas por segundo** permanece o piso.
Nenhuma animação nova roda enquanto há requisição em voo — o único movimento nesse regime
continua sendo o do cartão de criação, que a 009 já resolveu e mediu.

**Constraints**: apenas `transform` e `opacity`, exceto `Settle`, que anima posição por
transformação e só com o portão de ociosidade aberto. Orçamento de transição herdado de
200ms. Nenhum destino de rede novo. Todo texto visível vindo de `src/i18n/`.

**Scale/Scope**: 6 primitivas no catálogo (3 novas), 1 função pura de domínio, 1 regra de
lint nova, 3 testes de unidade novos, 1 teste renomeado, 6 testes de componente novos,
10 superfícies tocadas em `src/ui/`, `src/features/` e `src/app/`, 1 arquivo de estilo,
1 seção do guia de estilo reescrita.

## Constitution Check

_GATE: verificado antes da Fase 0 e reavaliado após a Fase 1._

| Princípio | Veredito | Fundamento |
| --- | --- | --- |
| **I. Sem servidor próprio** | ✅ Não tocado | Nenhum endpoint, processo ou variável de ambiente. O artefato continua estático e servível de subpasta. |
| **II. Nenhum segredo, superfície de rede fechada** | ✅ Não tocado | Nenhum host novo, nenhuma dependência nova, nenhuma telemetria. `hosts.ts` e a CSP ficam idênticos. `tests/unit/no-secrets.spec.ts` continua valendo sem alteração. |
| **III. Domínio puro, I/O isolado** | ✅ Respeitado | A única regra nova é `stepDirection`, função determinística em `src/domain/`, sem DOM e sem relógio. A escala de movimento é dado puro. As primitivas são apresentação e vivem em `src/ui/`, como `src/ui/icons.ts`. Nenhum componente ganha regra de negócio. |
| **IV. Invariante sem teste não é invariante** | ✅ Respeitado | Cada requisito tem portão executável — ver as tabelas de verificação dos três contratos. A regra de lint nova existe pelo mesmo motivo das outras quatro: é erro que não falha no build. |
| **V. Nenhuma escrita sem confirmação explícita** | ✅ Protegido ativamente | FR-036 proíbe animar entrada e saída de diálogo, precisamente porque o diálogo de confirmação é o que segura este princípio. Nenhum caminho de escrita é tocado. |

**Restrições de plataforma e produto**

| Restrição | Veredito |
| --- | --- |
| Honestidade sobre limites | ✅ Duas premissas da spec colidiram com a realidade e foram **corrigidas na spec**, não contornadas: as linhas não chegam em fluxo, e a CSP não bloqueia a biblioteca. |
| Assimetria entre provedores | ✅ Nenhuma primitiva ramifica por `ProviderId`. O movimento é idêntico nos dois serviços. |
| Idioma | ✅ Nenhum texto novo previsto; se surgir, vem de `src/i18n/`. `tp/no-ui-text-literals` inalterada. |
| Acessibilidade | ⚠️ **É onde o risco desta feature mora.** A árvore que sai da transição fica 200ms em cena e precisa de `inert` + `aria-hidden`; o foco não pode esperar animação. Ambos com portão de teste próprio (`surfaces.md` §7). |
| Desempenho | ✅ Nenhuma animação nova sob requisição em voo. `throughput.spec.ts` inalterado e continua valendo. |
| Simplicidade proporcional | ⚠️ Ver Complexity Tracking. |
| Armazenamento | ✅ Nenhuma chave, nenhuma migração. |

**Portões de qualidade**: `npm run lint`, `npm run typecheck` e `npm test` antes de qualquer
commit. `npm run test:e2e` é **obrigatório** antes de publicar — esta feature altera o fluxo
do assistente, que é um dos três gatilhos que a constituição nomeia.

**Não é emenda constitucional.** A fechadura de movimento é contrato de feature
(`009/contracts/motion.md`), não princípio. A única lista que a constituição declara
emendável apenas por emenda é a de hosts do Princípio II, e ela não é tocada.

### Reavaliação após a segunda rodada de clarificações

Cinco decisões vieram depois deste plano ser escrito e estão gravadas na spec. Nenhuma delas
introduz violação nova; **três estreitam** o escopo e uma amplia de forma marginal:

| Decisão | Efeito sobre o plano |
| --- | --- |
| Fases do ciclo de serviço **não** animam (FR-021a) | Estreita. A proibição de `009/contracts/motion.md` §3 sobrevive inteira, e `ServiceStep` não é tocado. |
| Cartão de destino sem transformação (FR-031) | Estreita. A US3 fica inteiramente em `transition-colors`; o catálogo permanece em seis. |
| Adesivos encenam uma vez por sessão (FR-032a) | Acrescenta um sinalizador em memória, sem store e sem armazenamento — Princípio III e a regra de armazenamento intactos. |
| Interrupção parte do valor corrente (FR-018a) | Nenhum efeito estrutural: é o padrão da biblioteca, agora decidido em vez de herdado. |
| Aviso de rascunho fora da transição, com entrada própria (FR-021b) | Amplia em um ponto de uso. Não custa entrada no catálogo — o papel `enter` serve um irmão só, com defasagem zero. |

### Reavaliação após a Fase 1

Os três contratos não introduziram violação nova. A avaliação acima permanece, com uma
precisão: `Settle` anima posição, o que a 009 proibia categoricamente. A proibição foi
**substituída por uma fronteira** decidida na clarificação da spec, com portão declarado por
quem chama (`motion-catalog.md` §4) — não afrouxada em silêncio. Está no Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/010-app-motion-system/
├── plan.md              # Este arquivo
├── spec.md
├── research.md          # Fase 0 — R1 a R11
├── data-model.md        # Fase 1
├── quickstart.md        # Fase 1
├── contracts/           # Fase 1
│   ├── motion-catalog.md
│   ├── motion-scale.md
│   └── surfaces.md
├── checklists/
│   └── requirements.md
└── tasks.md             # Fase 2 — /speckit-tasks, não criado aqui
```

### Source Code (repository root)

```text
src/
├── domain/
│   └── rail/
│       └── stepDirection.ts        # NOVO — derivação pura de direção
├── ui/
│   ├── motion/
│   │   ├── index.ts                # ALTERADO — o barril passa a exportar seis
│   │   ├── scale.ts                # NOVO — origem única dos valores de tempo
│   │   ├── SpinningDisc.tsx        # ALTERADO — passa a ler da escala
│   │   ├── PulsingBar.tsx          # ALTERADO — idem
│   │   ├── CrossFade.tsx           # ALTERADO — idem
│   │   ├── StepTransition.tsx      # NOVO
│   │   ├── Stagger.tsx             # NOVO
│   │   └── Settle.tsx              # NOVO
│   └── Stickers.tsx                # ALTERADO — entrada escalonada
├── app/
│   ├── Wizard.tsx                  # ALTERADO — StepTransition só em volta da tela da etapa
│   ├── DraftRecoveryBanner.tsx     # ALTERADO — entrada própria, fora da transição
│   └── StepRail.tsx                # ALTERADO — CrossFade no disco, quick no preenchimento
├── features/
│   ├── review/ReviewScreen.tsx     # ALTERADO — Stagger + Settle na lista
│   ├── review/SearchProgress.tsx   # ALTERADO — corrige o comentário sobre a CSP
│   ├── connect/ConnectionChip.tsx  # ALTERADO — transição de cor
│   └── destinations/
│       ├── DestinationSelector.tsx     # ALTERADO — transição de cor
│       └── ExecutionOrderPanel.tsx     # ALTERADO — Settle na fila
└── styles/
    └── index.css                   # ALTERADO — @theme espelha a escala

eslint-rules/
└── index.js                        # ALTERADO — tp/no-raw-motion-values; mensagem da fechadura

tests/
├── unit/
│   ├── motion-catalog.spec.ts      # RENOMEADO de motion-surface.spec.ts
│   ├── motion-scale.spec.ts        # NOVO
│   ├── stagger.spec.ts             # NOVO
│   └── step-direction.spec.ts      # NOVO
└── components/
    ├── step-transition.spec.tsx    # NOVO
    ├── service-phases.spec.tsx     # NOVO — nenhuma fase do ciclo anima
    ├── review-motion.spec.tsx      # NOVO
    ├── destination-card.spec.tsx   # NOVO — cor sim, transformação não
    ├── stickers.spec.tsx           # NOVO — encena uma vez por sessão
    └── settle.spec.tsx             # NOVO

e2e/
└── motion.spec.ts                  # NOVO

docs/
└── style-guide.md                  # ALTERADO — §Movimento reescrita
```

**Structure Decision**: nenhuma estrutura nova. A feature respeita a fronteira
`src/domain/` × `src/services/` × `src/ui/` que já existe e não cria diretório de topo.
`src/ui/motion/` continua sendo a fechadura, e ganha um arquivo de dado (`scale.ts`) ao lado
das primitivas — o mesmo arranjo de `src/ui/icons.ts`, que é o mapa e o ponto de entrada ao
mesmo tempo.

`stepDirection` vai para `src/domain/rail/` e não para um diretório novo: `rail/` já é o lar
da regra que decide o que a trilha mostra a partir da posição no fluxo, e direção é a mesma
família de conhecimento.

## Complexity Tracking

| Violação | Por que é necessária | Alternativa mais simples, e por que foi descartada |
| --- | --- | --- |
| **Ampliação da exceção à simplicidade proporcional da 009** — a biblioteca passa de 3 para 6 usos e alcança o fluxo inteiro | A escolha da ferramenta foi do autor do projeto na 009 e a spec desta feature a confirma. As três primitivas novas fazem coisas que CSS puro não faz bem: coordenar entrada e saída de nós que o React desmonta (`AnimatePresence`), passar direção ao nó que já saiu (`usePresenceData`), e medir e compensar mudança de posição (`layout`). | **Escrever à mão.** A saída animada exigiria segurar o nó desmontado com estado próprio e um temporizador por nó — reimplementar `AnimatePresence` pior. **Não animar saída**, ficando só em entrada, era a alternativa realmente mais simples: foi descartada porque o FR-027 pede a saída da linha descartada, e uma lista que anima ao entrar e pisca ao sair é menos coerente do que uma que não anima. |
| **`Settle` anima posição**, o que `009/FR-010b` proibia categoricamente | US2 (acomodação após descarte) e US3 (fila reordenando) pedem exatamente isso, e sem elas as duas histórias perdem a maior parte do valor. | **Manter a proibição** era a alternativa e foi levada ao autor na clarificação da spec. O que se preserva é a **razão** da proibição, não o texto: o portão `idle` mantém a animação de posição fora de todo momento com requisição em voo, que é o que a 009 estava de fato protegendo. |
| **Escala de tempo em duas camadas** — TypeScript como origem, CSS como espelho | Movimento em JavaScript precisa dos valores como números; `transition-colors` do `Button`, do `Toggle` e do conector precisa deles como texto. | **Uma camada só.** CSS como origem exigiria `getComputedStyle` dentro de primitiva — acesso ao DOM na camada errada, uma leitura de layout por montagem, e quebra em `happy-dom`. TypeScript como origem sem espelho deixaria o CSS com os 150ms padrão do Tailwind. A duplicação é aceita **porque é verificada**, no molde de `no-secrets.spec.ts`. |
| **Quinta regra de lint local** (`tp/no-raw-motion-values`) | `duration-[350ms]` gera CSS válido, passa no `typecheck` e passa no build. É exatamente a categoria de erro que as outras quatro regras existem para pegar. | **Só o teste de unidade.** Ele alcança o `.css`, mas falha tarde — depois do commit, e não no editor. As duas juntas são a redundância que a 009 já adotou de propósito para a fechadura. |
