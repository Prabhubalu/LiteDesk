'use strict';

const { getLlmAdapter } = require('../../providerRegistry');
const { redactMessages } = require('../../piiRedaction');
const { getPrompt } = require('../../prompts/promptRegistry');
const { parseJsonObject } = require('../../aiMarketingService');

function fallbackReasoning(contextPack) {
  const missing = contextPack?.missingInformation || [];
  const hasEvidence = (contextPack?.citations?.length || 0) > 0
    || /LIVE PRODUCT CATALOG/i.test(String(contextPack?.contextText || ''));
  if (!hasEvidence) {
    return {
      summary: 'I do not have enough grounded product or CRM evidence to answer accurately.',
      keyFindings: ['No retrieved catalog, documentation, or CRM evidence was available for this ask.'],
      evidence: [],
      recommendations: ['Retry after knowledge articles are published, or ask about a specific app/module name.'],
      nextSteps: [],
      risks: ['Answering without evidence would risk inventing product behavior.'],
      missingInformation: missing.length ? missing : ['ProductCatalog', 'ProductDocumentation'],
      unsupportedClaims: [],
      actions: [],
    };
  }
  const findings = [];
  if (contextPack?.citations?.length) {
    findings.push(`Retrieved ${contextPack.citations.length} evidence item(s) from CRM/product catalog/knowledge.`);
  }
  const requiredHits = (contextPack?.citations || []).filter((c) => c.sourceType === 'product_field_required');
  if (requiredHits.length) {
    findings.push(
      `Required fields from catalog: ${requiredHits.slice(0, 8).map((c) => c.excerpt || c.sourceId).join('; ')}`,
    );
  }
  const ctx = String(contextPack?.contextText || '');
  if (/REQUIRED FIELDS/i.test(ctx) && !requiredHits.length) {
    const reqLines = ctx.split('\n').filter((l) => /\brequired\b/i.test(l)).slice(0, 8);
    if (reqLines.length) findings.push(...reqLines.map((l) => l.replace(/^-\s*/, '').trim()));
  }
  return {
    summary: findings[0] || 'Grounded evidence retrieved.',
    keyFindings: findings.length ? findings : ['Evidence retrieved — see catalog/excerpts.'],
    evidence: (contextPack?.citations || []).slice(0, 6).map((c) => `[${c.index}] ${c.excerpt || `${c.sourceType}:${c.sourceId}`}`),
    recommendations: missing.length
      ? ['Gather the missing information before drawing conclusions.']
      : ['Use the live catalog and citations as the source of truth.'],
    nextSteps: requiredHits.length
      ? ['Fill required fields listed above before converting or saving the record.']
      : [],
    risks: missing.length ? [`Missing: ${missing.join(', ')}`] : [],
    missingInformation: missing,
    unsupportedClaims: [],
    actions: [],
  };
}

/**
 * Grounded reasoning over ContextPack. Never invents CRM/docs facts.
 */
async function runReasoning({
  contextPack,
  config,
  redactOpts = {},
} = {}) {
  if (!config?.apiKey || !config?.provider || !config?.model) {
    return fallbackReasoning(contextPack);
  }

  try {
    const adapter = getLlmAdapter(config.provider);
    if (!adapter?.complete) return fallbackReasoning(contextPack);

    const prompt = getPrompt('astra_reason_v1');
    const system = prompt.text || [
      'You are Astra Reasoning Engine for a CRM.',
      'Use ONLY the provided evidence. Never invent accounts, deals, tickets, or documentation.',
      'Distinguish facts (from evidence) vs inferences (label clearly).',
      'If information is missing, list it in missingInformation.',
      'Respond with JSON only.',
    ].join(' ');

    const completion = await adapter.complete({
      apiKey: config.apiKey,
      model: config.model,
      messages: redactMessages([
        { role: 'system', content: system },
        {
          role: 'user',
          content: [
            contextPack.contextText,
            '',
            'Return JSON:',
            '{"summary":"string","keyFindings":["string"],"evidence":["string"],"recommendations":["string"],"nextSteps":["string"],"risks":["string"],"missingInformation":["string"],"unsupportedClaims":["string"],"actions":[{"label":"string","kind":"review_record|follow_up|manual|talk_to_agent","moduleKey":"string","recordId":"string","priority":"high|medium|low","rationale":"string"}]}',
          ].join('\n'),
        },
      ], redactOpts),
      temperature: 0,
      maxTokens: 1200,
      providerOptions: config.providerOptions,
    });

    const parsed = parseJsonObject(String(completion?.text || completion?.content || ''));
    if (!parsed || typeof parsed !== 'object') {
      return { ...fallbackReasoning(contextPack), usage: completion?.usage };
    }

    const asList = (v) => (Array.isArray(v) ? v.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 10) : []);

    return {
      summary: String(parsed.summary || '').trim().slice(0, 400),
      keyFindings: asList(parsed.keyFindings),
      evidence: asList(parsed.evidence),
      recommendations: asList(parsed.recommendations),
      nextSteps: asList(parsed.nextSteps),
      risks: asList(parsed.risks),
      missingInformation: [
        ...new Set([
          ...asList(parsed.missingInformation),
          ...(contextPack.missingInformation || []),
        ]),
      ].slice(0, 12),
      unsupportedClaims: asList(parsed.unsupportedClaims),
      actions: Array.isArray(parsed.actions) ? parsed.actions.slice(0, 3) : [],
      usage: completion?.usage,
    };
  } catch {
    return fallbackReasoning(contextPack);
  }
}

module.exports = {
  runReasoning,
  fallbackReasoning,
};
