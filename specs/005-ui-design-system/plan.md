# Implementation Plan: Identidade Visual e Sistema de Design

**Branch**: `refactor/ui` | **Date**: 2026-08-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-ui-design-system/spec.md`

## Summary

Substituir a interface genérica atual por uma identidade visual própria com dois temas
completos — claro e escuro —, um sistema de tokens como origem única de todo valor visual, e um
guia de estilo escrito no repositório.

A abordagem técnica tem quatro peças. **Tokens em duas camadas de variáveis CSS**: valores
brutos por tema em `:root` e `[data-theme='dark']`, nomes semânticos em `@theme inline`, de modo
que trocar de tema seja mudar um atributo — sem recarregar e sem recompor React. **Preferência
de tema** como estado puro no domínio (`resolveTheme`) e I/O isolado num repositório versionado,
com a piscada de carga resolvida por `@media (prefers-color-scheme)` no CSS mais um script
bloqueante de mesma origem, porque o CSP do build proíbe script inline. **Space Grotesk variável
subsetada e versionada** no repositório, sem entrada nova no `package.json`. E **quatro portões
automatizados** — matriz de contraste, acessibilidade nos dois temas, ausência de origem remota
e regra de lint contra valor visual avulso — porque nenhum invariante desta feature sobrevive
como prosa.

A direção visual está em [design.md](./design.md). O elemento-assinatura é a **goteira numerada**:
o número da linha que a pessoa colou acompanha a faixa da entrada até o relatório de falhas,
transformando a chave primária do domínio em recurso gráfico.

## Technical Context

**Language/Version**: TypeScript 5.9 em modo `strict`, ES2022, React 19.2

**Primary Dependencies**: Tailwind CSS 4.3.3 (configuração CSS-first, sem `tailwind.config.js`),
Zustand 5, Vite 7. **Nenhuma dependência nova.** A fonte entra como arquivo versionado, não como
pacote.

**Storage**: `localStorage` do navegador, chave `tp.v2.theme`, sob a infraestrutura versionada de
`src/services/storage/schema.ts`

**Testing**: Vitest com happy-dom (unitário, componente, integração), axe-core (acessibilidade),
MSW (integração), Playwright (ponta a ponta), ESLint com regras próprias em `eslint-rules/`

**Target Platform**: navegadores modernos; artefato estático servível de qualquer subdiretório

**Project Type**: SPA cliente, sem servidor próprio

**Performance Goals**: troca de tema refletida em menos de 100 ms (SC-003); tema correto no
primeiro quadro pintado em 100% das cargas (SC-004); nenhum deslocamento de conteúdo ao concluir
a carga da fonte (SC-015)

**Constraints**: teto de 80 KB comprimidos em recursos tipográficos (SC-013); `script-src 'self'`
no CSP de produção, script inline bloqueado; sem rolagem horizontal em 320 px (SC-011); zero
violação séria ou crítica de acessibilidade nos dois temas (SC-002)

**Scale/Scope**: 5 etapas do assistente, ~12 componentes reutilizáveis em `src/ui/`, ~30
componentes de feature, 2 temas, ~40 tokens

## Constitution Check

_GATE: avaliado antes da Fase 0 e reavaliado após a Fase 1._

### Avaliação inicial (antes da Fase 0)

| Princípio | Situação | Como esta feature se comporta |
| --- | --- | --- |
| **I. Sem Servidor Próprio** | ✅ Passa | Nada de endpoint, processo ou rota. A fonte é arquivo do próprio build; o `theme-boot.js` é estático servido de `public/`. O `base: './'` continua permitindo servir de subdiretório. |
| **II. Nenhum Segredo, Superfície de Rede Fechada** | ✅ Passa | Nenhum host novo. A fonte é embarcada, não vem de CDN. **O CSP não é alterado** — a solução de FR-010 foi desenhada para caber em `script-src 'self'` em vez de afrouxá-lo (research §2). |
| **III. Domínio Puro, I/O Isolado** | ✅ Passa | `resolveTheme` e o cálculo de contraste são funções puras em `src/domain/`. `matchMedia` e `localStorage` ficam em `src/services/`. Componentes só orquestram. |
| **IV. Invariante Sem Teste Não É Invariante** | ✅ Passa | Quatro portões novos (research §5, §6, §10, §11) mais o teste de sincronia da chave duplicada em `theme-boot.js` (research §2). |
| **V. Nenhuma Escrita Sem Confirmação** | ✅ Passa | Intocado. A troca de tema não interrompe execução em andamento nem toca o rascunho (FR-007). |

**Restrições de Plataforma**: idioma — textos novos do controle de tema entram em `src/i18n/`,
sob a regra `tp/no-ui-text-literals`. Acessibilidade — auditoria duplicada por tema, foco por
`outline` para sobreviver a cores forçadas. Armazenamento — chave versionada, isolada por
construção. Desempenho — não afetado; a troca de tema não toca a vazão da busca.

**Simplicidade proporcional**: uma única adição externa, a fonte. Justificada por escrito em
FR-034 e limitada por SC-013. Nenhuma biblioteca de componentes (FR-024). Ver Complexity Tracking.

### Reavaliação (após a Fase 1)

Nenhuma violação nova apareceu no desenho. Dois pontos que a Fase 1 tornou explícitos e que
valem registro:

1. **`public/theme-boot.js` vive fora de `src/`** — logo, fora do TypeScript, do ESLint e do
   alias `@`, e duplica a chave de armazenamento. Não é violação de princípio, mas é a única
   duplicação estrutural que a feature introduz. Mitigada por teste que compara o texto do
   arquivo com `STORAGE_KEYS` (research §2, contracts/storage.md).
2. **A suíte de acessibilidade dobra de tempo.** Aceito: é a única forma honesta de sustentar
   SC-002.

Gate: **aprovado**.

## Project Structure

### Documentation (this feature)

```text
specs/005-ui-design-system/
├── plan.md              # Este arquivo
├── spec.md              # Especificação (50 FR, 16 SC)
├── design.md            # Plano de design: tokens, tipografia, layout, assinatura
├── research.md          # Fase 0 — decisões técnicas
├── data-model.md        # Fase 1 — entidades e transições
├── quickstart.md        # Fase 1 — roteiro de validação
├── contracts/
│   ├── tokens.md        # Contrato normativo dos tokens e pares aprovados
│   ├── components.md    # Anatomia, variantes e estados de cada componente
│   └── storage.md       # Registro da preferência de tema
├── checklists/
│   └── requirements.md  # Checklist de qualidade da spec
└── tasks.md             # Fase 2 — gerado por /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── domain/
│   ├── theme/
│   │   ├── index.ts           # resolveTheme, próxima preferência, validação — puro
│   │   └── contrast.ts        # razão WCAG entre dois valores — puro
│   └── …                      # inalterado
├── services/
│   ├── storage/
│   │   ├── schema.ts          # + STORAGE_KEYS.theme
│   │   └── themeRepo.ts       # NOVO — leitura/gravação versionada
│   └── theme/
│       └── systemPreference.ts # NOVO — matchMedia, com assinatura de mudança
├── store/
│   └── themeSlice.ts          # NOVO — preferência + tema efetivo
├── features/
│   └── theme/
│       └── ThemeControl.tsx   # NOVO — radiogroup Claro/Escuro/Sistema
├── ui/                        # Todos redesenhados sobre os tokens
├── styles/
│   ├── index.css              # Reescrito: duas camadas de variáveis + @theme inline
│   └── tokens.css             # NOVO — valores brutos por tema, origem única
├── assets/fonts/
│   ├── space-grotesk-subset.woff2  # NOVO — versionado
│   └── OFL.txt                     # NOVO — licença
└── i18n/pt-BR.ts              # + textos do controle de tema

public/
└── theme-boot.js              # NOVO — aplica data-theme antes da primeira pintura

docs/
└── style-guide.md             # NOVO — o guia do FR-025 a FR-029, FR-036

tests/
├── unit/
│   ├── contrast.spec.ts       # NOVO — matriz de pares aprovados, dois temas
│   ├── theme-resolution.spec.ts # NOVO — domínio puro
│   ├── theme-boot-sync.spec.ts  # NOVO — chave duplicada em sincronia
│   └── no-secrets.spec.ts     # Estendido — origem remota em CSS
├── components/
│   └── theme-control.spec.tsx # NOVO
├── integration/
│   └── theme-persistence.spec.ts # NOVO — persistência, corrupção, indisponibilidade
└── a11y/
    └── steps.spec.tsx         # Parametrizado por tema

e2e/
├── theme.spec.ts              # NOVO — sem piscada, persistência, troca em operação
└── support/                   # + guarda de origem remota nas requisições

eslint-rules/
└── index.js                   # + tp/no-raw-visual-values
```

**Structure Decision**: mantida a arquitetura em camadas que a constituição fixa e que o projeto
já pratica — regra pura em `src/domain/`, I/O em `src/services/`, orquestração em
`src/features/` e `src/app/`, primitivos em `src/ui/`. A feature acrescenta uma fatia vertical
completa para tema (domínio → serviço → store → componente) e reescreve a camada de estilo, sem
mover nada de lugar. `public/` e `docs/` são diretórios novos, ambos exigidos por requisito:
`public/` pela restrição de CSP (research §2), `docs/` pelo FR-025.

## Complexity Tracking

| Violação | Por que é necessária | Alternativa mais simples, e por que foi rejeitada |
| --- | --- | --- |
| **Fonte de terceiro embarcada** (Space Grotesk, ~40 KB) — tensiona "Simplicidade proporcional", cuja posição padrão é não adicionar | FR-034 a exige nominalmente, após decisão registrada em `/speckit-clarify`. A tipografia é o maior vetor de personalidade disponível, e a queixa que abriu a feature foi exatamente ausência de personalidade | **Pilha de fontes nativa**, mantendo o que existe hoje: custo zero e risco zero, mas foi apresentada ao usuário como opção C e recusada. Teto de 80 KB (SC-013) e verificação de licença limitam o custo |
| **Arquivo fora de `src/`** (`public/theme-boot.js`), sem TypeScript, sem lint, com chave de armazenamento duplicada | FR-010 exige o tema correto no primeiro quadro, e `script-src 'self'` proíbe script inline — o caminho convencional está fechado | **Script inline com hash no CSP**: mais compacto, mas mexe no Princípio II por conveniência estética e cria falha que só aparece em produção. **Aceitar a piscada**: viola FR-010 e SC-004 |
| **Suíte de acessibilidade executada duas vezes** | Contraste é propriedade do par renderizado; um único tema auditado deixa metade da superfície sem verificação | **Auditar só o tema claro** e confiar na matriz de contraste: a matriz cobre pares declarados, não o que a árvore realmente renderiza. São verificações complementares, não redundantes |
