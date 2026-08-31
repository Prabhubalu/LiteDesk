'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { detectMergeTags, applyMergeTagMappings } = require('../mergeTagDetector');
const { sanitizeEmailHtml } = require('../htmlSanitizerService');
const { analyzeEmailHtml } = require('../htmlAnalysisService');
const { htmlToGrapesDefinition } = require('../htmlToGrapesDefinition');

describe('mergeTagDetector', () => {
  it('detects handlebars, mailchimp, salesforce, and bracket tags', () => {
    const html = `
      <p>Hello {{FirstName}} and *|FNAME|* and %COMPANY% and [[firstname]]</p>
    `;
    const tags = detectMergeTags(html);
    const raws = tags.map((tag) => tag.raw);
    assert.ok(raws.includes('{{FirstName}}'));
    assert.ok(raws.includes('*|FNAME|*'));
    assert.ok(raws.includes('%COMPANY%'));
    assert.ok(raws.includes('[[firstname]]'));
  });

  it('applies merge mappings to Arivu tokens', () => {
    const html = '<p>Hi {{FirstName}}</p>';
    const mapped = applyMergeTagMappings(html, {
      '{{FirstName}}': { path: 'People.firstName' }
    });
    assert.equal(mapped, '<p>Hi {{People.firstName}}</p>');
  });
});

describe('htmlSanitizerService', () => {
  it('removes scripts and iframes', () => {
    const input = '<html><script>alert(1)</script><iframe src="x"></iframe><p>OK</p></html>';
    const { html, removals } = sanitizeEmailHtml(input);
    assert.ok(!html.includes('<script'));
    assert.ok(!html.includes('<iframe'));
    assert.ok(html.includes('OK'));
    assert.ok(removals.some((item) => item.type === 'javascript'));
    assert.ok(removals.some((item) => item.type === 'iframe'));
  });

  it('extracts inline style blocks to css', () => {
    const input = '<style>.a{color:red}</style><p class="a">Hi</p>';
    const { html, css } = sanitizeEmailHtml(input);
    assert.ok(!html.includes('<style'));
    assert.match(css, /\.a/);
  });
});

describe('htmlAnalysisService', () => {
  it('returns analysis report and grapes definition', async () => {
    const html = `
      <!DOCTYPE html>
      <html><head><title>Welcome Email</title></head>
      <body>
        <table width="600"><tr><td style="color:#333">Hi {{FirstName}}</td></tr></table>
        <a href="https://example.com">Link</a>
        <img src="logo.png" alt="Logo" />
      </body></html>
    `;
    const result = await analyzeEmailHtml({ html });
    assert.equal(result.checks.htmlValid, true);
    assert.equal(result.checks.tablesDetected, true);
    assert.equal(result.checks.linksFound, true);
    assert.equal(result.checks.mergeTagsFound, true);
    assert.equal(result.suggestedName, 'Welcome Email');
    assert.equal(result.jsonDefinition.engine, 'grapesjs');
    assert.match(result.jsonDefinition.html, /{{FirstName}}/);
  });
});

describe('emailHtmlPrepareService', () => {
  it('extracts body inner HTML from full documents', () => {
    const { extractEmailBodyHtml } = require('../emailHtmlPrepareService');
    const html = `<!DOCTYPE html><html><head><title>T</title><style>.x{color:red}</style></head><body><table width="600"><tr><td>Hello</td></tr></table></body></html>`;
    const body = extractEmailBodyHtml(html);
    assert.match(body, /<table width="600"/);
    assert.ok(!body.includes('<html'));
    assert.ok(!body.includes('<head'));
  });
});

describe('htmlAnalysisService full document import', () => {
  it('stores body-only html in grapes definition', async () => {
    const html = `<!DOCTYPE html><html><head><style>body{margin:0}</style></head><body><table><tr><td>Hi {{FirstName}}</td></tr></table></body></html>`;
    const result = await analyzeEmailHtml({ html });
    assert.ok(!result.jsonDefinition.html.includes('<html'));
    assert.match(result.jsonDefinition.html, /<table>/);
    assert.match(result.jsonDefinition.css, /body/);
  });
});

describe('hubspotConditionalService', () => {
  it('strips if/else blocks keeping primary branch content', async () => {
    const { processHubspotConditionals } = require('../hubspotConditionalService');
    const html = '<p>{% if contact %}Hi{% else %}Hello{% endif %}</p>';
    const result = processHubspotConditionals({ html, mode: 'strip' });
    assert.equal(result.html, '<p>Hi</p>');
    const analyzed = await analyzeEmailHtml({ html, hubspotConditionalMode: 'strip' });
    assert.ok(!analyzed.sanitizedHtml.includes('{%'));
  });
});
