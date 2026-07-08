import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

const API_ORIGIN = process.env.ARIVU_API_ORIGIN || '';
const ORG = process.env.ARIVU_ORG || '';
const PATH_PREFIX = process.env.HELP_URL_PREFIX || '/help/';

type ExportData = {
  html?: string;
  bodyHtml?: string;
  meta?: {
    title?: string;
    description?: string;
    canonical?: string;
  };
};

async function fetchExport(slug: string): Promise<ExportData | null> {
  const base = `${API_ORIGIN.replace(/\/$/, '')}/api/public/v1/content/${encodeURIComponent(ORG)}`;
  const params = new URLSearchParams({ pathPrefix: PATH_PREFIX });
  const response = await fetch(`${base}/articles/${encodeURIComponent(slug)}/export?${params}`, {
    next: { revalidate: 3600 },
  });
  const payload = await response.json();
  if (!response.ok || !payload?.success) {
    return null;
  }
  return payload.data as ExportData;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const exportData = await fetchExport(slug[slug.length - 1]);
  if (!exportData?.meta) {
    return {};
  }
  return {
    title: exportData.meta.title,
    description: exportData.meta.description,
    alternates: exportData.meta.canonical
      ? { canonical: exportData.meta.canonical }
      : undefined,
  };
}

export default async function HelpArticlePage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const exportData = await fetchExport(slug[slug.length - 1]);
  if (!exportData?.bodyHtml) {
    notFound();
  }

  return (
    <article
      className="ld-article"
      dangerouslySetInnerHTML={{ __html: exportData.bodyHtml }}
    />
  );
}
