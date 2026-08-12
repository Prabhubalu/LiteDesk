<template>
  <div
    class="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900/50"
    :class="panelClass"
  >
    <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
      {{ t('platform.productConfigRuntimeValidation') }}
    </p>
    <div
      v-if="result?.valid"
      class="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-200"
    >
      {{ t('platform.productConfigRuntimeValid') }}
    </div>
    <ul v-else-if="result?.errors?.length" class="mt-2 space-y-1.5">
      <li
        v-for="(error, index) in result.errors"
        :key="index"
        class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-200"
      >
        {{ error.message }}
      </li>
    </ul>
    <p v-else class="mt-2 text-xs text-gray-500">{{ t('platform.productConfigRuntimeIdle') }}</p>
    <div v-if="result?.appliedDependencies?.length" class="mt-3">
      <p class="text-[11px] font-medium text-gray-500">{{ t('platform.productConfigRuntimeDeps') }}</p>
      <ul class="mt-1 space-y-0.5 text-xs text-gray-700 dark:text-gray-300">
        <li v-for="(dep, index) in result.appliedDependencies" :key="index">
          {{ dep.action }} → {{ dep.option }}{{ dep.value ? `: ${dep.value}` : '' }}
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

defineProps({
  result: { type: Object, default: null },
  panelClass: { type: String, default: '' },
});

const { t } = useI18n();
</script>
