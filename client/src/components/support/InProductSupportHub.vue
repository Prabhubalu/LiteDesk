<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-transform duration-300 ease-out"
      enter-from-class="translate-x-full"
      enter-to-class="translate-x-0"
      leave-active-class="transition-transform duration-250 ease-in"
      leave-from-class="translate-x-0"
      leave-to-class="translate-x-full"
    >
      <div
        v-if="panelOpen"
        class="fixed z-[9010]"
        :class="isResizing ? '' : 'transition-[width] duration-200 ease-out'"
        :style="assistantRailStyle"
      >
        <!-- Rail gap between App Shell and AI — resize slider -->
        <div
          class="absolute inset-y-0 left-0 z-20 flex cursor-col-resize touch-none items-center justify-center hover:bg-primary-500/10"
          :style="resizeGapStyle"
          role="separator"
          aria-orientation="vertical"
          :aria-label="t('liveChat.inAppResize')"
          :aria-valuenow="panelWidthPx"
          tabindex="0"
          @pointerdown.prevent="onResizePointerDown"
          @keydown.left.prevent="nudgePanelWidth(-16)"
          @keydown.right.prevent="nudgePanelWidth(16)"
        >
          <span
            class="pointer-events-none h-10 w-1 rounded-full"
            :class="isResizing ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-600'"
            aria-hidden="true"
          />
        </div>

        <div
          class="absolute inset-y-0 right-0 flex flex-col overflow-hidden"
          :class="assistantSurfaceClass"
          :style="{ width: `${panelWidthPx}px` }"
          role="dialog"
          :aria-label="t('liveChat.inAppTitle')"
        >
        <!-- Header: AI surface — history menu; New chat when in a thread -->
        <header
          v-if="isAiSurface"
          class="relative flex shrink-0 items-center justify-between gap-2 px-3 py-2"
        >
          <div class="relative min-w-0 flex-1">
            <button
              type="button"
              class="inline-flex max-w-full items-center gap-1 rounded-md px-1.5 py-1 text-[13px] font-medium text-gray-800 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800"
              :aria-expanded="newChatMenuOpen"
              @click="newChatMenuOpen = !newChatMenuOpen"
            >
              <span class="truncate">{{ aiHeaderMenuLabel }}</span>
              <ChevronDownIcon class="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" />
            </button>
            <div
              v-if="newChatMenuOpen"
              class="absolute left-0 top-full z-20 mt-1 w-64 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900"
            >
              <div
                v-if="recentAiConversations.length"
                class="py-1"
              >
                <button
                  v-for="item in recentAiConversations.slice(0, 6)"
                  :key="item.id"
                  type="button"
                  class="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
                  @click="void onOpenChatFromMenu(item.id)"
                >
                  <SparklesIcon class="h-3.5 w-3.5 shrink-0 text-primary-700 dark:text-primary-300" aria-hidden="true" />
                  <span class="min-w-0 flex-1 truncate text-xs text-gray-700 dark:text-gray-200">
                    {{ item.title || t('liveChat.inAppAiNewConversationTitle') }}
                  </span>
                </button>
              </div>
              <p
                v-else
                class="px-3 py-3 text-xs text-gray-500 dark:text-gray-400"
              >
                {{ t('liveChat.inAppAiConversationsEmpty') }}
              </p>
              <button
                type="button"
                class="flex w-full items-center gap-2 border-t border-gray-100 px-3 py-2.5 text-left text-xs font-medium text-primary-800 hover:bg-primary-50 dark:border-gray-800 dark:text-primary-200 dark:hover:bg-primary-500/10"
                @click="onViewAllChats"
              >
                <QueueListIcon class="h-3.5 w-3.5" aria-hidden="true" />
                {{ t('liveChat.inAppAiViewAllChats') }}
              </button>
            </div>
          </div>
          <div class="flex shrink-0 items-center gap-0.5">
            <button
              v-if="showAiNewChatButton"
              type="button"
              class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
              :aria-label="t('liveChat.inAppAiNewChat')"
              :title="t('liveChat.inAppAiNewChat')"
              @click="onNewChatFromMenu"
            >
              <PlusIcon class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {{ t('liveChat.inAppAiNewChat') }}
            </button>
            <button
              type="button"
              class="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              :aria-label="t('actions.close')"
              :title="t('actions.close')"
              @click="closePanel"
            >
              <ChevronDoubleRightIcon class="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </header>

        <header
          v-else
          class="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800"
        >
          <div class="flex min-w-0 items-center gap-2.5">
            <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-800 text-white dark:bg-primary-700">
              <SparklesIcon class="h-5 w-5" aria-hidden="true" />
            </div>
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-1.5">
                <h2 class="truncate text-sm font-semibold text-gray-900 dark:text-white">
                  {{ t('liveChat.inAppTitle') }}
                </h2>
                <span class="rounded-md bg-primary-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-800 dark:bg-primary-500/20 dark:text-primary-200">
                  {{ t('liveChat.inAppAiBadge') }}
                </span>
              </div>
              <p class="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <span class="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                {{ t('liveChat.inAppOnline') }}
              </p>
            </div>
          </div>
          <div class="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              class="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              :aria-label="t('actions.close')"
              @click="closePanel"
            >
              <XMarkIcon class="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </header>

        <!-- Context strip (hub / live chat only) -->
        <div
          v-if="!isAiSurface"
          class="flex shrink-0 flex-col gap-1 border-b border-gray-100 bg-gray-50 px-4 py-2 dark:border-gray-800 dark:bg-gray-950/60"
        >
          <div class="flex items-center gap-2">
            <MapPinIcon class="h-3.5 w-3.5 shrink-0 text-primary-700 dark:text-primary-300" aria-hidden="true" />
            <p class="flex min-w-0 flex-1 items-center gap-1 text-xs text-gray-600 dark:text-gray-300">
              <span class="shrink-0 text-gray-500 dark:text-gray-400">{{ t('liveChat.inAppYouAreIn') }}</span>
              <span class="min-w-0 truncate font-medium text-gray-900 dark:text-white">{{ locationLabel }}</span>
            </p>
          </div>
          <p
            v-if="pageContextHint"
            class="pl-5 text-[10px] font-medium text-primary-800 dark:text-primary-200"
          >
            {{ pageContextHint }}
          </p>
        </div>

        <!-- Home -->
        <div v-if="activeSection === 'home'" class="flex min-h-0 flex-1 flex-col">
          <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <p class="text-base font-semibold text-gray-900 dark:text-white">
              {{ t('liveChat.inAppGreeting', { name: greetName || t('liveChat.inAppGuestName') }) }}
            </p>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {{ t('liveChat.inAppHelpPrompt') }}
            </p>

            <div class="mt-4 grid grid-cols-2 gap-2">
              <button
                v-for="action in quickActions"
                :key="action.id"
                type="button"
                class="flex flex-col items-start gap-2 rounded-xl border border-gray-200 bg-white p-3 text-left transition hover:border-primary-300 hover:bg-primary-50/40 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-primary-500/40 dark:hover:bg-primary-500/10"
                @click="action.run()"
              >
                <component :is="action.icon" class="h-5 w-5 text-primary-700 dark:text-primary-300" aria-hidden="true" />
                <span class="text-xs font-medium text-gray-900 dark:text-gray-100">{{ action.label }}</span>
              </button>
            </div>

            <div class="mt-6">
              <div class="flex items-center justify-between gap-2">
                <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
                  {{ t('liveChat.inAppRecentTitle') }}
                </h3>
                <div class="flex items-center gap-1">
                  <button
                    v-if="canUseAi"
                    type="button"
                    class="rounded-lg px-2 py-1 text-[11px] font-medium text-primary-800 hover:bg-primary-50 dark:text-primary-200 dark:hover:bg-primary-500/10"
                    @click="void openFreshAiChat()"
                  >
                    {{ t('liveChat.inAppAiNewChat') }}
                  </button>
                  <button
                    v-if="canUseAi && allAiConversations.length"
                    type="button"
                    class="rounded-lg px-2 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
                    @click="openAiHistory"
                  >
                    {{ t('liveChat.inAppAiSeeAllConversations') }}
                  </button>
                </div>
              </div>
              <ul v-if="homeRecentItems.length" class="mt-2 space-y-1">
                <li v-for="item in homeRecentItems" :key="item.key">
                  <button
                    type="button"
                    class="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
                    @click="void openHomeRecent(item)"
                  >
                    <span
                      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                      :class="item.kind === 'ai'
                        ? 'bg-primary-50 text-primary-800 dark:bg-primary-500/20 dark:text-primary-200'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'"
                    >
                      <SparklesIcon v-if="item.kind === 'ai'" class="h-4 w-4" aria-hidden="true" />
                      <ChatBubbleLeftRightIcon v-else class="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span class="min-w-0 flex-1">
                      <span class="block truncate text-sm font-medium text-gray-900 dark:text-white">{{ item.title }}</span>
                      <span class="block text-xs text-gray-500 dark:text-gray-400">{{ formatRecentWhen(item.updatedAt) }}</span>
                    </span>
                  </button>
                </li>
              </ul>
              <p v-else class="mt-3 text-xs text-gray-500 dark:text-gray-400">
                {{ t('liveChat.inAppRecentEmpty') }}
              </p>
            </div>
          </div>

          <form
            class="shrink-0 border-t border-gray-100 p-3 dark:border-gray-800"
            @submit.prevent="onHomeAsk"
          >
            <div class="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-2 py-1.5 shadow-sm dark:border-gray-700 dark:bg-gray-950">
              <input
                v-model="draft"
                type="text"
                class="min-w-0 flex-1 border-0 bg-transparent px-2 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0 dark:text-white"
                :placeholder="t('liveChat.inAppAskPlaceholder')"
                autocomplete="off"
              />
              <button
                type="submit"
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-800 text-white hover:bg-primary-700 disabled:opacity-40 dark:bg-primary-700"
                :disabled="!draft.trim()"
                :aria-label="t('actions.send')"
              >
                <PaperAirplaneIcon class="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <p class="mt-2 text-center text-[10px] text-gray-400 dark:text-gray-500">
              {{ t('liveChat.inAppPoweredBy') }}
            </p>
          </form>
        </div>

        <!-- AI conversation list -->
        <div v-else-if="activeSection === 'ai-history'" class="flex min-h-0 flex-1 flex-col">
          <div class="flex shrink-0 items-center gap-1 border-b border-gray-100 px-2 py-1.5 dark:border-gray-800">
            <button
              type="button"
              class="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
              :aria-label="t('liveChat.inAppAiNewChat')"
              :title="t('liveChat.inAppAiNewChat')"
              @click="onNewChatFromMenu"
            >
              <ChevronLeftIcon class="h-4 w-4" aria-hidden="true" />
            </button>
            <span class="min-w-0 flex-1 truncate px-1 text-sm font-medium text-gray-900 dark:text-white">
              {{ t('liveChat.inAppAiConversationsTitle') }}
            </span>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            <ul v-if="allAiConversations.length" class="space-y-1">
              <li v-for="item in allAiConversations" :key="item.id">
                <button
                  type="button"
                  class="flex w-full items-start gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-gray-50 dark:hover:bg-gray-800"
                  :class="activeConversationId === item.id
                    ? 'bg-primary-50/70 dark:bg-primary-500/10'
                    : ''"
                  @click="void openAiConversationFromList(item.id)"
                >
                  <span class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-800 dark:bg-primary-500/20 dark:text-primary-200">
                    <SparklesIcon class="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-medium text-gray-900 dark:text-white">
                      {{ item.title || t('liveChat.inAppAiNewConversationTitle') }}
                    </span>
                    <span class="mt-0.5 block truncate text-xs text-gray-500 dark:text-gray-400">
                      {{ conversationPreview(item) }}
                    </span>
                    <span class="mt-1 block text-[11px] text-gray-400 dark:text-gray-500">
                      {{ formatRecentWhen(item.updatedAt) }}
                      · {{ t('liveChat.inAppAiMessageCount', { count: conversationMessageCount(item) }) }}
                    </span>
                  </span>
                </button>
              </li>
            </ul>
            <p v-else class="px-2 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              {{ t('liveChat.inAppAiConversationsEmpty') }}
            </p>
          </div>
        </div>

        <!-- AI composer / thread -->
        <div v-else-if="activeSection === 'ai'" class="flex min-h-0 flex-1 flex-col bg-white dark:bg-gray-950">
          <!-- Empty state (Brain-style) -->
          <div
            v-if="!aiMessages.length && !aiAsking"
            class="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-1 pt-1"
          >
            <div class="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
              <img
                src="/assets/logo/Ai%20Logo.svg"
                alt=""
                class="h-14 w-14 object-contain"
                aria-hidden="true"
              />
              <h3 class="arivu-hero-title mt-0.5 text-[26px] font-semibold tracking-tight">
                {{ t('liveChat.inAppAiBrandShort') }}
              </h3>
              <p class="mt-1.5 max-w-[16rem] text-[12px] leading-snug text-gray-500 dark:text-gray-400">
                {{ t('liveChat.inAppAiBrandTagline') }}
              </p>
            </div>
          </div>

          <!-- Active thread -->
          <div
            v-else
            ref="aiMessagesEl"
            class="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3"
          >
            <div
              v-for="msg in aiMessages"
              :key="msg.id"
              class="flex"
              :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
            >
              <div
                class="max-w-[92%] rounded-2xl px-3 py-2.5 text-sm"
                :class="msg.role === 'user'
                  ? 'bg-primary-800 text-white dark:bg-primary-700'
                  : 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'"
              >
                <p
                  v-if="msg.role === 'assistant' && msg.source"
                  class="mb-1.5 text-[10px] font-semibold uppercase tracking-wide opacity-70"
                >
                  {{ sourceBadge(msg) }}
                </p>

                <template v-if="msg.role === 'assistant' && hasStructured(msg)">
                  <p
                    v-if="msg.structured.headline || showTypingCaret(msg)"
                    class="text-sm font-semibold leading-snug text-gray-900 dark:text-white"
                  >
                    {{ displayHeadline(msg) }}<span
                      v-if="showTypingCaret(msg) && !displayBullets(msg).length && !displayActions(msg).length"
                      class="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-primary-600 align-middle dark:bg-primary-300"
                      aria-hidden="true"
                    />
                  </p>
                  <ul
                    v-if="displayBullets(msg).length"
                    class="mt-2 space-y-1.5"
                  >
                    <li
                      v-for="(bullet, idx) in displayBullets(msg)"
                      :key="`${msg.id}-b-${idx}`"
                      class="flex gap-2 text-[13px] leading-snug text-gray-700 dark:text-gray-200"
                    >
                      <span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-600 dark:bg-primary-300" aria-hidden="true" />
                      <span>{{ bullet }}</span>
                    </li>
                  </ul>
                  <div
                    v-if="displayActions(msg).length"
                    class="mt-3 space-y-2"
                  >
                    <p class="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      {{ t('liveChat.inAppAiNextActions') }}
                    </p>
                    <button
                      v-for="(action, aIdx) in displayActions(msg)"
                      :key="`${msg.id}-a-${aIdx}`"
                      type="button"
                      class="inline-flex w-full flex-col gap-1 rounded-xl border px-3 py-2.5 text-left transition"
                      :class="actionPriorityClass(action.priority)"
                      @click="onAssistantAction(action)"
                    >
                      <span class="flex items-start justify-between gap-2">
                        <span class="min-w-0 text-xs font-semibold leading-snug">{{ action.label }}</span>
                        <span class="shrink-0 rounded-md bg-black/5 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide opacity-80 dark:bg-white/10">
                          {{ actionKindLabel(action.kind) }}
                        </span>
                      </span>
                      <span
                        v-if="action.rationale || action.targetLabel"
                        class="text-[11px] leading-snug opacity-75"
                      >
                        {{ action.rationale || action.targetLabel }}
                      </span>
                      <div
                        v-if="action.email?.subject || action.email?.body"
                        class="mt-1 rounded-lg border border-black/5 bg-white/70 p-2 dark:border-white/10 dark:bg-black/20"
                      >
                        <p
                          v-if="action.email.subject"
                          class="text-[11px] font-medium text-gray-800 dark:text-gray-100"
                        >
                          {{ t('liveChat.inAppAiEmailSubject') }}: {{ action.email.subject }}
                        </p>
                        <p
                          v-if="action.email.body"
                          class="mt-1 line-clamp-4 whitespace-pre-wrap text-[11px] leading-snug text-gray-600 dark:text-gray-300"
                        >
                          {{ action.email.body }}
                        </p>
                        <p class="mt-1.5 text-[10px] font-semibold uppercase tracking-wide text-primary-700 dark:text-primary-300">
                          {{ t('liveChat.inAppAiOpenCompose') }}
                        </p>
                      </div>
                    </button>
                  </div>
                </template>
                <template v-else-if="msg.role === 'assistant' && hasStructuredHeadline(msg)">
                  <p class="text-sm font-semibold leading-snug text-gray-900 dark:text-white">
                    {{ displayHeadline(msg) }}<span
                      v-if="showTypingCaret(msg) && !displayBody(msg)"
                      class="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-primary-600 align-middle dark:bg-primary-300"
                      aria-hidden="true"
                    />
                  </p>
                  <p
                    v-if="displayBody(msg) && displayBody(msg) !== displayHeadline(msg)"
                    class="mt-2 whitespace-pre-wrap break-words text-[13px] leading-snug"
                  >
                    {{ displayBody(msg) }}<span
                      v-if="showTypingCaret(msg)"
                      class="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-primary-600 align-middle dark:bg-primary-300"
                      aria-hidden="true"
                    />
                  </p>
                </template>
                <p
                  v-else
                  class="whitespace-pre-wrap break-words"
                >
                  {{ msg.role === 'assistant' ? displayBody(msg) : msg.body }}<span
                    v-if="msg.role === 'assistant' && showTypingCaret(msg)"
                    class="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-primary-600 align-middle dark:bg-primary-300"
                    aria-hidden="true"
                  />
                </p>
              </div>
            </div>

            <p
              v-if="aiAsking"
              class="text-xs text-gray-500 dark:text-gray-400"
            >
              {{ t('liveChat.inAppAiThinking') }}
            </p>

            <p
              v-if="aiError"
              class="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-200"
            >
              {{ aiError }}
            </p>

            <div
              v-if="showTalkToAgentCta && isAvailable"
              class="pt-1"
            >
              <button
                type="button"
                class="inline-flex items-center gap-1.5 rounded-lg border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-800 hover:bg-primary-100 dark:border-primary-500/40 dark:bg-primary-500/10 dark:text-primary-200"
                @click="onTalkToAgentFromAi"
              >
                <UserGroupIcon class="h-3.5 w-3.5" aria-hidden="true" />
                {{ t('liveChat.inAppAiTalkToAgentCta') }}
              </button>
            </div>
          </div>

          <div class="shrink-0 px-3 pb-3 pt-1">
            <div
              v-if="!aiMessages.length && !aiAsking && contextualSuggestions.length"
              class="mb-2 flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <button
                v-for="item in contextualSuggestions"
                :key="item.id"
                type="button"
                class="inline-flex shrink-0 items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-gray-600 dark:hover:bg-gray-800"
                @click="onSuggestion(item.prompt)"
              >
                <component
                  :is="item.icon"
                  class="h-3 w-3 shrink-0 text-gray-400 dark:text-gray-500"
                  aria-hidden="true"
                />
                {{ item.label }}
              </button>
            </div>
            <form @submit.prevent="onAiSend">
            <div class="rounded-[22px] border border-gray-200 bg-white p-3 shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:border-gray-700 dark:bg-gray-900 dark:shadow-none">
              <div
                v-if="contextPillLabel"
                class="mb-2 inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300"
              >
                <QueueListIcon class="h-3 w-3 shrink-0 text-gray-400" aria-hidden="true" />
                <span class="min-w-0 truncate">{{ contextPillLabel }}</span>
              </div>
              <textarea
                v-model="draft"
                rows="2"
                class="min-h-[48px] w-full resize-none border-0 bg-transparent px-0.5 py-0.5 text-[13px] leading-relaxed text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0 dark:text-white dark:placeholder:text-gray-500"
                :placeholder="t('liveChat.inAppAskPlaceholder')"
                :disabled="aiAsking || !!typingMessageId"
                @keydown.enter.exact.prevent="onAiSend"
              />
              <div class="mt-1 flex items-center justify-between gap-2">
                <div class="flex items-center gap-0.5">
                  <span
                    class="inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-300 dark:text-gray-600"
                    aria-hidden="true"
                  >
                    <PlusIcon class="h-4 w-4" />
                  </span>
                </div>
                <button
                  type="submit"
                  class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-35 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                  :disabled="aiAsking || !!typingMessageId || !draft.trim()"
                  :aria-label="t('actions.send')"
                >
                  <PaperAirplaneIcon class="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
            </form>
          </div>
        </div>

        <!-- Chat -->
        <div v-else class="flex min-h-0 flex-1 flex-col">
          <div class="flex shrink-0 items-center gap-2 border-b border-gray-100 px-3 py-2 dark:border-gray-800">
            <button
              type="button"
              class="rounded-lg px-2 py-1 text-xs font-medium text-primary-800 hover:bg-primary-50 dark:text-primary-200 dark:hover:bg-primary-500/10"
              @click="goHome"
            >
              ← {{ t('liveChat.inAppBackHome') }}
            </button>
            <span class="min-w-0 flex-1 truncate text-xs text-gray-500 dark:text-gray-400">{{ identityLabel }}</span>
            <button
              v-if="!sessionClosed"
              type="button"
              class="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
              @click="onEndChat"
            >
              {{ t('liveChat.inAppEndChat') }}
            </button>
          </div>

          <div
            ref="messagesEl"
            class="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3"
          >
            <p
              v-if="welcomeMessage && !messages.length && !starting"
              class="rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-300"
            >
              {{ welcomeMessage }}
            </p>

            <div
              v-if="starting"
              class="flex items-center justify-center py-8 text-sm text-gray-500 dark:text-gray-400"
            >
              {{ t('states.loading') }}
            </div>

            <div
              v-for="msg in messages"
              :key="msg._id"
              class="flex"
              :class="msg.direction === 'inbound' ? 'justify-end' : 'justify-start'"
            >
              <div
                class="max-w-[85%] rounded-2xl px-3 py-2 text-sm"
                :class="msg.direction === 'inbound'
                  ? 'bg-primary-800 text-white dark:bg-primary-700'
                  : 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'"
              >
                <p class="whitespace-pre-wrap break-words">{{ msg.body }}</p>
              </div>
            </div>

            <p
              v-if="agentTyping"
              class="text-xs text-gray-500 dark:text-gray-400"
            >
              {{ t('liveChat.inAppAgentTyping') }}
            </p>

            <p
              v-if="sessionClosed"
              class="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
            >
              {{ t('liveChat.inAppSessionClosed') }}
            </p>

            <p
              v-if="chatError"
              class="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-200"
            >
              {{ chatError }}
            </p>
          </div>

          <form
            class="shrink-0 border-t border-gray-100 p-3 dark:border-gray-800"
            @submit.prevent="onSend"
          >
            <div class="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-2 py-1.5 shadow-sm dark:border-gray-700 dark:bg-gray-950">
              <input
                v-model="draft"
                type="text"
                class="min-w-0 flex-1 border-0 bg-transparent px-2 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0 dark:text-white"
                :placeholder="t('liveChat.inAppAskPlaceholder')"
                :disabled="sending || sessionClosed || starting"
                autocomplete="off"
              />
              <button
                type="submit"
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-800 text-white hover:bg-primary-700 disabled:opacity-40 dark:bg-primary-700"
                :disabled="sending || sessionClosed || starting || !draft.trim()"
                :aria-label="t('actions.send')"
              >
                <PaperAirplaneIcon class="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </form>
        </div>
      </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import {
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  ChevronDoubleRightIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ClipboardDocumentListIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  NewspaperIcon,
  PaperAirplaneIcon,
  PlusIcon,
  QueueListIcon,
  SparklesIcon,
  UserGroupIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline';
import { useAuthStore } from '@/stores/authRegistry';
import { useInProductSupportChat } from '@/composables/useInProductSupportChat';
import { useInProductAiAsk } from '@/composables/useInProductAiAsk';
import { resolvePageAiContext } from '@/utils/resolvePageAiContext';
import { resolveModuleRecordRoute } from '@/utils/resolveModuleRecordRoute';
import { getTabTitleMetaForPath, resolveTabTitle, getPersistedRecordTabName, isGenericRecordTabTitleKey } from '@/utils/navigationLabels';
import {
  SIDEBAR_SHELL_PADDING_REM,
  WORK_PANEL_SURFACE_CLASS,
} from '@/utils/sidebarLayout';
import { useTabs } from '@/composables/useTabs';

const { t, te } = useI18n();
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const { activeTab, tabs } = useTabs();
const messagesEl = ref(null);
const aiMessagesEl = ref(null);
const newChatMenuOpen = ref(false);

const assistantSurfaceClass = WORK_PANEL_SURFACE_CLASS;
/** Matches App Shell `p-2` inset on all sides of the AI rail (incl. App↔AI gutter). */
const ASSISTANT_SHELL_INSET_REM = SIDEBAR_SHELL_PADDING_REM;

function rootRemPx() {
  if (typeof document === 'undefined') return 16;
  const root = parseFloat(getComputedStyle(document.documentElement).fontSize);
  return Number.isFinite(root) && root > 0 ? root : 16;
}

function shellPaddingPx() {
  return ASSISTANT_SHELL_INSET_REM * rootRemPx();
}

function interPanelGapPx() {
  return shellPaddingPx();
}

const {
  isAvailable,
  bootstrapLoading,
  panelOpen,
  activeSection,
  recentConversations,
  messages,
  draft,
  starting,
  sending,
  sessionClosed,
  chatError,
  welcomeMessage,
  visitor,
  greetName,
  agentTyping,
  loadBootstrap,
  openPanel,
  openChat,
  openAiAsk,
  openAiThread,
  openAiHistory,
  goHome,
  closePanel,
  sendMessage,
  endSession,
} = useInProductSupportChat();

const PANEL_WIDTH_STORAGE_KEY = 'litedesk_arivu_assistant_panel_width_v1';
const PANEL_WIDTH_MIN = 320;
const PANEL_WIDTH_DEFAULT_RATIO = 0.3;
const PANEL_WIDTH_MAX_RATIO = 0.3;

const panelWidthPx = ref(420);
const isResizing = ref(false);
let resizePointerId = null;
/** Skip padding transition on the first restore so App Shell doesn't slide on refresh. */
let railSyncReady = false;

const assistantRailStyle = computed(() => {
  const inset = shellPaddingPx();
  const gap = interPanelGapPx();
  return {
    top: `${inset}px`,
    right: `${inset}px`,
    bottom: `${inset}px`,
    // Inter-panel gap (slider) + AI panel width
    width: `${panelWidthPx.value + gap}px`,
  };
});

const resizeGapStyle = computed(() => ({
  width: `${interPanelGapPx()}px`,
}));

function clampPanelWidth(px) {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const inset = shellPaddingPx();
  const gap = interPanelGapPx();
  const max = Math.max(
    PANEL_WIDTH_MIN,
    Math.round(vw * PANEL_WIDTH_MAX_RATIO) - inset - gap,
  );
  const min = Math.min(PANEL_WIDTH_MIN, max);
  return Math.min(max, Math.max(min, Math.round(Number(px) || PANEL_WIDTH_MIN)));
}

function loadStoredPanelWidth() {
  try {
    const raw = localStorage.getItem(PANEL_WIDTH_STORAGE_KEY);
    const n = Number(raw);
    if (Number.isFinite(n) && n >= PANEL_WIDTH_MIN) {
      panelWidthPx.value = clampPanelWidth(n);
      return;
    }
  } catch {
    /* ignore */
  }
  panelWidthPx.value = clampPanelWidth(
    (typeof window !== 'undefined' ? window.innerWidth : 1280) * PANEL_WIDTH_DEFAULT_RATIO,
  );
}

loadStoredPanelWidth();

function persistPanelWidth() {
  try {
    localStorage.setItem(PANEL_WIDTH_STORAGE_KEY, String(panelWidthPx.value));
  } catch {
    /* ignore */
  }
}

function syncAssistantRail({ animate = true } = {}) {
  const open = Boolean(panelOpen.value);
  const inset = shellPaddingPx();
  const gap = interPanelGapPx();
  // Panel + inter-panel gap + right shell inset.
  const width = open ? panelWidthPx.value + gap + inset : 0;
  if (!animate) {
    document.body.classList.add('arivu-assistant-resizing');
  }
  document.documentElement.style.setProperty('--arivu-assistant-rail', `${width}px`);
  document.body.style.paddingRight = width ? `${width}px` : '';
  document.body.classList.toggle('arivu-assistant-rail-open', open);
  // Collapse App Shell's right p-2 so the inter-panel gap isn't doubled.
  document.documentElement.style.setProperty(
    '--arivu-work-panel-pad-right',
    open ? '0px' : '',
  );
  window.dispatchEvent(new CustomEvent('arivu:assistant-rail', { detail: { open } }));
  if (!animate) {
    // Keep transition suppressed through the first layout frame after restore.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.body.classList.remove('arivu-assistant-resizing');
      });
    });
  }
}

function setPanelWidth(px, { persist = true } = {}) {
  panelWidthPx.value = clampPanelWidth(px);
  syncAssistantRail();
  if (persist) persistPanelWidth();
}

function nudgePanelWidth(delta) {
  setPanelWidth(panelWidthPx.value + delta);
}

function onResizePointerDown(event) {
  const handle = event.currentTarget;
  if (!(handle instanceof HTMLElement)) return;
  isResizing.value = true;
  resizePointerId = event.pointerId;
  handle.setPointerCapture(event.pointerId);
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
  document.body.classList.add('arivu-assistant-resizing');

  const startX = event.clientX;
  const startWidth = panelWidthPx.value;

  const onMove = (ev) => {
    if (ev.pointerId !== resizePointerId) return;
    // Drag left → wider AI; gap width stays shell pad.
    setPanelWidth(startWidth + (startX - ev.clientX), { persist: false });
  };
  const onUp = (ev) => {
    if (ev.pointerId !== resizePointerId) return;
    isResizing.value = false;
    resizePointerId = null;
    try {
      handle.releasePointerCapture(ev.pointerId);
    } catch {
      /* ignore */
    }
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.body.classList.remove('arivu-assistant-resizing');
    handle.removeEventListener('pointermove', onMove);
    handle.removeEventListener('pointerup', onUp);
    handle.removeEventListener('pointercancel', onUp);
    persistPanelWidth();
    syncAssistantRail();
  };
  handle.addEventListener('pointermove', onMove);
  handle.addEventListener('pointerup', onUp);
  handle.addEventListener('pointercancel', onUp);
}

function onWindowResize() {
  setPanelWidth(panelWidthPx.value, { persist: false });
}

const {
  aiMessages,
  aiAsking,
  aiError,
  recentAiConversations,
  allAiConversations,
  activeConversationId,
  askAssistant,
  startNewConversation,
  openConversation,
  displayHeadline,
  displayBody,
  displayBullets,
  displayActions,
  showTypingCaret,
  typingMessageId,
  typingProgress,
} = useInProductAiAsk();

const hideOnAgentWorkspace = computed(() => String(route.path || '').startsWith('/live-chat'));

const canUseAi = computed(() => Boolean(authStore.isAuthenticated));

const isAiSurface = computed(() =>
  activeSection.value === 'ai' || activeSection.value === 'ai-history',
);

const showAiNewChatButton = computed(() =>
  activeSection.value === 'ai'
  && (aiMessages.value.length > 0 || Boolean(aiAsking.value)),
);

const aiHeaderMenuLabel = computed(() => {
  if (showAiNewChatButton.value) return activeAiConversationTitle.value;
  return t('liveChat.inAppAiNewChat');
});

const contextPillLabel = computed(() => {
  const ctx = resolvePageAiContext(route);
  if (!ctx) return '';
  if (ctx.kind === 'record') {
    const recordName = currentRecordContextName();
    if (recordName) return recordName;
  }
  const place = String(locationLabel.value || '').trim();
  if (!place) return ctx.moduleKey;
  const short = place.includes('·') ? place.split('·').pop()?.trim() : place;
  return short || place;
});

function tabForCurrentRoute() {
  const pathBase = String(route.path || '').split('?')[0];
  const matched = (tabs.value || []).find((tab) => String(tab?.path || '').split('?')[0] === pathBase);
  return matched || activeTab.value || null;
}

function currentRecordContextName() {
  const tab = tabForCurrentRoute();
  if (!tab) return '';
  const fromRecord = String(tab.recordTitle || '').trim();
  if (fromRecord) return fromRecord;
  const fromParams = String(tab.titleParams?.name || tab.params?.name || '').trim();
  if (fromParams) return fromParams;
  if (isGenericRecordTabTitleKey(tab.titleKey)) return '';
  return getPersistedRecordTabName(tab);
}

const contextualSuggestions = computed(() => {
  const ctx = resolvePageAiContext(route);
  const place = contextPillLabel.value || t('liveChat.inAppAiSection');
  if (ctx?.kind === 'record') {
    return [
      {
        id: 'sum-rec',
        label: t('liveChat.inAppAiSuggestShortSummarize'),
        prompt: t('liveChat.inAppAiSuggestSummarizeRecord'),
        icon: ClipboardDocumentListIcon,
      },
      {
        id: 'nba-rec',
        label: t('liveChat.inAppAiSuggestShortNext'),
        prompt: t('liveChat.inAppAiSuggestNextActionRecord'),
        icon: SparklesIcon,
      },
      {
        id: 'research-rec',
        label: t('liveChat.inAppAiSuggestShortResearch'),
        prompt: t('liveChat.inAppAiSuggestResearchRecord'),
        icon: MagnifyingGlassIcon,
      },
      {
        id: 'risk-rec',
        label: t('liveChat.inAppAiSuggestShortRisks'),
        prompt: t('liveChat.inAppAiSuggestRisksRecord'),
        icon: CalendarDaysIcon,
      },
    ];
  }
  if (ctx?.kind === 'list') {
    return [
      {
        id: 'sum-list',
        label: t('liveChat.inAppAiSuggestShortSummarize'),
        prompt: t('liveChat.inAppAiSuggestSummarizeList', { place }),
        icon: ClipboardDocumentListIcon,
      },
      {
        id: 'count-list',
        label: t('liveChat.inAppAiSuggestShortCount'),
        prompt: t('liveChat.inAppAiSuggestCountList', { place }),
        icon: QueueListIcon,
      },
      {
        id: 'prio-list',
        label: t('liveChat.inAppAiSuggestShortPrioritize'),
        prompt: t('liveChat.inAppAiSuggestPrioritizeList', { place }),
        icon: SparklesIcon,
      },
      {
        id: 'stale-list',
        label: t('liveChat.inAppAiSuggestShortStale'),
        prompt: t('liveChat.inAppAiSuggestFindStaleList', { place }),
        icon: CalendarDaysIcon,
      },
    ];
  }
  return [
    {
      id: 'help',
      label: t('liveChat.inAppAiSuggestShortHelp'),
      prompt: t('liveChat.inAppAiSuggestGenericHelp'),
      icon: SparklesIcon,
    },
    {
      id: 'search',
      label: t('liveChat.inAppAiSuggestShortSearch'),
      prompt: t('liveChat.inAppAiSuggestGenericSearch'),
      icon: MagnifyingGlassIcon,
    },
  ];
});

const pageContextHint = computed(() => {
  const ctx = resolvePageAiContext(route);
  if (!ctx) return '';
  if (ctx.kind === 'record') return t('liveChat.inAppAiRecordContext');
  if (ctx.kind === 'list') return t('liveChat.inAppAiPageContext');
  return '';
});

function sourceBadge(msg) {
  if (msg?.source === 'agent') {
    const name = String(msg?.meta?.agentName || '').trim();
    return name
      ? t('liveChat.inAppAiFromAgentNamed', { name })
      : t('liveChat.inAppAiFromAgent');
  }
  if (msg?.source === 'graph') return t('liveChat.inAppAiFromRecord');
  if (msg?.source === 'page') return t('liveChat.inAppAiFromPage');
  if (msg?.source === 'knowledge') return t('liveChat.inAppAiFromKnowledge');
  return '';
}

function hasStructured(msg) {
  const s = msg?.structured;
  if (!s) return false;
  return Boolean(
    s.headline
    || (s.bullets && s.bullets.length)
    || (s.actions && s.actions.length),
  );
}

function hasStructuredHeadline(msg) {
  return Boolean(msg?.structured?.headline);
}

function actionPriorityClass(priority) {
  if (priority === 'high') {
    return 'border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-50 dark:hover:bg-amber-900/50';
  }
  if (priority === 'low') {
    return 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800';
  }
  return 'border-primary-200 bg-white text-primary-900 hover:bg-primary-50 dark:border-primary-500/40 dark:bg-gray-900 dark:text-primary-100 dark:hover:bg-primary-500/10';
}

function actionKindLabel(kind) {
  const key = String(kind || '');
  if (key === 'send_email') return t('liveChat.inAppAiActionEmail');
  if (key === 'complete_task') return t('liveChat.inAppAiActionTask');
  if (key === 'follow_up') return t('liveChat.inAppAiActionFollowUp');
  if (key === 'review_record') return t('liveChat.inAppAiActionReview');
  if (key === 'update_status') return t('liveChat.inAppAiActionUpdate');
  if (key === 'talk_to_agent') return t('liveChat.inAppAiTalkToAgentCta');
  return t('liveChat.inAppAiActionDo');
}

async function onAssistantAction(action) {
  if (!action) return;
  if (action.kind === 'talk_to_agent') {
    await onTalkToAgentFromAi();
    return;
  }

  if (action.kind === 'send_email' || action.email) {
    const draft = {
      to: String(action.email?.to || '').trim(),
      subject: String(action.email?.subject || action.label || '').trim(),
      body: String(action.email?.body || '').trim(),
      relatedModuleKey: action.moduleKey || '',
      relatedRecordId: action.recordId || '',
    };
    window.dispatchEvent(new CustomEvent('arivu:open-email-compose', { detail: draft }));
    closePanel();
    return;
  }

  // Navigate to the record where the human should perform the proposed work.
  if (action.moduleKey && action.recordId) {
    const dest = resolveModuleRecordRoute(action.moduleKey, action.recordId);
    if (!dest) return;
    closePanel();
    if (dest.name) {
      await router.push({ name: dest.name, params: dest.params });
    } else if (dest.path) {
      await router.push(dest.path);
    }
  }
}

const showTalkToAgentCta = computed(() => {
  if (aiAsking.value) return false;
  if (aiError.value) return true;
  const last = aiMessages.value[aiMessages.value.length - 1];
  if (!last || last.role !== 'assistant') return false;
  if (!last.source) return true;
  return looksLikeNoAnswer(last.body);
});

function looksLikeNoAnswer(body) {
  const text = String(body || '').toLowerCase();
  return (
    text.includes('could not find an answer')
    || text.includes('talk to agent')
    || text.includes('cannot create')
    || text.includes("can't create")
    || text.includes('i cannot')
  );
}

async function onTalkToAgentFromAi() {
  const draftText = t('liveChat.inAppReportIssueDraft');
  await openChat({ draft: draftText });
}

const identityLabel = computed(() => {
  const v = visitor.value;
  if (v?.name && v?.email) return `${v.name} · ${v.email}`;
  return v?.name || v?.email || '';
});

const locationLabel = computed(() => {
  const ctx = resolvePageAiContext(route);
  if (ctx?.kind === 'record') {
    const recordName = currentRecordContextName();
    if (recordName) return recordName;
  }
  const meta = getTabTitleMetaForPath(route.path, route.params || {});
  const title = resolveTabTitle(
    { path: route.path, params: route.params, titleKey: meta.titleKey, titleParams: meta.titleParams },
    t,
    te,
  );
  return title || route.path || '—';
});

const quickActions = computed(() => {
  const actions = [];
  if (canUseAi.value) {
    actions.push({
      id: 'ask',
      label: t('liveChat.inAppAskQuestion'),
      icon: SparklesIcon,
      run: () => { void openFreshAiChat(); },
    });
  }
  actions.push(
    {
      id: 'whats-new',
      label: t('liveChat.inAppWhatsNew'),
      icon: NewspaperIcon,
      run: () => {
        window.dispatchEvent(new CustomEvent('arivu:open-whats-new'));
        closePanel();
      },
    },
    {
      id: 'search',
      label: t('liveChat.inAppSearchHelp'),
      icon: MagnifyingGlassIcon,
      run: () => {
        window.dispatchEvent(new CustomEvent('arivu:open-global-search'));
        closePanel();
      },
    },
  );
  if (isAvailable.value) {
    actions.push({
      id: 'report',
      label: t('liveChat.inAppReportIssue'),
      icon: UserGroupIcon,
      run: () => {
        void openChat({ draft: t('liveChat.inAppReportIssueDraft') });
      },
    });
  }
  return actions;
});

const homeRecentItems = computed(() => {
  const aiItems = (recentAiConversations.value || []).map((c) => ({
    key: `ai:${c.id}`,
    kind: 'ai',
    id: c.id,
    title: c.title || t('liveChat.inAppAiNewConversationTitle'),
    updatedAt: c.updatedAt,
  }));
  const chatItems = (recentConversations.value || []).map((c) => ({
    key: `chat:${c.sessionId}`,
    kind: 'chat',
    id: c.sessionId,
    title: c.title,
    updatedAt: c.updatedAt,
  }));
  return [...aiItems, ...chatItems]
    .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
    .slice(0, 12);
});

const activeAiConversationTitle = computed(() => {
  const id = activeConversationId.value;
  const fromList = id
    ? (allAiConversations.value || []).find((c) => c.id === id)
      || (recentAiConversations.value || []).find((c) => c.id === id)
    : null;
  if (fromList?.title) return fromList.title;
  const firstUser = (aiMessages.value || []).find((m) => m.role === 'user' && String(m.body || '').trim());
  const text = String(firstUser?.body || '').replace(/\s+/g, ' ').trim();
  if (text) return text.length > 48 ? `${text.slice(0, 45)}…` : text;
  return t('liveChat.inAppAiNewConversationTitle');
});

async function openFreshAiChat() {
  newChatMenuOpen.value = false;
  await startNewConversation();
  openAiAsk();
}

function onOpenAssistantEvent() {
  if (hideOnAgentWorkspace.value) return;
  if (panelOpen.value) {
    closePanel();
    return;
  }
  if (canUseAi.value) {
    void openFreshAiChat();
    return;
  }
  if (isAvailable.value) {
    openPanel();
  }
}

async function onNewChatFromMenu() {
  await openFreshAiChat();
}

async function onOpenChatFromMenu(conversationId) {
  newChatMenuOpen.value = false;
  await openAiConversationFromList(conversationId);
}

function onViewAllChats() {
  newChatMenuOpen.value = false;
  openAiHistory();
}

async function onSuggestion(prompt) {
  const text = String(prompt || '').trim();
  if (!text) return;
  draft.value = text;
  await onAiSend();
}

async function openAiConversationFromList(conversationId) {
  const ok = await openConversation(conversationId);
  if (!ok) return;
  openAiThread();
  await nextTick();
  scrollAiMessages();
}

function conversationMessageCount(item) {
  if (Number.isFinite(Number(item?.messageCount))) return Number(item.messageCount);
  return Array.isArray(item?.messages) ? item.messages.length : 0;
}

function conversationPreview(item) {
  const messages = Array.isArray(item?.messages) ? item.messages : [];
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const text = String(
    lastAssistant?.structured?.headline
    || lastAssistant?.body
    || lastUser?.body
    || item?.title
    || '',
  ).replace(/\s+/g, ' ').trim();
  if (!text) return t('liveChat.inAppAiConversationsEmptyPreview');
  return text.length > 80 ? `${text.slice(0, 77)}…` : text;
}

async function openHomeRecent(item) {
  if (!item) return;
  if (item.kind === 'ai') {
    await openAiConversationFromList(item.id);
    return;
  }
  await openChat();
}

function formatRecentWhen(ts) {
  const ms = Number(ts) || 0;
  if (!ms) return '';
  const diff = Date.now() - ms;
  const day = 24 * 60 * 60 * 1000;
  if (diff < day) return t('liveChat.inAppRecentToday');
  if (diff < 2 * day) return t('liveChat.inAppRecentYesterday');
  const days = Math.max(2, Math.floor(diff / day));
  return t('liveChat.inAppRecentDaysAgo', { days });
}

async function runAiTurn() {
  const text = draft.value.trim();
  if (!text || aiAsking.value || typingMessageId.value) return;
  draft.value = '';
  await askAssistant(text);
  await nextTick();
  scrollAiMessages();
}

async function onHomeAsk() {
  const text = draft.value.trim();
  if (!text) return;
  if (canUseAi.value) {
    await startNewConversation();
    openAiThread();
    await runAiTurn();
    return;
  }
  if (!isAvailable.value) return;
  await openChat();
  await sendMessage();
  await nextTick();
  scrollMessages();
}

async function onAiSend() {
  await runAiTurn();
}

async function onSend() {
  await sendMessage();
  await nextTick();
  scrollMessages();
}

async function onEndChat() {
  await endSession();
  goHome();
}

function scrollMessages() {
  if (messagesEl.value) {
    messagesEl.value.scrollTop = messagesEl.value.scrollHeight;
  }
}

function scrollAiMessages() {
  if (aiMessagesEl.value) {
    aiMessagesEl.value.scrollTop = aiMessagesEl.value.scrollHeight;
  }
}

watch(
  () => messages.value.length,
  async () => {
    await nextTick();
    scrollMessages();
  },
);

watch(
  () => aiMessages.value.length,
  async () => {
    await nextTick();
    scrollAiMessages();
  },
);

watch(
  () => typingProgress.value,
  async () => {
    if (!typingMessageId.value) return;
    await nextTick();
    scrollAiMessages();
  },
);

watch(
  () => [panelOpen.value, panelWidthPx.value],
  () => {
    syncAssistantRail({ animate: railSyncReady });
    railSyncReady = true;
  },
  { immediate: true },
);

watch(
  () => activeSection.value,
  () => {
    newChatMenuOpen.value = false;
  },
);

onMounted(() => {
  syncAssistantRail({ animate: false });
  railSyncReady = true;
  window.addEventListener('resize', onWindowResize);
  window.addEventListener('arivu:open-assistant', onOpenAssistantEvent);
  void loadBootstrap();
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', onWindowResize);
  window.removeEventListener('arivu:open-assistant', onOpenAssistantEvent);
  document.documentElement.style.removeProperty('--arivu-assistant-rail');
  document.documentElement.style.removeProperty('--arivu-work-panel-pad-right');
  document.body.style.paddingRight = '';
  document.body.classList.remove('arivu-assistant-rail-open');
  document.body.classList.remove('arivu-assistant-resizing');
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
});
</script>

<style>
html {
  --arivu-assistant-rail: 0px;
}

body {
  transition: padding-right 0.3s ease-out;
}

/* Match PlatformShell canvas in the rail gap (not page white). */
body.arivu-assistant-rail-open {
  background-color: rgb(245 245 245); /* neutral-100 */
}

html.dark body.arivu-assistant-rail-open {
  background-color: rgb(23 23 23); /* neutral-900 */
}

body.arivu-assistant-resizing {
  transition: none !important;
}

.arivu-hero-title {
  font-family: inherit;
  letter-spacing: -0.03em;
  background-image: linear-gradient(
    100deg,
    rgb(17 24 39) 0%,
    rgb(17 24 39) 38%,
    #8e2ef7 46%,
    #3277fe 50%,
    #06d0fa 54%,
    #ff4e66 58%,
    rgb(17 24 39) 66%,
    rgb(17 24 39) 100%
  );
  background-size: 240% 100%;
  background-position: 100% 0;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
  animation: arivu-hero-title-shimmer 3.6s ease-in-out infinite;
}

:global(html.dark) .arivu-hero-title {
  background-image: linear-gradient(
    100deg,
    rgb(255 255 255) 0%,
    rgb(255 255 255) 38%,
    #8e2ef7 46%,
    #3277fe 50%,
    #06d0fa 54%,
    #ff4e66 58%,
    rgb(255 255 255) 66%,
    rgb(255 255 255) 100%
  );
}

@keyframes arivu-hero-title-shimmer {
  0%,
  18% {
    background-position: 100% 0;
  }
  55%,
  100% {
    background-position: 0% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .arivu-hero-title {
    animation: none;
    background: none;
    color: rgb(17 24 39);
    -webkit-text-fill-color: currentColor;
  }

  :global(html.dark) .arivu-hero-title {
    color: rgb(255 255 255);
  }
}
</style>
