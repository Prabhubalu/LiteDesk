<template>
  <div class="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
    <div class="flex flex-wrap items-start justify-between gap-3 border-b border-gray-200 bg-gray-50/80 px-5 py-4 dark:border-gray-700 dark:bg-gray-900/40">
      <div>
        <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.helpdeskExecCannedResponsesTitle') }}</h3>
        <p class="mt-0.5 max-w-xl text-sm text-gray-500 dark:text-gray-400">{{ t('settings.helpdeskExecCannedResponsesHint') }}</p>
      </div>
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900"
        @click="openNew"
      >
        <PlusIcon class="h-4 w-4" />
        {{ t('settings.helpdeskExecCannedAdd') }}
      </button>
    </div>

    <div v-if="!responses.length" class="px-5 py-12 text-center">
      <ChatBubbleLeftRightIcon class="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
      <p class="mt-3 text-sm text-gray-500 dark:text-gray-400">{{ t('settings.helpdeskExecCannedEmpty') }}</p>
      <button
        type="button"
        class="mt-4 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
        @click="openNew"
      >
        {{ t('settings.helpdeskExecCannedCreateFirst') }}
      </button>
    </div>

    <div v-else class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="bg-gray-50/80 dark:bg-gray-900/30">
          <tr>
            <th scope="col" class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {{ t('settings.helpdeskExecCannedName') }}
            </th>
            <th scope="col" class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {{ t('settings.helpdeskExecCannedChannel') }}
            </th>
            <th scope="col" class="hidden px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 md:table-cell">
              {{ t('settings.helpdeskExecCannedPreview') }}
            </th>
            <th scope="col" class="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              <span class="sr-only">{{ t('actions.edit') }}</span>
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
          <tr
            v-for="(item, index) in responses"
            :key="item.id || index"
            class="group hover:bg-gray-50/80 dark:hover:bg-gray-900/30"
          >
            <td class="px-5 py-3.5">
              <p class="font-medium text-gray-900 dark:text-white">{{ item.name || t('settings.helpdeskExecCannedUntitled') }}</p>
              <p v-if="showSubjectFor(item) && item.subject" class="mt-0.5 truncate text-xs text-gray-400 md:hidden">
                {{ item.subject }}
              </p>
            </td>
            <td class="px-5 py-3.5">
              <span
                class="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
                :class="channelBadgeClass(item.channel)"
              >
                {{ channelLabel(item.channel) }}
              </span>
            </td>
            <td class="hidden max-w-md px-5 py-3.5 md:table-cell">
              <p v-if="showSubjectFor(item) && item.subject" class="truncate text-xs text-gray-500 dark:text-gray-400">
                {{ item.subject }}
              </p>
              <p class="truncate text-sm text-gray-600 dark:text-gray-300">{{ bodyPreview(item.body) }}</p>
            </td>
            <td class="px-5 py-3.5 text-right">
              <button
                type="button"
                class="rounded-lg px-2.5 py-1.5 text-sm font-medium text-indigo-600 opacity-80 hover:bg-indigo-50 hover:opacity-100 group-hover:opacity-100 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
                @click="openEdit(index)"
              >
                {{ t('actions.edit') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <HelpdeskCannedResponseDrawer
      :open="drawerOpen"
      :is-new="drawerIsNew"
      :initial-response="drawerResponse"
      @close="closeDrawer"
      @save="saveDrawer"
      @remove="removeDrawer"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ChatBubbleLeftRightIcon, PlusIcon } from '@heroicons/vue/24/outline';
import HelpdeskCannedResponseDrawer from '@/components/settings/helpdesk/HelpdeskCannedResponseDrawer.vue';

const responses = defineModel('responses', { type: Array, default: () => [] });

const { t } = useI18n();

const drawerOpen = ref(false);
const drawerIsNew = ref(true);
const drawerIndex = ref(-1);
const drawerResponse = ref(null);

function channelLabel(channel) {
  const value = String(channel || 'email').toLowerCase();
  if (value === 'internal') return t('settings.helpdeskExecCannedChannelInternal');
  if (value === 'all') return t('settings.helpdeskExecCannedChannelAll');
  return t('settings.helpdeskExecCannedChannelEmail');
}

function channelBadgeClass(channel) {
  const value = String(channel || 'email').toLowerCase();
  if (value === 'internal') return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
  if (value === 'all') return 'bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-200';
  return 'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200';
}

function showSubjectFor(item) {
  const channel = String(item?.channel || 'email').toLowerCase();
  return channel === 'email' || channel === 'all';
}

function bodyPreview(body) {
  return String(body || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

function openNew() {
  drawerIsNew.value = true;
  drawerIndex.value = -1;
  drawerResponse.value = null;
  drawerOpen.value = true;
}

function openEdit(index) {
  drawerIsNew.value = false;
  drawerIndex.value = index;
  drawerResponse.value = responses.value[index];
  drawerOpen.value = true;
}

function closeDrawer() {
  drawerOpen.value = false;
}

function saveDrawer(payload) {
  const existingIds = responses.value
    .map((item) => item.id)
    .filter((_, i) => !(drawerIsNew.value === false && i === drawerIndex.value));
  let id = payload.id;
  if (existingIds.includes(id)) {
    const base = id;
    let n = 2;
    while (existingIds.includes(id)) id = `${base}-${n++}`;
  }
  payload.id = id;

  if (drawerIsNew.value) responses.value.push(payload);
  else if (drawerIndex.value >= 0) responses.value[drawerIndex.value] = payload;
  closeDrawer();
}

function removeDrawer() {
  if (drawerIndex.value >= 0) responses.value.splice(drawerIndex.value, 1);
  closeDrawer();
}

defineExpose({
  validate() {
    for (const item of responses.value) {
      if (!String(item.name || '').trim()) return t('settings.helpdeskExecCannedNameRequired');
      if (!String(item.body || '').trim()) return t('settings.helpdeskExecCannedBodyRequired');
    }
    return null;
  }
});
</script>
