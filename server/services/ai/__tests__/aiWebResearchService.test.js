'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeHttpUrl,
  extractWebsiteFromContext,
  guessWebsiteFromQuestion,
  htmlToText,
  isPrivateIp,
  looksLikeWebResearchQuestion,
  agentAllowsWebResearch,
} = require('../aiWebResearchService');

describe('aiWebResearchService', () => {
  it('normalizes website hosts to https', () => {
    assert.equal(normalizeHttpUrl('www.vtiger.com').hostname, 'www.vtiger.com');
    assert.equal(normalizeHttpUrl('vtiger.com').protocol, 'https:');
  });

  it('blocks private and local hosts', () => {
    assert.equal(normalizeHttpUrl('http://127.0.0.1/admin'), null);
    assert.equal(normalizeHttpUrl('http://localhost/x'), null);
    assert.equal(isPrivateIp('10.0.0.1'), true);
    assert.equal(isPrivateIp('8.8.8.8'), false);
  });

  it('extracts website from CRM context lines', () => {
    const u = extractWebsiteFromContext('name: Vtiger\nwebsite: https://www.vtiger.com\n');
    assert.equal(u.hostname, 'www.vtiger.com');
  });

  it('strips html scripts to text', () => {
    const out = htmlToText('<html><head><title>Hi</title><script>evil()</script></head><body><p>Hello world content here</p></body></html>');
    assert.equal(out.title, 'Hi');
    assert.match(out.text, /Hello world/);
    assert.doesNotMatch(out.text, /evil/);
  });

  it('detects research questions and research agents', () => {
    assert.equal(looksLikeWebResearchQuestion('Review case studies'), true);
    assert.equal(looksLikeWebResearchQuestion('what is my deal stage'), false);
    assert.equal(looksLikeWebResearchQuestion('I want more details about their business'), true);
    assert.equal(
      looksLikeWebResearchQuestion(
        'Get me detail analysis of Vtiger CRM, market, target audience, get it from internet if not available locally',
      ),
      true,
    );
    assert.equal(guessWebsiteFromQuestion('analysis of Vtiger CRM market').hostname, 'vtiger.com');
    assert.equal(agentAllowsWebResearch({
      name: 'Research Agent',
      capabilities: [],
      triggerPhrases: ['research company'],
    }), true);
    assert.equal(agentAllowsWebResearch({
      name: 'Deal Analyze',
      capabilities: [],
      triggerPhrases: ['analyze deal'],
    }), false);
    assert.equal(agentAllowsWebResearch({
      name: 'Deal Analyze',
      capabilities: ['web_research'],
    }), true);
    assert.equal(looksLikeWebResearchQuestion('Who is the CEO?'), true);
    assert.equal(looksLikeWebResearchQuestion('who founded Vtiger'), true);
  });

  it('treats CEO asks as company leadership, not CRM contact sticky', () => {
    const { isCompanyLeadershipQuestion } = require('../aiWebResearchService');
    assert.equal(isCompanyLeadershipQuestion('Who is the CEO?'), true);
    assert.equal(isCompanyLeadershipQuestion('Who is the CEO of Vtiger CRM?'), true);
    assert.equal(isCompanyLeadershipQuestion('draft an email to Prabhu'), false);
  });

  it('extracts contact emails and deep-links Contact Us paths', () => {
    const {
      extractContactFactsFromText,
      extractSameHostDeepLinks,
      extractSameHostLinks,
      researchPathsForQuestion,
      wantsDeepWebDig,
      buildSiteDossier,
      SITE_SEED_PATHS,
      pickBestContactPhone,
      isCompanyContactFactQuestion,
    } = require('../aiWebResearchService');

    const facts = extractContactFactsFromText(
      'General info@vtiger.com Human Resources hr@vtiger.com Support support@vtiger.com',
    );
    assert.ok(facts.emails.includes('support@vtiger.com'));
    assert.ok(facts.emails.includes('hr@vtiger.com'));

    // Real Vtiger contact-page pattern: toll-free sales phone vs Austin ZIP+street false positive
    const pageText = [
      'Sales Phone Sales & Support U.S. & Global 1-877-784-9277',
      'Bengaluru, India +91 9243602352',
      'United States 7500 Rialto Blvd., Suite 1-250, Austin, TX 78735',
      '22028 Lindy Lane, Cupertino, CA 95014',
    ].join(' ');
    const phones = extractContactFactsFromText(pageText);
    assert.equal(phones.phones.some((p) => /78735/.test(p)), false);
    assert.ok(phones.phones.some((p) => p.replace(/\D/g, '').includes('8777849277')));
    const best = pickBestContactPhone(phones.phoneDetails, 'Give me the sales phone number of Vtiger CRM');
    assert.ok(best);
    assert.ok(best.number.replace(/\D/g, '').includes('8777849277'));
    const { selectContactPhones, selectContactEmails } = require('../aiWebResearchService');
    const allPhones = selectContactPhones(phones.phoneDetails, 'Give me the sales phone numbers of Vtiger CRM');
    assert.ok(allPhones.length >= 2);
    assert.ok(allPhones.some((p) => p.number.replace(/\D/g, '').includes('8777849277')));
    assert.ok(allPhones.some((p) => p.number.replace(/\D/g, '').includes('919243602352')));
    const indiaOnly = selectContactPhones(phones.phoneDetails, 'Give me indian phone number');
    assert.equal(indiaOnly.length, 1);
    assert.ok(indiaOnly[0].number.replace(/\D/g, '').includes('919243602352'));
    const emails = selectContactEmails(
      ['info@vtiger.com', 'support@vtiger.com', 'sales@vtiger.com', 'hr@vtiger.com'],
      'give me emails',
    );
    assert.equal(emails.length, 4);
    assert.equal(isCompanyContactFactQuestion('Give me the sales phone number of Vtiger CRM'), true);
    assert.equal(isCompanyContactFactQuestion('Give me indian phone number'), true);
    assert.equal(looksLikeWebResearchQuestion('Give me the sales phone number of Vtiger CRM'), true);

    const links = extractSameHostDeepLinks(
      '<a href="/contact-us">Contact</a><a href="https://www.vtiger.com/support">Support</a><a href="https://other.com/x">x</a>',
      'https://www.vtiger.com/',
    );
    assert.ok(links.some((u) => /contact-us/i.test(u)));
    assert.ok(links.some((u) => /support/i.test(u)));
    assert.equal(links.some((u) => /other\.com/i.test(u)), false);

    const allLinks = extractSameHostLinks(
      '<a href="/pricing">Pricing</a><a href="/products">Products</a><a href="/logo.png">img</a>',
      'https://www.vtiger.com/',
      { limit: 20, minScore: 1 },
    );
    assert.ok(allLinks.some((u) => /pricing/i.test(u)));
    assert.ok(allLinks.some((u) => /products/i.test(u)));
    assert.equal(allLinks.some((u) => /\.png/i.test(u)), false);

    const paths = researchPathsForQuestion('get me the support email id');
    assert.ok(paths.some((p) => /contact/i.test(p)));
    assert.ok(SITE_SEED_PATHS.includes('/contact-us'));
    assert.equal(wantsDeepWebDig('How to contact Vtiger support?'), true);
    assert.equal(looksLikeWebResearchQuestion('get me the support email id?'), true);

    const dossier = buildSiteDossier([
      { title: 'Contact', url: 'https://www.vtiger.com/contact-us', text: 'support@vtiger.com' },
      { title: 'About', url: 'https://www.vtiger.com/about', text: 'About Vtiger CRM' },
    ], 'vtiger.com');
    assert.ok(dossier.contactFacts.emails.includes('support@vtiger.com'));
    assert.equal(dossier.pageIndex.length, 2);

    const {
      isAllowedExternalHost,
      extractExternalResearchLinks,
      buildPublicSearchUrls,
    } = require('../aiWebResearchService');
    assert.equal(isAllowedExternalHost('www.linkedin.com'), true);
    assert.equal(isAllowedExternalHost('instagram.com'), true);
    assert.equal(isAllowedExternalHost('evil.internal'), false);
    const social = extractExternalResearchLinks(
      '<a href="https://www.linkedin.com/company/vtiger">LI</a>'
      + '<a href="https://www.facebook.com/vtiger">FB</a>'
      + '<a href="https://evil.com/x">x</a>',
    );
    assert.ok(social.some((u) => /linkedin\.com/i.test(u)));
    assert.ok(social.some((u) => /facebook\.com/i.test(u)));
    assert.equal(social.some((u) => /evil\.com/i.test(u)), false);
    const searches = buildPublicSearchUrls('Who is the CEO?', 'vtiger');
    assert.ok(searches.some((u) => /duckduckgo|linkedin|wikipedia|crunchbase|bing\.com/i.test(u)));
    assert.ok(searches.some((u) => /Vtiger(\+|%20|\s)CRM(\+|%20|\s)CEO|CEO/i.test(decodeURIComponent(u))));
  });

  it('extracts brand and CEO facts from search-style evidence (Vtiger)', () => {
    const {
      extractBrandFromQuestion,
      extractLeadershipFactsFromText,
      aggregateLeadershipFacts,
      guessWebsiteFromQuestion,
    } = require('../aiWebResearchService');

    assert.equal(extractBrandFromQuestion('Who is the CEO of Vtiger?').toLowerCase(), 'vtiger');
    assert.equal(extractBrandFromQuestion('Who is the CEO?'), '');
    assert.ok(guessWebsiteFromQuestion('Who is the CEO of Vtiger?'));

    const zoom = 'Sreenivas Kanumuru - Chief Executive Officer at Vtiger';
    const facts = extractLeadershipFactsFromText(zoom, 'vtiger');
    assert.ok(facts.some((f) => /sreenivas/i.test(f.person) && f.role === 'CEO'));

    // Reject wrong-company CEO claims
    const wrong = extractLeadershipFactsFromText(
      'Rashmi Sinha is the CEO of SlideShare',
      'vtiger',
    );
    assert.equal(wrong.length, 0);

    const ranked = aggregateLeadershipFacts([
      {
        title: zoom,
        snippet: 'The CEO of Vtiger is Sreenivas Kanumuru',
        text: zoom,
        url: 'https://www.zoominfo.com/c/vtiger/1',
        fromGoogleCse: true,
      },
      {
        title: 'About LinkedIn',
        text: 'Rashmi Sinha is a founder somewhere',
        url: 'https://www.linkedin.com/company/vtiger',
      },
    ], 'vtiger');
    assert.ok(ranked[0] && /sreenivas/i.test(ranked[0].person));
  });

  it('routes named company detail analysis to research, not CRM industry chart', () => {
    const { isNamedCompanyResearchAsk, looksLikeWebResearchQuestion } = require('../aiWebResearchService');
    const { isCrmDataAsk } = require('../aiAstraReportBuilderService');
    const q = "Give me in detail analysis of 'Vtiger CRM' Organization.";
    assert.equal(isNamedCompanyResearchAsk(q), true);
    assert.equal(looksLikeWebResearchQuestion(q), true);
    assert.equal(isCrmDataAsk(q), false);
    assert.equal(isCrmDataAsk('Show organizations by industry chart'), true);
    assert.equal(isNamedCompanyResearchAsk('Show organizations by industry'), false);
  });

  it('enriches research facts and drops General knowledge placeholders', () => {
    const {
      enrichResearchBriefFacts,
      isPlaceholderFactValue,
      isPlausiblePersonName,
      extractLeadershipFactsFromText,
    } = require('../aiWebResearchService');
    assert.equal(isPlaceholderFactValue('General knowledge (verify on Google/LinkedIn)'), true);
    assert.equal(isPlaceholderFactValue('Sreenivas Kanumuru'), false);
    assert.equal(isPlaceholderFactValue('Who is the'), true);
    assert.equal(isPlausiblePersonName('Who is the'), false);
    assert.equal(isPlausiblePersonName('Who Is The'), false);
    assert.equal(isPlausiblePersonName('Sreenivas Kanumuru'), true);

    // Must not parse "Who is the CEO of Vtiger" as person "Who Is The"
    const bad = extractLeadershipFactsFromText('Who Is The CEO of Vtiger CRM', 'vtiger');
    assert.equal(bad.some((f) => /who/i.test(f.person)), false);

    const good = extractLeadershipFactsFromText(
      'Sreenivas Kanumuru - Chief Executive Officer at Vtiger',
      'vtiger',
    );
    assert.ok(good.some((f) => /sreenivas/i.test(f.person)));

    const facts = enrichResearchBriefFacts({
      facts: [
        { label: 'CEO', value: 'Who is the' },
        { label: 'HQ', value: 'San Francisco, CA' },
        { label: 'Founded', value: '2001' },
        { label: 'Website', value: 'https://www.vti...' },
      ],
      leadershipFacts: [
        { role: 'CEO', person: 'Sreenivas Kanumuru', evidence: 'CEO of Vtiger is Sreenivas Kanumuru' },
      ],
      websiteUrl: 'https://www.vtiger.com/',
      dossierText: 'Vtiger is headquartered in Bengaluru, India. Founded in 2004. Sreenivas Kanumuru',
      brand: 'vtiger',
      strict: true,
    });
    assert.ok(facts.some((f) => f.label === 'CEO' && /Sreenivas/i.test(f.value)));
    assert.ok(facts.some((f) => f.label === 'Website' && /vtiger\.com/i.test(f.value)));
    assert.ok(facts.some((f) => f.label === 'HQ' && /Bengaluru/i.test(f.value)));
    assert.equal(facts.some((f) => /who is the/i.test(f.value)), false);
    assert.equal(facts.some((f) => /San Francisco/i.test(f.value)), false);

    const { buildFallbackResearchBrief, isJunkResearchText } = require('../aiWebResearchService');
    assert.equal(isJunkResearchText('5 key findings'), true);
    assert.equal(isJunkResearchText('...'), true);
    assert.equal(
      isJunkResearchText(
        'Search excerpt: Vtiger CRM CEO - Search html{--bing-smtc-shadows-card-hover-1:0 0 0 1px rgba(0,0,0,.05)',
      ),
      true,
    );
    const { softTruncate } = require('../aiWebResearchService');
    // Soft truncate must not end mid-word like "Kanumu…" from "Kanumuru"
    assert.equal(softTruncate('CEO: Sreenivas Kanumuru leads Vtiger CRM', 28), 'CEO: Sreenivas Kanumuru…');
    const fb = buildFallbackResearchBrief({
      brand: 'vtiger',
      dossierText: [
        '=== WEB SEARCH SNIPPETS ===',
        '• Vtiger CRM: Cloud CRM for SMBs with sales and support',
        '• Sreenivas Kanumuru - Chief Executive Officer at Vtiger',
      ].join('\n'),
      leadershipFacts: [
        { role: 'CEO', person: 'Sreenivas Kanumuru', evidence: 'CEO at Vtiger' },
      ],
      websiteUrl: 'https://www.vtiger.com/',
      urlsFetched: ['https://www.bing.com/search?q=vtiger'],
    });
    assert.ok(fb.bullets.length >= 2);
    assert.equal(fb.bullets.some((b) => /5 key findings/i.test(b)), false);
    assert.ok(fb.sections.length >= 1 && fb.sections.length <= 2);
    assert.equal(fb.detail, '');
    assert.ok(fb.facts.some((f) => /Sreenivas/i.test(f.value)));
  });
});
