# Quickstart — Validação da feature 007

**Feature**: 007-official-design-alignment

Como provar que a readequação está correta. Cada cenário aponta o requisito que
verifica; nenhum reproduz código de implementação.

---

## Pré-requisitos

```bash
npm install          # inclui react-icons, a dependência nova (FR-055)
npx playwright install --with-deps   # se ainda não instalado
```

Nenhuma credencial real é necessária: os provedores são mockados por MSW nos
testes e por rotas interceptadas no Playwright.

---

## Portão local completo

```bash
npm run lint         # tp/no-raw-visual-values, tp/no-ui-text-literals, importação de ícone
npm run typecheck
npm test             # unidade, componente, integração, a11y
npm run test:e2e     # fluxo, teclado, largura estreita, origem remota, decoração
```

Os quatro MUST passar antes de qualquer commit; o `test:e2e` MUST passar antes de
publicar, porque esta feature altera o fluxo do assistente na superfície.

---

## 1. A migração terminou?

O critério objetivo, não a impressão:

```bash
npx vitest run tests/unit/no-orphan-tokens.spec.ts
```

**Falha de propósito enquanto a migração não termina.** A denylist vem de
`contracts/token-migration.md` §5: resquício da goteira, `text-item`, importação
de `StepIndicator` ou `SessionHeader`, hex da paleta anterior fora de
`tokens.css`, importação de ícone fora do mapa.

Verifica: FR-029, FR-056, FR-059, SC-011, SC-016.

---

## 2. As cores passam nos dois temas?

```bash
npx vitest run tests/unit/contrast.spec.ts
```

Percorre os 27 pares de `contracts/tokens.md` §2 nos dois temas, lendo os valores
de `src/styles/tokens.css`. Falha por par **reprovado ou ausente** — a lista é
fechada, e omissão não passa como aprovação.

**Este teste é a autoridade sobre os números.** Se ele discordar da tabela do
contrato, o contrato se corrige.

Verifica: SC-002, SC-005.

---

## 3. A casca está montada como o design manda?

```bash
npx vitest run tests/components/shell.spec.tsx tests/components/step-rail.spec.tsx tests/components/action-bar.spec.tsx
```

Asserções estruturais, sem captura de pixel (FR-072). Cobrem, nos dois temas e
nas duas larguras:

- as três zonas existem e estão aninhadas na ordem de leitura;
- a barra de ações existe em Destinos e Entrada e **em nenhuma outra etapa**;
- "Pular o serviço" está dentro do cartão da fase, não na faixa inferior;
- exatamente um elemento carrega `aria-current="step"`;
- o chip `no-credential` não contém identificador de conta.

Verifica: FR-006, FR-009, FR-016, FR-041, FR-061, FR-062, FR-071, FR-074, SC-001.

---

## 4. A trilha diz a verdade?

```bash
npx vitest run tests/unit/rail-composition.spec.ts
```

Função pura, sem DOM. Os casos que importam:

| Cenário | Esperado |
| --- | --- |
| Um destino selecionado | O degrau "Resumo" **não existe**; numeração 1‑2‑3‑4 contígua |
| Dois destinos | "Resumo" existe; numeração 1‑2‑3‑4‑5 |
| Na Configuração, nada escolhido ainda | A linha de apoio de Destinos é **neutra** — não nomeia provedor nenhum |
| Na Entrada, dois destinos escolhidos | A linha de apoio de Destinos nomeia os destinos reais |
| Configuração atual vs concluída | Linhas de apoio diferentes |
| Qualquer fase do ciclo de serviço | Nenhuma fase vira degrau |

O terceiro caso é o que separa esta implementação do mockup: o arquivo de design
mostra "Spotify e YouTube" sob Destinos mesmo na tela de Configuração, e
reproduzir isso seria a trilha afirmando uma escolha que o usuário não fez.

Verifica: FR-012, FR-013, FR-014, FR-066, FR-067.

---

## 5. Os ícones estão todos no lugar?

```bash
npx vitest run tests/unit/icon-roles.spec.ts
```

Todo papel resolve para um componente definido; nenhum papel órfão; nenhum
componente sem papel. **É este teste que falha, com o papel nomeado, quando um
nome de exportação do `react-icons` muda de versão.**

Verifica: FR-051, FR-055, FR-059, SC-016, SC-017.

---

## 6. Acessibilidade

```bash
npx vitest run tests/a11y/steps.spec.tsx
npx playwright test e2e/keyboard.spec.ts e2e/narrow-viewport.spec.ts
```

- axe-core em todas as etapas, **nos dois temas** — zero violações sérias ou críticas;
- fluxo completo por teclado, foco visível, ordem de tabulação = ordem visual;
- o controle de tema continua sendo **uma** parada de tabulação;
- de 320px a 1920px, nenhuma rolagem horizontal, nenhum alvo de toque menor que o mínimo;
- abaixo do ponto de corte, a trilha some, o `StepSummary` aparece e **não** acrescenta parada de tabulação;
- a ordem de tabulação segue as três zonas novas — barra superior, trilha, conteúdo, barra de ações — e todo controle movido ou criado pela feature tem foco visível desenhado por `outline`;
- a 200% de zoom de texto as três zonas continuam legíveis e nenhuma corta conteúdo.

Verifica: FR-037, FR-038, FR-039, FR-040, FR-052, SC-003, SC-007, SC-008.

---

## 7. A decoração não atrapalha

```bash
npx playwright test e2e/decor-loading.spec.ts e2e/no-remote-origin.spec.ts
```

- sob rede lenta simulada, o conteúdo de cada etapa está legível e operável **antes** de qualquer decoração carregar;
- nada se desloca quando o recurso chega;
- com imagens desabilitadas, todas as etapas permanecem utilizáveis, sem buraco;
- nenhuma requisição sai para terceiro — inclusive por recurso decorativo ou fonte de ícone.

Verifica: FR-048, FR-050, FR-057, FR-068, FR-070, SC-012, SC-014, SC-019, SC-020.

---

## 8. Nada de comportamento mudou

```bash
npm run test:e2e
```

O conjunto inteiro de ponta a ponta é o portão do FR-005. Em particular MUST
continuar passando sem alteração de expectativa:

| Arquivo | O que protege |
| --- | --- |
| `e2e/create-playlist.spec.ts` | O fluxo completo, com o mesmo número de passos (SC-006) |
| `e2e/multi-destination.spec.ts` | Dois destinos, fila, resumo |
| `e2e/reconnect.spec.ts` | Reautorização no meio da execução |
| `e2e/draft-recovery.spec.ts` | Recuperação de rascunho |
| `e2e/theme.spec.ts` | Troca de tema sem recarregar, sem perder trabalho (SC-010) |
| `e2e/connect.spec.ts` | Autorização de cada provedor |
| `e2e/flexible-search.spec.ts` | Busca por forma livre |
| `tests/components/skip-service.spec.tsx` | Pular serviço — comportamento da 006 (FR-062) |
| `tests/components/reset-flow.spec.tsx` | Confirmação antes de descartar (FR-065) |

**Se algum destes precisar mudar de expectativa, é sinal de que a feature saiu do
escopo** — ela move, recolore e renomeia superfícies; não muda o que a aplicação
faz.

---

## 9. Conferência manual — a fidelidade fina

As asserções não pegam desalinhamento de 2px nem peso tipográfico errado. FR-073
exige uma lista de conferência versionada, percorrida tela a tela contra o
arquivo de design.

```bash
npm run dev
```

Para cada uma das onze telas do design, nos dois temas:

- [ ] composição de zonas idêntica;
- [ ] mesmos componentes, na mesma hierarquia;
- [ ] proporção e ritmo do espaçamento;
- [ ] peso tipográfico e alinhamento;
- [ ] decoração legível e discreta **no tema claro também** — os recursos foram compostos contra o quase-preto.

O último item é o de maior risco e o mais fácil de esquecer: um adesivo claro
sobre papel simplesmente desaparece, e nenhum teste automatizado percebe.

Verifica: FR-049, FR-073, SC-001a.

---

## Ordem sugerida de validação durante a implementação

1. `contrast.spec.ts` — antes de tocar em qualquer componente. Se a paleta não passa, nada adiante importa.
2. `rail-composition.spec.ts` — o domínio puro, antes da trilha existir na tela.
3. `icon-roles.spec.ts` — resolve os nomes de exportação antes de espalhá-los.
4. Asserções estruturais, tela a tela.
5. `no-orphan-tokens.spec.ts` — o último a passar; é ele que declara a migração encerrada.
6. Conferência manual.
