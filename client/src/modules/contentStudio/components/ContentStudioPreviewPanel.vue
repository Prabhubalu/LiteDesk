<template>
  <div class="absolute inset-0 z-20 flex flex-col bg-neutral-100 dark:bg-neutral-950">
    <div class="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-2 dark:border-neutral-800 dark:bg-neutral-900">
      <p class="text-sm font-medium text-neutral-900 dark:text-neutral-100">{{ t('contentStudio.preview') }}</p>
      <button type="button" :class="ui.btnGhost" @click="emit('close')">
        {{ t('actions.close') }}
      </button>
    </div>

    <div v-if="loading" class="flex flex-1 items-center justify-center">
      <p class="text-sm text-neutral-500">{{ t('states.loading') }}</p>
    </div>

    <div v-else-if="error" class="flex flex-1 items-center justify-center p-6">
      <p class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
    </div>

    <div v-else :class="[ui.canvasOuter, 'min-h-0 flex-1 overflow-y-auto']">
      <ContentStudioPublishedArticleView
        :title="title"
        :subtitle="subtitle"
        :cover-image-url="coverImageUrl"
        :presentation="presentation"
        :body-html="bodyHtml"
        :author-name="authorName"
        :read-minutes="readMinutes"
        :preview-device="previewDevice"
      />
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useBuilderUi } from '@/composables/useBuilderUi';
import { renderContentPreview } from '../services/contentStudioApi';
import ContentStudioPublishedArticleView from './ContentStudioPublishedArticleView.vue';

const props = defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  blocks: { type: Object, default: null },
  previewDevice: { type: String, default: 'desktop' },
  mode: { type: String, default: 'articles' },
  coverImageUrl: { type: String, default: '' },
  presentation: { type: Object, default: () => ({}) },
  readMinutes: { type: Number, default: 1 },
  authorName: { type: String, default: '' },
});

const emit = defineEmits(['close']);

const { t } = useI18n();
const ui = useBuilderUi();

const loading = ref(true);
const error = ref('');
const bodyHtml = ref('');

async function loadPreview() {
  loading.value = true;
  error.value = '';
  try {
    bodyHtml.value = await renderContentPreview({
      blocks: props.blocks,
      bodyOnly: true,
    });
  } catch (err) {
    error.value = err?.message || t('contentStudio.previewFailed');
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void loadPreview();
});

watch(
  () => [props.blocks, props.previewDevice],
  () => {
    void loadPreview();
  },
);
</script>
