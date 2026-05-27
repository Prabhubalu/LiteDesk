<template>
  <div class="record-closed-banner">
    <div class="record-closed-banner__icon">
      <LockClosedIcon class="w-5 h-5" />
    </div>
    <div class="record-closed-banner__content">
      <div class="record-closed-banner__title">
        {{ title }}
      </div>
      <div class="record-closed-banner__description">
        <slot>
          {{ description }}
        </slot>
      </div>
    </div>
    <div v-if="canReopen" class="record-closed-banner__actions">
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-1.5 text-xs font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-white dark:bg-gray-900 dark:text-gray-100 dark:ring-gray-600 dark:hover:bg-gray-800"
        @click="$emit('reopen')"
      >
        <ArrowPathIcon class="w-4 h-4" />
        <span>{{ reopenLabel }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { LockClosedIcon, ArrowPathIcon } from '@heroicons/vue/24/outline';

const props = defineProps({
  moduleKey: {
    type: String,
    default: 'record'
  },
  canReopen: {
    type: Boolean,
    default: true
  }
});

defineEmits(['reopen']);

const { t } = useI18n();

const title = computed(() => {
  if (props.moduleKey === 'cases') {
    return t('cases.recordClosedTitle');
  }
  return t('records.recordClosedTitle');
});

const description = computed(() => {
  if (props.moduleKey === 'cases') {
    return t('cases.recordClosedDescription');
  }
  return t('records.recordClosedDescription');
});

const reopenLabel = computed(() => {
  if (props.moduleKey === 'cases') {
    return t('cases.recordReopen');
  }
  return t('records.recordReopen');
});
</script>

<style scoped>
.record-closed-banner {
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  border-radius: 0.75rem;
  border-width: 1px;
  border-color: rgb(253 230 138);
  background-color: rgb(255 251 235);
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  color: rgb(120 53 15);
}

.record-closed-banner__icon {
  margin-top: 0.125rem;
  display: flex;
  height: 1.75rem;
  width: 1.75rem;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background-color: rgb(254 243 199);
  color: rgb(180 83 9);
}

.record-closed-banner__content {
  flex: 1 1 0%;
  min-width: 0;
}

.record-closed-banner__title {
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.25rem;
}

.record-closed-banner__description {
  margin-top: 0.125rem;
  font-size: 0.7rem;
  line-height: 1rem;
  color: rgba(120, 53, 15, 0.9);
}

.record-closed-banner__actions {
  margin-left: 0.5rem;
  flex-shrink: 0;
}
</style>

