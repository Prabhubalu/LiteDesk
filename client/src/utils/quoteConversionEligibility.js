import { isQuoteValidityExpired } from '@/utils/quoteValidity';

const CONVERT_ELIGIBLE_STATUSES = ['Accepted', 'Partially Accepted'];

function hasCustomerAcceptance(record) {
  const rt = String(record?.customerResponse?.responseType || '').toLowerCase();
  if (rt === 'full' || rt === 'partial' || rt === 'accept') return true;
  const ids = record?.customerResponse?.acceptedLineIds;
  return Array.isArray(ids) && ids.length > 0;
}

export function resolveConversionTypeForQuote(record) {
  const status = String(record?.status || '').trim();
  if (status === 'Partially Accepted') return 'partial';
  if (String(record?.customerResponse?.responseType || '').toLowerCase() === 'partial') {
    return 'partial';
  }
  return 'full';
}

export function getQuoteConversionEligibility(record, { overrideExpired = false } = {}) {
  const status = String(record?.status || '').trim();
  const suggestedConversionType = resolveConversionTypeForQuote(record);

  if (record?.converted === true || status === 'Converted') {
    return { allowed: false, reason: 'already_converted', suggestedConversionType: null };
  }

  const validityExpired = isQuoteValidityExpired(record);
  const statusExpired = status === 'Expired';
  const acceptedEligible = CONVERT_ELIGIBLE_STATUSES.includes(status);

  const blockedByExpiry =
    (statusExpired || (validityExpired && acceptedEligible)) && !overrideExpired;

  if (blockedByExpiry) {
    return {
      allowed: false,
      reason: 'expired',
      suggestedConversionType: null,
      expiredOverrideAvailable: true
    };
  }

  if (statusExpired && overrideExpired) {
    if (!acceptedEligible && !hasCustomerAcceptance(record)) {
      return { allowed: false, reason: 'accept_first', suggestedConversionType: null };
    }
    return {
      allowed: true,
      reason: null,
      suggestedConversionType,
      usedExpiredOverride: true
    };
  }

  if (!acceptedEligible) {
    return { allowed: false, reason: 'accept_first', suggestedConversionType: null };
  }

  return {
    allowed: true,
    reason: null,
    suggestedConversionType,
    usedExpiredOverride: validityExpired && overrideExpired
  };
}

export function conversionHintKey(eligibility) {
  const reason = typeof eligibility === 'string' ? eligibility : eligibility?.reason;
  const canOverride =
    typeof eligibility === 'object' &&
    eligibility?.canOverrideExpired === true &&
    eligibility?.expiredOverrideAvailable === true;

  if (reason === 'expired' && canOverride) return 'records.conversionHintExpiredAdmin';
  if (reason === 'expired') return 'records.conversionHintExpired';
  if (reason === 'already_converted') return 'records.conversionHintAlreadyConverted';
  if (reason === 'accept_first') return 'records.conversionHintAcceptFirst';
  return 'records.conversionHintAcceptFirst';
}
