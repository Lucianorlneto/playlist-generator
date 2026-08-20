# Quickstart — Sistema de movimento do aplicativo

Como verificar que a feature funciona. Cada seção é executável e cita o requisito que ela
prova. Detalhes de valor e de comportamento estão nos contratos; aqui está o que rodar e o
que esperar.

---

## Pré-requisitos

```bash
npm install          # nenhuma dependência nova nesta feature
npm run dev          # http://127.0.0.1:5173/
```

O host `127.0.0.1` é fixo — as plataformas de OAuth recusam `localhost` como Redirect URI.

Para exercitar o fluxo sem credencial real, use os provedores mockados de `e2e/support/`,
que é o que os testes de ponta a ponta já fazem.

---

## 1. Portão local

O portão que a constituição exige antes de qualquer commit:

```bash
npm run lint         # inclui tp/no-raw-motion-values e tp/no-motion-library-import
npm run typecheck
npm test
```

`npm run test:e2e` é **obrigatório** antes de publicar: esta feature altera o fluxo do
assistente, um dos três gatilhos que a constituição nomeia.

---

## 2. A fechadura continua fechada

```bash
npx vitest run tests/unit/motion-catalog.spec.ts
```

**Espera-se**: o catálogo tem exatamente as seis entradas de `contracts/motion-catalog.md`
§2, o barril só reexporta arquivos locais, nenhuma primitiva anima propriedade proibida, e
`Settle` é a única que anima posição. _(FR-001 a FR-003, FR-009, SC-001, SC-002)_

Para ver o teste falhar como deve — vale fazer uma vez:

1. Acrescente `export { motion } from 'motion/react';` em `src/ui/motion/index.ts`.
2. Rode o teste. Ele deve falhar apontando a origem indevida, **não** a contagem.
3. Rode `npm run lint`. A regra deve falhar antes, no editor.
4. Desfaça.

---

## 3. A escala tem origem única

```bash
npx vitest run tests/unit/motion-scale.spec.ts
```

**Espera-se**: os valores de `src/ui/motion/scale.ts` e os do `@theme` de
`src/styles/index.css` concordam degrau a degrau, e nenhum token existe em só uma das
camadas. `base` continua valendo 200ms. _(FR-006, FR-007, SC-003)_

Verificação manual de que o padrão do Tailwind saiu de cena:

```bash
npm run build
grep -o 'default-transition-duration:[^;]*' dist/assets/*.css
```

**Espera-se**: `200ms`, não os 150ms padrão do Tailwind.

---

## 4. O escalonamento tem teto

```bash
npx vitest run tests/unit/stagger.spec.ts
```

**Espera-se**: a defasagem da última linha de uma lista de **120** é igual à da última de
uma lista de **8** — as duas em 240ms. _(FR-013, SC-009)_

Na tela: cole uma lista longa na etapa de Entrada, deixe a busca terminar e observe que as
primeiras linhas entram em sequência e o resto entra junto. A lista inteira está assentada
em menos de meio segundo depois de aparecer.

---

## 5. A troca de etapa não move a casca e não atrasa o foco

```bash
npx vitest run tests/components/step-transition.spec.tsx
npx playwright test e2e/motion.spec.ts --project=desktop
```

**Espera-se** no teste de componente: o foco chega ao título da nova etapa **no mesmo
quadro**, a árvore que sai tem `inert` e `aria-hidden`, o retorno anima na direção oposta ao
avanço, e a primeira montagem não anima. _(FR-016, FR-017, FR-022, FR-024, SC-008)_

**Espera-se** no e2e: as caixas delimitadoras da barra superior, da trilha e da barra de
ação são **idênticas** em todos os quadros da transição. _(FR-021, SC-007)_

Na tela, com as ferramentas do navegador abertas em "Rendering → Paint flashing": avance de
Destinos para Entrada. Só a coluna principal deve piscar.

Teclado, que é o caminho onde o defeito apareceria primeiro:

1. Avance de etapa com `Enter` no botão de avançar.
2. Pressione `Tab` imediatamente, antes de a transição terminar.
3. **Espera-se**: o foco percorre os controles da etapa **nova**. Nenhum controle da etapa
   que está saindo é alcançável.

---

## 6. Nada anima durante a busca

```bash
npx vitest run tests/components/review-motion.spec.tsx
```

**Espera-se**: durante a fase de busca, nenhuma animação nova está em curso, e linhas de uma
execução retomada — já em cena antes de a busca começar — permanecem imóveis quando a busca
termina. _(FR-026a, SC-015)_

---

## 7. O portão de ociosidade fecha

```bash
npx vitest run tests/components/settle.spec.tsx
```

**Espera-se**: com `idle={false}`, `Settle` não aplica animação de posição alguma.
_(FR-010a, SC-015)_

O `typecheck` é a outra metade: `<Settle>` sem a prop `idle` não compila.

---

## 8. Movimento reduzido

```bash
npx playwright test --project=reduced-motion
```

**Espera-se**: nenhuma animação em curso em nenhuma tela, e a contagem de textos exibidos e
de controles alcançáveis **idêntica** à do projeto `desktop`. _(FR-014, FR-015, SC-004,
SC-005)_

Manualmente, no macOS: Ajustes do Sistema → Acessibilidade → Vídeo → Reduzir movimento.
Percorra o fluxo inteiro. Nada deve se mover, e nada deve faltar.

---

## 9. Repouso, tela estreita e interrupção

```bash
npx playwright test e2e/motion.spec.ts
```

**Espera-se**:

| Cenário | Resultado |
| --- | --- |
| Tela em repouso, sem requisição em voo | Nenhuma animação em curso _(FR-034, SC-014)_ |
| Projeto `narrow-375`, todos os quadros | Nenhuma rolagem horizontal _(SC-012)_ |
| Avançar e voltar antes de a transição terminar | Estado final correto, nenhum nó preso _(FR-018, SC-013)_ |
| Avançar e voltar dentro dos 200ms | A nova transição parte dos valores correntes, sem cortar ao estado final _(FR-018a)_ |
| Cancelar a busca durante a entrada escalonada | Nenhuma linha presa em estado intermediário |
| Abrir a reautorização durante uma transição | O diálogo fica operável imediatamente _(FR-036)_ |

---

## 10. As fases do ciclo de serviço não animam

```bash
npx vitest run tests/components/service-phases.spec.tsx
```

**Espera-se**: percorrer conectar → estimar → buscar → revisar → criar → concluir não produz
transição de tela alguma. O movimento visível nesse trecho é exatamente o que a feature 009
já entregava, nem mais nem menos. _(FR-021a, SC-016)_

---

## 11. O cartão de destino não é transformado

```bash
npx vitest run tests/components/destination-card.spec.tsx
```

**Espera-se**: marcar e desmarcar transita cor, contorno e caixa de marcação, e **não** aplica
escala nem deslocamento. _(FR-031)_

---

## 12. Os adesivos encenam uma vez só

```bash
npx vitest run tests/components/stickers.spec.tsx
```

**Espera-se**: a primeira aparição de Destinos encena; sair e voltar mostra os adesivos já
postos. Recarregar a página reencena — é sessão nova. _(FR-032a, SC-017)_

---

## 13. Acessibilidade e os dois temas

```bash
npx vitest run tests/a11y/
```

**Espera-se**: nenhuma violação séria ou crítica em nenhuma tela animada, nos dois temas.
_(FR-020, SC-011)_

E o portão visual que já existe e não pode regredir:

```bash
npx vitest run tests/unit/contrast.spec.ts tests/unit/no-orphan-tokens.spec.ts
```

Esta feature não introduz token de cor nenhum; os dois devem passar sem alteração.

---

## 14. O artefato de produção continua íntegro

```bash
npm run build
npm run preview      # http://127.0.0.1:4173/
```

Com o `dist/` servido, abra o console. **Espera-se**: nenhuma violação de CSP registrada
enquanto qualquer animação roda. Escrita via CSSOM não passa pelo analisador de CSP
(`research.md` §R1), e este é o passo que prova isso no artefato real, não em
desenvolvimento.

```bash
npx vitest run tests/unit/no-secrets.spec.ts
E2E_BASE_URL=http://127.0.0.1:4173 npx playwright test e2e/no-remote-origin.spec.ts
```

**Espera-se**: nenhum host novo, nenhuma origem remota. Esta feature não toca a rede.
