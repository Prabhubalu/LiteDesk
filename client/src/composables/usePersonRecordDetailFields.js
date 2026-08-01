import { ref, computed, watch, unref } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { fetchModuleDefinitionCached } from '@/utils/tenantSchemaApiCache';
import {
  fetchUsersListCached,
  fetchOrganizationsListCached,
} from '@/utils/recordLookupCache';
import { createGenericRecordAdapter } from '@/components/record-page/adapters/genericRecordAdapter';
import { createRecordSectionLabels } from '@/utils/recordSectionLabels';
import { getModuleRecordCrudPathBase } from '@/utils/moduleRecordApiPath';
import { resolveFieldContext } from '@/utils/fieldContextFilter';
import { formatUserDate } from '@/utils/localeFormat';

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
 * Module-definition-driven detail fields for a person record (People module).
 */
export function usePersonRecordDetailFields({ personRecord, personId, canEdit, openTab }) {
  const route = useRoute();
  const { t } = useI18n();

  const moduleDefinition = ref(null);
  const peopleOrganizationList = ref([]);
  const userLookupList = ref([]);
  const detailsTabSearchQuery = ref('');
  const detailsShowEmptyFields = ref(false);
  const lookupsLoaded = ref(false);

  const recordCrudPathBase = computed(() =>
    getModuleRecordCrudPathBase('people', {
      appKey: route.meta?.appKey,
      routePath: route.path
    })
  );

  const recordFieldContext = computed(() => resolveFieldContext(route.path, route.query));

  const canEditDetails = computed(() => Boolean(unref(canEdit)));

  const sectionContext = computed(() => ({
    expandedLeftSection: '',
    module: 'generic',
    moduleKey: 'people',
    openTab: typeof openTab === 'function' ? openTab : undefined,
    fieldContext: recordFieldContext.value,
    hideHeader: true
  }));

  const genericAdapter = computed(() => {
    const rec = unref(personRecord);
    const id = unref(personId);
    if (!rec?._id || !moduleDefinition.value) return null;

    return createGenericRecordAdapter({
      sectionLabels: createRecordSectionLabels(t),
      formatDate: (d) =>
        (d ? formatUserDate(d) : '—'),
      moduleDefinition: moduleDefinition.value,
      canEditDetails: () => canEditDetails.value,
      saveDetailField: async (fieldKey, value) => {
        if (fieldKey === 'first_name' || fieldKey === 'last_name') {
          const current = rec || {};
          const next = {
            first_name: fieldKey === 'first_name' ? value : current.first_name,
            last_name: fieldKey === 'last_name' ? value : current.last_name
          };
          const fullName = [next.first_name, next.last_name].filter(Boolean).join(' ').trim() || undefined;
          const payload = { first_name: next.first_name, last_name: next.last_name };
          if (fullName) payload.name = fullName;
          const response = await apiClient.put(`${recordCrudPathBase.value}/${id}`, payload);
          const updatedRecord = response?.data?.data ?? response?.data ?? null;
          if (updatedRecord && typeof updatedRecord === 'object') {
            Object.assign(rec, updatedRecord);
          } else {
            rec.first_name = next.first_name;
            rec.last_name = next.last_name;
            if (fullName) rec.name = fullName;
          }
          return;
        }

        const payload = { [fieldKey]: value };
        const response = await apiClient.put(`${recordCrudPathBase.value}/${id}`, payload);
        const updatedRecord = response?.data?.data ?? response?.data ?? null;
        if (updatedRecord && typeof updatedRecord === 'object') {
          Object.assign(rec, updatedRecord);
        } else {
          rec[fieldKey] = value;
        }
      },
      getEntityOptions: (fieldKey) => {
        const key = String(fieldKey || '').toLowerCase().trim();
        if (key === 'organization') {
          return peopleOrganizationList.value;
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
    const rec = unref(personRecord);
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
      moduleDefinition.value = await fetchModuleDefinitionCached('people');
    } catch (e) {
      console.error('Fetch people module definition error:', e);
      moduleDefinition.value = null;
    }
  }

  async function loadLookups() {
    try {
      const [orgRes, usersRes] = await Promise.all([
        fetchOrganizationsListCached({ limit: 500 }),
        fetchUsersListCached({ limit: 500 }),
      ]);
      const orgData = orgRes?.data ?? orgRes;
      peopleOrganizationList.value = Array.isArray(orgData)
        ? orgData
        : (orgData?.data && Array.isArray(orgData.data) ? orgData.data : []);
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
      console.error('Fetch people detail lookups error:', e);
      peopleOrganizationList.value = [];
      userLookupList.value = [];
    } finally {
      lookupsLoaded.value = true;
    }
  }

  watch(
    () => unref(personId),
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
