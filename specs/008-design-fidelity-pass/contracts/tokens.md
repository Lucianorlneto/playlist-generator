# Contrato — Tokens acrescentados e pares medidos

Definição normativa de FR-003, FR-004 e FR-035 no que toca à camada de tokens. Amplia
`specs/007-official-design-alignment/contracts/tokens.md`, que permanece válido — **nada
que a 007 declarou é alterado ou removido aqui.**

---

## 1. Os dois tokens derivados

Declarados em `src/styles/tokens.css`, **uma única vez**, fora dos blocos de tema — pelo
mesmo mecanismo dos `--state-*-tint` que já existem: `var()` em propriedade customizada é
substituída no elemento onde a declaração vence, então tanto a cor da marca quanto a
quantidade de tinta já chegam com o valor do tema em vigor.

```css
:root {
  --brand-tint-spotify: color-mix(in srgb, var(--brand-spotify) var(--brand-tint-amount), var(--surface));
  --brand-tint-youtube: color-mix(in srgb, var(--brand-youtube) var(--brand-tint-amount), var(--surface));
}
```

A quantidade é por tema, ao lado de `--state-tint-amount`:

| Tema | `--brand-tint-amount` | Origem |
| --- | --- | --- |
| Papel (claro) | `12%` | mesmo degrau de `--state-tint-amount` |
| Noite (escuro) | `15%` | arquivo: `#1DB9541F` sobre `#161C25` = 12,2%; alinhado ao degrau já praticado no tema |

Emissão em `src/styles/index.css`, dentro do `@theme inline`:

```css
--color-brand-tint-spotify: var(--brand-tint-spotify);
--color-brand-tint-youtube: var(--brand-tint-youtube);
```

**Por que dois tokens e não um.** A cor é por provedor, e um token único exigiria
interpolação em tempo de execução — que `tp/no-dynamic-classname` recusa, porque o
scanner do Tailwind lê o código como texto e não emite classe construída.

---

## 2. Pares de contraste — 27 → 29

`src/domain/theme/approvedPairs.ts` ganha duas entradas:

| Frente | Substrato | Uso | Onde |
| --- | --- | --- | --- |
| `--brand-spotify` | `--brand-tint-spotify` | `ui` (≥ 3:1) | Ícone do provedor no distintivo do cartão de destino |
| `--brand-youtube` | `--brand-tint-youtube` | `ui` (≥ 3:1) | Ícone do provedor no distintivo do cartão de destino |

`APPROVED_PAIR_COUNT` passa de **27 para 29**. A constante existe para que apagar uma
linha da lista seja falha de teste e não silêncio; alterá-la sem alterar a lista é a
mesma falha ao contrário.

### O resolvedor de mistura

`tests/unit/contrast.spec.ts` lê os hex de `tokens.css` e resolve nomes. Os dois
substratos novos **não são hex**: são `color-mix`. O teste ganha uma função que reproduz
a mistura em sRGB, a partir dos mesmos valores lidos do arquivo:

```text
mix(frente, substrato, p) = frente · p + substrato · (1 − p)
```

Nenhum valor é digitado duas vezes: a fórmula consome `--brand-*`,
`--brand-tint-amount` e `--surface`, todos lidos de `tokens.css`.

**Por que medir e não presumir.** Ícone verde sobre substrato esverdeado é o caso em que
a intuição erra: o tingimento aproxima o fundo da própria cor do glifo. Os
`--state-*-tint` existentes nunca precisaram disso porque o par medido ali é
texto-sobre-`--surface`; aqui o glifo inteiro fica sobre a mistura.

**Se reprovar**: a correção é `--brand-tint-amount` por tema — reduzir a tinta afasta o
substrato do glifo. A cor da marca **não** é alterada nem removida (borda da spec).

---

## 3. A exceção nomeada, e a fechadura tripla

`bg-brand-spotify` e `bg-brand-youtube` **continuam proibidos**, sem exceção.
`bg-brand-tint-spotify` e `bg-brand-tint-youtube` são permitidos em **um único arquivo**.

### 3.1 Regra de lint

`eslint-rules/index.js`, padrão `brandAsFill`. Hoje o padrão é:

```js
new RegExp(`\\b${VARIANTS}bg-brand-[a-z]+\\b`, 'u')
```

`[a-z]+` não atravessa hífen, então `bg-brand-tint-spotify` já casa com `bg-brand-tint` e
seria recusado. A mudança tem duas partes:

1. o padrão passa a **não** casar com o prefixo `bg-brand-tint-`;
2. um padrão novo, `brandTintOutsideCard`, recusa `bg-brand-tint-*` em qualquer arquivo
   que não seja `src/features/destinations/DestinationSelector.tsx`.

A mensagem da segunda cita FR-004 e diz o que fazer: o substrato de identidade existe
para o distintivo do cartão de destino, e autorizar outro ponto é editar esta regra — que
é a revisão que se quer forçar.

### 3.2 Teste de ponto único

`tests/unit/no-orphan-tokens.spec.ts` ganha a asserção de que cada utilitário
`bg-brand-tint-*` aparece em **exatamente um** arquivo de `src/`. Cobre o caso de alguém
desativar a regra de lint com um comentário de supressão.

### 3.3 O nome

O terceiro trinco é o mais barato e o mais forte: o token **tem nome próprio**. Não há
limiar de opacidade a alegar, não há `bg-brand-spotify/10` a escrever. Chegar à exceção
exige nomeá-la.

---

## 4. O que **não** muda

- Os dezoito nomes de cor da 007 permanecem, com os mesmos valores. `COLOR_TOKENS`
  continua com dezoito entradas: os dois tokens novos são **derivados**, como
  `--state-*-tint` e `--accent-tint`, e derivado não entra na lista de tokens que precisam
  existir declarados nos dois temas.
- As escalas de tipografia, espaçamento, raio e as medidas de zona permanecem intactas.
- `app-card` permanece como utilitário. O que sai é **um uso** dele
  (`src/app/Wizard.tsx`), não a declaração — `MatchRow` e `SummaryScreen` correspondem a
  cartões que o arquivo desenha. Por isso `app-card` **não** entra na denylist de
  `no-orphan-tokens`.
- Nenhum utilitário sai das escalas nesta feature; a denylist de migração da 007
  permanece como está.

---

## 5. Portões

| Verificação | Onde | Requisito |
| --- | --- | --- |
| Os dois pares novos medem ≥ 3:1 nos dois temas | `tests/unit/contrast.spec.ts` | FR-003, SC-002 |
| `APPROVED_PAIR_COUNT === 29` | idem | FR-003 |
| `bg-brand-{spotify,youtube}` continua recusado em toda parte | `npm run lint` | FR-004, FR-004a |
| `bg-brand-tint-*` recusado fora do cartão de destino | idem | FR-004 |
| `bg-brand-tint-*` aparece em exatamente um arquivo | `tests/unit/no-orphan-tokens.spec.ts` | FR-004 |
| Nenhum valor visual literal entra com a feature | `npm run lint` | FR-035, SC-010 |
| Os dois temas mantêm estrutura e estados idênticos | `tests/components/`, `e2e/theme.spec.ts` | FR-036 |
