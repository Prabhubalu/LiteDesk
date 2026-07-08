import JSZip from 'jszip';

export type EmbedStarterKitOptions = {
  apiOrigin: string;
  orgKey: string;
  pathPrefix: string;
  siteDomain?: string;
  title?: string;
};

function normalizePathPrefix(prefix: string): string {
  let value = String(prefix || '/help/').trim();
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
  const pathPrefix = normalizePathPrefix(options.pathPrefix);
  const title = escapeHtml(options.title || 'Help Center');
  const origin = options.apiOrigin.replace(/\/$/, '');
  const orgKey = escapeHtml(options.orgKey);

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

  <div class="ld-help-root ld-help-embed">
    <main id="arivu-help"></main>
  </div>

  <!-- Paste your site footer below -->
  <footer id="site-footer" data-arivu-site-chrome="footer"></footer>

  <script
    src="${origin}/embed/headless-help.js"
    data-api-origin="${origin}"
    data-org="${orgKey}"
    data-target="#arivu-help"
    data-path-prefix="${pathPrefix}"
    data-title="${title}"
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
  const pathPrefix = normalizePathPrefix(options.pathPrefix);
  const domain = String(options.siteDomain || 'www.example.com').trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const siteUrl = `https://${domain}${pathPrefix}`;

  return `Arivu Help Center — Deploy Kit
================================

1. Upload this folder to your host (Netlify, Vercel, cPanel, S3, etc.)
2. In Arivu → Settings → Add-ons → Articles, save website domain: ${domain}
3. Open ${siteUrl}

Included files
--------------
- ${pathPrefixToSlug(options.pathPrefix)}/index.html  — help center (home, categories, articles)
- _redirects            — Netlify routing
- vercel.json           — Vercel routing
- .htaccess             — Apache / cPanel routing

No build step or npm install required.
`;
}

export async function buildEmbedStarterKitZip(options: EmbedStarterKitOptions): Promise<Blob> {
  const pathSlug = pathPrefixToSlug(options.pathPrefix);
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
