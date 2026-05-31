import { describe, expect, it } from 'vitest';
import {
  formatCaseCannedResponseMergeTag,
  listCaseCannedResponseMergeTags
} from '@/constants/caseCannedResponseMergeTags';
import { insertTextAtCursor } from '@/utils/insertAtCursor';

describe('caseCannedResponseMergeTags', () => {
  it('formats merge tags with double braces', () => {
    expect(formatCaseCannedResponseMergeTag('case.title')).toBe('{{case.title}}');
  });

  it('lists all supported merge tags', () => {
    const tokens = listCaseCannedResponseMergeTags().map((tag) => tag.token);
    expect(tokens).toContain('case.caseId');
    expect(tokens).toContain('contact.firstName');
    expect(tokens).toContain('agent.name');
  });
});

describe('insertTextAtCursor', () => {
  it('inserts at the current selection', () => {
    const el = {
      value: 'Hi ',
      selectionStart: 3,
      selectionEnd: 3
    };

    const result = insertTextAtCursor(el, '{{contact.firstName}}');
    expect(result.value).toBe('Hi {{contact.firstName}}');
    expect(result.cursor).toBe(24);
  });
});
