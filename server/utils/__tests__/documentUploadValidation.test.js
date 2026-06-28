'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveUploadMimeType,
  isAllowedUploadMime
} = require('../../services/fileStorageService');
const { applyCreateOwnerDefaults } = require('../recordCreateOwnerDefaults');
const mongoose = require('mongoose');

test('resolveUploadMimeType infers common document extensions when browser omits mimetype', () => {
  assert.equal(
    resolveUploadMimeType({ originalname: 'report.pdf', mimetype: '' }),
    'application/pdf'
  );
  assert.equal(
    resolveUploadMimeType({ originalname: 'deck.pptx', mimetype: '' }),
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  );
  assert.equal(
    resolveUploadMimeType({ originalname: 'archive.zip', mimetype: '' }),
    'application/zip'
  );
  assert.ok(isAllowedUploadMime(resolveUploadMimeType({ originalname: 'notes.md', mimetype: '' })));
});

test('applyCreateOwnerDefaults sets documents assignedTo from current user', () => {
  const userId = new mongoose.Types.ObjectId();
  const body = applyCreateOwnerDefaults({}, 'documents', userId);
  assert.equal(String(body.assignedTo), String(userId));
});
