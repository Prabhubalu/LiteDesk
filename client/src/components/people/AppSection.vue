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
  <div :class="rootClass">
    <h3
      v-if="!hideSectionTitle"
      class="text-sm font-semibold text-gray-900 dark:text-white mb-4"
    >
      {{ appSectionTitle }}
    </h3>

    <!-- Type (required) -->
    <div :class="embedded ? 'mb-0' : 'mb-4'" data-field-key="participationType">
      <label class="block text-sm/6 font-medium text-gray-900 dark:text-white mb-1">
        {{ t('settings.modFieldsValidationType') }}<span class="text-red-500">*</span>
      </label>
      <HeadlessSelect
        :model-value="modelValue?.participationType ?? ''"
        :options="roleOptions"
        :placeholder="loading ? 'Loading...' : 'Select type'"
        allow-empty
        :empty-label="loading ? 'Loading...' : 'Select type'"
        empty-value=""
        :disabled="loading"
        teleport
        wrapper-class="mt-2"
        :invalid="!!errors?.participationType"
        :options-class="appSectionListboxOptionsClass"
        @update:model-value="onParticipationTypeChange"
      />
      <p v-if="errors?.participationType" class="mt-1 text-sm text-red-600 dark:text-red-400">{{ errors.participationType }}</p>
    </div>

    <!-- Role-dependent fields via getAppFields(appKey, role) -->
    <div v-if="hasDependentFields" :class="embedded ? 'mt-3' : 'mt-4'">
      <button
        v-if="collapsibleDependentFields"
        type="button"
        class="flex w-full items-center gap-2 text-left text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
        :aria-expanded="dependentFieldsExpanded"
        @click="dependentFieldsExpanded = !dependentFieldsExpanded"
      >
        <ChevronDownIcon
          class="h-4 w-4 shrink-0 transition-transform"
          :class="{ 'rotate-180': dependentFieldsExpanded }"
          aria-hidden="true"
        />
        <span>
          {{
            dependentFieldsExpanded
              ? t('people.participationCardHideDetails')
              : t('people.appSectionShowAdditionalFields', { count: dependentFields.length })
          }}
        </span>
      </button>
      <div
        v-show="!collapsibleDependentFields || dependentFieldsExpanded"
        :class="collapsibleDependentFields && embedded ? 'mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/80' : collapsibleDependentFields ? 'mt-4 rounded-md border border-gray-200 p-4 dark:border-gray-700' : ''"
      >
        <DynamicForm
          moduleKey="people"
          :formData="localFormData"
          :errors="errors"
          :quickCreateMode="true"
          :showAllFields="false"
          :fieldsOverride="dependentFields"
          :moduleOverride="moduleOverride"
          :context="formFieldContext"
          @update:formData="onFieldsUpdate"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { ref, computed, watch, toRef, type PropType } from 'vue';
import { ChevronDownIcon } from '@heroicons/vue/24/outline';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import { appKeyToFieldContextToken } from '@/utils/fieldContextFilter';
import { syncParticipationClassifierFields } from '@/utils/getFieldValue';
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
  },
  collapsibleDependentFields: {
    type: Boolean,
    default: false
  },
  hideSectionTitle: {
    type: Boolean,
    default: false
  },
  embedded: {
    type: Boolean,
    default: false
  }
});

const { t } = useI18n();

const emit = defineEmits<{
  'update:modelValue': [value: AppSectionModelValue];
}>();

const dependentFieldsExpanded = ref(false);

const appSectionListboxOptionsClass = 'z-[10050]';

const rootClass = computed(() => {
  if (props.embedded) return '';
  if (props.hideSectionTitle) return '';
  return 'border-t border-gray-200 dark:border-gray-700 pt-6 mt-6';
});

const { types: roles, typeDefs: peopleTypeDefs, defaultRole: tenantDefaultRole, loading } = usePeopleTypes(
  toRef(props, 'appKey')
);

const dependentFields = computed(() => {
  const pt = props.modelValue?.participationType;
  if (!pt) return [];
  return getAppFields(props.appKey, pt, peopleTypeDefs.value);
});

const roleOptions = computed(() =>
  (roles.value as string[]).map((role) => ({ value: role, label: role }))
);

const hasDependentFields = computed(
  () => dependentFields.value.length > 0 && !!props.moduleOverride
);

watch(
  [() => props.modelValue?.participationType, dependentFields],
  ([type, fields]) => {
    if (type && props.collapsibleDependentFields && fields.length > 0) {
      dependentFieldsExpanded.value = true;
    }
  }
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

const formFieldContext = computed(() => appKeyToFieldContextToken(props.appKey) || 'platform');

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
    if (m.participationType) {
      next.participationType = m.participationType;
    }
    syncParticipationClassifierFields(next, props.appKey);
    localFormData.value = next;
  },
  { immediate: true }
);

function onParticipationTypeChange(participationType: string | number | null) {
  const next =
    participationType === null || participationType === ''
      ? null
      : String(participationType);
  emit('update:modelValue', { ...props.modelValue, participationType: next });
}

function onFieldsUpdate(data: Record<string, unknown>) {
  emit('update:modelValue', { ...props.modelValue, ...data });
}
</script>
