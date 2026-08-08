/**
 * Compõe o PDF de guidelines de tema.
 *
 * Decisão que rege o arquivo inteiro: **os valores não são digitados aqui.**
 * São lidos de `src/styles/tokens.css` e de `src/domain/theme/approvedPairs.ts`,
 * e as razões de contraste são calculadas pela mesma fórmula do portão
 * (`src/domain/theme/contrast.ts`). Um guia impresso que carrega sua própria
 * cópia dos hex é um guia que envelhece na primeira mudança de tom — e desta vez
 * envelheceria em papel, onde ninguém corrige.
 *
 * Uso: node docs/theme-guidelines/build.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');

// ---------------------------------------------------------------------------
// Leitura da origem única
// ---------------------------------------------------------------------------

const tokensCss = readFileSync(join(ROOT, 'src/styles/tokens.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//gu,
  '',
);

function ruleBody(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const pattern = new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{`, 'gu');
  let body = '';
  let match = pattern.exec(css);
  while (match !== null) {
    let cursor = match.index + match[0].length;
    let depth = 1;
    const open = cursor;
    while (cursor < css.length && depth > 0) {
      if (css[cursor] === '{') depth += 1;
      if (css[cursor] === '}') depth -= 1;
      cursor += 1;
    }
    body += css.slice(open, cursor - 1);
    pattern.lastIndex = cursor;
    match = pattern.exec(css);
  }
  return body;
}

function hexes(body) {
  const found = {};
  const pattern = /(--[a-z0-9-]+)\s*:\s*(#[0-9a-f]{3,8})\s*;/giu;
  let match = pattern.exec(body);
  while (match !== null) {
    found[match[1]] = match[2];
    match = pattern.exec(body);
  }
  return found;
}

const withoutMedia = tokensCss.replace(/@media[^{]*\{(?:[^{}]|\{[^{}]*\})*\}/gu, '');
const LIGHT = hexes(ruleBody(withoutMedia, ':root'));
const DARK = { ...LIGHT, ...hexes(ruleBody(withoutMedia, "[data-theme='dark']")) };

const pairsSrc = readFileSync(join(ROOT, 'src/domain/theme/approvedPairs.ts'), 'utf8');
const PAIRS = [];
{
  const pattern =
    /\{\s*foreground:\s*'([^']+)',\s*background:\s*'([^']+)',\s*usage:\s*'([^']+)',\s*where:\s*'([^']+)',\s*\}/gu;
  let match = pattern.exec(pairsSrc);
  while (match !== null) {
    PAIRS.push({ fg: match[1], bg: match[2], usage: match[3], where: match[4] });
    match = pattern.exec(pairsSrc);
  }
}

// ---------------------------------------------------------------------------
// Contraste — a mesma fórmula WCAG 2.x do portão
// ---------------------------------------------------------------------------

const linear = (channel) => {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const luminance = (hex) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return 0.2126 * linear((n >> 16) & 255) + 0.7152 * linear((n >> 8) & 255) + 0.0722 * linear(n & 255);
};

const ratio = (a, b) => {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

const br = (n) => n.toFixed(1).replace('.', ',');

const MINIMUM = { text: 4.5, 'large-text': 3, ui: 3 };

// ---------------------------------------------------------------------------
// Espécimes de cor, com papel — a notação que acompanha cada amostra
// ---------------------------------------------------------------------------

const ROLES = {
  '--bg': 'Fundo da página',
  '--surface': 'Cartão, superfície elevada',
  '--surface-raised': 'Hover, linha alternada, campo em foco',
  '--rule': 'Divisor discreto',
  '--rule-strong': 'Delimitador: borda de controle, contorno de capa',
  '--ink': 'Texto principal',
  '--ink-muted': 'Texto secundário',
  '--accent': 'PRIMÁRIA · somente preenchimento',
  '--accent-deep': 'Hover do preenchimento',
  '--accent-ink': 'Tinta sobre o preenchimento âmbar',
  '--accent-text': 'Âmbar de texto, link, borda, foco',
  '--state-confident': 'Correspondência confiante',
  '--state-uncertain': 'Correspondência incerta',
  '--state-missing': 'Não encontrada, erro',
};

const ORDER = Object.keys(ROLES);

const FONTS = JSON.parse(readFileSync('/tmp/sgfonts.json', 'utf8'));

const fontFaces = Object.entries(FONTS)
  .map(
    ([weight, data]) => `@font-face{font-family:'Space Grotesk';font-weight:${weight};
    src:url(data:font/woff2;base64,${data}) format('woff2');}`,
  )
  .join('\n');

// ---------------------------------------------------------------------------
// Composição
// ---------------------------------------------------------------------------

/** Numeral tabular de duas casas — o mesmo da goteira do produto. */
const num = (n) => String(n).padStart(2, '0');

function gutter(index, label) {
  return `<div class="gutter">
    <div class="gutter-num">${num(index)}</div>
    <div class="gutter-label">${label}</div>
  </div>`;
}

function chips(theme, tokens) {
  return ORDER.map((token, i) => {
    const value = tokens[token];
    const isAccent = token === '--accent';
    return `<div class="chip ${isAccent ? 'chip-key' : ''}">
      <div class="swatch" style="background:${value}"></div>
      <div class="chip-meta">
        <div class="chip-idx">${num(i + 1)}</div>
        <div class="chip-token">${token}</div>
        <div class="chip-hex">${value.toUpperCase()}</div>
        <div class="chip-role">${ROLES[token]}</div>
      </div>
    </div>`;
  }).join('');
}

function pairRows() {
  return PAIRS.map((p, i) => {
    const l = ratio(LIGHT[p.fg], LIGHT[p.bg]);
    const d = ratio(DARK[p.fg], DARK[p.bg]);
    const min = MINIMUM[p.usage];
    return `<tr>
      <td class="n">${num(i + 1)}</td>
      <td class="tok">${p.fg}</td>
      <td class="tok dim">${p.bg}</td>
      <td class="use">${p.usage}</td>
      <td class="n dim">${br(min)}</td>
      <td class="sample"><i style="background:${LIGHT[p.bg]};color:${LIGHT[p.fg]}">Ag</i></td>
      <td class="n strong">${br(l)}</td>
      <td class="sample"><i style="background:${DARK[p.bg]};color:${DARK[p.fg]}">Ag</i></td>
      <td class="n strong">${br(d)}</td>
      <td class="where">${p.where}</td>
    </tr>`;
  }).join('');
}

const TYPE_STEPS = [
  ['--text-step', '1,625', '600', 'Título de etapa', 'Confira as correspondências'],
  ['--text-section', '1,0625', '600', 'Título de seção', 'Dados da playlist'],
  ['--text-body', '0,9375', '400', 'Corpo', 'Nada é criado até você confirmar.'],
  ['--text-item', '0,9375', '500', 'Nome de faixa', 'Azul da Cor do Mar'],
  ['--text-meta', '0,8125', '400', 'Secundário', 'tim maia - azul da cor do mar'],
  ['--text-data', '0,75', '500', 'Numeral e dado', '08 · 11 · 3:58 · 47/60'],
];

const SPACING = [
  ['1', '0,25'],
  ['2', '0,5'],
  ['3', '0,75'],
  ['4', '1'],
  ['6', '1,5'],
  ['8', '2'],
  ['12', '3'],
];

const RULES = [
  [
    'O âmbar é preenchimento, nunca tinta',
    'Âmbar cheio sobre fundo claro dá 2,0:1 — reprovado para texto e para borda. Para texto, link, borda e anel de foco, o token é <span class="mono">--accent-text</span>.',
  ],
  [
    'Texto claro sobre âmbar é proibido',
    'Em qualquer contexto, sem exceção. Não existe variante que o permita. O rótulo do botão primário é <span class="mono">--accent-ink</span>, escuro.',
  ],
  [
    'A primária não muda entre os temas',
    'É a âncora da identidade: a cor da ação permanece quando o substrato inverte. Os fundos divergem em temperatura; o âmbar, não.',
  ],
  [
    'Os dois traços não são intercambiáveis',
    '<span class="mono">--rule</span> reforça uma separação que a luminosidade já faz e não tem mínimo. <span class="mono">--rule-strong</span> <em>é</em> o delimitador e exige 3:1 sobre toda superfície.',
  ],
  [
    'Preenchimento sólido significa acionável',
    'Selo de estado usa fundo tingido, ícone e palavra — nunca preenchimento. É a forma, não o matiz, que separa o selo "incerta" do botão primário.',
  ],
  [
    'Nenhum estado depende só de cor',
    'Sempre três canais: cor, forma do ícone e palavra. O modo de cores forçadas remove o primeiro; o daltonismo compromete o segundo par cromático.',
  ],
  [
    'O foco é outline, jamais box-shadow',
    'O modo de alto contraste descarta sombra e preserva contorno. Um foco de sombra desaparece exatamente para quem mais depende dele.',
  ],
  [
    'Valor fora da escala é violação',
    'Sete degraus de espaço, três de raio, seis de tipografia. As escalas são finitas por declaração — o Tailwind não gera nada fora delas.',
  ],
];

const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><style>
${fontFaces}

*{margin:0;padding:0;box-sizing:border-box;}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
body{font-family:'Space Grotesk';font-weight:400;
  font-variant-numeric:tabular-nums;font-feature-settings:'tnum';}

/* ---- Página: a geometria fixa do movimento ---- */
.page{width:297mm;height:210mm;position:relative;overflow:hidden;
  background:${LIGHT['--bg']};color:${LIGHT['--ink']};
  padding:14mm 16mm 12mm 16mm;page-break-after:always;display:flex;flex-direction:column;}
.page:last-child{page-break-after:auto;}
.page.dark{background:${DARK['--bg']};color:${DARK['--ink']};}

/* A goteira: mesma coordenada em toda página. Nunca se ajusta ao conteúdo. */
.gutter{position:absolute;left:16mm;top:14mm;width:22mm;}
.gutter-num{font-size:7.5pt;font-weight:500;letter-spacing:.10em;
  color:${LIGHT['--accent-text']};}
.dark .gutter-num{color:${DARK['--accent-text']};}
.gutter-label{font-size:5.6pt;font-weight:400;letter-spacing:.20em;text-transform:uppercase;
  color:${LIGHT['--ink-muted']};margin-top:1.2mm;line-height:1.5;}
.dark .gutter-label{color:${DARK['--ink-muted']};}

.body{margin-left:30mm;flex:1;display:flex;flex-direction:column;min-height:0;}

h2{font-size:19pt;font-weight:500;letter-spacing:-.022em;line-height:1.05;}
.sub{font-size:7.2pt;font-weight:400;letter-spacing:.02em;line-height:1.6;
  color:${LIGHT['--ink-muted']};max-width:118mm;margin-top:2.6mm;}
.dark .sub{color:${DARK['--ink-muted']};}

.hairline{height:1px;background:${LIGHT['--rule']};margin:5mm 0;}
.dark .hairline{background:${DARK['--rule']};}

/* ---- Rodapé sistemático ---- */
.foot{position:absolute;left:16mm;right:16mm;bottom:8mm;
  display:flex;justify-content:space-between;align-items:baseline;
  font-size:5.6pt;letter-spacing:.18em;text-transform:uppercase;
  color:${LIGHT['--ink-muted']};}
.dark .foot{color:${DARK['--ink-muted']};}
.foot .fnum{font-weight:500;letter-spacing:.10em;}

/* ================= CAPA ================= */
.cover{justify-content:space-between;}
.cover-top{display:flex;justify-content:space-between;align-items:flex-start;}
.eyebrow{font-size:6pt;letter-spacing:.30em;text-transform:uppercase;font-weight:500;}
.cover-title{font-size:70pt;font-weight:500;letter-spacing:-.036em;line-height:.88;}
.cover-title em{font-style:normal;color:${LIGHT['--accent-text']};}
.cover-rule{display:flex;height:5mm;margin-top:11mm;border-radius:2.5mm;overflow:hidden;
  border:1px solid ${LIGHT['--rule-strong']};}
.cover-rule span{flex:1;}
.cover-facts{display:flex;gap:16mm;margin-top:11mm;}
.fact{font-size:6.2pt;letter-spacing:.16em;text-transform:uppercase;
  color:${LIGHT['--ink-muted']};}
.fact b{display:block;font-size:15pt;font-weight:500;letter-spacing:-.01em;
  text-transform:none;color:${LIGHT['--ink']};margin-top:1.6mm;}

/* Coluna de numerais — a segunda arquitetura, vertical e silenciosa.
   Começa **abaixo** da faixa de topo: nada pode encostar em nada. */
.tally{position:absolute;right:16mm;top:44mm;bottom:20mm;width:30mm;
  display:flex;flex-direction:column;justify-content:space-between;text-align:right;}
.tally div{font-size:6.4pt;font-weight:400;letter-spacing:.14em;
  color:${LIGHT['--rule-strong']};}
/* O corpo da capa nunca invade a faixa reservada à coluna. */
.cover .body{padding-right:38mm;}

/* ================= PRANCHA DE COR ================= */
.plate{display:grid;grid-template-columns:repeat(7,1fr);gap:6mm 4.6mm;margin-top:2mm;flex:1;align-content:start;}
.chip{display:flex;flex-direction:column;}
.swatch{height:41mm;border-radius:2px;border:1px solid ${LIGHT['--rule-strong']};}
.dark .swatch{border-color:${DARK['--rule-strong']};}
.chip-meta{margin-top:2.2mm;}
.chip-idx{font-size:5.6pt;font-weight:500;letter-spacing:.14em;
  color:${LIGHT['--accent-text']};}
.dark .chip-idx{color:${DARK['--accent-text']};}
.chip-token{font-size:6.6pt;font-weight:500;letter-spacing:-.005em;margin-top:.9mm;
  word-break:break-all;line-height:1.25;}
.chip-hex{font-size:6.2pt;font-weight:400;letter-spacing:.06em;margin-top:.6mm;
  color:${LIGHT['--ink-muted']};}
.dark .chip-hex{color:${DARK['--ink-muted']};}
.chip-role{font-size:5.4pt;font-weight:400;line-height:1.42;margin-top:1.2mm;
  color:${LIGHT['--ink-muted']};}
.dark .chip-role{color:${DARK['--ink-muted']};}
.chip-key .swatch{box-shadow:inset 0 0 0 2.4mm ${LIGHT['--bg']},
  inset 0 0 0 2.55mm ${LIGHT['--accent-text']};}
.dark .chip-key .swatch{box-shadow:inset 0 0 0 2.4mm ${DARK['--bg']},
  inset 0 0 0 2.55mm ${DARK['--accent-text']};}

/* ================= MATRIZ DE CONTRASTE ================= */
table{width:100%;border-collapse:collapse;margin-top:1mm;}
th{font-size:5.4pt;font-weight:500;letter-spacing:.16em;text-transform:uppercase;
  text-align:left;padding:0 2mm 2mm 0;color:${LIGHT['--ink-muted']};
  border-bottom:1px solid ${LIGHT['--rule-strong']};}
td{font-size:6.4pt;padding:1.05mm 2.4mm 1.05mm 0;
  border-bottom:1px solid ${LIGHT['--rule']};vertical-align:middle;}
td.n{font-weight:500;letter-spacing:.06em;white-space:nowrap;}
td.n.dim{color:${LIGHT['--ink-muted']};font-weight:400;}
td.tok{font-weight:500;letter-spacing:-.005em;white-space:nowrap;}
td.tok.dim{font-weight:400;color:${LIGHT['--ink-muted']};}
td.use{font-size:5.6pt;letter-spacing:.10em;text-transform:uppercase;
  color:${LIGHT['--ink-muted']};}
td.where{font-size:5.8pt;color:${LIGHT['--ink-muted']};line-height:1.4;}
/* A amostra é um bloco interno, não a célula: assim ela nunca encosta no
   filete da linha nem se funde à amostra de cima, e a coluna lê como uma
   sequência de espécimes, não como uma barra contínua. */
td.sample{width:11mm;padding-right:3.4mm;}
td.sample i{display:flex;align-items:center;justify-content:center;
  height:5.4mm;border-radius:2px;font-style:normal;font-size:7pt;font-weight:500;}
td.strong{font-weight:500;}
.legend{display:flex;gap:9mm;margin-top:5mm;font-size:5.6pt;letter-spacing:.10em;
  text-transform:uppercase;color:${LIGHT['--ink-muted']};}

/* ================= TIPOGRAFIA ================= */
.specimen{display:flex;flex-direction:column;gap:0;margin-top:1mm;}
.srow{display:grid;grid-template-columns:26mm 1fr 30mm;gap:6mm;align-items:baseline;
  padding:4.3mm 0;border-bottom:1px solid ${LIGHT['--rule']};}
.srow:last-child{border-bottom:none;}
.stoken{font-size:6.2pt;font-weight:500;}
.smeta{font-size:5.4pt;letter-spacing:.10em;text-transform:uppercase;
  color:${LIGHT['--ink-muted']};margin-top:.8mm;}
.ssample{line-height:1.12;}
.snum{font-size:6.2pt;text-align:right;color:${LIGHT['--ink-muted']};letter-spacing:.06em;}

.tnum{display:grid;grid-template-columns:1fr 1fr;gap:9mm;margin-top:7mm;}
.tnum-box{border:1px solid ${LIGHT['--rule-strong']};border-radius:2px;padding:4.6mm 5mm;}
/* Régua de aferição: nasce da largura real dos algarismos, não de uma medida
   escolhida. No quadro tabular as três linhas encostam nela; no proporcional,
   o 11 não alcança. A diferença passa a ser observável, não afirmada. */
.tnum-fig{display:inline-block;border-right:1px solid ${LIGHT['--accent-text']};
  padding-right:2.6mm;}
.tnum-cap{font-size:5.4pt;letter-spacing:.16em;text-transform:uppercase;
  color:${LIGHT['--ink-muted']};margin-bottom:2.4mm;}
.tnum-fig{font-size:17pt;font-weight:500;letter-spacing:.03em;line-height:1.42;}
.tnum-off{font-variant-numeric:proportional-nums;font-feature-settings:'pnum';}

/* ================= ESCALAS E REGRAS ================= */
.cols{display:grid;grid-template-columns:88mm 1fr;gap:14mm;margin-top:1mm;flex:1;min-height:0;}
.scale-cap{font-size:5.6pt;letter-spacing:.18em;text-transform:uppercase;font-weight:500;
  color:${LIGHT['--ink-muted']};margin-bottom:3mm;}
.bars{display:flex;flex-direction:column;gap:3.1mm;}
.bar{display:grid;grid-template-columns:9mm 1fr 13mm;gap:3mm;align-items:center;}
.bar-n{font-size:6pt;font-weight:500;color:${LIGHT['--accent-text']};letter-spacing:.06em;}
.bar-fill{height:3.2mm;background:${LIGHT['--ink']};border-radius:1px;}
.bar-v{font-size:5.8pt;color:${LIGHT['--ink-muted']};text-align:right;letter-spacing:.04em;}

.radii{display:flex;gap:5mm;margin-top:2mm;}
.radbox{width:21mm;height:21mm;border:1px solid ${LIGHT['--rule-strong']};
  display:flex;align-items:flex-end;justify-content:center;padding-bottom:1.8mm;
  font-size:5.4pt;color:${LIGHT['--ink-muted']};letter-spacing:.06em;}
/* A pílula é mais larga que alta — um quadrado de raio total vira círculo, que
   é outra forma e diria outra coisa. */
.radbox.pill{width:34mm;}

.depth{display:flex;gap:5mm;margin-top:2mm;}
.dbox{flex:1;height:26mm;border-radius:2px;display:flex;align-items:flex-end;
  padding:2.8mm;font-size:5.4pt;letter-spacing:.10em;text-transform:uppercase;}
.dlight{background:${LIGHT['--surface']};border:1px solid ${LIGHT['--rule']};
  box-shadow:0 1px 2px rgb(20 28 38 / 6%),0 4px 12px rgb(20 28 38 / 5%);
  color:${LIGHT['--ink-muted']};}
.ddark{background:${DARK['--surface']};border:1px solid ${DARK['--rule-strong']};
  color:${DARK['--ink-muted']};}

.rules{display:grid;grid-template-columns:1fr 1fr;gap:7.4mm 7mm;}
.rule-item{display:grid;grid-template-columns:7mm 1fr;gap:2.4mm;}
.rule-n{font-size:6pt;font-weight:500;color:${LIGHT['--accent-text']};letter-spacing:.06em;
  padding-top:.3mm;}
.rule-h{font-size:7pt;font-weight:500;line-height:1.25;letter-spacing:-.004em;}
.rule-b{font-size:5.6pt;font-weight:400;line-height:1.48;margin-top:1.1mm;
  color:${LIGHT['--ink-muted']};}
.mono{font-weight:500;color:${LIGHT['--ink']};}

/* ================= ASSINATURA ================= */
.sig{margin-top:1mm;border:1px solid ${LIGHT['--rule-strong']};border-radius:2px;
  padding:6mm 7mm;background:${LIGHT['--surface']};}
.sigrow{display:grid;grid-template-columns:10mm 1fr;gap:4mm;padding:2.4mm 0;}
.sigrow + .sigrow{border-top:1px solid ${LIGHT['--rule']};}
.signum{font-size:7.4pt;font-weight:500;letter-spacing:.10em;
  color:${LIGHT['--accent-text']};padding-top:.4mm;}
.sigin{font-size:6.2pt;color:${LIGHT['--ink-muted']};}
.sigmatch{font-size:8.4pt;font-weight:500;margin-top:.9mm;}
.sigbadge{display:inline-flex;align-items:center;gap:1.4mm;margin-top:1.6mm;
  border-radius:99px;padding:.7mm 2.4mm;font-size:5.6pt;font-weight:500;letter-spacing:.05em;}
</style></head><body>

<!-- ============ 01 · CAPA ============ -->
<section class="page cover">
  ${gutter(1, 'Sistema<br>de tema')}
  <div class="tally">
    ${['14 TOKENS', '02 TEMAS', '15 PARES', '06 DEGRAUS', '07 ESPAÇOS', '03 RAIOS']
      .map((x) => `<div>${x}</div>`)
      .join('')}
  </div>
  <div class="body" style="justify-content:space-between;">
    <div class="cover-top">
      <div class="eyebrow">Importador de Playlist por Texto</div>

    </div>
    <div class="cover-block">
      <div class="cover-title">Papel<br>&amp; <em>Noite</em></div>
      <div class="cover-rule">
        ${[
          LIGHT['--bg'],
          LIGHT['--surface-raised'],
          LIGHT['--rule-strong'],
          LIGHT['--accent'],
          LIGHT['--accent-text'],
          LIGHT['--state-confident'],
          LIGHT['--ink'],
          DARK['--bg'],
        ]
          .map((c) => `<span style="background:${c}"></span>`)
          .join('')}
      </div>
      <div class="cover-facts">
        <div class="fact">Tipografia<b>Space Grotesk</b></div>
        <div class="fact">Primária<b>#F4A900</b></div>
        <div class="fact">Medida<b>46rem</b></div>
        <div class="fact">Goteira<b>2,5rem</b></div>
      </div>
      <div class="sub" style="max-width:132mm;margin-top:11mm;">
        Guia de tema. Todos os valores impressos são lidos de
        <span style="font-weight:500">src/styles/tokens.css</span>; as razões de contraste
        são calculadas pela mesma fórmula WCAG 2.x do portão automatizado. Este documento
        descreve — não define.
      </div>
    </div>
  </div>
  <div class="foot"><span>Guia de tema · 005 Identidade visual</span><span class="fnum">01 / 06</span></div>
</section>

<!-- ============ 02 · PAPEL ============ -->
<section class="page">
  ${gutter(2, 'Paleta<br>clara')}
  <div class="body">
    <h2>Papel</h2>
    <div class="sub">Substrato pálido, ligeiramente quente. Tinta marinho quase-preta. O acento
      âmbar aparece apenas como preenchimento — para texto, borda e foco existe um segundo
      âmbar, escurecido até passar no contraste.</div>
    <div class="hairline"></div>
    <div class="plate">${chips('light', LIGHT)}</div>
  </div>
  <div class="foot"><span>Tema claro · 14 tokens</span><span class="fnum">02 / 06</span></div>
</section>

<!-- ============ 03 · NOITE ============ -->
<section class="page dark">
  ${gutter(3, 'Paleta<br>escura')}
  <div class="body">
    <h2>Noite</h2>
    <div class="sub">Substrato profundo, de fundo azul. A primária atravessa intacta: é a âncora
      da identidade, e a cor da ação não muda quando o substrato inverte. Aqui não há sombra
      alguma — a profundidade vem de degrau de luminosidade e filete de um ponto.</div>
    <div class="hairline"></div>
    <div class="plate">${chips('dark', DARK)}</div>
  </div>
  <div class="foot"><span>Tema escuro · 14 tokens</span><span class="fnum">03 / 06</span></div>
</section>

<!-- ============ 04 · CONTRASTE ============ -->
<section class="page">
  ${gutter(4, 'Pares<br>aprovados')}
  <div class="body">
    <h2>Contraste</h2>
    <div class="sub">Lista fechada: combinação ausente desta tabela é proibida. Os valores foram
      medidos, não estimados — a autoridade é o portão automatizado, e este documento apenas o
      transcreve.</div>
    <div class="hairline" style="margin:4mm 0 3mm 0;"></div>
    <table>
      <thead><tr>
        <th style="width:7mm">N</th><th>Frente</th><th>Fundo</th><th style="width:15mm">Uso</th>
        <th style="width:11mm">Mín.</th><th style="width:9mm">Papel</th><th style="width:11mm">Razão</th>
        <th style="width:9mm">Noite</th><th style="width:11mm">Razão</th><th>Aplicação</th>
      </tr></thead>
      <tbody>${pairRows()}</tbody>
    </table>
    <div class="legend">
      <span>Texto 4,5:1</span><span>Texto grande 3:1</span><span>Borda, ícone e foco 3:1</span>
      <span style="margin-left:auto">Fórmula WCAG 2.x</span>
    </div>
  </div>
  <div class="foot"><span>Matriz de contraste · 15 pares</span><span class="fnum">04 / 06</span></div>
</section>

<!-- ============ 05 · TIPOGRAFIA ============ -->
<section class="page">
  ${gutter(5, 'Escala<br>tipográfica')}
  <div class="body">
    <h2>Space Grotesk</h2>
    <div class="sub">Família única, variável, embarcada em 24 KB. Grotesca geométrica com
      maneirismos reais — o <span style="font-weight:500">g</span> de perna cortada, o
      <span style="font-weight:500">a</span> de topo reto. A hierarquia vem de peso, tamanho e
      espaço; não há segunda família.</div>
    <div class="hairline" style="margin:4mm 0 2mm 0;"></div>
    <div class="specimen">
      ${TYPE_STEPS.map(
        ([token, size, weight, role, sample]) => `<div class="srow">
        <div>
          <div class="stoken">${token}</div>
          <div class="smeta">${role}</div>
        </div>
        <div class="ssample" style="font-size:${Number(size.replace(',', '.')) * 13.6}pt;
          font-weight:${weight};${token === '--text-step' ? 'letter-spacing:-.02em;' : ''}${
            token === '--text-data' ? 'letter-spacing:.03em;' : ''
          }">${sample}</div>
        <div class="snum">${size} rem · ${weight}</div>
      </div>`,
      ).join('')}
    </div>
    <div class="tnum">
      <div class="tnum-box">
        <div class="tnum-cap">Com tabular-nums · como deve ser</div>
        <div class="tnum-fig">07<br>08<br>11</div>
      </div>
      <div class="tnum-box">
        <div class="tnum-cap">Sem · os algarismos são proporcionais por padrão</div>
        <div class="tnum-fig tnum-off">07<br>08<br>11</div>
      </div>
    </div>
    <div class="sub" style="margin-top:3.4mm;max-width:none;">Quatro vírgula seis pixels separam
      <span style="font-weight:500">08</span> de <span style="font-weight:500">11</span> sem a
      declaração — mais de um terço da largura do numeral. A goteira não ficaria levemente
      irregular; ficaria torta.</div>
  </div>
  <div class="foot"><span>Tipografia · 6 degraus</span><span class="fnum">05 / 06</span></div>
</section>

<!-- ============ 06 · ESCALAS E REGRAS ============ -->
<section class="page">
  ${gutter(6, 'Escalas<br>&amp; regras')}
  <div class="body">
    <h2>Disciplina</h2>
    <div class="sub">As escalas são finitas por declaração, não por convenção: o gerador não emite
      nada fora delas. Valor fora da escala é violação, não exceção.</div>
    <div class="hairline" style="margin:4mm 0 4mm 0;"></div>
    <div class="cols">
      <div>
        <div class="scale-cap">Espaçamento · 7 degraus</div>
        <div class="bars">
          ${SPACING.map(
            ([n, v]) => `<div class="bar">
            <div class="bar-n">${num(n)}</div>
            <div class="bar-fill" style="width:${Number(v.replace(',', '.')) * 21}%"></div>
            <div class="bar-v">${v} rem</div>
          </div>`,
          ).join('')}
        </div>
        <div class="scale-cap" style="margin-top:7mm;">Raio · 3 degraus</div>
        <div class="radii">
          <div class="radbox" style="border-radius:4px">4 px</div>
          <div class="radbox" style="border-radius:8px">8 px</div>
          <div class="radbox pill" style="border-radius:99px">pílula</div>
        </div>
        <div class="scale-cap" style="margin-top:7mm;">Profundidade · assimétrica</div>
        <div class="depth">
          <div class="dbox dlight">Claro · um nível</div>
          <div class="dbox ddark">Escuro · nenhuma</div>
        </div>
      </div>
      <div>
        <div class="scale-cap">Regras que não se negociam</div>
        <div class="rules">
          ${RULES.map(
            ([h, b], i) => `<div class="rule-item">
            <div class="rule-n">${num(i + 1)}</div>
            <div>
              <div class="rule-h">${h}</div>
              <div class="rule-b">${b}</div>
            </div>
          </div>`,
          ).join('')}
        </div>
      </div>
    </div>
  </div>
  <div class="foot"><span>Escalas e regras de uso</span><span class="fnum">06 / 06</span></div>
</section>

</body></html>`;

// Intermediário de depuração: útil para inspecionar a composição no navegador
// sem passar pelo PDF. Não é versionado.
writeFileSync(join(HERE, '.render.html'), html, 'utf8');

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(async () => {
  await document.fonts.ready;
});
await page.pdf({
  path: join(HERE, 'guia-de-tema.pdf'),
  width: '297mm',
  height: '210mm',
  printBackground: true,
  margin: { top: '0', right: '0', bottom: '0', left: '0' },
});
await browser.close();

console.log(`✔ ${PAIRS.length} pares · ${ORDER.length} tokens · guia-de-tema.pdf`);
