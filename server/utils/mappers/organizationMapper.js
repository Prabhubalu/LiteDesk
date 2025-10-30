// Maps Organization (v1) -> OrganizationV2 (new)

exports.orgV1ToV2Doc = function(orgDoc) {
  return {
    legacyOrganizationId: orgDoc._id,
    name: orgDoc.name,
    // leave types empty by default; can be set later per business logic
    types: [],
    website: orgDoc.settings?.website || undefined,
    phone: orgDoc.settings?.phone || undefined,
    address: orgDoc.settings?.address || undefined,
    industry: orgDoc.industry,
  };
};

// Map an incoming v1 update payload to OrganizationV2 update doc
exports.orgUpdateReqToV2 = function(reqBody) {
  const update = {};
  if (typeof reqBody.name === 'string') update.name = reqBody.name;
  if (typeof reqBody.industry === 'string') update.industry = reqBody.industry;
  if (reqBody.settings) {
    if (typeof reqBody.settings.website === 'string') update.website = reqBody.settings.website;
    if (typeof reqBody.settings.phone === 'string') update.phone = reqBody.settings.phone;
    if (typeof reqBody.settings.address === 'string') update.address = reqBody.settings.address;
  }
  // allow explicit OrganizationV2 fields if provided
  if (Array.isArray(reqBody.types)) update.types = reqBody.types;
  if (typeof reqBody.website === 'string') update.website = reqBody.website;
  if (typeof reqBody.phone === 'string') update.phone = reqBody.phone;
  if (typeof reqBody.address === 'string') update.address = reqBody.address;
  if (reqBody.primaryContact) update.primaryContact = reqBody.primaryContact;
  if (reqBody.assignedTo) update.assignedTo = reqBody.assignedTo;
  return update;
};

// Optionally map OrganizationV2 to a v1-like view for non-breaking responses
exports.orgV2ToV1View = function(orgV2, baseV1) {
  // Preserve existing v1 structure, overlay selected V2 fields
  const v1 = baseV1 ? { ...baseV1 } : {};
  v1.name = orgV2.name || v1.name;
  v1.industry = orgV2.industry || v1.industry;
  // Attach V2 extras in a namespaced property for clients that can use it
  v1._v2 = {
    types: orgV2.types,
    website: orgV2.website,
    phone: orgV2.phone,
    address: orgV2.address
  };
  return v1;
};


