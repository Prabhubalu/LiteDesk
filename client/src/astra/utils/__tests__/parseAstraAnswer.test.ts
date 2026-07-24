import { describe, expect, it } from 'vitest';
import { parseAstraAnswer } from '../parseAstraAnswer';

describe('parseAstraAnswer', () => {
  it('splits prose, steps, and draft follow-up', () => {
    const sections = parseAstraAnswer(`
Iphone 17 Pro Max quote is **Expired**.

**Concrete next steps**
1. Open the quote and confirm line items.
2. Revise or close the quote.
3. Follow up with the contact.

**Draft follow-up** (keep short; replace brackets):
Hi Prabhu,

Wanted to reconnect on QT-0003.

Best,
[Your Name]
`);
    const types = sections.map((s) => s.type);
    expect(types).toContain('prose');
    expect(types).toContain('steps');
    expect(types).toContain('draft');

    const steps = sections.find((s) => s.type === 'steps');
    expect(steps && steps.type === 'steps' && steps.items.length).toBe(3);

    const draft = sections.find((s) => s.type === 'draft');
    expect(draft && draft.type === 'draft' && draft.body).toMatch(/Hi Prabhu/);
    expect(draft && draft.type === 'draft' && draft.title).toMatch(/Draft follow-up/i);

    const prose = sections.find((s) => s.type === 'prose');
    expect(prose && prose.type === 'prose' && prose.html).not.toMatch(/Concrete next steps/i);
  });

  it('parses fenced draft blocks', () => {
    const sections = parseAstraAnswer(`Summary here.

\`\`\`
Subject: Hello
Body line
\`\`\`
`);
    const draft = sections.find((s) => s.type === 'draft');
    expect(draft && draft.type === 'draft' && draft.body).toMatch(/Subject: Hello/);
  });

  it('treats open-deal inventories as inventory, not next steps', () => {
    const sections = parseAstraAnswer(`You have 3 open deals:
1. ReportsE2E Deal MR54T40F-4 — Negotiation — $233,635
2. ReportsE2E Deal MR54T40F-8 — New — $158,231
3. ReportsE2E Deal MR54T40F-10 — Proposal — $66,699
`);
    const inventory = sections.find((s) => s.type === 'inventory');
    expect(inventory && inventory.type === 'inventory' && inventory.items.length).toBe(3);
    expect(sections.some((s) => s.type === 'steps')).toBe(false);
  });

  it('merges split next-steps lists into one card', () => {
    const sections = parseAstraAnswer(`I'd suggest:

1. Revise and resend QT-0003 with a fresh validity window.

**Next steps**
1. Reference the deal stage (Negotiation) and Sample Deal in your message.
`);
    const stepsSections = sections.filter((s) => s.type === 'steps');
    expect(stepsSections.length).toBe(1);
    const steps = stepsSections[0];
    expect(steps && steps.type === 'steps' && steps.items.length).toBe(2);
  });
});
