<template>
  <div class="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-neutral-50 dark:bg-neutral-950">
    <div class="flex min-h-0 flex-1 overflow-hidden">
    <!-- Sidebar: full-width list on mobile; fixed column on md+ -->
    <aside
      class="h-full w-full shrink-0 flex-col border-r border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 md:w-[280px]"
      :class="mobileShowConversation ? 'hidden md:flex' : 'flex'"
    >
      <div class="flex items-center justify-between px-3 py-2.5">
        <div class="flex min-w-0 items-center gap-2">
          <h1 class="text-sm font-semibold text-neutral-900 dark:text-white">
            {{ t('internalChat.pageHeading') }}
          </h1>
          <span
            class="h-2 w-2 shrink-0 rounded-full"
            :class="streamLive ? 'bg-success-500' : 'bg-neutral-400 dark:bg-neutral-600'"
            :title="streamLive ? t('internalChat.streamConnected') : t('internalChat.streamDisconnected')"
          />
        </div>
        <div class="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            class="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            :title="t('internalChat.settings')"
            @click="openSettings"
          >
            <Cog6ToothIcon class="h-4 w-4" />
          </button>
          <button
            type="button"
            class="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            :title="t('internalChat.newChannel')"
            @click="showChannelModal = true"
          >
            <PlusIcon class="h-4 w-4" />
          </button>
          <button
            type="button"
            class="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            :title="t('internalChat.newDm')"
            @click="showDmModal = true"
          >
            <ChatBubbleOvalLeftEllipsisIcon class="h-4 w-4" />
          </button>
        </div>
      </div>

      <div class="px-3 pb-2">
        <div class="relative">
          <MagnifyingGlassIcon class="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
          <input
            v-model="spaceFilter"
            type="search"
            class="w-full rounded-lg border border-neutral-200 bg-neutral-50 py-1.5 pl-8 pr-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:placeholder:text-neutral-500 dark:focus:bg-neutral-900"
            :placeholder="t('internalChat.spaceFilterPlaceholder')"
          >
        </div>
      </div>

      <div class="min-h-0 flex-1 overflow-auto px-2 pb-2">
        <div
          v-if="loadingSpaces"
          class="space-y-2 px-1 py-1"
        >
          <div
            v-for="n in 6"
            :key="n"
            class="h-8 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800"
          />
        </div>

        <template v-else-if="spaces.length">
          <!-- Direct messages (always shown) -->
          <section class="mb-3">
            <div class="flex items-center justify-between px-2 py-1">
              <span class="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                {{ t('internalChat.directsSection') }}
              </span>
              <button
                type="button"
                class="rounded p-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
                :title="t('internalChat.newDm')"
                @click="showDmModal = true"
              >
                <PlusIcon class="h-3.5 w-3.5" />
              </button>
            </div>
            <ul
              v-if="directSpaces.length"
              class="space-y-0.5"
            >
              <li
                v-for="space in directSpaces"
                :key="space._id"
              >
                <button
                  type="button"
                  class="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-neutral-800 hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-800"
                  :class="isSpaceSelected(space) ? 'bg-primary-50 font-medium text-primary-900 dark:bg-primary-950/30 dark:text-primary-100' : ''"
                  @click="selectSpace(space._id)"
                >
                  <span class="flex min-w-0 items-center gap-2">
                    <AvatarInitials
                      v-bind="spaceAvatarProps(space)"
                      size="sm"
                    />
                    <span class="truncate">{{ spaceDisplayName(space) }}</span>
                  </span>
                  <span
                    v-if="space.unreadCount > 0"
                    class="inline-flex min-w-[1.125rem] shrink-0 items-center justify-center rounded-full bg-primary-600 px-1.5 text-[10px] font-semibold text-white"
                  >
                    {{ space.unreadCount > 99 ? '99+' : space.unreadCount }}
                  </span>
                </button>
              </li>
            </ul>
            <button
              v-else
              type="button"
              class="mx-1 flex w-[calc(100%-0.5rem)] items-center gap-2 rounded-lg border border-dashed border-neutral-200 px-2.5 py-2 text-left text-xs text-neutral-500 hover:border-primary-300 hover:bg-primary-50/50 hover:text-primary-700 dark:border-neutral-700 dark:hover:border-primary-700 dark:hover:bg-primary-950/20 dark:hover:text-primary-300"
              @click="showDmModal = true"
            >
              <PlusIcon class="h-3.5 w-3.5 shrink-0" />
              {{ t('internalChat.newDm') }}
            </button>
          </section>

          <!-- Channels -->
          <section
            v-if="channelSpaces.length"
            class="mb-3"
          >
            <div class="flex items-center justify-between px-2 py-1">
              <span class="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                {{ t('internalChat.channelsSection') }}
              </span>
              <button
                type="button"
                class="rounded p-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
                :title="t('internalChat.newChannel')"
                @click="showChannelModal = true"
              >
                <PlusIcon class="h-3.5 w-3.5" />
              </button>
            </div>
            <ul class="space-y-0.5">
              <li
                v-for="space in channelSpaces"
                :key="space._id"
              >
                <button
                  type="button"
                  class="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-neutral-800 hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-800"
                  :class="isSpaceSelected(space) ? 'bg-primary-50 font-medium text-primary-900 dark:bg-primary-950/30 dark:text-primary-100' : ''"
                  @click="selectSpace(space._id)"
                >
                  <span class="flex min-w-0 items-center gap-2">
                    <LockClosedIcon
                      v-if="space.isPrivate"
                      class="h-3.5 w-3.5 shrink-0 text-neutral-400"
                    />
                    <HashtagIcon
                      v-else
                      class="h-3.5 w-3.5 shrink-0 text-neutral-400"
                    />
                    <span
                      class="truncate"
                      :class="space.canJoin ? 'text-neutral-500' : ''"
                    >{{ spaceDisplayName(space) }}</span>
                  </span>
                  <span
                    v-if="space.canJoin"
                    class="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-400"
                  >
                    {{ t('internalChat.join') }}
                  </span>
                  <span
                    v-else-if="space.unreadCount > 0"
                    class="inline-flex min-w-[1.125rem] shrink-0 items-center justify-center rounded-full bg-primary-600 px-1.5 text-[10px] font-semibold text-white"
                  >
                    {{ space.unreadCount > 99 ? '99+' : space.unreadCount }}
                  </span>
                </button>
              </li>
            </ul>
          </section>

          <!-- Records -->
          <section
            v-if="recordSpaces.length"
            class="mb-3"
          >
            <div class="px-2 py-1">
              <span class="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                {{ t('internalChat.recordsSection') }}
              </span>
            </div>
            <ul class="space-y-0.5">
              <li
                v-for="space in recordSpaces"
                :key="space._id"
              >
                <button
                  type="button"
                  class="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-neutral-800 hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-800"
                  :class="isSpaceSelected(space) ? 'bg-primary-50 dark:bg-primary-950/30' : ''"
                  @click="selectSpace(space._id)"
                >
                  <span class="flex min-w-0 items-center gap-2">
                    <Avatar
                      :user="{ firstName: spaceDisplayName(space) }"
                      :icon="HashtagIcon"
                      size="sm"
                    />
                    <span class="truncate">{{ spaceDisplayName(space) }}</span>
                  </span>
                  <span
                    v-if="space.unreadCount > 0"
                    class="inline-flex min-w-[1.125rem] shrink-0 items-center justify-center rounded-full bg-primary-600 px-1.5 text-[10px] font-semibold text-white"
                  >
                    {{ space.unreadCount > 99 ? '99+' : space.unreadCount }}
                  </span>
                </button>
              </li>
            </ul>
          </section>

          <p
            v-if="!directSpaces.length && !channelSpaces.length && !recordSpaces.length"
            class="px-2 py-4 text-sm text-neutral-500 dark:text-neutral-400"
          >
            {{ t('internalChat.noSpacesYet') }}
          </p>
        </template>

        <p
          v-else
          class="px-2 py-4 text-sm text-neutral-500 dark:text-neutral-400"
        >
          {{ t('internalChat.noSpacesYet') }}
        </p>
      </div>
    </aside>

    <!-- Main pane: full-width conversation on mobile when a space is open -->
    <main
      class="h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white dark:bg-neutral-950"
      :class="mobileShowConversation ? 'flex' : 'hidden md:flex'"
    >
      <div
        v-if="error"
        class="m-3 rounded-xl border border-danger-200 bg-danger-50 p-3 text-sm text-danger-800 dark:border-danger-800 dark:bg-danger-950/40 dark:text-danger-200"
      >
        {{ error }}
      </div>

      <template v-else-if="loadingSpaces">
        <div class="flex h-14 shrink-0 items-center gap-3 border-b border-neutral-200 px-4 dark:border-neutral-800">
          <div class="h-8 w-8 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-800" />
          <div class="space-y-1.5">
            <div class="h-3.5 w-32 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
            <div class="h-2.5 w-20 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
          </div>
        </div>
        <div class="min-h-0 flex-1 space-y-3 px-4 py-4">
          <div
            v-for="n in 6"
            :key="n"
            class="flex gap-2"
          >
            <div class="h-8 w-8 shrink-0 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-800" />
            <div class="flex-1 space-y-1.5 pt-0.5">
              <div class="h-3 w-28 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
              <div class="h-4 w-3/4 max-w-sm animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
            </div>
          </div>
        </div>
      </template>

      <template v-else-if="!selectedSpace">
        <div class="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
          <ChatBubbleOvalLeftEllipsisIcon class="mb-4 h-12 w-12 text-neutral-300 dark:text-neutral-600" />
          <h2 class="text-base font-semibold text-neutral-900 dark:text-white">
            {{ t('internalChat.emptyHeading') }}
          </h2>
          <p class="mt-2 max-w-sm text-sm text-neutral-500 dark:text-neutral-400">
            {{ t('internalChat.emptyBody') }}
          </p>
        </div>
      </template>

      <template v-else>
        <!-- Conversation header -->
        <div class="flex h-14 shrink-0 items-center gap-2 border-b border-neutral-200 px-3 dark:border-neutral-800 sm:gap-3 sm:px-4">
          <button
            type="button"
            class="shrink-0 rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 md:hidden dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            :title="t('actions.back')"
            :aria-label="t('actions.back')"
            @click="backToMobileList"
          >
            <ArrowLeftIcon class="h-5 w-5" />
          </button>
          <Avatar
            v-if="selectedSpace.type === 'channel' || selectedSpace.type === 'record'"
            :user="{ firstName: spaceDisplayName(selectedSpace) }"
            :icon="HashtagIcon"
            size="sm"
          />
          <AvatarInitials
            v-else
            v-bind="spaceAvatarProps(selectedSpace)"
            size="sm"
          />
          <div class="min-w-0 flex-1">
            <h2 class="truncate text-sm font-semibold text-neutral-900 dark:text-white">
              {{ spaceDisplayName(selectedSpace) }}
            </h2>
            <p
              v-if="selectedSpace.topic"
              class="truncate text-xs text-neutral-500 dark:text-neutral-400"
            >
              {{ selectedSpace.topic }}
            </p>
            <p
              v-else-if="selectedSpace.type === 'record'"
              class="truncate text-xs text-neutral-500 dark:text-neutral-400"
            >
              {{ t('internalChat.recordSpaceHint', { module: selectedSpace.moduleKey }) }}
            </p>
            <p
              v-else-if="presenceLabel"
              class="truncate text-xs text-neutral-500 dark:text-neutral-400"
            >
              {{ presenceLabel }}
            </p>
          </div>
          <div
            v-if="presenceViewers.length"
            class="hidden items-center -space-x-1.5 sm:flex"
          >
            <AvatarInitials
              v-for="viewer in presenceViewers.slice(0, 4)"
              :key="viewer.userId"
              v-bind="personAvatarProps(presenceAvatarUser(viewer))"
              size="sm"
              class="ring-2 ring-white dark:ring-neutral-900"
            />
          </div>
          <button
            v-if="selectedSpace.type === 'channel' && selectedSpace.isMember !== false"
            type="button"
            class="shrink-0 rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            :title="t('internalChat.inviteMembers')"
            @click="openInviteModal"
          >
            <UserPlusIcon class="h-4 w-4" />
          </button>
          <div class="relative min-w-0 shrink sm:shrink-0">
            <MagnifyingGlassIcon class="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
            <input
              v-model="searchQuery"
              type="search"
              class="w-28 rounded-lg border border-neutral-200 bg-neutral-50 py-1 pl-7 pr-2 text-xs text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white sm:w-40"
              :placeholder="t('internalChat.searchPlaceholder')"
              @input="onSearchInput"
              @keydown.enter.prevent="runSearch"
            >
          </div>
          <button
            type="button"
            class="hidden shrink-0 rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 sm:inline-flex dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            :title="t('internalChat.exportTranscript')"
            @click="downloadExport"
          >
            <ArrowDownTrayIcon class="h-4 w-4" />
          </button>
        </div>

        <!-- Search results (cross-space / API hits) -->
        <div
          v-if="searchQuery.trim().length >= 2 && (conversationMatchIds.size || searchResults.length)"
          class="shrink-0 border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/50"
        >
          <div class="mx-auto w-full max-w-4xl px-3 py-2 sm:px-6 md:px-10 lg:px-14">
          <div class="mb-1 flex items-center justify-between gap-2">
            <span class="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
              {{ t('internalChat.searchMatchCount', { count: conversationMatchIds.size || searchResults.length }) }}
            </span>
            <button
              type="button"
              class="text-xs text-primary-600 dark:text-primary-400"
              @click="clearSearch"
            >
              {{ t('internalChat.clearSearch') }}
            </button>
          </div>
          <ul
            v-if="searchResults.length"
            class="max-h-36 space-y-0.5 overflow-auto"
          >
            <li
              v-for="hit in searchResults"
              :key="hit._id"
            >
              <button
                type="button"
                class="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-xs hover:bg-neutral-200 dark:hover:bg-neutral-800"
                :class="String(focusedSearchMessageId) === String(hit._id) ? 'bg-amber-100 dark:bg-amber-950/40' : ''"
                @click="jumpToSearchHit(hit)"
              >
                <AvatarInitials
                  v-bind="personAvatarProps(hit.author || { firstName: hit.space?.name || '?' })"
                  size="sm"
                />
                <span class="min-w-0">
                  <span class="font-medium text-neutral-800 dark:text-neutral-100">
                    {{ hit.space?.name || spaceDisplayName(hit.space) || '…' }}
                  </span>
                  <span class="ml-1 text-neutral-500">{{ truncate(hit.body, 80) }}</span>
                </span>
              </button>
            </li>
          </ul>
          </div>
        </div>

        <!-- Messages -->
        <div
          ref="messageListEl"
          class="min-h-0 flex-1 overflow-auto"
        >
          <div class="mx-auto flex min-h-full w-full max-w-4xl flex-col justify-end px-3 pb-3 pt-6 sm:px-6 sm:pt-10 md:px-10 lg:px-14">
            <div
              v-if="loadingMessages"
              class="space-y-3"
            >
              <div
                v-for="n in 4"
                :key="n"
                class="flex gap-2"
              >
                <div class="h-8 w-8 shrink-0 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-800" />
                <div class="flex-1 space-y-1.5 pt-0.5">
                  <div class="h-3 w-24 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
                  <div class="h-4 w-2/3 max-w-xs animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
                </div>
              </div>
            </div>

            <template v-else-if="messages.length">
              <div
                v-for="msg in messages"
                :key="msg._id"
                :data-message-id="msg._id"
                class="group flex w-full py-1.5"
                :class="isOwnMessage(msg) ? 'justify-end' : 'justify-start'"
              >
                <div
                  class="flex max-w-[min(92%,22rem)] gap-2 sm:max-w-[min(85%,32rem)]"
                  :class="isOwnMessage(msg) ? 'flex-row-reverse' : 'flex-row'"
                >
                  <AvatarInitials
                    v-bind="authorAvatarProps(msg)"
                    size="sm"
                    class="mt-5 shrink-0"
                  />
                  <div
                    class="min-w-0"
                    :class="isOwnMessage(msg) ? 'text-right' : 'text-left'"
                  >
                    <div
                      class="mb-0.5 flex items-baseline gap-1.5"
                      :class="isOwnMessage(msg) ? 'justify-end' : 'justify-start'"
                    >
                      <span
                        v-if="!isOwnMessage(msg)"
                        class="text-xs font-semibold text-neutral-700 dark:text-neutral-200"
                      >
                        {{ authorLabel(msg) }}
                      </span>
                      <span class="text-[11px] text-neutral-400 dark:text-neutral-500">
                        {{ formatTime(msg.createdAt) }}
                      </span>
                    </div>

                    <div
                      class="relative inline-block max-w-full text-left"
                      :class="isOwnMessage(msg) ? 'ml-auto' : ''"
                    >
                      <div
                        class="absolute bottom-[calc(100%+4px)] z-20 flex items-center gap-0.5 rounded-lg border border-neutral-200 bg-white p-0.5 opacity-0 shadow-md transition-opacity group-hover:opacity-100 dark:border-neutral-600 dark:bg-neutral-800"
                        :class="isOwnMessage(msg) ? 'right-0' : 'left-0'"
                      >
                        <button
                          v-if="!threadRootId"
                          type="button"
                          class="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                          :title="t('internalChat.replyInThread')"
                          @click="openThread(msg)"
                        >
                          <ChatBubbleLeftIcon class="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          class="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                          :title="isPinned(msg) ? t('internalChat.unpin') : t('internalChat.pin')"
                          @click="togglePin(msg)"
                        >
                          <BookmarkIcon class="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          class="rounded-md p-1.5 text-neutral-500 hover:bg-danger-50 hover:text-danger-600 dark:text-neutral-300 dark:hover:bg-danger-950/40 dark:hover:text-danger-400"
                          :title="t('actions.delete')"
                          @click="removeMessage(msg)"
                        >
                          <TrashIcon class="h-3.5 w-3.5" />
                        </button>
                        <span class="mx-0.5 h-3 w-px bg-neutral-200 dark:bg-neutral-600" />
                        <button
                          v-for="emoji in quickEmojis.slice(0, 3)"
                          :key="`hover-${emoji}`"
                          type="button"
                          class="rounded-md px-1 py-0.5 text-sm leading-none hover:bg-neutral-100 dark:hover:bg-neutral-700"
                          @click="react(msg, emoji)"
                        >
                          {{ emoji }}
                        </button>
                      </div>

                      <div
                        class="rounded-2xl px-3 py-2 text-sm leading-snug shadow-sm"
                        :class="isOwnMessage(msg)
                          ? 'rounded-br-md bg-primary-600 text-white'
                          : 'rounded-bl-md bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100'"
                      >
                        <p class="whitespace-pre-wrap break-words">
                          <template
                            v-for="(part, partIdx) in highlightParts(msg.body, searchQuery)"
                            :key="`${msg._id}-p-${partIdx}`"
                          >
                            <mark
                              v-if="part.hit"
                              class="rounded-sm px-0.5"
                              :class="isOwnMessage(msg)
                                ? 'bg-white/35 text-white'
                                : 'bg-amber-200 text-neutral-900 dark:bg-amber-500/40 dark:text-amber-50'"
                            >{{ part.text }}</mark>
                            <template v-else>{{ part.text }}</template>
                          </template>
                        </p>
                        <div
                          v-if="msg.attachments?.length"
                          class="mt-1.5 flex flex-wrap gap-1.5"
                        >
                          <a
                            v-for="(att, aidx) in msg.attachments"
                            :key="aidx"
                            :href="att.url || '#'"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs"
                            :class="isOwnMessage(msg)
                              ? 'bg-white/15 text-white hover:bg-white/25'
                              : 'border border-neutral-200 bg-white text-primary-700 dark:border-neutral-600 dark:bg-neutral-900 dark:text-primary-300'"
                          >
                            <PaperClipIcon class="h-3 w-3" />
                            {{ att.fileName }}
                          </a>
                        </div>
                      </div>
                    </div>

                    <div
                      v-if="msg.reactions?.length"
                      class="mt-1 flex flex-wrap items-center gap-1"
                      :class="isOwnMessage(msg) ? 'justify-end' : 'justify-start'"
                    >
                      <button
                        v-for="r in msg.reactions"
                        :key="r.emoji"
                        type="button"
                        class="inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-xs"
                        :class="r.reacted
                          ? 'border-primary-300 bg-primary-50 text-primary-800 dark:border-primary-700 dark:bg-primary-950/40 dark:text-primary-200'
                          : 'border-neutral-200 bg-white text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300'"
                        @click="react(msg, r.emoji)"
                      >
                        <span>{{ r.emoji }}</span>
                        <span>{{ r.count }}</span>
                      </button>
                    </div>
                    <div
                      v-if="msg.recordRefs?.length"
                      class="mt-1 flex flex-wrap gap-1"
                      :class="isOwnMessage(msg) ? 'justify-end' : 'justify-start'"
                    >
                      <span
                        v-for="(ref, idx) in msg.recordRefs"
                        :key="idx"
                        class="rounded bg-neutral-200 px-1.5 py-0.5 text-xs text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                      >
                        {{ ref.label || `${ref.moduleKey}` }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <div
              v-else
              class="flex flex-1 flex-col items-center justify-center py-12 text-center"
            >
              <ChatBubbleOvalLeftEllipsisIcon class="mb-3 h-10 w-10 text-neutral-300 dark:text-neutral-600" />
              <p class="text-sm text-neutral-500 dark:text-neutral-400">
                {{ t('internalChat.noMessages') }}
              </p>
            </div>
          </div>
        </div>

        <!-- Composer area -->
        <div class="mx-auto w-full max-w-4xl shrink-0 px-3 pb-3 sm:px-6 sm:pb-4 md:px-10 lg:px-14">
          <p
            v-if="typingLabel"
            class="mb-1.5 px-1 text-xs text-neutral-500 dark:text-neutral-400"
          >
            {{ typingLabel }}
          </p>

          <div
            v-if="threadRootId"
            class="mb-2 flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 dark:border-neutral-700 dark:bg-neutral-900/60"
          >
            <span class="text-xs font-medium text-neutral-600 dark:text-neutral-300">
              {{ t('internalChat.threadOpen') }}
            </span>
            <button
              type="button"
              class="text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400"
              @click="closeThread"
            >
              {{ t('internalChat.closeThread') }}
            </button>
          </div>

          <form @submit.prevent="submitMessage">
            <div
              class="rounded-2xl border border-neutral-200 bg-white shadow-sm transition-shadow focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-900 dark:focus-within:border-primary-600"
            >
              <div
                v-if="pendingAttachments.length"
                class="flex flex-wrap gap-1.5 border-b border-neutral-100 px-3 py-2 dark:border-neutral-800"
              >
                <span
                  v-for="(att, idx) in pendingAttachments"
                  :key="idx"
                  class="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                >
                  {{ att.fileName }}
                  <button
                    type="button"
                    class="text-neutral-400 hover:text-danger-600"
                    @click="pendingAttachments.splice(idx, 1)"
                  >
                    ×
                  </button>
                </span>
              </div>

              <label class="sr-only" for="internal-chat-composer">{{ t('internalChat.composerLabel') }}</label>
              <div class="relative">
                <textarea
                  id="internal-chat-composer"
                  v-model="draft"
                  rows="2"
                  class="w-full resize-none border-0 bg-transparent px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-0 dark:text-white dark:placeholder:text-neutral-500"
                  :placeholder="composerPlaceholder"
                  @keydown.enter.exact.prevent="submitMessage"
                  @input="onComposerInput"
                />
                <ul
                  v-if="mentionSuggestions.length"
                  class="absolute bottom-full left-2 z-10 mb-1 max-h-40 w-64 overflow-auto rounded-xl border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
                >
                  <li
                    v-for="u in mentionSuggestions"
                    :key="u._id"
                  >
                    <button
                      type="button"
                      class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      @click="insertMention(u)"
                    >
                      <AvatarInitials v-bind="personAvatarProps(u)" size="sm" />
                      <span class="truncate">{{ userLabel(u) }}</span>
                    </button>
                  </li>
                </ul>
              </div>

              <div class="flex items-center justify-between px-2 pb-2">
                <div>
                  <input
                    ref="fileInputEl"
                    type="file"
                    class="hidden"
                    @change="onFileSelected"
                  >
                  <button
                    type="button"
                    class="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-50 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                    :disabled="uploading || !selectedSpaceId"
                    :title="t('internalChat.attach')"
                    @click="fileInputEl?.click()"
                  >
                    <PaperClipIcon class="h-4 w-4" />
                  </button>
                </div>
                <button
                  type="submit"
                  class="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
                  :disabled="sending || uploading || (!draft.trim() && !pendingAttachments.length)"
                  :title="t('internalChat.send')"
                >
                  <PaperAirplaneIcon class="h-4 w-4" />
                </button>
              </div>
            </div>
          </form>
        </div>
      </template>
    </main>
    </div>

    <!-- New channel modal -->
    <div
      v-if="showChannelModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/50 p-4 backdrop-blur-[2px]"
      @click.self="closeChannelModal"
    >
      <div class="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 dark:bg-neutral-900 dark:ring-white/10">
        <div class="border-b border-neutral-100 px-5 py-4 dark:border-neutral-800">
          <h3 class="text-base font-semibold text-neutral-900 dark:text-white">
            {{ t('internalChat.newChannel') }}
          </h3>
          <p class="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            {{ t('internalChat.channelModalSubtitle') }}
          </p>
        </div>
        <div class="space-y-4 px-5 py-4">
          <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {{ t('internalChat.channelName') }}
            <input
              v-model="channelName"
              type="text"
              class="mt-1.5 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
            >
          </label>
          <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {{ t('internalChat.channelTopic') }}
            <input
              v-model="channelTopic"
              type="text"
              class="mt-1.5 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
            >
          </label>
          <label class="flex items-start gap-2.5 text-sm text-neutral-700 dark:text-neutral-300">
            <input
              v-model="channelPrivate"
              type="checkbox"
              class="mt-0.5 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
            >
            <span>
              <span class="font-medium">{{ t('internalChat.channelPrivate') }}</span>
              <span class="mt-0.5 block text-xs font-normal text-neutral-500 dark:text-neutral-400">
                {{ channelPrivate ? t('internalChat.channelPrivateHint') : t('internalChat.channelPublicHint') }}
              </span>
            </span>
          </label>
          <div>
            <p class="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              {{ t('internalChat.channelInviteLabel') }}
            </p>
            <p class="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
              {{ channelPrivate ? t('internalChat.channelInvitePrivateHint') : t('internalChat.channelInvitePublicHint') }}
            </p>
            <div class="relative mt-2">
              <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                v-model="channelInviteFilter"
                type="search"
                class="w-full rounded-xl border border-neutral-200 bg-neutral-50 py-2 pl-9 pr-3 text-sm focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                :placeholder="t('internalChat.dmSearchPlaceholder')"
              >
            </div>
            <div class="mt-2 max-h-40 space-y-0.5 overflow-auto rounded-xl border border-neutral-100 p-1 dark:border-neutral-800">
              <button
                v-for="u in filteredChannelInviteCandidates"
                :key="u._id"
                type="button"
                class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"
                :class="channelInviteIds.includes(String(u._id)) ? 'bg-primary-50 dark:bg-primary-950/30' : ''"
                @click="toggleChannelInvite(u._id)"
              >
                <AvatarInitials v-bind="personAvatarProps(u)" size="sm" />
                <span class="min-w-0 flex-1 truncate">{{ userLabel(u) }}</span>
                <span
                  v-if="channelInviteIds.includes(String(u._id))"
                  class="text-xs text-primary-600"
                >✓</span>
              </button>
              <p
                v-if="!filteredChannelInviteCandidates.length"
                class="px-2 py-3 text-center text-xs text-neutral-500"
              >
                {{ t('internalChat.noUsers') }}
              </p>
            </div>
          </div>
        </div>
        <div class="flex justify-end gap-2 border-t border-neutral-100 bg-neutral-50/80 px-5 py-3 dark:border-neutral-800 dark:bg-neutral-950/40">
          <button
            type="button"
            class="rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-200/70 dark:text-neutral-300 dark:hover:bg-neutral-800"
            @click="closeChannelModal"
          >
            {{ t('actions.cancel') }}
          </button>
          <button
            type="button"
            class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50"
            :disabled="creating || !channelName.trim()"
            @click="createChannel"
          >
            {{ t('actions.create') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Invite members modal -->
    <div
      v-if="showInviteModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/50 p-4 backdrop-blur-[2px]"
      @click.self="closeInviteModal"
    >
      <div class="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 dark:bg-neutral-900 dark:ring-white/10">
        <div class="border-b border-neutral-100 px-5 py-4 dark:border-neutral-800">
          <h3 class="text-base font-semibold text-neutral-900 dark:text-white">
            {{ t('internalChat.inviteMembers') }}
          </h3>
          <p class="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            {{ t('internalChat.inviteModalSubtitle') }}
          </p>
        </div>
        <div class="space-y-3 px-5 py-4">
          <div class="relative">
            <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              v-model="inviteFilter"
              type="search"
              class="w-full rounded-xl border border-neutral-200 bg-neutral-50 py-2 pl-9 pr-3 text-sm focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
              :placeholder="t('internalChat.dmSearchPlaceholder')"
            >
          </div>
          <div class="max-h-56 space-y-0.5 overflow-auto rounded-xl border border-neutral-100 p-1 dark:border-neutral-800">
            <button
              v-for="u in filteredInviteCandidates"
              :key="u._id"
              type="button"
              class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"
              :class="inviteMemberIds.includes(String(u._id)) ? 'bg-primary-50 dark:bg-primary-950/30' : ''"
              @click="toggleInviteMember(u._id)"
            >
              <AvatarInitials v-bind="personAvatarProps(u)" size="sm" />
              <span class="min-w-0 flex-1 truncate">{{ userLabel(u) }}</span>
              <span
                v-if="inviteMemberIds.includes(String(u._id))"
                class="text-xs text-primary-600"
              >✓</span>
            </button>
            <p
              v-if="!filteredInviteCandidates.length"
              class="px-2 py-3 text-center text-xs text-neutral-500"
            >
              {{ t('internalChat.noUsers') }}
            </p>
          </div>
        </div>
        <div class="flex justify-end gap-2 border-t border-neutral-100 bg-neutral-50/80 px-5 py-3 dark:border-neutral-800 dark:bg-neutral-950/40">
          <button
            type="button"
            class="rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-200/70 dark:text-neutral-300 dark:hover:bg-neutral-800"
            @click="closeInviteModal"
          >
            {{ t('actions.cancel') }}
          </button>
          <button
            type="button"
            class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50"
            :disabled="inviting || !inviteMemberIds.length"
            @click="submitInviteMembers"
          >
            {{ t('internalChat.inviteSend') }}
          </button>
        </div>
      </div>
    </div>

    <!-- New DM modal -->
    <div
      v-if="showDmModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/50 p-4 backdrop-blur-[2px]"
      @click.self="closeDmModal"
    >
      <div class="flex w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 dark:bg-neutral-900 dark:ring-white/10">
        <div class="flex items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4 dark:border-neutral-800">
          <div class="min-w-0">
            <h3 class="text-base font-semibold text-neutral-900 dark:text-white">
              {{ t('internalChat.newDm') }}
            </h3>
            <p class="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
              {{ t('internalChat.dmModalSubtitle') }}
            </p>
          </div>
          <button
            type="button"
            class="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            :aria-label="t('actions.cancel')"
            @click="closeDmModal"
          >
            <XMarkIcon class="h-5 w-5" />
          </button>
        </div>

        <div class="space-y-3 px-5 pt-4">
          <div class="grid grid-cols-2 gap-1 rounded-xl bg-neutral-100 p-1 dark:bg-neutral-800">
            <button
              type="button"
              class="rounded-lg px-3 py-2 text-sm font-medium transition"
              :class="dmMode === 'dm'
                ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-950 dark:text-white'
                : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200'"
              @click="dmMode = 'dm'"
            >
              {{ t('internalChat.dmModeSingle') }}
            </button>
            <button
              type="button"
              class="rounded-lg px-3 py-2 text-sm font-medium transition"
              :class="dmMode === 'group'
                ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-950 dark:text-white'
                : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200'"
              @click="dmMode = 'group'"
            >
              {{ t('internalChat.dmModeGroup') }}
            </button>
          </div>

          <div class="relative">
            <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              v-model="dmPickerFilter"
              type="search"
              class="w-full rounded-xl border border-neutral-200 bg-neutral-50 py-2.5 pl-9 pr-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:placeholder:text-neutral-500"
              :placeholder="t('internalChat.dmSearchPlaceholder')"
            >
          </div>
        </div>

        <div class="mt-3 max-h-72 min-h-[12rem] overflow-auto px-3 pb-2">
          <button
            v-for="u in filteredDmCandidates"
            :key="u._id"
            type="button"
            class="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-neutral-50 dark:hover:bg-neutral-800/80"
            :class="isDmCandidateSelected(u)
              ? 'bg-primary-50 ring-1 ring-primary-200 dark:bg-primary-950/40 dark:ring-primary-800'
              : ''"
            @click="dmMode === 'dm' ? (dmUserId = u._id) : toggleGroupMember(u._id)"
          >
            <AvatarInitials
              v-bind="personAvatarProps(u)"
              size="sm"
            />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-medium text-neutral-900 dark:text-white">
                {{ userLabel(u) }}
              </span>
              <span
                v-if="u.email"
                class="block truncate text-xs text-neutral-500 dark:text-neutral-400"
              >
                {{ u.email }}
              </span>
            </span>
            <span
              v-if="isDmCandidateSelected(u)"
              class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-600 text-[10px] font-bold text-white"
            >✓</span>
          </button>
          <div
            v-if="!filteredDmCandidates.length"
            class="flex h-40 flex-col items-center justify-center px-4 text-center"
          >
            <ChatBubbleOvalLeftEllipsisIcon class="mb-2 h-8 w-8 text-neutral-300 dark:text-neutral-600" />
            <p class="text-sm text-neutral-500 dark:text-neutral-400">
              {{ dmCandidates.length ? t('internalChat.noUsersMatch') : t('internalChat.noUsers') }}
            </p>
          </div>
        </div>

        <div class="flex items-center justify-between gap-3 border-t border-neutral-100 bg-neutral-50/80 px-5 py-3 dark:border-neutral-800 dark:bg-neutral-950/40">
          <p class="text-xs text-neutral-500 dark:text-neutral-400">
            <template v-if="dmMode === 'group' && groupDmIds.length">
              {{ t('internalChat.selectedCount', { count: groupDmIds.length }) }}
            </template>
            <template v-else-if="dmMode === 'dm' && dmUserId">
              {{ t('internalChat.dmReady') }}
            </template>
            <template v-else>
              {{ t('internalChat.dmPickHint') }}
            </template>
          </p>
          <div class="flex shrink-0 gap-2">
            <button
              type="button"
              class="rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-200/70 dark:text-neutral-300 dark:hover:bg-neutral-800"
              @click="closeDmModal"
            >
              {{ t('actions.cancel') }}
            </button>
            <button
              type="button"
              class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50"
              :disabled="creating || (dmMode === 'dm' ? !dmUserId : groupDmIds.length < 2)"
              @click="createDm"
            >
              {{ t('internalChat.dmStart') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Settings modal -->
    <div
      v-if="showSettingsModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click.self="showSettingsModal = false"
    >
      <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-neutral-900">
        <h3 class="text-lg font-semibold text-neutral-900 dark:text-white">
          {{ t('internalChat.settings') }}
        </h3>
        <label class="mt-5 block text-sm text-neutral-700 dark:text-neutral-300">
          {{ t('internalChat.retentionDays') }}
          <input
            v-model.number="retentionDays"
            type="number"
            min="0"
            max="3650"
            class="mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
          >
        </label>
        <p class="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
          {{ t('internalChat.retentionHint') }}
        </p>
        <div class="mt-6 flex justify-end gap-2">
          <button
            type="button"
            class="rounded-lg px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
            @click="showSettingsModal = false"
          >
            {{ t('actions.cancel') }}
          </button>
          <button
            type="button"
            class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
            :disabled="savingSettings"
            @click="saveSettings"
          >
            {{ t('actions.save') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import {
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  BookmarkIcon,
  ChatBubbleLeftIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  Cog6ToothIcon,
  HashtagIcon,
  LockClosedIcon,
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
  PaperClipIcon,
  PlusIcon,
  TrashIcon,
  UserPlusIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import { useAuthStore } from '@/stores/auth';
import Avatar from '@/components/common/Avatar.vue';
import AvatarInitials from '@/components/ui/AvatarInitials.vue';
import { createInternalChatStream } from '@/composables/useInternalChatStream';
import {
  createChatChannel,
  createChatDm,
  createChatGroupDm,
  deleteChatMessage,
  exportChatSpace,
  fetchChatMessages,
  fetchChatSettings,
  fetchChatSpaces,
  fetchChatTeammates,
  inviteChatMembers,
  joinChatChannel,
  markChatRead,
  pinChatMessage,
  publishChatTyping,
  searchChatMessages,
  sendChatMessage,
  setChatPresence,
  toggleChatReaction,
  updateChatSettings,
  uploadChatAttachment,
} from '@/utils/internalChatApi';

const { t } = useI18n();
const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();

const quickEmojis = ['👍', '❤️', '😂', '🎉', '👀'];

const loadingSpaces = ref(true);
const loadingMessages = ref(false);
const error = ref('');
const spaces = ref([]);
const selectedSpaceId = ref(null);
const messages = ref([]);
const draft = ref('');
const sending = ref(false);
const streamLive = ref(false);
const threadRootId = ref(null);
const messageListEl = ref(null);
const fileInputEl = ref(null);
const pendingAttachments = ref([]);
const uploading = ref(false);
const searchQuery = ref('');
const searchResults = ref([]);
const focusedSearchMessageId = ref(null);
let searchDebounceTimer = null;
const typingUsers = ref({});
const presenceViewers = ref([]);
const spaceFilter = ref('');

const showChannelModal = ref(false);
const showDmModal = ref(false);
const showInviteModal = ref(false);
const showSettingsModal = ref(false);
/** On <md viewports: true = conversation pane, false = space list */
const mobileShowConversation = ref(false);
const channelName = ref('');
const channelTopic = ref('');
const channelPrivate = ref(false);
const channelInviteIds = ref([]);
const channelInviteFilter = ref('');
const inviteMemberIds = ref([]);
const inviteFilter = ref('');
const inviting = ref(false);
const joining = ref(false);
const creating = ref(false);
const dmUserId = ref(null);
const groupDmIds = ref([]);
const dmMode = ref('dm');
const dmPickerFilter = ref('');
const orgUsers = ref([]);
const retentionDays = ref(0);
const savingSettings = ref(false);
const mentionSuggestions = ref([]);
const pinnedIds = ref([]);

const selectedSpace = computed(() =>
  spaces.value.find((s) => String(s._id) === String(selectedSpaceId.value || '')) || null
);

const filteredSpaces = computed(() => {
  const q = spaceFilter.value.trim().toLowerCase();
  if (!q) return spaces.value;
  return spaces.value.filter((s) => spaceDisplayName(s).toLowerCase().includes(q));
});

const directSpaces = computed(() =>
  filteredSpaces.value.filter((s) => s.type === 'dm' || s.type === 'group_dm')
);

const channelSpaces = computed(() =>
  filteredSpaces.value.filter((s) => s.type === 'channel')
);

const recordSpaces = computed(() =>
  filteredSpaces.value.filter((s) => s.type === 'record')
);

const composerPlaceholder = computed(() => {
  if (selectedSpace.value) {
    return t('internalChat.composerPlaceholderNamed', { name: spaceDisplayName(selectedSpace.value) });
  }
  return t('internalChat.composerPlaceholder');
});

const dmCandidates = computed(() => {
  const me = String(authStore.user?._id || '');
  return orgUsers.value.filter((u) => (
    String(u._id) !== me
    && String(u.userType || 'INTERNAL').toUpperCase() !== 'EXTERNAL'
  ));
});

const filteredDmCandidates = computed(() => {
  const q = dmPickerFilter.value.trim().toLowerCase();
  if (!q) return dmCandidates.value;
  return dmCandidates.value.filter((u) => {
    const label = userLabel(u).toLowerCase();
    const email = String(u.email || '').toLowerCase();
    return label.includes(q) || email.includes(q);
  });
});

const filteredChannelInviteCandidates = computed(() => {
  const q = channelInviteFilter.value.trim().toLowerCase();
  if (!q) return dmCandidates.value;
  return dmCandidates.value.filter((u) => {
    const label = userLabel(u).toLowerCase();
    const email = String(u.email || '').toLowerCase();
    return label.includes(q) || email.includes(q);
  });
});

const filteredInviteCandidates = computed(() => {
  const q = inviteFilter.value.trim().toLowerCase();
  if (!q) return dmCandidates.value;
  return dmCandidates.value.filter((u) => {
    const label = userLabel(u).toLowerCase();
    const email = String(u.email || '').toLowerCase();
    return label.includes(q) || email.includes(q);
  });
});

function isDmCandidateSelected(u) {
  const id = String(u._id);
  if (dmMode.value === 'dm') return String(dmUserId.value) === id;
  return groupDmIds.value.includes(id);
}

function closeDmModal() {
  showDmModal.value = false;
  dmPickerFilter.value = '';
  dmUserId.value = null;
  groupDmIds.value = [];
  dmMode.value = 'dm';
}

function closeChannelModal() {
  showChannelModal.value = false;
  channelName.value = '';
  channelTopic.value = '';
  channelPrivate.value = false;
  channelInviteIds.value = [];
  channelInviteFilter.value = '';
}

function toggleChannelInvite(id) {
  const sid = String(id);
  if (channelInviteIds.value.includes(sid)) {
    channelInviteIds.value = channelInviteIds.value.filter((x) => x !== sid);
  } else {
    channelInviteIds.value = [...channelInviteIds.value, sid];
  }
}

function openInviteModal() {
  inviteMemberIds.value = [];
  inviteFilter.value = '';
  showInviteModal.value = true;
  loadOrgUsers();
}

function closeInviteModal() {
  showInviteModal.value = false;
  inviteMemberIds.value = [];
  inviteFilter.value = '';
}

function toggleInviteMember(id) {
  const sid = String(id);
  if (inviteMemberIds.value.includes(sid)) {
    inviteMemberIds.value = inviteMemberIds.value.filter((x) => x !== sid);
  } else {
    inviteMemberIds.value = [...inviteMemberIds.value, sid];
  }
}

const typingLabel = computed(() => {
  const me = String(authStore.user?._id || '');
  const active = Object.values(typingUsers.value).filter(
    (row) => row && row.userId !== me && Date.now() - row.at < 4000
  );
  if (!active.length) return '';
  if (active.length === 1) return t('internalChat.typingOne', { name: active[0].name });
  return t('internalChat.typingMany');
});

const presenceLabel = computed(() => {
  const me = String(authStore.user?._id || '');
  const others = presenceViewers.value.filter((v) => String(v.userId) !== me);
  if (!others.length) return '';
  if (others.length === 1) return t('internalChat.presenceOne', { name: others[0].name });
  return t('internalChat.presenceMany', { count: others.length });
});

function isSpaceSelected(space) {
  return String(selectedSpaceId.value) === String(space._id);
}

function truncate(text, n) {
  const s = String(text || '');
  return s.length <= n ? s : `${s.slice(0, n)}…`;
}

const conversationMatchIds = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (q.length < 2) return new Set();
  return new Set(
    messages.value
      .filter((m) => String(m.body || '').toLowerCase().includes(q))
      .map((m) => String(m._id))
  );
});

function isSearchMatch(msg) {
  return conversationMatchIds.value.has(String(msg._id));
}

function highlightParts(text, query) {
  const s = String(text || '');
  const q = String(query || '').trim();
  if (q.length < 2) return [{ text: s, hit: false }];
  const lower = s.toLowerCase();
  const needle = q.toLowerCase();
  const parts = [];
  let i = 0;
  while (i < s.length) {
    const idx = lower.indexOf(needle, i);
    if (idx === -1) {
      parts.push({ text: s.slice(i), hit: false });
      break;
    }
    if (idx > i) parts.push({ text: s.slice(i, idx), hit: false });
    parts.push({ text: s.slice(idx, idx + needle.length), hit: true });
    i = idx + needle.length;
  }
  return parts.length ? parts : [{ text: s, hit: false }];
}

async function scrollToSearchMatch(messageId) {
  if (!messageId) return;
  await nextTick();
  const root = messageListEl.value;
  if (!root) return;
  const el = root.querySelector(`[data-message-id="${CSS.escape(String(messageId))}"]`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function onSearchInput() {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  const q = searchQuery.value.trim();
  if (q.length < 2) {
    searchResults.value = [];
    focusedSearchMessageId.value = null;
    return;
  }
  searchDebounceTimer = setTimeout(() => {
    runSearch();
  }, 250);
}

function spaceDisplayName(space) {
  if (!space) return '';
  if (space.displayName) return space.displayName;
  if (space.name) return space.name;
  if (space.type === 'dm') return t('internalChat.dmFallback');
  if (space.type === 'group_dm') return t('internalChat.groupDmFallback');
  if (space.type === 'record' && space.moduleKey) {
    return space.name || `${space.moduleKey}`;
  }
  return space.type || '';
}

function personAvatarProps(person) {
  if (!person) {
    return { firstName: '', lastName: '', email: '', username: '', avatar: '' };
  }
  let firstName = String(person.firstName || person.first_name || '').trim();
  let lastName = String(person.lastName || person.last_name || '').trim();
  if (!firstName && !lastName && person.name) {
    const parts = String(person.name).trim().split(/\s+/).filter(Boolean);
    firstName = parts[0] || '';
    lastName = parts.slice(1).join(' ');
  }
  return {
    firstName,
    lastName,
    email: person.email || '',
    username: person.username || '',
    avatar: person.avatar || '',
  };
}

function authorAvatarProps(msg) {
  const base = personAvatarProps(msg?.author || { firstName: authorLabel(msg) });
  const authorId = String(msg?.authorId || msg?.author?._id || '');
  const me = String(authStore.user?._id || '');
  if (!base.avatar && authorId && me && authorId === me) {
    return {
      ...base,
      firstName: base.firstName || authStore.user?.firstName || '',
      lastName: base.lastName || authStore.user?.lastName || '',
      email: base.email || authStore.user?.email || '',
      username: base.username || authStore.user?.username || '',
      avatar: authStore.user?.avatar || '',
    };
  }
  return base;
}

function spaceAvatarProps(space) {
  if (!space) return personAvatarProps(null);
  const peer = space.peer || (Array.isArray(space.peerUsers) ? space.peerUsers[0] : null);
  if (peer) return personAvatarProps(peer);
  const label = spaceDisplayName(space);
  const parts = String(label || '').trim().split(/\s+/).filter(Boolean);
  return personAvatarProps({
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' '),
  });
}

function presenceAvatarUser(viewer) {
  if (!viewer) return null;
  return {
    _id: viewer.userId,
    firstName: viewer.firstName,
    lastName: viewer.lastName,
    email: viewer.email,
    avatar: viewer.avatar,
  };
}

function authorLabel(msg) {
  const a = msg.author;
  if (!a) return t('internalChat.unknownAuthor');
  const name = [a.firstName, a.lastName].filter(Boolean).join(' ').trim();
  return name || a.email || t('internalChat.unknownAuthor');
}

function isOwnMessage(msg) {
  const me = String(authStore.user?._id || '');
  if (!me) return false;
  return String(msg?.authorId || msg?.author?._id || '') === me;
}

function userLabel(u) {
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  return name || u.email || String(u._id);
}

function formatTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const timeStr = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    if (msgDay.getTime() === todayStart.getTime()) return timeStr;
    if (msgDay.getTime() === yesterdayStart.getTime()) {
      return `${t('internalChat.yesterday')} ${timeStr}`;
    }
    const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `${dateStr} ${timeStr}`;
  } catch {
    return '';
  }
}

async function scrollToBottom() {
  await nextTick();
  const el = messageListEl.value;
  if (el) el.scrollTop = el.scrollHeight;
}

async function loadSpaces() {
  const showLoader = spaces.value.length === 0;
  if (showLoader) loadingSpaces.value = true;
  error.value = '';
  try {
    spaces.value = await fetchChatSpaces();
    const current = selectedSpaceId.value ? String(selectedSpaceId.value) : null;
    const currentValid = current && spaces.value.some((s) => String(s._id) === current);
    // Keep in-memory selection — do not clobber with stale route.query during router.replace race
    if (currentValid) {
      selectedSpaceId.value = current;
    } else {
      const qSpace = route.query.spaceId ? String(route.query.spaceId) : null;
      if (qSpace && spaces.value.some((s) => String(s._id) === qSpace)) {
        selectedSpaceId.value = qSpace;
      } else if (spaces.value.length) {
        selectedSpaceId.value = String(spaces.value[0]._id);
      } else {
        selectedSpaceId.value = null;
      }
    }
  } catch (err) {
    error.value = err?.response?.data?.message || t('internalChat.loadFailed');
    spaces.value = [];
  } finally {
    if (showLoader) loadingSpaces.value = false;
  }
}

async function loadMessages() {
  if (!selectedSpaceId.value) {
    messages.value = [];
    return;
  }
  loadingMessages.value = true;
  try {
    const result = await fetchChatMessages(selectedSpaceId.value, {
      threadRootId: threadRootId.value || undefined,
    });
    messages.value = result.messages;
    pinnedIds.value = (result.space?.pinnedMessageIds || []).map(String);
    await markChatRead(selectedSpaceId.value);
    const space = spaces.value.find((s) => String(s._id) === String(selectedSpaceId.value));
    if (space) {
      space.unreadCount = 0;
      space.pinnedMessageIds = result.space?.pinnedMessageIds || [];
    }
    await scrollToBottom();
  } catch (err) {
    error.value = err?.response?.data?.message || t('internalChat.loadFailed');
  } finally {
    loadingMessages.value = false;
  }
}

function backToMobileList() {
  mobileShowConversation.value = false;
}

async function selectSpace(id) {
  const nextId = String(id || '');
  if (!nextId) return;

  const space = spaces.value.find((s) => String(s._id) === nextId);
  let targetId = nextId;
  if (space?.canJoin) {
    if (joining.value) return;
    joining.value = true;
    try {
      const joined = await joinChatChannel(nextId);
      await loadSpaces();
      if (joined?._id) targetId = String(joined._id);
    } catch (err) {
      error.value = err?.response?.data?.message || t('internalChat.joinFailed');
      return;
    } finally {
      joining.value = false;
    }
  }

  mobileShowConversation.value = true;

  if (String(selectedSpaceId.value || '') === targetId && !space?.canJoin) {
    // Already selected — still sync URL if needed
    if (String(route.query.spaceId || '') !== targetId) {
      router.replace({ query: { ...route.query, spaceId: targetId } });
    }
    return;
  }

  threadRootId.value = null;
  selectedSpaceId.value = targetId;
  typingUsers.value = {};
  if (String(route.query.spaceId || '') !== targetId) {
    router.replace({ query: { ...route.query, spaceId: targetId } });
  }
  setChatPresence(targetId).then((viewers) => {
    presenceViewers.value = viewers;
  }).catch(() => {
    presenceViewers.value = [];
  });
}

function openThread(msg) {
  threadRootId.value = msg._id;
}

function closeThread() {
  threadRootId.value = null;
}

let typingTimer = null;
function onComposerInput() {
  if (!selectedSpaceId.value) return;
  updateMentionSuggestions();
  if (typingTimer) return;
  typingTimer = setTimeout(() => {
    typingTimer = null;
  }, 2000);
  publishChatTyping(selectedSpaceId.value).catch(() => {});
}

function updateMentionSuggestions() {
  const match = draft.value.match(/(?:^|\s)@([^\s@]*)$/);
  if (!match) {
    mentionSuggestions.value = [];
    return;
  }
  const q = match[1].toLowerCase();
  const me = String(authStore.user?._id || '');
  mentionSuggestions.value = orgUsers.value
    .filter((u) => String(u._id) !== me)
    .filter((u) => String(u.userType || 'INTERNAL').toUpperCase() !== 'EXTERNAL')
    .filter((u) => {
      const label = userLabel(u).toLowerCase();
      return !q || label.includes(q);
    })
    .slice(0, 6);
}

function insertMention(user) {
  const token = `<@${user._id}>`;
  draft.value = draft.value.replace(/(?:^|\s)@([^\s@]*)$/, (full) => {
    const lead = full.startsWith(' ') || full.startsWith('\n') ? full[0] : '';
    return `${lead}${token} `;
  });
  mentionSuggestions.value = [];
}

function isPinned(msg) {
  return pinnedIds.value.includes(String(msg._id));
}

async function togglePin(msg) {
  if (!selectedSpaceId.value || String(msg._id).startsWith('temp_')) return;
  try {
    const result = await pinChatMessage(
      selectedSpaceId.value,
      msg._id,
      !isPinned(msg)
    );
    pinnedIds.value = (result?.pinnedMessageIds || []).map(String);
  } catch (err) {
    error.value = err?.response?.data?.message || t('internalChat.pinFailed');
  }
}

async function removeMessage(msg) {
  if (!selectedSpaceId.value || String(msg._id).startsWith('temp_')) return;
  try {
    await deleteChatMessage(selectedSpaceId.value, msg._id);
    messages.value = messages.value.filter((m) => m._id !== msg._id);
  } catch (err) {
    error.value = err?.response?.data?.message || t('internalChat.deleteFailed');
  }
}

async function downloadExport() {
  if (!selectedSpaceId.value) return;
  try {
    const data = await exportChatSpace(selectedSpaceId.value);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${selectedSpaceId.value}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    error.value = err?.response?.data?.message || t('internalChat.exportFailed');
  }
}

async function openSettings() {
  showSettingsModal.value = true;
  try {
    const settings = await fetchChatSettings();
    retentionDays.value = Number(settings.retentionDays) || 0;
  } catch {
    retentionDays.value = 0;
  }
}

async function saveSettings() {
  savingSettings.value = true;
  try {
    await updateChatSettings({ retentionDays: Number(retentionDays.value) || 0 });
    showSettingsModal.value = false;
  } catch (err) {
    error.value = err?.response?.data?.message || t('internalChat.settingsFailed');
  } finally {
    savingSettings.value = false;
  }
}

async function runSearch() {
  const q = searchQuery.value.trim();
  if (q.length < 2) {
    searchResults.value = [];
    focusedSearchMessageId.value = null;
    return;
  }
  try {
    searchResults.value = await searchChatMessages({
      q,
      spaceId: selectedSpaceId.value || undefined,
      limit: 30,
    });
    const localIds = [...conversationMatchIds.value];
    const firstId = localIds[0] || (searchResults.value[0] ? String(searchResults.value[0]._id) : null);
    focusedSearchMessageId.value = firstId;
    if (firstId) await scrollToSearchMatch(firstId);
  } catch (err) {
    // Local highlight still works even if API search fails
    const localIds = [...conversationMatchIds.value];
    focusedSearchMessageId.value = localIds[0] || null;
    if (localIds[0]) await scrollToSearchMatch(localIds[0]);
    if (!localIds.length) {
      error.value = err?.response?.data?.message || t('internalChat.searchFailed');
    }
  }
}

function clearSearch() {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  searchQuery.value = '';
  searchResults.value = [];
  focusedSearchMessageId.value = null;
}

async function jumpToSearchHit(hit) {
  const hitId = hit?._id ? String(hit._id) : null;
  if (hit.spaceId && String(hit.spaceId) !== String(selectedSpaceId.value || '')) {
    await selectSpace(String(hit.spaceId));
    await nextTick();
    await loadMessages();
  }
  focusedSearchMessageId.value = hitId;
  if (hitId) await scrollToSearchMatch(hitId);
}

async function react(msg, emoji) {
  if (!selectedSpaceId.value || String(msg._id).startsWith('temp_')) return;
  try {
    const result = await toggleChatReaction(selectedSpaceId.value, msg._id, emoji);
    if (result?.reactions) {
      messages.value = messages.value.map((m) =>
        (m._id === msg._id ? { ...m, reactions: result.reactions } : m)
      );
    }
  } catch (err) {
    error.value = err?.response?.data?.message || t('internalChat.reactFailed');
  }
}

async function onFileSelected(ev) {
  const file = ev.target?.files?.[0];
  if (fileInputEl.value) fileInputEl.value.value = '';
  if (!file || !selectedSpaceId.value) return;
  uploading.value = true;
  try {
    const meta = await uploadChatAttachment(
      selectedSpaceId.value,
      file,
      authStore.user?.token
    );
    if (meta) pendingAttachments.value = [...pendingAttachments.value, meta];
  } catch (err) {
    error.value = err?.response?.data?.message || t('internalChat.uploadFailed');
  } finally {
    uploading.value = false;
  }
}

async function submitMessage() {
  const body = draft.value.trim();
  const attachments = [...pendingAttachments.value];
  if ((!body && !attachments.length) || !selectedSpaceId.value || sending.value) return;
  sending.value = true;
  const tempId = `temp_${Date.now()}`;
  const optimistic = {
    _id: tempId,
    body,
    attachments,
    reactions: [],
    createdAt: new Date().toISOString(),
    authorId: authStore.user?._id,
    author: {
      _id: authStore.user?._id,
      firstName: authStore.user?.firstName,
      lastName: authStore.user?.lastName,
      email: authStore.user?.email,
      avatar: authStore.user?.avatar || '',
    },
    threadRootId: threadRootId.value,
  };
  messages.value = [...messages.value, optimistic];
  draft.value = '';
  pendingAttachments.value = [];
  await scrollToBottom();
  try {
    const saved = await sendChatMessage(selectedSpaceId.value, {
      body,
      threadRootId: threadRootId.value || undefined,
      attachments,
    });
    const savedId = String(saved?._id || '');
    messages.value = [
      ...messages.value.filter((m) => m._id !== tempId && String(m._id) !== savedId),
      {
        ...saved,
        reactions: saved.reactions || [],
      },
    ];
    await loadSpaces();
  } catch (err) {
    messages.value = messages.value.filter((m) => m._id !== tempId);
    draft.value = body;
    pendingAttachments.value = attachments;
    error.value = err?.response?.data?.message || t('internalChat.sendFailed');
  } finally {
    sending.value = false;
  }
}

async function createChannel() {
  creating.value = true;
  try {
    const space = await createChatChannel({
      name: channelName.value.trim(),
      topic: channelTopic.value.trim(),
      isPrivate: channelPrivate.value,
      memberIds: channelInviteIds.value,
    });
    closeChannelModal();
    await loadSpaces();
    if (space?._id) await selectSpace(space._id);
  } catch (err) {
    error.value = err?.response?.data?.message || t('internalChat.createFailed');
  } finally {
    creating.value = false;
  }
}

async function submitInviteMembers() {
  if (!selectedSpaceId.value || !inviteMemberIds.value.length) return;
  inviting.value = true;
  try {
    await inviteChatMembers(selectedSpaceId.value, inviteMemberIds.value);
    closeInviteModal();
    await loadSpaces();
  } catch (err) {
    error.value = err?.response?.data?.message || t('internalChat.inviteFailed');
  } finally {
    inviting.value = false;
  }
}

async function createDm() {
  creating.value = true;
  try {
    let space = null;
    if (dmMode.value === 'group') {
      space = await createChatGroupDm(groupDmIds.value);
    } else if (dmUserId.value) {
      space = await createChatDm(dmUserId.value);
    }
    closeDmModal();
    await loadSpaces();
    if (space?._id) selectSpace(space._id);
  } catch (err) {
    error.value = err?.response?.data?.message || t('internalChat.createFailed');
  } finally {
    creating.value = false;
  }
}

function toggleGroupMember(id) {
  const sid = String(id);
  if (groupDmIds.value.includes(sid)) {
    groupDmIds.value = groupDmIds.value.filter((x) => x !== sid);
  } else {
    groupDmIds.value = [...groupDmIds.value, sid];
  }
}

async function loadOrgUsers() {
  try {
    orgUsers.value = await fetchChatTeammates();
  } catch {
    orgUsers.value = [];
  }
}

function onStreamEvent(payload) {
  if (!payload?.type) return;
  if (payload.type === 'message.deleted') {
    if (String(payload.spaceId) !== String(selectedSpaceId.value)) return;
    messages.value = messages.value.filter((m) => String(m._id) !== String(payload.messageId));
    return;
  }
  if (payload.type === 'space.updated' && payload.pinnedMessageIds) {
    if (String(payload.spaceId) === String(selectedSpaceId.value)) {
      pinnedIds.value = payload.pinnedMessageIds.map(String);
    }
    loadSpaces();
    return;
  }
  if (payload.type === 'space.updated' || payload.type === 'unread.bump') {
    loadSpaces();
    return;
  }
  if (payload.type === 'typing') {
    if (String(payload.spaceId) !== String(selectedSpaceId.value)) return;
    typingUsers.value = {
      ...typingUsers.value,
      [payload.userId]: {
        userId: String(payload.userId),
        name: payload.name || t('internalChat.unknownAuthor'),
        at: payload.at || Date.now(),
      },
    };
    return;
  }
  if (payload.type === 'presence') {
    if (String(payload.spaceId) !== String(selectedSpaceId.value)) return;
    presenceViewers.value = Array.isArray(payload.viewers) ? payload.viewers : [];
    return;
  }
  if (payload.type === 'message.updated') {
    if (String(payload.spaceId) !== String(selectedSpaceId.value)) return;
    messages.value = messages.value.map((m) =>
      (String(m._id) === String(payload.messageId)
        ? { ...m, reactions: payload.reactions || m.reactions }
        : m)
    );
    return;
  }
  if (payload.type === 'message.created') {
    const sid = String(payload.spaceId || '');
    if (sid === String(selectedSpaceId.value)) {
      const msgThread = payload.message?.threadRootId
        ? String(payload.message.threadRootId)
        : null;
      const currentThread = threadRootId.value ? String(threadRootId.value) : null;
      if (msgThread === currentThread && payload.message) {
        const mid = String(payload.message._id);
        const existingIdx = messages.value.findIndex((m) => String(m._id) === mid);
        if (existingIdx >= 0) {
          const next = [...messages.value];
          next[existingIdx] = {
            ...next[existingIdx],
            ...payload.message,
            reactions: payload.message.reactions || next[existingIdx].reactions || [],
          };
          messages.value = next;
        } else {
          const tempIdx = messages.value.findIndex((m) => (
            String(m._id).startsWith('temp_')
            && String(m.authorId || m.author?._id || '') === String(payload.message.authorId || payload.message.author?._id || '')
            && String(m.body || '') === String(payload.message.body || '')
          ));
          const normalized = {
            ...payload.message,
            reactions: payload.message.reactions || [],
          };
          if (tempIdx >= 0) {
            const next = [...messages.value];
            next[tempIdx] = normalized;
            messages.value = next;
          } else {
            messages.value = [...messages.value, normalized];
          }
          scrollToBottom();
          markChatRead(selectedSpaceId.value, payload.message._id);
        }
      }
    }
    loadSpaces();
  }
}

let streamControls = null;
let mobileMql = null;

function onMobileMqChange(e) {
  // Entering mobile with a selection → show conversation pane
  if (e.matches && selectedSpaceId.value) {
    mobileShowConversation.value = true;
  }
}

watch(selectedSpaceId, (id) => {
  loadMessages();
  if (id) {
    setChatPresence(id).then((viewers) => {
      presenceViewers.value = viewers;
    }).catch(() => {
      presenceViewers.value = [];
    });
  } else {
    presenceViewers.value = [];
    mobileShowConversation.value = false;
  }
});

// Browser back/forward / deep-link query changes
watch(
  () => route.query.spaceId,
  (q) => {
    const qSpace = q ? String(q) : null;
    if (!qSpace) return;
    if (String(selectedSpaceId.value || '') === qSpace) {
      mobileShowConversation.value = true;
      return;
    }
    if (spaces.value.some((s) => String(s._id) === qSpace)) {
      threadRootId.value = null;
      selectedSpaceId.value = qSpace;
      mobileShowConversation.value = true;
    }
  }
);

watch(threadRootId, () => {
  if (selectedSpaceId.value) loadMessages();
});

watch(showDmModal, (open) => {
  if (open) loadOrgUsers();
});

watch(showChannelModal, (open) => {
  if (open) loadOrgUsers();
});

watch(conversationMatchIds, async (ids) => {
  if (!searchQuery.value.trim() || ids.size === 0) return;
  if (focusedSearchMessageId.value && ids.has(String(focusedSearchMessageId.value))) return;
  const first = [...ids][0];
  focusedSearchMessageId.value = first;
  await scrollToSearchMatch(first);
});

watch(draft, () => {
  if (!orgUsers.value.length && draft.value.includes('@')) loadOrgUsers();
});

onMounted(async () => {
  if (typeof window !== 'undefined') {
    mobileMql = window.matchMedia('(max-width: 767px)');
    mobileMql.addEventListener('change', onMobileMqChange);
    if (mobileMql.matches && (selectedSpaceId.value || route.query.spaceId)) {
      mobileShowConversation.value = true;
    }
  }

  await loadSpaces();
  if (selectedSpaceId.value) {
    if (mobileMql?.matches) mobileShowConversation.value = true;
    await loadMessages();
  }

  streamControls = createInternalChatStream({
    getToken: () => authStore.user?.token,
    onConnected: () => {
      streamLive.value = true;
    },
    onDisconnected: () => {
      streamLive.value = false;
    },
    onEvent: onStreamEvent,
  });
  streamControls.connect();
});

onUnmounted(() => {
  streamControls?.disconnect();
  streamControls = null;
  mobileMql?.removeEventListener('change', onMobileMqChange);
  mobileMql = null;
});
</script>
