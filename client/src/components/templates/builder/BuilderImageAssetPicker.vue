<template>
  <div :class="hideTrigger ? '' : 'space-y-2'">
    <button v-if="!hideTrigger" type="button" :class="[ui.btnGhost, 'w-full text-xs']" @click="openPicker">
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
              {{ title || t('templates.builderAssetPickerTitle') }}
            </h3>
            <button type="button" :class="ui.btnIcon" @click="closePicker">
              <XMarkIcon class="h-5 w-5" />
            </button>
          </div>

          <div v-if="loading" class="p-6 text-sm text-neutral-500 dark:text-neutral-400">
            {{ t('states.loading') }}
          </div>

          <div v-else-if="!companyLogoAsset && !imageAssets.length" class="p-6 text-sm text-neutral-500 dark:text-neutral-400">
            {{ t('templates.builderAssetPickerEmpty') }}
          </div>

          <div v-else class="min-h-0 flex-1 overflow-y-auto p-4">
            <button
              v-if="companyLogoAsset"
              type="button"
              class="mb-3 flex w-full items-center gap-3 overflow-hidden rounded-lg border border-neutral-200 p-2 text-left transition hover:ring-2 hover:ring-primary-400 dark:border-neutral-700"
              @click="selectAsset(companyLogoAsset)"
            >
              <img
                :src="assetImageUrl(companyLogoAsset)"
                :alt="companyLogoAsset.accessibilityAltText || companyLogoAsset.filename"
                class="h-14 w-14 rounded object-contain"
              />
              <span>
                <span class="block text-xs font-medium">{{ t('templates.builderCompanyLogoAsset') }}</span>
                <span class="block text-[10px] text-neutral-500 dark:text-neutral-400">
                  {{ t('templates.builderCompanyLogoHint') }}
                </span>
              </span>
            </button>

            <div v-if="imageAssets.length" class="grid grid-cols-3 gap-2">
              <button
                v-for="asset in imageAssets"
                :key="asset._id || asset.assetId"
                type="button"
                class="overflow-hidden rounded-lg border border-neutral-200 transition hover:ring-2 hover:ring-primary-400 dark:border-neutral-700"
                @click="selectAsset(asset)"
              >
                <img
                  :src="assetImageUrl(asset)"
                  :alt="asset.accessibilityAltText || asset.filename"
                  class="aspect-square w-full object-cover"
                />
                <span class="block truncate px-1 py-1 text-[10px] text-neutral-500 dark:text-neutral-400">
                  {{ asset.filename || asset.name }}
                </span>
              </button>
            </div>
          </div>

          <div
            v-if="allowUpload"
            class="border-t border-neutral-200 px-4 py-3 dark:border-neutral-700"
          >
            <label class="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-300 px-3 py-2 text-xs font-medium text-neutral-700 hover:border-primary-400 hover:text-primary-700 dark:border-neutral-600 dark:text-neutral-200 dark:hover:border-primary-500 dark:hover:text-primary-300">
              <PhotoIcon class="h-4 w-4" />
              {{ uploadLabel || t('templates.builderChooseAsset') }}
              <input ref="uploadInputRef" type="file" accept="image/*" class="hidden" @change="handleUpload" />
            </label>
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
import { useCompanyLogoAsset, resolveAssetDownloadUrl } from '@/modules/template/composables/useCompanyLogoAsset';
import { useMarketingAssets } from '@/composables/useMarketingAssets';
import { useBuilderUi } from '@/composables/useBuilderUi';

const props = defineProps({
  open: { type: Boolean, default: undefined },
  hideTrigger: { type: Boolean, default: false },
  allowUpload: { type: Boolean, default: false },
  title: { type: String, default: '' },
  uploadLabel: { type: String, default: '' },
  library: {
    type: String,
    default: 'content',
    validator: (value) => ['content', 'marketing'].includes(value),
  },
});

const emit = defineEmits(['select', 'update:open']);

const { t } = useI18n();
const ui = useBuilderUi();
const internalOpen = ref(false);
const uploadInputRef = ref(null);
const uploading = ref(false);
const contentAssets = useContentAssets();
const marketingAssets = useMarketingAssets();
const { asset: companyLogoAsset, ensureCompanyLogo } = useCompanyLogoAsset();

const activeLibrary = computed(() => (props.library === 'marketing' ? marketingAssets : contentAssets));

const isOpen = computed({
  get() {
    return props.open ?? internalOpen.value;
  },
  set(value) {
    internalOpen.value = value;
    emit('update:open', value);
  },
});

const imageAssets = computed(() => {
  const items = activeLibrary.value.assets.value.filter((asset) => {
    const mime = String(asset.mimeType || '');
    return mime.startsWith('image/') || String(asset.type || '') === 'logo';
  });
  const pinned = companyLogoAsset.value;
  if (!pinned) return items;
  const pinnedId = String(pinned._id || pinned.assetId || '');
  return items.filter((asset) => String(asset._id || asset.assetId || '') !== pinnedId);
});

const loading = computed(() => activeLibrary.value.loading.value || uploading.value);

function openPicker() {
  isOpen.value = true;
}

function closePicker() {
  isOpen.value = false;
}

function assetImageUrl(assetOrUrl) {
  if (!assetOrUrl) return '';
  if (typeof assetOrUrl === 'string') return resolveAssetDownloadUrl(assetOrUrl);
  const raw = assetOrUrl.downloadUrl || assetOrUrl.url || assetOrUrl.publicUrl || assetOrUrl.thumbnailUrl || '';
  return resolveAssetDownloadUrl(raw) || raw;
}

function selectAsset(asset) {
  const url = assetImageUrl(asset);
  if (!url) return;
  emit('select', {
    src: url,
    alt: asset.accessibilityAltText || asset.filename || asset.name || '',
    assetId: asset._id || asset.assetId || null,
    asset,
  });
  closePicker();
}

async function handleUpload(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  uploading.value = true;
  try {
    const asset = await activeLibrary.value.uploadAsset(file, { library: props.library });
    if (asset) selectAsset(asset);
  } catch {
    /* upload errors surfaced by composable */
  } finally {
    uploading.value = false;
  }
}

watch(isOpen, async (open) => {
  if (!open) return;
  if (props.library !== 'marketing') {
    await ensureCompanyLogo();
  }
  await activeLibrary.value.fetchAssets({ limit: 60 });
});

defineExpose({ openPicker, closePicker });
</script>
