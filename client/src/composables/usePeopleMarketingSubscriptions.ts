import { computed, reactive, ref, watch, type ComputedRef, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/authRegistry';
import apiClient from '@/utils/apiClient';
import { formatDate as formatLocaleDate } from '@/utils/localeFormat';

interface MarketingPreference {
  email?: string;
  globalStatus?: string;
  updatedAt?: string;
}

interface MarketingHistoryEntry {
  _id: string;
  category?: string;
  action?: string;
  recordedAt?: string;
  source?: string;
}

export type PeopleMarketingSubscriptionsContext = {
  isEligible: boolean;
  visible: boolean;
  loading: boolean;
  error: string;
  preference: MarketingPreference | null;
  history: MarketingHistoryEntry[];
  statusLabel: string;
  chipLabel: string | null;
  compactSummary: string;
  loadHistory: () => Promise<void>;
  formatDate: (value: string | undefined) => string;
  historyLabel: (entry: MarketingHistoryEntry) => string;
};

const storeCache = new Map<string, PeopleMarketingSubscriptionsContext>();

function createMarketingSubscriptionsStore(peopleId: string): PeopleMarketingSubscriptionsContext {
  const { t } = useI18n();
  const authStore = useAuthStore();

  const loading = ref(false);
  const error = ref('');
  const preference = ref<MarketingPreference | null>(null);
  const history = ref<MarketingHistoryEntry[]>([]);

  const marketingAppEnabled = computed(() => {
    const enabledApps = authStore.organization?.enabledApps;
    if (!Array.isArray(enabledApps)) return false;
    return enabledApps.some((app) => {
      const key = (typeof app === 'string' ? app : app?.appKey || '').toUpperCase();
      const active = typeof app === 'object' ? app.status === 'ACTIVE' : true;
      return key === 'MARKETING' && active;
    });
  });

  const isEligible = computed(
    () =>
      marketingAppEnabled.value &&
      (authStore.can('audiences', 'view') || authStore.can('campaigns', 'view'))
  );

  const visible = computed(() => Boolean(peopleId) && isEligible.value);

  const statusLabel = computed(() =>
    preference.value?.globalStatus === 'unsubscribed'
      ? t('marketing.personSubscriptionsStatusUnsubscribed')
      : t('marketing.personSubscriptionsStatusSubscribed')
  );

  const chipLabel = computed(() => {
    if (!isEligible.value) return null;
    if (loading.value) return t('people.accessChipMarketingLoading');
    if (!preference.value) return t('people.accessChipMarketingNone');
    if (preference.value.globalStatus === 'unsubscribed') {
      return t('marketing.personSubscriptionsStatusUnsubscribed');
    }
    return t('marketing.personSubscriptionsStatusSubscribed');
  });

  const compactSummary = computed(() => {
    if (loading.value) return t('states.loading');
    if (!preference.value) return t('people.accessNoSubscriptions');
    return statusLabel.value;
  });

  function formatDate(value: string | undefined) {
    const date = new Date(value ?? '');
    if (Number.isNaN(date.getTime())) return '—';
    return formatLocaleDate(date, { dateStyle: 'medium', timeStyle: 'short' });
  }

  function historyLabel(entry: MarketingHistoryEntry) {
    const category = entry.category || 'marketing';
    if (entry.action === 'unsubscribe') {
      return t('marketing.personSubscriptionsHistoryUnsubscribed', { category });
    }
    if (entry.action === 'subscribe') {
      return t('marketing.personSubscriptionsHistorySubscribed', { category });
    }
    return t('marketing.personSubscriptionsHistoryUpdated', { category });
  }

  async function loadHistory() {
    if (!visible.value) return;
    loading.value = true;
    error.value = '';
    try {
      const response = await apiClient.get(`/marketing/subscriptions/person/${peopleId}`, {
        cache: 'no-store'
      });
      if (!response?.success) {
        throw new Error(response?.message || t('marketing.personSubscriptionsLoadError'));
      }
      preference.value = response.data?.preference ?? null;
      history.value = Array.isArray(response.data?.history) ? response.data.history : [];
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : t('marketing.personSubscriptionsLoadError');
      error.value = message;
      preference.value = null;
      history.value = [];
    } finally {
      loading.value = false;
    }
  }

  watch(
    visible,
    (isVisible) => {
      if (isVisible) {
        void loadHistory();
      }
    },
    { immediate: true }
  );

  return reactive({
    isEligible,
    visible,
    loading,
    error,
    preference,
    history,
    statusLabel,
    chipLabel,
    compactSummary,
    loadHistory,
    formatDate,
    historyLabel
  }) as PeopleMarketingSubscriptionsContext;
}

export function resolvePeopleMarketingSubscriptions(
  peopleIdRef: ComputedRef<string | null | undefined> | Ref<string | null | undefined>
): ComputedRef<PeopleMarketingSubscriptionsContext | null> {
  const peopleId = computed(() => {
    const value = peopleIdRef.value;
    return value ? String(value) : null;
  });

  return computed(() => {
    const id = peopleId.value;
    if (!id) return null;
    if (!storeCache.has(id)) {
      storeCache.set(id, createMarketingSubscriptionsStore(id));
    }
    return storeCache.get(id)!;
  });
}
