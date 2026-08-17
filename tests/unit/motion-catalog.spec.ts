import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import * as primitivas from '@/ui/motion';

/**
 * A fechadura em volta da biblioteca de movimento — FR-001 a FR-003, FR-009,
 * FR-014, SC-001, SC-002 (`010/contracts/motion-catalog.md` §1 e §6).
 *
 * ## O que mudou em relação à 009
 *
 * A 009 afirmava **"exatamente três"**. Esta feature afirma **quais são**.
 *
 * A contagem nunca foi a invariante — era um proxy barato para ela. A invariante
 * é *toda animação do produto tem nome, papel e passou por revisão*. Um número
 * falha nos dois sentidos errados: quebra quando um movimento novo entra **com**
 * revisão, e não diz qual sumiu quando quebra. A identidade falha exatamente
 * onde precisa — movimento entrando calado — e o modo de falha nomeia o culpado.
 *
 * Este arquivo é o `motion-surface.spec.ts` da 009 **renomeado**, e não um teste
 * novo ao lado: dois testes com o mesmo propósito e critérios diferentes é como
 * um deles apodrece.
 *
 * ## Por que existe, sendo que já há uma regra de lint
 *
 * A redundância é deliberada, e é a mesma disciplina da tabela de hosts do
 * Princípio II: a fechadura que importa é a que continua fechada depois de
 * alguém tentar abri-la. `tp/no-motion-library-import` falha no editor, enquanto
 * ainda custa uma tecla consertar; este teste alcança o que o ESLint não lê —
 * os `.css` — e sobrevive a um comentário de supressão.
 */

const SRC = join(process.cwd(), 'src');
const DIRETORIO_DE_MOVIMENTO = 'src/ui/motion';

/**
 * **O catálogo.** Transcrição normativa de `010/contracts/motion-catalog.md` §2.
 *
 * Acrescentar uma primitiva custa quatro edições no mesmo commit — o arquivo, o
 * barril, a tabela do contrato e esta lista (FR-002). É a revisão que se quer
 * forçar; sem ela, "movimento tem nome e papel" é prosa.
 */
const CATALOGO = [
  { nome: 'SpinningDisc', arquivo: 'SpinningDisc.tsx', animaPosicao: false },
  { nome: 'PulsingBar', arquivo: 'PulsingBar.tsx', animaPosicao: false },
  { nome: 'CrossFade', arquivo: 'CrossFade.tsx', animaPosicao: false },
  { nome: 'StepTransition', arquivo: 'StepTransition.tsx', animaPosicao: false },
  { nome: 'Stagger', arquivo: 'Stagger.tsx', animaPosicao: false },
  { nome: 'Settle', arquivo: 'Settle.tsx', animaPosicao: true },
] as const;

function arquivos(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) {
      found.push(...arquivos(full));
      continue;
    }
    if (/\.(tsx?|css)$/u.test(entry)) found.push(full);
  }
  return found;
}

/** Neutraliza comentários preservando a numeração de linha. */
function semComentarios(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//gu, (block) => block.replace(/[^\n]/gu, ' '))
    .replace(/^\s*\/\/.*$/gmu, (line) => line.replace(/[^\n]/gu, ' '));
}

const FONTES = arquivos(SRC).map((path) => {
  const caminho = relative(process.cwd(), path).replaceAll('\\', '/');
  return {
    caminho,
    texto: semComentarios(readFileSync(path, 'utf8')),
    /** Sem comentários **nem** neutralização: para inspecionar as primitivas. */
    cru: readFileSync(path, 'utf8'),
    dentroDaFechadura: caminho.startsWith(`${DIRETORIO_DE_MOVIMENTO}/`),
  };
});

/** Os arquivos de componente do diretório, sem o barril e sem a escala. */
const PRIMITIVAS = FONTES.filter((f) => f.dentroDaFechadura && f.caminho.endsWith('.tsx'));

/** Uma entrada do catálogo casada com o arquivo dela. Falha cedo se faltar. */
const CATALOGADAS = CATALOGO.map((entrada) => {
  const arquivo = PRIMITIVAS.find(
    (f) => f.caminho === `${DIRETORIO_DE_MOVIMENTO}/${entrada.arquivo}`,
  );
  if (arquivo === undefined) {
    throw new Error(
      `O catálogo declara ${entrada.nome} em ${entrada.arquivo}, e o arquivo não existe.`,
    );
  }
  return { ...entrada, arquivo };
});

describe('FR-003 · a biblioteca de movimento entra por um único diretório', () => {
  it('encontrou arquivos para inspecionar', () => {
    expect(FONTES.length).toBeGreaterThan(30);
  });

  it('nenhum arquivo fora de src/ui/motion/ importa de `motion`', () => {
    const infratores = FONTES.filter((f) => !f.dentroDaFechadura)
      .flatMap((f) =>
        f.texto
          .split('\n')
          .map((linha, i) => ({ linha, numero: i + 1, caminho: f.caminho }))
          .filter(({ linha }) => /from\s+'motion(?:\/[a-z-]+)?'/u.test(linha)),
      )
      .map(({ caminho, numero, linha }) => `${caminho}:${String(numero)}  ${linha.trim()}`);

    expect(
      infratores,
      'A superfície pede a primitiva do catálogo e nunca a biblioteca (FR-003):\n  ' +
        infratores.join('\n  '),
    ).toEqual([]);
  });

  it('`framer-motion` não é importado em lugar nenhum, nem dentro da fechadura', () => {
    // O nome anterior da mesma biblioteca, presente aqui só como dependência
    // transitiva de `motion`. Importá-lo contornaria a fechadura sem que o
    // catálogo mudasse — e produziria duas cópias no artefato, com um
    // `useReducedMotion` de cada uma.
    const infratores = FONTES.flatMap((f) =>
      f.texto
        .split('\n')
        .map((linha, i) => ({ linha, numero: i + 1, caminho: f.caminho }))
        .filter(({ linha }) => /from\s+'framer-motion/u.test(linha)),
    ).map(({ caminho, numero, linha }) => `${caminho}:${String(numero)}  ${linha.trim()}`);

    expect(infratores, `\n  ${infratores.join('\n  ')}`).toEqual([]);
  });
});

describe('FR-001, FR-002, SC-001, SC-002 · o movimento autorizado é o catálogo', () => {
  it('o barril exporta exatamente os nomes do catálogo', () => {
    /*
      **Identidade, não contagem.** Uma primitiva que entra sem passar por aqui
      quebra o teste nomeando-se; uma que sai também. É a diferença material em
      relação ao `toBe(3)` da 009, que quebrava sem dizer o que mudou.
    */
    expect(Object.keys(primitivas).sort()).toEqual([...CATALOGO.map((e) => e.nome)].sort());
  });

  it('o diretório não abriga componente fora do catálogo', () => {
    /*
      A direção contrária da asserção acima, e é ela que pega o modo de falha
      mais silencioso: um arquivo de primitiva escrito no diretório e **não**
      exportado pelo barril passaria despercebido — inclusive por um `import`
      direto de `@/ui/motion/Alguma` feito por uma tela.
    */
    const declarados = CATALOGO.map((e) => `${DIRETORIO_DE_MOVIMENTO}/${e.arquivo}`);
    declarados.sort();
    expect([...PRIMITIVAS.map((f) => f.caminho)].sort()).toEqual(declarados);
  });

  it('o barril não reexporta `motion` nem nada da biblioteca', () => {
    /*
      **É o modo de falha que interessa.** Um `export { motion } from 'motion/react'`
      passaria na identidade acima se alguém acrescentasse o nome ao catálogo —
      e passaria calado se o reexportasse com outro nome. A asserção é sobre o
      texto do barril: nada além dos arquivos locais do catálogo sai daqui.
    */
    const barril = FONTES.find((f) => f.caminho === `${DIRETORIO_DE_MOVIMENTO}/index.ts`);
    expect(barril).toBeDefined();

    const origens = [...(barril?.texto ?? '').matchAll(/from\s+'([^']+)'/gu)].map((m) => m[1]);
    origens.sort();

    const esperadas = CATALOGO.map((e) => `./${e.arquivo.replace(/\.tsx$/u, '')}`);
    esperadas.sort();

    expect(
      origens,
      'O barril só reexporta os arquivos locais do catálogo. Reexportar a biblioteca ' +
        'devolveria a chave à fechadura (FR-003).',
    ).toEqual(esperadas);
  });
});

describe('FR-009 · o catálogo anima só `transform` e `opacity`', () => {
  /**
   * As propriedades que a biblioteca aceita em `animate` e que **não** são
   * `transform` nem `opacity`. Animar qualquer uma força recálculo de layout ou
   * repintura a cada quadro — e a tela de busca anima **enquanto uma requisição
   * está em voo** (`010/contracts/motion-catalog.md` §3).
   *
   * A lista é herdada literalmente de `motion-surface.spec.ts`.
   */
  const PROIBIDAS = [
    'height',
    'width',
    'top',
    'left',
    'right',
    'bottom',
    'margin',
    'padding',
    'backgroundColor',
    'color',
    'borderRadius',
    'filter',
    'boxShadow',
  ];

  /**
   * Animar **posição** é a exceção declarada por nome do §3: a biblioteca compõe
   * com `translate` e nunca com `top`/`left`, mas **mede** o layout para calcular
   * o delta. É a medição que custa, e é por isso que o portão de ociosidade
   * existe.
   */
  const POSICAO = ['layout', 'layoutId'];

  it.each(CATALOGADAS.map((e) => [e.nome, e] as const))(
    '%s não anima propriedade fora das duas autorizadas',
    (_nome, entrada) => {
      const proibidas = entrada.animaPosicao ? PROIBIDAS : [...PROIBIDAS, ...POSICAO];
      const encontradas = proibidas.filter((prop) =>
        new RegExp(`\\b${prop}\\s*:`, 'u').test(entrada.arquivo.texto),
      );
      expect(
        encontradas,
        `Propriedades proibidas em ${entrada.arquivo.caminho}: ${encontradas.join(', ')}. ` +
          '`transform` e `opacity` são compostas pela GPU sem recálculo de layout; ' +
          'qualquer outra competiria com a requisição que a tela está esperando (FR-009).',
      ).toEqual([]);
    },
  );

  it('`Settle` é a única entrada autorizada a animar posição', () => {
    /*
      **A asserção é dirigida, e é sobre o tamanho da exceção.** A 009 proibia
      animação de posição categoricamente; a 010 substituiu a proibição por uma
      fronteira. Uma fronteira sem esta asserção viraria uma porta: bastaria
      alguém marcar `animaPosicao: true` numa segunda entrada para que a lista
      de propriedades proibidas afrouxasse para ela também.

      Um elemento. Se um dia forem dois, que seja com este teste quebrando e
      alguém decidindo (contracts/motion-catalog.md §3).
    */
    const autorizadas = CATALOGO.filter((e) => e.animaPosicao).map((e) => e.nome);
    expect(autorizadas).toEqual(['Settle']);
    expect(autorizadas).toHaveLength(1);
  });

  it('`Settle` exige o portão de ociosidade, e ele não tem valor padrão', () => {
    // Um padrão `true` faria o esquecimento abrir o portão, e o modo de falha
    // de um portão deve ser fechar (contracts/motion-catalog.md §4).
    const settle = CATALOGADAS.find((e) => e.nome === 'Settle');
    expect(settle).toBeDefined();
    expect(/readonly idle\s*:\s*boolean/u.test(settle?.arquivo.texto ?? '')).toBe(true);
    expect(/idle\s*\?\s*:/u.test(settle?.arquivo.texto ?? '')).toBe(false);
    expect(/idle\s*=\s*(?:true|false)/u.test(settle?.arquivo.texto ?? '')).toBe(false);
  });

  it('nenhuma primitiva usa `AnimatePresence mode="wait"`', () => {
    // Produziria a célula vazia durante a saída — o salto de layout que a 009 já
    // recusou, e que aqui atrasaria também o foco (009/research §R7, FR-016).
    const infratores = PRIMITIVAS.filter((f) => /mode\s*=\s*["']wait["']/u.test(f.texto)).map(
      (f) => f.caminho,
    );
    expect(infratores).toEqual([]);
  });
});

describe('FR-004 · superfície pede papel, nunca configura animação', () => {
  /**
   * As props que **nenhuma** primitiva pode aceitar
   * (`010/contracts/motion-catalog.md` §2.2).
   *
   * É a mesma disciplina que `src/ui/icons.ts` já impõe — `<Icon role="advance" />`,
   * e não `<Icon name="chevron-right" size={16} />`. Uma superfície que precise
   * de tempo próprio não ganha um parâmetro: ela vira papel novo, e papel novo
   * custa as quatro edições do FR-002.
   *
   * A asserção é sobre a **interface de props**, e não sobre o arquivo inteiro:
   * `duration` aparece legitimamente dentro de `transition={{ … }}`, lendo da
   * escala. O que não pode existir é a superfície poder escolher o valor.
   */
  const PROIBIDAS_COMO_PROP = ['duration', 'ease', 'delay', 'transition'];

  it.each(CATALOGADAS.map((e) => [e.nome, e] as const))(
    '%s não expõe duração, curva nem atraso na interface de props',
    (nome, entrada) => {
      const bloco = new RegExp(
        `export interface ${nome}Props\\s*\\{([\\s\\S]*?)\\n\\}`,
        'u',
      ).exec(entrada.arquivo.texto);

      // Uma primitiva sem props declaradas não tem como aceitar nenhuma delas.
      if (bloco?.[1] === undefined) return;

      const encontradas = PROIBIDAS_COMO_PROP.filter((prop) =>
        new RegExp(`\\b${prop}\\??\\s*:`, 'u').test(bloco[1] ?? ''),
      );
      expect(
        encontradas,
        `${entrada.arquivo.caminho} aceita ${encontradas.join(', ')} como prop. A superfície ` +
          'pede o papel; quem precisa de tempo próprio vira entrada nova no catálogo (FR-004).',
      ).toEqual([]);
    },
  );
});

describe('FR-014 · cada primitiva tem o seu próprio interruptor', () => {
  /**
   * Por que a asserção é **por primitiva** e não global
   * (`010/contracts/motion-catalog.md` §5, herdado palavra por palavra da 009):
   *
   * - a regra de CSS de `index.css` zera `animation-duration` e
   *   `transition-duration`, e **não alcança** a biblioteca, que anima por WAAPI;
   * - `<MotionConfig reducedMotion="user">` desativa transformação e layout e
   *   **preserva `opacity`** — que é justamente o que a pulsação do esqueleto e o
   *   escalonamento animam, e o que o FR-014 manda suprimir.
   *
   * Não há interruptor de cima que sirva. Cada uma consulta o seu.
   */
  it.each(CATALOGADAS.map((e) => [e.nome, e] as const))(
    '%s consulta useReducedMotion',
    (_nome, entrada) => {
      expect(
        /useReducedMotion\s*\(\s*\)/u.test(entrada.arquivo.texto),
        `${entrada.arquivo.caminho} não consulta \`useReducedMotion()\`. Nenhum interruptor de ` +
          'cima serve: a regra de CSS não alcança a biblioteca, e ' +
          '`MotionConfig reducedMotion="user"` preserva a `opacity` que o FR-014 manda ' +
          'suprimir (009/research §R6).',
      ).toBe(true);
    },
  );
});
