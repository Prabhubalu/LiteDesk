import JSZip from 'jszip';

export type VercelStandaloneKitOptions = {
  apiOrigin: string;
  orgKey: string;
  pathPrefix: string;
  siteDomain?: string;
  webhookSecret?: string;
};

function normalizePathPrefix(prefix: string): string {
  let value = String(prefix || '/help/').trim();
  if (!value.startsWith('/')) value = `/${value}`;
  if (!value.endsWith('/')) value = `${value}/`;
  return value;
}

function normalizeWebsiteOrigin(domain: string): string {
  const raw = String(domain || '').trim();
  if (!raw) return 'https://www.example.com';
  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const url = new URL(withProtocol);
    return `${url.protocol}//${url.host}`;
  } catch {
    return 'https://www.example.com';
  }
}

function buildEnvFile(options: VercelStandaloneKitOptions): string {
  const siteOrigin = normalizeWebsiteOrigin(options.siteDomain || '');
  const lines = [
    `ARIVU_ORG=${options.orgKey}`,
    `ARIVU_API_ORIGIN=${options.apiOrigin.replace(/\/$/, '')}`,
    `HELP_URL_PREFIX=${normalizePathPrefix(options.pathPrefix)}`,
    'ARIVU_SYNC_MODE=layout',
    'ARIVU_SYNC_DEST=./public',
    `SITE_ORIGIN=${siteOrigin}`,
    'ARIVU_WEBHOOK_SECRET=',
    'VERCEL_DEPLOY_HOOK_URL=',
  ];
  if (options.webhookSecret) {
    const idx = lines.findIndex((line) => line.startsWith('ARIVU_WEBHOOK_SECRET='));
    if (idx >= 0) lines[idx] = `ARIVU_WEBHOOK_SECRET=${options.webhookSecret}`;
  }
  return `${lines.join('\n')}\n`;
}

export async function buildVercelStandaloneKitZip(
  templateZipUrl: string,
  options: VercelStandaloneKitOptions,
): Promise<Blob> {
  const response = await fetch(templateZipUrl);
  if (!response.ok) {
    throw new Error('Failed to load Vercel template');
  }
  const templateBuffer = await response.arrayBuffer();
  const zip = await JSZip.loadAsync(templateBuffer);
  zip.file('.env', buildEnvFile(options));
  zip.file('.env.example', buildEnvFile(options));
  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });
}
