'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeWebformFieldValues } = require('../../utils/webformInputSanitizer');

describe('webformInputSanitizer', () => {
  it('strips HTML and escapes text answers', () => {
    const fields = [{ fieldId: 'name', type: 'Text' }];
    const values = { name: '<script>alert(1)</script>Jane' };
    const sanitized = sanitizeWebformFieldValues(fields, values);
    assert.equal(sanitized.name, 'alert(1)Jane');
  });

  it('leaves checkbox values unchanged', () => {
    const fields = [{ fieldId: 'agree', type: 'Checkbox' }];
    const values = { agree: true };
    const sanitized = sanitizeWebformFieldValues(fields, values);
    assert.equal(sanitized.agree, true);
  });
});
