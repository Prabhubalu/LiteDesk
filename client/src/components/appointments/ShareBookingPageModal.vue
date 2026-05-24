<template>
  <TransitionRoot as="template" :show="isOpen">
    <Dialog class="relative z-[10000]" @close="close">
      <TransitionChild
        as="template"
        enter="ease-out duration-200"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-150"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-gray-500/75 dark:bg-gray-900/75 transition-opacity" aria-hidden="true" />
      </TransitionChild>

      <div class="fixed inset-0 z-[10000] w-screen overflow-y-auto p-4 sm:p-6">
        <div class="flex min-h-full items-center justify-center">
          <TransitionChild
            as="template"
            enter="ease-out duration-200"
            enter-from="opacity-0 translate-y-4 sm:scale-95"
            enter-to="opacity-100 translate-y-0 sm:scale-100"
            leave="ease-in duration-150"
            leave-from="opacity-100 translate-y-0 sm:scale-100"
            leave-to="opacity-0 translate-y-4 sm:scale-95"
          >
            <DialogPanel
              class="relative w-full max-w-lg transform overflow-hidden rounded-2xl bg-white text-left shadow-xl dark:bg-gray-900"
            >
              <div class="border-b border-gray-200 px-5 py-4 dark:border-gray-700">
                <DialogTitle class="text-lg font-semibold text-gray-900 dark:text-white">
                  {{ t('appointments.shareModalTitle') }}
                </DialogTitle>
                <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  {{ t('appointments.shareModalHint') }}
                </p>
                <p v-if="pageTitle" class="mt-2 truncate text-sm font-medium text-indigo-600 dark:text-indigo-400">
                  {{ pageTitle }}
                </p>
              </div>

              <div class="px-5 py-4">
                <label class="sr-only" for="share-contact-search">{{ t('appointments.searchContactsSr') }}</label>
                <input
                  id="share-contact-search"
                  v-model="searchQuery"
                  type="search"
                  :placeholder="t('appointments.searchContactsPh')"
                  class="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  @input="scheduleSearch"
                />

                <div v-if="loading" class="flex justify-center py-10">
                  <div class="h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
                </div>
                <p v-else-if="loadError" class="py-6 text-center text-sm text-red-600 dark:text-red-400">
                  {{ loadError }}
                </p>
                <p
                  v-else-if="contactsWithEmail.length === 0"
                  class="py-8 text-center text-sm text-gray-500 dark:text-gray-400"
                >
                  {{ searchQuery.trim() ? t('appointments.noContactsSearch') : t('appointments.noContactsEmail') }}
                </p>
                <ul
                  v-else
                  class="mt-3 max-h-[min(40vh,320px)] space-y-1 overflow-y-auto rounded-xl border border-gray-200 p-1 dark:border-gray-700"
                >
                  <li
                    v-for="contact in contactsWithEmail"
                    :key="contact._id"
                    class="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/80"
                  >
                    <input
                      :id="`share-contact-${contact._id}`"
                      type="checkbox"
                      class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900"
                      :checked="selectedIds.has(String(contact._id))"
                      @change="toggleContact(contact._id, $event.target.checked)"
                    >
                    <label
                      :for="`share-contact-${contact._id}`"
                      class="min-w-0 flex-1 cursor-pointer"
                    >
                      <span class="block truncate text-sm font-medium text-gray-900 dark:text-white">
                        {{ contactLabel(contact) }}
                      </span>
                      <span class="block truncate text-xs text-gray-500 dark:text-gray-400">
                        {{ contact.email }}
                      </span>
                    </label>
                  </li>
                </ul>

                <p v-if="selectedCount > 0" class="mt-3 text-xs text-gray-500 dark:text-gray-400">
                  {{ t('appointments.contactsSelected', { count: selectedCount }) }}
                </p>
              </div>

              <div class="flex flex-col-reverse gap-2 border-t border-gray-200 px-5 py-4 sm:flex-row sm:justify-end dark:border-gray-700">
                <button
                  type="button"
                  class="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                  @click="close"
                >
                  {{ t('actions.cancel') }}
                </button>
                <button
                  type="button"
                  class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="selectedCount === 0"
                  @click="composeEmail"
                >
                  {{ t('appointments.composeEmail') }}
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot
} from '@headlessui/vue';
import apiClient from '@/utils/apiClient';

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  pageTitle: { type: String, default: '' },
  bookingUrl: { type: String, default: '' }
});

const emit = defineEmits(['close', 'compose']);

const { t } = useI18n();

const searchQuery = ref('');
const contacts = ref([]);
const loading = ref(false);
const loadError = ref(null);
const selectedIds = ref(new Set());

let searchTimer = null;

const contactsWithEmail = computed(() =>
  contacts.value.filter((c) => contactEmail(c))
);

const selectedCount = computed(() => selectedIds.value.size);

function contactEmail(contact) {
  const email = (contact.email || contact.work_email || contact.workEmail || '').trim();
  return email && email.includes('@') ? email : '';
}

function contactLabel(contact) {
  const first = contact.firstName || contact.first_name || '';
  const last = contact.lastName || contact.last_name || '';
  const name = [first, last].filter(Boolean).join(' ');
  return name || contact.email || t('appointments.contactFallback');
}

function normalizePeopleResponse(response) {
  if (Array.isArray(response)) return response;
  if (response?.success && Array.isArray(response.data)) return response.data;
  if (Array.isArray(response?.data)) return response.data;
  return [];
}

async function fetchContacts() {
  loading.value = true;
  loadError.value = null;
  try {
    const params = { limit: 100, sortBy: 'firstName', sortOrder: 'asc' };
    const q = searchQuery.value.trim();
    if (q) params.search = q;
    const res = await apiClient.get('/people', { params });
    contacts.value = normalizePeopleResponse(res);
  } catch (e) {
    loadError.value = e?.message || t('appointments.loadContactsFailed');
    contacts.value = [];
  } finally {
    loading.value = false;
  }
}

function scheduleSearch() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(fetchContacts, 300);
}

function toggleContact(id, checked) {
  const key = String(id);
  const next = new Set(selectedIds.value);
  if (checked) next.add(key);
  else next.delete(key);
  selectedIds.value = next;
}

function close() {
  emit('close');
}

function composeEmail() {
  const selected = contactsWithEmail.value.filter((c) => selectedIds.value.has(String(c._id)));
  if (!selected.length || !props.bookingUrl) return;

  const to = selected.map((c) => contactEmail(c)).join(', ');
  const title = props.pageTitle || t('appointments.shareEmailTitleFallback');
  const subject = t('appointments.shareEmailSubject', { title });
  const body = [
    t('appointments.shareEmailBodyHi'),
    t('appointments.shareEmailBodyLink'),
    `<p><a href="${props.bookingUrl}">${props.bookingUrl}</a></p>`,
    t('appointments.shareEmailBodyClosing')
  ].join('');

  emit('compose', { to, subject, body, recipients: selected });
}

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      searchQuery.value = '';
      selectedIds.value = new Set();
      fetchContacts();
    }
  }
);
</script>
