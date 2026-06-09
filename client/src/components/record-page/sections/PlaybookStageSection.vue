<template>
  <section v-if="actions.length" class="space-y-3">
    <h3 v-if="!hideHeader" class="text-base font-semibold text-gray-900 dark:text-white">
      {{ t('records.stagePlaybookTitle') }}
    </h3>
    <div
      v-if="exitCriteriaMet"
      class="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-200"
    >
      {{ exitCriteriaMessage }}
    </div>
    <div
      v-else-if="customExitCriteriaHint"
      class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-100"
    >
      {{ customExitCriteriaHint }}
    </div>
    <ul class="space-y-2">
      <li
        v-for="action in actions"
        :key="action.actionKey"
        class="rounded-lg border px-3 py-2.5"
        :class="action.status === 'blocked'
          ? 'border-gray-200/80 dark:border-gray-700/80 bg-gray-50 dark:bg-gray-900/20 opacity-80'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40'"
      >
        <div class="flex items-start gap-3">
          <button
            v-if="action.canToggle"
            type="button"
            class="mt-0.5 flex-shrink-0 rounded-full border transition-colors"
            :class="action.status === 'completed'
              ? 'border-emerald-500 bg-emerald-500 text-white'
              : 'border-gray-300 dark:border-gray-600 text-transparent hover:border-indigo-400'"
            :disabled="pendingKey === action.actionKey"
            :aria-label="action.status === 'completed' ? t('records.stagePlaybookMarkPending') : t('records.stagePlaybookMarkComplete')"
            @click="toggleStatus(action)"
          >
            <CheckIcon class="h-4 w-4" />
          </button>
          <span
            v-else
            class="mt-0.5 h-4 w-4 flex-shrink-0 rounded-full border"
            :class="action.status === 'completed'
              ? 'border-emerald-500 bg-emerald-500'
              : action.status === 'blocked'
                ? 'border-gray-300 dark:border-gray-600 bg-gray-200 dark:bg-gray-700'
                : 'border-gray-300 dark:border-gray-600'"
          />
          <div class="min-w-0 flex-1 space-y-1">
            <div class="flex flex-wrap items-center gap-2">
              <button
                v-if="action.activityPath && context?.openTab && action.status !== 'blocked'"
                type="button"
                class="text-sm font-medium text-left hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                :class="action.status === 'completed'
                  ? 'text-gray-500 dark:text-gray-400 line-through'
                  : 'text-gray-900 dark:text-white'"
                @click="openActivity(action)"
              >
                {{ action.title }}
              </button>
              <p
                v-else
                class="text-sm font-medium"
                :class="action.status === 'completed'
                  ? 'text-gray-500 dark:text-gray-400 line-through'
                  : action.status === 'blocked'
                    ? 'text-gray-500 dark:text-gray-400'
                    : 'text-gray-900 dark:text-white'"
              >
                {{ action.title }}
              </p>
              <span
                v-if="action.required"
                class="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
              >
                {{ t('records.stagePlaybookRequired') }}
              </span>
              <span
                v-if="action.status === 'blocked'"
                class="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-700 dark:bg-gray-700 dark:text-gray-300"
              >
                {{ t('records.stagePlaybookStatusBlocked') }}
              </span>
            </div>
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
              <span>{{ actionTypeLabel(action.actionType) }}</span>
              <span v-if="action.dueAtLabel && action.status !== 'blocked'">• {{ t('records.stagePlaybookDue', { date: action.dueAtLabel }) }}</span>
              <span>• {{ statusLabel(action.status) }}</span>
            </div>
            <p
              v-if="action.status === 'blocked' && blockedReason(action)"
              class="text-xs text-gray-500 dark:text-gray-400"
            >
              {{ blockedReason(action) }}
            </p>
            <div
              v-if="action.resources?.length"
              class="mt-2 rounded-md border border-gray-100 bg-gray-50/80 px-2.5 py-2 dark:border-gray-700/80 dark:bg-gray-900/30"
            >
              <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {{ t('records.stagePlaybookResources') }}
              </p>
              <ul class="mt-1.5 space-y-1.5">
                <li
                  v-for="(resource, resourceIndex) in action.resources"
                  :key="`${action.actionKey}-resource-${resourceIndex}`"
                  class="text-xs"
                >
                  <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <a
                      v-if="resourceHref(resource)"
                      :href="resourceHref(resource)"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="inline-flex items-center gap-1 font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
                      :aria-label="t('records.stagePlaybookOpenResource', { name: resourceLabel(resource) })"
                    >
                      <LinkIcon class="h-3.5 w-3.5 shrink-0" />
                      <span>{{ resourceLabel(resource) }}</span>
                    </a>
                    <span
                      v-else
                      class="font-medium text-gray-700 dark:text-gray-200"
                    >
                      {{ resourceLabel(resource) }}
                    </span>
                    <span
                      v-if="resource.type"
                      class="rounded bg-gray-200/80 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                    >
                      {{ resourceTypeLabel(resource.type) }}
                    </span>
                  </div>
                  <p
                    v-if="resource.description"
                    class="mt-0.5 text-gray-500 dark:text-gray-400"
                  >
                    {{ resource.description }}
                  </p>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { CheckIcon } from '@heroicons/vue/24/solid';
import { LinkIcon } from '@heroicons/vue/24/outline';

const { t, te } = useI18n();

const props = defineProps({
  record: { type: Object, default: null },
  adapter: { type: Object, default: () => ({}) },
  context: {
    type: Object,
    default: () => ({ module: '' })
  }
});

const pendingKey = ref('');

const actions = computed(() => {
  const value = props.adapter?.getPlaybookActions?.(props.record, props.context);
  return Array.isArray(value) ? value : [];
});

const hideHeader = computed(() => props.context?.hideHeader === true);

const exitCriteriaMet = computed(() => props.record?.playbookState?.exitCriteriaMet === true);

const exitCriteriaMessage = computed(() => {
  if (!exitCriteriaMet.value) return '';
  if (props.record?.playbookState?.autoAdvanceEnabled) {
    return t('records.stagePlaybookExitCriteriaMetAutoAdvance');
  }
  return t('records.stagePlaybookExitCriteriaMet');
});

const customExitCriteriaHint = computed(() => {
  if (exitCriteriaMet.value) return '';
  if (props.record?.playbookState?.exitCriteriaType !== 'custom') return '';
  const description = String(props.record?.playbookState?.exitCriteriaCustomDescription || '').trim();
  if (description) return description;
  return t('records.stagePlaybookCustomExitPending');
});

const actionTypeLabel = (actionType) => {
  const key = String(actionType || 'task').toLowerCase();
  const translationKey = `records.stagePlaybookType${key.charAt(0).toUpperCase()}${key.slice(1)}`;
  return te(translationKey) ? t(translationKey) : t('records.stagePlaybookTypeTask');
};

const statusLabel = (status) => {
  if (status === 'completed') return t('records.stagePlaybookStatusCompleted');
  if (status === 'blocked') return t('records.stagePlaybookStatusBlocked');
  return t('records.stagePlaybookStatusPending');
};

const resourceLabel = (resource) => {
  const name = String(resource?.name || '').trim();
  if (name) return name;
  const url = String(resource?.url || '').trim();
  return url || t('records.stagePlaybookResourceUntitled');
};

const resourceHref = (resource) => {
  const url = String(resource?.url || '').trim();
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('//')) return `https:${url}`;
  return null;
};

const resourceTypeLabel = (type) => {
  const key = String(type || 'document').toLowerCase();
  const translationKey = `records.stagePlaybookResourceType${key.charAt(0).toUpperCase()}${key.slice(1)}`;
  return te(translationKey) ? t(translationKey) : t('records.stagePlaybookResourceTypeDocument');
};

const blockedReason = (action) => {
  const blockedBy = Array.isArray(action?.blockedBy) ? action.blockedBy : [];
  if (!blockedBy.length) {
    return t('records.stagePlaybookBlockedGeneric');
  }
  const titles = blockedBy
    .map((key) => actions.value.find((item) => item.actionKey === key)?.title || key)
    .filter(Boolean);
  return t('records.stagePlaybookBlockedBy', { steps: titles.join(', ') });
};

const openActivity = (action) => {
  if (!action?.activityPath || typeof props.context?.openTab !== 'function') return;
  props.context.openTab(action.activityPath, { background: false, insertAdjacent: true });
};

const toggleStatus = async (action) => {
  if (!action?.actionKey || !props.record || pendingKey.value || action.status === 'blocked') return;
  const nextStatus = action.status === 'completed' ? 'pending' : 'completed';
  pendingKey.value = action.actionKey;
  try {
    await props.adapter?.setPlaybookActionStatus?.(props.record, action.actionKey, nextStatus);
  } finally {
    pendingKey.value = '';
  }
};
</script>
