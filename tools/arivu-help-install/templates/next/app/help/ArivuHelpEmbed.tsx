'use client';

import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    ArivuHeadlessHelp?: {
      mount: (config: Record<string, unknown>) => Promise<unknown>;
    };
    LiteDeskHeadlessHelp?: Window['ArivuHeadlessHelp'];
  }
}

type ArivuHelpEmbedProps = {
  apiOrigin: string;
  org: string;
  pathPrefix: string;
  pathname: string;
  title?: string;
};

export default function ArivuHelpEmbed({
  apiOrigin,
  org,
  pathPrefix,
  pathname,
  title = 'How can we help?',
}: ArivuHelpEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mountedPathRef = useRef('');
  const [scriptReady, setScriptReady] = useState(false);
  const origin = apiOrigin.replace(/\/$/, '');

  useEffect(() => {
    mountedPathRef.current = '';
  }, [pathname]);

  useEffect(() => {
    if (!scriptReady || !containerRef.current || !org || !origin) return;
    if (mountedPathRef.current === pathname) return;

    const api = window.ArivuHeadlessHelp || window.LiteDeskHeadlessHelp;
    if (!api) return;

    mountedPathRef.current = pathname;
    containerRef.current.innerHTML = '';

    void api.mount({
      org,
      target: containerRef.current,
      apiOrigin: origin,
      pathPrefix,
      pathname,
      title,
    }).catch(() => {
      mountedPathRef.current = '';
    });
  }, [scriptReady, org, origin, pathPrefix, pathname, title]);

  if (!origin || !org) {
    return <p>Help center is not configured. Set ARIVU_API_ORIGIN and ARIVU_ORG.</p>;
  }

  return (
    <>
      <div ref={containerRef} className="ld-help-embed-root" />
      <Script
        src={`${origin}/embed/headless-help.js`}
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />
    </>
  );
}
