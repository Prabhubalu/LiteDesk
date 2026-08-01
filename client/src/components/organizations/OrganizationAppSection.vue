<!--
  Organization App Section — app participation UI (mirrors people AppSection).
  Type (required) from useOrganizationParticipationTypes(appKey)
  Dependent fields from getOrganizationFieldsForType(role, typeDefs)
-->
<template>
  <div :class="rootClass">
    <h3
      v-if="!hideSectionTitle"
      class="text-sm font-semibold text-gray-900 dark:text-white mb-4"
    >
      {{ appSectionTitle }}
    </h3>

    <div :class="embedded ? 'mb-0' : 'mb-4'" data-field-key="participationType">
      <label class="block text-sm/6 font-medium text-gray-900 dark:text-white mb-1">
        {{ t('settings.modFieldsValidationType') }}<span class="text-red-500">*</span>
      </label>
      <HeadlessSelect
        :model-value="modelValue?.participationType ?? ''"
        :options="roleOptions"
        :placeholder="loading ? t('states.loading') : t('settings.organizationParticipationTypesSelectType')"
        allow-empty
        :empty-label="loading ? t('states.loading') : t('settings.organizationParticipationTypesSelectType')"
        empty-value=""
        :disabled="loading"
        teleport
        wrapper-class="mt-2"
        :invalid="!!errors?.participationType"
        :options-class="appSectionListboxOptionsClass"
        @update:model-value="onParticipationTypeChange"
      />
      <p v-if="errors?.participationType" class="mt-1 text-sm text-red-600 dark:text-red-400">
        {{ errors.participationType }}
      </p>
    </div>

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
        :class="
          collapsibleDependentFields && embedded
            ? 'mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/80'
            : collapsibleDependentFields
              ? 'mt-4 rounded-md border border-gray-200 p-4 dark:border-gray-700'
              : ''
        "
      >
        <DynamicForm
          module-key="organizations"
          context="platform"
          :form-data="localFormData"
          :errors="errors"
          :quick-create-mode="false"
          :show-all-fields="true"
          :fields-override="dependentFields"
          :module-override="moduleOverride"
          :single-column="singleColumn"
          @update:form-data="onFieldsUpdate"
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
import DynamicForm from '@/components/common/DynamicForm.vue';
import { getAppLabel } from '@/utils/getRoleDisplay';
import { useOrganizationParticipationTypes } from '@/composables/useOrganizationParticipationTypes';
import { getOrganizationFieldsForType } from '@/platform/fields/organizationFieldModel';

export interface OrganizationAppSectionModelValue {
  participationType?: string | null;
  [key: string]: unknown;
}

const props = defineProps({
  appKey: { type: String, required: true },
  modelValue: {
    type: Object as PropType<OrganizationAppSectionModelValue>,
    required: true,
    default: () => ({ participationType: null as string | null }),
  },
  moduleOverride: {
    type: Object as PropType<Record<string, unknown> | null>,
    default: null,
  },
  errors: {
    type: Object as PropType<Record<string, string>>,
    default: () => ({}),
  },
  collapsibleDependentFields: { type: Boolean, default: false },
  hideSectionTitle: { type: Boolean, default: false },
  embedded: { type: Boolean, default: false },
  singleColumn: { type: Boolean, default: false },
});

const { t } = useI18n();
const emit = defineEmits<{
  'update:modelValue': [value: OrganizationAppSectionModelValue];
}>();

const dependentFieldsExpanded = ref(false);
const appSectionListboxOptionsClass = 'z-[10050]';

const rootClass = computed(() => {
  if (props.embedded) return '';
  if (props.hideSectionTitle) return '';
  return 'border-t border-gray-200 dark:border-gray-700 pt-6 mt-6';
});

const {
  types: roles,
  typeDefs,
  defaultRole: tenantDefaultRole,
  loading,
} = useOrganizationParticipationTypes(toRef(props, 'appKey'));

const dependentFields = computed(() => {
  const pt = props.modelValue?.participationType;
  if (!pt) return [];
  return getOrganizationFieldsForType(pt, typeDefs.value);
});

const roleOptions = computed(() =>
  (roles.value as string[]).map((role) => ({ value: role, label: role }))
);

const hasDependentFields = computed(
  () => dependentFields.value.length > 0 && !!props.moduleOverride
);

const appSectionTitle = computed(() => {
  const label = getAppLabel(props.appKey) || props.appKey;
  return t('organizations.organizationAppSectionTitle', { app: label });
});

const localFormData = computed(() => {
  const { participationType, ...rest } = props.modelValue || {};
  // DynamicForm gates org type-scoped fields on formData.types — mirror selected role.
  const types = participationType ? [String(participationType)] : [];
  return { ...rest, types };
});

watch(
  [() => props.modelValue?.participationType, dependentFields],
  ([type, fields]) => {
    if (type && props.collapsibleDependentFields && fields.length > 0) {
      dependentFieldsExpanded.value = true;
    }
  }
);

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

function onParticipationTypeChange(value: string) {
  const next = value || null;
  emit('update:modelValue', { ...props.modelValue, participationType: next });
}

function onFieldsUpdate(next: Record<string, unknown>) {
  const { types: _types, ...rest } = next || {};
  emit('update:modelValue', {
    ...props.modelValue,
    ...rest,
    participationType: props.modelValue?.participationType,
  });
}
</script>
