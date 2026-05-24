<template>
  <article
    class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm p-5 flex flex-col h-full"
  >
    <button
      type="button"
      class="text-left group mb-4"
      @click="$emit('open', pulse)"
    >
      <h3 class="text-base font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
        {{ pulse.name }}
      </h3>
    </button>

    <ul class="space-y-2 flex-1">
      <li
        v-for="(signal, index) in pulse.signals"
        :key="index"
      >
        <button
          type="button"
          class="w-full text-left text-sm rounded-md px-2 py-1.5 -mx-2 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
          @click="handleSignalClick(signal)"
        >
          <span
            :class="[
              'inline-block w-1.5 h-1.5 rounded-full mr-2 align-middle',
              severityDotClass(signal.severity)
            ]"
          />
          <span :class="severityTextClass(signal.severity)">{{ signal.text }}</span>
        </button>
      </li>
    </ul>

    <button
      type="button"
      class="mt-4 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
      @click="$emit('open', pulse)"
    >{{ t('platform.appPulseCardOpenApp') }}<ArrowRightIcon class="w-4 h-4" />
    </button>
  </article>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { ArrowRightIcon } from '@heroicons/vue/24/outline';

defineProps({
  pulse: {
    type: Object,
    required: true
  }
});

const { t } = useI18n();

defineEmits(['open']);

const router = useRouter();

const severityDotClass = (severity) => {
  switch (severity) {
    case 'danger':
      return 'bg-red-500';
    case 'warning':
      return 'bg-amber-500';
    default:
      return 'bg-gray-400 dark:bg-gray-500';
  }
};

const severityTextClass = (severity) => {
  switch (severity) {
    case 'danger':
      return 'text-red-700 dark:text-red-300';
    case 'warning':
      return 'text-amber-700 dark:text-amber-300';
    default:
      return 'text-gray-600 dark:text-gray-400';
  }
};

const handleSignalClick = (signal) => {
  if (signal?.route) {
    router.push(signal.route);
  }
};
</script>
