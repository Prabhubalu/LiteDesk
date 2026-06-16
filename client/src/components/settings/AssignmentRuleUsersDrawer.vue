<template>
  <TransitionRoot as="template" :show="isOpen">
    <Dialog class="relative z-[10000]" @close="emit('close')">
      <TransitionChild as="template" enter="ease-out duration-200" enter-from="opacity-0" enter-to="opacity-100" leave="ease-in duration-200" leave-from="opacity-100" leave-to="opacity-0">
        <div class="fixed inset-0 bg-gray-500/75 dark:bg-black/75" aria-hidden="true" />
      </TransitionChild>
      <div class="fixed inset-0 overflow-hidden">
        <div class="absolute inset-0 overflow-hidden">
          <div class="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
            <TransitionChild as="template" enter="transform transition ease-in-out duration-300" enter-from="translate-x-full" enter-to="translate-x-0" leave="transform transition ease-in-out duration-300" leave-from="translate-x-0" leave-to="translate-x-full">
              <DialogPanel class="pointer-events-auto flex h-full w-screen max-w-md flex-col bg-white shadow-xl dark:bg-gray-800">
                <div class="flex shrink-0 items-center justify-between border-b border-gray-200 bg-indigo-700 px-4 py-4 dark:border-gray-700 dark:bg-indigo-800">
                  <div class="min-w-0">
                    <DialogTitle class="text-base font-semibold text-white">{{ t('settings.assignRulesUsersDrawerTitle') }}</DialogTitle>
                    <p v-if="ruleName" class="mt-0.5 truncate text-sm text-indigo-200">{{ ruleName }}</p>
                  </div>
                  <button type="button" class="rounded-md p-1 text-indigo-200 hover:text-white" @click="emit('close')">
                    <XMarkIcon class="h-6 w-6" />
                  </button>
                </div>

                <div class="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
                  <input
                    v-model.trim="search"
                    type="search"
                    :placeholder="t('common.searchPlaceholder')"
                    class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  />
                  <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    {{ t('settings.assignRulesUsersDrawerSelected', { count: draftIds.length }) }}
                  </p>
                </div>

                <div class="min-h-0 flex-1 overflow-y-auto px-2 py-2">
                  <div v-if="loading" class="flex justify-center py-12">
                    <div class="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                  </div>
                  <div v-else-if="filteredUsers.length === 0" class="px-2 py-8 text-center text-sm text-gray-500">
                    {{ t('settings.assignRulesUsersDrawerEmpty') }}
                  </div>
                  <ul v-else class="space-y-1">
                    <li v-for="user in filteredUsers" :key="user._id">
                      <label class="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <input
                          type="checkbox"
                          class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          :checked="draftIds.includes(String(user._id))"
                          @change="toggleUser(String(user._id))"
                        />
                        <Avatar :user="user" size="sm" />
                        <span class="min-w-0 flex-1">
                          <span class="block truncate text-sm font-medium text-gray-900 dark:text-white">{{ displayName(user) }}</span>
                          <span class="block truncate text-xs text-gray-500">{{ user.email }}</span>
                        </span>
                      </label>
                    </li>
                  </ul>
                </div>

                <div class="flex shrink-0 justify-end gap-2 border-t border-gray-200 px-4 py-4 dark:border-gray-700">
                  <button type="button" class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300" @click="emit('close')">
                    {{ t('actions.cancel') }}
                  </button>
                  <button type="button" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50" :disabled="draftIds.length === 0" @click="save">
                    {{ t('actions.save') }}
                  </button>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import Avatar from '@/components/common/Avatar.vue';
import apiClient from '@/utils/apiClient';

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  selectedUserIds: { type: Array, default: () => [] },
  ruleName: { type: String, default: '' }
});

const emit = defineEmits(['close', 'save']);

const { t } = useI18n();

const loading = ref(false);
const users = ref([]);
const search = ref('');
const draftIds = ref([]);

const filteredUsers = computed(() => {
  const q = search.value.toLowerCase();
  if (!q) return users.value;
  return users.value.filter((user) => {
    const name = displayName(user).toLowerCase();
    const email = String(user.email || '').toLowerCase();
    return name.includes(q) || email.includes(q);
  });
});

function displayName(user) {
  const parts = [user.firstName, user.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : (user.username || user.email || '');
}

function toggleUser(userId) {
  const idx = draftIds.value.indexOf(userId);
  if (idx >= 0) draftIds.value = draftIds.value.filter((id) => id !== userId);
  else draftIds.value = [...draftIds.value, userId];
}

async function fetchUsers() {
  loading.value = true;
  try {
    const res = await apiClient.get('/users?limit=500&page=1&sortBy=firstName&sortOrder=asc');
    users.value = res.success && Array.isArray(res.data) ? res.data : [];
  } catch {
    users.value = [];
  } finally {
    loading.value = false;
  }
}

function save() {
  emit('save', [...draftIds.value]);
  emit('close');
}

watch(
  () => props.isOpen,
  (open) => {
    if (!open) return;
    search.value = '';
    draftIds.value = (props.selectedUserIds || []).map(String);
    fetchUsers();
  }
);
</script>
