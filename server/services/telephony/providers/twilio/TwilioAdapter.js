'use strict';

const twilio = require('twilio');
const {
  TelephonyProviderBase,
  UnsupportedProviderCapabilityError,
} = require('../TelephonyProvider');

class TwilioAdapter extends TelephonyProviderBase {
  constructor(config = {}) {
    super({ ...config, providerKey: 'twilio' });
    this._client = null;
  }

  _getClient() {
    if (this._client) return this._client;
    const { accountSid, authToken, apiKey, apiSecret } = this.credentials;
    if (apiKey && apiSecret && accountSid) {
      this._client = twilio(apiKey, apiSecret, { accountSid });
    } else if (accountSid && authToken) {
      this._client = twilio(accountSid, authToken);
    } else {
      throw new Error('Twilio credentials incomplete (need accountSid+authToken or apiKey+apiSecret)');
    }
    return this._client;
  }

  async connect() {
    const health = await this.healthCheck();
    return health;
  }

  async disconnect() {
    this._client = null;
  }

  async healthCheck() {
    try {
      const client = this._getClient();
      const account = await client.api.accounts(this.credentials.accountSid).fetch();
      return {
        ok: true,
        message: 'Twilio account reachable',
        details: { sid: account.sid, status: account.status },
      };
    } catch (err) {
      return { ok: false, message: err.message || 'Twilio health check failed' };
    }
  }

  async placeCall({ to, from, url, statusCallback, timeout, record } = {}) {
    const client = this._getClient();
    const fromNumber = from || this.credentials.fromNumber;
    if (!to || !fromNumber) {
      throw new Error('placeCall requires to and from (or credentials.fromNumber)');
    }
    const params = {
      to,
      from: fromNumber,
      timeout: Number.isFinite(timeout) ? timeout : 30,
    };
    if (url) params.url = url;
    if (statusCallback) params.statusCallback = statusCallback;
    if (record === true) params.record = true;
    if (!params.url && this.credentials.twimlAppSid) {
      params.applicationSid = this.credentials.twimlAppSid;
    }
    if (!params.url && !params.applicationSid) {
      params.twiml = '<Response><Say>Connecting your call.</Say></Response>';
    }
    const call = await client.calls.create(params);
    return { callSid: call.sid, status: call.status, raw: call };
  }

  async hangUp(callSid) {
    const client = this._getClient();
    await client.calls(callSid).update({ status: 'completed' });
    return { ok: true };
  }

  async transfer(callSid, target) {
    const client = this._getClient();
    const to = typeof target === 'string' ? target : target?.to;
    if (!to) throw new Error('transfer requires target number or identity');
    const twiml = `<Response><Dial>${String(to).replace(/[<>&]/g, '')}</Dial></Response>`;
    await client.calls(callSid).update({ twiml });
    return { ok: true };
  }

  async startRecording(callSid) {
    const client = this._getClient();
    const rec = await client.calls(callSid).recordings.create();
    return { recordingSid: rec.sid, status: rec.status };
  }

  async stopRecording(callSid, recordingSid) {
    const client = this._getClient();
    await client.calls(callSid).recordings(recordingSid).update({ status: 'stopped' });
    return { ok: true };
  }

  async getRecording(recordingSid) {
    const client = this._getClient();
    const rec = await client.recordings(recordingSid).fetch();
    return {
      recordingSid: rec.sid,
      durationSeconds: Number(rec.duration) || null,
      uri: rec.uri,
      status: rec.status,
      raw: rec,
    };
  }

  async listPhoneNumbers({ limit = 50 } = {}) {
    const client = this._getClient();
    const numbers = await client.incomingPhoneNumbers.list({ limit });
    return numbers.map((n) => ({
      phoneNumber: n.phoneNumber,
      providerNumberSid: n.sid,
      friendlyName: n.friendlyName || '',
      capabilities: {
        voice: Boolean(n.capabilities?.voice),
        sms: Boolean(n.capabilities?.sms),
      },
    }));
  }

  async createClientToken({ identity, ttlSeconds = 3600 } = {}) {
    const { accountSid, apiKey, apiSecret, twimlAppSid } = this.credentials;
    if (!accountSid || !apiKey || !apiSecret || !twimlAppSid) {
      throw new Error(
        'createClientToken requires accountSid, apiKey, apiSecret, and twimlAppSid'
      );
    }
    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;
    const token = new AccessToken(accountSid, apiKey, apiSecret, {
      identity: String(identity || 'agent'),
      ttl: ttlSeconds,
    });
    token.addGrant(
      new VoiceGrant({
        outgoingApplicationSid: twimlAppSid,
        incomingAllow: true,
      })
    );
    return { token: token.toJwt(), identity: String(identity || 'agent'), ttlSeconds };
  }

  validateWebhook(reqLike = {}) {
    const authToken = this.credentials.authToken || this.config.webhookSecret;
    if (!authToken) return false;
    const signature =
      reqLike.headers?.['x-twilio-signature'] ||
      reqLike.headers?.['X-Twilio-Signature'] ||
      '';
    if (!signature) return false;
    const protocol = reqLike.protocol || 'https';
    const host = reqLike.host || reqLike.headers?.host || '';
    const url = reqLike.url || reqLike.originalUrl || '';
    const fullUrl = reqLike.webhookUrl || `${protocol}://${host}${url}`;
    const params = reqLike.body && typeof reqLike.body === 'object' ? reqLike.body : {};
    return twilio.validateRequest(authToken, signature, fullUrl, params);
  }

  normalizeWebhookEvent(payload = {}) {
    const callSid = String(payload.CallSid || payload.callSid || '').trim();
    const recordingSid = String(payload.RecordingSid || payload.recordingSid || '').trim();
    const status = String(payload.CallStatus || payload.DialCallStatus || payload.status || '')
      .trim()
      .toLowerCase();
    const directionRaw = String(payload.Direction || payload.direction || '').toLowerCase();
    let direction = null;
    if (directionRaw.includes('inbound')) direction = 'inbound';
    else if (directionRaw.includes('outbound')) direction = 'outbound';

    const eventId =
      String(payload.CallSid || '') +
      ':' +
      String(payload.CallStatus || payload.RecordingSid || payload.SequenceNumber || 'event');

    return {
      eventId: eventId || `twilio_${Date.now()}`,
      eventType: recordingSid ? 'recording' : status || 'status',
      callSid: callSid || null,
      status: status || null,
      from: String(payload.From || payload.from || '').trim() || null,
      to: String(payload.To || payload.to || '').trim() || null,
      direction,
      durationSeconds: Number.isFinite(Number(payload.CallDuration || payload.Duration))
        ? Number(payload.CallDuration || payload.Duration)
        : null,
      recordingUrl: payload.RecordingUrl || payload.recordingUrl || null,
      recordingSid: recordingSid || null,
      accountSid: payload.AccountSid || null,
      raw: payload,
    };
  }

  async compileIvrFlow(flow = {}) {
    const nodes = Array.isArray(flow.nodes) ? flow.nodes : [];
    const sayNode = nodes.find((n) => n?.type === 'say' || n?.type === 'message');
    const text = sayNode?.config?.text || sayNode?.text || 'Thank you for calling.';
    const twiml = `<Response><Say>${String(text).replace(/[<>&]/g, '')}</Say></Response>`;
    return { twiml, provider: 'twilio', compiledAt: new Date().toISOString() };
  }

  async mute() {
    // WebRTC mute is client-side (Twilio Device). Server no-op keeps CallManager provider-agnostic.
    return { ok: true, clientSide: true };
  }

  async unmute() {
    return { ok: true, clientSide: true };
  }

  async hold(callSid) {
    const client = this._getClient();
    const twiml =
      '<Response><Play loop="0">http://com.twilio.sounds.music.s3.amazonaws.com/MARKOVICHAMP-Borghestral.mp3</Play></Response>';
    await client.calls(callSid).update({ twiml });
    return { ok: true };
  }

  async resume(callSid, { url, twiml } = {}) {
    const client = this._getClient();
    if (url) {
      await client.calls(callSid).update({ url, method: 'POST' });
    } else {
      await client.calls(callSid).update({
        twiml: twiml || '<Response><Say>Resuming call.</Say></Response>',
      });
    }
    return { ok: true };
  }
}

module.exports = TwilioAdapter;
