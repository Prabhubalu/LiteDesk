import JSZip from 'jszip';

export type EmbedStarterKitVariant = 'help' | 'blog';

export type EmbedStarterKitOptions = {
  apiOrigin: string;
  orgKey: string;
  pathPrefix: string;
  siteDomain?: string;
  title?: string;
  /** Defaults to help center embed. */
  variant?: EmbedStarterKitVariant;
};

function resolveVariant(options: EmbedStarterKitOptions): EmbedStarterKitVariant {
  return options.variant === 'blog' ? 'blog' : 'help';
}

function normalizePathPrefix(prefix: string, variant: EmbedStarterKitVariant = 'help'): string {
  let value = String(prefix || (variant === 'blog' ? '/blog/' : '/help/')).trim();
  if (!value.startsWith('/')) value = `/${value}`;
  if (!value.endsWith('/')) value = `${value}/`;
  return value;
}

function pathPrefixToSlug(prefix: string): string {
  return normalizePathPrefix(prefix).replace(/^\/+|\/+$/g, '') || 'help';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildIndexHtml(options: EmbedStarterKitOptions): string {
  const variant = resolveVariant(options);
  const pathPrefix = normalizePathPrefix(options.pathPrefix, variant);
  const isBlog = variant === 'blog';
  const title = escapeHtml(options.title || (isBlog ? 'Blog' : 'Help Center'));
  const origin = options.apiOrigin.replace(/\/$/, '');
  const orgKey = escapeHtml(options.orgKey);
  const targetId = isBlog ? 'arivu-blog' : 'arivu-help';
  const scriptSrc = isBlog ? `${origin}/embed/headless-blog.js` : `${origin}/embed/headless-help.js`;
  const rootClass = isBlog ? 'ld-blog-root ld-blog-embed' : 'ld-help-root ld-help-embed';
  const feedbackAttr = isBlog ? '' : '\n    data-title="' + title + '"\n    data-show-feedback-footer="true"';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <link rel="preload" href="${origin}/embed/headless-blocks.css" as="style" />
  <link rel="stylesheet" href="${origin}/embed/headless-blocks.css" />
</head>
<body>
  <!-- Paste your site header / navigation above -->
  <header id="site-header" data-arivu-site-chrome="header"></header>

  <div class="${rootClass}">
    <main id="${targetId}"></main>
  </div>

  <!-- Paste your site footer below -->
  <footer id="site-footer" data-arivu-site-chrome="footer"></footer>

  <script
    src="${scriptSrc}"
    data-api-origin="${origin}"
    data-org="${orgKey}"
    data-target="#${targetId}"
    data-path-prefix="${pathPrefix}"
    data-link-prefix="${pathPrefix}"${feedbackAttr}
  ></script>
</body>
</html>
`;
}

function buildRedirects(pathSlug: string): string {
  return `/${pathSlug}/*  /${pathSlug}/index.html  200\n`;
}

function buildVercelJson(pathSlug: string): string {
  return `${JSON.stringify({
    rewrites: [
      { source: `/${pathSlug}/:path*`, destination: `/${pathSlug}/index.html` },
    ],
  }, null, 2)}\n`;
}

function buildHtaccess(pathSlug: string): string {
  return `<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^${pathSlug}(/.*)?$ /${pathSlug}/index.html [L]
</IfModule>
`;
}

function buildReadme(options: EmbedStarterKitOptions): string {
  const variant = resolveVariant(options);
  const pathPrefix = normalizePathPrefix(options.pathPrefix, variant);
  const domain = String(options.siteDomain || 'www.example.com').trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const siteUrl = `https://${domain}${pathPrefix}`;
  const isBlog = variant === 'blog';
  const product = isBlog ? 'Blog' : 'Help Center';
  const settingsPath = isBlog ? 'Blog' : 'Articles';
  const pageDesc = isBlog
    ? 'blog (list at path prefix, posts at /{slug})'
    : 'help center (home, categories, articles)';

  return `Arivu ${product} — Deploy Kit
================================

1. Upload this folder to your host (Netlify, Vercel, cPanel, S3, etc.)
2. In Arivu → Settings → Add-ons → ${settingsPath}, save website domain: ${domain}
3. Open ${siteUrl}

Included files
--------------
- ${pathPrefixToSlug(pathPrefix)}/index.html  — ${pageDesc}
- _redirects            — Netlify routing
- vercel.json           — Vercel routing
- .htaccess             — Apache / cPanel routing

No build step or npm install required.
`;
}

export async function buildEmbedStarterKitZip(options: EmbedStarterKitOptions): Promise<Blob> {
  const variant = resolveVariant(options);
  const pathSlug = pathPrefixToSlug(normalizePathPrefix(options.pathPrefix, variant));
  const zip = new JSZip();
  zip.file(`${pathSlug}/index.html`, buildIndexHtml(options));
  zip.file('_redirects', buildRedirects(pathSlug));
  zip.file('vercel.json', buildVercelJson(pathSlug));
  zip.file('.htaccess', buildHtaccess(pathSlug));
  zip.file('README.txt', buildReadme(options));
  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
