'use strict';

/**
 * Arivu Canvas — generative UX grounded in trusted CRM data + approved UI blocks.
 * Inspired by Salesforce Generative Lightning Canvas (approved components, not free-form pixels).
 *
 * Modes:
 * - crm: KPIs, charts, tables, callouts, conversation starters, opportunities
 * - presentation: slide outline deck for meeting prep
 */

const { isContentCreationQuestion } = require('./aiWorkGraphContextService');

/** Module report / chart asks must never open Arivu Canvas / meeting prep. */
function isExplicitReportOrChartQuestion(question = '') {
  const q = String(question || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!q) return false;
  if (/\b(pie|bar|line)\s*charts?\b/.test(q) || /\b(pie|bar|line)\s+chart\b/.test(q)) return true;
  if (/\b(chart|graph|visuali[sz]e|plot|dashboard|breakdown)\b/.test(q)) return true;
  // Matrix / pivot reports (incl. common typo "metrix")
  if (/\b(matrix|metrix|pivot|cross[- ]?tab)\b/.test(q)) return true;
  if (/\breport\b/.test(q) && /\b(task|tasks|deal|deals|pipeline|case|cases|quote|quotes|event|events)\b/.test(q)) {
    return true;
  }
  if (/\b(report|summary)\b/.test(q) && /\b(by status|by stage|open tasks|all tasks)\b/.test(q)) {
    return true;
  }
  if (/\b(create|build|make|save|draft|generate)\b.+\breport\b/.test(q) || /\breport builder\b/.test(q)) {
    return true;
  }
  return false;
}

function isCanvasCrmQuestion(question = '') {
  const q = String(question || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!q) return false;
  if (isContentCreationQuestion(q)) return false;
  // "Give me brief report on tasks / pie chart" is analytics — not meeting prep canvas.
  if (isExplicitReportOrChartQuestion(q)) return false;
  // Record summarize / coaching brief chips must NOT open Canvas (that hijacks the answer).
  if (
    /\bsummar(y|ize|ise)\b/.test(q)
    && !/\b(meeting|deck|slides?|canvas|talking\s+points?)\b/.test(q)
  ) {
    return false;
  }
  if (/\bcoaching\s+brief\b/.test(q) || /\bcoaching\s+summary\b/.test(q) || /\bwhat should i do next\b/.test(q)) {
    return false;
  }
  return (
    /\b(arivu\s*canvas|generative\s*canvas|open\s*canvas|show\s*canvas)\b/.test(q)
    || /\b(prepare|prep)\s+(me\s+)?for\b/.test(q)
    || /\bbrief\s+me\s+for\b/.test(q)
    || /\b(meeting\s+prep|account\s+overview|elevator\s+pitch|conversation\s+starters?|talking\s+points?)\b/.test(q)
    || /\b(prep(?:are)?)\b.+\b(talking\s+points?|related\s+context|agenda)\b/.test(q)
    || /\b(analy[sz]e|analysis|insights?)\b.+\b(account|deal|pipeline|meeting|case|quote|contact)\b/.test(q)
    || /\b(show|give)\s+me\s+(an?\s+)?(overview|analysis|dashboard)\b/.test(q)
    || /\b(show|give)\s+me\s+(a\s+)?brief\s+(on|for|about)\s+(the\s+)?(meeting|account|deal|contact|opportunity)\b/.test(q)
    || /\bsummarize\b.+\b(meeting|quote|deal)\b/.test(q)
  );
}

function isCanvasPresentationQuestion(question = '') {
  return isContentCreationQuestion(question);
}

function isArivuCanvasQuestion(question = '') {
  return isCanvasCrmQuestion(question) || isCanvasPresentationQuestion(question);
}

/** Follow-ups from the canvas improvise bar — do not re-open / rewrite canvas. */
function isCanvasImproviseTurn(question = '') {
  const q = String(question || '');
  return (
    /\bon\s+arivu\s*canvas\b/i.test(q)
    || /\bimprovise\/update\s+the\s+canvas\b/i.test(q)
    || /\bcurrent\s+canvas\s+context\b/i.test(q)
    || /\badd\s+(a\s+)?(discussion\s+)?topic\b/i.test(q)
    || /\badd\s+(another\s+)?stakeholder\b/i.test(q)
  );
}

function resolveCanvasMode(question = '') {
  if (isCanvasPresentationQuestion(question)) return 'presentation';
  if (isCanvasCrmQuestion(question)) return 'crm';
  return 'crm';
}

function safeBlocks(visuals = []) {
  if (!Array.isArray(visuals)) return [];
  return visuals
    .filter((b) => b && typeof b === 'object' && b.component)
    .slice(0, 12)
    .map((b, idx) => ({
      id: String(b.id || `block_${idx}`),
      component: String(b.component),
      title: b.title ? String(b.title).slice(0, 120) : undefined,
      chartType: b.chartType ? String(b.chartType) : undefined,
      metricLabel: b.metricLabel ? String(b.metricLabel) : undefined,
      tone: b.tone ? String(b.tone) : undefined,
      body: b.body ? String(b.body).slice(0, 2000) : undefined,
      items: Array.isArray(b.items) ? b.items.slice(0, 12) : undefined,
      columns: Array.isArray(b.columns) ? b.columns.slice(0, 12) : undefined,
      rows: Array.isArray(b.rows) ? b.rows.slice(0, 40) : undefined,
      points: Array.isArray(b.points) ? b.points.slice(0, 40) : undefined,
    }));
}

function looksLikeWeakPresentationDetail(text = '') {
  const t = String(text || '').trim();
  if (!t) return true;
  if (/\?/.test(t) && /\b(what|which|topic|clarify|confirm|awaiting|before i|primary topic)\b/i.test(t)) {
    return true;
  }
  if (/\b(awaiting your input|need more details|tell me more|primary topic)\b/i.test(t)) return true;
  if (/\b(prepared with arivu canvas|grounded in your crm context)\b/i.test(t) && t.length < 200) {
    return true;
  }
  // Need at least a few structural slide cues
  const slideCues = (t.match(/^\s*(\d+[\).]|#{1,3}\s+|[-*•]\s+)/gm) || []).length;
  return slideCues < 3 && t.length < 280;
}

function buildDefaultMeetingDeckOutline(meetingName = '', headline = '') {
  const name = String(meetingName || '').trim()
    || String(headline || '').replace(/\b(deck|presentation|outline|ready)\b/gi, '').trim()
    || 'Upcoming meeting';
  return [
    `1. ${name}`,
    '- Meeting goal and desired outcome',
    '- Attendees and roles',
    '2. Agenda',
    '- Opening & context (2 min)',
    '- Key discussion topics',
    '- Decisions required',
    '- Next steps & owners',
    '3. Context & background',
    '- Why this meeting matters now',
    '- Relevant CRM history / open items',
    '4. Discussion points',
    '- Priority topic 1',
    '- Priority topic 2',
    '- Risks or blockers',
    '5. Decisions needed',
    '- Decision A — owner / due date',
    '- Decision B — owner / due date',
    '6. Next steps',
    '- Action items with owners',
    '- Follow-up meeting or checkpoint',
  ].join('\n');
}

function outlineToSlides(outline = '', title = 'Meeting deck') {
  const lines = String(outline || '')
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const slides = [];
  let current = null;

  const pushCurrent = () => {
    if (current) {
      // Drop empty / question-only slides
      const usefulBullets = (current.bullets || []).filter((b) => (
        b && !/\b(awaiting your input|prepared with arivu|grounded in your crm)\b/i.test(b)
      ));
      current.bullets = usefulBullets;
      if (current.title && !/\?$/.test(current.title)) {
        slides.push(current);
      }
    }
    current = null;
  };

  for (const line of lines) {
    // Skip clarifying / meta prose lines
    if (/\b(awaiting your input|what is the primary topic|before i generate|clarify)\b/i.test(line)) {
      continue;
    }
    const md = line.match(/^(#{1,3})\s+(.+)$/);
    const numbered = line.match(/^\d+[\).]\s+(.+)$/);
    const bullet = line.match(/^[-*•]\s+(.+)$/);
    if (md || numbered) {
      pushCurrent();
      const slideTitle = String((md && md[2]) || (numbered && numbered[1]) || line).slice(0, 160);
      if (/\?$/.test(slideTitle)) continue;
      current = {
        id: `slide_${slides.length + 1}`,
        title: slideTitle,
        bullets: [],
      };
      continue;
    }
    if (bullet) {
      if (!current) {
        current = { id: `slide_${slides.length + 1}`, title: 'Key points', bullets: [] };
      }
      current.bullets.push(String(bullet[1]).slice(0, 240));
      continue;
    }
    // Ignore long prose paragraphs in outline mode (usually clarifying text)
    if (line.length > 140 || /\?/.test(line)) continue;
    if (!current) {
      current = { id: `slide_${slides.length + 1}`, title: String(title || 'Overview').slice(0, 160), bullets: [] };
    }
    current.bullets.push(String(line).slice(0, 240));
  }
  pushCurrent();

  if (slides.length < 3) {
    const fallback = buildDefaultMeetingDeckOutline('', title);
    return outlineToSlides(fallback, title);
  }
  return slides.slice(0, 16);
}

function extractPresentationStarters(slides = []) {
  return (Array.isArray(slides) ? slides : [])
    .slice(0, 5)
    .map((slide, idx) => ({
      id: `starter_${idx + 1}`,
      text: String(slide.title || '').slice(0, 280),
    }))
    .filter((s) => s.text);
}

const META_CANVAS_RE = /\b(open arivu canvas|use arivu canvas|build meeting prep|content studio|launching arivu|canvas will load|you('ll| will) see|workspace to help you prepare|use this to frame)\b/i;
const META_STARTER_RE = /^(meeting|time|canvas|contact|topic)\s*:/i;

function isMetaCanvasProse(text = '') {
  const t = String(text || '').trim();
  if (!t) return true;
  if (META_CANVAS_RE.test(t)) return true;
  if (/\b(will load|you'll see|to help you prepare|identify next steps)\b/i.test(t) && t.length < 420) {
    return true;
  }
  return false;
}

function extractMeetingName(headline = '', detail = '', question = '') {
  const h = String(headline || '');
  const fromPrep = h.match(/(?:prepare for|meeting with)\s+(.+?)(?:\s+[—-]|$)/i);
  if (fromPrep?.[1]) return fromPrep[1].trim().slice(0, 80);
  const fromQ = String(question || '').match(/(?:meeting with|prepare for)\s+([A-Z][\w\s.'-]{2,60})/i);
  if (fromQ?.[1]) return fromQ[1].trim().slice(0, 80);
  const fromDeck = h.match(/^(.+?)\s*(?:deck|presentation)\b/i);
  if (fromDeck?.[1]) return fromDeck[1].replace(/[–—|-].*$/, '').trim().slice(0, 80);
  const quoted = String(detail || '').match(/['"]([^'"]{3,80})['"]/);
  if (quoted?.[1]) return quoted[1].trim();
  const withPerson = String(detail || '').match(
    /\b([A-Z][\w\s]{2,40}?meeting(?:\s+with\s+[A-Za-z][\w\s-]{1,40})?)\b/,
  );
  if (withPerson?.[1]) return withPerson[1].trim().slice(0, 80);
  return '';
}

/** Intent anchors: people + topic tokens for matching related records (not org-wide noise). */
const PERSON_NAME_STOP = /^(Today|Meeting|Quote|Deal|Event|Task|Discuss|Expired|Prep|Prepare|Agenda|Call|Review|Proposal|Sports)$/i;

function cleanPersonName(raw = '') {
  const parts = String(raw || '')
    .replace(/[—–-]+/g, ' ')
    .replace(/[^A-Za-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((p) => !PERSON_NAME_STOP.test(p));
  if (parts.length < 2 || parts.length > 3) return '';
  if (!parts.every((p) => /^[A-Z][a-z]+$/.test(p))) return '';
  return parts.join(' ');
}

function extractIntentAnchors(question = '', structured = {}) {
  const blob = [
    question,
    structured.headline,
    ...(Array.isArray(structured.bullets) ? structured.bullets : []),
    String(structured.detail || '').slice(0, 800),
  ].join(' ');

  const people = [];
  // Prefer exact First Last (avoid glue across sentence boundaries: "Balu Prabhu Balu")
  const withMatch = blob.match(/\b(?:with|for)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)\b/g) || [];
  for (const m of withMatch) {
    const name = cleanPersonName(m.replace(/^(?:with|for)\s+/i, ''));
    if (name) people.push(name);
  }
  const quotedEvent = blob.match(/['"]([^'"]{6,120})['"]/);
  if (quotedEvent?.[1]) {
    const qp = quotedEvent[1].match(/\bwith\s+([A-Z][a-z]+\s+[A-Z][a-z]+)\b/);
    if (qp?.[1]) {
      const name = cleanPersonName(qp[1]);
      if (name) people.push(name);
    }
  }

  const discuss = blob.match(/\bdiscuss(?:ing)?\s+(?:the\s+)?([a-z][\w\s-]{2,40}?quote)\b/i);
  const topicTokens = String(blob || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .filter((w) => !['with', 'meeting', 'prepare', 'canvas', 'arivu', 'today', 'discuss', 'about', 'schedule', 'minutes', 'summarize', 'related', 'context', 'suggest', 'talking', 'points'].includes(w));

  if (discuss?.[1]) {
    for (const w of discuss[1].toLowerCase().split(/\s+/)) {
      if (w.length > 2) topicTokens.unshift(w);
    }
  }
  if (/\bexpired\b/i.test(blob)) {
    topicTokens.unshift('expired', 'quote');
  }

  const uniquePeople = [...new Set(people)].slice(0, 3);
  const uniqueTopics = [...new Set(topicTokens)].slice(0, 12);
  return {
    people: uniquePeople,
    topics: uniqueTopics,
    meetingName: extractMeetingName(structured.headline, structured.detail, question),
  };
}

/** Fill crmPack gaps from citations/opportunities/facts when DB enrich is thin. */
function seedCrmPackFromSignals(crmPack = {}, {
  opportunities = [],
  citations = [],
  facts = {},
  anchors = {},
} = {}) {
  const pack = {
    primaryContact: crmPack.primaryContact || null,
    company: crmPack.company || null,
    stakeholders: [...(crmPack.stakeholders || [])],
    deals: [...(crmPack.deals || [])],
    quotes: [...(crmPack.quotes || [])],
    events: [...(crmPack.events || [])],
    activities: [...(crmPack.activities || [])],
    tasks: [...(crmPack.tasks || [])],
  };

  const hasId = (list, id) => list.some((row) => String(row.recordId || '') === String(id));

  const pushPerson = (row) => {
    const id = String(row.recordId || '');
    const name = String(row.name || row.label || '').trim();
    if (!name) return;
    if (id && hasId(pack.stakeholders, id)) return;
    if (!id && pack.stakeholders.some((p) => p.name === name)) return;
    const person = {
      recordId: id || undefined,
      moduleKey: 'people',
      name,
      email: row.email || '',
      title: row.title || row.subtitle || '',
      company: row.company || pack.company?.name || '',
      role: row.role || 'Cited contact',
    };
    if (!pack.primaryContact) pack.primaryContact = person;
    pack.stakeholders.push(person);
  };

  const pushQuote = (row) => {
    const id = String(row.recordId || '');
    const label = String(row.label || row.excerpt || '').trim();
    if (!label) return;
    if (id && hasId(pack.quotes, id)) return;
    if (!id && pack.quotes.some((q) => q.label === label)) return;
    const expired = Boolean(row.expired) || /expir/i.test(`${label} ${row.status || ''}`);
    pack.quotes.push({
      recordId: id || undefined,
      moduleKey: 'quotes',
      label: label.slice(0, 120),
      status: row.status || (expired ? 'Expired' : ''),
      validUntil: row.validUntil || null,
      amount: row.amount ?? null,
      currency: row.currency || 'USD',
      expired,
    });
  };

  for (const o of opportunities || []) {
    const mod = String(o.moduleKey || '').toLowerCase();
    if (mod === 'people') pushPerson(o);
    else if (mod === 'quotes') pushQuote(o);
    else if (mod === 'deals' && o.recordId && !hasId(pack.deals, o.recordId)) {
      pack.deals.push({
        recordId: o.recordId,
        moduleKey: 'deals',
        label: String(o.label || 'Deal').slice(0, 120),
        amount: 0,
        stage: '',
        status: '',
      });
    } else if (mod === 'events' && o.recordId && !hasId(pack.events, o.recordId)) {
      pack.events.push({
        recordId: o.recordId,
        moduleKey: 'events',
        label: String(o.label || 'Meeting').slice(0, 120),
        startDateTime: o.startDateTime || null,
        status: '',
      });
    } else if (mod === 'tasks' && o.recordId && !hasId(pack.tasks, o.recordId)) {
      pack.tasks.push({
        recordId: o.recordId,
        moduleKey: 'tasks',
        label: String(o.label || 'Task').slice(0, 120),
        status: '',
        priority: '',
      });
    }
  }

  for (const c of citations || []) {
    const mod = String(c.sourceType || '').toLowerCase();
    const row = {
      recordId: c.sourceId,
      label: c.excerpt,
      email: c.email,
      name: c.excerpt,
    };
    if (mod === 'people') pushPerson(row);
    else if (mod === 'quotes') pushQuote(row);
  }

  for (const c of facts.contacts || []) pushPerson(c);
  for (const q of facts.quotes || []) pushQuote(q);

  // Anchor-only person when CRM still empty (openable once enrich finds id later)
  if (!pack.stakeholders.length && (anchors.people || [])[0]) {
    pushPerson({ name: anchors.people[0], role: 'Meeting contact' });
  }

  return pack;
}

function labelMatchesAnchors(label = '', anchors = {}) {
  const l = String(label || '').toLowerCase();
  if (!l) return false;
  const people = anchors.people || [];
  const topics = anchors.topics || [];
  const personHit = people.some((p) => {
    const parts = String(p).toLowerCase().split(/\s+/).filter((x) => x.length > 1);
    return parts.length ? parts.every((part) => l.includes(part)) : false;
  });
  const topicHit = topics.some((t) => t.length > 3 && l.includes(t));
  const meetingHit = anchors.meetingName
    && l.includes(String(anchors.meetingName).toLowerCase().slice(0, 24));
  return { personHit, topicHit, meetingHit };
}

function scoreOpportunity(c, anchors = {}) {
  const moduleKey = String(c.sourceType || '').toLowerCase();
  const label = String(c.excerpt || '').trim();
  const { personHit, topicHit, meetingHit } = labelMatchesAnchors(label, anchors);

  if (/reportse2e|e2e event|test event/i.test(label)) return -100;
  if (!label || label.length < 3) return -20;

  let score = 0;
  // Prefer CRM objects staff act on; events only when intent-matched
  if (moduleKey === 'people') score += personHit ? 90 : 10;
  else if (moduleKey === 'quotes') score += (personHit || topicHit) ? 85 : 5;
  else if (moduleKey === 'deals') score += (personHit || topicHit) ? 80 : 5;
  else if (moduleKey === 'organizations') score += personHit ? 55 : 5;
  else if (moduleKey === 'tasks') score += (personHit || topicHit) ? 50 : 0;
  else if (moduleKey === 'cases') score += (personHit || topicHit) ? 45 : 0;
  else if (moduleKey === 'events') {
    if (!(personHit || topicHit || meetingHit)) return -50;
    score += personHit ? 40 : 0;
    score += topicHit ? 35 : 0;
    score += meetingHit ? 30 : 0;
  } else {
    score += 5;
  }

  if (personHit) score += 40;
  if (topicHit) score += 35;
  if (meetingHit) score += 25;

  // Require intent signal when we have anchors
  const hasAnchors = (anchors.people || []).length || (anchors.topics || []).length;
  if (hasAnchors && !personHit && !topicHit && !meetingHit && moduleKey !== 'people') {
    return -10;
  }
  return score;
}

function extractOpportunities(citations = [], structured = {}, question = '') {
  const anchors = extractIntentAnchors(question, structured);
  const seen = new Set();
  const seenLabels = new Set();
  return (Array.isArray(citations) ? citations : [])
    .filter((c) => c && c.sourceType && c.sourceId)
    .map((c) => ({ c, score: scoreOpportunity(c, anchors) }))
    .filter((row) => row.score >= 40)
    .sort((a, b) => b.score - a.score)
    .reduce((acc, row) => {
      const mod = String(row.c.sourceType).toLowerCase();
      const key = `${mod}:${String(row.c.sourceId)}`;
      const labelKey = `${mod}:${String(row.c.excerpt || '').toLowerCase().slice(0, 80)}`;
      if (seen.has(key) || seenLabels.has(labelKey)) return acc;
      seen.add(key);
      seenLabels.add(labelKey);
      // Cap noisy event flood: max 2 events
      if (mod === 'events' && acc.filter((o) => o.moduleKey === 'events').length >= 2) {
        return acc;
      }
      acc.push({
        id: `opp_${acc.length + 1}`,
        moduleKey: mod,
        recordId: String(row.c.sourceId),
        label: String(row.c.excerpt || row.c.sourceType).slice(0, 120),
        reason: row.score >= 80 ? 'intent_match' : 'related',
      });
      return acc;
    }, [])
    .slice(0, 8);
}

function parseContextFacts(contextText = '') {
  const text = String(contextText || '');
  const facts = {
    contacts: [],
    quotes: [],
    deals: [],
    tasks: [],
    events: [],
    emails: [],
  };
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const email = line.match(/\b([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})\b/i);
    if (email) facts.emails.push(email[1]);

    const hit = line.match(/^\d+\.\s*\[(\w+)\]\s+(.+?)(?:\s+[—-]\s+(.+?))?\s+\(id=([a-f0-9]{24})\)/i);
    if (hit) {
      const mod = hit[1].toLowerCase();
      const row = { moduleKey: mod, label: hit[2].trim(), subtitle: (hit[3] || '').trim(), recordId: hit[4] };
      if (mod === 'people') facts.contacts.push(row);
      else if (mod === 'quotes') facts.quotes.push(row);
      else if (mod === 'deals') facts.deals.push(row);
      else if (mod === 'tasks') facts.tasks.push(row);
      else if (mod === 'events') facts.events.push(row);
      continue;
    }
    const contact = line.match(/^Contact:\s*(.+)$/i);
    if (contact) facts.contacts.push({ moduleKey: 'people', label: contact[1].trim() });
    const quote = line.match(/^Quote(?:\s*title)?\s*:\s*(.+)$/i)
      || line.match(/\[quotes\]\s+(.+?)(?:\s+\(id=|\s*$)/i);
    if (quote) facts.quotes.push({ moduleKey: 'quotes', label: quote[1].trim() });
    const deal = line.match(/^Deal(?:\s*name)?\s*:\s*(.+)$/i);
    if (deal) facts.deals.push({ moduleKey: 'deals', label: deal[1].trim() });
  }
  return facts;
}

function defaultSuggestedPrompts(mode = 'crm', meetingName = '', personName = '') {
  if (mode === 'presentation') {
    return [
      'Tighten the elevator pitch slide',
      'Add competitive landscape',
      'Turn this into a 5-slide customer review deck',
    ];
  }
  const who = personName || meetingName;
  return [
    who ? `Draft an email to ${who} about the expired quote` : 'Draft a follow-up email for this meeting',
    who ? `List open quotes and deals for ${who}` : 'What open deals or quotes relate to this meeting?',
    'Prepare a presentation deck from this canvas',
    'Summarize risks and decisions needed',
  ];
}

function buildMeetingPrepKpis(structured = {}, question = '', facts = {}) {
  const bullets = Array.isArray(structured.bullets) ? structured.bullets : [];
  const joined = [...bullets, String(structured.detail || ''), String(question || '')].join('\n');
  const items = [];
  const anchors = extractIntentAnchors(question, structured);

  const focus = anchors.meetingName
    || (facts.events?.[0]?.label)
    || (joined.match(/next meeting:\s*([^,\n]+)/i)?.[1]);
  if (focus) items.push({ label: 'Focus meeting', value: String(focus).trim().slice(0, 48) });

  const timeMatch = joined.match(
    /\b(\d{1,2}:\d{2}\s*(?:AM|PM)?(?:\s*[A-Z]{2,5})?)\b/i,
  );
  if (timeMatch?.[1]) items.push({ label: 'Starts', value: String(timeMatch[1]).trim() });

  if (anchors.people[0]) items.push({ label: 'Contact', value: anchors.people[0].slice(0, 40) });
  else if (facts.contacts?.[0]?.label) {
    items.push({ label: 'Contact', value: String(facts.contacts[0].label).slice(0, 40) });
  }

  const topic = (anchors.topics || []).find((t) => /quote|deal|renew|expir/i.test(t));
  if (topic) items.push({ label: 'Topic', value: topic });

  if (!items.length) return null;
  return {
    id: 'kpi_meeting_prep',
    component: 'kpi_strip',
    title: 'Meeting snapshot',
    items: items.slice(0, 4),
  };
}

function buildContactBlock(facts = {}, citations = [], anchors = {}) {
  const fromCite = (Array.isArray(citations) ? citations : [])
    .filter((c) => String(c.sourceType || '').toLowerCase() === 'people')
    .filter((c) => {
      if (!(anchors.people || []).length) return true;
      return labelMatchesAnchors(c.excerpt, anchors).personHit;
    });
  const contact = facts.contacts?.[0] || (fromCite[0] ? {
    label: fromCite[0].excerpt,
    recordId: fromCite[0].sourceId,
    email: fromCite[0].email,
  } : null);
  if (!contact?.label) return null;
  const email = contact.email || facts.emails?.[0] || fromCite[0]?.email || '—';
  return {
    id: 'table_contact',
    component: 'data_table',
    title: 'Contact',
    columns: ['Name', 'Email'],
    rows: [[String(contact.label).slice(0, 80), String(email).slice(0, 80)]],
  };
}

function buildIntentRecordsBlock(opportunities = [], facts = {}, anchors = {}) {
  const rows = [];
  const pushRow = (moduleKey, label, note = '') => {
    if (!label) return;
    const key = `${moduleKey}:${label}`.toLowerCase();
    if (rows.some((r) => `${r[0]}:${r[1]}`.toLowerCase() === key)) return;
    rows.push([moduleKey, String(label).slice(0, 80), String(note).slice(0, 60)]);
  };

  for (const o of opportunities) {
    if (['people', 'quotes', 'deals', 'tasks', 'events', 'cases'].includes(o.moduleKey)) {
      pushRow(o.moduleKey, o.label, o.reason === 'intent_match' ? 'Intent match' : '');
    }
  }
  for (const q of (facts.quotes || []).slice(0, 4)) {
    const hit = labelMatchesAnchors(q.label, anchors);
    if ((anchors.people || []).length && !hit.personHit && !hit.topicHit) continue;
    pushRow('quotes', q.label, /expir/i.test(q.label) ? 'Expired?' : q.subtitle || '');
  }
  for (const d of (facts.deals || []).slice(0, 3)) {
    const hit = labelMatchesAnchors(d.label, anchors);
    if ((anchors.people || []).length && !hit.personHit && !hit.topicHit) continue;
    pushRow('deals', d.label, d.subtitle || '');
  }
  for (const t of (facts.tasks || []).slice(0, 3)) {
    const hit = labelMatchesAnchors(t.label, anchors);
    if (!hit.personHit && !hit.topicHit) continue;
    pushRow('tasks', t.label, '');
  }

  if (!rows.length) return null;
  return {
    id: 'table_intent_records',
    component: 'data_table',
    title: 'Records for this intent',
    columns: ['Type', 'Record', 'Note'],
    rows: rows.slice(0, 8),
  };
}

function buildTalkingPointsBlock(structured = {}, facts = {}, anchors = {}, opportunities = []) {
  const points = [];
  const person = anchors.people?.[0] || facts.contacts?.[0]?.label;
  const focusEvent = opportunities.find((o) => o.moduleKey === 'events')
    || facts.events?.find((e) => labelMatchesAnchors(e.label, anchors).personHit || labelMatchesAnchors(e.label, anchors).topicHit);
  const quote = opportunities.find((o) => o.moduleKey === 'quotes')
    || facts.quotes?.find((q) => /expir|quote/i.test(q.label))
    || facts.quotes?.[0];
  const deal = opportunities.find((o) => o.moduleKey === 'deals') || facts.deals?.[0];

  if (person) points.push(`Confirm status with ${person} and desired outcome for this meeting`);
  if (quote) points.push(`Review quote: ${quote.label} — renewal, discount, or close-out`);
  else if ((anchors.topics || []).some((t) => /quote|expir/i.test(t))) {
    points.push('Address the expired quote: validity, revised terms, and next commercial step');
  }
  if (deal) points.push(`Align on deal progress: ${deal.label}`);
  if (focusEvent) points.push(`Stay on agenda for: ${focusEvent.label}`);
  points.push('Agree owners, dates, and follow-up before ending the call');

  // Also keep non-meta structured bullets that look like staff talking points
  for (const b of (structured.bullets || [])) {
    const t = String(b || '').trim();
    if (!t || isMetaCanvasProse(t) || META_STARTER_RE.test(t)) continue;
    if (/^(contact|date|topic)\s*:/i.test(t)) continue;
    if (points.length >= 6) break;
    if (!points.some((p) => p.toLowerCase() === t.toLowerCase())) points.push(t.slice(0, 200));
  }

  if (!points.length) return null;
  return {
    id: 'callout_talking_points',
    component: 'callout',
    tone: 'insight',
    title: 'Talking points',
    body: points.slice(0, 6).map((p) => `• ${p}`).join('\n').slice(0, 2000),
  };
}

function extractStarters(structured = {}, mode = 'crm', facts = {}, anchors = {}, opportunities = []) {
  if (mode !== 'crm') {
    const bullets = Array.isArray(structured.bullets) ? structured.bullets : [];
    return bullets
      .map((b) => String(b || '').trim())
      .filter((b) => b && !isMetaCanvasProse(b) && !META_STARTER_RE.test(b))
      .slice(0, 6)
      .map((text, idx) => ({ id: `starter_${idx + 1}`, text: text.slice(0, 280) }));
  }

  const block = buildTalkingPointsBlock(structured, facts, anchors, opportunities);
  if (block?.body) {
    return block.body
      .split('\n')
      .map((l) => l.replace(/^•\s*/, '').trim())
      .filter(Boolean)
      .slice(0, 6)
      .map((text, idx) => ({ id: `starter_${idx + 1}`, text: text.slice(0, 280) }));
  }
  return [];
}

function buildFactSummary(structured = {}, facts = {}, anchors = {}, opportunities = []) {
  const lines = [];
  const person = anchors.people?.[0] || facts.contacts?.[0]?.label;
  const email = facts.emails?.[0]
    || (Array.isArray(opportunities) ? null : null);
  if (person) lines.push(`Contact: ${person}${facts.emails?.[0] ? ` (${facts.emails[0]})` : ''}`);
  const quote = opportunities.find((o) => o.moduleKey === 'quotes') || facts.quotes?.[0];
  if (quote) lines.push(`Quote in focus: ${quote.label}`);
  const deal = opportunities.find((o) => o.moduleKey === 'deals') || facts.deals?.[0];
  if (deal) lines.push(`Deal: ${deal.label}`);
  const event = opportunities.find((o) => o.moduleKey === 'events');
  if (event) lines.push(`Meeting: ${event.label}`);
  else if (anchors.meetingName) lines.push(`Meeting: ${anchors.meetingName}`);

  // Keep non-meta bullets as facts
  for (const b of (structured.bullets || [])) {
    const t = String(b || '').trim();
    if (!t || isMetaCanvasProse(t) || META_STARTER_RE.test(t)) continue;
    if (lines.length >= 5) break;
    lines.push(t);
  }
  void email;
  return lines.slice(0, 5).join('\n');
}

function buildCrmWidgetBlocks({
  structured = {},
  citations = [],
  question = '',
  facts = {},
  opportunities = [],
}) {
  const anchors = extractIntentAnchors(question, structured);
  const blocks = [];
  const kpi = buildMeetingPrepKpis(structured, question, facts);
  if (kpi) blocks.push(kpi);
  const contact = buildContactBlock(facts, citations, anchors);
  if (contact) blocks.push(contact);
  const records = buildIntentRecordsBlock(opportunities, facts, anchors);
  if (records) blocks.push(records);
  const talking = buildTalkingPointsBlock(structured, facts, anchors, opportunities);
  if (talking) blocks.push(talking);
  return blocks;
}

/**
 * Enrich canvas with intent-matched CRM records (people + related), not calendar noise.
 * Returns a structured crmPack used to render Salesforce-style generative cards.
 */
async function enrichCanvasIntentContext({
  organizationId,
  appKey = 'SALES',
  question = '',
  structured = {},
  citations = [],
  contextText = '',
} = {}) {
  let nextCitations = Array.isArray(citations) ? [...citations] : [];
  let nextContext = String(contextText || '');
  const anchors = extractIntentAnchors(question, structured);
  const personQuery = anchors.people[0] || '';
  const crmPack = {
    primaryContact: null,
    company: null,
    stakeholders: [],
    deals: [],
    quotes: [],
    events: [],
    activities: [],
    tasks: [],
  };

  if (!organizationId) {
    return {
      citations: nextCitations,
      contextText: nextContext,
      facts: parseContextFacts(nextContext),
      anchors,
      crmPack,
    };
  }

  try {
    const mongoose = require('mongoose');
    const searchService = require('../searchService');
    const { getRecordContext } = require('../recordContextService');
    const {
      buildWorkGraphContextPack,
      loadDocument,
    } = require('./aiWorkGraphContextService');
    const RecordActivity = require('../../models/RecordActivity');
    const Quote = require('../../models/Quote');
    const Deal = require('../../models/Deal');
    const Event = require('../../models/Event');
    const orgOid = new mongoose.Types.ObjectId(organizationId);

    const personName = (doc) => {
      if (!doc) return '';
      const first = doc.first_name || doc.firstName || '';
      const last = doc.last_name || doc.lastName || '';
      return [first, last].filter(Boolean).join(' ').trim() || String(doc.email || '').trim();
    };

    let personId = '';
    // Prefer people citations that match the intent name
    const peopleCitations = nextCitations.filter((c) => String(c.sourceType || '').toLowerCase() === 'people');
    if (personQuery && peopleCitations.length) {
      const parts = personQuery.toLowerCase().split(/\s+/).filter(Boolean);
      const matched = peopleCitations.find((c) => {
        const ex = String(c.excerpt || '').toLowerCase();
        return parts.every((p) => ex.includes(p));
      }) || peopleCitations[0];
      if (matched?.sourceId) personId = String(matched.sourceId);
    } else if (peopleCitations[0]?.sourceId) {
      personId = String(peopleCitations[0].sourceId);
    }

    if (!personId && personQuery) {
      const pack = await searchService.searchAll(organizationId, personQuery, { limitPerModule: 4 });
      const peopleHits = Array.isArray(pack?.results?.people) ? pack.results.people : [];
      const person = peopleHits.find((h) => {
        const title = String(h.title || '').toLowerCase();
        const parts = personQuery.toLowerCase().split(/\s+/).filter(Boolean);
        return parts.every((p) => title.includes(p));
      }) || peopleHits[0];
      personId = String(person?.id || person?._id || '');
    }

    if (personId && mongoose.Types.ObjectId.isValid(personId)) {
      const [primaryDoc, expanded, recordCtx] = await Promise.all([
        loadDocument(organizationId, 'people', personId),
        buildWorkGraphContextPack({
          organizationId,
          appKey,
          moduleKey: 'people',
          recordId: personId,
          mode: 'sample',
        }),
        getRecordContext(organizationId, appKey, 'people', personId, { includeRelated: true }),
      ]);

      if (expanded?.text) {
        nextContext = [nextContext, expanded.text].filter(Boolean).join('\n\n').slice(0, 14000);
      }
      for (const c of expanded?.citations || []) {
        if (!c?.sourceType || !c?.sourceId) continue;
        const key = `${String(c.sourceType).toLowerCase()}:${String(c.sourceId)}`;
        if (nextCitations.some((x) => `${String(x.sourceType).toLowerCase()}:${String(x.sourceId)}` === key)) {
          continue;
        }
        nextCitations.push({ ...c, index: nextCitations.length + 1 });
      }

      if (primaryDoc) {
        const orgRaw = primaryDoc.organization;
        let orgName = '';
        let orgRecordId = '';
        let orgMeta = {};
        if (orgRaw && typeof orgRaw === 'object') {
          orgName = String(orgRaw.name || '').trim();
          orgRecordId = String(orgRaw._id || orgRaw.id || '');
          orgMeta = {
            industry: orgRaw.industry || '',
            status: orgRaw.status || '',
            email: orgRaw.email || '',
            phone: orgRaw.phone || '',
            website: orgRaw.website || '',
          };
        } else if (orgRaw) {
          orgRecordId = String(orgRaw);
          const orgDoc = await loadDocument(organizationId, 'organizations', orgRecordId);
          if (orgDoc) {
            orgName = String(orgDoc.name || '').trim();
            orgMeta = {
              industry: orgDoc.industry || '',
              status: orgDoc.status || '',
              email: orgDoc.email || '',
              phone: orgDoc.phone || '',
              website: orgDoc.website || '',
            };
          }
        }
        const sales = primaryDoc.participations?.SALES || {};
        crmPack.primaryContact = {
          recordId: personId,
          moduleKey: 'people',
          name: personName(primaryDoc),
          email: primaryDoc.email || '',
          title: primaryDoc.job_title || primaryDoc.jobTitle || sales.role || '',
          company: orgName,
          phone: primaryDoc.phone || primaryDoc.mobile || '',
        };
        if (orgName || orgRecordId) {
          crmPack.company = {
            name: orgName,
            recordId: orgRecordId,
            ...orgMeta,
          };
        }
        crmPack.stakeholders.push({ ...crmPack.primaryContact, role: 'Primary contact' });
      }

      // Related people from record context
      const relationships = Array.isArray(recordCtx?.relationships) ? recordCtx.relationships : [];
      for (const rel of relationships) {
        const mod = String(rel.target?.moduleKey || rel.moduleKey || '').toLowerCase();
        const records = Array.isArray(rel.records) ? rel.records : [];
        if (mod !== 'people') continue;
        for (const row of records.slice(0, 5)) {
          const id = String(row.recordId || row._id || row.id || '');
          if (!id || id === personId) continue;
          // eslint-disable-next-line no-await-in-loop
          const doc = await loadDocument(organizationId, 'people', id);
          if (!doc) continue;
          const sales = doc.participations?.SALES || {};
          crmPack.stakeholders.push({
            recordId: id,
            moduleKey: 'people',
            name: personName(doc),
            email: doc.email || '',
            title: doc.job_title || doc.jobTitle || sales.role || row.secondaryText || '',
            company: crmPack.company?.name || '',
            role: rel.relationshipKey || rel.label || 'Related',
          });
        }
      }

      // Quotes for this contact
      const quotes = await Quote.find({
        organizationId: orgOid,
        contactId: new mongoose.Types.ObjectId(personId),
        deletedAt: null,
      })
        .select('_id quoteTitle quoteNumber status validUntil currency grandTotal totalAmount amount organizationRefId')
        .populate('organizationRefId', 'name industry status email phone website')
        .sort({ updatedAt: -1 })
        .limit(6)
        .lean();
      for (const q of quotes) {
        const label = q.quoteTitle || q.quoteNumber || 'Quote';
        const status = String(q.status || '');
        const expiredByDate = q.validUntil ? new Date(q.validUntil).getTime() < Date.now() : false;
        const expired = status === 'Expired' || expiredByDate || /expir/i.test(label);
        crmPack.quotes.push({
          recordId: String(q._id),
          moduleKey: 'quotes',
          label: String(label).slice(0, 120),
          status,
          validUntil: q.validUntil || null,
          amount: q.grandTotal ?? q.totalAmount ?? q.amount ?? null,
          currency: q.currency || 'USD',
          expired,
        });
        nextCitations.push({
          index: nextCitations.length + 1,
          sourceType: 'quotes',
          sourceId: String(q._id),
          excerpt: String(label).slice(0, 200),
        });

        // Salesforce-style: account often lives on the quote even when contact.organization is empty
        const qOrg = q.organizationRefId && typeof q.organizationRefId === 'object'
          ? q.organizationRefId
          : null;
        if (qOrg && !crmPack.company) {
          crmPack.company = {
            name: String(qOrg.name || '').trim(),
            recordId: String(qOrg._id || ''),
            industry: qOrg.industry || '',
            status: qOrg.status || '',
            email: qOrg.email || '',
            phone: qOrg.phone || '',
            website: qOrg.website || '',
          };
          if (crmPack.primaryContact && !crmPack.primaryContact.company) {
            crmPack.primaryContact.company = crmPack.company.name;
          }
        }
      }

      // Deals for this contact
      const deals = await Deal.find({
        organizationId: orgOid,
        contactId: new mongoose.Types.ObjectId(personId),
      })
        .select('_id name amount stage status probability closeDate updatedAt')
        .sort({ updatedAt: -1 })
        .limit(5)
        .lean();
      for (const d of deals) {
        crmPack.deals.push({
          recordId: String(d._id),
          moduleKey: 'deals',
          label: String(d.name || 'Deal').slice(0, 120),
          amount: d.amount ?? 0,
          stage: d.stage || '',
          status: d.status || '',
          probability: d.probability,
          closeDate: d.closeDate || null,
        });
        nextCitations.push({
          index: nextCitations.length + 1,
          sourceType: 'deals',
          sourceId: String(d._id),
          excerpt: String(d.name || 'Deal').slice(0, 200),
        });
      }

      // Open tasks linked to this contact
      const Task = require('../../models/Task');
      const tasks = await Task.find({
        organizationId: orgOid,
        deletedAt: null,
        status: { $nin: ['completed', 'cancelled', 'done'] },
        'relatedTo.id': new mongoose.Types.ObjectId(personId),
      })
        .select('_id title status priority dueDate')
        .sort({ dueDate: 1, updatedAt: -1 })
        .limit(6)
        .lean();
      crmPack.tasks = (crmPack.tasks || []);
      for (const t of tasks) {
        crmPack.tasks.push({
          recordId: String(t._id),
          moduleKey: 'tasks',
          label: String(t.title || 'Task').slice(0, 120),
          status: t.status || '',
          priority: t.priority || '',
          dueDate: t.dueDate || null,
        });
      }

      // Intent-matched events (same person name in title, or topic)
      const eventQuery = {
        organizationId: orgOid,
        deletedAt: null,
        status: { $nin: ['Cancelled'] },
      };
      if (personQuery) {
        eventQuery.eventName = new RegExp(personQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      }
      const events = await Event.find(eventQuery)
        .select('_id eventName startDateTime endDateTime status')
        .sort({ startDateTime: -1 })
        .limit(4)
        .lean();
      for (const e of events) {
        crmPack.events.push({
          recordId: String(e._id),
          moduleKey: 'events',
          label: String(e.eventName || 'Meeting').slice(0, 120),
          startDateTime: e.startDateTime || null,
          status: e.status || '',
        });
      }

      // Activity timeline
      const activityRows = await RecordActivity.find({
        organizationId: orgOid,
        moduleKey: 'people',
        $or: [
          { recordId: personId },
          { recordId: new mongoose.Types.ObjectId(personId) },
        ],
      })
        .populate('author', 'firstName lastName email username')
        .sort({ createdAt: -1 })
        .limit(8)
        .lean();
      crmPack.activities = activityRows.map((entry) => {
        const who = entry.author
          ? [entry.author.firstName, entry.author.lastName].filter(Boolean).join(' ')
            || entry.author.email
            || 'User'
          : 'System';
        const body = entry.type === 'comment'
          ? String(entry.content || '').replace(/\s+/g, ' ').trim()
          : String(entry.message || entry.action || 'activity').replace(/\s+/g, ' ').trim();
        return {
          id: String(entry._id),
          who: String(who).slice(0, 60),
          body: body.slice(0, 240),
          at: entry.createdAt || null,
        };
      });
    }

    // Topic / status search for quotes when contact link is missing
    if (!crmPack.quotes.length) {
      const quoteQueries = [
        [personQuery, 'expired', 'quote'].filter(Boolean).join(' '),
        [personQuery, 'quote'].filter(Boolean).join(' '),
        'expired quote',
        'quote',
      ].filter((q, idx, arr) => q && arr.indexOf(q) === idx);

      for (const topicQ of quoteQueries) {
        if (crmPack.quotes.length) break;
        // eslint-disable-next-line no-await-in-loop
        const topicPack = await searchService.searchAll(organizationId, topicQ, { limitPerModule: 5 });
        for (const hit of (topicPack?.results?.quotes || []).slice(0, 4)) {
          const id = String(hit.id || hit._id || '');
          if (!id || crmPack.quotes.some((q) => q.recordId === id)) continue;
          // Prefer person-name match when we have an anchor
          if (personQuery) {
            const title = String(hit.title || '').toLowerCase();
            const parts = personQuery.toLowerCase().split(/\s+/).filter(Boolean);
            const personHit = parts.every((p) => title.includes(p));
            const expiredHit = /expir/i.test(title) || /expir/i.test(String(hit.subtitle || ''));
            if (!personHit && !expiredHit && topicQ === 'quote') continue;
          }
          // eslint-disable-next-line no-await-in-loop
          const doc = await loadDocument(organizationId, 'quotes', id);
          if (!doc) continue;
          const label = doc.quoteTitle || doc.quoteNumber || hit.title || 'Quote';
          const status = String(doc.status || '');
          const expiredByDate = doc.validUntil ? new Date(doc.validUntil).getTime() < Date.now() : false;
          crmPack.quotes.push({
            recordId: id,
            moduleKey: 'quotes',
            label: String(label).slice(0, 120),
            status,
            validUntil: doc.validUntil || null,
            amount: doc.grandTotal ?? doc.totalAmount ?? doc.amount ?? null,
            currency: doc.currency || 'USD',
            expired: status === 'Expired' || expiredByDate || /expir/i.test(label),
          });

          // Backfill contact from quote if person search missed
          if (!personId && doc.contactId) {
            personId = String(doc.contactId);
            // eslint-disable-next-line no-await-in-loop
            const contactDoc = await loadDocument(organizationId, 'people', personId);
            if (contactDoc && !crmPack.primaryContact) {
              const orgName = contactDoc.organization && typeof contactDoc.organization === 'object'
                ? (contactDoc.organization.name || '')
                : '';
              const sales = contactDoc.participations?.SALES || {};
              crmPack.primaryContact = {
                recordId: personId,
                moduleKey: 'people',
                name: personName(contactDoc),
                email: contactDoc.email || '',
                title: contactDoc.job_title || contactDoc.jobTitle || sales.role || '',
                company: orgName,
              };
              crmPack.stakeholders.push({ ...crmPack.primaryContact, role: 'Primary contact' });
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('[ArivuCanvas] intent enrich failed:', err?.message || err);
  }

  // Dedupe stakeholders by recordId
  const seenPeople = new Set();
  crmPack.stakeholders = crmPack.stakeholders.filter((p) => {
    const id = String(p.recordId || p.name || '');
    if (!id || seenPeople.has(id)) return false;
    seenPeople.add(id);
    return true;
  }).slice(0, 8);

  const facts = parseContextFacts(nextContext);
  const opportunities = extractOpportunities(nextCitations, structured, question);
  const seeded = seedCrmPackFromSignals(crmPack, {
    opportunities,
    citations: nextCitations,
    facts,
    anchors,
  });

  return {
    citations: nextCitations,
    contextText: nextContext,
    facts,
    anchors,
    crmPack: seeded,
  };
}

function formatMoney(amount, currency = 'USD') {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return '—';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 0,
    }).format(Number(amount));
  } catch {
    return `${currency} ${Number(amount).toLocaleString()}`;
  }
}

function formatRelativeDays(date) {
  if (!date) return '—';
  const ms = Date.now() - new Date(date).getTime();
  if (Number.isNaN(ms)) return '—';
  const days = Math.round(ms / (24 * 60 * 60 * 1000));
  if (days <= 0) return 'today';
  if (days === 1) return '1 day';
  if (days < 14) return `${days} days`;
  if (days < 60) return `${Math.round(days / 7)} weeks`;
  return `${Math.round(days / 30)} mo`;
}

function formatActivityWhen(date) {
  if (!date) return '';
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(date));
  } catch {
    return String(date).slice(0, 10);
  }
}

/**
 * Compose ranked, data-backed canvas widgets. Omit empty metrics/sections — never hardcode placeholders.
 */
function composeCanvasWidgets({
  crmPack = {},
  structured = {},
  anchors = {},
  question = '',
  opportunities = [],
  citations = [],
  facts = {},
} = {}) {
  const pack = seedCrmPackFromSignals(crmPack, {
    opportunities,
    citations,
    facts,
    anchors,
  });
  const person = pack.primaryContact;
  const company = pack.company?.name || person?.company || '';
  const deal = (pack.deals || [])[0];
  const quote = (pack.quotes || []).find((q) => q.expired)
    || (pack.quotes || []).find((q) => /expir/i.test(`${q.label} ${q.status}`))
    || (pack.quotes || [])[0];
  const openQuotes = (pack.quotes || []).filter((q) => (
    !q.expired && !['Rejected', 'Cancelled', 'Expired'].includes(String(q.status || ''))
  ));
  const expiredQuotes = (pack.quotes || []).filter((q) => q.expired || q.status === 'Expired');
  const meeting = (pack.events || [])[0]
    || opportunities.find((o) => o.moduleKey === 'events');
  const lastActivity = (pack.activities || [])[0];
  const tasks = Array.isArray(pack.tasks) ? pack.tasks : [];
  const pipelineValue = (pack.deals || []).reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  // KPIs: only include metrics with real values from the application
  const kpis = [];
  if (pipelineValue > 0) {
    kpis.push({
      label: 'Pipeline value',
      value: formatMoney(pipelineValue),
      hint: `${(pack.deals || []).length} open deal(s)`,
      source: 'deals.amount',
    });
  } else if (deal && Number(deal.amount) > 0) {
    kpis.push({
      label: 'Deal value',
      value: formatMoney(deal.amount),
      hint: deal.stage || deal.label,
      source: 'deals.amount',
    });
  }
  if (openQuotes.length) {
    kpis.push({
      label: 'Open quotes',
      value: String(openQuotes.length),
      source: 'quotes.status',
    });
  }
  if (expiredQuotes.length) {
    kpis.push({
      label: 'Expired quotes',
      value: String(expiredQuotes.length),
      source: 'quotes.validUntil|status',
    });
  }
  if (lastActivity?.at) {
    kpis.push({
      label: 'Last engagement',
      value: formatRelativeDays(lastActivity.at),
      source: 'recordActivity.createdAt',
    });
  }
  if (meeting?.startDateTime || meeting?.label) {
    const when = meeting.startDateTime
      ? formatActivityWhen(meeting.startDateTime)
      : '';
    const meetingLabel = String(meeting.label || meeting.excerpt || '').slice(0, 48);
    kpis.push({
      label: 'Focus meeting',
      value: when || 'Upcoming',
      hint: meetingLabel || undefined,
      source: 'events.startDateTime',
    });
  }
  if (tasks.length) {
    kpis.push({
      label: 'Open tasks',
      value: String(tasks.length),
      source: 'tasks.status',
    });
  }

  const who = person?.name || anchors.people?.[0] || '';
  const heroParts = [];
  if (who) {
    heroParts.push(`${who}${company ? ` (${company})` : ''}${person?.title ? `, ${person.title}` : ''}.`);
  }
  if (quote) {
    heroParts.push(
      quote.expired || quote.status === 'Expired'
        ? `Expired quote in focus: ${quote.label}${quote.validUntil ? ` (valid until ${formatActivityWhen(quote.validUntil)})` : ''}.`
        : `Quote in focus: ${quote.label}${quote.status ? ` — ${quote.status}` : ''}.`,
    );
  }
  if (deal) {
    heroParts.push(
      `Open deal ${deal.label}${deal.stage ? ` in ${deal.stage}` : ''}${deal.amount ? ` (${formatMoney(deal.amount)})` : ''}.`,
    );
  }
  if (meeting?.label || meeting?.excerpt) {
    heroParts.push(`Meeting: ${meeting.label || meeting.excerpt}.`);
  }
  const heroSummary = heroParts.join(' ').slice(0, 600)
    || buildFactSummary(structured, {}, anchors, opportunities);

  const widgets = [];

  if (kpis.length) {
    widgets.push({
      id: 'widget_kpis',
      type: 'kpi_strip',
      title: 'Key metrics',
      score: 100,
      items: kpis.slice(0, 6),
    });
  }

  const stakeholderPeople = (pack.stakeholders || []).slice(0, 6);
  if (stakeholderPeople.length) {
    widgets.push({
      id: 'widget_stakeholders',
      type: 'record_list',
      title: 'Stakeholders',
      score: 90,
      moduleKey: 'people',
      records: stakeholderPeople.map((p) => ({
        recordId: p.recordId,
        moduleKey: 'people',
        label: p.name,
        subtitle: [p.title || p.role, p.company || company, p.email].filter(Boolean).join(' · '),
        initials: String(p.name || '?')
          .split(/\s+/)
          .map((w) => w[0])
          .join('')
          .slice(0, 2)
          .toUpperCase(),
      })),
      actions: [
        {
          label: '+ Add stakeholder',
          kind: 'improvise',
          prompt: who
            ? `Add another stakeholder for the meeting with ${who}`
            : 'Add another stakeholder to this canvas',
        },
        person?.email && {
          label: 'Email primary',
          kind: 'send_email',
          moduleKey: 'people',
          recordId: person.recordId,
          email: {
            to: person.email,
            subject: `Follow-up: ${meeting?.label || who || 'meeting'}`,
          },
        },
      ].filter(Boolean),
    });
  }

  // Account / Organization — Salesforce Generative Canvas style
  const companyPack = pack.company;
  if (companyPack?.name || companyPack?.recordId) {
    const orgFields = [
      companyPack.name && { label: 'Account name', value: companyPack.name },
      companyPack.industry && { label: 'Industry', value: companyPack.industry },
      companyPack.status && { label: 'Status', value: companyPack.status },
      companyPack.website && { label: 'Website', value: companyPack.website },
      companyPack.email && { label: 'Email', value: companyPack.email },
      companyPack.phone && { label: 'Phone', value: companyPack.phone },
      who && { label: 'Primary contact', value: who },
      person?.email && { label: 'Contact email', value: person.email },
    ].filter(Boolean);
    widgets.push({
      id: 'widget_organization',
      type: 'detail',
      title: 'Account',
      score: 92,
      moduleKey: 'organizations',
      headline: companyPack.name || 'Account',
      body: [
        companyPack.industry ? `${companyPack.industry} account` : 'Account snapshot',
        who ? `· primary contact ${who}` : '',
      ].filter(Boolean).join(' '),
      fields: orgFields,
      links: [
        companyPack.recordId && {
          moduleKey: 'organizations',
          recordId: companyPack.recordId,
          label: companyPack.name || 'Open account',
        },
        person?.recordId && {
          moduleKey: 'people',
          recordId: person.recordId,
          label: who || 'Contact',
        },
      ].filter(Boolean),
      actions: companyPack.recordId
        ? [{
          label: 'Open account',
          kind: 'review_record',
          moduleKey: 'organizations',
          recordId: companyPack.recordId,
        }]
        : [],
    });
  }

  // Opportunity / quote focus — only when we have a real deal or quote
  if (deal || quote) {
    const fields = [];
    if (quote) {
      fields.push({
        label: quote.expired || quote.status === 'Expired' ? 'Expired quote' : 'Quote',
        value: [
          quote.label,
          quote.status,
          quote.amount != null ? formatMoney(quote.amount, quote.currency) : null,
          quote.validUntil ? `valid until ${formatActivityWhen(quote.validUntil)}` : null,
        ].filter(Boolean).join(' · '),
      });
    }
    if (deal) {
      fields.push({
        label: 'Deal',
        value: [
          deal.label,
          deal.stage || deal.status,
          deal.amount != null ? formatMoney(deal.amount) : null,
        ].filter(Boolean).join(' · '),
      });
    }
    if (quote?.expired || quote?.status === 'Expired') {
      fields.push({
        label: 'Current roadblock',
        value: `Quote "${quote.label}" is expired — renew, revise terms, or close out.`,
      });
    } else if (deal?.stage) {
      fields.push({
        label: 'Current stage',
        value: `${deal.label} is in ${deal.stage}. Confirm next commercial step.`,
      });
    }
    if (meeting?.label) {
      fields.push({
        label: 'Next milestone',
        value: `Use meeting "${meeting.label}" to align owners and dates.`,
      });
    }

    widgets.push({
      id: 'widget_opportunity',
      type: 'detail',
      title: 'Opportunity analysis',
      score: quote?.expired ? 95 : 85,
      headline: deal?.label || quote?.label || (who ? `Opportunity — ${who}` : 'Opportunity'),
      body: [
        deal ? `${deal.label}${deal.amount ? ` · ${formatMoney(deal.amount)}` : ''}${deal.stage ? ` · ${deal.stage}` : ''}` : '',
        quote ? `${quote.label}${quote.expired ? ' (expired)' : ''}${quote.status ? ` · ${quote.status}` : ''}` : '',
        company ? `Account: ${company}` : '',
      ].filter(Boolean).join('. '),
      fields,
      links: [
        deal && { moduleKey: 'deals', recordId: deal.recordId, label: deal.label },
        quote && { moduleKey: 'quotes', recordId: quote.recordId, label: quote.label },
      ].filter(Boolean),
    });
  }

  if ((pack.quotes || []).length > 1 || ((pack.quotes || []).length === 1 && !deal)) {
    widgets.push({
      id: 'widget_quotes',
      type: 'record_list',
      title: 'Quotes',
      score: expiredQuotes.length ? 88 : 70,
      moduleKey: 'quotes',
      records: (pack.quotes || []).slice(0, 6).map((q) => ({
        recordId: q.recordId,
        moduleKey: 'quotes',
        label: q.label,
        subtitle: [
          q.status,
          q.expired ? 'Expired' : null,
          q.amount != null ? formatMoney(q.amount, q.currency) : null,
        ].filter(Boolean).join(' · '),
      })),
    });
  }

  if ((pack.deals || []).length) {
    widgets.push({
      id: 'widget_deals',
      type: 'record_list',
      title: 'Deals',
      score: 75,
      moduleKey: 'deals',
      records: (pack.deals || []).slice(0, 5).map((d) => ({
        recordId: d.recordId,
        moduleKey: 'deals',
        label: d.label,
        subtitle: [d.stage || d.status, d.amount != null ? formatMoney(d.amount) : null]
          .filter(Boolean).join(' · '),
      })),
    });
  }

  const goals = [
    quote?.expired || quote?.status === 'Expired' ? `Resolve expired quote: ${quote.label}` : null,
    quote && !quote.expired ? `Advance quote: ${quote.label}` : null,
    deal ? `Move ${deal.label} forward` : null,
    who ? `Align ${who} on decisions and owners` : null,
    'Capture follow-ups with due dates',
  ].filter(Boolean).slice(0, 5);
  const topics = [
    quote?.expired || quote?.status === 'Expired'
      ? `Renew or close expired quote (${quote.label})`
      : null,
    quote && !quote.expired ? `Quote status & commercial terms (${quote.label})` : null,
    !quote && /\bexpir/i.test(question) ? 'Expired quote: renew, revise, or close out' : null,
    deal?.stage ? `Pipeline stage: ${deal.stage}` : null,
    meeting?.label ? `Agenda: ${String(meeting.label).slice(0, 80)}` : null,
    'Risks, blockers, and next meeting',
  ].filter(Boolean).slice(0, 5);

  if (goals.length || topics.length) {
    widgets.push({
      id: 'widget_meeting_notes',
      type: 'notes',
      title: 'Meeting notes',
      score: 80,
      sections: [
        goals.length ? { label: 'Meeting goals', items: goals } : null,
        topics.length ? { label: 'Discussion topics', items: topics } : null,
      ].filter(Boolean),
      actions: [{
        label: 'Add discussion topic',
        kind: 'improvise',
        prompt: who
          ? `Add a discussion topic to the meeting notes for ${who}`
          : 'Add a discussion topic to the meeting notes',
      }],
    });
  }

  if ((pack.activities || []).length) {
    widgets.push({
      id: 'widget_timeline',
      type: 'timeline',
      title: 'Conversation recap',
      score: 72,
      body: lastActivity
        ? `Latest: ${lastActivity.who} — ${lastActivity.body}`
        : '',
      items: (pack.activities || []).slice(0, 6).map((a) => ({
        who: a.who,
        body: a.body,
        when: formatActivityWhen(a.at),
        initials: String(a.who || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
      })),
    });
  }

  if (tasks.length) {
    widgets.push({
      id: 'widget_tasks',
      type: 'record_list',
      title: 'Open tasks',
      score: 68,
      moduleKey: 'tasks',
      records: tasks.slice(0, 6).map((t) => ({
        recordId: t.recordId,
        moduleKey: 'tasks',
        label: t.label,
        subtitle: [t.status, t.priority, t.dueDate ? formatActivityWhen(t.dueDate) : null]
          .filter(Boolean).join(' · '),
      })),
    });
  }

  if ((pack.events || []).length) {
    widgets.push({
      id: 'widget_events',
      type: 'record_list',
      title: 'Related meetings',
      score: 65,
      moduleKey: 'events',
      records: (pack.events || []).slice(0, 4).map((e) => ({
        recordId: e.recordId,
        moduleKey: 'events',
        label: e.label,
        subtitle: [e.status, e.startDateTime ? formatActivityWhen(e.startDateTime) : null]
          .filter(Boolean).join(' · '),
      })),
    });
  }

  // Rank and keep the best usable widgets (premium, not empty placeholders)
  const ranked = widgets
    .filter((w) => {
      if (w.type === 'kpi_strip') return (w.items || []).length > 0;
      if (w.type === 'record_list') return (w.records || []).length > 0;
      if (w.type === 'detail') return (w.fields || []).length > 0 || w.body;
      if (w.type === 'notes') return (w.sections || []).some((s) => (s.items || []).length);
      if (w.type === 'timeline') return (w.items || []).length > 0;
      return true;
    })
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 8)
    .map(({ score, ...rest }) => rest);

  const titlePerson = person?.name || anchors.people?.[0] || '';
  const title = titlePerson
    ? `Prep for ${titlePerson}${meeting?.label ? ` — ${String(meeting.label).slice(0, 40)}` : ''}`
    : (String(structured.headline || '').replace(/\bopening arivu canvas to\b/i, '').trim() || 'Meeting prep canvas');

  // Legacy cards adapter for older clients (derived from widgets, not hardcoded empty shells)
  const cards = ranked
    .filter((w) => ['record_list', 'detail', 'notes', 'timeline'].includes(w.type))
    .map((w) => {
      if (w.type === 'record_list' && w.moduleKey === 'people') {
        return {
          id: w.id,
          type: 'stakeholders',
          title: w.title,
          people: (w.records || []).map((r) => ({
            recordId: r.recordId,
            moduleKey: 'people',
            name: r.label,
            title: r.subtitle || '',
            initials: r.initials,
          })),
          actions: w.actions || [],
        };
      }
      if (w.type === 'detail') {
        return {
          id: w.id,
          type: 'opportunity_analysis',
          title: w.title,
          recap: w.body || '',
          opportunityName: w.headline || '',
          fields: w.fields || [],
          links: w.links || [],
        };
      }
      if (w.type === 'notes') {
        const goalsSec = (w.sections || []).find((s) => /goal/i.test(s.label));
        const topicsSec = (w.sections || []).find((s) => /topic/i.test(s.label));
        return {
          id: w.id,
          type: 'meeting_notes',
          title: w.title,
          goals: goalsSec?.items || [],
          topics: topicsSec?.items || [],
          actions: w.actions || [],
        };
      }
      if (w.type === 'timeline') {
        return {
          id: w.id,
          type: 'conversation_recap',
          title: w.title,
          recap: w.body || '',
          items: w.items || [],
        };
      }
      return null;
    })
    .filter(Boolean);

  return {
    title: String(title).slice(0, 160),
    heroSummary,
    kpis: kpis.slice(0, 6),
    widgets: ranked,
    cards,
  };
}

/** @deprecated Use composeCanvasWidgets — kept for tests/export alias */
function buildGenerativeCanvasCards(args) {
  return composeCanvasWidgets(args);
}

/**
 * Build a serializable Arivu Canvas document from Astra answer + CRM context.
 */
function buildArivuCanvasDocument({
  question = '',
  structured = {},
  citations = [],
  contextText = '',
  facts: factsIn = null,
  crmPack = null,
  mode: modeOverride = null,
} = {}) {
  const mode = modeOverride || resolveCanvasMode(question);
  const headline = String(structured.headline || '').trim() || 'Arivu Canvas';
  let detail = String(structured.detail || '').trim();
  const anchors = extractIntentAnchors(question, structured);
  const meetingName = anchors.meetingName;
  const facts = factsIn || parseContextFacts(contextText);
  const opportunities = mode === 'crm'
    ? extractOpportunities(citations, structured, question)
    : [];

  const generative = mode === 'crm'
    ? composeCanvasWidgets({
      crmPack: crmPack || {},
      structured,
      anchors,
      question,
      opportunities,
      citations,
      facts,
    })
    : null;

  let blocks = safeBlocks(structured.visuals).filter((b) => {
    if (b.component !== 'callout' || !b.body) return true;
    return !isMetaCanvasProse(b.body);
  });

  // Prefer ranked widgets; fall back to AstraUiBlock visuals only when no widgets.
  if (mode === 'crm' && !(generative?.widgets || []).length) {
    const fallbackWidgets = buildCrmWidgetBlocks({
      structured,
      citations,
      question,
      facts,
      opportunities,
    });
    blocks = [...fallbackWidgets, ...blocks].slice(0, 12);
  } else if (mode === 'crm') {
    blocks = [];
  }

  let presentationOutline = detail;
  if (mode === 'presentation' && looksLikeWeakPresentationDetail(detail)) {
    presentationOutline = buildDefaultMeetingDeckOutline(meetingName, headline);
    detail = [
      `Deck for ${meetingName || 'your upcoming meeting'}.`,
      'Editable slide outline below — refine topics in Astra, then export if needed.',
    ].join(' ');
  }

  if (mode === 'crm') {
    detail = generative?.heroSummary || buildFactSummary(structured, facts, anchors, opportunities);
  }

  const slides = mode === 'presentation'
    ? outlineToSlides(presentationOutline || structured.bullets?.join('\n') || '', headline)
    : [];

  const starters = mode === 'presentation'
    ? extractPresentationStarters(slides)
    : extractStarters(structured, mode, facts, anchors, opportunities);

  const personName = anchors.people[0] || facts.contacts?.[0]?.label || crmPack?.primaryContact?.name || '';

  const doc = {
    version: 3,
    mode,
    title: (generative?.title || headline).slice(0, 160),
    subtitle: mode === 'presentation'
      ? 'Presentation canvas — slide outline grounded in CRM context'
      : 'Generative CRM canvas — live records you can open and improvise',
    summary: detail.slice(0, 2000),
    heroSummary: generative?.heroSummary || detail.slice(0, 600),
    kpis: generative?.kpis || [],
    widgets: generative?.widgets || [],
    cards: generative?.cards || [],
    suggestedPrompts: defaultSuggestedPrompts(mode, meetingName, personName),
    conversationStarters: starters,
    opportunities,
    blocks: mode === 'crm' ? blocks : [],
    slides,
    actions: Array.isArray(structured.actions)
      ? structured.actions
        .filter((a) => a && a.kind !== 'open_canvas')
        .slice(0, 6)
        .map((a) => ({
          label: String(a.label || '').slice(0, 120),
          kind: String(a.kind || 'manual'),
          moduleKey: a.moduleKey ? String(a.moduleKey) : undefined,
          recordId: a.recordId ? String(a.recordId) : undefined,
          fields: a.fields && typeof a.fields === 'object' ? a.fields : undefined,
          priority: a.priority || 'medium',
          rationale: a.rationale ? String(a.rationale).slice(0, 200) : undefined,
        }))
      : [],
    sourceQuestion: String(question || '').slice(0, 400),
    createdAt: new Date().toISOString(),
  };

  if (mode === 'presentation' && doc.slides.length < 3) {
    doc.slides = outlineToSlides(buildDefaultMeetingDeckOutline(meetingName, headline), headline);
    doc.conversationStarters = extractPresentationStarters(doc.slides);
  }

  return doc;
}

function serializeCanvasForAction(doc) {
  try {
    return JSON.stringify(doc).slice(0, 48000);
  } catch {
    return '';
  }
}

function parseCanvasFromActionFields(fields = {}) {
  const raw = fields.canvasJson || fields.canvas || '';
  if (!raw || typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

module.exports = {
  isCanvasCrmQuestion,
  isCanvasPresentationQuestion,
  isArivuCanvasQuestion,
  isCanvasImproviseTurn,
  isExplicitReportOrChartQuestion,
  resolveCanvasMode,
  outlineToSlides,
  buildArivuCanvasDocument,
  enrichCanvasIntentContext,
  buildGenerativeCanvasCards,
  composeCanvasWidgets,
  serializeCanvasForAction,
  parseCanvasFromActionFields,
  looksLikeWeakPresentationDetail,
  buildDefaultMeetingDeckOutline,
  extractMeetingName,
  extractIntentAnchors,
  isMetaCanvasProse,
  extractOpportunities,
};
