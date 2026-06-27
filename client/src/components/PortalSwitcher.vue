<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authRegistry';
import clickOutside from '@/directives/clickOutside';
import { ChevronDownIcon, CheckIcon } from '@heroicons/vue/20/solid';

const vClickOutside = clickOutside;

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();

const open = ref(false);
const switching = ref(false);

const visible = computed(() =>
  authStore.isExternalUser
  && authStore.hasMultiplePortals
  && authStore.user?.activeExternalRoleId
);

const portals = computed(() => authStore.user?.portals || []);
const activeRoleId = computed(() => authStore.user?.activeExternalRoleId || null);
const label = computed(() => authStore.activePortalLabel || t('auth.portalSwitcherLabel'));

const toggle = () => {
  open.value = !open.value;
};

const close = () => {
  open.value = false;
};

const selectPortal = async (roleId) => {
  if (String(roleId) === String(activeRoleId.value)) {
    close();
    return;
  }
  switching.value = true;
  try {
    const ok = await authStore.switchPortal(roleId);
    if (ok) {
      close();
      await router.push({ name: 'portal-dashboard' });
    }
  } finally {
    switching.value = false;
  }
};
</script>

<template>
  <div
    v-if="visible"
    v-click-outside="close"
    class="relative hidden lg:block"
  >
    <button
      type="button"
      class="inline-flex max-w-[12rem] items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
      :disabled="switching || authStore.loading"
      :aria-expanded="open"
      @click.stop="toggle"
    >
      <span class="truncate">{{ label }}</span>
      <ChevronDownIcon class="h-4 w-4 shrink-0 text-neutral-500" />
    </button>

    <div
      v-if="open"
      class="absolute right-0 z-50 mt-2 w-64 rounded-lg border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
    >
      <p class="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
        {{ t('auth.portalSwitcherTitle') }}
      </p>
      <button
        v-for="portal in portals"
        :key="String(portal.roleId)"
        type="button"
        class="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
        :disabled="switching || authStore.loading"
        @click="selectPortal(portal.roleId)"
      >
        <span
          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold text-white"
          :style="{ backgroundColor: portal.color || '#6366f1' }"
        >
          {{ (portal.name || '?').slice(0, 1).toUpperCase() }}
        </span>
        <span class="min-w-0 flex-1 truncate text-neutral-900 dark:text-neutral-100">
          {{ portal.name }}
        </span>
        <CheckIcon
          v-if="String(portal.roleId) === String(activeRoleId)"
          class="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400"
        />
      </button>
    </div>
  </div>
</template>
