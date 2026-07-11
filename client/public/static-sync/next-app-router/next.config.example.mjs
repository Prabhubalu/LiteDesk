/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * Static SEO mode: map clean /help URLs to pre-synced index.html files in public/.
   * Merge into your next.config.mjs / next.config.ts.
   *
   * Nested paths (/help/a/b/c) and hard refresh are supported via :path+.
   * Files with extensions (sitemap.xml, /help/assets/*) are served from public/
   * before these rewrites run — no rewrite to index.html for those.
   */
  async rewrites() {
    return [
      { source: '/help', destination: '/help/index.html' },
      { source: '/help/', destination: '/help/index.html' },
      {
        source: '/help/:path+/',
        destination: '/help/:path+/index.html',
      },
      {
        source: '/help/:path+',
        destination: '/help/:path+/index.html',
      },
    ];
  },
};

export default nextConfig;
