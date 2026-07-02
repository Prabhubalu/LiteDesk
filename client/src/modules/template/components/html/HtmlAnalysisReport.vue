<template>
  <section class="space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {{ t('templates.htmlImport.analysisTitle') }}
      </h3>
      <button
        v-if="result.warnings.length"
        type="button"
        class="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
        @click="expanded = !expanded"
      >
        {{ expanded ? t('templates.htmlImport.collapseDetails') : t('templates.htmlImport.expandDetails') }}
      </button>
    </div>

    <div class="grid gap-2 sm:grid-cols-2">
      <div
        v-for="item in checkItems"
        :key="item.key"
        class="flex items-start gap-2 rounded-lg border px-3 py-2 text-sm"
        :class="item.pass
          ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200'
          : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200'"
      >
        <component :is="item.pass ? CheckCircleIcon : ExclamationTriangleIcon" class="mt-0.5 h-4 w-4 shrink-0" />
        <span>{{ item.label }}</span>
      </div>
    </div>

    <div v-if="expanded && result.warnings.length" class="rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-950/20">
      <ul class="divide-y divide-amber-100 dark:divide-amber-900/40">
        <li
          v-for="(warning, index) in result.warnings"
          :key="`${warning.type}-${index}`"
          class="px-3 py-2 text-sm text-amber-900 dark:text-amber-100"
        >
          <span class="font-medium">{{ warningLabel(warning.type) }}</span>
          <span class="text-amber-800 dark:text-amber-200/90"> — {{ warning.detail }}</span>
          <span v-if="warning.line" class="text-xs text-amber-700 dark:text-amber-300/80"> ({{ t('templates.htmlImport.lineNumber', { line: warning.line }) }})</span>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/vue/24/outline';

const props = defineProps({
  result: { type: Object, required: true }
});

const { t, te } = useI18n();
const expanded = ref(false);

const checkItems = computed(() => {
  const checks = props.result?.checks || {};
  const counts = props.result?.counts || {};
  return [
    {
      key: 'htmlValid',
      pass: Boolean(checks.htmlValid),
      label: checks.htmlValid
        ? t('templates.htmlImport.checkHtmlValid')
        : t('templates.htmlImport.checkHtmlInvalid')
    },
    {
      key: 'inlineCss',
      pass: Boolean(checks.inlineCssFound),
      label: checks.inlineCssFound
        ? t('templates.htmlImport.checkInlineCss')
        : t('templates.htmlImport.checkNoInlineCss')
    },
    {
      key: 'images',
      pass: Boolean(checks.imagesDetected),
      label: t('templates.htmlImport.checkImages', { count: counts.images || 0 })
    },
    {
      key: 'tables',
      pass: Boolean(checks.tablesDetected),
      label: t('templates.htmlImport.checkTables', { count: counts.tables || 0 })
    },
    {
      key: 'links',
      pass: Boolean(checks.linksFound),
      label: t('templates.htmlImport.checkLinks', { count: counts.links || 0 })
    },
    {
      key: 'mergeTags',
      pass: Boolean(checks.mergeTagsFound),
      label: t('templates.htmlImport.checkMergeTags', { count: counts.mergeTags || 0 })
    }
  ];
});

const HTML_IMPORT_WARNING_KEYS = {
  'javascript-removed': 'templates.htmlImport.warningJavascriptRemoved',
  'external-css-ignored': 'templates.htmlImport.warningExternalCssIgnored',
  'external-css-failed': 'templates.htmlImport.warningExternalCssFailed',
  'external-css': 'templates.htmlImport.warningExternalCss',
  'unsupported-css': 'templates.htmlImport.warningUnsupportedCss',
  'hubspot-conditional': 'templates.htmlImport.warningHubspotConditional',
  'hubspot-conditional-stripped': 'templates.htmlImport.warningHubspotConditionalStripped',
  form: 'templates.htmlImport.warningForm',
};

function warningLabel(type) {
  const key = HTML_IMPORT_WARNING_KEYS[type];
  return key && te(key) ? t(key) : type;
}
</script>
