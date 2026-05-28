<template>
  <Menu as="div" class="relative inline-flex">
    <MenuButton
      type="button"
      class="rounded p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-800"
      :disabled="disabled || loading"
      :title="t('cases.recordMacros')"
      @click="$emit('open')"
    >
      <BoltIcon class="h-4 w-4" />
    </MenuButton>
    <transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="transform scale-95 opacity-0"
      enter-to-class="transform scale-100 opacity-100"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="transform scale-100 opacity-100"
      leave-to-class="transform scale-95 opacity-0"
    >
      <MenuItems
        class="absolute bottom-full left-0 z-50 mb-1 max-h-64 w-72 origin-bottom-left overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg focus:outline-none dark:border-gray-700 dark:bg-gray-900"
      >
        <p class="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {{ t('cases.recordMacros') }}
        </p>
        <div v-if="loading" class="px-3 py-4 text-center text-xs text-gray-500">
          {{ t('cases.recordMacrosLoading') }}
        </div>
        <div v-else-if="!items.length" class="px-3 py-4 text-center text-xs text-gray-500 dark:text-gray-400">
          {{ t('cases.recordMacrosEmpty') }}
        </div>
        <template v-else>
          <MenuItem v-for="item in items" :key="item.id" v-slot="{ active }">
            <button
              type="button"
              :class="[
                'w-full px-3 py-2 text-left text-sm',
                active ? 'bg-gray-100 dark:bg-gray-800' : '',
                !isApplicable(item) ? 'opacity-60' : ''
              ]"
              @click="$emit('select', item)"
            >
              <div class="flex items-center gap-2">
                <span class="min-w-0 flex-1 font-medium text-gray-900 dark:text-white">{{ item.name }}</span>
                <span
                  class="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                  :class="channelBadgeClass(item)"
                >
                  {{ channelLabel(item) }}
                </span>
              </div>
              <span
                v-if="item.subject"
                class="mt-0.5 block truncate text-xs text-gray-500 dark:text-gray-400"
              >
                {{ previewSubject(item.subject) }}
              </span>
            </button>
          </MenuItem>
        </template>
      </MenuItems>
    </transition>
  </Menu>
</template>

<script setup>
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue';
import { BoltIcon } from '@heroicons/vue/24/outline';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  items: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  /** When set, macros for other channels are still listed but styled muted. */
  activeChannel: { type: String, default: 'email' }
});

defineEmits(['select', 'open']);

const { t } = useI18n();

function previewSubject(subject) {
  const raw = String(subject || '').replace(/<[^>]+>/g, '').trim();
  return raw.length > 48 ? `${raw.slice(0, 45)}…` : raw;
}

function channelLabel(item) {
  const ch = String(item?.channel || 'email').toLowerCase();
  if (ch === 'internal') return t('cases.recordMacroChannelInternal');
  if (ch === 'all') return t('cases.recordMacroChannelAll');
  return t('cases.recordMacroChannelEmail');
}

function channelBadgeClass(item) {
  const ch = String(item?.channel || 'email').toLowerCase();
  if (ch === 'internal') return 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100';
  if (ch === 'all') return 'bg-indigo-100 text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-100';
  return 'bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100';
}

function isApplicable(item) {
  const mode = String(props.activeChannel || 'email').toLowerCase() === 'internal' ? 'internal' : 'email';
  const ch = String(item?.channel || 'all').toLowerCase();
  return ch === 'all' || ch === mode;
}
</script>
