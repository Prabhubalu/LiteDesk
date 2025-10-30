// Maps Contact (v1) <-> People (new)

exports.contactToPeopleDoc = function(contactDoc, context) {
  const orgId = contactDoc.organizationId || context?.organizationId;
  const ownerId = contactDoc.owner_id || context?.assignedTo;
  const createdBy = context?.createdBy || ownerId;

  return {
    organizationId: orgId,
    createdBy: createdBy,
    assignedTo: ownerId,
    legacyContactId: contactDoc._id,

    // core
    source: contactDoc.lead_source,
    type: contactDoc.lifecycle_stage === 'Lead' ? 'Lead' : 'Contact',
    first_name: contactDoc.first_name,
    last_name: contactDoc.last_name,
    email: contactDoc.email,
    phone: contactDoc.phone,
    mobile: contactDoc.mobile,
    organization: contactDoc.organization,
    tags: contactDoc.tags || [],
    do_not_contact: !!contactDoc.do_not_contact,

    // lead-specific
    lead_status: mapLeadStatus(contactDoc.lifecycle_stage),
    lead_owner: contactDoc.owner_id,
    lead_score: contactDoc.score,

    // contact-specific
    contact_status: mapContactStatus(contactDoc.status),
    preferred_contact_method: contactDoc.preferred_channel ? capitalize(contactDoc.preferred_channel) : undefined
  };
};

// Map People doc to a Contact-like view for backward-compatible responses
exports.peopleToContactView = function(people) {
  return {
    _id: people.legacyContactId || people._id,
    organizationId: people.organizationId,
    first_name: people.first_name,
    last_name: people.last_name,
    email: people.email,
    phone: people.phone,
    mobile: people.mobile,
    organization: people.organization,
    owner_id: people.assignedTo,
    tags: people.tags,
    do_not_contact: people.do_not_contact,
    lead_source: people.source,
    lifecycle_stage: people.type === 'Lead' ? 'Lead' : 'Customer',
    status: people.contact_status === 'DoNotContact' ? 'Inactive' : (people.contact_status || 'Active'),
    preferred_channel: people.preferred_contact_method ? people.preferred_contact_method.toLowerCase() : undefined,
    createdAt: people.createdAt,
    updatedAt: people.updatedAt
  };
};

function mapLeadStatus(stage) {
  if (!stage) return undefined;
  const map = {
    Lead: 'New',
    Qualified: 'Qualified',
    Customer: 'Contact',
    Lost: 'Disqualified'
  };
  return map[stage] || undefined;
}

function mapContactStatus(status) {
  if (!status) return undefined;
  const map = { Active: 'Active', Inactive: 'Inactive', Archived: 'Inactive' };
  return map[status] || undefined;
}

function capitalize(s) { return typeof s === 'string' ? s.charAt(0).toUpperCase() + s.slice(1) : s; }


