'use strict';

/**
 * Phase 4 Import mapping AI — suggest CSV header → fieldKey mappings.
 * Suggest-only: never writes templates or starts imports.
 * Every suggested fieldKey must be in the caller-supplied allow-list.
 */

const { getLlmAdapter } = require('./providerRegistry');
const { resolveAiRequestConfig } = require('./aiSettingsResolver');
const { assertCreditsAvailable, debitCredits } = require('./aiCreditService');
const { writeAiAuditLog } = require('./aiAuditLogService');
const { redactMessages } = require('./piiRedaction');
const { getPrompt } = require('./prompts/promptRegistry');
const { AiConfigurationError } = require('./errors');

function normalizeHeaders(headers) {
  return (Array.isArray(headers) ? headers : [])
    .map((h) => String(h || '').trim())
    .filter(Boolean)
    .slice(0, 80);
}

function normalizeFields(fields) {
  return (Array.isArray(fields) ? fields : [])
    .map((f) => ({
      fieldKey: String(f.fieldKey || f.value || '').trim(),
      label: String(f.label || f.fieldKey || f.value || '').trim(),
    }))
    .filter((f) => f.fieldKey)
    .slice(0, 120);
}

/**
 * Parse and constrain mapping suggestions to allowed field keys.
 */
function parseMappingSuggestions(text, headers, fields) {
  const allowed = new Set(fields.map((f) => f.fieldKey));
  const headerSet = new Set(headers);
  const raw = String(text || '').trim();
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]);
    const rows = Array.isArray(parsed?.mappings) ? parsed.mappings : [];
    const out = [];
    const seen = new Set();
    for (const row of rows) {
      const header = String(row?.header || '').trim();
      const fieldKey = String(row?.fieldKey || '').trim();
      if (!header || !headerSet.has(header) || seen.has(header)) continue;
      if (!fieldKey || !allowed.has(fieldKey)) continue;
      seen.add(header);
      out.push({
        header,
        fieldKey,
        confidence: Math.max(0, Math.min(1, Number(row.confidence) || 0)),
        rationale: String(row.rationale || '').slice(0, 160),
        confirmRequired: true,
      });
    }
    return out;
  } catch {
    return [];
  }
}

async function suggestImportColumnMapping({
  organizationId,
  userId,
  moduleKey = 'people',
  headers,
  fields,
}) {
  const startedAt = Date.now();
  const normalizedHeaders = normalizeHeaders(headers);
  const normalizedFields = normalizeFields(fields);

  if (normalizedHeaders.length < 1) {
    throw new AiConfigurationError('headers are required', 'AI_IMPORT_HEADERS_REQUIRED');
  }
  if (normalizedFields.length < 1) {
    throw new AiConfigurationError('fields are required', 'AI_IMPORT_FIELDS_REQUIRED');
  }

  let auditBase = {
    organizationId,
    userId,
    abilityKey: 'import_mapping',
    provider: 'unknown',
    model: 'unknown',
    keyMode: 'platform',
  };

  try {
    const config = await resolveAiRequestConfig({ organizationId, abilityKey: 'import_mapping' });
    auditBase = {
      ...auditBase,
      provider: config.provider,
      model: config.model,
      keyMode: config.keyMode,
    };
    assertCreditsAvailable({ keyMode: config.keyMode, creditsBalance: config.creditsBalance });

    const systemPrompt = getPrompt('import_mapping_system');
    const adapter = getLlmAdapter(config.provider);
    const completion = await adapter.complete({
      apiKey: config.apiKey,
      model: config.model,
      messages: redactMessages([
        { role: 'system', content: systemPrompt.text },
        {
          role: 'user',
          content: [
            `Module: ${String(moduleKey || 'people').slice(0, 40)}`,
            `CSV headers:\n${JSON.stringify(normalizedHeaders)}`,
            `Allowed fields (fieldKey + label):\n${JSON.stringify(normalizedFields)}`,
            'Return JSON only: {"mappings":[{"header":"...","fieldKey":"...","confidence":0-1,"rationale":"..."}]}.',
            'Only use fieldKeys from the allowed list. Skip headers you cannot map confidently.',
          ].join('\n'),
        },
      ]),
      temperature: 0.1,
      maxTokens: 800,
      providerOptions: config.providerOptions,
    });

    const mappings = parseMappingSuggestions(completion.text, normalizedHeaders, normalizedFields);
    const creditsDebited = await debitCredits({
      organizationId,
      keyMode: config.keyMode,
      usage: completion.usage,
    });

    await writeAiAuditLog({
      ...auditBase,
      status: 'success',
      promptVersion: systemPrompt.version,
      contextRefs: [{ sourceType: 'import', sourceId: String(moduleKey), moduleKey: String(moduleKey) }],
      usage: completion.usage,
      creditsDebited,
      latencyMs: Date.now() - startedAt,
    });

    const fieldMapping = {};
    for (const m of mappings) fieldMapping[m.header] = m.fieldKey;

    return {
      mappings,
      fieldMapping,
      unmappedHeaders: normalizedHeaders.filter((h) => !fieldMapping[h]),
      confirmRequired: true,
      autoApply: false,
      provider: config.provider,
      model: config.model,
      keyMode: config.keyMode,
      creditsDebited,
      usage: completion.usage,
    };
  } catch (error) {
    await writeAiAuditLog({
      ...auditBase,
      status: 'failed',
      latencyMs: Date.now() - startedAt,
      errorCode: error.code || 'AI_IMPORT_MAPPING_FAILED',
      errorMessage: error.message,
    });
    throw error;
  }
}

module.exports = {
  suggestImportColumnMapping,
  parseMappingSuggestions,
  normalizeHeaders,
  normalizeFields,
};
