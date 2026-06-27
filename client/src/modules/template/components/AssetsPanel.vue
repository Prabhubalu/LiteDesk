<template>
  <div class="space-y-3">
    <div class="flex gap-2">
      <input
        v-model="searchQuery"
        type="search"
        :placeholder="t('templates.assetsSearchPlaceholder')"
        :class="[ui.input, 'flex-1 text-xs']"
        @keyup.enter="loadAssets"
      />
      <label :class="[ui.btnGhost, 'cursor-pointer text-xs']">
        <input type="file" accept="image/*" class="hidden" @change="onUpload" />
        {{ uploadBusy ? t('states.saving') : t('templates.uploadAsset') }}
      </label>
    </div>

    <div v-if="loading" class="text-sm" :class="ui.textMuted">{{ t('states.loading') }}</div>

    <div v-else-if="!imageAssets.length" class="text-sm" :class="ui.textMuted">
      {{ t('templates.builderAssetPickerEmpty') }}
    </div>

    <div v-else class="grid grid-cols-2 gap-2">
      <button
        v-for="asset in imageAssets"
        :key="asset._id || asset.assetId"
        type="button"
        class="overflow-hidden rounded-lg border text-left transition hover:ring-2 hover:ring-primary-400"
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
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useBuilderUi } from '@/composables/useBuilderUi';
import { useContentAssets } from '@/composables/useContentAssets';
import { useNotifications } from '@/composables/useNotifications';
import { getApiUrlForFetch } from '@/config/apiBase';

const emit = defineEmits(['insert']);

const { t } = useI18n();
const ui = useBuilderUi();
const notifications = useNotifications();
const searchQuery = ref('');
const uploadBusy = ref(false);
const { assets, loading, fetchAssets, uploadAsset } = useContentAssets();

const imageAssets = computed(() =>
  assets.value.filter((asset) => String(asset.mimeType || '').startsWith('image/'))
);

function assetImageUrl(downloadUrl) {
  if (!downloadUrl) return '';
  if (downloadUrl.startsWith('http')) return downloadUrl;
  return getApiUrlForFetch(downloadUrl);
}

async function loadAssets() {
  await fetchAssets({
    type: 'image',
    limit: 60,
    search: searchQuery.value.trim() || undefined
  });
}

function selectAsset(asset) {
  const url = assetImageUrl(asset.downloadUrl);
  if (!url) return;
  emit('insert', {
    src: url,
    alt: asset.accessibilityAltText || asset.filename || ''
  });
}

async function onUpload(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;

  uploadBusy.value = true;
  try {
    const created = await uploadAsset(file, {
      type: 'image',
      accessibilityAltText: file.name
    });
    await loadAssets();
    selectAsset(created);
    notifications.success(t('templates.assetUploadSuccess'));
  } catch (error) {
    notifications.error(error?.message || t('templates.assetUploadFailed'));
  } finally {
    uploadBusy.value = false;
  }
}

onMounted(() => {
  void loadAssets();
});
</script>
