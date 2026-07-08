'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { handleWebhookPayload } = require('../lib/sync');

describe('help-sync webhook handler', () => {
  it('rejects unsupported events', async () => {
    await assert.rejects(
      () => handleWebhookPayload({
        apiOrigin: 'https://app.example.com',
        org: 'art_pub_test',
        dest: '/tmp/help',
        payload: { event: 'content.updated' },
      }),
      /Unsupported webhook event/,
    );
  });
});
