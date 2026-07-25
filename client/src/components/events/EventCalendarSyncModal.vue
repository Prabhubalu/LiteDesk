<template>
  <Teleport to="body">
    <TransitionRoot as="template" :show="modelValue">
      <Dialog class="relative z-[10000]" @close="close">
        <TransitionChild
          as="template"
          enter="ease-out duration-200"
          enter-from="opacity-0"
          enter-to="opacity-100"
          leave="ease-in duration-200"
          leave-from="opacity-100"
          leave-to="opacity-0"
        >
          <div class="fixed inset-0 bg-black/25 dark:bg-black/50" aria-hidden="true" />
        </TransitionChild>

        <div class="fixed inset-0 overflow-hidden">
          <div class="absolute inset-0 overflow-hidden">
            <div class="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-0 sm:pl-16">
              <TransitionChild
                as="template"
                enter="transform transition ease-out duration-300"
                enter-from="translate-x-full"
                enter-to="translate-x-0"
                leave="transform transition ease-in duration-250"
                leave-from="translate-x-0"
                leave-to="translate-x-full"
              >
                <div class="pointer-events-auto flex h-full max-w-full">
                  <DialogPanel
                    class="flex h-full w-screen max-w-full flex-col overflow-hidden rounded-tl-xl bg-white shadow-2xl ring-1 ring-black/5 dark:bg-gray-900 dark:ring-white/10 sm:w-[28rem]"
                    aria-describedby="event-calendar-sync-desc"
                  >
                    <!-- Header -->
                    <div class="flex shrink-0 items-start justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800 sm:px-6">
                      <div class="min-w-0">
                        <DialogTitle class="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
                          {{ t('events.calendarSyncTitle') }}
                        </DialogTitle>
                        <p
                          id="event-calendar-sync-desc"
                          class="mt-1 text-sm leading-relaxed text-gray-500 dark:text-gray-400"
                        >
                          {{ t('events.calendarSyncIntro') }}
                        </p>
                      </div>
                      <button
                        type="button"
                        class="shrink-0 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                        :aria-label="t('actions.close')"
                        @click="close"
                      >
                        <XMarkIcon class="h-5 w-5" aria-hidden="true" />
                      </button>
                    </div>

                    <!-- Body -->
                    <div class="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                      <h3 class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        {{ t('events.calendarSyncUserLevel') }}
                      </h3>

                      <div
                        v-if="loading"
                        class="mt-5 flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-5 dark:border-gray-700 dark:bg-gray-800/50"
                      >
                        <div
                          class="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600 dark:border-gray-600 dark:border-t-indigo-400"
                        />
                        <span class="text-sm text-gray-600 dark:text-gray-300">{{ t('states.loading') }}</span>
                      </div>

                      <ul v-else class="mt-4 space-y-2.5">
                        <li
                          v-for="row in connectorRows"
                          :key="row.id"
                          class="rounded-xl border border-gray-200 bg-white p-3.5 transition-colors dark:border-gray-700 dark:bg-gray-900/80"
                          :class="row.comingSoon ? 'opacity-80' : 'hover:border-gray-300 dark:hover:border-gray-600'"
                        >
                          <div class="flex items-start gap-3">
                            <div
                              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
                              aria-hidden="true"
                            >
                              <component :is="row.Logo" class="h-5 w-5" />
                            </div>

                            <div class="min-w-0 flex-1">
                              <div class="flex flex-wrap items-center gap-2">
                                <p class="text-sm font-semibold text-gray-900 dark:text-white">
                                  {{ row.label }}
                                </p>
                                <span
                                  v-if="row.comingSoon"
                                  class="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                                >
                                  {{ t('platform.appRegistryStatusComingSoon') }}
                                </span>
                                <span
                                  v-else-if="row.connected"
                                  class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                >
                                  <span class="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                                  {{ t('events.calendarSyncConnected') }}
                                </span>
                              </div>

                              <p
                                v-if="row.connected && row.accountEmail"
                                class="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400"
                              >
                                {{ row.accountEmail }}
                              </p>
                              <p
                                v-else-if="!row.comingSoon && row.available === false"
                                class="mt-0.5 text-xs text-amber-700 dark:text-amber-300"
                              >
                                {{ t('events.calendarSyncProviderNotConfigured') }}
                              </p>
                              <p
                                v-else-if="!row.comingSoon && !row.connected"
                                class="mt-0.5 text-xs text-gray-500 dark:text-gray-400"
                              >
                                {{ t('events.calendarSyncConnectHint') }}
                              </p>
                            </div>
                          </div>

                          <div
                            v-if="!row.comingSoon"
                            class="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 pt-3 dark:border-gray-800"
                          >
                            <template v-if="row.connected">
                              <button
                                type="button"
                                class="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-800"
                                :disabled="calendarConnectLoading"
                                @click="onReconnect(row)"
                              >
                                {{ t('events.calendarSyncReconnect') }}
                              </button>
                              <button
                                type="button"
                                class="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-800"
                                :disabled="calendarConnectLoading"
                                @click="onDisconnect(row)"
                              >
                                {{ t('appointments.disconnect') }}
                              </button>
                            </template>
                            <template v-else>
                              <button
                                type="button"
                                class="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                                :disabled="calendarConnectLoading || row.available === false"
                                @click="onSignIn(row)"
                              >
                                {{ t('auth.signIn') }}
                              </button>
                            </template>
                          </div>
                        </li>
                      </ul>
                    </div>
                  </DialogPanel>
                </div>
              </TransitionChild>
            </div>
          </div>
        </div>
      </Dialog>
    </TransitionRoot>
  </Teleport>
</template>

<script setup>
import { computed, defineComponent, h, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot
} from '@headlessui/vue';
import { useUserCalendarConnect } from '@/composables/useUserCalendarConnect';
import { useNotifications } from '@/composables/useNotifications';

const props = defineProps({
  modelValue: { type: Boolean, default: false }
});

const emit = defineEmits(['update:modelValue']);

const { t } = useI18n();
const notifications = useNotifications();
const {
  calendarConnectLoading,
  fetchConnections,
  startOAuth,
  disconnect
} = useUserCalendarConnect();

const loading = ref(false);
const connectors = ref([]);

/** Official multicolor Google "G" mark */
const GoogleLogo = defineComponent({
  name: 'GoogleLogo',
  setup() {
    return () =>
      h(
        'svg',
        { viewBox: '0 0 24 24', fill: 'none', xmlns: 'http://www.w3.org/2000/svg', 'aria-hidden': 'true' },
        [
          h('path', {
            d: 'M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z',
            fill: '#4285F4'
          }),
          h('path', {
            d: 'M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z',
            fill: '#34A853'
          }),
          h('path', {
            d: 'M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z',
            fill: '#FBBC05'
          }),
          h('path', {
            d: 'M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z',
            fill: '#EA4335'
          })
        ]
      );
  }
});

/** Microsoft four-square mark */
const MicrosoftLogo = defineComponent({
  name: 'MicrosoftLogo',
  setup() {
    return () =>
      h(
        'svg',
        { viewBox: '0 0 24 24', fill: 'none', xmlns: 'http://www.w3.org/2000/svg', 'aria-hidden': 'true' },
        [
          h('rect', { x: '1', y: '1', width: '10', height: '10', fill: '#F25022' }),
          h('rect', { x: '13', y: '1', width: '10', height: '10', fill: '#7FBA00' }),
          h('rect', { x: '1', y: '13', width: '10', height: '10', fill: '#00A4EF' }),
          h('rect', { x: '13', y: '13', width: '10', height: '10', fill: '#FFB900' })
        ]
      );
  }
});

/** Zoom mark */
const ZoomLogo = defineComponent({
  name: 'ZoomLogo',
  setup() {
    return () =>
      h(
        'svg',
        { viewBox: '0 0 24 24', fill: 'none', xmlns: 'http://www.w3.org/2000/svg', 'aria-hidden': 'true' },
        [
          h('rect', { x: '1', y: '5', width: '14', height: '11', rx: '2.5', fill: '#2D8CFF' }),
          h('path', {
            d: 'M16.5 9.2l5.2-2.6c.6-.3 1.3.1 1.3.8v9.2c0 .7-.7 1.1-1.3.8l-5.2-2.6V9.2z',
            fill: '#2D8CFF'
          })
        ]
      );
  }
});

/** Jio Meet–style mark (green video badge) */
const JioMeetLogo = defineComponent({
  name: 'JioMeetLogo',
  setup() {
    return () =>
      h(
        'svg',
        { viewBox: '0 0 24 24', fill: 'none', xmlns: 'http://www.w3.org/2000/svg', 'aria-hidden': 'true' },
        [
          h('rect', { x: '1', y: '1', width: '22', height: '22', rx: '6', fill: '#0A5C2E' }),
          h('path', {
            d: 'M7 9.2c0-.66.54-1.2 1.2-1.2h4.6c.66 0 1.2.54 1.2 1.2v5.6c0 .66-.54 1.2-1.2 1.2H8.2c-.66 0-1.2-.54-1.2-1.2V9.2z',
            fill: '#fff'
          }),
          h('path', {
            d: 'M15.2 10.3l3.1-1.55c.45-.22.95.11.95.62v5.26c0 .51-.5.84-.95.62l-3.1-1.55v-3.4z',
            fill: '#fff'
          })
        ]
      );
  }
});

const LOGO_BY_ID = {
  google: GoogleLogo,
  microsoft: MicrosoftLogo,
  zoom: ZoomLogo,
  jio_meet: JioMeetLogo
};

const connectorRows = computed(() =>
  (connectors.value || []).map((c) => ({
    ...c,
    Logo: LOGO_BY_ID[c.id] || GoogleLogo
  }))
);

function close() {
  emit('update:modelValue', false);
}

async function refresh() {
  loading.value = true;
  try {
    connectors.value = await fetchConnections();
  } catch (err) {
    notifications.error(err?.message || t('events.calendarSyncLoadFailed'));
    connectors.value = [];
  } finally {
    loading.value = false;
  }
}

function onSignIn(row) {
  startOAuth(row.provider, {
    onConnected: () => refresh(),
    onPopupClosed: () => refresh()
  });
}

function onReconnect(row) {
  startOAuth(row.provider, {
    onConnected: () => refresh(),
    onPopupClosed: () => refresh()
  });
}

async function onDisconnect(row) {
  const ok = await disconnect(row.provider);
  if (ok) await refresh();
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) refresh();
  }
);

defineExpose({ refresh });
</script>
