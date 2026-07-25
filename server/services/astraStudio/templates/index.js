'use strict';

const crypto = require('crypto');

function id() {
  return crypto.randomBytes(8).toString('hex');
}

function section(title, x, y) {
  return {
    id: `sec_${id()}`,
    title,
    x,
    y,
  };
}

function widget(type, frame, config = {}, extras = {}) {
  return {
    id: `w_${id()}`,
    type,
    frame: {
      x: frame.x,
      y: frame.y,
      w: frame.w ?? 320,
      h: frame.h ?? 200,
      z: frame.z ?? 1,
    },
    config: { title: config.title || type, ...config },
    collapsed: false,
    ...extras,
  };
}

/**
 * Build generate ops for a canvas type.
 * @returns {{ sections: object[], ops: object[], titleHint: string }}
 */
function buildTemplateOps(canvasType, { title, focus = [] } = {}) {
  const builders = {
    meeting_preparation: buildMeetingPrep,
    opportunity_war_room: buildWarRoom,
    customer_360: buildCustomer360,
    executive_report: buildExecutiveReport,
    account_planning: buildAccountPlanning,
    quarterly_business_review: buildQbr,
    customer_success_plan: buildCsPlan,
    renewal_workspace: buildRenewal,
    support_investigation: buildSupport,
    project_workspace: buildProject,
    workflow_design: buildWorkflowDesign,
    brainstorming: buildBrainstorm,
    strategy_workspace: buildStrategy,
    blank: buildBlank,
  };
  const fn = builders[canvasType] || buildBlank;
  return fn({ title, focus });
}

function layoutRow(widgetsSpec, startY, gap = 24) {
  let x = 40;
  const ops = [];
  const widgets = [];
  for (const spec of widgetsSpec) {
    const w = widget(spec.type, { x, y: startY, w: spec.w || 300, h: spec.h || 180 }, spec.config || {}, {
      bindings: spec.bindings,
      ai: spec.ai,
      sectionId: spec.sectionId,
    });
    widgets.push(w);
    ops.push({ op: 'addWidget', widget: w });
    x += (spec.w || 300) + gap;
  }
  return { ops, widgets };
}

function withSection(title, x, y, widgetSpecs) {
  const sec = section(title, x, y);
  const ops = [{ op: 'addSection', section: sec }];
  const row = layoutRow(
    widgetSpecs.map((s) => ({ ...s, sectionId: sec.id })),
    y + 48
  );
  ops.push(...row.ops);
  return { section: sec, ops };
}

function focusBinding(focus, moduleKey) {
  const hit = (focus || []).find((f) => f.moduleKey === moduleKey);
  if (!hit) return undefined;
  const recordId = String(hit.recordId);
  return { moduleKey, recordId, recordIds: [recordId] };
}

function buildMeetingPrep({ title, focus }) {
  const blocks = [];
  blocks.push(
    withSection('Agenda & overview', 40, 40, [
      { type: 'ai.summary', w: 360, h: 220, config: { title: 'Meeting agenda' }, ai: { confidence: 0.7 } },
      {
        type: 'crm.organization',
        w: 280,
        h: 220,
        config: { title: 'Customer overview' },
        bindings:
          focusBinding(focus, 'organizations')
          || focusBinding(focus, 'organization')
          || focusBinding(focus, 'people')
          || focusBinding(focus, 'person'),
      },
      { type: 'ai.insights', w: 300, h: 220, config: { title: 'Stakeholders' } },
    ])
  );
  blocks.push(
    withSection('History', 40, 320, [
      { type: 'comms.conversation_timeline', w: 400, h: 240, config: { title: 'Email & call history' } },
      { type: 'viz.timeline', w: 360, h: 240, config: { title: 'Previous meetings' } },
      {
        type: 'crm.deal',
        w: 280,
        h: 240,
        config: { title: 'Active deals' },
        bindings: focusBinding(focus, 'deals'),
      },
    ])
  );
  blocks.push(
    withSection('Risks & prep', 40, 620, [
      { type: 'ai.risk', w: 320, h: 200, config: { title: 'Risks' } },
      { type: 'ai.recommendations', w: 320, h: 200, config: { title: 'Talking points' } },
      { type: 'content.checklist', w: 280, h: 200, config: { title: 'Suggested questions', items: [] } },
      { type: 'comms.meeting_notes', w: 360, h: 200, config: { title: 'Live notes' } },
    ])
  );
  return {
    titleHint: title || 'Meeting preparation',
    sections: blocks.map((b) => b.section),
    ops: blocks.flatMap((b) => b.ops),
  };
}

function buildWarRoom({ title, focus }) {
  const blocks = [];
  blocks.push(
    withSection('Deal health', 40, 40, [
      {
        type: 'crm.deal',
        w: 320,
        h: 220,
        config: { title: 'Deal' },
        bindings: focusBinding(focus, 'deals'),
      },
      { type: 'ai.risk', w: 300, h: 220, config: { title: 'Risks & objections' } },
      { type: 'ai.insights', w: 300, h: 220, config: { title: 'Buying signals' } },
      { type: 'analytics.kpi', w: 240, h: 220, config: { title: 'Relationship score' } },
    ])
  );
  blocks.push(
    withSection('Strategy', 40, 340, [
      { type: 'viz.relationship_graph', w: 400, h: 280, config: { title: 'Stakeholder map' } },
      { type: 'content.table', w: 360, h: 280, config: { title: 'Competitor matrix' } },
      { type: 'ai.recommendations', w: 320, h: 280, config: { title: 'Win strategy' } },
      { type: 'content.checklist', w: 280, h: 280, config: { title: 'Open tasks', items: [] } },
    ])
  );
  return {
    titleHint: title || 'Opportunity war room',
    sections: blocks.map((b) => b.section),
    ops: blocks.flatMap((b) => b.ops),
  };
}

function buildCustomer360({ title, focus }) {
  const blocks = [];
  blocks.push(
    withSection('Profile', 40, 40, [
      {
        type: 'crm.organization',
        w: 320,
        h: 240,
        config: { title: 'Customer profile' },
        bindings: focusBinding(focus, 'organizations'),
      },
      { type: 'crm.contact', w: 300, h: 240, config: { title: 'Contacts' } },
      { type: 'analytics.kpi', w: 240, h: 240, config: { title: 'Revenue' } },
      { type: 'ai.insights', w: 300, h: 240, config: { title: 'Customer health' } },
    ])
  );
  blocks.push(
    withSection('Activity', 40, 360, [
      { type: 'comms.conversation_timeline', w: 420, h: 260, config: { title: 'Communication timeline' } },
      { type: 'crm.case', w: 280, h: 260, config: { title: 'Cases' } },
      { type: 'crm.deal', w: 280, h: 260, config: { title: 'Opportunities' } },
      { type: 'ai.summary', w: 300, h: 260, config: { title: 'AI insights' } },
    ])
  );
  return {
    titleHint: title || 'Customer 360',
    sections: blocks.map((b) => b.section),
    ops: blocks.flatMap((b) => b.ops),
  };
}

function buildExecutiveReport({ title }) {
  const blocks = [
    withSection('Executive summary', 40, 40, [
      { type: 'ai.summary', w: 480, h: 220, config: { title: 'Executive summary' } },
      { type: 'analytics.kpi', w: 220, h: 220, config: { title: 'Revenue' } },
      { type: 'analytics.kpi', w: 220, h: 220, config: { title: 'Pipeline' } },
      { type: 'analytics.forecast', w: 260, h: 220, config: { title: 'Forecast' } },
    ]),
    withSection('Trends', 40, 340, [
      { type: 'analytics.chart', w: 400, h: 280, config: { title: 'Trends' } },
      { type: 'analytics.funnel', w: 360, h: 280, config: { title: 'Funnel' } },
      { type: 'ai.risk', w: 300, h: 280, config: { title: 'Risks' } },
      { type: 'ai.recommendations', w: 300, h: 280, config: { title: 'Recommendations' } },
    ]),
  ];
  return {
    titleHint: title || 'Executive report',
    sections: blocks.map((b) => b.section),
    ops: blocks.flatMap((b) => b.ops),
  };
}

function buildAccountPlanning({ title, focus }) {
  const blocks = [
    withSection('Account', 40, 40, [
      {
        type: 'crm.organization',
        w: 320,
        h: 220,
        config: { title: 'Business overview' },
        bindings: focusBinding(focus, 'organizations'),
      },
      { type: 'ai.insights', w: 320, h: 220, config: { title: 'Current footprint' } },
      { type: 'ai.recommendations', w: 320, h: 220, config: { title: 'Expansion opportunities' } },
    ]),
    withSection('Plan', 40, 340, [
      { type: 'viz.relationship_graph', w: 360, h: 260, config: { title: 'Decision makers' } },
      { type: 'ai.risk', w: 280, h: 260, config: { title: 'Risks' } },
      { type: 'content.checklist', w: 300, h: 260, config: { title: 'Action plan', items: [] } },
      { type: 'content.rich_text', w: 320, h: 260, config: { title: 'Success plan' } },
    ]),
  ];
  return {
    titleHint: title || 'Account plan',
    sections: blocks.map((b) => b.section),
    ops: blocks.flatMap((b) => b.ops),
  };
}

function buildQbr({ title }) {
  const blocks = [
    withSection('QBR', 40, 40, [
      { type: 'ai.summary', w: 400, h: 220, config: { title: 'Executive summary' } },
      { type: 'analytics.kpi', w: 220, h: 220, config: { title: 'Revenue' } },
      { type: 'ai.insights', w: 300, h: 220, config: { title: 'Achievements' } },
      { type: 'crm.case', w: 260, h: 220, config: { title: 'Open issues' } },
    ]),
    withSection('Forward look', 40, 340, [
      { type: 'analytics.chart', w: 360, h: 240, config: { title: 'Product adoption' } },
      { type: 'viz.timeline', w: 360, h: 240, config: { title: 'Roadmap' } },
      { type: 'content.checklist', w: 280, h: 240, config: { title: 'Action items', items: [] } },
    ]),
  ];
  return {
    titleHint: title || 'Quarterly business review',
    sections: blocks.map((b) => b.section),
    ops: blocks.flatMap((b) => b.ops),
  };
}

function buildCsPlan({ title }) {
  const blocks = [
    withSection('Success plan', 40, 40, [
      { type: 'content.rich_text', w: 360, h: 220, config: { title: 'Success goals' } },
      { type: 'analytics.kpi', w: 220, h: 220, config: { title: 'Adoption metrics' } },
      { type: 'analytics.kpi', w: 220, h: 220, config: { title: 'Health score' } },
      { type: 'ai.risk', w: 280, h: 220, config: { title: 'Risks' } },
    ]),
    withSection('Execution', 40, 340, [
      { type: 'viz.timeline', w: 400, h: 240, config: { title: 'Milestones' } },
      { type: 'crm.task', w: 300, h: 240, config: { title: 'Tasks' } },
    ]),
  ];
  return {
    titleHint: title || 'Customer success plan',
    sections: blocks.map((b) => b.section),
    ops: blocks.flatMap((b) => b.ops),
  };
}

function buildRenewal({ title, focus }) {
  const blocks = [
    withSection('Renewal', 40, 40, [
      {
        type: 'crm.organization',
        w: 300,
        h: 220,
        config: { title: 'Account' },
        bindings: focusBinding(focus, 'organizations'),
      },
      { type: 'content.rich_text', w: 280, h: 220, config: { title: 'Contract & renewal date' } },
      { type: 'analytics.kpi', w: 220, h: 220, config: { title: 'Usage' } },
      { type: 'ai.insights', w: 260, h: 220, config: { title: 'Health' } },
    ]),
    withSection('Strategy', 40, 340, [
      { type: 'crm.case', w: 280, h: 240, config: { title: 'Open issues' } },
      { type: 'ai.risk', w: 280, h: 240, config: { title: 'Risks' } },
      { type: 'ai.recommendations', w: 320, h: 240, config: { title: 'Renewal strategy' } },
    ]),
  ];
  return {
    titleHint: title || 'Renewal workspace',
    sections: blocks.map((b) => b.section),
    ops: blocks.flatMap((b) => b.ops),
  };
}

function buildSupport({ title, focus }) {
  const blocks = [
    withSection('Investigation', 40, 40, [
      {
        type: 'crm.case',
        w: 320,
        h: 220,
        config: { title: 'Case' },
        bindings: focusBinding(focus, 'cases'),
      },
      { type: 'viz.timeline', w: 360, h: 220, config: { title: 'Timeline' } },
      { type: 'comms.conversation_timeline', w: 360, h: 220, config: { title: 'Emails & calls' } },
    ]),
    withSection('Resolution', 40, 340, [
      { type: 'ai.summary', w: 360, h: 240, config: { title: 'Root cause' } },
      { type: 'content.rich_text', w: 360, h: 240, config: { title: 'Resolution plan' } },
      { type: 'ai.recommendations', w: 300, h: 240, config: { title: 'Next steps' } },
    ]),
  ];
  return {
    titleHint: title || 'Support investigation',
    sections: blocks.map((b) => b.section),
    ops: blocks.flatMap((b) => b.ops),
  };
}

function buildProject({ title, focus }) {
  const blocks = [
    withSection('Project', 40, 40, [
      {
        type: 'crm.project',
        w: 300,
        h: 200,
        config: { title: 'Project' },
        bindings: focusBinding(focus, 'projects'),
      },
      { type: 'viz.timeline', w: 400, h: 200, config: { title: 'Milestones' } },
      { type: 'crm.task', w: 280, h: 200, config: { title: 'Tasks' } },
      { type: 'ai.risk', w: 260, h: 200, config: { title: 'Risks' } },
    ]),
    withSection('Delivery', 40, 320, [
      { type: 'viz.kanban', w: 520, h: 280, config: { title: 'Board' } },
      { type: 'content.checklist', w: 300, h: 280, config: { title: 'Deliverables', items: [] } },
      { type: 'ai.summary', w: 300, h: 280, config: { title: 'Status' } },
    ]),
  ];
  return {
    titleHint: title || 'Project workspace',
    sections: blocks.map((b) => b.section),
    ops: blocks.flatMap((b) => b.ops),
  };
}

function buildWorkflowDesign({ title }) {
  const blocks = [
    withSection('Workflow', 40, 40, [
      { type: 'viz.process', w: 720, h: 420, config: { title: 'Process diagram' } },
      { type: 'content.rich_text', w: 320, h: 420, config: { title: 'Description' } },
    ]),
  ];
  return {
    titleHint: title || 'Workflow design',
    sections: blocks.map((b) => b.section),
    ops: blocks.flatMap((b) => b.ops),
  };
}

function buildBrainstorm({ title }) {
  const blocks = [
    withSection('Brainstorm', 40, 40, [
      { type: 'content.sticky', w: 200, h: 160, config: { title: 'Idea', text: '', color: 'yellow' } },
      { type: 'content.sticky', w: 200, h: 160, config: { title: 'Idea', text: '', color: 'blue' } },
      { type: 'content.sticky', w: 200, h: 160, config: { title: 'Idea', text: '', color: 'green' } },
      { type: 'content.table', w: 360, h: 240, config: { title: 'SWOT' } },
      { type: 'viz.mind_map', w: 400, h: 280, config: { title: 'Mind map' } },
    ]),
  ];
  return {
    titleHint: title || 'Brainstorm',
    sections: blocks.map((b) => b.section),
    ops: blocks.flatMap((b) => b.ops),
  };
}

function buildStrategy({ title }) {
  const blocks = [
    withSection('Strategy', 40, 40, [
      { type: 'content.rich_text', w: 360, h: 220, config: { title: 'Goals' } },
      { type: 'analytics.kpi', w: 220, h: 220, config: { title: 'KPIs' } },
      { type: 'ai.risk', w: 280, h: 220, config: { title: 'Challenges & risks' } },
      { type: 'ai.recommendations', w: 320, h: 220, config: { title: 'Recommendations' } },
    ]),
    withSection('Timeline', 40, 340, [
      { type: 'viz.timeline', w: 640, h: 240, config: { title: 'Timeline' } },
      { type: 'content.checklist', w: 300, h: 240, config: { title: 'Alternatives', items: [] } },
    ]),
  ];
  return {
    titleHint: title || 'Strategy workspace',
    sections: blocks.map((b) => b.section),
    ops: blocks.flatMap((b) => b.ops),
  };
}

function buildBlank({ title }) {
  return {
    titleHint: title || 'Untitled canvas',
    sections: [],
    ops: [],
  };
}

const TEMPLATE_META = [
  { key: 'meeting_preparation', labelKey: 'astraStudio.typeMeetingPrep' },
  { key: 'executive_report', labelKey: 'astraStudio.typeExecutiveReport' },
  { key: 'customer_360', labelKey: 'astraStudio.typeCustomer360' },
  { key: 'opportunity_war_room', labelKey: 'astraStudio.typeWarRoom' },
  { key: 'account_planning', labelKey: 'astraStudio.typeAccountPlan' },
  { key: 'quarterly_business_review', labelKey: 'astraStudio.typeQbr' },
  { key: 'customer_success_plan', labelKey: 'astraStudio.typeCsPlan' },
  { key: 'renewal_workspace', labelKey: 'astraStudio.typeRenewal' },
  { key: 'support_investigation', labelKey: 'astraStudio.typeSupport' },
  { key: 'project_workspace', labelKey: 'astraStudio.typeProject' },
  { key: 'workflow_design', labelKey: 'astraStudio.typeWorkflow' },
  { key: 'brainstorming', labelKey: 'astraStudio.typeBrainstorm' },
  { key: 'strategy_workspace', labelKey: 'astraStudio.typeStrategy' },
  { key: 'blank', labelKey: 'astraStudio.typeBlank' },
];

module.exports = {
  buildTemplateOps,
  TEMPLATE_META,
};
