import ArivuHelpAssets from './ArivuHelpAssets';

const API_ORIGIN = process.env.ARIVU_API_ORIGIN || '';

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  const stylesheetOrigin = API_ORIGIN.replace(/\/$/, '');

  return (
    <>
      {stylesheetOrigin ? (
        <link rel="stylesheet" href={`${stylesheetOrigin}/embed/headless-blocks.css`} />
      ) : null}
      <div className="ld-help-root">{children}</div>
      <ArivuHelpAssets apiOrigin={API_ORIGIN} />
    </>
  );
}
