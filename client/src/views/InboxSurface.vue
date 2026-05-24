<template>
  <div class="w-full min-w-0 max-w-none">
    <div
      v-if="showInboxGetStarted"
      class="mx-3 my-6 min-h-[min(70vh,640px)] rounded-xl border border-gray-200/90 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900/95 sm:mx-4 lg:mx-6 lg:my-8"
    >
      <div v-if="mailboxesLoading" class="flex items-center justify-center py-24">
        <div class="h-9 w-9 animate-spin rounded-full border-2 border-gray-200 border-t-emerald-600 dark:border-gray-700 dark:border-t-emerald-400" />
      </div>
      <InboxGetStarted
        v-else
        :gmail-oauth-ready="gmailOAuthReady"
        :inbound-parser-mode="!mailboxFlags.gmailIntegrationEnabled"
        :connect-loading="gmailSyncLoading"
        @connect-mailbox="openConnectInboxModal"
        @setup-group="onGetStartedGroupSetup"
        @coming-soon="onGetStartedComingSoon"
      />
    </div>

    <div
      v-else
      class="flex flex-col gap-4 px-3 py-6 sm:px-4 lg:flex-row lg:items-stretch lg:gap-0 lg:px-6 lg:py-8"
    >
    <!-- Gmail-style left rail: scopes + mailboxes + primary folders -->
    <aside
      class="flex max-h-[min(70vh,520px)] w-full shrink-0 flex-col overflow-hidden rounded-xl border border-gray-200/90 bg-[#f6f8fc] shadow-sm dark:border-gray-700 dark:bg-gray-900/95 lg:max-h-none lg:w-56 lg:rounded-r-none lg:rounded-l-xl lg:border-r-0 xl:w-60"
      :aria-label="t('inbox.inboxSurfaceMailFoldersAndMailboxes')"
    >
      <div class="flex items-center justify-between gap-2 border-b border-gray-200/80 px-3 py-2.5 dark:border-gray-700/80">
        <span class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ t('inbox.inboxSurfaceMail') }}</span>
        <div class="flex items-center gap-0.5">
          <button
            type="button"
            class="rounded-md p-1.5 text-gray-600 hover:bg-gray-200/80 dark:text-gray-400 dark:hover:bg-gray-800"
            :title="t('inbox.inboxSurfaceComposeWorkspaceEmail')"
            @click="openNewCompose"
          >
            <PencilSquareIcon class="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="rounded-md p-1.5 text-gray-600 hover:bg-gray-200/80 dark:text-gray-400 dark:hover:bg-gray-800"
            :title="t('inbox.inboxSurfaceRefreshMailboxes')"
            :disabled="mailboxesLoading"
            @click="fetchMailboxes"
          >
            <ArrowPathIcon class="h-4 w-4" :class="{ 'animate-spin': mailboxesLoading }" />
          </button>
        </div>
      </div>

      <nav class="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-1.5 pb-2 pt-1" :aria-label="t('inbox.inboxSurfaceMailNavigation')">
        <button
          type="button"
          class="flex w-full items-center gap-3 rounded-e-full py-2 pl-3 pr-2 text-left text-sm transition-colors"
          :class="sidebarScopeActive(null)"
          @click="selectMailboxFilter(null)"
        >
          <InboxIcon class="h-5 w-5 shrink-0 opacity-90" aria-hidden="true" />
          <span class="min-w-0 flex-1 truncate font-medium">{{ t('inbox.inboxSurfaceAllMail') }}</span>
          <span
            v-if="selectedMailboxFilter === null && threadCounts.unread > 0"
            class="shrink-0 rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white dark:bg-blue-500"
          >{{ threadCounts.unread }}</span>
        </button>

        <div class="mt-3 px-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-500">{{ t('inbox.inboxSurfaceMailboxes') }}</div>
        <div v-if="mailboxesLoading" class="px-2 py-2 text-xs text-gray-500 dark:text-gray-400">{{ t('states.loading') }}</div>
        <p v-else-if="mailboxesError" class="px-2 py-1 text-xs text-amber-700 dark:text-amber-300">
          {{ mailboxesError }}
        </p>
        <template v-else-if="mailboxes.length">
          <button
            v-for="mb in mailboxes"
            :key="mb.id"
            type="button"
            class="flex w-full items-start gap-2 rounded-e-full py-2 pl-3 pr-2 text-left text-sm transition-colors"
            :class="sidebarScopeActive(mb.id)"
            @click="selectMailboxFilter(mb.id)"
          >
            <EnvelopeIcon
              v-if="mb.kind === 'personal'"
              class="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400"
              aria-hidden="true"
            />
            <UserGroupIcon
              v-else
              class="mt-0.5 h-5 w-5 shrink-0 text-violet-600 dark:text-violet-400"
              aria-hidden="true"
            />
            <span class="min-w-0 flex-1">
              <span class="block truncate font-medium leading-snug text-gray-900 dark:text-white">{{ mb.label }}</span>
              <span
                v-if="mb.emailAddress"
                class="mt-0.5 block truncate text-[11px] text-gray-500 dark:text-gray-400"
              >{{ mb.emailAddress }}</span>
              <span class="mt-0.5 block text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">{{ formatMailboxSyncStatus(mb) }}</span>
            </span>
            <span
              v-if="Number(mb.threadUnreadCount) > 0"
              class="mt-0.5 shrink-0 self-start rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white dark:bg-blue-500"
            >{{ mb.threadUnreadCount }}</span>
            <button
              v-if="mailboxFlags.gmailIntegrationEnabled && mb.kind === 'group' && mailboxFlags.canCreateGroup && !mb.gmailInboxSync?.connected"
              type="button"
              class="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase text-violet-700 hover:bg-violet-100 dark:text-violet-300 dark:hover:bg-violet-900/50"
              :title="t('inbox.inboxSurfaceConnectGmailForThisSharedInbox')"
              @click.stop="openConnectGroupGmail(mb)"
            >{{ t('inbox.inboxSurfaceConnect') }}</button>
            <button
              v-else-if="!mailboxFlags.gmailIntegrationEnabled && !mb.inboundParser?.routingAddress && (mb.kind === 'personal' || (mb.kind === 'group' && mailboxFlags.canCreateGroup))"
              type="button"
              class="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
              title="Get your unique forwarding address"
              @click.stop="openMailboxForwardingSetup(mb)"
            >
              Connect
            </button>
            <button
              v-else-if="mb.kind === 'group' && mailboxFlags.canCreateGroup"
              type="button"
              class="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase text-violet-700 hover:bg-violet-100 dark:text-violet-300 dark:hover:bg-violet-900/50"
              @click.stop="openMembersModal(mb)"
            >{{ t('settings.groupsLabelMembers') }}</button>
          </button>
        </template>
        <p v-else class="px-2 py-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{{ t('inbox.inboxSurfaceNoMailboxesYetAddOneBelow') }}</p>

        <div class="mt-4 flex items-center justify-between gap-1 px-1.5">
          <div class="px-0.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-500">{{ t('forms.rtColorPrimary') }}</div>
          <button
            type="button"
            class="rounded-md p-1 text-gray-500 hover:bg-gray-200/80 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            :title="t('inbox.inboxSurfaceRefreshFolderCountsOnlyDoesNot')"
            :aria-label="t('inbox.inboxSurfaceRefreshFolderCounts')"
            :disabled="threadCountsRefreshing"
            @click="fetchWorkspaceThreadCountsOnly({ silent: false })"
          >
            <ArrowPathIcon class="h-3.5 w-3.5" :class="{ 'animate-spin': threadCountsRefreshing }" />
          </button>
        </div>
        <button
          v-for="opt in emailFilterOptions"
          :key="'folder-' + opt.value"
          type="button"
          class="flex w-full items-center gap-3 rounded-e-full py-2 pl-3 pr-2 text-left text-sm transition-colors"
          :class="sidebarFolderActive(opt.value)"
          @click="setEmailFilter(opt.value)"
        >
          <span class="min-w-0 flex-1 truncate font-medium">{{ opt.label }}</span>
          <span
            v-if="folderCountBadge(opt.value) > 0"
            class="shrink-0 rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white dark:bg-blue-500"
          >{{ folderCountBadge(opt.value) }}</span>
        </button>

        <template v-if="mailboxFlags.gmailIntegrationEnabled && gmailSidebarFolders.length">
          <div class="mt-4 px-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-500">{{ t('inbox.inboxSurfaceGmailFolders') }}</div>
          <p v-if="gmailLabelsLoading" class="px-3 py-1 text-xs text-gray-500 dark:text-gray-400">{{ t('inbox.inboxSurfaceLoadingFolders') }}</p>
          <button
            v-for="folder in gmailSidebarFolders"
            :key="'gmail-folder-' + folder.id"
            type="button"
            class="flex w-full items-center gap-2 rounded-e-full py-2 pl-3 pr-2 text-left text-sm transition-colors"
            :class="sidebarGmailLabelActive(folder.id)"
            @click="selectGmailLabel(folder.id)"
          >
            <FolderIcon class="h-4 w-4 shrink-0 opacity-75" aria-hidden="true" />
            <span class="min-w-0 flex-1 truncate font-medium">{{ folder.label }}</span>
          </button>
        </template>

        <div class="mt-auto border-t border-gray-200/80 pt-3 dark:border-gray-700/80">
          <div class="flex flex-col gap-2 px-1.5">
            <button
              v-if="mailboxFlags.canCreatePersonal"
              type="button"
              class="w-full rounded-lg border border-gray-300/80 bg-white py-2 text-center text-xs font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-800"
              :disabled="mailboxActionLoading"
              @click="createPersonalMailbox"
            >
              + Personal mailbox
            </button>
            <button
              v-else-if="mailboxFlags.canDeletePersonal && ownedPersonalMailbox"
              type="button"
              class="w-full rounded-lg border border-red-200/90 bg-white py-2 text-center text-xs font-medium text-red-800 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:bg-gray-950 dark:text-red-200 dark:hover:bg-red-950/40"
              :disabled="mailboxActionLoading"
              @click="deletePersonalMailbox"
            >
              Remove personal mailbox
            </button>
            <button
              v-if="mailboxFlags.canCreateGroup"
              type="button"
              class="w-full rounded-lg border border-violet-200 bg-violet-50 py-2 text-center text-xs font-medium text-violet-900 hover:bg-violet-100 disabled:opacity-50 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-100 dark:hover:bg-violet-900/30"
              :disabled="mailboxActionLoading"
              @click="showGroupMailboxForm = !showGroupMailboxForm"
            >
              {{ showGroupMailboxForm ? 'Cancel new group' : '+ Group mailbox' }}
            </button>
          </div>
          <div
            v-if="showGroupMailboxForm && mailboxFlags.canCreateGroup"
            class="mt-3 space-y-2 border-t border-gray-200/60 px-2 pt-3 dark:border-gray-700/60"
          >
            <label class="block text-[11px] font-medium text-gray-600 dark:text-gray-300">{{ t('settings.settingsBhFieldName') }}<input
                v-model="newGroupMailboxLabel"
                type="text"
                class="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-950 dark:text-white"
                :placeholder="t('inbox.inboxSurfaceEGSupport')"
                autocomplete="off"
              >
            </label>
            <label class="block text-[11px] font-medium text-gray-600 dark:text-gray-300">{{ t('inbox.inboxSurfaceAddressOptional') }}<input
                v-model="newGroupMailboxEmail"
                type="email"
                class="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-gray-950 dark:text-white"
                :placeholder="t('inbox.inboxSurfaceContactUs')"
                autocomplete="off"
              >
            </label>
            <button
              type="button"
              class="w-full rounded-lg bg-violet-600 py-2 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
              :disabled="mailboxActionLoading || !newGroupMailboxLabel.trim()"
              @click="createGroupMailbox"
            >{{ t('settings.roleDrawerPermCreate') }}</button>
          </div>
          <div class="mt-3 space-y-1.5 border-t border-gray-200/60 px-2 py-3 dark:border-gray-700/60">
            <RouterLink
              :to="{ path: '/settings', query: { tab: 'integrations' } }"
              class="block text-xs font-medium text-blue-700 hover:underline dark:text-blue-400"
            >
              Email &amp; inbound settings
            </RouterLink>
            <p class="text-[10px] leading-relaxed text-gray-500 dark:text-gray-500">
              Shared mailboxes: admins connect Gmail for support@ addresses. Personal mailboxes sync your own inbox.
            </p>
          </div>
        </div>
      </nav>
    </aside>

    <!-- Main list (Gmail-style content pane) -->
    <div class="min-w-0 flex-1 lg:pl-1">
      <div class="mb-4 lg:mb-5">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">{{ t('navigation.inbox') }}</h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('inbox.inboxSurfaceOpenAThreadOnItsRecord') }}</p>
      </div>

      <div
        v-if="!openThreadRow"
        class="overflow-hidden rounded-xl border border-gray-200/90 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900/95 lg:rounded-l-none lg:rounded-r-xl"
      >
      <!-- Toolbar -->
      <div class="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-gray-50/90 px-2 py-2 dark:border-gray-700 dark:bg-gray-800/80">
        <button
          type="button"
          class="inline-flex h-10 w-10 items-center justify-center rounded-full text-gray-600 hover:bg-gray-200/80 dark:text-gray-300 dark:hover:bg-gray-700"
          :title="t('inbox.inboxSurfaceReloadThreadList2')"
          :aria-label="t('inbox.inboxSurfaceReloadThreadList')"
          :disabled="emailLoading"
          @click="refreshInboxThreadsAndCounts"
        >
          <ArrowPathIcon class="h-5 w-5" :class="{ 'animate-spin': emailLoading }" />
        </button>
        <button
          type="button"
          class="inline-flex h-10 w-10 items-center justify-center rounded-full text-gray-600 hover:bg-gray-200/80 dark:text-gray-300 dark:hover:bg-gray-700"
          :title="t('inbox.inboxSurfaceRefreshFolderCountsOnly2')"
          :aria-label="t('inbox.inboxSurfaceRefreshFolderCountsOnly')"
          :disabled="threadCountsRefreshing || emailLoading"
          @click="fetchWorkspaceThreadCountsOnly({ silent: false })"
        >
          <HashtagIcon class="h-5 w-5" :class="{ 'animate-pulse opacity-60': threadCountsRefreshing }" />
        </button>
        <div
          class="hidden h-8 w-px bg-gray-300 sm:block dark:bg-gray-600"
          aria-hidden="true"
        />
        <div
          class="relative mx-1 flex min-w-[12rem] flex-1 max-w-none items-center"
          role="search"
        >
          <MagnifyingGlassIcon
            class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500"
            aria-hidden="true"
          />
          <input
            v-model="emailSearchInput"
            type="search"
            enterkeyhint="search"
            class="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-9 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-blue-400 dark:focus:ring-blue-400"
            :placeholder="t('inbox.inboxSurfaceSearchSubjectBodyPeopleLabels')"
            autocomplete="off"
            :aria-label="t('inbox.inboxSurfaceSearchMail')"
            @input="scheduleEmailSearch"
          />
          <button
            v-if="emailSearchInput.trim()"
            type="button"
            class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            :title="t('records.activityClearSearchAria')"
            :aria-label="t('records.activityClearSearchAria')"
            @click="clearEmailSearch"
          >
            <XMarkIcon class="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div class="ml-auto flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
          <RouterLink
            :to="{ path: '/settings', query: { tab: 'integrations' } }"
            class="inline-flex items-center rounded-lg px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-200/80 dark:text-gray-300 dark:hover:bg-gray-700"
          >{{ t('inbox.inboxSurfaceEmailSetup') }}</RouterLink>
          <label class="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap px-2 text-xs text-gray-600 dark:text-gray-400">
            <input
              v-model="emailIncludeDone"
              type="checkbox"
              class="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900"
              @change="onEmailIncludeDoneChange"
            />{{ t('inbox.inboxSurfaceDone3') }}</label>
        </div>
      </div>

      <div
        v-if="mailboxFlags.gmailIntegrationEnabled && selectedMailbox && selectedMailbox.gmailSmtpOutbound?.connected && !selectedMailbox.gmailInboxSync?.connected"
        class="border-b border-emerald-200 bg-emerald-50/90 px-3 py-2.5 text-xs text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/25 dark:text-emerald-100"
      >
        <div class="font-semibold text-emerald-900 dark:text-emerald-100">
          Gmail SMTP send — {{ selectedMailbox.kind === 'group' ? 'Shared' : 'Personal' }}
        </div>
        <p class="mt-1 text-[11px] leading-snug text-emerald-800/90 dark:text-emerald-200/90">{{ t('inbox.inboxSurfaceOutboundEmailUsesYourGoogleApp') }}<strong>{{ t('inbox.inboxSurfaceGmailOauth') }}</strong>{{ t('inbox.inboxSurfaceToImportAndReadMailIn') }}</p>
        <div class="mt-1 text-[11px] text-emerald-800 dark:text-emerald-200">{{ t('inbox.inboxSurfaceSendingAs') }}<span class="font-mono">{{ selectedMailbox.emailAddress || '—' }}</span>
        </div>
      </div>

      <div
        v-if="!mailboxFlags.gmailIntegrationEnabled && selectedMailbox?.inboundParser?.routingAddress"
        class="border-b border-emerald-200 bg-emerald-50/90 px-4 py-3 text-xs text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/25 dark:text-emerald-100"
      >
        <div class="font-semibold">Forward mail to this address</div>
        <p class="mt-1 font-mono text-[11px] break-all select-all">
          {{ selectedMailbox.inboundParser.routingAddress }}
        </p>
        <p v-if="selectedMailbox.inboundParser.forwardingHint" class="mt-1 leading-snug opacity-90">
          {{ selectedMailbox.inboundParser.forwardingHint }}
        </p>
        <p class="mt-1 leading-snug opacity-80">
          Set up forwarding in Gmail or Microsoft 365 for
          <span class="font-medium">{{ selectedMailbox.emailAddress || selectedMailbox.label }}</span>.
          Replies from the CRM use your organization’s outbound email settings.
        </p>
        <button
          v-if="selectedMailbox.kind === 'personal' && mailboxFlags.canDeletePersonal"
          type="button"
          class="mt-2 text-[11px] font-medium text-red-800 underline hover:no-underline dark:text-red-200"
          :disabled="mailboxActionLoading"
          @click="deletePersonalMailbox"
        >
          Remove personal mailbox
        </button>
      </div>

      <div
        v-else-if="!mailboxFlags.gmailIntegrationEnabled && selectedMailbox"
        class="border-b border-blue-200 bg-blue-50/90 px-4 py-3 text-xs text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/25 dark:text-blue-100"
      >
        <div class="font-semibold">Inbound via Arivu Inbound Parser</div>
        <p v-if="selectedMailbox.inboundParser?.provisioningError" class="mt-1 leading-snug text-amber-900 dark:text-amber-100">
          Routing address is not ready yet: {{ selectedMailbox.inboundParser.provisioningError }}
        </p>
        <p v-else class="mt-1 leading-snug">
          Create or select a mailbox to get a forwarding address. Your administrator configures the parser connection in Control Plane.
        </p>
      </div>

      <div
        v-else-if="mailboxFlags.gmailIntegrationEnabled && selectedMailbox && !selectedMailbox.gmailInboxSync?.connected && !selectedMailbox.gmailSmtpOutbound?.connected"
        class="border-b border-gray-200 bg-gradient-to-b from-slate-50 to-white px-4 py-6 dark:border-gray-700 dark:from-gray-900 dark:to-gray-900/95 sm:px-6"
      >
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white sm:text-xl">{{ t('inbox.inboxSurfaceConnectYourInboxToLitedesk') }}</h2>
        <p class="mt-1 max-w-2xl text-sm text-gray-600 dark:text-gray-400">
          Link your work email provider to sync mail into Arivu and send from the CRM. Gmail is available today; Outlook, Yahoo, and IMAP are on the roadmap.
        </p>
        <p class="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-500">{{ t('inbox.inboxSurfaceSelectYourEmailProvider') }}</p>
        <div class="mt-3 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
          <button
            type="button"
            class="group flex flex-col items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 text-center shadow-sm transition hover:border-emerald-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-55 dark:border-gray-700 dark:bg-gray-950 dark:hover:border-emerald-800"
            :disabled="gmailSyncLoading"
            :title="!gmailOAuthReady ? 'Open setup: add GOOGLE_GMAIL_* on the API, then connect' : 'Connect Gmail'"
            @click="onGmailProviderClick"
          >
            <span
              class="flex h-14 w-14 items-center justify-center rounded-xl bg-white text-2xl font-bold leading-none text-white shadow-inner ring-1 ring-gray-100 dark:ring-gray-800"
              style="background: conic-gradient(from -45deg, #ea4335, #fbbc05, #34a853, #4285f4, #ea4335)"
              aria-hidden="true"
            >
              <span class="drop-shadow-sm">G</span>
            </span>
            <span class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('inbox.inboxSurfaceGmail') }}</span>
          </button>
          <div
            class="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-gray-200 bg-gray-50/80 p-4 text-center dark:border-gray-700 dark:bg-gray-900/40"
          >
            <span class="flex h-14 w-14 items-center justify-center rounded-xl bg-[#0078d4] text-lg font-bold text-white">
              O
            </span>
            <span class="text-sm font-medium text-gray-500 dark:text-gray-500">{{ t('inbox.inboxSurfaceOutlook') }}</span>
            <span class="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-600">{{ t('inbox.inboxSurfaceSoon3') }}</span>
          </div>
          <div
            class="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-gray-200 bg-gray-50/80 p-4 text-center dark:border-gray-700 dark:bg-gray-900/40"
          >
            <span class="flex h-14 w-14 items-center justify-center rounded-xl bg-[#6001d2] text-lg font-bold text-white">
              Y
            </span>
            <span class="text-sm font-medium text-gray-500 dark:text-gray-500">{{ t('inbox.inboxSurfaceYahoo') }}</span>
            <span class="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-600">{{ t('inbox.inboxSurfaceSoon2') }}</span>
          </div>
          <div
            class="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-gray-200 bg-gray-50/80 p-4 text-center dark:border-gray-700 dark:bg-gray-900/40"
          >
            <EnvelopeIcon class="h-10 w-10 text-gray-400 dark:text-gray-600" aria-hidden="true" />
            <span class="text-sm font-medium text-gray-500 dark:text-gray-500">{{ t('inbox.inboxSurfaceImap') }}</span>
            <span class="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-600">{{ t('inbox.inboxSurfaceSoon') }}</span>
          </div>
        </div>
        <p
          v-if="!gmailOAuthReady"
          class="mt-4 max-w-2xl rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
        >
          Gmail isn’t enabled on this API yet (missing <code class="rounded bg-amber-100 px-1 font-mono text-[10px] dark:bg-amber-950/80">GOOGLE_GMAIL_*</code>{{ t('inbox.inboxSurfaceOnTheServer') }}<span class="mt-1 block font-medium text-amber-950 dark:text-amber-50">{{ t('inbox.inboxSurfaceClickTheGmailTileAbove') }}</span>{{ t('inbox.inboxSurfaceForCopyPasteStepsOrAsk') }}</p>
      </div>

      <div
        v-else-if="mailboxFlags.gmailIntegrationEnabled && selectedMailbox && selectedMailbox.gmailInboxSync?.connected"
        class="border-b border-violet-200 bg-violet-50/90 px-3 py-2.5 text-xs text-violet-950 dark:border-violet-900/60 dark:bg-violet-950/25 dark:text-violet-100"
      >
        <div class="font-semibold text-violet-900 dark:text-violet-100">
          Gmail inbox sync — {{ selectedMailbox.kind === 'group' ? 'Shared' : 'Personal' }}
        </div>
        <p class="mt-1 text-[11px] leading-snug text-violet-800/90 dark:text-violet-200/90">
          <template v-if="selectedMailbox.kind === 'group'">
            Shared mailbox linked to Google. Mail syncs on a schedule; use Sync now for an immediate pull.
          </template>
          <template v-else>{{ t('inbox.inboxSurfacePersonalMailboxLinkedToGoogleGmail') }}</template>{{ t('inbox.inboxSurfaceBackgroundSyncRunsAutomatically') }}</p>
        <div class="mt-1 text-[11px] text-violet-800 dark:text-violet-200">{{ t('inbox.inboxSurfaceConnectedAs') }}<span class="font-mono">{{ selectedMailbox.gmailInboxSync.accountEmail || '—' }}</span>
          <span v-if="selectedMailbox.gmailInboxSync.lastSyncAt" class="ml-2 text-violet-700 dark:text-violet-300">
            · Last sync {{ formatShortSyncTime(selectedMailbox.gmailInboxSync.lastSyncAt) }}
          </span>
        </div>
        <p v-if="selectedMailbox.gmailInboxSync?.lastError" class="mt-1 text-[11px] text-amber-800 dark:text-amber-200">
          {{ selectedMailbox.gmailInboxSync.lastError }}
        </p>
        <div class="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-lg border border-violet-300 bg-white px-3 py-1.5 text-xs font-medium text-violet-900 hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-950 dark:text-violet-100 dark:hover:bg-violet-900/40"
            :disabled="gmailSyncLoading"
            @click="gmailFolderModalOpen = true"
          >{{ t('inbox.inboxSurfaceSelectFoldersToSync') }}</button>
          <button
            type="button"
            class="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            :disabled="gmailSyncLoading"
            @click="runGmailInboxSync"
          >
            {{ gmailSyncLoading ? 'Syncing…' : 'Sync now' }}
          </button>
          <button
            type="button"
            class="rounded-lg border border-violet-300 bg-white px-3 py-1.5 text-xs font-medium text-violet-900 hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-950 dark:text-violet-100 dark:hover:bg-violet-900/40"
            :disabled="gmailSyncLoading"
            @click="disconnectGmail"
          >{{ t('appointments.disconnect') }}</button>
        </div>
      </div>

      <div
        v-if="selectedThreadIds.length > 0"
        class="flex flex-wrap items-center gap-2 border-b border-blue-200 bg-blue-50/90 px-2 py-2 dark:border-blue-900/50 dark:bg-blue-950/30"
      >
        <span class="text-xs font-medium text-blue-900 dark:text-blue-100">{{ selectedThreadIds.length }} selected</span>
        <button
          type="button"
          class="rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          @click="bulkMarkDone(true)"
        >{{ t('inbox.inboxSurfaceMarkDone') }}</button>
        <button
          type="button"
          class="rounded-lg border border-blue-300 bg-white px-2.5 py-1.5 text-xs font-medium text-blue-900 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-100 dark:hover:bg-blue-900"
          @click="bulkMarkDone(false)"
        >{{ t('inbox.inboxSurfaceReopen') }}</button>
        <button
          type="button"
          class="rounded-lg border border-blue-300 bg-white px-2.5 py-1.5 text-xs font-medium text-blue-900 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-100 dark:hover:bg-blue-900"
          @click="bulkAssignToMe"
        >{{ t('common.formAssignToMe') }}</button>
        <button
          type="button"
          class="rounded-lg border border-blue-300 bg-white px-2.5 py-1.5 text-xs font-medium text-blue-900 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-100 dark:hover:bg-blue-900"
          @click="bulkPromptAddTag"
        >{{ t('forms.fieldAddTagPh') }}</button>
        <button
          type="button"
          class="rounded-lg border border-blue-300 bg-white px-2.5 py-1.5 text-xs font-medium text-blue-900 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-100 dark:hover:bg-blue-900"
          @click="bulkPromptRemoveTag"
        >{{ t('inbox.inboxSurfaceRemoveTag') }}</button>
        <button
          type="button"
          class="rounded-lg border border-blue-300 bg-white px-2.5 py-1.5 text-xs font-medium text-blue-900 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-100 dark:hover:bg-blue-900"
          @click="bulkSnoozeTomorrow"
        >{{ t('inbox.inboxSurfaceSnoozeToTomorrow') }}</button>
        <button
          type="button"
          class="ml-auto text-xs font-medium text-blue-800 underline dark:text-blue-300"
          @click="clearThreadSelection"
        >{{ t('settings.modFieldsClear') }}</button>
      </div>

      <div
        class="hidden grid-cols-[40px_40px_1fr] items-center gap-0 border-b border-gray-100 bg-gray-50/50 px-1 py-1.5 text-xs font-medium text-gray-500 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-400 sm:grid sm:pl-2"
      >
        <span class="flex justify-center">
          <input
            type="checkbox"
            class="rounded border-gray-300 text-blue-600 dark:border-gray-600"
            :checked="allVisibleSelected"
            :title="t('inbox.inboxSurfaceSelectAllInView')"
            :aria-label="t('inbox.inboxSurfaceSelectAllConversationsInThisView')"
            @change="toggleSelectAllVisible($event.target.checked)"
          />
        </span>
        <span />
        <span class="flex min-w-0 items-center gap-2 pl-1">
          <span class="truncate">{{ t('forms.rtColorPrimary') }}</span>
          <button
            type="button"
            class="shrink-0 rounded-md border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            :title="t('inbox.inboxSurfaceSelectUpTo500ThreadsMatching')"
            @click="selectAllInFolder"
          >{{ t('inbox.inboxSurfaceSelectAllInFolder') }}</button>
        </span>
      </div>

      <div v-if="emailLoading" class="flex items-center justify-center py-16">
        <div class="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600 dark:border-gray-700 dark:border-t-blue-400" />
      </div>
      <div v-else-if="emailError" class="border-b border-amber-100 bg-amber-50 px-4 py-3 dark:border-amber-900/30 dark:bg-amber-950/30">
        <p class="text-sm text-amber-900 dark:text-amber-200">{{ emailError }}</p>
      </div>
      <div
        v-else-if="emailThreads.length === 0"
        class="px-4 py-16 text-center sm:px-8"
      >
        <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t('inbox.inboxSurfaceNoConversationsInThisView') }}</p>
        <p class="mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">{{ t('inbox.inboxSurfaceWhenMailIsLinkedToRecords') }}<RouterLink
            :to="{ path: '/settings', query: { tab: 'integrations' } }"
            class="font-medium text-blue-600 hover:underline dark:text-blue-400"
          >{{ t('settings.integrationsTitle') }}</RouterLink>
          .
        </p>
      </div>
      <ul v-else class="divide-y divide-gray-100 dark:divide-gray-800" role="list">
        <li
          v-for="row in emailThreads"
          :key="row.threadId"
          role="button"
          tabindex="0"
          class="flex min-h-[56px] cursor-pointer items-stretch transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
          :class="emailRowClasses(row)"
          @click="openEmailThreadRecord(row)"
          @keydown.enter="openEmailThreadRecord(row)"
          @keydown.space.prevent="openEmailThreadRecord(row)"
        >
          <div
            class="flex w-11 shrink-0 items-center justify-center pl-1"
            @click.stop
          >
            <input
              type="checkbox"
              class="rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900"
              :aria-label="`Select ${row.subject}`"
              tabindex="-1"
              :checked="selectedThreadIds.includes(String(row.threadId))"
              @click.stop
              @change="toggleThreadSelected(String(row.threadId), $event.target.checked)"
            />
          </div>
          <div class="flex w-11 shrink-0 items-center justify-center py-2 pr-1">
            <span
              class="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold uppercase text-gray-700 shadow-sm ring-1 ring-gray-200/80 dark:text-gray-100 dark:ring-gray-600"
              :class="row.unread ? 'bg-blue-100 dark:bg-blue-900/50' : 'bg-gray-100 dark:bg-gray-700'"
            >
              {{ emailAvatarLetter(row) }}
            </span>
          </div>
          <div class="flex min-w-0 flex-1 flex-col justify-center py-2 pr-3 pl-0.5">
            <div class="flex min-w-0 items-center gap-2">
              <span
                class="min-w-0 flex-1 truncate text-sm"
                :class="row.unread
                  ? 'font-semibold text-gray-900 dark:text-gray-50'
                  : 'font-medium text-gray-800 dark:text-gray-200'"
              >
                {{ emailSenderLine(row) }}
              </span>
              <span
                v-if="row.done"
                class="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500 ring-1 ring-gray-200 dark:text-gray-400 dark:ring-gray-600"
              >{{ t('inbox.inboxSurfaceDone2') }}</span>
              <time
                class="shrink-0 text-xs tabular-nums text-gray-500 dark:text-gray-400"
                :datetime="row.lastActivityAt || row.firstActivityAt"
              >
                {{ formatGmailStyleDate(row.lastActivityAt || row.firstActivityAt) }}
              </time>
            </div>
            <div class="mt-0.5 flex min-w-0 items-baseline gap-1 text-sm">
              <span
                class="min-w-0 truncate"
                :class="row.unread
                  ? 'font-semibold text-gray-900 dark:text-gray-50'
                  : 'text-gray-700 dark:text-gray-300'"
              >
                {{ row.subject || '(no subject)' }}
              </span>
              <span class="shrink-0 text-gray-400 dark:text-gray-500">—</span>
              <span class="min-w-0 flex-1 truncate text-gray-500 dark:text-gray-400">
                {{ emailSnippetLine(row) }}
              </span>
            </div>
          </div>
          <div
            class="hidden shrink-0 flex-col items-stretch justify-center gap-1 border-l border-gray-100 py-1.5 pl-2 pr-2 dark:border-gray-800 sm:flex"
            @click.stop
          >
            <button
              type="button"
              class="rounded px-2 py-1 text-left text-[11px] font-medium text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40"
              @click="openReplyCompose(row)"
            >{{ t('records.activityReply') }}</button>
            <button
              type="button"
              class="rounded px-2 py-1 text-left text-[11px] font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              @click="snoozeRowTomorrow(row)"
            >{{ t('inbox.inboxSurfaceSnooze1d') }}</button>
          </div>
        </li>
      </ul>
      <div
        v-if="emailNextCursor && emailThreads.length > 0 && !emailLoading"
        class="border-t border-gray-100 px-3 py-3 text-center dark:border-gray-800"
      >
        <button
          type="button"
          class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
          :disabled="emailLoadingMore"
          @click="loadMoreEmailThreads"
        >
          {{ emailLoadingMore ? 'Loading…' : 'Load more' }}
        </button>
      </div>
    </div>

      <EmailThreadReader
        v-else
        :key="String(openThreadRow.threadId)"
        :thread-id="String(openThreadRow.threadId)"
        :thread-row="openThreadRow"
        :record-path="openThreadRecordPath"
        class="overflow-hidden rounded-xl border border-gray-200/90 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900/95 lg:rounded-l-none lg:rounded-r-xl"
        @close="closeThreadReader"
        @reply="openReplyCompose($event)"
        @forward="openReplyCompose($event.row)"
        @toggle-done="toggleRowDone($event)"
        @snooze="snoozeRowTomorrow($event)"
        @assign-to-me="assignRowToMe($event)"
        @open-record="onReaderOpenRecord($event)"
      />
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

    <GmailMailboxFolderModal
      v-model="gmailFolderModalOpen"
      :mailbox-id="gmailFolderModalMailboxId"
      @saved="onGmailFolderModalSaved"
    />

    <EmailComposeDrawer
      :key="composeRow?.threadId || 'new-compose'"
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
              Google requires a registered OAuth app. LiteDesk never puts the client secret in the browser—you add it
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

const { t } = useI18n();
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import apiClient from '@/utils/apiClient';
import { getApiOrigin } from '@/config/apiBase';
import { useAuthStore } from '@/stores/authRegistry';
import { useNotifications } from '@/composables/useNotifications';
import {
  ArrowPathIcon,
  EnvelopeIcon,
  FolderIcon,
  HashtagIcon,
  InboxIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  UserGroupIcon,
  XMarkIcon
} from '@heroicons/vue/24/outline';
import EmailComposeDrawer from '@/components/communications/EmailComposeDrawer.vue';
import ConnectInboxWizard from '@/components/inbox/ConnectInboxWizard.vue';
import InboxGetStarted from '@/components/inbox/InboxGetStarted.vue';
import GmailMailboxFolderModal from '@/components/inbox/GmailMailboxFolderModal.vue';
import EmailThreadReader from '@/components/inbox/EmailThreadReader.vue';
import { useConnectMailboxPrompt } from '@/composables/useConnectMailboxPrompt';
import { isMailboxConnectedForProvider } from '@/constants/inboxProviders';
import { isInboxShellUnblocked, formatMailboxInboundStatus } from '@/utils/mailboxInboundStatus';
import { createInboxStream } from '@/composables/useInboxStream';
import { shouldPromptGmailReconnect, gmailReconnectMessage } from '@/utils/gmailConnectErrors';

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
const showGroupMailboxForm = ref(false);
const newGroupMailboxLabel = ref('');
const newGroupMailboxEmail = ref('');
const selectedMailboxFilter = ref(null);
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
/** When set, compose drawer is replying to this thread row (otherwise new standalone message). */
const composeRow = ref(null);

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
  return 'Connect Gmail or Gmail SMTP in Inbox to send from your mailbox.';
});

const composeInitialDraftForDrawer = computed(() => {
  if (!composeRow.value) return null;
  const row = composeRow.value;
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

const openThreadRecordPath = computed(() => recordPathForEmailThread(openThreadRow.value) || '');

const allVisibleSelected = computed(() => {
  const rows = emailThreads.value;
  if (!rows.length) return false;
  return rows.every((r) => selectedThreadIds.value.includes(String(r.threadId)));
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

const threadCounts = ref({ all: 0, unread: 0, assignedToMe: 0, snoozed: 0 });
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

const emailFilterOptions = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'assigned_to_me', label: 'Assigned to me' },
  { value: 'snoozed', label: 'Snoozed' }
];

function setEmailFilter(value) {
  emailFilter.value = value;
  selectedThreadIds.value = [];
  refreshInboxThreadsAndCounts();
}

function sidebarScopeActive(mailboxId) {
  const active = selectedMailboxFilter.value === mailboxId;
  return active
    ? 'bg-blue-200/80 font-medium text-blue-950 dark:bg-blue-950/70 dark:text-blue-50'
    : 'text-gray-800 hover:bg-gray-200/70 dark:text-gray-200 dark:hover:bg-gray-800/70';
}

function sidebarFolderActive(filterValue) {
  const active = emailFilter.value === filterValue;
  return active
    ? 'bg-blue-200/80 font-medium text-blue-950 dark:bg-blue-950/70 dark:text-blue-50'
    : 'text-gray-800 hover:bg-gray-200/70 dark:text-gray-200 dark:hover:bg-gray-800/70';
}

function selectMailboxFilter(mailboxId) {
  selectedMailboxFilter.value = mailboxId;
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
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
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
  if (typeof window !== 'undefined' && !window.confirm('Disconnect Gmail from this mailbox?')) return;
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
  if (mailboxesLoading.value) return false;
  return !isInboxShellUnblocked(mailboxes.value, mailboxFlags.value);
});

function onGetStartedGroupSetup() {
  if (!mailboxFlags.value.canCreateGroup) {
    notifications.warning('Only admins can set up shared mailboxes.');
    return;
  }
  promptConnectMailbox('inbox', { mailboxKind: 'group' });
}

function onGetStartedComingSoon() {
  notifications.info(t('inbox.inboxIntegrationComingSoon'));
}

function openNewCompose() {
  composeRow.value = null;
  composeDrawerOpen.value = true;
}

function openReplyCompose(row) {
  if (!row) return;
  composeRow.value = row;
  composeDrawerOpen.value = true;
}

function closeComposeDrawer() {
  composeDrawerOpen.value = false;
  composeRow.value = null;
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

async function submitCompose(payload) {
  try {
    const body = { ...payload };
    const mb = composeRow.value?.mailboxId || selectedMailboxFilter.value;
    if (mb) body.mailboxId = mb;
    const res = await apiClient.post('/communications/email', body);
    if (res?.success) {
      notifications.success(res?.queued ? 'Email queued' : 'Email sent');
      closeComposeDrawer();
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

const createPersonalMailbox = async () => {
  mailboxActionLoading.value = true;
  try {
    const res = await apiClient('/mailboxes', {
      method: 'POST',
      body: JSON.stringify({ kind: 'personal', label: 'My work inbox' })
    });
    if (res?.success) {
      await fetchMailboxes();
      notifications.success('Personal mailbox created');
    } else {
      notifications.error(res?.message || 'Could not create mailbox');
    }
  } catch (err) {
    const msg = err?.response?.data?.message || err?.message || 'Could not create mailbox';
    notifications.error(msg);
  } finally {
    mailboxActionLoading.value = false;
  }
};

const deletePersonalMailbox = async () => {
  const mb = ownedPersonalMailbox.value;
  if (!mb?.id || !mailboxFlags.value.canDeletePersonal) return;
  const confirmed =
    typeof window !== 'undefined'
    && window.confirm(
      'Remove your personal mailbox?\n\nExisting conversations stay in the inbox but are no longer tied to this mailbox. Turn off email forwarding in Gmail or Microsoft 365 if you configured it.'
    );
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
      else notifications.success('Personal mailbox removed');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('litedesk:mailbox-connected'));
      }
    } else {
      notifications.error(res?.message || 'Could not remove personal mailbox');
    }
  } catch (err) {
    notifications.error(
      err?.response?.data?.message || err?.message || 'Could not remove personal mailbox'
    );
  } finally {
    mailboxActionLoading.value = false;
  }
};

const createGroupMailbox = async () => {
  const label = newGroupMailboxLabel.value.trim();
  if (!label) return;
  mailboxActionLoading.value = true;
  try {
    const body = {
      kind: 'group',
      label,
      emailAddress: newGroupMailboxEmail.value.trim() || undefined
    };
    const res = await apiClient('/mailboxes', { method: 'POST', body: JSON.stringify(body) });
    if (res?.success) {
      newGroupMailboxLabel.value = '';
      newGroupMailboxEmail.value = '';
      showGroupMailboxForm.value = false;
      await fetchMailboxes();
      notifications.success('Group mailbox created');
    } else {
      notifications.error(res?.message || 'Could not create group mailbox');
    }
  } catch (err) {
    const msg = err?.response?.data?.message || err?.message || 'Could not create group mailbox';
    notifications.error(msg);
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
  // Gmail-style: always open the thread inline in the reader (workspace
  // threads, record-tied threads, both). The "Go to record" action inside the
  // reader is still available for jumping to the record context.
  openThreadRow.value = row;
  setRouteThreadId(String(row.threadId));
}

function closeThreadReader() {
  openThreadRow.value = null;
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
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 6);
  if (d >= startOfDay(weekAgo)) {
    return d.toLocaleDateString(undefined, { weekday: 'short' });
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function emailAvatarLetter(row) {
  const s = String(emailSenderLine(row) || row?.subject || '?').trim();
  const ch = s.charAt(0);
  return /[a-z0-9]/i.test(ch) ? ch.toUpperCase() : '?';
}

function emailSenderLine(row) {
  const p = String(row?.participantDisplay || '').trim();
  if (!p) return 'Unknown';
  const parts = p.split(/\s*↔\s*/);
  if (parts.length >= 2) {
    const a = parts[0].trim();
    const b = parts[1].trim();
    if (/^you$/i.test(a)) return b;
    if (/^you$/i.test(b)) return a;
    return a || b;
  }
  return p;
}

function emailSnippetLine(row) {
  const bits = [];
  if (row?.recordLabel) bits.push(String(row.recordLabel));
  if (row?.relatedTo?.moduleKey) {
    const mk = String(row.relatedTo.moduleKey).toLowerCase();
    bits.push(mk === 'workspace' ? 'Workspace mail' : String(row.relatedTo.moduleKey));
  }
  if (row?.messageCount != null) bits.push(`${row.messageCount} in thread`);
  if (row?.assignedToDisplay) bits.push(`→ ${row.assignedToDisplay}`);
  return bits.join(' · ') || 'Open to view in activity';
}

function emailRowClasses(row) {
  const base = 'hover:bg-[#f1f3f4] dark:hover:bg-gray-800/90';
  if (row?.unread) {
    return `${base} bg-[#f2f6fc] dark:bg-slate-800/70`;
  }
  return `${base} bg-white dark:bg-gray-900`;
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

onMounted(async () => {
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
  // Restore the reader on refresh / deep link (?thread=<id>). Try to match the
  // id against the just-fetched thread list so the reader has full row data
  // for its header. If we don't find a row (e.g. paginated past), still open
  // the reader with a minimal row — it fetches its own messages anyway.
  const initialThreadId = String(route.query.thread || '').trim();
  if (initialThreadId) {
    const match = emailThreads.value.find((r) => String(r.threadId) === initialThreadId);
    openThreadRow.value = match || { threadId: initialThreadId };
  }
  document.addEventListener('visibilitychange', onDocumentVisibilityChange);
  window.addEventListener('litedesk:mailbox-connected', onMailboxConnectedEvent);
  inboxStream.connect();
});

function onMailboxConnectedEvent() {
  void fetchMailboxes();
}

onUnmounted(() => {
  inboxStream.disconnect();
  document.removeEventListener('visibilitychange', onDocumentVisibilityChange);
  window.removeEventListener('litedesk:mailbox-connected', onMailboxConnectedEvent);
  if (visibilityCountsTimer) clearTimeout(visibilityCountsTimer);
  if (inboxStreamRefreshTimer) clearTimeout(inboxStreamRefreshTimer);
  if (emailSearchDebounceTimer) clearTimeout(emailSearchDebounceTimer);
  cleanupGmailOAuthPopup();
});
</script>
