import DOMPurify from 'dompurify';

export interface PreviewCssSplit {
  css: string;
  html: string;
}

/**
 * Sanitize email HTML for in-app preview (no iframe / no script execution).
 */
export function sanitizeEmailPreviewHtml(html: string): string {
  let source = String(html || '').trim();
  if (!source) return '';

  source = source.replace(/<script\b[\s\S]*?<\/script>/gi, '');
  source = source.replace(/<script\b[^>]*\/?>/gi, '');
  source = source.replace(/<noscript\b[\s\S]*?<\/noscript>/gi, '');

  return DOMPurify.sanitize(source, {
    FORBID_TAGS: [
      'script',
      'iframe',
      'object',
      'embed',
      'applet',
      'form',
      'base',
      'meta',
      'link'
    ],
    ALLOW_UNKNOWN_PROTOCOLS: false
  });
}

/**
 * Extract inline <style> blocks from HTML fragments for preview injection.
 */
export function extractPreviewCss(html: string, extraCss = ''): PreviewCssSplit {
  const blocks: string[] = [];
  const withoutStyle = String(html || '').replace(
    /<style\b[^>]*>([\s\S]*?)<\/style>/gi,
    (_match, css) => {
      if (css?.trim()) blocks.push(String(css).trim());
      return '';
    }
  );

  const css = [...blocks, String(extraCss || '').trim()].filter(Boolean).join('\n\n');
  return { css, html: withoutStyle };
}

export interface EmailPreviewDocumentOptions {
  html: string;
  css?: string;
  viewportWidth?: number;
  colorScheme?: 'light' | 'dark';
}

/** Build a sandboxed iframe document so @media rules use the preview width (320 / 600). */
export function buildEmailPreviewDocument(options: EmailPreviewDocumentOptions): string {
  const split = extractPreviewCss(options.html, options.css || '');
  const bodyHtml = sanitizeEmailPreviewHtml(split.html);
  const viewportWidth = options.viewportWidth === 320 ? 320 : 600;
  const colorScheme = options.colorScheme === 'dark' ? 'dark' : 'light';
  const bodyBackground = colorScheme === 'dark' ? '#1f2937' : '#ffffff';
  const shellBackground = colorScheme === 'dark' ? '#111827' : '#f3f4f6';
  const textColor = colorScheme === 'dark' ? '#f9fafb' : '#111827';

  const helperCss = `
    html, body {
      margin: 0;
      padding: 0;
      background: ${shellBackground};
      color: ${textColor};
    }
    .email-preview-body {
      width: 100%;
      max-width: ${viewportWidth}px;
      margin: 0 auto;
      background: ${bodyBackground};
      color: inherit;
    }
    .email-preview-body img {
      max-width: 100%;
      height: auto;
    }
    .email-preview-body table {
      max-width: 100%;
    }
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=${viewportWidth}, initial-scale=1" />
  <style>${helperCss}\n${split.css}</style>
</head>
<body>
  <div class="email-preview-body">${bodyHtml}</div>
</body>
</html>`;
}
