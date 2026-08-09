# Contrato — Papéis de ícone

**Feature**: 007-official-design-alignment

Os ícones vêm de `react-icons`, importados por subcaminho de conjunto, atrás de
um mapa único em `src/ui/icons.ts`. **Nenhuma superfície importa da biblioteca**
(FR-055, FR-056, FR-059).

---

## 1. Os dezessete papéis

Coluna "ícone no design" é o nome que aparece no arquivo `.pen` — a chave de
rastreabilidade entre desenho e código.

| Papel | Ícone no design | Conjunto | Exportação (`react-icons` 5.5.0) | Onde aparece |
| --- | --- | --- | --- | --- |
| `brand` | `Logo Mark.png` | **arte local** — `src/assets/imgs/` | — (arte, não componente) | Símbolo da marca na barra superior |
| `theme-light` | `sun` | Lucide | `LuSun` | Controle de tema |
| `theme-dark` | `moon` | Lucide | `LuMoon` | Controle de tema |
| `theme-system` | `monitor` | Lucide | `LuMonitor` | Controle de tema |
| `restart` | `rotate-ccw` | Lucide | `LuRotateCcw` | Recomeçar o fluxo |
| `reconnect` | `refresh-cw` | Lucide | `LuRefreshCw` | Ação do chip de conexão |
| `advance` | `arrow-right` | Lucide | `LuArrowRight` | Botão primário da barra de ações |
| `back` | `arrow-left` | Lucide | `LuArrowLeft` | Botão discreto da barra de ações |
| `done` | `check` | Lucide | `LuCheck` | Degrau concluído, caixa de seleção, confirmação |
| `status-ok` | `circle-check` | Lucide | `LuCircleCheck` | Texto de estado da barra de ações |
| `confident` | `gem` | Lucide | `LuGem` | Selo de correspondência confiante |
| `hint` | `info` | Lucide | `LuInfo` | Caixa de dica, aviso informativo |
| `queue` | `list-ordered` | Lucide | `LuListOrdered` | Cabeçalho do painel "Ordem de execução" |
| `loading` | `loader-circle` | Lucide | `LuLoaderCircle` | Estado de carregamento |
| `external` | `external-link` | Lucide | `LuExternalLink` | Link que sai da aplicação |
| `provider-spotify` | `spotify-logo` | Phosphor | `PiSpotifyLogo` | Identificação do provedor |
| `provider-youtube` | `youtube-logo` | Phosphor | `PiYoutubeLogo` | Identificação do provedor |

**Subcaminhos**: `react-icons/lu` (Lucide) e `react-icons/pi` (Phosphor). Os
dezesseis nomes acima foram resolvidos contra `react-icons@5.5.0` em 2026-08-09
(T003) e todos existem. Registro das variantes descartadas, para que a próxima
atualização de versão saiba o que já foi conferido: `LuCheckCircle`,
`LuXCircle`, `LuAlertTriangle` e `LuLoader2` **não** existem nesta versão — o
Lucide renomeou a família `*-circle` para prefixo `Circle*` e a `loader-2` para
`loader-circle`.

**A marca é o único papel que resolve para arte em vez de componente.** Ela não
se tinge pelo contexto e não existe em biblioteca alguma. Os outros dezesseis vêm
de `react-icons` — quatorze do Lucide, dois do Phosphor. Como arte composta
contra o quase-preto, a marca cai sob FR-049 e exige tratamento declarado nos
dois temas (`contracts/decor.md` §2).

**Os nomes de exportação exatos não estão fixados aqui de propósito.** O Lucide
renomeou parte do conjunto e `react-icons` acompanha a versão que empacota. A
tarefa de instalação resolve os dezoito — os dezesseis desta seção mais os dois
por analogia da §2 — contra a versão instalada; se algum não existir,
`tests/unit/icon-roles.spec.ts` falha com o papel nomeado.

---

## 2. Papéis que o design **não** cobre

O arquivo de design não desenha selo para correspondência incerta nem para não
encontrada — só o "confiante" (`gem`). Como FR-063 estabelece que silêncio não é
remoção, os dois selos existentes permanecem e recebem papel por analogia:

| Papel | Analogia | Exportação (`react-icons` 5.5.0) | Justificativa |
| --- | --- | --- | --- |
| `uncertain` | Ícone de atenção do mesmo conjunto | `LuTriangleAlert` | Mesma família visual do `gem`; a distinção entre os três estados é por forma, tinta e rótulo (FR-024) |
| `missing` | Ícone de ausência do mesmo conjunto | `LuSearchX` | Idem. Entre os candidatos de ausência (`LuCircleX`, `LuBan`, `LuSearchX`), o escolhido é o único que diz **a busca não encontrou** em vez de **proibido** ou **removido** — o estado é ausência de resultado, não erro do usuário |

**Resolvidos por T003 em 2026-08-09**, junto com os dezesseis da §1 — dezoito ao
todo. Ambos existem em `react-icons/lu`.

A analogia adotada MUST ser registrada no guia de estilo (FR-064).

---

## 3. Regras de consumo

1. **Papel, nunca componente.** Uma superfície pede `advance`; nunca importa o componente da biblioteca (FR-059, SC-016).
2. **Cor vem do contexto.** O ícone herda `currentColor`; nunca fixa a própria cor (FR-051, SC-017).
3. **Tamanho acompanha o tipo do contexto**, pela escala de tipografia — não por medida avulsa (FR-051).
4. **Semântica**: decorativo quando acompanha rótulo textual; nome acessível próprio quando é o único conteúdo de um controle (FR-058).
5. **Ícone nunca é o único portador de um estado** (FR-042). O selo "confiante" tem `gem` **e** rótulo **e** fundo tingido **e** contorno.
6. **Importação por subcaminho de conjunto.** Importar do índice raiz puxa a árvore inteira sem emitir aviso (FR-056).
7. **Os PNGs de ícone de interface foram removidos do repositório** em 2026-08-09, o que satisfaz FR-060 na origem em vez de por denylist — remover o perigo vence guardá-lo. O que permanece em `src/assets/imgs/` é arte: os onze adesivos, a fotografia e a marca.

---

## 4. O que os testes garantem

| Teste | Garante |
| --- | --- |
| `tests/unit/icon-roles.spec.ts` | Todo papel resolve para um componente definido; nenhum papel órfão; nenhum componente sem papel |
| Varredura de importação | Nenhum arquivo fora de `src/ui/icons.ts` importa de `react-icons` (SC-016) |
| Varredura de importação | Nenhuma importação do índice raiz da biblioteca (FR-056) |
| Asserção estrutural | Ícone renderizado herda a cor do contexto nos dois temas (SC-017) |
| Medição de pacote | O acréscimo corresponde aos ícones usados, não ao conjunto (SC-018) — ver §5 |

---

## 5. Medição de pacote (SC-018)

| Momento | Tamanho do pacote | Delta | Data |
| --- | --- | --- | --- |
| Antes de `react-icons` | JS 357,79 kB (gzip 107,57 kB) · CSS 26,34 kB (gzip 5,84 kB) | — | 2026-08-09 |
| Depois, com os dezesseis ícones | _a preencher (T085)_ | | |

Medido com `rm -rf dist && npm run build`, contando os artefatos de
`dist/assets/` — o `.map` não entra, porque não é transferido ao navegador.

O acréscimo deve corresponder aos ícones efetivamente usados, não ao conjunto. A
marca não entra na conta: ela é arte local e já estava versionada.
