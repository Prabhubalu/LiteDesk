<template>
  <section class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/20 space-y-3">
    <div>
      <h3 class="text-sm font-semibold text-amber-900 dark:text-amber-100">
        {{ t('templates.htmlImport.hubspotConditionalTitle', { count }) }}
      </h3>
      <p class="mt-1 text-sm text-amber-800 dark:text-amber-200/90">
        {{ t('templates.htmlImport.hubspotConditionalDescription') }}
      </p>
    </div>

    <div class="space-y-2">
      <label
        v-for="option in options"
        :key="option.value"
        class="flex cursor-pointer items-start gap-2 rounded-md border border-amber-200/80 bg-white/70 px-3 py-2 text-sm dark:border-amber-900/40 dark:bg-gray-900/40"
      >
        <input
          v-model="localMode"
          type="radio"
          name="hubspot-conditional-mode"
          :value="option.value"
          class="mt-0.5"
          @change="emit('update:mode', localMode)"
        />
        <span>
          <span class="font-medium text-gray-900 dark:text-white">{{ option.label }}</span>
          <span class="mt-0.5 block text-xs text-gray-600 dark:text-gray-300">{{ option.description }}</span>
        </span>
      </label>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  count: { type: Number, default: 0 },
  mode: { type: String, default: 'keep' }
});

const emit = defineEmits(['update:mode']);

const { t } = useI18n();
const localMode = ref(props.mode);

watch(
  () => props.mode,
  (next) => {
    localMode.value = next;
  }
);

const options = computed(() => [
  {
    value: 'keep',
    label: t('templates.htmlImport.hubspotConditionalKeep'),
    description: t('templates.htmlImport.hubspotConditionalKeepHint')
  },
  {
    value: 'strip',
    label: t('templates.htmlImport.hubspotConditionalStrip'),
    description: t('templates.htmlImport.hubspotConditionalStripHint')
  }
]);
</script>
