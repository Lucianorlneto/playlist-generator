# Plano de Design: Identidade Visual

**Feature**: 005-ui-design-system | **Data**: 2026-08-07

Artefato da primeira passada do método `frontend-design`: sistema de tokens, tipografia,
conceito de layout e elemento-assinatura. A segunda passada — a crítica contra o briefing —
está na seção final, e as revisões que ela produziu já estão aplicadas ao corpo do documento.

---

## 1. O sujeito

Antes de escolher qualquer cor: **o que é este produto e qual é o mundo dele?**

Não é um player de música. Não tem catálogo para navegar, não tem capa de álbum como herói,
não tem descoberta. É um **conciliador**: recebe uma lista de texto que alguém digitou, colou
de uma mensagem ou copiou de um setlist, e reconcilia linha a linha contra o catálogo de um
serviço — acertando umas, hesitando em outras, falhando em algumas — até virar playlist.

O mundo dele, portanto, não é o do Spotify. É o mundo da **lista**: o setlist rabiscado, o
verso da capa do disco com as faixas numeradas, a folha de papel da rádio com a programação,
o cue sheet do DJ, o J-card da fita cassete datilografado. Documento, não vitrine.

**Público**: quem já tem a lista pronta e quer ela dentro da conta, sem digitar 40 buscas.
**Trabalho único de cada tela**: mostrar em que pé está a conciliação e o que falta decidir.

Essa leitura é a origem de todas as decisões abaixo. Se o produto fosse um player, o herói
seria a capa; como ele é um conciliador, o herói é a linha.

---

## 2. Paleta

Semeada por Ocean Depths + Golden Hour (decidido em `/speckit-clarify`), ajustada até passar
nos limites de contraste. **Os hex abaixo são os valores normativos**; os do catálogo de temas
foram ponto de partida cromático, não destino.

### Tema escuro — "Noite"

| Token | Valor | Papel |
| --- | --- | --- |
| `--bg` | `#0d1219` | Fundo da página. Preto com fundo azul, mais fundo que a semente. |
| `--surface` | `#1a2332` | Superfície elevada. **É a semente do Ocean Depths, intacta.** |
| `--surface-raised` | `#223045` | Hover, linha alternada, campo em foco. |
| `--rule` | `#2c3a4d` | Divisor e borda em repouso. |
| `--rule-strong` | `#3d4f66` | Borda de controle, contorno de imagem de terceiro. |
| `--ink` | `#e8eaed` | Texto principal. |
| `--ink-muted` | `#9aa8b8` | Texto secundário. |
| `--accent` | `#f4a900` | **Primária.** Preenchimento de ação e texto de destaque. |
| `--accent-deep` | `#c98600` | Hover e estado ativo do preenchimento. |
| `--accent-ink` | `#0d1219` | Texto sobre preenchimento âmbar. |
| `--state-confident` | `#4ec4b8` | Teal, herdado do acento descartado do Ocean Depths. |
| `--state-uncertain` | `#f0c04a` | Âmbar pálido, dessaturado para não imitar a ação. |
| `--state-missing` | `#ff8a7a` | Vermelho. |

### Tema claro — "Papel"

| Token | Valor | Papel |
| --- | --- | --- |
| `--bg` | `#faf7f0` | Off-white com traço mínimo de calor. |
| `--surface` | `#ffffff` | Superfície elevada. |
| `--surface-raised` | `#f4efe4` | Hover e linha alternada. |
| `--rule` | `#e3dccd` | Divisor e borda em repouso. |
| `--rule-strong` | `#c9c0ac` | Borda de controle. |
| `--ink` | `#141c26` | Texto principal, marinho quase-preto. |
| `--ink-muted` | `#5a6473` | Texto secundário. |
| `--accent` | `#f4a900` | **Idêntico ao escuro.** Só preenchimento, nunca texto. |
| `--accent-deep` | `#d99700` | Hover do preenchimento. |
| `--accent-ink` | `#141c26` | Texto sobre preenchimento âmbar. |
| `--accent-text` | `#9a5b00` | Âmbar escurecido: link, foco, borda, texto de destaque. |
| `--state-confident` | `#14706b` | Teal escuro. |
| `--state-uncertain` | `#7a5c00` | Ocre-oliva, deslocado do `--accent-text` para não colidir. |
| `--state-missing` | `#b3261e` | Vermelho. |

### Contrastes calculados

Valores computados manualmente pela fórmula WCAG 2.x. **O portão automatizado do FR-030 é a
autoridade final** — estes números orientam o desenho, não substituem a verificação.

| Par | Escuro | Claro |
| --- | --- | --- |
| Texto principal sobre fundo | 15,6:1 | 16,0:1 |
| Texto secundário sobre superfície | 6,5:1 | 6,0:1 |
| Âmbar sobre fundo / âmbar-texto sobre fundo | 9,4:1 | 5,1:1 |
| Texto sobre preenchimento âmbar | 9,4:1 | 8,6:1 |
| Confiante | 7,5:1 | 5,5:1 |
| Incerto | ≥ 7:1 | 5,9:1 |
| Não encontrado | 6,9:1 | 6,1:1 |
| **Texto claro sobre âmbar** | **2,0:1 — proibido (FR-046)** | idem |

O anel de foco usa `--accent` no escuro (9,4:1) e `--accent-text` no claro (5,1:1), ambos
muito acima do mínimo de 3:1 exigido para elemento não textual.

---

## 3. Tipografia

**Space Grotesk**, variável, família única (FR-034). Grotesca geométrica com maneirismos
reais — o `g` de perna cortada, o `a` de topo reto, aberturas fechadas — que assinam sem
custar legibilidade.

| Papel | Tamanho | Peso | Ajustes |
| --- | --- | --- | --- |
| Título da etapa | 1,625rem | 600 | `letter-spacing: -0.02em` |
| Título de seção | 1,0625rem | 600 | — |
| Corpo | 0,9375rem | 400 | `line-height: 1.55` |
| Nome de faixa na conciliação | 0,9375rem | 500 | — |
| Secundário / meta | 0,8125rem | 400 | — |
| **Numeral de goteira e dado** | 0,75rem | 500 | `tabular-nums`, `letter-spacing: +0.03em` |

A última linha é a que mais importa e é o motivo de a escolha tipográfica não ser arbitrária:
número de linha, duração, contagem de faixas e orçamento de cota precisam **alinhar em coluna**.
Isso exige algarismos tabulares. Space Grotesk os oferece via `font-variant-numeric: tabular-nums`
— e essa disponibilidade é item de verificação obrigatório na Fase 0, porque se ela não existir
a alternativa é uma segunda família, o que contraria FR-034 e SC-013.

Nenhuma família de exibição separada. A hierarquia vem de peso, tamanho e espaço — não de
uma segunda fonte. Isso é escolha, não economia: um conciliador não precisa de voz editorial.

---

## 4. Layout: a goteira

Coluna única centrada de no máximo `46rem` — um pouco mais estreita que os `48rem` atuais,
porque a medida de linha atual é longa demais para texto corrido em telas grandes.

A decisão estrutural é uma **goteira de `2,5rem` à esquerda**, reservada em todas as telas.
Nas telas de lista ela carrega o número da linha e a marca de estado; nas demais fica vazia,
mas a borda esquerda do conteúdo permanece na mesma posição em todo o fluxo. É o que faz cinco
telas diferentes parecerem cinco páginas do mesmo documento.

```text
┌────────────────────────────────────────────────┐
│  Importador de playlist        [◑ tema]  [sair]│
│ ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄░░░░░░░░░░░░░░░░░░░░░░░░ │ ← régua âmbar (etapa)
│                                                 │
│  ┌────┬────────────────────────────────────────┐│
│  │ 07 │ Caetano Veloso — Sozinho               ││ ← entrada, como digitada
│  │    │ ▸ Caetano Veloso · Sozinho      4:12   ││ ← correspondência
│  │    │ ◆ confiante                            ││ ← estado, tinta + ícone
│  ├────┼────────────────────────────────────────┤│
│  │ 08 │ tim maia  -  azul da cor do mar        ││
│  │    │ ▸ Tim Maia · Azul da Cor do Mar 3:58   ││
│  │    │ ◆ incerto            [ver alternativas]││
│  ├────┼────────────────────────────────────────┤│
│  │ 09 │ faixa que não existe                   ││
│  │    │ ◆ não encontrada          [editar]     ││
│  └────┴────────────────────────────────────────┘│
└────────────────────────────────────────────────┘
```

Em telas estreitas a goteira colapsa: o número passa a prefixo em linha, mantendo os algarismos
tabulares e o alinhamento. Nada de rolagem horizontal (FR-023).

**Indicador de etapa**: a fileira de pílulas com separadores `›` sai; entra uma régua âmbar de
2px que preenche conforme o fluxo avança, com os nomes das etapas em texto pequeno abaixo. Não
é a assinatura — é o indicador de etapa feito quieto, para não competir com ela.

**Elevação**: no tema escuro, nenhuma sombra — profundidade vem de degraus de luminosidade e
de filetes de 1px, que é como o escuro realmente funciona. No claro, um único nível de sombra
suave. Dois sistemas de profundidade diferentes porque os dois substratos são diferentes;
fingir simetria aqui produziria sombras invisíveis no escuro.

**Movimento**: praticamente nenhum. A régua avança em 200ms; o resto é instantâneo. Sob
`prefers-reduced-motion`, também a régua deixa de animar (FR-020).

---

## 5. Assinatura: o número de linha que não solta

**A goteira numerada é o elemento único desta interface**, e ela é informação, não ornamento.

O número que aparece ao lado de uma faixa é **o número da linha que a pessoa colou**. Ele nasce
na tela de entrada e sobrevive a tudo: à busca, à correspondência incerta, à edição manual, à
deduplicação, à falha parcial, à reconexão depois de a sessão expirar, à retomada em lote. A
linha 7 continua sendo a linha 7 na tela de falhas, no resumo e no relatório do que não entrou.

Isso resolve o problema mais difícil que o produto tem — *"quais das minhas 60 linhas não
entraram, e por quê?"* — com um recurso gráfico em vez de prosa. E justifica a numeração:
a `frontend-design` alerta que marcadores numerados (01/02/03) costumam ser decoração, válidos
apenas quando a ordem carrega informação de que o leitor precisa. Aqui carrega. É a chave
primária do domínio, exposta na interface.

Consequências que amarram o resto do sistema:

- Os algarismos tabulares deixam de ser refinamento e viram requisito funcional.
- A goteira fixa deixa de ser capricho de layout e vira a estrutura que unifica as telas.
- O âmbar ganha um segundo trabalho além do botão: ele é a cor da identidade da linha.

Toda a ousadia está aqui. O resto — botões, campos, diálogos, cartões — é deliberadamente
sóbrio.

---

## 6. Segunda passada: crítica contra o briefing

A `frontend-design` exige revisar o plano perguntando, item a item, se aquilo é escolha para
este projeto ou o que eu produziria para qualquer projeto parecido. O que a revisão encontrou:

**Clichê nº 2 — fundo quase-preto com um acento vibrante.** O tema escuro mora perto desse
endereço, e é honesto dizer. Duas defesas, uma legítima e uma que precisou de trabalho. A
legítima: o briefing fixou preto/marinho com laranja/amarelo, e a própria skill determina que
o briefing vence quando ele pede um desses looks. A que exigiu trabalho: se a paleta não
diferencia, a diferenciação precisa vir de outro eixo — e é exatamente por isso que a goteira
numerada existe. Além disso o sistema não é monocromático de acento único: o teal de "confiante"
é um segundo polo cromático permanente na tela mais usada do app.

**Clichê nº 1 — creme quente com serifada de alto contraste e acento terracota.** O tema claro
passa perto e escapa em três eixos: o fundo `#faf7f0` é bem mais claro e menos bege que o
`#F4F1EA` típico; não há serifada em lugar nenhum; e o acento é âmbar com teal, não terracota.

**Clichê nº 3 — diagramação de jornal, filetes capilares, raio zero.** Não se aplica: raios de
4px e 8px, coluna única, sem colunas de jornal.

**O que mudei na revisão.** O plano original tinha *dois* elementos candidatos a assinatura —
a goteira numerada e a régua âmbar de progresso. Aplicando o conselho de Chanel que a skill
cita, tirei um acessório: a régua foi rebaixada a indicador de etapa comum, sem protagonismo,
e a goteira ficou sozinha como assinatura. Dois elementos memoráveis é o mesmo que nenhum.

**O que descartei antes de chegar aqui.** Numeral gigante de etapa em âmbar com rótulo pequeno
— é literalmente o "template answer" que a skill nomeia. Agulha de toca-discos como indicador
de progresso — esqueumorfismo bonitinho que só serve a uma tela e envelhece mal. Manter a lista
original visível como espinha lateral durante todo o fluxo — estruturalmente interessante,
mas quebra em tela estreita e contraria a exigência de não aumentar a complexidade de uso.

---

## 7. Fronteira que este plano não atravessa

A `frontend-design` traz uma seção forte sobre escrita de interface — voz ativa, o botão
"Publicar" gera "Publicado", erro que não se desculpa, tela vazia como convite. **Nada disso
é aplicado nesta feature.** O FR-035 congela os textos existentes, e mexer em copy aqui
misturaria duas mudanças de natureza diferente na mesma revisão. Os únicos textos novos são
os do controle de tema (FR-022), que nascem já sob essas regras.

Revisão de copy do fluxo inteiro fica registrada como candidata a feature própria.
