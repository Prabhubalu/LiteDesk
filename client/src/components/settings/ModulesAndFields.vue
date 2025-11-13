<template>
  <div class="p-6 h-full flex flex-col overflow-hidden">
    <div class="mb-4 flex items-center justify-between gap-3">
      <template v-if="selectedModuleId">
        <div class="flex items-center gap-3">
          <button @click="clearSelection" class="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5" title="Back to modules">
            <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M12.78 15.22a.75.75 0 01-1.06 0l-4.5-4.5a.75.75 0 010-1.06l4.5-4.5a.75.75 0 111.06 1.06L8.56 10l4.22 4.22a.75.75 0 010 1.06z" clip-rule="evenodd"/></svg>
          </button>
          <div>
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ selectedModule?.name }}</h2>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">Configure fields, relationships and quick create</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button @click="openCreateModal" class="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Create Module
          </button>
        </div>
      </template>
      <template v-else>
        <div>
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Modules &amp; Fields</h2>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">Manage modules and configure fields</p>
        </div>
        <button @click="openCreateModal" class="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Create Module
        </button>
      </template>
    </div>

    <!-- If no module selected: show previous grid listing -->
    <div v-if="!selectedModuleId" class="flex-1 overflow-y-auto">
      <div v-if="loading" class="flex items-center justify-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
      </div>
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div v-for="mod in displayModules" :key="mod._id" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 cursor-pointer" @click="selectModule(mod)">
          <div class="flex items-start justify-between">
            <div>
              <p
                :class="[
                  'text-xs uppercase tracking-wider',
                  mod.type === 'system'
                    ? 'text-purple-600 dark:text-purple-300'
                    : 'text-gray-500 dark:text-gray-400'
                ]"
              >
                {{ mod.type }}
              </p>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ mod.name }}</h3>
              <p class="text-sm text-gray-500 dark:text-gray-400">key: {{ mod.key }}</p>
            </div>
            <button v-if="mod.type === 'custom'" @click.stop="deleteModule(mod)" class="text-red-600 dark:text-red-400 text-sm hover:underline">Delete</button>
          </div>
          <div class="mt-3">
            <p class="text-xs text-gray-500 dark:text-gray-400">Fields: {{ mod.fieldCount ?? (mod.fields?.length || 0) }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- If module selected: configuration area with top tabs -->
    <div v-else class="flex-1 overflow-hidden flex flex-col gap-4">
      <!-- Top tabs: Module details, Field Configurations, Relationship, Quick Create -->
      <div class="px-2">
        <div class="border-b border-gray-200 dark:border-gray-700">
          <nav class="-mb-px flex space-x-6">
            <button
              v-for="tab in topTabs"
              :key="tab.id"
              @click="activeTopTab = tab.id"
              :class="[
                activeTopTab === tab.id
                  ? 'border-brand-600 text-brand-600 dark:text-brand-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600',
                'whitespace-nowrap py-3 px-1 border-b-2 text-sm font-medium'
              ]"
            >
              {{ tab.name }}
            </button>
          </nav>
        </div>
        <div class="flex items-center justify-between py-3">
          <div class="text-sm text-gray-500 dark:text-gray-400">
            <span v-if="activeTopTab === 'pipeline'">Manage pipeline stages, order, and statuses.</span>
            <span v-else-if="activeTopTab === 'playbooks'">Configure playbooks for each pipeline stage.</span>
          </div>
        </div>
      </div>

      <!-- Fields configuration: two-panel layout -->
      <div v-if="activeTopTab === 'fields'" class="flex-1 overflow-hidden flex gap-4">
      <!-- Left: Fields list -->
      <aside class="w-96 flex-none bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
        <div class="p-3 border-b border-gray-200 dark:border-white/10 flex items-center justify-between gap-2">
          <div class="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate flex-1 min-w-0">{{ selectedModule?.name }}</div>
          <button 
            v-if="selectedModule" 
            @click="openAddField" 
            class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-xs font-medium transition-colors flex-shrink-0 whitespace-nowrap"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            <span>Add Custom Field</span>
          </button>
        </div>
        <div class="p-2 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
          <div class="text-xs text-gray-500 dark:text-gray-400">Fields</div>
        </div>
        <div class="p-2 border-b border-gray-200 dark:border-white/10 space-y-2">
          <input v-model="fieldSearch" placeholder="Search fields" class="w-full px-2 py-1 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs" />
          <!-- Show Tenant Fields Toggle (only for organizations module) -->
          <label v-if="selectedModule?.key === 'organizations'" class="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
            <input 
              type="checkbox" 
              v-model="showTenantFields" 
              class="rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500"
            />
            <span>Show Tenant Fields</span>
          </label>
        </div>
        <div class="flex-1 overflow-y-auto p-2">
          <ul class="space-y-1">
            <li
              v-for="(f, idx) in filteredFields"
              :key="f.key || idx"
              class="group"
              :draggable="!isSystemField(f)"
              @dragstart="onDragStart(idx)"
              @dragover.prevent="onDragOver(idx)"
              @drop.prevent="onDrop(idx)"
            >
              <div :class="[
                    'w-full px-3 py-2 rounded-lg text-sm flex items-center justify-between gap-2',
                    selectedFieldIdx === idx ? 'bg-gray-100 dark:bg-white/5 text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5',
                    dragOverIdx === idx ? 'ring-2 ring-brand-500 dark:ring-brand-400' : '',
                    isSystemField(f) ? 'opacity-75' : ''
                  ]">
                <div v-if="!isSystemField(f)" class="cursor-grab select-none mr-2 text-gray-400 dark:text-gray-500">⋮⋮</div>
                <div v-else class="mr-2 text-xs text-purple-600 dark:text-purple-400" title="System field">🔒</div>
                <button class="flex-1 text-left truncate" @click="selectField(idx)">{{ f.label || f.key || 'Untitled field' }}</button>
                <span class="text-xs text-gray-500 dark:text-gray-400">{{ f.dataType }}</span>
              </div>
            </li>
          </ul>
        </div>
      </aside>

      <!-- Right: Field configuration -->
      <section class="flex-1 min-w-0 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
        <div class="p-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
          <div>
            <div class="flex items-center gap-2">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ currentFieldTitle }}</h3>
              <span v-if="isSystemField(currentField)" class="px-2 py-0.5 text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">System</span>
              <span v-else-if="isCoreField(currentField, selectedModule?.key)" class="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">Core</span>
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400">Module: {{ selectedModule?.name }} • Key: {{ selectedModule?.key }}</p>
            <p v-if="isSystemField(currentField)" class="mt-1 text-xs text-amber-600 dark:text-amber-400">This is a system field and cannot be modified</p>
            <p v-else-if="isCoreField(currentField, selectedModule?.key)" class="mt-1 text-xs text-amber-600 dark:text-amber-400">This is a core field and cannot be deleted</p>
          </div>
          <div class="flex items-center gap-2">
            <button v-if="selectedModule && isDirty" @click="saveModule" class="px-3 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium">Save changes</button>
            <button v-if="currentField && canDeleteField" @click="removeField(selectedFieldIdx)" class="px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm font-medium">Delete Field</button>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto p-4" v-if="selectedModule">
          <div v-if="currentField">
            <div class="border-b border-gray-200 dark:border-gray-700 mb-4">
              <nav class="-mb-px flex space-x-6">
                <button
                  v-for="tab in subTabs"
                  :key="tab.id"
                  @click="activeSubTab = tab.id"
                  :disabled="isSystemField(currentField) && tab.id !== 'general'"
                  :class="[
                    activeSubTab === tab.id
                      ? 'border-brand-600 text-brand-600 dark:text-brand-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600',
                    'whitespace-nowrap py-3 px-1 border-b-2 text-sm font-medium',
                    isSystemField(currentField) && tab.id !== 'general' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                  ]"
                >
                  {{ tab.name }}
                </button>
              </nav>
            </div>
            <div v-if="activeSubTab === 'general'" class="space-y-4">
              <!-- Basic Field Information -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Label</label>
                  <input v-model="currentField.label" :disabled="isSystemField(currentField)" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10" />
                </div>
                <div>
                  <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Key</label>
                  <input v-model="currentField.key" :disabled="isSystemField(currentField) || isCoreField(currentField, selectedModule?.key) || currentField.dataType === 'Auto-Number'" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10" />
                  <p v-if="currentField.dataType === 'Auto-Number'" class="mt-1 text-xs text-gray-500 dark:text-gray-400">Auto-Number fields cannot have custom keys</p>
                  <p v-if="isSystemField(currentField)" class="mt-1 text-xs text-gray-500 dark:text-gray-400">System fields cannot have their keys modified</p>
                  <p v-if="isCoreField(currentField, selectedModule?.key) && !isSystemField(currentField)" class="mt-1 text-xs text-gray-500 dark:text-gray-400">Core fields cannot have their keys modified</p>
                  <p v-if="!isSystemField(currentField) && !isCoreField(currentField, selectedModule?.key) && currentField.dataType !== 'Auto-Number'" class="mt-1 text-xs text-gray-500 dark:text-gray-400">Auto-generated from label, duplicates are automatically handled</p>
                </div>
                <div>
                  <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Type</label>
                  <select v-model="currentField.dataType" :disabled="isSystemField(currentField) || isCoreField(currentField, selectedModule?.key)" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10">
                    <option v-for="t in fieldTypes" :key="t" :value="t">{{ t }}</option>
                  </select>
                  <p v-if="isCoreField(currentField, selectedModule?.key)" class="mt-1 text-xs text-gray-500 dark:text-gray-400">Core fields cannot have their type changed</p>
                </div>
                <div class="flex items-center gap-6 mt-6 flex-wrap">
                  <label class="inline-flex items-center gap-2 text-sm"><input type="checkbox" v-model="currentField.required" :disabled="isSystemField(currentField) || currentField.dataType === 'Auto-Number' || currentField.dataType === 'Formula' || currentField.dataType === 'Rollup Summary'" /> Required</label>
                  <label class="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" v-model="currentField.keyField" :disabled="isSystemField(currentField) || !canMarkAsKeyField" />
                    Key Field
                    <span v-if="keyFieldCount > 0" class="text-xs text-gray-500 dark:text-gray-400">({{ keyFieldCount }}/10)</span>
                  </label>
                  <label class="inline-flex items-center gap-2 text-sm" title="Controls whether this field is visible in the table/list view. Users can still customize visibility in column settings.">
                    <input type="checkbox" v-model="currentField.visibility.list" :disabled="isSystemField(currentField)" />
                    Show in Table
                  </label>
                  <label class="inline-flex items-center gap-2 text-sm"><input type="checkbox" v-model="currentField.visibility.detail" :disabled="isSystemField(currentField)" /> Show in Detail</label>
                </div>
                <div>
                  <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Default Value</label>
                  <input v-model="currentField.defaultValue" :disabled="isSystemField(currentField) || currentField.dataType === 'Auto-Number' || currentField.dataType === 'Formula' || currentField.dataType === 'Rollup Summary'" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10" />
                  <p v-if="currentField.dataType === 'Auto-Number' || currentField.dataType === 'Formula' || currentField.dataType === 'Rollup Summary'" class="mt-1 text-xs text-gray-500 dark:text-gray-400">This field type cannot have a default value</p>
                  <p v-if="isSystemField(currentField)" class="mt-1 text-xs text-gray-500 dark:text-gray-400">System fields cannot have default values</p>
                </div>
                <div>
                  <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Placeholder</label>
                  <input v-model="currentField.placeholder" placeholder="e.g., Enter full name" :disabled="isSystemField(currentField) || currentField.dataType === 'Auto-Number' || currentField.dataType === 'Checkbox' || currentField.dataType === 'Formula' || currentField.dataType === 'Rollup Summary'" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10" />
                </div>
              </div>

              <!-- Picklist Options (for Picklist, Multi-Picklist, Radio Button) -->
              <div v-if="['Picklist', 'Multi-Picklist', 'Radio Button'].includes(currentField.dataType)" class="border-t border-gray-200 dark:border-gray-700 pt-4">
                <div class="flex items-center justify-between mb-2">
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {{ currentField.dataType === 'Multi-Picklist' ? 'Picklist Options (Multi-Select)' : currentField.dataType === 'Radio Button' ? 'Radio Button Options' : 'Picklist Options' }}
                  </label>
                  <button v-if="!isSystemField(currentField)" @click="showAddOption = true" class="px-3 py-1.5 bg-brand-600 text-white rounded text-xs hover:bg-brand-700">Add Option</button>
                </div>
                <div v-if="!currentField.options || currentField.options.length === 0" class="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-white/5 border border-dashed border-gray-200 dark:border-white/10 rounded-lg p-4 text-center">
                  No options defined. Click "Add Option" to add values.
                </div>
                <div v-else class="space-y-2">
                  <div v-for="(option, optIdx) in normalizedOptions" :key="optIdx" class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-white/5 rounded border border-gray-200 dark:border-white/10">
                    <!-- Color Picker -->
                    <div class="flex items-center gap-2">
                      <input 
                        v-if="!isSystemField(currentField)"
                        type="color" 
                        :value="getOptionColor(option)" 
                        @input="updateOptionColor(optIdx, $event.target.value)"
                        class="w-10 h-10 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                        title="Pick color"
                      />
                      <div 
                        v-else
                        class="w-10 h-10 rounded border border-gray-300 dark:border-gray-600 flex items-center justify-center"
                        :style="{ backgroundColor: getOptionColor(option) }"
                      ></div>
                    </div>
                    <!-- Option Value -->
                    <span class="flex-1 text-sm text-gray-900 dark:text-white font-medium">{{ getOptionValue(option) }}</span>
                    <!-- Color Preview Badge -->
                    <div 
                      class="px-3 py-1 rounded-full text-xs font-medium text-white"
                      :style="{ backgroundColor: getOptionColor(option) }"
                    >
                      {{ getOptionValue(option) }}
                    </div>
                    <button v-if="!isSystemField(currentField)" @click="removeOption(optIdx)" class="px-2 py-1 text-red-600 dark:text-red-400 text-xs hover:bg-red-50 dark:hover:bg-red-900/20 rounded">Remove</button>
                  </div>
                </div>
                <!-- Add Option Modal -->
                <div v-if="showAddOption" class="fixed inset-0 z-50 flex items-center justify-center">
                  <div class="absolute inset-0 bg-black/50" @click="showAddOption = false"></div>
                  <div class="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-md mx-4">
                    <div class="p-4 border-b border-gray-200 dark:border-gray-700">
                      <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Add Option</h3>
                    </div>
                    <div class="p-4 space-y-4">
                      <div>
                        <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Option Value</label>
                        <input v-model="newOptionValue" @keyup.enter="addOption" placeholder="Enter option value" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10" />
                      </div>
                      <div>
                        <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Color</label>
                        <div class="flex items-center gap-3">
                          <input 
                            type="color" 
                            v-model="newOptionColor" 
                            class="w-16 h-10 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                          />
                          <input 
                            type="text" 
                            v-model="newOptionColor" 
                            placeholder="#3B82F6" 
                            class="flex-1 px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm font-mono"
                            pattern="^#[0-9A-Fa-f]{6}$"
                          />
                          <!-- Preview -->
                          <div 
                            class="px-3 py-1 rounded-full text-xs font-medium text-white"
                            :style="{ backgroundColor: newOptionColor }"
                          >
                            Preview
                          </div>
                        </div>
                      </div>
                      <div class="flex justify-end gap-2">
                        <button @click="showAddOption = false" class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 rounded">Cancel</button>
                        <button @click="addOption" class="px-4 py-2 bg-brand-600 text-white rounded text-sm hover:bg-brand-700">Add</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Number Options (for Integer, Decimal, Currency) -->
              <div v-if="['Integer', 'Decimal', 'Currency'].includes(currentField.dataType) && !isSystemField(currentField)" class="border-t border-gray-200 dark:border-gray-700 pt-4">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Number Settings</label>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Minimum Value</label>
                    <input type="number" v-model.number="numberSettings.min" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10" />
                  </div>
                  <div>
                    <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Maximum Value</label>
                    <input type="number" v-model.number="numberSettings.max" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10" />
                  </div>
                  <div v-if="currentField.dataType === 'Decimal' || currentField.dataType === 'Currency'">
                    <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Decimal Places</label>
                    <input type="number" min="0" max="10" v-model.number="numberSettings.decimalPlaces" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10" />
                  </div>
                  <div v-if="currentField.dataType === 'Currency'">
                    <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Currency Symbol</label>
                    <input v-model="numberSettings.currencySymbol" placeholder="$" maxlength="3" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10" />
                  </div>
                </div>
              </div>

              <!-- Text Options (for Text, Text-Area) -->
              <div v-if="['Text', 'Text-Area'].includes(currentField.dataType) && !isSystemField(currentField)" class="border-t border-gray-200 dark:border-gray-700 pt-4">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Text Settings</label>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Maximum Length</label>
                    <input type="number" min="1" v-model.number="textSettings.maxLength" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10" />
                  </div>
                  <div v-if="currentField.dataType === 'Text-Area'">
                    <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Rows</label>
                    <input type="number" min="1" max="20" v-model.number="textSettings.rows" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10" />
                  </div>
                </div>
              </div>

              <!-- Date Options -->
              <div v-if="['Date', 'Date-Time'].includes(currentField.dataType) && !isSystemField(currentField)" class="border-t border-gray-200 dark:border-gray-700 pt-4">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Date Settings</label>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Date Format</label>
                    <select v-model="dateSettings.format" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10">
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="MMM DD, YYYY">MMM DD, YYYY</option>
                    </select>
                  </div>
                  <div v-if="currentField.dataType === 'Date-Time'">
                    <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Time Format</label>
                    <select v-model="dateSettings.timeFormat" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10">
                      <option value="12h">12 Hour (AM/PM)</option>
                      <option value="24h">24 Hour</option>
                    </select>
                  </div>
                </div>
              </div>

              <!-- Formula Options -->
              <div v-if="currentField.dataType === 'Formula' && !isSystemField(currentField)" class="border-t border-gray-200 dark:border-gray-700 pt-4">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Formula Configuration</label>
                <div>
                  <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Formula Expression</label>
                  <textarea v-model="formulaSettings.expression" rows="4" placeholder="e.g., {field1} + {field2}" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 font-mono text-sm"></textarea>
                  <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Use {fieldKey} to reference other fields. This field is read-only.</p>
                </div>
                <div class="mt-3">
                  <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Return Type</label>
                  <select v-model="formulaSettings.returnType" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10">
                    <option value="Text">Text</option>
                    <option value="Number">Number</option>
                    <option value="Date">Date</option>
                    <option value="Checkbox">Checkbox</option>
                  </select>
                </div>
              </div>

              <!-- Lookup Options -->
              <div v-if="currentField.dataType === 'Lookup (Relationship)' && !isSystemField(currentField)" class="border-t border-gray-200 dark:border-gray-700 pt-4">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Lookup Configuration</label>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Target Module</label>
                    <select v-model="lookupSettings.targetModule" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10">
                      <option value="">Select module...</option>
                      <option v-for="m in modules" :key="m.key" :value="m.key">{{ m.name }}</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Display Field</label>
                    <select v-model="lookupSettings.displayField" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10">
                      <option value="">Auto (Name/Title)</option>
                      <option v-for="f in lookupTargetFields" :key="f.key" :value="f.key">{{ f.label || f.key }}</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="activeSubTab === 'validations'" class="space-y-3">
              <div>
                <!-- Empty State -->
                <div v-if="!currentField.validations || currentField.validations.length === 0" class="flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Validation Rules</h3>
                  <p class="text-sm text-gray-600 dark:text-gray-400 text-center max-w-md mb-6">
                    Add validation conditions to ensure data integrity and enforce business rules for this field.
                  </p>
                  <button @click="addValidation" class="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                    </svg>
                    Add Condition
                  </button>
                </div>

                <!-- Validation List -->
                <div v-else>
                  <div class="space-y-3">
                    <div v-for="(v, vi) in currentField.validations" :key="vi" class="relative border border-gray-200 dark:border-white/10 rounded-lg p-3 space-y-2">
                      <!-- Delete button in top right corner -->
                      <button 
                        @click="removeValidation(vi)" 
                        class="absolute -top-2 -right-2 p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all hover:scale-110 bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 shadow-sm"
                        title="Remove validation"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>

                      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Validation Name</label>
                          <input v-model="v.name" placeholder="e.g., Phone must be 10 digits" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10" />
                        </div>
                        <div>
                          <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Type</label>
                          <select v-model="v.type" class="w-full px-2 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10">
                            <option value="regex">Regular Expression</option>
                            <option value="length">Length</option>
                            <option value="range">Range</option>
                            <option value="picklist_single">Single picklist value matching</option>
                            <option value="picklist_multi">Multiple picklist value matching</option>
                            <option value="email">Email</option>
                          </select>
                        </div>
                      </div>

                      <!-- Type-specific fields -->
                      <div v-if="v.type === 'regex'">
                        <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Pattern</label>
                        <input v-model="v.pattern" placeholder="Regex pattern" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10" />
                      </div>

                      <div v-else-if="v.type === 'length'" class="grid grid-cols-2 gap-3">
                        <div>
                          <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Min Length</label>
                          <input type="number" min="0" v-model.number="v.minLength" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10" />
                        </div>
                        <div>
                          <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Max Length</label>
                          <input type="number" min="0" v-model.number="v.maxLength" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10" />
                        </div>
                      </div>

                      <div v-else-if="v.type === 'range'" class="grid grid-cols-2 gap-3">
                        <div>
                          <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Min</label>
                          <input type="number" v-model.number="v.min" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10" />
                        </div>
                        <div>
                          <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Max</label>
                          <input type="number" v-model.number="v.max" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10" />
                        </div>
                      </div>

                      <div v-else-if="v.type === 'picklist_single'">
                        <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Allowed Values (comma separated)</label>
                        <input v-model="allowedValuesBuffers[vi]" @change="applyAllowedValues(vi)" placeholder="e.g., New, Contacted, Qualified" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10" />
                      </div>

                      <div v-else-if="v.type === 'picklist_multi'">
                        <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Allowed Values (comma separated)</label>
                        <input v-model="allowedValuesBuffers[vi]" @change="applyAllowedValues(vi)" placeholder="e.g., New, Contacted, Qualified" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10" />
                      </div>

                      <!-- Email has no extra inputs -->

                      <div>
                        <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Error Message</label>
                        <input v-model="v.message" placeholder="Message to show when validation fails" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10" />
                      </div>
                    </div>
                  </div>
                  <div class="flex items-center gap-2 flex-wrap mt-4">
                    <button @click="addValidation" class="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm hover:shadow-md">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                      </svg>
                      Add custom validation
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="activeSubTab === 'dependencies'">
              <div>
                <!-- Empty State -->
                <div v-if="!currentField.dependencies || currentField.dependencies.length === 0" class="flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Dependencies</h3>
                  <p class="text-sm text-gray-600 dark:text-gray-400 text-center max-w-md mb-6">
                    Add field dependencies to control visibility, read-only state, required state, or filter picklist options based on other field values.
                  </p>
                  <button @click="addDependency" class="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                    </svg>
                    Add Dependency
                  </button>
                </div>

                <!-- Dependencies List -->
                <div v-else>
                  <div class="space-y-3">
                    <div v-for="(d, di) in currentField.dependencies" :key="di" class="relative border border-gray-200 dark:border-white/10 rounded-lg p-3 space-y-3">
                      <!-- Delete button in top right corner -->
                      <button 
                        @click="removeDependency(di)" 
                        class="absolute -top-2 -right-2 p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all hover:scale-110 bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 shadow-sm"
                        title="Remove dependency"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>

                      <!-- Dependency Name and Type in one row -->
                      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Dependency Name</label>
                          <input v-model="d.name" placeholder="e.g., Show when Status is Active" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm" />
                        </div>
                        <div>
                          <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Dependency Type</label>
                          <select v-model="d.type" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm">
                            <option value="visibility">Visibility</option>
                            <option value="readonly">Read-only</option>
                            <option value="required">Required</option>
                            <option value="picklist">Picklist Options Filter</option>
                            <option value="popup">Popup Modal</option>
                          </select>
                        </div>
                      </div>

                      <!-- Logic for multiple conditions (show when 2+ conditions or always for clarity) -->
                      <div v-if="getConditionCount(d) > 1">
                        <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Logic</label>
                        <select v-model="d.logic" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm">
                          <option value="AND">AND</option>
                          <option value="OR">OR</option>
                        </select>
                      </div>

                      <!-- Conditions list - always show conditions array mode -->
                      <div class="space-y-2">
                        <div class="flex items-center justify-between mb-2">
                          <label class="block text-xs font-medium text-gray-700 dark:text-gray-300">Conditions</label>
                          <button @click="addDependencyCondition(di)" class="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded text-xs font-medium transition-colors flex items-center gap-1.5 shadow-sm hover:shadow-md">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-4 h-4">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                            </svg>
                            Add Condition
                          </button>
                        </div>
                        
                        <!-- Show message if no conditions -->
                        <div v-if="getConditionCount(d) === 0" class="text-xs text-gray-500 dark:text-gray-400 py-4 px-3 bg-gray-50 dark:bg-white/5 rounded border border-dashed border-gray-300 dark:border-gray-600 text-center">
                          No conditions defined. Click "Add Condition" to get started.
                        </div>
                        
                        <!-- Conditions -->
                        <div v-for="(c, ci) in getDependencyConditions(d)" :key="ci" class="grid grid-cols-1 md:grid-cols-12 gap-3 items-end border border-gray-200 dark:border-white/10 rounded-lg p-3 bg-gray-50/50 dark:bg-white/5">
                          <div class="md:col-span-5">
                            <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Field</label>
                            <select v-model="c.fieldKey" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm">
                              <option value="">Select field</option>
                              <option v-for="f in otherFields" :key="f.key" :value="f.key">{{ f.label || f.key }}</option>
                            </select>
                          </div>
                          <div class="md:col-span-3">
                            <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Operator</label>
                            <select v-model="c.operator" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm">
                              <option value="equals">equals</option>
                              <option value="not_equals">not equals</option>
                              <option value="in">in</option>
                              <option value="not_in">not in</option>
                              <option value="exists">exists</option>
                              <option value="gt">&gt;</option>
                              <option value="lt">&lt;</option>
                              <option value="gte">&ge;</option>
                              <option value="lte">&le;</option>
                              <option value="contains">contains</option>
                            </select>
                          </div>
                          <div class="md:col-span-3">
                            <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Value</label>
                            <!-- Picklist dropdown -->
                            <select v-if="getDependencyFieldType(c.fieldKey) === 'Picklist' || getDependencyFieldType(c.fieldKey) === 'Multi-Picklist'" v-model="c.value" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm">
                              <option value="">Select option</option>
                              <option v-for="opt in getDependencyFieldOptions(c.fieldKey)" :key="opt" :value="opt">{{ opt }}</option>
                            </select>
                            <!-- Checkbox -->
                            <select v-else-if="getDependencyFieldType(c.fieldKey) === 'Checkbox'" v-model="c.value" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm">
                              <option value="">Select value</option>
                              <option value="true">true</option>
                              <option value="false">false</option>
                            </select>
                            <!-- Date -->
                            <input v-else-if="getDependencyFieldType(c.fieldKey) === 'Date'" type="date" v-model="c.value" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm" />
                            <!-- Date-Time -->
                            <input v-else-if="getDependencyFieldType(c.fieldKey) === 'Date-Time'" type="datetime-local" v-model="c.value" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm" />
                            <!-- Number fields -->
                            <input v-else-if="['Integer', 'Decimal', 'Currency'].includes(getDependencyFieldType(c.fieldKey))" type="number" v-model.number="c.value" placeholder="Number" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm" />
                            <!-- Text input for 'in' or 'not_in' operators -->
                            <input v-else-if="c.operator === 'in' || c.operator === 'not_in'" v-model="dependencyConditionBuffers[di + '-' + ci]" placeholder="a, b, c" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm" @change="applyDependencyConditionValue(di, ci)" />
                            <!-- Comparison operators need numbers -->
                            <input v-else-if="['gt', 'lt', 'gte', 'lte'].includes(c.operator)" type="number" v-model.number="c.value" placeholder="Number" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm" />
                            <!-- Exists operator -->
                            <input v-else-if="c.operator === 'exists'" type="text" disabled value="(exists check)" class="w-full px-3 py-2 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-sm cursor-not-allowed" />
                            <!-- Default text input -->
                            <input v-else v-model="c.value" placeholder="Value" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm" />
                          </div>
                          <button @click="removeDependencyCondition(di, ci)" class="md:col-span-1 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm transition-colors flex items-center justify-center" title="Remove condition">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      <!-- Picklist-specific settings -->
                      <div v-if="d.type === 'picklist' && (currentField.dataType === 'Picklist' || currentField.dataType === 'Multi-Picklist')" class="border-t border-gray-200 dark:border-white/10 pt-3">
                        <label class="block text-xs text-gray-600 dark:text-gray-400 mb-2">Picklist Options to Show</label>
                        <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
                          Select which options from this field should be visible when the dependency condition is met.
                        </p>
                        <div v-if="!currentField.options || currentField.options.length === 0" class="text-xs text-gray-500 dark:text-gray-400 py-2">
                          No picklist options available. Please add options to this field first.
                        </div>
                        <div v-else class="space-y-2">
                          <div v-for="(option, optIdx) in getPicklistOptions(currentField)" :key="optIdx" class="flex items-center gap-2">
                            <input
                              type="checkbox"
                              :id="`picklist-option-${di}-${optIdx}`"
                              :checked="isPicklistOptionSelected(di, option)"
                              @change="togglePicklistOption(di, option)"
                              class="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500"
                            />
                            <label :for="`picklist-option-${di}-${optIdx}`" class="text-sm text-gray-700 dark:text-gray-300 cursor-pointer flex items-center gap-2">
                              <span v-if="typeof option === 'object' && option.color" class="w-3 h-3 rounded-full flex-shrink-0" :style="{ backgroundColor: option.color }"></span>
                              <span>{{ normalizePicklistOption(option) }}</span>
                            </label>
                          </div>
                        </div>
                      </div>
                      <div v-else-if="d.type === 'picklist'" class="border-t border-gray-200 dark:border-white/10 pt-3">
                        <p class="text-xs text-gray-500 dark:text-gray-400">
                          Picklist filter is only available for Picklist or Multi-Picklist field types.
                        </p>
                      </div>

                      <!-- Popup-specific settings -->
                      <div v-if="d.type === 'popup'" class="border-t border-gray-200 dark:border-white/10 pt-3">
                        <label class="block text-xs text-gray-600 dark:text-gray-400 mb-2">Fields to Show in Popup</label>
                        <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
                          Select which fields should be displayed in the popup modal when the condition is met.
                        </p>
                        <div v-if="!editFields || editFields.length === 0" class="text-xs text-gray-500 dark:text-gray-400 py-2">
                          No fields available. Please add fields to this module first.
                        </div>
                        <div v-else class="space-y-2 max-h-60 overflow-y-auto">
                          <div v-for="f in editFields" :key="f.key" class="flex items-center gap-2">
                            <input
                              type="checkbox"
                              :id="`popup-field-${di}-${f.key}`"
                              :checked="isPopupFieldSelected(di, f.key)"
                              @change="togglePopupField(di, f.key)"
                              class="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500"
                            />
                            <label :for="`popup-field-${di}-${f.key}`" class="text-sm text-gray-700 dark:text-gray-300 cursor-pointer flex items-center gap-2">
                              <span>{{ f.label || f.key }}</span>
                              <span class="text-xs text-gray-500 dark:text-gray-400">({{ f.dataType }})</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="flex items-center gap-2 flex-wrap mt-4">
                    <button @click="addDependency" class="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm hover:shadow-md">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                      </svg>
                      Add dependency
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
          </div>
        </div>
      </section>
      </div>

      <!-- Other tabs: Module details, Relationship, Quick Create -->
      <section v-else class="flex-1 min-w-0 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div class="p-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
          <div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ currentTopTabLabel }}
            </h3>
            <p class="text-xs text-gray-500 dark:text-gray-400">Module: {{ selectedModule?.name }} • Key: {{ selectedModule?.key }}</p>
          </div>
          <div class="flex items-center gap-2">
            <button 
              v-if="(['details', 'relationships', 'pipeline'].includes(activeTopTab) && isDirty)"
              @click="saveModule" 
              :disabled="isSaving"
              class="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm hover:shadow-md"
            >
              <svg v-if="!isSaving" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-4 h-4">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              <svg v-else class="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {{ isSaving ? 'Saving...' : 'Save Changes' }}
            </button>
          </div>
        </div>

        <div class="p-4" v-if="activeTopTab === 'details'">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Display Name</label>
              <input v-model="moduleNameEdit" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10" />
            </div>
            <div>
              <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Module Key</label>
              <input :value="selectedModule.key" disabled class="w-full px-3 py-2 rounded bg-gray-100 dark:bg-white/10 border border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400" />
            </div>
            <div>
              <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Type</label>
              <input :value="selectedModule.type" disabled class="w-full px-3 py-2 rounded bg-gray-100 dark:bg-white/10 border border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400" />
            </div>
            <div class="flex items-center gap-2 mt-6">
              <input id="mod-enabled" type="checkbox" v-model="moduleEnabled" />
              <label for="mod-enabled" class="text-sm text-gray-700 dark:text-gray-300">Enabled</label>
            </div>
          </div>
        </div>

        <div class="p-6" v-else-if="activeTopTab === 'relationships'">
          <!-- Header -->
          <div class="mb-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Relationships</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Define relationships between this module and other modules. Relationships enable data linking and cross-module references.
            </p>
          </div>

          <!-- Empty State -->
          <div v-if="relationships.length === 0" class="bg-gray-50 dark:bg-white/5 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-12 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-4">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">No relationships defined</p>
            <p class="text-xs text-gray-500 dark:text-gray-500 mb-4">Get started by adding your first relationship</p>
            <button @click="addRelationship" class="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 mx-auto shadow-sm hover:shadow-md">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-4 h-4">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              Add Relationship
            </button>
          </div>

          <!-- Relationships List -->
          <div v-else class="space-y-4">
            <div v-for="(r, ri) in relationships" :key="ri" class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
              <!-- Relationship Header -->
              <div class="bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-white/5 dark:to-white/10 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-4 h-4">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </div>
                  <div>
                    <h4 class="text-sm font-semibold text-gray-900 dark:text-white">
                      {{ r.name || `Relationship ${ri + 1}` }}
                    </h4>
                    <p class="text-xs text-gray-500 dark:text-gray-400">
                      {{ getRelationshipTypeLabel(r.type) }}
                      <span v-if="r.targetModuleKey"> • {{ getModuleName(r.targetModuleKey) }}</span>
                    </p>
                  </div>
                </div>
                <button 
                  @click="removeRelationship(ri)" 
                  class="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                  title="Remove relationship"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              <!-- Relationship Content -->
              <div class="p-4 space-y-4">
                <!-- Basic Information -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Relationship Name <span class="text-red-500">*</span>
                    </label>
                    <input 
                      v-model="r.name" 
                      placeholder="e.g., Primary Organization" 
                      class="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent transition-all" 
                    />
                    <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">A descriptive name for this relationship</p>
                  </div>
                  
                  <div>
                    <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Relationship Type <span class="text-red-500">*</span>
                    </label>
                    <select 
                      v-model="r.type" 
                      class="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent transition-all"
                    >
                      <option value="one_to_one">One-to-One (1:1)</option>
                      <option value="one_to_many">One-to-Many (1:N)</option>
                      <option value="many_to_one">Many-to-One (N:1)</option>
                      <option value="many_to_many">Many-to-Many (N:N)</option>
                      <option value="lookup">Lookup</option>
                    </select>
                    <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">How records relate to each other</p>
                  </div>
                </div>

                <!-- Module Configuration -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Target Module <span class="text-red-500">*</span>
                    </label>
                    <select 
                      v-model="r.targetModuleKey" 
                      class="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent transition-all"
                    >
                      <option value="">Select module</option>
                      <option v-for="m in modules" :key="m.key" :value="m.key">{{ m.name }}</option>
                    </select>
                    <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">The module this relationship links to</p>
                  </div>
                  
                  <div>
                    <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      Display Label
                    </label>
                    <input 
                      v-model="r.label" 
                      placeholder="e.g., Related Organizations" 
                      class="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent transition-all" 
                    />
                    <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Label shown in the UI</p>
                  </div>
                </div>

                <!-- Field Configuration -->
                <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <h5 class="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-4 h-4">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Field Mapping
                  </h5>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Local Field <span class="text-red-500">*</span>
                      </label>
                      <select 
                        v-model="r.localField" 
                        class="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent transition-all"
                      >
                        <option value="">Select field</option>
                        <option v-for="field in editFields" :key="field.key" :value="field.key">
                          {{ field.label || field.key }} ({{ field.key }})
                        </option>
                      </select>
                      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Field in this module</p>
                    </div>
                    
                    <div>
                      <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Foreign Field <span class="text-red-500">*</span>
                      </label>
                      <input 
                        v-model="r.foreignField" 
                        placeholder="e.g., _id" 
                        class="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-400 focus:border-transparent transition-all" 
                      />
                      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">Field in target module</p>
                    </div>
                  </div>
                </div>

                <!-- Options -->
                <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <h5 class="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-4 h-4">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                    Relationship Options
                  </h5>
                  <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <label class="flex items-center gap-2 p-3 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                      <input 
                        type="checkbox" 
                        v-model="r.required" 
                        class="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500 dark:focus:ring-brand-400"
                      />
                      <span class="text-xs font-medium text-gray-700 dark:text-gray-300">Required</span>
                    </label>
                    <label class="flex items-center gap-2 p-3 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                      <input 
                        type="checkbox" 
                        v-model="r.unique" 
                        class="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500 dark:focus:ring-brand-400"
                      />
                      <span class="text-xs font-medium text-gray-700 dark:text-gray-300">Unique</span>
                    </label>
                    <label class="flex items-center gap-2 p-3 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                      <input 
                        type="checkbox" 
                        v-model="r.index" 
                        class="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500 dark:focus:ring-brand-400"
                      />
                      <span class="text-xs font-medium text-gray-700 dark:text-gray-300">Index</span>
                    </label>
                    <label class="flex items-center gap-2 p-3 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
                      <input 
                        type="checkbox" 
                        v-model="r.cascadeDelete" 
                        class="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500 dark:focus:ring-brand-400"
                      />
                      <span class="text-xs font-medium text-gray-700 dark:text-gray-300">Cascade Delete</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <!-- Add Button -->
            <button 
              @click="addRelationship" 
              class="w-full px-4 py-3 bg-white dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:border-brand-500 dark:hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              Add Another Relationship
            </button>
          </div>
        </div>

        <div class="p-6 h-full" v-else-if="activeTopTab === 'pipeline'">
          <div class="h-full flex flex-col lg:flex-row gap-4">
            <aside class="w-full lg:w-80 flex-none bg-white dark:bg-gray-900/60 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
              <div class="p-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
                <div class="text-sm font-semibold text-gray-800 dark:text-gray-200">Pipelines</div>
                <button @click="addPipeline" class="px-3 py-1.5 text-xs font-medium bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors shadow-sm hover:shadow">
                  Add
                </button>
              </div>
              <div class="flex-1 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-800">
                <div
                  v-for="(pipeline, index) in pipelineSettings"
                  :key="pipeline.key || index"
                  :class="[
                    'p-4 cursor-pointer transition-colors',
                    selectedPipelineKey === pipeline.key
                      ? 'bg-brand-50 dark:bg-brand-900/20'
                      : 'hover:bg-gray-50 dark:hover:bg-white/5'
                  ]"
                  @click="selectedPipelineKey = pipeline.key"
                >
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                      <span class="w-2.5 h-2.5 rounded-full border border-white shadow" :style="{ backgroundColor: pipeline.color || DEFAULT_PIPELINE_COLOR }"></span>
                      <div class="min-w-0">
                        <p class="text-sm font-semibold text-gray-900 dark:text-white truncate">{{ pipeline.name }}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">{{ pipeline.stages?.length || 0 }} stage{{ (pipeline.stages?.length || 0) === 1 ? '' : 's' }}</p>
                      </div>
                    </div>
                    <span v-if="pipeline.isDefault" class="text-xs font-medium text-brand-600 dark:text-brand-300">Default</span>
                  </div>
                  <div class="flex items-center gap-2 mt-3">
                    <label class="inline-flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <input
                        type="radio"
                        name="default-pipeline"
                        class="text-brand-600 border-gray-300 dark:border-gray-600 focus:ring-brand-500"
                        :checked="pipeline.isDefault"
                        @change.stop="setDefaultPipeline(pipeline.key)"
                      />
                      Default
                    </label>
                    <div class="ml-auto flex items-center gap-1">
                      <button
                        class="p-1 rounded text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-colors"
                        :disabled="index === 0"
                        :class="{ 'opacity-40 cursor-not-allowed': index === 0 }"
                        @click.stop="movePipeline(pipeline.key, -1)"
                        title="Move up"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
                          <path fill-rule="evenodd" d="M10 4a.75.75 0 01.53.22l4.5 4.5a.75.75 0 11-1.06 1.06L10 5.81 6.03 9.78a.75.75 0 11-1.06-1.06l4.5-4.5A.75.75 0 0110 4z" clip-rule="evenodd" />
                          <path d="M5.25 15.25a.75.75 0 01.75-.75h8a.75.75 0 010 1.5h-8a.75.75 0 01-.75-.75z" />
                        </svg>
                      </button>
                      <button
                        class="p-1 rounded text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-colors"
                        :disabled="index === pipelineSettings.length - 1"
                        :class="{ 'opacity-40 cursor-not-allowed': index === pipelineSettings.length - 1 }"
                        @click.stop="movePipeline(pipeline.key, 1)"
                        title="Move down"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
                          <path fill-rule="evenodd" d="M10 16a.75.75 0 01-.53-.22l-4.5-4.5a.75.75 0 011.06-1.06L10 14.19l3.97-3.97a.75.75 0 111.06 1.06l-4.5 4.5A.75.75 0 0110 16z" clip-rule="evenodd" />
                          <path d="M5.25 4.75a.75.75 0 01.75-.75h8a.75.75 0 010 1.5h-8a.75.75 0 01-.75-.75z" />
                        </svg>
                      </button>
                      <button
                        class="p-1 rounded text-red-500 hover:text-red-600 transition-colors"
                        @click.stop="removePipeline(pipeline.key)"
                        title="Remove pipeline"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
                          <path fill-rule="evenodd" d="M8.75 3a.75.75 0 00-.75.75V5H5.5a.75.75 0 000 1.5h.538l.599 9.27A1.75 1.75 0 008.382 17.5h3.236a1.75 1.75 0 001.745-1.73l.599-9.27h.538a.75.75 0 000-1.5H12v-1.25A.75.75 0 0011.25 3h-2.5zM9.5 6.5v7a.75.75 0 001.5 0v-7a.75.75 0 00-1.5 0zm-2 0v7a.75.75 0 001.5 0v-7a.75.75 0 00-1.5 0z" clip-rule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
                <div v-if="!pipelineSettings.length" class="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  No pipelines yet.
                </div>
              </div>
            </aside>
            <section class="flex-1 min-w-0 bg-white dark:bg-gray-900/60 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-y-auto flex flex-col">
              <div class="p-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
                    {{ currentPipeline?.name || 'Select a pipeline' }}
                  </p>
                  <p v-if="currentPipeline" class="text-xs text-gray-500 dark:text-gray-400">
                    {{ currentPipeline.stages?.length || 0 }} stage{{ (currentPipeline.stages?.length || 0) === 1 ? '' : 's' }} ·
                    {{ currentPipeline.isDefault ? 'Default pipeline' : 'Custom pipeline' }}
                  </p>
                </div>
                <button
                  @click="saveModule"
                  :disabled="isSaving || !isDirty"
                  class="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors"
                  :class="[
                    isSaving || !isDirty
                      ? 'bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-not-allowed'
                      : 'bg-brand-600 hover:bg-brand-700 text-white shadow-sm hover:shadow'
                  ]"
                >
                  <svg v-if="isSaving" class="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>{{ isSaving ? 'Saving…' : 'Save Pipelines' }}</span>
                </button>
              </div>
              <div v-if="currentPipeline" class="p-4 space-y-6">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Pipeline Name</label>
                    <input v-model="currentPipeline.name" class="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700 text-sm" />
                  </div>
                  <div>
                    <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Color</label>
                    <div class="flex items-center gap-3">
                      <input type="color" v-model="currentPipeline.color" class="w-14 h-10 border border-gray-300 dark:border-gray-600 rounded focus:outline-none" />
                      <span class="text-xs text-gray-500 dark:text-gray-400">Used for visual indicators in the UI.</span>
                    </div>
                  </div>
                  <div class="md:col-span-2 flex items-center gap-3">
                    <span v-if="currentPipeline.isDefault" class="px-2 py-0.5 text-xs font-medium bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 rounded">Default pipeline</span>
                    <button
                      v-else
                      @click="setDefaultPipeline(currentPipeline.key)"
                      class="px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-white/20 transition-colors"
                    >
                      Set as default
                    </button>
                  </div>
                </div>

                <div class="flex items-center justify-between gap-3">
                  <div>
                    <h4 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Stages</h4>
                    <p class="text-xs text-gray-500 dark:text-gray-400">Configure the stages available in this pipeline.</p>
                  </div>
                  <div class="flex items-center gap-2">
                  <button @click="addStageToPipeline(currentPipeline)" class="px-3 py-1.5 text-xs font-medium bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors shadow-sm hover:shadow">
                    Add Stage
                  </button>
                  </div>
                </div>

                <div class="pr-1 space-y-3 pb-16" @dragover.prevent="onStageListDragOver(currentPipeline.key)" @drop.prevent="onStageListDrop(currentPipeline.key)">
                  <div
                    v-for="(stage, stageIndex) in currentPipeline.stages"
                    :key="stage.key || stageIndex"
                    class="border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900/50 p-4 transition-shadow"
                    draggable="true"
                    @dragstart="onStageDragStart(currentPipeline.key, stageIndex, $event)"
                    @dragover.prevent="onStageDragOver(currentPipeline.key, stageIndex)"
                    @drop.prevent="onStageDrop(currentPipeline.key, stageIndex)"
                    @dragend="resetStageDrag"
                    :class="[
                      stageDragOver.pipelineKey === currentPipeline.key && stageDragOver.index === stageIndex
                         ? 'ring-2 ring-brand-500/60 dark:ring-brand-400/70'
                         : ''
                     ]"
                   >
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <span class="text-sm font-semibold text-gray-800 dark:text-gray-200">Stage {{ stageIndex + 1 }}</span>
                      </div>
                      <div class="flex items-center gap-1">
                        <button
                          class="p-1 rounded text-red-500 hover:text-red-600 transition-colors"
                          @click="removeStageFromPipeline(currentPipeline, stageIndex)"
                          title="Remove stage"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
                            <path fill-rule="evenodd" d="M8.75 3a.75.75 0 00-.75.75V5H5.5a.75.75 0 000 1.5h.538l.599 9.27A1.75 1.75 0 008.382 17.5h3.236a1.75 1.75 0 001.745-1.73l.599-9.27h.538a.75.75 0 000-1.5H12v-1.25A.75.75 0 0011.25 3h-2.5zM9.5 6.5v7a.75.75 0 001.5 0v-7a.75.75 0 00-1.5 0zm-2 0v7a.75.75 0 001.5 0v-7a.75.75 0 00-1.5 0z" clip-rule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                      <div>
                        <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Stage Name</label>
                        <input v-model="stage.name" class="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700 text-sm" />
                      </div>
                      <div>
                        <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Probability (%)</label>
                        <input type="number" min="0" max="100" v-model.number="stage.probability" @change="clampStageProbability(stage)" @blur="clampStageProbability(stage)" class="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700 text-sm" />
                      </div>
                      <div>
                        <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Status</label>
                        <select v-model="stage.status" @change="onStageStatusChange(stage)" class="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700 text-sm">
                          <option v-for="option in pipelineStageStatusOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <div
                    class="border border-dashed border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50/40 dark:bg-white/5 text-center text-xs text-gray-500 dark:text-gray-400 py-4 transition-colors"
                    :class="stageDragOver.pipelineKey === currentPipeline.key && stageDragOver.index === currentPipeline.stages.length ? 'border-brand-400 text-brand-600 dark:text-brand-300' : ''"
                    @dragover.prevent="onStageDragOver(currentPipeline.key, currentPipeline.stages.length)"
                    @drop.prevent="onStageDrop(currentPipeline.key, currentPipeline.stages.length)"
                  >
                    Drop here to move stage to the end
                  </div>
                </div>
              </div>
              <div v-else class="flex-1 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                <div class="text-center space-y-3">
                  <p>No pipeline selected.</p>
                  <button @click="addPipeline" class="px-4 py-2 text-sm font-medium bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors">Create Pipeline</button>
                </div>
              </div>
              <div v-if="!currentPipeline" class="flex-1 flex items-center justify-center p-6 text-sm text-gray-500 dark:text-gray-400">
                Select a pipeline on the left to edit its details.
              </div>
            </section>
          </div>
        </div>

        <div class="p-4" v-else-if="activeTopTab === 'playbooks'">
          <div class="h-full flex flex-col lg:flex-row gap-4">
            <aside class="w-full lg:w-80 flex-none bg-white dark:bg-gray-900/60 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
              <div class="p-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
                <div class="text-sm font-semibold text-gray-800 dark:text-gray-200">Pipelines</div>
                <button @click="addPipeline" class="px-3 py-1.5 text-xs font-medium bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors shadow-sm hover:shadow">
                  Add
                </button>
              </div>
              <div class="flex-1 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-800">
                <div
                  v-for="(pipeline, index) in pipelineSettings"
                  :key="pipeline.key || index"
                  :class="[
                    'p-4 cursor-pointer transition-colors',
                    selectedPipelineKey === pipeline.key
                      ? 'bg-brand-50 dark:bg-brand-900/20'
                      : 'hover:bg-gray-50 dark:hover:bg-white/5'
                  ]"
                  @click="selectedPipelineKey = pipeline.key"
                >
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                      <span class="w-2.5 h-2.5 rounded-full border border-white shadow" :style="{ backgroundColor: pipeline.color || DEFAULT_PIPELINE_COLOR }"></span>
                      <div class="min-w-0">
                        <p class="text-sm font-semibold text-gray-900 dark:text-white truncate">{{ pipeline.name }}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">{{ pipeline.stages?.length || 0 }} stage{{ (pipeline.stages?.length || 0) === 1 ? '' : 's' }}</p>
                      </div>
                    </div>
                    <span v-if="pipeline.isDefault" class="text-xs font-medium text-brand-600 dark:text-brand-300">Default</span>
                  </div>
                  <div class="flex items-center gap-2 mt-3">
                    <label class="inline-flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <input
                        type="radio"
                        name="default-playbook-pipeline"
                        class="text-brand-600 border-gray-300 dark:border-gray-600 focus:ring-brand-500"
                        :checked="pipeline.isDefault"
                        @change.stop="setDefaultPipeline(pipeline.key)"
                      />
                      Default
                    </label>
                    <div class="ml-auto flex items-center gap-1">
                      <button
                        class="p-1 rounded text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-colors"
                        :disabled="index === 0"
                        :class="{ 'opacity-40 cursor-not-allowed': index === 0 }"
                        @click.stop="movePipeline(pipeline.key, -1)"
                        title="Move up"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
                          <path fill-rule="evenodd" d="M10 4a.75.75 0 01.53.22l4.5 4.5a.75.75 0 11-1.06 1.06L10 5.81 6.03 9.78a.75.75 0 11-1.06-1.06l4.5-4.5A.75.75 0 0110 4z" clip-rule="evenodd" />
                          <path d="M5.25 15.25a.75.75 0 01.75-.75h8a.75.75 0 010 1.5h-8a.75.75 0 01-.75-.75z" />
                        </svg>
                      </button>
                      <button
                        class="p-1 rounded text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition-colors"
                        :disabled="index === pipelineSettings.length - 1"
                        :class="{ 'opacity-40 cursor-not-allowed': index === pipelineSettings.length - 1 }"
                        @click.stop="movePipeline(pipeline.key, 1)"
                        title="Move down"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
                          <path fill-rule="evenodd" d="M10 16a.75.75 0 01-.53-.22l-4.5-4.5a.75.75 0 011.06-1.06L10 14.19l3.97-3.97a.75.75 0 111.06 1.06l-4.5 4.5A.75.75 0 0110 16z" clip-rule="evenodd" />
                          <path d="M5.25 4.75a.75.75 0 01.75-.75h8a.75.75 0 010 1.5h-8a.75.75 0 01-.75-.75z" />
                        </svg>
                      </button>
                      <button
                        class="p-1 rounded text-red-500 hover:text-red-600 transition-colors"
                        @click.stop="removePipeline(pipeline.key)"
                        title="Remove pipeline"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
                          <path fill-rule="evenodd" d="M8.75 3a.75.75 0 00-.75.75V5H5.5a.75.75 0 000 1.5h.538l.599 9.27A1.75 1.75 0 008.382 17.5h3.236a1.75 1.75 0 001.745-1.73l.599-9.27h.538a.75.75 0 000-1.5H12v-1.25A.75.75 0 0011.25 3h-2.5zM9.5 6.5v7a.75.75 0 001.5 0v-7a.75.75 0 00-1.5 0zm-2 0v7a.75.75 0 001.5 0v-7a.75.75 0 00-1.5 0z" clip-rule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
                <div v-if="!pipelineSettings.length" class="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  No pipelines yet.
                </div>
              </div>
            </aside>
            <section class="flex-1 min-w-0 bg-white dark:bg-gray-900/60 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
              <div class="p-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
                    {{ currentPipeline?.name || 'Select a pipeline' }}
                  </p>
                  <p v-if="currentPipeline" class="text-xs text-gray-500 dark:text-gray-400">
                    {{ currentPipeline.stages?.length || 0 }} stage{{ (currentPipeline.stages?.length || 0) === 1 ? '' : 's' }} ·
                    {{ currentPipeline.isDefault ? 'Default pipeline' : 'Custom pipeline' }}
                  </p>
                </div>
              </div>
              <div v-if="currentPipeline" class="flex-1 flex flex-col gap-6 p-4 overflow-hidden">
                <div>
                  <h4 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Stage Playbooks</h4>
                  <p class="text-xs text-gray-500 dark:text-gray-400">Define guidance and automation for each stage in this pipeline.</p>
                </div>
                <div class="flex-1 overflow-x-auto pb-6">
                  <div class="flex items-start gap-4 min-w-full">
                    <div
                      v-for="(stage, stageIndex) in currentPipeline.stages"
                      :key="stage.key || stageIndex"
                      class="w-[28rem] flex-shrink-0"
                    >
                      <div class="h-full flex flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/60 shadow-sm">
                        <div class="p-4 border-b border-gray-200 dark:border-white/10 space-y-3">
                          <div class="flex items-start justify-between gap-3">
                            <div class="min-w-0">
                              <p class="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
                                {{ stage.name || `Stage ${stageIndex + 1}` }}
                              </p>
                              <p class="text-xs text-gray-500 dark:text-gray-400">
                                Probability: {{ stage.probability ?? 0 }}% · Status: {{ stage.status || 'open' }}
                              </p>
                            </div>
                            <label class="inline-flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer flex-shrink-0">
                              <input
                                type="checkbox"
                                v-model="stage.playbook.enabled"
                                @change="handlePlaybookToggle(stage)"
                                class="rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500"
                              />
                              <span>Enable</span>
                            </label>
                          </div>
                          <button
                            type="button"
                            class="inline-flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                            @click="toggleStageSettings(stage.key)"
                          >
                            <svg
                              :class="[
                                'w-4 h-4 transition-transform duration-200',
                                isStageSettingsOpen(stage) ? 'rotate-180' : ''
                              ]"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                            </svg>
                            <span>Stage settings</span>
                          </button>
                          <transition name="fade">
                            <div
                              v-if="isStageSettingsOpen(stage)"
                              class="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-white/5 p-4 space-y-4"
                            >
                              <div class="grid grid-cols-1 gap-3">
                                <div>
                                  <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Playbook Mode</label>
                                  <select v-model="stage.playbook.mode" class="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 text-sm">
                                    <option v-for="option in PLAYBOOK_MODE_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
                                  </select>
                                </div>
                                <div>
                                  <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Exit Criteria</label>
                                  <select v-model="stage.playbook.exitCriteria.type" @change="onPlaybookExitCriteriaChange(stage)" class="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 text-sm">
                                    <option v-for="option in PLAYBOOK_EXIT_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
                                  </select>
                                </div>
                                <div>
                                  <label class="inline-flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
                                    <input type="checkbox" v-model="stage.playbook.autoAdvance" @change="onPlaybookAutoAdvanceChange(stage)" class="rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500" />
                                    Auto-move to next stage when criteria met
                                  </label>
                                  <p class="mt-1 text-[11px] text-gray-500 dark:text-gray-400">Automatically progress when conditions are satisfied.</p>
                                </div>
                                <div v-if="stage.playbook.autoAdvance">
                                  <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Next Stage</label>
                                  <select v-model="stage.playbook.exitCriteria.nextStageKey" class="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 text-sm">
                                    <option value="">Select stage...</option>
                                    <option v-for="option in getNextStageOptions(currentPipeline, stage)" :key="option.value" :value="option.value">{{ option.label }}</option>
                                  </select>
                                </div>
                                <div v-if="stage.playbook.exitCriteria.type === 'custom'">
                                  <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Custom Trigger Description</label>
                                  <textarea v-model="stage.playbook.exitCriteria.customDescription" rows="2" class="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 text-sm" placeholder="Describe the conditions that should move this deal to the next stage"></textarea>
                                </div>
                                <div>
                                  <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Internal Notes (optional)</label>
                                  <textarea v-model="stage.playbook.notes" rows="2" class="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 text-sm" placeholder="Provide additional guidance for your team"></textarea>
                                </div>
                              </div>
                            </div>
                          </transition>
                        </div>
                        <div class="flex-1 flex flex-col gap-4 p-4">
                          <div class="flex items-start justify-between gap-3">
                            <div>
                              <h6 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Activities</h6>
                              <p class="text-xs text-gray-500 dark:text-gray-400">Add and orchestrate the work your team completes in this stage.</p>
                            </div>
                            <button
                              class="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors shadow-sm hover:shadow"
                              @click="addPlaybookAction(stage)"
                              :disabled="!stage.playbook.enabled"
                              :class="!stage.playbook.enabled ? 'opacity-50 cursor-not-allowed' : ''"
                            >
                              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                              </svg>
                              Add Activity
                            </button>
                          </div>
                          <div v-if="!stage.playbook.enabled" class="flex-1 rounded-lg border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-white/5 p-4 text-xs text-gray-500 dark:text-gray-400">
                            Enable this playbook to manage activities for the stage.
                          </div>
                          <div v-else class="flex-1 flex flex-col gap-3 overflow-y-auto pr-1">
                            <div v-if="!stage.playbook.actions.length" class="flex-1 rounded-lg border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-white/5 px-4 py-8 text-center text-xs text-gray-500 dark:text-gray-400">
                              No activities yet. Click "Add Activity" to build a guided checklist.
                            </div>
                            <div v-else class="space-y-3">
                              <div
                                v-for="(action, actionIndex) in stage.playbook.actions"
                                :key="action.key || actionIndex"
                                class="group border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900/70 p-4 shadow-sm hover:border-brand-500/70 hover:shadow transition-colors cursor-pointer"
                                @click="openActionModal(stage, actionIndex)"
                              >
                                <div class="flex items-start justify-between gap-2">
                                  <div class="min-w-0">
                                    <p class="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                      {{ action.title || `Action ${actionIndex + 1}` }}
                                    </p>
                                    <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                      {{ getPlaybookActionTypeLabel(action.actionType) }}
                                      <span v-if="action.dueInDays !== null && action.dueInDays !== undefined" class="ml-1">• Due in {{ action.dueInDays }} day{{ action.dueInDays === 1 ? '' : 's' }}</span>
                                    </p>
                                  </div>
                                  <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      class="p-1 rounded text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-200 transition-colors"
                                      :disabled="actionIndex === 0"
                                      :class="{ 'opacity-40 cursor-not-allowed': actionIndex === 0 }"
                                      @click.stop="movePlaybookAction(stage, actionIndex, -1)"
                                      title="Move up"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
                                        <path fill-rule="evenodd" d="M10 4a.75.75 0 01.53.22l4.5 4.5a.75.75 0 11-1.06 1.06L10 5.81 6.03 9.78a.75.75 0 11-1.06-1.06l4.5-4.5A.75.75 0 0110 4z" clip-rule="evenodd" />
                                        <path d="M5.25 15.25a.75.75 0 01.75-.75h8a.75.75 0 010 1.5h-8a.75.75 0 01-.75-.75z" />
                                      </svg>
                                    </button>
                                    <button
                                      class="p-1 rounded text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-200 transition-colors"
                                      :disabled="actionIndex === stage.playbook.actions.length - 1"
                                      :class="{ 'opacity-40 cursor-not-allowed': actionIndex === stage.playbook.actions.length - 1 }"
                                      @click.stop="movePlaybookAction(stage, actionIndex, 1)"
                                      title="Move down"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
                                        <path fill-rule="evenodd" d="M10 16a.75.75 0 01-.53-.22l-4.5-4.5a.75.75 0 011.06-1.06L10 14.19l3.97-3.97a.75.75 0 111.06 1.06l-4.5 4.5A.75.75 0 0110 16z" clip-rule="evenodd" />
                                        <path d="M5.25 4.75a.75.75 0 01.75-.75h8a.75.75 0 010 1.5h-8a.75.75 0 01-.75-.75z" />
                                      </svg>
                                    </button>
                                    <button
                                      class="p-1 rounded text-red-500 hover:text-red-600 transition-colors"
                                      @click.stop="removePlaybookAction(stage, actionIndex)"
                                      title="Remove activity"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
                                        <path fill-rule="evenodd" d="M8.75 3a.75.75 0 00-.75.75V5H5.5a.75.75 0 000 1.5h.538l.599 9.27A1.75 1.75 0 008.382 17.5h3.236a1.75 1.75 0 001.745-1.73l.599-9.27h.538a.75.75 0 000-1.5H12v-1.25A.75.75 0 0011.25 3h-2.5zM9.5 6.5v7a.75.75 0 001.5 0v-7a.75.75 0 00-1.5 0zm-2 0v7a.75.75 0 001.5 0v-7a.75.75 0 00-1.5 0z" clip-rule="evenodd" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                                <div class="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                                  <span v-if="action.required" class="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">Required</span>
                                  <span v-if="action.autoCreate" class="px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">Auto-create</span>
                                  <span v-if="action.dependencies?.length" class="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
                                    {{ action.dependencies.length }} dependenc{{ action.dependencies.length === 1 ? 'y' : 'ies' }}
                                  </span>
                                  <span class="truncate">
                                    Assigned to {{ getPlaybookAssignmentLabel(action.assignment?.type) }}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div v-if="!currentPipeline" class="flex-1 flex items-center justify-center p-6 text-sm text-gray-500 dark:text-gray-400">
                Select a pipeline on the left to configure playbooks.
              </div>
            </section>
          </div>
        </div>

        <div class="p-4" v-else>
          <!-- Quick Create Mode Toggle - Advanced mode hidden for now -->
          <!-- <div class="mb-3 flex items-center justify-between">
            <div class="text-sm font-semibold text-gray-800 dark:text-gray-200">Quick Create Mode</div>
            <div class="inline-flex rounded-lg border border-gray-200 dark:border-white/10 overflow-hidden text-sm">
              <button
                @click="quickMode = 'simple'"
                :class="[
                  'px-3 py-1.5',
                  quickMode === 'simple'
                    ? 'bg-brand-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                ]"
              >
                Simple
              </button>
              <button
                @click="quickMode = 'advanced'"
                :class="[
                  'px-3 py-1.5',
                  quickMode === 'advanced'
                    ? 'bg-brand-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                ]"
              >
                Advanced
              </button>
            </div>
          </div> -->
          <div class="flex gap-4">
            <!-- Left: Field palette (drag to rows/columns) -->
            <aside class="w-96 flex-none bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div class="p-3 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
                <div class="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">Field Palette</div>
              </div>
              <div class="p-2 max-h-[60vh] overflow-y-auto">
                <!-- Simple mode: checkboxes -->
                <ul class="space-y-1">
                  <li
                    v-for="f in editFields"
                    :key="f.key"
                    class="px-3 py-2 rounded flex items-center gap-2 cursor-pointer"
                    :class="quickCreateSelected.has(f.key) ? 'bg-gray-100 dark:bg-white/10' : 'hover:bg-gray-50 dark:hover:bg-white/5'"
                    @click="toggleQuickRow(f)"
                    :title="f.required ? 'Required field is always included' : ''"
                  >
                    <input type="checkbox" :checked="quickCreateSelected.has(f.key)" :disabled="f.required" @change.stop="toggleQuickCreate(f.key, $event.target.checked)" />
                    <span class="text-sm text-gray-800 dark:text-gray-200 truncate">{{ f.label || f.key }}</span>
                  </li>
                </ul>
              </div>
              <div class="p-3 border-t border-gray-200 dark:border-white/10">
                <div class="text-xs text-gray-500 dark:text-gray-400">Select fields to include in Quick Create.</div>
              </div>
            </aside>
            <!-- Right: Simple list -->
            <section class="flex-1 min-w-0 space-y-6">
              <!-- Simple mode rendering -->
              <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <div class="p-3 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
                  <div class="text-sm font-semibold text-gray-800 dark:text-gray-200">Selected Fields (ordered)</div>
                </div>
                <div class="p-4 space-y-2">
                  <div v-if="orderedQuickCreate.length === 0" class="text-sm text-gray-600 dark:text-gray-400">No fields selected.</div>
                  <div v-for="f in orderedQuickCreate" :key="f.key" class="rounded border border-gray-200 dark:border-white/10 px-3 py-2 text-sm text-gray-800 dark:text-gray-200">
                    {{ f.label || f.key }}
                  </div>
                </div>
              </div>

              <!-- Advanced builder - Hidden for now -->
              <!-- <div v-else class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                <div class="p-3 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
                  <div class="text-sm font-semibold text-gray-800 dark:text-gray-200">Visual Builder (Rows / Columns)</div>
                  <div class="flex items-center gap-2">
                    <button @click="addRow" class="px-3 py-1.5 bg-gray-100 dark:bg-white/10 rounded text-xs">Add Row</button>
                    <button @click="openPreview()" class="px-3 py-1.5 bg-brand-600 text-white rounded text-xs">Preview</button>
                  </div>
                </div>
                <div class="p-4 space-y-4">
                  <div v-if="quickLayout.rows.length === 0" class="text-sm text-gray-600 dark:text-gray-400">No rows yet. Add a row to start.</div>
                  <div v-for="(row, ri) in quickLayout.rows" :key="ri"
                       class="border border-gray-200 dark:border-white/10 rounded-lg p-3 space-y-3"
                       :class="dragRowOver===ri ? 'ring-2 ring-brand-500/50' : ''"
                       draggable="true"
                       @dragstart="onRowDragStart(ri)"
                       @dragover.prevent="onRowDragOver(ri)"
                       @drop.prevent="onRowDrop(ri)">
                    <div class="flex items-center justify-between">
                      <div class="text-xs font-medium text-gray-700 dark:text-gray-300">Row {{ ri + 1 }}</div>
                      <div class="flex items-center gap-2">
                        <button @click="addCol(ri)" class="px-2 py-1 bg-gray-100 dark:bg-white/10 rounded text-xs">Add Column</button>
                        <button @click="removeRow(ri)" class="px-2 py-1 text-red-600 dark:text-red-400 text-xs">Remove Row</button>
                      </div>
                    </div>
                    <div class="grid grid-cols-12 gap-2"
                         @dragover.prevent="onRowDragOver(ri)"
                         @drop.prevent="onRowDrop(ri)">
                    <div v-for="(col, ci) in row.cols" :key="ci"
                           :class="[
                             'border border-dashed border-gray-300 dark:border-white/10 rounded-lg p-3',
                             spanClass(col.span),
                             dragColOver.ri === ri && dragColOver.ci === ci ? 'ring-2 ring-brand-500/50' : ''
                           ]"
                           draggable="true"
                           @dragstart="onColDragStart(ri, ci)"
                           @dragover.prevent="onColDragOver(ri, ci)"
                           @drop.prevent="onColDrop(ri, ci)">
                        <div class="flex items-center gap-2 mb-2">
                          <button class="cursor-grab text-xs text-gray-500 dark:text-gray-400" title="Drag to reorder">☰</button>
                          <label class="text-xs text-gray-600 dark:text-gray-400">Span</label>
                          <select v-model.number="col.span" class="px-2 py-1 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs">
                            <option v-for="n in 12" :key="n" :value="n">{{ n }}</option>
                          </select>
                          <button @click="removeCol(ri, ci)" class="ml-auto text-xs text-red-600 dark:text-red-400">Remove</button>
                        </div>
                        <div @dragover.prevent @drop.prevent="onColumnDrop(ri, ci, $event)" class="rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 p-3 text-sm text-gray-700 dark:text-gray-300 min-h-10 flex items-center justify-between">
                          <span class="truncate">{{ col.fieldKey ? displayFieldLabel(col.fieldKey) : 'Drop field here' }}</span>
                          <div class="flex items-center gap-2" v-if="col.fieldKey">
                            <select v-model="col.widget" class="px-2 py-1 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs">
                              <option value="input">Input</option>
                              <option value="textarea">Textarea</option>
                              <option value="select">Select</option>
                              <option value="date">Date</option>
                              <option value="number">Number</option>
                            </select>
                            <input v-model="col.props.placeholder" placeholder="Placeholder" class="px-2 py-1 rounded bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs" />
                            <button @click="clearColumnField(ri, ci)" class="text-xs text-gray-500 dark:text-gray-400">Clear</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div> -->
            </section>
          </div>
        </div>
      </section>
    </div>
    <!-- Preview Modal -->
    <div v-if="showPreview" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/50" @click="closePreview"></div>
      <div class="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 w-[90vw] max-w-4xl max-h-[85vh] overflow-auto">
        <div class="p-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
          <div class="text-sm font-semibold text-gray-800 dark:text-gray-200">Quick Create Preview</div>
          <button @click="closePreview" class="px-3 py-1.5 bg-gray-100 dark:bg-white/10 rounded text-xs">Close</button>
        </div>
        <div class="p-6 space-y-3">
          <div v-for="(row, ri) in quickLayout.rows" :key="`pv-${ri}`" class="grid grid-cols-12 gap-3">
            <div
              v-for="(col, ci) in row.cols"
              :key="`pv-${ri}-${ci}`"
              :class="[
                'bg-gray-50 dark:bg-white/5 rounded border border-gray-200 dark:border-white/10 px-3 py-2 text-sm text-gray-700 dark:text-gray-300',
                spanClass(col.span)
              ]"
            >
              <template v-if="col.fieldKey">
                <div class="text-xs font-medium text-gray-800 dark:text-gray-200">{{ displayFieldLabel(col.fieldKey) }}</div>
                <div class="mt-1">
                  <div class="w-full px-3 py-2 rounded bg-white dark:bg-transparent border border-gray-200 dark:border-white/10 text-gray-400 dark:text-gray-500 italic">
                    {{ getPreviewPlaceholder(col) }}
                  </div>
                </div>
              </template>
              <template v-else>
                <div class="text-gray-400 dark:text-gray-500">Empty</div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Module Form Modal -->
    <transition name="fade">
      <div
        v-if="isActionModalOpen && actionModalStage && actionModalAction"
        class="fixed inset-0 z-[70] flex items-center justify-center px-4 py-8"
      >
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="closeActionModal"></div>
        <div class="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between border-b border-gray-200 dark:border-white/10 px-6 py-4">
            <div class="min-w-0">
              <p class="text-sm font-semibold text-gray-900 dark:text-white">Configure Activity</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                Stage: {{ actionModalStage.name || 'Untitled stage' }} • Activity {{ actionModalActionIndex + 1 }}
              </p>
            </div>
            <div class="flex items-center gap-2">
              <button
                class="px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-300 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                @click="removePlaybookAction(actionModalStage, actionModalActionIndex)"
                :disabled="actionModalActionIndex < 0"
              >
                Delete
              </button>
              <button
                class="px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                @click="closeActionModal"
              >
                Close
              </button>
            </div>
          </div>
          <div class="max-h-[calc(90vh-4.5rem)] overflow-y-auto px-6 py-6 space-y-6">
            <div class="space-y-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-white/5 p-5">
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Summary</h3>
                <span class="text-xs text-gray-500 dark:text-gray-400">Key details about this activity</span>
              </div>
              <div class="grid gap-4 md:grid-cols-2">
                <div>
                  <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Title</label>
                  <input
                    v-model="actionModalAction.title"
                    @change="refreshPlaybookActionKey(actionModalStage, actionModalAction)"
                    class="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 text-sm"
                    placeholder="e.g., Send proposal"
                  />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Action Type</label>
                  <select
                    v-model="actionModalAction.actionType"
                    class="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 text-sm"
                  >
                    <option v-for="option in PLAYBOOK_ACTION_TYPES" :key="option.value" :value="option.value">{{ option.label }}</option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Due (days after stage entry)</label>
                  <input
                    type="number"
                    min="0"
                    v-model.number="actionModalAction.dueInDays"
                    class="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 text-sm"
                  />
                  <p class="mt-1 text-[11px] text-gray-500 dark:text-gray-400">Set to 0 if the activity should occur on the same day.</p>
                </div>
                <div>
                  <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Assignment</label>
                  <select
                    v-model="actionModalAction.assignment.type"
                    class="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 text-sm"
                  >
                    <option v-for="option in PLAYBOOK_ASSIGNMENT_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
                  </select>
                  <input
                    v-if="['specific_user', 'role', 'team'].includes(actionModalAction.assignment.type)"
                    v-model="actionModalAction.assignment.targetName"
                    class="mt-2 w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 text-sm"
                    :placeholder="`Specify ${actionModalAction.assignment.type.replace('_', ' ')}`"
                  />
                </div>
              </div>
              <div class="flex flex-wrap items-center gap-6">
                <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input type="checkbox" v-model="actionModalAction.required" class="rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500" />
                  Required to complete stage
                </label>
                <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input type="checkbox" v-model="actionModalAction.autoCreate" class="rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500" />
                  Auto-create when stage starts
                </label>
              </div>
              <div>
                <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Description</label>
                <textarea
                  v-model="actionModalAction.description"
                  rows="3"
                  class="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 text-sm"
                  placeholder="Add context or instructions for the team..."
                ></textarea>
              </div>
            </div>

            <div class="space-y-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-white/5 p-5">
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Trigger & Automation</h3>
                <span class="text-xs text-gray-500 dark:text-gray-400">When should this activity become active?</span>
              </div>
              <div class="grid gap-4 md:grid-cols-2">
                <div>
                  <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Trigger Type</label>
                  <select
                    v-model="actionModalAction.trigger.type"
                    @change="handleTriggerTypeChange(actionModalAction)"
                    class="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 text-sm"
                  >
                    <option v-for="option in PLAYBOOK_TRIGGER_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
                  </select>
                </div>
                <div v-if="actionModalAction.trigger.type === 'after_action'">
                  <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Wait for activity</label>
                  <select
                    v-model="actionModalAction.trigger.sourceActionKey"
                    class="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 text-sm"
                  >
                    <option value="">Select activity...</option>
                    <option v-for="option in getActionOptions(actionModalStage, actionModalAction)" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                  <p class="mt-1 text-[11px] text-gray-500 dark:text-gray-400">The activity will unlock after the selected one is marked complete.</p>
                </div>
              </div>
              <div v-if="actionModalAction.trigger.type === 'time_delay'" class="grid gap-4 md:grid-cols-2">
                <div>
                  <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Delay amount</label>
                  <input
                    type="number"
                    min="0"
                    :value="actionModalAction.trigger.delay?.amount ?? 0"
                    @input="updateTriggerDelayAmount(actionModalAction, $event.target.value)"
                    class="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 text-sm"
                  />
                </div>
                <div>
                  <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Delay unit</label>
                  <select
                    :value="actionModalAction.trigger.delay?.unit || 'hours'"
                    @change="updateTriggerDelayUnit(actionModalAction, $event.target.value)"
                    class="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 text-sm"
                  >
                    <option v-for="option in PLAYBOOK_DELAY_UNIT_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
                  </select>
                </div>
              </div>
              <div v-if="actionModalAction.trigger.type === 'custom'" class="space-y-2">
                <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Custom trigger details</label>
                <textarea
                  v-model="actionModalAction.trigger.description"
                  rows="3"
                  class="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 text-sm"
                  placeholder="Describe the custom conditions or automations required."
                ></textarea>
              </div>
              <div v-if="actionModalAction.trigger.conditions?.length" class="rounded-lg bg-white/70 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 p-3 text-xs text-gray-600 dark:text-gray-300">
                <p class="font-medium mb-2">Existing conditions</p>
                <ul class="space-y-1">
                  <li v-for="(condition, conditionIndex) in actionModalAction.trigger.conditions" :key="conditionIndex">
                    • {{ condition.field || 'Field' }} {{ condition.operator || 'equals' }} {{ condition.value ?? '—' }}
                  </li>
                </ul>
              </div>
            </div>

            <div class="space-y-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-white/5 p-5">
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Dependencies</h3>
                <span class="text-xs text-gray-500 dark:text-gray-400">Control the order activities unlock</span>
              </div>
              <div v-if="getActionOptions(actionModalStage, actionModalAction).length" class="space-y-2">
                <label
                  v-for="option in getActionOptions(actionModalStage, actionModalAction)"
                  :key="option.value"
                  class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    :checked="actionModalAction.dependencies?.includes(option.value)"
                    @change="toggleActionDependency(actionModalStage, actionModalAction, option.value, $event.target.checked)"
                    class="rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500"
                  />
                  {{ option.label }}
                </label>
              </div>
              <div v-else class="text-xs text-gray-500 dark:text-gray-400">
                Add at least one more activity to set dependencies.
              </div>
            </div>

            <div class="space-y-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-white/5 p-5">
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Alerts & Reminders</h3>
                <button
                  class="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors shadow-sm hover:shadow"
                  @click="addActionAlert(actionModalStage, actionModalAction)"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Add alert
                </button>
              </div>
              <div v-if="!actionModalAction.alerts?.length" class="rounded-lg border border-dashed border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/40 px-4 py-6 text-xs text-gray-500 dark:text-gray-400 text-center">
                No alerts configured. Add reminders to keep owners on track.
              </div>
              <div v-else class="space-y-4">
                <div
                  v-for="(alert, alertIndex) in actionModalAction.alerts"
                  :key="alertIndex"
                  class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/70 p-4 space-y-4"
                >
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Alert {{ alertIndex + 1 }}</span>
                    <button
                      class="text-xs text-red-600 dark:text-red-300 hover:underline"
                      @click="removeActionAlert(actionModalStage, actionModalAction, alertIndex)"
                    >
                      Remove
                    </button>
                  </div>
                  <div class="grid gap-4 md:grid-cols-2">
                    <div>
                      <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Alert Type</label>
                      <select
                        v-model="alert.type"
                        class="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 text-sm"
                      >
                        <option v-for="option in PLAYBOOK_ALERT_TYPE_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
                      </select>
                    </div>
                    <div>
                      <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Send offset</label>
                      <div class="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          :value="alert.offset?.amount ?? 0"
                          @input="updateAlertOffsetAmount(alert, $event.target.value)"
                          class="w-24 px-3 py-2 rounded-lg bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 text-sm"
                        />
                        <select
                          :value="alert.offset?.unit || 'hours'"
                          @change="updateAlertOffsetUnit(alert, $event.target.value)"
                          class="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 text-sm"
                        >
                          <option v-for="option in PLAYBOOK_DELAY_UNIT_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Recipients (comma separated emails/usernames)</label>
                    <input
                      :value="(alert.recipients || []).join(', ')"
                      @input="updateAlertRecipients(alert, $event.target.value)"
                      class="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 text-sm"
                      placeholder="e.g., revenue-ops@company.com, manager@company.com"
                    />
                  </div>
                  <div>
                    <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Message</label>
                    <textarea
                      v-model="alert.message"
                      rows="2"
                      class="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 text-sm"
                      placeholder="Reminder content that will be sent to recipients"
                    ></textarea>
                  </div>
                </div>
              </div>
            </div>

            <div class="space-y-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-white/5 p-5">
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Resources</h3>
                <button
                  class="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors shadow-sm hover:shadow"
                  @click="addActionResource(actionModalStage, actionModalAction)"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Add resource
                </button>
              </div>
              <div v-if="!actionModalAction.resources?.length" class="rounded-lg border border-dashed border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/40 px-4 py-6 text-xs text-gray-500 dark:text-gray-400 text-center">
                No supporting documents yet. Attach collateral to speed up execution.
              </div>
              <div v-else class="space-y-4">
                <div
                  v-for="(resource, resourceIndex) in actionModalAction.resources"
                  :key="resourceIndex"
                  class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/70 p-4 space-y-4"
                >
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Resource {{ resourceIndex + 1 }}</span>
                    <button
                      class="text-xs text-red-600 dark:text-red-300 hover:underline"
                      @click="removeActionResource(actionModalStage, actionModalAction, resourceIndex)"
                    >
                      Remove
                    </button>
                  </div>
                  <div class="grid gap-4 md:grid-cols-2">
                    <div>
                      <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Name</label>
                      <input
                        v-model="resource.name"
                        class="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 text-sm"
                        placeholder="e.g., Proposal template"
                      />
                    </div>
                    <div>
                      <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Type</label>
                      <select
                        v-model="resource.type"
                        class="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 text-sm"
                      >
                        <option v-for="option in PLAYBOOK_RESOURCE_TYPES" :key="option.value" :value="option.value">{{ option.label }}</option>
                      </select>
                    </div>
                    <div class="md:col-span-2">
                      <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">URL or attachment reference</label>
                      <input
                        v-model="resource.url"
                        class="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 text-sm"
                        placeholder="https://..."
                      />
                    </div>
                    <div class="md:col-span-2">
                      <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">Description</label>
                      <textarea
                        v-model="resource.description"
                        rows="2"
                        class="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-700 text-sm"
                        placeholder="What should the team know about this resource?"
                      ></textarea>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <ModuleFormModal
      v-if="showFormModal"
      :module="editingModule"
      @close="closeFormModal"
      @saved="handleModuleSaved"
    />
  </div>
</template>

<script setup>
  import { ref, onMounted, computed, watch, reactive, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import ModuleFormModal from './ModuleFormModal.vue';

const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();
const modules = ref([]);
const loading = ref(false);
const selectedModuleId = ref(null);
const showFormModal = ref(false);
const editingModule = ref(null);
const editFields = ref([]);
const selectedFieldIdx = ref(0);
// Filter modules for display - exclude 'users' from main list (it's only for lookups)
const displayModules = computed(() => modules.value.filter(m => m.key !== 'users'));
const optionsBuffer = ref('');
const allowedValuesBuffers = ref({});
const fieldTypes = [
  'Text',
  'Text-Area',
  'Rich Text',
  'Integer',
  'Decimal',
  'Currency',
  'Date',
  'Date-Time',
  'Picklist',
  'Multi-Picklist',
  'Checkbox',
  'Radio Button',
  'Email',
  'Phone',
  'URL',
  'Auto-Number',
  'Lookup (Relationship)',
  'Formula',
  'Rollup Summary'
];
const selectedModule = computed(() => modules.value.find(m => m._id === selectedModuleId.value));
const dragStartIdx = ref(null);
const dragOverIdx = ref(null);
const baseTopTabs = [
  { id: 'details', name: 'Module details' },
  { id: 'fields', name: 'Field Configurations' },
  { id: 'relationships', name: 'Relationships' },
  { id: 'quick', name: 'Quick Create' }
];
const TOP_TAB_IDS_BASE = ['details', 'fields', 'relationships', 'quick'];
function getAllowedTopTabs(moduleKey) {
  if (moduleKey === 'deals') {
    return [...TOP_TAB_IDS_BASE, 'pipeline', 'playbooks'];
  }
  return [...TOP_TAB_IDS_BASE];
}
const topTabs = computed(() => {
  const moduleKey = selectedModule.value?.key;
  const tabs = [...baseTopTabs];
  if (moduleKey === 'deals') {
    tabs.push({ id: 'pipeline', name: 'Pipeline Settings' });
    tabs.push({ id: 'playbooks', name: 'Playbook Configuration' });
  }
  return tabs;
});
const tabTitleMap = {
  details: 'Module Details',
  fields: 'Field Configurations',
  relationships: 'Relationships',
  quick: 'Quick Create',
  pipeline: 'Pipeline Settings',
  playbooks: 'Playbook Configuration'
};
const currentTopTabLabel = computed(() => tabTitleMap[activeTopTab.value] || 'Module Details');
// Initialize activeTopTab from URL or localStorage, default to 'fields'
const getInitialTab = () => {
  // First check URL query
  const route = useRoute();
  const modeKey = typeof route.query.mode === 'string' ? route.query.mode : null;
  if (modeKey && ['details', 'fields', 'relationships', 'quick'].includes(modeKey)) {
    return modeKey;
  }
  // If no URL param, we'll check localStorage after module loads
  return 'fields';
};
const activeTopTab = ref(getInitialTab());
const moduleNameEdit = ref('');
const moduleEnabled = ref(true);
const relationships = ref([]);
const quickCreateSelected = ref(new Set());
const quickLayout = ref({ version: 1, rows: [] });
const quickMode = ref('simple'); // Advanced mode hidden for now
const showPreview = ref(false);
const originalSnapshot = ref('');
const quickOriginalSnapshot = ref('');
const isInitializingQuickCreate = ref(false);
const dragColSrc = ref({ ri: null, ci: null });
const dragColOver = ref({ ri: null, ci: null });
const dragRowSrc = ref(null);
const dragRowOver = ref(null);
// Tailwind safelist for col-span classes
const colSpanClasses = [
  'col-span-1','col-span-2','col-span-3','col-span-4','col-span-5','col-span-6',
  'col-span-7','col-span-8','col-span-9','col-span-10','col-span-11','col-span-12'
];

const pipelineSettings = ref([]);
const selectedPipelineKey = ref('');
const stageSettingsExpanded = ref({});
const actionModalState = reactive({
  open: false,
  stageKey: '',
  actionIndex: null
});
const pipelineStageStatusOptions = [
  { value: 'open', label: 'Open' },
  { value: 'won', label: 'Won (Closed)' },
  { value: 'lost', label: 'Lost (Closed)' },
  { value: 'stalled', label: 'Stalled' }
];
const DEFAULT_PIPELINE_COLOR = '#2563EB';
const DEFAULT_STAGE_DEFINITIONS = [
  { name: 'Qualification', probability: 25, status: 'open' },
  { name: 'Proposal', probability: 50, status: 'open' },
  { name: 'Negotiation', probability: 70, status: 'open' },
  { name: 'Contract Sent', probability: 85, status: 'open' },
  { name: 'Closed Won', probability: 100, status: 'won' },
  { name: 'Closed Lost', probability: 0, status: 'lost' }
];

const PLAYBOOK_ACTION_TYPES = [
  { value: 'task', label: 'Task' },
  { value: 'call', label: 'Call' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'email', label: 'Email' },
  { value: 'event', label: 'Event' },
  { value: 'document', label: 'Document Upload' },
  { value: 'approval', label: 'Approval' },
  { value: 'alert', label: 'Alert / Reminder' },
  { value: 'other', label: 'Other' }
];

const PLAYBOOK_MODE_OPTIONS = [
  { value: 'sequential', label: 'Sequential (guided steps)' },
  { value: 'non_sequential', label: 'Flexible (complete in any order)' }
];

const PLAYBOOK_EXIT_OPTIONS = [
  { value: 'manual', label: 'Manual: team decides when to move' },
  { value: 'all_actions_completed', label: 'Automatic when all actions complete' },
  { value: 'any_action_completed', label: 'Automatic when any action completes' },
  { value: 'custom', label: 'Custom conditions' }
];

const PLAYBOOK_TRIGGER_OPTIONS = [
  { value: 'stage_entry', label: 'On stage entry' },
  { value: 'after_action', label: 'After another action completes' },
  { value: 'time_delay', label: 'After a time delay' },
  { value: 'custom', label: 'Custom conditions' }
];

const PLAYBOOK_ALERT_TYPE_OPTIONS = [
  { value: 'in_app', label: 'In-app' },
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' }
];

const PLAYBOOK_DELAY_UNIT_OPTIONS = [
  { value: 'minutes', label: 'Minutes' },
  { value: 'hours', label: 'Hours' },
  { value: 'days', label: 'Days' }
];

const PLAYBOOK_RESOURCE_TYPES = [
  { value: 'document', label: 'Document' },
  { value: 'link', label: 'Link' },
  { value: 'form', label: 'Form' },
  { value: 'template', label: 'Template' },
  { value: 'other', label: 'Other' }
];

const PLAYBOOK_ASSIGNMENT_OPTIONS = [
  { value: 'deal_owner', label: 'Deal Owner' },
  { value: 'stage_owner', label: 'Stage Owner' },
  { value: 'role', label: 'Role' },
  { value: 'team', label: 'Team' },
  { value: 'specific_user', label: 'Specific User' }
];

function slugify(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || `item-${Date.now()}`;
}

function normalizePlaybookAssignment(assignment = {}) {
  const type = PLAYBOOK_ASSIGNMENT_OPTIONS.some(opt => opt.value === assignment.type)
    ? assignment.type
    : 'deal_owner';
  return {
    type,
    targetId: assignment.targetId || null,
    targetType: assignment.targetType || '',
    targetName: assignment.targetName || ''
  };
}

function normalizeActionTrigger(trigger = {}) {
  const type = PLAYBOOK_TRIGGER_OPTIONS.some(opt => opt.value === trigger.type)
    ? trigger.type
    : 'stage_entry';
  let delay = null;
  if (trigger.delay && typeof trigger.delay === 'object') {
    const amount = Math.max(0, Number(trigger.delay.amount) || 0);
    const unit = PLAYBOOK_DELAY_UNIT_OPTIONS.some(opt => opt.value === trigger.delay.unit)
      ? trigger.delay.unit
      : 'days';
    delay = { amount, unit };
  }
  const conditions = Array.isArray(trigger.conditions)
    ? trigger.conditions.map(condition => ({
        field: condition.field || '',
        operator: condition.operator || 'equals',
        value: condition.value
      }))
    : [];
  return {
    type,
    sourceActionKey: trigger.sourceActionKey ? slugify(trigger.sourceActionKey) : '',
    delay,
    conditions,
    description: trigger.description || ''
  };
}

function normalizeActionAlerts(alerts = []) {
  if (!Array.isArray(alerts)) return [];
  return alerts.map(alert => {
    const type = PLAYBOOK_ALERT_TYPE_OPTIONS.some(opt => opt.value === alert.type)
      ? alert.type
      : 'in_app';
    let offset = null;
    if (alert.offset && typeof alert.offset === 'object') {
      const amount = Math.max(0, Number(alert.offset.amount) || 0);
      const unit = PLAYBOOK_DELAY_UNIT_OPTIONS.some(opt => opt.value === alert.offset.unit)
        ? alert.offset.unit
        : 'hours';
      offset = { amount, unit };
    }
    const recipients = Array.isArray(alert.recipients)
      ? alert.recipients.map(r => String(r || '').trim()).filter(Boolean)
      : [];
    return {
      type,
      offset,
      recipients,
      message: alert.message || ''
    };
  });
}

function normalizeActionResources(resources = []) {
  if (!Array.isArray(resources)) return [];
  return resources.map(resource => ({
    name: resource?.name || '',
    type: PLAYBOOK_RESOURCE_TYPES.some(opt => opt.value === resource?.type) ? resource.type : 'document',
    url: resource?.url || '',
    description: resource?.description || ''
  }));
}

function createStagePlaybook(stageKey, stageName, status = 'open', source = null) {
  const baseExitType = (status === 'won' || status === 'lost') ? 'manual' : 'all_actions_completed';
  const exitCriteria = source?.exitCriteria || {};
  const normalizedExitType = PLAYBOOK_EXIT_OPTIONS.some(opt => opt.value === exitCriteria.type)
    ? exitCriteria.type
    : baseExitType;

  const actionsSource = Array.isArray(source?.actions) ? source.actions : [];
  const actionKeys = new Set();
  const actions = actionsSource.map((action, index) => {
    const title = (action.title || `Action ${index + 1}`).trim();
    let key = action.key ? slugify(action.key) : slugify(`${stageKey}-${title}-${index}`);
    while (actionKeys.has(key)) {
      key = `${key}-${index}`;
    }
    actionKeys.add(key);
    return {
      key,
      title,
      description: action.description || '',
      actionType: PLAYBOOK_ACTION_TYPES.some(opt => opt.value === action.actionType) ? action.actionType : 'task',
      dueInDays: Math.max(0, Number(action.dueInDays) || 0),
      assignment: normalizePlaybookAssignment(action.assignment),
      required: action.required !== false,
      dependencies: Array.isArray(action.dependencies) ? action.dependencies.filter(Boolean) : [],
      autoCreate: action.autoCreate !== false,
      trigger: normalizeActionTrigger(action.trigger),
      alerts: normalizeActionAlerts(action.alerts),
      resources: normalizeActionResources(action.resources),
      metadata: typeof action.metadata === 'object' && action.metadata !== null ? { ...action.metadata } : {}
    };
  });

  // Remove dependencies that no longer exist after normalization
  const validKeys = new Set(actions.map(action => action.key));
  actions.forEach(action => {
    action.dependencies = action.dependencies.filter(dep => validKeys.has(dep) && dep !== action.key);
  });

  return {
    enabled: source?.enabled === true,
    mode: PLAYBOOK_MODE_OPTIONS.some(opt => opt.value === source?.mode) ? source.mode : 'sequential',
    autoAdvance: source?.autoAdvance === true,
    notes: source?.notes || '',
    actions,
    exitCriteria: {
      type: normalizedExitType,
      customDescription: exitCriteria.customDescription || '',
      nextStageKey: exitCriteria.nextStageKey ? slugify(exitCriteria.nextStageKey) : '',
      conditions: Array.isArray(exitCriteria.conditions)
        ? exitCriteria.conditions.map(condition => ({
            field: condition.field || '',
            operator: condition.operator || 'equals',
            value: condition.value
          }))
        : []
    }
  };
}

function buildStageFromDefinition(def, pipelineKey, order) {
  const name = (def.name || `Stage ${order + 1}`).trim();
  const status = ['open', 'won', 'lost', 'stalled'].includes(def.status) ? def.status : 'open';
  let probability = typeof def.probability === 'number' ? def.probability : 0;
  if (status === 'won') probability = 100;
  if (status === 'lost') probability = 0;
  probability = Math.min(100, Math.max(0, Number(probability) || 0));
  const key = slugify(`${pipelineKey}-${name}-${order}`) || `${pipelineKey}-stage-${order + 1}`;
  return {
    key,
    name,
    description: def.description || '',
    probability,
    status,
    order,
    isClosedWon: status === 'won',
    isClosedLost: status === 'lost',
    playbook: createStagePlaybook(key, name, status, def.playbook || null)
  };
}

function createDefaultPipeline(name = 'Default Pipeline', { isDefault = false } = {}) {
  const pipelineKey = slugify(name) || `pipeline-${Date.now()}`;
  const stages = DEFAULT_STAGE_DEFINITIONS.map((def, index) => buildStageFromDefinition(def, pipelineKey, index));
  return {
    key: pipelineKey,
    name,
    description: '',
    color: DEFAULT_PIPELINE_COLOR,
    isDefault,
    order: 0,
    stages
  };
}

function getDefaultPipelineSettingsLocal() {
  return [createDefaultPipeline('Default Pipeline', { isDefault: true })];
}

function normalizePipelineSettings(settings = []) {
  const source = Array.isArray(settings) && settings.length ? settings : getDefaultPipelineSettingsLocal();
  const normalized = source.map((pipeline, pipelineIndex) => {
    const name = (pipeline.name || `Pipeline ${pipelineIndex + 1}`).trim();
    let key = pipeline.key ? slugify(pipeline.key) : slugify(name);
    if (!key) key = `pipeline-${pipelineIndex + 1}`;
    const color = pipeline.color || DEFAULT_PIPELINE_COLOR;
    const description = pipeline.description || '';
    const stagesSource = Array.isArray(pipeline.stages) && pipeline.stages.length ? pipeline.stages : DEFAULT_STAGE_DEFINITIONS;
    const stages = stagesSource.map((stage, stageIndex) => {
      const stageName = (stage.name || DEFAULT_STAGE_DEFINITIONS[stageIndex]?.name || `Stage ${stageIndex + 1}`).trim();
      let stageKeyRaw = stage.key ? slugify(stage.key) : slugify(`${key}-${stageName}`);
      if (!stageKeyRaw) stageKeyRaw = `${key}-stage-${stageIndex + 1}`;
      const status = ['open', 'won', 'lost', 'stalled'].includes(stage.status) ? stage.status : (DEFAULT_STAGE_DEFINITIONS[stageIndex]?.status || 'open');
      let probability = typeof stage.probability === 'number' ? stage.probability : (DEFAULT_STAGE_DEFINITIONS[stageIndex]?.probability ?? 0);
      if (status === 'won') probability = 100;
      if (status === 'lost') probability = 0;
      probability = Math.min(100, Math.max(0, Number(probability) || 0));
      const stageKey = stageKeyRaw;
      return {
        key: stageKey,
        name: stageName,
        description: stage.description || '',
        probability,
        status,
        order: stageIndex,
        isClosedWon: status === 'won',
        isClosedLost: status === 'lost',
        playbook: createStagePlaybook(stageKey, stageName, status, stage.playbook || null)
      };
    });
    return {
      key,
      name,
      description,
      color,
      isDefault: pipeline.isDefault === true,
      order: pipelineIndex,
      stages
    };
  });

  if (!normalized.length) {
    return normalizePipelineSettings(getDefaultPipelineSettingsLocal());
  }

  const seenKeys = new Set();
  normalized.forEach((pipeline, index) => {
    let baseKey = pipeline.key;
    while (seenKeys.has(pipeline.key)) {
      pipeline.key = `${baseKey}-${index}`;
    }
    seenKeys.add(pipeline.key);
    pipeline.order = index;
  });

  let defaultFound = false;
  normalized.forEach((pipeline, index) => {
    if (pipeline.isDefault && !defaultFound) {
      defaultFound = true;
    } else if (pipeline.isDefault && defaultFound) {
      pipeline.isDefault = false;
    }
    pipeline.order = index;
  });
  if (!defaultFound) {
    normalized[0].isDefault = true;
  }

  normalized.forEach(pipeline => {
    const stageKeys = new Set();
    pipeline.stages = pipeline.stages.map((stage, stageIndex) => {
      let baseKey = stage.key;
      while (stageKeys.has(baseKey)) {
        baseKey = `${stage.key}-${stageIndex}`;
      }
      stageKeys.add(baseKey);
      const status = ['open', 'won', 'lost', 'stalled'].includes(stage.status) ? stage.status : 'open';
      let probability = Math.min(100, Math.max(0, Number(stage.probability) || 0));
      if (status === 'won') probability = 100;
      if (status === 'lost') probability = 0;
      return {
        key: baseKey,
        name: (stage.name || `Stage ${stageIndex + 1}`).trim(),
        description: stage.description || '',
        probability,
        status,
        order: stageIndex,
        isClosedWon: status === 'won',
        isClosedLost: status === 'lost'
      };
    });
  });

  return normalized;
}

const pipelineTabEnabled = computed(() => selectedModule.value?.key === 'deals');
const currentPipeline = computed(() => {
  if (!pipelineTabEnabled.value) return null;
  let pipeline = null;

  if (selectedPipelineKey.value) {
    pipeline = pipelineSettings.value.find(p => p.key === selectedPipelineKey.value) || null;
  }

  if (!pipeline && pipelineSettings.value.length) {
    pipeline = pipelineSettings.value[0];
  }

  return pipeline || null;
});

const actionModalStage = computed(() => {
  if (!actionModalState.open) return null;
  const pipeline = currentPipeline.value;
  if (!pipeline || !Array.isArray(pipeline.stages)) return null;
  return pipeline.stages.find(stage => stage.key === actionModalState.stageKey) || null;
});

const actionModalAction = computed(() => {
  const stage = actionModalStage.value;
  if (!stage || !Array.isArray(stage.playbook?.actions)) return null;
  const index = actionModalState.actionIndex;
  if (typeof index !== 'number' || index < 0) return null;
  return stage.playbook.actions[index] || null;
});

const actionModalActionIndex = computed(() =>
  typeof actionModalState.actionIndex === 'number' ? actionModalState.actionIndex : -1
);

const isActionModalOpen = computed(() => !!(actionModalState.open && actionModalStage.value && actionModalAction.value));

function ensurePipelineSelection() {
  if (!pipelineTabEnabled.value || pipelineSettings.value.length === 0) {
    selectedPipelineKey.value = '';
    return;
  }
  if (!pipelineSettings.value.some(p => p.key === selectedPipelineKey.value)) {
    selectedPipelineKey.value = pipelineSettings.value[0].key;
  }
}

function hydratePipelineSettingsFromModule(mod) {
  if (!mod || mod.key !== 'deals') {
    pipelineSettings.value = [];
    selectedPipelineKey.value = '';
    return;
  }

  const raw = Array.isArray(mod.pipelineSettings)
    ? JSON.parse(JSON.stringify(mod.pipelineSettings))
    : [];

  const normalized = normalizePipelineSettings(raw).map(pipeline => {
    const stages = Array.isArray(pipeline.stages) ? pipeline.stages : [];
    const hydratedStages = stages.map((stage, index) => {
      const stageClone = { ...stage, order: index };
      ensureStageStructure(stageClone);
      return stageClone;
    });

    const finalStages = hydratedStages.length
      ? hydratedStages
      : DEFAULT_STAGE_DEFINITIONS.map((def, index) => {
          const stageFromDefault = buildStageFromDefinition(def, pipeline.key, index);
          ensureStageStructure(stageFromDefault);
          return stageFromDefault;
        });

    try {
      console.log('[Pipeline Hydrate] pipeline', pipeline.name, 'stages:', finalStages.map(stage => stage?.name || `Stage ${stage?.order ?? -1}`));
    } catch (e) {
      console.log('[Pipeline Hydrate] pipeline', pipeline.name, 'stages count:', finalStages.length);
    }

    return {
      ...pipeline,
      stages: finalStages
    };
  });

  pipelineSettings.value = normalized;
  ensurePipelineSelection();
}


function refreshPipelineOrders() {
  pipelineSettings.value.forEach((pipeline, index) => {
    pipeline.order = index;
    pipeline.stages.forEach((stage, stageIndex) => {
      stage.order = stageIndex;
    });
  });
}

function addPipeline() {
  const count = pipelineSettings.value.length;
  const name = count === 0 ? 'Default Pipeline' : `Pipeline ${count + 1}`;
  const isDefault = count === 0 && !pipelineSettings.value.some(p => p.isDefault);
  const pipeline = createDefaultPipeline(name, { isDefault });
  pipeline.order = count;
  pipelineSettings.value.push(pipeline);
  selectedPipelineKey.value = pipeline.key;
  ensurePipelineSelection();
}

function removePipeline(pipelineKey) {
  if (pipelineSettings.value.length <= 1) {
    alert('At least one pipeline is required.');
    return;
  }
  const index = pipelineSettings.value.findIndex(p => p.key === pipelineKey);
  if (index === -1) return;
  const [removed] = pipelineSettings.value.splice(index, 1);
  if (removed?.isDefault && pipelineSettings.value.length) {
    pipelineSettings.value[0].isDefault = true;
  }
  refreshPipelineOrders();
  ensurePipelineSelection();
}

function movePipeline(pipelineKey, direction) {
  const index = pipelineSettings.value.findIndex(p => p.key === pipelineKey);
  if (index === -1) return;
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= pipelineSettings.value.length) return;
  const [pipeline] = pipelineSettings.value.splice(index, 1);
  pipelineSettings.value.splice(newIndex, 0, pipeline);
  refreshPipelineOrders();
}

function setDefaultPipeline(pipelineKey) {
  pipelineSettings.value.forEach(p => {
    p.isDefault = (p.key === pipelineKey);
  });
}

function addStageToPipeline(pipeline) {
  if (!pipeline) return;
  const stageIndex = pipeline.stages.length;
  const baseDef = { name: `Stage ${stageIndex + 1}`, probability: 0, status: 'open' };
  const newStage = buildStageFromDefinition(baseDef, pipeline.key, stageIndex);
  ensureStageStructure(newStage);
  if (!newStage.playbook.actions.length) {
    newStage.playbook.actions.push({
      key: slugify(`${newStage.key}-action-1`),
      title: 'New activity',
      description: '',
      actionType: 'task',
      dueInDays: 0,
      assignment: normalizePlaybookAssignment({ type: 'deal_owner' }),
      required: true,
      dependencies: [],
      autoCreate: true,
      trigger: normalizeActionTrigger({ type: 'stage_entry' }),
      alerts: [],
      resources: [],
      metadata: {}
    });
  }
  pipeline.stages.push(newStage);
}

function removeStageFromPipeline(pipeline, stageIndex) {
  if (!pipeline) return;
  if (pipeline.stages.length <= 1) {
    alert('A pipeline must contain at least one stage.');
    return;
  }
  pipeline.stages.splice(stageIndex, 1);
  pipeline.stages.forEach((stage, idx) => (stage.order = idx));
}

function moveStage(pipeline, stageIndex, direction) {
  if (!pipeline) return;
  const newIndex = stageIndex + direction;
  if (newIndex < 0 || newIndex >= pipeline.stages.length) return;
  const [stage] = pipeline.stages.splice(stageIndex, 1);
  pipeline.stages.splice(newIndex, 0, stage);
  pipeline.stages.forEach((s, idx) => (s.order = idx));
}

function isStageSettingsOpen(stage) {
  if (!stage) return false;
  return !!stageSettingsExpanded.value[stage.key];
}

function toggleStageSettings(stageKey) {
  if (!stageKey) return;
  stageSettingsExpanded.value = {
    ...stageSettingsExpanded.value,
    [stageKey]: !stageSettingsExpanded.value[stageKey]
  };
}

function openActionModal(stage, actionIndex = 0) {
  if (!stage) return;
  ensureStagePlaybook(stage);
  const clampedIndex = Math.min(
    Math.max(0, typeof actionIndex === 'number' ? actionIndex : 0),
    stage.playbook.actions.length - 1
  );
  actionModalState.open = true;
  actionModalState.stageKey = stage.key;
  actionModalState.actionIndex = clampedIndex;
}

function closeActionModal() {
  actionModalState.open = false;
  actionModalState.stageKey = '';
  actionModalState.actionIndex = null;
}

function ensureStagePlaybook(stage) {
  if (!stage) return;
  if (!stage.playbook || typeof stage.playbook !== 'object') {
    stage.playbook = createStagePlaybook(stage.key, stage.name, stage.status);
  }
  if (!Array.isArray(stage.playbook.actions)) {
    stage.playbook.actions = [];
  }
  if (!stage.playbook.exitCriteria) {
    stage.playbook.exitCriteria = {
      type: stage.status === 'won' || stage.status === 'lost' ? 'manual' : 'all_actions_completed',
      customDescription: '',
      nextStageKey: '',
      conditions: []
    };
  }
  stage.playbook.actions = stage.playbook.actions.map((action, index) => {
    const key = action?.key || slugify(`${stage.key}-action-${index}`);
    const title = action?.title || `Action ${index + 1}`;
    const actionType = PLAYBOOK_ACTION_TYPES.some(opt => opt.value === action?.actionType) ? action.actionType : 'task';
    const trigger = normalizeActionTrigger(action?.trigger || {});
    if (trigger.type === 'time_delay' && !trigger.delay) {
      trigger.delay = { amount: 0, unit: 'hours' };
    }
    const alerts = normalizeActionAlerts(action?.alerts || []).map(alert => {
      if (!alert.offset) {
        alert.offset = { amount: 0, unit: 'hours' };
      }
      return alert;
    });
    const resources = normalizeActionResources(action?.resources || []);
    return {
      key,
      title,
      description: action?.description || '',
      actionType,
      dueInDays: Math.max(0, Number(action?.dueInDays) || 0),
      assignment: normalizePlaybookAssignment(action?.assignment || {}),
      required: action?.required !== false,
      dependencies: Array.isArray(action?.dependencies) ? action.dependencies.filter(Boolean) : [],
      autoCreate: action?.autoCreate !== false,
      trigger,
      alerts,
      resources,
      metadata: typeof action?.metadata === 'object' && action.metadata !== null ? { ...action.metadata } : {}
    };
  });
}

function ensureStageStructure(stage) {
  if (!stage || typeof stage !== 'object') {
    return false;
  }
  ensureStagePlaybook(stage);
  return true;
}

function handlePlaybookToggle(stage) {
  ensureStagePlaybook(stage);
  if (!stage.playbook.enabled) {
    stage.playbook.autoAdvance = false;
    stage.playbook.exitCriteria.nextStageKey = '';
  }
}

function onPlaybookExitCriteriaChange(stage) {
  ensureStagePlaybook(stage);
  if (stage.playbook.exitCriteria.type === 'manual') {
    stage.playbook.autoAdvance = false;
    stage.playbook.exitCriteria.nextStageKey = '';
  }
}

function onPlaybookAutoAdvanceChange(stage) {
  ensureStagePlaybook(stage);
  if (!stage.playbook.autoAdvance) {
    stage.playbook.exitCriteria.nextStageKey = '';
  } else if (stage.playbook.exitCriteria.type === 'manual') {
    stage.playbook.exitCriteria.type = 'all_actions_completed';
  }
}

function getNextStageOptions(pipeline, currentStage) {
  if (!pipeline || !currentStage) return [];
  return pipeline.stages
    .filter(stage => stage.key !== currentStage.key)
    .map(stage => ({ value: stage.key, label: stage.name }));
}

function addPlaybookAction(stage) {
  ensureStagePlaybook(stage);
  const index = stage.playbook.actions.length;
  const title = `Action ${index + 1}`;
  let key = slugify(`${stage.key}-${title}-${Date.now()}`);
  const existingKeys = new Set(stage.playbook.actions.map(action => action.key));
  while (existingKeys.has(key)) {
    key = `${key}-${Math.floor(Math.random() * 1000)}`;
  }
  stage.playbook.actions.push({
    key,
    title,
    description: '',
    actionType: 'task',
    dueInDays: 0,
    assignment: {
      type: 'deal_owner',
      targetId: null,
      targetType: '',
      targetName: ''
    },
    required: true,
    dependencies: [],
    autoCreate: true,
    trigger: normalizeActionTrigger({ type: 'stage_entry' }),
    alerts: [],
    resources: [],
    metadata: {}
  });
  openActionModal(stage, stage.playbook.actions.length - 1);
}

function removePlaybookAction(stage, actionIndex) {
  ensureStagePlaybook(stage);
  if (actionIndex < 0 || actionIndex >= stage.playbook.actions.length) return;
  const [removed] = stage.playbook.actions.splice(actionIndex, 1);
  if (removed?.key) {
    stage.playbook.actions.forEach(action => {
      action.dependencies = action.dependencies.filter(dep => dep !== removed.key);
    });
  }
  if (actionModalState.open && stage.key === actionModalState.stageKey) {
    if (actionModalState.actionIndex === actionIndex) {
      closeActionModal();
    } else if (typeof actionModalState.actionIndex === 'number' && actionModalState.actionIndex > actionIndex) {
      actionModalState.actionIndex = Math.max(0, actionModalState.actionIndex - 1);
    }
  }
}

function movePlaybookAction(stage, actionIndex, direction) {
  ensureStagePlaybook(stage);
  const newIndex = actionIndex + direction;
  if (newIndex < 0 || newIndex >= stage.playbook.actions.length) return;
  const [action] = stage.playbook.actions.splice(actionIndex, 1);
  stage.playbook.actions.splice(newIndex, 0, action);
  if (actionModalState.open && stage.key === actionModalState.stageKey && action?.key) {
    const updatedIndex = stage.playbook.actions.findIndex(a => a.key === action.key);
    actionModalState.actionIndex = updatedIndex;
  }
}

function refreshPlaybookActionKey(stage, action) {
  ensureStagePlaybook(stage);
  if (!action || !action.title) return;
  const currentKey = action.key;
  const slugBase = slugify(`${stage.key}-${action.title}`);
  if (!slugBase) return;
  const otherKeys = new Set(stage.playbook.actions.filter(a => a !== action).map(a => a.key));
  let candidate = slugBase;
  let counter = 1;
  while (otherKeys.has(candidate)) {
    candidate = `${slugBase}-${counter++}`;
  }
  if (candidate !== currentKey) {
    stage.playbook.actions.forEach(a => {
      a.dependencies = a.dependencies.map(dep => (dep === currentKey ? candidate : dep));
    });
    action.key = candidate;
  }
}

function cleanupPlaybookDependencies(stage) {
  ensureStagePlaybook(stage);
  const validKeys = new Set(stage.playbook.actions.map(action => action.key));
  stage.playbook.actions.forEach(action => {
    action.dependencies = action.dependencies.filter(dep => dep !== action.key && validKeys.has(dep));
  });
}

function getPlaybookActionTypeLabel(actionType) {
  const option = PLAYBOOK_ACTION_TYPES.find(opt => opt.value === actionType);
  return option ? option.label : 'Task';
}

function getPlaybookAssignmentLabel(type) {
  const option = PLAYBOOK_ASSIGNMENT_OPTIONS.find(opt => opt.value === type);
  return option ? option.label : 'Deal Owner';
}

function getActionOptions(stage, currentAction) {
  if (!stage || !Array.isArray(stage.playbook?.actions)) return [];
  return stage.playbook.actions
    .filter(action => action.key !== currentAction.key)
    .map(action => ({ value: action.key, label: action.title }));
}

function toggleActionDependency(stage, action, dependencyKey, checked) {
  ensureStagePlaybook(stage);
  if (!action || !dependencyKey) return;
  if (!Array.isArray(action.dependencies)) {
    action.dependencies = [];
  }
  if (checked) {
    if (!action.dependencies.includes(dependencyKey)) {
      action.dependencies.push(dependencyKey);
    }
  } else {
    action.dependencies = action.dependencies.filter(dep => dep !== dependencyKey);
  }
}

function handleTriggerTypeChange(action) {
  if (!action) return;
  if (!action.trigger || typeof action.trigger !== 'object') {
    action.trigger = normalizeActionTrigger({});
  }
  const normalized = normalizeActionTrigger(action.trigger);
  Object.assign(action.trigger, normalized);
  if (action.trigger.type === 'after_action') {
    action.trigger.sourceActionKey = action.trigger.sourceActionKey || '';
  } else {
    action.trigger.sourceActionKey = '';
  }
  if (action.trigger.type === 'time_delay') {
    if (!action.trigger.delay) {
      action.trigger.delay = { amount: 0, unit: 'hours' };
    }
  } else {
    action.trigger.delay = null;
  }
  if (action.trigger.type !== 'custom') {
    action.trigger.conditions = [];
  }
}

function ensureTriggerDelay(action) {
  if (!action) return;
  if (!action.trigger || typeof action.trigger !== 'object') {
    action.trigger = normalizeActionTrigger({});
  }
  if (!action.trigger.delay || typeof action.trigger.delay !== 'object') {
    action.trigger.delay = { amount: 0, unit: 'hours' };
  }
}

function updateTriggerDelayAmount(action, value) {
  ensureTriggerDelay(action);
  action.trigger.delay.amount = Math.max(0, Number(value) || 0);
}

function updateTriggerDelayUnit(action, unit) {
  ensureTriggerDelay(action);
  const fallback = PLAYBOOK_DELAY_UNIT_OPTIONS[0]?.value || 'hours';
  action.trigger.delay.unit = PLAYBOOK_DELAY_UNIT_OPTIONS.some(opt => opt.value === unit) ? unit : fallback;
}

function addActionAlert(stage, action) {
  ensureStagePlaybook(stage);
  if (!Array.isArray(action.alerts)) {
    action.alerts = [];
  }
  action.alerts.push({
    type: 'in_app',
    offset: { amount: 0, unit: 'hours' },
    recipients: [],
    message: ''
  });
}

function removeActionAlert(stage, action, alertIndex) {
  if (!Array.isArray(action.alerts)) return;
  action.alerts.splice(alertIndex, 1);
}

function ensureAlertOffset(alert) {
  if (!alert) return;
  if (!alert.offset || typeof alert.offset !== 'object') {
    alert.offset = { amount: 0, unit: 'hours' };
  }
}

function updateAlertOffsetAmount(alert, value) {
  ensureAlertOffset(alert);
  alert.offset.amount = Math.max(0, Number(value) || 0);
}

function updateAlertOffsetUnit(alert, unit) {
  ensureAlertOffset(alert);
  const fallback = PLAYBOOK_DELAY_UNIT_OPTIONS[0]?.value || 'hours';
  alert.offset.unit = PLAYBOOK_DELAY_UNIT_OPTIONS.some(opt => opt.value === unit) ? unit : fallback;
}

function updateAlertRecipients(alert, value) {
  if (!alert) return;
  const recipients = String(value || '')
    .split(',')
    .map(r => r.trim())
    .filter(Boolean);
  alert.recipients = recipients;
}

function addActionResource(stage, action) {
  ensureStagePlaybook(stage);
  if (!Array.isArray(action.resources)) {
    action.resources = [];
  }
  action.resources.push({
    name: '',
    type: 'document',
    url: '',
    description: ''
  });
}

function removeActionResource(stage, action, resourceIndex) {
  if (!Array.isArray(action.resources)) return;
  action.resources.splice(resourceIndex, 1);
}

function onStageStatusChange(stage) {
  if (!stage) return;
  if (stage.status === 'won') {
    stage.probability = 100;
    stage.isClosedWon = true;
    stage.isClosedLost = false;
  } else if (stage.status === 'lost') {
    stage.probability = 0;
    stage.isClosedLost = true;
    stage.isClosedWon = false;
  } else {
    stage.isClosedWon = false;
    stage.isClosedLost = false;
  }
}

function clampStageProbability(stage) {
  if (!stage) return;
  stage.probability = Math.min(100, Math.max(0, Number(stage.probability) || 0));
  if (stage.status === 'won') stage.probability = 100;
  if (stage.status === 'lost') stage.probability = 0;
}
function spanClass(span) {
  const n = Math.min(12, Math.max(1, Number(span) || 12));
  return colSpanClasses[n - 1];
}
const subTabs = [
  { id: 'general', name: 'General' },
  { id: 'validations', name: 'Field Validation' },
  { id: 'dependencies', name: 'Dependencies' }
];
const activeSubTab = ref('general');
const fieldSearch = ref('');
const showTenantFields = ref(false); // Hide tenant fields by default

const filteredFields = computed(() => {
  let fields = editFields.value;
  
  // Filter out system fields that should never appear in the UI
  fields = fields.filter(f => {
    const keyLower = (f.key || '').toLowerCase();
    // Exclude activityLogs - it's a system field managed internally
    return keyLower !== 'activitylogs';
  });
  
  // Filter out tenant fields by default (unless showTenantFields is checked)
  // Only apply this filter for organizations module
  if (selectedModule.value?.key === 'organizations' && !showTenantFields.value) {
    // Tenant fields have keys like: subscription.*, limits.*, settings.*, slug, isActive, enabledModules
    const tenantFieldPatterns = ['subscription.', 'limits.', 'settings.', 'slug', 'isactive', 'enabledmodules'];
    fields = fields.filter(f => {
      const keyLower = (f.key || '').toLowerCase();
      // Check if field is a tenant field by key pattern OR by isTenantField flag
      const isTenantField = f.isTenantField === true || tenantFieldPatterns.some(pattern => keyLower.startsWith(pattern) || keyLower === pattern);
      return !isTenantField;
    });
  }
  
  // Apply search filter
  const q = (fieldSearch.value || '').toLowerCase();
  if (q) {
    fields = fields.filter(f => 
      (f.label || '').toLowerCase().includes(q) || 
      (f.key || '').toLowerCase().includes(q)
    );
  }
  
  return fields;
});

// Field type-specific settings
const showAddOption = ref(false);
const newOptionValue = ref('');
const newOptionColor = ref('#3B82F6'); // Default blue color
const numberSettings = ref({ min: null, max: null, decimalPlaces: 2, currencySymbol: '$' });
const textSettings = ref({ maxLength: null, rows: 4 });
const dateSettings = ref({ format: 'YYYY-MM-DD', timeFormat: '24h' });
const formulaSettings = ref({ expression: '', returnType: 'Text' });
const lookupSettings = ref({ targetModule: '', displayField: '' });

// Computed property to get lookup target module fields
const lookupTargetFields = computed(() => {
  if (!lookupSettings.value.targetModule) return [];
  const targetMod = modules.value.find(m => m.key === lookupSettings.value.targetModule);
  return targetMod?.fields || [];
});

// Check if a field is a system field that cannot be modified
function isSystemField(field) {
  if (!field || !field.key) return false;
  const systemFieldKeys = ['createdby', 'organizationid', 'createdat', 'updatedat', 'activitylogs'];
  return systemFieldKeys.includes((field.key || '').toLowerCase());
}

// Check if a field is a core field that cannot be deleted
function isCoreField(field, moduleKey) {
  if (!field || !field.key || !moduleKey) return false;
  
  // Core fields per module that cannot be deleted
  const coreFieldsByModule = {
    'people': [
      // System fields (already protected, but listed for completeness)
      'createdby', 'assignedto', 'organizationid',
      // Core business fields
      'type', 'source', 'first_name', 'last_name', 'email', 'phone', 'mobile', 'organization',
      // Lead-specific core
      'lead_status', 'lead_owner', 'lead_score',
      // Contact-specific core
      'contact_status', 'role'
    ],
    // Add other modules here if needed
    'organizations': ['name', 'organizationid', 'createdby'],
    'deals': ['name', 'organizationid', 'createdby', 'assignedto'],
    'tasks': ['title', 'organizationid', 'createdby', 'assignedto']
  };
  
  const coreFields = coreFieldsByModule[moduleKey.toLowerCase()] || [];
  return coreFields.includes((field.key || '').toLowerCase());
}

// Check if a field can be deleted
const canDeleteField = computed(() => {
  if (!currentField.value || !selectedModule.value) return false;
  return !isSystemField(currentField.value) && !isCoreField(currentField.value, selectedModule.value.key);
});

// Load settings from currentField
function loadFieldSettings() {
  if (!currentField.value) return;
  const field = currentField.value;
  
  // Load number settings
  if (['Integer', 'Decimal', 'Currency'].includes(field.dataType)) {
    numberSettings.value = {
      min: field.numberSettings?.min ?? null,
      max: field.numberSettings?.max ?? null,
      decimalPlaces: field.numberSettings?.decimalPlaces ?? (field.dataType === 'Currency' ? 2 : 0),
      currencySymbol: field.numberSettings?.currencySymbol ?? '$'
    };
  }
  
  // Load text settings
  if (['Text', 'Text-Area'].includes(field.dataType)) {
    textSettings.value = {
      maxLength: field.textSettings?.maxLength ?? null,
      rows: field.textSettings?.rows ?? 4
    };
  }
  
  // Load date settings
  if (['Date', 'Date-Time'].includes(field.dataType)) {
    dateSettings.value = {
      format: field.dateSettings?.format ?? 'YYYY-MM-DD',
      timeFormat: field.dateSettings?.timeFormat ?? '24h'
    };
  }
  
  // Load formula settings
  if (field.dataType === 'Formula') {
    formulaSettings.value = {
      expression: field.formulaSettings?.expression ?? '',
      returnType: field.formulaSettings?.returnType ?? 'Text'
    };
  }
  
  // Load lookup settings
  if (field.dataType === 'Lookup (Relationship)') {
    lookupSettings.value = {
      targetModule: field.lookupSettings?.targetModule ?? '',
      displayField: field.lookupSettings?.displayField ?? ''
    };
  }
}

// Add picklist option
// Normalize options - convert strings to objects for backward compatibility
const normalizedOptions = computed(() => {
  if (!currentField.value?.options || !Array.isArray(currentField.value.options)) return [];
  return currentField.value.options.map(opt => {
    if (typeof opt === 'string') {
      return { value: opt, color: '#3B82F6' }; // Default blue for old string options
    }
    return opt; // Already an object
  });
});

// Get option value (handles both string and object formats)
function getOptionValue(option) {
  if (typeof option === 'string') return option;
  return option?.value || '';
}

// Get option color (with default)
function getOptionColor(option) {
  if (typeof option === 'string') return '#3B82F6'; // Default blue for old string options
  return option?.color || '#3B82F6';
}

// Update option color
function updateOptionColor(index, color) {
  if (!currentField.value.options || !Array.isArray(currentField.value.options)) return;
  
  const option = currentField.value.options[index];
  
  // If it's a string, convert to object
  if (typeof option === 'string') {
    currentField.value.options[index] = { value: option, color: color };
  } else {
    // Update existing object
    if (!currentField.value.options[index]) {
      currentField.value.options[index] = { value: '', color: color };
    } else {
      currentField.value.options[index].color = color;
    }
  }
}

function addOption() {
  if (!newOptionValue.value.trim()) return;
  if (!currentField.value.options) {
    currentField.value.options = [];
  }
  
  const optionValue = newOptionValue.value.trim();
  const optionColor = newOptionColor.value || '#3B82F6';
  
  // Check for duplicates (compare values, not colors)
  const existingValues = currentField.value.options.map(opt => 
    typeof opt === 'string' ? opt : opt.value
  );
  
  if (!existingValues.includes(optionValue)) {
    // Add as object with value and color
    currentField.value.options.push({ 
      value: optionValue, 
      color: optionColor 
    });
  }
  
  newOptionValue.value = '';
  newOptionColor.value = '#3B82F6'; // Reset to default
  showAddOption.value = false;
}

// Remove picklist option
function removeOption(index) {
  if (currentField.value.options && Array.isArray(currentField.value.options)) {
    currentField.value.options.splice(index, 1);
  }
}

const fetchModules = async () => {
  loading.value = true;
  try {
    const res = await fetch('/api/modules', { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authStore.user?.token}` } });
    const data = await res.json();
    if (data.success) {
      modules.value = data.data;
      // Initialize from URL first
      const moduleKey = typeof route.query.module === 'string' ? route.query.module : null;
      const fieldKey = typeof route.query.field === 'string' ? route.query.field : null;
      const modeKey = typeof route.query.mode === 'string' ? route.query.mode : null;
      const subKey = typeof route.query.subtab === 'string' ? route.query.subtab : null;
      let initialMod = null;
      if (moduleKey) {
        initialMod = modules.value.find(m => m.key === moduleKey) || null;
      }
      if (initialMod) {
        selectedModuleId.value = initialMod._id;
        const initial = JSON.parse(JSON.stringify(initialMod.fields || []));
        const sorted = initial.sort((a,b) => (a.order ?? 0) - (b.order ?? 0));
        editFields.value = uniqueFieldsByKey(sorted);
        // Select field by key if provided
        const idx = fieldKey ? editFields.value.findIndex(f => f.key === fieldKey) : 0;
        selectedFieldIdx.value = Math.max(0, idx);
        fieldSearch.value = '';
        syncOptionsBuffer();
        // Always prioritize URL mode, then localStorage, then default to 'fields'
        let tabToSet = 'fields'; // default
        if (modeKey && ['details','fields','relationships','quick'].includes(modeKey)) {
          tabToSet = modeKey;
          console.log('Restoring tab from URL:', tabToSet);
        } else {
          // If no mode in URL, check localStorage for this module
          const storedMode = localStorage.getItem(`litedesk-modfields-tab-${initialMod.key}`);
          if (storedMode && ['details','fields','relationships','quick'].includes(storedMode)) {
            tabToSet = storedMode;
            console.log('Restoring tab from localStorage:', tabToSet, 'for module:', initialMod.key);
          } else {
            console.log('Using default tab: fields for module:', initialMod.key);
          }
        }
        // Set directly without triggering watcher during initialization
        activeTopTab.value = tabToSet;
        if (subKey && ['general','validations','dependencies'].includes(subKey)) {
          activeSubTab.value = subKey;
        }
        // Ensure URL reflects selection (use the tab we just set)
        router.replace({ query: { ...route.query, module: initialMod.key, field: editFields.value[selectedFieldIdx.value]?.key || '', mode: tabToSet, subtab: activeSubTab.value } });
        moduleNameEdit.value = initialMod.name || '';
        moduleEnabled.value = initialMod.enabled !== false;
        relationships.value = JSON.parse(JSON.stringify(initialMod.relationships || []));
        quickLayout.value = JSON.parse(JSON.stringify(initialMod.quickCreateLayout || { version: 1, rows: [] }));
        hydratePipelineSettingsFromModule(initialMod);
        // Initialize quick mode: always use simple (advanced mode hidden for now)
        quickMode.value = 'simple';
        router.replace({ query: { ...route.query, quickMode: quickMode.value } });
        // Choose selection source based on mode: advanced -> layout, simple -> quickCreate
        const layoutKeysInit = extractLayoutKeys(quickLayout.value);
        let quickKeysInit = initialMod.quickCreate || [];
        // fallback to locally stored quick selection if server returns empty
        if (!layoutKeysInit.length && !quickKeysInit.length) {
          try {
            const cached = JSON.parse(localStorage.getItem(`litedesk-modfields-quick-${initialMod.key}`) || '[]');
            if (Array.isArray(cached) && cached.length) quickKeysInit = cached;
          } catch (e) {}
        }
        const useLayout = false; // Advanced mode hidden for now // (quickMode.value === 'advanced' && layoutKeysInit.length > 0);
        const baseKeys = useLayout ? layoutKeysInit : quickKeysInit;
        // Always include required fields in Simple mode
        const requiredKeys = editFields.value.filter(f => !!f.required && !!f.key).map(f => f.key);
        const combined = quickMode.value === 'simple' ? Array.from(new Set([...baseKeys, ...requiredKeys])) : baseKeys;
        quickCreateSelected.value = new Set(combined);
        // capture snapshot after initializing state
        originalSnapshot.value = getSnapshot();
        quickOriginalSnapshot.value = getQuickSnapshot();
        
        // Check if we should open add field dialog
        const action = typeof route.query.action === 'string' ? route.query.action : null;
        if (action === 'add' && modeKey === 'fields') {
          // Use nextTick to ensure the component is fully rendered
          nextTick(() => {
            openAddField();
            // Remove action from URL after triggering
            router.replace({ query: { ...route.query, action: undefined } });
          });
        }
      }
      // If no module from URL, use last persisted selection
      if (!initialMod) {
        const storedModuleKey = localStorage.getItem('litedesk-modfields-module') || null;
        if (storedModuleKey) {
          const storedMod = modules.value.find(m => m.key === storedModuleKey) || null;
          if (storedMod) {
            selectedModuleId.value = storedMod._id;
            const initial = JSON.parse(JSON.stringify(storedMod.fields || []));
            const sorted = initial.sort((a,b) => (a.order ?? 0) - (b.order ?? 0));
            editFields.value = uniqueFieldsByKey(sorted);
            // try stored field
            const storedFieldKey = localStorage.getItem('litedesk-modfields-field') || '';
            const sidx = storedFieldKey ? editFields.value.findIndex(f => f.key === storedFieldKey) : 0;
            selectedFieldIdx.value = Math.max(0, sidx);
            syncOptionsBuffer();
            // Restore tab from localStorage for this module
            const storedTab = localStorage.getItem(`litedesk-modfields-tab-${storedMod.key}`);
            if (storedTab && ['details', 'fields', 'relationships', 'quick'].includes(storedTab)) {
              activeTopTab.value = storedTab;
            }
            router.replace({ query: { ...route.query, module: storedMod.key, field: editFields.value[selectedFieldIdx.value]?.key || '', mode: activeTopTab.value, subtab: activeSubTab.value } });
            moduleNameEdit.value = storedMod.name || '';
            moduleEnabled.value = storedMod.enabled !== false;
            relationships.value = JSON.parse(JSON.stringify(storedMod.relationships || []));
            quickLayout.value = JSON.parse(JSON.stringify(storedMod.quickCreateLayout || { version: 1, rows: [] }));
            hydratePipelineSettingsFromModule(storedMod);
            // initialize quick mode: always use simple (advanced mode hidden for now)
            quickMode.value = 'simple';
            router.replace({ query: { ...route.query, quickMode: quickMode.value } });
            // now derive selection based on mode
            const layoutKeysInit = extractLayoutKeys(quickLayout.value);
            const quickKeysInit = storedMod.quickCreate || [];
            const useLayout = false; // Advanced mode hidden for now // (quickMode.value === 'advanced' && layoutKeysInit.length > 0);
            const baseKeys = useLayout ? layoutKeysInit : quickKeysInit;
            const requiredKeys = editFields.value.filter(f => !!f.required && !!f.key).map(f => f.key);
            const combined = quickMode.value === 'simple' ? Array.from(new Set([...baseKeys, ...requiredKeys])) : baseKeys;
            quickCreateSelected.value = new Set(combined);
            originalSnapshot.value = getSnapshot();
            quickOriginalSnapshot.value = getQuickSnapshot();
          }
        }
      }
    }
  } catch (e) {
    console.error('Failed to load modules', e);
  } finally {
    loading.value = false;
  }
};

const selectModule = (mod, preferFieldKey = null) => {
  // Prevent auto-save during initialization
  isInitializingQuickCreate.value = true;
  
  selectedModuleId.value = mod._id;
  const initial = JSON.parse(JSON.stringify(mod.fields || []));
  const sorted = initial.sort((a,b) => (a.order ?? 0) - (b.order ?? 0));
  editFields.value = uniqueFieldsByKey(sorted);
  if (preferFieldKey) {
    const idx = editFields.value.findIndex(f => f.key === preferFieldKey);
    selectedFieldIdx.value = idx >= 0 ? idx : 0;
  } else {
    selectedFieldIdx.value = 0;
  }
  fieldSearch.value = '';
  syncOptionsBuffer();
  // Restore tab from localStorage when selecting module (before updating URL)
  const allowedTabs = getAllowedTopTabs(mod.key);
  const storedTab = localStorage.getItem(`litedesk-modfields-tab-${mod.key}`);
  if (storedTab && allowedTabs.includes(storedTab)) {
    console.log('Restoring tab from localStorage when selecting module:', storedTab, 'for module:', mod.key);
    activeTopTab.value = storedTab;
  } else if (!allowedTabs.includes(activeTopTab.value)) {
    activeTopTab.value = allowedTabs[0] || 'fields';
  }
  const selKey = editFields.value[selectedFieldIdx.value]?.key || '';
  router.replace({ query: { ...route.query, module: mod.key, field: selKey, mode: activeTopTab.value, subtab: activeSubTab.value } });
  // persist selection
  try { localStorage.setItem('litedesk-modfields-module', mod.key); } catch (e) {}
  try { if (selKey) localStorage.setItem('litedesk-modfields-field', selKey); } catch (e) {}
  moduleNameEdit.value = mod.name || '';
  moduleEnabled.value = mod.enabled !== false;
  relationships.value = JSON.parse(JSON.stringify(mod.relationships || []));
  quickLayout.value = JSON.parse(JSON.stringify(mod.quickCreateLayout || { version: 1, rows: [] }));
  // always use simple mode (advanced mode hidden for now)
  quickMode.value = 'simple';
  router.replace({ query: { ...route.query, quickMode: quickMode.value } });
  hydratePipelineSettingsFromModule(mod);
  // Choose selection source based on mode: advanced -> layout, simple -> quickCreate
  const layoutKeys = extractLayoutKeys(quickLayout.value);
  let quickKeys = mod.quickCreate || [];
  if (!layoutKeys.length && !quickKeys.length) {
    try {
      const cached = JSON.parse(localStorage.getItem(`litedesk-modfields-quick-${mod.key}`) || '[]');
      if (Array.isArray(cached) && cached.length) quickKeys = cached;
    } catch (e) {}
  }
  const useLayout = false; // Advanced mode hidden for now // (quickMode.value === 'advanced' && layoutKeys.length > 0);
  const baseKeys = useLayout ? layoutKeys : quickKeys;
  const requiredKeys = editFields.value.filter(f => !!f.required && !!f.key).map(f => f.key);
  const combined = quickMode.value === 'simple' ? Array.from(new Set([...baseKeys, ...requiredKeys])) : baseKeys;
  quickCreateSelected.value = new Set(combined);
  // capture snapshot for selected module
  originalSnapshot.value = getSnapshot();
  quickOriginalSnapshot.value = getQuickSnapshot();
  
  // Re-enable auto-save after initialization completes
  setTimeout(() => {
    isInitializingQuickCreate.value = false;
    console.log('Quick Create initialization complete, auto-save enabled');
  }, 1000);
};

watch(pipelineSettings, () => {
  if (!pipelineTabEnabled.value) return;
  ensurePipelineSelection();
});

watch(activeTopTab, (tab) => {
  if (!['pipeline', 'playbooks'].includes(tab)) return;
  if (!pipelineTabEnabled.value) return;
  ensurePipelineSelection();
});

const openCreateModal = () => {
  editingModule.value = null;
  showFormModal.value = true;
};

const closeFormModal = () => {
  showFormModal.value = false;
  editingModule.value = null;
};

const handleModuleSaved = async (savedModule) => {
  closeFormModal();
  await fetchModules();
  // Find the module from the refreshed list and select it
  const module = modules.value.find(m => m._id === savedModule._id);
  if (module) {
    selectModule(module);
  }
};

const deleteModule = async (mod) => {
  if (!confirm(`Delete module "${mod.name}"?`)) return;
  try {
    const res = await fetch(`/api/modules/${mod._id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${authStore.user?.token}` } });
    const data = await res.json();
    if (!res.ok || !data.success) return alert(data.message || 'Failed to delete module');
    await fetchModules();
    if (modules.value.length) selectModule(modules.value[0]); else selectedModuleId.value = null;
  } catch (e) {
    console.error('Delete module failed', e);
  }
};

const openAddField = () => {
  const newField = { key: '', label: '', dataType: 'Text', required: false, options: [], defaultValue: null, index: false, visibility: { list: true, detail: true }, order: editFields.value.length };
  editFields.value.push(newField);
  selectedFieldIdx.value = editFields.value.length - 1;
  syncOptionsBuffer();
  // Clear manual edit flag for new field
  fieldKeyManuallyEdited.value.delete(selectedFieldIdx.value);
};

const moveField = (idx, delta) => {
  const newIdx = idx + delta;
  if (newIdx < 0 || newIdx >= editFields.value.length) return;
  const arr = editFields.value;
  const [item] = arr.splice(idx, 1);
  arr.splice(newIdx, 0, item);
  arr.forEach((f, i) => f.order = i);
  if (selectedFieldIdx.value === idx) selectedFieldIdx.value = newIdx;
};

const removeField = (idx) => {
  const field = editFields.value[idx];
  const mod = selectedModule.value;
  
  // Prevent deletion of system fields
  if (isSystemField(field)) {
    alert('System fields cannot be deleted.');
    return;
  }
  
  // Prevent deletion of core fields
  if (isCoreField(field, mod?.key)) {
    alert('Core fields cannot be deleted. These fields are essential for the module functionality.');
    return;
  }
  
  editFields.value.splice(idx, 1);
  editFields.value.forEach((f, i) => f.order = i);
  if (selectedFieldIdx.value >= editFields.value.length) selectedFieldIdx.value = Math.max(0, editFields.value.length - 1);
  syncOptionsBuffer();
};

const isSaving = ref(false);
const saveModule = async () => {
  const mod = selectedModule.value;
  if (!mod) return;
  if (isSaving.value) return; // Prevent double-click
  
  isSaving.value = true;
  try {
    // Deduplicate fields before saving
    const deduplicatedFields = uniqueFieldsByKey(editFields.value);
    // Update order after deduplication
    deduplicatedFields.forEach((f, i) => { f.order = i; });
    // Update editFields to reflect deduplicated version
    editFields.value = deduplicatedFields;
    const url = mod.type === 'system' ? `/api/modules/system/${mod.key}` : `/api/modules/${mod._id}`;
    const orderedKeys = orderedQuickCreate.value.map(f => f.key);
    const payload = {
      fields: deduplicatedFields,
      relationships: relationships.value,
      quickCreate: quickMode.value === 'simple' ? orderedKeys : Array.from(quickCreateSelected.value),
      quickCreateLayout: quickLayout.value,
      name: moduleNameEdit.value,
      enabled: moduleEnabled.value
    };
    if (mod.key === 'deals') {
      payload.pipelineSettings = normalizePipelineSettings(pipelineSettings.value);
    }
    console.log('Saving module with relationships:', {
      relationshipsCount: relationships.value.length,
      relationships: relationships.value
    });
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authStore.user?.token}` },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      alert(data.message || 'Failed to save');
      return;
    }
    await fetchModules();
    // Re-select by key to avoid unstable IDs on system modules
    const updated = modules.value.find(m => m.key === mod.key);
    // preserve current selected field
    const currentFieldKey = editFields.value[selectedFieldIdx.value]?.key || null;
    if (updated) {
      // selectModule will reload relationships from updated module, so call it first
      selectModule(updated, currentFieldKey);
      // Double-check: ensure relationships are loaded from the updated module
      if (updated.relationships && Array.isArray(updated.relationships)) {
        relationships.value = JSON.parse(JSON.stringify(updated.relationships));
        console.log('Relationships restored after save:', relationships.value.length);
      } else {
        console.warn('⚠️  No relationships found in updated module after save');
      }
    }
    // reset snapshot after successful save
    originalSnapshot.value = getSnapshot();
    quickOriginalSnapshot.value = getQuickSnapshot();
    console.log('Module saved successfully, relationships updated');
  } catch (e) {
    console.error('Save module failed', e);
    alert('Failed to save: ' + (e.message || 'Unknown error'));
  } finally {
    isSaving.value = false;
  }
};

const selectField = (idx) => {
  selectedFieldIdx.value = idx;
  syncOptionsBuffer();
  loadFieldSettings(); // Load field-specific settings
  const mod = selectedModule.value;
  if (mod) {
    router.replace({ query: { ...route.query, module: mod.key, field: editFields.value[selectedFieldIdx.value]?.key || '', mode: activeTopTab.value, subtab: activeSubTab.value } });
    try { if (editFields.value[selectedFieldIdx.value]?.key) localStorage.setItem('litedesk-modfields-field', editFields.value[selectedFieldIdx.value].key); } catch (e) {}
  }
};

const currentField = computed(() => editFields.value[selectedFieldIdx.value]);
const currentFieldTitle = computed(() => currentField.value?.label || currentField.value?.key || 'Field');
const otherFields = computed(() => editFields.value.filter((_, i) => i !== selectedFieldIdx.value));

// Track if user manually edited field key to prevent auto-generation
const fieldKeyManuallyEdited = ref(new Set());
const isAutoGeneratingFieldKey = ref(false);

// Generate base key from label
const generateFieldBaseKey = (label) => {
  if (!label) return '';
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
};

// Check if field key exists and generate unique key
const generateUniqueFieldKey = (baseKey, currentFieldIdx) => {
  if (!baseKey) return '';
  
  // Get all existing field keys except the current field
  const existingKeys = editFields.value
    .map((f, idx) => idx !== currentFieldIdx ? f.key?.toLowerCase() : null)
    .filter(Boolean);
  
  let candidateKey = baseKey;
  let counter = 1;
  
  // Check if base key exists
  while (existingKeys.includes(candidateKey)) {
    candidateKey = `${baseKey}-${counter}`;
    counter++;
    // Prevent infinite loop
    if (counter > 1000) break;
  }
  
  return candidateKey;
};

// Auto-generate field key from label
const autoGenerateFieldKey = () => {
  if (!currentField.value) return;
  
  const fieldIdx = selectedFieldIdx.value;
  
  // Skip if key was manually edited or if field is system/core/auto-number
  if (
    fieldKeyManuallyEdited.value.has(fieldIdx) ||
    isSystemField(currentField.value) ||
    isCoreField(currentField.value, selectedModule.value?.key) ||
    currentField.value.dataType === 'Auto-Number' ||
    !currentField.value.label
  ) {
    return;
  }
  
  isAutoGeneratingFieldKey.value = true;
  const baseKey = generateFieldBaseKey(currentField.value.label);
  if (baseKey) {
    const uniqueKey = generateUniqueFieldKey(baseKey, fieldIdx);
    currentField.value.key = uniqueKey;
  }
  // Use nextTick to ensure the watch doesn't fire during auto-generation
  setTimeout(() => {
    isAutoGeneratingFieldKey.value = false;
  }, 0);
};

// Key field validation
const keyFieldCount = computed(() => editFields.value.filter(f => f.keyField === true).length);
const canMarkAsKeyField = computed(() => {
  if (!currentField.value?.keyField) {
    return keyFieldCount.value < 10;
  }
  return true;
});

// Initialize options array if it doesn't exist and load settings when field changes
watch(() => currentField.value?.dataType, (newType) => {
  if (!currentField.value) return;
  if (['Picklist', 'Multi-Picklist', 'Radio Button'].includes(newType)) {
    if (!Array.isArray(currentField.value.options)) {
      currentField.value.options = [];
    }
  }
  // Load settings from currentField
  loadFieldSettings();
}, { immediate: true });

// Also watch for field selection changes
watch(() => selectedFieldIdx.value, () => {
  if (currentField.value) {
    loadFieldSettings();
    // Reset manual edit flag when switching fields
    fieldKeyManuallyEdited.value.delete(selectedFieldIdx.value);
  }
});

// Watch field label to auto-generate key
watch(() => currentField.value?.label, () => {
  if (currentField.value) {
    autoGenerateFieldKey();
  }
});

// Watch field key to detect manual edits
watch(() => currentField.value?.key, (newKey, oldKey) => {
  if (!currentField.value || isAutoGeneratingFieldKey.value) return;
  
  const fieldIdx = selectedFieldIdx.value;
  const expectedKey = generateFieldBaseKey(currentField.value.label);
  
  // If user manually edits the key to something different from auto-generated, mark as manually edited
  if (newKey && newKey !== expectedKey && !newKey.startsWith(expectedKey)) {
    fieldKeyManuallyEdited.value.add(fieldIdx);
  } else if (newKey === expectedKey || newKey?.startsWith(expectedKey)) {
    // If it matches the expected pattern, remove from manual edits
    fieldKeyManuallyEdited.value.delete(fieldIdx);
  }
});

// Save settings to currentField
watch([numberSettings, textSettings, dateSettings, formulaSettings, lookupSettings], () => {
  if (!currentField.value) return;
  const field = currentField.value;
  
  if (['Integer', 'Decimal', 'Currency'].includes(field.dataType)) {
    field.numberSettings = { ...numberSettings.value };
  }
  if (['Text', 'Text-Area'].includes(field.dataType)) {
    field.textSettings = { ...textSettings.value };
  }
  if (['Date', 'Date-Time'].includes(field.dataType)) {
    field.dateSettings = { ...dateSettings.value };
  }
  if (field.dataType === 'Formula') {
    field.formulaSettings = { ...formulaSettings.value };
  }
  if (field.dataType === 'Lookup (Relationship)') {
    field.lookupSettings = { ...lookupSettings.value };
  }
}, { deep: true });
const dependencyValuesBuffer = ref({});
const dependencyConditionBuffers = ref({});
const dependencyMappingBuffers = ref({});
const dependencyOptionsBuffer = ref({});
const picklistOptionsBuffers = ref({});
const advancedValueBuffers = ref({});
const advancedOptionsBuffers = ref({});

function syncOptionsBuffer() {
  const f = currentField.value;
  if (!f?.options || !Array.isArray(f.options)) {
    optionsBuffer.value = '';
    return;
  }
  // Convert options to comma-separated string (extract values if objects)
  const values = f.options.map(opt => typeof opt === 'string' ? opt : opt.value || '');
  optionsBuffer.value = values.join(', ');
}

watch(optionsBuffer, (v) => {
  if (!currentField.value) return;
  
  const arr = v.split(',').map(s => s.trim()).filter(Boolean);
  
  // If we have existing options as objects, preserve their colors when converting from buffer
  if (Array.isArray(currentField.value.options) && currentField.value.options.length > 0) {
    const existingOptions = currentField.value.options;
    // Map to preserve colors if option exists
    currentField.value.options = arr.map(value => {
      const existing = existingOptions.find(opt => {
        const existingValue = typeof opt === 'string' ? opt : opt.value;
        return existingValue === value;
      });
      if (existing && typeof existing === 'object') {
        return existing; // Keep existing object with color
      }
      return { value: value, color: '#3B82F6' }; // New option, default color
    });
  } else {
    // New options, create as objects with default color
    currentField.value.options = arr.map(value => ({ value: value, color: '#3B82F6' }));
  }
});

const clearSelection = () => {
  selectedModuleId.value = null;
  const q = { ...route.query };
  delete q.module;
  delete q.field;
  router.replace({ query: q });
  try { localStorage.removeItem('litedesk-modfields-module'); localStorage.removeItem('litedesk-modfields-field'); } catch (e) {}
};

function addRelationship() {
  relationships.value.push({ name: '', type: 'lookup', targetModuleKey: '', localField: '', foreignField: '_id', inverseName: '', inverseField: '', required: false, unique: false, index: true, cascadeDelete: false, label: '' });
}
function removeRelationship(idx) {
  if (confirm('Are you sure you want to remove this relationship?')) {
    relationships.value.splice(idx, 1);
  }
}

// Helper functions for Relationships tab
function getRelationshipTypeLabel(type) {
  const labels = {
    'one_to_one': 'One-to-One (1:1)',
    'one_to_many': 'One-to-Many (1:N)',
    'many_to_one': 'Many-to-One (N:1)',
    'many_to_many': 'Many-to-Many (N:N)',
    'lookup': 'Lookup'
  };
  return labels[type] || type;
}

function getModuleName(key) {
  if (!key || !modules.value) return '';
  const module = modules.value.find(m => m.key === key);
  return module ? module.name : key;
}

const autoSaveTimeout = ref(null);

// Auto-save Quick Create with debounce
async function autoSaveQuickCreate() {
  // Don't auto-save during initialization
  if (isInitializingQuickCreate.value) {
    console.log('Auto-save skipped: Still initializing');
    return;
  }
  
  // Clear existing timeout
  if (autoSaveTimeout.value) {
    clearTimeout(autoSaveTimeout.value);
  }
  
  // Set new timeout to save after 500ms of inactivity
  autoSaveTimeout.value = setTimeout(async () => {
    const mod = selectedModule.value;
    if (!mod) {
      console.warn('Auto-save: No module selected');
      return;
    }
    
    try {
      const url = mod.type === 'system' ? `/api/modules/system/${mod.key}` : `/api/modules/${mod._id}`;
      const orderedKeys = orderedQuickCreate.value.map(f => f.key);
      const quickCreateArray = quickMode.value === 'simple' ? orderedKeys : Array.from(quickCreateSelected.value);
      
      console.log('🔍 Auto-save payload generation:', {
        mode: quickMode.value,
        orderedQuickCreateLength: orderedQuickCreate.value.length,
        orderedKeys: orderedKeys,
        quickCreateSelectedSize: quickCreateSelected.value.size,
        quickCreateSelectedArray: Array.from(quickCreateSelected.value),
        quickCreateArray: quickCreateArray,
        quickLayoutRows: quickLayout.value?.rows?.length || 0
      });
      
      const payload = {
        quickCreate: quickCreateArray,
        quickCreateLayout: { version: 1, rows: [] } // Advanced mode hidden for now // quickMode.value === 'advanced' ? quickLayout.value : { version: 1, rows: [] }
      };
      
      console.log('Auto-saving Quick Create:', {
        module: mod.key,
        mode: quickMode.value,
        url: url,
        payload: payload,
        payloadQuickCreate: payload.quickCreate,
        payloadQuickCreateLength: payload.quickCreate?.length || 0,
        payloadQuickCreateLayout: payload.quickCreateLayout,
        quickCreateLayoutRows: payload.quickCreateLayout?.rows?.length || 0,
        payloadString: JSON.stringify(payload)
      });
      
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authStore.user?.token}` },
        body: JSON.stringify(payload)
      });
      
      // Log the raw response text to see what the server actually returned
      const responseText = await res.clone().text();
      console.log('📥 Raw server response:', responseText);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Auto-save Quick Create HTTP error:', res.status, errorText);
        alert(`Failed to save Quick Create: ${errorText.substring(0, 100)}`);
        return;
      }
      
      const data = await res.json();
      if (!data.success) {
        console.error('Auto-save Quick Create failed:', data);
        alert(`Failed to save Quick Create: ${data.message || 'Unknown error'}`);
        return;
      }
      
      console.log('✅ Auto-save Quick Create successful:', {
        dataKeys: Object.keys(data.data || {}),
        quickCreate: data.data?.quickCreate,
        quickCreateLength: data.data?.quickCreate?.length || 0,
        quickCreateType: typeof data.data?.quickCreate,
        quickCreateIsArray: Array.isArray(data.data?.quickCreate),
        quickCreateLayout: data.data?.quickCreateLayout,
        quickCreateLayoutRows: data.data?.quickCreateLayout?.rows?.length || 0,
        fullData: data.data
      });
      
      // cache selection locally for resilience
      try {
        localStorage.setItem(`litedesk-modfields-quick-${mod.key}`, JSON.stringify(payload.quickCreate));
      } catch (e) {}
      
      // Update snapshot after successful save
      quickOriginalSnapshot.value = getQuickSnapshot();
    } catch (e) {
      console.error('Auto-save quick create failed:', e);
    }
  }, 500);
}

// Watch for layout changes in advanced mode (span, widget, props changes)
watch(() => quickLayout.value, () => {
  // Advanced mode hidden for now - auto-save disabled
  // if (quickMode.value === 'advanced' && selectedModule.value) {
  //   console.log('Layout changed, triggering auto-save');
  //   autoSaveQuickCreate();
  // }
}, { deep: true });

// Watch for quickCreateSelected changes in simple mode
// Use a computed to convert Set to Array for reactivity
const quickCreateSelectedArray = computed(() => Array.from(quickCreateSelected.value).sort());
watch(quickCreateSelectedArray, (newVal, oldVal) => {
  if (quickMode.value === 'simple' && selectedModule.value) {
    console.log('Quick Create selection changed:', { 
      from: oldVal, 
      to: newVal,
      length: newVal.length 
    });
    autoSaveQuickCreate();
  }
});

function toggleQuickCreate(key, checked) {
  const s = quickCreateSelected.value;
  // prevent deselecting required fields
  const field = editFields.value.find(f => f.key === key);
  if (!checked && field && field.required) {
    s.add(key);
    return;
  }
  if (checked) s.add(key); else s.delete(key);
  // Watcher will handle auto-save for simple mode
}

function toggleQuickRow(field) {
  if (!field || !field.key) return; // cannot toggle required
  const has = quickCreateSelected.value.has(field.key);
  toggleQuickCreate(field.key, !has);
  // toggleQuickCreate already calls autoSaveQuickCreate
}
function selectAllQuickCreate() {
  quickCreateSelected.value = new Set(editFields.value.map(f => f.key));
  autoSaveQuickCreate();
}
const orderedQuickCreate = computed(() => {
  const seen = new Set();
  const out = [];
  for (const f of editFields.value) {
    const k = f.key;
    if (!k) continue;
    if (!quickCreateSelected.value.has(k)) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(f);
  }
  return out;
});

function addRow() {
  quickLayout.value.rows.push({ cols: [] });
  autoSaveQuickCreate();
}
function removeRow(ri) {
  quickLayout.value.rows.splice(ri, 1);
  rebuildQuickCreateFromLayout();
  // rebuildQuickCreateFromLayout already calls autoSaveQuickCreate
}
function addCol(ri) {
  quickLayout.value.rows[ri].cols.push({ span: 12, fieldKey: '', widget: 'input', props: {} });
  autoSaveQuickCreate();
}
function removeCol(ri, ci) {
  quickLayout.value.rows[ri].cols.splice(ci, 1);
  rebuildQuickCreateFromLayout();
  // rebuildQuickCreateFromLayout already calls autoSaveQuickCreate
}

function displayFieldLabel(key) {
  const f = editFields.value.find(x => x.key === key);
  return f ? (f.label || f.key) : '';
}
function openPreview() { showPreview.value = true; }
function closePreview() { showPreview.value = false; }

function getPreviewPlaceholder(col) {
  const key = col?.fieldKey || '';
  const f = editFields.value.find(x => x.key === key);
  const fieldPh = f && typeof f.placeholder === 'string' ? f.placeholder : '';
  const colPh = (col && col.props && typeof col.props.placeholder === 'string') ? col.props.placeholder : '';
  return colPh || fieldPh || 'Placeholder';
}

function onFieldDragStart(key) {
  try { event.dataTransfer.setData('text/plain', key); } catch (e) { /* no-op */ }
}
function onColumnDrop(ri, ci, event) {
  const key = event.dataTransfer.getData('text/plain');
  if (!key) return;
  // prevent duplicates
  if (isFieldUsedInLayout(key)) return;
  quickLayout.value.rows[ri].cols[ci].fieldKey = key;
  // sync quickCreateSelected from layout
  rebuildQuickCreateFromLayout();
}
function clearColumnField(ri, ci) {
  quickLayout.value.rows[ri].cols[ci].fieldKey = '';
  rebuildQuickCreateFromLayout();
  // rebuildQuickCreateFromLayout already calls autoSaveQuickCreate
}
function isFieldUsedInLayout(key) {
  for (const row of quickLayout.value.rows) {
    for (const col of row.cols) {
      if (col.fieldKey === key) return true;
    }
  }
  return false;
}
function rebuildQuickCreateFromLayout() {
  const keys = [];
  for (const row of quickLayout.value.rows) {
    for (const col of row.cols) {
      if (col.fieldKey) keys.push(col.fieldKey);
    }
  }
  quickCreateSelected.value = new Set(keys);
  // Watcher will handle auto-save
}

function extractLayoutKeys(layout) {
  try {
    const keys = [];
    const rows = Array.isArray(layout?.rows) ? layout.rows : [];
    for (const row of rows) {
      const cols = Array.isArray(row?.cols) ? row.cols : [];
      for (const col of cols) {
        if (col && col.fieldKey) keys.push(col.fieldKey);
      }
    }
    return keys;
  } catch (e) {
    return [];
  }
}

function addValidation() {
  if (!currentField.value.validations) currentField.value.validations = [];
  currentField.value.validations.push({ name: '', type: 'regex', pattern: '', minLength: undefined, maxLength: undefined, min: undefined, max: undefined, allowedValues: [], message: '' });
}
function removeValidation(idx) {
  currentField.value.validations.splice(idx, 1);
}

function applyAllowedValues(idx) {
  const raw = allowedValuesBuffers.value[idx] || '';
  const arr = raw.split(',').map(s => s.trim()).filter(Boolean);
  if (currentField.value.validations[idx]) currentField.value.validations[idx].allowedValues = arr;
}

function addPreset(kind) {
  const presets = {
    email: { pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$', message: 'Invalid email' },
    phone10: { pattern: '^\\d{10}$', message: 'Must be 10 digits' },
    url: { pattern: '^(https?:\\/\\/)?([\\w.-]+)\\.([a-z.]{2,6})([\\/\\w .-]*)*\\/?$', message: 'Invalid URL' },
    integer: { pattern: '^-?\\d+$', message: 'Must be an integer' },
    positive: { pattern: '^[+]?([1-9]\\d*)$', message: 'Must be a positive number' },
    currency: { pattern: '^(\\$)?(?=.)\\d{1,3}(,?\\d{3})*(\\.\\d{2})?$', message: 'Invalid currency format' },
    alnum: { pattern: '^[A-Za-z0-9]+$', message: 'Only letters and numbers allowed' },
    slug: { pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$', message: 'Invalid slug' },
    uuid: { pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$', message: 'Invalid UUID' },
    zipcode: { pattern: '^[0-9]{5}(?:-[0-9]{4})?$', message: 'Invalid ZIP Code' }
  };
  addValidation();
  const last = currentField.value.validations.length - 1;
  currentField.value.validations[last].type = kind === 'email' ? 'email' : 'regex';
  Object.assign(currentField.value.validations[last], presets[kind] || {});
}

// Helper function to get field type for dependency field selection
function getDependencyFieldType(fieldKey) {
  if (!fieldKey) return '';
  const field = editFields.value.find(f => f.key === fieldKey);
  return field?.dataType || '';
}

// Helper function to normalize picklist option (handle both strings and objects)
function normalizePicklistOption(option) {
  if (typeof option === 'string') return option;
  if (typeof option === 'object' && option !== null) {
    return option.value || option.label || String(option);
  }
  return String(option);
}

// Helper function to get picklist option value for comparison
function getPicklistOptionValue(option) {
  if (typeof option === 'string') return option;
  if (typeof option === 'object' && option !== null) {
    return option.value || option.label || String(option);
  }
  return String(option);
}

// Helper function to get picklist options for a field (returns normalized values)
function getDependencyFieldOptions(fieldKey) {
  if (!fieldKey) return [];
  const field = editFields.value.find(f => f.key === fieldKey);
  if (!field?.options) return [];
  return field.options.map(opt => normalizePicklistOption(opt));
}

// Helper function to get picklist options with their full objects
function getPicklistOptions(field) {
  if (!field?.options) return [];
  return field.options;
}

// removed addSelectedPreset (preset picker removed)
function addDependency() {
  if (!currentField.value.dependencies) currentField.value.dependencies = [];
  // Create unified dependency structure with type, supporting backward compatibility
  currentField.value.dependencies.push({ 
    name: '',  // Dependency name
    type: 'visibility',  // default type
    fieldKey: '', 
    operator: 'equals', 
    value: '', 
    logic: 'AND',
    conditions: [],
    mappings: [],
    allowedOptions: []  // For picklist filter - stores which options to show
  });
}
function removeDependency(idx) {
  currentField.value.dependencies.splice(idx, 1);
  delete dependencyValuesBuffer.value[idx];
  // Clean up condition buffers
  Object.keys(dependencyConditionBuffers.value).forEach(key => {
    if (key.startsWith(idx + '-')) delete dependencyConditionBuffers.value[key];
  });
  // Clean up mapping buffers
  Object.keys(dependencyMappingBuffers.value).forEach(key => {
    if (key.startsWith(idx + '-')) delete dependencyMappingBuffers.value[key];
  });
  delete dependencyOptionsBuffer.value[idx];
}
function applyDependencyValues(idx) {
  const raw = dependencyValuesBuffer.value[idx] || '';
  const arr = raw.split(',').map(s => s.trim()).filter(Boolean);
  const dep = currentField.value.dependencies[idx];
  if (dep) {
    // Support both old and new structure
    if (dep.conditions && dep.conditions.length > 0) {
      // If using conditions array, this shouldn't be called
      dep.value = arr;
    } else {
      dep.value = arr;
    }
  }
}
// Add condition to a dependency
// Get conditions for a dependency (handles both old and new format)
// IMPORTANT: This ensures conditions array exists and converts old format if needed
function getDependencyConditions(dep) {
  if (!dep) return [];
  // Initialize conditions array if it doesn't exist
  if (!dep.conditions) dep.conditions = [];
  
  // If simple dependency format exists (fieldKey), migrate it to conditions array
  if (dep.fieldKey && dep.conditions.length === 0) {
    dep.conditions.push({
      fieldKey: dep.fieldKey,
      operator: dep.operator || 'equals',
      value: dep.value || ''
    });
    // Clear old fields after migration
    dep.fieldKey = '';
    dep.operator = 'equals';
    dep.value = '';
  }
  
  return dep.conditions;
}

// Get condition count for a dependency
function getConditionCount(dep) {
  if (!dep) return 0;
  // Check conditions array
  if (dep.conditions && Array.isArray(dep.conditions)) {
    return dep.conditions.length;
  }
  // Check simple format
  if (dep.fieldKey) {
    return 1;
  }
  return 0;
}

function addDependencyCondition(di) {
  const dep = currentField.value.dependencies[di];
  if (!dep) return;
  if (!dep.conditions) dep.conditions = [];
  // Convert simple dependency to conditions array if needed
  if (!dep.conditions.length && dep.fieldKey) {
    dep.conditions.push({
      fieldKey: dep.fieldKey,
      operator: dep.operator || 'equals',
      value: dep.value || ''
    });
    // Clear old fields
    dep.fieldKey = '';
    dep.operator = '';
    dep.value = '';
  }
  dep.conditions.push({ fieldKey: '', operator: 'equals', value: '' });
}
// Remove condition from a dependency
function removeDependencyCondition(di, ci) {
  const dep = currentField.value.dependencies[di];
  if (!dep || !dep.conditions) return;
  dep.conditions.splice(ci, 1);
  delete dependencyConditionBuffers.value[di + '-' + ci];
}
// Apply condition value from buffer
function applyDependencyConditionValue(di, ci) {
  const key = di + '-' + ci;
  const val = dependencyConditionBuffers.value[key];
  const dep = currentField.value.dependencies?.[di];
  if (dep && dep.conditions?.[ci]) {
    const raw = val || '';
    const arr = raw.split(',').map(s => s.trim()).filter(Boolean);
    dep.conditions[ci].value = arr;
  }
}
// Add mapping to picklist dependency
function addDependencyMapping(di) {
  const dep = currentField.value.dependencies[di];
  if (!dep) return;
  if (!dep.mappings) dep.mappings = [];
  dep.mappings.push({ whenValue: '', allowedOptions: [] });
}
// Remove mapping from picklist dependency
function removeDependencyMapping(di, mi) {
  const dep = currentField.value.dependencies[di];
  if (!dep || !dep.mappings) return;
  dep.mappings.splice(mi, 1);
  delete dependencyMappingBuffers.value[di + '-' + mi];
}
// Apply mapping options from buffer
function applyDependencyMapping(di, mi) {
  const key = di + '-' + mi;
  const raw = dependencyMappingBuffers.value[key] || '';
  const arr = raw.split(',').map(s => s.trim()).filter(Boolean);
  const dep = currentField.value.dependencies?.[di];
  if (dep && dep.mappings?.[mi]) {
    dep.mappings[mi].allowedOptions = arr;
  }
}
// Check if a picklist option is selected for a dependency
function isPicklistOptionSelected(di, option) {
  const dep = currentField.value.dependencies?.[di];
  if (!dep) return false;
  if (!dep.allowedOptions) dep.allowedOptions = [];
  const optionValue = getPicklistOptionValue(option);
  // Check if the value is in allowedOptions (handle both string and object values)
  return dep.allowedOptions.some(selected => {
    const selectedValue = getPicklistOptionValue(selected);
    return selectedValue === optionValue;
  });
}

// Toggle a picklist option selection
function isPopupFieldSelected(di, fieldKey) {
  const dep = currentField.value.dependencies?.[di];
  if (!dep) return false;
  if (!dep.popupFields) dep.popupFields = [];
  return dep.popupFields.includes(fieldKey);
}

function togglePopupField(di, fieldKey) {
  const dep = currentField.value.dependencies?.[di];
  if (!dep) return;
  if (!dep.popupFields) dep.popupFields = [];
  
  const index = dep.popupFields.indexOf(fieldKey);
  if (index > -1) {
    dep.popupFields.splice(index, 1);
  } else {
    dep.popupFields.push(fieldKey);
  }
}

function togglePicklistOption(di, option) {
  const dep = currentField.value.dependencies?.[di];
  if (!dep) return;
  if (!dep.allowedOptions) dep.allowedOptions = [];
  const optionValue = getPicklistOptionValue(option);
  
  // Find index by comparing values
  const index = dep.allowedOptions.findIndex(selected => {
    const selectedValue = getPicklistOptionValue(selected);
    return selectedValue === optionValue;
  });
  
  if (index > -1) {
    // Remove if already selected
    dep.allowedOptions.splice(index, 1);
  } else {
    // Add if not selected - store the normalized value (string) for consistency
    dep.allowedOptions.push(optionValue);
  }
}

// Apply allowed options for picklist dependency (legacy support)
function applyDependencyOptions(di) {
  const raw = dependencyOptionsBuffer.value[di] || '';
  const arr = raw.split(',').map(s => s.trim()).filter(Boolean);
  const dep = currentField.value.dependencies?.[di];
  if (dep) {
    dep.allowedOptions = arr;
  }
}

function addAdvancedDependency() {
  if (!currentField.value.advancedDependencies) currentField.value.advancedDependencies = [];
  currentField.value.advancedDependencies.push({ name: '', type: 'visibility', logic: 'AND', conditions: [], allowedOptions: [] });
}
function removeAdvancedDependency(idx) {
  currentField.value.advancedDependencies.splice(idx, 1);
  delete advancedOptionsBuffers.value[idx];
}
function addAdvancedCondition(ri) {
  const r = currentField.value.advancedDependencies[ri];
  if (!r.conditions) r.conditions = [];
  r.conditions.push({ fieldKey: '', operator: 'equals', value: '' });
}
function removeAdvancedCondition(ri, ci) {
  const r = currentField.value.advancedDependencies[ri];
  if (!r || !r.conditions) return;
  r.conditions.splice(ci, 1);
  delete advancedValueBuffers.value[ri + '-' + ci];
}
function applyAdvancedValue(ri, ci) {
  const key = ri + '-' + ci;
  const val = advancedValueBuffers.value[key];
  const r = currentField.value.advancedDependencies?.[ri];
  if (r && r.conditions?.[ci]) r.conditions[ci].value = coerceValueForField(r.conditions[ci].fieldKey, val);
}
function applyAdvancedOptions(ri) {
  const raw = advancedOptionsBuffers.value[ri] || '';
  const arr = raw.split(',').map(s => s.trim()).filter(Boolean);
  if (currentField.value.advancedDependencies?.[ri]) currentField.value.advancedDependencies[ri].allowedOptions = arr;
}
function advancedValuePlaceholder(fieldKey) {
  const f = editFields.value.find(x => x.key === fieldKey);
  if (!f) return 'Value';
  switch (f.dataType) {
    case 'Integer': return 'Number';
    case 'Decimal': return 'Number';
    case 'Currency': return 'Number';
    case 'Date': return 'YYYY-MM-DD';
    case 'Date-Time': return 'YYYY-MM-DDTHH:mm';
    case 'Checkbox': return 'true/false';
    case 'Picklist': return 'One of options';
    case 'Multi-Picklist': return 'One of options';
    default: return 'Value';
  }
}
function coerceValueForField(fieldKey, val) {
  const f = editFields.value.find(x => x.key === fieldKey);
  if (!f) return val;
  if (f.dataType === 'Integer' || f.dataType === 'Decimal' || f.dataType === 'Currency') {
    const n = Number(val);
    return isNaN(n) ? val : n;
  }
  if (f.dataType === 'Checkbox') {
    if (val === true || val === false) return val;
    if (typeof val === 'string') return val.toLowerCase() === 'true';
  }
  return val;
}

function uniqueFieldsByKey(arr) {
  if (!Array.isArray(arr)) return [];
  const map = new Map();
  // Process in order, keeping the last occurrence of each duplicate
  // This preserves the most recent/complete version of the field
  for (const f of arr) {
    const k = (f.key || '').toLowerCase().trim();
    if (!k) continue; // Skip fields without keys
    // Always update to keep the last occurrence (which may have more complete data)
    map.set(k, f);
  }
  // Return deduplicated array, preserving relative order
  const result = Array.from(map.values());
  // Ensure order is maintained based on original order
  return result.sort((a, b) => {
    const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    // If order is same, maintain array position
    const idxA = arr.findIndex(x => (x.key || '').toLowerCase() === (a.key || '').toLowerCase());
    const idxB = arr.findIndex(x => (x.key || '').toLowerCase() === (b.key || '').toLowerCase());
    return idxA - idxB;
  });
}

function addPicklistDependency() {
  if (!currentField.value.picklistDependencies) currentField.value.picklistDependencies = [];
  currentField.value.picklistDependencies.push({ sourceFieldKey: '', mappings: [] });
}
function removePicklistDependency(idx) {
  currentField.value.picklistDependencies.splice(idx, 1);
}
function addPicklistMapping(pdi) {
  const pd = currentField.value.picklistDependencies[pdi];
  if (!pd.mappings) pd.mappings = [];
  pd.mappings.push({ whenValue: '', allowedOptions: [] });
}
function removePicklistMapping(pdi, mi) {
  const pd = currentField.value.picklistDependencies[pdi];
  if (!pd || !pd.mappings) return;
  pd.mappings.splice(mi, 1);
  delete picklistOptionsBuffers.value[pdi + '-' + mi];
}
function applyPicklistOptions(pdi, mi) {
  const key = pdi + '-' + mi;
  const raw = picklistOptionsBuffers.value[key] || '';
  const arr = raw.split(',').map(s => s.trim()).filter(Boolean);
  const pd = currentField.value.picklistDependencies?.[pdi];
  if (pd && pd.mappings?.[mi]) pd.mappings[mi].allowedOptions = arr;
}

function onDragStart(idx) {
  dragStartIdx.value = idx;
}

function onDragOver(idx) {
  dragOverIdx.value = idx;
}

async function onDrop(idx) {
  const from = dragStartIdx.value;
  const to = idx;
  dragStartIdx.value = null;
  dragOverIdx.value = null;
  if (from === null || to === null || from === to) return;
  moveField(from, to - from);
  // Auto-save new order
  try {
    await saveModule();
  } catch (e) {
    console.error('Auto-save order failed', e);
  }
}

// Row drag-reorder
function onRowDragStart(ri) {
  dragRowSrc.value = ri;
}
function onRowDragOver(ri) {
  dragRowOver.value = ri;
}
function onRowDrop(ri) {
  if (dragRowSrc.value === null) return;
  const from = dragRowSrc.value;
  dragRowOver.value = null;
  dragRowSrc.value = null;
  if (from === ri) return;
  const [moved] = quickLayout.value.rows.splice(from, 1);
  quickLayout.value.rows.splice(ri, 0, moved);
  autoSaveQuickCreate();
}

// Snapshot helpers to detect unsaved changes
function getSnapshot() {
  // ensure deterministic order
  // Deduplicate fields before saving
  const deduplicatedFields = uniqueFieldsByKey(editFields.value);
  const normalizedFields = deduplicatedFields.map((f, i) => ({ ...f, order: i }));
  const payload = {
    fields: normalizedFields,
    relationships: relationships.value,
    quickCreate: Array.from(quickCreateSelected.value),
    quickCreateLayout: quickLayout.value,
    name: moduleNameEdit.value,
    enabled: moduleEnabled.value,
    pipelineSettings: selectedModule.value?.key === 'deals'
      ? normalizePipelineSettings(pipelineSettings.value)
      : []
  };
  return JSON.stringify(payload);
}
const isDirty = computed(() => getSnapshot() !== originalSnapshot.value);
function getQuickSnapshot() {
  const orderedKeys = orderedQuickCreate.value.map(f => f.key);
  const payload = {
    quickCreate: quickMode.value === 'simple' ? orderedKeys : Array.from(quickCreateSelected.value),
    quickCreateLayout: quickLayout.value
  };
  return JSON.stringify(payload);
}
const quickDirty = computed(() => getQuickSnapshot() !== quickOriginalSnapshot.value);

async function saveQuickCreate() {
  const mod = selectedModule.value;
  if (!mod) return;
  try {
    const url = mod.type === 'system' ? `/api/modules/system/${mod.key}` : `/api/modules/${mod._id}`;
    const orderedKeys = orderedQuickCreate.value.map(f => f.key);
    const payload = {
      quickCreate: quickMode.value === 'simple' ? orderedKeys : Array.from(quickCreateSelected.value),
      quickCreateLayout: quickMode.value === 'advanced' ? quickLayout.value : { version: 1, rows: [] }
    };
    
    console.log('Saving Quick Create:', {
      module: mod.key,
      mode: quickMode.value,
      quickCreate: payload.quickCreate,
      quickCreateLayout: payload.quickCreateLayout,
      payload
    });
    
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authStore.user?.token}` },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      console.error('Save Quick Create failed:', data);
      return alert(data.message || 'Failed to save quick create');
    }
    
    console.log('Quick Create saved successfully:', {
      quickCreate: data.data?.quickCreate,
      quickCreateLayout: data.data?.quickCreateLayout
    });
    // cache selection locally for resilience
    try {
      localStorage.setItem(`litedesk-modfields-quick-${mod.key}`, JSON.stringify(payload.quickCreate));
    } catch (e) {}
    await fetchModules();
    const updated = modules.value.find(m => m.key === mod.key);
    if (updated) selectModule(updated, editFields.value[selectedFieldIdx.value]?.key || null);
    quickOriginalSnapshot.value = getQuickSnapshot();
  } catch (e) {
    console.error('Save quick create failed', e);
  }
}

onMounted(fetchModules);

// Persist top/sub tab selection to URL
watch(activeTopTab, (v, oldValue) => {
  const mod = selectedModule.value;
  if (!mod) return;
  const allowedTabs = getAllowedTopTabs(mod.key);
  if (!allowedTabs.includes(v)) {
    const fallback = allowedTabs.includes(oldValue) ? oldValue : (allowedTabs[0] || 'fields');
    if (fallback !== v) {
      activeTopTab.value = fallback;
    }
    return;
  }
  // Only update if value actually changed (avoid infinite loops during initialization)
  if (v !== oldValue && oldValue !== undefined) {
    console.log('Tab changed:', { from: oldValue, to: v, module: mod.key });
    router.replace({ query: { ...route.query, mode: v } });
    // Also store in localStorage for persistence across refreshes
    localStorage.setItem(`litedesk-modfields-tab-${mod.key}`, v);
  }
}, { immediate: false });

watch(activeSubTab, (v) => {
  const mod = selectedModule.value;
  if (!mod) return;
  router.replace({ query: { ...route.query, subtab: v } });
});

// Persist quick mode to URL
watch(selectedPipelineKey, () => {
  stageSettingsExpanded.value = {};
});

watch(currentPipeline, (pipeline) => {
  stageSettingsExpanded.value = {};
  if (!actionModalState.open) return;
  const stage = actionModalStage.value;
  const action = actionModalAction.value;
  if (!pipeline || !stage || !action) {
    closeActionModal();
  }
});

watch([actionModalStage, actionModalAction], ([stage, action]) => {
  if (!actionModalState.open) return;
  if (!stage || !action) {
    closeActionModal();
  }
});

watch(quickMode, (v) => {
  const mod = selectedModule.value;
  if (!mod) return;
  router.replace({ query: { ...route.query, quickMode: v } });
});

const stageDragSource = ref({ pipelineKey: '', index: null });
const stageDragOver = ref({ pipelineKey: '', index: null });

function resetStageDrag() {
  stageDragSource.value = { pipelineKey: '', index: null };
  stageDragOver.value = { pipelineKey: '', index: null };
}

function onStageDragStart(pipelineKey, stageIndex, event) {
  stageDragSource.value = { pipelineKey, index: stageIndex };
  stageDragOver.value = { pipelineKey, index: stageIndex };
  if (event?.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', `${pipelineKey}:${stageIndex}`);
  }
}

function onStageDragOver(pipelineKey, stageIndex) {
  if (stageDragSource.value.pipelineKey !== pipelineKey) return;
  stageDragOver.value = { pipelineKey, index: stageIndex };
}

function onStageDrop(pipelineKey, stageIndex) {
  const source = stageDragSource.value;
  if (source.pipelineKey !== pipelineKey || source.index === null) {
    resetStageDrag();
    return;
  }
  const pipeline = pipelineSettings.value.find(p => p.key === pipelineKey);
  if (!pipeline) {
    resetStageDrag();
    return;
  }
  let from = source.index;
  let to = stageIndex;
  if (to > pipeline.stages.length) to = pipeline.stages.length;
  if (from === to) {
    resetStageDrag();
    return;
  }
  const [stage] = pipeline.stages.splice(from, 1);
  if (to > pipeline.stages.length) {
    to = pipeline.stages.length;
  }
  if (from < to) {
    to -= 1;
  }
  pipeline.stages.splice(to, 0, stage);
  pipeline.stages.forEach((s, idx) => (s.order = idx));
  resetStageDrag();
}

function onStageListDragOver(pipelineKey) {
  if (stageDragSource.value.pipelineKey !== pipelineKey) return;
  stageDragOver.value = { pipelineKey, index: pipelineSettings.value.find(p => p.key === pipelineKey)?.stages.length ?? 0 };
}

function onStageListDrop(pipelineKey) {
  const pipeline = pipelineSettings.value.find(p => p.key === pipelineKey);
  if (!pipeline) {
    resetStageDrag();
    return;
  }
  onStageDrop(pipelineKey, pipeline.stages.length);
}
</script>


