'use strict';

const People = require('../../models/People');
const Organization = require('../../models/Organization');
const { getLlmAdapter } = require('./providerRegistry');
const { resolveAiRequestConfig } = require('./aiSettingsResolver');
const { assertCreditsAvailable, debitCredits } = require('./aiCreditService');
const { writeAiAuditLog } = require('./aiAuditLogService');
const { redactMessages, redactText } = require('./piiRedaction');
const { getPrompt } = require('./prompts/promptRegistry');
const { AiConfigurationError } = require('./errors');

function parsePatchesJson(text) {
  const raw = String(text || '').trim();
  const fenced = raw.match(/\{[\s\S]*\}/);
  if (!fenced) return [];
  try {
    const parsed = JSON.parse(fenced[0]);
    const patches = Array.isArray(parsed?.patches) ? parsed.patches : [];
    return patches
      .filter((p) => p && typeof p.fieldKey === 'string' && p.fieldKey.trim())
      .slice(0, 20)
      .map((p) => ({
        fieldKey: String(p.fieldKey).trim(),
        value: p.value == null ? '' : String(p.value),
        confidence: Math.max(0, Math.min(1, Number(p.confidence) || 0)),
        rationale: String(p.rationale || '').slice(0, 240),
      }));
  } catch {
    return [];
  }
}

async function extractFields({
  organizationId,
  userId,
  moduleKey = 'people',
  recordId = null,
  text,
}) {
  const startedAt = Date.now();
  const sourceText = String(text || '').trim();
  if (!sourceText) {
    throw new AiConfigurationError('text is required', 'AI_TEXT_REQUIRED');
  }

  let auditBase = {
    organizationId,
    userId,
    abilityKey: 'extract_fields',
    provider: 'unknown',
    model: 'unknown',
    keyMode: 'platform',
  };

  try {
    const config = await resolveAiRequestConfig({ organizationId, abilityKey: 'extract_fields' });
    auditBase = {
      ...auditBase,
      provider: config.provider,
      model: config.model,
      keyMode: config.keyMode,
    };
    assertCreditsAvailable({ keyMode: config.keyMode, creditsBalance: config.creditsBalance });

    const systemPrompt = getPrompt('extract_fields_system');
    const adapter = getLlmAdapter(config.provider);
    const completion = await adapter.complete({
      apiKey: config.apiKey,
      model: config.model,
      messages: redactMessages([
        { role: 'system', content: systemPrompt.text },
        {
          role: 'user',
          content: `Module: ${moduleKey}\nRecordId: ${recordId || '(new)'}\n\nText:\n${redactText(sourceText).slice(0, 5000)}`,
        },
      ]),
      temperature: 0.1,
      maxTokens: 600,
      providerOptions: config.providerOptions,
    });

    const patches = parsePatchesJson(completion.text);
    const creditsDebited = await debitCredits({
      organizationId,
      keyMode: config.keyMode,
      usage: completion.usage,
    });

    await writeAiAuditLog({
      ...auditBase,
      status: 'success',
      promptVersion: systemPrompt.version,
      contextRefs: recordId
        ? [{ sourceType: moduleKey, sourceId: String(recordId), moduleKey }]
        : [],
      usage: completion.usage,
      creditsDebited,
      latencyMs: Date.now() - startedAt,
    });

    return {
      patches,
      rawText: String(completion.text || '').trim(),
      provider: config.provider,
      model: config.model,
      keyMode: config.keyMode,
      creditsDebited,
      usage: completion.usage,
      confirmRequired: true,
    };
  } catch (error) {
    await writeAiAuditLog({
      ...auditBase,
      status: 'failed',
      latencyMs: Date.now() - startedAt,
      errorCode: error.code || 'AI_EXTRACT_FAILED',
      errorMessage: error.message,
    });
    throw error;
  }
}

async function suggestPeopleDuplicates({ organizationId, userId, peopleId }) {
  const startedAt = Date.now();
  let auditBase = {
    organizationId,
    userId,
    abilityKey: 'duplicate_suggest',
    provider: 'unknown',
    model: 'unknown',
    keyMode: 'platform',
  };

  try {
    const person = await People.findOne({
      _id: peopleId,
      organizationId,
      deletedAt: null,
    }).lean();
    if (!person) {
      throw new AiConfigurationError('Person not found', 'AI_PEOPLE_NOT_FOUND');
    }

    const email = String(person.email || '').trim().toLowerCase();
    const candidates = [];
    if (email) {
      const emailMatches = await People.find({
        organizationId,
        deletedAt: null,
        _id: { $ne: person._id },
        email,
      })
        .select('_id firstName lastName email phone company')
        .limit(10)
        .lean();
      candidates.push(...emailMatches.map((row) => ({
        peopleId: String(row._id),
        matchReason: 'email',
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        phone: row.phone,
      })));
    }

    const config = await resolveAiRequestConfig({ organizationId, abilityKey: 'duplicate_suggest' });
    auditBase = {
      ...auditBase,
      provider: config.provider,
      model: config.model,
      keyMode: config.keyMode,
    };
    assertCreditsAvailable({ keyMode: config.keyMode, creditsBalance: config.creditsBalance });

    const systemPrompt = getPrompt('duplicate_suggest_system');
    const adapter = getLlmAdapter(config.provider);
    const completion = await adapter.complete({
      apiKey: config.apiKey,
      model: config.model,
      messages: redactMessages([
        { role: 'system', content: systemPrompt.text },
        {
          role: 'user',
          content: `Candidate:\n${redactText(JSON.stringify({
            id: String(person._id),
            firstName: person.firstName,
            lastName: person.lastName,
            email: person.email,
            phone: person.phone,
          }, null, 2))}\n\nPossible matches:\n${redactText(JSON.stringify(candidates, null, 2))}`,
        },
      ]),
      temperature: 0.2,
      maxTokens: 500,
      providerOptions: config.providerOptions,
    });

    const creditsDebited = await debitCredits({
      organizationId,
      keyMode: config.keyMode,
      usage: completion.usage,
    });

    await writeAiAuditLog({
      ...auditBase,
      status: 'success',
      promptVersion: systemPrompt.version,
      contextRefs: [
        { sourceType: 'people', sourceId: String(peopleId), moduleKey: 'people' },
        ...candidates.map((c) => ({
          sourceType: 'people',
          sourceId: c.peopleId,
          moduleKey: 'people',
        })),
      ],
      usage: completion.usage,
      creditsDebited,
      latencyMs: Date.now() - startedAt,
    });

    return {
      text: String(completion.text || '').trim(),
      candidates,
      mergeSupported: false,
      confirmRequired: true,
      provider: config.provider,
      model: config.model,
      keyMode: config.keyMode,
      creditsDebited,
      usage: completion.usage,
      peopleId: String(peopleId),
    };
  } catch (error) {
    await writeAiAuditLog({
      ...auditBase,
      status: 'failed',
      latencyMs: Date.now() - startedAt,
      errorCode: error.code || 'AI_DUPLICATE_SUGGEST_FAILED',
      errorMessage: error.message,
    });
    throw error;
  }
}

async function suggestOrganizationDuplicates({ organizationId, userId, organizationRefId }) {
  const startedAt = Date.now();
  let auditBase = {
    organizationId,
    userId,
    abilityKey: 'duplicate_suggest',
    provider: 'unknown',
    model: 'unknown',
    keyMode: 'platform',
  };

  try {
    const org = await Organization.findOne({
      _id: organizationRefId,
      organizationId,
      deletedAt: null,
    }).lean();
    if (!org) {
      throw new AiConfigurationError('Organization not found', 'AI_ORG_NOT_FOUND');
    }

    const name = String(org.name || '').trim();
    const candidates = [];
    if (name) {
      const nameMatches = await Organization.find({
        organizationId,
        deletedAt: null,
        _id: { $ne: org._id },
        name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      })
        .select('_id name website domain')
        .limit(10)
        .lean();
      candidates.push(...nameMatches.map((row) => ({
        organizationRefId: String(row._id),
        matchReason: 'name',
        name: row.name,
        website: row.website,
        domain: row.domain,
      })));
    }

    const config = await resolveAiRequestConfig({ organizationId, abilityKey: 'duplicate_suggest' });
    auditBase = {
      ...auditBase,
      provider: config.provider,
      model: config.model,
      keyMode: config.keyMode,
    };
    assertCreditsAvailable({ keyMode: config.keyMode, creditsBalance: config.creditsBalance });

    const systemPrompt = getPrompt('duplicate_suggest_system');
    const adapter = getLlmAdapter(config.provider);
    const completion = await adapter.complete({
      apiKey: config.apiKey,
      model: config.model,
      messages: redactMessages([
        { role: 'system', content: systemPrompt.text },
        {
          role: 'user',
          content: `Organization:\n${redactText(JSON.stringify({
            id: String(org._id),
            name: org.name,
            website: org.website,
            domain: org.domain,
          }, null, 2))}\n\nPossible matches:\n${redactText(JSON.stringify(candidates, null, 2))}`,
        },
      ]),
      temperature: 0.2,
      maxTokens: 500,
      providerOptions: config.providerOptions,
    });

    const creditsDebited = await debitCredits({
      organizationId,
      keyMode: config.keyMode,
      usage: completion.usage,
    });

    await writeAiAuditLog({
      ...auditBase,
      status: 'success',
      promptVersion: systemPrompt.version,
      contextRefs: [
        { sourceType: 'organizations', sourceId: String(organizationRefId), moduleKey: 'organizations' },
      ],
      usage: completion.usage,
      creditsDebited,
      latencyMs: Date.now() - startedAt,
    });

    return {
      text: String(completion.text || '').trim(),
      candidates,
      mergeSupported: false,
      confirmRequired: true,
      provider: config.provider,
      model: config.model,
      keyMode: config.keyMode,
      creditsDebited,
      usage: completion.usage,
      organizationRefId: String(organizationRefId),
    };
  } catch (error) {
    await writeAiAuditLog({
      ...auditBase,
      status: 'failed',
      latencyMs: Date.now() - startedAt,
      errorCode: error.code || 'AI_DUPLICATE_SUGGEST_FAILED',
      errorMessage: error.message,
    });
    throw error;
  }
}

module.exports = {
  extractFields,
  suggestPeopleDuplicates,
  suggestOrganizationDuplicates,
  parsePatchesJson,
};
