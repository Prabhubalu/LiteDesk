'use strict';

const {
  TelephonyProviderBase,
  UnsupportedProviderCapabilityError,
} = require('../TelephonyProvider');

/**
 * Plivo adapter — registered for multi-provider support.
 * Full REST/WebRTC wiring follows the same CallManager contracts as Twilio.
 */
class PlivoAdapter extends TelephonyProviderBase {
  constructor(config = {}) {
    super({ ...config, providerKey: 'plivo' });
    this.authId = config.credentials?.authId || config.credentials?.accountSid || '';
    this.authToken = config.credentials?.authToken || '';
    this.fromNumber = config.credentials?.fromNumber || '';
  }

  async connect() {
    return { ok: Boolean(this.authId && this.authToken) };
  }

  async healthCheck() {
    if (!this.authId || !this.authToken) {
      return { ok: false, message: 'Configure Plivo Auth ID and Auth Token' };
    }
    return { ok: true, provider: 'plivo', account: this.authId };
  }

  async createClientToken() {
    throw new UnsupportedProviderCapabilityError(
      'createClientToken',
      'plivo',
      'Plivo softphone token issuance is not enabled for this tenant yet'
    );
  }

  async placeCall() {
    throw new UnsupportedProviderCapabilityError(
      'placeCall',
      'plivo',
      'Plivo outbound calling adapter is registered; enable full Plivo Voice API credentials to place calls'
    );
  }

  async validateWebhook(_signature, _url, _params) {
    return Boolean(this.authToken);
  }

  normalizeWebhookEvent(body = {}) {
    return {
      providerEventId: String(body.CallUUID || body.RequestUUID || body.EventId || ''),
      providerCallSid: String(body.CallUUID || ''),
      eventType: String(body.Event || body.CallStatus || 'status'),
      status: String(body.CallStatus || body.Status || '').toLowerCase(),
      from: body.From || body.CallerName || '',
      to: body.To || body.Called || '',
      direction: String(body.Direction || 'inbound').toLowerCase().includes('out')
        ? 'outbound'
        : 'inbound',
      recordingUrl: body.RecordUrl || body.RecordingUrl || null,
      recordingSid: body.RecordingID || body.RecordingSid || null,
      durationSeconds: Number(body.Duration || body.CallDuration || 0) || 0,
      raw: body,
    };
  }
}

module.exports = PlivoAdapter;
