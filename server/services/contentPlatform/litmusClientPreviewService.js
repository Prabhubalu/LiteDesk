'use strict';

const litmusConfig = require('../../config/litmus');

const CLIENT_LABELS = {
  GMAIL: 'Gmail',
  OL2019: 'Outlook 2019',
  IPHONE: 'iPhone',
  IPAD: 'iPad',
  YAHOO: 'Yahoo Mail',
  APPLEMAIL: 'Apple Mail'
};

/**
 * @returns {{ enabled: boolean, clients: Array<{ code: string, label: string }> }}
 */
function getClientPreviewStatus() {
  return {
    enabled: litmusConfig.isEnabled(),
    clients: litmusConfig.defaultClients.map((code) => ({
      code,
      label: CLIENT_LABELS[code] || code
    }))
  };
}

/**
 * @returns {string}
 */
function buildLitmusAuthHeader() {
  const token = Buffer.from(`${litmusConfig.apiKey}:`).toString('base64');
  return `Basic ${token}`;
}

/**
 * @param {object} params
 * @param {string} params.html
 * @param {string} [params.subject]
 * @returns {Promise<{ emailGuid: string, clients: Array<{ code: string, label: string, previewPath: string }> }>}
 */
async function createClientPreview(params) {
  if (!litmusConfig.isEnabled()) {
    const error = new Error('Litmus client preview is not configured');
    error.code = 'LITMUS_NOT_CONFIGURED';
    error.statusCode = 503;
    throw error;
  }

  const html = String(params?.html || '').trim();
  if (!html) {
    const error = new Error('HTML content is required');
    error.code = 'HTML_REQUIRED';
    error.statusCode = 400;
    throw error;
  }

  const response = await fetch(`${litmusConfig.baseUrl}/emails`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: buildLitmusAuthHeader()
    },
    body: JSON.stringify({
      html_text: html,
      subject: String(params?.subject || 'LiteDesk preview').slice(0, 200)
    })
  });

  if (!response.ok) {
    const error = new Error(`Litmus API error (${response.status})`);
    error.code = 'LITMUS_API_ERROR';
    error.statusCode = response.status >= 500 ? 502 : 400;
    throw error;
  }

  const payload = await response.json();
  const emailGuid = String(payload?.email_guid || '').trim();
  if (!emailGuid) {
    const error = new Error('Litmus did not return an email GUID');
    error.code = 'LITMUS_API_ERROR';
    error.statusCode = 502;
    throw error;
  }

  return {
    emailGuid,
    clients: litmusConfig.defaultClients.map((code) => ({
      code,
      label: CLIENT_LABELS[code] || code,
      previewPath: `/templates/html/client-preview/${encodeURIComponent(emailGuid)}/${encodeURIComponent(code)}`
    }))
  };
}

/**
 * @param {object} params
 * @param {string} params.emailGuid
 * @param {string} params.client
 * @returns {Promise<Response>}
 */
async function fetchPreviewImageResponse(params) {
  if (!litmusConfig.isEnabled()) {
    const error = new Error('Litmus client preview is not configured');
    error.code = 'LITMUS_NOT_CONFIGURED';
    error.statusCode = 503;
    throw error;
  }

  const emailGuid = String(params?.emailGuid || '').trim();
  const client = String(params?.client || '').trim();
  if (!emailGuid || !client) {
    const error = new Error('Preview parameters are required');
    error.code = 'VALIDATION_FAILED';
    error.statusCode = 400;
    throw error;
  }

  return fetch(
    `${litmusConfig.baseUrl}/emails/${encodeURIComponent(emailGuid)}/previews/${encodeURIComponent(client)}/full`,
    {
      method: 'GET',
      headers: { Authorization: buildLitmusAuthHeader() },
      redirect: 'follow'
    }
  );
}

module.exports = {
  getClientPreviewStatus,
  createClientPreview,
  fetchPreviewImageResponse
};
