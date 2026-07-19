<template>
  <Menu
    v-if="canPin"
    as="div"
    class="relative z-[2] inline-block text-left"
  >
    <MenuButton
      type="button"
      class="inline-flex items-center gap-1 rounded-lg border border-neutral-200/80 bg-white/95 px-2 py-1 text-[11px] font-semibold text-primary-800 shadow-sm transition hover:bg-primary-50 disabled:opacity-50 dark:border-neutral-600 dark:bg-neutral-900/90 dark:text-primary-200 dark:hover:bg-primary-500/10"
      :disabled="pinning"
      :title="t('liveChat.astraPinToDashboard')"
      @click="onPinMenuOpen"
    >
      <BookmarkIcon class="h-3.5 w-3.5" aria-hidden="true" />
      <span>{{ pinning ? t('liveChat.astraPinning') : t('liveChat.astraPinToDashboard') }}</span>
      <ChevronDownIcon class="h-3 w-3 opacity-60" aria-hidden="true" />
    </MenuButton>
    <transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <MenuItems
        class="absolute right-0 z-20 mt-1 w-56 origin-top-right overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
      >
        <div class="border-b border-neutral-100 px-3 py-2 dark:border-neutral-800">
          <p class="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
            {{ t('liveChat.astraPinChooseDashboard') }}
          </p>
        </div>
        <div class="max-h-56 overflow-y-auto py-1">
          <MenuItem
            v-for="dash in dashboards"
            :key="dash._id"
            v-slot="{ active }"
          >
            <button
              type="button"
              class="flex w-full flex-col px-3 py-2 text-left text-[12px]"
              :class="active ? 'bg-primary-50 text-primary-900 dark:bg-primary-500/15 dark:text-primary-100' : 'text-neutral-800 dark:text-neutral-100'"
              @click="void pinTo(dash._id)"
            >
              <span class="font-semibold">{{ dash.name }}</span>
              <span class="text-[10px] text-neutral-500">{{ dash.category || 'personal' }}</span>
            </button>
          </MenuItem>
          <p
            v-if="!loading && !dashboards.length"
            class="px-3 py-2 text-[11px] text-neutral-500"
          >
            {{ t('liveChat.astraPinNoDashboards') }}
          </p>
        </div>
        <div class="border-t border-neutral-100 p-1 dark:border-neutral-800">
          <MenuItem v-slot="{ active }">
            <button
              type="button"
              class="w-full rounded-lg px-3 py-2 text-left text-[12px] font-semibold text-primary-800 dark:text-primary-200"
              :class="active ? 'bg-primary-50 dark:bg-primary-500/15' : ''"
              @click="void pinTo('')"
            >
              {{ t('liveChat.astraPinNewPersonal') }}
            </button>
          </MenuItem>
        </div>
        <p
          v-if="error"
          class="border-t border-rose-100 px-3 py-2 text-[11px] text-rose-700 dark:border-rose-900 dark:text-rose-300"
        >
          {{ error }}
        </p>
        <p
          v-if="success"
          class="border-t border-emerald-100 px-3 py-2 text-[11px] text-emerald-700 dark:border-emerald-900 dark:text-emerald-300"
        >
          {{ success }}
        </p>
      </MenuItems>
    </transition>
  </Menu>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue';
import { BookmarkIcon, ChevronDownIcon } from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import type { InAppAiVisual } from '@/composables/useInProductAiAsk';

const props = defineProps<{
  visual: InAppAiVisual;
  appKey?: string;
}>();

const { t } = useI18n();
const router = useRouter();

type DashRow = { _id: string; name: string; category?: string };

const dashboards = ref<DashRow[]>([]);
const loading = ref(false);
const pinning = ref(false);
const error = ref('');
const success = ref('');

const canPin = computed(() => {
  const c = props.visual.component;
  if (c === 'callout') return false;
  return Boolean(props.visual.pinSource?.moduleKey)
    || /\b(tasks?|deals?|pipeline|cases?|events?|quotes?)\b/i.test(String(props.visual.title || ''));
});

async function loadDashboards() {
  if (dashboards.value.length || loading.value) return;
  loading.value = true;
  error.value = '';
  try {
    const res = await apiClient.get('/analytics/dashboards', {
      params: { limit: 30, status: 'published' },
      cache: 'no-store',
      skipAuthLogout: true,
    });
    if (res?.success && Array.isArray(res.data)) {
      dashboards.value = res.data.map((d: { _id: string; name?: string; category?: string }) => ({
        _id: String(d._id),
        name: String(d.name || 'Dashboard'),
        category: d.category,
      }));
    }
  } catch {
    // Permission / feature / auth probe must never wipe the CRM session.
    dashboards.value = [];
  } finally {
    loading.value = false;
  }
}

async function pinTo(dashboardId: string) {
  if (pinning.value) return;
  pinning.value = true;
  error.value = '';
  success.value = '';
  try {
    const res = await apiClient.post('/analytics/dashboards/pin-astra-visual', {
      visual: props.visual,
      dashboardId: dashboardId || undefined,
      appKey: props.appKey || 'SALES',
    }, {
      skipAuthLogout: true,
    });
    if (!res?.success) {
      error.value = String(res?.message || t('liveChat.astraPinFailed'));
      return;
    }
    const name = String(res.data?.dashboard?.name || '');
    success.value = t('liveChat.astraPinSuccess', { name: name || 'dashboard' });
    const id = res.data?.dashboard?._id;
    if (id) {
      setTimeout(() => {
        router.push({ name: 'analytics-dashboard-view', params: { id: String(id) } }).catch(() => {
          router.push(`/analytics/dashboards/${id}`).catch(() => {});
        });
      }, 600);
    }
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    const msg = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message
      || (err as { message?: string })?.message
      || t('liveChat.astraPinFailed');
    error.value = status === 401
      ? t('liveChat.astraPinAuthRequired')
      : String(msg);
  } finally {
    pinning.value = false;
  }
}

function onPinMenuOpen() {
  void loadDashboards();
}
</script>
