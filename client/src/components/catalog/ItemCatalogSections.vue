<template>
  <div class="space-y-6">
    <ItemCategoryAttributes
      :item-id="itemId"
      :category-id="categoryId"
      :attribute-values="attributeValues"
      :templates="attributeTemplates"
      :can-edit="canEdit"
      @updated="emit('updated')"
    />
    <p v-if="mediaError" class="text-sm text-red-600 dark:text-red-400">{{ mediaError }}</p>
    <ItemMediaGallery
      :media="media"
      :can-edit="canEdit"
      :uploading="uploadingMedia"
      @upload="handleUpload"
      @set-primary="handleSetPrimary"
      @delete="handleDeleteMedia"
    />
    <ItemVariantPanel
      :variants="variants"
      :item-type="itemType"
      :can-edit="canEdit"
      :saving="savingVariant"
      :error="variantError"
      @save="handleSaveVariant"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue';
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

const uploadingMedia = ref(false);
const savingVariant = ref(false);
const variantError = ref('');
const mediaError = ref('');

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
