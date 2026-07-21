'use strict';

/**
 * Map-reduce CRM context for record-page asks.
 * Splits work-graph text into chunks → parallel LLM digests → compact evidence for the final answer.
 * Keeps primary record verbatim; compresses related/activity volume without dropping coverage.
 *
 * Flag: ASTRA_CHUNKED_CONTEXT_V1 (default on; set false to disable)
 */

const { getLlmAdapter } = require('./providerRegistry');
const { redactMessages } = require('./piiRedaction');

const CHUNK_TRIGGER_CHARS = 8000;
const PRIMARY_KEEP_CHARS = 14000;
const RELATED_BATCH_CHARS = 4500;
const MAX_MAP_CHUNKS = 6;
const MAP_MAX_TOKENS = 220;
const MAP_CONCURRENCY = 4;

function isChunkedContextEnabled() {
  const raw = String(process.env.ASTRA_CHUNKED_CONTEXT_V1 ?? 'true').toLowerCase();
  return raw !== 'false' && raw !== '0' && raw !== 'off';
}

/**
 * Split work-graph pack text into semantic chunks.
 * @param {string} text
 * @returns {{ id: string, label: string, text: string, keepFull: boolean }[]}
 */
function splitWorkGraphContext(text = '') {
  const raw = String(text || '').trim();
  if (!raw) return [];

  const lines = raw.split('\n');
  const chunks = [];
  let current = { id: 'header', label: 'Header', text: '', keepFull: true };

  const flush = () => {
    const body = current.text.trim();
    if (body) chunks.push({ ...current, text: body });
  };

  for (const line of lines) {
    const relatedHit = line.match(/^\[(\d+)\]\s+RELATED\s+(\w+)/i);
    const sectionHit = line.match(/^===\s*(.+?)\s*===\s*$/);
    const activityHit = /^Primary record activity/i.test(line);

    if (relatedHit || sectionHit || activityHit) {
      flush();
      if (relatedHit) {
        current = {
          id: `related_${relatedHit[1]}`,
          label: `Related ${relatedHit[2]} #${relatedHit[1]}`,
          text: `${line}\n`,
          keepFull: false,
        };
      } else if (activityHit) {
        current = {
          id: 'primary_activities',
          label: 'Primary activities',
          text: `${line}\n`,
          keepFull: false,
        };
      } else {
        const title = String(sectionHit[1] || 'Section').trim();
        const isPrimary = /^PRIMARY/i.test(title) || /^CRM page/i.test(title);
        current = {
          id: `section_${chunks.length}`,
          label: title,
          text: `${line}\n`,
          keepFull: isPrimary,
        };
      }
      continue;
    }
    current.text += `${line}\n`;
  }
  flush();
  return chunks;
}

/**
 * Batch non-primary chunks into map units under RELATED_BATCH_CHARS.
 * @param {{ id: string, label: string, text: string, keepFull: boolean }[]} chunks
 */
function batchChunksForMap(chunks = []) {
  const keep = [];
  const mapBatches = [];
  let batch = { id: 'batch_0', label: 'Related batch', parts: [], text: '' };

  const pushBatch = () => {
    if (!batch.parts.length) return;
    mapBatches.push({
      id: batch.id,
      label: batch.label,
      text: batch.text.trim(),
    });
    batch = {
      id: `batch_${mapBatches.length}`,
      label: 'Related batch',
      parts: [],
      text: '',
    };
  };

  for (const chunk of chunks) {
    if (chunk.keepFull) {
      keep.push(chunk);
      continue;
    }
    if (batch.text.length + chunk.text.length > RELATED_BATCH_CHARS && batch.parts.length) {
      pushBatch();
    }
    batch.parts.push(chunk.id);
    batch.label = batch.parts.length === 1
      ? chunk.label
      : `Related batch (${batch.parts.length} sections)`;
    batch.text += `${chunk.text}\n\n`;
  }
  pushBatch();

  return { keep, mapBatches: mapBatches.slice(0, MAX_MAP_CHUNKS) };
}

async function mapOneChunk({
  adapter,
  config,
  redactOpts,
  question,
  analysisPlan,
  chunk,
}) {
  const planBit = Array.isArray(analysisPlan) && analysisPlan.length
    ? `Analysis focus: ${analysisPlan.slice(0, 5).join(' → ')}`
    : '';
  const messages = [
    {
      role: 'system',
      content: [
        'Extract CRM facts relevant to the staff question from ONE context chunk.',
        'Return plain text bullets only (no JSON, no preamble).',
        'Rules: use names/titles not Mongo ids; never invent; omit irrelevant noise;',
        'prefer dates, stages, amounts, owners, comment snippets, next steps.',
        'Max 8 short bullets. If nothing relevant, return "(no relevant facts)".',
      ].join(' '),
    },
    {
      role: 'user',
      content: [
        `Question: ${String(question || '').slice(0, 600)}`,
        planBit,
        `Chunk: ${chunk.label}`,
        '',
        chunk.text.slice(0, RELATED_BATCH_CHARS + 1500),
      ].filter(Boolean).join('\n'),
    },
  ];

  const completion = await adapter.complete({
    apiKey: config.apiKey,
    model: config.model,
    messages: redactMessages(messages, redactOpts),
    temperature: 0,
    maxTokens: MAP_MAX_TOKENS,
    providerOptions: config.providerOptions,
  });
  const digest = String(completion?.text || completion?.content || '').trim();
  return {
    label: chunk.label,
    digest: digest || '(no relevant facts)',
    usage: completion?.usage || null,
  };
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next;
      next += 1;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}

/**
 * Cheap compress when LLM map would add latency but pack is large.
 * Keeps primary verbatim; truncates related/activity chunks (no LLM).
 */
function compressContextDeterministic(contextText = '') {
  const raw = String(contextText || '');
  if (!raw.trim()) return raw;
  const chunks = splitWorkGraphContext(raw);
  const { keep, mapBatches } = batchChunksForMap(chunks);
  if (!mapBatches.length) return raw;
  const primaryParts = keep.map((c) => c.text.slice(0, PRIMARY_KEEP_CHARS));
  const digestParts = mapBatches.slice(0, MAX_MAP_CHUNKS).map((chunk, i) => (
    `--- Digest ${i + 1}: ${chunk.label} ---\n${String(chunk.text || '').slice(0, 1800)}`
  ));
  return [
    'CHUNK-RESOLVED CRM EVIDENCE (primary kept full; related/activity truncated for speed — no LLM map).',
    'Treat digests as compressed CRM truth — do not invent beyond them or the primary block.',
    '',
    ...primaryParts,
    '',
    '=== RESOLVED RELATED / ACTIVITY EVIDENCE ===',
    ...digestParts,
  ].filter(Boolean).join('\n');
}

/**
 * Resolve large CRM context into primary + digests for a fast final LLM call.
 * @returns {Promise<{ text: string, usedChunking: boolean, mapCount: number, usage: object|null }>}
 */
async function resolveChunkedCrmEvidence({
  question = '',
  contextText = '',
  config = null,
  redactOpts = {},
  analysisPlan = [],
  onProgress = null,
  /** Skip LLM map-reduce (deterministic truncate only) — for summarize/NBA TTFT. */
  fastPath = false,
} = {}) {
  const raw = String(contextText || '');
  if (!isChunkedContextEnabled() || !raw.trim() || raw.length < CHUNK_TRIGGER_CHARS) {
    return { text: raw, usedChunking: false, mapCount: 0, usage: null };
  }

  if (fastPath) {
    if (typeof onProgress === 'function') onProgress('resolving_chunks');
    return {
      text: compressContextDeterministic(raw),
      usedChunking: true,
      mapCount: 0,
      usage: null,
      deterministic: true,
    };
  }

  if (!config?.apiKey || !config?.provider || !config?.model) {
    return {
      text: compressContextDeterministic(raw),
      usedChunking: true,
      mapCount: 0,
      usage: null,
      deterministic: true,
    };
  }

  const adapter = getLlmAdapter(config.provider);
  if (!adapter?.complete) {
    return {
      text: compressContextDeterministic(raw),
      usedChunking: true,
      mapCount: 0,
      usage: null,
      deterministic: true,
    };
  }

  const chunks = splitWorkGraphContext(raw);
  const { keep, mapBatches } = batchChunksForMap(chunks);

  if (!mapBatches.length) {
    return { text: raw, usedChunking: false, mapCount: 0, usage: null };
  }

  if (typeof onProgress === 'function') {
    onProgress('resolving_chunks');
  }

  const mapped = await mapWithConcurrency(mapBatches, MAP_CONCURRENCY, async (chunk) => {
    try {
      return await mapOneChunk({
        adapter,
        config,
        redactOpts,
        question,
        analysisPlan,
        chunk,
      });
    } catch (err) {
      console.warn('[AstraChunkedContext] map failed:', err?.message || err);
      return {
        label: chunk.label,
        digest: chunk.text.slice(0, 1200),
        usage: null,
      };
    }
  });

  const usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  for (const row of mapped) {
    const u = row?.usage;
    if (!u) continue;
    usage.promptTokens += Number(u.promptTokens || 0);
    usage.completionTokens += Number(u.completionTokens || 0);
    usage.totalTokens += Number(u.totalTokens || 0);
  }

  const primaryParts = keep.map((c) => c.text.slice(0, PRIMARY_KEEP_CHARS));
  const digestParts = mapped.map((row, i) => (
    `--- Digest ${i + 1}: ${row.label} ---\n${row.digest}`
  ));

  const text = [
    'CHUNK-RESOLVED CRM EVIDENCE (primary kept full; related/activity facts map-reduced for speed).',
    'Treat digests as compressed CRM truth — do not invent beyond them or the primary block.',
    '',
    ...primaryParts,
    '',
    '=== RESOLVED RELATED / ACTIVITY EVIDENCE ===',
    ...digestParts,
  ].filter(Boolean).join('\n');

  return {
    text,
    usedChunking: true,
    mapCount: mapped.length,
    usage: usage.totalTokens > 0 ? usage : null,
  };
}

module.exports = {
  isChunkedContextEnabled,
  splitWorkGraphContext,
  batchChunksForMap,
  compressContextDeterministic,
  resolveChunkedCrmEvidence,
  CHUNK_TRIGGER_CHARS,
  MAX_MAP_CHUNKS,
};
