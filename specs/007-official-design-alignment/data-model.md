# Fase 1 — Modelo de Dados

**Feature**: 007-official-design-alignment

Esta feature **não introduz nem altera nenhum dado persistido**. Nenhuma chave de
armazenamento nova, nenhum formato alterado, nenhuma migração. O que segue são as
estruturas em memória e em tempo de construção que a interface passa a manipular.

---

## 1. Token visual

Um nome com papel semântico e um valor por tema. Continua sendo a única forma
pela qual um componente se refere a um valor visual.

| Campo | Tipo | Regra |
| --- | --- | --- |
| nome | `--kebab-case` | Declarado em `src/styles/tokens.css`; consumido pelo nome semântico de `index.css` |
| valor claro | cor / medida | Obrigatório |
| valor escuro | cor / medida | Obrigatório |
| papel | prosa | Declarado em `contracts/tokens.md` §1 e no guia de estilo |

**Invariantes**

- Todo token de cor existe nos **dois** temas. Definição parcial é erro, verificada por `tests/unit/contrast.spec.ts` e por SC-005.
- Substrato usado como fundo em par aprovado é **opaco**. Translucidez não tem razão de contraste definida (`research.md` §5).
- Escalas de espaço, raio, tipo e profundidade não variam por tema — um degrau mede o mesmo nos dois substratos.

**Mudança em relação à 005**: a família de superfícies vai de 3 para 4 degraus
(entra `--surface-zone`); entram `--brand-spotify`, `--brand-youtube` e
`--state-live`. Total: 14 → 18 tokens de cor.

---

## 2. Par aprovado

Lista fechada de combinações tinta/substrato. Combinação ausente é proibida.

| Campo | Tipo | Nota |
| --- | --- | --- |
| `foreground` | `TokenName` | Nome, nunca valor |
| `background` | `TokenName` | Precisa ser opaco |
| `usage` | `'text' \| 'large-text' \| 'ui'` | Define o mínimo: 4,5 · 3 · 3 |
| `where` | `string` | Onde aparece; alimenta o guia de estilo |

**Mudança**: de 15 para 27 pares. O crescimento vem dos substratos novos —
texto e ícone sobre `--surface-zone` (barra superior e trilha) são combinações
que não existiam. Ver `contracts/tokens.md` §2.

---

## 3. Degrau da trilha — `src/domain/rail/`

Produzido por função pura a partir de um instantâneo do estado. **Nenhum I/O,
nenhum DOM, nenhum acesso ao store de dentro do domínio.**

```text
RailStep {
  step:        WizardStep            // credential | destinations | input | service | summary
  ordinal:     number                // 1..N, contíguo, atribuído após a filtragem
  state:       'done' | 'current' | 'pending'
  support:     SupportLine           // ver abaixo
}

SupportLine =
  | { kind: 'derived', value: string }   // reflete o estado real
  | { kind: 'neutral' }                  // descrição da etapa, do dicionário
```

### Entrada da função

| Campo | Origem | Uso |
| --- | --- | --- |
| `current` | `store.step` | Determina `state` de cada degrau |
| `destinations` | `store.queue.order` | Presença da etapa Resumo; linha derivada de Destinos |
| `lineCount` | contagem de linhas analisadas | Linha derivada de Entrada |
| `credentialsReady` | credenciais cadastradas | Linha derivada de Configuração |

### Regras (todas testáveis sem renderizar)

1. **Resumo condicional** — o degrau `summary` só existe quando há mais de um destino (FR-013). Hoje esta regra vive duplicada entre `StepIndicator` e o redutor da fila; passa a ter um lar único.
2. **Numeração contígua** — `ordinal` é atribuído **depois** da filtragem. Com destino único a trilha numera 1‑2‑3‑4, nunca 1‑2‑3‑5 (FR-013).
3. **Derivada só quando há valor** — `support` é `derived` apenas se a etapa já foi decidida e o valor existe. Antes disso é `neutral` (FR-012).
4. **Nunca afirmar o que não aconteceu** — um degrau `pending` nunca produz `SupportLine` derivada. É a forma executável do FR-066, e a razão pela qual o "Spotify e YouTube" que o mockup mostra sob Destinos na tela de Configuração **não** é reproduzido.
5. **A etapa atual pode diferir da concluída** — `credential` declara uma linha enquanto `current` e outra depois de `done` (FR-067).
6. **Fases internas não são degraus** — as seis fases do ciclo de um serviço nunca aparecem como `RailStep` (FR-014). A fase corrente é informação de apoio da própria tela.

### Transições

`pending → current → done`. Nunca regride por navegação: só o descarte do fluxo
(`ResetFlow`) devolve todos a `pending`, e ele já pede confirmação (FR-065).

---

## 4. Zona da casca

Região permanente da aplicação. Estrutura idêntica nos dois temas (FR-046); a
única divergência autorizada entre temas é cromática.

| Zona | Substrato | Conteúdo | Presença |
| --- | --- | --- | --- |
| Barra superior | `--surface-zone` | Marca, chips de conexão, controle de tema | Todas as etapas, ambas as larguras |
| Trilha de etapas | `--surface-zone` | Título, degraus, ação de recomeçar | Todas as etapas; **colapsa** em largura estreita |
| Área principal | `--bg` | Coluna primária, painel lateral opcional, decoração | Todas as etapas |
| Barra de ações | `--bg` | Texto de estado + ações | **Apenas** Destinos e Entrada (FR-016) |

**Invariante de largura estreita**: a trilha vira `StepSummary` no topo do
conteúdo, o painel lateral desce para baixo da coluna primária, e a ação de
recomeçar migra para a barra superior — sem estado de abertura nem parada de
tabulação nova (FR-052, FR-054).

---

## 5. Chip de conexão

Representação permanente do vínculo com um provedor, na barra superior.

| Campo | Origem | Regra |
| --- | --- | --- |
| provedor | `ProviderId` | Determina ícone e cor de marca |
| estado | `connected` \| `disconnected` \| `no-credential` | Distinguível por rótulo e forma, não só por cor (FR-008) |
| conta | identificador da sessão | **Ausente** quando `no-credential` (FR-009) |
| ação | conectar \| reconectar | Depende do estado |

**Invariantes**

- Estado `no-credential` **nunca** exibe identificador de conta — nem vazio, nem genérico (FR-009).
- Nome de conta longo trunca visualmente e permanece íntegro para leitor de tela; nunca empurra o controle de tema para fora da barra.
- Os dois chips coexistem com estados diferentes sem que o desconectado pareça erro da aplicação.
- Absorve o `SessionHeader` atual; nenhuma informação de sessão sobra fora dele.

---

## 6. Papel de ícone — `src/ui/icons.ts`

Nome do vocabulário da aplicação associado a exatamente um componente da
biblioteca. É a única forma pela qual uma superfície se refere a um ícone.

| Campo | Tipo | Regra |
| --- | --- | --- |
| papel | chave literal | Vocabulário da aplicação: `advance`, `restart`, `confident`… |
| componente | componente de ícone **ou recurso de arte** | Importado por subcaminho de conjunto (FR-056); a marca é a exceção única |
| conjunto | `lucide` \| `phosphor` \| `arte-local` | Rastreável ao nome no arquivo de design |

**Invariantes**

- Nenhuma superfície importa da biblioteca diretamente (FR-059, SC-016).
- Todo papel resolve para um componente definido — ou, no caso único da marca, para um recurso de arte local — verificado por `tests/unit/icon-roles.spec.ts`, que é também o que falha quando um nome de exportação muda de versão.
- Ícone herda cor do contexto e nunca fixa a própria (FR-051, SC-017). A marca é a exceção declarada: é arte, e por isso exige tratamento por tema em vez de recoloração por token (FR-049, FR-060).
- Ícone é decorativo quando acompanha rótulo; ganha nome acessível quando é o único conteúdo de um controle (FR-058).
- Ícone nunca é o único portador de um estado (FR-042).

Os dezessete papéis e seu mapeamento estão em `contracts/icons.md`.

---

## 7. Recurso decorativo

| Campo | Valor | Regra |
| --- | --- | --- |
| tipo | fundo ambiente \| adesivo \| fotografia | — |
| origem | arquivo em `src/assets/` | Nunca URL de terceiro (FR-048) |
| tratamento por tema | declarado para claro **e** escuro | Um único tratamento para os dois substratos é erro (FR-049) |
| semântica | decorativo | Nunca anunciado por leitor de tela (FR-035, SC-013) |

**Invariantes**

- Espaço dimensionado **antes** da chegada do recurso; nada se desloca quando ele carrega (FR-070, SC-020).
- Fora do caminho crítico de renderização (FR-068, SC-019).
- Ausência do recurso deixa a tela plenamente utilizável, sem buraco no layout (SC-014).

---

## 8. O que esta feature **não** modela

Registrado para evitar releitura equivocada em revisão:

- **Nenhuma chave de armazenamento** — nem nova, nem alterada, nem migrada.
- **Nenhum estado de fluxo** — etapas, fila de serviços, fases e transições permanecem exatamente como estão.
- **Nenhum dado de provedor** — credenciais, sessões, escopos e rascunhos intocados.
- **Nenhum dado pessoal novo** — a saudação personalizada usa o identificador de conta que a aplicação já possui, sem coletar nem persistir nada (FR-036).
