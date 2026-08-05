# Implementation Plan: Importador de Playlist por Texto (Text-to-Playlist)

**Branch**: `001-text-to-playlist` | **Data**: 2026-08-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-text-to-playlist/spec.md`

## Summary

Aplicação web de página única, 100% cliente, que transforma uma lista de texto `música - artista` em uma playlist do Spotify, passando por uma etapa obrigatória de revisão humana antes de qualquer escrita na conta do usuário.

**Abordagem técnica**: SPA em React + TypeScript compilada pelo Vite para arquivos estáticos, sem nenhum componente de servidor. A autorização usa OAuth 2.0 Authorization Code + PKCE — o único fluxo do Spotify que dispensa segredo de cliente e backend, o que satisfaz simultaneamente FR-006 e SC-008. O Client ID é informado na interface e guardado no `localStorage`, mascarado por padrão.

O núcleo de valor é um conjunto de **módulos de domínio puros** (análise de linhas, normalização, pontuação de similaridade, deduplicação, particionamento em lotes) sem nenhuma dependência de rede ou DOM — é onde vivem as regras da spec e onde se concentra o esforço de teste. Em volta deles, uma camada fina de serviços faz a conversa com a Spotify Web API, com limitador de vazão próprio (5 req/s, concorrência 4, backoff respeitando `Retry-After`) dimensionado para cumprir os ≥ 2 linhas/s de FR-027 sem provocar limitação sistemática.

Duas garantias estruturais atravessam o desenho: **o rascunho de trabalho é gravado no dispositivo** e sobrevive a recarga, expiração de sessão e reconexão (SC-006); e a **adição de faixas é feita em lotes sequenciais de 100 com índice de confirmação persistido**, o que torna a retomada após falha parcial livre de duplicatas e de faltantes (SC-009).

## Technical Context

**Language/Version**: TypeScript 5.x em modo `strict`, alvo ES2022 · Node.js ≥ 22 apenas para build e testes (o artefato final não roda Node)

**Primary Dependencies**: React 19 · Vite 7 · Tailwind CSS 4.3 (plugin `@tailwindcss/vite`, configuração CSS-first) · Zustand (estado + persistência seletiva) · nenhuma biblioteca de componentes de UI · nenhum SDK do Spotify (o cliente HTTP é próprio, sobre `fetch`)

**Storage**: `localStorage` para credencial, sessão e rascunho; `sessionStorage` para o `code_verifier` do PKCE. Sem banco de dados, sem servidor. Esquema em [contracts/storage.md](./contracts/storage.md)

**Testing**: Vitest + Testing Library + happy-dom (unitários e de componente) · MSW (integração com o contrato HTTP) · Playwright (E2E, incluindo viewport de 375 px) · axe-core (acessibilidade)

**Target Platform**: Navegadores modernos de desktop (Chrome/Edge/Firefox/Safari, 2 últimas versões). Telas estreitas suportadas em nível de usabilidade, sem layout dedicado (FR-047)

**Project Type**: Aplicação web estática de página única, sem backend

**Performance Goals**: ≥ 2 linhas/s sustentadas na busca (FR-027); 50 linhas em ≤ 30 s e 250 linhas em ≤ 2 min (SC-010); progresso visível e cancelamento responsivo em qualquer momento, inclusive durante espera por limitação (SC-011)

**Constraints**: nenhum componente de servidor próprio (SC-008) · nenhum Client Secret solicitado, aceito ou armazenado (FR-005) · nenhum tráfego para destino fora dos hosts oficiais do Spotify (FR-010) · nenhuma escrita na conta antes de confirmação explícita na revisão (FR-031) · rascunho ≈ 400 KB no pior caso previsto, dentro do orçamento de `localStorage` · toda a interface em pt-BR (FR-048)

**Scale/Scope**: um usuário por navegador · caso de uso real ≤ 50 linhas, robustez verificada até 250 e aviso acima de 500 · 4 etapas de interface · 8 endpoints do Spotify consumidos

## Constitution Check

_GATE: deve passar antes da Fase 0. Reavaliado após a Fase 1._

**Estado da constituição**: `.specify/memory/constitution.md` ainda é o template não preenchido — todos os princípios são placeholders (`[PRINCIPLE_1_NAME]`, etc.) e não há versão ratificada. **Não há gates ratificados para verificar.**

Isso não é uma violação e não bloqueia o planejamento; é uma ausência. Registrada aqui para ficar rastreável: se o projeto adotar uma constituição depois, este plano deve ser reavaliado contra ela. Rodar `/speckit-constitution` antes de `/speckit-tasks` é opcional e ficaria mais barato agora do que depois da implementação.

Na falta de princípios ratificados, o plano se disciplina pelas restrições que a **própria spec** impõe. São elas que funcionam como gate:

| Gate derivado da spec                          | Origem              | Situação (pré-Fase 0)                        | Situação (pós-Fase 1)                                                                                                                                                                                                                                                           |
| ---------------------------------------------- | ------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sem componente de servidor próprio             | SC-008, FR-006      | ✅ SPA estática, PKCE no navegador           | ✅ Nenhum endpoint próprio em nenhum contrato                                                                                                                                                                                                                                   |
| Nenhum segredo de cliente                      | FR-005              | ✅ Fluxo PKCE não usa segredo                | ✅ Nenhuma entidade tem campo de segredo; verificação por `grep` no quickstart                                                                                                                                                                                                  |
| Permissões mínimas                             | FR-007              | ✅ 3 escopos definidos                       | ✅ `user-read-private` explicitamente descartado ([research §3](./research.md))                                                                                                                                                                                                 |
| Nenhum dado a terceiros                        | FR-010              | ✅                                           | ✅ Lista fechada de hosts em [contracts/spotify-api.md](./contracts/spotify-api.md)                                                                                                                                                                                             |
| Sem funcionalidade de pastas, real ou simulada | FR-038              | ✅                                           | ✅ Nenhum campo de pasta no modelo de dados                                                                                                                                                                                                                                     |
| Confirmação humana antes de escrever           | FR-031, SC-003      | ✅ Revisão obrigatória entre busca e criação | ✅ Escrita só existe no fluxo pós-confirmação                                                                                                                                                                                                                                   |
| Simplicidade proporcional ao problema          | Assumptions da spec | ✅                                           | ✅ Sem biblioteca de componentes, sem SDK, sem IndexedDB — justificados em [research §11 e §8](./research.md). Tailwind é CSS utilitário com zero runtime, não uma biblioteca de componentes: não traz comportamento de acessibilidade de terceiros para auditar (research §14) |

**Veredito**: sem violações. Complexity Tracking permanece vazio.

## Project Structure

### Documentation (this feature)

```text
specs/001-text-to-playlist/
├── plan.md              # Este arquivo
├── spec.md              # Especificação da feature
├── research.md          # Fase 0 — 13 decisões técnicas
├── data-model.md        # Fase 1 — entidades, estados, invariantes
├── quickstart.md        # Fase 1 — execução e cenários de validação
├── contracts/           # Fase 1
│   ├── spotify-api.md   #   superfície consumida da Web API (contrato externo)
│   ├── storage.md       #   esquema do armazenamento local
│   └── domain-api.md    #   assinaturas dos módulos puros
├── checklists/
│   └── requirements.md  # Qualidade da spec (16/16)
└── tasks.md             # Fase 2 — gerado por /speckit-tasks, NÃO por este comando
```

### Source Code (repository root)

```text
index.html                        # ponto de entrada; CSP restritiva
vite.config.ts                    # server.host = '127.0.0.1' (Redirect URI) + plugin @tailwindcss/vite
package.json · tsconfig.json · playwright.config.ts

src/
├── main.tsx
├── app/
│   ├── App.tsx                   # orquestra as 4 etapas
│   ├── Wizard.tsx                # navegação linear Credencial → Entrada → Revisão → Resultado
│   └── DraftRecoveryBanner.tsx   # FR-044
├── features/
│   ├── credential/               # campo mascarado, revelar, remover, Redirect URI copiável (US1)
│   ├── connect/                  # início do PKCE, retorno, perfil, desconectar (US1)
│   ├── input/                    # área de texto, análise, disparo da busca (US2)
│   ├── review/                   # tabela/cartões, alternativas, edição por linha, seleção (US2)
│   └── result/                   # link, caminho efetivo, aviso de pastas, falhas copiáveis (US3)
├── domain/                       # PURO — sem rede, sem DOM
│   ├── parser/                   # FR-012 a FR-017
│   ├── normalize/                # research §6
│   ├── scoring/                  # pontuação + thresholds.ts calibrável
│   ├── dedupe/                   # FR-018
│   ├── batching/                 # ordem, lotes de 100, retomada (FR-032, FR-033)
│   └── validation/               # FR-028, FR-029, FR-035
├── services/
│   ├── spotify/
│   │   ├── auth.ts               # PKCE: challenge, state, troca, renovação coalescida
│   │   ├── client.ts             # fetch + 401→renova→repete + 429→Retry-After
│   │   ├── search.ts             # busca por campos + fallback texto livre
│   │   └── playlists.ts          # /me, /me/playlists, criar, adicionar em lotes
│   ├── rate-limiter.ts           # token bucket + concorrência + cancelamento
│   └── storage/                  # repositórios tipados e versionados
├── store/                        # slices Zustand + persistência seletiva do rascunho
├── ui/                           # componentes compartilhados acessíveis (utilitários Tailwind)
├── i18n/pt-BR.ts                 # todos os textos da interface (FR-048)
└── styles/
    └── index.css                 # @import "tailwindcss" + @theme (tokens) + @utility (recorrências)

tests/
├── unit/                         # domínio puro — maior densidade de testes
├── integration/                  # serviços contra MSW: 401, 429, paginação, falha parcial
├── fixtures/reference-50.json    # dataset que valida SC-002
└── a11y/                         # axe-core nas 4 etapas

e2e/                              # Playwright: fluxo completo, 375 px, retorno do redirect
```

**Structure Decision**: projeto único na raiz do repositório. Não há divisão frontend/backend porque não existe backend — SC-008 exige que o artefato final seja servível de qualquer hospedagem estática. A separação que importa neste desenho não é por camada de rede, e sim entre `src/domain/` (puro, determinístico, onde estão as regras da spec e a maior parte dos testes) e `src/services/` (todo o I/O, isolado atrás de interfaces mockáveis). `src/features/` acompanha as quatro etapas da interface, o que faz cada User Story mapear para um diretório e permite entregá-las em fatias verticais independentes.

## Complexity Tracking

> Preenchido apenas se o Constitution Check tiver violações a justificar.

Sem violações. Nenhuma entrada.
