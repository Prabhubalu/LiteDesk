<template>
  <div class="relative" v-click-outside="closeMenu">
    <!-- Menu Trigger Button -->
    <button
      @click="toggleMenu"
      class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center justify-center min-w-[40px] min-h-[40px]"
      :aria-expanded="isOpen"
      :aria-label="t('common.moreActions')"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
      </svg>
    </button>

    <!-- Dropdown Menu -->
    <Transition
      enter-active-class="transition ease-out duration-100"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition ease-in duration-75"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="isOpen"
        class="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50"
      >
        <button
          v-for="(action, index) in actions"
          :key="index"
          @click="handleAction(action)"
          :disabled="action.disabled"
          :class="[
            'w-full text-left px-4 py-2 text-sm transition-colors',
            action.disabled
              ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          ]"
        >
          <div class="flex items-center gap-2">
            <svg v-if="action.icon" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="getIconPath(action.icon)" />
            </svg>
            <span>{{ action.label }}</span>
          </div>
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import clickOutside from '@/directives/clickOutside';

const { t } = useI18n();

const props = defineProps({
  actions: {
    type: Array,
    default: () => [],
    validator: (actions) => {
      return actions.every(action => 
        typeof action === 'object' && 
        action.label && 
        typeof action.handler === 'function'
      );
    }
  }
});

const emit = defineEmits(['action']);

const isOpen = ref(false);

const toggleMenu = () => {
  isOpen.value = !isOpen.value;
};

const closeMenu = () => {
  isOpen.value = false;
};

const handleAction = (action) => {
  if (action.disabled) return;
  action.handler();
  closeMenu();
  emit('action', action);
};

// Icon paths
const iconPaths = {
  edit: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  delete: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  view: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'
};

const getIconPath = (icon) => {
  return iconPaths[icon] || '';
};

const vClickOutside = clickOutside;
</script>

