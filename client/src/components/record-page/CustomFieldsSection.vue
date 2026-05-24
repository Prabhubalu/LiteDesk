<template>
  <section v-if="fields && fields.length > 0" class="custom-fields-section mt-3 pt-3 border-t border-gray-200 dark:border-gray-700" aria-labelledby="custom-fields-heading">
    <h2 id="custom-fields-heading" class="sr-only">{{ t('records.customFieldsHeadingSr') }}</h2>
    <AccordionSection
      :title="'Custom Fields'"
      :storage-key="storageKey"
      :default-open="defaultOpen"
      content-class=""
    >
      <template #actions>
        <slot name="actions" />
      </template>
      <div class="custom-fields-section__fields grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
      <div
        v-for="(field, index) in fields"
        :key="field.key ?? index"
        class="custom-fields-section__field flex items-start gap-3"
      >
        <!-- Field icon -->
        <div class="custom-fields-section__icon flex-shrink-0 mt-0.5">
          <component
            v-if="field.icon"
            :is="field.icon"
            class="w-5 h-5 text-gray-400 dark:text-gray-500"
          />
          <svg
            v-else
            class="w-5 h-5 text-gray-400 dark:text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
        </div>
        <!-- Field label and value -->
        <div class="custom-fields-section__content flex-1 min-w-0">
          <div class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{{ field.label }}</div>
          <div class="text-sm text-gray-900 dark:text-white">
            <slot :name="`field-${field.key ?? index}`" :field="field">
              <span v-if="field.value !== null && field.value !== undefined && field.value !== ''">
                {{ field.value }}
              </span>
              <span v-else class="text-record-empty">—</span>
            </slot>
          </div>
        </div>
      </div>
      </div>
    </AccordionSection>
  </section>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import AccordionSection from './AccordionSection.vue';

const { t } = useI18n();

/**
 * CustomFieldsSection – displays custom fields in a clean grid layout.
 * 
 * Props:
 * - fields: Array of field objects with { key, label, value, icon }
 * 
 * Slots:
 * - #field-{key}: Custom rendering for specific field
 */
defineProps({
  fields: {
    type: Array,
    required: true,
    default: () => [],
    validator: (fields) => Array.isArray(fields) && fields.every(f => f && typeof f.label === 'string')
  },
  storageKey: {
    type: String,
    default: 'custom-fields-section-state'
  },
  defaultOpen: {
    type: Boolean,
    default: false
  }
});
</script>

<style scoped>
.custom-fields-section__field {
  min-height: 2.5rem;
}
</style>
