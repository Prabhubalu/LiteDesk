<template>
  <aside
    class="inbox-sidebar flex w-[240px] shrink-0 flex-col overflow-hidden border-r border-[#EBEBEB] bg-[#F7F7F5] dark:border-gray-800 dark:bg-[#1a1a1a]"
    :class="hiddenOnMobile ? 'max-lg:hidden' : ''"
    :aria-label="t('inbox.inboxSurfaceMailFoldersAndMailboxes')"
  >
    <!-- Profile + compose -->
    <div class="flex items-start gap-2 px-4 pb-3 pt-4">
      <div class="flex min-w-0 flex-1 items-center gap-2.5">
        <div class="shrink-0 ring-1 ring-black/5 dark:ring-white/10 rounded-full">
          <AvatarInitials
            :first-name="authStore.user?.firstName"
            :last-name="authStore.user?.lastName"
            :email="authStore.user?.email"
            :username="authStore.user?.username"
            :avatar="authStore.user?.avatar"
            size="sm"
          />
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate text-[13px] font-medium leading-tight text-[#37352F] dark:text-gray-100">
            {{ userDisplayName }}
          </p>
          <p class="truncate text-[11px] leading-tight text-[#9B9A97] dark:text-gray-500">
            {{ userEmail }}
          </p>
        </div>
      </div>
      <button
        type="button"
        class="mt-0.5 shrink-0 rounded-md p-1.5 text-[#787774] transition hover:bg-black/[0.04] hover:text-[#37352F] dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200"
        :title="t('inbox.inboxSurfaceComposeWorkspaceEmail')"
        @click="emit('compose')"
      >
        <PencilSquareIcon class="h-[18px] w-[18px]" aria-hidden="true" />
      </button>
    </div>

    <!-- Search -->
    <div class="px-3 pb-3">
      <div class="relative">
        <MagnifyingGlassIcon
          class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9B9A97] dark:text-gray-500"
          aria-hidden="true"
        />
        <input
          :value="searchQuery"
          type="search"
          class="w-full rounded-md border-0 bg-black/[0.04] py-1.5 pl-8 pr-3 text-[13px] text-[#37352F] placeholder:text-[#9B9A97] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#2383E2]/40 dark:bg-white/5 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:bg-gray-900 dark:focus:ring-blue-500/40"
          :placeholder="t('inbox.inboxSidebarSearchPlaceholder')"
          autocomplete="off"
          :aria-label="t('inbox.inboxSurfaceSearchMail')"
          @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
        />
      </div>
    </div>

    <nav class="arivu-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-2" :aria-label="t('inbox.inboxSurfaceMailNavigation')">
      <!-- Views -->
      <div v-if="viewItems.length" class="mb-1">
        <p class="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-[#9B9A97] dark:text-gray-500">
          {{ t('inbox.inboxSidebarViews') }}
        </p>
        <button
          v-for="item in viewItems"
          :key="item.id"
          type="button"
          class="group flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] transition"
          :class="navItemClass(item.active)"
          @click="emit('select-view', item.id)"
        >
          <component :is="item.icon" class="h-4 w-4 shrink-0" :class="item.iconClass" aria-hidden="true" />
          <span class="min-w-0 flex-1 truncate">{{ item.label }}</span>
          <span
            v-if="item.count != null && item.count > 0"
            class="shrink-0 text-[11px] tabular-nums text-[#9B9A97] dark:text-gray-500"
          >
            {{ formatCount(item.count) }}
          </span>
        </button>
      </div>

      <!-- Mail folders -->
      <div class="mb-1 mt-2">
        <p class="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-[#9B9A97] dark:text-gray-500">
          {{ t('inbox.inboxSurfaceMail') }}
        </p>
        <button
          v-for="item in mailItems"
          :key="item.id"
          type="button"
          class="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] transition"
          :class="navItemClass(item.active)"
          @click="emit('select-mail', item.id)"
        >
          <component :is="item.icon" class="h-4 w-4 shrink-0 text-[#787774] dark:text-gray-400" aria-hidden="true" />
          <span class="min-w-0 flex-1 truncate">{{ item.label }}</span>
          <span
            v-if="item.count != null && item.count > 0"
            class="shrink-0 text-[11px] tabular-nums text-[#9B9A97] dark:text-gray-500"
          >
            {{ item.count }}
          </span>
        </button>
      </div>

      <!-- Mailboxes -->
      <div class="mb-1 mt-3">
        <p class="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-[#9B9A97] dark:text-gray-500">
          {{ t('inbox.inboxSurfaceMailboxes') }}
        </p>
        <p
          v-if="!mailboxItems.length"
          class="px-2 py-1 text-xs leading-relaxed text-[#9B9A97] dark:text-gray-500"
        >
          {{ t('inbox.inboxSurfaceNoMailboxesYetAddOneBelow') }}
        </p>
        <div
          v-for="mb in mailboxItems"
          :key="mb.id"
          class="group/mb flex w-full items-start gap-1 rounded-md px-1 py-0.5"
          :class="mb.active ? 'bg-black/[0.06] dark:bg-white/10' : ''"
        >
          <button
            type="button"
            class="flex min-w-0 flex-1 items-start gap-2 rounded-md px-1 py-1.5 text-left text-[13px] transition hover:bg-black/[0.04] dark:hover:bg-white/5"
            :class="mb.active ? 'font-medium text-[#37352F] dark:text-white' : 'text-[#37352F] dark:text-gray-200'"
            @click="emit('select-mailbox', mb.id)"
          >
            <EnvelopeIcon
              v-if="mb.kind === 'personal'"
              class="mt-0.5 h-4 w-4 shrink-0 text-[#2383E2] dark:text-blue-400"
              aria-hidden="true"
            />
            <UserGroupIcon
              v-else
              class="mt-0.5 h-4 w-4 shrink-0 text-violet-500 dark:text-violet-400"
              aria-hidden="true"
            />
            <span class="min-w-0 flex-1">
              <span class="block truncate">{{ mb.label }}</span>
              <span
                v-if="mb.emailAddress"
                class="mt-0.5 block truncate text-[11px] text-[#9B9A97] dark:text-gray-500"
              >{{ mb.emailAddress }}</span>
              <span
                v-if="mb.syncStatusLabel"
                class="mt-0.5 block text-[10px] uppercase tracking-wide text-[#9B9A97] dark:text-gray-500"
              >{{ mb.syncStatusLabel }}</span>
            </span>
            <span
              v-if="mb.unreadCount > 0"
              class="mt-0.5 shrink-0 text-[11px] tabular-nums text-[#9B9A97] dark:text-gray-500"
            >
              {{ mb.unreadCount }}
            </span>
          </button>
          <div class="flex shrink-0 flex-col gap-0.5 pt-1 opacity-0 transition group-hover/mb:opacity-100 focus-within:opacity-100">
            <button
              type="button"
              class="rounded px-1.5 py-0.5 text-[10px] font-medium uppercase text-[#787774] hover:bg-black/[0.06] dark:text-gray-400 dark:hover:bg-white/10"
              :title="t('inbox.mailboxDetailsView')"
              @click.stop="emit('view-mailbox', mb.id)"
            >
              {{ t('inbox.mailboxDetailsViewShort') }}
            </button>
            <button
              v-if="mb.showConnect"
              type="button"
              class="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
              @click.stop="emit('connect-mailbox', mb.id)"
            >
              {{ t('inbox.inboxSurfaceConnect') }}
            </button>
            <button
              v-if="mb.showMembers"
              type="button"
              class="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase text-violet-700 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-950/40"
              @click.stop="emit('manage-members', mb.id)"
            >
              {{ t('settings.groupsLabelMembers') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Gmail folders -->
      <div v-if="gmailFolderItems.length" class="mb-1 mt-3">
        <p class="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-[#9B9A97] dark:text-gray-500">
          {{ t('inbox.inboxSurfaceGmailFolders') }}
        </p>
        <button
          v-for="folder in gmailFolderItems"
          :key="folder.id"
          type="button"
          class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition"
          :class="navItemClass(folder.active)"
          @click="emit('select-gmail-folder', folder.id)"
        >
          <FolderIcon class="h-4 w-4 shrink-0 text-[#787774] dark:text-gray-400" aria-hidden="true" />
          <span class="min-w-0 flex-1 truncate">{{ folder.label }}</span>
        </button>
      </div>
    </nav>

    <!-- Footer -->
    <div class="shrink-0 border-t border-[#EBEBEB] px-2 py-3 dark:border-gray-800">
      <div class="mb-2 flex flex-col gap-1.5">
        <button
          v-if="mailboxFlags.canCreatePersonal"
          type="button"
          class="w-full rounded-md border border-[#E8E8E6] bg-white py-1.5 text-center text-xs font-medium text-[#37352F] hover:bg-[#F7F7F5] disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
          :disabled="mailboxActionLoading"
          @click="emit('create-personal-mailbox')"
        >
          {{ t('inbox.mailboxSidebarAddPersonal') }}
        </button>
        <button
          v-else-if="mailboxFlags.canDeletePersonal"
          type="button"
          class="w-full rounded-md border border-red-200/90 py-1.5 text-center text-xs font-medium text-red-800 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:text-red-200 dark:hover:bg-red-950/40"
          :disabled="mailboxActionLoading"
          @click="emit('delete-personal-mailbox')"
        >
          {{ t('inbox.mailboxDetailsRemovePersonal') }}
        </button>
        <button
          v-if="mailboxFlags.canCreateGroup"
          type="button"
          class="w-full rounded-md border border-violet-200 bg-violet-50 py-1.5 text-center text-xs font-medium text-violet-900 hover:bg-violet-100 disabled:opacity-50 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-100 dark:hover:bg-violet-900/30"
          :disabled="mailboxActionLoading"
          @click="emit('setup-group-mailbox')"
        >
          {{ t('inbox.mailboxSidebarAddGroup') }}
        </button>
      </div>
      <RouterLink
        :to="{ path: '/settings', query: { tab: 'integrations' } }"
        class="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] text-[#787774] transition hover:bg-black/[0.04] hover:text-[#37352F] dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200"
      >
        <Cog6ToothIcon class="h-4 w-4 shrink-0" aria-hidden="true" />
        {{ t('inbox.inboxSidebarSettings') }}
      </RouterLink>
      <RouterLink
        :to="{ path: '/settings', query: { tab: 'integrations' } }"
        class="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] text-[#787774] transition hover:bg-black/[0.04] hover:text-[#37352F] dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200"
      >
        <ChatBubbleLeftRightIcon class="h-4 w-4 shrink-0" aria-hidden="true" />
        {{ t('inbox.inboxSidebarEmailSetup') }}
      </RouterLink>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';
import {
  ChatBubbleLeftRightIcon,
  Cog6ToothIcon,
  EnvelopeIcon,
  FolderIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  UserGroupIcon
} from '@heroicons/vue/24/outline';
import { useAuthStore } from '@/stores/authRegistry';
import AvatarInitials from '@/components/ui/AvatarInitials.vue';

export interface SidebarNavItem {
  id: string;
  label: string;
  active: boolean;
  count?: number | null;
  icon: object;
  iconClass?: string;
}

export interface SidebarMailboxItem {
  id: string;
  label: string;
  kind: 'personal' | 'group';
  active: boolean;
  unreadCount: number;
  emailAddress?: string;
  syncStatusLabel?: string;
  showConnect?: boolean;
  showMembers?: boolean;
}

export interface SidebarMailboxFlags {
  canCreatePersonal: boolean;
  canDeletePersonal: boolean;
  canCreateGroup: boolean;
}

export interface SidebarGmailFolderItem {
  id: string;
  label: string;
  active: boolean;
}

const props = withDefaults(defineProps<{
  hiddenOnMobile?: boolean;
  searchQuery: string;
  viewItems: SidebarNavItem[];
  mailItems: SidebarNavItem[];
  mailboxItems?: SidebarMailboxItem[];
  gmailFolderItems?: SidebarGmailFolderItem[];
  mailboxFlags?: SidebarMailboxFlags;
  mailboxActionLoading?: boolean;
}>(), {
  mailboxItems: () => [],
  gmailFolderItems: () => [],
  mailboxFlags: () => ({
    canCreatePersonal: false,
    canDeletePersonal: false,
    canCreateGroup: false
  }),
  mailboxActionLoading: false
});

const emit = defineEmits<{
  compose: [];
  'update:searchQuery': [value: string];
  'select-view': [id: string];
  'select-mail': [id: string];
  'select-mailbox': [id: string | null];
  'select-gmail-folder': [id: string];
  'view-mailbox': [id: string];
  'connect-mailbox': [id: string];
  'manage-members': [id: string];
  'create-personal-mailbox': [];
  'delete-personal-mailbox': [];
  'setup-group-mailbox': [];
}>();

const { t } = useI18n();
const authStore = useAuthStore();

const userDisplayName = computed(() => {
  const u = authStore.user;
  if (!u) return '';
  return u.username || u.email || '';
});

const userEmail = computed(() => String(authStore.user?.email || '').trim());

function navItemClass(active: boolean) {
  return active
    ? 'bg-black/[0.06] font-medium text-[#37352F] dark:bg-white/10 dark:text-white'
    : 'text-[#37352F] hover:bg-black/[0.04] dark:text-gray-200 dark:hover:bg-white/5';
}

function formatCount(n: number) {
  if (n > 99) return '99+';
  return String(n);
}
</script>
