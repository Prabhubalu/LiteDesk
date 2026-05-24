<template>
  <div class="bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
    <!-- Sticky Header with Progress -->
    <div v-if="form && !submitted" class="sticky top-0 z-20 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 shadow-lg -mx-4 lg:-mx-6 px-4 lg:px-6">
      <div class="max-w-5xl mx-auto py-4">
        <div class="flex items-center justify-between gap-4">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-3 mb-2">
              <button
                v-if="eventId"
                @click="goBackToEvent"
                class="flex-shrink-0 p-2 text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                :title="t('forms.hubFillBackToEventTitle')"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <h1 class="text-xl font-bold text-gray-900 dark:text-white truncate">{{ form.name }}</h1>
              <span v-if="eventId" class="flex-shrink-0 px-2.5 py-1 text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 rounded-full">
                {{ t('forms.hubFillEventLinked') }}
              </span>
            </div>
            <div class="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
              <span class="font-medium">{{ form.formId }}</span>
              <span v-if="form.formType" class="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">{{ form.formType }}</span>
              <span v-if="totalQuestions > 0" class="text-gray-400 dark:text-gray-500">
                {{ t('forms.hubFillQuestionsProgress', { answered: answeredQuestions, total: totalQuestions }) }}
              </span>
            </div>
          </div>
          <div class="flex-shrink-0">
            <div class="w-32 sm:w-48 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
              <div 
                class="h-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-500 ease-out"
                :style="{ width: `${completionPercentage}%` }"
              ></div>
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">{{ t('forms.hubFillPercentComplete', { percent: Math.round(completionPercentage) }) }}</p>
          </div>
        </div>
      </div>
    </div>

    <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
      <div v-else-if="form" class="space-y-6">
        <!-- Form Header Card -->
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 sm:p-8">
          <div class="mb-4">
            <h1 class="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-3">{{ form.name }}</h1>
            <p v-if="form.description" class="text-lg text-gray-600 dark:text-gray-400 leading-relaxed">{{ form.description }}</p>
          </div>
          <div class="flex flex-wrap items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span class="font-medium">{{ form.formId }}</span>
            </div>
            <div v-if="form.formType" class="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 rounded-full text-sm font-medium">
              {{ form.formType }}
            </div>
            <div v-if="autoSaveStatus" class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <div class="w-2 h-2 rounded-full" :class="autoSaveStatus === 'saving' ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'"></div>
              <span>{{ autoSaveStatus === 'saving' ? t('states.saving') : t('forms.hubFillAutoSaveSaved') }}</span>
            </div>
          </div>
        </div>

        <!-- Form Sections -->
        <form @submit.prevent="submitForm" class="space-y-6">
          <div 
            v-for="(section, sectionIndex) in form.sections" 
            :key="section.sectionId || sectionIndex" 
            :id="`section-${sectionIndex}`"
            class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-300 hover:shadow-xl"
          >
            <!-- Section Header -->
            <div class="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 px-6 py-5 border-b border-gray-200 dark:border-gray-700">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 bg-indigo-600 dark:bg-indigo-500 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-md">
                    {{ sectionIndex + 1 }}
                  </div>
                  <div>
                    <h2 class="text-xl font-bold text-gray-900 dark:text-white">{{ sectionTitle(section, sectionIndex) }}</h2>
                    <p v-if="getSectionQuestionCount(section) > 0" class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {{ t('forms.hubFillSectionQuestions', { answered: getSectionAnsweredCount(section), total: getSectionQuestionCount(section) }) }}
                    </p>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <div 
                    v-if="getSectionQuestionCount(section) > 0"
                    class="w-16 h-16 rounded-full border-4 border-gray-200 dark:border-gray-700 flex items-center justify-center relative"
                    :class="getSectionCompletionPercentage(section) === 100 ? 'border-green-500' : ''"
                  >
                    <svg class="w-8 h-8 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div 
                      v-if="getSectionCompletionPercentage(section) < 100"
                      class="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-600 dark:border-t-indigo-400 transition-all duration-500"
                      :style="{ transform: `rotate(${(getSectionCompletionPercentage(section) / 100) * 360 - 90}deg)` }"
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Section Content -->
            <div class="p-6 sm:p-8 space-y-8">
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
                        class="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 text-base"
                      />
                      
                      <!-- Number Input -->
                      <input
                        v-else-if="question.type === 'Number'"
                        v-model.number="formData[question.questionId]"
                        @input="handleInputChange"
                        type="number"
                        :required="question.mandatory"
                        :placeholder="question.placeholder || t('forms.hubFillNumberPh')"
                        class="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 text-base"
                      />
                      
                      <!-- Textarea -->
                      <textarea
                        v-else-if="question.type === 'Textarea'"
                        v-model="formData[question.questionId]"
                        @input="handleInputChange"
                        :required="question.mandatory"
                        :placeholder="question.placeholder || t('forms.textAnswerPh')"
                        rows="5"
                        class="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 text-base resize-y"
                      ></textarea>
                      
                      <!-- Dropdown -->
                      <select
                        v-else-if="question.type === 'Dropdown'"
                        v-model="formData[question.questionId]"
                        @change="handleInputChange"
                        :required="question.mandatory"
                        class="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 text-base appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22currentColor%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Cpolyline points=%226 9 12 15 18 9%22%3E%3C/polyline%3E%3C/svg%3E')] bg-no-repeat bg-right-4 pr-10"
                      >
                        <option value="">{{ t('forms.hubFillDropdownPh') }}</option>
                        <option v-for="option in question.options" :key="option" :value="option">{{ option }}</option>
                      </select>
                      
                      <!-- Radio / Yes-No -->
                      <div v-else-if="question.type === 'Radio' || question.type === 'Yes-No'" class="space-y-3">
                        <label 
                          v-for="option in question.options" 
                          :key="option" 
                          class="flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200"
                          :class="formData[question.questionId] === option 
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' 
                            : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 bg-white dark:bg-gray-800'"
                        >
                          <input
                            type="radio"
                            :name="question.questionId"
                            :value="option"
                            v-model="formData[question.questionId]"
                            @change="handleInputChange"
                            :required="question.mandatory"
                            class="w-5 h-5 text-indigo-600 border-gray-300 focus:ring-indigo-500 cursor-pointer"
                          />
                          <span class="flex-1 text-gray-900 dark:text-white font-medium">{{ formatFillOptionLabel(option) }}</span>
                          <div v-if="formData[question.questionId] === option" class="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center">
                            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        </label>
                      </div>
                      
                      <!-- Checkbox -->
                      <div v-else-if="question.type === 'Checkbox'" class="space-y-3">
                        <label 
                          v-for="option in question.options" 
                          :key="option" 
                          class="flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200"
                          :class="(formData[question.questionId] || []).includes(option)
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' 
                            : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 bg-white dark:bg-gray-800'"
                        >
                          <HeadlessCheckbox
                            :checked="(formData[question.questionId] || []).includes(option)"
                            @change="toggleQuestionCheckboxOption(question.questionId, option, $event)"
                            checkbox-class="w-5 h-5 cursor-pointer"
                          />
                          <span class="flex-1 text-gray-900 dark:text-white font-medium">{{ option }}</span>
                          <div v-if="(formData[question.questionId] || []).includes(option)" class="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center">
                            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        </label>
                      </div>
                      
                      <!-- Date -->
                      <input
                        v-else-if="question.type === 'Date'"
                        v-model="formData[question.questionId]"
                        @click="openDatePicker"
                        @change="handleInputChange"
                        type="date"
                        :required="question.mandatory"
                        class="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 text-base cursor-pointer"
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
                    <div v-if="question.evidence?.enabled" class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <p class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                        <svg class="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        {{ t('forms.evidenceRequiredHeading') }}
                      </p>
                      <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('forms.hubFillEvidenceAttachHint') }}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- If section has subsections, render them after direct questions -->
              <div v-if="section.subsections && section.subsections.length > 0" class="space-y-8">
                <div v-for="(subsection, subIndex) in section.subsections" :key="subsection.subsectionId || subIndex" class="space-y-6">
                  <!-- Subsection Header -->
                  <div v-if="subsection.name" class="border-l-4 border-indigo-500 dark:border-indigo-400 pl-4">
                    <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-1">{{ subsection.name }}</h3>
                  </div>
                  
                  <!-- Questions -->
                  <div class="space-y-6">
                  <div 
                    v-for="(question, qIndex) in subsection.questions" 
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
                    
                    <!-- Question Input -->
                    <div class="mt-4">
                      <!-- Text Input -->
                      <input
                        v-if="question.type === 'Text'"
                        v-model="formData[question.questionId]"
                        @input="handleInputChange"
                        type="text"
                        :required="question.mandatory"
                        :placeholder="question.placeholder || t('forms.textAnswerPh')"
                        class="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 text-base"
                      />
                      
                      <!-- Number Input -->
                      <input
                        v-else-if="question.type === 'Number'"
                        v-model.number="formData[question.questionId]"
                        @input="handleInputChange"
                        type="number"
                        :required="question.mandatory"
                        :placeholder="question.placeholder || t('forms.hubFillNumberPh')"
                        class="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 text-base"
                      />
                      
                      <!-- Textarea -->
                      <textarea
                        v-else-if="question.type === 'Textarea'"
                        v-model="formData[question.questionId]"
                        @input="handleInputChange"
                        :required="question.mandatory"
                        :placeholder="question.placeholder || t('forms.textAnswerPh')"
                        rows="5"
                        class="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 text-base resize-y"
                      ></textarea>
                      
                      <!-- Dropdown -->
                      <select
                        v-else-if="question.type === 'Dropdown'"
                        v-model="formData[question.questionId]"
                        @change="handleInputChange"
                        :required="question.mandatory"
                        class="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 text-base appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22currentColor%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Cpolyline points=%226 9 12 15 18 9%22%3E%3C/polyline%3E%3C/svg%3E')] bg-no-repeat bg-right-4 pr-10"
                      >
                        <option value="">{{ t('forms.hubFillDropdownPh') }}</option>
                        <option v-for="option in question.options" :key="option" :value="option">{{ option }}</option>
                      </select>
                      
                      <!-- Radio / Yes-No -->
                      <div v-else-if="question.type === 'Radio' || question.type === 'Yes-No'" class="space-y-3">
                        <label 
                          v-for="option in question.options" 
                          :key="option" 
                          class="flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200"
                          :class="formData[question.questionId] === option 
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' 
                            : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 bg-white dark:bg-gray-800'"
                        >
                          <input
                            type="radio"
                            :name="question.questionId"
                            :value="option"
                            v-model="formData[question.questionId]"
                            @change="handleInputChange"
                            :required="question.mandatory"
                            class="w-5 h-5 text-indigo-600 border-gray-300 focus:ring-indigo-500 cursor-pointer"
                          />
                          <span class="flex-1 text-gray-900 dark:text-white font-medium">{{ formatFillOptionLabel(option) }}</span>
                          <div v-if="formData[question.questionId] === option" class="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center">
                            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        </label>
                      </div>
                      
                      <!-- Checkbox -->
                      <div v-else-if="question.type === 'Checkbox'" class="space-y-3">
                        <label 
                          v-for="option in question.options" 
                          :key="option" 
                          class="flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200"
                          :class="(formData[question.questionId] || []).includes(option)
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' 
                            : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 bg-white dark:bg-gray-800'"
                        >
                          <HeadlessCheckbox
                            :checked="(formData[question.questionId] || []).includes(option)"
                            @change="toggleQuestionCheckboxOption(question.questionId, option, $event)"
                            checkbox-class="w-5 h-5 cursor-pointer"
                          />
                          <span class="flex-1 text-gray-900 dark:text-white font-medium">{{ option }}</span>
                          <div v-if="(formData[question.questionId] || []).includes(option)" class="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center">
                            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        </label>
                      </div>
                      
                      <!-- Date -->
                      <input
                        v-else-if="question.type === 'Date'"
                        v-model="formData[question.questionId]"
                        @click="openDatePicker"
                        @change="handleInputChange"
                        type="date"
                        :required="question.mandatory"
                        class="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 text-base cursor-pointer"
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
                    <div v-if="question.evidence?.enabled" class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <p class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                        <svg class="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        {{ t('forms.evidenceRequiredHeading') }}
                      </p>
                      <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('forms.hubFillEvidenceAttachHint') }}</p>
                    </div>
                  </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Error Message -->
          <div v-if="error" class="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl p-6">
            <div class="flex items-start gap-3">
              <svg class="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 class="font-semibold text-red-800 dark:text-red-200 mb-1">{{ t('forms.hubFillSubmitErrorHeading') }}</h3>
                <p class="text-red-700 dark:text-red-300">{{ error }}</p>
              </div>
            </div>
          </div>

          <!-- Submit Button -->
          <div class="sticky bottom-0 bg-white dark:bg-gray-800 border-t-2 border-gray-200 dark:border-gray-700 shadow-2xl -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-4 rounded-t-2xl">
            <div class="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
              <div class="text-sm text-gray-600 dark:text-gray-400">
                <span v-if="hasUnansweredRequired" class="text-red-600 dark:text-red-400 font-medium">
                  {{ t('forms.hubFillRequiredRemaining', { count: unansweredRequiredCount }) }}
                </span>
                <span v-else class="text-green-600 dark:text-green-400 font-medium">
                  {{ t('forms.hubFillAllRequiredAnswered') }}
                </span>
              </div>
              <div class="flex items-center gap-3">
                <button
                  type="button"
                  @click="goBack"
                  class="px-6 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl font-medium transition-colors"
                >
                  {{ t('actions.cancel') }}
                </button>
                <button
                  type="submit"
                  :disabled="submitting || hasUnansweredRequired"
                  class="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none"
                >
                  <svg v-if="submitting" class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
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
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { openDatePicker } from '@/utils/dateUtils';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

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

/** Sales `/api/forms/*` requires Sales app context; audit-linked fills use `/api/audit/forms/*`. */
const getFormsApiBase = () => (isAuditReturnFlow.value ? '/audit/forms' : '/forms');

const getPreferredReturnRoute = () => {
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
    const response = await apiClient.get(`${getFormsApiBase()}/${route.params.id}`);
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
            // If response exists but not submitted, we can optionally load the existing data
            // For now, just continue with the form
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

    const response = await apiClient.post(`${getFormsApiBase()}/${route.params.id}/submit`, submissionData);

    if (response.success && response.data) {
      submitted.value = true;
      formResponseId.value = response.data._id || response.data.responseId;
      
      if (eventId.value) {
        notifyEventExecution(eventId.value, formResponseId.value);
      }

      if (currentEventId && isAuditReturnFlow.value) {
        try {
          await apiClient.post(
            `/audit/execute/${currentEventId}/submit`,
            formResponseId.value ? { formResponseId: String(formResponseId.value) } : {}
          );
          try {
            sessionStorage.setItem(`audit-auto-submit:${currentEventId}`, String(Date.now()));
          } catch (_) {}
          console.log('[FormFill] ✅ Auto-submitted audit after form submission', {
            eventId: currentEventId,
            formResponseId: formResponseId.value
          });
        } catch (autoSubmitErr) {
          console.warn('[FormFill] ⚠️ Auto-submit audit failed (non-blocking):', autoSubmitErr);
        }
      }
      
      // Navigate away after a brief delay to show success message (1.5 seconds).
      // Do not close tab before redirect because that can trigger route fallbacks.
      setTimeout(() => {
        router.push(getPreferredReturnRoute());
      }, 1500);
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

.question-card {
  transition: all 0.2s ease;
}

.question-card:hover {
  transform: translateY(-2px);
}
</style>
