/**
 * ============================================================================
 * System Invariants Service - Test Hooks
 * ============================================================================
 * 
 * Minimal test hooks for system invariants validation.
 * These tests verify the core invariant logic without requiring full database setup.
 * 
 * For full integration tests, see the main test suite.
 * ============================================================================
 */

const {
  validateDelete,
  validateUnlink,
  validateTypeMutation,
  validateRoleInvariant,
  findActiveReferences,
  findActiveReferencesBulk
} = require('../systemInvariants');

// Mock models for testing
jest.mock('../../models/People', () => ({
  findOne: jest.fn(),
  find: jest.fn()
}));

jest.mock('../../models/Organization', () => ({
  findOne: jest.fn(),
  find: jest.fn()
}));

jest.mock('../../models/Deal', () => ({
  find: jest.fn()
}));

const People = require('../../models/People');
const Organization = require('../../models/Organization');
const Deal = require('../../models/Deal');

describe('System Invariants', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateDelete', () => {
    it('should allow deletion when no active references exist', async () => {
      Deal.find.mockResolvedValue([]);
      Organization.find.mockResolvedValue([]);
      People.find.mockResolvedValue([]);

      const result = await validateDelete({
        moduleKey: 'people',
        recordId: 'person123',
        organizationId: 'org123'
      });

      expect(result.valid).toBe(true);
      expect(result.code).toBe('DELETE_ALLOWED');
    });

    it('should block deletion when active deals reference the person', async () => {
      Deal.find.mockResolvedValue([
        { _id: 'deal1', name: 'Deal 1', status: 'Open' },
        { _id: 'deal2', name: 'Deal 2', status: 'Open' }
      ]);
      Organization.find.mockResolvedValue([]);

      const result = await validateDelete({
        moduleKey: 'people',
        recordId: 'person123',
        organizationId: 'org123'
      });

      expect(result.valid).toBe(false);
      expect(result.code).toBe('DELETE_BLOCKED_BY_REFERENCES');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].moduleKey).toBe('deals');
      expect(result.errors[0].count).toBe(2);
    });

    it('should block deletion when organization is referenced by active deals', async () => {
      Deal.find.mockResolvedValue([
        { _id: 'deal1', name: 'Deal 1', status: 'Open' }
      ]);
      People.find.mockResolvedValue([]);

      const result = await validateDelete({
        moduleKey: 'organizations',
        recordId: 'org123',
        organizationId: 'tenant123'
      });

      expect(result.valid).toBe(false);
      expect(result.code).toBe('DELETE_BLOCKED_BY_REFERENCES');
    });
  });

  describe('findActiveReferencesBulk', () => {
    it('should block multiple people in one query batch', async () => {
      Deal.find.mockResolvedValue([
        { _id: 'deal1', name: 'Deal 1', status: 'Open', contactId: 'person1' },
        { _id: 'deal2', name: 'Deal 2', status: 'Open', contactId: 'person2' }
      ]);
      Organization.find.mockResolvedValue([]);

      const blocked = await findActiveReferencesBulk(
        'people',
        ['person1', 'person2', 'person3'],
        'org123'
      );

      expect(blocked.size).toBe(2);
      expect(blocked.has('person1')).toBe(true);
      expect(blocked.has('person2')).toBe(true);
      expect(blocked.has('person3')).toBe(false);
    });

    it('should block organizations referenced by people and deals in bulk', async () => {
      Deal.find.mockResolvedValue([
        { _id: 'deal1', name: 'Deal 1', status: 'Open', accountId: 'org1' }
      ]);
      People.find.mockResolvedValue([
        { _id: 'person1', first_name: 'A', last_name: 'B', organization: 'org2' }
      ]);
      Organization.find.mockResolvedValue([]);

      const blocked = await findActiveReferencesBulk(
        'organizations',
        ['org1', 'org2', 'org3'],
        'tenant123'
      );

      expect(blocked.size).toBe(2);
      expect(blocked.has('org1')).toBe(true);
      expect(blocked.has('org2')).toBe(true);
    });
  });

  describe('validateUnlink', () => {
    it('should allow unlink when no active deals reference both', async () => {
      People.findOne.mockResolvedValue({
        _id: 'person123',
        organization: 'org123'
      });
      Deal.find.mockResolvedValue([]);

      const result = await validateUnlink({
        moduleKey: 'people',
        recordId: 'person123',
        organizationId: 'org123',
        updateData: { organization: null }
      });

      expect(result.valid).toBe(true);
      expect(result.code).toBe('UNLINK_ALLOWED');
    });

    it('should block unlink when active deals reference both person and organization', async () => {
      People.findOne.mockResolvedValue({
        _id: 'person123',
        organization: 'org123'
      });
      Deal.find.mockResolvedValue([
        { _id: 'deal1', name: 'Deal 1', status: 'Open' },
        { _id: 'deal2', name: 'Deal 2', status: 'Open' }
      ]);

      const result = await validateUnlink({
        moduleKey: 'people',
        recordId: 'person123',
        organizationId: 'org123',
        updateData: { organization: null }
      });

      expect(result.valid).toBe(false);
      expect(result.code).toBe('UNLINK_BLOCKED_BY_ACTIVE_DEALS');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].count).toBe(2);
    });
  });

  describe('validateTypeMutation', () => {
    it('should allow adding new types', async () => {
      Organization.findOne.mockResolvedValue({
        _id: 'org123',
        types: ['Customer']
      });

      const result = await validateTypeMutation({
        moduleKey: 'organizations',
        recordId: 'org123',
        organizationId: 'tenant123',
        updateData: { types: ['Customer', 'Partner'] }
      });

      expect(result.valid).toBe(true);
      expect(result.code).toBe('TYPE_MUTATION_ALLOWED');
    });

    it('should block removal of existing types', async () => {
      Organization.findOne.mockResolvedValue({
        _id: 'org123',
        types: ['Customer', 'Partner']
      });

      const result = await validateTypeMutation({
        moduleKey: 'organizations',
        recordId: 'org123',
        organizationId: 'tenant123',
        updateData: { types: ['Customer'] }
      });

      expect(result.valid).toBe(false);
      expect(result.code).toBe('TYPE_REMOVAL_NOT_ALLOWED');
      expect(result.errors[0].removedTypes).toContain('Partner');
    });
  });

  describe('validateRoleInvariant', () => {
    it('should allow setting primaryContact for Partner organization', async () => {
      Organization.findOne.mockResolvedValue({
        _id: 'org123',
        types: ['Partner'],
        primaryContact: null
      });
      People.findOne.mockResolvedValue({
        _id: 'person123',
        email: 'test@example.com'
      });

      const result = await validateRoleInvariant({
        moduleKey: 'organizations',
        recordId: 'org123',
        organizationId: 'tenant123',
        updateData: { types: ['Partner'], primaryContact: 'person123' }
      });

      expect(result.valid).toBe(true);
    });

    it('should block duplicate Partner Contact creation', async () => {
      Organization.findOne.mockResolvedValue({
        _id: 'org123',
        types: ['Partner'],
        primaryContact: 'person1'
      });
      People.findOne
        .mockResolvedValueOnce({ _id: 'person1', email: 'test@example.com' })
        .mockResolvedValueOnce({ _id: 'person2', email: 'test@example.com' });

      const result = await validateRoleInvariant({
        moduleKey: 'organizations',
        recordId: 'org123',
        organizationId: 'tenant123',
        updateData: { types: ['Partner'], primaryContact: 'person2' }
      });

      expect(result.valid).toBe(false);
      expect(result.code).toBe('PARTNER_CONTACT_DUPLICATE');
    });
  });
});
