<template>
  <section :class="PLATFORM_HOME_SECTION_CLASS">
    <div class="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
      <button
        type="button"
        class="flex min-w-0 flex-1 items-center gap-2 text-left"
        :aria-expanded="expanded"
        @click="toggleExpanded"
      >
        <ChevronDownIcon
          class="h-4 w-4 shrink-0 text-neutral-400 transition-transform duration-200 dark:text-neutral-400"
          :class="{ '-rotate-90': !expanded }"
        />
        <h2 class="truncate text-sm font-semibold text-neutral-900 dark:text-white">
          {{ title }}
        </h2>
      </button>
      <div v-if="$slots.action" class="shrink-0">
        <slot name="action" />
      </div>
    </div>

    <div
      v-show="expanded"
      :class="['px-4 pb-4 pt-3 sm:px-5', PLATFORM_HOME_SECTION_DIVIDER_CLASS]"
    >
      <slot />
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue';
import { ChevronDownIcon } from '@heroicons/vue/24/outline';
import { capturePlatformHomeSectionToggled } from '@/config/posthogPlatformHome';
import {
  PLATFORM_HOME_SECTION_CLASS,
  PLATFORM_HOME_SECTION_DIVIDER_CLASS
} from '@/utils/platformHomeLayout';

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  defaultExpanded: {
    type: Boolean,
    default: true
  },
  analyticsId: {
    type: String,
    default: ''
  }
});

const expanded = ref(props.defaultExpanded);

function toggleExpanded() {
  expanded.value = !expanded.value;
  if (props.analyticsId) {
    capturePlatformHomeSectionToggled(props.analyticsId, expanded.value);
  }
}
</script>
