# Fase 0 — Pesquisa

**Feature**: 007-official-design-alignment · **Data**: 2026-08-09

Todas as medições de contraste deste documento foram **calculadas**, não
estimadas, pela mesma fórmula WCAG que `src/domain/theme/contrast.ts` implementa.
Ainda assim, a autoridade final é `tests/unit/contrast.spec.ts`: os números aqui
são o insumo do desenho, não o veredito.

---

## §1. A maquinaria da 005 não muda de forma — só de conteúdo

**Decisão**: reaproveitar integralmente a arquitetura de duas camadas
(`tokens.css` cru por tema → `index.css` com `@theme inline` semântico), a lista
fechada de pares aprovados, o portão de contraste, o portão de tokens órfãos e a
regra de lint `tp/no-raw-visual-values`. Nada disso é reescrito; tudo é
repovoado.

**Rationale**: a 005 já resolveu os dois modos de falha caros. O primeiro é o
`inline` do `@theme`: sem ele o utilitário emite o hex resolvido em tempo de
build e a troca de tema por atributo não surte efeito. O segundo é o
comportamento silencioso do Tailwind quando um utilitário deixa de existir —
`bg-surface-sunken` depois de o token sumir não quebra o build, não falha no
`typecheck` e não aparece em log nenhum; a classe simplesmente não gera CSS.
`tests/unit/no-orphan-tokens.spec.ts` existe exatamente para isso, e esta feature
é uma migração de tokens ainda maior que a da 005.

**Alternatives considered**: reescrever a camada de tokens em CSS puro sem
Tailwind (descartado — perderia a regra de lint e o portão de escala finita, que
são o que impede o retorno do valor avulso); adotar o conjunto `--background` /
`--primary` que o arquivo de design carrega (descartado por FR-004 — verificado
nó a nó, **nenhum** elemento do design o referencia; é preset do editor).

---

## §2. As escalas do design são finas demais para serem adotadas ao pé da letra

**Evidência medida no arquivo** (contagem de ocorrências):

| Escala | Valores distintos encontrados | Concentração |
| --- | --- | --- |
| Tipografia | 17 tamanhos: 11 · 11,5 · 12 · 12,5 · 13 · 13,5 · 14 · 14,5 · 15 · 15,5 · 16 · 17 · 18 · 22 · 24 · 26 · 32 | 12,5 (98×) · 11,5 (60×) · 14 (57×) · 13,5 (40×) |
| Raio | 13 valores: 2 · 4 · 5 · 6 · 8 · 9 · 10 · 11 · 12 · 13 · 14 · 16 · 999 | 999 (97×) · 10 (44×) · 2 (35×) · 8 (14×) · 12 (13×) |
| Espaço (gap) | 17 valores: 1 a 36 | 2 (73×) · 6 (59×) · 14 (55×) · 10 (41×) · 12 (41×) |

**Decisão**: normalizar por agrupamento, conforme FR-025 e FR-026 — tipografia em
6 degraus, raio em 5, espaçamento em 8. Os valores finais estão em
`contracts/tokens.md` §3 e §4.

**Rationale**: 17 tamanhos de tipo com diferenças de meio pixel não são um
sistema, são o resíduo de um arquivo de design onde cada caixa foi ajustada no
olho. Meio pixel não é decisão de desenho: nenhum leitor distingue 12,5 de 13, e
manter os dois transforma "escala finita" em ficção. O agrupamento preserva a
**proporção** entre os degraus, que é o que se percebe, e descarta a precisão
falsa.

**Achado que exige decisão, não apenas normalização**: o design roda **menor**
que a 005 em toda a extensão. Seu tamanho mais frequente é 12,5px (98
ocorrências), abaixo do degrau `meta` (13px) da 005, e seu texto de conteúdo
gravita em 13,5–14px contra os 15px atuais. Adotar isso literalmente encolhe a
interface inteira.

**Decisão sobre o achado**: a escala é ancorada nas **proporções** do design, mas
nenhum texto que carregue conteúdo desce abaixo de 13px; o degrau de 12px
permanece reservado a rótulo tabular e numeral, como a 005 já fazia. É o mesmo
mecanismo do FR-003 — o design é ponto de partida, o valor ajustado é o
normativo — aplicado à tipografia em vez de à cor.

**Alternatives considered**: adotar os 17 tamanhos como escala (descartado —
esvaziaria FR-025 e o `--text-*: initial` que torna a escala finita de fato);
adotar a escala da 005 sem tocar nela (descartado — o design tem hierarquia
diferente, com um título de 32px que a 005 não tem, e ignorá-la perderia o ritmo
do desenho).

---

## §3. Contraste: o escuro passa quase inteiro; três valores não

Medições das cores cruas do design sobre os quatro substratos, tema escuro:

| Tinta | sobre `bg` #0D1117 | `zone` #12171F | `card` #161C25 | `raised` #1E2632 |
| --- | --- | --- | --- | --- |
| `text` #E9EEF5 | 16,23 | 15,42 | 14,68 | 13,07 |
| `muted` #8A94A6 | 6,19 | 5,88 | 5,60 | 4,98 |
| **`pending` #5F6878** | **3,37** | **3,20** | **3,05** | **2,71** |
| `accent` #F5B301 | 10,21 | 9,70 | 9,24 | 8,22 |
| `confident` #4FD1C5 | 10,15 | 9,64 | 9,18 | 8,17 |
| `danger` #F97066 | 6,79 | 6,45 | 6,14 | 5,47 |
| `success` #3FB950 | 7,45 | 7,08 | 6,74 | 6,00 |
| `spotify` #1DB954 | 7,32 | 6,95 | 6,62 | 5,89 |
| `youtube` #FF3B30 | 5,34 | 5,07 | 4,83 | **4,29** |

**Achado 1 — a hierarquia de três tintas do design não sobrevive ao piso de
contraste, e isso muda o desenho.** O `#5F6878` que o design usa na linha de
apoio das etapas ainda não alcançadas dá 2,71 a 3,37:1 — abaixo dos 4,5:1
exigidos para texto em **todos** os substratos.

A correção óbvia seria clarear até passar. Foi tentada e **não funciona**: o
valor que atinge 4,5:1 no escuro é `#8790A0`, praticamente indistinguível do
`--ink-muted` `#8A94A6` (razão entre os dois: 1,03). No claro é pior — o valor
que passa é `#606876` contra um `--ink-muted` `#5a6473`, razão de 1,07. Nos dois
temas, **tudo que é fraco o bastante para parecer "pendente" reprova, e tudo que
passa parece "secundário"**. Não há degrau entre os dois.

Decisão: **não existe terceiro nível de tinta.** O token `--ink-faint` é
descartado antes de nascer. A etapa pendente usa `--ink-muted` como qualquer
texto secundário, e a distinção entre pendente, atual e concluída vem da
**forma** — disco vazado contra disco tingido contra disco preenchido com sinal
de concluído — que é exatamente o que FR-011 e FR-042 já exigiam. O design
comunicava esse estado por tinta insuficiente; o sistema o comunica por forma.

Consequência: a família de cor fica com **18 tokens**, não 19.

**Achado 2 — o vermelho do YouTube não serve como texto sobre superfície
elevada** (4,29:1). Não é problema: FR-023 já restringe cor de marca a **acento
identificador**, isto é, ícone e filete, cujo mínimo é 3:1. O achado é a
justificativa medida do requisito, não uma exceção a ele.

**Achado 3 — o contorno do design não é um contorno significante.** `#252D3A`
sobre `bg` dá **1,37:1** e sobre `card` dá **1,23:1**. É separação decorativa,
não fronteira perceptível. Decisão: preservar a divisão de dois tokens que a 005
já tem — `--rule` recebe o valor do design e continua sendo filete decorativo;
`--rule-strong` continua existindo, com valor próprio ≥ 3:1, para tudo que
carregue significado (contorno de controle, borda de imagem de terceiro, anel de
foco). A estrutura existente absorve o achado sem token novo.

---

## §4. O tema claro: a recoloração é maior do que "trocar o âmbar"

Medições das cores do design sobre o substrato do tema Papel (`--bg` #faf7f0, o
pior caso do tema claro):

| Cor do design | sobre `#faf7f0` | Mínimo exigido | Situação |
| --- | --- | --- | --- |
| `accent` #F5B301 | 1,73 | 4,5 (texto) | Reprova — só serve como preenchimento |
| `spotify` #1DB954 | 2,42 | 3,0 (ui) | **Reprova** |
| `success` #3FB950 | 2,37 | 3,0 (ui) | **Reprova** |
| `confident` #4FD1C5 | 1,74 | 4,5 (texto) | **Reprova** |
| `youtube` #FF3B30 | 3,32 | 3,0 (ui) | Passa |

**Decisão**: cores de marca e de estado passam a ter **valor por tema**, não
valor único. As variantes escurecidas do tema claro, derivadas por redução de
luminosidade preservando matiz e saturação:

| Token | Escuro | Claro (proposta) | Razão medida (claro, sobre `#faf7f0`) |
| --- | --- | --- | --- |
| `--brand-spotify` | `#1DB954` | `#1AA54B` | 3,01 |
| `--brand-youtube` | `#FF3B30` | `#FF3B30` | 3,32 (inalterado) |
| `--state-live` | `#3FB950` | `#37A346` | 3,02 |
| `--state-confident` | `#4FD1C5` | `#217E76` | 4,55 |
| `--state-missing` | `#F97066` | `#E11809` | 4,53 |
| `--accent-text` | `#F5B301` | `#926B01` | 4,54 |

**Rationale**: FR-047 previu que sobreposições translúcidas não se traduzem; a
medição mostra que o problema é maior — **as cores saturadas do design foram
escolhidas contra um substrato quase-preto e não sobrevivem ao off-white**. O
âmbar já tinha esse tratamento na 005 (`--accent` para preencher, `--accent-text`
para escrever); a decisão aqui é generalizar o mesmo padrão às cores de marca e
de estado.

**Nota de implementação**: os valores acima pousam entre 3,01 e 4,55 — margem
apertada. A implementação MUST escurecer um degrau adicional para folga, e o
número normativo é o que `tests/unit/contrast.spec.ts` produzir depois do ajuste,
nunca o desta tabela.

**Alternatives considered**: usar as cores de marca só no tema escuro e neutro no
claro (descartado — quebraria FR-046, que exige estrutura idêntica entre temas);
abandonar o tema claro (descartado na clarificação de 2026-08-08).

---

## §5. A quarta superfície e as sobreposições translúcidas

**Decisão**: a família de superfícies vai de 3 para 4 degraus, com um token novo
`--surface-zone` para a barra superior e a trilha. As sobreposições brancas
translúcidas que o design usa (`#FFFFFF06`, `#FFFFFF08`, `#FFFFFF0A`, `#FFFFFF0F`)
**não são transcritas como translucidez**: cada uma vira um valor opaco por tema.

**Rationale**: três razões convergem. Translucidez branca sobre off-white não
produz degrau visível — o tema claro ficaria chapado (FR-047). Modo de cores
forçadas descarta preenchimento translúcido, e a separação entre zonas
desapareceria (FR-028). E o portão de contraste exige substrato **opaco** para
calcular razão; um fundo translúcido não tem razão definida, só uma faixa.

**Alternatives considered**: manter a translucidez e calcular o contraste contra
a composição resultante (descartado — o valor computado dependeria do que estiver
atrás, e o portão deixaria de ser determinístico).

---

## §6. `react-icons`: como integrar sem arrastar peso morto

**Decisão**: importar por subcaminho de conjunto — o pacote Lucide para os
quatorze ícones de interface e o Phosphor para os dois logotipos —, sempre atrás
de `src/ui/icons.ts`, que declara o mapa de papel → componente. Nenhum componente
da aplicação importa da biblioteca.

**Atualizado em 2026-08-09**: a marca deixou de vir do `list-music` do Lucide e
passa a vir de `src/assets/imgs/Logo Mark.png`, que sobreviveu à remoção da pasta
`src/assets/icons/`. Ela é arte, não ícone de interface — não se tinge pelo
contexto e não existe em biblioteca alguma. O papel `brand` continua no mesmo
mapa, mas resolve para um recurso em vez de um componente.

**Rationale**: `react-icons` publica cada conjunto como um módulo ESM com uma
exportação nomeada por ícone. O Vite faz *tree-shaking* disso, mas só quando a
importação é do subcaminho do conjunto; importar do índice raiz puxa a árvore
inteira e nenhum aviso é emitido. O mapa único é o que torna FR-059 verificável e
o que permite trocar um ícone sem varredura.

**A verificar na instalação, não aqui**: os nomes de exportação exatos. O Lucide
renomeou parte do conjunto (`check-circle` → `circle-check` e correlatos), e
`react-icons` acompanha a versão que empacota. A tarefa de instalação MUST
resolver os **dezoito** nomes contra a versão instalada — os dezesseis papéis de
biblioteca de `contracts/icons.md` §1 mais os dois por analogia da §2 — e falhar
explicitamente se algum não existir. É para isso que `tests/unit/icon-roles.spec.ts`
verifica que todo papel resolve para um componente definido.

**Alternatives considered**: transcrever os 16 SVGs à mão (mais simples pela
métrica da constituição e honestamente viável — registrado em Complexity
Tracking do plano; rejeitada por decisão de padronização do autor); usar sprite
SVG externo (descartado — requisição adicional e FR-057).

---

## §7. Recursos decorativos: o carregamento é a garantia, não o tamanho

**Decisão**: toda decoração é carregada de forma diferida e fora do caminho
crítico, com o espaço já dimensionado antes de o recurso chegar. O fundo ambiente
é aplicado como fundo de um elemento decorativo próprio, nunca como parte da
pintura inicial da zona.

**Rationale**: FR-069 removeu o teto de peso por decisão explícita; a garantia
passa a ser inteiramente comportamental. Isso torna **obrigatório** o que seria
apenas recomendável: dimensão reservada (senão a chegada de 617 KB empurra o
conteúdo), decodificação assíncrona (senão a imagem bloqueia a pintura) e
degradação limpa quando a imagem não vem (SC-014, que já é requisito).

**Alternatives considered**: pré-carregar o fundo ambiente para evitar o
aparecimento tardio (descartado — colocaria 617 KB no caminho crítico, que é
exatamente o que FR-050 proíbe); recomprimir (recusado pelo autor, FR-069).

---

## §8. Verificar fidelidade sem comparar pixel

**Decisão**: as asserções estruturais operam sobre o DOM renderizado e verificam
quatro classes de fato — presença e aninhamento das três zonas em cada etapa;
identidade do componente esperado em cada posição; token efetivamente aplicado
(via a propriedade customizada resolvida, não via nome de classe); e ausência de
valor visual literal. Rodam nos dois temas e nas duas larguras.

**Rationale**: é o formato que o projeto já pratica — `tests/a11y/steps.spec.tsx`
percorre as etapas, `tests/unit/no-orphan-tokens.spec.ts` varre a fonte,
`e2e/narrow-viewport.spec.ts` cobre a largura. Asserção estrutural pega o que de
fato regride numa migração de tokens: zona que sumiu, componente trocado, token
que deixou de ser aplicado. Não pega desalinhamento de 2px — e é por isso que
FR-073 mantém a conferência manual guiada por lista para a fidelidade fina.

**Por que não captura de tela**: baseline de pixel numa interface escura e pesada
de tipografia falha por antialiasing entre plataformas e entre versões de
navegador. Uma baseline que falha sem motivo é desligada em duas semanas, e o
portão que restou é pior que nenhum, porque dá impressão de cobertura. FR-072
registra a recusa.

---

## §9. A composição da trilha é regra, não apresentação

**Decisão**: criar `src/domain/rail/`, puro, exportando a lista de degraus a
partir de um instantâneo do estado — quais etapas existem, em que ordem, com que
número, em que estado (concluída, atual, pendente) e com que insumo para a linha
de apoio. `StepRail` e `StepSummary` apenas desenham o que esse módulo devolve.

**Rationale**: três regras não triviais moram aí — a etapa "Resumo" só existe com
mais de um destino (hoje repetida entre `StepIndicator` e o redutor da fila), a
numeração permanece contígua quando ela some (FR-013), e a linha de apoio é
derivada quando há valor e neutra quando não há (FR-012, FR-066). Deixar isso em
componente contraria o Princípio III e obriga a testar regra através do DOM.

**Consequência colateral desejável**: FR-066 — não afirmar uma escolha ainda não
feita — vira uma asserção de função pura, verificável sem renderizar nada.

**Alternatives considered**: derivar dentro do componente com `useMemo`
(descartado pelo Princípio III); estender o redutor da fila no store (descartado
— a fila é sobre execução de serviços, e a trilha inclui etapas anteriores a ela).

---

## §10. O colapso em largura estreita

**Decisão**: um único ponto de corte separa a casca de três zonas do arranjo
estreito. Acima dele, trilha à esquerda e painel lateral à direita. Abaixo,
a trilha vira resumo compacto no topo do conteúdo, o painel lateral desce para
baixo da coluna primária, e a ação de recomeçar migra para a barra superior.

**Rationale**: FR-054 exige que recomeçar continue acessível em largura estreita
e FR-052 proíbe introduzir controle novo ou parada de tabulação extra. A barra
superior é a única zona que sobrevive intacta nas duas larguras, então é o único
lar possível para a ação sem inventar um menu.

**Ponto de corte**: reaproveitar `--breakpoint-gutter` (40rem) renomeado, em vez
de introduzir um segundo ponto de corte. A goteira que ele governava está sendo
removida (FR-029), e a medida fica livre — mas a largura da casca de três zonas
exige mais espaço que a goteira exigia. Decisão: **medir na implementação** e
fixar o valor no contrato; a trilha de 296px mais uma coluna de leitura confortável
não cabe abaixo de ~64rem.

**Alternatives considered**: gaveta acionável (descartada na clarificação —
introduziria estado de abertura, armadilha de foco e fechamento por Esc); trilha
empilhada visível (descartada — cinco degraus com linha de apoio ocupam altura
demais no telefone).

---

## §11. O que sai, e o que a saída arrasta

**Decisão**: removidos `src/app/StepIndicator.tsx`, o utilitário `gutter-row`, o
utilitário `data-numeral` na sua função de goteira, o token `--gutter` e o
breakpoint homônimo. `SessionHeader` é absorvido por `ConnectionChip`.

**Rationale**: FR-029 remove a goteira. O risco é o descrito em §1 — utilitário
órfão não falha, só deixa de pintar. A denylist de `tests/unit/no-orphan-tokens.spec.ts`
MUST listar `gutter-row`, `--gutter`, `gutter:` e os nomes de token da paleta
antiga, e o teste MUST falhar enquanto restar uma ocorrência. É o critério
objetivo de "a migração terminou".

**Achado a vigiar**: `data-numeral` também é usado pela contagem tabular fora da
goteira. Sai da goteira, permanece como utilitário de numeral tabular. Remover os
dois de uma vez quebraria alinhamento de coluna em telas de resultado — é
exatamente o tipo de regressão que a denylist não pega, porque o utilitário
continua existindo.
