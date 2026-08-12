<template>
  <div class="space-y-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('settings.pricingEngineDesc') }}</p>
      <div
        class="inline-flex shrink-0 rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-600 dark:bg-gray-800/60"
        role="tablist"
        :aria-label="t('settings.catalogTabPricing')"
      >
        <button
          v-for="tab in panelTabs"
          :key="tab.id"
          type="button"
          role="tab"
          class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
          :class="panel === tab.id
            ? 'bg-white text-indigo-700 shadow-sm dark:bg-gray-700 dark:text-indigo-300'
            : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'"
          :aria-selected="panel === tab.id"
          @click="panel = tab.id"
        >
          {{ t(tab.labelKey) }}
        </button>
      </div>
    </div>

    <div
      v-if="flash"
      class="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-200"
      role="status"
    >
      {{ flash }}
    </div>
    <div
      v-if="error"
      class="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-300"
      role="alert"
    >
      {{ error }}
    </div>

    <!-- Rules -->
    <section
      v-if="panel === 'rules'"
      class="flex min-h-[28rem] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800/40"
    >
      <div class="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <div class="min-w-0">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.pricingRulesTitle') }}</h3>
          <p v-if="!loadingRules && rules.length" class="mt-0.5 text-xs text-gray-400">
            {{ t('settings.pricingRulesCount', { count: rules.length }) }}
          </p>
        </div>
        <button
          type="button"
          class="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
          @click="openRuleForm()"
        >
          <PlusIcon class="h-3.5 w-3.5" aria-hidden="true" />
          {{ t('settings.pricingAddRule') }}
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-2">
        <div v-if="loadingRules" class="flex justify-center py-12">
          <div class="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
        </div>

        <div
          v-else-if="!rules.length"
          class="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 px-4 py-12 text-center dark:border-gray-600"
        >
          <div class="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300">
            <AdjustmentsHorizontalIcon class="h-5 w-5" aria-hidden="true" />
          </div>
          <p class="mt-3 text-sm font-medium text-gray-800 dark:text-gray-100">{{ t('settings.pricingRulesEmpty') }}</p>
          <p class="mt-1 max-w-xs text-xs text-gray-500">{{ t('settings.pricingRulesEmptyHint') }}</p>
          <button
            type="button"
            class="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            @click="openRuleForm()"
          >
            <PlusIcon class="h-4 w-4" aria-hidden="true" />
            {{ t('settings.pricingAddRule') }}
          </button>
        </div>

        <ul v-else class="space-y-0.5">
          <li
            v-for="rule in rules"
            :key="rule._id"
            class="group/row flex items-center gap-2 rounded-lg px-1.5 py-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/40"
          >
            <span
              class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
              aria-hidden="true"
            >
              <AdjustmentsHorizontalIcon class="h-3.5 w-3.5" />
            </span>
            <div class="min-w-0 flex-1">
              <div class="flex min-w-0 flex-wrap items-center gap-1.5">
                <span class="truncate text-sm font-medium text-gray-900 dark:text-white">{{ rule.name }}</span>
                <span
                  class="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                  :class="statusBadgeClass(rule.status)"
                >
                  {{ labelStatus(rule.status) }}
                </span>
              </div>
              <p class="truncate text-xs text-gray-400">
                {{ labelRuleType(rule.ruleType) }}
                · {{ formatAdj(rule.adjustment) }}
                · {{ t('settings.pricingPriorityShort', { priority: rule.priority }) }}
              </p>
            </div>
            <div class="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/row:opacity-100">
              <button
                type="button"
                class="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:border-indigo-500 dark:hover:bg-gray-600 dark:hover:text-indigo-300"
                :title="t('actions.edit')"
                :aria-label="t('actions.edit')"
                @click="openRuleForm(rule)"
              >
                <PencilSquareIcon class="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                class="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:border-red-700 dark:hover:bg-red-950/60 dark:hover:text-red-300"
                :title="t('actions.delete')"
                :aria-label="t('actions.delete')"
                @click="removeRule(rule)"
              >
                <TrashIcon class="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </li>
        </ul>
      </div>
    </section>

    <!-- Promotions -->
    <section
      v-else-if="panel === 'promotions'"
      class="flex min-h-[28rem] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800/40"
    >
      <div class="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <div class="min-w-0">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.pricingPromosTitle') }}</h3>
          <p v-if="!loadingPromos && promotions.length" class="mt-0.5 text-xs text-gray-400">
            {{ t('settings.pricingPromosCount', { count: promotions.length }) }}
          </p>
        </div>
        <button
          type="button"
          class="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
          @click="openPromoForm()"
        >
          <PlusIcon class="h-3.5 w-3.5" aria-hidden="true" />
          {{ t('settings.pricingAddPromo') }}
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-2">
        <div v-if="loadingPromos" class="flex justify-center py-12">
          <div class="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
        </div>

        <div
          v-else-if="!promotions.length"
          class="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 px-4 py-12 text-center dark:border-gray-600"
        >
          <div class="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300">
            <GiftIcon class="h-5 w-5" aria-hidden="true" />
          </div>
          <p class="mt-3 text-sm font-medium text-gray-800 dark:text-gray-100">{{ t('settings.pricingPromosEmpty') }}</p>
          <p class="mt-1 max-w-xs text-xs text-gray-500">{{ t('settings.pricingPromosEmptyHint') }}</p>
          <button
            type="button"
            class="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            @click="openPromoForm()"
          >
            <PlusIcon class="h-4 w-4" aria-hidden="true" />
            {{ t('settings.pricingAddPromo') }}
          </button>
        </div>

        <ul v-else class="space-y-0.5">
          <li
            v-for="promo in promotions"
            :key="promo._id"
            class="group/row flex items-center gap-2 rounded-lg px-1.5 py-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/40"
          >
            <span
              class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
              aria-hidden="true"
            >
              <GiftIcon class="h-3.5 w-3.5" />
            </span>
            <div class="min-w-0 flex-1">
              <div class="flex min-w-0 flex-wrap items-center gap-1.5">
                <span class="truncate text-sm font-medium text-gray-900 dark:text-white">{{ promo.name }}</span>
                <span
                  class="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                  :class="statusBadgeClass(promo.status)"
                >
                  {{ labelStatus(promo.status) }}
                </span>
              </div>
              <p class="truncate text-xs text-gray-400">
                {{ labelPromoType(promo.promoType) }}
                · {{ formatPromoAction(promo) }}
                · {{ t('settings.pricingPriorityShort', { priority: promo.priority }) }}
              </p>
            </div>
            <div class="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/row:opacity-100">
              <button
                type="button"
                class="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:border-indigo-500 dark:hover:bg-gray-600 dark:hover:text-indigo-300"
                :title="t('actions.edit')"
                :aria-label="t('actions.edit')"
                @click="openPromoForm(promo)"
              >
                <PencilSquareIcon class="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                class="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:border-red-700 dark:hover:bg-red-950/60 dark:hover:text-red-300"
                :title="t('actions.delete')"
                :aria-label="t('actions.delete')"
                @click="removePromo(promo)"
              >
                <TrashIcon class="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </li>
        </ul>
      </div>
    </section>

    <!-- Preview -->
    <section
      v-else
      class="space-y-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800/40"
    >
      <div>
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.pricingPreviewTitle') }}</h3>
        <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.pricingPreviewHint') }}</p>
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="space-y-1.5 sm:col-span-2">
          <span class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ t('settings.pricingPreviewPickVariant') }}</span>
          <button
            type="button"
            class="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-left text-sm hover:bg-gray-50 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900 dark:hover:bg-gray-800"
            @click="openVariantPicker"
          >
            <span :class="preview.variantLabel ? 'text-gray-900 dark:text-white' : 'text-gray-500'">
              {{ preview.variantLabel || t('settings.pricingPreviewPickVariant') }}
            </span>
            <MagnifyingGlassIcon class="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
          </button>
          <p v-if="preview.variantId && !preview.variantLabel" class="truncate text-xs font-mono text-gray-400">
            {{ preview.variantId }}
          </p>
        </div>
        <label class="block space-y-1.5">
          <span class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ t('settings.pricingPreviewQty') }}</span>
          <input
            v-model.number="preview.quantity"
            type="number"
            min="1"
            class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          />
        </label>
        <div class="space-y-1.5">
          <span class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ t('settings.pricingCustomerType') }}</span>
          <HeadlessSelect
            v-model="preview.customerType"
            :options="previewCustomerTypeOptions"
            teleport
            allow-empty
            :empty-label="t('settings.pricingAnyOption')"
            button-class="!py-2"
          />
        </div>
        <label class="block space-y-1.5 sm:col-span-2">
          <span class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ t('settings.pricingRegion') }}</span>
          <input
            v-model="preview.regionCode"
            class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            :placeholder="t('settings.pricingRegionPlaceholder')"
          />
        </label>
      </div>

      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="previewLoading || !preview.variantId"
        @click="runPreview"
      >
        {{ previewLoading ? t('states.loading') : t('settings.pricingRunPreview') }}
      </button>

      <div
        v-if="previewResult"
        class="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-600 dark:bg-gray-900/40"
      >
        <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ t('settings.pricingPreviewList') }}
            <span class="ml-1 font-medium text-gray-700 dark:text-gray-200">{{ previewResult.listPrice }}</span>
          </p>
          <span class="text-gray-300 dark:text-gray-600" aria-hidden="true">→</span>
          <p class="text-sm text-gray-900 dark:text-white">
            {{ t('settings.pricingPreviewUnit') }}
            <span class="ml-1 text-base font-semibold">{{ previewResult.unitPrice }}</span>
            <span class="ml-1 text-xs font-normal text-gray-500">({{ previewResult.currency }})</span>
          </p>
        </div>
        <div v-if="previewResult.pricingBreakdown?.applied?.length">
          <p class="mb-2 text-xs font-medium text-gray-600 dark:text-gray-300">{{ t('settings.pricingPreviewBreakdown') }}</p>
          <ol class="space-y-1.5">
            <li
              v-for="(step, idx) in previewResult.pricingBreakdown.applied"
              :key="idx"
              class="flex items-start gap-2 rounded-md bg-white px-3 py-2 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300"
            >
              <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                {{ idx + 1 }}
              </span>
              <span class="min-w-0">
                <span class="font-medium text-gray-800 dark:text-gray-100">{{ step.name || labelStepKind(step) }}</span>
                <span class="mt-0.5 block text-gray-400">
                  {{ step.unitPriceBefore }} → {{ step.unitPriceAfter }}
                </span>
              </span>
            </li>
          </ol>
        </div>
        <p v-else class="text-xs text-gray-500">{{ t('settings.pricingPreviewNoAdjustments') }}</p>
      </div>
    </section>

    <!-- Rule modal -->
    <div
      v-if="showRuleForm"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click.self="showRuleForm = false"
    >
      <div
        class="max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="ruleDialogTitleId"
      >
        <h4 :id="ruleDialogTitleId" class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ editingRuleId ? t('settings.pricingEditRule') : t('settings.pricingAddRule') }}
        </h4>

        <label class="block space-y-1.5">
          <span class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ t('settings.pricingNamePlaceholder') }}</span>
          <input
            ref="ruleNameInput"
            v-model="ruleForm.name"
            class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            :placeholder="t('settings.pricingNamePlaceholder')"
            @keydown.esc.prevent="showRuleForm = false"
          />
        </label>

        <div class="space-y-1.5">
          <span class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ t('settings.pricingRuleType') }}</span>
          <HeadlessSelect
            v-model="ruleForm.ruleType"
            :options="ruleTypeOptions"
            teleport
            button-class="!py-2"
          />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <span class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ t('settings.pricingAdjType') }}</span>
            <HeadlessSelect
              v-model="ruleForm.adjustment.type"
              :options="ruleAdjOptions"
              teleport
              button-class="!py-2"
            />
          </div>
          <label class="block space-y-1.5">
            <span class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ t('settings.pricingAdjValue') }}</span>
            <input
              v-model.number="ruleForm.adjustment.value"
              type="number"
              class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </label>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <label class="block space-y-1.5">
            <span class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ t('settings.pricingMinQty') }}</span>
            <input
              v-model.number="ruleForm.conditions.minQty"
              type="number"
              min="0"
              class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </label>
          <label class="block space-y-1.5">
            <span class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ t('settings.pricingPriority') }}</span>
            <input
              v-model.number="ruleForm.priority"
              type="number"
              class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </label>
        </div>

        <div class="space-y-2">
          <span class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ t('settings.pricingCustomerType') }}</span>
          <div class="grid grid-cols-2 gap-2">
            <label
              v-for="ct in customerTypes"
              :key="ct"
              class="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-2.5 py-2 text-xs text-gray-700 dark:border-gray-600 dark:text-gray-300"
            >
              <HeadlessCheckbox
                :model-value="ruleForm.conditions.customerTypes.includes(ct)"
                size="sm"
                @update:model-value="toggleRuleCustomerType(ct, $event)"
              />
              {{ labelCustomerType(ct) }}
            </label>
          </div>
        </div>

        <label class="block space-y-1.5">
          <span class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ t('settings.pricingCustomerIdsHint') }}</span>
          <input
            v-model="ruleForm.conditions.customerIdsRaw"
            class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            :placeholder="t('settings.pricingCustomerIdsPlaceholder')"
          />
        </label>

        <label class="block space-y-1.5">
          <span class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ t('settings.pricingRegionsHint') }}</span>
          <input
            v-model="ruleForm.conditions.regionCodesRaw"
            class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            :placeholder="t('settings.pricingRegionPlaceholder')"
          />
        </label>

        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <span class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ t('settings.pricingEffectiveFrom') }}</span>
            <DatePicker
              v-model="ruleForm.effectiveFrom"
              :input-class="dateInputClass"
              :max="ruleForm.effectiveUntil || undefined"
              panel-class="z-[10050]"
            />
          </div>
          <div class="space-y-1.5">
            <span class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ t('settings.pricingEffectiveUntil') }}</span>
            <DatePicker
              v-model="ruleForm.effectiveUntil"
              :input-class="dateInputClass"
              :min="ruleForm.effectiveFrom || undefined"
              panel-class="z-[10050]"
            />
          </div>
        </div>

        <div class="space-y-1.5">
          <span class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ t('settings.pricingStatus') }}</span>
          <HeadlessSelect
            v-model="ruleForm.status"
            :options="statusOptions"
            teleport
            button-class="!py-2"
          />
        </div>

        <div class="flex justify-end gap-2 pt-1">
          <button
            type="button"
            class="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            @click="showRuleForm = false"
          >
            {{ t('actions.cancel') }}
          </button>
          <button
            type="button"
            class="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!ruleForm.name.trim() || savingRule"
            @click="saveRule"
          >
            {{ t('actions.save') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Promo modal -->
    <div
      v-if="showPromoForm"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click.self="showPromoForm = false"
    >
      <div
        class="max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="promoDialogTitleId"
      >
        <h4 :id="promoDialogTitleId" class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ editingPromoId ? t('settings.pricingEditPromo') : t('settings.pricingAddPromo') }}
        </h4>

        <label class="block space-y-1.5">
          <span class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ t('settings.pricingNamePlaceholder') }}</span>
          <input
            ref="promoNameInput"
            v-model="promoForm.name"
            class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            :placeholder="t('settings.pricingNamePlaceholder')"
            @keydown.esc.prevent="showPromoForm = false"
          />
        </label>

        <div class="space-y-1.5">
          <span class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ t('settings.pricingPromoType') }}</span>
          <HeadlessSelect
            v-model="promoForm.promoType"
            :options="promoTypeOptions"
            teleport
            button-class="!py-2"
          />
        </div>

        <div v-if="promoForm.promoType === 'BUY_X_GET_Y'" class="grid grid-cols-2 gap-3">
          <label class="block space-y-1.5">
            <span class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ t('settings.pricingBuyQty') }}</span>
            <input
              v-model.number="promoForm.action.buyQty"
              type="number"
              min="1"
              class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </label>
          <label class="block space-y-1.5">
            <span class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ t('settings.pricingGetQty') }}</span>
            <input
              v-model.number="promoForm.action.getQty"
              type="number"
              min="1"
              class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </label>
        </div>
        <div v-else class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <span class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ t('settings.pricingAdjType') }}</span>
            <HeadlessSelect
              v-model="promoForm.action.type"
              :options="promoAdjOptions"
              teleport
              button-class="!py-2"
            />
          </div>
          <label class="block space-y-1.5">
            <span class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ t('settings.pricingAdjValue') }}</span>
            <input
              v-model.number="promoForm.action.value"
              type="number"
              class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </label>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <label class="block space-y-1.5">
            <span class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ t('settings.pricingMinQty') }}</span>
            <input
              v-model.number="promoForm.conditions.minQty"
              type="number"
              class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </label>
          <label class="block space-y-1.5">
            <span class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ t('settings.pricingMinOrder') }}</span>
            <input
              v-model.number="promoForm.conditions.minOrderSubtotal"
              type="number"
              class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </label>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <span class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ t('settings.pricingEffectiveFrom') }}</span>
            <DatePicker
              v-model="promoForm.effectiveFrom"
              :input-class="dateInputClass"
              :max="promoForm.effectiveUntil || undefined"
              panel-class="z-[10050]"
            />
          </div>
          <div class="space-y-1.5">
            <span class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ t('settings.pricingEffectiveUntil') }}</span>
            <DatePicker
              v-model="promoForm.effectiveUntil"
              :input-class="dateInputClass"
              :min="promoForm.effectiveFrom || undefined"
              panel-class="z-[10050]"
            />
          </div>
        </div>

        <div class="space-y-1.5">
          <span class="text-xs font-medium text-gray-600 dark:text-gray-300">{{ t('settings.pricingStatus') }}</span>
          <HeadlessSelect
            v-model="promoForm.status"
            :options="statusOptions"
            teleport
            button-class="!py-2"
          />
        </div>

        <div class="flex justify-end gap-2 pt-1">
          <button
            type="button"
            class="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            @click="showPromoForm = false"
          >
            {{ t('actions.cancel') }}
          </button>
          <button
            type="button"
            class="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!promoForm.name.trim() || savingPromo"
            @click="savePromo"
          >
            {{ t('actions.save') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Variant picker -->
    <div
      v-if="showVariantPicker"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      @click.self="showVariantPicker = false"
    >
      <div class="flex max-h-[80vh] w-full max-w-lg flex-col space-y-3 rounded-xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-700 dark:bg-gray-800">
        <h4 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('platform.catalogBundlePickVariant') }}</h4>
        <label class="relative block">
          <span class="sr-only">{{ t('platform.catalogBundleSearchPlaceholder') }}</span>
          <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            v-model="variantSearchQuery"
            type="search"
            class="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            :placeholder="t('platform.catalogBundleSearchPlaceholder')"
            @input="debouncedVariantSearch"
          />
        </label>
        <ul class="min-h-[120px] flex-1 space-y-0.5 overflow-y-auto">
          <li v-if="variantSearchLoading" class="px-2 py-8 text-center text-sm text-gray-500">{{ t('states.loading') }}</li>
          <li v-else-if="!variantSearchResults.length" class="px-2 py-8 text-center text-sm text-gray-500">{{ t('settings.catalogNoVariantsFound') }}</li>
          <li
            v-for="hit in variantSearchResults"
            :key="hit._id"
            class="cursor-pointer rounded-lg px-3 py-2.5 transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
            @click="pickVariant(hit)"
          >
            <span class="text-sm font-medium text-gray-900 dark:text-white">{{ hit.item_name || hit.variant_code }}</span>
            <span v-if="hit.variant_code && hit.item_name" class="block text-xs font-mono text-gray-500">{{ hit.variant_code }}</span>
          </li>
        </ul>
        <div class="flex justify-end">
          <button
            type="button"
            class="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            @click="showVariantPicker = false"
          >
            {{ t('actions.cancel') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  AdjustmentsHorizontalIcon,
  GiftIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import { unwrapCatalogApiData, unwrapCatalogApiList } from '@/utils/catalogApi';
import { confirmAction } from '@/composables/useConfirmAction';
import DatePicker from '@/components/common/DatePicker.vue';
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';

const { t } = useI18n();

const panelTabs = [
  { id: 'rules', labelKey: 'settings.pricingTabRules' },
  { id: 'promotions', labelKey: 'settings.pricingTabPromotions' },
  { id: 'preview', labelKey: 'settings.pricingTabPreview' },
];

const dateInputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-white';

const ruleDialogTitleId = 'pricing-rule-dialog-title';
const promoDialogTitleId = 'pricing-promo-dialog-title';
const ruleNameInput = ref(null);
const promoNameInput = ref(null);

const panel = ref('rules');
const flash = ref('');
const error = ref('');
let flashTimer;

const rules = ref([]);
const promotions = ref([]);
const loadingRules = ref(false);
const loadingPromos = ref(false);
const savingRule = ref(false);
const savingPromo = ref(false);

const customerTypes = ref(['RETAIL', 'DEALER', 'DISTRIBUTOR', 'CORPORATE']);
const ruleTypes = ref(['QUANTITY', 'CUSTOMER', 'REGION', 'DATE', 'CONTRACT', 'CHANNEL']);
const promoTypes = ref([
  'PRODUCT_DISCOUNT',
  'ORDER_DISCOUNT',
  'BUY_X_GET_Y',
  'VOLUME_DISCOUNT',
  'CUSTOMER_DISCOUNT',
  'SHIPPING_DISCOUNT',
  'FESTIVAL',
]);

const showRuleForm = ref(false);
const editingRuleId = ref(null);
const ruleForm = reactive({
  name: '',
  ruleType: 'QUANTITY',
  priority: 100,
  status: 'ACTIVE',
  effectiveFrom: '',
  effectiveUntil: '',
  adjustment: { type: 'percent', value: 5 },
  conditions: {
    minQty: null,
    customerTypes: [],
    customerIdsRaw: '',
    regionCodesRaw: '',
  },
});

const showPromoForm = ref(false);
const editingPromoId = ref(null);
const promoForm = reactive({
  name: '',
  promoType: 'PRODUCT_DISCOUNT',
  status: 'ACTIVE',
  priority: 100,
  effectiveFrom: '',
  effectiveUntil: '',
  action: { type: 'percent', value: 10, buyQty: 2, getQty: 1 },
  conditions: { minQty: null, minOrderSubtotal: null },
});

const preview = reactive({
  variantId: '',
  variantLabel: '',
  quantity: 1,
  customerType: '',
  regionCode: '',
});
const previewLoading = ref(false);
const previewResult = ref(null);

const showVariantPicker = ref(false);
const variantSearchQuery = ref('');
const variantSearchResults = ref([]);
const variantSearchLoading = ref(false);
let variantSearchTimer;

const RULE_TYPE_KEYS = {
  QUANTITY: 'settings.pricingRuleTypeQuantity',
  CUSTOMER: 'settings.pricingRuleTypeCustomer',
  REGION: 'settings.pricingRuleTypeRegion',
  DATE: 'settings.pricingRuleTypeDate',
  CONTRACT: 'settings.pricingRuleTypeContract',
  CHANNEL: 'settings.pricingRuleTypeChannel',
};

const PROMO_TYPE_KEYS = {
  PRODUCT_DISCOUNT: 'settings.pricingPromoTypeProduct',
  ORDER_DISCOUNT: 'settings.pricingPromoTypeOrder',
  BUY_X_GET_Y: 'settings.pricingPromoTypeBuyGet',
  VOLUME_DISCOUNT: 'settings.pricingPromoTypeVolume',
  CUSTOMER_DISCOUNT: 'settings.pricingPromoTypeCustomer',
  SHIPPING_DISCOUNT: 'settings.pricingPromoTypeShipping',
  FESTIVAL: 'settings.pricingPromoTypeFestival',
};

const CUSTOMER_TYPE_KEYS = {
  RETAIL: 'settings.pricingCustomerRetail',
  DEALER: 'settings.pricingCustomerDealer',
  DISTRIBUTOR: 'settings.pricingCustomerDistributor',
  CORPORATE: 'settings.pricingCustomerCorporate',
};

function labelRuleType(type) {
  const key = RULE_TYPE_KEYS[type];
  return key ? t(key) : type;
}

function labelPromoType(type) {
  const key = PROMO_TYPE_KEYS[type];
  return key ? t(key) : type;
}

function labelCustomerType(type) {
  const key = CUSTOMER_TYPE_KEYS[type];
  return key ? t(key) : type;
}

const ruleTypeOptions = computed(() =>
  ruleTypes.value.map((rt) => ({ value: rt, label: labelRuleType(rt) }))
);
const promoTypeOptions = computed(() =>
  promoTypes.value.map((pt) => ({ value: pt, label: labelPromoType(pt) }))
);
const ruleAdjOptions = computed(() => [
  { value: 'percent', label: t('settings.pricingAdjPercent') },
  { value: 'amount', label: t('settings.pricingAdjAmount') },
  { value: 'fixed_price', label: t('settings.pricingAdjFixed') },
]);
const promoAdjOptions = computed(() => [
  { value: 'percent', label: t('settings.pricingAdjPercent') },
  { value: 'amount', label: t('settings.pricingAdjAmount') },
]);
const statusOptions = computed(() => [
  { value: 'ACTIVE', label: t('settings.pricingStatusActive') },
  { value: 'INACTIVE', label: t('settings.pricingStatusInactive') },
]);
const previewCustomerTypeOptions = computed(() =>
  customerTypes.value.map((ct) => ({ value: ct, label: labelCustomerType(ct) }))
);

function labelStatus(status) {
  return status === 'INACTIVE' ? t('settings.pricingStatusInactive') : t('settings.pricingStatusActive');
}

function statusBadgeClass(status) {
  return status === 'INACTIVE'
    ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
    : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
}

function labelStepKind(step) {
  if (step.ruleType) return labelRuleType(step.ruleType);
  if (step.promoType) return labelPromoType(step.promoType);
  return step.kind || '—';
}

function formatAdj(adj) {
  if (!adj) return '—';
  if (adj.type === 'percent') return `${adj.value}%`;
  if (adj.type === 'fixed_price') return `= ${adj.value}`;
  return `− ${adj.value}`;
}

function formatPromoAction(promo) {
  if (promo.promoType === 'BUY_X_GET_Y') {
    return t('settings.pricingBuyGetShort', {
      buy: promo.action?.buyQty,
      get: promo.action?.getQty,
    });
  }
  return formatAdj(promo.action);
}

function setFlash(message) {
  flash.value = message;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => {
    flash.value = '';
  }, 3200);
}

function dateInput(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function parseIds(raw) {
  return String(raw || '')
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function toggleRuleCustomerType(ct, checked) {
  const list = ruleForm.conditions.customerTypes;
  const idx = list.indexOf(ct);
  if (checked && idx === -1) list.push(ct);
  if (!checked && idx !== -1) list.splice(idx, 1);
}

async function loadMeta() {
  try {
    const res = await apiClient.get('/pricing/meta');
    const data = unwrapCatalogApiData(res) || {};
    if (data?.customerTypes) customerTypes.value = data.customerTypes;
    if (data?.ruleTypes) ruleTypes.value = data.ruleTypes;
    if (data?.promoTypes) promoTypes.value = data.promoTypes;
  } catch {
    /* meta optional */
  }
}

async function loadRules() {
  loadingRules.value = true;
  try {
    const res = await apiClient.get('/pricing/rules', { params: { includeInactive: true } });
    rules.value = unwrapCatalogApiList(res);
  } catch (err) {
    error.value = err?.response?.data?.message || err?.message || t('settings.pricingLoadFailed');
    rules.value = [];
  } finally {
    loadingRules.value = false;
  }
}

async function loadPromos() {
  loadingPromos.value = true;
  try {
    const res = await apiClient.get('/pricing/promotions', { params: { includeInactive: true } });
    promotions.value = unwrapCatalogApiList(res);
  } catch (err) {
    error.value = err?.response?.data?.message || err?.message || t('settings.pricingLoadFailed');
    promotions.value = [];
  } finally {
    loadingPromos.value = false;
  }
}

function openRuleForm(rule = null) {
  editingRuleId.value = rule?._id || null;
  ruleForm.name = rule?.name || '';
  ruleForm.ruleType = rule?.ruleType || 'QUANTITY';
  ruleForm.priority = rule?.priority ?? 100;
  ruleForm.status = rule?.status || 'ACTIVE';
  ruleForm.effectiveFrom = dateInput(rule?.effectiveFrom);
  ruleForm.effectiveUntil = dateInput(rule?.effectiveUntil);
  ruleForm.adjustment = {
    type: rule?.adjustment?.type || 'percent',
    value: rule?.adjustment?.value ?? 5,
  };
  ruleForm.conditions.minQty = rule?.conditions?.minQty ?? null;
  ruleForm.conditions.customerTypes = [...(rule?.conditions?.customerTypes || [])];
  ruleForm.conditions.customerIdsRaw = (rule?.conditions?.customerIds || []).join(', ');
  ruleForm.conditions.regionCodesRaw = (rule?.conditions?.regionCodes || []).join(', ');
  showRuleForm.value = true;
}

watch(showRuleForm, async (open) => {
  if (!open) return;
  await nextTick();
  ruleNameInput.value?.focus?.();
});

async function saveRule() {
  if (!ruleForm.name.trim() || savingRule.value) return;
  error.value = '';
  savingRule.value = true;
  const payload = {
    name: ruleForm.name.trim(),
    ruleType: ruleForm.ruleType,
    priority: ruleForm.priority,
    status: ruleForm.status,
    effectiveFrom: ruleForm.effectiveFrom || null,
    effectiveUntil: ruleForm.effectiveUntil || null,
    adjustment: { ...ruleForm.adjustment },
    conditions: {
      minQty: ruleForm.conditions.minQty,
      customerTypes: ruleForm.conditions.customerTypes,
      customerIds: parseIds(ruleForm.conditions.customerIdsRaw),
      regionCodes: parseIds(ruleForm.conditions.regionCodesRaw),
    },
  };
  try {
    if (editingRuleId.value) {
      await apiClient.put(`/pricing/rules/${editingRuleId.value}`, payload);
    } else {
      await apiClient.post('/pricing/rules', payload);
    }
    showRuleForm.value = false;
    setFlash(t('settings.pricingSaved'));
    await loadRules();
  } catch (err) {
    error.value = err?.response?.data?.message || err?.message || t('settings.pricingSaveFailed');
  } finally {
    savingRule.value = false;
  }
}

async function removeRule(rule) {
  if (!await confirmAction({
    message: t('settings.pricingConfirmDeleteRule', { name: rule.name }),
    tone: 'danger',
  })) return;
  try {
    await apiClient.delete(`/pricing/rules/${rule._id}`);
    setFlash(t('settings.pricingDeleted'));
    await loadRules();
  } catch (err) {
    error.value = err?.response?.data?.message || err?.message || t('settings.pricingDeleteFailed');
  }
}

function openPromoForm(promo = null) {
  editingPromoId.value = promo?._id || null;
  promoForm.name = promo?.name || '';
  promoForm.promoType = promo?.promoType || 'PRODUCT_DISCOUNT';
  promoForm.status = promo?.status || 'ACTIVE';
  promoForm.priority = promo?.priority ?? 100;
  promoForm.effectiveFrom = dateInput(promo?.effectiveFrom);
  promoForm.effectiveUntil = dateInput(promo?.effectiveUntil);
  promoForm.action = {
    type: promo?.action?.type || 'percent',
    value: promo?.action?.value ?? 10,
    buyQty: promo?.action?.buyQty ?? 2,
    getQty: promo?.action?.getQty ?? 1,
  };
  promoForm.conditions.minQty = promo?.conditions?.minQty ?? null;
  promoForm.conditions.minOrderSubtotal = promo?.conditions?.minOrderSubtotal ?? null;
  showPromoForm.value = true;
}

watch(showPromoForm, async (open) => {
  if (!open) return;
  await nextTick();
  promoNameInput.value?.focus?.();
});

async function savePromo() {
  if (!promoForm.name.trim() || savingPromo.value) return;
  error.value = '';
  savingPromo.value = true;
  const payload = {
    name: promoForm.name.trim(),
    promoType: promoForm.promoType,
    status: promoForm.status,
    priority: promoForm.priority,
    effectiveFrom: promoForm.effectiveFrom || null,
    effectiveUntil: promoForm.effectiveUntil || null,
    action: { ...promoForm.action },
    conditions: {
      minQty: promoForm.conditions.minQty,
      minOrderSubtotal: promoForm.conditions.minOrderSubtotal,
    },
  };
  try {
    if (editingPromoId.value) {
      await apiClient.put(`/pricing/promotions/${editingPromoId.value}`, payload);
    } else {
      await apiClient.post('/pricing/promotions', payload);
    }
    showPromoForm.value = false;
    setFlash(t('settings.pricingSaved'));
    await loadPromos();
  } catch (err) {
    error.value = err?.response?.data?.message || err?.message || t('settings.pricingSaveFailed');
  } finally {
    savingPromo.value = false;
  }
}

async function removePromo(promo) {
  if (!await confirmAction({
    message: t('settings.pricingConfirmDeletePromo', { name: promo.name }),
    tone: 'danger',
  })) return;
  try {
    await apiClient.delete(`/pricing/promotions/${promo._id}`);
    setFlash(t('settings.pricingDeleted'));
    await loadPromos();
  } catch (err) {
    error.value = err?.response?.data?.message || err?.message || t('settings.pricingDeleteFailed');
  }
}

function openVariantPicker() {
  variantSearchQuery.value = '';
  variantSearchResults.value = [];
  showVariantPicker.value = true;
  runVariantSearch();
}

function debouncedVariantSearch() {
  clearTimeout(variantSearchTimer);
  variantSearchTimer = setTimeout(runVariantSearch, 300);
}

async function runVariantSearch() {
  variantSearchLoading.value = true;
  try {
    const res = await apiClient.get('/catalog/variants/search', {
      params: { q: variantSearchQuery.value, limit: 25 },
    });
    const hits = unwrapCatalogApiList(res);
    variantSearchResults.value = Array.isArray(hits) ? hits : [];
  } catch {
    variantSearchResults.value = [];
  } finally {
    variantSearchLoading.value = false;
  }
}

function pickVariant(hit) {
  preview.variantId = hit._id;
  preview.variantLabel = hit.item_name
    ? (hit.variant_code ? `${hit.item_name} (${hit.variant_code})` : hit.item_name)
    : (hit.variant_code || hit._id);
  previewResult.value = null;
  showVariantPicker.value = false;
}

async function runPreview() {
  error.value = '';
  previewResult.value = null;
  if (!preview.variantId) {
    error.value = t('settings.pricingPreviewVariantRequired');
    return;
  }
  previewLoading.value = true;
  try {
    const res = await apiClient.post('/pricing/resolve', {
      variantId: preview.variantId,
      quantity: preview.quantity || 1,
      context: {
        customerType: preview.customerType || undefined,
        regionCode: preview.regionCode || undefined,
      },
    });
    previewResult.value = unwrapCatalogApiData(res);
  } catch (err) {
    error.value = err?.response?.data?.message || err?.message || t('settings.pricingPreviewFailed');
  } finally {
    previewLoading.value = false;
  }
}

onMounted(async () => {
  await loadMeta();
  await Promise.all([loadRules(), loadPromos()]);
});

onUnmounted(() => {
  clearTimeout(flashTimer);
  clearTimeout(variantSearchTimer);
});
</script>
