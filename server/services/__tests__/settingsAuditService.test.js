'use strict';

const {
  redactSensitive,
  actionFromHttpMethod
} = require('../settingsAuditService');
const {
  shouldSkipPath,
  resolveAction,
  resolveSettingsApiSurface
} = require('../../middleware/settingsAuditMiddleware');

describe('settingsAuditService', () => {
  test('redacts secret-like keys', () => {
    const input = {
      name: 'Acme',
      apiKey: 'sk-live-123',
      nested: { webhookSecret: 'whsec_abc', color: '#fff' }
    };
    const out = redactSensitive(input);
    expect(out.name).toBe('Acme');
    expect(out.apiKey).toBe('[REDACTED]');
    expect(out.nested.webhookSecret).toBe('[REDACTED]');
    expect(out.nested.color).toBe('#fff');
  });

  test('maps HTTP methods to actions', () => {
    expect(actionFromHttpMethod('POST')).toBe('create');
    expect(actionFromHttpMethod('PUT')).toBe('update');
    expect(actionFromHttpMethod('PATCH')).toBe('update');
    expect(actionFromHttpMethod('DELETE')).toBe('delete');
  });
});

describe('settingsAuditMiddleware helpers', () => {
  test('skips noisy paths', () => {
    expect(shouldSkipPath('/api/settings/audit-log')).toBe(true);
    expect(shouldSkipPath('/api/users/profile')).toBe(true);
    expect(shouldSkipPath('/api/settings/organization')).toBe(false);
  });

  test('resolves invoke for enable/disable verbs', () => {
    expect(resolveAction('POST', '/api/settings/addons/live_chat/enable')).toBe('invoke');
    expect(resolveAction('PUT', '/api/settings/organization')).toBe('update');
  });

  test('resolves settings API surface', () => {
    expect(resolveSettingsApiSurface('/api/settings/security')).toBe('security');
    expect(resolveSettingsApiSurface('/api/settings/addons/blog/settings')).toBe('addons');
  });
});
