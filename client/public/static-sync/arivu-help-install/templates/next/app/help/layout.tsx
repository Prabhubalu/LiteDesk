import ArivuHelpAssets from './ArivuHelpAssets';

const API_ORIGIN = process.env.ARIVU_API_ORIGIN || '';

/**
 * Help layout for Arivu headless content.
 *
 * If your site nav/footer live in route layouts (e.g. app/blog/layout.tsx) instead of
 * app/layout.tsx, wrap {children} here with the same components — e.g. SiteNav,
 * SiteNavSpacer, Container, SiteFooter. The installer auto-patches this file when it
 * finds a reference layout during install.
 *
 * ARIVU_SYNC_MODE=layout does not render public/help/ static HTML; /help is served by
 * these Next.js routes and fetches content from the Arivu API at build/runtime.
 */
export default function HelpLayout({ children }: { children: React.ReactNode }) {
  const stylesheetOrigin = API_ORIGIN.replace(/\/$/, '');

  return (
    <>
      {stylesheetOrigin ? (
        <link rel="stylesheet" href={`${stylesheetOrigin}/embed/headless-blocks.css`} />
      ) : null}
      <div className="ld-help-root ld-help-embed">{children}</div>
      <ArivuHelpAssets apiOrigin={API_ORIGIN} />
    </>
  );
}
