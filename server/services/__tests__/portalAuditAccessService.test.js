'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { buildPortalAuditAccessQueryFromContext } = require('../portalAuditAccessService');

describe('portalAuditAccessService', () => {
  it('buildPortalAuditAccessQueryFromContext scopes to business org and corrective owner', () => {
    const businessOrgId = '507f1f77bcf86cd799439011';
    const userId = '507f1f77bcf86cd799439012';
    const tenantOrgId = '507f1f77bcf86cd799439099';

    const query = buildPortalAuditAccessQueryFromContext(tenantOrgId, {
      businessOrganizationId: businessOrgId,
      userId
    });

    assert.equal(query.organizationId, tenantOrgId);
    assert.ok(query.$or.some((clause) => String(clause.relatedToId) === businessOrgId));
    assert.ok(query.$or.some((clause) => String(clause.correctiveOwnerId) === userId));
    assert.deepEqual(query.eventType.$in, [
      'Internal Audit',
      'External Audit — Single Org',
      'External Audit Beat'
    ]);
  });

  it('buildPortalAuditAccessQueryFromContext returns empty match when no scope', () => {
    const query = buildPortalAuditAccessQueryFromContext('507f1f77bcf86cd799439099', {});
    assert.equal(query._id, null);
  });
});
