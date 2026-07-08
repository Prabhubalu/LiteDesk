import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { buildStaticSlugParams, pickBodyHtml, resolveHelpPage } from '../../../lib/arivu-help';

export async function generateStaticParams() {
  return buildStaticSlugParams();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const { slug = [] } = await params;
  const resolved = await resolveHelpPage(slug);
  const meta = resolved?.data.meta;
  if (!meta) {
    return {};
  }
  return {
    title: meta.title,
    description: meta.description,
    alternates: meta.canonical ? { canonical: meta.canonical } : undefined,
  };
}

export default async function HelpPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug = [] } = await params;
  const resolved = await resolveHelpPage(slug);
  const bodyHtml = pickBodyHtml(resolved?.data ?? null);

  if (!bodyHtml) {
    notFound();
  }

  return (
    <div
      className={resolved?.className ?? 'ld-help-page'}
      dangerouslySetInnerHTML={{ __html: bodyHtml }}
    />
  );
}
