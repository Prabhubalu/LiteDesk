'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  resolveModuleAppKey,
  moduleScope,
  APP_DEFAULT_MODULES
} = require('../webformModuleMetadataService');

describe('webformModuleMetadataService.resolveModuleAppKey', () => {
  it('maps platform modules to their runtime app keys', () => {
    assert.strictEqual(resolveModuleAppKey('people'), 'SALES');
    assert.strictEqual(resolveModuleAppKey('tasks'), 'PLATFORM');
    assert.strictEqual(resolveModuleAppKey('quotes'), 'PLATFORM');
  });

  it('maps app-native modules', () => {
    assert.strictEqual(resolveModuleAppKey('cases'), 'HELPDESK');
    assert.strictEqual(resolveModuleAppKey('deals'), 'SALES');
  });

  it('falls back to provided app key', () => {
    assert.strictEqual(resolveModuleAppKey('custom_module', 'AUDIT'), 'AUDIT');
  });
});

describe('webformModuleMetadataService.moduleScope', () => {
  it('classifies platform-owned commercial modules as platform scope', () => {
    assert.strictEqual(moduleScope('tasks', 'PLATFORM'), 'platform');
    assert.strictEqual(moduleScope('quotes', 'PLATFORM'), 'platform');
  });

  it('classifies sales and helpdesk modules as app scope', () => {
    assert.strictEqual(moduleScope('people', 'SALES'), 'app');
    assert.strictEqual(moduleScope('organizations', 'SALES'), 'app');
    assert.strictEqual(moduleScope('deals', 'SALES'), 'app');
    assert.strictEqual(moduleScope('cases', 'HELPDESK'), 'app');
  });
});

describe('webformModuleMetadataService.APP_DEFAULT_MODULES', () => {
  it('includes sales defaults', () => {
    assert.deepStrictEqual(APP_DEFAULT_MODULES.SALES, ['people', 'organizations', 'deals']);
  });
});
