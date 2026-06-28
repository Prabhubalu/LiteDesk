const AppointmentBookingConfig = require('../models/AppointmentBookingConfig');
const User = require('../models/User');
const { slugifyBase, ensureUniqueSlug } = require('../utils/appointmentSlug');
const { normalizeCustomFields } = require('../utils/appointmentCustomFields');
const {
  syncBookingPublicRegistry,
  removePublicRegistryEntry
} = require('../services/appointmentBookingPublicRegistryService');

function sanitizeTeamBody(body) {
  const allowed = [
    'displayName', 'slug', 'enabled', 'availableDays', 'workingHours',
    'scheduleSource', 'businessHourSetId',
    'slotDurationMinutes', 'bufferMinutes', 'dailyCapacity', 'meetingType',
    'appointmentTypes', 'customFields', 'branding', 'memberUserIds', 'assignmentStrategy'
  ];
  const out = {};
  for (const key of allowed) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  if (out.slug) out.slug = slugifyBase(out.slug);
  if (Array.isArray(out.memberUserIds)) {
    out.memberUserIds = [...new Set(out.memberUserIds.map(String))];
  }
  if (out.customFields !== undefined) {
    out.customFields = normalizeCustomFields(out.customFields);
  }
  return out;
}

function toPublicConfig(doc, req) {
  const base = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  const origin = req?.get?.('origin') || process.env.CLIENT_URL || '';
  const bookingUrl = origin
    ? `${origin.replace(/\/$/, '')}/book/${base.slug}`
    : `/book/${base.slug}`;
  return { ...base, bookingUrl };
}

function requireAdmin(req, res) {
  if (!req.user.isOwner && req.user.role !== 'admin' && !req.user.isPlatformAdmin) {
    res.status(403).json({ success: false, message: 'Admin access required' });
    return false;
  }
  return true;
}

exports.listTeamConfigs = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const configs = await AppointmentBookingConfig.find({
      organizationId: req.user.organizationId,
      ownerType: 'team'
    })
      .populate('memberUserIds', 'firstName lastName email username avatar')
      .sort({ updatedAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: configs.map((c) => toPublicConfig(c, req))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getTeamConfig = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const config = await AppointmentBookingConfig.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      ownerType: 'team'
    })
      .populate('memberUserIds', 'firstName lastName email username avatar')
      .lean();

    if (!config) {
      return res.status(404).json({ success: false, message: 'Team page not found' });
    }
    res.status(200).json({ success: true, data: toPublicConfig(config, req) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createTeamConfig = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const updates = sanitizeTeamBody(req.body);
    const organizationId = req.user.organizationId;
    const managerId = req.user._id;

    if (!updates.memberUserIds?.length) {
      return res.status(400).json({
        success: false,
        message: 'Select at least one team member.'
      });
    }

    const members = await User.find({
      _id: { $in: updates.memberUserIds },
      organizationId
    }).select('_id').lean();
    if (members.length !== updates.memberUserIds.length) {
      return res.status(400).json({ success: false, message: 'Invalid team members.' });
    }

    const baseName = updates.displayName || 'sales-team';
    const slug = updates.slug || await ensureUniqueSlug(baseName, async (s) => {
      const taken = await AppointmentBookingConfig.findOne({ organizationId, slug: s }).lean();
      return !!taken;
    });

    const config = await AppointmentBookingConfig.create({
      organizationId,
      ownerType: 'team',
      assignedTo: managerId,
      memberUserIds: updates.memberUserIds,
      assignmentStrategy: updates.assignmentStrategy || 'round_robin',
      roundRobinIndex: 0,
      slug,
      displayName: updates.displayName || 'Team booking',
      enabled: updates.enabled !== false,
      availableDays: updates.availableDays ?? [1, 2, 3, 4, 5],
      workingHours: updates.workingHours ?? { start: '09:00', end: '18:00', timezone: 'UTC' },
      slotDurationMinutes: updates.slotDurationMinutes ?? 30,
      bufferMinutes: updates.bufferMinutes ?? 10,
      meetingType: updates.meetingType ?? 'offline',
      appointmentTypes: updates.appointmentTypes ?? ['demo', 'consultation'],
      customFields: updates.customFields ?? [],
      branding: updates.branding ?? { themeColor: '#4f46e5', welcomeNote: '', logoUrl: '' },
      createdBy: managerId,
      modifiedBy: managerId,
      ...updates
    });

    await syncBookingPublicRegistry(config);

    res.status(201).json({ success: true, data: toPublicConfig(config, req) });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Booking URL already in use.' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateTeamConfig = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const updates = sanitizeTeamBody(req.body);
    const organizationId = req.user.organizationId;

    const config = await AppointmentBookingConfig.findOne({
      _id: req.params.id,
      organizationId,
      ownerType: 'team'
    });

    if (!config) {
      return res.status(404).json({ success: false, message: 'Team page not found' });
    }

    if (updates.memberUserIds) {
      if (!updates.memberUserIds.length) {
        return res.status(400).json({ success: false, message: 'Select at least one team member.' });
      }
      const members = await User.find({
        _id: { $in: updates.memberUserIds },
        organizationId
      }).select('_id').lean();
      if (members.length !== updates.memberUserIds.length) {
        return res.status(400).json({ success: false, message: 'Invalid team members.' });
      }
    }

    const previousSlug = config.slug;
    if (updates.slug && updates.slug !== config.slug) {
      const taken = await AppointmentBookingConfig.findOne({
        organizationId,
        slug: updates.slug,
        _id: { $ne: config._id }
      }).lean();
      if (taken) {
        return res.status(409).json({ success: false, message: 'This booking URL is already taken.' });
      }
    }

    Object.assign(config, updates, { modifiedBy: req.user._id });
    await config.save();
    await syncBookingPublicRegistry(config, { previousSlug });

    res.status(200).json({ success: true, data: toPublicConfig(config, req) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteTeamConfig = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const deleted = await AppointmentBookingConfig.findOneAndDelete({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      ownerType: 'team'
    });
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Team page not found' });
    }
    await removePublicRegistryEntry(deleted.slug);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
