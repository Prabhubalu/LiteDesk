'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  detectProviderFromUrl,
  resolveExternalProvider,
  validateExternalProviderUrl,
  providerMatchesUrl
} = require('../../constants/documentExternalProviders');

describe('documentExternalProviders', () => {
  it('detects Google Drive URLs', () => {
    assert.equal(
      detectProviderFromUrl('https://docs.google.com/document/d/abc/edit'),
      'google_drive'
    );
    assert.equal(
      detectProviderFromUrl('https://drive.google.com/file/d/abc/view'),
      'google_drive'
    );
  });

  it('detects OneDrive and SharePoint URLs', () => {
    assert.equal(
      detectProviderFromUrl('https://onedrive.live.com/edit?id=abc'),
      'onedrive'
    );
    assert.equal(
      detectProviderFromUrl('https://contoso.sharepoint.com/:w:/r/sites/docs/file.docx'),
      'onedrive'
    );
  });

  it('detects Dropbox URLs', () => {
    assert.equal(
      detectProviderFromUrl('https://www.dropbox.com/s/abc/file.pdf'),
      'dropbox'
    );
  });

  it('resolves explicit provider before URL detection', () => {
    assert.equal(
      resolveExternalProvider('dropbox', 'https://docs.google.com/document/d/abc'),
      'dropbox'
    );
    assert.equal(
      resolveExternalProvider('', 'https://www.dropbox.com/s/abc/file.pdf'),
      'dropbox'
    );
  });

  it('validates provider URL alignment', () => {
    assert.throws(
      () => validateExternalProviderUrl('dropbox', 'https://docs.google.com/document/d/abc'),
      /does not match/
    );
    assert.equal(
      validateExternalProviderUrl('google_drive', 'https://docs.google.com/document/d/abc'),
      'google_drive'
    );
  });

  it('allows unknown hosts when provider has no detected match', () => {
    assert.equal(providerMatchesUrl('google_drive', 'https://example.com/file'), true);
  });
});
