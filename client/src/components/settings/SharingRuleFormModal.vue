<template>
  <TransitionRoot as="template" :show="open">
    <Dialog class="relative z-50" @close="requestClose">
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

      <div class="fixed inset-0 z-10 overflow-y-auto">
        <div class="flex min-h-full items-end justify-center p-4 sm:items-center">
          <TransitionChild
            as="template"
            enter="ease-out duration-200"
            enter-from="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            enter-to="opacity-100 translate-y-0 sm:scale-100"
            leave="ease-in duration-150"
            leave-from="opacity-100 translate-y-0 sm:scale-100"
            leave-to="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
          >
            <DialogPanel class="relative w-full max-w-lg rounded-xl bg-white dark:bg-gray-800 shadow-xl">
              <form @submit.prevent="handleSubmit">
                <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
                  <DialogTitle class="text-base font-semibold text-gray-900 dark:text-white">
                    {{ isEditing ? t('settings.sharingRuleEdit') : t('settings.sharingRuleAdd') }}
                  </DialogTitle>
                  <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {{ contextLabel || `${appKey} · ${moduleKey}` }}
                  </p>
                </div>

                <div class="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
                  <div class="space-y-1">
                    <label class="block text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.sharingRuleName') }}</label>
                    <input
                      v-model="form.name"
                      type="text"
                      required
                      class="block w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 px-3 py-2 text-sm text-gray-900 dark:text-white"
                    />
                  </div>

                  <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-3">
                    <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{{ t('settings.sharingRuleSource') }}</p>
                    <HeadlessSelect v-model="form.source.type" :options="sourceTypeOptions" />
                    <HeadlessSelect
                      v-if="form.source.type === 'role' || form.source.type === 'role_subtree'"
                      v-model="form.source.roleId"
                      :options="roleOptions"
                      :placeholder="t('settings.sharingRuleSelectRole')"
                    />
                    <HeadlessSelect
                      v-if="form.source.type === 'group'"
                      v-model="form.source.groupId"
                      :options="groupOptions"
                      :placeholder="t('settings.sharingRuleSelectGroup')"
                    />
                  </div>

                  <div class="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-3">
                    <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">{{ t('settings.sharingRuleTarget') }}</p>
                    <HeadlessSelect v-model="form.target.type" :options="targetTypeOptions" />
                    <HeadlessSelect
                      v-if="form.target.type === 'role' || form.target.type === 'role_subtree'"
                      v-model="form.target.roleId"
                      :options="roleOptions"
                      :placeholder="t('settings.sharingRuleSelectRole')"
                    />
                    <HeadlessSelect
                      v-if="form.target.type === 'group'"
                      v-model="form.target.groupId"
                      :options="groupOptions"
                      :placeholder="t('settings.sharingRuleSelectGroup')"
                    />
                  </div>

                  <div class="grid grid-cols-2 gap-3">
                    <div class="space-y-1">
                      <label class="block text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.sharingRulePrivilege') }}</label>
                      <HeadlessSelect v-model="form.privilege" :options="privilegeOptions" />
                    </div>
                    <div class="space-y-1">
                      <label class="block text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.sharingRulePriority') }}</label>
                      <input
                        v-model.number="form.priority"
                        type="number"
                        min="1"
                        class="block w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <HeadlessCheckbox v-model="form.enabled" />
                    {{ t('settings.sharingRuleEnabled') }}
                  </label>

                  <p v-if="error" class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
                </div>

                <div class="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
                  <button type="button" class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300" @click="requestClose">
                    {{ t('actions.cancel') }}
                  </button>
                  <button
                    type="submit"
                    :disabled="saving"
                    class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {{ saving ? t('states.saving') : t('actions.save') }}
                  </button>
                </div>
              </form>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import apiClient from '@/utils/apiClient';

const props = defineProps({
  open: Boolean,
  rule: { type: Object, default: null },
  appKey: { type: String, required: true },
  moduleKey: { type: String, required: true },
  contextLabel: { type: String, default: '' },
  roles: { type: Array, default: () => [] },
  groups: { type: Array, default: () => [] },
  sourceTypes: { type: Array, default: () => ['role', 'role_subtree', 'group', 'user'] },
  targetTypes: { type: Array, default: () => ['role', 'role_subtree', 'group', 'user', 'all_internal'] },
  privileges: { type: Array, default: () => ['read', 'read_write'] }
});

const emit = defineEmits(['close', 'saved']);

const { t } = useI18n();

const form = ref(createEmptyForm());
const saving = ref(false);
const error = ref('');

const isEditing = computed(() => Boolean(props.rule?._id));

const roleOptions = computed(() =>
  props.roles.map((r) => ({ value: r._id, label: r.name }))
);

const groupOptions = computed(() =>
  props.groups.map((g) => ({ value: g._id, label: g.name }))
);

const sourceTypeOptions = computed(() =>
  props.sourceTypes.map((type) => ({
    value: type,
    label: t(`settings.sharingParty_${type}`)
  }))
);

const targetTypeOptions = computed(() =>
  props.targetTypes.map((type) => ({
    value: type,
    label: t(`settings.sharingParty_${type}`)
  }))
);

const privilegeOptions = computed(() =>
  props.privileges.map((p) => ({
    value: p,
    label: t(`settings.sharingPrivilege_${p}`)
  }))
);

function createEmptyForm() {
  return {
    name: '',
    priority: 100,
    enabled: true,
    privilege: 'read',
    source: { type: 'role', roleId: '', groupId: '', userId: '' },
    target: { type: 'group', roleId: '', groupId: '', userId: '' }
  };
}

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;
    error.value = '';
    if (props.rule) {
      form.value = {
        name: props.rule.name || '',
        priority: props.rule.priority ?? 100,
        enabled: props.rule.enabled !== false,
        privilege: props.rule.privilege || 'read',
        source: { ...createEmptyForm().source, ...props.rule.source },
        target: { ...createEmptyForm().target, ...props.rule.target }
      };
    } else {
      form.value = createEmptyForm();
    }
  }
);

const requestClose = () => {
  if (!saving.value) emit('close');
};

const handleSubmit = async () => {
  saving.value = true;
  error.value = '';
  try {
    const payload = {
      name: form.value.name.trim(),
      appKey: props.appKey,
      moduleKey: props.moduleKey,
      priority: form.value.priority,
      enabled: form.value.enabled,
      privilege: form.value.privilege,
      source: { ...form.value.source },
      target: { ...form.value.target }
    };

    const response = isEditing.value
      ? await apiClient.put(`/sharing/rules/${props.rule._id}`, payload)
      : await apiClient.post('/sharing/rules', payload);

    if (response.success) {
      emit('saved');
      emit('close');
    } else {
      error.value = response.message || t('settings.sharingRuleSaveFailed');
    }
  } catch (err) {
    error.value = err.message || t('settings.sharingRuleSaveFailed');
  } finally {
    saving.value = false;
  }
};
</script>
