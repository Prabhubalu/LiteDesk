<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useOnboarding } from '@/composables/useOnboarding';
import { useAnchoredPanelPosition } from '@/composables/useAnchoredPanelPosition';

const COACHMARK_TARGETS = {
  sidebar: '[data-onboarding-target="sidebar"]',
  command_palette: '[data-onboarding-target="command_palette"]',
  tabs: '[data-onboarding-target="tabs"]'
};

const COACHMARK_TITLE_KEYS = {
  sidebar: 'onboarding.coachmarkSidebarTitle',
  command_palette: 'onboarding.coachmarkCommandPaletteTitle',
  tabs: 'onboarding.coachmarkTabsTitle'
};

const COACHMARK_DESCRIPTION_KEYS = {
  sidebar: 'onboarding.coachmarkSidebarDescription',
  command_palette: 'onboarding.coachmarkCommandPaletteDescription',
  tabs: 'onboarding.coachmarkTabsDescription'
};

const route = useRoute();
const { t } = useI18n();
const { state, fetchOnboarding, markCoachmark } = useOnboarding();
const { panelStyle, isOpen, openAt, close } = useAnchoredPanelPosition({ panelWidth: 280, panelHeight: 120 });

const activeKey = ref(null);
const panelRef = ref(null);
const dismissing = ref(false);

const pendingCoachmarks = computed(() => state.value.pendingCoachmarks || []);
const shouldRun = computed(() => {
  if (!state.value.origin) return false;
  if (route.path === '/onboarding') return false;
  return pendingCoachmarks.value.length > 0;
});

const activeTitle = computed(() => {
  if (!activeKey.value) return '';
  const key = COACHMARK_TITLE_KEYS[activeKey.value];
  return key ? t(key) : '';
});

const activeDescription = computed(() => {
  if (!activeKey.value) return '';
  const key = COACHMARK_DESCRIPTION_KEYS[activeKey.value];
  return key ? t(key) : '';
});

const findTarget = (key) => document.querySelector(COACHMARK_TARGETS[key]);

const showCoachmark = async (key) => {
  await nextTick();
  const target = findTarget(key);
  if (!target) {
    await markCoachmark(key);
    return;
  }
  activeKey.value = key;
  openAt({ value: target }, panelRef);
};

const advanceCoachmarks = async () => {
  if (!shouldRun.value) {
    activeKey.value = null;
    close();
    return;
  }
  const nextKey = pendingCoachmarks.value[0];
  if (!nextKey) {
    activeKey.value = null;
    close();
    return;
  }
  await showCoachmark(nextKey);
};

const dismissActive = async () => {
  if (!activeKey.value || dismissing.value) return;
  dismissing.value = true;
  const key = activeKey.value;
  close();
  activeKey.value = null;
  await markCoachmark(key);
  dismissing.value = false;
  await advanceCoachmarks();
};

watch(
  () => [shouldRun.value, pendingCoachmarks.value.join(',')],
  () => {
    if (shouldRun.value && !activeKey.value && !dismissing.value) {
      void advanceCoachmarks();
    }
  }
);

onMounted(async () => {
  await fetchOnboarding();
  if (shouldRun.value) {
    await advanceCoachmarks();
  }
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen && activeKey"
      class="fixed inset-0 z-[120]"
    >
      <button
        type="button"
        class="absolute inset-0 bg-gray-900/40"
        aria-label="Dismiss coachmark"
        @click="dismissActive"
      />
      <div
        ref="panelRef"
        class="fixed z-[121] rounded-lg border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-800"
        :style="panelStyle"
      >
        <p class="text-sm font-semibold text-gray-900 dark:text-white">
          {{ activeTitle }}
        </p>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {{ activeDescription }}
        </p>
        <button
          type="button"
          class="mt-3 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
          @click="dismissActive"
        >
          {{ t('onboarding.coachmarkDismiss') }}
        </button>
      </div>
    </div>
  </Teleport>
</template>
