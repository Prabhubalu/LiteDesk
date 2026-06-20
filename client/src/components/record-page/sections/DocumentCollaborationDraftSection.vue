<template>
  <section
    v-if="record?._id && otherDrafts.length"
    class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/20"
  >
    <p class="text-sm font-medium text-amber-900 dark:text-amber-100">
      {{ t('documents.collaborationDraftsTitle') }}
    </p>
    <p class="mt-1 text-xs text-amber-800 dark:text-amber-200">
      {{ t('documents.collaborationDraftsDescription') }}
    </p>
    <ul class="mt-2 space-y-1">
      <li
        v-for="draft in otherDrafts"
        :key="draftKey(draft)"
        class="text-xs text-amber-900 dark:text-amber-100"
      >
        <span class="font-medium">{{ draftUserName(draft) }}</span>
        <span class="text-amber-700 dark:text-amber-300">
          {{ t('documents.collaborationDraftSaved', { time: formatRelative(draft.lastSavedAt) }) }}
        </span>
      </li>
    </ul>
    <p v-if="localDraftSavedAt" class="mt-2 text-xs text-amber-800 dark:text-amber-200">
      {{ t('documents.collaborationYourDraftSaved', { time: formatRelative(localDraftSavedAt) }) }}
    </p>
  </section>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDocuments } from '@/composables/useDocuments';

const props = defineProps({
  record: { type: Object, default: null },
  context: { type: Object, default: () => ({}) }
});

const { t } = useI18n();
const { fetchDocumentEditDrafts } = useDocuments();

const otherDrafts = ref([]);
const localDraftSavedAt = computed(() => props.context?.localDraftSavedAt || null);
let pollTimer = null;

function draftKey(draft) {
  return String(draft.userId?._id || draft.userId || draft._id);
}

function draftUserName(draft) {
  const user = draft.userId;
  if (!user || typeof user !== 'object') return t('documents.collaborationUnknownEditor');
  return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || t('documents.collaborationUnknownEditor');
}

function formatRelative(value) {
  if (!value) return '';
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(Math.round(diffMs / 60000), 0);
  if (minutes < 1) return t('documents.collaborationJustNow');
  return t('documents.collaborationMinutesAgo', { count: minutes });
}

async function loadDrafts() {
  if (!props.record?._id) return;
  try {
    const response = await fetchDocumentEditDrafts(props.record._id);
    otherDrafts.value = response?.data || [];
  } catch {
    otherDrafts.value = [];
  }
}

watch(() => props.record?._id, () => {
  void loadDrafts();
});

onMounted(() => {
  void loadDrafts();
  pollTimer = window.setInterval(() => {
    void loadDrafts();
  }, 15000);
});

onUnmounted(() => {
  if (pollTimer) window.clearInterval(pollTimer);
});
</script>
