import { html as beautifyHtml, css as beautifyCss } from 'js-beautify';

export interface FormatHtmlDocumentOptions {
  indentSize?: number;
}

/** Strip GrapesJS outer body/html wrappers before wrapping in a full document. */
export function stripGrapesDocumentWrapper(html: string): string {
  const source = String(html || '').trim();
  if (!source) return '';

  if (typeof DOMParser !== 'undefined' && (/<html[\s>]/i.test(source) || /<body[\s>]/i.test(source))) {
    try {
      const unwrapped = unwrapRepeatedBodyWrappers(source);
      if (unwrapped) return unwrapped;
    } catch {
      // fall through to regex
    }
  }

  return stripBodyTagsWithRegex(source);
}

function unwrapRepeatedBodyWrappers(source: string): string {
  let content = source;
  for (let pass = 0; pass < 8; pass += 1) {
    const doc = new DOMParser().parseFromString(content, 'text/html');
    const inner = doc.body?.innerHTML?.trim();
    if (!inner || inner === content) break;
    content = inner;
    if (!/<body[\s>]/i.test(content)) return content;
  }
  return content;
}

function stripBodyTagsWithRegex(source: string): string {
  let content = source;
  for (let pass = 0; pass < 8; pass += 1) {
    const bodyMatch = content.match(/^<body[^>]*>([\s\S]*)<\/body>$/i);
    if (!bodyMatch?.[1]) break;
    content = bodyMatch[1].trim();
  }
  return content;
}

function formatStyleBlock(styleBlock: string): string {
  const match = styleBlock.match(/^<style([^>]*)>([\s\S]*)<\/style>$/i);
  if (!match) return styleBlock;

  const attrs = match[1] || '';
  const css = beautifyCss(String(match[2] || '').trim(), {
    indent_size: 2,
    indent_char: ' ',
    max_preserve_newlines: 1
  });

  return `<style${attrs}>\n${css}\n</style>`;
}

/** Pretty-print a full HTML document for display, copy, and download. */
export function formatHtmlDocument(
  html: string,
  options: FormatHtmlDocumentOptions = {}
): string {
  const source = String(html || '').trim();
  if (!source) return '';

  const indentSize = options.indentSize ?? 2;

  const withFormattedStyles = source.replace(
    /<style([^>]*)>([\s\S]*?)<\/style>/gi,
    (_, attrs: string, css: string) => formatStyleBlock(`<style${attrs}>${css}</style>`)
  );

  return beautifyHtml(withFormattedStyles, {
    indent_size: indentSize,
    indent_char: ' ',
    indent_inner_html: true,
    indent_scripts: 'keep',
    wrap_line_length: 0,
    wrap_attributes: 'auto',
    preserve_newlines: false,
    max_preserve_newlines: 1,
    unformatted: ['pre', 'code'],
    content_unformatted: ['pre', 'textarea'],
    extra_liners: ['head', 'body', '/html']
  }).trim();
}
