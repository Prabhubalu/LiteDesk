'use client';

import Script from 'next/script';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

declare global {
  interface Window {
    LiteDeskHeadlessBlocks?: {
      init: (root?: ParentNode) => void;
    };
    ArivuHeadlessBlocks?: {
      init: (root?: ParentNode) => void;
    };
  }
}

function initHeadlessBlocks(root: ParentNode = document) {
  const api = window.ArivuHeadlessBlocks || window.LiteDeskHeadlessBlocks;
  api?.init(root);
}

export default function ArivuHelpAssets({ apiOrigin }: { apiOrigin: string }) {
  const origin = apiOrigin.replace(/\/$/, '');
  const pathname = usePathname();

  useEffect(() => {
    initHeadlessBlocks(document);
  }, [pathname]);

  if (!origin) return null;

  return (
    <Script
      src={`${origin}/embed/headless-blocks.js`}
      strategy="afterInteractive"
      onLoad={() => initHeadlessBlocks(document)}
    />
  );
}
