/**
 * Pair CRM organization + contact (people) lookup fields on the same form so we can:
 * - Pass `organization` list filter to /people when an org is selected.
 * - On contact change: set the paired org from the person’s `organization` (see `getOrgContactCoordinatedPatches`).
 * - On org change: if the current contact’s org no longer matches, clear the contact.
 * - Record inline save applies the same rules in GenericRecordContent `saveDetailField`.
 */

const TENANT_ORG_KEYS = new Set(['organizationid']);

/** @type {Record<string, { orgKey: string, contactKey: string }>} */
const PREDEFINED_PAIRS = {
  deals: { orgKey: 'accountId', contactKey: 'contactId' },
  cases: { orgKey: 'organizationRefId', contactKey: 'contactId' },
  invoices: { orgKey: 'organizationRefId', contactKey: 'contactId' },
  quotes: { orgKey: 'organizationRefId', contactKey: 'contactId' },
};

/** Collapse to compare settings/API keys: "Contact Id", "contactId", "contactid" all match. */
export function normalizeFieldKeyLoose(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function findFieldByLooseName(fields, targetKey) {
  if (!Array.isArray(fields) || !targetKey) return null;
  const t = normalizeFieldKeyLoose(targetKey);
  if (!t) return null;
  return fields.find((f) => normalizeFieldKeyLoose(f?.key) === t) || null;
}

function isCrmOrganizationLookupField(f) {
  const t = String(f?.lookupSettings?.targetModule || '').toLowerCase();
  if (t !== 'organizations' && t !== 'organization') return false;
  const k = normalizeFieldKeyLoose(f?.key);
  if (TENANT_ORG_KEYS.has(k)) return false;
  return true;
}

function isPeopleLookupField(f) {
  const t = String(f?.lookupSettings?.targetModule || '').toLowerCase();
  if (t === 'people' || t === 'person' || t === 'contact') return true;
  const k = normalizeFieldKeyLoose(f?.key);
  if (k === 'contactid' || k === 'personid') return true;
  const dt = String(f?.dataType || '').toLowerCase();
  if (dt === 'entity' && (k === 'contactid' || k === 'personid')) return true;
  return false;
}

function hasFieldKey(fields, key) {
  return !!findFieldByLooseName(fields, key);
}

/**
 * @param {string} moduleKey
 * @param {Array<object>} fields
 * @returns {{ orgKey: string, contactKey: string } | null}
 */
export function resolveOrgContactPair(moduleKey, fields) {
  const mk = String(moduleKey || '').toLowerCase();
  const preset = PREDEFINED_PAIRS[mk];
  if (preset) {
    const fieldList = Array.isArray(fields) ? fields : [];
    const orgField = findFieldByLooseName(fieldList, preset.orgKey);
    const contactField = findFieldByLooseName(fieldList, preset.contactKey);
    return {
      orgKey: orgField?.key ?? preset.orgKey,
      contactKey: contactField?.key ?? preset.contactKey
    };
  }

  if (!Array.isArray(fields) || fields.length === 0) return null;

  const orgLookups = fields.filter(isCrmOrganizationLookupField);
  const peopleLookups = fields.filter(isPeopleLookupField);
  if (orgLookups.length === 1 && peopleLookups.length === 1) {
    return { orgKey: orgLookups[0].key, contactKey: peopleLookups[0].key };
  }
  return null;
}

/**
 * @param {object} field
 * @param {string} contactFieldKey
 */
export function isPairedContactLookupField(field, contactFieldKey) {
  if (!field || !contactFieldKey) return false;
  if (normalizeFieldKeyLoose(field.key) !== normalizeFieldKeyLoose(contactFieldKey)) return false;
  return isPeopleLookupField(field);
}

/**
 * Merges lookup query for paired org + contact:
 * - Contact field: `lookupQuery.organization` when an org is selected (people list filtered to that org).
 * - Organization field: `lookupQuery.ids` when a contact is selected (org list shows only that contact’s org).
 * @param {object} depState from getFieldDependencyState
 */
export function mergeOrgContactLookupForField(field, depState, formData, moduleKey, allFields) {
  const pair = resolveOrgContactPair(moduleKey, allFields);
  if (!pair) return depState;

  const base = depState && typeof depState === 'object' ? { ...depState } : {};
  const prevQ =
    base.lookupQuery && typeof base.lookupQuery === 'object' ? { ...base.lookupQuery } : {};

  if (isPairedContactLookupField(field, pair.contactKey)) {
    const orgVal = formData?.[pair.orgKey];
    const orgId = extractIdFromFormValue(orgVal);
    if (!orgId) {
      const { organization: _o, ...rest } = prevQ;
      return { ...base, lookupQuery: Object.keys(rest).length ? rest : null };
    }
    return {
      ...base,
      lookupQuery: { ...prevQ, organization: orgId },
    };
  }

  if (
    normalizeFieldKeyLoose(field?.key) === normalizeFieldKeyLoose(pair.orgKey) &&
    isCrmOrganizationLookupField(field)
  ) {
    const contactVal = formData?.[pair.contactKey];
    const contactId = extractIdFromFormValue(contactVal);
    if (!contactId) {
      const { ids: _i, ...rest } = prevQ;
      return { ...base, lookupQuery: Object.keys(rest).length ? rest : null };
    }
    const orgFromForm = extractIdFromFormValue(formData?.[pair.orgKey]);
    const orgFromContact =
      typeof contactVal === 'object' && contactVal != null
        ? extractOrganizationIdFromPersonPayload(contactVal)
        : null;
    const restrictOrgId = orgFromForm || orgFromContact;
    if (restrictOrgId) {
      return {
        ...base,
        lookupQuery: { ...prevQ, ids: String(restrictOrgId) },
      };
    }
    const { ids: _i2, ...rest2 } = prevQ;
    return { ...base, lookupQuery: Object.keys(rest2).length ? rest2 : null };
  }

  return depState;
}

export function extractIdFromFormValue(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') {
    if (v._id !== undefined && v._id !== null && v._id !== '') return v._id;
    if (v.id !== undefined && v.id !== null && v.id !== '') return v.id;
    return null;
  }
  const s = String(v).trim();
  return s === '' ? null : v;
}

/** People GET payload may nest under .data; organization may be id or populated. */
/** Normalize GET /api/people/:id style `{ success, data: person }` (no nested data.data) */
export function unwrapRecordFromListOrGetResponse(r) {
  if (!r || r.success === false) return null;
  const d = r.data;
  if (d == null) return null;
  if (typeof d === 'object' && d._id != null) return d;
  if (d && typeof d === 'object' && d.data && typeof d.data === 'object' && d.data._id != null) {
    return d.data;
  }
  return null;
}

export function extractOrganizationIdFromPersonPayload(person) {
  if (!person) return null;
  const o = person.organization ?? person.accountId ?? null;
  if (o === null || o === undefined || o === '') return null;
  if (typeof o === 'object') {
    return o._id ?? o.id ?? null;
  }
  return o;
}

/**
 * Resolve a people row from an in-memory contact lookup list (list GET includes populated `organization`).
 * @param {unknown} contactValue id or partial row
 * @param {Array<Record<string, unknown>>} contactRows
 */
export function resolvePersonFromContactLookupList(contactValue, contactRows) {
  if (contactValue != null && typeof contactValue === 'object' && contactValue._id != null) {
    return contactValue;
  }
  const id = extractIdFromFormValue(contactValue);
  if (!id || !Array.isArray(contactRows)) return contactValue;
  return contactRows.find((p) => String(p?._id ?? p?.id) === String(id)) || contactValue;
}

function keysMatch(a, b) {
  return normalizeFieldKeyLoose(a) === normalizeFieldKeyLoose(b);
}

/**
 * After the user changes org or contact, return extra field updates to keep the pair consistent.
 * `formAfter` must already include the changed field (e.g. `{ ...form, [changedKey]: newValue }`).
 *
 * @param {object} args
 * @param {{ orgKey: string, contactKey: string }} args.pair
 * @param {Record<string, unknown>} args.formAfter
 * @param {string} args.changedKey
 * @param {unknown} args.newValue
 * @param {(id: string) => Promise<Record<string, unknown>|null|undefined>} args.fetchPersonById
 * @returns {Promise<Record<string, unknown>>}
 */
export async function getOrgContactCoordinatedPatches({
  pair,
  formAfter,
  changedKey,
  newValue,
  fetchPersonById,
}) {
  if (!pair || !formAfter) return {};
  const { orgKey, contactKey } = pair;
  const out = {};

  if (keysMatch(changedKey, orgKey)) {
    const newOrgId = extractIdFromFormValue(newValue);
    const contactVal = formAfter[contactKey];
    const cId = extractIdFromFormValue(contactVal);
    if (!cId) return out;
    let contactOrgId = null;
    if (typeof contactVal === 'object' && contactVal != null) {
      contactOrgId = extractOrganizationIdFromPersonPayload(contactVal);
    }
    if (contactOrgId == null) {
      const p = await fetchPersonById(String(cId));
      if (p) contactOrgId = extractOrganizationIdFromPersonPayload(p);
    }
    if (newOrgId != null && newOrgId !== '' && contactOrgId != null && String(contactOrgId) !== String(newOrgId)) {
      out[contactKey] = null;
    }
    return out;
  }

  if (keysMatch(changedKey, contactKey)) {
    const cId = extractIdFromFormValue(newValue);
    if (!cId) return out;
    let person = null;
    if (typeof newValue === 'object' && newValue != null && newValue._id != null) {
      person = newValue;
    } else {
      person = await fetchPersonById(String(cId));
    }
    const orgId = person ? extractOrganizationIdFromPersonPayload(person) : null;
    if (orgId) {
      out[orgKey] = orgId;
    }
    return out;
  }

  return out;
}
