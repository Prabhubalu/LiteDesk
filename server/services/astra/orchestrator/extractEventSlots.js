'use strict';

/**
 * Intelligent event slot extraction — LLM-first, smart fallback.
 * Never dump the user's raw sentence into the event title.
 */

const GARBAGE_TITLE = /\b(create|event|meeting|appointment|tomorrow|today|regarding|related contact|or wil|or with|for \d+\s*min)\b/i;
const INSTRUCTION_DUMP = /\b(or|with|regarding|tomorrow|at\s+\d)\b/i;

function isGarbageTitle(title) {
  const t = String(title || '').trim();
  if (!t || t.length < 2) return true;
  if (t.length > 80 && INSTRUCTION_DUMP.test(t)) return true;
  if (GARBAGE_TITLE.test(t) && (t.length > 40 || /\b(or|wil|regarding)\b/i.test(t))) return true;
  if (/\bcreate\b/i.test(t)) return true;
  return false;
}

function parseLlmSlotsJson(text) {
  const raw = String(text || '').trim();
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    const durationRaw = parsed.durationMinutes ?? parsed.duration_minutes;
    return {
      title: parsed.title ? String(parsed.title).trim().slice(0, 255) : null,
      description: parsed.description || parsed.agenda || parsed.topic
        ? String(parsed.description || parsed.agenda || parsed.topic).trim().slice(0, 2000)
        : null,
      relatedName: parsed.relatedName || parsed.organization || parsed.org
        ? String(parsed.relatedName || parsed.organization || parsed.org).trim().slice(0, 255)
        : null,
      contactName: parsed.contactName || parsed.contact || parsed.person
        ? String(parsed.contactName || parsed.contact || parsed.person).trim().slice(0, 255)
        : null,
      day: parsed.day ? String(parsed.day).trim().slice(0, 40) : null,
      time: parsed.time ? String(parsed.time).trim().slice(0, 20) : null,
      meridiem: parsed.meridiem ? String(parsed.meridiem).trim().slice(0, 4) : null,
      durationMinutes: Number.isFinite(Number(durationRaw))
        ? Math.min(24 * 60, Math.max(5, Number(durationRaw)))
        : null,
    };
  } catch {
    return null;
  }
}

/** Deterministic cleanup when LLM is unavailable. */
function heuristicEventSlots(query) {
  const q = String(query || '').trim();

  let title = null;
  const quoted = q.match(/["'“”]([^"'“”]{2,120})["'“”]/);
  if (quoted?.[1]) title = quoted[1].trim();

  const regarding = q.match(/\bregarding\s+["']?([^"'.\n]{2,120})["']?/i);
  if (!title && regarding?.[1]) {
    title = regarding[1].trim().replace(/[?.!,]+$/, '');
  }
  if (!title) {
    const about = q.match(/\b(?:about|for)\s+["']?([A-Z][^"'.\n]{2,80})["']?/);
    if (about?.[1] && !/\btomorrow|today|minute/i.test(about[1])) {
      title = about[1].trim();
    }
  }

  let relatedName = null;
  const orgMatch = q.match(
    /\b(?:with|for|at)\s+([A-Za-z0-9][A-Za-z0-9 .&_-]{1,60}?)\s+(?:organization|org|company|account)\b/i,
  )
    || q.match(/\b([A-Za-z0-9][A-Za-z0-9 .&_-]{1,40})\s+(?:organization|org|CRM)\b/i);
  if (orgMatch?.[1] && !/^(an|the|a|create|event|meeting)$/i.test(orgMatch[1].trim())) {
    relatedName = orgMatch[1].trim().replace(/\s+or\b.*$/i, '').trim();
    if (/vtiger/i.test(relatedName) && !/crm/i.test(relatedName)) {
      relatedName = `${relatedName} CRM`.replace(/\s+/g, ' ');
    }
  }

  let contactName = null;
  const contactMatch = q.match(/\brelated\s+contact\b/i);
  if (contactMatch && relatedName) {
    contactName = null; // resolve later via org relationships
  }

  const durationMatch = q.match(/\bfor\s+(\d{1,3})\s*(min|mins|minutes|hour|hours|hr|hrs)\b/i);
  let durationMinutes = 30;
  if (durationMatch) {
    const n = Number(durationMatch[1]);
    durationMinutes = /hour|hr/i.test(durationMatch[2]) ? n * 60 : n;
  }

  const timeMatch = q.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/i)
    || q.match(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/i);
  let time = null;
  let meridiem = null;
  if (timeMatch) {
    const h = Number(timeMatch[1]);
    const m = timeMatch[2] || '00';
    time = `${h}:${m}`;
    meridiem = (timeMatch[3] || '').toLowerCase().replace(/\./g, '') || null;
  }

  let day = null;
  if (/\btomorrow\b/i.test(q)) day = 'tomorrow';
  else if (/\btoday\b/i.test(q)) day = 'today';

  if (title && isGarbageTitle(title)) title = null;
  if (!title && relatedName) title = `${relatedName} meeting`;
  if (!title) title = 'Meeting';

  const descriptionParts = [];
  if (quoted?.[1]) descriptionParts.push(`Agenda: ${quoted[1].trim()}`);
  else if (regarding?.[1]) descriptionParts.push(`Agenda: ${regarding[1].trim()}`);
  if (relatedName) descriptionParts.push(`Organization: ${relatedName}`);
  if (/\brelated\s+contact\b/i.test(q)) {
    descriptionParts.push('Include related contact for this organization.');
  }

  return {
    title: title.slice(0, 255),
    description: descriptionParts.join('\n').slice(0, 2000) || null,
    relatedName,
    contactName,
    day,
    time,
    meridiem,
    durationMinutes,
    source: 'heuristic',
  };
}

async function extractEventSlotsWithLlm({ query, llm, organizationId = null, prior = null }) {
  if (typeof llm !== 'function') return null;
  const messages = [
    {
      role: 'system',
      content: [
        'Extract calendar event fields from the user message. Return ONLY JSON.',
        'Rules:',
        '- title: short clean meeting name (2–8 words). Prefer the agenda/topic (e.g. "Partner Implementation"). NEVER copy the full user sentence. NEVER include typos like "wil". NEVER include "create/event/tomorrow/for 30 min".',
        '- description: 1–3 sentences with agenda + context (organization, purpose).',
        '- relatedName: organization/company name only (e.g. "Vtiger CRM").',
        '- contactName: specific person if named; otherwise null (do not invent).',
        '- day: today|tomorrow|empty',
        '- time: HH:MM in 12-hour numbers as spoken (11:00 for 11 AM)',
        '- meridiem: am|pm',
        '- durationMinutes: integer',
        'JSON: {"title":"","description":"","relatedName":"","contactName":null,"day":"","time":"","meridiem":"","durationMinutes":30}',
        'Example:',
        'USER: Create an event with Vtiger organization or its related contact, regarding "Partner Implementation" tomorrow at 11 AM, for 30 min.',
        '→ {"title":"Partner Implementation","description":"Kickoff / discussion on Partner Implementation with Vtiger CRM and related contact.","relatedName":"Vtiger CRM","contactName":null,"day":"tomorrow","time":"11:00","meridiem":"am","durationMinutes":30}',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `USER: ${query}`,
        prior ? `PRIOR_HINT: ${JSON.stringify(prior)}` : '',
        'Respond with JSON only.',
      ].filter(Boolean).join('\n'),
    },
  ];

  try {
    const completion = await llm(messages, {
      organizationId,
      temperature: 0,
      maxTokens: 320,
    });
    const parsed = parseLlmSlotsJson(completion?.text);
    if (!parsed?.title || isGarbageTitle(parsed.title)) return null;
    return { ...parsed, source: 'llm' };
  } catch {
    return null;
  }
}

/**
 * Merge intent classification slots + dedicated extraction + heuristic.
 */
async function resolveEventCreateSlots({
  query,
  classification = {},
  llm,
  organizationId = null,
}) {
  const prior = {
    title: classification.llmTitle || null,
    relatedName: classification.llmRelatedName || null,
    topic: classification.llmTopic || null,
    day: classification.llmDay || null,
    time: classification.llmTime || null,
    meridiem: classification.llmMeridiem || null,
    durationMinutes: classification.llmDurationMinutes ?? null,
  };

  const llmSlots = await extractEventSlotsWithLlm({
    query,
    llm,
    organizationId,
    prior,
  });

  const heuristic = heuristicEventSlots(query);

  const title = (!isGarbageTitle(llmSlots?.title) && llmSlots?.title)
    || (!isGarbageTitle(prior.title) && prior.title)
    || (!isGarbageTitle(heuristic.title) && heuristic.title)
    || 'Meeting';

  const description = llmSlots?.description
    || prior.topic
    || heuristic.description
    || null;

  const relatedName = llmSlots?.relatedName
    || prior.relatedName
    || heuristic.relatedName
    || null;

  const contactName = llmSlots?.contactName || heuristic.contactName || null;

  const day = llmSlots?.day || prior.day || heuristic.day || null;
  const time = llmSlots?.time || prior.time || heuristic.time || null;
  const meridiem = llmSlots?.meridiem || prior.meridiem || heuristic.meridiem || null;
  const durationMinutes = llmSlots?.durationMinutes
    ?? prior.durationMinutes
    ?? heuristic.durationMinutes
    ?? 30;

  return {
    title: String(title).slice(0, 255),
    description,
    relatedName,
    contactName,
    day,
    time,
    meridiem,
    durationMinutes,
    source: llmSlots?.source || (prior.title && !isGarbageTitle(prior.title) ? 'intent_llm' : heuristic.source),
  };
}

module.exports = {
  isGarbageTitle,
  parseLlmSlotsJson,
  heuristicEventSlots,
  extractEventSlotsWithLlm,
  resolveEventCreateSlots,
};
