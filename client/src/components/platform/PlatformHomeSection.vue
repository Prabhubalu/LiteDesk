<template>
  <section :class="[PLATFORM_HOME_SECTION_CLASS, 'flex min-h-0 flex-col h-auto sm:h-full']">
    <PlatformHomeWidgetHeader :title="title" divider>
      <template v-if="$slots.action" #actions>
        <slot name="action" />
      </template>
    </PlatformHomeWidgetHeader>

    <div class="min-h-0 overflow-visible px-4 pb-4 pt-3 sm:flex-1 sm:overflow-y-auto sm:px-5">
      <slot />
    </div>
  </section>
</template>

<script setup>
import PlatformHomeWidgetHeader from '@/components/platform/PlatformHomeWidgetHeader.vue';
import { PLATFORM_HOME_SECTION_CLASS } from '@/utils/platformHomeLayout';

defineProps({
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
</script>
