/**
 * Email clients rely on the HTML width attribute on <table>.
 * Builder/CSS often only sets style="width:…", which fails validation.
 */
export function ensureTableWidthAttributes(html: string): string {
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

function readTableWidthAttr(attrs: string): string {
  const attrMatch = attrs.match(/\bwidth\s*=\s*(["']?)([^"'>\s]+)\1/i);
  if (attrMatch?.[2]) return attrMatch[2].trim();

  const styleMatch = attrs.match(/\bstyle\s*=\s*(["'])([\s\S]*?)\1/i);
  if (!styleMatch) return '';
  const widthMatch = String(styleMatch[2]).match(/(?:^|;)\s*width\s*:\s*([^;]+)/i);
  return widthMatch?.[1]?.trim() || '';
}

function readTableMaxWidthAttr(attrs: string): string {
  const styleMatch = attrs.match(/\bstyle\s*=\s*(["'])([\s\S]*?)\1/i);
  if (!styleMatch) return '';
  const maxMatch = String(styleMatch[2]).match(/(?:^|;)\s*max-width\s*:\s*([^;]+)/i);
  return maxMatch?.[1]?.trim() || '';
}

function isFixedEmailCardWidth(width: string): boolean {
  const value = String(width || '').trim().toLowerCase();
  if (!value || value === '100%' || value === 'auto') return false;
  if (/%$/.test(value)) return false;
  return /^\d+(\.\d+)?(px)?$/.test(value);
}

function hasMarginAuto(attrs: string): boolean {
  return /margin\s*:\s*(?:0\s+)?auto/i.test(attrs)
    || /margin-left\s*:\s*auto/i.test(attrs);
}

/** Fixed px width, or fluid width + max-width:600px card pattern. */
function isEmailCardTableAttrs(attrs: string): boolean {
  const width = readTableWidthAttr(attrs);
  if (isFixedEmailCardWidth(width)) return true;
  return isFixedEmailCardWidth(readTableMaxWidthAttr(attrs));
}

function prependInlineStyle(attrs: string, declaration: string): string {
  if (/\bstyle\s*=\s*"/i.test(attrs)) {
    return attrs.replace(/\bstyle\s*=\s*"/i, `style="${declaration}`);
  }
  if (/\bstyle\s*=\s*'/i.test(attrs)) {
    return attrs.replace(/\bstyle\s*=\s*'/i, `style='${declaration}`);
  }
  return ` style="${declaration}"${attrs}`;
}

function isFixedWidthTableOpenTag(tableOpenTag: string): boolean {
  const attrsMatch = String(tableOpenTag || '').match(/^<table\b([^>]*)>/i);
  if (!attrsMatch) return false;
  const attrs = attrsMatch[1];
  if (isFixedEmailCardWidth(readTableWidthAttr(attrs))) return true;
  return isFixedEmailCardWidth(readTableMaxWidthAttr(attrs));
}

function addAlignCenterToTdOpen(tdOpenTag: string): string {
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
 * Gmail strips margin:auto. Parent <td align="center"> is what actually centers a
 * fixed-width card inside a fluid width="100%" outer table.
 * Allows comments / wrapper divs between the td and the card table.
 */
export function ensureParentCellsCenterFixedTables(html: string): string {
  return String(html || '').replace(
    /<td(\b(?![^>]*\balign\s*=)[^>]*)>((?:(?!<\/td>|<td\b)[\s\S]){0,400})(<table\b[^>]*>)/gi,
    (full, tdAttrs, between, tableTag) => {
      if (!isFixedWidthTableOpenTag(tableTag)) return full;
      const tdOpen = addAlignCenterToTdOpen(`<td${tdAttrs}>`);
      return `${tdOpen}${between}${tableTag}`;
    }
  );
}


/**
 * Email cards need align="center" + margin:0 auto.
 * width:100% + max-width:600px stays left in Gmail without margin:auto —
 * even when align="center" is already set (do not skip that case).
 */
export function ensureEmailTableCentering(html: string): string {
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
 * Birthday-style templates put max-width:600px in a <style> rule, not on the
 * table attribute. Gmail centers those only when the rule also has margin:auto.
 */
export function ensureEmailCssCentersMaxWidthCards(css: string): string {
  return String(css || '').replace(/\{([^{}]*)\}/g, (block, body) => {
    const maxMatch = String(body).match(/(?:^|;)\s*max-width\s*:\s*([^;]+)/i);
    if (!maxMatch) return block;
    if (!isFixedEmailCardWidth(maxMatch[1].trim())) return block;
    if (hasMarginAuto(body)) return block;
    return `{margin:0 auto;${body}}`;
  });
}

const EMAIL_CENTER_WRAPPER_ATTR = 'data-arivu-email-center';

/** True when the root table is already a proper 100% shell with a centered first cell. */
function hasRootCenteringShell(html: string): boolean {
  const source = String(html || '').trim();
  const tableMatch = source.match(/^<table\b([^>]*)>/i);
  if (!tableMatch) return false;

  const width = readTableWidthAttr(tableMatch[1]);
  const style = tableMatch[1];
  const isFluid =
    String(width).trim() === '100%'
    || /(?:^|;)\s*width\s*:\s*100%/i.test(style);
  if (!isFluid) return false;

  const after = source.slice(tableMatch[0].length);
  const firstTd = after.match(/^(?:\s*<tbody\b[^>]*>)?\s*<tr\b[^>]*>\s*<td\b([^>]*)>/i);
  if (!firstTd) return false;
  return /\balign\s*=\s*["']?center/i.test(firstTd[1]);
}

/**
 * Gmail-reliable centering: full-width outer table + td align="center" around the card.
 * margin:auto alone is not enough in many clients.
 */
export function wrapEmailContentInCenteringTable(html: string): string {
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

/** Width attrs + centering for fixed-width email layout tables. */
export function prepareEmailTableAttributes(html: string): string {
  let output = ensureEmailTableCentering(ensureTableWidthAttributes(html));
  output = ensureParentCellsCenterFixedTables(output);
  output = wrapEmailContentInCenteringTable(output);
  return ensureParentCellsCenterFixedTables(output);
}
