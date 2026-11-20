const colorLiteral =
  /(^|[\s,(])#[\da-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix)\(/i;
const arbitraryColor =
  /(?:^|[\s:])(?:bg|text|border(?:-[trblxy])?|fill|stroke|ring|outline|shadow)-\[(?:#|(?:rgba?|hsla?|oklch|oklab|hwb|lab|lch)\()/i;

function literalValue(node) {
  if (node?.type === 'Literal') return node.value;
  if (node?.type === 'JSXExpressionContainer')
    return literalValue(node.expression);
  return undefined;
}

export default {
  rules: {
    'no-visual-drift': {
      meta: {
        type: 'suggestion',
        schema: [],
        messages: {
          buttonType:
            'Declare type="button" ou type="submit" explicitamente para evitar submissões acidentais. Consulte docs/design-system/accessibility.md.',
          select:
            'Use CustomSelect. Consulte docs/design-system/components.md.',
          date: 'Use CustomDatePicker para data/mês. Consulte docs/design-system/components.md.',
          time: 'Use CustomTimePicker para horário. Consulte docs/design-system/components.md.',
          color:
            'Reutilize tokens de cor ou classes existentes; evite cores literais no JSX. Consulte docs/design-system/colors.md.',
        },
      },
      create(context) {
        function checkText(node, value) {
          if (typeof value !== 'string') return;
          const attribute = context.sourceCode
            .getAncestors(node)
            .findLast((ancestor) => ancestor.type === 'JSXAttribute');
          if (
            (attribute?.name.name === 'style' && colorLiteral.test(value)) ||
            (attribute?.name.name === 'className' && arbitraryColor.test(value))
          )
            context.report({ node, messageId: 'color' });
        }
        return {
          JSXOpeningElement(node) {
            if (node.name.type !== 'JSXIdentifier') return;
            if (
              node.name.name === 'button' &&
              !node.attributes.some(
                (attribute) =>
                  attribute.type === 'JSXAttribute' &&
                  attribute.name.name === 'type',
              )
            )
              context.report({ node, messageId: 'buttonType' });
            if (node.name.name === 'select')
              context.report({ node, messageId: 'select' });
            if (
              node.name.name === 'input' &&
              node.attributes.some(
                (attribute) =>
                  attribute.type === 'JSXAttribute' &&
                  attribute.name.name === 'type' &&
                  ['date', 'month'].includes(literalValue(attribute.value)),
              )
            )
              context.report({ node, messageId: 'date' });
            if (
              node.name.name === 'input' &&
              node.attributes.some(
                (attribute) =>
                  attribute.type === 'JSXAttribute' &&
                  attribute.name.name === 'type' &&
                  literalValue(attribute.value) === 'time',
              )
            )
              context.report({ node, messageId: 'time' });
          },
          Literal: (node) => checkText(node, node.value),
          TemplateElement: (node) => checkText(node, node.value.cooked),
        };
      },
    },
  },
};
