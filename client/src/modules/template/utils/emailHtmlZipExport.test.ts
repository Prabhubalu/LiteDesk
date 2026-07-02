import { describe, expect, it } from 'vitest';
import { extractAssetReferences } from './emailHtmlZipExport';

describe('extractAssetReferences', () => {
  it('collects img src and css url values', () => {
    const html = `
      <style>.logo { background-image: url('https://cdn.example.com/bg.png'); }</style>
      <img src="/api/content/assets/abc123" alt="Logo" />
      <img src="data:image/png;base64,abc" alt="Inline" />
    `;

    const refs = extractAssetReferences(html);
    expect(refs).toContain('https://cdn.example.com/bg.png');
    expect(refs).toContain('/api/content/assets/abc123');
    expect(refs).toContain('data:image/png;base64,abc');
  });
});
