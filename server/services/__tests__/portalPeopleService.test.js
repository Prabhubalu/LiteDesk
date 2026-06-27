'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { shapePortalPerson } = require('../portalPeopleService');

describe('portalPeopleService', () => {
  it('shapePortalPerson maps customer-safe contact fields', () => {
    const shaped = shapePortalPerson({
      _id: '507f1f77bcf86cd799439011',
      first_name: 'Jane',
      last_name: 'Doe',
      email: 'jane@example.com',
      phone: '555-0100',
      mobile: '555-0101',
      organization: '507f1f77bcf86cd799439012'
    });

    assert.equal(shaped.firstName, 'Jane');
    assert.equal(shaped.lastName, 'Doe');
    assert.equal(shaped.email, 'jane@example.com');
    assert.equal(shaped.portalAccess, undefined);
  });
});
