import { prepareEmailTableAttributes } from './ensureTableWidthAttributes';

/**
 * Preserve email layout when HTML is imported into Grapes.
 * - Promote cell/text align="…" to text-align in style (not on <table>/<tr> —
 *   those use align for Outlook table positioning, not text alignment)
 * - Collapse pretty-print newlines between tags and trim tag-adjacent whitespace
 * - Restore centering on fixed-width card tables
 */
export function normalizeImportedEmailHtml(html: string): string {
  let output = String(html || '');
  if (!output.trim()) return '';

  output = stripErroneousTableTextAlign(output);
  output = promoteAlignToTextAlign(output);
  output = collapseInterTagNewlines(output);
  output = trimWhitespaceInsideBlockTags(output);
  output = prepareEmailTableAttributes(output);
  return output.trim();
}

/**
 * Earlier imports wrongly copied table align → text-align. Remove that so
 * align="center" only positions the table (Outlook), not cell text.
 */
function stripErroneousTableTextAlign(html: string): string {
  return html.replace(/<table\b([^>]*)>/gi, (full, rawAttrs) => {
    const attrs = String(rawAttrs || '');
    if (!/\balign\s*=/i.test(attrs) || !/text-align\s*:/i.test(attrs)) return full;

    let next = attrs.replace(/text-align\s*:\s*[^;]+;?/gi, '');
    next = next.replace(/\bstyle\s*=\s*(["'])\s*;?\s*\1/gi, '');
    next = next.replace(/\bstyle\s*=\s*(["'])\s*;+\s*/gi, 'style=$1');
    return `<table${next}>`;
  });
}

function promoteAlignToTextAlign(html: string): string {
  // Intentionally exclude table/tr — align there centers/positions the table itself.
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

/** Remove newline-only gaps between tags; keep intentional single spaces. */
function collapseInterTagNewlines(html: string): string {
  return html.replace(/>[ \t]*[\r\n][ \t\r\n]*</g, '><');
}

/** Drop leading/trailing whitespace inside common block/inline wrappers. */
function trimWhitespaceInsideBlockTags(html: string): string {
  return html
    .replace(/(<(?:td|th|p|div|h[1-6]|li|span)\b[^>]*>)\s+/gi, '$1')
    .replace(/\s+(<\/(?:td|th|p|div|h[1-6]|li|span)>)/gi, '$1');
}
