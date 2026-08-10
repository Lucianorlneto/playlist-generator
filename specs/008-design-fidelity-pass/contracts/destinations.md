# Contrato — Etapa Destinos: painel lateral e cartão

Definição normativa de FR-014 a FR-025. Origem: nó `uy2ns` do arquivo de design.

---

## 1. Composição da etapa

O que o arquivo desenha, na ordem em que aparece no DOM:

```text
Main
└── Content
    ├── Primary Column
    │   ├── Heading                     ← sem cartão, sobre o substrato da área principal
    │   │   ├── Greeting                ← linha de contexto (contrato próprio)
    │   │   ├── "Para onde vai a playlist?"
    │   │   └── descrição
    │   ├── "Serviços de destino"       ← rótulo do grupo
    │   ├── Destinations                ← os dois cartões
    │   └── Stickers Decor              ← adesivos, decorativos
    └── Side Panel                      ← "Ordem de execução"
```

**Nenhuma superfície envolve o `Heading`** (FR-006). O `Heading` é filho direto de
`Primary Column`, sem preenchimento e sem contorno, nas quatorze telas do arquivo.

**Os adesivos ficam na coluna primária**, não no painel — divergência de forma da
implementação atual, que os põe dentro do `MoodPanel`.

**O que sai do corpo da etapa** (FR-019): o parágrafo "Quando você escolhe os dois,
executamos um serviço de cada vez, sempre nesta ordem…". A explicação passa a existir uma
única vez, no painel. A contagem de destinos selecionados já vive na barra de ações e
permanece lá — é onde o arquivo a põe (`Action Bar > Selection Status`).

---

## 2. Painel lateral "Ordem de execução"

Superfície: `--surface`, contorno `--rule`, `--radius-panel`. Largura:
`--side-panel-width`, inalterada. Em largura estreita desce para baixo da coluna primária
pelo `flex-wrap` que o `Shell` já tem (FR-020).

### Composição, de cima para baixo

| Bloco | Conteúdo | Requisito |
| --- | --- | --- |
| Cabeçalho | ícone do papel `queue` em `--accent-text` + "Ordem de execução" | FR-014 |
| Fila | um item por destino **selecionado**, na ordem de `PROVIDER_ORDER` | FR-015 |
| Fila vazia | frase curta convidando a escolher um destino, **no lugar da fila** | FR-015a |
| Aviso | execução em série, sobre `--accent-tint`, com ícone `hint` | FR-016 |
| Fotografia | a mesma imagem e o mesmo véu por tema de hoje | FR-017 |
| Legenda | a legenda do arquivo, abaixo da fotografia | FR-017 |

### Item da fila

Marcador com contorno `--rule` e substrato sutil, contendo o ícone do provedor **na cor
da marca** (FR-001); ao lado, o nome do serviço e a nota da posição. Com um único
destino, a nota de ordem relativa não é exibida (`solo === true`).

**O marcador não é preenchido com cor de marca.** O arquivo o desenha com substrato
neutro e só o glifo tingido — a exceção nomeada de FR-004 vale exclusivamente para o
distintivo do cartão, não para o marcador da fila.

### Invariantes

| Regra | Enunciado | Requisito |
| --- | --- | --- |
| P1 | O painel **nunca** some nem colapsa por causa da seleção; a largura da coluna primária não muda com a marcação | FR-015a, FR-020 |
| P2 | A fila **nunca** lista um destino não selecionado | FR-015 |
| P3 | Toda a informação textual permanece completa e legível **sem** as imagens | FR-018, SC-006 |
| P4 | O texto vem **antes** da fotografia no DOM | FR-018 |
| P5 | Fotografia e adesivos permanecem `alt=""`, `aria-hidden`, `loading="lazy"` | FR-018 |
| P6 | A explicação da ordem aparece **uma única vez** na tela | FR-019, SC-005 |

---

## 3. Cartão de destino

Origem: componente `j8rruy — Destination Card`, instanciado em `uy2ns`.

### Anatomia

```text
┌─────────────────────────────────────────────────────────┐
│  ┌────┐   Criar no Spotify                        ┌───┐ │
│  │ ◉  │   Conectado como Luciano Rodrigues        │ ✓ │ │
│  └────┘                                           └───┘ │
└─────────────────────────────────────────────────────────┘
   ↑ distintivo      ↑ rótulo + linha secundária      ↑ controle
```

| Parte | Especificação | Requisito |
| --- | --- | --- |
| Distintivo | quadrado arredondado, substrato `--brand-tint-{provider}`, glifo em `--brand-{provider}` | FR-003 |
| Rótulo | "Criar no {Serviço}", `--text-section`, `--ink` | — |
| Linha secundária | estado da conta, `--text-data`, `--ink-muted` | FR-021 |
| Controle | `<input type="checkbox">` com `sr-only` + marca de verificação visível à direita | FR-023, FR-025 |
| Cartão selecionado | contorno `--accent-text` **e** substrato `--accent-tint` | FR-024 |
| Cartão não selecionado | contorno `--rule`, substrato `--surface` | FR-024 |

### Linha secundária, nos três estados

| Estado | Conteúdo | Requisito |
| --- | --- | --- |
| Sessão ativa | nomeia a conta conectada | FR-021 |
| Credencial cadastrada, sem sessão | diz **quando** a autorização acontece — ao executar aquele serviço | FR-021 |
| Sem credencial | o motivo do bloqueio, com o atalho para a Configuração | FR-021, FR-022 |

**A altura do cartão é a mesma nos três** (FR-021a). O bloco de motivo + atalho que hoje
aparece e some deixa de ser um segundo bloco e passa a ocupar a faixa da linha
secundária.

### Acessibilidade

- O `<input>` continua sendo o controle real: focável, na ordem de tabulação, com estado
  anunciado. `sr-only` esconde visualmente, não semanticamente.
- O anel de foco vai para a marca de verificação visível por `peer-focus-visible`.
- `<label htmlFor>` permanece associado; o rótulo continua clicável.
- `aria-describedby` continua apontando para o motivo quando não há credencial.
- O ícone do provedor permanece decorativo: o nome do serviço está escrito ao lado, e a
  cor nunca é o único portador (FR-005).

---

## 4. Cor de marca — onde ela aparece e onde não pode aparecer

| Superfície | Glifo na cor da marca | Preenchimento com cor de marca |
| --- | --- | --- |
| Chip da barra superior | ✅ (já existe) | ❌ |
| Distintivo do cartão de destino | ✅ | ✅ **exceção nomeada** — `--brand-tint-*` |
| Marcador da fila do painel | ✅ | ❌ |
| Cabeçalho do cartão de fase do ciclo | ✅ | ❌ |
| Botão, selo, texto, estado, foco | ❌ | ❌ |

O detalhe dos tokens, da regra de lint e do portão está em
[`tokens.md`](./tokens.md) §1 e §3.

---

## 5. Portões

| Verificação | Onde | Requisito |
| --- | --- | --- |
| Nenhuma superfície envolve o cabeçalho da etapa | `tests/components/destinations.spec.tsx` | FR-006, SC-003 |
| O painel existe com seleção vazia, com cabeçalho, aviso e legenda | idem | FR-015a |
| A fila reflete a seleção e nunca lista o não selecionado | idem | FR-015 |
| A ordem de execução aparece uma vez só | idem | FR-019, SC-005 |
| Os três estados da linha secundária | idem | FR-021 |
| Altura idêntica nos três estados | idem | FR-021a |
| Teclado, foco visível, rótulo associado | `tests/a11y/`, `e2e/keyboard.spec.ts` | FR-025, FR-033 |
| Informação completa sem imagens | `e2e/decor-loading.spec.ts` | FR-018, SC-006 |
| Sem rolagem horizontal em 375px | `e2e/narrow-viewport.spec.ts` | FR-020, SC-007 |
