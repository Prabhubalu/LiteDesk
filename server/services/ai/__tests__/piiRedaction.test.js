const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { redactText, redactMessages } = require('../piiRedaction');

describe('piiRedaction', () => {
  it('redacts emails and api keys', () => {
    const out = redactText('Contact ada@example.com with sk_test_abcdefghijklmnopqrstuvwxyz');
    assert.match(out, /\[EMAIL\]/);
    assert.match(out, /\[API_KEY\]/);
    assert.doesNotMatch(out, /ada@example\.com/);
  });

  it('can preserve emails for staff work-graph compose', () => {
    const out = redactText('Contact ada@example.com with sk_test_abcdefghijklmnopqrstuvwxyz', {
      preserveEmails: true,
    });
    assert.match(out, /ada@example\.com/);
    assert.match(out, /\[API_KEY\]/);
    assert.doesNotMatch(out, /\[EMAIL\]/);
  });

  it('redacts message content arrays', () => {
    const out = redactMessages([
      { role: 'user', content: 'My card is 4111 1111 1111 1111' },
    ]);
    assert.equal(out[0].role, 'user');
    assert.match(out[0].content, /\[CARD\]/);
  });
});
