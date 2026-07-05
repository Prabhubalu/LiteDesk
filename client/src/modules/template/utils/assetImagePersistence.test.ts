import { describe, expect, it } from 'vitest';
import { stripAuthTokenFromDownloadUrl } from '../composables/useCompanyLogoAsset';
import { restoreLogoMergeSources, stripAuthTokensFromHtml } from '../editor/logoContent';

describe('stripAuthTokenFromDownloadUrl', () => {
  it('removes token query params from download urls', () => {
    const url = '/api/files/download?storagePath=abc&token=old-token&disposition=inline';
    expect(stripAuthTokenFromDownloadUrl(url)).toBe(
      '/api/files/download?storagePath=abc&disposition=inline'
    );
  });
});

describe('stripAuthTokensFromHtml', () => {
  it('removes auth tokens from image src attributes', () => {
    const html = '<img src="/api/files/download?storagePath=abc&token=secret" alt="Logo" />';
    expect(stripAuthTokensFromHtml(html)).toBe(
      '<img src="/api/files/download?storagePath=abc" alt="Logo" />'
    );
  });
});

describe('restoreLogoMergeSources', () => {
  it('stores merge token src for logo components', () => {
    const html = '<img data-merge-src="{{CurrentOrganization.logoUrl}}" src="/api/files/download?storagePath=abc&token=secret" />';
    expect(restoreLogoMergeSources(html)).toBe(
      '<img data-merge-src="{{CurrentOrganization.logoUrl}}" src="{{CurrentOrganization.logoUrl}}">'
    );
  });
});
