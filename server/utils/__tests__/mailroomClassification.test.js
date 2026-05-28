const { describe, it } = require('node:test');
const assert = require('node:assert');
const { buildNormalizedMessage } = require('../../platform/mailroom/domain/normalizedMessage');
const { evaluate, evaluatePipeline } = require('../../platform/mailroom/policies/policyEngine');
const {
  mergeClassificationDefaults,
  resolveIngestActionForSpam
} = require('../../platform/mailroom/policies/strategies/classificationStrategies');
const { resolveMailroomIngestActionType } = require('../../platform/mailroom/pipeline/ingestActionResolver');
const { resolveCaseExecutionPlan } = require('../../platform/mailroom/adapters/casesAdapter');

describe('mailroom classification', () => {
  it('matches urgent subject and suggests High priority', () => {
    const message = buildNormalizedMessage({
      channel: 'email',
      subject: 'URGENT: billing issue',
      participants: { from: { address: 'a@example.com' } }
    });
    const result = evaluate('classification', {
      message,
      policies: {
        classification: {
          rules: [
            {
              id: 'urgent',
              field: 'subject',
              operator: 'contains',
              value: 'urgent',
              suggestPriority: 'High'
            }
          ],
          applyMode: 'auto_apply'
        }
      }
    });
    assert.equal(result.matched, true);
    assert.equal(result.suggestions.priority, 'High');
  });

  it('auto_apply merges into case link defaults', () => {
    const classification = {
      matched: true,
      suggestions: { caseType: 'Billing', priority: 'High', queue: 'tier2', spam: false },
      applyMode: 'auto_apply'
    };
    const merged = mergeClassificationDefaults(
      { caseType: 'Support Ticket', priority: 'Medium', channel: 'Email' },
      classification,
      { applyMode: 'auto_apply' }
    );
    assert.equal(merged.defaultCaseType, 'Billing');
    assert.equal(merged.defaultPriority, 'High');
    assert.equal(merged.defaultQueue, 'tier2');
  });

  it('spam with onSpam ignore resolves ingest to ignore', () => {
    const classification = {
      suggestions: { spam: true },
      onSpam: 'ignore'
    };
    const ingest = { action: { type: 'route_to_case_flow' } };
    assert.equal(resolveIngestActionForSpam(classification, { onSpam: 'ignore' }), 'ignore');
    assert.equal(resolveMailroomIngestActionType(ingest, classification, { onSpam: 'ignore' }), 'ignore');
  });

  it('evaluatePipeline applies classification to case_link defaults on create', () => {
    const message = buildNormalizedMessage({
      channel: 'email',
      subject: 'URGENT help',
      participants: { from: { address: 'user@test.com' } }
    });
    const policies = {
      threading: { strategies: [{ id: 's1', signal: 'message_id', enabled: false }], fallback: { action: 'no_match' } },
      ingest: { rules: [], defaultAction: { type: 'route_to_case_flow' } },
      dedup: { onDuplicate: 'append_to_existing_open_case', onNoDuplicate: 'continue', signals: [] },
      caseLink: {
        onOpenCaseMatch: { action: 'append' },
        onNoMatch: { action: 'create_case' },
        onResolvedWithinDays: { enabled: false },
        defaults: { caseType: 'Support Ticket', priority: 'Medium', channel: 'Email' }
      },
      classification: {
        rules: [
          {
            field: 'subject',
            operator: 'contains',
            value: 'urgent',
            suggestPriority: 'High'
          }
        ],
        applyMode: 'auto_apply'
      },
      dispatch: { publish: [] }
    };
    const pipeline = evaluatePipeline({
      message,
      candidates: { openCases: [], resolvedCases: [], conversations: [], messages: [] },
      policies
    });
    assert.equal(pipeline.caseLink.defaults.defaultPriority, 'High');

    const plan = resolveCaseExecutionPlan(pipeline);
    assert.equal(plan.defaults.defaultPriority, 'High');
  });
});
