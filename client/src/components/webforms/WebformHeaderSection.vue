<template>
  <header
    :class="[
      WEBFORM_CARD_HEADER_IMAGE_WRAP_CLASS,
      hasBackground
        ? [
          'relative min-h-[9rem] px-6 sm:px-8',
          verticallyCenterContent ? 'flex flex-col justify-center py-6' : 'py-8'
        ]
        : 'px-6 pt-6 sm:px-8 sm:pt-8',
      !hasBackground ? 'pb-2' : ''
    ]"
    :style="headerBackgroundStyle"
  >
    <div
      v-if="hasBackgroundImage"
      class="pointer-events-none absolute inset-0 bg-black/25"
      aria-hidden="true"
    />

    <div
      :class="[
        'relative flex flex-col gap-3',
        verticallyCenterContent ? 'w-full' : '',
        contentAlignClass
      ]"
    >
      <img
        v-if="branding.logoUrl"
        :src="resolveWebformImageUrl(branding.logoUrl)"
        alt=""
        :class="['w-auto shrink-0 object-contain', logoSizeClass]"
      >

      <div class="space-y-2">
        <h1
          :class="['text-2xl font-bold', headingDefaultClass]"
          :style="headingColorStyle"
        >
          {{ title }}
        </h1>
        <p
          v-if="description"
          :class="['text-sm', descriptionColorClass]"
        >
          {{ description }}
        </p>
        <p
          v-if="previewBadge"
          class="mt-2 text-xs font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400"
        >
          {{ previewBadge }}
        </p>
      </div>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue';
import { resolveWebformImageUrl } from '@/utils/webformFormatters';
import { mergeWebformBranding } from '@/utils/webformBranding';
import {
  webformHeaderBackgroundStyle,
  webformHeaderContentAlignClass,
  webformHeaderHasBackground,
  webformHeadingColorStyle,
  webformHeadingDefaultClass,
  webformDescriptionColorClass,
  webformLogoSizeClass
} from '@/utils/webformHeader';
import { WEBFORM_CARD_HEADER_IMAGE_WRAP_CLASS } from '@/utils/webformUiClasses';

const props = defineProps({
  webform: { type: Object, required: true },
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  previewBadge: { type: String, default: '' }
});

const branding = computed(() => mergeWebformBranding(props.webform?.branding));
const hasBackgroundImage = computed(() => Boolean(String(props.webform?.headerImageUrl || '').trim()));
const hasBackground = computed(() => webformHeaderHasBackground(props.webform));
const verticallyCenterContent = computed(() =>
  hasBackground.value && !branding.value.logoUrl
);
const headerBackgroundStyle = computed(() => webformHeaderBackgroundStyle(props.webform));
const contentAlignClass = computed(() => webformHeaderContentAlignClass(branding.value.logoPosition));
const logoSizeClass = computed(() => webformLogoSizeClass(branding.value.logoSize));
const headingColorStyle = computed(() =>
  webformHeadingColorStyle(branding.value, { hasBackground: hasBackground.value })
);
const headingDefaultClass = computed(() =>
  webformHeadingDefaultClass(branding.value, { hasBackground: hasBackground.value })
);
const descriptionColorClass = computed(() =>
  webformDescriptionColorClass(branding.value, { hasBackground: hasBackground.value })
);
</script>
