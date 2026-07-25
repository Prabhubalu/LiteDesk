<template>
  <SettingsScrollPanel v-if="currentView === 'overview'">
    <template #header>
      <div>
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('settings.tabAutomation') }}</h2>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {{ t('settings.automationHubDesc') }}
        </p>
      </div>
    </template>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <button
          v-for="option in automationOptions"
          :key="option.id"
          type="button"
          class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md hover:border-indigo-500 dark:hover:border-indigo-400 transition-all cursor-pointer group text-left"
          @click="navigateToOption(option)"
        >
          <div class="flex items-start gap-4">
            <div
              class="flex items-center justify-center w-12 h-12 rounded-lg flex-shrink-0 group-hover:scale-105 transition-transform"
              :class="option.iconBg"
            >
              <component :is="option.icon" class="w-6 h-6 text-white" />
            </div>
            <div class="flex-1 min-w-0">
              <h4 class="text-base font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors mb-1">
                {{ t(option.nameKey) }}
              </h4>
              <p class="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
                {{ t(option.descriptionKey) }}
              </p>
            </div>
          </div>
        </button>
      </div>
  </SettingsScrollPanel>

  <AssignmentRulesSettings
    v-else-if="currentView === 'assignment-rules'"
    class="flex min-h-0 flex-1 flex-col overflow-hidden"
  />
  <HelpdeskExecutionSettings
    v-else-if="currentView === 'sla'"
    class="flex min-h-0 flex-1 flex-col overflow-hidden"
  />
  <SlaPolicyHub
    v-else-if="currentView === 'sla-policies'"
    class="flex min-h-0 flex-1 flex-col overflow-hidden"
    @back="navigateToOverview"
  />
  <MailroomSettings v-else-if="currentView === 'mailroom'" class="flex min-h-0 flex-1 flex-col overflow-hidden" />
  <QuotesSettings v-else-if="currentView === 'quotes'" class="flex min-h-0 flex-1 flex-col overflow-hidden" @back="navigateToOverview" />
  <ModuleNumberingSettings
    v-else-if="currentView === 'module-numbering'"
    class="flex min-h-0 flex-1 flex-col overflow-hidden"
    @back="navigateToOverview"
  />
</template>

<script setup>
import { computed, watch, h } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import SettingsScrollPanel from '@/components/settings/SettingsScrollPanel.vue';
import AssignmentRulesSettings from '@/components/settings/AssignmentRulesSettings.vue';
import HelpdeskExecutionSettings from '@/components/settings/HelpdeskExecutionSettings.vue';
import SlaPolicyHub from '@/components/settings/sla/SlaPolicyHub.vue';

const { t } = useI18n();
import MailroomSettings from '@/components/settings/MailroomSettings.vue';
import QuotesSettings from '@/components/settings/QuotesSettings.vue';
import ModuleNumberingSettings from '@/components/settings/ModuleNumberingSettings.vue';
import { getModuleIconComponent } from '@/utils/moduleIcons';

const route = useRoute();
const router = useRouter();

const SlaIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg',
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  }),
]);

const AssignmentRulesIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg',
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
  }),
]);

const AutomationRulesIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg',
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
  }),
]);

const ProcessesIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg',
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  }),
]);

const MailroomIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg',
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  }),
]);

const BusinessFlowsIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg',
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M13 10V3L4 14h7v7l9-11h-7z',
  }),
]);

const QuotesIcon = getModuleIconComponent('quotes');

const ModuleNumberingIcon = () => h('svg', {
  fill: 'none',
  stroke: 'currentColor',
  viewBox: '0 0 24 24',
  xmlns: 'http://www.w3.org/2000/svg',
}, [
  h('path', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': '2',
    d: 'M7 20l4-16m2 16l4-16M6 9h14M4 15h14',
  }),
]);

const automationOptions = [
  {
    id: 'assignment-rules',
    nameKey: 'settings.automationAssignmentRules',
    descriptionKey: 'settings.automationAssignmentRulesDesc',
    icon: AssignmentRulesIcon,
    iconBg: 'bg-gradient-to-br from-indigo-500 to-indigo-600',
    inShell: true,
  },
  {
    id: 'sla-policies',
    nameKey: 'settings.automationSlaPolicies',
    descriptionKey: 'settings.automationSlaPoliciesDesc',
    icon: SlaIcon,
    iconBg: 'bg-gradient-to-br from-violet-500 to-violet-600',
    inShell: true,
  },
  {
    id: 'sla',
    nameKey: 'settings.automationSla',
    descriptionKey: 'settings.automationSlaDesc',
    icon: SlaIcon,
    iconBg: 'bg-gradient-to-br from-rose-500 to-rose-600',
    inShell: true,
  },
  {
    id: 'mailroom',
    nameKey: 'settings.automationMailroom',
    descriptionKey: 'settings.automationMailroomDesc',
    icon: MailroomIcon,
    iconBg: 'bg-gradient-to-br from-sky-500 to-sky-600',
    inShell: true,
  },
  {
    id: 'quotes',
    nameKey: 'settings.automationQuotes',
    descriptionKey: 'settings.automationQuotesDesc',
    icon: QuotesIcon,
    iconBg: 'bg-gradient-to-br from-teal-500 to-teal-600',
    inShell: true,
  },
  {
    id: 'module-numbering',
    nameKey: 'settings.automationModuleNumbering',
    descriptionKey: 'settings.automationModuleNumberingDesc',
    icon: ModuleNumberingIcon,
    iconBg: 'bg-gradient-to-br from-slate-500 to-slate-700',
    inShell: true,
  },
  {
    id: 'automation-rules',
    nameKey: 'settings.automationRules',
    descriptionKey: 'settings.automationRulesDesc',
    icon: AutomationRulesIcon,
    iconBg: 'bg-gradient-to-br from-purple-500 to-purple-600',
    route: '/settings/automation/automation-rules',
  },
  {
    id: 'processes',
    nameKey: 'settings.automationProcesses',
    descriptionKey: 'settings.automationProcessesDesc',
    icon: ProcessesIcon,
    iconBg: 'bg-gradient-to-br from-green-500 to-green-600',
    route: '/settings/automation/processes',
  },
  {
    id: 'business-flows',
    nameKey: 'settings.automationBusinessFlows',
    descriptionKey: 'settings.automationBusinessFlowsDesc',
    icon: BusinessFlowsIcon,
    iconBg: 'bg-gradient-to-br from-orange-500 to-orange-600',
    route: '/settings/automation/flows',
  },
];

const currentView = computed(() => {
  const view = route.query.automationView;
  if (view === 'assignment-rules') return 'assignment-rules';
  if (view === 'sla-policies') return 'sla-policies';
  if (view === 'sla') return 'sla';
  if (view === 'mailroom') return 'mailroom';
  if (view === 'quotes') return 'quotes';
  if (view === 'module-numbering') return 'module-numbering';
  if (route.query.assignmentApp) return 'assignment-rules';
  return 'overview';
});

function navigateToOverview() {
  const query = { ...route.query, tab: 'automation' };
  delete query.automationView;
  router.push({ path: '/settings', query });
}

function navigateToOption(option) {
  if (option.inShell) {
    router.push({
      path: '/settings',
      query: { ...route.query, tab: 'automation', automationView: option.id },
    });
    return;
  }
  if (option.route) {
    router.push(option.route);
  }
}

watch(
  () => [route.query.tab, route.query.assignmentApp, route.query.automationView],
  () => {
    if (route.query.tab !== 'automation') return;
    if (route.query.assignmentApp && route.query.automationView !== 'assignment-rules') {
      router.replace({
        path: '/settings',
        query: { ...route.query, tab: 'automation', automationView: 'assignment-rules' },
      });
    }
  },
  { immediate: true },
);
</script>
