<template>
  <article :class="rootClass">
    <header :class="headerClass">
      <div class="flex flex-wrap items-center gap-2">
        <span
          class="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
        >
          {{ release.version }}
        </span>
        <time
          v-if="publishedLabel"
          :datetime="release.publishedAt"
          class="text-xs text-gray-500 dark:text-gray-400"
        >
          {{ publishedLabel }}
        </time>
      </div>
      <h3 class="mt-2 text-base font-semibold leading-snug text-gray-900 dark:text-white">
        <span>{{ release.title }}</span>
        <template v-if="release.summary">
          <span class="px-1.5 font-normal text-gray-300 dark:text-gray-600" aria-hidden="true">·</span>
          <span class="font-normal text-gray-600 dark:text-gray-400">{{ release.summary }}</span>
        </template>
      </h3>
    </header>

    <div class="mt-4">
      <div class="divide-y divide-gray-100 dark:divide-gray-800">
        <ReleaseNoteItemRow
          v-for="item in sortedItems"
          :key="item.id"
          :release-id="release.id"
          :release-version="release.version"
          :item-id="item.id"
          :item-type="item.type"
          :title="item.title"
          :description-html="item.descriptionHtml || item.description"
          :image-url="item.imageUrl"
          :cta-label="item.ctaLabel"
          :cta-url="item.ctaUrl"
          @navigate="$emit('navigate')"
        />
      </div>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import ReleaseNoteItemRow from '@/components/release-notes/ReleaseNoteItemRow.vue';

const props = defineProps({
  release: {
    type: Object,
    required: true
  },
  embedded: {
    type: Boolean,
    default: false
  }
});

defineEmits(['navigate']);

const { t, locale } = useI18n();

const sortedItems = computed(() => {
  const items = Array.isArray(props.release?.items) ? [...props.release.items] : [];
  return items.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
});

const rootClass = computed(() =>
  props.embedded
    ? 'space-y-5'
    : 'rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900/40'
);

const headerClass = computed(() =>
  props.embedded ? 'pb-1' : 'mb-4 border-b border-gray-100 pb-4 dark:border-gray-800'
);

const publishedLabel = computed(() => {
  const raw = props.release?.publishedAt;
  if (!raw) return '';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';
  return t('releaseNotes.publishedOn', {
    date: new Intl.DateTimeFormat(locale.value, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(date)
  });
});
</script>
