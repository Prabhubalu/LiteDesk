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
              class="inline-flex items-center justify-center px-2.5 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
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
            class="hidden sm:inline-flex md:hidden items-center justify-center px-2.5 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
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
          class="hidden md:inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-lg text-sm sm:text-base font-medium transition-colors bg-white border border-gray-200 dark:border-0 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 cursor-pointer"
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
    <div class="flex flex-col gap-4 mb-4 relative z-20">
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
              class="block w-full pl-9 pr-10 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 lg:text-sm dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
            />
            <button
              v-if="searchQuery"
              type="button"
              @click="clearSearch"
              class="absolute inset-y-0 right-2 flex items-center justify-center rounded-sm p-1 text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 cursor-pointer"
              :aria-label="`Clear search for ${title}`"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 0 1 1.414 0L10 8.586l4.293-4.293a1 1 0 1 1 1.414 1.414L11.414 10l4.293 4.293a1 1 0 0 1-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 0 1-1.414-1.414L8.586 10 4.293 5.707a1 1 0 0 1 0-1.414Z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Mobile & Tablet Filters Button -->
        <Popover v-if="filterConfig && filterConfig.length > 0" class="relative">
          <PopoverButton
            class="inline-flex h-10 items-center gap-2 px-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors text-sm cursor-pointer"
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
              class="absolute z-20 mt-2 w-screen max-w-xs -right-2 rounded-lg bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black/5 dark:ring-white/10"
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
                        class="relative z-[26] inline-flex h-10 w-full items-center rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-3 text-gray-900 dark:text-white text-sm outline-1 -outline-offset-1 outline-gray-300/20 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 cursor-pointer text-left"
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
                  class="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white dark:bg-gray-700 py-1 text-sm shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none"
                        >
                          <ListboxOption
                            :value="''"
                            v-slot="{ active, selected }"
                          >
                            <li
                              :class="[
                                'relative cursor-pointer select-none py-2 pl-4 pr-10',
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
                                'relative cursor-pointer select-none py-2 pl-4 pr-10',
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
                  class="w-full inline-flex h-10 items-center justify-center gap-2 px-3 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 font-medium transition-colors text-sm cursor-pointer"
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

        <!-- Customize Button (Mobile & Tablet) -->
        <button
          @click="showColumnSettings = !showColumnSettings"
          class="inline-flex h-10 items-center gap-2 px-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors text-sm cursor-pointer"
          title="Customize View"
        >
          <Cog6ToothIcon class="w-4 h-4" />
          <span class="hidden sm:inline">Customize</span>
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
              class="block h-10 w-full pl-9 pr-10 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 lg:text-sm dark:focus:bg-gray-800 dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:outline-indigo-500"
            />
            <button
              v-if="searchQuery"
              type="button"
              @click="clearSearch"
              class="absolute inset-y-0 right-2 flex items-center justify-center rounded-full p-1 text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 cursor-pointer"
              :aria-label="`Clear search for ${title}`"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 0 1 1.414 0L10 8.586l4.293-4.293a1 1 0 1 1 1.414 1.414L11.414 10l4.293 4.293a1 1 0 0 1-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 0 1-1.414-1.414L8.586 10 4.293 5.707a1 1 0 0 1 0-1.414Z" clip-rule="evenodd" />
              </svg>
            </button>
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
                  class="inline-flex h-10 items-center rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 text-gray-900 dark:text-white text-sm outline-1 -outline-offset-1 outline-gray-300/20 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 dark:focus:bg-gray-800 dark:outline-white/10 dark:focus:outline-indigo-500 cursor-pointer relative w-auto min-w-[140px] text-left leading-none"
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
          class="inline-flex h-10 items-center gap-2 px-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors text-sm cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear
          </button>
        </div>

        <!-- Customize Button (Desktop/Tablet) -->
        <div class="flex items-center">
          <button
            @click="showColumnSettings = !showColumnSettings"
            class="inline-flex items-center h-10 gap-2 px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors text-sm cursor-pointer"
            title="Customize View"
          >
            <Cog6ToothIcon class="w-4 h-4" />
            <span>Customize</span>
          </button>
        </div>
      </div>
    </div>

    <div class="mt-4 px-4 sm:px-6 lg:px-8">
      <template v-if="showEmptyState">
        <div class="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <img
            src="/assets/illustrations/mindfulness.svg"
            alt="No records illustration"
            class="mx-auto h-40 w-auto"
          />
          <h3 class="mt-6 text-lg font-semibold text-gray-900 dark:text-white">{{ emptyStateTitle }}</h3>
          <p class="mt-3 text-sm text-gray-600 dark:text-gray-400">
            {{ emptyStateMessage }}
          </p>
          <div v-if="canClearFilters" class="mt-6 flex justify-center">
            <button
              @click="clearFilters"
              class="inline-flex items-center gap-2 rounded-lg bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-600 transition-colors hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50 cursor-pointer"
            >
              <XMarkIcon class="h-4 w-4" />
              <span>Clear search & filters</span>
            </button>
          </div>
        </div>
      </template>
      <template v-else>
        <TableView
          internal-scroll
          :data="data"
          :columns="computedColumns"
          :loading="tableLoading"
          :skeleton-row-count="skeletonRowCount"
          :selectable="true"
          :has-actions="true"
          :sort-field="sortField"
          :sort-order="sortOrder"
          :mass-actions="massActions"
          :row-key="rowKey"
          :empty-title="emptyTitle"
          :empty-message="emptyMessage"
          :table-id="tableId"
          :resizable-columns="resizableColumns"
          :row-height="rowHeight"
          :reset-widths="resetWidthsTrigger"
          :clear-selection-trigger="clearSelectionTrigger"
          @row-click="handleRowClick"
          @edit="handleEdit"
          @delete="handleDelete"
          @sort="handleSort"
          @select="handleSelect"
          @bulk-action="handleBulkAction"
        >
          <!-- Forward all provided slots to the inner TableView -->
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
              @delete="handleDeleteClick(row)"
            />
          </template>
        </TableView>
      </template>
    </div>

    <!-- Delete Confirmation Modal -->
    <DeleteConfirmationModal
      :show="showDeleteModal"
      :record-name="deleteRecordName"
      :record-type="moduleKey"
      :deleting="deleting"
      :is-bulk="isBulkDelete"
      :bulk-count="bulkDeleteRows.length"
      @close="handleDeleteModalClose"
      @confirm="confirmDelete"
    />

    <!-- Mass Actions Bar - Floating Style -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="opacity-0 translate-y-4 scale-95"
        enter-to-class="opacity-100 translate-y-0 scale-100"
        leave-active-class="transition-all duration-200 ease-in"
        leave-from-class="opacity-100 translate-y-0 scale-100"
        leave-to-class="opacity-0 translate-y-4 scale-95"
      >
        <div
          v-if="selectedRows.length > 0"
          class="fixed bottom-4 sm:bottom-6 left-2 right-2 sm:left-1/2 sm:-translate-x-1/2 z-[9999] bg-gray-800 dark:bg-gray-800 rounded-xl shadow-lg sm:max-w-[800px]"
          :style="windowWidth >= 640 ? { 
            marginLeft: headerLeft === '0px' ? '0' : `calc(${headerLeft} / 2)`
          } : {}"
        >
          <div class="flex items-center px-4 sm:px-6 py-2 sm:py-2.5 gap-3">
            <!-- Left: Selection Count with Close Icon -->
            <button
              @click="clearSelection"
              class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/20 dark:border-gray-600 text-white dark:text-white font-medium text-sm flex-shrink-0 cursor-pointer hover:bg-gray-700 dark:hover:bg-gray-700 transition-colors"
              title="Clear selection"
            >
              <span class="font-semibold">{{ selectedRows.length }}</span>
              <span class="font-medium">
                {{ selectedRows.length === 1 ? title.slice(0, -1) : title }} selected
              </span>
              <XMarkIcon class="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
            </button>

            <!-- Right: Mass Actions -->
            <div class="flex items-center gap-1 sm:gap-2 flex-1 overflow-x-auto sm:overflow-visible justify-end">
              <!-- Non-delete actions -->
              <button
                v-for="action in massActions.filter(a => a.action !== 'delete' && a.icon !== 'delete' && a.icon !== 'trash')"
                :key="action.action"
                @click="handleBulkActionClick(action.action)"
                class="flex flex-col items-center gap-0.5 sm:gap-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg hover:bg-gray-700 dark:hover:bg-gray-700 transition-colors group flex-shrink-0 cursor-pointer"
                :class="action.variant === 'primary' ? 'text-teal-400 dark:text-teal-400' : 'text-gray-300 dark:text-gray-300'"
              >
                <component
                  :is="getActionIcon(action.icon)"
                  class="w-4 h-4 sm:w-5 sm:h-5"
                />
                <span class="text-[10px] sm:text-xs font-medium leading-tight">{{ action.label }}</span>
              </button>
              
              <!-- Delete action (always on the right side of actions) -->
              <button
                v-for="action in massActions.filter(a => a.action === 'delete' || a.icon === 'delete' || a.icon === 'trash')"
                :key="action.action"
                @click="handleBulkActionClick(action.action)"
                class="flex flex-col items-center gap-0.5 sm:gap-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg hover:bg-gray-700 dark:hover:bg-gray-700 transition-colors group text-red-400 dark:text-red-400 flex-shrink-0 cursor-pointer"
              >
                <component
                  :is="getActionIcon(action.icon)"
                  class="w-4 h-4 sm:w-5 sm:h-5"
                />
                <span class="text-[10px] sm:text-xs font-medium leading-tight">{{ action.label }}</span>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Customize View Drawer -->
    <Teleport to="body">
      <!-- Backdrop -->
      <Transition
        enter-active-class="transition-opacity duration-300 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-300 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="showColumnSettings"
          @click="showColumnSettings = false"
          class="fixed inset-0 bg-black/20 dark:bg-black/40 z-[9998]"
        ></div>
      </Transition>
      <!-- Drawer -->
      <Transition
        enter-active-class="transition-transform ease-out duration-300"
        enter-from-class="translate-x-full"
        enter-to-class="translate-x-0"
        leave-active-class="transition-transform ease-in duration-300"
        leave-from-class="translate-x-0"
        leave-to-class="translate-x-full"
      >
        <div
          v-if="showColumnSettings"
          @click.stop
          class="fixed right-0 top-0 h-full w-full max-w-xs bg-white dark:bg-gray-900 shadow-2xl flex flex-col z-[9999]"
        >
              <!-- Drawer Header -->
              <div class="flex items-center justify-between px-6 pr-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Customize View</h3>
                <button
                  @click="showColumnSettings = false"
                  class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer"
                >
                  <XMarkIcon class="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              <!-- Drawer Body -->
              <div class="flex-1 overflow-y-auto">
                <!-- Layout Options Section -->
                <div class="border-b border-gray-200 dark:border-gray-700">
                  <button
                    @click="layoutOptionsExpanded = !layoutOptionsExpanded"
                    class="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                  >
                    <div class="flex items-center gap-3">
                      <WrenchScrewdriverIcon class="w-5 h-5 text-gray-500 dark:text-gray-400" />
                      <span class="text-sm font-medium text-gray-900 dark:text-white">Layout options</span>
                    </div>
                    <ChevronDownIcon 
                      :class="['w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform', layoutOptionsExpanded ? 'rotate-180' : '']" 
                    />
                  </button>
                  
                  <div v-if="layoutOptionsExpanded" class="pb-4 space-y-0">
                    <!-- Row Height -->
                    <Menu as="div" class="relative px-3">
                      <MenuButton class="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors cursor-pointer">
                        <span>Row Height</span>
                        <div class="flex items-center gap-2">
                          <span class="text-gray-500 dark:text-gray-400">{{ rowHeightLabels[rowHeight] }}</span>
                          <ChevronRightIcon class="w-4 h-4" />
                        </div>
                      </MenuButton>
                      <Transition
                        enter-active-class="transition duration-100 ease-out"
                        enter-from-class="transform scale-95 opacity-0"
                        enter-to-class="transform scale-100 opacity-100"
                        leave-active-class="transition duration-75 ease-in"
                        leave-from-class="transform scale-100 opacity-100"
                        leave-to-class="transform scale-95 opacity-0"
                      >
                        <MenuItems class="absolute right-4 z-10 mt-2 w-40 origin-top-right rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg focus:outline-none">
                          <div class="py-1">
                            <MenuItem
                              v-for="(label, value) in rowHeightLabels"
                              :key="value"
                              v-slot="{ active }"
                            >
                              <button
                                @click="rowHeight = value"
                                :class="[
                                  active ? 'bg-gray-100 dark:bg-gray-700' : '',
                                  rowHeight === value ? 'text-indigo-600 dark:text-indigo-400 font-medium' : 'text-gray-700 dark:text-gray-300',
                                  'block w-full text-left px-4 py-2 text-sm cursor-pointer'
                                ]"
                              >
                                {{ label }}
                              </button>
                            </MenuItem>
                          </div>
                        </MenuItems>
                      </Transition>
                    </Menu>

                    <!-- Reset -->
                    <Menu as="div" class="relative px-3">
                      <MenuButton class="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors cursor-pointer">
                        <span>Reset</span>
                        <ChevronRightIcon class="w-4 h-4" />
                      </MenuButton>
                      <Transition
                        enter-active-class="transition duration-100 ease-out"
                        enter-from-class="transform scale-95 opacity-0"
                        enter-to-class="transform scale-100 opacity-100"
                        leave-active-class="transition duration-75 ease-in"
                        leave-from-class="transform scale-100 opacity-100"
                        leave-to-class="transform scale-95 opacity-0"
                      >
                        <MenuItems class="absolute right-4 z-10 mt-2 w-56 origin-top-right rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg focus:outline-none">
                          <div class="py-1">
                            <MenuItem v-slot="{ active }">
                              <button
                                @click="autosizeAllColumns"
                                :class="[
                                  active ? 'bg-gray-100 dark:bg-gray-700' : '',
                                  'block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer'
                                ]"
                              >
                                Columns widths
                              </button>
                            </MenuItem>
                            <MenuItem v-slot="{ active }">
                              <button
                                @click="resetColumnSettings"
                                :class="[
                                  active ? 'bg-gray-100 dark:bg-gray-700' : '',
                                  'block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer'
                                ]"
                              >
                                Default view
                              </button>
                            </MenuItem>
                          </div>
                        </MenuItems>
                      </Transition>
                    </Menu>

                  </div>
                </div>

                <!-- Manage Fields Section -->
                <div>
                  <button
                    @click="manageFieldsExpanded = !manageFieldsExpanded"
                    class="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                  >
                    <div class="flex items-center gap-3">
                      <PencilSquareIcon class="w-5 h-5 text-gray-500 dark:text-gray-400" />
                      <span class="text-sm font-medium text-gray-900 dark:text-white">Manage fields</span>
                    </div>
                    <ChevronDownIcon 
                      :class="['w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform', manageFieldsExpanded ? 'rotate-180' : '']" 
                    />
                  </button>
                  
                  <div v-if="manageFieldsExpanded" class="pb-4 space-y-4">
                    <!-- Search Fields -->
                    <div class="relative px-6">
                      <MagnifyingGlassIcon class="absolute left-9 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        v-model="fieldSearchQuery"
                        type="text"
                        placeholder="Search fields"
                        class="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                      />
                    </div>

                    <!-- Shown Fields -->
                    <div>
                      <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3 px-6">
                        Shown ({{ shownFields.length }})
                      </h4>
                      <div class="space-y-0 px-3">
                        <div
                          v-for="(field, index) in shownFields"
                          :key="field.key"
                          :draggable="true"
                          @dragstart="handleDragStart($event, index)"
                          @dragover.prevent="handleDragOver"
                          @dragenter.prevent="handleDragEnter($event, index)"
                          @dragleave.prevent="handleDragLeave"
                          @drop.prevent="handleDrop($event, index)"
                          @dragend="handleDragEnd"
                          :class="[
                            'flex items-center gap-3 px-2 py-2 rounded-lg transition-colors cursor-move',
                            dragOverIndex === index ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                          ]"
                        >
                          <!-- Grip handle icon (6 dots vertical) -->
                          <svg class="w-5 h-5 text-gray-400 flex-shrink-0 cursor-move" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="9" cy="5" r="1.5" />
                            <circle cx="9" cy="12" r="1.5" />
                            <circle cx="9" cy="19" r="1.5" />
                            <circle cx="15" cy="5" r="1.5" />
                            <circle cx="15" cy="12" r="1.5" />
                            <circle cx="15" cy="19" r="1.5" />
                          </svg>
                          <component
                            :is="getFieldIcon(field.dataType)"
                            class="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0"
                          />
                          <span class="flex-1 text-sm text-gray-900 dark:text-white">{{ field.label }}</span>
                          <label class="relative inline-flex items-center cursor-pointer flex-shrink-0">
                            <input 
                              type="checkbox" 
                              :checked="field.visible"
                              @change="toggleFieldVisibility(field.key)"
                              class="sr-only peer"
                            >
                            <div class="w-9 h-5 bg-indigo-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-indigo-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600"></div>
                          </label>
                        </div>
                      </div>
                    </div>

                    <!-- Hidden Fields -->
                    <div>
                      <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3 px-6">
                        Hidden
                      </h4>
                      <div class="space-y-0 px-3">
                        <div
                          v-for="field in hiddenFields"
                          :key="field.key"
                          class="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          <component
                            :is="getFieldIcon(field.dataType)"
                            class="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0"
                          />
                          <span class="flex-1 text-sm text-gray-900 dark:text-white">{{ field.label }}</span>
                          <label class="relative inline-flex items-center cursor-pointer flex-shrink-0">
                            <input 
                              type="checkbox" 
                              :checked="field.visible"
                              @change="toggleFieldVisibility(field.key)"
                              class="sr-only peer"
                            >
                            <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                          </label>
                        </div>
                        <div v-if="hiddenFields.length === 0" class="text-sm text-gray-500 dark:text-gray-400 py-2 text-center">
                          No hidden fields
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Drawer Footer -->
              <div class="border-t border-gray-200 dark:border-gray-700 px-6 py-4">
                <button
                  @click="openNewCustomField"
                  class="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-800 text-white rounded-lg transition-colors text-sm font-medium cursor-pointer"
                >
                  <PlusIcon class="w-5 h-5" />
                  <span>New Custom Field</span>
                </button>
              </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Quick Preview Drawer -->
    <QuickPreviewDrawer
      v-if="activeTabId"
      :key="`drawer-${activeTabId}`"
      :show="showPreviewDrawer"
      :row="previewRow"
      :columns="computedColumns"
      :module-title="title"
      :module-key="moduleKey"
      @close="() => { showPreviewDrawer = false; saveDrawerState(); }"
      @update="handlePreviewUpdate"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/vue/20/solid';
import { Listbox, ListboxButton, ListboxOptions, ListboxOption, Popover, PopoverButton, PopoverPanel, Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue';
import { ChevronUpDownIcon, CheckIcon, Cog6ToothIcon, FunnelIcon, ChartBarIcon, XMarkIcon, WrenchScrewdriverIcon, ChevronDownIcon, ChevronRightIcon, PencilSquareIcon, MagnifyingGlassIcon, PlusIcon, TrashIcon, ArrowDownTrayIcon, DocumentDuplicateIcon, ArrowUpTrayIcon, ArchiveBoxIcon, ArrowPathIcon, ArrowRightIcon, StarIcon, PuzzlePieceIcon, RectangleStackIcon } from '@heroicons/vue/24/outline';
import { 
  DocumentTextIcon, 
  UserIcon, 
  CalendarIcon, 
  TagIcon, 
  FlagIcon, 
  CheckCircleIcon,
  GlobeAltIcon,
  LinkIcon
} from '@heroicons/vue/24/outline';
import { Transition } from 'vue';
import TableView from '@/components/common/TableView.vue';
import ModuleActions from '@/components/common/ModuleActions.vue';
import RowActions from '@/components/common/RowActions.vue';
import DeleteConfirmationModal from '@/components/common/DeleteConfirmationModal.vue';
import QuickPreviewDrawer from '@/components/common/QuickPreviewDrawer.vue';
import { useBulkActions } from '@/composables/useBulkActions';
import { useAuthStore } from '@/stores/auth';
import { useTabs } from '@/composables/useTabs';
import apiClient from '@/utils/apiClient';

const authStore = useAuthStore();
const { activeTabId } = useTabs();

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
  resizableColumns: {
    type: Boolean,
    default: true
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
  },
  resizableColumns: {
    type: Boolean,
    default: true
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
  'bulk-action',
  'row-updated'
]);

// Use bulk actions composable
const { bulkActions: massActions } = useBulkActions(props.moduleKey);

// State
const searchQuery = ref('');
const showColumnSettings = ref(false);
const visibleColumns = ref([]);
const layoutOptionsExpanded = ref(true);
const manageFieldsExpanded = ref(true);
const fieldSearchQuery = ref('');
const dragOverIndex = ref(null);
const backendModuleConfig = ref(null); // Store backend module configuration with all fields
const resetWidthsTrigger = ref(0); // Trigger to reset column widths in TableView
const showDeleteModal = ref(false);
const rowToDelete = ref(null);
const deleting = ref(false);
const isBulkDelete = ref(false);
const bulkDeleteRows = ref([]);
const showPreviewDrawer = ref(false);
const previewRow = ref(null);

// Store drawer state per tab
const drawerStateByTab = ref(new Map());
// Flag to prevent saving during restoration
const isRestoring = ref(false);

// Save drawer state for current tab
const saveDrawerState = () => {
  if (activeTabId.value && !isRestoring.value) {
    drawerStateByTab.value.set(activeTabId.value, {
      show: showPreviewDrawer.value,
      row: previewRow.value ? { ...previewRow.value } : null
    });
  }
};

// Restore drawer state for current tab
const restoreDrawerState = () => {
  if (activeTabId.value) {
    isRestoring.value = true;
    const savedState = drawerStateByTab.value.get(activeTabId.value);
    if (savedState && savedState.show) {
      showPreviewDrawer.value = savedState.show;
      previewRow.value = savedState.row;
    } else {
      // No saved state for this tab, close drawer
      showPreviewDrawer.value = false;
      previewRow.value = null;
    }
    nextTick(() => {
      isRestoring.value = false;
    });
  } else {
    // No active tab, close drawer
    showPreviewDrawer.value = false;
    previewRow.value = null;
  }
};

// Watch for tab changes
watch(() => activeTabId.value, (newTabId, oldTabId) => {
  // Save state for old tab before switching
  if (oldTabId) {
    isRestoring.value = true;
    saveDrawerState();
    isRestoring.value = false;
  }
  // Immediately close drawer when switching tabs (will restore if tab has saved state)
  showPreviewDrawer.value = false;
  previewRow.value = null;
  // Then restore state for new tab
  nextTick(() => {
    restoreDrawerState();
  });
});

// Watch for drawer state changes and save to current tab (but not during restoration)
watch([showPreviewDrawer, previewRow], () => {
  if (activeTabId.value && !isRestoring.value) {
    saveDrawerState();
  }
}, { deep: true });

// Get record name for delete modal
const deleteRecordName = computed(() => {
  if (!rowToDelete.value) return '';
  
  const row = rowToDelete.value;
  
  // Try common name fields in order of preference
  if (row.name) return row.name;
  if (row.title) return row.title;
  if (row.firstName || row.lastName) {
    return `${row.firstName || ''} ${row.lastName || ''}`.trim();
  }
  if (row.first_name || row.last_name) {
    return `${row.first_name || ''} ${row.last_name || ''}`.trim();
  }
  
  return '';
});

// Row height - load from localStorage
const rowHeightStorageKey = computed(() => `${STORAGE_PREFIX}-${props.moduleKey}-row-height`);
const getDefaultRowHeight = () => {
  if (typeof window === 'undefined') return 'medium';
  const saved = localStorage.getItem(rowHeightStorageKey.value);
  return (saved && ['small', 'medium', 'large', 'huge'].includes(saved)) ? saved : 'medium';
};
const rowHeight = ref('medium'); // Initialize with default, will be set on mount

// Watch row height and save to localStorage
watch(rowHeight, (value) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(rowHeightStorageKey.value, value);
  }
});

// Row height options
const rowHeightLabels = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
  huge: 'Huge'
};

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

// Load saved column settings from localStorage
const loadSavedColumnSettings = () => {
  if (typeof window === 'undefined' || !Array.isArray(props.columns)) {
    return null;
  }

  try {
    const saved = localStorage.getItem(columnsStorageKey.value);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (error) {
    console.warn('Failed to parse saved column settings', error);
  }
  return null;
};

// Save column settings to localStorage
const saveColumnSettings = () => {
  if (typeof window === 'undefined' || visibleColumns.value.length === 0) {
    return;
  }

  try {
    const settingsToSave = visibleColumns.value.map(col => ({
      key: col.key,
      label: col.label,
      visible: col.visible,
      dataType: col.dataType,
      showInTable: col.showInTable
    }));
    localStorage.setItem(columnsStorageKey.value, JSON.stringify(settingsToSave));
  } catch (error) {
    console.warn('Failed to save column settings', error);
  }
};

// Fetch field configuration from backend and sync visibility
const fetchFieldConfiguration = async () => {
  try {
    const moduleKey = props.moduleKey;
    if (!moduleKey) return null;
    
    const authStore = useAuthStore();
    const token = authStore.user?.token;
    if (!token) return null;
    
    const modulesResponse = await fetch('/api/modules', {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!modulesResponse.ok) {
      return null;
    }
    
    const modulesData = await modulesResponse.json();
    if (!modulesData.success || !Array.isArray(modulesData.data)) {
      return null;
    }
    
    // Find the module by key
    const module = modulesData.data.find(m => m.key === moduleKey);
    if (module) {
      // Store backend config for later use
      backendModuleConfig.value = module;
    }
    return module || null;
  } catch (error) {
    console.warn('Error fetching field configuration:', error);
    return null;
  }
};

// Initialize visible columns from props.columns, saved settings, or backend configuration
const initializeColumns = async () => {
  if (!Array.isArray(props.columns)) {
    visibleColumns.value = [];
    return;
  }

  // Try to load saved settings first
  const savedSettings = loadSavedColumnSettings();
  
  if (savedSettings && savedSettings.length > 0) {
    // Use saved settings, but also fetch backend config to include all fields
    const moduleConfig = await fetchFieldConfiguration();
    const backendFields = moduleConfig?.fields || [];
    
    // Create maps for quick lookup
    const savedMap = new Map(savedSettings.map(s => [s.key, s]));
    const backendFieldsMap = new Map(backendFields.map(f => [f.key, f]));
    const propsColumnsMap = new Map(props.columns.map(c => [c.key, c]));
    
    const orderedColumns = [];
    const processedKeys = new Set();
    
    // First, add columns from saved settings in saved order
    savedSettings.forEach(saved => {
      const originalCol = propsColumnsMap.get(saved.key);
      const backendField = backendFieldsMap.get(saved.key);
      
      if (originalCol || backendField) {
        orderedColumns.push({
          key: saved.key,
          label: saved.label || originalCol?.label || backendField?.label || saved.key,
          visible: saved.visible !== undefined ? saved.visible : false,
          sortable: originalCol?.sortable !== false,
          dataType: saved.dataType || originalCol?.dataType || backendField?.dataType || 'Text',
          showInTable: saved.showInTable !== undefined ? saved.showInTable : (saved.visible !== false)
        });
        processedKeys.add(saved.key);
      }
    });
    
    // Then add backend fields that aren't in saved settings (these are hidden by default)
    backendFields.forEach(field => {
      if (field.key && !processedKeys.has(field.key)) {
        const propsCol = propsColumnsMap.get(field.key);
        orderedColumns.push({
          key: field.key,
          label: field.label || propsCol?.label || field.key,
          visible: false, // Not in saved settings, so hidden
          sortable: propsCol?.sortable !== false,
          dataType: field.dataType || propsCol?.dataType || 'Text',
          showInTable: field.visibility?.list !== false
        });
        processedKeys.add(field.key);
      }
    });
    
    // Finally, add any columns from props that aren't in backend or saved settings
    props.columns.forEach(col => {
      if (!processedKeys.has(col.key)) {
        orderedColumns.push({
          key: col.key,
          label: col.label || col.key,
          visible: col.visible !== false,
          sortable: col.sortable !== false,
          dataType: col.dataType || 'Text',
          showInTable: col.showInTable !== false
        });
      }
    });
    
    visibleColumns.value = orderedColumns;
  } else {
    // No saved settings - fetch from backend configuration
    const moduleConfig = await fetchFieldConfiguration();
    
    if (moduleConfig && Array.isArray(moduleConfig.fields)) {
      // Create a map of field visibility from backend
      const fieldVisibilityMap = new Map();
      const backendFieldsMap = new Map();
      moduleConfig.fields.forEach(field => {
        if (field.key) {
          const isVisible = field.visibility?.list !== false; // Default to true if not set
          fieldVisibilityMap.set(field.key, isVisible);
          backendFieldsMap.set(field.key, field);
        }
      });
      
      // Start with all fields from backend configuration
      const initializedColumns = [];
      const processedKeys = new Set();
      
      // First, add all backend fields
      moduleConfig.fields.forEach(field => {
        if (field.key) {
          const propsCol = props.columns.find(c => c.key === field.key);
          const isVisible = fieldVisibilityMap.get(field.key);
          
          initializedColumns.push({
            key: field.key,
            label: field.label || propsCol?.label || field.key,
            visible: isVisible,
            sortable: propsCol?.sortable !== false,
            dataType: field.dataType || propsCol?.dataType || 'Text',
            showInTable: isVisible
          });
          processedKeys.add(field.key);
        }
      });
      
      // Then add any fields from props.columns that aren't in backend
      props.columns.forEach(col => {
        if (!processedKeys.has(col.key)) {
          initializedColumns.push({
            key: col.key,
            label: col.label || col.key,
            visible: col.visibility?.list !== false,
            sortable: col.sortable !== false,
            dataType: col.dataType || 'Text',
            showInTable: col.showInTable !== false
          });
        }
      });
      
      visibleColumns.value = initializedColumns;
      
      // Save the initial state
      saveColumnSettings();
    } else {
      // Fallback to props with visibility.list check
      visibleColumns.value = props.columns.map(col => {
        const visibilityFromConfig = col.visibility?.list !== undefined ? col.visibility.list : undefined;
        const visible = visibilityFromConfig !== undefined ? visibilityFromConfig : (col.visible !== false);
        
        return {
          key: col.key,
          label: col.label || col.key,
          visible: visible,
          sortable: col.sortable !== false,
          dataType: col.dataType || 'Text',
          showInTable: col.showInTable !== undefined ? col.showInTable : visible
        };
      });
    }
  }
};

// Watch for column changes from props (new columns added)
watch(() => props.columns, async () => {
  // Only update if we don't have saved settings, or if new columns are added
  const savedSettings = loadSavedColumnSettings();
  if (!savedSettings || savedSettings.length === 0) {
    await initializeColumns();
  } else {
    // Check if there are new columns
    const currentKeys = new Set(visibleColumns.value.map(c => c.key));
    const newColumns = props.columns.filter(c => !currentKeys.has(c.key));
    if (newColumns.length > 0) {
      // Add new columns to the end
      newColumns.forEach(col => {
        visibleColumns.value.push({
          key: col.key,
          label: col.label || col.key,
          visible: col.visible !== false,
          sortable: col.sortable !== false,
          dataType: col.dataType || 'Text',
          showInTable: col.showInTable !== false
        });
      });
      saveColumnSettings();
    }
  }
}, { deep: true });

// Watch visibleColumns and save whenever they change (debounced to avoid excessive saves)
let saveTimeout = null;
watch(visibleColumns, () => {
  // Debounce saves to avoid excessive localStorage writes during drag operations
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  saveTimeout = setTimeout(() => {
    saveColumnSettings();
  }, 300);
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

// Dynamic positioning based on sidebar state (reads localStorage like TabBar)
const recomputeTrigger = ref(0);
const viewportWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1024);

const headerLeft = computed(() => {
  // Force dependency on recomputeTrigger
  const _ = recomputeTrigger.value;
  
  // On mobile/tablet (< 1024px), always at left: 0 (like TabBar)
  if (viewportWidth.value < 1024) {
    return '0px';
  }
  
  // On desktop (≥ 1024px), position based on sidebar state
  const sidebarCollapsed = localStorage.getItem('litedesk-sidebar-collapsed') === 'true';
  return sidebarCollapsed ? '80px' : '256px';
});

// Filters
const filters = reactive({});
const STORAGE_PREFIX = 'litedesk-listview';
const filterStorageKey = computed(() => `${STORAGE_PREFIX}-${props.moduleKey}-filters`);
const searchStorageKey = computed(() => `${STORAGE_PREFIX}-${props.moduleKey}-search`);
const sortStorageKey = computed(() => `${STORAGE_PREFIX}-${props.moduleKey}-sort`);
const columnsStorageKey = computed(() => `${STORAGE_PREFIX}-${props.moduleKey}-columns`);

const searchTerm = computed(() => searchQuery.value.trim());

const activeFilterCount = computed(() =>
  Object.values(filters).filter(value => value !== '' && value !== null && value !== undefined).length
);

const hasFiltersApplied = computed(() => activeFilterCount.value > 0);

// Check if any filters are active
const hasActiveFilters = computed(() => searchTerm.value !== '' || hasFiltersApplied.value);

const dataLength = computed(() => (Array.isArray(props.data) ? props.data.length : 0));
const initialRender = ref(true);
const tableLoading = computed(() => (props.loading || initialRender.value) && dataLength.value === 0);
const skeletonRowCount = computed(() => {
  const limit = Number(props.pagination?.limit);
  if (Number.isFinite(limit) && limit > 0) {
    return limit;
  }
  if (dataLength.value > 0) {
    return dataLength.value;
  }
  return 5;
});
const showEmptyState = computed(() => !tableLoading.value && dataLength.value === 0);
onMounted(() => {
  requestAnimationFrame(() => {
    if (Array.isArray(props.data) && props.data.length > 0) {
      initialRender.value = false;
    }
  });
});
watch(() => props.data, (newVal) => {
  if (Array.isArray(newVal)) {
    initialRender.value = false;
  }
}, { immediate: true });

const resourceName = computed(() => (typeof props.title === 'string' ? props.title.toLowerCase() : 'records'));

const emptyStateTitle = computed(() =>
  hasActiveFilters.value ? `No ${props.title} Found` : props.emptyTitle
);

const emptyStateMessage = computed(() => {
  if (searchTerm.value && hasFiltersApplied.value) {
    return `No ${resourceName.value} match your search or filters. Try adjusting them or clear everything to start over.`;
  }
  if (searchTerm.value) {
    return `We couldn't find any ${resourceName.value} matching “${searchTerm.value}”. Try a different keyword or clear the search.`;
  }
  if (hasFiltersApplied.value) {
    return `No ${resourceName.value} match your filters. Try adjusting or clearing them to see more results.`;
  }
  return props.emptyMessage;
});

const canClearFilters = computed(() => hasActiveFilters.value);

// Debounced search
let searchTimeout;
const debouncedSearch = () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    emit('update:searchQuery', searchQuery.value);
    emit('fetch');
  }, 500);
};

const clearSearch = () => {
  if (!searchQuery.value) return;
  searchQuery.value = '';
  emit('update:searchQuery', '');
  emit('fetch');
  localStorage.removeItem(searchStorageKey.value);
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

onMounted(async () => {
  let shouldRefetch = false;

  // Initialize columns (async - fetches from backend if needed)
  await initializeColumns();
  
  // Restore drawer state for current tab
  restoreDrawerState();

  // Restore row height
  rowHeight.value = getDefaultRowHeight();

  // Restore search
  const savedSearch = localStorage.getItem(searchStorageKey.value);
  if (savedSearch !== null) {
    searchQuery.value = savedSearch;
    emit('update:searchQuery', savedSearch);
    shouldRefetch = true;
  }

  // Restore filters
  const savedFilters = localStorage.getItem(filterStorageKey.value);
  if (savedFilters) {
    try {
      const parsed = JSON.parse(savedFilters);
      let changed = false;
      Object.keys(filters).forEach(key => {
        if (parsed[key] !== undefined) {
          filters[key] = parsed[key];
          changed = true;
        }
      });
      if (changed) {
        emit('update:filters', { ...filters });
        shouldRefetch = true;
      }
    } catch (error) {
      console.warn('Failed to parse saved filters', error);
    }
  }

  const savedSort = localStorage.getItem(sortStorageKey.value);
  if (savedSort) {
    try {
      const parsed = JSON.parse(savedSort);
      const field = typeof parsed?.field === 'string' ? parsed.field : '';
      const order = parsed?.order === 'desc' ? 'desc' : 'asc';
      emit('update:sort', { sortField: field, sortOrder: order });
      if (field) {
        shouldRefetch = true;
      }
    } catch (error) {
      console.warn('Failed to parse saved sort', error);
    }
  }

  if (shouldRefetch) {
    nextTick(() => emit('fetch'));
  }
});

watch(searchQuery, (value) => {
  if (value) {
    localStorage.setItem(searchStorageKey.value, value);
  } else {
    localStorage.removeItem(searchStorageKey.value);
  }
});

watch(
  filters,
  (value) => {
    localStorage.setItem(filterStorageKey.value, JSON.stringify(value));
  },
  { deep: true }
);

// Clear filters
const clearFilters = () => {
  searchQuery.value = '';
  Object.keys(filters).forEach(key => {
    filters[key] = '';
  });
  emit('update:searchQuery', '');
  emit('update:filters', filters);
  emit('fetch');
  localStorage.removeItem(searchStorageKey.value);
  localStorage.removeItem(filterStorageKey.value);
  localStorage.removeItem(sortStorageKey.value);
};

// Field management - sync with visibleColumns and backend configuration
const allFields = computed(() => {
  // Start with all fields from backend configuration if available, otherwise use props.columns
  const backendFields = backendModuleConfig.value?.fields || [];
  const propsColumns = Array.isArray(props.columns) ? props.columns : [];
  
  // Create a map of all available fields (from backend + props.columns)
  const allFieldsMap = new Map();
  
  // First, add all fields from backend configuration
  backendFields.forEach(field => {
    if (field.key) {
      // Find corresponding column from props for additional metadata
      const propsCol = propsColumns.find(c => c.key === field.key);
      allFieldsMap.set(field.key, {
        key: field.key,
        label: field.label || propsCol?.label || field.key,
        visible: false, // Will be set from visibleColumns
        sortable: propsCol?.sortable !== false,
        dataType: field.dataType || propsCol?.dataType || 'Text',
        showInTable: field.visibility?.list !== false
      });
    }
  });
  
  // Then add any fields from props.columns that aren't in backend
  propsColumns.forEach(col => {
    if (!allFieldsMap.has(col.key)) {
      allFieldsMap.set(col.key, {
        key: col.key,
        label: col.label || col.key,
        visible: false, // Will be set from visibleColumns
        sortable: col.sortable !== false,
        dataType: col.dataType || 'Text',
        showInTable: col.showInTable !== false
      });
    }
  });
  
  // Now update visibility from visibleColumns (source of truth)
  let fields = Array.from(allFieldsMap.values()).map(field => {
    const visibleCol = visibleColumns.value.find(vc => vc.key === field.key);
    const isVisible = visibleCol ? (visibleCol.visible === true) : false;
    
    return {
      ...field,
      visible: isVisible,
      showInTable: visibleCol ? (visibleCol.showInTable !== false) : field.showInTable
    };
  });
  
  // Filter by search query
  if (fieldSearchQuery.value.trim()) {
    const query = fieldSearchQuery.value.toLowerCase();
    fields = fields.filter(field => 
      field.label.toLowerCase().includes(query) || 
      field.key.toLowerCase().includes(query)
    );
  }
  
  return fields;
});

const shownFields = computed(() => {
  // Maintain order from visibleColumns (source of truth for order)
  const visibleCols = visibleColumns.value.filter(col => col.visible);
  const visibleKeys = new Set(visibleCols.map(col => col.key));
  
  // Get fields from allFields but maintain the order from visibleColumns
  const orderedFields = visibleCols.map(col => {
    const field = allFields.value.find(f => f.key === col.key);
    return field || {
      key: col.key,
      label: col.label || col.key,
      visible: true,
      sortable: col.sortable !== false,
      dataType: col.dataType || 'Text',
      showInTable: col.showInTable !== false
    };
  });
  
  return orderedFields;
});

const hiddenFields = computed(() => {
  return allFields.value.filter(field => !field.visible);
});

// Field icon mapping
const getFieldIcon = (dataType) => {
  const iconMap = {
    'Text': DocumentTextIcon,
    'Number': DocumentTextIcon,
    'Date': CalendarIcon,
    'DateTime': CalendarIcon,
    'Picklist': TagIcon,
    'Multi-Picklist': TagIcon,
    'User': UserIcon,
    'Lookup': LinkIcon,
    'Checkbox': CheckCircleIcon,
    'URL': GlobeAltIcon,
    'Email': DocumentTextIcon,
    'Phone': DocumentTextIcon,
    'Currency': DocumentTextIcon,
    'Percent': DocumentTextIcon,
    'Status': FlagIcon,
    'Priority': FlagIcon,
    'Related': LinkIcon,
    'Parent': ArrowPathIcon
  };
  return iconMap[dataType] || DocumentTextIcon;
};

// Column settings
const resetColumnSettings = () => {
  // Reset to default visibility (all visible)
  visibleColumns.value = visibleColumns.value.map(col => ({ ...col, visible: true }));
  rowHeight.value = 'medium';
  
  // Clear saved settings
  if (typeof window !== 'undefined') {
    localStorage.removeItem(columnsStorageKey.value);
    localStorage.removeItem(rowHeightStorageKey.value);
  }
  
  // Reset column widths if needed
  if (props.tableId) {
    localStorage.removeItem(`table-column-widths-${props.tableId}`);
  }
  
  // Save the reset state
  saveColumnSettings();
};

const toggleFieldVisibility = async (fieldKey) => {
  let column = visibleColumns.value.find(col => col.key === fieldKey);
  
  // If field doesn't exist in visibleColumns, add it
  if (!column) {
    // Find field from backend config or props.columns
    const backendField = backendModuleConfig.value?.fields?.find(f => f.key === fieldKey);
    const propsCol = props.columns.find(c => c.key === fieldKey);
    
    if (backendField || propsCol) {
      const newColumn = {
        key: fieldKey,
        label: backendField?.label || propsCol?.label || fieldKey,
        visible: true, // Toggling on, so make it visible
        sortable: propsCol?.sortable !== false,
        dataType: backendField?.dataType || propsCol?.dataType || 'Text',
        showInTable: true
      };
      
      // Add to visibleColumns
      visibleColumns.value.push(newColumn);
      column = newColumn;
    } else {
      console.warn(`Field ${fieldKey} not found in backend or props`);
      return;
    }
  } else {
    // Toggle visibility
    column.visible = !column.visible;
    column.showInTable = column.visible;
  }
  
  // Explicitly save the change
  saveColumnSettings();
  
  // Sync with backend field configuration
  await syncFieldVisibilityToBackend(fieldKey, column.visible);
};

// Sync field visibility with backend field configuration
const syncFieldVisibilityToBackend = async (fieldKey, visible) => {
  try {
    // Get the module key from props
    const moduleKey = props.moduleKey;
    if (!moduleKey) return;
    
    // Fetch current module configuration from listModules endpoint
    const authStore = useAuthStore();
    const token = authStore.user?.token;
    if (!token) return;
    
    const modulesResponse = await fetch('/api/modules', {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!modulesResponse.ok) {
      console.warn('Failed to fetch modules for field sync');
      return;
    }
    
    const modulesData = await modulesResponse.json();
    if (!modulesData.success || !Array.isArray(modulesData.data)) {
      console.warn('Modules data not found for field sync');
      return;
    }
    
    // Find the module by key
    const module = modulesData.data.find(m => m.key === moduleKey);
    if (!module) {
      console.warn(`Module ${moduleKey} not found for field sync`);
      return;
    }
    
    const fields = module.fields || [];
    
    // Find and update the field
    const fieldIndex = fields.findIndex(f => f.key === fieldKey);
    if (fieldIndex === -1) {
      console.warn(`Field ${fieldKey} not found in module configuration`);
      return;
    }
    
    // Update field visibility
    if (!fields[fieldIndex].visibility) {
      fields[fieldIndex].visibility = {};
    }
    fields[fieldIndex].visibility.list = visible;
    
    // Save updated module configuration
    const updateResponse = await fetch(`/api/modules/system/${moduleKey}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        fields: fields,
        relationships: module.relationships || [],
        quickCreate: module.quickCreate || [],
        quickCreateLayout: module.quickCreateLayout || { version: 1, rows: [] },
        name: module.name,
        enabled: module.enabled !== false,
        pipelineSettings: module.pipelineSettings || []
      })
    });
    
    if (!updateResponse.ok) {
      const errorData = await updateResponse.json();
      console.warn('Failed to sync field visibility to backend:', errorData.message || 'Unknown error');
    }
  } catch (error) {
    console.warn('Error syncing field visibility to backend:', error);
    // Don't throw - this is a background sync, shouldn't break the UI
  }
};

const autosizeAllColumns = () => {
  // Clear stored widths to let columns auto-size
  if (props.tableId) {
    localStorage.removeItem(`table-column-widths-${props.tableId}`);
  }
  // Trigger TableView to reset column widths by incrementing the trigger
  resetWidthsTrigger.value++;
};

const router = useRouter();

const openNewCustomField = () => {
  // Close the drawer
  showColumnSettings.value = false;
  // Open Settings > Modules & Fields tab with the current module selected in a new tab
  // Add action=add to trigger the add custom field dialog
  const url = router.resolve({
    path: '/settings',
    query: {
      tab: 'modules',
      module: props.moduleKey,
      mode: 'fields',
      action: 'add'
    }
  }).href;
  window.open(url, '_blank');
};

// Drag and drop for columns
const dragStartIndex = ref(null);

const handleDragStart = (event, index) => {
  // Store the index in shownFields array
  dragStartIndex.value = index;
  event.dataTransfer.effectAllowed = 'move';
  // Set opacity on the dragged element
  if (event.target) {
    event.target.style.opacity = '0.5';
  }
};

const handleDragOver = (event) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
};

const handleDragEnter = (event, index) => {
  event.preventDefault();
  dragOverIndex.value = index;
};

const handleDragLeave = (event) => {
  dragOverIndex.value = null;
};

const handleDrop = (event, dropIndex) => {
  event.preventDefault();
  dragOverIndex.value = null;
  
  if (dragStartIndex.value === null || dragStartIndex.value === dropIndex) {
    dragStartIndex.value = null;
    return;
  }
  
  // Get the current visible columns in their current order
  const visibleCols = visibleColumns.value.filter(col => col.visible);
  const hiddenCols = visibleColumns.value.filter(col => !col.visible);
  
  // Validate indices against visible columns (not shownFields, which might have different order)
  if (dragStartIndex.value >= 0 && dragStartIndex.value < visibleCols.length &&
      dropIndex >= 0 && dropIndex < visibleCols.length) {
    
    // Get the dragged column directly from visibleCols using the index
    const draggedColumn = visibleCols[dragStartIndex.value];
    
    // Remove from old position
    visibleCols.splice(dragStartIndex.value, 1);
    
    // Calculate the new insertion index
    // If dragging down (startIndex < dropIndex), dropIndex decreases by 1 after removal
    // If dragging up (startIndex > dropIndex), dropIndex stays the same
    const newIndex = dragStartIndex.value < dropIndex ? dropIndex - 1 : dropIndex;
    
    // Ensure newIndex is within bounds
    const insertIndex = Math.max(0, Math.min(newIndex, visibleCols.length));
    
    // Insert at new position
    visibleCols.splice(insertIndex, 0, draggedColumn);
    
    // Reconstruct visibleColumns with new order (visible first, then hidden)
    visibleColumns.value = [...visibleCols, ...hiddenCols];
    
    // Save the new order immediately
    saveColumnSettings();
  }
  
  dragStartIndex.value = null;
};

const handleDragEnd = (event) => {
  if (event.target) {
    event.target.style.opacity = '1';
  }
  dragStartIndex.value = null;
  dragOverIndex.value = null;
};

// Event handlers
const handleRowClick = (row, event) => {
  emit('row-click', row, event);
};

const handleEdit = (row) => {
  emit('edit', row);
};

const handleDeleteClick = (row) => {
  rowToDelete.value = row;
  isBulkDelete.value = false;
  bulkDeleteRows.value = [];
  showDeleteModal.value = true;
};

const handleDeleteModalClose = () => {
  showDeleteModal.value = false;
  rowToDelete.value = null;
  isBulkDelete.value = false;
  bulkDeleteRows.value = [];
};

const confirmDelete = async () => {
  deleting.value = true;
  try {
    if (isBulkDelete.value) {
      // Handle bulk delete - emit with 'bulk-delete' action to match what views expect
      emit('bulk-action', 'bulk-delete', bulkDeleteRows.value);
      // Clear selection after bulk delete
      clearSelection();
    } else {
      // Handle single delete
      if (!rowToDelete.value) return;
      emit('delete', rowToDelete.value);
    }
    // Wait a bit for the delete to process (parent component will handle the actual deletion)
    await new Promise(resolve => setTimeout(resolve, 300));
  } finally {
    deleting.value = false;
    showDeleteModal.value = false;
    rowToDelete.value = null;
    isBulkDelete.value = false;
    bulkDeleteRows.value = [];
  }
};

const handleDelete = (row) => {
  emit('delete', row);
};

const handleView = (row) => {
  previewRow.value = row;
  showPreviewDrawer.value = true;
  // Save state to current tab
  saveDrawerState();
};

// Handle field updates from QuickPreviewDrawer
const handlePreviewUpdate = async (updateData) => {
  if (!previewRow.value?._id || !updateData.field) return;
  
  const { field, value, onSuccess } = updateData;
  const recordId = previewRow.value._id;
  
  try {
    // Determine API endpoint based on moduleKey
    let endpoint = '';
    if (props.moduleKey === 'people') {
      endpoint = `/people/${recordId}`;
    } else if (props.moduleKey === 'organizations') {
      endpoint = `/organizations/${recordId}`;
    } else if (props.moduleKey === 'deals') {
      endpoint = `/deals/${recordId}`;
    } else if (props.moduleKey === 'tasks') {
      endpoint = `/tasks/${recordId}`;
    } else if (props.moduleKey === 'events') {
      endpoint = `/events/${recordId}`;
    } else {
      console.error('Unknown module key:', props.moduleKey);
      return;
    }
    
    // Save to backend
    const response = await apiClient.put(endpoint, {
      [field]: value
    });
    
    if (response.success && response.data) {
      // Update local preview row
      previewRow.value = { ...previewRow.value, ...response.data };
      
      // Note: We can't directly mutate props.data, so we emit the update event
      // The parent component should handle updating its data array
      
      // Emit update event to parent component
      emit('row-updated', { row: response.data, field, value });
      
      // Call onSuccess callback if provided
      if (onSuccess) {
        await onSuccess(response.data);
      }
    }
  } catch (error) {
    console.error('Error updating field:', error);
    // Revert the change in previewRow
    if (previewRow.value) {
      // Could restore from original value if we track it
    }
  }
};

const handleViewFull = (row) => {
  emit('view', row);
};

const handlePageChange = (page) => {
  emit('update:pagination', { ...props.pagination, currentPage: page });
  emit('fetch');
};

const handleSort = ({ key, order }) => {
  const sortField = order ? key : '';
  const sortOrder = order || 'asc';

  emit('update:sort', { sortField, sortOrder });
  emit('fetch');

  if (order) {
    localStorage.setItem(
      sortStorageKey.value,
      JSON.stringify({ field: sortField, order })
    );
  } else {
    localStorage.removeItem(sortStorageKey.value);
  }
};

// Selection state
const selectedRows = ref([]);

const handleSelect = (selected) => {
  selectedRows.value = selected;
};

const clearSelectionTrigger = ref(0);

const clearSelection = () => {
  selectedRows.value = [];
  // Trigger TableView to clear its selection
  clearSelectionTrigger.value++;
};

// Clear selection when route changes (switching modules/tabs)
watch(() => router.currentRoute.value.path, () => {
  clearSelection();
}, { immediate: false });

// Clear selection when moduleKey changes (switching modules)
watch(() => props.moduleKey, () => {
  clearSelection();
}, { immediate: false });

// Clear selection when component unmounts
onUnmounted(() => {
  clearSelection();
});

const handleBulkAction = (actionId, selectedRows) => {
  emit('bulk-action', actionId, selectedRows);
};

const handleBulkActionClick = (actionId) => {
  // Check if it's a delete action
  if (actionId === 'delete' || actionId === 'bulk-delete') {
    // Show delete confirmation modal for bulk delete
    isBulkDelete.value = true;
    bulkDeleteRows.value = [...selectedRows.value];
    rowToDelete.value = null;
    showDeleteModal.value = true;
  } else {
    // Handle other bulk actions directly
    handleBulkAction(actionId, selectedRows.value);
  }
};

// Get icon component for action
const getActionIcon = (iconName) => {
  const iconMap = {
    'trash': TrashIcon,
    'delete': TrashIcon,
    'export': ArrowUpTrayIcon,
    'download': ArrowUpTrayIcon,
    'duplicate': DocumentDuplicateIcon,
    'archive': ArchiveBoxIcon,
    'convert': ArrowPathIcon,
    'move': ArrowRightIcon,
    'sequence': RectangleStackIcon,
    'sidekick': StarIcon,
    'apps': PuzzlePieceIcon
  };
  return iconMap[iconName] || TrashIcon;
};
</script>


