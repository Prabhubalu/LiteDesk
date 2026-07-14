'use strict';

/**
 * Preserve email layout when HTML is imported.
 * Promote cell/text align → text-align (not table/tr) and collapse pretty-print whitespace.
 *
 * @param {string} html
 * @returns {string}
 */
function normalizeImportedEmailHtml(html) {
  let output = String(html || '');
  if (!output.trim()) return '';

  output = stripErroneousTableTextAlign(output);
  output = promoteAlignToTextAlign(output);
  output = collapseInterTagNewlines(output);
  output = trimWhitespaceInsideBlockTags(output);
  output = ensureEmailTableCentering(ensureTableWidthAttributes(output));
  output = ensureParentCellsCenterFixedTables(output);
  output = wrapEmailContentInCenteringTable(output);
  // Re-apply after wrap so nested cards inside fluid roots still get parent align.
  output = ensureParentCellsCenterFixedTables(output);
  return output.trim();
}

/**
 * @param {string} html
 * @returns {string}
 */
function ensureTableWidthAttributes(html) {
  return String(html || '').replace(/<table\b([^>]*)>/gi, (full, rawAttrs) => {
    const attrs = String(rawAttrs || '');
    if (/\bwidth\s*=/i.test(attrs)) return full;

    let width = '100%';
    const styleMatch = attrs.match(/\bstyle\s*=\s*(["'])([\s\S]*?)\1/i);
    if (styleMatch) {
      const widthMatch = String(styleMatch[2]).match(/(?:^|;)\s*width\s*:\s*([^;]+)/i);
      if (widthMatch?.[1]) {
        const parsed = widthMatch[1].trim();
        if (parsed) {
          width = /^\d+(\.\d+)?px$/i.test(parsed)
            ? parsed.replace(/px$/i, '')
            : parsed;
        }
      }
    }

    return `<table width="${width}"${attrs}>`;
  });
}

/**
 * @param {string} attrs
 * @returns {string}
 */
function readTableWidthAttr(attrs) {
  const attrMatch = attrs.match(/\bwidth\s*=\s*(["']?)([^"'>\s]+)\1/i);
  if (attrMatch?.[2]) return attrMatch[2].trim();

  const styleMatch = attrs.match(/\bstyle\s*=\s*(["'])([\s\S]*?)\1/i);
  if (!styleMatch) return '';
  const widthMatch = String(styleMatch[2]).match(/(?:^|;)\s*width\s*:\s*([^;]+)/i);
  return widthMatch?.[1]?.trim() || '';
}

/**
 * @param {string} width
 * @returns {boolean}
 */
function isFixedEmailCardWidth(width) {
  const value = String(width || '').trim().toLowerCase();
  if (!value || value === '100%' || value === 'auto') return false;
  if (/%$/.test(value)) return false;
  return /^\d+(\.\d+)?(px)?$/.test(value);
}

/**
 * @param {string} attrs
 * @returns {string}
 */
function readTableMaxWidthAttr(attrs) {
  const styleMatch = attrs.match(/\bstyle\s*=\s*(["'])([\s\S]*?)\1/i);
  if (!styleMatch) return '';
  const maxMatch = String(styleMatch[2]).match(/(?:^|;)\s*max-width\s*:\s*([^;]+)/i);
  return maxMatch?.[1]?.trim() || '';
}

/**
 * @param {string} attrs
 * @returns {boolean}
 */
function hasMarginAuto(attrs) {
  return /margin\s*:\s*(?:0\s+)?auto/i.test(attrs)
    || /margin-left\s*:\s*auto/i.test(attrs);
}

/**
 * @param {string} attrs
 * @returns {boolean}
 */
function isEmailCardTableAttrs(attrs) {
  const width = readTableWidthAttr(attrs);
  if (isFixedEmailCardWidth(width)) return true;
  return isFixedEmailCardWidth(readTableMaxWidthAttr(attrs));
}

/**
 * @param {string} attrs
 * @param {string} declaration
 * @returns {string}
 */
function prependInlineStyle(attrs, declaration) {
  if (/\bstyle\s*=\s*"/i.test(attrs)) {
    return attrs.replace(/\bstyle\s*=\s*"/i, `style="${declaration}`);
  }
  if (/\bstyle\s*=\s*'/i.test(attrs)) {
    return attrs.replace(/\bstyle\s*=\s*'/i, `style='${declaration}`);
  }
  return ` style="${declaration}"${attrs}`;
}

/**
 * @param {string} tableOpenTag
 * @returns {boolean}
 */
function isFixedWidthTableOpenTag(tableOpenTag) {
  const attrsMatch = String(tableOpenTag || '').match(/^<table\b([^>]*)>/i);
  if (!attrsMatch) return false;
  const attrs = attrsMatch[1];
  if (isFixedEmailCardWidth(readTableWidthAttr(attrs))) return true;
  return isFixedEmailCardWidth(readTableMaxWidthAttr(attrs));
}

/**
 * @param {string} tdOpenTag
 * @returns {string}
 */
function addAlignCenterToTdOpen(tdOpenTag) {
  const match = String(tdOpenTag || '').match(/^<td(\b[^>]*)>/i);
  if (!match) return tdOpenTag;
  let attrs = match[1];
  if (/\balign\s*=/i.test(attrs)) return tdOpenTag;

  if (/\bstyle\s*=\s*"/i.test(attrs)) {
    attrs = attrs.replace(/\bstyle\s*=\s*"/i, 'style="text-align:center;');
  } else if (/\bstyle\s*=\s*'/i.test(attrs)) {
    attrs = attrs.replace(/\bstyle\s*=\s*'/i, "style='text-align:center;");
  } else {
    attrs = ` style="text-align:center;"${attrs}`;
  }
  return `<td align="center"${attrs}>`;
}

/**
 * Gmail strips margin:auto — parent td align=center centers fixed cards.
 * Allows comments / wrapper divs between the td and the card table.
 * @param {string} html
 * @returns {string}
 */
function ensureParentCellsCenterFixedTables(html) {
  return String(html || '').replace(
    /<td(\b(?![^>]*\balign\s*=)[^>]*)>((?:(?!<\/td>|<td\b)[\s\S]){0,400})(<table\b[^>]*>)/gi,
    (full, tdAttrs, between, tableTag) => {
      if (!isFixedWidthTableOpenTag(tableTag)) return full;
      return `${addAlignCenterToTdOpen(`<td${tdAttrs}>`)}${between}${tableTag}`;
    }
  );
}

/**
 * Cards need align="center" + margin:0 auto. Do not skip when align is already set —
 * width:100% + max-width:600px stays left in Gmail without margin:auto.
 * @param {string} html
 * @returns {string}
 */
function ensureEmailTableCentering(html) {
  return String(html || '').replace(/<table\b([^>]*)>/gi, (full, rawAttrs) => {
    const attrs = String(rawAttrs || '');
    if (!isEmailCardTableAttrs(attrs)) return full;

    let next = attrs;
    const needsMargin = !hasMarginAuto(next);
    const needsAlign = !/\balign\s*=/i.test(next);
    if (!needsMargin && !needsAlign) return full;

    if (needsMargin) {
      next = prependInlineStyle(next, 'margin:0 auto;');
    }
    return needsAlign ? `<table align="center"${next}>` : `<table${next}>`;
  });
}

/**
 * Templates often put max-width:600px in a stylesheet rule (not inline).
 * Gmail centers those only when the same rule has margin:auto.
 * @param {string} css
 * @returns {string}
 */
function ensureEmailCssCentersMaxWidthCards(css) {
  return String(css || '').replace(/\{([^{}]*)\}/g, (block, body) => {
    const maxMatch = String(body).match(/(?:^|;)\s*max-width\s*:\s*([^;]+)/i);
    if (!maxMatch) return block;
    if (!isFixedEmailCardWidth(maxMatch[1].trim())) return block;
    if (hasMarginAuto(body)) return block;
    return `{margin:0 auto;${body}}`;
  });
}

const EMAIL_CENTER_WRAPPER_ATTR = 'data-arivu-email-center';

/**
 * @param {string} html
 * @returns {boolean}
 */
function hasRootCenteringShell(html) {
  const source = String(html || '').trim();
  const tableMatch = source.match(/^<table\b([^>]*)>/i);
  if (!tableMatch) return false;

  const width = readTableWidthAttr(tableMatch[1]);
  const isFluid =
    String(width).trim() === '100%'
    || /(?:^|;)\s*width\s*:\s*100%/i.test(tableMatch[1]);
  if (!isFluid) return false;

  const after = source.slice(tableMatch[0].length);
  const firstTd = after.match(/^(?:\s*<tbody\b[^>]*>)?\s*<tr\b[^>]*>\s*<td\b([^>]*)>/i);
  if (!firstTd) return false;
  return /\balign\s*=\s*["']?center/i.test(firstTd[1]);
}

/**
 * Gmail-reliable centering shell around the email body.
 * @param {string} html
 * @returns {string}
 */
function wrapEmailContentInCenteringTable(html) {
  const source = String(html || '').trim();
  if (!source) return source;
  if (new RegExp(`\\b${EMAIL_CENTER_WRAPPER_ATTR}\\s*=`, 'i').test(source)) {
    return source;
  }
  if (hasRootCenteringShell(source)) {
    return source;
  }

  return (
    `<table ${EMAIL_CENTER_WRAPPER_ATTR}="true" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border-collapse:collapse;margin:0;padding:0;">`
    + '<tr>'
    + '<td align="center" valign="top" style="margin:0;padding:0;">'
    + source
    + '</td></tr></table>'
  );
}

/**
 * @param {string} html
 * @returns {string}
 */
function stripErroneousTableTextAlign(html) {
  return html.replace(/<table\b([^>]*)>/gi, (full, rawAttrs) => {
    const attrs = String(rawAttrs || '');
    if (!/\balign\s*=/i.test(attrs) || !/text-align\s*:/i.test(attrs)) return full;

    let next = attrs.replace(/text-align\s*:\s*[^;]+;?/gi, '');
    next = next.replace(/\bstyle\s*=\s*(["'])\s*;?\s*\1/gi, '');
    next = next.replace(/\bstyle\s*=\s*(["'])\s*;+\s*/gi, 'style=$1');
    return `<table${next}>`;
  });
}

/**
 * @param {string} html
 * @returns {string}
 */
function promoteAlignToTextAlign(html) {
  // Exclude table/tr — align there positions the table for Outlook, not cell text.
  return html.replace(
    /<(td|th|div|p|h[1-6]|span)\b([^>]*?)>/gi,
    (full, tag, rawAttrs) => {
      const attrs = String(rawAttrs || '');
      const alignMatch = attrs.match(/\balign\s*=\s*(["']?)(left|center|right|justify)\1/i);
      if (!alignMatch) return full;

      const align = alignMatch[2].toLowerCase();
      if (/text-align\s*:/i.test(attrs)) return full;

      if (/\bstyle\s*=\s*"/i.test(attrs)) {
        return `<${tag}${attrs.replace(/\bstyle\s*=\s*"/i, `style="text-align:${align};`)}>`;
      }
      if (/\bstyle\s*=\s*'/i.test(attrs)) {
        return `<${tag}${attrs.replace(/\bstyle\s*=\s*'/i, `style='text-align:${align};`)}>`;
      }
      return `<${tag} style="text-align:${align};"${attrs}>`;
    }
  );
}

/**
 * @param {string} html
 * @returns {string}
 */
function collapseInterTagNewlines(html) {
  return html.replace(/>[ \t]*[\r\n][ \t\r\n]*</g, '><');
}

/**
 * @param {string} html
 * @returns {string}
 */
function trimWhitespaceInsideBlockTags(html) {
  return html
    .replace(/(<(?:td|th|p|div|h[1-6]|li|span)\b[^>]*>)\s+/gi, '$1')
    .replace(/\s+(<\/(?:td|th|p|div|h[1-6]|li|span)>)/gi, '$1');
}

/**
 * Extract inner HTML suitable for GrapesJS canvas (body content only).
 *
 * @param {string} html
 * @returns {string}
 */
function extractEmailBodyHtml(html) {
  let source = String(html || '').trim();
  if (!source) return '';

  const bodyMatch = source.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    return normalizeImportedEmailHtml(bodyMatch[1]);
  }

  source = source.replace(/^<!DOCTYPE[^>]*>/i, '');
  source = source.replace(/<\/?html[^>]*>/gi, '');
  source = source.replace(/<head[\s\S]*?<\/head>/gi, '');
  source = source.replace(/<\/?body[^>]*>/gi, '');

  return normalizeImportedEmailHtml(source);
}

/**
 * @param {string} html
 * @returns {boolean}
 */
function isFullHtmlDocument(html) {
  const source = String(html || '').trim();
  return /^<!DOCTYPE/i.test(source)
    || /<html[\s>]/i.test(source)
    || /<head[\s>]/i.test(source)
    || /<body[\s>]/i.test(source);
}

module.exports = {
  extractEmailBodyHtml,
  isFullHtmlDocument,
  normalizeImportedEmailHtml,
  ensureEmailCssCentersMaxWidthCards
};
