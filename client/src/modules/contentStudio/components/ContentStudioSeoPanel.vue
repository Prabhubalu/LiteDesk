<template>
  <div class="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
    <div class="rounded-lg border border-neutral-200 p-3 dark:border-neutral-700">
      <div class="flex items-center justify-between gap-3">
        <p class="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          {{ t('contentStudio.seoScoreTitle') }}
        </p>
        <p class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{{ seoScore }}/100</p>
      </div>
      <div class="mt-2 h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
        <div class="h-full rounded-full bg-primary-600 transition-all" :style="{ width: `${seoScore}%` }" />
      </div>
    </div>

    <div>
      <label :class="ui.label">{{ t('contentStudio.fieldMetaTitle') }}</label>
      <input
        :value="seoMetaTitle"
        type="text"
        :class="[ui.input, 'mt-1']"
        @input="emit('update:seoMetaTitle', $event.target.value)"
      />
      <p class="mt-1 text-xs text-neutral-500">{{ metaTitleCount }}/60</p>
    </div>
    <div>
      <label :class="ui.label">{{ t('contentStudio.fieldMetaDescription') }}</label>
      <textarea
        :value="seoMetaDescription"
        rows="5"
        :class="[ui.input, 'mt-1']"
        @input="emit('update:seoMetaDescription', $event.target.value)"
      />
      <p class="mt-1 text-xs text-neutral-500">{{ metaDescriptionCount }}/160</p>
    </div>
    <div>
      <label :class="ui.label">{{ t('contentStudio.fieldSlug') }}</label>
      <input
        :value="slug"
        type="text"
        :class="[ui.input, 'mt-1']"
        @input="emit('update:slug', $event.target.value)"
      />
    </div>
    <div>
      <label :class="ui.label">{{ t('contentStudio.fieldSummary') }}</label>
      <textarea
        :value="summary"
        rows="3"
        :class="[ui.input, 'mt-1']"
        @input="emit('update:summary', $event.target.value)"
      />
    </div>

    <div class="border-t border-neutral-200 pt-4 dark:border-neutral-800">
      <p :class="ui.label">{{ t('contentStudio.ogPreview') }}</p>
      <div class="mt-2 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800/50">
        <div
          v-if="coverImageUrl"
          class="h-28 bg-cover bg-center"
          :style="{ backgroundImage: `url(${coverImageUrl})` }"
        />
        <div v-else class="flex h-28 items-center justify-center bg-neutral-100 text-xs text-neutral-400 dark:bg-neutral-800">
          {{ t('contentStudio.ogPreviewNoImage') }}
        </div>
        <div class="space-y-1 p-3">
          <p class="line-clamp-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100">{{ ogTitle }}</p>
          <p class="line-clamp-2 text-xs text-neutral-600 dark:text-neutral-400">{{ ogDescription }}</p>
          <p class="truncate font-mono text-[11px] text-neutral-400">{{ ogUrl }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useBuilderUi } from '@/composables/useBuilderUi';
import { buildHeadlessArticleCustomerUrl, buildHeadlessBlogCustomerUrl } from '@/modules/contentStudio/headless';

const props = defineProps({
  mode: { type: String, default: 'articles' },
  title: { type: String, default: '' },
  summary: { type: String, default: '' },
  slug: { type: String, default: '' },
  seoMetaTitle: { type: String, default: '' },
  seoMetaDescription: { type: String, default: '' },
  seoCanonicalUrl: { type: String, default: '' },
  coverImageUrl: { type: String, default: '' },
});

const emit = defineEmits(['update:summary', 'update:slug', 'update:seoMetaTitle', 'update:seoMetaDescription']);

const { t } = useI18n();
const ui = useBuilderUi();

const metaTitleCount = computed(() => String(props.seoMetaTitle || '').length);
const metaDescriptionCount = computed(() => String(props.seoMetaDescription || '').length);
const titlePlaceholder = computed(() => (
  props.mode === 'blog'
    ? t('contentStudio.titlePlaceholderBlog')
    : t('contentStudio.titlePlaceholder')
));
const ogTitle = computed(() => props.seoMetaTitle || props.title || titlePlaceholder.value);
const ogDescription = computed(() => props.seoMetaDescription || props.summary || props.title || '');
const ogUrl = computed(() => (
  props.mode === 'blog'
    ? buildHeadlessBlogCustomerUrl(props.slug, props.seoCanonicalUrl)
    : buildHeadlessArticleCustomerUrl(props.slug, props.seoCanonicalUrl)
));

function scoreMetaTitle(length) {
  if (!length) return 0;
  if (length >= 30 && length <= 60) return 30;
  if (length > 0 && length < 30) return 18;
  if (length > 60 && length <= 70) return 18;
  return 8;
}

function scoreMetaDescription(length) {
  if (!length) return 0;
  if (length >= 70 && length <= 160) return 30;
  if (length > 0 && length < 70) return 16;
  if (length > 160 && length <= 200) return 16;
  return 8;
}

const seoScore = computed(() => {
  let score = 0;
  score += scoreMetaTitle(metaTitleCount.value);
  score += scoreMetaDescription(metaDescriptionCount.value);
  if (String(props.slug || '').trim()) score += 20;
  if (String(props.title || '').trim()) score += 20;
  return Math.min(100, Math.max(0, score));
});
</script>
