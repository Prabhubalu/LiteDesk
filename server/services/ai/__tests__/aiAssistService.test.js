const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { buildCaseContextText } = require('../aiAssistService');

describe('aiAssistService.buildCaseContextText', () => {
  it('includes title and redacts email from description', () => {
    const text = buildCaseContextText({
      caseId: 'C-1',
      title: 'Login issue',
      status: 'Open',
      priority: 'High',
      description: 'Contact me at user@example.com',
      activities: [],
    });
    assert.match(text, /Login issue/);
    assert.match(text, /\[EMAIL\]/);
    assert.doesNotMatch(text, /user@example\.com/);
  });
});
