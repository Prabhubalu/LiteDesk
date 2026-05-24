<template>
  <div class="w-full h-full flex flex-col min-h-0">
    <!-- Status Indicator Banner -->
    <!-- Only show Draft banner if form has been saved (has _id) -->
    <div
      v-if="isLocked || isReadOnly || (formStatus === 'Draft' && form?._id)"
      class="mb-4 p-4 rounded-lg border"
      :class="{
        'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800': isLocked,
        'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700': isReadOnly,
        'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800': formStatus === 'Draft' && !isLocked && !isReadOnly
      }"
    >
      <div class="flex items-start gap-3">
        <div
          class="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
          :class="{
            'bg-yellow-100 dark:bg-yellow-900/30': isLocked,
            'bg-gray-100 dark:bg-gray-700': isReadOnly
          }"
        >
          <svg
            v-if="isLocked"
            class="w-3 h-3 text-yellow-600 dark:text-yellow-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <svg
            v-else-if="isReadOnly"
            class="w-3 h-3 text-gray-600 dark:text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <p
            class="text-sm font-medium"
            :class="{
              'text-yellow-800 dark:text-yellow-200': isLocked,
              'text-gray-800 dark:text-gray-200': isReadOnly,
              'text-blue-800 dark:text-blue-200': formStatus === 'Draft' && !isLocked && !isReadOnly
            }"
          >
            <span v-if="isLocked">
              {{ t('forms.builderBannerActiveBefore') }}<strong>{{ t('forms.statusActive') }}</strong>{{ t('forms.builderBannerActiveAfter') }}
            </span>
            <span v-else-if="isReadOnly">
              {{ t('forms.builderBannerArchivedBefore') }}<strong>{{ t('forms.statusArchived') }}</strong>{{ t('forms.builderBannerArchivedAfter') }}
            </span>
            <span v-else-if="formStatus === 'Draft'">
              {{ t('forms.builderBannerDraftBefore') }}<strong>{{ t('forms.statusDraft') }}</strong>{{ t('forms.builderBannerDraftMiddle') }}{{ t('forms.statusReady') }}{{ t('forms.builderBannerDraftEnd') }}
            </span>
          </p>
          <p
            v-if="isLocked"
            class="text-xs mt-1"
            :class="{
              'text-yellow-700 dark:text-yellow-300': isLocked
            }"
          >
            {{ t('forms.builderBannerStructuralNote') }}
          </p>
        </div>
        <div
          v-if="isLocked || (formStatus === 'Draft' && form?._id)"
          class="flex-shrink-0"
        >
          <span
            class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium"
            :class="{
              'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200': isLocked,
              'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200': formStatus === 'Draft' && !isLocked
            }"
          >
            {{ statusInfo.label }}
          </span>
        </div>
      </div>
    </div>

    <!-- Flat mode: Show questions directly without sections panel -->
    <div
      v-if="isFlatMode && visibleSections.length === 0"
      class="grid grid-cols-1 gap-4 items-start"
    >
      <!-- Center: Canvas for flat mode -->
      <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 flex flex-col min-h-[600px]">
        <div class="flex items-center justify-between mb-5 pb-4 border-b border-gray-100 dark:border-gray-700">
          <div>
            <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              {{ t('forms.builderQuestionsHeading') }}
            </p>
            <p class="text-base font-semibold text-gray-900 dark:text-white">
              {{ t('forms.builderQuestionCount', { count: rootQuestions.length }) }}
            </p>
          </div>
    </div>

        <div class="flex-1 flex flex-col gap-4">
          <!-- Question list as cards -->
          <div class="grid grid-cols-1 gap-4">
      <div
              v-for="(question, qIdx) in rootQuestions"
              :key="question.questionId || qIdx"
              data-question-card
        :draggable="true"
              @dragstart="(e) => handleRootQuestionDragStart(e, qIdx)"
              @dragover.prevent="(e) => handleRootQuestionDragOver(e, qIdx)"
              @dragleave="handleRootQuestionDragLeave"
              @drop="(e) => handleRootQuestionDrop(e, qIdx)"
              @dragend="handleRootQuestionDragEnd"
              class="rounded-xl border cursor-pointer transition-all duration-200 group bg-white dark:bg-gray-800/50 hover:shadow-md"
              :class="[
                draggedRootQuestionIndex === qIdx
                  ? 'opacity-50 border-gray-300 dark:border-gray-600'
                  : dragOverRootQuestionIndex === qIdx
                    ? 'border-indigo-500 border-2 bg-indigo-50 dark:bg-indigo-900/20 shadow-lg'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600',
                selectedQuestionIndex === qIdx && selectedRootQuestion ? 'ring-2 ring-indigo-500 ring-offset-2 border-indigo-500 shadow-lg bg-indigo-50/30 dark:bg-indigo-900/20' : ''
              ]"
              @click.stop="selectRootQuestion(qIdx)"
            >
              <div class="flex items-start justify-between gap-4 px-4 py-4">
                <div class="flex items-start gap-3 flex-1 min-w-0">
                  <svg
                    class="w-5 h-5 text-gray-300 dark:text-gray-600 cursor-move flex-shrink-0 mt-0.5 group-hover:text-gray-400 dark:group-hover:text-gray-500 transition-colors"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16" />
            </svg>
                  <div class="flex-1 min-w-0">
              <input
                      v-model="question.questionText"
                type="text"
                      :placeholder="t('forms.builderNewQuestionPh')"
                      class="w-full text-base font-medium text-gray-900 dark:text-white bg-transparent border-none focus:outline-none focus:ring-0 placeholder-gray-400 dark:placeholder-gray-500"
              />
                <input
                      v-model="question.helpText"
                      type="text"
                      :placeholder="t('forms.builderHelpTextPh')"
                      class="mt-2 w-full text-sm text-gray-500 dark:text-gray-400 bg-transparent border-none focus:outline-none focus:ring-0 placeholder-gray-400 dark:placeholder-gray-500"
                    />
                    <div class="flex flex-wrap items-center gap-2 mt-3">
                      <span
                        class="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 capitalize"
                      >
                        {{ questionTypeLabel(question.type) }}
                      </span>
                      <span
                        v-if="question.mandatory"
                        class="inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                      >
                        {{ t('forms.builderRequired') }}
                      </span>
              </div>
            </div>
          </div>
                <div class="flex flex-col items-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
                    @click.stop="duplicateRootQuestion(qIdx)"
                    class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all duration-200 cursor-pointer"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
            </svg>
          </button>
              <button
                    @click.stop="removeRootQuestion(qIdx)"
                    class="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all duration-200 cursor-pointer"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
                </div>
              </div>
            </div>
            </div>

          <!-- Question palette -->
          <div class="mt-6 pt-5 border-t border-gray-200 dark:border-gray-700">
            <p class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              {{ t('forms.builderAddQuestion') }}
            </p>
            <div class="flex flex-wrap gap-2.5">
              <button
                v-for="qt in questionPalette"
                :key="qt.type"
                @click="addRootQuestion(qt.type)"
                class="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-all duration-200 cursor-pointer shadow-sm hover:shadow"
                :class="qt.primary
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-900/30 dark:text-indigo-200 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 hover:border-indigo-600'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600'"
              >
                <span>{{ qt.label }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Inspector for flat mode -->
      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5 flex flex-col">
        <div class="flex items-center justify-between mb-4 pb-3 border-b border-gray-100 dark:border-gray-700">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
            {{ t('forms.builderInspector') }}
          </h3>
          <span v-if="selectedRootQuestion" class="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2.5 py-1 rounded-full font-medium">
            {{ t('forms.builderQuestionIndex', { number: (selectedQuestionIndex !== null ? selectedQuestionIndex : 0) + 1 }) }}
          </span>
        </div>
        <div v-if="selectedRootQuestion" class="space-y-5 overflow-y-auto max-h-[600px] pr-1 -mr-1 text-sm">
          <!-- Question basics -->
          <div class="space-y-4">
            <div>
              <p class="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-4">
                {{ t('forms.builderBasics') }}
              </p>
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('forms.builderQuestionText') }}</label>
                        <input
                    v-model="selectedRootQuestion.questionText"
                          type="text"
                    data-question-settings-text-input="true"
                    :placeholder="t('forms.builderNewQuestionPh')"
                    class="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('forms.builderDescriptionHelpText') }}</label>
                  <textarea
                    v-model="selectedRootQuestion.helpText"
                    rows="3"
                    class="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none transition-all"
                    :placeholder="t('forms.builderHelpTextInspectorPh')"
                  ></textarea>
                </div>
                <div class="flex items-end gap-3">
                  <div class="flex-1">
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('forms.builderType') }}</label>
                        <select
                      v-model="selectedRootQuestion.type"
                      class="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all cursor-pointer"
                        >
                          <option
                            v-for="opt in questionTypeOptions"
                            :key="opt.value"
                            :value="opt.value"
                          >
                            {{ opt.label }}
                          </option>
                        </select>
                  </div>
                  <label class="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all" @click.stop @mousedown.stop>
                          <HeadlessCheckbox
                      v-model="selectedRootQuestion.mandatory"
                      @click.stop="handleQuestionSettingsFocus"
                      @mousedown.stop
                      @change.stop
                      @focus="handleQuestionSettingsFocus"
                      @blur="handleQuestionSettingsBlur"
                      checkbox-class="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
                          />
                    <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('forms.builderRequired') }}</span>
                        </label>
                        </div>
                      </div>
                    </div>

            <!-- Dropdown options -->
            <div v-if="selectedRootQuestion.type === 'Dropdown'" class="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p class="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                {{ t('forms.builderOptions') }}
              </p>
              <div class="space-y-2">
                <div
                  v-for="(option, optIdx) in selectedRootQuestion.options || []"
                  :key="optIdx"
                  class="flex items-center gap-2"
                >
                  <input
                    v-model="selectedRootQuestion.options[optIdx]"
                    type="text"
                    :placeholder="t('forms.builderOptionNumber', { number: optIdx + 1 })"
                    class="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                  />
                    <button
                    @click="removeRootQuestionOption(optIdx)"
                    class="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all duration-200 cursor-pointer"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                </div>
                <button
                  @click="addRootQuestionOption"
                  class="w-full inline-flex items-center justify-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 px-3 py-2 rounded-lg border border-dashed border-indigo-300 dark:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all duration-200 cursor-pointer font-medium"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                  </svg>
                  {{ t('forms.builderAddOption') }}
                </button>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="flex-1 flex flex-col items-center justify-center text-center text-gray-400 dark:text-gray-500 py-12">
          <svg class="w-12 h-12 mb-3 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('forms.builderSelectQuestionEmpty') }}</p>
        </div>
      </div>
                  </div>

    <!-- Structured mode: Show 3-panel layout with sections (Audit mode or flat mode with visible sections) -->
    <div
      v-else-if="visibleSections.length > 0 || isAuditMode"
      class="grid grid-cols-1 md:grid-cols-12 flex-1 min-h-0 items-stretch"
      style="height: 100%;"
    >
      <!-- Left: Structure Panel -->
      <div class="col-span-1 md:col-span-3 bg-white dark:bg-gray-900 flex flex-col min-h-0 border-r border-gray-200 dark:border-gray-800 rounded-tl-lg rounded-bl-lg" style="height: 100%;">
        <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {{ t('forms.builderStructure') }}
          </h3>
          <button
            type="button"
            @click.stop="addSection()"
            :disabled="!canModifyFormStructure"
            :title="!canModifyFormStructure ? getBlockingMessage(formStatus) : t('forms.builderTitleAddSection')"
            class="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            :class="!canModifyFormStructure ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        {{ t('forms.builderAddSection') }}
      </button>
    </div>

        <div ref="structureScrollContainer" data-structure-scroll-container class="flex-1 overflow-y-auto p-2">
      <div
            v-for="(section, sIdx) in visibleSections"
            :key="section.sectionId || sIdx"
            :ref="el => { if (el && sIdx !== undefined) sectionRefs[sIdx] = el }"
        :draggable="true"
            @dragstart="(e) => handleSectionDragStart(e, getActualSectionIndex(section))"
            @dragover.prevent="(e) => handleSectionDragOver(e, getActualSectionIndex(section))"
        @dragleave="handleSectionDragLeave"
            @drop="(e) => handleSectionDrop(e, getActualSectionIndex(section))"
        @dragend="handleSectionDragEnd"
            class="group"
            :class="[
              draggedSectionIndex === getActualSectionIndex(section) ? 'opacity-50' : ''
            ]"
      >
        <!-- Section Header -->
            <div class="flex items-center gap-2 group mb-1">
              <button
                @click.stop="toggleSectionExpand(section.sectionId)"
                class="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
              >
                <svg
                  class="w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform"
                  :class="{ 'rotate-90': expandedSections[section.sectionId] }"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
              </button>
              
              <div
                @click.stop="(e) => {
                  // Don't select section if clicking directly on the input
                  if (e.target.tagName !== 'INPUT') {
                    // Blur any currently focused section input
                    try {
                      if (focusedSectionId?.value && sectionInputRefs?.value?.[focusedSectionId.value]) {
                        sectionInputRefs.value[focusedSectionId.value].blur();
                      }
                    } catch (err) {
                      // Ignore blur errors
                    }
                    // Blur any currently focused subsection input
                    try {
                      if (focusedSubsectionId?.value && subsectionInputRefs?.value?.[focusedSubsectionId.value]) {
                        subsectionInputRefs.value[focusedSubsectionId.value].blur();
                      }
                    } catch (err) {
                      // Ignore blur errors
                    }
                    
                    const actualIndex = getActualSectionIndex(section);
                    // Always select just the section (not a subsection) when clicking on section header
                    // Pass skipAutoSelectQuestion=true to show section settings instead of auto-selecting a question
                    // This allows users to configure section scoring settings
                    selectSection(actualIndex, true, true);
                  }
                }"
                class="flex-1 flex items-center gap-2 px-2 py-1.5 cursor-pointer transition-colors"
                :class="[
                  selectedSectionIndex === getActualSectionIndex(section) && selectedSubsectionIndex === null
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 border-l-2 border-indigo-500'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                ]"
              >
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {{ t('forms.builderSectionNumber', { number: sIdx + 1 }) }}
                </span>
              <input
                  :ref="(el) => setSectionInputRef(el, section.sectionId)"
                v-model="section.name"
                type="text"
                :placeholder="structureSectionNamePh"
                  class="flex-1 text-sm font-medium text-gray-900 dark:text-white bg-transparent border-none focus:outline-none focus:ring-0 p-0 placeholder-gray-400 dark:placeholder-gray-500"
                  @click.stop="(e) => handleSectionInputClick(e, getActualSectionIndex(section))"
                  @focus="() => { selectSection(getActualSectionIndex(section), true, true); focusedSectionId = section.sectionId; }"
                  @blur="handleSectionNameBlur"
                />
              </div>
              
          <button
                v-if="!isAuditMode || visibleSections.length > 1"
                @click.stop="removeSection(getActualSectionIndex(section))"
                :disabled="!canModifyFormStructure"
                :title="!canModifyFormStructure ? getBlockingMessage(formStatus) : t('forms.builderTitleRemoveSection')"
                class="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors opacity-0 group-hover:opacity-100"
                :class="!canModifyFormStructure ? 'opacity-30 cursor-not-allowed' : ''"
          >
                <svg class="w-4 h-4 text-gray-400 hover:text-red-600 dark:hover:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>

            <!-- Subsections list (shown when expanded and has subsections) -->
            <div v-if="expandedSections[section.sectionId] && section.subsections && section.subsections.length > 0" class="ml-6 mt-1 space-y-1">
              <!-- Debug: Check if this div is rendering -->
              <!-- {{ console.log('Subsections div rendering for section:', section.sectionId, 'Expanded:', expandedSections[section.sectionId], 'Subsections:', section.subsections?.length) || '' }} -->
          <div
                v-for="(sub, subIdx) in section.subsections"
                :key="sub.subsectionId || subIdx"
            :draggable="true"
                @dragstart="(e) => handleSubsectionDragStart(e, getActualSectionIndex(section), subIdx)"
                @dragover.prevent="(e) => handleSubsectionDragOver(e, getActualSectionIndex(section), subIdx)"
            @dragleave="handleSubsectionDragLeave"
                @drop="(e) => handleSubsectionDrop(e, getActualSectionIndex(section), subIdx)"
            @dragend="handleSubsectionDragEnd"
                class="flex items-center gap-2 group/subsection rounded transition-colors"
                :class="[
                  selectedSectionIndex === getActualSectionIndex(section) && selectedSubsectionIndex === subIdx
                    ? 'bg-indigo-50 dark:bg-indigo-900/20'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                ]"
              >
                <!-- Drag handle (hamburger icon) -->
                <svg
                  class="w-4 h-4 text-gray-400 cursor-move opacity-0 group-hover/subsection:opacity-100 transition-opacity"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                
                <!-- Subsection content -->
                <div
                  @click.stop="selectSubsection(getActualSectionIndex(section), subIdx, true)"
                  class="flex-1 flex items-center px-2 py-1.5 cursor-pointer"
                  :class="[
                    selectedSectionIndex === getActualSectionIndex(section) && selectedSubsectionIndex === subIdx
                      ? 'border-l-2 border-indigo-500'
                      : ''
                  ]"
                >
                <input
                    :ref="(el) => setSubsectionInputRef(el, sub.subsectionId)"
                    :data-subsection-id="sub.subsectionId"
                    v-model="sub.name"
                  type="text"
                  :placeholder="structureSubsectionNamePh"
                    class="flex-1 text-sm bg-transparent border-none focus:outline-none focus:ring-0 p-0 placeholder-gray-400 dark:placeholder-gray-500"
                    :class="[
                      selectedSectionIndex === getActualSectionIndex(section) && selectedSubsectionIndex === subIdx
                        ? 'text-indigo-600 dark:text-indigo-400 font-medium'
                        : 'text-gray-600 dark:text-gray-400'
                    ]"
                    @click.stop="(e) => handleSubsectionInputClick(e, getActualSectionIndex(section), subIdx)"
                    @focus="() => { selectSubsection(getActualSectionIndex(section), subIdx, true); focusedSubsectionId = sub.subsectionId; }"
                    @blur="handleSubsectionNameBlur"
                />
              </div>
                
                <!-- Action buttons -->
                <div class="relative flex items-center gap-1 opacity-0 group-hover/subsection:opacity-100 transition-opacity" data-subsection-menu-root>
              <button
                    type="button"
                    @click.stop="(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const actualIndex = getActualSectionIndex(section);
                      console.log('Add subsection (inline) clicked, section:', section.name, 'actualIndex:', actualIndex);
                      if (actualIndex >= 0) {
                        addSubsection(actualIndex);
                      } else {
                        console.error('Could not find section index for:', section);
                      }
                    }"
                    class="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                  >
                    {{ t('forms.builderAddInline') }}
                  </button>
                  <button
                    type="button"
                    @click.stop="toggleSubsectionMenu(getActualSectionIndex(section), subIdx)"
                    class="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                    :title="t('forms.builderSubsectionActions')"
                  >
                    ...
              </button>
                  <div
                    v-if="openSubsectionMenuKey === `${getActualSectionIndex(section)}-${subIdx}`"
                    class="absolute right-0 top-full z-20 mt-1 min-w-[130px] rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg py-1"
                    data-subsection-menu
                  >
                    <button
                      type="button"
                      class="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                      @click.stop="duplicateSubsectionFromMenu(getActualSectionIndex(section), subIdx)"
                      :disabled="!canModifyFormStructure"
                      :title="!canModifyFormStructure ? getBlockingMessage(formStatus) : t('forms.builderTitleDuplicateSubsection')"
                    >
                      {{ t('forms.builderDuplicate') }}
                    </button>
                    <button
                      type="button"
                      class="w-full text-left px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                      @click.stop="deleteSubsectionFromMenu(getActualSectionIndex(section), subIdx)"
                      :disabled="!canModifyFormStructure"
                      :title="!canModifyFormStructure ? getBlockingMessage(formStatus) : t('forms.builderTitleDeleteSubsection')"
                    >
                      {{ t('forms.builderDelete') }}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Add subsection button (always visible below section header when expanded, appears after subsections) -->
            <div v-show="expandedSections[section.sectionId] || selectedSectionIndex === getActualSectionIndex(section)" class="ml-6 mt-1">
              <button
                type="button"
                @click.stop="(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  // Ensure section is expanded FIRST (synchronously)
                  if (section.sectionId) {
                    expandedSections[section.sectionId] = true;
                  }
                  // Get index and add subsection immediately (Vue reactivity will handle DOM updates)
                  const actualIndex = getActualSectionIndex(section);
                  console.log('Add subsection button clicked, section:', section.name || section.sectionId, 'actualIndex:', actualIndex);
                  if (actualIndex >= 0) {
                    addSubsection(actualIndex);
                  } else {
                    console.error('Could not find section index for:', section);
                    // Fallback: try using the loop index
                    const visibleIndex = visibleSections.findIndex(s => s.sectionId === section.sectionId);
                    if (visibleIndex >= 0) {
                      const fallbackIndex = localForm.value.sections.findIndex(s => s.sectionId === section.sectionId);
                      if (fallbackIndex >= 0) {
                        console.log('Using fallback index:', fallbackIndex);
                        addSubsection(fallbackIndex);
                      }
                    }
                  }
                }"
                class="px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
              >
                {{ t('forms.builderAddSubsection') }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Center: Canvas -->
      <div class="col-span-1 md:col-span-6 bg-white dark:bg-gray-900 flex flex-col min-h-0 border-r border-gray-200 dark:border-gray-800" style="height: 100%;">
        <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div>
            <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{{ t('forms.builderCanvas') }}</p>
            <div class="flex items-center gap-2">
              <h3 class="text-base font-medium text-gray-900 dark:text-white">
                {{ currentSubsectionTitle }}
              </h3>
              <span class="text-sm text-gray-500 dark:text-gray-400">•</span>
              <span class="text-sm text-gray-500 dark:text-gray-400">{{ t('forms.builderCanvasQuestionCount', { count: currentQuestions.length }) }}</span>
            </div>
          </div>
          <button
            @click="openPreview"
            class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
          >{{ t('forms.builderPreview') }}</button>
        </div>

        <div
          v-if="currentSection"
          class="flex-1 flex flex-col min-h-0"
        >
          <!-- Scrollable question list -->
          <div ref="questionsScrollContainer" class="flex-1 overflow-y-auto p-6">
            <!-- Question list as cards -->
            <div class="space-y-3">
              <div
                v-for="(question, qIdx) in currentQuestions"
                :key="question.questionId || qIdx"
                data-question-card
                :ref="el => { if (el && qIdx !== undefined) questionRefs[qIdx] = el }"
                  :draggable="true"
                @dragstart="(e) => handleQuestionDragStart(e, selectedSectionIndex, selectedSubsectionIndex, qIdx)"
                @dragover.prevent="(e) => handleQuestionDragOver(e, selectedSectionIndex, selectedSubsectionIndex, qIdx)"
                  @dragleave="handleQuestionDragLeave"
                @drop="(e) => handleQuestionDrop(e, selectedSectionIndex, selectedSubsectionIndex, qIdx)"
                  @dragend="handleQuestionDragEnd"
                class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer transition-all group"
                :class="[
                  draggedQuestionIndex === qIdx &&
                  draggedQuestionSubsectionIndex === selectedSubsectionIndex &&
                  draggedQuestionSectionIndex === selectedSectionIndex
                    ? 'opacity-50'
                    : dragOverQuestionIndex === qIdx &&
                      dragOverQuestionSubsectionIndex === selectedSubsectionIndex &&
                      dragOverQuestionSectionIndex === selectedSectionIndex
                      ? 'border-indigo-500 border-2'
                      : '',
                  selectedQuestionIndex === qIdx ? 'border-indigo-500 ring-1 ring-indigo-500' : 'hover:border-gray-300 dark:hover:border-gray-600'
                ]"
                @click.stop="selectQuestion(qIdx)"
              >
                <div class="flex items-start gap-3 px-4 py-3">
                  <svg
                    class="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-move flex-shrink-0 mt-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16" />
                        </svg>
                  <div class="flex-1 min-w-0">
                          <input
                            v-model="question.questionText"
                            type="text"
                      :placeholder="t('forms.builderNewQuestionPh')"
                      class="w-full text-sm font-medium text-gray-900 dark:text-white bg-transparent border-none focus:outline-none focus:ring-0 p-0 placeholder-gray-400 dark:placeholder-gray-500"
                      @click.stop
                    />
                    <input
                      v-model="question.helpText"
                      type="text"
                      :placeholder="t('forms.builderHelpTextPh')"
                      class="mt-1 w-full text-sm text-gray-500 dark:text-gray-400 bg-transparent border-none focus:outline-none focus:ring-0 p-0 placeholder-gray-400 dark:placeholder-gray-500"
                      @click.stop
                          />
                          <div class="flex items-center gap-2 mt-2">
                      <span class="text-xs text-gray-500 dark:text-gray-400 capitalize">
                        {{ questionTypeLabel(question.type || 'Text') }}
                      </span>
                    </div>
                  </div>
                  <div class="flex items-center gap-1">
                    <button
                      v-if="selectedQuestionIndex === qIdx"
                      class="p-1.5 text-indigo-600 dark:text-indigo-400"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                    </button>
                    <button
                      @click.stop="duplicateQuestion(selectedSectionIndex, selectedSubsectionIndex, qIdx)"
                      class="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                    <button
                      @click.stop="removeQuestion(selectedSectionIndex, selectedSubsectionIndex, qIdx)"
                      :disabled="!canModifyFormQuestions"
                      :title="!canModifyFormQuestions ? getBlockingMessage(formStatus) : t('forms.builderTitleRemoveQuestion')"
                      class="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      :class="!canModifyFormQuestions ? 'opacity-30 cursor-not-allowed' : ''"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Question palette - Fixed at bottom -->
          <div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
            <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">{{ t('forms.builderAddQuestion') }}</p>
            <div class="flex flex-wrap gap-2">
                      <button
                v-for="qt in questionPalette"
                :key="qt.type"
                @click="addQuestion(selectedSectionIndex, selectedSubsectionIndex, qt.type)"
                :disabled="!canModifyFormQuestions"
                :title="!canModifyFormQuestions ? getBlockingMessage(formStatus) : t('forms.builderAddQuestionTypeTitle', { type: qt.label })"
                class="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                :class="!canModifyFormQuestions ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'"
              >
                {{ qt.label }}
              </button>
            </div>
          </div>
        </div>

                  </div>

      <!-- Right: Inspector (Question/Section/Subsection Settings) -->
      <div class="col-span-1 md:col-span-3 bg-white dark:bg-gray-900 flex flex-col min-h-0 rounded-tr-lg rounded-br-lg" style="height: 100%;" @click.stop>
        <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-800" @click.stop>
          <h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            <span v-if="currentQuestion">{{ t('forms.builderQuestionSettings') }}</span>
            <span v-else-if="currentSubsection">{{ t('forms.builderSubsectionSettings') }}</span>
            <span v-else-if="currentSection">{{ t('forms.builderSectionSettings') }}</span>
            <span v-else>{{ t('forms.builderInspector') }}</span>
          </h3>
        </div>

        <!-- Question Settings -->
        <div v-if="currentQuestion" data-question-settings-panel class="flex-1 overflow-y-auto px-6 py-4" @click.stop>
          <!-- Question basics -->
          <div class="space-y-5">
            <div>
              <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">{{ t('forms.builderBasics') }}</p>
              <div class="space-y-4">
                <div>
                  <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">{{ t('forms.builderQuestionTextLabel') }}</label>
                          <input
                    v-model="currentQuestion.questionText"
                            type="text"
                    data-question-settings-text-input="true"
                    :placeholder="t('forms.builderNewQuestionPh')"
                    @focus="handleQuestionSettingsFocus"
                    @blur="handleQuestionSettingsBlur"
                    class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                        </div>
                <div>
                  <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">{{ t('forms.builderHelpTextLabel') }}</label>
                          <input
                    v-model="currentQuestion.helpText"
                    type="text"
                    @focus="handleQuestionSettingsFocus"
                    @blur="handleQuestionSettingsBlur"
                    class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    :placeholder="t('forms.builderHelpTextStructuredPh')"
                          />
                        </div>
                <div class="flex items-end gap-3">
                  <div class="flex-1">
                    <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">{{ t('forms.builderType') }}</label>
                        <select
                      v-model="currentQuestion.type"
                      @focus="handleQuestionSettingsFocus"
                      @blur="handleQuestionSettingsBlur"
                      class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
                        >
                          <option
                            v-for="opt in questionTypeOptions"
                            :key="opt.value"
                            :value="opt.value"
                          >
                            {{ opt.label }}
                          </option>
                        </select>
                  </div>
                  <label class="inline-flex items-center gap-2 px-3 py-2 h-[34px]" @click.stop @mousedown.stop>
                          <HeadlessCheckbox
                      v-model="currentQuestion.mandatory"
                      @click.stop="handleQuestionSettingsFocus"
                      @mousedown.stop
                      @change.stop
                      @focus="handleQuestionSettingsFocus"
                      @blur="handleQuestionSettingsBlur"
                      checkbox-class="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
                          />
                    <span class="text-xs font-medium text-gray-700 dark:text-gray-300">{{ t('forms.builderRequired') }}</span>
                        </label>
                        </div>
                      </div>
                    </div>

            <!-- Visibility -->
            <div class="pt-4 border-t border-gray-200 dark:border-gray-800">
              <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">{{ t('forms.builderVisibility') }}</p>
                    <div class="space-y-3">
                <div>
                  <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">{{ t('forms.builderShowQuestionIf') }}<span class="text-xs text-gray-400 ml-2">{{ t('forms.builderQuestionsAvailable', { count: allQuestions.length }) }}</span>
                  </label>
                          <select
                    :value="currentQuestion.conditionalLogic?.showIf?.questionId || ''"
                    @change="handleVisibilityQuestionChange"
                    class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">{{ t('forms.builderAlwaysVisible') }}</option>
                    <option
                      v-for="(q, qIdx) in allQuestions"
                      :key="q.questionId || qIdx"
                      :value="q.questionId || `temp-${qIdx}`"
                      :disabled="(q.questionId || `temp-${qIdx}`) === (currentQuestion?.questionId || '')"
                    >
                      {{ q.questionText || t('forms.builderQuestionFallback', { number: qIdx + 1 }) }}
                    </option>
                  </select>
                </div>

                <!-- Operator and Value - only show when a question is selected -->
                <template v-if="currentQuestion?.conditionalLogic?.showIf?.questionId">
                  <div>
                    <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">{{ t('forms.builderCondition') }}</label>
                    <select
                      v-model="currentQuestion.conditionalLogic.showIf.operator"
                      @focus="handleQuestionSettingsFocus"
                      @blur="handleQuestionSettingsBlur"
                      class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="equals">{{ t('forms.builderCondEquals') }}</option>
                      <option value="notEquals">{{ t('forms.builderCondNotEquals') }}</option>
                      <option v-if="getConditionalQuestion()?.type === 'Text' || getConditionalQuestion()?.type === 'Textarea' || getConditionalQuestion()?.type === 'Email'" value="contains">{{ t('forms.builderCondContains') }}</option>
                      <option v-if="getConditionalQuestion()?.type === 'Text' || getConditionalQuestion()?.type === 'Textarea' || getConditionalQuestion()?.type === 'Email'" value="notContains">{{ t('forms.builderCondNotContains') }}</option>
                      <option v-if="getConditionalQuestion()?.type === 'Number' || getConditionalQuestion()?.type === 'Rating'" value="greaterThan">{{ t('forms.builderCondGreaterThan') }}</option>
                      <option v-if="getConditionalQuestion()?.type === 'Number' || getConditionalQuestion()?.type === 'Rating'" value="lessThan">{{ t('forms.builderCondLessThan') }}</option>
                    </select>
                  </div>

                  <div>
                    <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">{{ t('forms.builderValue') }}</label>
                    <!-- Dropdown question - show options -->
                    <select
                      v-if="getConditionalQuestion()?.type === 'Dropdown'"
                      v-model="currentQuestion.conditionalLogic.showIf.value"
                      @focus="handleQuestionSettingsFocus"
                      @blur="handleQuestionSettingsBlur"
                      class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">{{ t('forms.builderSelectOption') }}</option>
                      <option
                        v-for="(option, optIdx) in (getConditionalQuestion()?.options || [])"
                        :key="optIdx"
                        :value="option"
                      >
                        {{ option }}
                      </option>
                    </select>
                    <!-- Yes-No question - show Yes/No options -->
                    <select
                      v-else-if="getConditionalQuestion()?.type === 'Yes-No'"
                      v-model="currentQuestion.conditionalLogic.showIf.value"
                      @focus="handleQuestionSettingsFocus"
                      @blur="handleQuestionSettingsBlur"
                      class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">{{ t('forms.builderSelectOption') }}</option>
                      <option value="Yes">{{ t('forms.builderAnswerYes') }}</option>
                      <option value="No">{{ t('forms.builderAnswerNo') }}</option>
                    </select>
                    <!-- Rating question - show dropdown with rating options -->
                    <select
                      v-else-if="getConditionalQuestion()?.type === 'Rating'"
                      v-model="currentQuestion.conditionalLogic.showIf.value"
                      @focus="handleQuestionSettingsFocus"
                      @blur="handleQuestionSettingsBlur"
                      class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">{{ t('forms.builderSelectRating') }}</option>
                      <option
                        v-for="rating in getRatingOptions()"
                        :key="rating"
                        :value="rating"
                      >
                        {{ rating }}
                      </option>
                    </select>
                    <!-- Number question - show number input -->
                    <input
                      v-else-if="getConditionalQuestion()?.type === 'Number'"
                      v-model.number="currentQuestion.conditionalLogic.showIf.value"
                      type="number"
                      :placeholder="t('forms.builderEnterNumberPh')"
                      @focus="handleQuestionSettingsFocus"
                      @blur="handleQuestionSettingsBlur"
                      class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <!-- Date question - show date input -->
                    <input
                      v-else-if="getConditionalQuestion()?.type === 'Date'"
                      v-model="currentQuestion.conditionalLogic.showIf.value"
                      type="date"
                      @click="openDatePicker"
                      @focus="handleQuestionSettingsFocus"
                      @blur="handleQuestionSettingsBlur"
                      class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
                    />
                    <!-- Text, Textarea, Email - show text input -->
                    <input
                      v-else
                      v-model="currentQuestion.conditionalLogic.showIf.value"
                      type="text"
                      :placeholder="getConditionalQuestion()?.type === 'Email' ? t('forms.builderEnterEmailPh') : t('forms.builderEnterValuePh')"
                      @focus="handleQuestionSettingsFocus"
                      @blur="handleQuestionSettingsBlur"
                      class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </template>
              </div>
                  </div>

            <!-- Dropdown options -->
            <div v-if="currentQuestion.type === 'Dropdown'" class="pt-4 border-t border-gray-200 dark:border-gray-800">
              <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">{{ t('forms.builderOptions') }}</p>
              <div class="space-y-2">
                <div
                  v-for="(option, optIdx) in currentQuestion.options || []"
                  :key="optIdx"
                        class="flex items-center gap-2"
                      >
                        <input
                    v-model="currentQuestion.options[optIdx]"
                          type="text"
                    :placeholder="t('forms.builderOptionNumber', { number: optIdx + 1 })"
                    @focus="handleQuestionSettingsFocus"
                    @blur="handleQuestionSettingsBlur"
                    class="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <button
                    @click="removeOption(selectedSectionIndex, selectedSubsectionIndex, selectedQuestionIndex, optIdx)"
                    class="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                        >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <button
                  @click="addOption(selectedSectionIndex, selectedSubsectionIndex, selectedQuestionIndex)"
                  class="w-full inline-flex items-center justify-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 px-3 py-2 border border-dashed border-indigo-300 dark:border-indigo-700 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
                      >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                        </svg>{{ t('forms.builderAddOption') }}</button>
                    </div>
                  </div>

            <!-- Yes-No options -->
            <div v-if="currentQuestion.type === 'Yes-No'" class="pt-4 border-t border-gray-200 dark:border-gray-800">
              <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">{{ t('forms.builderOptions') }}</p>
              <div class="space-y-2">
                <div
                  v-for="(option, optIdx) in ['Yes', 'No']"
                  :key="optIdx"
                  class="flex items-center gap-2"
                >
                  <input
                    :value="option === 'Yes' ? t('forms.builderAnswerYes') : t('forms.builderAnswerNo')"
                    type="text"
                    readonly
                    disabled
                    class="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            <!-- Scoring (only for Audit forms and scorable question types) -->
            <div
              v-if="isAuditMode && isScorableQuestionType(currentQuestion.type)"
              class="pt-4 border-t border-gray-200 dark:border-gray-800"
            >
              <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">{{ t('forms.builderScoring') }}</p>
              <div class="space-y-4">
                <!-- Enable Scoring Toggle -->
                <div>
                  <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <HeadlessCheckbox
                      v-model="currentQuestion.scoring.enabled"
                      @focus="handleQuestionSettingsFocus"
                      @blur="handleQuestionSettingsBlur"
                      checkbox-class="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
                    />
                    <span>{{ t('forms.builderEnableScoring') }}</span>
                  </label>
                </div>

                <!-- Scoring Configuration (only shown when enabled) -->
                <div v-if="currentQuestion.scoring.enabled" class="space-y-4 pl-1">
                  <!-- Pass Condition -->
                  <div>
                    <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">{{ t('forms.builderPassIfAnswer') }}</label>
                    
                    <!-- Yes/No: Expected value -->
                    <div v-if="currentQuestion.type === 'Yes-No'" class="space-y-2">
                      <select
                        v-model="currentQuestion.scoring.passCondition.expectedValue"
                        @focus="handleQuestionSettingsFocus"
                        @blur="handleQuestionSettingsBlur"
                        class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
                      >
                        <option value="Yes">{{ t('forms.builderAnswerYes') }}</option>
                        <option value="No">{{ t('forms.builderAnswerNo') }}</option>
                      </select>
                    </div>

                    <!-- Dropdown: One or more pass options -->
                    <div v-else-if="currentQuestion.type === 'Dropdown'" class="space-y-2">
                      <div class="text-xs text-gray-600 dark:text-gray-400 mb-2">{{ t('forms.builderPassOptionsHint') }}</div>
                      <div class="space-y-2 max-h-32 overflow-y-auto">
                        <label
                          v-for="(option, optIdx) in currentQuestion.options || []"
                          :key="optIdx"
                          class="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded cursor-pointer"
                        >
                          <HeadlessCheckbox
                            :value="option"
                            :checked="(currentQuestion.scoring.passCondition.passOptions || []).includes(option)"
                            @change="(e) => handleDropdownPassOptionChange(e, option)"
                            @focus="handleQuestionSettingsFocus"
                            @blur="handleQuestionSettingsBlur"
                            class="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
                          />
                          <span class="text-sm text-gray-700 dark:text-gray-300">{{ option }}</span>
                        </label>
                      </div>
                      <p v-if="!currentQuestion.options || currentQuestion.options.length === 0" class="text-xs text-gray-500 dark:text-gray-400 italic">{{ t('forms.builderAddOptionsFirst') }}</p>
                    </div>

                    <!-- Rating: Minimum acceptable rating -->
                    <div v-else-if="currentQuestion.type === 'Rating'" class="space-y-2">
                      <div class="flex items-center gap-2">
                        <span class="text-xs text-gray-600 dark:text-gray-400">{{ t('forms.builderMinRating') }}</span>
                        <input
                          v-model.number="currentQuestion.scoring.passCondition.minRating"
                          type="number"
                          min="1"
                          max="5"
                          @focus="handleQuestionSettingsFocus"
                          @blur="handleQuestionSettingsBlur"
                          class="w-20 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                      <p class="text-xs text-gray-500 dark:text-gray-400">
                        {{ t('forms.builderRatingPassHint', { min: currentQuestion.scoring.passCondition.minRating || 1 }) }}
                      </p>
                    </div>

                    <!-- Number: Rule-based (>=, <=, between) -->
                    <div v-else-if="currentQuestion.type === 'Number'" class="space-y-2">
                      <select
                        v-model="currentQuestion.scoring.passCondition.rule"
                        @focus="handleQuestionSettingsFocus"
                        @blur="handleQuestionSettingsBlur"
                        class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
                      >
                        <option value=">=">{{ t('forms.builderRuleGte') }}</option>
                        <option value="<=">{{ t('forms.builderRuleLte') }}</option>
                        <option value="between">{{ t('forms.builderRuleBetween') }}</option>
                      </select>
                      
                      <!-- Single value for >= or <= -->
                      <div v-if="currentQuestion.scoring.passCondition.rule === '>=' || currentQuestion.scoring.passCondition.rule === '<='" class="mt-2">
                        <input
                          v-model.number="currentQuestion.scoring.passCondition.value"
                          type="number"
                          step="any"
                          @focus="handleQuestionSettingsFocus"
                          @blur="handleQuestionSettingsBlur"
                          class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                          :placeholder="getNumberPassValuePlaceholder()"
                        />
                      </div>
                      
                      <!-- Two values for between -->
                      <div v-else-if="currentQuestion.scoring.passCondition.rule === 'between'" class="mt-2 space-y-2">
                        <input
                          v-model.number="currentQuestion.scoring.passCondition.minValue"
                          type="number"
                          step="any"
                          @focus="handleQuestionSettingsFocus"
                          @blur="handleQuestionSettingsBlur"
                          class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                          :placeholder="t('forms.builderMinValuePh')"
                        />
                        <input
                          v-model.number="currentQuestion.scoring.passCondition.maxValue"
                          type="number"
                          step="any"
                          @focus="handleQuestionSettingsFocus"
                          @blur="handleQuestionSettingsBlur"
                          class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                          :placeholder="t('forms.builderMaxValuePh')"
                        />
                      </div>
                    </div>
                  </div>

                  <!-- Weight -->
                  <div>
                    <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">{{ t('forms.builderWeight') }}</label>
                    <input
                      v-model.number="currentQuestion.scoring.weight"
                      type="number"
                      min="1"
                      step="1"
                      @focus="handleQuestionSettingsFocus"
                      @blur="handleQuestionSettingsBlur"
                      class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                      :placeholder="t('forms.builderWeightDefaultPh')"
                    />
                    <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('forms.builderWeightQuestionHint') }}</p>
                  </div>

                  <!-- Critical Question -->
                  <div>
                    <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <HeadlessCheckbox
                        v-model="currentQuestion.scoring.critical"
                        @focus="handleQuestionSettingsFocus"
                        @blur="handleQuestionSettingsBlur"
                        checkbox-class="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
                      />
                      <span>{{ t('forms.builderCriticalQuestion') }}</span>
                    </label>
                    <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('forms.builderCriticalQuestionHint') }}</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Evidence Configuration -->
            <div
              v-if="isAuditMode && (currentQuestion.type === 'Yes-No' || currentQuestion.type === 'Rating' || currentQuestion.type === 'Dropdown')"
              class="pt-4 border-t border-gray-200 dark:border-gray-800"
              @click.stop
              @mousedown.stop
            >
              <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">{{ t('forms.builderEvidence') }}</p>
              
              <!-- Ensure evidence structure exists -->
              <template v-if="currentQuestion.evidence">
              <!-- Enable Evidence Toggle -->
              <div class="mb-4" @click.stop @mousedown.stop>
                <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300" @click.stop @mousedown.stop>
                  <HeadlessCheckbox
                    :checked="currentQuestion.evidence.enabled"
                    @change.stop="(e) => handleEvidenceToggleChange(e)"
                    @click.stop
                    @mousedown.stop
                    class="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
                  />
                  <span @click.stop @mousedown.stop>{{ t('forms.builderEnableEvidence') }}</span>
                </label>
              </div>

              <!-- Evidence Rules (only shown when enabled) -->
              <div v-if="currentQuestion.evidence.enabled" class="space-y-4">
                <div class="text-xs text-gray-600 dark:text-gray-400 mb-3">{{ t('forms.builderEvidenceRulesHint') }}</div>

                <!-- Rules List -->
                <div class="space-y-3">
                  <div
                    v-for="(rule, ruleIdx) in currentQuestion.evidence.rules"
                    :key="ruleIdx"
                    class="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600"
                    @click.stop
                    @mousedown.stop
                  >
                    <div class="flex items-center justify-between mb-3">
                      <span class="text-xs font-medium text-gray-700 dark:text-gray-300">{{ t('forms.builderEvidenceRuleNumber', { number: ruleIdx + 1 }) }}</span>
                      <button
                        @click.stop="removeEvidenceRule(ruleIdx)"
                        @mousedown.stop
                        class="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                      >{{ t('forms.builderRemove') }}</button>
                    </div>

                    <!-- When condition -->
                    <div class="mb-3" @click.stop @mousedown.stop>
                      <label class="block text-xs text-gray-700 dark:text-gray-300 mb-1">{{ t('forms.builderWhenAnswerIs') }}</label>
                      <select
                        v-model="rule.when"
                        @focus="handleQuestionSettingsFocus"
                        @blur="handleQuestionSettingsBlur"
                        @click.stop
                        @mousedown.stop
                        class="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option v-if="currentQuestion.type === 'Yes-No'" value="Yes">{{ t('forms.builderAnswerYes') }}</option>
                        <option v-if="currentQuestion.type === 'Yes-No'" value="No">{{ t('forms.builderAnswerNo') }}</option>
                        <option v-if="currentQuestion.type === 'Rating'" v-for="r in 5" :key="r" :value="String(r)">{{ r }}</option>
                        <option v-if="currentQuestion.type === 'Dropdown'" v-for="opt in currentQuestion.options" :key="opt" :value="opt">{{ opt }}</option>
                      </select>
                    </div>

                    <!-- Evidence Types Configuration -->
                    <div class="space-y-2" @click.stop @mousedown.stop>
                      <!-- Comment -->
                      <div class="flex items-center justify-between">
                        <label class="text-xs text-gray-700 dark:text-gray-300">{{ t('forms.builderEvidenceComment') }}</label>
                        <select
                          v-model="rule.comment.required"
                          @focus="handleQuestionSettingsFocus"
                          @blur="handleQuestionSettingsBlur"
                          @click.stop
                          @mousedown.stop
                          class="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                          <option value="hidden">{{ t('forms.builderEvidenceNotRequired') }}</option>
                          <option value="optional">{{ t('forms.builderEvidenceOptional') }}</option>
                          <option value="required">{{ t('forms.builderRequired') }}</option>
                        </select>
                      </div>

                      <!-- Image -->
                      <div class="flex items-center justify-between">
                        <label class="text-xs text-gray-700 dark:text-gray-300">{{ t('forms.builderEvidenceImage') }}</label>
                        <select
                          v-model="rule.image.required"
                          @focus="handleQuestionSettingsFocus"
                          @blur="handleQuestionSettingsBlur"
                          @click.stop
                          @mousedown.stop
                          class="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                          <option value="hidden">{{ t('forms.builderEvidenceNotRequired') }}</option>
                          <option value="optional">{{ t('forms.builderEvidenceOptional') }}</option>
                          <option value="required">{{ t('forms.builderRequired') }}</option>
                        </select>
                      </div>

                      <!-- Video -->
                      <div class="flex items-center justify-between">
                        <label class="text-xs text-gray-700 dark:text-gray-300">{{ t('forms.builderEvidenceVideo') }}</label>
                        <select
                          v-model="rule.video.required"
                          @focus="handleQuestionSettingsFocus"
                          @blur="handleQuestionSettingsBlur"
                          @click.stop
                          @mousedown.stop
                          class="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                          <option value="hidden">{{ t('forms.builderEvidenceNotRequired') }}</option>
                          <option value="optional">{{ t('forms.builderEvidenceOptional') }}</option>
                          <option value="required">{{ t('forms.builderRequired') }}</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Add Rule Button -->
                <button
                  @click.stop="addEvidenceRule"
                  @mousedown.stop
                  type="button"
                  class="w-full inline-flex items-center justify-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 px-3 py-2 border border-dashed border-indigo-300 dark:border-indigo-700 rounded-md hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all"
                >
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                  </svg>{{ t('forms.builderAddRule') }}</button>

                <!-- Validation Message -->
                <div v-if="hasRequiredEvidenceWithoutType" class="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">{{ t('forms.builderEvidenceValidation') }}</div>
              </div>
              </template>
            </div>

            <!-- Advanced (collapsible) -->
            <div class="pt-4 border-t border-gray-200 dark:border-gray-800">
              <button 
                @click.stop="toggleAdvancedSettings"
                @mousedown.stop
                class="flex items-center justify-between w-full text-left"
              >
                <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ t('forms.builderAdvanced') }}</p>
                <svg 
                  class="w-4 h-4 text-gray-400 transition-transform"
                  :class="{ 'rotate-180': expandedAdvancedSettings }"
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              <!-- Advanced Settings Content -->
              <div v-if="expandedAdvancedSettings" class="mt-4 space-y-4" @click.stop @mousedown.stop>
                <!-- Question ID (read-only, for reference) -->
                <div>
                  <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">{{ t('forms.builderQuestionId') }}</label>
                  <input
                    :value="currentQuestion.questionId"
                    type="text"
                    readonly
                    disabled
                    class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                  />
                  <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('forms.builderQuestionIdHint') }}</p>
                </div>

                <!-- Order/Position -->
                <div>
                  <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">{{ t('forms.builderDisplayOrder') }}</label>
                  <input
                    v-model.number="currentQuestion.order"
                    type="number"
                    min="0"
                    @focus="handleQuestionSettingsFocus"
                    @blur="handleQuestionSettingsBlur"
                    class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('forms.builderDisplayOrderHint') }}</p>
                </div>

                <!-- Pass/Fail Definition (for scorable questions) -->
                <div v-if="currentQuestion.type === 'Yes-No' || currentQuestion.type === 'Rating' || currentQuestion.type === 'Dropdown'">
                  <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">{{ t('forms.builderPassFailDefinition') }}</label>
                  <textarea
                    v-model="currentQuestion.passFailDefinition"
                    rows="2"
                    @focus="handleQuestionSettingsFocus"
                    @blur="handleQuestionSettingsBlur"
                    class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                    :placeholder="t('forms.builderPassFailDefinitionPh')"
                  ></textarea>
                </div>
              </div>
            </div>

            <!-- File settings -->
            <div v-if="currentQuestion.type === 'File'" class="pt-4 border-t border-gray-200 dark:border-gray-800">
              <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">{{ t('forms.builderFileSettings') }}</p>
              <label class="inline-flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                        <HeadlessCheckbox
                  v-model="currentQuestion.attachmentAllowance"
                  checkbox-class="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
                        />{{ t('forms.builderAllowMultipleFiles') }}</label>
                    </div>
                  </div>
                </div>

        <!-- Subsection Settings (only for Audit forms) -->
        <div v-else-if="currentSubsection && isAuditMode" class="flex-1 overflow-y-auto px-6 py-4" @click.stop>
          <div class="space-y-5">
            <!-- Subsection Basics -->
            <div>
              <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">{{ t('forms.builderBasics') }}</p>
              <div class="space-y-4">
                <div>
                  <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">{{ t('forms.builderSubsectionName') }}</label>
                  <input
                    v-model="currentSubsection.name"
                    type="text"
                    @focus="handleQuestionSettingsFocus"
                    @blur="handleQuestionSettingsBlur"
                    class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    :placeholder="t('forms.builderEnterSubsectionNamePh')"
                  />
                </div>
              </div>
            </div>

            <!-- Subsection Scoring -->
            <div class="pt-4 border-t border-gray-200 dark:border-gray-800">
              <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">{{ t('forms.builderScoring') }}</p>
              <div class="space-y-4">
                <div>
                  <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">{{ t('forms.builderWeight') }}</label>
                  <input
                    v-model.number="currentSubsection.subsectionScoring.weight"
                    type="number"
                    min="1"
                    step="1"
                    @focus="handleQuestionSettingsFocus"
                    @blur="handleQuestionSettingsBlur"
                    class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    :placeholder="t('forms.builderWeightDefaultPh')"
                  />
                  <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('forms.builderWeightSubsectionHint') }}</p>
                </div>

                <div>
                  <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">{{ t('forms.builderPassThreshold') }}</label>
                  <input
                    v-model.number="currentSubsection.subsectionScoring.threshold"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    @focus="handleQuestionSettingsFocus"
                    @blur="handleQuestionSettingsBlur"
                    class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    :placeholder="t('forms.builderThresholdDefaultPh')"
                  />
                  <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('forms.builderSubsectionThresholdHint') }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Section Settings (only for Audit forms) -->
        <div v-else-if="currentSection && isAuditMode" class="flex-1 overflow-y-auto px-6 py-4" @click.stop>
          <div class="space-y-5">
            <!-- Section Basics -->
            <div>
              <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">{{ t('forms.builderBasics') }}</p>
              <div class="space-y-4">
                <div>
                  <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">{{ t('forms.builderSectionName') }}</label>
                  <input
                    v-model="currentSection.name"
                    type="text"
                    @focus="handleQuestionSettingsFocus"
                    @blur="handleQuestionSettingsBlur"
                    class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    :placeholder="t('forms.builderEnterSectionNamePh')"
                  />
                </div>
              </div>
            </div>

            <!-- Section Scoring -->
            <div class="pt-4 border-t border-gray-200 dark:border-gray-800">
              <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">{{ t('forms.builderScoring') }}</p>
              <div class="space-y-4">
                <div>
                  <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">{{ t('forms.builderWeight') }}</label>
                  <input
                    v-model.number="currentSection.sectionScoring.weight"
                    type="number"
                    min="1"
                    step="1"
                    @focus="handleQuestionSettingsFocus"
                    @blur="handleQuestionSettingsBlur"
                    class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    :placeholder="t('forms.builderWeightDefaultPh')"
                  />
                  <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('forms.builderWeightSectionHint') }}</p>
                </div>

                <div>
                  <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">{{ t('forms.builderPassThreshold') }}</label>
                  <input
                    v-model.number="currentSection.sectionScoring.threshold"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    @focus="handleQuestionSettingsFocus"
                    @blur="handleQuestionSettingsBlur"
                    class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    :placeholder="t('forms.builderThresholdDefaultPh')"
                  />
                  <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('forms.builderSectionThresholdHint') }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="flex-1 flex items-center justify-center text-center text-gray-400 dark:text-gray-500 px-6 py-12">
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('forms.builderSelectTargetEmpty') }}</p>
              </div>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-else
      class="text-center py-16 px-8 bg-white dark:bg-gray-900 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 shadow-sm"
    >
      <svg class="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <p v-if="isAuditMode" class="text-base font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('forms.builderEmptyAuditLead') }}</p>
      <p v-else class="text-base font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('forms.builderEmptyFlatLead') }}</p>
      <div class="flex items-center justify-center gap-3 mt-6">
              <button
          v-if="isFlatMode"
          @click="addRootQuestion('Text')"
          class="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>{{ t('forms.builderAddFirstQuestion') }}</button>
          <button
          v-else
          @click="addSection"
          class="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>{{ t('forms.builderAddFirstSection') }}</button>
      <button
          v-if="isFlatMode"
        @click="addSection"
          class="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600 font-medium text-sm transition-all duration-200 cursor-pointer shadow-sm hover:shadow"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>{{ t('forms.builderAddSectionOptional') }}</button>
      </div>
    </div>

    <!-- Preview Drawer -->
    <FormPreviewDrawer
      :isOpen="showPreview"
      :form="localForm"
      @close="closePreview"
    />

    <!-- Duplicate Form Dialog -->
    <DuplicateFormDialog
      :isOpen="showDuplicateDialog"
      :formId="form?._id"
      :formName="form?.name"
      @close="showDuplicateDialog = false"
      @duplicated="handleFormDuplicated"
    />
  </div>
</template>

<script setup>
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import { computed, ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { openDatePicker } from '@/utils/dateUtils';
import FormPreviewDrawer from './FormPreviewDrawer.vue';
import DuplicateFormDialog from './DuplicateFormDialog.vue';
import {
  canEditForm,
  isFormReadOnly,
  isFormLocked,
  canModifyStructure,
  canModifyQuestions,
  canChangeQuestionType,
  canModifyScoring,
  canModifyEvidenceRules,
  canModifyOutcomeRules,
  canEditResponseTemplate,
  canMakeCosmeticChanges,
  getBlockingMessage,
  isEditAllowed,
  getStatusInfo
} from '@/utils/formEditPermissions';

const { t } = useI18n();

const structureSectionNamePh = computed(() => t('forms.builderStructureSectionNamePh'));
const structureSubsectionNamePh = computed(() => t('forms.builderStructureSubsectionNamePh'));

const QUESTION_TYPE_LABEL_KEYS = {
  Text: 'builderQtText',
  Textarea: 'builderQtTextarea',
  Email: 'builderQtEmail',
  Number: 'builderQtNumber',
  Date: 'builderQtDate',
  Dropdown: 'builderQtDropdown',
  Rating: 'builderQtRating',
  File: 'builderQtFile',
  Signature: 'builderQtSignature',
  'Yes-No': 'builderQtYesNo',
};

const questionTypeLabel = (type) => {
  const key = QUESTION_TYPE_LABEL_KEYS[type || 'Text'] || QUESTION_TYPE_LABEL_KEYS.Text;
  return t(`forms.${key}`);
};

const questionTypeOptions = computed(() => [
  { value: 'Text', label: t('forms.builderQtText') },
  { value: 'Textarea', label: t('forms.builderQtTextarea') },
  { value: 'Email', label: t('forms.builderQtEmail') },
  { value: 'Number', label: t('forms.builderQtNumber') },
  { value: 'Date', label: t('forms.builderQtDate') },
  { value: 'Dropdown', label: t('forms.builderQtDropdown') },
  { value: 'Rating', label: t('forms.builderQtRating') },
  { value: 'File', label: t('forms.builderQtFile') },
  { value: 'Signature', label: t('forms.builderQtSignature') },
  { value: 'Yes-No', label: t('forms.builderQtYesNo') },
]);

const props = defineProps({
  form: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['update']);

// Helper function for generating IDs
// Form type detection
const formType = computed(() => {
  return props.form?.formType || 'audit';
});

// Form status and edit permissions
const formStatus = computed(() => {
  return props.form?.status || 'Draft';
});

const canEdit = computed(() => canEditForm(formStatus.value));
const isReadOnly = computed(() => isFormReadOnly(formStatus.value));
const isLocked = computed(() => isFormLocked(formStatus.value));
const canModifyFormStructure = computed(() => canModifyStructure(formStatus.value));
const canModifyFormQuestions = computed(() => canModifyQuestions(formStatus.value));
const canModifyFormQuestionType = computed(() => canChangeQuestionType(formStatus.value));
const canModifyFormScoring = computed(() => canModifyScoring(formStatus.value));
const canModifyFormEvidence = computed(() => canModifyEvidenceRules(formStatus.value));
const canMakeCosmeticEdits = computed(() => canMakeCosmeticChanges(formStatus.value));
const statusInfo = computed(() => getStatusInfo(formStatus.value));

const isAuditMode = computed(() => {
  return formType.value?.toLowerCase() === 'audit';
});

const isSurveyMode = computed(() => {
  return formType.value?.toLowerCase() === 'survey';
});

const isFeedbackMode = computed(() => {
  return formType.value?.toLowerCase() === 'feedback';
});

const isFlatMode = computed(() => {
  return isSurveyMode.value || isFeedbackMode.value;
});

// Helper to check if a question type is scorable
const isScorableQuestionType = (questionType) => {
  const scorableTypes = ['Yes-No', 'Dropdown', 'Rating', 'Number'];
  return scorableTypes.includes(questionType);
};

// Helper to get or create root section for flat mode
const getRootSection = () => {
  if (!localForm.value.sections) {
    localForm.value.sections = [];
  }
  let rootSection = localForm.value.sections.find(s => s._isRootSection);
  if (!rootSection) {
    rootSection = {
      sectionId: generateId('SEC'),
      name: '',
      weightage: 0,
      subsections: [{
        subsectionId: generateId('SUB'),
        name: '',
        weightage: 0,
        questions: [],
        order: 0,
        subsectionScoring: {
          weight: 1,
          threshold: 100
        }
      }],
      questions: [],
      order: 0,
      _isRootSection: true, // Marker for root-level questions
      sectionScoring: {
        weight: 1,
        threshold: 100
      }
    };
    localForm.value.sections.push(rootSection);
  }
  return rootSection;
};

// Get visible sections (exclude root section in flat mode)
const visibleSections = computed(() => {
  if (!localForm.value.sections) return [];
  if (isFlatMode.value) {
    return localForm.value.sections.filter(s => !s._isRootSection);
  }
  return localForm.value.sections;
});

// Helper to get actual section index from section object
const getActualSectionIndex = (section) => {
  if (!section || !section.sectionId || !localForm.value.sections) {
    console.warn('getActualSectionIndex: invalid section or sections array', { section, hasSections: !!localForm.value.sections });
    return -1;
  }
  const index = localForm.value.sections.findIndex(s => s && s.sectionId === section.sectionId);
  if (index === -1) {
    console.warn('getActualSectionIndex: section not found', { 
      sectionId: section.sectionId, 
      sectionName: section.name,
      availableIds: localForm.value.sections.map(s => s?.sectionId)
    });
  }
  return index;
};

// Get root questions for flat mode
const rootQuestions = computed(() => {
  if (!isFlatMode.value) return [];
  const rootSection = localForm.value.sections?.find(s => s._isRootSection);
  if (!rootSection || !rootSection.subsections || rootSection.subsections.length === 0) return [];
  return rootSection.subsections[0].questions || [];
});

// Get current questions based on mode (flat mode, subsection, or section-level)
const currentQuestions = computed(() => {
  if (isFlatMode.value) {
    return rootQuestions.value;
  }
  if (currentSubsection.value) {
    return currentSubsection.value.questions || [];
  }
  // If section is selected but no subsection, return section-level questions
  if (currentSection.value) {
    return currentSection.value.questions || [];
  }
  return [];
});

// Get all questions from all sections and subsections for visibility dropdown
const allQuestions = computed(() => {
  const questions = [];
  const sections = localForm.value?.sections;
  
  if (!sections || !Array.isArray(sections)) {
    return questions;
  }
  
  // Iterate through all sections
  sections.forEach(section => {
    if (!section) return;
    
    // Check section-level questions
    if (Array.isArray(section.questions) && section.questions.length > 0) {
      section.questions.forEach(question => {
        if (question) {
          questions.push(question);
        }
      });
    }
    
    // Check subsection-level questions
    if (Array.isArray(section.subsections) && section.subsections.length > 0) {
      section.subsections.forEach(subsection => {
        if (!subsection) return;
        
        if (Array.isArray(subsection.questions) && subsection.questions.length > 0) {
          subsection.questions.forEach(question => {
            if (question) {
              questions.push(question);
            }
          });
        }
      });
    }
  });
  
  return questions;
});

// Ensure all questions have proper structure when form is loaded
const normalizeQuestions = (sections) => {
  if (!sections || !Array.isArray(sections)) return;
  
  const normalizeQuestion = (question) => {
    // Ensure questionId exists
    if (!question.questionId) {
      question.questionId = generateId('Q');
    }
    
    // Ensure conditionalLogic exists
    if (!question.conditionalLogic) {
      question.conditionalLogic = {
        showIf: {
          questionId: '',
          operator: 'equals',
          value: null
        }
      };
    } else if (!question.conditionalLogic.showIf) {
      question.conditionalLogic.showIf = {
        questionId: '',
        operator: 'equals',
        value: null
      };
    }
    
    // Migrate old scoringLogic to new scoring structure if needed
    if (question.scoringLogic && !question.scoring) {
      // Migrate from old structure
      question.scoring = {
        enabled: false,
        passCondition: {},
        weight: question.scoringLogic.weightage || 1,
        critical: false
      };
      
      // Set pass condition based on question type
      if (question.type === 'Yes-No') {
        question.scoring.passCondition = {
          expectedValue: question.scoringLogic.passValue || 'Yes'
        };
      } else if (question.type === 'Rating') {
        question.scoring.passCondition = {
          minRating: parseInt(question.scoringLogic.passValue) || 4
        };
      } else if (question.type === 'Dropdown') {
        question.scoring.passCondition = {
          passOptions: question.scoringLogic.passValue ? [question.scoringLogic.passValue] : []
        };
      }
    }
    
    // Ensure new scoring structure exists (for scorable questions)
    if (isScorableQuestionType(question.type)) {
      if (!question.scoring) {
        question.scoring = {
          enabled: false,
          passCondition: {},
          weight: 1,
          critical: false
        };
        
        // Set default pass condition based on question type
        if (question.type === 'Yes-No') {
          question.scoring.passCondition = { expectedValue: 'Yes' };
        } else if (question.type === 'Rating') {
          question.scoring.passCondition = { minRating: 4 };
        } else if (question.type === 'Dropdown') {
          question.scoring.passCondition = { passOptions: [] };
        } else if (question.type === 'Number') {
          question.scoring.passCondition = {
            rule: '>=',
            value: null
          };
        }
      }
    }
    
    // Keep old scoringLogic for backward compatibility (if it exists)
    if (!question.scoringLogic && question.scoring) {
      question.scoringLogic = {
        passValue: null,
        failValue: null,
        weightage: question.scoring.weight || 1
      };
    }
    
    // Ensure evidence structure exists
    if (!question.evidence) {
      question.evidence = {
        enabled: false,
        rules: []
      };
    }
    
    // Ensure options array exists for dropdowns
    if (question.type === 'Dropdown' && !Array.isArray(question.options)) {
      question.options = [];
    }
  };
  
  sections.forEach(section => {
    // Normalize section-level questions
    if (section.questions && Array.isArray(section.questions)) {
      section.questions.forEach(normalizeQuestion);
    }
    
    // Normalize subsection-level questions
    if (section.subsections && Array.isArray(section.subsections)) {
      section.subsections.forEach(subsection => {
        if (subsection.questions && Array.isArray(subsection.questions)) {
          subsection.questions.forEach(normalizeQuestion);
        }
      });
    }
  });
};

// Initialize localForm with proper structure
const initializeLocalForm = () => {
  const formData = props.form || {};
  const formTypeValue = (formData.formType || 'audit').toLowerCase();
  const initializedForm = {
    ...formData,
    sections: Array.isArray(formData.sections) ? formData.sections.map(section => ({
      ...section,
      subsections: Array.isArray(section.subsections) ? section.subsections : [],
      questions: Array.isArray(section.questions) ? section.questions : []
    })) : []
  };
  
  // Normalize questions to ensure proper structure
  normalizeQuestions(initializedForm.sections);
  
  // Normalize sections and subsections to ensure scoring structure exists
  initializedForm.sections.forEach(section => {
    // Ensure section scoring structure exists (for audit forms)
    if (formTypeValue === 'audit') {
      if (!section.sectionScoring) {
        section.sectionScoring = {
          weight: 1,
          threshold: 100
        };
      }
    }
    
    // Normalize subsections
    if (section.subsections && Array.isArray(section.subsections)) {
      section.subsections.forEach(subsection => {
        // Ensure subsection scoring structure exists (for audit forms)
        if (formTypeValue === 'audit') {
          if (!subsection.subsectionScoring) {
            subsection.subsectionScoring = {
              weight: 1,
              threshold: 100
            };
          }
        }
      });
    }
  });
  
  // Helper function for generating IDs (defined here for use in initialization)
  const generateIdLocal = (prefix) => {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };
  
  // For Audit mode: auto-create initial section if none exists with default name (no default subsection)
  if (formTypeValue === 'audit' && initializedForm.sections.length === 0) {
    initializedForm.sections.push({
      sectionId: generateIdLocal('SEC'),
      name: t('forms.builderDefaultSectionName'),
      weightage: 0,
      subsections: [],
      questions: [],
      order: 0,
      sectionScoring: {
        weight: 1,
        threshold: 100
      }
    });
  }
  
  // For Survey/Feedback mode: ensure root section exists for root-level questions
  if ((formTypeValue === 'survey' || formTypeValue === 'feedback')) {
    const hasRootSection = initializedForm.sections.some(s => s._isRootSection);
    if (!hasRootSection) {
      initializedForm.sections.push({
        sectionId: generateIdLocal('SEC'),
        name: '',
        weightage: 0,
        subsections: [{
          subsectionId: generateIdLocal('SUB'),
          name: '',
          weightage: 0,
          questions: [],
          order: 0,
          subsectionScoring: {
            weight: 1,
            threshold: 100
          }
        }],
        questions: [],
        order: 0,
        _isRootSection: true,
        sectionScoring: {
          weight: 1,
          threshold: 100
        }
      });
    }
  }
  
  return initializedForm;
};

const localForm = ref(initializeLocalForm());
const selectedSectionIndex = ref(null);
const selectedSubsectionIndex = ref(null);
const selectedQuestionIndex = ref(null);
let isSyncing = false;
let skipAutoSelectSubsection = false; // Flag to prevent ensureSelection from auto-selecting subsections
const pendingSectionIdToSelect = ref(null); // Track section ID that should be selected
let isAddingSection = false; // Flag to completely prevent ensureSelection from running
let lastSectionAddTime = 0; // Track when we last added a section
let ensureSelectionDisabled = false; // Global flag to completely disable ensureSelection
let lastEmittedForm = null;
let activeSectionAddInterval = null; // Track active interval for section addition
let activeSectionAddTimeout = null; // Track active timeout for section addition
let activeSelectionGuard = null; // Track active selection guard watcher
const expandedQuestions = ref({}); // Track which questions have settings expanded
const expandedAdvancedSettings = ref(false); // Track if Advanced section is expanded
const sectionInputRefs = ref({}); // Track section input refs for focusing
const subsectionInputRefs = ref({}); // Track subsection input refs for focusing
const expandedSections = ref({}); // Track which sections are expanded in the tree view
const questionsScrollContainer = ref(null); // Ref for the scrollable questions container
const structureScrollContainer = ref(null); // Ref for the scrollable structure container
const sectionRefs = ref({}); // Refs for section elements
const questionRefs = ref({}); // Refs for question elements
const focusedSectionId = ref(null); // Track which section input is currently focused
const focusedSubsectionId = ref(null); // Track which subsection input is currently focused
const focusedQuestionSettingsInput = ref(false); // Track if a question settings input is currently focused
const openSubsectionMenuKey = ref(null); // Track active subsection actions menu
let questionSettingsBlurTimeout = null; // Timeout for delaying blur handler
const pendingSectionFocusId = ref(null); // Track section input that should receive autofocus after mount
let suppressOutsideInputBlurUntil = 0; // Prevent document handlers from blurring just-autofocused inputs

// Helper functions for question settings input focus/blur
const handleQuestionSettingsFocus = () => {
  if (questionSettingsBlurTimeout) {
    clearTimeout(questionSettingsBlurTimeout);
    questionSettingsBlurTimeout = null;
  }
  focusedQuestionSettingsInput.value = true;
};

const handleQuestionSettingsBlur = () => {
  // Delay blur to allow change event to process first (especially for dropdowns)
  questionSettingsBlurTimeout = setTimeout(() => {
    focusedQuestionSettingsInput.value = false;
  }, 200);
};

// Drag-drop state for sections
const draggedSectionIndex = ref(null);
const dragOverSectionIndex = ref(null);

// Drag-drop state for subsections
const draggedSubsectionIndex = ref(null);
const draggedSubsectionSectionIndex = ref(null);
const dragOverSubsectionIndex = ref(null);
const dragOverSubsectionSectionIndex = ref(null);

// Drag-drop state for questions
const draggedQuestionIndex = ref(null);
const draggedQuestionSubsectionIndex = ref(null);
const draggedQuestionSectionIndex = ref(null);
const dragOverQuestionIndex = ref(null);
const dragOverQuestionSubsectionIndex = ref(null);
const dragOverQuestionSectionIndex = ref(null);

// Helper to check if section structure actually changed (not just property updates)
const hasStructureChanged = (oldSections, newSections) => {
  if (!oldSections || !newSections) return oldSections !== newSections;
  if (oldSections.length !== newSections.length) return true;
  
  // Check if section IDs or order changed
  const oldIds = oldSections.map(s => s.sectionId).filter(Boolean);
  const newIds = newSections.map(s => s.sectionId).filter(Boolean);
  if (oldIds.join(',') !== newIds.join(',')) return true;
  
  // Check if subsection structure changed for each section
  for (let i = 0; i < oldSections.length; i++) {
    const oldSection = oldSections[i];
    const newSection = newSections.find(s => s.sectionId === oldSection?.sectionId);
    if (!newSection) return true;
    
    const oldSubsections = oldSection?.subsections || [];
    const newSubsections = newSection?.subsections || [];
    if (oldSubsections.length !== newSubsections.length) return true;
    
    // Check if subsection IDs changed
    const oldSubIds = oldSubsections.map(sub => sub.subsectionId).filter(Boolean);
    const newSubIds = newSubsections.map(sub => sub.subsectionId).filter(Boolean);
    if (oldSubIds.join(',') !== newSubIds.join(',')) return true;
  }
  
  return false;
};

// Watch for form changes (both ID changes and form data updates)
watch(() => props.form, (newForm) => {
  if (newForm) {
    // Skip watcher updates if we're currently syncing OR adding a section (to prevent reset loops)
    // CRITICAL: If we have a pending section, NEVER run the watcher logic - it will override our selection
    // Also skip if user is typing in question settings inputs
    if (isSyncing || isAddingSection || pendingSectionIdToSelect.value || focusedQuestionSettingsInput.value) {
      // Skipping: syncing, adding section, pending section exists, or user is typing in question settings
      return;
    }
    
    // Check if this is a different form (by ID) or if structure has actually changed
    const isDifferentForm = newForm._id && newForm._id !== localForm.value._id;
    const structureChanged = hasStructureChanged(localForm.value.sections, newForm.sections);
    
    // CRITICAL: If we have a pending section, don't reinitialize the form
    // This prevents the form watcher from resetting the selection when we add a new section
    if (pendingSectionIdToSelect.value) {
      // Blocked: pending section exists
      return;
    }
    
    if (isDifferentForm || structureChanged || !localForm.value._id) {
      // Preserve expanded sections state
      const preservedExpandedSections = { ...expandedSections.value };
      
      // Preserve selection IDs before reinitializing
      // BUT if we have a pending section to select, don't capture the old selection
      // We want to select the pending section instead
      const selectedSection = !pendingSectionIdToSelect.value &&
        selectedSectionIndex.value !== null &&
        localForm.value.sections &&
        localForm.value.sections[selectedSectionIndex.value]
          ? localForm.value.sections[selectedSectionIndex.value]
          : null;
      const selectedSectionId = selectedSection?.sectionId || null;
      const selectedSubsection = selectedSectionId &&
        selectedSubsectionIndex.value !== null &&
        selectedSection?.subsections?.[selectedSubsectionIndex.value]
          ? selectedSection.subsections[selectedSubsectionIndex.value]
          : null;
      const selectedSubsectionId = selectedSubsection?.subsectionId || null;
      const selectedQuestionIndexSnapshot = !pendingSectionIdToSelect.value ? selectedQuestionIndex.value : null;
      const selectedQuestionId =
        selectedQuestionIndexSnapshot !== null
          ? (
              selectedSubsection?.questions?.[selectedQuestionIndexSnapshot]?.questionId ||
              selectedSection?.questions?.[selectedQuestionIndexSnapshot]?.questionId ||
              (isFlatMode.value ? rootQuestions.value?.[selectedQuestionIndexSnapshot]?.questionId : null) ||
              null
            )
          : null;
      const hadFlatModeQuestionSelection = !pendingSectionIdToSelect.value && isFlatMode.value && selectedQuestionIndexSnapshot !== null;
      
      isSyncing = true;
      localForm.value = initializeLocalForm();
      // Normalize questions to ensure proper structure
      normalizeQuestions(localForm.value.sections);
      lastEmittedForm = null;
      
      // Restore expanded sections state
      expandedSections.value = preservedExpandedSections;
      // Ensure expanded state exists for all current sections
      if (localForm.value.sections) {
        localForm.value.sections.forEach(section => {
          if (section.sectionId && !section._isRootSection && expandedSections.value[section.sectionId] === undefined) {
            // Keep existing expanded state or default to true for newly added sections
            expandedSections.value[section.sectionId] = true;
          }
        });
      }
      
      // Check if we have a pending section to select (from addSection)
      if (pendingSectionIdToSelect.value && localForm.value.sections) {
        const pendingIndex = localForm.value.sections.findIndex(s => s.sectionId === pendingSectionIdToSelect.value);
        if (pendingIndex !== -1) {
          selectedSectionIndex.value = pendingIndex;
          selectedSubsectionIndex.value = null;
          selectedQuestionIndex.value = null;
          expandedSections.value[pendingSectionIdToSelect.value] = true;
          setTimeout(() => { isSyncing = false; }, 100);
          return; // Don't run normal restoration logic
        } else {
          // Pending section not found yet, but don't restore old selection - wait for it
          // Pending section not found yet, skipping restoration
          setTimeout(() => { isSyncing = false; }, 100);
          return; // Don't restore old selection if we have a pending one
        }
      }
      
      // Restore selection by finding the items by ID in the newly initialized form
      // BUT only if we don't have a pending section to select
      if ((selectedSectionId || hadFlatModeQuestionSelection) && localForm.value.sections && !pendingSectionIdToSelect.value) {
        // Flat mode questions live under the root section's first subsection.
        if (!selectedSectionId && hadFlatModeQuestionSelection) {
          selectedSectionIndex.value = null;
          selectedSubsectionIndex.value = null;
          const rootSection = localForm.value.sections.find(s => s?._isRootSection);
          const rootQuestionsList = rootSection?.subsections?.[0]?.questions || [];
          if (selectedQuestionId) {
            const newQuestionIndex = rootQuestionsList.findIndex(q => q?.questionId === selectedQuestionId);
            selectedQuestionIndex.value = newQuestionIndex !== -1 ? newQuestionIndex : null;
          } else if (
            selectedQuestionIndexSnapshot !== null &&
            selectedQuestionIndexSnapshot >= 0 &&
            selectedQuestionIndexSnapshot < rootQuestionsList.length
          ) {
            selectedQuestionIndex.value = selectedQuestionIndexSnapshot;
          } else {
            selectedQuestionIndex.value = null;
          }
          setTimeout(() => { isSyncing = false; }, 100);
          return;
        }

        const newSectionIndex = localForm.value.sections.findIndex(s => s.sectionId === selectedSectionId);
        if (newSectionIndex !== -1) {
          selectedSectionIndex.value = newSectionIndex;
          const newSection = localForm.value.sections[newSectionIndex];
          
          // Ensure section is expanded when restoring selection
          expandedSections.value[selectedSectionId] = true;
          
          if (selectedSubsectionId && newSection.subsections) {
            const newSubsectionIndex = newSection.subsections.findIndex(sub => sub.subsectionId === selectedSubsectionId);
            if (newSubsectionIndex !== -1) {
              selectedSubsectionIndex.value = newSubsectionIndex;
              const newSubsection = newSection.subsections[newSubsectionIndex];
              
              if (selectedQuestionId && newSubsection.questions) {
                const newQuestionIndex = newSubsection.questions.findIndex(q => q.questionId === selectedQuestionId);
                if (newQuestionIndex !== -1) {
                  selectedQuestionIndex.value = newQuestionIndex;
                } else {
                  selectedQuestionIndex.value = null;
                }
              } else {
                selectedQuestionIndex.value = null;
              }
            } else {
              selectedSubsectionIndex.value = null;
              selectedQuestionIndex.value = null;
            }
          } else {
            selectedSubsectionIndex.value = null;
            if (selectedQuestionId && newSection.questions) {
              const newQuestionIndex = newSection.questions.findIndex(q => q.questionId === selectedQuestionId);
              selectedQuestionIndex.value = newQuestionIndex !== -1 ? newQuestionIndex : null;
            } else {
              selectedQuestionIndex.value = null;
            }
          }
        } else {
          // Section not found - but don't reset if we have a pending selection
          if (!pendingSectionIdToSelect.value) {
            selectedSectionIndex.value = null;
            selectedSubsectionIndex.value = null;
            selectedQuestionIndex.value = null;
          }
        }
      } else {
        // No section ID - but don't reset if we have a pending selection
        if (!pendingSectionIdToSelect.value) {
          selectedSectionIndex.value = null;
          selectedSubsectionIndex.value = null;
          selectedQuestionIndex.value = null;
        }
      }
      
      setTimeout(() => { isSyncing = false; }, 100);
    } else {
      // If structure hasn't changed, just sync property updates without reinitializing
      // This preserves expanded state and selection when editing names
      if (localForm.value.sections && newForm.sections) {
        // Save focused input info before updates
        const wasFocusedSectionId = focusedSectionId.value;
        const wasFocusedSubsectionId = focusedSubsectionId.value;
        const wasFocusedSectionCursorPos = wasFocusedSectionId ? sectionInputRefs.value[wasFocusedSectionId]?.selectionStart : null;
        const wasFocusedSubsectionCursorPos = wasFocusedSubsectionId ? subsectionInputRefs.value[wasFocusedSubsectionId]?.selectionStart : null;
        
        newForm.sections.forEach((newSection, sectionIdx) => {
          const localSection = localForm.value.sections.find(s => s.sectionId === newSection.sectionId);
          if (localSection) {
            // Check if input is actually focused in the DOM (more reliable than just checking ref)
            const sectionInputRef = sectionInputRefs.value[localSection.sectionId];
            const isCurrentlyFocused = sectionInputRef && document.activeElement === sectionInputRef;
            
            // Only update name if not currently focused (to prevent focus loss during typing)
            if (!isCurrentlyFocused && localSection.name !== newSection.name) {
              localSection.name = newSection.name;
            }
            // Always update other properties (they don't affect focus)
            if (localSection.weightage !== newSection.weightage) {
              localSection.weightage = newSection.weightage;
            }
            if (localSection.order !== newSection.order) {
              localSection.order = newSection.order;
            }
            
            // Update subsections properties
            if (newSection.subsections && localSection.subsections) {
              newSection.subsections.forEach((newSubsection) => {
                const localSubsection = localSection.subsections.find(sub => sub.subsectionId === newSubsection.subsectionId);
                if (localSubsection) {
                  const subsectionInputRef = subsectionInputRefs.value[localSubsection.subsectionId];
                  const isSubsectionFocused = subsectionInputRef && document.activeElement === subsectionInputRef;
                  
                  if (!isSubsectionFocused && localSubsection.name !== newSubsection.name) {
                    localSubsection.name = newSubsection.name;
                  }
                  if (localSubsection.weightage !== newSubsection.weightage) {
                    localSubsection.weightage = newSubsection.weightage;
                  }
                  if (localSubsection.order !== newSubsection.order) {
                    localSubsection.order = newSubsection.order;
                  }
                }
              });
            }
          }
        });
        
        // Restore focus and cursor position after updates (if needed)
        if (wasFocusedSectionId) {
          setTimeout(() => {
            const inputRef = sectionInputRefs.value[wasFocusedSectionId];
            if (inputRef && document.activeElement !== inputRef) {
              inputRef.focus();
              if (wasFocusedSectionCursorPos !== null) {
                inputRef.setSelectionRange(wasFocusedSectionCursorPos, wasFocusedSectionCursorPos);
              }
            }
          }, 0);
        }
        
        if (wasFocusedSubsectionId) {
          setTimeout(() => {
            const inputRef = subsectionInputRefs.value[wasFocusedSubsectionId];
            if (inputRef && document.activeElement !== inputRef) {
              inputRef.focus();
              if (wasFocusedSubsectionCursorPos !== null) {
                inputRef.setSelectionRange(wasFocusedSubsectionCursorPos, wasFocusedSubsectionCursorPos);
              }
            }
          }, 0);
        }
      }
    }
  }
}, { immediate: true, deep: true });

// Helper function to clean form data before emitting (remove frontend-only markers and invalid data)
const cleanFormDataForEmit = (formData) => {
  const cleaned = JSON.parse(JSON.stringify(formData)); // Deep clone
  if (cleaned.sections && Array.isArray(cleaned.sections)) {
    // Filter out root sections, but keep sections with empty names (for UI state)
    // Empty sections will be filtered out when submitting to backend
    cleaned.sections = cleaned.sections
      .filter(section => {
        // Remove root sections (frontend-only concept)
        if (section._isRootSection) return false;
        // Keep sections even with empty names - they're needed for UI state
        // They'll be filtered out during submission in FormCreate.vue
        return true;
      })
      .map(section => {
        const cleanedSection = { ...section };
        delete cleanedSection._isRootSection; // Remove frontend-only marker (just in case)
        
        // Keep draft questions with empty text so placeholder-driven UX works.
        // Remove only non-object entries from unexpected malformed payloads.
        if (cleanedSection.questions && Array.isArray(cleanedSection.questions)) {
          cleanedSection.questions = cleanedSection.questions.filter(question => {
            return question && typeof question === 'object';
          });
        }
        
        // Clean subsections: assign default names to empty ones, filter out empty ones with no questions
        if (cleanedSection.subsections && Array.isArray(cleanedSection.subsections)) {
          cleanedSection.subsections = cleanedSection.subsections
            .map((subsection, index) => {
              const cleanedSubsection = { ...subsection };
              
              // Remove frontend-only flags
              delete cleanedSubsection._pendingFocus;
              
              // Keep draft questions with empty text so first-click add is preserved.
              if (cleanedSubsection.questions && Array.isArray(cleanedSubsection.questions)) {
                cleanedSubsection.questions = cleanedSubsection.questions.filter(question => {
                  return question && typeof question === 'object';
                });
              }
              
              // Backend requires non-empty name for all subsections
              // Only assign default name if subsection has questions (valid subsection)
              // Empty subsections without questions will be filtered out before submission
              if (!cleanedSubsection.name || !cleanedSubsection.name.trim()) {
                // Only assign default name if subsection has questions
                const hasQuestions = cleanedSubsection.questions && cleanedSubsection.questions.length > 0;
                if (hasQuestions) {
                  cleanedSubsection.name = `Subsection ${index + 1}`;
                }
              }
              
              return cleanedSubsection;
            });
            // Don't filter out empty subsections here - let validation handle it on "Next" click
        }
        
        return cleanedSection;
      });
  }
  return cleaned;
};

// Watch localForm and emit updates, but prevent circular updates
watch(() => localForm.value, (newForm) => {
  if (!isSyncing) {
    // Don't emit if user is currently typing in a section, subsection, or question settings input
    // This prevents focus loss during typing - check if input is actually focused in DOM
    const hasFocusedSection = focusedSectionId.value !== null && 
      sectionInputRefs.value[focusedSectionId.value] && 
      document.activeElement === sectionInputRefs.value[focusedSectionId.value];
    
    const hasFocusedSubsection = focusedSubsectionId.value !== null && 
      subsectionInputRefs.value[focusedSubsectionId.value] && 
      document.activeElement === subsectionInputRefs.value[focusedSubsectionId.value];
    
    // Check if question settings input is focused (simpler check - just check the ref)
    const hasFocusedQuestionSettings = focusedQuestionSettingsInput.value;
    
    if (hasFocusedSection || hasFocusedSubsection || hasFocusedQuestionSettings) {
      return; // Skip emit while user is typing
    }
    
    // Clean the form data before comparing and emitting
    const cleanedForm = cleanFormDataForEmit(newForm);
    const serialized = JSON.stringify(cleanedForm);
    if (serialized !== lastEmittedForm) {
      lastEmittedForm = serialized;
      emit('update', cleanedForm);
    }
  }
}, { deep: true });

// Ensure selection is valid on mount and when component becomes visible
const ensureSelectionWhenVisible = () => {
  // Wait for localForm to be initialized, then ensure selection
  setTimeout(() => {
    // If we have a pending section to select, prioritize that
    if (pendingSectionIdToSelect.value) {
      const sections = localForm.value.sections || [];
      const pendingIndex = sections.findIndex(s => s.sectionId === pendingSectionIdToSelect.value);
      if (pendingIndex !== -1) {
        selectedSectionIndex.value = pendingIndex;
        selectedSubsectionIndex.value = null;
        selectedQuestionIndex.value = null;
        expandedSections.value[pendingSectionIdToSelect.value] = true;
        return; // Don't run normal ensureSelection
      }
    }
    
    // Don't run ensureSelection if we're currently adding a section
    if (isAddingSection) {
      // Skipping: currently adding section
      return;
    }
    
    // Don't run ensureSelection if we recently added a section (within 5 seconds)
    const timeSinceAdd = Date.now() - lastSectionAddTime;
    if (lastSectionAddTime > 0 && timeSinceAdd < 5000) {
      // Skipping: section was recently added
      return;
    }
    
    ensureSelection();
    
    // Expand all sections by default for better UX
    if (localForm.value.sections) {
      localForm.value.sections.forEach(section => {
        if (section.sectionId && !section._isRootSection) {
          expandedSections.value[section.sectionId] = true;
        }
      });
    }
  }, 100);
};

// Handle clicks outside to blur focused inputs
const handleDocumentClick = (e) => {
  const clickedElement = e.target instanceof Element ? e.target : null;
  if (!clickedElement) return;

  if (!clickedElement.closest('[data-subsection-menu-root]')) {
    openSubsectionMenuKey.value = null;
  }

  // If a question is selected and user clicks outside question surfaces,
  // unselect question and fall back to its parent section settings.
  if (selectedQuestionIndex.value !== null) {
    const clickedInsideQuestionSurface = !!clickedElement.closest('[data-question-card], [data-question-settings-panel]');
    if (!clickedInsideQuestionSurface) {
      selectedQuestionIndex.value = null;
    }
  }

  // Get the clicked element and check if it's an input
  const isSectionInput = clickedElement.tagName === 'INPUT' && 
    (clickedElement.getAttribute('placeholder') === structureSectionNamePh.value || 
     clickedElement.getAttribute('placeholder') === structureSubsectionNamePh.value);
  
  // If we clicked outside section/subsection inputs, blur any focused ones
  if (!isSectionInput) {
    if (Date.now() < suppressOutsideInputBlurUntil) {
      return;
    }
    // Get the currently active element
    const activeElement = document.activeElement;
    
    // Check if we have any focused section or subsection inputs
    let shouldBlur = false;
    
    // Check if active element is a section/subsection input
    if (activeElement && activeElement.tagName === 'INPUT') {
      const placeholder = activeElement.getAttribute('placeholder');
      if (placeholder === structureSectionNamePh.value || placeholder === structureSubsectionNamePh.value) {
        shouldBlur = true;
      }
    }
    
    // Also check tracked refs
    if (focusedSectionId.value || focusedSubsectionId.value) {
      shouldBlur = true;
    }
    
    // Blur all focused inputs
    if (shouldBlur) {
      // Blur the active element first
      if (activeElement && activeElement.tagName === 'INPUT') {
        const placeholder = activeElement.getAttribute('placeholder');
        if (placeholder === structureSectionNamePh.value || placeholder === structureSubsectionNamePh.value) {
          activeElement.blur();
        }
      }
      
      // Also explicitly blur tracked inputs as backup
      if (focusedSectionId.value) {
        const inputRef = sectionInputRefs.value[focusedSectionId.value];
        if (inputRef && inputRef !== activeElement) {
          inputRef.blur();
        }
        focusedSectionId.value = null;
      }
      
      if (focusedSubsectionId.value) {
        const inputRef = subsectionInputRefs.value[focusedSubsectionId.value];
        if (inputRef && inputRef !== activeElement) {
          inputRef.blur();
        }
        focusedSubsectionId.value = null;
      }
    }
  }
};

// Mousedown handler wrapper - runs in capture phase before stopPropagation
const handleDocumentMousedown = (e) => {
  // Check if the clicked element is not an input field
  const clickedElement = e.target;
  const isSectionInput = clickedElement.tagName === 'INPUT' && 
    (clickedElement.getAttribute('placeholder') === structureSectionNamePh.value || 
     clickedElement.getAttribute('placeholder') === structureSubsectionNamePh.value);
  
  // If clicking outside inputs, blur any focused inputs
  // Use setTimeout to run after the click event completes
  if (!isSectionInput) {
    setTimeout(() => {
      if (Date.now() < suppressOutsideInputBlurUntil) {
        return;
      }
      const activeElement = document.activeElement;
      // Check if there's a focused section/subsection input
      if (activeElement && activeElement.tagName === 'INPUT') {
        const placeholder = activeElement.getAttribute('placeholder');
        if (placeholder === structureSectionNamePh.value || placeholder === structureSubsectionNamePh.value) {
          activeElement.blur();
          focusedSectionId.value = null;
          focusedSubsectionId.value = null;
        }
      } else {
        // Also clear refs if active element is not an input
        if (focusedSectionId.value) {
          const inputRef = sectionInputRefs.value[focusedSectionId.value];
          if (inputRef) inputRef.blur();
          focusedSectionId.value = null;
        }
        if (focusedSubsectionId.value) {
          const inputRef = subsectionInputRefs.value[focusedSubsectionId.value];
          if (inputRef) inputRef.blur();
          focusedSubsectionId.value = null;
        }
      }
    }, 10);
  }
};

onMounted(() => {
  ensureSelectionWhenVisible();
  
  // Add document click listener to blur inputs when clicking outside
  // Use capture phase (true) so it fires before any stopPropagation handlers
  document.addEventListener('click', handleDocumentClick, true);
  // Also add mousedown listener as backup (fires before click)
  document.addEventListener('mousedown', handleDocumentMousedown, true);
  
  // Don't auto-focus section names - let users click to edit
});

onBeforeUnmount(() => {
  // Remove document event listeners
  document.removeEventListener('click', handleDocumentClick, true);
  document.removeEventListener('mousedown', handleDocumentMousedown, true);
});

// Watch for when form data changes but form ID stays same (component visibility)
// This helps restore selection when switching back to step 2
let lastFormId = null;
watch(() => props.form?._id, (newId) => {
  if (newId && newId === lastFormId && localForm.value._id === newId) {
    // Same form, component likely became visible again (user switched back to step 2)
    // Restore selection with a delay to ensure Vue has finished rendering
    setTimeout(() => {
      ensureSelectionWhenVisible();
    }, 200);
  }
  lastFormId = newId;
});

const generateId = (prefix) => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const ensureSelection = () => {
  // ABSOLUTE FIRST CHECK: If we recently added a section, NEVER run ensureSelection
  // This is the MOST RELIABLE check - time-based, can't be reset or bypassed
  // Check this BEFORE anything else, even before reading sections
  if (lastSectionAddTime > 0) {
    const timeSinceAddCheck = Date.now() - lastSectionAddTime;
    if (timeSinceAddCheck < 60000) { // 60 seconds - very long window
      // Blocked: section was recently added
      return;
    }
  }
  
  // ABSOLUTE SECOND CHECK: If ensureSelection is disabled, return immediately
  if (ensureSelectionDisabled) {
    // Blocked: ensureSelection is disabled
    return;
  }
  
  // Check for pending section
  if (pendingSectionIdToSelect.value) {
    // Blocked: pending section exists
    return;
  }
  
  // Check if we're currently adding a section
  if (isAddingSection) {
    // Blocked: currently adding section
    return;
  }
  
  const sections = localForm.value.sections || [];
  
  // NUCLEAR OPTION: If we have ANY valid selection > 0, NEVER change it
  // This is the simplest and most reliable fix
  if (selectedSectionIndex.value !== null && selectedSectionIndex.value > 0 && selectedSectionIndex.value < sections.length) {
    // Valid selection exists, keeping it
    return;
  }
  
  // ABSOLUTE FIRST CHECK: If we have a valid non-zero selection, NEVER change it
  // This prevents ensureSelection from "fixing" a perfectly valid selection
  // BUT only if we don't have a pending section (already checked above)
  if (selectedSectionIndex.value !== null && selectedSectionIndex.value > 0 && selectedSectionIndex.value < sections.length) {
    const timeSinceAdd = Date.now() - lastSectionAddTime;
    // If we recently added a section, definitely don't change it
    if (lastSectionAddTime > 0 && timeSinceAdd < 10000) {
      // Keeping valid selection after recent section add
      return;
    }
    // Even if we didn't recently add, if we have a valid non-zero selection, keep it
    // Don't let ensureSelection override a valid selection
    // Keeping valid non-zero selection
    return;
  }
  
  // If we're currently adding a section, don't run ensureSelection at all
  if (isAddingSection) {
    // Blocked: currently adding section
    return;
  }
  
  // If we're in the middle of adding a section and have the skip flag set, don't override selection
  if (skipAutoSelectSubsection && selectedSectionIndex.value !== null) {
    // Just ensure the selected section is valid, but don't change it
    if (selectedSectionIndex.value >= 0 && selectedSectionIndex.value < sections.length) {
      // Keep current selection, just ensure subsection is null if flag is set
      selectedSubsectionIndex.value = null;
      selectedQuestionIndex.value = null;
      return;
    }
  }
  
  const visibleSectionsList = isFlatMode.value ? sections.filter(s => !s._isRootSection) : sections;
  
  if (!visibleSectionsList.length) {
    // Don't reset if we have a pending section
    if (!pendingSectionIdToSelect.value) {
      selectedSectionIndex.value = null;
      selectedSubsectionIndex.value = null;
      selectedQuestionIndex.value = null;
    }
    return;
  }
  
  // Find the actual index in the full sections array
  let targetSectionIndex = selectedSectionIndex.value;
  
  // CRITICAL: If we have a pending section, ALWAYS use that - never default to 0
  // This check must happen BEFORE any other logic that might default to 0
  if (pendingSectionIdToSelect.value) {
    const pendingIndex = sections.findIndex(s => s && s.sectionId === pendingSectionIdToSelect.value);
    if (pendingIndex !== -1) {
      targetSectionIndex = pendingIndex;
      selectedSectionIndex.value = targetSectionIndex;
      selectedSubsectionIndex.value = null;
      selectedQuestionIndex.value = null;
      expandedSections.value[pendingSectionIdToSelect.value] = true;
      return; // Exit early - don't run the rest of ensureSelection
    } else {
      console.warn('ensureSelection: Pending section not found in sections array!');
      // Don't continue if we can't find the pending section
      return;
    }
  }
  
  // CRITICAL: If current selection is valid, don't change it (especially if we recently added a section)
  // BUT: If we recently added a section, check if the current selection is the LAST section (newly added)
  // If not, we should switch to the last section
  if (targetSectionIndex !== null && targetSectionIndex >= 0 && targetSectionIndex < sections.length) {
    const timeSinceAdd = Date.now() - lastSectionAddTime;
    // If we recently added a section, check if we should switch to the newly added section
    if (lastSectionAddTime > 0 && timeSinceAdd < 5000) {
      // First, try to find the pending section by ID (most accurate)
      let newlyAddedIndex = -1;
      if (pendingSectionIdToSelect.value) {
        newlyAddedIndex = sections.findIndex(s => s && s.sectionId === pendingSectionIdToSelect.value);
      }
      // If no pending section ID, assume the last section is the newly added one
      if (newlyAddedIndex === -1) {
        newlyAddedIndex = sections.length - 1;
        // Make sure it's not a root section
        const lastSection = sections[newlyAddedIndex];
        if (lastSection && lastSection._isRootSection) {
          // If last is root, find the last non-root section
          for (let i = sections.length - 1; i >= 0; i--) {
            if (sections[i] && !sections[i]._isRootSection) {
              newlyAddedIndex = i;
              break;
            }
          }
        }
      }
      
      // If current selection is not the newly added section, switch to it
      if (newlyAddedIndex !== -1 && targetSectionIndex !== newlyAddedIndex) {
          // Switching to newly added section
        selectedSectionIndex.value = newlyAddedIndex;
        selectedSubsectionIndex.value = null;
        selectedQuestionIndex.value = null;
        const newlyAddedSection = sections[newlyAddedIndex];
        if (newlyAddedSection && newlyAddedSection.sectionId) {
          expandedSections.value[newlyAddedSection.sectionId] = true;
        }
        return;
      }
      // If current selection IS the newly added section, keep it
      // Keeping selection that matches newly added section
      return; // Keep the current valid selection
    }
    // Even if we didn't recently add a section, if selection is valid and > 0, don't change it to 0
    if (targetSectionIndex > 0) {
      // Keeping valid non-zero selection
      return; // Keep the current valid selection - don't override it
    }
  }
  
  // Only change selection if current selection is invalid
  // Don't override a valid selection when skipAutoSelectSubsection is true
  // CRITICAL: Check again for pending section before changing selection
  if (pendingSectionIdToSelect.value) {
    // Blocked: pending section exists
    return;
  }
  
  if (targetSectionIndex === null || targetSectionIndex < 0 || targetSectionIndex >= sections.length) {
    // CRITICAL: If we recently added a section, NEVER find a new section - just return
    // This prevents ensureSelection from finding index 1 and overriding newly added sections
    if (lastSectionAddTime > 0) {
      const timeSinceAddBeforeFind = Date.now() - lastSectionAddTime;
      if (timeSinceAddBeforeFind < 60000) {
        // Blocked: section was recently added
        return; // Don't find a new section - let the newly added section stay selected
      }
    }
    
    // Prefer the LAST visible section (most likely the newly added one) instead of the first
    // Start from the end and work backwards
    let foundIndex = -1;
    for (let i = sections.length - 1; i >= 0; i--) {
      if (visibleSectionsList.includes(sections[i])) {
        foundIndex = i;
        break;
      }
    }
    // Fallback: if no section found from the end, find the first visible section
    if (foundIndex === -1) {
      foundIndex = sections.findIndex(s => visibleSectionsList.includes(s));
    }
    targetSectionIndex = foundIndex;
    
    // NEVER default to 0 if we have multiple sections - find a non-zero section instead
    if (targetSectionIndex === 0 && sections.length > 1) {
      // CRITICAL: If we have a pending section, use that instead of finding a non-zero section
      if (pendingSectionIdToSelect.value) {
        const pendingIndex = sections.findIndex(s => s && s.sectionId === pendingSectionIdToSelect.value);
        if (pendingIndex !== -1) {
          // Using pending section
          targetSectionIndex = pendingIndex;
          // CRITICAL: Set the selection immediately and return - don't continue with other logic
          selectedSectionIndex.value = pendingIndex;
          selectedSubsectionIndex.value = null;
          selectedQuestionIndex.value = null;
          expandedSections.value[pendingSectionIdToSelect.value] = true;
          return; // Exit early - don't run any other selection logic
        } else {
          // Pending section not found, finding non-zero section
        }
      } else {
        // Find the LAST visible section that's not at index 0 (most likely the newly added one)
        // Start from the end and work backwards to find the last non-zero visible section
        let nonZeroIndex = -1;
        for (let i = sections.length - 1; i > 0; i--) {
          if (visibleSectionsList.includes(sections[i])) {
            nonZeroIndex = i;
            break;
          }
        }
        // Fallback: if no section found from the end, find the first non-zero section
        if (nonZeroIndex === -1) {
          nonZeroIndex = sections.findIndex((s, idx) => idx > 0 && visibleSectionsList.includes(s));
        }
        if (nonZeroIndex !== -1) {
          // CRITICAL: Check for pending section again before setting - this is the last chance to block
          if (pendingSectionIdToSelect.value) {
            // Blocked: pending section exists
            return;
          }
          // CRITICAL: Also check if we recently added a section
          const timeSinceAdd = Date.now() - lastSectionAddTime;
          if (lastSectionAddTime > 0 && timeSinceAdd < 20000) {
            // Blocked: section was recently added
            return;
          }
          // CRITICAL: Check if current selection is valid and was recently set
          // If current selection is valid and > nonZeroIndex, don't change it
          if (selectedSectionIndex.value !== null && selectedSectionIndex.value > nonZeroIndex && selectedSectionIndex.value < sections.length) {
            const timeSinceAdd2 = Date.now() - lastSectionAddTime;
            if (lastSectionAddTime > 0 && timeSinceAdd2 < 20000) {
              // Blocked: current selection is valid and higher
              return;
            }
          }
          // CRITICAL: Before setting to nonZeroIndex, check if current selection is higher
          // If we recently added a section and current selection is higher, keep it
          if (selectedSectionIndex.value !== null && selectedSectionIndex.value > nonZeroIndex) {
            const timeSinceAddCheck = Date.now() - lastSectionAddTime;
            if (lastSectionAddTime > 0 && timeSinceAddCheck < 20000) {
              // Blocked: current selection is higher
              return;
            }
          }
          // FINAL CHECK: Before setting to nonZeroIndex, check if we should keep current selection
          // CRITICAL: If we recently added a section, NEVER set to a lower index
          const timeSinceAddBeforeSet = Date.now() - lastSectionAddTime;
          if (lastSectionAddTime > 0 && timeSinceAddBeforeSet < 20000) {
            // Blocked: section was recently added
            return;
          }
          if (selectedSectionIndex.value !== null && selectedSectionIndex.value > 0 && selectedSectionIndex.value < sections.length) {
            // If current selection is valid and >= nonZeroIndex, keep it
            if (selectedSectionIndex.value >= nonZeroIndex) {
              // Blocked: current selection is >= target
              return;
            }
          }
          // CRITICAL: Before setting to nonZeroIndex, check if we recently added a section
          // If we did, don't set it - the newly added section should be selected instead
          if (lastSectionAddTime > 0) {
            const timeSinceAddBeforeNonZero = Date.now() - lastSectionAddTime;
            if (timeSinceAddBeforeNonZero < 60000) {
              // Blocked: section was recently added
              return; // Don't set anything - let the newly added section stay selected
            }
          }
          // Found non-zero visible section
          targetSectionIndex = nonZeroIndex;
        } else {
          // If we can't find a non-zero section, just keep current selection if it's valid
          if (selectedSectionIndex.value !== null && selectedSectionIndex.value > 0 && selectedSectionIndex.value < sections.length) {
            console.warn('ensureSelection: Would set to 0, but keeping current valid selection', selectedSectionIndex.value);
            return;
          }
        }
      }
    }
    // If we can't find a valid section, just return
    if (targetSectionIndex === -1) {
      console.warn('ensureSelection: No valid section found, returning without changing selection');
      return;
    }
  } else if (isFlatMode.value && sections[targetSectionIndex]?._isRootSection) {
    // If selected section is root section, switch to first visible section
    targetSectionIndex = sections.findIndex(s => visibleSectionsList.includes(s));
    if (targetSectionIndex === -1) {
      console.warn('ensureSelection: No visible section found, returning');
      return;
    }
    // NEVER default to 0 if we have multiple sections
    if (targetSectionIndex === 0 && sections.length > 1) {
      const nonZeroIndex = sections.findIndex((s, idx) => idx > 0 && visibleSectionsList.includes(s));
      if (nonZeroIndex !== -1) {
        console.log('ensureSelection: Found non-zero visible section at index', nonZeroIndex, 'instead of using 0 (flat mode)');
        targetSectionIndex = nonZeroIndex;
      }
    }
  }

  // CRITICAL CHECK: Never set to 0 if we have a pending section
  if (pendingSectionIdToSelect.value) {
    console.warn('ensureSelection: Blocked! pendingSectionIdToSelect exists but we reached the end - this should not happen');
    return; // Don't set anything if we have a pending section
  }
  
  if (isAddingSection) {
    console.warn('ensureSelection: Blocked! isAddingSection is true but we reached the end');
    return;
  }
  
  // FINAL CHECK: Never set to 0 if we have pending section or are adding
  if (pendingSectionIdToSelect.value || isAddingSection) {
    console.warn('ensureSelection: FINAL BLOCK - pending section or adding section exists, not setting selection');
    return;
  }
  
  // CRITICAL: Never change from a valid non-zero selection to 0 if we recently added a section
  // This is a simpler, more direct check that doesn't rely on flags
  if (targetSectionIndex === 0 && selectedSectionIndex.value !== null && selectedSectionIndex.value > 0) {
    const timeSinceAdd = Date.now() - lastSectionAddTime;
    if (lastSectionAddTime > 0 && timeSinceAdd < 5000) { // 5 second window
      console.warn('ensureSelection: BLOCKED - Attempted to change selection from', selectedSectionIndex.value, 'to 0 after recently adding section (', timeSinceAdd, 'ms ago)');
      return;
    }
  }
  
  // CRITICAL: Never set to 0 if we recently added a section - check BEFORE any other logic
  // This must happen before the skipAutoSelectSubsection check
  // ALWAYS block setting to 0 if we recently added a section, regardless of current selection
  if (targetSectionIndex === 0) {
    const timeSinceAdd = Date.now() - lastSectionAddTime;
    if (lastSectionAddTime > 0 && timeSinceAdd < 10000) { // 10 second window
      console.warn('ensureSelection: BLOCKED - Attempted to set selection to 0, but section was added', timeSinceAdd, 'ms ago. BLOCKING!');
      return; // Never set to 0 if we recently added a section
    }
    // Also block if we have a pending section or are adding a section
    if (pendingSectionIdToSelect.value || isAddingSection) {
      console.warn('ensureSelection: BLOCKED - Attempted to set selection to 0 while pending section exists or adding section');
      return;
    }
    // Also block if current selection is valid and non-zero (don't override valid selections)
    if (selectedSectionIndex.value !== null && selectedSectionIndex.value > 0) {
      const sections = localForm.value.sections || [];
      if (selectedSectionIndex.value < sections.length) {
        console.warn('ensureSelection: BLOCKED - Attempted to set selection to 0, but current selection', selectedSectionIndex.value, 'is valid. BLOCKING!');
        return;
      }
    }
  }
  
  // Only update if we're not skipping auto-select (i.e., not adding a new section)
  if (!skipAutoSelectSubsection || targetSectionIndex === selectedSectionIndex.value) {
    // FINAL ABSOLUTE CHECK: Never set to 0 if we have multiple sections
    // This is the absolute last line of defense
    if (targetSectionIndex === 0 && sections.length > 1) {
      // Check if we recently added a section
      const timeSinceAdd = Date.now() - lastSectionAddTime;
      if (lastSectionAddTime > 0 && timeSinceAdd < 10000) {
        console.warn('ensureSelection: FINAL BLOCK - Attempted to set selection to 0, but section was added', timeSinceAdd, 'ms ago. BLOCKING!');
        return;
      }
      // If we have multiple sections, never set to 0 - use the first visible section instead
      const firstVisibleIndex = sections.findIndex(s => visibleSectionsList.includes(s));
      if (firstVisibleIndex > 0) {
        console.warn('ensureSelection: Would set to 0, but we have', sections.length, 'sections. Using first visible section at index', firstVisibleIndex, 'instead.');
        targetSectionIndex = firstVisibleIndex;
      } else {
        console.warn('ensureSelection: FINAL BLOCK - Attempted to set selection to 0, but we have', sections.length, 'sections. BLOCKING!');
        return;
      }
    }
    
    // FINAL CRITICAL CHECK: Before setting selection, make absolutely sure we don't have a pending section
    if (pendingSectionIdToSelect.value) {
      console.log('ensureSelection: BLOCKED at final check - pendingSectionIdToSelect exists:', pendingSectionIdToSelect.value, '- NOT setting to', targetSectionIndex);
      return;
    }
    // Also check if we recently added a section
    const timeSinceAddFinal = Date.now() - lastSectionAddTime;
    if (lastSectionAddTime > 0 && timeSinceAddFinal < 20000) {
      console.log('ensureSelection: BLOCKED at final check - Section was added', timeSinceAddFinal, 'ms ago - NOT setting to', targetSectionIndex);
      return;
    }
    // ABSOLUTE FINAL CHECK: Never set to a lower or equal index if current selection is valid and > 0
    if (selectedSectionIndex.value !== null && selectedSectionIndex.value > 0 && selectedSectionIndex.value < sections.length) {
      if (targetSectionIndex <= selectedSectionIndex.value) {
        console.log('ensureSelection: BLOCKED - Would set to', targetSectionIndex, 'but current selection', selectedSectionIndex.value, 'is >= target - keeping current');
        return;
      }
    }
    console.log('ensureSelection: Setting selection to', targetSectionIndex);
    selectedSectionIndex.value = targetSectionIndex;
  } else {
    console.log('ensureSelection: Skipping update because skipAutoSelectSubsection is true');
  }

  const section = sections[targetSectionIndex];
  
  // Priority: section questions > first subsection > nothing
  if (section.questions && section.questions.length > 0) {
    // Section has questions, select first section-level question
    selectedSubsectionIndex.value = null;
    selectedQuestionIndex.value = 0;
    // Ensure section is expanded
    if (section.sectionId) {
      expandedSections.value[section.sectionId] = true;
    }
    return;
  }
  
  const subsections = section?.subsections || [];
  if (!subsections.length) {
    selectedSubsectionIndex.value = null;
    selectedQuestionIndex.value = null;
    // Ensure section is expanded
    if (section.sectionId) {
      expandedSections.value[section.sectionId] = true;
    }
    return;
  }

  // Only auto-select first subsection if flag is not set and no subsection is explicitly selected
  if (!skipAutoSelectSubsection && (selectedSubsectionIndex.value === null || selectedSubsectionIndex.value >= subsections.length)) {
    selectedSubsectionIndex.value = 0;
  } else if (skipAutoSelectSubsection && selectedSubsectionIndex.value === null) {
    // Keep subsection as null if flag is set
    selectedSubsectionIndex.value = null;
    selectedQuestionIndex.value = null;
    return;
  }

  const selectedSubsection = subsections[selectedSubsectionIndex.value];
  const questions = selectedSubsection?.questions || [];
  if (!questions.length) {
    selectedQuestionIndex.value = null;
    // Ensure section is expanded
    if (section.sectionId) {
      expandedSections.value[section.sectionId] = true;
    }
    return;
  }

  if (selectedQuestionIndex.value === null || selectedQuestionIndex.value >= questions.length) {
    selectedQuestionIndex.value = 0;
  }
  
  // Ensure section is expanded
  if (section.sectionId) {
    expandedSections.value[section.sectionId] = true;
  }
};

const toggleSectionExpand = (sectionId) => {
  expandedSections.value[sectionId] = !expandedSections.value[sectionId];
};

// Helper method for section input click (to avoid accessing document in template)
const handleSectionInputClick = (e, sectionIndex) => {
  e.stopPropagation();
  if (sectionIndex !== null && sectionIndex !== undefined && sectionIndex >= 0) {
    selectSection(sectionIndex, true, true);
  }
  // Only focus if not already focused to avoid unwanted selection
  if (typeof document !== 'undefined' && document.activeElement !== e.target) {
    e.target.focus();
    // Place cursor at end of text instead of selecting all
    const length = e.target.value.length;
    e.target.setSelectionRange(length, length);
  }
};

const setSectionInputRef = (el, sectionId) => {
  if (!sectionId) return;
  if (el) {
    sectionInputRefs.value[sectionId] = el;
    if (pendingSectionFocusId.value === sectionId) {
      setTimeout(() => {
        if (pendingSectionFocusId.value !== sectionId) return;
        if (el && typeof el.focus === 'function') {
          suppressOutsideInputBlurUntil = Date.now() + 800;
          el.focus();
          const length = el.value ? el.value.length : 0;
          if (typeof el.setSelectionRange === 'function') {
            el.setSelectionRange(length, length);
          }
          focusedSectionId.value = sectionId;
        }
        pendingSectionFocusId.value = null;
      }, 10);
    }
  } else {
    delete sectionInputRefs.value[sectionId];
  }
};

// Store pending subsection IDs that we're waiting to focus
// Use a closure variable to avoid reactivity issues
const pendingSubsectionFocusSet = new Set();

// Helper method to set subsection input ref
const setSubsectionInputRef = (el, subsectionId) => {
  if (el && subsectionId) {
    // Only process if this is a new element (not already set) or if we need to focus
    const existingRef = subsectionInputRefs.value[subsectionId];
    const isNewElement = existingRef !== el;
    
    // Directly set the ref (Vue reactivity will handle it)
    subsectionInputRefs.value[subsectionId] = el;
    
    // Only check for pending focus if this is a new element or if we haven't checked yet
    if (isNewElement) {
      // Check multiple ways if we should focus:
      // 1. Check closure Set
      // 2. Check if subsection has _pendingFocus flag
      const hasPendingInSet = pendingSubsectionFocusSet.has(subsectionId);
      
      // Find the subsection in localForm to check for _pendingFocus flag
      let subsection = null;
      for (const section of localForm.value.sections || []) {
        if (section.subsections) {
          subsection = section.subsections.find(sub => sub.subsectionId === subsectionId);
          if (subsection) break;
        }
      }
      
      const hasPendingFlag = subsection && subsection._pendingFocus === true;
      const shouldFocus = hasPendingInSet || hasPendingFlag;
      
      // Only focus if this is a new subsection that needs focus
      if (shouldFocus) {
        // Clear the flags
        pendingSubsectionFocusSet.delete(subsectionId);
        if (subsection) {
          delete subsection._pendingFocus;
        }
        
        // Focus immediately
        setTimeout(() => {
          if (el && typeof el.focus === 'function') {
            el.focus();
            const length = el.value ? el.value.length : 0;
            if (typeof el.setSelectionRange === 'function') {
              el.setSelectionRange(length, length);
            }
          }
        }, 10);
      }
    }
  } else if (el === null && subsectionId) {
    // Ref is being unset (element removed)
    delete subsectionInputRefs.value[subsectionId];
    pendingSubsectionFocusSet.delete(subsectionId);
  }
};

// Helper method for subsection input click
const handleSubsectionInputClick = (e, sectionIndex, subsectionIndex) => {
  e.stopPropagation();
  selectSubsection(sectionIndex, subsectionIndex, true);
  // Focus the input
  if (typeof document !== 'undefined' && document.activeElement !== e.target) {
    e.target.focus();
    const length = e.target.value.length;
    e.target.setSelectionRange(length, length);
  }
};

// Helper methods for blur handlers (to avoid using window.setTimeout in templates)
const handleSectionNameBlur = () => {
  focusedSectionId.value = null;
  // Emit update after user finishes typing (on blur)
  setTimeout(() => {
    if (!isSyncing) {
      const cleanedForm = cleanFormDataForEmit(localForm.value);
      const serialized = JSON.stringify(cleanedForm);
      if (serialized !== lastEmittedForm) {
        lastEmittedForm = serialized;
        emit('update', cleanedForm);
      }
    }
  }, 100);
};

const handleSubsectionNameBlur = () => {
  focusedSubsectionId.value = null;
  // Emit update after user finishes typing (on blur)
  setTimeout(() => {
    if (!isSyncing) {
      const cleanedForm = cleanFormDataForEmit(localForm.value);
      const serialized = JSON.stringify(cleanedForm);
      if (serialized !== lastEmittedForm) {
        lastEmittedForm = serialized;
        emit('update', cleanedForm);
      }
    }
  }, 100);
};

const selectSection = (index, skipAutoSelectSubsection = false, skipAutoSelectQuestion = false) => {
  // Validate index before proceeding
  if (index === null || index === undefined || index < 0 || !localForm.value.sections || index >= localForm.value.sections.length) {
    console.warn('selectSection: invalid index', index, 'sections length:', localForm.value.sections?.length);
    return;
  }
  
  selectedSectionIndex.value = index;
  selectedSubsectionIndex.value = null;
  
  // If skipAutoSelectQuestion is true, don't auto-select any questions (show section settings)
  if (skipAutoSelectQuestion) {
    selectedQuestionIndex.value = null;
  } else {
    // If section has questions, select first question; otherwise select first subsection if available
    const section = localForm.value.sections[index];
    if (section) {
      if (section.questions && section.questions.length > 0) {
        selectedQuestionIndex.value = 0;
      } else if (!skipAutoSelectSubsection && section.subsections && section.subsections.length > 0) {
        // Only auto-select subsection if not explicitly skipped
        selectedSubsectionIndex.value = 0;
        const firstSubsection = section.subsections[0];
        if (firstSubsection.questions && firstSubsection.questions.length > 0) {
          selectedQuestionIndex.value = 0;
        } else {
          selectedQuestionIndex.value = null;
        }
      } else {
        selectedQuestionIndex.value = null;
      }
    }
  }
  
  // Auto-expand section when selected
  const section = localForm.value.sections[index];
  if (section && section.sectionId) {
    expandedSections.value[section.sectionId] = true;
  }
};

const selectSubsection = (sectionIndex, subIndex, skipAutoSelectQuestion = false) => {
  selectedSectionIndex.value = sectionIndex;
  selectedSubsectionIndex.value = subIndex;
  
  // If skipAutoSelectQuestion is true, don't auto-select any questions (show subsection settings)
  if (skipAutoSelectQuestion) {
    selectedQuestionIndex.value = null;
  } else {
    // Select first question in subsection if available
    const section = localForm.value.sections[sectionIndex];
    const subsection = section?.subsections?.[subIndex];
    if (subsection?.questions && subsection.questions.length > 0) {
      selectedQuestionIndex.value = 0;
    } else {
      selectedQuestionIndex.value = null;
    }
  }
  
  // Ensure section is expanded when subsection is selected
  const section = localForm.value.sections[sectionIndex];
  if (section && section.sectionId) {
    expandedSections.value[section.sectionId] = true;
  }
};

const selectQuestion = (qIndex) => {
  selectedQuestionIndex.value = qIndex;
  scrollToQuestion(qIndex);
};

// Scroll to a specific question in the scrollable container
const scrollToQuestion = (qIndex) => {
  nextTick(() => {
    const questionElement = questionRefs.value[qIndex];
    const scrollContainer = questionsScrollContainer.value;
    
    if (questionElement && scrollContainer) {
      // Calculate the position relative to the scroll container
      const containerRect = scrollContainer.getBoundingClientRect();
      const elementRect = questionElement.getBoundingClientRect();
      
      // Calculate scroll position to center the question in view
      const scrollTop = scrollContainer.scrollTop;
      const elementTop = elementRect.top - containerRect.top + scrollTop;
      const elementHeight = elementRect.height;
      const containerHeight = scrollContainer.clientHeight;
      
      // Scroll to show the question, with some padding
      const targetScroll = elementTop - (containerHeight / 2) + (elementHeight / 2);
      
      scrollContainer.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: 'smooth'
      });
    }
  });
};

const focusSectionNameInputById = (sectionId, attempt = 0) => {
  if (!sectionId || attempt > 30) return;
  nextTick(() => {
    const inputRef = sectionInputRefs.value?.[sectionId];
    if (inputRef && typeof inputRef.focus === 'function') {
      inputRef.focus();
      const length = inputRef.value ? inputRef.value.length : 0;
      if (typeof inputRef.setSelectionRange === 'function') {
        inputRef.setSelectionRange(length, length);
      }
      return;
    }
    setTimeout(() => focusSectionNameInputById(sectionId, attempt + 1), 50);
  });
};

const focusQuestionSettingsTextInput = (attempt = 0) => {
  if (attempt > 30 || typeof document === 'undefined') return;
  nextTick(() => {
    const inputEl = document.querySelector('input[data-question-settings-text-input="true"]');
    if (inputEl && typeof inputEl.focus === 'function') {
      inputEl.focus();
      const length = inputEl.value ? inputEl.value.length : 0;
      if (typeof inputEl.setSelectionRange === 'function') {
        inputEl.setSelectionRange(length, length);
      }
      return;
    }
    setTimeout(() => focusQuestionSettingsTextInput(attempt + 1), 50);
  });
};

// Scroll to a specific section in the scrollable structure container
const scrollToSection = (sIndex) => {
  nextTick(() => {
    // Find the section in visibleSections to get the correct ref index
    const section = localForm.value.sections?.[sIndex];
    if (!section) {
      console.warn('scrollToSection: Section not found at index', sIndex);
      return;
    }
    
    // Find the index in visibleSections array (filters out root sections in flat mode)
    const visibleIndex = visibleSections.value.findIndex(s => s.sectionId === section.sectionId);
    if (visibleIndex === -1) {
      console.warn('scrollToSection: Section not found in visibleSections', section.sectionId);
      return;
    }
    
    // Get container - try ref first, then querySelector
    let scrollContainer = structureScrollContainer.value;
    if (!scrollContainer) {
      scrollContainer = document.querySelector('[data-structure-scroll-container]');
    }
    
    if (!scrollContainer) {
      // Retry if container not found
      setTimeout(() => scrollToSection(sIndex), 150);
      return;
    }
    
    // Try to get element from refs first (most reliable)
    let sectionElement = sectionRefs.value[visibleIndex];
    
    // Fallback: Get all section elements from the container
    if (!sectionElement) {
      const allSections = Array.from(scrollContainer.children).filter(el => 
        el.hasAttribute('draggable') && el.getAttribute('draggable') === 'true'
      );
      sectionElement = allSections[visibleIndex];
    }
    
    if (!sectionElement) {
      // Retry if element not found
      setTimeout(() => scrollToSection(sIndex), 200);
      return;
    }
    
    // Use scrollIntoView for reliable scrolling - works even when element is outside viewport
    // But we need to scroll within the container, not the whole page
    // So we'll calculate the position manually
    
    // Calculate position by summing heights of all previous sections
    // This works even when element is outside viewport
    let elementOffsetTop = 0;
    
    // Get all sections to calculate position
    const allSections = Array.from(scrollContainer.children).filter(el => 
      el.hasAttribute('draggable') && el.getAttribute('draggable') === 'true'
    );
    
    // Sum heights of all sections before the target
    for (let i = 0; i < visibleIndex; i++) {
      if (allSections[i]) {
        elementOffsetTop += allSections[i].offsetHeight || 0;
      }
    }
    
    // Calculate target scroll to center the section in viewport
    const containerHeight = scrollContainer.clientHeight;
    const elementHeight = sectionElement.offsetHeight || sectionElement.getBoundingClientRect().height || 50;
    const targetScroll = elementOffsetTop - (containerHeight / 2) + (elementHeight / 2);
    
    // Ensure scroll is within bounds
    const maxScroll = Math.max(0, scrollContainer.scrollHeight - containerHeight);
    const finalScroll = Math.max(0, Math.min(targetScroll, maxScroll));
    
    // Perform the scroll with smooth behavior
    scrollContainer.scrollTo({
      top: finalScroll,
      behavior: 'smooth'
    });
  });
};

const currentSection = computed(() => {
  if (
    selectedSectionIndex.value === null ||
    !localForm.value.sections ||
    !localForm.value.sections[selectedSectionIndex.value]
  ) {
    return null;
  }
  return localForm.value.sections[selectedSectionIndex.value];
});

const currentSubsection = computed(() => {
  if (!currentSection.value) return null;
  const subs = currentSection.value.subsections || [];
  if (
    selectedSubsectionIndex.value === null ||
    selectedSubsectionIndex.value < 0 ||
    selectedSubsectionIndex.value >= subs.length
  ) {
    return null;
  }
  return subs[selectedSubsectionIndex.value];
});

const currentQuestion = computed(() => {
  const qs = currentQuestions.value;
  if (
    selectedQuestionIndex.value === null ||
    selectedQuestionIndex.value < 0 ||
    selectedQuestionIndex.value >= qs.length
  ) {
    return null;
  }
  return qs[selectedQuestionIndex.value];
});

const getNumberPassValuePlaceholder = () => {
  const rule = currentQuestion.value?.scoring?.passCondition?.rule;
  return rule === '>=' ? t('forms.builderEnterMinValuePh') : t('forms.builderEnterMaxValuePh');
};

// Root question selection for flat mode
const selectedRootQuestion = computed(() => {
  if (!isFlatMode.value) return null;
  const questions = rootQuestions.value;
  if (
    selectedQuestionIndex.value === null ||
    selectedQuestionIndex.value < 0 ||
    selectedQuestionIndex.value >= questions.length
  ) {
    return null;
  }
  return questions[selectedQuestionIndex.value];
});

// Drag-drop state for root questions
const draggedRootQuestionIndex = ref(null);
const dragOverRootQuestionIndex = ref(null);

const currentSubsectionTitle = computed(() => {
  if (currentSubsection.value) {
    return currentSubsection.value.name || t('forms.builderUntitledSubsection');
  }
  // If section is selected but no subsection, show section name
  if (currentSection.value) {
    return currentSection.value.name || t('forms.builderUntitledSection');
  }
  return t('forms.builderNoSubsectionSelected');
});

const currentSectionSummary = computed(() => {
  if (!currentSection.value) return '';
  const subs = currentSection.value.subsections || [];
  const qCount = subs.reduce((acc, s) => acc + (s.questions ? s.questions.length : 0), 0);
  return t('forms.builderSectionSummary', { subsectionCount: subs.length, questionCount: qCount });
});

const questionPalette = computed(() => [
  { type: 'Text', label: t('forms.builderPaletteShortText'), primary: true },
  { type: 'Textarea', label: t('forms.builderPaletteLongText'), primary: false },
  { type: 'Yes-No', label: t('forms.builderPaletteYesNo'), primary: true },
  { type: 'Dropdown', label: t('forms.builderPaletteDropdown'), primary: true },
  { type: 'Rating', label: t('forms.builderPaletteRating'), primary: false },
  { type: 'Number', label: t('forms.builderPaletteNumber'), primary: false },
  { type: 'Date', label: t('forms.builderPaletteDate'), primary: false },
  { type: 'Email', label: t('forms.builderPaletteEmail'), primary: false },
  { type: 'File', label: t('forms.builderPaletteFileUpload'), primary: false },
  { type: 'Signature', label: t('forms.builderPaletteSignature'), primary: false },
]);

const addSection = () => {
  // Check edit permissions
  if (!canModifyFormStructure.value) {
    if (isLocked.value) {
      showDuplicateDialog.value = true;
    } else {
      const message = getBlockingMessage(formStatus.value);
      if (message) {
        alert(message);
      }
    }
    return;
  }
  
  // ABSOLUTE FIRST THING: Disable ensureSelection immediately to prevent any interference
  ensureSelectionDisabled = true;
  // Disabled ensureSelection to prevent interference
  
  if (!localForm.value.sections) {
    localForm.value.sections = [];
  }
  
  // Clear any previous section addition timers/intervals to prevent conflicts
  // CRITICAL: Clear these BEFORE setting new flags to prevent race conditions
  if (activeSectionAddInterval) {
    console.log('addSection: Clearing previous interval');
    clearInterval(activeSectionAddInterval);
    activeSectionAddInterval = null;
  }
  if (activeSectionAddTimeout) {
    console.log('addSection: Clearing previous timeout');
    clearTimeout(activeSectionAddTimeout);
    activeSectionAddTimeout = null;
  }
  if (activeSelectionGuard) {
    console.log('addSection: Stopping previous selection guard');
    activeSelectionGuard(); // Stop the previous watcher
    activeSelectionGuard = null;
  }
  
  // CRITICAL: Clear pendingSectionIdToSelect from previous addition to prevent conflicts
  // But only if we're starting a new addition (not continuing an old one)
  if (pendingSectionIdToSelect.value) {
    console.log('addSection: Clearing previous pendingSectionIdToSelect:', pendingSectionIdToSelect.value);
    pendingSectionIdToSelect.value = null;
  }
  
  // Set ALL flags FIRST - BEFORE any reactive updates that might trigger ensureSelection
  // This is critical to prevent ensureSelection from running during section addition
  // IMPORTANT: Set these flags synchronously before any reactive updates
  // CRITICAL: Keep ensureSelectionDisabled true - don't let it be reset
  ensureSelectionDisabled = true; // Keep it true - don't let previous timeouts reset it
  lastSectionAddTime = Date.now(); // Track when we added the section - SET FIRST!
  isAddingSection = true;
  skipAutoSelectSubsection = true;
  isSyncing = true;
  
  // All flags set to prevent ensureSelection interference
  
  const newSection = {
    sectionId: generateId('SEC'),
    name: '',
    weightage: 0,
    subsections: [],
    questions: [],
    order: localForm.value.sections.length,
    sectionScoring: {
      weight: 1,
      threshold: 100
    }
  };
  
  const sectionIdToSelect = newSection.sectionId;
  pendingSectionFocusId.value = sectionIdToSelect;
  suppressOutsideInputBlurUntil = Date.now() + 800;
  
  // CRITICAL: Set pendingSectionIdToSelect BEFORE pushing to array
  // This ensures ensureSelection can see it if it runs immediately after the push
  pendingSectionIdToSelect.value = sectionIdToSelect;
  
  // Calculate the expected index BEFORE pushing
  const expectedIndex = localForm.value.sections.length;
  
  // NOW push to array
  localForm.value.sections.push(newSection);
  
  // Calculate the actual index AFTER pushing (should be the same as expectedIndex)
  const actualIndex = localForm.value.sections.length - 1; // Index AFTER pushing (last item)
  
  // Set selection IMMEDIATELY - AFTER pushing to array
  // This ensures we're selecting the correct index
  selectedSectionIndex.value = actualIndex;
  selectedSubsectionIndex.value = null;
  selectedQuestionIndex.value = null;
  focusSectionNameInputById(sectionIdToSelect);
  
  // Expand and select IMMEDIATELY - synchronously, before any async operations
  expandedSections.value[newSection.sectionId] = true;
  
  // Force set selection again to ensure it sticks
  selectedSectionIndex.value = actualIndex;
  
  // CRITICAL: Verify the selection is correct by finding the section by ID
  // This ensures we're selecting the right section even if indices changed
  const verifyIndex = localForm.value.sections.findIndex(s => s && s.sectionId === sectionIdToSelect);
  if (verifyIndex !== -1 && verifyIndex !== selectedSectionIndex.value) {
    console.warn('addSection: Selection mismatch! Expected', verifyIndex, 'but got', selectedSectionIndex.value, '- correcting');
    selectedSectionIndex.value = verifyIndex;
  }
  
  // Schedule scroll to the new section after DOM updates
  // Use multiple attempts to ensure it works
  setTimeout(() => {
    const finalIndex = localForm.value.sections.findIndex(s => s && s.sectionId === sectionIdToSelect);
    if (finalIndex !== -1) {
      scrollToSection(finalIndex);
      // Also try again after a longer delay as backup
      setTimeout(() => {
        scrollToSection(finalIndex);
      }, 300);
    }
  }, 250);
  
  // Set up the selection guard IMMEDIATELY - this will catch ANY changes
  activeSelectionGuard = watch(selectedSectionIndex, (newVal, oldVal) => {
    if (pendingSectionIdToSelect.value === sectionIdToSelect) {
      const correctIdx = localForm.value.sections.findIndex(s => s && s.sectionId === sectionIdToSelect);
      if (correctIdx !== -1 && newVal !== correctIdx) {
        console.warn('addSection: Selection guard caught change from', oldVal, 'to', newVal, '! IMMEDIATELY correcting back to', correctIdx);
        // Set it immediately, synchronously - don't wait for nextTick
        selectedSectionIndex.value = correctIdx;
        selectedSubsectionIndex.value = null;
        selectedQuestionIndex.value = null;
      }
    }
  }, { immediate: false, flush: 'sync' });
  
  // Force it again immediately in the same tick to override any watchers
  // Use a microtask to ensure it runs after any synchronous watchers
  Promise.resolve().then(() => {
    if (pendingSectionIdToSelect.value === sectionIdToSelect) {
      const idx = localForm.value.sections.findIndex(s => s && s.sectionId === sectionIdToSelect);
      if (idx !== -1) {
        selectedSectionIndex.value = idx;
        selectedSubsectionIndex.value = null;
        selectedQuestionIndex.value = null;
        // Forced selection to correct index
      }
    }
  });
  
  // Force Vue to recognize the change by triggering reactivity
  nextTick(() => {
    // Re-set to ensure reactivity
    if (pendingSectionIdToSelect.value === sectionIdToSelect) {
      const idx = localForm.value.sections.findIndex(s => s && s.sectionId === sectionIdToSelect);
      if (idx !== -1) {
        // Always set it, even if it's already correct, to ensure reactivity
        selectedSectionIndex.value = idx;
        selectedSubsectionIndex.value = null;
        selectedQuestionIndex.value = null;
        // Forced selection to correct index in nextTick
      }
    }
  });
  
  // Emit update
  nextTick(() => {
    // Re-select in nextTick - find by ID to handle any reordering
    const index = localForm.value.sections.findIndex(s => s && s.sectionId === sectionIdToSelect);
    if (index !== -1) {
      selectedSectionIndex.value = index;
      selectedSubsectionIndex.value = null;
      selectedQuestionIndex.value = null;
      // Force Vue to update by touching the ref
      expandedSections.value[sectionIdToSelect] = true;
      
      // Scroll to the newly added section after DOM updates
      setTimeout(() => {
        scrollToSection(index);
      }, 200);
    } else {
      console.error('addSection nextTick: Section not found!', sectionIdToSelect, 'Available:', localForm.value.sections.map(s => s?.sectionId));
    }
    
    const cleanedForm = cleanFormDataForEmit(localForm.value);
    const serialized = JSON.stringify(cleanedForm);
    if (serialized !== lastEmittedForm) {
      lastEmittedForm = serialized;
      emit('update', cleanedForm);
    }
    
    // Keep forcing selection every 50ms for 5 seconds - very aggressive
    let attempts = 0;
    const maxAttempts = 100; // 100 attempts * 50ms = 5 seconds
    activeSectionAddInterval = setInterval(() => {
      // CRITICAL: Check if this interval is still for the current pending section
      // If pendingSectionIdToSelect has changed, this interval is for an old section and should stop IMMEDIATELY
      const currentPendingId = pendingSectionIdToSelect.value;
        if (!currentPendingId || currentPendingId !== sectionIdToSelect) {
        if (activeSectionAddInterval) {
          clearInterval(activeSectionAddInterval);
          activeSectionAddInterval = null;
        }
        return;
      }
      
      if (attempts < maxAttempts) {
        attempts++;
        const idx = localForm.value.sections.findIndex(s => s && s.sectionId === sectionIdToSelect);
        if (idx !== -1) {
          // Always set it, even if it's already correct, to ensure reactivity
          selectedSectionIndex.value = idx;
          selectedSubsectionIndex.value = null;
          selectedQuestionIndex.value = null;
        } else {
          console.warn('addSection interval: Section not found at attempt', attempts);
          // Stop if section not found
          if (activeSectionAddInterval) {
            clearInterval(activeSectionAddInterval);
            activeSectionAddInterval = null;
          }
        }
      } else {
        // Max attempts reached, stop
        if (activeSectionAddInterval) {
          clearInterval(activeSectionAddInterval);
          activeSectionAddInterval = null;
        }
      }
    }, 50); // Check every 50ms
    
    // Clear flags after 5.5 seconds (longer to ensure selection sticks)
    activeSectionAddTimeout = setTimeout(() => {
      if (activeSectionAddInterval) {
        clearInterval(activeSectionAddInterval);
        activeSectionAddInterval = null;
      }
      if (activeSelectionGuard) {
        activeSelectionGuard(); // Stop the guard watcher
        activeSelectionGuard = null;
      }
      const finalIdx = localForm.value.sections.findIndex(s => s && s.sectionId === sectionIdToSelect);
      // Make one final check - if selection is wrong, fix it (only if this is still the pending section)
      if (finalIdx !== -1 && selectedSectionIndex.value !== finalIdx && pendingSectionIdToSelect.value === sectionIdToSelect) {
        console.warn('addSection: Final correction needed! Setting from', selectedSectionIndex.value, 'to', finalIdx);
        selectedSectionIndex.value = finalIdx;
        selectedSubsectionIndex.value = null;
        selectedQuestionIndex.value = null;
      }
      
      // Verify the selection one more time after a short delay
      setTimeout(() => {
        const verifyIdx = localForm.value.sections.findIndex(s => s && s.sectionId === sectionIdToSelect);
        if (verifyIdx !== -1 && selectedSectionIndex.value !== verifyIdx && pendingSectionIdToSelect.value === sectionIdToSelect) {
          console.warn('addSection: Post-clear verification failed! Correcting from', selectedSectionIndex.value, 'to', verifyIdx);
          selectedSectionIndex.value = verifyIdx;
          selectedSubsectionIndex.value = null;
          selectedQuestionIndex.value = null;
        }
        // Final state verified
      }, 100);
      
      isSyncing = false;
      setTimeout(() => {
        isAddingSection = false;
        setTimeout(() => {
          // Only clear pendingSectionIdToSelect if it's still for this section
          if (pendingSectionIdToSelect.value === sectionIdToSelect) {
            pendingSectionIdToSelect.value = null;
          }
          skipAutoSelectSubsection = false;
          // NEVER reset lastSectionAddTime - keep it so ensureSelection stays blocked
          // The time-based check is more reliable than flags
          // if (pendingSectionIdToSelect.value === null) {
          //   lastSectionAddTime = 0; // Reset the timer only if no pending section
          // }
          // Re-enable ensureSelection after a delay to ensure selection is stable
          // BUT only if no other section is being added
          setTimeout(() => {
            // Only re-enable if we're not currently adding another section
            if (!pendingSectionIdToSelect.value && !isAddingSection) {
              ensureSelectionDisabled = false;
            }
          }, 1000); // Wait 1 more second after clearing flags
        }, 500);
      }, 500);
    }, 5500);
  });
};

const removeSection = (index) => {
  // Check edit permissions
  if (!canModifyFormStructure.value) {
    if (isLocked.value) {
      showDuplicateDialog.value = true;
    } else {
      const message = getBlockingMessage(formStatus.value);
      if (message) {
        alert(message);
      }
    }
    return;
  }
  
  // Prevent deletion of the only section in Audit mode
  if (isAuditMode.value) {
    const visibleSectionsList = localForm.value.sections.filter(s => !s._isRootSection);
    if (visibleSectionsList.length <= 1) {
      return; // Don't allow deletion of the last section in Audit mode
    }
  }
  
  localForm.value.sections.splice(index, 1);
  ensureSelection();
};

const addSubsection = (sectionIndex) => {
  console.log('addSubsection called with index:', sectionIndex);
  
  // Validate sectionIndex
  if (sectionIndex === null || sectionIndex === undefined || sectionIndex < 0) {
    console.error('Invalid sectionIndex:', sectionIndex);
    return;
  }
  
  if (!localForm.value.sections || sectionIndex >= localForm.value.sections.length) {
    console.error('Section index out of bounds:', sectionIndex, 'Total sections:', localForm.value.sections?.length);
    return;
  }
  
  const section = localForm.value.sections[sectionIndex];
  if (!section) {
    console.error('Section not found at index:', sectionIndex);
    return;
  }
  
  console.log('Adding subsection to section:', section.name || section.sectionId);
  
  // Ensure section is expanded FIRST (synchronously, triggers immediate reactivity)
  // This is critical - the v-if condition requires expandedSections[section.sectionId] to be true
  if (section.sectionId) {
    expandedSections.value[section.sectionId] = true;
    console.log('Section expansion set to true for:', section.sectionId);
  } else {
    console.error('Section has no sectionId!');
    return;
  }
  
  // Ensure subsections array exists
  if (!section.subsections) {
    section.subsections = [];
  }
  
  const newSubsection = {
    subsectionId: generateId('SUB'),
    name: '',
    weightage: 0,
    questions: [],
    order: section.subsections.length,
    _pendingFocus: true, // Mark with a flag that the ref callback can check
    subsectionScoring: {
      weight: 1,
      threshold: 100
    }
  };
  
  // Mark this subsection as pending focus BEFORE adding it
  // This ensures the ref callback can immediately focus when the element is created
  // Use closure variable to avoid reactivity issues
  pendingSubsectionFocusSet.add(newSubsection.subsectionId);
  
  // Push to array - Vue reactivity will update the DOM
  section.subsections.push(newSubsection);
  
  console.log('New subsection added:', newSubsection.subsectionId, 'Total subsections:', section.subsections.length);
  console.log('Section expanded:', expandedSections.value[section.sectionId]);
  console.log('Subsections count:', section.subsections.length);
  
  selectedSectionIndex.value = sectionIndex;
  selectedSubsectionIndex.value = section.subsections.length - 1;
  selectedQuestionIndex.value = null;
  
  // Use DOM query as a reliable fallback - keep trying until we find the input
  const attemptFocus = (attempt = 0) => {
    if (attempt > 50) {
      console.warn('Could not focus subsection input after max attempts');
      return;
    }
    
    nextTick(() => {
      // Try multiple methods to find the input:
      // 1. Check refs first (fastest if available)
      const refs = subsectionInputRefs.value;
      let inputRef = refs ? refs[newSubsection.subsectionId] : null;
      
      // 2. If ref not found, query DOM by data attribute
      if (!inputRef) {
        inputRef = document.querySelector(`input[data-subsection-id="${newSubsection.subsectionId}"]`);
      }
      
      if (inputRef && typeof inputRef.focus === 'function') {
        // Clear pending flags
        pendingSubsectionFocusSet.delete(newSubsection.subsectionId);
        
        // Find and clear the _pendingFocus flag
        for (const s of localForm.value.sections || []) {
          if (s.subsections) {
            const sub = s.subsections.find(sub => sub.subsectionId === newSubsection.subsectionId);
            if (sub && sub._pendingFocus) {
              delete sub._pendingFocus;
              break;
            }
          }
        }
        
        // Focus the input
        inputRef.focus();
        const length = inputRef.value ? inputRef.value.length : 0;
        if (typeof inputRef.setSelectionRange === 'function') {
          inputRef.setSelectionRange(length, length);
        }
        console.log('Subsection input focused successfully');
      } else {
        // Try again after a short delay
        setTimeout(() => attemptFocus(attempt + 1), 50);
      }
    });
  };
  
  // Start attempting to focus immediately
  attemptFocus();
};

const removeSubsection = (sectionIndex, subsectionIndex) => {
  localForm.value.sections[sectionIndex].subsections.splice(subsectionIndex, 1);
  ensureSelection();
};

const duplicateSubsection = (sectionIndex, subsectionIndex) => {
  if (!canModifyFormStructure.value) return;
  const section = localForm.value.sections?.[sectionIndex];
  const source = section?.subsections?.[subsectionIndex];
  if (!section || !source) return;

  const clone = JSON.parse(JSON.stringify(source));
  clone.subsectionId = generateId('SUB');
  clone.name = source.name ? `${source.name} (Copy)` : '';
  clone.questions = (clone.questions || []).map((q, idx) => ({
    ...q,
    questionId: generateId('Q'),
    order: idx
  }));
  clone.order = subsectionIndex + 1;

  section.subsections.splice(subsectionIndex + 1, 0, clone);
  section.subsections.forEach((sub, idx) => {
    sub.order = idx;
  });

  selectedSectionIndex.value = sectionIndex;
  selectedSubsectionIndex.value = subsectionIndex + 1;
  selectedQuestionIndex.value = null;
};

const toggleSubsectionMenu = (sectionIndex, subsectionIndex) => {
  const menuKey = `${sectionIndex}-${subsectionIndex}`;
  openSubsectionMenuKey.value = openSubsectionMenuKey.value === menuKey ? null : menuKey;
};

const duplicateSubsectionFromMenu = (sectionIndex, subsectionIndex) => {
  openSubsectionMenuKey.value = null;
  duplicateSubsection(sectionIndex, subsectionIndex);
};

const deleteSubsectionFromMenu = (sectionIndex, subsectionIndex) => {
  openSubsectionMenuKey.value = null;
  removeSubsection(sectionIndex, subsectionIndex);
};

const buildDefaultQuestion = (type) => {
  const base = {
    questionId: generateId('Q'),
    questionText: '',
    helpText: '',
    type,
    options: [],
    mandatory: false,
    conditionalLogic: {
      showIf: {
        questionId: '',
        operator: 'equals',
        value: null
      }
    },
    attachmentAllowance: false,
    passFailDefinition: '',
    order: 0,
    evidence: {
      enabled: false,
      rules: []
    }
  };

  // Initialize scoring structure for scorable question types
  if (isScorableQuestionType(type)) {
    base.scoring = {
      enabled: false,
      passCondition: {},
      weight: 1,
      critical: false
    };
    
    // Set default pass condition based on question type
    if (type === 'Yes-No') {
      base.options = ['Yes', 'No'];
      base.scoring.passCondition = { expectedValue: 'Yes' };
    } else if (type === 'Dropdown') {
      base.options = [t('forms.builderDefaultOption1'), t('forms.builderDefaultOption2')];
      base.scoring.passCondition = { passOptions: [] };
    } else if (type === 'Rating') {
      base.scoring.passCondition = { minRating: 4 };
    } else if (type === 'Number') {
      base.scoring.passCondition = {
        rule: '>=',
        value: null
      };
    }
  }
  
  // Keep old scoringLogic for backward compatibility
  base.scoringLogic = {
    passValue: null,
    failValue: null,
    weightage: base.scoring?.weight || 0
  };

  return base;
};

const addQuestion = (sectionIndex, subsectionIndex, explicitType) => {
  // Check edit permissions
  if (!canModifyFormQuestions.value) {
    if (isLocked.value) {
      showDuplicateDialog.value = true;
    } else {
      const message = getBlockingMessage(formStatus.value);
      if (message) {
        alert(message);
      }
    }
    return;
  }
  
  // Ensure sections array exists
  if (!localForm.value.sections) {
    localForm.value.sections = [];
  }
  
  // Ensure section exists
  if (!localForm.value.sections[sectionIndex]) {
    console.error('Section not found at index:', sectionIndex);
    return;
  }
  
  const section = localForm.value.sections[sectionIndex];
  
  const type = explicitType || 'Text';
  const newQuestion = buildDefaultQuestion(type);
  
  // If subsectionIndex is null, add question directly to section
  if (subsectionIndex === null || subsectionIndex === undefined) {
    // Ensure section has questions array
    if (!section.questions) {
      section.questions = [];
    }
    newQuestion.order = section.questions.length;
    section.questions.push(newQuestion);
    
    const newQuestionIndex = section.questions.length - 1;
    
    selectedSectionIndex.value = sectionIndex;
    selectedSubsectionIndex.value = null;
    selectedQuestionIndex.value = newQuestionIndex;
    
    // Use nextTick to ensure selection persists after DOM updates and scroll to question
    nextTick(() => {
      selectedQuestionIndex.value = newQuestionIndex;
      scrollToQuestion(newQuestionIndex);
      focusQuestionSettingsTextInput();
    });
  } else {
    // Add question to subsection (existing behavior)
  // Ensure subsections array exists
  if (!section.subsections) {
    section.subsections = [];
  }
  
  // Ensure subsection exists
  if (!section.subsections[subsectionIndex]) {
    console.error('Subsection not found at index:', subsectionIndex);
    return;
  }
  
  const subsection = section.subsections[subsectionIndex];
  
  // Ensure questions array exists
  if (!subsection.questions) {
    subsection.questions = [];
  }
  
    newQuestion.order = subsection.questions.length;
    subsection.questions.push(newQuestion);

    const newQuestionIndex = subsection.questions.length - 1;

    selectedSectionIndex.value = sectionIndex;
    selectedSubsectionIndex.value = subsectionIndex;
    selectedQuestionIndex.value = newQuestionIndex;
    
    // Use nextTick to ensure selection persists after DOM updates and scroll to question
    nextTick(() => {
      selectedQuestionIndex.value = newQuestionIndex;
      scrollToQuestion(newQuestionIndex);
      focusQuestionSettingsTextInput();
    });
  }
};

const removeQuestion = (sectionIndex, subsectionIndex, questionIndex) => {
  // Check edit permissions
  if (!canModifyFormQuestions.value) {
    if (isLocked.value) {
      showDuplicateDialog.value = true;
    } else {
      const message = getBlockingMessage(formStatus.value);
      if (message) {
        alert(message);
      }
    }
    return;
  }
  
  const section = localForm.value.sections[sectionIndex];
  
  // If subsectionIndex is null, remove from section-level questions
  if (subsectionIndex === null || subsectionIndex === undefined) {
    if (section.questions && section.questions[questionIndex]) {
      section.questions.splice(questionIndex, 1);
      // Clean up expanded state
      delete expandedQuestions.value[`${sectionIndex}-null-${questionIndex}`];
      
      // Reorder
      section.questions.forEach((q, idx) => {
        q.order = idx;
      });
      
      // Update selection
      if (section.questions.length === 0) {
        selectedQuestionIndex.value = null;
      } else if (selectedQuestionIndex.value >= section.questions.length) {
        selectedQuestionIndex.value = section.questions.length - 1;
      }
    }
    return;
  }
  
  // Remove from subsection (existing behavior)
  const subsection = section.subsections[subsectionIndex];
  if (subsection.questions && subsection.questions[questionIndex]) {
    const questionId = subsection.questions[questionIndex].questionId;
    subsection.questions.splice(questionIndex, 1);
    // Clean up expanded state
    delete expandedQuestions.value[`${sectionIndex}-${subsectionIndex}-${questionIndex}`];
    
    // Reorder
    subsection.questions.forEach((q, idx) => {
      q.order = idx;
    });
    
    // Update selection
    if (subsection.questions.length === 0) {
      selectedQuestionIndex.value = null;
    } else if (selectedQuestionIndex.value >= subsection.questions.length) {
      selectedQuestionIndex.value = subsection.questions.length - 1;
    }
  }
  ensureSelection();
};

const duplicateQuestion = (sectionIndex, subsectionIndex, questionIndex) => {
  const subsection = localForm.value.sections[sectionIndex].subsections[subsectionIndex];
  if (!subsection || !subsection.questions || !subsection.questions[questionIndex]) return;

  const original = subsection.questions[questionIndex];
  const clone = JSON.parse(JSON.stringify(original));
  clone.questionId = generateId('Q');
  clone.questionText = original.questionText ? `${original.questionText} (Copy)` : '';
  subsection.questions.splice(questionIndex + 1, 0, clone);

  // Reorder
  subsection.questions.forEach((q, idx) => {
    q.order = idx;
  });

  selectedSectionIndex.value = sectionIndex;
  selectedSubsectionIndex.value = subsectionIndex;
  selectedQuestionIndex.value = questionIndex + 1;
};

// Root question functions for flat mode
const addRootQuestion = (explicitType) => {
  const rootSection = getRootSection();
  const rootSubsection = rootSection.subsections[0];
  
  if (!rootSubsection.questions) {
    rootSubsection.questions = [];
  }
  
  const type = explicitType || 'Text';
  const newQuestion = buildDefaultQuestion(type);
  newQuestion.order = rootSubsection.questions.length;
  
  rootSubsection.questions.push(newQuestion);
  
  selectedQuestionIndex.value = rootSubsection.questions.length - 1;
  selectedSectionIndex.value = null;
  selectedSubsectionIndex.value = null;
  focusQuestionSettingsTextInput();
};

const removeRootQuestion = (questionIndex) => {
  const rootSection = getRootSection();
  const rootSubsection = rootSection.subsections[0];
  
  if (rootSubsection.questions && rootSubsection.questions[questionIndex]) {
    rootSubsection.questions.splice(questionIndex, 1);
    
    // Reorder
    rootSubsection.questions.forEach((q, idx) => {
      q.order = idx;
    });
    
    // Adjust selection
    if (selectedQuestionIndex.value === questionIndex) {
      selectedQuestionIndex.value = null;
    } else if (selectedQuestionIndex.value > questionIndex) {
      selectedQuestionIndex.value--;
    }
  }
};

const duplicateRootQuestion = (questionIndex) => {
  const rootSection = getRootSection();
  const rootSubsection = rootSection.subsections[0];
  
  if (!rootSubsection.questions || !rootSubsection.questions[questionIndex]) return;
  
  const original = rootSubsection.questions[questionIndex];
  const clone = JSON.parse(JSON.stringify(original));
  clone.questionId = generateId('Q');
  clone.questionText = original.questionText ? `${original.questionText} (Copy)` : '';
  rootSubsection.questions.splice(questionIndex + 1, 0, clone);
  
  // Reorder
  rootSubsection.questions.forEach((q, idx) => {
    q.order = idx;
  });
  
  selectedQuestionIndex.value = questionIndex + 1;
};

const selectRootQuestion = (qIndex) => {
  selectedQuestionIndex.value = qIndex;
  selectedSectionIndex.value = null;
  selectedSubsectionIndex.value = null;
};

const addRootQuestionOption = () => {
  if (selectedRootQuestion.value) {
    if (!selectedRootQuestion.value.options) {
      selectedRootQuestion.value.options = [];
    }
    selectedRootQuestion.value.options.push('');
  }
};

const removeRootQuestionOption = (optionIndex) => {
  if (selectedRootQuestion.value && selectedRootQuestion.value.options) {
    selectedRootQuestion.value.options.splice(optionIndex, 1);
  }
};

const toggleQuestionSettings = (sectionIndex, subsectionIndex, questionIndex) => {
  const key = `${sectionIndex}-${subsectionIndex}-${questionIndex}`;
  expandedQuestions.value[key] = !expandedQuestions.value[key];
};

const toggleAdvancedSettings = () => {
  expandedAdvancedSettings.value = !expandedAdvancedSettings.value;
  // Set focus flag to prevent selection loss
  focusedQuestionSettingsInput.value = true;
};

const addOption = (sectionIndex, subsectionIndex, questionIndex) => {
  const section = localForm.value.sections[sectionIndex];
  const question = subsectionIndex === null || subsectionIndex === undefined
    ? (section.questions && section.questions[questionIndex])
    : (section.subsections[subsectionIndex].questions && section.subsections[subsectionIndex].questions[questionIndex]);
  
  if (!question) return;
  if (!question.options) {
    question.options = [];
  }
  question.options.push('');
};

const removeOption = (sectionIndex, subsectionIndex, questionIndex, optionIndex) => {
  const section = localForm.value.sections[sectionIndex];
  const question = subsectionIndex === null || subsectionIndex === undefined
    ? (section.questions && section.questions[questionIndex])
    : (section.subsections[subsectionIndex].questions && section.subsections[subsectionIndex].questions[questionIndex]);
  
  if (question && question.options && question.options[optionIndex]) {
    question.options.splice(optionIndex, 1);
  }
};

// Handle dropdown pass option checkbox change
const handleDropdownPassOptionChange = (event, option) => {
  if (!currentQuestion.value || !currentQuestion.value.scoring) return;
  
  if (!currentQuestion.value.scoring.passCondition) {
    currentQuestion.value.scoring.passCondition = {};
  }
  
  if (!currentQuestion.value.scoring.passCondition.passOptions) {
    currentQuestion.value.scoring.passCondition.passOptions = [];
  }
  
  const passOptions = currentQuestion.value.scoring.passCondition.passOptions;
  
  if (event.target.checked) {
    if (!passOptions.includes(option)) {
      passOptions.push(option);
    }
  } else {
    const index = passOptions.indexOf(option);
    if (index > -1) {
      passOptions.splice(index, 1);
    }
  }
};

// Ensure conditionalLogic structure exists
const ensureConditionalLogic = (question) => {
  if (!question.conditionalLogic) {
    question.conditionalLogic = {
      showIf: {
        questionId: '',
        operator: 'equals',
        value: null
      }
    };
  } else if (!question.conditionalLogic.showIf) {
    question.conditionalLogic.showIf = {
      questionId: '',
      operator: 'equals',
      value: null
    };
  }
};

// Get the question referenced in conditional logic
const getConditionalQuestion = () => {
  if (!currentQuestion.value?.conditionalLogic?.showIf?.questionId) {
    return null;
  }
  
  const questionId = currentQuestion.value.conditionalLogic.showIf.questionId;
  
  // Search through all sections and subsections
  for (const section of localForm.value.sections || []) {
    // Check section-level questions
    if (section.questions && Array.isArray(section.questions)) {
      for (const question of section.questions) {
        if (question.questionId === questionId) {
          return question;
        }
      }
    }
    
    // Check subsection-level questions
    if (section.subsections && Array.isArray(section.subsections)) {
      for (const subsection of section.subsections) {
        if (subsection.questions && Array.isArray(subsection.questions)) {
          for (const question of subsection.questions) {
            if (question.questionId === questionId) {
              return question;
            }
          }
        }
      }
    }
  }
  
  return null;
};

// Get rating options for Rating type questions
const getRatingOptions = () => {
  const conditionalQ = getConditionalQuestion();
  if (!conditionalQ || conditionalQ.type !== 'Rating') {
    return [];
  }
  
  // If the question has explicit options, use those
  if (conditionalQ.options && Array.isArray(conditionalQ.options) && conditionalQ.options.length > 0) {
    return conditionalQ.options;
  }
  
  // Otherwise, generate rating options from 1 to maxRating (default 5)
  const maxRating = conditionalQ.maxRating || 5;
  const options = [];
  for (let i = 1; i <= maxRating; i++) {
    options.push(i.toString());
  }
  return options;
};

// Evidence management functions
const handleEvidenceToggleChange = (event) => {
  if (!currentQuestion.value) return;
  
  // CRITICAL: Set focus flag and temporarily disable syncing BEFORE making any changes
  // This prevents the form watcher from resetting selection
  focusedQuestionSettingsInput.value = true;
  const wasSyncing = isSyncing;
  isSyncing = true;
  
  // Preserve current selection indices before making changes
  const preservedSectionIndex = selectedSectionIndex.value;
  const preservedSubsectionIndex = selectedSubsectionIndex.value;
  const preservedQuestionIndex = selectedQuestionIndex.value;
  const preservedQuestionId = currentQuestion.value?.questionId;
  
  // Update the evidence.enabled property
  currentQuestion.value.evidence.enabled = event.target.checked;
  
  // If enabling evidence and no rules exist, add a default rule
  if (event.target.checked && currentQuestion.value.evidence.rules.length === 0) {
    // Add a default rule when enabling evidence
    addEvidenceRule();
  }
  
  // Restore selection after a brief delay to ensure Vue has processed the change
  nextTick(() => {
    // Restore selection indices
    if (preservedSectionIndex !== null && preservedSectionIndex >= 0) {
      selectedSectionIndex.value = preservedSectionIndex;
    }
    if (preservedSubsectionIndex !== null && preservedSubsectionIndex >= 0) {
      selectedSubsectionIndex.value = preservedSubsectionIndex;
    }
    if (preservedQuestionIndex !== null && preservedQuestionIndex >= 0) {
      selectedQuestionIndex.value = preservedQuestionIndex;
    }
    
    // Restore syncing state
    isSyncing = wasSyncing;
    
    // Keep focus flag set to prevent watcher from resetting selection
    focusedQuestionSettingsInput.value = true;
    
    // Set it again after a delay to be extra safe
    setTimeout(() => {
      focusedQuestionSettingsInput.value = true;
    }, 300);
  });
};

const handleEvidenceToggle = () => {
  // Legacy function - keeping for compatibility but using handleEvidenceToggleChange instead
  handleEvidenceToggleChange({ target: { checked: !currentQuestion.value?.evidence?.enabled } });
};

const addEvidenceRule = () => {
  if (!currentQuestion.value) return;
  
  // Ensure focus flag is set to prevent selection loss
  focusedQuestionSettingsInput.value = true;
  
  // Ensure evidence structure exists
  if (!currentQuestion.value.evidence) {
    currentQuestion.value.evidence = {
      enabled: true,
      rules: []
    };
  }
  
  // Determine default "when" value based on question type
  let defaultWhen = '';
  if (currentQuestion.value.type === 'Yes-No') {
    defaultWhen = 'No'; // Default to "No" as it's more likely to need evidence
  } else if (currentQuestion.value.type === 'Rating') {
    defaultWhen = '1'; // Default to lowest rating
  } else if (currentQuestion.value.type === 'Dropdown' && currentQuestion.value.options && currentQuestion.value.options.length > 0) {
    defaultWhen = currentQuestion.value.options[0];
  }
  
  const newRule = {
    when: defaultWhen,
    comment: { enabled: true, required: 'optional' },
    image: { enabled: true, required: 'optional' },
    video: { enabled: false, required: 'hidden' }
  };
  
  currentQuestion.value.evidence.rules.push(newRule);
};

const removeEvidenceRule = (ruleIndex) => {
  if (!currentQuestion.value || !currentQuestion.value.evidence.rules) return;
  
  // Ensure focus flag is set to prevent selection loss
  focusedQuestionSettingsInput.value = true;
  
  currentQuestion.value.evidence.rules.splice(ruleIndex, 1);
};

// Validation: Check if any rule has required evidence but no evidence type is enabled
const hasRequiredEvidenceWithoutType = computed(() => {
  if (!currentQuestion.value || !currentQuestion.value.evidence.enabled) return false;
  
  const rules = currentQuestion.value.evidence.rules || [];
  for (const rule of rules) {
    const hasRequired = 
      rule.comment?.required === 'required' ||
      rule.image?.required === 'required' ||
      rule.video?.required === 'required';
    
    if (hasRequired) {
      // Check if at least one evidence type is enabled
      const hasEnabledType = 
        (rule.comment?.required !== 'hidden') ||
        (rule.image?.required !== 'hidden') ||
        (rule.video?.required !== 'hidden');
      
      if (!hasEnabledType) {
        return true;
      }
    }
  }
  
  return false;
});

// Handle visibility question selection change
const handleVisibilityQuestionChange = (e) => {
  // Preserve selection indices and question reference before making changes
  const preservedSectionIndex = selectedSectionIndex.value;
  const preservedSubsectionIndex = selectedSubsectionIndex.value;
  const preservedQuestionIndex = selectedQuestionIndex.value;
  const currentQ = currentQuestion.value;
  const currentQuestionId = currentQ?.questionId;
  
  if (!currentQ) return;
  
  // Ensure conditionalLogic structure exists
  ensureConditionalLogic(currentQ);
  
  const selectedValue = e.target.value;
  let finalQuestionId = selectedValue;
  
  // If a question was selected, ensure it has a questionId
  if (selectedValue && selectedValue.startsWith('temp-')) {
    const tempIdx = parseInt(selectedValue.replace('temp-', ''));
    const selectedQ = allQuestions.value[tempIdx];
    if (selectedQ && !selectedQ.questionId) {
      selectedQ.questionId = generateId('Q');
    }
    finalQuestionId = selectedQ?.questionId || selectedValue;
  }
  
  // Update the questionId - ensure we're modifying the reactive object
  // ensureConditionalLogic already ensures the structure exists, so we can directly update
  if (selectedValue) {
    // Set the questionId and operator/value
    currentQ.conditionalLogic.showIf.questionId = finalQuestionId;
    currentQ.conditionalLogic.showIf.operator = 'equals';
    currentQ.conditionalLogic.showIf.value = null;
  } else {
    // Clear everything if "Always visible" is selected
    currentQ.conditionalLogic.showIf.questionId = '';
    currentQ.conditionalLogic.showIf.operator = 'equals';
    currentQ.conditionalLogic.showIf.value = null;
  }
  
  // Restore selection after update - ensure the question still exists
  nextTick(() => {
    // Verify the question still exists at the preserved indices
    const qs = currentQuestions.value;
    if (qs && preservedQuestionIndex !== null && preservedQuestionIndex >= 0 && preservedQuestionIndex < qs.length) {
      const questionAtIndex = qs[preservedQuestionIndex];
      // Only restore if it's the same question (by ID) or if we can't verify
      if (!currentQuestionId || questionAtIndex?.questionId === currentQuestionId) {
        selectedSectionIndex.value = preservedSectionIndex;
        selectedSubsectionIndex.value = preservedSubsectionIndex;
        selectedQuestionIndex.value = preservedQuestionIndex;
      }
    } else {
      // Fallback: restore indices anyway
      selectedSectionIndex.value = preservedSectionIndex;
      selectedSubsectionIndex.value = preservedSubsectionIndex;
      selectedQuestionIndex.value = preservedQuestionIndex;
    }
  });
};

// Section drag-drop handlers
const handleSectionDragStart = (event, index) => {
  draggedSectionIndex.value = index;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', index.toString());
  event.currentTarget.classList.add('opacity-50');
};

const handleSectionDragOver = (event, index) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  if (draggedSectionIndex.value !== null && draggedSectionIndex.value !== index) {
    dragOverSectionIndex.value = index;
  }
};

const handleSectionDragLeave = () => {
  dragOverSectionIndex.value = null;
};

const handleSectionDrop = (event, targetIndex) => {
  event.preventDefault();
  if (draggedSectionIndex.value !== null && draggedSectionIndex.value !== targetIndex) {
    const fromIndex = draggedSectionIndex.value;
    const toIndex = targetIndex;
    
    // Reorder sections
    const sections = localForm.value.sections;
    const [movedSection] = sections.splice(fromIndex, 1);
    sections.splice(toIndex, 0, movedSection);
    
    // Update order property
    sections.forEach((section, idx) => {
      section.order = idx;
    });
  }
  dragOverSectionIndex.value = null;
};

const handleSectionDragEnd = (event) => {
  event.currentTarget.classList.remove('opacity-50');
  draggedSectionIndex.value = null;
  dragOverSectionIndex.value = null;
};

// Subsection drag-drop handlers
const handleSubsectionDragStart = (event, sectionIndex, subsectionIndex) => {
  draggedSubsectionIndex.value = subsectionIndex;
  draggedSubsectionSectionIndex.value = sectionIndex;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', `${sectionIndex}-${subsectionIndex}`);
  event.currentTarget.classList.add('opacity-50');
};

const handleSubsectionDragOver = (event, sectionIndex, subsectionIndex) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  if (draggedSubsectionIndex.value !== null && 
      (draggedSubsectionIndex.value !== subsectionIndex || draggedSubsectionSectionIndex.value !== sectionIndex)) {
    dragOverSubsectionIndex.value = subsectionIndex;
    dragOverSubsectionSectionIndex.value = sectionIndex;
  }
};

const handleSubsectionDragLeave = () => {
  dragOverSubsectionIndex.value = null;
  dragOverSubsectionSectionIndex.value = null;
};

const handleSubsectionDrop = (event, targetSectionIndex, targetSubsectionIndex) => {
  event.preventDefault();
  if (draggedSubsectionIndex.value !== null && 
      (draggedSubsectionIndex.value !== targetSubsectionIndex || draggedSubsectionSectionIndex.value !== targetSectionIndex)) {
    const fromSectionIndex = draggedSubsectionSectionIndex.value;
    const fromSubsectionIndex = draggedSubsectionIndex.value;
    const toSectionIndex = targetSectionIndex;
    const toSubsectionIndex = targetSubsectionIndex;
    
    // Reorder subsections (only within the same section for now)
    if (fromSectionIndex === toSectionIndex) {
      const subsections = localForm.value.sections[fromSectionIndex].subsections;
      const [movedSubsection] = subsections.splice(fromSubsectionIndex, 1);
      subsections.splice(toSubsectionIndex, 0, movedSubsection);
      
      // Update order property
      subsections.forEach((subsection, idx) => {
        subsection.order = idx;
      });
    }
  }
  dragOverSubsectionIndex.value = null;
  dragOverSubsectionSectionIndex.value = null;
};

const handleSubsectionDragEnd = (event) => {
  event.currentTarget.classList.remove('opacity-50');
  draggedSubsectionIndex.value = null;
  draggedSubsectionSectionIndex.value = null;
  dragOverSubsectionIndex.value = null;
  dragOverSubsectionSectionIndex.value = null;
};

// Question drag-drop handlers
const handleQuestionDragStart = (event, sectionIndex, subsectionIndex, questionIndex) => {
  draggedQuestionIndex.value = questionIndex;
  draggedQuestionSubsectionIndex.value = subsectionIndex;
  draggedQuestionSectionIndex.value = sectionIndex;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', `${sectionIndex}-${subsectionIndex}-${questionIndex}`);
  event.currentTarget.classList.add('opacity-50');
};

const handleQuestionDragOver = (event, sectionIndex, subsectionIndex, questionIndex) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  if (draggedQuestionIndex.value !== null && 
      (draggedQuestionIndex.value !== questionIndex || 
       draggedQuestionSubsectionIndex.value !== subsectionIndex || 
       draggedQuestionSectionIndex.value !== sectionIndex)) {
    dragOverQuestionIndex.value = questionIndex;
    dragOverQuestionSubsectionIndex.value = subsectionIndex;
    dragOverQuestionSectionIndex.value = sectionIndex;
  }
};

const handleQuestionDragLeave = () => {
  dragOverQuestionIndex.value = null;
  dragOverQuestionSubsectionIndex.value = null;
  dragOverQuestionSectionIndex.value = null;
};

const handleQuestionDrop = (event, targetSectionIndex, targetSubsectionIndex, targetQuestionIndex) => {
  event.preventDefault();
  if (draggedQuestionIndex.value !== null && 
      (draggedQuestionIndex.value !== targetQuestionIndex || 
       draggedQuestionSubsectionIndex.value !== targetSubsectionIndex || 
       draggedQuestionSectionIndex.value !== targetSectionIndex)) {
    const fromSectionIndex = draggedQuestionSectionIndex.value;
    const fromSubsectionIndex = draggedQuestionSubsectionIndex.value;
    const fromQuestionIndex = draggedQuestionIndex.value;
    const toSectionIndex = targetSectionIndex;
    const toSubsectionIndex = targetSubsectionIndex;
    const toQuestionIndex = targetQuestionIndex;
    
    // Reorder questions within the same context (section-level or subsection-level)
    if (fromSectionIndex === toSectionIndex && fromSubsectionIndex === toSubsectionIndex) {
      // Same context (both section-level or both in same subsection)
      const section = localForm.value.sections[fromSectionIndex];
      let questions;
      
      if (fromSubsectionIndex === null || fromSubsectionIndex === undefined) {
        // Section-level questions
        questions = section.questions || [];
      } else {
        // Subsection-level questions
        questions = section.subsections[fromSubsectionIndex].questions || [];
      }
      
      const [movedQuestion] = questions.splice(fromQuestionIndex, 1);
      questions.splice(toQuestionIndex, 0, movedQuestion);
      
      // Update order property
      questions.forEach((q, idx) => {
        q.order = idx;
      });
    }
  }
  dragOverQuestionIndex.value = null;
  dragOverQuestionSubsectionIndex.value = null;
  dragOverQuestionSectionIndex.value = null;
};

const handleQuestionDragEnd = (event) => {
  event.currentTarget.classList.remove('opacity-50');
  draggedQuestionIndex.value = null;
  draggedQuestionSubsectionIndex.value = null;
  draggedQuestionSectionIndex.value = null;
  dragOverQuestionIndex.value = null;
  dragOverQuestionSubsectionIndex.value = null;
  dragOverQuestionSectionIndex.value = null;
};

// Root question drag-drop handlers for flat mode
const handleRootQuestionDragStart = (event, questionIndex) => {
  draggedRootQuestionIndex.value = questionIndex;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', `root-${questionIndex}`);
  event.currentTarget.classList.add('opacity-50');
};

const handleRootQuestionDragOver = (event, questionIndex) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  if (draggedRootQuestionIndex.value !== null && draggedRootQuestionIndex.value !== questionIndex) {
    dragOverRootQuestionIndex.value = questionIndex;
  }
};

const handleRootQuestionDragLeave = () => {
  dragOverRootQuestionIndex.value = null;
};

const handleRootQuestionDrop = (event, targetQuestionIndex) => {
  event.preventDefault();
  if (draggedRootQuestionIndex.value !== null && draggedRootQuestionIndex.value !== targetQuestionIndex) {
    const rootSection = getRootSection();
    const rootSubsection = rootSection.subsections[0];
    const questions = rootSubsection.questions;
    
    const fromIndex = draggedRootQuestionIndex.value;
    const toIndex = targetQuestionIndex;
    
    const [movedQuestion] = questions.splice(fromIndex, 1);
    questions.splice(toIndex, 0, movedQuestion);
    
    // Update order property
    questions.forEach((question, idx) => {
      question.order = idx;
    });
    
    // Update selection if needed
    if (selectedQuestionIndex.value === fromIndex) {
      selectedQuestionIndex.value = toIndex;
    } else if (selectedQuestionIndex.value === toIndex && fromIndex < toIndex) {
      selectedQuestionIndex.value = toIndex - 1;
    } else if (selectedQuestionIndex.value === toIndex && fromIndex > toIndex) {
      selectedQuestionIndex.value = toIndex + 1;
    }
  }
  dragOverRootQuestionIndex.value = null;
};

const handleRootQuestionDragEnd = (event) => {
  event.currentTarget.classList.remove('opacity-50');
  draggedRootQuestionIndex.value = null;
  dragOverRootQuestionIndex.value = null;
};

// Preview functionality
const showPreview = ref(false);
const showDuplicateDialog = ref(false);
const savedScrollPosition = ref(0);

const openPreview = () => {
  // Save current scroll position
  if (questionsScrollContainer.value) {
    savedScrollPosition.value = questionsScrollContainer.value.scrollTop;
  }
  showPreview.value = true;
};

const closePreview = () => {
  showPreview.value = false;
  // Restore scroll position after drawer closes
  nextTick(() => {
    if (questionsScrollContainer.value) {
      questionsScrollContainer.value.scrollTop = savedScrollPosition.value;
    }
  });
};

const handleFormDuplicated = (duplicatedForm) => {
  // Form duplication handled by navigation in DuplicateFormDialog
  // This is just a placeholder for any additional logic needed
  console.log('Form duplicated:', duplicatedForm);
};
</script>

