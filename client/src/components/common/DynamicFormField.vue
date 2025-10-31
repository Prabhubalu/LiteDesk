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
    
    <!-- Picklist (using native HTML select styled with Tailwind) -->
    <div v-else-if="field.dataType === 'Picklist'" class="relative">
      <select
        :id="`picklist-${field.key}`"
        :name="field.key"
        :value="value || ''"
        @change="updateValue($event.target.value)"
        :required="field.required"
        :disabled="isReadOnly"
        class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 focus:border-transparent transition-all cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 fill=%27none%27 viewBox=%270 0 20 20%27%3E%3Cpath stroke=%27%236b7280%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27 stroke-width=%271.5%27 d=%27M6 8l4 4 4-4%27/%3E%3C/svg%3E')] bg-no-repeat bg-right bg-[length:1.5em_1.5em] pr-10"
        :class="isReadOnly ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed' : ''"
      >
        <option value="">{{ field.placeholder || `Select ${field.label || field.key}` }}</option>
        <option
          v-for="option in field.options || []"
          :key="option"
          :value="option"
        >
          {{ option }}
        </option>
      </select>
    </div>
    
    <!-- Radio Button (using Headless UI Listbox) -->
    <div v-else-if="field.dataType === 'Radio Button'" class="relative">
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
    
    <!-- Multi-Picklist (custom tag-based multi-select) -->
    <div v-else-if="field.dataType === 'Multi-Picklist'" class="relative">
      <div
        :class="[
          'w-full min-h-[2.5rem] rounded-lg border transition-all',
          isReadOnly
            ? 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 cursor-not-allowed'
            : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus-within:ring-2 focus-within:ring-brand-500 dark:focus-within:ring-brand-600 focus-within:border-transparent cursor-pointer',
          showMultiOptions ? 'ring-2 ring-brand-500 dark:ring-brand-600 border-transparent' : ''
        ]"
        @click="!isReadOnly && (showMultiOptions = !showMultiOptions)"
      >
        <!-- Selected tags and placeholder -->
        <div class="flex flex-wrap items-center gap-2 p-2 min-h-[2.5rem]">
          <template v-if="selectedMultiValues.length > 0">
            <span
              v-for="selected in selectedMultiValues"
              :key="selected"
              class="inline-flex items-center gap-1.5 rounded-full bg-brand-100 dark:bg-brand-900/40 px-3 py-1 text-sm font-medium text-brand-800 dark:text-brand-200"
            >
              {{ selected }}
              <button
                v-if="!isReadOnly"
                type="button"
                @click.stop="removeMultiSelect(selected)"
                class="ml-0.5 rounded-full hover:bg-brand-200 dark:hover:bg-brand-800 transition-colors"
                aria-label="Remove"
              >
                <XMarkIcon class="h-3.5 w-3.5" />
              </button>
            </span>
          </template>
          <span
            v-else
            class="text-gray-400 dark:text-gray-500 text-sm px-2"
          >
            {{ field.placeholder || `Select ${field.label || field.key}...` }}
          </span>
        </div>
      </div>
      
      <!-- Dropdown options -->
      <Transition
        enter-active-class="transition ease-out duration-100"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition ease-in duration-75"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div
          v-if="showMultiOptions && !isReadOnly"
          v-click-outside="() => showMultiOptions = false"
          class="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black/5 dark:ring-white/10 max-h-60 overflow-auto"
        >
          <div class="py-1">
            <button
              v-for="option in field.options || []"
              :key="option"
              type="button"
              @click="toggleMultiSelect(option)"
              :class="[
                'w-full text-left px-4 py-2 text-sm transition-colors',
                selectedMultiValues.includes(option)
                  ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-900 dark:text-brand-100 font-medium'
                  : 'text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700'
              ]"
            >
              <div class="flex items-center gap-2">
                <div
                  :class="[
                    'flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
                    selectedMultiValues.includes(option)
                      ? 'bg-brand-600 dark:bg-brand-500 border-brand-600 dark:border-brand-500'
                      : 'border-gray-300 dark:border-gray-600'
                  ]"
                >
                  <svg
                    v-if="selectedMultiValues.includes(option)"
                    class="w-3 h-3 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clip-rule="evenodd"
                    />
                  </svg>
                </div>
                <span>{{ option }}</span>
              </div>
            </button>
            <div
              v-if="!field.options || field.options.length === 0"
              class="px-4 py-2 text-sm text-gray-500 dark:text-gray-400"
            >
              No options available
            </div>
          </div>
        </div>
      </Transition>
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
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { Listbox, ListboxButton, ListboxOptions, ListboxOption } from '@headlessui/vue';
import { CheckIcon, ChevronUpDownIcon, XMarkIcon } from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';

// Note: Headless UI Listbox is still used for Lookup (Relationship) fields and Radio Button
// Picklist uses native HTML select styled with Tailwind
// Multi-Picklist uses a custom tag-based dropdown component

// Click outside directive for multi-select dropdown
const vClickOutside = {
  mounted(el, binding) {
    el.clickOutsideEvent = (event) => {
      if (!(el === event.target || el.contains(event.target))) {
        binding.value(event);
      }
    };
    document.addEventListener('click', el.clickOutsideEvent);
  },
  unmounted(el) {
    document.removeEventListener('click', el.clickOutsideEvent);
  }
};

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
const showMultiOptions = ref(false);
const isReadOnly = computed(() => {
  return ['Auto-Number', 'Formula', 'Rollup Summary'].includes(props.field.dataType);
});

// Check if this is a user lookup field that should fetch users (assignedTo, accountManager, etc.)
const isAssignedToField = computed(() => {
  const key = props.field.key?.toLowerCase();
  const label = props.field.label?.toLowerCase() || '';
  
  // Check by key
  if (key === 'assignedto' || 
      key === 'assigned_to' || 
      key === 'accountmanager' ||
      key === 'account_manager') {
    return true;
  }
  
  // Check by label
  if (label.includes('assigned to') || 
      label.includes('assigned to (owner)') ||
      label.includes('account manager') ||
      (label.includes('manager') && props.field.lookupSettings?.targetModule === 'users')) {
    return true;
  }
  
  // Check if lookup target is users
  if (props.field.lookupSettings?.targetModule === 'users') {
    return true;
  }
  
  return false;
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
  // Always return an array for Multi-Picklist
  if (!props.value) return [];
  if (Array.isArray(props.value)) return props.value;
  // If value is not an array but exists, convert to array
  // (handles cases where backend might return a single string or other type)
  return [props.value].filter(Boolean);
});

const handleMultiSelectUpdate = (newValues) => {
  // Ensure we always emit an array
  const values = Array.isArray(newValues) ? newValues : (newValues ? [newValues] : []);
  emit('update:value', values);
};

const handleMultiSelectChange = (event) => {
  // Get selected options from the select element
  const selectedOptions = Array.from(event.target.selectedOptions, option => option.value);
  emit('update:value', selectedOptions);
};

const toggleMultiSelect = (option) => {
  const current = [...selectedMultiValues.value];
  const index = current.indexOf(option);
  
  if (index > -1) {
    // Remove if already selected
    current.splice(index, 1);
  } else {
    // Add if not selected
    current.push(option);
  }
  
  emit('update:value', current);
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
  
  // Ensure Multi-Picklist fields always have array values
  if (props.field.dataType === 'Multi-Picklist' && !Array.isArray(props.value)) {
    const arrayValue = props.value ? (Array.isArray(props.value) ? props.value : [props.value]) : [];
    emit('update:value', arrayValue);
  }
});
</script>

