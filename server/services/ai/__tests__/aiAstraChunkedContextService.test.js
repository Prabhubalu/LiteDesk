'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  splitWorkGraphContext,
  batchChunksForMap,
  isChunkedContextEnabled,
  compressContextDeterministic,
  resolveChunkedCrmEvidence,
  CHUNK_TRIGGER_CHARS,
} = require('../aiAstraChunkedContextService');

describe('aiAstraChunkedContextService', () => {
  it('defaults chunked context on', () => {
    const prev = process.env.ASTRA_CHUNKED_CONTEXT_V1;
    delete process.env.ASTRA_CHUNKED_CONTEXT_V1;
    assert.equal(isChunkedContextEnabled(), true);
    process.env.ASTRA_CHUNKED_CONTEXT_V1 = 'false';
    assert.equal(isChunkedContextEnabled(), false);
    if (prev === undefined) delete process.env.ASTRA_CHUNKED_CONTEXT_V1;
    else process.env.ASTRA_CHUNKED_CONTEXT_V1 = prev;
  });

  it('fastPath compresses without LLM when over trigger', async () => {
    const big = `${'x'.repeat(CHUNK_TRIGGER_CHARS + 100)}\n=== PRIMARY RECORD (people) ===\nName: Ada\n=== RELATED RECORDS ===\n[1] RELATED deals: Big\nStage: New`;
    const out = await resolveChunkedCrmEvidence({
      contextText: big,
      fastPath: true,
    });
    assert.equal(out.usedChunking, true);
    assert.equal(out.mapCount, 0);
    assert.equal(out.deterministic, true);
    assert.match(out.text, /CHUNK-RESOLVED|PRIMARY|Digest/i);
  });

  it('compressContextDeterministic keeps primary signal', () => {
    const text = [
      '=== PRIMARY RECORD (people) ===',
      'Name: Ada Lovelace',
      '=== RELATED RECORDS ===',
      '[1] RELATED deals: Big Deal',
      'Stage: Proposal',
    ].join('\n');
    const out = compressContextDeterministic(text);
    assert.match(out, /Ada Lovelace/);
  });

  it('splits primary, activities, and related sections', () => {
    const text = [
      'CRM page context for people p1',
      'Context mode: record',
      '=== PRIMARY RECORD (people) ===',
      'Name: Ada Lovelace',
      'Email: ada@example.com',
      'Primary record activity / comments (2):',
      '- called yesterday',
      '- emailed quote',
      '=== RELATED RECORDS (2) ===',
      '[1] RELATED deals: Big Deal',
      'Stage: Proposal',
      '[2] RELATED tasks: Follow up',
      'Status: Open',
    ].join('\n');

    const chunks = splitWorkGraphContext(text);
    assert.ok(chunks.length >= 4);
    const primary = chunks.find((c) => /PRIMARY RECORD/i.test(c.label));
    assert.ok(primary?.keepFull);
    assert.match(primary.text, /Ada Lovelace/);
    const related = chunks.filter((c) => c.id.startsWith('related_'));
    assert.equal(related.length, 2);
    assert.equal(related.every((c) => c.keepFull === false), true);
  });

  it('batches related chunks under size cap', () => {
    const chunks = [
      { id: 'p', label: 'PRIMARY', text: 'primary body', keepFull: true },
      { id: 'related_1', label: 'Related deals #1', text: 'a'.repeat(3000), keepFull: false },
      { id: 'related_2', label: 'Related tasks #2', text: 'b'.repeat(3000), keepFull: false },
    ];
    const { keep, mapBatches } = batchChunksForMap(chunks);
    assert.equal(keep.length, 1);
    assert.ok(mapBatches.length >= 2);
  });
});
