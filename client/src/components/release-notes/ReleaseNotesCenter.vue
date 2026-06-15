<template>
  <Teleport to="body">
    <TransitionRoot as="template" :show="modelValue">
      <Dialog class="relative z-[10050]" @close="onClose">
        <TransitionChild
          as="template"
          :enter="motion.enter"
          :enter-from="motion.enterFrom"
          :enter-to="motion.enterTo"
          :leave="motion.leave"
          :leave-from="motion.leaveFrom"
          :leave-to="motion.leaveTo"
        >
          <div class="fixed inset-0 bg-gray-500/75 dark:bg-black/75" aria-hidden="true" />
        </TransitionChild>

        <div class="fixed inset-0 overflow-hidden">
          <div class="absolute inset-0 overflow-hidden">
            <div :class="RELEASE_NOTE_DRAWER_HOST_CLASS">
              <TransitionChild
                as="template"
                :enter="motion.panelEnter"
                :enter-from="motion.panelEnterFrom"
                :enter-to="motion.panelEnterTo"
                :leave="motion.panelLeave"
                :leave-from="motion.panelLeaveFrom"
                :leave-to="motion.panelLeaveTo"
              >
                <DialogPanel
                  :class="RELEASE_NOTE_CENTER_PANEL_CLASS"
                  aria-describedby="release-notes-center-desc"
                >
                  <div class="flex shrink-0 items-start justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
                    <div>
                      <DialogTitle class="text-lg font-semibold text-gray-900 dark:text-white">
                        {{ t('releaseNotes.centerTitle') }}
                      </DialogTitle>
                      <p id="release-notes-center-desc" class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {{ t('releaseNotes.centerSubtitle') }}
                      </p>
                    </div>
                    <button
                      type="button"
                      class="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                      @click="onClose"
                    >
                      <span class="sr-only">{{ t('actions.close') }}</span>
                      <XMarkIcon class="h-5 w-5" aria-hidden="true" />
                    </button>
                  </div>

                  <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                    <div v-if="historyLoading && !historyReleases.length" class="flex justify-center py-16">
                      <div class="h-8 w-8 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
                    </div>

                    <div
                      v-else-if="historyError"
                      class="flex flex-col items-center gap-3 py-16 text-center"
                    >
                      <p class="text-sm text-gray-600 dark:text-gray-400">
                        {{ t('releaseNotes.centerLoadFailed') }}
                      </p>
                      <button
                        type="button"
                        class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                        @click="retryHistory"
                      >
                        {{ t('releaseNotes.centerRetry') }}
                      </button>
                    </div>

                    <p
                      v-else-if="!historyReleases.length"
                      class="py-16 text-center text-sm text-gray-500 dark:text-gray-400"
                    >
                      {{ t('releaseNotes.centerEmpty') }}
                    </p>

                    <div v-else class="space-y-0">
                      <div
                        v-for="(release, index) in historyReleases"
                        :key="release.id"
                        :class="index > 0 ? 'mt-8 border-t border-gray-200 pt-8 dark:border-gray-700' : ''"
                      >
                        <ReleaseCard
                          :release="release"
                          @navigate="onClose"
                        />
                      </div>
                    </div>
                  </div>

                  <div
                    v-if="hasUnseen"
                    class="shrink-0 border-t border-gray-200 px-5 py-4 dark:border-gray-700"
                  >
                    <button
                      type="button"
                      class="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
                      @click="onMarkAllRead"
                    >
                      {{ t('releaseNotes.markAllRead') }}
                    </button>
                  </div>
                </DialogPanel>
              </TransitionChild>
            </div>
          </div>
        </div>
      </Dialog>
    </TransitionRoot>
  </Teleport>
</template>

<script setup>
import { computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot
} from '@headlessui/vue';
import ReleaseCard from '@/components/release-notes/ReleaseCard.vue';
import { useReleaseNotes } from '@/composables/useReleaseNotes';
import {
  getReleaseNoteSurfaceMotion,
  RELEASE_NOTE_CENTER_PANEL_CLASS,
  RELEASE_NOTE_DRAWER_HOST_CLASS
} from '@/utils/releaseNoteMotion';

const props = defineProps({
  modelValue: { type: Boolean, default: false }
});

const emit = defineEmits(['update:modelValue']);

const { t } = useI18n();
const {
  historyReleases,
  historyLoading,
  historyError,
  badgeCount,
  fetchHistory,
  closeCenter,
  markAllViewed
} = useReleaseNotes();

const hasUnseen = computed(() => badgeCount.value > 0);
const motion = computed(() => getReleaseNoteSurfaceMotion('drawer'));

watch(
  () => props.modelValue,
  (open) => {
    if (open) void fetchHistory();
  }
);

function onClose() {
  emit('update:modelValue', false);
  void closeCenter(false);
}

function retryHistory() {
  void fetchHistory();
}

async function onMarkAllRead() {
  await markAllViewed('help_center');
  await fetchHistory();
}
</script>
