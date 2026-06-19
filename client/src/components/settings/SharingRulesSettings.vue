<template>
  <div :class="embedded ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : 'p-6'">
    <div class="mb-6 shrink-0">
      <template v-if="!embedded">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('settings.sharingPageTitle') }}</h2>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.sharingPageSubtitle') }}</p>
      </template>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto overscroll-contain">
      <div v-if="loading" class="flex justify-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>

      <div v-else-if="error" class="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-800 dark:text-red-300">
        {{ error }}
      </div>

      <div v-else class="space-y-6">
        <section
          v-for="section in groupedSections"
          :key="section.id"
          class="space-y-3"
        >
          <div>
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ section.label }}</h3>
            <p v-if="section.hint" class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ section.hint }}</p>
          </div>

          <div v-if="section.rows.length === 0" class="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 px-4 py-6 text-center">
            <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('settings.sharingAppSectionEmpty') }}</p>
          </div>

          <div v-else class="space-y-3">
            <div
              v-for="row in section.rows"
              :key="rowKey(row)"
              class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
            >
              <div class="flex items-center gap-3 px-4 py-3">
                <button
                  type="button"
                  class="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                  @click="toggleExpanded(row)"
                >
                  <ChevronRightIcon :class="['w-4 h-4 transition-transform', isExpanded(row) && 'rotate-90']" />
                </button>
                <div class="flex-1 min-w-0 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p class="min-w-0 text-sm font-medium text-gray-900 dark:text-white">{{ rowLabel(row) }}</p>
                  <HeadlessSelect
                    :model-value="row.mode"
                    :options="modeOptions"
                    :disabled="savingKey === rowKey(row)"
                    wrapper-class="w-full sm:w-52 shrink-0"
                    teleport
                    teleport-align="end"
                    @update:model-value="updateMode(row, $event)"
                  />
                </div>
                <button
                  type="button"
                  class="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 whitespace-nowrap"
                  @click="openCreateRule(row)"
                >
                  {{ t('settings.sharingRuleAdd') }}
                </button>
              </div>

              <div v-if="isExpanded(row)" class="border-t border-gray-200 dark:border-gray-700 px-4 py-3 bg-gray-50/80 dark:bg-gray-900/30">
                <p v-if="rulesFor(row).length === 0" class="text-xs text-gray-500 dark:text-gray-400">
                  {{ t('settings.sharingRulesEmpty') }}
                </p>
                <ul v-else class="space-y-2">
                  <li
                    v-for="rule in rulesFor(row)"
                    :key="rule._id"
                    class="flex items-start justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2"
                  >
                    <div class="min-w-0">
                      <p class="text-sm font-medium text-gray-900 dark:text-white">{{ rule.name }}</p>
                      <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {{ describeParty(rule.source) }} → {{ describeParty(rule.target) }}
                        · {{ t(`settings.sharingPrivilege_${rule.privilege}`) }}
                      </p>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                      <button type="button" class="text-xs text-indigo-600" @click="openEditRule(rule)">{{ t('actions.edit') }}</button>
                      <button type="button" class="text-xs text-red-600" @click="deleteRule(rule)">{{ t('actions.delete') }}</button>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </div>

      <p class="mt-4 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.sharingPrivateHint') }}</p>
    </div>

    <SharingRuleFormModal
      :open="showRuleModal"
      :rule="editingRule"
      :app-key="ruleContext.appKey"
      :module-key="ruleContext.moduleKey"
      :context-label="ruleContextLabel"
      :roles="roles"
      :groups="groups"
      :source-types="sourceTypes"
      :target-types="targetTypes"
      :privileges="privileges"
      @close="closeRuleModal"
      @saved="handleRuleSaved"
    />
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ChevronRightIcon } from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import { getAppNameKey, getModuleLabelKey } from '@/utils/navigationLabels';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import SharingRuleFormModal from './SharingRuleFormModal.vue';

defineProps({
  embedded: { type: Boolean, default: false }
});

const { t, te } = useI18n();

const defaults = ref([]);
const rules = ref([]);
const modes = ref([]);
const roles = ref([]);
const groups = ref([]);
const sourceTypes = ref([]);
const targetTypes = ref([]);
const privileges = ref([]);
const catalogModules = ref([]);
const catalogSections = ref([]);
const enabledApps = ref([]);
const loading = ref(false);
const error = ref('');
const savingKey = ref('');
const expandedKeys = ref(new Set());
const showRuleModal = ref(false);
const editingRule = ref(null);
const ruleContext = ref({ appKey: '', moduleKey: '' });

const modeOptions = computed(() =>
  modes.value.map((mode) => ({
    value: mode,
    label: t(`settings.sharingMode_${mode}`)
  }))
);

const PLATFORM_MODULE_KEYS = new Set(['reports', 'users', 'settings', 'performance', 'webforms', 'imports']);
const CORE_MODULE_ORDER = [
  'people',
  'organizations',
  'tasks',
  'events',
  'items',
  'forms',
  'quotes',
  'sales_orders',
  'invoices',
  'payments'
];
const CORE_MODULE_KEYS = new Set(CORE_MODULE_ORDER);

const rowTargets = (row) => (Array.isArray(row.linkedRows) && row.linkedRows.length ? row.linkedRows : [row]);

const rowKey = (row) => {
  if (row.scopeKey) return row.scopeKey;
  return `${row.appKey}:${row.moduleKey}`;
};

const pickPrimaryCoreRow = (linkedRows) => {
  for (const appKey of enabledAppKeys.value) {
    const match = linkedRows.find((row) => String(row.appKey || '').toUpperCase() === appKey);
    if (match) return match;
  }
  return linkedRows[0];
};

const dedupeCoreRows = (rows) => {
  const groups = new Map();

  for (const row of rows) {
    const dedupeKey = normalizeModuleKey(row.moduleKey);
    if (!groups.has(dedupeKey)) groups.set(dedupeKey, []);
    groups.get(dedupeKey).push(row);
  }

  return [...groups.entries()].map(([dedupeKey, linkedRows]) => {
    const displayModuleKey = linkedRows.some(
      (row) => String(row.moduleKey || '').toLowerCase() === 'people'
    )
      ? 'people'
      : linkedRows[0].moduleKey;
    const primary = pickPrimaryCoreRow(linkedRows);
    const representative = { ...primary, moduleKey: displayModuleKey };

    return {
      ...primary,
      moduleKey: displayModuleKey,
      mode: primary.mode,
      linkedRows,
      scopeKey: `core:${dedupeKey}`,
      sortOrder: rowSortOrder(representative)
    };
  });
};

const isExpanded = (row) => expandedKeys.value.has(rowKey(row));

const toggleExpanded = (row) => {
  const key = rowKey(row);
  const next = new Set(expandedKeys.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  expandedKeys.value = next;
};

const rulesFor = (row) => {
  const targets = rowTargets(row);
  return rules.value.filter((rule) =>
    targets.some(
      (target) => target.appKey === rule.appKey && target.moduleKey === rule.moduleKey
    )
  );
};

const roleName = (id) => roles.value.find((r) => r._id === id)?.name || id;
const groupName = (id) => groups.value.find((g) => g._id === id)?.name || id;

const describeParty = (party) => {
  if (!party?.type) return '';
  const typeLabel = t(`settings.sharingParty_${party.type}`);
  if (party.type === 'role' || party.type === 'role_subtree') return `${typeLabel}: ${roleName(party.roleId)}`;
  if (party.type === 'group') return `${typeLabel}: ${groupName(party.groupId)}`;
  if (party.type === 'all_internal') return typeLabel;
  return typeLabel;
};

const normalizeModuleKey = (moduleKey) => {
  const key = String(moduleKey || '').toLowerCase();
  return key === 'contacts' ? 'people' : key;
};

const catalogIndex = computed(() => {
  const byAppModule = new Map();
  const coreByModuleKey = new Map();
  const platformByModuleKey = new Map();

  for (const mod of catalogModules.value) {
    const moduleKey = String(mod.moduleKey || '').toLowerCase();
    if (!moduleKey) continue;
    if (mod.scope === 'core') coreByModuleKey.set(moduleKey, mod);
    else if (mod.scope === 'platform') platformByModuleKey.set(moduleKey, mod);
    else if (mod.scope === 'app') {
      const appKey = String(mod.appKey || '').toUpperCase();
      byAppModule.set(`${appKey}:${moduleKey}`, mod);
    }
  }

  return { byAppModule, coreByModuleKey, platformByModuleKey };
});

const enabledAppKeys = computed(() => {
  const fromCatalog = (enabledApps.value || [])
    .map((app) => String(app.appKey || '').toUpperCase())
    .filter(Boolean);
  if (fromCatalog.length) return fromCatalog;

  return [...new Set(defaults.value.map((row) => String(row.appKey || '').toUpperCase()).filter(Boolean))].sort();
});

const isPlatformRow = (row) => {
  const moduleKey = String(row.moduleKey || '').toLowerCase();
  const { platformByModuleKey } = catalogIndex.value;
  return platformByModuleKey.has(moduleKey) || PLATFORM_MODULE_KEYS.has(moduleKey);
};

const isCoreRow = (row) => {
  if (isPlatformRow(row)) return false;
  const moduleKey = String(row.moduleKey || '').toLowerCase();
  const lookupKey = normalizeModuleKey(moduleKey);
  const { coreByModuleKey } = catalogIndex.value;
  return coreByModuleKey.has(lookupKey) || CORE_MODULE_KEYS.has(lookupKey);
};

const rowSortOrder = (row) => {
  const moduleKey = String(row.moduleKey || '').toLowerCase();
  const normalizedKey = normalizeModuleKey(moduleKey);
  const coreIdx = CORE_MODULE_ORDER.indexOf(normalizedKey);
  if (coreIdx >= 0) return coreIdx;

  const appKey = String(row.appKey || '').toUpperCase();
  const { byAppModule, platformByModuleKey } = catalogIndex.value;
  return (
    byAppModule.get(`${appKey}:${moduleKey}`)?.order ??
    platformByModuleKey.get(moduleKey)?.order ??
    999
  );
};

const appLabel = (appKey) => {
  const upper = String(appKey || '').toUpperCase();
  const key = getAppNameKey(upper);
  if (key && te(key)) return t(key);
  const catalogSection = catalogSections.value.find((section) => section.appKey === upper);
  return catalogSection?.label || upper;
};

const rowLabel = (row) => {
  const moduleKey = String(row.moduleKey || '').toLowerCase();
  const lookupKey = normalizeModuleKey(moduleKey);
  const labelKey = getModuleLabelKey(moduleKey === 'contacts' ? 'contacts' : lookupKey);
  if (labelKey && te(labelKey)) return t(labelKey);

  const { byAppModule, coreByModuleKey, platformByModuleKey } = catalogIndex.value;
  const appKey = String(row.appKey || '').toUpperCase();
  const catalogMod =
    byAppModule.get(`${appKey}:${moduleKey}`) ||
    coreByModuleKey.get(lookupKey) ||
    platformByModuleKey.get(moduleKey);

  if (catalogMod?.label) return catalogMod.label;
  return moduleKey.charAt(0).toUpperCase() + moduleKey.slice(1).replace(/_/g, ' ');
};

const sectionMeta = (sectionId) => {
  if (sectionId === 'platform') {
    return {
      label: t('settings.sharingSectionPlatform'),
      hint: t('settings.roleDrawerAccessPlatformSectionHint')
    };
  }
  if (sectionId === 'core') {
    return {
      label: t('settings.tabCoreModules'),
      hint: t('settings.roleDrawerAccessCoreSectionHint')
    };
  }

  const appKey = sectionId.replace(/^app-/, '').toUpperCase();
  const label = appLabel(appKey);
  return {
    label,
    hint: t('settings.sharingSectionAppHint', { app: label })
  };
};

const groupedSections = computed(() => {
  const sections = [];
  const platformRows = defaults.value.filter(isPlatformRow);

  if (platformRows.length) {
    sections.push({
      id: 'platform',
      ...sectionMeta('platform'),
      rows: platformRows.map((row) => ({ ...row, sortOrder: rowSortOrder(row) }))
    });
  }

  const coreRows = defaults.value.filter((row) => isCoreRow(row) && !isPlatformRow(row));
  if (coreRows.length) {
    sections.push({
      id: 'core',
      ...sectionMeta('core'),
      rows: dedupeCoreRows(coreRows)
    });
  }

  for (const appKey of enabledAppKeys.value) {
    const appRows = defaults.value.filter((row) => {
      if (String(row.appKey || '').toUpperCase() !== appKey) return false;
      if (isPlatformRow(row)) return false;
      if (isCoreRow(row)) return false;
      return true;
    });

    const sectionId = `app-${appKey.toLowerCase()}`;
    sections.push({
      id: sectionId,
      ...sectionMeta(sectionId),
      rows: appRows.map((row) => ({ ...row, sortOrder: rowSortOrder(row) }))
    });
  }

  const sectionOrder = (sectionId) => {
    if (sectionId === 'platform') return 0;
    if (sectionId === 'core') return 10;
    const catalogSection = catalogSections.value.find((section) => section.id === sectionId);
    return catalogSection?.order ?? 20;
  };

  return sections
    .sort((a, b) => sectionOrder(a.id) - sectionOrder(b.id) || a.label.localeCompare(b.label))
    .map((section) => ({
      ...section,
      rows: [...section.rows].sort(
        (a, b) => a.sortOrder - b.sortOrder || rowLabel(a).localeCompare(rowLabel(b))
      )
    }));
});

const ruleContextLabel = computed(() => {
  const { appKey, moduleKey } = ruleContext.value;
  if (!appKey || !moduleKey) return '';
  return rowLabel({ appKey, moduleKey });
});

const fetchAll = async () => {
  loading.value = true;
  error.value = '';
  try {
    const [defaultsRes, rulesRes, rolesRes, groupsRes, catalogRes] = await Promise.all([
      apiClient.get('/sharing/defaults'),
      apiClient.get('/sharing/rules'),
      apiClient.get('/roles'),
      apiClient.get('/groups'),
      apiClient.get('/roles/modules')
    ]);

    if (!defaultsRes.success) {
      error.value = defaultsRes.message || t('settings.sharingLoadFailed');
      return;
    }

    defaults.value = defaultsRes.data || [];
    modes.value = defaultsRes.modes || [];
    rules.value = rulesRes.success ? rulesRes.data || [] : [];
    sourceTypes.value = rulesRes.sourceTypes || [];
    targetTypes.value = rulesRes.targetTypes || [];
    privileges.value = rulesRes.privileges || [];
    roles.value = rolesRes.success ? rolesRes.data || [] : [];
    groups.value = groupsRes.success ? groupsRes.data || [] : [];
    catalogModules.value = catalogRes.success ? catalogRes.data || [] : [];
    catalogSections.value = catalogRes.success ? catalogRes.sections || [] : [];
    enabledApps.value = catalogRes.success ? catalogRes.enabledApps || [] : [];
  } catch (err) {
    error.value = err.message || t('settings.sharingLoadFailed');
  } finally {
    loading.value = false;
  }
};

const updateMode = async (row, mode) => {
  const targets = rowTargets(row);
  savingKey.value = rowKey(row);
  try {
    for (const target of targets) {
      const response = await apiClient.put(`/sharing/defaults/${target.appKey}/${target.moduleKey}`, { mode });
      if (!response.success) {
        window.alert(response.message || t('settings.sharingSaveFailed'));
        await fetchAll();
        return;
      }
      target.mode = mode;
    }
    row.mode = mode;
  } catch (err) {
    window.alert(err.message || t('settings.sharingSaveFailed'));
    await fetchAll();
  } finally {
    savingKey.value = '';
  }
};

const openCreateRule = (row) => {
  const primary = pickPrimaryCoreRow(rowTargets(row));
  editingRule.value = null;
  ruleContext.value = { appKey: primary.appKey, moduleKey: primary.moduleKey };
  showRuleModal.value = true;
  expandedKeys.value = new Set([...expandedKeys.value, rowKey(row)]);
};

const openEditRule = (rule) => {
  editingRule.value = rule;
  ruleContext.value = { appKey: rule.appKey, moduleKey: rule.moduleKey };
  showRuleModal.value = true;
};

const closeRuleModal = () => {
  showRuleModal.value = false;
  editingRule.value = null;
};

const handleRuleSaved = async () => {
  await fetchAll();
};

const deleteRule = async (rule) => {
  if (!window.confirm(t('settings.sharingRuleDeleteConfirm', { name: rule.name }))) return;
  try {
    const response = await apiClient.delete(`/sharing/rules/${rule._id}`);
    if (response.success) await fetchAll();
    else window.alert(response.message || t('settings.sharingRuleDeleteFailed'));
  } catch (err) {
    window.alert(err.message || t('settings.sharingRuleDeleteFailed'));
  }
};

onMounted(fetchAll);
</script>
