<template>
  <nav class="mb-6 flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700 pb-3">
    <button
      v-for="item in items"
      :key="item.path"
      type="button"
      class="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
      :class="isActive(item)
        ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'"
      @click="navigate(item)"
    >
      {{ item.label }}
    </button>
  </nav>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { useTabs } from '@/composables/useTabs';

const { t } = useI18n();
const route = useRoute();
const { replaceActiveTab } = useTabs();

const items = computed(() => [
  {
    path: '/templates',
    label: t('templates.navTemplates'),
    match: ['templates', 'template-detail', 'template-builder']
  },
  {
    path: '/content-themes',
    label: t('templates.navThemes'),
    match: ['content-themes', 'content-theme-detail']
  },
  {
    path: '/content-assets',
    label: t('templates.navAssets'),
    match: ['content-assets']
  },
  {
    path: '/templates/email-merge-mappings',
    label: t('templates.navMergeMappings'),
    match: ['email-merge-mappings']
  }
]);

function isActive(item) {
  return item.match.includes(route.name);
}

function navigate(item) {
  const current = String(route.path || '').split('?')[0];
  if (current === item.path) return;
  replaceActiveTab(item.path, { title: item.label });
}
</script>
