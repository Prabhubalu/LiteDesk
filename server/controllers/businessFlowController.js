/**
 * ============================================================================
 * PLATFORM CORE: Business Flow Controller (Process Designer Phase 4D)
 * ============================================================================
 *
 * CRUD API for Business Flows. Admin only. No execution logic.
 *
 * ============================================================================
 */

const BusinessFlow = require('../models/BusinessFlow');
const Process = require('../models/Process');
const { createLogger } = require('../services/automationLogger');
const flowHealthAnalytics = require('../services/flowHealthAnalytics');

const log = createLogger('businessFlowController');

/**
 * @route   GET /api/admin/business-flows
 * @desc    Get all business flows for organization
 * @access  Private (admin)
 */
exports.getBusinessFlows = async (req, res) => {
  try {
    const flows = await BusinessFlow.find({
      organizationId: req.user.organizationId
    })
      .populate('processIds', 'name trigger status')
      .populate('createdBy', 'firstName lastName email')
      .sort({ updatedAt: -1 })
      .lean();

    res.json({
      success: true,
      data: flows,
      count: flows.length
    });
  } catch (error) {
    log.error('get_business_flows_error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error fetching business flows',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/admin/business-flows/:id
 * @desc    Get single business flow with full process details
 * @access  Private (admin)
 */
exports.getBusinessFlowById = async (req, res) => {
  try {
    const flow = await BusinessFlow.findById(req.params.id)
      .populate('processIds')
      .populate('createdBy', 'firstName lastName email')
      .lean();

    if (!flow) {
      return res.status(404).json({
        success: false,
        message: 'Business flow not found'
      });
    }

    if (String(flow.organizationId) !== String(req.user.organizationId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Enrich with process details and causality inference
    const enrichedProcesses = await enrichProcessesWithCausality(flow.processIds || []);

    res.json({
      success: true,
      data: {
        ...flow,
        processes: enrichedProcesses
      }
    });
  } catch (error) {
    log.error('get_business_flow_error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error fetching business flow',
      error: error.message
    });
  }
};

/**
 * @route   POST /api/admin/business-flows
 * @desc    Create new business flow
 * @access  Private (admin)
 */
exports.createBusinessFlow = async (req, res) => {
  try {
    const { name, description, appKey, processIds } = req.body;

    if (!name || !appKey || !Array.isArray(processIds) || processIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Name, appKey, and at least one processId are required'
      });
    }

    // Validate all processes exist and belong to organization
    const processes = await Process.find({
      _id: { $in: processIds },
      organizationId: req.user.organizationId
    }).lean();

    if (processes.length !== processIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more processes not found or access denied'
      });
    }

    const flow = await BusinessFlow.create({
      name,
      description: description || null,
      appKey,
      processIds,
      createdBy: req.user._id,
      organizationId: req.user.organizationId
    });

    const populated = await BusinessFlow.findById(flow._id)
      .populate('processIds', 'name trigger status')
      .populate('createdBy', 'firstName lastName email')
      .lean();

    const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
    attachSettingsAuditDiff(res, {}, cloneForAudit(populated), { body: req.body || {} });

    res.status(201).json({
      success: true,
      data: populated
    });
  } catch (error) {
    log.error('create_business_flow_error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error creating business flow',
      error: error.message
    });
  }
};

/**
 * @route   PUT /api/admin/business-flows/:id
 * @desc    Update business flow
 * @access  Private (admin)
 */
exports.updateBusinessFlow = async (req, res) => {
  try {
    const { name, description, appKey, processIds } = req.body;

    const flow = await BusinessFlow.findById(req.params.id);

    if (!flow) {
      return res.status(404).json({
        success: false,
        message: 'Business flow not found'
      });
    }

    if (String(flow.organizationId) !== String(req.user.organizationId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
    const before = cloneForAudit({
      name: flow.name,
      description: flow.description,
      appKey: flow.appKey,
      processIds: flow.processIds
    });

    // Validate processes if provided
    if (processIds && Array.isArray(processIds) && processIds.length > 0) {
      const processes = await Process.find({
        _id: { $in: processIds },
        organizationId: req.user.organizationId
      }).lean();

      if (processes.length !== processIds.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more processes not found or access denied'
        });
      }
    }

    // Update fields
    if (name !== undefined) flow.name = name;
    if (description !== undefined) flow.description = description || null;
    if (appKey !== undefined) flow.appKey = appKey;
    if (processIds !== undefined) flow.processIds = processIds;

    await flow.save();

    const populated = await BusinessFlow.findById(flow._id)
      .populate('processIds', 'name trigger status')
      .populate('createdBy', 'firstName lastName email')
      .lean();

    attachSettingsAuditDiff(res, before, cloneForAudit(populated), { body: req.body || {} });

    res.json({
      success: true,
      data: populated
    });
  } catch (error) {
    log.error('update_business_flow_error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error updating business flow',
      error: error.message
    });
  }
};

/**
 * @route   DELETE /api/admin/business-flows/:id
 * @desc    Delete business flow
 * @access  Private (admin)
 */
exports.deleteBusinessFlow = async (req, res) => {
  try {
    const flow = await BusinessFlow.findById(req.params.id);

    if (!flow) {
      return res.status(404).json({
        success: false,
        message: 'Business flow not found'
      });
    }

    if (String(flow.organizationId) !== String(req.user.organizationId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');
    const before = cloneForAudit({ name: flow.name, appKey: flow.appKey });

    await BusinessFlow.deleteOne({ _id: flow._id });

    attachSettingsAuditDiff(res, before, {}, { keys: ['name', 'appKey'] });

    res.json({
      success: true,
      message: 'Business flow deleted'
    });
  } catch (error) {
    log.error('delete_business_flow_error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error deleting business flow',
      error: error.message
    });
  }
};

/**
 * Enrich processes with causality information for timeline rendering.
 * Orders processes by trigger event type and entity lifecycle progression.
 */
async function enrichProcessesWithCausality(processes) {
  if (!Array.isArray(processes) || processes.length === 0) {
    return [];
  }

  // Sort by trigger event type priority (creation → update → status change → manual)
  const triggerPriority = {
    'record.created': 1,
    'record.updated': 2,
    'status.changed': 3,
    'stage.changed': 4,
    'manual': 5
  };

  const enriched = processes.map(p => {
    const trigger = p.trigger || {};
    const eventType = trigger.eventType || '';
    const priority = triggerPriority[eventType] || 99;

    return {
      ...p,
      _causality: {
        priority,
        triggerType: trigger.type || 'manual',
        eventType: eventType,
        entityType: inferEntityType(p) || null
      }
    };
  });

  // Sort by priority, then by name
  enriched.sort((a, b) => {
    if (a._causality.priority !== b._causality.priority) {
      return a._causality.priority - b._causality.priority;
    }
    return (a.name || '').localeCompare(b.name || '');
  });

  return enriched;
}

/**
 * Infer entity type from process nodes (field_rule, ownership_rule, status_guard).
 */
function inferEntityType(process) {
  if (!process.nodes || !Array.isArray(process.nodes)) return null;

  for (const node of process.nodes) {
    if (node.type === 'field_rule' || node.type === 'ownership_rule' || node.type === 'status_guard') {
      return node.config?.entityType || null;
    }
  }

  return null;
}

/**
 * @route   GET /api/admin/business-flows/:id/health
 * @desc    Get flow health summary with metrics
 * @access  Private (admin)
 */
exports.getFlowHealth = async (req, res) => {
  try {
    const flowId = req.params.id;
    const days = parseInt(req.query.days) || 30;

    const result = await flowHealthAnalytics.getFlowHealthSummary(
      flowId,
      req.user.organizationId,
      { days }
    );

    if (!result.ok) {
      return res.status(404).json({
        success: false,
        message: result.error || 'Flow not found'
      });
    }

    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    log.error('get_flow_health_error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error fetching flow health',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/admin/business-flows/:id/metrics
 * @desc    Get per-process metrics for a flow
 * @access  Private (admin)
 */
exports.getFlowMetrics = async (req, res) => {
  try {
    const flowId = req.params.id;
    const days = parseInt(req.query.days) || 30;

    const result = await flowHealthAnalytics.getProcessMetrics(
      flowId,
      req.user.organizationId,
      { days }
    );

    if (!result.ok) {
      return res.status(404).json({
        success: false,
        message: result.error || 'Flow not found'
      });
    }

    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    log.error('get_flow_metrics_error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error fetching flow metrics',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/admin/business-flows/:id/bottlenecks
 * @desc    Detect bottlenecks in a flow
 * @access  Private (admin)
 */
exports.getFlowBottlenecks = async (req, res) => {
  try {
    const flowId = req.params.id;
    const days = parseInt(req.query.days) || 30;

    const result = await flowHealthAnalytics.detectBottlenecks(
      flowId,
      req.user.organizationId,
      { days }
    );

    if (!result.ok) {
      return res.status(404).json({
        success: false,
        message: result.error || 'Flow not found'
      });
    }

    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    log.error('get_flow_bottlenecks_error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error detecting bottlenecks',
      error: error.message
    });
  }
};
