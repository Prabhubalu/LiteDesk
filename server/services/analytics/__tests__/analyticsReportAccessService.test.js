const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_REPORT_PERMISSIONS,
  normalizeReportPermissions,
  isReportOwner,
  passesVisibility,
  passesPermissionLevel,
} = require('../analyticsReportAccessService');

describe('analyticsReportAccessService', () => {
  const ownerId = '507f1f77bcf86cd799439011';
  const otherUserId = '507f1f77bcf86cd799439012';
  const roleId = '607f1f77bcf86cd799439021';
  const teamId = '707f1f77bcf86cd799439031';

  const owner = { _id: ownerId, roleId, isOwner: true };
  const viewer = { _id: otherUserId, roleId: '607f1f77bcf86cd799439099' };

  const publishedOrgReport = {
    _id: '1',
    ownerId,
    createdBy: ownerId,
    status: 'published',
    visibility: 'organization',
    sharedWith: [],
    permissions: DEFAULT_REPORT_PERMISSIONS,
  };

  it('normalizeReportPermissions applies defaults', () => {
    assert.deepEqual(normalizeReportPermissions(null), DEFAULT_REPORT_PERMISSIONS);
    assert.equal(normalizeReportPermissions({ edit: 'owner' }).edit, 'owner');
  });

  it('owner always passes visibility', () => {
    assert.equal(
      passesVisibility(owner, { ...publishedOrgReport, visibility: 'private' }, {}),
      true,
    );
    assert.equal(isReportOwner(owner, publishedOrgReport), true);
  });

  it('organization published report is visible to org users', () => {
    assert.equal(passesVisibility(viewer, publishedOrgReport, {}), true);
  });

  it('private draft is not visible to non-owners', () => {
    const draft = {
      ...publishedOrgReport,
      status: 'draft',
      visibility: 'private',
    };
    assert.equal(passesVisibility(viewer, draft, {}), false);
    assert.equal(passesVisibility(owner, draft, {}), true);
  });

  it('team visibility requires shared team membership', () => {
    const report = {
      ...publishedOrgReport,
      visibility: 'team',
      sharedWith: [{ type: 'team', id: teamId }],
    };
    assert.equal(
      passesVisibility(viewer, report, { userGroupIds: [teamId], userRoleId: viewer.roleId }),
      true,
    );
    assert.equal(
      passesVisibility(viewer, report, { userGroupIds: [], userRoleId: viewer.roleId }),
      false,
    );
  });

  it('role visibility requires matching role', () => {
    const report = {
      ...publishedOrgReport,
      visibility: 'role',
      sharedWith: [{ type: 'role', id: roleId }],
    };
    assert.equal(passesVisibility(owner, report, { userRoleId: roleId, userGroupIds: [] }), true);
    assert.equal(
      passesVisibility(viewer, report, { userRoleId: viewer.roleId, userGroupIds: [] }),
      false,
    );
  });

  it('permission level owner blocks non-owners', () => {
    const report = {
      ...publishedOrgReport,
      permissions: { ...DEFAULT_REPORT_PERMISSIONS, edit: 'owner' },
    };
    assert.equal(passesPermissionLevel(viewer, report, 'edit'), false);
    assert.equal(passesPermissionLevel(owner, report, 'edit'), true);
  });

  it('clone permission owner-only blocks non-owners', () => {
    const report = {
      ...publishedOrgReport,
      permissions: { ...DEFAULT_REPORT_PERMISSIONS, clone: 'owner' },
    };
    assert.equal(passesPermissionLevel(viewer, report, 'clone'), false);
    assert.equal(passesPermissionLevel(owner, report, 'clone'), true);
  });

  it('export permission owner-only blocks non-owners', () => {
    const report = {
      ...publishedOrgReport,
      permissions: { ...DEFAULT_REPORT_PERMISSIONS, export: 'owner' },
    };
    assert.equal(passesPermissionLevel(viewer, report, 'export'), false);
    assert.equal(passesPermissionLevel(owner, report, 'export'), true);
  });

  it('share permission owner-only blocks non-owners', () => {
    const report = {
      ...publishedOrgReport,
      permissions: { ...DEFAULT_REPORT_PERMISSIONS, share: 'owner' },
    };
    assert.equal(passesPermissionLevel(viewer, report, 'share'), false);
    assert.equal(passesPermissionLevel(owner, report, 'share'), true);
  });

  it('editors permission level requires update capability for viewers', () => {
    const report = {
      ...publishedOrgReport,
      permissions: { ...DEFAULT_REPORT_PERMISSIONS, edit: 'editors' },
    };
    const viewerWithoutUpdate = { ...viewer, permissions: { reports: { view: true } } };
    assert.equal(passesPermissionLevel(viewerWithoutUpdate, report, 'edit'), false);
  });
});
