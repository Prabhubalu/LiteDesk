<template>
  <div class="mx-auto max-w-4xl px-4 py-8">
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">{{ t('platform.attentionSurfaceAttention') }}</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('platform.attentionSurfaceThingsThatNeedYourAttentionRight') }}</p>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>

    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
      <p class="text-sm text-red-800 dark:text-red-200">
        {{ error }}
      </p>
    </div>

    <div v-else-if="items.length === 0" class="text-center py-16">
      <div class="max-w-md mx-auto">
        <CheckCircleIcon class="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">{{ t('notifications.caughtUp') }}</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('platform.attentionSurfaceAttentionShowsTasksAndEventsOnly') }}</p>
      </div>
    </div>

    <div v-else>
      <AttentionItemRow
        v-for="(item, index) in items"
        :key="item.id"
        :item="item"
        :show-divider="index < items.length - 1"
        @select="handleItemSelect"
        @complete="handleTaskComplete"
      />
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import AttentionItemRow from '@/components/platform/AttentionItemRow.vue';
import { useAttentionItems } from '@/composables/useAttentionItems';
import { CheckCircleIcon } from '@heroicons/vue/24/outline';

const router = useRouter();
const { loading, error, items, fetchItems, completeTask } = useAttentionItems();

const handleItemSelect = (item) => {
  if (item.routeTarget) {
    router.push(item.routeTarget);
  }
};

const handleTaskComplete = async (item) => {
  const result = await completeTask(item);
  if (result && typeof result === 'object' && result.navigate) {
    router.push(result.navigate);
  }
};

onMounted(() => {
  fetchItems();
});
</script>
