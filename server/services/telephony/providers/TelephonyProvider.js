'use strict';

/**
 * @typedef {Object} TelephonyCredentials
 * @property {string} [accountSid]
 * @property {string} [authToken]
 * @property {string} [apiKey]
 * @property {string} [apiSecret]
 * @property {string} [twimlAppSid]
 * @property {string} [fromNumber]
 * @property {string} [authId]
 * @property {string} [authTokenExotel]
 * @property {string} [subdomain]
 */

/**
 * @typedef {Object} NormalizedWebhookEvent
 * @property {string} eventId
 * @property {string} eventType
 * @property {string} [callSid]
 * @property {string} [status]
 * @property {string} [from]
 * @property {string} [to]
 * @property {string} [direction]
 * @property {number|null} [durationSeconds]
 * @property {string|null} [recordingUrl]
 * @property {string|null} [recordingSid]
 * @property {Object} [raw]
 */

class UnsupportedProviderCapabilityError extends Error {
  /**
   * @param {string} capability
   * @param {string} [providerKey]
   * @param {string} [message]
   */
  constructor(capability, providerKey = 'unknown', message = null) {
    super(
      message ||
        `Provider "${providerKey}" does not support capability "${capability}"`
    );
    this.name = 'UnsupportedProviderCapabilityError';
    this.capability = capability;
    this.providerKey = providerKey;
    this.statusCode = 501;
  }
}

/**
 * Base telephony provider adapter. Concrete adapters override supported methods.
 * Unimplemented methods throw UnsupportedProviderCapabilityError.
 */
class TelephonyProviderBase {
  /**
   * @param {Object} config - TelephonyProviderConfig-like document
   */
  constructor(config = {}) {
    this.config = config;
    this.providerKey = String(config.providerKey || 'unknown');
    this.credentials =
      config.credentials && typeof config.credentials === 'object'
        ? config.credentials
        : {};
    this.settings =
      config.settings && typeof config.settings === 'object' ? config.settings : {};
    this.organizationId = config.organizationId || null;
  }

  /** @returns {Promise<{ok:boolean, message?:string}>} */
  async connect() {
    throw new UnsupportedProviderCapabilityError('connect', this.providerKey);
  }

  /** @returns {Promise<void>} */
  async disconnect() {
    throw new UnsupportedProviderCapabilityError('disconnect', this.providerKey);
  }

  /** @returns {Promise<{ok:boolean, message?:string, details?:Object}>} */
  async healthCheck() {
    throw new UnsupportedProviderCapabilityError('healthCheck', this.providerKey);
  }

  /** @param {Object} params @returns {Promise<{callSid:string, status?:string, raw?:Object}>} */
  async placeCall(_params) {
    throw new UnsupportedProviderCapabilityError('placeCall', this.providerKey);
  }

  /** @param {string} callSid @returns {Promise<{ok:boolean}>} */
  async hangUp(_callSid) {
    throw new UnsupportedProviderCapabilityError('hangUp', this.providerKey);
  }

  async mute(_callSid) {
    throw new UnsupportedProviderCapabilityError('mute', this.providerKey);
  }

  async unmute(_callSid) {
    throw new UnsupportedProviderCapabilityError('unmute', this.providerKey);
  }

  async hold(_callSid) {
    throw new UnsupportedProviderCapabilityError('hold', this.providerKey);
  }

  async resume(_callSid) {
    throw new UnsupportedProviderCapabilityError('resume', this.providerKey);
  }

  async transfer(_callSid, _target) {
    throw new UnsupportedProviderCapabilityError('transfer', this.providerKey);
  }

  async conference(_callSid, _params) {
    throw new UnsupportedProviderCapabilityError('conference', this.providerKey);
  }

  async park(_callSid) {
    throw new UnsupportedProviderCapabilityError('park', this.providerKey);
  }

  async resumePark(_callSid, _slot) {
    throw new UnsupportedProviderCapabilityError('resumePark', this.providerKey);
  }

  async sendDTMF(_callSid, _digits) {
    throw new UnsupportedProviderCapabilityError('sendDTMF', this.providerKey);
  }

  async startRecording(_callSid) {
    throw new UnsupportedProviderCapabilityError('startRecording', this.providerKey);
  }

  async stopRecording(_callSid, _recordingSid) {
    throw new UnsupportedProviderCapabilityError('stopRecording', this.providerKey);
  }

  async getRecording(_recordingSid) {
    throw new UnsupportedProviderCapabilityError('getRecording', this.providerKey);
  }

  async downloadRecording(_recordingSid) {
    throw new UnsupportedProviderCapabilityError('downloadRecording', this.providerKey);
  }

  async listPhoneNumbers(_params) {
    throw new UnsupportedProviderCapabilityError('listPhoneNumbers', this.providerKey);
  }

  async assignNumber(_params) {
    throw new UnsupportedProviderCapabilityError('assignNumber', this.providerKey);
  }

  async releaseNumber(_numberSid) {
    throw new UnsupportedProviderCapabilityError('releaseNumber', this.providerKey);
  }

  async createIVR(_flow) {
    throw new UnsupportedProviderCapabilityError('createIVR', this.providerKey);
  }

  async deleteIVR(_ivrId) {
    throw new UnsupportedProviderCapabilityError('deleteIVR', this.providerKey);
  }

  async getAgentStatus(_agentId) {
    throw new UnsupportedProviderCapabilityError('getAgentStatus', this.providerKey);
  }

  async setPresence(_agentId, _status) {
    throw new UnsupportedProviderCapabilityError('setPresence', this.providerKey);
  }

  /** Softphone / browser client token */
  async createClientToken(_params) {
    throw new UnsupportedProviderCapabilityError('createClientToken', this.providerKey);
  }

  /**
   * @param {Object} reqLike - { headers, body, rawBody?, url?, protocol?, host? }
   * @returns {Promise<boolean>|boolean}
   */
  validateWebhook(_reqLike) {
    throw new UnsupportedProviderCapabilityError('validateWebhook', this.providerKey);
  }

  /**
   * @param {Object} payload
   * @returns {NormalizedWebhookEvent}
   */
  normalizeWebhookEvent(_payload) {
    throw new UnsupportedProviderCapabilityError('normalizeWebhookEvent', this.providerKey);
  }

  async compileIvrFlow(_flow) {
    throw new UnsupportedProviderCapabilityError('compileIvrFlow', this.providerKey);
  }
}

module.exports = {
  TelephonyProviderBase,
  UnsupportedProviderCapabilityError,
};
