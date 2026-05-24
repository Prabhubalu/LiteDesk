<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Sticky Action Bar -->
    <div 
      v-if="response && form && response.executionStatus === 'Submitted'"
      class="sticky bottom-0 sm:top-0 z-50 bg-white dark:bg-gray-800 border-t sm:border-t-0 sm:border-b border-gray-200 dark:border-gray-700 shadow-lg sm:shadow-md"
    >
      <div class="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3">
          <!-- Pending Corrective Action Actions -->
          <template v-if="(response.reviewStatus || response.status) === 'Pending Corrective Action'">
            <button
              @click="scrollToCorrectiveActions"
              :disabled="!canEditForms"
              class="w-full sm:w-auto px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
            >
              {{ t('forms.hubActionAddCorrective') }}
            </button>
          </template>

          <!-- Needs Auditor Review Actions -->
          <template v-if="(response.reviewStatus || response.status) === 'Needs Auditor Review'">
            <button
              @click="approveResponse"
              v-if="canReviewAuditResponse"
              :disabled="!canEditForms"
              class="w-full sm:w-auto px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
            >
              {{ t('forms.hubResponseDetailApprove') }}
            </button>
            <button
              @click="sendBackForCorrection"
              v-if="canReviewAuditResponse"
              :disabled="!canEditForms"
              class="w-full sm:w-auto px-4 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
            >
              {{ t('forms.hubResponseDetailSendBack') }}
            </button>
            <span
              v-else
              class="text-sm text-gray-500 dark:text-gray-400 italic"
            >
              {{ t('forms.hubResponseDetailReviewerOnly') }}
            </span>
          </template>

          <!-- Approved Actions -->
          <template v-if="(response.reviewStatus || response.status) === 'Approved'">
            <button
              @click="closeResponse"
              :disabled="!canEditForms || !canCloseResponse"
              class="w-full sm:w-auto px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
            >
              {{ t('forms.hubResponseDetailClose') }}
            </button>
          </template>

          <!-- Closed Status - No actions (read-only) -->
          <template v-if="(response.reviewStatus || response.status) === 'Closed'">
            <span class="text-sm text-gray-500 dark:text-gray-400 italic">
              {{ t('forms.hubResponseDetailClosedHint') }}
            </span>
          </template>
        </div>
      </div>
    </div>

    <div class="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6">
      <!-- Header -->
        <div class="flex items-center justify-between mb-6">
        <div>
          <button 
            type="button"
            @click="goBackToResponseList" 
            class="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors mb-4"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span class="font-medium">{{ t('forms.hubBackToResponses') }}</span>
          </button>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
            {{ t('forms.hubResponseDetailTitle') }}
          </h1>
          <p v-if="response" class="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {{ t('forms.hubResponseDetailSubmittedAt', { date: formatDate(response.submittedAt) }) }}
          </p>
          <div v-if="linkedEvent" class="mt-2 space-y-1 text-sm text-gray-700 dark:text-gray-300">
            <div v-if="linkedEvent.auditorId" class="flex items-center gap-2">
              <span class="font-medium">{{ t('forms.hubResponseDetailAuditor') }}</span>
              <a
                v-if="linkedEvent.auditorId?.email"
                :href="`mailto:${linkedEvent.auditorId.email}`"
                class="text-indigo-600 dark:text-indigo-400 hover:underline"
                :title="linkedEvent.auditorId.email"
              >
                {{ formatUserName(linkedEvent.auditorId) }}
              </a>
              <span v-else>{{ formatUserName(linkedEvent.auditorId) }}</span>
            </div>

            <div v-if="linkedEvent.reviewerId" class="flex items-center gap-2">
              <span class="font-medium">{{ t('forms.hubResponseDetailReviewer') }}</span>
              <a
                v-if="linkedEvent.reviewerId?.email"
                :href="`mailto:${linkedEvent.reviewerId.email}`"
                class="text-indigo-600 dark:text-indigo-400 hover:underline"
                :title="linkedEvent.reviewerId.email"
              >
                {{ formatUserName(linkedEvent.reviewerId) }}
              </a>
              <span v-else>{{ formatUserName(linkedEvent.reviewerId) }}</span>
            </div>

            <div v-if="linkedEvent.correctiveOwnerId" class="flex items-center gap-2">
              <span class="font-medium">{{ t('forms.hubResponseDetailCorrectiveOwner') }}</span>
              <a
                v-if="linkedEvent.correctiveOwnerId?.email"
                :href="`mailto:${linkedEvent.correctiveOwnerId.email}`"
                class="text-indigo-600 dark:text-indigo-400 hover:underline"
                :title="linkedEvent.correctiveOwnerId.email"
              >
                {{ formatUserName(linkedEvent.correctiveOwnerId) }}
              </a>
              <span v-else>{{ formatUserName(linkedEvent.correctiveOwnerId) }}</span>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <BadgeCell 
            v-if="response"
            :value="reviewStatusLabel(response.reviewStatus || response.status)" 
            :variant="reviewStatusVariant(response.reviewStatus || response.status)"
          />
          <span
            v-if="response?.selfReviewed === true"
            class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600"
            :title="t('forms.hubResponseDetailSelfReviewTitle')"
          >
            {{ t('forms.hubResponseDetailSelfReviewBadge') }}
          </span>
        </div>
      </div>

      <div v-if="loading" class="text-center py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <p class="mt-4 text-gray-600 dark:text-gray-400">{{ t('forms.hubResponseDetailLoading') }}</p>
      </div>

      <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p class="text-red-800 dark:text-red-200">{{ error }}</p>
      </div>

      <div v-else-if="response && form" class="space-y-6">
        <!-- Summary Cards -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- Overall Score Card -->
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div class="flex items-start justify-between mb-1">
              <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">{{ t('forms.reportOverallScore') }}</h3>
              <div class="relative group ml-2">
                <svg 
                  class="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help hover:text-gray-600 dark:hover:text-gray-300 transition-colors" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                  @mouseenter="showTooltip = 'overallScore'"
                  @mouseleave="showTooltip = null"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div 
                  v-if="showTooltip === 'overallScore'"
                  class="absolute right-0 bottom-full mb-2 w-64 p-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg shadow-lg z-50 pointer-events-none"
                >
                  {{ t('forms.hubResponseDetailOverallScoreHint') }}
                  <div class="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
                </div>
              </div>
            </div>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ calculateOverallScore(response.sectionScores) }}%
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ t('forms.hubResponseDetailOverallScoreHint') }}</p>
          </div>

          <!-- Compliance Card -->
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div class="flex items-start justify-between mb-1">
              <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">{{ t('forms.reportCompliance') }}</h3>
              <div class="relative group ml-2">
                <svg 
                  class="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help hover:text-gray-600 dark:hover:text-gray-300 transition-colors" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                  @mouseenter="showTooltip = 'compliance'"
                  @mouseleave="showTooltip = null"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div 
                  v-if="showTooltip === 'compliance'"
                  class="absolute right-0 bottom-full mb-2 w-64 p-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg shadow-lg z-50 pointer-events-none"
                >
                  {{ t('forms.hubResponseDetailComplianceHint') }}
                  <div class="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
                </div>
              </div>
            </div>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ response.kpis?.compliancePercentage || 0 }}%
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ t('forms.hubResponseDetailComplianceHint') }}</p>
            <div 
              v-if="hasContradictoryValues"
              class="mt-1.5 relative group/info"
            >
              <div class="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 cursor-help">
                <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                </svg>
                <span>{{ t('forms.hubResponseDetailWhyDifferent') }}</span>
              </div>
              <div class="absolute left-0 bottom-full mb-2 w-72 p-3 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg shadow-lg z-50 opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-all pointer-events-none">
                {{ t('forms.hubResponseDetailContradictionHint') }}
                <div class="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
              </div>
            </div>
          </div>

          <!-- Pass Rate Card -->
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div class="flex items-start justify-between mb-1">
              <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">{{ t('forms.reportPassRate') }}</h3>
              <div class="relative group ml-2">
                <svg 
                  class="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help hover:text-gray-600 dark:hover:text-gray-300 transition-colors" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                  @mouseenter="showTooltip = 'passRate'"
                  @mouseleave="showTooltip = null"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div 
                  v-if="showTooltip === 'passRate'"
                  class="absolute right-0 bottom-full mb-2 w-64 p-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg shadow-lg z-50 pointer-events-none"
                >
                  {{ t('forms.hubResponseDetailPassRateHint') }}
                  <div class="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
                </div>
              </div>
            </div>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ response.kpis?.passRate !== undefined ? response.kpis.passRate : calculatePassRate(response) }}%
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ t('forms.hubResponseDetailPassRateHint') }}</p>
          </div>
        </div>

        <!-- Response Details -->
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div class="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('forms.hubResponseDetailTitle') }}</h2>
          </div>
          
          <!-- Mobile Navigation Dropdown -->
          <div 
            v-if="response && form && formSectionsNavigation.length > 0"
            class="lg:hidden px-6 pt-4"
          >
            <select
              v-model="selectedSectionId"
              @change="scrollToSection(selectedSectionId)"
              class="w-full px-4 py-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
            >
              <option value="" disabled>{{ t('forms.hubResponseDetailJumpToSection') }}</option>
              <template v-for="item in formSectionsNavigation" :key="item.id">
                <option :value="item.id">{{ item.label }}</option>
                <option 
                  v-for="subItem in (item.subsections || [])" 
                  :key="subItem.id"
                  :value="subItem.id"
                >
                  {{ t('forms.hubResponseDetailSubsectionPrefix', { label: subItem.label }) }}
                </option>
              </template>
            </select>
          </div>

          <div class="flex gap-6">
            <!-- Section Navigation - Desktop Sidebar (within response details container) -->
            <aside 
              v-if="response && form && formSectionsNavigation.length > 0"
              class="hidden lg:block w-64 flex-shrink-0 border-r border-gray-200 dark:border-gray-700"
            >
              <div class="sticky top-0 p-6">
                <nav>
                  <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">{{ t('forms.hubResponseDetailSectionsNav') }}</h3>
                  <ul class="space-y-1">
                    <li v-for="item in formSectionsNavigation" :key="item.id">
                      <a
                        :href="`#${item.id}`"
                        @click.prevent="scrollToSection(item.id)"
                        :class="[
                          'block px-3 py-2 text-sm rounded-md transition-colors',
                          activeSectionId === item.id
                            ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 font-medium'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        ]"
                      >
                        {{ item.label }}
                      </a>
                      <!-- Subsections -->
                      <ul v-if="item.subsections && item.subsections.length > 0" class="ml-4 mt-1 space-y-1">
                        <li v-for="subItem in item.subsections" :key="subItem.id">
                          <a
                            :href="`#${subItem.id}`"
                            @click.prevent="scrollToSection(subItem.id)"
                            :class="[
                              'block px-3 py-1.5 text-xs rounded-md transition-colors',
                              activeSectionId === subItem.id
                                ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 font-medium'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                            ]"
                          >
                            {{ subItem.label }}
                          </a>
                        </li>
                      </ul>
                    </li>
                  </ul>
                </nav>
              </div>
            </aside>

            <!-- Response Content -->
            <div class="flex-1 min-w-0">
              <div class="p-6 space-y-6">
            <!-- Sections -->
            <div 
              v-for="(section, sIndex) in form.sections" 
              :key="section.sectionId || sIndex" 
              :id="`section-${section.sectionId || sIndex}`"
              class="space-y-4 scroll-mt-24"
            >
              <div class="border-b border-gray-200 dark:border-gray-700 pb-2">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ section.name }}</h3>
                <div v-if="response.sectionScores && response.sectionScores[section.sectionId]" class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  {{ t('forms.hubResponseDetailSectionScore', { score: response.sectionScores[section.sectionId] }) }}
                </div>
              </div>

              <!-- Subsections -->
              <div 
                v-for="(subsection, subIndex) in section.subsections" 
                :key="subsection.subsectionId || subIndex" 
                :id="`subsection-${subsection.subsectionId || subIndex}`"
                class="ml-4 space-y-3 scroll-mt-24"
              >
                <h4 class="text-md font-medium text-gray-800 dark:text-gray-200">{{ subsection.name }}</h4>

                <!-- Questions -->
                <div v-for="(question, qIndex) in subsection.questions" :key="question.questionId || qIndex" class="ml-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4">
                  <div class="flex items-start justify-between mb-2">
                    <div class="flex-1">
                      <p class="text-sm font-medium text-gray-900 dark:text-white mb-1">
                        {{ question.questionText }}
                      </p>
                      <div class="flex items-center gap-2 mt-2">
                        <BadgeCell 
                          v-if="getQuestionResponse(question.questionId)"
                          :value="passFailLabel(getQuestionResponse(question.questionId).passFail || 'N/A')" 
                          :variant="passFailVariant(getQuestionResponse(question.questionId).passFail || 'N/A')"
                        />
                        <span v-if="getQuestionResponse(question.questionId)?.score !== undefined" class="text-xs text-gray-600 dark:text-gray-400">
                          {{ t('forms.hubResponseDetailQuestionScore', { score: getQuestionResponse(question.questionId).score }) }}
                        </span>
                      </div>
                    </div>
                  </div>

                  <!-- Answer Display -->
                  <div class="mt-3">
                    <p class="text-sm text-gray-600 dark:text-gray-400 mb-1">{{ t('forms.correctiveAnswerLabel') }}</p>
                    <div class="text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 rounded p-2 border border-gray-200 dark:border-gray-600">
                      {{ formatAnswer(getQuestionResponse(question.questionId)?.answer) }}
                    </div>
                  </div>

                  <!-- Attachments -->
                  <div v-if="getQuestionResponse(question.questionId)?.attachments?.length" class="mt-3">
                    <p class="text-sm text-gray-600 dark:text-gray-400 mb-1">{{ t('forms.hubResponseDetailAttachments') }}</p>
                    <div class="flex flex-wrap gap-2">
                      <a
                        v-for="(attachment, aIndex) in getQuestionResponse(question.questionId).attachments"
                        :key="aIndex"
                        :href="attachment"
                        target="_blank"
                        class="inline-flex items-center gap-1 px-2 py-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 rounded"
                      >
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        {{ attachment.split('/').pop() }}
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Corrective Actions Panel -->
        <div 
          id="corrective-actions"
          data-corrective-actions-panel
          class="scroll-mt-24"
        >
          <CorrectiveActionPanel
            v-if="(response.reviewStatus || response.status) === 'Pending Corrective Action' || (response.reviewStatus || response.status) === 'Needs Auditor Review'"
            :response="response"
            :form="form"
            @updated="fetchResponse"
          />
        </div>

        <!-- Auditor Verification Panel -->
        <div 
          id="auditor-verification"
          class="scroll-mt-24"
        >
          <AuditorVerificationPanel
            v-if="(response.reviewStatus || response.status) === 'Needs Auditor Review'"
            :response="response"
            :form="form"
            @updated="fetchResponse"
          />
        </div>

        <!-- Report Generation -->
        <div 
          id="report-generation"
          class="scroll-mt-24"
        >
          <FormReportView
            :form="form"
            :response="response"
          />
        </div>

        <!-- Comparison View -->
        <div 
          id="comparison-view"
          class="scroll-mt-24"
        >
          <FormComparisonView
            :form="form"
            :response="response"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authRegistry';
import { useTabs } from '@/composables/useTabs';
import apiClient from '@/utils/apiClient';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import CorrectiveActionPanel from '@/components/forms/CorrectiveActionPanel.vue';
import AuditorVerificationPanel from '@/components/forms/AuditorVerificationPanel.vue';
import FormReportView from '@/components/forms/FormReportView.vue';
import FormComparisonView from '@/components/forms/FormComparisonView.vue';

const { t } = useI18n();

const REVIEW_STATUS_VARIANTS = {
  'New': 'default',
  'Pending Corrective Action': 'warning',
  'Needs Auditor Review': 'info',
  Approved: 'success',
  Rejected: 'danger',
  Closed: 'default',
};

const PASS_FAIL_VARIANTS = {
  Pass: 'success',
  Fail: 'danger',
  'N/A': 'default',
};

function reviewStatusLabel(value) {
  const keyByValue = {
    'New': 'forms.hubStatNew',
    'Pending Corrective Action': 'forms.hubReviewPendingCorrective',
    'Needs Auditor Review': 'forms.hubReviewNeedsAuditor',
    Approved: 'forms.auditorApproved',
    Rejected: 'forms.auditorRejected',
    Closed: 'forms.hubReviewClosed',
  };
  const key = keyByValue[value];
  return key ? t(key) : value;
}

function passFailLabel(value) {
  const keyByValue = {
    Pass: 'forms.hubResponseDetailPass',
    Fail: 'forms.correctivePassFailFail',
    'N/A': 'forms.hubResponseDetailNotApplicable',
  };
  const key = keyByValue[value];
  return key ? t(key) : value;
}

function reviewStatusVariant(value) {
  return REVIEW_STATUS_VARIANTS[value] || 'default';
}

function passFailVariant(value) {
  return PASS_FAIL_VARIANTS[value] || 'default';
}

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const { activeTabId, updateTabTitle } = useTabs();

// Props
const formId = computed(() => route.params.id);
const responseId = computed(() => route.params.responseId);

const isAuditFormsRoute = computed(() => String(route.path || '').startsWith('/audit/forms'));
const formsApiBase = computed(() => (isAuditFormsRoute.value ? '/audit/forms' : '/forms'));

// State
const loading = ref(true);
const error = ref(null);
const form = ref(null);
const response = ref(null);
const linkedEvent = ref(null);
const previousResponse = ref(null);
const showTooltip = ref(null);
const activeSectionId = ref('');
const selectedSectionId = ref('');
const observer = ref(null);

// Permissions — Audit form response detail uses `/api/audit/forms/*` (no Sales `forms.edit`); server enforces stakeholders.
const canEditForms = computed(() => {
  if (isAuditFormsRoute.value) return true;
  return authStore.can('forms', 'edit');
});

// Audit approval permissions: only the assigned reviewer can approve/reject.
const currentUserId = computed(() => authStore.user?._id || null);
const reviewerId = computed(() => {
  const r = linkedEvent.value?.reviewerId;
  return (r && typeof r === 'object') ? (r._id || r.id) : r;
});
const submittedById = computed(() => {
  const s = response.value?.submittedBy;
  return (s && typeof s === 'object') ? (s._id || s.id) : s;
});
const isAssignedReviewer = computed(() => {
  if (!currentUserId.value || !reviewerId.value) return false;
  return String(currentUserId.value) === String(reviewerId.value);
});
const selfReviewBlocked = computed(() => {
  if (!currentUserId.value || !submittedById.value) return false;
  const isSelfReview = String(currentUserId.value) === String(submittedById.value);
  const allow = linkedEvent.value?.allowSelfReview === true;
  return isSelfReview && !allow;
});
const canReviewAuditResponse = computed(() => {
  // If we don't have the linked event yet, be conservative and hide actions.
  if (!linkedEvent.value) return false;
  return isAssignedReviewer.value && !selfReviewBlocked.value;
});

// Check if response can be closed (all corrective actions must be completed)
const canCloseResponse = computed(() => {
  if (!response.value || !response.value.correctiveActions) return false;
  if (response.value.correctiveActions.length === 0) return true;
  
  return response.value.correctiveActions.every(action => {
    return action.managerAction?.status === 'Resolved' && 
           action.auditorVerification?.approved === true;
  });
});

// Generate navigation items from form sections only (for sidebar navigation)
const formSectionsNavigation = computed(() => {
  const items = [];
  
  // Only include form sections and subsections
  if (form.value && form.value.sections) {
    form.value.sections.forEach((section, sIndex) => {
      const sectionId = `section-${section.sectionId || sIndex}`;
      const item = {
        id: sectionId,
        label: section.name,
        type: 'section'
      };
      
      // Add subsections if they exist
      if (section.subsections && section.subsections.length > 0) {
        item.subsections = section.subsections.map((subsection, subIndex) => ({
          id: `subsection-${subsection.subsectionId || subIndex}`,
          label: subsection.name,
          type: 'subsection'
        }));
      }
      
      items.push(item);
    });
  }
  
  return items;
});

const goBackToResponseList = () => {
  if (isAuditFormsRoute.value) {
    router.push('/audit/responses');
    return;
  }
  router.push(`/forms/${formId.value}/responses`);
};

// Methods
const fetchForm = async () => {
  try {
    const result = await apiClient(`${formsApiBase.value}/${formId.value}`, { method: 'GET' });
    if (result.success) {
      form.value = result.data.data || result.data;
    }
  } catch (err) {
    console.error('Error fetching form:', err);
    error.value = t('forms.hubResponseDetailLoadFormFailed');
  }
};

const fetchResponse = async () => {
  loading.value = true;
  error.value = null;
  try {
    const result = await apiClient(`${formsApiBase.value}/${formId.value}/responses/${responseId.value}`, { method: 'GET' });
    if (result.success) {
      response.value = result.data.data || result.data;

      const setResponseTabTitle = () => {
        const tabId = activeTabId.value;
        if (!tabId) return;

        const displayResponseId = response.value?.responseId || responseId.value;
        const eventName =
          linkedEvent.value?.eventName ||
          linkedEvent.value?.name ||
          null;

        if (displayResponseId && eventName) {
          updateTabTitle(tabId, `${displayResponseId} · ${eventName}`);
          return;
        }

        // Fallback while linked event is still loading
        if (displayResponseId) {
          updateTabTitle(tabId, `${displayResponseId} · ${t('forms.hubResponseDetailTabResponse')}`);
        }
      };

      // Set a good initial title immediately, then refine once linkedEvent is fetched.
      setResponseTabTitle();

      // Fetch linked event (for Reviewer display + audit context)
      linkedEvent.value = null;
      if (response.value?.linkedTo?.type === 'Event' && response.value?.linkedTo?.id) {
        try {
          const rawLinkedId = response.value.linkedTo.id;
          const linkedEventId =
            (rawLinkedId && typeof rawLinkedId === 'object')
              ? (rawLinkedId._id || rawLinkedId.eventId || rawLinkedId.id)
              : rawLinkedId;

          if (linkedEventId) {
            const evPath = isAuditFormsRoute.value
              ? `/audit/linked-events/${linkedEventId}`
              : `/events/${linkedEventId}`;
            const ev = await apiClient(evPath, { method: 'GET' });
            if (ev.success) {
              linkedEvent.value = ev.data;
              setResponseTabTitle();
            }
          }
        } catch (e) {
          console.warn('Failed to fetch linked event:', e);
        }
      }
      
      // Fetch previous response if available
      if (result.data.data?.finalReport?.previousResponseId) {
        try {
          const prevResult = await apiClient(
            `${formsApiBase.value}/${formId.value}/responses/${result.data.data.finalReport.previousResponseId}`,
            { method: 'GET' }
          );
          if (prevResult.success) {
            previousResponse.value = prevResult.data.data || prevResult.data;
          }
        } catch (err) {
          console.error('Error fetching previous response:', err);
        }
      }
    } else {
      error.value = result.message || t('forms.hubResponseDetailLoadFailed');
    }
  } catch (err) {
    console.error('Error fetching response:', err);
    error.value = err.message || t('forms.hubResponseDetailLoadFailed');
  } finally {
    loading.value = false;
  }
};

const formatUserName = (user) => {
  if (!user) return '';
  // populated user
  if (typeof user === 'object') {
    const first = user.firstName || '';
    const last = user.lastName || '';
    const name = `${first} ${last}`.trim();
    return name || user.email || user._id || '';
  }
  return String(user);
};

const getQuestionResponse = (questionId) => {
  if (!response.value || !response.value.responseDetails) return null;
  return response.value.responseDetails.find(rd => rd.questionId === questionId);
};

const formatAnswer = (answer) => {
  if (answer === null || answer === undefined) return t('forms.hubResponseDetailNoAnswerProvided');
  if (Array.isArray(answer)) return answer.join(', ');
  if (typeof answer === 'object') return JSON.stringify(answer);
  return String(answer);
};

const calculateOverallScore = (sectionScores) => {
  if (!sectionScores || typeof sectionScores !== 'object') return 0;
  const scores = Object.values(sectionScores).filter(s => typeof s === 'number');
  if (scores.length === 0) return 0;
  const sum = scores.reduce((acc, score) => acc + score, 0);
  return Math.round(sum / scores.length);
};

const calculatePassRate = (response) => {
  if (!response || !response.kpis) return 0;
  const totalPassed = response.kpis.totalPassed || 0;
  const totalQuestions = response.kpis.totalQuestions || 0;
  if (totalQuestions === 0) return 0;
  return Math.round((totalPassed / totalQuestions) * 100);
};

// Check if values appear contradictory (e.g., 0% score but 100% compliance)
const hasContradictoryValues = computed(() => {
  if (!response.value) return false;
  const overallScore = calculateOverallScore(response.value.sectionScores);
  const compliance = response.value.kpis?.compliancePercentage || 0;
  
  // Show info tooltip if compliance is high (>0) but overall score is 0
  // This is valid - compliance measures mandatory checks, while overall score is weighted scorable questions
  return compliance > 0 && overallScore === 0;
});

const formatDate = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const approveResponse = async () => {
  if (!confirm(t('forms.hubConfirmApprove'))) {
    return;
  }

  try {
    const result = await apiClient(`${formsApiBase.value}/${formId.value}/responses/${responseId.value}/approve`, {
      method: 'POST'
    });

    if (result.success) {
      await fetchResponse();
      // Stay on the same response detail record; just refresh state in-place.
      alert(result.message || t('forms.hubResponseDetailApproved'));
    } else {
      alert(result.message || t('forms.hubApproveFailed'));
    }
  } catch (err) {
    console.error('Error approving response:', err);
    alert(err?.message || t('forms.hubApproveFailed'));
  }
};

const rejectResponse = async () => {
  if (!confirm(t('forms.hubConfirmReject'))) {
    return;
  }

  try {
    const result = await apiClient(`${formsApiBase.value}/${formId.value}/responses/${responseId.value}/reject`, {
      method: 'POST'
    });

    if (result.success) {
      await fetchResponse();
      // Stay on the same response detail record; just refresh state in-place.
      alert(result.message || t('forms.hubResponseDetailRejected'));
    }
  } catch (err) {
    console.error('Error rejecting response:', err);
    alert(t('forms.hubRejectFailed'));
  }
};

const sendBackForCorrection = async () => {
  if (!confirm(t('forms.hubResponseDetailSendBackConfirm'))) {
    return;
  }

  await rejectResponse();
};

const scrollToCorrectiveActions = () => {
  // Scroll to the corrective actions panel
  const panel = document.querySelector('[data-corrective-actions-panel]');
  if (panel) {
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Add a slight highlight effect
    panel.classList.add('ring-2', 'ring-indigo-500', 'ring-offset-2');
    setTimeout(() => {
      panel.classList.remove('ring-2', 'ring-indigo-500', 'ring-offset-2');
    }, 2000);
  }
};

const closeResponse = async () => {
  if (!canCloseResponse.value) {
    alert(t('forms.hubResponseDetailCannotClose'));
    return;
  }

  if (!confirm(t('forms.hubResponseDetailCloseConfirm'))) {
    return;
  }

  // Since status is computed, closing happens automatically when approved and all corrective actions are complete
  // We just need to refresh the response to trigger status recomputation
  // If the response is already approved and all actions are complete, status will be "Closed"
  try {
    await fetchResponse();
    
    // Check if status is now Closed
    const currentStatus = response.value?.reviewStatus || response.value?.status;
    if (currentStatus === 'Closed') {
      alert(t('forms.hubResponseDetailClosedSuccess'));
    } else {
      // If status is not Closed yet, all corrective actions might not be verified
      alert(t('forms.hubResponseDetailNotClosedYet'));
    }
  } catch (err) {
    console.error('Error closing response:', err);
    alert(t('forms.hubResponseDetailCloseFailed'));
  }
};

// Scroll to section smoothly
const scrollToSection = (sectionId) => {
  if (!sectionId) return;
  
  const element = document.getElementById(sectionId);
  if (element) {
    // Update selected section immediately for better UX
    selectedSectionId.value = sectionId;
    
    // Temporarily disable observer to prevent conflicts during programmatic scroll
    if (observer.value) {
      observer.value.disconnect();
    }
    
    element.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'start' 
    });
    
    // Re-enable observer after scroll completes
    setTimeout(() => {
      if (response.value && form.value) {
        setupIntersectionObserver();
      }
    }, 1000);
  }
};

// Setup IntersectionObserver to track visible sections
const setupIntersectionObserver = () => {
  // Clean up existing observer
  if (observer.value) {
    observer.value.disconnect();
  }
  
  // Get all section elements from form sections navigation (ensures sync)
  const sectionElements = [];
  
  formSectionsNavigation.value.forEach(item => {
    const element = document.getElementById(item.id);
    if (element) {
      sectionElements.push({ id: item.id, element });
    }
    
    // Add subsections
    if (item.subsections) {
      item.subsections.forEach(subItem => {
        const subElement = document.getElementById(subItem.id);
        if (subElement) {
          sectionElements.push({ id: subItem.id, element: subElement });
        }
      });
    }
  });
  
  if (sectionElements.length === 0) return;
  
  // Create observer
  observer.value = new IntersectionObserver(
    (entries) => {
      // Find the entry with the highest intersection ratio that's in view
      let visibleEntry = null;
      let maxRatio = 0;
      
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
          maxRatio = entry.intersectionRatio;
          visibleEntry = entry;
        }
      });
      
      // Update active section (only if we found a visible entry)
      if (visibleEntry) {
        activeSectionId.value = visibleEntry.target.id;
        // Don't update selectedSectionId here to avoid dropdown jumping
      }
    },
    {
      rootMargin: '-20% 0px -60% 0px', // Trigger when section is in upper portion of viewport
      threshold: [0, 0.1, 0.5, 1]
    }
  );
  
  // Observe all section elements
  sectionElements.forEach(({ element }) => {
    observer.value.observe(element);
  });
};

// Lifecycle
onMounted(async () => {
  await fetchForm();
  await fetchResponse();
  
  // Setup intersection observer after content is loaded
  nextTick(() => {
    if (response.value && form.value) {
      setupIntersectionObserver();
    }
  });
});

// Watch for response/form changes to update observer
watch([() => response.value, () => form.value], () => {
  nextTick(() => {
    if (response.value && form.value) {
      setupIntersectionObserver();
    }
  });
}, { deep: true });

onUnmounted(() => {
  if (observer.value) {
    observer.value.disconnect();
  }
});
</script>

