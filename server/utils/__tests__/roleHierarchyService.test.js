const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  repairStandardRoleHierarchy,
  sortHierarchyChildren,
  reorderSiblingRoles,
  syncRoleUserCounts,
  backfillMissingUserRoleIds
} = require('../../services/roleHierarchyService');

function makeRole(id, name, parentRole = null) {
  return {
    _id: id,
    name,
    parentRole,
    level: 0,
    save: async function save() {
      return this;
    }
  };
}

test('repairStandardRoleHierarchy — Viewer sibling of Manager under Admin', async () => {
  const owner = makeRole('owner', 'Owner');
  const admin = makeRole('admin', 'Admin', 'owner');
  const manager = makeRole('manager', 'Manager', 'admin');
  const user = makeRole('user', 'User', 'manager');
  const viewer = makeRole('viewer', 'Viewer', 'user');

  const roles = [owner, admin, manager, user, viewer];
  const RoleModel = {
    find: () => ({
      select: async () => roles
    })
  };

  const result = await repairStandardRoleHierarchy('org-1', { RoleModel });

  assert.equal(result.repaired, true);
  assert.equal(String(viewer.parentRole), 'admin');
  assert.equal(String(user.parentRole), 'manager');
  assert.equal(String(manager.parentRole), 'admin');
  assert.equal(String(admin.parentRole), 'owner');
  assert.equal(owner.parentRole, null);
});

test('repairStandardRoleHierarchy — idempotent when already correct', async () => {
  const owner = makeRole('owner', 'Owner');
  const admin = makeRole('admin', 'Admin', 'owner');
  const manager = makeRole('manager', 'Manager', 'admin');
  const user = makeRole('user', 'User', 'manager');
  const viewer = makeRole('viewer', 'Viewer', 'admin');

  const roles = [owner, admin, manager, user, viewer];
  const RoleModel = {
    find: () => ({
      select: async () => roles
    })
  };

  const result = await repairStandardRoleHierarchy('org-1', { RoleModel });
  assert.equal(result.repaired, false);
  assert.equal(result.changes.length, 0);
});

test('sortHierarchyChildren — sortOrder ascending', () => {
  const children = [
    { name: 'Viewer', sortOrder: 2, children: [] },
    { name: 'Manager', sortOrder: 0, children: [] },
    { name: 'Helpdesk Manager', sortOrder: 1, children: [] }
  ];

  sortHierarchyChildren(children);

  assert.equal(children[0].name, 'Manager');
  assert.equal(children[1].name, 'Helpdesk Manager');
  assert.equal(children[2].name, 'Viewer');
});

test('backfillMissingUserRoleIds — links legacy owner enum to Owner role', async () => {
  const ownerRole = { _id: 'owner-role', name: 'Owner' };
  const roles = [ownerRole, { _id: 'admin-role', name: 'Admin' }];
  const user = {
    _id: 'user-1',
    role: 'owner',
    roleId: null,
    isOwner: true,
    save: async function save() { return this; }
  };

  const RoleModel = {
    find: () => ({
      select: async () => roles
    })
  };
  const UserModel = {
    find: () => ({
      select: async () => [user]
    })
  };

  const result = await backfillMissingUserRoleIds('org-1', { RoleModel, UserModel });
  assert.equal(result.updated, 1);
  assert.equal(String(user.roleId), 'owner-role');
});

test('syncRoleUserCounts — reconciles role userCount from users', async () => {
  const roles = [
    { _id: 'owner', name: 'Owner', userCount: 0, save: async function save() { return this; } },
    { _id: 'admin', name: 'Admin', userCount: 0, save: async function save() { return this; } }
  ];

  const RoleModel = {
    find: () => ({
      select: async () => roles
    })
  };

  const UserModel = {
    find: () => ({
      select: async () => []
    }),
    aggregate: async () => [{ _id: 'owner', count: 1 }]
  };

  const result = await syncRoleUserCounts('org-1', RoleModel, UserModel);
  assert.equal(result.updated, 1);
  assert.equal(roles[0].userCount, 1);
  assert.equal(roles[1].userCount, 0);
});

test('reorderSiblingRoles — moves Viewer before Helpdesk Manager', async () => {
  const saves = [];
  const roles = [
    { _id: 'admin', name: 'Admin', parentRole: null, sortOrder: 0, save: async function save() { saves.push(this); return this; } },
    { _id: 'manager', name: 'Manager', parentRole: 'admin', sortOrder: 0, save: async function save() { saves.push(this); return this; } },
    { _id: 'viewer', name: 'Viewer', parentRole: 'admin', sortOrder: 2, save: async function save() { saves.push(this); return this; } },
    { _id: 'helpdesk', name: 'Helpdesk Manager', parentRole: 'admin', sortOrder: 1, save: async function save() { saves.push(this); return this; } }
  ];

  const RoleModel = {
    findOne: async ({ _id }) => roles.find((r) => r._id === _id) || null,
    find: (query) => {
      const parent = query.parentRole;
      const matches = roles
        .filter((r) => String(r.parentRole || null) === String(parent || null))
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
      return {
        sort: () => Promise.resolve(matches)
      };
    }
  };

  await reorderSiblingRoles('org-1', 'viewer', {
    RoleModel,
    parentRoleId: 'admin',
    insertBeforeRoleId: 'helpdesk'
  });

  const adminChildren = roles
    .filter((r) => r.parentRole === 'admin')
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((r) => r.name);

  assert.deepEqual(adminChildren, ['Manager', 'Viewer', 'Helpdesk Manager']);
});
