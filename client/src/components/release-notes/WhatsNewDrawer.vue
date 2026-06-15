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
                  :class="RELEASE_NOTE_DRAWER_PANEL_CLASS"
                  aria-describedby="whats-new-drawer-desc"
                >
                  <div class="flex shrink-0 items-start justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
                    <div>
                      <DialogTitle class="text-lg font-semibold text-gray-900 dark:text-white">
                        {{ t('releaseNotes.drawerTitle') }}
                      </DialogTitle>
                      <p id="whats-new-drawer-desc" class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {{ t('releaseNotes.drawerSubtitle') }}
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

                  <div class="flex shrink-0 flex-col gap-2 border-t border-gray-200 px-5 py-4 dark:border-gray-700">
                    <button
                      type="button"
                      class="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
                      @click="onGotIt"
                    >
                      {{ t('releaseNotes.gotIt') }}
                    </button>
                    <button
                      type="button"
                      class="rounded-xl px-4 py-2.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-500/10"
                      @click="onViewAll"
                    >
                      {{ t('releaseNotes.viewReleaseNotes') }}
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
import { computed } from 'vue';
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
  RELEASE_NOTE_DRAWER_HOST_CLASS,
  RELEASE_NOTE_DRAWER_PANEL_CLASS
} from '@/utils/releaseNoteMotion';

defineProps({
  modelValue: { type: Boolean, default: false },
  releases: { type: Array, default: () => [] }
});

const emit = defineEmits(['update:modelValue']);

const { t } = useI18n();
const { dismissDrawer, openCenter } = useReleaseNotes();

const motion = computed(() => getReleaseNoteSurfaceMotion('drawer'));

function close() {
  emit('update:modelValue', false);
}

async function onGotIt() {
  await dismissDrawer();
  close();
}

function onClose() {
  close();
}

function onViewAll() {
  openCenter('drawer_cta');
  close();
}

function onNavigate() {
  close();
}

function onEscape() {
  close();
}
</script>
