<template>
  <section class="space-y-3">
    <h3 v-if="showHeader" class="text-base font-semibold text-gray-900 dark:text-white">{{ t('records.relatedTitle') }}</h3>

    <div
      v-if="!renderGroups.length"
      class="flex flex-col items-center justify-center py-8 text-center"
    >
      <div class="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
        <LinkIcon class="w-5 h-5 text-gray-400 dark:text-gray-500" />
      </div>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">{{ t('records.relatedEmpty') }}</p>
      <p class="text-xs text-gray-400 dark:text-gray-500">{{ t('records.relatedEmptyHint') }}</p>
    </div>

    <div v-else class="space-y-5">
      <details
        v-for="group in renderGroups"
        :key="group.key"
        class="group/related-module"
        open
      >
        <summary class="flex cursor-pointer list-none items-center rounded-lg px-1 py-1 hover:bg-gray-50 dark:hover:bg-gray-800/60 [&::-webkit-details-marker]:hidden [&::marker]:content-['']">
          <div class="flex items-center gap-2">
            <ChevronRightIcon class="h-4 w-4 shrink-0 text-gray-400 transition-transform duration-150 group-open/related-module:rotate-90" />
            <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ group.label }}</h3>
            <span class="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              {{ group.items.length }}
            </span>
          </div>
        </summary>

        <div class="mt-2 space-y-2">
          <div
            v-for="card in group.items"
            :key="card.key"
            class="group/related-card flex items-center gap-3 rounded-xl border border-gray-200/80 dark:border-gray-700 bg-white dark:bg-gray-800/60 px-3 py-2.5 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50/40 dark:hover:bg-indigo-900/20 transition-colors"
          >
            <Avatar
              :size="'md'"
              :user="card.avatarUser"
              :record="card.avatarRecord"
              :icon="card.icon"
              class="shrink-0"
            />

            <button
              type="button"
              class="min-w-0 flex-1 text-left"
              @click="openItem(card.item, card.group)"
            >
              <p class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{{ card.title }}</p>
              <div class="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                <span
                  v-for="(line, lineIdx) in card.lines"
                  :key="lineIdx"
                  class="text-xs truncate max-w-full"
                  :class="line.isEmpty ? 'text-gray-400 dark:text-gray-500' : 'text-gray-500 dark:text-gray-400'"
                >
                  <template v-if="line.label">
                    <span class="text-gray-400 dark:text-gray-500">{{ line.label }}:</span>
                    {{ ' ' }}
                  </template>
                  {{ line.value }}
                </span>
              </div>
            </button>

            <button
              v-if="showUnlink(card.item, card.group)"
              type="button"
              class="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 transition-opacity duration-150 group-hover/related-card:opacity-100 focus:opacity-100"
              :aria-label="t('records.relatedUnlink')"
              @click.stop="handleUnlink(card.item, card.group)"
            >
              <LinkSlashIcon class="h-4 w-4" />
              {{ t('records.relatedUnlink') }}
            </button>
          </div>
        </div>
      </details>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ChevronRightIcon, LinkIcon, LinkSlashIcon } from '@heroicons/vue/24/outline';
import Avatar from '@/components/common/Avatar.vue';
import { getNavigationIconComponent } from '@/utils/navigationIcons';
import {
  fetchRecordsForDisplay,
  getRecordLabel,
  getRelatedRecordDetailLines,
  isRecordEnrichedForDisplay,
  ensureRelatedModuleDefinitions,
  getRelatedModuleDefinition
} from '@/utils/recordDisplay';

const { t } = useI18n();

const props = defineProps({
  record: { type: Object, default: null },
  adapter: { type: Object, default: () => ({}) },
  relatedGroups: { type: Array, default: null },
  contextRevision: { type: Number, default: 0 },
  context: {
    type: Object,
    default: () => ({ module: '' })
  }
});

const effectiveContextRevision = computed(() => (
  props.contextRevision ?? props.context?.contextRevision ?? 0
));

const sourceGroups = computed(() => {
  if (Array.isArray(props.relatedGroups)) return props.relatedGroups;
  if (Array.isArray(props.context?.relatedGroups)) return props.context.relatedGroups;
  const value = props.adapter?.getRelatedGroups?.(props.record, props.context);
  return Array.isArray(value) ? value : [];
});

const showHeader = computed(() => props.context?.hideHeader !== true);

const moduleDefinitionsByKey = ref({});

function moduleDefinitionFor(item) {
  return getRelatedModuleDefinition(item?.moduleKey);
}

function relatedDisplayOptions(item) {
  return { moduleDefinition: moduleDefinitionFor(item) };
}

const enrichedByKey = ref({});
let enrichRunId = 0;

watch(effectiveContextRevision, () => {
  enrichRunId += 1;
  enrichedByKey.value = {};
});

function enrichmentKey(item) {
  return `${String(item?.moduleKey || '').toLowerCase()}:${item?.id}`;
}

function buildDetailLines(item, record) {
  const lines = getRelatedRecordDetailLines(record || {}, item.moduleKey, 2, relatedDisplayOptions(item));
  if (lines.length) return lines;
  if (item.meta) return [{ label: null, value: item.meta, isEmpty: false }];
  return [];
}

function buildAvatarUser(item, record, title) {
  const mk = String(item?.moduleKey || '').toLowerCase();
  if (mk !== 'people') return undefined;
  const src = record || {};
  return {
    firstName: src.first_name || src.firstName,
    lastName: src.last_name || src.lastName,
    email: src.email,
    avatar: src.avatar,
    name: title
  };
}

function buildAvatarRecord(item, record, title) {
  const mk = String(item?.moduleKey || '').toLowerCase();
  if (mk === 'people') return undefined;
  return {
    name: title,
    avatar: record?.avatar
  };
}

function buildModuleIcon(moduleKey, appKey) {
  const mk = String(moduleKey || '').toLowerCase();
  if (mk === 'people') return null;
  return getNavigationIconComponent({ moduleKey: mk, appKey });
}

const renderGroups = computed(() => {
  // Track enrichment updates, parent context refreshes, and module definition loads.
  const enriched = enrichedByKey.value;
  const revision = effectiveContextRevision.value;
  const moduleDefs = moduleDefinitionsByKey.value;

  return sourceGroups.value.map((group) => ({
    key: group.key,
    label: group.label,
    items: (group.items || []).map((item) => {
      const key = enrichmentKey(item);
      const record = enriched[key] || item.recordData || null;
      const title = record
        ? (getRecordLabel(record) || item.title || t('records.relatedUntitled'))
        : (item.title || t('records.relatedUntitled'));

      return {
        key: `${key}:${revision}:${Object.keys(moduleDefs).length}:${buildDetailLines(item, record).length}`,
        item,
        group,
        title,
        lines: buildDetailLines(item, record),
        avatarUser: buildAvatarUser(item, record, title),
        avatarRecord: buildAvatarRecord(item, record, title),
        icon: buildModuleIcon(item.moduleKey, item.appKey)
      };
    })
  }));
});

watch(
  [sourceGroups, effectiveContextRevision],
  async ([nextGroups]) => {
    const runId = ++enrichRunId;
    const defs = await ensureRelatedModuleDefinitions();
    if (runId !== enrichRunId) return;
    moduleDefinitionsByKey.value = defs;

    const pending = [];

    for (const group of nextGroups || []) {
      for (const item of group.items || []) {
        if (!item?.id || !item?.moduleKey) continue;
        const key = enrichmentKey(item);
        const cached = enrichedByKey.value[key] || null;
        if (cached && isRecordEnrichedForDisplay(cached, item.moduleKey, relatedDisplayOptions(item))) {
          continue;
        }
        pending.push({
          recordId: item.id,
          moduleKey: item.moduleKey,
          appKey: item.appKey || 'SALES',
          key
        });
      }
    }

    if (!pending.length) return;

    const fetched = await fetchRecordsForDisplay(pending);
    if (runId !== enrichRunId) return;

    const next = { ...enrichedByKey.value };
    let changed = false;

    fetched.forEach((row, index) => {
      if (!row) return;
      const ref = pending[index];
      next[ref.key] = row;
      changed = true;
    });

    if (changed) {
      enrichedByKey.value = next;
    }
  },
  { deep: true, immediate: true }
);

function showUnlink(item, group) {
  return typeof props.adapter?.canUnlinkRelated === 'function'
    && props.adapter.canUnlinkRelated(item, group, props.record, props.context)
    && typeof props.adapter?.onUnlinkRelated === 'function';
}

function handleUnlink(item, group) {
  if (typeof props.adapter?.onUnlinkRelated === 'function') {
    props.adapter.onUnlinkRelated(item, group, props.record, props.context);
  }
}

const openItem = (item, group) => {
  if (typeof item?.onOpen === 'function') {
    item.onOpen(item, group, props.record, props.context);
    return;
  }
  props.adapter?.openRelatedItem?.(item, group, props.record, props.context);
};
</script>
