# Quickstart — Como verificar a feature 009

Guia de validação, não de implementação. Cada cenário abaixo prova um requisito de ponta a
ponta e nomeia o `FR-xxx` / `SC-xxx` que ele fecha.

---

## Pré-requisitos

```bash
npm install                       # motion@13 já está no package.json
npm run lint && npm run typecheck && npm test
```

O portão local da constituição precisa estar verde **antes** de qualquer verificação
manual. Esta feature altera o assistente e a criação de playlist, então
`npm run test:e2e` também é obrigatório antes de publicar.

---

## 1. Portões automatizados, do mais barato ao mais caro

```bash
# Camada de tokens: os dois valores novos, a faixa de perceptibilidade e a lista fechada
npx vitest run tests/unit/contrast.spec.ts

# A fechadura da biblioteca de movimento
npx vitest run tests/unit/motion-surface.spec.ts

# Fidelidade textual: as três frases novas contra o arquivo de design
npx vitest run tests/unit/design-text-fidelity.spec.ts

# Nenhum utilitário órfão, nenhum valor visual cru, ponto único de uso do disco
npx vitest run tests/unit/no-orphan-tokens.spec.ts

# O cartão: composição, regiões vivas, movimento reduzido, aviso de espera
npx vitest run tests/components/creating-card.spec.tsx

# Acessibilidade — dois serviços, dois temas
npx vitest run tests/a11y/steps.spec.tsx

# Não regressão do comportamento de criação (SC-008)
npx vitest run tests/integration
```

**O que cada falha significa**, para não depurar no escuro:

| Falha | Causa provável |
| --- | --- |
| `contrast.spec.ts` — par ausente | `APPROVED_PAIR_COUNT` não acompanhou a lista (31 → 32) |
| `contrast.spec.ts` — token indefinido no tema | `--skeleton` não foi repetido no bloco `@media` |
| `contrast.spec.ts` — fora da faixa | o valor de `--skeleton` precisa mudar naquele tema, não a faixa |
| `motion-surface.spec.ts` | alguém importou `motion` fora de `src/ui/motion/`, ou uma quarta primitiva apareceu |
| `design-text-fidelity.spec.ts` — chave descoberta | uma chave nova entrou sem item de inventário |
| `no-orphan-tokens.spec.ts` — espaçamento | uma medida do arquivo foi adotada literalmente em vez de mapeada para a escala |

---

## 2. Ponta a ponta

```bash
npx playwright test e2e/creating-loading.spec.ts --project=desktop
npx playwright test e2e/creating-loading.spec.ts --project=narrow-375
npx playwright test e2e/creating-loading.spec.ts --project=reduced-motion
```

O projeto `reduced-motion` é novo e existe para o SC-003: mesmo viewport do `desktop`, com
`use: { reducedMotion: 'reduce' }`.

E o portão de rede, que não muda mas precisa continuar passando (SC-009):

```bash
npx playwright test e2e/no-remote-origin.spec.ts
```

---

## 3. Cenários manuais — o que a máquina não vê

A fidelidade de **forma** continua sendo conferência humana, pelo método da 008. Rode
`npm run dev` e percorra a lista abaixo **nos dois temas**.

### 3.1 A tela existe e está na ordem certa · FR-001, SC-001

1. Configure a credencial do Spotify, escolha-o como destino único, cole três linhas.
2. Confirme a revisão.
3. Durante a criação, confira de cima para baixo: cabeçalho do cartão, disco com título e
   subtítulo à direita, descrição, grade de esqueleto em 2 × 2, rodapé.

> Uma lista de três linhas resolve rápido. Para segurar a tela, estrangule a rede nas
> ferramentas de desenvolvimento (perfil "Slow 3G") antes de confirmar.

### 3.2 O cabeçalho e o título não se movem · FR-010, SC-004

Com a rede estrangulada, posicione o cursor sobre o título e observe o instante em que o
resultado chega. **Nada acima da grade pode saltar.** A grade troca por fusão cruzada de
200ms; o cabeçalho e o título ficam parados.

O `e2e` mede isso com precisão de pixel; esta conferência pega o que a medição não pega —
a impressão de estabilidade.

### 3.3 Os dois serviços são a mesma tela · FR-022, US3

Repita 3.1 com o YouTube como destino único. Estrutura, ordem e movimento idênticos;
mudam o símbolo, a cor da marca no cabeçalho e o nome do serviço dentro das frases.

Depois, rode com **os dois** destinos e confira que a posição na fila do cabeçalho reflete
o segundo serviço quando ele entra em criação.

### 3.4 Movimento reduzido · FR-016, SC-003

Ative a preferência do sistema (macOS: Ajustes → Acessibilidade → Vídeo → Reduzir
movimento) e **recarregue a página**.

- O disco não gira. As barras não pulsam. Nada entra nem sai com transição.
- Título, subtítulo, descrição e rodapé continuam todos lá.

Conte os textos com e sem a preferência: o número é o mesmo.

### 3.5 O aviso de espera na criação · FR-018, SC-010

Provocar um 429 real é difícil; use a suíte MSW ou reduza o limite do
`rate-limiter` localmente. Durante a espera:

- o aviso aparece — hoje ele não aparece;
- o **disco é o único elemento em rotação** da tela — o esqueleto segue pulsando, e é o
  que se espera: a espera muda a explicação na tela, não o estado do cartão;
- o aviso não tem ícone e mostra os segundos que faltam;
- **não há botão de cancelar** (FR-018b);
- o rodapé continua dizendo o progresso da escrita, não a espera.

### 3.6 Nenhum indicador sobrevive a um erro · FR-024, SC-005

Três caminhos, um de cada vez:

| Caminho | Como provocar | Esperado |
| --- | --- | --- |
| Falha da escrita | derrube a rede no meio da adição | disco e grade somem; erro e saídas ocupam o lugar |
| Perda de sessão | apague a chave de sessão do serviço no `localStorage` durante a criação | tela de reconexão inteira, sem disco atrás |
| Cota esgotada | use o mock de cota do YouTube | cartão de resultado parcial com o aviso de cota |

### 3.7 Retomada · FR-025

Interrompa uma criação com mais de um lote, reconecte e retome. A tela volta ao mesmo
estado de carregamento, e o rodapé mostra **progresso** — nunca "aguardando confirmação".

### 3.8 Tela estreita e zoom · SC-006, FR-029

Em 375px: a grade colapsa para uma coluna e a página não rola na horizontal.
A 200% de zoom de texto: o disco tem tamanho fixo, o texto ao lado cresce, e nada é
empurrado para fora do cartão.

### 3.9 Cores forçadas

Ative o modo de alto contraste do sistema. As barras do esqueleto **desaparecem**, e está
correto: elas não carregam informação. O texto do cartão continua inteiro e o rodapé
continua dizendo o que está acontecendo.

---

## 4. Referências

- [`contracts/loading-card.md`](./contracts/loading-card.md) — composição, medidas, regiões vivas
- [`contracts/tokens.md`](./contracts/tokens.md) — as duas tintas e o portão de contraste
- [`contracts/motion.md`](./contracts/motion.md) — os três movimentos e a fechadura da biblioteca
- [`contracts/text-inventory.md`](./contracts/text-inventory.md) — o delta do inventário
- [`data-model.md`](./data-model.md) — as três derivações e as fronteiras não atravessadas
- [`research.md`](./research.md) — as onze decisões e as alternativas recusadas
