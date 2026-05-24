<template>
  <div class="mx-auto w-full">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4 sm:mb-4">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-3">
          <!-- View Selector Dropdown (People module only) -->
          <Menu v-if="savedViews && savedViews.length > 0" as="div" class="relative inline-block text-left">
            <div>
              <MenuButton class="inline-flex items-center gap-2 text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white hover:text-gray-700 dark:hover:text-gray-200 transition-colors focus:outline-none">
                <span>{{ activePeopleViewTitle }}</span>
                <ChevronDownIcon class="h-5 w-5 text-gray-500 dark:text-gray-400" aria-hidden="true" />
              </MenuButton>
            </div>
            <Transition
              enter-active-class="transition ease-out duration-100"
              enter-from-class="transform opacity-0 scale-95"
              enter-to-class="transform opacity-100 scale-100"
              leave-active-class="transition ease-in duration-75"
              leave-from-class="transform opacity-100 scale-100"
              leave-to-class="transform opacity-0 scale-95"
            >
              <MenuItems class="absolute left-0 z-50 mt-2 w-56 origin-top-left rounded-lg bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none">
                <div class="py-1">
                  <!-- System and Custom Views -->
                  <MenuItem
                    v-for="view in savedViews"
                    :key="view.id"
                    v-slot="{ active, close }"
                  >
                    <div
                      class="group flex items-center justify-between pr-2"
                      :class="[
                        active ? 'bg-gray-100 dark:bg-gray-700' : '',
                        activeSavedViewId === view.id ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''
                      ]"
                    >
                      <button
                        @click="() => { handleSavedViewClick(view); close(); }"
                        :class="[
                          activeSavedViewId === view.id ? 'text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100',
                          'flex-1 block w-full text-left px-4 py-2 text-sm'
                        ]"
                      >
                        {{ view.label }}
                      </button>
                      <!-- Set as default (all views) -->
                      <HoverTooltip
                        :content="defaultViewId === view.id ? t('common.listDefaultViewTooltip') : t('common.listSetDefaultViewTooltip')"
                        anchor-selector="button"
                        :show-delay="50"
                        :hide-delay="80"
                        :gap="4"
                        class="flex items-center p-1 -m-1 rounded"
                      >
                        <button
                          @click.stop="() => { handleSetDefaultView(view); close(); }"
                          :class="[
                            defaultViewId === view.id ? 'text-amber-500 dark:text-amber-400' : 'text-gray-400 hover:text-amber-500 dark:hover:text-amber-400',
                            'p-0.5 transition-colors'
                          ]"
                        >
                          <StarIcon v-if="defaultViewId !== view.id" class="w-4 h-4" />
                          <StarIconSolid v-else class="w-4 h-4" />
                        </button>
                      </HoverTooltip>
                      <!-- Edit/Delete actions for custom views only -->
                      <div v-if="!isSystemView(view.id)" class="flex items-center gap-1 pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          @click.stop="handleEditView(view)"
                          class="p-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                          :title="t('common.listEditView')"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                          </svg>
                        </button>
                        <button
                          @click.stop="handleDeleteView(view)"
                          class="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                          :title="t('common.listDeleteViewAction')"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </MenuItem>
                </div>
              </MenuItems>
            </Transition>
          </Menu>
          <!-- Regular title (other modules) -->
          <h1 v-else class="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white truncate">{{ title }}</h1>
          
          <!-- Save View CTA (People and Organizations modules only, when state doesn't match any saved view) -->
          <button
            v-if="savedViews && savedViews.length > 0 && shouldShowSaveCTA"
            @click="handleSaveCurrentView"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            :title="t('common.listSaveViewHint')"
          >
            <StarIcon class="w-4 h-4" />
            <span>{{ t('common.listSaveView') }}</span>
          </button>
          
          <!-- Mobile Action Buttons with Stats Icon -->
          <div class="sm:hidden flex items-center gap-2 ml-auto">
            <!-- Stats Toggle Button (Mobile) -->
            <button
              v-if="statsConfig && statsConfig.length > 0"
              @click="showStats = !showStats"
              class="inline-flex items-center justify-center px-2.5 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
              :title="statsToggleTitle"
            >
              <ChartBarIcon v-if="!showStats" class="w-5 h-5" />
              <XMarkIcon v-else class="w-5 h-5" />
            </button>
            
            <slot name="header-actions">
              <ModuleActions 
                :module="moduleKey"
                :create-label="createLabel"
                :show-create="showCreate !== false"
                :show-import="showImport !== false"
                :show-export="showExport !== false"
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
            :title="statsToggleTitle"
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
          :title="statsToggleTitle"
        >
          <ChartBarIcon v-if="!showStats" class="w-5 h-5" />
          <XMarkIcon v-else class="w-5 h-5" />
          <span>{{ showStats ? t('common.listHideShort') : t('common.listStatsShort') }}</span>
        </button>
        
        <slot name="header-actions">
          <ModuleActions 
            :module="moduleKey"
            :create-label="createLabel"
            :show-create="showCreate !== false"
            :show-import="showImport !== false"
            :show-export="showExport !== false"
            @create="$emit('create')"
            @import="$emit('import')"
            @export="$emit('export')"
          />
        </slot>
      </div>
    </div>

    <!-- Statistics Cards -->
    <div v-if="statsConfig && statsConfig.length > 0 && showStats" class="mb-8">
      <!-- Skeleton while list rows load (avoids flashing zeros) -->
      <div
        v-if="statsBarSkeleton"
        :class="[
          'grid grid-cols-1 gap-3 divide-gray-200 overflow-hidden rounded-lg bg-white dark:bg-gray-800 shadow-sm md:divide-y-0 md:gap-0 md:divide-x dark:divide-gray-700',
          statsGridColsClass
        ]"
        aria-hidden="true"
      >
        <div
          v-for="n in statsConfig.length"
          :key="`stat-sk-${n}`"
          class="px-4 py-5 sm:p-6"
        >
          <div class="relative mb-3 h-4 w-28 overflow-hidden rounded bg-gray-200 animate-pulse dark:bg-gray-600" />
          <div class="relative h-8 w-20 overflow-hidden rounded-md bg-gray-200 animate-pulse dark:bg-gray-600" />
        </div>
      </div>
      <dl
        v-else
        :class="[
          'grid grid-cols-1 divide-gray-200 dark:divide-gray-700 overflow-hidden rounded-lg bg-white dark:bg-gray-800 shadow-sm md:divide-x md:divide-y-0',
          statsGridColsClass
        ]"
      >
        <div 
          v-for="item in computedStats" 
          :key="item.name" 
          class="px-4 py-5 sm:p-6"
          :class="statsConfig && statsConfig.length > 0 ? 'cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-700' : ''"
          @click="handleStatClick(item)"
        >
          <dt class="text-base font-normal text-gray-900 dark:text-gray-100">{{ item.name }}</dt>
          <dd class="mt-1">
            <div class="text-2xl font-semibold text-indigo-600 dark:text-indigo-400">
              {{ item.stat }}
            </div>
          </dd>
        </div>
      </dl>
    </div>

    <!-- Search and Filters -->
    <div class="flex flex-col gap-4 mb-4 relative">
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
              :aria-label="t('common.listClearSearch', { title })"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 0 1 1.414 0L10 8.586l4.293-4.293a1 1 0 1 1 1.414 1.414L11.414 10l4.293 4.293a1 1 0 0 1-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 0 1-1.414-1.414L8.586 10 4.293 5.707a1 1 0 0 1 0-1.414Z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        <slot name="search-actions" />

        <!-- Mobile & Tablet Filters Button -->
        <Popover v-if="filterConfig && filterConfig.length > 0" class="relative">
          <PopoverButton
            class="inline-flex h-10 items-center gap-2 px-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors text-sm cursor-pointer"
          >
            <FunnelIcon class="w-4 h-4" />
            <span class="hidden sm:inline">{{ t('common.listFilters') }}</span>
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
                  
                  <!-- Date filter: grouped Quick / Relative / Specific / Data Status -->
                  <DateFilterDropdown
                    v-if="filter.filterType === 'date'"
                    :model-value="filters[filter.key]"
                    :filter-label="filter.label || filter.key"
                    button-class="relative z-[26] inline-flex h-10 w-full items-center rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-3 text-gray-900 dark:text-white text-sm outline-1 -outline-offset-1 outline-gray-300/20 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 cursor-pointer text-left"
                    options-class="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white dark:bg-gray-700 py-1 text-sm shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none min-w-[200px]"
                    @update:model-value="(value) => { filters[filter.key] = value; handleFilterChange(filter.key); }"
                  />
                  <!-- All other filters: Dropdown -->
                  <Listbox
                    v-else
                    :model-value="filter.filterType === 'multi-select' ? (Array.isArray(filters[filter.key]) ? filters[filter.key] : []) : (filters[filter.key] || '')" 
                    @update:model-value="(value) => { filters[filter.key] = value; handleFilterChange(filter.key); }"
                    :multiple="filter.filterType === 'multi-select'"
                  >
                    <div class="relative">
                      <ListboxButton
                        @click="emit('filter-opened', filter.key)"
                        class="relative z-[26] inline-flex h-10 w-full items-center rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-3 text-gray-900 dark:text-white text-sm outline-1 -outline-offset-1 outline-gray-300/20 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 cursor-pointer text-left"
                      >
                        <span class="block truncate pr-6">
                          {{ getFilterLabel(filter, filters[filter.key]) || getFilterAllLabel(filter) }}
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
                            :value="filter.filterType === 'multi-select' ? [] : ''"
                            v-slot="{ active, selected }"
                          >
                            <li
                              :class="[
                                'relative cursor-pointer select-none py-2 pl-4 pr-10',
                                active ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100'
                              ]"
                            >
                              <span :class="[selected ? 'font-medium' : 'font-normal', 'block truncate']">
                                {{ t('common.listAllRecords') }}
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
                            v-for="option in (filter.options || [])"
                            :key="option?.value || option"
                            :value="option?.value || option"
                            v-slot="{ active, selected }"
                          >
                            <li
                              :class="[
                                'relative cursor-pointer select-none py-2 pl-4 pr-10',
                                active ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100'
                              ]"
                            >
                        <span :class="[selected ? 'font-medium' : 'font-normal', 'block truncate']">
                          {{ option?.label || option?.value || option || t('common.listUnknown') }}
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
                  {{ t('common.listClearFilters') }}
                </button>
              </div>
            </PopoverPanel>
          </Transition>
        </Popover>

        <!-- Customize Button (Mobile & Tablet) -->
        <button
          @click="handleCustomizeClick"
          class="inline-flex h-10 items-center gap-2 px-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors text-sm cursor-pointer"
          :title="customizeButtonLabel"
        >
          <Cog6ToothIcon class="w-4 h-4" />
          <span class="hidden sm:inline">{{ customizeButtonLabel }}</span>
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
              :aria-label="t('common.listClearSearch', { title })"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4">
                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 0 1 1.414 0L10 8.586l4.293-4.293a1 1 0 1 1 1.414 1.414L11.414 10l4.293 4.293a1 1 0 0 1-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 0 1-1.414-1.414L8.586 10 4.293 5.707a1 1 0 0 1 0-1.414Z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        <slot name="search-actions" />

        <!-- Filters (Desktop/Tablet) - Type-based rendering -->
        <div class="flex flex-wrap items-center gap-3 flex-1">
          <div
            v-for="filter in filterConfig"
            :key="filter.key"
            :data-filter-key="filter.key"
            class="relative"
          >
            <!-- Date filter: grouped Quick / Relative / Specific / Data Status -->
            <DateFilterDropdown
              v-if="filter.filterType === 'date'"
              :model-value="filters[filter.key]"
              :filter-label="filter.label || filter.key"
              button-class="inline-flex h-10 items-center rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 text-gray-900 dark:text-white text-sm outline-1 -outline-offset-1 outline-gray-300/20 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 dark:focus:bg-gray-800 dark:outline-white/10 dark:focus:outline-indigo-500 cursor-pointer relative w-auto min-w-[140px] text-left leading-none"
              options-class="absolute mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white dark:bg-gray-700 py-1 text-base shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none sm:text-sm min-w-[200px]"
              @update:model-value="(value) => { filters[filter.key] = value; handleFilterChange(filter.key); }"
            />
            <!-- All other filters: Dropdown (select, multi-select, boolean, user, etc.) -->
            <Listbox
              v-else
              :model-value="filter.filterType === 'multi-select' ? (Array.isArray(filters[filter.key]) ? filters[filter.key] : []) : (filters[filter.key] || '')" 
              @update:model-value="(value) => { filters[filter.key] = value; handleFilterChange(filter.key); }"
              :multiple="filter.filterType === 'multi-select'"
            >
              <div class="relative">
                <ListboxButton
                  @click="emit('filter-opened', filter.key)"
                  class="inline-flex h-10 items-center rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 text-gray-900 dark:text-white text-sm outline-1 -outline-offset-1 outline-gray-300/20 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 dark:focus:bg-gray-800 dark:outline-white/10 dark:focus:outline-indigo-500 cursor-pointer relative w-auto min-w-[140px] text-left leading-none"
                >
                  <span class="block truncate pr-6">
                    {{ getFilterLabel(filter, filters[filter.key]) || filter.label || getFilterAllLabel(filter) }}
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
                    class="absolute mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white dark:bg-gray-700 py-1 text-base shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none sm:text-sm min-w-[140px]"
                    style="z-index: 9999; position: absolute;"
                  >
                    <ListboxOption
                      :value="filter.filterType === 'multi-select' ? [] : ''"
                      v-slot="{ active, selected }"
                    >
                      <li
                        :class="[
                          'relative cursor-default select-none py-2 pl-4 pr-10',
                          active ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100'
                        ]"
                      >
                        <span :class="[selected ? 'font-medium' : 'font-normal', 'block truncate']">
                          {{ filter.label || getFilterAllLabel(filter) }}
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
                      v-for="option in (filter.options || [])"
                      :key="option?.value || option"
                      :value="option?.value || option"
                      v-slot="{ active, selected }"
                    >
                      <li
                        :class="[
                          'relative cursor-default select-none py-2 pl-4 pr-10',
                          active ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-900 dark:text-indigo-100' : 'text-gray-900 dark:text-gray-100'
                        ]"
                      >
                        <span :class="[selected ? 'font-medium' : 'font-normal', 'block truncate']">
                          {{ option?.label || option?.value || option }}
                        </span>
                        <span
                          v-if="selected"
                          class="absolute inset-y-0 right-0 flex items-center pr-3 text-indigo-600 dark:text-indigo-400"
                        >
                          <CheckIcon class="h-5 w-5" aria-hidden="true" />
                        </span>
                      </li>
                    </ListboxOption>
                    <div v-if="!filter.options || filter.options.length === 0" class="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                      {{ t('common.listLoadingOptions') }}
                    </div>
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
            {{ t('common.listClear') }}
          </button>
          
          <!-- Suggested Filters Section (Feature-flagged, opt-in only) -->
          <!-- 
            ARCHITECTURE NOTE: This section is informational only.
            - Does NOT auto-apply filters
            - Does NOT modify filter state
            - User must explicitly click to open filter configuration
            - Controlled by ENABLE_DEFAULT_FILTERS flag in useDefaultListFilters
            See: /composables/useDefaultListFilters.ts
          -->
          <div 
            v-if="suggestedFiltersEnabled && hasSuggestedFilters && !hasActiveFilters"
            class="flex items-center gap-2 ml-2 pl-2 border-l border-gray-200 dark:border-gray-700"
          >
            <span class="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap" :title="t('common.listSuggestedHint')">
              {{ t('common.listSuggestedLabel') }}
            </span>
            <div class="flex flex-wrap items-center gap-1.5">
              <button
                v-for="filterKey in suggestedFilters"
                :key="filterKey"
                @click="handleSuggestedFilterClick(filterKey)"
                class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 border border-dashed border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500 transition-colors cursor-pointer"
                :title="t('common.listSuggestedConfigure', { filter: getSuggestedFilterLabel(filterKey) })"
              >
                <span>{{ getSuggestedFilterLabel(filterKey) }}</span>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-3 h-3 opacity-50">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Customize Button (Desktop/Tablet) -->
        <div class="flex items-center">
          <button
            @click="handleCustomizeClick"
            class="inline-flex items-center h-10 gap-2 px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors text-sm cursor-pointer"
            :title="customizeButtonLabel"
          >
            <Cog6ToothIcon class="w-4 h-4" />
            <span>{{ customizeButtonLabel }}</span>
          </button>
        </div>
      </div>
    </div>

    <div class="mt-4 px-4 sm:px-6 lg:px-8" style="isolation: auto;">
      <!-- Key must not include row count: infinite append changes length and would remount TableView and reset scroll. -->
      <TableView
          :key="`table-${tableId}-${dataHash}`"
          internal-scroll
          :data="data"
          :columns="computedColumns"
          :loading="tableLoading"
          :selectable="true"
          :has-actions="true"
          :sort-field="sortField"
          :sort-order="sortOrder"
          :mass-actions="massActions"
          :row-key="rowKey"
          :empty-title="emptyStateTitle"
          :empty-message="emptyStateMessage"
          :table-id="tableId"
          :resizable-columns="resizableColumns"
          :row-height="rowHeight"
          :reset-widths="resetWidthsTrigger"
          :clear-selection-trigger="clearSelectionTrigger"
          :load-more-enabled="infiniteScroll"
          :has-more="hasMorePages"
          :loading-more="loadingMore"
          :selection-column-variant="selectionColumnVariant"
          :row-number-offset="effectiveRowNumberOffset"
          @row-click="handleRowClick"
          @edit="handleEdit"
          @delete="handleDelete"
          @sort="handleSort"
          @select="handleSelect"
          @bulk-action="handleBulkAction"
          @load-more="emit('load-more')"
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
          
          <!-- Empty State Slot -->
          <template #empty>
            <div class="flex flex-col items-center justify-center py-12">
              <img
                src="/assets/illustrations/empty_state.svg"
                :alt="t('common.listEmptyIllustrationAlt')"
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
                  <span>{{ t('common.listClearSearchAndFilters') }}</span>
                </button>
              </div>
            </div>
          </template>
        </TableView>
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

    <!-- Save/Edit View Modal (People module only) -->
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
          v-if="savedViews && savedViews.length > 0 && showSaveViewModal"
          class="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          @click.self="handleCloseSaveViewModal"
        >
          <div class="bg-white dark:bg-gray-900 rounded-xl w-full max-w-md shadow-2xl" @click.stop>
            <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
                {{ editingView ? t('common.listEditViewTitle') : t('common.listSaveCurrentView') }}
              </h2>
            </div>
            <form @submit.prevent="handleSaveView" class="p-6 space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {{ t('common.listViewName') }} <span class="text-red-500">*</span>
                </label>
                <input
                  v-model="viewFormData.name"
                  type="text"
                  required
                  :placeholder="t('common.listViewNameExample')"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {{ t('common.listViewDescOptional') }}
                </label>
                <textarea
                  v-model="viewFormData.description"
                  rows="3"
                  :placeholder="t('common.listViewDescPlaceholder')"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div class="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  @click="handleCloseSaveViewModal"
                  class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors cursor-pointer"
                >
                  {{ t('actions.cancel') }}
                </button>
                <button
                  type="submit"
                  :disabled="!viewFormData.name.trim()"
                  class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer"
                >
                  {{ editingView ? t('actions.update') : t('actions.save') }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Delete View Confirmation Modal -->
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
          v-if="savedViews && savedViews.length > 0 && showDeleteViewModal && viewToDelete"
          class="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          @click.self="handleCloseDeleteViewModal"
        >
          <div class="bg-white dark:bg-gray-900 rounded-xl w-full max-w-md shadow-2xl" @click.stop>
            <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 class="text-xl font-semibold text-gray-900 dark:text-white">{{ t('common.listDeleteView') }}</h2>
            </div>
            <div class="p-6">
              <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {{ t('common.listDeleteViewConfirm', { viewName: viewToDelete?.label }) }}
              </p>
              <div class="flex items-center justify-end gap-3">
                <button
                  type="button"
                  @click="handleCloseDeleteViewModal"
                  class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors cursor-pointer"
                >
                  {{ t('actions.cancel') }}
                </button>
                <button
                  type="button"
                  @click="confirmDeleteView"
                  class="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors cursor-pointer"
                >
                  {{ t('actions.delete') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

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
              :title="t('common.listClearSelection')"
            >
              <span class="font-semibold">{{ selectedRows.length }}</span>
              <span class="font-medium">
                {{ t('common.listRowsSelected', {
                  count: selectedRows.length,
                  singular: title.endsWith('s') ? title.slice(0, -1) : title,
                  plural: title,
                }) }}
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
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('common.listCustomizeView') }}</h3>
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
                      <span class="text-sm font-medium text-gray-900 dark:text-white">{{ t('common.listLayoutOptions') }}</span>
                    </div>
                    <ChevronDownIcon 
                      :class="['w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform', layoutOptionsExpanded ? 'rotate-180' : '']" 
                    />
                  </button>
                  
                  <div v-if="layoutOptionsExpanded" class="pb-4 space-y-0">
                    <!-- Row Height -->
                    <Menu as="div" class="relative px-3">
                      <MenuButton class="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors cursor-pointer">
                        <span>{{ t('common.listRowHeight') }}</span>
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
                        <span>{{ t('common.listReset') }}</span>
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
                                {{ t('common.listColumnWidths') }}
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
                                {{ t('common.listDefaultView') }}
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
                      <span class="text-sm font-medium text-gray-900 dark:text-white">{{ t('common.listManageFields') }}</span>
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
                        :placeholder="t('common.listSearchFields')"
                        class="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                      />
                    </div>

                    <!-- Shown Fields -->
                    <div>
                      <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3 px-6">
                        {{ t('common.listShownCount', { count: shownFields.length }) }}
                      </h4>
                      <div class="space-y-1 px-3">
                        <template v-for="(field, index) in shownFields" :key="field.key">
                          <div
                            :draggable="!(props.moduleKey === 'forms' && field.key?.toLowerCase() === 'name') || field.locked === true"
                            @dragstart="handleDragStart($event, index)"
                            @dragover.prevent="handleDragOver"
                            @dragenter.prevent="handleDragEnter($event, index)"
                            @dragleave.prevent="handleDragLeave"
                            @drop.prevent="handleDrop($event, index)"
                            @dragend="handleDragEnd"
                            :class="[
                              'flex items-center gap-3 px-2 py-2 rounded-lg transition-colors cursor-move',
                              dragOverIndex === index ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-gray-100 dark:hover:bg-gray-800',
                              field.locked ? 'cursor-not-allowed opacity-70' : '' // Add class for locked fields
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
                          <span v-if="props.moduleKey === 'forms' && field.key?.toLowerCase() === 'name'" class="text-xs text-gray-500 dark:text-gray-400 mr-2">{{ t('common.listFieldRequired') }}</span>
                          <span v-if="field.locked" class="text-xs text-gray-500 dark:text-gray-400 mr-2">{{ t('common.listFieldLocked') }}</span>
                          <HeadlessSwitch
                            :checked="field.visible"
                            @change="toggleFieldVisibility(field.key)"
                            :disabled="(props.moduleKey === 'forms' && field.key?.toLowerCase() === 'name') || field.locked"
                            switch-class="w-9 h-5"
                          />
                          </div>
                        </template>
                      </div>
                    </div>

                    <!-- Hidden Fields -->
                    <div>
                      <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3 px-6">
                        {{ t('common.listFieldHidden') }}
                      </h4>
                      <div class="space-y-1 px-3">
                        <template v-for="field in hiddenFields" :key="field.key">
                          <div
                            class="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          >
                          <component
                            :is="getFieldIcon(field.dataType)"
                            class="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0"
                          />
                          <span class="flex-1 text-sm text-gray-900 dark:text-white">{{ field.label }}</span>
                          <span v-if="field.locked" class="text-xs text-gray-500 dark:text-gray-400 mr-2">{{ t('common.listFieldLocked') }}</span>
                          <HeadlessSwitch
                            :checked="field.visible"
                            @change="toggleFieldVisibility(field.key)"
                            :disabled="(props.moduleKey === 'forms' && field.key?.toLowerCase() === 'name') || field.locked"
                            switch-class="w-9 h-5"
                          />
                            </div>
                        </template>
                        <div v-if="hiddenFields.length === 0" class="text-sm text-gray-500 dark:text-gray-400 py-2 text-center">
                          {{ t('common.listNoHiddenFields') }}
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
                  <span>{{ t('common.listNewCustomField') }}</span>
                </button>
              </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Customize Kanban Drawer -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-300 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-300 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="showKanbanSettings"
          @click="showKanbanSettings = false"
          class="fixed inset-0 bg-black/20 dark:bg-black/40 z-[9998]"
        ></div>
      </Transition>
      <Transition
        enter-active-class="transition-transform ease-out duration-300"
        enter-from-class="translate-x-full"
        enter-to-class="translate-x-0"
        leave-active-class="transition-transform ease-in duration-300"
        leave-from-class="translate-x-0"
        leave-to-class="translate-x-full"
      >
        <div
          v-if="showKanbanSettings"
          @click.stop
          class="fixed right-0 top-0 h-full w-full max-w-xs bg-white dark:bg-gray-900 shadow-2xl flex flex-col z-[9999]"
        >
          <div class="flex items-center justify-between px-6 pr-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('common.listCustomizeKanban') }}</h3>
            <button
              @click="showKanbanSettings = false"
              class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer"
            >
              <XMarkIcon class="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
          <div class="flex-1 overflow-y-auto">
            <!-- Kanban options -->
            <div class="border-b border-gray-200 dark:border-gray-700">
              <button
                @click="kanbanOptionsExpanded = !kanbanOptionsExpanded"
                class="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              >
                <div class="flex items-center gap-3">
                  <ViewColumnsIcon class="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  <span class="text-sm font-medium text-gray-900 dark:text-white">{{ t('common.listKanbanOptions') }}</span>
                </div>
                <ChevronDownIcon
                  :class="['w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform', kanbanOptionsExpanded ? 'rotate-180' : '']"
                />
              </button>
              <div v-if="kanbanOptionsExpanded" class="pb-4 space-y-0 px-3">
                <Menu as="div" class="relative">
                  <MenuButton class="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors cursor-pointer">
                    <span>{{ t('common.listCardSize') }}</span>
                    <div class="flex items-center gap-2">
                      <span class="text-gray-500 dark:text-gray-400">{{ kanbanCardSizeLabels[kanbanCardSize] || kanbanCardSize }}</span>
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
                    <MenuItems class="absolute right-0 z-10 mt-2 w-40 origin-top-right rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg focus:outline-none">
                      <div class="py-1">
                        <MenuItem
                          v-for="(label, value) in kanbanCardSizeLabels"
                          :key="value"
                          v-slot="{ active }"
                        >
                          <button
                            @click="setKanbanCardSize(value)"
                            :class="[
                              active ? 'bg-gray-100 dark:bg-gray-700' : '',
                              kanbanCardSize === value ? 'text-indigo-600 dark:text-indigo-400 font-medium' : 'text-gray-700 dark:text-gray-300',
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
                <div class="flex items-center justify-between px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                  <span>{{ t('common.listStackFields') }}</span>
                  <HeadlessSwitch
                    v-model="kanbanStackFields"
                    @change="saveKanbanOptions()"
                    switch-class="w-9 h-5"
                  />
                </div>
                <div class="flex items-center justify-between px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                  <span>{{ t('common.listCollapseEmpty') }}</span>
                  <HeadlessSwitch
                    v-model="kanbanCollapseEmptyColumns"
                    @change="saveKanbanOptions()"
                    switch-class="w-9 h-5"
                  />
                </div>
                <div class="flex items-center justify-between px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                  <span>{{ t('common.listShowEmptyFields') }}</span>
                  <HeadlessSwitch
                    v-model="kanbanShowEmptyFields"
                    @change="saveKanbanOptions()"
                    switch-class="w-9 h-5"
                  />
                </div>
                <div class="flex items-center justify-between px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                  <span>{{ t('common.listShowClosedRecords') }}</span>
                  <HeadlessSwitch
                    v-model="kanbanClosedTasks"
                    @change="saveKanbanOptions()"
                    switch-class="w-9 h-5"
                  />
                </div>
                <!-- Reset -->
                <Menu as="div" class="relative">
                  <MenuButton class="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors cursor-pointer">
                    <span>{{ t('common.listReset') }}</span>
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
                    <MenuItems class="absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg focus:outline-none">
                      <div class="py-1">
                        <MenuItem v-slot="{ active }">
                          <button
                            @click="resetKanbanToDefault"
                            :class="[
                              active ? 'bg-gray-100 dark:bg-gray-700' : '',
                              'block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer'
                            ]"
                          >
                            {{ t('common.listDefaultView') }}
                          </button>
                        </MenuItem>
                      </div>
                    </MenuItems>
                  </Transition>
                </Menu>
              </div>
            </div>
            <!-- Manage fields -->
            <div>
              <button
                @click="kanbanManageFieldsExpanded = !kanbanManageFieldsExpanded"
                class="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              >
                <div class="flex items-center gap-3">
                  <PencilSquareIcon class="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  <span class="text-sm font-medium text-gray-900 dark:text-white">{{ t('common.listManageFields') }}</span>
                </div>
                <ChevronDownIcon
                  :class="['w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform', kanbanManageFieldsExpanded ? 'rotate-180' : '']"
                />
              </button>
              <div v-if="kanbanManageFieldsExpanded" class="pb-4 space-y-4">
                <div class="relative px-6">
                  <MagnifyingGlassIcon class="absolute left-9 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    v-model="kanbanFieldSearchQuery"
                    type="text"
                    :placeholder="t('common.listSearchFields')"
                    class="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3 px-6">
                    {{ t('common.listShownCount', { count: kanbanShownFields.length }) }}
                  </h4>
                  <div class="space-y-1 px-3">
                    <div
                      v-for="(field, index) in kanbanShownFields"
                      :key="field.key"
                      :draggable="!field.locked"
                      @dragstart="handleKanbanDragStart($event, index)"
                      @dragover.prevent="handleKanbanDragOver"
                      @dragenter.prevent="handleKanbanDragEnter($event, index)"
                      @dragleave.prevent="handleKanbanDragLeave"
                      @drop.prevent="handleKanbanDrop($event, index)"
                      @dragend="handleKanbanDragEnd"
                      :class="[
                        'flex items-center gap-3 px-2 py-2 rounded-lg transition-colors',
                        field.locked ? 'cursor-not-allowed opacity-70' : 'cursor-move hover:bg-gray-100 dark:hover:bg-gray-800',
                        kanbanDragOverIndex === index ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''
                      ]"
                    >
                      <!-- Grip handle icon (6 dots vertical) - same as Customize List -->
                      <svg class="w-5 h-5 text-gray-400 flex-shrink-0 cursor-move" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="9" cy="5" r="1.5" />
                        <circle cx="9" cy="12" r="1.5" />
                        <circle cx="9" cy="19" r="1.5" />
                        <circle cx="15" cy="5" r="1.5" />
                        <circle cx="15" cy="12" r="1.5" />
                        <circle cx="15" cy="19" r="1.5" />
                      </svg>
                      <component :is="getFieldIcon(field.dataType)" class="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                      <span class="flex-1 text-sm text-gray-900 dark:text-white">{{ field.label || field.key }}</span>
                      <span v-if="field.locked" class="text-xs text-gray-500 dark:text-gray-400 mr-2">{{ t('common.listFieldLocked') }}</span>
                      <HeadlessSwitch
                        :checked="field.visible"
                        @change="toggleKanbanFieldVisibility(field.key)"
                        :disabled="field.locked"
                        switch-class="w-9 h-5"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3 px-6">
                    {{ t('common.listFieldHidden') }}
                  </h4>
                  <div class="space-y-1 px-3">
                    <div
                      v-for="field in kanbanHiddenFields"
                      :key="field.key"
                      class="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <component :is="getFieldIcon(field.dataType)" class="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                      <span class="flex-1 text-sm text-gray-900 dark:text-white">{{ field.label || field.key }}</span>
                      <HeadlessSwitch
                        :checked="false"
                        @change="toggleKanbanFieldVisibility(field.key)"
                        switch-class="w-9 h-5"
                      />
                    </div>
                    <div v-if="kanbanHiddenFields.length === 0" class="text-sm text-gray-500 dark:text-gray-400 py-2 text-center">{{ t('common.listNoHiddenFields') }}</div>
                  </div>
                </div>
              </div>
            </div>
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
      :can-navigate-previous="quickPreviewCanPrevious"
      :can-navigate-next="quickPreviewCanNext"
      @close="() => { showPreviewDrawer = false; saveDrawerState(); }"
      @update="handlePreviewUpdate"
      @navigate-prev="handleQuickPreviewPrev"
      @navigate-next="handleQuickPreviewNext"
    />

  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  resolveListViewLabel,
  resolveListColumnLabel,
  resolveListFilterLabel,
} from '@/utils/moduleListLabels';
import { APP_NAME_KEYS } from '@/utils/navigationLabels';

const { t, te } = useI18n();
import { useRouter } from 'vue-router';
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/vue/20/solid';
import { StarIcon as StarIconSolid } from '@heroicons/vue/24/solid';
import { Listbox, ListboxButton, ListboxOptions, ListboxOption, Popover, PopoverButton, PopoverPanel, Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue';
import { ChevronUpDownIcon, CheckIcon, Cog6ToothIcon, FunnelIcon, ChartBarIcon, XMarkIcon, WrenchScrewdriverIcon, ChevronDownIcon, ChevronRightIcon, PencilSquareIcon, MagnifyingGlassIcon, PlusIcon, TrashIcon, ArrowDownTrayIcon, DocumentDuplicateIcon, ArrowUpTrayIcon, ArchiveBoxIcon, ArrowPathIcon, ArrowRightIcon, StarIcon, PuzzlePieceIcon, RectangleStackIcon, ViewColumnsIcon } from '@heroicons/vue/24/outline';
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
import { Transition, Teleport } from 'vue';
import TableView from '@/components/common/TableView.vue';
import ModuleActions from '@/components/common/ModuleActions.vue';
import RowActions from '@/components/common/RowActions.vue';
import DeleteConfirmationModal from '@/components/common/DeleteConfirmationModal.vue';
import HoverTooltip from '@/components/common/HoverTooltip.vue';
import QuickPreviewDrawer from '@/components/common/QuickPreviewDrawer.vue';
import { useBulkActions } from '@/composables/useBulkActions';
import { useAuthStore } from '@/stores/authRegistry';
import { useTabs } from '@/composables/useTabs';
import apiClient from '@/utils/apiClient';
import { getFieldDisplayLabel } from '@/utils/fieldDisplay';
import { DEFAULT_CURRENCY_CODE, formatCurrencyValue } from '@/utils/currencyOptions';
import { getFieldMetadata, PEOPLE_FIELD_METADATA } from '@/platform/fields/peopleFieldModel';
import { isSystemField as isSystemFieldFromEngine } from '@/platform/fields/fieldCapabilityEngine';
import { useDefaultListFilters } from '@/composables/useDefaultListFilters';
import DateFilterDropdown from '@/components/common/DateFilterDropdown.vue';
import { parseDateFilterValue, getDateFilterLabel } from '@/utils/dateFilterOptions';

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
  showCreate: {
    type: Boolean,
    default: true
  },
  showImport: {
    type: Boolean,
    default: true
  },
  showExport: {
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
  },
  
  // Saved Views (People module only)
  savedViews: {
    type: Array,
    default: () => []
  },
  activeSavedViewId: {
    type: String,
    default: null
  },
  /** View ID marked as default (loads when opening module) */
  defaultViewId: {
    type: String,
    default: null
  },
  // External filters (synced from ModuleList when stat is clicked)
  externalFilters: {
    type: Object,
    default: () => ({})
  },
  /** When 'kanban', show "Customize Kanban" and open Kanban options drawer; otherwise "Customize List" and list column drawer */
  viewMode: {
    type: String,
    default: null
  },
  /** Infinite scroll: load next server page when the table sentinel enters the scroll area */
  infiniteScroll: {
    type: Boolean,
    default: false
  },
  loadingMore: {
    type: Boolean,
    default: false
  },
  /** Table selection gutter: 'numbered-hover' shows row index until hover/focus (see TableView) */
  selectionColumnVariant: {
    type: String,
    default: 'numbered-hover',
    validator: (v) => !v || v === 'checkbox' || v === 'numbered-hover'
  },
  /** Column keys to show while active (e.g. appointment columns when filtering appointments) */
  boostVisibleColumnKeys: {
    type: Array,
    default: () => []
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
  'row-updated',
  'filter-opened',
  'saved-view-selected',
  'set-default-view',
  'stat-click',
  'saved-views-updated',
  'kanban-settings-changed',
  'stats-visibility-changed',
  'load-more'
]);

// Use bulk actions composable
const { bulkActions: massActions } = useBulkActions(props.moduleKey);

// Use default list filters composable (opt-in, feature-flagged)
// This provides suggested filters based on field metadata
// See: /platform/fields/DefaultFilterPolicy.ts
const {
  isEnabled: suggestedFiltersEnabled,
  defaultFilters: suggestedFilters,
  hasDefaultFilters: hasSuggestedFilters,
  isDefaultFilter: isSuggestedFilter,
} = useDefaultListFilters(props.moduleKey);

// State
const searchQuery = ref('');
const showColumnSettings = ref(false);
const showKanbanSettings = ref(false);
const visibleColumns = ref([]);
const layoutOptionsExpanded = ref(true);
const manageFieldsExpanded = ref(true);
const fieldSearchQuery = ref('');
const dragOverIndex = ref(null);
// Kanban customize state
const kanbanOptionsExpanded = ref(true);
const kanbanManageFieldsExpanded = ref(true);
const kanbanFieldSearchQuery = ref('');
const kanbanCardSize = ref('medium');
const kanbanStackFields = ref(true);
const kanbanCollapseEmptyColumns = ref(false);
const kanbanShowEmptyFields = ref(true);
const kanbanClosedTasks = ref(true);
const kanbanVisibleColumns = ref([]);
const kanbanDragOverIndex = ref(null);
const kanbanDragStartIndex = ref(null);
const backendModuleConfig = ref(null); // Store backend module configuration with all fields
const resetWidthsTrigger = ref(0); // Trigger to reset column widths in TableView
const showDeleteModal = ref(false);
const rowToDelete = ref(null);
const deleting = ref(false);
const isBulkDelete = ref(false);
const bulkDeleteRows = ref([]);
const showPreviewDrawer = ref(false);
const previewRow = ref(null);

// Saved View Management (People module only)
const showSaveViewModal = ref(false);
const editingView = ref(null);
const viewFormData = ref({ name: '', description: '' });
const viewToDelete = ref(null);
const showDeleteViewModal = ref(false);

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

// Customize button label and click (List vs Kanban)
const customizeButtonLabel = computed(() =>
  props.viewMode === 'kanban' ? t('common.listCustomizeKanban') : t('common.listCustomizeView')
);
const handleCustomizeClick = () => {
  if (props.viewMode === 'kanban') {
    showKanbanSettings.value = !showKanbanSettings.value;
    if (showKanbanSettings.value) {
      loadKanbanSettings();
    }
  } else {
    showColumnSettings.value = !showColumnSettings.value;
  }
};

// Row height - load from localStorage
const rowHeightStorageKey = computed(() => `${STORAGE_PREFIX}-${props.moduleKey}-row-height`);
const DEFAULT_ROW_HEIGHT = 'small';

const getDefaultRowHeight = () => {
  if (typeof window === 'undefined') return DEFAULT_ROW_HEIGHT;
  const saved = localStorage.getItem(rowHeightStorageKey.value);
  return (saved && ['small', 'medium', 'large', 'huge'].includes(saved)) ? saved : DEFAULT_ROW_HEIGHT;
};
const rowHeight = ref(DEFAULT_ROW_HEIGHT); // Initialize with default, will be set on mount

// Watch row height and save to localStorage
watch(rowHeight, (value) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(rowHeightStorageKey.value, value);
  }
});

// Row height options
const rowHeightLabels = computed(() => ({
  small: t('common.listRowHeightSmall'),
  medium: t('common.listRowHeightMedium'),
  large: t('common.listRowHeightLarge'),
  huge: t('common.listRowHeightHuge'),
}));

// Check if we're on desktop (md breakpoint and above)
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1024);
const isDesktop = computed(() => windowWidth.value >= 768); // md breakpoint

// Stats visibility - show by default on desktop, hide on mobile/tablet
// Load from localStorage if available, otherwise use default based on screen size
const getDefaultShowStats = () => {
  if (typeof window === 'undefined') return true;
  const saved = localStorage.getItem(`arivu-stats-visible-${props.moduleKey}`);
  if (saved !== null) {
    return saved === 'true';
  }
  return window.innerWidth >= 768; // Show by default on desktop
};

const showStats = ref(getDefaultShowStats());

const statsToggleTitle = computed(() =>
  showStats.value ? t('common.listHideStatistics') : t('common.listShowStatistics')
);

// Save stats visibility preference to localStorage
const saveStatsPreference = () => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(`arivu-stats-visible-${props.moduleKey}`, showStats.value.toString());
  }
};

// Watch for changes to showStats and save to localStorage; emit so parent (e.g. Deals) can adjust Kanban height
watch(showStats, (val) => {
  saveStatsPreference();
  emit('stats-visibility-changed', val);
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

// Kanban customize: load/save options and card fields
const loadKanbanSettings = () => {
  if (typeof window === 'undefined') return;
  try {
    const optsRaw = localStorage.getItem(kanbanOptionsStorageKey.value);
    if (optsRaw) {
      const opts = JSON.parse(optsRaw);
      if (opts.cardSize) kanbanCardSize.value = opts.cardSize;
      if (typeof opts.stackFields === 'boolean') kanbanStackFields.value = opts.stackFields;
      if (typeof opts.collapseEmptyColumns === 'boolean') kanbanCollapseEmptyColumns.value = opts.collapseEmptyColumns;
      if (typeof opts.showEmptyFields === 'boolean') kanbanShowEmptyFields.value = opts.showEmptyFields;
      if (typeof opts.closedTasks === 'boolean') kanbanClosedTasks.value = opts.closedTasks;
    }
    const fieldsRaw = localStorage.getItem(kanbanFieldsStorageKey.value);
    if (fieldsRaw) {
      const parsed = JSON.parse(fieldsRaw);
      if (parsed && Array.isArray(parsed) && parsed.length > 0) {
        kanbanVisibleColumns.value = normalizeKanbanColumnsForTitle(parsed.map(c => ({ ...c, sortable: c.sortable !== false })));
        return;
      }
    }
    // Default: for deals/tasks use fixed card order; otherwise copy from list visible columns or props.columns
    const source = visibleColumns.value.length > 0 ? visibleColumns.value : props.columns.map(c => ({ ...c, visible: c.visible !== false, showInTable: c.showInTable !== false }));
    if (props.moduleKey === 'deals') {
      kanbanVisibleColumns.value = buildDealsDefaultKanbanColumns(source);
    } else if (props.moduleKey === 'tasks') {
      kanbanVisibleColumns.value = buildTasksDefaultKanbanColumns(source);
    } else {
      kanbanVisibleColumns.value = normalizeKanbanColumnsForTitle(source.map(col => ({
        key: col.key,
        label: col.label || col.key,
        visible: col.visible !== false,
        dataType: col.dataType,
        sortable: col.sortable !== false,
        showInTable: col.showInTable !== false
      })));
    }
  } catch (e) {
    console.warn('Failed to load kanban settings', e);
    const source = visibleColumns.value.length > 0 ? visibleColumns.value : props.columns.map(c => ({ ...c, visible: c.visible !== false, showInTable: c.showInTable !== false }));
    if (props.moduleKey === 'deals') {
      kanbanVisibleColumns.value = buildDealsDefaultKanbanColumns(source);
    } else if (props.moduleKey === 'tasks') {
      kanbanVisibleColumns.value = buildTasksDefaultKanbanColumns(source);
    } else {
      kanbanVisibleColumns.value = normalizeKanbanColumnsForTitle(source.map(col => ({
        key: col.key,
        label: col.label || col.key,
        visible: col.visible !== false,
        dataType: col.dataType,
        sortable: col.sortable !== false,
        showInTable: col.showInTable !== false
      })));
    }
  }
};
const saveKanbanOptions = () => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(kanbanOptionsStorageKey.value, JSON.stringify({
      cardSize: kanbanCardSize.value,
      stackFields: kanbanStackFields.value,
      collapseEmptyColumns: kanbanCollapseEmptyColumns.value,
      showEmptyFields: kanbanShowEmptyFields.value,
      closedTasks: kanbanClosedTasks.value
    }));
    emit('kanban-settings-changed');
  } catch (e) {
    console.warn('Failed to save kanban options', e);
  }
};
const saveKanbanFields = () => {
  if (typeof window === 'undefined' || kanbanVisibleColumns.value.length === 0) return;
  try {
    const normalized = normalizeKanbanColumnsForTitle(kanbanVisibleColumns.value);
    const toSave = normalized.map(col => ({
      key: col.key,
      label: col.label,
      visible: col.visible,
      dataType: col.dataType,
      showInTable: col.showInTable
    }));
    localStorage.setItem(kanbanFieldsStorageKey.value, JSON.stringify(toSave));
    emit('kanban-settings-changed');
  } catch (e) {
    console.warn('Failed to save kanban fields', e);
  }
};
// Record title field is always first, visible, and cannot be reordered or disabled (name or title)
const KANBAN_TITLE_KEYS = ['name', 'title'];
const isKanbanTitleField = (key) => key && KANBAN_TITLE_KEYS.includes(key);
const normalizeKanbanColumnsForTitle = (cols) => {
  if (!Array.isArray(cols) || cols.length === 0) return cols;
  const titleKey = cols.find(c => isKanbanTitleField(c.key))?.key;
  if (!titleKey) return cols;
  const titleCol = cols.find(c => c.key === titleKey);
  if (!titleCol) return cols;
  const rest = cols.filter(c => c.key !== titleKey);
  return [{ ...titleCol, visible: true, showInTable: true }, ...rest];
};

const getSyntheticColumnLabel = (moduleKey, key) =>
  resolveListColumnLabel(moduleKey, key, key, t, te);

// Default Kanban card field order for deals: Title, Amount, Expected Close Date, Probability, Priority, Organization, Deal Owner
const DEALS_KANBAN_DEFAULT_VISIBLE_KEYS = ['name', 'amount', 'expectedCloseDate', 'probability', 'priority', 'accountId', 'ownerId'];

// Default Kanban card field order for tasks: Title, Assigned to, Due Date, Priority
const TASKS_KANBAN_DEFAULT_VISIBLE_KEYS = ['title', 'assignedTo', 'dueDate', 'priority'];
const EVENTS_APPOINTMENT_BOOST_KEYS = [
  'appointmentBookedBy',
  'appointmentBookingSource',
  'appointmentType',
  'appointmentMeetingLink',
];
/** Ensure every key in defaultVisibleColumns exists in the column map (add synthetic columns if missing). */
function ensureDefaultColumnsInMap(moduleKey, defaultVisibleColumns, columnMap) {
  if (!defaultVisibleColumns || !columnMap) return;
  defaultVisibleColumns.forEach((key) => {
    if (!columnMap.has(key)) {
      columnMap.set(key, {
        key,
        label: getSyntheticColumnLabel(moduleKey, key),
        dataType: 'Lookup',
        sortable: false,
        showInTable: true
      });
    }
  });
}
function buildDealsDefaultKanbanColumns(sourceColumns) {
  const byKey = new Map(sourceColumns.map(c => [c.key, c]));
  const ordered = [];
  const added = new Set();
  DEALS_KANBAN_DEFAULT_VISIBLE_KEYS.forEach(key => {
    const col = byKey.get(key);
    if (col) {
      ordered.push({ ...col, key: col.key, label: col.label || getSyntheticColumnLabel('deals', key), visible: true, dataType: col.dataType, sortable: col.sortable !== false, showInTable: true });
      added.add(key);
    } else {
      // Column not in list definition (e.g. accountId) - add synthetic column so it shows on card
      ordered.push({
        key,
        label: getSyntheticColumnLabel('deals', key),
        visible: true,
        dataType: 'Lookup',
        sortable: false,
        showInTable: true
      });
      added.add(key);
    }
  });
  sourceColumns.forEach(col => {
    if (!added.has(col.key)) {
      ordered.push({ ...col, key: col.key, label: col.label || col.key, visible: false, dataType: col.dataType, sortable: col.sortable !== false, showInTable: false });
    }
  });
  return normalizeKanbanColumnsForTitle(ordered);
}

function buildTasksDefaultKanbanColumns(sourceColumns) {
  const byKey = new Map(sourceColumns.map(c => [c.key, c]));
  const ordered = [];
  const added = new Set();
  TASKS_KANBAN_DEFAULT_VISIBLE_KEYS.forEach(key => {
    const col = byKey.get(key);
    if (col) {
      ordered.push({
        ...col,
        key: col.key,
        label: col.label || getSyntheticColumnLabel('tasks', key),
        visible: true,
        dataType: col.dataType,
        sortable: col.sortable !== false,
        showInTable: true
      });
      added.add(key);
    } else {
      ordered.push({
        key,
        label: getSyntheticColumnLabel('tasks', key),
        visible: true,
        dataType: key === 'assignedTo' ? 'user' : key === 'dueDate' ? 'date' : 'text',
        sortable: false,
        showInTable: true
      });
      added.add(key);
    }
  });
  sourceColumns.forEach(col => {
    if (!added.has(col.key)) {
      ordered.push({ ...col, key: col.key, label: col.label || col.key, visible: false, dataType: col.dataType, sortable: col.sortable !== false, showInTable: false });
    }
  });
  return normalizeKanbanColumnsForTitle(ordered);
}

const kanbanShownFields = computed(() => {
  const q = kanbanFieldSearchQuery.value.trim().toLowerCase();
  const shown = kanbanVisibleColumns.value.filter(c =>
    c.visible &&
    !isSystemFieldForList(props.moduleKey, c.key, c) &&
    (!q || (c.label || c.key).toLowerCase().includes(q))
  );
  return shown.map(c => ({ ...c, locked: isKanbanTitleField(c.key) }));
});
const kanbanHiddenFields = computed(() => {
  const q = kanbanFieldSearchQuery.value.trim().toLowerCase();
  return kanbanVisibleColumns.value.filter(c =>
    !c.visible &&
    !isKanbanTitleField(c.key) &&
    !isSystemFieldForList(props.moduleKey, c.key, c) &&
    (!q || (c.label || c.key).toLowerCase().includes(q))
  );
});
const toggleKanbanFieldVisibility = (fieldKey) => {
  if (isKanbanTitleField(fieldKey)) return;
  const col = kanbanVisibleColumns.value.find(c => c.key === fieldKey);
  if (!col) return;
  col.visible = !col.visible;
  col.showInTable = col.visible;
  saveKanbanFields();
};
const kanbanCardSizeLabels = computed(() => ({
  small: t('common.listRowHeightSmall'),
  medium: t('common.listRowHeightMedium'),
  large: t('common.listRowHeightLarge'),
}));
const setKanbanCardSize = (value) => {
  kanbanCardSize.value = value;
  saveKanbanOptions();
};

const resetKanbanToDefault = () => {
  kanbanCardSize.value = 'medium';
  kanbanStackFields.value = true;
  kanbanCollapseEmptyColumns.value = false;
  kanbanShowEmptyFields.value = true;
  kanbanClosedTasks.value = true;
  const source = visibleColumns.value.length > 0 ? visibleColumns.value : props.columns.map(c => ({ ...c, visible: c.visible !== false, showInTable: c.showInTable !== false }));
  if (props.moduleKey === 'deals') {
    kanbanVisibleColumns.value = buildDealsDefaultKanbanColumns(source);
  } else if (props.moduleKey === 'tasks') {
    kanbanVisibleColumns.value = buildTasksDefaultKanbanColumns(source);
  } else {
    kanbanVisibleColumns.value = normalizeKanbanColumnsForTitle(source.map(col => ({
      key: col.key,
      label: col.label || col.key,
      visible: col.visible !== false,
      dataType: col.dataType,
      sortable: col.sortable !== false,
      showInTable: col.showInTable !== false
    })));
  }
  saveKanbanOptions();
  saveKanbanFields();
};

// Drag-and-drop reorder for Kanban Shown fields
const handleKanbanDragStart = (event, index) => {
  if (kanbanShownFields.value[index]?.locked) return;
  kanbanDragStartIndex.value = index;
  event.dataTransfer.effectAllowed = 'move';
  if (event.target) event.target.style.opacity = '0.5';
};
const handleKanbanDragOver = (event) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
};
const handleKanbanDragEnter = (event, index) => {
  event.preventDefault();
  if (kanbanShownFields.value[index]?.locked) return;
  kanbanDragOverIndex.value = index;
};
const handleKanbanDragLeave = () => {
  kanbanDragOverIndex.value = null;
};
const handleKanbanDrop = (event, dropIndex) => {
  event.preventDefault();
  kanbanDragOverIndex.value = null;
  const start = kanbanDragStartIndex.value;
  if (start == null || start === dropIndex) {
    kanbanDragStartIndex.value = null;
    return;
  }
  const shown = kanbanShownFields.value;
  if (shown[start]?.locked) {
    kanbanDragStartIndex.value = null;
    return;
  }
  const visibleCols = kanbanVisibleColumns.value.filter(c => c.visible);
  const hiddenCols = kanbanVisibleColumns.value.filter(c => !c.visible);
  if (start < 0 || start >= visibleCols.length || dropIndex < 0 || dropIndex >= visibleCols.length) {
    kanbanDragStartIndex.value = null;
    return;
  }
  const dragged = visibleCols[start];
  visibleCols.splice(start, 1);
  const insertIndex = start < dropIndex ? dropIndex - 1 : dropIndex;
  visibleCols.splice(Math.max(0, Math.min(insertIndex, visibleCols.length)), 0, dragged);
  kanbanVisibleColumns.value = normalizeKanbanColumnsForTitle([...visibleCols, ...hiddenCols]);
  saveKanbanFields();
  kanbanDragStartIndex.value = null;
};
const handleKanbanDragEnd = (event) => {
  if (event.target) event.target.style.opacity = '1';
  kanbanDragStartIndex.value = null;
  kanbanDragOverIndex.value = null;
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

// Normalize column order - ensure 'name' field is at top for forms module
const normalizeColumnOrder = (columns) => {
  if (!Array.isArray(columns)) {
    return [];
  }

  // Handle specific ordering for the 'people' module
  if (props.moduleKey === 'people') {
    const peopleSpecificOrder = ['name', 'organization', 'sales_type', 'email', 'phone', 'assignedTo'];
    const orderedColumns = [];
    const processedKeys = new Set();

    // Ensure 'name' is always first and locked
    const nameColumn = columns.find(col => col.key === 'name');
    if (nameColumn) {
      orderedColumns.push({ ...nameColumn, locked: true });
      processedKeys.add('name');
    }

    // Add other columns according to the peopleSpecificOrder
    peopleSpecificOrder.forEach(key => {
      if (!processedKeys.has(key)) {
        const col = columns.find(c => c.key === key);
        if (col) {
          orderedColumns.push(col);
          processedKeys.add(key);
        }
      }
    });

    // Add any remaining columns that were not explicitly ordered
    columns.forEach(col => {
      if (!processedKeys.has(col.key)) {
        orderedColumns.push(col);
      }
    });

    return orderedColumns;
  }

  // Default behavior: move 'name' to the top for non-forms modules if not explicitly handled
  if (props.moduleKey !== 'forms') {
    const nameFieldIndex = columns.findIndex(col => col.key?.toLowerCase() === 'name');
    if (nameFieldIndex > 0) {
      const nameField = columns[nameFieldIndex];
      const reordered = [...columns];
      reordered.splice(nameFieldIndex, 1);
      reordered.unshift(nameField);
      return reordered;
    }
  }
  
  return columns;
};

// Default column builders are now in the module list registry

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
    const { getModuleListConfig } = await import('@/platform/modules/moduleListRegistry').catch(() => ({ getModuleListConfig: () => null }));
    const moduleListConfig = getModuleListConfig(props.moduleKey);
    const lockedColumnKey = moduleListConfig?.defaultColumns?.lockedColumn ?? 'name';

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
          showInTable: saved.showInTable !== undefined ? saved.showInTable : (saved.visible !== false),
          locked: saved.key === lockedColumnKey
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
          label: getFieldDisplayLabel(field) || propsCol?.label || field.key,
          visible: false, // Not in saved settings, so hidden
          sortable: propsCol?.sortable !== false,
          dataType: field.dataType || propsCol?.dataType || 'Text',
          showInTable: field.visibility?.list !== false,
          locked: field.key === lockedColumnKey
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
          showInTable: col.showInTable !== false,
          locked: col.key === lockedColumnKey
        });
      }
    });
    
    visibleColumns.value = normalizeColumnOrder(orderedColumns);
  } else {
    // No saved settings - fetch backend configuration and/or use props.columns
    const moduleConfig = await fetchFieldConfiguration();
    const backendFields = moduleConfig?.fields || [];

    const allAvailableColumnsMap = new Map();
    backendFields.forEach(field => allAvailableColumnsMap.set(field.key, {
      key: field.key,
      label: getFieldDisplayLabel(field) || field.key,
      dataType: field.dataType,
      sortable: true, // Assume sortable by default from backend
      showInTable: field.visibility?.list !== false,
      // ... other properties you want to preserve from backend
    }));
    props.columns.forEach(col => {
      if (!allAvailableColumnsMap.has(col.key)) {
        allAvailableColumnsMap.set(col.key, {
          key: col.key,
          label: col.label || col.key,
          dataType: col.dataType,
          sortable: col.sortable !== false,
          showInTable: col.showInTable !== false,
          // ... other properties you want to preserve from props
        });
      }
    });
    // Check if module has registry configuration for default columns
    const { getModuleListConfig, buildDefaultColumns } = await import('@/platform/modules/moduleListRegistry').catch(() => ({ getModuleListConfig: () => null, buildDefaultColumns: () => [] }));
    const moduleListConfig = getModuleListConfig(props.moduleKey);
    if (moduleListConfig?.defaultColumns) {
      ensureDefaultColumnsInMap(props.moduleKey, moduleListConfig.defaultColumns.defaultVisibleColumns, allAvailableColumnsMap);
    }
    const allAvailableColumns = Array.from(allAvailableColumnsMap.values());

    if (moduleListConfig?.defaultColumns) {
      // Use registry defaults (Title, Organization, Amount, etc. in same order for all new instances)
      const defaultColumns = buildDefaultColumns(allAvailableColumns, moduleListConfig.defaultColumns);
      visibleColumns.value = normalizeColumnOrder(defaultColumns);
      saveColumnSettings();
    } else if (moduleConfig && Array.isArray(moduleConfig.fields)) {
      // Existing logic for other modules with backend config
      const fieldVisibilityMap = new Map();
      moduleConfig.fields.forEach(field => {
        if (field.key) {
          const isVisible = field.visibility?.list !== false; // Default to true if not set
          fieldVisibilityMap.set(field.key, isVisible);
        }
      });

      const initializedColumns = allAvailableColumns.map(col => ({
        key: col.key,
        label: col.label || col.key,
        visible: fieldVisibilityMap.get(col.key) || false, // Use backend visibility or default to hidden
        sortable: col.sortable !== false,
        dataType: col.dataType || 'Text',
        showInTable: (fieldVisibilityMap.get(col.key) || false),
        locked: col.key === 'name', // Default lock 'name' for non-people modules too
      }));
      visibleColumns.value = normalizeColumnOrder(initializedColumns);
      saveColumnSettings();
    } else {
      // Fallback to props with visibility.list check (no backend config and not people module)
      const mappedColumns = props.columns.map(col => ({
        key: col.key,
        label: col.label || col.key,
        visible: col.visible !== false,
        sortable: col.sortable !== false,
        dataType: col.dataType || 'Text',
        showInTable: col.showInTable !== false,
        locked: col.key === 'name', // Default lock 'name'
      }));
      visibleColumns.value = normalizeColumnOrder(mappedColumns);
      saveColumnSettings();
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
        const isVisible = col.visible !== false;
        
        // Check registry for default column visibility
        let shouldBeVisible = isVisible;
        let shouldBeLocked = false;
        
        try {
          const moduleListRegistry = require('@/platform/modules/moduleListRegistry');
          const moduleConfig = moduleListRegistry.getModuleListConfig(props.moduleKey);
          
          if (moduleConfig?.defaultColumns) {
            const defaultVisible = moduleConfig.defaultColumns.defaultVisibleColumns || [];
            const lockedColumn = moduleConfig.defaultColumns.lockedColumn;
            
            // Check if column should be visible by default
            if (defaultVisible.length > 0) {
              shouldBeVisible = defaultVisible.includes(col.key);
            }
            
            // Check if column should be locked
            if (lockedColumn && col.key === lockedColumn) {
              shouldBeLocked = true;
            }
          }
        } catch (error) {
          // Registry not available, use existing logic
        }
        
        // For modules with field metadata (like people), check system fields
        if (props.moduleKey === 'people') {
          try {
            const metadata = getFieldMetadata(col.key);
            // System fields: skip entirely (don't add to visibleColumns)
            if (metadata.owner === 'system') {
              return; // Skip this column
            }
          } catch (error) {
            // Field not in metadata - continue
          }
        }
        
        visibleColumns.value.push({
          key: col.key,
          label: col.label || col.key,
          visible: shouldBeVisible,
          sortable: col.sortable !== false,
          dataType: col.dataType || 'Text',
          showInTable: shouldBeVisible,
          locked: shouldBeLocked
        });
      });
      // Normalize order after adding new columns
      visibleColumns.value = normalizeColumnOrder(visibleColumns.value);
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

function findOrCreateBoostColumn(key) {
  let col = visibleColumns.value.find((c) => c.key === key);
  if (col) return col;
  const fromProps = props.columns.find((c) => c.key === key);
  const label = getSyntheticColumnLabel('events', key);
  const base = fromProps
    ? { ...fromProps }
    : { key, label, dataType: 'Text', sortable: false };
  col = {
    ...base,
    key,
    label: base.label || label,
    visible: false,
    showInTable: false,
    sortable: base.sortable !== false
  };
  visibleColumns.value.push(col);
  return col;
}

function boostColumnStateSignature(cols) {
  if (!Array.isArray(cols)) return '';
  return cols
    .map(
      (c) =>
        `${c.key}:${c.visible ? 1 : 0}:${c.showInTable ? 1 : 0}:${c.locked ? 1 : 0}`
    )
    .join('|');
}

function applyBoostVisibleColumnKeys(keys = []) {
  const boostSet = new Set(Array.isArray(keys) ? keys : []);
  // Non-events lists use boost only when empty; running normalizeColumnOrder on every
  // visibleColumns churn always returns a fresh array for `people`, which retriggered
  // the boost watcher and caused "Maximum recursive updates exceeded".
  if (boostSet.size === 0 && props.moduleKey !== 'events') {
    return;
  }
  boostSet.forEach((key) => {
    const col = findOrCreateBoostColumn(key);
    col.visible = true;
    col.showInTable = true;
  });
  if (props.moduleKey === 'events') {
    EVENTS_APPOINTMENT_BOOST_KEYS.forEach((key) => {
      if (boostSet.has(key)) return;
      const col = visibleColumns.value.find((c) => c.key === key);
      if (col) {
        col.visible = false;
        col.showInTable = false;
      }
    });
  }
  const next = normalizeColumnOrder(visibleColumns.value);
  if (boostColumnStateSignature(next) !== boostColumnStateSignature(visibleColumns.value)) {
    visibleColumns.value = next;
  }
  // If only the array reference changed (e.g. people module), keep the current ref to avoid watcher churn.
}

watch(
  [() => props.boostVisibleColumnKeys, () => visibleColumns.value.length],
  ([keys]) => {
    if (visibleColumns.value.length === 0) return;
    applyBoostVisibleColumnKeys(keys);
  },
  { deep: true, immediate: true }
);

// Computed grid columns class based on number of stats
const statsGridColsClass = computed(() => {
  if (!props.statsConfig || props.statsConfig.length === 0) return 'md:grid-cols-1';
  
  const count = props.statsConfig.length;
  // Map count to Tailwind grid classes (up to 12 columns)
  const gridClasses = {
    1: 'md:grid-cols-1',
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'md:grid-cols-4',
    5: 'md:grid-cols-5',
    6: 'md:grid-cols-6',
    7: 'md:grid-cols-7',
    8: 'md:grid-cols-8',
    9: 'md:grid-cols-9',
    10: 'md:grid-cols-10',
    11: 'md:grid-cols-11',
    12: 'md:grid-cols-12'
  };
  
  return gridClasses[count] || 'md:grid-cols-4';
});

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
      const currencyCode = String(config.currencyCode || config.currency || DEFAULT_CURRENCY_CODE).toUpperCase();
      formattedStat = formatCurrencyValue(currentValue, { currencyCode }) || '—';
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
      const currencyCode = String(config.currencyCode || config.currency || DEFAULT_CURRENCY_CODE).toUpperCase();
      formattedPrevious = formatCurrencyValue(previousValue, { currencyCode }) || '—';
    } else if (config.formatter === 'number') {
      formattedPrevious = previousValue.toLocaleString();
    } else if (typeof config.formatter === 'function') {
      formattedPrevious = config.formatter(previousValue);
    } else {
      formattedPrevious = previousValue.toLocaleString();
    }
    
    return {
      key: config.key, // Include key for stat-click handler
      name: config.name,
      stat: formattedStat,
      previousStat: formattedPrevious,
      change: `${Math.abs(change)}%`,
      changeType: change >= 0 ? 'increase' : 'decrease'
    };
  });
});



const dataLength = computed(() => (Array.isArray(props.data) ? props.data.length : 0));

const initialRender = ref(true);

const tableLoading = computed(() => {
  // Match parent `loading` even if row data is momentarily non-empty (avoid flashing row numbers).
  if (props.loading) {
    return true;
  }
  if (initialRender.value && !Array.isArray(props.data)) {
    return true;
  }
  return false;
});

// Computed columns based on visible columns (preserve locked for title column width in TableView)
const computedColumns = computed(() => {
  const mapped = visibleColumns.value
    .filter(col => col.visible)
    .map(col => {
      const originalCol = props.columns.find(c => c.key === col.key);
      const merged = originalCol ? { ...originalCol, locked: col.locked } : { ...col };
      return merged;
    });
  if (mapped.length > 0) return mapped;
  if (tableLoading.value && Array.isArray(props.columns) && props.columns.length > 0) {
    return props.columns.map((c) => ({ ...c }));
  }
  return [];
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
  const sidebarCollapsed = localStorage.getItem('arivu-sidebar-collapsed') === 'true';
  return sidebarCollapsed ? '64px' : '256px';
});

// Filters
const filters = reactive({});
const STORAGE_PREFIX = 'arivu-listview';
const filterStorageKey = computed(() => `${STORAGE_PREFIX}-${props.moduleKey}-filters`);
const searchStorageKey = computed(() => `${STORAGE_PREFIX}-${props.moduleKey}-search`);
const sortStorageKey = computed(() => `${STORAGE_PREFIX}-${props.moduleKey}-sort`);
const columnsStorageKey = computed(() => `${STORAGE_PREFIX}-${props.moduleKey}-columns`);
const kanbanOptionsStorageKey = computed(() => `${STORAGE_PREFIX}-${props.moduleKey}-kanban-options`);
const kanbanFieldsStorageKey = computed(() => `${STORAGE_PREFIX}-${props.moduleKey}-kanban-fields`);

const searchTerm = computed(() => searchQuery.value.trim());

const activeFilterCount = computed(() => {
  // Count filters from both internal filters and externalFilters
  const internalFilterCount = Object.values(filters).filter(value => value !== '' && value !== undefined).length;
  const externalFilterCount = props.externalFilters 
    ? Object.values(props.externalFilters).filter(value => value !== '' && value !== undefined && value !== null).length
    : 0;
  return internalFilterCount + externalFilterCount;
});

const hasFiltersApplied = computed(() => activeFilterCount.value > 0);

// Check if any filters are active (including search, internal filters, and external filters)
const hasActiveFilters = computed(() => {
  const hasSearch = searchTerm.value !== '';
  const hasInternalFilters = Object.values(filters).some(value => value !== '' && value !== undefined);
  const hasExternalFilters = props.externalFilters 
    ? Object.values(props.externalFilters).some(value => value !== '' && value !== undefined && value !== null)
    : false;
  return hasSearch || hasInternalFilters || hasExternalFilters;
});

const hasMorePages = computed(() => {
  if (!props.infiniteScroll) return false;
  const p = props.pagination;
  if (!p) return false;
  const cur = Number(p.currentPage);
  const total = Number(p.totalPages);
  if (!Number.isFinite(cur) || !Number.isFinite(total)) return false;
  return cur < total;
});

/** For numbered selection gutter: continuous 1…n when infinite scroll; paged offset otherwise */
const effectiveRowNumberOffset = computed(() => {
  if (props.selectionColumnVariant !== 'numbered-hover') return 0;
  if (props.infiniteScroll) return 0;
  const p = props.pagination;
  const cur = Number(p?.currentPage);
  const lim = Number(p?.limit);
  if (!Number.isFinite(cur) || !Number.isFinite(lim) || cur < 1 || lim < 1) return 0;
  return (cur - 1) * lim;
});
// Create a hash of the first few item IDs to detect data changes
const dataHash = computed(() => {
  if (!Array.isArray(props.data) || props.data.length === 0) return 'empty';
  // Use first 3 item IDs to create a simple hash for the key
  const ids = props.data.slice(0, 3).map(item => item[props.rowKey] || item._id).join('-');
  return ids || 'no-ids';
});

/** Stats strip shimmer while list data is loading */
const statsBarSkeleton = computed(
  () =>
    Boolean(props.statsConfig?.length) &&
    props.loading &&
    dataLength.value === 0
);
const showEmptyState = computed(() => !tableLoading.value && dataLength.value === 0);
onMounted(() => {
  requestAnimationFrame(() => {
    // Set initialRender to false once we have data (even if empty)
    if (Array.isArray(props.data)) {
      initialRender.value = false;
    }
  });
});
watch(() => props.data, (newVal) => {
  // Set initialRender to false as soon as we receive data (even if empty array)
  if (Array.isArray(newVal)) {
    initialRender.value = false;
  }
}, { immediate: true });

const resourceName = computed(() => (typeof props.title === 'string' ? props.title.toLowerCase() : 'records'));

// Active People view title - source of truth for page title
// When a saved view is active, title reflects the view name
// When manual filters/search are applied, title is "Custom"
// When no view is active and no filters, title shows default view name
const activePeopleViewTitle = computed(() => {
  // Only show view name if saved views are available
  if (!props.savedViews || props.savedViews.length === 0) {
    return props.title;
  }

  // If an active view is set, return the view's label
  if (props.activeSavedViewId) {
    const activeView = props.savedViews.find(view => view.id === props.activeSavedViewId);
    if (activeView) {
      return activeView.label;
    }
  }

  // Check if manual filters or search are applied
  const hasActiveFilters = hasFiltersApplied.value;
  const hasActiveSearch = searchTerm.value !== '';
  
  if (hasActiveFilters || hasActiveSearch) {
    return t('common.listViewCustom');
  }

  const moduleLabel = props.title || props.moduleKey.charAt(0).toUpperCase() + props.moduleKey.slice(1);
  return resolveListViewLabel(
    props.moduleKey,
    'all',
    `All ${moduleLabel}`,
    t,
    te
  );
});

// STEP 3: Determine if Save CTA should be shown - DERIVED ONLY
// Shows "Save view" button ONLY when current state doesn't match any saved view
// This is READ-ONLY - does NOT mutate state, filters, or views
const shouldShowSaveCTA = computed(() => {
  // Only show save CTA if saved views are available
  if (!props.savedViews || props.savedViews.length === 0) {
    return false;
  }
  
  // Get current state
  const currentState = {
    filters: filters,
    sortField: props.sortField,
    sortOrder: props.sortOrder,
    columns: visibleColumns.value
  };
  
  // Normalize current state
  const normalizedState = normalizePeopleViewState(currentState);
  
  // Get current user ID for filter normalization
  const currentUserId = authStore.user?._id;
  
  // Check if state matches any saved view
  const matchesAnyView = doesStateMatchAnySavedView(normalizedState, props.savedViews, currentUserId);
  
  // Show CTA only when state does NOT match any saved view
  return !matchesAnyView;
});

const emptyStateTitle = computed(() => {
  if (hasActiveFilters.value) {
    return t('common.listEmptyNoMatchFilters', { module: resourceName.value });
  }
  return props.emptyTitle || t('common.listEmptyTitle');
});

const emptyStateMessage = computed(() => {
  if (searchTerm.value && hasFiltersApplied.value) {
    return t('common.listEmptyNoMatchSearchAndFilters', { module: resourceName.value });
  }
  if (searchTerm.value) {
    return t('common.listEmptyNoMatchSearch', {
      module: resourceName.value,
      query: searchTerm.value,
    });
  }
  if (hasFiltersApplied.value) {
    return t('common.listEmptyNoMatchFiltersOnly', { module: resourceName.value });
  }
  return props.emptyMessage || t('common.listEmptyMessage');
});

const getFilterAllLabel = (filter) =>
  t('common.listFilterAll', { filter: filter.label || filter.key });

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
  if (value === undefined || value === null || value === '') return null;
  if (filter.filterType === 'date' && typeof value === 'object') {
    return getDateFilterLabel(parseDateFilterValue(value)) || null;
  }
  const option = filter.options?.find(opt => opt.value === value);
  return option ? (option.label || option.value) : null;
};

// =============================================================================
// SUGGESTED FILTERS (Feature-flagged, opt-in only)
// =============================================================================

/**
 * Get display label for a suggested filter field key.
 * Looks up the label from filterConfig or falls back to formatted field key.
 * 
 * @param fieldKey - The field key from suggested filters
 * @returns Human-readable label for the filter
 */
const getSuggestedFilterLabel = (fieldKey) => {
  const filter = props.filterConfig?.find(f => f.key === fieldKey);
  return resolveListFilterLabel(
    props.moduleKey,
    fieldKey,
    filter?.label || fieldKey,
    t,
    te
  );
};

/**
 * Handle click on a suggested filter chip.
 * Opens the filter configuration UI for the selected field.
 * 
 * IMPORTANT: This does NOT apply the filter automatically.
 * It only opens the filter dropdown so the user can select a value.
 * 
 * @param fieldKey - The field key to configure
 */
const handleSuggestedFilterClick = (fieldKey) => {
  // Find the filter in filterConfig
  const filterIndex = props.filterConfig?.findIndex(f => f.key === fieldKey);
  
  if (filterIndex === -1 || filterIndex === undefined) {
    console.warn(`[ListView] Suggested filter "${fieldKey}" not found in filterConfig`);
    return;
  }
  
  // Focus the filter dropdown to open it
  // The filter dropdowns are rendered with data-filter-key attribute
  // We use nextTick to ensure DOM is ready
  nextTick(() => {
    const filterButton = document.querySelector(`[data-filter-key="${fieldKey}"] button`);
    if (filterButton) {
      filterButton.click();
    }
  });
};

// Handle stat click (works for all modules with statsConfig)
const handleStatClick = (item) => {
  if (props.statsConfig && props.statsConfig.length > 0) {
    emit('stat-click', item);
  }
};

// Get count of active filters for mobile badge
const getActiveFiltersCount = () => {
  return Object.values(filters).filter(value => value !== '' && value !== null && value !== undefined).length;
};

// Handle filter change
const handleFilterChange = (key, value) => {
  // If value is provided, use it; otherwise get from filters
  if (value !== undefined) {
    filters[key] = value;
  }
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
  if (!Array.isArray(newConfig) || newConfig.length === 0) {
    if (import.meta.env.DEV && props.moduleKey === 'people') {
      console.log('[ListView] filterConfig is empty or not an array:', {
        isArray: Array.isArray(newConfig),
        length: newConfig?.length,
        value: newConfig
      });
    }
    return;
  }
  
  if (import.meta.env.DEV && props.moduleKey === 'people') {
    console.log('[ListView] filterConfig received:', {
      count: newConfig.length,
      filters: newConfig.map(f => ({ key: f.key, filterType: f.filterType, hasOptions: !!f.options, optionsCount: f.options?.length || 0 }))
    });
  }
  
  newConfig.forEach(filter => {
    if (filter && filter.key && !(filter.key in filters)) {
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

// Watch externalFilters prop and sync to internal filters object
// This ensures hasFiltersApplied correctly detects filters when stat is clicked or saved view is selected
watch(
  () => props.externalFilters,
  (newExternalFilters) => {
    if (!newExternalFilters) return;
    
    // First, clear all existing filters
    Object.keys(filters).forEach(key => {
      filters[key] = '';
    });
    
    // Then apply new external filters
    if (Object.keys(newExternalFilters).length > 0) {
      Object.keys(newExternalFilters).forEach(key => {
        const value = newExternalFilters[key];
        // Handle all value types including boolean, null, and empty strings
        if (value !== undefined) {
          filters[key] = value;
        }
      });
    }
  },
  { deep: true, immediate: true }
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

// Helper: check if a field is a system field (should not appear in Customize List or Customize Kanban)
function isSystemFieldForList(moduleKey, fieldKey, field) {
  if (!fieldKey) return false;
  if (field?.isSystem === true) return true;
  const fieldObj = field && field.key ? field : { key: fieldKey };
  return isSystemFieldFromEngine(moduleKey, fieldObj);
}

// Field management - sync with visibleColumns and backend configuration
const allFields = computed(() => {
  // Start with all fields from backend configuration if available, otherwise use props.columns
  const backendFields = backendModuleConfig.value?.fields || [];
  const propsColumns = Array.isArray(props.columns) ? props.columns : [];
  
  // Create a map of all available fields (from backend + props.columns)
  const allFieldsMap = new Map();
  
  // First, add all fields from backend configuration
  backendFields.forEach(field => {
    if (field.key && !isSystemFieldForList(props.moduleKey, field.key, field)) {
      // Find corresponding column from props for additional metadata
      const propsCol = propsColumns.find(c => c.key === field.key);
      allFieldsMap.set(field.key, {
        key: field.key,
        label: getFieldDisplayLabel(field) || propsCol?.label || field.key,
        visible: false, // Will be set from visibleColumns
        sortable: propsCol?.sortable !== false,
        dataType: field.dataType || propsCol?.dataType || 'Text',
        showInTable: field.visibility?.list !== false
      });
    }
  });
  
  // Then add any fields from props.columns that aren't in backend (skip system fields)
  propsColumns.forEach(col => {
    if (!allFieldsMap.has(col.key) && !isSystemFieldForList(props.moduleKey, col.key, col)) {
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
    
    // IMPORTANT: Use visibleColumns as source of truth for visibility
    // If field is not in visibleColumns, it defaults to hidden (false)
    const isVisible = visibleCol ? (visibleCol.visible === true) : false;
    
    return {
      ...field,
      visible: isVisible, // This is the source of truth - defaults to false if not in visibleColumns
      showInTable: visibleCol ? (visibleCol.showInTable !== false) : field.showInTable,
      // Include locked property if present
      locked: visibleCol?.locked || false
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
  // Exclude system fields - they should not appear in Customize List
  const visibleCols = visibleColumns.value.filter(
    col => col.visible && !isSystemFieldForList(props.moduleKey, col.key, col)
  );
  
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

// Group fields for People module Customize View
const getGroupLabel = (groupId) => {
  if (!groupId) return null;
  
  if (groupId === 'core') {
    return t('common.listCoreFields');
  } else if (groupId === 'participation-summary') {
    return t('common.listParticipationFields');
  } else if (groupId.startsWith('participation:')) {
    const appKey = groupId.replace('participation:', '');
    const appKeyUpper = appKey.toUpperCase();
    const appLabel = APP_NAME_KEYS[appKeyUpper] && te(APP_NAME_KEYS[appKeyUpper])
      ? t(APP_NAME_KEYS[appKeyUpper])
      : appKey;
    return t('common.listParticipationApp', { app: appLabel });
  } else if (groupId === 'system') {
    return t('common.listSystemFields');
  }
  
  return null;
};

// Group shown fields for People module
const groupedShownFields = computed(() => {
  return shownFields.value;
});

// Group hidden fields for People module
const groupedHiddenFields = computed(() => {
  return hiddenFields.value;
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
const resetColumnSettings = async () => {
  // Use registry for default columns if available
  const moduleListRegistry = await import('@/platform/modules/moduleListRegistry').catch(() => null);
  if (moduleListRegistry) {
    const { getModuleListConfig, buildDefaultColumns } = moduleListRegistry;
    const moduleListConfig = getModuleListConfig(props.moduleKey);
    
    if (moduleListConfig?.defaultColumns) {
      const allAvailableColumnsMap = new Map();
      props.columns.forEach(col => {
        allAvailableColumnsMap.set(col.key, {
          key: col.key,
          label: col.label || col.key,
          dataType: col.dataType,
          sortable: col.sortable !== false,
          showInTable: col.showInTable !== false,
        });
      });
      ensureDefaultColumnsInMap(props.moduleKey, moduleListConfig.defaultColumns.defaultVisibleColumns, allAvailableColumnsMap);
      const allAvailableColumns = Array.from(allAvailableColumnsMap.values());
      const defaultColumns = buildDefaultColumns(allAvailableColumns, moduleListConfig.defaultColumns);
      visibleColumns.value = normalizeColumnOrder(defaultColumns);
      saveColumnSettings();
      if (typeof window !== 'undefined') {
        localStorage.removeItem(rowHeightStorageKey.value);
      }
      if (props.tableId) {
        localStorage.removeItem(`table-column-widths-${props.tableId}`);
      }
      rowHeight.value = DEFAULT_ROW_HEIGHT;
      resetWidthsTrigger.value++;
      return;
    }
  }

  // Fallback: make all columns visible with 'name' locked if it exists
  // This applies to all modules that don't have registry config
  visibleColumns.value = props.columns.map(col => ({
    ...col,
    visible: true,
    locked: col.key === 'name' || col.locked === true // Lock 'name' by default, or if explicitly set
  }));
  saveColumnSettings();
  
  rowHeight.value = DEFAULT_ROW_HEIGHT;
  
  // Clear saved settings (after applying new defaults)
  if (typeof window !== 'undefined') {
    localStorage.removeItem(columnsStorageKey.value);
    localStorage.removeItem(rowHeightStorageKey.value);
  }
  
  // Reset column widths if needed
  if (props.tableId) {
    localStorage.removeItem(`table-column-widths-${props.tableId}`);
  }
  
  // Reinitialize columns after reset to ensure proper ordering and defaults
  initializeColumns();
};

const toggleFieldVisibility = async (fieldKey) => {
  let column = visibleColumns.value.find(col => col.key === fieldKey);
  
  // Check if field is locked (e.g., 'name' for People module)
  if (column?.locked) {
    // Locked columns cannot be hidden
    return;
  }
  
  // Prevent hiding 'name' field for forms module
  if (props.moduleKey === 'forms' && fieldKey?.toLowerCase() === 'name') {
    if (column && !column.visible) {
      // Allow showing it, but prevent hiding
      return;
    }
    if (!column || column.visible) {
      // Trying to hide - prevent it
      alert('The "name" field must always be visible in table and detail views for Forms.');
      return;
    }
  }
  
  // If field doesn't exist in visibleColumns, add it
  if (!column) {
    // Find field from backend config or props.columns
    const backendField = backendModuleConfig.value?.fields?.find(f => f.key === fieldKey);
    const propsCol = props.columns.find(c => c.key === fieldKey);
    
    if (backendField || propsCol) {
      const newColumn = {
        key: fieldKey,
        label: getFieldDisplayLabel(backendField) || propsCol?.label || fieldKey,
        visible: true, // Toggling on, so make it visible
        sortable: propsCol?.sortable !== false,
        dataType: backendField?.dataType || propsCol?.dataType || 'Text',
        showInTable: true
      };
      
      // Add to visibleColumns
      visibleColumns.value.push(newColumn);
      // Normalize order after adding new column
      visibleColumns.value = normalizeColumnOrder(visibleColumns.value);
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
  
  // Normalize order after toggling (ensures name stays at top for forms)
  visibleColumns.value = normalizeColumnOrder(visibleColumns.value);
  
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

// Core modules are configured in Settings > Core Modules; app modules (e.g. Deals) in Settings > Applications
const CORE_MODULE_KEYS = ['people', 'organizations', 'tasks', 'events', 'forms', 'items'];
const APP_MODULE_CONFIG = {
  deals: { appKey: 'SALES', app: 'sales', config: 'schema' }
};

const openNewCustomField = () => {
  // Close the drawer
  showColumnSettings.value = false;
  const moduleKey = (props.moduleKey || '').toLowerCase();
  const isCoreModule = CORE_MODULE_KEYS.includes(moduleKey);
  const appConfig = APP_MODULE_CONFIG[moduleKey];

  if (isCoreModule) {
    // Settings > Core Modules > [module] > Field Configurations tab
    router.push({
      path: '/settings',
      query: {
        tab: 'core-modules',
        moduleKey: props.moduleKey,
        module: props.moduleKey,
        mode: 'fields',
        action: 'add'
      }
    });
  } else if (appConfig) {
    // Settings > Applications > [app] > [module] > Field Configurations tab
    router.push({
      path: '/settings',
      query: {
        tab: 'applications',
        appKey: appConfig.appKey,
        app: appConfig.app,
        config: appConfig.config,
        module: props.moduleKey,
        mode: 'fields',
        action: 'add'
      }
    });
  } else {
    // Fallback: try core-modules (e.g. for future core modules not yet in list)
    router.push({
      path: '/settings',
      query: {
        tab: 'core-modules',
        moduleKey: props.moduleKey,
        module: props.moduleKey,
        mode: 'fields',
        action: 'add'
      }
    });
  }
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
  
  // Prevent reordering 'name' field for forms module
  if (props.moduleKey === 'forms') {
    const visibleCols = visibleColumns.value.filter(col => col.visible);
    const draggedField = shownFields.value[dragStartIndex.value];
    const dropField = shownFields.value[dropIndex];
    
    // Prevent dragging 'name' field away from position 0
    if (draggedField?.key?.toLowerCase() === 'name' && dragStartIndex.value === 0) {
      dragStartIndex.value = null;
      return;
    }
    
    // Prevent dropping other fields at position 0 if 'name' is already there
    if (dropIndex === 0 && draggedField?.key?.toLowerCase() !== 'name') {
      const nameFieldIndex = shownFields.value.findIndex(f => f.key?.toLowerCase() === 'name');
      if (nameFieldIndex === 0) {
        dragStartIndex.value = null;
        return;
      }
    }
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
    const reorderedColumns = [...visibleCols, ...hiddenCols];
    visibleColumns.value = normalizeColumnOrder(reorderedColumns);
    
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

// Quick preview Prev/Next (e.g. tasks): index in current list
const quickPreviewIndex = computed(() => {
  const row = previewRow.value;
  const list = props.data || [];
  if (!row?._id || !Array.isArray(list)) return -1;
  return list.findIndex((r) => String(r?._id || '') === String(row._id));
});
const quickPreviewCanPrevious = computed(() => quickPreviewIndex.value > 0);
const quickPreviewCanNext = computed(() => {
  const idx = quickPreviewIndex.value;
  const list = props.data || [];
  return idx >= 0 && idx < list.length - 1;
});
const handleQuickPreviewPrev = () => {
  const list = props.data || [];
  const idx = quickPreviewIndex.value;
  if (idx <= 0 || idx >= list.length) return;
  previewRow.value = list[idx - 1];
};
const handleQuickPreviewNext = () => {
  const list = props.data || [];
  const idx = quickPreviewIndex.value;
  if (idx < 0 || idx >= list.length - 1) return;
  previewRow.value = list[idx + 1];
};

// Handle field updates from QuickPreviewDrawer
const handlePreviewUpdate = async (updateData) => {
  if (!previewRow.value?._id || !updateData.field) return;
  
  const { field, value, onSuccess } = updateData;
  const recordId = previewRow.value._id;
  
  try {
    // Determine API endpoint based on moduleKey (generic approach)
    // Use plural form of moduleKey for endpoint
    const moduleKeyPlural = props.moduleKey.endsWith('y') 
      ? props.moduleKey.slice(0, -1) + 'ies' // e.g., "people" from "person" (though people is already plural)
      : props.moduleKey.endsWith('s')
      ? props.moduleKey // Already plural
      : props.moduleKey + 's'; // Add 's' for plural
    
    const endpoint = `/${moduleKeyPlural}/${recordId}`;
    
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

// Saved View Management (works for all modules with savedViews prop)
const viewsStorageKey = computed(() => `${STORAGE_PREFIX}-${props.moduleKey}-saved-views`);
const systemViewIds = computed(() => {
  // Extract system view IDs from savedViews prop
  // System views are typically those with common IDs like 'all', 'assigned-to-me', etc.
  if (!props.savedViews || props.savedViews.length === 0) return [];
  
  // Common system view IDs across modules
  const commonSystemIds = ['all', 'assigned-to-me', 'my-people', 'my-organizations', 'my-tasks', 'unassigned', 'active', 'trial'];
  
  // Return IDs that match common system patterns or are explicitly marked as system views
  return props.savedViews
    .filter(view => {
      // Check if it's a common system view ID
      if (commonSystemIds.includes(view.id)) return true;
      // Check if view has a system flag (if added in future)
      return view.isSystem === true;
    })
    .map(view => view.id);
});

const isSystemView = (viewId) => {
  return systemViewIds.value.includes(viewId);
};

// Load custom saved views from localStorage
const loadCustomViews = () => {
  if (!props.savedViews || props.savedViews.length === 0) return [];
  
  try {
    const saved = localStorage.getItem(viewsStorageKey.value);
    if (saved) {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (error) {
    console.warn('[ListView] Failed to load custom views:', error);
  }
  return [];
};

// Save custom views to localStorage
const saveCustomViews = (views) => {
  if (!props.savedViews || props.savedViews.length === 0) return;
  
  try {
    // Only save custom views (not system views)
    const customViews = views.filter(v => !isSystemView(v.id));
    localStorage.setItem(viewsStorageKey.value, JSON.stringify(customViews));
  } catch (error) {
    console.warn('[ListView] Failed to save custom views:', error);
  }
};

// Get current view configuration (filters, columns, sort, search)
const getCurrentViewConfig = () => {
  return {
    filters: { ...filters },
    search: searchQuery.value,
    sort: {
      field: props.sortField,
      order: props.sortOrder
    },
    columns: visibleColumns.value.map(col => ({
      key: col.key,
      visible: col.visible,
      width: col.width,
      order: col.order
    }))
  };
};

// STEP 1: Normalize state - PURE FUNCTION
// Extracts canonical view state (filters, sort, columns) for comparison
// Explicitly EXCLUDES: pagination, selection, scroll, loading
const normalizePeopleViewState = (state) => {
  // Extract filters - normalize empty strings and undefined to consistent representation
  const normalizedFilters = {};
  Object.keys(state.filters || {}).forEach(key => {
    const value = state.filters[key];
    // Only include filters with meaningful values (null is valid, undefined/'' are not)
    if (value !== undefined && value !== '') {
      normalizedFilters[key] = value === null ? null : String(value);
    }
  });
  
  // Sort keys for consistent comparison
  const sortedFilterKeys = Object.keys(normalizedFilters).sort();
  const normalizedFiltersObj = {};
  sortedFilterKeys.forEach(key => {
    normalizedFiltersObj[key] = normalizedFilters[key];
  });
  
  // Extract sort - normalize field and order
  const normalizedSort = {
    field: String(state.sortField || 'createdAt'),
    order: String(state.sortOrder || 'desc')
  };
  
  // Extract visible columns - normalize visible state and order
  const normalizedColumns = (state.columns || [])
    .filter(col => col.visible !== false) // Only visible columns
    .map(col => ({
      key: String(col.key || ''),
      visible: col.visible !== false,
      order: typeof col.order === 'number' ? col.order : 999
    }))
    .sort((a, b) => a.order - b.order) // Sort by order
    .map(col => col.key); // Return just keys for comparison
  
  return {
    filters: normalizedFiltersObj,
    sort: normalizedSort,
    columns: normalizedColumns
  };
};

// STEP 2: Match state against saved views - PURE FUNCTION
// Compares normalized state with saved views without any side effects
const doesStateMatchAnySavedView = (normalizedState, savedViews, currentUserId) => {
  if (!savedViews || savedViews.length === 0) return false;
  
  // Helper to normalize filters for comparison (handles 'me' and 'unassigned' values)
  const normalizeFilterValue = (key, value, userId) => {
    if (key === 'assignedTo') {
      // Normalize 'me' to userId and 'unassigned' to null for comparison
      if (value === 'me' && userId) return userId;
      if (value === 'unassigned') return null;
      if (value === userId && userId) return userId;
      return value === null ? null : String(value);
    }
    return value === null ? null : String(value);
  };
  
  // Helper to compare filters
  const filtersMatch = (currentFilters, viewFilters, userId) => {
    const currentKeys = Object.keys(currentFilters).sort();
    const viewKeys = Object.keys(viewFilters || {}).filter(k => {
      const v = viewFilters[k];
      return v !== undefined && v !== '';
    }).sort();
    
    if (currentKeys.length !== viewKeys.length) return false;
    
    for (let i = 0; i < currentKeys.length; i++) {
      if (currentKeys[i] !== viewKeys[i]) return false;
      
      const key = currentKeys[i];
      const currentValue = normalizeFilterValue(key, currentFilters[key], userId);
      const viewValue = normalizeFilterValue(key, viewFilters[key], userId);
      
      // Compare normalized values
      if (currentValue !== viewValue) {
        return false;
      }
    }
    
    return true;
  };
  
  // Compare against each saved view
  for (const view of savedViews) {
    // Check if view has explicit config (means it was saved with full config including columns/sort)
    const hasExplicitConfig = !!view.config;
    
    // Get config from view (may be in view.config or view directly for backward compat)
    const viewConfig = view.config || {
      filters: view.filters || {},
      sort: view.sort || { field: 'createdAt', order: 'desc' },
      columns: view.columns || []
    };
    
    // Normalize view filters for comparison
    const viewFilters = viewConfig.filters || {};
    
    // Compare filters (always required)
    const normalizedViewFilters = normalizePeopleViewState({
      filters: viewFilters,
      sortField: 'createdAt', // dummy values for filter normalization
      sortOrder: 'desc',
      columns: []
    }).filters;
    
    if (!filtersMatch(normalizedState.filters, normalizedViewFilters, currentUserId)) {
      continue;
    }
    
    // If view has explicit config, also compare sort and columns
    // System views without explicit config only need filters to match
    if (hasExplicitConfig) {
      // Normalize view state for full comparison
      const normalizedViewState = normalizePeopleViewState({
        filters: viewFilters,
        sortField: viewConfig.sort?.field || 'createdAt',
        sortOrder: viewConfig.sort?.order || 'desc',
        columns: viewConfig.columns || []
      });
      
      // Compare sort
      if (normalizedState.sort.field !== normalizedViewState.sort.field ||
          normalizedState.sort.order !== normalizedViewState.sort.order) {
        continue;
      }
      
      // Compare columns (order and visibility)
      if (normalizedState.columns.length !== normalizedViewState.columns.length) {
        continue;
      }
      
      // Check column keys match (order already normalized)
      const columnsMatch = normalizedState.columns.every((key, index) => 
        key === normalizedViewState.columns[index]
      );
      
      if (!columnsMatch) {
        continue;
      }
    }
    
    // All required components match!
    return true;
  }
  
  return false;
};

// Apply view configuration (filters, columns, sort, search)
const applyViewConfig = (config) => {
  // Apply filters
  if (config.filters) {
    Object.keys(filters).forEach(key => {
      delete filters[key];
    });
    Object.keys(config.filters).forEach(key => {
      filters[key] = config.filters[key];
    });
    emit('update:filters', { ...filters });
  }
  
  // Apply search
  if (config.search !== undefined) {
    searchQuery.value = config.search;
    emit('update:searchQuery', config.search);
  }
  
  // Apply sort
  if (config.sort) {
    emit('update:sort', {
      sortField: config.sort.field,
      sortOrder: config.sort.order
    });
  }
  
  // Apply columns
  if (config.columns && Array.isArray(config.columns)) {
    // Restore column visibility and order from saved view
    const columnMap = new Map(config.columns.map(col => [col.key, col]));
    visibleColumns.value.forEach(col => {
      const saved = columnMap.get(col.key);
      if (saved) {
        col.visible = saved.visible !== false;
        if (saved.width) col.width = saved.width;
        if (saved.order !== undefined) col.order = saved.order;
      }
    });
    // Sort by saved order
    visibleColumns.value.sort((a, b) => {
      const aOrder = columnMap.get(a.key)?.order ?? 999;
      const bOrder = columnMap.get(b.key)?.order ?? 999;
      return aOrder - bOrder;
    });
  }
};

// Handle save current view
const handleSaveCurrentView = () => {
  if (!props.savedViews || props.savedViews.length === 0) return;
  
  editingView.value = null;
  viewFormData.value = { name: '', description: '' };
  showSaveViewModal.value = true;
};

// Handle edit view
const handleEditView = (view) => {
  if (!props.savedViews || props.savedViews.length === 0 || isSystemView(view.id)) return;
  
  editingView.value = view;
  viewFormData.value = {
    name: view.label || '',
    description: view.description || ''
  };
  showSaveViewModal.value = true;
};

// Handle delete view
const handleDeleteView = (view) => {
  if (!props.savedViews || props.savedViews.length === 0 || isSystemView(view.id)) return;
  
  viewToDelete.value = view;
  showDeleteViewModal.value = true;
};

// Save or update view
const handleSaveView = () => {
  if (!props.savedViews || props.savedViews.length === 0 || !viewFormData.value.name.trim()) return;
  
  const currentConfig = getCurrentViewConfig();
  const customViews = loadCustomViews();
  let savedView = null;
  
  if (editingView.value) {
    // Update existing view
    const index = customViews.findIndex(v => v.id === editingView.value.id);
    if (index !== -1) {
      savedView = {
        ...customViews[index],
        label: viewFormData.value.name.trim(),
        description: viewFormData.value.description.trim() || undefined,
        config: currentConfig,
        updatedAt: new Date().toISOString()
      };
      customViews[index] = savedView;
    }
  } else {
    // Create new view
    savedView = {
      id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      label: viewFormData.value.name.trim(),
      description: viewFormData.value.description.trim() || undefined,
      filters: currentConfig.filters,
      config: currentConfig,
      createdAt: new Date().toISOString()
    };
    customViews.push(savedView);
  }
  
  saveCustomViews(customViews);
  emit('saved-views-updated', customViews);
  
  // Activate the saved view so the title reflects it immediately
  if (savedView) {
    emit('saved-view-selected', savedView);
  }
  
  handleCloseSaveViewModal();
};

// Confirm delete view
const confirmDeleteView = () => {
  if (!props.savedViews || props.savedViews.length === 0 || !viewToDelete.value || isSystemView(viewToDelete.value.id)) return;
  
  const customViews = loadCustomViews();
  const filtered = customViews.filter(v => v.id !== viewToDelete.value.id);
  saveCustomViews(filtered);
  emit('saved-views-updated', filtered);
  
  // If deleted view was active, clear it
  if (props.activeSavedViewId === viewToDelete.value.id) {
    emit('saved-view-selected', null);
  }
  
  handleCloseDeleteViewModal();
};

// Close save view modal
const handleCloseSaveViewModal = () => {
  showSaveViewModal.value = false;
  editingView.value = null;
  viewFormData.value = { name: '', description: '' };
};

// Close delete view modal
const handleCloseDeleteViewModal = () => {
  showDeleteViewModal.value = false;
  viewToDelete.value = null;
};

// Handle saved view click - apply full config
const handleSavedViewClick = (view) => {
  // Emit event to parent first - ModuleList will handle filter application and data fetching
  // This ensures consistent behavior between ListView and ModuleList
  emit('saved-view-selected', view);
};

// Handle set as default - mark view as default and switch to it
const handleSetDefaultView = (view) => {
  emit('set-default-view', view.id);
  emit('saved-view-selected', view);
};
</script>
