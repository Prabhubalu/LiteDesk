import { describe, expect, it } from 'vitest';
import { createPermissionSnapshot } from '@/types/permission-snapshot.types';
import {
  hasPortalModuleAccess,
  isPortalDocumentsModuleKey,
  isPortalKnowledgeModuleKey,
  resolvePortalModulePermission
} from '@/utils/portalModulePermissions';

describe('portalModulePermissions', () => {
  it('maps document and knowledge keys to documents.read', () => {
    expect(resolvePortalModulePermission('documents')).toBe('documents.read');
    expect(resolvePortalModulePermission('portal_documents')).toBe('documents.read');
    expect(resolvePortalModulePermission('knowledge-base')).toBe('documents.read');
    expect(resolvePortalModulePermission('portal_knowledge')).toBe('documents.read');
  });

  it('separates knowledge surface from documents library keys', () => {
    expect(isPortalKnowledgeModuleKey('knowledge-base')).toBe(true);
    expect(isPortalKnowledgeModuleKey('portal_knowledge')).toBe(true);
    expect(isPortalKnowledgeModuleKey('documents')).toBe(false);
    expect(isPortalDocumentsModuleKey('documents')).toBe(true);
    expect(isPortalDocumentsModuleKey('portal_documents')).toBe(true);
    expect(isPortalDocumentsModuleKey('portal_knowledge')).toBe(false);
  });

  it('hasPortalModuleAccess mirrors people/contacts and responses/forms inheritance', () => {
    const snapshot = createPermissionSnapshot({
      permissions: {
        contacts: { view: true, create: false, edit: false, delete: false },
        forms: { view: true, create: false, edit: false, delete: false },
        cases: { view: false, create: false, edit: false, delete: false },
        events: { view: false, create: false, edit: false, delete: false }
      }
    });

    expect(hasPortalModuleAccess(snapshot, 'portal_people')).toBe(true);
    expect(hasPortalModuleAccess(snapshot, 'portal_responses')).toBe(true);
    expect(hasPortalModuleAccess(snapshot, 'portal_support')).toBe(false);
    expect(hasPortalModuleAccess(snapshot, 'portal_actions')).toBe(false);
  });

  it('hasPortalModuleAccess denies unmapped portal module keys', () => {
    const snapshot = createPermissionSnapshot({
      permissions: {
        deals: { view: true, create: false, edit: false, delete: false }
      }
    });

    expect(hasPortalModuleAccess(snapshot, 'unknown_surface')).toBe(false);
  });

  it('hasPortalModuleAccess grants documents library from documents.read', () => {
    const snapshot = createPermissionSnapshot({
      permissions: {
        documents: { view: true, create: false, edit: false, delete: false }
      }
    });

    expect(hasPortalModuleAccess(snapshot, 'portal_documents')).toBe(true);
    expect(hasPortalModuleAccess(snapshot, 'portal_knowledge')).toBe(true);
  });
});
