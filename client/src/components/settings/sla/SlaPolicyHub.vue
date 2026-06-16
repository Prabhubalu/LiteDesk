<template>
  <SettingsScrollPanel :class="embedded ? '' : undefined">
    <template v-if="!embedded" #header>
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <button
            type="button"
            class="mb-2 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            @click="$emit('back')"
          >
            {{ t('settings.slaPolicyBackToList') }}
          </button>
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('settings.slaGenericHubTitle') }}</h2>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.slaGenericHubDesc') }}</p>
        </div>
      </div>
    </template>

    <div v-if="embedded" class="mb-4 flex flex-wrap items-center justify-between gap-2">
      <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('settings.slaEnginePoliciesHint') }}</p>
      <button
        type="button"
        class="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        @click="openNewPolicy"
      >
        {{ t('settings.slaPolicyNew') }}
      </button>
    </div>

    <div v-if="loading" class="py-12 text-center text-sm text-gray-500">{{ t('states.loading') }}</div>

    <SlaPolicyList
      v-else
      :policies="sortedPolicies"
      :modules="modules"
      :selected-module-key="selectedModuleKey"
      :show-module-select="!embedded && !fixedModuleKey"
      :show-stats="!embedded"
      :show-create-button="!embedded"
      @create="openNewPolicy"
      @preview="openPreviewByKey"
      @edit="openPolicyByKey"
      @make-default="makeDefaultByKey"
      @module-change="onModuleChange"
    />

    <SlaPolicyDrawer
      :open="drawerOpen"
      :policy-key="editingPolicyKey"
      :is-new="editingIsNew"
      :read-only="drawerReadOnly"
      :is-default-policy="editingPolicyKey === DEFAULT_SLA_POLICY_KEY"
      :fixed-module-key="fixedModuleKey"
      :initial-policy="editingPolicy"
      :modules="modules"
      :metadata="metadata || {}"
      :module-fields="moduleFields"
      :saving="saving"
      @close="closeDrawer"
      @save="savePolicy"
      @delete="deletePolicy"
      @switch-to-edit="drawerReadOnly = false"
      @module-change="onEditorModuleChange"
    />
  </SettingsScrollPanel>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import SettingsScrollPanel from '@/components/settings/SettingsScrollPanel.vue';
import SlaPolicyDrawer from '@/components/settings/sla/SlaPolicyDrawer.vue';
import SlaPolicyList from '@/components/settings/sla/SlaPolicyList.vue';
import { DEFAULT_SLA_POLICY_KEY, resolveSlaPolicyMetadata } from '@/constants/slaPolicy';

const props = defineProps({
  embedded: { type: Boolean, default: false },
  fixedModuleKey: { type: String, default: '' }
});

defineEmits(['back']);

const { t } = useI18n();

const loading = ref(true);
const saving = ref(false);
const metadata = ref(resolveSlaPolicyMetadata(null));
const moduleFields = ref([]);
const modules = ref([{ moduleKey: 'cases', appKey: 'HELPDESK', label: 'Cases' }]);
const selectedModuleKey = ref(props.fixedModuleKey || '');
const policies = ref([]);

const drawerOpen = ref(false);
const drawerReadOnly = ref(false);
const editingPolicyKey = ref('');
const editingIsNew = ref(false);
const editingPolicy = ref(null);

const sortedPolicies = computed(() => [...policies.value]);

watch(() => props.fixedModuleKey, (value) => {
  if (value) {
    selectedModuleKey.value = value;
    loadPolicies();
  }
});


function newPolicyKey() {
  return `policy_${Date.now().toString(36)}`;
}

async function loadMetadata(moduleKey = selectedModuleKey.value) {
  const query = moduleKey ? `?moduleKey=${encodeURIComponent(moduleKey)}` : '';
  const data = await apiClient(`/settings/automation/sla-policies/metadata${query}`, { method: 'GET' });
  if (data?.success) {
    metadata.value = resolveSlaPolicyMetadata(data.metadata);
    moduleFields.value = Array.isArray(data.moduleFields) ? data.moduleFields : [];
    if (Array.isArray(data.modules) && data.modules.length > 0) {
      modules.value = data.modules;
      if (
        selectedModuleKey.value
        && !modules.value.some((row) => row.moduleKey === selectedModuleKey.value)
      ) {
        selectedModuleKey.value = '';
      }
    }
  }
}

async function loadPolicies() {
  loading.value = true;
  try {
    await loadMetadata(selectedModuleKey.value);
    const query = selectedModuleKey.value
      ? `?moduleKey=${encodeURIComponent(selectedModuleKey.value)}`
      : '';
    const data = await apiClient(`/settings/automation/sla-policies${query}`, { method: 'GET' });
    policies.value = data?.policies || [];
  } finally {
    loading.value = false;
  }
}

function onModuleChange(moduleKey) {
  selectedModuleKey.value = moduleKey;
  loadPolicies();
}

function resolveModuleAppKey(moduleKey) {
  const row = modules.value.find((mod) => mod.moduleKey === moduleKey);
  return row?.appKey || (moduleKey === 'cases' ? 'HELPDESK' : null);
}

function defaultTargetsForModule(moduleKey) {
  // New policy should start empty; user defines milestones + times explicitly.
  return [];
}

function resolveEditorModuleKey() {
  if (props.fixedModuleKey) return props.fixedModuleKey;
  return selectedModuleKey.value || '';
}

function openNewPolicy() {
  const key = newPolicyKey();
  const moduleKey = resolveEditorModuleKey();
  editingPolicyKey.value = key;
  editingIsNew.value = true;
  drawerReadOnly.value = false;
  editingPolicy.value = {
    policyKey: key,
    name: '',
    active: true,
    isDefault: false,
    scope: {
      moduleKey,
      appKey: moduleKey ? resolveModuleAppKey(moduleKey) : null
    },
    targets: defaultTargetsForModule(moduleKey)
  };
  drawerOpen.value = true;
}

function openPolicy(policy, { readOnly = false } = {}) {
  editingPolicyKey.value = policy.policyKey;
  editingIsNew.value = false;
  editingPolicy.value = { ...policy };
  drawerReadOnly.value = readOnly;
  drawerOpen.value = true;
}

function openPolicyByKey(policyKey, { readOnly = false } = {}) {
  const policy = policies.value.find((p) => p.policyKey === policyKey);
  if (!policy) return;
  openPolicy(policy, { readOnly });
}

function openPreviewByKey(policyKey) {
  openPolicyByKey(policyKey, { readOnly: true });
}

function closeDrawer() {
  drawerOpen.value = false;
  drawerReadOnly.value = false;
  editingPolicyKey.value = '';
  editingIsNew.value = false;
  editingPolicy.value = null;
}

async function onEditorModuleChange(moduleKey) {
  selectedModuleKey.value = moduleKey;
  await loadMetadata(moduleKey);
}

async function savePolicy(payload) {
  saving.value = true;
  try {
    const key = payload.policyKey || editingPolicyKey.value;
    await apiClient(`/settings/automation/sla-policies/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    closeDrawer();
    await loadPolicies();
  } finally {
    saving.value = false;
  }
}

async function deletePolicy() {
  if (!editingPolicyKey.value || editingPolicyKey.value === DEFAULT_SLA_POLICY_KEY) return;
  saving.value = true;
  try {
    await apiClient(`/settings/automation/sla-policies/${encodeURIComponent(editingPolicyKey.value)}`, {
      method: 'DELETE'
    });
    closeDrawer();
    await loadPolicies();
  } finally {
    saving.value = false;
  }
}

async function makeDefault(policy) {
  saving.value = true;
  try {
    const moduleKey = policy?.scope?.moduleKey || selectedModuleKey.value || 'cases';
    await apiClient(
      `/settings/automation/sla-policies/${encodeURIComponent(policy.policyKey)}/set-default`,
      { method: 'POST', body: JSON.stringify({ moduleKey }) }
    );
    await loadPolicies();
  } finally {
    saving.value = false;
  }
}

async function makeDefaultByKey(policyKey) {
  const policy = policies.value.find((p) => p.policyKey === policyKey);
  if (!policy) return;
  await makeDefault(policy);
}

onMounted(loadPolicies);
</script>
