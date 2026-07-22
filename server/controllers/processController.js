/**
 * ============================================================================
 * PLATFORM CORE: Process Controller
 * ============================================================================
 *
 * CRUD endpoints for Process management (Admin only).
 * Includes validation, preview, and test execution functionality.
 *
 * ============================================================================
 */

const mongoose = require('mongoose');
const Process = require('../models/Process');
const ProcessExecution = require('../models/ProcessExecution');
const { validateProcess } = require('../services/processExecutor');
const { startProcess } = require('../services/processInvocation');
const { createLogger } = require('../services/automationLogger');
const {
  normalizeProcessGraph,
  validateProcessGraph,
  createDefaultProcessGraph
} = require('../utils/processGraphUtils');
const { buildGraphState } = require('../services/processExecutionTracker');
const { simulateProcessRun } = require('../services/processDryRun');
const { getCapabilitiesForProcessDesigner } = require('../utils/executionCapabilityRegistry');
const {
  getProcessDesignerActions,
  getProcessDesignerActionGroups
} = require('../constants/processDesignerActions');
const { LIVE_CHAT_PROCESS_DESIGNER_TRIGGERS } = require('../constants/liveChatProcessDesigner');
const { ANNOUNCEMENTS_PROCESS_DESIGNER_TRIGGERS } = require('../constants/announcementsProcessDesigner');
const {
  buildWebhookKey,
  generateWebhookSecret,
  buildWebhookPublicUrl,
  sanitizeProcessTriggerForClient
} = require('../utils/processWebhookUtils');
const {
  publishProcessDefinition,
  getActiveDefinitionVersion,
  buildExecutionInsightPayload
} = require('../services/processDefinitionVersionService');

const log = createLogger('processController');

async function ensureWebhookTrigger(processDoc, organizationId, options = {}) {
  if (!processDoc.trigger || processDoc.trigger.type !== 'webhook') {
    return { oneTimeSecret: null };
  }
  if (!processDoc.trigger.webhookKey) {
    processDoc.trigger.webhookKey = buildWebhookKey(organizationId);
  }
  if (!processDoc.trigger.version) {
    processDoc.trigger.version = 1;
  }
  if (processDoc.trigger.payloadMapping == null) {
    processDoc.trigger.payloadMapping = {};
  }
  let oneTimeSecret = null;
  if (!processDoc.trigger.secretHash || options.rotateSecret) {
    const { plaintext, secretHash } = await generateWebhookSecret();
    processDoc.trigger.secretHash = secretHash;
    oneTimeSecret = plaintext;
  }
  return { oneTimeSecret };
}

async function enrichProcessForClient(process, req) {
  const obj = process?.toObject ? process.toObject() : { ...process };
  if (obj.trigger?.type === 'webhook' && obj.trigger.webhookKey) {
    obj.webhookUrl = buildWebhookPublicUrl(obj.trigger.webhookKey, req);
  }
  if (obj.trigger) {
    obj.trigger = sanitizeProcessTriggerForClient(obj.trigger);
  }
  if (obj.activeDefinitionVersionId) {
    const pub = await getActiveDefinitionVersion(obj);
    if (pub) {
      obj.publishedDefinition = {
        versionNumber: pub.versionNumber,
        publishedAt: pub.publishedAt,
        id: pub._id.toString()
      };
    }
  }
  return obj;
}

// Known keys (designer-metadata hints only — create/update accepts any tenant app/module)
const APP_KEYS = ['PLATFORM', 'SALES', 'HELPDESK', 'AUDIT', 'PORTAL', 'PROJECTS', 'MARKETING', 'INVENTORY', 'LMS'];

const ENTITY_TYPES = [
  'people',
  'organization',
  'deal',
  'quote',
  'live_chat_session',
  'tasks',
  'events',
  'forms',
  'items',
  'documents',
  'cases',
  'responses'
];

// Known trigger types
const TRIGGER_TYPES = ['domain_event', 'manual', 'webhook', 'schedule'];
const { CORE_TRIGGER_TYPES } = require('../utils/processTriggerUtils');

// Known node types
const NODE_TYPES = ['trigger', 'condition', 'action', 'data_mapping', 'end', 'field_rule', 'ownership_rule', 'status_guard', 'approval_gate', 'wait', 'for_each', 'for_each_end'];

/**
 * Validate process definition
 */
function validateProcessDefinition(processData) {
  const isDraft = String(processData.status || 'draft').toLowerCase() === 'draft';

  if (!processData.name || typeof processData.name !== 'string' || !processData.name.trim()) {
    return { valid: false, error: 'Process name is required' };
  }

  if (!processData.appKey || !String(processData.appKey).trim()) {
    return { valid: false, error: 'App is required' };
  }
  processData.appKey = String(processData.appKey).toUpperCase().trim();

  if (!processData.entityType || !String(processData.entityType).trim()) {
    return { valid: false, error: 'Module is required' };
  }
  processData.entityType = String(processData.entityType).toLowerCase().trim();

  if (!processData.trigger || typeof processData.trigger !== 'object') {
    return { valid: false, error: 'Trigger is required' };
  }

  if (!TRIGGER_TYPES.includes(processData.trigger.type)) {
    return { valid: false, error: `Invalid trigger type: ${processData.trigger.type}` };
  }

  if (!isDraft && processData.triggerConfigured === false) {
    return { valid: false, error: 'Select what starts this process before activating' };
  }

  if (processData.trigger.type === 'domain_event' && !processData.trigger.eventType) {
    return { valid: false, error: 'Domain event trigger requires eventType' };
  }

  if (processData.trigger.type === 'schedule') {
    processData.trigger.eventType = null;
    processData.triggerBehaviour = 'every_time';
    const sched = processData.trigger.schedule;
    if (!sched || !sched.preset) {
      return { valid: false, error: 'Schedule trigger requires schedule configuration' };
    }
    const allowed = new Set(['hourly', 'daily', 'weekly', 'monthly']);
    if (!allowed.has(sched.preset)) {
      return { valid: false, error: 'Schedule preset must be hourly, daily, weekly, or monthly' };
    }
    if (sched.preset === 'monthly') {
      const day = Number(sched.dayOfMonth ?? 1);
      if (!Number.isFinite(day) || day < 1 || day > 28) {
        return { valid: false, error: 'Monthly schedule dayOfMonth must be between 1 and 28' };
      }
      sched.dayOfMonth = day;
    }
  }

  if (processData.trigger.type === 'webhook') {
    processData.trigger.eventType = null;
    if (processData.trigger.payloadMapping == null) {
      processData.trigger.payloadMapping = {};
    }
  }

  if (
    !isDraft &&
    (!processData.nodes || !Array.isArray(processData.nodes) || processData.nodes.length === 0)
  ) {
    return { valid: false, error: 'Process must have at least one step' };
  }

  // Validate nodes
  const nodeIds = new Set();
  for (const node of processData.nodes) {
    if (!node.id || typeof node.id !== 'string') {
      return { valid: false, error: 'All nodes must have an id' };
    }
    if (nodeIds.has(node.id)) {
      return { valid: false, error: `Duplicate node id: ${node.id}` };
    }
    nodeIds.add(node.id);

    if (!NODE_TYPES.includes(node.type)) {
      return { valid: false, error: `Invalid node type: ${node.type}` };
    }
  }

  const graphCheck = validateProcessGraph(processData, {
    requireNodes: !isDraft,
    strictTopology: !isDraft
  });
  if (!graphCheck.valid) {
    return { valid: false, error: graphCheck.errors[0]?.message || 'Invalid process graph', errors: graphCheck.errors };
  }

  return { valid: true };
}

/**
 * @route   GET /api/admin/processes/designer-metadata
 * @desc    Palette and validation hints for flow designer
 * @access  Private (Admin only)
 */
exports.getDesignerMetadata = async (req, res) => {
  try {
    const capabilities = getCapabilitiesForProcessDesigner();
    const processActions = getProcessDesignerActions();
    const processActionGroups = getProcessDesignerActionGroups();
    const { FORMULA_HELPER_CATALOG } = require('../utils/processFormulaHelpers');
    res.json({
      success: true,
      data: {
        appKeys: APP_KEYS,
        entityTypes: ENTITY_TYPES,
        triggerTypes: TRIGGER_TYPES,
        nodeTypes: NODE_TYPES,
        capabilities,
        processActions,
        processActionGroups,
        formulaHelpers: FORMULA_HELPER_CATALOG,
        entityTypes: ENTITY_TYPES,
        liveChatTriggers: LIVE_CHAT_PROCESS_DESIGNER_TRIGGERS,
        announcementsTriggers: ANNOUNCEMENTS_PROCESS_DESIGNER_TRIGGERS,
        coreTriggers: CORE_TRIGGER_TYPES.map((value) => ({
          value,
          label:
            {
              record_created: 'Record created',
              record_updated: 'Record updated',
              schedule: 'Schedule',
              webhook: 'Webhook',
              manual: 'Manual'
            }[value] || value
        })),
        schedulePresets: [
          { value: 'hourly', label: 'Every hour' },
          { value: 'daily', label: 'Daily' },
          { value: 'weekly', label: 'Weekly' },
          { value: 'monthly', label: 'Monthly' }
        ],
        validationRules: {
          sequential: true,
          branching: 'IF nodes only (true/false)',
          parallelSplitMerge: false,
          loops: 'for_each / for_each_end'
        },
        palette: [
          { type: 'trigger', label: 'Trigger', description: 'When this process starts' },
          { type: 'condition', label: 'IF', description: 'Branch true or false' },
          { type: 'field_rule', label: 'Field rule', description: 'Mandatory, default, or visibility' },
          { type: 'ownership_rule', label: 'Ownership', description: 'Assign record owner' },
          { type: 'status_guard', label: 'Status guard', description: 'Allow or block transitions' },
          { type: 'approval_gate', label: 'Approval', description: 'Require human approval' },
          { type: 'wait', label: 'Wait', description: 'Pause for a duration' },
          { type: 'action', label: 'Action', description: 'Run an automated action' },
          {
            type: 'for_each',
            label: 'For each',
            description: 'Run following steps once per fetched record'
          },
          {
            type: 'for_each_end',
            label: 'End for each',
            description: 'Mark the end of a for-each loop body'
          },
          { type: 'end', label: 'End', description: 'Stop the process' }
        ]
      }
    });
  } catch (error) {
    log.error('designer_metadata_error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error fetching designer metadata',
      error: error.message
    });
  }
};

const FORMULA_PREVIEW_SAMPLE = {
  first_name: 'Ada',
  last_name: 'Lovelace',
  email: 'ada@example.com',
  phone: '+1-555-0100',
  mobile: '',
  amount: 42,
  sales_type: 'Lead',
  organization: 'Acme Corp',
  createdAt: '2026-01-15T10:00:00.000Z',
  updatedAt: '2026-01-16T12:30:00.000Z'
};

/**
 * @route   POST /api/admin/processes/evaluate-expression
 * @desc    Live-preview a process field expression against sample trigger data
 * @access  Private (Admin only)
 */
exports.evaluateExpression = async (req, res) => {
  try {
    const expression = String(req.body?.expression ?? '');
    const sampleState =
      req.body?.sampleState && typeof req.body.sampleState === 'object' && !Array.isArray(req.body.sampleState)
        ? req.body.sampleState
        : {};
    const demo = { ...FORMULA_PREVIEW_SAMPLE, ...sampleState };
    const { resolveExpression, buildScope } = require('../utils/processFieldValueResolver');
    const { evaluateFormula, looksLikeFormula } = require('../utils/processFormulaEvaluator');
    const scope = buildScope({
      event: { currentState: demo, entityType: 'people', entityId: 'preview' },
      dataBag: { currentRecord: demo },
      entityId: 'preview',
      entityType: 'people'
    });

    if (!expression.trim()) {
      return res.json({
        success: true,
        data: { value: '', display: '', status: 'empty', sampleState: demo }
      });
    }

    try {
      let value;
      if (looksLikeFormula(expression) && !expression.includes('{{')) {
        value = evaluateFormula(expression, scope);
      } else {
        value = resolveExpression(expression, scope);
      }
      const display =
        value === null || value === undefined
          ? 'null'
          : typeof value === 'object'
            ? JSON.stringify(value)
            : String(value);
      return res.json({
        success: true,
        data: { value, display, status: 'ok', sampleState: demo }
      });
    } catch (err) {
      return res.json({
        success: true,
        data: {
          value: null,
          display: '',
          status: 'error',
          error: err.message || 'Invalid expression',
          sampleState: demo
        }
      });
    }
  } catch (error) {
    log.error('evaluate_expression_error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error evaluating expression',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/admin/processes
 * @desc    Get all processes (admin only)
 * @access  Private (Admin only)
 */
exports.getAllProcesses = async (req, res) => {
  try {
    const { appKey, status } = req.query;
    const query = {};
    
    if (appKey) query.appKey = appKey.toUpperCase();
    if (status) query.status = status.toLowerCase();
    
    // Scope to user's org or global processes
    query.$or = [
      { organizationId: null },
      { organizationId: req.user.organizationId }
    ];
    
    const processes = await Process.find(query)
      .sort({ updatedAt: -1 })
      .lean();
    
    res.json({
      success: true,
      data: processes,
      count: processes.length
    });
  } catch (error) {
    log.error('get_all_processes_error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error fetching processes',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/admin/processes/:id
 * @desc    Get single process
 * @access  Private (Admin only)
 */
exports.getProcessById = async (req, res) => {
  try {
    const process = await Process.findOne({
      _id: req.params.id,
      $or: [
        { organizationId: null },
        { organizationId: req.user.organizationId }
      ]
    }).lean();
    
    if (!process) {
      return res.status(404).json({
        success: false,
        message: 'Process not found'
      });
    }

    const normalized = normalizeProcessGraph(process, { autoLayout: true });

    res.json({
      success: true,
      data: await enrichProcessForClient(normalized, req)
    });
  } catch (error) {
    log.error('get_process_error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error fetching process',
      error: error.message
    });
  }
};

/**
 * @route   POST /api/admin/processes
 * @desc    Create new process
 * @access  Private (Admin only)
 */
exports.createProcess = async (req, res) => {
  try {
    const defaults = createDefaultProcessGraph();
    const processData = normalizeProcessGraph({
      ...defaults,
      name: req.body.name || 'Untitled Process',
      description: req.body.description || '',
      ...req.body,
      appKey: req.body.appKey ? String(req.body.appKey).toUpperCase() : undefined,
      createdBy: req.user._id,
      status: 'draft',
      triggerConfigured: req.body.triggerConfigured === true
    }, { autoLayout: true });

    // Validate process definition (draft — do not require active status)
    const validation = validateProcessDefinition(processData);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.error,
        errors: validation.errors
      });
    }

    const process = new Process(processData);
    const { oneTimeSecret } = await ensureWebhookTrigger(process, req.user.organizationId);
    await process.save();

    log.info('process_created', {
      processId: process._id.toString(),
      name: process.name,
      appKey: process.appKey,
      createdBy: req.user._id.toString()
    });

    const response = {
      success: true,
      data: await enrichProcessForClient(process, req),
      message: 'Process created successfully'
    };
    if (oneTimeSecret) response.webhookSecret = oneTimeSecret;

    const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
    attachSettingsAuditDiff(
      res,
      {},
      cloneForAudit({ name: process.name, status: process.status, appKey: process.appKey }),
      { keys: ['name', 'status', 'appKey'] }
    );

    res.status(201).json(response);
  } catch (error) {
    log.error('create_process_error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error creating process',
      error: error.message
    });
  }
};

/**
 * @route   PUT /api/admin/processes/:id
 * @desc    Update process (draft only)
 * @access  Private (Admin only)
 */
exports.updateProcess = async (req, res) => {
  try {
    const process = await Process.findOne({
      _id: req.params.id,
      $or: [
        { organizationId: null },
        { organizationId: req.user.organizationId }
      ]
    });

    if (!process) {
      return res.status(404).json({
        success: false,
        message: 'Process not found'
      });
    }

    // Only allow editing draft processes
    if (process.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Only draft processes can be edited. Duplicate the process to make changes.'
      });
    }

    const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
    const before = cloneForAudit({
      name: process.name,
      status: process.status,
      description: process.description
    });

    const normalizedBody = normalizeProcessGraph(
      { ...process.toObject(), ...req.body },
      { autoLayout: false }
    );
    Object.assign(process, normalizedBody);
    delete process.createdBy;

    // Validate process definition (draft — active check only on activate)
    const validation = validateProcessDefinition(process.toObject());
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.error,
        errors: validation.errors
      });
    }

    const { oneTimeSecret } = await ensureWebhookTrigger(process, req.user.organizationId);
    await process.save();

    log.info('process_updated', {
      processId: process._id.toString(),
      name: process.name
    });

    const response = {
      success: true,
      data: await enrichProcessForClient(process, req),
      message: 'Process updated successfully'
    };
    if (oneTimeSecret) response.webhookSecret = oneTimeSecret;

    attachSettingsAuditDiff(
      res,
      before,
      cloneForAudit({
        name: process.name,
        status: process.status,
        description: process.description
      }),
      { keys: ['name', 'status', 'description'] }
    );

    res.json(response);
  } catch (error) {
    log.error('update_process_error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error updating process',
      error: error.message
    });
  }
};

/**
 * @route   PUT /api/admin/processes/:id/status
 * @desc    Update process status (activate/deactivate)
 * @access  Private (Admin only)
 */
exports.updateProcessStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['draft', 'active', 'archived'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const process = await Process.findOne({
      _id: req.params.id,
      $or: [
        { organizationId: null },
        { organizationId: req.user.organizationId }
      ]
    });

    if (!process) {
      return res.status(404).json({
        success: false,
        message: 'Process not found'
      });
    }

    const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
    const before = cloneForAudit({ status: process.status });

    // Validate before activating (graph + runnable active process)
    if (status === 'active') {
      if (process.triggerConfigured === false) {
        return res.status(400).json({
          success: false,
          message: 'Select what starts this process in Process settings before activating.'
        });
      }
      if (process.trigger?.type === 'webhook') {
        await ensureWebhookTrigger(process, req.user.organizationId);
        if (!process.trigger.secretHash) {
          return res.status(400).json({
            success: false,
            message: 'Webhook process requires a secret. Save the process or rotate the webhook secret first.'
          });
        }
      }
      const graphCheck = validateProcessGraph(process.toObject(), { requireNodes: true });
      if (!graphCheck.valid) {
        return res.status(400).json({
          success: false,
          message: graphCheck.errors[0]?.message || 'Invalid process graph',
          errors: graphCheck.errors
        });
      }
      const validation = validateProcess({ ...process.toObject(), status: 'active' });
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: `Cannot activate process: ${validation.error}`
        });
      }

      await publishProcessDefinition(process, req.user._id);
    }

    process.status = status;
    await process.save();

    log.info('process_status_updated', {
      processId: process._id.toString(),
      status,
      publishedVersion: status === 'active' ? process.version : undefined
    });

    const activateMsg =
      status === 'active'
        ? `Process activated and published as version ${process.version}`
        : status === 'archived'
        ? 'Process archived successfully'
        : 'Process saved as draft';

    attachSettingsAuditDiff(
      res,
      before,
      cloneForAudit({ status: process.status }),
      { keys: ['status'] }
    );

    res.json({
      success: true,
      data: await enrichProcessForClient(process, req),
      message: activateMsg,
      publishedVersion: status === 'active' ? process.version : undefined
    });
  } catch (error) {
    log.error('update_process_status_error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error updating process status',
      error: error.message
    });
  }
};

/**
 * @route   POST /api/admin/processes/:id/duplicate
 * @desc    Duplicate process
 * @access  Private (Admin only)
 */
exports.duplicateProcess = async (req, res) => {
  try {
    const original = await Process.findOne({
      _id: req.params.id,
      $or: [
        { organizationId: null },
        { organizationId: req.user.organizationId }
      ]
    }).lean();

    if (!original) {
      return res.status(404).json({
        success: false,
        message: 'Process not found'
      });
    }

    const normalized = normalizeProcessGraph(original, { autoLayout: false });
    if (normalized.trigger?.type === 'webhook') {
      normalized.trigger = {
        ...normalized.trigger,
        webhookKey: null,
        secretHash: null
      };
    }
    const duplicate = new Process({
      ...normalized,
      _id: undefined,
      name: `${original.name} (Copy)`,
      status: 'draft',
      version: 0,
      activeDefinitionVersionId: null,
      createdBy: req.user._id
    });

    await ensureWebhookTrigger(duplicate, req.user.organizationId);
    await duplicate.save();

    log.info('process_duplicated', {
      originalId: original._id.toString(),
      duplicateId: duplicate._id.toString()
    });

    res.status(201).json({
      success: true,
      data: duplicate,
      message: 'Process duplicated successfully'
    });
  } catch (error) {
    log.error('duplicate_process_error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error duplicating process',
      error: error.message
    });
  }
};

/**
 * @route   POST /api/admin/processes/:id/run-now
 * @desc    Start an active process immediately (manual or schedule triggers)
 * @access  Private (Admin only)
 */
exports.runProcessNow = async (req, res) => {
  try {
    const process = await Process.findOne({
      _id: req.params.id,
      $or: [
        { organizationId: null },
        { organizationId: req.user.organizationId }
      ]
    }).lean();

    if (!process) {
      return res.status(404).json({ success: false, message: 'Process not found' });
    }

    if (process.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Process must be Active before it can run'
      });
    }

    const triggerType = process.trigger?.type;
    if (triggerType !== 'schedule' && triggerType !== 'manual') {
      return res.status(400).json({
        success: false,
        message: `Run now is only supported for schedule and manual triggers (got ${triggerType || 'none'})`
      });
    }

    const orgId = req.user.organizationId ? String(req.user.organizationId) : null;
    const entityId = req.body?.entityId ? String(req.body.entityId).trim() : null;

    const result = await startProcess({
      processId: process._id.toString(),
      scheduleInvocation: triggerType === 'schedule',
      scheduleSlotId:
        triggerType === 'schedule' ? `run-now:${Date.now()}` : null,
      manualParams: {
        organizationId: orgId,
        entityType: process.entityType || req.body?.entityType || null,
        entityId,
        triggeredBy: req.user._id ? String(req.user._id) : null
      }
    });

    if (!result?.ok) {
      return res.status(400).json({
        success: false,
        message: result?.error || 'Process run failed',
        data: result
      });
    }

    res.json({
      success: true,
      data: {
        executionId: result.executionId,
        skipped: result.skipped === true,
        reason: result.reason || null
      },
      message: result.skipped ? 'Process run skipped' : 'Process run started'
    });
  } catch (error) {
    log.error('run_process_now_error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error running process',
      error: error.message
    });
  }
};

/**
 * @route   POST /api/admin/processes/:id/test
 * @desc    Test process execution (dry-run)
 * @access  Private (Admin only)
 */
exports.testProcess = async (req, res) => {
  try {
    const { entityId, entityType, sampleEventState } = req.body;

    const process = await Process.findOne({
      _id: req.params.id,
      $or: [
        { organizationId: null },
        { organizationId: req.user.organizationId }
      ]
    }).lean();

    if (!process) {
      return res.status(404).json({
        success: false,
        message: 'Process not found'
      });
    }

    const normalized = normalizeProcessGraph(process, { autoLayout: false });
    const graphState = simulateProcessRun(normalized, {
      entityId: entityId || 'test-record',
      entityType: entityType || normalized.entityType,
      sampleEventState: sampleEventState || {}
    });

    res.json({
      success: true,
      data: {
        dryRun: true,
        graphState,
        message: 'Test simulation complete. No data was changed.'
      }
    });
  } catch (error) {
    log.error('test_process_error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error testing process',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/admin/processes/:id/executions/:executionId/graph-state
 * @desc    Node/edge execution overlay for designer
 * @access  Private (Admin only)
 */
exports.getExecutionGraphState = async (req, res) => {
  try {
    const process = await Process.findOne({
      _id: req.params.id,
      $or: [
        { organizationId: null },
        { organizationId: req.user.organizationId }
      ]
    }).lean();

    if (!process) {
      return res.status(404).json({ success: false, message: 'Process not found' });
    }

    const execQuery = { processId: process._id };
    if (mongoose.Types.ObjectId.isValid(req.params.executionId)) {
      execQuery.$or = [
        { _id: req.params.executionId },
        { executionId: req.params.executionId }
      ];
    } else {
      execQuery.executionId = req.params.executionId;
    }
    const execution = await ProcessExecution.findOne(execQuery).lean();

    if (!execution) {
      return res.status(404).json({ success: false, message: 'Execution not found' });
    }

    const insight = await buildExecutionInsightPayload(process, execution);

    res.json({ success: true, data: insight });
  } catch (error) {
    log.error('execution_graph_state_error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error fetching execution graph state',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/admin/processes/:id/executions
 * @desc    Get process execution logs
 * @access  Private (Admin only)
 */
exports.getProcessExecutions = async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const process = await Process.findOne({
      _id: req.params.id,
      $or: [
        { organizationId: null },
        { organizationId: req.user.organizationId }
      ]
    });

    if (!process) {
      return res.status(404).json({
        success: false,
        message: 'Process not found'
      });
    }

    const executions = await ProcessExecution.find({
      processId: process._id
    })
      .sort({ startedAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .lean();

    const total = await ProcessExecution.countDocuments({
      processId: process._id
    });

    res.json({
      success: true,
      data: executions,
      count: executions.length,
      total
    });
  } catch (error) {
    log.error('get_process_executions_error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error fetching process executions',
      error: error.message
    });
  }
};

/**
 * @route   POST /api/admin/processes/:id/webhook/rotate-secret
 * @desc    Rotate webhook signing secret (returns plaintext once)
 * @access  Private (Admin only)
 */
exports.rotateProcessWebhookSecret = async (req, res) => {
  try {
    const process = await Process.findOne({
      _id: req.params.id,
      $or: [
        { organizationId: null },
        { organizationId: req.user.organizationId }
      ]
    });

    if (!process) {
      return res.status(404).json({ success: false, message: 'Process not found' });
    }
    if (process.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Only draft processes can rotate webhook secrets. Duplicate to edit.'
      });
    }
    if (process.trigger?.type !== 'webhook') {
      return res.status(400).json({ success: false, message: 'Process trigger is not webhook' });
    }

    const { oneTimeSecret } = await ensureWebhookTrigger(process, req.user.organizationId, {
      rotateSecret: true
    });
    await process.save();

    res.json({
      success: true,
      data: await enrichProcessForClient(process, req),
      webhookSecret: oneTimeSecret,
      message: 'Webhook secret rotated. Copy it now — it will not be shown again.'
    });
  } catch (error) {
    log.error('rotate_webhook_secret_error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error rotating webhook secret',
      error: error.message
    });
  }
};

/**
 * @route   DELETE /api/admin/processes/:id
 * @desc    Delete process (any non-active status: draft / archived)
 * @access  Private (Admin only)
 */
exports.deleteProcess = async (req, res) => {
  try {
    // Process lives on tenant DB (ALS); schema has no organizationId — do not filter on it.
    const process = await Process.findById(req.params.id);

    if (!process) {
      return res.status(404).json({
        success: false,
        message: 'Process not found'
      });
    }

    const status = String(process.status || '').toLowerCase();
    if (status === 'active') {
      return res.status(400).json({
        success: false,
        message: 'Active processes cannot be deleted. Deactivate (archive) them first.'
      });
    }

    const processId = process._id;
    try {
      const ProcessDefinitionVersion = require('../models/ProcessDefinitionVersion');
      await ProcessDefinitionVersion.deleteMany({ processId });
    } catch (verErr) {
      log.warn('process_definition_cleanup_failed', {
        processId: processId.toString(),
        error: verErr.message
      });
    }

    try {
      const ProcessExecution = require('../models/ProcessExecution');
      await ProcessExecution.deleteMany({ processId });
    } catch (execErr) {
      log.warn('process_execution_cleanup_failed', {
        processId: processId.toString(),
        error: execErr.message
      });
    }

    await Process.deleteOne({ _id: processId });

    log.info('process_deleted', {
      processId: processId.toString(),
      name: process.name,
      status: process.status
    });

    const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
    attachSettingsAuditDiff(
      res,
      cloneForAudit({ name: process.name, status: process.status }),
      {},
      { keys: ['name', 'status'] }
    );

    res.json({
      success: true,
      message: 'Process deleted successfully'
    });
  } catch (error) {
    log.error('delete_process_error', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: 'Error deleting process',
      error: error.message
    });
  }
};
