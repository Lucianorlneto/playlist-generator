# Fase 1 — Modelo de Dados

**Feature**: 005-ui-design-system | **Data**: 2026-08-07

Esta feature tem pouco dado e muita regra. As entidades abaixo são de dois tipos: uma que
persiste (a preferência de tema) e três que existem como estrutura declarada em código, servindo
de origem única para componentes, testes e guia.

---

## 1. `ThemePreference` — o que o usuário escolheu

```ts
type ThemePreference = 'light' | 'dark' | 'system';
```

| Valor | Significado |
| --- | --- |
| `'system'` | Nunca escolheu, ou voltou a acompanhar o sistema. **Estado inicial.** |
| `'light'` | Escolha manual explícita pelo tema claro. |
| `'dark'` | Escolha manual explícita pelo tema escuro. |

**Persistência**: `localStorage`, chave `tp.v2.theme` — ver [contracts/storage.md](./contracts/storage.md).

**Regras**:

- Ausência de registro equivale a `'system'` (FR-005, FR-008).
- Valor fora do conjunto, JSON corrompido, forma inválida ou versão desconhecida ⇒ descarte
  silencioso e retorno a `'system'` (FR-011).
- `'system'` **é gravado**, não representado por ausência. Voltar a acompanhar o sistema é uma
  escolha tão explícita quanto as outras, e apagar a chave em vez de gravar tornaria os dois
  estados indistinguíveis para qualquer teste.
- O registro não contém dado pessoal, token nem credencial (FR-012).

---

## 2. `EffectiveTheme` — o que está pintado na tela

```ts
type EffectiveTheme = 'light' | 'dark';
```

Nunca persistido. É **derivado**, e a derivação é uma função pura — o núcleo testável desta
feature (`src/domain/theme/index.ts`):

```ts
resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): EffectiveTheme
```

| `preference` | `systemPrefersDark` | Resultado |
| --- | --- | --- |
| `'light'` | qualquer | `'light'` |
| `'dark'` | qualquer | `'dark'` |
| `'system'` | `false` | `'light'` |
| `'system'` | `true` | `'dark'` |

A tabela é a especificação inteira de FR-005, FR-008 e FR-009, e cabe num teste de quatro casos.
Toda a complexidade aparente do recurso mora fora dela, no I/O.

### Transições

```text
                    ┌──────────────────────────────────────┐
                    │            'system'                  │
                    │  (inicial; segue matchMedia ao vivo) │
                    └───────┬──────────────────┬───────────┘
                            │                  │
         escolhe "Claro"    │                  │  escolhe "Escuro"
                            ▼                  ▼
                    ┌───────────────┐  ┌───────────────┐
                    │    'light'    │  │    'dark'     │
                    │ (ignora o SO) │  │ (ignora o SO) │
                    └───────┬───────┘  └───────┬───────┘
                            │                  │
                            └────────┬─────────┘
                                escolhe "Sistema"
                                     ▼
                                 volta a 'system'
```

Mudança na preferência do sistema operacional só produz efeito no estado `'system'` (FR-009).
Nos outros dois, o evento chega e é ignorado — deliberadamente, não por omissão.

**Invariante que amarra o resto do produto**: trocar de tema altera `EffectiveTheme` e nada
mais. Não muda etapa, não descarta entrada digitada, não interrompe busca em andamento, criação
em lote ou espera por limitação de taxa (FR-007). Na prática isso significa que o tema **não pode
morar no mesmo caminho de reidratação do rascunho** — é fatia de estado independente.

---

## 3. `DesignToken` — a origem única de todo valor visual

Não é tipo em tempo de execução: é a estrutura declarada em `src/styles/tokens.css` e espelhada
em [contracts/tokens.md](./contracts/tokens.md).

| Campo | Descrição |
| --- | --- |
| Nome | Identificador semântico (`--ink-muted`), nunca descritivo de cor (`--cinza-claro`) |
| Papel | O que ele significa, em uma frase |
| Valor claro | Hex normativo no tema Papel |
| Valor escuro | Hex normativo no tema Noite |
| Categoria | `cor` \| `tipografia` \| `espaçamento` \| `raio` \| `profundidade` |

**Regras**:

- Todo token de cor tem exatamente um valor por tema. Token que existe num tema e não no outro
  é erro de definição, não recurso.
- Nomes são semânticos. `--accent` sobrevive a uma troca de âmbar por qualquer outra cor;
  `--amarelo` não.
- Componente consome nome, nunca valor (FR-004, FR-040). O portão é a regra de lint.
- Escalas são **finitas** (FR-014): espaçamento em 7 degraus, raio em 3, tipografia em 6.
  Valor fora da escala é violação, não exceção.

---

## 4. `ApprovedPair` — o que torna a verificação de contraste exaustiva

```ts
interface ApprovedPair {
  foreground: TokenName;
  background: TokenName;
  usage: 'text' | 'large-text' | 'ui';   // define o mínimo: 4.5 | 3 | 3
  where: string;                          // onde aparece, para o guia
}
```

Esta é a entidade que faz a diferença entre "cuidamos do contraste" e um invariante verificável.
A lista de pares aprovados é **fechada**, no mesmo espírito da tabela de hosts do Princípio II:

- Um par que não está na lista não pode ser usado por nenhum componente.
- O teste percorre a lista inteira, nos dois temas, e falha abaixo do mínimo da categoria.
- Falha tanto por par reprovado quanto por par ausente — uma lista que aceita mais do que declara
  não é uma lista fechada.

O guia de estilo (FR-027) não repete esses números à mão: ele cita a lista.

---

## 5. `ComponentSpec` — anatomia declarada

Estrutura documental, detalhada em [contracts/components.md](./contracts/components.md).

| Campo | Descrição |
| --- | --- |
| Nome | O componente em `src/ui/` ou `src/features/` |
| Propósito | Para que serve, e quando **não** usar |
| Variantes | Conjunto fechado (ex.: `primary`, `secondary`, `danger`, `ghost`) |
| Estados | Repouso, foco por teclado, hover, ativo, desabilitado, erro, carregando |
| Tokens | Quais tokens cada combinação variante × estado consome |

**Regra estrutural que atravessa todos** (FR-047): **preenchimento sólido significa acionável**.
Selo e indicador de estado usam fundo tingido de baixa saturação + texto na cor do estado +
ícone, nunca preenchimento sólido. É essa separação por forma — não uma diferença de matiz —
que impede o selo "Incerto" âmbar de ser lido como botão primário âmbar.

---

## Relações

```text
ThemePreference ──persiste em──▶ localStorage (tp.v2.theme)
       │
       └──+ preferência do SO ──▶ resolveTheme() ──▶ EffectiveTheme
                                                          │
                                                          ▼
                                            data-theme no elemento raiz
                                                          │
                                                          ▼
                          DesignToken (valor bruto por tema) ──▶ @theme inline
                                       │                              │
                                       ▼                              ▼
                                 ApprovedPair                   ComponentSpec
                                (portão de contraste)          (o que cada um usa)
```

A cadeia inteira tem um único ponto de decisão em tempo de execução — o atributo no elemento
raiz. Tudo acima dele é dado puro; tudo abaixo é CSS. É por isso que a troca de tema não precisa
recompor nada em React e cabe no orçamento de 100 ms do SC-003.
