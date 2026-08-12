<template>
  <div class="inbox-surface-root flex min-h-0 w-full min-w-0 max-w-none flex-1 flex-col overflow-hidden">
    <div
      v-if="mailboxesLoading"
      class="flex min-h-0 flex-1 items-center justify-center py-24"
    >
      <div class="h-9 w-9 animate-spin rounded-full border-2 border-gray-200 border-t-emerald-600 dark:border-gray-700 dark:border-t-emerald-400" />
    </div>

    <div
      v-else-if="showInboxGetStarted"
      class="arivu-scrollbar relative flex min-h-0 flex-1 flex-col overflow-hidden bg-white dark:bg-gray-950"
    >
      <InboxGetStarted
        :gmail-oauth-ready="gmailOAuthReady"
        :inbound-parser-mode="!mailboxFlags.gmailIntegrationEnabled"
        :connect-loading="gmailSyncLoading"
        @connect-mailbox="openConnectInboxModal"
        @setup-group="openConnectGroupMailbox"
      />
    </div>

    <div
      v-else
      class="inbox-workspace flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row lg:gap-2 lg:p-2"
    >
    <InboxSidebar
      :search-query="emailSearchInput"
      :view-items="inboxSidebarViewItems"
      :mail-items="inboxSidebarMailItems"
      :mailbox-items="inboxSidebarMailboxItems"
      :selected-mailbox-id="selectedMailboxFilter"
      :gmail-folder-items="inboxSidebarGmailFolderItems"
      :mailbox-flags="mailboxFlags"
      :mailbox-action-loading="mailboxActionLoading"
      @compose="openNewCompose"
      @update:search-query="onInboxSearchInput"
      @select-view="onSidebarSelectView"
      @select-mail="onSidebarSelectMail"
      @select-mailbox="selectMailboxFilter"
      @select-gmail-folder="selectGmailLabel"
      @view-mailbox="openMailboxDetails"
      @connect-mailbox="onSidebarConnectMailbox"
      @manage-members="onSidebarManageMembers"
      @create-personal-mailbox="openConnectInboxModal"
      @delete-personal-mailbox="deletePersonalMailbox"
      @setup-group-mailbox="openConnectGroupMailbox"
    />

    <!-- Thread list + optional reader panel (non-blocking, resizable) -->
    <div ref="readerSplitRef" class="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
      <InboxThreadList
        pane-class="flex h-full min-h-0 min-w-0 flex-1 flex-col"
        :title="inboxListTitle"
        :loading="emailLoading"
        :loading-more="emailLoadingMore"
        :error="emailError"
        :groups="inboxThreadListGroups"
        :filter-chips="inboxFilterChips"
        :selected-count="selectedThreadIds.length"
        :selected-thread-ids="selectedThreadIds"
        :all-visible-selected="allVisibleSelected"
        :some-visible-selected="someVisibleSelected"
        :has-more="Boolean(emailNextCursor)"
        :active-thread-id="openThreadRow ? String(openThreadRow.threadId) : null"
        @refresh="refreshInboxThreadsAndCounts"
        @filter-chip="onInboxFilterChip"
        @open-thread="openEmailThreadRecord"
        @row-archive="toggleRowDone"
        @row-delete="toggleRowDone"
        @row-toggle-read="markThreadRead"
        @toggle-row-select="toggleThreadSelected"
        @toggle-select-all="toggleSelectAllVisible"
        @bulk-done="bulkMarkDone"
        @clear-selection="clearThreadSelection"
        @load-more="loadMoreEmailThreads"
      >
        <template #banners>
          <div
            v-if="mailboxFlags.gmailIntegrationEnabled && selectedMailbox && selectedMailbox.gmailSmtpOutbound?.connected && !selectedMailbox.gmailInboxSync?.connected"
            class="border-b border-emerald-200 bg-emerald-50/90 px-3 py-2.5 text-xs text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/25 dark:text-emerald-100"
          >
            <div class="font-semibold text-emerald-900 dark:text-emerald-100">
              Gmail SMTP send — {{ selectedMailbox.kind === 'group' ? 'Shared' : 'Personal' }}
            </div>
            <p class="mt-1 text-[11px] leading-snug text-emerald-800/90 dark:text-emerald-200/90">
              {{ t('inbox.inboxSurfaceOutboundEmailUsesYourGoogleApp') }}
              <button
                type="button"
                class="font-medium underline hover:no-underline"
                @click="onGmailProviderClick"
              >
                {{ t('inbox.inboxSurfaceConnectGmail') }}
              </button>
              {{ t('inbox.inboxSurfaceToImportAndReadMailIn') }}
            </p>
          </div>
          <div
            v-if="!mailboxFlags.gmailIntegrationEnabled && selectedMailbox?.inboundParser?.routingAddress"
            class="border-b border-emerald-200 bg-emerald-50/90 px-4 py-3 text-xs text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/25 dark:text-emerald-100"
          >
            <div class="font-semibold">{{ t('inbox.mailboxDetailsForwardingAddress') }}</div>
            <p class="mt-1 font-mono text-[11px] break-all select-all">
              {{ selectedMailbox.inboundParser.routingAddress }}
            </p>
            <p v-if="selectedMailbox.inboundParser.forwardingHint" class="mt-1 leading-snug opacity-90">
              {{ selectedMailbox.inboundParser.forwardingHint }}
            </p>
          </div>
          <div
            v-else-if="selectedMailbox && mailboxNeedsConnect(selectedMailbox)"
            class="border-b border-blue-200 bg-blue-50/90 px-4 py-3 text-xs text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/25 dark:text-blue-100"
          >
            <div class="font-semibold">{{ selectedMailbox.label }}</div>
            <p class="mt-1 leading-snug">{{ t('inbox.mailboxDetailsConnectPrompt') }}</p>
            <button
              type="button"
              class="mt-2 rounded-md bg-emerald-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-emerald-700"
              @click="openMailboxForwardingSetup(selectedMailbox)"
            >
              {{ t('inbox.inboxSurfaceConnect') }}
            </button>
          </div>
        </template>
      </InboxThreadList>

      <div
        v-show="readerPanelMounted"
        class="inbox-reader-shell h-full shrink-0 overflow-hidden"
        :class="{
          'inbox-reader-shell--open': readerPanelExpanded,
          'inbox-reader-shell--no-transition': readerResizeActive
        }"
        :style="readerShellStyle"
        @transitionend="onReaderShellTransitionEnd"
      >
        <aside
          v-if="openThreadRow"
          class="inbox-reader-panel relative flex h-full min-w-0 flex-row border-l border-[#EBEBEB] bg-white shadow-[-6px_0_24px_-12px_rgba(0,0,0,0.12)] dark:border-gray-800 dark:bg-gray-950 dark:shadow-[-6px_0_24px_-12px_rgba(0,0,0,0.45)]"
          :style="readerPanelInnerStyle"
          :aria-label="openThreadRow.subject || t('inbox.inboxProSelectConversation')"
        >
          <div
            role="separator"
            aria-orientation="vertical"
            :aria-valuemin="READER_PANEL_MIN_PCT"
            :aria-valuemax="READER_PANEL_MAX_PCT"
            :aria-valuenow="Math.round(effectiveReaderPanelWidthPct)"
            :aria-label="t('inbox.inboxReaderResizePanel')"
            :title="t('inbox.inboxReaderResizePanelHint')"
            class="inbox-reader-resize-handle group absolute left-0 top-0 z-30 flex h-full w-5 -translate-x-1/2 touch-none select-none items-center justify-center"
            :class="{ 'inbox-reader-resize-handle--active': readerResizeActive }"
            @pointerdown.prevent="startReaderPanelResize"
            @dblclick.prevent="resetReaderPanelWidth"
          >
            <span class="inbox-reader-resize-line" aria-hidden="true" />
            <span class="inbox-reader-resize-grip" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </div>

          <div class="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <EmailThreadReader
              :key="String(openThreadRow.threadId)"
              :thread-id="String(openThreadRow.threadId)"
              :thread-row="openThreadRow"
              :record-path="openThreadRecordPath"
              :split-view="true"
              :show-close="true"
              :can-navigate-prev="canNavigateThreadPrev"
              :can-navigate-next="canNavigateThreadNext"
              :compose-standalone-mode="openThreadComposeStandalone"
              :compose-related-to="openThreadComposeRelatedTo"
              :compose-sending-mailbox="openThreadComposeSendingMailbox"
              :compose-sending-mailbox-hint="openThreadComposeSendingMailboxHint"
              :docked-reply-pulse="dockedReplyPulse"
              :docked-reply-close-pulse="dockedReplyClosePulse"
              :thread-reload-pulse="threadReloadPulse"
              :on-submit-compose="submitDockedCompose"
              class="h-full min-h-0"
              @close="closeThreadReader"
              @forward="openFloatingCompose($event.row)"
              @pop-out-compose="openFloatingCompose"
              @toggle-done="toggleRowDone($event)"
              @toggle-read="markThreadRead"
              @snooze="snoozeRowTomorrow($event)"
              @assign-to-me="assignRowToMe($event)"
              @open-record="onReaderOpenRecord($event)"
              @navigate-prev="navigateThreadPrev"
              @navigate-next="navigateThreadNext"
              @schedule-cancelled="refreshInboxThreadsAndCounts"
            />
          </div>

          <div
            class="inbox-context-rail shrink-0 border-l border-[#EBEBEB] bg-[#FAFAF8] dark:border-gray-800 dark:bg-gray-900"
            :class="{ 'inbox-context-rail--open': contextPanelOpen }"
            :style="{ '--inbox-context-rail-width': `${CONTEXT_PANEL_WIDTH_PX}px` }"
          >
            <button
              v-show="!contextPanelOpen"
              type="button"
              class="flex h-full w-8 flex-col items-center justify-center gap-1 text-[#787774] hover:bg-[#F1F1EF] hover:text-[#37352F] dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              :title="t('inbox.inboxContextPanelExpand')"
              :aria-label="t('inbox.inboxContextPanelExpand')"
              @click="contextPanelOpen = true"
            >
              <ChevronLeftIcon class="h-4 w-4" aria-hidden="true" />
              <span class="text-[10px] font-medium uppercase tracking-wide [writing-mode:vertical-rl]">
                {{ t('inbox.inboxContextPanelTitle') }}
              </span>
            </button>

            <div
              v-show="contextPanelOpen"
              class="inbox-context-rail-panel h-full w-full min-w-0"
            >
              <InboxContextPanel
                :thread-row="openThreadRow"
                :record-path="openThreadRecordPath"
                embedded
                class="h-full"
                @close="contextPanelOpen = false"
                @open-record="onReaderOpenRecord(openThreadRow)"
                @reply="requestDockedReply"
                @suggest-reply="requestDockedReply"
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
    </div>

    <!-- Workspace mail preview (no record deep link) -->
    <div
      v-if="workspacePreviewThread"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="workspace-mail-title"
      @click.self="closeWorkspacePreview"
    >
      <div class="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
        <div class="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <h3 id="workspace-mail-title" class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('inbox.inboxSurfaceWorkspaceMail') }}</h3>
          <button
            type="button"
            class="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            :aria-label="t('settings.roleDrawerCloseSr')"
            @click="closeWorkspacePreview"
          >
            ×
          </button>
        </div>
        <div class="space-y-3 px-4 py-4 text-sm text-gray-700 dark:text-gray-300">
          <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('inbox.inboxSurfaceThisThreadIsTiedToYour') }}</p>
          <div>
            <span class="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">{{ t('inbox.inboxSurfaceSubject') }}</span>
            <p class="mt-0.5 font-medium text-gray-900 dark:text-white">{{ workspacePreviewThread.subject || '(no subject)' }}</p>
          </div>
          <div>
            <span class="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">{{ t('inbox.inboxSurfaceParticipants') }}</span>
            <p class="mt-0.5">{{ workspacePreviewThread.participantDisplay }}</p>
          </div>
          <div v-if="workspacePreviewThread.tags?.length">
            <span class="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">{{ t('settings.assignRulesCondFieldTags') }}</span>
            <p class="mt-0.5">{{ workspacePreviewThread.tags.join(', ') }}</p>
          </div>
          <RouterLink
            :to="{ path: '/settings', query: { tab: 'integrations' } }"
            class="inline-block text-sm font-medium text-blue-700 hover:underline dark:text-blue-400"
            @click="closeWorkspacePreview"
          >
            Email &amp; communication policy →
          </RouterLink>
        </div>
      </div>
    </div>

    <!-- Group mailbox members (admins) -->
    <div
      v-if="membersModalMailbox"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="members-modal-title"
      @click.self="closeMembersModal"
    >
      <div class="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
        <div class="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <h3 id="members-modal-title" class="text-sm font-semibold text-gray-900 dark:text-white">
            Members — {{ membersModalMailbox.label }}
          </h3>
          <button
            type="button"
            class="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            :aria-label="t('settings.roleDrawerCloseSr')"
            @click="closeMembersModal"
          >
            ×
          </button>
        </div>
        <p class="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">{{ t('inbox.inboxSurfaceLeaveEveryoneUncheckedToAllow') }}<span class="font-medium">all</span>{{ t('inbox.inboxSurfaceOrgUsersToWorkThisInbox') }}</p>
        <div class="max-h-[50vh] overflow-y-auto px-4 pb-2">
          <div v-if="assignmentUsersLoading" class="py-8 text-center text-sm text-gray-500">{{ t('appointments.loadingUsers') }}</div>
          <ul v-else class="space-y-1">
            <li
              v-for="u in assignmentUsers"
              :key="u._id"
              class="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/80"
            >
              <input
                :id="'mbm-' + u._id"
                type="checkbox"
                class="rounded border-gray-300 text-violet-600 focus:ring-violet-500 dark:border-gray-600 dark:bg-gray-900"
                :checked="membersSelectedIds.includes(String(u._id))"
                @change="toggleMemberSelection(String(u._id), $event.target.checked)"
              >
              <label
                :for="'mbm-' + u._id"
                class="min-w-0 flex-1 cursor-pointer text-sm text-gray-900 dark:text-gray-100"
              >
                <span class="font-medium">{{ [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || u.email }}</span>
                <span v-if="u.email" class="block truncate text-xs text-gray-500 dark:text-gray-400">{{ u.email }}</span>
              </label>
            </li>
          </ul>
        </div>
        <div class="flex justify-end gap-2 border-t border-gray-100 px-4 py-3 dark:border-gray-800">
          <button
            type="button"
            class="rounded-lg px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            @click="closeMembersModal"
          >{{ t('performance.cancelWizard') }}</button>
          <button
            type="button"
            class="rounded-lg bg-violet-600 px-4 py-2 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            :disabled="membersSaveLoading"
            @click="saveMembersModal"
          >
            {{ membersSaveLoading ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </div>
    </div>

    <MailboxDetailsModal
      v-model="mailboxDetailsOpen"
      :mailbox="mailboxDetailsTarget"
      :sync-status-label="mailboxDetailsTarget ? formatMailboxSyncStatus(mailboxDetailsTarget) : ''"
      :gmail-integration-enabled="mailboxFlags.gmailIntegrationEnabled"
      :can-delete-personal="mailboxFlags.canDeletePersonal"
      :can-create-group="mailboxFlags.canCreateGroup"
      :action-loading="mailboxActionLoading"
      :show-connect-action="mailboxDetailsTarget ? mailboxNeedsConnect(mailboxDetailsTarget) : false"
      @connect="onMailboxDetailsConnect"
      @manage-members="onMailboxDetailsManageMembers"
      @delete="onMailboxDetailsDelete"
    />

    <GmailMailboxFolderModal
      v-model="gmailFolderModalOpen"
      :mailbox-id="gmailFolderModalMailboxId"
      @saved="onGmailFolderModalSaved"
    />

    <EmailComposeWindow
      :key="composeWindowKey"
      :is-open="composeDrawerOpen"
      :standalone-mode="composeStandaloneMode"
      :related-to="composeRelatedTo"
      :initial-draft="composeInitialDraftForDrawer"
      :sending-mailbox="composeSendingMailbox"
      :sending-mailbox-hint="composeSendingMailboxHint"
      @close="closeComposeDrawer"
      @submit="submitCompose"
    />

    <Teleport to="body">
      <div
        v-if="gmailServerSetupModalOpen"
        class="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gmail-setup-title"
        @click.self="gmailServerSetupModalOpen = false"
      >
        <div
          class="relative max-h-[min(88vh,640px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
          @click.stop
        >
          <div class="flex items-start justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <h2 id="gmail-setup-title" class="pr-8 text-lg font-semibold text-gray-900 dark:text-white">{{ t('inbox.inboxSurfaceEnableGmailOnThisApiServer') }}</h2>
            <button
              type="button"
              class="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              :aria-label="t('settings.roleDrawerCloseSr')"
              @click="gmailServerSetupModalOpen = false"
            >
              <XMarkIcon class="h-5 w-5" />
            </button>
          </div>
          <div class="space-y-4 px-5 py-4 text-sm text-gray-700 dark:text-gray-300">
            <p>
              Google requires a registered OAuth app. Arivu never puts the client secret in the browser—you add it
              <span class="font-medium">once</span>{{ t('inbox.inboxSurfaceToTheApiEnvironmentThenEveryone') }}<span class="font-medium">{{ t('inbox.inboxSurfaceConnectGmail') }}</span>{{ t('inbox.inboxSurfaceHere') }}</p>
            <ol class="list-decimal space-y-3 pl-5 text-sm">
              <li>
                In
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="font-medium text-emerald-700 underline hover:text-emerald-800 dark:text-emerald-400"
                >Google Cloud Console → Credentials</a>,
                create an <span class="font-medium">{{ t('inbox.inboxSurfaceOauth20ClientId') }}</span> (Web application). Copy the Client ID and Client secret.
              </li>
              <li>{{ t('inbox.inboxSurfaceUnder') }}<span class="font-medium">{{ t('inbox.inboxSurfaceAuthorizedRedirectUris') }}</span>, add this URL exactly (must match your API host and port):
                <div class="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 font-mono text-xs text-gray-900 dark:bg-gray-800 dark:text-gray-100">
                  <span class="min-w-0 flex-1 break-all">{{ gmailRedirectExample }}</span>
                  <button
                    type="button"
                    class="shrink-0 rounded bg-white px-2 py-1 text-[11px] font-medium text-gray-800 shadow ring-1 ring-gray-200 hover:bg-gray-50 dark:bg-gray-950 dark:text-gray-200 dark:ring-gray-600"
                    @click="copyGmailRedirectExample"
                  >{{ t('actions.copy') }}</button>
                </div>
              </li>
              <li>{{ t('inbox.inboxSurfaceOnTheMachineThatRunsThe') }}<code class="rounded bg-gray-200 px-1 font-mono text-xs dark:bg-gray-700">{{ t('inbox.inboxSurfaceServerEnv') }}</code>:
                <pre class="mt-2 overflow-x-auto rounded-lg bg-gray-900 p-3 text-[11px] leading-relaxed text-gray-100">{{ gmailEnvSnippet }}</pre>
              </li>
              <li>{{ t('inbox.inboxSurfaceRestartTheApiProcessReloadThis') }}</li>
            </ol>
            <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('inbox.inboxSurfaceWorkspaceOwnersCanInsteadSaveOverrides') }}<RouterLink
                :to="{ path: '/settings', query: { tab: 'integrations' } }"
                class="font-medium text-emerald-700 underline dark:text-emerald-400"
                @click="gmailServerSetupModalOpen = false"
              >Settings → Integrations → Email</RouterLink>
              (Advanced).
            </p>
          </div>
          <div class="flex justify-end border-t border-gray-100 px-5 py-4 dark:border-gray-800">
            <button
              type="button"
              class="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
              @click="gmailServerSetupModalOpen = false"
            >{{ t('inbox.inboxSurfaceDone') }}</button>
          </div>
        </div>
      </div>
    </Teleport>

    <ConnectInboxWizard
      v-model="connectInboxWizardOpen"
      :loading="gmailSyncLoading"
      :initial-email="connectWizardInitialEmail"
      @connect="onConnectInboxWizardSubmit"
    />
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

import { confirmAction } from '@/composables/useConfirmAction';
const { t } = useI18n();
import { ref, computed, watch, onMounted, onUnmounted, nextTick, markRaw } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import apiClient from '@/utils/apiClient';
import { getApiOrigin } from '@/config/apiBase';
import { useAuthStore } from '@/stores/authRegistry';
import { useNotifications } from '@/composables/useNotifications';
import {
  ChevronLeftIcon,
  ClockIcon,
  EnvelopeIcon,
  HashtagIcon,
  InboxIcon,
  PaperAirplaneIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon
} from '@heroicons/vue/24/outline';
import EmailComposeWindow from '@/components/communications/EmailComposeWindow.vue';
import ConnectInboxWizard from '@/components/inbox/ConnectInboxWizard.vue';
import InboxGetStarted from '@/components/inbox/InboxGetStarted.vue';
import GmailMailboxFolderModal from '@/components/inbox/GmailMailboxFolderModal.vue';
import EmailThreadReader from '@/components/inbox/EmailThreadReader.vue';
import InboxContextPanel from '@/components/inbox/InboxContextPanel.vue';
import InboxSidebar from '@/components/inbox/InboxSidebar.vue';
import InboxThreadList from '@/components/inbox/InboxThreadList.vue';
import MailboxDetailsModal from '@/components/inbox/MailboxDetailsModal.vue';
import { useConnectMailboxPrompt } from '@/composables/useConnectMailboxPrompt';
import { isMailboxConnectedForProvider } from '@/constants/inboxProviders';
import { isInboxShellUnblocked, formatMailboxInboundStatus } from '@/utils/mailboxInboundStatus';
import { createInboxStream } from '@/composables/useInboxStream';
import { shouldPromptGmailReconnect, gmailReconnectMessage } from '@/utils/gmailConnectErrors';
import { threadListSenderLine } from '@/utils/emailParticipantDisplay';
import { formatDate, formatTime } from '@/utils/localeFormat';

const router = useRouter();
const route = useRoute();
const notifications = useNotifications();
const authStore = useAuthStore();
const { promptConnectMailbox } = useConnectMailboxPrompt();

const emailThreads = ref([]);
const emailLoading = ref(false);
const emailError = ref(null);
const emailFilter = ref('all');
const emailIncludeDone = ref(false);

const mailboxes = ref([]);
const mailboxFlags = ref({
  canCreatePersonal: false,
  canDeletePersonal: false,
  canCreateGroup: false,
  gmailIntegrationEnabled: false,
  gmailOAuthAppConfigured: false
});
const mailboxesLoading = ref(true);
const mailboxesError = ref(null);
const mailboxActionLoading = ref(false);
const mailboxDetailsOpen = ref(false);
const mailboxDetailsTarget = ref(null);
const selectedMailboxFilter = ref(null);
const mailboxScopeAllMail = ref(false);
const selectedGmailLabelId = ref(null);
const gmailLabelCatalog = ref([]);
const gmailLabelsLoading = ref(false);

const GMAIL_LABEL_FALLBACK_NAMES = {
  INBOX: 'Inbox',
  STARRED: 'Starred',
  IMPORTANT: 'Important',
  SENT: 'Sent',
  DRAFT: 'Drafts',
  TRASH: 'Trash',
  SPAM: 'Spam',
  UNREAD: 'Unread',
  CATEGORY_PERSONAL: 'Primary',
  CATEGORY_SOCIAL: 'Social',
  CATEGORY_PROMOTIONS: 'Promotions',
  CATEGORY_UPDATES: 'Updates',
  CATEGORY_FORUMS: 'Forums'
};

function displayNameForGmailLabelId(id) {
  const key = String(id || '').trim().toUpperCase();
  if (GMAIL_LABEL_FALLBACK_NAMES[key]) return GMAIL_LABEL_FALLBACK_NAMES[key];
  return key
    .replace(/^CATEGORY_/, '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const personalMailboxes = computed(() => mailboxes.value.filter((m) => m.kind === 'personal'));
const ownedPersonalMailbox = computed(() => personalMailboxes.value[0] || null);
const groupMailboxes = computed(() => mailboxes.value.filter((m) => m.kind === 'group'));

const selectedMailbox = computed(() => {
  const id = selectedMailboxFilter.value;
  if (!id) return null;
  return mailboxes.value.find((x) => String(x.id) === String(id)) || null;
});

const gmailSidebarMailbox = computed(() => {
  if (selectedMailbox.value?.gmailInboxSync?.connected) return selectedMailbox.value;
  return mailboxes.value.find((x) => x.gmailInboxSync?.connected) || null;
});

const gmailSidebarFolders = computed(() => {
  const mb = gmailSidebarMailbox.value;
  if (!mb?.gmailInboxSync?.connected) return [];
  const ids = mb.gmailInboxSync.syncLabelIds || [];
  if (!ids.length) return [];
  const nameById = new Map(
    gmailLabelCatalog.value.map((l) => [String(l.id).toUpperCase(), l.name || l.id])
  );
  return ids.map((id) => {
    const sid = String(id);
    return {
      id: sid,
      label: nameById.get(sid.toUpperCase()) || displayNameForGmailLabelId(sid)
    };
  });
});

const emailSearchInput = ref('');
const composeDrawerOpen = ref(false);
/** When set, floating compose is replying to this thread row (otherwise new standalone message). */
const composeRow = ref(null);
/** Carries in-progress draft when popping out from docked reply. */
const composeDraftOverride = ref(null);
const composeWindowKey = ref('new-compose');
const dockedReplyPulse = ref(0);
const dockedReplyClosePulse = ref(0);
const threadReloadPulse = ref(0);

const composeStandaloneMode = computed(() => {
  if (!composeRow.value) return true;
  return isWorkspaceThreadRow(composeRow.value);
});

const composeRelatedTo = computed(() => {
  if (!composeRow.value || composeStandaloneMode.value) return null;
  return composeRow.value.relatedTo || null;
});

function mailboxSendMeta(mb) {
  if (!mb) return null;
  const viaApi = isMailboxConnectedForProvider(mb, 'google');
  const viaSmtp = isMailboxConnectedForProvider(mb, 'google-smtp');
  if (!viaApi && !viaSmtp) return null;
  const emailAddress = String(mb.emailAddress || mb.gmailInboxSync?.accountEmail || '').trim();
  if (!emailAddress) return null;
  return { id: mb.id, label: mb.label, emailAddress, viaSmtp };
}

const composeSendingMailbox = computed(() => {
  const replyMbId = composeRow.value?.mailboxId;
  if (replyMbId) {
    return mailboxSendMeta(mailboxes.value.find((x) => String(x.id) === String(replyMbId)));
  }
  if (selectedMailboxFilter.value) {
    return mailboxSendMeta(selectedMailbox.value);
  }
  const findSendable = (list) =>
    list.find(
      (m) =>
        isMailboxConnectedForProvider(m, 'google') || isMailboxConnectedForProvider(m, 'google-smtp')
    );
  const personal = findSendable(personalMailboxes.value);
  if (personal) return mailboxSendMeta(personal);
  const group = findSendable(groupMailboxes.value);
  return mailboxSendMeta(group);
});

const composeSendingMailboxHint = computed(() => {
  if (composeSendingMailbox.value) return '';
  // Org Resend/SMTP From is resolved via compose-preview; only hint when From is empty.
  return 'Uses organization email (Resend/SMTP) when configured. Connect Gmail to send as this mailbox.';
});

function buildReplyDraftForRow(row) {
  if (!row) return null;
  const subj = String(row.subject || '').trim();
  const reSub = /^re:\s*/i.test(subj) ? subj : `Re: ${subj || '(no subject)'}`;
  const draft = {
    to: row.replyToAddress || '',
    subject: reSub,
    body: ''
  };
  if (row.anchorCommunicationId) {
    draft.parentCommunicationId = row.anchorCommunicationId;
  }
  return draft;
}

const composeInitialDraftForDrawer = computed(() => {
  const base = buildReplyDraftForRow(composeRow.value) || {};
  const override = composeDraftOverride.value;
  if (!override) return Object.keys(base).length ? base : null;
  return { ...base, ...override };
});

const openThreadComposeStandalone = computed(() => {
  const row = openThreadRow.value;
  if (!row) return true;
  return isWorkspaceThreadRow(row);
});

const openThreadComposeRelatedTo = computed(() => {
  const row = openThreadRow.value;
  if (!row || openThreadComposeStandalone.value) return null;
  return row.relatedTo || null;
});

const openThreadComposeSendingMailbox = computed(() => {
  const row = openThreadRow.value;
  if (!row) return null;
  const replyMbId = row.mailboxId;
  if (replyMbId) {
    return mailboxSendMeta(mailboxes.value.find((x) => String(x.id) === String(replyMbId)));
  }
  if (selectedMailboxFilter.value) {
    return mailboxSendMeta(selectedMailbox.value);
  }
  const findSendable = (list) =>
    list.find(
      (m) =>
        isMailboxConnectedForProvider(m, 'google') || isMailboxConnectedForProvider(m, 'google-smtp')
    );
  const personal = findSendable(personalMailboxes.value);
  if (personal) return mailboxSendMeta(personal);
  const group = findSendable(groupMailboxes.value);
  return mailboxSendMeta(group);
});

const openThreadComposeSendingMailboxHint = computed(() => {
  if (openThreadComposeSendingMailbox.value) return '';
  return 'Uses organization email (Resend/SMTP) when configured. Connect Gmail to send as this mailbox.';
});

const selectedThreadIds = ref([]);
const emailNextCursor = ref(null);
const emailLoadingMore = ref(false);
const workspacePreviewThread = ref(null);

// Gmail-style thread reader. When this is set, the inbox content pane swaps
// from the list view to <EmailThreadReader>. Mailbox sidebar (left column)
// stays visible. URL is kept in sync via ?thread=<id> so back-button works
// and refresh re-opens the same thread.
const openThreadRow = ref(null);
const readerPanelMounted = ref(false);
const readerPanelExpanded = ref(false);

const CONTEXT_PANEL_OPEN_KEY = 'arivu:inbox-context-panel-open';
const CONTEXT_PANEL_WIDTH_PX = 300;
const READER_BODY_MIN_PX = 380;

function loadContextPanelOpenPref() {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem(CONTEXT_PANEL_OPEN_KEY) !== 'false';
}

const contextPanelOpen = ref(loadContextPanelOpenPref());

watch(contextPanelOpen, (open) => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(CONTEXT_PANEL_OPEN_KEY, open ? 'true' : 'false');
  }
});

const READER_PANEL_WIDTH_PCT_KEY = 'arivu:inbox-reader-panel-width-pct';
const READER_PANEL_RESIZED_KEY = 'arivu:inbox-reader-panel-user-resized';
const READER_PANEL_MIN_PCT = 32;
const READER_PANEL_MAX_PCT = 82;
const READER_PANEL_DEFAULT_PCT = 60;
const READER_LIST_MIN_PX = 280;

function clampReaderPanelPct(value) {
  return Math.min(READER_PANEL_MAX_PCT, Math.max(READER_PANEL_MIN_PCT, value));
}

function loadReaderPanelUserResized() {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(READER_PANEL_RESIZED_KEY) === 'true';
}

function loadReaderPanelWidthPct() {
  if (typeof window === 'undefined') return READER_PANEL_DEFAULT_PCT;
  if (!loadReaderPanelUserResized()) return READER_PANEL_DEFAULT_PCT;
  const stored = Number(window.localStorage.getItem(READER_PANEL_WIDTH_PCT_KEY));
  if (Number.isFinite(stored)) return clampReaderPanelPct(stored);
  return READER_PANEL_DEFAULT_PCT;
}

const readerSplitRef = ref(null);
const readerPanelUserResized = ref(loadReaderPanelUserResized());
const readerPanelWidthPct = ref(loadReaderPanelWidthPct());
const readerResizeActive = ref(false);
let readerResizeHandleEl = null;
let readerResizePointerId = null;

const effectiveReaderPanelWidthPct = computed(() => {
  if (!readerPanelUserResized.value) return READER_PANEL_DEFAULT_PCT;
  return readerPanelWidthPct.value;
});

const readerTargetWidthPct = computed(() => {
  const basePct = effectiveReaderPanelWidthPct.value;
  return contextPanelOpen.value && openThreadRow.value
    ? clampReaderPanelPct(basePct + 14)
    : basePct;
});

const readerShellMinWidthPx = computed(() =>
  contextPanelOpen.value
    ? READER_BODY_MIN_PX + CONTEXT_PANEL_WIDTH_PX
    : READER_BODY_MIN_PX
);

const readerShellStyle = computed(() => {
  if (!readerPanelExpanded.value) {
    return { width: '0px', maxWidth: '0px' };
  }

  return {
    width: `${readerTargetWidthPct.value}%`,
    maxWidth: `calc(100% - ${READER_LIST_MIN_PX}px)`,
    minWidth: `${readerShellMinWidthPx.value}px`
  };
});

const readerPanelInnerStyle = computed(() => ({
  width: '100%',
  minWidth: `${readerShellMinWidthPx.value}px`
}));

function expandReaderPanel() {
  if (readerPanelExpanded.value && readerPanelMounted.value) return;
  readerPanelMounted.value = true;
  nextTick(() => {
    requestAnimationFrame(() => {
      readerPanelExpanded.value = true;
    });
  });
}

function collapseReaderPanel() {
  if (!readerPanelMounted.value && !readerPanelExpanded.value) return;
  readerPanelExpanded.value = false;
}

function onReaderShellTransitionEnd(event) {
  if (event.target !== event.currentTarget) return;
  if (event.propertyName !== 'width') return;
  if (readerPanelExpanded.value) return;
  openThreadRow.value = null;
  readerPanelMounted.value = false;
}

let readerResizeStartX = 0;
let readerResizeStartPct = 0;
let readerResizeDidDrag = false;
const READER_RESIZE_DRAG_THRESHOLD_PX = 4;

function persistReaderPanelWidthPct() {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(READER_PANEL_WIDTH_PCT_KEY, String(readerPanelWidthPct.value.toFixed(1)));
  window.localStorage.setItem(READER_PANEL_RESIZED_KEY, 'true');
}

function endReaderPanelResize({ persist = false } = {}) {
  if (!readerResizeActive.value) return;
  readerResizeActive.value = false;

  if (readerResizeHandleEl && readerResizePointerId != null) {
    try {
      readerResizeHandleEl.releasePointerCapture(readerResizePointerId);
    } catch { /* ignore */ }
  }

  readerResizeHandleEl = null;
  readerResizePointerId = null;
  readerResizeDidDrag = false;
  document.body.classList.remove('inbox-reader-resizing');
  document.removeEventListener('pointermove', onReaderPanelResize);
  document.removeEventListener('pointerup', stopReaderPanelResize);
  document.removeEventListener('pointercancel', stopReaderPanelResize);
  window.removeEventListener('blur', onReaderPanelResizeAbort);

  if (persist) {
    persistReaderPanelWidthPct();
  }
}

function onReaderPanelResizeAbort() {
  endReaderPanelResize({ persist: false });
}

function startReaderPanelResize(event) {
  if (!(event instanceof PointerEvent) || event.button !== 0) return;

  endReaderPanelResize({ persist: false });

  readerResizeHandleEl = event.currentTarget;
  readerResizePointerId = event.pointerId;
  readerResizeStartX = event.clientX;
  readerResizeStartPct = effectiveReaderPanelWidthPct.value;
  readerResizeDidDrag = false;
  readerResizeActive.value = true;

  try {
    readerResizeHandleEl.setPointerCapture(event.pointerId);
  } catch { /* ignore */ }

  document.addEventListener('pointermove', onReaderPanelResize);
  document.addEventListener('pointerup', stopReaderPanelResize);
  document.addEventListener('pointercancel', stopReaderPanelResize);
  window.addEventListener('blur', onReaderPanelResizeAbort);
}

function onReaderPanelResize(event) {
  if (!readerResizeActive.value || !(event instanceof PointerEvent)) return;

  const deltaX = readerResizeStartX - event.clientX;
  if (!readerResizeDidDrag && Math.abs(deltaX) < READER_RESIZE_DRAG_THRESHOLD_PX) return;

  if (!readerResizeDidDrag) {
    readerResizeDidDrag = true;
    document.body.classList.add('inbox-reader-resizing');
  }

  const container = readerSplitRef.value;
  if (!container) return;
  const rect = container.getBoundingClientRect();
  if (rect.width <= 0) return;

  const deltaPct = (deltaX / rect.width) * 100;
  readerPanelUserResized.value = true;
  readerPanelWidthPct.value = clampReaderPanelPct(readerResizeStartPct + deltaPct);
}

function stopReaderPanelResize() {
  endReaderPanelResize({ persist: readerResizeDidDrag });
}

function resetReaderPanelWidth() {
  readerPanelUserResized.value = false;
  readerPanelWidthPct.value = READER_PANEL_DEFAULT_PCT;
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(READER_PANEL_WIDTH_PCT_KEY);
    window.localStorage.removeItem(READER_PANEL_RESIZED_KEY);
  }
}

const openThreadRecordPath = computed(() => recordPathForEmailThread(openThreadRow.value) || '');

const threadListScopeLabel = computed(() => {
  const opt = emailFilterOptions.value.find((o) => o.value === emailFilter.value);
  if (opt?.label) return opt.label;
  return t('inbox.inboxSurfaceAllMail');
});

const groupedEmailThreads = computed(() => {
  const now = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const todayStart = startOfDay(now).getTime();
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
  const groups = { today: [], yesterday: [], earlier: [] };
  for (const row of emailThreads.value) {
    const raw = row.lastActivityAt || row.firstActivityAt;
    const tms = raw ? startOfDay(new Date(raw)).getTime() : 0;
    if (tms >= todayStart) groups.today.push(row);
    else if (tms >= yesterdayStart) groups.yesterday.push(row);
    else groups.earlier.push(row);
  }
  const out = [];
  if (groups.today.length) {
    out.push({ key: 'today', label: '', rows: groups.today });
  }
  if (groups.yesterday.length) {
    out.push({ key: 'yesterday', label: t('inbox.inboxProYesterday'), rows: groups.yesterday });
  }
  if (groups.earlier.length) {
    out.push({ key: 'earlier', label: t('inbox.inboxSidebarLast7Days'), rows: groups.earlier });
  }
  return out;
});

const GMAIL_VIEW_DEFS = [
  { id: 'INBOX', labelKey: 'inbox.inboxSidebarViewInbox', icon: markRaw(InboxIcon), iconClass: 'text-red-500', countKey: 'unread' },
  { id: 'CATEGORY_SOCIAL', labelKey: 'inbox.inboxSidebarViewSocial', icon: markRaw(HashtagIcon), iconClass: 'text-[#2383E2]' },
  { id: 'CATEGORY_PROMOTIONS', labelKey: 'inbox.inboxSidebarViewPromotions', icon: markRaw(HashtagIcon), iconClass: 'text-violet-500' }
];

const NON_GMAIL_MAIL_DEFS = [
  { id: 'all', labelKey: 'inbox.inboxSurfaceAllMail', icon: markRaw(InboxIcon) },
  {
    id: 'unread',
    labelKey: 'inbox.inboxSurfaceFolderUnread',
    icon: markRaw(EnvelopeIcon),
    iconClass: 'text-[#2383E2] dark:text-blue-400',
    countKey: 'unread',
    badgeVariant: 'unread'
  },
  { id: 'sent', labelKey: 'inbox.inboxSurfaceFolderSent', icon: markRaw(PaperAirplaneIcon) },
  {
    id: 'scheduled',
    labelKey: 'inbox.inboxSurfaceFolderScheduled',
    icon: markRaw(ClockIcon),
    iconClass: 'text-amber-600 dark:text-amber-400',
    countKey: 'scheduled'
  }
];

const GMAIL_MAIL_DEFS = [
  { id: 'all', labelKey: 'inbox.inboxSurfaceAllMail', icon: markRaw(InboxIcon) },
  { id: 'sent', labelKey: 'inbox.inboxSurfaceFolderSent', icon: markRaw(PaperAirplaneIcon) },
  {
    id: 'scheduled',
    labelKey: 'inbox.inboxSurfaceFolderScheduled',
    icon: markRaw(ClockIcon),
    iconClass: 'text-amber-600 dark:text-amber-400',
    countKey: 'scheduled'
  },
  { id: 'DRAFT', labelKey: 'inbox.inboxSidebarFolderDrafts', icon: markRaw(PencilSquareIcon), gmailLabel: true },
  { id: 'SPAM', labelKey: 'inbox.inboxSidebarFolderSpam', icon: markRaw(HashtagIcon), gmailLabel: true },
  { id: 'TRASH', labelKey: 'inbox.inboxSidebarFolderTrash', icon: markRaw(TrashIcon), gmailLabel: true }
];

const inboxSidebarViewItems = computed(() => {
  if (!mailboxFlags.value.gmailIntegrationEnabled || !gmailSidebarMailbox.value?.gmailInboxSync?.connected) {
    return [];
  }
  const syncIds = new Set(
    (gmailSidebarMailbox.value.gmailInboxSync.syncLabelIds || []).map((id) => String(id).toUpperCase())
  );
  return GMAIL_VIEW_DEFS.filter((v) => syncIds.has(v.id)).map((v) => ({
    id: v.id,
    label: t(v.labelKey),
    active: selectedGmailLabelId.value === v.id && !selectedMailboxFilter.value,
    count: v.countKey ? threadCounts.value[v.countKey] : null,
    icon: v.icon,
    iconClass: v.iconClass
  }));
});

const inboxSidebarMailItems = computed(() => {
  const gmailOn =
    mailboxFlags.value.gmailIntegrationEnabled && gmailSidebarMailbox.value?.gmailInboxSync?.connected;
  const syncIds = gmailOn
    ? new Set((gmailSidebarMailbox.value.gmailInboxSync.syncLabelIds || []).map((id) => String(id).toUpperCase()))
    : new Set();

  const defs = gmailOn ? GMAIL_MAIL_DEFS : NON_GMAIL_MAIL_DEFS;

  return defs.filter((item) => {
    if (item.gmailLabel && gmailOn) return syncIds.has(item.id);
    if (item.gmailLabel && !gmailOn) return false;
    return true;
  }).map((item) => {
    let active = false;
    if (item.gmailLabel) {
      active = selectedGmailLabelId.value === item.id;
    } else if (item.id === 'all') {
      active = selectedMailboxFilter.value === null && emailFilter.value === 'all' && !selectedGmailLabelId.value;
    } else if (item.id === 'unread') {
      active = emailFilter.value === 'unread' && !selectedGmailLabelId.value;
    } else if (item.id === 'sent') {
      active = emailFilter.value === 'sent' && !selectedGmailLabelId.value;
    } else if (item.id === 'scheduled') {
      active = emailFilter.value === 'scheduled' && !selectedGmailLabelId.value;
    }
    return {
      id: item.id,
      label: t(item.labelKey),
      active,
      count: item.countKey ? threadCounts.value[item.countKey] : null,
      icon: item.icon,
      iconClass: item.iconClass,
      badgeVariant: item.badgeVariant
    };
  });
});

function mailboxNeedsConnect(mb) {
  if (!mb) return false;
  if (mailboxFlags.value.gmailIntegrationEnabled) {
    if (mb.kind === 'group' && mailboxFlags.value.canCreateGroup && !mb.gmailInboxSync?.connected) {
      return true;
    }
    if (mb.kind === 'personal' && !mb.gmailInboxSync?.connected && !mb.gmailSmtpOutbound?.connected) {
      return true;
    }
    return false;
  }
  return !mb.inboundParser?.routingAddress
    && (mb.kind === 'personal' || (mb.kind === 'group' && mailboxFlags.value.canCreateGroup));
}

function formatMailboxSyncStatus(mb) {
  if (!mailboxFlags.value.gmailIntegrationEnabled) {
    return formatMailboxInboundStatus(mb, mailboxFlags.value);
  }
  if (mb?.gmailInboxSync?.connected) return 'gmail on';
  if (mb?.gmailSmtpOutbound?.connected) return 'smtp send';
  const s = String(mb?.syncStatus || 'not_configured');
  if (s === 'not_configured') return 'sync off';
  if (s === 'pending') return 'sync pending';
  if (s === 'connected') return 'sync on';
  return s;
}

const inboxSidebarMailboxItems = computed(() =>
  mailboxes.value.map((mb) => ({
    id: String(mb.id),
    label: mb.label,
    kind: mb.kind,
    active: selectedMailboxFilter.value === mb.id && !selectedGmailLabelId.value,
    unreadCount: Number(mb.threadUnreadCount) || 0,
    emailAddress: mb.emailAddress || '',
    syncStatusLabel: formatMailboxSyncStatus(mb),
    showConnect: mailboxNeedsConnect(mb),
    showMembers: mb.kind === 'group' && mailboxFlags.value.canCreateGroup
  }))
);

const SYSTEM_GMAIL_LABELS = new Set(['INBOX', 'SENT', 'DRAFT', 'SPAM', 'TRASH', 'STARRED', 'IMPORTANT', 'UNREAD', 'CATEGORY_PERSONAL', 'CATEGORY_SOCIAL', 'CATEGORY_PROMOTIONS', 'CATEGORY_UPDATES', 'CATEGORY_FORUMS']);

const inboxSidebarGmailFolderItems = computed(() => {
  if (!mailboxFlags.value.gmailIntegrationEnabled) return [];
  return gmailSidebarFolders.value
    .filter((f) => !SYSTEM_GMAIL_LABELS.has(String(f.id).toUpperCase()))
    .map((f) => ({
      id: f.id,
      label: f.label,
      active: selectedGmailLabelId.value === f.id
    }));
});

const inboxThreadListGroups = computed(() =>
  groupedEmailThreads.value.map((group) => ({
    key: group.key,
    label: group.label,
    rows: group.rows.map((row) => ({
      threadId: String(row.threadId),
      sender: emailSenderLine(row),
      subject: row.subject || '',
      snippet: emailSnippetLine(row),
      unread: Boolean(row.unread),
      done: Boolean(row.done),
      lastActivityAt: row.lastActivityAt || row.firstActivityAt,
      formattedDate: formatGmailStyleDate(
        row.hasScheduledPending && row.nextScheduledAt
          ? row.nextScheduledAt
          : row.lastActivityAt || row.firstActivityAt
      ),
      raw: row
    }))
  }))
);

const inboxFilterChips = computed(() => [
  {
    id: 'unread',
    label: t('inbox.inboxSidebarFilterUnread'),
    active: emailFilter.value === 'unread',
    dot: true
  },
  {
    id: 'archived',
    label: t('inbox.inboxSidebarFilterArchived'),
    active: emailIncludeDone.value
  },
  {
    id: 'sent',
    label: t('inbox.inboxSurfaceFolderSent'),
    active: emailFilter.value === 'sent'
  },
  {
    id: 'scheduled',
    label: t('inbox.inboxSurfaceFolderScheduled'),
    active: emailFilter.value === 'scheduled'
  },
  {
    id: 'assigned',
    label: t('inbox.inboxSurfaceFolderAssignedToMe'),
    active: emailFilter.value === 'assigned_to_me'
  }
]);

const inboxListTitle = computed(() => {
  if (selectedGmailLabelId.value) {
    const folder = gmailSidebarFolders.value.find((f) => f.id === selectedGmailLabelId.value);
    if (folder?.label) return folder.label;
    return displayNameForGmailLabelId(selectedGmailLabelId.value);
  }
  return threadListScopeLabel.value;
});

const openThreadIndex = computed(() => {
  if (!openThreadRow.value) return -1;
  const id = String(openThreadRow.value.threadId);
  return emailThreads.value.findIndex((r) => String(r.threadId) === id);
});

const canNavigateThreadPrev = computed(() => openThreadIndex.value > 0);
const canNavigateThreadNext = computed(() => {
  const idx = openThreadIndex.value;
  return idx >= 0 && idx < emailThreads.value.length - 1;
});

const allVisibleSelected = computed(() => {
  const rows = emailThreads.value;
  if (!rows.length) return false;
  return rows.every((r) => selectedThreadIds.value.includes(String(r.threadId)));
});

const someVisibleSelected = computed(() => {
  if (!selectedThreadIds.value.length) return false;
  return !allVisibleSelected.value;
});

const selectedPersonalMailbox = computed(() => {
  const m = selectedMailbox.value;
  return m && m.kind === 'personal' ? m : null;
});

const selectedGroupMailbox = computed(() => {
  const m = selectedMailbox.value;
  return m && m.kind === 'group' ? m : null;
});

/** Personal mailbox id for Gmail folder modal / OAuth when "All mail" scope is active. */
const gmailFolderModalMailboxId = computed(() => {
  const s = selectedPersonalMailbox.value;
  if (s?.id) return String(s.id);
  const first = mailboxes.value.find((x) => x.kind === 'personal');
  return first?.id ? String(first.id) : '';
});

const threadCounts = ref({ all: 0, unread: 0, sent: 0, scheduled: 0, assignedToMe: 0, snoozed: 0 });
const gmailSyncLoading = ref(false);
const connectInboxWizardOpen = ref(false);
const gmailServerSetupModalOpen = ref(false);
const gmailFolderModalOpen = ref(false);

// Gmail OAuth opens in a sized popup window (not the current tab). State below
// is local to the parent tab — the popup itself runs the same InboxSurface
// SPA, posts a result message back via window.opener, and closes itself
// (see consumeGmailOAuthQuery).
let gmailOAuthPopupRef = null;
let gmailOAuthPollTimer = null;
let gmailOAuthMessageHandler = null;

function cleanupGmailOAuthPopup() {
  if (gmailOAuthPollTimer) {
    clearInterval(gmailOAuthPollTimer);
    gmailOAuthPollTimer = null;
  }
  if (gmailOAuthMessageHandler) {
    window.removeEventListener('message', gmailOAuthMessageHandler);
    gmailOAuthMessageHandler = null;
  }
  gmailOAuthPopupRef = null;
}

const gmailOAuthReady = computed(() => mailboxFlags.value.gmailOAuthAppConfigured === true);

const gmailRedirectExample = computed(() => {
  const explicit = getApiOrigin();
  const origin =
    explicit ||
    (typeof window !== 'undefined' ? String(window.location.origin || '').replace(/\/$/, '') : '');
  return `${origin}/api/mailboxes/inbox-sync/google/callback`;
});

const gmailEnvSnippet = computed(
  () =>
    `GOOGLE_GMAIL_CLIENT_ID=your_client_id_here
GOOGLE_GMAIL_CLIENT_SECRET=your_client_secret_here
GOOGLE_GMAIL_REDIRECT_URI=${gmailRedirectExample.value}`
);

const connectWizardInitialEmail = computed(() => {
  const e = authStore.user?.email;
  return e && String(e).includes('@') ? String(e).trim() : '';
});

function onGmailProviderClick() {
  if (gmailSyncLoading.value) return;
  if (!gmailOAuthReady.value) {
    gmailServerSetupModalOpen.value = true;
    return;
  }
  promptConnectMailbox('inbox');
}

/** Get Started → Connect: personal mailbox + parser forwarding or Gmail. */
function openConnectInboxModal() {
  if (gmailSyncLoading.value) return;
  promptConnectMailbox('inbox', { mailboxKind: 'personal' });
}

function openMailboxForwardingSetup(mb) {
  if (!mb) return;
  promptConnectMailbox('inbox', {
    mailboxKind: mb.kind === 'group' ? 'group' : 'personal',
    targetMailbox: mb
  });
}

async function copyGmailRedirectExample() {
  const text = gmailRedirectExample.value;
  try {
    await navigator.clipboard.writeText(text);
    notifications.success('Redirect URI copied');
  } catch {
    notifications.error('Could not copy');
  }
}

async function onConnectInboxWizardSubmit({ loginHint }) {
  await startGmailOAuth(String(loginHint || '').trim());
}
const threadCountsRefreshing = ref(false);

const membersModalMailbox = ref(null);
const assignmentUsers = ref([]);
const assignmentUsersLoading = ref(false);
const membersSelectedIds = ref([]);
const membersSaveLoading = ref(false);

const emailFilterOptions = computed(() => [
  { value: 'all', label: t('inbox.inboxSurfaceFolderAll') },
  { value: 'unread', label: t('inbox.inboxSurfaceFolderUnread') },
  { value: 'sent', label: t('inbox.inboxSurfaceFolderSent') },
  { value: 'scheduled', label: t('inbox.inboxSurfaceFolderScheduled') },
  { value: 'assigned_to_me', label: t('inbox.inboxSurfaceFolderAssignedToMe') },
  { value: 'snoozed', label: t('inbox.inboxSurfaceFolderSnoozed') }
]);

function onSidebarSelectView(viewId) {
  if (viewId === 'unread') {
    mailboxScopeAllMail.value = true;
    selectedMailboxFilter.value = null;
    selectedGmailLabelId.value = null;
    emailFilter.value = 'unread';
  } else {
    selectGmailLabel(viewId);
  }
  selectedThreadIds.value = [];
  refreshInboxThreadsAndCounts();
}

function onSidebarSelectMail(mailId) {
  selectedThreadIds.value = [];
  if (mailId === 'all') {
    mailboxScopeAllMail.value = true;
    selectedMailboxFilter.value = null;
    selectedGmailLabelId.value = null;
    emailFilter.value = 'all';
    refreshInboxThreadsAndCounts();
    return;
  }
  if (mailId === 'unread') {
    mailboxScopeAllMail.value = true;
    selectedMailboxFilter.value = null;
    selectedGmailLabelId.value = null;
    emailFilter.value = 'unread';
    refreshInboxThreadsAndCounts();
    return;
  }
  if (mailId === 'sent') {
    mailboxScopeAllMail.value = true;
    selectedMailboxFilter.value = null;
    selectedGmailLabelId.value = null;
    emailFilter.value = 'sent';
    refreshInboxThreadsAndCounts();
    return;
  }
  if (mailId === 'scheduled') {
    mailboxScopeAllMail.value = true;
    selectedMailboxFilter.value = null;
    selectedGmailLabelId.value = null;
    emailFilter.value = 'scheduled';
    refreshInboxThreadsAndCounts();
    return;
  }
  selectGmailLabel(mailId);
}

function onInboxFilterChip(chipId) {
  if (chipId === 'unread') {
    emailFilter.value = emailFilter.value === 'unread' ? 'all' : 'unread';
    selectedGmailLabelId.value = null;
    refreshInboxThreadsAndCounts();
    return;
  }
  if (chipId === 'archived') {
    emailIncludeDone.value = !emailIncludeDone.value;
    onEmailIncludeDoneChange();
    return;
  }
  if (chipId === 'sent') {
    emailFilter.value = emailFilter.value === 'sent' ? 'all' : 'sent';
    selectedGmailLabelId.value = null;
    refreshInboxThreadsAndCounts();
    return;
  }
  if (chipId === 'scheduled') {
    emailFilter.value = emailFilter.value === 'scheduled' ? 'all' : 'scheduled';
    selectedGmailLabelId.value = null;
    refreshInboxThreadsAndCounts();
    return;
  }
  if (chipId === 'assigned') {
    emailFilter.value = emailFilter.value === 'assigned_to_me' ? 'all' : 'assigned_to_me';
    selectedGmailLabelId.value = null;
    refreshInboxThreadsAndCounts();
  }
}

function onInboxSearchInput(value) {
  emailSearchInput.value = value;
  scheduleEmailSearch();
}

async function markThreadRead(row) {
  if (!row?.threadId || !row.unread) return;
  try {
    await apiClient.patch(`/communications/threads/${encodeURIComponent(String(row.threadId))}/view`, {});
    await refreshInboxThreadsAndCounts();
  } catch {
    notifications.error('Could not mark as read');
  }
}

function navigateThreadPrev() {
  const idx = openThreadIndex.value;
  if (idx <= 0) return;
  openEmailThreadRecord(emailThreads.value[idx - 1]);
}

function navigateThreadNext() {
  const idx = openThreadIndex.value;
  if (idx < 0 || idx >= emailThreads.value.length - 1) return;
  openEmailThreadRecord(emailThreads.value[idx + 1]);
}

function setEmailFilter(value) {
  emailFilter.value = value;
  selectedGmailLabelId.value = null;
  selectedThreadIds.value = [];
  refreshInboxThreadsAndCounts();
}

function sidebarScopeActive(mailboxId) {
  const active = selectedMailboxFilter.value === mailboxId;
  return active
    ? 'bg-primary-100 font-medium text-primary-900 dark:bg-primary-950/70 dark:text-primary-50'
    : 'text-neutral-800 hover:bg-neutral-200/70 dark:text-gray-200 dark:hover:bg-gray-800/70';
}

function sidebarFolderActive(filterValue) {
  const active = emailFilter.value === filterValue;
  return active
    ? 'bg-primary-100 font-medium text-primary-900 dark:bg-primary-950/70 dark:text-primary-50'
    : 'text-neutral-800 hover:bg-neutral-200/70 dark:text-gray-200 dark:hover:bg-gray-800/70';
}

function applyDefaultMailboxSelection() {
  if (selectedMailboxFilter.value) {
    const exists = mailboxes.value.some((m) => String(m.id) === String(selectedMailboxFilter.value));
    if (!exists) selectedMailboxFilter.value = null;
  }
  if (!selectedMailboxFilter.value && !mailboxScopeAllMail.value && ownedPersonalMailbox.value?.id) {
    selectedMailboxFilter.value = ownedPersonalMailbox.value.id;
  }
}

function selectMailboxFilter(mailboxId) {
  selectedMailboxFilter.value = mailboxId;
  mailboxScopeAllMail.value = !mailboxId;
  selectedGmailLabelId.value = null;
  selectedThreadIds.value = [];
  refreshInboxThreadsAndCounts();
  const mb = mailboxId
    ? mailboxes.value.find((x) => String(x.id) === String(mailboxId))
    : null;
  if (mb?.gmailInboxSync?.connected) {
    loadGmailLabelCatalog();
  } else {
    gmailLabelCatalog.value = [];
  }
}

async function loadGmailLabelCatalog() {
  const mb = gmailSidebarMailbox.value;
  if (!mb?.id || !mb.gmailInboxSync?.connected) {
    gmailLabelCatalog.value = [];
    return;
  }
  gmailLabelsLoading.value = true;
  try {
    const res = await apiClient.get(
      `/mailboxes/${encodeURIComponent(mb.id)}/inbox-sync/google/labels`
    );
    if (res?.success && Array.isArray(res.data?.labels)) {
      gmailLabelCatalog.value = res.data.labels;
    }
  } catch (err) {
    console.warn('[Inbox] gmail labels:', err);
  } finally {
    gmailLabelsLoading.value = false;
  }
}

function sidebarGmailLabelActive(labelId) {
  const active = selectedGmailLabelId.value === labelId;
  return active
    ? 'bg-blue-200/80 font-medium text-blue-950 dark:bg-blue-950/70 dark:text-blue-50'
    : 'text-gray-800 hover:bg-gray-200/70 dark:text-gray-200 dark:hover:bg-gray-800/70';
}

function selectGmailLabel(labelId) {
  const next =
    labelId && selectedGmailLabelId.value === labelId ? null : labelId || null;
  selectedGmailLabelId.value = next;
  if (next) {
    const mb = gmailSidebarMailbox.value;
    if (mb?.id && !selectedMailboxFilter.value) {
      selectedMailboxFilter.value = mb.id;
    }
  }
  selectedThreadIds.value = [];
  refreshInboxThreadsAndCounts();
}

function formatShortSyncTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return formatDate(d, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function openConnectGroupGmail(mb) {
  if (!mb?.id) return;
  selectMailboxFilter(mb.id);
  promptConnectMailbox('inbox', { mailboxKind: 'group', targetMailbox: mb });
}

async function startGmailOAuth(loginHint = '') {
  const mb = selectedMailbox.value || mailboxes.value.find((m) => m.kind === 'personal');
  if (!mb?.id) return;
  gmailSyncLoading.value = true;
  try {
    const hint = String(loginHint || '').trim();
    const options = hint ? { params: { login_hint: hint } } : {};
    const res = await apiClient.get(`/mailboxes/${mb.id}/inbox-sync/google/start`, options);
    if (!res?.success || !res?.data?.url) {
      notifications.error(res?.message || 'Could not start Gmail connection');
      gmailSyncLoading.value = false;
      return;
    }

    // Open Google's consent screen in a sized popup window. Providing
    // explicit width/height is what tells Chrome (and most browsers) to
    // create a separate "popup" window instead of a tab in the current
    // window. The OAuth callback eventually lands back on our own
    // /inbox?gmail=connected URL inside this popup; that page detects
    // window.opener and posts a result back here, then closes itself.
    const w = 520;
    const h = 720;
    const screenLeft = typeof window.screen.availLeft === 'number' ? window.screen.availLeft : 0;
    const screenTop = typeof window.screen.availTop === 'number' ? window.screen.availTop : 0;
    const left = Math.max(0, Math.round((window.screen.availWidth - w) / 2 + screenLeft));
    const top = Math.max(0, Math.round((window.screen.availHeight - h) / 2 + screenTop));
    const features = `popup=yes,width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`;
    const popup = window.open(res.data.url, 'gmail-oauth', features);

    if (!popup) {
      // Popup blocked by the browser — fall back to same-tab redirect so the
      // user can still complete the flow. They'll come back via the post-
      // callback redirect handled by consumeGmailOAuthQuery on next mount.
      connectInboxWizardOpen.value = false;
      window.location.href = res.data.url;
      return;
    }

    cleanupGmailOAuthPopup();
    gmailOAuthPopupRef = popup;
    connectInboxWizardOpen.value = false;
    try { popup.focus(); } catch { /* ignore */ }

    gmailOAuthMessageHandler = (event) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || data.type !== 'gmail-oauth-result') return;
      if (data.status === 'connected') {
        notifications.success('Gmail connected. Choose which folders to sync, then use Sync now if you want mail immediately.');
        fetchMailboxes().then(() => {
          gmailFolderModalOpen.value = true;
        });
      } else if (data.status === 'error') {
        notifications.error(String(data.message || 'Connection failed'));
      }
      try { popup.close(); } catch { /* ignore */ }
      cleanupGmailOAuthPopup();
      gmailSyncLoading.value = false;
    };
    window.addEventListener('message', gmailOAuthMessageHandler);

    // Detect manual popup close (user dismissed without finishing OAuth).
    gmailOAuthPollTimer = setInterval(() => {
      if (popup.closed) {
        cleanupGmailOAuthPopup();
        gmailSyncLoading.value = false;
      }
    }, 500);
  } catch (err) {
    notifications.error(err?.response?.data?.message || err?.message || 'Could not start Gmail connection');
    gmailSyncLoading.value = false;
  }
}

async function runGmailInboxSync() {
  const mb = selectedMailbox.value || gmailSidebarMailbox.value;
  if (!mb?.id) return;
  gmailSyncLoading.value = true;
  try {
    const res = await apiClient.post(`/mailboxes/${mb.id}/inbox-sync/run`, {});
    if (res?.success) {
      const imp = Number(res?.data?.imported) || 0;
      const sk = Number(res?.data?.skipped) || 0;
      notifications.success(`Synced: ${imp} imported, ${sk} skipped (already had)`);
      await Promise.all([fetchMailboxes(), refreshInboxThreadsAndCounts(), fetchWorkspaceThreadCountsOnly({ silent: true })]);
    } else {
      notifications.error(res?.message || 'Sync failed');
    }
  } catch (err) {
    notifications.error(err?.response?.data?.message || err?.message || 'Sync failed');
  } finally {
    gmailSyncLoading.value = false;
  }
}

async function onGmailFolderModalSaved() {
  const prevLabel = selectedGmailLabelId.value;
  await fetchMailboxes();
  await loadGmailLabelCatalog();
  const syncIds = gmailSidebarMailbox.value?.gmailInboxSync?.syncLabelIds || [];
  if (prevLabel && !syncIds.some((id) => String(id) === String(prevLabel))) {
    selectedGmailLabelId.value = null;
    await refreshInboxThreadsAndCounts();
  }
  notifications.success('Sync folders saved');
}

async function disconnectGmail() {
  const mb = selectedMailbox.value || gmailSidebarMailbox.value;
  if (!mb?.id) return;
  if (typeof window !== 'undefined' && !await confirmAction('Disconnect Gmail from this mailbox?')) return;
  gmailSyncLoading.value = true;
  try {
    const res = await apiClient.post(`/mailboxes/${mb.id}/inbox-sync/google/disconnect`, {});
    if (res?.success) {
      notifications.success('Gmail disconnected');
      selectedGmailLabelId.value = null;
      gmailLabelCatalog.value = [];
      await fetchMailboxes();
    } else {
      notifications.error(res?.message || 'Disconnect failed');
    }
  } catch (err) {
    notifications.error(err?.response?.data?.message || err?.message || 'Disconnect failed');
  } finally {
    gmailSyncLoading.value = false;
  }
}

function consumeGmailOAuthQuery() {
  const g = String(route.query.gmail || '');
  if (g !== 'connected' && g !== 'error') return;

  const rawMessage = route.query.message != null ? String(route.query.message) : '';
  const decodedMessage = rawMessage ? decodeURIComponent(rawMessage.replace(/\+/g, ' ')) : '';

  // When this page is opened as the OAuth popup (window.opener points back
  // to the tab that called startGmailOAuth), hand the result to that opener
  // and close ourselves instead of showing notifications here — the parent
  // tab will refresh state and surface the toast in the user's main view.
  const isOAuthPopup =
    typeof window !== 'undefined' &&
    window.opener &&
    window.opener !== window &&
    !window.opener.closed;
  if (isOAuthPopup) {
    try {
      const payload =
        g === 'connected'
          ? { type: 'gmail-oauth-result', status: 'connected' }
          : { type: 'gmail-oauth-result', status: 'error', message: decodedMessage || 'Connection failed' };
      window.opener.postMessage(payload, window.location.origin);
    } catch { /* opener may be cross-origin / closed — fall through to close */ }
    try { window.close(); } catch { /* ignore */ }
    return;
  }

  // Direct-navigation fallback: user pasted the success URL, or popup was
  // blocked and we did a full-tab redirect instead. Behave the old way.
  if (g === 'connected') {
    notifications.success('Gmail connected. Choose which folders to sync, then use Sync now if you want mail immediately.');
    fetchMailboxes().then(() => {
      gmailFolderModalOpen.value = true;
    });
  } else {
    notifications.error(decodedMessage || 'Connection failed');
  }
  const q = { ...route.query };
  delete q.gmail;
  delete q.message;
  router.replace({ path: route.path, query: q });
}

function isWorkspaceThreadRow(row) {
  const mk = row?.relatedTo?.moduleKey;
  if (!mk) return false;
  return String(mk).toLowerCase() === 'workspace';
}

/** Full-page onboarding until user has shared mailbox access or a connected personal mailbox. */
const showInboxGetStarted = computed(() => {
  return !isInboxShellUnblocked(mailboxes.value, mailboxFlags.value);
});

function openConnectGroupMailbox() {
  if (!mailboxFlags.value.canCreateGroup) {
    notifications.warning('Only admins can set up shared mailboxes.');
    return;
  }
  promptConnectMailbox('inbox', { mailboxKind: 'group' });
}

function openNewCompose() {
  composeRow.value = null;
  composeDraftOverride.value = null;
  composeWindowKey.value = 'new-compose';
  composeDrawerOpen.value = true;
}

function isInboxTypingTarget(target) {
  if (!(target instanceof Element)) return false;
  const el = target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]');
  return Boolean(el);
}

function onInboxComposeShortcut(event) {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.key !== 'c' && event.key !== 'C') return;
  if (isInboxTypingTarget(event.target)) return;
  if (composeDrawerOpen.value) return;
  event.preventDefault();
  openNewCompose();
}

function requestDockedReply() {
  if (!openThreadRow.value?.threadId) return;
  dockedReplyPulse.value += 1;
}

function openFloatingCompose(payload) {
  let target = null;
  let draft = null;
  if (payload && typeof payload === 'object' && payload.row) {
    target = payload.row;
    draft = payload.draft || null;
  } else {
    target = payload || openThreadRow.value;
  }
  if (!target?.threadId) return;
  composeRow.value = target;
  composeDraftOverride.value = draft;
  composeWindowKey.value = draft
    ? `popout-${target.threadId}-${Date.now()}`
    : String(target.threadId);
  composeDrawerOpen.value = true;
}

function closeComposeDrawer() {
  composeDrawerOpen.value = false;
  composeRow.value = null;
  composeDraftOverride.value = null;
}

async function submitDockedCompose(payload) {
  await submitCompose(payload, { docked: true });
}

function toggleThreadSelected(threadId, checked) {
  const set = new Set(selectedThreadIds.value.map(String));
  if (checked) set.add(String(threadId));
  else set.delete(String(threadId));
  selectedThreadIds.value = [...set];
}

function toggleSelectAllVisible(checked) {
  if (checked) {
    selectedThreadIds.value = emailThreads.value.map((r) => String(r.threadId));
  } else {
    selectedThreadIds.value = [];
  }
}

function clearThreadSelection() {
  selectedThreadIds.value = [];
}

async function bulkMarkDone(done) {
  const ids = selectedThreadIds.value;
  if (!ids.length) return;
  try {
    const res = await apiClient.patch('/communications/threads/bulk', {
      threadIds: ids,
      action: 'done',
      done
    });
    if (res?.success) {
      notifications.success(done ? 'Marked done' : 'Reopened');
      clearThreadSelection();
      await Promise.all([
        refreshInboxThreadsAndCounts(),
        fetchMailboxes(),
        fetchWorkspaceThreadCountsOnly({ silent: true })
      ]);
    } else {
      notifications.error(res?.message || 'Bulk action failed');
    }
  } catch (err) {
    notifications.error(err?.response?.data?.message || err?.message || 'Bulk action failed');
  }
}

async function bulkAssignToMe() {
  const uid = authStore.user?._id || authStore.user?.id;
  if (!uid) {
    notifications.error('Not signed in');
    return;
  }
  const ids = selectedThreadIds.value;
  if (!ids.length) return;
  try {
    const res = await apiClient.patch('/communications/threads/bulk', {
      threadIds: ids,
      action: 'assign',
      assignedToUserId: uid
    });
    if (res?.success) {
      notifications.success('Assigned to you');
      clearThreadSelection();
      await refreshInboxThreadsAndCounts();
    } else {
      notifications.error(res?.message || 'Assign failed');
    }
  } catch (err) {
    notifications.error(err?.response?.data?.message || err?.message || 'Assign failed');
  }
}

async function bulkPromptAddTag() {
  const raw = typeof window !== 'undefined' ? window.prompt('Tag to add (letters, numbers, hyphen)') : '';
  const tag = String(raw || '').trim();
  if (!tag) return;
  const ids = selectedThreadIds.value;
  if (!ids.length) return;
  try {
    const res = await apiClient.patch('/communications/threads/bulk', {
      threadIds: ids,
      action: 'add_tag',
      tag
    });
    if (res?.success) {
      notifications.success('Tag added');
      clearThreadSelection();
      await refreshInboxThreadsAndCounts();
    } else {
      notifications.error(res?.message || 'Tag failed');
    }
  } catch (err) {
    notifications.error(err?.response?.data?.message || err?.message || 'Tag failed');
  }
}

async function bulkPromptRemoveTag() {
  const raw = typeof window !== 'undefined' ? window.prompt('Tag to remove') : '';
  const tag = String(raw || '').trim();
  if (!tag) return;
  const ids = selectedThreadIds.value;
  if (!ids.length) return;
  try {
    const res = await apiClient.patch('/communications/threads/bulk', {
      threadIds: ids,
      action: 'remove_tag',
      tag
    });
    if (res?.success) {
      notifications.success('Tag removed');
      clearThreadSelection();
      await refreshInboxThreadsAndCounts();
    } else {
      notifications.error(res?.message || 'Remove tag failed');
    }
  } catch (err) {
    notifications.error(err?.response?.data?.message || err?.message || 'Remove tag failed');
  }
}

function nextNineAmLocal() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

async function bulkSnoozeTomorrow() {
  const ids = selectedThreadIds.value;
  if (!ids.length) return;
  const snoozedUntil = nextNineAmLocal();
  try {
    const res = await apiClient.patch('/communications/threads/bulk', {
      threadIds: ids,
      action: 'snooze',
      snoozedUntil
    });
    if (res?.success) {
      notifications.success('Snoozed');
      clearThreadSelection();
      await Promise.all([
        refreshInboxThreadsAndCounts(),
        fetchMailboxes(),
        fetchWorkspaceThreadCountsOnly({ silent: true })
      ]);
    } else {
      notifications.error(res?.message || 'Snooze failed');
    }
  } catch (err) {
    notifications.error(err?.response?.data?.message || err?.message || 'Snooze failed');
  }
}

async function selectAllInFolder() {
  try {
    const params = {
      ...buildWorkspaceThreadParams(),
      filter: emailFilter.value
    };
    const res = await apiClient.get('/communications/workspace-thread-ids', { params });
    if (res?.success && Array.isArray(res?.data?.threadIds)) {
      selectedThreadIds.value = res.data.threadIds.map(String);
      if (res.data.truncated) {
        notifications.info(t('inbox.inboxThreadsPartialSelect'));
      }
    } else {
      notifications.error(res?.message || 'Could not load thread ids');
    }
  } catch (err) {
    notifications.error(err?.response?.data?.message || err?.message || 'Could not load thread ids');
  }
}

async function snoozeRowTomorrow(row) {
  if (!row?.threadId) return;
  try {
    const res = await apiClient.patch(
      `/communications/threads/${encodeURIComponent(String(row.threadId))}/snooze`,
      { snoozedUntil: nextNineAmLocal() }
    );
    if (res?.success) {
      notifications.success('Snoozed');
      await Promise.all([
        refreshInboxThreadsAndCounts(),
        fetchMailboxes(),
        fetchWorkspaceThreadCountsOnly({ silent: true })
      ]);
    } else {
      notifications.error(res?.message || 'Snooze failed');
    }
  } catch (err) {
    notifications.error(err?.response?.data?.message || err?.message || 'Snooze failed');
  }
}

function closeWorkspacePreview() {
  workspacePreviewThread.value = null;
}

function folderCountBadge(filterValue) {
  if (filterValue === 'all') return threadCounts.value.all;
  if (filterValue === 'unread') return threadCounts.value.unread;
  if (filterValue === 'sent') return threadCounts.value.sent || 0;
  if (filterValue === 'scheduled') return threadCounts.value.scheduled || 0;
  if (filterValue === 'assigned_to_me') return threadCounts.value.assignedToMe;
  if (filterValue === 'snoozed') return threadCounts.value.snoozed || 0;
  return 0;
}

let emailSearchDebounceTimer = null;
function scheduleEmailSearch() {
  if (emailSearchDebounceTimer) clearTimeout(emailSearchDebounceTimer);
  emailSearchDebounceTimer = setTimeout(() => {
    emailSearchDebounceTimer = null;
    fetchEmailThreads();
  }, 400);
}

function clearEmailSearch() {
  emailSearchInput.value = '';
  if (emailSearchDebounceTimer) {
    clearTimeout(emailSearchDebounceTimer);
    emailSearchDebounceTimer = null;
  }
  selectedThreadIds.value = [];
  fetchEmailThreads();
}

function openGmailReconnectForCompose() {
  const mbId = composeRow.value?.mailboxId || selectedMailboxFilter.value;
  const mb = mbId ? mailboxes.value.find((x) => String(x.id) === String(mbId)) : null;
  promptConnectMailbox('send', {
    mailboxKind: mb?.kind || 'personal',
    targetMailbox: mb || undefined
  });
}

async function submitCompose(payload, { docked = false } = {}) {
  try {
    const body = { ...payload };
    const fromSource = String(body.fromSource || '').trim();
    // Org / user From must not be re-bound to the open inbox mailbox (Gmail).
    if (fromSource === 'tenant_config' || fromSource === 'user') {
      delete body.mailboxId;
      // Keep fromSource — server honors it to force org delivery path
    } else if (!body.mailboxId) {
      const row = docked ? openThreadRow.value : composeRow.value;
      const mb = row?.mailboxId || selectedMailboxFilter.value || composeSendingMailbox.value?.id;
      if (mb) body.mailboxId = mb;
    }
    const res = await apiClient.post('/communications/email', body);
    if (res?.success) {
      if (res?.scheduled && res?.scheduledAt) {
        let when = res.scheduledAt;
        try {
          when = new Intl.DateTimeFormat(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
          }).format(new Date(res.scheduledAt));
        } catch {
          /* keep ISO */
        }
        notifications.success(t('inbox.emailComposeScheduleSuccess', { when }));
      } else {
        notifications.success(res?.queued ? 'Email queued' : 'Email sent');
      }
      if (docked) {
        dockedReplyClosePulse.value += 1;
        threadReloadPulse.value += 1;
      } else {
        closeComposeDrawer();
      }
      await Promise.all([fetchEmailThreads(), fetchMailboxes(), fetchWorkspaceThreadCountsOnly({ silent: true })]);
    } else {
      if (shouldPromptGmailReconnect(res)) {
        openGmailReconnectForCompose();
      }
      notifications.error(res?.message || 'Send failed');
    }
  } catch (err) {
    const payload = err?.response?.data || err;
    if (shouldPromptGmailReconnect(payload)) {
      openGmailReconnectForCompose();
      notifications.error(gmailReconnectMessage(payload));
      return;
    }
    notifications.error(err?.response?.data?.message || err?.message || 'Send failed');
  }
}

async function openMembersModal(mb) {
  membersModalMailbox.value = mb;
  membersSelectedIds.value = Array.isArray(mb.memberUserIds) ? [...mb.memberUserIds] : [];
  assignmentUsers.value = [];
  assignmentUsersLoading.value = true;
  try {
    const res = await apiClient.get('/users/list');
    if (res?.success && Array.isArray(res.data)) {
      assignmentUsers.value = res.data;
    }
  } catch (err) {
    console.error('[Inbox] users list:', err);
    notifications.error('Could not load users');
  } finally {
    assignmentUsersLoading.value = false;
  }
}

function closeMembersModal() {
  membersModalMailbox.value = null;
  membersSelectedIds.value = [];
  assignmentUsers.value = [];
}

function toggleMemberSelection(userId, checked) {
  const set = new Set(membersSelectedIds.value);
  if (checked) set.add(userId);
  else set.delete(userId);
  membersSelectedIds.value = [...set];
}

async function saveMembersModal() {
  const mb = membersModalMailbox.value;
  if (!mb?.id) return;
  membersSaveLoading.value = true;
  try {
    const res = await apiClient(`/mailboxes/${mb.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ memberUserIds: membersSelectedIds.value })
    });
    if (res?.success) {
      notifications.success('Members updated');
      closeMembersModal();
      await fetchMailboxes();
    } else {
      notifications.error(res?.message || 'Save failed');
    }
  } catch (err) {
    notifications.error(err?.response?.data?.message || err?.message || 'Save failed');
  } finally {
    membersSaveLoading.value = false;
  }
}

function openMailboxDetails(mailboxId) {
  const mb = mailboxes.value.find((x) => String(x.id) === String(mailboxId));
  if (!mb) return;
  mailboxDetailsTarget.value = mb;
  mailboxDetailsOpen.value = true;
}

function onSidebarConnectMailbox(mailboxId) {
  const mb = mailboxes.value.find((x) => String(x.id) === String(mailboxId));
  if (!mb) return;
  if (mailboxFlags.value.gmailIntegrationEnabled && mb.kind === 'group') {
    openConnectGroupGmail(mb);
  } else {
    openMailboxForwardingSetup(mb);
  }
}

function onSidebarManageMembers(mailboxId) {
  const mb = mailboxes.value.find((x) => String(x.id) === String(mailboxId));
  if (mb) openMembersModal(mb);
}

function onMailboxDetailsConnect(mb) {
  mailboxDetailsOpen.value = false;
  onSidebarConnectMailbox(mb.id);
}

function onMailboxDetailsManageMembers(mb) {
  mailboxDetailsOpen.value = false;
  openMembersModal(mb);
}

function onMailboxDetailsDelete(mb) {
  mailboxDetailsOpen.value = false;
  if (mb?.kind === 'personal') deletePersonalMailbox();
  else if (mb?.kind === 'group') deleteGroupMailbox(mb);
}

const fetchMailboxes = async () => {
  mailboxesLoading.value = true;
  mailboxesError.value = null;
  try {
    const res = await apiClient('/mailboxes', {
      method: 'GET',
      params: {
        includeThreadCounts: 'true',
        includeDone: emailIncludeDone.value ? 'true' : 'false'
      }
    });
    if (res?.success && res?.data) {
      mailboxes.value = Array.isArray(res.data.mailboxes) ? res.data.mailboxes : [];
      mailboxFlags.value = {
        canCreatePersonal: Boolean(res.data.flags?.canCreatePersonal),
        canDeletePersonal: Boolean(res.data.flags?.canDeletePersonal),
        canCreateGroup: Boolean(res.data.flags?.canCreateGroup),
        gmailIntegrationEnabled: Boolean(res.data.flags?.gmailIntegrationEnabled),
        gmailOAuthAppConfigured: Boolean(res.data.flags?.gmailOAuthAppConfigured)
      };
      if (gmailSidebarMailbox.value?.gmailInboxSync?.connected) {
        loadGmailLabelCatalog();
      }
      applyDefaultMailboxSelection();
    } else {
      mailboxes.value = [];
      mailboxesError.value = res?.message || 'Unable to load mailboxes';
    }
  } catch (err) {
    console.error('[Inbox] mailboxes:', err);
    mailboxes.value = [];
    mailboxesError.value = err?.response?.data?.message || err?.message || 'Unable to load mailboxes';
  } finally {
    mailboxesLoading.value = false;
  }
};

const deletePersonalMailbox = async () => {
  const mb = ownedPersonalMailbox.value;
  if (!mb?.id || !mailboxFlags.value.canDeletePersonal) return;
  const confirmed =
    typeof window !== 'undefined'
    && await confirmAction(t('inbox.mailboxDetailsRemovePersonalConfirm'));
  if (!confirmed) return;

  const deleteEmails =
    typeof window !== 'undefined'
    && await confirmAction(t('inbox.mailboxDetailsRemovePersonalDeleteEmailsConfirm'));

  mailboxActionLoading.value = true;
  try {
    const res = await apiClient(`/mailboxes/${encodeURIComponent(mb.id)}`, {
      method: 'DELETE',
      params: deleteEmails ? { deleteEmails: 'true' } : undefined
    });
    if (res?.success) {
      if (selectedMailboxFilter.value && String(selectedMailboxFilter.value) === String(mb.id)) {
        selectedMailboxFilter.value = null;
      }
      await fetchMailboxes();
      await fetchEmailThreads();
      const warn = Array.isArray(res.warnings) ? res.warnings[0] : null;
      if (warn) notifications.warning(warn);
      else if (deleteEmails) {
        notifications.success(t('inbox.mailboxDetailsRemovePersonalSuccessWithEmails'));
      } else {
        notifications.success(t('inbox.mailboxDetailsRemovePersonalSuccess'));
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('litedesk:mailbox-connected'));
      }
    } else {
      notifications.error(res?.message || t('inbox.mailboxDetailsRemovePersonalError'));
    }
  } catch (err) {
    notifications.error(
      err?.response?.data?.message || err?.message || t('inbox.mailboxDetailsRemovePersonalError')
    );
  } finally {
    mailboxActionLoading.value = false;
  }
};

const deleteGroupMailbox = async (mb) => {
  if (!mb?.id || mb.kind !== 'group' || !mailboxFlags.value.canCreateGroup) return;
  const confirmed =
    typeof window !== 'undefined'
    && await confirmAction(t('inbox.mailboxDetailsRemoveGroupConfirm'));
  if (!confirmed) return;

  mailboxActionLoading.value = true;
  try {
    const res = await apiClient(`/mailboxes/${encodeURIComponent(mb.id)}`, { method: 'DELETE' });
    if (res?.success) {
      if (selectedMailboxFilter.value && String(selectedMailboxFilter.value) === String(mb.id)) {
        selectedMailboxFilter.value = null;
      }
      await fetchMailboxes();
      await fetchEmailThreads();
      const warn = Array.isArray(res.warnings) ? res.warnings[0] : null;
      if (warn) notifications.warning(warn);
      else notifications.success(t('inbox.mailboxDetailsRemoveGroupSuccess'));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('litedesk:mailbox-connected'));
      }
    } else {
      notifications.error(res?.message || t('inbox.mailboxDetailsRemoveGroupError'));
    }
  } catch (err) {
    notifications.error(
      err?.response?.data?.message || err?.message || t('inbox.mailboxDetailsRemoveGroupError')
    );
  } finally {
    mailboxActionLoading.value = false;
  }
};

function buildWorkspaceThreadParams() {
  const params = {
    includeDone: emailIncludeDone.value ? 'true' : 'false'
  };
  if (selectedMailboxFilter.value) {
    params.mailboxId = selectedMailboxFilter.value;
  }
  if (selectedGmailLabelId.value && gmailSidebarMailbox.value) {
    params.gmailLabelId = selectedGmailLabelId.value;
    if (!params.mailboxId && gmailSidebarMailbox.value?.id) {
      params.mailboxId = gmailSidebarMailbox.value.id;
    }
  }
  const q = emailSearchInput.value.trim();
  if (q) {
    params.search = q;
  }
  return params;
}

function applyThreadCountsFromPayload(data) {
  if (!data || typeof data !== 'object') return;
  threadCounts.value = {
    all: Number(data.all) || 0,
    unread: Number(data.unread) || 0,
    sent: Number(data.sent) || 0,
    scheduled: Number(data.scheduled) || 0,
    assignedToMe: Number(data.assignedToMe) || 0,
    snoozed: Number(data.snoozed) || 0
  };
}

/**
 * Updates sidebar badges via GET workspace-thread-counts (no thread list reload).
 */
const fetchWorkspaceThreadCountsOnly = async ({ silent = true } = {}) => {
  if (threadCountsRefreshing.value) return;
  threadCountsRefreshing.value = true;
  try {
    const res = await apiClient('/communications/workspace-thread-counts', {
      method: 'GET',
      params: buildWorkspaceThreadParams()
    });
    if (res?.success && res?.data) {
      applyThreadCountsFromPayload(res.data);
    } else if (!silent) {
      notifications.error(res?.message || 'Could not refresh counts');
    }
  } catch (err) {
    console.error('[Inbox] workspace thread counts:', err);
    if (!silent) {
      notifications.error(err?.response?.data?.message || err?.message || 'Could not refresh counts');
    }
  } finally {
    threadCountsRefreshing.value = false;
  }
};

const fetchEmailThreads = async ({ append = false } = {}) => {
  if (append) {
    emailLoadingMore.value = true;
  } else {
    emailLoading.value = true;
    emailNextCursor.value = null;
    selectedThreadIds.value = [];
  }
  emailError.value = null;
  try {
    const params = {
      ...buildWorkspaceThreadParams(),
      filter: emailFilter.value,
      limit: 50
    };
    if (append && emailNextCursor.value) {
      params.cursor = emailNextCursor.value;
    }
    const res = await apiClient('/communications/workspace-threads', {
      method: 'GET',
      params
    });
    if (res?.success && Array.isArray(res?.data?.threads)) {
      if (append) {
        emailThreads.value = [...emailThreads.value, ...res.data.threads];
      } else {
        emailThreads.value = res.data.threads;
      }
      emailNextCursor.value = res.data.nextCursor || null;
      if (res.data.counts && typeof res.data.counts === 'object') {
        applyThreadCountsFromPayload(res.data.counts);
      }
    } else {
      if (!append) emailThreads.value = [];
      emailError.value = res?.message || 'Unable to load email threads';
    }
  } catch (err) {
    console.error('[Inbox] workspace threads:', err);
    if (!append) emailThreads.value = [];
    emailError.value = err?.response?.data?.message || err?.message || 'Unable to load email threads';
    notifications.error(emailError.value);
  } finally {
    if (!append) emailLoading.value = false;
    emailLoadingMore.value = false;
  }
};

function loadMoreEmailThreads() {
  if (!emailNextCursor.value || emailLoadingMore.value) return;
  return fetchEmailThreads({ append: true });
}

function refreshInboxThreadsAndCounts() {
  return fetchEmailThreads();
}

async function onEmailIncludeDoneChange() {
  await refreshInboxThreadsAndCounts();
  await fetchMailboxes();
}

function recordPathForEmailThread(row) {
  const rt = row?.relatedTo;
  if (!rt?.moduleKey || !rt?.recordId) return null;
  const m = String(rt.moduleKey).toLowerCase();
  if (m === 'workspace') return null;
  const id = String(rt.recordId);
  if (m === 'people') return `/people/${id}`;
  if (m === 'deals') return `/deals/${id}`;
  if (m === 'tasks') return `/tasks/${id}`;
  if (m === 'cases') return `/helpdesk/cases/${id}`;
  if (m === 'organizations') return `/organizations/${id}`;
  return null;
}

function openEmailThreadRecord(row) {
  if (!row?.threadId) return;
  const threadId = String(row.threadId);
  const alreadyOpen =
    openThreadRow.value && String(openThreadRow.value.threadId) === threadId;
  openThreadRow.value = row;
  if (!alreadyOpen) {
    setRouteThreadId(threadId);
    expandReaderPanel();
  }
}

function syncOpenThreadFromRoute() {
  const threadId = String(route.query.thread || '').trim();
  if (!threadId) {
    if (readerPanelMounted.value || openThreadRow.value) {
      collapseReaderPanel();
    }
    return;
  }
  if (openThreadRow.value && String(openThreadRow.value.threadId) === threadId) {
    if (!readerPanelExpanded.value) expandReaderPanel();
    return;
  }
  const match = emailThreads.value.find((r) => String(r.threadId) === threadId);
  openThreadRow.value = match || { threadId };
  expandReaderPanel();
}

function closeThreadReader() {
  collapseReaderPanel();
  setRouteThreadId(null);
}

function setRouteThreadId(value) {
  // Keep the URL in sync so back-button + refresh restore the same thread.
  const current = route.query.thread;
  if (value && String(current || '') === String(value)) return;
  if (!value && !current) return;
  const next = { ...route.query };
  if (value) next.thread = value;
  else delete next.thread;
  router.replace({ query: next });
}

async function toggleRowDone(row) {
  if (!row?.threadId) return;
  try {
    const res = await apiClient.patch(
      `/communications/threads/${encodeURIComponent(String(row.threadId))}/done`,
      { done: !row.done }
    );
    if (res?.success) {
      notifications.success(row.done ? 'Reopened' : 'Marked done');
      // The reader stays open even when the local `row.done` flag changes —
      // matches Gmail's "Archive" behavior where the thread remains visible.
      openThreadRow.value = { ...row, done: !row.done };
      await Promise.all([
        refreshInboxThreadsAndCounts(),
        fetchWorkspaceThreadCountsOnly({ silent: true })
      ]);
    } else {
      notifications.error(res?.message || 'Action failed');
    }
  } catch (err) {
    notifications.error(err?.response?.data?.message || err?.message || 'Action failed');
  }
}

async function assignRowToMe(row) {
  if (!row?.threadId) return;
  const uid = authStore.user?._id || authStore.user?.id;
  if (!uid) {
    notifications.error('Not signed in');
    return;
  }
  try {
    const res = await apiClient.patch(
      `/communications/threads/${encodeURIComponent(String(row.threadId))}/assign`,
      { assignedToUserId: uid }
    );
    if (res?.success) {
      notifications.success('Assigned to you');
      await refreshInboxThreadsAndCounts();
    } else {
      notifications.error(res?.message || 'Assign failed');
    }
  } catch (err) {
    notifications.error(err?.response?.data?.message || err?.message || 'Assign failed');
  }
}

function onReaderOpenRecord(row) {
  const path = recordPathForEmailThread(row);
  if (!path) {
    notifications.error('Cannot open this thread — unknown record type');
    return;
  }
  router.push(path);
}

function formatGmailStyleDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  if (startOfDay(d).getTime() === startOfDay(now).getTime()) {
    return formatTime(d, { hour: 'numeric', minute: '2-digit' });
  }
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 6);
  if (d >= startOfDay(weekAgo)) {
    return formatDate(d, { weekday: 'short' });
  }
  return formatDate(d, { month: 'short', day: 'numeric' });
}

function emailAvatarLetter(row) {
  const s = String(emailSenderLine(row) || row?.subject || '?').trim();
  const ch = s.charAt(0);
  return /[a-z0-9]/i.test(ch) ? ch.toUpperCase() : '?';
}

function emailSenderLine(row) {
  return threadListSenderLine(row?.participantDisplay, {
    recordLabel: row?.recordLabel,
    relatedModuleKey: row?.relatedTo?.moduleKey
  });
}

function emailSnippetLine(row) {
  if (row?.hasScheduledPending && row?.nextScheduledAt) {
    try {
      const when = new Intl.DateTimeFormat(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      }).format(new Date(row.nextScheduledAt));
      return t('inbox.inboxSurfaceScheduledSnippet', { when });
    } catch {
      return t('inbox.inboxSurfaceScheduledSnippet', { when: String(row.nextScheduledAt) });
    }
  }
  const blob = String(row?.searchBlob || '').trim();
  if (blob) {
    const preview = blob.slice(0, 140);
    return preview + (blob.length > 140 ? '…' : '');
  }
  const bits = [];
  if (row?.recordLabel && row.recordLabel !== '—') bits.push(String(row.recordLabel));
  if (row?.assignedToDisplay) bits.push(`→ ${row.assignedToDisplay}`);
  return bits.join(' · ') || '';
}

function emailRowClasses(row) {
  const isSelected =
    openThreadRow.value &&
    String(openThreadRow.value.threadId) === String(row?.threadId);
  if (isSelected) {
    return 'border-l-[3px] border-l-primary-600 bg-primary-50 dark:border-l-primary-500 dark:bg-primary-950/35';
  }
  const base = 'border-l-[3px] border-l-transparent hover:bg-neutral-50 dark:hover:bg-gray-800/90';
  if (row?.unread) {
    return `${base} bg-primary-50/40 dark:bg-primary-950/20`;
  }
  return `${base} bg-white dark:bg-gray-900`;
}

function emailAvatarClass(row) {
  if (row?.unread) {
    return 'bg-primary-100 text-primary-800 dark:bg-primary-900/50 dark:text-primary-200';
  }
  return 'bg-neutral-100 text-neutral-700 dark:bg-gray-700 dark:text-gray-100';
}

function inboxTagPillClass(tag) {
  const s = String(tag || '').toLowerCase();
  if (s.includes('todo') || s.includes('to-do')) {
    return 'bg-primary-100 text-primary-800 dark:bg-primary-900/50 dark:text-primary-200';
  }
  if (s.includes('newsletter')) {
    return 'bg-success-100 text-success-800 dark:bg-success-900/50 dark:text-success-200';
  }
  if (s.includes('reminder')) {
    return 'bg-warning-100 text-warning-800 dark:bg-warning-900/50 dark:text-warning-200';
  }
  return 'bg-neutral-100 text-neutral-700 dark:bg-gray-800 dark:text-gray-300';
}

let visibilityCountsTimer = null;
let inboxStreamRefreshTimer = null;

function shouldRefreshForInboxEvent(event) {
  if (!event?.mailboxId) return true;
  if (!selectedMailboxFilter.value) return true;
  return String(event.mailboxId) === String(selectedMailboxFilter.value);
}

function scheduleInboxStreamRefresh(event) {
  if (!shouldRefreshForInboxEvent(event)) return;
  if (inboxStreamRefreshTimer) clearTimeout(inboxStreamRefreshTimer);
  inboxStreamRefreshTimer = setTimeout(() => {
    inboxStreamRefreshTimer = null;
    void Promise.all([fetchEmailThreads(), fetchWorkspaceThreadCountsOnly({ silent: true })]);
  }, 350);
}

const inboxStream = createInboxStream({
  getToken: () => authStore.user?.token,
  onInboxUpdated: (event) => scheduleInboxStreamRefresh(event)
});

function onDocumentVisibilityChange() {
  if (document.visibilityState !== 'visible') return;
  if (visibilityCountsTimer) clearTimeout(visibilityCountsTimer);
  visibilityCountsTimer = setTimeout(() => {
    visibilityCountsTimer = null;
    fetchWorkspaceThreadCountsOnly({ silent: true });
  }, 400);
}

watch(
  () => route.query.thread,
  () => {
    syncOpenThreadFromRoute();
  }
);

onMounted(async () => {
  syncOpenThreadFromRoute();

  const tab = String(route.query.tab || '').toLowerCase();
  if (tab === 'attention') {
    router.replace({ path: '/platform/attention' });
    return;
  }
  await fetchMailboxes();
  if (gmailSidebarMailbox.value?.gmailInboxSync?.connected) {
    await loadGmailLabelCatalog();
  }
  consumeGmailOAuthQuery();
  await fetchEmailThreads();
  syncOpenThreadFromRoute();
  document.addEventListener('visibilitychange', onDocumentVisibilityChange);
  window.addEventListener('litedesk:mailbox-connected', onMailboxConnectedEvent);
  window.addEventListener('keydown', onInboxComposeShortcut);
  inboxStream.connect();
});

function onMailboxConnectedEvent() {
  void fetchMailboxes();
}

onUnmounted(() => {
  endReaderPanelResize({ persist: false });
  readerPanelExpanded.value = false;
  readerPanelMounted.value = false;
  openThreadRow.value = null;
  inboxStream.disconnect();
  document.removeEventListener('visibilitychange', onDocumentVisibilityChange);
  window.removeEventListener('litedesk:mailbox-connected', onMailboxConnectedEvent);
  window.removeEventListener('keydown', onInboxComposeShortcut);
  if (visibilityCountsTimer) clearTimeout(visibilityCountsTimer);
  if (inboxStreamRefreshTimer) clearTimeout(inboxStreamRefreshTimer);
  if (emailSearchDebounceTimer) clearTimeout(emailSearchDebounceTimer);
  cleanupGmailOAuthPopup();
});
</script>

<style scoped>
.inbox-reader-shell {
  width: 0;
  max-width: 0;
  transition: width 0.3s cubic-bezier(0.32, 0.72, 0, 1), max-width 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}

.inbox-reader-shell--no-transition {
  transition: none;
}

.inbox-reader-panel {
  opacity: 0;
  transition: opacity 0.22s ease 0.06s;
}

.inbox-reader-shell--open .inbox-reader-panel {
  opacity: 1;
}

.inbox-reader-shell--no-transition .inbox-reader-panel {
  transition: none;
}

.inbox-reader-resize-handle {
  cursor: col-resize;
}

.inbox-reader-resize-line {
  position: absolute;
  inset: 0 auto 0 50%;
  width: 1px;
  transform: translateX(-50%);
  background: transparent;
  transition: background-color 0.15s ease, width 0.15s ease;
}

.inbox-reader-resize-grip {
  position: relative;
  z-index: 1;
  display: flex;
  height: 2.75rem;
  width: 0.55rem;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  border-radius: 9999px;
  border: 1px solid transparent;
  background: transparent;
  opacity: 0;
  transition: opacity 0.15s ease, border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;
}

.inbox-reader-resize-grip span {
  display: block;
  height: 1rem;
  width: 2px;
  border-radius: 9999px;
  background: #9b9a97;
}

.inbox-reader-resize-handle:hover .inbox-reader-resize-line,
.inbox-reader-resize-handle--active .inbox-reader-resize-line {
  width: 2px;
  background: rgb(35 131 226 / 0.45);
}

.inbox-reader-resize-handle:hover .inbox-reader-resize-grip,
.inbox-reader-resize-handle--active .inbox-reader-resize-grip {
  opacity: 1;
  border-color: #ebebeb;
  background: #fff;
  box-shadow: 0 1px 4px rgb(0 0 0 / 0.08);
}

.inbox-reader-resize-handle--active .inbox-reader-resize-line {
  background: rgb(35 131 226 / 0.75);
}

.inbox-reader-resize-handle--active .inbox-reader-resize-grip span {
  background: #2383e2;
}

.inbox-context-rail {
  width: 2rem;
  flex-shrink: 0;
  transition: width 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}

.inbox-context-rail--open {
  width: var(--inbox-context-rail-width, 300px);
  min-width: var(--inbox-context-rail-width, 300px);
}
</style>

<style>
body.inbox-reader-resizing {
  cursor: col-resize !important;
  user-select: none !important;
}

body.inbox-reader-resizing * {
  cursor: col-resize !important;
}
</style>
