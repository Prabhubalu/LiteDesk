import { describe, expect, it } from 'vitest';
import {
  buildCaseEmailReplyDraft,
  htmlBodyHasText,
  isEmailChannelCase,
  resolveCaseReplyToEmail
} from './caseEmailReply';

describe('caseEmailReply', () => {
  it('detects email channel case-insensitively', () => {
    expect(isEmailChannelCase({ channel: 'Email' })).toBe(true);
    expect(isEmailChannelCase({ channel: 'email' })).toBe(true);
    expect(isEmailChannelCase({ channel: 'Live Chat' })).toBe(false);
  });

  it('builds reply subject and threads to latest message', () => {
    const draft = buildCaseEmailReplyDraft({
      caseRecord: { title: 'Login issue' },
      contactEmail: 'user@example.com',
      emailThreads: [
        {
          subject: 'Help needed',
          messages: [{ _id: 'msg-1' }, { _id: 'msg-2' }]
        }
      ]
    });
    expect(draft.to).toBe('user@example.com');
    expect(draft.subject).toBe('Re: Help needed');
    expect(draft.parentCommunicationId).toBe('msg-2');
  });

  it('htmlBodyHasText ignores empty markup', () => {
    expect(htmlBodyHasText('<p></p>')).toBe(false);
    expect(htmlBodyHasText('<p>Hello</p>')).toBe(true);
  });

  it('resolveCaseReplyToEmail prefers contact then thread inbound', () => {
    expect(
      resolveCaseReplyToEmail({
        caseRecord: { contactId: { email: 'contact@co.com' }, requesterEmail: 'req@co.com' }
      })
    ).toBe('contact@co.com');

    expect(
      resolveCaseReplyToEmail({
        caseRecord: {},
        emailThreads: [
          {
            messages: [
              { direction: 'outbound', toAddresses: ['agent@co.com'] },
              { direction: 'inbound', fromAddress: 'customer@thread.com' }
            ]
          }
        ]
      })
    ).toBe('customer@thread.com');
  });
});
