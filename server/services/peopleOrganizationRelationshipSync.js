const RelationshipInstance = require('../models/RelationshipInstance');

function normalizeObjectIdLike(value) {
  if (!value) return null;
  if (typeof value === 'object') {
    return value._id ? String(value._id) : String(value);
  }
  return String(value);
}

/**
 * Keep people_organizations relationship instances aligned with People.organization.
 */
async function syncPeopleOrganizationRelationship({
  tenantOrganizationId,
  personId,
  organizationValue,
  userId
}) {
  const normalizedPersonId = normalizeObjectIdLike(personId);
  const normalizedOrgId = normalizeObjectIdLike(organizationValue);
  if (!normalizedPersonId) return;

  await RelationshipInstance.deleteMany({
    organizationId: tenantOrganizationId,
    relationshipKey: 'people_organizations',
    $or: [
      {
        'source.appKey': 'sales',
        'source.moduleKey': 'people',
        'source.recordId': normalizedPersonId
      },
      {
        'target.appKey': 'sales',
        'target.moduleKey': 'people',
        'target.recordId': normalizedPersonId
      }
    ]
  });

  if (!normalizedOrgId) return;

  await RelationshipInstance.updateOne(
    {
      organizationId: tenantOrganizationId,
      relationshipKey: 'people_organizations',
      'source.appKey': 'sales',
      'source.moduleKey': 'people',
      'source.recordId': normalizedPersonId,
      'target.appKey': 'sales',
      'target.moduleKey': 'organizations',
      'target.recordId': normalizedOrgId
    },
    {
      $setOnInsert: {
        createdBy: userId,
        source: {
          appKey: 'sales',
          moduleKey: 'people',
          recordId: normalizedPersonId
        },
        target: {
          appKey: 'sales',
          moduleKey: 'organizations',
          recordId: normalizedOrgId
        }
      }
    },
    { upsert: true }
  );
}

module.exports = {
  syncPeopleOrganizationRelationship,
  normalizeObjectIdLike
};
