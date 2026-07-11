<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  filterTimezoneGroups,
  getAllTimezones,
  normalizeIanaTimezone,
} from '@/utils/orgRegionalOptions';

const props = defineProps({
  modelValue: {
    type: String,
    default: 'UTC',
  },
});

const emit = defineEmits(['update:modelValue']);

const { t } = useI18n();

const timezoneOpen = ref(false);
const timezoneSearch = ref('');

const normalizedValue = computed(() => normalizeIanaTimezone(props.modelValue));

const allTimezones = computed(() => getAllTimezones());

const filteredTimezoneGroups = computed(() => filterTimezoneGroups(timezoneSearch.value));

const selectedTimezoneMeta = computed(() =>
  allTimezones.value.find((tz) => tz.value === normalizedValue.value) || null
);

const selectedTimezoneLabel = computed(() => {
  const tz = selectedTimezoneMeta.value;
  if (!tz) return normalizedValue.value || '';
  return `${tz.sublabel || tz.text} (${tz.offset})`;
});

function selectTimezone(value) {
  emit('update:modelValue', normalizeIanaTimezone(value));
  timezoneSearch.value = '';
  timezoneOpen.value = false;
}

function closeTimezoneOnOutside(event) {
  if (!timezoneOpen.value) return;
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (target.closest('[data-tz-root]')) return;
  timezoneOpen.value = false;
}

onMounted(() => {
  document.addEventListener('click', closeTimezoneOnOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', closeTimezoneOnOutside);
});
</script>

<template>
  <div class="relative" data-tz-root>
    <input
      v-model="timezoneSearch"
      @focus="timezoneOpen = true"
      @input="timezoneOpen = true"
      @keydown.escape="timezoneOpen = false"
      type="text"
      class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 pr-10 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all outline-none"
      :placeholder="selectedTimezoneLabel || t('settings.orgTimezoneSearchPh')"
    />
    <button
      type="button"
      @click="timezoneOpen = !timezoneOpen"
      class="absolute inset-y-0 right-0 px-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
      :aria-label="t('settings.orgToggleTimezoneList')"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <div
      v-if="timezoneOpen"
      class="absolute z-30 mt-2 w-full max-h-80 overflow-y-auto rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg"
      @click.stop
    >
      <div
        v-if="filteredTimezoneGroups.length === 0"
        class="px-4 py-6 text-sm text-gray-500 dark:text-gray-400 text-center"
      >
        {{ t('settings.orgNoTimezoneMatch', { query: timezoneSearch }) }}
      </div>
      <div
        v-for="group in filteredTimezoneGroups"
        :key="group.region"
      >
        <div class="sticky top-0 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/80 border-b border-gray-100 dark:border-gray-700">
          {{ group.region }}
        </div>
        <button
          v-for="tz in group.items"
          :key="tz.value"
          type="button"
          @click="selectTimezone(tz.value)"
          :class="[
            'w-full flex items-center justify-between px-3 py-2 text-sm text-left transition-colors',
            tz.value === normalizedValue
              ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-200 font-medium'
              : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/40'
          ]"
        >
          <span class="truncate pr-3">{{ tz.sublabel || tz.text }}</span>
          <span class="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">{{ tz.offset }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
