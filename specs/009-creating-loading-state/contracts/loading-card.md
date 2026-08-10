# Contrato — A composição do cartão em carregamento

Definição normativa de FR-001 a FR-013a, FR-018 a FR-018b, FR-022, FR-024, FR-025 e dos
SC-001, SC-004, SC-005, SC-006 e SC-010.

Fonte de verdade da forma: nó `qBqxK — Service Result · Loading`, instanciado como `yjjDB`
na tela `SjphR`, do arquivo `playlist-importer.pen`.

---

## 1. A ordem, que é a do arquivo

Cinco blocos, nesta sequência, dentro do cartão de fase que a 008 já entregou:

```text
1. cabeçalho do cartão      Y5hpLw  — já existe (CardHeader)
2. linha do indicador       RIMcK   — disco + título + subtítulo
3. descrição                G37LNR
4. grade de esqueleto       SxRFw
5. rodapé                   mJCdf
```

O aviso de espera por limitação de taxa (§6) **não** é um sexto bloco: ele aparece entre a
descrição e a grade apenas enquanto a espera dura, e some sem deixar buraco.

`SC-001` é a asserção de que os cinco existem e estão nessa ordem, nos dois serviços.

---

## 2. Anatomia, medida a medida

Toda medida vem da escala finita. A coluna "arquivo" existe para rastreabilidade; a coluna
"adotado" é o que vale (research §R4).

### 2.1 Linha do indicador

| Elemento | Arquivo | Adotado |
| --- | --- | --- |
| linha | respiro 14, itens centrados | `flex items-center gap-3` |
| disco | 44 × 44, raio 999, âmbar a 10,2% | `size-12 rounded-pill bg-accent-tint-surface`, centralizando o glifo |
| glifo | 22, `#F5B301` | `<Icon role="loading" className="text-step text-accent-text" />` |
| coluna de texto | respiro 3 | `flex flex-col gap-0.5` |
| título | 18 / 800 | `text-step`, o **mesmo degrau** do título do cartão de resultado |
| subtítulo | 12,5 / 500, `--ink-muted` | `text-meta text-ink-muted` |

O disco e o glifo são **decorativos** (FR-003): o disco é `aria-hidden`, o glifo é
`<Icon>` sem `label`, que é o padrão do componente e já resolve para `aria-hidden`.
Nenhum dos dois recebe foco — nenhum é elemento focável para começar.

### 2.2 Descrição

Parágrafo de largura cheia, `text-body text-ink-muted`. Sem `role`, sem região viva: o
texto é fixo do primeiro ao último quadro.

### 2.3 Grade de esqueleto

A grade espelha **exatamente** o `<dl>` do cartão de resultado, porque é o lugar dele que
ela ocupa:

```text
grid gap-2 sm:grid-cols-2        ← as mesmas classes do <dl> do resultado
  bloco ×4:
    flex flex-col gap-2
      barra de rótulo:  h-3 w-1/2 rounded-hair bg-skeleton
      barra de valor:   h-4 w-2/3 rounded-hair bg-skeleton
```

A grade inteira é `aria-hidden` e não contém nenhum nó focável (FR-009): ela não carrega
informação, e um leitor de tela que a alcançasse anunciaria oito caixas vazias.

**Larguras em fração, não em pixels.** O FR-008 manda preservar a proporção entre rótulo e
valor; 110 e 150 sobre uma coluna de ~228 são 48% e 66%. Fração sobrevive a 375px e a 200%
de zoom; pixel fixo não.

**Uma coluna abaixo de `sm`** (SC-006), pela mesma classe que o resultado já usa.

### 2.4 Rodapé

`text-meta text-ink-muted`, com `role="status"` (§4).

---

## 3. Como o SC-004 é satisfeito, e como é medido

**A promessa**: quando o resultado chega, o cabeçalho e o título do cartão não se movem.

**Como ela é cumprida** — pela aritmética, não por ajuste fino:

| | Cartão em carregamento | Cartão de resultado |
| --- | --- | --- |
| 1º filho | `CardHeader` | `CardHeader` — o mesmo componente |
| respiro | `gap-4` | `gap-4` |
| 2º filho | linha do indicador, altura = max(48, 47,7) = **48px** | `StepHeading`, título `text-step` |
| topo do título dentro do 2º filho | **0** — a coluna de texto (47,7px) e o disco (48px) ficam a 0,3px, então a coluna começa no topo da linha | **0** |

Logo o topo do título é o mesmo ponto nos dois estados. **O deslocamento é zero**, não uma
tolerância.

**Nota sobre o 2º filho** (§5.1): em carregamento ele é o Fragment `CreatingIntro`, cujo
primeiro nó é a linha do indicador de 48px. O Fragment é mais alto que a linha — ele
carrega também a descrição e, quando existe, o aviso de espera —, e isso **não** afeta a
conta acima: o que a medição compara é o **topo** do 2º filho, e crescer para baixo não
move o topo. É por isso que `CreatingIntro` devolve um Fragment e não um `<div>`: um
wrapper viraria um único filho flex, precisaria repetir `gap-4` por dentro, e a linha do
indicador deixaria de ser literalmente o 2º filho do cartão.

Isso depende de uma escolha explícita: o título do carregamento usa `text-step`, o mesmo
degrau do título do resultado. O arquivo escreve 18 e 22, nenhum dos dois na escala de
seis degraus; adotá-los literalmente exigiria um degrau novo para servir uma tela só e
entregaria de brinde o salto que o SC-004 proíbe (research §R3).

**Medição** (`e2e/`, projeto `desktop`): `boundingBox().y` do cabeçalho do cartão e do
título, capturados durante a criação e imediatamente depois de o resultado aparecer.
Diferença exigida: **0**.

O que fica **fora** da promessa, e é honesto registrar: a descrição e o rodapé existem só
no carregamento, então tudo que fica **abaixo** da grade muda de posição quando o
resultado chega. O SC-004 fala de cabeçalho e título, e é isso que é garantido.

---

## 4. Regiões vivas: no máximo duas, nunca redundantes

### 4.1 O rodapé é a região viva do conteúdo próprio (FR-013)

Um único nó `role="status"`, cujo texto é a função pura de `data-model.md` §2:

| Condição | Texto |
| --- | --- |
| `creation === null` ou `committedItemCount === 0` | "Aguardando confirmação do {serviço}…" |
| `committedItemCount > 0` | "{n} de {N} itens" |

**Um nó, não dois.** Dois nós que se revezam produzem dois anúncios na troca — a remoção
de um e a inserção do outro. O FR-013 pede um.

O disco e as barras não são anunciados em circunstância nenhuma (FR-003, FR-009).

### 4.2 O aviso de espera é a segunda e última (FR-013a)

Só existe enquanto a espera por limitação de taxa dura. As duas regiões nunca dizem a
mesma coisa:

| Região | Diz |
| --- | --- |
| rodapé | quanto da escrita já foi confirmado |
| aviso | que o serviço pediu pausa, e por quanto tempo |

Nenhuma terceira região viva pode ser introduzida por esta feature. `SC-010` é a asserção.

---

## 5. Onde isso mora no código

### 5.1 A reorganização do `ResultScreen` — o item de maior risco

Hoje `ResultScreen` retorna **duas árvores diferentes** conforme `result` seja nulo ou
não. Com isso, o React desmonta a seção inteira quando o resultado chega e não há
transição nenhuma a executar: a fusão cruzada do FR-010a é impossível de implementar por
cima dessa estrutura.

A reorganização exigida:

```text
ResultScreen
├─ (early return) ajuste de lista, quando `reducing`     — inalterado
└─ <section className="app-card flex flex-col gap-4">    — renderizada UMA vez
   ├─ <CardHeader provider>                              — uma vez
   │
   ├─ mostraCarregamento
   │    ? <CreatingIntro>    — Fragment: indicador + descrição + aviso de espera
   │    : <StepHeading>      — o título do resultado
   │
   ├─ <CrossFade>            — SEMPRE montado; a célula que a grade e o `<dl>` dividem
   │      saindo:   <ResultSkeleton>   quando `mostraCarregamento`
   │      entrando: <ResultStats>      quando `result !== null`
   │
   ├─ mostraCarregamento && <CreatingFootnote>           — o rodapé `role="status"`
   │
   └─ saídas de erro / retomada / cota + o resto do corpo de resultado — inalteradas
```

`CardHeader`, o cartão e a célula do `CrossFade` precisam ser **os mesmos nós de DOM** nos
dois estados. É isso que torna o zero do §3 verdadeiro e a fusão cruzada possível.

### 5.1.1 Por que o conteúdo de carregamento são dois blocos, e não um

A grade de esqueleto **não** vive dentro do corpo de carregamento. Ela e o `<dl>` de
informações reais dividem uma célula que é **filha direta do cartão** e está montada nos
dois estados.

Se a célula fosse filha do corpo de carregamento, ela desmontaria junto com ele no instante
em que `mostraCarregamento` virasse falso — e não haveria transição alguma a executar. É a
mesma falha que este §5.1 corrige um nível acima, reintroduzida um nível abaixo. Passar a
célula como `children` do corpo de carregamento não resolve: o que decide é onde o nó vive
na árvore, não de onde a JSX veio.

Como o rodapé fica **abaixo** da grade e o indicador **acima** dela, a célula compartilhada
atravessa o conteúdo de carregamento. Daí os dois blocos:

| Bloco | Conteúdo | Posição |
| --- | --- | --- |
| `CreatingIntro` | linha do indicador, descrição, aviso de espera | acima da célula |
| `CreatingFootnote` | o rodapé `role="status"` | abaixo da célula |

Os dois são exportados do **mesmo arquivo** — são um bloco lógico só, partido por uma
restrição de layout, e mantê-los juntos é o que deixa a partição legível.

### 5.1.2 Três detalhes da célula compartilhada

- **`CrossFade` devolve `null` quando os dois slots são nulos.** Sem isso o `gap-4` da
  seção cria um respiro fantasma no estado de `creationError`, onde não há nem esqueleto
  nem `<dl>`.
- **O wrapper do `CrossFade` carrega `position: relative`**: é ele o bloco de contenção do
  elemento que sai em `position: absolute` (`motion.md` §2.3).
- **`ResultStats` é função local em `ResultScreen.tsx`**, no molde do `CardHeader` que já
  mora ali — não é arquivo novo. É o `<dl>` de hoje extraído para poder virar slot.

### 5.2 Arquivos

| Arquivo | Estado | Papel |
| --- | --- | --- |
| `src/features/result/ResultScreen.tsx` | editado | a reorganização do §5.1, mais a função local `ResultStats` |
| `src/features/result/CreatingBody.tsx` | **novo** | dois exports: `CreatingIntro` (Fragment — indicador, descrição, aviso) e `CreatingFootnote` (o rodapé) |
| `src/features/result/ResultSkeleton.tsx` | **novo** | a grade de esqueleto, `aria-hidden`, montada no slot de saída do `CrossFade` |
| `src/ui/motion/` | **novo** | as três primitivas de movimento (ver `motion.md`) |
| `src/ui/RateLimitWaiting.tsx` | editado | a variante `countdown` (§6) |
| `src/domain/retry/countdown.ts` | **novo** | segundos restantes, função pura |
| `src/i18n/pt-BR.ts` | editado | subtítulo, descrição, rodapé |

Nenhum arquivo fora de `src/services/providers/{provider}/` passa a ramificar por
`ProviderId` (FR-023). Nada do que a feature introduz é colorido pela marca: o disco é
âmbar, as barras são neutras, os textos vêm da tinta principal e da secundária. O nome do
serviço chega já resolvido, por `nameOf(provider)`, como hoje.

---

## 6. O aviso de espera na criação inicial

### 6.1 O que muda

Hoje `RateLimitWaiting` aparece na busca (`SearchProgress`) e na retomada
(`RetryRemaining`). Na criação inicial não aparece: um backoff no meio da primeira criação
deixa a tela muda, e o disco girando não distingue "trabalhando" de "esperando o serviço
liberar". O FR-018 fecha essa lacuna.

### 6.2 A variante

`RateLimitWaiting` ganha uma propriedade `variant`, com padrão que preserva o
comportamento atual:

| `variant` | Ícone | Contagem | Cancelamento | Quem usa |
| --- | --- | --- | --- | --- |
| `'spinner'` (padrão) | `loading`, girando | não | conforme `onCancel` | busca, retomada — **intocadas** |
| `'countdown'` | **nenhum** | sim, `aria-hidden` | **nunca** | a criação inicial |

- **Sem ícone** e não com ícone parado: um glifo de carregamento congelado lê como
  travamento (FR-018a).
- **A contagem é `aria-hidden`.** Um número que muda a cada segundo dentro de um
  `role="status"` é um anúncio por segundo. A região viva carrega a frase, anunciada uma
  vez na entrada; os segundos são informação visual.
- **Sem cancelamento** (FR-018b). Cancelar uma escrita já confirmada em voo não é a mesma
  ação que cancelar uma busca, e esta feature não abre esse caminho. A propriedade
  `onCancel` simplesmente não é passada.

### 6.3 O relógio

`segundosRestantes(resumesAt, agora)` é pura e vive em `src/domain/retry/countdown.ts`,
com `agora` como parâmetro — o Princípio III proíbe relógio ambiente no domínio.

O `setInterval` de um segundo vive no componente e só existe enquanto o aviso está
montado. Ele é limpo no `useEffect` de desmontagem, como o assinante de `onWaitStateChange`
já é.

---

## 7. Desaparecimento por erro, sessão e cota (FR-024)

A regra de exibição de `data-model.md` §1 é conjunta, e é ela que garante o SC-005:

| Situação | O que acontece com o carregamento |
| --- | --- |
| falha da escrita (`creationError`) | some inteiro; a mensagem e as saídas ocupam o lugar |
| perda de sessão | a execução vai para `awaiting_reauth`, e `ServiceStep` troca a tela inteira |
| cota esgotada | `result` passa a existir; a fusão cruzada leva ao resultado parcial com o aviso de cota |
| retomada (FR-025) | o carregamento volta, com o rodapé já em progresso — nunca em "aguardando" |

**Em nenhuma condição de erro um indicador de carregamento sobrevive.** É o SC-005, e o
teste que o cobre exercita as três condições nos dois serviços.

---

## 8. Portões

| Verificação | Onde | Requisito |
| --- | --- | --- |
| Os cinco blocos existem, na ordem, nos dois serviços | `tests/components/creating-card.spec.tsx` | FR-001, SC-001 |
| Disco e grade não são alcançáveis nem anunciados | idem + `tests/a11y/` | FR-003, FR-009 |
| O rodapé é uma região viva só, e troca uma vez | `tests/components/creating-card.spec.tsx` | FR-011 a FR-013 |
| O cabeçalho e o título não se movem | `e2e/creating-loading.spec.ts` | FR-010, SC-004 |
| Uma coluna e nenhuma rolagem horizontal a 375px | `e2e/`, projeto `narrow-375` | FR-007, SC-006 |
| Nenhum indicador sobrevive a erro, reautorização ou cota | `tests/integration/` + componente | FR-024, SC-005 |
| A retomada reapresenta o carregamento com progresso | `tests/integration/reauth-creation.spec.ts` (asserção nova) | FR-025 |
| O aviso de espera aparece na criação, sem ícone e sem cancelar | `tests/components/creating-card.spec.tsx` | FR-018 a FR-018b, SC-010 |
| Zero violação séria ou crítica, dois serviços, dois temas | `tests/a11y/steps.spec.tsx` | FR-028, SC-007 |
| A suíte de criação passa sem alteração de asserção | suíte inteira | FR-026, SC-008 |
