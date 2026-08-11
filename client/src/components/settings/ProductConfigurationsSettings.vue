<template>
  <div class="space-y-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0">
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('settings.productConfigsDesc') }}</p>
      </div>
      <button
        type="button"
        class="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        :disabled="!itemGroups.length"
        @click="openCreate"
      >
        {{ t('settings.productConfigAdd') }}
      </button>
    </div>

    <div
      v-if="message"
      class="flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-200"
    >
      <span>{{ message }}</span>
      <button type="button" class="shrink-0 text-emerald-600 hover:text-emerald-900 dark:text-emerald-300" :aria-label="t('actions.close')" @click="message = ''">×</button>
    </div>
    <div
      v-if="error"
      class="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-300"
    >
      <span>{{ error }}</span>
      <button type="button" class="shrink-0 text-red-500 hover:text-red-800 dark:text-red-300" :aria-label="t('actions.close')" @click="error = ''">×</button>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
    </div>

    <div
      v-else-if="!itemGroups.length"
      class="rounded-xl border border-dashed border-gray-300 px-4 py-12 text-center dark:border-gray-600"
    >
      <div class="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300">
        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h10M4 18h7" />
        </svg>
      </div>
      <p class="mt-3 text-sm font-medium text-gray-800 dark:text-gray-100">{{ t('settings.productConfigNeedGroup') }}</p>
      <p class="mt-1 text-xs text-gray-500">{{ t('settings.productConfigNeedGroupHint') }}</p>
      <button
        type="button"
        class="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        @click="goItemGroups"
      >
        {{ t('settings.catalogTabItemGroups') }}
      </button>
    </div>

    <div
      v-else-if="!configs.length"
      class="rounded-xl border border-dashed border-gray-300 px-4 py-12 text-center dark:border-gray-600"
    >
      <div class="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300">
        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
          <path stroke-linecap="round" stroke-linejoin="round" d="M11 4H4v7m0 0L12 21l8-10V4h-7" />
        </svg>
      </div>
      <p class="mt-3 text-sm font-medium text-gray-800 dark:text-gray-100">{{ t('settings.productConfigsEmpty') }}</p>
      <p class="mt-1 text-xs text-gray-500">{{ t('settings.productConfigsEmptyHint') }}</p>
      <button
        type="button"
        class="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        @click="openCreate"
      >
        {{ t('settings.productConfigAdd') }}
      </button>
    </div>

    <ul
      v-else
      class="divide-y divide-gray-200 overflow-hidden rounded-xl border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800/40"
    >
      <li
        v-for="c in configs"
        :key="c._id"
        class="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50/90 dark:hover:bg-gray-800/60"
      >
        <button type="button" class="min-w-0 flex-1 text-left" @click="openEdit(c)">
          <div class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span class="truncate text-sm font-semibold text-gray-900 dark:text-white">{{ c.name }}</span>
            <span
              class="inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium"
              :class="c.status === 'ACTIVE'
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'"
            >
              {{ c.status === 'ACTIVE' ? t('settings.productConfigStatusActive') : t('settings.productConfigStatusInactive') }}
            </span>
            <span class="text-[11px] tabular-nums text-gray-400">v{{ c.version || 1 }}</span>
          </div>
          <p class="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
            {{ groupName(c.itemGroupId) }}
            <span v-if="(c.options || []).length"> · {{ t('settings.productConfigOptionCount', { count: c.options.length }) }}</span>
            <span v-if="ruleCount(c)"> · {{ t('settings.productConfigRuleCount', { count: ruleCount(c) }) }}</span>
          </p>
        </button>
        <button
          type="button"
          class="rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          @click="openEdit(c)"
        >
          {{ t('actions.edit') }}
        </button>
        <button
          type="button"
          class="rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          @click="toggleStatus(c)"
        >
          {{ c.status === 'ACTIVE' ? t('settings.productConfigDeactivate') : t('settings.productConfigActivate') }}
        </button>
      </li>
    </ul>

    <!-- Builder: Item Groups pattern — compose left, live sales preview right -->
    <Teleport to="body">
      <div
        v-if="showForm"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-6"
        @click.self="closeForm"
        @keydown.esc="closeForm"
      >
        <form
          class="flex max-h-[min(92vh,920px)] w-full max-w-[96rem] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-800"
          @submit.prevent="save"
        >
          <div class="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
            <div>
              <h3 class="text-base font-semibold text-gray-900 dark:text-white">
                {{ editingId ? t('settings.productConfigEdit') : t('settings.productConfigAdd') }}
              </h3>
              <p class="mt-0.5 text-xs text-gray-500">{{ t('settings.productConfigBuilderDesc') }}</p>
            </div>
            <button
              type="button"
              class="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
              :aria-label="t('actions.cancel')"
              @click="closeForm"
            >
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="grid min-h-0 flex-1 grid-cols-1 divide-y divide-gray-200 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] xl:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)] lg:divide-x lg:divide-y-0 dark:divide-gray-700">
            <!-- LEFT: compose (dominant width) -->
            <div class="min-h-0 min-w-0 space-y-5 overflow-y-auto p-5 sm:p-6">
              <!-- Basics -->
              <section class="space-y-3">
                <div>
                  <p class="text-sm font-medium text-gray-700 dark:text-gray-200">{{ t('settings.productConfigSectionBasics') }}</p>
                  <p class="text-xs text-gray-500">{{ t('settings.productConfigSectionBasicsHint') }}</p>
                </div>
                <label class="block text-sm">
                  <span class="font-medium text-gray-700 dark:text-gray-200">{{ t('settings.productConfigName') }}</span>
                  <input
                    v-model="form.name"
                    required
                    autofocus
                    :placeholder="t('settings.productConfigNamePh')"
                    class="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </label>
                <label class="block text-sm">
                  <span class="font-medium text-gray-700 dark:text-gray-200">{{ t('settings.productConfigItemGroup') }}</span>
                  <select
                    v-model="form.itemGroupId"
                    required
                    class="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="" disabled>{{ t('settings.productConfigItemGroupPick') }}</option>
                    <option v-for="g in itemGroups" :key="g._id" :value="g._id">{{ g.name }}</option>
                  </select>
                </label>
                <label class="block text-sm">
                  <span class="font-medium text-gray-700 dark:text-gray-200">{{ t('settings.productConfigDescription') }}</span>
                  <textarea
                    v-model="form.description"
                    rows="2"
                    :placeholder="t('settings.productConfigDescriptionPh')"
                    class="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                </label>
                <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <label class="block text-sm">
                    <span class="font-medium text-gray-700 dark:text-gray-200">{{ t('settings.productConfigStatus') }}</span>
                    <select
                      v-model="form.status"
                      class="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    >
                      <option value="ACTIVE">{{ t('settings.productConfigStatusActive') }}</option>
                      <option value="INACTIVE">{{ t('settings.productConfigStatusInactive') }}</option>
                    </select>
                  </label>
                  <label class="block text-sm">
                    <span class="font-medium text-gray-700 dark:text-gray-200">{{ t('settings.productConfigEffectiveFrom') }}</span>
                    <input
                      v-model="form.effectiveFrom"
                      type="date"
                      class="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  </label>
                  <label class="block text-sm">
                    <span class="font-medium text-gray-700 dark:text-gray-200">{{ t('settings.productConfigEffectiveUntil') }}</span>
                    <input
                      v-model="form.effectiveUntil"
                      type="date"
                      class="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    />
                  </label>
                </div>
              </section>

              <!-- Options -->
              <section>
                <div class="flex items-center justify-between gap-2">
                  <div>
                    <p class="text-sm font-medium text-gray-700 dark:text-gray-200">{{ t('settings.productConfigSectionOptions') }}</p>
                    <p class="text-xs text-gray-500">{{ t('settings.productConfigOptionsHint') }}</p>
                  </div>
                  <button
                    type="button"
                    class="shrink-0 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                    @click="addOption"
                  >
                    {{ t('settings.productConfigAddOption') }}
                  </button>
                </div>

                <div
                  v-if="!form.options.length"
                  class="mt-3 rounded-lg border border-dashed border-gray-300 px-3 py-6 text-center text-xs text-gray-500 dark:border-gray-600"
                >
                  {{ t('settings.productConfigOptionsEmpty') }}
                </div>

                <ul class="mt-3 space-y-3">
                  <li
                    v-for="(opt, oi) in form.options"
                    :key="opt.uid"
                    class="rounded-xl border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-600 dark:bg-gray-900/40"
                  >
                    <div class="flex items-start gap-3">
                      <div class="min-w-0 flex-1 space-y-3">
                        <input
                          v-model="opt.optionName"
                          :placeholder="t('settings.productConfigOptionNamePh')"
                          class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                          @keydown.enter.prevent
                        />
                        <div class="flex flex-wrap items-center gap-3">
                          <label class="flex min-w-[10rem] flex-1 items-center gap-2 text-xs text-gray-600 dark:text-gray-300 sm:max-w-xs">
                            <span class="shrink-0 font-medium">{{ t('settings.productConfigOptionType') }}</span>
                            <select
                              v-model="opt.optionType"
                              class="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            >
                              <option value="dropdown">{{ t('settings.productConfigTypeDropdown') }}</option>
                              <option value="single_select">{{ t('settings.productConfigTypeSingle') }}</option>
                              <option value="multi_select">{{ t('settings.productConfigTypeMulti') }}</option>
                              <option value="checkbox">{{ t('settings.productConfigTypeCheckbox') }}</option>
                            </select>
                          </label>
                          <label class="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                            <input v-model="opt.required" type="checkbox" class="rounded border-gray-300 text-indigo-600" />
                            {{ t('settings.productConfigRequired') }}
                          </label>
                        </div>

                        <div
                          v-if="opt.optionType !== 'checkbox'"
                          class="flex min-h-[2.5rem] flex-wrap items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 py-2 dark:border-gray-600 dark:bg-gray-700"
                          @click="focusValueInput(oi)"
                        >
                          <span
                            v-for="(val, vi) in opt.values"
                            :key="`${opt.uid}-${val}-${vi}`"
                            class="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200"
                          >
                            {{ val }}
                            <button
                              type="button"
                              class="rounded text-indigo-500 hover:text-indigo-800 dark:hover:text-indigo-100"
                              :aria-label="t('settings.productConfigRemoveValue')"
                              @click.stop="removeOptionValue(oi, vi)"
                            >
                              ×
                            </button>
                          </span>
                          <input
                            :ref="(el) => setValueInputRef(oi, el)"
                            v-model="opt.draft"
                            type="text"
                            :placeholder="opt.values.length ? t('settings.productConfigValueAddMore') : t('settings.productConfigValuePlaceholder')"
                            class="min-w-[8rem] flex-1 border-0 bg-transparent py-0.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-white"
                            @keydown="onValueKeydown($event, oi)"
                            @blur="commitDraft(oi)"
                          />
                        </div>
                        <p v-if="opt.optionType !== 'checkbox'" class="text-[11px] text-gray-400">
                          {{ t('settings.productConfigValueChipHint') }}
                        </p>
                      </div>
                      <div class="flex shrink-0 flex-col gap-1 pt-0.5">
                        <button
                          type="button"
                          class="rounded p-1 text-gray-400 hover:bg-white hover:text-gray-700 disabled:opacity-30 dark:hover:bg-gray-700"
                          :disabled="oi === 0"
                          :title="t('settings.productConfigMoveUp')"
                          @click="moveOption(oi, -1)"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          class="rounded p-1 text-gray-400 hover:bg-white hover:text-gray-700 disabled:opacity-30 dark:hover:bg-gray-700"
                          :disabled="oi === form.options.length - 1"
                          :title="t('settings.productConfigMoveDown')"
                          @click="moveOption(oi, 1)"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          class="rounded p-1 text-gray-400 hover:bg-white hover:text-red-600"
                          :title="t('actions.remove')"
                          @click="form.options.splice(oi, 1)"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  </li>
                </ul>
              </section>

              <!-- Rules -->
              <section class="space-y-4 border-t border-gray-200 pt-5 dark:border-gray-700">
                <div>
                  <p class="text-sm font-medium text-gray-700 dark:text-gray-200">{{ t('settings.productConfigSectionRules') }}</p>
                  <p class="text-xs text-gray-500">{{ t('settings.productConfigSectionRulesHint') }}</p>
                </div>

                <!-- Product rules -->
                <div>
                  <div class="mb-2 flex items-center justify-between">
                    <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">{{ t('settings.productConfigProductRules') }}</p>
                    <button type="button" class="text-xs font-medium text-indigo-600 hover:text-indigo-800" @click="addProductRule">
                      {{ t('settings.productConfigAddRule') }}
                    </button>
                  </div>
                  <div v-if="!form.productRules.length" class="rounded-lg border border-dashed border-gray-200 px-3 py-3 text-xs text-gray-400 dark:border-gray-600">
                    {{ t('settings.productConfigProductRulesEmpty') }}
                  </div>
                  <ul class="space-y-2">
                    <li
                      v-for="(rule, idx) in form.productRules"
                      :key="'pr'+idx"
                      class="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-600 dark:bg-gray-900/30"
                    >
                      <div class="flex flex-wrap items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                        <span class="text-xs text-gray-400">{{ t('settings.productConfigRuleSentence') }}</span>
                        <select v-model="rule.optionName" class="rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                          <option value="">{{ t('settings.productConfigOptionPick') }}</option>
                          <option v-for="o in namedOptions" :key="'pro'+o.optionName" :value="o.optionName">{{ o.optionName }}</option>
                        </select>
                        <select v-model="rule.type" class="rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                          <option value="mandatory">{{ t('settings.productConfigRuleMandatory') }}</option>
                          <option value="min">{{ t('settings.productConfigRuleMin') }}</option>
                          <option value="max">{{ t('settings.productConfigRuleMax') }}</option>
                          <option value="quantity">{{ t('settings.productConfigRuleQty') }}</option>
                        </select>
                        <input
                          v-if="rule.type === 'min' || rule.type === 'max'"
                          v-model.number="rule[rule.type]"
                          type="number"
                          min="0"
                          class="w-16 rounded-lg border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        />
                        <template v-if="rule.type === 'quantity'">
                          <input v-model.number="rule.minQty" type="number" min="0" class="w-16 rounded-lg border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" :placeholder="t('settings.productConfigMinQty')" />
                          <span class="text-xs text-gray-400">–</span>
                          <input v-model.number="rule.maxQty" type="number" min="0" class="w-16 rounded-lg border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" :placeholder="t('settings.productConfigMaxQty')" />
                        </template>
                        <button type="button" class="ml-auto text-xs text-red-600 hover:text-red-800" @click="form.productRules.splice(idx, 1)">
                          {{ t('actions.remove') }}
                        </button>
                      </div>
                    </li>
                  </ul>
                </div>

                <!-- Compatibility -->
                <div>
                  <div class="mb-2 flex items-center justify-between">
                    <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">{{ t('settings.productConfigCompatRules') }}</p>
                    <button type="button" class="text-xs font-medium text-indigo-600 hover:text-indigo-800" @click="addCompatRule">
                      {{ t('settings.productConfigAddRule') }}
                    </button>
                  </div>
                  <div v-if="!form.compatibilityRules.length" class="rounded-lg border border-dashed border-gray-200 px-3 py-3 text-xs text-gray-400 dark:border-gray-600">
                    {{ t('settings.productConfigCompatRulesEmpty') }}
                  </div>
                  <ul class="space-y-2">
                    <li
                      v-for="(rule, idx) in form.compatibilityRules"
                      :key="'cr'+idx"
                      class="space-y-2 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-600 dark:bg-gray-900/30"
                    >
                      <div class="flex flex-wrap items-center gap-2 text-sm">
                        <select v-model="rule.optionA" class="rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" @change="onCompatOptionChange(rule)">
                          <option value="">{{ t('settings.productConfigOptionA') }}</option>
                          <option v-for="o in namedOptions" :key="'ca'+o.optionName" :value="o.optionName">{{ o.optionName }}</option>
                        </select>
                        <select v-model="rule.mode" class="rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                          <option value="incompatible_with">{{ t('settings.productConfigModeIncompat') }}</option>
                          <option value="compatible_with">{{ t('settings.productConfigModeCompat') }}</option>
                        </select>
                        <select v-model="rule.optionB" class="rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" @change="onCompatOptionChange(rule)">
                          <option value="">{{ t('settings.productConfigOptionB') }}</option>
                          <option v-for="o in namedOptions" :key="'cb'+o.optionName" :value="o.optionName">{{ o.optionName }}</option>
                        </select>
                        <button type="button" class="ml-auto text-xs text-red-600" @click="form.compatibilityRules.splice(idx, 1)">{{ t('actions.remove') }}</button>
                      </div>
                      <div v-if="rule.optionA && rule.optionB" class="flex flex-wrap items-center gap-2">
                        <select v-model="rule.draftA" class="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                          <option value="">{{ rule.optionA }}…</option>
                          <option v-for="v in valuesForOptionName(rule.optionA)" :key="'dra'+v" :value="v">{{ v }}</option>
                        </select>
                        <span class="text-xs text-gray-400">+</span>
                        <select v-model="rule.draftB" class="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                          <option value="">{{ rule.optionB }}…</option>
                          <option v-for="v in valuesForOptionName(rule.optionB)" :key="'drb'+v" :value="v">{{ v }}</option>
                        </select>
                        <button
                          type="button"
                          class="rounded-md border border-indigo-200 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-40 dark:border-indigo-800 dark:text-indigo-300"
                          :disabled="!rule.draftA || !rule.draftB"
                          @click="addCompatPair(rule)"
                        >
                          {{ t('settings.productConfigAddPair') }}
                        </button>
                      </div>
                      <div v-if="(rule.pairs || []).length" class="flex flex-wrap gap-1.5">
                        <span
                          v-for="(pair, pi) in rule.pairs"
                          :key="`${pair[0]}|${pair[1]}-${pi}`"
                          class="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200"
                        >
                          {{ pair[0] }} · {{ pair[1] }}
                          <button type="button" class="text-indigo-500 hover:text-indigo-800" @click="rule.pairs.splice(pi, 1)">×</button>
                        </span>
                      </div>
                    </li>
                  </ul>
                </div>

                <!-- Dependencies -->
                <div>
                  <div class="mb-2 flex items-center justify-between">
                    <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">{{ t('settings.productConfigDepRules') }}</p>
                    <button type="button" class="text-xs font-medium text-indigo-600 hover:text-indigo-800" @click="addDepRule">
                      {{ t('settings.productConfigAddRule') }}
                    </button>
                  </div>
                  <p class="mb-2 text-xs text-gray-500">{{ t('settings.productConfigDepRulesHint') }}</p>
                  <div v-if="!form.dependencyRules.length" class="rounded-lg border border-dashed border-gray-200 px-3 py-3 text-xs text-gray-400 dark:border-gray-600">
                    {{ t('settings.productConfigDepRulesEmpty') }}
                  </div>
                  <ul class="space-y-2">
                    <li
                      v-for="(rule, idx) in form.dependencyRules"
                      :key="'dr'+idx"
                      class="space-y-2 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-600 dark:bg-gray-900/30"
                    >
                      <div class="flex flex-wrap items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                        <span class="text-xs text-gray-400">{{ t('settings.productConfigWhen') }}</span>
                        <select
                          v-model="rule.whenOption"
                          class="rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                          @change="onDepWhenOptionChange(rule)"
                        >
                          <option value="">{{ t('settings.productConfigOptionPick') }}</option>
                          <option v-for="o in namedOptions" :key="'dw'+o.optionName" :value="o.optionName">{{ o.optionName }}</option>
                        </select>
                        <select
                          v-if="rule.whenOption && !isCheckboxOptionName(rule.whenOption)"
                          v-model="rule.whenValues"
                          multiple
                          class="min-h-[2rem] min-w-[8rem] rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        >
                          <option v-for="v in valuesForOptionName(rule.whenOption)" :key="'wv'+v" :value="v">{{ v }}</option>
                        </select>
                        <span class="text-xs text-gray-400">{{ t('settings.productConfigThen') }}</span>
                        <select v-model="rule.action" class="rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
                          <option value="require">{{ t('settings.productConfigActionRequire') }}</option>
                          <option value="add">{{ t('settings.productConfigActionAdd') }}</option>
                          <option value="recommend">{{ t('settings.productConfigActionRecommend') }}</option>
                        </select>
                        <select
                          v-model="rule.targetOption"
                          class="rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                          @change="onDepTargetOptionChange(rule)"
                        >
                          <option value="">{{ t('settings.productConfigOptionPick') }}</option>
                          <option
                            v-for="o in namedOptions"
                            :key="'dt'+o.optionName"
                            :value="o.optionName"
                            :disabled="o.optionName === rule.whenOption"
                          >
                            {{ o.optionName }}
                          </option>
                        </select>
                        <select
                          v-if="rule.targetOption && valuesForOptionName(rule.targetOption).length"
                          v-model="rule.targetValue"
                          class="rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                        >
                          <option value="">{{ t('settings.productConfigSelect') }}</option>
                          <option v-for="v in valuesForOptionName(rule.targetOption)" :key="'tv'+v" :value="v">{{ v }}</option>
                        </select>
                        <button type="button" class="ml-auto text-xs text-red-600" @click="form.dependencyRules.splice(idx, 1)">
                          {{ t('actions.remove') }}
                        </button>
                      </div>
                    </li>
                  </ul>
                </div>
              </section>
            </div>

            <!-- RIGHT: live sales configurator (always on) -->
            <div class="flex min-h-0 flex-col bg-slate-50/80 dark:bg-gray-900/50">
              <div class="flex items-center justify-between gap-2 border-b border-gray-200 px-5 py-3 dark:border-gray-700">
                <div>
                  <p class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.productConfigLivePreview') }}</p>
                  <p class="text-xs text-gray-500">{{ t('settings.productConfigPreviewHint') }}</p>
                </div>
                <span
                  class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
                  :class="previewBadgeClass"
                >
                  {{ previewBadgeLabel }}
                </span>
              </div>

              <div class="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
                <div
                  v-if="!namedOptions.length"
                  class="flex h-full min-h-[12rem] flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 px-4 text-center dark:border-gray-600"
                >
                  <p class="text-sm text-gray-600 dark:text-gray-300">{{ t('settings.productConfigPreviewEmpty') }}</p>
                  <p class="mt-1 text-xs text-gray-400">{{ t('settings.productConfigPreviewEmptyHint') }}</p>
                </div>

                <template v-else>
                  <div
                    v-for="opt in namedOptions"
                    :key="'pv-'+opt.optionName"
                    class="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
                  >
                    <p class="text-xs font-medium text-gray-700 dark:text-gray-200">
                      {{ opt.optionName }}
                      <span v-if="opt.required" class="text-red-500">*</span>
                    </p>
                    <div v-if="opt.optionType === 'checkbox'" class="mt-2">
                      <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                        <input
                          v-model="previewSelections[opt.optionName]"
                          type="checkbox"
                          class="rounded border-gray-300 text-indigo-600"
                          @change="runPreviewValidate"
                        />
                        {{ t('settings.productConfigCheckboxTrue') }}
                      </label>
                    </div>
                    <div v-else-if="opt.optionType === 'single_select'" class="mt-2 space-y-1.5">
                      <label
                        v-for="v in optionValues(opt)"
                        :key="v"
                        class="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-900/40"
                        :class="previewSelections[opt.optionName] === v ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''"
                      >
                        <input
                          v-model="previewSelections[opt.optionName]"
                          type="radio"
                          :value="v"
                          class="border-gray-300 text-indigo-600"
                          @change="runPreviewValidate"
                        />
                        {{ v }}
                      </label>
                    </div>
                    <div v-else-if="opt.optionType === 'multi_select'" class="mt-2 space-y-1.5">
                      <label
                        v-for="v in optionValues(opt)"
                        :key="v"
                        class="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-900/40"
                      >
                        <input
                          :checked="Array.isArray(previewSelections[opt.optionName]) && previewSelections[opt.optionName].includes(v)"
                          type="checkbox"
                          class="rounded border-gray-300 text-indigo-600"
                          @change="toggleMulti(opt.optionName, v, $event)"
                        />
                        {{ v }}
                      </label>
                    </div>
                    <select
                      v-else
                      v-model="previewSelections[opt.optionName]"
                      class="mt-2 w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                      @change="runPreviewValidate"
                    >
                      <option value="">{{ t('settings.productConfigSelect') }}</option>
                      <option v-for="v in optionValues(opt)" :key="v" :value="v">{{ v }}</option>
                    </select>
                  </div>

                  <div class="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
                    <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">{{ t('settings.productConfigValidation') }}</p>
                    <div
                      v-if="previewResult?.valid"
                      class="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-200"
                    >
                      {{ t('settings.productConfigValid') }}
                    </div>
                    <ul v-else-if="previewResult?.errors?.length" class="mt-2 space-y-1.5">
                      <li
                        v-for="(e, i) in previewResult.errors"
                        :key="i"
                        class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-200"
                      >
                        {{ e.message }}
                      </li>
                    </ul>
                    <p v-else class="mt-2 text-xs text-gray-500">{{ t('settings.productConfigValidationIdle') }}</p>
                    <div v-if="previewResult?.appliedDependencies?.length" class="mt-3">
                      <p class="text-[11px] font-medium text-gray-500">{{ t('settings.productConfigAppliedDeps') }}</p>
                      <ul class="mt-1 space-y-0.5 text-xs text-gray-700 dark:text-gray-300">
                        <li v-for="(d, i) in previewResult.appliedDependencies" :key="i">
                          {{ d.action }} → {{ d.option }}{{ d.value ? `: ${d.value}` : '' }}
                        </li>
                      </ul>
                    </div>
                  </div>
                </template>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-3 dark:border-gray-700">
            <button
              type="button"
              class="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              @click="closeForm"
            >
              {{ t('actions.cancel') }}
            </button>
            <button
              type="submit"
              class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              :disabled="saving || !canSave"
            >
              {{ saving ? t('states.saving') : t('actions.save') }}
            </button>
          </div>
        </form>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import apiClient from '@/utils/apiClient';

const { t } = useI18n();
const router = useRouter();

const loading = ref(true);
const saving = ref(false);
const configs = ref([]);
const itemGroups = ref([]);
const error = ref('');
const message = ref('');
const showForm = ref(false);
const editingId = ref(null);
const previewSelections = reactive({});
const previewResult = ref(null);
const valueInputRefs = {};
let optUid = 0;
let previewTimer = null;

const emptyForm = () => ({
  name: '',
  itemGroupId: '',
  description: '',
  status: 'ACTIVE',
  effectiveFrom: '',
  effectiveUntil: '',
  options: [],
  productRules: [],
  compatibilityRules: [],
  dependencyRules: [],
});

const form = reactive(emptyForm());

const namedOptions = computed(() =>
  (form.options || []).filter((o) => String(o.optionName || '').trim())
);

const canSave = computed(() => {
  return String(form.name || '').trim() && form.itemGroupId;
});

const previewBadgeClass = computed(() => {
  if (!namedOptions.value.length) {
    return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
  }
  if (previewResult.value?.valid) {
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
  }
  if (previewResult.value?.errors?.length) {
    return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200';
  }
  return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
});

const previewBadgeLabel = computed(() => {
  if (!namedOptions.value.length) return t('settings.productConfigPreviewBadgeEmpty');
  if (previewResult.value?.valid) return t('settings.productConfigPreviewBadgeValid');
  if (previewResult.value?.errors?.length) {
    return t('settings.productConfigPreviewBadgeInvalid', { count: previewResult.value.errors.length });
  }
  return t('settings.productConfigPreviewBadgeIdle');
});

function ruleCount(c) {
  return (c.productRules?.length || 0)
    + (c.compatibilityRules?.length || 0)
    + (c.dependencyRules?.length || 0);
}

function groupName(id) {
  const g = itemGroups.value.find((x) => String(x._id) === String(id));
  return g?.name || '—';
}

function optionValues(opt) {
  if (!opt) return [];
  if (Array.isArray(opt.values) && opt.values.length) return opt.values;
  return [];
}

function findOptionByName(name) {
  if (!name) return null;
  return (form.options || []).find((o) => o.optionName === name) || null;
}

function valuesForOptionName(name) {
  return optionValues(findOptionByName(name));
}

function isCheckboxOptionName(name) {
  return findOptionByName(name)?.optionType === 'checkbox';
}

function goItemGroups() {
  router.push({ path: '/settings', query: { tab: 'catalog', catalogView: 'item-groups' } });
}

function setValueInputRef(oi, el) {
  if (el) valueInputRefs[oi] = el;
}

function focusValueInput(oi) {
  nextTick(() => valueInputRefs[oi]?.focus?.());
}

function commitDraft(oi) {
  const opt = form.options[oi];
  if (!opt) return;
  const val = String(opt.draft || '').trim();
  if (!val) return;
  if (!opt.values.includes(val)) opt.values.push(val);
  opt.draft = '';
  schedulePreviewValidate();
}

function onValueKeydown(e, oi) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    commitDraft(oi);
  } else if (e.key === 'Backspace' && !String(form.options[oi]?.draft || '') && form.options[oi]?.values?.length) {
    form.options[oi].values.pop();
    schedulePreviewValidate();
  }
}

function removeOptionValue(oi, vi) {
  form.options[oi]?.values.splice(vi, 1);
  schedulePreviewValidate();
}

function moveOption(oi, delta) {
  const next = oi + delta;
  if (next < 0 || next >= form.options.length) return;
  const [row] = form.options.splice(oi, 1);
  form.options.splice(next, 0, row);
}

function addOption() {
  form.options.push({
    uid: `opt-${++optUid}`,
    optionName: '',
    optionType: 'dropdown',
    required: false,
    values: [],
    draft: '',
    displayOrder: form.options.length,
    defaultValue: null,
  });
}

function addProductRule() {
  form.productRules.push({ type: 'max', optionName: '', max: 1, min: 1, minQty: null, maxQty: null });
}

function addCompatRule() {
  form.compatibilityRules.push({
    optionA: '',
    optionB: '',
    mode: 'incompatible_with',
    pairs: [],
    draftA: '',
    draftB: '',
  });
}

function onCompatOptionChange(rule) {
  rule.pairs = [];
  rule.draftA = '';
  rule.draftB = '';
}

function addCompatPair(rule) {
  if (!rule.draftA || !rule.draftB) return;
  const exists = (rule.pairs || []).some((p) => p[0] === rule.draftA && p[1] === rule.draftB);
  if (!exists) {
    if (!Array.isArray(rule.pairs)) rule.pairs = [];
    rule.pairs.push([rule.draftA, rule.draftB]);
  }
  rule.draftA = '';
  rule.draftB = '';
  schedulePreviewValidate();
}

function addDepRule() {
  form.dependencyRules.push({
    whenOption: '',
    whenValues: [],
    action: 'require',
    targetOption: '',
    targetValue: '',
  });
}

function onDepWhenOptionChange(rule) {
  rule.whenValues = [];
  if (isCheckboxOptionName(rule.whenOption)) {
    rule.whenValues = ['true'];
  }
  schedulePreviewValidate();
}

function onDepTargetOptionChange(rule) {
  rule.targetValue = '';
  schedulePreviewValidate();
}

function toggleMulti(optionName, value, event) {
  const checked = event?.target?.checked;
  let arr = Array.isArray(previewSelections[optionName]) ? [...previewSelections[optionName]] : [];
  if (checked) {
    if (!arr.includes(value)) arr.push(value);
  } else {
    arr = arr.filter((v) => v !== value);
  }
  previewSelections[optionName] = arr;
  runPreviewValidate();
}

function resetPreviewSelections() {
  Object.keys(previewSelections).forEach((k) => delete previewSelections[k]);
  for (const opt of form.options) {
    if (!opt.optionName) continue;
    if (opt.optionType === 'multi_select') previewSelections[opt.optionName] = [];
    else if (opt.optionType === 'checkbox') previewSelections[opt.optionName] = false;
    else previewSelections[opt.optionName] = '';
  }
}

function hydrateForm(doc) {
  Object.assign(form, emptyForm(), {
    name: doc.name || '',
    itemGroupId: doc.itemGroupId ? String(doc.itemGroupId) : '',
    description: doc.description || '',
    status: doc.status || 'ACTIVE',
    effectiveFrom: doc.effectiveFrom ? String(doc.effectiveFrom).slice(0, 10) : '',
    effectiveUntil: doc.effectiveUntil ? String(doc.effectiveUntil).slice(0, 10) : '',
    options: (doc.options || []).map((o, i) => ({
      uid: `opt-${++optUid}`,
      optionName: o.optionName || '',
      optionType: o.optionType || 'dropdown',
      required: o.required === true,
      values: [...(o.values || [])],
      draft: '',
      displayOrder: o.displayOrder ?? i,
      defaultValue: o.defaultValue ?? null,
    })),
    productRules: (doc.productRules || []).map((r) => ({ ...r })),
    compatibilityRules: (doc.compatibilityRules || []).map((r) => ({
      optionA: r.optionA || '',
      optionB: r.optionB || '',
      mode: r.mode || 'incompatible_with',
      pairs: Array.isArray(r.pairs) && r.pairs.length
        ? r.pairs.map((p) => [String(p[0]), String(p[1])])
        : (Array.isArray(r.incompatible) ? r.incompatible.map((p) => [String(p[0]), String(p[1])]) : []),
      draftA: '',
      draftB: '',
    })),
    dependencyRules: (doc.dependencyRules || []).map((r) => {
      const whenValues = Array.isArray(r.whenValues) && r.whenValues.length
        ? r.whenValues.map(String)
        : (r.whenValue != null ? [String(r.whenValue)] : []);
      return {
        whenOption: r.whenOption || '',
        whenValues,
        action: r.action || (r.requireOption ? 'require' : (r.addOption ? 'add' : 'require')),
        targetOption: r.targetOption || r.requireOption || r.addOption || '',
        targetValue: r.targetValue != null ? String(r.targetValue) : (r.addValue != null ? String(r.addValue) : ''),
      };
    }),
  });
  resetPreviewSelections();
}

function buildPayload() {
  return {
    name: form.name,
    itemGroupId: form.itemGroupId,
    description: form.description || null,
    status: form.status,
    effectiveFrom: form.effectiveFrom || null,
    effectiveUntil: form.effectiveUntil || null,
    options: form.options.map((o, i) => ({
      optionName: o.optionName,
      optionType: o.optionType,
      required: o.required === true,
      values: optionValues(o),
      displayOrder: i,
      defaultValue: o.defaultValue ?? null,
    })),
    productRules: form.productRules.map((r) => ({
      type: r.type,
      optionName: r.optionName || null,
      min: r.min ?? null,
      max: r.max ?? null,
      minQty: r.minQty ?? null,
      maxQty: r.maxQty ?? null,
    })),
    compatibilityRules: form.compatibilityRules.map((r) => ({
      optionA: r.optionA,
      optionB: r.optionB,
      mode: r.mode,
      pairs: Array.isArray(r.pairs) ? r.pairs : [],
    })),
    dependencyRules: form.dependencyRules.map((r) => ({
      whenOption: r.whenOption,
      whenValues: Array.isArray(r.whenValues) ? r.whenValues.map(String) : [],
      action: r.action,
      targetOption: r.targetOption || null,
      targetValue: r.targetValue || null,
    })),
  };
}

function openCreate() {
  editingId.value = null;
  Object.assign(form, emptyForm());
  if (itemGroups.value[0]) form.itemGroupId = String(itemGroups.value[0]._id);
  resetPreviewSelections();
  previewResult.value = null;
  showForm.value = true;
}

function openEdit(doc) {
  editingId.value = doc._id;
  hydrateForm(doc);
  previewResult.value = null;
  showForm.value = true;
  nextTick(() => runPreviewValidate());
}

function closeForm() {
  showForm.value = false;
}

function unwrapList(res) {
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  if (Array.isArray(res)) return res;
  return [];
}

function unwrapPayload(res) {
  if (res?.data != null && typeof res.data === 'object' && !Array.isArray(res.data) && res.success !== undefined) {
    return res.data;
  }
  return res?.data ?? res ?? null;
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const results = await Promise.allSettled([
      apiClient.get('/product-configurations'),
      apiClient.get('/item-groups'),
    ]);
    if (results[0].status === 'fulfilled') {
      configs.value = unwrapList(results[0].value);
    } else {
      configs.value = [];
      error.value = results[0].reason?.response?.data?.message
        || results[0].reason?.message
        || t('states.genericFailure');
    }
    if (results[1].status === 'fulfilled') {
      itemGroups.value = unwrapList(results[1].value);
    } else if (!error.value) {
      itemGroups.value = [];
      error.value = results[1].reason?.response?.data?.message
        || results[1].reason?.message
        || t('states.genericFailure');
    } else {
      itemGroups.value = [];
    }
  } finally {
    loading.value = false;
  }
}

async function save() {
  if (!canSave.value) return;
  // Commit any open chip drafts
  form.options.forEach((_, i) => commitDraft(i));
  saving.value = true;
  error.value = '';
  message.value = '';
  try {
    const payload = buildPayload();
    if (editingId.value) {
      await apiClient.put(`/product-configurations/${editingId.value}`, payload);
      message.value = t('settings.productConfigSaved');
    } else {
      await apiClient.post('/product-configurations', payload);
      message.value = t('settings.productConfigCreated');
    }
    showForm.value = false;
    await load();
  } catch (e) {
    error.value = e?.response?.data?.message || e.message || t('states.genericFailure');
  } finally {
    saving.value = false;
  }
}

async function toggleStatus(c) {
  error.value = '';
  try {
    const status = c.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    await apiClient.patch(`/product-configurations/${c._id}/status`, { status });
    message.value = status === 'ACTIVE'
      ? t('settings.productConfigActivated')
      : t('settings.productConfigDeactivated');
    await load();
  } catch (e) {
    error.value = e?.response?.data?.message || e.message || t('states.genericFailure');
  }
}

function schedulePreviewValidate() {
  if (!showForm.value) return;
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => runPreviewValidate(), 280);
}

async function runPreviewValidate() {
  if (!showForm.value) return;
  if (!namedOptions.value.length) {
    previewResult.value = null;
    return;
  }
  try {
    const configuration = buildPayload();
    const selections = { ...previewSelections };
    const res = await apiClient.post('/product-configurations/validate', {
      configuration,
      selections,
      requireActive: false,
    });
    previewResult.value = unwrapPayload(res) || null;
    if (previewResult.value?.selections) {
      for (const [k, v] of Object.entries(previewResult.value.selections)) {
        previewSelections[k] = v;
      }
    }
  } catch (e) {
    previewResult.value = {
      valid: false,
      errors: [{ message: e?.response?.data?.message || e.message }],
    };
  }
}

watch(
  () => [
    form.name,
    form.options.map((o) => [o.optionName, o.optionType, o.required, [...(o.values || [])]]),
    form.productRules,
    form.compatibilityRules,
    form.dependencyRules,
  ],
  () => {
    // Ensure multi-select keys are arrays
    for (const opt of form.options) {
      if (opt.optionName && opt.optionType === 'multi_select' && !Array.isArray(previewSelections[opt.optionName])) {
        previewSelections[opt.optionName] = [];
      }
    }
    schedulePreviewValidate();
  },
  { deep: true }
);

onMounted(load);
</script>
