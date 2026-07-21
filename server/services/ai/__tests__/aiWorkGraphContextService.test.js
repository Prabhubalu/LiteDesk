'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  flattenRecordContext,
  normalizeStructuredAnswer,
  enrichEmailActionsFromCrm,
} = require('../aiWorkGraphService');

describe('aiWorkGraphContext richness', () => {
  it('flattenRecordContext still supports legacy relatedGroups', () => {
    const { text, citations } = flattenRecordContext({
      moduleKey: 'deals',
      recordId: 'd1',
      primary: { name: 'Acme Deal' },
      relatedGroups: [
        {
          moduleKey: 'people',
          records: [{ _id: 'p1', name: 'Ada' }],
        },
      ],
    }, { _id: 'd1', name: 'Acme Deal' });
    assert.match(text, /Acme Deal/);
    assert.ok(citations.length >= 1);
    assert.match(text, /Ada/);
  });

  it('normalizeStructuredAnswer keeps verb actions and drops Open-only', () => {
    const out = normalizeStructuredAnswer({
      headline: 'Next steps',
      bullets: ['Quote expired'],
      actions: [
        {
          kind: 'send_email',
          moduleKey: 'people',
          recordId: 'p1',
          label: 'Email Prabhu about the expired quote',
          rationale: 'Quote expired while deal is Won',
          email: {
            to: 'prabhu@example.com',
            subject: 'Quote expired',
            body: 'Hi Prabhu,\n\nYour quote has expired...',
          },
        },
        { kind: 'open_record', moduleKey: 'tasks', recordId: 't1', label: 'Open Research Task' },
        { kind: 'complete_task', moduleKey: 'tasks', recordId: 't1', label: 'Complete task: Research account background' },
        { kind: 'talk_to_agent', label: 'Talk to Agent' },
      ],
    }, [
      { sourceType: 'people', sourceId: 'p1', excerpt: 'Prabhu' },
      { sourceType: 'tasks', sourceId: 't1', excerpt: 'Research' },
    ]);
    assert.equal(out.actions.length, 3);
    assert.equal(out.actions[0].kind, 'send_email');
    assert.equal(out.actions[0].email.to, 'prabhu@example.com');
    assert.equal(out.actions[1].kind, 'complete_task');
    assert.equal(out.actions[2].kind, 'talk_to_agent');
  });

  it('normalizeStructuredAnswer keeps open_content_studio with outline fields', () => {
    const out = normalizeStructuredAnswer({
      headline: 'Deck outline',
      bullets: ['Agenda ready'],
      actions: [
        {
          kind: 'open_content_studio',
          label: 'Open Content Studio with this deck outline',
          fields: { title: 'Sports meeting deck', outline: '1. Goal\n2. Agenda', mode: 'blog' },
        },
      ],
    }, []);
    assert.equal(out.actions[0].kind, 'open_content_studio');
    assert.equal(out.actions[0].fields.title, 'Sports meeting deck');
    assert.ok(String(out.actions[0].fields.outline).includes('Agenda'));
  });

  it('normalizeStructuredAnswer keeps open_canvas with canvasJson', () => {
    const out = normalizeStructuredAnswer({
      headline: 'Canvas ready',
      actions: [
        {
          kind: 'open_canvas',
          label: 'Open Arivu Canvas',
          fields: {
            mode: 'presentation',
            title: 'Sports meeting',
            outline: '1. Goal',
            canvasJson: JSON.stringify({ version: 1, mode: 'presentation', title: 'Sports meeting' }),
          },
        },
      ],
    }, []);
    assert.equal(out.actions[0].kind, 'open_canvas');
    assert.equal(out.actions[0].fields.mode, 'presentation');
    assert.ok(String(out.actions[0].fields.canvasJson).includes('Sports meeting'));
  });

  it('normalizeStructuredAnswer keeps Content Studio open labels', () => {
    const out = normalizeStructuredAnswer({
      headline: 'Ready',
      actions: [
        { kind: 'manual', label: 'Open Content Studio to finish this deck' },
        { kind: 'open_record', label: 'Open Research Task', moduleKey: 'tasks', recordId: 't1' },
      ],
    }, [{ sourceType: 'tasks', sourceId: 't1', excerpt: 'Research' }]);
    assert.equal(out.actions.length, 1);
    assert.match(out.actions[0].label, /Content Studio/i);
  });

  it('enrichEmailActionsFromCrm replaces invalid To with CRM email', async () => {
    const out = await enrichEmailActionsFromCrm(
      'org1',
      [{
        kind: 'send_email',
        moduleKey: 'people',
        recordId: 'p1',
        label: 'Email Prabhu',
        email: { to: '[EMAIL]', subject: 'Hi', body: 'Hello' },
      }],
      [{ sourceType: 'people', sourceId: 'p1', email: 'im.prabhub@gmail.com', excerpt: 'Prabhu' }],
    );
    assert.equal(out[0].email.to, 'im.prabhub@gmail.com');
  });
});

const {
  resolveAstraContextMode,
  buildAstraVisualsFromSeries,
  resolveAstraChartType,
  isCalendarScheduleQuestion,
  isContentCreationQuestion,
  extractConversationEntityAnchors,
  isThinFollowUpQuestion,
  resolveWorkspaceQuestionWithHistory,
} = require('../aiWorkGraphContextService');

describe('resolveAstraContextMode', () => {
  it('uses sample by default', () => {
    assert.equal(resolveAstraContextMode('who owns this deal?'), 'sample');
  });
  it('detects report intent', () => {
    assert.equal(resolveAstraContextMode('generate a pipeline report'), 'report');
  });
  it('detects complete data intent', () => {
    assert.equal(resolveAstraContextMode('sum of all deal amounts across all stages'), 'complete');
  });
  it('detects pie chart as report mode', () => {
    assert.equal(resolveAstraContextMode('Give me in a Pie Chart'), 'report');
  });
  it('keeps overview in sample mode (token control; aggregates still load)', () => {
    assert.equal(resolveAstraContextMode('Give me the Complete overview'), 'sample');
  });
});

describe('conversation follow-up anchors', () => {
  it('detects thin follow-ups like give me the quote', () => {
    assert.equal(isThinFollowUpQuestion('Give me the quote'), true);
    assert.equal(isThinFollowUpQuestion('what is the pipeline value for all open deals?'), false);
  });
  it('extracts quoted contact names from prior turns', () => {
    const anchors = extractConversationEntityAnchors([
      { role: 'user', content: "Summarize 'Prabhu Balu' and prepare talking points" },
      { role: 'assistant', content: 'Prabhu Balu is an active contact with an expired quote.' },
    ]);
    assert.ok(anchors.some((a) => /prabhu balu/i.test(a)));
  });
  it('blends conversation focus into workspace search for thin follow-ups', () => {
    const resolved = resolveWorkspaceQuestionWithHistory('Give me the quote', [
      { role: 'user', content: "Summarize 'Prabhu Balu' and prepare for the meeting" },
    ]);
    assert.ok(resolved.anchors.some((a) => /prabhu balu/i.test(a)));
    assert.ok(resolved.searchQueries.some((q) => /prabhu balu/i.test(q)));
    assert.match(resolved.question, /Conversation focus/i);
    assert.equal(resolved.sticky, true);
  });
  it('keeps sticky focus for detail-analysis after website thread', () => {
    const {
      isStickyDeepenerQuestion,
      isExplicitTopicSwitch,
    } = require('../aiWorkGraphContextService');
    assert.equal(isStickyDeepenerQuestion('I want detail analysis'), true);
    const history = [
      { role: 'user', content: 'www.vtiger.com is their website' },
      { role: 'assistant', content: 'Vtiger CRM overview' },
    ];
    const sticky = resolveWorkspaceQuestionWithHistory('I want detail analysis', history);
    assert.equal(sticky.sticky, true);
    assert.match(sticky.question, /Conversation focus/i);
    assert.ok(sticky.anchors.some((a) => /vtiger/i.test(a)));

    const longer = resolveWorkspaceQuestionWithHistory(
      'Can you also cover pricing tiers and who their typical buyers are?',
      history,
    );
    assert.equal(longer.sticky, true);
    assert.match(longer.question, /Conversation focus/i);

    const switched = resolveWorkspaceQuestionWithHistory('Show my pipeline stage distribution', history);
    assert.equal(switched.explicitSwitch, true);
    assert.equal(switched.sticky, false);
    assert.equal(isExplicitTopicSwitch('Show my pipeline stage distribution', sticky.anchors), true);

    const afterContact = resolveWorkspaceQuestionWithHistory('Who is the CEO?', [
      { role: 'user', content: "Summarize 'Prabhu Balu' and prepare for the meeting" },
      { role: 'assistant', content: 'Prabhu Balu is a contact…' },
    ]);
    assert.equal(afterContact.explicitSwitch, true);
    assert.equal(afterContact.sticky, false);
    assert.equal(isExplicitTopicSwitch('Who is the CEO?', ['person: Prabhu Balu']), true);
  });
});

describe('isCalendarScheduleQuestion', () => {
  it('detects meetings today', () => {
    assert.equal(isCalendarScheduleQuestion('do I have any meetings today?'), true);
  });
  it('ignores unrelated questions', () => {
    assert.equal(isCalendarScheduleQuestion('how many deals are open?'), false);
  });
});

describe('isContentCreationQuestion', () => {
  it('detects prepare a deck for meeting', () => {
    assert.equal(isContentCreationQuestion('prepate a Deck for the upcoming meeting'), true);
    assert.equal(isContentCreationQuestion('prepare a deck for the upcoming meeting'), true);
  });
  it('does not treat explicit task create as content', () => {
    assert.equal(isContentCreationQuestion('create a task to prepare the deck'), false);
  });
});

const {
  isCanvasCrmQuestion,
  isArivuCanvasQuestion,
  isExplicitReportOrChartQuestion,
  resolveCanvasMode,
  buildArivuCanvasDocument,
  outlineToSlides,
} = require('../aiArivuCanvasService');

describe('aiArivuCanvasService', () => {
  it('detects CRM canvas meeting prep', () => {
    assert.equal(isCanvasCrmQuestion('prepare for the upcoming meeting'), true);
    assert.equal(
      isCanvasCrmQuestion("Prepare me for 'Discuss expired Quote with Prabhu Balu'. Summarize related context and suggest talking points."),
      true,
    );
    assert.equal(isCanvasCrmQuestion('Prepare me for Discuss expired Quote with Prabhu Balu'), true);
    assert.equal(isArivuCanvasQuestion('show me an analysis of the top cases'), true);
    assert.equal(resolveCanvasMode('prepare a deck for the meeting'), 'presentation');
    assert.equal(resolveCanvasMode('prepare for the upcoming meeting'), 'crm');
    assert.equal(resolveCanvasMode("Prepare me for 'Discuss expired Quote with Prabhu Balu'"), 'crm');
  });

  it('does not treat task/report/pie-chart asks as canvas prep', () => {
    const q = 'Give me brief Report on Tasks, with Proper Pie Chart';
    assert.equal(isExplicitReportOrChartQuestion(q), true);
    assert.equal(isCanvasCrmQuestion(q), false);
    assert.equal(isArivuCanvasQuestion(q), false);
    assert.equal(isCanvasCrmQuestion('Give me a brief report on open tasks'), false);
    assert.equal(isCanvasCrmQuestion('give me a brief for the meeting with Blake'), true);
    assert.equal(isExplicitReportOrChartQuestion('task matrix report'), true);
    assert.equal(isExplicitReportOrChartQuestion('Generate task metrix report'), true);
    assert.equal(isCanvasCrmQuestion('task matrix report'), false);
    assert.equal(isArivuCanvasQuestion('task matrix report'), false);
  });

  it('builds presentation slides from outline', () => {
    const slides = outlineToSlides('1. Goal\n- Win trust\n2. Agenda\n- Review pipeline\n3. Next steps\n- Follow up', 'Sports meeting');
    assert.ok(slides.length >= 3);
    assert.ok(!slides.some((s) => /Prepared with Arivu/i.test((s.bullets || []).join(' '))));
  });

  it('replaces clarifying-question decks with a usable default outline', () => {
    const doc = buildArivuCanvasDocument({
      question: 'prepare a deck for the upcoming meeting',
      mode: 'presentation',
      structured: {
        headline: 'Sports Meeting Deck – Darshan | Jul 19, 2026',
        detail: 'I found your Sports meeting with Darshan today at 5:30 PM IST. What is the primary topic of this sports meeting with Darshan before I generate a full outline?',
        bullets: ['Opening: Meeting purpose', 'Key talking points: [awaiting your input on sports topic]'],
        clarifyingQuestions: ['What is the primary topic?'],
        actions: [],
      },
      citations: [],
    });
    assert.equal(doc.mode, 'presentation');
    assert.ok(doc.slides.length >= 4);
    assert.ok(!/\?/.test(doc.summary || ''));
    assert.ok(!doc.slides.some((s) => /awaiting your input|primary topic/i.test(`${s.title} ${(s.bullets || []).join(' ')}`)));
    assert.ok(doc.conversationStarters.every((s) => !/awaiting/i.test(s.text)));
  });

  it('builds CRM canvas document with blocks', () => {
    const doc = buildArivuCanvasDocument({
      question: 'prepare for the upcoming meeting with Darshan',
      structured: {
        headline: 'Prepare for Sports meeting with Darshan — today at 5:30 PM',
        bullets: [
          'Next meeting: Sports meeting with Darshan, Sun Jul 19, 2026, 5:30 PM GMT+5:30',
          'You have 2 meetings remaining today',
          'Open Arivu Canvas to build meeting prep materials and review contact details',
        ],
        detail: 'Your upcoming meeting is Sports meeting with Darshan scheduled for today at 5:30 PM.',
        visuals: [],
        actions: [],
      },
      citations: [
        { sourceType: 'events', sourceId: 'e1', excerpt: 'Sports meeting with Darshan' },
        { sourceType: 'events', sourceId: 'e2', excerpt: 'ReportsE2E Event MR54T40F-2' },
        { sourceType: 'people', sourceId: 'p1', excerpt: 'Darshan' },
        { sourceType: 'events', sourceId: 'e4', excerpt: 'Proposal Review Call — Blake Nguyen' },
      ],
      crmPack: {
        primaryContact: {
          recordId: 'p1',
          name: 'Darshan',
          email: 'darshan@example.com',
          title: 'Ops Lead',
          company: 'Acme',
        },
        company: { name: 'Acme' },
        stakeholders: [{
          recordId: 'p1',
          name: 'Darshan',
          email: 'darshan@example.com',
          title: 'Ops Lead',
          company: 'Acme',
        }],
        deals: [{ recordId: 'd1', label: 'Acme Expansion', amount: 180000, stage: 'Proposal' }],
        quotes: [],
        events: [{ recordId: 'e1', label: 'Sports meeting with Darshan', startDateTime: new Date().toISOString() }],
        activities: [{
          id: 'a1',
          who: 'Emy',
          body: 'Sent proposal with customization options',
          at: new Date().toISOString(),
        }],
      },
    });
    assert.equal(doc.mode, 'crm');
    assert.ok((doc.widgets || []).some((w) => w.type === 'record_list'));
    assert.ok((doc.widgets || []).some((w) => w.type === 'detail'));
    assert.ok((doc.widgets || []).some((w) => w.type === 'notes'));
    assert.ok((doc.widgets || []).some((w) => w.type === 'timeline'));
    // Legacy cards kept for adapters
    assert.ok((doc.cards || []).some((c) => c.type === 'stakeholders'));
    assert.ok((doc.kpis || []).length >= 1);
    assert.ok((doc.kpis || []).every((k) => String(k.value || '').trim()));
    assert.ok(!/launching arivu|open arivu canvas/i.test(doc.heroSummary || ''));
    assert.ok(!doc.opportunities.some((o) => /ReportsE2E|Blake Nguyen/i.test(o.label)));
  });

  it('filters related records to intent match for expired quote meeting', () => {
    const doc = buildArivuCanvasDocument({
      question: 'prepare for meeting with Prabhu Balu about expired quote',
      structured: {
        headline: 'Opening Arivu Canvas to prepare for your meeting with Prabhu Balu',
        detail: 'Launching Arivu Canvas workspace to help you prepare. You\'ll see Prabhu Balu\'s contact profile.',
        bullets: [
          'Meeting: Discuss expired Quote with Prabhu Balu',
          'Time: Today, July 19, 2026 at 2:00 PM IST (30 minutes)',
          'Canvas will load contact overview, quote history, and meeting prep insights',
        ],
        actions: [],
      },
      citations: [
        { sourceType: 'people', sourceId: 'p1', excerpt: 'Prabhu Balu', email: 'im.prabhub@gmail.com' },
        { sourceType: 'quotes', sourceId: 'q1', excerpt: 'Expired Quote — Prabhu Balu' },
        { sourceType: 'events', sourceId: 'e1', excerpt: 'Discuss expired Quote with Prabhu Balu' },
        { sourceType: 'events', sourceId: 'e2', excerpt: 'Proposal Review Call — Blake Nguyen' },
        { sourceType: 'events', sourceId: 'e3', excerpt: 'Sports meeting with Darshan' },
      ],
      crmPack: {
        primaryContact: {
          recordId: 'p1',
          name: 'Prabhu Balu',
          email: 'im.prabhub@gmail.com',
          title: '',
          company: '',
        },
        stakeholders: [{
          recordId: 'p1',
          name: 'Prabhu Balu',
          email: 'im.prabhub@gmail.com',
        }],
        quotes: [{
          recordId: 'q1',
          label: 'Expired Quote — Prabhu Balu',
          status: 'Expired',
          expired: true,
          validUntil: '2026-01-01',
          amount: 12000,
          currency: 'USD',
        }],
        deals: [],
        events: [{ recordId: 'e1', label: 'Discuss expired Quote with Prabhu Balu' }],
        activities: [],
      },
    });
    assert.ok(!/launching arivu|you'll see/i.test(doc.heroSummary || ''));
    assert.ok((doc.widgets || []).some((w) => w.type === 'detail'));
    const detail = (doc.widgets || []).find((w) => w.type === 'detail');
    assert.ok(detail?.fields?.some((f) => /expired/i.test(f.value)));
    assert.ok((doc.kpis || []).some((k) => /expired quote/i.test(k.label)));
    assert.ok(!doc.opportunities.some((o) => /Blake Nguyen|Sports meeting with Darshan/i.test(o.label)));
    const notes = (doc.widgets || []).find((w) => w.type === 'notes')
      || (doc.cards || []).find((c) => c.type === 'meeting_notes');
    const goals = notes?.sections?.find((s) => /goal/i.test(s.label))?.items || notes?.goals || [];
    assert.ok(goals.some((g) => /expired quote/i.test(g)));
  });
});

const {
  detectAstraIntentCapabilities,
  formatIntentCapabilityPromptRules,
} = require('../aiAstraIntentCapabilities');

describe('aiAstraIntentCapabilities', () => {
  it('detects content_creation for deck prep', () => {
    const caps = detectAstraIntentCapabilities('prepare a deck for the upcoming meeting');
    assert.ok(caps.some((c) => c.id === 'content_creation'));
    const rules = formatIntentCapabilityPromptRules('prepare a deck for the upcoming meeting');
    assert.ok(rules.some((r) => /ARIVU CANVAS \(PRESENTATION\)|CONTENT INTENT/i.test(r)));
  });

  it('detects arivu_canvas_crm for meeting prep', () => {
    const caps = detectAstraIntentCapabilities('prepare for the upcoming meeting');
    assert.ok(caps.some((c) => c.id === 'arivu_canvas_crm'));
  });
});

describe('buildAstraVisualsFromSeries', () => {
  it('builds pie points from stage series', () => {
    const visuals = buildAstraVisualsFromSeries({
      question: 'pie chart of deals by stage',
      moduleKey: 'deals',
      groupField: 'stage',
      series: [
        { label: 'New', value: 5, amount: 100 },
        { label: 'Qualification', value: 3, amount: 200 },
      ],
    });
    assert.equal(visuals.length, 1);
    assert.equal(visuals[0].chartType, 'pie');
    assert.equal(visuals[0].points.length, 2);
    assert.equal(resolveAstraChartType('bar chart please'), 'bar');
  });
});
