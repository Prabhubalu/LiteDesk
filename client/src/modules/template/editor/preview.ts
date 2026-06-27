import type { Editor } from 'grapesjs';
import { extractRenderedOutput } from './renderer';

export function buildPreviewDocument(editor: Editor): string {
  const { html, css } = extractRenderedOutput(editor);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>${css}</style>
</head>
<body>${html}</body>
</html>`;
}

export function openPreviewWindow(editor: Editor): void {
  const doc = buildPreviewDocument(editor);
  const preview = window.open('', '_blank', 'noopener,noreferrer');
  if (!preview) return;
  preview.document.open();
  preview.document.write(doc);
  preview.document.close();
}
