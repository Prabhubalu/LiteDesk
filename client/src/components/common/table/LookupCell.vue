<template>
  <button
    v-if="isLinkable"
    type="button"
    class="block min-w-0 max-w-full truncate text-left text-sm text-gray-700 transition-colors group-hover:text-primary-600 dark:text-gray-200 dark:group-hover:text-primary-400"
    :title="displayLabel"
    @click.stop="handleClick"
  >
    {{ displayLabel }}
  </button>
  <span
    v-else-if="displayLabel"
    class="block min-w-0 max-w-full truncate text-sm text-gray-700 dark:text-gray-200"
    :title="displayLabel"
  >
    {{ displayLabel }}
  </span>
  <span v-else class="text-sm text-gray-400 dark:text-gray-500">{{ emptyLabel }}</span>
</template>

<script setup>
import { computed } from 'vue';
import { useTabs } from '@/composables/useTabs';
import { getRecordLabel } from '@/utils/recordDisplay';
import { getModuleIcon } from '@/utils/tabNavigation';

const props = defineProps({
  value: {
    type: [Object, String, Number],
    default: null,
  },
  /** Module key for path building, e.g. organizations, people, deals */
  targetModule: {
    type: String,
    default: '',
  },
  /** Explicit route path; overrides targetModule + id */
  recordPath: {
    type: String,
    default: '',
  },
  emptyLabel: {
    type: String,
    default: '-',
  },
});

const { openTab } = useTabs();

const recordId = computed(() => {
  const value = props.value;
  if (value == null || value === '') return null;
  if (typeof value === 'object') {
    const id = value._id ?? value.id;
    return id != null ? String(id) : null;
  }
  return String(value);
});

const displayLabel = computed(() => {
  const value = props.value;
  if (value == null || value === '') return null;
  if (typeof value === 'object') return getRecordLabel(value);
  return String(value);
});

const resolvedPath = computed(() => {
  if (props.recordPath) return props.recordPath;
  const id = recordId.value;
  const moduleKey = String(props.targetModule || '').trim().toLowerCase();
  if (!id || !moduleKey) return null;

  const routeByModule = {
    organizations: `/organizations/${id}`,
    organization: `/organizations/${id}`,
    people: `/people/${id}`,
    deals: `/deals/${id}`,
    tasks: `/tasks/${id}`,
    events: `/events/${id}`,
    items: `/items/${id}`,
    quotes: `/quotes/${id}`,
    cases: `/helpdesk/cases/${id}`,
  };

  return routeByModule[moduleKey] || `/${moduleKey}/${id}`;
});

const isLinkable = computed(() => !!(recordId.value && resolvedPath.value && displayLabel.value));

function handleClick(event) {
  if (!isLinkable.value) return;

  const openInBackground = event && (
    event.button === 1 ||
    event.metaKey ||
    event.ctrlKey
  );

  openTab(resolvedPath.value, {
    title: displayLabel.value,
    icon: getModuleIcon(resolvedPath.value),
    background: openInBackground,
    insertAdjacent: true,
  });
}
</script>
