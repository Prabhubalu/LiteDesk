'use strict';

const BusinessHourSet = require('../models/BusinessHourSet');
const HolidayCalendar = require('../models/HolidayCalendar');
const Group = require('../models/Group');
const {
  validateBusinessHourSetInput
} = require('../utils/businessHoursValidation');
const { normalizeBusinessHourSetBody } = require('../utils/businessHoursNormalize');
const { buildDefaultWeek } = require('../constants/businessHoursDefaults');
const {
  simulate,
  formatScheduleSummary
} = require('../services/businessHoursEngine');
const {
  resolveBusinessSchedule,
  loadSetById,
  enrichSetWithHolidays,
  ensureDefaultCompanySet
} = require('../services/businessHoursResolveService');
const Organization = require('../models/Organization');
const {
  canManageBusinessHourSets,
  canEditPersonalSchedule
} = require('../middleware/businessHoursAccess');
const BusinessHoursDailyKpi = require('../models/BusinessHoursDailyKpi');
const { aggregateBusinessHoursKpiForDay } = require('../services/businessHoursKpiAggregatorService');
const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');

function handleError(res, error, fallbackMessage) {
  console.error(fallbackMessage, error);
  if (error.name === 'ValidationError') {
    return res.status(400).json({ success: false, message: error.message });
  }
  return res.status(500).json({ success: false, message: fallbackMessage, error: error.message });
}

function snapshotBusinessHourSet(doc) {
  const o = doc && typeof doc.toObject === 'function' ? doc.toObject() : doc || {};
  return cloneForAudit({
    name: o.name ?? null,
    timezone: o.timezone ?? null,
    week: o.week ?? null,
    holidayCalendarId: o.holidayCalendarId ? String(o.holidayCalendarId) : null,
    overtimeAllowed: o.overtimeAllowed === true,
    status: o.status ?? null,
    isDefault: o.isDefault === true,
    effectiveFrom: o.effectiveFrom ?? null,
    effectiveTo: o.effectiveTo ?? null,
    linkedTo: o.linkedTo
      ? {
          type: o.linkedTo.type ?? null,
          id: o.linkedTo.id ? String(o.linkedTo.id) : null
        }
      : null
  });
}

async function populateHolidayName(doc) {
  if (!doc?.holidayCalendarId) return doc;
  const cal = await HolidayCalendar.findById(doc.holidayCalendarId).select('name').lean();
  return {
    ...doc,
    holidayCalendarName: cal?.name || null
  };
}

exports.listSets = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const query = { organizationId };

    if (req.query.scope) query['linkedTo.type'] = req.query.scope;
    if (req.query.status) query.status = req.query.status;

    const defaultCount = await BusinessHourSet.countDocuments({
      organizationId,
      isDefault: true
    });
    if (defaultCount === 0 && canManageBusinessHourSets(req.user)) {
      const org = await Organization.findById(organizationId).select('settings.timeZone').lean();
      const tz = org?.settings?.timeZone || 'UTC';
      await ensureDefaultCompanySet(organizationId, tz, req.user._id);
    }

    const sets = await BusinessHourSet.find(query)
      .sort({ isDefault: -1, name: 1 })
      .lean();

    const enriched = await Promise.all(
      sets.map(async (row) => ({
        ...await populateHolidayName(row),
        summary: formatScheduleSummary(await enrichSetWithHolidays(row))
      }))
    );

    res.json({ success: true, data: enriched });
  } catch (error) {
    return handleError(res, error, 'Error listing business hour schedules');
  }
};

exports.getSet = async (req, res) => {
  try {
    const doc = await BusinessHourSet.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId
    }).lean();

    if (!doc) {
      return res.status(404).json({ success: false, message: 'Schedule not found' });
    }

    const withHoliday = await populateHolidayName(doc);
    res.json({
      success: true,
      data: {
        ...withHoliday,
        summary: formatScheduleSummary(await enrichSetWithHolidays(doc))
      }
    });
  } catch (error) {
    return handleError(res, error, 'Error loading schedule');
  }
};

exports.createSet = async (req, res) => {
  try {
    const body = normalizeBusinessHourSetBody(req.body || {});
    const err = validateBusinessHourSetInput(body);
    if (err) return res.status(400).json({ success: false, message: err });

    const linkedTo = body.linkedTo || { type: 'company', id: null };
    if (linkedTo.type === 'user' && !canEditPersonalSchedule(req.user, linkedTo.id)) {
      if (!canManageBusinessHourSets(req.user)) {
        return res.status(403).json({ success: false, message: 'Not allowed to create this schedule' });
      }
    } else if (!canManageBusinessHourSets(req.user)) {
      return res.status(403).json({ success: false, message: 'Not allowed to create schedules' });
    }

    if (body.isDefault && linkedTo.type !== 'company') {
      return res.status(400).json({ success: false, message: 'Only company schedules can be default' });
    }

    if (body.isDefault) {
      await BusinessHourSet.updateMany(
        { organizationId: req.user.organizationId, isDefault: true },
        { $set: { isDefault: false } }
      );
    }

    const doc = await BusinessHourSet.create({
      organizationId: req.user.organizationId,
      name: body.name.trim(),
      timezone: body.timezone || 'UTC',
      week: body.week || buildDefaultWeek(),
      holidayCalendarId: body.holidayCalendarId || null,
      overtimeAllowed: Boolean(body.overtimeAllowed),
      linkedTo: {
        type: linkedTo.type,
        id: linkedTo.type === 'company' ? null : linkedTo.id
      },
      isDefault: Boolean(body.isDefault),
      status: body.status || 'active',
      effectiveFrom: body.effectiveFrom || null,
      effectiveTo: body.effectiveTo || null,
      createdBy: req.user._id,
      modifiedBy: req.user._id
    });

    if (linkedTo.type === 'user' && linkedTo.id) {
      const User = require('../models/User');
      await User.updateOne(
        { _id: linkedTo.id, organizationId: req.user.organizationId },
        { $set: { businessHourSetId: doc._id } }
      );
    }

    if (linkedTo.type === 'group' && linkedTo.id) {
      await Group.updateOne(
        { _id: linkedTo.id, organizationId: req.user.organizationId },
        { $set: { businessHourSetId: doc._id } }
      );
    }

    attachSettingsAuditDiff(res, {}, snapshotBusinessHourSet(doc), { body: req.body || {} });
    res.status(201).json({ success: true, data: await populateHolidayName(doc.toObject()) });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'An active schedule already exists for this scope'
      });
    }
    return handleError(res, error, 'Error creating schedule');
  }
};

exports.updateSet = async (req, res) => {
  try {
    const body = normalizeBusinessHourSetBody(req.body || {});
    const err = validateBusinessHourSetInput(body, { isUpdate: true });
    if (err) return res.status(400).json({ success: false, message: err });

    const existing = await BusinessHourSet.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Schedule not found' });
    }

    const linkedUserId = existing.linkedTo?.type === 'user' ? existing.linkedTo.id : null;
    if (!canManageBusinessHourSets(req.user) && !canEditPersonalSchedule(req.user, linkedUserId)) {
      return res.status(403).json({ success: false, message: 'Not allowed to update this schedule' });
    }

    const before = snapshotBusinessHourSet(existing);

    if (body.name != null) existing.name = body.name.trim();
    if (body.timezone != null) existing.timezone = body.timezone;
    if (body.week != null) existing.week = body.week;
    if (body.holidayCalendarId !== undefined) existing.holidayCalendarId = body.holidayCalendarId || null;
    if (body.overtimeAllowed != null) existing.overtimeAllowed = Boolean(body.overtimeAllowed);
    if (body.status != null) existing.status = body.status;
    if (body.effectiveFrom !== undefined) existing.effectiveFrom = body.effectiveFrom;
    if (body.effectiveTo !== undefined) existing.effectiveTo = body.effectiveTo;

    if (body.isDefault === true) {
      if (existing.linkedTo?.type !== 'company') {
        return res.status(400).json({ success: false, message: 'Only company schedules can be default' });
      }
      await BusinessHourSet.updateMany(
        { organizationId: req.user.organizationId, isDefault: true, _id: { $ne: existing._id } },
        { $set: { isDefault: false } }
      );
      existing.isDefault = true;
    } else if (body.isDefault === false) {
      existing.isDefault = false;
    }

    existing.modifiedBy = req.user._id;
    await existing.save();

    const after = snapshotBusinessHourSet(existing);
    attachSettingsAuditDiff(res, before, after, { body: req.body || {} });

    res.json({ success: true, data: await populateHolidayName(existing.toObject()) });
  } catch (error) {
    return handleError(res, error, 'Error updating schedule');
  }
};

exports.deleteSet = async (req, res) => {
  try {
    if (!canManageBusinessHourSets(req.user)) {
      return res.status(403).json({ success: false, message: 'Not allowed to delete schedules' });
    }

    const existing = await BusinessHourSet.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Schedule not found' });
    }

    if (existing.isDefault) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete the default company schedule. Set another default first.'
      });
    }

    const before = snapshotBusinessHourSet(existing);
    await existing.deleteOne();
    attachSettingsAuditDiff(res, before, {}, { keys: Object.keys(before || {}) });
    res.json({ success: true, message: 'Schedule deleted' });
  } catch (error) {
    return handleError(res, error, 'Error deleting schedule');
  }
};

exports.resolve = async (req, res) => {
  try {
    const userId = req.query.userId || req.user._id;
    if (String(userId) !== String(req.user._id) && !canManageBusinessHourSets(req.user)) {
      return res.status(403).json({ success: false, message: 'Not allowed to resolve for this user' });
    }

    const orgId = req.user.organizationId;
    const defaultCount = await BusinessHourSet.countDocuments({ organizationId: orgId, isDefault: true });
    if (defaultCount === 0) {
      const org = await Organization.findById(orgId).select('settings.timeZone').lean();
      await ensureDefaultCompanySet(orgId, org?.settings?.timeZone || 'UTC', req.user._id);
    }

    const resolved = await resolveBusinessSchedule({
      organizationId: orgId,
      userId,
      at: req.query.at ? new Date(req.query.at) : new Date()
    });

    res.json({ success: true, data: resolved });
  } catch (error) {
    return handleError(res, error, 'Error resolving schedule');
  }
};

exports.getKpis = async (req, res) => {
  try {
    if (!canManageBusinessHourSets(req.user)) {
      return res.status(403).json({ success: false, message: 'Not allowed to view business hours KPIs' });
    }

    const organizationId = req.user.organizationId;
    const from = String(req.query.from || '').trim();
    const to = String(req.query.to || '').trim();

    const rows = await BusinessHoursDailyKpi.find({
      organizationId,
      ...(from || to
        ? {
            date: {
              ...(from ? { $gte: from } : {}),
              ...(to ? { $lte: to } : {})
            }
          }
        : {})
    })
      .sort({ date: 1 })
      .limit(120)
      .lean();

    const totals = rows.reduce(
      (acc, row) => {
        acc.businessMinutesAvailable += row.businessMinutesAvailable || 0;
        acc.activitiesInsideHours += row.activitiesInsideHours || 0;
        acc.activitiesOutsideHours += row.activitiesOutsideHours || 0;
        acc.overtimeCount += row.overtimeCount || 0;
        acc.slaBreachesOffHours += row.slaBreachesOffHours || 0;
        acc.assignmentDeferredCount += row.assignmentDeferredCount || 0;
        acc.automationDeferredCount += row.automationDeferredCount || 0;
        return acc;
      },
      {
        businessMinutesAvailable: 0,
        activitiesInsideHours: 0,
        activitiesOutsideHours: 0,
        overtimeCount: 0,
        slaBreachesOffHours: 0,
        assignmentDeferredCount: 0,
        automationDeferredCount: 0
      }
    );

    const activityTotal = totals.activitiesInsideHours + totals.activitiesOutsideHours;
    totals.utilizationPercent = activityTotal > 0
      ? Math.round((totals.activitiesInsideHours / activityTotal) * 100)
      : 0;

    res.json({
      success: true,
      data: {
        series: rows,
        totals,
        from: from || rows[0]?.date || null,
        to: to || rows[rows.length - 1]?.date || null
      }
    });
  } catch (error) {
    return handleError(res, error, 'Error loading business hours KPIs');
  }
};

exports.aggregateKpis = async (req, res) => {
  try {
    if (!canManageBusinessHourSets(req.user)) {
      return res.status(403).json({ success: false, message: 'Not allowed to aggregate KPIs' });
    }

    const date = req.body?.date ? String(req.body.date).trim() : null;
    const row = await aggregateBusinessHoursKpiForDay({
      organizationId: req.user.organizationId,
      date: date || undefined
    });

    res.json({ success: true, data: row });
  } catch (error) {
    return handleError(res, error, 'Error aggregating business hours KPIs');
  }
};

exports.simulate = async (req, res) => {
  try {
    const { at, minutesToAdd = 0, userId, setId } = req.body || {};

    let schedule;
    if (setId) {
      if (!canManageBusinessHourSets(req.user)) {
        return res.status(403).json({ success: false, message: 'Not allowed' });
      }
      const doc = await loadSetById(req.user.organizationId, setId);
      if (!doc) return res.status(404).json({ success: false, message: 'Schedule not found' });
      schedule = doc;
    } else {
      const targetUserId = userId || req.user._id;
      if (String(targetUserId) !== String(req.user._id) && !canManageBusinessHourSets(req.user)) {
        return res.status(403).json({ success: false, message: 'Not allowed' });
      }
      const resolved = await resolveBusinessSchedule({
        organizationId: req.user.organizationId,
        userId: targetUserId,
        at: at || new Date()
      });
      schedule = resolved.schedule;
    }

    const result = simulate({ at: at || new Date(), minutesToAdd }, schedule);
    res.json({ success: true, data: result });
  } catch (error) {
    return handleError(res, error, 'Error simulating schedule');
  }
};
