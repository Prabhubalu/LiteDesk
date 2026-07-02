<template>
  <div class="space-y-2">
    <button type="button" :class="[ui.btnGhost, 'w-full text-xs']" @click="openPicker">
      <PhotoIcon class="h-4 w-4" />
      {{ t('templates.builderChooseAsset') }}
    </button>

    <Teleport to="body">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
        @click.self="closePicker"
      >
        <div
          class="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white text-neutral-900 shadow-xl dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          role="dialog"
          aria-modal="true"
        >
          <div class="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-700">
            <h3 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {{ t('templates.builderAssetPickerTitle') }}
            </h3>
            <button type="button" :class="ui.btnIcon" @click="closePicker">
              <XMarkIcon class="h-5 w-5" />
            </button>
          </div>

          <div v-if="loading" class="p-6 text-sm text-neutral-500 dark:text-neutral-400">
            {{ t('states.loading') }}
          </div>

          <div v-else-if="!imageAssets.length" class="p-6 text-sm text-neutral-500 dark:text-neutral-400">
            {{ t('templates.builderAssetPickerEmpty') }}
          </div>

          <div v-else class="grid grid-cols-3 gap-2 overflow-y-auto p-4">
            <button
              v-for="asset in imageAssets"
              :key="asset._id || asset.assetId"
              type="button"
              class="overflow-hidden rounded-lg border border-neutral-200 transition hover:ring-2 hover:ring-primary-400 dark:border-neutral-700"
              @click="selectAsset(asset)"
            >
              <img
                :src="assetImageUrl(asset.downloadUrl)"
                :alt="asset.accessibilityAltText || asset.filename"
                class="aspect-square w-full object-cover"
              />
              <span class="block truncate px-1 py-1 text-[10px] text-neutral-500 dark:text-neutral-400">
                {{ asset.filename }}
              </span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { PhotoIcon, XMarkIcon } from '@heroicons/vue/24/outline';
import { useContentAssets } from '@/composables/useContentAssets';
import { useMarketingAssets } from '@/composables/useMarketingAssets';
import { getApiUrlForFetch } from '@/config/apiBase';
import { useBuilderUi } from '@/composables/useBuilderUi';

const props = defineProps({
  open: { type: Boolean, default: undefined },
  library: {
    type: String,
    default: 'content',
    validator: (value) => ['content', 'marketing'].includes(value)
  }
});

const emit = defineEmits(['select', 'update:open']);

const { t } = useI18n();
const ui = useBuilderUi();
const internalOpen = ref(false);
const contentAssets = useContentAssets();
const marketingAssets = useMarketingAssets();

const activeLibrary = computed(() => (props.library === 'marketing' ? marketingAssets : contentAssets));

const isOpen = computed({
  get() {
    return props.open ?? internalOpen.value;
  },
  set(value) {
    internalOpen.value = value;
    emit('update:open', value);
  }
});

const imageAssets = computed(() =>
  activeLibrary.value.assets.value.filter((asset) => String(asset.mimeType || '').startsWith('image/'))
);

const loading = computed(() => activeLibrary.value.loading.value);

function openPicker() {
  isOpen.value = true;
}

function closePicker() {
  isOpen.value = false;
}

function assetImageUrl(downloadUrl) {
  if (!downloadUrl) return '';
  if (downloadUrl.startsWith('http')) return downloadUrl;
  return getApiUrlForFetch(downloadUrl);
}

function selectAsset(asset) {
  const url = assetImageUrl(asset.downloadUrl);
  if (!url) return;
  emit('select', {
    src: url,
    alt: asset.accessibilityAltText || asset.filename || ''
  });
  closePicker();
}

watch(isOpen, (open) => {
  if (open) void activeLibrary.value.fetchAssets({ type: 'image', limit: 60 });
});
</script>
