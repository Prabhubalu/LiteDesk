'use strict';

const {
  TelephonyProviderBase,
  UnsupportedProviderCapabilityError,
} = require('../TelephonyProvider');

/**
 * Knowlarity adapter — registered for multi-provider support.
 */
class KnowlarityAdapter extends TelephonyProviderBase {
  constructor(config = {}) {
    super({ ...config, providerKey: 'knowlarity' });
    this.apiKey = config.credentials?.apiKey || '';
    this.apiSecret = config.credentials?.apiSecret || '';
    this.fromNumber = config.credentials?.fromNumber || '';
  }

  async connect() {
    return { ok: Boolean(this.apiKey) };
  }

  async healthCheck() {
    if (!this.apiKey) {
      return { ok: false, message: 'Configure Knowlarity API key' };
    }
    return { ok: true, provider: 'knowlarity' };
  }

  async createClientToken() {
    throw new UnsupportedProviderCapabilityError(
      'createClientToken',
      'knowlarity',
      'Knowlarity softphone token issuance is not enabled for this tenant yet'
    );
  }

  async placeCall() {
    throw new UnsupportedProviderCapabilityError(
      'placeCall',
      'knowlarity',
      'Knowlarity outbound adapter is registered; complete API mapping to place calls'
    );
  }

  async validateWebhook(_signature, _url, _params) {
    return Boolean(this.apiKey || this.apiSecret);
  }

  normalizeWebhookEvent(body = {}) {
    return {
      providerEventId: String(body.uuid || body.call_id || body.CallSid || ''),
      providerCallSid: String(body.call_id || body.CallSid || body.uuid || ''),
      eventType: String(body.event || body.status || 'status'),
      status: String(body.status || body.call_status || '').toLowerCase(),
      from: body.from || body.caller || '',
      to: body.to || body.called || '',
      direction: String(body.direction || 'inbound').toLowerCase().includes('out')
        ? 'outbound'
        : 'inbound',
      recordingUrl: body.recording_url || body.RecordingUrl || null,
      recordingSid: body.recording_id || null,
      durationSeconds: Number(body.duration || 0) || 0,
      raw: body,
    };
  }
}

module.exports = KnowlarityAdapter;
