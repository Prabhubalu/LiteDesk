import { describe, expect, it } from 'vitest';
import {
  getModuleAccessMode,
  resolveDisplayAccessMode,
  shouldShowModuleActionEditor
} from '../rolePermissionEditorUtils';

describe('getModuleAccessMode', () => {
  const peopleNoDelete = {
    key: 'people',
    actions: ['read', 'create', 'update', 'export', 'import']
  };

  const peopleFull = {
    key: 'people',
    actions: ['read', 'create', 'update', 'delete', 'export', 'import']
  };

  it('returns full when all supported CRUD is on and module has no delete action', () => {
    expect(
      getModuleAccessMode(peopleNoDelete, {
        read: true,
        create: true,
        update: true,
        export: false,
        import: false
      })
    ).toBe('full');
  });

  it('returns edit when delete is supported but off', () => {
    expect(
      getModuleAccessMode(peopleFull, {
        read: true,
        create: true,
        update: true,
        delete: false,
        export: false,
        import: false
      })
    ).toBe('edit');
  });

  it('returns full when delete is supported and on', () => {
    expect(
      getModuleAccessMode(peopleFull, {
        read: true,
        create: true,
        update: true,
        delete: true,
        export: false,
        import: false
      })
    ).toBe('full');
  });
});

describe('resolveDisplayAccessMode', () => {
  const module = { key: 'people', actions: ['read', 'create', 'update', 'delete'] };
  const fullPerms = { read: true, create: true, update: true, delete: true };

  it('returns custom when module is in custom edit set even if perms match full', () => {
    expect(resolveDisplayAccessMode(module, fullPerms, new Set(['people']))).toBe('custom');
  });

  it('returns inferred mode when not in custom edit set', () => {
    expect(resolveDisplayAccessMode(module, fullPerms, new Set())).toBe('full');
  });
});

describe('shouldShowModuleActionEditor', () => {
  const module = { key: 'people', actions: ['read', 'create', 'update', 'delete'] };

  it('shows editor for custom edit set even when perms are none', () => {
    expect(
      shouldShowModuleActionEditor(
        module,
        { read: false, create: false, update: false, delete: false },
        new Set(['people'])
      )
    ).toBe(true);
  });

  it('shows editor for any non-none preset', () => {
    expect(
      shouldShowModuleActionEditor(module, { read: true, create: false, update: false, delete: false })
    ).toBe(true);
  });

  it('hides editor for none without custom edit set', () => {
    expect(
      shouldShowModuleActionEditor(
        module,
        { read: false, create: false, update: false, delete: false }
      )
    ).toBe(false);
  });
});
