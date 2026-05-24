<template>
  <div class="min-h-full bg-gray-50 dark:bg-gray-900/50">
    <div class="max-w-2xl mx-auto py-8 px-4 sm:px-6">
      <button
        type="button"
        class="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
        @click="cancel"
      >
        <ArrowLeftIcon class="h-4 w-4" />
        {{ t('performance.cancelWizard') }}
      </button>

      <header class="mb-8">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('performance.wizardTitle') }}</h1>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('performance.wizardSubtitle') }}</p>
      </header>

      <div class="mb-8">
        <p class="text-sm font-medium text-indigo-600 dark:text-indigo-400">
          {{ t('performance.wizardStepOf', { current: step + 1, total: stepItems.length }) }}
        </p>
        <div class="mt-3 flex gap-1" role="presentation">
          <div
            v-for="(_, i) in stepItems"
            :key="i"
            class="h-1.5 flex-1 rounded-full transition-colors duration-300"
            :class="i <= step ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'"
          />
        </div>
        <h2 class="mt-5 text-lg font-semibold text-gray-900 dark:text-white">{{ stepItems[step]?.label }}</h2>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ stepItems[step]?.hint }}</p>
      </div>

      <div class="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm p-6 sm:p-8">
        <!-- Type -->
        <div v-if="step === 0" class="grid gap-3 sm:grid-cols-2">
          <button
            v-for="type in targetTypes"
            :key="type.key"
            type="button"
            class="rounded-xl border-2 p-4 text-left transition-all"
            :class="form.targetTypeKey === type.key
              ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 ring-1 ring-indigo-600'
              : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'"
            @click="selectType(type)"
          >
            <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ type.name }}</span>
            <p v-if="type.description" class="mt-1 text-xs text-gray-500">{{ type.description }}</p>
          </button>
        </div>

        <!-- Modules -->
        <div v-else-if="step === 1" class="flex flex-wrap gap-2">
          <button
            v-for="mod in suggestedModules"
            :key="`${mod.appKey}-${mod.moduleKey}`"
            type="button"
            class="rounded-full border px-4 py-2 text-sm font-medium transition-colors"
            :class="isModuleSelected(mod)
              ? 'border-indigo-600 bg-indigo-600 text-white'
              : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-indigo-400'"
            @click="toggleModule(mod)"
          >
            {{ moduleLabel(mod) }}
          </button>
        </div>

        <!-- Rules -->
        <div v-else-if="step === 2" class="rounded-xl bg-gray-50 dark:bg-gray-900/50 p-4 text-sm text-gray-600 dark:text-gray-400 space-y-2">
          <p v-for="mod in parseModules()" :key="`${mod.appKey}-${mod.moduleKey}`">
            <span class="font-medium text-gray-900 dark:text-white">{{ moduleLabel(mod) }}</span>
            — {{ ruleSummary(mod) }}
          </p>
        </div>

        <!-- Value -->
        <div v-else-if="step === 3" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{{ t('performance.targetNameLabel') }}</label>
            <input
              v-model="form.name"
              type="text"
              class="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-3 py-2.5 text-sm"
              :placeholder="t('performance.targetNamePlaceholder')"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{{ t('performance.targetValueLabel') }}</label>
            <input
              v-model.number="form.targetValue"
              type="number"
              min="0"
              class="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-3 py-2.5 text-sm tabular-nums"
            />
          </div>
        </div>

        <!-- Period -->
        <div v-else-if="step === 4" class="space-y-4">
          <div class="flex flex-wrap gap-2">
            <button
              v-for="preset in periodPresets"
              :key="preset.id"
              type="button"
              class="rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
              :class="periodPreset === preset.id
                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200'
                : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'"
              @click="applyPeriodPreset(preset.id)"
            >
              {{ preset.label }}
            </button>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">{{ t('performance.periodStartLabel') }}</label>
              <input v-model="form.periodStart" type="date" class="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-3 py-2 text-sm" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-500 mb-1">{{ t('performance.periodEndLabel') }}</label>
              <input v-model="form.periodEnd" type="date" class="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 px-3 py-2 text-sm" />
            </div>
          </div>
        </div>

        <!-- Distribution -->
        <div v-else-if="step === 5" class="grid gap-3 sm:grid-cols-2">
          <button
            v-for="opt in distributionOptions"
            :key="opt.value"
            type="button"
            class="rounded-xl border-2 p-4 text-left transition-all"
            :class="form.distributionType === opt.value
              ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30'
              : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'"
            @click="form.distributionType = opt.value"
          >
            <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ opt.label }}</span>
            <p class="mt-1 text-xs text-gray-500">{{ opt.desc }}</p>
          </button>
        </div>

        <!-- Assign -->
        <div v-else-if="step === 6" class="rounded-xl border border-gray-200 dark:border-gray-600 p-4 text-sm text-gray-600 dark:text-gray-400">
          {{ t('performance.wizardStepAssignHint') }}
        </div>

        <!-- Thresholds -->
        <div v-else-if="step === 7" class="space-y-2">
          <label
            v-for="th in thresholdOptions"
            :key="th.percent"
            class="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-600 p-4 hover:bg-gray-50 dark:hover:bg-gray-900/30"
          >
            <input v-model="thresholdPercents" type="checkbox" :value="th.percent" class="rounded border-gray-300 text-indigo-600" />
            <span class="text-sm font-medium text-gray-900 dark:text-white">{{ th.label }}</span>
          </label>
        </div>

        <!-- Forecast -->
        <div v-else-if="step === 8">
          <label class="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 dark:border-gray-600 p-4">
            <input v-model="form.forecastRules.enabled" type="checkbox" class="mt-0.5 rounded border-gray-300 text-indigo-600" />
            <span class="text-sm text-gray-700 dark:text-gray-300">{{ t('performance.forecastEnable') }}</span>
          </label>
        </div>

        <!-- Review -->
        <div v-else class="space-y-4">
          <dl class="divide-y divide-gray-100 dark:divide-gray-700 text-sm">
            <div class="flex justify-between py-3 gap-4">
              <dt class="text-gray-500">{{ t('performance.targetNameLabel') }}</dt>
              <dd class="font-medium text-gray-900 dark:text-white text-right">{{ form.name || '—' }}</dd>
            </div>
            <div class="flex justify-between py-3 gap-4">
              <dt class="text-gray-500">{{ t('performance.targetValueLabel') }}</dt>
              <dd class="font-medium tabular-nums text-right">{{ form.targetValue }}</dd>
            </div>
            <div class="flex justify-between py-3 gap-4">
              <dt class="text-gray-500">{{ t('performance.periodLabel') }}</dt>
              <dd class="text-right text-gray-900 dark:text-white">{{ formatPeriodRange(form.periodStart, form.periodEnd) }}</dd>
            </div>
            <div class="flex justify-between py-3 gap-4">
              <dt class="text-gray-500">{{ t('performance.wizardStepModules') }}</dt>
              <dd class="text-right text-gray-900 dark:text-white">{{ selectedModuleKeys.length }}</dd>
            </div>
          </dl>
          <div
            v-if="conflicts.length"
            class="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4 text-sm text-amber-800 dark:text-amber-200"
          >
            {{ t('performance.conflictWarning') }}
          </div>
        </div>

        <p v-if="error" class="mt-4 rounded-lg bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {{ error }}
        </p>
      </div>

      <div class="mt-8 flex items-center justify-between gap-4">
        <button
          type="button"
          class="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40"
          :disabled="step === 0 || saving"
          @click="step--"
        >
          {{ t('performance.back') }}
        </button>
        <button
          v-if="step < stepItems.length - 1"
          type="button"
          class="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          :disabled="!canContinue"
          @click="nextStep"
        >
          {{ t('performance.next') }}
        </button>
        <button
          v-else
          type="button"
          class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          :disabled="saving || !canActivate"
          @click="submit"
        >
          <span v-if="saving" class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          {{ t('performance.activateTarget') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { ArrowLeftIcon } from '@heroicons/vue/24/outline';
import { useAuthStore } from '@/stores/authRegistry';
import apiClient from '@/utils/apiClient';
import { APP_LABELS, MODULE_LABELS, formatPeriodRange } from '@/utils/targetDisplayUtils';

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();

const stepItems = computed(() => [
  { id: 'type', label: t('performance.wizardStepType'), hint: t('performance.wizardStepTypeHint') },
  { id: 'modules', label: t('performance.wizardStepModules'), hint: t('performance.wizardStepModulesHint') },
  { id: 'rules', label: t('performance.wizardStepRules'), hint: t('performance.wizardStepRulesHint') },
  { id: 'value', label: t('performance.wizardStepValue'), hint: t('performance.wizardStepValueHint') },
  { id: 'period', label: t('performance.wizardStepPeriod'), hint: t('performance.wizardStepPeriodHint') },
  { id: 'distribution', label: t('performance.wizardStepDistribution'), hint: t('performance.wizardStepDistributionHint') },
  { id: 'assign', label: t('performance.wizardStepAssign'), hint: t('performance.wizardStepAssignHint') },
  { id: 'thresholds', label: t('performance.wizardStepThresholds'), hint: t('performance.wizardStepThresholdsHint') },
  { id: 'forecast', label: t('performance.wizardStepForecast'), hint: t('performance.wizardStepForecastHint') },
  { id: 'review', label: t('performance.wizardStepReview'), hint: t('performance.wizardStepReviewHint') },
]);

const distributionOptions = computed(() => [
  { value: 'equal', label: t('performance.distributionEqual'), desc: t('performance.distributionEqualDesc') },
  { value: 'weighted', label: t('performance.distributionWeighted'), desc: t('performance.distributionWeightedDesc') },
  { value: 'manual', label: t('performance.distributionManual'), desc: t('performance.distributionManualDesc') },
  { value: 'capacity', label: t('performance.distributionCapacity'), desc: t('performance.distributionCapacityDesc') },
]);

const thresholdOptions = computed(() => [
  { percent: 80, label: t('performance.threshold80') },
  { percent: 100, label: t('performance.threshold100') },
  { percent: 120, label: t('performance.threshold120') },
]);

const periodPresets = computed(() => [
  { id: 'month', label: t('performance.periodThisMonth') },
  { id: 'quarter', label: t('performance.periodThisQuarter') },
  { id: 'custom', label: t('performance.periodCustom') },
]);

const step = ref(0);
const targetTypes = ref([]);
const conflicts = ref([]);
const saving = ref(false);
const error = ref(null);
const thresholdPercents = ref([80, 100]);
const selectedModuleKeys = ref([]);
const periodPreset = ref('quarter');

const form = ref({
  name: '',
  targetTypeKey: 'revenue',
  targetValue: 10000,
  metricKind: 'currency',
  distributionType: 'equal',
  periodStart: '',
  periodEnd: '',
  forecastRules: { enabled: false, includePipeline: true },
});

const suggestedModules = computed(() => {
  const type = targetTypes.value.find((x) => x.key === form.value.targetTypeKey);
  return type?.defaultSourceModules || [];
});

const canContinue = computed(() => {
  if (step.value === 1) return selectedModuleKeys.value.length > 0;
  if (step.value === 3) return form.value.name?.trim() && form.value.targetValue > 0;
  if (step.value === 4) return form.value.periodStart && form.value.periodEnd;
  return true;
});

const canActivate = computed(() => form.value.name?.trim() && form.value.targetValue > 0 && selectedModuleKeys.value.length);

watch(
  () => form.value.targetTypeKey,
  () => {
    const type = targetTypes.value.find((x) => x.key === form.value.targetTypeKey);
    if (type) form.value.metricKind = type.metricKind;
    selectedModuleKeys.value = suggestedModules.value.map((m) => `${m.appKey}:${m.moduleKey}`);
    if (!form.value.name && type?.name) {
      form.value.name = `${type.name} — ${new Date().getFullYear()}`;
    }
  }
);

function moduleLabel(mod) {
  return `${APP_LABELS[mod.appKey] || mod.appKey} · ${MODULE_LABELS[mod.moduleKey] || mod.moduleKey}`;
}

function ruleSummary(mod) {
  if (mod.moduleKey === 'deals') return 'Won deals count toward goal';
  if (mod.moduleKey === 'cases') return 'Resolved cases count toward goal';
  if (mod.moduleKey === 'tasks') return 'Completed tasks count toward goal';
  return 'Matching records count toward goal';
}

function isModuleSelected(mod) {
  return selectedModuleKeys.value.includes(`${mod.appKey}:${mod.moduleKey}`);
}

function toggleModule(mod) {
  const key = `${mod.appKey}:${mod.moduleKey}`;
  if (isModuleSelected(mod)) {
    selectedModuleKeys.value = selectedModuleKeys.value.filter((k) => k !== key);
  } else {
    selectedModuleKeys.value = [...selectedModuleKeys.value, key];
  }
}

function selectType(type) {
  form.value.targetTypeKey = type.key;
}

function parseModules() {
  return selectedModuleKeys.value.map((key) => {
    const [appKey, moduleKey] = key.split(':');
    return { appKey, moduleKey };
  });
}

function applyPeriodPreset(id) {
  periodPreset.value = id;
  const now = new Date();
  if (id === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    form.value.periodStart = start.toISOString().slice(0, 10);
    form.value.periodEnd = end.toISOString().slice(0, 10);
  } else if (id === 'quarter') {
    const q = Math.floor(now.getMonth() / 3);
    const start = new Date(now.getFullYear(), q * 3, 1);
    const end = new Date(now.getFullYear(), q * 3 + 3, 0);
    form.value.periodStart = start.toISOString().slice(0, 10);
    form.value.periodEnd = end.toISOString().slice(0, 10);
  }
}

async function nextStep() {
  error.value = null;
  if (step.value === 4) {
    try {
      const res = await apiClient.post('/targets/conflicts/check', {
        ownerId: authStore.user?._id,
        periodStart: form.value.periodStart,
        periodEnd: form.value.periodEnd,
        sourceModules: parseModules(),
      });
      conflicts.value = res?.data || [];
    } catch {
      conflicts.value = [];
    }
  }
  step.value += 1;
}

async function submit() {
  saving.value = true;
  error.value = null;
  try {
    const thresholds = thresholdPercents.value.map((percent) => ({ percent, notify: true }));
    const createRes = await apiClient.post('/targets', {
      ...form.value,
      ownerId: authStore.user?._id,
      sourceModules: parseModules(),
      thresholds,
      periodStart: new Date(form.value.periodStart).toISOString(),
      periodEnd: new Date(form.value.periodEnd).toISOString(),
    });
    const id = createRes?.data?._id;
    await apiClient.post(`/targets/${id}/activate`, {
      overrideConflicts: conflicts.value.length > 0,
    });
    router.replace(`/targets/${id}`);
  } catch (e) {
    error.value = e?.message || e?.data?.message || 'Failed to create target';
  } finally {
    saving.value = false;
  }
}

function cancel() {
  router.push('/settings?tab=performance&view=targets');
}

onMounted(async () => {
  applyPeriodPreset('quarter');
  const res = await apiClient.get('/targets/types');
  targetTypes.value = res?.data || [];
  if (targetTypes.value.length) {
    selectType(targetTypes.value[0]);
  }
});
</script>
