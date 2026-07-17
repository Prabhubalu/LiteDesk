<template>
  <div v-if="hasMedia" class="space-y-3">
    <img
      v-if="safeImageUrl"
      :src="safeImageUrl"
      :alt="imageAlt"
      class="max-h-48 w-full rounded-lg object-cover"
      loading="lazy"
      referrerpolicy="no-referrer"
    >
    <div
      v-if="embedUrl"
      class="aspect-video overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-950"
    >
      <iframe
        :src="embedUrl"
        class="h-full w-full border-0"
        title="YouTube video"
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
        referrerpolicy="strict-origin-when-cross-origin"
      />
    </div>
    <ul v-if="safeAttachments.length" class="space-y-1">
      <li v-for="(file, index) in safeAttachments" :key="`${file.url}-${index}`">
        <a
          :href="file.url"
          target="_blank"
          rel="noopener noreferrer"
          class="text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
        >
          {{ file.name || t('announcements.attachmentFallback') }}
        </a>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  isSafeMediaUrl,
  youtubeEmbedUrl,
} from '@/utils/announcementMedia';

type Attachment = {
  name?: string | null;
  url?: string | null;
  mime?: string | null;
  size?: number | null;
};

const props = defineProps<{
  imageUrl?: string | null;
  youtubeUrl?: string | null;
  attachments?: Attachment[] | null;
  imageAlt?: string;
}>();

const { t } = useI18n();

const safeImageUrl = computed(() => (
  isSafeMediaUrl(props.imageUrl) ? String(props.imageUrl).trim() : null
));
const embedUrl = computed(() => youtubeEmbedUrl(props.youtubeUrl));
const safeAttachments = computed(() => (
  (props.attachments || [])
    .filter((file) => isSafeMediaUrl(file?.url))
    .map((file) => ({
      name: file.name || '',
      url: String(file.url).trim(),
    }))
    .slice(0, 5)
));
const hasMedia = computed(() => (
  Boolean(safeImageUrl.value || embedUrl.value || safeAttachments.value.length)
));
</script>
