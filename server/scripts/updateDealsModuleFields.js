const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const ModuleDefinition = require('../models/ModuleDefinition');
const Organization = require('../models/Organization');

const COLORS = ['#3B82F6', '#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

function makeOptions(values = []) {
  return values.map((value, index) => ({
    value,
    color: COLORS[index % COLORS.length]
  }));
}

function buildField({
  key,
  label,
  dataType,
  order,
  required = false,
  keyField = false,
  options = [],
  visibility = { list: true, detail: true },
  defaultValue = null,
  numberSettings = null,
  textSettings = null,
  lookupSettings = null,
  placeholder = ''
}) {
  return {
    key,
    label,
    dataType,
    required,
    keyField,
    options,
    defaultValue,
    index: keyField,
    visibility,
    order,
    validations: [],
    dependencies: [],
    numberSettings,
    textSettings,
    lookupSettings,
    placeholder
  };
}

const baseFields = [
  buildField({
    key: 'name',
    label: 'Deal Name',
    dataType: 'Text',
    required: true,
    keyField: true,
    order: 0,
    visibility: { list: true, detail: true },
    textSettings: { maxLength: 255, rows: 1 }
  }),
  buildField({
    key: 'type',
    label: 'Deal Type',
    dataType: 'Picklist',
    order: 1,
    options: makeOptions(['New Business', 'Existing Customer', 'Upsell', 'Renewal', 'Cross-Sell'])
  }),
  buildField({
    key: 'pipeline',
    label: 'Pipeline',
    dataType: 'Picklist',
    order: 2,
    options: makeOptions(['Default Pipeline', 'Enterprise Pipeline', 'SMB Pipeline', 'Channel Pipeline'])
  }),
  buildField({
    key: 'stage',
    label: 'Deal Stage',
    dataType: 'Picklist',
    order: 3,
    required: true,
    options: makeOptions(['Qualification', 'Proposal', 'Negotiation', 'Contract Sent', 'Closed Won', 'Closed Lost'])
  }),
  buildField({
    key: 'ownerId',
    label: 'Deal Owner',
    dataType: 'Lookup (Relationship)',
    required: true,
    order: 4,
    lookupSettings: {
      targetModule: 'users',
      displayField: 'fullName'
    }
  }),
  buildField({
    key: 'accountId',
    label: 'Organization',
    dataType: 'Lookup (Relationship)',
    required: false,
    order: 5,
    lookupSettings: {
      targetModule: 'organizations',
      displayField: 'name'
    }
  }),
  buildField({
    key: 'contactId',
    label: 'Contact',
    dataType: 'Lookup (Relationship)',
    order: 6,
    lookupSettings: {
      targetModule: 'people',
      displayField: 'full_name'
    }
  }),
  buildField({
    key: 'lineItems',
    label: 'Items / Products',
    dataType: 'Rich Text',
    order: 7,
    visibility: { list: false, detail: true },
    textSettings: { rows: 4, maxLength: 4000 },
    placeholder: 'Track associated products or services for this deal'
  }),
  buildField({
    key: 'amount',
    label: 'Expected Value',
    dataType: 'Currency',
    order: 8,
    required: true,
    numberSettings: {
      min: 0,
      max: null,
      decimalPlaces: 2,
      currencySymbol: '$'
    }
  }),
  buildField({
    key: 'probability',
    label: 'Probability (%)',
    dataType: 'Decimal',
    order: 9,
    numberSettings: {
      min: 0,
      max: 100,
      decimalPlaces: 0
    }
  }),
  buildField({
    key: 'expectedCloseDate',
    label: 'Close Date',
    dataType: 'Date',
    order: 10,
    required: true
  }),
  buildField({
    key: 'source',
    label: 'Lead Source',
    dataType: 'Picklist',
    order: 11,
    options: makeOptions(['Cold Call', 'Referral', 'Trade Show', 'Website', 'Email Campaign', 'Social Media', 'Partner', 'Outbound', 'Other'])
  }),
  buildField({
    key: 'nextStep',
    label: 'Next Step',
    dataType: 'Text-Area',
    order: 12,
    textSettings: { rows: 3, maxLength: 500 }
  }),
  buildField({
    key: 'tags',
    label: 'Tags',
    dataType: 'Multi-Picklist',
    order: 13,
    visibility: { list: false, detail: true }
  }),
  buildField({
    key: 'status',
    label: 'Status',
    dataType: 'Picklist',
    order: 14,
    required: true,
    options: makeOptions(['Open', 'Won', 'Lost', 'Stalled'])
  }),
  buildField({
    key: 'description',
    label: 'Notes',
    dataType: 'Rich Text',
    order: 15,
    visibility: { list: false, detail: true },
    textSettings: { rows: 6, maxLength: 4000 }
  }),
  buildField({
    key: 'createdBy',
    label: 'Created By',
    dataType: 'Lookup (Relationship)',
    order: 16,
    visibility: { list: false, detail: true },
    lookupSettings: {
      targetModule: 'users',
      displayField: 'fullName'
    }
  }),
  buildField({
    key: 'createdAt',
    label: 'Created Time',
    dataType: 'Date-Time',
    order: 17,
    visibility: { list: false, detail: true }
  }),
  buildField({
    key: 'modifiedBy',
    label: 'Modified By',
    dataType: 'Lookup (Relationship)',
    order: 18,
    visibility: { list: false, detail: true },
    lookupSettings: {
      targetModule: 'users',
      displayField: 'fullName'
    }
  }),
  buildField({
    key: 'updatedAt',
    label: 'Modified Time',
    dataType: 'Date-Time',
    order: 19,
    visibility: { list: false, detail: true }
  })
];

const quickCreateDefault = ['name', 'type', 'pipeline', 'stage', 'ownerId', 'accountId', 'amount', 'expectedCloseDate', 'probability'];

function slugify(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || `item-${Date.now()}`;
}

const PLAYBOOK_ACTION_TYPES = new Set(['task', 'event', 'alert', 'document', 'call', 'meeting', 'email', 'approval', 'other']);
const PLAYBOOK_TRIGGER_TYPES = new Set(['stage_entry', 'after_action', 'time_delay', 'custom']);
const PLAYBOOK_ALERT_TYPES = new Set(['in_app', 'email', 'sms']);
const PLAYBOOK_RESOURCE_TYPES = new Set(['document', 'link', 'form', 'template', 'other']);
const PLAYBOOK_DELAY_UNITS = new Set(['minutes', 'hours', 'days']);

const DEFAULT_STAGE_PLAYBOOKS = {
  qualification: (stageKey) => ({
    enabled: true,
    mode: 'sequential',
    autoAdvance: false,
    notes: 'Ensure the opportunity is a good fit before investing more time.',
    actions: [
      {
        key: `${stageKey}-research-account`,
        title: 'Research account background',
        description: 'Review company profile, industry insights and existing CRM notes.',
        actionType: 'task',
        dueInDays: 0,
        assignment: { type: 'deal_owner', targetId: null, targetType: '', targetName: '' },
        required: true,
        dependencies: [],
        autoCreate: true,
        trigger: { type: 'stage_entry', conditions: [] },
        alerts: [{ type: 'in_app', offset: { amount: 0, unit: 'hours' }, recipients: [], message: 'Kick off qualification research' }],
        resources: [{ name: 'Account Research Checklist', type: 'document', url: '', description: '' }],
        metadata: {}
      },
      {
        key: `${stageKey}-discovery-call`,
        title: 'Schedule discovery call',
        description: 'Coordinate a call with the prospect to validate goals, pain points, budget and timeline.',
        actionType: 'event',
        dueInDays: 2,
        assignment: { type: 'deal_owner', targetId: null, targetType: '', targetName: '' },
        required: true,
        dependencies: [`${stageKey}-research-account`],
        autoCreate: true,
        trigger: { type: 'after_action', sourceActionKey: `${stageKey}-research-account`, conditions: [] },
        alerts: [{ type: 'email', offset: { amount: 1, unit: 'days' }, recipients: [], message: 'Send discovery invite if not scheduled' }],
        resources: [{ name: 'Discovery Call Script', type: 'document', url: '', description: '' }],
        metadata: {}
      }
    ],
    exitCriteria: {
      type: 'all_actions_completed',
      customDescription: '',
      nextStageKey: '',
      conditions: []
    }
  }),
  proposal: (stageKey) => ({
    enabled: true,
    mode: 'sequential',
    autoAdvance: false,
    notes: 'Tailor the proposal to the agreed requirements and highlight the value proposition.',
    actions: [
      {
        key: `${stageKey}-draft-solution`,
        title: 'Draft solution outline',
        description: 'Align internally on scope, deliverables, pricing and implementation approach.',
        actionType: 'task',
        dueInDays: 1,
        assignment: { type: 'team', targetId: null, targetType: '', targetName: 'Solutions' },
        required: true,
        dependencies: [],
        autoCreate: true,
        trigger: { type: 'stage_entry', conditions: [] },
        alerts: [{ type: 'in_app', offset: { amount: 0, unit: 'hours' }, recipients: [], message: 'Draft solution outline' }],
        resources: [{ name: 'Solution Outline Template', type: 'template', url: '', description: '' }],
        metadata: {}
      },
      {
        key: `${stageKey}-create-proposal`,
        title: 'Create proposal deck',
        description: 'Prepare proposal with executive summary, solution details, pricing and ROI.',
        actionType: 'document',
        dueInDays: 3,
        assignment: { type: 'deal_owner', targetId: null, targetType: '', targetName: '' },
        required: true,
        dependencies: [`${stageKey}-draft-solution`],
        autoCreate: true,
        trigger: { type: 'after_action', sourceActionKey: `${stageKey}-draft-solution`, conditions: [] },
        alerts: [{ type: 'email', offset: { amount: 2, unit: 'days' }, recipients: [], message: 'Follow up if proposal not completed' }],
        resources: [{ name: 'Proposal Template', type: 'template', url: '', description: '' }],
        metadata: {}
      }
    ],
    exitCriteria: {
      type: 'all_actions_completed',
      customDescription: '',
      nextStageKey: '',
      conditions: []
    }
  }),
  negotiation: (stageKey) => ({
    enabled: true,
    mode: 'sequential',
    autoAdvance: false,
    notes: 'Stay aligned with the prospect and internal stakeholders on final terms.',
    actions: [
      {
        key: `${stageKey}-review-feedback`,
        title: 'Review prospect feedback',
        description: 'Document requested changes, identify risk areas and loop in stakeholders as needed.',
        actionType: 'task',
        dueInDays: 1,
        assignment: { type: 'deal_owner', targetId: null, targetType: '', targetName: '' },
        required: true,
        dependencies: [],
        autoCreate: true,
        trigger: { type: 'stage_entry', conditions: [] },
        alerts: [{ type: 'in_app', offset: { amount: 0, unit: 'hours' }, recipients: [], message: 'Review prospect feedback' }],
        resources: [],
        metadata: {}
      },
      {
        key: `${stageKey}-schedule-alignment`,
        title: 'Schedule alignment call',
        description: 'Set up meeting to finalize terms, pricing adjustments and contract language.',
        actionType: 'event',
        dueInDays: 2,
        assignment: { type: 'deal_owner', targetId: null, targetType: '', targetName: '' },
        required: true,
        dependencies: [`${stageKey}-review-feedback`],
        autoCreate: true,
        trigger: { type: 'after_action', sourceActionKey: `${stageKey}-review-feedback`, conditions: [] },
        alerts: [{ type: 'email', offset: { amount: 1, unit: 'days' }, recipients: [], message: 'Confirm alignment call meeting' }],
        resources: [],
        metadata: {}
      }
    ],
    exitCriteria: {
      type: 'all_actions_completed',
      customDescription: '',
      nextStageKey: '',
      conditions: []
    }
  }),
  'contract sent': (stageKey) => ({
    enabled: true,
    mode: 'sequential',
    autoAdvance: false,
    notes: 'Ensure the buyer has everything required to sign quickly.',
    actions: [
      {
        key: `${stageKey}-prep-signature`,
        title: 'Prepare contract for signature',
        description: 'Populate contract in e-sign platform and confirm legal terms and pricing.',
        actionType: 'document',
        dueInDays: 0,
        assignment: { type: 'deal_owner', targetId: null, targetType: '', targetName: '' },
        required: true,
        dependencies: [],
        autoCreate: true,
        trigger: { type: 'stage_entry', conditions: [] },
        alerts: [{ type: 'in_app', offset: { amount: 0, unit: 'hours' }, recipients: [], message: 'Send contract for signature' }],
        resources: [{ name: 'MSA Template', type: 'document', url: '', description: '' }],
        metadata: {}
      },
      {
        key: `${stageKey}-confirm-timeline`,
        title: 'Confirm signing timeline',
        description: 'Touch base with the buyer to confirm target signing date and any blockers.',
        actionType: 'alert',
        dueInDays: 1,
        assignment: { type: 'deal_owner', targetId: null, targetType: '', targetName: '' },
        required: false,
        dependencies: [`${stageKey}-prep-signature`],
        autoCreate: true,
        trigger: { type: 'time_delay', delay: { amount: 1, unit: 'days' }, conditions: [] },
        alerts: [{ type: 'email', offset: { amount: 0, unit: 'hours' }, recipients: [], message: 'Check in on signature timeline' }],
        resources: [],
        metadata: {}
      }
    ],
    exitCriteria: {
      type: 'all_actions_completed',
      customDescription: '',
      nextStageKey: '',
      conditions: []
    }
  }),
  'closed won': (stageKey) => ({
    enabled: true,
    mode: 'sequential',
    autoAdvance: false,
    notes: 'Capture handoff details to ensure a smooth implementation.',
    actions: [
      {
        key: `${stageKey}-handoff`,
        title: 'Schedule handoff meeting',
        description: 'Introduce customer success and implementation teams, review goals and timeline.',
        actionType: 'event',
        dueInDays: 1,
        assignment: { type: 'team', targetId: null, targetType: '', targetName: 'Customer Success' },
        required: true,
        dependencies: [],
        autoCreate: true,
        trigger: { type: 'stage_entry', conditions: [] },
        alerts: [{ type: 'in_app', offset: { amount: 0, unit: 'hours' }, recipients: [], message: 'Schedule customer handoff' }],
        resources: [{ name: 'Implementation Checklist', type: 'document', url: '', description: '' }],
        metadata: {}
      },
      {
        key: `${stageKey}-celebrate`,
        title: 'Announce win internally',
        description: 'Update internal channels with win announcement and key insights.',
        actionType: 'alert',
        dueInDays: 0,
        assignment: { type: 'deal_owner', targetId: null, targetType: '', targetName: '' },
        required: false,
        dependencies: [`${stageKey}-handoff`],
        autoCreate: true,
        trigger: { type: 'after_action', sourceActionKey: `${stageKey}-handoff`, conditions: [] },
        alerts: [{ type: 'in_app', offset: { amount: 0, unit: 'hours' }, recipients: [], message: 'Share win announcement' }],
        resources: [],
        metadata: {}
      }
    ],
    exitCriteria: {
      type: 'manual',
      customDescription: 'Implementation team confirms onboarding is complete.',
      nextStageKey: '',
      conditions: []
    }
  }),
  'closed lost': (stageKey) => ({
    enabled: true,
    mode: 'sequential',
    autoAdvance: false,
    notes: 'Capture lost reason for future analysis and re-engagement.',
    actions: [
      {
        key: `${stageKey}-log-reason`,
        title: 'Log loss reason',
        description: 'Document clear reason codes and supporting notes in CRM.',
        actionType: 'task',
        dueInDays: 0,
        assignment: { type: 'deal_owner', targetId: null, targetType: '', targetName: '' },
        required: true,
        dependencies: [],
        autoCreate: true,
        trigger: { type: 'stage_entry', conditions: [] },
        alerts: [{ type: 'in_app', offset: { amount: 0, unit: 'hours' }, recipients: [], message: 'Capture lost reason' }],
        resources: [],
        metadata: {}
      },
      {
        key: `${stageKey}-nurture-plan`,
        title: 'Plan nurture follow-up',
        description: 'Identify future check-in date or nurture sequence to stay in touch.',
        actionType: 'task',
        dueInDays: 7,
        assignment: { type: 'deal_owner', targetId: null, targetType: '', targetName: '' },
        required: false,
        dependencies: [`${stageKey}-log-reason`],
        autoCreate: true,
        trigger: { type: 'time_delay', delay: { amount: 7, unit: 'days' }, conditions: [] },
        alerts: [{ type: 'email', offset: { amount: 0, unit: 'hours' }, recipients: [], message: 'Schedule nurture follow-up' }],
        resources: [],
        metadata: {}
      }
    ],
    exitCriteria: {
      type: 'manual',
      customDescription: 'Sales manager reviews and acknowledges learnings.',
      nextStageKey: '',
      conditions: []
    }
  })
};

function buildStagePlaybook(stageKey, stageName, status = 'open') {
  const templateBuilder = DEFAULT_STAGE_PLAYBOOKS[(stageName || '').toLowerCase()];
  const basePlaybook = templateBuilder ? templateBuilder(stageKey) : null;
  const exitType = status === 'won' || status === 'lost' ? 'manual' : 'all_actions_completed';
  const normalized = {
    enabled: basePlaybook?.enabled === true,
    mode: ['sequential', 'non_sequential'].includes(basePlaybook?.mode) ? basePlaybook.mode : 'sequential',
    autoAdvance: basePlaybook?.autoAdvance === true,
    notes: basePlaybook?.notes || '',
    actions: Array.isArray(basePlaybook?.actions) ? basePlaybook.actions : [],
    exitCriteria: basePlaybook?.exitCriteria || { type: exitType, customDescription: '', nextStageKey: '', conditions: [] }
  };

  normalized.actions = normalized.actions.map((action, index) => normalizePlaybookAction(action, stageKey, index));
  normalized.exitCriteria = normalizeExitCriteria(normalized.exitCriteria, exitType);
  return normalized;
}

function normalizePlaybookAction(action, stageKey, index) {
  const title = (action?.title || `Action ${index + 1}`).trim();
  const key = slugify(action?.key || `${stageKey}-${title}-${index}`);
  const actionType = PLAYBOOK_ACTION_TYPES.has(action?.actionType) ? action.actionType : 'task';
  const dependencies = Array.isArray(action?.dependencies) ? action.dependencies.filter(Boolean) : [];
  const trigger = normalizeActionTrigger(action?.trigger);
  const alerts = normalizeActionAlerts(action?.alerts);
  const resources = normalizeActionResources(action?.resources);

  let dueInDays = Math.max(0, Number(action?.dueInDays) || 0);
  if (actionType === 'alert') {
    dueInDays = Number.isFinite(dueInDays) ? dueInDays : 0;
  }

  return {
    key,
    title,
    description: action?.description || '',
    actionType,
    dueInDays,
    assignment: normalizeAssignment(action?.assignment),
    required: action?.required !== false,
    dependencies,
    autoCreate: action?.autoCreate !== false,
    trigger,
    alerts,
    resources,
    metadata: (action?.metadata && typeof action.metadata === 'object') ? action.metadata : {}
  };
}

function normalizeAssignment(assignment) {
  const type = ['deal_owner', 'stage_owner', 'specific_user', 'role', 'team'].includes(assignment?.type)
    ? assignment.type
    : 'deal_owner';
  return {
    type,
    targetId: assignment?.targetId || null,
    targetType: assignment?.targetType || '',
    targetName: assignment?.targetName || ''
  };
}

function normalizeActionTrigger(trigger) {
  const type = PLAYBOOK_TRIGGER_TYPES.has(trigger?.type) ? trigger.type : 'stage_entry';
  const sourceActionKey = trigger?.sourceActionKey ? slugify(trigger.sourceActionKey) : '';
  let delay = null;
  if (trigger?.delay && typeof trigger.delay === 'object') {
    const amount = Math.max(0, Number(trigger.delay.amount) || 0);
    const unit = PLAYBOOK_DELAY_UNITS.has(trigger.delay.unit) ? trigger.delay.unit : 'days';
    delay = { amount, unit };
  }
  const conditions = Array.isArray(trigger?.conditions)
    ? trigger.conditions.map(condition => ({
        field: condition.field || '',
        operator: condition.operator || 'equals',
        value: condition.value
      }))
    : [];
  return {
    type,
    sourceActionKey,
    delay,
    conditions,
    description: trigger?.description || ''
  };
}

function normalizeActionAlerts(alerts) {
  if (!Array.isArray(alerts)) return [];
  return alerts.map(alert => {
    const type = PLAYBOOK_ALERT_TYPES.has(alert?.type) ? alert.type : 'in_app';
    let offset = null;
    if (alert?.offset && typeof alert.offset === 'object') {
      const amount = Math.max(0, Number(alert.offset.amount) || 0);
      const unit = PLAYBOOK_DELAY_UNITS.has(alert.offset.unit) ? alert.offset.unit : 'hours';
      offset = { amount, unit };
    }
    const recipients = Array.isArray(alert?.recipients)
      ? alert.recipients.map(r => String(r || '').trim()).filter(Boolean)
      : [];
    return {
      type,
      offset,
      recipients,
      message: alert?.message || ''
    };
  });
}

function normalizeActionResources(resources) {
  if (!Array.isArray(resources)) return [];
  return resources.map(resource => ({
    name: resource?.name || '',
    type: PLAYBOOK_RESOURCE_TYPES.has(resource?.type) ? resource.type : 'document',
    url: resource?.url || '',
    description: resource?.description || ''
  }));
}

function normalizeExitCriteria(exitCriteria, fallbackType) {
  const type = ['manual', 'all_actions_completed', 'any_action_completed', 'custom'].includes(exitCriteria?.type)
    ? exitCriteria.type
    : fallbackType;
  return {
    type,
    customDescription: exitCriteria?.customDescription || '',
    nextStageKey: exitCriteria?.nextStageKey ? slugify(exitCriteria.nextStageKey) : '',
    conditions: Array.isArray(exitCriteria?.conditions)
      ? exitCriteria.conditions.map(condition => ({
          field: condition.field || '',
          operator: condition.operator || 'equals',
          value: condition.value
        }))
      : []
  };
}

function buildPipelineStage(name, { order = 0, probability = 0, status = 'open', keyPrefix = '' } = {}) {
  const normalizedStatus = ['open', 'won', 'lost', 'stalled'].includes(status) ? status : 'open';
  const finalProbability = typeof probability === 'number'
    ? Math.min(100, Math.max(0, probability))
    : (normalizedStatus === 'won' ? 100 : normalizedStatus === 'lost' ? 0 : 0);
  const keyBase = name || `Stage ${order + 1}`;
  const key = slugify(keyPrefix ? `${keyPrefix}-${keyBase}` : keyBase);
  return {
    key,
    name: keyBase,
    description: '',
    probability: normalizedStatus === 'won' ? 100 : normalizedStatus === 'lost' ? 0 : finalProbability,
    status: normalizedStatus,
    order,
    isClosedWon: normalizedStatus === 'won',
    isClosedLost: normalizedStatus === 'lost',
    playbook: buildStagePlaybook(key, keyBase, normalizedStatus)
  };
}

function defaultPipelineSettings() {
  const now = new Date();
  return [
    {
      key: 'default_pipeline',
      name: 'Default Pipeline',
      description: 'Standard sales pipeline',
      color: '#2563EB',
      isDefault: true,
      order: 0,
      createdAt: now,
      updatedAt: now,
      stages: [
        buildPipelineStage('Qualification', { order: 0, probability: 25, status: 'open', keyPrefix: 'default_pipeline' }),
        buildPipelineStage('Proposal', { order: 1, probability: 50, status: 'open', keyPrefix: 'default_pipeline' }),
        buildPipelineStage('Negotiation', { order: 2, probability: 70, status: 'open', keyPrefix: 'default_pipeline' }),
        buildPipelineStage('Contract Sent', { order: 3, probability: 85, status: 'open', keyPrefix: 'default_pipeline' }),
        buildPipelineStage('Closed Won', { order: 4, probability: 100, status: 'won', keyPrefix: 'default_pipeline' }),
        buildPipelineStage('Closed Lost', { order: 5, probability: 0, status: 'lost', keyPrefix: 'default_pipeline' })
      ]
    }
  ];
}

function clonePipelineSettings() {
  return JSON.parse(JSON.stringify(defaultPipelineSettings()));
}

function cloneFields() {
  return JSON.parse(JSON.stringify(baseFields));
}

async function updateDealsModuleFields(organizationId = null) {
  let shouldDisconnect = false;

  try {
    if (mongoose.connection.readyState === 0) {
      const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/litedesk_master';
      await mongoose.connect(uri);
      shouldDisconnect = true;
      console.log('Connected to MongoDB');
    }

    const orgQuery = organizationId ? { _id: organizationId } : {};
    const organizations = await Organization.find(orgQuery).select('_id name');

    console.log(`Updating deals module definition for ${organizations.length} organization(s)`);

    for (const org of organizations) {
      const existing = await ModuleDefinition.findOne({
        organizationId: org._id,
        key: 'deals'
      });

      if (existing) {
        existing.fields = cloneFields();
        existing.name = 'Deals';
        existing.type = 'system';
        existing.enabled = existing.enabled !== false;
        existing.quickCreate = [...quickCreateDefault];
        existing.quickCreateLayout = { version: 1, rows: [] };
        existing.relationships = Array.isArray(existing.relationships) ? existing.relationships : [];
        existing.pipelineSettings = clonePipelineSettings();
        existing.markModified('pipelineSettings');
        await existing.save();
        console.log(`✓ Updated deals module for organization: ${org.name || org._id}`);
      } else {
        await ModuleDefinition.create({
          organizationId: org._id,
          key: 'deals',
          name: 'Deals',
          type: 'system',
          enabled: true,
          fields: cloneFields(),
          quickCreate: quickCreateDefault,
          quickCreateLayout: { version: 1, rows: [] },
          relationships: [],
          pipelineSettings: clonePipelineSettings()
        });
        console.log(`✓ Created deals module for organization: ${org.name || org._id}`);
      }
    }

    console.log('✅ Deals module definitions updated successfully');
  } catch (error) {
    console.error('❌ Error updating deals module fields:', error);
    throw error;
  } finally {
    if (shouldDisconnect) {
      await mongoose.disconnect();
      console.log('Disconnected from MongoDB');
    }
  }
}

if (require.main === module) {
  updateDealsModuleFields()
    .then(() => {
      console.log('Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

module.exports = updateDealsModuleFields;

