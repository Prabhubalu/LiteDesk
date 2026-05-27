<template>
  <nav
    class="flex w-12 shrink-0 flex-col items-center gap-2 border-l border-gray-200 bg-white py-3 dark:border-gray-700 dark:bg-gray-900"
    :aria-label="t('cases.recordUtilityRail')"
  >
    <button
      v-for="item in items"
      :key="item.id"
      type="button"
      class="relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
      :class="
        activePanel === item.id
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
          : item.disabled
            ? 'cursor-not-allowed text-gray-300 dark:text-gray-600'
            : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-800 dark:hover:text-gray-200'
      "
      :title="item.label"
      :aria-label="item.label"
      :disabled="item.disabled"
      @click="!item.disabled && $emit('select', item.id)"
    >
      <component :is="item.icon" class="h-5 w-5" />
    </button>
  </nav>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  DocumentTextIcon,
  EnvelopeIcon,
  UserCircleIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/vue/24/outline';

const props = defineProps({
  activePanel: { type: String, default: 'conversation' },
  hasContact: { type: Boolean, default: false }
});

defineEmits(['select']);

const { t } = useI18n();

const items = computed(() => [
  {
    id: 'conversation',
    label: t('cases.recordRailConversation'),
    icon: ChatBubbleLeftRightIcon,
    disabled: false
  },
  {
    id: 'email',
    label: t('cases.recordRailEmail'),
    icon: EnvelopeIcon,
    disabled: false
  },
  {
    id: 'details',
    label: t('cases.recordRailDetails'),
    icon: DocumentTextIcon,
    disabled: false
  },
  {
    id: 'profile',
    label: t('cases.recordRailProfile'),
    icon: UserCircleIcon,
    disabled: !props.hasContact
  }
]);
</script>
