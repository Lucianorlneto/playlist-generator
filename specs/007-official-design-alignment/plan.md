# Implementation Plan: Readequação da interface ao design oficial

**Branch**: `refactor/design` | **Date**: 2026-08-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-official-design-alignment/spec.md`

## Summary

A feature troca o **esqueleto** e os **valores** da interface, preservando
integralmente o comportamento. Sai a coluna única centralizada de 46rem com a
goteira numerada; entra uma casca de três zonas — barra superior permanente,
trilha vertical de etapas, área principal com barra de ações em duas telas.
Sai a paleta marinho/âmbar da 005; entra a paleta quase-preta do arquivo de
design, com quatro degraus de superfície, cores de marca por provedor e o âmbar
deslocado de `#f4a900` para `#F5B301`.

A abordagem técnica se apoia inteiramente na maquinaria que a 005 já deixou
pronta e que **não muda de forma**: `src/styles/tokens.css` continua sendo a
origem única dos valores por tema, `src/styles/index.css` continua mapeando
nomes semânticos e escalas finitas, `src/domain/theme/approvedPairs.ts` continua
sendo a lista fechada de pares, e `tests/unit/contrast.spec.ts` continua sendo a
autoridade sobre os números. O trabalho é **repovoar** essas estruturas e
acrescentar três: um mapa de papéis de ícone, um módulo puro que decide a
composição da trilha, e um conjunto de asserções estruturais que substitui a
comparação visual humana como portão.

O maior risco não é técnico, é de cobertura: o Tailwind não erra quando um
utilitário deixa de existir — ele simplesmente não emite CSS, e a tela fica sem
estilo sem que nada falhe. A 005 resolveu isso com `tests/unit/no-orphan-tokens.spec.ts`,
e esta feature repete a técnica com a nova denylist.

## Technical Context

**Language/Version**: TypeScript 5 em modo `strict`, React 19.2

**Primary Dependencies**: Vite 7 · Tailwind CSS 4.3.3 (`@theme inline`) · Zustand 5 · **`react-icons` (nova, ver Complexity Tracking)**

**Storage**: `localStorage` do navegador, chaves versionadas e tipadas. **Sem mudança nesta feature** — nenhuma chave nova, nenhum formato alterado.

**Testing**: Vitest + Testing Library (unidade, componente, integração) · MSW (rede mockada) · axe-core (`tests/a11y/`) · Playwright (`e2e/`) · regras de lint locais em `eslint-rules/`

**Target Platform**: navegadores modernos de mesa e telefone; artefato estático servível de qualquer diretório

**Project Type**: aplicação web de página única, sem servidor próprio

**Performance Goals**: inalterados — busca sustenta ≥ 2 linhas/s com progresso visível. **Novo**: conteúdo de cada etapa legível e operável antes de qualquer recurso decorativo terminar de carregar (SC-019), sem deslocamento na chegada (SC-020)

**Constraints**: sem teto de peso para decoração por decisão registrada (FR-069) — a primeira visita transfere ~930 KB de recurso decorativo; a proteção é comportamental. Nenhuma rolagem horizontal de 320px a 1920px. Contraste verificado por teste nos dois temas.

**Scale/Scope**: 11 telas do arquivo de design · 5 etapas do assistente · 2 temas · 2 larguras · ~18 tokens de cor · 17 papéis de ícone (16 de biblioteca + a marca em arte) · ~30 componentes tocados

## Constitution Check

_GATE: obrigatório antes da Fase 0; reavaliado após a Fase 1._

### Avaliação inicial (antes da Fase 0)

| Princípio / Regra | Situação | Como esta feature se comporta |
| --- | --- | --- |
| **I. Sem Servidor Próprio** (NN) | ✅ Passa | Nenhum endpoint, processo ou função. Recursos gráficos e ícones são empacotados no build e servidos da mesma origem. |
| **II. Nenhum Segredo, Superfície de Rede Fechada** (NN) | ✅ Passa | Nenhum destino de rede novo. A URL de terceiro que o arquivo de design usava no fundo ambiente **não sobrevive** à transcrição (FR-048); `react-icons` é empacotada, não buscada (FR-057). `e2e/no-remote-origin.spec.ts` é o portão existente e passa a cobrir também os recursos decorativos. |
| **III. Domínio Puro, I/O Isolado** | ✅ Passa | A decisão de **quais** degraus a trilha exibe, sua numeração e qual linha de apoio cada um recebe é regra, não apresentação — vai para `src/domain/rail/`, pura e determinística. Componentes só a consomem. |
| **IV. Invariante Sem Teste Não É Invariante** | ✅ Passa | Todo FR com consequência observável ganha verificação: contraste e pares (teste existente, repovoado), tokens órfãos (denylist nova), asserções estruturais (FR-071 a FR-074), axe, teclado, largura estreita, origem remota. |
| **V. Nenhuma Escrita Sem Confirmação** (NN) | ✅ Passa | Nenhuma mudança de fluxo de escrita. FR-065 preserva explicitamente a confirmação de descarte da 006, e `tests/components/reset-flow.spec.tsx` continua sendo o portão. |
| **Honestidade sobre limites da plataforma** | ✅ Passa | Nenhuma capacidade simulada. FR-066 vai além: proíbe a trilha de afirmar uma escolha que o usuário não fez, ainda que o mockup a mostre. |
| **Assimetria entre provedores** | ✅ Passa | Os chips de conexão expõem o estado real de cada provedor lado a lado, com estados independentes — é mais exposição de assimetria, não menos. |
| **Idioma pt-BR, texto em `src/i18n/`** | ✅ Passa | Todo rótulo novo — "Etapas", linhas de apoio, textos de estado da barra de ações — entra no dicionário. `tp/no-ui-text-literals` é o portão. |
| **Acessibilidade** | ✅ Passa | FR-038 a FR-042 e FR-058 endereçam teclado, foco, anúncio único, largura estreita e ícone nunca como único portador de significado. |
| **Desempenho** | ⚠️ Atenção | A vazão da busca não é tocada. O novo risco é a decoração; endereçado por FR-050, FR-068 e FR-070, com SC-019 e SC-020 como portões. |
| **Simplicidade proporcional** | ⚠️ **Exceção registrada** | `react-icons` é dependência nova, e a posição padrão do projeto é escrever à mão. Ver **Complexity Tracking**. |
| **Armazenamento** | ✅ Passa | Nenhuma chave nova, nenhum formato alterado, nenhuma migração. |
| **Fluxo Spec Kit** | ✅ Passa | `/speckit-specify` → `/speckit-clarify` (2 sessões, 10 decisões) → este plano. |
| **Rastreabilidade** | ✅ Passa | Todo teste novo cita o `FR-xxx` / `SC-xxx` que garante, como já é praticado. |

**Veredito**: portão **passa** com uma exceção registrada (`react-icons`) e um
ponto de atenção (peso da decoração) que a própria spec já converteu em
requisito verificável.

### Reavaliação (após a Fase 1)

Refeita depois de `data-model.md` e dos contratos. **Nenhuma violação nova.**
Três observações que o desenho da Fase 1 produziu:

1. **Princípio III ficou mais forte, não mais fraco.** Ao extrair a composição
   da trilha para `src/domain/rail/`, a regra "a etapa Resumo só existe com mais
   de um destino" — hoje espalhada entre `StepIndicator` e o redutor da fila —
   passa a ter um lar único e testável sem DOM.
2. **A lista fechada de pares aprovados cresce de 15 para 27 combinações**
   (`contracts/tokens.md` §2). O crescimento vem das zonas novas: texto e ícone
   sobre a superfície da barra superior e da trilha são substratos que não
   existiam. Isso reforça o Princípio IV — mais superfície coberta pelo mesmo
   portão, e todos os 27 já verificados na Fase 0 sem reprovação.
3. **A medição de contraste alterou o desenho, não só os valores**
   (`research.md` §3). Além de nove cores ajustadas, o achado que importa é
   estrutural: a hierarquia de três tintas do design não sobrevive ao piso de
   4,5:1 em nenhum dos temas — tudo que é fraco o bastante para parecer
   "pendente" reprova, e tudo que passa parece "secundário". O token `--ink-faint`
   foi descartado antes de nascer, e a etapa pendente passa a se distinguir por
   **forma** (disco vazado / tingido / preenchido), que é o que FR-011 e FR-042 já
   exigiam. FR-003 previa o ajuste de valor; o mecanismo entregou mais do que
   isso, e sem exceção constitucional.
4. **A disciplina de token da 005 se pagou.** Catorze dos dezoito tokens de cor
   mantêm o nome exato, porque a 005 nomeou por papel e não por aparência
   (`contracts/token-migration.md` §1). A migração de cor é quase inteiramente um
   trabalho em `tokens.css`, não nos componentes.

## Project Structure

### Documentation (this feature)

```text
specs/007-official-design-alignment/
├── plan.md              # Este arquivo
├── research.md          # Fase 0
├── data-model.md        # Fase 1
├── quickstart.md        # Fase 1
├── contracts/           # Fase 1
│   ├── tokens.md            # Paleta, escalas, pares aprovados
│   ├── shell.md             # As três zonas, trilha, barra de ações
│   ├── icons.md             # Papéis de ícone e o mapa único
│   ├── decor.md             # Recursos decorativos e carregamento
│   └── token-migration.md   # 005 → 007, nome a nome
├── checklists/
│   └── requirements.md
└── tasks.md             # Fase 2 (/speckit-tasks — não criado aqui)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── App.tsx                  # ajustado: envolve o Shell
│   ├── Shell.tsx                # NOVO — as três zonas
│   ├── Topbar.tsx               # NOVO — marca, chips, tema
│   ├── StepRail.tsx             # NOVO — trilha vertical (substitui StepIndicator)
│   ├── StepSummary.tsx          # NOVO — resumo compacto de largura estreita
│   ├── ActionBar.tsx            # NOVO — Destinos e Entrada apenas
│   ├── StepIndicator.tsx        # REMOVIDO
│   ├── Wizard.tsx               # reescrito: deixa de montar o cabeçalho
│   ├── DraftRecoveryBanner.tsx  # redesenhado
│   └── ResetFlow.tsx            # movido para o rodapé da trilha
├── domain/
│   ├── rail/index.ts            # NOVO — puro: degraus, numeração, linha de apoio
│   └── theme/approvedPairs.ts   # repovoado
├── features/
│   ├── connect/ConnectionChip.tsx  # NOVO — absorve SessionHeader
│   ├── theme/ThemeControl.tsx      # redesenhado; ícones vêm do mapa
│   └── …                           # demais telas redesenhadas
├── ui/
│   ├── icons.ts                 # NOVO — mapa único papel → componente
│   ├── Icon.tsx                 # NOVO — envoltório: tamanho, cor, semântica
│   ├── AmbientBackdrop.tsx      # NOVO — decoração de fundo
│   ├── Stickers.tsx             # NOVO — adesivos da etapa de Destinos
│   └── …                        # Button, TextField, Dialog… redesenhados
├── styles/
│   ├── tokens.css               # repovoado: nova paleta, 4 degraus de superfície
│   └── index.css                # escalas renormalizadas, utilitários novos
├── assets/
│   ├── imgs/                    # fundo, fotografia, 11 adesivos, marca (fornecidos)
│   └── fonts/                   # inalterado
└── i18n/pt-BR.ts                # rótulos novos da casca

tests/
├── unit/
│   ├── contrast.spec.ts         # repovoado
│   ├── no-orphan-tokens.spec.ts # nova denylist
│   ├── rail-composition.spec.ts # NOVO — domínio puro da trilha
│   └── icon-roles.spec.ts       # NOVO — mapa completo, sem import avulso
├── components/
│   ├── shell.spec.tsx           # NOVO — asserções estruturais das zonas
│   ├── step-rail.spec.tsx       # NOVO
│   ├── action-bar.spec.tsx      # NOVO
│   └── connection-chip.spec.tsx # NOVO
├── a11y/steps.spec.tsx          # estendido: dois temas, duas larguras
└── …

e2e/
├── narrow-viewport.spec.ts      # estendido: colapso da trilha
├── no-remote-origin.spec.ts     # estendido: recursos decorativos
├── decor-loading.spec.ts        # NOVO — SC-019, SC-020
└── …

docs/
└── style-guide.md               # reescrito (FR-043, FR-044)

eslint-rules/index.js            # `tp/no-raw-visual-values` atualizado; regra de ícone nova
```

**Structure Decision**: a estrutura existente é mantida e estendida — nenhuma
reorganização de diretórios. A única fronteira nova é `src/domain/rail/`, criada
para satisfazer o Princípio III: a composição da trilha é regra de negócio
(quais etapas existem, como se numeram, o que cada uma declara), e regra de
negócio não mora em componente. `src/ui/icons.ts` é o ponto único que FR-059
exige, e existe para que trocar o ícone de um papel custe uma edição em vez de
uma varredura.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| **Dependência nova: `react-icons`** — contraria a posição padrão de "Simplicidade proporcional", que diz que o ônus da prova é de quem adiciona | Decisão explícita e reafirmada do autor do projeto (FR-055, clarificação de 2026-08-08), como padronização: os 16 ícones de interface vêm dos dois conjuntos que o próprio arquivo de design referencia (Lucide e Phosphor), e o nome de cada ícone no design mapeia para um componente rastreável em vez de um caminho SVG anônimo. A marca é o décimo sétimo papel e ficou fora da biblioteca — vem de `Logo Mark.png`, como arte (clarificação de 2026-08-09). Evita divergência silenciosa quando o design for atualizado. | **Transcrever os 16 SVGs à mão** para um módulo local é a alternativa mais simples e é honestamente viável: ~16 blocos de `path`, zero dependência, zero risco de arrastar peso morto, e é o que a aplicação já faz hoje nos três ícones do `ThemeControl`. Foi rejeitada por decisão de padronização do autor, **não por inviabilidade técnica**. Registrado aqui para que a escolha fique auditável, como a constituição exige. Mitigações obrigatórias: importação por subcaminho (FR-056), mapa único de papéis (FR-059), e SC-018 medindo o pacote antes e depois. |
| **~930 KB de recurso decorativo sem teto de peso** — tensiona a regra de desempenho | Decisão explícita do autor (FR-069, clarificação de 2026-08-09), com a consequência conhecida e registrada. | Um teto de 150 KB com recompressão foi proposto e recusado. A proteção passa a ser comportamental em vez de dimensional: carregamento diferido (FR-068), conteúdo operável antes da decoração (FR-050), espaço pré-dimensionado (FR-070), tela utilizável sem imagem alguma (SC-014). Os portões são SC-019 e SC-020. |
