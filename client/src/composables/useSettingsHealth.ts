import { computed, onUnmounted, ref, watch, type Ref } from 'vue';
import apiClient from '@/utils/apiClient';
import type { SettingsAccessContext } from '@/utils/settingsCatalog';
import { canAccessSettingsTab } from '@/utils/settingsTabAccess';
import {
  countEnabledNumbering,
  evaluateSettingsHealth,
  unwrapTaxList,
  type SettingsHealthItem,
} from '@/utils/settingsHealth';

export type { SettingsHealthItem };

type OrgLike = {
  name?: string | null;
  currency?: string | null;
} | null | undefined;

/**
 * Live settings health for the overview: org fields + optional security/taxes/numbering APIs.
 */
export function useSettingsHealth(
  accessCtx: Ref<SettingsAccessContext>,
  organization: Ref<OrgLike>
) {
  const loading = ref(false);
  const items = ref<SettingsHealthItem[]>([]);
  let cancelled = false;

  const attentionItems = computed(() =>
    items.value.filter((item) => item.status === 'attention')
  );

  const statusByHubId = computed(() => {
    const map = new Map<string, SettingsHealthItem>();
    for (const item of items.value) {
      const prev = map.get(item.hubId);
      if (!prev || item.status === 'attention') {
        map.set(item.hubId, item);
      }
    }
    return map;
  });

  async function refresh(): Promise<void> {
    cancelled = false;
    const ctx = accessCtx.value;
    const org = organization.value;
    const canSecurity = canAccessSettingsTab('security', ctx);
    const canTaxes = canAccessSettingsTab('inventory', ctx);
    const canNumbering = canAccessSettingsTab('automation', ctx);

    loading.value = true;
    let twoFactorEnabled: boolean | null = null;
    let taxCount: number | null = null;
    let numberingEnabledCount: number | null = null;

    try {
      const tasks: Promise<void>[] = [];

      if (canSecurity) {
        tasks.push(
          apiClient
            .getOptional('/settings/security')
            .then((res: unknown) => {
              const enabled =
                res &&
                typeof res === 'object' &&
                'data' in res
                  ? (res as { data?: { twoFactorAuth?: { enabled?: unknown } } }).data
                      ?.twoFactorAuth?.enabled
                  : undefined;
              twoFactorEnabled = typeof enabled === 'boolean' ? enabled : null;
            })
            .catch(() => {
              twoFactorEnabled = null;
            })
        );
      }

      if (canTaxes) {
        tasks.push(
          apiClient
            .getOptional('/taxes', { params: { includeInactive: 'false' } })
            .then((res: unknown) => {
              if (res == null) {
                taxCount = null;
                return;
              }
              taxCount = unwrapTaxList(res).length;
            })
            .catch(() => {
              taxCount = null;
            })
        );
      }

      if (canNumbering) {
        tasks.push(
          apiClient
            .getOptional('/settings/module-numbering')
            .then((res: unknown) => {
              if (res == null) {
                numberingEnabledCount = null;
                return;
              }
              const configs =
                typeof res === 'object' && res !== null && 'configs' in res
                  ? (res as { configs?: unknown }).configs
                  : undefined;
              numberingEnabledCount = countEnabledNumbering(configs);
            })
            .catch(() => {
              numberingEnabledCount = null;
            })
        );
      }

      await Promise.all(tasks);
    } finally {
      if (cancelled) return;
      items.value = evaluateSettingsHealth({
        orgName: org?.name,
        orgCurrency: org?.currency,
        canCheckSecurity: canSecurity,
        twoFactorEnabled,
        canCheckTaxes: canTaxes,
        taxCount,
        canCheckNumbering: canNumbering,
        numberingEnabledCount,
      });
      loading.value = false;
    }
  }

  onUnmounted(() => {
    cancelled = true;
  });

  watch(
    [accessCtx, organization],
    () => {
      void refresh();
    },
    { deep: true, immediate: true }
  );

  return {
    loading,
    items,
    attentionItems,
    statusByHubId,
    refresh,
  };
}
