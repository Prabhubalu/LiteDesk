<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="border-b border-neutral-200 px-3 py-2 dark:border-neutral-800">
      <input
        v-model="search"
        type="search"
        :class="ui.input"
        :placeholder="t('contentStudio.searchMedia')"
        @keyup.enter="loadAssets"
      />
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto p-3">
      <p v-if="loading" class="text-sm text-neutral-500">{{ t('states.loading') }}</p>
      <p v-else-if="!assets.length" class="text-sm text-neutral-500">{{ t('contentStudio.emptyMedia') }}</p>
      <div v-else class="grid grid-cols-2 gap-2">
        <button
          v-for="asset in assets"
          :key="asset._id || asset.assetId"
          type="button"
          class="group overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 text-left dark:border-neutral-700 dark:bg-neutral-800/50"
          @click="emit('insert-image', asset)"
        >
          <img
            v-if="assetUrl(asset)"
            :src="assetUrl(asset)"
            :alt="asset.name || asset.filename || ''"
            class="aspect-video w-full object-cover transition group-hover:opacity-90"
            loading="lazy"
          />
          <p class="truncate px-2 py-1.5 text-xs text-neutral-700 dark:text-neutral-200">
            {{ asset.name || asset.filename || t('contentStudio.untitledAsset') }}
          </p>
        </button>
      </div>
    </div>

    <div class="border-t border-neutral-200 p-3 dark:border-neutral-800">
      <label class="block">
        <span class="sr-only">{{ t('contentStudio.uploadMedia') }}</span>
        <input type="file" accept="image/*" class="block w-full text-xs" @change="handleUpload" />
      </label>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useBuilderUi } from '@/composables/useBuilderUi';
import { useContentAssets } from '@/composables/useContentAssets';
import { useMarketingAssets } from '@/composables/useMarketingAssets';

const props = defineProps({
  mode: { type: String, default: 'articles' },
});

const emit = defineEmits(['insert-image']);

const { t } = useI18n();
const ui = useBuilderUi();
const contentAssets = useContentAssets();
const marketingAssets = useMarketingAssets();
const assetLibrary = computed(() => (props.mode === 'blog' ? marketingAssets : contentAssets));

const search = ref('');
const loading = ref(false);
const assets = ref([]);

function assetUrl(asset) {
  return asset?.downloadUrl || asset?.url || asset?.publicUrl || asset?.thumbnailUrl || '';
}

async function loadAssets() {
  loading.value = true;
  try {
    await assetLibrary.value.fetchAssets({
      type: 'image',
      search: search.value.trim() || undefined,
      limit: 40,
    });
    assets.value = assetLibrary.value.assets.value || [];
  } finally {
    loading.value = false;
  }
}

async function handleUpload(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  try {
    const asset = await assetLibrary.value.uploadAsset(file, { type: 'image' });
    if (asset) {
      emit('insert-image', asset);
      await loadAssets();
    }
  } catch {
    /* upload errors surfaced by composable */
  }
}

onMounted(() => {
  void loadAssets();
});
</script>
