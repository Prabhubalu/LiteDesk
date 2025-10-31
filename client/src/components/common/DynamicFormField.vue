<template>
  <div>
    <label 
      :for="field.key" 
      class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
    >
      {{ field.label || field.key }}
      <span v-if="field.required" class="text-red-500">*</span>
    </label>
    
    <!-- Text -->
    <input 
      v-if="field.dataType === 'Text'"
      :id="field.key"
      :name="field.key"
      :type="getInputType(field)"
      :value="value"
      @input="updateValue($event.target.value)"
      :placeholder="field.placeholder || `Enter ${field.label || field.key}`"
      :required="field.required"
      :disabled="isReadOnly"
      class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 focus:border-transparent transition-all"
    />
    
    <!-- Text-Area -->
    <textarea 
      v-else-if="field.dataType === 'Text-Area'"
      :id="field.key"
      :name="field.key"
      :value="value"
      @input="updateValue($event.target.value)"
      :placeholder="field.placeholder || `Enter ${field.label || field.key}`"
      :required="field.required"
      :disabled="isReadOnly"
      :rows="field.textSettings?.rows || 4"
      :maxlength="field.textSettings?.maxLength"
      class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 focus:border-transparent transition-all resize-y"
    />
    
    <!-- Email -->
    <input 
      v-else-if="field.dataType === 'Email'"
      :id="field.key"
      :name="field.key"
      type="email"
      :value="value"
      @input="updateValue($event.target.value)"
      :placeholder="field.placeholder || `email@example.com`"
      :required="field.required"
      :disabled="isReadOnly"
      class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 focus:border-transparent transition-all"
    />
    
    <!-- Phone -->
    <input 
      v-else-if="field.dataType === 'Phone'"
      :id="field.key"
      :name="field.key"
      type="tel"
      :value="value"
      @input="updateValue($event.target.value)"
      :placeholder="field.placeholder || `+1 (555) 123-4567`"
      :required="field.required"
      :disabled="isReadOnly"
      class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 focus:border-transparent transition-all"
    />
    
    <!-- Integer, Decimal, Currency -->
    <input 
      v-else-if="['Integer', 'Decimal', 'Currency'].includes(field.dataType)"
      :id="field.key"
      :name="field.key"
      type="number"
      :value="value"
      @input="updateValue($event.target.value)"
      :placeholder="field.placeholder || `Enter ${field.label || field.key}`"
      :required="field.required"
      :disabled="isReadOnly"
      :min="field.numberSettings?.min"
      :max="field.numberSettings?.max"
      :step="field.dataType === 'Integer' ? 1 : (field.numberSettings?.decimalPlaces ? Math.pow(0.1, field.numberSettings.decimalPlaces) : 0.01)"
      class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 focus:border-transparent transition-all"
    />
    
    <!-- Date -->
    <input 
      v-else-if="field.dataType === 'Date'"
      :id="field.key"
      :name="field.key"
      type="date"
      :value="formatDateForInput(value)"
      @input="updateValue($event.target.value)"
      :required="field.required"
      :disabled="isReadOnly"
      class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 focus:border-transparent transition-all"
    />
    
    <!-- Date-Time -->
    <input 
      v-else-if="field.dataType === 'Date-Time'"
      :id="field.key"
      :name="field.key"
      type="datetime-local"
      :value="formatDateTimeForInput(value)"
      @input="updateValue($event.target.value)"
      :required="field.required"
      :disabled="isReadOnly"
      class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 focus:border-transparent transition-all"
    />
    
    <!-- Picklist, Radio Button (using Headless UI Listbox) -->
    <div v-else-if="field.dataType === 'Picklist' || field.dataType === 'Radio Button'" class="relative">
      <Listbox :model-value="value || ''" @update:model-value="updateValue" :disabled="isReadOnly">
        <div class="relative">
          <ListboxButton
            :class="[
              'relative w-full cursor-default rounded-lg border py-2.5 pl-4 pr-10 text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 sm:text-sm transition-all',
              isReadOnly
                ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600 cursor-not-allowed'
                : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
            ]"
          >
            <span class="block truncate">{{ getSelectedLabel() || (field.placeholder || `Select ${field.label || field.key}`) }}</span>
            <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
              <ChevronUpDownIcon class="h-5 w-5 text-gray-400 dark:text-gray-500" aria-hidden="true" />
            </span>
          </ListboxButton>

          <Transition
            leave-active-class="transition duration-100 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <ListboxOptions
              class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white dark:bg-gray-700 py-1 text-base shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none sm:text-sm"
            >
              <ListboxOption
                v-for="option in field.options || []"
                :key="option"
                :value="option"
                v-slot="{ active, selected }"
              >
                <li
                  :class="[
                    'relative cursor-default select-none py-2 pl-10 pr-4',
                    active ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-900 dark:text-brand-100' : 'text-gray-900 dark:text-gray-100'
                  ]"
                >
                  <span :class="[selected ? 'font-medium' : 'font-normal', 'block truncate']">
                    {{ option }}
                  </span>
                  <span
                    v-if="selected"
                    class="absolute inset-y-0 left-0 flex items-center pl-3 text-brand-600 dark:text-brand-400"
                  >
                    <CheckIcon class="h-5 w-5" aria-hidden="true" />
                  </span>
                </li>
              </ListboxOption>
            </ListboxOptions>
          </Transition>
        </div>
      </Listbox>
    </div>
    
    <!-- Multi-Picklist (using Headless UI Listbox with multiple selection) -->
    <div v-else-if="field.dataType === 'Multi-Picklist'" class="relative">
      <Listbox :model-value="selectedMultiValues" @update:model-value="handleMultiSelectUpdate" :multiple :disabled="isReadOnly">
        <div class="relative">
          <ListboxButton
            :class="[
              'relative w-full cursor-default rounded-lg border py-2.5 pl-4 pr-10 text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 sm:text-sm transition-all',
              isReadOnly
                ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600 cursor-not-allowed'
                : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
            ]"
          >
            <span class="block truncate">
              {{ getMultiSelectDisplayText() || (field.placeholder || `Select ${field.label || field.key}`) }}
            </span>
            <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
              <ChevronUpDownIcon class="h-5 w-5 text-gray-400 dark:text-gray-500" aria-hidden="true" />
            </span>
          </ListboxButton>

          <Transition
            leave-active-class="transition duration-100 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <ListboxOptions
              class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white dark:bg-gray-700 py-1 text-base shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none sm:text-sm"
            >
              <ListboxOption
                v-for="option in field.options || []"
                :key="option"
                :value="option"
                v-slot="{ active, selected }"
              >
                <li
                  :class="[
                    'relative cursor-default select-none py-2 pl-10 pr-4',
                    active ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-900 dark:text-brand-100' : 'text-gray-900 dark:text-gray-100'
                  ]"
                >
                  <span :class="[selected ? 'font-medium' : 'font-normal', 'block truncate']">
                    {{ option }}
                  </span>
                  <span
                    v-if="selected"
                    class="absolute inset-y-0 left-0 flex items-center pl-3 text-brand-600 dark:text-brand-400"
                  >
                    <CheckIcon class="h-5 w-5" aria-hidden="true" />
                  </span>
                </li>
              </ListboxOption>
            </ListboxOptions>
          </Transition>
        </div>
      </Listbox>
      
      <!-- Selected tags display (optional - shows selected items as chips below dropdown) -->
      <div v-if="selectedMultiValues.length > 0 && !isReadOnly" class="mt-2 flex flex-wrap gap-2">
        <span
          v-for="selected in selectedMultiValues"
          :key="selected"
          class="inline-flex items-center gap-1 rounded-full bg-brand-100 dark:bg-brand-900/30 px-3 py-1 text-sm text-brand-800 dark:text-brand-200"
        >
          {{ selected }}
          <button
            type="button"
            @click="removeMultiSelect(selected)"
            class="ml-1 rounded-full hover:bg-brand-200 dark:hover:bg-brand-800"
          >
            <XMarkIcon class="h-4 w-4" />
          </button>
        </span>
      </div>
    </div>
    
    <!-- Checkbox -->
    <div v-else-if="field.dataType === 'Checkbox'" class="flex items-center space-x-2">
      <input 
        :id="field.key"
        :name="field.key"
        type="checkbox"
        :checked="value"
        @change="updateValue($event.target.checked)"
        :required="field.required"
        :disabled="isReadOnly"
        class="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500"
      />
      <label 
        :for="field.key"
        class="text-sm text-gray-700 dark:text-gray-300"
      >
        {{ field.label || field.key }}
      </label>
    </div>
    
    <!-- Lookup (Relationship) - including Assigned To which fetches users -->
    <div v-else-if="field.dataType === 'Lookup (Relationship)'" class="relative">
      <Listbox :model-value="value || ''" @update:model-value="updateValue" :disabled="isReadOnly">
        <div class="relative">
          <ListboxButton
            :class="[
              'relative w-full cursor-default rounded-lg border py-2.5 pl-4 pr-10 text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 sm:text-sm transition-all',
              isReadOnly
                ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600 cursor-not-allowed'
                : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
            ]"
          >
            <!-- Show selected user with avatar/initial for assignedTo -->
            <div v-if="isAssignedToField && value && getSelectedLookupOption()" class="flex items-center gap-2">
              <div class="flex-shrink-0">
                <img
                  v-if="getSelectedLookupOption()?.avatar"
                  :src="getSelectedLookupOption().avatar"
                  :alt="getUserDisplayName(getSelectedLookupOption())"
                  class="h-6 w-6 rounded-full object-cover"
                />
                <div
                  v-else
                  class="h-6 w-6 rounded-full bg-brand-500 dark:bg-brand-600 flex items-center justify-center text-white text-xs font-medium"
                >
                  {{ getUserInitials(getSelectedLookupOption()) }}
                </div>
              </div>
              <span class="block truncate">{{ getLookupSelectedLabel() }}</span>
            </div>
            <!-- Default placeholder or non-user lookup -->
            <span v-else class="block truncate">{{ getLookupSelectedLabel() || (field.placeholder || `Select ${field.label || field.key}`) }}</span>
            <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
              <ChevronUpDownIcon class="h-5 w-5 text-gray-400 dark:text-gray-500" aria-hidden="true" />
            </span>
          </ListboxButton>

          <Transition
            leave-active-class="transition duration-100 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <ListboxOptions
              class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white dark:bg-gray-700 py-1 text-base shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none sm:text-sm"
            >
              <ListboxOption
                v-for="item in lookupOptions"
                :key="item._id"
                :value="item._id"
                v-slot="{ active, selected }"
              >
                <li
                  :class="[
                    'relative cursor-default select-none py-2 pr-4',
                    active ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-900 dark:text-brand-100' : 'text-gray-900 dark:text-gray-100'
                  ]"
                >
                  <!-- User avatar/initial for assignedTo fields -->
                  <div v-if="isAssignedToField" class="flex items-center gap-3 pl-10">
                    <div class="flex-shrink-0">
                      <!-- Avatar image if available -->
                      <img
                        v-if="item.avatar"
                        :src="item.avatar"
                        :alt="getUserDisplayName(item)"
                        class="h-8 w-8 rounded-full object-cover"
                      />
                      <!-- Initials fallback -->
                      <div
                        v-else
                        class="h-8 w-8 rounded-full bg-brand-500 dark:bg-brand-600 flex items-center justify-center text-white text-xs font-medium"
                      >
                        {{ getUserInitials(item) }}
                      </div>
                    </div>
                    <span :class="[selected ? 'font-medium' : 'font-normal', 'block truncate flex-1']">
                      {{ getLookupDisplay(item) }}
                    </span>
                    <span
                      v-if="selected"
                      class="flex-shrink-0 text-brand-600 dark:text-brand-400"
                    >
                      <CheckIcon class="h-5 w-5" aria-hidden="true" />
                    </span>
                  </div>
                  <!-- Regular lookup display (non-user fields) -->
                  <div v-else class="flex items-center pl-10">
                    <span :class="[selected ? 'font-medium' : 'font-normal', 'block truncate flex-1']">
                      {{ getLookupDisplay(item) }}
                    </span>
                    <span
                      v-if="selected"
                      class="flex-shrink-0 text-brand-600 dark:text-brand-400"
                    >
                      <CheckIcon class="h-5 w-5" aria-hidden="true" />
                    </span>
                  </div>
                </li>
              </ListboxOption>
            </ListboxOptions>
          </Transition>
        </div>
      </Listbox>
    </div>
    
    <!-- URL -->
    <input 
      v-else-if="field.dataType === 'URL'"
      :id="field.key"
      :name="field.key"
      type="url"
      :value="value"
      @input="updateValue($event.target.value)"
      :placeholder="field.placeholder || `https://example.com`"
      :required="field.required"
      :disabled="isReadOnly"
      class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 focus:border-transparent transition-all"
    />
    
    <!-- Auto-Number, Formula, Rollup Summary (Read-only display) -->
    <input 
      v-else-if="['Auto-Number', 'Formula', 'Rollup Summary'].includes(field.dataType)"
      :id="field.key"
      :name="field.key"
      type="text"
      :value="value || field.defaultValue || '(Auto-generated)'"
      disabled
      class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed"
    />
    
    <!-- Error message -->
    <p v-if="errors[field.key]" class="mt-1 text-sm text-red-600 dark:text-red-400">
      {{ errors[field.key] }}
    </p>
    
    <!-- Help text -->
    <p v-if="field.placeholder && !errors[field.key]" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
      {{ field.placeholder }}
    </p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { Listbox, ListboxButton, ListboxOptions, ListboxOption } from '@headlessui/vue';
import { CheckIcon, ChevronUpDownIcon, XMarkIcon } from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';

const props = defineProps({
  field: {
    type: Object,
    required: true
  },
  value: {
    type: [String, Number, Boolean, Array, Object, null],
    default: null
  },
  errors: {
    type: Object,
    default: () => ({})
  }
});

const emit = defineEmits(['update:value']);

const lookupOptions = ref([]);
const isLoadingUsers = ref(false);
const isReadOnly = computed(() => {
  return ['Auto-Number', 'Formula', 'Rollup Summary'].includes(props.field.dataType);
});

// Check if this is an assignedTo field that should fetch users
const isAssignedToField = computed(() => {
  return props.field.key?.toLowerCase() === 'assignedto' || 
         props.field.key?.toLowerCase() === 'assigned_to' ||
         props.field.label?.toLowerCase().includes('assigned to');
});

const updateValue = (newValue) => {
  emit('update:value', newValue);
};

const getInputType = (field) => {
  if (field.textSettings?.maxLength) return 'text';
  return 'text';
};

const formatDateForInput = (dateValue) => {
  if (!dateValue) return '';
  if (typeof dateValue === 'string') return dateValue.split('T')[0];
  if (dateValue instanceof Date) return dateValue.toISOString().split('T')[0];
  return '';
};

const formatDateTimeForInput = (dateValue) => {
  if (!dateValue) return '';
  if (typeof dateValue === 'string') {
    // Remove milliseconds if present
    return dateValue.replace(/\.\d{3}Z$/, '');
  }
  if (dateValue instanceof Date) {
    const d = new Date(dateValue);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }
  return '';
};

// Multi-select helpers
const selectedMultiValues = computed(() => {
  if (!props.value || !Array.isArray(props.value)) return [];
  return props.value;
});

const handleMultiSelectUpdate = (newValues) => {
  emit('update:value', newValues);
};

const getMultiSelectDisplayText = () => {
  const selected = selectedMultiValues.value;
  if (selected.length === 0) return '';
  if (selected.length === 1) return selected[0];
  return `${selected.length} selected`;
};

const removeMultiSelect = (option) => {
  const current = [...selectedMultiValues.value];
  const index = current.indexOf(option);
  if (index > -1) {
    current.splice(index, 1);
    emit('update:value', current);
  }
};

// Single select helpers
const getSelectedLabel = () => {
  if (!props.value) return '';
  const option = (props.field.options || []).find(opt => opt === props.value);
  return option || props.value;
};

// Get user initials for avatar fallback
const getUserInitials = (user) => {
  if (user.firstName && user.lastName) {
    return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  }
  if (user.firstName) {
    return user.firstName[0].toUpperCase();
  }
  if (user.username) {
    return user.username.substring(0, 2).toUpperCase();
  }
  if (user.email) {
    return user.email.substring(0, 2).toUpperCase();
  }
  return '??';
};

// Get user display name
const getUserDisplayName = (user) => {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || user.username || user.email || user._id;
};

const getLookupDisplay = (item) => {
  // For users (assignedTo), show name only (no email)
  if (isAssignedToField.value) {
    return getUserDisplayName(item);
  }
  
  if (!props.field.lookupSettings?.displayField) {
    // Auto: try common fields
    return item.name || item.title || item.first_name || item.email || item._id;
  }
  const displayField = props.field.lookupSettings.displayField;
  return item[displayField] || item._id;
};

const getSelectedLookupOption = () => {
  if (!props.value || !lookupOptions.value.length) return null;
  return lookupOptions.value.find(opt => opt._id === props.value || opt._id?.toString() === props.value?.toString());
};

const getLookupSelectedLabel = () => {
  if (!props.value) return '';
  const selected = getSelectedLookupOption();
  if (selected) {
    return getLookupDisplay(selected);
  }
  return props.value;
};

// Fetch users for assignedTo field
const fetchUsers = async () => {
  if (!isAssignedToField.value) return;
  
  isLoadingUsers.value = true;
  try {
    // Use the /users/list endpoint which doesn't require manageUsers permission
    const response = await apiClient.get('/users/list');
    
    if (response.success && Array.isArray(response.data)) {
      lookupOptions.value = response.data;
    } else {
      console.warn('Unexpected response format from /users/list:', response);
      lookupOptions.value = [];
    }
  } catch (error) {
    console.error('Error fetching users for assignedTo:', error);
    // If error, show empty array so form still works
    lookupOptions.value = [];
  } finally {
    isLoadingUsers.value = false;
  }
};

// Fetch lookup options for Lookup fields
const fetchLookupOptions = async () => {
  if (props.field.dataType !== 'Lookup (Relationship)') return;
  
  // If it's assignedTo, fetch users instead
  if (isAssignedToField.value) {
    await fetchUsers();
    return;
  }
  
  if (!props.field.lookupSettings?.targetModule) return;
  
  try {
    const moduleKey = props.field.lookupSettings.targetModule;
    const response = await apiClient.get(`/${moduleKey}`);
    if (response.success && Array.isArray(response.data)) {
      lookupOptions.value = response.data;
    } else if (response.success && response.data?.data) {
      lookupOptions.value = response.data.data;
    }
  } catch (error) {
    console.error('Error fetching lookup options:', error);
  }
};

onMounted(() => {
  if (props.field.dataType === 'Lookup (Relationship)') {
    fetchLookupOptions();
  }
  
  // Set default value if provided
  if (props.field.defaultValue !== null && props.field.defaultValue !== undefined && !props.value) {
    emit('update:value', props.field.defaultValue);
  }
});
</script>

