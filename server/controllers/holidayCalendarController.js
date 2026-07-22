'use strict';

const HolidayCalendar = require('../models/HolidayCalendar');
const BusinessHourSet = require('../models/BusinessHourSet');
const { validateHolidayCalendarInput } = require('../utils/businessHoursValidation');
const { canManageBusinessHourSets } = require('../middleware/businessHoursAccess');
const { attachSettingsAuditDiff, cloneForAudit } = require('../utils/settingsAuditSnapshot');

function handleError(res, error, fallbackMessage) {
  console.error(fallbackMessage, error);
  return res.status(500).json({ success: false, message: fallbackMessage, error: error.message });
}

function snapshotHolidayCalendar(doc) {
  const o = doc && typeof doc.toObject === 'function' ? doc.toObject() : doc || {};
  return cloneForAudit({
    name: o.name ?? null,
    region: o.region ?? null,
    dates: o.dates ?? []
  });
}

exports.list = async (req, res) => {
  try {
    const calendars = await HolidayCalendar.find({
      organizationId: req.user.organizationId
    })
      .sort({ name: 1 })
      .lean();

    res.json({ success: true, data: calendars });
  } catch (error) {
    return handleError(res, error, 'Error listing holiday calendars');
  }
};

exports.get = async (req, res) => {
  try {
    const doc = await HolidayCalendar.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId
    }).lean();

    if (!doc) {
      return res.status(404).json({ success: false, message: 'Holiday calendar not found' });
    }

    res.json({ success: true, data: doc });
  } catch (error) {
    return handleError(res, error, 'Error loading holiday calendar');
  }
};

exports.create = async (req, res) => {
  try {
    if (!canManageBusinessHourSets(req.user)) {
      return res.status(403).json({ success: false, message: 'Not allowed' });
    }

    const err = validateHolidayCalendarInput(req.body);
    if (err) return res.status(400).json({ success: false, message: err });

    const doc = await HolidayCalendar.create({
      organizationId: req.user.organizationId,
      name: req.body.name.trim(),
      region: req.body.region || '',
      dates: req.body.dates || [],
      createdBy: req.user._id,
      modifiedBy: req.user._id
    });

    attachSettingsAuditDiff(res, {}, snapshotHolidayCalendar(doc), { body: req.body || {} });
    res.status(201).json({ success: true, data: doc });
  } catch (error) {
    return handleError(res, error, 'Error creating holiday calendar');
  }
};

exports.update = async (req, res) => {
  try {
    if (!canManageBusinessHourSets(req.user)) {
      return res.status(403).json({ success: false, message: 'Not allowed' });
    }

    const err = validateHolidayCalendarInput({ ...req.body, name: req.body.name || 'x' });
    if (req.body.name != null) {
      const nameErr = validateHolidayCalendarInput({ name: req.body.name });
      if (nameErr) return res.status(400).json({ success: false, message: nameErr });
    }

    const doc = await HolidayCalendar.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId
    });

    if (!doc) {
      return res.status(404).json({ success: false, message: 'Holiday calendar not found' });
    }

    const before = snapshotHolidayCalendar(doc);

    if (req.body.name != null) doc.name = req.body.name.trim();
    if (req.body.region != null) doc.region = req.body.region;
    if (req.body.dates != null) {
      const datesErr = validateHolidayCalendarInput({ name: doc.name, dates: req.body.dates });
      if (datesErr) return res.status(400).json({ success: false, message: datesErr });
      doc.dates = req.body.dates;
    }
    doc.modifiedBy = req.user._id;
    await doc.save();

    attachSettingsAuditDiff(res, before, snapshotHolidayCalendar(doc), { body: req.body || {} });
    res.json({ success: true, data: doc });
  } catch (error) {
    return handleError(res, error, 'Error updating holiday calendar');
  }
};

exports.remove = async (req, res) => {
  try {
    if (!canManageBusinessHourSets(req.user)) {
      return res.status(403).json({ success: false, message: 'Not allowed' });
    }

    const inUse = await BusinessHourSet.countDocuments({
      organizationId: req.user.organizationId,
      holidayCalendarId: req.params.id
    });

    if (inUse > 0) {
      return res.status(400).json({
        success: false,
        message: 'Calendar is linked to one or more schedules. Unlink it first.'
      });
    }

    const existing = await HolidayCalendar.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Holiday calendar not found' });
    }

    const before = snapshotHolidayCalendar(existing);
    const result = await HolidayCalendar.deleteOne({
      _id: req.params.id,
      organizationId: req.user.organizationId
    });

    if (!result.deletedCount) {
      return res.status(404).json({ success: false, message: 'Holiday calendar not found' });
    }

    attachSettingsAuditDiff(res, before, {}, { keys: Object.keys(before || {}) });
    res.json({ success: true, message: 'Holiday calendar deleted' });
  } catch (error) {
    return handleError(res, error, 'Error deleting holiday calendar');
  }
};

exports.importCsv = async (req, res) => {
  try {
    if (!canManageBusinessHourSets(req.user)) {
      return res.status(403).json({ success: false, message: 'Not allowed' });
    }

    const { csv, name, region = '' } = req.body || {};
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ success: false, message: 'name is required' });
    }
    if (!csv || typeof csv !== 'string') {
      return res.status(400).json({ success: false, message: 'csv is required' });
    }

    const dates = [];
    const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      if (/^date\s*,/i.test(line)) continue;
      const parts = line.split(',').map((p) => p.trim());
      if (parts.length < 2) continue;
      const [date, ...nameParts] = parts;
      const holidayName = nameParts.join(',').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !holidayName) continue;
      dates.push({ date, name: holidayName });
    }

    if (!dates.length) {
      return res.status(400).json({ success: false, message: 'No valid rows found. Use date,name per line.' });
    }

    const doc = await HolidayCalendar.create({
      organizationId: req.user.organizationId,
      name: name.trim(),
      region,
      dates,
      createdBy: req.user._id,
      modifiedBy: req.user._id
    });

    attachSettingsAuditDiff(
      res,
      {},
      cloneForAudit({
        name: doc.name,
        region: doc.region,
        importedCount: dates.length
      }),
      { keys: ['name', 'region', 'importedCount'] }
    );

    res.status(201).json({ success: true, data: doc });
  } catch (error) {
    return handleError(res, error, 'Error importing holiday calendar');
  }
};
