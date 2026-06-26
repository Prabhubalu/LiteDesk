<template>
  <div class="space-y-2">
    <button type="button" :class="[ui.btnGhost, 'w-full text-xs']" @click="open = true">
      <PhotoIcon class="h-4 w-4" />
      {{ t('templates.builderChooseAsset') }}
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        @click.self="open = false"
      >
        <div class="flex max-h-[80vh] w-full max-w-lg flex-col rounded-xl border bg-white shadow-xl dark:bg-neutral-900" :class="ui.border">
          <div class="flex items-center justify-between border-b px-4 py-3" :class="ui.border">
            <h3 class="text-sm font-semibold">{{ t('templates.builderAssetPickerTitle') }}</h3>
            <button type="button" :class="ui.btnIcon" @click="open = false">
              <XMarkIcon class="h-5 w-5" />
            </button>
          </div>

          <div v-if="loading" class="p-6 text-sm" :class="ui.textMuted">{{ t('states.loading') }}</div>

          <div v-else-if="!imageAssets.length" class="p-6 text-sm" :class="ui.textMuted">
            {{ t('templates.builderAssetPickerEmpty') }}
          </div>

          <div v-else class="grid grid-cols-3 gap-2 overflow-y-auto p-4">
            <button
              v-for="asset in imageAssets"
              :key="asset._id || asset.assetId"
              type="button"
              class="overflow-hidden rounded-lg border transition hover:ring-2 hover:ring-primary-400"
              :class="ui.border"
              @click="selectAsset(asset)"
            >
              <img
                :src="assetImageUrl(asset.downloadUrl)"
                :alt="asset.accessibilityAltText || asset.filename"
                class="aspect-square w-full object-cover"
              />
              <span class="block truncate px-1 py-1 text-[10px]" :class="ui.textMuted">{{ asset.filename }}</span>
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
import { getApiUrlForFetch } from '@/config/apiBase';
import { useBuilderUi } from '@/composables/useBuilderUi';

const emit = defineEmits(['select']);

const { t } = useI18n();
const ui = useBuilderUi();
const open = ref(false);
const { assets, loading, fetchAssets } = useContentAssets();

const imageAssets = computed(() =>
  assets.value.filter((asset) => String(asset.mimeType || '').startsWith('image/'))
);

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
  open.value = false;
}

watch(open, (isOpen) => {
  if (isOpen) void fetchAssets({ type: 'image', limit: 60 });
});
</script>
