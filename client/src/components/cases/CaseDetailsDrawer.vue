<template>
  <Teleport to="body">
    <Transition name="case-details-drawer">
      <div
        v-if="open"
        class="fixed inset-0 z-[9000] flex justify-end"
        role="dialog"
        aria-modal="true"
        @keydown.esc.prevent="$emit('close')"
      >
        <div class="absolute inset-0 bg-black/30" aria-hidden="true" @click="$emit('close')" />
        <aside
          class="relative z-10 flex h-full w-full max-w-md flex-col border-l border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900"
        >
          <div class="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
            <h2 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('cases.recordDetailsTitle') }}</h2>
            <button
              type="button"
              class="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              :aria-label="t('settings.roleDrawerCloseSr')"
              @click="$emit('close')"
            >
              <XMarkIcon class="h-5 w-5" />
            </button>
          </div>

          <div class="flex-1 space-y-5 overflow-y-auto p-4 text-sm">
            <section v-if="caseRecord?.description">
              <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {{ t('cases.recordDetailsDescription') }}
              </h3>
              <p class="mt-1 whitespace-pre-wrap text-gray-800 dark:text-gray-200">{{ caseRecord.description }}</p>
            </section>

            <section v-if="caseRecord?.caseNotes">
              <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {{ t('cases.recordDetailsInternalNotes') }}
              </h3>
              <p class="mt-1 whitespace-pre-wrap text-gray-800 dark:text-gray-200">{{ caseRecord.caseNotes }}</p>
            </section>

            <section v-if="caseRecord?.resolutionSummary">
              <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {{ t('cases.recordDetailsResolution') }}
              </h3>
              <p class="mt-1 whitespace-pre-wrap text-gray-800 dark:text-gray-200">{{ caseRecord.resolutionSummary }}</p>
            </section>

            <section>
              <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {{ t('cases.recordDetailsLinks') }}
              </h3>
              <ul class="mt-2 space-y-2">
                <li v-if="contactLink">
                  <button
                    type="button"
                    class="text-indigo-600 hover:underline dark:text-indigo-400"
                    @click="$emit('open-contact')"
                  >
                    {{ contactLink }}
                  </button>
                </li>
                <li v-if="organizationLink">
                  <button
                    type="button"
                    class="text-indigo-600 hover:underline dark:text-indigo-400"
                    @click="$emit('open-organization')"
                  >
                    {{ organizationLink }}
                  </button>
                </li>
                <li v-if="!contactLink && !organizationLink" class="text-gray-500 dark:text-gray-400">
                  {{ t('cases.recordDetailsNoLinks') }}
                </li>
              </ul>
            </section>

            <section v-if="canEdit">
              <label class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {{ t('cases.recordDetailsOwner') }}
              </label>
              <select
                :value="ownerId"
                :disabled="isClosed"
                class="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                @change="$emit('owner-change', $event.target.value)"
              >
                <option value="">{{ t('cases.recordDetailsUnassigned') }}</option>
                <option v-for="u in users" :key="u._id" :value="u._id">{{ u.name }}</option>
              </select>
            </section>

            <section v-if="caseRecord?._id">
              <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {{ t('cases.recordDetailsRelated') }}
              </h3>
              <RelatedRecordsPanel
                app-key="HELPDESK"
                module-key="cases"
                :record-id="caseRecord._id"
                class="mt-2"
              />
            </section>
          </div>

          <div class="shrink-0 border-t border-gray-200 p-4 dark:border-gray-700">
            <button
              type="button"
              class="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              @click="$emit('edit')"
            >
              {{ t('actions.edit') }}
            </button>
          </div>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import RelatedRecordsPanel from '@/components/relationships/RelatedRecordsPanel.vue';
import { useRecordContext } from '@/composables/useRecordContext';

const props = defineProps({
  open: { type: Boolean, default: false },
  caseRecord: { type: Object, default: null },
  users: { type: Array, default: () => [] },
  isClosed: { type: Boolean, default: false },
  canEdit: { type: Boolean, default: true }
});

defineEmits(['close', 'edit', 'open-contact', 'open-organization', 'owner-change']);

const { t } = useI18n();

const { load } = useRecordContext(
  () => 'HELPDESK',
  () => 'cases',
  () => props.caseRecord?._id
);

const ownerId = computed(() => {
  const o = props.caseRecord?.caseOwnerId;
  if (!o) return '';
  return typeof o === 'object' ? String(o._id || '') : String(o);
});

const contactLink = computed(() => {
  const c = props.caseRecord?.contactId;
  if (!c || typeof c !== 'object') return '';
  return [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || c.email || '';
});

const organizationLink = computed(() => {
  const o = props.caseRecord?.organizationRefId;
  if (!o || typeof o !== 'object') return '';
  return o.name || '';
});

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen && props.caseRecord?._id) load();
  }
);
</script>

<style scoped>
.case-details-drawer-enter-active,
.case-details-drawer-leave-active {
  transition: opacity 0.2s ease;
}
.case-details-drawer-enter-from,
.case-details-drawer-leave-to {
  opacity: 0;
}
</style>
