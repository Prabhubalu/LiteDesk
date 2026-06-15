<template>
  <Teleport to="body">
    <TransitionRoot as="template" :show="modelValue">
      <Dialog class="relative z-[10050]" @close="onEscape">
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

        <div class="fixed inset-0 z-[10050] w-screen overflow-y-auto p-0 sm:p-6">
          <div class="flex min-h-full items-center justify-center">
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
                :class="RELEASE_NOTE_MODAL_PANEL_CLASS"
                aria-describedby="whats-new-modal-desc"
              >
                <div class="shrink-0 border-b border-gray-200 px-6 py-5 dark:border-gray-700">
                  <DialogTitle class="text-xl font-semibold text-gray-900 dark:text-white">
                    {{ t('releaseNotes.modalTitle') }}
                  </DialogTitle>
                  <p
                    v-if="primaryVersion"
                    :id="versionId"
                    class="mt-1 text-sm text-gray-500 dark:text-gray-400"
                  >
                    {{ t('releaseNotes.versionLabel', { version: primaryVersion }) }}
                  </p>
                  <p id="whats-new-modal-desc" class="sr-only">
                    {{ t('releaseNotes.drawerSubtitle') }}
                  </p>
                </div>

                <div class="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                  <div>
                    <div
                      v-for="(release, index) in releases"
                      :key="release.id"
                      :class="index > 0 ? 'mt-6 border-t border-gray-200 pt-6 dark:border-gray-700' : ''"
                    >
                      <ReleaseCard
                        :release="release"
                        embedded
                        @navigate="onNavigate"
                      />
                    </div>
                  </div>
                </div>

                <div class="flex shrink-0 flex-col gap-2 border-t border-gray-200 px-6 py-4 sm:flex-row sm:justify-end dark:border-gray-700">
                  <button
                    type="button"
                    class="rounded-xl px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                    @click="onRemindLater"
                  >
                    {{ t('releaseNotes.remindLater') }}
                  </button>
                  <button
                    type="button"
                    class="rounded-xl px-4 py-2.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-500/10"
                    @click="onViewAll"
                  >
                    {{ t('releaseNotes.viewReleaseNotes') }}
                  </button>
                  <button
                    type="button"
                    class="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                    @click="onGotIt"
                  >
                    {{ t('releaseNotes.gotIt') }}
                  </button>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </TransitionRoot>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
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
  RELEASE_NOTE_MODAL_PANEL_CLASS
} from '@/utils/releaseNoteMotion';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  releases: { type: Array, default: () => [] }
});

const emit = defineEmits(['update:modelValue']);

const { t } = useI18n();
const { dismissModal, remindLater, openCenter } = useReleaseNotes();

const primaryVersion = computed(() => props.releases[props.releases.length - 1]?.version || '');
const motion = computed(() => getReleaseNoteSurfaceMotion('modal'));
const versionId = computed(() => `whats-new-version-${primaryVersion.value || 'release'}`);

function close() {
  emit('update:modelValue', false);
}

async function onGotIt() {
  await dismissModal();
  close();
}

async function onRemindLater() {
  await remindLater('auto_modal');
  close();
}

function onViewAll() {
  openCenter('modal_cta');
  close();
}

function onNavigate() {
  close();
}

function onEscape() {
  close();
}
</script>
