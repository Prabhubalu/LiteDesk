'use strict';

const { CONTENT_COMPONENT_TYPES } = require('../../../constants/contentComponentRegistry');
const { getBindingText } = require('./componentResolver');

function firstString(...values) {
  for (const value of values) {
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return '';
}

function resolveListItems(bindings = {}) {
  const raw = bindings.items;
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item ?? '').trim()).filter(Boolean);
  }
  if (typeof raw === 'string' && raw.trim()) {
    return raw.split('\n').map((line) => line.trim()).filter(Boolean);
  }
  return [];
}

function resolvePlaceholderHtml(component, bindings = {}) {
  return firstString(
    component.resolvedText,
    bindings.text,
    bindings.html,
    bindings.label,
    bindings.value,
    bindings.expression,
    bindings.format,
    bindings.path,
    bindings.name,
    bindings.condition,
    bindings.collection,
    bindings.relation,
    getBindingText(component),
    component.name
  );
}

/**
 * Build a layout-tree leaf block for a resolved component node.
 * @param {object} component
 * @param {string} styleCss
 * @returns {object|null}
 */
function buildComponentLeafBlock(component, styleCss = '') {
  if (!component || typeof component !== 'object') return null;

  const type = String(component.type || '').trim();
  const bindings = component.bindings || {};
  const style = styleCss || '';

  switch (type) {
    case CONTENT_COMPONENT_TYPES.LINK:
      return {
        type: 'Link',
        html: firstString(bindings.text, component.name, 'Link'),
        href: firstString(bindings.href, '#'),
        style
      };
    case CONTENT_COMPONENT_TYPES.BUTTON:
      return {
        type: 'Link',
        html: firstString(bindings.text, component.name, 'Button'),
        href: firstString(bindings.href, '#'),
        style: [style, 'display:inline-block;padding:8px 16px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:6px;'].filter(Boolean).join(';')
      };
    case CONTENT_COMPONENT_TYPES.LIST: {
      const items = resolveListItems(bindings);
      return {
        type: 'List',
        ordered: Boolean(bindings.ordered),
        items: items.length ? items : ['Item 1', 'Item 2'],
        style
      };
    }
    case CONTENT_COMPONENT_TYPES.VARIABLE:
      return {
        type: 'Text',
        tag: 'span',
        html: firstString(
          component.resolvedText,
          bindings.defaultValue,
          bindings.name ? `{{${bindings.name}}}` : '',
          component.name,
          'Variable'
        ),
        style: [style, 'font-family:monospace;'].filter(Boolean).join(';')
      };
    case CONTENT_COMPONENT_TYPES.FORMULA:
      return {
        type: 'Text',
        tag: 'span',
        html: firstString(bindings.expression, component.name, 'Formula'),
        style: [style, 'font-family:monospace;'].filter(Boolean).join(';')
      };
    case CONTENT_COMPONENT_TYPES.PAGE_NUMBER:
      return {
        type: 'Text',
        tag: 'span',
        html: firstString(bindings.format, 'Page 1'),
        style
      };
    case CONTENT_COMPONENT_TYPES.WATERMARK:
      return {
        type: 'WatermarkText',
        html: firstString(bindings.text, 'DRAFT'),
        style
      };
    case CONTENT_COMPONENT_TYPES.HTML:
    case CONTENT_COMPONENT_TYPES.RICH_TEXT:
      return {
        type: 'Paragraph',
        tag: type === CONTENT_COMPONENT_TYPES.HTML ? 'div' : 'p',
        html: firstString(bindings.html, bindings.text, getBindingText(component), component.name),
        style
      };
    case CONTENT_COMPONENT_TYPES.ICON:
      return {
        type: 'ComponentPlaceholder',
        label: component.name || 'Icon',
        html: firstString(bindings.name, 'star'),
        style
      };
    case CONTENT_COMPONENT_TYPES.QR_CODE:
      return {
        type: 'ComponentPlaceholder',
        label: component.name || 'QR Code',
        html: firstString(bindings.value, '{{Record.id}}'),
        style
      };
    case CONTENT_COMPONENT_TYPES.BARCODE:
      return {
        type: 'ComponentPlaceholder',
        label: component.name || 'Barcode',
        html: firstString(bindings.value, bindings.format, 'code128'),
        style
      };
    case CONTENT_COMPONENT_TYPES.SIGNATURE:
      return {
        type: 'ComponentPlaceholder',
        label: firstString(bindings.label, component.name, 'Signature'),
        html: firstString(bindings.signerName, '________________________'),
        style
      };
    case CONTENT_COMPONENT_TYPES.RELATED_RECORDS:
      return {
        type: 'ComponentPlaceholder',
        label: component.name || 'Related Records',
        html: firstString(bindings.relation, bindings.moduleScope, 'lines'),
        style
      };
    case CONTENT_COMPONENT_TYPES.TOTALS:
      return {
        type: 'ComponentPlaceholder',
        label: component.name || 'Totals',
        html: [
          bindings.showSubtotal !== false ? 'Subtotal' : null,
          bindings.showTax !== false ? 'Tax' : null,
          bindings.showGrandTotal !== false ? 'Grand Total' : null
        ].filter(Boolean).join(' · ') || 'Subtotal · Tax · Grand Total',
        style
      };
    case CONTENT_COMPONENT_TYPES.TAX_SUMMARY:
      return {
        type: 'ComponentPlaceholder',
        label: component.name || 'Tax Summary',
        html: bindings.showTaxBreakdown !== false ? 'Tax breakdown' : 'Tax summary',
        style
      };
    case CONTENT_COMPONENT_TYPES.ADDRESS_BLOCK:
      return {
        type: 'ComponentPlaceholder',
        label: component.name || 'Address Block',
        html: firstString(bindings.path, 'Organization'),
        style
      };
    case CONTENT_COMPONENT_TYPES.CONTACT_CARD:
      return {
        type: 'ComponentPlaceholder',
        label: component.name || 'Contact Card',
        html: firstString(bindings.path, 'People'),
        style
      };
    case CONTENT_COMPONENT_TYPES.ORGANIZATION_BLOCK:
      return {
        type: 'ComponentPlaceholder',
        label: component.name || 'Organization Block',
        html: firstString(bindings.path, 'Organization'),
        style
      };
    case CONTENT_COMPONENT_TYPES.SOCIAL_ICONS: {
      const networks = Array.isArray(bindings.networks) ? bindings.networks : [];
      return {
        type: 'ComponentPlaceholder',
        label: component.name || 'Social Icons',
        html: networks.length ? networks.join(', ') : 'linkedin, twitter',
        style
      };
    }
    default:
      if (type && type !== CONTENT_COMPONENT_TYPES.PAGE) {
        const html = resolvePlaceholderHtml(component, bindings);
        if (html) {
          return {
            type: 'ComponentPlaceholder',
            label: component.name || type,
            html,
            style
          };
        }
      }
      return null;
  }
}

module.exports = {
  buildComponentLeafBlock,
  resolveListItems,
  resolvePlaceholderHtml
};
