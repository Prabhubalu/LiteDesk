<template>
  <div class="space-y-3">
    <div
      v-if="companyLogoAsset"
      class="overflow-hidden rounded-lg border"
      :class="ui.border"
    >
      <div class="border-b px-2 py-1 text-[10px] font-semibold uppercase tracking-wide" :class="[ui.border, ui.textMuted]">
        {{ t('templates.builderCompanyLogoAsset') }}
      </div>
      <button
        type="button"
        class="flex w-full items-center gap-2 p-2 text-left transition hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
        @click="selectAsset(companyLogoAsset)"
      >
        <img
          :src="assetImageUrl(companyLogoAsset.downloadUrl)"
          :alt="companyLogoAsset.accessibilityAltText || companyLogoAsset.filename"
          class="h-12 w-12 rounded object-contain"
        />
        <span class="min-w-0 flex-1">
          <span class="block truncate text-xs font-medium">{{ companyLogoAsset.filename }}</span>
          <span class="block text-[10px]" :class="ui.textMuted">{{ t('templates.builderCompanyLogoHint') }}</span>
        </span>
      </button>
    </div>

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
import { useCompanyLogoAsset, resolveAssetDownloadUrl } from '../composables/useCompanyLogoAsset';
import { useMarketingAssets } from '@/composables/useMarketingAssets';
import { useNotifications } from '@/composables/useNotifications';

const emit = defineEmits(['insert']);

const props = defineProps({
  library: {
    type: String,
    default: 'content',
    validator: (value) => ['content', 'marketing'].includes(value)
  }
});

const { t } = useI18n();
const ui = useBuilderUi();
const notifications = useNotifications();
const searchQuery = ref('');
const uploadBusy = ref(false);
const contentAssets = useContentAssets();
const marketingAssets = useMarketingAssets();
const { asset: companyLogoAsset, ensureCompanyLogo } = useCompanyLogoAsset();
const activeLibrary = computed(() => (props.library === 'marketing' ? marketingAssets : contentAssets));

const imageAssets = computed(() =>
  activeLibrary.value.assets.value.filter((asset) => {
    const mime = String(asset.mimeType || '');
    return mime.startsWith('image/') || String(asset.type || '') === 'logo';
  }).filter((asset) => {
    if (!companyLogoAsset.value) return true;
    return String(asset._id || asset.assetId || '') !== String(companyLogoAsset.value._id || companyLogoAsset.value.assetId || '');
  })
);

const loading = computed(() => activeLibrary.value.loading.value);

function assetImageUrl(downloadUrl) {
  return resolveAssetDownloadUrl(downloadUrl);
}

async function loadAssets() {
  if (props.library !== 'marketing') {
    await ensureCompanyLogo();
  }
  await activeLibrary.value.fetchAssets({
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
    const created = await activeLibrary.value.uploadAsset(file, {
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

onMounted(async () => {
  if (props.library !== 'marketing') {
    await ensureCompanyLogo();
  }
  await loadAssets();
});
</script>
