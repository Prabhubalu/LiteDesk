<template>
  <div :class="shell.className" :style="shellStyle">
    <div
      v-if="shell.appearance.showLogoInHeader && resolvedLogoUrl"
      class="content-studio-article__brand mx-auto px-6 pt-6 md:px-10"
      :style="shell.canvasStyle"
    >
      <img :src="resolvedLogoUrl" alt="" class="content-studio-article__logo" />
    </div>

    <div class="content-studio-article__body">
      <article
        :class="[ui.canvasPaper, 'mx-auto px-6 py-8 md:px-10 md:py-10']"
        :style="shell.canvasStyle"
      >
        <div v-if="useHeroOverlap && coverImageUrl" class="relative mb-4 overflow-hidden rounded-xl">
          <img :src="coverImageUrl" alt="" class="max-h-96 min-h-72 w-full object-cover" />
          <div class="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
          <div class="absolute inset-x-0 bottom-0 p-5 md:p-6">
            <h1 v-if="title" :class="CONTENT_STUDIO_TITLE_OVERLAP_PREVIEW_BASE_CLASS" :style="titleStyle">{{ title }}</h1>
            <p v-if="hasSubtitle" :class="subtitleOverlapPreviewClass" :style="subtitleStyle">{{ subtitle }}</p>
          </div>
        </div>

        <template v-else>
          <template v-if="!coverFirst">
            <h1 v-if="title" :class="CONTENT_STUDIO_TITLE_PREVIEW_BASE_CLASS" :style="titleStyle">{{ title }}</h1>
            <p v-if="hasSubtitle" :class="subtitlePreviewClass" :style="subtitleStyle">{{ subtitle }}</p>
          </template>

          <img
            v-if="coverImageUrl"
            :src="coverImageUrl"
            alt=""
            :class="[coverFirst ? '' : 'mt-4', 'max-h-72 w-full rounded-xl object-cover']"
          />

          <template v-if="coverFirst">
            <h1 v-if="title" :class="[CONTENT_STUDIO_TITLE_PREVIEW_BASE_CLASS, 'mt-4']" :style="titleStyle">{{ title }}</h1>
            <p v-if="hasSubtitle" :class="subtitlePreviewClass" :style="subtitleStyle">{{ subtitle }}</p>
          </template>
        </template>

        <div :class="CONTENT_STUDIO_META_ROW_CLASS">
          <div class="inline-flex items-center gap-2">
            <span class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700 dark:bg-primary-950 dark:text-primary-300">
              {{ authorInitials }}
            </span>
            <span>{{ resolvedAuthorName }}</span>
          </div>
          <span>{{ formattedDate }}</span>
          <span>{{ readTimeLabel }}</span>
        </div>

        <div ref="bodyRoot" :class="CONTENT_STUDIO_EDITOR_PROSE_CLASS">
          <div class="content-studio-tiptap outline-none min-h-[120px]" v-html="bodyHtml" />
        </div>
      </article>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useBuilderUi } from '@/composables/useBuilderUi';
import {
  CONTENT_STUDIO_EDITOR_PROSE_CLASS,
  CONTENT_STUDIO_META_ROW_CLASS,
  CONTENT_STUDIO_TITLE_OVERLAP_PREVIEW_BASE_CLASS,
  CONTENT_STUDIO_TITLE_PREVIEW_BASE_CLASS,
  resolveArticleChromeLayout,
  resolveArticleChromeColors,
  contentStudioSubtitleSizeClass,
  contentStudioSubtitleOverlapSizeClass,
} from '../editor/articlePresentation';
import { initContentStudioGalleries } from '../editor/contentStudioGallery';
import { buildArticleAppearanceShell, resolvePublicAssetUrl } from '../utils/articleAppearance';
import '../editor/contentStudioGallery.css';
import '../editor/contentStudioChecklist.css';
import '../editor/contentStudioFaq.css';
import '../editor/contentStudioSteps.css';
import '../editor/contentStudioTabs.css';
import '../editor/contentStudioRelatedArticles.css';
import '../editor/contentStudioArticleAppearance.css';

const props = defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  coverImageUrl: { type: String, default: '' },
  presentation: { type: Object, default: () => ({}) },
  bodyHtml: { type: String, default: '' },
  authorName: { type: String, default: '' },
  publishedAt: { type: String, default: '' },
  readMinutes: { type: Number, default: 1 },
  appearance: { type: Object, default: null },
  contentWidth: { type: String, default: 'standard' },
});

const { t } = useI18n();
const ui = useBuilderUi();
const bodyRoot = ref(null);

const chromeLayout = computed(() => resolveArticleChromeLayout(props.presentation));
const coverFirst = computed(() => chromeLayout.value.coverFirst);
const useHeroOverlap = computed(() => chromeLayout.value.useHeroOverlap && Boolean(props.coverImageUrl));

const shell = computed(() => buildArticleAppearanceShell(
  props.appearance || { contentWidth: props.contentWidth },
));

const chromeColors = computed(() => resolveArticleChromeColors(
  props.presentation,
  { heroOverlap: useHeroOverlap.value },
));

const shellStyle = computed(() => ({
  ...shell.value.style,
  '--cs-heading-color': chromeColors.value.headingColor,
  '--cs-subheading-color': chromeColors.value.subheadingColor,
}));

const titleStyle = computed(() => ({
  color: chromeColors.value.headingColor,
  fontFamily: shell.value.appearance.headingFont,
}));

const subtitleStyle = computed(() => ({
  color: chromeColors.value.subheadingColor,
}));

const subtitlePreviewClass = computed(() => `mt-3 w-full ${contentStudioSubtitleSizeClass(chromeLayout.value.subtitleSize)}`);
const subtitleOverlapPreviewClass = computed(() => `mt-2 w-full ${contentStudioSubtitleOverlapSizeClass(chromeLayout.value.subtitleSize)}`);

const resolvedLogoUrl = computed(() => resolvePublicAssetUrl(shell.value.appearance.logoUrl));

const hasSubtitle = computed(() => String(props.subtitle || '').trim().length > 0);

const resolvedAuthorName = computed(() => props.authorName || t('contentStudio.authorFallback'));
const authorInitials = computed(() => {
  const parts = String(resolvedAuthorName.value).trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || 'A';
});
const formattedDate = computed(() => {
  if (!props.publishedAt) {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date());
  }
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(props.publishedAt));
});
const readTimeLabel = computed(() => t('contentStudio.readTime', { minutes: props.readMinutes }));

async function syncGalleries() {
  await nextTick();
  if (bodyRoot.value) initContentStudioGalleries(bodyRoot.value);
}

onMounted(() => {
  void syncGalleries();
});

watch(() => props.bodyHtml, () => {
  void syncGalleries();
});
</script>
