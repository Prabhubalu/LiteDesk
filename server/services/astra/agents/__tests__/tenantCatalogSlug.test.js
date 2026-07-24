'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { slugifyKey } = require('../tenantCatalogService');

describe('tenantCatalogService.slugifyKey', () => {
  it('slugifies titles', () => {
    assert.equal(slugifyKey('My Cool Agent!!'), 'my-cool-agent');
    assert.equal(slugifyKey('  Sales  Qual  '), 'sales-qual');
  });
});
