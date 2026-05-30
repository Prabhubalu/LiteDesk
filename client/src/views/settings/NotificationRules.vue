<template>
  <div class="w-full">
    <div class="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
      <button
        @click="openCreateModal"
        :disabled="!canCreateMore"
        class="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>{{ t('notifications.ruleCreate') }}</button>
    </div>

    <!-- Limit Warning -->
    <div
      v-if="ruleLimits && ruleLimits.total >= ruleLimits.maxTotal"
      class="mb-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4"
    >
      <div class="flex">
        <svg class="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
        </svg>
        <div class="ml-3">
          <p class="text-sm font-medium text-amber-800 dark:text-amber-200">
            You've reached the maximum of {{ ruleLimits.maxTotal }} notification rules.
          </p>
          <p class="mt-1 text-sm text-amber-700 dark:text-amber-300">{{ t('common.notificationRulesDeleteAnExistingRuleToCreate') }}</p>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="space-y-4">
      <div
        v-for="i in 3"
        :key="i"
        class="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"
      ></div>
    </div>

    <!-- Error State -->
    <div
      v-else-if="error"
      class="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4"
    >
      <div class="flex">
        <svg class="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
        </svg>
        <div class="ml-3">
          <p class="text-sm font-medium text-red-800 dark:text-red-200">{{ t('common.notificationRulesFailedToLoadNotificationRules') }}</p>
          <p class="mt-1 text-sm text-red-700 dark:text-red-300">
            {{ error }}
          </p>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="rules.length === 0"
      class="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 px-4 py-12 text-center"
    >
      <svg
        class="mx-auto h-12 w-12 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        />
      </svg>
      <h3 class="mt-4 text-sm font-medium text-gray-900 dark:text-white">{{ t('common.notificationRulesNoNotificationRulesYet') }}</h3>
      <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">{{ t('common.notificationRulesGetStartedByCreatingYourFirst') }}</p>
      <div class="mt-6">
        <button
          @click="openCreateModal"
          type="button"
          class="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors min-h-[44px]"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>{{ t('common.notificationRulesCreateYourFirstRule') }}</button>
      </div>
    </div>

    <!-- Rules List -->
    <div v-else class="space-y-3">
      <div
        v-for="rule in rules"
        :key="rule.id"
        class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1 min-w-0">
            <!-- Rule Sentence -->
            <div class="flex items-start gap-3">
              <!-- Toggle -->
              <button
                @click="handleToggle(rule)"
                :disabled="toggling === rule.id"
                type="button"
                :class="[
                  'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50',
                  rule.enabled ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'
                ]"
                :aria-label="`Toggle rule: ${formatRuleSentence(rule)}`"
                role="switch"
                :aria-checked="rule.enabled"
              >
                <span
                  aria-hidden="true"
                  class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200"
                  :class="rule.enabled ? 'translate-x-5' : 'translate-x-0'"
                ></span>
              </button>
              
              <!-- Rule Content -->
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-900 dark:text-white">
                  {{ formatRuleSentence(rule) }}
                </p>
                <div class="mt-1 flex flex-wrap items-center gap-2">
                  <span class="text-xs text-gray-500 dark:text-gray-400">
                    {{ formatChannels(rule) }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="ml-4 flex items-center gap-2">
            <button
              @click="openEditModal(rule)"
              type="button"
              class="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              :aria-label="t('common.notificationRulesEditRule')"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              @click="handleDelete(rule)"
              type="button"
              class="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              :aria-label="t('common.notificationRulesDeleteRule')"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Rule Builder Modal -->
    <RuleBuilderModal
      :isOpen="showModal"
      :rule="editingRule"
      @close="closeModal"
      @saved="handleSaved"
    />
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import { ref, computed, onMounted } from 'vue';
import { useNotificationRules } from '@/composables/useNotificationRules';
import RuleBuilderModal from '@/components/notifications/RuleBuilderModal.vue';

const {
  loading,
  error,
  rules,
  fetchRules,
  deleteRule: apiDeleteRule,
  toggleRule: apiToggleRule,
  getRuleLimits
} = useNotificationRules();

const showModal = ref(false);
const editingRule = ref(null);
const toggling = ref(null);
const ruleLimits = ref(null);

const canCreateMore = computed(() => {
  if (!ruleLimits.value) return true;
  return ruleLimits.value.total < ruleLimits.value.maxTotal;
});

function openCreateModal() {
  editingRule.value = null;
  showModal.value = true;
}

function openEditModal(rule) {
  editingRule.value = rule;
  showModal.value = true;
}

function closeModal() {
  showModal.value = false;
  editingRule.value = null;
}

async function handleSaved() {
  await fetchRules();
  await loadRuleLimits();
}

async function handleToggle(rule) {
  toggling.value = rule.id;
  try {
    await apiToggleRule(rule.id);
    await loadRuleLimits();
  } catch (error) {
    console.error('[NotificationRules] Error toggling rule:', error);
  } finally {
    toggling.value = null;
  }
}

async function handleDelete(rule) {
  if (!confirm(`Are you sure you want to delete this rule?\n\n"${formatRuleSentence(rule)}"`)) {
    return;
  }
  
  try {
    await apiDeleteRule(rule.id);
    await loadRuleLimits();
  } catch (error) {
    console.error('[NotificationRules] Error deleting rule:', error);
    alert(t('common.notificationRulesToastFailedToDeleteRulePlease'));
  }
}

function formatRuleSentence(rule) {
  // This will be improved when we have module metadata loaded
  let sentence = `When a ${rule.moduleKey || 'module'}`;
  
  sentence += ` ${rule.eventType.toLowerCase().replace(/_/g, ' ')}`;
  
  if (rule.conditions && Object.keys(rule.conditions).length > 0) {
    const conditions = [];
    
    if (rule.conditions.assignedTo) {
      conditions.push(rule.conditions.assignedTo === 'ME' ? 'assigned to me' : 'assigned to anyone');
    }
    
    if (rule.conditions.priority && Array.isArray(rule.conditions.priority) && rule.conditions.priority.length > 0) {
      conditions.push(`priority is ${rule.conditions.priority.join(' or ')}`);
    }
    
    if (rule.conditions.status && Array.isArray(rule.conditions.status) && rule.conditions.status.length > 0) {
      conditions.push(`status is ${rule.conditions.status.join(' or ')}`);
    }
    
    if (conditions.length > 0) {
      sentence += ` and ${conditions.join(' and ')}`;
    }
  }
  
  return sentence;
}

function formatChannels(rule) {
  const channels = [];
  if (rule.channels?.inApp) channels.push('In-App');
  if (rule.channels?.email) channels.push('Email');
  if (rule.channels?.push) channels.push('Push');
  if (rule.channels?.whatsapp) channels.push('WhatsApp');
  if (rule.channels?.sms) channels.push('SMS');
  
  return channels.length > 0 
    ? `Notify via ${channels.join(', ')}`
    : 'No channels selected';
}

function loadRuleLimits() {
  ruleLimits.value = getRuleLimits();
}

onMounted(async () => {
  await fetchRules();
  await loadRuleLimits();
});
</script>

