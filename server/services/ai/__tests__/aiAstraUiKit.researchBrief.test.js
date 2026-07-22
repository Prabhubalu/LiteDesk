'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeAstraVisuals,
  composeAstraUiFromWebResearch,
  mergeAstraUiBlocks,
} = require('../aiAstraUiKit');

describe('Astra research_brief UI', () => {
  it('normalizes research_brief sections and facts', () => {
    const out = normalizeAstraVisuals([
      {
        component: 'research_brief',
        title: 'Vtiger CRM',
        summary: 'AI-powered CRM.',
        facts: [{ label: 'CEO', value: 'Sreenivas Kanumuru' }],
        sections: [
          { title: 'Overview', body: 'Vtiger is a CRM company.', bullets: ['Bootstrapped'] },
          { title: 'Empty', body: '', bullets: [] },
        ],
        sources: ['https://www.vtiger.com/'],
      },
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0].component, 'research_brief');
    assert.equal(out[0].facts[0].value, 'Sreenivas Kanumuru');
    assert.equal(out[0].sections.length, 1);
    assert.equal(out[0].sections[0].title, 'Overview');
  });

  it('composes kpi + research_brief (no callout) from extracted brief', () => {
    const visuals = composeAstraUiFromWebResearch({
      headline: 'Vtiger CRM research',
      summary: 'Detailed overview of Vtiger.',
      facts: [
        { label: 'CEO', value: 'Sreenivas Kanumuru' },
        { label: 'HQ', value: 'Bengaluru' },
      ],
      sections: [
        { title: 'Overview', body: 'Long overview text here.', bullets: ['CRM'] },
        { title: 'Leadership', body: 'Led by Sreenivas Kanumuru.', bullets: [] },
        { title: 'Extra', body: 'Should be dropped.', bullets: [] },
      ],
      callout: { title: 'Takeaway', body: 'Strong product focus.', tone: 'insight' },
      sources: ['https://www.zoominfo.com/'],
    });
    assert.ok(visuals.some((v) => v.component === 'kpi_strip'));
    assert.ok(visuals.some((v) => v.component === 'research_brief'));
    assert.equal(visuals.some((v) => v.component === 'callout'), false);
    const brief = visuals.find((v) => v.component === 'research_brief');
    assert.equal(brief.sections.length, 3);
  });

  it('keeps composed research_brief when merging agent visuals', () => {
    const composed = composeAstraUiFromWebResearch({
      headline: 'Acme',
      summary: 'Summary',
      sections: [{ title: 'Overview', body: 'Body' }],
    });
    const merged = mergeAstraUiBlocks({
      composed,
      fromAgent: [
        { component: 'chart', chartType: 'pie', points: [{ label: 'A', value: 1 }] },
        { component: 'callout', body: 'Extra insight', tone: 'insight' },
      ],
    });
    assert.ok(merged.some((v) => v.component === 'research_brief'));
    assert.ok(merged.some((v) => v.component === 'callout' && v.body === 'Extra insight'));
    assert.equal(merged.some((v) => v.component === 'chart'), false);
  });
});
