import { describe, expect, it } from 'vitest';
import { applyCaseCannedResponseTokens, resolveCannedResponse } from './caseCannedResponses';

describe('caseCannedResponses', () => {
  it('resolves subject and body with tokens', () => {
    const context = {
      case: { caseId: 'C-99', title: 'Login issue' },
      contact: { firstName: 'Alex', name: 'Alex Kim', email: 'alex@example.com' },
      agent: { name: 'Jordan', email: 'jordan@example.com' }
    };
    const resolved = resolveCannedResponse(
      {
        subject: 'Re: {{case.title}}',
        body: '<p>Hi {{contact.firstName}},</p>'
      },
      context
    );
    expect(resolved.subject).toBe('Re: Login issue');
    expect(resolved.body).toContain('Hi Alex');
  });

  it('leaves unknown tokens unchanged', () => {
    expect(applyCaseCannedResponseTokens('{{unknown.token}}', {})).toBe('{{unknown.token}}');
  });
});
