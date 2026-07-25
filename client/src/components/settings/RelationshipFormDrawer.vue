<template>
  <TransitionRoot as="template" :show="open">
    <Dialog class="relative z-50" @close="handleClose">
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
              <div class="pointer-events-auto h-full flex">
                <DialogPanel
                  class="rounded-tl-xl overflow-hidden flex h-full flex-col bg-white dark:bg-gray-800 shadow-xl max-w-[95vw] w-[32rem] transition-[width] duration-200 ease-out"
                >
                  <form @submit.prevent="handleSave" class="rounded-none relative flex h-full flex-col divide-y divide-gray-200 dark:divide-gray-700">
                    <!-- Header -->
                    <div class="border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-6 sm:px-6 flex-shrink-0">
                      <div class="flex items-center justify-between">
                        <DialogTitle class="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
                          {{ isEdit ? t('settings.modFieldsTitleEditRelationship') : t('settings.modFieldsAddRelationship') }}
                        </DialogTitle>
                        <button
                          type="button"
                          class="relative rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 cursor-pointer"
                          @click="handleClose"
                        >
                          <span class="absolute -inset-2.5" />
                          <span class="sr-only">{{ t('common.closePanel') }}</span>
                          <XMarkIcon class="size-6" aria-hidden="true" />
                        </button>
                      </div>
                      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {{ moduleName ? t('settings.settingsRelDrawerSubtitleWithModule', { module: moduleName }) : t('settings.settingsRelDrawerSubtitleDefault') }}
                      </p>
                    </div>

                    <!-- Body -->
                    <div class="h-0 flex-1 overflow-y-auto">
                      <div class="px-4 sm:px-6 py-6 space-y-6">
                        <!-- Target module first (always visible) -->
                        <div class="space-y-4">
                          <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ t('settings.settingsRelDrawerBasics') }}</h4>
                          <div>
                            <label for="rel-target" class="block text-sm font-medium text-gray-900 dark:text-white mb-1.5">{{ t('settings.modFieldsTargetModule') }} <span class="text-red-500">*</span></label>
                            <HeadlessSelect
                              id="rel-target"
                              v-model="draft.targetModuleKey"
                              :options="moduleOptions"
                              :placeholder="t('settings.modFieldsSelectModulePh')"
                              allow-empty
                              :empty-label="t('settings.modFieldsSelectModulePh')"
                            />
                            <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.settingsRelDrawerTargetHint') }}</p>
                          </div>
                        </div>

                        <!-- Rest of config only after target is selected -->
                        <template v-if="draft.targetModuleKey">
                          <!-- Relationship type -->
                          <div class="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-6">
                            <div>
                              <label for="rel-type" class="block text-sm font-medium text-gray-900 dark:text-white mb-1.5">{{ t('settings.settingsRelDrawerRelationshipType') }} <span class="text-red-500">*</span></label>
                              <HeadlessSelect
                                id="rel-type"
                                v-model="draft.type"
                                :options="relationshipTypeOptions"
                              />
                            </div>
                            <div>
                              <label for="rel-name" class="block text-sm font-medium text-gray-900 dark:text-white mb-1.5">{{ t('settings.settingsRelDrawerRelationshipName') }} <span class="text-red-500">*</span></label>
                              <input
                                id="rel-name"
                                v-model="draft.name"
                                type="text"
                                :placeholder="t('settings.settingsRelDrawerRelationshipNamePh')"
                                class="block w-full rounded-lg bg-gray-50 dark:bg-gray-700/50 px-3 py-2 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-600 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                              />
                            </div>
                            <div>
                              <label for="rel-label" class="block text-sm font-medium text-gray-900 dark:text-white mb-1.5">{{ t('settings.settingsRelDrawerDisplayLabel') }}</label>
                              <input
                                id="rel-label"
                                v-model="draft.label"
                                type="text"
                                :placeholder="t('settings.settingsRelDrawerDisplayLabelPh')"
                                class="block w-full rounded-lg bg-gray-50 dark:bg-gray-700/50 px-3 py-2 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-600 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>
                          </div>

                          <!-- Advanced: Field mapping (collapsible, collapsed by default) -->
                          <div class="border-t border-gray-200 dark:border-gray-700 pt-6">
                            <button
                              type="button"
                              @click="advancedOpen = !advancedOpen"
                              class="flex items-center justify-between w-full text-left py-1 group"
                            >
                              <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider group-hover:text-gray-700 dark:group-hover:text-gray-300">{{ t('settings.settingsRelDrawerAdvanced') }}</h4>
                              <svg
                                :class="['w-4 h-4 text-gray-400 transition-transform', advancedOpen && 'rotate-180']"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                            <div v-show="advancedOpen" class="space-y-4 pt-4">
                              <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.settingsRelDrawerFieldMapping') }}</p>
                              <div class="grid grid-cols-1 gap-4">
                                <div>
                                  <label for="rel-local" class="block text-sm font-medium text-gray-900 dark:text-white mb-1.5">{{ t('settings.settingsRelDrawerLocalField') }} <span class="text-red-500">*</span></label>
                                  <HeadlessSelect
                                    id="rel-local"
                                    v-model="draft.localField"
                                    :options="localFieldOptions"
                                    :placeholder="t('settings.modFieldsSelectFieldPh')"
                                    allow-empty
                                    :empty-label="t('settings.modFieldsSelectFieldPh')"
                                  />
                                </div>
                                <div>
                                  <label for="rel-foreign" class="block text-sm font-medium text-gray-900 dark:text-white mb-1.5">{{ t('settings.settingsRelDrawerForeignField') }} <span class="text-red-500">*</span></label>
                                  <input
                                    id="rel-foreign"
                                    v-model="draft.foreignField"
                                    type="text"
                                    :placeholder="t('settings.settingsRelDrawerForeignFieldPh')"
                                    class="block w-full rounded-lg bg-gray-50 dark:bg-gray-700/50 px-3 py-2 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-600 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          <!-- Options -->
                          <div class="space-y-3 border-t border-gray-200 dark:border-gray-700 pt-6">
                            <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ t('settings.settingsRelDrawerOptions') }}</h4>
                            <div class="grid grid-cols-2 gap-2">
                              <label class="flex items-center gap-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                                <HeadlessCheckbox
                                  v-model="draft.required"
                                  checkbox-class="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('settings.settingsRelDrawerRequired') }}</span>
                              </label>
                              <label class="flex items-center gap-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                                <HeadlessCheckbox
                                  v-model="draft.unique"
                                  checkbox-class="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('settings.settingsRelDrawerUnique') }}</span>
                              </label>
                              <label class="flex items-center gap-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                                <HeadlessCheckbox
                                  v-model="draft.index"
                                  checkbox-class="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('settings.settingsRelDrawerIndex') }}</span>
                              </label>
                              <label class="flex items-center gap-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                                <HeadlessCheckbox
                                  v-model="draft.cascadeDelete"
                                  checkbox-class="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('settings.settingsRelDrawerCascadeDelete') }}</span>
                              </label>
                            </div>
                          </div>
                        </template>

                        <!-- Duplicate relationship error -->
                        <div v-if="duplicateError" class="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                          {{ duplicateError }}
                        </div>
                      </div>
                    </div>

                    <!-- Footer -->
                    <div class="flex shrink-0 flex items-center justify-end gap-3 px-4 py-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                      <button
                        type="button"
                        class="rounded-md px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                        @click="handleClose"
                      >
                        {{ t('actions.cancel') }}
                      </button>
                      <button
                        type="submit"
                        class="rounded-md bg-indigo-600 dark:bg-indigo-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 dark:hover:bg-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 cursor-pointer"
                      >
                        {{ isEdit ? t('settings.saveChanges') : t('settings.modFieldsAddRelationship') }}
                      </button>
                    </div>
                  </form>
                </DialogPanel>
              </div>
            </TransitionChild>
          </div>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';

const { t } = useI18n();

const DEFAULT_RELATIONSHIP = () => ({
  name: '',
  type: 'many_to_one',
  isLookup: true,
  targetModuleKey: '',
  localField: '',
  foreignField: '_id',
  inverseName: '',
  inverseField: '',
  required: false,
  unique: false,
  index: true,
  cascadeDelete: false,
  label: '',
});

const props = defineProps({
  open: { type: Boolean, default: false },
  /** Current module display name (e.g. "Deals") */
  moduleName: { type: String, default: '' },
  /** Current module key (e.g. "deals") for duplicate check */
  currentModuleKey: { type: String, default: '' },
  /** For edit: the relationship object; for create: null */
  relationship: { type: Object, default: null },
  /** For edit: index in the relationships array; for create: null */
  editIndex: { type: Number, default: null },
  /** List of modules for target dropdown */
  modules: { type: Array, default: () => [] },
  /** Existing relationships on the current module (for duplicate check) */
  existingRelationships: { type: Array, default: () => [] },
  /** Fields for local field dropdown */
  editFields: { type: Array, default: () => [] },
});

const emit = defineEmits(['close', 'save']);

const isEdit = computed(() => props.editIndex !== null && props.relationship != null);

const draft = ref({ ...DEFAULT_RELATIONSHIP() });
const advancedOpen = ref(false);
const duplicateError = ref('');

/** Current module label (singular), e.g. "Task" */
const currentLabel = computed(() => {
  const n = (props.moduleName || 'Record').trim();
  return n.endsWith('s') ? n.slice(0, -1) : n;
});

/** Options for target module dropdown */
const moduleOptions = computed(() =>
  (props.modules || []).map((m) => ({ value: m.key, label: m.name }))
);

/** Options for local field dropdown */
const localFieldOptions = computed(() =>
  (props.editFields || []).map((f) => ({ value: f.key, label: `${f.label || f.key} (${f.key})` }))
);

/** Selected target module from list */
const targetModule = computed(() => {
  const key = draft.value.targetModuleKey;
  if (!key || !props.modules?.length) return null;
  return props.modules.find((m) => m.key === key) || null;
});

/** Target module display name (singular), e.g. "Organization" */
const targetModuleName = computed(() => targetModule.value?.name ?? '');

/** Pluralize for contextual labels: "Organization" → "Organizations", "Task" → "Tasks", "Events" → "Events" (already plural). */
function pluralize(name) {
  if (!name || typeof name !== 'string') return '';
  const s = name.trim();
  if (!s) return '';
  const lower = s.toLowerCase();
  if (lower.endsWith('s')) return s;
  if (lower.endsWith('y') && s.length > 1 && !/[aeiou]y$/i.test(s)) return s.slice(0, -1) + 'ies';
  if (lower.endsWith('ch') || lower.endsWith('sh') || lower.endsWith('x')) return s + 'es';
  return s + 's';
}

/** Human-friendly relationship type options. Contextual when target is selected (e.g. Tasks → Deals). Lookup is a UI mode of many_to_one. */
const relationshipTypeOptions = computed(() => {
  const cur = currentLabel.value || 'Record';
  const curPlural = cur.endsWith('s') ? cur : cur + 's';
  const tgt = targetModuleName.value;
  const tgtPlural = tgt ? pluralize(tgt) : '';
  const hasTarget = Boolean(tgt);
  return [
    {
      value: 'lookup',
      label: hasTarget
        ? t('settings.settingsRelDrawerTypeLookupWithTarget', { curPlural, tgt })
        : t('settings.settingsRelDrawerTypeLookup'),
    },
    {
      value: 'many_to_one',
      label: hasTarget
        ? t('settings.settingsRelDrawerTypeManyToOneWithTarget', { curPlural, tgt })
        : t('settings.settingsRelDrawerTypeManyToOne'),
    },
    {
      value: 'one_to_many',
      label: hasTarget
        ? t('settings.settingsRelDrawerTypeOneToManyWithTarget', { cur, tgtPlural })
        : t('settings.settingsRelDrawerTypeOneToMany'),
    },
    {
      value: 'many_to_many',
      label: hasTarget
        ? t('settings.settingsRelDrawerTypeManyToManyWithTarget', { curPlural, tgtPlural })
        : t('settings.settingsRelDrawerTypeManyToMany'),
    },
    {
      value: 'one_to_one',
      label: hasTarget
        ? t('settings.settingsRelDrawerTypeOneToOneWithTarget', { cur, tgt })
        : t('settings.settingsRelDrawerTypeOneToOne'),
    },
  ];
});

function resetDraft() {
  if (props.relationship && typeof props.editIndex === 'number') {
    const raw = JSON.parse(JSON.stringify(props.relationship));
    // Normalize for UI: many_to_one + isLookup (or legacy type "lookup") → show as "lookup" in dropdown
    const isLookupMode = raw.type === 'lookup' || (raw.type === 'many_to_one' && raw.isLookup === true);
    const typeForUi = isLookupMode ? 'lookup' : (raw.type || 'many_to_one');
    draft.value = {
      ...DEFAULT_RELATIONSHIP(),
      ...raw,
      type: typeForUi,
      isLookup: raw.type === 'lookup' || (raw.type === 'many_to_one' && !!raw.isLookup),
    };
  } else {
    draft.value = { ...DEFAULT_RELATIONSHIP() };
  }
  advancedOpen.value = false;
  duplicateError.value = '';
}

watch(
  () => [props.open, props.relationship, props.editIndex],
  () => {
    if (props.open) resetDraft();
  },
  { immediate: true }
);

/** When target module is selected (create only): auto-fill name and display label if empty. Clear duplicate error on change. */
watch(
  () => draft.value.targetModuleKey,
  (key) => {
    duplicateError.value = '';
    if (isEdit.value) return;
    const mod = key && props.modules?.length ? props.modules.find((m) => m.key === key) : null;
    if (!mod?.name) return;
    const targetName = (mod.name || '').trim();
    const targetKey = (mod.key || '').trim();
    if (!draft.value.name) draft.value.name = targetKey || targetName;
    if (!draft.value.label) draft.value.label = pluralize(targetName) || targetName;
  }
);

/** Singular form of module key for localField default (e.g. "deals" → "deal", "events" → "event"). */
function toSingularKey(key) {
  if (!key || typeof key !== 'string') return '';
  const k = key.trim().toLowerCase();
  if (k.endsWith('ies')) return k.slice(0, -3) + 'y';
  if (k.endsWith('ses')) return k.slice(0, -2);
  if (k.endsWith('s') && k.length > 1) return k.slice(0, -1);
  return k;
}

/** When target and type are set (create only): auto-fill Advanced fields if empty; enable Index for many_to_one/lookup only when we auto-fill. */
watch(
  () => [draft.value.targetModuleKey, draft.value.type],
  ([key, type]) => {
    if (isEdit.value) return;
    if (!key || !type) return;
    const mod = props.modules?.length ? props.modules.find((m) => m.key === key) : null;
    const singular = mod?.key ? toSingularKey(mod.key) : '';
    const defaultLocal = singular ? `${singular}Id` : '';
    const didSetLocal = Boolean(defaultLocal && !draft.value.localField);
    if (didSetLocal) draft.value.localField = defaultLocal;
    if (!draft.value.foreignField) draft.value.foreignField = '_id';
    if (didSetLocal && (type === 'many_to_one' || type === 'lookup')) draft.value.index = true;
  }
);

const handleClose = () => emit('close');

/** Normalize target module key for comparison (trim + lowercase) to avoid duplicates like "Deals" vs "deals" vs " deals". */
function normalizeTargetKey(key) {
  return String(key || '').trim().toLowerCase();
}

/** Normalize an existing relationship's type/isLookup for comparison (legacy "lookup" → many_to_one + isLookup true). */
function normalizedTypeAndLookup(rel) {
  const type = rel.type === 'lookup' ? 'many_to_one' : (rel.type || '');
  const isLookup = rel.type === 'lookup' || (rel.type === 'many_to_one' && !!rel.isLookup);
  return { type, isLookup };
}

/**
 * True if another relationship exists with same target, type, and isLookup (create or update).
 *
 * Duplicate rule: we match on (source module, target module, type, isLookup) only.
 * Relationship name is intentionally ignored. So e.g.:
 *   Task → Deal (many_to_many, name: "Related Deals")
 *   Task → Deal (many_to_many, name: "Associated Deals")
 * are considered duplicates and blocked — one semantic relationship per (source, target, type, isLookup).
 * This keeps the rule simple and avoids multiple same-type links between the same modules.
 */
function hasDuplicateTypeRelationship(payload, editIndex) {
  const targetKey = normalizeTargetKey(payload.targetModuleKey);
  if (!targetKey || !props.existingRelationships?.length) return false;
  const wantType = payload.type || '';
  const wantLookup = payload.isLookup === true;
  return props.existingRelationships.some((rel, idx) => {
    if (typeof editIndex === 'number' && idx === editIndex) return false;
    if (normalizeTargetKey(rel.targetModuleKey) !== targetKey) return false;
    const { type, isLookup } = normalizedTypeAndLookup(rel);
    return type === wantType && isLookup === wantLookup;
  });
}

const handleSave = () => {
  duplicateError.value = '';
  const payload = { ...draft.value };
  // Normalize: never persist type "lookup"; store as many_to_one + isLookup true
  if (payload.type === 'lookup') {
    payload.type = 'many_to_one';
    payload.isLookup = true;
  } else {
    payload.isLookup = payload.type === 'many_to_one' ? !!payload.isLookup : false;
  }
  if (hasDuplicateTypeRelationship(payload, props.editIndex)) {
    duplicateError.value = t('settings.settingsRelDrawerDuplicateError');
    return;
  }
  emit('save', { relationship: payload, editIndex: props.editIndex });
};
</script>
