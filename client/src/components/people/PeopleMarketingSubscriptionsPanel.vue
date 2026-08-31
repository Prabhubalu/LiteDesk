<template>
  <template v-if="marketingAccess?.visible">
  <div
    v-if="isCompact"
    class="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5 dark:border-gray-700 dark:bg-gray-900"
  >
    <div class="min-w-0">
      <p class="text-xs font-medium text-gray-500 dark:text-gray-400">
        {{ t('marketing.personSubscriptionsTitle') }}
      </p>
      <p class="mt-0.5 truncate text-sm text-gray-900 dark:text-white">
        {{ marketingAccess.compactSummary }}
      </p>
    </div>
    <button
      type="button"
      class="shrink-0 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
      @click="emit('manage')"
    >
      {{ t('people.accessManage') }}
    </button>
  </div>

  <section
    v-else
    :class="embedded ? 'space-y-4' : 'rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900'"
  >
    <div v-if="!embedded" class="mb-3 flex items-center justify-between gap-3">
      <div>
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
          {{ t('marketing.personSubscriptionsTitle') }}
        </h3>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {{ t('marketing.personSubscriptionsDescription') }}
        </p>
      </div>
      <button
        type="button"
        class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 dark:border-gray-600 dark:text-gray-200"
        :disabled="marketingAccess.loading"
        @click="marketingAccess.loadHistory()"
      >
        {{ t('actions.refresh') }}
      </button>
    </div>

    <div v-if="marketingAccess.loading" class="text-sm text-gray-500 dark:text-gray-400">
      {{ t('states.loading') }}
    </div>

    <p v-else-if="marketingAccess.error" class="text-sm text-red-600 dark:text-red-400">
      {{ marketingAccess.error }}
    </p>

    <p v-else-if="!marketingAccess.preference" class="text-sm text-gray-500 dark:text-gray-400">
      {{ t('people.accessNoSubscriptions') }}
    </p>

    <template v-else>
      <div class="mb-4 grid gap-3 sm:grid-cols-3">
        <div class="rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700">
          <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('marketing.personSubscriptionsEmail') }}</p>
          <p class="mt-1 text-sm font-medium text-gray-900 dark:text-white">
            {{ marketingAccess.preference.email }}
          </p>
        </div>
        <div class="rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700">
          <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('marketing.personSubscriptionsStatus') }}</p>
          <p class="mt-1 text-sm font-medium text-gray-900 dark:text-white">
            {{ marketingAccess.statusLabel }}
          </p>
        </div>
        <div class="rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700">
          <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('marketing.personSubscriptionsUpdated') }}</p>
          <p class="mt-1 text-sm font-medium text-gray-900 dark:text-white">
            {{ marketingAccess.formatDate(marketingAccess.preference.updatedAt) }}
          </p>
        </div>
      </div>

      <div v-if="marketingAccess.history.length > 0">
        <h4 class="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
          {{ t('marketing.personSubscriptionsHistoryTitle') }}
        </h4>
        <ul class="divide-y divide-gray-200 rounded-lg border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
          <li
            v-for="entry in marketingAccess.history"
            :key="entry._id"
            class="px-4 py-3 text-sm"
          >
            <p class="font-medium text-gray-900 dark:text-white">
              {{ marketingAccess.historyLabel(entry) }}
            </p>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ marketingAccess.formatDate(entry.recordedAt) }} · {{ entry.source }}
            </p>
          </li>
        </ul>
      </div>
    </template>
  </section>
  </template>
</template>

<script setup>
import { computed, toRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { resolvePeopleMarketingSubscriptions } from '@/composables/usePeopleMarketingSubscriptions';

const props = defineProps({
  peopleId: { type: String, required: true },
  display: {
    type: String,
    default: 'full',
    validator: (v) => v === 'full' || v === 'compact'
  },
  embedded: { type: Boolean, default: false }
});

const emit = defineEmits(['manage']);

const { t } = useI18n();
const access = resolvePeopleMarketingSubscriptions(toRef(() => props.peopleId));
const marketingAccess = computed(() => access.value);
const isCompact = computed(() => props.display === 'compact');
</script>
