<template>
  <div
    :class="[
      fillHeight
        ? 'flex h-full min-h-0 w-full flex-col overflow-hidden'
        : 'min-h-full w-full'
    ]"
  >
    <div
      :class="[
        'mx-auto flex w-full flex-col',
        fillHeight ? 'min-h-0 flex-1 overflow-hidden px-4 pb-2 pt-2 lg:px-6' : 'space-y-4 pb-2',
        wide ? 'max-w-7xl' : 'max-w-5xl'
      ]"
    >
      <PortalBrandingBar v-if="showBranding" class="shrink-0" />

      <div
        v-if="error"
        :class="['shrink-0 px-4 py-3.5', PLATFORM_HOME_ALERT_ERROR_CLASS]"
      >
        <p class="text-sm font-medium text-danger-900 dark:text-danger-100">{{ error }}</p>
      </div>

      <header
        v-if="title || backLabel || $slots.actions"
        class="flex shrink-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
      >
        <div class="min-w-0">
          <button
            v-if="backLabel"
            type="button"
            class="mb-2 inline-flex items-center gap-1 text-sm text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
            @click="$emit('back')"
          >
            <ChevronLeftIcon class="h-4 w-4" />
            {{ backLabel }}
          </button>
          <h1
            v-if="title"
            class="text-xl font-semibold tracking-tight text-neutral-900 dark:text-white sm:text-2xl"
          >
            {{ title }}
          </h1>
          <p v-if="subtitle" class="mt-1 text-sm leading-relaxed text-neutral-600 dark:text-neutral-300">
            {{ subtitle }}
          </p>
        </div>
        <div v-if="$slots.actions" class="flex shrink-0 flex-wrap items-center gap-2">
          <slot name="actions" />
        </div>
      </header>

      <div
        v-if="fillHeight"
        class="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <slot />
      </div>
      <slot v-else />
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { ChevronLeftIcon } from '@heroicons/vue/24/outline';
import PortalBrandingBar from '@/components/portal/PortalBrandingBar.vue';
import { usePortalBranding } from '@/composables/usePortalBranding';
import { PLATFORM_HOME_ALERT_ERROR_CLASS } from '@/utils/platformHomeLayout';

defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  error: { type: String, default: '' },
  backLabel: { type: String, default: '' },
  showBranding: { type: Boolean, default: true },
  wide: { type: Boolean, default: false },
  fillHeight: { type: Boolean, default: false }
});

defineEmits(['back']);

const { loadBranding } = usePortalBranding();
onMounted(() => {
  void loadBranding();
});
</script>
