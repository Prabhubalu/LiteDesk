<template>
  <TransitionRoot as="template" :show="open">
    <Dialog class="relative z-[10000]" @close="onCancel">
      <TransitionChild
        as="template"
        enter="ease-out duration-200"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-150"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-gray-500/75 dark:bg-gray-900/75 transition-opacity" aria-hidden="true" />
      </TransitionChild>

      <div class="fixed inset-0 z-[10000] w-screen overflow-y-auto p-4 sm:p-6">
        <div class="flex min-h-full items-center justify-center">
          <TransitionChild
            as="template"
            enter="ease-out duration-200"
            enter-from="opacity-0 translate-y-4 sm:scale-95"
            enter-to="opacity-100 translate-y-0 sm:scale-100"
            leave="ease-in duration-150"
            leave-from="opacity-100 translate-y-0 sm:scale-100"
            leave-to="opacity-0 translate-y-4 sm:scale-95"
          >
            <DialogPanel
              class="relative flex w-full max-w-4xl max-h-[90vh] flex-col overflow-hidden rounded-2xl bg-white text-left shadow-xl dark:bg-gray-800"
            >
              <!-- Header -->
              <div class="shrink-0 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <DialogTitle class="text-lg font-semibold text-gray-900 dark:text-white">
                      {{ t('process.expressionModalTitle') }}
                    </DialogTitle>
                    <p class="mt-0.5 truncate text-sm text-gray-500 dark:text-gray-400">
                      {{ fieldLabel || t('process.inspectorExpression') }}
                    </p>
                  </div>
                  <button
                    type="button"
                    class="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                    :aria-label="t('actions.cancel')"
                    @click="onCancel"
                  >
                    <XMarkIcon class="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>

                <!-- Simple | Formula -->
                <div
                  class="mt-3 flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-900/60"
                  role="tablist"
                  :aria-label="t('process.expressionModalTitle')"
                >
                  <button
                    v-for="tab in editorModeTabs"
                    :key="tab.value"
                    type="button"
                    role="tab"
                    :aria-selected="editorMode === tab.value"
                    :class="[
                      'flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                      editorMode === tab.value
                        ? 'bg-white text-indigo-700 shadow-sm dark:bg-gray-700 dark:text-indigo-300'
                        : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
                    ]"
                    @click="setEditorMode(tab.value)"
                  >
                    {{ tab.label }}
                  </button>
                </div>
              </div>

              <!-- Body -->
              <div class="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[1fr_280px]">
                <!-- Left: builder -->
                <div class="flex min-h-0 flex-col overflow-hidden border-b border-gray-200 dark:border-gray-700 md:border-b-0 md:border-r">
                  <!-- Simple -->
                  <div
                    v-if="editorMode === 'simple'"
                    class="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4"
                  >
                    <p class="text-[11px] text-gray-500 dark:text-gray-400">
                      {{ t('process.expressionModalSimpleHint') }}
                    </p>

                    <div class="space-y-2">
                      <div class="flex items-center justify-between gap-2">
                        <label class="text-xs font-medium text-gray-700 dark:text-gray-300">
                          {{ t('process.expressionModalWhen') }}
                        </label>
                        <HeadlessSelect
                          v-if="simple.conditions.length > 1"
                          :model-value="simple.join"
                          :options="joinOptions"
                          :button-class="PROCESS_SELECT_BUTTON_CLASS"
                          :truncate-button-label="false"
                          teleport
                          wrapper-class="w-auto min-w-[10rem]"
                          @update:model-value="(v) => { simple.join = v; syncSimpleToDraft(); }"
                        />
                      </div>

                      <div
                        v-for="(cond, idx) in simple.conditions"
                        :key="idx"
                        class="space-y-2 rounded-xl border border-gray-200 bg-gray-50/80 p-3 dark:border-gray-600 dark:bg-gray-900/40"
                      >
                        <div
                          v-if="idx > 0"
                          class="text-[10px] font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400"
                        >
                          {{ simple.join === 'or' ? t('process.expressionModalJoinOr') : t('process.expressionModalJoinAnd') }}
                        </div>
                        <div class="flex items-start justify-between gap-2">
                          <label class="text-xs font-medium text-gray-700 dark:text-gray-300">
                            {{ t('process.inspectorFieldHeading') }}
                          </label>
                          <button
                            v-if="simple.conditions.length > 1"
                            type="button"
                            class="text-[11px] text-gray-500 hover:text-red-600 dark:hover:text-red-400"
                            @click="removeSimpleCondition(idx)"
                          >
                            {{ t('process.inspectorRemoveCondition') }}
                          </button>
                        </div>
                        <HeadlessSelect
                          :model-value="cond.field"
                          :options="fieldSelectOptions"
                          allow-empty
                          :empty-label="t('process.inspectorSelectField')"
                          :button-class="PROCESS_SELECT_BUTTON_CLASS"
                          searchable
                          teleport
                          @update:model-value="(v) => { cond.field = v; cond.value = ''; syncSimpleToDraft(); }"
                        />

                        <label class="block text-xs font-medium text-gray-700 dark:text-gray-300">
                          {{ t('process.inspectorOperatorHeading') }}
                        </label>
                        <HeadlessSelect
                          :model-value="cond.op"
                          :options="simpleOperatorOptions"
                          :button-class="PROCESS_SELECT_BUTTON_CLASS"
                          teleport
                          @update:model-value="(v) => { cond.op = v; syncSimpleToDraft(); }"
                        />

                        <template v-if="operatorNeedsValue(cond.op)">
                          <label class="block text-xs font-medium text-gray-700 dark:text-gray-300">
                            {{ t('process.inspectorValueHeading') }}
                          </label>
                          <RadioGroup
                            :model-value="cond.valueMode"
                            class="mb-1.5 flex flex-wrap gap-1"
                            @update:model-value="(v) => { cond.valueMode = v; syncSimpleToDraft(); }"
                          >
                            <RadioGroupOption
                              v-for="opt in resultModeOptions"
                              :key="`when-${idx}-${opt.value}`"
                              v-slot="{ checked }"
                              :value="opt.value"
                              as="template"
                            >
                              <button
                                type="button"
                                :class="[
                                  'rounded-md border px-2 py-1 text-[11px] transition-colors',
                                  checked
                                    ? 'border-indigo-400 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                                    : 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-gray-600'
                                ]"
                              >
                                {{ opt.label }}
                              </button>
                            </RadioGroupOption>
                          </RadioGroup>

                          <template v-if="cond.valueMode === 'helper'">
                            <label class="block text-xs font-medium text-gray-700 dark:text-gray-300">
                              {{ t('process.expressionModalPickFunction') }}
                            </label>
                            <HeadlessSelect
                              :model-value="cond.valueHelper"
                              :options="resultHelperOptions"
                              :button-class="PROCESS_SELECT_BUTTON_CLASS"
                              searchable
                              teleport
                              @update:model-value="(v) => { cond.valueHelper = v; syncSimpleToDraft(); }"
                            />
                            <template v-if="resultHelperNeedsField(cond.valueHelper)">
                              <label class="block text-xs font-medium text-gray-700 dark:text-gray-300">
                                {{ t('process.expressionModalApplyToField') }}
                              </label>
                              <HeadlessSelect
                                :model-value="cond.valueHelperField"
                                :options="fieldSelectOptions"
                                allow-empty
                                :empty-label="t('process.inspectorSelectField')"
                                :button-class="PROCESS_SELECT_BUTTON_CLASS"
                                searchable
                                teleport
                                @update:model-value="(v) => { cond.valueHelperField = v; syncSimpleToDraft(); }"
                              />
                            </template>
                            <template v-else-if="resultHelperNeedsDays(cond.valueHelper)">
                              <label class="block text-xs font-medium text-gray-700 dark:text-gray-300">
                                {{ t('process.expressionModalDays') }}
                              </label>
                              <input
                                v-model="cond.valueHelperArg"
                                type="number"
                                min="0"
                                class="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                                @input="syncSimpleToDraft"
                              />
                            </template>
                            <p class="text-[10px] text-gray-500 dark:text-gray-400">
                              {{ t('process.expressionModalHelperHint') }}
                            </p>
                          </template>
                          <HeadlessSelect
                            v-else-if="cond.valueMode === 'field'"
                            :model-value="cond.valueField"
                            :options="fieldSelectOptions"
                            allow-empty
                            :empty-label="t('process.inspectorSelectField')"
                            :button-class="PROCESS_SELECT_BUTTON_CLASS"
                            searchable
                            teleport
                            @update:model-value="(v) => { cond.valueField = v; syncSimpleToDraft(); }"
                          />
                          <HeadlessSelect
                            v-else-if="picklistOptionsForField(cond.field).length"
                            :model-value="cond.value"
                            :options="picklistOptionsForField(cond.field)"
                            allow-empty
                            :empty-label="t('process.inspectorSelectValue')"
                            :button-class="PROCESS_SELECT_BUTTON_CLASS"
                            searchable
                            teleport
                            @update:model-value="(v) => { cond.value = v; syncSimpleToDraft(); }"
                          />
                          <input
                            v-else
                            v-model="cond.value"
                            type="text"
                            class="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                            :placeholder="t('process.expressionModalComparePh')"
                            @input="syncSimpleToDraft"
                          />
                        </template>
                      </div>

                      <button
                        type="button"
                        class="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                        @click="addSimpleCondition"
                      >
                        {{ t('process.expressionModalAddCondition') }}
                      </button>
                    </div>

                    <!-- Then -->
                    <div class="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-800/50 dark:bg-emerald-950/20">
                      <label class="text-xs font-medium text-gray-800 dark:text-gray-200">
                        {{ t('process.expressionModalThen') }}
                      </label>
                      <RadioGroup
                        :model-value="simple.thenMode"
                        class="flex flex-wrap gap-1"
                        @update:model-value="(v) => { simple.thenMode = v; syncSimpleToDraft(); }"
                      >
                        <RadioGroupOption
                          v-for="opt in resultModeOptions"
                          :key="`then-${opt.value}`"
                          v-slot="{ checked }"
                          :value="opt.value"
                          as="template"
                        >
                          <button
                            type="button"
                            :class="[
                              'rounded-md border px-2 py-1 text-[11px] transition-colors',
                              checked
                                ? 'border-indigo-400 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                                : 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-gray-600'
                            ]"
                          >
                            {{ opt.label }}
                          </button>
                        </RadioGroupOption>
                      </RadioGroup>

                      <template v-if="simple.thenMode === 'helper'">
                        <label class="block text-xs font-medium text-gray-700 dark:text-gray-300">
                          {{ t('process.expressionModalPickFunction') }}
                        </label>
                        <HeadlessSelect
                          :model-value="simple.thenHelper"
                          :options="resultHelperOptions"
                          :button-class="PROCESS_SELECT_BUTTON_CLASS"
                          searchable
                          teleport
                          @update:model-value="(v) => { simple.thenHelper = v; syncSimpleToDraft(); }"
                        />
                        <template v-if="resultHelperNeedsField(simple.thenHelper)">
                          <label class="block text-xs font-medium text-gray-700 dark:text-gray-300">
                            {{ t('process.expressionModalApplyToField') }}
                          </label>
                          <HeadlessSelect
                            :model-value="simple.thenHelperField"
                            :options="fieldSelectOptions"
                            allow-empty
                            :empty-label="t('process.inspectorSelectField')"
                            :button-class="PROCESS_SELECT_BUTTON_CLASS"
                            searchable
                            teleport
                            @update:model-value="(v) => { simple.thenHelperField = v; syncSimpleToDraft(); }"
                          />
                        </template>
                        <template v-else-if="resultHelperNeedsDays(simple.thenHelper)">
                          <label class="block text-xs font-medium text-gray-700 dark:text-gray-300">
                            {{ t('process.expressionModalDays') }}
                          </label>
                          <input
                            v-model="simple.thenHelperArg"
                            type="number"
                            min="0"
                            class="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                            @input="syncSimpleToDraft"
                          />
                        </template>
                        <p class="text-[10px] text-gray-500 dark:text-gray-400">
                          {{ t('process.expressionModalHelperHint') }}
                        </p>
                      </template>
                      <HeadlessSelect
                        v-else-if="simple.thenMode === 'field'"
                        :model-value="simple.thenField"
                        :options="fieldSelectOptions"
                        allow-empty
                        :empty-label="t('process.inspectorSelectField')"
                        :button-class="PROCESS_SELECT_BUTTON_CLASS"
                        searchable
                        teleport
                        @update:model-value="(v) => { simple.thenField = v; syncSimpleToDraft(); }"
                      />
                      <HeadlessSelect
                        v-else-if="targetPicklistOptions.length"
                        :model-value="simple.thenValue"
                        :options="targetPicklistOptions"
                        allow-empty
                        :empty-label="t('process.inspectorSelectValue')"
                        :button-class="PROCESS_SELECT_BUTTON_CLASS"
                        searchable
                        teleport
                        @update:model-value="(v) => { simple.thenValue = v; syncSimpleToDraft(); }"
                      />
                      <input
                        v-else
                        v-model="simple.thenValue"
                        type="text"
                        class="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                        :placeholder="t('process.expressionModalThenPh')"
                        @input="syncSimpleToDraft"
                      />
                    </div>

                    <!-- Else -->
                    <div class="space-y-2 rounded-xl border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-800/50 dark:bg-amber-950/20">
                      <label class="text-xs font-medium text-gray-800 dark:text-gray-200">
                        {{ t('process.expressionModalElse') }}
                      </label>
                      <RadioGroup
                        :model-value="simple.elseMode"
                        class="flex flex-wrap gap-1"
                        @update:model-value="(v) => { simple.elseMode = v; syncSimpleToDraft(); }"
                      >
                        <RadioGroupOption
                          v-for="opt in resultModeOptions"
                          :key="`else-${opt.value}`"
                          v-slot="{ checked }"
                          :value="opt.value"
                          as="template"
                        >
                          <button
                            type="button"
                            :class="[
                              'rounded-md border px-2 py-1 text-[11px] transition-colors',
                              checked
                                ? 'border-indigo-400 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                                : 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-gray-600'
                            ]"
                          >
                            {{ opt.label }}
                          </button>
                        </RadioGroupOption>
                      </RadioGroup>

                      <template v-if="simple.elseMode === 'helper'">
                        <label class="block text-xs font-medium text-gray-700 dark:text-gray-300">
                          {{ t('process.expressionModalPickFunction') }}
                        </label>
                        <HeadlessSelect
                          :model-value="simple.elseHelper"
                          :options="resultHelperOptions"
                          :button-class="PROCESS_SELECT_BUTTON_CLASS"
                          searchable
                          teleport
                          @update:model-value="(v) => { simple.elseHelper = v; syncSimpleToDraft(); }"
                        />
                        <template v-if="resultHelperNeedsField(simple.elseHelper)">
                          <label class="block text-xs font-medium text-gray-700 dark:text-gray-300">
                            {{ t('process.expressionModalApplyToField') }}
                          </label>
                          <HeadlessSelect
                            :model-value="simple.elseHelperField"
                            :options="fieldSelectOptions"
                            allow-empty
                            :empty-label="t('process.inspectorSelectField')"
                            :button-class="PROCESS_SELECT_BUTTON_CLASS"
                            searchable
                            teleport
                            @update:model-value="(v) => { simple.elseHelperField = v; syncSimpleToDraft(); }"
                          />
                        </template>
                        <template v-else-if="resultHelperNeedsDays(simple.elseHelper)">
                          <label class="block text-xs font-medium text-gray-700 dark:text-gray-300">
                            {{ t('process.expressionModalDays') }}
                          </label>
                          <input
                            v-model="simple.elseHelperArg"
                            type="number"
                            min="0"
                            class="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                            @input="syncSimpleToDraft"
                          />
                        </template>
                        <p class="text-[10px] text-gray-500 dark:text-gray-400">
                          {{ t('process.expressionModalHelperHint') }}
                        </p>
                      </template>
                      <HeadlessSelect
                        v-else-if="simple.elseMode === 'field'"
                        :model-value="simple.elseField"
                        :options="fieldSelectOptions"
                        allow-empty
                        :empty-label="t('process.inspectorSelectField')"
                        :button-class="PROCESS_SELECT_BUTTON_CLASS"
                        searchable
                        teleport
                        @update:model-value="(v) => { simple.elseField = v; syncSimpleToDraft(); }"
                      />
                      <HeadlessSelect
                        v-else-if="targetPicklistOptions.length"
                        :model-value="simple.elseValue"
                        :options="targetPicklistOptions"
                        allow-empty
                        :empty-label="t('process.inspectorSelectValue')"
                        :button-class="PROCESS_SELECT_BUTTON_CLASS"
                        searchable
                        teleport
                        @update:model-value="(v) => { simple.elseValue = v; syncSimpleToDraft(); }"
                      />
                      <input
                        v-else
                        v-model="simple.elseValue"
                        type="text"
                        class="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                        :placeholder="t('process.expressionModalElsePh')"
                        @input="syncSimpleToDraft"
                      />
                    </div>

                    <div
                      v-if="draft"
                      class="rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
                    >
                      <p class="mb-1 text-[10px] text-gray-500">{{ t('process.expressionModalGenerated') }}</p>
                      <pre class="m-0 break-all whitespace-pre-wrap font-mono text-[11px] text-gray-800 dark:text-gray-200">{{ draft }}</pre>
                    </div>
                  </div>

                  <!-- Formula -->
                  <div v-else class="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <div class="flex items-center justify-between gap-2 px-5 pt-4 pb-2">
                      <label class="text-xs font-medium text-gray-700 dark:text-gray-300">
                        {{ t('process.expressionModalEditor') }}
                      </label>
                      <button
                        type="button"
                        class="text-[11px] text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400"
                        @click="draft = ''"
                      >
                        {{ t('process.expressionModalClear') }}
                      </button>
                    </div>
                    <div class="min-h-0 flex-1 px-5 pb-2">
                      <textarea
                        ref="editorRef"
                        v-model="draft"
                        rows="10"
                        spellcheck="false"
                        class="h-full min-h-[160px] w-full resize-none rounded-xl border border-gray-300 bg-white px-3 py-2.5 font-mono text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                        :placeholder="t('process.inspectorExpressionPh')"
                        @keydown.meta.enter.prevent="onSave"
                        @keydown.ctrl.enter.prevent="onSave"
                      />
                    </div>
                    <p class="px-5 pb-2 text-[11px] text-gray-500 dark:text-gray-400">
                      {{ t('process.expressionModalHint') }}
                    </p>
                  </div>

                  <!-- Preview -->
                  <div class="shrink-0 px-5 pb-4">
                    <div
                      class="rounded-xl border px-3 py-2.5"
                      :class="
                        previewStatus === 'error'
                          ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/30'
                          : 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-800/60 dark:bg-emerald-950/20'
                      "
                    >
                      <div class="mb-1 flex items-center justify-between gap-2">
                        <span class="text-[11px] font-medium text-gray-700 dark:text-gray-300">
                          {{ t('process.expressionModalPreview') }}
                        </span>
                        <span v-if="previewLoading" class="text-[10px] text-gray-400">…</span>
                      </div>
                      <pre
                        v-if="previewStatus === 'error'"
                        class="m-0 break-all whitespace-pre-wrap font-mono text-xs text-red-700 dark:text-red-300"
                      >{{ previewError || t('process.expressionModalPreviewError') }}</pre>
                      <pre
                        v-else-if="previewDisplay !== ''"
                        class="m-0 break-all whitespace-pre-wrap font-mono text-xs text-emerald-900 dark:text-emerald-200"
                      >{{ previewDisplay }}</pre>
                      <p v-else class="m-0 text-xs text-gray-500 dark:text-gray-400">
                        {{ t('process.expressionModalPreviewEmpty') }}
                      </p>
                      <p class="mt-1.5 m-0 text-[10px] text-gray-500 dark:text-gray-400">
                        {{ t('process.expressionModalPreviewSample') }}
                      </p>
                    </div>
                  </div>
                </div>

                <!-- Right: Fields / Helpers -->
                <div class="flex min-h-0 flex-col overflow-hidden bg-gray-50/80 dark:bg-gray-900/40">
                  <div
                    class="flex shrink-0 border-b border-gray-200 dark:border-gray-700"
                    role="tablist"
                  >
                    <button
                      type="button"
                      role="tab"
                      :aria-selected="sideTab === 'mergetags'"
                      :class="sideTabBtnClass('mergetags')"
                      @click="setSideTab('mergetags')"
                    >
                      {{ t('process.expressionModalMergetags') }}
                    </button>
                    <button
                      type="button"
                      role="tab"
                      :aria-selected="sideTab === 'helpers'"
                      :class="sideTabBtnClass('helpers')"
                      @click="setSideTab('helpers')"
                    >
                      {{ t('process.expressionModalHelpers') }}
                    </button>
                  </div>

                  <div class="shrink-0 p-3">
                    <div class="relative">
                      <MagnifyingGlassIcon
                        class="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-gray-400"
                        aria-hidden="true"
                      />
                      <input
                        v-model="search"
                        type="search"
                        class="w-full rounded-lg border border-gray-300 bg-white py-1.5 pr-2.5 pl-8 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                        :placeholder="
                          sideTab === 'mergetags'
                            ? t('process.expressionModalSearchFields')
                            : t('process.expressionModalSearchHelpers')
                        "
                      />
                    </div>
                  </div>

                  <div
                    v-if="sideTab === 'mergetags'"
                    class="min-h-0 flex-1 overflow-y-auto px-3 pb-3"
                  >
                    <div class="space-y-1">
                      <button
                        v-for="tag in filteredMergetags"
                        :key="tag.insert"
                        type="button"
                        class="w-full rounded-lg border border-transparent px-2.5 py-2 text-left transition-colors hover:border-indigo-300 hover:bg-white dark:hover:bg-gray-800"
                        @click="onMergetagClick(tag.insert)"
                      >
                        <div class="truncate text-xs font-medium text-gray-900 dark:text-white">{{ tag.label }}</div>
                        <div class="truncate font-mono text-[10px] text-gray-500">{{ tag.insert }}</div>
                      </button>
                      <p
                        v-if="!filteredMergetags.length"
                        class="px-1 py-4 text-center text-[11px] text-gray-500"
                      >
                        {{ t('process.expressionModalNoResults') }}
                      </p>
                    </div>
                  </div>

                  <div
                    v-else
                    class="flex min-h-0 flex-1 flex-col overflow-hidden"
                  >
                    <div class="shrink-0 px-3 pb-2">
                      <HeadlessSelect
                        :model-value="helperCategory"
                        :options="helperCategoryOptions"
                        :button-class="PROCESS_SELECT_BUTTON_CLASS"
                        teleport
                        @update:model-value="(v) => (helperCategory = v)"
                      />
                    </div>
                    <div class="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-3">
                      <button
                        v-for="helper in filteredHelpers"
                        :key="helper.name"
                        type="button"
                        class="w-full rounded-lg border border-transparent px-2.5 py-2 text-left transition-colors hover:border-indigo-300 hover:bg-white dark:hover:bg-gray-800"
                        @click="insertAtCursor(helperInsertSnippet(helper))"
                      >
                        <div class="flex items-center gap-1.5">
                          <span class="text-xs font-medium text-gray-900 dark:text-white">{{ helper.name }}</span>
                          <span
                            v-if="helper.recommended"
                            class="rounded bg-indigo-100 px-1 py-0.5 text-[9px] tracking-wide text-indigo-700 uppercase dark:bg-indigo-900/40 dark:text-indigo-300"
                          >
                            {{ t('process.formulaCatRecommended') }}
                          </span>
                        </div>
                        <div class="truncate font-mono text-[10px] text-indigo-600/80 dark:text-indigo-400">
                          {{ helperInsertSnippet(helper) }}
                        </div>
                        <div class="mt-0.5 line-clamp-2 text-[10px] text-gray-500">{{ helper.description }}</div>
                      </button>
                      <p
                        v-if="!filteredHelpers.length"
                        class="px-1 py-4 text-center text-[11px] text-gray-500"
                      >
                        {{ t('process.expressionModalNoResults') }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Footer -->
              <div class="flex shrink-0 items-center justify-end gap-2 border-t border-gray-200 bg-white px-5 py-3 dark:border-gray-700 dark:bg-gray-800">
                <button
                  type="button"
                  class="inline-flex justify-center rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-700 dark:text-white dark:ring-gray-600 dark:hover:bg-gray-600"
                  @click="onCancel"
                >
                  {{ t('actions.cancel') }}
                </button>
                <button
                  type="button"
                  class="inline-flex justify-center rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                  @click="onSave"
                >
                  {{ t('process.expressionModalSave') }}
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot,
  RadioGroup,
  RadioGroupOption
} from '@headlessui/vue';
import { XMarkIcon, MagnifyingGlassIcon } from '@heroicons/vue/24/outline';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import { PROCESS_SELECT_BUTTON_CLASS } from '@/utils/processDesignerConstants';
import {
  PROCESS_FORMULA_HELPER_CATEGORIES,
  SIMPLE_CONDITION_OPERATORS,
  SIMPLE_RESULT_HELPERS,
  helpersForCategory,
  helperInsertSnippet,
  compileSimpleIfExpression
} from '@/constants/processFormulaHelperCatalog';
import apiClient from '@/utils/apiClient';

const props = defineProps({
  open: { type: Boolean, default: false },
  modelValue: { type: String, default: '' },
  fieldLabel: { type: String, default: '' },
  /** @type {{ label: string, insert: string, valueInputType?: string, options?: Array<{value:string,label:string}> }[]} */
  mergetags: { type: Array, default: () => [] },
  /** Picklist options for the destination field being set */
  targetFieldOptions: { type: Array, default: () => [] },
  targetValueInputType: { type: String, default: '' },
  /** @type {import('@/constants/processFormulaHelperCatalog').FormulaHelperDef[]} */
  formulaCatalog: { type: Array, default: () => [] }
});

const emit = defineEmits(['update:open', 'save', 'cancel']);

const { t } = useI18n();
const draft = ref('');
const search = ref('');
const sideTab = ref('mergetags');
const helperCategory = ref('recommended');
const editorRef = ref(null);
const editorMode = ref('simple');

function emptyCondition() {
  return {
    field: '',
    op: 'is_not_empty',
    value: '',
    valueMode: 'text',
    valueField: '',
    valueHelper: 'uppercase',
    valueHelperField: '',
    valueHelperArg: '3'
  };
}

const simple = reactive({
  conditions: [emptyCondition()],
  join: 'and',
  thenMode: 'text',
  thenValue: '',
  thenField: '',
  thenHelper: 'uppercase',
  thenHelperField: '',
  thenHelperArg: '3',
  elseMode: 'text',
  elseValue: '',
  elseField: '',
  elseHelper: 'uppercase',
  elseHelperField: '',
  elseHelperArg: '3'
});

const previewDisplay = ref('');
const previewError = ref('');
const previewStatus = ref('empty');
const previewLoading = ref(false);
let previewTimer = null;
let previewSeq = 0;
let syncingFromSimple = false;

const editorModeTabs = computed(() => [
  { value: 'simple', label: t('process.expressionModalModeSimple') },
  { value: 'formula', label: t('process.expressionModalModeFormula') }
]);

const fieldSelectOptions = computed(() =>
  (props.mergetags || [])
    .filter((tag) => String(tag.insert || '').startsWith('trigger.'))
    .map((tag) => ({ value: tag.insert, label: tag.label }))
);

const booleanSelectOptions = computed(() => [
  { value: 'true', label: t('process.inspectorBooleanTrue') },
  { value: 'false', label: t('process.inspectorBooleanFalse') }
]);

const targetPicklistOptions = computed(() => {
  const type = String(props.targetValueInputType || '').toLowerCase();
  if (type === 'boolean') return booleanSelectOptions.value;
  const opts = Array.isArray(props.targetFieldOptions) ? props.targetFieldOptions : [];
  if (opts.length) return opts;
  if (type === 'select' || type === 'multi-select') return opts;
  return [];
});

const mergetagByInsert = computed(() => {
  /** @type {Record<string, { label: string, insert: string, valueInputType?: string, options?: Array<{value:string,label:string}> }>} */
  const map = {};
  for (const tag of props.mergetags || []) {
    if (tag?.insert) map[tag.insert] = tag;
  }
  return map;
});

/**
 * @param {string} fieldPath
 * @returns {Array<{ value: string, label: string }>}
 */
function picklistOptionsForField(fieldPath) {
  const tag = mergetagByInsert.value[String(fieldPath || '')];
  if (!tag) return [];
  const type = String(tag.valueInputType || '').toLowerCase();
  if (type === 'boolean') return booleanSelectOptions.value;
  if (Array.isArray(tag.options) && tag.options.length) return tag.options;
  if (type === 'select' || type === 'multi-select') return tag.options || [];
  return [];
}

const resultModeOptions = computed(() => [
  { value: 'text', label: t('process.expressionModalValueText') },
  { value: 'field', label: t('process.expressionModalValueField') },
  { value: 'helper', label: t('process.expressionModalValueHelper') }
]);

const resultHelperOptions = computed(() =>
  SIMPLE_RESULT_HELPERS.map((h) => ({
    value: h.value,
    label: t(`process.expressionResult_${h.value}`)
  }))
);

function resultHelperNeedsField(helper) {
  return SIMPLE_RESULT_HELPERS.find((h) => h.value === helper)?.arg === 'field';
}

function resultHelperNeedsDays(helper) {
  return SIMPLE_RESULT_HELPERS.find((h) => h.value === helper)?.arg === 'days';
}

const joinOptions = computed(() => [
  { value: 'and', label: t('process.expressionModalJoinAnd') },
  { value: 'or', label: t('process.expressionModalJoinOr') }
]);

const simpleOperatorOptions = computed(() =>
  SIMPLE_CONDITION_OPERATORS.map((op) => ({
    value: op.value,
    label: t(`process.expressionOp_${op.value}`)
  }))
);

const helperCategoryOptions = computed(() =>
  PROCESS_FORMULA_HELPER_CATEGORIES.map((c) => ({
    value: c.value,
    label: t(c.labelKey)
  }))
);

const filteredMergetags = computed(() => {
  const q = search.value.trim().toLowerCase();
  const list = props.mergetags || [];
  if (!q) return list;
  return list.filter(
    (tag) =>
      String(tag.label || '').toLowerCase().includes(q) ||
      String(tag.insert || '').toLowerCase().includes(q)
  );
});

const filteredHelpers = computed(() => {
  const base = helpersForCategory(props.formulaCatalog, helperCategory.value);
  const q = search.value.trim().toLowerCase();
  if (!q) return base;
  return base.filter(
    (h) =>
      h.name.toLowerCase().includes(q) ||
      String(h.signature || '').toLowerCase().includes(q) ||
      String(h.description || '').toLowerCase().includes(q) ||
      helperInsertSnippet(h).toLowerCase().includes(q)
  );
});

function operatorNeedsValue(op) {
  return SIMPLE_CONDITION_OPERATORS.find((o) => o.value === op)?.needsValue === true;
}

function sideTabBtnClass(tab) {
  const active = sideTab.value === tab;
  return [
    'flex-1 px-3 py-2.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500',
    active
      ? 'border-b-2 border-indigo-600 bg-white text-indigo-700 dark:bg-gray-800 dark:text-indigo-300'
      : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
  ];
}

function setSideTab(tab) {
  if (tab === 'helpers' && editorMode.value === 'simple') {
    setEditorMode('formula');
  }
  sideTab.value = tab;
  search.value = '';
}

function syncSimpleToDraft() {
  syncingFromSimple = true;
  draft.value = compileSimpleIfExpression(simple);
  syncingFromSimple = false;
  schedulePreview();
}

function addSimpleCondition() {
  simple.conditions.push(emptyCondition());
  syncSimpleToDraft();
}

function removeSimpleCondition(idx) {
  simple.conditions.splice(idx, 1);
  if (!simple.conditions.length) simple.conditions.push(emptyCondition());
  syncSimpleToDraft();
}

function resetSimpleForm() {
  simple.conditions = [emptyCondition()];
  simple.join = 'and';
  simple.thenMode = 'text';
  simple.thenValue = '';
  simple.thenField = '';
  simple.thenHelper = 'uppercase';
  simple.thenHelperField = '';
  simple.thenHelperArg = '3';
  simple.elseMode = 'text';
  simple.elseValue = '';
  simple.elseField = '';
  simple.elseHelper = 'uppercase';
  simple.elseHelperField = '';
  simple.elseHelperArg = '3';
}

function setEditorMode(mode) {
  if (mode === editorMode.value) return;
  if (mode === 'simple') {
    resetSimpleForm();
    syncSimpleToDraft();
    sideTab.value = 'mergetags';
  }
  editorMode.value = mode;
  nextTick(() => {
    if (mode === 'formula') editorRef.value?.focus?.();
  });
}

function onMergetagClick(insert) {
  if (editorMode.value === 'simple') {
    const first = simple.conditions[0];
    if (first && !first.field) {
      first.field = insert;
      syncSimpleToDraft();
      return;
    }
    if (simple.thenMode === 'field' && !simple.thenField) {
      simple.thenField = insert;
      syncSimpleToDraft();
      return;
    }
    if (simple.elseMode === 'field' && !simple.elseField) {
      simple.elseField = insert;
      syncSimpleToDraft();
      return;
    }
    if (first) {
      first.field = insert;
      syncSimpleToDraft();
    }
    return;
  }
  insertAtCursor(insert);
}

async function refreshPreview() {
  if (!props.open) return;
  const expression = String(draft.value || '');
  if (!expression.trim()) {
    previewDisplay.value = '';
    previewError.value = '';
    previewStatus.value = 'empty';
    previewLoading.value = false;
    return;
  }
  const seq = ++previewSeq;
  previewLoading.value = true;
  try {
    const res = await apiClient.post('/admin/processes/evaluate-expression', { expression });
    if (seq !== previewSeq) return;
    const data = res?.data || {};
    if (data.status === 'error' || data.error) {
      previewStatus.value = 'error';
      previewError.value = data.error || t('process.expressionModalPreviewError');
      previewDisplay.value = '';
    } else {
      previewStatus.value = 'ok';
      previewError.value = '';
      previewDisplay.value = data.display != null ? String(data.display) : String(data.value ?? '');
    }
  } catch (err) {
    if (seq !== previewSeq) return;
    previewStatus.value = 'error';
    previewError.value = err?.message || t('process.expressionModalPreviewError');
    previewDisplay.value = '';
  } finally {
    if (seq === previewSeq) previewLoading.value = false;
  }
}

function schedulePreview() {
  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = setTimeout(() => {
    previewTimer = null;
    refreshPreview();
  }, 350);
}

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) {
      if (previewTimer) clearTimeout(previewTimer);
      return;
    }
    draft.value = props.modelValue || '';
    search.value = '';
    sideTab.value = 'mergetags';
    resetSimpleForm();
    const existing = String(props.modelValue || '').trim();
    editorMode.value = existing ? 'formula' : 'simple';
    if (editorMode.value === 'simple') {
      syncSimpleToDraft();
    }
    await nextTick();
    if (editorMode.value === 'formula') editorRef.value?.focus?.();
    schedulePreview();
  }
);

watch(draft, () => {
  if (!props.open || syncingFromSimple) return;
  schedulePreview();
});

onBeforeUnmount(() => {
  if (previewTimer) clearTimeout(previewTimer);
});

function insertAtCursor(text) {
  const el = editorRef.value;
  const insert = String(text || '');
  if (!insert) return;
  if (!el) {
    draft.value = `${draft.value || ''}${insert}`;
    return;
  }
  const start = el.selectionStart ?? draft.value.length;
  const end = el.selectionEnd ?? draft.value.length;
  const before = draft.value.slice(0, start);
  const after = draft.value.slice(end);
  draft.value = `${before}${insert}${after}`;
  nextTick(() => {
    el.focus();
    const pos = start + insert.length;
    el.setSelectionRange(pos, pos);
  });
}

function onSave() {
  if (editorMode.value === 'simple') syncSimpleToDraft();
  emit('save', String(draft.value || '').trim());
  emit('update:open', false);
}

function onCancel() {
  emit('cancel');
  emit('update:open', false);
}
</script>
