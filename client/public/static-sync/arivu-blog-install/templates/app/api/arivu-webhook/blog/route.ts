import { createRequire } from 'module';
import crypto from 'crypto';
import path from 'path';
import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

const WEBHOOK_SECRET = process.env.ARIVU_BLOG_WEBHOOK_SECRET || process.env.ARIVU_WEBHOOK_SECRET || '';
const SYNC_MODE = process.env.ARIVU_SYNC_MODE || 'hybrid';
const DEPLOY_HOOK_URL = process.env.VERCEL_DEPLOY_HOOK_URL || '';
const API_ORIGIN = process.env.ARIVU_API_ORIGIN || '';
const ORG = process.env.ARIVU_BLOG_ORG || process.env.ARIVU_ORG || '';
const DEST = process.env.ARIVU_SYNC_DEST || './public';
const PATH_PREFIX = process.env.BLOG_URL_PREFIX || '/blog/';
const SITE_ORIGIN = process.env.SITE_ORIGIN || '';
const BLOG_PREFIX = PATH_PREFIX.replace(/\/$/, '') || '/blog';

const require = createRequire(import.meta.url);

function verifyWebhookSignature(rawBody: string, secret: string, header: string | null): boolean {
  if (!secret) return true;
  if (!header || !header.startsWith('sha256=')) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const received = header.slice('sha256='.length);
  return expected.length === received.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

function mapExportPathToRoute(exportPath: string): string {
  const normalized = String(exportPath || '').replace(/\/index\.html$/, '');
  if (!normalized || normalized === '/' || normalized === BLOG_PREFIX) {
    return BLOG_PREFIX;
  }
  return normalized.startsWith(BLOG_PREFIX) ? normalized : `${BLOG_PREFIX}${normalized.startsWith('/') ? '' : '/'}${normalized}`;
}

async function triggerStaticDeploy(): Promise<{ ok: boolean; status?: number }> {
  if (!DEPLOY_HOOK_URL) return { ok: false };
  const response = await fetch(DEPLOY_HOOK_URL, { method: 'POST' });
  return { ok: response.ok, status: response.status };
}

function shouldWriteStaticLocally(): boolean {
  if (process.env.ARIVU_SYNC_WRITE_LOCAL === '0') return false;
  if (process.env.ARIVU_SYNC_WRITE_LOCAL === '1') return true;
  return !process.env.VERCEL;
}

async function writeStaticFromWebhook(payload: unknown): Promise<unknown | null> {
  if (!shouldWriteStaticLocally() || !API_ORIGIN || !ORG) return null;
  try {
    const syncPath = path.join(process.cwd(), 'help-sync/lib/sync.js');
    const { handleWebhookPayload } = require(syncPath) as {
      handleWebhookPayload: (options: Record<string, unknown>) => Promise<unknown>;
    };
    return await handleWebhookPayload({
      apiOrigin: API_ORIGIN,
      org: ORG,
      dest: DEST,
      payload,
      pathPrefix: PATH_PREFIX,
      siteOrigin: SITE_ORIGIN,
      addon: 'blog',
      mirrorAssets: process.env.ARIVU_MIRROR_ASSETS !== '0',
    });
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-arivu-signature');

  if (!verifyWebhookSignature(rawBody, WEBHOOK_SECRET, signature)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  let payload: {
    event?: string;
    content?: { exportPath?: string; refreshPages?: Array<{ exportPath?: string }> };
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON' }, { status: 400 });
  }

  const event = String(payload?.event || '');
  const exportPath = String(payload?.content?.exportPath || '');
  const refreshPages = Array.isArray(payload?.content?.refreshPages) ? payload.content.refreshPages : [];
  const paths = [exportPath, ...refreshPages.map((page) => String(page?.exportPath || ''))].filter(Boolean);

  if (event !== 'content.published' && event !== 'content.unpublished') {
    return NextResponse.json({ success: false, message: 'Unsupported event' }, { status: 400 });
  }

  if (!paths.length) {
    return NextResponse.json({ success: false, message: 'Missing export paths' }, { status: 400 });
  }

  if (SYNC_MODE === 'static') {
    const deploy = await triggerStaticDeploy();
    if (!deploy.ok) {
      return NextResponse.json(
        {
          success: false,
          message: DEPLOY_HOOK_URL
            ? 'Deploy hook request failed'
            : 'VERCEL_DEPLOY_HOOK_URL is required when ARIVU_SYNC_MODE=static',
          status: deploy.status,
        },
        { status: DEPLOY_HOOK_URL ? 502 : 500 },
      );
    }
    return NextResponse.json({ success: true, mode: 'static', triggered: 'deploy' });
  }

  const revalidated = paths.map((pathValue) => mapExportPathToRoute(pathValue));
  revalidated.forEach((pathValue) => revalidatePath(pathValue));
  revalidatePath(BLOG_PREFIX);

  if (SYNC_MODE === 'hybrid') {
    const staticWrite = await writeStaticFromWebhook(payload);
    let deployTriggered = false;
    if (DEPLOY_HOOK_URL) {
      const deploy = await triggerStaticDeploy();
      deployTriggered = deploy.ok;
    }
    return NextResponse.json({
      success: true,
      mode: 'hybrid',
      revalidated,
      staticWrite: Boolean(staticWrite),
      deployTriggered,
    });
  }

  return NextResponse.json({ success: true, mode: SYNC_MODE, revalidated });
}
