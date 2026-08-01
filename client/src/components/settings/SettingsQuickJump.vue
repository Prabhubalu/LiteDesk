<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[80] flex items-start justify-center bg-black/40 px-4 pt-[12vh]"
      @click.self="close"
    >
      <div
        role="dialog"
        aria-modal="true"
        :aria-label="t('settings.searchPlaceholder')"
        class="w-full max-w-lg overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
      >
        <div class="flex items-center gap-2 border-b border-neutral-200 px-3 dark:border-neutral-700">
          <svg class="h-5 w-5 shrink-0 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref="inputRef"
            v-model="query"
            type="search"
            class="h-12 w-full bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral-400 dark:text-neutral-100"
            :placeholder="t('settings.searchPlaceholder')"
            autocomplete="off"
            @keydown.down.prevent="move(1)"
            @keydown.up.prevent="move(-1)"
            @keydown.enter.prevent="selectActive"
            @keydown.esc.prevent="close"
          />
          <kbd class="hidden shrink-0 rounded border border-neutral-200 px-1.5 py-0.5 text-[0.65rem] text-neutral-500 sm:inline dark:border-neutral-600">esc</kbd>
        </div>

        <ul v-if="hits.length" class="max-h-80 overflow-y-auto py-1" role="listbox">
          <li
            v-for="(hit, idx) in hits"
            :key="hit.id"
            role="option"
            :aria-selected="idx === activeIndex"
            :class="[
              'cursor-pointer px-3 py-2.5',
              idx === activeIndex
                ? 'bg-primary-50 dark:bg-primary-900/20'
                : 'hover:bg-neutral-50 dark:hover:bg-neutral-800',
            ]"
            @mouseenter="activeIndex = idx"
            @click="navigate(hit)"
          >
            <div class="text-sm font-medium text-neutral-900 dark:text-neutral-100">
              <span v-if="hit.parentLabel" class="text-neutral-500 dark:text-neutral-400">{{ hit.parentLabel }} · </span>{{ hit.label }}
            </div>
            <div class="mt-0.5 line-clamp-1 text-xs text-neutral-500 dark:text-neutral-400">{{ hit.description }}</div>
          </li>
        </ul>
        <div v-else class="px-3 py-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
          {{ t('settings.searchEmpty') }}
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useRecentSettingsTabs } from '@/composables/useRecentSettingsTabs';
import {
  getAccessibleSettingsCatalog,
  searchSettingsCatalog,
  type SettingsAccessContext,
  type SettingsSearchHit,
} from '@/utils/settingsCatalog';

const props = defineProps<{
  open: boolean;
  accessCtx: SettingsAccessContext;
}>();

const emit = defineEmits<{
  close: [];
}>();

const { t } = useI18n();
const router = useRouter();
const { record } = useRecentSettingsTabs();

const query = ref('');
const activeIndex = ref(0);
const inputRef = ref<HTMLInputElement | null>(null);

const catalog = computed(() => getAccessibleSettingsCatalog(props.accessCtx));

const hits = computed(() =>
  searchSettingsCatalog(query.value, catalog.value, t).slice(0, 12)
);

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) return;
    query.value = '';
    activeIndex.value = 0;
    await nextTick();
    inputRef.value?.focus();
  }
);

watch(hits, () => {
  activeIndex.value = 0;
});

function close(): void {
  emit('close');
}

function move(delta: number): void {
  const len = hits.value.length;
  if (!len) return;
  activeIndex.value = (activeIndex.value + delta + len) % len;
}

function selectActive(): void {
  const hit = hits.value[activeIndex.value];
  if (hit) navigate(hit);
}

function navigate(hit: SettingsSearchHit): void {
  record(hit.id);
  close();
  router.push(hit.route);
}
</script>
