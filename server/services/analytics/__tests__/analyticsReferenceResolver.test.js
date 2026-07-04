const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const {
  extractObjectId,
  isUserReferenceField,
  formatUserDisplayName,
} = require('../analyticsReferenceResolver');

describe('analyticsReferenceResolver', () => {
  it('extractObjectId normalizes ObjectId values', () => {
    const id = new mongoose.Types.ObjectId();
    assert.equal(extractObjectId(id), String(id));
    assert.equal(extractObjectId(String(id)), String(id));
    assert.equal(extractObjectId(null), null);
    assert.equal(extractObjectId('not-an-id'), null);
  });

  it('isUserReferenceField detects assignedTo and user lookup metadata', () => {
    assert.equal(isUserReferenceField(null, 'assignedTo'), true);
    assert.equal(isUserReferenceField(null, 'people.assignedTo'), true);
    assert.equal(
      isUserReferenceField({ lookupSettings: { targetModule: 'users' } }, 'ownerId'),
      true,
    );
    assert.equal(isUserReferenceField(null, 'name'), false);
  });

  it('formatUserDisplayName prefers full name', () => {
    assert.equal(
      formatUserDisplayName({ firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' }),
      'Jane Doe',
    );
    assert.equal(
      formatUserDisplayName({ email: 'jane@example.com', _id: 'abc' }),
      'jane@example.com',
    );
  });
});
