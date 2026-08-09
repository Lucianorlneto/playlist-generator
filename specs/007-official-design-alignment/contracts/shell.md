# Contrato — A casca de três zonas

**Feature**: 007-official-design-alignment

Descreve a estrutura permanente da aplicação: o que cada zona contém, em que
ordem, como se comporta nas duas larguras e o que é verificável sobre ela.

---

## 1. Composição

```text
┌─ Barra superior ─────────────────────────────────────────────┐
│ Marca            Chip Spotify · Chip YouTube │ ⌗ Tema        │
├─ Trilha ──────────┬─ Área principal ─────────────────────────┤
│ ETAPAS            │  ┌ Coluna primária ─┐  ┌ Painel lateral ┐│
│  ① Configuração   │  │                  │  │   (opcional)   ││
│  ② Destinos       │  └──────────────────┘  └────────────────┘│
│  ③ Entrada        │                                          │
│  ④ Serviço        ├─ Barra de ações (só Destinos e Entrada) ─┤
│  ⑤ Resumo         │  Estado em texto            Voltar  Ir → │
│ ↺ Recomeçar       │                                          │
└───────────────────┴──────────────────────────────────────────┘
```

**Ordem no DOM = ordem visual de leitura** (FR-040): barra superior → trilha →
conteúdo → barra de ações. Nenhuma reordenação por CSS que descole as duas.

---

## 2. Barra superior — `src/app/Topbar.tsx`

| Elemento | Conteúdo | Notas |
| --- | --- | --- |
| Marca | Símbolo, nome do produto, descrição curta | A descrição colapsa abaixo do ponto de corte. O símbolo é `Logo Mark.png` (arte), não ícone de biblioteca — ver `contracts/icons.md` §1 |
| Chips de conexão | Um por provedor | Ver §3 |
| Divisor | Filete `--rule-strong` | Decorativo, `aria-hidden` |
| Controle de tema | Três opções, uma parada de tabulação | Comportamento da 005 preservado sem alteração |
| Ação de recomeçar | **Apenas em largura estreita** | Migra do rodapé da trilha (FR-054) |

**Invariantes**

- Presente e idêntica em todas as etapas, na mesma posição (FR-006).
- Substrato `--surface-zone` nos dois temas.
- Nome de conta longo trunca visualmente; **nunca** empurra o controle de tema para fora.
- O controle de tema continua contando como **uma** parada de tabulação (FR-040) — o padrão de `radiogroup` da 005 é preservado literalmente.

---

## 3. Chip de conexão — `src/features/connect/ConnectionChip.tsx`

Absorve o `SessionHeader` atual. Três estados, distinguíveis por **rótulo e
forma**, não só por cor (FR-008):

| Estado | Ícone do provedor | Indicador | Conta | Ação |
| --- | --- | --- | --- | --- |
| `connected` | Cor de marca | Ponto `--state-live` | Identificador | "Reconectar" |
| `disconnected` | Cor de marca, esmaecido | Contorno vazado | — | "Conectar" |
| `no-credential` | Neutro (`--ink-muted`) | Ausente | **Nunca** (FR-009) | "Configurar" |

**Invariantes**

- O ícone do provedor usa `--brand-*` como acento identificador — nunca como cor de ação, nunca como portador de estado (FR-023).
- O estado da conexão **não** é comunicado apenas pela cor do ponto: o rótulo da ação e a presença/ausência do identificador o dizem também.
- Dois chips com estados diferentes coexistem sem que o desconectado pareça erro.

---

## 4. Trilha de etapas — `src/app/StepRail.tsx`

Desenha o que `src/domain/rail/` devolve. **Não decide nada** (Princípio III).

| Parte | Conteúdo |
| --- | --- |
| Título | "Etapas" |
| Degrau | Indicador (disco + conector) + nome + linha de apoio |
| Rodapé | Ação de recomeçar, com ícone e rótulo |

### Anatomia do indicador — a distinção é por forma

| Estado | Disco | Conteúdo do disco | Conector | Tinta do nome |
| --- | --- | --- | --- | --- |
| `done` | Preenchido `--accent` | Ícone `check`, em `--accent-ink` | `--accent` | `--ink` |
| `current` | Tingido (âmbar a 12/15%) | Numeral em `--accent-text` | `--rule` | `--ink` |
| `pending` | Vazado, contorno `--rule-strong` | Numeral em `--ink-muted` | `--rule` | `--ink-muted` |

**Esta tabela é a razão pela qual `--ink-faint` não existe.** O design distinguia
pendente de secundário por uma terceira tinta que reprova no contraste; aqui a
distinção é preenchido / tingido / vazado — forma, que sobrevive a cores forçadas
e a daltonismo (FR-011, FR-042).

**Invariantes**

- Presente em todas as etapas em largura ampla.
- A posição atual é anunciada **uma única vez** — o degrau atual carrega `aria-current="step"`; o título da etapa na área principal não o repete (FR-041).
- A ação de recomeçar preserva integralmente a confirmação da feature 006 (FR-015, FR-065).

---

## 5. Área principal

| Parte | Presença |
| --- | --- |
| Fundo ambiente + esmaecimento | Todas as etapas; decorativo (ver `contracts/decor.md`) |
| Coluna primária | Todas as etapas, largura `--container-measure` |
| Painel lateral | Apenas onde a tela o previr (hoje: Destinos) |

**Invariante**: o painel lateral **não rouba** a largura de leitura da coluna
primária (FR-020). Em largura estreita ele desce para baixo dela, preservando a
ordem de leitura (FR-053).

---

## 6. Barra de ações — `src/app/ActionBar.tsx`

**Apenas em Destinos e Entrada. A lista é fechada** (FR-016).

| Lado | Conteúdo |
| --- | --- |
| Esquerda | Estado da etapa em texto — inclusive o motivo do bloqueio |
| Direita | Voltar (discreta) · Avançar (primária, `--accent` sólido) |

**Invariantes**

- Quando o avanço não é possível, o motivo é dito **por escrito** na faixa, e a indisponibilidade é perceptível sem cor (FR-018).
- A primeira etapa não oferece retorno inoperante (FR-019).
- Avançar é a **única** ação primária da tela (FR-017).

### Onde a barra **não** existe

Configuração, ciclo de serviço e Resumo mantêm suas ações dentro do cartão da
fase que as explica (FR-061). Em particular, **"Pular o {serviço}" permanece
adjacente ao cartão** de conexão, reautorização, orçamento e revisão, com o
comportamento da feature 006 intacto (FR-062). Redesenhar sim; realocar não.

---

## 7. Largura estreita

Abaixo de `--breakpoint-shell`:

| Zona | Comportamento |
| --- | --- |
| Barra superior | Permanece; a descrição da marca colapsa; recebe a ação de recomeçar |
| Trilha | Vira `StepSummary` no topo do conteúdo |
| Painel lateral | Desce para baixo da coluna primária |
| Barra de ações | Permanece, acessível sem rolar até o fim de listas longas |

### `StepSummary` — `src/app/StepSummary.tsx`

Informa posição no fluxo, nome da etapa atual e progresso.

**Proibições explícitas** (FR-052): sem estado de abertura, sem controle
acionável novo, sem parada de tabulação adicional. É informação, não navegação.

---

## 8. O que é verificável sobre a casca

Alimenta as asserções estruturais de FR-071 a FR-074:

| Asserção | Cobre |
| --- | --- |
| As três zonas existem e estão aninhadas na ordem esperada, em cada etapa | FR-006, FR-010, FR-040 |
| A barra de ações existe em Destinos e Entrada e **em nenhuma outra etapa** | FR-016, FR-061 |
| "Pular o serviço" está dentro do cartão da fase, não na faixa inferior | FR-062 |
| Cada degrau da trilha tem o `ordinal` e o `state` que o domínio devolveu | FR-011, FR-013 |
| Exatamente um elemento carrega `aria-current="step"` por etapa | FR-041 |
| O chip de estado `no-credential` não contém identificador de conta | FR-009 |
| Abaixo do ponto de corte a trilha some e o `StepSummary` aparece | FR-037 |
| Nenhum elemento com `role` interativo é acrescentado pelo `StepSummary` | FR-052 |
| Toda superfície resolve para token — nenhuma propriedade com valor literal | FR-002, SC-004 |
| A árvore de zonas e componentes é **idêntica** entre os temas; a única diferença é valor de cor | FR-046, SC-015 |
| Sob `forced-colors: active`, a separação entre as três zonas sobrevive por contorno | FR-028 |
| A ordem de tabulação é barra superior → trilha → conteúdo → barra de ações | FR-039, FR-040, SC-008 |

Rodam nos **dois temas** e nas **duas larguras**.
