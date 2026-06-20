'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  isNativeDocument,
  isEditableUploadedFile,
  supportsReservation,
  resolveReservationState
} = require('../../constants/documentEditingCoordination');

const {
  assertNoVersionConflict,
  DocumentVersionConflictError
} = require('../../services/documentEditingCoordinationService');

describe('documentEditingCoordination constants', () => {
  it('identifies native documents', () => {
    assert.equal(isNativeDocument({ documentType: 'sop' }), true);
    assert.equal(isNativeDocument({ documentType: 'rich_document' }), true);
    assert.equal(isNativeDocument({ documentType: 'file', fileType: 'DOCX' }), false);
    assert.equal(isNativeDocument({ documentType: 'external_link' }), false);
  });

  it('identifies editable uploaded files', () => {
    assert.equal(isEditableUploadedFile({ documentType: 'file', fileType: 'DOCX' }), true);
    assert.equal(isEditableUploadedFile({ documentType: 'file', fileType: 'PDF' }), false);
    assert.equal(isEditableUploadedFile({ documentType: 'sop' }), false);
  });

  it('supports reservations only for editable uploaded files', () => {
    assert.equal(supportsReservation({ documentType: 'file', fileType: 'XLSX' }), true);
    assert.equal(supportsReservation({ documentType: 'file', fileType: 'PDF' }), false);
    assert.equal(supportsReservation({ documentType: 'playbook' }), false);
  });

  it('resolves reservation state with expiry', () => {
    const now = new Date('2026-06-20T12:00:00.000Z');
    assert.equal(resolveReservationState({ reservedBy: null }, now), 'available');
    assert.equal(
      resolveReservationState({
        reservedBy: 'user-1',
        reservationExpiresAt: '2026-06-20T13:00:00.000Z'
      }, now),
      'reserved'
    );
    assert.equal(
      resolveReservationState({
        reservedBy: 'user-1',
        reservationExpiresAt: '2026-06-20T11:00:00.000Z'
      }, now),
      'expired'
    );
  });
});

describe('documentEditingCoordinationService version conflicts', () => {
  it('allows upload when base version matches current version', () => {
    assert.doesNotThrow(() => assertNoVersionConflict({ baseVersion: 2, currentVersion: 2 }));
  });

  it('throws when base version is behind current version', () => {
    assert.throws(
      () => assertNoVersionConflict({ baseVersion: 2, currentVersion: 3 }),
      (error) => error instanceof DocumentVersionConflictError
        && error.baseVersion === 2
        && error.currentVersion === 3
    );
  });

  it('skips conflict check when force upload is enabled', () => {
    assert.doesNotThrow(() => assertNoVersionConflict({
      baseVersion: 1,
      currentVersion: 4,
      forceUpload: true
    }));
  });
});
