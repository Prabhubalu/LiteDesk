<template>
  <TransitionRoot as="template" :show="true">
    <Dialog class="relative z-50" @close="$emit('close')">
      <TransitionChild
        as="template"
        enter="ease-out duration-200"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-200"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-gray-500/75 dark:bg-black/75" />
      </TransitionChild>

      <div class="fixed inset-0 overflow-hidden">
        <div class="absolute inset-0 overflow-hidden">
          <div class="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
            <TransitionChild
              as="template"
              enter="transform transition ease-in-out duration-300 sm:duration-300"
              enter-from="translate-x-full"
              enter-to="translate-x-0"
              leave="transform transition ease-in-out duration-300 sm:duration-300"
              leave-from="translate-x-0"
              leave-to="translate-x-full"
            >
              <DialogPanel class="pointer-events-auto w-screen max-w-3xl">
                <form @submit.prevent="handleSubmit" class="relative flex h-full flex-col divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800 shadow-xl">
                  <div class="h-0 flex-1 overflow-y-auto">
                    <div class="bg-indigo-700 dark:bg-indigo-800 px-4 py-6 sm:px-6">
                      <div class="flex items-center justify-between">
                        <DialogTitle class="text-base font-semibold text-white">
                          {{ isEditing ? t('process.ruleFormEditHeading') : t('process.ruleFormNewHeading') }}
                        </DialogTitle>
                        <button
                          type="button"
                          class="relative rounded-md text-indigo-200 hover:text-white"
                          @click="$emit('close')"
                        >
                          <XMarkIcon class="size-6" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    <div class="px-4 sm:px-6 py-6 space-y-6">
                      <!-- Validation Error -->
                      <div v-if="validationError" class="rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
                        <p class="text-sm text-red-800 dark:text-red-200">{{ validationError }}</p>
                      </div>

                      <!-- Basic Info -->
                      <section>
                        <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-4">{{ t('process.ruleFormBasicInfo') }}</h3>
                        <div class="space-y-4">
                          <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              {{ t('process.fieldName') }} <span class="text-red-500">*</span>
                            </label>
                            <input
                              v-model="form.name"
                              type="text"
                              required
                              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                              :placeholder="t('process.phRuleName')"
                            />
                          </div>
                          <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              {{ t('process.fieldDescription') }}
                            </label>
                            <textarea
                              v-model="form.description"
                              rows="2"
                              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                              :placeholder="t('process.phRuleDescription')"
                            />
                          </div>
                          <div class="grid grid-cols-2 gap-4">
                            <div>
                              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {{ t('process.fieldApp') }} <span class="text-red-500">*</span>
                              </label>
                              <select
                                v-model="form.appKey"
                                required
                                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                              >
                                <option value="SALES">{{ t('process.appKeySales') }}</option>
                                <option value="AUDIT">{{ t('process.appKeyAudit') }}</option>
                                <option value="PORTAL">{{ t('process.appKeyPortal') }}</option>
                              </select>
                            </div>
                            <div>
                              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {{ t('process.fieldEntityType') }}
                              </label>
                              <select
                                v-model="form.entityType"
                                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                              >
                                <option value="">{{ t('process.entityAny') }}</option>
                                <option value="people">{{ t('process.entityPeople') }}</option>
                                <option value="organization">{{ t('process.entityOrganization') }}</option>
                                <option value="deal">{{ t('process.entityDeal') }}</option>
                                <option value="events">{{ t('process.entityEvents') }}</option>
                              </select>
                            </div>
                          </div>
                          <div>
                            <label class="flex items-center gap-2">
                              <HeadlessCheckbox
                                v-model="form.enabled"
                                checkbox-class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                              />
                              <span class="text-sm text-gray-700 dark:text-gray-300">{{ t('process.ruleFormEnabled') }}</span>
                            </label>
                            <label class="flex items-start gap-2 mt-3">
                              <HeadlessCheckbox
                                v-model="form.respectBusinessHours"
                                checkbox-class="mt-0.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                              />
                              <span class="text-sm text-gray-700 dark:text-gray-300">
                                {{ t('process.ruleFormRespectHours') }}
                                <span class="block text-xs text-gray-500 dark:text-gray-400 font-normal">
                                  {{ t('process.ruleFormRespectHoursHint') }}
                                </span>
                              </span>
                            </label>
                          </div>
                        </div>
                      </section>

                      <section
                        v-if="!isEditing"
                        class="rounded-xl border border-indigo-200/80 bg-indigo-50/60 p-4 dark:border-indigo-800/60 dark:bg-indigo-950/30"
                      >
                        <h3 class="text-sm font-semibold text-indigo-900 dark:text-indigo-200">
                          {{ t('process.ruleFormApptQuickStart') }}
                        </h3>
                        <p class="mt-1 text-xs text-indigo-800/80 dark:text-indigo-300/80">
                          {{ t('process.ruleFormApptQuickStartHint') }}
                        </p>
                        <div class="mt-3 flex flex-wrap gap-2">
                          <button
                            v-for="tpl in appointmentTemplates"
                            :key="tpl.id"
                            type="button"
                            class="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 shadow-sm ring-1 ring-indigo-200 hover:bg-indigo-50 dark:bg-gray-900 dark:text-indigo-300 dark:ring-indigo-800 dark:hover:bg-indigo-950/50"
                            @click="applyTemplate(tpl)"
                          >
                            {{ tpl.label }}
                          </button>
                        </div>
                      </section>

                      <!-- Trigger -->
                      <section class="border-t border-gray-200 dark:border-gray-700 pt-6">
                        <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-4">{{ t('process.ruleFormTrigger') }}</h3>
                        <div class="space-y-4">
                          <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              {{ t('process.fieldEventType') }} <span class="text-red-500">*</span>
                            </label>
                            <select
                              v-model="form.trigger.eventType"
                              required
                              @change="onEventTypeChange"
                              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            >
                              <option value="">{{ t('process.phSelectEvent') }}</option>
                              <optgroup
                                v-for="group in eventTypeGroups"
                                :key="group.key"
                                :label="group.label"
                              >
                                <option v-for="et in group.items" :key="et.value" :value="et.value">
                                  {{ et.label }}
                                </option>
                              </optgroup>
                            </select>
                            <p
                              v-if="selectedEventMeta?.category === 'appointments'"
                              class="mt-1.5 text-xs text-gray-500 dark:text-gray-400"
                            >
                              {{ t('process.ruleFormApptEntityHint', { entityType: t('process.entityEvents') }) }}
                            </p>
                          </div>
                          <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              {{ t('process.fieldConditionOptional') }}
                            </label>
                            <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
                              {{ t('process.ruleFormConditionHint') }}
                            </p>
                            <div class="space-y-2">
                              <div
                                v-for="(cond, idx) in conditionEntries"
                                :key="idx"
                                class="flex items-center gap-2"
                              >
                                <select
                                  v-model="cond.key"
                                  class="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                >
                                  <option value="">{{ t('process.phSelectField') }}</option>
                                  <option
                                    v-for="field in availableConditionFields"
                                    :key="field.value"
                                    :value="field.value"
                                  >
                                    {{ field.label }}
                                  </option>
                                </select>
                                <span class="text-gray-500">=</span>
                                <input
                                  v-model="cond.value"
                                  type="text"
                                  :placeholder="t('process.phConditionValue')"
                                  class="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                />
                                <button
                                  type="button"
                                  @click="removeCondition(idx)"
                                  class="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                >
                                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                              <button
                                type="button"
                                @click="addCondition"
                                class="text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                              >
                                {{ t('process.ruleFormAddCondition') }}
                              </button>
                            </div>
                          </div>
                        </div>
                      </section>

                      <!-- Action -->
                      <section class="border-t border-gray-200 dark:border-gray-700 pt-6">
                        <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-4">{{ t('process.ruleFormActionSection') }}</h3>
                        <div class="space-y-4">
                          <div>
                            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              {{ t('process.fieldActionType') }} <span class="text-red-500">*</span>
                            </label>
                            <select
                              v-model="form.action.type"
                              required
                              @change="onActionTypeChange"
                              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            >
                              <option value="">{{ t('process.phSelectAction') }}</option>
                              <option value="create_task">{{ t('process.actionCreateTask') }}</option>
                              <option value="notify_user">{{ t('process.actionNotifyUser') }}</option>
                            </select>
                          </div>

                          <!-- create_task params -->
                          <div v-if="form.action.type === 'create_task'" class="space-y-4 pl-4 border-l-2 border-indigo-200 dark:border-indigo-800">
                            <div>
                              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {{ t('process.fieldTaskTitle') }} <span class="text-red-500">*</span>
                              </label>
                              <input
                                v-model="form.action.params.title"
                                type="text"
                                required
                                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                :placeholder="t('process.phTaskTitle')"
                              />
                            </div>
                            <div>
                              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {{ t('process.fieldDescription') }}
                              </label>
                              <textarea
                                v-model="form.action.params.description"
                                rows="2"
                                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                              />
                            </div>
                            <div class="grid grid-cols-2 gap-4">
                              <div>
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  {{ t('process.fieldDueInDays') }}
                                </label>
                                <input
                                  v-model.number="form.action.params.dueInDays"
                                  type="number"
                                  min="0"
                                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                />
                              </div>
                              <div>
                                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  {{ t('process.fieldAssignTo') }}
                                </label>
                                <select
                                  v-model="form.action.params.assignee"
                                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                >
                                  <option value="triggeredBy">{{ t('process.assigneeTriggeredBy') }}</option>
                                  <option value="owner">{{ t('process.assigneeOwner') }}</option>
                                </select>
                              </div>
                            </div>
                            <div>
                              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {{ t('process.fieldRelatedEntity') }}
                              </label>
                              <div class="grid grid-cols-2 gap-4">
                                <select
                                  v-model="form.action.params.relatedEntity.entityType"
                                  class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                >
                                  <option value="">{{ t('process.entityNone') }}</option>
                                  <option value="people">{{ t('process.entityPeople') }}</option>
                                  <option value="organization">{{ t('process.entityOrganization') }}</option>
                                  <option value="deal">{{ t('process.entityDeal') }}</option>
                                  <option value="events">{{ t('process.entityEventAppointment') }}</option>
                                </select>
                                <input
                                  v-model="form.action.params.relatedEntity.entityId"
                                  type="text"
                                  :placeholder="t('process.phRelatedEntityId')"
                                  class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                />
                              </div>
                              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {{ t('process.ruleFormRelatedTriggerHint') }}
                              </p>
                            </div>
                          </div>

                          <!-- notify_user params -->
                          <div v-if="form.action.type === 'notify_user'" class="space-y-4 pl-4 border-l-2 border-indigo-200 dark:border-indigo-800">
                            <div>
                              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {{ t('process.fieldMessage') }} <span class="text-red-500">*</span>
                              </label>
                              <textarea
                                v-model="form.action.params.message"
                                required
                                rows="3"
                                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                :placeholder="t('process.phNotifyMessageShort')"
                              />
                            </div>
                            <div>
                              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {{ t('process.fieldRecipient') }}
                              </label>
                              <select
                                v-model="form.action.params.recipient"
                                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                              >
                                <option value="triggeredBy">{{ t('process.assigneeTriggeredBy') }}</option>
                                <option value="owner">{{ t('process.assigneeOwner') }}</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      </section>
                    </div>
                  </div>
                  <div class="flex shrink-0 justify-end gap-3 px-4 py-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                    <button
                      type="button"
                      class="rounded-md bg-white dark:bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white shadow-xs ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                      @click="$emit('close')"
                    >
                      {{ t('actions.cancel') }}
                    </button>
                    <button
                      type="button"
                      @click="previewRule"
                      class="rounded-md bg-white dark:bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 shadow-xs ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      {{ t('process.ruleFormPreview') }}
                    </button>
                    <button
                      type="submit"
                      :disabled="saving"
                      class="inline-flex justify-center rounded-md bg-indigo-600 dark:bg-indigo-500 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 dark:hover:bg-indigo-600 disabled:opacity-50"
                    >
                      {{ saving ? t('states.saving') : (isEditing ? t('actions.update') : t('actions.create')) }}
                    </button>
                  </div>
                </form>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup>
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import { ref, computed, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';

const { t } = useI18n();

const props = defineProps({
  rule: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['close', 'saved']);

const isEditing = computed(() => !!props.rule);
const saving = ref(false);
const validationError = ref(null);
const eventTypes = ref([]);

const DEFAULT_CONDITION_FIELDS = [
  { value: 'currentState.sales_type', label: 'Current SALES role' },
  { value: 'previousState.sales_type', label: 'Previous SALES role' },
  { value: 'currentState.stage', label: 'Current stage' },
  { value: 'currentState.pipeline', label: 'Current pipeline' },
  { value: 'previousState.stage', label: 'Previous stage' }
];

const eventTypeGroups = computed(() => {
  const byCategory = new Map();
  for (const et of eventTypes.value) {
    const key = et.category || 'other';
    if (!byCategory.has(key)) {
      byCategory.set(key, {
        key,
        label: et.categoryLabel || key,
        items: []
      });
    }
    byCategory.get(key).items.push(et);
  }
  const order = ['appointments', 'crm', 'other'];
  return [...byCategory.values()].sort(
    (a, b) => order.indexOf(a.key) - order.indexOf(b.key)
  );
});

const selectedEventMeta = computed(() =>
  eventTypes.value.find((et) => et.value === form.value.trigger.eventType)
);

const availableConditionFields = computed(() => {
  const fields = selectedEventMeta.value?.conditionFields;
  if (fields?.length) return fields;
  return DEFAULT_CONDITION_FIELDS;
});

const form = ref({
  name: '',
  description: '',
  appKey: 'SALES',
  entityType: '',
  enabled: true,
  respectBusinessHours: false,
  trigger: {
    eventType: '',
    condition: null
  },
  action: {
    type: '',
    params: {}
  }
});

const conditionEntries = ref([]);

const appointmentTemplates = computed(() => [
  {
    id: 'booked-notify',
    label: t('process.tplNotifyBooked'),
    patch: {
      name: 'Notify host on new booking',
      entityType: 'events',
      trigger: { eventType: 'appointment.created', condition: null },
      action: {
        type: 'notify_user',
        params: {
          message: 'A new appointment was booked on your calendar.',
          recipient: 'owner'
        }
      }
    }
  },
  {
    id: 'noshow-task',
    label: t('process.tplTaskNoShow'),
    patch: {
      name: 'Follow up after no-show',
      entityType: 'events',
      trigger: { eventType: 'appointment.no_show', condition: null },
      action: {
        type: 'create_task',
        params: {
          title: 'Follow up: appointment no-show',
          description: 'Contact the guest and reschedule if needed.',
          dueInDays: 1,
          assignee: 'owner',
          relatedEntity: { entityType: 'events', entityId: '__trigger__' }
        }
      }
    }
  },
  {
    id: 'cancelled-notify',
    label: t('process.tplNotifyCancelled'),
    patch: {
      name: 'Notify host on cancellation',
      entityType: 'events',
      trigger: { eventType: 'appointment.cancelled', condition: null },
      action: {
        type: 'notify_user',
        params: {
          message: 'An appointment was cancelled.',
          recipient: 'owner'
        }
      }
    }
  }
]);

function applyTemplate(tpl) {
  const { patch } = tpl;
  form.value.name = patch.name;
  form.value.entityType = patch.entityType;
  form.value.trigger = { ...patch.trigger };
  form.value.action = {
    type: patch.action.type,
    params: JSON.parse(JSON.stringify(patch.action.params))
  };
  conditionEntries.value = [];
  onEventTypeChange();
}

function addCondition() {
  conditionEntries.value.push({ key: '', value: '' });
}

function removeCondition(idx) {
  conditionEntries.value.splice(idx, 1);
}

function onEventTypeChange() {
  conditionEntries.value = [];
  const meta = selectedEventMeta.value;
  if (meta?.suggestedEntityType) {
    form.value.entityType = meta.suggestedEntityType;
  }
  if (
    form.value.action.type === 'create_task' &&
    meta?.suggestedEntityType === 'events'
  ) {
    form.value.action.params.relatedEntity = form.value.action.params.relatedEntity || {};
    form.value.action.params.relatedEntity.entityType = 'events';
    form.value.action.params.relatedEntity.entityId = '__trigger__';
  }
}

function onActionTypeChange() {
  // Reset params when action type changes
  if (form.value.action.type === 'create_task') {
    form.value.action.params = {
      title: '',
      description: '',
      dueInDays: null,
      assignee: 'triggeredBy',
      relatedEntity: { entityType: '', entityId: '' }
    };
  } else if (form.value.action.type === 'notify_user') {
    form.value.action.params = {
      message: '',
      recipient: 'triggeredBy'
    };
  }
}

function buildCondition() {
  if (conditionEntries.value.length === 0) return null;
  const cond = {};
  for (const entry of conditionEntries.value) {
    if (entry.key && entry.value) {
      cond[entry.key] = entry.value;
    }
  }
  return Object.keys(cond).length > 0 ? cond : null;
}

function buildFormData() {
  return {
    ...form.value,
    trigger: {
      eventType: form.value.trigger.eventType,
      condition: buildCondition()
    }
  };
}

async function previewRule() {
  const data = buildFormData();
  try {
    const res = await apiClient.post('/admin/automation-rules/preview', { rule: data });
    alert(t('process.ruleFormPreviewAlert', { count: res.data.data.plan.length }));
    // Could emit preview event to show in a modal
  } catch (err) {
    validationError.value = err.response?.data?.message || t('process.ruleFormPreviewFailed');
  }
}

async function handleSubmit() {
  validationError.value = null;
  saving.value = true;
  try {
    const data = buildFormData();
    if (isEditing.value) {
      await apiClient.put(`/admin/automation-rules/${props.rule._id}`, data);
    } else {
      await apiClient.post('/admin/automation-rules', data);
    }
    emit('saved');
  } catch (err) {
    validationError.value = err.response?.data?.message || t('process.ruleFormSaveFailed');
  } finally {
    saving.value = false;
  }
}

async function loadEventTypes() {
  try {
    const res = await apiClient.get('/admin/automation-rules/metadata/event-types');
    eventTypes.value = res.data.data || [];
  } catch (err) {
    console.error('Failed to load event types:', err);
  }
}

function initializeForm() {
  if (props.rule) {
    form.value = {
      name: props.rule.name || '',
      description: props.rule.description || '',
      appKey: props.rule.appKey || 'SALES',
      entityType: props.rule.entityType || '',
      enabled: props.rule.enabled !== false,
      respectBusinessHours: Boolean(props.rule.respectBusinessHours),
      trigger: {
        eventType: props.rule.trigger?.eventType || '',
        condition: props.rule.trigger?.condition || null
      },
      action: {
        type: props.rule.action?.type || '',
        params: props.rule.action?.params || {}
      }
    };
    // Parse condition into entries
    if (form.value.trigger.condition) {
      conditionEntries.value = Object.entries(form.value.trigger.condition).map(([key, value]) => ({
        key,
        value: String(value)
      }));
    }
    // Initialize action params if needed
    if (form.value.action.type === 'create_task' && !form.value.action.params.title) {
      form.value.action.params = {
        title: '',
        description: '',
        dueInDays: null,
        assignee: 'triggeredBy',
        relatedEntity: { entityType: '', entityId: '' }
      };
    } else if (form.value.action.type === 'notify_user' && !form.value.action.params.message) {
      form.value.action.params = {
        message: '',
        recipient: 'triggeredBy'
      };
    }
  } else {
    onActionTypeChange(); // Initialize empty params
  }
}

onMounted(() => {
  loadEventTypes();
  initializeForm();
});

watch(() => props.rule, initializeForm, { immediate: true });
</script>
