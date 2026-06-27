'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  CONTENT_COMPONENT_TYPES,
  isRegisteredContentComponentType,
  isRootContentComponentType
} = require('../contentComponentRegistry');

describe('contentComponentRegistry', () => {
  it('registers MVP component types', () => {
    assert.equal(isRegisteredContentComponentType(CONTENT_COMPONENT_TYPES.PAGE), true);
    assert.equal(isRegisteredContentComponentType(CONTENT_COMPONENT_TYPES.MERGE_TAG), true);
    assert.equal(isRegisteredContentComponentType('UnknownType'), false);
  });

  it('identifies root component types', () => {
    assert.equal(isRootContentComponentType(CONTENT_COMPONENT_TYPES.PAGE), true);
    assert.equal(isRootContentComponentType(CONTENT_COMPONENT_TYPES.SECTION), false);
  });
});
