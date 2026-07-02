'use strict';

const mongoose = require('mongoose');
const MarketingAudience = require('../models/MarketingAudience');
const { runWithOrganizationTenantContext } = require('../utils/runWithOrganizationTenant');
const audienceService = require('../services/marketing/marketingAudienceService');
const segmentQueryService = require('../services/marketing/marketingSegmentQueryService');

const AUDIENCE_UPDATE_FIELDS = ['name', 'description', 'type', 'segmentId'];

function parseObjectId(value, label = 'id') {
  if (value === null || value === '') return { id: null };
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return { error: `${label} is invalid` };
  }
  return { id: new mongoose.Types.ObjectId(String(value)) };
}

async function loadAudienceOr404(organizationId, audienceId) {
  return audienceService.loadAudience(organizationId, audienceId);
}

function buildAudienceUpdatePayload(body = {}) {
  /** @type {Record<string, unknown>} */
  const update = {};

  for (const field of AUDIENCE_UPDATE_FIELDS) {
    if (body[field] === undefined) continue;

    if (field === 'segmentId') {
      if (body[field] === null || body[field] === '') {
        update.segmentId = null;
        continue;
      }
      const parsed = parseObjectId(body[field], field);
      if (parsed.error) return { error: parsed.error };
      update[field] = parsed.id;
      continue;
    }

    if (field === 'type') {
      const type = String(body[field]).trim().toLowerCase();
      if (!['static', 'dynamic'].includes(type)) {
        return { error: 'type must be static or dynamic' };
      }
      update.type = type;
      continue;
    }

    update[field] = String(body[field]).trim();
  }

  return { update };
}

/**
 * GET /api/marketing/audiences
 */
exports.listAudiences = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
    const skip = (page - 1) * limit;
    const search = String(req.query.search || '').trim();
    const type = String(req.query.type || '').trim();

    const filter = { organizationId };
    if (type) filter.type = type;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const result = await runWithOrganizationTenantContext(organizationId, async () => {
      const [items, total] = await Promise.all([
        MarketingAudience.find(filter)
          .sort({ updatedAt: -1 })
          .skip(skip)
          .limit(limit)
          .select('name description type segmentId memberCount updatedAt createdAt')
          .lean(),
        MarketingAudience.countDocuments(filter)
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

/**
 * POST /api/marketing/audiences
 */
exports.createAudience = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const name = String(req.body?.name || '').trim();
    if (!name) {
      return res.status(400).json({ success: false, message: 'Audience name is required' });
    }

    const payloadResult = buildAudienceUpdatePayload(req.body);
    if (payloadResult.error) {
      return res.status(400).json({ success: false, message: payloadResult.error });
    }

    const audienceType = payloadResult.update.type ?? 'static';
    if (audienceType === 'dynamic' && !payloadResult.update.segmentId) {
      return res.status(400).json({
        success: false,
        message: 'Dynamic audiences require a segmentId'
      });
    }

    const doc = await runWithOrganizationTenantContext(organizationId, async () =>
      MarketingAudience.create({
        organizationId,
        name,
        description: payloadResult.update.description ?? String(req.body?.description || '').trim(),
        type: audienceType,
        segmentId: payloadResult.update.segmentId ?? null,
        createdByUserId: req.user._id
      })
    );

    if (doc.type === 'dynamic') {
      await audienceService.syncDynamicAudienceFromSegment(doc);
    }

    return res.status(201).json({ success: true, data: doc.toObject() });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/marketing/audiences/:id
 */
exports.getAudience = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const parsed = parseObjectId(req.params.id, 'Audience id');
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    const doc = await runWithOrganizationTenantContext(organizationId, async () =>
      MarketingAudience.findOne({ _id: parsed.id, organizationId }).lean()
    );

    if (!doc) {
      return res.status(404).json({ success: false, message: 'Audience not found' });
    }

    return res.json({ success: true, data: doc });
  } catch (err) {
    return next(err);
  }
};

/**
 * PUT /api/marketing/audiences/:id
 */
exports.updateAudience = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const parsed = parseObjectId(req.params.id, 'Audience id');
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    const audience = await loadAudienceOr404(organizationId, parsed.id);
    if (!audience) {
      return res.status(404).json({ success: false, message: 'Audience not found' });
    }

    const payloadResult = buildAudienceUpdatePayload(req.body);
    if (payloadResult.error) {
      return res.status(400).json({ success: false, message: payloadResult.error });
    }

    if (req.body?.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) {
        return res.status(400).json({ success: false, message: 'Audience name is required' });
      }
      payloadResult.update.name = name;
    }

    if (Object.keys(payloadResult.update).length === 0) {
      return res.json({ success: true, data: audience.toObject() });
    }

    const nextType = payloadResult.update.type ?? audience.type;
    const nextSegmentId =
      payloadResult.update.segmentId !== undefined
        ? payloadResult.update.segmentId
        : audience.segmentId;
    if (nextType === 'dynamic' && !nextSegmentId) {
      return res.status(400).json({
        success: false,
        message: 'Dynamic audiences require a segmentId'
      });
    }

    Object.assign(audience, payloadResult.update);
    await audience.save();

    if (audience.type === 'dynamic') {
      await audienceService.syncDynamicAudienceFromSegment(audience);
    }

    return res.json({ success: true, data: audience.toObject() });
  } catch (err) {
    return next(err);
  }
};

/**
 * DELETE /api/marketing/audiences/:id
 */
exports.deleteAudience = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const parsed = parseObjectId(req.params.id, 'Audience id');
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    const deleted = await runWithOrganizationTenantContext(organizationId, async () =>
      MarketingAudience.findOneAndDelete({ _id: parsed.id, organizationId })
    );

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Audience not found' });
    }

    return res.json({ success: true, message: 'Audience deleted' });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/marketing/audiences/:id/members
 */
exports.listAudienceMembers = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const parsed = parseObjectId(req.params.id, 'Audience id');
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    const audience = await loadAudienceOr404(organizationId, parsed.id);
    if (!audience) {
      return res.status(404).json({ success: false, message: 'Audience not found' });
    }

    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
    const search = String(req.query.search || '').trim();

    if (audience.type === 'dynamic') {
      if (!audience.segmentId) {
        return res.json({
          success: true,
          data: [],
          pagination: { page, limit, total: 0, totalPages: 1 }
        });
      }

      const segment = await segmentQueryService.loadSegment(organizationId, audience.segmentId);
      if (!segment) {
        return res.status(404).json({ success: false, message: 'Linked segment not found' });
      }

      const result = await segmentQueryService.querySegmentMembers(
        organizationId,
        segment.filterQuery,
        { page, limit, userId: req.user._id }
      );

      let items = result.items.map((person) => ({
        _id: person._id,
        email: person.email,
        name: [person.first_name, person.last_name].filter(Boolean).join(' '),
        source: 'segment',
        personId: person._id
      }));

      if (search) {
        const q = search.toLowerCase();
        items = items.filter(
          (item) =>
            String(item.email || '').toLowerCase().includes(q) ||
            String(item.name || '').toLowerCase().includes(q)
        );
      }

      return res.json({
        success: true,
        data: items,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages
        }
      });
    }

    const paginated = audienceService.paginateMembers(audience.members || [], {
      page,
      limit,
      search
    });

    return res.json({
      success: true,
      data: paginated.items,
      pagination: {
        page: paginated.page,
        limit: paginated.limit,
        total: paginated.total,
        totalPages: paginated.totalPages
      }
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/marketing/audiences/:id/preview
 */
exports.previewAudience = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const parsed = parseObjectId(req.params.id, 'Audience id');
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    const audience = await loadAudienceOr404(organizationId, parsed.id);
    if (!audience) {
      return res.status(404).json({ success: false, message: 'Audience not found' });
    }

    if (audience.type === 'dynamic') {
      if (!audience.segmentId) {
        return res.status(400).json({
          success: false,
          message: 'Dynamic audience has no segment configured.'
        });
      }

      const segment = await segmentQueryService.loadSegment(organizationId, audience.segmentId);
      if (!segment) {
        return res.status(404).json({ success: false, message: 'Linked segment not found' });
      }

      const sampleLimit = Math.min(
        20,
        Math.max(1, parseInt(String(req.body?.limit || '5'), 10) || 5)
      );
      const members = await segmentQueryService.querySegmentMembers(
        organizationId,
        segment.filterQuery,
        {
          page: 1,
          limit: sampleLimit,
          userId: req.user._id
        }
      );

      return res.json({
        success: true,
        data: {
          total: audience.memberCount || segment.memberCount || members.total,
          sample: members.items,
          segmentId: audience.segmentId
        }
      });
    }

    const sampleLimit = Math.min(
      20,
      Math.max(1, parseInt(String(req.body?.limit || '5'), 10) || 5)
    );
    const paginated = audienceService.paginateMembers(audience.members || [], {
      page: 1,
      limit: sampleLimit,
      search: String(req.body?.search || '').trim()
    });

    return res.json({
      success: true,
      data: {
        total: paginated.total,
        sample: paginated.items
      }
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/marketing/audiences/:id/members
 */
exports.addAudienceMembers = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const parsed = parseObjectId(req.params.id, 'Audience id');
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    const audience = await loadAudienceOr404(organizationId, parsed.id);
    if (!audience) {
      return res.status(404).json({ success: false, message: 'Audience not found' });
    }
    if (audience.type !== 'static') {
      return res.status(400).json({
        success: false,
        message: 'Members can only be added to static audiences'
      });
    }

    const members = Array.isArray(req.body?.members) ? req.body.members : [];
    if (members.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one member is required' });
    }

    const normalizedMembers = members
      .map((member) => {
        const email = audienceService.normalizeEmail(member?.email);
        if (!email) return null;
        const personParsed = member?.personId
          ? parseObjectId(member.personId, 'personId')
          : { id: null };
        if (personParsed.error) return null;
        return {
          email,
          name: member?.name ? String(member.name).trim() : '',
          personId: personParsed.id
        };
      })
      .filter(Boolean);

    if (normalizedMembers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid members provided'
      });
    }

    const result = await audienceService.addMembersToAudience({
      organizationId,
      audience,
      members: normalizedMembers
    });

    return res.json({
      success: true,
      data: result.audience.toObject(),
      stats: result.stats
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * DELETE /api/marketing/audiences/:id/members/:memberId
 */
exports.removeAudienceMember = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const parsed = parseObjectId(req.params.id, 'Audience id');
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    const audience = await loadAudienceOr404(organizationId, parsed.id);
    if (!audience) {
      return res.status(404).json({ success: false, message: 'Audience not found' });
    }

    const memberId = String(req.params.memberId || '');
    const before = audience.members.length;
    audience.members = audience.members.filter((member) => String(member._id) !== memberId);

    if (audience.members.length === before) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    await audienceService.syncMemberCount(audience);

    return res.json({ success: true, data: audience.toObject() });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/marketing/audiences/:id/import
 */
exports.importAudienceMembers = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const parsed = parseObjectId(req.params.id, 'Audience id');
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    const audience = await loadAudienceOr404(organizationId, parsed.id);
    if (!audience) {
      return res.status(404).json({ success: false, message: 'Audience not found' });
    }
    if (audience.type !== 'static') {
      return res.status(400).json({
        success: false,
        message: 'CSV import is only supported for static audiences'
      });
    }

    const csvText = req.file
      ? req.file.buffer.toString('utf8')
      : String(req.body?.csv || req.body?.content || '');

    if (!csvText.trim()) {
      return res.status(400).json({ success: false, message: 'CSV content is required' });
    }

    const parsedCsv = audienceService.parseAudienceCsv(csvText);
    if (parsedCsv.error) {
      return res.status(400).json({ success: false, message: parsedCsv.error });
    }

    const result = await audienceService.importMembersIntoAudience({
      organizationId,
      audience,
      rows: parsedCsv.rows,
      fileName: req.file?.originalname || req.body?.fileName || null,
      skipDuplicates: req.body?.skipDuplicates !== false
    });

    return res.json({
      success: true,
      data: result.audience.toObject(),
      stats: result.stats
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/marketing/audiences/:id/export
 */
exports.exportAudienceMembers = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const parsed = parseObjectId(req.params.id, 'Audience id');
    if (parsed.error) {
      return res.status(400).json({ success: false, message: parsed.error });
    }

    const audience = await loadAudienceOr404(organizationId, parsed.id);
    if (!audience) {
      return res.status(404).json({ success: false, message: 'Audience not found' });
    }

    const fileName = `${String(audience.name || 'audience')
      .trim()
      .replace(/[^\w.-]+/g, '_')
      .slice(0, 80) || 'audience'}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(audienceService.buildAudienceExportCsv(audience));
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/marketing/audiences/check-duplicates
 */
exports.checkAudienceDuplicates = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId;
    const emails = Array.isArray(req.body?.emails) ? req.body.emails : [];
    const audienceParsed = req.body?.audienceId
      ? parseObjectId(req.body.audienceId, 'audienceId')
      : { id: null };

    if (audienceParsed.error) {
      return res.status(400).json({ success: false, message: audienceParsed.error });
    }

    const result = await audienceService.checkDuplicateEmails(
      organizationId,
      emails,
      audienceParsed.id
    );

    return res.json({ success: true, data: result });
  } catch (err) {
    return next(err);
  }
};
