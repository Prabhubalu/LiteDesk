'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { CONTENT_COMPONENT_TYPES } = require('../contentComponentRegistry');
const {
  CONTENT_COMPONENT_METADATA,
  getContentComponentMetadata,
  isAllowedChildComponent
} = require('../contentComponentMetadata');

describe('contentComponentMetadata', () => {
  it('defines metadata for every registered component type', () => {
    for (const type of Object.values(CONTENT_COMPONENT_TYPES)) {
      assert.ok(getContentComponentMetadata(type), `missing metadata for ${type}`);
    }
  });

  it('requires core contract fields on every entry', () => {
    for (const entry of Object.values(CONTENT_COMPONENT_METADATA)) {
      assert.ok(entry.purpose, `${entry.type} missing purpose`);
      assert.ok(Array.isArray(entry.howItWorks) && entry.howItWorks.length, `${entry.type} missing howItWorks`);
      assert.ok(entry.supportedOutputs, `${entry.type} missing supportedOutputs`);
      assert.ok(entry.allowedChildren, `${entry.type} missing allowedChildren`);
      assert.ok(Array.isArray(entry.keyProperties), `${entry.type} missing keyProperties`);
      assert.ok(Array.isArray(entry.specialBehaviors), `${entry.type} missing specialBehaviors`);
      assert.ok(entry.aiDescription, `${entry.type} missing aiDescription`);
    }
  });

  it('prevents nesting Page inside Section', () => {
    assert.equal(isAllowedChildComponent(CONTENT_COMPONENT_TYPES.SECTION, CONTENT_COMPONENT_TYPES.PAGE), false);
    assert.equal(isAllowedChildComponent(CONTENT_COMPONENT_TYPES.SECTION, CONTENT_COMPONENT_TYPES.HEADING), true);
  });

  it('marks leaf components as non-containers', () => {
    assert.equal(isAllowedChildComponent(CONTENT_COMPONENT_TYPES.HEADING, CONTENT_COMPONENT_TYPES.PARAGRAPH), false);
    assert.equal(isAllowedChildComponent(CONTENT_COMPONENT_TYPES.TABLE, CONTENT_COMPONENT_TYPES.MERGE_TAG), false);
  });
});
