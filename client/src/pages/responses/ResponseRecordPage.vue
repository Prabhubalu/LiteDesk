<template>
  <div class="response-record-page-root flex min-h-0 flex-1 flex-col overflow-hidden">
    <RecordPageShell
      :loading="loading"
      :error="error"
      :loading-message="t('forms.hubResponseDetailLoading')"
      :error-title="t('forms.hubResponseDetailLoadFailed')"
      :use-layout="!embed"
      :layout-props="layoutProps"
      @retry="loadData"
    >
      <template v-if="response && form && !embed" #header>
        <RecordHeader
          :show-navigation="true"
          :can-previous="!!neighbors.previousId"
          :can-next="!!neighbors.nextId"
          :previous-label="t('records.genericNavPrevious', { singular: t('navigation.moduleResponses') })"
          :next-label="t('records.genericNavNext', { singular: t('navigation.moduleResponses') })"
          @previous="goToPrevious"
          @next="goToNext"
        >
          <template #breadcrumbs>
            <span class="flex min-w-0 items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <button
                type="button"
                class="shrink-0 transition-colors hover:text-indigo-600 dark:hover:text-indigo-400"
                :aria-label="t('records.genericBackTo', { singular: t('navigation.moduleResponses') })"
                :title="t('records.genericBackTo', { singular: t('navigation.moduleResponses') })"
                @click="goBackToModuleList"
              >
                {{ t('navigation.moduleResponses') }}
              </button>
              <span class="h-1 w-1 shrink-0 rounded-full bg-gray-400 dark:bg-gray-500" />
              <span class="truncate font-medium text-gray-900 dark:text-white">{{ responseTitle }}</span>
            </span>
          </template>
          <template #pageActions>
            <template v-if="isAuditForm">
              <BadgeCell
                :value="reviewStatusLabel(response.reviewStatus || response.status)"
                :variant="reviewStatusVariant(response.reviewStatus || response.status)"
              />
              <span
                v-if="response.selfReviewed === true"
                class="inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                :title="t('forms.hubResponseDetailSelfReviewTitle')"
              >
                {{ t('forms.hubResponseDetailSelfReviewBadge') }}
              </span>
              <template v-if="response.executionStatus === 'Submitted'">
                <template v-if="(response.reviewStatus || response.status) === 'Pending Corrective Action'">
                  <button
                    type="button"
                    :disabled="!canEditForms"
                    class="inline-flex items-center rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                    @click="scrollToCorrectiveActions"
                  >
                    {{ t('forms.hubActionAddCorrective') }}
                  </button>
                </template>
                <template v-if="(response.reviewStatus || response.status) === 'Needs Auditor Review'">
                  <button
                    v-if="canReviewAuditResponse"
                    type="button"
                    :disabled="!canEditForms"
                    class="inline-flex items-center rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                    @click="approveResponse"
                  >
                    {{ t('forms.hubResponseDetailApprove') }}
                  </button>
                  <button
                    v-if="canReviewAuditResponse"
                    type="button"
                    :disabled="!canEditForms"
                    class="inline-flex items-center rounded-lg bg-gray-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                    @click="sendBackForCorrection"
                  >
                    {{ t('forms.hubResponseDetailSendBack') }}
                  </button>
                </template>
                <template v-if="(response.reviewStatus || response.status) === 'Approved'">
                  <button
                    type="button"
                    :disabled="!canEditForms || !canCloseResponse"
                    class="inline-flex items-center rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                    @click="closeResponse"
                  >
                    {{ t('forms.hubResponseDetailClose') }}
                  </button>
                </template>
              </template>
            </template>
            <template v-else>
              <BadgeCell
                :value="executionStatusLabel(response.executionStatus)"
                :variant="executionStatusVariant(response.executionStatus)"
              />
            </template>
            <button
              type="button"
              class="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
              :aria-label="t('records.genericCopyUrl')"
              :title="t('records.genericCopyUrl')"
              @click="copyUrl"
            >
              <ClipboardDocumentIcon class="h-5 w-5" />
            </button>
            <RecordPrintButton
              v-if="response?._id"
              module-key="responses"
              :record-id="String(response._id)"
            />
          </template>
        </RecordHeader>
      </template>

      <template v-if="response && form" #left>
        <EngagementResponseContent
          v-if="!isAuditForm"
          :form="form"
          :response="response"
        />

        <div v-else class="space-y-6">
          <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div class="mb-1 flex items-start justify-between">
                <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">{{ t('forms.reportOverallScore') }}</h3>
                <div class="relative ml-2">
                  <svg
                    class="h-4 w-4 cursor-help text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
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
                    class="pointer-events-none absolute bottom-full right-0 z-50 mb-2 w-64 rounded-lg bg-gray-900 p-2 text-xs text-white shadow-lg dark:bg-gray-700"
                  >
                    {{ t('forms.hubResponseDetailOverallScoreHint') }}
                  </div>
                </div>
              </div>
              <p class="text-2xl font-bold text-gray-900 dark:text-white">
                {{ calculateOverallScoreFromSections(response.sectionScores, form) }}%
              </p>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('forms.hubResponseDetailOverallScoreHint') }}</p>
            </div>

            <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div class="mb-1 flex items-start justify-between">
                <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">{{ t('forms.reportCompliance') }}</h3>
                <div class="relative ml-2">
                  <svg
                    class="h-4 w-4 cursor-help text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
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
                    class="pointer-events-none absolute bottom-full right-0 z-50 mb-2 w-64 rounded-lg bg-gray-900 p-2 text-xs text-white shadow-lg dark:bg-gray-700"
                  >
                    {{ t('forms.hubResponseDetailComplianceHint') }}
                  </div>
                </div>
              </div>
              <p class="text-2xl font-bold text-gray-900 dark:text-white">
                {{ response.kpis?.compliancePercentage || 0 }}%
              </p>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('forms.hubResponseDetailComplianceHint') }}</p>
            </div>

            <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div class="mb-1 flex items-start justify-between">
                <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">{{ t('forms.reportPassRate') }}</h3>
                <div class="relative ml-2">
                  <svg
                    class="h-4 w-4 cursor-help text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
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
                    class="pointer-events-none absolute bottom-full right-0 z-50 mb-2 w-64 rounded-lg bg-gray-900 p-2 text-xs text-white shadow-lg dark:bg-gray-700"
                  >
                    {{ t('forms.hubResponseDetailPassRateHint') }}
                  </div>
                </div>
              </div>
              <p class="text-2xl font-bold text-gray-900 dark:text-white">
                {{ response.kpis?.passRate !== undefined ? response.kpis.passRate : calculatePassRate(response) }}%
              </p>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('forms.hubResponseDetailPassRateHint') }}</p>
            </div>
          </div>

          <div class="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div class="border-b border-gray-200 p-6 dark:border-gray-700">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('forms.hubResponseDetailTitle') }}</h2>
            </div>

            <div v-if="formSectionsNavigation.length > 0" class="px-6 pt-4 lg:hidden">
              <select
                v-model="selectedSectionId"
                class="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                @change="scrollToSection(selectedSectionId)"
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
              <aside
                v-if="formSectionsNavigation.length > 0"
                class="hidden w-64 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 lg:block"
              >
                <div class="sticky top-0 p-6">
                  <nav>
                    <h3 class="mb-3 text-sm font-semibold text-gray-900 dark:text-white">{{ t('forms.hubResponseDetailSectionsNav') }}</h3>
                    <ul class="space-y-1">
                      <li v-for="item in formSectionsNavigation" :key="item.id">
                        <a
                          :href="`#${item.id}`"
                          :class="[
                            'block rounded-md px-3 py-2 text-sm transition-colors',
                            activeSectionId === item.id
                              ? 'bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300'
                              : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700/50'
                          ]"
                          @click.prevent="scrollToSection(item.id)"
                        >
                          {{ item.label }}
                        </a>
                        <ul v-if="item.subsections?.length" class="ml-4 mt-1 space-y-1">
                          <li v-for="subItem in item.subsections" :key="subItem.id">
                            <a
                              :href="`#${subItem.id}`"
                              :class="[
                                'block rounded-md px-3 py-1.5 text-xs transition-colors',
                                activeSectionId === subItem.id
                                  ? 'bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300'
                                  : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700/50'
                              ]"
                              @click.prevent="scrollToSection(subItem.id)"
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

              <div class="min-w-0 flex-1">
                <div class="space-y-6 p-6">
                  <div
                    v-for="(section, sIndex) in form.sections"
                    :key="section.sectionId || sIndex"
                    :id="`section-${section.sectionId || sIndex}`"
                    class="scroll-mt-24 space-y-4"
                  >
                    <div class="border-b border-gray-200 pb-2 dark:border-gray-700">
                      <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ section.name }}</h3>
                      <div v-if="getSectionScore(section.sectionId) !== null" class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        {{ t('forms.hubResponseDetailSectionScore', { score: getSectionScore(section.sectionId) }) }}
                      </div>
                    </div>

                    <div
                      v-for="(question, qIndex) in (section.questions || [])"
                      :key="question.questionId || qIndex"
                      class="rounded-lg bg-gray-50 p-4 dark:bg-gray-700/30"
                    >
                      <p class="mb-1 text-sm font-medium text-gray-900 dark:text-white">{{ question.questionText }}</p>
                      <div class="mt-2 flex items-center gap-2">
                        <BadgeCell
                          v-if="getQuestionResponse(question.questionId)"
                          :value="passFailLabel(getQuestionResponse(question.questionId).passFail || 'N/A')"
                          :variant="passFailVariant(getQuestionResponse(question.questionId).passFail || 'N/A')"
                        />
                        <span
                          v-if="getQuestionResponse(question.questionId)?.score !== undefined"
                          class="text-xs text-gray-600 dark:text-gray-400"
                        >
                          {{ t('forms.hubResponseDetailQuestionScore', { score: getQuestionResponse(question.questionId).score }) }}
                        </span>
                      </div>
                      <div class="mt-3">
                        <p class="mb-1 text-sm text-gray-600 dark:text-gray-400">{{ t('forms.correctiveAnswerLabel') }}</p>
                        <div class="rounded border border-gray-200 bg-white p-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white">
                          {{ formatAnswer(getQuestionResponse(question.questionId)?.answer) }}
                        </div>
                      </div>
                      <div v-if="getQuestionResponse(question.questionId)?.attachments?.length" class="mt-3">
                        <p class="mb-1 text-sm text-gray-600 dark:text-gray-400">{{ t('forms.hubResponseDetailAttachments') }}</p>
                        <div class="flex flex-wrap gap-2">
                          <a
                            v-for="(attachment, aIndex) in getQuestionResponse(question.questionId).attachments"
                            :key="aIndex"
                            :href="attachment"
                            target="_blank"
                            class="inline-flex items-center gap-1 rounded bg-indigo-50 px-2 py-1 text-xs text-indigo-600 hover:text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400"
                          >
                            {{ attachment.split('/').pop() }}
                          </a>
                        </div>
                      </div>
                    </div>

                    <div
                      v-for="(subsection, subIndex) in section.subsections"
                      :key="subsection.subsectionId || subIndex"
                      :id="`subsection-${subsection.subsectionId || subIndex}`"
                      class="ml-4 scroll-mt-24 space-y-3"
                    >
                      <h4 class="text-md font-medium text-gray-800 dark:text-gray-200">{{ subsection.name }}</h4>

                      <div
                        v-for="(question, qIndex) in (subsection.questions || [])"
                        :key="question.questionId || qIndex"
                        class="ml-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-700/30"
                      >
                        <p class="mb-1 text-sm font-medium text-gray-900 dark:text-white">{{ question.questionText }}</p>
                        <div class="mt-2 flex items-center gap-2">
                          <BadgeCell
                            v-if="getQuestionResponse(question.questionId)"
                            :value="passFailLabel(getQuestionResponse(question.questionId).passFail || 'N/A')"
                            :variant="passFailVariant(getQuestionResponse(question.questionId).passFail || 'N/A')"
                          />
                          <span
                            v-if="getQuestionResponse(question.questionId)?.score !== undefined"
                            class="text-xs text-gray-600 dark:text-gray-400"
                          >
                            {{ t('forms.hubResponseDetailQuestionScore', { score: getQuestionResponse(question.questionId).score }) }}
                          </span>
                        </div>
                        <div class="mt-3">
                          <p class="mb-1 text-sm text-gray-600 dark:text-gray-400">{{ t('forms.correctiveAnswerLabel') }}</p>
                          <div class="rounded border border-gray-200 bg-white p-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white">
                            {{ formatAnswer(getQuestionResponse(question.questionId)?.answer) }}
                          </div>
                        </div>
                        <div v-if="getQuestionResponse(question.questionId)?.attachments?.length" class="mt-3">
                          <p class="mb-1 text-sm text-gray-600 dark:text-gray-400">{{ t('forms.hubResponseDetailAttachments') }}</p>
                          <div class="flex flex-wrap gap-2">
                            <a
                              v-for="(attachment, aIndex) in getQuestionResponse(question.questionId).attachments"
                              :key="aIndex"
                              :href="attachment"
                              target="_blank"
                              class="inline-flex items-center gap-1 rounded bg-indigo-50 px-2 py-1 text-xs text-indigo-600 hover:text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400"
                            >
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

          <div id="corrective-actions" data-corrective-actions-panel class="scroll-mt-24">
            <CorrectiveActionPanel
              v-if="(response.reviewStatus || response.status) === 'Pending Corrective Action' || (response.reviewStatus || response.status) === 'Needs Auditor Review'"
              :response="response"
              :form="form"
              @updated="fetchResponse"
            />
          </div>

          <div id="auditor-verification" class="scroll-mt-24">
            <AuditorVerificationPanel
              v-if="(response.reviewStatus || response.status) === 'Needs Auditor Review'"
              :response="response"
              :form="form"
              @updated="fetchResponse"
            />
          </div>

          <div id="report-generation" class="scroll-mt-24">
            <FormReportView :form="form" :response="response" />
          </div>

          <div id="comparison-view" class="scroll-mt-24">
            <FormComparisonView :form="form" :response="response" />
          </div>
        </div>
      </template>

      <template v-if="response && form && !embed" #right>
        <RecordRightPane
          :tabs="rightPaneTabs"
          default-tab="summary"
          :show-header="false"
          :persistence-key="`response-${response._id}`"
          :record-id="String(response._id)"
        >
          <template #tab-summary>
            <div class="flex h-full flex-col">
              <div class="record-context-panel__header flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
                <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('records.detailsTitle') }}</h2>
              </div>
              <div class="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 text-sm">
                <div v-if="form?.name">
                  <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('settings.modFieldsPbResourceForm') }}</div>
                  <div class="mt-0.5 font-medium text-gray-900 dark:text-white">{{ form.name }}</div>
                </div>
                <div v-if="response.submittedAt">
                  <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('forms.hubExecutionSubmitted') }}</div>
                  <div class="mt-0.5 font-medium text-gray-900 dark:text-white">{{ formatDate(response.submittedAt) }}</div>
                </div>
                <div v-if="isEngagementForm && response.submittedBy">
                  <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('forms.hubColSubmittedBy') }}</div>
                  <div class="mt-0.5 font-medium text-gray-900 dark:text-white">{{ formatUserName(response.submittedBy) }}</div>
                </div>
                <div v-if="isEngagementForm && form?.formType">
                  <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('forms.fieldFormType') }}</div>
                  <div class="mt-0.5 font-medium text-gray-900 dark:text-white">{{ form.formType }}</div>
                </div>
                <div v-if="isAuditForm && linkedEvent?.auditorId">
                  <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('forms.hubResponseDetailAuditor') }}</div>
                  <div class="mt-0.5 font-medium text-gray-900 dark:text-white">{{ formatUserName(linkedEvent.auditorId) }}</div>
                </div>
                <div v-if="isAuditForm && linkedEvent?.reviewerId">
                  <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('forms.hubResponseDetailReviewer') }}</div>
                  <div class="mt-0.5 font-medium text-gray-900 dark:text-white">{{ formatUserName(linkedEvent.reviewerId) }}</div>
                </div>
                <div v-if="isAuditForm && linkedEvent?.correctiveOwnerId">
                  <div class="text-xs text-gray-500 dark:text-gray-400">{{ t('forms.hubResponseDetailCorrectiveOwner') }}</div>
                  <div class="mt-0.5 font-medium text-gray-900 dark:text-white">{{ formatUserName(linkedEvent.correctiveOwnerId) }}</div>
                </div>
              </div>
            </div>
          </template>

          <template #tab-related>
            <div class="flex h-full flex-col">
              <div class="record-context-panel__header flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
                <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('records.relatedTitle') }}</h2>
              </div>
              <div class="min-h-0 flex-1 overflow-y-auto p-4">
                <RelatedRecordsPanel
                  app-key="PLATFORM"
                  module-key="responses"
                  :record-id="String(response._id)"
                />
              </div>
            </div>
          </template>
        </RecordRightPane>
      </template>
    </RecordPageShell>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ClipboardDocumentIcon } from '@heroicons/vue/24/outline';
import { useAuthStore } from '@/stores/authRegistry';
import { useTabs } from '@/composables/useTabs';
import apiClient from '@/utils/apiClient';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import CorrectiveActionPanel from '@/components/forms/CorrectiveActionPanel.vue';
import AuditorVerificationPanel from '@/components/forms/AuditorVerificationPanel.vue';
import FormReportView from '@/components/forms/FormReportView.vue';
import {
  normalizeSectionScores,
  calculateOverallScoreFromSections,
} from '@/utils/formScoringUtils';
import FormComparisonView from '@/components/forms/FormComparisonView.vue';
import RecordPageShell from '@/components/record-page/RecordPageShell.vue';
import RecordHeader from '@/components/record-page/RecordHeader.vue';
import RecordPrintButton from '@/components/record-page/RecordPrintButton.vue';
import RecordRightPane from '@/components/record-page/RecordRightPane.vue';
import { useRecordModuleBack } from '@/components/record-page/composables/useRecordModuleBack';
import RelatedRecordsPanel from '@/components/relationships/RelatedRecordsPanel.vue';
import EngagementResponseContent from '@/components/forms/EngagementResponseContent.vue';
import { isAuditFormType, isEngagementFormType } from '@/utils/engagementFormDisplay';

const props = defineProps({
  embed: { type: Boolean, default: false },
  recordId: { type: String, default: null },
  formId: { type: String, default: null }
});

defineEmits(['close']);

const { t } = useI18n();
const { goBackToModuleList } = useRecordModuleBack();

const REVIEW_STATUS_VARIANTS = {
  New: 'default',
  'Pending Corrective Action': 'warning',
  'Needs Auditor Review': 'info',
  Approved: 'success',
  Rejected: 'danger',
  Closed: 'default'
};

const PASS_FAIL_VARIANTS = {
  Pass: 'success',
  Fail: 'danger',
  'N/A': 'default'
};

const EXECUTION_STATUS_VARIANTS = {
  'Not Started': 'default',
  'In Progress': 'info',
  Submitted: 'success'
};

function reviewStatusLabel(value) {
  const keyByValue = {
    New: 'forms.hubStatNew',
    'Pending Corrective Action': 'forms.hubReviewPendingCorrective',
    'Needs Auditor Review': 'forms.hubReviewNeedsAuditor',
    Approved: 'forms.auditorApproved',
    Rejected: 'forms.auditorRejected',
    Closed: 'forms.hubReviewClosed'
  };
  const key = keyByValue[value];
  return key ? t(key) : value;
}

function passFailLabel(value) {
  const keyByValue = {
    Pass: 'forms.hubResponseDetailPass',
    Fail: 'forms.correctivePassFailFail',
    'N/A': 'forms.hubResponseDetailNotApplicable'
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

function executionStatusLabel(value) {
  const keyByValue = {
    'Not Started': 'forms.hubExecutionNotStarted',
    'In Progress': 'forms.hubExecutionInProgress',
    Submitted: 'forms.hubExecutionSubmitted'
  };
  const key = keyByValue[value];
  return key ? t(key) : value;
}

function executionStatusVariant(value) {
  return EXECUTION_STATUS_VARIANTS[value] || 'default';
}

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const { activeTabId, updateTabTitle } = useTabs();

const resolvedFormId = ref(null);
const neighbors = ref({ previousId: null, nextId: null });
const layoutProps = computed(() => ({}));

const isPlatformResponseRoute = computed(() => {
  const name = String(route.name || '');
  if (name === 'response-detail') return true;
  return /^\/responses\/[^/]+$/.test(String(route.path || ''));
});

const isAuditFormsRoute = computed(() => String(route.path || '').startsWith('/audit/forms'));
const formsApiBase = computed(() => (isAuditFormsRoute.value ? '/audit/forms' : '/forms'));

const effectiveResponseId = computed(() => {
  if (props.recordId) return props.recordId;
  return route.params.responseId ?? route.params.id ?? '';
});

const routeFormId = computed(() => {
  if (isPlatformResponseRoute.value) return null;
  return route.params.id || null;
});

const effectiveFormId = computed(() => {
  if (props.formId) return props.formId;
  if (routeFormId.value) return routeFormId.value;
  return resolvedFormId.value;
});

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

const responseTitle = computed(() => {
  if (!response.value) return t('forms.hubResponseDetailTitle');
  return response.value.responseId || effectiveResponseId.value || t('forms.hubResponseDetailTitle');
});

const isAuditForm = computed(() => isAuditFormType(form.value?.formType));
const isEngagementForm = computed(() => isEngagementFormType(form.value?.formType));

const rightPaneTabs = computed(() => [
  { id: 'summary', name: t('records.detailsTitle') },
  { id: 'related', name: t('records.relatedTitle') }
]);

const canEditForms = computed(() => {
  if (isAuditFormsRoute.value) return true;
  return authStore.can('forms', 'edit');
});

const currentUserId = computed(() => authStore.user?._id || null);

const normalizeEventUserId = (user) => {
  if (!user) return null;
  return typeof user === 'object' ? (user._id || user.id) : user;
};

const reviewerId = computed(() => normalizeEventUserId(linkedEvent.value?.reviewerId));
const auditorId = computed(() => normalizeEventUserId(linkedEvent.value?.auditorId || linkedEvent.value?.assignedTo));
const submittedById = computed(() => normalizeEventUserId(response.value?.submittedBy));

const allowSelfReview = computed(() => {
  if (!linkedEvent.value) return false;
  return (
    linkedEvent.value.allowSelfReview === true
    || ((linkedEvent.value.allowSelfReview === undefined || linkedEvent.value.allowSelfReview === null)
      && linkedEvent.value.eventType === 'Internal Audit')
  );
});

const effectiveReviewerId = computed(() => {
  if (reviewerId.value) return reviewerId.value;
  if (allowSelfReview.value && auditorId.value) return auditorId.value;
  return null;
});

const isAssignedReviewer = computed(() => {
  if (!currentUserId.value || !effectiveReviewerId.value) return false;
  return String(currentUserId.value) === String(effectiveReviewerId.value);
});

const selfReviewBlocked = computed(() => {
  if (!currentUserId.value || !submittedById.value) return false;
  const isSelfReview = String(currentUserId.value) === String(submittedById.value);
  return isSelfReview && !allowSelfReview.value;
});

const canReviewAuditResponse = computed(() => {
  if (!linkedEvent.value) return false;
  return isAssignedReviewer.value && !selfReviewBlocked.value;
});

const canCloseResponse = computed(() => {
  if (!response.value?.correctiveActions) return false;
  if (response.value.correctiveActions.length === 0) return true;
  return response.value.correctiveActions.every((action) =>
    action.managerAction?.status === 'Resolved' && action.auditorVerification?.approved === true
  );
});

const formSectionsNavigation = computed(() => {
  const items = [];
  if (!form.value?.sections) return items;

  form.value.sections.forEach((section, sIndex) => {
    const sectionId = `section-${section.sectionId || sIndex}`;
    const item = {
      id: sectionId,
      label: section.name,
      type: 'section'
    };
    if (section.subsections?.length) {
      item.subsections = section.subsections.map((subsection, subIndex) => ({
        id: `subsection-${subsection.subsectionId || subIndex}`,
        label: subsection.name,
        type: 'subsection'
      }));
    }
    items.push(item);
  });
  return items;
});

function recordDetailPath(id) {
  if (isPlatformResponseRoute.value) return `/responses/${id}`;
  if (isAuditFormsRoute.value) return `/audit/forms/${effectiveFormId.value}/responses/${id}`;
  return `/forms/${effectiveFormId.value}/responses/${id}`;
}

function goToPrevious() {
  if (!neighbors.value.previousId) return;
  router.push(recordDetailPath(neighbors.value.previousId));
}

function goToNext() {
  if (!neighbors.value.nextId) return;
  router.push(recordDetailPath(neighbors.value.nextId));
}

async function loadNeighbors() {
  if (!effectiveResponseId.value) return;
  try {
    const res = await apiClient.get(`/modules/responses/records/${effectiveResponseId.value}/neighbors`);
    neighbors.value = res?.success && res.data
      ? res.data
      : { previousId: null, nextId: null };
  } catch {
    neighbors.value = { previousId: null, nextId: null };
  }
}

async function resolveFormIdIfNeeded() {
  if (effectiveFormId.value) return effectiveFormId.value;
  const res = await apiClient.get(`/forms/responses/${effectiveResponseId.value}/meta`);
  if (res?.success && res?.data?.formId) {
    resolvedFormId.value = String(res.data.formId);
    return resolvedFormId.value;
  }
  throw new Error(t('forms.hubResponseDetailLoadFormFailed'));
}

const fetchForm = async () => {
  const fid = effectiveFormId.value;
  if (!fid) return;
  try {
    const result = await apiClient(`${formsApiBase.value}/${fid}`, { method: 'GET' });
    if (result.success) {
      form.value = result.data.data || result.data;
    }
  } catch (err) {
    console.error('Error fetching form:', err);
    error.value = t('forms.hubResponseDetailLoadFormFailed');
  }
};

const fetchResponse = async (options = {}) => {
  const manageLoading = options.manageLoading !== false;
  const fid = effectiveFormId.value;
  if (!fid || !effectiveResponseId.value) return;

  if (manageLoading) {
    loading.value = true;
    error.value = null;
  }
  try {
    const result = await apiClient(
      `${formsApiBase.value}/${fid}/responses/${effectiveResponseId.value}`,
      { method: 'GET' }
    );
    if (!result.success) {
      error.value = result.message || t('forms.hubResponseDetailLoadFailed');
      return;
    }

    response.value = result.data.data || result.data;

    const setResponseTabTitle = () => {
      const tabId = activeTabId.value;
      if (!tabId) return;
      const displayResponseId = response.value?.responseId || effectiveResponseId.value;
      const eventName = linkedEvent.value?.eventName || linkedEvent.value?.name || null;
      if (displayResponseId && eventName) {
        updateTabTitle(tabId, `${displayResponseId} · ${eventName}`);
        return;
      }
      if (displayResponseId) {
        updateTabTitle(tabId, `${displayResponseId} · ${t('forms.hubResponseDetailTabResponse')}`);
      }
    };

    setResponseTabTitle();

    linkedEvent.value = null;
    if (response.value?.linkedTo?.type === 'Event' && response.value?.linkedTo?.id) {
      try {
        const rawLinkedId = response.value.linkedTo.id;
        const linkedEventId = (rawLinkedId && typeof rawLinkedId === 'object')
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

    if (result.data.data?.finalReport?.previousResponseId) {
      try {
        const prevResult = await apiClient(
          `${formsApiBase.value}/${fid}/responses/${result.data.data.finalReport.previousResponseId}`,
          { method: 'GET' }
        );
        if (prevResult.success) {
          previousResponse.value = prevResult.data.data || prevResult.data;
        }
      } catch (err) {
        console.error('Error fetching previous response:', err);
      }
    }
  } catch (err) {
    console.error('Error fetching response:', err);
    error.value = err.message || t('forms.hubResponseDetailLoadFailed');
  } finally {
    if (manageLoading) loading.value = false;
  }
};

async function loadData() {
  loading.value = true;
  error.value = null;
  try {
    await resolveFormIdIfNeeded();
    await fetchForm();
    await fetchResponse({ manageLoading: false });
    await loadNeighbors();
  } catch (err) {
    error.value = err?.message || t('forms.hubResponseDetailLoadFailed');
  } finally {
    loading.value = false;
  }
}

function copyUrl() {
  if (typeof window === 'undefined') return;
  void navigator.clipboard.writeText(window.location.href);
}

const formatUserName = (user) => {
  if (!user) return '';
  if (typeof user === 'object') {
    const first = user.firstName || '';
    const last = user.lastName || '';
    const name = `${first} ${last}`.trim();
    return name || user.email || user._id || '';
  }
  return String(user);
};

const getQuestionResponse = (questionId) => {
  if (!response.value?.responseDetails) return null;
  return response.value.responseDetails.find((rd) => rd.questionId === questionId);
};

const formatAnswer = (answer) => {
  if (answer === null || answer === undefined) return t('forms.hubResponseDetailNoAnswerProvided');
  if (Array.isArray(answer)) return answer.join(', ');
  if (typeof answer === 'object') return JSON.stringify(answer);
  return String(answer);
};

const getSectionScore = (sectionId) => {
  const sections = normalizeSectionScores(response.value?.sectionScores, form.value);
  const match = sections.find((s) => s.sectionId === sectionId);
  return match?.percentage ?? null;
};

const calculatePassRate = (resp) => {
  if (!resp?.kpis) return 0;
  const totalPassed = resp.kpis.totalPassed || 0;
  const totalQuestions = resp.kpis.totalQuestions || 0;
  if (totalQuestions === 0) return 0;
  return Math.round((totalPassed / totalQuestions) * 100);
};

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
  if (!confirm(t('forms.hubConfirmApprove'))) return;
  try {
    const result = await apiClient(
      `${formsApiBase.value}/${effectiveFormId.value}/responses/${effectiveResponseId.value}/approve`,
      { method: 'POST' }
    );
    if (result.success) {
      await fetchResponse();
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
  if (!confirm(t('forms.hubConfirmReject'))) return;
  try {
    const result = await apiClient(
      `${formsApiBase.value}/${effectiveFormId.value}/responses/${effectiveResponseId.value}/reject`,
      { method: 'POST' }
    );
    if (result.success) {
      await fetchResponse();
      alert(result.message || t('forms.hubResponseDetailRejected'));
    }
  } catch (err) {
    console.error('Error rejecting response:', err);
    alert(t('forms.hubRejectFailed'));
  }
};

const sendBackForCorrection = async () => {
  if (!confirm(t('forms.hubResponseDetailSendBackConfirm'))) return;
  await rejectResponse();
};

const scrollToCorrectiveActions = () => {
  const panel = document.querySelector('[data-corrective-actions-panel]');
  if (!panel) return;
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  panel.classList.add('ring-2', 'ring-indigo-500', 'ring-offset-2');
  setTimeout(() => {
    panel.classList.remove('ring-2', 'ring-indigo-500', 'ring-offset-2');
  }, 2000);
};

const closeResponse = async () => {
  if (!canCloseResponse.value) {
    alert(t('forms.hubResponseDetailCannotClose'));
    return;
  }
  if (!confirm(t('forms.hubResponseDetailCloseConfirm'))) return;
  try {
    await fetchResponse();
    const currentStatus = response.value?.reviewStatus || response.value?.status;
    if (currentStatus === 'Closed') {
      alert(t('forms.hubResponseDetailClosedSuccess'));
    } else {
      alert(t('forms.hubResponseDetailNotClosedYet'));
    }
  } catch (err) {
    console.error('Error closing response:', err);
    alert(t('forms.hubResponseDetailCloseFailed'));
  }
};

const scrollToSection = (sectionId) => {
  if (!sectionId) return;
  const element = document.getElementById(sectionId);
  if (!element) return;

  selectedSectionId.value = sectionId;
  if (observer.value) observer.value.disconnect();

  element.scrollIntoView({ behavior: 'smooth', block: 'start' });

  setTimeout(() => {
    if (response.value && form.value) setupIntersectionObserver();
  }, 1000);
};

const setupIntersectionObserver = () => {
  if (observer.value) observer.value.disconnect();

  const sectionElements = [];
  formSectionsNavigation.value.forEach((item) => {
    const element = document.getElementById(item.id);
    if (element) sectionElements.push({ id: item.id, element });
    item.subsections?.forEach((subItem) => {
      const subElement = document.getElementById(subItem.id);
      if (subElement) sectionElements.push({ id: subItem.id, element: subElement });
    });
  });

  if (sectionElements.length === 0) return;

  observer.value = new IntersectionObserver(
    (entries) => {
      let visibleEntry = null;
      let maxRatio = 0;
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
          maxRatio = entry.intersectionRatio;
          visibleEntry = entry;
        }
      });
      if (visibleEntry) activeSectionId.value = visibleEntry.target.id;
    },
    {
      rootMargin: '-20% 0px -60% 0px',
      threshold: [0, 0.1, 0.5, 1]
    }
  );

  sectionElements.forEach(({ element }) => observer.value.observe(element));
};

onMounted(async () => {
  await loadData();
  nextTick(() => {
    if (response.value && form.value) setupIntersectionObserver();
  });
});

watch([() => response.value, () => form.value], () => {
  nextTick(() => {
    if (response.value && form.value) setupIntersectionObserver();
  });
}, { deep: true });

watch(
  () => [effectiveResponseId.value, routeFormId.value],
  (_next, prev) => {
    if (!prev) return;
    void loadData();
  }
);

onUnmounted(() => {
  observer.value?.disconnect();
});
</script>
