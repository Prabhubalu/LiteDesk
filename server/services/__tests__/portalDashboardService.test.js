'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  resolvePortalDashboardWidgets,
  userModuleView
} = require('../portalDashboardService');

describe('portalDashboardService', () => {
  it('resolves customer portal widgets from read permissions', () => {
    const user = {
      userType: 'EXTERNAL',
      permissions: {
        cases: { read: true },
        documents: { read: true },
        invoices: { read: true }
      }
    };

    assert.deepEqual(resolvePortalDashboardWidgets(user), {
      cases: true,
      knowledge: true,
      invoices: true,
      deals: false,
      forms: false,
      responses: false,
      organization: false,
      people: false,
      audits: false,
      actions: false
    });
  });

  it('accepts legacy view permissions', () => {
    const user = {
      userType: 'EXTERNAL',
      permissions: {
        cases: { view: true },
        documents: { view: true },
        invoices: { view: true }
      }
    };

    assert.equal(userModuleView(user, 'cases'), true);
    assert.equal(resolvePortalDashboardWidgets(user).cases, true);
  });

  it('resolves audit-focused widgets from events permission', () => {
    const user = {
      userType: 'EXTERNAL',
      permissions: {
        events: { read: true }
      }
    };

    const widgets = resolvePortalDashboardWidgets(user);
    assert.equal(widgets.audits, true);
    assert.equal(widgets.actions, true);
    assert.equal(widgets.cases, false);
  });

  it('respects explicit deny when permissions are hydrated', () => {
    const widgets = resolvePortalDashboardWidgets({
      userType: 'EXTERNAL',
      permissions: {
        cases: { read: false },
        documents: { read: false },
        invoices: { read: false }
      }
    });
    assert.equal(widgets.cases, false);
    assert.equal(widgets.knowledge, false);
    assert.equal(widgets.invoices, false);
    assert.equal(widgets.deals, false);
    assert.equal(widgets.forms, false);
    assert.equal(widgets.organization, false);
  });

  it('falls back only when external user has no permission envelope', () => {
    const widgets = resolvePortalDashboardWidgets({ userType: 'EXTERNAL', permissions: {} });
    assert.equal(widgets.cases, true);
    assert.equal(widgets.knowledge, true);
    assert.equal(widgets.invoices, true);
    assert.equal(widgets.deals, false);
    assert.equal(widgets.forms, false);
    assert.equal(widgets.organization, false);
  });

  it('userModuleView reads permission envelope', () => {
    assert.equal(userModuleView({ permissions: { cases: { read: true } } }, 'cases'), true);
    assert.equal(userModuleView({ permissions: { cases: { read: false } } }, 'cases'), false);
  });
});
