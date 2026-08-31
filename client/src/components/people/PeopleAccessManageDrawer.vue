<template>
  <Teleport to="body">
    <Transition name="people-access-drawer">
      <div
        v-if="open"
        class="fixed inset-0 z-[9050] flex justify-end"
        role="dialog"
        aria-modal="true"
        @keydown.esc.prevent="emit('close')"
      >
        <div class="absolute inset-0 bg-black/30" aria-hidden="true" @click="emit('close')" />
        <aside
          class="relative z-10 flex h-full w-full max-w-2xl flex-col border-l border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900"
        >
          <div class="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
            <h2 class="text-sm font-semibold text-gray-900 dark:text-white">{{ title }}</h2>
            <button
              type="button"
              class="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              :aria-label="t('settings.roleDrawerCloseSr')"
              @click="emit('close')"
            >
              <XMarkIcon class="h-5 w-5" />
            </button>
          </div>
          <div class="flex-1 overflow-y-auto p-4">
            <PeopleExternalAccessPanel
              v-if="section === 'portal' && peopleId"
              :people-id="peopleId"
              display="full"
              embedded
            />
            <PeopleMarketingSubscriptionsPanel
              v-else-if="section === 'marketing' && peopleId"
              :people-id="peopleId"
              display="full"
              embedded
            />
          </div>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import PeopleExternalAccessPanel from '@/components/people/PeopleExternalAccessPanel.vue';
import PeopleMarketingSubscriptionsPanel from '@/components/people/PeopleMarketingSubscriptionsPanel.vue';

const props = defineProps({
  open: { type: Boolean, default: false },
  section: {
    type: String,
    default: 'portal',
    validator: (v) => v === 'portal' || v === 'marketing'
  },
  peopleId: { type: String, default: '' }
});

const emit = defineEmits(['close']);

const { t } = useI18n();

const title = computed(() =>
  props.section === 'portal'
    ? t('people.externalAccessTitle')
    : t('marketing.personSubscriptionsTitle')
);
</script>

<style scoped>
.people-access-drawer-enter-active,
.people-access-drawer-leave-active {
  transition: opacity 0.2s ease;
}

.people-access-drawer-enter-active aside,
.people-access-drawer-leave-active aside {
  transition: transform 0.25s ease;
}

.people-access-drawer-enter-from,
.people-access-drawer-leave-to {
  opacity: 0;
}

.people-access-drawer-enter-from aside,
.people-access-drawer-leave-to aside {
  transform: translateX(100%);
}
</style>
