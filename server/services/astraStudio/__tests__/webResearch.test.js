'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  extractCompetitorNames,
  researchCompetitors,
  webSearch,
  isWebResearchEnabled,
} = require('../../astra/tools/webResearch');

describe('astra web research', () => {
  it('extracts competitor names from titles and snippets', () => {
    const names = extractCompetitorNames(
      [
        {
          title: 'Salesforce vs HubSpot — CRM comparison',
          snippet: 'Alternatives to Arivu: Salesforce, HubSpot, and Zoho CRM',
          url: 'https://example.com/a',
        },
      ],
      'Arivu',
    );
    assert.ok(names.includes('Salesforce'));
    assert.ok(names.includes('HubSpot'));
  });

  it('rejects listicle junk as competitor names', () => {
    const names = extractCompetitorNames(
      [
        {
          title: 'Alternatives In 2026 — Best CRM list',
          snippet: 'Competitors Of 2026 named in public web results',
          url: 'https://example.com/junk',
        },
      ],
      'Arivu',
    );
    assert.ok(!names.some((n) => /alternatives|competitors|2026/i.test(n)));
  });

  it('researchCompetitors lists named peers not listicle titles', async () => {
    const prev = global.fetch;
    global.fetch = async (url) => {
      const u = String(url);
      if (u.includes('duckduckgo')) {
        return {
          ok: true,
          text: async () => `
            <a class="result__a" href="https://example.com/list">Best Arivu Software Alternatives & Competitors in 2026 - TrustRadius</a>
            <a class="result__snippet">Compare CRM options in 2026.</a>
          `,
        };
      }
      throw new Error(`unexpected fetch ${u}`);
    };
    try {
      delete process.env.TAVILY_API_KEY;
      delete process.env.BRAVE_SEARCH_API_KEY;
      process.env.ASTRA_WEB_RESEARCH = 'true';
      const result = await researchCompetitors({
        subject: 'Arivu',
        customer: 'Vtiger CRM',
        industry: 'CRM',
        limit: 3,
      });
      assert.equal(result.ok, true);
      assert.ok(result.competitors.length >= 1);
      assert.ok(result.competitors.some((n) => /Salesforce|HubSpot|Zoho|Pipedrive/i.test(n)));
      assert.ok(!/• Web:/i.test(result.body));
      assert.ok(/• Competitor:/i.test(result.body));
      assert.ok(/• Source:.*https?:\/\//i.test(result.body));
    } finally {
      global.fetch = prev;
    }
  });

  it('webSearch respects kill switch', async () => {
    const prev = process.env.ASTRA_WEB_RESEARCH;
    process.env.ASTRA_WEB_RESEARCH = 'false';
    try {
      assert.equal(isWebResearchEnabled(), false);
      const result = await webSearch('test');
      assert.equal(result.ok, false);
      assert.equal(result.error, 'WEB_RESEARCH_DISABLED');
    } finally {
      process.env.ASTRA_WEB_RESEARCH = prev;
    }
  });
});
