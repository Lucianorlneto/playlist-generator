# Quickstart — Validação da feature 008

Como provar que a feature funciona, de ponta a ponta. Cada cenário nomeia o requisito que
valida e o que o desqualifica. Detalhe de implementação **não** mora aqui — está nos
contratos.

## Pré-requisitos

```bash
npm install
```

Nenhum Client ID real é necessário para os testes: `tests/msw/` e `e2e/support/` mockam
os dois provedores. Para a conferência manual de forma, um Client ID por serviço é
suficiente — a autorização real não é exercida por nenhum destes cenários.

---

## O portão, em ordem de custo

```bash
npm run lint          # valores visuais, texto fora do i18n, exceção nomeada de cor de marca
npm run typecheck
npm test              # domínio, componentes, integração, a11y, e o inventário de textos
npm run test:e2e      # obrigatório: a feature toca a etapa Destinos e o ciclo do serviço
```

Os quatro passando é condição necessária, não suficiente: SC-011 exige também a
conferência de **forma**, que é manual por decisão registrada.

### Os testes que existem por causa desta feature

```bash
npx vitest run tests/unit/design-text-fidelity.spec.ts    # FR-030b, SC-001
npx vitest run tests/unit/header-context.spec.ts          # FR-009 a FR-013, SC-004
npx vitest run tests/unit/rail-composition.spec.ts        # FR-027 a FR-029
npx vitest run tests/unit/contrast.spec.ts                # FR-003, SC-002
npx vitest run tests/unit/no-orphan-tokens.spec.ts        # FR-004
npx vitest run tests/components/destinations.spec.tsx     # FR-006, FR-015, FR-019, FR-021
```

---

## Cenário 1 — A cor do serviço, nos dois temas (US1, FR-001 a FR-005, SC-002)

```bash
npm run dev
```

Com os dois Client IDs cadastrados, percorra as cinco etapas e confira que o símbolo do
Spotify sai em verde e o do YouTube em vermelho **em todos** os lugares em que o arquivo
os desenha: chip da barra superior, distintivo do cartão de destino, marcador da fila no
painel lateral, cabeçalho do cartão de fase do ciclo. Alterne o tema em cada um.

**Desqualifica**: um símbolo em tinta neutra; um preenchimento com cor de marca em
qualquer lugar que não seja o distintivo do cartão; a cor sobrevivendo ao tema mas
mudando com o estado de foco do elemento que a contém.

O portão automatizado do contraste:

```bash
npx vitest run -t "SC-002"
```

---

## Cenário 2 — A etapa sem moldura (US2, FR-006 a FR-008, SC-003)

Percorra as cinco etapas com o inspetor aberto. Nenhuma delas tem superfície com contorno
envolvendo todo o conteúdo. Em Destinos, o título "Para onde vai a playlist?" e a
descrição ficam diretamente sobre o substrato da área principal.

Cada cartão que **sobrar** precisa corresponder a um cartão do arquivo — os do arquivo
são: cartão de destino, cartão de credencial por serviço, cartão de fase do ciclo, linha
de correspondência, cartão de resultado por serviço, painel lateral. Superfície que exista
na aplicação e não no arquivo — diálogo, selo de versão, aviso de espera por limite de
taxa — permanece por FR-008 e é registrada no checklist, não removida.

**Desqualifica**: um cartão sem correspondência e sem registro.

---

## Cenário 3 — A linha de contexto, incluindo onde ela não existe (US3, FR-009 a FR-013, SC-004)

Com uma conta conectada, percorra as etapas e confira contra a tabela de FR-009:

| Onde | O que deve estar lá |
| --- | --- |
| Configuração | **nada** acima do título |
| Destinos | "Oi, {primeiro nome}" em âmbar + "· vamos levar suas músicas pra casa" em cinza |
| Entrada | mesma saudação + "· hora de colar sua lista" |
| Conexão / busca / revisão | "{Serviço} — 1 de 2", **sem** saudação |
| Orçamento | "{Serviço} · Conferindo o orçamento" |
| Resultado | "{Serviço} · Concluído" |
| Resumo | **nada** acima do título |

Depois desconecte os dois serviços e recarregue: em Destinos e Entrada a linha exibe **só
o complemento** — nunca um nome inventado, nunca um espaço vazio.

Com um único destino selecionado, a posição na fila some da linha do ciclo.

**Desqualifica**: qualquer linha em Configuração ou Resumo; saudação nas telas do ciclo;
nome completo onde deve haver primeiro nome; a posição "1 de 1".

---

## Cenário 4 — O painel de ordem de execução (US4, FR-014 a FR-020, SC-005, SC-006)

Na etapa Destinos:

1. Com os dois destinos marcados, o painel lista Spotify como primeiro e YouTube como
   segundo, com o aviso de execução em série, a fotografia e a legenda.
2. Desmarque um: o painel reflete a mudança e **não** lista o destino não escolhido.
3. Desmarque os dois: o painel continua no lugar, com cabeçalho, aviso, fotografia e
   legenda, e convida a escolher um destino no lugar da fila. **A largura da coluna
   primária não muda em nenhum desses passos.**
4. Leia o corpo da etapa: a explicação da ordem de execução aparece **uma única vez** na
   tela.

Com as imagens desabilitadas no navegador, repita: cabeçalho, fila, aviso e legenda
continuam legíveis.

```bash
npx playwright test e2e/decor-loading.spec.ts --project=desktop
```

**Desqualifica**: o painel sumindo ou colapsando com seleção vazia; a explicação da ordem
aparecendo duas vezes; qualquer informação do painel dependendo da fotografia.

---

## Cenário 5 — O cartão de destino (US5, FR-021 a FR-025)

Cadastre os dois Client IDs, conecte **apenas** um serviço e volte a Destinos:

- o cartão conectado nomeia a conta;
- o outro diz que a autorização acontece ao executar aquele serviço;
- **os dois cartões têm a mesma altura**;
- remova a credencial de um: o motivo do bloqueio continua escrito e o atalho para a
  Configuração continua disponível, ainda na mesma altura.

Por teclado: Tab alcança o controle de cada cartão, o foco é visível na marca de
verificação, Espaço alterna a seleção, e o rótulo continua clicável.

```bash
npx playwright test e2e/keyboard.spec.ts --project=desktop
```

**Desqualifica**: o cartão mudando de altura quando a sessão é obtida ou perdida; o
controle inalcançável ou sem foco visível.

---

## Cenário 6 — Os textos (US6, FR-026 a FR-031, SC-001)

```bash
npx vitest run tests/unit/design-text-fidelity.spec.ts
```

O teste percorre `tests/fixtures/design-inventory.json` e, para cada texto marcado como
adotado, renderiza o template do dicionário com a amostra registrada e compara com a
string do arquivo de design. Confira o relatório: nenhum item pode estar sem `chave` e sem
`motivo`.

Na direção inversa, o mesmo teste exige que **toda** chave de `t` esteja coberta — por um
item do inventário ou por uma entrada de `tests/fixtures/design-inventory-exclusions.json`
com o motivo escrito. É o que faz um texto novo parar a suíte até alguém decidir se ele
corresponde a algo no arquivo de design. Para ver o modo de falha, acrescente uma chave
qualquer ao dicionário e rode de novo: o teste falha nomeando o caminho.

Na aplicação, confira a assinatura sob o nome do produto ("Texto → Spotify · YouTube") e
as linhas de apoio da trilha:

- em Configuração, com nada decidido: "Suas credenciais", "Cole a lista de músicas",
  "Criação e resultado", e Destinos **sem** afirmar escolha nenhuma;
- depois de escolher os dois destinos, volte para Configuração: a linha de Destinos
  **continua** exibindo os destinos escolhidos, mesmo com o degrau à frente da etapa
  corrente (FR-028).

**Desqualifica**: a trilha afirmando "Spotify e YouTube" antes da escolha; a linha de
apoio voltando a neutra ao navegar para trás.

---

## Cenário 7 — Não regressão (FR-032 a FR-036, SC-007 a SC-010)

```bash
npm test && npm run test:e2e
```

SC-009 é literal: **nenhum** teste de comportamento existente muda de resultado. Se um
teste de fluxo, validação, cota, retomada ou armazenamento precisou ser editado, ou o
comportamento mudou — o que a feature proíbe — ou o teste dependia de estrutura de
apresentação, e nesse caso a edição precisa estar registrada e justificada.

Largura estreita:

```bash
npx playwright test --project=narrow-375
```

Acessibilidade: `tests/a11y/steps.spec.tsx` sem violação séria ou crítica em nenhuma
etapa.

Contra o `dist/` construído, para provar que nada depende do dev server:

```bash
npm run build && npm run preview
E2E_BASE_URL=http://127.0.0.1:4173 npx playwright test
```

---

## Conferência manual de forma (SC-011)

O que a máquina não verifica — composição, espaçamento, alinhamento, ritmo, peso
tipográfico — é conferido tela a tela contra o arquivo de design, com o desfecho de cada
item registrado em `checklists/design-fidelity.md`. **Nos dois temas e nas duas
larguras.** É a única parte do portão que continua dependendo de olho, e a divisão está
registrada nas premissas da spec: texto por máquina, forma por asserção estrutural mais
conferência guiada.
