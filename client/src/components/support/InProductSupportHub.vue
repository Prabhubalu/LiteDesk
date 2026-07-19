<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <button
        v-if="panelOpen && isSheetLayout"
        type="button"
        class="fixed inset-0 z-[9005] bg-black/40 dark:bg-black/55"
        :aria-label="t('actions.close')"
        @click="closePanel"
      />
    </Transition>

    <Transition
      :enter-active-class="panelMotion?.enterActive"
      :enter-from-class="panelMotion?.enterFrom"
      :enter-to-class="panelMotion?.enterTo"
      :leave-active-class="panelMotion?.leaveActive"
      :leave-from-class="panelMotion?.leaveFrom"
      :leave-to-class="panelMotion?.leaveTo"
    >
      <div
        v-if="panelOpen"
        class="fixed z-[9010]"
        :class="isSheetLayout
          ? 'inset-x-0 bottom-0 top-auto flex h-[min(85dvh,780px)] max-h-[92dvh] flex-col'
          : (isResizing ? '' : 'transition-[width] duration-200 ease-out')"
        :style="isSheetLayout ? undefined : assistantRailStyle"
      >
        <!-- Rail gap between App Shell and AI — resize slider (desktop only) -->
        <div
          v-if="!isSheetLayout"
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
          class="flex flex-col overflow-hidden"
          :class="isSheetLayout ? assistantSheetSurfaceClass : ['absolute inset-y-0 right-0', assistantSurfaceClass]"
          :style="isSheetLayout ? undefined : { width: `${panelWidthPx}px` }"
          role="dialog"
          :aria-modal="isSheetLayout ? 'true' : undefined"
          :aria-label="t('liveChat.inAppTitle')"
        >
        <div
          v-if="isSheetLayout"
          class="flex shrink-0 justify-center pb-1 pt-2"
          aria-hidden="true"
        >
          <span class="h-1 w-10 rounded-full bg-neutral-300 dark:bg-neutral-600" />
        </div>
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
              <XMarkIcon
                v-if="isSheetLayout"
                class="h-4 w-4"
                aria-hidden="true"
              />
              <ChevronDoubleRightIcon
                v-else
                class="h-4 w-4"
                aria-hidden="true"
              />
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
          <!-- Empty state (post-intro) -->
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
              <p class="mt-1.5 max-w-[16rem] text-[13px] font-medium leading-snug text-gray-700 dark:text-gray-200">
                {{ t('liveChat.inAppAiMeetTagline') }}
              </p>
              <p class="mt-1.5 max-w-[16rem] text-[12px] leading-snug text-gray-500 dark:text-gray-400">
                {{ t('liveChat.inAppAiBrandTagline') }}
              </p>
            </div>
          </div>

          <!-- Active thread -->
          <div
            v-else
            ref="aiMessagesEl"
            class="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-4"
          >
            <div
              v-for="msg in aiMessages"
              :key="msg.id"
              class="flex"
              :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
            >
              <!-- User: bordered bubble (Brain-style) -->
              <div
                v-if="msg.role === 'user'"
                class="max-w-[85%] rounded-2xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              >
                <p class="whitespace-pre-wrap break-words">{{ msg.body }}</p>
              </div>

              <!-- Astra: open text + logo header (no gray bubble) -->
              <div
                v-else
                class="max-w-[92%] text-sm text-gray-900 dark:text-gray-100"
              >
                <div class="mb-2 flex items-center gap-1.5">
                  <img
                    src="/assets/logo/Ai%20Logo.svg"
                    alt=""
                    class="h-4 w-4 object-contain"
                    aria-hidden="true"
                  />
                  <span class="text-[13px] font-semibold text-gray-900 dark:text-white">
                    {{ t('liveChat.inAppTitle') }}
                  </span>
                  <span
                    v-if="assistantAgentLabel(msg)"
                    class="truncate text-[11px] font-medium text-gray-400 dark:text-gray-500"
                  >
                    · {{ assistantAgentLabel(msg) }}
                  </span>
                </div>

                <template v-if="hasStructured(msg)">
                  <p
                    v-if="msg.structured.headline || showTypingCaret(msg)"
                    class="text-sm font-semibold leading-snug text-gray-900 dark:text-white"
                  >
                    {{ displayHeadline(msg) }}<span
                      v-if="showTypingCaret(msg) && !displayBullets(msg).length && !displayDetail(msg) && !displayActions(msg).length"
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
                      <span>{{ bullet }}<span
                        v-if="showTypingCaret(msg) && idx === displayBullets(msg).length - 1 && !displayDetail(msg) && !displayClarifyingQuestions(msg).length"
                        class="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-primary-600 align-middle dark:bg-primary-300"
                        aria-hidden="true"
                      /></span>
                    </li>
                  </ul>
                  <div
                    v-if="displayVisuals(msg).length"
                    class="mt-1"
                  >
                    <AstraVisualStack :visuals="displayVisuals(msg)" />
                  </div>
                  <div
                    v-if="displayClarifyingQuestions(msg).length"
                    class="mt-3 rounded-xl border border-amber-200/80 bg-amber-50/80 p-3 dark:border-amber-700/50 dark:bg-amber-950/30"
                  >
                    <p class="text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                      {{ t('liveChat.inAppAiNeedDetails') }}
                    </p>
                    <ul class="mt-2 space-y-1.5">
                      <li
                        v-for="(q, qIdx) in displayClarifyingQuestions(msg)"
                        :key="`${msg.id}-q-${qIdx}`"
                        class="text-[13px] leading-snug text-amber-950 dark:text-amber-50"
                      >
                        {{ qIdx + 1 }}. {{ q }}
                      </li>
                    </ul>
                    <p class="mt-2 text-[11px] text-amber-800/80 dark:text-amber-200/80">
                      {{ t('liveChat.inAppAiNeedDetailsHint') }}
                    </p>
                  </div>
                  <p
                    v-if="displayDetail(msg)"
                    class="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-gray-700 dark:text-gray-200"
                  >
                    {{ displayDetail(msg) }}<span
                      v-if="showTypingCaret(msg) && !displayClarifyingQuestions(msg).length && !displayActions(msg).length"
                      class="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-primary-600 align-middle dark:bg-primary-300"
                      aria-hidden="true"
                    />
                  </p>
                  <div
                    v-if="displayActions(msg).filter((a) => !a.applied).length"
                    class="mt-3 space-y-2"
                  >
                    <p class="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      {{ t('liveChat.inAppAiNextActions') }}
                    </p>
                    <button
                      v-for="(action, aIdx) in displayActions(msg).filter((a) => !a.applied)"
                      :key="`${msg.id}-a-${aIdx}`"
                      type="button"
                      class="inline-flex w-full flex-col gap-1 rounded-xl border px-3 py-2.5 text-left transition"
                      :class="actionPriorityClass(action.priority)"
                      @click.stop="onAssistantAction(action)"
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
                <template v-else-if="hasStructuredHeadline(msg)">
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
                  class="whitespace-pre-wrap break-words leading-relaxed"
                >
                  {{ displayBody(msg) }}<span
                    v-if="showTypingCaret(msg)"
                    class="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-primary-600 align-middle dark:bg-primary-300"
                    aria-hidden="true"
                  />
                </p>
              </div>
            </div>

            <div
              v-if="aiAsking"
              class="flex items-center gap-2 py-1 text-[13px] text-gray-500 dark:text-gray-400"
            >
              <img
                src="/assets/logo/Ai%20Logo.svg"
                alt=""
                class="h-4 w-4 animate-pulse object-contain"
                aria-hidden="true"
              />
              <span>{{ astraWorkingLabel }}</span>
            </div>

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
                ref="aiComposerEl"
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

  <!-- Full-page Astra cinematic intro (first open only) -->
  <Teleport to="body">
    <Transition leave-active-class="astra-intro-leave">
      <div
        v-if="showAstraIntro"
        class="astra-intro fixed inset-0 z-[9200] flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        :aria-label="t('liveChat.inAppAiMeetTitle')"
      >
        <div
          class="astra-intro__bg"
          aria-hidden="true"
          @animationend="onAstraBgRevealEnd"
        >
          <div class="astra-intro__mesh" />
          <div class="astra-intro__glow" />
          <div class="astra-intro__vignette" />
        </div>
        <button
          type="button"
          class="astra-intro__close absolute right-5 top-5 z-10 rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white sm:right-8 sm:top-8"
          :aria-label="t('actions.close')"
          @click="dismissAstraIntro(false)"
        >
          <XMarkIcon class="h-5 w-5" aria-hidden="true" />
        </button>
        <div class="astra-intro__content relative z-[1] flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center sm:px-10">
          <img
            src="/assets/logo/Ai%20Logo.svg"
            alt=""
            class="astra-intro__logo h-28 w-28 object-contain sm:h-36 sm:w-36"
            aria-hidden="true"
          />
          <h2 class="arivu-hero-title astra-intro__title mt-0 text-[42px] font-semibold tracking-tight sm:text-[56px]">
            {{ t('liveChat.inAppAiMeetTitle') }}
          </h2>
          <p class="astra-intro__tagline mt-1 max-w-lg text-[18px] font-normal leading-snug text-white/85 sm:text-[22px]">
            {{ t('liveChat.inAppAiBrandTagline') }}
          </p>
          <div class="mt-8 flex flex-wrap items-center justify-center gap-2">
            <span
              v-for="cap in astraIntroCapabilities"
              :key="cap"
              class="astra-intro__chip"
            >
              {{ cap }}
            </span>
          </div>
          <button
            type="button"
            class="astra-intro__cta mt-10"
            @click="dismissAstraIntro(true)"
          >
            {{ t('liveChat.inAppAiIntroCta') }}
          </button>
          <button
            type="button"
            class="astra-intro__skip mt-4 text-[13px] font-medium text-white/45 hover:text-white/75"
            @click="dismissAstraIntro(false)"
          >
            {{ t('liveChat.inAppAiIntroSkip') }}
          </button>
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
import AstraVisualStack from '@/components/support/AstraVisualStack.vue';
import { resolvePageAiContext } from '@/utils/resolvePageAiContext';
import { resolveModuleRecordRoute } from '@/utils/resolveModuleRecordRoute';
import { openContentStudioFromAstraAction } from '@/utils/openContentStudioFromAstra';
import { openArivuCanvasFromAstraAction } from '@/utils/openArivuCanvasFromAstra';
import {
  openReportBuilderFromAstraAction,
  openReportFromAstraAction,
  publishReportFromAstraAction,
  exportReportFromAstraAction,
  pinReportFromAstraAction,
  openWidgetFromAstraAction,
  openDashboardFromAstraAction,
} from '@/utils/openReportFromAstra';
import apiClient from '@/utils/apiClient';
import { getTabTitleMetaForPath, resolveTabTitle, getPersistedRecordTabName, isGenericRecordTabTitleKey } from '@/utils/navigationLabels';
import {
  SIDEBAR_SHELL_PADDING_REM,
  WORK_PANEL_SURFACE_CLASS,
} from '@/utils/sidebarLayout';
import { useTabs } from '@/composables/useTabs';
import { playAstraIntroResolveSound, playAstraIntroSound } from '@/utils/astraIntroSound';

const { t, te } = useI18n();
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const { activeTab, tabs } = useTabs();
const messagesEl = ref(null);
const aiMessagesEl = ref(null);
const aiComposerEl = ref(null);
const newChatMenuOpen = ref(false);
const showAstraIntro = ref(false);
const astraWorkingLabel = ref('');

const assistantSurfaceClass = WORK_PANEL_SURFACE_CLASS;
/** Bottom sheet chrome — same surfaces as work panel, top-rounded for mobile/tablet. */
const assistantSheetSurfaceClass =
  'relative h-full min-h-0 w-full overflow-hidden rounded-t-2xl border border-b-0 border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_32px_-8px_rgba(15,23,42,0.18)] dark:border-neutral-700 dark:bg-neutral-900 dark:shadow-[0_-8px_32px_-8px_rgba(0,0,0,0.45)]';
/** Matches App Shell `p-2` inset on all sides of the AI rail (incl. App↔AI gutter). */
const ASSISTANT_SHELL_INSET_REM = SIDEBAR_SHELL_PADDING_REM;

/** Below Tailwind `lg` (1024px): bottom sheet instead of docked side rail. */
const ASSISTANT_SHEET_MQ = '(max-width: 1023px)';
const isSheetLayout = ref(
  typeof window !== 'undefined' && window.matchMedia(ASSISTANT_SHEET_MQ).matches,
);
let sheetMq = null;

const panelMotion = computed(() => {
  if (isSheetLayout.value) {
    return {
      enterActive: 'transition-transform duration-300 ease-out',
      enterFrom: 'translate-y-full',
      enterTo: 'translate-y-0',
      leaveActive: 'transition-transform duration-250 ease-in',
      leaveFrom: 'translate-y-0',
      leaveTo: 'translate-y-full',
    };
  }
  return {
    enterActive: 'transition-transform duration-300 ease-out',
    enterFrom: 'translate-x-full',
    enterTo: 'translate-x-0',
    leaveActive: 'transition-transform duration-250 ease-in',
    leaveFrom: 'translate-x-0',
    leaveTo: 'translate-x-full',
  };
});

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
  const sheet = isSheetLayout.value;
  const inset = shellPaddingPx();
  const gap = interPanelGapPx();
  // Docked rail only — sheet overlays and must not push the App Shell.
  const width = open && !sheet ? panelWidthPx.value + gap + inset : 0;
  if (!animate) {
    document.body.classList.add('arivu-assistant-resizing');
  }
  document.documentElement.style.setProperty('--arivu-assistant-rail', `${width}px`);
  document.body.style.paddingRight = width ? `${width}px` : '';
  document.body.classList.toggle('arivu-assistant-rail-open', open && !sheet);
  // Collapse App Shell's right p-2 so the inter-panel gap isn't doubled.
  document.documentElement.style.setProperty(
    '--arivu-work-panel-pad-right',
    width ? '0px' : '',
  );
  if (open && sheet) {
    document.body.style.overflow = 'hidden';
  } else if (!document.body.classList.contains('astra-intro-lock')) {
    document.body.style.overflow = '';
  }
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

function onSheetMqChange(e) {
  isSheetLayout.value = e.matches;
  syncAssistantRail({ animate: false });
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
  displayDetail,
  displayVisuals,
  displayClarifyingQuestions,
  displayActions,
  showTypingCaret,
  typingMessageId,
  typingProgress,
} = useInProductAiAsk();

const ASTRA_WORKING_KEYS = [
  'liveChat.inAppAiWorking',
  'liveChat.inAppAiWorkingOnIt',
  'liveChat.inAppAiWorkingGathering',
  'liveChat.inAppAiWorkingAnalyzing',
  'liveChat.inAppAiWorkingDigging',
  'liveChat.inAppAiWorkingAlmost',
];

watch(aiAsking, (asking) => {
  if (!asking) return;
  const key = ASTRA_WORKING_KEYS[Math.floor(Math.random() * ASTRA_WORKING_KEYS.length)];
  astraWorkingLabel.value = t(key);
});

const hideOnAgentWorkspace = computed(() => String(route.path || '').startsWith('/live-chat'));

const canUseAi = computed(() => {
  if (!authStore.isAuthenticated) return false;
  if (authStore.isExternalUser) return false;
  const path = String(route.path || '');
  if (path.startsWith('/portal') || path.startsWith('/live-chat')) return false;
  return true;
});

const astraIntroCapabilities = computed(() => [
  t('liveChat.inAppAiCapabilityAsk'),
  t('liveChat.inAppAiCapabilitySummarize'),
  t('liveChat.inAppAiCapabilityResearch'),
  t('liveChat.inAppAiCapabilityNextAction'),
]);

function astraIntroStorageKey() {
  const userId = authStore.user?._id ? String(authStore.user._id) : '';
  const orgId = authStore.organization?._id
    ? String(authStore.organization._id)
    : (authStore.user?.organizationId ? String(authStore.user.organizationId) : '');
  if (!userId || !orgId) return null;
  return `litedesk_astra_intro_seen_v1:${orgId}:${userId}`;
}

function hasSeenAstraIntro() {
  const key = astraIntroStorageKey();
  if (!key) return true;
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return true;
  }
}

function markAstraIntroSeen() {
  const key = astraIntroStorageKey();
  if (key) {
    try {
      localStorage.setItem(key, '1');
    } catch {
      /* ignore */
    }
  }
  window.dispatchEvent(new CustomEvent('arivu:astra-intro', { detail: { seen: true } }));
}

function maybeRevealAstraIntro() {
  if (!canUseAi.value) return false;
  if (hasSeenAstraIntro()) return false;
  showAstraIntro.value = true;
  document.body.classList.add('astra-intro-lock');
  playAstraIntroSound();
  return true;
}

async function openAstraPanelAfterIntro() {
  newChatMenuOpen.value = false;
  await startNewConversation();
  openAiAsk();
  await nextTick();
  await new Promise((resolve) => {
    window.setTimeout(resolve, 320);
  });
  const el = aiComposerEl.value;
  if (el && typeof el.focus === 'function') {
    el.focus();
  }
}

async function dismissAstraIntro(openAssistant) {
  markAstraIntroSeen();
  showAstraIntro.value = false;

  if (!openAssistant) {
    document.body.classList.remove('astra-intro-lock');
    return;
  }

  playAstraIntroResolveSound();
  // Let cinematic fade start, then slide the panel in while it finishes.
  await new Promise((resolve) => {
    window.setTimeout(resolve, 180);
  });
  document.body.classList.remove('astra-intro-lock');
  await openAstraPanelAfterIntro();
}

function onAstraBgRevealEnd(event) {
  if (event.target !== event.currentTarget) return;
  if (event?.animationName !== 'astra-intro-bg-reveal') return;
  const el = event.currentTarget;
  if (!(el instanceof HTMLElement)) return;
  el.style.webkitMaskImage = 'none';
  el.style.maskImage = 'none';
  el.style.animation = 'none';
}

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

function assistantAgentLabel(msg) {
  // Astra presents as a single identity; the internal specialist that routed
  // the answer is never surfaced (avoids confusing "random agent" personas).
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
    || (s.clarifyingQuestions && s.clarifyingQuestions.length)
    || s.detail
    || (s.actions && s.actions.length)
    || (s.visuals && s.visuals.length),
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
  if (key === 'create_record') return t('liveChat.inAppAiActionCreate');
  if (key === 'update_record') return t('liveChat.inAppAiActionApplyUpdate');
  if (key === 'open_content_studio') return t('liveChat.inAppAiActionContentStudio');
  if (key === 'open_canvas') return t('liveChat.inAppAiActionCanvas');
  if (key === 'open_report_builder') return t('liveChat.inAppAiActionReportBuilder');
  if (key === 'open_report') return t('liveChat.inAppAiActionOpenReport');
  if (key === 'publish_report') return t('liveChat.inAppAiActionPublishReport');
  if (key === 'export_report') return t('liveChat.inAppAiActionExportReport');
  if (key === 'pin_report_to_dashboard') return t('liveChat.inAppAiActionPinReport');
  if (key === 'open_widget') return t('liveChat.inAppAiActionOpenWidget');
  if (key === 'open_dashboard') return t('liveChat.inAppAiActionOpenDashboard');
  return t('liveChat.inAppAiActionDo');
}

async function onAssistantAction(action) {
  if (!action) return;
  if (action.kind === 'talk_to_agent') {
    await onTalkToAgentFromAi();
    return;
  }

  if (action.kind === 'open_canvas') {
    try {
      const result = await openArivuCanvasFromAstraAction(router, action, {
        fallbackDetail: String(
          aiMessages.value.slice().reverse().find((m) => m.role === 'assistant')?.structured?.detail
          || '',
        ),
        fallbackHeadline: String(
          aiMessages.value.slice().reverse().find((m) => m.role === 'assistant')?.structured?.headline
          || '',
        ),
      });
      if (!result.ok) {
        aiError.value = result.error || t('liveChat.inAppAiCanvasOpenFailed');
        return;
      }
      aiMessages.value.push({
        id: `a-${Date.now()}`,
        role: 'assistant',
        body: t('liveChat.inAppAiCanvasOpened'),
        source: 'agent',
        createdAt: Date.now(),
      });
      await nextTick();
      scrollAiMessages();
    } catch (err) {
      aiError.value = err?.message || t('liveChat.inAppAiCanvasOpenFailed');
    }
    return;
  }

  if (action.kind === 'open_content_studio' || action.kind === 'draft_deck') {
    try {
      const result = await openContentStudioFromAstraAction(router, action, {
        fallbackDetail: String(
          aiMessages.value.slice().reverse().find((m) => m.role === 'assistant')?.structured?.detail
          || '',
        ),
      });
      if (!result.ok) {
        aiError.value = result.error || t('liveChat.inAppAiContentStudioOpenFailed');
        return;
      }
      aiMessages.value.push({
        id: `a-${Date.now()}`,
        role: 'assistant',
        body: t('liveChat.inAppAiContentStudioOpened'),
        source: 'agent',
        createdAt: Date.now(),
      });
      await nextTick();
      scrollAiMessages();
    } catch (err) {
      aiError.value = err?.message || t('liveChat.inAppAiContentStudioOpenFailed');
    }
    return;
  }

  if (action.kind === 'open_report_builder') {
    const result = await openReportBuilderFromAstraAction(router, action);
    if (!result.ok) {
      aiError.value = result.error || t('liveChat.inAppAiReportOpenFailed');
    } else {
      aiMessages.value.push({
        id: `a-${Date.now()}`,
        role: 'assistant',
        body: t('liveChat.inAppAiReportBuilderOpened'),
        source: 'agent',
        createdAt: Date.now(),
      });
      await nextTick();
      scrollAiMessages();
    }
    return;
  }

  if (action.kind === 'open_report') {
    const result = await openReportFromAstraAction(router, action);
    if (!result.ok) {
      aiError.value = result.error || t('liveChat.inAppAiReportOpenFailed');
    }
    return;
  }

  if (action.kind === 'publish_report') {
    const result = await publishReportFromAstraAction(router, action);
    if (!result.ok) {
      aiError.value = result.error || t('liveChat.inAppAiReportPublishFailed');
      return;
    }
    aiMessages.value.push({
      id: `a-${Date.now()}`,
      role: 'assistant',
      body: t('liveChat.inAppAiReportPublished'),
      source: 'agent',
      createdAt: Date.now(),
    });
    await nextTick();
    scrollAiMessages();
    return;
  }

  if (action.kind === 'export_report') {
    const result = await exportReportFromAstraAction(action);
    if (!result.ok) {
      aiError.value = result.error || t('liveChat.inAppAiReportExportFailed');
      return;
    }
    aiMessages.value.push({
      id: `a-${Date.now()}`,
      role: 'assistant',
      body: t('liveChat.inAppAiReportExported'),
      source: 'agent',
      createdAt: Date.now(),
    });
    await nextTick();
    scrollAiMessages();
    return;
  }

  if (action.kind === 'pin_report_to_dashboard') {
    const result = await pinReportFromAstraAction(router, action);
    if (!result.ok) {
      aiError.value = result.error || t('liveChat.inAppAiReportPinFailed');
      return;
    }
    aiMessages.value.push({
      id: `a-${Date.now()}`,
      role: 'assistant',
      body: t('liveChat.inAppAiReportPinned', { name: result.dashboardName || 'dashboard' }),
      source: 'agent',
      createdAt: Date.now(),
    });
    await nextTick();
    scrollAiMessages();
    return;
  }

  if (action.kind === 'open_widget') {
    const result = await openWidgetFromAstraAction(router, action);
    if (!result.ok) {
      aiError.value = result.error || t('liveChat.inAppAiWidgetOpenFailed');
    }
    return;
  }

  if (action.kind === 'open_dashboard') {
    const result = await openDashboardFromAstraAction(router, action);
    if (!result.ok) {
      aiError.value = result.error || t('liveChat.inAppAiDashboardOpenFailed');
    }
    return;
  }

  // Astra CRM mutations — user confirms by clicking; never delete.
  if (action.kind === 'create_record' || action.kind === 'update_record') {
    const moduleKey = String(action.moduleKey || '').trim().toLowerCase();
    const fields = action.fields && typeof action.fields === 'object' ? { ...action.fields } : {};
    if (!moduleKey || !Object.keys(fields).length) {
      aiError.value = t('liveChat.inAppAiMutationIncomplete');
      return;
    }
    const lastUser = [...aiMessages.value].reverse().find((m) => m.role === 'user');
    if (/\b(force\s+create|create\s+anyway|create\s+a\s+new\s+one|duplicate\s+ok|new\s+meeting\s+anyway)\b/i
      .test(String(lastUser?.body || ''))) {
      fields.forceCreate = true;
      fields.forceCreateReason = String(lastUser?.body || 'create anyway');
    }
    const page = resolvePageAiContext(route);
    try {
      const data = await apiClient.post('/ai/astra/mutations/apply', {
        op: action.kind === 'create_record' ? 'create' : 'update',
        moduleKey,
        recordId: action.recordId || '',
        fields,
        appKey: page?.appKey || 'SALES',
        pageModuleKey: page?.moduleKey || '',
        pageRecordId: page?.kind === 'record' ? (page.recordId || '') : '',
      });
      const rid = data?.recordId ? String(data.recordId) : '';
      aiMessages.value.push({
        id: `a-${Date.now()}`,
        role: 'assistant',
        body: action.kind === 'create_record'
          ? t('liveChat.inAppAiMutationCreated', { module: moduleKey, id: rid })
          : t('liveChat.inAppAiMutationUpdated', { module: moduleKey, id: rid || action.recordId || '' }),
        source: 'agent',
        createdAt: Date.now(),
      });
      await nextTick();
      scrollAiMessages();
      if (action.kind === 'create_record' && rid) {
        const dest = resolveModuleRecordRoute(moduleKey, rid);
        if (dest?.name) await router.push({ name: dest.name, params: dest.params });
        else if (dest?.path) await router.push(dest.path);
      }
    } catch (err) {
      const code = err?.response?.data?.code || '';
      const msg = err?.response?.data?.message || err?.message || t('liveChat.inAppAiMutationFailed');
      aiError.value = String(msg);
      if (code === 'AI_ASTRA_DUPLICATE') {
        const dup = err?.response?.data?.details?.duplicates?.[0];
        if (dup?.moduleKey && dup?.recordId) {
          aiMessages.value.push({
            id: `a-${Date.now()}`,
            role: 'assistant',
            body: t('liveChat.inAppAiDuplicateBlocked', { label: dup.label || 'existing record' }),
            source: 'agent',
            createdAt: Date.now(),
            structured: {
              headline: t('liveChat.inAppAiDuplicateHeadline'),
              bullets: [
                t('liveChat.inAppAiDuplicateBlocked', { label: dup.label || 'existing record' }),
                t('liveChat.inAppAiDuplicateCreateAnyway'),
              ],
              actions: [{
                label: t('liveChat.inAppAiDuplicateOpenExisting', { label: dup.label || 'record' }),
                kind: 'review_record',
                moduleKey: dup.moduleKey,
                recordId: dup.recordId,
                priority: 'high',
              }],
            },
          });
          await nextTick();
          scrollAiMessages();
        }
      }
    }
    return;
  }

  // Draft email — open compose; keep Assistant open.
  if (action.kind === 'send_email' || action.email?.subject || action.email?.body || action.email?.to) {
    const draft = {
      to: String(action.email?.to || '').trim(),
      subject: String(action.email?.subject || action.label || '').trim(),
      body: String(action.email?.body || '').trim(),
      relatedModuleKey: action.moduleKey || '',
      relatedRecordId: action.recordId || '',
    };
    window.dispatchEvent(new CustomEvent('arivu:open-email-compose', { detail: draft }));
    return;
  }

  const moduleKey = String(action.moduleKey || '').trim().toLowerCase();
  const recordId = String(action.recordId || '').trim();
  const page = resolvePageAiContext(route);
  const isSameRecord = Boolean(
    page?.kind === 'record'
    && page.moduleKey === moduleKey
    && page.recordId === recordId,
  );
  const navigableKinds = new Set([
    'complete_task',
    'review_record',
    'follow_up',
    'update_status',
    'open_record',
  ]);

  // Open a different CRM record where the work should happen; keep Assistant open.
  if (
    moduleKey
    && recordId
    && !isSameRecord
    && navigableKinds.has(String(action.kind || ''))
  ) {
    const dest = resolveModuleRecordRoute(moduleKey, recordId);
    if (!dest) return;
    if (dest.name) {
      await router.push({ name: dest.name, params: dest.params });
    } else if (dest.path) {
      await router.push(dest.path);
    }
    return;
  }

  // DO NEXT / manual / same-record proposals: continue via Agent router (panel stays open).
  const followUp = [String(action.label || '').trim(), String(action.rationale || '').trim()]
    .filter(Boolean)
    .join(' — ');
  if (!followUp || aiAsking.value || typingMessageId.value) return;
  await askAssistant(followUp);
  await nextTick();
  scrollAiMessages();
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
  if (!canUseAi.value) return;
  if (showAstraIntro.value) return;
  if (panelOpen.value) {
    closePanel();
    return;
  }
  if (maybeRevealAstraIntro()) return;
  void openFreshAiChat();
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

async function maybeAutoOpenReportBuilder() {
  const last = [...aiMessages.value].reverse().find((m) => m.role === 'assistant');
  const actions = last?.structured?.actions;
  if (!Array.isArray(actions)) return;
  const reportAction = actions.find((a) => {
    if (String(a?.kind || '') !== 'open_report_builder') return false;
    if (a.executeNow) return true;
    const fields = a.fields && typeof a.fields === 'object' ? a.fields : {};
    return Boolean(fields.autoOpen);
  });
  if (!reportAction) return;
  await onAssistantAction(reportAction);
}

async function maybeAutoOpenWidget() {
  const last = [...aiMessages.value].reverse().find((m) => m.role === 'assistant');
  const actions = last?.structured?.actions;
  if (!Array.isArray(actions)) return;
  const widgetAction = actions.find((a) => {
    if (String(a?.kind || '') !== 'open_widget') return false;
    if (a.executeNow) return true;
    const fields = a.fields && typeof a.fields === 'object' ? a.fields : {};
    return Boolean(fields.autoOpen);
  });
  if (!widgetAction) return;
  await onAssistantAction(widgetAction);
}

async function runAiTurn() {
  const text = draft.value.trim();
  if (!text || aiAsking.value || typingMessageId.value) return;
  draft.value = '';
  await askAssistant(text);
  await nextTick();
  scrollAiMessages();
  await maybeAutoOpenReportBuilder();
  await maybeAutoOpenWidget();
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
  () => [panelOpen.value, panelWidthPx.value, isSheetLayout.value],
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
  if (typeof window !== 'undefined') {
    sheetMq = window.matchMedia(ASSISTANT_SHEET_MQ);
    isSheetLayout.value = sheetMq.matches;
    sheetMq.addEventListener('change', onSheetMqChange);
  }
  window.addEventListener('resize', onWindowResize);
  window.addEventListener('arivu:open-assistant', onOpenAssistantEvent);
  void loadBootstrap();
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', onWindowResize);
  window.removeEventListener('arivu:open-assistant', onOpenAssistantEvent);
  sheetMq?.removeEventListener('change', onSheetMqChange);
  sheetMq = null;
  document.documentElement.style.removeProperty('--arivu-assistant-rail');
  document.documentElement.style.removeProperty('--arivu-work-panel-pad-right');
  document.body.style.paddingRight = '';
  document.body.style.overflow = '';
  document.body.classList.remove('arivu-assistant-rail-open');
  document.body.classList.remove('arivu-assistant-resizing');
  document.body.classList.remove('astra-intro-lock');
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

body.astra-intro-lock {
  overflow: hidden;
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

.astra-intro .arivu-hero-title {
  background-image: linear-gradient(
    100deg,
    rgb(255 255 255) 0%,
    rgb(255 255 255) 38%,
    #a78bfa 46%,
    #6049E7 50%,
    #5037d9 54%,
    #4527a0 58%,
    rgb(255 255 255) 66%,
    rgb(255 255 255) 100%
  );
}

html.dark .arivu-hero-title {
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

  html.dark .arivu-hero-title,
  .astra-intro .arivu-hero-title {
    color: rgb(255 255 255);
  }

  .astra-intro__orb-ring,
  .astra-intro__glow,
  .astra-intro__mesh,
  .astra-intro__bg,
  .astra-intro__content,
  .astra-intro__close,
  .astra-intro__logo,
  .astra-intro__title,
  .astra-intro__tagline,
  .astra-intro__chip,
  .astra-intro__cta,
  .astra-intro__skip,
  .astra-intro-leave {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
    clip-path: none !important;
    -webkit-mask-image: none !important;
    mask-image: none !important;
  }
}

.astra-intro-leave {
  animation: astra-intro-fade-out 0.55s ease-in-out both;
}

@property --astra-reveal {
  syntax: '<percentage>';
  inherits: false;
  initial-value: 0%;
}

@property --astra-feather {
  syntax: '<percentage>';
  inherits: false;
  initial-value: 28%;
}

.astra-intro {
  --ai-c1: #6049E7;
  --ai-c2: #5037d9;
  --ai-c3: #a78bfa;
  --ai-c4: #4527a0;
  --ai-c5: #3a1f8a;
  background: transparent;
  -webkit-backdrop-filter: blur(8px) saturate(1.08);
  backdrop-filter: blur(8px) saturate(1.08);
}

.astra-intro__bg {
  pointer-events: none;
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, #0b0f1a 72%, color-mix(in srgb, var(--ai-c1) 24%, transparent));
  --astra-reveal: 0%;
  --astra-feather: 28%;
  -webkit-mask-image: radial-gradient(
    circle at 50% 48%,
    #000 0%,
    #000 var(--astra-reveal),
    transparent calc(var(--astra-reveal) + var(--astra-feather))
  );
  mask-image: radial-gradient(
    circle at 50% 48%,
    #000 0%,
    #000 var(--astra-reveal),
    transparent calc(var(--astra-reveal) + var(--astra-feather))
  );
  animation: astra-intro-bg-reveal 1.9s ease-in-out forwards;
}

html.dark .astra-intro__bg {
  background: color-mix(in srgb, #000 48%, color-mix(in srgb, var(--ai-c1) 16%, transparent));
}

.astra-intro__mesh {
  pointer-events: none;
  position: absolute;
  inset: -18%;
  width: 136%;
  height: 136%;
  background:
    radial-gradient(ellipse 70% 50% at 30% 20%, color-mix(in srgb, var(--ai-c1) 36%, transparent), transparent 65%),
    radial-gradient(ellipse 55% 45% at 75% 35%, color-mix(in srgb, var(--ai-c3) 22%, transparent), transparent 60%),
    radial-gradient(ellipse 50% 40% at 20% 75%, color-mix(in srgb, var(--ai-c2) 26%, transparent), transparent 58%),
    radial-gradient(ellipse 60% 45% at 80% 80%, color-mix(in srgb, var(--ai-c4) 20%, transparent), transparent 60%);
  transform: translate3d(0, 0, 0) scale(1);
  animation: astra-intro-mesh 24s ease-in-out 2.1s infinite alternate;
}

.astra-intro__glow {
  pointer-events: none;
  position: absolute;
  left: 50%;
  top: 36%;
  height: min(80vw, 560px);
  width: min(80vw, 560px);
  margin-left: calc(min(80vw, 560px) / -2);
  margin-top: calc(min(80vw, 560px) / -2);
  border-radius: 9999px;
  background: radial-gradient(
    circle,
    color-mix(in srgb, var(--ai-c1) 30%, transparent) 0%,
    color-mix(in srgb, var(--ai-c2) 16%, transparent) 42%,
    transparent 72%
  );
  filter: blur(36px);
  opacity: 0.9;
  transform: translate3d(0, 0, 0) scale(1);
  animation: astra-intro-glow 18s ease-in-out 2.1s infinite alternate;
}

.astra-intro__vignette {
  pointer-events: none;
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at center, transparent 36%, rgb(0 0 0 / 0.52) 100%);
}

html.dark .astra-intro__vignette {
  background: radial-gradient(ellipse at center, transparent 42%, rgb(0 0 0 / 0.45) 100%);
}

.astra-intro__content,
.astra-intro__close {
  opacity: 0;
  animation: astra-intro-content-in 0.7s ease-out 2.05s forwards;
}

.astra-intro__logo {
  display: block;
  opacity: 0;
  filter: drop-shadow(0 0 28px color-mix(in srgb, var(--ai-c2) 40%, transparent));
  animation: astra-intro-rise 0.75s ease-out 2.1s forwards;
}

.astra-intro__title {
  opacity: 0;
  animation:
    astra-intro-rise 0.75s ease-out 2.22s forwards,
    arivu-hero-title-shimmer 3.6s ease-in-out 3s infinite;
}

.astra-intro__tagline {
  opacity: 0;
  animation: astra-intro-rise 0.75s ease-out 2.34s forwards;
}

.astra-intro__chip {
  display: inline-flex;
  align-items: center;
  border-radius: 9999px;
  border: 1px solid rgb(255 255 255 / 0.16);
  background: rgb(255 255 255 / 0.1);
  padding: 0.45rem 0.95rem;
  font-size: 13px;
  font-weight: 500;
  color: rgb(255 255 255 / 0.88);
  backdrop-filter: blur(8px);
  opacity: 0;
  animation: astra-intro-rise 0.65s ease-out forwards;
}

.astra-intro__chip:nth-child(1) { animation-delay: 2.44s; }
.astra-intro__chip:nth-child(2) { animation-delay: 2.5s; }
.astra-intro__chip:nth-child(3) { animation-delay: 2.56s; }
.astra-intro__chip:nth-child(4) { animation-delay: 2.62s; }

.astra-intro__cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 12.5rem;
  border-radius: 9999px;
  border: 0;
  background: linear-gradient(105deg, var(--ai-c1), var(--ai-c2) 45%, var(--ai-c3));
  padding: 0.9rem 1.75rem;
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  box-shadow: 0 16px 40px color-mix(in srgb, var(--ai-c2) 45%, transparent);
  opacity: 0;
  animation: astra-intro-rise 0.7s ease-out 2.68s forwards;
  transition: transform 0.15s ease, filter 0.15s ease;
}

.astra-intro__cta:hover {
  transform: translateY(-1px) scale(1.03);
  filter: brightness(1.06);
}

.astra-intro__skip {
  opacity: 0;
  animation: astra-intro-rise 0.6s ease-out 2.78s forwards;
}

@keyframes astra-intro-bg-reveal {
  0% {
    --astra-reveal: 0%;
    --astra-feather: 28%;
  }
  70% {
    --astra-reveal: 85%;
    --astra-feather: 20%;
  }
  100% {
    --astra-reveal: 150%;
    --astra-feather: 0%;
  }
}

@keyframes astra-intro-content-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes astra-intro-glow {
  from {
    opacity: 0.85;
    transform: translate3d(0, 0, 0) scale(1);
  }
  to {
    opacity: 0.95;
    transform: translate3d(5%, -3%, 0) scale(1.06);
  }
}

@keyframes astra-intro-mesh {
  from {
    transform: translate3d(0, 0, 0) scale(1);
  }
  to {
    transform: translate3d(2.5%, 1.5%, 0) scale(1.03);
  }
}

@keyframes astra-intro-rise {
  from {
    opacity: 0;
    transform: translate3d(0, 12px, 0);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

@keyframes astra-intro-fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}
</style>
