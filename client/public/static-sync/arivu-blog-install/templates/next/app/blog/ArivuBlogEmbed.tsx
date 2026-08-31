'use client';

import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    ArivuHeadlessBlog?: {
      mount: (config: Record<string, unknown>) => Promise<unknown>;
    };
    ArivuHeadlessBlog?: Window['ArivuHeadlessBlog'];
  }
}

type ArivuBlogEmbedProps = {
  apiOrigin: string;
  org: string;
  pathPrefix: string;
  pathname: string;
};

export default function ArivuBlogEmbed({
  apiOrigin,
  org,
  pathPrefix,
  pathname,
}: ArivuBlogEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mountedPathRef = useRef('');
  const [scriptReady, setScriptReady] = useState(false);
  const origin = apiOrigin.replace(/\/$/, '');

  useEffect(() => {
    if (window.ArivuHeadlessBlog || window.ArivuHeadlessBlog) {
      setScriptReady(true);
    }
  }, []);

  useEffect(() => {
    mountedPathRef.current = '';
  }, [pathname]);

  useEffect(() => {
    if (!scriptReady || !containerRef.current || !org || !origin) return;
    if (mountedPathRef.current === pathname) return;

    const api = window.ArivuHeadlessBlog || window.ArivuHeadlessBlog;
    if (!api) return;

    mountedPathRef.current = pathname;
    containerRef.current.innerHTML = '';

    void api.mount({
      org,
      target: containerRef.current,
      apiOrigin: origin,
      pathPrefix,
      pathname,
    }).catch(() => {
      mountedPathRef.current = '';
    });
  }, [scriptReady, org, origin, pathPrefix, pathname]);

  if (!origin || !org) {
    return <p>Blog is not configured. Set ARIVU_API_ORIGIN and ARIVU_BLOG_ORG (or ARIVU_ORG).</p>;
  }

  return (
    <>
      <div ref={containerRef} id="arivu-blog" className="ld-blog-embed-root" />
      <Script
        src={`${origin}/embed/headless-blog.js`}
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />
    </>
  );
}
