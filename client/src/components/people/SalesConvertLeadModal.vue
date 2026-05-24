<template>
  <TransitionRoot as="template" :show="isOpen">
    <Dialog class="relative z-[10000]" @close="handleDialogClose">
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
              <DialogPanel
                class="pointer-events-auto flex h-full w-screen max-w-2xl flex-col bg-white shadow-xl dark:bg-gray-800"
              >
                <form class="relative flex h-full flex-col" @submit.prevent="handleSubmit">
                  <!-- Drawer header (matches PeopleQuickCreateDrawer / CreateRecordDrawer) -->
                  <div
                    class="flex-shrink-0 border-b border-indigo-600 bg-indigo-700 px-4 py-6 sm:px-6 dark:border-indigo-700 dark:bg-indigo-800"
                  >
                    <div class="flex items-center justify-between">
                      <DialogTitle class="text-base font-semibold text-white">{{ t('people.salesConvertLeadModalConvertLeadToContact') }}</DialogTitle>
                      <button
                        type="button"
                        class="relative rounded-md text-indigo-200 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                        @click="close"
                      >
                        <span class="absolute -inset-2.5" />
                        <span class="sr-only">{{ t('forms.previewClosePanelSr') }}</span>
                        <XMarkIcon class="size-6" aria-hidden="true" />
                      </button>
                    </div>
                    <p class="mt-1 text-sm text-indigo-300">
                      Convert this Sales Lead into a Contact. Sales participation only — identity fields are unchanged.
                    </p>
                  </div>

                  <!-- Scrollable body -->
                  <div class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
                    <div class="space-y-6 px-4 py-6 sm:px-6 pb-8">
                      <!-- Explanation Banner -->
                      <div class="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
                        <div class="flex items-start gap-2">
                          <svg
                            class="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fill-rule="evenodd"
                              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                              clip-rule="evenodd"
                            />
                          </svg>
                          <div>
                            <p class="mb-1 text-sm font-medium text-blue-900 dark:text-blue-200">{{ t('people.salesConvertLeadModalConvertingSalesParticipation') }}</p>
                            <p class="text-sm text-blue-700 dark:text-blue-300">{{ t('people.salesConvertLeadModalCoreIdentityFieldsNameEmailEtc') }}</p>
                          </div>
                        </div>
                      </div>

                      <!-- Error State -->
                      <div
                        v-if="error"
                        class="rounded-lg border border-danger-200 bg-danger-50 p-4 dark:border-danger-800 dark:bg-danger-900/20"
                      >
                        <div class="flex items-start gap-2">
                          <svg
                            class="h-5 w-5 flex-shrink-0 text-danger-600 dark:text-danger-400"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fill-rule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                              clip-rule="evenodd"
                            />
                          </svg>
                          <p class="flex-1 text-sm text-danger-700 dark:text-danger-300">{{ error }}</p>
                        </div>
                      </div>

                      <!-- Validation Errors Summary -->
                      <div
                        v-if="Object.keys(validationErrors).length > 0"
                        class="rounded-lg border border-danger-200 bg-danger-50 p-4 dark:border-danger-800 dark:bg-danger-900/20"
                      >
                        <div class="flex items-start gap-2">
                          <svg
                            class="h-5 w-5 flex-shrink-0 text-danger-600 dark:text-danger-400"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fill-rule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                              clip-rule="evenodd"
                            />
                          </svg>
                          <div class="flex-1">
                            <h3 class="mb-2 text-sm font-semibold text-danger-800 dark:text-danger-200">{{ t('people.salesConvertLeadModalValidationErrors') }}</h3>
                            <ul class="list-inside list-disc space-y-2">
                              <li
                                v-for="(message, field) in validationErrors"
                                :key="field"
                                class="text-sm text-danger-700 dark:text-danger-300"
                              >
                                <span class="font-medium">{{ getFieldLabel(field) }}:</span> {{ message }}
                              </li>
                            </ul>
                          </div>
                        </div>
                      </div>

                      <!-- State Fields Section -->
                      <div v-if="visibleStateFields.length > 0">
                        <h3 class="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-white">{{ t('people.salesConvertLeadModalStateFields') }}</h3>
                        <div class="space-y-4">
                          <div v-for="fieldName in visibleStateFields" :key="fieldName">
                            <label
                              :for="fieldName"
                              class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                            >
                              {{ getFieldLabel(fieldName) }}
                              <span v-if="isFieldRequired(fieldName)" class="text-red-500">*</span>
                            </label>
                            <select
                              v-if="getFieldComponent(fieldName) === 'select'"
                              :id="fieldName"
                              v-model="formData[fieldName]"
                              :name="fieldName"
                              :required="isFieldRequired(fieldName)"
                              :class="[
                                'w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:ring-indigo-500',
                                validationErrors[fieldName] ? 'border-red-500 dark:border-red-500' : ''
                              ]"
                              @change="clearDefaultTracking(fieldName)"
                            >
                              <option value="">Select {{ getFieldLabel(fieldName) }}...</option>
                              <option v-for="option in getFieldOptions(fieldName)" :key="option" :value="option">
                                {{ option }}
                              </option>
                            </select>
                            <p v-if="validationErrors[fieldName]" class="mt-2 text-sm text-danger-600 dark:text-danger-400">
                              {{ validationErrors[fieldName] }}
                            </p>
                            <p
                              v-if="isFieldPrefilledWithDefault(fieldName)"
                              class="mt-1 text-xs italic text-gray-500 dark:text-gray-400"
                            >
                              Default value selected — you can change this.
                            </p>
                          </div>
                        </div>
                      </div>

                      <!-- Detail Fields Section -->
                      <div v-if="detailFields.length > 0">
                        <h3 class="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-900 dark:text-white">{{ t('people.salesConvertLeadModalDetailFields') }}</h3>
                        <div class="space-y-4">
                          <div v-for="fieldName in detailFields" :key="fieldName">
                            <label
                              :for="fieldName"
                              class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
                            >
                              {{ getFieldLabel(fieldName) }}
                              <span v-if="isFieldRequired(fieldName)" class="text-red-500">*</span>
                            </label>
                            <select
                              v-if="getFieldComponent(fieldName) === 'select'"
                              :id="fieldName"
                              v-model="formData[fieldName]"
                              :name="fieldName"
                              :required="isFieldRequired(fieldName)"
                              :class="[
                                'w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:ring-indigo-500',
                                validationErrors[fieldName] ? 'border-red-500 dark:border-red-500' : ''
                              ]"
                            >
                              <option value="">Select {{ getFieldLabel(fieldName) }}...</option>
                              <option v-for="option in getFieldOptions(fieldName)" :key="option" :value="option">
                                {{ option }}
                              </option>
                            </select>
                            <input
                              v-else-if="getInputType(fieldName) === 'date'"
                              :id="fieldName"
                              v-model="formData[fieldName]"
                              :name="fieldName"
                              type="date"
                              :required="isFieldRequired(fieldName)"
                              :class="[
                                'w-full cursor-pointer rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:ring-indigo-500',
                                validationErrors[fieldName] ? 'border-red-500 dark:border-red-500' : ''
                              ]"
                              @click="openDatePicker"
                            />
                            <input
                              v-else-if="getInputType(fieldName) === 'number'"
                              :id="fieldName"
                              v-model.number="formData[fieldName]"
                              :name="fieldName"
                              type="number"
                              :required="isFieldRequired(fieldName)"
                              :class="[
                                'w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:ring-indigo-500',
                                validationErrors[fieldName] ? 'border-red-500 dark:border-red-500' : ''
                              ]"
                            />
                            <textarea
                              v-else-if="getFieldComponent(fieldName) === 'textarea'"
                              :id="fieldName"
                              v-model="formData[fieldName]"
                              :name="fieldName"
                              rows="3"
                              :required="isFieldRequired(fieldName)"
                              :class="[
                                'w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:ring-indigo-500',
                                validationErrors[fieldName] ? 'border-red-500 dark:border-red-500' : ''
                              ]"
                            />
                            <input
                              v-else
                              :id="fieldName"
                              v-model="formData[fieldName]"
                              :name="fieldName"
                              type="text"
                              :required="isFieldRequired(fieldName)"
                              :class="[
                                'w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:ring-indigo-500',
                                validationErrors[fieldName] ? 'border-red-500 dark:border-red-500' : ''
                              ]"
                            />
                            <p v-if="validationErrors[fieldName]" class="mt-2 text-sm text-danger-600 dark:text-danger-400">
                              {{ validationErrors[fieldName] }}
                            </p>
                          </div>
                        </div>
                      </div>

                      <!-- Empty State -->
                      <div
                        v-if="visibleStateFields.length === 0 && detailFields.length === 0"
                        class="py-8 text-center"
                      >
                        <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('people.salesConvertLeadModalNoContactFieldsAvailable') }}</p>
                      </div>
                    </div>
                  </div>

                  <!-- Fixed footer -->
                  <div
                    class="flex flex-shrink-0 justify-end gap-3 border-t border-gray-200 bg-white px-4 py-4 dark:border-gray-700 dark:bg-gray-800"
                  >
                    <button
                      type="button"
                      class="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:ring-gray-600 dark:hover:bg-gray-700"
                      @click="close"
                    >{{ t('performance.cancelWizard') }}</button>
                    <button
                      type="submit"
                      :disabled="loading"
                      class="inline-flex items-center justify-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                    >
                      <svg
                        v-if="loading"
                        class="h-4 w-4 animate-spin text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                        <path
                          class="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      <span>{{ loading ? 'Converting…' : 'Convert to Contact' }}</span>
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
import { useI18n } from 'vue-i18n';
import { resolveFieldLabel } from '@/utils/fieldLabelResolver';
import { ref, computed, watch } from 'vue';
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot
} from '@headlessui/vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import {
  getStateFields,
  getDetailFields,
  getFieldMetadata,
  getAppFields
} from '@/platform/fields/peopleFieldModel';
import apiClient from '@/utils/apiClient';
import { usePeopleTypes } from '@/composables/usePeopleTypes';
import { openDatePicker } from '@/utils/dateUtils';
import { assertLifecyclePermission } from '@/platform/permissions/peopleGuards';
import { isPeopleSalesRoleFieldKey } from '@/utils/peopleParticipationUi';

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  personId: {
    type: String,
    required: true
  }
});

const { t, te } = useI18n();

const emit = defineEmits(['close', 'converted']);

const loading = ref(false);
const error = ref(null);
const validationErrors = ref({});
const formData = ref({});
const defaultPrefilledFields = ref(new Set());

const appKey = 'SALES';
const classifierValue = 'Contact';

const { typeDefs: peopleTypeDefs } = usePeopleTypes(appKey);

const contactParticipationKeys = computed(() => {
  const keys = getAppFields(appKey, classifierValue, peopleTypeDefs.value);
  return keys.length > 0 ? new Set(keys) : null;
});

const stateFields = computed(() => {
  return getStateFields(appKey);
});

const visibleStateFields = computed(() => {
  return stateFields.value.filter((fieldName) => {
    if (isPeopleSalesRoleFieldKey(fieldName)) {
      return false;
    }
    const set = contactParticipationKeys.value;
    if (set && set.size > 0) {
      return set.has(fieldName);
    }
    if (fieldName === 'lead_status') return false;
    if (fieldName === 'contact_status') return true;
    return false;
  });
});

const allDetailFields = computed(() => {
  return getDetailFields(appKey);
});

const detailFields = computed(() => {
  const set = contactParticipationKeys.value;
  if (set && set.size > 0) {
    return allDetailFields.value.filter((fieldName) => set.has(fieldName));
  }
  return allDetailFields.value.filter((fieldName) => {
    if (
      fieldName.startsWith('lead_') ||
      fieldName.startsWith('qualification_') ||
      fieldName === 'estimated_value' ||
      fieldName === 'interest_products'
    ) {
      return false;
    }
    if (fieldName === 'role' || fieldName === 'birthday' || fieldName === 'preferred_contact_method') {
      return true;
    }
    return false;
  });
});

const getFieldLabel = (fieldName) => {
  const metadata = getFieldMetadata(fieldName);
  const apiLabel = metadata?.label || metadata?.displayName;
  return resolveFieldLabel('people', { key: fieldName, label: apiLabel }, t, te);
};

const isFieldRequired = (fieldName) => {
  const metadata = getFieldMetadata(fieldName);
  return metadata.requiredFor?.includes(appKey) || false;
};

const getFieldComponent = (fieldName) => {
  const enumFields = ['lead_status', 'contact_status', 'role', 'preferred_contact_method'];
  if (isPeopleSalesRoleFieldKey(fieldName) || enumFields.includes(fieldName)) {
    return 'select';
  }
  const textFields = ['qualification_notes'];
  if (textFields.includes(fieldName)) {
    return 'textarea';
  }
  return 'input';
};

const getFieldOptions = (fieldName) => {
  if (isPeopleSalesRoleFieldKey(fieldName)) {
    return ['Lead', 'Contact'];
  }
  const optionsMap = {
    lead_status: ['New', 'Contacted', 'Qualified', 'Disqualified', 'Nurturing', 'Re-Engage'],
    contact_status: ['Active', 'Inactive', 'DoNotContact'],
    role: ['Decision Maker', 'Influencer', 'Support', 'Other'],
    preferred_contact_method: ['Email', 'Phone', 'WhatsApp', 'SMS', 'None']
  };
  return optionsMap[fieldName] || [];
};

const getInputType = (fieldName) => {
  const dateFields = ['qualification_date', 'birthday'];
  if (dateFields.includes(fieldName)) {
    return 'date';
  }
  const numberFields = ['lead_score', 'estimated_value'];
  if (numberFields.includes(fieldName)) {
    return 'number';
  }
  return 'text';
};

const getDefaultStateValue = (fieldName) => {
  const metadata = getFieldMetadata(fieldName);
  if (metadata.owner !== 'participation' || metadata.intent !== 'state') {
    return null;
  }
  if (fieldName === 'contact_status') {
    return 'Active';
  }
  return null;
};

const isFieldPrefilledWithDefault = (fieldName) => {
  return defaultPrefilledFields.value.has(fieldName);
};

const applySmartDefaults = () => {
  visibleStateFields.value.forEach((fieldName) => {
    if (isPeopleSalesRoleFieldKey(fieldName)) {
      return;
    }
    const currentValue = formData.value[fieldName];
    if (currentValue !== null && currentValue !== undefined && currentValue !== '') {
      return;
    }
    const defaultValue = getDefaultStateValue(fieldName);
    if (defaultValue !== null) {
      formData.value[fieldName] = defaultValue;
      defaultPrefilledFields.value.add(fieldName);
    }
  });
};

const clearDefaultTracking = (fieldName) => {
  if (defaultPrefilledFields.value.has(fieldName)) {
    defaultPrefilledFields.value.delete(fieldName);
  }
};

const initializeFormData = () => {
  formData.value = {};
  defaultPrefilledFields.value.clear();
  formData.value.sales_type = 'Contact';
  [...visibleStateFields.value, ...detailFields.value].forEach((fieldName) => {
    if (!Object.prototype.hasOwnProperty.call(formData.value, fieldName)) {
      if (getFieldComponent(fieldName) === 'select') {
        formData.value[fieldName] = '';
      } else if (getInputType(fieldName) === 'date') {
        formData.value[fieldName] = '';
      } else if (getInputType(fieldName) === 'number') {
        formData.value[fieldName] = '';
      } else {
        formData.value[fieldName] = '';
      }
    }
  });
  setTimeout(() => {
    applySmartDefaults();
  }, 0);
};

watch(
  () => props.isOpen,
  (newVal) => {
    if (newVal) {
      initializeFormData();
      error.value = null;
      validationErrors.value = {};
    }
  }
);

const handleDialogClose = () => {
  if (!loading.value) {
    close();
  }
};

const close = (force = false) => {
  if (force || !loading.value) {
    emit('close');
  }
};

const handleSubmit = async () => {
  assertLifecyclePermission('SALES');

  error.value = null;
  validationErrors.value = {};

  const visibleFields = [...visibleStateFields.value, ...detailFields.value];
  const requiredFields = visibleFields.filter((fieldName) => isFieldRequired(fieldName));

  const errors = {};
  requiredFields.forEach((fieldName) => {
    const value = formData.value[fieldName];
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      errors[fieldName] = `${getFieldLabel(fieldName)} is required`;
    }
  });

  if (Object.keys(errors).length > 0) {
    validationErrors.value = errors;
    return;
  }

  const cleanedFormData = { ...formData.value };
  const enumFields = ['contact_status', 'role', 'preferred_contact_method'];
  enumFields.forEach((field) => {
    if (cleanedFormData[field] === '') {
      cleanedFormData[field] = null;
    }
  });

  const conversionData = {
    ...Object.fromEntries(
      Object.entries(cleanedFormData).filter(([key, value]) => {
        if (isPeopleSalesRoleFieldKey(key)) return false;
        if (
          key.startsWith('lead_') ||
          key.startsWith('qualification_') ||
          key === 'estimated_value' ||
          key === 'interest_products'
        ) {
          return false;
        }
        return value !== null && value !== '' && (!Array.isArray(value) || value.length > 0);
      })
    ),
    sales_type: 'Contact'
  };

  loading.value = true;

  try {
    const response = await apiClient.post(`/people/${props.personId}/convert-lead-to-contact`, {
      formData: conversionData
    });

    if (response.success) {
      emit('converted', response.data);
      close(true);
    } else {
      if (response.errors) {
        validationErrors.value = response.errors;
        error.value = response.message || 'Validation failed. Please check the fields below.';
      } else {
        error.value = response.message || 'Failed to convert Lead to Contact';
      }
    }
  } catch (err) {
    console.error('Error converting Lead to Contact:', err);

    if (err.response?.data?.errors) {
      validationErrors.value = err.response.data.errors;
      error.value = err.response.data.message || 'Validation failed. Please check the fields below.';
    } else if (err.response?.data?.message) {
      error.value = err.response.data.message;
    } else {
      error.value = err.message || 'Error converting Lead to Contact';
    }
  } finally {
    loading.value = false;
  }
};
</script>
