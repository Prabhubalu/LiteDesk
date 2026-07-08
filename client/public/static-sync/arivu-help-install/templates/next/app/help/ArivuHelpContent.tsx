'use client';

import { useEffect, useRef } from 'react';

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

function initBlocks(root: ParentNode) {
  const api = window.ArivuHeadlessBlocks || window.LiteDeskHeadlessBlocks;
  api?.init(root);
}

export default function ArivuHelpContent({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      initBlocks(ref.current);
    }
  }, [html]);

  return (
    <div
      ref={ref}
      className="ld-help-content"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
