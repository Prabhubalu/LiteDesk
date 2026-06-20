'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  buildLegacyKey,
  resolveStoragePathFromAttachment
} = require('../../scripts/migrateCommentAttachmentsToDocuments');

describe('migrateCommentAttachmentsToDocuments helpers', () => {
  it('builds stable legacy keys', () => {
    assert.equal(
      buildLegacyKey('deal', '64b1f2a1c3d4e5f6a7b8c9d0', 2),
      'comment:deal:64b1f2a1c3d4e5f6a7b8c9d0:2'
    );
  });

  it('resolves oci storage path from download url', () => {
    const storagePath = resolveStoragePathFromAttachment({
      url: '/api/files/download?storagePath=oci%3Auploads%2Forg%2Fcomments%2Ffile.pdf&disposition=inline'
    });
    assert.equal(storagePath, 'oci:uploads/org/comments/file.pdf');
  });

  it('returns explicit storagePath when present', () => {
    const storagePath = resolveStoragePathFromAttachment({
      url: '/api/files/download?storagePath=oci%3Aold',
      storagePath: 'oci:uploads/org/comments/new.pdf'
    });
    assert.equal(storagePath, 'oci:uploads/org/comments/new.pdf');
  });
});
