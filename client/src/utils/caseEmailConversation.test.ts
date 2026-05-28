import { describe, expect, it } from 'vitest';
import { buildCaseEmailConversationItems, isCaseEmailMessageActivity } from './caseEmailConversation.js';

describe('caseEmailConversation', () => {
  it('detects mailroom-backed email activities', () => {
    expect(
      isCaseEmailMessageActivity({
        activityType: 'channel_message_received',
        metadata: { mailroomMessageId: 'm1' }
      })
    ).toBe(true);
    expect(isCaseEmailMessageActivity({ activityType: 'comment' })).toBe(false);
  });

  it('merges threads and dedupes threaded communications', () => {
    const items = buildCaseEmailConversationItems({
      emailThreads: [
        {
          threadId: 't1',
          lastActivityAt: '2026-01-02T10:00:00Z',
          messages: [{ _id: 'comm-1', direction: 'inbound' }]
        }
      ],
      activities: [
        {
          _id: 'a1',
          activityType: 'status_changed',
          createdAt: '2026-01-01T09:00:00Z',
          metadata: { fromStatus: 'New', toStatus: 'Assigned' }
        },
        {
          _id: 'a2',
          activityType: 'email_sent',
          createdAt: '2026-01-02T09:30:00Z',
          metadata: { communicationId: 'comm-1' },
          message: 'dup'
        }
      ]
    });
    expect(items.some((i) => i.kind === 'system')).toBe(true);
    expect(items.some((i) => i.kind === 'message')).toBe(true);
    expect(items.filter((i) => i.kind === 'message')).toHaveLength(1);
  });

  it('includes internal comments in the conversation feed', () => {
    const items = buildCaseEmailConversationItems({
      activities: [
        {
          _id: 'ic1',
          activityType: 'comment',
          internal: true,
          createdAt: '2026-01-02T11:00:00Z',
          message: 'Hello @[Jane](user:u1)',
          actorName: 'Support Agent'
        }
      ]
    });
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('internal_comment');
  });
});
