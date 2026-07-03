const AnalyticsWidget = require('../models/AnalyticsWidget');
const AnalyticsReport = require('../models/AnalyticsReport');
const { runAnalyticsReportWithLogging, resolveWidgetBoundReport } = require('../services/analytics/analyticsExecutionService');
const { ANALYTICS_WIDGET_TEMPLATES } = require('../constants/analyticsWidgetTemplates');
const { buildOrgPermissionContext } = require('../services/runtimePermissionResolver');
const { assertCanEditCertifiedAsset, canCertifyAnalyticsAssets } = require('../services/analytics/analyticsCertificationService');
const { recordWidgetView } = require('../services/analytics/analyticsUsageService');
const { evaluateAlertsForWidgetExecution } = require('../services/analytics/analyticsAlertEvaluator');

function slugifyApiName(name) {
  return String(name || 'widget')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80);
}

async function ensureUniqueWidgetApiName(organizationId, apiName, excludeId = null) {
  const query = { organizationId, apiName, status: { $ne: 'archived' } };
  if (excludeId) query._id = { $ne: excludeId };
  const existing = await AnalyticsWidget.findOne(query).select('_id').lean();
  if (existing) {
    const err = new Error('apiName already exists for this organization');
    err.code = 'DUPLICATE_API_NAME';
    err.statusCode = 409;
    throw err;
  }
}

function handleError(res, error, fallbackMessage) {
  const status =
    error.statusCode ||
    (error.code === 'CERTIFIED_ASSET_LOCKED' ? 403 : null) ||
    (error.code === 'DUPLICATE_API_NAME' ? 409 : 400);
  console.error(fallbackMessage, error);
  return res.status(status).json({
    success: false,
    message: error.message || fallbackMessage,
    code: error.code,
  });
}

function buildExecutionContext(req, body = {}) {
  return {
    user: req.user,
    organizationId: req.user.organizationId,
    orgContext: req.organization ? buildOrgPermissionContext(req.organization) : undefined,
    runtimeFilters: body.runtimeFilters,
    rowLimit: body.rowLimit,
    preview: body.preview === true,
  };
}

async function resolveBoundReport(widget, organizationId) {
  return resolveWidgetBoundReport(widget, organizationId);
}

async function adjustReportWidgetCount(reportId, organizationId, delta) {
  if (!reportId || !delta) return;
  await AnalyticsReport.updateOne(
    { _id: reportId, organizationId },
    { $inc: { widgetCount: delta } }
  );
}

async function listWidgets(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const query = { organizationId };

    if (req.query.status) query.status = req.query.status;
    if (req.query.chartType) query.chartType = req.query.chartType;
    if (req.query.category) query.category = req.query.category;
    if (req.query.reportId) query.reportId = req.query.reportId;
    if (req.query.mine === 'true') query.ownerId = req.user._id;

    if (req.query.search) {
      const regex = new RegExp(String(req.query.search), 'i');
      query.$or = [{ name: regex }, { apiName: regex }, { tags: regex }];
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      AnalyticsWidget.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('reportId', 'name apiName status primaryModule type')
        .populate('ownerId', 'firstName lastName email')
        .lean(),
      AnalyticsWidget.countDocuments(query),
    ]);

    return res.json({
      success: true,
      data,
      meta: { page, perPage: limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return handleError(res, error, 'Error fetching analytics widgets');
  }
}

async function createWidget(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const name = String(req.body?.name || '').trim();
    if (!name) {
      return res.status(400).json({ success: false, message: 'name is required' });
    }
    if (!req.body?.reportId) {
      return res.status(400).json({ success: false, message: 'reportId is required' });
    }

    const report = await AnalyticsReport.findOne({
      _id: req.body.reportId,
      organizationId,
    }).select('_id apiName status version').lean();

    if (!report) {
      return res.status(404).json({ success: false, message: 'Bound report not found' });
    }

    const apiName = String(req.body?.apiName || slugifyApiName(name)).trim();
    await ensureUniqueWidgetApiName(organizationId, apiName);

    const widget = await AnalyticsWidget.create({
      ...req.body,
      name,
      apiName,
      organizationId,
      ownerId: req.user._id,
      createdBy: req.user._id,
      status: 'draft',
      version: 1,
      reportApiName: report.apiName,
      reportVersion: report.status === 'published' ? report.version : null,
      columnMapping: req.body?.columnMapping || {},
    });

    await adjustReportWidgetCount(report._id, organizationId, 1);

    const populated = await AnalyticsWidget.findById(widget._id)
      .populate('reportId', 'name apiName status primaryModule type')
      .populate('ownerId', 'firstName lastName email');

    return res.status(201).json({ success: true, data: populated });
  } catch (error) {
    return handleError(res, error, 'Error creating analytics widget');
  }
}

async function getWidgetById(req, res) {
  try {
    const widget = await AnalyticsWidget.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    })
      .populate('reportId', 'name apiName status primaryModule type version')
      .populate('ownerId', 'firstName lastName email');

    if (!widget) {
      return res.status(404).json({ success: false, message: 'Widget not found' });
    }

    recordWidgetView(widget._id, req.user.organizationId, req.user._id).catch(() => {});

    return res.json({ success: true, data: widget });
  } catch (error) {
    return handleError(res, error, 'Error fetching analytics widget');
  }
}

async function updateWidget(req, res) {
  try {
    const widget = await AnalyticsWidget.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    });

    if (!widget) {
      return res.status(404).json({ success: false, message: 'Widget not found' });
    }

    if (widget.status === 'archived') {
      return res.status(400).json({ success: false, message: 'Archived widgets cannot be edited' });
    }

    assertCanEditCertifiedAsset(req.user, widget);

    const previousReportId = String(widget.reportId);
    const blocked = [
      '_id',
      'organizationId',
      'createdBy',
      'createdAt',
      'dashboardCount',
      'certified',
      'certifiedBy',
      'certifiedAt',
      'viewCount',
      'lastViewedAt',
    ];
    for (const [key, value] of Object.entries(req.body || {})) {
      if (!blocked.includes(key)) {
        widget[key] = value;
      }
    }

    if (req.body?.apiName && req.body.apiName !== widget.apiName) {
      await ensureUniqueWidgetApiName(req.user.organizationId, req.body.apiName, widget._id);
      widget.apiName = req.body.apiName;
    }

    if (req.body?.reportId && String(req.body.reportId) !== previousReportId) {
      const report = await AnalyticsReport.findOne({
        _id: req.body.reportId,
        organizationId: req.user.organizationId,
      }).select('_id apiName status version').lean();
      if (!report) {
        return res.status(404).json({ success: false, message: 'Bound report not found' });
      }
      widget.reportApiName = report.apiName;
      widget.reportVersion = report.status === 'published' ? report.version : null;
      await adjustReportWidgetCount(previousReportId, req.user.organizationId, -1);
      await adjustReportWidgetCount(report._id, req.user.organizationId, 1);
    }

    widget.updatedBy = req.user._id;
    await widget.save();

    const updated = await AnalyticsWidget.findById(widget._id)
      .populate('reportId', 'name apiName status primaryModule type')
      .populate('ownerId', 'firstName lastName email');

    return res.json({ success: true, data: updated });
  } catch (error) {
    return handleError(res, error, 'Error updating analytics widget');
  }
}

async function deleteWidget(req, res) {
  try {
    const widget = await AnalyticsWidget.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    });

    if (!widget) {
      return res.status(404).json({ success: false, message: 'Widget not found' });
    }

    assertCanEditCertifiedAsset(req.user, widget);

    if (widget.dashboardCount > 0) {
      return res.status(409).json({
        success: false,
        message: 'Widget is referenced by dashboards and cannot be archived',
        code: 'WIDGET_IN_USE',
      });
    }

    widget.status = 'archived';
    widget.archivedAt = new Date();
    widget.updatedBy = req.user._id;
    await widget.save();
    await adjustReportWidgetCount(widget.reportId, req.user.organizationId, -1);

    return res.json({ success: true, message: 'Widget archived' });
  } catch (error) {
    return handleError(res, error, 'Error archiving analytics widget');
  }
}

async function publishWidget(req, res) {
  try {
    const widget = await AnalyticsWidget.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    });

    if (!widget) {
      return res.status(404).json({ success: false, message: 'Widget not found' });
    }

    const report = await resolveBoundReport(widget, req.user.organizationId);
    if (!report || report.status !== 'published') {
      return res.status(400).json({
        success: false,
        message: 'Widget requires a published report before publishing',
        code: 'REPORT_NOT_PUBLISHED',
      });
    }

    widget.status = 'published';
    widget.version = widget.publishedAt ? (widget.version || 1) + 1 : 1;
    widget.publishedAt = new Date();
    widget.reportVersion = report.version;
    widget.reportApiName = report.apiName;
    widget.updatedBy = req.user._id;
    await widget.save();

    return res.json({ success: true, data: widget });
  } catch (error) {
    return handleError(res, error, 'Error publishing analytics widget');
  }
}

async function executeWidget(req, res) {
  try {
    const widget = await AnalyticsWidget.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    }).lean();

    if (!widget) {
      return res.status(404).json({ success: false, message: 'Widget not found' });
    }

    const body = req.body || {};
    const preview = body.preview === true;
    if (widget.status !== 'published' && !preview) {
      return res.status(400).json({
        success: false,
        message: 'Only published widgets can be executed. Use preview: true for drafts.',
        code: 'WIDGET_NOT_PUBLISHED',
      });
    }

    const report = await resolveBoundReport(widget, req.user.organizationId);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Bound report not found' });
    }

    if (report.status !== 'published' && !preview) {
      return res.status(400).json({
        success: false,
        message: 'Bound report must be published',
        code: 'REPORT_NOT_PUBLISHED',
      });
    }

    const context = buildExecutionContext(req, {
      ...body,
      runtimeFilters: body.runtimeFilters || widget.filterOverrides || null,
    });

    const { result } = await runAnalyticsReportWithLogging(report, context);

    evaluateAlertsForWidgetExecution({
      organizationId: req.user.organizationId,
      widget,
      result,
    }).catch((err) => console.error('[analyticsAlertEvaluator]', err));

    return res.json({
      success: true,
      data: {
        widgetId: widget._id,
        name: widget.name,
        chartType: widget.chartType,
        columnMapping: widget.columnMapping,
        thresholds: widget.thresholds,
        kpiValueField: widget.kpiValueField,
        kpiLabel: widget.kpiLabel,
        kpiPrefix: widget.kpiPrefix,
        kpiSuffix: widget.kpiSuffix,
        result,
      },
    });
  } catch (error) {
    const status = error.statusCode || (error.code === 'FORBIDDEN' ? 403 : 400);
    return res.status(status).json({
      success: false,
      message: error.message || 'Error executing widget',
      code: error.code,
    });
  }
}

async function duplicateWidget(req, res) {
  try {
    const source = await AnalyticsWidget.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    }).lean();

    if (!source) {
      return res.status(404).json({ success: false, message: 'Widget not found' });
    }

    const {
      _id,
      __v,
      createdAt,
      updatedAt,
      publishedAt,
      archivedAt,
      dashboardCount,
      certified,
      certifiedBy,
      certifiedAt,
      ...rest
    } = source;

    const copyName = `${source.name} (Copy)`;
    let apiName = slugifyApiName(`${source.apiName}_copy`);
    let suffix = 1;
    while (suffix < 50) {
      try {
        await ensureUniqueWidgetApiName(req.user.organizationId, apiName);
        break;
      } catch (err) {
        if (err.code !== 'DUPLICATE_API_NAME') throw err;
        suffix += 1;
        apiName = slugifyApiName(`${source.apiName}_copy_${suffix}`);
      }
    }

    const widget = await AnalyticsWidget.create({
      ...rest,
      name: copyName,
      apiName,
      status: 'draft',
      version: 1,
      publishedAt: null,
      archivedAt: null,
      ownerId: req.user._id,
      createdBy: req.user._id,
      updatedBy: null,
      dashboardCount: 0,
      certified: false,
      certifiedBy: null,
      certifiedAt: null,
    });

    await adjustReportWidgetCount(source.reportId, req.user.organizationId, 1);

    const populated = await AnalyticsWidget.findById(widget._id)
      .populate('reportId', 'name apiName status primaryModule type')
      .populate('ownerId', 'firstName lastName email');

    return res.status(201).json({ success: true, data: populated });
  } catch (error) {
    return handleError(res, error, 'Error duplicating analytics widget');
  }
}

async function getWidgetTemplates(req, res) {
  try {
    return res.json({ success: true, data: ANALYTICS_WIDGET_TEMPLATES });
  } catch (error) {
    return handleError(res, error, 'Error fetching widget templates');
  }
}

async function certifyWidget(req, res) {
  try {
    if (!canCertifyAnalyticsAssets(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Analytics admin permission required to certify widgets',
        code: 'CERTIFY_FORBIDDEN',
      });
    }

    const widget = await AnalyticsWidget.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    });

    if (!widget) {
      return res.status(404).json({ success: false, message: 'Widget not found' });
    }

    if (widget.status !== 'published') {
      return res.status(400).json({ success: false, message: 'Only published widgets can be certified' });
    }

    widget.certified = true;
    widget.certifiedBy = req.user._id;
    widget.certifiedAt = new Date();
    widget.updatedBy = req.user._id;
    await widget.save();

    return res.json({ success: true, data: widget });
  } catch (error) {
    return handleError(res, error, 'Error certifying analytics widget');
  }
}

async function uncertifyWidget(req, res) {
  try {
    if (!canCertifyAnalyticsAssets(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Analytics admin permission required to uncertify widgets',
        code: 'CERTIFY_FORBIDDEN',
      });
    }

    const widget = await AnalyticsWidget.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    });

    if (!widget) {
      return res.status(404).json({ success: false, message: 'Widget not found' });
    }

    widget.certified = false;
    widget.certifiedBy = null;
    widget.certifiedAt = null;
    widget.updatedBy = req.user._id;
    await widget.save();

    return res.json({ success: true, data: widget });
  } catch (error) {
    return handleError(res, error, 'Error uncertifying analytics widget');
  }
}

module.exports = {
  listWidgets,
  createWidget,
  getWidgetById,
  updateWidget,
  deleteWidget,
  publishWidget,
  executeWidget,
  duplicateWidget,
  getWidgetTemplates,
  certifyWidget,
  uncertifyWidget,
};
