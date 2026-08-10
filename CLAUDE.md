# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Idioma

Todo o projeto — código, comentários, documentação, specs e commits — é escrito em
**português do Brasil**, com acentuação correta. Mantenha esse padrão em qualquer
arquivo novo ou editado.

## Comandos

```bash
npm run dev          # Vite em http://127.0.0.1:5173/ (host e porta são fixos — ver abaixo)
npm run build        # gera dist/ estático; injeta a CSP apenas no build
npm run preview      # serve o dist/ em http://127.0.0.1:4173/

npm test             # Vitest: tests/**/*.spec.{ts,tsx}, rede mockada com MSW
npm run test:coverage
npm run test:e2e     # Playwright: projetos `desktop` (1280px) e `narrow-375`
npm run lint         # ESLint, inclui as regras locais de eslint-rules/
npm run typecheck    # tsc --noEmit (strict + noUncheckedIndexedAccess)
```

Um arquivo ou teste isolado:

```bash
npx vitest run tests/unit/scoring.spec.ts
npx vitest run -t "FR-023"                 # filtra pelo nome do teste
npx playwright test e2e/reconnect.spec.ts --project=desktop
E2E_BASE_URL=http://127.0.0.1:8080 npx playwright test   # roda contra um dist/ já servido (SC-008)
```

**Portão local** (exigido pela constituição antes de qualquer commit): `npm run lint`,
`npm run typecheck` e `npm test` passando. `npm run test:e2e` antes de publicar mudança
no assistente, na autorização ou na criação de playlist.

O dev server é fixado em `127.0.0.1` porque as plataformas de OAuth recusam `localhost`
como Redirect URI — não troque por `localhost` nem por `0.0.0.0`.

## Constituição do projeto

`.specify/memory/constitution.md` é normativa e prevalece sobre qualquer outra
convenção. Cinco princípios, três deles não negociáveis:

1. **Sem servidor próprio** — o artefato é estático, servível de qualquer subpasta.
   Sem endpoint, banco, proxy ou função serverless, nem "só para desenvolvimento".
2. **Nenhum segredo, superfície de rede fechada** — Client Secret jamais é pedido ou
   guardado. Os destinos de rede são uma lista fechada em
   `src/services/providers/hosts.ts` (3 hosts por provedor); acrescentar host é
   **emenda à constituição**, não decisão de implementação.
3. **Domínio puro, I/O isolado** — ver a seção de arquitetura.
4. **Invariante sem teste não é invariante** — toda regra vira teste ou regra de lint.
5. **Nenhuma escrita sem confirmação explícita** — nada é escrito na conta do usuário
   antes da confirmação da revisão **daquele serviço**.

Mudanças de comportamento passam pelo fluxo Spec Kit (`/speckit-specify` →
`/speckit-plan` → `/speckit-tasks` → `/speckit-implement`), com os artefatos em
`specs/NNN-nome/`. Correção de defeito, ajuste de texto e refatoração sem mudança
observável estão dispensados.

## Arquitetura

SPA React 19 + Zustand + Tailwind CSS 4, 100% cliente. Alias `@/` → `src/`.

**A fronteira que importa é `src/domain/` × `src/services/`:**

- `src/domain/` — puro e determinístico: sem rede, sem DOM, sem armazenamento, sem
  relógio ambiente, sem aleatoriedade não injetada. Parser, normalização, pontuação,
  dedupe, batching, cota, validação, `run/` (fila e ciclo de execução), `rail/`,
  `theme/`. É onde vive a maior parte dos testes.
- `src/services/` — todo o I/O, atrás de interfaces mockáveis: `providers/` (adaptadores),
  `storage/` (localStorage versionado), `rate-limiter.ts`.
- `src/features/` e `src/app/` — apenas orquestração. Não contêm regra de negócio nem
  chamam `fetch` diretamente.

**Provedores como dados, não como `if`.** `PlaylistProvider`
(`src/services/providers/types.ts`) é o contrato; `ProviderCapabilities`
(`src/domain/providers.ts`) carrega toda diferença de comportamento — cota, renovação
silenciosa, `batchSize`, exibição de álbum. **Nenhum arquivo fora de
`src/services/providers/{provider}/` ramifica por `ProviderId`**; a única exceção
deliberada é o i18n, que precisa de texto por serviço. A ordem de execução e de exibição
vem só de `PROVIDER_ORDER`, e um provedor com orçamento diário nunca precede um sem.
Acrescentar um terceiro serviço é implementar a interface e registrá-lo em
`providers/registry.ts`.

**O ciclo por serviço é um redutor puro.** `src/domain/run/machine.ts`:
`pending → connect → estimate? → search → review → creating → done`, com saídas
`skipped`/`failed` e a fase `awaiting_reauth` (perda de sessão no meio do trabalho).
Invariantes centrais: execução com `outcome !== null` é imutável, e `review_confirmed`
é o **único** caminho para `creating`.

**Fluxo do assistente** — `WIZARD_STEPS` em `src/domain/types.ts`:
`credential → destinations → input → service → summary`. A etapa `service` é um ciclo
completo por destino, um de cada vez.

**Estado** — store Zustand único composto por slices (`src/store/index.ts`). O rascunho
tem persistência **seletiva** (`draftPersistence.ts`): nunca contém token nem Client ID.

**Armazenamento** — chaves versionadas e tipadas em `src/services/storage/schema.ts`.
Credencial, sessão, autorização em voo e cota são **funções de `ProviderId`**
(`tp.v2.credential.${provider}` etc.), o que torna estruturalmente impossível apagar os
dados de um serviço e alcançar os de outro. `tp.v2.draft` e `tp.v2.theme` são literais.
A leitura nunca lança: dado corrompido ou de versão desconhecida vira `null` + aviso,
nunca migração às cegas.

## Regras de lint locais (`eslint-rules/index.js`)

Existem porque são erros que **não falham** — nem o TypeScript nem o build reclamam:

- `tp/no-ui-text-literals` — todo texto visível vem de `src/i18n/pt-BR.ts`. Vale em
  `src/**/*.tsx`, com o próprio i18n e os testes dispensados.
- `tp/no-dynamic-classname` — o scanner do Tailwind lê o código como texto; `className`
  montado por template ou concatenação simplesmente não emite CSS. Use mapas de
  literais completos.
- `tp/no-raw-visual-values` — valores visuais só vêm da camada de tokens. Proíbe valor
  arbitrário em colchetes, a paleta crua do Tailwind, `bg-brand-*` (cor de marca é
  acento identificador, nunca preenchimento acionável), o âmbar como tinta de texto
  (`--accent-text` é o token certo) e os utilitários removidos na feature 007.
- `tp/no-icon-library-import` — `src/ui/icons.ts` é o **único** arquivo que importa de
  `react-icons`, sempre por subcaminho (`react-icons/lu`, `react-icons/pi`), nunca pelo
  índice raiz. Superfícies pedem um papel: `<Icon role="advance" />`.

## Sistema visual

Duas camadas: `src/styles/tokens.css` define os valores brutos por tema (a origem única
do que muda entre temas) e `src/styles/index.css` mapeia os nomes semânticos num
`@theme inline` — o modificador `inline` é o que emite `var(--…)` em vez do hex
resolvido, e sem ele a troca por `[data-theme]` não funciona. `--color-*: initial`
derruba a paleta padrão do Tailwind de propósito.

`docs/style-guide.md` é o árbitro de decisões visuais futuras; ele **descreve** o
código, e divergência entre os dois se resolve corrigindo o guia, nunca duplicando um
valor. `src/domain/theme/approvedPairs.ts` é a lista fechada de pares de contraste, e os
números do guia são produzidos por `tests/unit/contrast.spec.ts`.

## Testes

- `tests/unit/` — domínio puro e portões constitucionais: `no-secrets.spec.ts` (falha se
  um host escapar da tabela, tanto por ausência quanto por excesso),
  `no-orphan-tokens.spec.ts`, `throughput.spec.ts`, `contrast.spec.ts`,
  `i18n-stability.spec.ts`, `storage-migration.spec.ts`.
- `tests/integration/` — MSW com `onUnhandledRequest: 'error'`: qualquer requisição fora
  dos contratos de API quebra o teste em vez de vazar.
- `tests/components/`, `tests/a11y/` — Testing Library e axe-core (nenhuma violação
  séria ou crítica).
- `e2e/` — Playwright com **os dois** provedores mockados (`e2e/support/`), incluindo o
  guarda de rede (`network-guard.ts`) e o viewport de 375 px.

Nenhum teste toca a rede real. Testes que existem para garantir um requisito **citam o
identificador** (`FR-xxx`, `SC-xxx`) no nome ou em comentário — mantenha a prática.

## Convenções

- Comentários explicam **por que**, com referência ao requisito ou à seção do research
  que originou a decisão. Os arquivos existentes são densos nisso; siga o mesmo padrão
  em vez de escrever comentários descritivos do óbvio.
- `import type` obrigatório (`consistent-type-imports`, `verbatimModuleSyntax`).
- Sem biblioteca de componentes de UI e sem SDK oficial de provedor — posição padrão do
  projeto. Dependência nova exige justificativa escrita contra a alternativa de escrever
  à mão, registrada no Complexity Tracking do plano.
- Suprimir erro de tipo com `any` ou `@ts-expect-error` exige comentário explicando por quê.

## Referências

- `README.md` — operação, obtenção dos Client IDs, Redirect URI, privacidade e riscos
  aceitos.
- `specs/NNN-*/` — spec, plan, research, data-model, contracts e tasks de cada feature.
  Os `contracts/` são a definição normativa de tokens, storage e APIs.
