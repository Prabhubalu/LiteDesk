'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  validateTemplateDefinition,
  assertValidTemplateDefinition
} = require('../../services/contentPlatform/contentTemplateValidationService');
const { ContentPlatformError } = require('../../utils/contentPlatformErrors');
const { CONTENT_COMPONENT_TYPES } = require('../contentComponentRegistry');

describe('contentTemplateValidationService', () => {
  it('accepts a minimal Page root definition', () => {
    const result = validateTemplateDefinition({
      id: 'root',
      type: CONTENT_COMPONENT_TYPES.PAGE,
      layout: {},
      style: {},
      bindings: {},
      visibility: {},
      children: []
    });

    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  });

  it('rejects unknown component types', () => {
    const result = validateTemplateDefinition({
      id: 'root',
      type: 'NotARealComponent',
      children: []
    });

    assert.equal(result.valid, false);
    assert.ok(result.errors.some((issue) => issue.message.includes('Unsupported component type')));
  });

  it('throws ContentPlatformError from assertValidTemplateDefinition', () => {
    assert.throws(
      () => assertValidTemplateDefinition(null),
      (error) => error instanceof ContentPlatformError
    );
  });
});
