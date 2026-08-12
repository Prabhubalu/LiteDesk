<template>
  <div ref="rootRef" class="space-y-4">
    <div
      ref="navShellRef"
      class="item-catalog-section-nav-shell sticky z-[9] -mx-1"
      :style="{ top: `${navStickyTopPx}px` }"
    >
      <nav
        class="item-catalog-section-nav bg-white dark:bg-gray-900
          px-1 pt-3.5 pb-2.5 sm:pt-4"
        :aria-label="t('platform.catalogSectionNavAria')"
      >
        <div
          class="inline-flex max-w-full flex-wrap rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50/80 dark:bg-gray-900/60"
          role="tablist"
        >
          <button
            v-for="(chip, idx) in sectionChips"
            :key="chip.id"
            type="button"
            role="tab"
            class="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium transition-colors"
            :class="[
              activeSectionId === chip.id
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-white hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white',
              idx > 0 ? 'border-l border-gray-200 dark:border-gray-700' : ''
            ]"
            :aria-current="activeSectionId === chip.id ? 'location' : undefined"
            @click="scrollToSection(chip.id)"
          >
            {{ chip.label }}
            <span
              v-if="chip.isEmpty"
              class="h-1.5 w-1.5 rounded-full"
              :class="activeSectionId === chip.id ? 'bg-white/70' : 'bg-gray-400 dark:bg-gray-500'"
              :title="t('platform.catalogSectionEmptyHint')"
              aria-hidden="true"
            />
          </button>
        </div>
      </nav>
    </div>

    <div
      :id="sectionDomId('category')"
      data-catalog-section="category"
      class="item-catalog-anchor"
      :style="{ scrollMarginTop: `${scrollMarginPx}px` }"
    >
      <ItemCategoryAttributes
        :item-id="itemId"
        :category-id="categoryId"
        :attribute-values="attributeValues"
        :templates="attributeTemplates"
        :can-edit="canEdit"
        @updated="emit('updated')"
      />
    </div>

    <p v-if="mediaError" class="text-sm text-red-600 dark:text-red-400">{{ mediaError }}</p>

    <div
      :id="sectionDomId('media')"
      data-catalog-section="media"
      class="item-catalog-anchor"
      :style="{ scrollMarginTop: `${scrollMarginPx}px` }"
    >
      <ItemMediaGallery
        :media="media"
        :can-edit="canEdit"
        :uploading="uploadingMedia"
        @upload="handleUpload"
        @set-primary="handleSetPrimary"
        @delete="handleDeleteMedia"
      />
    </div>

    <div
      :id="sectionDomId('variant')"
      data-catalog-section="variant"
      class="item-catalog-anchor"
      :style="{ scrollMarginTop: `${scrollMarginPx}px` }"
    >
      <ItemVariantPanel
        :variants="variants"
        :item-type="itemType"
        :can-edit="canEdit"
        :saving="savingVariant"
        :error="variantError"
        @save="handleSaveVariant"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { catalogPostForm } from '@/utils/catalogApi';
import ItemMediaGallery from '@/components/catalog/ItemMediaGallery.vue';
import ItemVariantPanel from '@/components/catalog/ItemVariantPanel.vue';
import ItemCategoryAttributes from '@/components/catalog/ItemCategoryAttributes.vue';

const props = defineProps({
  itemId: { type: String, required: true },
  categoryId: { type: String, default: '' },
  attributeValues: { type: Object, default: () => ({}) },
  attributeTemplates: { type: Array, default: () => [] },
  media: { type: Array, default: () => [] },
  variants: { type: Array, default: () => [] },
  itemType: { type: String, default: '' },
  canEdit: { type: Boolean, default: false }
});

const emit = defineEmits(['updated']);
const { t } = useI18n();

const SECTION_IDS = ['category', 'media', 'variant'];
const rootRef = ref(null);
const navShellRef = ref(null);
const activeSectionId = ref('category');
/** Sticky offset under record title — measured once (ResizeObserver), not every scroll frame. */
const navStickyTopPx = ref(0);
const scrollMarginPx = ref(120);

const uploadingMedia = ref(false);
const savingVariant = ref(false);
const variantError = ref('');
const mediaError = ref('');

let scrollRoot = null;
let ignoreSpyUntil = 0;
let rafId = 0;
let titleResizeObserver = null;

const hasMedia = computed(() => Array.isArray(props.media) && props.media.length > 0);
const hasVariants = computed(() => Array.isArray(props.variants) && props.variants.length > 0);

const sectionChips = computed(() => [
  {
    id: 'category',
    label: t('platform.catalogSectionChipCategory'),
    isEmpty: !props.categoryId
  },
  {
    id: 'media',
    label: t('platform.catalogSectionChipMedia'),
    isEmpty: !hasMedia.value
  },
  {
    id: 'variant',
    label: t('platform.catalogSectionChipSku'),
    isEmpty: !hasVariants.value
  }
]);

function sectionDomId(sectionId) {
  return `item-catalog-section-${sectionId}-${props.itemId || 'new'}`;
}

function getSectionEl(sectionId) {
  return rootRef.value?.querySelector?.(`[data-catalog-section="${sectionId}"]`) || null;
}

function resolveScrollRoot() {
  if (!(rootRef.value instanceof HTMLElement)) return null;
  let el = rootRef.value.parentElement;
  while (el) {
    if (el.classList?.contains('record-page-layout__left')) return el;
    const { overflowY } = getComputedStyle(el);
    if ((overflowY === 'auto' || overflowY === 'scroll') && el.clientHeight > 0) {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

/**
 * Chips stick flush under the sticky title border (no air gap).
 * Title uses lg:-top-6 and gains py-3/sm:py-4 when stuck — budget that height when unstuck.
 */
function measureStickyTop() {
  if (!(scrollRoot instanceof HTMLElement)) {
    navStickyTopPx.value = 0;
    return;
  }
  const titleRow = scrollRoot.querySelector('[data-record-title-row]');
  if (!(titleRow instanceof HTMLElement)) {
    navStickyTopPx.value = 0;
    return;
  }

  const rootRect = scrollRoot.getBoundingClientRect();
  const titleRect = titleRow.getBoundingClientRect();
  const titleStyle = getComputedStyle(titleRow);
  const stickyTopCss = Number.parseFloat(titleStyle.top);
  const titleStickyInset = Number.isFinite(stickyTopCss) ? stickyTopCss : 0;

  // Budget for stuck vertical padding (py-3 / sm:py-4) — unstuck lg title is py-0.
  const stuckPadY = window.matchMedia('(min-width: 640px)').matches ? 32 : 24;
  const inner = titleRow.firstElementChild;
  const innerH = inner instanceof HTMLElement ? inner.offsetHeight : titleRow.offsetHeight;
  const estimate = Math.max(
    56,
    Math.round(Math.max(titleRow.offsetHeight, innerH + stuckPadY) + titleStickyInset)
  );

  // When title is stuck, flush to its painted bottom (border included). Never use
  // estimate here — oversize estimate was leaving a multi-pixel air gap.
  const stuckProbe = rootRect.top + Math.min(0, titleStickyInset) + 2;
  const isTitleStuck = titleRect.top <= stuckProbe;
  const liveBottom = Math.max(0, Math.round(titleRect.bottom - rootRect.top));
  const next = isTitleStuck ? liveBottom : estimate;

  if (next !== navStickyTopPx.value) {
    navStickyTopPx.value = next;
  }

  const navH = navShellRef.value instanceof HTMLElement ? navShellRef.value.offsetHeight : 48;
  const margin = navStickyTopPx.value + navH + 8;
  if (margin !== scrollMarginPx.value) {
    scrollMarginPx.value = margin;
  }
}

function updateActiveFromScroll() {
  if (Date.now() < ignoreSpyUntil) return;
  if (!(scrollRoot instanceof HTMLElement)) return;

  const marker = scrollRoot.getBoundingClientRect().top + scrollMarginPx.value;
  let current = SECTION_IDS[0];
  for (const id of SECTION_IDS) {
    const el = getSectionEl(id);
    if (!(el instanceof HTMLElement)) continue;
    if (el.getBoundingClientRect().top <= marker + 1) {
      current = id;
    }
  }
  if (activeSectionId.value !== current) {
    activeSectionId.value = current;
  }
}

function onScrollFrame() {
  rafId = 0;
  measureStickyTop();
  updateActiveFromScroll();
}

function handleScroll() {
  if (rafId) return;
  rafId = requestAnimationFrame(onScrollFrame);
}

function scrollToSection(sectionId) {
  const el = getSectionEl(sectionId);
  if (!(el instanceof HTMLElement)) return;

  if (!(scrollRoot instanceof HTMLElement)) {
    scrollRoot = resolveScrollRoot();
  }
  if (!(scrollRoot instanceof HTMLElement)) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  measureStickyTop();
  activeSectionId.value = sectionId;
  ignoreSpyUntil = Date.now() + 800;

  const offset = scrollMarginPx.value;
  const rootRect = scrollRoot.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  const nextTop = scrollRoot.scrollTop + (elRect.top - rootRect.top) - offset;
  scrollRoot.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' });
}

function teardown() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
  if (titleResizeObserver) {
    titleResizeObserver.disconnect();
    titleResizeObserver = null;
  }
  if (scrollRoot) {
    scrollRoot.removeEventListener('scroll', handleScroll);
  }
  window.removeEventListener('resize', measureStickyTop);
  scrollRoot = null;
}

function setup() {
  teardown();
  scrollRoot = resolveScrollRoot();
  if (!(scrollRoot instanceof HTMLElement)) return;

  measureStickyTop();
  scrollRoot.addEventListener('scroll', handleScroll, { passive: true });
  window.addEventListener('resize', measureStickyTop, { passive: true });

  const titleRow = scrollRoot.querySelector('[data-record-title-row]');
  if (titleRow instanceof HTMLElement && typeof ResizeObserver !== 'undefined') {
    titleResizeObserver = new ResizeObserver(() => measureStickyTop());
    titleResizeObserver.observe(titleRow);
  }

  updateActiveFromScroll();
}

onMounted(() => {
  nextTick(() => {
    setup();
    requestAnimationFrame(setup);
  });
});

watch(
  () => props.itemId,
  () => {
    nextTick(setup);
  }
);

onBeforeUnmount(() => {
  teardown();
});

const handleUpload = async (file) => {
  if (!props.itemId || !file) return;
  uploadingMedia.value = true;
  mediaError.value = '';
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('isPrimary', String(!(props.media || []).length));
    await catalogPostForm(`/items/${props.itemId}/media`, formData);
    emit('updated');
  } catch (err) {
    mediaError.value = err.message || 'Upload failed';
    console.error('Item media upload failed:', err);
  } finally {
    uploadingMedia.value = false;
  }
};

const handleSetPrimary = async (mediaId) => {
  mediaError.value = '';
  try {
    await apiClient.patch(`/items/${props.itemId}/media/${mediaId}`, { isPrimary: true });
    emit('updated');
  } catch (err) {
    mediaError.value = err.message || 'Could not set primary image';
    console.error('Set primary media failed:', err);
  }
};

const handleDeleteMedia = async (mediaId) => {
  mediaError.value = '';
  try {
    await apiClient.delete(`/items/${props.itemId}/media/${mediaId}`);
    emit('updated');
  } catch (err) {
    mediaError.value = err.message || 'Could not remove media';
    console.error('Delete media failed:', err);
  }
};

const handleSaveVariant = async ({ variantId, payload }) => {
  savingVariant.value = true;
  variantError.value = '';
  try {
    const res = await apiClient.put(`/items/${props.itemId}/variants/${variantId}`, payload);
    if (!res.success) {
      throw new Error(res.message || 'Save failed');
    }
    emit('updated');
  } catch (err) {
    variantError.value = err.message || 'Failed to save variant';
  } finally {
    savingVariant.value = false;
  }
};
</script>
