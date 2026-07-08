import type { EmbedStarterKitOptions } from './buildEmbedStarterKit';

function normalizePathPrefix(prefix: string): string {
  let value = String(prefix || '/help/').trim();
  if (!value.startsWith('/')) value = `/${value}`;
  if (!value.endsWith('/')) value = `${value}/`;
  return value;
}

function normalizeWebsiteOrigin(domain: string): string {
  const raw = String(domain || '').trim();
  if (!raw) return '';
  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const url = new URL(withProtocol);
    return `${url.protocol}//${url.host}`;
  } catch {
    return '';
  }
}

export type ConfiguredPhpSyncOptions = Pick<EmbedStarterKitOptions, 'apiOrigin' | 'orgKey' | 'pathPrefix' | 'siteDomain'>;

export function buildConfiguredPhpSync(templatePhp: string, options: ConfiguredPhpSyncOptions): string {
  const orgKey = String(options.orgKey || 'art_pub_REPLACE_ME').replace(/'/g, "\\'");
  const apiOrigin = String(options.apiOrigin || 'https://app.arivu.com').replace(/\/$/, '').replace(/'/g, "\\'");
  const pathPrefix = normalizePathPrefix(options.pathPrefix).replace(/'/g, "\\'");
  const siteOrigin = normalizeWebsiteOrigin(options.siteDomain || '').replace(/'/g, "\\'");

  return templatePhp
    .replace(
      "'org' => getenv('ARIVU_ORG') ?: 'art_pub_REPLACE_ME'",
      `'org' => getenv('ARIVU_ORG') ?: '${orgKey}'`,
    )
    .replace(
      "'apiOrigin' => rtrim(getenv('ARIVU_API_ORIGIN') ?: 'https://app.arivu.com', '/')",
      `'apiOrigin' => rtrim(getenv('ARIVU_API_ORIGIN') ?: '${apiOrigin}', '/')`,
    )
    .replace(
      "'pathPrefix' => getenv('HELP_URL_PREFIX') ?: '/help/'",
      `'pathPrefix' => getenv('HELP_URL_PREFIX') ?: '${pathPrefix}'`,
    )
    .replace(
      "'siteOrigin' => rtrim(getenv('SITE_ORIGIN') ?: '', '/')",
      `'siteOrigin' => rtrim(getenv('SITE_ORIGIN') ?: '${siteOrigin}', '/')`,
    );
}
