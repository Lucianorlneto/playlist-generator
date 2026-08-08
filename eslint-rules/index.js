/**
 * Regras de lint locais que protegem duas decisões do plano.
 *
 * - `no-ui-text-literals`: FR-048 exige que todo texto de interface viva em
 *   `src/i18n/`. Um literal escapado no JSX passa despercebido em revisão.
 * - `no-dynamic-classname`: o scanner do Tailwind lê o código como texto e não
 *   resolve expressões. Um `className` montado por concatenação simplesmente não
 *   é emitido no CSS — falha que não aparece em desenvolvimento e só se manifesta
 *   no build (research §14).
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
];

const noRawVisualValues = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Todo valor visual vem da camada de tokens; valor avulso no componente é proibido (FR-040, FR-046, FR-050, SC-009).',
    },
    schema: [],
    messages: {
      arbitrary:
        'Valor visual arbitrário em "{{utility}}". Cor, espaçamento e raio vêm da camada de tokens — use um degrau da escala ou declare um token em src/styles/ (FR-040, SC-009).',
      palette:
        'Escala crua da paleta do Tailwind em "{{utility}}". A paleta padrão foi removida do tema justamente para que a cor venha de um nome semântico (FR-004, FR-040).',
      accentMisuse:
        'O âmbar de "{{utility}}" é preenchimento, não tinta: em cheia saturação ele dá 2,0:1 como texto ou borda. Para texto, link, borda e foco o token é `--accent-text` (FR-046, FR-050).',
    },
  },
  create(context) {
    /**
     * A varredura é sobre **todo literal de string do arquivo**, não só sobre
     * `className`. As variantes de `Button` e de `StatusBadge` vivem em mapas de
     * literais no topo do módulo — que é a convenção que `no-dynamic-classname`
     * obriga —, e uma regra que só olhasse o JSX deixaria de fora exatamente os
     * arquivos onde a cor é decidida.
     */
    function inspect(node, value) {
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

export default {
  rules: {
    'no-ui-text-literals': noUiTextLiterals,
    'no-dynamic-classname': noDynamicClassName,
    'no-raw-visual-values': noRawVisualValues,
  },
};
