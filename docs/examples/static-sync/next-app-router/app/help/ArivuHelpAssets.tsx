'use client';

import Script from 'next/script';
import { useEffect } from 'react';

declare global {
  interface Window {
    LiteDeskHeadlessBlocks?: {
      init: (root?: ParentNode) => void;
    };
  }
}

function initHeadlessBlocks() {
  window.LiteDeskHeadlessBlocks?.init(document);
}

export default function ArivuHelpAssets({ apiOrigin }: { apiOrigin: string }) {
  const origin = apiOrigin.replace(/\/$/, '');

  useEffect(() => {
    initHeadlessBlocks();
  }, []);

  if (!origin) return null;

  return (
    <Script
      src={`${origin}/embed/headless-blocks.js`}
      strategy="afterInteractive"
      onLoad={initHeadlessBlocks}
    />
  );
}
