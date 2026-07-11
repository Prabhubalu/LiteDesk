'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  assertValidBlockDocument,
  createEmptyBlockDocument,
  ContentBlockValidationError,
} = require('../contentBlockValidationService');

describe('contentBlockValidationService', () => {
  it('accepts an empty doc with a paragraph', () => {
    const doc = createEmptyBlockDocument();
    assert.equal(doc.type, 'doc');
    assert.doesNotThrow(() => assertValidBlockDocument(doc));
  });

  it('rejects unsupported block types', () => {
    assert.throws(
      () => assertValidBlockDocument({ type: 'doc', content: [{ type: 'unknown_block' }] }),
      (error) => {
        assert.ok(error instanceof ContentBlockValidationError);
        assert.match(error.message, /not supported/);
        return true;
      },
    );
  });

  it('requires root doc type', () => {
    assert.throws(
      () => assertValidBlockDocument({ type: 'paragraph', content: [] }),
      /root type must be "doc"/,
    );
  });

  it('accepts tabs with tabItem children', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'tabs',
          content: [
            {
              type: 'tabItem',
              attrs: { label: 'Tab 1' },
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }],
            },
            {
              type: 'tabItem',
              attrs: { label: 'Tab 2' },
              content: [{ type: 'paragraph' }],
            },
          ],
        },
      ],
    };
    assert.doesNotThrow(() => assertValidBlockDocument(doc));
  });

  it('validates nested heading and text marks', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Hello', marks: [{ type: 'bold' }] }],
        },
      ],
    };
    assert.doesNotThrow(() => assertValidBlockDocument(doc));
  });
});
