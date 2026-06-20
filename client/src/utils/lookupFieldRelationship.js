function normFieldKey(key) {
  return String(key || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Canonical lookup field → relationship mapping (matches server recordContextService). */
const CANONICAL_LOOKUP_FIELD_RELATIONSHIPS = Object.freeze({
  people: {
    organization: { relationshipKey: 'people_organizations', targetModuleKey: 'organizations', appKey: 'SALES' }
  },
  deals: {
    accountid: { relationshipKey: 'deal_organizations', targetModuleKey: 'organizations', appKey: 'SALES' },
    contactid: { relationshipKey: 'deal_contacts', targetModuleKey: 'people', appKey: 'SALES' }
  },
  cases: {
    contactid: { relationshipKey: 'case_people', targetModuleKey: 'people', appKey: 'SALES' },
    organizationrefid: { relationshipKey: 'case_organizations', targetModuleKey: 'organizations', appKey: 'SALES' },
    accountid: { relationshipKey: 'case_organizations', targetModuleKey: 'organizations', appKey: 'SALES' }
  },
  quotes: {
    contactid: { relationshipKey: 'quote_people', targetModuleKey: 'people', appKey: 'SALES' },
    organizationrefid: { relationshipKey: 'quote_organizations', targetModuleKey: 'organizations', appKey: 'SALES' },
    dealid: { relationshipKey: 'quote_deals', targetModuleKey: 'deals', appKey: 'SALES' },
    caseid: { relationshipKey: 'quote_cases', targetModuleKey: 'cases', appKey: 'SALES' }
  },
  invoices: {
    contactid: { relationshipKey: 'quote_people', targetModuleKey: 'people', appKey: 'SALES' },
    organizationrefid: { relationshipKey: 'quote_organizations', targetModuleKey: 'organizations', appKey: 'SALES' },
    dealid: { relationshipKey: 'quote_deals', targetModuleKey: 'deals', appKey: 'SALES' }
  },
  events: {
    dealid: { relationshipKey: 'deal_events', targetModuleKey: 'deals', appKey: 'SALES' }
  }
});

/**
 * Resolve a saved lookup/key field to its relationship metadata.
 */
export function resolveLookupFieldRelationship(moduleKey, fieldKey, moduleDefinition) {
  const moduleKeyLower = String(moduleKey || '').toLowerCase();
  const fieldKeyNorm = normFieldKey(fieldKey);
  if (!moduleKeyLower || !fieldKeyNorm) return null;

  const relationships = Array.isArray(moduleDefinition?.relationships) ? moduleDefinition.relationships : [];
  const fields = Array.isArray(moduleDefinition?.fields) ? moduleDefinition.fields : [];

  for (const rel of relationships) {
    if (!rel?.isLookup) continue;
    const targetModuleKey = String(rel.targetModuleKey || '').toLowerCase();
    const relationshipKey = String(rel.relationshipKey || '').toLowerCase();
    if (!targetModuleKey || !relationshipKey) continue;

    const localFieldNorm = rel.localField ? normFieldKey(rel.localField) : '';
    if (localFieldNorm && localFieldNorm === fieldKeyNorm) {
      return { relationshipKey, targetModuleKey, appKey: 'SALES' };
    }

    const fieldDef = fields.find((field) => normFieldKey(field?.key) === fieldKeyNorm);
    if (!fieldDef) continue;

    const dataType = String(fieldDef.dataType || '').toLowerCase();
    if (!dataType.includes('lookup')) continue;

    const lookupTarget = String(fieldDef.lookupSettings?.targetModule || '').toLowerCase();
    if (lookupTarget && lookupTarget !== targetModuleKey) continue;

    return { relationshipKey, targetModuleKey, appKey: 'SALES' };
  }

  const canonical = CANONICAL_LOOKUP_FIELD_RELATIONSHIPS[moduleKeyLower]?.[fieldKeyNorm];
  return canonical ? { ...canonical } : null;
}

export function isLookupRelationshipField(moduleKey, fieldKey, moduleDefinition) {
  return !!resolveLookupFieldRelationship(moduleKey, fieldKey, moduleDefinition);
}
