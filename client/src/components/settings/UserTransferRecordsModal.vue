<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 overflow-y-auto"
      @keydown.esc="close"
    >
      <div class="fixed inset-0 bg-black/50 backdrop-blur-sm" @click="close" />

      <div class="flex min-h-full items-center justify-center p-4">
        <div
          class="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl dark:bg-gray-800"
          role="dialog"
          aria-modal="true"
          @click.stop
        >
          <div class="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
            <div>
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ title }}
              </h2>
              <p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                {{ displayName }}
              </p>
            </div>
            <button
              type="button"
              class="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
              :aria-label="t('common.closePanel')"
              @click="close"
            >
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div
            v-if="steps.length > 1"
            class="border-b border-gray-100 px-6 py-3 dark:border-gray-700/80"
          >
            <ol class="flex items-center gap-2 text-xs font-medium">
              <li
                v-for="(step, idx) in steps"
                :key="step.id"
                class="flex items-center gap-2"
                :class="idx <= stepIndex ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'"
              >
                <span
                  class="flex h-6 w-6 items-center justify-center rounded-full text-[11px]"
                  :class="idx < stepIndex
                    ? 'bg-indigo-600 text-white'
                    : idx === stepIndex
                      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                      : 'bg-gray-100 text-gray-500 dark:bg-gray-700'"
                >
                  {{ idx + 1 }}
                </span>
                <span class="hidden sm:inline">{{ step.label }}</span>
                <span v-if="idx < steps.length - 1" class="mx-1 text-gray-300">/</span>
              </li>
            </ol>
          </div>

          <div class="max-h-[60vh] overflow-y-auto px-6 py-5">
            <div v-if="currentStepId === 'deactivate'" class="space-y-4">
              <div class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                {{ t('settings.userLifecycleDeactivateInfo') }}
              </div>
              <ul class="list-inside list-disc space-y-1 text-sm text-gray-600 dark:text-gray-300">
                <li>{{ t('settings.userLifecycleDeactivateBulletLogin') }}</li>
                <li>{{ t('settings.userLifecycleDeactivateBulletAssign') }}</li>
                <li>{{ t('settings.userLifecycleDeactivateBulletBilling') }}</li>
              </ul>
              <p class="text-sm text-gray-700 dark:text-gray-200">
                {{ t('settings.userLifecycleDeactivateConfirm', { name: displayName }) }}
              </p>
            </div>

            <div v-else-if="currentStepId === 'transfer'" class="space-y-4">
              <div class="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
                {{ transferInfoText }}
              </div>

              <div v-if="summaryLoading" class="flex justify-center py-8">
                <div class="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
              </div>

              <template v-else>
                <div class="rounded-lg border border-gray-200 dark:border-gray-700">
                  <div class="border-b border-gray-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    {{ t('settings.userLifecycleOpenRecords') }}
                    <span class="ml-1 font-bold text-gray-900 dark:text-white">({{ summary.openTotal }})</span>
                  </div>
                  <ul class="divide-y divide-gray-100 dark:divide-gray-700">
                    <li
                      v-for="mod in modulesWithOpen"
                      :key="mod.key"
                      class="flex items-center justify-between px-4 py-2 text-sm"
                    >
                      <span class="text-gray-700 dark:text-gray-200">{{ moduleLabel(mod.key) }}</span>
                      <span class="font-medium text-gray-900 dark:text-white">{{ mod.open }}</span>
                    </li>
                    <li v-if="!modulesWithOpen.length" class="px-4 py-3 text-sm text-gray-500">
                      {{ t('settings.userLifecycleNoOpenRecords') }}
                    </li>
                  </ul>
                </div>

                <div v-if="summary.openTotal > 0 || summary.closedTotal > 0" class="space-y-3">
                  <div v-if="summary.openTotal > 0 || includeClosed">
                    <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      {{ t('settings.userLifecycleTransferTo') }}
                      <span class="text-red-500">*</span>
                    </label>
                    <select
                      v-model="toUserId"
                      class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                    >
                      <option value="">{{ t('settings.userLifecycleSelectUser') }}</option>
                      <option
                        v-for="u in recipientOptions"
                        :key="u._id"
                        :value="u._id"
                      >
                        {{ userLabel(u) }}
                      </option>
                    </select>
                  </div>

                  <label
                    v-if="summary.closedTotal > 0"
                    class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                  >
                    <input
                      v-model="includeClosed"
                      type="checkbox"
                      class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    >
                    {{ t('settings.userLifecycleIncludeClosed', { count: summary.closedTotal }) }}
                  </label>
                </div>
              </template>
            </div>

            <div v-else-if="currentStepId === 'delete'" class="space-y-4">
              <div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
                {{ t('settings.userLifecycleDeleteInfo') }}
              </div>
              <p class="text-sm text-gray-700 dark:text-gray-200">
                {{ t('settings.userLifecycleDeleteConfirm', { name: displayName }) }}
              </p>
            </div>
          </div>

          <div class="flex items-center justify-between gap-3 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
            <button
              type="button"
              class="rounded-md px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700"
              :disabled="busy"
              @click="onSecondary"
            >
              {{ secondaryLabel }}
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              :class="currentStepId === 'delete' ? 'bg-red-600 hover:bg-red-500' : 'bg-indigo-600 hover:bg-indigo-500'"
              :disabled="!canPrimary || busy"
              @click="onPrimary"
            >
              <svg v-if="busy" class="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {{ primaryLabel }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';

const props = defineProps({
  open: { type: Boolean, default: false },
  /** @type {'deactivate' | 'transfer' | 'delete'} */
  mode: { type: String, required: true },
  user: { type: Object, default: null }
});

const emit = defineEmits(['close', 'completed']);

const { t } = useI18n();
const { success: notifySuccess, error: notifyError } = useNotifications();

const busy = ref(false);
const summaryLoading = ref(false);
const stepIndex = ref(0);
const toUserId = ref('');
const includeClosed = ref(false);
const recipients = ref([]);
const summary = ref({ modules: [], openTotal: 0, closedTotal: 0 });
/** When delete opens with open records, inject transfer first */
const deleteNeedsTransfer = ref(false);

const displayName = computed(() => {
  const u = props.user;
  if (!u) return '';
  const name = `${u.firstName || ''} ${u.lastName || ''}`.trim();
  return name || u.email || u.username || '';
});

const steps = computed(() => {
  if (props.mode === 'deactivate') {
    return [
      { id: 'deactivate', label: t('settings.userLifecycleStepDeactivate') },
      { id: 'transfer', label: t('settings.userLifecycleStepTransfer') }
    ];
  }
  if (props.mode === 'transfer') {
    return [{ id: 'transfer', label: t('settings.userLifecycleStepTransfer') }];
  }
  // delete
  if (deleteNeedsTransfer.value) {
    return [
      { id: 'transfer', label: t('settings.userLifecycleStepTransfer') },
      { id: 'delete', label: t('settings.userLifecycleStepDelete') }
    ];
  }
  return [{ id: 'delete', label: t('settings.userLifecycleStepDelete') }];
});

const currentStepId = computed(() => steps.value[stepIndex.value]?.id || 'deactivate');

const title = computed(() => {
  if (currentStepId.value === 'deactivate') return t('settings.userLifecycleDeactivateTitle');
  if (currentStepId.value === 'transfer') return t('settings.userLifecycleTransferTitle');
  return t('settings.userLifecycleDeleteTitle');
});

const transferInfoText = computed(() => {
  if (props.mode === 'delete' || deleteNeedsTransfer.value) {
    return t('settings.userLifecycleTransferRequiredForDelete');
  }
  return t('settings.userLifecycleTransferInfo');
});

const modulesWithOpen = computed(() =>
  (summary.value.modules || []).filter((m) => Number(m.open) > 0)
);

const recipientOptions = computed(() =>
  recipients.value.filter((u) => String(u._id) !== String(props.user?._id))
);

const needsTransferNow = computed(() =>
  summary.value.openTotal > 0 || (includeClosed.value && summary.value.closedTotal > 0)
);

const canSkipTransfer = computed(() =>
  props.mode === 'deactivate' && currentStepId.value === 'transfer'
);

const canPrimary = computed(() => {
  if (busy.value || summaryLoading.value) return false;
  if (currentStepId.value === 'transfer') {
    if (!needsTransferNow.value) return true;
    return Boolean(toUserId.value);
  }
  if (currentStepId.value === 'delete') {
    return summary.value.openTotal === 0;
  }
  return true;
});

const primaryLabel = computed(() => {
  if (currentStepId.value === 'deactivate') return t('settings.userLifecycleDeactivateAction');
  if (currentStepId.value === 'transfer') {
    if (!needsTransferNow.value) return t('settings.userLifecycleDone');
    return t('settings.userLifecycleTransferAction');
  }
  return t('settings.userLifecycleDeleteAction');
});

const secondaryLabel = computed(() => {
  if (canSkipTransfer.value) return t('settings.userLifecycleSkipTransfer');
  if (stepIndex.value > 0 && currentStepId.value === 'delete') return t('actions.back');
  return t('actions.cancel');
});

function moduleLabel(key) {
  const map = {
    people: t('settings.userLifecycleModulePeople'),
    organizations: t('settings.userLifecycleModuleOrganizations'),
    deals: t('settings.userLifecycleModuleDeals'),
    tasks: t('settings.userLifecycleModuleTasks'),
    cases: t('settings.userLifecycleModuleCases'),
    events: t('settings.userLifecycleModuleEvents'),
    items: t('settings.userLifecycleModuleItems'),
    documents: t('settings.userLifecycleModuleDocuments')
  };
  return map[key] || key;
}

function userLabel(u) {
  const name = `${u.firstName || ''} ${u.lastName || ''}`.trim();
  return name ? `${name} (${u.email})` : u.email;
}

function close() {
  if (busy.value) return;
  emit('close');
}

function finish(action) {
  emit('completed', { action });
  emit('close');
}

async function loadSummary() {
  if (!props.user?._id) return;
  summaryLoading.value = true;
  try {
    const res = await apiClient.get(`/users/${props.user._id}/ownership-summary`);
    if (res.success && res.data) {
      summary.value = {
        modules: res.data.modules || [],
        openTotal: Number(res.data.openTotal || 0),
        closedTotal: Number(res.data.closedTotal || 0)
      };
    }
  } catch (err) {
    console.error(err);
    notifyError(t('settings.userLifecycleSummaryFailed'));
  } finally {
    summaryLoading.value = false;
  }
}

async function loadRecipients() {
  try {
    const res = await apiClient.get('/users/list?scope=internal');
    recipients.value = Array.isArray(res.data) ? res.data : [];
  } catch (err) {
    console.error(err);
    recipients.value = [];
  }
}

async function resetWizard() {
  stepIndex.value = 0;
  toUserId.value = '';
  includeClosed.value = false;
  deleteNeedsTransfer.value = false;
  summary.value = { modules: [], openTotal: 0, closedTotal: 0 };
  if (!props.open || !props.user) return;

  await loadRecipients();

  if (props.mode === 'deactivate') {
    return;
  }

  await loadSummary();

  if (props.mode === 'delete' && summary.value.openTotal > 0) {
    deleteNeedsTransfer.value = true;
    stepIndex.value = 0;
  }
}

watch(
  () => [props.open, props.mode, props.user?._id],
  ([isOpen]) => {
    if (isOpen) resetWizard();
  }
);

function onSecondary() {
  if (busy.value) return;

  // Skip transfer after deactivate — allowed; open records remain until later
  if (canSkipTransfer.value) {
    finish('deactivated');
    return;
  }

  if (stepIndex.value > 0) {
    stepIndex.value -= 1;
    return;
  }
  close();
}

async function runTransfer() {
  const res = await apiClient.post(`/users/${props.user._id}/transfer-records`, {
    toUserId: toUserId.value,
    includeClosed: includeClosed.value
  });
  if (!res.success) {
    notifyError(t('settings.userLifecycleTransferFailed'));
    return false;
  }
  notifySuccess(t('settings.userLifecycleTransferSuccess', {
    count: res.data?.total || 0
  }));
  summary.value = {
    modules: res.data?.summary?.modules || [],
    openTotal: Number(res.data?.remainingOpen || 0),
    closedTotal: Number(res.data?.remainingClosed || 0)
  };
  return true;
}

async function onPrimary() {
  if (!canPrimary.value || busy.value) return;
  busy.value = true;
  try {
    if (currentStepId.value === 'deactivate') {
      const res = await apiClient.post(`/users/${props.user._id}/deactivate`);
      if (!res.success) {
        notifyError(t('settings.userLifecycleDeactivateFailed'));
        return;
      }
      notifySuccess(t('settings.userLifecycleDeactivateSuccess'));
      if (res.data) {
        summary.value = {
          modules: res.data.modules || [],
          openTotal: Number(res.data.openTotal || 0),
          closedTotal: Number(res.data.closedTotal || 0)
        };
      } else {
        await loadSummary();
      }
      // Always offer transfer next (even if zero — shows empty state + Done)
      stepIndex.value = 1;
      return;
    }

    if (currentStepId.value === 'transfer') {
      if (needsTransferNow.value) {
        const ok = await runTransfer();
        if (!ok) return;
      }

      if (props.mode === 'delete') {
        if (summary.value.openTotal > 0) {
          notifyError(t('settings.userLifecycleDeleteBlockedOpen', {
            count: summary.value.openTotal
          }));
          return;
        }
        deleteNeedsTransfer.value = false;
        stepIndex.value = 0; // steps recomputes to [delete] only
        return;
      }

      finish(props.mode === 'deactivate' ? 'deactivated' : 'transferred');
      return;
    }

    if (currentStepId.value === 'delete') {
      if (summary.value.openTotal > 0) {
        notifyError(t('settings.userLifecycleDeleteBlockedOpen', {
          count: summary.value.openTotal
        }));
        return;
      }
      const res = await apiClient.delete(`/users/${props.user._id}`);
      if (!res.success) {
        notifyError(t('settings.editUserDeleteFailed'));
        return;
      }
      notifySuccess(t('settings.usersDeletedSuccess'));
      finish('deleted');
    }
  } catch (err) {
    console.error(err);
    const payload = err?.response?.data || {};
    const code = payload.code || err?.code;
    if (code === 'MUST_DEACTIVATE_BEFORE_DELETE') {
      notifyError(t('settings.userLifecycleMustDeactivate'));
    } else if (code === 'OPEN_RECORDS_REMAIN') {
      await loadSummary();
      deleteNeedsTransfer.value = true;
      stepIndex.value = 0;
      notifyError(t('settings.userLifecycleDeleteBlockedOpen', {
        count: payload?.data?.openTotal || summary.value.openTotal
      }));
    } else if (currentStepId.value === 'deactivate') {
      notifyError(t('settings.userLifecycleDeactivateFailed'));
    } else if (currentStepId.value === 'transfer') {
      notifyError(t('settings.userLifecycleTransferFailed'));
    } else {
      notifyError(t('settings.editUserDeleteFailed'));
    }
  } finally {
    busy.value = false;
  }
}
</script>
