<template>
  <div class="w-full relative">
    <!-- Select All Across Pages Banner -->
    <Transition name="slide-down">
      <div v-if="selectable && showSelectAllBanner" class="mb-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl px-6 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <svg class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p class="text-sm font-medium text-blue-900 dark:text-blue-100">
              All {{ displayData.length }} items on this page are selected.
            </p>
          </div>
          <div class="flex items-center gap-3">
            <button
              @click="selectAllAcrossPages"
              class="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline transition-colors"
            >
              Select all {{ totalRecords || data.length }} items
            </button>
            <button
              @click="clearSelection"
              class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              Clear selection
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Bulk Actions Floating Bar -->
    <Transition name="slide-up">
      <div v-if="selectable && selectedRows.length > 0" class="bulk-actions-bar">
        <div class="bg-brand-600 dark:bg-brand-700 text-white px-6 py-4 rounded-xl shadow-2xl border-2 border-brand-700 dark:border-brand-800">
          <div class="flex items-center gap-6">
            <!-- Selection Count -->
            <div class="flex items-center gap-2">
              <div class="bg-white/20 px-3 py-1.5 rounded-lg font-semibold">
                <span v-if="selectAllPages">
                  All {{ totalRecords || data.length }} selected
                </span>
                <span v-else>
                  {{ selectedRows.length }} selected
                </span>
              </div>
              <button
                @click="clearSelection"
                class="p-2 hover:bg-white/20 rounded-lg transition-all"
                title="Clear selection"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <!-- Divider -->
            <div class="h-8 w-px bg-white/30"></div>

            <!-- Mass Actions -->
            <div class="flex items-center gap-2">
              <!-- Custom Mass Actions -->
              <button
                v-for="action in massActions"
                :key="action.action"
                @click="handleBulkAction(action.action)"
                :class="[
                  'px-4 py-2 rounded-lg font-medium transition-all hover:scale-105 flex items-center gap-2',
                  action.variant === 'danger' ? 'bg-red-500 hover:bg-red-600' :
                  action.variant === 'success' ? 'bg-green-500 hover:bg-green-600' :
                  action.variant === 'warning' ? 'bg-yellow-500 hover:bg-yellow-600' :
                  'bg-white/20 hover:bg-white/30'
                ]"
              >
                <svg v-if="action.icon === 'trash'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0 0 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16" />
                </svg>
                <svg v-else-if="action.icon === 'edit'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <svg v-else-if="action.icon === 'export'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <svg v-else-if="action.icon === 'archive'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                {{ action.label }}
              </button>

              <!-- Default Delete Action (if no custom actions) -->
              <button
                v-if="massActions.length === 0"
                @click="handleBulkAction('delete')"
                class="px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg font-medium transition-all hover:scale-105 flex items-center gap-2"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0 0 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16" />
                </svg>
                Delete Selected
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Table Controls -->
    <div v-if="showControls" class="flex items-center justify-between mb-6 gap-4 flex-wrap">
      <!-- Search -->
      <div v-if="searchable" class="relative flex-1 min-w-[280px] max-w-md">
        <svg class="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="searchPlaceholder"
          class="w-full pl-11 pr-4 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:focus:ring-brand-600 transition-all shadow-sm"
          @input="handleSearch"
        />
      </div>

      <!-- Actions Slot -->
      <div class="flex items-center gap-3">
        <slot name="actions"></slot>
      </div>
    </div>

    <!-- Column Settings Button (Always visible when enabled) -->
    <div v-if="columnSettings" class="flex justify-end mb-4">
      <button
        @click="showColumnSettings = !showColumnSettings"
        class="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500 transition-all shadow-sm"
        title="Column Settings"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
        <span>Columns</span>
      </button>
    </div>

    <!-- Column Settings Modal -->
    <Teleport to="body">
      <Transition name="modal">
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
              <div>
                <div class="flex items-center justify-between mb-4">
                  <div>
                    <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Manage Columns</h4>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Toggle visibility and drag to reorder</p>
                  </div>
                  <div class="text-xs text-gray-500 dark:text-gray-400">
                    {{ visibleColumns.length }} of {{ columns.length }} visible
                  </div>
                </div>
                
                <div class="space-y-2">
                  <div
                    v-for="(column, index) in orderedColumns"
                    :key="column.key"
                    :draggable="true"
                    @dragstart="handleDragStart(index)"
                    @dragover.prevent
                    @drop="handleDrop(index)"
                    class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                    :class="{ 'opacity-50': draggedIndex === index }"
                  >
                    <!-- Drag Handle -->
                    <svg class="w-5 h-5 text-gray-400 dark:text-gray-500 cursor-move flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16" />
                    </svg>
                    
                    <!-- Visibility Checkbox -->
                    <input
                      type="checkbox"
                      :checked="isColumnVisible(column.key)"
                      @change="toggleColumnVisibility(column.key)"
                      @click.stop
                      class="w-4 h-4 text-brand-600 dark:text-brand-500 border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 cursor-pointer flex-shrink-0"
                    />
                    
                    <!-- Column Label -->
                    <span class="text-sm font-medium text-gray-900 dark:text-white flex-1">
                      {{ column.label }}
                    </span>
                    
                    <!-- Freeze Button -->
                    <button
                      @click.stop="toggleColumnFreeze(column.key)"
                      :disabled="!isColumnFrozen(column.key) && frozenColumns.length >= 2"
                      :class="[
                        'p-1.5 rounded-lg transition-all flex-shrink-0',
                        isColumnFrozen(column.key)
                          ? 'text-brand-600 dark:text-brand-400 bg-brand-100 dark:bg-brand-900/30'
                          : 'text-gray-400 dark:text-gray-500 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20',
                        !isColumnFrozen(column.key) && frozenColumns.length >= 2 ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                      ]"
                      :title="isColumnFrozen(column.key) ? 'Unfreeze column' : frozenColumns.length >= 2 ? 'Maximum 2 columns can be frozen' : 'Freeze column'"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                      </svg>
                    </button>
                    
                    <!-- Hidden Badge -->
                    <span
                      v-if="!isColumnVisible(column.key)"
                      class="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-full flex-shrink-0"
                    >
                      Hidden
                    </span>
                    
                    <!-- Frozen Badge -->
                    <span
                      v-if="isColumnFrozen(column.key)"
                      class="text-xs px-2 py-1 bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 rounded-full flex-shrink-0"
                    >
                      Frozen
                    </span>
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
                  class="px-4 py-2 text-sm font-medium text-white bg-brand-600 dark:bg-brand-700 hover:bg-brand-700 dark:hover:bg-brand-800 rounded-lg transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Table Wrapper -->
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
      <!-- Table Container with Horizontal Scroll -->
      <div class="overflow-x-auto">
      <!-- Loading State -->
      <div v-if="loading" class="flex flex-col items-center justify-center py-16">
        <div class="animate-spin rounded-full h-14 w-14 border-4 border-gray-200 dark:border-gray-700 border-t-brand-600 dark:border-t-brand-500"></div>
        <p class="mt-5 text-base font-medium text-gray-600 dark:text-gray-400">{{ loadingText }}</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="!data || data.length === 0" class="flex flex-col items-center justify-center py-16 px-4">
        <slot name="empty">
          <svg class="w-20 h-20 text-gray-300 dark:text-gray-600 mb-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">{{ emptyTitle }}</h3>
          <p class="text-base text-gray-500 dark:text-gray-400 text-center max-w-md">{{ emptyMessage }}</p>
        </slot>
      </div>

      <!-- Data Table -->
      <table v-else class="w-full min-w-full" :class="{ 'table-fixed': resizable }">
        <thead class="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 border-b-2 border-gray-200 dark:border-gray-600">
          <tr>
            <!-- Selection Column (Always Frozen) -->
            <th 
              v-if="selectable" 
              class="sticky-selection-header w-14 px-4 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800"
            >
              <input
                type="checkbox"
                :checked="allSelected"
                @change="toggleSelectAll"
                class="w-4 h-4 text-brand-600 dark:text-brand-500 border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 cursor-pointer transition-all"
              />
            </th>

            <!-- Data Columns -->
            <th
              v-for="column in visibleColumns"
              :key="column.key"
              :class="[
                'px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider hover:bg-gray-100 dark:hover:bg-gray-700 whitespace-nowrap relative',
                column.headerClass,
                isColumnFrozen(column.key) ? 'frozen-column-header bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800' : ''
              ]"
              @click="column.sortable !== false ? handleSort(column.key) : null"
              :title="column.sortable !== false ? getSortTitle(column.key) : ''"
              :style="{ 
                cursor: column.sortable !== false ? 'pointer' : 'default', 
                width: columnWidths[column.key] || column.width || 'auto',
                minWidth: column.minWidth || 'auto', 
                maxWidth: column.maxWidth || 'none',
                ...(isColumnFrozen(column.key) ? { left: getFrozenColumnOffset(column.key) } : {})
              }"
            >
              <div class="flex items-center gap-2 select-none group">
                <span>{{ column.label }}</span>
                
                <!-- Sort Icon -->
                <span v-if="column.sortable !== false" class="flex items-center ml-auto">
                  <!-- Active sort -->
                  <span v-if="sortBy === column.key" class="text-brand-600 dark:text-brand-500">
                    <svg v-if="sortOrder === 'asc'" class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" />
                    </svg>
                    <svg v-else class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                    </svg>
                  </span>
                  
                  <!-- Sortable indicator (inactive) -->
                  <span v-else class="text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                  </span>
                </span>
              </div>
              
              <!-- Resize Handle -->
              <div
                v-if="resizable && column.resizable !== false"
                @mousedown.prevent="startResize($event, column.key)"
                class="resize-handle"
              >
                <div class="resize-line"></div>
              </div>
            </th>
            
            <!-- Actions Column Header (Hidden) -->
            <th v-if="hasActions" class="actions-cell-header"></th>
          </tr>
        </thead>

        <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
          <tr
            v-for="(row, index) in displayData"
            :key="getRowKey(row, index)"
            :class="[
              'hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-150 cursor-pointer group',
              isSelected(row) ? 'bg-brand-50 dark:bg-brand-900/30 hover:bg-brand-100 dark:hover:bg-brand-900/40' : '',
              rowClass
            ]"
            @click="handleRowClick(row)"
          >
            <!-- Selection Column (Always Frozen) -->
            <td 
              v-if="selectable" 
              class="sticky-selection-cell px-4 py-4 text-sm text-gray-900 dark:text-white bg-inherit"
              :class="{
                'bg-white dark:bg-gray-800': !isSelected(row),
                'bg-brand-50 dark:bg-brand-900/30': isSelected(row)
              }"
            >
              <input
                type="checkbox"
                :checked="isSelected(row)"
                @change="toggleSelect(row)"
                @click.stop
                class="w-4 h-4 text-brand-600 dark:text-brand-500 border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 cursor-pointer transition-all"
              />
            </td>

            <!-- Data Columns -->
            <td
              v-for="(column, colIndex) in visibleColumns"
              :key="column.key"
              :class="[
                'px-6 py-4 text-sm text-gray-900 dark:text-white table-cell-truncate',
                column.cellClass,
                isColumnFrozen(column.key) ? 'frozen-column-cell' : '',
                isColumnFrozen(column.key) && !isSelected(row) ? 'bg-white dark:bg-gray-800' : '',
                isColumnFrozen(column.key) && isSelected(row) ? 'bg-brand-50 dark:bg-brand-900/30' : ''
              ]"
              :style="{ 
                width: columnWidths[column.key] || column.width || 'auto',
                minWidth: column.minWidth || 'auto', 
                maxWidth: column.maxWidth || 'none',
                ...(isColumnFrozen(column.key) ? { left: getFrozenColumnOffset(column.key) } : {})
              }"
              :title="getCellDisplayValue(row, column)"
            >
              <slot :name="`cell-${column.key}`" :row="row" :value="getCellValue(row, column.key)">
                <component
                  v-if="column.component"
                  :is="column.component"
                  :value="getCellValue(row, column.key)"
                  :row="row"
                />
                <span v-else-if="column.format" class="block truncate">
                  {{ column.format(getCellValue(row, column.key), row) }}
                </span>
                <span v-else class="block truncate">
                  {{ getCellValue(row, column.key) }}
                </span>
              </slot>
            </td>

            <!-- Sticky Actions Cell -->
            <td 
              v-if="hasActions" 
              class="actions-cell"
              @click.stop
            >
              <div class="actions-container">
                <slot name="actions" :row="row">
                  <button
                    v-if="!hideEdit"
                    @click.stop="$emit('edit', row)"
                    class="p-2 rounded-lg transition-all duration-200 hover:scale-110 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
                    title="Edit"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    v-if="!hideDelete"
                    @click.stop="$emit('delete', row)"
                    class="p-2 rounded-lg transition-all duration-200 hover:scale-110 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
                    title="Delete"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </slot>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="paginated && !loading && data && data.length > 0" class="flex items-center justify-between mt-6 px-6 py-4 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
      <div class="text-sm font-medium text-gray-700 dark:text-gray-300">
        <span>
          Showing {{ startRecord }} to {{ endRecord }} of {{ totalRecords }} results
        </span>
      </div>
      
      <div class="flex items-center gap-2">
        <button
          @click="previousPage"
          :disabled="currentPage === 1"
          class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 hover:border-gray-400 dark:hover:border-gray-500 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white dark:disabled:hover:bg-gray-700 transition-all shadow-sm hover:shadow-md hover:scale-105"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          Previous
        </button>

        <div class="flex items-center gap-1">
          <button
            v-for="page in visiblePages"
            :key="page"
            @click="goToPage(page)"
            :class="[
              'min-w-[40px] px-3 py-2 text-sm font-medium rounded-lg transition-all shadow-sm',
              page === currentPage
                ? 'bg-gradient-to-r from-brand-600 to-brand-700 text-white border-brand-600 hover:from-brand-700 hover:to-brand-800 shadow-md'
                : 'text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-md hover:scale-105'
            ]"
          >
            {{ page }}
          </button>
        </div>

        <button
          @click="nextPage"
          :disabled="currentPage === totalPages"
          class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 hover:border-gray-400 dark:hover:border-gray-500 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white dark:disabled:hover:bg-gray-700 transition-all shadow-sm hover:shadow-md hover:scale-105"
        >
          Next
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  // Data
  data: {
    type: Array,
    default: () => []
  },
  columns: {
    type: Array,
    required: true
  },
  rowKey: {
    type: [String, Function],
    default: 'id'
  },
  
  // Features
  searchable: {
    type: Boolean,
    default: false
  },
  sortable: {
    type: Boolean,
    default: true
  },
  serverSide: {
    type: Boolean,
    default: false
  },
  paginated: {
    type: Boolean,
    default: true
  },
  selectable: {
    type: Boolean,
    default: false
  },
  resizable: {
    type: Boolean,
    default: false
  },
  persistWidths: {
    type: Boolean,
    default: true
  },
  tableId: {
    type: String,
    default: 'datatable'
  },
  
  // Pagination
  perPage: {
    type: Number,
    default: 10
  },
  totalRecords: {
    type: Number,
    default: 0
  },
  
  // Actions
  hasActions: {
    type: Boolean,
    default: true
  },
  hideEdit: {
    type: Boolean,
    default: false
  },
  hideDelete: {
    type: Boolean,
    default: false
  },
  
  // Mass Actions
  massActions: {
    type: Array,
    default: () => []
    // Example: [{ label: 'Delete', icon: 'trash', action: 'bulk-delete', variant: 'danger' }]
  },
  
  // States
  loading: {
    type: Boolean,
    default: false
  },
  
  // Customization
  searchPlaceholder: {
    type: String,
    default: 'Search...'
  },
  emptyTitle: {
    type: String,
    default: 'No data found'
  },
  emptyMessage: {
    type: String,
    default: 'Get started by adding your first item'
  },
  loadingText: {
    type: String,
    default: 'Loading...'
  },
  rowClass: {
    type: [String, Function],
    default: ''
  },
  showControls: {
    type: Boolean,
    default: true
  },
  columnSettings: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['row-click', 'edit', 'delete', 'select', 'sort', 'search', 'page-change', 'bulk-action']);

// Internal state
const searchQuery = ref('');
const sortBy = ref('');
const sortOrder = ref('asc');
const currentPage = ref(1);
const selectedRows = ref([]);
const selectAllPages = ref(false);

// Column resizing state
const columnWidths = ref({});
const resizing = ref(null);

// Column settings state
const showColumnSettings = ref(false);
const hiddenColumns = ref([]);
const columnOrder = ref([]);
const frozenColumns = ref([]);
const draggedIndex = ref(null);

// Load saved settings from localStorage
onMounted(() => {
  if (props.persistWidths && props.resizable) {
    const saved = localStorage.getItem(`datatable-${props.tableId}-widths`);
    if (saved) {
      try {
        columnWidths.value = JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved column widths:', e);
      }
    }
  }
  
  if (props.columnSettings) {
    const savedHidden = localStorage.getItem(`datatable-${props.tableId}-hidden`);
    const savedOrder = localStorage.getItem(`datatable-${props.tableId}-order`);
    const savedFrozen = localStorage.getItem(`datatable-${props.tableId}-frozen`);
    
    if (savedHidden) {
      try {
        hiddenColumns.value = JSON.parse(savedHidden);
      } catch (e) {
        console.error('Failed to parse saved hidden columns:', e);
      }
    }
    
    if (savedOrder) {
      try {
        columnOrder.value = JSON.parse(savedOrder);
      } catch (e) {
        console.error('Failed to parse saved column order:', e);
        columnOrder.value = props.columns.map(col => col.key);
      }
    } else {
      columnOrder.value = props.columns.map(col => col.key);
    }
    
    if (savedFrozen) {
      try {
        frozenColumns.value = JSON.parse(savedFrozen);
        console.log('Loaded frozen columns:', frozenColumns.value);
      } catch (e) {
        console.error('Failed to parse saved frozen columns:', e);
      }
    } else {
      console.log('No saved frozen columns found');
    }
  }
  
  // Load saved sort state
  if (props.sortable && props.tableId) {
    const savedSort = localStorage.getItem(`datatable-${props.tableId}-sort`);
    if (savedSort) {
      try {
        const { by, order } = JSON.parse(savedSort);
        sortBy.value = by;
        sortOrder.value = order;
        console.log('Loaded sort state in DataTable:', { by, order });
      } catch (e) {
        console.error('Failed to parse saved sort state:', e);
      }
    }
  }
});

// Save column widths to localStorage
const saveColumnWidths = () => {
  if (props.persistWidths && props.resizable) {
    localStorage.setItem(`datatable-${props.tableId}-widths`, JSON.stringify(columnWidths.value));
  }
};

// Column resize handlers
const startResize = (event, columnKey) => {
  event.preventDefault();
  event.stopPropagation();
  
  // Find the th element
  const th = event.target.closest('th');
  if (!th) {
    console.error('Could not find th element');
    return;
  }
  
  const startX = event.clientX;
  const startWidth = th.offsetWidth;
  
  console.log(`Starting resize for ${columnKey}:`, { startX, startWidth });
  
  resizing.value = { columnKey, startX, startWidth };
  
  // Add event listeners
  document.addEventListener('mousemove', handleResize, { passive: false });
  document.addEventListener('mouseup', stopResize);
  
  // Change cursor and disable selection
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
};

const handleResize = (event) => {
  if (!resizing.value) return;
  
  event.preventDefault();
  
  const { columnKey, startX, startWidth } = resizing.value;
  const diff = event.clientX - startX;
  const newWidth = Math.max(100, startWidth + diff); // Minimum width of 100px
  
  console.log(`Resizing ${columnKey}:`, { diff, newWidth });
  
  // Update the column width
  columnWidths.value = {
    ...columnWidths.value,
    [columnKey]: `${newWidth}px`
  };
};

const stopResize = () => {
  if (resizing.value) {
    console.log('Stopping resize, saving widths:', columnWidths.value);
    saveColumnWidths();
    resizing.value = null;
  }
  
  // Remove event listeners
  document.removeEventListener('mousemove', handleResize);
  document.removeEventListener('mouseup', stopResize);
  
  // Restore cursor and selection
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
};

// Cleanup on unmount
onUnmounted(() => {
  document.removeEventListener('mousemove', handleResize);
  document.removeEventListener('mouseup', stopResize);
});

// Computed
const orderedColumns = computed(() => {
  if (!props.columnSettings || columnOrder.value.length === 0) {
    return props.columns;
  }
  
  // Create a map for quick lookup
  const columnMap = {};
  props.columns.forEach(col => {
    columnMap[col.key] = col;
  });
  
  // Order columns based on columnOrder, filter out any that don't exist
  const ordered = columnOrder.value
    .map(key => columnMap[key])
    .filter(col => col !== undefined);
  
  // Add any new columns that aren't in the order array
  props.columns.forEach(col => {
    if (!columnOrder.value.includes(col.key)) {
      ordered.push(col);
    }
  });
  
  return ordered;
});

const visibleColumns = computed(() => {
  if (!props.columnSettings) {
    return orderedColumns.value;
  }
  
  return orderedColumns.value.filter(col => !hiddenColumns.value.includes(col.key));
});

const displayData = computed(() => {
  let result = props.data || [];
  
  // Client-side search
  if (props.searchable && searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(row => {
      return visibleColumns.value.some(column => {
        const value = getCellValue(row, column.key);
        return String(value).toLowerCase().includes(query);
      });
    });
  }
  
  // Client-side sort (only if not using server-side sorting)
  if (props.sortable && !props.serverSide && sortBy.value) {
    console.log('Client-side sorting by:', sortBy.value, 'order:', sortOrder.value);
    console.log('Number of records before sort:', result.length);
    
    result = [...result].sort((a, b) => {
      // Find the column definition to check for custom sortValue
      const column = visibleColumns.value.find(col => col.key === sortBy.value);
      
      let aVal, bVal;
      if (column?.sortValue) {
        // Use custom sort value (can be a function or field name)
        if (typeof column.sortValue === 'function') {
          aVal = column.sortValue(a);
          bVal = column.sortValue(b);
        } else {
          aVal = getCellValue(a, column.sortValue);
          bVal = getCellValue(b, column.sortValue);
        }
      } else {
        // Default: use the column key
        aVal = getCellValue(a, sortBy.value);
        bVal = getCellValue(b, sortBy.value);
      }
      
      // Handle null/undefined values
      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';
      
      // Convert to lowercase for case-insensitive string comparison
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      
      if (aVal < bVal) return sortOrder.value === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder.value === 'asc' ? 1 : -1;
      return 0;
    });
    
    console.log('Number of records after sort:', result.length);
    if (result.length > 0) {
      console.log('First record:', result[0]);
      console.log('Last record:', result[result.length - 1]);
    }
  } else if (props.serverSide && sortBy.value) {
    console.log('Server-side sorting - skipping client-side sort');
  }
  
  // Client-side pagination (only if not using server-side pagination)
  if (props.paginated && !props.serverSide) {
    const start = (currentPage.value - 1) * props.perPage;
    const end = start + props.perPage;
    result = result.slice(start, end);
  }
  
  return result;
});

const totalPages = computed(() => {
  const total = props.totalRecords || props.data?.length || 0;
  return Math.ceil(total / props.perPage);
});

const startRecord = computed(() => {
  return ((currentPage.value - 1) * props.perPage) + 1;
});

const endRecord = computed(() => {
  const end = currentPage.value * props.perPage;
  const total = props.totalRecords || props.data?.length || 0;
  return Math.min(end, total);
});

const visiblePages = computed(() => {
  const pages = [];
  const maxVisible = 5;
  let start = Math.max(1, currentPage.value - Math.floor(maxVisible / 2));
  let end = Math.min(totalPages.value, start + maxVisible - 1);
  
  if (end - start < maxVisible - 1) {
    start = Math.max(1, end - maxVisible + 1);
  }
  
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  
  return pages;
});

const allSelected = computed(() => {
  return displayData.value.length > 0 && 
         displayData.value.every(row => isSelected(row));
});

const showSelectAllBanner = computed(() => {
  return allSelected.value && 
         !selectAllPages.value && 
         props.paginated && 
         (props.totalRecords || props.data?.length || 0) > displayData.value.length;
});

// Methods
const getCellValue = (row, key) => {
  if (key.includes('.')) {
    return key.split('.').reduce((obj, k) => obj?.[k], row);
  }
  return row[key];
};

const getCellDisplayValue = (row, column) => {
  const value = getCellValue(row, column.key);
  if (column.format) {
    return column.format(value, row);
  }
  return value || '';
};

const getRowKey = (row, index) => {
  if (typeof props.rowKey === 'function') {
    return props.rowKey(row);
  }
  return row[props.rowKey] || index;
};

const getSortTitle = (key) => {
  if (sortBy.value === key) {
    if (sortOrder.value === 'asc') {
      return 'Click to sort descending';
    } else {
      return 'Click to clear sort';
    }
  }
  return 'Click to sort ascending';
};

const handleSort = (key) => {
  if (sortBy.value === key) {
    // Cycle through: asc → desc → no sort
    if (sortOrder.value === 'asc') {
      sortOrder.value = 'desc';
    } else if (sortOrder.value === 'desc') {
      // Clear sort
      sortBy.value = '';
      sortOrder.value = 'asc';
    }
  } else {
    // New column - start with ascending
    sortBy.value = key;
    sortOrder.value = 'asc';
  }
  emit('sort', { key: sortBy.value, order: sortOrder.value });
};

const handleSearch = () => {
  currentPage.value = 1;
  emit('search', searchQuery.value);
};

const handleRowClick = (row) => {
  emit('row-click', row);
};

const previousPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--;
    emit('page-change', currentPage.value);
  }
};

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
    emit('page-change', currentPage.value);
  }
};

const goToPage = (page) => {
  currentPage.value = page;
  emit('page-change', page);
};

const isSelected = (row) => {
  return selectedRows.value.some(selected => 
    getRowKey(selected, 0) === getRowKey(row, 0)
  );
};

const toggleSelect = (row) => {
  const index = selectedRows.value.findIndex(selected => 
    getRowKey(selected, 0) === getRowKey(row, 0)
  );
  
  if (index > -1) {
    selectedRows.value.splice(index, 1);
  } else {
    selectedRows.value.push(row);
  }
  
  emit('select', selectedRows.value);
};

const toggleSelectAll = () => {
  if (allSelected.value) {
    selectedRows.value = [];
    selectAllPages.value = false;
  } else {
    selectedRows.value = [...displayData.value];
    selectAllPages.value = false;
  }
  emit('select', selectedRows.value);
};

const selectAllAcrossPages = () => {
  selectAllPages.value = true;
  selectedRows.value = [...displayData.value]; // Keep current page selected for UI
  emit('select', selectedRows.value, true); // Pass flag indicating all pages selected
};

const handleBulkAction = (action) => {
  emit('bulk-action', {
    action: action,
    selectedRows: selectedRows.value,
    selectAllPages: selectAllPages.value,
    totalRecords: props.totalRecords || props.data?.length || 0
  });
};

const clearSelection = () => {
  selectedRows.value = [];
  selectAllPages.value = false;
  emit('select', []);
};

// Column settings methods
const isColumnVisible = (columnKey) => {
  return !hiddenColumns.value.includes(columnKey);
};

const toggleColumnVisibility = (columnKey) => {
  const index = hiddenColumns.value.indexOf(columnKey);
  if (index > -1) {
    hiddenColumns.value.splice(index, 1);
  } else {
    hiddenColumns.value.push(columnKey);
  }
};

const handleDragStart = (index) => {
  draggedIndex.value = index;
};

const handleDrop = (dropIndex) => {
  if (draggedIndex.value === null) return;
  
  const draggedColumn = columnOrder.value[draggedIndex.value];
  columnOrder.value.splice(draggedIndex.value, 1);
  columnOrder.value.splice(dropIndex, 0, draggedColumn);
  
  draggedIndex.value = null;
};

const isColumnFrozen = (columnKey) => {
  return frozenColumns.value.includes(columnKey);
};

const toggleColumnFreeze = (columnKey) => {
  const index = frozenColumns.value.indexOf(columnKey);
  if (index > -1) {
    frozenColumns.value.splice(index, 1);
  } else {
    if (frozenColumns.value.length < 2) {
      frozenColumns.value.push(columnKey);
    }
  }
  
  // Save immediately to localStorage
  if (props.tableId) {
    localStorage.setItem(`datatable-${props.tableId}-frozen`, JSON.stringify(frozenColumns.value));
    console.log('Saved frozen columns:', frozenColumns.value);
  }
};

// Calculate left offset for frozen columns
const getFrozenColumnOffset = (columnKey) => {
  let offset = 0;
  
  // Add selection column width (56px = w-14)
  if (props.selectable) {
    offset += 56;
  }
  
  // Add widths of previous frozen columns
  for (const col of visibleColumns.value) {
    if (col.key === columnKey) break;
    if (frozenColumns.value.includes(col.key)) {
      // Use saved width or default to 200px
      const width = columnWidths.value[col.key] || col.width || '200px';
      offset += parseInt(width) || 200;
    }
  }
  
  return `${offset}px`;
};

const applyColumnSettings = () => {
  // Save to localStorage
  if (props.columnSettings) {
    localStorage.setItem(`datatable-${props.tableId}-hidden`, JSON.stringify(hiddenColumns.value));
    localStorage.setItem(`datatable-${props.tableId}-order`, JSON.stringify(columnOrder.value));
    localStorage.setItem(`datatable-${props.tableId}-frozen`, JSON.stringify(frozenColumns.value));
  }
  showColumnSettings.value = false;
};

const resetColumnSettings = () => {
  hiddenColumns.value = [];
  columnOrder.value = props.columns.map(col => col.key);
  frozenColumns.value = [];
  sortBy.value = '';
  sortOrder.value = 'asc';
  
  // Clear from localStorage
  localStorage.removeItem(`datatable-${props.tableId}-hidden`);
  localStorage.removeItem(`datatable-${props.tableId}-order`);
  localStorage.removeItem(`datatable-${props.tableId}-frozen`);
  localStorage.removeItem(`datatable-${props.tableId}-sort`);
};

// Watch for data changes
watch(() => props.data, () => {
  currentPage.value = 1;
  selectAllPages.value = false;
});

// Watch for page changes - reset select all pages when navigating
watch(currentPage, () => {
  if (selectAllPages.value) {
    // Keep the flag but don't auto-select rows on new page
    // User can still perform bulk actions on all pages
  }
});

// Watch for sort changes and save to localStorage
watch([sortBy, sortOrder], ([newSortBy, newSortOrder]) => {
  if (props.sortable && props.tableId) {
    localStorage.setItem(
      `datatable-${props.tableId}-sort`, 
      JSON.stringify({ by: newSortBy, order: newSortOrder })
    );
    console.log('Saved sort state:', { by: newSortBy, order: newSortOrder });
  }
});
</script>

<style scoped>
/* Table Fixed Layout for Resizable Columns */
.table-fixed {
  table-layout: fixed !important;
}

/* Cell Text Truncation */
.table-cell-truncate {
  max-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.table-cell-truncate > * {
  max-width: 100%;
}

/* Frozen Selection Column */
.sticky-selection-header {
  position: sticky !important;
  left: 0;
  z-index: 30;
  box-shadow: 2px 0 4px -1px rgba(0, 0, 0, 0.1);
}

:global(.dark) .sticky-selection-header {
  box-shadow: 2px 0 4px -1px rgba(0, 0, 0, 0.3);
}

.sticky-selection-cell {
  position: sticky !important;
  left: 0;
  z-index: 30;
  box-shadow: 2px 0 4px -1px rgba(0, 0, 0, 0.1);
}

:global(.dark) .sticky-selection-cell {
  box-shadow: 2px 0 4px -1px rgba(0, 0, 0, 0.3);
}

/* Frozen Column Header */
.frozen-column-header {
  position: sticky !important;
  z-index: 25;
  box-shadow: 2px 0 4px -1px rgba(0, 0, 0, 0.1);
}

:global(.dark) .frozen-column-header {
  box-shadow: 2px 0 4px -1px rgba(0, 0, 0, 0.3);
}

/* Frozen Column Cell */
.frozen-column-cell {
  position: sticky !important;
  z-index: 20;
  box-shadow: 2px 0 4px -1px rgba(0, 0, 0, 0.1);
}

:global(.dark) .frozen-column-cell {
  box-shadow: 2px 0 4px -1px rgba(0, 0, 0, 0.3);
}

/* Sticky Actions Cell Header */
.actions-cell-header {
  position: sticky !important;
  right: 0;
  z-index: 21;
  width: 160px;
  min-width: 160px;
  padding: 1rem !important;
  border: none;
}

:global(.dark) .actions-cell-header {
  background: rgb(55, 65, 81);
  background: linear-gradient(to right, rgba(55, 65, 81, 0) 0%, rgb(55, 65, 81) 10%);
}

/* Sticky Actions Cell - Stays at viewport edge */
.actions-cell {
  position: sticky !important;
  right: 16px;
  z-index: 20;
  width: 160px;
  min-width: 160px;
  padding: 1rem !important;
  text-align: right;
  vertical-align: middle;
  background: transparent;
  transition: background 0.15s ease;
}

/* Show background on row hover
tr:hover .actions-cell {
} */

:global(.dark) tr:hover .actions-cell {
  background: rgb(31, 41, 55);
  background: linear-gradient(to right, rgba(31, 41, 55, 0) 0%, rgb(31, 41, 55) 10%);
}

/* Actions Container */
.actions-container {
  display: inline-flex;
  align-items: center;
  justify-content: end;
  gap: 8px;
  background: white;
  padding: 8px 12px;
  border-radius: 8px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  border: 1px solid rgb(229, 231, 235);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
  white-space: nowrap;
}

:global(.dark) .actions-container {
  background: rgb(31, 41, 55);
  border-color: rgb(55, 65, 81);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2);
}

/* Show actions on row hover */
tr:hover .actions-container {
  opacity: 1;
  pointer-events: auto;
}

/* Column Resize Handle */
.resize-handle {
  position: absolute;
  right: -8px;
  top: 0;
  bottom: 0;
  width: 16px;
  cursor: col-resize;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
}

.resize-handle:hover {
  background-color: rgba(96, 73, 231, 0.1);
}

.resize-line {
  width: 2px;
  height: 100%;
  background-color: transparent;
  transition: background-color 0.2s;
}

.resize-handle:hover .resize-line {
  background-color: rgb(96, 73, 231);
}

:global(.dark) .resize-handle:hover {
  background-color: rgba(96, 73, 231, 0.2);
}

:global(.dark) .resize-handle:hover .resize-line {
  background-color: rgb(112, 93, 255);
}

/* Bulk Actions Bar */
.bulk-actions-bar {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  max-width: 90vw;
}

/* Animations */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease;
}

.slide-up-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(20px);
}

.slide-up-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(20px);
}

/* Slide down animation for banner */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
}

.slide-down-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* Modal animation */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-active > div,
.modal-leave-active > div {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from > div,
.modal-leave-to > div {
  transform: scale(0.95) translateY(-20px);
}
</style>

<style scoped>
/* Smooth scrolling for horizontal overflow */
.overflow-x-auto {
  scrollbar-width: thin;
  scrollbar-color: rgba(156, 163, 175, 0.3) transparent;
}

.overflow-x-auto::-webkit-scrollbar {
  height: 8px;
}

.overflow-x-auto::-webkit-scrollbar-track {
  background: transparent;
}

.overflow-x-auto::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.3);
  border-radius: 4px;
}

.overflow-x-auto::-webkit-scrollbar-thumb:hover {
  background-color: rgba(156, 163, 175, 0.5);
}

/* Dark mode scrollbar */
.dark .overflow-x-auto {
  scrollbar-color: rgba(75, 85, 99, 0.5) transparent;
}

.dark .overflow-x-auto::-webkit-scrollbar-thumb {
  background-color: rgba(75, 85, 99, 0.5);
}

.dark .overflow-x-auto::-webkit-scrollbar-thumb:hover {
  background-color: rgba(75, 85, 99, 0.7);
}

/* Bulk Actions Floating Bar - Fixed at bottom-center */
.bulk-actions-bar {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  max-width: 90vw;
}

/* Slide up transition for bulk actions bar */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease;
}

.slide-up-enter-from {
  opacity: 0;
  transform: translate(-50%, 20px);
}

.slide-up-leave-to {
  opacity: 0;
  transform: translate(-50%, 20px);
}
</style>

