'use strict';

const {
  TelephonyProviderBase,
  UnsupportedProviderCapabilityError,
} = require('../TelephonyProvider');

/**
 * Exotel adapter stub — registered for future use.
 * Webhook normalize/validate are implemented loosely so the registry can route events.
 */
class ExotelAdapter extends TelephonyProviderBase {
  constructor(config = {}) {
    super({ ...config, providerKey: 'exotel' });
  }

  async healthCheck() {
    return { ok: false, message: 'Configure Exotel credentials' };
  }

  async placeCall() {
    throw new UnsupportedProviderCapabilityError(
      'placeCall',
      'exotel',
      'Exotel adapter is registered for future use'
    );
  }

  async createClientToken() {
    throw new UnsupportedProviderCapabilityError(
      'createClientToken',
      'exotel',
      'Exotel adapter is registered for future use'
    );
  }

  validateWebhook(_reqLike = {}) {
    // Loose validation until Exotel signature verification is implemented.
    return true;
  }

  normalizeWebhookEvent(payload = {}) {
    const callSid = String(
      payload.CallSid || payload.call_sid || payload.Sid || payload.sid || ''
    ).trim();
    const status = String(
      payload.Status || payload.status || payload.CallStatus || ''
    )
      .trim()
      .toLowerCase();
    const eventId =
      callSid + ':' + (status || String(payload.EventType || payload.event || 'event'));

    let direction = null;
    const directionRaw = String(payload.Direction || payload.direction || '').toLowerCase();
    if (directionRaw.includes('inbound') || directionRaw === 'incoming') direction = 'inbound';
    else if (directionRaw.includes('outbound') || directionRaw === 'outgoing') {
      direction = 'outbound';
    }

    return {
      eventId: eventId || `exotel_${Date.now()}`,
      eventType: status || 'status',
      callSid: callSid || null,
      status: status || null,
      from: String(payload.From || payload.from || payload.CallFrom || '').trim() || null,
      to: String(payload.To || payload.to || payload.CallTo || '').trim() || null,
      direction,
      durationSeconds: Number.isFinite(Number(payload.Duration || payload.duration))
        ? Number(payload.Duration || payload.duration)
        : null,
      recordingUrl: payload.RecordingUrl || payload.recording_url || null,
      recordingSid: payload.RecordingSid || payload.recording_sid || null,
      accountSid: payload.AccountSid || payload.account_sid || null,
      raw: payload,
    };
  }
}

module.exports = ExotelAdapter;
