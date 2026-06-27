<template>
  <PortalPageShell
    :error="error"
    :back-label="backLabel"
    :show-branding="showBranding"
    :wide="wide"
    :fill-height="usesFillHeight"
    @back="$emit('back')"
  >
    <div v-if="loading" :class="[skeletonClass, PLATFORM_HOME_SKELETON_CLASS]" />

    <template v-else-if="$slots.default">
      <div
        :class="[
          usesFillHeight
            ? splitLayout
              ? 'flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-y-contain arivu-scrollbar lg:grid lg:overflow-hidden lg:grid-cols-[minmax(17rem,22rem)_minmax(0,1fr)] lg:items-stretch'
              : 'flex min-h-0 flex-1 flex-col overflow-hidden'
            : splitLayout
              ? 'flex min-h-[calc(100dvh-12rem)] flex-col gap-4 lg:grid lg:min-h-[calc(100dvh-8.5rem)] lg:grid-cols-[minmax(17rem,22rem)_minmax(0,1fr)] lg:items-stretch'
              : compact
                ? 'flex min-h-[calc(100dvh-12rem)] flex-col lg:min-h-[calc(100dvh-9rem)]'
                : ''
        ]"
      >
        <aside
          v-if="splitLayout && hasHeaderContent"
          class="order-2 flex shrink-0 flex-col gap-4 lg:order-1 lg:min-h-0 lg:overflow-y-auto lg:overscroll-y-contain lg:pr-0.5 arivu-scrollbar"
          :class="usesFillHeight ? 'lg:max-h-full' : ''"
        >
          <div :class="['p-5', PLATFORM_HOME_CARD_CLASS]">
            <p v-if="eyebrow" class="text-xs font-mono tracking-wide text-neutral-500 dark:text-neutral-400">
              {{ eyebrow }}
            </p>
            <h1 class="mt-1 text-lg font-semibold tracking-tight text-neutral-900 dark:text-white sm:text-xl">
              {{ title }}
            </h1>
            <div v-if="$slots.badges" class="mt-3 flex flex-wrap items-center gap-2">
              <slot name="badges" />
            </div>
            <div v-if="$slots['header-extra']" class="mt-4">
              <slot name="header-extra" />
            </div>
          </div>
          <slot name="sidebar" />
        </aside>

        <header
          v-else-if="!splitLayout && hasHeaderContent"
          :class="['shrink-0 p-5', PLATFORM_HOME_CARD_CLASS, compact ? 'pb-3' : '']"
        >
          <p v-if="eyebrow" class="text-xs font-mono tracking-wide text-neutral-500 dark:text-neutral-400">
            {{ eyebrow }}
          </p>
          <div :class="compact ? 'mt-1 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between' : ''">
            <h1
              :class="[
                'font-semibold tracking-tight text-neutral-900 dark:text-white',
                compact ? 'text-lg sm:text-xl' : 'mt-1 text-xl sm:text-2xl'
              ]"
            >
              {{ title }}
            </h1>
            <div
              v-if="$slots.badges"
              :class="compact ? 'flex flex-wrap items-center gap-2 sm:justify-end' : 'mt-3 flex flex-wrap items-center gap-2'"
            >
              <slot name="badges" />
            </div>
          </div>
          <p
            v-if="description && !compact"
            class="mt-4 whitespace-pre-wrap text-sm text-neutral-700 dark:text-neutral-300"
          >
            {{ description }}
          </p>
          <div v-if="$slots['header-extra']" class="mt-3">
            <slot name="header-extra" />
          </div>
        </header>

        <div
          :class="[
            splitLayout
              ? 'order-1 flex min-h-[calc(100dvh-14rem)] min-w-0 flex-1 flex-col lg:order-2 lg:min-h-0 lg:h-full'
              : compact
                ? 'flex min-h-0 flex-1 flex-col gap-4'
                : 'space-y-4'
          ]"
        >
          <slot />
        </div>
      </div>
    </template>
  </PortalPageShell>
</template>

<script setup>
import { computed, useSlots } from 'vue';
import PortalPageShell from '@/components/portal/PortalPageShell.vue';
import { PLATFORM_HOME_CARD_CLASS, PLATFORM_HOME_SKELETON_CLASS } from '@/utils/platformHomeLayout';

const props = defineProps({
  title: { type: String, default: '' },
  eyebrow: { type: String, default: '' },
  description: { type: String, default: '' },
  error: { type: String, default: '' },
  backLabel: { type: String, default: '' },
  loading: { type: Boolean, default: false },
  showBranding: { type: Boolean, default: true },
  compact: { type: Boolean, default: false },
  splitLayout: { type: Boolean, default: false },
  wide: { type: Boolean, default: false },
  skeletonClass: { type: String, default: 'h-48' }
});

defineEmits(['back']);

const slots = useSlots();

const usesFillHeight = computed(() => props.compact || props.splitLayout);

const hasHeaderContent = computed(() => Boolean(
  props.title
  || props.eyebrow
  || props.description
  || slots.badges
  || slots['header-extra']
));
</script>
