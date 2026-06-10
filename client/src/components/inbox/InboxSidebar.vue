<template>
  <aside
    class="inbox-sidebar flex w-[260px] shrink-0 flex-col overflow-hidden border-r border-[#EBEBEB] bg-[#F7F7F5] dark:border-gray-800 dark:bg-[#1a1a1a]"
    :class="hiddenOnMobile ? 'max-lg:hidden' : ''"
    :aria-label="t('inbox.inboxSurfaceMailFoldersAndMailboxes')"
  >
    <!-- Mailbox switcher + compose -->
    <div class="shrink-0 px-3 pb-2 pt-3">
      <p
        v-if="!mailboxItems.length"
        class="rounded-lg border border-dashed border-[#E0E0DE] bg-white/60 px-3 py-3 text-xs leading-relaxed text-[#9B9A97] dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-500"
      >
        {{ t('inbox.inboxSurfaceNoMailboxesYetAddOneBelow') }}
      </p>
      <template v-else>
        <div class="flex items-stretch gap-1.5">
          <Listbox
            v-slot="{ open }"
            as="div"
            :model-value="selectedMailboxId ?? ''"
            class="min-w-0 flex-1"
            @update:model-value="onMailboxSelect"
          >
            <span v-show="false" aria-hidden="true">{{ syncMailboxMenuOpen(open) }}</span>
            <div class="relative">
              <ListboxButton
                ref="mailboxButtonRef"
                class="group flex w-full items-center gap-2.5 rounded-lg border border-[#E8E8E6] bg-white px-2.5 py-2 text-left shadow-sm transition hover:border-[#D3D3D0] hover:shadow dark:border-gray-700 dark:bg-gray-900 dark:hover:border-gray-600"
                :aria-label="t('inbox.inboxSidebarMailboxSwitcher')"
                @click="syncMailboxMenuPosition"
              >
                <MailboxAvatar
                  :mailbox="displayMailbox"
                  :all-mail="!selectedMailboxId"
                  size="md"
                  :show-status="Boolean(selectedMailboxId && selectedMailboxItem)"
                  :status-kind="mailboxStatusKind(selectedMailboxItem)"
                />
                <span class="min-w-0 flex-1">
                  <span class="flex items-center gap-1.5">
                    <span class="min-w-0 truncate text-[13px] font-semibold leading-tight text-[#37352F] dark:text-gray-100">
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
                  class="h-4 w-4 shrink-0 text-[#9B9A97] transition group-hover:text-[#787774] dark:text-gray-500 dark:group-hover:text-gray-300"
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

          <button
            type="button"
            class="flex shrink-0 items-center justify-center self-center rounded-lg border border-[#E8E8E6] bg-white p-2 text-[#787774] shadow-sm transition hover:border-[#D3D3D0] hover:bg-[#FAFAF8] hover:text-[#37352F] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            :title="t('inbox.inboxSurfaceComposeWorkspaceEmail')"
            @click="emit('compose')"
          >
            <PencilSquareIcon class="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
        </div>

        <div
          v-if="selectedMailboxItem"
          class="mt-2 flex flex-wrap items-center gap-1"
        >
          <button
            type="button"
            class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-[#787774] transition hover:bg-black/[0.05] hover:text-[#37352F] dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-200"
            :title="t('inbox.mailboxDetailsView')"
            @click="emit('view-mailbox', selectedMailboxItem.id)"
          >
            <InformationCircleIcon class="h-3.5 w-3.5" aria-hidden="true" />
            {{ t('inbox.mailboxDetailsViewShort') }}
          </button>
          <button
            v-if="selectedMailboxItem.showConnect"
            type="button"
            class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
            @click="emit('connect-mailbox', selectedMailboxItem.id)"
          >
            <BoltIcon class="h-3.5 w-3.5" aria-hidden="true" />
            {{ t('inbox.inboxSurfaceConnect') }}
          </button>
          <button
            v-if="selectedMailboxItem.showMembers"
            type="button"
            class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-violet-700 transition hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-950/40"
            @click="emit('manage-members', selectedMailboxItem.id)"
          >
            <UsersIcon class="h-3.5 w-3.5" aria-hidden="true" />
            {{ t('settings.groupsLabelMembers') }}
          </button>
        </div>
      </template>
    </div>

    <!-- Search -->
    <div class="shrink-0 px-3 pb-2">
      <div class="relative">
        <MagnifyingGlassIcon
          class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9B9A97] dark:text-gray-500"
          aria-hidden="true"
        />
        <input
          :value="searchQuery"
          type="search"
          class="w-full rounded-lg border border-transparent bg-white py-2 pl-8 pr-3 text-[13px] text-[#37352F] shadow-sm placeholder:text-[#9B9A97] focus:border-[#2383E2]/30 focus:outline-none focus:ring-2 focus:ring-[#2383E2]/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-blue-500/40 dark:focus:ring-blue-500/20"
          :placeholder="t('inbox.inboxSidebarSearchPlaceholder')"
          autocomplete="off"
          :aria-label="t('inbox.inboxSurfaceSearchMail')"
          @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
        />
      </div>
    </div>

    <nav
      class="arivu-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-2"
      :aria-label="t('inbox.inboxSurfaceMailNavigation')"
    >
      <!-- Views -->
      <div v-if="viewItems.length" class="mb-2">
        <p class="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#9B9A97] dark:text-gray-500">
          {{ t('inbox.inboxSidebarViews') }}
        </p>
        <button
          v-for="item in viewItems"
          :key="item.id"
          type="button"
          class="group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition"
          :class="navItemClass(item.active)"
          @click="emit('select-view', item.id)"
        >
          <span
            v-if="item.active"
            class="absolute bottom-1.5 left-0 top-1.5 w-0.5 rounded-full bg-[#2383E2] dark:bg-blue-400"
            aria-hidden="true"
          />
          <component :is="item.icon" class="h-4 w-4 shrink-0" :class="item.iconClass" aria-hidden="true" />
          <span class="min-w-0 flex-1 truncate">{{ item.label }}</span>
          <span
            v-if="item.count != null && item.count > 0"
            class="shrink-0 rounded-full bg-black/[0.06] px-1.5 py-px text-[10px] font-semibold tabular-nums text-[#787774] dark:bg-white/10 dark:text-gray-400"
          >
            {{ formatCount(item.count) }}
          </span>
        </button>
      </div>

      <!-- Mail folders -->
      <div class="mb-2">
        <p class="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#9B9A97] dark:text-gray-500">
          {{ t('inbox.inboxSurfaceMail') }}
        </p>
        <button
          v-for="item in mailItems"
          :key="item.id"
          type="button"
          class="group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition"
          :class="navItemClass(item.active)"
          @click="emit('select-mail', item.id)"
        >
          <span
            v-if="item.active"
            class="absolute bottom-1.5 left-0 top-1.5 w-0.5 rounded-full bg-[#2383E2] dark:bg-blue-400"
            aria-hidden="true"
          />
          <component :is="item.icon" class="h-4 w-4 shrink-0 text-[#787774] dark:text-gray-400" aria-hidden="true" />
          <span class="min-w-0 flex-1 truncate">{{ item.label }}</span>
          <span
            v-if="item.count != null && item.count > 0"
            class="shrink-0 rounded-full bg-[#2383E2] px-1.5 py-px text-[10px] font-semibold tabular-nums text-white"
          >
            {{ formatCount(item.count) }}
          </span>
        </button>
      </div>

      <!-- Gmail folders -->
      <div v-if="gmailFolderItems.length" class="mb-2 mt-1">
        <p class="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#9B9A97] dark:text-gray-500">
          {{ t('inbox.inboxSurfaceGmailFolders') }}
        </p>
        <button
          v-for="folder in gmailFolderItems"
          :key="folder.id"
          type="button"
          class="group relative flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition"
          :class="navItemClass(folder.active)"
          @click="emit('select-gmail-folder', folder.id)"
        >
          <span
            v-if="folder.active"
            class="absolute bottom-1.5 left-0 top-1.5 w-0.5 rounded-full bg-[#2383E2] dark:bg-blue-400"
            aria-hidden="true"
          />
          <FolderIcon class="h-4 w-4 shrink-0 text-[#787774] dark:text-gray-400" aria-hidden="true" />
          <span class="min-w-0 flex-1 truncate">{{ folder.label }}</span>
        </button>
      </div>
    </nav>

    <!-- Footer -->
    <div class="shrink-0 border-t border-[#EBEBEB] px-3 py-2.5 dark:border-gray-800">
      <div v-if="mailboxFlags.canCreatePersonal || mailboxFlags.canDeletePersonal || mailboxFlags.canCreateGroup" class="mb-2 flex flex-col gap-1">
        <button
          v-if="mailboxFlags.canCreatePersonal"
          type="button"
          class="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#E8E8E6] bg-white px-2.5 py-1.5 text-xs font-medium text-[#37352F] transition hover:bg-[#FAFAF8] disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
          :disabled="mailboxActionLoading"
          @click="emit('create-personal-mailbox')"
        >
          <PlusIcon class="h-3.5 w-3.5" aria-hidden="true" />
          {{ t('inbox.mailboxSidebarAddPersonal') }}
        </button>
        <button
          v-else-if="mailboxFlags.canDeletePersonal"
          type="button"
          class="flex w-full items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-950/30"
          :disabled="mailboxActionLoading"
          @click="emit('delete-personal-mailbox')"
        >
          <TrashIcon class="h-3.5 w-3.5" aria-hidden="true" />
          {{ t('inbox.mailboxDetailsRemovePersonal') }}
        </button>
        <button
          v-if="mailboxFlags.canCreateGroup"
          type="button"
          class="flex w-full items-center justify-center gap-1.5 rounded-lg border border-violet-200/80 bg-violet-50/80 px-2.5 py-1.5 text-xs font-medium text-violet-900 transition hover:bg-violet-100 disabled:opacity-50 dark:border-violet-800/60 dark:bg-violet-950/30 dark:text-violet-100 dark:hover:bg-violet-900/30"
          :disabled="mailboxActionLoading"
          @click="emit('setup-group-mailbox')"
        >
          <UserGroupIcon class="h-3.5 w-3.5" aria-hidden="true" />
          {{ t('inbox.mailboxSidebarAddGroup') }}
        </button>
      </div>
      <div class="flex flex-col gap-0.5">
        <RouterLink
          :to="{ path: '/settings', query: { tab: 'integrations' } }"
          class="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] text-[#787774] transition hover:bg-black/[0.04] hover:text-[#37352F] dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200"
        >
          <Cog6ToothIcon class="h-4 w-4 shrink-0" aria-hidden="true" />
          {{ t('inbox.inboxSidebarSettings') }}
        </RouterLink>
        <RouterLink
          :to="{ path: '/settings', query: { tab: 'integrations' } }"
          class="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] text-[#787774] transition hover:bg-black/[0.04] hover:text-[#37352F] dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200"
        >
          <ChatBubbleLeftRightIcon class="h-4 w-4 shrink-0" aria-hidden="true" />
          {{ t('inbox.inboxSidebarEmailSetup') }}
        </RouterLink>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/vue';
import {
  BoltIcon,
  ChatBubbleLeftRightIcon,
  CheckIcon,
  ChevronUpDownIcon,
  Cog6ToothIcon,
  FolderIcon,
  InboxIcon,
  InformationCircleIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  UserGroupIcon,
  UsersIcon
} from '@heroicons/vue/24/outline';
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

type MailboxStatusKind = 'connected' | 'pending' | 'needs-setup' | 'off';

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
let mailboxMenuWasOpen = false;
let viewportListenersBound = false;

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

function navItemClass(active: boolean) {
  return active
    ? 'bg-white font-medium text-[#37352F] shadow-sm dark:bg-gray-900 dark:text-white'
    : 'text-[#37352F] hover:bg-white/70 dark:text-gray-200 dark:hover:bg-gray-900/60';
}

function formatCount(n: number) {
  if (n > 99) return '99+';
  return String(n);
}
</script>
