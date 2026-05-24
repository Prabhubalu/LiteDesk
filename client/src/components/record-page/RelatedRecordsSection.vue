<template>
  <section class="related-records-section py-3" aria-labelledby="related-records-heading">
    <h2 id="related-records-heading" class="sr-only">{{ t('records.relatedRecordsHeadingSr') }}</h2>
    <AccordionSection
      :title="'Related Records'"
      :storage-key="storageKey"
      :default-open="defaultOpen"
      content-class="pl-6"
    >
      <div class="space-y-4">
        <details
          v-for="(group, index) in groups"
          :key="group.key ?? index"
          class="related-records-section__group"
          :open="isGroupOpen(group, index)"
          @toggle="(event) => handleGroupToggle(event, group, index)"
        >
          <summary class="cursor-pointer text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 flex items-center gap-2 list-none py-1">
            <ChevronRightIcon
              :class="[
                'related-records-section__chevron h-4 w-4 shrink-0 text-gray-400',
                isGroupOpen(group, index) ? 'related-records-section__chevron--open' : ''
              ]"
              aria-hidden="true"
            />
            <span>{{ group.label }}</span>
            <span v-if="group.count != null" class="text-gray-400 dark:text-gray-500 font-normal">({{ group.count }})</span>
          </summary>
          <div class="related-records-section__items mt-2 pl-6 space-y-1">
            <slot :name="slotNameForGroup(group, index)" :group="group" />
          </div>
        </details>
      </div>
    </AccordionSection>
  </section>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import { ChevronRightIcon } from '@heroicons/vue/24/solid';
import AccordionSection from './AccordionSection.vue';

/**
 * RelatedRecordsSection – relationship visibility.
 * Grouped by record type. Collapsible groups. Visually secondary.
 * Placed at bottom of left column by parent. No elevation to core content.
 */
const props = defineProps({
  groups: {
    type: Array,
    required: true,
    validator: (g) => Array.isArray(g) && g.every((i) => i && typeof i.label === 'string')
  },
  storageKey: {
    type: String,
    default: 'related-records-section-state'
  },
  defaultOpen: {
    type: Boolean,
    default: false
  }
});

function slotNameForGroup(group, index) {
  return group.key ? `group-${group.key}` : `group-${index}`;
}

const groupOpenState = ref({});

const getGroupStateStorageKey = () => `${props.storageKey}-groups`;
const getGroupStateKey = (group, index) => String(group?.key ?? index);

const getDefaultGroupOpen = (group) => {
  if (typeof group?.open === 'boolean') return group.open;
  return true;
};

const loadGroupOpenState = () => {
  try {
    const raw = localStorage.getItem(getGroupStateStorageKey());
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      groupOpenState.value = parsed;
    }
  } catch {}
};

const persistGroupOpenState = () => {
  try {
    localStorage.setItem(getGroupStateStorageKey(), JSON.stringify(groupOpenState.value));
  } catch {}
};

const isGroupOpen = (group, index) => {
  const key = getGroupStateKey(group, index);
  if (Object.prototype.hasOwnProperty.call(groupOpenState.value, key)) {
    return !!groupOpenState.value[key];
  }
  return getDefaultGroupOpen(group);
};

const handleGroupToggle = (event, group, index) => {
  const key = getGroupStateKey(group, index);
  const isOpen = !!(event?.currentTarget?.open ?? event?.target?.open);
  groupOpenState.value = {
    ...groupOpenState.value,
    [key]: isOpen
  };
};

onMounted(() => {
  loadGroupOpenState();
});

watch(groupOpenState, () => {
  persistGroupOpenState();
}, { deep: true });
</script>

<style scoped>
.related-records-section__chevron {
  transition: transform 0.15s ease;
  transform-origin: center;
}
.related-records-section__chevron--open {
  transform: rotate(90deg);
}
details > summary::-webkit-details-marker {
  display: none;
}
details > summary::marker {
  content: '';
}
</style>
