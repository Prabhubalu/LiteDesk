<!--
  ============================================================================
  APP SECTION — Generic app participation UI
  ============================================================================
  
  Renders app-specific UI for any app (SALES, HELPDESK, future apps).
  - Section header: "{AppLabel} Information"
  - Type (required): usePeopleTypes(appKey)
  - Dependent fields: getAppFields(appKey, role)
  
  NO hardcoding: uses usePeopleTypes(appKey) and getAppFields(appKey, role).
  ============================================================================
-->
<template>
  <div class="border-t border-gray-200 dark:border-gray-700 pt-6 mt-6">
    <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-4">
      {{ appSectionTitle }}
    </h3>

    <!-- Type (required): ListboxOption renders as <li> — slot content must NOT be another <li> -->
    <div class="mb-4" data-field-key="participationType">
      <Listbox
        :model-value="modelValue?.participationType ?? null"
        :disabled="loading"
        as="div"
        class="block"
        @update:model-value="onParticipationTypeChange"
      >
        <ListboxLabel class="block text-sm/6 font-medium text-gray-900 dark:text-white mb-1">{{ t('settings.modFieldsValidationType') }}<span class="text-red-500">*</span>
        </ListboxLabel>
        <div class="relative mt-2">
          <ListboxButton
            type="button"
            :disabled="loading"
            :class="[
              'block w-full rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-left text-gray-900 dark:text-white text-base outline-1 -outline-offset-1 outline-gray-300/20 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:focus:bg-gray-800 dark:outline-white/10 dark:focus:outline-indigo-500 cursor-default relative pr-10',
              errors?.participationType
                ? 'ring-2 ring-red-500 dark:ring-red-500'
                : ''
            ]"
          >
            <span
              :class="[
                'block truncate',
                !modelValue?.participationType ? 'text-gray-500 dark:text-gray-400' : ''
              ]"
            >
              {{
                loading
                  ? 'Loading...'
                  : modelValue?.participationType
                    ? modelValue.participationType
                    : 'Select type'
              }}
            </span>
            <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
              <ChevronUpDownIcon class="h-5 w-5 text-gray-400 dark:text-gray-500" aria-hidden="true" />
            </span>
          </ListboxButton>
          <Transition
            enter-active-class="transition duration-100 ease-out"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition duration-100 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <ListboxOptions
              as="ul"
              class="absolute z-[100] mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white dark:bg-gray-700 py-1 text-base shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none sm:text-sm"
            >
              <ListboxOption
                v-for="r in roles"
                :key="r"
                :value="r"
                v-slot="{ active, selected }"
              >
                <div
                  :class="[
                    'relative cursor-default select-none py-2 pl-4 pr-10',
                    active
                      ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100'
                      : 'text-gray-900 dark:text-gray-100'
                  ]"
                >
                  <span :class="[selected ? 'font-medium' : 'font-normal', 'block truncate']">{{ r }}</span>
                  <span
                    v-if="selected"
                    class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-indigo-600 dark:text-indigo-400"
                  >
                    <CheckIcon class="h-5 w-5" aria-hidden="true" />
                  </span>
                </div>
              </ListboxOption>
            </ListboxOptions>
          </Transition>
        </div>
      </Listbox>
      <p v-if="errors?.participationType" class="mt-1 text-sm text-red-600 dark:text-red-400">{{ errors.participationType }}</p>
    </div>

    <!-- Role-dependent fields via getAppFields(appKey, role) -->
    <DynamicForm
      v-if="dependentFields.length > 0 && moduleOverride"
      moduleKey="people"
      :formData="localFormData"
      :errors="errors"
      :quickCreateMode="true"
      :showAllFields="false"
      :fieldsOverride="dependentFields"
      :moduleOverride="moduleOverride"
      context="platform"
      @update:formData="onFieldsUpdate"
    />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { ref, computed, watch, toRef, Transition, type PropType } from 'vue';
import { Listbox, ListboxLabel, ListboxButton, ListboxOptions, ListboxOption } from '@headlessui/vue';
import { ChevronUpDownIcon, CheckIcon } from '@heroicons/vue/24/outline';
import DynamicForm from '@/components/common/DynamicForm.vue';
import { getAppLabel } from '@/utils/getRoleDisplay';
import { usePeopleTypes } from '@/composables/usePeopleTypes';
import { getAppFields } from '@/platform/fields/peopleFieldModel';

/** Quick-create / app participation slice (participation type + dynamic field keys). */
export interface AppSectionModelValue {
  /** Lead / Contact / Customer — API body `role`; must not collide with module field `role` (e.g. SALES contact job role). */
  participationType?: string | null;
  [key: string]: unknown;
}

const props = defineProps({
  appKey: {
    type: String,
    required: true
  },
  modelValue: {
    type: Object as PropType<AppSectionModelValue>,
    required: true,
    default: () => ({ participationType: null as string | null })
  },
  moduleOverride: {
    type: Object as PropType<Record<string, unknown> | null>,
    default: null
  },
  errors: {
    type: Object as PropType<Record<string, string>>,
    default: () => ({})
  }
});

const { t } = useI18n();

const emit = defineEmits<{
  'update:modelValue': [value: AppSectionModelValue];
}>();

const { types: roles, typeDefs: peopleTypeDefs, defaultRole: tenantDefaultRole, loading } = usePeopleTypes(
  toRef(props, 'appKey')
);

// Auto-select tenant default role when types load (explicit default from Settings → People → Types)
watch(
  [roles, tenantDefaultRole, () => props.modelValue?.participationType],
  ([r, dr, currentType]) => {
    const types = r as string[];
    const def = dr as string;
    if (Array.isArray(types) && types.length > 0 && !currentType) {
      const pick =
        def && types.some((t) => t.toLowerCase() === String(def).toLowerCase())
          ? types.find((t) => t.toLowerCase() === String(def).toLowerCase()) || types[0]
          : types[0];
      emit('update:modelValue', { ...props.modelValue, participationType: pick });
    }
  },
  { immediate: true }
);

const appSectionTitle = computed(() =>
  `${getAppLabel(props.appKey)} Information`
);

const dependentFields = computed(() => {
  const pt = props.modelValue?.participationType;
  if (!pt) return [];
  return getAppFields(props.appKey, pt, peopleTypeDefs.value);
});

// Local form data for dependent fields (derived from modelValue)
const localFormData = ref<Record<string, unknown>>({});

// Sync localFormData from modelValue when dependent fields change
watch(
  [() => props.modelValue, dependentFields],
  ([val, fields]) => {
    const m = (val || {}) as AppSectionModelValue;
    const f = (fields || []) as string[];
    const next: Record<string, unknown> = {};
    for (const key of f) {
      next[key] = m[key] ?? '';
    }
    localFormData.value = next;
  },
  { immediate: true }
);

function onParticipationTypeChange(participationType: string | null) {
  emit('update:modelValue', { ...props.modelValue, participationType: participationType || null });
}

function onFieldsUpdate(data: Record<string, unknown>) {
  emit('update:modelValue', { ...props.modelValue, ...data });
}
</script>
