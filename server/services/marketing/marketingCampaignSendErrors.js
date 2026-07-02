'use strict';

/** @param {unknown} code */
function formatCampaignSendErrorMessage(code) {
  const normalized = String(code || '').trim().toLowerCase();
  if (!normalized) return 'Campaign send failed. Try again or contact support.';

  if (normalized === 'burst_limit_exceeded') {
    return 'Sending burst limit reached. Wait about a minute after recent sends, then try again.';
  }
  if (normalized === 'hourly_limit_exceeded') {
    return 'Hourly sending limit reached. Try again later or contact your administrator.';
  }
  if (normalized === 'daily_limit_exceeded') {
    return 'Daily sending limit reached. Try again tomorrow or contact your administrator.';
  }
  if (normalized.includes('insufficient') && normalized.includes('credit')) {
    return 'Insufficient email credits. Purchase more credits or reduce the audience size.';
  }
  if (normalized === 'sending limit reached. try again later.') {
    return 'Sending limit reached. Try again later.';
  }

  return String(code);
}

module.exports = {
  formatCampaignSendErrorMessage
};
