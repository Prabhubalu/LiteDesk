<template>
  <nav class="mb-6 flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700 pb-3">
    <RouterLink
      v-for="item in items"
      :key="item.to"
      :to="item.to"
      class="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
      :class="isActive(item)
        ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'"
    >
      {{ item.label }}
    </RouterLink>
  </nav>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';

const { t } = useI18n();
const route = useRoute();

const items = computed(() => [
  { to: { name: 'templates' }, label: t('templates.navTemplates'), match: ['templates', 'template-detail'] },
  { to: { name: 'content-themes' }, label: t('templates.navThemes'), match: ['content-themes', 'content-theme-detail'] },
  { to: { name: 'content-assets' }, label: t('templates.navAssets'), match: ['content-assets'] },
  {
    to: { name: 'email-merge-mappings' },
    label: t('templates.navMergeMappings'),
    match: ['email-merge-mappings']
  }
]);

function isActive(item) {
  const name = route.name;
  if (item.match.includes(name)) return true;
  if (name === 'template-detail' && item.match.includes('template-detail')) return true;
  return false;
}
</script>
