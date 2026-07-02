'use strict';

const DEFAULT_CLIENTS = ['GMAIL', 'OL2019', 'IPHONE', 'IPAD', 'YAHOO'];

module.exports = {
  apiKey: String(process.env.LITMUS_API_KEY || '').trim(),
  baseUrl: String(process.env.LITMUS_API_BASE_URL || 'https://instant-api.litmus.com/v1').replace(/\/$/, ''),
  defaultClients: DEFAULT_CLIENTS,
  isEnabled() {
    return Boolean(this.apiKey);
  }
};
