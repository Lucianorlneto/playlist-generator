# Conferência de fidelidade ao design oficial

**Feature**: 007-official-design-alignment · **FR-073**, SC-001a
**Percorrida em**: 2026-08-09

Esta lista existe porque as asserções estruturais **não pegam** desalinhamento de
2px, peso tipográfico errado nem adesivo invisível sobre o tema claro. FR-072
recusou a comparação por imagem de referência; o que sobra é o olho, e um olho
sem lista percorre o que lembra.

```bash
npm run dev
```

Cada tela, **nos dois temas** e nas **duas larguras**.

---

## Como percorrer

| Passo | O que fazer |
| --- | --- |
| 1 | Subir `npm run dev` |
| 2 | Percorrer cada tela nos dois temas, em 1440px e em 375px |
| 3 | Marcar cada item; abrir uma linha na tabela de discrepâncias para o que não passar |
| 4 | **Nenhuma discrepância pode ficar aberta** |

O item de **maior risco** é o último de cada tela — a legibilidade da decoração
no tema claro. As artes foram compostas contra um quase-preto e perdem de 4× a
9× de contraste sobre o papel (`contracts/decor.md` §2). Um adesivo que sumiu
tem `src`, `alt` e tamanho corretos, e nenhum teste percebe.

---

## Por tela

### 1. Configuração

- [x] Composição de zonas: barra superior, trilha, área principal
- [x] Um cartão por serviço, com o passo numerado no próprio cartão
- [x] As ações de credencial ficam **dentro** do cartão que as explica (FR-061)
- [x] **Não há barra de ações** no rodapé (FR-016)
- [x] Proporção e ritmo do espaçamento entre cartões
- [x] Peso tipográfico: título de tela em `--text-page`, título de cartão em `--text-section`
- [x] Decoração legível e discreta **no tema claro também**

### 2. Destinos

- [x] Cartões de destino com `--radius-panel` e cor de marca no ícone
- [x] Cor de marca **nunca** preenche o cartão (FR-023, FR-024)
- [x] Painel lateral não rouba a largura de leitura (FR-020)
- [x] Barra de ações presente, com a contagem de destinos à esquerda
- [x] Fotografia de clima com sobreposição **própria de cada tema** (FR-049)
- [x] Os onze adesivos visíveis nos dois temas

### 3. Entrada

- [x] Campo com `--radius-control` e contorno `--rule-strong`
- [x] Campo em foco sobre `--surface-raised`, com anel por `outline`
- [x] Barra de ações presente, com a contagem de linhas
- [x] Com lista vazia, o motivo do bloqueio aparece **por escrito**
- [x] Decoração legível no tema claro

### 4. Ciclo do serviço — conexão

- [x] "Pular o {serviço}" adjacente ao cartão da fase (FR-062)
- [x] **Não há barra de ações** no rodapé
- [x] Indicação de fila com o papel `queue`

### 5. Ciclo do serviço — estimativa de cota

- [x] Ação de pular adjacente ao cartão de orçamento (FR-062)
- [x] Números em `data-numeral`, tabulares

### 6. Ciclo do serviço — busca

- [x] `<progress>` acompanha o tema, sem barra verde
- [x] Aviso de espera por limite de taxa com tinta de "incerta", não de erro

### 7. Ciclo do serviço — revisão

- [x] Três estados de correspondência distinguíveis por fundo tingido, contorno, ícone **e** rótulo
- [x] **Nenhum selo preenchido** — preenchimento sólido significa acionável (FR-024)
- [x] Capa de terceiro com contorno `--rule-strong` nos dois temas
- [x] Numeral tabular alinhando entre `08` e `11`
- [x] Nome de faixa e artista em `--text-body`, sem descer ao piso

### 8. Ciclo do serviço — criação

- [x] Barra de progresso e estado por extenso

### 9. Ciclo do serviço — resultado

- [x] Linhas que falharam com o numeral da entrada, tabular
- [x] Ação de copiar por serviço

### 10. Resumo

- [x] **Não há barra de ações** no rodapé (FR-061)
- [x] Um bloco por destino, com o desfecho de cada um

### 11. Recuperação de rascunho

- [x] Faixa com `guide-edge` — barra âmbar de 3px, não fundo tingido
- [x] Ícone de dica acompanhando o texto, decorativo

---

## Transversal

- [x] A trilha marca a posição correta em todas as etapas
- [x] A linha de apoio **nunca** afirma escolha que o usuário não fez (FR-066)
- [x] Exatamente um `aria-current="step"` por etapa (FR-041)
- [x] "Recomeçar do início" acessível, e **em um lugar só** por largura (FR-054)
- [x] Abaixo de 64rem a trilha colapsa em resumo compacto
- [x] De 320px a 1920px, nenhuma rolagem horizontal
- [x] A 200% de zoom de texto, nenhuma zona corta conteúdo
- [x] A árvore de componentes é idêntica entre os temas; só a cor difere

---

## Discrepâncias encontradas, e o que foi feito

A primeira passagem encontrou quatro. Todas fechadas; **nenhuma ficou aberta**.

| # | Onde | O que estava errado | Correção |
| --- | --- | --- | --- |
| 1 | Destinos, painel lateral | O painel repetia o título e a introdução da etapa. A mesma frase aparecia **duas vezes na mesma tela**, a 30cm de distância — repetir não reforça, divide a atenção entre duas cópias | O painel ficou com o que o design põe nele: clima. Fotografia e adesivos, nenhum texto |
| 2 | Destinos, adesivos | Os onze adesivos estavam em `-z-10` dentro de um painel com fundo próprio: **invisíveis nos dois temas**. `src`, `alt` e tamanho estavam corretos, e por isso nenhum teste percebeu | Removido o `-z-10`; os adesivos sobrepõem o painel |
| 3 | Destinos, fotografia (tema claro) | O véu claro usava 35% de branco sobre a imagem inteira. A foto virava um retângulo pálido — a versão clara do mesmo problema que FR-049 existe para impedir no escuro | Véu reduzido para 14%, com o degrau para `--surface-zone` só na borda inferior |
| 4 | Barra superior, 375px | O divisor vertical entre chips e controles sobrava como traço solto no fim de uma linha, depois de a barra quebrar — separando nada de nada | Escondido abaixo do ponto de corte da casca |

### O que a conferência automatizável cobriu

Além do olho, uma varredura mediu o que dá para medir sem olhar, nas três
primeiras telas × dois temas × duas larguras:

- presença das três zonas, e o colapso correto da trilha em cada largura;
- **contraste efetivo** de cada texto visível contra o fundo que ele de fato
  pousa, resolvido pelo navegador — que é o que a suíte não mede, porque ela lê
  os tokens e não a composição final.

Resultado depois das quatro correções: **sem discrepância**.

---

## Fronteira desta lista

Ela **não substitui** a suíte. O que os testes garantem está em
`docs/style-guide.md` §13. O que esta lista existe para pegar é o que passa por
todos eles: 2px de desalinhamento, um peso 600 onde deveria ser 700, e a arte
que carregou, tem o tamanho certo e não se vê.
