const test = require('node:test');
const assert = require('node:assert/strict');
const { isMongoObjectIdString } = require('../utils/isMongoObjectId');

test('isMongoObjectIdString: accepts valid ObjectId hex', () => {
  assert.equal(isMongoObjectIdString('6a19ae00f59c6bba27836a7f'), true);
});

test('isMongoObjectIdString: rejects UUID', () => {
  assert.equal(isMongoObjectIdString('72646cfe-0cbf-1643-fbe0-0d5d5b81dc7b'), false);
});

test('isMongoObjectIdString: rejects empty', () => {
  assert.equal(isMongoObjectIdString(''), false);
  assert.equal(isMongoObjectIdString(null), false);
});
