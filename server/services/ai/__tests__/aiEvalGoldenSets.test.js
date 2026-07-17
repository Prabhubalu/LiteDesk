'use strict';

const fs = require('fs');
const path = require('path');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { getPrompt } = require('../prompts/promptRegistry');
const { redactText } = require('../piiRedaction');

const GOLDEN_DIR = path.join(__dirname, '../eval/goldenSets');

function loadGoldenSet(fileName) {
  const raw = fs.readFileSync(path.join(GOLDEN_DIR, fileName), 'utf8');
  return JSON.parse(raw);
}

function assertPromptKeysExist(caseRow) {
  for (const key of caseRow.promptKeys || []) {
    const prompt = getPrompt(key);
    assert.ok(prompt.text, `missing prompt text for ${key}`);
    assert.ok(prompt.version, `missing prompt version for ${key}`);
  }
}

function assertOfflineGuards(caseRow) {
  if (caseRow.abilityKey === 'summarize' && caseRow.input?.description) {
    const redacted = redactText(caseRow.input.description);
    for (const banned of caseRow.mustNotInclude || []) {
      if (banned.includes('@')) {
        assert.doesNotMatch(redacted, new RegExp(banned.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      }
    }
  }

  if (caseRow.abilityKey === 'ask' && caseRow.mustCite) {
    assert.ok((caseRow.input.excerpts || []).length > 0, `${caseRow.id} mustCite requires excerpts`);
  }
}

describe('aiEvalGoldenSets', () => {
  it('loads summarize_case golden set with valid prompt keys', () => {
    const rows = loadGoldenSet('summarize_case.json');
    assert.ok(rows.length >= 1);
    for (const row of rows) {
      assert.equal(row.abilityKey, 'summarize');
      assertPromptKeysExist(row);
      assertOfflineGuards(row);
    }
  });

  it('loads draft_reply golden set with valid prompt keys', () => {
    const rows = loadGoldenSet('draft_reply.json');
    assert.ok(rows.length >= 1);
    for (const row of rows) {
      assert.equal(row.abilityKey, 'draft_reply');
      assertPromptKeysExist(row);
    }
  });

  it('loads ask golden set including no-answer fixture', () => {
    const rows = loadGoldenSet('ask.json');
    assert.ok(rows.some((row) => row.id === 'ask-no-answer'));
    for (const row of rows) {
      assert.equal(row.abilityKey, 'ask');
      assertPromptKeysExist(row);
      assertOfflineGuards(row);
    }
  });
});
