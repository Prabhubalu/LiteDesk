<template>
  <div class="min-h-full bg-gray-50 dark:bg-gray-950">
    <!-- Sticky Header -->
    <div v-if="form && !submitted" class="sticky top-0 z-20 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-gray-200/80 dark:border-gray-800 -mx-4 lg:-mx-6 px-4 lg:px-6">
      <div class="max-w-3xl mx-auto py-3 sm:py-4">
        <div class="flex items-start gap-3">
          <button
            v-if="eventId"
            @click="goBackToEvent"
            class="mt-0.5 flex-shrink-0 p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
            :title="t('forms.hubFillBackToEventTitle')"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <h1 class="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white truncate">{{ form.name }}</h1>
              <span v-if="eventId" class="flex-shrink-0 px-2 py-0.5 text-[11px] font-medium bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-md">
                {{ t('forms.hubFillEventLinked') }}
              </span>
            </div>
            <div class="mt-1 flex items-center gap-x-3 gap-y-1 flex-wrap text-xs text-gray-500 dark:text-gray-400">
              <span>{{ form.formId }}</span>
              <span v-if="form.formType" class="text-gray-400 dark:text-gray-500">{{ form.formType }}</span>
              <span v-if="totalQuestions > 0">{{ t('forms.hubFillQuestionsProgress', { answered: answeredQuestions, total: totalQuestions }) }}</span>
              <span v-if="autoSaveStatus" class="inline-flex items-center gap-1.5">
                <span class="w-1.5 h-1.5 rounded-full" :class="autoSaveStatus === 'saving' ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'"></span>
                {{ autoSaveStatus === 'saving' ? t('states.saving') : t('forms.hubFillAutoSaveSaved') }}
              </span>
            </div>
          </div>
          <div class="flex-shrink-0 text-right">
            <span class="text-sm font-medium tabular-nums text-gray-900 dark:text-white">{{ Math.round(completionPercentage) }}%</span>
            <div class="mt-1 w-20 sm:w-28 bg-gray-200 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
              <div
                class="h-full bg-indigo-500 transition-all duration-300 ease-out"
                :style="{ width: `${completionPercentage}%` }"
              ></div>
            </div>
          </div>
        </div>
        <p v-if="form.description" class="mt-2 text-sm text-gray-600 dark:text-gray-400 leading-relaxed pl-9 sm:pl-10">{{ form.description }}</p>
      </div>
    </div>

    <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <!-- Loading State -->
      <div v-if="loading" class="text-center py-20">
        <div class="w-20 h-20 border-4 border-gray-200 dark:border-gray-700 border-t-indigo-600 dark:border-t-indigo-500 rounded-full animate-spin mx-auto mb-6"></div>
        <p class="text-lg font-medium text-gray-700 dark:text-gray-300">{{ t('forms.builderShellLoading') }}</p>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">{{ t('forms.hubFillLoadingSubtext') }}</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="max-w-2xl mx-auto">
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-red-200 dark:border-red-800 p-8 text-center">
          <div class="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 class="text-2xl font-bold text-red-800 dark:text-red-200 mb-2">{{ t('forms.hubFillNotFoundTitle') }}</h2>
          <p class="text-red-600 dark:text-red-400 mb-6">{{ error }}</p>
          <button 
            @click="goBack" 
            class="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors shadow-lg hover:shadow-xl"
          >
            {{ t('forms.builderShellBackToForms') }}
          </button>
        </div>
      </div>

      <!-- Success State -->
      <div v-else-if="submitted" class="max-w-2xl mx-auto">
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-green-200 dark:border-green-800 p-8 sm:p-12 text-center">
          <div class="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6 animate-scale-in">
            <svg class="w-10 h-10 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-3">{{ t('forms.hubFillSubmitSuccessTitle') }}</h2>
          <p class="text-lg text-gray-600 dark:text-gray-400 mb-2">
            {{ t('forms.hubFillSubmitSuccessBody') }}
          </p>
          <p v-if="eventId" class="text-sm text-indigo-600 dark:text-indigo-400 mb-8">
            {{ t('forms.hubFillReturnToEventHint') }}
          </p>
          <div class="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              v-if="eventId"
              @click="goBackToEvent"
              class="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors shadow-lg hover:shadow-xl"
            >
              {{ t('forms.hubFillReturnToEvent') }}
            </button>
            <button
              @click="goBack"
              class="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-medium transition-colors"
            >
              {{ t('forms.builderShellBackToForms') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Form Display -->
      <div v-else-if="form" class="space-y-8">
        <form @submit.prevent="submitForm" class="space-y-8">
          <div
            v-for="(section, sectionIndex) in form.sections"
            :key="section.sectionId || sectionIndex"
            :id="`section-${sectionIndex}`"
            class="space-y-4"
          >
            <!-- Section Header -->
            <div
              v-if="shouldShowEngagementSectionTitle(form, section)"
              class="flex items-end justify-between gap-4 pb-3 border-b border-gray-200 dark:border-gray-800"
            >
              <div>
                <p class="text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-0.5">
                  {{ t('forms.hubFillSectionFallback', { number: sectionIndex + 1 }) }}
                </p>
                <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ sectionTitle(section, sectionIndex) }}</h2>
              </div>
              <span
                v-if="getSectionQuestionCount(section) > 0"
                class="text-xs tabular-nums text-gray-500 dark:text-gray-400 flex-shrink-0"
              >
                {{ t('forms.hubFillSectionQuestions', { answered: getSectionAnsweredCount(section), total: getSectionQuestionCount(section) }) }}
              </span>
            </div>

            <!-- Section Content -->
            <div class="space-y-3">
              <!-- If section has questions directly, render them first -->
              <div v-if="section.questions && section.questions.length > 0" class="space-y-8">
                <div class="space-y-6">
                  <div 
                    v-for="(question, qIndex) in section.questions" 
                    :key="question.questionId || qIndex" 
                    class="question-card p-5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 transition-all duration-200 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-md"
                    :class="{ 'border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-900/20': question.mandatory && !isQuestionAnswered(question) }"
                  >
                    <!-- Question Header -->
                    <div class="mb-4">
                      <div class="flex items-start justify-between gap-3 mb-2">
                        <label class="flex-1 text-base font-semibold text-gray-900 dark:text-white leading-relaxed">
                          <span class="inline-flex items-center gap-2">
                            <span>{{ question.questionText }}</span>
                            <span v-if="question.mandatory" class="text-red-500 font-bold" :title="t('forms.hubFillRequiredTitle')">*</span>
                            <span v-if="question.scoring?.critical" class="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-bold rounded-full" :title="t('forms.hubFillCriticalTitle')">
                              {{ t('forms.hubFillCriticalBadge') }}
                            </span>
                          </span>
                        </label>
                        <div v-if="question.scoring?.enabled" class="flex-shrink-0 flex items-center gap-2 px-2.5 py-1 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                          <svg class="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                          </svg>
                          <span class="text-xs font-semibold text-indigo-700 dark:text-indigo-300">{{ t('forms.hubFillScoringPts', { points: question.scoring.weight || 0 }) }}</span>
                        </div>
                      </div>
                      
                      <!-- Help Text -->
                      <p v-if="question.helpText" class="text-sm text-gray-600 dark:text-gray-400 mt-2 flex items-start gap-2">
                        <svg class="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{{ question.helpText }}</span>
                      </p>
                    </div>
                    
                    <!-- Question Input - reuse the same input rendering logic from subsection questions -->
                    <div class="mt-4">
                      <!-- Text Input -->
                      <input
                        v-if="question.type === 'Text'"
                        v-model="formData[question.questionId]"
                        @input="handleInputChange"
                        type="text"
                        :required="question.mandatory"
                        :placeholder="question.placeholder || t('forms.textAnswerPh')"
                        class="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-colors text-sm"
                      />
                      
                      <!-- Number Input -->
                      <input
                        v-else-if="question.type === 'Number'"
                        v-model.number="formData[question.questionId]"
                        @input="handleInputChange"
                        type="number"
                        :required="question.mandatory"
                        :placeholder="question.placeholder || t('forms.hubFillNumberPh')"
                        class="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-colors text-sm"
                      />
                      
                      <!-- Textarea -->
                      <textarea
                        v-else-if="question.type === 'Textarea'"
                        v-model="formData[question.questionId]"
                        @input="handleInputChange"
                        :required="question.mandatory"
                        :placeholder="question.placeholder || t('forms.textAnswerPh')"
                        rows="4"
                        class="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-colors text-sm resize-y"
                      ></textarea>
                      
                      <!-- Dropdown -->
                      <DropdownQuestion
                        v-else-if="question.type === 'Dropdown'"
                        :question="question"
                        :value="formData[question.questionId]"
                        :form="form"
                        :form-type="form?.formType"
                        @update="(val) => { formData[question.questionId] = val; handleInputChange(); }"
                      />

                      <!-- Rating -->
                      <RatingQuestion
                        v-else-if="question.type === 'Rating'"
                        :question="question"
                        :value="formData[question.questionId]"
                        :form="form"
                        :form-type="form?.formType"
                        @update="(val) => { formData[question.questionId] = val; handleInputChange(); }"
                      />
                      
                      <!-- Radio / Yes-No -->
                      <div
                        v-else-if="question.type === 'Radio' || question.type === 'Yes-No'"
                        :class="(question.options?.length || 0) <= 2 ? 'grid grid-cols-2 gap-2' : 'space-y-2'"
                      >
                        <label
                          v-for="option in question.options"
                          :key="option"
                          class="relative flex cursor-pointer items-center rounded-lg border transition-colors"
                          :class="[
                            (question.options?.length || 0) <= 2 ? 'justify-center px-4 py-2.5' : 'gap-3 px-4 py-2.5',
                            formData[question.questionId] === option
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-500/60'
                              : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                          ]"
                        >
                          <input
                            type="radio"
                            :name="question.questionId"
                            :value="option"
                            v-model="formData[question.questionId]"
                            @change="handleInputChange"
                            :required="question.mandatory"
                            class="sr-only"
                          />
                          <span :class="(question.options?.length || 0) <= 2 ? 'text-sm font-medium' : 'flex-1 text-sm font-medium'">
                            {{ formatFillOptionLabel(option) }}
                          </span>
                          <span
                            v-if="(question.options?.length || 0) > 2 && formData[question.questionId] === option"
                            class="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500 text-white"
                          >
                            <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                            </svg>
                          </span>
                        </label>
                      </div>
                      
                      <!-- Checkbox -->
                      <div v-else-if="question.type === 'Checkbox'" class="space-y-2">
                        <label
                          v-for="option in question.options"
                          :key="option"
                          class="flex items-center gap-3 px-4 py-2.5 rounded-lg border cursor-pointer transition-colors"
                          :class="(formData[question.questionId] || []).includes(option)
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 dark:border-indigo-500/60'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 hover:border-gray-300 dark:hover:border-gray-600'"
                        >
                          <HeadlessCheckbox
                            :checked="(formData[question.questionId] || []).includes(option)"
                            @change="toggleQuestionCheckboxOption(question.questionId, option, $event)"
                            checkbox-class="w-4 h-4 cursor-pointer"
                          />
                          <span class="flex-1 text-sm text-gray-900 dark:text-white">{{ option }}</span>
                        </label>
                      </div>
                      
                      <!-- Date -->
                      <DatePicker
                        v-else-if="question.type === 'Date'"
                        v-model="formData[question.questionId]"
                        input-class="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-colors text-sm cursor-pointer"
                        @blur="handleInputChange"
                      />
                      
                      <!-- File Upload -->
                      <div v-else-if="question.type === 'File'" class="space-y-3">
                        <label class="relative block">
                          <input
                            type="file"
                            @change="handleFileUpload(question.questionId, $event)"
                            :required="question.mandatory && !formData[question.questionId]"
                            class="hidden"
                            :id="`file-${question.questionId}`"
                          />
                          <div 
                            class="w-full px-4 py-8 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 text-center"
                            :class="formData[question.questionId] 
                              ? 'border-green-500 bg-green-50 dark:bg-green-900/20' 
                              : 'border-gray-300 dark:border-gray-600 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'"
                            @click="() => document.getElementById(`file-${question.questionId}`)?.click()"
                          >
                            <svg class="w-12 h-12 mx-auto mb-3 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            <p class="text-sm font-medium text-gray-700 dark:text-gray-300">
                              <span v-if="formData[question.questionId]">{{ formData[question.questionId] }}</span>
                              <span v-else>{{ t('forms.hubFillFileUploadPrompt') }}</span>
                            </p>
                            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ t('forms.hubFillFileFormats') }}</p>
                          </div>
                        </label>
                      </div>
                    </div>

                    <!-- Evidence Section -->
                    <div v-if="question.evidence?.enabled" class="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                      <p class="text-xs font-medium text-gray-600 dark:text-gray-400">
                        {{ t('forms.evidenceRequiredHeading') }}
                      </p>
                      <p class="text-xs text-gray-500 dark:text-gray-500 mt-0.5">{{ t('forms.hubFillEvidenceAttachHint') }}</p>
                    </div>
                  </div>
                </div>
              </div>

              <!-- If section has subsections, render them after direct questions -->
              <div v-if="section.subsections && section.subsections.length > 0" class="space-y-4">
                <div v-for="(subsection, subIndex) in section.subsections" :key="subsection.subsectionId || subIndex" class="space-y-3">
                  <!-- Subsection Header -->
                  <div v-if="shouldShowEngagementSubsectionTitle(form, section, subsection)" class="pt-2">
                    <h3 class="text-sm font-semibold text-gray-800 dark:text-gray-200">{{ subsection.name }}</h3>
                  </div>

                  <!-- Questions -->
                  <div
                    v-for="(question, qIndex) in subsection.questions"
                    :key="question.questionId || qIndex"
                    class="rounded-xl border bg-white dark:bg-gray-900 p-4 sm:p-5 transition-colors"
                    :class="question.mandatory && !isQuestionAnswered(question)
                      ? 'border-red-300/70 dark:border-red-800/70'
                      : 'border-gray-200 dark:border-gray-800'"
                  >
                    <!-- Question Header -->
                    <div class="mb-3">
                      <div class="flex items-start justify-between gap-3">
                        <label class="flex-1 text-sm font-medium text-gray-900 dark:text-white leading-snug">
                          <span class="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
                            <span>{{ question.questionText }}</span>
                            <span v-if="question.mandatory" class="text-red-500" :title="t('forms.hubFillRequiredTitle')">*</span>
                            <span v-if="question.scoring?.critical" class="px-1.5 py-0.5 bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] font-semibold uppercase tracking-wide rounded" :title="t('forms.hubFillCriticalTitle')">
                              {{ t('forms.hubFillCriticalBadge') }}
                            </span>
                          </span>
                        </label>
                        <span v-if="question.scoring?.enabled" class="flex-shrink-0 text-[11px] font-medium tabular-nums text-gray-400 dark:text-gray-500">
                          {{ t('forms.hubFillScoringPts', { points: question.scoring.weight || 0 }) }}
                        </span>
                      </div>
                      <p v-if="question.helpText" class="mt-1.5 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                        {{ question.helpText }}
                      </p>
                    </div>

                    <!-- Question Input -->
                    <div>
                      <!-- Text Input -->
                      <input
                        v-if="question.type === 'Text'"
                        v-model="formData[question.questionId]"
                        @input="handleInputChange"
                        type="text"
                        :required="question.mandatory"
                        :placeholder="question.placeholder || t('forms.textAnswerPh')"
                        class="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-colors text-sm"
                      />
                      
                      <!-- Number Input -->
                      <input
                        v-else-if="question.type === 'Number'"
                        v-model.number="formData[question.questionId]"
                        @input="handleInputChange"
                        type="number"
                        :required="question.mandatory"
                        :placeholder="question.placeholder || t('forms.hubFillNumberPh')"
                        class="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-colors text-sm"
                      />
                      
                      <!-- Textarea -->
                      <textarea
                        v-else-if="question.type === 'Textarea'"
                        v-model="formData[question.questionId]"
                        @input="handleInputChange"
                        :required="question.mandatory"
                        :placeholder="question.placeholder || t('forms.textAnswerPh')"
                        rows="4"
                        class="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-colors text-sm resize-y"
                      ></textarea>
                      
                      <!-- Dropdown -->
                      <DropdownQuestion
                        v-else-if="question.type === 'Dropdown'"
                        :question="question"
                        :value="formData[question.questionId]"
                        :form="form"
                        :form-type="form?.formType"
                        @update="(val) => { formData[question.questionId] = val; handleInputChange(); }"
                      />

                      <!-- Rating -->
                      <RatingQuestion
                        v-else-if="question.type === 'Rating'"
                        :question="question"
                        :value="formData[question.questionId]"
                        :form="form"
                        :form-type="form?.formType"
                        @update="(val) => { formData[question.questionId] = val; handleInputChange(); }"
                      />
                      
                      <!-- Radio / Yes-No -->
                      <div
                        v-else-if="question.type === 'Radio' || question.type === 'Yes-No'"
                        :class="(question.options?.length || 0) <= 2 ? 'grid grid-cols-2 gap-2' : 'space-y-2'"
                      >
                        <label
                          v-for="option in question.options"
                          :key="option"
                          class="relative flex cursor-pointer items-center rounded-lg border transition-colors"
                          :class="[
                            (question.options?.length || 0) <= 2 ? 'justify-center px-4 py-2.5' : 'gap-3 px-4 py-2.5',
                            formData[question.questionId] === option
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-500/60'
                              : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                          ]"
                        >
                          <input
                            type="radio"
                            :name="question.questionId"
                            :value="option"
                            v-model="formData[question.questionId]"
                            @change="handleInputChange"
                            :required="question.mandatory"
                            class="sr-only"
                          />
                          <span :class="(question.options?.length || 0) <= 2 ? 'text-sm font-medium' : 'flex-1 text-sm font-medium'">
                            {{ formatFillOptionLabel(option) }}
                          </span>
                          <span
                            v-if="(question.options?.length || 0) > 2 && formData[question.questionId] === option"
                            class="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500 text-white"
                          >
                            <svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                            </svg>
                          </span>
                        </label>
                      </div>
                      
                      <!-- Checkbox -->
                      <div v-else-if="question.type === 'Checkbox'" class="space-y-2">
                        <label
                          v-for="option in question.options"
                          :key="option"
                          class="flex items-center gap-3 px-4 py-2.5 rounded-lg border cursor-pointer transition-colors"
                          :class="(formData[question.questionId] || []).includes(option)
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 dark:border-indigo-500/60'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 hover:border-gray-300 dark:hover:border-gray-600'"
                        >
                          <HeadlessCheckbox
                            :checked="(formData[question.questionId] || []).includes(option)"
                            @change="toggleQuestionCheckboxOption(question.questionId, option, $event)"
                            checkbox-class="w-4 h-4 cursor-pointer"
                          />
                          <span class="flex-1 text-sm text-gray-900 dark:text-white">{{ option }}</span>
                        </label>
                      </div>
                      
                      <!-- Date -->
                      <DatePicker
                        v-else-if="question.type === 'Date'"
                        v-model="formData[question.questionId]"
                        input-class="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-colors text-sm cursor-pointer"
                        @blur="handleInputChange"
                      />
                      
                      <!-- File Upload -->
                      <div v-else-if="question.type === 'File'" class="space-y-3">
                        <label class="relative block">
                          <input
                            type="file"
                            @change="handleFileUpload(question.questionId, $event)"
                            :required="question.mandatory && !formData[question.questionId]"
                            class="hidden"
                            :id="`file-${question.questionId}`"
                          />
                          <div 
                            class="w-full px-4 py-8 border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200 text-center"
                            :class="formData[question.questionId] 
                              ? 'border-green-500 bg-green-50 dark:bg-green-900/20' 
                              : 'border-gray-300 dark:border-gray-600 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'"
                            @click="() => document.getElementById(`file-${question.questionId}`)?.click()"
                          >
                            <svg class="w-12 h-12 mx-auto mb-3 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            <p class="text-sm font-medium text-gray-700 dark:text-gray-300">
                              <span v-if="formData[question.questionId]">{{ formData[question.questionId] }}</span>
                              <span v-else>{{ t('forms.hubFillFileUploadPrompt') }}</span>
                            </p>
                            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ t('forms.hubFillFileFormats') }}</p>
                          </div>
                        </label>
                      </div>
                    </div>

                    <!-- Evidence Section -->
                    <div v-if="question.evidence?.enabled" class="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                      <p class="text-xs font-medium text-gray-600 dark:text-gray-400">
                        {{ t('forms.evidenceRequiredHeading') }}
                      </p>
                      <p class="text-xs text-gray-500 dark:text-gray-500 mt-0.5">{{ t('forms.hubFillEvidenceAttachHint') }}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Error Message -->
          <div v-if="error" class="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-4">
            <div class="flex items-start gap-3">
              <svg class="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 class="text-sm font-medium text-red-800 dark:text-red-200 mb-0.5">{{ t('forms.hubFillSubmitErrorHeading') }}</h3>
                <p class="text-sm text-red-700 dark:text-red-300">{{ error }}</p>
              </div>
            </div>
          </div>

          <!-- Submit Bar -->
          <div class="sticky bottom-0 z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 border-t border-gray-200/80 dark:border-gray-800 bg-gray-50/95 dark:bg-gray-950/95 backdrop-blur-md rounded-t-xl">
            <div class="flex flex-col sm:flex-row items-center justify-between gap-3">
              <p class="text-xs sm:text-sm">
                <span v-if="hasUnansweredRequired" class="text-red-600 dark:text-red-400">
                  {{ formatHubFillRequiredRemaining(unansweredRequiredCount) }}
                </span>
                <span v-else class="text-emerald-600 dark:text-emerald-400">
                  {{ t('forms.hubFillAllRequiredAnswered') }}
                </span>
              </p>
              <div class="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  @click="goBack"
                  class="flex-1 sm:flex-none px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  {{ t('actions.cancel') }}
                </button>
                <button
                  type="submit"
                  :disabled="submitting || hasUnansweredRequired"
                  class="flex-1 sm:flex-none px-5 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                >
                  <svg v-if="submitting" class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>{{ submitting ? t('forms.hubFillSubmitting') : t('forms.previewSubmitForm') }}</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useTabs } from '@/composables/useTabs';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import portalApiClient from '@/utils/portalApiClient';
import DatePicker from '@/components/common/DatePicker.vue';
import RatingQuestion from '@/components/forms/question-types/RatingQuestion.vue';
import DropdownQuestion from '@/components/forms/question-types/DropdownQuestion.vue';
import {
  shouldShowEngagementSectionTitle,
  shouldShowEngagementSubsectionTitle
} from '@/utils/engagementFormDisplay';

const { t } = useI18n();

function formatHubFillRequiredRemaining(count) {
  return t(count === 1 ? 'forms.hubFillRequiredRemainingOne' : 'forms.hubFillRequiredRemainingOther', { count });
}

const route = useRoute();
const router = useRouter();
const { openTab, closeTab, findTabByPath, findTabById, activeTabId } = useTabs();

const sectionTitle = (section, index) =>
  section.name || t('forms.hubFillSectionFallback', { number: index + 1 });

const formatFillOptionLabel = (option) => {
  if (option === 'Yes') return t('forms.answerYes');
  if (option === 'No') return t('forms.answerNo');
  return option;
};

const form = ref(null);
const formData = ref({});
const loading = ref(true);
const error = ref(null);
const submitting = ref(false);
const submitted = ref(false);
const formResponseId = ref(null);
const autoSaveStatus = ref(null);
const autoSaveTimer = ref(null);

// Get eventId and responseId from query params (make them reactive to route changes)
const eventId = computed(() => route.query.eventId || null);
const responseIdFromQuery = computed(() => route.query.responseId || null);
const returnToFromQuery = computed(() => {
  const value = route.query.returnTo;
  if (typeof value !== 'string') return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  return value;
});
const isAuditFlow = computed(() => String(route.query.appKey || '').toUpperCase() === 'AUDIT');
const isAuditReturnFlow = computed(() => {
  if (isAuditFlow.value) return true;
  return Boolean(returnToFromQuery.value && returnToFromQuery.value.startsWith('/audit/audits'));
});

const isPortalFormFlow = computed(() => String(route.path || '').startsWith('/portal/forms/'));

/** Sales `/api/forms/*` requires Sales app context; audit-linked fills use `/api/audit/forms/*`. */
const getFormsApiBase = () => {
  if (isPortalFormFlow.value) return null;
  return isAuditReturnFlow.value ? '/audit/forms' : '/forms';
};

function buildPortalFormPath(suffix = '') {
  return `/forms/${route.params.id}${suffix}`;
}

async function formsApiGet(path) {
  if (isPortalFormFlow.value) {
    return portalApiClient.get(path.startsWith('/') ? path.slice(1) : path);
  }
  return apiClient.get(path);
}

async function formsApiPost(path, body) {
  if (isPortalFormFlow.value) {
    return portalApiClient.post(path.startsWith('/') ? path.slice(1) : path, body);
  }
  return apiClient.post(path, body);
}

const getPreferredReturnRoute = () => {
  if (isPortalFormFlow.value) return '/portal/forms';
  if (returnToFromQuery.value) return returnToFromQuery.value;
  try {
    const formScopedReturn = sessionStorage.getItem(`audit-form-return:form:${route.params.id}`);
    if (typeof formScopedReturn === 'string' && formScopedReturn.startsWith('/audit/audits')) {
      return formScopedReturn;
    }
  } catch (_) {}
  if (eventId.value && isAuditFlow.value) return `/audit/audits/${eventId.value}`;
  if (eventId.value) {
    try {
      const sessionReturn = sessionStorage.getItem(`audit-form-return:${eventId.value}`);
      if (typeof sessionReturn === 'string' && sessionReturn.startsWith('/audit/audits/')) {
        return sessionReturn;
      }
    } catch (_) {}
    return `/events/${eventId.value}`;
  }
  return '/forms';
};

const shouldAutoSubmitAuditForEvent = (eventIdValue) => {
  if (!eventIdValue) return false;
  if (isAuditReturnFlow.value) return true;
  return getPreferredReturnRoute().startsWith('/audit/audits/');
};

const finalizeAfterSubmit = async (eventIdForAudit) => {
  const returnRoute = getPreferredReturnRoute();
  const isAuditReturn = returnRoute.startsWith('/audit/audits/');

  await new Promise((resolve) => setTimeout(resolve, 1500));

  if (!isAuditReturn) {
    router.push(returnRoute);
    return;
  }

  const formTab = findTabByPath(route.fullPath) || findTabByPath(route.path);
  const formTabId = formTab?.id ?? null;

  openTab(returnRoute);

  window.dispatchEvent(new CustomEvent('audit-form-submitted', {
    detail: { eventId: eventIdForAudit }
  }));

  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 150));

  if (formTabId && formTabId !== activeTabId.value) {
    const tabToClose = findTabById(formTabId);
    if (tabToClose) {
      tabToClose.beforeClose = null;
      await closeTab(formTabId);
    }
  }
};

// Computed properties
const totalQuestions = computed(() => {
  if (!form.value?.sections) return 0;
  let count = 0;
  form.value.sections.forEach(section => {
    // Count questions in subsections
    if (section.subsections && section.subsections.length > 0) {
      section.subsections.forEach(subsection => {
        count += subsection.questions?.length || 0;
      });
    }
    // Count questions directly in section (can coexist with subsections)
    if (section.questions && section.questions.length > 0) {
      count += section.questions.length;
    }
  });
  return count;
});

const answeredQuestions = computed(() => {
  let count = 0;
  if (!form.value?.sections) return 0;
  form.value.sections.forEach(section => {
    // Count answered questions in subsections
    if (section.subsections && section.subsections.length > 0) {
      section.subsections.forEach(subsection => {
        subsection.questions?.forEach(question => {
          if (isQuestionAnswered(question)) {
            count++;
          }
        });
      });
    }
    // Count answered questions directly in section (can coexist with subsections)
    if (section.questions && section.questions.length > 0) {
      section.questions.forEach(question => {
        if (isQuestionAnswered(question)) {
          count++;
        }
      });
    }
  });
  return count;
});

const completionPercentage = computed(() => {
  if (totalQuestions.value === 0) return 100;
  return (answeredQuestions.value / totalQuestions.value) * 100;
});

const unansweredRequiredCount = computed(() => {
  let count = 0;
  if (!form.value?.sections) return 0;
  form.value.sections.forEach(section => {
    // Count unanswered required questions in subsections
    if (section.subsections && section.subsections.length > 0) {
      section.subsections.forEach(subsection => {
        subsection.questions?.forEach(question => {
          if (question.mandatory && !isQuestionAnswered(question)) {
            count++;
          }
        });
      });
    }
    // Count unanswered required questions directly in section (can coexist with subsections)
    if (section.questions && section.questions.length > 0) {
      section.questions.forEach(question => {
        if (question.mandatory && !isQuestionAnswered(question)) {
          count++;
        }
      });
    }
  });
  return count;
});

const hasUnansweredRequired = computed(() => unansweredRequiredCount.value > 0);

// Helper functions
const isQuestionAnswered = (question) => {
  const value = formData.value[question.questionId];
  if (question.type === 'Checkbox') {
    return Array.isArray(value) && value.length > 0;
  }
  return value !== '' && value !== null && value !== undefined;
};

const getSectionQuestionCount = (section) => {
  let count = 0;
  // Count questions in subsections
  if (section.subsections && section.subsections.length > 0) {
    section.subsections.forEach(subsection => {
      count += subsection.questions?.length || 0;
    });
  }
  // Count questions directly in section (can coexist with subsections)
  if (section.questions && section.questions.length > 0) {
    count += section.questions.length;
  }
  return count;
};

const getSectionAnsweredCount = (section) => {
  let count = 0;
  // Count answered questions in subsections
  if (section.subsections && section.subsections.length > 0) {
    section.subsections.forEach(subsection => {
      subsection.questions?.forEach(question => {
        if (isQuestionAnswered(question)) {
          count++;
        }
      });
    });
  }
  // Count answered questions directly in section (can coexist with subsections)
  if (section.questions && section.questions.length > 0) {
    section.questions.forEach(question => {
      if (isQuestionAnswered(question)) {
        count++;
      }
    });
  }
  return count;
};

const getSectionCompletionPercentage = (section) => {
  const total = getSectionQuestionCount(section);
  if (total === 0) return 100;
  return (getSectionAnsweredCount(section) / total) * 100;
};

const toggleQuestionCheckboxOption = (questionId, option, event) => {
  const isChecked = !!event?.target?.checked;
  const selectedOptions = Array.isArray(formData.value[questionId]) ? formData.value[questionId] : [];

  if (isChecked) {
    if (!selectedOptions.includes(option)) {
      formData.value[questionId] = [...selectedOptions, option];
    }
  } else {
    formData.value[questionId] = selectedOptions.filter(item => item !== option);
  }

  handleInputChange();
};

// Auto-save functionality
const handleInputChange = () => {
  autoSaveStatus.value = 'saving';
  if (autoSaveTimer.value) {
    clearTimeout(autoSaveTimer.value);
  }
  autoSaveTimer.value = setTimeout(() => {
    // Auto-save logic can be implemented here
    autoSaveStatus.value = 'saved';
    setTimeout(() => {
      autoSaveStatus.value = null;
    }, 2000);
  }, 1000);
};

// Fetch form
const fetchForm = async () => {
  loading.value = true;
  error.value = null;
  
  try {
    const response = isPortalFormFlow.value
      ? await formsApiGet(buildPortalFormPath())
      : await apiClient.get(`${getFormsApiBase()}/${route.params.id}`);
    if (response.success) {
      form.value = response.data;
      
      // Initialize form data
      if (form.value.sections) {
        form.value.sections.forEach(section => {
          // Initialize questions in subsections
          if (section.subsections && section.subsections.length > 0) {
            section.subsections.forEach(subsection => {
              if (subsection.questions) {
                subsection.questions.forEach(question => {
                  if (question.type === 'Checkbox') {
                    formData.value[question.questionId] = [];
                  } else {
                    formData.value[question.questionId] = '';
                  }
                });
              }
            });
          }
          // Initialize questions directly in section (can coexist with subsections)
          if (section.questions && section.questions.length > 0) {
            section.questions.forEach(question => {
              if (question.type === 'Checkbox') {
                formData.value[question.questionId] = [];
              } else {
                formData.value[question.questionId] = '';
              }
            });
          }
        });
      }
      
      // Check if form has already been submitted (persist success state across refreshes)
      await checkIfAlreadySubmitted();
    } else {
      error.value = t('forms.hubFillNotFoundDenied');
    }
  } catch (err) {
    console.error('Error fetching form:', err);
    error.value = err.message || t('forms.hubFillLoadFailed');
  } finally {
    loading.value = false;
  }
};

// Check if the form response has already been submitted
const applyResponseDetailsToFormData = (details) => {
  if (!Array.isArray(details)) return;
  details.forEach((detail) => {
    if (!detail?.questionId) return;
    const answer = detail.answer;
    if (answer === undefined || answer === null) return;
    formData.value[detail.questionId] = answer;
  });
};

const loadPortalFormResponseState = async (responseId) => {
  if (responseId) {
    const response = await formsApiGet(buildPortalFormPath(`/responses/${responseId}`));
    if (response.success && response.data) {
      return response.data;
    }
    return null;
  }

  const inProgress = await formsApiGet(buildPortalFormPath('/responses/in-progress'));
  if (inProgress.success && inProgress.data) {
    return inProgress.data;
  }
  return null;
};

const checkIfAlreadySubmitted = async () => {
  try {
    // Get responseId from various sources
    let responseId = null;
    
    // Try URL query params first
    try {
      const urlParams = new URLSearchParams(window.location.search);
      responseId = urlParams.get('responseId') || null;
    } catch (e) {
      // Ignore
    }
    
    // Try route.query
    if (!responseId) {
      responseId = route.query?.responseId || responseIdFromQuery.value || formResponseId.value || null;
    }
    
    // Try sessionStorage as fallback
    if (!responseId && eventId.value) {
      try {
        const storedResponseId = sessionStorage.getItem(`formResponse_${route.params.id}_${eventId.value}`);
        if (storedResponseId) {
          responseId = storedResponseId;
        }
      } catch (e) {
        // Ignore
      }
    }
    
    if (isPortalFormFlow.value) {
      const formResponse = await loadPortalFormResponseState(responseId);
      if (!formResponse?._id) return;

      formResponseId.value = formResponse._id;
      if (formResponse.executionStatus === 'Submitted') {
        submitted.value = true;
        formData.value = {};
        return;
      }

      applyResponseDetailsToFormData(formResponse.responseDetails);
      return;
    }

    // If we have a responseId, check if it's already submitted
    if (responseId) {
      console.log('[FormFill] Checking if response is already submitted:', responseId);
      try {
        const response = await apiClient.get(`${getFormsApiBase()}/${route.params.id}/responses/${responseId}`);
        if (response.success && response.data) {
          const formResponse = response.data;
          // Check if response is submitted
          if (formResponse.executionStatus === 'Submitted') {
            console.log('[FormFill] Response already submitted, showing success state');
            submitted.value = true;
            formResponseId.value = responseId;
            // Don't initialize form data if already submitted
            formData.value = {};
          } else {
            console.log('[FormFill] Response exists but not submitted yet, status:', formResponse.executionStatus);
            formResponseId.value = responseId;
            applyResponseDetailsToFormData(formResponse.responseDetails);
          }
        }
      } catch (err) {
        console.warn('[FormFill] Could not fetch response status:', err);
        // If we can't fetch the response, continue with the form
      }
    }
  } catch (err) {
    console.error('[FormFill] Error checking if already submitted:', err);
    // Continue with form if check fails
  }
};

// Handle file upload
const handleFileUpload = (questionId, event) => {
  const file = event.target.files[0];
  if (file) {
    formData.value[questionId] = file.name;
    handleInputChange();
  }
};

// Submit form
const submitForm = async () => {
  if (hasUnansweredRequired.value) {
    error.value = t('forms.hubFillRequiredAnswerAlert', { count: unansweredRequiredCount.value });
    return;
  }

  submitting.value = true;
  error.value = null;
  
  try {
    // Prepare submission data
    const responseDetails = Object.keys(formData.value)
      .filter(questionId => {
        const value = formData.value[questionId];
        return value !== '' && value !== null && (Array.isArray(value) ? value.length > 0 : true);
      })
      .map(questionId => {
        let sectionId = '';
        let subsectionId = '';
        
        if (form.value.sections) {
          for (const section of form.value.sections) {
            // Check questions in subsections first
            if (section.subsections && section.subsections.length > 0) {
              for (const subsection of section.subsections) {
                if (subsection.questions) {
                  const question = subsection.questions.find(q => q.questionId === questionId);
                  if (question) {
                    sectionId = section.sectionId;
                    subsectionId = subsection.subsectionId;
                    break;
                  }
                }
              }
            }
            // Check questions directly in section (can coexist with subsections)
            if (!sectionId && section.questions && section.questions.length > 0) {
              const question = section.questions.find(q => q.questionId === questionId);
              if (question) {
                sectionId = section.sectionId;
                subsectionId = undefined; // No subsection for direct questions
                break;
              }
            }
            if (sectionId) break;
          }
        }
        
        return {
          questionId,
          sectionId: sectionId || undefined,
          subsectionId: subsectionId || undefined,
          answer: formData.value[questionId]
        };
      });

    // Get current values - ALWAYS parse from URL first as primary method
    // route.query might not be populated in some Vue Router configurations
    let currentEventId = null;
    let currentResponseId = null;
    
    try {
      // Primary method: Parse directly from URL
      const urlParams = new URLSearchParams(window.location.search);
      currentEventId = urlParams.get('eventId') || null;
      currentResponseId = urlParams.get('responseId') || null;
      
      console.log('[FormFill] 🔍 Parsed from URL:', {
        urlSearch: window.location.search,
        urlEventId: currentEventId,
        urlResponseId: currentResponseId,
        allParams: Object.fromEntries(urlParams.entries())
      });
    } catch (e) {
      console.warn('[FormFill] Failed to parse URL params:', e);
    }
    
    // Fallback 1: Try route.query
    if (!currentEventId) {
      currentEventId = route.query?.eventId || eventId.value || null;
    }
    if (!currentResponseId) {
      currentResponseId = route.query?.responseId || responseIdFromQuery.value || formResponseId.value || null;
    }
    
    // Fallback 2: Try sessionStorage (stored during check-in navigation)
    if (currentEventId && !currentResponseId) {
      try {
        const storedResponseId = sessionStorage.getItem(`formResponse_${route.params.id}_${currentEventId}`);
        if (storedResponseId) {
          currentResponseId = storedResponseId;
          console.log('[FormFill] ✅ Found responseId in sessionStorage:', currentResponseId);
        }
      } catch (e) {
        console.warn('[FormFill] Failed to read from sessionStorage:', e);
      }
    }
    
    // Normalize: ensure they're strings, not empty strings
    if (currentEventId === '' || currentEventId === undefined) currentEventId = null;
    if (currentResponseId === '' || currentResponseId === undefined) currentResponseId = null;
    
    console.log('[FormFill] 🔍 Reading query params:', {
      windowLocationHref: window.location.href,
      windowLocationSearch: window.location.search,
      routeQueryEventId: route.query?.eventId,
      routeQueryResponseId: route.query?.responseId,
      routeQueryKeys: Object.keys(route.query || {}),
      routeFullPath: route.fullPath,
      routePath: route.path,
      computedEventId: eventId.value,
      computedResponseId: responseIdFromQuery.value,
      formResponseId: formResponseId.value,
      finalEventId: currentEventId,
      finalResponseId: currentResponseId
    });
    
    // Warn if we don't have the required params
    if (!currentEventId && !currentResponseId) {
      console.warn('[FormFill] ⚠️ No eventId or responseId found! URL should contain ?eventId=...&responseId=...');
    }
    
    // Build submission data with proper event linking
    const submissionData = {
      responseDetails,
      linkedTo: currentEventId ? {
        type: 'Event',
        id: currentEventId
      } : null,
      eventId: currentEventId,
      responseId: currentResponseId // Pass responseId if available
    };

    console.log('[FormFill] 📤 Submitting form with:', {
      formId: route.params.id,
      eventId: currentEventId,
      responseId: currentResponseId,
      linkedTo: submissionData.linkedTo,
      hasResponseDetails: submissionData.responseDetails.length > 0,
      submissionDataKeys: Object.keys(submissionData)
    });

    const response = isPortalFormFlow.value
      ? await formsApiPost(buildPortalFormPath('/submit'), submissionData)
      : await apiClient.post(`${getFormsApiBase()}/${route.params.id}/submit`, submissionData);

    if (response.success && response.data) {
      submitted.value = true;
      formResponseId.value = response.data._id || response.data.responseId;
      
      const linkedEventId = currentEventId || eventId.value;
      if (linkedEventId) {
        notifyEventExecution(linkedEventId, formResponseId.value);
      }

      if (linkedEventId && shouldAutoSubmitAuditForEvent(linkedEventId)) {
        try {
          sessionStorage.setItem(`audit-auto-submit:${linkedEventId}`, String(Date.now()));
          sessionStorage.setItem(`audit-form-response:${linkedEventId}`, String(formResponseId.value));
        } catch (_) {}

        try {
          await apiClient.post(
            `/audit/execute/${linkedEventId}/submit`,
            formResponseId.value ? { formResponseId: String(formResponseId.value) } : {}
          );
          console.log('[FormFill] ✅ Auto-submitted audit after form submission', {
            eventId: linkedEventId,
            formResponseId: formResponseId.value
          });
        } catch (autoSubmitErr) {
          try {
            sessionStorage.removeItem(`audit-auto-submit:${linkedEventId}`);
          } catch (_) {}
          console.warn('[FormFill] ⚠️ Auto-submit audit failed (non-blocking):', autoSubmitErr);
        }
      }

      void finalizeAfterSubmit(linkedEventId);
    } else {
      error.value = response.message || t('forms.hubFillSubmitFailed');
    }
  } catch (err) {
    console.error('Error submitting form:', err);
    error.value = err.message || t('forms.hubFillSubmitFailedRetry');
  } finally {
    submitting.value = false;
  }
};

// Notify EventExecution component
const notifyEventExecution = (eventId, responseId) => {
  try {
    const notification = {
      eventId: eventId,
      responseId: responseId,
      formId: form.value._id,
      timestamp: new Date().toISOString()
    };
    
    localStorage.setItem(`formResponse_${form.value._id}`, JSON.stringify(notification));
    
    window.dispatchEvent(new StorageEvent('storage', {
      key: `formResponse_${form.value._id}`,
      newValue: JSON.stringify(notification)
    }));
    
    console.log('Form response notification sent:', notification);
  } catch (err) {
    console.error('Error notifying EventExecution:', err);
  }
};

// Navigation
const goBack = () => {
  router.push(getPreferredReturnRoute());
};

const goBackToEvent = () => {
  router.push(getPreferredReturnRoute());
};

onMounted(() => {
  console.log('[FormFill] 🚀 Component mounted with route:', {
    path: route.path,
    fullPath: route.fullPath,
    query: route.query,
    queryKeys: Object.keys(route.query || {}),
    eventId: route.query?.eventId,
    responseId: route.query?.responseId,
    params: route.params,
    windowLocationHref: window.location.href,
    windowLocationSearch: window.location.search,
    windowLocationHash: window.location.hash
  });
  
  // Also check if query params are in the hash (Vue Router hash mode)
  if (window.location.hash) {
    try {
      const hashParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
      console.log('[FormFill] 🔍 Found params in hash:', {
        hash: window.location.hash,
        hashParams: Object.fromEntries(hashParams.entries())
      });
    } catch (e) {
      console.warn('[FormFill] Failed to parse hash params:', e);
    }
  }
  
  fetchForm();
});

// Watch route changes to catch query param updates
watch(() => route.query, (newQuery) => {
  console.log('[FormFill] 🔄 Route query changed:', {
    newQuery: newQuery,
    eventId: newQuery?.eventId,
    responseId: newQuery?.responseId
  });
}, { deep: true, immediate: true });

// Cleanup
watch(() => route.params.id, () => {
  fetchForm();
});
</script>

<style scoped>
@keyframes scale-in {
  from {
    transform: scale(0);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.animate-scale-in {
  animation: scale-in 0.3s ease-out;
}
</style>
