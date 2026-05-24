<template>
  <div
    class="list-page-skeleton w-full pb-12"
    aria-busy="true"
    :aria-label="t('common.loadingList')"
  >
    <!-- Header -->
    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0 flex-1 space-y-3">
        <div class="stb-shimmer h-8 w-44 max-w-full rounded-lg sm:h-9 sm:w-56" />
        <div class="stb-shimmer h-4 w-full max-w-md rounded sm:h-5" />
      </div>
      <div class="flex flex-shrink-0 gap-2">
        <div class="stb-shimmer h-10 w-24 rounded-lg" />
        <div class="stb-shimmer h-10 w-28 rounded-lg" />
      </div>
    </div>

    <!-- Stats strip -->
    <div
      class="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5"
    >
      <div
        v-for="n in 5"
        :key="`stat-${n}`"
        class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
      >
        <div class="stb-shimmer mb-3 h-4 w-28 rounded" />
        <div class="stb-shimmer h-8 w-16 rounded-md" />
      </div>
    </div>

    <!-- Search + filters -->
    <div class="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
      <div class="stb-shimmer h-10 w-full flex-1 rounded-lg" />
      <div class="flex gap-2">
        <div class="stb-shimmer h-10 w-28 rounded-lg lg:w-36" />
        <div class="stb-shimmer h-10 w-28 rounded-lg lg:w-36" />
        <div class="stb-shimmer hidden h-10 w-32 rounded-lg sm:block" />
      </div>
    </div>

    <!-- Table card: same px + negative mx as ListView → TableView so edges match header/stats -->
    <div class="mt-4 px-4 sm:px-6 lg:px-8">
      <div class="-mx-4 -my-2 sm:-mx-6 lg:-mx-8">
        <div
          class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900"
        >
          <!-- Fake header row -->
          <div
            class="flex items-center gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900"
          >
            <div class="stb-shimmer h-4 w-10 rounded" />
            <div class="stb-shimmer h-4 flex-1 rounded sm:max-w-[min(280px,40%)]" />
            <div class="stb-shimmer hidden h-4 w-24 rounded md:block" />
            <div class="stb-shimmer hidden h-4 w-20 rounded lg:block" />
            <div class="stb-shimmer hidden h-4 w-28 rounded xl:block" />
            <div class="stb-shimmer hidden h-4 w-24 rounded xl:block" />
          </div>

          <!-- Body rows -->
          <div class="divide-y divide-gray-100 dark:divide-gray-800">
            <div
              v-for="row in rowCount"
              :key="`sk-${row}`"
              class="flex items-center gap-3 px-4 py-4"
            >
              <div class="stb-shimmer h-4 w-6 rounded text-center tabular-nums" />
              <div class="stb-shimmer h-10 w-10 flex-shrink-0 rounded-full" />
              <div class="min-w-0 flex-1 space-y-2">
                <div
                  class="stb-shimmer h-3.5 rounded"
                  :style="{ width: rowWidths[(row - 1) % rowWidths.length] }"
                />
                <div class="stb-shimmer h-3 max-w-xs rounded" style="width: 80%" />
              </div>
              <div class="stb-shimmer hidden h-3 w-20 rounded md:block" />
              <div class="stb-shimmer hidden h-3 w-24 rounded lg:block" />
              <div class="stb-shimmer hidden h-3 w-28 rounded xl:block" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps({
  /** Number of fake table rows */
  bodyRows: {
    type: Number,
    default: 12
  }
});

const rowCount = computed(() => Math.min(16, Math.max(6, props.bodyRows)));

const rowWidths = ['72%', '85%', '68%', '78%', '82%', '75%'];
</script>

<style>
@keyframes stb-shimmer-move {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.list-page-skeleton .stb-shimmer {
  position: relative;
  overflow: hidden;
  background: linear-gradient(
    90deg,
    rgb(229 231 235) 0%,
    rgb(243 244 246) 42%,
    rgb(229 231 235) 100%
  );
  background-size: 200% 100%;
  animation: stb-shimmer-move 1.35s ease-in-out infinite;
}

html.dark .list-page-skeleton .stb-shimmer {
  background: linear-gradient(
    90deg,
    rgb(55 65 81) 0%,
    rgb(75 85 99) 42%,
    rgb(55 65 81) 100%
  );
  background-size: 200% 100%;
}
</style>
