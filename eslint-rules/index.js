/**
 * Regras de lint locais que protegem decisões do plano que o compilador não vê.
 *
 * - `no-ui-text-literals`: todo texto de interface vive em `src/i18n/`. Um
 *   literal escapado no JSX passa despercebido em revisão.
 * - `no-dynamic-classname`: o scanner do Tailwind lê o código como texto e não
 *   resolve expressões. Um `className` montado por concatenação simplesmente não
 *   é emitido no CSS — falha que não aparece em desenvolvimento e só se manifesta
 *   no build.
 * - `no-raw-visual-values`: todo valor visual vem da camada de tokens.
 * - `no-raw-motion-values`: o par da anterior para o **tempo**. Todo valor de
 *   duração, atraso e curva vem de `src/ui/motion/scale.ts` (010/FR-008).
 * - `no-icon-library-import`: uma superfície pede um **papel**, nunca um
 *   componente da biblioteca de ícones (007/FR-056, FR-059, SC-016).
 * - `no-motion-library-import`: o movimento autorizado é o catálogo de
 *   `010/contracts/motion-catalog.md`, e a biblioteca entra por um único
 *   diretório (010/FR-002, FR-003).
 *
 * Todas compartilham o mesmo motivo de existir: são erros que **não falham**.
 * O TypeScript não reclama de uma classe que o Tailwind não emitiu, e o build
 * não reclama de uma importação que puxou trinta mil ícones.
 */

/** Atributos cujo valor é lido por pessoas ou por leitores de tela. */
const TEXTUAL_ATTRIBUTES = new Set([
  'alt',
  'aria-label',
  'aria-placeholder',
  'aria-roledescription',
  'aria-valuetext',
  'placeholder',
  'title',
]);

/** Texto que não é conteúdo: pontuação isolada, separadores, símbolos. */
function isInsignificantText(value) {
  const trimmed = value.trim();
  if (trimmed.length === 0) return true;
  // Pontuação, separadores e símbolos soltos não são "texto de interface".
  return /^[\s\p{P}\p{S}]+$/u.test(trimmed);
}

const noUiTextLiterals = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Texto de interface deve vir de src/i18n/pt-BR.ts, nunca de um literal no componente (FR-048).',
    },
    schema: [],
    messages: {
      jsxText:
        'Texto de interface literal no JSX: "{{text}}". Mova para src/i18n/pt-BR.ts e referencie a chave (FR-048).',
      jsxAttribute:
        'Texto de interface literal no atributo "{{attribute}}". Mova para src/i18n/pt-BR.ts e referencie a chave (FR-048).',
    },
  },
  create(context) {
    return {
      JSXText(node) {
        if (isInsignificantText(node.value)) return;
        context.report({
          node,
          messageId: 'jsxText',
          data: { text: node.value.trim().slice(0, 40) },
        });
      },
      JSXAttribute(node) {
        const name = node.name.type === 'JSXIdentifier' ? node.name.name : null;
        if (name === null || !TEXTUAL_ATTRIBUTES.has(name)) return;
        if (node.value === null) return;
        if (node.value.type !== 'Literal' || typeof node.value.value !== 'string') return;
        if (isInsignificantText(node.value.value)) return;
        context.report({ node, messageId: 'jsxAttribute', data: { attribute: name } });
      },
    };
  },
};

const noDynamicClassName = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Classes utilitárias do Tailwind devem ser literais estáticas; use um mapa explícito para variantes (research §14).',
    },
    schema: [],
    messages: {
      template:
        'className montado por template literal com interpolação. O Tailwind não emite classes construídas em tempo de execução — use um mapa explícito de literais (research §14).',
      concatenation:
        'className montado por concatenação de strings. O Tailwind não emite classes construídas em tempo de execução — use um mapa explícito de literais (research §14).',
    },
  },
  create(context) {
    function inspect(node, report) {
      if (node === null || node === undefined) return;
      switch (node.type) {
        case 'TemplateLiteral':
          if (node.expressions.length > 0) report(node, 'template');
          return;
        case 'BinaryExpression':
          if (node.operator === '+') report(node, 'concatenation');
          return;
        case 'ConditionalExpression':
          // Ternário entre dois literais completos é seguro e legível.
          inspect(node.consequent, report);
          inspect(node.alternate, report);
          return;
        case 'LogicalExpression':
          inspect(node.right, report);
          return;
        default:
      }
    }

    return {
      JSXAttribute(node) {
        const name = node.name.type === 'JSXIdentifier' ? node.name.name : null;
        if (name !== 'className') return;
        if (node.value === null || node.value.type !== 'JSXExpressionContainer') return;
        inspect(node.value.expression, (offender, messageId) => {
          context.report({ node: offender, messageId });
        });
      },
    };
  },
};

/**
 * Prefixos de utilitário que consomem cor.
 *
 * `accent` está **deliberadamente fora** da lista: `accent-accent` é a
 * propriedade CSS `accent-color`, que pinta o preenchimento de `<progress>` e de
 * caixa de seleção nativa — uso que o FR-050 autoriza. Incluir o prefixo por
 * simetria quebraria os dois usos legítimos do projeto.
 */
const COLOR_PREFIXES =
  '(?:bg|text|border|ring|outline|fill|stroke|divide|decoration|placeholder|caret|from|via|to|shadow)';

const SPACING_PREFIXES =
  '(?:p|px|py|pt|pb|pl|pr|ps|pe|m|mx|my|mt|mb|ml|mr|ms|me|gap|gap-x|gap-y|space-x|space-y|size|w|h|min-w|min-h|max-w|max-h|top|bottom|left|right|inset|inset-x|inset-y|translate-x|translate-y|basis)';

const TAILWIND_PALETTE =
  '(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)';

/** Variante opcional (`hover:`, `sm:`, `disabled:hover:`, …). */
const VARIANTS = '(?:[a-z-]+:)*';

/**
 * Nomes que saíram das escalas na feature 007.
 *
 * Este é o modo de falha que a feature inteira gira em torno de vigiar:
 * **utilitário inexistente não é erro**. `text-item` depois de o degrau sair da
 * escala não quebra o build, não falha o `typecheck` e não aparece em log
 * nenhum — a classe simplesmente não gera CSS, e o texto fica com o tamanho
 * herdado. Uma tela esquecida na migração é invisível até alguém abri-la.
 *
 * `tests/unit/no-orphan-tokens.spec.ts` cobre o mesmo terreno em CI. A
 * duplicação é deliberada: aqui a falha aparece no editor, enquanto ainda custa
 * uma tecla consertar.
 */
const REMOVED_UTILITIES = '(?:text-item|gutter-row)';

const RAW_VISUAL_PATTERNS = [
  {
    messageId: 'arbitrary',
    pattern: new RegExp(
      `\\b${VARIANTS}(?:${COLOR_PREFIXES}|${SPACING_PREFIXES}|rounded(?:-[a-z]+)?)-\\[[^\\]]*\\]`,
      'u',
    ),
  },
  {
    messageId: 'palette',
    pattern: new RegExp(`\\b${VARIANTS}${COLOR_PREFIXES}-${TAILWIND_PALETTE}-\\d{2,3}\\b`, 'u'),
  },
  {
    messageId: 'accentMisuse',
    pattern: new RegExp(`\\b${VARIANTS}(?:text|border|ring|outline|divide)-accent\\b(?!-)`, 'u'),
  },
  /**
   * Cor de marca como preenchimento (007/FR-023).
   *
   * `text-brand-spotify` **é permitido**: o ícone do provedor herda
   * `currentColor`, e tingir o ícone é exatamente o uso que o requisito
   * autoriza. `bg-brand-spotify` não é — preenchimento sólido significa
   * acionável neste sistema (FR-024), e um chip pintado de verde Spotify diz
   * "clique aqui" em vez de "este é o Spotify".
   *
   * **O prefixo `tint` está excluído** (008/FR-004). `bg-brand-tint-spotify` é
   * outro utilitário, com outro token, e o `(?!tint-)` é o que o separa —
   * `[a-z]+` não atravessa hífen, então sem esta exclusão o substrato de
   * identidade casaria com `bg-brand-tint` e seria recusado aqui em vez de na
   * regra própria, que é a que sabe **onde** ele é permitido.
   */
  {
    messageId: 'brandAsFill',
    pattern: new RegExp(`\\b${VARIANTS}bg-brand-(?!tint-)[a-z]+\\b`, 'u'),
  },
  {
    messageId: 'removedUtility',
    pattern: new RegExp(`\\b${VARIANTS}${REMOVED_UTILITIES}\\b`, 'u'),
  },
  /**
   * A variante da goteira saiu com a goteira (007/FR-029). Diferente das
   * demais, uma variante inexistente faz o Tailwind descartar a **declaração
   * inteira** — `gutter:not-sr-only` não vira nada, e o rótulo fica invisível
   * em toda largura.
   */
  {
    messageId: 'removedUtility',
    pattern: /\bgutter:[a-z-]/u,
  },
];

/**
 * O **único** arquivo autorizado a usar o substrato de identidade por provedor
 * (008/FR-004).
 *
 * A permissão é de arquivo e não de padrão, de propósito: o design desenha o
 * substrato tingido no distintivo do cartão de destino e em nenhum outro lugar,
 * e uma allowlist de arquivo torna "autorizar um segundo ponto" uma edição desta
 * regra — que é exatamente a revisão que se quer forçar. Um limiar de opacidade
 * seria alegável por qualquer tela nova sem passar por ninguém.
 *
 * Caminho relativo à raiz, com barra normalizada: o `filename` que o ESLint
 * entrega é absoluto e usa o separador do sistema.
 */
const BRAND_TINT_HOST = 'src/features/destinations/DestinationSelector.tsx';

const BRAND_TINT_PATTERN = new RegExp(`\\b${VARIANTS}bg-brand-tint-[a-z]+\\b`, 'u');

const noRawVisualValues = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Todo valor visual vem da camada de tokens; valor avulso no componente é proibido (FR-002, FR-022, FR-023, FR-045, SC-004).',
    },
    schema: [],
    messages: {
      brandTintOutsideCard:
        'O substrato de identidade "{{utility}}" fora de src/features/destinations/DestinationSelector.tsx. Ele é a **exceção nomeada** de 008/FR-004 e existe para o distintivo do cartão de destino — em qualquer outro lugar a cor de marca continua sendo acento identificador, nunca preenchimento. Autorizar um segundo ponto custa editar esta regra de lint, e é essa revisão que se quer forçar.',
      arbitrary:
        'Valor visual arbitrário em "{{utility}}". Cor, espaçamento e raio vêm da camada de tokens — use um degrau da escala ou declare um token em src/styles/ (FR-045, SC-004).',
      palette:
        'Escala crua da paleta do Tailwind em "{{utility}}". A paleta padrão foi removida do tema justamente para que a cor venha de um nome semântico (FR-004, FR-045).',
      accentMisuse:
        'O âmbar de "{{utility}}" é preenchimento, não tinta: em cheia saturação ele dá 1,7:1 como texto ou borda. Para texto, link, borda e foco o token é `--accent-text` (FR-022).',
      brandAsFill:
        'Cor de marca como preenchimento em "{{utility}}". Preenchimento sólido significa acionável neste sistema; a cor de marca é acento identificador — ícone e filete, nunca ação, nunca estado, nunca texto (FR-023, FR-024).',
      removedUtility:
        'O utilitário "{{utility}}" saiu das escalas na feature 007 e **não emite CSS nenhum** — a classe é aceita em silêncio e o estilo simplesmente não aparece. Consulte contracts/token-migration.md §4 para o substituto.',
    },
  },
  create(context) {
    const filename = (context.filename ?? context.getFilename()).replaceAll('\\', '/');
    const isBrandTintHost = filename.endsWith(BRAND_TINT_HOST);

    /**
     * A varredura é sobre **todo literal de string do arquivo**, não só sobre
     * `className`. As variantes de `Button` e de `StatusBadge` vivem em mapas de
     * literais no topo do módulo — que é a convenção que `no-dynamic-classname`
     * obriga —, e uma regra que só olhasse o JSX deixaria de fora exatamente os
     * arquivos onde a cor é decidida.
     */
    function inspect(node, value) {
      // O substrato de identidade é verificado **antes** dos padrões gerais, e
      // fora deles, porque é o único cuja legalidade depende do arquivo.
      if (!isBrandTintHost) {
        const tint = BRAND_TINT_PATTERN.exec(value);
        if (tint !== null) {
          context.report({
            node,
            messageId: 'brandTintOutsideCard',
            data: { utility: tint[0] },
          });
          return;
        }
      }

      for (const { messageId, pattern } of RAW_VISUAL_PATTERNS) {
        const match = pattern.exec(value);
        if (match === null) continue;
        context.report({ node, messageId, data: { utility: match[0] } });
        return;
      }
    }

    return {
      Literal(node) {
        if (typeof node.value !== 'string') return;
        // `import x from '…'` e `export … from '…'` não são classes.
        if (node.parent?.type === 'ImportDeclaration') return;
        if (node.parent?.type === 'ExportNamedDeclaration') return;
        inspect(node, node.value);
      },
      TemplateElement(node) {
        inspect(node, node.value.raw);
      },
    };
  },
};

/**
 * O único arquivo autorizado a importar da biblioteca de ícones.
 *
 * Caminho relativo à raiz do projeto, com barra normalizada — o `filename` que o
 * ESLint entrega é absoluto e usa o separador do sistema.
 */
const ICON_MAP_PATH = 'src/ui/icons.ts';

const noIconLibraryImport = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Ícone se pede por papel, através de src/ui/icons.ts; nenhuma superfície importa de react-icons (007/FR-056, FR-059, SC-016).',
    },
    schema: [],
    messages: {
      outsideMap:
        'Importação de "{{source}}" fora de src/ui/icons.ts. Uma superfície pede um papel — `<Icon role="advance" />` — e nunca um componente da biblioteca. É o que faz trocar o ícone de um papel custar uma edição em vez de uma varredura por todo o src/ (FR-059, SC-016).',
      rootIndex:
        'Importação do índice raiz de react-icons. O índice puxa a árvore inteira — dezenas de milhares de componentes — **sem emitir aviso nenhum**, e o custo só apareceria na medição de pacote. Importe pelo subcaminho do conjunto: `react-icons/lu` ou `react-icons/pi` (FR-056).',
    },
  },
  create(context) {
    const filename = (context.filename ?? context.getFilename()).replaceAll('\\', '/');
    const isMap = filename.endsWith(ICON_MAP_PATH);

    /** Cobre `import`, `export … from` e `import()` dinâmico. */
    function check(node, source) {
      if (typeof source !== 'string') return;
      if (!source.startsWith('react-icons')) return;

      // O índice raiz é proibido em toda parte, **inclusive no mapa** — o mapa
      // importa `react-icons/lu` e `react-icons/pi`, nunca `react-icons`. A
      // única exceção é `import type`, que o compilador apaga e que não puxa
      // runtime nenhum; ela é tratada pelo chamador.
      if (source === 'react-icons') {
        context.report({ node, messageId: 'rootIndex' });
        return;
      }

      if (!isMap) {
        context.report({ node, messageId: 'outsideMap', data: { source } });
      }
    }

    return {
      ImportDeclaration(node) {
        // `import type { IconType } from 'react-icons'` não sobrevive à
        // compilação: é anotação, não dependência.
        if (node.importKind === 'type') return;
        check(node, node.source.value);
      },
      ExportNamedDeclaration(node) {
        if (node.source === null || node.source === undefined) return;
        if (node.exportKind === 'type') return;
        check(node, node.source.value);
      },
      ExportAllDeclaration(node) {
        if (node.exportKind === 'type') return;
        check(node, node.source?.value);
      },
      ImportExpression(node) {
        if (node.source.type !== 'Literal') return;
        check(node, node.source.value);
      },
    };
  },
};

/**
 * O único **diretório** autorizado a importar a biblioteca de movimento
 * (010/FR-002, FR-003; 010/contracts/motion-catalog.md §1).
 *
 * Diretório, e não arquivo como em `ICON_MAP_PATH`, porque cada movimento é um
 * componente próprio, e a eles se soma a escala de tempo e o barril — o mapa de
 * ícones cabia num arquivo, o de movimento não.
 *
 * **A 009 protegia uma contagem; esta regra protege o ponto de entrada.** O que
 * substitui o "exatamente três" é o catálogo nomeado de
 * `010/contracts/motion-catalog.md` §2, verificado por identidade em
 * `tests/unit/motion-catalog.spec.ts`. Uma contagem quebrava quando um movimento
 * novo entrava **com** revisão e não dizia qual sumiu quando quebrava; a
 * identidade falha exatamente onde precisa e nomeia o culpado.
 *
 * Caminho relativo à raiz, com barra normalizada — o `filename` que o ESLint
 * entrega é absoluto e usa o separador do sistema.
 */
const MOTION_DIRECTORY = 'src/ui/motion/';

const noMotionLibraryImport = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'A biblioteca de movimento entra por src/ui/motion/, que exporta o catálogo de 010/contracts/motion-catalog.md §2 (010/FR-002, FR-003, SC-001).',
    },
    schema: [],
    messages: {
      outsideDirectory:
        'Importação de "{{source}}" fora de src/ui/motion/. O movimento autorizado é o **catálogo** de 010/contracts/motion-catalog.md §2, e a superfície pede a primitiva pelo papel dela, nunca a biblioteca. Acrescentar um movimento custa quatro edições no mesmo commit — o arquivo, o barril, a tabela do contrato e tests/unit/motion-catalog.spec.ts —, e é essa revisão que se quer forçar (010/FR-002).',
      framerAlias:
        'Importação de "{{source}}". `framer-motion` é o nome anterior da mesma biblioteca e só existe aqui como dependência transitiva de `motion` — importá-lo contorna a fechadura sem que o catálogo mude, e produz duas cópias no artefato, com um `useReducedMotion` de cada uma. O pacote deste projeto é `motion`, e o ponto de entrada é src/ui/motion/ (010/contracts/motion-catalog.md §1).',
    },
  },
  create(context) {
    const filename = (context.filename ?? context.getFilename()).replaceAll('\\', '/');
    const isMotionDirectory = filename.includes(MOTION_DIRECTORY);

    /** Cobre `import`, `export … from` e `import()` dinâmico. */
    function check(node, source) {
      if (typeof source !== 'string') return;

      // `framer-motion` é proibido em toda parte, **inclusive dentro do
      // diretório**: dois nomes para a mesma biblioteca produziriam duas cópias
      // no artefato e um `useReducedMotion` de cada uma.
      if (source === 'framer-motion' || source.startsWith('framer-motion/')) {
        context.report({ node, messageId: 'framerAlias', data: { source } });
        return;
      }

      // `@/ui/motion` e `./motion` são o próprio barril, não a biblioteca.
      if (source !== 'motion' && !source.startsWith('motion/')) return;

      if (!isMotionDirectory) {
        context.report({ node, messageId: 'outsideDirectory', data: { source } });
      }
    }

    return {
      ImportDeclaration(node) {
        // `import type` não sobrevive à compilação: é anotação, não dependência.
        if (node.importKind === 'type') return;
        check(node, node.source.value);
      },
      ExportNamedDeclaration(node) {
        if (node.source === null || node.source === undefined) return;
        if (node.exportKind === 'type') return;
        check(node, node.source.value);
      },
      ExportAllDeclaration(node) {
        if (node.exportKind === 'type') return;
        check(node, node.source?.value);
      },
      ImportExpression(node) {
        if (node.source.type !== 'Literal') return;
        check(node, node.source.value);
      },
    };
  },
};

/**
 * O **único** arquivo autorizado a escrever valor de tempo ou de curva
 * (010/FR-008, 010/contracts/motion-scale.md §3).
 *
 * Nem as próprias primitivas são isentas: elas importam da escala como qualquer
 * outro consumidor. A isenção é da **origem**, não de quem está perto dela.
 *
 * Caminho relativo à raiz, com barra normalizada — o `filename` que o ESLint
 * entrega é absoluto e usa o separador do sistema.
 */
const MOTION_SCALE_PATH = 'src/ui/motion/scale.ts';

/** Os degraus que o `@theme` de `src/styles/index.css` emite. */
const EMITTED_DURATIONS = '(?:quick|base|settle|spin|pulse)';
const EMITTED_EASINGS = '(?:standard|through|linear)';

/**
 * As chaves de `transition` cujo valor é tempo. `repeatDelay` entra porque um
 * ciclo com pausa entre voltas é tão parte da cadência quanto a volta.
 */
const TIME_KEYS = new Set(['duration', 'delay', 'repeatDelay']);

const RAW_MOTION_PATTERNS = [
  {
    messageId: 'durationUtility',
    pattern: new RegExp(`\\b${VARIANTS}duration-(?!${EMITTED_DURATIONS}\\b)[^\\s'"\`]+`, 'u'),
  },
  {
    messageId: 'easeUtility',
    pattern: new RegExp(`\\b${VARIANTS}ease-(?!${EMITTED_EASINGS}\\b)[^\\s'"\`]+`, 'u'),
  },
];

const noRawMotionValues = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Todo valor de tempo e de curva vem de src/ui/motion/scale.ts; valor avulso é proibido (010/FR-006, FR-008, SC-003).',
    },
    schema: [],
    messages: {
      rawTime:
        'Valor de tempo literal em "{{key}}". Um degrau não declarado nasce exatamente assim — `{{key}}: {{value}}` gera animação válida, passa no typecheck e passa no build, e só um par de olhos numa revisão perceberia que o sistema ganhou um sexto tempo. Use um degrau de `DURACAO` em src/ui/motion/scale.ts, ou declare um papel novo lá (010/FR-006, FR-008).',
      rawEase:
        'Curva literal em "ease". A escala tem três — `standard` para entradas e trocas, `through` para ciclos de ida e volta, `linear` para rotação contínua —, e uma quarta exige papel declarado que nenhuma delas atenda. Use `CURVA` de src/ui/motion/scale.ts (010/contracts/motion-scale.md §1.3).',
      durationUtility:
        'O utilitário "{{utility}}" está fora da escala. Diferente da cor, aqui **nenhum reset alcança o caminho**: o utilitário funcional do Tailwind acrescenta `ms` a qualquer inteiro cru, e `duration-350` emite CSS válido em silêncio. Os degraus emitidos são `duration-quick`, `duration-base`, `duration-settle`, `duration-spin` e `duration-pulse` (010/FR-008).',
      easeUtility:
        'O utilitário "{{utility}}" está fora da escala. As curvas emitidas são `ease-standard`, `ease-through` e `ease-linear`; `ease-in`, `ease-out` e `ease-in-out` foram derrubados do tema de propósito, porque são de outra linhagem — o `--ease-out` do Tailwind é `cubic-bezier(0, 0, 0.2, 1)` e não o `easeOut` que a 009 mediu (010/FR-008).',
    },
  },
  create(context) {
    const filename = (context.filename ?? context.getFilename()).replaceAll('\\', '/');
    if (filename.endsWith(MOTION_SCALE_PATH)) return {};

    /** O nome de uma chave de objeto, literal ou identificador. */
    function keyName(node) {
      if (node.computed) return null;
      if (node.key.type === 'Identifier') return node.key.name;
      if (node.key.type === 'Literal' && typeof node.key.value === 'string') return node.key.value;
      return null;
    }

    function isNumericLiteral(node) {
      if (node.type === 'Literal') return typeof node.value === 'number';
      // `delay: -0.1` chega como negação unária, não como literal negativo.
      return node.type === 'UnaryExpression' && node.operator === '-'
        ? isNumericLiteral(node.argument)
        : false;
    }

    /**
     * A varredura de classes é sobre **todo literal de string**, e não só sobre
     * `className` — a mesma razão de `no-raw-visual-values`: as variantes vivem
     * em mapas de literais no topo do módulo, que é a convenção que
     * `no-dynamic-classname` obriga.
     */
    function inspectString(node, value) {
      for (const { messageId, pattern } of RAW_MOTION_PATTERNS) {
        const match = pattern.exec(value);
        if (match === null) continue;
        context.report({ node, messageId, data: { utility: match[0] } });
        return;
      }
    }

    return {
      Property(node) {
        const name = keyName(node);
        if (name === null) return;

        if (TIME_KEYS.has(name) && isNumericLiteral(node.value)) {
          context.report({
            node,
            messageId: 'rawTime',
            data: { key: name, value: context.sourceCode.getText(node.value) },
          });
          return;
        }

        if (name !== 'ease') return;
        /*
          As duas formas em que uma curva chega crua: os quatro pontos de
          controle de um Bézier, e o nome de uma das curvas embutidas da
          biblioteca. `ease: CURVA.through` é `MemberExpression` e não cai em
          nenhuma das duas.
        */
        const isBezier =
          node.value.type === 'ArrayExpression' && node.value.elements.every(isNumericLiteral);
        const isNamed = node.value.type === 'Literal' && typeof node.value.value === 'string';
        if (isBezier || isNamed) context.report({ node, messageId: 'rawEase' });
      },
      Literal(node) {
        if (typeof node.value !== 'string') return;
        if (node.parent?.type === 'ImportDeclaration') return;
        if (node.parent?.type === 'ExportNamedDeclaration') return;
        inspectString(node, node.value);
      },
      TemplateElement(node) {
        inspectString(node, node.value.raw);
      },
    };
  },
};

export default {
  rules: {
    'no-ui-text-literals': noUiTextLiterals,
    'no-dynamic-classname': noDynamicClassName,
    'no-raw-visual-values': noRawVisualValues,
    'no-raw-motion-values': noRawMotionValues,
    'no-icon-library-import': noIconLibraryImport,
    'no-motion-library-import': noMotionLibraryImport,
  },
};
