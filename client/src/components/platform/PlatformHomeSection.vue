<template>
  <section :class="[PLATFORM_HOME_SECTION_CLASS, 'flex h-full min-h-0 flex-col']">
    <div class="platform-home-widget-header flex shrink-0 items-stretch gap-2 px-4 py-3 sm:px-5">
      <button
        type="button"
        class="inline-flex shrink-0 items-center self-center rounded-md p-0.5 text-neutral-400 hover:text-neutral-600 dark:text-neutral-400 dark:hover:text-neutral-200"
        :aria-expanded="expanded"
        :aria-label="title"
        @click="toggleExpanded"
      >
        <ChevronDownIcon
          class="h-4 w-4 transition-transform duration-200"
          :class="{ '-rotate-90': !expanded }"
        />
      </button>
      <h2 class="flex min-w-0 shrink items-center self-center select-text truncate text-sm font-semibold text-neutral-900 dark:text-white">
        {{ title }}
      </h2>
      <PlatformHomeWidgetHeaderDragPad />
      <div v-if="$slots.action" class="flex shrink-0 items-center self-center">
        <slot name="action" />
      </div>
    </div>

    <div
      v-show="expanded"
      :class="[
        'min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-3 sm:px-5',
        PLATFORM_HOME_SECTION_DIVIDER_CLASS
      ]"
    >
      <slot />
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue';
import { ChevronDownIcon } from '@heroicons/vue/24/outline';
import PlatformHomeWidgetHeaderDragPad from '@/components/platform/PlatformHomeWidgetHeaderDragPad.vue';
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
