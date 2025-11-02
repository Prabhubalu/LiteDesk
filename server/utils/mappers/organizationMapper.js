/**
 * DEPRECATED: Organization Mapper
 * 
 * This mapper was used to convert between Organization (v1/tenant) and OrganizationV2 (CRM).
 * After consolidation, organizations are now unified in a single Organization model
 * with an isTenant flag to distinguish tenant vs CRM organizations.
 * 
 * This file is kept for reference but is no longer used in the codebase.
 */

// Maps Organization (v1/tenant) -> CRM Organization fields
exports.orgV1ToV2Doc = function(orgDoc) {
  return {
    legacyOrganizationId: orgDoc._id,
    name: orgDoc.name,
    types: [],
    website: orgDoc.settings?.website || undefined,
    phone: orgDoc.settings?.phone || undefined,
    address: orgDoc.settings?.address || undefined,
    industry: orgDoc.industry,
  };
};

// Map an incoming update payload to CRM organization update doc
exports.orgUpdateReqToV2 = function(reqBody) {
  const update = {};
  if (typeof reqBody.name === 'string') update.name = reqBody.name;
  if (typeof reqBody.industry === 'string') update.industry = reqBody.industry;
  if (reqBody.settings) {
    if (typeof reqBody.settings.website === 'string') update.website = reqBody.settings.website;
    if (typeof reqBody.settings.phone === 'string') update.phone = reqBody.settings.phone;
    if (typeof reqBody.settings.address === 'string') update.address = reqBody.settings.address;
  }
  if (Array.isArray(reqBody.types)) update.types = reqBody.types;
  if (typeof reqBody.website === 'string') update.website = reqBody.website;
  if (typeof reqBody.phone === 'string') update.phone = reqBody.phone;
  if (typeof reqBody.address === 'string') update.address = reqBody.address;
  if (reqBody.primaryContact) update.primaryContact = reqBody.primaryContact;
  if (reqBody.assignedTo) update.assignedTo = reqBody.assignedTo;
  return update;
};

// Map CRM organization to a tenant-like view (for backward compatibility)
exports.orgV2ToV1View = function(orgV2, baseV1) {
  const v1 = baseV1 ? { ...baseV1 } : {};
  v1.name = orgV2.name || v1.name;
  v1.industry = orgV2.industry || v1.industry;
  v1._v2 = {
    types: orgV2.types,
    website: orgV2.website,
    phone: orgV2.phone,
    address: orgV2.address
  };
  return v1;
};
