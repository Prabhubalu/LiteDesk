import ArivuBlogAssets from './ArivuBlogAssets';

const API_ORIGIN = process.env.ARIVU_API_ORIGIN || '';

/**
 * Blog layout for Arivu headless content.
 *
 * If your site nav/footer live in route layouts instead of app/layout.tsx,
 * wrap {children} here with the same components. The installer auto-patches
 * this file when it detects a reference layout during install.
 *
 * ARIVU_SYNC_MODE=layout does not render public/blog/ static HTML; /blog is
 * served by these Next.js routes and fetches content from the Arivu API.
 */
export default function BlogLayout({ children }: { children: React.ReactNode }) {
  const stylesheetOrigin = API_ORIGIN.replace(/\/$/, '');

  return (
    <>
      {stylesheetOrigin ? (
        <link rel="stylesheet" href={`${stylesheetOrigin}/embed/headless-blocks.css`} />
      ) : null}
      <div className="ld-blog-root ld-blog-embed">{children}</div>
      <ArivuBlogAssets apiOrigin={API_ORIGIN} />
    </>
  );
}
