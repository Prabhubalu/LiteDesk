'use strict';

const {
  RELEASE_NOTE_IMPORTANCE,
  RELEASE_NOTE_ITEM_TYPES,
  RELEASE_NOTE_TARGET_APP_KEYS,
  RELEASE_NOTE_TARGET_PLANS
} = require('../constants/releaseNoteConstants');

class ReleaseNoteValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ReleaseNoteValidationError';
    this.code = 'VALIDATION_ERROR';
  }
}

function validateImageUrl(url) {
  if (!url) return;
  const value = String(url).trim();
  if (value.startsWith('/api/uploads/')) return;
  if (value.startsWith('/api/files/download')) return;
  if (value.startsWith('oci:uploads/')) return;
  if (!/^https:\/\/.+/i.test(value)) {
    throw new ReleaseNoteValidationError('imageUrl must be an https URL or managed upload path');
  }
}

function validateCtaUrl(url) {
  if (!url) return;
  const value = String(url).trim();
  if (value.startsWith('/')) return;
  if (!/^https:\/\/.+/i.test(value)) {
    throw new ReleaseNoteValidationError('ctaUrl must be an internal path or https URL');
  }
}

function validateReleaseNoteItems(items) {
  if (items === undefined) return;
  if (!Array.isArray(items)) {
    throw new ReleaseNoteValidationError('items must be an array');
  }

  for (const item of items) {
    if (!item?.type || !RELEASE_NOTE_ITEM_TYPES.includes(item.type)) {
      throw new ReleaseNoteValidationError('Each item requires a valid type');
    }
    if (!item?.title || String(item.title).trim().length === 0) {
      throw new ReleaseNoteValidationError('Each item requires a title');
    }
    if (String(item.title).length > 120) {
      throw new ReleaseNoteValidationError('Item title must be 120 characters or fewer');
    }
    const description = String(item.description || '').trim();
    if (description.length > 4000) {
      throw new ReleaseNoteValidationError('Item description must be 4000 characters or fewer');
    }
    if (item.imageUrl) validateImageUrl(item.imageUrl);
    if (item.ctaUrl) validateCtaUrl(item.ctaUrl);
    if (item.ctaLabel && String(item.ctaLabel).length > 40) {
      throw new ReleaseNoteValidationError('ctaLabel must be 40 characters or fewer');
    }
  }
}

function validateReleaseNotePayload(payload, { isCreate = false } = {}) {
  if (!payload || typeof payload !== 'object') {
    throw new ReleaseNoteValidationError('Request body is required');
  }

  if (isCreate) {
    for (const field of ['version', 'title', 'importance']) {
      if (!payload[field] || String(payload[field]).trim().length === 0) {
        throw new ReleaseNoteValidationError(`${field} is required`);
      }
    }
  }

  if (payload.summary !== undefined) {
    const summary = String(payload.summary).trim();
    if (summary.length > 280) {
      throw new ReleaseNoteValidationError('summary must be 280 characters or fewer');
    }
  }
  if (payload.version !== undefined && String(payload.version).length > 32) {
    throw new ReleaseNoteValidationError('version must be 32 characters or fewer');
  }
  if (payload.title !== undefined && String(payload.title).length > 120) {
    throw new ReleaseNoteValidationError('title must be 120 characters or fewer');
  }
  if (payload.importance !== undefined && !RELEASE_NOTE_IMPORTANCE.includes(payload.importance)) {
    throw new ReleaseNoteValidationError('importance must be major, minor, or patch');
  }

  if (payload.targetApps !== undefined) {
    if (!Array.isArray(payload.targetApps)) {
      throw new ReleaseNoteValidationError('targetApps must be an array');
    }
    for (const appKey of payload.targetApps) {
      if (!RELEASE_NOTE_TARGET_APP_KEYS.includes(appKey)) {
        throw new ReleaseNoteValidationError(`Invalid targetApps value: ${appKey}`);
      }
    }
  }

  if (payload.targetPlans !== undefined) {
    if (!Array.isArray(payload.targetPlans)) {
      throw new ReleaseNoteValidationError('targetPlans must be an array');
    }
    for (const plan of payload.targetPlans) {
      if (!RELEASE_NOTE_TARGET_PLANS.includes(plan)) {
        throw new ReleaseNoteValidationError(`Invalid targetPlans value: ${plan}`);
      }
    }
  }

  if (payload.badgeExpiresAt !== undefined && payload.badgeExpiresAt !== null) {
    const date = new Date(payload.badgeExpiresAt);
    if (Number.isNaN(date.getTime())) {
      throw new ReleaseNoteValidationError('badgeExpiresAt must be a valid date');
    }
  }

  if (payload.items !== undefined) {
    validateReleaseNoteItems(payload.items);
  }
}

module.exports = {
  ReleaseNoteValidationError,
  validateReleaseNotePayload,
  validateReleaseNoteItems,
  validateCtaUrl,
  validateImageUrl
};
