<template>
  <div class="mx-auto">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 sm:mb-8">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-3">
          <h1 class="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white truncate">{{ title }}</h1>
          
          <!-- Mobile Action Buttons with Stats Icon -->
          <div class="sm:hidden flex items-center gap-2 ml-auto">
            <!-- Stats Toggle Button (Mobile) -->
            <button
              v-if="statsConfig && statsConfig.length > 0"
              @click="showStats = !showStats"
              class="inline-flex items-center justify-center px-2.5 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              :title="showStats ? 'Hide Statistics' : 'Show Statistics'"
            >
              <ChartBarIcon v-if="!showStats" class="w-5 h-5" />
              <XMarkIcon v-else class="w-5 h-5" />
            </button>
            
            <slot name="header-actions">
              <ModuleActions 
                :module="moduleKey"
                :create-label="createLabel"
                :show-import="showImport !== false"
                @create="$emit('create')"
                @import="$emit('import')"
                @export="$emit('export')"
              />
            </slot>
          </div>
          
          <!-- Stats Toggle Button (Tablet) -->
          <button
            v-if="statsConfig && statsConfig.length > 0"
            @click="showStats = !showStats"
            class="hidden sm:inline-flex md:hidden items-center justify-center px-2.5 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            :title="showStats ? 'Hide Statistics' : 'Show Statistics'"
          >
            <ChartBarIcon v-if="!showStats" class="w-5 h-5" />
            <XMarkIcon v-else class="w-5 h-5" />
          </button>
        </div>
        <p class="text-sm sm:text-base md:text-lg text-gray-600 dark:text-gray-400 mt-1 sm:mt-2">{{ description }}</p>
      </div>
      <div class="hidden sm:flex items-center gap-4 flex-shrink-0">
        <!-- Stats Toggle Button (Desktop) -->
        <button
          v-if="statsConfig && statsConfig.length > 0"
          @click="showStats = !showStats"
          class="hidden md:inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-lg text-sm sm:text-base font-medium transition-colors bg-white border border-gray-200 dark:border-0 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
          :title="showStats ? 'Hide Statistics' : 'Show Statistics'"
        >
          <ChartBarIcon v-if="!showStats" class="w-5 h-5" />
          <XMarkIcon v-else class="w-5 h-5" />
          <span>{{ showStats ? 'Hide' : 'Stats' }}</span>
        </button>
        
        <slot name="header-actions">
          <ModuleActions 
            :module="moduleKey"
            :create-label="createLabel"
            :show-import="showImport !== false"
            @create="$emit('create')"
            @import="$emit('import')"
            @export="$emit('export')"
          />
        </slot>
      </div>
    </div>

    <!-- Statistics Cards -->
    <div v-if="statsConfig && statsConfig.length > 0 && showStats" class="mb-8">
      <dl class="grid grid-cols-1 divide-gray-200 dark:divide-gray-700 overflow-hidden rounded-lg bg-white dark:bg-gray-800 shadow-sm md:grid-cols-4 md:divide-x md:divide-y-0">
        <div v-for="item in computedStats" :key="item.name" class="px-4 py-5 sm:p-6">
          <dt class="text-base font-normal text-gray-900 dark:text-gray-100">{{ item.name }}</dt>
          <dd class="mt-1 flex items-baseline justify-between md:block lg:flex">
            <div class="flex items-baseline text-2xl font-semibold text-indigo-600 dark:text-indigo-400">
              {{ item.stat }}
              <span class="ml-2 text-sm font-medium text-gray-500 dark:text-gray-400">from {{ item.previousStat }}</span>
            </div>

            <div :class="[
              item.changeType === 'increase' 
                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' 
                : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300', 
              'inline-flex items-baseline rounded-full px-2.5 py-0.5 text-sm font-medium md:mt-2 lg:mt-0'
            ]">
              <ArrowUpIcon v-if="item.changeType === 'increase'" class="mr-0.5 -ml-1 size-5 shrink-0 self-center text-green-500 dark:text-green-400" aria-hidden="true" />
              <ArrowDownIcon v-else class="mr-0.5 -ml-1 size-5 shrink-0 self-center text-red-500 dark:text-red-400" aria-hidden="true" />
              <span class="sr-only"> {{ item.changeType === 'increase' ? 'Increased' : 'Decreased' }} by </span>
              {{ item.change }}
            </div>
          </dd>
        </div>
      </dl>
    </div>

    <!-- Search and Filters -->
    <div class="flex flex-col gap-4 mb-6">
      <!-- Mobile, Tablet & Small Desktop: Search, Filters Button, Columns Button in a single row -->
      <div class="flex items-center gap-3 lg:hidden">
        <div class="flex-1 min-w-0">
          <div class="relative">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none z-10">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input 
              v-model="searchQuery" 
              type="text" 
              :placeholder="searchPlaceholder"
              @input="debouncedSearch"
              class="block w-full pl-9 pr-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 lg:text-base dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
            />
          </div>
        </div>

        <!-- Mobile & Tablet Filters Button -->
        <Popover v-if="filterConfig && filterConfig.length > 0" class="relative">
          <PopoverButton
            class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors text-sm"
          >
            <FunnelIcon class="w-4 h-4" />
            <span class="hidden sm:inline">Filters</span>
            <span v-if="hasActiveFilters" class="flex items-center justify-center w-5 h-5 text-xs font-medium text-white bg-indigo-600 rounded-full">
              {{ getActiveFiltersCount() }}
            </span>
          </PopoverButton>

          <Transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="opacity-0 translate-y-1"
            enter-to-class="opacity-100 translate-y-0"
            leave-active-class="transition duration-150 ease-in"
            leave-from-class="opacity-100 translate-y-0"
            leave-to-class="opacity-0 translate-y-1"
          >
            <PopoverPanel
              class="absolute z-10 mt-2 w-screen max-w-xs -right-2 rounded-lg bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black/5 dark:ring-white/10"
            >
              <div class="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                <div
                  v-for="filter in filterConfig"
                  :key="filter.key"
                  class="relative"
                >
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {{ filter.label || filter.key }}
                  </label>
                  <Listbox 
                    :model-value="filters[filter.key] || ''" 
                    @update:model-value="(value) => { filters[filter.key] = value; handleFilterChange(filter.key); }"
                  >
                    <div class="relative">
                      <ListboxButton
                        class="w-full rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-white text-sm outline-1 -outline-offset-1 outline-gray-300/20 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 cursor-pointer relative text-left"
                      >
                        <span class="block truncate pr-6">
                          {{ getFilterLabel(filter, filters[filter.key]) || `All ${filter.key}` }}
                        </span>
                        <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                          <ChevronUpDownIcon class="h-4 w-4 text-gray-400" aria-hidden="true" />
                        </span>
                      </ListboxButton>

                      <Transition
                        leave-active-class="transition duration-100 ease-in"
                        leave-from-class="opacity-100"
                        leave-to-class="opacity-0"
                      >
                        <ListboxOptions
                          class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white dark:bg-gray-700 py-1 text-sm shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none"
                        >
                          <ListboxOption
                            :value="''"
                            v-slot="{ active, selected }"
                          >
                            <li
                              :class="[
                                'relative cursor-default select-none py-2 pl-4 pr-10',
                                active ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100'
                              ]"
                            >
                              <span :class="[selected ? 'font-medium' : 'font-normal', 'block truncate']">
                                All
                              </span>
                              <span
                                v-if="selected"
                                class="absolute inset-y-0 right-0 flex items-center pr-3 text-indigo-600 dark:text-indigo-400"
                              >
                                <CheckIcon class="h-5 w-5" aria-hidden="true" />
                              </span>
                            </li>
                          </ListboxOption>
                          <ListboxOption
                            v-for="option in filter.options"
                            :key="option.value"
                            :value="option.value"
                            v-slot="{ active, selected }"
                          >
                            <li
                              :class="[
                                'relative cursor-default select-none py-2 pl-4 pr-10',
                                active ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100'
                              ]"
                            >
                              <span :class="[selected ? 'font-medium' : 'font-normal', 'block truncate']">
                                {{ option.label || option.value }}
                              </span>
                              <span
                                v-if="selected"
                                class="absolute inset-y-0 right-0 flex items-center pr-3 text-indigo-600 dark:text-indigo-400"
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

                <button 
                  v-if="hasActiveFilters"
                  @click="clearFilters" 
                  class="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 font-medium transition-colors text-sm"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-4 h-4">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Clear Filters
                </button>
              </div>
            </PopoverPanel>
          </Transition>
        </Popover>

        <!-- Columns Button (Mobile & Tablet) -->
        <button
          @click="showColumnSettings = !showColumnSettings"
          class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors text-sm"
          title="Column Settings"
        >
          <AdjustmentsHorizontalIcon class="w-4 h-4" />
          <span class="hidden sm:inline">Columns</span>
        </button>
      </div>

      <!-- Large Desktop: Search and Filters in a row -->
      <div class="hidden lg:flex lg:flex-row gap-4">
        <div class="w-full sm:w-80 lg:w-80">
          <div class="relative">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none z-10">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input 
              v-model="searchQuery" 
              type="text" 
              :placeholder="searchPlaceholder"
              @input="debouncedSearch"
              class="block w-full pl-9 pr-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 lg:text-base dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
            />
          </div>
        </div>

        <!-- Filters (Desktop/Tablet) -->
        <div class="flex flex-wrap items-center gap-3 flex-1">
          <div
            v-for="filter in filterConfig"
            :key="filter.key"
            class="relative"
          >
            <Listbox 
              :model-value="filters[filter.key] || ''" 
              @update:model-value="(value) => { filters[filter.key] = value; handleFilterChange(filter.key); }"
            >
              <div class="relative">
                <ListboxButton
                  class="inline-block rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2 text-gray-900 dark:text-white text-base outline-1 -outline-offset-1 outline-gray-300/20 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6 dark:focus:bg-gray-800 dark:outline-white/10 dark:focus:outline-indigo-500 cursor-pointer relative w-auto min-w-[140px] text-left"
                >
                  <span class="block truncate pr-6">
                    {{ getFilterLabel(filter, filters[filter.key]) || filter.label || `All ${filter.key}` }}
                  </span>
                  <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                    <ChevronUpDownIcon class="h-4 w-4 text-gray-400" aria-hidden="true" />
                  </span>
                </ListboxButton>

                <Transition
                  leave-active-class="transition duration-100 ease-in"
                  leave-from-class="opacity-100"
                  leave-to-class="opacity-0"
                >
                  <ListboxOptions
                    class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white dark:bg-gray-700 py-1 text-base shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none sm:text-sm min-w-[140px]"
                  >
                    <ListboxOption
                      :value="''"
                      v-slot="{ active, selected }"
                    >
                      <li
                        :class="[
                          'relative cursor-default select-none py-2 pl-4 pr-10',
                          active ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100'
                        ]"
                      >
                        <span :class="[selected ? 'font-medium' : 'font-normal', 'block truncate']">
                          {{ filter.label || `All ${filter.key}` }}
                        </span>
                        <span
                          v-if="selected"
                          class="absolute inset-y-0 right-0 flex items-center pr-3 text-indigo-600 dark:text-indigo-400"
                        >
                          <CheckIcon class="h-5 w-5" aria-hidden="true" />
                        </span>
                      </li>
                    </ListboxOption>
                    <ListboxOption
                      v-for="option in filter.options"
                      :key="option.value"
                      :value="option.value"
                      v-slot="{ active, selected }"
                    >
                      <li
                        :class="[
                          'relative cursor-default select-none py-2 pl-4 pr-10',
                          active ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100'
                        ]"
                      >
                        <span :class="[selected ? 'font-medium' : 'font-normal', 'block truncate']">
                          {{ option.label || option.value }}
                        </span>
                        <span
                          v-if="selected"
                          class="absolute inset-y-0 right-0 flex items-center pr-3 text-indigo-600 dark:text-indigo-400"
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

          <button 
            v-if="hasActiveFilters"
            @click="clearFilters" 
            class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors text-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear
          </button>
        </div>

        <!-- Columns Button (Desktop/Tablet) -->
        <div class="flex items-center">
          <button
            @click="showColumnSettings = !showColumnSettings"
            class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors text-sm"
            title="Column Settings"
          >
            <AdjustmentsHorizontalIcon class="w-4 h-4" />
            <span>Columns</span>
          </button>
        </div>
      </div>
    </div>

    <!-- DataTable -->
    <DataTable
      :data="data"
      :columns="computedColumns"
      :loading="loading"
      :paginated="true"
      :per-page="pagination.limit"
      :total-records="pagination.totalRecords"
      :selectable="true"
      :resizable="true"
      :column-settings="false"
      :server-side="true"
      :table-id="tableId"
      :mass-actions="massActions"
      :show-controls="false"
      :row-key="rowKey"
      :empty-title="emptyTitle"
      :empty-message="emptyMessage"
      @row-click="handleRowClick"
      @edit="handleEdit"
      @delete="handleDelete"
      @page-change="handlePageChange"
      @sort="handleSort"
      @select="handleSelect"
      @bulk-action="handleBulkAction"
    >
      <!-- Forward all provided slots to the inner DataTable -->
      <template v-for="(_, slotName) in $slots" #[slotName]="slotProps">
        <slot :name="slotName" v-bind="slotProps" />
      </template>

      <!-- Custom Actions -->
      <template #actions="{ row }">
        <RowActions 
          :row="row"
          :module="moduleKey"
          @view="handleView(row)"
          @edit="handleEdit(row)"
          @delete="handleDelete(row)"
        />
      </template>
    </DataTable>

    <!-- Column Settings Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition ease-out duration-200"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition ease-in duration-150"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="showColumnSettings"
          class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          @click.self="showColumnSettings = false"
        >
          <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
            <!-- Modal Header -->
            <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 class="text-xl font-semibold text-gray-900 dark:text-white">Column Settings</h3>
              <button
                @click="showColumnSettings = false"
                class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <svg class="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <!-- Modal Body -->
            <div class="flex-1 overflow-y-auto p-6">
              <div class="space-y-4">
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Choose which columns to display in the table. You can drag to reorder them.
                </p>
                
                <div class="space-y-3">
                  <div 
                    v-for="(column, index) in visibleColumns" 
                    :key="column.key"
                    :draggable="true"
                    @dragstart="handleDragStart($event, index)"
                    @dragover="handleDragOver"
                    @dragenter="handleDragEnter"
                    @dragleave="handleDragLeave"
                    @drop="handleDrop($event, index)"
                    @dragend="handleDragEnd"
                    class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-move hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors drag-over:bg-blue-50 dark:drag-over:bg-blue-900/20"
                  >
                    <div class="flex items-center gap-3">
                      <svg class="w-5 h-5 text-gray-400 cursor-move" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16" />
                      </svg>
                      <span class="text-sm font-medium text-gray-900 dark:text-white">{{ column.label }}</span>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        :checked="column.visible"
                        @change="toggleColumnVisibility(column.key)"
                        class="sr-only peer"
                      >
                      <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <!-- Modal Footer -->
            <div class="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                @click="resetColumnSettings"
                class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Reset to Default
              </button>
              <div class="flex items-center gap-3">
                <button
                  @click="showColumnSettings = false"
                  class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  @click="applyColumnSettings"
                  class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 dark:bg-indigo-700 hover:bg-indigo-700 dark:hover:bg-indigo-800 rounded-lg transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue';
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/vue/20/solid';
import { Listbox, ListboxButton, ListboxOptions, ListboxOption, Popover, PopoverButton, PopoverPanel } from '@headlessui/vue';
import { ChevronUpDownIcon, CheckIcon, AdjustmentsHorizontalIcon, FunnelIcon, ChartBarIcon, XMarkIcon } from '@heroicons/vue/24/outline';
import { Transition } from 'vue';
import DataTable from '@/components/common/DataTable.vue';
import ModuleActions from '@/components/common/ModuleActions.vue';
import RowActions from '@/components/common/RowActions.vue';
import { useBulkActions } from '@/composables/useBulkActions';

const props = defineProps({
  // Basic configuration
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  moduleKey: {
    type: String,
    required: true
  },
  createLabel: {
    type: String,
    default: 'New Record'
  },
  showImport: {
    type: Boolean,
    default: true
  },
  searchPlaceholder: {
    type: String,
    default: 'Search...'
  },
  
  // Data
  data: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  
  // Statistics configuration
  statistics: {
    type: Object,
    default: () => ({})
  },
  statsConfig: {
    type: Array,
    default: null // Array of { name, key, previousKey, formatter } or null to disable stats
  },
  
  // Table configuration
  columns: {
    type: Array,
    required: true
  },
  rowKey: {
    type: String,
    default: '_id'
  },
  tableId: {
    type: String,
    required: true
  },
  emptyTitle: {
    type: String,
    default: 'No records yet'
  },
  emptyMessage: {
    type: String,
    default: 'Start by adding your first record'
  },
  
  // Filters - Array of { key, label, options: [{value, label}] }
  filterConfig: {
    type: Array,
    default: () => []
  },
  
  // Pagination
  pagination: {
    type: Object,
    default: () => ({
      currentPage: 1,
      totalPages: 1,
      totalRecords: 0,
      limit: 20
    })
  },
  
  // Sort
  sortField: {
    type: String,
    default: 'createdAt'
  },
  sortOrder: {
    type: String,
    default: 'desc'
  }
});

const emit = defineEmits([
  'update:searchQuery',
  'update:filters',
  'update:sort',
  'update:pagination',
  'fetch',
  'row-click',
  'edit',
  'delete',
  'view',
  'create',
  'import',
  'export',
  'bulk-action'
]);

// Use bulk actions composable
const { bulkActions: massActions } = useBulkActions(props.moduleKey);

// State
const searchQuery = ref('');
const showColumnSettings = ref(false);
const visibleColumns = ref([]);

// Check if we're on desktop (md breakpoint and above)
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1024);
const isDesktop = computed(() => windowWidth.value >= 768); // md breakpoint

// Stats visibility - show by default on desktop, hide on mobile/tablet
// Load from localStorage if available, otherwise use default based on screen size
const getDefaultShowStats = () => {
  if (typeof window === 'undefined') return true;
  const saved = localStorage.getItem(`litedesk-stats-visible-${props.moduleKey}`);
  if (saved !== null) {
    return saved === 'true';
  }
  return window.innerWidth >= 768; // Show by default on desktop
};

const showStats = ref(getDefaultShowStats());

// Save stats visibility preference to localStorage
const saveStatsPreference = () => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(`litedesk-stats-visible-${props.moduleKey}`, showStats.value.toString());
  }
};

// Watch for changes to showStats and save to localStorage
watch(showStats, () => {
  saveStatsPreference();
});

// Update window width on resize
const updateWindowWidth = () => {
  windowWidth.value = window.innerWidth;
};

onMounted(() => {
  if (typeof window !== 'undefined') {
    windowWidth.value = window.innerWidth;
    // Initialize showStats from localStorage or default
    showStats.value = getDefaultShowStats();
    window.addEventListener('resize', updateWindowWidth);
  }
});

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', updateWindowWidth);
  }
});

// Initialize visible columns from props.columns
const initializeColumns = () => {
  visibleColumns.value = props.columns.map(col => ({
    key: col.key,
    label: col.label || col.key,
    visible: col.visible !== false,
    sortable: col.sortable !== false,
    dataType: col.dataType
  }));
};

// Initialize on mount
initializeColumns();

// Watch for column changes
watch(() => props.columns, () => {
  initializeColumns();
}, { deep: true });

// Computed stats for HeadlessUI template
const computedStats = computed(() => {
  if (!props.statsConfig || props.statsConfig.length === 0) return [];
  
  return props.statsConfig.map(config => {
    const currentValue = props.statistics[config.key] || 0;
    const previousValue = config.previousKey 
      ? (props.statistics[config.previousKey] || 0)
      : Math.max(0, currentValue - Math.floor(currentValue * (config.changePercent || 0.1)));
    
    // Calculate change percentage
    const change = previousValue > 0 
      ? Math.round(((currentValue - previousValue) / previousValue) * 100) 
      : 0;
    
    // Format the stat value
    let formattedStat = currentValue;
    if (config.formatter === 'currency') {
      formattedStat = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(currentValue);
    } else if (config.formatter === 'number') {
      formattedStat = currentValue.toLocaleString();
    } else if (typeof config.formatter === 'function') {
      formattedStat = config.formatter(currentValue);
    } else {
      formattedStat = currentValue.toLocaleString();
    }
    
    // Format previous stat
    let formattedPrevious = previousValue;
    if (config.formatter === 'currency') {
      formattedPrevious = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(previousValue);
    } else if (config.formatter === 'number') {
      formattedPrevious = previousValue.toLocaleString();
    } else if (typeof config.formatter === 'function') {
      formattedPrevious = config.formatter(previousValue);
    } else {
      formattedPrevious = previousValue.toLocaleString();
    }
    
    return {
      name: config.name,
      stat: formattedStat,
      previousStat: formattedPrevious,
      change: `${Math.abs(change)}%`,
      changeType: change >= 0 ? 'increase' : 'decrease'
    };
  });
});

// Computed columns based on visible columns
const computedColumns = computed(() => {
  return visibleColumns.value
    .filter(col => col.visible)
    .map(col => {
      const originalCol = props.columns.find(c => c.key === col.key);
      return originalCol || col;
    });
});

// Filters
const filters = reactive({});

// Check if any filters are active
const hasActiveFilters = computed(() => {
  return searchQuery.value.trim() !== '' || 
    Object.values(filters).some(value => value !== '' && value !== null && value !== undefined);
});

// Debounced search
let searchTimeout;
const debouncedSearch = () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    emit('update:searchQuery', searchQuery.value);
    emit('fetch');
  }, 500);
};

// Get filter label for display
const getFilterLabel = (filter, value) => {
  if (!value) return null;
  const option = filter.options.find(opt => opt.value === value);
  return option ? (option.label || option.value) : null;
};

// Get count of active filters for mobile badge
const getActiveFiltersCount = () => {
  return Object.values(filters).filter(value => value !== '' && value !== null && value !== undefined).length;
};

// Handle filter change
const handleFilterChange = (key) => {
  emit('update:filters', { ...filters });
  emit('fetch');
};

// Update filters (kept for backward compatibility if needed)
const updateFilters = (key, value) => {
  filters[key] = value;
  emit('update:filters', { ...filters });
  emit('fetch');
};

// Initialize filters from filterConfig
watch(() => props.filterConfig, (newConfig) => {
  newConfig.forEach(filter => {
    if (!(filter.key in filters)) {
      filters[filter.key] = '';
    }
  });
}, { immediate: true });

// Clear filters
const clearFilters = () => {
  searchQuery.value = '';
  Object.keys(filters).forEach(key => {
    filters[key] = '';
  });
  emit('update:searchQuery', '');
  emit('update:filters', filters);
  emit('fetch');
};

// Column settings
const resetColumnSettings = () => {
  visibleColumns.value = visibleColumns.value.map(col => ({ ...col, visible: true }));
};

const applyColumnSettings = () => {
  showColumnSettings.value = false;
  emit('fetch');
};

const toggleColumnVisibility = (columnKey) => {
  const column = visibleColumns.value.find(col => col.key === columnKey);
  if (column) {
    column.visible = !column.visible;
  }
};

// Drag and drop for columns
const dragStartIndex = ref(null);

const handleDragStart = (event, index) => {
  dragStartIndex.value = index;
  event.dataTransfer.effectAllowed = 'move';
  event.target.style.opacity = '0.5';
};

const handleDragOver = (event) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
};

const handleDragEnter = (event) => {
  event.preventDefault();
  event.target.classList.add('drag-over');
};

const handleDragLeave = (event) => {
  event.target.classList.remove('drag-over');
};

const handleDrop = (event, dropIndex) => {
  event.preventDefault();
  event.target.classList.remove('drag-over');
  
  if (dragStartIndex.value !== null && dragStartIndex.value !== dropIndex) {
    const draggedColumn = visibleColumns.value[dragStartIndex.value];
    visibleColumns.value.splice(dragStartIndex.value, 1);
    visibleColumns.value.splice(dropIndex, 0, draggedColumn);
  }
  
  dragStartIndex.value = null;
};

const handleDragEnd = (event) => {
  event.target.style.opacity = '1';
  dragStartIndex.value = null;
};

// Event handlers
const handleRowClick = (row, event) => {
  emit('row-click', row, event);
};

const handleEdit = (row) => {
  emit('edit', row);
};

const handleDelete = (row) => {
  emit('delete', row);
};

const handleView = (row) => {
  emit('view', row);
};

const handlePageChange = (page) => {
  emit('update:pagination', { ...props.pagination, currentPage: page });
  emit('fetch');
};

const handleSort = ({ key, order }) => {
  emit('update:sort', { sortField: key, sortOrder: order });
  emit('fetch');
};

const handleSelect = (selected) => {
  // Handle selection if needed
};

const handleBulkAction = (actionId, selectedRows) => {
  emit('bulk-action', actionId, selectedRows);
};
</script>


