'use strict';

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeOrigin(origin) {
  return String(origin || '').replace(/\/$/, '');
}

function buildStaticPageHtml({
  bodyHtml = '',
  meta = {},
  apiOrigin = '',
  siteOrigin = '',
  canonicalPath = '',
} = {}) {
  const title = String(meta.title || 'Help Center').trim();
  const description = String(meta.description || '').trim();
  const robots = String(meta.robots || '').trim();
  const ogImageUrl = String(meta.ogImageUrl || '').trim();
  let canonical = String(meta.canonical || '').trim();
  const origin = normalizeOrigin(siteOrigin);
  const normalizedPath = String(canonicalPath || '').replace(/\/index\.html$/i, '/');
  if (!canonical && origin && normalizedPath) {
    const href = normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
    canonical = `${origin}${href}`;
  }

  const appOrigin = normalizeOrigin(apiOrigin);
  const cssHref = appOrigin ? `${appOrigin}/embed/headless-blocks.css` : '/embed/headless-blocks.css';
  const jsHref = appOrigin ? `${appOrigin}/embed/headless-blocks.js` : '/embed/headless-blocks.js';

  const metaTags = [
    description ? `<meta name="description" content="${escapeHtml(description)}" />` : '',
    robots ? `<meta name="robots" content="${escapeHtml(robots)}" />` : '',
    canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}" />` : '',
    title ? `<meta property="og:title" content="${escapeHtml(title)}" />` : '',
    description ? `<meta property="og:description" content="${escapeHtml(description)}" />` : '',
    ogImageUrl ? `<meta property="og:image" content="${escapeHtml(ogImageUrl)}" />` : '',
    '<meta property="og:type" content="article" />',
  ].filter(Boolean).join('\n  ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  ${metaTags}
  <link rel="stylesheet" href="${escapeHtml(cssHref)}" />
</head>
<body>
  <div class="ld-help-root ld-help-embed">
${bodyHtml}
  </div>
  <script src="${escapeHtml(jsHref)}"></script>
</body>
</html>
`;
}

module.exports = {
  buildStaticPageHtml,
  escapeHtml,
};
