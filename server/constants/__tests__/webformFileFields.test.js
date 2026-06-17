'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  isWebformFileFieldType,
  isFileFieldValueEmpty,
  sanitizeClientFileFieldValue,
  buildStoredFileFieldValue
} = require('../webformFileFields');

describe('webformFileFields', () => {
  it('detects file field type and empty values', () => {
    assert.equal(isWebformFileFieldType('File'), true);
    assert.equal(isFileFieldValueEmpty(null), true);
    assert.equal(isFileFieldValueEmpty({ uploadToken: 'abc' }), false);
  });

  it('sanitizes client file payload', () => {
    assert.deepEqual(sanitizeClientFileFieldValue({ uploadToken: ' tok ', fileName: 'a.pdf' }), {
      uploadToken: 'tok',
      fileName: 'a.pdf',
      mimeType: '',
      fileSize: 0
    });
  });

  it('builds stored file field value', () => {
    const stored = buildStoredFileFieldValue({
      uploadToken: 'tok',
      fileName: 'a.pdf',
      mimeType: 'application/pdf',
      fileSize: 12,
      storagePath: 'oci:uploads/org/webforms/id/file.pdf',
      downloadUrl: '/api/files/download?storagePath=oci%3Auploads'
    });
    assert.equal(stored.fileName, 'a.pdf');
    assert.equal(stored.downloadUrl, '/api/files/download?storagePath=oci%3Auploads');
  });
});
