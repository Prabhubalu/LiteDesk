import { NextResponse } from 'next/server';
import { fetchStaticSitemapXml } from '../../../lib/arivu-help';

export async function GET() {
  const xml = await fetchStaticSitemapXml();
  if (!xml) {
    return new NextResponse('Sitemap unavailable', { status: 503 });
  }

  return new NextResponse(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
