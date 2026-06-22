import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import {
  buildLiveChatClosedColumnFilterOptions,
  LIVE_CHAT_CLOSED_COLUMN_FILTER_TYPES,
} from '@/utils/liveChatClosedSessionListFilters';
import { setLiveChatCustomOutcomeLabels } from '@/utils/liveChatSessionDisplay';

export const LIVE_CHAT_CLOSED_SESSION_FIELD_KEYS = Object.freeze([
  'visitor',
  'sessionKey',
  'channel',
  'lifecycleStatus',
  'outcome',
  'queue',
  'assignedAgent',
  'handledBy',
  'startedAt',
  'endedAt',
  'duration',
  'summary',
  'tags',
  'csatScore',
  'messageCount',
  'visitorMessageCount',
  'agentMessageCount',
  'transferCount',
  'waitTime',
  'firstResponseTime',
  'handleTime',
  'visitorType',
  'priority',
  'sentiment',
  'intent',
  'botInvolved',
  'consentGiven',
  'sessionArchived',
  'exported',
]);

export function useLiveChatSessionFieldCatalog() {
  const { t } = useI18n();
  const loading = ref(true);
  const fields = ref([]);
  const tenantDefaultColumnKeys = ref([]);
  const outcomes = ref([]);

  const defaultVisibleKeySet = computed(
    () => new Set(tenantDefaultColumnKeys.value),
  );

  const allColumns = computed(() => fields.value.map((field) => {
    const filterType = LIVE_CHAT_CLOSED_COLUMN_FILTER_TYPES[field.key] || 'text';
    const column = {
      key: field.key,
      label: t(field.labelKey, field.key),
      sortable: Boolean(field.sortable),
      dataType: field.dataType || undefined,
      filterType,
      width: field.width || undefined,
      locked: Boolean(field.locked),
      visible: defaultVisibleKeySet.value.has(field.key),
      showInTable: true,
    };
    if (filterType === 'select') {
      const options = buildLiveChatClosedColumnFilterOptions(field.key, t, {
        outcomes: field.key === 'outcome' ? outcomes.value : undefined,
      });
      if (options.length) column.options = options;
    }
    return column;
  }));

  async function loadFieldCatalog() {
    loading.value = true;
    try {
      const [fieldsRes, outcomesRes] = await Promise.all([
        apiClient.get('/live-chat/session-fields'),
        apiClient.get('/live-chat/outcomes'),
      ]);
      const data = fieldsRes?.data || {};
      fields.value = Array.isArray(data.fields) ? data.fields : [];
      tenantDefaultColumnKeys.value = Array.isArray(data.defaultColumnKeys)
        ? data.defaultColumnKeys
        : fields.value.map((field) => field.key);
      outcomes.value = Array.isArray(outcomesRes?.data) ? outcomesRes.data : [];
      setLiveChatCustomOutcomeLabels(outcomes.value);
    } catch {
      fields.value = [];
      tenantDefaultColumnKeys.value = [];
      outcomes.value = [];
      setLiveChatCustomOutcomeLabels([]);
    } finally {
      loading.value = false;
    }
  }

  return {
    loading,
    fields,
    allColumns,
    tenantDefaultColumnKeys,
    loadFieldCatalog,
  };
}
