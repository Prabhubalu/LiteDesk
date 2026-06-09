<template>
  <div
    v-if="visible"
    ref="panelRootRef"
    class="rounded-2xl border p-5 shadow-sm"
    :class="panelClass"
  >
    <!-- Audit: slim CTA to dedicated workflow surface -->
    <template v-if="isAudit">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-xs font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
            {{ t('events.recordExecutionAuditBadge') }}
          </p>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {{ t('events.recordExecutionAuditHint') }}
          </p>
        </div>
        <BadgeCell
          v-if="auditStateLabel"
          :value="auditStateLabel"
          variant="info"
        />
      </div>
      <div class="mt-4 flex flex-wrap gap-2">
        <router-link
          :to="executeRoute"
          class="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
        >
          {{ t('events.recordExecutionContinueAudit') }}
          <ArrowTopRightOnSquareIcon class="h-4 w-4 shrink-0" aria-hidden="true" />
        </router-link>
      </div>
    </template>

    <!-- Generic: terminal states -->
    <template v-else-if="executionState === 'COMPLETED'">
      <div class="flex items-start gap-3">
        <CheckCircleIcon class="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        <div class="min-w-0">
          <p class="text-sm font-medium text-emerald-900 dark:text-emerald-100">
            {{ t('events.eventExecutionSurfaceEventCompleted') }}
          </p>
          <p class="mt-0.5 text-sm text-emerald-800/90 dark:text-emerald-200/90">
            {{ t('events.eventExecutionSurfaceThisEventHasBeenSuccessfullyCompleted') }}
          </p>
        </div>
      </div>
    </template>

    <template v-else-if="executionState === 'CANCELLED'">
      <div class="flex items-start gap-3">
        <XCircleIcon class="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />
        <div class="min-w-0">
          <p class="text-sm font-medium text-red-900 dark:text-red-100">
            {{ t('events.eventExecutionSurfaceEventCancelled') }}
          </p>
          <p class="mt-0.5 text-sm text-red-800/90 dark:text-red-200/90">
            {{ t('events.recordExecutionCancelledHint') }}
          </p>
        </div>
      </div>
    </template>

    <!-- Generic: active execution -->
    <template v-else>
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
            {{ t('events.recordExecutionBadge') }}
          </p>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {{ statusHint }}
          </p>
        </div>
        <BadgeCell
          :value="lifecycleStatusLabel"
          :variant-map="statusVariantMap"
        />
      </div>

      <div
        v-if="executionError"
        class="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
        role="alert"
      >
        {{ executionError }}
      </div>

      <div class="mt-4 flex flex-wrap gap-2">
        <button
          v-if="executionState === 'NOT_STARTED' && canStart"
          type="button"
          class="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          :disabled="starting"
          @click="handleStart"
        >
          <PlayCircleIcon class="h-4 w-4 shrink-0" aria-hidden="true" />
          {{ starting ? t('states.loading') : t('events.eventExecutionStartEvent') }}
        </button>

        <button
          v-if="executionState === 'IN_PROGRESS' && canComplete"
          type="button"
          class="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          :disabled="completing"
          @click="handleComplete"
        >
          <CheckCircleIcon class="h-4 w-4 shrink-0" aria-hidden="true" />
          {{ completing ? t('states.loading') : t('events.eventExecutionCompleteEvent') }}
        </button>

        <button
          v-if="executionState === 'IN_PROGRESS' && canCancel"
          type="button"
          class="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:bg-gray-900 dark:text-red-300 dark:hover:bg-red-950/50 disabled:opacity-50"
          :disabled="completing"
          @click="handleCancel"
        >
          {{ t('events.eventExecutionSurfaceCancelExecution') }}
        </button>
      </div>

      <p
        v-if="!canStart && !canComplete && executionState !== 'COMPLETED' && executionState !== 'CANCELLED'"
        class="mt-3 text-xs text-gray-500 dark:text-gray-400"
      >
        {{ t('events.eventExecutionSurfaceYouDoNotHavePermissionTo2') }}
      </p>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, toRef } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  PlayCircleIcon,
  XCircleIcon
} from '@heroicons/vue/24/outline';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import { useGenericEventExecution } from '@/composables/useGenericEventExecution';
import { isAuditEventType } from '@/utils/eventUtils';

const props = defineProps({
  event: { type: Object, required: true },
  eventId: { type: String, required: true }
});

const emit = defineEmits(['updated']);

const { t } = useI18n();
const panelRootRef = ref(null);

const isAudit = computed(() => isAuditEventType(props.event?.eventType));

const auditTerminalStates = new Set(['approved', 'closed', 'rejected']);

const visible = computed(() => {
  if (!props.event || !props.eventId) return false;
  if (props.event?.appointment?.isAppointment) return false;
  if (isAudit.value) {
    const state = String(props.event?.auditState || '').trim().toLowerCase();
    return !auditTerminalStates.has(state);
  }
  return true;
});

const executeRoute = computed(() => `/events/${props.eventId}/execute`);

const auditStateLabel = computed(() => {
  const state = String(props.event?.auditState || '').trim();
  return state || null;
});

const lifecycleStatusLabel = computed(() => {
  const status = String(props.event?.status || '').trim();
  if (status) return status;
  if (executionState.value === 'IN_PROGRESS') return t('events.recordExecutionInProgressLabel');
  return t('events.recordExecutionPlannedLabel');
});

const statusVariantMap = {
  planned: 'info',
  scheduled: 'info',
  completed: 'success',
  cancelled: 'danger',
  canceled: 'danger',
  'in-progress': 'warning',
  'in progress': 'warning'
};

const panelClass = computed(() => {
  if (isAudit.value) {
    return 'border-violet-200/60 bg-gradient-to-br from-violet-50/80 to-white dark:border-violet-500/30 dark:from-violet-950/40 dark:to-gray-900';
  }
  if (executionState.value === 'COMPLETED') {
    return 'border-emerald-200/80 bg-emerald-50/60 dark:border-emerald-800/60 dark:bg-emerald-950/30';
  }
  if (executionState.value === 'CANCELLED') {
    return 'border-red-200/80 bg-red-50/60 dark:border-red-800/60 dark:bg-red-950/30';
  }
  return 'border-indigo-200/60 bg-gradient-to-br from-indigo-50/80 to-white dark:border-indigo-500/30 dark:from-indigo-950/40 dark:to-gray-900';
});

const {
  starting,
  completing,
  executionError,
  executionState,
  canStart,
  canComplete,
  canCancel,
  startEvent,
  completeEvent,
  cancelEvent
} = useGenericEventExecution(toRef(props, 'event'), toRef(props, 'eventId'));

const statusHint = computed(() => {
  if (executionState.value === 'NOT_STARTED') {
    return t('events.eventExecutionSurfaceThisEventIsScheduledAndReady');
  }
  if (executionState.value === 'IN_PROGRESS') {
    return t('events.eventExecutionSurfaceExecutionIsCurrentlyActive');
  }
  return '';
});

async function handleStart() {
  const ok = await startEvent(() => emit('updated'));
  if (ok) {
    executionError.value = null;
  }
}

async function handleComplete() {
  if (!window.confirm(t('events.recordConfirmCompleteEvent'))) return;
  await completeEvent(() => emit('updated'));
}

async function handleCancel() {
  if (!window.confirm(t('events.recordConfirmCancelEvent'))) return;
  await cancelEvent(() => emit('updated'));
}

defineExpose({ panelRootRef });
</script>
