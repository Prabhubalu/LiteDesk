'use strict';

const {
  sanitizeGeneratedProcess,
  buildTriggerFromCore,
  SAFE_ACTION_TYPES,
} = require('../aiProcessDesignerService');

describe('aiProcessDesignerService', () => {
  test('buildTriggerFromCore maps record_created', () => {
    const trigger = buildTriggerFromCore('record_created', 'deal');
    expect(trigger).toEqual({
      type: 'domain_event',
      eventType: 'deal.created',
      includeCreated: false,
      updateWatch: { mode: 'any', fields: [] },
    });
  });

  test('sanitizeGeneratedProcess builds valid draft graph with condition branches', () => {
    const result = sanitizeGeneratedProcess(
      {
        name: 'Deal proposal follow-up',
        description: 'Follow up when deal enters proposal',
        nodes: [
          { id: 't1', type: 'trigger', config: {} },
          {
            id: 'c1',
            type: 'condition',
            config: {
              condition: {
                field: 'event.currentState.stage',
                operator: 'equals',
                value: 'proposal',
              },
            },
          },
          {
            id: 'a1',
            type: 'action',
            config: {
              actionType: 'create_task',
              params: { title: 'Follow up', assignee: 'owner', dueInDays: 2 },
            },
          },
          { id: 'e1', type: 'end', config: {} },
        ],
        edges: [
          { id: 'x1', fromNodeId: 't1', toNodeId: 'c1' },
          { id: 'x2', fromNodeId: 'c1', toNodeId: 'a1', condition: true },
          { id: 'x3', fromNodeId: 'a1', toNodeId: 'e1' },
        ],
      },
      {
        appKey: 'SALES',
        entityType: 'deal',
        coreTrigger: 'record_updated',
        updateWatchField: 'stage',
      },
    );

    expect(result.valid).toBe(true);
    expect(result.definition.status).toBe('draft');
    expect(result.definition.appKey).toBe('SALES');
    expect(result.definition.entityType).toBe('deal');
    expect(result.definition.trigger.eventType).toBe('deal.updated');
    expect(result.definition.nodes.some((n) => n.type === 'trigger')).toBe(true);
    expect(result.definition.nodes.some((n) => n.type === 'end')).toBe(true);

    const condition = result.definition.nodes.find((n) => n.type === 'condition');
    expect(condition.config.conditionGroup).toBeTruthy();
    expect(condition.config.conditionGroup.andBlock.conditions[0].field).toMatch(/event\.currentState\./);
    expect(condition.config.conditionGroup.andBlock.conditions[0].value).toBe('proposal');

    const action = result.definition.nodes.find((n) => n.type === 'action');
    expect(action.config.params.title).toBeTruthy();
    expect(action.config.params.description).toBeTruthy();
    expect(action.config.params.assignee).toBe('owner');
    expect(action.config.params.dueInDays).toBe(2);

    const out = result.definition.edges.filter((e) => e.fromNodeId === condition.id);
    expect(out.some((e) => e.condition === true)).toBe(true);
    expect(out.some((e) => e.condition === false)).toBe(true);
  });

  test('sanitizeActionConfig fills send_email draft when no template', () => {
    const { sanitizeActionConfig } = require('../aiProcessDesignerService');
    const config = sanitizeActionConfig(
      { actionType: 'send_email', params: { to: 'owner' } },
      { name: 'Won deal alert', brief: 'Email owner when deal is won', entityType: 'deal' },
    );
    expect(config.params.bodyMode).toBe('custom');
    expect(config.params.subject).toBeTruthy();
    expect(config.params.body).toMatch(/Won deal alert|automated/i);
    expect(config.params.to).toBe('owner');
  });

  test('sanitizeGeneratedProcess rejects delete_record and adds safe default action', () => {
    const result = sanitizeGeneratedProcess(
      {
        name: 'Unsafe',
        nodes: [
          {
            id: 'a1',
            type: 'action',
            config: { actionType: 'delete_record', params: { target: 'current' } },
          },
        ],
        edges: [],
      },
      {
        appKey: 'SALES',
        entityType: 'people',
        coreTrigger: 'record_created',
      },
    );

    expect(result.valid).toBe(true);
    const actions = result.definition.nodes.filter((n) => n.type === 'action');
    expect(actions).toHaveLength(1);
    expect(actions[0].config.actionType).toBe('create_task');
    expect(SAFE_ACTION_TYPES.has('delete_record')).toBe(false);
  });

  test('sanitizeGeneratedProcess requires app and module', () => {
    expect(() => sanitizeGeneratedProcess({ name: 'x' }, {})).toThrow(/appKey/i);
  });
});
