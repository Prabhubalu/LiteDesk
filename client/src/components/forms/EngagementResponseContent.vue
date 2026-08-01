<template>
  <div class="space-y-6">
    <div
      class="grid grid-cols-1 gap-4"
      :class="kpiColumnClass"
    >
      <div class="rounded-xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-5 shadow-sm dark:border-gray-700 dark:from-gray-800 dark:to-gray-800/80">
        <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">{{ t('forms.hubExecutionSubmitted') }}</h3>
        <p class="mt-2 text-lg font-semibold text-gray-900 dark:text-white">
          {{ response.submittedAt ? formatDate(response.submittedAt) : '—' }}
        </p>
        <p v-if="submittedByLabel" class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ submittedByLabel }}</p>
      </div>

      <div
        v-if="avgRating != null"
        class="rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm dark:border-amber-900/40 dark:from-amber-950/30 dark:to-gray-800/80"
      >
        <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">{{ t('forms.previewMetricAverageRating') }}</h3>
        <div class="mt-2 flex items-center gap-3">
          <div class="flex gap-0.5" aria-hidden="true">
            <svg
              v-for="star in 5"
              :key="star"
              class="h-5 w-5"
              :class="star <= Math.round(avgRating) ? 'text-amber-400' : 'text-gray-200 dark:text-gray-600'"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </div>
          <span class="text-2xl font-bold text-gray-900 dark:text-white">{{ avgRating }}</span>
          <span class="text-sm text-gray-500 dark:text-gray-400">/ 5</span>
        </div>
      </div>

      <div
        v-if="isFeedback && satisfactionPercentage != null"
        class="rounded-xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm dark:border-emerald-900/40 dark:from-emerald-950/30 dark:to-gray-800/80"
      >
        <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">{{ t('forms.settingsKpiSatisfaction') }}</h3>
        <p class="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{{ satisfactionPercentage }}%</p>
      </div>

      <div
        v-else
        class="rounded-xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50 to-white p-5 shadow-sm dark:border-indigo-900/40 dark:from-indigo-950/30 dark:to-gray-800/80"
      >
        <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400">{{ t('forms.hubEngagementResponseProgress') }}</h3>
        <p class="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
          {{ t('forms.hubEngagementResponseQuestionsAnswered', { answered: answeredCount, total: totalQuestionCount }) }}
        </p>
      </div>
    </div>

    <div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div class="border-b border-gray-200 px-6 py-5 dark:border-gray-700">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('forms.hubEngagementAnswersTitle') }}</h2>
        <p v-if="form.description" class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ form.description }}</p>
      </div>

      <div v-if="sectionsNavigation.length > 1" class="border-b border-gray-200 px-6 py-4 lg:hidden dark:border-gray-700">
        <select
          v-model="selectedSectionId"
          class="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          @change="scrollToSection(selectedSectionId)"
        >
          <option value="" disabled>{{ t('forms.hubResponseDetailJumpToSection') }}</option>
          <template v-for="item in sectionsNavigation" :key="item.id">
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

      <div class="flex gap-0">
        <aside
          v-if="sectionsNavigation.length > 1"
          class="hidden w-56 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 lg:block"
        >
          <div class="sticky top-0 p-5">
            <nav>
              <h3 class="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {{ t('forms.hubResponseDetailSectionsNav') }}
              </h3>
              <ul class="space-y-1">
                <li v-for="item in sectionsNavigation" :key="item.id">
                  <a
                    :href="`#${item.id}`"
                    :class="navLinkClass(activeSectionId === item.id)"
                    @click.prevent="scrollToSection(item.id)"
                  >
                    {{ item.label }}
                  </a>
                  <ul v-if="item.subsections?.length" class="ml-3 mt-1 space-y-1">
                    <li v-for="subItem in item.subsections" :key="subItem.id">
                      <a
                        :href="`#${subItem.id}`"
                        :class="navLinkClass(activeSectionId === subItem.id, true)"
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
          <div class="space-y-8 p-6">
            <div
              v-for="(section, sIndex) in visibleSections"
              :key="section.sectionId || sIndex"
              :id="`section-${section.sectionId || sIndex}`"
              class="scroll-mt-24 space-y-5"
            >
              <div
                v-if="shouldShowEngagementSectionTitle(form, section)"
                class="border-b border-gray-200 pb-2 dark:border-gray-700"
              >
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ section.name }}</h3>
              </div>

              <div v-if="section.questions?.length" class="space-y-4">
                <article
                  v-for="(question, qIndex) in section.questions"
                  :key="question.questionId || qIndex"
                  class="rounded-xl border border-gray-200 bg-gray-50/80 p-5 dark:border-gray-700 dark:bg-gray-900/40"
                >
                  <EngagementResponseAnswerCard
                    :question="question"
                    :response-detail="getQuestionResponse(question.questionId)"
                  />
                </article>
              </div>

              <div
                v-for="(subsection, subIndex) in section.subsections"
                :key="subsection.subsectionId || subIndex"
                :id="`subsection-${subsection.subsectionId || subIndex}`"
                class="scroll-mt-24 space-y-4"
              >
                <h4
                  v-if="shouldShowEngagementSubsectionTitle(form, section, subsection)"
                  class="text-base font-medium text-gray-800 dark:text-gray-200"
                >
                  {{ subsection.name }}
                </h4>

                <article
                  v-for="(question, qIndex) in (subsection.questions || [])"
                  :key="question.questionId || qIndex"
                  class="rounded-xl border border-gray-200 bg-gray-50/80 p-5 dark:border-gray-700 dark:bg-gray-900/40"
                >
                  <EngagementResponseAnswerCard
                    :question="question"
                    :response-detail="getQuestionResponse(question.questionId)"
                  />
                </article>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { formatUserDateTime } from '@/utils/localeFormat';
import { useI18n } from 'vue-i18n';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import EngagementResponseAnswerCard from '@/components/forms/EngagementResponseAnswerCard.vue';
import {
  buildEngagementResponseNavigation,
  forEachFormQuestion,
  getVisibleFormSections,
  shouldShowEngagementSectionTitle,
  shouldShowEngagementSubsectionTitle
} from '@/utils/engagementFormDisplay';

const props = defineProps({
  form: { type: Object, required: true },
  response: { type: Object, required: true }
});

const { t } = useI18n();

const activeSectionId = ref('');
const selectedSectionId = ref('');
const observer = ref(null);

const visibleSections = computed(() => getVisibleFormSections(props.form?.sections || []));
const sectionsNavigation = computed(() => buildEngagementResponseNavigation(props.form));
const isFeedback = computed(() => String(props.form?.formType || '').toLowerCase() === 'feedback');

const avgRating = computed(() => {
  const kpis = props.response?.kpis;
  if (!kpis) return null;
  const value = kpis.avgRating ?? kpis.rating;
  if (value == null || value === 0) {
    const hasRatingAnswer = (props.response?.responseDetails || []).some((detail) => {
      const rating = parseFloat(detail.answer);
      return !Number.isNaN(rating) && rating > 0;
    });
    if (!hasRatingAnswer) return null;
  }
  return typeof value === 'number' ? value : parseFloat(value) || null;
});

const satisfactionPercentage = computed(() => {
  const value = props.response?.kpis?.satisfactionPercentage;
  return typeof value === 'number' ? value : null;
});

const totalQuestionCount = computed(() => {
  let count = 0;
  forEachFormQuestion(props.form?.sections, () => { count += 1; });
  return count;
});

const answeredCount = computed(() => {
  const details = props.response?.responseDetails || [];
  return details.filter((detail) => {
    const answer = detail?.answer;
    if (answer === null || answer === undefined || answer === '') return false;
    if (Array.isArray(answer) && answer.length === 0) return false;
    return true;
  }).length;
});

const submittedByLabel = computed(() => {
  const user = props.response?.submittedBy;
  if (!user) return null;
  if (typeof user === 'object') {
    const name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    return name || user.email || null;
  }
  return String(user);
});

const kpiColumnClass = computed(() => {
  const cardCount = 2 + (isFeedback.value && satisfactionPercentage.value != null ? 1 : 0);
  if (cardCount >= 3) return 'md:grid-cols-3';
  return 'md:grid-cols-2';
});

function navLinkClass(active, compact = false) {
  return [
    'block rounded-md transition-colors',
    compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm',
    active
      ? 'bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300'
      : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700/50'
  ];
}

function getQuestionResponse(questionId) {
  if (!props.response?.responseDetails) return null;
  return props.response.responseDetails.find((rd) => rd.questionId === questionId) || null;
}

function formatDate(date) {
  if (!date) return '';
  return formatUserDateTime(date);
}

function scrollToSection(sectionId) {
  if (!sectionId) return;
  const element = document.getElementById(sectionId);
  if (!element) return;

  selectedSectionId.value = sectionId;
  if (observer.value) observer.value.disconnect();
  element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => setupIntersectionObserver(), 800);
}

function setupIntersectionObserver() {
  if (observer.value) observer.value.disconnect();

  const sectionElements = [];
  sectionsNavigation.value.forEach((item) => {
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
}

onMounted(() => {
  nextTick(() => setupIntersectionObserver());
});

watch(
  () => [props.form, props.response],
  () => nextTick(() => setupIntersectionObserver()),
  { deep: true }
);

onUnmounted(() => {
  observer.value?.disconnect();
});
</script>
