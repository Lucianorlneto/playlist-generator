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

export default {
  rules: {
    'no-ui-text-literals': noUiTextLiterals,
    'no-dynamic-classname': noDynamicClassName,
  },
};
