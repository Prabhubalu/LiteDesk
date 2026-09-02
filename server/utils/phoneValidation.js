'use strict';

/**
 * Minimal E.164 validation for public signup flows.
 */
function validateInternationalPhone(phone) {
  const raw = String(phone || '').trim();
  if (!raw.startsWith('+')) {
    return { ok: false, message: 'Phone number must include country code.' };
  }

  const digits = raw.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) {
    return { ok: false, message: 'Phone number length is invalid.' };
  }

  if (!/^[1-9]/.test(digits)) {
    return { ok: false, message: 'Phone number is invalid.' };
  }

  return { ok: true, phone: `+${digits}` };
}

module.exports = {
  validateInternationalPhone,
};
