import { describe, expect, it, vi } from 'vitest';

vi.mock('../composables/useCompanyLogoAsset', () => ({
  resolveAssetDownloadUrl: (url: string) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `https://app.test${url}${url.includes('?') ? '&' : '?'}token=test`;
  }
}));

import { resolvePreviewHtmlImageUrls } from './previewHtmlImages';

describe('resolvePreviewHtmlImageUrls', () => {
  it('rewrites managed download URLs with auth', () => {
    const html = '<img src="/api/files/download?storagePath=oci%3Alogo.svg" alt="Logo" />';
    const result = resolvePreviewHtmlImageUrls(html);
    expect(result).toContain('token=test');
    expect(result).toContain('https://app.test/api/files/download');
  });

  it('replaces logo merge tokens with the company logo URL', () => {
    const html = '<img data-logo="true" src="{{CurrentOrganization.logoUrl}}" alt="Logo" />';
    const result = resolvePreviewHtmlImageUrls(
      html,
      '/api/files/download?storagePath=oci%3Alogo.svg'
    );
    expect(result).not.toContain('{{CurrentOrganization.logoUrl}}');
    expect(result).toContain('token=test');
  });

  it('leaves data URLs unchanged', () => {
    const dataUrl = 'data:image/svg+xml;base64,abc';
    const html = `<img src="${dataUrl}" alt="Logo" />`;
    expect(resolvePreviewHtmlImageUrls(html)).toBe(html);
  });
});
