'use strict';

const mongoose = require('mongoose');
const MarketingSegment = require('../models/MarketingSegment');
const { runWithOrganizationTenantContext } = require('../utils/runWithOrganizationTenant');
const segmentQueryService = require('../services/marketing/marketingSegmentQueryService');
const metadataService = require('../services/marketing/marketingAudienceMetadataService');
const { validateFilterQuery } = require('../services/marketing/marketingAudienceAstValidator');
const { explainFilterQuery } = require('../services/marketing/marketingAudienceExplainService');
const { buildAudiencePreviewInsights } = require('../services/marketing/marketingAudiencePreviewService');
const { getAstVersion, getPrimaryEntity } = require('../services/marketing/marketingAudienceAstUtils');

const SEGMENT_UPDATE_FIELDS = ['name', 'description', 'filterQuery', 'primaryEntity'];

function parseObjectId(value, label = 'id') {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return { error: `${label} is invalid` };
  }
  return { id: new mongoose.Types.ObjectId(String(value)) };
}

function buildSegmentUpdatePayload(body = {}) {
  /** @type {Record<string, unknown>} */
  const update = {};

  for (const field of SEGMENT_UPDATE_FIELDS) {
    if (body[field] === undefined) continue;

    if (field === 'filterQuery') {
      if (body[field] === null) {
        update.filterQuery = null;
        continue;
      }
      update.filterQuery = segmentQueryService.normalizeFilterAst(body[field]);
      continue;
    }

    if (field === 'primaryEntity') {
      if (body[field] == null) continue;
      update.primaryEntity = {
        appKey: String(body[field].appKey || 'sales').toLowerCase(),
        moduleKey: String(body[field].moduleKey || 'people').toLowerCase()
      };
      continue;
    }

    update[field] = String(body[field]).trim();
  }

  return { update };
}

function segmentContext(req) {
  return { userId: req.user?._id };
}

async function validateSegmentFilterQuery(organizationId, filterQuery, primaryEntity) {
  const ast = segmentQueryService.normalizeFilterAst(filterQuery);
  if (!ast) return { error: 'filterQuery is required' };

  const payload =
    getAstVersion(ast) >= 2
      ? ast
      : {
          version: 2,
          primaryEntity: primaryEntity || { appKey: 'sales', moduleKey: 'people' },
          logic: String(ast.logic || 'AND').toUpperCase() === 'OR' ? 'OR' : 'AND',
          children: (ast.children || []).map((child) => ({
            type: 'field',
            moduleKey: primaryEntity?.moduleKey || 'people',
            fieldKey: child.fieldKey,
            operator: child.operator,
            value: child.value
          }))
        };

  return validateFilterQuery(organizationId, payload);
}

exports.getSegmentMetadata = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const data = await runWithOrganizationTenantContext(organizationId, async () =>
      metadataService.getMarketingAudienceMetadata(organizationId, {
        primaryModuleKey: req.query.primaryModuleKey
      })
    );
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

exports.getSegmentFieldOptions = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const moduleKey = String(req.query.moduleKey || '').trim().toLowerCase();
    const fieldKey = String(req.query.fieldKey || '').trim();
    if (!moduleKey || !fieldKey) {
      return res.status(400).json({ success: false, message: 'moduleKey and fieldKey are required' });
    }

    const field = await runWithOrganizationTenantContext(organizationId, async () =>
      metadataService.getModuleFieldFilterOptions(organizationId, moduleKey, fieldKey)
    );

    if (!field) {
      return res.status(404).json({ success: false, message: 'Field not found' });
    }

    return res.json({
      success: true,
      data: {
        key: field.key,
        label: field.label,
        filterType: field.filterType,
        options: field.options || []
      }
    });
  } catch (err) {
    return next(err);
  }
};

exports.explainSegmentFilter = async (req, res, next) => {
  try {
    const ast = segmentQueryService.normalizeFilterAst(req.body?.filterQuery);
    if (!ast) {
      return res.status(400).json({ success: false, message: 'filterQuery is required' });
    }
    const explained = explainFilterQuery(ast);
    return res.json({ success: true, data: explained });
  } catch (err) {
    return next(err);
  }
};

exports.listSegments = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
    const skip = (page - 1) * limit;
    const search = String(req.query.search || '').trim();

    const filter = { organizationId };
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const result = await runWithOrganizationTenantContext(organizationId, async () => {
      const [items, total] = await Promise.all([
        MarketingSegment.find(filter)
          .sort({ updatedAt: -1 })
          .skip(skip)
          .limit(limit)
          .select('name description memberCount lastRefreshedAt updatedAt createdAt refreshError')
          .lean(),
        MarketingSegment.countDocuments(filter)
      ]);
      return { items, total };
    });

    return res.json({
      success: true,
      data: result.items,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / limit))
      }
    });
  } catch (err) {
    return next(err);
  }
};

exports.createSegment = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const name = String(req.body?.name || '').trim();
    if (!name) {
      return res.status(400).json({ success: false, message: 'Segment name is required' });
    }

    const payloadResult = buildSegmentUpdatePayload(req.body);
    if (payloadResult.error) {
      return res.status(400).json({ success: false, message: payloadResult.error });
    }
    if (!payloadResult.update.filterQuery) {
      return res.status(400).json({ success: false, message: 'filterQuery is required' });
    }

    const validation = await validateSegmentFilterQuery(
      organizationId,
      payloadResult.update.filterQuery,
      payloadResult.update.primaryEntity || req.body?.primaryEntity
    );
    if (validation.error) {
      return res.status(400).json({ success: false, message: validation.error });
    }

    if (getAstVersion(payloadResult.update.filterQuery) < 2) {
      payloadResult.update.filterQuery = {
        version: 2,
        primaryEntity: payloadResult.update.primaryEntity || { appKey: 'sales', moduleKey: 'people' },
        logic: String(payloadResult.update.filterQuery.logic || 'AND').toUpperCase() === 'OR' ? 'OR' : 'AND',
        children: (payloadResult.update.filterQuery.children || []).map((child) => ({
          type: 'field',
          moduleKey: (payloadResult.update.primaryEntity || { moduleKey: 'people' }).moduleKey,
          fieldKey: child.fieldKey,
          operator: child.operator,
          value: child.value
        }))
      };
    }

    const doc = await runWithOrganizationTenantContext(organizationId, async () =>
      MarketingSegment.create({
        organizationId,
        name,
        description: payloadResult.update.description ?? String(req.body?.description || '').trim(),
        primaryEntity:
          payloadResult.update.primaryEntity ||
          getPrimaryEntity(payloadResult.update.filterQuery),
        filterQuery: payloadResult.update.filterQuery,
        filterQueryVersion: getAstVersion(payloadResult.update.filterQuery),
        explainSummary: explainFilterQuery(payloadResult.update.filterQuery).summary,
        createdByUserId: req.user._id
      })
    );

    await segmentQueryService.refreshSegmentMemberCount(doc, segmentContext(req));

    return res.status(201).json({ success: true, data: doc.toObject() });
  } catch (err) {
    return next(err);
  }
};

exports.getSegment = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const parsed = parseObjectId(req.params.id, 'Segment id');
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    const doc = await runWithOrganizationTenantContext(organizationId, async () =>
      MarketingSegment.findOne({ _id: parsed.id, organizationId }).lean()
    );

    if (!doc) {
      return res.status(404).json({ success: false, message: 'Segment not found' });
    }

    return res.json({ success: true, data: doc });
  } catch (err) {
    return next(err);
  }
};

exports.updateSegment = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const parsed = parseObjectId(req.params.id, 'Segment id');
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    const segment = await segmentQueryService.loadSegment(organizationId, parsed.id);
    if (!segment) {
      return res.status(404).json({ success: false, message: 'Segment not found' });
    }

    const payloadResult = buildSegmentUpdatePayload(req.body);
    if (payloadResult.error) {
      return res.status(400).json({ success: false, message: payloadResult.error });
    }

    if (req.body?.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) {
        return res.status(400).json({ success: false, message: 'Segment name is required' });
      }
      payloadResult.update.name = name;
    }

    if (Object.keys(payloadResult.update).length === 0) {
      return res.json({ success: true, data: segment.toObject() });
    }

    if (payloadResult.update.filterQuery) {
      const validation = await validateSegmentFilterQuery(
        organizationId,
        payloadResult.update.filterQuery,
        payloadResult.update.primaryEntity || segment.primaryEntity
      );
      if (validation.error) {
        return res.status(400).json({ success: false, message: validation.error });
      }
      if (getAstVersion(payloadResult.update.filterQuery) < 2) {
        payloadResult.update.filterQuery = {
          version: 2,
          primaryEntity: payloadResult.update.primaryEntity || segment.primaryEntity || {
            appKey: 'sales',
            moduleKey: 'people'
          },
          logic:
            String(payloadResult.update.filterQuery.logic || 'AND').toUpperCase() === 'OR'
              ? 'OR'
              : 'AND',
          children: (payloadResult.update.filterQuery.children || []).map((child) => ({
            type: 'field',
            moduleKey: (payloadResult.update.primaryEntity || segment.primaryEntity || { moduleKey: 'people' })
              .moduleKey,
            fieldKey: child.fieldKey,
            operator: child.operator,
            value: child.value
          }))
        };
      }
      payloadResult.update.filterQueryVersion = getAstVersion(payloadResult.update.filterQuery);
      payloadResult.update.explainSummary = explainFilterQuery(payloadResult.update.filterQuery).summary;
    }

    Object.assign(segment, payloadResult.update);
    await segment.save();

    if (payloadResult.update.filterQuery !== undefined) {
      await segmentQueryService.refreshSegmentMemberCount(segment, segmentContext(req));
    }

    return res.json({ success: true, data: segment.toObject() });
  } catch (err) {
    return next(err);
  }
};

exports.deleteSegment = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const parsed = parseObjectId(req.params.id, 'Segment id');
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    const deleted = await runWithOrganizationTenantContext(organizationId, async () =>
      MarketingSegment.findOneAndDelete({ _id: parsed.id, organizationId })
    );

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Segment not found' });
    }

    return res.json({ success: true, message: 'Segment deleted' });
  } catch (err) {
    return next(err);
  }
};

exports.previewSegmentFilter = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const ast = segmentQueryService.normalizeFilterAst(req.body?.filterQuery);
    if (!ast) {
      return res.status(400).json({ success: false, message: 'filterQuery is required' });
    }

    const validation = await validateSegmentFilterQuery(
      organizationId,
      ast,
      req.body?.primaryEntity
    );
    if (validation.error) {
      return res.status(400).json({ success: false, message: validation.error });
    }

    const insights = await buildAudiencePreviewInsights(
      organizationId,
      ast,
      segmentContext(req),
      { limit: req.body?.limit }
    );

    return res.json({
      success: true,
      data: {
        total: insights.totalMatches,
        totalMatches: insights.totalMatches,
        reachableRecipients: insights.reachableRecipients,
        missingEmail: insights.missingEmail,
        suppressed: insights.suppressed,
        duplicateEmails: insights.duplicateEmails,
        sample: insights.sample,
        breakdown: insights.breakdown,
        refreshedAt: insights.refreshedAt
      }
    });
  } catch (err) {
    return next(err);
  }
};

exports.previewSegment = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const parsed = parseObjectId(req.params.id, 'Segment id');
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    const segment = await segmentQueryService.loadSegment(organizationId, parsed.id);
    if (!segment) {
      return res.status(404).json({ success: false, message: 'Segment not found' });
    }

    const insights = await buildAudiencePreviewInsights(
      organizationId,
      segment.filterQuery,
      segmentContext(req),
      { limit: req.body?.limit }
    );

    return res.json({
      success: true,
      data: {
        total: segment.memberCount || insights.totalMatches,
        totalMatches: insights.totalMatches,
        reachableRecipients: insights.reachableRecipients,
        missingEmail: insights.missingEmail,
        suppressed: insights.suppressed,
        duplicateEmails: insights.duplicateEmails,
        sample: insights.sample,
        breakdown: insights.breakdown,
        lastRefreshedAt: segment.lastRefreshedAt,
        refreshedAt: insights.refreshedAt
      }
    });
  } catch (err) {
    return next(err);
  }
};

exports.listSegmentMembers = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const parsed = parseObjectId(req.params.id, 'Segment id');
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    const segment = await segmentQueryService.loadSegment(organizationId, parsed.id);
    if (!segment) {
      return res.status(404).json({ success: false, message: 'Segment not found' });
    }

    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));

    const result = await segmentQueryService.querySegmentMembers(
      organizationId,
      segment.filterQuery,
      {
        page,
        limit,
        userId: req.user._id
      }
    );

    return res.json({
      success: true,
      data: result.items,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages
      }
    });
  } catch (err) {
    return next(err);
  }
};

exports.refreshSegment = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const parsed = parseObjectId(req.params.id, 'Segment id');
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    const segment = await segmentQueryService.loadSegment(organizationId, parsed.id);
    if (!segment) {
      return res.status(404).json({ success: false, message: 'Segment not found' });
    }

    await segmentQueryService.refreshSegmentMemberCount(segment, segmentContext(req));

    return res.json({ success: true, data: segment.toObject() });
  } catch (err) {
    return next(err);
  }
};
