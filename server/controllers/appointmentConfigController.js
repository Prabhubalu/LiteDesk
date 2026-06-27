const AppointmentBookingConfig = require('../models/AppointmentBookingConfig');
const User = require('../models/User');
const { slugifyBase, ensureUniqueSlug } = require('../utils/appointmentSlug');
const { normalizeCustomFields } = require('../utils/appointmentCustomFields');
const { syncBookingPublicRegistry } = require('../services/appointmentBookingPublicRegistryService');

function sanitizeConfigBody(body) {
  const allowed = [
    'displayName', 'slug', 'enabled', 'availableDays', 'workingHours',
    'scheduleSource', 'businessHourSetId',
    'slotDurationMinutes', 'bufferMinutes', 'dailyCapacity', 'meetingType',
    'appointmentTypes', 'customFields', 'branding'
  ];
  const out = {};
  for (const key of allowed) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  if (out.slug) {
    out.slug = slugifyBase(out.slug);
  }
  if (out.customFields !== undefined) {
    out.customFields = normalizeCustomFields(out.customFields);
  }
  return out;
}

function toPublicConfig(doc, req) {
  const base = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  if (base.googleCalendar?.encryptedRefreshToken) {
    base.googleCalendar = {
      accountEmail: base.googleCalendar.accountEmail,
      connectedAt: base.googleCalendar.connectedAt,
      connected: true
    };
  } else if (base.googleCalendar) {
    base.googleCalendar = { connected: false, accountEmail: null, connectedAt: null };
  }
  if (base.microsoftCalendar?.encryptedRefreshToken) {
    base.microsoftCalendar = {
      accountEmail: base.microsoftCalendar.accountEmail,
      connectedAt: base.microsoftCalendar.connectedAt,
      connected: true
    };
  } else if (base.microsoftCalendar) {
    base.microsoftCalendar = { connected: false, accountEmail: null, connectedAt: null };
  }
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

exports.getMyConfig = async (req, res) => {
  try {
    const config = await AppointmentBookingConfig.findOne({
      organizationId: req.user.organizationId,
      ownerType: 'user',
      ownerId: req.user._id
    }).lean();

    if (!config) {
      return res.status(200).json({ success: true, data: null });
    }
    res.status(200).json({ success: true, data: toPublicConfig(config, req) });
  } catch (error) {
    console.error('[appointmentConfig] getMyConfig:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.upsertMyConfig = async (req, res) => {
  try {
    const updates = sanitizeConfigBody(req.body);
    const organizationId = req.user.organizationId;
    const ownerId = req.user._id;

    let config = await AppointmentBookingConfig.findOne({
      organizationId,
      ownerType: 'user',
      ownerId
    });

    if (!config) {
      const user = await User.findById(ownerId).select('firstName lastName username email').lean();
      const baseName = updates.displayName || user?.firstName || user?.username || 'meet';
      const slug = updates.slug || await ensureUniqueSlug(baseName, async (s) => {
        const taken = await AppointmentBookingConfig.findOne({ organizationId, slug: s }).lean();
        return !!taken;
      });

      config = await AppointmentBookingConfig.create({
        organizationId,
        ownerType: 'user',
        ownerId,
        slug,
        displayName: updates.displayName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'My calendar',
        enabled: updates.enabled !== false,
        availableDays: updates.availableDays ?? [1, 2, 3, 4, 5],
        workingHours: updates.workingHours ?? { start: '09:00', end: '18:00', timezone: 'UTC' },
        slotDurationMinutes: updates.slotDurationMinutes ?? 30,
        bufferMinutes: updates.bufferMinutes ?? 10,
        meetingType: updates.meetingType ?? 'offline',
        appointmentTypes: updates.appointmentTypes ?? ['demo', 'consultation'],
        customFields: updates.customFields ?? [],
        branding: updates.branding ?? { themeColor: '#4f46e5', welcomeNote: '', logoUrl: '' },
        createdBy: ownerId,
        modifiedBy: ownerId,
        ...updates
      });
      await syncBookingPublicRegistry(config);
    } else {
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
      Object.assign(config, updates, { modifiedBy: ownerId });
      await config.save();
      await syncBookingPublicRegistry(config, { previousSlug });
    }

    res.status(200).json({ success: true, data: toPublicConfig(config, req) });
  } catch (error) {
    console.error('[appointmentConfig] upsertMyConfig:', error);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Booking URL already in use.' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.checkSlugAvailable = async (req, res) => {
  try {
    const slug = slugifyBase(req.query.slug || '');
    if (!slug) {
      return res.status(400).json({ success: false, message: 'Invalid slug' });
    }
    const excludeId = req.query.excludeId;
    const query = {
      organizationId: req.user.organizationId,
      slug
    };
    if (excludeId) {
      query._id = { $ne: excludeId };
    } else {
      query.$or = [
        { ownerType: 'team' },
        { ownerType: 'user', ownerId: { $ne: req.user._id } }
      ];
    }
    const existing = await AppointmentBookingConfig.findOne(query).lean();
    res.status(200).json({ success: true, available: !existing, slug });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getUserConfig = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const config = await AppointmentBookingConfig.findOne({
      organizationId: req.user.organizationId,
      ownerType: 'user',
      ownerId: req.params.userId
    }).lean();

    if (!config) {
      return res.status(200).json({ success: true, data: null });
    }
    res.status(200).json({ success: true, data: toPublicConfig(config, req) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.upsertUserConfig = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const updates = sanitizeConfigBody(req.body);
    const organizationId = req.user.organizationId;
    const ownerId = req.params.userId;

    const owner = await User.findOne({ _id: ownerId, organizationId }).select('firstName lastName username').lean();
    if (!owner) {
      return res.status(404).json({ success: false, message: 'User not found in organization' });
    }

    let config = await AppointmentBookingConfig.findOne({
      organizationId,
      ownerType: 'user',
      ownerId
    });

    if (!config) {
      const baseName = updates.displayName || owner.firstName || owner.username || 'meet';
      const slug = updates.slug || await ensureUniqueSlug(baseName, async (s) => {
        const taken = await AppointmentBookingConfig.findOne({ organizationId, slug: s }).lean();
        return !!taken;
      });

      config = await AppointmentBookingConfig.create({
        organizationId,
        ownerType: 'user',
        ownerId,
        slug,
        displayName: updates.displayName || `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || 'Booking',
        enabled: updates.enabled !== false,
        availableDays: updates.availableDays ?? [1, 2, 3, 4, 5],
        workingHours: updates.workingHours ?? { start: '09:00', end: '18:00', timezone: 'UTC' },
        slotDurationMinutes: updates.slotDurationMinutes ?? 30,
        bufferMinutes: updates.bufferMinutes ?? 10,
        meetingType: updates.meetingType ?? 'offline',
        appointmentTypes: updates.appointmentTypes ?? ['demo', 'consultation'],
        customFields: updates.customFields ?? [],
        branding: updates.branding ?? { themeColor: '#4f46e5', welcomeNote: '', logoUrl: '' },
        createdBy: req.user._id,
        modifiedBy: req.user._id,
        ...updates
      });
      await syncBookingPublicRegistry(config);
    } else {
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
    }

    res.status(200).json({ success: true, data: toPublicConfig(config, req) });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Booking URL already in use.' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.listAllConfigs = async (req, res) => {
  try {
    if (!requireAdmin(req, res)) return;
    const configs = await AppointmentBookingConfig.find({
      organizationId: req.user.organizationId
    })
      .populate('ownerId', 'firstName lastName email username avatar')
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

/** Booking pages visible to the current user (personal + team membership; admins see all). */
exports.listMyPages = async (req, res) => {
  try {
    const organizationId = req.user.organizationId;
    const userId = req.user._id;
    const isAdmin =
      req.user.isOwner || req.user.role === 'admin' || req.user.isPlatformAdmin;

    const query = { organizationId };
    if (!isAdmin) {
      query.$or = [
        { ownerType: 'user', ownerId: userId },
        { ownerType: 'team', memberUserIds: userId }
      ];
    }

    const configs = await AppointmentBookingConfig.find(query)
      .populate('ownerId', 'firstName lastName email username avatar')
      .populate('memberUserIds', 'firstName lastName email username avatar')
      .sort({ updatedAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: configs.map((c) => toPublicConfig(c, req))
    });
  } catch (error) {
    console.error('[appointmentConfig] listMyPages:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
