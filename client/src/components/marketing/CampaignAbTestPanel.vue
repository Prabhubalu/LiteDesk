<template>
  <section class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <div class="border-b border-gray-100 bg-gray-50 px-5 py-4 dark:border-gray-800 dark:bg-gray-800/60">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold text-gray-900 dark:text-white">
            {{ t('marketing.campaignsAbTitle') }}
          </h2>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {{ t('marketing.campaignsAbDescription') }}
          </p>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ t('marketing.campaignsAbEnable') }}
          </span>
          <HeadlessSwitch v-model="localEnabled" :disabled="disabled" />
        </div>
      </div>
    </div>

    <div v-if="localEnabled" class="space-y-4 px-5 py-5">
      <div class="grid gap-4 sm:grid-cols-3">
        <div>
          <label class="block text-sm/6 font-medium text-gray-900 dark:text-white">
            {{ t('marketing.campaignsAbWinnerMetric') }}
          </label>
          <HeadlessSelect
            v-model="localWinnerMetric"
            :options="winnerMetricOptions"
            :disabled="disabled"
            teleport
            wrapper-class="mt-2"
          />
        </div>
        <div>
          <label class="block text-sm/6 font-medium text-gray-900 dark:text-white">
            {{ t('marketing.campaignsAbSamplePercent') }}
          </label>
          <input
            v-model.number="localSamplePercent"
            type="number"
            min="5"
            max="50"
            :disabled="disabled"
            :class="fieldInputClass"
          />
        </div>
        <div>
          <label class="block text-sm/6 font-medium text-gray-900 dark:text-white">
            {{ t('marketing.campaignsAbTestDuration') }}
          </label>
          <input
            v-model.number="localTestDurationHours"
            type="number"
            min="1"
            max="168"
            :disabled="disabled"
            :class="fieldInputClass"
          />
        </div>
      </div>

      <div class="space-y-3">
        <div
          v-for="(variant, index) in localVariants"
          :key="variant.key"
          class="rounded-xl border border-gray-200 bg-gray-50/60 p-4 dark:border-gray-700 dark:bg-gray-800/40"
        >
          <div class="mb-3 flex items-center justify-between gap-2">
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              {{ variant.label || variant.key }}
            </p>
            <button
              v-if="localVariants.length > 2 && !disabled"
              type="button"
              class="text-xs font-medium text-red-600 hover:text-red-500 dark:text-red-400"
              @click="removeVariant(index)"
            >
              {{ t('actions.remove') }}
            </button>
          </div>
          <div class="grid gap-3 sm:grid-cols-3">
            <div class="sm:col-span-2">
              <label class="block text-xs font-medium text-gray-600 dark:text-gray-400">
                {{ t('marketing.campaignsFieldSubject') }}
              </label>
              <input
                v-model="variant.subject"
                type="text"
                :disabled="disabled"
                :class="fieldInputClass"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 dark:text-gray-400">
                {{ t('marketing.campaignsAbSplitPercent') }}
              </label>
              <input
                v-model.number="variant.splitPercent"
                type="number"
                min="1"
                max="100"
                :disabled="disabled"
                :class="fieldInputClass"
              />
            </div>
          </div>
        </div>
      </div>

      <button
        v-if="localVariants.length < 4 && !disabled"
        type="button"
        class="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
        @click="addVariant"
      >
        {{ t('marketing.campaignsAbAddVariant') }}
      </button>

      <p v-if="splitTotal !== 100" class="text-sm text-amber-600 dark:text-amber-400">
        {{ t('marketing.campaignsAbSplitWarning', { total: splitTotal }) }}
      </p>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import HeadlessSwitch from '@/components/ui/HeadlessSwitch.vue';
import { PROCESS_INPUT_CLASS } from '@/utils/processDesignerConstants';

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({
      enabled: false,
      winnerMetric: 'open_rate',
      samplePercent: 20,
      testDurationHours: 4
    })
  },
  variants: {
    type: Array,
    default: () => []
  },
  disabled: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:modelValue', 'update:variants']);

const { t } = useI18n();

const fieldInputClass = `${PROCESS_INPUT_CLASS} mt-2`;

const localEnabled = ref(props.modelValue?.enabled === true);
const localWinnerMetric = ref(props.modelValue?.winnerMetric || 'open_rate');
const localSamplePercent = ref(props.modelValue?.samplePercent ?? 20);
const localTestDurationHours = ref(props.modelValue?.testDurationHours ?? 4);
const localVariants = ref(normalizeVariants(props.variants));

const winnerMetricOptions = computed(() => [
  { value: 'open_rate', label: t('marketing.campaignsAbMetricOpenRate') },
  { value: 'click_rate', label: t('marketing.campaignsAbMetricClickRate') }
]);

function normalizeVariants(list) {
  if (Array.isArray(list) && list.length >= 2) {
    return list.map((row) => ({
      key: row.key,
      label: row.label || row.key,
      subject: row.subject || '',
      splitPercent: row.splitPercent ?? 50
    }));
  }
  return [
    { key: 'A', label: 'Variant A', subject: '', splitPercent: 50 },
    { key: 'B', label: 'Variant B', subject: '', splitPercent: 50 }
  ];
}

const splitTotal = computed(() =>
  localVariants.value.reduce((sum, row) => sum + (Number(row.splitPercent) || 0), 0)
);

function emitConfig() {
  emit('update:modelValue', {
    enabled: localEnabled.value,
    winnerMetric: localWinnerMetric.value,
    samplePercent: localSamplePercent.value,
    testDurationHours: localTestDurationHours.value,
    status: props.modelValue?.status || 'none'
  });
  emit('update:variants', localVariants.value);
}

function addVariant() {
  const key = String.fromCharCode(65 + localVariants.value.length);
  localVariants.value.push({
    key,
    label: `Variant ${key}`,
    subject: '',
    splitPercent: Math.max(1, Math.floor(100 / (localVariants.value.length + 1)))
  });
  emitConfig();
}

function removeVariant(index) {
  localVariants.value.splice(index, 1);
  emitConfig();
}

watch([localEnabled, localWinnerMetric, localSamplePercent, localTestDurationHours], emitConfig);
watch(localVariants, emitConfig, { deep: true });

watch(
  () => props.modelValue,
  (value) => {
    localEnabled.value = value?.enabled === true;
    localWinnerMetric.value = value?.winnerMetric || 'open_rate';
    localSamplePercent.value = value?.samplePercent ?? 20;
    localTestDurationHours.value = value?.testDurationHours ?? 4;
  },
  { deep: true }
);

watch(
  () => props.variants,
  (value) => {
    if (Array.isArray(value) && value.length >= 2) {
      localVariants.value = normalizeVariants(value);
    }
  },
  { deep: true }
);
</script>
