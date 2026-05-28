<template>
  <ItemCatalogSections
    v-if="record?._id"
    :item-id="String(record._id)"
    :category-id="record.categoryId ? String(record.categoryId) : ''"
    :attribute-values="record.attributeValues || {}"
    :attribute-templates="record.attributeTemplates || []"
    :media="record.media || []"
    :variants="record.variants || []"
    :item-type="record.item_type || ''"
    :can-edit="canEdit"
    @updated="handleUpdated"
  />
</template>

<script setup>
import { computed } from 'vue';
import ItemCatalogSections from '@/components/catalog/ItemCatalogSections.vue';

const props = defineProps({
  record: { type: Object, default: null },
  adapter: { type: Object, default: () => ({}) },
  context: {
    type: Object,
    default: () => ({})
  }
});

const canEdit = computed(() => {
  if (props.context?.canEditCatalog === false) return false;
  if (props.context?.canEditCatalog === true) return true;
  return props.adapter?.canEditDetails?.(props.record) === true;
});

const handleUpdated = () => {
  if (typeof props.context?.onCatalogUpdated === 'function') {
    props.context.onCatalogUpdated();
  }
};
</script>
