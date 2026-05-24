<template>
  <div class="relative">
    <SignalCard
      :severity="severity"
      :message="message"
      :context="context"
      :action="action"
    >
      <template #action>
        <div class="flex items-center gap-2">
          <!-- Only render action button if handler exists (permission check) -->
          <SuggestedActionLink
            v-if="action && action.handler"
            :label="action.label"
            :href="action.href"
            :variant="actionVariant"
            @click="handleActionClick"
          />
          <button
            v-if="dismissible"
            @click="handleDismiss"
            class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            :title="t('notifications.dismiss')"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </template>
    </SignalCard>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import SignalCard from '@/components/ui/SignalCard.vue';
import SuggestedActionLink from '@/components/ui/SuggestedActionLink.vue';
import { computed } from 'vue';

const props = defineProps({
  severity: {
    type: String,
    required: true,
    validator: (value) => ['critical', 'warning', 'info'].includes(value)
  },
  message: {
    type: String,
    required: true
  },
  context: {
    type: String,
    default: ''
  },
  action: {
    type: Object,
    default: null
  },
  dismissible: {
    type: Boolean,
    default: false
  }
});

const { t } = useI18n();

const emit = defineEmits(['dismiss', 'action']);

const actionVariant = computed(() => {
  const variants = {
    critical: 'danger',
    warning: 'warning',
    info: 'primary'
  };
  return variants[props.severity] || 'primary';
});

const handleActionClick = () => {
  if (props.action?.handler) {
    props.action.handler();
  }
  emit('action', props.action);
};

const handleDismiss = () => {
  emit('dismiss');
};
</script>

