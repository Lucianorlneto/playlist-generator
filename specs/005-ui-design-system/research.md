# Fase 0 — Pesquisa e Decisões Técnicas

**Feature**: 005-ui-design-system | **Data**: 2026-08-07

Cada seção segue Decisão / Razão / Alternativas descartadas. As decisões marcadas
**[verificar]** têm um passo de confirmação obrigatório antes do código dependente ser escrito.

---

## §1. Dois temas sobre Tailwind 4 CSS-first

**Decisão**: duas camadas de variáveis. Os valores brutos ficam em `:root` (claro) e são
sobrescritos em `[data-theme='dark']`; os nomes semânticos entram em `@theme inline` apontando
para esses brutos, para que os utilitários gerados emitam a referência e não o valor resolvido.

```css
:root {
  --bg: #faf7f0;
  --ink: #141c26;
  /* … */
}
[data-theme='dark'] {
  --bg: #0d1219;
  --ink: #e8eaed;
}
@theme inline {
  --color-bg: var(--bg);
  --color-ink: var(--ink);
}
```

**Razão**: mantém a configuração CSS-first que o projeto já adotou (nenhum `tailwind.config.js`),
preserva os utilitários nomeados (`bg-bg`, `text-ink`) e faz a troca de tema custar uma mudança
de atributo — sem recarregar, sem recompor React, atendendo FR-007 e SC-003.

**[verificar]** O modificador `inline` do `@theme` precisa ser confirmado contra a 4.3.3
instalada: sem ele, o Tailwind resolve o valor em tempo de build e a sobrescrita por atributo
não surte efeito. Confirmação por teste de fumaça — um utilitário, os dois temas, inspeção do
CSS emitido — **antes** de qualquer componente ser migrado.

**✅ Confirmado em 2026-08-07 (T001, quickstart V1).** Sondagem descartável em
`src/styles/probe.css` com um único token (`--color-probe: var(--probe-raw)` dentro de
`@theme inline`), forçada a emitir por `@source inline("bg-probe")`, importada temporariamente
por `src/styles/index.css`. Após `npm run build`, o CSS emitido traz:

```css
.bg-probe{background-color:var(--probe-raw)}
:root{--probe-raw:#f4a900}
[data-theme=dark]{--probe-raw:#0d1219}
```

O utilitário emite a **referência**, não o hex resolvido, e a sobrescrita por atributo sobrevive
ao build. A decisão de §1 está validada contra a 4.3.3 instalada e a migração de componentes está
liberada. A sondagem foi apagada e o `@import` temporário revertido.

Observação operacional que vale registrar: um token declarado em `@theme inline` só aparece no
CSS emitido se algum utilitário derivado dele for encontrado pelo scanner. Token cujo utilitário
ninguém usa não gera erro — apenas não existe. É o mesmo modo de falha silenciosa que motiva
T009 e T012.

**Alternativas descartadas**:

- **`dark:` variant em cada componente**: multiplica por dois toda `className`, é exatamente o
  "valor visual avulso" que o FR-040 proíbe, e faz o número de decisões visuais dobrar.
- **Duas folhas de estilo trocadas em runtime**: segunda requisição, piscada garantida na troca,
  e complica o CSP.
- **`light-dark()` do CSS**: resolve pelo `color-scheme` do sistema e não permite sobrescrita
  manual pelo usuário sem um segundo mecanismo — não atende FR-006/FR-008 sozinho.

---

## §2. Nenhuma piscada de tema, sob `script-src 'self'`

**Este é o achado que mais restringe o desenho da solução.** O `vite.config.ts` injeta no build
uma meta CSP com `script-src 'self'` — **script inline é bloqueado**. O padrão de mercado para
FR-010 (aplicar o tema antes do primeiro quadro) é um `<script>` inline no `<head>`, e ele
simplesmente não roda aqui.

**Decisão**: solução em duas camadas.

1. **Camada CSS, sem script**: o bloco `@media (prefers-color-scheme: dark)` aplica os valores
   escuros por padrão. Isso já cobre corretamente **todo usuário que nunca escolheu tema** —
   que é o estado inicial de todos, conforme as premissas da spec.
2. **Camada script, só para a divergência**: um arquivo `public/theme-boot.js` — clássico, não
   módulo, mesma origem, referenciado no `<head>` antes do bundle — lê a preferência gravada e
   escreve `data-theme` no elemento raiz quando ela contradiz o sistema. Por ser bloqueante e
   estar antes do `<script type="module">`, roda antes da primeira pintura.

**Razão**: nenhuma alteração no CSP. A constituição trata a superfície de rede fechada como
Princípio II não negociável, e afrouxar a política — mesmo com hash — em nome de estética é a
troca errada. A camada CSS ainda faz o script ser irrelevante para o caminho mais comum, o que
limita o dano se o arquivo falhar em carregar.

**Custo aceito**: uma requisição bloqueante adicional de mesma origem, ~300 bytes.

**Risco identificado**: `public/theme-boot.js` fica fora de `src/` e portanto fora do TypeScript,
do lint e do alias `@`. Ele **duplica** a chave de armazenamento e o formato do registro que
`src/services/storage/schema.ts` define. Duplicação silenciosa é como esse tipo de arquivo
apodrece. Mitigação obrigatória: um teste unitário lê o texto de `public/theme-boot.js` e falha
se ele não contiver exatamente a chave exportada por `STORAGE_KEYS`.

**Alternativas descartadas**:

- **Script inline com hash `sha256-` no CSP**: zero requisição extra e ainda estrito, mas exige
  o plugin do Vite calcular e injetar o hash, e cria um ponto onde uma edição do script sem
  recalcular o hash quebra a aplicação em produção e não em desenvolvimento. Toca o Princípio II
  para ganhar um round-trip.
- **Aceitar a piscada**: viola FR-010 e SC-004 diretamente.
- **Renderizar no servidor**: proibido pelo Princípio I.

---

## §3. Fonte embarcada e orçamento de peso

**Decisão**: versionar o arquivo `.woff2` variável de Space Grotesk já subsetado em
`src/assets/fonts/`, importado pelo CSS com `@font-face` e `font-display: swap`. O subconjunto
cobre Latin Basic + Latin-1 Supplement + Latin Extended-A (acentuação de pt-BR e nomes de
artista europeus), pesos 400–700 do eixo variável.

**Razão**: SC-013 impõe teto de 80 KB comprimidos e FR-039 exige provar ausência de origem
remota. Um arquivo versionado no repositório satisfaz os dois de forma trivialmente auditável e
**não acrescenta nenhuma linha ao `package.json`** — o que importa num projeto cuja constituição
diz que o ônus da prova é de quem quer adicionar dependência. A licença de Space Grotesk é
SIL Open Font License 1.1, que permite redistribuição embarcada; **[verificar]** a licença deve
ser conferida no arquivo baixado e o texto dela versionado junto ao `.woff2`.

O comando de geração do subconjunto fica documentado no guia de estilo, para que a operação seja
reproduzível sem virar dependência de build.

### ✅ Executado em 2026-08-07 (T002, T003)

**Origem**: `https://github.com/floriankarsten/space-grotesk`, branch `master`, arquivo
`fonts/ttf/SpaceGrotesk[wght].ttf` (fonte variável, eixo `wght` 300–700, 1000 upem).

**Licença conferida (T002 / quickstart V2)**: o repositório traz `OFL.txt` declarando
"SIL Open Font License, Version 1.1", copyright 2020 The Space Grotesk Project Authors. O texto
integral (93 linhas) está versionado em `src/assets/fonts/OFL.txt`, ao lado do `.woff2`, como a
própria OFL exige de redistribuição embarcada.

**Comando exato de geração** — duas etapas, `fontTools` 4.60.2 em ambiente virtual descartável,
**nenhuma entrada nova no `package.json`**:

```bash
# 1. Limitar o eixo variável a 400–700 (a origem vai de 300 a 700)
fonttools varLib.instancer 'SpaceGrotesk[wght].ttf' wght=400:700 -o sg-wght-400-700.ttf

# 2. Subsetar preservando explicitamente `tnum`
pyftsubset sg-wght-400-700.ttf \
  --output-file=space-grotesk-subset.woff2 \
  --flavor=woff2 \
  --layout-features+=tnum \
  --unicodes="U+0000-00FF,U+0100-017F,U+2013-2014,U+2018-201A,U+201C-201E,U+2026,U+2039-203A,U+2044,U+20AC,U+2212" \
  --name-IDs='*' --name-legacy --notdef-outline
```

O `--layout-features+=tnum` **não é opcional e não é redundante**: `tnum` não está no conjunto
que o `pyftsubset` retém por padrão, então sem essa linha a feature seria removida em silêncio e
a goteira numerada perderia o alinhamento — exatamente o risco que §4 antecipou.

Aos três blocos declarados (Latin Basic, Latin-1 Supplement, Latin Extended-A) foram somados dez
pontos de código de pontuação geral que o texto da aplicação usa e que caem fora deles: travessão
e meia-risca, aspas curvas, reticências, aspas angulares simples, barra de fração, símbolo do euro
e o sinal de menos. Custo desprezível em bytes, e a alternativa seria a pilha nativa assumir
caractere isolado no meio de uma palavra.

**Resultado**: `src/assets/fonts/space-grotesk-subset.woff2`, **24.008 bytes** — 30% do teto de
80 KB do SC-013, com o orçamento inteiro consumido por um único arquivo. 417 glifos, 334 pontos de
código, acentuação de pt-BR verificada caractere a caractere.

**Alternativas descartadas**:

- **`@fontsource-variable/space-grotesk`**: menos trabalho manual e atualizável por `npm`, mas
  acrescenta dependência, entrega subconjuntos que não controlamos e torna o teto de 80 KB
  refém de uma decisão de terceiro.
- **Duas famílias (display + texto)**: contraria FR-034 e dobra o consumo do orçamento.
- **Servir de CDN de fontes**: violação direta do Princípio II.

**Fallback**: `font-display: swap` com pilha nativa de métrica próxima, mais `size-adjust` no
`@font-face` de fallback para atender FR-037 e SC-015 (nenhum deslocamento perceptível ao
concluir a carga). Caractere fora do subconjunto cai na pilha nativa, nunca em caixa vazia.

---

## §4. Algarismos tabulares

**[verificar] — bloqueia a assinatura do design.** A goteira numerada (design.md §5) depende de
os algarismos alinharem em coluna. Confirmar que o `.woff2` subsetado preserva a feature `tnum`
e que `font-variant-numeric: tabular-nums` produz avanço uniforme.

**Se não preservar**, em ordem de preferência: (a) incluir explicitamente a feature no subset;
(b) largura fixa no contêiner do numeral com alinhamento à direita, que resolve a coluna sem
depender da fonte; (c) segunda família monoespaçada — **último recurso**, porque contraria
FR-034 e consome o orçamento de SC-013.

A opção (b) é boa o bastante e não custa nada, então o risco real desta pendência é baixo.

### ✅ Confirmado em 2026-08-07 (T004, quickstart V3) — **plano B não é necessário**

Verificação em duas camadas.

**No arquivo**, sobre o `.woff2` já subsetado: a feature `tnum` sobreviveu ao subset e seus dez
lookups substituem os algarismos por variantes de **620 unidades cada, todas iguais**.

**No navegador** (Chromium, fonte servida por HTTP para que carregue de fato), medindo a largura
renderizada de `08`, `11` e `47` em `--text-data` (0,75rem / peso 500 / `letter-spacing: 0.03em`):

| Amostra | Com `tabular-nums` | Sem |
| --- | --- | --- |
| `08` | 15,609 px | 15,797 px |
| `11` | 15,609 px | 11,172 px |
| `47` | 15,609 px | — |

A coluna alinha. Vale registrar o outro lado da tabela: **por padrão os algarismos de Space
Grotesk são proporcionais**, e a diferença entre `08` e `11` é de 4,6 px — mais de um terço da
largura do numeral. A goteira numerada sem `tabular-nums` não ficaria levemente irregular, ficaria
visivelmente torta. A pendência era real e a declaração é obrigatória, não decorativa.

Consequência para a implementação: **T043 está liberado sem alteração de desenho**, e o utilitário
`data-numeral` (T018) carrega `font-variant-numeric: tabular-nums` como parte de sua definição —
é ali que a garantia mora, não em cada uso.

---

## §5. Verificação automatizada de contraste

**Decisão**: um teste unitário que importa a tabela de pares aprovados de um módulo único,
calcula a razão WCAG 2.x para cada par nos dois temas e falha abaixo do mínimo (4.5:1 texto
normal, 3:1 texto grande e elemento de interface). O cálculo é função pura em `src/domain/`.

**Razão**: FR-030 e o Princípio IV. É a diferença entre "cuidamos do contraste" e uma lista
fechada verificável — o mesmo raciocínio que a constituição já aplica à tabela de hosts. A
tabela de pares aprovados também é o que torna a verificação **exaustiva**: combinação não
declarada é combinação proibida, então não existe par escapando do teste por omissão.

Colocar o cálculo em `src/domain/` respeita o Princípio III e permite que o guia de estilo
cite os números gerados em vez de repetir valores à mão.

**Alternativas descartadas**:

- **Confiar no axe-core**: ele audita o que está renderizado na árvore do teste, não a matriz de
  pares. Estado que nenhum teste renderiza passa despercebido. Os dois se complementam.
- **Verificação manual em ferramenta externa**: envelhece na primeira mudança de tom.

### ✅ Portão em operação, e o que ele encontrou (T015, T016)

O teste lê os hex diretamente de `src/styles/tokens.css` e resolve os nomes nos dois temas.
Nenhum valor é repetido no arquivo de teste — um teste com sua própria cópia dos valores mede a si
mesmo e continua verde depois de o produto mudar de cor.

Na primeira execução: **31 casos passaram e 2 falharam**, exatamente o par 13 previsto pelo
contrato, medindo 1,7:1 no claro e 2,2:1 no escuro. A estimativa manual dizia 2,0 e 2,3 — errada
nos dois, e para menos no claro. O portão também corrigiu outros quatro números estimados, entre
eles o par 6, estimado em 10,4:1 e medido em 6,8:1.

**Decisão de T016**: `--rule-strong` passou a `#8f887a` no claro e `#5e7a9d` no escuro.

A escolha entre as duas saídas admitidas pelo contrato foi resolvida por uma observação que só
aparece quando se olha o sistema inteiro: **a separação por superfície já estava implementada, num
token diferente**. `--rule` é o divisor discreto e continua sem mínimo de contraste, porque reforça
uma separação que a luminosidade já faz. O que sobra para `--rule-strong` são os dois casos em que
o traço **é** o delimitador e não há superfície intermediária a que delegar — borda de campo e
contorno de capa de álbum. Ali a opção (b) equivaleria a remover a borda sem pôr nada no lugar.

Dois desdobramentos que valem registro:

1. **O alvo passou a ser as três superfícies, não só `--bg`.** A tabela original declarava um par
   por token de traço; um campo em foco troca o fundo para `--surface-raised`, e esse caso —
   o mais estreito dos três nos dois temas — ficava fora do portão. A lista fechada foi de 13
   para **15 pares**.
2. **Os dois traços deixaram de ser intercambiáveis.** `--rule` e `--rule-strong` não são mais
   graus da mesma coisa: são funções diferentes, com requisitos diferentes. Isso é o que a decisão
   muda no sistema inteiro, e é o motivo de ela vir antes de qualquer componente ser migrado —
   descobri-la depois de vinte componentes custaria vinte reedições.

---

## §6. Ausência de origem remota

**Decisão**: duas camadas.

1. **Unitário**, estendendo `tests/unit/no-secrets.spec.ts`, que já varre `src/**` em `.ts`,
   `.tsx` e `.css`: acrescentar recusa a `url(http…)`, `@import url(…)` externo e qualquer
   `src:` de `@font-face` que não aponte para caminho local.
2. **Ponta a ponta**, no Playwright: ouvir os eventos de requisição da página e falhar se
   qualquer uma escapar da lista de hosts autorizados, com os provedores mockados.

**Razão**: FR-039 pede verificação sobre o artefato, e a camada 2 é a que realmente observa o
navegador. A camada 1 é barata e falha mais cedo, no portão local de commit.

**Alternativa descartada**: varrer `dist/` num teste unitário — exigiria build antes do `npm test`,
invertendo a ordem do portão local que a constituição fixou.

---

## §7. Preferência de tema no armazenamento

**Decisão**: chave plana `tp.v2.theme` em `localStorage`, sob `RECORD_SCHEMA_VERSION = 2`,
gravada por `readVersioned`/`writeVersioned` como os demais registros. Conteúdo: um único campo
com valor `'light' | 'dark' | 'system'`.

**Razão**: FR-012 exige chave versionada e tipada; a infraestrutura já existe e já trata
armazenamento indisponível, JSON corrompido, forma inválida e versão desconhecida devolvendo
`null` com aviso, nunca exceção — que é exatamente o comportamento que FR-011 pede.

O isolamento de FR-013 é estrutural e sai de graça: as chaves de credencial, sessão, autorização
e cota são **funções** de `ProviderId`, e esta não é. Nenhum caminho de código que apaga dados de
provedor alcança `tp.v2.theme`, e vice-versa.

**Ponto de atenção**: o aviso de armazenamento indisponível já é emitido por `emitStorageWarning`
e chega à interface. A preferência de tema **não pode** produzir aviso visível ao usuário
(FR-011, casos de borda) — o consumidor precisa filtrar essa chave.

---

## §8. Forma do controle de tema

**Decisão**: grupo de três opções — Claro / Escuro / Sistema — como `radiogroup`, com ícone e
rótulo, colapsando para só ícones abaixo do breakpoint estreito, com nome acessível preservado.

**Razão**: um interruptor binário não consegue expressar o retorno a "acompanhar o sistema".
Com ele, o comportamento do FR-009 fica inalcançável após o primeiro clique — a preferência do
usuário existiria, mas sem caminho de volta a não ser limpar o armazenamento do navegador. Três
segmentos curtos custam pouco espaço e tornam legível um comportamento que, escondido, parece
mágica.

**Alternativa descartada**: interruptor binário sol/lua. Satisfaz a letra do FR-006 e é mais
compacto, mas transforma o estado inicial num beco sem saída.

---

## §9. Controles nativos e `color-scheme`

**Decisão**: declarar `color-scheme: light` e `color-scheme: dark` junto dos respectivos blocos
de variáveis.

**Razão**: `SearchProgress.tsx` usa `<progress>` nativo deliberadamente — a decisão está
comentada no arquivo e existe para que a barra seja anunciada corretamente a leitor de tela.
Elemento nativo só acompanha o tema se o `color-scheme` disser qual é. Vale igualmente para
barras de rolagem e para os controles de formulário. Sem isso, o tema escuro entrega uma barra
de progresso clara no meio da tela.

---

## §10. Regra de lint contra valor visual avulso

**Decisão**: nova regra em `eslint-rules/`, no modelo da `tp/no-ui-text-literals` já existente,
recusando em `src/features/`, `src/app/` e `src/ui/` qualquer utilitário Tailwind de cor,
espaçamento ou raio com valor arbitrário — notação de colchete (`bg-[#f4a900]`, `p-[13px]`) e
escala numérica crua de cor (`text-slate-500`).

**Razão**: FR-040 e SC-009. O projeto já estabeleceu que convenção que só existe em revisão de
código deve virar regra de lint ou ser abandonada; esta é a aplicação literal do princípio.

**Alternativa descartada**: revisão manual. É exatamente o que a constituição proíbe.

---

## §11. Auditoria de acessibilidade nos dois temas

**Decisão**: parametrizar `tests/a11y/steps.spec.tsx` por tema, rodando a suíte inteira duas
vezes com o atributo raiz alternado.

**Razão**: FR-031 e SC-002. Contraste é propriedade do par renderizado; auditar só o tema claro
deixaria metade da superfície sem verificação.

**Custo aceito**: a suíte de acessibilidade dobra de tempo. É a única forma honesta de sustentar
a afirmação "zero violações nos dois temas".

---

## §12. Modo de cores forçadas

**Decisão**: não lutar contra `forced-colors: active`. Garantir que estado nunca dependa só de
cor — ícone e rótulo textual sempre presentes (FR-017) — e que o foco use `outline`, que o modo
de alto contraste preserva, em vez de `box-shadow`, que ele descarta.

**Razão**: é o caso de borda registrado na spec. A decisão de FR-047 — estado como tinta + texto
+ ícone, nunca preenchimento sólido — já resolve a maior parte do problema de graça, porque a
informação sobrevive quando o sistema substitui todas as cores.

---

## Pendências que entram na Fase 1 como verificação

| # | Item | Bloqueia |
| --- | --- | --- |
| §1 | `@theme inline` na 4.3.3 | migração de qualquer componente |
| §3 | Licença OFL conferida no arquivo baixado | embarque da fonte |
| §4 | `tnum` preservado no subconjunto | a goteira numerada (assinatura) |
