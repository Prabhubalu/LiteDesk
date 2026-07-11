import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ArivuHelpEmbed from '../ArivuHelpEmbed';
import {
  buildHelpPathname,
  buildStaticSlugParams,
  fetchHomeExport,
  pickPageHtml,
  resolveHelpPage,
} from '../../../lib/arivu-help';

const API_ORIGIN = process.env.ARIVU_API_ORIGIN || '';
const ORG = process.env.ARIVU_ORG || '';
const PATH_PREFIX = process.env.HELP_URL_PREFIX || '/help/';

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

  if (slug.length === 0) {
    const home = await fetchHomeExport();
    const meta = home?.meta;
    if (!meta) return {};
    return {
      title: meta.title,
      description: meta.description,
      alternates: meta.canonical ? { canonical: meta.canonical } : undefined,
    };
  }

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
  const pathname = buildHelpPathname(PATH_PREFIX, slug);

  if (slug.length === 0) {
    const home = await fetchHomeExport();
    if (!home) {
      notFound();
    }
  } else {
    const resolved = await resolveHelpPage(slug);
    if (!pickPageHtml(resolved?.data ?? null)) {
      notFound();
    }
  }

  return (
    <ArivuHelpEmbed
      apiOrigin={API_ORIGIN}
      org={ORG}
      pathPrefix={PATH_PREFIX}
      pathname={pathname}
    />
  );
}
