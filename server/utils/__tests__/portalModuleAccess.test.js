'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  userPortalModuleGranted,
  userPortalModuleGrantedAny,
  userModuleView
} = require('../../utils/portalModuleAccess');

describe('portalModuleAccess', () => {
  it('grants read from RBAC envelope', () => {
    const user = {
      permissions: {
        cases: { read: true, create: false, update: true, delete: false }
      }
    };
    assert.equal(userModuleView(user, 'cases'), true);
    assert.equal(userPortalModuleGranted(user, 'cases', 'create'), false);
    assert.equal(userPortalModuleGranted(user, 'cases', 'update'), true);
  });

  it('accepts legacy view flag', () => {
    const user = { permissions: { documents: { view: true } } };
    assert.equal(userModuleView(user, 'documents'), true);
  });

  it('inherits responses from forms', () => {
    const user = { permissions: { forms: { read: true } } };
    assert.equal(userPortalModuleGranted(user, 'responses', 'read'), true);
  });

  it('denies when module missing from envelope', () => {
    const user = { permissions: { cases: { read: true } } };
    assert.equal(userPortalModuleGranted(user, 'invoices', 'read'), false);
  });

  it('grants when any listed action is allowed', () => {
    const user = {
      permissions: {
        cases: { read: true, create: false, update: true, delete: false }
      }
    };
    assert.equal(userPortalModuleGrantedAny(user, 'cases', ['create', 'update']), true);
    assert.equal(userPortalModuleGrantedAny(user, 'cases', ['create']), false);
  });
});
