import { ref, computed, watch, unref } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { createGenericRecordAdapter } from '@/components/record-page/adapters/genericRecordAdapter';
import { createRecordSectionLabels } from '@/utils/recordSectionLabels';
import { getModuleRecordCrudPathBase } from '@/utils/moduleRecordApiPath';
import { resolveFieldContext } from '@/utils/fieldContextFilter';
import {
  getOrgContactCoordinatedPatches,
  resolveOrgContactPair,
  unwrapRecordFromListOrGetResponse
} from '@/utils/orgContactFormPairing';
import { filterCaseEditSubmitPayload } from '@/platform/fields/caseFieldModel';
import { useNotifications } from '@/composables/useNotifications';

function casePersonRowOrgId(p) {
  if (!p) return '';
  const o = p.organization;
  if (o == null || o === '') return '';
  if (typeof o === 'object' && o._id != null) return String(o._id);
  return String(o);
}

export function caseContactOptionsForRecord(rec, allContacts) {
  if (!Array.isArray(allContacts) || allContacts.length === 0) return allContacts || [];
  if (!rec) return allContacts;
  const rawOrg = rec.organizationRefId;
  const orgId = rawOrg
    ? (typeof rawOrg === 'object' && rawOrg?._id != null ? rawOrg._id : rawOrg)
    : null;
  if (orgId == null || orgId === '') return allContacts;
  const orgStr = String(orgId);
  const filtered = allContacts.filter((p) => {
    const pid = casePersonRowOrgId(p);
    return pid && pid === orgStr;
  });
  const rawContact = rec.contactId;
  const contactId = rawContact
    ? (typeof rawContact === 'object' && rawContact?._id != null ? rawContact._id : rawContact)
    : null;
  if (!contactId) return filtered;
  if (filtered.some((p) => String(p._id) === String(contactId))) return filtered;
  const selected = allContacts.find((p) => String(p._id) === String(contactId));
  return selected ? [...filtered, selected] : filtered;
}

function isDetailRowEmpty(row) {
  if (!row || row.key === 'source') return false;
  if (row.type === 'tags') {
    const v = row.value;
    return !Array.isArray(v) || v.length === 0;
  }
  const v = row.value;
  if (v != null && typeof v === 'object' && !Array.isArray(v)) {
    const dv = row.displayValue;
    return dv == null || String(dv).trim() === '';
  }
  if (v === false || v === 0) return false;
  if (v == null || v === '') return true;
  if (typeof v === 'string' && !String(v).trim()) return true;
  if (Array.isArray(v) && v.length === 0) return true;
  const dv = row.displayValue;
  if (dv == null || String(dv).trim() === '') return true;
  return false;
}

/**
 * Module-definition-driven detail fields for the case record right pane (same adapter as People).
 */
export function useCaseRecordDetailFields({ caseRecord, caseId, canEdit, isClosed, openTab }) {
  const route = useRoute();
  const { t } = useI18n();
  const notifications = useNotifications();

  const moduleDefinition = ref(null);
  const caseContactLookupList = ref([]);
  const caseOrganizationLookupList = ref([]);
  const userLookupList = ref([]);
  const detailsTabSearchQuery = ref('');
  const detailsShowEmptyFields = ref(false);
  const lookupsLoaded = ref(false);

  const recordCrudPathBase = computed(() =>
    getModuleRecordCrudPathBase('cases', {
      appKey: route.meta?.appKey || 'HELPDESK',
      routePath: route.path
    })
  );

  const recordFieldContext = computed(() => resolveFieldContext(route.path, route.query));

  const canEditDetails = computed(() => Boolean(unref(canEdit)) && !unref(isClosed));

  const sectionContext = computed(() => ({
    expandedLeftSection: '',
    module: 'generic',
    moduleKey: 'cases',
    openTab: typeof openTab === 'function' ? openTab : undefined,
    fieldContext: recordFieldContext.value,
    hideHeader: true
  }));

  const genericAdapter = computed(() => {
    if (!unref(caseRecord)?._id || !moduleDefinition.value) return null;

    return createGenericRecordAdapter({
      sectionLabels: createRecordSectionLabels(t),
      formatDate: (d) =>
        (d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'),
      moduleDefinition: moduleDefinition.value,
      canEditDetails: () => canEditDetails.value,
      saveDetailField: async (fieldKey, value) => {
        const rec = unref(caseRecord);
        const id = unref(caseId);
        if (!rec?._id || !id) return;
        try {
          if (fieldKey === 'status') {
            const patchBody = { status: value };
            const rs = String(rec?.resolutionSummary ?? '').trim();
            if ((value === 'Resolved' || value === 'Closed') && rs) {
              patchBody.resolutionSummary = rs;
            }
            const response = await apiClient.patch(
              `${recordCrudPathBase.value}/${id}/status`,
              patchBody
            );
            if (response?.success === false) {
              throw new Error(response?.message || 'Failed to update status');
            }
            const updatedRecord = response?.data ?? null;
            rec.status = value;
            if (updatedRecord && typeof updatedRecord === 'object') {
              Object.assign(rec, updatedRecord);
            }
            return;
          }

          const caseLoose = String(fieldKey || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
          const caseCanonical = { contactid: 'contactId', organizationrefid: 'organizationRefId', caseownerid: 'caseOwnerId' }[caseLoose];
          const payloadKey = caseCanonical || fieldKey;
          const payload = { [payloadKey]: value };

          const pair = resolveOrgContactPair('cases', moduleDefinition.value?.fields || []);
          if (pair) {
            const formAfter = { ...rec, [payloadKey]: value };
            const fetchPersonById = async (personId) => {
              if (!personId) return null;
              try {
                const r = await apiClient.get(`/people/${personId}`);
                return unwrapRecordFromListOrGetResponse(r);
              } catch {
                return null;
              }
            };
            const extra = await getOrgContactCoordinatedPatches({
              pair,
              formAfter,
              changedKey: payloadKey,
              newValue: value,
              fetchPersonById
            });
            Object.assign(payload, extra);
          }

          const body = filterCaseEditSubmitPayload(payload);
          if (!Object.keys(body).length) {
            throw new Error('This field cannot be edited');
          }

          const response = await apiClient.put(`${recordCrudPathBase.value}/${id}`, body);
          if (response?.success === false) {
            throw new Error(response?.message || 'Failed to save');
          }
          const updatedRecord = response?.data?.data ?? response?.data ?? null;
          if (caseCanonical && caseCanonical !== fieldKey) {
            try {
              delete rec[fieldKey];
            } catch {
              /* ignore */
            }
          }
          if (updatedRecord && typeof updatedRecord === 'object') {
            Object.assign(rec, updatedRecord);
          } else {
            rec[payloadKey] = value;
          }
        } catch (err) {
          notifications.error(err?.message || 'Failed to save field');
          throw err;
        }
      },
      getEntityOptions: (fieldKey) => {
        const key = String(fieldKey || '').toLowerCase().trim();
        if (key === 'contactid') {
          return caseContactOptionsForRecord(unref(caseRecord), caseContactLookupList.value);
        }
        if (key === 'organizationrefid' || key === 'accountid') {
          return caseOrganizationLookupList.value;
        }
        const fieldDef = (moduleDefinition.value?.fields || []).find(
          (f) => String(f?.key || '').toLowerCase().trim() === key
        );
        const dataType = String(fieldDef?.dataType || '').toLowerCase();
        if (
          dataType.includes('user') ||
          key === 'assignedto' ||
          key === 'ownerid' ||
          key === 'owner' ||
          key === 'caseownerid' ||
          key === 'createdby' ||
          key === 'updatedby' ||
          key === 'modifiedby' ||
          key === 'deletedby'
        ) {
          return userLookupList.value;
        }
        return [];
      }
    });
  });

  const allModuleFields = computed(() => {
    const rec = unref(caseRecord);
    if (!genericAdapter.value || !rec) return [];
    const rows = genericAdapter.value.getAllModuleFields?.(rec, sectionContext.value);
    return Array.isArray(rows) ? rows : [];
  });

  const filteredDetailFields = computed(() => {
    const q = (detailsTabSearchQuery.value || '').trim().toLowerCase();
    let rows = allModuleFields.value;
    if (q) {
      rows = rows.filter((f) => {
        const label = String(f.label || '').toLowerCase();
        const key = String(f.key || '').toLowerCase();
        const dv = String(f.displayValue || '').toLowerCase();
        return label.includes(q) || key.includes(q) || dv.includes(q);
      });
    }
    if (!detailsShowEmptyFields.value) {
      rows = rows.filter((r) => !isDetailRowEmpty(r));
    }
    return rows;
  });

  const fieldCountLabel = computed(() => {
    const total = allModuleFields.value.length;
    const shown = filteredDetailFields.value.length;
    const q = (detailsTabSearchQuery.value || '').trim();
    const hidingEmpty = !detailsShowEmptyFields.value;
    if (!total) return '';
    if (q && shown !== total) return `${shown} of ${total}`;
    if (hidingEmpty && shown !== total) return `${shown} shown · ${total} total`;
    return `${total} field${total === 1 ? '' : 's'}`;
  });

  async function loadModuleDefinition() {
    try {
      const modulesRes = await apiClient.get('/modules');
      const modules = Array.isArray(modulesRes)
        ? modulesRes
        : modulesRes?.data ?? modulesRes?.data?.data ?? modulesRes?.modules ?? [];
      moduleDefinition.value = modules.find((m) => String(m?.key || '').toLowerCase() === 'cases') || null;
    } catch (e) {
      console.error('Fetch cases module definition error:', e);
      moduleDefinition.value = null;
    }
  }

  async function loadLookups() {
    try {
      const [contactRes, caseOrgRes, usersRes] = await Promise.all([
        apiClient.get('/people', { params: { limit: 500, sortBy: 'firstName', sortOrder: 'asc' } }),
        apiClient.get('/v2/organization', { params: { limit: 500 } }),
        apiClient.get('/users/list', { params: { limit: 500 } })
      ]);
      const contactRows = Array.isArray(contactRes?.data)
        ? contactRes.data
        : (contactRes?.data?.data && Array.isArray(contactRes.data.data) ? contactRes.data.data : []);
      caseContactLookupList.value = contactRows
        .map((p) => {
          const id = p?._id ?? p?.id;
          const name =
            [p?.first_name, p?.last_name].filter(Boolean).join(' ').trim() ||
            p?.name ||
            p?.email ||
            (id != null ? String(id) : '—');
          return { _id: id, name, ...p };
        })
        .filter((p) => Boolean(p._id));
      const orgData = caseOrgRes?.data ?? caseOrgRes;
      const orgRows = Array.isArray(orgData)
        ? orgData
        : (orgData?.data && Array.isArray(orgData.data) ? orgData.data : []);
      caseOrganizationLookupList.value = orgRows
        .map((o) => {
          const id = o?._id ?? o?.id;
          return { _id: id, name: o?.name ?? (id != null ? String(id) : '—'), ...o };
        })
        .filter((o) => Boolean(o._id));
      const usersData = usersRes?.data ?? usersRes;
      const users = Array.isArray(usersData)
        ? usersData
        : (Array.isArray(usersData?.data) ? usersData.data : []);
      userLookupList.value = users
        .map((u) => ({
          _id: u?._id || u?.id,
          name:
            [u?.firstName, u?.lastName].filter(Boolean).join(' ').trim() ||
            u?.username ||
            u?.email ||
            (u?._id || u?.id || '')
        }))
        .filter((u) => Boolean(u._id));
    } catch (e) {
      console.error('Fetch case detail lookups error:', e);
      caseContactLookupList.value = [];
      caseOrganizationLookupList.value = [];
      userLookupList.value = [];
    } finally {
      lookupsLoaded.value = true;
    }
  }

  watch(
    () => unref(caseId),
    (id) => {
      if (!id) return;
      if (!moduleDefinition.value) loadModuleDefinition();
      if (!lookupsLoaded.value) loadLookups();
    },
    { immediate: true }
  );

  return {
    moduleDefinition,
    genericAdapter,
    sectionContext,
    allModuleFields,
    filteredDetailFields,
    detailsTabSearchQuery,
    detailsShowEmptyFields,
    fieldCountLabel,
    canEditDetails
  };
}
