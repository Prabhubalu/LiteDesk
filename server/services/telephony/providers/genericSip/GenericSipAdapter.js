'use strict';

const {
  TelephonyProviderBase,
  UnsupportedProviderCapabilityError,
} = require('../TelephonyProvider');

/**
 * Generic SIP trunk adapter — placeholder for SIP providers.
 * Call control goes through the same TelephonyProvider interface.
 */
class GenericSipAdapter extends TelephonyProviderBase {
  constructor(config = {}) {
    super({ ...config, providerKey: 'generic_sip' });
    this.sipDomain = config.credentials?.sipDomain || '';
    this.sipUsername = config.credentials?.sipUsername || '';
    this.sipPassword = config.credentials?.sipPassword || '';
    this.fromNumber = config.credentials?.fromNumber || '';
  }

  async connect() {
    return { ok: Boolean(this.sipDomain && this.sipUsername) };
  }

  async healthCheck() {
    if (!this.sipDomain || !this.sipUsername) {
      return { ok: false, message: 'Configure SIP domain and username' };
    }
    return { ok: true, provider: 'generic_sip', domain: this.sipDomain };
  }

  async createClientToken() {
    throw new UnsupportedProviderCapabilityError(
      'createClientToken',
      'generic_sip',
      'Generic SIP WebRTC token bridge is not configured'
    );
  }

  async placeCall() {
    throw new UnsupportedProviderCapabilityError(
      'placeCall',
      'generic_sip',
      'Generic SIP outbound requires a SIP gateway mapping'
    );
  }

  async validateWebhook(_signature, _url, _params) {
    return true;
  }

  normalizeWebhookEvent(body = {}) {
    return {
      providerEventId: String(body.eventId || body.callId || body.CallSid || ''),
      providerCallSid: String(body.callId || body.CallSid || ''),
      eventType: String(body.eventType || body.status || 'status'),
      status: String(body.status || '').toLowerCase(),
      from: body.from || '',
      to: body.to || '',
      direction: String(body.direction || 'inbound').toLowerCase().includes('out')
        ? 'outbound'
        : 'inbound',
      recordingUrl: body.recordingUrl || null,
      recordingSid: body.recordingSid || null,
      durationSeconds: Number(body.durationSeconds || body.duration || 0) || 0,
      raw: body,
    };
  }
}

module.exports = GenericSipAdapter;
