# Contrato — Recursos decorativos

**Feature**: 007-official-design-alignment

Os três elementos decorativos do design, seus recursos, seu tratamento por tema e
as regras de carregamento. **Nenhum deles carrega informação** (FR-035).

---

## 1. Inventário

| Elemento | Recurso | Onde aparece | Peso |
| --- | --- | --- | --- |
| Fundo ambiente | `src/assets/imgs/Ambient Backdrop.png` | Área principal, todas as etapas | ~617 KB |
| Fotografia de clima | `src/assets/imgs/loja-de-discos-….jpg` | Painel lateral da etapa de Destinos | ~285 KB |
| Adesivos | 11 PNGs em `src/assets/imgs/` — Vinyl 1‑2, Cassette 1‑3, Headphones 1‑2, Boombox, Star 1‑2, Play Button | Etapa de Destinos | ~23 KB no total |

Todos versionados no repositório. **Nenhuma referência remota sobrevive** — a URL
de terceiro que o arquivo de design usava no fundo ambiente foi substituída pelo
recurso local (FR-048, SC-012). O portão é `e2e/no-remote-origin.spec.ts`.

---

## 2. Tratamento por tema

Um único tratamento para os dois substratos é **erro**, não simplificação
(FR-049). Os recursos foram compostos contra o quase-preto.

| Elemento | Escuro | Claro |
| --- | --- | --- |
| Fundo ambiente | Opacidade baixa + esmaecimento para `--bg` na borda inferior | Opacidade **menor** e mistura que impeça a textura escura de sujar o off-white |
| Fotografia | Sobreposição em degradê para o substrato, como o design mostra | Sobreposição própria; a mesma escureceria demais sobre papel |
| Adesivos | Como entregues | Requerem verificação individual: arte clara sobre papel some |
| Marca (`Logo Mark.png`) | Como entregue | **Verificação obrigatória**: arte composta contra o quase-preto pode sumir sobre o off-white. Exige variante, contorno ou filtro declarado |

**A verificação de cada adesivo sobre o substrato claro é tarefa própria**, não
suposição. Adesivo que desaparecer no tema claro precisa de variante ou de
contorno — nunca de ser deixado invisível.

A marca não entra no inventário da §1 porque não é decoração: o papel dela é
`brand`, declarado em `contracts/icons.md` §1. O que ela precisa deste contrato é
apenas o tratamento por tema, pela mesma razão que os adesivos — foi composta
contra o quase-preto (FR-049, FR-060).

---

## 3. Carregamento

A garantia de desempenho é **comportamental**, não dimensional: FR-069 removeu o
teto de peso por decisão explícita, e a primeira visita transfere ~930 KB de
decoração. Isso torna obrigatório o que seria apenas recomendável.

| Regra | Requisito |
| --- | --- |
| Fora do caminho crítico | Nenhum recurso decorativo participa da renderização inicial (FR-068) |
| Diferido | Nenhum é buscado antes do conteúdo da etapa em que aparece (FR-068) |
| Espaço pré-dimensionado | A caixa tem tamanho antes de o recurso chegar; nada se desloca (FR-070, SC-020) |
| Decodificação assíncrona | A imagem não bloqueia a pintura (FR-050) |
| Degradação limpa | Sem imagem, a tela é plenamente utilizável e sem buraco (SC-014) |

---

## 4. Semântica

- Todo elemento decorativo é **invisível a tecnologias assistivas** (FR-035, SC-013).
- Nenhum carrega informação que não exista em texto.
- Sob `prefers-reduced-motion`, qualquer movimento é suprimido ou tornado estático (FR-035).

---

## 5. O que os testes garantem

| Teste | Garante |
| --- | --- |
| `e2e/no-remote-origin.spec.ts` | Nenhuma requisição a terceiro, inclusive por recurso decorativo (SC-012) |
| `e2e/decor-loading.spec.ts` | Conteúdo legível e operável antes de a decoração carregar, sob rede lenta (SC-019) |
| `e2e/decor-loading.spec.ts` | Nenhum deslocamento de conteúdo quando o recurso chega (SC-020) |
| `tests/a11y/steps.spec.tsx` | Nenhuma decoração é anunciada por leitor de tela (SC-013) |
| Cenário de imagens desabilitadas | Todas as etapas utilizáveis, sem perda de informação (SC-014) |
