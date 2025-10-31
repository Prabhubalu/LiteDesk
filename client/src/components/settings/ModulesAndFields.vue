<template>
  <div class="p-6 h-full flex flex-col overflow-hidden">
    <div class="mb-4 flex items-center gap-3">
      <template v-if="selectedModuleId">
        <button @click="clearSelection" class="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5" title="Back to modules">
          <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M12.78 15.22a.75.75 0 01-1.06 0l-4.5-4.5a.75.75 0 010-1.06l4.5-4.5a.75.75 0 111.06 1.06L8.56 10l4.22 4.22a.75.75 0 010 1.06z" clip-rule="evenodd"/></svg>
        </button>
        <div>
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ selectedModule?.name }}</h2>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">Configure fields, relationships and quick create</p>
        </div>
      </template>
      <template v-else>
        <div>
          <h2 class="text-2xl font-bold text-gray-900 dark:text-white">Modules & Fields</h2>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">Manage modules and configure fields</p>
        </div>
      </template>
    </div>

    <!-- If no module selected: show previous grid listing -->
    <div v-if="!selectedModuleId" class="flex-1 overflow-y-auto">
      <div class="flex items-center gap-2 mb-4">
        <input v-model="newModuleName" placeholder="Module name (e.g., Assets)" class="px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white flex-1" />
        <input v-model="newModuleKey" placeholder="Key (e.g., assets)" class="px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white w-48" />
        <button @click="createModule" class="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium">Create Module</button>
      </div>
      <div v-if="loading" class="flex items-center justify-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
      </div>
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div v-for="mod in modules" :key="mod._id" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 cursor-pointer" @click="selectModule(mod)">
          <div class="flex items-start justify-between">
            <div>
              <p class="text-xs uppercase tracking-wider" :class="mod.type === 'system' ? 'text-purple-600 dark:text-purple-300' : 'text-gray-500 dark:text-gray-400'">{{ mod.type }}</p>
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
      </div>

      <!-- Fields configuration: two-panel layout -->
      <div v-if="activeTopTab === 'fields'" class="flex-1 overflow-hidden flex gap-4">
      <!-- Left: Fields list -->
      <aside class="w-96 flex-none bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
        <div class="p-3 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
          <div class="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{{ selectedModule?.name }}</div>
        </div>
        <div class="p-2 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
          <div class="text-xs text-gray-500 dark:text-gray-400">Fields</div>
          <button v-if="selectedModule?.type === 'custom'" @click="openAddField" class="px-2 py-1 bg-gray-100 dark:bg-white/10 rounded text-xs">Add</button>
        </div>
        <div class="p-2 border-b border-gray-200 dark:border-white/10">
          <input v-model="fieldSearch" placeholder="Search fields" class="w-full px-2 py-1 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs" />
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
                </div>
                <div>
                  <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Type</label>
                  <select v-model="currentField.dataType" :disabled="isSystemField(currentField) || isCoreField(currentField, selectedModule?.key)" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10">
                    <option v-for="t in fieldTypes" :key="t" :value="t">{{ t }}</option>
                  </select>
                  <p v-if="isCoreField(currentField, selectedModule?.key)" class="mt-1 text-xs text-gray-500 dark:text-gray-400">Core fields cannot have their type changed</p>
                </div>
                <div class="flex items-center gap-6 mt-6">
                  <label class="inline-flex items-center gap-2 text-sm"><input type="checkbox" v-model="currentField.required" :disabled="isSystemField(currentField) || currentField.dataType === 'Auto-Number' || currentField.dataType === 'Formula' || currentField.dataType === 'Rollup Summary'" /> Required</label>
                  <label class="inline-flex items-center gap-2 text-sm"><input type="checkbox" v-model="currentField.visibility.list" :disabled="isSystemField(currentField)" /> Show in List</label>
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
                <label class="block text-xs text-gray-600 dark:text-gray-400 mb-2">Field Validation</label>
                <div class="flex items-center gap-2 flex-wrap mb-3">
                  <button @click="addValidation" class="px-2 py-1 bg-gray-100 dark:bg-white/10 rounded text-xs">Add custom validation</button>
                </div>
                <div class="space-y-3">
                  <div v-for="(v, vi) in currentField.validations" :key="vi" class="border border-gray-200 dark:border-white/10 rounded-lg p-3 space-y-2">
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

                    <div class="flex justify-end">
                      <button @click="removeValidation(vi)" class="text-red-600 dark:text-red-400 text-sm">Remove validation</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="activeSubTab === 'dependencies'">
              <div>
                <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Dependencies</label>
                <div class="mb-2">
                  <label class="text-xs text-gray-600 dark:text-gray-400 mr-2">Logic</label>
                  <select v-model="currentField.dependencyLogic" class="px-2 py-1 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm">
                    <option value="AND">AND</option>
                    <option value="OR">OR</option>
                  </select>
                </div>
                <div class="space-y-2">
                  <div v-for="(d, di) in currentField.dependencies" :key="di" class="grid grid-cols-12 gap-2 items-center">
                    <select v-model="d.fieldKey" class="col-span-5 px-2 py-1 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm">
                      <option v-for="f in otherFields" :key="f.key" :value="f.key">{{ f.label || f.key }}</option>
                    </select>
                    <select v-model="d.operator" class="col-span-2 px-2 py-1 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm">
                      <option value="equals">equals</option>
                      <option value="in">in</option>
                    </select>
                    <input v-if="d.operator === 'equals'" v-model="d.value" placeholder="Value" class="col-span-4 px-2 py-1 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm" />
                    <input v-else v-model="dependencyValuesBuffer[di]" placeholder="a, b, c" class="col-span-4 px-2 py-1 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm" @change="applyDependencyValues(di)" />
                    <button @click="removeDependency(di)" class="col-span-1 text-red-600 dark:text-red-400 text-sm">✕</button>
                  </div>
                  <button @click="addDependency" class="px-2 py-1 bg-gray-100 dark:bg-white/10 rounded text-xs">Add dependency</button>
                </div>
              </div>
              <!-- Picklist dependencies (filter options) -->
              <div v-if="['Picklist','Multi-Picklist'].includes(currentField.dataType)" class="mt-6">
                <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Picklist Dependencies</label>
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">Filter this field's options based on another field's value.</p>
                <div class="space-y-3">
                  <div v-for="(pd, pdi) in (currentField.picklistDependencies || (currentField.picklistDependencies = []))" :key="pdi" class="border border-gray-200 dark:border-white/10 rounded-lg p-3">
                    <div class="flex items-center gap-2 mb-2">
                      <span class="text-xs text-gray-600 dark:text-gray-400">Source field</span>
                      <select v-model="pd.sourceFieldKey" class="px-2 py-1 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs">
                        <option disabled value="">Select field</option>
                        <option v-for="f in otherFields" :key="f.key" :value="f.key">{{ f.label || f.key }}</option>
                      </select>
                      <button @click="removePicklistDependency(pdi)" class="ml-auto text-xs text-red-600 dark:text-red-400">Remove</button>
                    </div>
                    <div class="space-y-2">
                      <div v-for="(m, mi) in (pd.mappings || (pd.mappings = []))" :key="mi" class="grid grid-cols-12 gap-2 items-center">
                        <input v-model="m.whenValue" placeholder="When value equals..." class="col-span-4 px-2 py-1 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs" />
                        <input v-model="picklistOptionsBuffers[pdi + '-' + mi]" @change="applyPicklistOptions(pdi, mi)" placeholder="Allowed options (comma separated)" class="col-span-7 px-2 py-1 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs" />
                        <button @click="removePicklistMapping(pdi, mi)" class="col-span-1 text-xs text-red-600 dark:text-red-400">✕</button>
                      </div>
                      <button @click="addPicklistMapping(pdi)" class="px-2 py-1 bg-gray-100 dark:bg-white/10 rounded text-xs">Add mapping</button>
                    </div>
                  </div>
                  <button @click="addPicklistDependency" class="px-2 py-1 bg-gray-100 dark:bg-white/10 rounded text-xs">Add picklist dependency</button>
                </div>
              </div>
              <!-- Advanced Dependencies: visibility, read-only, picklist updates -->
              <div class="mt-6">
                <div class="flex items-center justify-between mb-2">
                  <label class="block text-xs text-gray-600 dark:text-gray-400">Advanced Dependencies</label>
                  <button @click="addAdvancedDependency" class="px-2 py-1 bg-gray-100 dark:bg-white/10 rounded text-xs">Add rule</button>
                </div>
                <div v-if="!currentField.advancedDependencies || currentField.advancedDependencies.length === 0" class="text-xs text-gray-500 dark:text-gray-400">No advanced rules.</div>
                <div v-else class="space-y-3">
                  <div v-for="(r, ri) in currentField.advancedDependencies" :key="ri" class="border border-gray-200 dark:border-white/10 rounded-lg p-3 space-y-2">
                    <div class="grid grid-cols-12 gap-2 items-center">
                      <input v-model="r.name" placeholder="Rule name" class="col-span-4 px-2 py-1 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs" />
                      <select v-model="r.type" class="col-span-3 px-2 py-1 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs">
                        <option value="visibility">Visibility</option>
                        <option value="readonly">Read-only</option>
                        <option value="picklist">Picklist Options</option>
                      </select>
                      <select v-model="r.logic" class="col-span-2 px-2 py-1 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs">
                        <option value="AND">AND</option>
                        <option value="OR">OR</option>
                      </select>
                      <button @click="removeAdvancedDependency(ri)" class="col-span-1 text-xs text-red-600 dark:text-red-400">✕</button>
                    </div>
                    <div class="space-y-2">
                      <div v-for="(c, ci) in (r.conditions || (r.conditions = []))" :key="ci" class="grid grid-cols-12 gap-2 items-center">
                        <select v-model="c.fieldKey" class="col-span-4 px-2 py-1 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs">
                          <option v-for="f in otherFields" :key="f.key" :value="f.key">{{ f.label || f.key }}</option>
                        </select>
                        <select v-model="c.operator" class="col-span-3 px-2 py-1 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs">
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
                        <input v-model="advancedValueBuffers[ri + '-' + ci]" @change="applyAdvancedValue(ri, ci)" :placeholder="advancedValuePlaceholder(c.fieldKey)" class="col-span-4 px-2 py-1 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs" />
                        <button @click="removeAdvancedCondition(ri, ci)" class="col-span-1 text-xs text-red-600 dark:text-red-400">✕</button>
                      </div>
                      <button @click="addAdvancedCondition(ri)" class="px-2 py-1 bg-gray-100 dark:bg-white/10 rounded text-xs">Add condition</button>
                    </div>
                    <div v-if="r.type === 'picklist'" class="grid grid-cols-12 gap-2 items-center">
                      <span class="col-span-3 text-xs text-gray-600 dark:text-gray-400">Allowed options</span>
                      <input v-model="advancedOptionsBuffers[ri]" @change="applyAdvancedOptions(ri)" placeholder="Comma separated" class="col-span-8 px-2 py-1 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs" />
                    </div>
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
              {{ activeTopTab === 'details' ? 'Module Details' : activeTopTab === 'relationships' ? 'Relationships' : 'Quick Create' }}
            </h3>
            <p class="text-xs text-gray-500 dark:text-gray-400">Module: {{ selectedModule?.name }} • Key: {{ selectedModule?.key }}</p>
          </div>
          <div class="flex items-center gap-2">
            <button v-if="(activeTopTab === 'details' || activeTopTab === 'relationships') && isDirty" @click="saveModule" class="px-3 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium">Save changes</button>
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

        <div class="p-4" v-else-if="activeTopTab === 'relationships'">
          <div class="mb-3 flex items-center justify-between">
            <h4 class="text-sm font-semibold text-gray-800 dark:text-gray-200">Relationships</h4>
            <button @click="addRelationship" class="px-3 py-1.5 bg-gray-100 dark:bg-white/10 rounded text-xs">Add relationship</button>
          </div>
          <div v-if="relationships.length === 0" class="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-white/5 border border-dashed border-gray-200 dark:border-white/10 rounded-xl p-6 text-center">
            No relationships defined.
          </div>
          <div v-else class="space-y-3">
            <div v-for="(r, ri) in relationships" :key="ri" class="border border-gray-200 dark:border-white/10 rounded-lg p-3">
              <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Name</label>
                  <input v-model="r.name" placeholder="e.g., Primary Organization" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10" />
                </div>
                <div>
                  <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Type</label>
                  <select v-model="r.type" class="w-full px-2 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10">
                    <option value="one_to_one">One-to-One</option>
                    <option value="one_to_many">One-to-Many</option>
                    <option value="many_to_many">Many-to-Many</option>
                    <option value="lookup">Lookup</option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Target Module</label>
                  <select v-model="r.targetModuleKey" class="w-full px-2 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10">
                    <option v-for="m in modules" :key="m.key" :value="m.key">{{ m.name }}</option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Local Field</label>
                  <input v-model="r.localField" placeholder="e.g., organizationId" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10" />
                </div>
                <div>
                  <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Foreign Field</label>
                  <input v-model="r.foreignField" placeholder="e.g., _id" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10" />
                </div>
                <div>
                  <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">Label</label>
                  <input v-model="r.label" placeholder="Display label" class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10" />
                </div>
              </div>
              <div class="mt-3 flex items-center gap-4 text-sm">
                <label class="inline-flex items-center gap-2"><input type="checkbox" v-model="r.required" /> Required</label>
                <label class="inline-flex items-center gap-2"><input type="checkbox" v-model="r.unique" /> Unique</label>
                <label class="inline-flex items-center gap-2"><input type="checkbox" v-model="r.index" /> Index</label>
                <label class="inline-flex items-center gap-2"><input type="checkbox" v-model="r.cascadeDelete" /> Cascade Delete</label>
                <button @click="removeRelationship(ri)" class="ml-auto text-red-600 dark:text-red-400">Remove</button>
              </div>
            </div>
          </div>
        </div>

        <div class="p-4" v-else>
          <div class="mb-3 flex items-center justify-between">
            <div class="text-sm font-semibold text-gray-800 dark:text-gray-200">Quick Create Mode</div>
            <div class="inline-flex rounded-lg border border-gray-200 dark:border-white/10 overflow-hidden text-sm">
              <button @click="quickMode = 'simple'" :class="quickMode === 'simple' ? 'bg-brand-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'" class="px-3 py-1.5">Simple</button>
              <button @click="quickMode = 'advanced'" :class="quickMode === 'advanced' ? 'bg-brand-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'" class="px-3 py-1.5">Advanced</button>
            </div>
          </div>
          <div class="flex gap-4">
            <!-- Left: Field palette (drag to rows/columns) -->
            <aside class="w-96 flex-none bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div class="p-3 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
                <div class="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">Field Palette</div>
              </div>
              <div class="p-2 max-h-[60vh] overflow-y-auto">
                <!-- Simple mode: checkboxes -->
                <ul v-if="quickMode === 'simple'" class="space-y-1">
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
                <!-- Advanced mode: drag items -->
                <ul v-else class="space-y-1">
                  <li v-for="f in editFields" :key="f.key" class="px-3 py-2 rounded hover:bg-gray-50 dark:hover:bg-white/5 cursor-grab select-none flex items-center gap-2"
                      draggable="true" @dragstart="onFieldDragStart(f.key)"
                      :class="isFieldUsedInLayout(f.key) ? 'opacity-50' : ''">
                    <svg class="w-3.5 h-3.5 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path d="M7 2a1 1 0 011 1v2a1 1 0 11-2 0V3a1 1 0 011-1zm5 0a1 1 0 011 1v2a1 1 0 11-2 0V3a1 1 0 011-1zM7 8a1 1 0 011 1v2a1 1 0 11-2 0V9a1 1 0 011-1zm5 0a1 1 0 011 1v2a1 1 0 11-2 0V9a1 1 0 011-1zM7 14a1 1 0 011 1v2a1 1 0 11-2 0v-2a1 1 0 011-1zm5 0a1 1 0 011 1v2a1 1 0 11-2 0v-2a1 1 0 011-1z"/></svg>
                    <span class="text-sm text-gray-800 dark:text-gray-200 truncate">{{ f.label || f.key }}</span>
                  </li>
                </ul>
              </div>
              <div class="p-3 border-t border-gray-200 dark:border-white/10">
                <div class="text-xs text-gray-500 dark:text-gray-400" v-if="quickMode === 'advanced'">Drag fields into columns to include them in the form.</div>
                <div class="text-xs text-gray-500 dark:text-gray-400" v-else>Select fields to include in Quick Create.</div>
              </div>
            </aside>
            <!-- Right: Simple list OR Builder -->
            <section class="flex-1 min-w-0 space-y-6">
              <!-- Simple mode rendering -->
              <div v-if="quickMode === 'simple'" class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
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

              <!-- Advanced builder -->
              <div v-else class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
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
                           :class="[spanClass(col.span), dragColOver.ri===ri && dragColOver.ci===ci ? 'ring-2 ring-brand-500/50' : '' ]"
                           class="border border-dashed border-gray-300 dark:border-white/10 rounded-lg p-3"
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
              </div>
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
            <div v-for="(col, ci) in row.cols" :key="`pv-${ri}-${ci}`" :class="[spanClass(col.span)]" class="bg-gray-50 dark:bg-white/5 rounded border border-gray-200 dark:border-white/10 px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
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
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();
const modules = ref([]);
const loading = ref(false);
const newModuleName = ref('');
const newModuleKey = ref('');
const selectedModuleId = ref(null);
const editFields = ref([]);
const selectedFieldIdx = ref(0);
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
const topTabs = [
  { id: 'details', name: 'Module details' },
  { id: 'fields', name: 'Field Configurations' },
  { id: 'relationships', name: 'Relationships' },
  { id: 'quick', name: 'Quick Create' }
];
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
const quickMode = ref('advanced');
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
const filteredFields = computed(() => {
  const q = (fieldSearch.value || '').toLowerCase();
  if (!q) return editFields.value;
  return editFields.value.filter(f => (f.label || '').toLowerCase().includes(q) || (f.key || '').toLowerCase().includes(q));
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
  const systemFieldKeys = ['createdby', 'organizationid', 'createdat', 'updatedat'];
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
        // Initialize quick mode: from URL if present; otherwise infer from layout
        const qMode = typeof route.query.quickMode === 'string' ? route.query.quickMode : null;
        if (qMode === 'simple' || qMode === 'advanced') {
          quickMode.value = qMode;
        } else {
          quickMode.value = (quickLayout.value?.rows?.length || 0) > 0 ? 'advanced' : 'simple';
          router.replace({ query: { ...route.query, quickMode: quickMode.value } });
        }
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
        const useLayout = (quickMode.value === 'advanced' && layoutKeysInit.length > 0);
        const baseKeys = useLayout ? layoutKeysInit : quickKeysInit;
        // Always include required fields in Simple mode
        const requiredKeys = editFields.value.filter(f => !!f.required && !!f.key).map(f => f.key);
        const combined = quickMode.value === 'simple' ? Array.from(new Set([...baseKeys, ...requiredKeys])) : baseKeys;
        quickCreateSelected.value = new Set(combined);
        // capture snapshot after initializing state
        originalSnapshot.value = getSnapshot();
        quickOriginalSnapshot.value = getQuickSnapshot();
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
            // initialize quick mode if missing
            const qMode = typeof route.query.quickMode === 'string' ? route.query.quickMode : null;
            if (qMode === 'simple' || qMode === 'advanced') quickMode.value = qMode; else {
              quickMode.value = (quickLayout.value?.rows?.length || 0) > 0 ? 'advanced' : 'simple';
              router.replace({ query: { ...route.query, quickMode: quickMode.value } });
            }
            // now derive selection based on mode
            const layoutKeysInit = extractLayoutKeys(quickLayout.value);
            const quickKeysInit = storedMod.quickCreate || [];
            const useLayout = (quickMode.value === 'advanced' && layoutKeysInit.length > 0);
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
  const storedTab = localStorage.getItem(`litedesk-modfields-tab-${mod.key}`);
  if (storedTab && ['details', 'fields', 'relationships', 'quick'].includes(storedTab)) {
    console.log('Restoring tab from localStorage when selecting module:', storedTab, 'for module:', mod.key);
    activeTopTab.value = storedTab;
  } else {
    console.log('No stored tab found for module:', mod.key, 'using current:', activeTopTab.value);
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
  // keep quickMode from URL if present; else infer from layout
  const qMode = typeof route.query.quickMode === 'string' ? route.query.quickMode : null;
  if (qMode === 'simple' || qMode === 'advanced') {
    quickMode.value = qMode;
  } else {
    quickMode.value = (quickLayout.value?.rows?.length || 0) > 0 ? 'advanced' : 'simple';
    router.replace({ query: { ...route.query, quickMode: quickMode.value } });
  }
  // Choose selection source based on mode: advanced -> layout, simple -> quickCreate
  const layoutKeys = extractLayoutKeys(quickLayout.value);
  let quickKeys = mod.quickCreate || [];
  if (!layoutKeys.length && !quickKeys.length) {
    try {
      const cached = JSON.parse(localStorage.getItem(`litedesk-modfields-quick-${mod.key}`) || '[]');
      if (Array.isArray(cached) && cached.length) quickKeys = cached;
    } catch (e) {}
  }
  const useLayout = (quickMode.value === 'advanced' && layoutKeys.length > 0);
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

const createModule = async () => {
  if (!newModuleName.value || !newModuleKey.value) return alert('Name and key are required');
  try {
    const res = await fetch('/api/modules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authStore.user?.token}` },
      body: JSON.stringify({ name: newModuleName.value, key: newModuleKey.value })
    });
    const data = await res.json();
    if (!res.ok || !data.success) return alert(data.message || 'Failed to create module');
    newModuleName.value = '';
    newModuleKey.value = '';
    await fetchModules();
    const created = data.data;
    selectModule(created);
  } catch (e) {
    console.error('Create module failed', e);
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
  editFields.value.push({ key: '', label: '', dataType: 'Text', required: false, options: [], defaultValue: null, index: false, visibility: { list: true, detail: true }, order: editFields.value.length });
  selectedFieldIdx.value = editFields.value.length - 1;
  syncOptionsBuffer();
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

const saveModule = async () => {
  const mod = selectedModule.value;
  if (!mod) return;
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
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authStore.user?.token}` },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.success) return alert(data.message || 'Failed to save');
    await fetchModules();
    // Re-select by key to avoid unstable IDs on system modules
    const updated = modules.value.find(m => m.key === mod.key);
    // preserve current selected field
    const currentFieldKey = editFields.value[selectedFieldIdx.value]?.key || null;
    if (updated) selectModule(updated, currentFieldKey);
  // reset snapshot after successful save
  originalSnapshot.value = getSnapshot();
  quickOriginalSnapshot.value = getQuickSnapshot();
  } catch (e) {
    console.error('Save module failed', e);
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
  relationships.value.splice(idx, 1);
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
        quickCreateLayout: quickMode.value === 'advanced' ? quickLayout.value : { version: 1, rows: [] }
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
  if (quickMode.value === 'advanced' && selectedModule.value) {
    console.log('Layout changed, triggering auto-save');
    autoSaveQuickCreate();
  }
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
  if (!field || !field.key) return;
  if (field.required) return; // cannot toggle required
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

// removed addSelectedPreset (preset picker removed)
function addDependency() {
  if (!currentField.value.dependencies) currentField.value.dependencies = [];
  currentField.value.dependencies.push({ fieldKey: '', operator: 'equals', value: '' });
}
function removeDependency(idx) {
  currentField.value.dependencies.splice(idx, 1);
  delete dependencyValuesBuffer.value[idx];
}
function applyDependencyValues(idx) {
  const raw = dependencyValuesBuffer.value[idx] || '';
  const arr = raw.split(',').map(s => s.trim()).filter(Boolean);
  currentField.value.dependencies[idx].value = arr;
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
    enabled: moduleEnabled.value
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
watch(quickMode, (v) => {
  const mod = selectedModule.value;
  if (!mod) return;
  router.replace({ query: { ...route.query, quickMode: v } });
});
</script>


