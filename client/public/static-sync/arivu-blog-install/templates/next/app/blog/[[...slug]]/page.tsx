import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ArivuBlogContent from '../ArivuBlogContent';
import ArivuBlogEmbed from '../ArivuBlogEmbed';
import {
  buildBlogPathname,
  buildStaticSlugParams,
  fetchHomeExport,
  pickPageHtml,
  readSyncedPageHtml,
  resolveBlogPage,
} from '../../../lib/arivu-blog';

const API_ORIGIN = process.env.ARIVU_API_ORIGIN || '';
const ORG = process.env.ARIVU_BLOG_ORG || process.env.ARIVU_ORG || '';
const PATH_PREFIX = process.env.BLOG_URL_PREFIX || '/blog/';

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

  const resolved = await resolveBlogPage(slug);
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

export default async function BlogPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug = [] } = await params;
  const pathname = buildBlogPathname(PATH_PREFIX, slug);

  const syncedHtml = await readSyncedPageHtml(pathname);
  if (syncedHtml) {
    return <ArivuBlogContent html={syncedHtml} />;
  }

  if (slug.length === 0) {
    const home = await fetchHomeExport();
    if (!home) {
      notFound();
    }
  } else {
    const resolved = await resolveBlogPage(slug);
    if (!pickPageHtml(resolved?.data ?? null)) {
      notFound();
    }
  }

  return (
    <ArivuBlogEmbed
      apiOrigin={API_ORIGIN}
      org={ORG}
      pathPrefix={PATH_PREFIX}
      pathname={pathname}
    />
  );
}
