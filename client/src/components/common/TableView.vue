<template>
  <div class="-mx-4 -my-2 sm:-mx-6 lg:-mx-8">
    <div class="w-full py-2 align-middle">
      <div
        class="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900 overflow-hidden"
        :class="showEmptyOverlay ? 'relative z-[1] flex min-h-[320px] flex-col' : 'relative z-[1]'"
      >
        <!-- Empty overlay: fixed in the body band; horizontal scroll stays on the container below -->
        <div
          v-if="showEmptyOverlay"
          class="pointer-events-none absolute inset-x-0 z-[2] flex items-center justify-center px-6 py-10"
          style="top: 52px; bottom: 20px;"
        >
          <div class="pointer-events-auto">
            <slot name="empty">
              <div class="flex flex-col items-center justify-center py-8 text-center">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">{{ emptyTitle || t('common.listNoDataAvailable') }}</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400">{{ emptyMessage || t('common.listNoRecordsFound') }}</p>
              </div>
            </slot>
          </div>
        </div>
        <div
          ref="scrollContainerRef"
          class="relative table-scroll-container rounded-xl"
          :class="scrollContainerClass"
          :style="{ ...scrollContainerStyles, width: '100%', maxWidth: '100%', isolation: 'auto' }"
          @scroll="handleScroll"
        >
          <div
            v-if="isResizing && resizeGuideX !== null && resizeGuideBounds"
            class="pointer-events-none fixed z-[999] w-0.5 bg-indigo-500"
            :style="{
              left: `${resizeGuideX}px`,
              top: `${resizeGuideBounds.top}px`,
              height: `${resizeGuideBounds.bottom - resizeGuideBounds.top}px`
            }"
          />
          <table
            ref="tableRef"
            class="divide-y divide-gray-200 text-sm text-gray-900 dark:divide-white/15 dark:text-gray-200"
            :style="{ width: '100%', minWidth: tableMinWidth, display: 'table', tableLayout: 'fixed' }"
          >
            <colgroup>
              <col v-if="selectable" :style="{ width: selectionColumnWidthPx }" />
              <col
                v-for="column in displayColumns"
                :key="`${columnKey(column)}-col`"
                :style="columnColStyle(column)"
              />
              <!-- Absorbs slack when table is wider than sum(columns); keeps data cols fixed-width, row lines full-width -->
              <col v-if="hasFlexFillColumn" style="min-width: 0; width: auto" />
            </colgroup>
            <thead class="bg-white dark:bg-gray-900">
              <tr>
                <th
                  v-if="selectable"
                  scope="col"
                  :class="[
                    'relative box-border sticky border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-gray-200 after:content-[\'\'] dark:after:bg-gray-700',
                    selectionColumnVariant === 'numbered-hover' ? 'px-1' : 'px-7 sm:w-12 sm:px-6',
                    leftEdgeColumnIndex === 0 ? 'rounded-tl-xl' : '',
                    'hover:bg-gray-50 dark:hover:bg-gray-800'
                  ]"
                  :style="selectionHeaderCellStyle"
                >
                  <span
                    v-if="selectionColumnVariant === 'numbered-hover'"
                    class="sr-only"
                  >{{ t('common.tableRowSelectSr') }}</span>
                  <div class="absolute top-1/2 left-4 -mt-2">
                    <HeadlessCheckbox
                      :checked="allSelected"
                      :indeterminate="someSelected"
                      @change="toggleSelectAll"
                      @click.stop
                    />
                  </div>
                </th>
                <th
                  v-for="(column, columnIndex) in displayColumns"
                  :key="columnKey(column)"
                  scope="col"
                  :aria-sort="ariaSortForColumn(column)"
                  :class="[
                    'group sticky border-b border-gray-200 bg-white text-left text-xs font-semibold uppercase tracking-wide text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-white relative after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-gray-200 after:content-[\'\'] dark:after:bg-gray-700',
                    columnIndex === 0 ? 'title-column-cell z-15 sticky-column-border' : 'z-10',
                    // Apply border-radius only to columns at visible edges
                    (selectable ? columnIndex + 1 : columnIndex) === leftEdgeColumnIndex ? 'rounded-tl-xl' : '',
                    (selectable ? columnIndex + 1 : columnIndex) === rightEdgeColumnIndex ? 'rounded-tr-xl' : '',
                    // Add hover effect for sticky columns
                    'hover:bg-gray-50 dark:hover:bg-gray-800',
                    // Add shadow when scrolled
                    columnIndex === 0 && isScrolledHorizontally ? 'sticky-column-scrolled' : ''
                  ]"
                  :style="[{ top: headerTop }, columnHeaderStyle(column)]"
                >
                  <Menu v-if="isColumnSortable(column)" as="div" class="relative w-full">
                    <MenuButton
                      type="button"
                      class="group flex w-full items-center justify-between gap-2 px-5 py-3.5 text-left text-xs uppercase tracking-wide transition-colors focus:outline-none relative z-10"
                      :class="{
                        'cursor-pointer bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300': isColumnSorted(column),
                        'cursor-pointer text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800': !isColumnSorted(column)
                      }"
                    >
                      <span class="flex items-center gap-2 truncate">
                        <span class="truncate">{{ columnLabel(column) }}</span>
                        <span
                          class="relative flex items-center justify-center rounded-md p-1 transition-opacity cursor-pointer"
                          :class="{
                            'opacity-100 bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300': isColumnSorted(column),
                            'opacity-0 text-gray-400 group-hover:opacity-100 hover:bg-gray-200 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300': !isColumnSorted(column)
                          }"
                          role="button"
                          tabindex="-1"
                          :aria-label="t('common.tableToggleSort', { column: columnLabel(column) })"
                          @click.stop="toggleSort(column)"
                        >
                          <template v-if="isColumnSorted(column)">
                            <span class="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-1 text-[10px] font-semibold text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300">
                              <span>{{ sortOrderValue === 'asc' ? '↑' : '↓' }}</span>
                              <span>1</span>
                            </span>
                          </template>
                          <template v-else>
                            <ArrowsUpDownIcon class="h-3.5 w-3.5" />
                          </template>
                        </span>
                      </span>
                    </MenuButton>
                    <transition
                      enter-active-class="transition duration-100 ease-out"
                      enter-from-class="transform scale-95 opacity-0"
                      enter-to-class="transform scale-100 opacity-100"
                      leave-active-class="transition duration-75 ease-in"
                      leave-from-class="transform scale-100 opacity-100"
                      leave-to-class="transform scale-95 opacity-0"
                    >
                      <MenuItems
                        class="absolute left-0 z-[70] mt-2 w-52 origin-top-left rounded-lg border border-gray-200 bg-white py-1 shadow-lg focus:outline-none dark:border-gray-700 dark:bg-gray-800"
                      >
                        <MenuItem v-slot="{ active }">
                          <button
                            type="button"
                            class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-normal"
                            :class="active ? 'bg-gray-100 dark:bg-gray-700' : ''"
                            @click="applyExplicitSort(column, 'asc')"
                          >
                            <ChevronUpIcon class="h-4 w-4 text-gray-500 dark:text-gray-400" />
                            <span>{{ t('common.tableSortAscending') }}</span>
                            <CheckIcon
                              v-if="isColumnSorted(column) && sortOrderValue === 'asc'"
                              class="ml-auto h-4 w-4 flex-shrink-0 text-indigo-600 dark:text-indigo-400"
                            />
                          </button>
                        </MenuItem>
                        <MenuItem v-slot="{ active }">
                          <button
                            type="button"
                            class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-normal"
                            :class="active ? 'bg-gray-100 dark:bg-gray-700' : ''"
                            @click="applyExplicitSort(column, 'desc')"
                          >
                            <ChevronDownIcon class="h-4 w-4 text-gray-500 dark:text-gray-400" />
                            <span>{{ t('common.tableSortDescending') }}</span>
                            <CheckIcon
                              v-if="isColumnSorted(column) && sortOrderValue === 'desc'"
                              class="ml-auto h-4 w-4 flex-shrink-0 text-indigo-600 dark:text-indigo-400"
                            />
                          </button>
                        </MenuItem>
                        <MenuItem v-if="isColumnSorted(column)" v-slot="{ active }">
                          <button
                            type="button"
                            class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-normal"
                            :class="active ? 'bg-gray-100 dark:bg-gray-700' : ''"
                            @click="clearSort(column)"
                          >
                            <XMarkIcon class="h-4 w-4 text-gray-500 dark:text-gray-400" />
                            <span>{{ t('common.tableClearSort') }}</span>
                          </button>
                        </MenuItem>
                      </MenuItems>
                    </transition>
                  </Menu>
                  <span v-else class="block px-5 py-3.5 truncate">{{ columnLabel(column) }}</span>
                  <span
                    v-if="isColumnResizable(column)"
                    class="group/resize absolute top-0 right-0 z-20 h-full w-3 cursor-col-resize select-none flex items-center justify-center"
                    @mousedown.prevent.stop="startColumnResize(column, $event)"
                    aria-hidden="true"
                  >
                    <!-- <span class="pointer-events-none absolute right-[-2px] top-0 bottom-0 w-1.5 bg-indigo-500 opacity-0 transition-opacity group-hover/resize:opacity-100" /> -->
                  </span>
                </th>
                <th
                  v-if="hasFlexFillColumn"
                  scope="col"
                  aria-hidden="true"
                  class="relative sticky z-10 border-b border-gray-200 bg-white p-0 dark:border-gray-700 dark:bg-gray-900 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-gray-200 after:content-[\'\'] dark:after:bg-gray-700"
                  :style="{ top: headerTop }"
                />
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
              <template v-if="showDataRows">
                <tr
                  v-if="useVirtualScroll && virtualPaddingTop > 0"
                  aria-hidden="true"
                  class="border-0 pointer-events-none"
                >
                  <td
                    :colspan="tableBodyColspan"
                    class="p-0 border-0"
                    :style="{ height: `${virtualPaddingTop}px` }"
                  />
                </tr>
                <tr
                  v-for="item in renderedRows"
                  :key="item.key"
                  :class="[
                    'group cursor-pointer',
                    item.selected ? 'bg-gray-50 dark:bg-indigo-950' : ''
                  ]"
                  @click="handleRowClick(item.row, $event)"
                >
                  <td
                    v-if="selectable"
                    :class="[
                      'relative box-border sticky z-20',
                      selectionColumnVariant === 'numbered-hover'
                        ? 'px-1 tv-num-when-hover'
                        : 'px-7 sm:w-12 sm:px-6',
                      rowHeightClass,
                      item.selected ? 'bg-gray-50 dark:bg-indigo-950' : 'bg-white dark:bg-gray-900',
                      item.selected ? '' : 'group-hover:bg-gray-100 dark:group-hover:bg-gray-800'
                    ]"
                    :style="selectionColumnCellStyle"
                  >
                    <div v-if="item.selected" class="hidden group-has-checked:block absolute inset-y-0 left-0 w-0.5 bg-indigo-600"></div>
                    <template v-if="selectionColumnVariant === 'numbered-hover'">
                      <span
                        class="tv-row-index pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-medium tabular-nums text-gray-500 dark:text-gray-400"
                        :class="item.selected ? 'opacity-0' : ''"
                        aria-hidden="true"
                      >{{ rowNumberOffset + item.rowIndex + 1 }}</span>
                      <div
                        class="tv-row-checkbox absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
                        :class="item.selected ? 'tv-row-checkbox--visible' : 'opacity-0'"
                      >
                        <HeadlessCheckbox
                          :checked="item.selected"
                          @change.stop="toggleRowSelection(item.row)"
                          @click.stop
                        />
                      </div>
                    </template>
                    <div v-else class="absolute top-1/2 left-4 -mt-2">
                      <HeadlessCheckbox
                        :checked="item.selected"
                        @change.stop="toggleRowSelection(item.row)"
                        @click.stop
                      />
                    </div>
                  </td>
                  <td
                    v-for="(column, columnIndex) in displayColumns"
                    :key="cellKey(column)"
                    :class="[
                      'px-5 text-sm text-gray-700 align-middle dark:text-gray-200',
                      rowHeightClass,
                      columnIndex === 0 ? [
                        'title-column-cell sticky z-20 sticky-column-border',
                        item.selected ? 'bg-gray-50 dark:bg-indigo-950' : 'bg-white dark:bg-gray-900',
                        item.selected ? '' : 'group-hover:bg-gray-100 dark:group-hover:bg-gray-800',
                        isScrolledHorizontally ? 'sticky-column-scrolled' : ''
                      ].join(' ') : [
                        'whitespace-nowrap',
                        item.selected ? 'bg-gray-50 dark:bg-indigo-950' : 'bg-white dark:bg-gray-900',
                        item.selected ? '' : 'group-hover:bg-gray-100 dark:group-hover:bg-gray-800'
                      ].join(' ')
                    ]"
                    :style="columnCellStyle(column)"
                  >
                    <!-- First column: actions overlay on hover — overlay anchors to <td> so its
                         inset-y-0 spans the full cell height (incl. padding), keeping h-8 buttons
                         vertically centered without being clipped by the cell's overflow:hidden. -->
                    <template v-if="columnIndex === 0 && hasActions">
                      <div class="flex items-center">
                        <div
                          class="min-w-0 flex-1 pr-0 transition-[padding-right] duration-150 ease-out group-hover:pr-28 group-focus-within:pr-28"
                        >
                          <slot
                            :name="`cell-${columnKey(column)}`"
                            :column="column"
                            :row="item.row"
                            :value="resolveValue(item.row, column)"
                          >
                            <slot name="cell" :column="column" :row="item.row" :value="resolveValue(item.row, column)">
                              {{ resolveValue(item.row, column) }}
                            </slot>
                          </slot>
                        </div>
                      </div>
                      <div
                        class="pointer-events-none absolute inset-y-0 right-0 z-10 flex items-center gap-0.5 pl-3 pr-5 opacity-0 transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
                        @click.stop
                      >
                        <slot name="actions" :row="item.row" />
                      </div>
                    </template>
                    <!-- Other columns: Normal rendering; first column content truncates -->
                    <template v-else>
                      <div v-if="columnIndex === 0" class="min-w-0 truncate">
                        <slot
                          :name="`cell-${columnKey(column)}`"
                          :column="column"
                          :row="item.row"
                          :value="resolveValue(item.row, column)"
                        >
                          <slot name="cell" :column="column" :row="item.row" :value="resolveValue(item.row, column)">
                            {{ resolveValue(item.row, column) }}
                          </slot>
                        </slot>
                      </div>
                      <div v-else class="min-w-0 truncate">
                        <slot
                          :name="`cell-${columnKey(column)}`"
                          :column="column"
                          :row="item.row"
                          :value="resolveValue(item.row, column)"
                        >
                          <slot name="cell" :column="column" :row="item.row" :value="resolveValue(item.row, column)">
                            {{ resolveValue(item.row, column) }}
                          </slot>
                        </slot>
                      </div>
                    </template>
                  </td>
                  <td
                    v-if="hasFlexFillColumn"
                    aria-hidden="true"
                    :class="[
                      'border-0 p-0 align-middle',
                      rowHeightClass,
                      item.selected ? 'bg-gray-50 dark:bg-indigo-950' : 'bg-white dark:bg-gray-900',
                      item.selected ? '' : 'group-hover:bg-gray-100 dark:group-hover:bg-gray-800'
                    ]"
                  />
                </tr>
                <tr
                  v-if="useVirtualScroll && virtualPaddingBottom > 0"
                  aria-hidden="true"
                  class="border-0 pointer-events-none"
                >
                  <td
                    :colspan="tableBodyColspan"
                    class="p-0 border-0"
                    :style="{ height: `${virtualPaddingBottom}px` }"
                  />
                </tr>
                <tr
                  v-if="loadMoreEnabled && effectiveHasMore"
                  class="border-0"
                >
                  <td
                    :colspan="tableBodyColspan"
                    class="p-0 border-0"
                  >
                    <div
                      ref="loadMoreSentinelRef"
                      class="h-4 w-full"
                      aria-hidden="true"
                    />
                    <div
                      v-if="loadingMore"
                      class="flex justify-center py-4 text-gray-500 dark:text-gray-400"
                    >
                      <span class="inline-flex h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    </div>
                  </td>
                </tr>
              </template>
              <template v-else-if="isLoading">
                <!-- Awaiting columns: one block so we don't flash numbered gutters or stray rows -->
                <tr v-if="displayColumns.length === 0" class="border-0">
                  <td :colspan="tableBodyColspan" class="border-0 px-5 py-10">
                    <div class="space-y-3" role="status" aria-live="polite" aria-busy="true">
                      <span class="sr-only">{{ t('common.tableLoadingSr') }}</span>
                      <div
                        v-for="n in loadingSkeletonRowCount"
                        :key="`sk-block-${n}`"
                        class="h-10 w-full rounded-lg bg-gray-100 animate-pulse dark:bg-gray-800/80"
                      />
                    </div>
                  </td>
                </tr>
                <template v-else>
                  <tr
                    v-for="n in loadingSkeletonRowCount"
                    :key="`sk-row-${n}`"
                    class="border-0"
                  >
                    <td
                      v-if="selectable"
                      :class="[
                        'relative box-border border-0 bg-white align-middle dark:bg-gray-900',
                        rowHeightClass,
                        selectionColumnVariant === 'numbered-hover'
                          ? 'px-1 tv-num-when-hover'
                          : 'px-7 sm:w-12 sm:px-6'
                      ]"
                      :style="selectionColumnCellStyle"
                    >
                      <div
                        class="mx-auto h-4 w-4 rounded bg-gray-100 animate-pulse dark:bg-gray-800"
                        aria-hidden="true"
                      />
                    </td>
                    <td
                      v-for="(column, columnIndex) in displayColumns"
                      :key="`sk-${n}-${cellKey(column)}`"
                      :class="[
                        'border-0 px-5 align-middle',
                        rowHeightClass,
                        columnIndex === 0
                          ? 'title-column-cell sticky z-20 bg-white dark:bg-gray-900 sticky-column-border'
                          : 'bg-white dark:bg-gray-900'
                      ]"
                      :style="columnCellStyle(column)"
                    >
                      <div
                        class="h-4 max-w-full rounded bg-gray-100 animate-pulse dark:bg-gray-800"
                        :class="columnIndex === 0 ? 'w-[85%]' : 'w-[55%]'"
                        aria-hidden="true"
                      />
                    </td>
                    <td
                      v-if="hasFlexFillColumn"
                      aria-hidden="true"
                      :class="['border-0 p-0 align-middle bg-white dark:bg-gray-900', rowHeightClass]"
                    />
                  </tr>
                </template>
              </template>
              <tr v-else>
                <td
                  :colspan="tableBodyColspan"
                  :class="showEmptyOverlay ? 'h-0 border-0 p-0' : 'px-5 py-10 text-center'"
                  aria-hidden="true"
                >
                  <span class="sr-only">{{ emptyTitle || t('common.listNoDataAvailable') }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  inject,
  nextTick,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  ref,
  shallowRef,
  watch
} from 'vue'
import {
  getListSession,
  LIST_SESSION_RESTORE_KEY,
  patchListSession
} from '@/utils/listScrollSession'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue'
import { ArrowsUpDownIcon, ChevronDownIcon, ChevronUpIcon, CheckIcon, XMarkIcon } from '@heroicons/vue/20/solid'
import { formatRawValueForDisplay } from '@/utils/fieldDisplay'
import { normalizeListPagination } from '@/utils/normalizeListPagination'
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue'

type ListPaginationInput = Record<string, unknown>

type ColumnObjectDef = {
  key?: string
  label?: string
  width?: number | string
  minWidth?: number | string
  sortable?: boolean
  sortKey?: string
  resizable?: boolean
  locked?: boolean
  dataType?: string
}
type ColumnDef = ColumnObjectDef | string
type RowData = Record<string, unknown>

const DEFAULT_STICKY_OFFSET = 72
const DEFAULT_COLUMN_WIDTH = 200
type SortOrder = 'asc' | 'desc'
type SortState = SortOrder | null

type ColumnWidths = Record<string, number>

const parseWidthValue = (value?: number | string) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined
  }

  if (typeof value === 'string') {
    const parsed = parseFloat(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  return undefined
}

const emit = defineEmits<{
  (e: 'row-click', row: RowData, event: MouseEvent): void
  (e: 'sort', payload: { key: string; order: SortState }): void
  (e: 'select', selectedRows: RowData[]): void
  (e: 'bulk-action', payload: { action: string; selectedRows: RowData[] }): void
  (e: 'load-more'): void
  (e: 'toggle-row', row: RowData): void
  (e: 'toggle-select-all-loaded'): void
}>()

const props = withDefaults(
  defineProps<{
    columns?: ColumnDef[]
    rows?: RowData[]
    data?: RowData[]
    rowKey?: string
    stickyOffset?: string | number
    internalScroll?: boolean
    maxBodyHeight?: string | number
    sortField?: string
    sortOrder?: SortOrder
    tableId?: string
    resizableColumns?: boolean
    loading?: boolean
    rowHeight?: 'small' | 'medium' | 'large' | 'huge'
    resetWidths?: number
    selectable?: boolean
    massActions?: Array<{ label: string; icon?: string; action: string; variant?: string }>
    clearSelectionTrigger?: number
    hasActions?: boolean
    emptyTitle?: string
    emptyMessage?: string
    loadMoreEnabled?: boolean
    /** When set, hasMore is derived from normalized pagination (page/total vs currentPage/totalPages). */
    pagination?: ListPaginationInput | null
    /** Explicit override when pagination is not provided */
    hasMore?: boolean
    loadingMore?: boolean
    /** 'checkbox' = always show box; 'numbered-hover' = row index, swap to checkbox on hover (see styles) */
    selectionColumnVariant?: 'checkbox' | 'numbered-hover'
    /** 1-based row display: first row = rowNumberOffset + 1 (e.g. paged lists) */
    rowNumberOffset?: number
    /** Controlled selection from ListView (ID sets only — avoids copying row objects). */
    selectionMode?: 'none' | 'page' | 'all'
    selectedRowIds?: string[]
    excludedRowIds?: string[]
    /** Key for persisting scroll across tab switches (keep-alive). */
    scrollSessionKey?: string
  }>(),
  {
    columns: () => [],
    rows: () => [],
    data: () => [],
    rowKey: 'id',
    stickyOffset: 'var(--table-sticky-offset, 64px)',
    internalScroll: false,
    maxBodyHeight: undefined,
    sortField: '',
    sortOrder: 'asc',
    tableId: '',
    resizableColumns: true,
    loading: false,
    rowHeight: 'small',
    selectable: false,
    massActions: () => [],
    clearSelectionTrigger: 0,
    hasActions: false,
    loadMoreEnabled: false,
    pagination: null,
    hasMore: false,
    loadingMore: false,
    selectionColumnVariant: 'numbered-hover',
    rowNumberOffset: 0,
    selectionMode: 'none',
    selectedRowIds: () => [],
    excludedRowIds: () => [],
    scrollSessionKey: ''
  }
)

const pendingScrollRestore = ref<number | null>(null)
const sessionRestoreTick = inject(LIST_SESSION_RESTORE_KEY, ref(0))
let scrollSaveTimer: ReturnType<typeof setTimeout> | null = null

const normalizedPagination = computed(() => {
  if (!props.pagination) return null
  return normalizeListPagination(props.pagination)
})

/** Supports API shapes { page, total } and { currentPage, totalPages } when pagination prop is set. */
const effectiveHasMore = computed(() => {
  if (!props.loadMoreEnabled) return false
  if (normalizedPagination.value) {
    return normalizedPagination.value.hasMore
  }
  return Boolean(props.hasMore)
})

const showEmptyOverlay = computed(() => {
  if (props.loading) return false
  // displayRows is the final rendered list (after sorting/paging); if it's empty,
  // render the overlay instead of relying on an in-table empty row (which scrolls).
  return Array.isArray(displayRows.value) && displayRows.value.length === 0
})

const scrollContainerClass = computed(() => ({
  'flex-1 min-h-0': showEmptyOverlay.value,
  'overflow-x-auto': true,
  'overflow-y-auto': props.internalScroll && !showEmptyOverlay.value,
  'overflow-y-hidden': showEmptyOverlay.value
}))

const storageKey = computed(() =>
  props.tableId ? `table-column-widths-${props.tableId}` : ''
)

const columnWidths = ref<ColumnWidths>({})
const isResizing = ref(false)
const activeResize = ref<{ key: string; startWidth: number; startEdgeX: number; column: ColumnDef } | null>(null)
const resizeGuideX = ref<number | null>(null)
const resizeGuideBounds = ref<{ top: number; bottom: number } | null>(null)
let saveTimeout: ReturnType<typeof setTimeout> | undefined
const tableRef = ref<HTMLTableElement | null>(null)
const scrollContainerRef = ref<HTMLDivElement | null>(null)
const loadMoreSentinelRef = ref<HTMLDivElement | null>(null)
let loadMoreObserver: IntersectionObserver | null = null
let loadMoreScrollHandler: (() => void) | null = null
/** Prevents duplicate load-more while parent fetch is in flight */
const loadMoreEmitLocked = ref(false)
const LOAD_MORE_ROOT_MARGIN_PX = 160
const leftEdgeColumnIndex = ref<number | null>(null)
const rightEdgeColumnIndex = ref<number | null>(null)
const isScrolledHorizontally = ref(false)
const sampleColumns: ColumnDef[] = [
  { key: 'id', label: 'ID', sortable: true },
  { key: 'name', label: 'Name', sortable: true },
  { key: 'email', label: 'Email', sortable: true },
  { key: 'status', label: 'Status', sortable: true }
]

const providedRows = computed<RowData[]>(() => {
  if (props.rows && props.rows.length > 0) {
    return props.rows
  }
  if (props.data && props.data.length > 0) {
    return props.data
  }
  return []
})

const displayColumns = computed(() => {
  const columns = Array.isArray(props.columns) ? props.columns : []
  // When tableId exists, never use sampleColumns - wait for real columns so we don't
  // overwrite persisted widths with placeholder keys (id, name, email, status)
  if (columns.length > 0) return columns
  return props.tableId ? [] : sampleColumns
})

const displayRows = computed(() => providedRows.value)

/** Full skeleton body: awaiting columns while parent loading, or parent loading with no rows yet. */
const isLoading = computed(() => {
  const awaitingColumns =
    Boolean(props.tableId) &&
    displayColumns.value.length === 0 &&
    Boolean(props.loading)
  if (awaitingColumns) return true
  // Keep showing cached rows during background refetch (e.g. tab return / soft reload).
  if (displayRows.value.length > 0) return false
  return Boolean(props.loading)
})

const showDataRows = computed(() => displayRows.value.length > 0 && !isLoading.value)

/** Fixed row heights (px) for virtual scroll — matches py-* + single-line cell */
const ROW_HEIGHT_PX: Record<string, number> = {
  small: 41,
  medium: 57,
  large: 73,
  huge: 89
}

const VIRTUAL_SCROLL_ROW_THRESHOLD = 30

const rowHeightPx = computed(
  () => ROW_HEIGHT_PX[props.rowHeight] ?? ROW_HEIGHT_PX.small
)

const useVirtualScroll = computed(
  () =>
    props.internalScroll &&
    showDataRows.value &&
    displayRows.value.length >= VIRTUAL_SCROLL_ROW_THRESHOLD
)

const rowVirtualizer = useVirtualizer(
  computed(() => ({
    count: displayRows.value.length,
    getScrollElement: () => scrollContainerRef.value,
    estimateSize: () => rowHeightPx.value,
    overscan: 12
  }))
)

const virtualItems = computed(() =>
  useVirtualScroll.value ? rowVirtualizer.value.getVirtualItems() : []
)

const virtualPaddingTop = computed(() => {
  const items = virtualItems.value
  if (!useVirtualScroll.value || items.length === 0) return 0
  return items[0].start
})

const virtualPaddingBottom = computed(() => {
  const items = virtualItems.value
  if (!useVirtualScroll.value || items.length === 0) return 0
  const total = rowVirtualizer.value.getTotalSize()
  const last = items[items.length - 1]
  return Math.max(0, total - last.end)
})

const tableMinWidth = computed(() => {
  if (displayColumns.value.length === 0) {
    return '100%'
  }

  // Table width = exact sum of column widths so only the resized column changes
  let total = props.selectable
    ? props.selectionColumnVariant === 'numbered-hover'
      ? 44
      : 48
    : 0
  displayColumns.value.forEach(column => {
    total += getColumnWidth(column)
  })

  return `${total}px`
})

/** Extra column so the table can stay width:100% while fixed-width cols stay left; slack lives here (full-width row dividers). */
const hasFlexFillColumn = computed(() => displayColumns.value.length > 0)

const tableBodyColspan = computed(() => {
  let n = displayColumns.value.length
  if (props.selectable) n += 1
  if (hasFlexFillColumn.value) n += 1
  return Math.max(1, n)
})

const columnKey = (column: ColumnDef) => {
  if (typeof column === 'string') return column
  return column.key ?? String(column.label ?? '')
}

const cellKey = (column: ColumnDef) => `${columnKey(column)}-cell`

const sortKeyForColumn = (column: ColumnDef) => {
  if (typeof column === 'string') return ''
  return column.sortKey ?? column.key ?? ''
}

const columnLabel = (column: ColumnDef) => {
  if (typeof column === 'string') return column
  return column.label ?? column.key ?? ''
}

const isColumnSortable = (column: ColumnDef) => {
  if (typeof column === 'string') return false
  if (column.sortable === false) return false
  return Boolean(sortKeyForColumn(column))
}

// Title/frozen column: first in list or explicitly locked (by key so it works with merged column objects)
const isFirstColumn = (column: ColumnDef) => {
  const cols = displayColumns.value
  if (cols.length === 0) return false
  const first = cols[0]
  if (!first) return false
  if (typeof column === 'object' && column && (column as ColumnObjectDef).locked) return true
  return columnKey(first) === columnKey(column)
}

const FIRST_COLUMN_MIN = 380
const FIRST_COLUMN_MAX = 600
const DEFAULT_COLUMN_MIN = 200

const getColumnMinWidth = (column: ColumnDef) => {
  return isFirstColumn(column) ? FIRST_COLUMN_MIN : DEFAULT_COLUMN_MIN
}

const getColumnMaxWidth = (column: ColumnDef) => {
  return isFirstColumn(column) ? FIRST_COLUMN_MAX : undefined
}

const getColumnDefaultWidth = (column: ColumnDef) => {
  const configuredWidth =
    typeof column === 'string'
      ? undefined
      : parseWidthValue(column.width)
  const base = configuredWidth ?? DEFAULT_COLUMN_WIDTH
  return Math.max(base, getColumnMinWidth(column))
}

const getColumnWidth = (column: ColumnDef) => {
  const key = columnKey(column)
  const stored = columnWidths.value[key]
  let width = stored && stored > 0 ? stored : getColumnDefaultWidth(column)
  width = Math.max(width, getColumnMinWidth(column))
  const maxW = getColumnMaxWidth(column)
  return maxW !== undefined ? Math.min(width, maxW) : width
}

const columnColStyle = (column: ColumnDef) => {
  const width = getColumnWidth(column)
  const minWidth = getColumnMinWidth(column)
  const maxW = getColumnMaxWidth(column)
  const style: Record<string, string> = { width: `${width}px`, minWidth: `${minWidth}px` }
  if (maxW !== undefined) style.maxWidth = `${maxW}px`
  return style
}

const columnHeaderStyle = (column: ColumnDef) => {
  const width = getColumnWidth(column)
  const isFirstCol = isFirstColumn(column)
  const checkboxWidth = props.selectionColumnVariant === 'numbered-hover' ? 44 : 48

  const style: Record<string, string> = {
    width: `${width}px`,
    minWidth: `${getColumnMinWidth(column)}px`
  }
  const maxW = getColumnMaxWidth(column)
  if (maxW !== undefined) style.maxWidth = `${maxW}px`
  // Intentionally no overflow:hidden on sticky header — it clips the sort dropdown (HeadlessUI Menu).

  // Make first data column sticky horizontally
  // Header needs higher z-index (25) than cells (20) to stay on top when scrolling
  // Border and shadow are handled via CSS class (sticky-column-border) for better visibility
  if (isFirstCol && props.selectable) {
    style.position = 'sticky'
    style.left = `${checkboxWidth}px`
    style.zIndex = '25' // Higher than cell z-index (20)
  } else if (isFirstCol && !props.selectable) {
    style.position = 'sticky'
    style.left = '0px'
    style.zIndex = '25' // Higher than cell z-index (20)
  }
  
  return style
}

const rowHeightClasses = {
  small: 'py-2',
  medium: 'py-4',
  large: 'py-6',
  huge: 'py-8'
}

const rowHeightClass = computed(() => rowHeightClasses[props.rowHeight] || rowHeightClasses.small)

/** Skeleton rows while `isLoading` (no fake row indices; keeps first paint clean) */
const loadingSkeletonRowCount = 10

const columnCellStyle = (column: ColumnDef) => {
  const width = getColumnWidth(column)
  const isFirstCol = isFirstColumn(column)
  const checkboxWidth = props.selectionColumnVariant === 'numbered-hover' ? 44 : 48

  const style: Record<string, string> = {
    width: `${width}px`,
    minWidth: `${getColumnMinWidth(column)}px`
  }
  const maxW = getColumnMaxWidth(column)
  if (maxW !== undefined) style.maxWidth = `${maxW}px`
  // Clip all cells to fixed column width so long links/text cannot paint over the next column
  style.overflow = 'hidden'

  // Make first data column sticky horizontally
  // Cells use z-20 (set via class), so don't override z-index here
  // Border and shadow are handled via CSS class (sticky-column-border) for better visibility
  if (isFirstCol && props.selectable) {
    style.position = 'sticky'
    style.left = `${checkboxWidth}px`
    // z-index is set via class (z-20), don't override
  } else if (isFirstCol && !props.selectable) {
    style.position = 'sticky'
    style.left = '0px'
    // z-index is set via class (z-20), don't override
  }

  return style
}

const isColumnResizable = (column: ColumnDef) => {
  if (!props.resizableColumns) return false
  if (typeof column !== 'string' && column.resizable === false) return false
  return true
}

const queueSaveWidths = () => {
  if (!storageKey.value) return
  if (Object.keys(columnWidths.value).length === 0) return // Don't overwrite stored with empty
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(() => {
    try {
      localStorage.setItem(storageKey.value, JSON.stringify(columnWidths.value))
    } catch (error) {
      console.warn('Failed to save column widths', error)
    }
  }, 150)
}

const flushColumnWidths = () => {
  if (!storageKey.value) return
  if (saveTimeout) {
    clearTimeout(saveTimeout)
    saveTimeout = undefined
  }
  try {
    localStorage.setItem(storageKey.value, JSON.stringify(columnWidths.value))
  } catch (error) {
    console.warn('Failed to save column widths', error)
  }
}

const ensureColumnWidths = () => {
  const cols = displayColumns.value
  if (cols.length === 0) return // Preserve stored widths when columns load async
  const next: ColumnWidths = {}
  cols.forEach((column) => {
    const key = columnKey(column)
    const minW = getColumnMinWidth(column)
    const maxW = getColumnMaxWidth(column)
    const existing = columnWidths.value[key]
    let width = existing && existing > 0 ? existing : getColumnDefaultWidth(column)
    width = Math.max(width, minW)
    if (maxW !== undefined) width = Math.min(width, maxW)
    next[key] = width
  })
  columnWidths.value = next
}

const loadStoredWidths = () => {
  if (!storageKey.value) return
  const raw = localStorage.getItem(storageKey.value)
  if (!raw) return

  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      const sanitized: ColumnWidths = {}
      Object.entries(parsed as Record<string, number | string>).forEach(([key, value]) => {
        let width = parseWidthValue(value)
        if (width && width > 0) {
          const column = displayColumns.value.find((c) => columnKey(c) === key)
          if (column) {
            width = Math.max(width, getColumnMinWidth(column))
            const maxW = getColumnMaxWidth(column)
            if (maxW !== undefined) width = Math.min(width, maxW)
          }
          sanitized[key] = width
        }
      })
      columnWidths.value = { ...columnWidths.value, ...sanitized }
    }
  } catch (error) {
    console.warn('Failed to parse stored column widths', error)
  }
}

watch(displayColumns, () => {
  ensureColumnWidths()
}, { immediate: true })

watch(
  () => props.columns,
  () => {
    ensureColumnWidths()
  },
  { deep: true }
)

watch(columnWidths, () => {
  queueSaveWidths()
}, { deep: true })

// Watch for resetWidths prop to clear column widths
watch(() => props.resetWidths, (newVal) => {
  if (newVal && newVal > 0) {
    columnWidths.value = {}
    ensureColumnWidths()
  }
})

const updateEdgeColumns = () => {
  if (!scrollContainerRef.value || !tableRef.value) return
  
  const container = scrollContainerRef.value
  const containerRect = container.getBoundingClientRect()
  const containerLeft = containerRect.left
  const containerRight = containerRect.right
  
  // Find all header cells
  const headerCells = tableRef.value.querySelectorAll('thead th')
  let leftEdgeIdx: number | null = null
  let rightEdgeIdx: number | null = null
  
  headerCells.forEach((cell, index) => {
    const cellRect = cell.getBoundingClientRect()
    const cellLeft = cellRect.left
    const cellRight = cellRect.right
    
    // Check if cell is at or near the left edge (within 5px tolerance)
    if (cellLeft <= containerLeft + 5 && cellRight > containerLeft) {
      leftEdgeIdx = index
    }
    
    // Check if cell is at or near the right edge (within 5px tolerance)
    if (cellRight >= containerRight - 5 && cellLeft < containerRight) {
      rightEdgeIdx = index
    }
  })
  
  leftEdgeColumnIndex.value = leftEdgeIdx
  rightEdgeColumnIndex.value = rightEdgeIdx
}

const handleScroll = () => {
  updateEdgeColumns()
  if (scrollContainerRef.value) {
    isScrolledHorizontally.value = scrollContainerRef.value.scrollLeft > 0
  }
  scheduleScrollSessionSave()
  maybeEmitLoadMore()
}

const handleBeforeUnload = () => {
  flushColumnWidths()
}

onMounted(() => {
  loadStoredWidths()
  ensureColumnWidths()
  window.addEventListener('beforeunload', handleBeforeUnload)
  setTimeout(() => {
    updateEdgeColumns()
    if (scrollContainerRef.value) {
      isScrolledHorizontally.value = scrollContainerRef.value.scrollLeft > 0
    }
    if (useVirtualScroll.value) {
      rowVirtualizer.value.measure()
    }
  }, 100)

  window.addEventListener('resize', updateEdgeColumns)
})

watch(
  () => displayRows.value.length,
  () => {
    if (useVirtualScroll.value) {
      nextTick(() => rowVirtualizer.value.measure())
    }
    attemptScrollRestore()
  }
)

function saveScrollSession() {
  if (!props.scrollSessionKey || !props.internalScroll) return
  const el = scrollContainerRef.value
  if (!el) return
  patchListSession(props.scrollSessionKey, { scrollTop: el.scrollTop })
}

function scheduleScrollSessionSave() {
  if (!props.scrollSessionKey || !props.internalScroll) return
  if (scrollSaveTimer) clearTimeout(scrollSaveTimer)
  scrollSaveTimer = setTimeout(() => {
    scrollSaveTimer = null
    saveScrollSession()
  }, 120)
}

function queueScrollRestoreFromSession() {
  if (!props.scrollSessionKey) return
  const session = getListSession(props.scrollSessionKey)
  const top = Number(session?.scrollTop)
  if (Number.isFinite(top) && top > 0) {
    pendingScrollRestore.value = top
  }
}

function attemptScrollRestore() {
  const top = pendingScrollRestore.value
  if (top == null || !Number.isFinite(top)) return
  const el = scrollContainerRef.value
  if (!el || displayRows.value.length === 0 || isLoading.value) return

  nextTick(() => {
    requestAnimationFrame(() => {
      if (useVirtualScroll.value) {
        rowVirtualizer.value.scrollToOffset(top, { align: 'start' })
      }
      if (scrollContainerRef.value) {
        scrollContainerRef.value.scrollTop = top
      }
      const applied = scrollContainerRef.value?.scrollTop ?? 0
      if (Math.abs(applied - top) > 4) {
        pendingScrollRestore.value = top
      } else {
        pendingScrollRestore.value = null
      }
    })
  })
}

watch(sessionRestoreTick, () => {
  queueScrollRestoreFromSession()
  attemptScrollRestore()
})

onDeactivated(() => {
  saveScrollSession()
})

onActivated(() => {
  queueScrollRestoreFromSession()
  attemptScrollRestore()
  nextTick(() => {
    if (useVirtualScroll.value) {
      rowVirtualizer.value.measure?.()
    }
  })
})

const sortFieldValue = computed(() => props.sortField ?? '')
const sortOrderValue = computed(() => props.sortOrder ?? 'asc')

const isColumnSorted = (column: ColumnDef) =>
  isColumnSortable(column) && sortKeyForColumn(column) === sortFieldValue.value

const ariaSortForColumn = (column: ColumnDef) => {
  if (!isColumnSortable(column)) return 'none'
  if (!isColumnSorted(column)) return 'none'
  return sortOrderValue.value === 'asc' ? 'ascending' : 'descending'
}

const toggleSort = (column: ColumnDef) => {
  if (!isColumnSortable(column)) return
  const key = sortKeyForColumn(column)
  if (!key) return

  const nextOrder: SortOrder = isColumnSorted(column)
    ? (sortOrderValue.value === 'asc' ? 'desc' : 'asc')
    : 'asc'

  emit('sort', { key, order: nextOrder })
}

const applyExplicitSort = (column: ColumnDef, order: SortOrder) => {
  if (!isColumnSortable(column)) return
  const key = sortKeyForColumn(column)
  if (!key) return
  emit('sort', { key, order })
}

const clearSort = (column: ColumnDef) => {
  if (!isColumnSortable(column)) return
  const key = sortKeyForColumn(column)
  if (!key) return
  emit('sort', { key, order: null })
}

const rowKey = computed(() => props.rowKey)

const rowIdentifier = (row: RowData, rowIndex: number) => {
  const key = rowKey.value
  const value = key ? row?.[key] : undefined
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'symbol') {
    return value
  }
  return rowIndex
}

const parseOffsetToCss = (offset: string | number | undefined): string => {
  if (typeof offset === 'number' && !Number.isNaN(offset)) {
    return `${offset}px`
  }

  if (!offset) {
    return `${DEFAULT_STICKY_OFFSET}px`
  }

  if (typeof offset === 'string') {
    return offset
  }

  return `${DEFAULT_STICKY_OFFSET}px`
}

const stickyTop = computed(() => parseOffsetToCss(props.stickyOffset))
const headerTop = computed(() => (props.internalScroll ? '0px' : stickyTop.value))

/** Keeps the selection column from stretching to full table width when data columns are not mounted yet */
const selectionColumnWidthPx = computed(() =>
  props.selectionColumnVariant === 'numbered-hover' ? '44px' : '48px'
)

const selectionColumnCellStyle = computed(() => {
  const w = selectionColumnWidthPx.value
  return {
    width: w,
    minWidth: w,
    maxWidth: w,
    left: '0px'
  }
})

const selectionHeaderCellStyle = computed(() => ({
  top: headerTop.value,
  left: '0px',
  zIndex: '25',
  width: selectionColumnWidthPx.value,
  minWidth: selectionColumnWidthPx.value,
  maxWidth: selectionColumnWidthPx.value
}))

const enableInternalScroll = computed(() => props.internalScroll)

const maxHeightStyle = computed(() => {
  if (!enableInternalScroll.value) {
    return undefined
  }

  if (props.maxBodyHeight !== undefined) {
    if (typeof props.maxBodyHeight === 'number') {
      return `${props.maxBodyHeight}px`
    }
    return props.maxBodyHeight
  }

  return `calc(100vh - ${stickyTop.value})`
})

const scrollContainerStyles = computed(() => {
  const styles: Record<string, string | undefined> = {}

  if (enableInternalScroll.value && !showEmptyOverlay.value) {
    styles.maxHeight = maxHeightStyle.value
    styles.overflowY = 'auto'
  }

  return styles
})

const teardownLoadMoreObserver = () => {
  if (loadMoreObserver) {
    loadMoreObserver.disconnect()
    loadMoreObserver = null
  }
  if (loadMoreScrollHandler) {
    window.removeEventListener('scroll', loadMoreScrollHandler, true)
    loadMoreScrollHandler = null
  }
}

/** True when sentinel is near the viewport or the table's internal scroll root (nested page scroll). */
const isLoadMoreSentinelNear = (): boolean => {
  const target = loadMoreSentinelRef.value
  if (!target) return false

  const margin = LOAD_MORE_ROOT_MARGIN_PX
  const rect = target.getBoundingClientRect()
  const inViewport = rect.top <= window.innerHeight + margin && rect.bottom >= -margin

  const root = scrollContainerRef.value
  if (props.internalScroll && root) {
    const rootRect = root.getBoundingClientRect()
    const inScrollRoot =
      rect.top <= rootRect.bottom + margin && rect.bottom >= rootRect.top - margin
    return inViewport || inScrollRoot
  }

  return inViewport
}

const maybeEmitLoadMore = () => {
  if (
    !props.loadMoreEnabled ||
    !effectiveHasMore.value ||
    props.loadingMore ||
    loadMoreEmitLocked.value
  ) {
    return
  }
  if (!isLoadMoreSentinelNear()) return

  loadMoreEmitLocked.value = true
  emit('load-more')
}

const setupLoadMoreObserver = () => {
  teardownLoadMoreObserver()
  if (!props.loadMoreEnabled || !effectiveHasMore.value) return

  const target = loadMoreSentinelRef.value
  if (!target) return

  // Viewport root: page scroll (PlatformShell) and table-internal scroll both move the sentinel
  // relative to the window; using only scrollContainerRef as root misses parent scroll.
  loadMoreObserver = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        maybeEmitLoadMore()
      }
    },
    { root: null, rootMargin: `${LOAD_MORE_ROOT_MARGIN_PX}px`, threshold: 0 }
  )
  loadMoreObserver.observe(target)

  if (!loadMoreScrollHandler) {
    loadMoreScrollHandler = () => maybeEmitLoadMore()
    window.addEventListener('scroll', loadMoreScrollHandler, { passive: true, capture: true })
  }

  nextTick(() => maybeEmitLoadMore())
}

watch(
  [
    () => props.loadMoreEnabled,
    () => effectiveHasMore.value,
    () => props.pagination,
    () => props.loadingMore,
    () => displayRows.value.length,
    () => enableInternalScroll.value,
    () => scrollContainerRef.value
  ],
  () => {
    nextTick(() => {
      setupLoadMoreObserver()
    })
  },
  { flush: 'post' }
)

watch(
  () => props.loadingMore,
  (loading) => {
    if (!loading) {
      loadMoreEmitLocked.value = false
      nextTick(() => maybeEmitLoadMore())
    }
  }
)

let scrollBoundsHandler: (() => void) | null = null

const cleanupResizeListeners = () => {
  window.removeEventListener('mousemove', handleColumnResize)
  window.removeEventListener('mouseup', stopColumnResize)
  if (scrollBoundsHandler) {
    window.removeEventListener('scroll', scrollBoundsHandler, true)
    scrollContainerRef.value?.removeEventListener('scroll', scrollBoundsHandler)
    scrollBoundsHandler = null
  }
  document.body.style.cursor = ''
  document.body.style.removeProperty('user-select')
  resizeGuideX.value = null
  resizeGuideBounds.value = null
}

const updateResizeGuideBounds = () => {
  const container = scrollContainerRef.value
  if (!container) return
  const rect = container.getBoundingClientRect()
  resizeGuideBounds.value = { top: rect.top, bottom: rect.bottom }
}

/** Get the header cell for a column by key (for guide positioning). */
const getThForColumn = (key: string): HTMLElement | null => {
  const table = tableRef.value
  if (!table) return null
  const colIndex = displayColumns.value.findIndex((c) => columnKey(c) === key)
  if (colIndex < 0) return null
  const thIndex = (props.selectable ? 1 : 0) + colIndex
  const ths = table.querySelectorAll('thead tr th')
  return (ths[thIndex] as HTMLElement) ?? null
}

const handleColumnResize = (event: MouseEvent) => {
  event.preventDefault()
  const state = activeResize.value
  if (!state) return

  const delta = event.clientX - state.startEdgeX
  // Skip update until user has actually moved (prevents jump on click)
  if (Math.abs(delta) < 1) {
    const th = getThForColumn(state.key)
    if (th) {
      resizeGuideX.value = th.getBoundingClientRect().right
      updateResizeGuideBounds()
    }
    return
  }

  const minWidth = getColumnMinWidth(state.column)
  const maxWidth = getColumnMaxWidth(state.column)
  let nextWidth = Math.max(minWidth, Math.round(state.startWidth + delta))
  if (maxWidth !== undefined) nextWidth = Math.min(nextWidth, maxWidth)

  columnWidths.value = {
    ...columnWidths.value,
    [state.key]: nextWidth
  }

  // Guide at actual rendered right edge (nextTick = after Vue updates DOM)
  nextTick(() => {
    const th = getThForColumn(state.key)
    if (th) {
      resizeGuideX.value = th.getBoundingClientRect().right
      updateResizeGuideBounds()
    }
  })
}

const stopColumnResize = () => {
  if (activeResize.value) {
    activeResize.value = null
    isResizing.value = false
    queueSaveWidths()
  }
  cleanupResizeListeners()
}

const startColumnResize = (column: ColumnDef, event: MouseEvent) => {
  if (!isColumnResizable(column)) return

  const key = columnKey(column)
  const th = (event.currentTarget as HTMLElement)?.closest('th') as HTMLElement | null
  if (!th) return

  const rect = th.getBoundingClientRect()
  const startWidth = getColumnWidth(column)
  const startEdgeX = rect.right

  activeResize.value = {
    key,
    startWidth,
    startEdgeX,
    column
  }

  isResizing.value = true
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'

  // Initial guide at actual rendered right edge (viewport X for fixed positioning)
  resizeGuideX.value = th.getBoundingClientRect().right
  updateResizeGuideBounds()

  scrollBoundsHandler = () => {
    if (activeResize.value) updateResizeGuideBounds()
  }
  window.addEventListener('mousemove', handleColumnResize)
  window.addEventListener('mouseup', stopColumnResize)
  window.addEventListener('scroll', scrollBoundsHandler, true)
  scrollContainerRef.value?.addEventListener('scroll', scrollBoundsHandler)
}

onBeforeUnmount(() => {
  if (scrollSaveTimer) clearTimeout(scrollSaveTimer)
  saveScrollSession()
  teardownLoadMoreObserver()
  stopColumnResize()
  flushColumnWidths()
  window.removeEventListener('beforeunload', handleBeforeUnload)
  window.removeEventListener('resize', updateEdgeColumns)
})

const resolveValue = (row: RowData, column: ColumnDef) => {
  const key = typeof column === 'string' ? column : column.key
  if (!key) return ''
  const raw = row?.[key]
  if (raw === null || raw === undefined || raw === '') return ''
  const col = typeof column === 'object' ? column : null
  return formatRawValueForDisplay(raw, col ?? undefined)
}

const handleRowClick = (row: RowData, event: MouseEvent) => {
  // Don't trigger row click if clicking on checkbox
  if ((event.target as HTMLElement)?.closest('[data-headless-checkbox="true"]')) {
    return
  }
  emit('row-click', row, event)
}

const selectedIdSet = shallowRef(new Set<string>())
const excludedIdSet = shallowRef(new Set<string>())

watch(
  () => [props.selectionMode, props.selectedRowIds, props.excludedRowIds] as const,
  () => {
    selectedIdSet.value = new Set((props.selectedRowIds ?? []).map(String))
    excludedIdSet.value = new Set((props.excludedRowIds ?? []).map(String))
  },
  { immediate: true }
)

const isRowIdSelected = (rowId: string): boolean => {
  if (!rowId) return false
  if (props.selectionMode === 'all') {
    return !excludedIdSet.value.has(rowId)
  }
  return selectedIdSet.value.has(rowId)
}

const hasAnySelection = computed(
  () =>
    props.selectionMode === 'all' ||
    selectedIdSet.value.size > 0
)

const loadedRowCount = computed(() => displayRows.value.length)

/** O(1) header checkbox — avoids scanning every row on each selection change */
const allSelected = computed(() => {
  const n = loadedRowCount.value
  if (n === 0) return false
  if (props.selectionMode === 'all') {
    return excludedIdSet.value.size === 0
  }
  if (props.selectionMode === 'page') {
    return selectedIdSet.value.size >= n
  }
  return false
})

const someSelected = computed(() => hasAnySelection.value && !allSelected.value)

type RenderedRow = {
  row: RowData
  rowIndex: number
  key: string
  selected: boolean
}

const renderedRows = computed((): RenderedRow[] => {
  const rows = displayRows.value
  if (rows.length === 0) return []

  const build = (row: RowData, rowIndex: number): RenderedRow => {
    const id = rowIdentifier(row, rowIndex)
    return {
      row,
      rowIndex,
      key: id || `row-${rowIndex}`,
      selected: isRowIdSelected(id)
    }
  }

  if (!useVirtualScroll.value) {
    return rows.map((row, rowIndex) => build(row, rowIndex))
  }

  const virtual = virtualItems.value
  if (virtual.length > 0) {
    return virtual.map((vi) => build(rows[vi.index], vi.index))
  }

  // After keep-alive, scroll root may have zero height until layout — avoid an empty tbody.
  return rows.map((row, rowIndex) => build(row, rowIndex))
})

const toggleRowSelection = (row: RowData) => {
  emit('toggle-row', row)
}

const toggleSelectAll = () => {
  emit('toggle-select-all-loaded')
}

watch(
  () => props.clearSelectionTrigger,
  (newVal) => {
    if (newVal > 0 && hasAnySelection.value) {
      emit('select', [])
    }
  }
)
</script>

<style scoped>
/* Make vertical scrollbar transparent while keeping horizontal scrollbar visible */
.table-scroll-container {
  /* Firefox - thin scrollbar for horizontal */
  scrollbar-width: thin;
  scrollbar-color: rgba(156, 163, 175, 0.3) transparent;
}

/* WebKit scrollbar styling */
.table-scroll-container::-webkit-scrollbar {
  height: 8px; /* Horizontal scrollbar height - visible */
  width: 0px; /* Hide vertical scrollbar completely */
}

.table-scroll-container::-webkit-scrollbar-track {
  background: transparent;
}

/* Horizontal scrollbar thumb - visible */
.table-scroll-container::-webkit-scrollbar-thumb {
  background-color: rgba(156, 163, 175, 0.3);
  border-radius: 4px;
}

.table-scroll-container::-webkit-scrollbar-thumb:hover {
  background-color: rgba(156, 163, 175, 0.5);
}

/* Dark mode scrollbar */
:global(.dark) .table-scroll-container {
  scrollbar-color: rgba(75, 85, 99, 0.5) transparent;
}

:global(.dark) .table-scroll-container::-webkit-scrollbar-thumb {
  background-color: rgba(75, 85, 99, 0.5);
}

:global(.dark) .table-scroll-container::-webkit-scrollbar-thumb:hover {
  background-color: rgba(75, 85, 99, 0.7);
}

/* Ensure header rounded corners are visible - applied dynamically via classes */
.table-scroll-container thead th.rounded-tl-xl {
  border-top-left-radius: 0.75rem;
}

.table-scroll-container thead th.rounded-tr-xl {
  border-top-right-radius: 0.75rem;
}

/* Ensure border-right and shadow are visible on the last sticky column */
/* Use pseudo-element to ensure border stays visible above scrolling content */
.table-scroll-container thead th.sticky-column-border,
.table-scroll-container tbody td.sticky-column-border {
  position: relative;
  overflow: visible;
}

/* Use ::before for header (since ::after is used for bottom border) */
.table-scroll-container thead th.sticky-column-border::before {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 1px;
  background-color: rgb(229 231 235); /* gray-200 - light mode */
  z-index: 30;
  box-shadow: 2px 0 4px -1px rgba(0, 0, 0, 0.1);
  pointer-events: none;
}

/* Use ::after for cells */
.table-scroll-container tbody td.sticky-column-border::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 1px;
  background-color: rgb(229 231 235); /* gray-200 - light mode */
  z-index: 30;
  box-shadow: 2px 0 4px -1px rgba(0, 0, 0, 0.1);
  pointer-events: none;
}

/* Dark mode border color - match header border-bottom (dark:border-gray-700) */
/* Use the same pattern as other dark mode styles in this file */
:global(.dark) .table-scroll-container thead th.sticky-column-border::before {
  background-color: rgb(55 65 81) !important; /* gray-700 */
  box-shadow: 2px 0 4px -1px rgba(0, 0, 0, 0.3) !important;
}

:global(.dark) .table-scroll-container tbody td.sticky-column-border::after {
  background-color: rgb(55 65 81) !important; /* gray-700 */
  box-shadow: 2px 0 4px -1px rgba(0, 0, 0, 0.3) !important;
}

/* Subtle box shadow on the right side when scrolled horizontally */
/* This creates a shadow on the right edge to indicate content scrolling behind */
.table-scroll-container thead th.sticky-column-scrolled,
.table-scroll-container tbody td.sticky-column-scrolled {
  box-shadow: 4px 0 6px -2px rgba(0, 0, 0, 0.1), 2px 0 4px -1px rgba(0, 0, 0, 0.08) !important;
}

/* Dark mode shadow when scrolled - more visible shadow */
:global(.dark) .table-scroll-container thead th.sticky-column-scrolled,
:global(.dark) .table-scroll-container tbody td.sticky-column-scrolled {
  box-shadow: 4px 0 6px -2px rgba(0, 0, 0, 0.25), 2px 0 4px -1px rgba(0, 0, 0, 0.2) !important;
}

/* Title (first) column body cells only — thead uses the same .title-column-cell class for the
   sticky name column; applying overflow:hidden to th > div clipped the sort menu (HeadlessUI Menu). */
.table-scroll-container tbody td.title-column-cell > div {
  min-width: 0;
  overflow: hidden;
}
.table-scroll-container tbody td.title-column-cell .flex {
  min-width: 0;
}
/* Truncate the text part of title cell (e.g. flex with checkbox + span) */
.table-scroll-container tbody td.title-column-cell .flex > *:last-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
/* When title cell has no .flex (plain slot), truncate direct content */
.table-scroll-container tbody td.title-column-cell > div:not(.flex) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Selection column: row numbers ↔ checkbox (Notion-style); fine pointer uses hover/focus */
@media (hover: hover) and (pointer: fine) {
  .table-scroll-container tbody tr.group .tv-num-when-hover .tv-row-index:not(.opacity-0) {
    opacity: 1;
  }
  .table-scroll-container tbody tr.group:hover .tv-num-when-hover .tv-row-index,
  .table-scroll-container tbody tr.group:focus-within .tv-num-when-hover .tv-row-index {
    opacity: 0 !important;
  }
  .table-scroll-container tbody tr.group .tv-num-when-hover .tv-row-checkbox:not(.tv-row-checkbox--visible) {
    opacity: 0;
  }
  .table-scroll-container tbody tr.group:hover .tv-num-when-hover .tv-row-checkbox,
  .table-scroll-container tbody tr.group:focus-within .tv-num-when-hover .tv-row-checkbox,
  .table-scroll-container tbody tr.group .tv-num-when-hover .tv-row-checkbox--visible {
    opacity: 1 !important;
  }
}

@media (hover: none), (pointer: coarse) {
  .table-scroll-container tbody tr.group .tv-num-when-hover .tv-row-index {
    display: none !important;
  }
  .table-scroll-container tbody tr.group .tv-num-when-hover .tv-row-checkbox {
    opacity: 1 !important;
  }
}

</style>

