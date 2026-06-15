<template>
  <nav
    class="app-sidebar-skeleton sidebar-nav sidebar-nav--brand flex grow flex-col h-full overflow-hidden bg-primary-800 dark:bg-neutral-950"
    :class="[
      collapsed ? 'w-[3.5rem]' : 'w-[13.75rem]',
      collapsed ? 'sidebar-nav--collapsed' : 'sidebar-nav--expanded',
      'transition-[width] duration-200 ease-out',
    ]"
    aria-busy="true"
    :aria-label="t('navigation.loadingNavigation')"
  >
    <div
      class="relative h-[2.75rem] border-b border-white/20 dark:border-neutral-800/80 dark:bg-primary-900/30 flex-shrink-0 flex items-center"
      :class="collapsed ? 'justify-center px-0' : 'justify-between pl-[0.875rem] pr-[0.5rem] gap-[0.5rem]'"
    >
      <div
        class="stb-shimmer rounded-md flex-shrink-0"
        :class="collapsed ? 'h-[1.5rem] w-[1.5rem]' : 'h-[1.875rem] w-[7rem] max-w-full'"
      />
      <div
        v-if="!collapsed"
        class="stb-shimmer h-[1rem] w-[1rem] rounded-[0.5rem] flex-shrink-0"
      />
    </div>

    <div class="flex-1 overflow-y-hidden min-h-0 flex flex-col">
      <div class="px-[0.5rem] pt-[0.5rem] pb-[0.5rem]">
        <div
          class="sidebar-search-control w-full h-[1.75rem] ring-1 ring-white/20 dark:ring-neutral-700 rounded-[0.5rem] flex items-center bg-white/10 dark:bg-neutral-800/60 px-[0.5rem] py-[0.25rem]"
          :class="collapsed ? 'justify-center' : 'gap-[0.5rem] justify-start'"
        >
          <div class="stb-shimmer w-[1.125rem] h-[1.125rem] rounded flex-shrink-0" />
          <div
            v-if="!collapsed"
            class="stb-shimmer h-4 flex-1 max-w-[8rem] rounded"
          />
        </div>
      </div>

      <div class="px-[0.5rem] flex flex-col gap-[0.25rem]">
        <div
          v-for="n in shellRowCount"
          :key="`shell-${n}`"
          class="w-full h-[1.75rem] rounded-[0.5rem] px-[0.5rem] flex items-center"
          :class="collapsed ? 'justify-center' : 'gap-[0.5rem] justify-start'"
        >
          <div class="stb-shimmer w-[1.125rem] h-[1.125rem] rounded flex-shrink-0" />
          <div
            v-if="!collapsed"
            class="stb-shimmer h-4 rounded flex-1 min-w-0"
            :style="{ maxWidth: shellLabelWidths[(n - 1) % shellLabelWidths.length] }"
          />
        </div>
        <div class="mt-[0.75rem] h-px bg-white/20 dark:bg-neutral-800" />
      </div>

      <div class="px-[0.5rem] pt-[0.75rem] flex flex-col gap-[0.25rem] flex-1 min-h-0">
        <div
          class="sidebar-app-switcher-control w-full h-[1.75rem] bg-white/10 dark:bg-neutral-800/60 ring-1 ring-white/20 dark:ring-neutral-700 rounded-[0.333rem] flex items-center px-[0.5rem] py-[0.25rem]"
          :class="collapsed ? 'justify-center' : 'gap-[0.5rem] justify-start'"
        >
          <div class="stb-shimmer w-[1.125rem] h-[1.125rem] rounded flex-shrink-0" />
          <div
            v-if="!collapsed"
            class="stb-shimmer h-4 flex-1 rounded max-w-[5.5rem]"
          />
          <div
            v-if="!collapsed"
            class="stb-shimmer w-3 h-3 rounded flex-shrink-0 ml-auto opacity-80"
          />
        </div>

        <div class="flex flex-col gap-[0.25rem] mt-[0.5rem]">
          <div
            v-for="n in appRowCount"
            :key="`app-${n}`"
            class="w-full h-[1.75rem] rounded-[0.5rem] px-[0.5rem] flex items-center"
            :class="collapsed ? 'justify-center py-[0.333rem]' : 'gap-[0.5rem] justify-start py-[0.333rem]'"
          >
            <div class="stb-shimmer w-[1.125rem] h-[1.125rem] rounded flex-shrink-0" />
            <div
              v-if="!collapsed"
              class="stb-shimmer h-4 rounded flex-1 min-w-0"
              :style="{ maxWidth: appLabelWidths[(n - 1) % appLabelWidths.length] }"
            />
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="!collapsed"
      class="flex-shrink-0 border-t border-white/20 dark:border-neutral-800/80 h-[2.75rem] flex items-center px-[0.875rem]"
    >
      <div class="stb-shimmer h-[1.75rem] w-[4.5rem] rounded-[0.5rem]" />
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = withDefaults(
  defineProps<{
    collapsed?: boolean;
  }>(),
  { collapsed: false }
);

const shellRowCount = computed(() => (props.collapsed ? 6 : 4));
const appRowCount = computed(() => (props.collapsed ? 5 : 6));

const shellLabelWidths = ['72%', '58%', '64%', '80%'];
const appLabelWidths = ['55%', '70%', '48%', '62%', '52%', '66%'];
</script>

<style>
@keyframes app-sidebar-skeleton-shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.app-sidebar-skeleton .stb-shimmer {
  position: relative;
  overflow: hidden;
  background: linear-gradient(
    90deg,
    rgb(255 255 255 / 0.1) 0%,
    rgb(255 255 255 / 0.22) 42%,
    rgb(255 255 255 / 0.1) 100%
  );
  background-size: 200% 100%;
  animation: app-sidebar-skeleton-shimmer 1.35s ease-in-out infinite;
}

html.dark .app-sidebar-skeleton .stb-shimmer {
  background: linear-gradient(
    90deg,
    rgb(255 255 255 / 0.06) 0%,
    rgb(255 255 255 / 0.14) 42%,
    rgb(255 255 255 / 0.06) 100%
  );
  background-size: 200% 100%;
}
</style>
