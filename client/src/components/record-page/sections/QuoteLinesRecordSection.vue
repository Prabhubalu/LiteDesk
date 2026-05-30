<template>
  <section
    v-if="record?._id"
    :class="[
      'quote-lines-workspace',
      { 'quote-lines-workspace--expanded': isLinesExpanded },
      isLinesExpanded ? 'flex flex-col flex-1 min-h-0 h-full overflow-hidden' : ''
    ]"
  >
    <p
      v-if="totalsStaleHint"
      class="mb-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2"
    >
      {{ t('records.linesTotalsStaleHint') }}
      <button type="button" class="ml-1 underline font-medium" :disabled="busy" @click="recalculate">
        {{ t('records.linesRecalculate') }}
      </button>
    </p>

    <!-- Lines workspace -->
    <div
      ref="workspacePanelRef"
      :class="[
        'quote-lines-workspace__panel relative flex flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm ring-1 ring-gray-950/5 dark:ring-white/10',
        isLinesExpanded ? 'flex-1 min-h-0 h-full overflow-hidden' : 'max-h-[min(75vh,820px)] min-h-[16rem]'
      ]"
    >
      <div
        v-if="busy"
        class="absolute inset-0 z-10 flex items-center justify-center bg-white/60 dark:bg-gray-900/60 backdrop-blur-[1px]"
      >
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
      <div class="quote-lines-workspace__toolbar flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50/90 dark:bg-gray-800/50">
        <div class="flex flex-wrap items-center gap-2 min-w-0">
          <button
            v-if="linesEditable && hasSections"
            type="button"
            class="inline-flex items-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 px-2 py-1 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="busy"
            @click="openCreateSection"
          >
            {{ t('records.quoteSectionAdd') }}
          </button>
        </div>
        <div class="flex flex-wrap items-center gap-2 shrink-0 ml-auto">
          <label class="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 select-none">
            <input v-model="showPricingColumns" type="checkbox" class="rounded" />
            {{ t('records.linesShowPricingDetails') }}
          </label>
          <QuoteLinesHeaderActions :record="record" :context="context" />
        </div>
      </div>
      <div
        v-if="isReorderDragging && canCrossSectionDrag"
        class="px-3 py-1.5 text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-800/40"
      >
        {{ t('records.linesDragAcrossSectionsHint') }}
      </div>
      <div class="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
        <div
          v-for="block in sectionBlocks"
          :key="block.key"
          :class="[
            'quote-section-block rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden shadow-sm ring-1 ring-gray-950/[0.04] dark:ring-white/[0.06] transition-colors',
            sectionBlockDropClass(block)
          ]"
        >
          <div
            v-if="block.section"
            :class="[
              'quote-section-header sticky top-0 z-[5] flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 border-b-2 border-gray-200 dark:border-gray-600 bg-gray-100/95 dark:bg-gray-800/95 backdrop-blur-sm transition-colors',
              sectionHeaderDropClass(block)
            ]"
          >
            <div class="flex items-center gap-2 min-w-0">
              <h4 class="text-xs font-bold uppercase tracking-wide text-gray-800 dark:text-gray-100 truncate">
                {{ block.section.sectionTitle }}
              </h4>
              <span
                v-if="sectionTypeBadgeKey(block.section.sectionType) === 'optional'"
                class="shrink-0 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
              >
                {{ t('records.quoteSectionBadgeOptional') }}
              </span>
              <span
                v-else-if="sectionTypeBadgeKey(block.section.sectionType) === 'future'"
                class="shrink-0 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                {{ t('records.quoteSectionBadgeFuture') }}
              </span>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button
                v-if="linesEditable && !block.isOrphan"
                type="button"
                class="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
                :disabled="busy"
                @click="beginAddLineToSection(block)"
              >
                {{ t('records.linesAddToSection') }}
              </button>
              <span
                v-if="block.section.showSectionTotal !== false"
                class="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100"
              >
                {{ formatMoney(block.section.sectionTotal) }}
              </span>
              <button
                v-if="linesEditable && !block.isOrphan"
                type="button"
                class="text-xs text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
                :disabled="busy"
                @click="openEditSection(block.section)"
              >
                {{ t('actions.edit') }}
              </button>
              <button
                v-if="linesEditable && !block.isOrphan && !block.rows.length"
                type="button"
                class="text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                :disabled="busy"
                @click="deleteSection(block.section)"
              >
                {{ t('actions.delete') }}
              </button>
            </div>
          </div>

          <div
            v-if="block.section?.sectionType === 'optional' && linesEditable && !block.isOrphan"
            class="sticky top-[2.625rem] z-[4] px-3 py-1.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur-sm"
          >
            <label class="inline-flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
              <input
                type="checkbox"
                class="rounded"
                :checked="block.section.includeInQuoteTotal === true"
                :disabled="busy"
                @change="toggleSectionInclude(block.section, $event.target.checked)"
              />
              {{ t('records.quoteSectionIncludeInTotal') }}
            </label>
          </div>

          <div
            class="quote-lines-table-scroll"
            :class="[
              stickyColumnsActive ? 'overflow-x-auto' : 'overflow-x-hidden',
              { 'quote-lines-table--dragging': isReorderDragging }
            ]"
            @scroll="onQuoteLinesTableScroll"
          >
        <table
          class="min-w-full text-sm quote-lines-table"
          :class="{
            'quote-lines-table--sticky': stickyColumnsActive,
            'quote-lines-table--sticky-editable': stickyColumnsActive && linesEditable,
            'quote-lines-table--sticky-pricing': stickyColumnsActive && showPricingColumns
          }"
        >
          <thead class="bg-gray-50 dark:bg-gray-800/60">
            <tr>
              <th :class="[lineTableHeadClass, stickyColClass('name'), stickyColumnsActive && showPricingColumns && 'quote-lines-col-name']">{{ t('records.linesName') }}</th>
              <th :class="[lineTableHeadClass, stickyColumnsActive && showPricingColumns && 'quote-lines-col-sku']">{{ t('records.linesSku') }}</th>
              <th v-if="showPricingColumns" :class="[lineTableHeadClass, 'quote-lines-col-scroll']">{{ t('records.linesPriceBook') }}</th>
              <th v-if="showPricingColumns" :class="[lineTableHeadClass, 'quote-lines-col-scroll']">{{ t('records.linesPriceSource') }}</th>
              <th :class="[lineTableHeadClass, 'text-right']">{{ t('records.linesQty') }}</th>
              <th :class="[lineTableHeadClass, 'text-right']">{{ t('records.linesUnitPrice') }}</th>
              <th v-if="linesEditable" :class="[lineTableHeadClass, 'text-right']">{{ t('records.linesDiscount') }}</th>
              <th :class="[lineTableHeadClass, stickyColClass('total'), 'text-right', stickyColumnsActive && showPricingColumns && 'quote-lines-col-total']">{{ t('records.linesTotal') }}</th>
              <th v-if="linesEditable" :class="[stickyColClass('actions'), 'px-3 py-2.5 text-right w-12']">
                <span class="sr-only">{{ t('records.linesMoreActions') }}</span>
              </th>
            </tr>
          </thead>
          <draggable
            v-if="linesEditable"
            :model-value="getSectionRows(block.key)"
            tag="tbody"
            item-key="uid"
            handle=".quote-line-drag-handle"
            :group="dragGroupForBlock(block)"
            :empty-insert-threshold="canCrossSectionDrag ? 56 : 0"
            :animation="200"
            :easing="'cubic-bezier(0.2, 0, 0, 1)'"
            :force-fallback="true"
            :fallback-on-body="true"
            fallback-class="quote-line-sortable-fallback"
            ghost-class="quote-line-sortable-ghost"
            chosen-class="quote-line-sortable-chosen"
            drag-class="quote-line-sortable-drag"
            :disabled="!linesEditable || busy"
            class="divide-y divide-gray-200 dark:divide-gray-700"
            :class="{ 'quote-lines-tbody--empty': !getSectionRows(block.key).length }"
            @update:model-value="setSectionRows(block.key, $event)"
            @start="onLineOrderDragStart"
            @end="onLineOrderDragEnd"
            @change="(evt) => onLineOrderChange(block.key, evt)"
          >
            <template #item="{ element: { line, indent, isBundleParent, isOptional } }">
              <tr
                class="group/quote-line quote-line-row text-gray-900 dark:text-gray-100 transition-colors hover:bg-gray-50/80 dark:hover:bg-gray-800/40"
                :class="isBundleParent ? 'quote-line-row--bundle bg-indigo-50/40 dark:bg-indigo-900/10 hover:bg-indigo-50/70 dark:hover:bg-indigo-900/20' : ''"
              >
              <td :class="[stickyColClass('name'), 'px-3 py-2.5 align-middle', stickyColumnsActive && showPricingColumns && 'quote-lines-col-name']">
                <div class="flex items-start gap-1.5 min-w-0">
                  <button
                    v-if="!isLineDragDisabled(line)"
                    type="button"
                    class="quote-line-drag-handle inline-flex shrink-0 items-center justify-center p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-grab active:cursor-grabbing disabled:opacity-40"
                    :aria-label="canCrossSectionDrag ? t('records.linesDragHandleMoveAria') : t('records.linesDragHandleAria')"
                    :title="canCrossSectionDrag ? t('records.linesDragHandleMoveAria') : t('records.linesDragHandleAria')"
                    :disabled="busy"
                  >
                    <Bars3Icon class="h-4 w-4" />
                  </button>
                  <div class="min-w-0 flex items-start gap-1 flex-1" :class="indent ? 'pl-2' : ''">
                  <span v-if="indent" class="text-gray-400 shrink-0" aria-hidden="true">↳</span>
                  <div class="min-w-0">
                    <div class="truncate" :class="{ 'font-semibold': isBundleParent }">
                      <span v-if="isOptional" class="text-xs text-gray-500 mr-1">[{{ t('records.linesOptional') }}]</span>
                      {{ line.itemNameSnapshot || '—' }}
                    </div>
                    <button
                      v-if="linesEditable && isBundleParent && bundleParentHasOptionals(line)"
                      type="button"
                      class="mt-0.5 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                      :disabled="busy"
                      @click.stop="openBundleOptionalConfig(line)"
                    >
                      {{ t('records.linesBundleOptionalConfigure') }}
                    </button>
                  </div>
                  </div>
                </div>
              </td>
              <td class="px-3 py-2.5 align-middle font-mono text-xs text-gray-600 dark:text-gray-300">
                {{ line.skuSnapshot || '—' }}
              </td>
              <td v-if="showPricingColumns" class="px-3 py-2.5 align-middle text-xs text-gray-700 dark:text-gray-200">
                <span :title="priceProvenanceTitle(line)">
                  {{ line.priceBookNameSnapshot || '—' }}
                </span>
              </td>
              <td v-if="showPricingColumns" class="px-3 py-2.5 align-middle text-xs text-gray-500 dark:text-gray-400">
                {{ pricingSourceLabel(line.pricingSourceSnapshot) }}
              </td>
              <td class="px-3 py-2.5 align-middle text-right">
                <input
                  v-if="linesEditable"
                  :class="lineQtyInputClass"
                  type="number"
                  min="0"
                  step="1"
                  :aria-label="t('records.linesQty')"
                  :value="line.quantity"
                  :disabled="busy"
                  @change="(e) => patchQty(line, e?.target?.value)"
                />
                <span v-else class="tabular-nums">{{ line.quantity }}</span>
              </td>
              <td class="px-3 py-2.5 align-middle text-right tabular-nums text-gray-700 dark:text-gray-200">
                {{ formatMoney(line.unitPriceSnapshot) }}
              </td>
              <td v-if="linesEditable" class="px-3 py-2.5 align-middle text-right">
                <div class="inline-flex items-center justify-end gap-1.5">
                  <HeadlessSelect
                    :model-value="lineDiscountType(line)"
                    :options="discountTypeOptions"
                    allow-empty
                    :empty-label="t('records.linesDiscountNone')"
                    empty-value=""
                    :disabled="busy"
                    :button-class="lineSelectButtonClass"
                    wrapper-class="inline-block min-w-[4.5rem]"
                    teleport
                    @update:model-value="(v) => patchLineDiscount(line, { type: v })"
                  />
                  <input
                    v-if="lineDiscountType(line)"
                    :class="lineCompactInputClass"
                    type="number"
                    min="0"
                    step="any"
                    :aria-label="t('records.linesDiscount')"
                    :value="lineDiscountValue(line)"
                    :disabled="busy"
                    @change="(e) => patchLineDiscount(line, { value: e.target.value })"
                  />
                </div>
              </td>
              <td :class="[stickyColClass('total'), 'px-3 py-2.5 align-middle text-right font-medium tabular-nums']">
                {{ formatMoney(line.lineTotal) }}
              </td>
              <td :class="[stickyColClass('actions'), 'px-3 py-2.5 align-middle text-right']">
                <div
                  v-if="linesEditable"
                  class="inline-flex items-center justify-end opacity-100 lg:opacity-0 lg:group-hover/quote-line:opacity-100 transition-opacity"
                >
                  <button
                    type="button"
                    class="inline-flex items-center justify-center p-1.5 rounded text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
                    :title="t('actions.delete')"
                    :aria-label="t('actions.delete')"
                    :disabled="busy"
                    @click="requestRemoveLine(line)"
                  >
                    <TrashIcon class="h-4 w-4" />
                  </button>
                </div>
              </td>
              </tr>
            </template>
          </draggable>
          <tbody v-else-if="!getSectionRows(block.key).length" class="divide-y divide-gray-200 dark:divide-gray-700">
            <tr>
              <td class="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400" :colspan="tableColspan">
                {{ t('records.linesEmpty') }}
              </td>
            </tr>
          </tbody>
          <tbody v-else class="divide-y divide-gray-200 dark:divide-gray-700">
            <tr
              v-for="{ line, indent, isBundleParent, isOptional } in getSectionRows(block.key)"
              :key="lineRowKey(line)"
              class="text-gray-900 dark:text-gray-100"
              :class="isBundleParent ? 'quote-line-row--bundle bg-indigo-50/40 dark:bg-indigo-900/10' : ''"
            >
              <td :class="[stickyColClass('name'), 'px-3 py-2.5 align-middle', stickyColumnsActive && showPricingColumns && 'quote-lines-col-name']">
                <div class="min-w-0 flex items-start gap-1" :class="indent ? 'pl-4' : ''">
                  <span v-if="indent" class="text-gray-400 shrink-0" aria-hidden="true">↳</span>
                  <div class="min-w-0">
                    <div class="truncate" :class="{ 'font-semibold': isBundleParent }">
                      <span v-if="isOptional" class="text-xs text-gray-500 mr-1">[{{ t('records.linesOptional') }}]</span>
                      {{ line.itemNameSnapshot || '—' }}
                    </div>
                  </div>
                </div>
              </td>
              <td class="px-3 py-2.5 align-middle font-mono text-xs text-gray-600 dark:text-gray-300">
                {{ line.skuSnapshot || '—' }}
              </td>
              <td v-if="showPricingColumns" class="px-3 py-2.5 align-middle text-xs text-gray-700 dark:text-gray-200">
                {{ line.priceBookNameSnapshot || '—' }}
              </td>
              <td v-if="showPricingColumns" class="px-3 py-2.5 align-middle text-xs text-gray-500 dark:text-gray-400">
                {{ pricingSourceLabel(line.pricingSourceSnapshot) }}
              </td>
              <td class="px-3 py-2.5 align-middle text-right tabular-nums">{{ line.quantity }}</td>
              <td class="px-3 py-2.5 align-middle text-right tabular-nums text-gray-700 dark:text-gray-200">
                {{ formatMoney(line.unitPriceSnapshot) }}
              </td>
              <td :class="[stickyColClass('total'), 'px-3 py-2.5 align-middle text-right font-medium tabular-nums']">
                {{ formatMoney(line.lineTotal) }}
              </td>
            </tr>
          </tbody>
          <tfoot v-if="linesEditable && !getSectionRows(block.key).length && !isReorderDragging">
            <tr>
              <td class="px-3 py-8 text-center text-sm text-gray-500 dark:text-gray-400" :colspan="tableColspan">
                {{ canCrossSectionDrag ? t('records.linesEmptyDropHint') : t('records.linesEmpty') }}
              </td>
            </tr>
          </tfoot>
          <tfoot
            v-if="block.section && !block.isOrphan && block.section.showSectionTotal !== false"
            class="quote-lines-section-foot"
          >
            <tr class="text-sm">
              <td :class="[lineTableFootCellClass, stickyColClass('name')]" />
              <td :colspan="sectionFooterBeforeUnitPriceColspan" :class="lineTableFootCellClass" />
              <td :class="[lineTableFootCellClass, 'text-right text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap']">
                {{ t('records.quoteSectionSubtotal') }}:
              </td>
              <td v-if="linesEditable" :class="[lineTableFootCellClass, 'text-right overflow-visible']">
                <div class="inline-flex items-center justify-end gap-1.5 overflow-visible">
                  <span class="text-xs text-gray-500 dark:text-gray-400">{{ t('records.quoteSectionDiscount') }}</span>
                  <HeadlessSelect
                    :model-value="sectionDiscountType(block.section)"
                    :options="discountTypeOptions"
                    allow-empty
                    :empty-label="t('records.linesDiscountNone')"
                    empty-value=""
                    :disabled="busy"
                    :button-class="lineSelectButtonClass"
                    wrapper-class="inline-block min-w-[4.5rem] overflow-visible"
                    teleport
                    @update:model-value="(v) => saveSectionDiscount(block.section, { type: v })"
                  />
                  <input
                    v-if="sectionDiscountType(block.section)"
                    :class="lineCompactInputClass"
                    type="number"
                    min="0"
                    step="any"
                    :aria-label="t('records.quoteSectionDiscount')"
                    :value="sectionDiscountValue(block.section)"
                    :disabled="busy"
                    @change="(e) => saveSectionDiscount(block.section, { value: e.target.value })"
                  />
                </div>
              </td>
              <td :class="[lineTableFootCellClass, stickyColClass('total'), 'text-right font-medium tabular-nums text-gray-900 dark:text-gray-100']">
                {{ formatMoney(block.section.sectionTotal) }}
              </td>
              <td v-if="linesEditable" :class="[lineTableFootCellClass, stickyColClass('actions')]" />
            </tr>
          </tfoot>
        </table>
          </div>
        </div>
      </div>

      <div
        class="shrink-0 border-t border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm"
      >
        <div
          v-if="linesEditable"
          class="px-3 py-2 border-b border-gray-100 dark:border-gray-800"
          role="group"
          :aria-label="t('records.linesAddBarLabel')"
        >
          <div class="flex flex-wrap items-center gap-2">
            <HeadlessSelect
              v-if="hasSections && addTargetSections.length"
              v-model="addTargetSectionId"
              :options="addTargetSectionOptions"
              :placeholder="t('records.quoteSectionAddTarget')"
              :disabled="busy"
              :button-class="lineAddBarSelectClass"
              wrapper-class="w-[8.5rem] shrink-0"
              teleport
            />
            <button
              type="button"
              :class="[lineAddBarControlClass, 'flex-1 min-w-[10rem] text-left hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors']"
              :disabled="busy"
              @click="openVariantPicker"
            >
              <span v-if="variantLabel" class="block truncate text-gray-900 dark:text-gray-100">{{ variantLabel }}</span>
              <span v-else class="text-gray-500 dark:text-gray-400">{{ t('records.linesPickVariant') }}</span>
            </button>
            <HeadlessSelect
              v-model="selectedPriceBookId"
              :options="priceBookOptions"
              allow-empty
              :empty-label="t('records.linesDefaultPriceBook')"
              empty-value=""
              :placeholder="t('records.linesPriceBook')"
              :disabled="busy || priceBooksLoading"
              :button-class="lineAddBarSelectClass"
              wrapper-class="w-[9rem] shrink-0 hidden sm:block"
              teleport
            />
            <input
              v-model.number="quantity"
              :class="lineAddBarQtyClass"
              type="number"
              min="1"
              step="1"
              :aria-label="t('records.linesQty')"
              :disabled="busy"
            />
            <div class="flex items-center gap-1.5 shrink-0 ml-auto">
              <button
                type="button"
                class="inline-flex h-8 items-center justify-center rounded-md bg-indigo-600 hover:bg-indigo-700 text-white px-3 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="busy || !variantId"
                @click="addLine"
              >
                <PlusIcon class="h-4 w-4 sm:mr-1 shrink-0" aria-hidden="true" />
                <span class="hidden sm:inline">{{ t('records.linesAdd') }}</span>
              </button>
              <button
                type="button"
                class="inline-flex h-8 items-center justify-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 px-3 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="busy"
                @click="openBundlePicker"
              >
                <span class="hidden md:inline">{{ t('records.linesAddBundle') }}</span>
                <span class="md:hidden">{{ t('records.linesAddBundleShort') }}</span>
              </button>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-between gap-3 p-3">
          <div
            class="w-full max-w-md space-y-1.5 text-sm"
            data-testid="quote-lines-totals"
          >
        <div class="flex items-center justify-between text-sm">
          <span class="text-gray-600 dark:text-gray-400">{{ t('records.linesTotalsSubtotal') }}</span>
          <span class="font-medium text-gray-900 dark:text-gray-100 tabular-nums">{{ formatMoney(totals.subtotal) }}</span>
        </div>
        <div v-if="totals.lineDiscountTotal > 0" class="flex items-center justify-between text-sm">
          <span class="text-gray-600 dark:text-gray-400">{{ t('records.linesTotalsLineDiscount') }}</span>
          <span class="font-medium text-gray-900 dark:text-gray-100 tabular-nums">−{{ formatMoney(totals.lineDiscountTotal) }}</span>
        </div>
        <div class="flex items-center justify-between gap-2 text-sm">
          <span class="text-gray-600 dark:text-gray-400 shrink-0">{{ t('records.linesTotalsGlobalDiscount') }}</span>
          <div class="inline-flex items-center gap-2 ml-auto">
            <div v-if="linesEditable" class="inline-flex items-center gap-1.5">
              <HeadlessSelect
                :model-value="globalDiscountType"
                :options="discountTypeOptions"
                allow-empty
                :empty-label="t('records.linesDiscountNone')"
                empty-value=""
                :disabled="busy"
                :button-class="lineSelectButtonClass"
                wrapper-class="inline-block min-w-[4.5rem]"
                teleport
                @update:model-value="onGlobalDiscountTypeChange"
              />
              <input
                v-if="globalDiscountType"
                v-model.number="globalDiscountValue"
                :class="lineCompactInputClass"
                type="number"
                min="0"
                step="any"
                :aria-label="t('records.linesTotalsGlobalDiscount')"
                :disabled="busy"
                @change="saveGlobalDiscount"
              />
            </div>
            <span
              v-if="totals.globalDiscountTotal > 0 || !linesEditable"
              class="font-medium text-gray-900 dark:text-gray-100 tabular-nums shrink-0"
            >
              −{{ formatMoney(totals.globalDiscountTotal) }}
            </span>
          </div>
        </div>
        <div class="flex items-center justify-between text-sm">
          <span class="text-gray-600 dark:text-gray-400">{{ t('records.linesTotalsTax') }}</span>
          <span class="font-medium text-gray-900 dark:text-gray-100 tabular-nums">{{ formatMoney(totals.taxTotal) }}</span>
        </div>
        <div v-if="totals.adjustmentTotal !== 0" class="flex items-center justify-between text-sm">
          <span class="text-gray-600 dark:text-gray-400">{{ t('records.linesTotalsAdjustment') }}</span>
          <span class="font-medium text-gray-900 dark:text-gray-100 tabular-nums">{{ formatMoney(totals.adjustmentTotal) }}</span>
        </div>
          </div>
          <div
            class="quote-lines-grand-total shrink-0 min-w-[11rem] rounded-lg border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50 dark:bg-indigo-950/40 px-4 py-3 text-right shadow-sm"
          >
            <div class="text-[11px] font-semibold uppercase tracking-wide text-indigo-800/80 dark:text-indigo-200/80">
              {{ t('records.linesTotalsGrandTotal') }}
            </div>
            <div class="mt-0.5 text-2xl font-bold tabular-nums text-indigo-950 dark:text-white">
              {{ formatMoney(totals.grandTotal) }}
            </div>
            <div v-if="currencyCode" class="mt-1 text-[11px] text-indigo-700/70 dark:text-indigo-300/70">
              {{ t('records.linesTotalsCurrency', { currency: currencyCode }) }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Pickers -->
    <div v-if="showBundlePicker" class="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div class="bg-white dark:bg-gray-800 rounded-xl p-5 w-full max-w-lg space-y-3 max-h-[80vh] flex flex-col">
        <h4 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('records.linesPickBundleTitle') }}</h4>
        <input
          v-model="bundleSearchQuery"
          type="search"
          :class="lineFormControlClass"
          :placeholder="t('records.linesBundleSearchPlaceholder')"
          @input="debouncedBundleSearch"
        />
        <ul class="flex-1 overflow-y-auto space-y-1 min-h-[120px]">
          <li v-if="bundleSearchLoading" class="text-sm text-gray-500 px-2">{{ t('states.loading') }}</li>
          <li v-else-if="!bundleSearchResults.length" class="text-sm text-gray-500 px-2">{{ t('records.linesNoBundlesFound') }}</li>
          <li
            v-for="hit in bundleSearchResults"
            :key="hit._id"
            class="px-3 py-2 rounded-lg cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
            @click="pickBundle(hit)"
          >
            <span class="text-sm text-gray-900 dark:text-white">{{ hit.item_name || hit.variant_code }}</span>
            <span v-if="hit.variant_code" class="block text-xs text-gray-500 font-mono">{{ hit.variant_code }}</span>
          </li>
        </ul>
        <div class="flex justify-end">
          <button type="button" class="px-3 py-2 text-sm" @click="showBundlePicker = false">{{ t('actions.cancel') }}</button>
        </div>
      </div>
    </div>

    <div v-if="showBundleOptionalModal" class="fixed inset-0 z-[75] flex items-center justify-center bg-black/40 p-4">
      <div class="bg-white dark:bg-gray-800 rounded-xl p-5 w-full max-w-lg space-y-3 max-h-[80vh] flex flex-col">
        <h4 class="text-base font-semibold text-gray-900 dark:text-white">
          {{ t('records.linesBundleOptionalTitle') }}
        </h4>
        <p class="text-sm text-gray-600 dark:text-gray-300">
          {{ bundleOptionalModalTitle }}
        </p>
        <p v-if="!bundleOptionalChoices.length" class="text-sm text-gray-500 dark:text-gray-400">
          {{ t('records.linesBundleOptionalNone') }}
        </p>
        <ul v-else class="flex-1 overflow-y-auto space-y-2 min-h-[80px]">
          <li
            v-for="choice in bundleOptionalChoices"
            :key="choice.variantId"
            class="flex items-start gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2"
          >
            <input
              :id="`bundle-opt-${choice.variantId}`"
              v-model="bundleOptionalSelected"
              type="checkbox"
              class="mt-1 rounded"
              :value="choice.variantId"
              :disabled="busy"
            />
            <label :for="`bundle-opt-${choice.variantId}`" class="min-w-0 flex-1 cursor-pointer">
              <span class="text-sm text-gray-900 dark:text-white">{{ choice.label }}</span>
              <span class="block text-xs text-gray-500 dark:text-gray-400">
                {{ t('records.linesBundleOptionalQty', { qty: choice.quantity }) }}
              </span>
            </label>
          </li>
        </ul>
        <div class="flex justify-end gap-2 pt-1">
          <button type="button" class="px-3 py-2 text-sm" :disabled="busy" @click="closeBundleOptionalModal">
            {{ t('actions.cancel') }}
          </button>
          <button
            type="button"
            class="px-3 py-2 text-sm rounded-md bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
            :disabled="busy"
            @click="confirmBundleOptionalModal"
          >
            {{ bundleOptionalModalMode === 'add' ? t('records.linesAdd') : t('actions.save') }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="showVariantPicker" class="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div class="bg-white dark:bg-gray-800 rounded-xl p-5 w-full max-w-lg space-y-3 max-h-[80vh] flex flex-col">
        <h4 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('records.linesPickVariantTitle') }}</h4>
        <input
          v-model="variantSearchQuery"
          type="search"
          :class="lineFormControlClass"
          :placeholder="t('records.linesVariantSearchPlaceholder')"
          @input="debouncedVariantSearch"
        />
        <ul class="flex-1 overflow-y-auto space-y-1 min-h-[120px]">
          <li v-if="variantSearchLoading" class="text-sm text-gray-500 px-2">{{ t('states.loading') }}</li>
          <li v-else-if="!variantSearchResults.length" class="text-sm text-gray-500 px-2">{{ t('records.linesNoVariantsFound') }}</li>
          <li
            v-for="hit in variantSearchResults"
            :key="hit._id"
            class="px-3 py-2 rounded-lg cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
            @click="pickVariant(hit)"
          >
            <span class="text-sm text-gray-900 dark:text-white">{{ hit.item_name || hit.variant_code }}</span>
            <span v-if="hit.variant_code" class="block text-xs text-gray-500 font-mono">{{ hit.variant_code }}</span>
          </li>
        </ul>
        <div class="flex justify-end">
          <button type="button" class="px-3 py-2 text-sm" @click="showVariantPicker = false">{{ t('actions.cancel') }}</button>
        </div>
      </div>
    </div>

    <QuoteSectionFormModal
      :show="showSectionModal"
      :mode="sectionModalMode"
      :initial="sectionModalInitial"
      :saving="busy"
      @close="closeSectionModal"
      @submit="submitSectionModal"
    />

    <DeleteConfirmationModal
      :show="showDeleteLineModal"
      :record-name="linePendingDelete?.itemNameSnapshot || t('records.linesTitle')"
      record-type="quote line"
      :deleting="busy"
      @close="showDeleteLineModal = false"
      @confirm="confirmRemoveLine"
    />
  </section>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Bars3Icon, PlusIcon, TrashIcon } from '@heroicons/vue/24/outline';
import draggable from 'vuedraggable';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';
import { unwrapCatalogApiData, unwrapCatalogApiList } from '@/utils/catalogApi';
import { useAuthStore } from '@/stores/authRegistry';
import DeleteConfirmationModal from '@/components/common/DeleteConfirmationModal.vue';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import QuoteLinesHeaderActions from '@/components/record-page/sections/QuoteLinesHeaderActions.vue';
import QuoteSectionFormModal from '@/components/record-page/sections/QuoteSectionFormModal.vue';
import { isCommerciallyLockedStatus } from '@/constants/quoteLifecycle';
import { formatQuoteMoney } from '@/utils/quoteMoney';
import {
  buildQuoteSectionBlocks,
  sectionRef as quoteSectionRef,
  sectionTypeBadgeKey,
  sortQuoteSections
} from '@/utils/quoteSectionDisplay';
import { useQuoteLinesSession, clearQuoteLinesSession } from '@/composables/useQuoteLinesSession';
import { useQuoteLinesStickyColumns, updateQuoteLinesTableScrollHints } from '@/composables/useQuoteLinesStickyColumns';

const props = defineProps({
  record: { type: Object, default: null },
  adapter: { type: Object, default: () => ({}) },
  context: { type: Object, default: () => ({}) }
});

const emit = defineEmits(['updated']);

const isLinesExpanded = computed(() => props.context?.expandedLeftSection === 'lines');

const { t } = useI18n();
const notifications = useNotifications();
const authStore = useAuthStore();

const lineTableHeadClass =
  'px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400';
const lineTableFootCellClass =
  'px-3 py-2.5 align-middle border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30';
const lineFormControlClass =
  'w-full h-9 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed';
const lineInputClass =
  'h-8 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed';
const lineQtyInputClass = `${lineInputClass} w-[4.5rem] text-right tabular-nums ml-auto block`;
const lineCompactInputClass = `${lineInputClass} w-16 text-xs text-right tabular-nums`;
const lineSelectButtonClass =
  '!h-8 !min-w-[4.5rem] !px-2 !py-1 !text-xs !rounded !bg-white dark:!bg-gray-800 !text-gray-900 dark:!text-white !outline-none ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:!ring-2 focus:!ring-indigo-500 disabled:!opacity-50 disabled:!cursor-not-allowed';
const lineFormSelectButtonClass =
  '!h-9 !px-3 !py-2 !text-sm !rounded-md !bg-white dark:!bg-gray-800 !text-gray-900 dark:!text-white !outline-none ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:!ring-2 focus:!ring-indigo-500 disabled:!opacity-50 disabled:!cursor-not-allowed';
const lineAddBarControlClass =
  '!h-8 !px-2.5 !py-1.5 !text-sm !rounded-md !bg-white dark:!bg-gray-800 !text-gray-900 dark:!text-white !outline-none ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:!ring-2 focus:!ring-indigo-500 disabled:!opacity-50 disabled:!cursor-not-allowed';
const lineAddBarSelectClass =
  '!h-8 !px-2 !py-1 !text-xs !rounded-md !bg-white dark:!bg-gray-800 !text-gray-900 dark:!text-white !outline-none ring-1 ring-inset ring-gray-300 dark:ring-gray-600 focus:!ring-2 focus:!ring-indigo-500 disabled:!opacity-50 disabled:!cursor-not-allowed';
const lineAddBarQtyClass = `${lineAddBarControlClass} w-14 text-right tabular-nums shrink-0`;

const discountTypeOptions = computed(() => [
  { value: 'percent', label: t('records.linesDiscountPercent') },
  { value: 'amount', label: t('records.linesDiscountAmount') }
]);

const quoteId = computed(() => props.record?._id);
const { busy, overrideLock } = useQuoteLinesSession(quoteId);

const variantId = ref('');
const variantLabel = ref('');
const quantity = ref(1);
const showPricingColumns = ref(false);
const showDeleteLineModal = ref(false);
const linePendingDelete = ref(null);
const workspacePanelRef = ref(null);

const lines = computed(() => (Array.isArray(props.record?.lines) ? props.record.lines : []));
const quoteSections = computed(() => sortQuoteSections(props.record?.sections));
const hasSections = computed(() => quoteSections.value.length > 0);

const sectionBlocks = computed(() =>
  buildQuoteSectionBlocks({
    lines: lines.value,
    sections: quoteSections.value,
    uncategorizedTitle: t('records.quoteSectionUncategorized')
  })
);

const { stickyColumnsActive } = useQuoteLinesStickyColumns(
  () => workspacePanelRef.value,
  [showPricingColumns, sectionBlocks, isLinesExpanded]
);

function onQuoteLinesTableScroll(event) {
  updateQuoteLinesTableScrollHints(event.currentTarget);
}

const movableSections = computed(() => quoteSections.value.filter((s) => s?._id));
const addTargetSections = computed(() => movableSections.value);

const addTargetSectionId = ref('');

watch(
  addTargetSections,
  (sections) => {
    if (!sections.length) {
      addTargetSectionId.value = '';
      return;
    }
    const current = addTargetSectionId.value;
    const stillValid = sections.some((s) => quoteSectionRef(s) === current);
    if (!stillValid) {
      addTargetSectionId.value = quoteSectionRef(sections[0]);
    }
  },
  { immediate: true }
);

function sectionRef(section) {
  return quoteSectionRef(section);
}

const addTargetSectionOptions = computed(() =>
  addTargetSections.value.map((s) => ({
    value: sectionRef(s),
    label: s.sectionTitle
  }))
);

function lineSectionRef(line) {
  const sid = line?.quoteSectionId;
  if (!sid) return addTargetSectionId.value || '';
  const match = quoteSections.value.find((s) => String(s._id) === String(sid));
  return match ? quoteSectionRef(match) : String(sid);
}

const sectionRowsMap = ref({});
const isReorderDragging = ref(false);
const dragStartSectionByLineId = ref({});
const activeDropSectionKey = ref(null);

const canCrossSectionDrag = computed(
  () => linesEditable.value && hasSections.value && movableSections.value.length > 1
);

function dragGroupForBlock(block) {
  if (!canCrossSectionDrag.value) return undefined;
  return {
    name: 'quote-lines',
    pull: true,
    put: !block?.isOrphan
  };
}

function isLineDragDisabled(line) {
  return String(line?.lineType || '') === 'bundle_component';
}

function isDroppableSectionBlock(block) {
  return canCrossSectionDrag.value && Boolean(block?.section) && !block?.isOrphan;
}

function sectionBlockDropClass(block) {
  if (!isReorderDragging.value || !isDroppableSectionBlock(block)) return '';
  if (activeDropSectionKey.value === block.key) {
    return 'quote-section-block--drop-active';
  }
  return 'quote-section-block--drop-highlight';
}

function sectionHeaderDropClass(block) {
  if (!isReorderDragging.value || !isDroppableSectionBlock(block)) return '';
  if (activeDropSectionKey.value === block.key) {
    return 'quote-section-header--drop-active';
  }
  return 'quote-section-header--drop-highlight';
}

function blockSectionRef(block) {
  if (!block?.section || block.isOrphan) return null;
  return sectionRef(block.section);
}

function snapshotLineSectionKeys() {
  const snapshot = {};
  for (const block of sectionBlocks.value) {
    for (const row of getSectionRows(block.key) || []) {
      const id = lineRowKey(row.line);
      if (id) snapshot[id] = block.key;
    }
  }
  return snapshot;
}

function collectSectionMoves() {
  if (!canCrossSectionDrag.value) return [];
  const moves = [];
  for (const block of sectionBlocks.value) {
    const targetSectionRef = blockSectionRef(block);
    if (!targetSectionRef) continue;

    for (const row of getSectionRows(block.key) || []) {
      if (isLineDragDisabled(row.line)) continue;
      const id = lineRowKey(row.line);
      const fromKey = dragStartSectionByLineId.value[id];
      if (!fromKey || fromKey === block.key) continue;
      moves.push({ line: row.line, targetSectionRef });
    }
  }
  return moves;
}

function onLineOrderChange(blockKey, evt) {
  if (evt?.added) {
    activeDropSectionKey.value = blockKey;
  }
}

function getSectionRows(key) {
  return sectionRowsMap.value[key] || [];
}

function setSectionRows(key, rows) {
  sectionRowsMap.value = { ...sectionRowsMap.value, [key]: rows };
}

watch(
  sectionBlocks,
  (blocks) => {
    if (isReorderDragging.value) return;
    const next = {};
    for (const block of blocks) {
      next[block.key] = block.rows.map((row) => ({
        ...row,
        uid: lineRowKey(row.line)
      }));
    }
    sectionRowsMap.value = next;
  },
  { immediate: true, deep: true }
);

const showSectionModal = ref(false);
const sectionModalMode = ref('create');
const sectionModalInitial = ref(null);
const sectionModalEditingId = ref(null);

function openCreateSection() {
  sectionModalMode.value = 'create';
  sectionModalInitial.value = null;
  sectionModalEditingId.value = null;
  showSectionModal.value = true;
}

function openEditSection(section) {
  sectionModalMode.value = 'edit';
  sectionModalInitial.value = section;
  sectionModalEditingId.value = quoteSectionRef(section);
  showSectionModal.value = true;
}

function closeSectionModal() {
  showSectionModal.value = false;
  sectionModalInitial.value = null;
  sectionModalEditingId.value = null;
}

function emitSectionsUpdated(payload) {
  emit('updated', {
    type: 'sections-updated',
    sections: payload?.sections ?? null,
    totals: payload?.totals ?? null,
    lines: payload?.lines ?? null
  });
}

async function submitSectionModal(form) {
  if (!props.record?._id) return;
  busy.value = true;
  try {
    if (sectionModalMode.value === 'create') {
      const res = await apiClient.post(`/quotes/${props.record._id}/sections`, {
        ...form,
        overridePricing: overrideLock.value === true
      });
      if (!res?.success) throw new Error(res?.message || t('records.quoteSectionCreateFailed'));
      const created = res?.data?.section;
      const merged = created
        ? sortQuoteSections([...quoteSections.value, created])
        : res?.data?.sections ?? null;
      emitSectionsUpdated({
        sections: merged,
        totals: res?.data?.totals ?? null
      });
    } else {
      const id = sectionModalEditingId.value;
      const res = await apiClient.patch(`/quotes/${props.record._id}/sections/${id}`, {
        ...form,
        overridePricing: overrideLock.value === true
      });
      if (!res?.success) throw new Error(res?.message || t('records.quoteSectionUpdateFailed'));
      emitSectionsUpdated({
        sections: res?.data?.sections ?? null,
        totals: res?.data?.totals ?? null
      });
    }
    closeSectionModal();
  } catch (e) {
    notifications.error(e?.message || t('records.quoteSectionUpdateFailed'));
  } finally {
    busy.value = false;
  }
}

async function deleteSection(section) {
  if (!props.record?._id || !section) return;
  busy.value = true;
  try {
    const res = await apiClient.delete(`/quotes/${props.record._id}/sections/${quoteSectionRef(section)}`, {
      data: { overridePricing: overrideLock.value === true }
    });
    if (!res?.success) throw new Error(res?.message || t('records.quoteSectionDeleteFailed'));
    emitSectionsUpdated({
      sections: res?.data?.sections ?? null,
      totals: res?.data?.totals ?? null
    });
  } catch (e) {
    notifications.error(e?.message || t('records.quoteSectionDeleteFailed'));
  } finally {
    busy.value = false;
  }
}

async function toggleSectionInclude(section, checked) {
  if (!props.record?._id || !section) return;
  busy.value = true;
  try {
    const res = await apiClient.patch(`/quotes/${props.record._id}/sections/${quoteSectionRef(section)}`, {
      includeInQuoteTotal: checked === true,
      overridePricing: overrideLock.value === true
    });
    if (!res?.success) throw new Error(res?.message || t('records.quoteSectionUpdateFailed'));
    emitSectionsUpdated({
      sections: res?.data?.sections ?? null,
      totals: res?.data?.totals ?? null
    });
  } catch (e) {
    notifications.error(e?.message || t('records.quoteSectionUpdateFailed'));
  } finally {
    busy.value = false;
  }
}

function sectionDiscountType(section) {
  return normalizeDiscountType(section?.sectionDiscountType);
}

function sectionDiscountValue(section) {
  return Number(section?.sectionDiscountValue) || 0;
}

async function saveSectionDiscount(section, patch = {}) {
  if (!linesEditable.value || !props.record?._id || !section) return;
  const nextType = patch.type !== undefined ? String(patch.type || '') : sectionDiscountType(section);
  const nextValue = patch.value !== undefined ? Number(patch.value) : sectionDiscountValue(section);
  if (nextType && (!Number.isFinite(nextValue) || nextValue < 0)) return;

  busy.value = true;
  try {
    const res = await apiClient.patch(
      `/quotes/${props.record._id}/sections/${quoteSectionRef(section)}/discounts`,
      {
        sectionDiscountType: nextType || null,
        sectionDiscountValue: nextType ? nextValue : 0,
        overridePricing: overrideLock.value === true
      }
    );
    if (!res?.success) throw new Error(res?.message || t('records.quoteSectionDiscountUpdateFailed'));
    emitSectionsUpdated({
      sections: res?.data?.sections ?? null,
      totals: res?.data?.totals ?? null
    });
  } catch (e) {
    notifications.error(e?.message || t('records.quoteSectionDiscountUpdateFailed'));
  } finally {
    busy.value = false;
  }
}

async function patchLineSection(line, targetSectionRef) {
  const res = await apiClient.patch(`/quotes/${props.record._id}/lines/${line.quoteLineId}`, {
    quoteSectionId: targetSectionRef,
    overridePricing: overrideLock.value === true
  });
  if (!res?.success || !res?.data?.line) {
    throw new Error(res?.message || t('records.linesUpdateFailed'));
  }
  return res.data;
}

async function moveLineToSection(line, targetSectionRef) {
  if (!linesEditable.value || !props.record?._id || !line?.quoteLineId || !targetSectionRef) return;
  if (lineSectionRef(line) === targetSectionRef) return;

  busy.value = true;
  try {
    const data = await patchLineSection(line, targetSectionRef);
    emit('updated', {
      type: 'line-updated',
      line: data.line,
      ...mutationPayload(data)
    });
  } catch (e) {
    notifications.error(e?.message || t('records.linesUpdateFailed'));
  } finally {
    busy.value = false;
  }
}

function mutationPayload(data) {
  return {
    totals: data?.totals ?? null,
    sections: data?.sections ?? null
  };
}

const currencyCode = computed(() => String(props.record?.currency || '').trim().toUpperCase());

function lineRowKey(line) {
  return String(line?.quoteLineId || line?._id || '');
}

const tableColspan = computed(() => {
  let n = 2; // name, sku
  if (showPricingColumns.value) n += 2;
  n += 3; // qty, unit, total
  if (linesEditable.value) n += 2; // discount, actions
  return n;
});

/** Columns from SKU through QTY — footer label sits in the unit-price column. */
const sectionFooterBeforeUnitPriceColspan = computed(() => {
  let n = 2; // sku, qty
  if (showPricingColumns.value) n += 2;
  return n;
});

const globalDiscountType = ref('');
const globalDiscountValue = ref(0);

watch(
  () => [props.record?.globalDiscountType, props.record?.globalDiscountValue],
  ([type, value]) => {
    if (busy.value) return;
    globalDiscountType.value = normalizeGlobalDiscountType(type);
    globalDiscountValue.value = Number(value) || 0;
  },
  { immediate: true }
);

function normalizeDiscountType(rawType) {
  const t = String(rawType || '').trim().toLowerCase();
  if (t === 'percent' || t === 'percentage') return 'percent';
  if (t === 'amount' || t === 'fixed') return 'amount';
  return '';
}

function normalizeGlobalDiscountType(rawType) {
  return normalizeDiscountType(rawType);
}

function lineDiscountType(line) {
  return normalizeDiscountType(line?.discountType);
}

function lineDiscountValue(line) {
  return Number(line?.discountValue) || 0;
}

async function patchLineDiscount(line, patch = {}) {
  if (!linesEditable.value || !props.record?._id || !line?.quoteLineId) return;

  const nextType = patch.type !== undefined ? String(patch.type || '') : lineDiscountType(line);
  const nextValue = patch.value !== undefined ? Number(patch.value) : lineDiscountValue(line);
  if (nextType && (!Number.isFinite(nextValue) || nextValue < 0)) return;

  busy.value = true;
  try {
    const body = {
      overridePricing: overrideLock.value === true,
      discountType: nextType || null,
      discountValue: nextType ? nextValue : 0
    };
    const res = await apiClient.patch(`/quotes/${props.record._id}/lines/${line.quoteLineId}`, body);
    if (res?.success && res?.data?.line) {
      emit('updated', {
        type: 'line-updated',
        line: res.data.line,
        ...mutationPayload(res.data)
      });
    } else {
      notifications.error(res?.message || t('records.linesDiscountUpdateFailed'));
    }
  } catch (e) {
    notifications.error(e?.message || t('records.linesDiscountUpdateFailed'));
  } finally {
    busy.value = false;
  }
}

async function saveGlobalDiscount() {
  if (!linesEditable.value || !props.record?._id) return;
  const type = globalDiscountType.value || null;
  const value = type ? Number(globalDiscountValue.value) || 0 : 0;
  if (type && value < 0) return;

  busy.value = true;
  try {
    const res = await apiClient.patch(`/quotes/${props.record._id}/discounts`, {
      globalDiscountType: type,
      globalDiscountValue: value,
      overridePricing: overrideLock.value === true
    });
    if (res?.success) {
      emit('updated', {
        type: 'quote-discounts-updated',
        quote: res?.data?.quote ?? null,
        lines: res?.data?.lines ?? null,
        ...mutationPayload(res.data)
      });
      return;
    }
    notifications.error(res?.message || t('records.linesGlobalDiscountUpdateFailed'));
  } catch (e) {
    notifications.error(e?.message || t('records.linesGlobalDiscountUpdateFailed'));
  } finally {
    busy.value = false;
  }
}

function onGlobalDiscountTypeChange(value) {
  globalDiscountType.value = value || '';
  saveGlobalDiscount();
}

function sortedAllLines() {
  return [...lines.value].sort(
    (a, b) => (Number(a?.lineOrder) || 0) - (Number(b?.lineOrder) || 0)
  );
}

function linesInDisplayGroup(quoteLineId) {
  const all = sortedAllLines();
  const line = all.find((l) => String(l?.quoteLineId || '') === String(quoteLineId || ''));
  if (!line) return [];

  if (String(line?.lineType || '') === 'bundle_parent') {
    const mode = String(line?.bundleSnapshot?.pricingMode || 'fixed').toLowerCase();
    const parentMongoId = String(line._id || '');
    const children = all
      .filter(
        (l) =>
          String(l?.lineType || '') === 'bundle_component' &&
          parentMongoId &&
          String(l?.parentBundleLineId || '') === parentMongoId
      )
      .sort((a, b) => (Number(a?.lineOrder) || 0) - (Number(b?.lineOrder) || 0));
    if (mode === 'fixed') return [line, ...children];
    return [line];
  }

  return [line];
}

function buildOrdersFromVisibleSequence(visibleIds) {
  const all = sortedAllLines();
  const reordered = [];
  const used = new Set();

  for (const id of visibleIds) {
    for (const line of linesInDisplayGroup(id)) {
      const key = String(line?.quoteLineId || '');
      if (!key || used.has(key)) continue;
      used.add(key);
      reordered.push(line);
    }
  }

  for (const line of all) {
    const key = String(line?.quoteLineId || '');
    if (key && !used.has(key)) {
      used.add(key);
      reordered.push(line);
    }
  }

  return reordered.map((line, index) => ({
    quoteLineId: String(line.quoteLineId),
    lineOrder: index + 1
  }));
}

function onLineOrderDragStart() {
  isReorderDragging.value = true;
  dragStartSectionByLineId.value = snapshotLineSectionKeys();
  activeDropSectionKey.value = null;
  document.body.classList.add('quote-lines-reorder-active');
}

async function persistDragChanges() {
  if (!linesEditable.value || !props.record?._id) return;

  const moves = collectSectionMoves();
  const visibleIds = sectionBlocks.value.flatMap((block) =>
    (getSectionRows(block.key) || []).map((row) => String(row.line?.quoteLineId || '')).filter(Boolean)
  );
  const orders = buildOrdersFromVisibleSequence(visibleIds);
  if (!moves.length && !orders.length) return;

  busy.value = true;
  try {
    for (const move of moves) {
      await patchLineSection(move.line, move.targetSectionRef);
    }

    const res = await apiClient.patch(`/quotes/${props.record._id}/lines/reorder`, {
      orders,
      overridePricing: overrideLock.value === true
    });
    if (!res?.success || !Array.isArray(res?.data?.lines)) {
      throw new Error(res?.message || t('records.linesReorderFailed'));
    }
    emit('updated', {
      type: 'lines-recalculated',
      lines: res.data.lines,
      ...mutationPayload(res.data)
    });
  } catch (e) {
    notifications.error(
      e?.message || (moves.length ? t('records.linesUpdateFailed') : t('records.linesReorderFailed'))
    );
    syncSectionRowsFromBlocks();
  } finally {
    busy.value = false;
  }
}

async function onLineOrderDragEnd() {
  isReorderDragging.value = false;
  document.body.classList.remove('quote-lines-reorder-active');
  try {
    await persistDragChanges();
  } finally {
    dragStartSectionByLineId.value = {};
    activeDropSectionKey.value = null;
  }
}

function syncSectionRowsFromBlocks() {
  const next = {};
  for (const block of sectionBlocks.value) {
    next[block.key] = block.rows.map((row) => ({
      ...row,
      uid: lineRowKey(row.line)
    }));
  }
  sectionRowsMap.value = next;
}

function readMoneyField(key) {
  const n = Number(props.record?.[key]);
  return Number.isFinite(n) ? n : 0;
}

const totals = computed(() => {
  const fromRecord = {
    subtotal: readMoneyField('subtotal'),
    lineDiscountTotal: readMoneyField('lineDiscountTotal'),
    globalDiscountTotal: readMoneyField('globalDiscountTotal'),
    taxTotal: readMoneyField('taxTotal'),
    adjustmentTotal: readMoneyField('adjustmentTotal'),
    grandTotal: readMoneyField('grandTotal')
  };

  if (fromRecord.grandTotal > 0 || !lines.value.length) {
    return fromRecord;
  }
  const lineSum = lines.value.reduce((sum, line) => sum + (Number(line?.lineTotal) || 0), 0);
  if (lineSum <= 0) return fromRecord;
  return { ...fromRecord, subtotal: lineSum, grandTotal: lineSum };
});

const totalsStaleHint = computed(() => {
  const headerTotal = readMoneyField('grandTotal');
  if (headerTotal > 0 || !lines.value.length) return false;
  return lines.value.some((l) => Number(l?.lineTotal) > 0);
});

const priceBooksLoading = ref(false);
const priceBooks = ref([]);

const priceBookOptions = computed(() =>
  priceBooks.value.map((b) => ({
    value: String(b._id),
    label: b.name
  }))
);
const selectedPriceBookId = ref('');

const showVariantPicker = ref(false);
const variantSearchQuery = ref('');
const variantSearchResults = ref([]);
const variantSearchLoading = ref(false);
let variantSearchTimer;

const showBundlePicker = ref(false);
const bundleSearchQuery = ref('');
const bundleSearchResults = ref([]);
const bundleSearchLoading = ref(false);
let bundleSearchTimer;

const showBundleOptionalModal = ref(false);
const bundleOptionalModalMode = ref('add'); // 'add' | 'configure'
const bundleOptionalAddHit = ref(null);
const bundleOptionalConfigureParent = ref(null);
const bundleOptionalChoices = ref([]);
const bundleOptionalSelected = ref([]);

const canOverrideLock = computed(() => {
  if (authStore.user?.isOwner) return true;
  const role = String(authStore.user?.role || '').toLowerCase();
  return role === 'owner' || role === 'admin';
});

const quoteStatus = computed(() => String(props.record?.status || '').trim());
const commerciallyLocked = computed(() => isCommerciallyLockedStatus(quoteStatus.value));
const linesEditable = computed(() => {
  if (!commerciallyLocked.value) return true;
  return overrideLock.value && canOverrideLock.value;
});

/** Sticky anchor columns — name (left), total + actions (right). */
function stickyColClass(column) {
  if (!stickyColumnsActive.value) return '';

  if (column === 'name') {
    return 'quote-lines-sticky quote-lines-sticky-left quote-lines-sticky-left-name';
  }
  if (column === 'total') {
    return linesEditable.value
      ? 'quote-lines-sticky quote-lines-sticky-right quote-lines-sticky-right-total'
      : 'quote-lines-sticky quote-lines-sticky-right quote-lines-sticky-right-edge';
  }
  if (column === 'actions') {
    return linesEditable.value ? 'quote-lines-sticky quote-lines-sticky-right quote-lines-sticky-right-edge' : '';
  }
  return '';
}

function formatMoney(value) {
  return formatQuoteMoney(value, currencyCode.value);
}

function variantHitLabel(hit) {
  if (hit.item_name) {
    return hit.variant_code ? `${hit.item_name} (${hit.variant_code})` : hit.item_name;
  }
  return hit.variant_code || String(hit._id);
}

function beginAddLineToSection(block) {
  if (!linesEditable.value || !block?.section || block.isOrphan) return;
  addTargetSectionId.value = sectionRef(block.section);
  openVariantPicker();
}

function openVariantPicker() {
  if (!linesEditable.value) return;
  showVariantPicker.value = true;
  variantSearchQuery.value = '';
  runVariantSearch();
}

function openBundlePicker() {
  if (!linesEditable.value) return;
  showBundlePicker.value = true;
  bundleSearchQuery.value = '';
  runBundleSearch();
}

function debouncedVariantSearch() {
  clearTimeout(variantSearchTimer);
  variantSearchTimer = setTimeout(runVariantSearch, 300);
}

function debouncedBundleSearch() {
  clearTimeout(bundleSearchTimer);
  bundleSearchTimer = setTimeout(runBundleSearch, 300);
}

async function runVariantSearch() {
  variantSearchLoading.value = true;
  try {
    const res = await apiClient.get('/catalog/variants/search', {
      params: { q: variantSearchQuery.value, limit: 25 }
    });
    const hits = unwrapCatalogApiData(res);
    variantSearchResults.value = Array.isArray(hits) ? hits : [];
  } finally {
    variantSearchLoading.value = false;
  }
}

async function runBundleSearch() {
  bundleSearchLoading.value = true;
  try {
    const res = await apiClient.get('/catalog/variants/search', {
      params: { q: bundleSearchQuery.value, limit: 25 }
    });
    const hits = unwrapCatalogApiData(res);
    const rows = Array.isArray(hits) ? hits : [];
    bundleSearchResults.value = rows.filter((r) => String(r?.item_type || '').toLowerCase() === 'bundle');
  } finally {
    bundleSearchLoading.value = false;
  }
}

function pickVariant(hit) {
  variantId.value = String(hit._id);
  variantLabel.value = variantHitLabel(hit);
  showVariantPicker.value = false;
}

const bundleOptionalModalTitle = computed(() => {
  if (bundleOptionalModalMode.value === 'configure') {
    const name = bundleOptionalConfigureParent.value?.itemNameSnapshot;
    return name
      ? t('records.linesBundleOptionalConfigureHint', { name })
      : t('records.linesBundleOptionalHint');
  }
  const name = bundleOptionalAddHit.value?.item_name || bundleOptionalAddHit.value?.variant_code;
  return name
    ? t('records.linesBundleOptionalAddHint', { name })
    : t('records.linesBundleOptionalHint');
});

function bundleParentHasOptionals(parentLine) {
  if (!parentLine || String(parentLine?.lineType || '') !== 'bundle_parent') return false;
  const parentMongoId = String(parentLine._id || '');
  const hasChildOptionals = lines.value.some(
    (l) =>
      String(l?.lineType || '') === 'bundle_component' &&
      String(l?.parentBundleLineId || '') === parentMongoId &&
      (l?.optionalLine === true || l?.bundleSnapshot?.isOptional === true)
  );
  if (hasChildOptionals) return true;
  const snap = parentLine?.bundleSnapshot?.components;
  return Array.isArray(snap) && snap.some((c) => c?.isOptional === true);
}

function optionalChoicesForParent(parentLine) {
  const parentMongoId = String(parentLine?._id || '');
  const fromLines = lines.value
    .filter(
      (l) =>
        String(l?.lineType || '') === 'bundle_component' &&
        String(l?.parentBundleLineId || '') === parentMongoId &&
        (l?.optionalLine === true || l?.bundleSnapshot?.isOptional === true)
    )
    .sort((a, b) => (Number(a?.lineOrder) || 0) - (Number(b?.lineOrder) || 0));

  if (fromLines.length) {
    return fromLines.map((l) => ({
      variantId: String(l.variantId),
      label: l.itemNameSnapshot || l.skuSnapshot || String(l.variantId),
      quantity: Number(l.quantity) || 0,
      included: l.hiddenLine !== true
    }));
  }

  const snap = parentLine?.bundleSnapshot?.components;
  if (!Array.isArray(snap)) return [];
  return snap
    .filter((c) => c?.isOptional === true)
    .map((c) => ({
      variantId: String(c.componentVariantId),
      label: String(c.componentVariantId),
      quantity: Number(c.quantity) || 0,
      included: false
    }));
}

function catalogOptionalChoices(components) {
  return (Array.isArray(components) ? components : [])
    .filter((c) => c?.isOptional === true)
    .map((c) => ({
      variantId: String(c.componentVariantId),
      label: c.item_name || c.variant_code || String(c.componentVariantId),
      quantity: Number(c.quantity) || 0,
      included: false
    }));
}

function closeBundleOptionalModal() {
  showBundleOptionalModal.value = false;
  bundleOptionalAddHit.value = null;
  bundleOptionalConfigureParent.value = null;
  bundleOptionalChoices.value = [];
  bundleOptionalSelected.value = [];
}

async function pickBundle(hit) {
  showBundlePicker.value = false;
  busy.value = true;
  try {
    const res = await apiClient.get(`/catalog/variants/${hit._id}/bundle-components`);
    const data = unwrapCatalogApiData(res);
    const optional = catalogOptionalChoices(data?.components);
    if (optional.length) {
      bundleOptionalModalMode.value = 'add';
      bundleOptionalAddHit.value = hit;
      bundleOptionalConfigureParent.value = null;
      bundleOptionalChoices.value = optional;
      bundleOptionalSelected.value = [];
      showBundleOptionalModal.value = true;
      return;
    }
    await submitAddBundle(hit, []);
  } catch (e) {
    notifications.error(e?.message || t('records.linesAddBundleFailed'));
  } finally {
    busy.value = false;
  }
}

function openBundleOptionalConfig(parentLine) {
  if (!linesEditable.value || !parentLine?.quoteLineId) return;
  const choices = optionalChoicesForParent(parentLine);
  if (!choices.length) return;
  bundleOptionalModalMode.value = 'configure';
  bundleOptionalConfigureParent.value = parentLine;
  bundleOptionalAddHit.value = null;
  bundleOptionalChoices.value = choices;
  bundleOptionalSelected.value = choices.filter((c) => c.included).map((c) => c.variantId);
  showBundleOptionalModal.value = true;
}

async function confirmBundleOptionalModal() {
  if (bundleOptionalModalMode.value === 'add') {
    const hit = bundleOptionalAddHit.value;
    if (!hit) return;
    await submitAddBundle(hit, [...bundleOptionalSelected.value]);
    closeBundleOptionalModal();
    return;
  }

  const parent = bundleOptionalConfigureParent.value;
  if (!parent?.quoteLineId || !props.record?._id) return;

  busy.value = true;
  try {
    const res = await apiClient.patch(
      `/quotes/${props.record._id}/bundles/${parent.quoteLineId}/optionals`,
      {
        includedComponentVariantIds: [...bundleOptionalSelected.value],
        overridePricing: overrideLock.value === true
      }
    );
    if (!res?.success) {
      throw new Error(res?.message || t('records.linesBundleOptionalUpdateFailed'));
    }
    notifications.success(t('records.linesBundleOptionalUpdateSuccess'));
    emit('updated', {
      type: 'lines-recalculated',
      lines: res?.data?.lines ?? null,
      ...mutationPayload(res.data)
    });
    closeBundleOptionalModal();
  } catch (e) {
    notifications.error(e?.message || t('records.linesBundleOptionalUpdateFailed'));
  } finally {
    busy.value = false;
  }
}

async function submitAddBundle(hit, includedOptionalComponentVariantIds) {
  if (!props.record?._id) return;
  busy.value = true;
  try {
    const res = await apiClient.post(`/quotes/${props.record._id}/bundles`, {
      bundleVariantId: String(hit._id),
      priceBookId: selectedPriceBookId.value ? String(selectedPriceBookId.value) : null,
      quantity: quantity.value > 0 ? quantity.value : 1,
      asOfDate: props.record?.quoteDate ?? null,
      includedOptionalComponentVariantIds: includedOptionalComponentVariantIds,
      quoteSectionId: addTargetSectionId.value || null,
      overridePricing: overrideLock.value === true
    });
    if (!res?.success) {
      throw new Error(res?.message || t('records.linesAddBundleFailed'));
    }
    notifications.success(t('records.linesAddBundleSuccess'));
    const parent = res?.data?.parent;
    const components = Array.isArray(res?.data?.components) ? res.data.components : [];
    const addedLines = [parent, ...components].filter(Boolean);
    if (addedLines.length) {
      emit('updated', {
        type: 'lines-added',
        lines: addedLines,
        ...mutationPayload(res.data)
      });
    } else {
      await refresh();
    }
  } catch (e) {
    notifications.error(e?.message || t('records.linesAddBundleFailed'));
  } finally {
    busy.value = false;
  }
}

async function refresh() {
  emit('updated', { type: 'soft-refresh' });
}

async function addLine() {
  if (!linesEditable.value || !props.record?._id || !variantId.value) return;
  busy.value = true;
  try {
    const res = await apiClient.post(`/quotes/${props.record._id}/lines`, {
      variantId: variantId.value,
      quantity: quantity.value,
      priceBookId: selectedPriceBookId.value || null,
      quoteSectionId: addTargetSectionId.value || null,
      overridePricing: overrideLock.value === true
    });
    if (res?.success) {
      variantId.value = '';
      variantLabel.value = '';
      quantity.value = 1;
      const line = res?.data?.line;
      if (line) {
        emit('updated', {
          type: 'lines-added',
          lines: [line],
          ...mutationPayload(res.data)
        });
      } else {
        await refresh();
      }
    } else {
      notifications.error(res?.message || t('records.linesAddFailed'));
    }
  } catch (e) {
    notifications.error(e?.message || t('records.linesAddFailed'));
  } finally {
    busy.value = false;
  }
}

async function patchQty(line, raw) {
  if (!linesEditable.value || !props.record?._id || !line?.quoteLineId) return;
  const q = Number(raw);
  if (!Number.isFinite(q) || q <= 0) return;
  busy.value = true;
  try {
    const res = await apiClient.patch(`/quotes/${props.record._id}/lines/${line.quoteLineId}`, {
      quantity: q,
      overridePricing: overrideLock.value === true
    });
    if (res?.success) {
      const updatedLine = res?.data?.line;
      if (updatedLine) {
        emit('updated', {
          type: 'line-updated',
          line: updatedLine,
          ...mutationPayload(res.data)
        });
      } else {
        await refresh();
      }
    } else {
      notifications.error(res?.message || t('records.linesUpdateFailed'));
    }
  } catch (e) {
    notifications.error(e?.message || t('records.linesUpdateFailed'));
  } finally {
    busy.value = false;
  }
}

function requestRemoveLine(line) {
  if (!linesEditable.value) return;
  linePendingDelete.value = line;
  showDeleteLineModal.value = true;
}

async function confirmRemoveLine() {
  const line = linePendingDelete.value;
  showDeleteLineModal.value = false;
  if (!props.record?._id || !line?.quoteLineId) return;
  busy.value = true;
  try {
    const res = await apiClient.delete(`/quotes/${props.record._id}/lines/${line.quoteLineId}`, {
      data: { overridePricing: overrideLock.value === true }
    });
    if (res?.success) {
      emit('updated', {
        type: 'line-deleted',
        deletedLine: line,
        ...mutationPayload(res.data)
      });
    } else {
      notifications.error(res?.message || t('records.linesDeleteFailed'));
    }
  } catch (e) {
    notifications.error(e?.message || t('records.linesDeleteFailed'));
  } finally {
    busy.value = false;
    linePendingDelete.value = null;
  }
}

async function recalculate() {
  if (!props.record?._id) return;
  busy.value = true;
  try {
    const res = await apiClient.post(`/quotes/${props.record._id}/recalculate`, {
      overridePricing: overrideLock.value === true
    });
    if (res?.success) {
      const lines = res?.data?.lines;
      if (Array.isArray(lines)) {
        emit('updated', {
          type: 'lines-recalculated',
          lines,
          ...mutationPayload(res.data)
        });
      } else {
        await refresh();
      }
    } else {
      notifications.error(res?.message || t('records.linesRecalculateFailed'));
    }
  } catch (e) {
    notifications.error(e?.message || t('records.linesRecalculateFailed'));
  } finally {
    busy.value = false;
  }
}

async function loadPriceBooks() {
  priceBooksLoading.value = true;
  try {
    const res = await apiClient.get('/catalog/price-books');
    priceBooks.value = unwrapCatalogApiList(res);
  } catch {
    priceBooks.value = [];
  } finally {
    priceBooksLoading.value = false;
  }
}

onMounted(() => {
  loadPriceBooks();
});

onUnmounted(() => {
  document.body.classList.remove('quote-lines-reorder-active');
  clearQuoteLinesSession(quoteId.value);
});

function pricingSourceLabel(source) {
  const s = String(source || '').trim();
  if (!s) return '—';
  if (s === 'price_book') return t('records.linesPriceSourcePriceBook');
  if (s === 'variant_fallback') return t('records.linesPriceSourceVariantFallback');
  return s;
}

function priceProvenanceTitle(line) {
  const book = line?.priceBookNameSnapshot || '—';
  const source = pricingSourceLabel(line?.pricingSourceSnapshot);
  const entry = line?.priceBookEntryIdSnapshot ? String(line.priceBookEntryIdSnapshot) : '—';
  const asOf = line?.pricingAsOfDateSnapshot ? new Date(line.pricingAsOfDateSnapshot).toLocaleDateString() : '—';
  const effectiveFrom = line?.pricingEffectiveFromSnapshot ? new Date(line.pricingEffectiveFromSnapshot).toLocaleDateString() : '—';
  const effectiveTo = line?.pricingEffectiveToSnapshot ? new Date(line.pricingEffectiveToSnapshot).toLocaleDateString() : '—';
  const minQty = Number.isFinite(Number(line?.pricingMinQtySnapshot)) ? String(line.pricingMinQtySnapshot) : '—';

  return t('records.linesPriceProvenanceTooltip', {
    book,
    source,
    entry,
    asOf,
    effectiveFrom,
    effectiveTo,
    minQty
  });
}
</script>

<style scoped>
.quote-lines-workspace {
  margin-top: 0.25rem;
}

.quote-lines-workspace--expanded {
  width: 100%;
  margin-top: 0;
}

.quote-lines-workspace--expanded .quote-lines-workspace__panel {
  width: 100%;
  border-radius: 0.75rem;
}

.quote-lines-workspace__panel {
  isolation: isolate;
}

.quote-lines-table--dragging {
  user-select: none;
}

/* Horizontal scroll anchors: name (left), total + actions (right). */
.quote-lines-table--sticky {
  --ql-name-min-w: 11rem;
  --ql-actions-w: 3rem;
}

.quote-lines-table--sticky-pricing .quote-lines-col-name {
  min-width: var(--ql-name-min-w);
  max-width: 16rem;
}

.quote-lines-table--sticky-pricing .quote-lines-col-sku {
  min-width: 6.75rem;
}

.quote-lines-table--sticky-pricing .quote-lines-col-total {
  min-width: 6.5rem;
}

.quote-lines-col-scroll {
  min-width: 8.5rem;
}

.quote-lines-table-scroll {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}

.quote-lines-table-scroll.overflow-x-auto:hover,
.quote-lines-table-scroll.overflow-x-auto:focus-within {
  scrollbar-color: rgb(203 213 225) transparent;
}

:global(.dark) .quote-lines-table-scroll.overflow-x-auto:hover,
:global(.dark) .quote-lines-table-scroll.overflow-x-auto:focus-within {
  scrollbar-color: rgb(75 85 99) transparent;
}

.quote-lines-table--sticky th.quote-lines-sticky,
.quote-lines-table--sticky td.quote-lines-sticky {
  position: sticky;
  z-index: 2;
  background-color: rgb(255 255 255);
  background-clip: padding-box;
  isolation: isolate;
}

:global(.dark) .quote-lines-table--sticky th.quote-lines-sticky,
:global(.dark) .quote-lines-table--sticky td.quote-lines-sticky {
  background-color: rgb(17 24 39);
}

.quote-lines-table--sticky thead th.quote-lines-sticky {
  z-index: 4;
  background-color: rgb(249 250 251);
}

:global(.dark) .quote-lines-table--sticky thead th.quote-lines-sticky {
  background-color: rgb(31 41 55 / 0.6);
}

.quote-lines-table--sticky tfoot td.quote-lines-sticky {
  z-index: 3;
  background-color: rgb(249 250 251 / 0.95);
}

:global(.dark) .quote-lines-table--sticky tfoot td.quote-lines-sticky {
  background-color: rgb(31 41 55 / 0.85);
}

.quote-lines-table--sticky tbody tr:hover td.quote-lines-sticky {
  background-color: rgb(249 250 251);
}

:global(.dark) .quote-lines-table--sticky tbody tr:hover td.quote-lines-sticky {
  background-color: rgb(31 41 55);
}

.quote-lines-table--sticky tbody tr.quote-line-row--bundle td.quote-lines-sticky {
  background-color: rgb(238 242 255 / 0.4);
}

:global(.dark) .quote-lines-table--sticky tbody tr.quote-line-row--bundle td.quote-lines-sticky {
  background-color: rgb(30 27 75 / 0.1);
}

.quote-lines-table--sticky tbody tr.quote-line-row--bundle:hover td.quote-lines-sticky {
  background-color: rgb(224 231 255 / 0.7);
}

:global(.dark) .quote-lines-table--sticky tbody tr.quote-line-row--bundle:hover td.quote-lines-sticky {
  background-color: rgb(30 27 75 / 0.2);
}

.quote-lines-table--sticky .quote-lines-sticky-left-name {
  left: 0;
}

.quote-lines-table--sticky-editable .quote-lines-sticky-right-total {
  right: var(--ql-actions-w);
}

.quote-lines-table--sticky-editable .quote-lines-sticky-right-edge {
  right: 0;
  width: var(--ql-actions-w);
  min-width: var(--ql-actions-w);
  max-width: var(--ql-actions-w);
}

.quote-lines-table--sticky:not(.quote-lines-table--sticky-editable) .quote-lines-sticky-right-edge {
  right: 0;
}

/* Freeze seam: inset hairline when scrolled. */
.quote-lines-table--sticky .quote-lines-sticky-left-name,
.quote-lines-table--sticky-editable .quote-lines-sticky-right-total,
.quote-lines-table--sticky:not(.quote-lines-table--sticky-editable) .quote-lines-sticky-right-edge {
  transition: box-shadow 150ms ease;
}

.quote-lines-table-scroll--reveals-left .quote-lines-table--sticky .quote-lines-sticky-left-name {
  box-shadow: inset -1px 0 0 rgb(229 231 235);
}

.quote-lines-table-scroll--reveals-right .quote-lines-table--sticky-editable .quote-lines-sticky-right-total,
.quote-lines-table-scroll--reveals-right .quote-lines-table--sticky:not(.quote-lines-table--sticky-editable) .quote-lines-sticky-right-edge {
  box-shadow: inset 1px 0 0 rgb(229 231 235);
}

:global(.dark) .quote-lines-table-scroll--reveals-left .quote-lines-table--sticky .quote-lines-sticky-left-name {
  box-shadow: inset -1px 0 0 rgb(55 65 81);
}

:global(.dark) .quote-lines-table-scroll--reveals-right .quote-lines-table--sticky-editable .quote-lines-sticky-right-total,
:global(.dark) .quote-lines-table-scroll--reveals-right .quote-lines-table--sticky:not(.quote-lines-table--sticky-editable) .quote-lines-sticky-right-edge {
  box-shadow: inset 1px 0 0 rgb(55 65 81);
}

.quote-line-row :deep(input[type='number']) {
  -moz-appearance: textfield;
}

.quote-line-row :deep(input[type='number']::-webkit-outer-spin-button),
.quote-line-row :deep(input[type='number']::-webkit-inner-spin-button) {
  -webkit-appearance: none;
  margin: 0;
}

.quote-lines-tbody--empty {
  min-height: 3.5rem;
}

.quote-section-block--drop-highlight {
  background-color: rgb(238 242 255 / 0.35);
}

.quote-section-block--drop-active {
  background-color: rgb(224 231 255 / 0.55);
  box-shadow: inset 0 0 0 2px rgb(129 140 248);
}

.quote-section-header--drop-highlight {
  background-color: rgb(238 242 255 / 0.8);
}

.quote-section-header--drop-active {
  background-color: rgb(224 231 255);
  box-shadow: inset 0 0 0 2px rgb(129 140 248);
}

:global(.dark) .quote-section-block--drop-highlight {
  background-color: rgb(30 27 75 / 0.25);
}

:global(.dark) .quote-section-block--drop-active {
  background-color: rgb(30 27 75 / 0.45);
  box-shadow: inset 0 0 0 2px rgb(129 140 248);
}

:global(.dark) .quote-section-header--drop-highlight {
  background-color: rgb(30 27 75 / 0.35);
}

:global(.dark) .quote-section-header--drop-active {
  background-color: rgb(30 27 75 / 0.5);
  box-shadow: inset 0 0 0 2px rgb(129 140 248);
}

:deep(.quote-line-sortable-chosen) {
  opacity: 0.35;
}

:deep(.quote-line-sortable-ghost) {
  opacity: 1;
  background-color: rgb(238 242 255) !important;
}

:deep(.quote-line-sortable-ghost td) {
  background-color: rgb(238 242 255) !important;
  border-top: 2px dashed rgb(129 140 248);
  border-bottom: 2px dashed rgb(129 140 248);
}

:global(.dark) :deep(.quote-line-sortable-ghost),
:global(.dark) :deep(.quote-line-sortable-ghost td) {
  background-color: rgb(30 27 75 / 0.5) !important;
  border-color: rgb(129 140 248);
}
</style>

<style>
/* Drag clone is appended to document.body (fallback-on-body). */
.quote-lines-reorder-active {
  cursor: grabbing !important;
}

.quote-line-sortable-fallback {
  display: table !important;
  table-layout: fixed;
  width: max-content;
  min-width: 640px;
  max-width: min(100vw - 2rem, 960px);
  background-color: rgb(255 255 255) !important;
  opacity: 1 !important;
  cursor: grabbing !important;
  z-index: 10000;
  border-radius: 0.5rem;
  border: 1px solid rgb(229 231 235);
  box-shadow:
    0 20px 25px -5px rgb(0 0 0 / 0.12),
    0 8px 10px -6px rgb(0 0 0 / 0.08);
}

.quote-line-sortable-fallback td {
  background-color: rgb(255 255 255) !important;
  padding: 0.5rem 0.75rem;
  white-space: nowrap;
}

.dark .quote-line-sortable-fallback,
.dark .quote-line-sortable-fallback td {
  background-color: rgb(17 24 39) !important;
  border-color: rgb(55 65 81);
  box-shadow:
    0 20px 25px -5px rgb(0 0 0 / 0.45),
    0 8px 10px -6px rgb(0 0 0 / 0.3);
}

.quote-line-sortable-drag {
  opacity: 1 !important;
}
</style>
