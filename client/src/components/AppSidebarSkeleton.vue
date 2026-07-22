<template>
  <nav
    class="app-sidebar-skeleton sidebar-nav sidebar-nav--brand flex grow flex-col h-full overflow-hidden w-[3.5rem] bg-primary-800 dark:bg-neutral-950"
    aria-busy="true"
    :aria-label="t('navigation.loadingNavigation')"
  >
    <div class="relative h-[2.75rem] border-b border-white/20 dark:border-neutral-800/80 flex-shrink-0 flex items-center justify-center">
      <div class="stb-shimmer rounded-md flex-shrink-0 h-[1.5rem] w-[1.5rem]" />
    </div>
    <div class="flex-1 overflow-y-hidden min-h-0 flex flex-col px-1 pt-2 gap-1">
      <div
        v-for="n in 8"
        :key="n"
        class="flex flex-col items-center gap-1 py-1.5"
      >
        <div class="stb-shimmer h-[1.25rem] w-[1.25rem] rounded" />
        <div class="stb-shimmer h-[0.5rem] w-[2.5rem] rounded" />
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

defineProps<{
  collapsed?: boolean;
}>();

const { t } = useI18n();
</script>

<style scoped>
.stb-shimmer {
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.08) 0%,
    rgba(255, 255, 255, 0.16) 50%,
    rgba(255, 255, 255, 0.08) 100%
  );
  background-size: 200% 100%;
  animation: stb-shimmer 1.2s ease-in-out infinite;
}

@keyframes stb-shimmer {
  0% { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}
</style>
