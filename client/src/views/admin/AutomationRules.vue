<template>
  <div class="w-full">
    <!-- Header -->
    <header class="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h1 class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
          {{ t('process.rulesTitle') }}
        </h1>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {{ t('process.rulesDescription') }}
        </p>
      </div>
      <button
        @click="openCreateModal"
        class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        {{ t('process.rulesNew') }}
      </button>
    </header>

    <!-- Filters -->
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <select
        v-model="filters.appKey"
        @change="loadRules"
        class="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
      >
        <option value="">{{ t('process.filterApps') }}</option>
        <option value="SALES">{{ t('process.appKeySales') }}</option>
        <option value="AUDIT">{{ t('process.appKeyAudit') }}</option>
        <option value="PORTAL">{{ t('process.appKeyPortal') }}</option>
      </select>
      <select
        v-model="filters.entityType"
        @change="loadRules"
        class="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
      >
        <option value="">{{ t('process.filterEntities') }}</option>
        <option value="people">{{ t('process.filterEntityPeople') }}</option>
        <option value="organization">{{ t('process.filterEntityOrganization') }}</option>
        <option value="deal">{{ t('process.filterEntityDeal') }}</option>
        <option value="events">{{ t('process.filterEntityEvents') }}</option>
      </select>
      <select
        v-model="filters.enabled"
        @change="loadRules"
        class="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
      >
        <option value="">{{ t('process.filterStatus') }}</option>
        <option value="true">{{ t('process.filterEnabled') }}</option>
        <option value="false">{{ t('process.filterDisabled') }}</option>
      </select>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
    </div>

    <!-- Error -->
    <div
      v-else-if="error"
      class="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 px-4 py-3 text-sm text-red-700 dark:text-red-300"
    >
      {{ error }}
    </div>

    <!-- Rules List -->
    <div v-else-if="rules.length > 0" class="space-y-3">
      <div
        v-for="rule in rules"
        :key="rule._id"
        class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 hover:shadow-md transition-shadow"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-2">
              <h3 class="text-base font-semibold text-gray-900 dark:text-white">
                {{ rule.name }}
              </h3>
              <span
                :class="[
                  'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                  rule.enabled
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                ]"
              >
                {{ rule.enabled ? t('process.statusEnabled') : t('process.statusDisabled') }}
              </span>
            </div>
            <p v-if="rule.description" class="text-sm text-gray-600 dark:text-gray-400 mb-3">
              {{ rule.description }}
            </p>
            <div class="flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
              <span>
                <span class="font-medium">{{ t('process.labelApp') }}</span> {{ rule.appKey }}
              </span>
              <span v-if="rule.entityType">
                <span class="font-medium">{{ t('process.labelEntity') }}</span> {{ rule.entityType }}
              </span>
              <span>
                <span class="font-medium">{{ t('process.labelTrigger') }}</span> {{ rule.trigger.eventType }}
              </span>
              <span>
                <span class="font-medium">{{ t('process.labelAction') }}</span> {{ rule.action.type }}
              </span>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button
              @click="previewRule(rule)"
              class="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
              :title="t('process.rulesTooltipPreview')"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
            <button
              @click="toggleRule(rule)"
              class="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
              :title="rule.enabled ? t('process.rulesTooltipDisable') : t('process.rulesTooltipEnable')"
            >
              <svg v-if="rule.enabled" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
            </button>
            <button
              @click="editRule(rule)"
              class="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
              :title="t('actions.edit')"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              @click="deleteRule(rule)"
              class="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              :title="t('actions.delete')"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="text-center py-12 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <svg class="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">{{ t('process.rulesEmptyTitle') }}</h3>
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
        {{ t('process.rulesEmptyMessage') }}
      </p>
      <button
        @click="openCreateModal"
        class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        {{ t('process.rulesNew') }}
      </button>
    </div>

    <!-- Form Modal -->
    <AutomationRuleForm
      v-if="showFormModal"
      :rule="editingRule"
      @close="closeFormModal"
      @saved="handleRuleSaved"
    />

    <!-- Preview Modal -->
    <AutomationRulePreview
      v-if="previewingRule"
      :rule="previewingRule"
      @close="previewingRule = null"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import AutomationRuleForm from '@/components/admin/AutomationRuleForm.vue';
import AutomationRulePreview from '@/components/admin/AutomationRulePreview.vue';

const { t } = useI18n();

const rules = ref([]);
const loading = ref(false);
const error = ref(null);
const showFormModal = ref(false);
const editingRule = ref(null);
const previewingRule = ref(null);

const filters = ref({
  appKey: '',
  entityType: '',
  enabled: ''
});

async function loadRules() {
  loading.value = true;
  error.value = null;
  try {
    const params = new URLSearchParams();
    if (filters.value.appKey) params.append('appKey', filters.value.appKey);
    if (filters.value.entityType) params.append('entityType', filters.value.entityType);
    if (filters.value.enabled) params.append('enabled', filters.value.enabled);

    const res = await apiClient.get(`/admin/automation-rules?${params.toString()}`);
    rules.value = res.data.data || [];
  } catch (err) {
    error.value = err.response?.data?.message || t('process.rulesLoadFailed');
    console.error('Error loading rules:', err);
  } finally {
    loading.value = false;
  }
}

function openCreateModal() {
  editingRule.value = null;
  showFormModal.value = true;
}

function editRule(rule) {
  editingRule.value = rule;
  showFormModal.value = true;
}

function closeFormModal() {
  showFormModal.value = false;
  editingRule.value = null;
}

function handleRuleSaved() {
  closeFormModal();
  loadRules();
}

async function toggleRule(rule) {
  try {
    await apiClient.post(`/admin/automation-rules/${rule._id}/toggle`);
    await loadRules();
  } catch (err) {
    alert(err.response?.data?.message || t('process.rulesToggleFailed'));
  }
}

async function deleteRule(rule) {
  if (!confirm(t('process.rulesDeleteConfirm', { name: rule.name }))) return;
  try {
    await apiClient.delete(`/admin/automation-rules/${rule._id}`);
    await loadRules();
  } catch (err) {
    alert(err.response?.data?.message || t('process.rulesDeleteFailed'));
  }
}

function previewRule(rule) {
  previewingRule.value = rule;
}

onMounted(() => {
  document.title = t('process.rulesPageTitle');
  loadRules();
});
</script>
