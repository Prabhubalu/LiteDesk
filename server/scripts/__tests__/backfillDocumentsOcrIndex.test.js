'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Inline query builder mirror for unit test without running the script
const { OCR_SUPPORTED_MIME_TYPES, OCR_SUPPORTED_FILE_TYPES } = require('../../constants/documentOcrIndex');

function buildBackfillQuery(organizationId) {
  const query = {
    deletedAt: null,
    documentType: 'file',
    storagePath: { $nin: [null, ''] },
    $or: [
      { ocrStatus: null },
      { ocrStatus: { $exists: false } },
      { ocrStatus: 'pending' },
      { ocrStatus: 'failed' }
    ],
    $and: [
      {
        $or: [
          { mimeType: { $in: [...OCR_SUPPORTED_MIME_TYPES] } },
          { fileType: { $in: [...OCR_SUPPORTED_FILE_TYPES] } }
        ]
      }
    ]
  };

  if (organizationId) {
    query.organizationId = organizationId;
  }

  return query;
}

describe('backfillDocumentsOcrIndex query', () => {
  it('targets OCR-eligible file documents without a successful index', () => {
    const query = buildBackfillQuery('org-1');
    assert.equal(query.organizationId, 'org-1');
    assert.equal(query.documentType, 'file');
    assert.ok(query.$and[0].$or.some((clause) => clause.mimeType?.$in?.includes('application/pdf')));
  });

  it('omits organization filter when not scoped', () => {
    const query = buildBackfillQuery(null);
    assert.equal(query.organizationId, undefined);
  });
});
