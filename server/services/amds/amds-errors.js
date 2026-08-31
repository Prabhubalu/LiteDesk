'use strict';

/**
 * Typed AMDS HTTP error — use instanceof checks on outbound send and proxy routes.
 * @see docs/ARIVU-TRACK-3-DRAFT.md
 */

class AmdsApiError extends Error {
  /**
   * @param {number} status
   * @param {import('./amds-types').AmdsErrorBody} body
   */
  constructor(status, body) {
    const msg = body?.error ? String(body.error) : `AMDS HTTP ${status}`;
    super(msg);
    this.name = 'AmdsApiError';
    this.status = status;
    this.body = body && typeof body === 'object' ? body : { error: msg };
  }

  get isRetryable() {
    return this.status >= 500 || this.status === 429;
  }

  get isSuppressedRecipient() {
    return this.status === 422;
  }

  get isDomainNotVerified() {
    return this.status === 403;
  }

  get isInsufficientCredits() {
    return this.status === 402;
  }

  get isCampaignSizeExceeded() {
    return this.status === 422 && String(this.body?.error || '') === 'campaign_size_exceeded';
  }

  get isMarketingRestricted() {
    return this.status === 403 && String(this.body?.error || '') === 'marketing_restricted';
  }

  get isRateLimited() {
    return this.status === 429;
  }

  /** @returns {string} */
  get userMessage() {
    if (this.isInsufficientCredits) {
      return 'Email credits exhausted. Purchase more credits or reduce the audience size.';
    }
    if (this.isCampaignSizeExceeded) {
      const limit = this.body?.limit;
      return typeof limit === 'number'
        ? `Maximum campaign size is ${limit.toLocaleString()} recipients.`
        : 'Campaign size exceeds your organization\'s limit.';
    }
    if (this.isRateLimited) {
      const code = String(this.body?.error || '').trim().toLowerCase();
      if (code === 'burst_limit_exceeded') {
        return 'Sending burst limit reached. Wait about a minute after recent sends, then try again.';
      }
      if (code === 'hourly_limit_exceeded') {
        return 'Hourly sending limit reached. Try again later.';
      }
      if (code === 'daily_limit_exceeded') {
        return 'Daily sending limit reached. Try again tomorrow.';
      }
      return 'Sending limit reached. Try again later.';
    }
    if (this.isMarketingRestricted) {
      return 'Marketing campaigns require sender reputation of at least 40.';
    }
    if (this.isDomainNotVerified) {
      const domain = this.body?.domain ? String(this.body.domain) : 'unknown';
      return `Sending domain not verified: ${domain}. Ask an admin to verify DNS in Settings.`;
    }
    if (this.isSuppressedRecipient) {
      const suppressed = Array.isArray(this.body.suppressed) ? this.body.suppressed : [];
      return `Cannot send — recipient is suppressed: ${suppressed.join(', ') || 'unknown'}`;
    }
    return this.message;
  }
}

module.exports = {
  AmdsApiError
};
