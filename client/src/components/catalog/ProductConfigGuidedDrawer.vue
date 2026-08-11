<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-3 sm:p-6"
      @click.self="cancel"
      @keydown.esc="cancel"
    >
      <div
        class="flex max-h-[min(92vh,860px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-800"
        role="dialog"
        aria-modal="true"
        :aria-label="t('records.productConfigGuidedTitle')"
      >
        <div class="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <div class="min-w-0">
            <h3 class="text-base font-semibold text-gray-900 dark:text-white">
              {{ t('records.productConfigGuidedTitle') }}
            </h3>
            <p class="mt-0.5 truncate text-xs text-gray-500">
              {{ productLabel }}
              <span v-if="activeConfig"> · {{ activeConfig.name }}</span>
            </p>
          </div>
          <span
            class="inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold"
            :class="badgeClass"
          >
            {{ badgeLabel }}
          </span>
        </div>

        <div class="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <div v-if="loadingConfigs" class="flex justify-center py-10">
            <div class="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
          </div>

          <template v-else>
            <div v-if="configs.length > 1" class="space-y-1.5">
              <p class="text-xs font-medium text-gray-600 dark:text-gray-300">
                {{ t('records.productConfigGuidedPickConfig') }}
              </p>
              <select
                v-model="selectedConfigId"
                class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                @change="onConfigChange"
              >
                <option v-for="c in configs" :key="c._id" :value="String(c._id)">
                  {{ c.name }} (v{{ c.version || 1 }})
                </option>
              </select>
            </div>

            <p v-if="!activeConfig" class="text-sm text-gray-500">
              {{ t('records.productConfigGuidedNone') }}
            </p>

            <template v-else>
              <p class="text-xs text-gray-500">{{ t('records.productConfigGuidedHint') }}</p>

              <div
                v-for="opt in sortedOptions"
                :key="opt.optionName"
                class="rounded-xl border border-gray-200 bg-gray-50/60 p-3 dark:border-gray-600 dark:bg-gray-900/40"
              >
                <p class="text-xs font-medium text-gray-700 dark:text-gray-200">
                  {{ opt.optionName }}
                  <span v-if="opt.required" class="text-red-500">*</span>
                </p>

                <div v-if="opt.optionType === 'checkbox'" class="mt-2">
                  <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                    <input
                      v-model="selections[opt.optionName]"
                      type="checkbox"
                      class="rounded border-gray-300 text-indigo-600"
                      @change="validate"
                    />
                    {{ t('records.productConfigGuidedChecked') }}
                  </label>
                </div>

                <div v-else-if="opt.optionType === 'single_select'" class="mt-2 space-y-1">
                  <label
                    v-for="v in optionValues(opt)"
                    :key="v"
                    class="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white dark:hover:bg-gray-800"
                    :class="selections[opt.optionName] === v ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''"
                  >
                    <input
                      v-model="selections[opt.optionName]"
                      type="radio"
                      :value="v"
                      class="border-gray-300 text-indigo-600"
                      @change="validate"
                    />
                    {{ v }}
                  </label>
                </div>

                <div v-else-if="opt.optionType === 'multi_select'" class="mt-2 space-y-1">
                  <label
                    v-for="v in optionValues(opt)"
                    :key="v"
                    class="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white dark:hover:bg-gray-800"
                  >
                    <input
                      :checked="Array.isArray(selections[opt.optionName]) && selections[opt.optionName].includes(v)"
                      type="checkbox"
                      class="rounded border-gray-300 text-indigo-600"
                      @change="toggleMulti(opt.optionName, v, $event)"
                    />
                    {{ v }}
                  </label>
                </div>

                <select
                  v-else
                  v-model="selections[opt.optionName]"
                  class="mt-2 w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  @change="validate"
                >
                  <option value="">{{ t('records.productConfigGuidedSelect') }}</option>
                  <option v-for="v in optionValues(opt)" :key="v" :value="v">{{ v }}</option>
                </select>
              </div>

              <div class="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900/50">
                <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  {{ t('records.productConfigGuidedValidation') }}
                </p>
                <div
                  v-if="result?.valid"
                  class="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-200"
                >
                  {{ t('records.productConfigGuidedValid') }}
                </div>
                <ul v-else-if="result?.errors?.length" class="mt-2 space-y-1.5">
                  <li
                    v-for="(e, i) in result.errors"
                    :key="i"
                    class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-200"
                  >
                    {{ e.message }}
                  </li>
                </ul>
                <p v-else class="mt-2 text-xs text-gray-500">{{ t('records.productConfigGuidedIdle') }}</p>
                <div v-if="result?.appliedDependencies?.length" class="mt-3">
                  <p class="text-[11px] font-medium text-gray-500">{{ t('records.productConfigGuidedDeps') }}</p>
                  <ul class="mt-1 space-y-0.5 text-xs text-gray-700 dark:text-gray-300">
                    <li v-for="(d, i) in result.appliedDependencies" :key="i">
                      {{ d.action }} → {{ d.option }}{{ d.value ? `: ${d.value}` : '' }}
                    </li>
                  </ul>
                </div>
              </div>
            </template>
          </template>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 px-5 py-3 dark:border-gray-700">
          <button
            type="button"
            class="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            @click="skip"
          >
            {{ t('records.productConfigGuidedSkip') }}
          </button>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              @click="cancel"
            >
              {{ t('actions.cancel') }}
            </button>
            <button
              type="button"
              class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              :disabled="!canConfirm || confirming"
              @click="confirm"
            >
              {{ confirming ? t('states.saving') : t('records.productConfigGuidedConfirm') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';

const props = defineProps({
  open: { type: Boolean, default: false },
  hit: { type: Object, default: null },
  /** Preloaded active configs for the item group */
  configs: { type: Array, default: () => [] },
  loadingConfigs: { type: Boolean, default: false }
});

const emit = defineEmits(['confirm', 'skip', 'cancel']);

const { t } = useI18n();

const selectedConfigId = ref('');
const selections = reactive({});
const result = ref(null);
const validating = ref(false);
const confirming = ref(false);
let validateTimer = null;

const productLabel = computed(() => {
  const hit = props.hit || {};
  return hit.item_name || hit.variant_code || hit.name || '—';
});

const activeConfig = computed(() => {
  if (!props.configs?.length) return null;
  if (selectedConfigId.value) {
    return props.configs.find((c) => String(c._id) === String(selectedConfigId.value)) || props.configs[0];
  }
  return props.configs[0];
});

const sortedOptions = computed(() => {
  const opts = activeConfig.value?.options || [];
  return [...opts]
    .filter((o) => o.optionName)
    .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
});

const canConfirm = computed(() => Boolean(activeConfig.value && result.value?.valid));

const badgeClass = computed(() => {
  if (result.value?.valid) {
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
  }
  if (result.value?.errors?.length) {
    return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200';
  }
  return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
});

const badgeLabel = computed(() => {
  if (result.value?.valid) return t('records.productConfigGuidedBadgeValid');
  if (result.value?.errors?.length) {
    return t('records.productConfigGuidedBadgeInvalid', { count: result.value.errors.length });
  }
  return t('records.productConfigGuidedBadgeIdle');
});

function optionValues(opt) {
  return Array.isArray(opt?.values) ? opt.values : [];
}

function resetSelections() {
  Object.keys(selections).forEach((k) => delete selections[k]);
  for (const opt of sortedOptions.value) {
    if (opt.optionType === 'multi_select') selections[opt.optionName] = [];
    else if (opt.optionType === 'checkbox') selections[opt.optionName] = false;
    else selections[opt.optionName] = opt.defaultValue ?? '';
  }
  result.value = null;
}

function onConfigChange() {
  resetSelections();
  scheduleValidate();
}

function toggleMulti(name, value, event) {
  let arr = Array.isArray(selections[name]) ? [...selections[name]] : [];
  if (event?.target?.checked) {
    if (!arr.includes(value)) arr.push(value);
  } else {
    arr = arr.filter((v) => v !== value);
  }
  selections[name] = arr;
  scheduleValidate();
}

function scheduleValidate() {
  clearTimeout(validateTimer);
  validateTimer = setTimeout(validate, 220);
}

async function validate() {
  if (!activeConfig.value) {
    result.value = null;
    return;
  }
  validating.value = true;
  try {
    const res = await apiClient.post('/product-configurations/validate', {
      configurationId: activeConfig.value._id,
      selections: { ...selections },
      requireActive: true
    });
    const data = res?.data ?? res;
    result.value = data && typeof data === 'object' ? data : null;
    if (result.value?.selections) {
      for (const [k, v] of Object.entries(result.value.selections)) {
        selections[k] = v;
      }
    }
  } catch (e) {
    result.value = {
      valid: false,
      errors: [{ message: e?.response?.data?.message || e.message }]
    };
  } finally {
    validating.value = false;
  }
}

function confirm() {
  if (!canConfirm.value || !activeConfig.value) return;
  confirming.value = true;
  emit('confirm', {
    productConfigurationId: String(activeConfig.value._id),
    configurationSelections: { ...(result.value?.selections || selections) },
    configuration: activeConfig.value
  });
  confirming.value = false;
}

function skip() {
  emit('skip');
}

function cancel() {
  emit('cancel');
}

watch(
  () => [props.open, props.configs],
  () => {
    if (!props.open) return;
    selectedConfigId.value = props.configs?.[0] ? String(props.configs[0]._id) : '';
    resetSelections();
    if (activeConfig.value) scheduleValidate();
  },
  { immediate: true, deep: true }
);
</script>
