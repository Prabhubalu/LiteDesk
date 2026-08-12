<template>
  <aside
    :class="[
      'inbox-sidebar flex w-[260px] shrink-0 flex-col overflow-hidden',
      INBOX_SIDEBAR_SURFACE_CLASS,
      NESTED_PANEL_FLOATING_LG_CLASS,
      'max-lg:border-r max-lg:border-neutral-200 dark:max-lg:border-neutral-800',
      hiddenOnMobile ? 'max-lg:hidden' : '',
    ]"
    :aria-label="t('inbox.inboxSurfaceMailFoldersAndMailboxes')"
  >
    <!-- Mailbox switcher + compose -->
    <div class="shrink-0 space-y-1.5 px-2.5 pb-2 pt-2.5">
      <p
        v-if="!mailboxItems.length"
        class="rounded-lg border border-dashed border-[#E0E0DE] bg-white/60 px-3 py-2.5 text-xs leading-relaxed text-[#9B9A97] dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-500"
      >
        {{ t('inbox.inboxSurfaceNoMailboxesYetAddOneBelow') }}
      </p>
      <div v-if="mailboxItems.length" class="flex h-9 items-center gap-0.5">
        <Listbox
          v-slot="{ open }"
          as="div"
          :model-value="selectedMailboxId ?? ''"
          class="h-full min-w-0 flex-1"
          @update:model-value="onMailboxSelect"
        >
          <span v-show="false" aria-hidden="true">{{ syncMailboxMenuOpen(open) }}</span>
          <div class="relative h-full">
            <ListboxButton
              ref="mailboxButtonRef"
              class="group flex h-full w-full items-center gap-2 rounded-lg px-1.5 text-left transition hover:bg-black/[0.04] dark:hover:bg-white/5"
              :aria-label="t('inbox.inboxSidebarMailboxSwitcher')"
              @click="syncMailboxMenuPosition"
            >
              <MailboxAvatar
                :mailbox="displayMailbox"
                :all-mail="!selectedMailboxId"
                size="sm"
                :show-status="Boolean(selectedMailboxId && selectedMailboxItem)"
                :status-kind="mailboxStatusKind(selectedMailboxItem)"
              />
              <span class="min-w-0 flex-1">
                <span class="flex items-center gap-1.5">
                  <span class="min-w-0 truncate text-[13px] font-medium leading-tight text-[#37352F] dark:text-gray-100">
                    {{ displayMailboxTitle }}
                  </span>
                  <span
                    v-if="selectedMailboxItem && selectedMailboxItem.unreadCount > 0"
                    class="shrink-0 rounded-full bg-[#2383E2] px-1.5 py-px text-[10px] font-semibold tabular-nums text-white"
                  >
                    {{ formatCount(selectedMailboxItem.unreadCount) }}
                  </span>
                </span>
                <span class="mt-0.5 block truncate text-[11px] leading-tight text-[#9B9A97] dark:text-gray-500">
                  {{ displayMailboxSubtitle }}
                </span>
              </span>
              <ChevronUpDownIcon
                class="h-3.5 w-3.5 shrink-0 text-[#C4C4C0] transition group-hover:text-[#9B9A97] dark:text-gray-600 dark:group-hover:text-gray-400"
                aria-hidden="true"
              />
            </ListboxButton>

            <Transition
              leave-active-class="transition duration-100 ease-in"
              leave-from-class="opacity-100"
              leave-to-class="opacity-0"
            >
              <Teleport to="body">
                <ListboxOptions
                  v-if="open"
                  :style="mailboxMenuStyle"
                  class="fixed z-[10050] max-h-80 overflow-auto rounded-xl border border-[#EBEBEB] bg-white py-1.5 shadow-xl ring-1 ring-black/5 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:ring-white/10"
                  @vue:before-mount="syncMailboxMenuPosition"
                >
                  <ListboxOption :value="''" v-slot="{ active, selected }">
                    <li
                      class="relative mx-1.5 flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2"
                      :class="mailboxOptionClass(active, selected)"
                    >
                      <MailboxAvatar :all-mail="true" size="sm" />
                      <span class="min-w-0 flex-1">
                        <span class="block truncate text-[13px] font-medium text-[#37352F] dark:text-gray-100">
                          {{ t('inbox.inboxSurfaceAllMail') }}
                        </span>
                        <span class="block truncate text-[11px] text-[#9B9A97] dark:text-gray-500">
                          {{ t('inbox.inboxSidebarMailboxCount', { count: mailboxItems.length }) }}
                        </span>
                      </span>
                      <CheckIcon
                        v-if="selected"
                        class="h-4 w-4 shrink-0 text-[#2383E2] dark:text-blue-400"
                        aria-hidden="true"
                      />
                    </li>
                  </ListboxOption>

                  <template v-for="(group, groupIndex) in mailboxOptionGroups" :key="group.label">
                    <div
                      class="mx-3 mb-1 mt-2 px-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#9B9A97] dark:text-gray-500"
                      :class="groupIndex === 0 && 'mt-2.5 border-t border-[#F0F0EE] pt-2.5 dark:border-gray-800'"
                      role="presentation"
                    >
                      {{ group.label }}
                    </div>
                    <ListboxOption
                      v-for="mb in group.items"
                      :key="mb.id"
                      :value="mb.id"
                      v-slot="{ active, selected }"
                    >
                      <li
                        class="relative mx-1.5 flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2"
                        :class="mailboxOptionClass(active, selected)"
                      >
                        <MailboxAvatar
                          :mailbox="mb"
                          size="sm"
                          :show-status="true"
                          :status-kind="mailboxStatusKind(mb)"
                        />
                        <span class="min-w-0 flex-1">
                          <span class="flex items-center gap-1.5">
                            <span class="min-w-0 truncate text-[13px] font-medium text-[#37352F] dark:text-gray-100">
                              {{ mb.label }}
                            </span>
                            <span
                              v-if="mb.unreadCount > 0"
                              class="shrink-0 rounded-full bg-[#2383E2] px-1.5 py-px text-[10px] font-semibold tabular-nums text-white"
                            >
                              {{ formatCount(mb.unreadCount) }}
                            </span>
                          </span>
                          <span
                            v-if="mb.emailAddress"
                            class="block truncate text-[11px] text-[#9B9A97] dark:text-gray-500"
                          >
                            {{ mb.emailAddress }}
                          </span>
                          <span
                            v-else-if="mb.syncStatusLabel"
                            class="block truncate text-[11px] capitalize text-[#9B9A97] dark:text-gray-500"
                          >
                            {{ mb.syncStatusLabel }}
                          </span>
                        </span>
                        <CheckIcon
                          v-if="selected"
                          class="h-4 w-4 shrink-0 text-[#2383E2] dark:text-blue-400"
                          aria-hidden="true"
                        />
                      </li>
                    </ListboxOption>
                  </template>
                </ListboxOptions>
              </Teleport>
            </Transition>
          </div>
        </Listbox>

        <Menu v-if="mailboxMenuActions.length" as="div" class="relative h-9 shrink-0">
          <MenuButton
            class="flex h-9 w-8 items-center justify-center rounded-lg text-[#9B9A97] transition hover:bg-black/[0.04] hover:text-[#37352F] dark:text-gray-500 dark:hover:bg-white/5 dark:hover:text-gray-200"
            :aria-label="t('inbox.inboxSidebarMailboxActions')"
          >
            <EllipsisHorizontalIcon class="h-5 w-5" aria-hidden="true" />
          </MenuButton>
          <Transition
            enter-active-class="transition duration-100 ease-out"
            enter-from-class="scale-95 opacity-0"
            enter-to-class="scale-100 opacity-100"
            leave-active-class="transition duration-75 ease-in"
            leave-from-class="scale-100 opacity-100"
            leave-to-class="scale-95 opacity-0"
          >
            <MenuItems
              class="absolute right-0 z-[10050] mt-1 w-52 origin-top-right rounded-xl border border-[#EBEBEB] bg-white py-1 shadow-xl ring-1 ring-black/5 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:ring-white/10"
            >
              <MenuItem
                v-for="action in mailboxMenuActions"
                :key="action.id"
                v-slot="{ active }"
              >
                <button
                  type="button"
                  class="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition"
                  :class="[
                    action.destructive
                      ? active
                        ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                        : 'text-red-600 dark:text-red-400'
                      : active
                        ? 'bg-black/[0.04] text-[#37352F] dark:bg-white/5 dark:text-gray-100'
                        : 'text-[#37352F] dark:text-gray-200'
                  ]"
                  :disabled="action.destructive && mailboxActionLoading"
                  @click="action.onClick"
                >
                  <component :is="action.icon" class="h-4 w-4 shrink-0" aria-hidden="true" />
                  {{ action.label }}
                </button>
              </MenuItem>
            </MenuItems>
          </Transition>
        </Menu>
      </div>

      <button
        type="button"
        class="group flex h-9 w-full items-center gap-2 rounded-lg bg-primary-600 px-3 text-[13px] font-semibold text-white shadow-sm transition hover:bg-primary-500 hover:shadow focus:outline-2 focus:-outline-offset-2 focus:outline-primary-600 active:scale-[0.98] dark:bg-primary-500 dark:hover:bg-primary-600 dark:focus:outline-primary-500"
        :aria-label="t('inbox.inboxSurfaceComposeWorkspaceEmail')"
        aria-keyshortcuts="c"
        :title="t('inbox.inboxSidebarComposeShortcutTitle')"
        @click="emit('compose')"
      >
        <PlusIcon class="h-4 w-4 shrink-0 opacity-95" aria-hidden="true" />
        <span class="min-w-0 flex-1 truncate text-left">{{ t('inbox.inboxSidebarCompose') }}</span>
        <kbd
          class="hidden rounded border border-white/25 bg-white/10 px-1.5 py-px font-sans text-[10px] font-medium leading-4 text-white/90 sm:inline"
          aria-hidden="true"
        >C</kbd>
      </button>
    </div>

    <!-- Search -->
    <div class="shrink-0 px-2.5 pb-2">
      <div class="relative">
        <MagnifyingGlassIcon
          class="pointer-events-none absolute left-2.5 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-gray-400 dark:text-gray-500"
          aria-hidden="true"
        />
        <input
          :value="searchQuery"
          type="text"
          class="block h-8 w-full rounded-lg border border-gray-200 bg-white pl-8 text-sm text-gray-900 outline-1 -outline-offset-1 outline-gray-300/20 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:outline-white/10 dark:placeholder:text-gray-500 dark:focus:bg-gray-800 dark:focus:outline-indigo-500"
          :class="searchQuery ? 'pr-9' : 'pr-3'"
          :placeholder="t('inbox.inboxSidebarSearchMail')"
          autocomplete="off"
          :aria-label="t('inbox.inboxSurfaceSearchMail')"
          @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
        />
        <button
          v-if="searchQuery"
          type="button"
          class="absolute inset-y-0 right-2 flex items-center justify-center rounded-sm p-1 text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          :aria-label="t('inbox.inboxSidebarClearSearch')"
          @click="clearSearch"
        >
          <XMarkIcon class="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>

    <nav
      class="arivu-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto px-2.5"
      :aria-label="t('inbox.inboxSurfaceMailNavigation')"
    >
      <div class="flex flex-col gap-0.5">
        <!-- Gmail categories -->
        <template v-if="viewItems.length">
          <p class="px-1.5 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-[#9B9A97] dark:text-gray-500">
            {{ t('inbox.inboxSidebarCategories') }}
          </p>
          <button
            v-for="item in viewItems"
            :key="item.id"
            type="button"
            class="flex h-9 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[13px] transition"
            :class="navItemClass(item.active)"
            @click="emit('select-view', item.id)"
          >
            <component :is="item.icon" class="h-4 w-4 shrink-0" :class="item.iconClass || navIconClass(item.active)" aria-hidden="true" />
            <span class="min-w-0 flex-1 truncate">{{ item.label }}</span>
            <span
              v-if="item.count != null && item.count > 0"
              class="shrink-0 rounded-full px-1.5 py-px text-[10px] font-semibold tabular-nums"
              :class="countBadgeClass(item)"
            >
              {{ formatCount(item.count) }}
            </span>
          </button>
        </template>

        <!-- Folders -->
        <p
          v-if="showFoldersSectionLabel"
          class="px-1.5 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-[#9B9A97] dark:text-gray-500"
          :class="viewItems.length ? 'mt-1' : undefined"
        >
          {{ t('inbox.inboxSidebarFolders') }}
        </p>
        <button
          v-for="item in mailItems"
          :key="item.id"
          type="button"
          class="flex h-9 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[13px] transition"
          :class="navItemClass(item.active)"
          @click="emit('select-mail', item.id)"
        >
          <component :is="item.icon" class="h-4 w-4 shrink-0" :class="item.iconClass || navIconClass(item.active)" aria-hidden="true" />
          <span class="min-w-0 flex-1 truncate">{{ item.label }}</span>
          <span
            v-if="item.count != null && item.count > 0"
            class="shrink-0 rounded-full px-1.5 py-px text-[10px] font-semibold tabular-nums"
            :class="countBadgeClass(item)"
          >
            {{ formatCount(item.count) }}
          </span>
        </button>

        <!-- Gmail custom labels -->
        <template v-if="gmailFolderItems.length">
          <p class="mt-1 px-1.5 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-[#9B9A97] dark:text-gray-500">
            {{ t('inbox.inboxSurfaceGmailFolders') }}
          </p>
          <button
            v-for="folder in gmailFolderItems"
            :key="folder.id"
            type="button"
            class="flex h-9 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[13px] transition"
            :class="navItemClass(folder.active)"
            @click="emit('select-gmail-folder', folder.id)"
          >
            <FolderIcon class="h-4 w-4 shrink-0" :class="navIconClass(folder.active)" aria-hidden="true" />
            <span class="min-w-0 flex-1 truncate">{{ folder.label }}</span>
          </button>
        </template>
      </div>

      <!-- Footer utilities — pinned to nav bottom, same gutter -->
      <div class="mt-auto shrink-0 border-t border-neutral-200 pt-2 pb-2.5 dark:border-neutral-800">
        <div
          v-if="mailboxFlags.canCreatePersonal || mailboxFlags.canCreateGroup"
          class="mb-1 flex flex-col gap-0.5"
        >
          <button
            v-if="mailboxFlags.canCreatePersonal"
            type="button"
            class="flex h-9 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[13px] font-medium text-[#5447FF] transition hover:bg-[rgba(84,71,255,0.08)] disabled:opacity-50 dark:text-indigo-300 dark:hover:bg-[rgba(84,71,255,0.15)]"
            :disabled="mailboxActionLoading"
            @click="emit('create-personal-mailbox')"
          >
            <PlusIcon class="h-4 w-4 shrink-0" aria-hidden="true" />
            {{ t('inbox.mailboxSidebarAddPersonal') }}
          </button>
          <button
            v-if="mailboxFlags.canCreateGroup"
            type="button"
            class="flex h-9 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[13px] font-medium text-[#5447FF] transition hover:bg-[rgba(84,71,255,0.08)] disabled:opacity-50 dark:text-indigo-300 dark:hover:bg-[rgba(84,71,255,0.15)]"
            :disabled="mailboxActionLoading"
            @click="emit('setup-group-mailbox')"
          >
            <UserGroupIcon class="h-4 w-4 shrink-0" aria-hidden="true" />
            {{ t('inbox.mailboxSidebarAddGroup') }}
          </button>
        </div>
        <RouterLink
          :to="{ path: '/settings', query: { tab: 'integrations' } }"
          class="flex h-9 w-full items-center gap-2.5 rounded-lg px-2 text-[13px] text-[#787774] transition hover:bg-black/[0.04] hover:text-[#37352F] dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200"
        >
          <Cog6ToothIcon class="h-4 w-4 shrink-0" aria-hidden="true" />
          {{ t('inbox.inboxSidebarEmailSettings') }}
        </RouterLink>
      </div>
    </nav>
  </aside>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';
import { Listbox, ListboxButton, ListboxOption, ListboxOptions, Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue';
import {
  BoltIcon,
  CheckIcon,
  ChevronUpDownIcon,
  Cog6ToothIcon,
  EllipsisHorizontalIcon,
  FolderIcon,
  InboxIcon,
  InformationCircleIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  TrashIcon,
  UserGroupIcon,
  UsersIcon,
  XMarkIcon
} from '@heroicons/vue/24/outline';
import AvatarInitials from '@/components/ui/AvatarInitials.vue';
import { INBOX_SIDEBAR_SURFACE_CLASS, NESTED_PANEL_FLOATING_LG_CLASS } from '@/utils/sidebarLayout';

export interface SidebarNavItem {
  id: string;
  label: string;
  active: boolean;
  count?: number | null;
  icon: object;
  iconClass?: string;
  badgeVariant?: 'unread' | 'neutral';
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

type MailboxStatusKind = 'connected' | 'pending' | 'needs-setup' | 'off';

interface MailboxMenuAction {
  id: string;
  label: string;
  icon: object;
  destructive?: boolean;
  onClick: () => void;
}

const MailboxAvatar = defineComponent({
  name: 'MailboxAvatar',
  props: {
    mailbox: { type: Object as () => SidebarMailboxItem | null, default: null },
    allMail: { type: Boolean, default: false },
    size: { type: String as () => 'sm' | 'md', default: 'md' },
    showStatus: { type: Boolean, default: false },
    statusKind: { type: String as () => MailboxStatusKind, default: 'off' }
  },
  setup(props) {
    const sizeClass = computed(() => (props.size === 'sm' ? 'h-8 w-8' : 'h-9 w-9'));
    const iconClass = computed(() => (props.size === 'sm' ? 'h-4 w-4' : 'h-4 w-4'));
    const avatarSize = computed(() => 'sm' as const);
    const statusClass = computed(() => {
      if (props.statusKind === 'connected') return 'bg-emerald-500 ring-white dark:ring-gray-900';
      if (props.statusKind === 'pending') return 'bg-amber-400 ring-white dark:ring-gray-900';
      if (props.statusKind === 'needs-setup') return 'bg-orange-500 ring-white dark:ring-gray-900';
      return 'bg-[#C4C4C0] ring-white dark:bg-gray-600 dark:ring-gray-900';
    });

    return () => {
      if (props.allMail) {
        return h('div', { class: 'relative shrink-0' }, [
          h(
            'div',
            {
              class: [
                'flex items-center justify-center rounded-full bg-[#E8F2FC] text-[#2383E2] dark:bg-blue-950/50 dark:text-blue-300',
                sizeClass.value
              ]
            },
            [h(InboxIcon, { class: iconClass.value, 'aria-hidden': 'true' })]
          )
        ]);
      }

      const mb = props.mailbox;
      if (!mb) return null;

      const avatarNode = mb.kind === 'group'
        ? h(
            'div',
            {
              class: [
                'flex items-center justify-center rounded-full bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300',
                sizeClass.value
              ]
            },
            [h(UsersIcon, { class: iconClass.value, 'aria-hidden': 'true' })]
          )
        : h(AvatarInitials, {
            username: mb.label,
            email: mb.emailAddress || '',
            size: avatarSize.value
          });

      const wrappedAvatar = props.size === 'md' && mb.kind !== 'group'
        ? h('div', { class: 'flex h-9 w-9 items-center justify-center' }, [avatarNode])
        : avatarNode;

      if (!props.showStatus) {
        return h('div', { class: 'relative shrink-0' }, [wrappedAvatar]);
      }

      return h('div', { class: 'relative shrink-0' }, [
        wrappedAvatar,
        h('span', {
          class: [
            'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2',
            statusClass.value
          ],
          'aria-hidden': 'true'
        })
      ]);
    };
  }
});

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

const mailboxButtonRef = ref<{ $el?: HTMLElement } | HTMLElement | null>(null);
const mailboxMenuStyle = ref<Record<string, string>>({});
const mailboxMenuOpen = ref(false);
let viewportListenersBound = false;

const showFoldersSectionLabel = computed(
  () => props.viewItems.length > 0 || props.gmailFolderItems.length > 0
);

const mailboxMenuActions = computed((): MailboxMenuAction[] => {
  const mb = selectedMailboxItem.value;
  if (!mb) return [];

  const actions: MailboxMenuAction[] = [
    {
      id: 'info',
      label: t('inbox.mailboxDetailsView'),
      icon: InformationCircleIcon,
      onClick: () => emit('view-mailbox', mb.id)
    }
  ];

  if (mb.showConnect) {
    actions.push({
      id: 'connect',
      label: t('inbox.inboxSurfaceConnect'),
      icon: BoltIcon,
      onClick: () => emit('connect-mailbox', mb.id)
    });
  }

  if (mb.showMembers) {
    actions.push({
      id: 'members',
      label: t('settings.groupsLabelMembers'),
      icon: UsersIcon,
      onClick: () => emit('manage-members', mb.id)
    });
  }

  if (props.mailboxFlags.canDeletePersonal && mb.kind === 'personal') {
    actions.push({
      id: 'remove',
      label: t('inbox.mailboxDetailsRemovePersonal'),
      icon: TrashIcon,
      destructive: true,
      onClick: () => emit('delete-personal-mailbox')
    });
  }

  return actions;
});

function getMailboxButtonElement() {
  const raw = mailboxButtonRef.value;
  if (!raw) return null;
  return ('$el' in raw ? raw.$el : raw) as HTMLElement | null;
}

function syncMailboxMenuPosition() {
  const el = getMailboxButtonElement();
  if (!el?.getBoundingClientRect) return;
  const rect = el.getBoundingClientRect();
  mailboxMenuStyle.value = {
    top: `${rect.bottom + 6}px`,
    left: `${rect.left}px`,
    width: `${Math.max(rect.width, 280)}px`
  };
}

function syncMailboxMenuOpen(open: boolean) {
  mailboxMenuOpen.value = open;
  if (open) syncMailboxMenuPosition();
  return '';
}

function onViewportChange() {
  if (mailboxMenuOpen.value) syncMailboxMenuPosition();
}

function bindViewportListeners() {
  if (viewportListenersBound) return;
  viewportListenersBound = true;
  window.addEventListener('scroll', onViewportChange, true);
  window.addEventListener('resize', onViewportChange);
}

function unbindViewportListeners() {
  if (!viewportListenersBound) return;
  viewportListenersBound = false;
  window.removeEventListener('scroll', onViewportChange, true);
  window.removeEventListener('resize', onViewportChange);
}

watch(mailboxMenuOpen, (open) => {
  if (open) {
    bindViewportListeners();
    syncMailboxMenuPosition();
  } else {
    unbindViewportListeners();
  }
});

onBeforeUnmount(() => {
  unbindViewportListeners();
});

const selectedMailboxItem = computed(() => {
  const id = props.selectedMailboxId;
  if (!id) return null;
  return props.mailboxItems.find((mb) => String(mb.id) === String(id)) || null;
});

const displayMailbox = computed(() => selectedMailboxItem.value);

const displayMailboxTitle = computed(() => {
  if (!props.selectedMailboxId) return t('inbox.inboxSurfaceAllMail');
  return selectedMailboxItem.value?.label || t('inbox.inboxSidebarSelectMailbox');
});

const displayMailboxSubtitle = computed(() => {
  if (!props.selectedMailboxId) {
    return t('inbox.inboxSidebarMailboxCount', { count: props.mailboxItems.length });
  }
  const mb = selectedMailboxItem.value;
  if (!mb) return '';
  if (mb.emailAddress) return mb.emailAddress;
  if (mb.showConnect) return t('inbox.inboxSurfaceConnect');
  if (mb.syncStatusLabel) return mb.syncStatusLabel;
  return mb.kind === 'group' ? t('inbox.mailboxDetailsShared') : t('inbox.mailboxDetailsPersonal');
});

const mailboxOptionGroups = computed(() => {
  const personal = props.mailboxItems.filter((mb) => mb.kind === 'personal');
  const group = props.mailboxItems.filter((mb) => mb.kind === 'group');
  const groups = [];
  if (personal.length) {
    groups.push({ label: t('inbox.mailboxDetailsPersonal'), items: personal });
  }
  if (group.length) {
    groups.push({ label: t('inbox.mailboxDetailsShared'), items: group });
  }
  return groups;
});

function mailboxStatusKind(mb: SidebarMailboxItem | null | undefined): MailboxStatusKind {
  if (!mb) return 'off';
  if (mb.showConnect) return 'needs-setup';
  const status = String(mb.syncStatusLabel || '').toLowerCase();
  if (status.includes('on') || status.includes('connected')) return 'connected';
  if (status.includes('pending')) return 'pending';
  if (status.includes('off') || status.includes('not')) return 'off';
  return 'off';
}

function mailboxOptionClass(active: boolean, selected: boolean) {
  if (selected) {
    return 'bg-[#E8F2FC]/70 dark:bg-blue-950/30';
  }
  if (active) {
    return 'bg-black/[0.04] dark:bg-white/5';
  }
  return 'hover:bg-black/[0.03] dark:hover:bg-white/5';
}

function onMailboxSelect(value: string | number | null) {
  emit('select-mailbox', value === '' || value == null ? null : String(value));
}

function clearSearch() {
  emit('update:searchQuery', '');
}

function navItemClass(active: boolean) {
  return active
    ? 'bg-[rgba(84,71,255,0.1)] font-semibold text-[#432DD6] dark:bg-[rgba(84,71,255,0.2)] dark:text-purple-300'
    : 'font-medium text-neutral-800 hover:bg-neutral-200/60 dark:text-neutral-200 dark:hover:bg-neutral-800';
}

function navIconClass(active: boolean) {
  return active
    ? 'text-[#5447FF] dark:text-indigo-300'
    : 'text-[#787774] dark:text-gray-400';
}

function countBadgeClass(item: SidebarNavItem) {
  if (item.badgeVariant === 'unread' || item.id === 'unread') {
    return 'bg-[#2383E2] text-white dark:bg-blue-600';
  }
  return 'bg-black/[0.06] text-[#787774] dark:bg-white/10 dark:text-gray-400';
}

function formatCount(n: number) {
  if (n > 99) return '99+';
  return String(n);
}
</script>
