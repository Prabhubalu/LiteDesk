<template>
  <nav
    class="app-sidebar-skeleton sidebar-nav flex grow flex-col h-full bg-white dark:bg-gray-900 border-r border-[#EAEEF4] dark:border-gray-700"
    :class="[
      collapsed ? 'w-[4rem]' : 'w-[15.833rem]',
      'transition-all duration-300 ease-in-out',
    ]"
    aria-busy="true"
    :aria-label="t('navigation.loadingNavigation')"
  >
    <div
      class="relative h-[3.167rem] border-b border-[#EAEEF4] dark:border-gray-700 flex-shrink-0 flex items-center"
      :class="collapsed ? 'justify-center px-0' : 'justify-between pl-[1rem] pr-[0.667rem] gap-[0.5rem]'"
    >
      <div
        class="stb-shimmer rounded-md flex-shrink-0"
        :class="collapsed ? 'h-[1.5rem] w-[1.5rem]' : 'h-[2.167rem] w-[7rem] max-w-full'"
      />
      <div
        v-if="!collapsed"
        class="stb-shimmer h-[1.167rem] w-[1.167rem] rounded-[0.5rem] flex-shrink-0"
      />
    </div>

    <div class="flex-1 overflow-y-hidden min-h-0 flex flex-col">
      <div class="px-[0.667rem] pt-[0.667rem] pb-[0.667rem]">
        <div
          class="w-full h-[2.333rem] border border-[#EAEEF4] dark:border-gray-700 rounded-[0.5rem] flex items-center bg-white dark:bg-gray-900 px-[0.583rem] py-[0.5rem]"
          :class="collapsed ? 'justify-center' : 'gap-[0.583rem] justify-start'"
        >
          <div class="stb-shimmer w-[1.333rem] h-[1.333rem] rounded flex-shrink-0" />
          <div
            v-if="!collapsed"
            class="stb-shimmer h-4 flex-1 max-w-[8rem] rounded"
          />
        </div>
      </div>

      <div class="px-[0.667rem] flex flex-col gap-[0.333rem]">
        <div
          v-for="n in shellRowCount"
          :key="`shell-${n}`"
          class="w-full h-[2.333rem] rounded-[0.5rem] px-[0.583rem] flex items-center"
          :class="collapsed ? 'justify-center' : 'gap-[0.667rem] justify-start'"
        >
          <div class="stb-shimmer w-[1.333rem] h-[1.333rem] rounded flex-shrink-0" />
          <div
            v-if="!collapsed"
            class="stb-shimmer h-4 rounded flex-1 min-w-0"
            :style="{ maxWidth: shellLabelWidths[(n - 1) % shellLabelWidths.length] }"
          />
        </div>
        <div class="mt-[1rem] h-px bg-[#EAEEF4] dark:bg-gray-700" />
      </div>

      <div class="px-[0.667rem] pt-[1rem] flex flex-col gap-[0.333rem] flex-1 min-h-0">
        <div
          class="w-full h-[2.333rem] bg-[#F8F9FB] dark:bg-gray-800 border border-[#EAEEF4] dark:border-gray-700 rounded-[0.333rem] flex items-center px-[0.583rem] py-[0.5rem]"
          :class="collapsed ? 'justify-center' : 'gap-[0.667rem] justify-start'"
        >
          <div class="stb-shimmer w-[1.333rem] h-[1.333rem] rounded flex-shrink-0" />
          <div
            v-if="!collapsed"
            class="stb-shimmer h-4 flex-1 rounded max-w-[5.5rem]"
          />
          <div
            v-if="!collapsed"
            class="stb-shimmer w-3 h-3 rounded flex-shrink-0 ml-auto opacity-80"
          />
        </div>

        <div class="flex flex-col gap-[0.333rem] mt-[0.5rem]">
          <div
            v-for="n in appRowCount"
            :key="`app-${n}`"
            class="w-full h-[2.333rem] rounded-[0.5rem] px-[0.5rem] flex items-center"
            :class="collapsed ? 'justify-center py-[0.333rem]' : 'gap-[0.667rem] justify-start py-[0.333rem]'"
          >
            <div class="stb-shimmer w-[1.333rem] h-[1.333rem] rounded flex-shrink-0" />
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
      class="flex-shrink-0 border-t border-[#EAEEF4] dark:border-gray-700 h-[3.167rem] flex items-center px-[1.167rem]"
    >
      <div class="stb-shimmer h-[2rem] w-[4.5rem] rounded-[0.5rem]" />
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
    rgb(229 231 235) 0%,
    rgb(243 244 246) 42%,
    rgb(229 231 235) 100%
  );
  background-size: 200% 100%;
  animation: app-sidebar-skeleton-shimmer 1.35s ease-in-out infinite;
}

html.dark .app-sidebar-skeleton .stb-shimmer {
  background: linear-gradient(
    90deg,
    rgb(55 65 81) 0%,
    rgb(75 85 99) 42%,
    rgb(55 65 81) 100%
  );
  background-size: 200% 100%;
}
</style>
