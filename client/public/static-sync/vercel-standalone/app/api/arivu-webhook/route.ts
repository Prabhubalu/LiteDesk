import crypto from 'crypto';
import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';

const WEBHOOK_SECRET = process.env.ARIVU_WEBHOOK_SECRET || '';
const SYNC_MODE = process.env.ARIVU_SYNC_MODE || 'isr';
const DEPLOY_HOOK_URL = process.env.VERCEL_DEPLOY_HOOK_URL || '';

function verifyWebhookSignature(rawBody: string, secret: string, header: string | null): boolean {
  if (!secret) return true;
  if (!header || !header.startsWith('sha256=')) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const received = header.slice('sha256='.length);
  return expected.length === received.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

function mapExportPathToRoute(exportPath: string): string {
  const normalized = String(exportPath || '').replace(/\/index\.html$/, '');
  return normalized || '/help';
}

async function triggerStaticDeploy(): Promise<NextResponse> {
  if (!DEPLOY_HOOK_URL) {
    return NextResponse.json(
      { success: false, message: 'VERCEL_DEPLOY_HOOK_URL is required when ARIVU_SYNC_MODE=static' },
      { status: 500 },
    );
  }

  const response = await fetch(DEPLOY_HOOK_URL, { method: 'POST' });
  if (!response.ok) {
    return NextResponse.json(
      { success: false, message: 'Deploy hook request failed', status: response.status },
      { status: 502 },
    );
  }

  return NextResponse.json({ success: true, mode: 'static', triggered: 'deploy' });
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

  if (SYNC_MODE === 'static' || SYNC_MODE === 'layout') {
    return triggerStaticDeploy();
  }

  const revalidated = paths.map((path) => mapExportPathToRoute(path));
  revalidated.forEach((path) => revalidatePath(path));
  return NextResponse.json({ success: true, mode: 'isr', revalidated });
}
