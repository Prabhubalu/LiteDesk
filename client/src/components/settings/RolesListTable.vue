<template>
  <div class="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
    <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
      <thead class="bg-gray-50/80 dark:bg-gray-900/40">
        <tr>
          <th scope="col" class="py-3 pl-4 pr-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 sm:pl-6">
            {{ t('settings.rolesListColRole') }}
          </th>
          <th scope="col" class="hidden md:table-cell px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {{ t('settings.rolesListColReportsTo') }}
          </th>
          <th scope="col" class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {{ t('settings.rolesListColUsers') }}
          </th>
          <th scope="col" class="hidden sm:table-cell px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {{ t('settings.rolesListColLevel') }}
          </th>
          <th scope="col" class="relative py-3 pl-3 pr-4 sm:pr-6">
            <span class="sr-only">{{ t('settings.rolesListColActions') }}</span>
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-100 dark:divide-gray-700/80">
        <tr
          v-for="role in roles"
          :key="role._id"
          class="group transition-colors hover:bg-gray-50/80 dark:hover:bg-gray-900/30 cursor-pointer"
          @click="$emit('edit', role)"
        >
          <td class="whitespace-nowrap py-4 pl-4 pr-3 sm:pl-6">
            <div class="flex items-center gap-3 min-w-0">
              <div
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white text-sm font-semibold shadow-sm"
                :style="{ backgroundColor: role.color || '#6366f1' }"
              >
                <component :is="iconFor(role.icon)" class="h-4 w-4" aria-hidden="true" />
              </div>
              <div class="min-w-0">
                <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ role.name }}</p>
                <p v-if="role.description" class="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[220px]">
                  {{ role.description }}
                </p>
              </div>
              <span
                v-if="role.isSystemRole"
                class="hidden lg:inline-flex shrink-0 rounded-full bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-700 dark:text-purple-300"
              >
                {{ t('settings.rolesSystemBadge') }}
              </span>
            </div>
          </td>
          <td class="hidden md:table-cell whitespace-nowrap px-3 py-4 text-sm text-gray-600 dark:text-gray-400">
            {{ parentLabel(role) }}
          </td>
          <td class="whitespace-nowrap px-3 py-4">
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-gray-700 px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
              @click.stop="$emit('users', role)"
            >
              <UsersIcon class="h-3.5 w-3.5" />
              {{ role.userCount || 0 }}
            </button>
          </td>
          <td class="hidden sm:table-cell whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
            {{ t('settings.rolesLevel', { level: role.level ?? 0 }) }}
          </td>
          <td class="whitespace-nowrap py-4 pl-3 pr-4 text-right sm:pr-6">
            <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
              <button
                type="button"
                class="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
                :title="t('actions.edit')"
                @click.stop="$emit('edit', role)"
              >
                <PencilSquareIcon class="h-4 w-4" />
              </button>
              <button
                v-if="!role.isSystemRole"
                type="button"
                class="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                :title="t('settings.rolesDeleteTitle')"
                @click.stop="$emit('delete', role)"
              >
                <TrashIcon class="h-4 w-4" />
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import {
  UserIcon,
  UsersIcon,
  EyeIcon,
  ShieldCheckIcon,
  PencilSquareIcon,
  TrashIcon
} from '@heroicons/vue/24/outline';
import { StarIcon } from '@heroicons/vue/24/solid';

defineProps({
  roles: {
    type: Array,
    default: () => []
  }
});

defineEmits(['edit', 'users', 'delete']);

const { t } = useI18n();

function iconFor(icon) {
  const map = {
    crown: StarIcon,
    shield: ShieldCheckIcon,
    users: UsersIcon,
    eye: EyeIcon,
    user: UserIcon
  };
  return map[icon] || UserIcon;
}

function parentLabel(role) {
  const parent = role.parentRole;
  if (!parent) return t('settings.roleDrawerParentNone');
  if (typeof parent === 'object') return parent.name || '—';
  return '—';
}
</script>
