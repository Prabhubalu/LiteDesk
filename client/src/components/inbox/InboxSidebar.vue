<template>
  <aside
    class="inbox-sidebar flex w-[240px] shrink-0 flex-col overflow-hidden border-r border-[#EBEBEB] bg-[#F7F7F5] dark:border-gray-800 dark:bg-[#1a1a1a]"
    :class="hiddenOnMobile ? 'max-lg:hidden' : ''"
    :aria-label="t('inbox.inboxSurfaceMailFoldersAndMailboxes')"
  >
    <!-- Mailbox selector + compose -->
    <div class="flex items-start gap-2 px-3 pb-3 pt-4">
      <div class="min-w-0 flex-1">
        <p
          v-if="!mailboxItems.length"
          class="rounded-md bg-black/[0.03] px-2.5 py-2 text-xs leading-relaxed text-[#9B9A97] dark:bg-white/[0.03] dark:text-gray-500"
        >
          {{ t('inbox.inboxSurfaceNoMailboxesYetAddOneBelow') }}
        </p>
        <template v-else>
          <HeadlessSelect
            :model-value="selectedMailboxId ?? ''"
            :option-groups="mailboxSelectOptionGroups"
            allow-empty
            :empty-label="t('inbox.inboxSurfaceAllMail')"
            :placeholder="t('inbox.inboxSidebarSelectMailbox')"
            :button-class="mailboxSelectButtonClass"
            options-class="z-[10050]"
            teleport
            @update:model-value="onMailboxSelect"
          />
          <div
            v-if="selectedMailboxItem"
            class="mt-1.5 flex flex-wrap gap-1"
          >
            <button
              type="button"
              class="rounded px-1.5 py-0.5 text-[10px] font-medium uppercase text-[#787774] hover:bg-black/[0.06] dark:text-gray-400 dark:hover:bg-white/10"
              :title="t('inbox.mailboxDetailsView')"
              @click="emit('view-mailbox', selectedMailboxItem.id)"
            >
              {{ t('inbox.mailboxDetailsViewShort') }}
            </button>
            <button
              v-if="selectedMailboxItem.showConnect"
              type="button"
              class="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
              @click="emit('connect-mailbox', selectedMailboxItem.id)"
            >
              {{ t('inbox.inboxSurfaceConnect') }}
            </button>
            <button
              v-if="selectedMailboxItem.showMembers"
              type="button"
              class="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase text-violet-700 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-950/40"
              @click="emit('manage-members', selectedMailboxItem.id)"
            >
              {{ t('settings.groupsLabelMembers') }}
            </button>
          </div>
        </template>
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
  FolderIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon
} from '@heroicons/vue/24/outline';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';

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

const mailboxSelectButtonClass =
  'border-0 bg-black/[0.04] py-1.5 px-2.5 text-[13px] text-[#37352F] rounded-md shadow-none outline-none focus:outline-none focus:ring-1 focus:ring-[#2383E2]/40 dark:bg-white/5 dark:text-gray-100 dark:focus:ring-blue-500/40';

const props = withDefaults(defineProps<{
  hiddenOnMobile?: boolean;
  searchQuery: string;
  viewItems: SidebarNavItem[];
  mailItems: SidebarNavItem[];
  mailboxItems?: SidebarMailboxItem[];
  selectedMailboxId?: string | null;
  gmailFolderItems?: SidebarGmailFolderItem[];
  mailboxFlags?: SidebarMailboxFlags;
  mailboxActionLoading?: boolean;
}>(), {
  mailboxItems: () => [],
  selectedMailboxId: null,
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

const selectedMailboxItem = computed(() => {
  const id = props.selectedMailboxId;
  if (!id) return null;
  return props.mailboxItems.find((mb) => String(mb.id) === String(id)) || null;
});

const mailboxSelectOptionGroups = computed(() => {
  const personal = props.mailboxItems.filter((mb) => mb.kind === 'personal');
  const group = props.mailboxItems.filter((mb) => mb.kind === 'group');
  const groups = [];
  if (personal.length) {
    groups.push({
      label: t('inbox.mailboxDetailsPersonal'),
      options: personal.map(mailboxSelectOption)
    });
  }
  if (group.length) {
    groups.push({
      label: t('inbox.mailboxDetailsShared'),
      options: group.map(mailboxSelectOption)
    });
  }
  return groups;
});

function mailboxSelectOption(mb: SidebarMailboxItem) {
  const unread = mb.unreadCount > 0 ? ` (${mb.unreadCount})` : '';
  const label = mb.emailAddress ? `${mb.label} · ${mb.emailAddress}` : mb.label;
  return { value: mb.id, label: `${label}${unread}` };
}

function onMailboxSelect(value: string | number | null) {
  emit('select-mailbox', value === '' || value == null ? null : String(value));
}

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
