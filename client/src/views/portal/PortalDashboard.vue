<template>
  <div class="min-h-full w-full">
    <div class="mx-auto w-full max-w-5xl space-y-4 pb-2">
      <div
        v-if="error"
        :class="['px-4 py-3.5', PLATFORM_HOME_ALERT_ERROR_CLASS]"
      >
        <p class="text-sm font-medium text-danger-900 dark:text-danger-100">{{ error }}</p>
      </div>

      <div v-if="loading" class="space-y-4">
        <div class="h-32" :class="PLATFORM_HOME_SKELETON_CLASS" />
        <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div v-for="i in 3" :key="i" class="h-28" :class="PLATFORM_HOME_SKELETON_CLASS" />
        </div>
        <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div v-for="i in 3" :key="`link-${i}`" class="h-32" :class="PLATFORM_HOME_SKELETON_CLASS" />
        </div>
        <div class="h-64" :class="PLATFORM_HOME_SKELETON_CLASS" />
      </div>

      <template v-else>
        <div
          :class="[
            PLATFORM_HOME_CARD_CLASS,
            PLATFORM_HOME_INTENT_GRADIENT_CLASS,
            'portal-dashboard-enter p-4 sm:p-5'
          ]"
        >
          <h1 class="text-xl font-semibold tracking-tight text-neutral-900 dark:text-white sm:text-2xl">
            {{ greetingTitle }}
          </h1>
          <p class="mt-1 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
            {{ dashboardSubtitle }}
          </p>

          <div
            v-if="showIntentActions"
            class="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center"
          >
            <button
              v-if="widgets.knowledge"
              type="button"
              class="flex min-h-11 flex-1 items-center gap-3 rounded-xl px-4 py-2.5 text-left transition-colors hover:border-primary-200 hover:bg-white dark:hover:border-primary-500/40 dark:hover:bg-neutral-900/70"
              :class="PLATFORM_HOME_INSET_CONTROL_CLASS"
              @click="openHelpSearch"
            >
              <MagnifyingGlassIcon class="h-5 w-5 shrink-0 text-neutral-400 dark:text-neutral-500" />
              <span class="flex-1 truncate text-sm text-neutral-400 dark:text-neutral-500">
                {{ t('cases.portalDashboardSearchHelpPlaceholder') }}
              </span>
            </button>

            <router-link
              v-if="widgets.cases && canCreateCase"
              :to="{ name: 'portal-case-list', query: { create: '1' } }"
              class="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-1.5 rounded-xl border border-primary-200 bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 dark:border-primary-700 dark:bg-primary-600 dark:hover:bg-primary-500 sm:w-auto"
              :class="PLATFORM_HOME_PRIMARY_BUTTON_CLASS"
              @click="capturePortalDashboardEmptyStateCtaClicked('new_case_intent')"
            >
              <PlusIcon class="h-4 w-4" />
              {{ t('cases.portalCasesNew') }}
            </router-link>
          </div>
        </div>

        <div v-if="briefSignals.length" class="portal-dashboard-enter flex flex-wrap gap-2" style="animation-delay: 60ms">
          <router-link
            v-for="signal in briefSignals"
            :key="signal.id"
            :to="signal.route"
            class="inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-left text-xs font-medium transition-colors"
            :class="[PLATFORM_HOME_FLAT_CHIP_CLASS, signalChipClass(signal.severity)]"
            @click="capturePortalDashboardStatClicked(signal.id)"
          >
            <span class="h-1.5 w-1.5 shrink-0 rounded-full" :class="signalDotClass(signal.severity)" />
            <span class="truncate">{{ signal.text }}</span>
          </router-link>
        </div>

        <PortalDashboardChecklist
          v-if="showGettingStartedChecklist"
          class="portal-dashboard-enter"
          style="animation-delay: 90ms"
          :title="checklistTitle"
          :steps="gettingStartedSteps"
          @dismiss="dismissChecklist"
          @step-click="handleChecklistStepClick"
        />

        <div
          v-if="statCards.length"
          class="portal-dashboard-enter grid grid-cols-1 gap-4 md:grid-cols-3"
          style="animation-delay: 120ms"
        >
          <router-link
            v-for="stat in statCards"
            :key="stat.id"
            :to="stat.route"
            class="group flex min-h-[7.25rem] flex-col justify-between rounded-2xl p-5 transition-colors hover:border-primary-200/70 dark:hover:border-primary-500/25"
            :class="PLATFORM_HOME_CARD_CLASS"
            @click="capturePortalDashboardStatClicked(stat.id)"
          >
            <div class="flex items-start justify-between gap-3">
              <p class="text-xs font-medium leading-snug text-neutral-500 dark:text-neutral-400">
                {{ stat.label }}
              </p>
              <ArrowRightIcon
                class="h-3.5 w-3.5 shrink-0 translate-x-0 text-neutral-300 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100 dark:text-neutral-600"
              />
            </div>

            <div class="mt-auto pt-4">
              <p
                v-if="stat.showClearState"
                class="text-lg font-semibold tracking-tight text-success-600 dark:text-success-400"
              >
                {{ stat.clearLabel }}
              </p>
              <p
                v-else
                class="text-3xl font-semibold tabular-nums tracking-tight text-neutral-900 dark:text-white"
              >
                <PortalDashboardAnimatedStat :value="stat.value" />
              </p>
            </div>
          </router-link>
        </div>

        <div
          v-if="quickLinks.length"
          class="portal-dashboard-enter grid grid-cols-1 gap-4 lg:grid-cols-3"
          style="animation-delay: 150ms"
        >
          <router-link
            v-for="link in quickLinks"
            :key="link.id"
            :to="link.route"
            class="group flex min-h-[7.5rem] flex-col rounded-2xl border border-neutral-200/70 bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-primary-800"
            @click="capturePortalDashboardQuickLinkClicked(link.id)"
          >
            <span class="mb-3 flex items-center gap-2.5">
              <span
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-950/50 dark:text-primary-400"
              >
                <component :is="link.icon" class="h-5 w-5" />
              </span>
              <span class="truncate text-sm font-semibold text-neutral-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
                {{ link.title }}
              </span>
            </span>
            <p class="mt-auto text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
              {{ link.hint }}
            </p>
          </router-link>
        </div>

        <section
          v-if="widgets.knowledge && suggestedArticles.length"
          :class="['portal-dashboard-enter flex flex-col overflow-hidden', PLATFORM_HOME_CARD_CLASS]"
          style="animation-delay: 180ms"
        >
          <div :class="['px-4 py-2.5 sm:px-5', PLATFORM_HOME_CARD_HEADER_DIVIDER_CLASS]">
            <div class="flex items-center justify-between gap-3">
              <h2 class="text-sm font-semibold text-neutral-900 dark:text-white">
                {{ t('cases.portalDashboardSuggestedArticles') }}
              </h2>
              <router-link
                to="/portal/knowledge"
                class="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                @click="capturePortalDashboardQuickLinkClicked('view_help_center')"
              >
                {{ t('cases.portalDashboardViewHelpCenter') }}
                <ArrowRightIcon class="h-3 w-3" />
              </router-link>
            </div>
            <p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              {{ t('cases.portalDashboardSuggestedArticlesHint') }}
            </p>
          </div>

          <div
            :class="[
              'flex flex-col divide-y divide-neutral-100 dark:divide-white/[0.06]',
              PLATFORM_HOME_LIST_SCROLL_CLASS
            ]"
          >
            <router-link
              v-for="article in suggestedArticles"
              :key="article._id"
              :to="`/portal/knowledge/${article._id}`"
              class="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/60 sm:px-5"
              @click="openSuggestedArticle(article._id)"
            >
              <span
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-950/50 dark:text-primary-400"
              >
                <BookOpenIcon class="h-4 w-4" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium text-neutral-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
                  {{ article.title }}
                </span>
                <span
                  v-if="article.description"
                  class="mt-0.5 block truncate text-xs text-neutral-500 dark:text-neutral-400"
                >
                  {{ article.description }}
                </span>
              </span>
              <ArrowRightIcon class="h-4 w-4 shrink-0 text-neutral-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-neutral-600" />
            </router-link>
          </div>
        </section>

        <section
          v-if="widgets.cases"
          :class="['portal-dashboard-enter flex flex-col overflow-hidden', PLATFORM_HOME_CARD_CLASS]"
          style="animation-delay: 210ms"
        >
          <div :class="['flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5', PLATFORM_HOME_CARD_HEADER_DIVIDER_CLASS]">
            <h2 class="text-sm font-semibold text-neutral-900 dark:text-white">
              {{ t('cases.portalDashboardRecentCases') }}
            </h2>
            <router-link
              to="/portal/cases"
              class="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
              @click="capturePortalDashboardQuickLinkClicked('view_all_cases')"
            >
              {{ t('cases.portalDashboardViewAllCases') }}
              <ArrowRightIcon class="h-3 w-3" />
            </router-link>
          </div>

          <div v-if="recentCases.length === 0" class="flex flex-col items-center justify-center px-5 py-10 text-center">
            <LifebuoyIcon class="mb-3 h-10 w-10 text-neutral-300 dark:text-neutral-600" />
            <p class="text-sm font-medium text-neutral-900 dark:text-white">
              {{ t('cases.portalDashboardNoCasesYet') }}
            </p>
            <p class="mt-1 max-w-sm text-xs text-neutral-500 dark:text-neutral-400">
              {{ t('cases.portalDashboardNoCasesHint') }}
            </p>
            <div class="mt-4 flex flex-wrap items-center justify-center gap-2">
              <router-link
                v-if="canCreateCase"
                :to="{ name: 'portal-case-list', query: { create: '1' } }"
                class="inline-flex items-center rounded-xl border border-primary-200 bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 dark:border-primary-700 dark:bg-primary-600 dark:hover:bg-primary-500"
                :class="PLATFORM_HOME_PRIMARY_BUTTON_CLASS"
                @click="capturePortalDashboardEmptyStateCtaClicked('new_case_empty')"
              >
                {{ t('cases.portalCasesNew') }}
              </router-link>
              <router-link
                v-if="widgets.knowledge"
                to="/portal/knowledge"
                class="inline-flex items-center rounded-xl border border-neutral-200/70 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-white/[0.12] dark:text-neutral-200 dark:hover:bg-neutral-800/60"
                @click="capturePortalDashboardEmptyStateCtaClicked('browse_help')"
              >
                {{ t('cases.portalDashboardBrowseHelp') }}
              </router-link>
            </div>
          </div>

          <div
            v-else
            :class="[
              'flex flex-col divide-y divide-neutral-100 dark:divide-white/[0.06]',
              PLATFORM_HOME_LIST_SCROLL_CLASS
            ]"
          >
            <button
              v-for="item in recentCases"
              :key="item._id"
              type="button"
              class="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/60 sm:px-5"
              @click="openCase(item._id)"
            >
              <span
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
              >
                <TicketIcon class="h-4 w-4" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="flex items-center gap-2">
                  <span class="truncate text-sm font-medium text-neutral-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
                    {{ item.title }}
                  </span>
                  <span
                    v-if="item.awaitingReply"
                    class="shrink-0 inline-flex rounded-full bg-danger-100 px-2 py-0.5 text-[11px] font-medium text-danger-800 dark:bg-danger-900/30 dark:text-danger-400"
                  >
                    {{ t('cases.portalDashboardNeedsReply') }}
                  </span>
                  <span
                    v-else
                    class="shrink-0 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium"
                    :class="statusClass(item.status)"
                  >
                    {{ item.status }}
                  </span>
                </span>
                <span class="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                  <span class="font-mono">{{ item.caseId }}</span>
                  <span v-if="relativeTime(item.updatedAt)" aria-hidden="true">·</span>
                  <span v-if="relativeTime(item.updatedAt)">{{ relativeTime(item.updatedAt) }}</span>
                </span>
              </span>
              <ArrowRightIcon class="h-4 w-4 shrink-0 text-neutral-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-neutral-600" />
            </button>
          </div>
        </section>

        <section
          v-if="widgets.invoices"
          :class="['portal-dashboard-enter flex flex-col overflow-hidden', PLATFORM_HOME_CARD_CLASS]"
          style="animation-delay: 240ms"
        >
          <div :class="['flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5', PLATFORM_HOME_CARD_HEADER_DIVIDER_CLASS]">
            <h2 class="text-sm font-semibold text-neutral-900 dark:text-white">
              {{ t('cases.portalDashboardRecentInvoices') }}
            </h2>
            <router-link
              to="/portal/invoices"
              class="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
              @click="capturePortalDashboardQuickLinkClicked('view_all_invoices')"
            >
              {{ t('cases.portalDashboardViewAllInvoices') }}
              <ArrowRightIcon class="h-3 w-3" />
            </router-link>
          </div>

          <div v-if="recentInvoices.length === 0" class="flex flex-col items-center justify-center px-5 py-10 text-center">
            <DocumentTextIcon class="mb-3 h-10 w-10 text-neutral-300 dark:text-neutral-600" />
            <p class="text-sm font-medium text-neutral-900 dark:text-white">
              {{ t('cases.portalDashboardNoInvoicesYet') }}
            </p>
            <p class="mt-1 max-w-sm text-xs text-neutral-500 dark:text-neutral-400">
              {{ t('cases.portalDashboardNoInvoicesHint') }}
            </p>
          </div>

          <div
            v-else
            :class="[
              'flex flex-col divide-y divide-neutral-100 dark:divide-white/[0.06]',
              PLATFORM_HOME_LIST_SCROLL_CLASS
            ]"
          >
            <router-link
              v-for="item in recentInvoices"
              :key="item._id"
              :to="'/portal/invoices'"
              class="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/60 sm:px-5"
              @click="capturePortalDashboardQuickLinkClicked('recent_invoice')"
            >
              <span
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
              >
                <DocumentTextIcon class="h-4 w-4" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="truncate text-sm font-medium text-neutral-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
                  {{ item.invoiceNumber || item.invoiceId }}
                </span>
                <span class="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                  <span>{{ formatMoney(item.amountDue, item.currency) }}</span>
                  <span v-if="item.dueDate" aria-hidden="true">·</span>
                  <span v-if="item.dueDate">{{ formatDueDate(item.dueDate) }}</span>
                </span>
              </span>
              <ArrowRightIcon class="h-4 w-4 shrink-0 text-neutral-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-neutral-600" />
            </router-link>
          </div>
        </section>

        <section
          v-if="widgets.audits"
          :class="['portal-dashboard-enter flex flex-col overflow-hidden', PLATFORM_HOME_CARD_CLASS]"
          style="animation-delay: 270ms"
        >
          <div :class="['flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5', PLATFORM_HOME_CARD_HEADER_DIVIDER_CLASS]">
            <h2 class="text-sm font-semibold text-neutral-900 dark:text-white">
              {{ t('cases.portalDashboardRecentAudits') }}
            </h2>
            <router-link
              to="/portal/audits"
              class="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
              @click="capturePortalDashboardQuickLinkClicked('view_all_audits')"
            >
              {{ t('cases.portalDashboardViewAllAudits') }}
              <ArrowRightIcon class="h-3 w-3" />
            </router-link>
          </div>

          <div v-if="recentAudits.length === 0" class="flex flex-col items-center justify-center px-5 py-10 text-center">
            <ShieldCheckIcon class="mb-3 h-10 w-10 text-neutral-300 dark:text-neutral-600" />
            <p class="text-sm font-medium text-neutral-900 dark:text-white">
              {{ t('cases.portalDashboardNoAuditsYet') }}
            </p>
            <p class="mt-1 max-w-sm text-xs text-neutral-500 dark:text-neutral-400">
              {{ t('cases.portalDashboardNoAuditsHint') }}
            </p>
          </div>

          <div
            v-else
            :class="[
              'flex flex-col divide-y divide-neutral-100 dark:divide-white/[0.06]',
              PLATFORM_HOME_LIST_SCROLL_CLASS
            ]"
          >
            <button
              v-for="item in recentAudits"
              :key="item._id"
              type="button"
              class="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/60 sm:px-5"
              @click="openAudit(item.eventId)"
            >
              <span
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
              >
                <ShieldCheckIcon class="h-4 w-4" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="flex items-center gap-2">
                  <span class="truncate text-sm font-medium text-neutral-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
                    {{ item.title }}
                  </span>
                  <span
                    class="shrink-0 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize"
                    :class="auditStatusClass(item.status)"
                  >
                    {{ item.status || 'open' }}
                  </span>
                </span>
                <span class="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                  <span class="font-mono">{{ item.eventId }}</span>
                  <span v-if="relativeTime(item.updatedAt)" aria-hidden="true">·</span>
                  <span v-if="relativeTime(item.updatedAt)">{{ relativeTime(item.updatedAt) }}</span>
                </span>
              </span>
              <ArrowRightIcon class="h-4 w-4 shrink-0 text-neutral-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-neutral-600" />
            </button>
          </div>
        </section>
      </template>
    </div>
  </div>
</template>

<script setup>
import { formatUserDate } from '@/utils/localeFormat';
import { formatCurrencyValue } from '@/utils/currencyOptions';
import { useI18n } from 'vue-i18n';
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  ArrowRightIcon,
  BookOpenIcon,
  BriefcaseIcon,
  BuildingOfficeIcon,
  ClipboardDocumentCheckIcon,
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  LifebuoyIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  ShieldCheckIcon,
  TicketIcon,
  UserIcon
} from '@heroicons/vue/24/outline';
import { useAuthStore } from '@/stores/authRegistry';
import portalApiClient from '@/utils/portalApiClient';
import PortalDashboardAnimatedStat from '@/components/portal/PortalDashboardAnimatedStat.vue';
import PortalDashboardChecklist from '@/components/portal/PortalDashboardChecklist.vue';
import { formatPlatformGreeting, getLocalTimeOfDay } from '@/utils/platformHomeGreeting';
import { formatRelativeTime } from '@/utils/relativeTime';
import {
  PLATFORM_HOME_ALERT_ERROR_CLASS,
  PLATFORM_HOME_CARD_CLASS,
  PLATFORM_HOME_CARD_HEADER_DIVIDER_CLASS,
  PLATFORM_HOME_FLAT_CHIP_CLASS,
  PLATFORM_HOME_INSET_CONTROL_CLASS,
  PLATFORM_HOME_INTENT_GRADIENT_CLASS,
  PLATFORM_HOME_LIST_SCROLL_CLASS,
  PLATFORM_HOME_PRIMARY_BUTTON_CLASS,
  PLATFORM_HOME_SKELETON_CLASS
} from '@/utils/platformHomeLayout';
import {
  capturePortalDashboardEmptyStateCtaClicked,
  capturePortalDashboardQuickLinkClicked,
  capturePortalDashboardStatClicked,
  capturePortalDashboardCaseOpened,
  capturePortalDashboardViewed,
  capturePortalDashboardChecklistDismissed,
  capturePortalDashboardChecklistStepClicked,
  capturePortalDashboardSuggestedArticleClicked
} from '@/config/posthogPortal';

const CHECKLIST_DISMISS_KEY = 'arivu:portal-getting-started-dismissed';
const CHECKLIST_STEP_PREFIX = 'arivu:portal-checklist-step';

const DEFAULT_WIDGETS = {
  cases: false,
  knowledge: false,
  invoices: false,
  deals: false,
  forms: false,
  responses: false,
  organization: false,
  people: false,
  audits: false,
  actions: false
};

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();

const loading = ref(true);
const error = ref(null);
const canCreateCase = ref(false);
const widgets = ref({ ...DEFAULT_WIDGETS });
const stats = ref({
  openCases: 0,
  totalCases: 0,
  openInvoices: 0,
  awaitingCustomerReply: 0,
  openAudits: 0,
  openActions: 0,
  totalAudits: 0,
  openDeals: 0,
  totalDeals: 0,
  availableForms: 0,
  totalResponses: 0,
  inProgressResponses: 0
});
const recentCases = ref([]);
const recentInvoices = ref([]);
const recentAudits = ref([]);
const suggestedArticles = ref([]);
const checklistDismissed = ref(false);
const checklistProgressVersion = ref(0);

function resolveChecklistUserId() {
  return String(authStore.user?._id || authStore.user?.id || 'anonymous');
}

function checklistDismissStorageKey() {
  return `${CHECKLIST_DISMISS_KEY}:${resolveChecklistUserId()}`;
}

function checklistStepStorageKey(stepId) {
  return `${CHECKLIST_STEP_PREFIX}:${resolveChecklistUserId()}:${stepId}`;
}

function isChecklistStepDone(stepId) {
  void checklistProgressVersion.value;
  try {
    return localStorage.getItem(checklistStepStorageKey(stepId)) === '1';
  } catch {
    return false;
  }
}

function markChecklistStepDone(stepId) {
  try {
    localStorage.setItem(checklistStepStorageKey(stepId), '1');
    checklistProgressVersion.value += 1;
  } catch {
    /* ignore */
  }
}

function loadChecklistDismissed() {
  try {
    checklistDismissed.value = localStorage.getItem(checklistDismissStorageKey()) === '1';
  } catch {
    checklistDismissed.value = false;
  }
}

const greetingTitle = computed(() => {
  const user = authStore.user;
  const fallbackName = user?.firstName || user?.email?.split('@')[0] || '';
  return formatPlatformGreeting(null, t, fallbackName, getLocalTimeOfDay());
});

const dashboardSubtitle = computed(() => {
  if (widgets.value.audits && !widgets.value.cases) {
    return t('cases.portalDashboardSubtitleAuditor');
  }
  return t('cases.portalDashboardSubtitle');
});

const showIntentActions = computed(() =>
  (widgets.value.knowledge || (widgets.value.cases && canCreateCase.value))
);

const checklistTitle = computed(() => {
  if (widgets.value.audits && !widgets.value.cases) {
    return t('cases.portalDashboardChecklistTitleAuditor');
  }
  return t('cases.portalDashboardChecklistTitle');
});

const gettingStartedSteps = computed(() => {
  if (widgets.value.audits && !widgets.value.cases) {
    const steps = [
      {
        id: 'view_audits',
        label: t('cases.portalDashboardChecklistViewAudits'),
        route: '/portal/audits',
        completed: stats.value.totalAudits > 0
      }
    ];
    if (widgets.value.actions) {
      steps.push({
        id: 'review_actions',
        label: t('cases.portalDashboardChecklistReviewActions'),
        route: '/portal/actions',
        completed: isChecklistStepDone('review_actions') || stats.value.openActions > 0
      });
    }
    return steps;
  }

  if (!widgets.value.cases) return [];

  const steps = [];
  if (canCreateCase.value) {
    steps.push({
      id: 'create_case',
      label: t('cases.portalDashboardChecklistCreateCase'),
      route: { name: 'portal-case-list', query: { create: '1' } },
      completed: stats.value.totalCases > 0
    });
  }
  if (widgets.value.knowledge) {
    steps.push({
      id: 'browse_help',
      label: t('cases.portalDashboardChecklistBrowseHelp'),
      route: '/portal/knowledge',
      completed: isChecklistStepDone('browse_help')
    });
  }
  if (widgets.value.invoices) {
    steps.push({
      id: 'view_invoices',
      label: t('cases.portalDashboardChecklistViewInvoices'),
      route: '/portal/invoices',
      completed: isChecklistStepDone('view_invoices') || stats.value.openInvoices > 0
    });
  }
  return steps;
});

const showGettingStartedChecklist = computed(() => {
  if (checklistDismissed.value) return false;
  if (!gettingStartedSteps.value.length) return false;
  return gettingStartedSteps.value.some((step) => !step.completed);
});

const briefSignals = computed(() => {
  const signals = [];
  if (widgets.value.cases && stats.value.awaitingCustomerReply > 0) {
    signals.push({
      id: 'awaiting_reply',
      text: t('cases.portalDashboardSignalAwaitingReply', stats.value.awaitingCustomerReply, { count: stats.value.awaitingCustomerReply }),
      route: '/portal/cases',
      severity: 'danger'
    });
  }
  if (widgets.value.cases && stats.value.openCases > 0) {
    signals.push({
      id: 'open_cases',
      text: t('cases.portalDashboardSignalOpenCases', stats.value.openCases, { count: stats.value.openCases }),
      route: '/portal/cases',
      severity: stats.value.openCases > 3 ? 'warning' : 'info'
    });
  }
  if (widgets.value.invoices && stats.value.openInvoices > 0) {
    signals.push({
      id: 'open_invoices',
      text: t('cases.portalDashboardSignalOpenInvoices', stats.value.openInvoices, { count: stats.value.openInvoices }),
      route: '/portal/invoices',
      severity: 'warning'
    });
  }
  if (widgets.value.audits && stats.value.openAudits > 0) {
    signals.push({
      id: 'open_audits',
      text: t('cases.portalDashboardSignalOpenAudits', stats.value.openAudits, { count: stats.value.openAudits }),
      route: '/portal/audits',
      severity: 'info'
    });
  }
  if (widgets.value.actions && stats.value.openActions > 0) {
    signals.push({
      id: 'open_actions',
      text: t('cases.portalDashboardSignalOpenActions', stats.value.openActions, { count: stats.value.openActions }),
      route: '/portal/actions',
      severity: 'warning'
    });
  }
  if (widgets.value.responses && stats.value.inProgressResponses > 0) {
    signals.push({
      id: 'in_progress_responses',
      text: t('cases.portalDashboardSignalInProgressResponses', stats.value.inProgressResponses, {
        count: stats.value.inProgressResponses
      }),
      route: '/portal/responses',
      severity: 'info'
    });
  }
  if (widgets.value.deals && stats.value.openDeals > 0) {
    signals.push({
      id: 'open_deals',
      text: t('cases.portalDashboardSignalOpenDeals', stats.value.openDeals, { count: stats.value.openDeals }),
      route: '/portal/deals',
      severity: 'info'
    });
  }
  return signals;
});

const statCards = computed(() => {
  const cards = [];

  if (widgets.value.cases) {
    cards.push(
      {
        id: 'open_cases',
        route: '/portal/cases',
        value: stats.value.openCases,
        label: t('cases.portalDashboardOpenCases'),
        showClearState: stats.value.openCases === 0,
        clearLabel: t('cases.portalDashboardOpenCasesClear')
      },
      {
        id: 'total_cases',
        route: '/portal/cases',
        value: stats.value.totalCases,
        label: t('cases.portalDashboardTotalCases'),
        showClearState: false,
        clearLabel: ''
      }
    );
  }

  if (widgets.value.invoices) {
    cards.push({
      id: 'open_invoices',
      route: '/portal/invoices',
      value: stats.value.openInvoices,
      label: t('cases.portalDashboardOpenInvoices'),
      showClearState: stats.value.openInvoices === 0,
      clearLabel: t('cases.portalDashboardOpenInvoicesClear')
    });
  }

  if (widgets.value.audits) {
    cards.push({
      id: 'open_audits',
      route: '/portal/audits',
      value: stats.value.openAudits,
      label: t('cases.portalDashboardOpenAudits'),
      showClearState: stats.value.openAudits === 0,
      clearLabel: t('cases.portalDashboardOpenAuditsClear')
    });
  }

  if (widgets.value.actions) {
    cards.push({
      id: 'open_actions',
      route: '/portal/actions',
      value: stats.value.openActions,
      label: t('cases.portalDashboardOpenActions'),
      showClearState: stats.value.openActions === 0,
      clearLabel: t('cases.portalDashboardOpenActionsClear')
    });
  }

  if (widgets.value.deals) {
    cards.push({
      id: 'open_deals',
      route: '/portal/deals',
      value: stats.value.openDeals,
      label: t('cases.portalDashboardOpenDeals'),
      showClearState: stats.value.openDeals === 0,
      clearLabel: t('cases.portalDashboardOpenDealsClear')
    });
  }

  if (widgets.value.forms) {
    cards.push({
      id: 'available_forms',
      route: '/portal/forms',
      value: stats.value.availableForms,
      label: t('cases.portalDashboardAvailableForms'),
      showClearState: stats.value.availableForms === 0,
      clearLabel: t('cases.portalDashboardAvailableFormsClear')
    });
  }

  if (widgets.value.responses) {
    cards.push({
      id: 'in_progress_responses',
      route: '/portal/responses',
      value: stats.value.inProgressResponses,
      label: t('cases.portalDashboardInProgressResponses'),
      showClearState: stats.value.inProgressResponses === 0,
      clearLabel: t('cases.portalDashboardInProgressResponsesClear')
    });
  }

  return cards.slice(0, 3);
});

const quickLinks = computed(() => {
  const links = [];
  if (widgets.value.cases) {
    links.push({
      id: 'support',
      route: '/portal/cases',
      icon: LifebuoyIcon,
      title: t('cases.portalCasesSupport'),
      hint: t('cases.portalDashboardSupportHint')
    });
  }
  if (widgets.value.invoices) {
    links.push({
      id: 'invoices',
      route: '/portal/invoices',
      icon: DocumentTextIcon,
      title: t('cases.portalDashboardInvoicesLink'),
      hint: t('cases.portalDashboardInvoicesHint')
    });
  }
  if (widgets.value.knowledge) {
    links.push({
      id: 'knowledge',
      route: '/portal/knowledge',
      icon: BookOpenIcon,
      title: t('cases.portalDashboardKnowledgeLink'),
      hint: t('cases.portalDashboardKnowledgeHint')
    });
  }
  if (widgets.value.audits) {
    links.push({
      id: 'audits',
      route: '/portal/audits',
      icon: ShieldCheckIcon,
      title: t('cases.portalDashboardAuditsLink'),
      hint: t('cases.portalDashboardAuditsHint')
    });
  }
  if (widgets.value.actions) {
    links.push({
      id: 'actions',
      route: '/portal/actions',
      icon: ClipboardDocumentCheckIcon,
      title: t('cases.portalDashboardActionsLink'),
      hint: t('cases.portalDashboardActionsHint')
    });
  }
  if (widgets.value.forms) {
    links.push({
      id: 'forms',
      route: '/portal/forms',
      icon: ClipboardDocumentListIcon,
      title: t('navigation.portalForms'),
      hint: t('records.portalFormsHint')
    });
  }
  if (widgets.value.responses) {
    links.push({
      id: 'responses',
      route: '/portal/responses',
      icon: ClipboardDocumentListIcon,
      title: t('navigation.portalResponses'),
      hint: t('records.portalResponsesHint')
    });
  }
  if (widgets.value.deals) {
    links.push({
      id: 'deals',
      route: '/portal/deals',
      icon: BriefcaseIcon,
      title: t('navigation.portalDeals'),
      hint: t('records.portalDealsHint')
    });
  }
  if (widgets.value.organization) {
    links.push({
      id: 'organization',
      route: '/portal/organization',
      icon: BuildingOfficeIcon,
      title: t('navigation.portalOrganization'),
      hint: t('records.portalOrganizationHint')
    });
  }
  if (widgets.value.people) {
    links.push({
      id: 'people',
      route: '/portal/people',
      icon: UserIcon,
      title: t('navigation.portalPeople'),
      hint: t('records.portalPeopleHint')
    });
  }
  return links.slice(0, 3);
});

function signalChipClass(severity) {
  switch (severity) {
    case 'danger':
      return [
        'border-danger-200/80 bg-danger-50 text-danger-900 hover:bg-danger-100',
        'dark:border-danger-600 dark:bg-danger-900/35 dark:text-danger-200 dark:hover:bg-danger-900/55'
      ].join(' ');
    case 'warning':
      return [
        'border-warning-200/80 bg-warning-50 text-warning-900 hover:bg-warning-100',
        'dark:border-warning-600 dark:bg-warning-900/35 dark:text-warning-200 dark:hover:bg-warning-900/55'
      ].join(' ');
    default:
      return [
        'border-secondary-200/80 bg-secondary-50 text-secondary-900 hover:bg-secondary-100',
        'dark:border-secondary-600 dark:bg-secondary-900/35 dark:text-secondary-200 dark:hover:bg-secondary-900/55'
      ].join(' ');
  }
}

function signalDotClass(severity) {
  switch (severity) {
    case 'danger':
      return 'bg-danger-500 dark:bg-danger-400';
    case 'warning':
      return 'bg-warning-500 dark:bg-warning-400';
    default:
      return 'bg-secondary-500 dark:bg-secondary-400';
  }
}

function statusClass(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'closed' || s === 'resolved') {
    return 'bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-400';
  }
  if (s === 'new') return 'bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-400';
  return 'bg-warning-100 text-warning-800 dark:bg-warning-900/30 dark:text-warning-400';
}

function auditStatusClass(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'closed') {
    return 'bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-400';
  }
  return 'bg-warning-100 text-warning-800 dark:bg-warning-900/30 dark:text-warning-400';
}

function relativeTime(dateString) {
  return formatRelativeTime(dateString, t);
}

function formatMoney(amount, currency = 'USD') {
  return formatCurrencyValue(amount, { currencyCode: currency || undefined }) ?? '—';
}

function formatDueDate(value) {
  if (!value) return '';
  return t('cases.portalDashboardDueDate', {
    date: formatUserDate(value)
  });
}

function openHelpSearch() {
  router.push('/portal/knowledge');
}

function openCase(caseId) {
  if (!caseId) return;
  capturePortalDashboardCaseOpened();
  router.push(`/portal/cases/${caseId}`);
}

function openAudit(eventId) {
  if (!eventId) return;
  capturePortalDashboardQuickLinkClicked('recent_audit');
  router.push(`/portal/audits/${eventId}`);
}

function dismissChecklist() {
  checklistDismissed.value = true;
  try {
    localStorage.setItem(checklistDismissStorageKey(), '1');
  } catch {
    /* ignore */
  }
  capturePortalDashboardChecklistDismissed();
}

function handleChecklistStepClick(stepId) {
  capturePortalDashboardChecklistStepClicked(stepId);
  if (stepId === 'browse_help' || stepId === 'view_invoices' || stepId === 'review_actions') {
    markChecklistStepDone(stepId);
  }
}

function openSuggestedArticle(articleId) {
  if (!articleId) return;
  markChecklistStepDone('browse_help');
  capturePortalDashboardSuggestedArticleClicked(String(articleId));
}

async function loadPortalCapabilities() {
  try {
    const res = await portalApiClient.get('/me');
    const mailroomAllowsCreate = res.success && res.data?.portalCapabilities
      ? res.data.portalCapabilities.allowCreateCase === true
      : false;
    canCreateCase.value = mailroomAllowsCreate && authStore.can('cases', 'create');
  } catch {
    canCreateCase.value = authStore.can('cases', 'create');
  }
}

const fetchDashboardData = async () => {
  loading.value = true;
  error.value = null;

  try {
    const data = await portalApiClient.get('/portal/dashboard');
    if (data.success && data.data) {
      widgets.value = { ...DEFAULT_WIDGETS, ...(data.data.widgets || {}) };
      stats.value = {
        openCases: data.data.openCases || 0,
        totalCases: data.data.totalCases || 0,
        openInvoices: data.data.openInvoices || 0,
        awaitingCustomerReply: data.data.awaitingCustomerReply || 0,
        openAudits: data.data.openAudits || 0,
        openActions: data.data.openActions || 0,
        totalAudits: data.data.totalAudits || 0,
        openDeals: data.data.openDeals || 0,
        totalDeals: data.data.totalDeals || 0,
        availableForms: data.data.availableForms || 0,
        totalResponses: data.data.totalResponses || 0,
        inProgressResponses: data.data.inProgressResponses || 0
      };
      recentCases.value = Array.isArray(data.data.recentCases) ? data.data.recentCases : [];
      recentInvoices.value = Array.isArray(data.data.recentInvoices) ? data.data.recentInvoices : [];
      recentAudits.value = Array.isArray(data.data.recentAudits) ? data.data.recentAudits : [];
      suggestedArticles.value = Array.isArray(data.data.suggestedArticles)
        ? data.data.suggestedArticles
        : [];
    }
  } catch (err) {
    console.error('Error fetching portal dashboard:', err);
    if (err.response?.data?.message) {
      error.value = err.response.data.message;
    } else if (err.status === 403) {
      error.value = t('cases.portalCasesAccessDenied');
    } else {
      error.value = err.message || t('cases.portalDashboardLoadFailed');
    }
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  loadChecklistDismissed();
  capturePortalDashboardViewed();
  await Promise.all([loadPortalCapabilities(), fetchDashboardData()]);
});
</script>

<style scoped>
.portal-dashboard-enter {
  animation: portal-dashboard-fade-in 0.45s ease-out both;
}

@keyframes portal-dashboard-fade-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .portal-dashboard-enter {
    animation: none;
  }
}
</style>
