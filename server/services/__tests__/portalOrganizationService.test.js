'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { shapePortalOrganization } = require('../portalOrganizationService');

describe('portalOrganizationService', () => {
  it('shapePortalOrganization returns customer-safe fields only', () => {
    const shaped = shapePortalOrganization({
      _id: '507f1f77bcf86cd799439011',
      name: 'Acme Corp',
      email: 'info@acme.com',
      phone: '555-0100',
      website: 'https://acme.com',
      industry: 'Retail',
      types: ['Customer'],
      status: 'Active',
      tier: 'Gold',
      address: '1 Main St',
      city: 'Austin',
      state: 'TX',
      postalCode: '78701',
      country: 'US',
      subscription: { status: 'active' }
    });

    assert.equal(shaped.name, 'Acme Corp');
    assert.equal(shaped.email, 'info@acme.com');
    assert.equal(shaped.city, 'Austin');
    assert.equal(shaped.subscription, undefined);
  });
});
