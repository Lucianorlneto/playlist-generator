import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  APPROVED_PAIR_COUNT,
  APPROVED_PAIRS,
  COLOR_TOKENS,
  DERIVED_TOKENS,
  THEMES,
  type DerivedTokenName,
  type ThemeName,
  type TokenName,
} from '@/domain/theme/approvedPairs';
import { CONTRAST_MINIMUM, contrastRatio, roundRatio } from '@/domain/theme/contrast';

/**
 * Portão de contraste — FR-003, SC-002, SC-005.
 *
 * A autoridade sobre os números é **este teste**, não a tabela de
 * `contracts/tokens.md` §2 nem o guia de estilo: os dois descrevem o que o
 * cálculo produz. Divergência se resolve corrigindo o documento.
 *
 * Os valores são lidos de `src/styles/tokens.css`, a origem única. Nenhum hex é
 * repetido neste arquivo — um teste que carrega sua própria cópia dos valores
 * mede a si mesmo e passa mesmo depois de o produto mudar de cor.
 *
 * O teste falha por par **reprovado ou ausente**: a lista é fechada, e omissão
 * não passa como aprovação.
 */

const TOKENS_CSS = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf8');

/**
 * Remove comentários antes de qualquer varredura.
 *
 * `tokens.css` é fortemente comentado, e sem esta limpeza o corpo do comentário
 * fica entre `}` e o seletor seguinte, quebrando o reconhecimento de regra.
 */
function withoutComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//gu, '');
}

/** Remove os blocos `@media`, para que o parser veja só as regras de topo. */
function withoutMediaBlocks(css: string): string {
  let out = '';
  let index = 0;
  while (index < css.length) {
    const start = css.indexOf('@media', index);
    if (start === -1) {
      out += css.slice(index);
      break;
    }
    out += css.slice(index, start);
    // Avança até a chave de abertura e depois até a que a fecha.
    let cursor = css.indexOf('{', start);
    let depth = 1;
    cursor += 1;
    while (cursor < css.length && depth > 0) {
      if (css[cursor] === '{') depth += 1;
      if (css[cursor] === '}') depth -= 1;
      cursor += 1;
    }
    index = cursor;
  }
  return out;
}

/** Corpo de todas as regras cujo seletor é exatamente `selector`. */
function bodiesOf(css: string, selector: string): string[] {
  const bodies: string[] = [];
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const pattern = new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{`, 'gu');
  let match = pattern.exec(css);
  while (match !== null) {
    const open = match.index + match[0].length;
    let depth = 1;
    let cursor = open;
    while (cursor < css.length && depth > 0) {
      if (css[cursor] === '{') depth += 1;
      if (css[cursor] === '}') depth -= 1;
      cursor += 1;
    }
    bodies.push(css.slice(open, cursor - 1));
    pattern.lastIndex = cursor;
    match = pattern.exec(css);
  }
  return bodies;
}

/** Declarações `--nome: #hex;` de um corpo de regra. */
function hexDeclarations(body: string): Map<string, string> {
  const found = new Map<string, string>();
  const pattern = /(--[a-z0-9-]+)\s*:\s*(#[0-9a-f]{3,8})\s*;/giu;
  let match = pattern.exec(body);
  while (match !== null) {
    const [, name, value] = match;
    if (name !== undefined && value !== undefined) found.set(name, value);
    match = pattern.exec(body);
  }
  return found;
}

/** Declarações `--nome: N%;` de um corpo de regra — as proporções de mistura. */
function percentDeclarations(body: string): Map<string, number> {
  const found = new Map<string, number>();
  const pattern = /(--[a-z0-9-]+)\s*:\s*(\d+(?:\.\d+)?)%\s*;/giu;
  let match = pattern.exec(body);
  while (match !== null) {
    const [, name, value] = match;
    if (name !== undefined && value !== undefined) found.set(name, Number(value) / 100);
    match = pattern.exec(body);
  }
  return found;
}

const CLEAN_CSS = withoutComments(TOKENS_CSS);
const topLevel = withoutMediaBlocks(CLEAN_CSS);

const lightTokens = new Map<string, string>();
const lightAmounts = new Map<string, number>();
for (const body of bodiesOf(topLevel, ':root')) {
  for (const [name, value] of hexDeclarations(body)) lightTokens.set(name, value);
  for (const [name, value] of percentDeclarations(body)) lightAmounts.set(name, value);
}

/** O tema escuro herda o claro e sobrescreve — como no navegador. */
const darkTokens = new Map(lightTokens);
const darkAmounts = new Map(lightAmounts);
for (const body of bodiesOf(topLevel, "[data-theme='dark']")) {
  for (const [name, value] of hexDeclarations(body)) darkTokens.set(name, value);
  for (const [name, value] of percentDeclarations(body)) darkAmounts.set(name, value);
}

const byTheme: Record<ThemeName, Map<string, string>> = {
  light: lightTokens,
  dark: darkTokens,
};

const amountsByTheme: Record<ThemeName, Map<string, number>> = {
  light: lightAmounts,
  dark: darkAmounts,
};

function declared(token: TokenName, theme: ThemeName): string {
  const value = byTheme[theme].get(token);
  if (value === undefined) {
    throw new Error(
      `Token ${token} não está definido no tema ${theme} em src/styles/tokens.css. ` +
        'Todo token de cor existe nos dois temas; definição parcial é erro (contracts/tokens.md §6).',
    );
  }
  return value;
}

/** `#rgb`, `#rrggbb` → os três canais em 0..255. */
function channels(hex: string): [number, number, number] {
  const normalizado =
    hex.length === 4
      ? `#${hex[1] ?? ''}${hex[1] ?? ''}${hex[2] ?? ''}${hex[2] ?? ''}${hex[3] ?? ''}${hex[3] ?? ''}`
      : hex;
  return [
    Number.parseInt(normalizado.slice(1, 3), 16),
    Number.parseInt(normalizado.slice(3, 5), 16),
    Number.parseInt(normalizado.slice(5, 7), 16),
  ];
}

/**
 * `color-mix(in srgb, frente P, substrato)` reproduzido em TypeScript
 * (008/FR-003, 008/contracts/tokens.md §2).
 *
 * Existe porque os dois substratos de identidade **não são hex**: são derivados,
 * e o navegador é quem os resolveria. Medi-los exige refazer a conta aqui — e o
 * cálculo em sRGB é aritmética determinística, muito mais barato que abrir um
 * navegador dentro de um teste de unidade (008/research §R4).
 *
 * **Nenhum valor é digitado duas vezes**: a receita de cada derivado vive em
 * `DERIVED_TOKENS`, e os três ingredientes — a cor da marca, a proporção e o
 * substrato — são lidos de `tokens.css`, a mesma origem única de sempre.
 */
function mix(frente: string, substrato: string, proporcao: number): string {
  const a = channels(frente);
  const b = channels(substrato);
  const canal = (i: 0 | 1 | 2): string =>
    Math.round(a[i] * proporcao + b[i] * (1 - proporcao))
      .toString(16)
      .padStart(2, '0');
  return `#${canal(0)}${canal(1)}${canal(2)}`;
}

function resolve(token: TokenName | DerivedTokenName, theme: ThemeName): string {
  const receita = DERIVED_TOKENS[token as DerivedTokenName] as
    | (typeof DERIVED_TOKENS)[DerivedTokenName]
    | undefined;
  if (receita === undefined) return declared(token as TokenName, theme);

  const proporcao = amountsByTheme[theme].get(receita.amount);
  if (proporcao === undefined) {
    throw new Error(
      `A proporção ${receita.amount} não está declarada no tema ${theme} em src/styles/tokens.css. ` +
        'Um derivado sem a sua quantidade é um valor que muda de tema sem ninguém decidir (008/FR-003).',
    );
  }

  return mix(declared(receita.source, theme), declared(receita.over, theme), proporcao);
}

describe('SC-002 · a lista de pares aprovados está íntegra', () => {
  it('o parser encontrou os valores brutos em src/styles/tokens.css', () => {
    expect(lightTokens.size).toBeGreaterThanOrEqual(COLOR_TOKENS.length);
    expect(darkTokens.size).toBeGreaterThanOrEqual(COLOR_TOKENS.length);
  });

  it('a lista fechada mantém as combinações declaradas em 009/contracts/tokens.md §2', () => {
    expect(APPROVED_PAIRS).toHaveLength(APPROVED_PAIR_COUNT);
  });

  it('nenhuma combinação aparece duas vezes', () => {
    const chaves = APPROVED_PAIRS.map((p) => `${p.foreground} sobre ${p.background} (${p.usage})`);
    expect(new Set(chaves).size).toBe(chaves.length);
  });

  it('todo token citado por um par está declarado em COLOR_TOKENS ou em DERIVED_TOKENS', () => {
    // Impede a divergência silenciosa entre as listas: um par que cite um token
    // fora das duas escaparia da verificação de paridade de tema **e** não teria
    // como ser resolvido — falharia por exceção, não por medição.
    const derivados = new Set(Object.keys(DERIVED_TOKENS));
    const citados = new Set(APPROVED_PAIRS.flatMap((p) => [p.foreground, p.background]));
    const foraDaLista = [...citados]
      .filter((t) => !COLOR_TOKENS.includes(t as TokenName) && !derivados.has(t))
      .sort();
    expect(foraDaLista).toEqual([]);
  });

  it('FR-023 · nenhum derivado é usado como tinta, só como substrato', () => {
    // Uma mistura translúcida da própria cor do glifo não é tinta de coisa
    // nenhuma. A restrição é estrutural no tipo de `ApprovedPair`; esta asserção
    // a mantém verdadeira se o tipo algum dia afrouxar.
    const derivados = new Set(Object.keys(DERIVED_TOKENS));
    const comoTinta = APPROVED_PAIRS.filter((p) => derivados.has(p.foreground));
    expect(comoTinta).toEqual([]);
  });

  it('008/FR-003 · toda receita de derivado cita tokens que existem', () => {
    const receitas = Object.entries(DERIVED_TOKENS);
    const quebradas = receitas
      .filter(
        ([, r]) => !COLOR_TOKENS.includes(r.source) || !COLOR_TOKENS.includes(r.over),
      )
      .map(([nome]) => nome);
    expect(quebradas).toEqual([]);
  });
});

describe('SC-005 · todo token de cor existe nos dois temas', () => {
  /** Sobrescritas declaradas no bloco `[data-theme='dark']`. */
  const overrides = new Map<string, string>();
  for (const body of bodiesOf(topLevel, "[data-theme='dark']")) {
    for (const [name, value] of hexDeclarations(body)) overrides.set(name, value);
  }

  it.each(COLOR_TOKENS)('%s está declarado no tema claro', (token) => {
    expect(
      lightTokens.get(token),
      `${token} não está declarado em :root de src/styles/tokens.css. ` +
        'Definição parcial é erro, não recurso (SC-005).',
    ).toBeDefined();
  });

  it.each(COLOR_TOKENS)('%s está declarado no tema escuro, sem herdar do claro', (token) => {
    expect(
      overrides.get(token),
      `${token} não é sobrescrito em [data-theme='dark'] de src/styles/tokens.css. ` +
        'Herdar do claro faz o token existir em apenas um tema (SC-005).',
    ).toBeDefined();
  });

  it('nenhum token de cor foi declarado sem entrar em COLOR_TOKENS', () => {
    // O outro lado da paridade: um `--brand-tidal` acrescentado ao CSS e
    // esquecido no contrato nunca seria medido. A varredura ignora os derivados
    // por `color-mix`, que não são hex e por isso não aparecem aqui.
    const declaradosNoEscuro = [...overrides.keys()]
      .filter((n) => !COLOR_TOKENS.includes(n as TokenName))
      .sort();
    expect(declaradosNoEscuro).toEqual([]);
  });

  it('o bloco prefers-color-scheme repete exatamente os valores de [data-theme=dark]', () => {
    // Sem isto, quem nunca escolheu tema veria um escuro diferente de quem
    // escolheu — divergência que só aparece em produção, na tela de alguém.
    const mediaStart = CLEAN_CSS.indexOf('@media (prefers-color-scheme: dark)');
    expect(mediaStart).toBeGreaterThan(-1);

    const mediaTokens = hexDeclarations(CLEAN_CSS.slice(mediaStart));
    const atributoTokens = new Map<string, string>();
    for (const body of bodiesOf(topLevel, "[data-theme='dark']")) {
      for (const [name, value] of hexDeclarations(body)) atributoTokens.set(name, value);
    }

    for (const [name, value] of atributoTokens) {
      expect(mediaTokens.get(name), `${name} diverge entre @media e [data-theme='dark']`).toBe(
        value,
      );
    }
  });

  it('as proporções de mistura também são repetidas no bloco prefers-color-scheme', () => {
    // Mesmo modo de falha dos hex, e igualmente invisível: `--brand-tint-amount`
    // esquecido no `@media` faria quem nunca escolheu tema ver o distintivo com
    // a tinta do tema claro sobre o substrato escuro — e nenhum teste de cor
    // pegaria, porque os hex estariam todos certos.
    const mediaStart = CLEAN_CSS.indexOf('@media (prefers-color-scheme: dark)');
    const mediaAmounts = percentDeclarations(CLEAN_CSS.slice(mediaStart));

    const atributoAmounts = new Map<string, number>();
    for (const body of bodiesOf(topLevel, "[data-theme='dark']")) {
      for (const [name, value] of percentDeclarations(body)) atributoAmounts.set(name, value);
    }

    for (const [name, value] of atributoAmounts) {
      expect(mediaAmounts.get(name), `${name} diverge entre @media e [data-theme='dark']`).toBe(
        value,
      );
    }
  });
});

describe.each(THEMES)('FR-003 e SC-002 · contraste no tema %s', (theme) => {
  it.each(
    APPROVED_PAIRS.map((pair) => [
      `${pair.foreground} sobre ${pair.background} — ${pair.where}`,
      pair,
    ] as const),
  )('%s', (_nome, pair) => {
    const minimo = CONTRAST_MINIMUM[pair.usage];
    const razao = contrastRatio(resolve(pair.foreground, theme), resolve(pair.background, theme));

    expect(
      roundRatio(razao),
      `${pair.foreground} sobre ${pair.background} no tema ${theme}: ` +
        `${roundRatio(razao)}:1, abaixo do mínimo de ${minimo}:1 para uso "${pair.usage}"`,
    ).toBeGreaterThanOrEqual(minimo);
  });
});

/**
 * 009/FR-008a e 009/SC-002 — a **faixa de perceptibilidade** do esqueleto.
 *
 * `--skeleton` é token de cor sem par aprovado, pelo precedente literal de
 * `--rule`: medido, ele dá 1,24:1 no escuro e 1,31:1 no claro contra `--surface`,
 * e o mínimo da categoria `ui` é 3:1. Declarar o par reprovaria; declarar o par e
 * afrouxar o mínimo destruiria o portão para todos os outros usos.
 *
 * Este é o portão que **substitui** o par, e ele verifica o que nenhuma
 * categoria de contraste verifica: o **teto**. Uma categoria `decorative` com
 * mínimo 1:1 aprovaria inclusive um token invisível.
 *
 * Se um dos dois temas sair da faixa, a correção é o valor por tema — nunca a
 * remoção da faixa (009/contracts/tokens.md §3.2).
 */
describe('009/FR-008a · o esqueleto é perceptível sem parecer conteúdo', () => {
  /** Piso: abaixo disso a barra desaparece e a forma do resultado não é antevista. */
  const PISO = 1.15;
  /** Teto: acima disso a barra compete com o texto e passa a parecer conteúdo. */
  const TETO = 1.6;

  it.each(THEMES)('no tema %s, --skeleton fica entre 1,15:1 e 1,60:1 contra --surface', (theme) => {
    const razao = roundRatio(contrastRatio(resolve('--skeleton', theme), resolve('--surface', theme)));

    expect(
      razao,
      `--skeleton sobre --surface no tema ${theme}: ${razao}:1, abaixo do piso de ${PISO}:1. ` +
        'A barra desaparece no substrato e o esqueleto deixa de antecipar a forma do resultado (FR-008a).',
    ).toBeGreaterThanOrEqual(PISO);

    expect(
      razao,
      `--skeleton sobre --surface no tema ${theme}: ${razao}:1, acima do teto de ${TETO}:1. ` +
        'A barra compete com o texto do cartão e passa a parecer conteúdo esperando ser lido (FR-008a).',
    ).toBeLessThanOrEqual(TETO);
  });

  it('--skeleton não aparece em nenhum par aprovado, como `--rule`', () => {
    // A ausência é a decisão, e por isso é asserida: acrescentar o par um dia
    // exigiria afrouxar `CONTRAST_MINIMUM.ui`, que é o portão de todos os outros
    // usos (009/contracts/tokens.md §3.1).
    const citado = APPROVED_PAIRS.filter(
      (p) => p.foreground === '--skeleton' || p.background === '--skeleton',
    );
    expect(citado).toEqual([]);
  });
});

/**
 * 009/FR-020 — a terceira tinta do arquivo de design **não** foi adotada.
 *
 * O nó `mJCdf` usa `#5b6474`, uma tinta entre `--ink-muted` e o fundo. É a mesma
 * recusa que a 007 registrou sobre `--ink-faint` e pelo mesmo motivo: a terceira
 * tinta reprova em todos os substratos, e todo valor que passa no limiar fica
 * indistinguível de `--ink-muted`. Duas tintas com a mesma aparência e nomes
 * diferentes são uma armadilha, não uma escala.
 *
 * **O portão é executável, e não um item de conferência manual.** Uma recusa
 * registrada só em prosa é uma recusa que a próxima feature desfaz sem perceber —
 * o Princípio IV vale para o que a spec proíbe tanto quanto para o que ela exige.
 */
describe('009/FR-020 · o conjunto de tintas é lista fechada', () => {
  /** Os nomes que pintam **texto** neste sistema. Uma terceira não entra em silêncio. */
  const TINTAS = ['--ink', '--ink-muted', '--accent-text', '--accent-tint-ink'] as const;

  it.each(THEMES)('no tema %s, nenhum token de tinta além dos quatro conhecidos', (theme) => {
    const declaradas = [...byTheme[theme].keys()]
      .filter((nome) => nome === '--ink' || nome.startsWith('--ink-'))
      .sort();
    expect(
      declaradas,
      'Um token de tinta novo em tokens.css sem passar por aqui. A escala de tinta tem dois ' +
        'degraus (`--ink`, `--ink-muted`) mais os dois de acento; um terceiro cinza fica ' +
        'indistinguível de `--ink-muted` e vira armadilha (FR-020).',
    ).toEqual(['--ink', '--ink-muted']);

    // As quatro continuam existindo — a lista fechada não é só sobre excesso.
    for (const tinta of TINTAS) {
      expect(byTheme[theme].get(tinta), `${tinta} sumiu do tema ${theme}`).toBeDefined();
    }
  });

  it.each(THEMES)('no tema %s, #5b6474 — a tinta do nó mJCdf — não aparece', (theme) => {
    const usos = [...byTheme[theme].entries()]
      .filter(([, valor]) => valor.toLowerCase() === '#5b6474')
      .map(([nome]) => nome);

    expect(
      usos,
      'A tinta `#5b6474` do arquivo de design foi recusada em favor de `--ink-muted` ' +
        '(FR-020, 009/contracts/tokens.md §4). Adotá-la agora desfaria uma decisão registrada.',
    ).toEqual([]);
  });
});

describe('FR-022 · texto claro sobre âmbar é proibido em qualquer contexto', () => {
  it.each(THEMES)('no tema %s, branco sobre --accent reprova e por isso não é par aprovado', (theme) => {
    const razao = contrastRatio('#ffffff', resolve('--accent', theme));
    expect(razao).toBeLessThan(CONTRAST_MINIMUM.text);

    const existe = APPROVED_PAIRS.some(
      (p) => p.background === '--accent' && p.foreground !== '--accent-ink',
    );
    expect(existe).toBe(false);
  });
});

describe('FR-023 · cor de marca é acento identificador, nunca texto', () => {
  it('nenhum par com --brand-* na frente é declarado como texto', () => {
    const comoTexto = APPROVED_PAIRS.filter(
      (p) => p.foreground.startsWith('--brand-') && p.usage === 'text',
    ).map((p) => `${p.foreground} sobre ${p.background}`);
    expect(comoTexto).toEqual([]);
  });

  it.each(THEMES)(
    'no tema %s, a proibição tem base medida: --brand-youtube reprova como texto sobre --surface-raised',
    (theme) => {
      // A restrição do requisito não é estética. Se algum dia passar, a base
      // desapareceu e a decisão precisa ser reexaminada — não silenciada.
      const razao = contrastRatio(
        resolve('--brand-youtube', theme),
        resolve('--surface-raised', theme),
      );
      expect(razao).toBeLessThan(CONTRAST_MINIMUM.text);
    },
  );
});
