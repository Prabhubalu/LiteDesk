import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ArivuHelpContent from '../ArivuHelpContent';
import { buildStaticSlugParams, pickPageHtml, resolveHelpPage } from '../../../lib/arivu-help';

export async function generateStaticParams() {
  return buildStaticSlugParams();
}

export const dynamicParams = true;
export const revalidate = 3600;

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
  const pageHtml = pickPageHtml(resolved?.data ?? null);

  if (!pageHtml) {
    notFound();
  }

  return <ArivuHelpContent html={pageHtml} />;
}
