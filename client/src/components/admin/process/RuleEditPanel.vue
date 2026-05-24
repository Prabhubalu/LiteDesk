<template>
  <TransitionRoot as="template" :show="!!rule">
    <Dialog class="relative z-60" @close="$emit('close')">
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
          <div class="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
            <TransitionChild
              as="template"
              enter="transform transition ease-in-out duration-300"
              enter-from="translate-x-full"
              enter-to="translate-x-0"
              leave="transform transition ease-in-out duration-300"
              leave-from="translate-x-0"
              leave-to="translate-x-full"
            >
              <DialogPanel class="pointer-events-auto w-screen max-w-md">
                <div class="flex h-full flex-col bg-white dark:bg-gray-800 shadow-xl">
                  <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <div class="flex items-center justify-between">
                      <DialogTitle class="text-lg font-semibold text-gray-900 dark:text-white">
                        {{ t('process.rulePanelEditHeading') }}
                      </DialogTitle>
                      <button
                        type="button"
                        class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        @click="$emit('close')"
                      >
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div class="flex-1 overflow-y-auto p-6">
                    <div v-if="rule.nodeType === 'field_rule'" class="space-y-4">
                      <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {{ t('process.fieldField') }} <span class="text-red-500">*</span>
                        </label>
                        <input
                          v-model="ruleData.fieldKey"
                          type="text"
                          :placeholder="t('process.phApproval')"
                          class="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                        />
                      </div>
                      <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {{ t('process.fieldRuleType') }} <span class="text-red-500">*</span>
                        </label>
                        <select
                          v-model="ruleData.rule"
                          class="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                        >
                          <option value="mandatory">{{ t('process.fieldRuleMandatory') }}</option>
                          <option value="default">{{ t('process.fieldRuleDefault') }}</option>
                          <option value="visibility">{{ t('process.fieldRuleVisibility') }}</option>
                        </select>
                      </div>
                      <div v-if="ruleData.rule === 'default'">
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {{ t('process.fieldDefaultValue') }}
                        </label>
                        <input
                          v-model="ruleData.value"
                          type="text"
                          :placeholder="t('process.phDefaultValue')"
                          class="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                        />
                      </div>
                      <div v-if="ruleData.rule === 'visibility'">
                        <label class="flex items-center">
                          <HeadlessCheckbox
                            v-model="ruleData.value"
                            checkbox-class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">{{ t('process.fieldShowField') }}</span>
                        </label>
                      </div>
                      <div v-if="ruleData.rule === 'mandatory'" class="text-xs text-gray-500 dark:text-gray-400 italic p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                        {{ t('process.wizardFieldMandatoryHint') }}
                      </div>
                    </div>

                    <div v-else-if="rule.nodeType === 'ownership_rule'" class="space-y-4">
                      <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {{ t('process.fieldAssignmentType') }} <span class="text-red-500">*</span>
                        </label>
                        <select
                          v-model="ruleData.assignment"
                          class="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                        >
                          <option value="owner">{{ t('process.ownershipSpecificUser') }}</option>
                          <option value="role">{{ t('process.ownershipRole') }}</option>
                          <option value="rule">{{ t('process.ownershipRuleBased') }}</option>
                        </select>
                      </div>
                      <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {{ t('process.fieldTarget') }} <span class="text-red-500">*</span>
                        </label>
                        <input
                          v-model="ruleData.target"
                          type="text"
                          :placeholder="t('process.phOwnershipTarget')"
                          class="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                        />
                      </div>
                      <div class="text-xs text-gray-500 dark:text-gray-400 italic p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                        {{ t('process.wizardOwnershipHint') }}
                      </div>
                    </div>

                    <div v-else-if="rule.nodeType === 'status_guard'" class="space-y-4">
                      <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {{ t('process.fieldField') }} <span class="text-red-500">*</span>
                        </label>
                        <select
                          v-model="ruleData.field"
                          class="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                        >
                          <option value="status">{{ t('process.statusFieldStatus') }}</option>
                          <option value="lifecycle">{{ t('process.statusFieldLifecycle') }}</option>
                          <option value="stage">{{ t('process.statusFieldStage') }}</option>
                        </select>
                      </div>
                      <div class="grid grid-cols-2 gap-3">
                        <div>
                          <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {{ t('process.fieldFrom') }}
                          </label>
                          <input
                            v-model="ruleData.from"
                            type="text"
                            :placeholder="t('process.phStatusFrom')"
                            class="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                          />
                        </div>
                        <div>
                          <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {{ t('process.fieldTo') }}
                          </label>
                          <input
                            v-model="ruleData.to"
                            type="text"
                            :placeholder="t('process.phStatusTo')"
                            class="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                          />
                        </div>
                      </div>
                      <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {{ t('process.fieldBlockReason') }}
                        </label>
                        <input
                          v-model="ruleData.blockReason"
                          type="text"
                          :placeholder="t('process.phBlockReason')"
                          class="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                        />
                      </div>
                    </div>

                    <div v-else-if="rule.nodeType === 'action'" class="space-y-4">
                      <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {{ t('process.fieldActionType') }} <span class="text-red-500">*</span>
                        </label>
                        <select
                          v-model="ruleData.actionType"
                          class="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                        >
                          <option value="">{{ t('process.phSelectAction') }}</option>
                          <option value="create_task">{{ t('process.actionCreateTask') }}</option>
                          <option value="notify_user">{{ t('process.actionNotifyUser') }}</option>
                          <option value="start_process">{{ t('process.actionStartProcess') }}</option>
                        </select>
                      </div>

                      <div v-if="ruleData.actionType === 'create_task'" class="space-y-3">
                        <div>
                          <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {{ t('process.fieldTaskTitle') }} <span class="text-red-500">*</span>
                          </label>
                          <input
                            v-model="ruleData.params.title"
                            type="text"
                            :placeholder="t('process.phTaskTitle')"
                            class="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                          />
                        </div>
                        <div>
                          <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {{ t('process.fieldDescription') }}
                          </label>
                          <textarea
                            v-model="ruleData.params.description"
                            rows="2"
                            :placeholder="t('process.phTaskDescription')"
                            class="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                          ></textarea>
                        </div>
                        <div>
                          <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {{ t('process.fieldAssignTo') }}
                          </label>
                          <select
                            v-model="ruleData.params.assignee"
                            class="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                          >
                            <option value="owner">{{ t('process.assigneeOwnerTitle') }}</option>
                            <option value="triggeredBy">{{ t('process.assigneeTriggeredByTitle') }}</option>
                          </select>
                        </div>
                      </div>

                      <div v-if="ruleData.actionType === 'notify_user'" class="space-y-3">
                        <div>
                          <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {{ t('process.fieldMessage') }} <span class="text-red-500">*</span>
                          </label>
                          <textarea
                            v-model="ruleData.params.message"
                            rows="3"
                            :placeholder="t('process.phNotifyMessage')"
                            class="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                          ></textarea>
                        </div>
                        <div>
                          <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {{ t('process.fieldRecipient') }}
                          </label>
                          <select
                            v-model="ruleData.params.recipient"
                            class="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                          >
                            <option value="owner">{{ t('process.assigneeOwnerTitle') }}</option>
                            <option value="triggeredBy">{{ t('process.assigneeTriggeredByTitle') }}</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      @click="$emit('close')"
                    >
                      {{ t('actions.cancel') }}
                    </button>
                    <button
                      type="button"
                      class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                      @click="saveRule"
                    >
                      {{ t('actions.save') }}
                    </button>
                  </div>
                </div>
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
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue';

const { t } = useI18n();

const props = defineProps({
  rule: {
    type: Object,
    default: null
  },
  process: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['close', 'save']);

const ruleData = ref({});

watch(() => props.rule, (newRule) => {
  if (newRule && newRule.node) {
    const config = newRule.node.config || {};

    if (newRule.nodeType === 'field_rule') {
      ruleData.value = {
        fieldKey: config.fieldKey || '',
        rule: config.rule || 'mandatory',
        value: config.value || ''
      };
    } else if (newRule.nodeType === 'ownership_rule') {
      ruleData.value = {
        assignment: config.assignment || 'owner',
        target: config.target || ''
      };
    } else if (newRule.nodeType === 'status_guard') {
      const transition = config.allowedTransitions?.[0] || '';
      const [from, to] = transition.includes('→') ? transition.split('→').map((s) => s.trim()) : ['', ''];
      ruleData.value = {
        field: config.field || 'stage',
        from,
        to,
        blockReason: config.blockReason || ''
      };
    } else if (newRule.nodeType === 'action') {
      ruleData.value = {
        actionType: config.actionType || '',
        params: { ...config.params }
      };
    }
  }
}, { immediate: true });

const saveRule = () => {
  const updatedNode = { ...props.rule.node };

  const getEntityType = () => {
    const fieldRuleNode = props.process.nodes?.find((n) => n.type === 'field_rule');
    if (fieldRuleNode?.config?.entityType) return fieldRuleNode.config.entityType;
    const ownershipNode = props.process.nodes?.find((n) => n.type === 'ownership_rule');
    if (ownershipNode?.config?.entityType) return ownershipNode.config.entityType;
    const statusGuardNode = props.process.nodes?.find((n) => n.type === 'status_guard');
    if (statusGuardNode?.config?.entityType) return statusGuardNode.config.entityType;
    return 'deal';
  };

  const entityType = getEntityType();

  if (props.rule.nodeType === 'field_rule') {
    updatedNode.config = {
      entityType,
      fieldKey: ruleData.value.fieldKey,
      rule: ruleData.value.rule,
      value: ruleData.value.rule === 'visibility' ? ruleData.value.value : ruleData.value.value || true
    };
  } else if (props.rule.nodeType === 'ownership_rule') {
    updatedNode.config = {
      entityType,
      assignment: ruleData.value.assignment,
      target: ruleData.value.target
    };
  } else if (props.rule.nodeType === 'status_guard') {
    updatedNode.config = {
      entityType,
      field: ruleData.value.field,
      allowedTransitions: [`${ruleData.value.from} → ${ruleData.value.to}`]
    };
    if (ruleData.value.blockReason) {
      updatedNode.config.blockReason = ruleData.value.blockReason;
    }
  } else if (props.rule.nodeType === 'action') {
    updatedNode.config = {
      actionType: ruleData.value.actionType,
      params: { ...ruleData.value.params }
    };
  }

  emit('save', {
    ...props.rule,
    node: updatedNode
  });
};
</script>
