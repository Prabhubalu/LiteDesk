<template>
  <div class="w-full">
    <button
      type="button"
      class="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      @click="isExpanded = !isExpanded"
    >
      <div class="flex items-center gap-2">
        <svg class="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('process.contextHeading') }}</span>
        <span
          v-if="hasAutomation && !loading"
          class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
        >
          {{ t('process.contextActive') }}
        </span>
      </div>
      <svg
        :class="['w-5 h-5 text-gray-400 transition-transform', isExpanded ? 'rotate-180' : '']"
        fill="none" stroke="currentColor" viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <div
      v-if="isExpanded"
      class="mt-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 overflow-hidden"
    >
      <div v-if="loading" class="p-4">
        <div class="animate-pulse space-y-3">
          <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
        </div>
      </div>

      <div v-else-if="error" class="p-4 text-sm text-red-600 dark:text-red-400">
        {{ error }}
      </div>

      <div v-else-if="!hasAutomation" class="p-4">
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ t('process.contextEmpty') }}
        </p>
      </div>

      <div v-else class="divide-y divide-gray-200 dark:divide-gray-700">
        <div
          v-for="explanation in explanations"
          :key="explanation.id"
          class="p-4"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-sm font-medium text-gray-900 dark:text-white">
                  {{ explanation.name }}
                </span>
                <span
                  :class="[
                    'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium',
                    explanation.status === 'active'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  ]"
                >
                  {{ explanation.status === 'active' ? t('process.contextActive') : t('process.contextInactive') }}
                </span>
              </div>
              <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
                {{ explanation.summary }}
              </p>

              <div v-if="explanation.outcomes && explanation.outcomes.length > 0" class="space-y-2">
                <div
                  v-for="(outcome, idx) in explanation.outcomes"
                  :key="idx"
                  class="flex items-start gap-2 text-sm"
                >
                  <component
                    :is="getOutcomeIcon(outcome.icon)"
                    class="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0"
                  />
                  <div>
                    <span class="text-gray-700 dark:text-gray-300">{{ outcome.description }}</span>
                    <p v-if="outcome.detail" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {{ outcome.detail }}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="isAdmin && explanation.type === 'process'" class="flex-shrink-0">
              <button
                type="button"
                class="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                @click="viewProcess(explanation.id)"
              >
                {{ t('process.contextViewProcess') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/authRegistry';
import apiClient from '@/utils/apiClient';
import {
  BellIcon,
  ClipboardDocumentListIcon,
  EnvelopeIcon,
  ChatBubbleLeftIcon,
  PencilIcon,
  PlusCircleIcon,
  CogIcon,
  ShieldCheckIcon,
  LockClosedIcon,
  UserPlusIcon,
  ShieldExclamationIcon,
  PlayIcon
} from '@heroicons/vue/24/outline';

const { t } = useI18n();

const props = defineProps({
  entityType: {
    type: String,
    required: true
  },
  entityId: {
    type: String,
    required: true
  },
  initialExpanded: {
    type: Boolean,
    default: false
  }
});

const router = useRouter();
const authStore = useAuthStore();

const isExpanded = ref(props.initialExpanded);
const loading = ref(false);
const error = ref(null);
const contextData = ref(null);

const isAdmin = computed(() => {
  return authStore.user?.role === 'admin' || authStore.user?.role === 'platform_admin';
});

const hasAutomation = computed(() => {
  return contextData.value?.hasAutomation || false;
});

const explanations = computed(() => {
  return contextData.value?.explanations || [];
});

const iconMap = {
  bell: BellIcon,
  'clipboard-list': ClipboardDocumentListIcon,
  envelope: EnvelopeIcon,
  'chat-bubble-left': ChatBubbleLeftIcon,
  pencil: PencilIcon,
  'plus-circle': PlusCircleIcon,
  cog: CogIcon,
  'shield-check': ShieldCheckIcon,
  'lock-closed': LockClosedIcon,
  'user-plus': UserPlusIcon,
  'shield-exclamation': ShieldExclamationIcon,
  play: PlayIcon
};

const getOutcomeIcon = (iconName) => {
  return iconMap[iconName] || CogIcon;
};

const loadContext = async () => {
  if (!props.entityType || !props.entityId) return;

  loading.value = true;
  error.value = null;

  try {
    const response = await apiClient.get('/automation/context', {
      params: {
        entityType: props.entityType,
        entityId: props.entityId
      }
    });

    if (response.success) {
      contextData.value = response.data;
    } else {
      error.value = response.message || t('process.contextLoadFailed');
    }
  } catch (err) {
    error.value = err.message || t('process.contextLoadFailed');
    console.error('Error loading automation context:', err);
  } finally {
    loading.value = false;
  }
};

const viewProcess = (processId) => {
  router.push(`/settings/automation/processes?processId=${processId}`);
};

onMounted(() => {
  loadContext();
});

watch(
  () => [props.entityType, props.entityId],
  () => {
    loadContext();
  }
);
</script>
