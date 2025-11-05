<template>
  <div>
    <label 
      :for="field.key" 
      class="block text-sm/6 font-medium text-gray-900 dark:text-white"
    >
      {{ field.label || field.key }}
      <span v-if="isRequired" class="text-red-500">*</span>
    </label>
    
    <!-- Text -->
    <input 
      v-if="field.dataType === 'Text'"
      :id="field.key"
      :name="field.key"
      :type="getInputType(field)"
      :value="value"
      @input="updateValue($event.target.value)"
      @blur="$emit('blur')"
      @keydown.enter="$event.target.blur()"
      :placeholder="field.placeholder || `Enter ${field.label || field.key}`"
      :required="isRequired"
      :disabled="isReadOnly"
      :class="[
        'block w-full mt-2 rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500',
        localValidationError || errors[field.key]
          ? 'border-red-500 dark:border-red-500 focus:ring-red-500 dark:focus:ring-red-500'
          : ''
      ]"
    />
    
    <!-- Text-Area -->
    <textarea 
      v-else-if="field.dataType === 'Text-Area'"
      :id="field.key"
      :name="field.key"
      :value="value"
      @input="updateValue($event.target.value)"
      @blur="$emit('blur')"
      @keydown.enter.ctrl="$event.target.blur()"
      :placeholder="field.placeholder || `Enter ${field.label || field.key}`"
      :required="isRequired"
      :disabled="isReadOnly"
      :rows="field.textSettings?.rows || 4"
      :maxlength="field.textSettings?.maxLength"
      class="block w-full mt-2 rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500 resize-none"
    />
    
    <!-- Email -->
    <input 
      v-else-if="field.dataType === 'Email'"
      :id="field.key"
      :name="field.key"
      type="email"
      :value="value"
      @input="updateValue($event.target.value)"
      @blur="$emit('blur')"
      @keydown.enter="$event.target.blur()"
      :placeholder="field.placeholder || `email@example.com`"
      :required="isRequired"
      :disabled="isReadOnly"
      class="block w-full mt-2 rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
    />
    
    <!-- Phone -->
    <input 
      v-else-if="field.dataType === 'Phone'"
      :id="field.key"
      :name="field.key"
      type="tel"
      :value="value"
      @input="updateValue($event.target.value)"
      @blur="$emit('blur')"
      @keydown.enter="$event.target.blur()"
      :placeholder="field.placeholder || `+1 (555) 123-4567`"
      :required="isRequired"
      :disabled="isReadOnly"
      class="block w-full mt-2 rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
    />
    
    <!-- Integer, Decimal, Currency -->
    <input 
      v-else-if="['Integer', 'Decimal', 'Currency'].includes(field.dataType)"
      :id="field.key"
      :name="field.key"
      type="number"
      :value="value"
      @input="updateValue($event.target.value)"
      @blur="$emit('blur')"
      @keydown.enter="$event.target.blur()"
      :placeholder="field.placeholder || `Enter ${field.label || field.key}`"
      :required="isRequired"
      :disabled="isReadOnly"
      :min="field.numberSettings?.min"
      :max="field.numberSettings?.max"
      :step="field.dataType === 'Integer' ? 1 : (field.numberSettings?.decimalPlaces ? Math.pow(0.1, field.numberSettings.decimalPlaces) : 0.01)"
      class="block w-full mt-2 rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
    />
    
    <!-- Date -->
    <input 
      v-else-if="field.dataType === 'Date'"
      :id="field.key"
      :name="field.key"
      type="date"
      :value="formatDateForInput(value)"
      @input="updateValue($event.target.value)"
      @blur="$emit('blur')"
      @keydown.enter="$event.target.blur()"
      :required="isRequired"
      :disabled="isReadOnly"
      class="block w-full mt-2 rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
    />
    
    <!-- Date-Time -->
    <input 
      v-else-if="field.dataType === 'Date-Time'"
      :id="field.key"
      :name="field.key"
      type="datetime-local"
      :value="formatDateTimeForInput(value)"
      @input="updateValue($event.target.value)"
      @blur="$emit('blur')"
      @keydown.enter="$event.target.blur()"
      :required="isRequired"
      :disabled="isReadOnly"
      class="block w-full mt-2 rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
    />
    
    <!-- Picklist (using Headless UI Combobox with search input inside dropdown) -->
    <div v-else-if="field.dataType === 'Picklist'" class="mt-2 relative">
      <Combobox :model-value="value || ''" @update:model-value="handlePicklistChange" :disabled="isReadOnly" nullable>
        <div class="relative">
          <ComboboxButton
            @click="handlePicklistButtonClick"
            :class="[
              'block w-full rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500',
              'relative cursor-default text-left',
              isReadOnly
                ? 'opacity-50 cursor-not-allowed'
                : '',
              localValidationError || errors[field.key]
                ? 'border-red-500 dark:border-red-500'
                : ''
            ]"
          >
            <div class="flex items-center gap-2">
              <span v-if="getSelectedPicklistOptionColor() && value" class="w-3 h-3 rounded-full flex-shrink-0" :style="{ backgroundColor: getSelectedPicklistOptionColor() }"></span>
              <span :class="['block truncate', !value && 'text-gray-500 dark:text-gray-500']">{{ getSelectedPicklistLabel() || (field.placeholder || `Select ${field.label || field.key}`) }}</span>
            </div>
            <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
              <ChevronUpDownIcon class="h-5 w-5 text-gray-400 dark:text-gray-500" aria-hidden="true" />
            </span>
          </ComboboxButton>

          <Transition
            leave-active-class="transition duration-100 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
            @after-enter="focusPicklistSearch"
            @enter="focusPicklistSearch"
          >
            <ComboboxOptions
              class="absolute z-10 mt-1 w-full overflow-hidden rounded-lg bg-white dark:bg-gray-700 text-base shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none sm:text-sm"
            >
              <!-- Search input inside dropdown -->
              <div class="p-2 border-b border-gray-200 dark:border-gray-600" @click.stop @mousedown.stop>
                <div class="relative">
                  <MagnifyingGlassIcon class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 pointer-events-none z-10" />
                  <input
                    ref="picklistSearchInput"
                    type="text"
                    v-model="picklistSearchQuery"
                    @keydown.enter.stop
                    @keydown.escape.stop
                    @click.stop
                    @mousedown.stop
                    placeholder="Search options..."
                    class="w-full pl-9 pr-3 py-2 text-sm rounded-md bg-gray-100 dark:bg-gray-700 outline-1 -outline-offset-1 outline-gray-300/20 dark:outline-white/10 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 dark:focus:outline-indigo-500 text-gray-900 dark:text-white placeholder:text-gray-500 relative z-10"
                    autocomplete="off"
                  />
                </div>
              </div>
              
              <!-- Options list (scrollable) -->
              <div class="max-h-60 overflow-auto py-1">
                <div v-if="filteredSearchablePicklistOptions.length === 0" class="relative cursor-default select-none px-4 py-2 text-gray-700 dark:text-gray-300">
                  No options found.
                </div>
                <ComboboxOption
                  v-for="(option, optIdx) in filteredSearchablePicklistOptions"
                  :key="optIdx"
                  :value="getPicklistOptionValue(option)"
                  v-slot="{ active, selected }"
                >
                  <li
                    :class="[
                      'relative cursor-default select-none py-2 pl-4 pr-10',
                      active ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-900 dark:text-brand-100' : 'text-gray-900 dark:text-gray-100'
                    ]"
                  >
                    <div class="flex items-center gap-2">
                      <span v-if="getPicklistOptionColor(option)" class="w-3 h-3 rounded-full flex-shrink-0" :style="{ backgroundColor: getPicklistOptionColor(option) }"></span>
                      <span :class="[selected ? 'font-medium' : 'font-normal', 'block truncate']">
                        {{ normalizePicklistOption(option) }}
                      </span>
                    </div>
                    <span
                      v-if="selected"
                      class="absolute inset-y-0 right-0 flex items-center pr-3 text-brand-600 dark:text-brand-400"
                    >
                      <CheckIcon class="h-5 w-5" aria-hidden="true" />
                    </span>
                  </li>
                </ComboboxOption>
              </div>
            </ComboboxOptions>
          </Transition>
        </div>
      </Combobox>
    </div>
    
    <!-- Radio Button (using Headless UI Listbox) -->
    <div v-else-if="field.dataType === 'Radio Button'" class="mt-2 relative">
      <Listbox :model-value="value || ''" @update:model-value="handleRadioChange" :disabled="isReadOnly">
        <div class="relative">
          <ListboxButton
            :class="[
              'block w-full rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500',
              'relative cursor-default text-left',
              isReadOnly
                ? 'opacity-50 cursor-not-allowed'
                : ''
            ]"
          >
            <span :class="['block truncate', !value && 'text-gray-500 dark:text-gray-500']">{{ getSelectedLabel() || (field.placeholder || `Select ${field.label || field.key}`) }}</span>
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
                v-for="(option, optIdx) in filteredPicklistOptions"
                :key="optIdx"
                :value="getPicklistOptionValue(option)"
                v-slot="{ active, selected }"
              >
                <li
                  :class="[
                    'relative cursor-default select-none py-2 pl-4 pr-10',
                    active ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-900 dark:text-brand-100' : 'text-gray-900 dark:text-gray-100'
                  ]"
                >
                  <div class="flex items-center gap-2">
                    <span v-if="getPicklistOptionColor(option)" class="w-3 h-3 rounded-full flex-shrink-0" :style="{ backgroundColor: getPicklistOptionColor(option) }"></span>
                    <span :class="[selected ? 'font-medium' : 'font-normal', 'block truncate']">
                      {{ normalizePicklistOption(option) }}
                    </span>
                  </div>
                  <span
                    v-if="selected"
                    class="absolute inset-y-0 right-0 flex items-center pr-3 text-brand-600 dark:text-brand-400"
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
    <div v-else-if="field.dataType === 'Multi-Picklist'" class="mt-2 relative">
      <div
        :class="[
          'w-full rounded-md transition-all text-base sm:text-sm/6',
          isReadOnly
            ? 'bg-gray-100 dark:bg-gray-700 opacity-50 cursor-not-allowed'
            : 'bg-gray-100 dark:bg-gray-700 cursor-pointer focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-indigo-500 dark:focus:bg-gray-800 dark:outline-white/10',
          showMultiOptions ? 'outline-2 -outline-offset-2 outline-indigo-500 dark:outline-indigo-500' : ''
        ]"
        @click.stop="!isReadOnly && (showMultiOptions = !showMultiOptions)"
      >
        <!-- Selected tags and placeholder -->
        <div class="flex flex-wrap items-center gap-2 px-3 py-2">
          <template v-if="selectedMultiValues.length > 0">
            <span
              v-for="(selected, selIdx) in selectedMultiValues"
              :key="selIdx"
              class="inline-flex items-center gap-1.5 rounded-full bg-brand-100 dark:bg-brand-900/40 px-3 py-1 text-sm font-medium text-brand-800 dark:text-brand-200"
            >
              <span v-if="getSelectedOptionColor(selected)" class="w-2.5 h-2.5 rounded-full flex-shrink-0" :style="{ backgroundColor: getSelectedOptionColor(selected) }"></span>
              <span>{{ normalizeMultiValue(selected) }}</span>
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
            class="text-gray-500 dark:text-gray-500 text-base sm:text-sm/6 px-2"
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
          v-click-outside="() => { showMultiOptions = false; emit('blur'); }"
          @click.stop
          class="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black/5 dark:ring-white/10 max-h-60 overflow-auto"
        >
          <div class="py-1">
            <button
              v-for="(option, optIdx) in filteredPicklistOptions"
              :key="optIdx"
              type="button"
              @click.stop="toggleMultiSelect(option)"
              :class="[
                'w-full text-left px-4 py-2 text-sm transition-colors',
                isMultiValueSelected(option)
                  ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-900 dark:text-brand-100 font-medium'
                  : 'text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700'
              ]"
            >
              <div class="flex items-center gap-2">
                <div
                  :class="[
                    'flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors',
                    isMultiValueSelected(option)
                      ? 'bg-brand-600 dark:bg-brand-500 border-brand-600 dark:border-brand-500'
                      : 'border-gray-300 dark:border-gray-600'
                  ]"
                >
                  <CheckSolidIcon v-if="isMultiValueSelected(option)" class="w-3 h-3 text-white" />
                </div>
                <span v-if="getPicklistOptionColor(option)" class="w-3 h-3 rounded-full flex-shrink-0" :style="{ backgroundColor: getPicklistOptionColor(option) }"></span>
                <span>{{ normalizePicklistOption(option) }}</span>
              </div>
            </button>
            <div
              v-if="filteredPicklistOptions.length === 0"
              class="px-4 py-2 text-sm text-gray-500 dark:text-gray-400"
            >
              No options available
            </div>
          </div>
        </div>
      </Transition>
    </div>
    
    <!-- Checkbox -->
    <div v-else-if="field.dataType === 'Checkbox'" class="mt-2 flex items-center space-x-2">
      <input 
        :id="field.key"
        :name="field.key"
        type="checkbox"
        :checked="value"
        @change="updateValue($event.target.checked)"
        @blur="$emit('blur')"
        :required="isRequired"
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
    
    <!-- Lookup (Relationship) - with searchable Combobox and modal browse button -->
    <div v-else-if="field.dataType === 'Lookup (Relationship)'" class="mt-2 relative">
      <Combobox :model-value="normalizedLookupValue || ''" @update:model-value="handleLookupChange" :disabled="isReadOnly" nullable>
        <div class="relative">
          <ComboboxButton
            @click="handleLookupButtonClick"
            :class="[
              'block w-full rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500',
              'relative cursor-default text-left',
              isReadOnly
                ? 'opacity-50 cursor-not-allowed'
                : '',
              localValidationError || errors[field.key]
                ? 'border-red-500 dark:border-red-500'
                : ''
            ]"
          >
            <!-- Show selected user with avatar/initial for assignedTo -->
            <div v-if="isAssignedToField && value && getSelectedLookupOption()" class="flex items-center gap-2">
              <Avatar :user="getSelectedLookupOption()" size="sm" />
              <span class="block truncate">{{ getLookupSelectedLabel() }}</span>
            </div>
            <!-- Default placeholder or non-user lookup -->
            <span v-else :class="['block truncate', !value && 'text-gray-500 dark:text-gray-500']">{{ getLookupSelectedLabel() || (field.placeholder || `Select ${field.label || field.key}`) }}</span>
            <!-- Modal browse button -->
            <button
              type="button"
              @click.stop="openLookupModal"
              :disabled="isReadOnly"
              class="absolute inset-y-0 right-8 flex items-center justify-center px-2 w-8 text-gray-400 dark:text-gray-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed z-10"
              title="Browse records"
            >
              <MagnifyingGlassIcon class="w-5 h-5" />
            </button>
            <!-- Dropdown arrow -->
            <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
              <ChevronUpDownIcon class="h-5 w-5 text-gray-400 dark:text-gray-500" aria-hidden="true" />
            </span>
          </ComboboxButton>

          <Transition
            leave-active-class="transition duration-100 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
            @after-enter="focusLookupSearch"
            @enter="focusLookupSearch"
          >
            <ComboboxOptions
              class="absolute z-10 mt-1 w-full overflow-hidden rounded-lg bg-white dark:bg-gray-700 text-base shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none sm:text-sm"
            >
              <!-- Search input inside dropdown -->
              <div class="p-2 border-b border-gray-200 dark:border-gray-600" @click.stop @mousedown.stop>
                <div class="relative">
                  <MagnifyingGlassIcon class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 pointer-events-none z-10" />
                  <input
                    ref="lookupSearchInput"
                    type="text"
                    v-model="lookupSearchQuery"
                    @keydown.enter.stop
                    @keydown.escape.stop
                    @click.stop
                    @mousedown.stop
                    placeholder="Search records..."
                    class="w-full pl-9 pr-3 py-2 text-sm rounded-md bg-gray-100 dark:bg-gray-700 outline-1 -outline-offset-1 outline-gray-300/20 dark:outline-white/10 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 dark:focus:outline-indigo-500 text-gray-900 dark:text-white placeholder:text-gray-500 relative z-10"
                    autocomplete="off"
                  />
                </div>
              </div>
              
              <!-- Options list (scrollable) -->
              <div class="max-h-60 overflow-auto py-1">
                <div v-if="filteredSearchableLookupOptions.length === 0" class="relative cursor-default select-none px-4 py-2 text-gray-700 dark:text-gray-300">
                  No records found.
                </div>
                <ComboboxOption
                  v-for="item in filteredSearchableLookupOptions"
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
                      <Avatar :user="item" size="md" />
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
                </ComboboxOption>
              </div>
            </ComboboxOptions>
          </Transition>
        </div>
      </Combobox>
      
      <!-- Lookup Modal -->
      <Teleport to="body">
        <Transition name="modal">
          <div
            v-if="showLookupModal"
            class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
            @click.self="closeLookupModal"
          >
            <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-6xl mx-4 max-h-[90vh] flex flex-col">
              <!-- Modal Header -->
              <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <div>
                  <h3 class="text-xl font-semibold text-gray-900 dark:text-white">Select Record</h3>
                  <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">{{ getLookupModuleName() }}</p>
                </div>
                <button
                  @click="closeLookupModal"
                  class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <XMarkIcon class="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              <!-- Modal Body with DataTable -->
              <div class="flex-1 overflow-hidden p-6">
                <DataTable
                  :data="lookupModalData"
                  :columns="lookupModalColumns"
                  :loading="lookupModalLoading"
                  :paginated="true"
                  :per-page="20"
                  :total-records="lookupModalTotal"
                  :server-side="true"
                  :selectable="false"
                  table-id="lookup-modal-table"
                  @row-click="handleLookupRowClick"
                  @page-change="handleLookupPageChange"
                  @search="handleLookupSearch"
                  @sort="handleLookupSort"
                >
                  <!-- Custom display field rendering -->
                  <template v-if="isAssignedToField" #name="{ row }">
                    <div class="flex items-center gap-3">
                      <Avatar :user="row" size="md" />
                      <span class="font-medium text-gray-900 dark:text-white">{{ getUserDisplayName(row) }}</span>
                    </div>
                  </template>
                </DataTable>
              </div>

              <!-- Modal Footer -->
              <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  @click="closeLookupModal"
                  class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>
    </div>
    
    <!-- URL -->
    <input 
      v-else-if="field.dataType === 'URL'"
      :id="field.key"
      :name="field.key"
      type="url"
      :value="value"
      @input="updateValue($event.target.value)"
      @blur="$emit('blur')"
      @keydown.enter="$event.target.blur()"
      :placeholder="field.placeholder || `https://example.com`"
      :required="isRequired"
      :disabled="isReadOnly"
      class="block w-full mt-2 rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white text-base outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
    />
    
    <!-- Auto-Number, Formula, Rollup Summary (Read-only display) -->
    <input 
      v-else-if="['Auto-Number', 'Formula', 'Rollup Summary'].includes(field.dataType)"
      :id="field.key"
      :name="field.key"
      type="text"
      :value="value || field.defaultValue || '(Auto-generated)'"
      disabled
      class="block w-full mt-2 rounded-md bg-gray-100 dark:bg-gray-800 px-3 py-2 text-gray-500 dark:text-gray-400 text-base outline-1 -outline-offset-1 outline-gray-300/20 sm:text-sm/6 cursor-not-allowed"
    />
    
    <!-- Error message (render dynamically only when present) -->
    <p v-if="localValidationError || errors[field.key]" class="mt-1 text-sm text-red-600 dark:text-red-400">
      {{ localValidationError || errors[field.key] }}
    </p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { Listbox, ListboxButton, ListboxOptions, ListboxOption, Combobox, ComboboxButton, ComboboxInput, ComboboxOptions, ComboboxOption } from '@headlessui/vue';
import { CheckIcon, ChevronUpDownIcon, XMarkIcon, MagnifyingGlassIcon } from '@heroicons/vue/24/outline';
import { CheckIcon as CheckSolidIcon } from '@heroicons/vue/24/solid';
import { Teleport, Transition } from 'vue';
import DataTable from '@/components/common/DataTable.vue';
import Avatar from '@/components/common/Avatar.vue';
import apiClient from '@/utils/apiClient';
import { validateField } from '@/utils/fieldValidation';
import { useAuthStore } from '@/stores/auth';

// Note: Headless UI Listbox is still used for Lookup (Relationship) fields and Radio Button
// Picklist uses native HTML select styled with Tailwind
// Multi-Picklist uses a custom tag-based dropdown component

// Click outside directive for multi-select dropdown
const vClickOutside = {
  mounted(el, binding) {
    el.clickOutsideEvent = (event) => {
      // Use setTimeout to ensure this runs after any click handlers that might toggle visibility
      // This allows Vue to update the DOM before we check if the element should be closed
      setTimeout(() => {
        // Check if element is still mounted
        if (!document.contains(el)) return;
        
        // Check if click was outside the element and its parent container
        // The parent container includes both the dropdown and the trigger button
        const container = el.closest('.relative');
        if (!container) return;
        
        if (!(container === event.target || container.contains(event.target))) {
          binding.value(event);
        }
      }, 10);
    };
    // Use normal bubbling phase but with a delay to allow state updates
    document.addEventListener('click', el.clickOutsideEvent);
  },
  unmounted(el) {
    if (el.clickOutsideEvent) {
      document.removeEventListener('click', el.clickOutsideEvent);
    }
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
  },
  dependencyState: {
    type: Object,
    default: () => ({
      readonly: false,
      required: false,
      allowedOptions: null
    })
  }
});

const emit = defineEmits(['update:value', 'validation-error', 'blur']);

const authStore = useAuthStore();
const lookupOptions = ref([]);
const isLoadingUsers = ref(false);
const showMultiOptions = ref(false);

// Search queries for Combobox components
const picklistSearchQuery = ref('');
const lookupSearchQuery = ref('');

// Refs for search inputs to auto-focus
const picklistSearchInput = ref(null);
const lookupSearchInput = ref(null);

// Lookup modal state
const showLookupModal = ref(false);
const lookupModalData = ref([]);
const lookupModalLoading = ref(false);
const lookupModalTotal = ref(0);
const lookupModalColumns = ref([]);
const lookupModalCurrentPage = ref(1);
const lookupModalSearchQuery = ref('');
const lookupModalSortBy = ref('');
const lookupModalSortOrder = ref('asc');
const isReadOnly = computed(() => {
  // Check if field is read-only by type
  if (['Auto-Number', 'Formula', 'Rollup Summary'].includes(props.field.dataType)) return true;
  // System fields that should be visible but not editable (createdBy, organizationid)
  const readonlySystemFields = ['createdby', 'organizationid'];
  if (readonlySystemFields.includes((props.field.key || '').toLowerCase())) return true;
  // Check if dependency makes it read-only
  return props.dependencyState?.readonly || false;
});

const isRequired = computed(() => {
  // Use dependency state required if available, otherwise use field.required
  return props.dependencyState?.required ?? props.field.required ?? false;
});

// Get filtered picklist options based on dependency
const filteredPicklistOptions = computed(() => {
  if (props.field.dataType !== 'Picklist' && props.field.dataType !== 'Multi-Picklist') {
    return props.field.options || [];
  }
  
  const allowedOptions = props.dependencyState?.allowedOptions;
  if (!allowedOptions || !Array.isArray(allowedOptions) || allowedOptions.length === 0) {
    // No dependency filter - show all options
    return props.field.options || [];
  }
  
  // Normalize allowedOptions to strings for comparison
  const normalizedAllowed = allowedOptions.map(opt => String(opt || ''));
  
  // Filter options to only show allowed ones
  const filtered = (props.field.options || []).filter(option => {
    const optionValue = String(getPicklistOptionValue(option) || '');
    return normalizedAllowed.includes(optionValue);
  });
  
  if (filtered.length === 0 && normalizedAllowed.length > 0) {
    console.warn('⚠️ No picklist options matched dependency filter:', {
      fieldKey: props.field.key,
      allowedOptions: normalizedAllowed,
      allOptions: (props.field.options || []).map(opt => getPicklistOptionValue(opt))
    });
  }
  
  return filtered;
});

// Get searchable filtered picklist options (with search query filtering)
const filteredSearchablePicklistOptions = computed(() => {
  const baseOptions = filteredPicklistOptions.value;
  
  if (!picklistSearchQuery.value) {
    return baseOptions;
  }
  
  const query = picklistSearchQuery.value.toLowerCase();
  return baseOptions.filter(option => {
    const optionText = normalizePicklistOption(option).toLowerCase();
    return optionText.includes(query);
  });
});

// Get searchable filtered lookup options
const filteredSearchableLookupOptions = computed(() => {
  if (!lookupSearchQuery.value) {
    return lookupOptions.value;
  }
  
  const query = lookupSearchQuery.value.toLowerCase();
  return lookupOptions.value.filter(item => {
    const displayText = getLookupDisplay(item).toLowerCase();
    return displayText.includes(query);
  });
});

// Real-time validation
const localValidationError = ref(null);

// Validate field value
const validateValue = (val) => {
  if (!props.field.validations || !Array.isArray(props.field.validations) || props.field.validations.length === 0) {
    localValidationError.value = null;
    emit('validation-error', props.field.key, null);
    return;
  }

  // Skip validation for empty values unless required
  if ((val === null || val === undefined || val === '') && !props.field.required) {
    localValidationError.value = null;
    emit('validation-error', props.field.key, null);
    return;
  }

  const result = validateField(val, props.field.validations);
  localValidationError.value = result.error;
  emit('validation-error', props.field.key, result.error);
};

// Watch value changes for validation
watch(() => props.value, (newValue) => {
  validateValue(newValue);
}, { immediate: true });

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
  // Validate immediately on input
  validateValue(newValue);
  // Clear search queries when value is selected
  picklistSearchQuery.value = '';
  lookupSearchQuery.value = '';
};

// Handler for picklist changes (emits blur immediately since selection is complete)
const handlePicklistChange = (newValue) => {
  updateValue(newValue);
  // Emit blur immediately after selection for dropdown fields
  emit('blur');
};

// Handler for radio button changes (emits blur immediately since selection is complete)
const handleRadioChange = (newValue) => {
  updateValue(newValue);
  // Emit blur immediately after selection for radio buttons
  emit('blur');
};

// Handler for lookup changes (emits blur immediately since selection is complete)
const handleLookupChange = (newValue) => {
  updateValue(newValue);
  // Emit blur immediately after selection for lookup fields
  emit('blur');
};

// Focus functions for auto-focusing search inputs when Combobox opens
const focusPicklistSearch = () => {
  // Multiple attempts to ensure focus works
  const attemptFocus = (delay = 0) => {
    window.setTimeout(() => {
      if (picklistSearchInput.value) {
        try {
          picklistSearchInput.value.focus();
          picklistSearchInput.value.select();
        } catch (e) {
          console.warn('Failed to focus picklist search:', e);
        }
      } else if (delay < 200) {
        // Retry if element not ready yet
        attemptFocus(delay + 50);
      }
    }, delay);
  };
  
  nextTick(() => {
    attemptFocus(0);
  });
};

const focusLookupSearch = () => {
  // Multiple attempts to ensure focus works
  const attemptFocus = (delay = 0) => {
    window.setTimeout(() => {
      if (lookupSearchInput.value) {
        try {
          lookupSearchInput.value.focus();
          lookupSearchInput.value.select();
        } catch (e) {
          console.warn('Failed to focus lookup search:', e);
        }
      } else if (delay < 200) {
        // Retry if element not ready yet
        attemptFocus(delay + 50);
      }
    }, delay);
  };
  
  nextTick(() => {
    attemptFocus(0);
  });
};

// Handler functions for button clicks (to avoid setTimeout in template)
const handlePicklistButtonClick = () => {
  window.setTimeout(() => {
    focusPicklistSearch();
  }, 100);
};

const handleLookupButtonClick = () => {
  window.setTimeout(() => {
    focusLookupSearch();
  }, 100);
};

// Helper function to normalize picklist option (handle both strings and objects)
const normalizePicklistOption = (option) => {
  if (typeof option === 'string') return option;
  if (typeof option === 'object' && option !== null) {
    return option.value || option.label || String(option);
  }
  return String(option);
};

// Helper function to get picklist option value for comparison
const getPicklistOptionValue = (option) => {
  if (typeof option === 'string') return option;
  if (typeof option === 'object' && option !== null) {
    return option.value || option.label || String(option);
  }
  return String(option);
};

// Helper function to get picklist option color if available
const getPicklistOptionColor = (option) => {
  if (typeof option === 'object' && option !== null && option.color) {
    return option.color;
  }
  return null;
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
  const optionValue = getPicklistOptionValue(option);
  
  // Find index by comparing values
  const index = current.findIndex(selected => {
    const selectedValue = getPicklistOptionValue(selected);
    return selectedValue === optionValue || String(selectedValue) === String(optionValue);
  });
  
  if (index > -1) {
    // Remove if already selected
    current.splice(index, 1);
  } else {
    // Add if not selected - store the normalized value (string) for consistency
    current.push(optionValue);
  }
  
  emit('update:value', current);
  // Note: blur will be emitted when dropdown closes (v-click-outside)
};

const getMultiSelectDisplayText = () => {
  const selected = selectedMultiValues.value;
  if (selected.length === 0) return '';
  if (selected.length === 1) return selected[0];
  return `${selected.length} selected`;
};

const removeMultiSelect = (option) => {
  const current = [...selectedMultiValues.value];
  const optionValue = getPicklistOptionValue(option);
  
  // Find index by comparing values
  const index = current.findIndex(selected => {
    const selectedValue = getPicklistOptionValue(selected);
    return selectedValue === optionValue || String(selectedValue) === String(optionValue);
  });
  
  if (index > -1) {
    current.splice(index, 1);
    emit('update:value', current);
    // Emit blur immediately for tag removal (user interaction is complete)
    emit('blur');
  }
};

// Single select helpers
const getSelectedLabel = () => {
  if (!props.value) return '';
  // Use filtered options if available, otherwise use all options
  const optionsToSearch = props.field.dataType === 'Picklist' || props.field.dataType === 'Multi-Picklist' 
    ? filteredPicklistOptions.value 
    : (props.field.options || []);
  const option = optionsToSearch.find(opt => {
    const optValue = getPicklistOptionValue(opt);
    return optValue === props.value || optValue === String(props.value);
  });
  if (option) {
    return normalizePicklistOption(option);
  }
  return props.value;
};

// Get selected picklist label
const getSelectedPicklistLabel = () => {
  return getSelectedLabel();
};

// Get selected picklist option color
const getSelectedPicklistOptionColor = () => {
  if (!props.value) return null;
  const optionsToSearch = filteredPicklistOptions.value.length > 0 
    ? filteredPicklistOptions.value 
    : (props.field.options || []);
  const option = optionsToSearch.find(opt => {
    const optValue = getPicklistOptionValue(opt);
    return optValue === props.value || optValue === String(props.value);
  });
  return getPicklistOptionColor(option);
};

// Helper to get color for a selected multi-value
const getSelectedOptionColor = (value) => {
  const optionsToSearch = props.field.dataType === 'Multi-Picklist' 
    ? filteredPicklistOptions.value 
    : (props.field.options || []);
  const option = optionsToSearch.find(opt => {
    const optValue = getPicklistOptionValue(opt);
    return optValue === value || optValue === String(value);
  });
  return getPicklistOptionColor(option);
};

// Helper to normalize multi-value display
const normalizeMultiValue = (value) => {
  const optionsToSearch = props.field.dataType === 'Multi-Picklist' 
    ? filteredPicklistOptions.value 
    : (props.field.options || []);
  const option = optionsToSearch.find(opt => {
    const optValue = getPicklistOptionValue(opt);
    return optValue === value || optValue === String(value);
  });
  if (option) {
    return normalizePicklistOption(option);
  }
  return String(value);
};

// Check if a multi-value option is selected
const isMultiValueSelected = (option) => {
  const optionValue = getPicklistOptionValue(option);
  return selectedMultiValues.value.some(selected => {
    const selectedValue = getPicklistOptionValue(selected);
    return selectedValue === optionValue || String(selectedValue) === String(optionValue);
  });
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

// Normalize value - handle both ID strings and populated objects
const normalizedLookupValue = computed(() => {
  if (!props.value) return null;
  // If value is an object (populated), extract the ID
  if (typeof props.value === 'object' && props.value._id) {
    return props.value._id;
  }
  // If it's already an ID, return as is
  return props.value;
});

// Get the populated object if value is an object, otherwise find it in options
const getSelectedLookupOption = () => {
  if (!props.value) return null;
  
  // If value is a populated object (has _id and other properties), return it directly
  if (typeof props.value === 'object' && props.value._id && Object.keys(props.value).length > 1) {
    return props.value;
  }
  
  // Otherwise, find it in lookupOptions
  if (!lookupOptions.value.length) return null;
  const valueId = normalizedLookupValue.value;
  return lookupOptions.value.find(opt => opt._id === valueId || opt._id?.toString() === valueId?.toString());
};

const getLookupSelectedLabel = () => {
  if (!props.value) return '';
  const selected = getSelectedLookupOption();
  if (selected) {
    return getLookupDisplay(selected);
  }
  // Fallback: if value is an object, try to display it
  if (typeof props.value === 'object' && props.value._id) {
    if (isAssignedToField.value) {
      return getUserDisplayName(props.value);
    }
    return props.value.name || props.value.title || props.value._id;
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
      
      // Set default value to logged-in user if no value exists
      if (!props.value && authStore.user?._id) {
        // Check if the logged-in user is in the options list
        const currentUser = response.data.find(u => u._id === authStore.user._id || u._id?.toString() === authStore.user._id?.toString());
        if (currentUser) {
          emit('update:value', currentUser._id);
        }
      }
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
  
  if (!props.field.lookupSettings?.targetModule) {
    console.warn('Lookup field missing targetModule:', props.field.key, props.field);
    return;
  }
  
  try {
    const moduleKey = props.field.lookupSettings.targetModule;
    console.log('Fetching lookup options for module:', moduleKey, 'field:', props.field.key);
    
    // Handle special module key mappings
    let endpoint = `/${moduleKey}`;
    if (moduleKey === 'organization' || moduleKey === 'organizations') {
      // Try v2 endpoint first, fallback to v1
      endpoint = '/v2/organization';
    }
    
    const response = await apiClient.get(endpoint, { params: { limit: 1000 } });
    
    console.log('Lookup response for', moduleKey, ':', response);
    
    if (response.success) {
      if (Array.isArray(response.data)) {
        lookupOptions.value = response.data;
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        lookupOptions.value = response.data.data;
        // Also check for pagination info
        if (response.data.total) {
          // If there are more records, we might want to fetch all or handle pagination
          console.log('Total records:', response.data.total, 'Loaded:', response.data.data.length);
        }
      } else if (Array.isArray(response.data)) {
        lookupOptions.value = response.data;
      }
      
      console.log('Loaded lookup options:', lookupOptions.value.length, 'for', props.field.key);
    } else {
      console.warn('Lookup fetch unsuccessful:', response);
      lookupOptions.value = [];
    }
  } catch (error) {
    console.error('Error fetching lookup options for', props.field.key, ':', error);
    lookupOptions.value = [];
  }
};

// Get lookup module name for modal header
const getLookupModuleName = () => {
  if (isAssignedToField.value) {
    return 'Users';
  }
  if (props.field.lookupSettings?.targetModule) {
    const moduleKey = props.field.lookupSettings.targetModule;
    // Capitalize first letter and add 's' if needed
    return moduleKey.charAt(0).toUpperCase() + moduleKey.slice(1);
  }
  return 'Records';
};

// Open lookup modal
const openLookupModal = async () => {
  if (isReadOnly.value) return;
  showLookupModal.value = true;
  await fetchLookupModalData();
};

// Close lookup modal
const closeLookupModal = () => {
  showLookupModal.value = false;
  lookupModalData.value = [];
  lookupModalCurrentPage.value = 1;
  lookupModalSearchQuery.value = '';
  lookupModalSortBy.value = '';
  lookupModalSortOrder.value = 'asc';
};

// Fetch data for lookup modal
const fetchLookupModalData = async () => {
  lookupModalLoading.value = true;
  try {
    let endpoint = '';
    let params = {
      page: lookupModalCurrentPage.value,
      limit: 20
    };
    
    if (lookupModalSearchQuery.value) {
      params.search = lookupModalSearchQuery.value;
    }
    
    if (lookupModalSortBy.value) {
      params.sortBy = lookupModalSortBy.value;
      params.sortOrder = lookupModalSortOrder.value;
    }
    
    if (isAssignedToField.value) {
      endpoint = '/users/list';
    } else if (props.field.lookupSettings?.targetModule) {
      const moduleKey = props.field.lookupSettings.targetModule;
      // Handle special module key mappings
      if (moduleKey === 'organization' || moduleKey === 'organizations') {
        endpoint = '/v2/organization';
      } else {
        endpoint = `/${moduleKey}`;
      }
    } else {
      lookupModalLoading.value = false;
      return;
    }
    
    const response = await apiClient.get(endpoint, { params });
    
    if (response.success) {
      let data = [];
      if (Array.isArray(response.data)) {
        data = response.data;
        lookupModalTotal.value = response.data.length;
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        data = response.data.data;
        lookupModalTotal.value = response.data.total || response.data.data.length;
      }
      
      lookupModalData.value = data;
      
      // Generate columns if not already set
      if (lookupModalColumns.value.length === 0) {
        lookupModalColumns.value = generateLookupModalColumns();
      }
    }
  } catch (error) {
    console.error('Error fetching lookup modal data:', error);
    lookupModalData.value = [];
  } finally {
    lookupModalLoading.value = false;
  }
};

// Generate columns for lookup modal
const generateLookupModalColumns = () => {
  if (isAssignedToField.value) {
    return [
      { key: 'name', label: 'Name', sortable: true },
      { key: 'email', label: 'Email', sortable: true }
    ];
  }
  
  // Try to get module definition to generate proper columns
  // For now, use common fields or displayField
  const displayField = props.field.lookupSettings?.displayField || 'name';
  const columns = [
    { key: displayField, label: displayField.charAt(0).toUpperCase() + displayField.slice(1).replace(/_/g, ' '), sortable: true }
  ];
  
  // Add common fields
  const commonFields = ['email', 'phone', 'status', 'type'];
  commonFields.forEach(field => {
    if (field !== displayField) {
      columns.push({ key: field, label: field.charAt(0).toUpperCase() + field.slice(1), sortable: true });
    }
  });
  
  return columns;
};

// Handle row click in lookup modal
const handleLookupRowClick = (row) => {
  updateValue(row._id);
  closeLookupModal();
};

// Handle pagination in lookup modal
const handleLookupPageChange = (page) => {
  lookupModalCurrentPage.value = page;
  fetchLookupModalData();
};

// Handle search in lookup modal
const handleLookupSearch = (query) => {
  lookupModalSearchQuery.value = query;
  lookupModalCurrentPage.value = 1;
  fetchLookupModalData();
};

// Handle sort in lookup modal
const handleLookupSort = (sortBy, sortOrder) => {
  lookupModalSortBy.value = sortBy;
  lookupModalSortOrder.value = sortOrder;
  fetchLookupModalData();
};

// Handle populated object values - add them to lookupOptions if needed
const handlePopulatedValue = () => {
  if (props.field.dataType !== 'Lookup (Relationship)') return;
  if (!props.value || typeof props.value !== 'object' || !props.value._id) return;
  
  // Check if this populated object is already in lookupOptions
  const exists = lookupOptions.value.some(opt => 
    opt._id === props.value._id || opt._id?.toString() === props.value._id?.toString()
  );
  
  // If not found and it's a populated object (has more than just _id), add it
  if (!exists && Object.keys(props.value).length > 1) {
    lookupOptions.value = [...lookupOptions.value, props.value];
  }
};

// Watch for field changes to refetch lookup options
watch(() => props.field, async (newField, oldField) => {
  // If targetModule changed, refetch
  if (newField?.dataType === 'Lookup (Relationship)') {
    const newTargetModule = newField?.lookupSettings?.targetModule;
    const oldTargetModule = oldField?.lookupSettings?.targetModule;
    if (newTargetModule !== oldTargetModule || !lookupOptions.value.length) {
      await fetchLookupOptions();
      handlePopulatedValue();
    }
  }
}, { deep: true, immediate: false });

// Watch for value changes to handle populated objects
watch(() => props.value, () => {
  if (props.field.dataType === 'Lookup (Relationship)') {
    handlePopulatedValue();
  }
}, { deep: true, immediate: true });

onMounted(async () => {
  // Fetch lookup options immediately when component mounts
  if (props.field.dataType === 'Lookup (Relationship)') {
    await fetchLookupOptions();
    // Handle populated object value after fetching options
    handlePopulatedValue();
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

<style scoped>
/* Modal transition animations */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .bg-white,
.modal-leave-active .bg-white {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.modal-enter-from .bg-white,
.modal-leave-to .bg-white {
  opacity: 0;
  transform: scale(0.95);
}
</style>

