<template>
  <div class="space-y-4">
    <div class="relative pl-6">
      <div class="absolute bottom-2 left-[11px] top-2 w-0.5 bg-gray-200 dark:bg-gray-700" />
      <div
        v-for="(step, index) in steps"
        :key="step.id"
        class="relative mb-4 last:mb-0"
      >
        <span class="absolute -left-6 top-1 flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-indigo-600 bg-white text-[10px] font-bold text-indigo-600 dark:bg-gray-900">
          {{ index + 1 }}
        </span>
        <div class="rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-700 dark:bg-gray-900/30">
          <div class="flex flex-wrap items-start gap-3">
            <div class="min-w-[140px] flex-1">
              <label class="mb-1 block text-xs font-medium text-gray-500">{{ t('settings.slaEscalationRole') }}</label>
              <select
                v-model="step.role"
                class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                <option v-for="opt in roleOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
            </div>
            <div class="w-28">
              <label class="mb-1 block text-xs font-medium text-gray-500">{{ t('settings.slaEscalationDelay') }}</label>
              <div class="flex items-center gap-1">
                <input
                  v-model.number="step.delayMinutes"
                  type="number"
                  min="0"
                  class="w-full rounded-lg border border-gray-200 px-2 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
                <span class="text-xs text-gray-400">{{ t('settings.slaAlertMinutesShort') }}</span>
              </div>
            </div>
            <button
              v-if="steps.length > 1"
              type="button"
              class="mt-5 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
              @click="removeStep(index)"
            >
              <TrashIcon class="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-4 rounded-xl border border-gray-100 bg-gray-50/50 px-4 py-3 dark:border-gray-800 dark:bg-gray-900/30">
      <div>
        <label class="mb-1 block text-xs font-medium text-gray-500">{{ t('settings.slaEscalationCooldown') }}</label>
        <div class="flex items-center gap-1">
          <input
            v-model.number="cooldownMinutes"
            type="number"
            min="0"
            class="w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
          <span class="text-xs text-gray-400">{{ t('settings.slaAlertMinutesShort') }}</span>
        </div>
      </div>
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-600 hover:border-indigo-400 hover:text-indigo-600 dark:border-gray-600 dark:text-gray-400"
        @click="addStep"
      >
        <PlusIcon class="h-4 w-4" />
        {{ t('settings.slaEscalationAddStep') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { PlusIcon, TrashIcon } from '@heroicons/vue/24/outline';
import { normalizeEscalationStep } from '@/components/settings/helpdesk/slaPolicyNormalize.js';
import { buildEscalationRoleOptions } from '@/components/settings/helpdesk/slaPolicyOptionLabels.js';

const props = defineProps({
  slaPolicyOptions: { type: Object, required: true }
});

const steps = defineModel('steps', { type: Array, default: () => [] });
const cooldownMinutes = defineModel('cooldownMinutes', { type: Number, default: 15 });

const { t } = useI18n();

const roleOptions = computed(() => buildEscalationRoleOptions(props.slaPolicyOptions.escalationRoles, t));

function addStep() {
  const defaultRole = props.slaPolicyOptions.escalationRoles?.[1]
    || props.slaPolicyOptions.escalationRoles?.[0];
  steps.value = [...steps.value, normalizeEscalationStep({
    role: defaultRole,
    delayMinutes: props.slaPolicyOptions.defaultAlertTimingMinutes
  }, props.slaPolicyOptions)];
}

function removeStep(index) {
  steps.value = steps.value.filter((_, i) => i !== index);
}
</script>
