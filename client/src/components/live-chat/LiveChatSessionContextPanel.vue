<template>
  <aside
    class="flex h-full min-h-0 w-full shrink-0 flex-col overflow-hidden bg-[#FAFAF8] dark:bg-gray-900"
    :aria-label="t('liveChat.visitorContextTitle')"
  >
    <header class="flex items-center gap-2 border-b border-[#EBEBEB] px-3 py-2.5 dark:border-gray-800">
      <div class="min-w-0 flex-1">
        <h3 class="truncate text-[13px] font-semibold text-[#37352F] dark:text-white">
          {{ t('liveChat.visitorContextTitle') }}
        </h3>
        <p v-if="visitorSubtitle" class="truncate text-[11px] text-[#9B9A97] dark:text-gray-500">
          {{ visitorSubtitle }}
        </p>
      </div>
      <button
        type="button"
        class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#787774] hover:bg-black/[0.04] dark:text-gray-400 dark:hover:bg-white/5"
        :title="t('liveChat.visitorContextCollapse')"
        :aria-label="t('liveChat.visitorContextCollapse')"
        @click="emit('close')"
      >
        <ChevronRightIcon class="h-4 w-4" aria-hidden="true" />
      </button>
    </header>

    <div v-if="loading" class="flex flex-1 items-center justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
    </div>

    <div v-else-if="error" class="flex flex-1 items-center justify-center p-6 text-sm text-rose-600 dark:text-rose-300">
      {{ error }}
    </div>

    <div v-else class="arivu-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
      <div class="border-b border-[#EBEBEB] px-4 py-4 text-center dark:border-gray-800">
        <div class="relative mx-auto w-fit">
          <AvatarInitials
            :first-name="visitorFirstName"
            :last-name="visitorLastName"
            :email="visitor?.email"
            size="lg"
          />
          <span
            class="absolute bottom-0 right-0 h-3 w-3 rounded-full ring-2 ring-white dark:ring-gray-900"
            :class="visitorOnline ? 'bg-emerald-500' : 'bg-gray-400 dark:bg-gray-500'"
            aria-hidden="true"
          />
        </div>
        <h4 class="mt-3 text-[15px] font-semibold text-[#37352F] dark:text-white">{{ displayName }}</h4>
        <p v-if="lifecycleLabel" class="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-[#2383E2] dark:text-blue-400">
          {{ lifecycleLabel }}
        </p>
      </div>

      <section class="border-b border-[#EBEBEB] dark:border-gray-800">
        <button
          type="button"
          class="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
          :aria-expanded="isSectionExpanded('details')"
          @click="toggleSection('details')"
        >
          <h5 class="text-[11px] font-medium uppercase tracking-wide text-[#9B9A97] dark:text-gray-500">
            {{ t('liveChat.contextSectionDetails') }}
          </h5>
          <ChevronDownIcon
            class="h-4 w-4 shrink-0 text-[#9B9A97] transition-transform duration-200 dark:text-gray-500"
            :class="isSectionExpanded('details') ? 'rotate-180' : ''"
            aria-hidden="true"
          />
        </button>
        <dl v-show="isSectionExpanded('details')" class="space-y-2 px-4 pb-3 text-[13px]">
          <div v-if="visitor?.email" class="flex justify-between gap-3">
            <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('liveChat.visitorEmail') }}</dt>
            <dd class="truncate font-medium text-[#37352F] dark:text-white">{{ visitor.email }}</dd>
          </div>
          <div v-if="visitor?.phone" class="flex justify-between gap-3">
            <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('liveChat.visitorPhone') }}</dt>
            <dd class="truncate font-medium text-[#37352F] dark:text-white">{{ visitor.phone }}</dd>
          </div>
          <div v-if="referrerPath" class="flex justify-between gap-3">
            <dt class="shrink-0 text-[#9B9A97] dark:text-gray-500">{{ t('liveChat.fieldReferrer') }}</dt>
            <dd class="truncate font-medium text-[#37352F] dark:text-white">{{ referrerPath }}</dd>
          </div>
          <div v-if="entryPagePath" class="flex justify-between gap-3">
            <dt class="shrink-0 text-[#9B9A97] dark:text-gray-500">{{ t('liveChat.fieldEntryPage') }}</dt>
            <dd class="truncate font-medium text-[#37352F] dark:text-white">{{ entryPagePath }}</dd>
          </div>
          <div v-if="pageUrl" class="flex justify-between gap-3">
            <dt class="shrink-0 text-[#9B9A97] dark:text-gray-500">{{ t('liveChat.visitorLastPage') }}</dt>
            <dd class="truncate font-medium text-[#37352F] dark:text-white">{{ pagePath }}</dd>
          </div>
          <p v-if="!visitor?.email && !visitor?.phone && !pageUrl" class="text-[12px] text-[#9B9A97] dark:text-gray-500">
            {{ t('liveChat.contextSectionDetailsEmpty') }}
          </p>
        </dl>
      </section>

      <section class="border-b border-[#EBEBEB] dark:border-gray-800">
        <button
          type="button"
          class="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
          :aria-expanded="isSectionExpanded('identity')"
          @click="toggleSection('identity')"
        >
          <h5 class="text-[11px] font-medium uppercase tracking-wide text-[#9B9A97] dark:text-gray-500">
            {{ t('liveChat.contextSectionIdentity') }}
          </h5>
          <ChevronDownIcon
            class="h-4 w-4 shrink-0 text-[#9B9A97] transition-transform duration-200 dark:text-gray-500"
            :class="isSectionExpanded('identity') ? 'rotate-180' : ''"
            aria-hidden="true"
          />
        </button>
        <div v-show="isSectionExpanded('identity')" class="space-y-3 px-4 pb-3 text-[13px]">
          <div class="space-y-1">
            <label class="text-[#9B9A97] dark:text-gray-500" for="live-chat-visitor-type">
              {{ t('liveChat.fieldVisitorType') }}
            </label>
            <select
              id="live-chat-visitor-type"
              v-model="visitorTypeDraft"
              class="w-full rounded-lg border border-[#EBEBEB] bg-white px-2.5 py-1.5 text-[13px] text-[#37352F] dark:border-gray-700 dark:bg-gray-950 dark:text-white"
              :disabled="!canReply || savingIdentity"
              @change="saveIdentityFields"
            >
              <option value="">{{ t('liveChat.fieldVisitorTypeUnset') }}</option>
              <option v-for="option in visitorTypeOptions" :key="option" :value="option">
                {{ liveChatVisitorTypeLabel(option, t) }}
              </option>
            </select>
          </div>
          <div class="space-y-1">
            <label class="text-[#9B9A97] dark:text-gray-500" for="live-chat-priority">
              {{ t('liveChat.fieldPriority') }}
            </label>
            <select
              id="live-chat-priority"
              v-model="priorityDraft"
              class="w-full rounded-lg border border-[#EBEBEB] bg-white px-2.5 py-1.5 text-[13px] text-[#37352F] dark:border-gray-700 dark:bg-gray-950 dark:text-white"
              :disabled="!canReply || savingIdentity"
              @change="saveIdentityFields"
            >
              <option value="">{{ t('liveChat.fieldPriorityUnset') }}</option>
              <option v-for="option in priorityOptions" :key="option" :value="option">
                {{ liveChatSessionPriorityLabel(option, t) }}
              </option>
            </select>
          </div>
          <div v-if="canAdmin" class="space-y-1">
            <label class="text-[#9B9A97] dark:text-gray-500" for="live-chat-internal-notes">
              {{ t('liveChat.fieldInternalNotes') }}
            </label>
            <textarea
              id="live-chat-internal-notes"
              v-model="internalNotesDraft"
              rows="3"
              class="w-full resize-y rounded-lg border border-[#EBEBEB] bg-white px-2.5 py-2 text-[13px] text-[#37352F] dark:border-gray-700 dark:bg-gray-950 dark:text-white"
              :placeholder="t('liveChat.fieldInternalNotesPlaceholder')"
              :disabled="!canReply || savingIdentity"
            />
            <button
              v-if="canReply"
              type="button"
              class="rounded-lg bg-[#2383E2] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1b6ec2] disabled:opacity-50"
              :disabled="savingIdentity || internalNotesDraft === internalNotesSaved"
              @click="saveIdentityFields"
            >
              {{ t('liveChat.saveInternalNotes') }}
            </button>
          </div>
          <p v-if="identityError" class="text-[12px] text-rose-600 dark:text-rose-300">{{ identityError }}</p>
        </div>
      </section>

      <section class="border-b border-[#EBEBEB] dark:border-gray-800">
        <button
          type="button"
          class="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
          :aria-expanded="isSectionExpanded('device')"
          @click="toggleSection('device')"
        >
          <h5 class="text-[11px] font-medium uppercase tracking-wide text-[#9B9A97] dark:text-gray-500">
            {{ t('liveChat.contextSectionDevice') }}
          </h5>
          <ChevronDownIcon
            class="h-4 w-4 shrink-0 text-[#9B9A97] transition-transform duration-200 dark:text-gray-500"
            :class="isSectionExpanded('device') ? 'rotate-180' : ''"
            aria-hidden="true"
          />
        </button>
        <dl v-show="isSectionExpanded('device')" class="space-y-2 px-4 pb-3 text-[13px]">
          <div v-if="browserLabel" class="flex justify-between gap-3">
            <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('liveChat.fieldBrowser') }}</dt>
            <dd class="truncate font-medium text-[#37352F] dark:text-white">{{ browserLabel }}</dd>
          </div>
          <div v-if="operatingSystemLabel" class="flex justify-between gap-3">
            <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('liveChat.fieldOperatingSystem') }}</dt>
            <dd class="truncate font-medium text-[#37352F] dark:text-white">{{ operatingSystemLabel }}</dd>
          </div>
          <div v-if="deviceTypeLabel" class="flex justify-between gap-3">
            <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('liveChat.fieldDeviceType') }}</dt>
            <dd class="truncate font-medium text-[#37352F] dark:text-white">{{ deviceTypeLabel }}</dd>
          </div>
          <div v-if="countryLabel" class="flex justify-between gap-3">
            <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('liveChat.fieldCountry') }}</dt>
            <dd class="truncate font-medium text-[#37352F] dark:text-white">{{ countryLabel }}</dd>
          </div>
          <div v-if="languageLabel" class="flex justify-between gap-3">
            <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('liveChat.fieldLanguage') }}</dt>
            <dd class="truncate font-medium text-[#37352F] dark:text-white">{{ languageLabel }}</dd>
          </div>
          <p
            v-if="!browserLabel && !operatingSystemLabel && !deviceTypeLabel && !countryLabel && !languageLabel"
            class="text-[12px] text-[#9B9A97] dark:text-gray-500"
          >
            {{ t('liveChat.contextSectionDeviceEmpty') }}
          </p>
        </dl>
      </section>

      <section class="border-b border-[#EBEBEB] dark:border-gray-800">
        <button
          type="button"
          class="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
          :aria-expanded="isSectionExpanded('journey')"
          @click="toggleSection('journey')"
        >
          <h5 class="text-[11px] font-medium uppercase tracking-wide text-[#9B9A97] dark:text-gray-500">
            {{ t('liveChat.visitorJourneyTitle') }}
            <span v-if="journeyEvents.length" class="normal-case tracking-normal text-[#787774] dark:text-gray-400">
              ({{ journeyEvents.length }})
            </span>
          </h5>
          <ChevronDownIcon
            class="h-4 w-4 shrink-0 text-[#9B9A97] transition-transform duration-200 dark:text-gray-500"
            :class="isSectionExpanded('journey') ? 'rotate-180' : ''"
            aria-hidden="true"
          />
        </button>
        <ol
          v-show="isSectionExpanded('journey')"
          class="space-y-3 border-l border-[#EBEBEB] px-4 pb-3 pl-7 dark:border-gray-700"
        >
          <li
            v-for="event in journeyEvents"
            :key="event._id"
            class="relative text-[13px] text-[#37352F] dark:text-gray-200"
          >
            <span class="absolute -left-[1.27rem] top-1.5 h-2 w-2 rounded-full bg-[#2383E2] dark:bg-blue-500" />
            <div class="font-medium">{{ journeyPageLabel(event.page) }}</div>
            <div class="mt-0.5 text-[11px] text-[#9B9A97] dark:text-gray-500">
              {{ journeyEventMeta(event) }}
            </div>
          </li>
        </ol>
        <p
          v-show="isSectionExpanded('journey') && !journeyLoading && !journeyEvents.length"
          class="px-4 pb-3 text-[12px] text-[#9B9A97] dark:text-gray-500"
        >
          {{ t('liveChat.visitorJourneyEmpty') }}
        </p>
      </section>

      <section class="border-b border-[#EBEBEB] dark:border-gray-800">
        <button
          type="button"
          class="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
          :aria-expanded="isSectionExpanded('sessionNotes')"
          @click="toggleSection('sessionNotes')"
        >
          <h5 class="text-[11px] font-medium uppercase tracking-wide text-[#9B9A97] dark:text-gray-500">
            {{ t('liveChat.sessionNotesTitle') }}
            <span v-if="sessionNotes.length" class="normal-case tracking-normal text-[#787774] dark:text-gray-400">
              ({{ sessionNotes.length }})
            </span>
          </h5>
          <ChevronDownIcon
            class="h-4 w-4 shrink-0 text-[#9B9A97] transition-transform duration-200 dark:text-gray-500"
            :class="isSectionExpanded('sessionNotes') ? 'rotate-180' : ''"
            aria-hidden="true"
          />
        </button>
        <div v-show="isSectionExpanded('sessionNotes')" class="space-y-3 px-4 pb-3">
          <div v-if="canReply" class="space-y-2">
            <textarea
              v-model="noteDraft"
              rows="2"
              class="w-full resize-y rounded-lg border border-[#EBEBEB] bg-white px-2.5 py-2 text-[13px] text-[#37352F] dark:border-gray-700 dark:bg-gray-950 dark:text-white"
              :placeholder="t('liveChat.sessionNotePlaceholder')"
              :disabled="addingNote"
            />
            <button
              type="button"
              class="rounded-lg bg-[#2383E2] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1b6ec2] disabled:opacity-50"
              :disabled="addingNote || !noteDraft.trim()"
              @click="submitSessionNote"
            >
              {{ t('liveChat.addSessionNote') }}
            </button>
          </div>
          <p v-if="sessionNotesError" class="text-[12px] text-rose-600 dark:text-rose-300">{{ sessionNotesError }}</p>
          <p v-else-if="!sessionNotes.length" class="text-[12px] text-[#9B9A97] dark:text-gray-500">
            {{ t('liveChat.sessionNotesEmpty') }}
          </p>
          <ul v-else class="space-y-2">
            <li
              v-for="note in sessionNotes"
              :key="note._id"
              class="rounded-lg border border-[#EBEBEB] bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-950"
            >
              <p class="whitespace-pre-wrap text-[13px] text-[#37352F] dark:text-white">{{ note.body }}</p>
              <p class="mt-1 text-[11px] text-[#9B9A97] dark:text-gray-500">
                {{ sessionNoteMeta(note) }}
              </p>
            </li>
          </ul>
        </div>
      </section>

      <section class="border-b border-[#EBEBEB] dark:border-gray-800">
        <button
          type="button"
          class="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
          :aria-expanded="isSectionExpanded('linkedRecords')"
          @click="toggleSection('linkedRecords')"
        >
          <h5 class="text-[11px] font-medium uppercase tracking-wide text-[#9B9A97] dark:text-gray-500">
            {{ t('liveChat.linkedRecordsTitle') }}
            <span v-if="linkedRecordRows.length" class="normal-case tracking-normal text-[#787774] dark:text-gray-400">
              ({{ linkedRecordRows.length }})
            </span>
          </h5>
          <ChevronDownIcon
            class="h-4 w-4 shrink-0 text-[#9B9A97] transition-transform duration-200 dark:text-gray-500"
            :class="isSectionExpanded('linkedRecords') ? 'rotate-180' : ''"
            aria-hidden="true"
          />
        </button>
        <div v-show="isSectionExpanded('linkedRecords')" class="space-y-2 px-4 pb-3">
          <div v-if="linkedRecordGroups.length" class="space-y-2">
            <div
              v-for="group in linkedRecordGroups"
              :key="group.moduleKey"
              class="overflow-hidden rounded-lg border border-[#EBEBEB] bg-white dark:border-gray-700 dark:bg-gray-950"
            >
              <button
                type="button"
                class="flex w-full items-center justify-between gap-2 bg-[#F7F7F5] px-3 py-2 text-left transition hover:bg-[#F1F1EF] dark:bg-gray-800/60 dark:hover:bg-gray-800"
                :aria-expanded="isModuleGroupExpanded(group.moduleKey)"
                :aria-label="t('liveChat.linkedRecordsToggleGroup', { module: group.moduleLabel, count: group.records.length })"
                @click="toggleModuleGroup(group.moduleKey)"
              >
                <span class="min-w-0 truncate text-xs font-semibold text-[#37352F] dark:text-white">
                  {{ group.moduleLabel }}
                  <span class="ml-1 font-normal text-[#9B9A97] dark:text-gray-500">
                    ({{ group.records.length }})
                  </span>
                </span>
                <ChevronDownIcon
                  class="h-4 w-4 shrink-0 text-[#9B9A97] transition-transform duration-200 dark:text-gray-500"
                  :class="isModuleGroupExpanded(group.moduleKey) ? 'rotate-180' : ''"
                  aria-hidden="true"
                />
              </button>
              <ul
                v-show="isModuleGroupExpanded(group.moduleKey)"
                class="divide-y divide-[#EBEBEB] dark:divide-gray-800"
              >
                <li
                  v-for="row in group.records"
                  :key="`${row.moduleKey}-${row.recordId}`"
                  class="px-3 py-2 text-[13px]"
                >
                  <div class="flex items-start justify-between gap-2">
                    <RouterLink
                      v-if="row.route"
                      :to="row.route"
                      class="min-w-0 truncate font-medium text-[#2383E2] hover:underline dark:text-blue-400"
                    >
                      {{ row.label }}
                    </RouterLink>
                    <span v-else class="min-w-0 truncate font-medium text-[#37352F] dark:text-white">
                      {{ row.label }}
                    </span>
                    <span
                      v-if="row.status"
                      class="shrink-0 rounded-full bg-[#F1F1EF] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#787774] dark:bg-gray-800 dark:text-gray-300"
                    >
                      {{ row.status }}
                    </span>
                  </div>
                  <p v-if="row.sourceLabel" class="mt-0.5 text-[11px] text-[#9B9A97] dark:text-gray-500">
                    {{ row.sourceLabel }}
                  </p>
                </li>
              </ul>
            </div>
          </div>
          <p v-else class="text-[12px] text-[#9B9A97] dark:text-gray-500">
            {{ t('liveChat.noLinkedRecords') }}
          </p>
        </div>
      </section>

      <section class="border-b border-[#EBEBEB] dark:border-gray-800">
        <button
          type="button"
          class="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
          :aria-expanded="isSectionExpanded('previousChats')"
          @click="toggleSection('previousChats')"
        >
          <h5 class="text-[11px] font-medium uppercase tracking-wide text-[#9B9A97] dark:text-gray-500">
            {{ t('liveChat.contextSectionPreviousChats') }}
            <span v-if="previousSessions.length" class="normal-case tracking-normal text-[#787774] dark:text-gray-400">
              ({{ previousSessions.length }})
            </span>
          </h5>
          <ChevronDownIcon
            class="h-4 w-4 shrink-0 text-[#9B9A97] transition-transform duration-200 dark:text-gray-500"
            :class="isSectionExpanded('previousChats') ? 'rotate-180' : ''"
            aria-hidden="true"
          />
        </button>
        <div v-show="isSectionExpanded('previousChats')" class="px-4 pb-3">
          <p v-if="!previousSessions.length" class="text-[12px] text-[#9B9A97] dark:text-gray-500">
            {{ t('liveChat.visitorNoSessions') }}
          </p>
          <ul v-else class="space-y-2">
            <li v-for="row in previousSessions" :key="row._id">
              <button
                type="button"
                class="block w-full rounded-lg border border-[#EBEBEB] bg-white px-3 py-2 text-left transition hover:bg-[#F7F7F5] dark:border-gray-700 dark:bg-gray-950 dark:hover:bg-gray-900"
                @click="openSession(String(row._id))"
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="truncate text-[13px] font-medium text-[#37352F] dark:text-white">
                    {{ sessionLabel(row) }}
                  </span>
                  <span
                    class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
                    :class="row.status === 'closed'
                      ? 'bg-[#F1F1EF] text-[#787774] dark:bg-gray-800 dark:text-gray-300'
                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'"
                  >
                    {{ row.status === 'closed' ? t('liveChat.filterClosed') : t('liveChat.filterOpen') }}
                  </span>
                </div>
                <p class="mt-1 text-[11px] text-[#9B9A97] dark:text-gray-500">
                  {{ formatDate(row.lastMessageAt || row.createdAt) }}
                </p>
              </button>
            </li>
          </ul>
        </div>
      </section>

      <section class="border-b border-[#EBEBEB] dark:border-gray-800">
        <button
          type="button"
          class="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
          :aria-expanded="isSectionExpanded('chatDetails')"
          @click="toggleSection('chatDetails')"
        >
          <h5 class="text-[11px] font-medium uppercase tracking-wide text-[#9B9A97] dark:text-gray-500">
            {{ t('liveChat.chatDetailsTitle') }}
          </h5>
          <ChevronDownIcon
            class="h-4 w-4 shrink-0 text-[#9B9A97] transition-transform duration-200 dark:text-gray-500"
            :class="isSectionExpanded('chatDetails') ? 'rotate-180' : ''"
            aria-hidden="true"
          />
        </button>
        <dl v-show="isSectionExpanded('chatDetails')" class="space-y-2 px-4 pb-3 text-[13px]">
          <div class="flex justify-between gap-3">
            <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('liveChat.detailSessionId') }}</dt>
            <dd class="truncate font-mono text-[12px] font-medium text-[#37352F] dark:text-white">{{ sessionKeyLabel }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('liveChat.detailChannel') }}</dt>
            <dd class="truncate font-medium text-[#37352F] dark:text-white">{{ channelLabel }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('liveChat.detailStatus') }}</dt>
            <dd class="truncate font-medium text-[#37352F] dark:text-white">{{ lifecycleLabel }}</dd>
          </div>
          <div v-if="outcomeLabel" class="flex justify-between gap-3">
            <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('liveChat.outcomeLabel') }}</dt>
            <dd class="truncate font-medium text-[#37352F] dark:text-white">{{ outcomeLabel }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('liveChat.detailQueue') }}</dt>
            <dd class="truncate font-medium text-[#37352F] dark:text-white">{{ queueLabel }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('liveChat.detailAgent') }}</dt>
            <dd class="flex items-center gap-1.5 truncate font-medium text-[#37352F] dark:text-white">
              <span
                v-if="assignedAgentOnline"
                class="h-2 w-2 rounded-full"
                :class="agentStatusPreset.dotClass"
                aria-hidden="true"
              />
              {{ assignedAgentLabel }}
            </dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('liveChat.detailHandledBy') }}</dt>
            <dd class="truncate font-medium text-[#37352F] dark:text-white">{{ handledByLabel }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('liveChat.detailStartedAt') }}</dt>
            <dd class="truncate font-medium text-[#37352F] dark:text-white">{{ startedAtLabel }}</dd>
          </div>
          <div v-if="endedAtLabel" class="flex justify-between gap-3">
            <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('liveChat.detailEndedAt') }}</dt>
            <dd class="truncate font-medium text-[#37352F] dark:text-white">{{ endedAtLabel }}</dd>
          </div>
          <div v-if="durationLabel" class="flex justify-between gap-3">
            <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('liveChat.detailDuration') }}</dt>
            <dd class="truncate font-medium text-[#37352F] dark:text-white">{{ durationLabel }}</dd>
          </div>
          <div v-if="summaryLabel" class="flex flex-col gap-1">
            <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('liveChat.fieldSummary') }}</dt>
            <dd class="whitespace-pre-wrap text-[13px] font-medium text-[#37352F] dark:text-white">{{ summaryLabel }}</dd>
          </div>
          <div v-if="tagsLabel.length" class="flex flex-col gap-1">
            <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('liveChat.fieldTags') }}</dt>
            <dd class="flex flex-wrap gap-1">
              <span
                v-for="tag in tagsLabel"
                :key="tag"
                class="rounded-full bg-[#F1F1EF] px-2 py-0.5 text-[11px] font-medium text-[#787774] dark:bg-gray-800 dark:text-gray-300"
              >
                {{ tag }}
              </span>
            </dd>
          </div>
          <div v-if="csatLabel" class="flex justify-between gap-3">
            <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('liveChat.fieldCsat') }}</dt>
            <dd class="truncate font-medium tabular-nums text-[#37352F] dark:text-white">{{ csatLabel }}/5</dd>
          </div>
          <template v-if="effectiveSession?.botInvolved">
            <div class="flex justify-between gap-3">
              <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('liveChat.fieldBotInvolved') }}</dt>
              <dd class="truncate font-medium text-[#37352F] dark:text-white">{{ botInvolvedLabel }}</dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('liveChat.fieldBotEscalated') }}</dt>
              <dd class="truncate font-medium text-[#37352F] dark:text-white">{{ botEscalatedLabel }}</dd>
            </div>
            <div v-if="botResolutionLabel" class="flex justify-between gap-3">
              <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('liveChat.fieldBotResolution') }}</dt>
              <dd class="truncate font-medium text-[#37352F] dark:text-white">{{ botResolutionLabel }}</dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('liveChat.fieldBotMessageCount') }}</dt>
              <dd class="truncate font-medium tabular-nums text-[#37352F] dark:text-white">{{ botMessageCountLabel }}</dd>
            </div>
          </template>
          <div v-if="feedbackCommentLabel" class="flex flex-col gap-1">
            <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('liveChat.fieldFeedbackComment') }}</dt>
            <dd class="whitespace-pre-wrap text-[13px] font-medium text-[#37352F] dark:text-white">{{ feedbackCommentLabel }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('liveChat.detailMessageCount') }}</dt>
            <dd class="truncate font-medium tabular-nums text-[#37352F] dark:text-white">{{ messageCountLabel }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('liveChat.fieldVisitorMessageCount') }}</dt>
            <dd class="truncate font-medium tabular-nums text-[#37352F] dark:text-white">{{ visitorMessageCountLabel }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('liveChat.fieldAgentMessageCount') }}</dt>
            <dd class="truncate font-medium tabular-nums text-[#37352F] dark:text-white">{{ agentMessageCountLabel }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('liveChat.fieldAttachmentCount') }}</dt>
            <dd class="truncate font-medium tabular-nums text-[#37352F] dark:text-white">{{ attachmentCountLabel }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('liveChat.fieldAgentCount') }}</dt>
            <dd class="truncate font-medium tabular-nums text-[#37352F] dark:text-white">{{ agentCountLabel }}</dd>
          </div>
        </dl>
      </section>

      <section
        v-if="hasIntelligenceFields"
        class="border-b border-[#EBEBEB] dark:border-gray-800"
      >
        <button
          type="button"
          class="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
          :aria-expanded="isSectionExpanded('intelligence')"
          @click="toggleSection('intelligence')"
        >
          <h5 class="text-[11px] font-medium uppercase tracking-wide text-[#9B9A97] dark:text-gray-500">
            {{ t('liveChat.contextSectionIntelligence') }}
          </h5>
          <ChevronDownIcon
            class="h-4 w-4 shrink-0 text-[#9B9A97] transition-transform duration-200 dark:text-gray-500"
            :class="isSectionExpanded('intelligence') ? 'rotate-180' : ''"
            aria-hidden="true"
          />
        </button>
        <dl v-show="isSectionExpanded('intelligence')" class="space-y-2 px-4 pb-3 text-[13px]">
          <div v-if="intentLabel" class="flex justify-between gap-3">
            <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('liveChat.fieldIntent') }}</dt>
            <dd class="truncate font-medium text-[#37352F] dark:text-white">{{ intentLabel }}</dd>
          </div>
          <div v-if="sentimentLabel" class="flex justify-between gap-3">
            <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('liveChat.fieldSentiment') }}</dt>
            <dd class="truncate font-medium text-[#37352F] dark:text-white">{{ sentimentLabel }}</dd>
          </div>
          <div v-if="aiIntentLabel" class="flex justify-between gap-3">
            <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('liveChat.fieldAiIntent') }}</dt>
            <dd class="truncate font-medium text-[#37352F] dark:text-white">{{ aiIntentLabel }}</dd>
          </div>
          <div v-if="aiSentimentScoreLabel" class="flex justify-between gap-3">
            <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('liveChat.fieldAiSentimentScore') }}</dt>
            <dd class="truncate font-medium tabular-nums text-[#37352F] dark:text-white">{{ aiSentimentScoreLabel }}</dd>
          </div>
          <div v-if="aiSummaryLabel" class="flex flex-col gap-1">
            <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('liveChat.fieldAiSummary') }}</dt>
            <dd class="whitespace-pre-wrap text-[13px] font-medium text-[#37352F] dark:text-white">{{ aiSummaryLabel }}</dd>
          </div>
        </dl>
      </section>

      <section class="border-b border-[#EBEBEB] dark:border-gray-800">
        <button
          type="button"
          class="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
          :aria-expanded="isSectionExpanded('compliance')"
          @click="toggleSection('compliance')"
        >
          <h5 class="text-[11px] font-medium uppercase tracking-wide text-[#9B9A97] dark:text-gray-500">
            {{ t('liveChat.contextSectionCompliance') }}
          </h5>
          <ChevronDownIcon
            class="h-4 w-4 shrink-0 text-[#9B9A97] transition-transform duration-200 dark:text-gray-500"
            :class="isSectionExpanded('compliance') ? 'rotate-180' : ''"
            aria-hidden="true"
          />
        </button>
        <dl v-show="isSectionExpanded('compliance')" class="space-y-2 px-4 pb-3 text-[13px]">
          <div class="flex justify-between gap-3">
            <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('liveChat.fieldConsentGiven') }}</dt>
            <dd class="truncate font-medium text-[#37352F] dark:text-white">{{ consentGivenLabel }}</dd>
          </div>
          <div v-if="consentTimestampLabel" class="flex justify-between gap-3">
            <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('liveChat.fieldConsentTimestamp') }}</dt>
            <dd class="truncate font-medium text-[#37352F] dark:text-white">{{ consentTimestampLabel }}</dd>
          </div>
          <div v-if="canAdmin" class="flex justify-between gap-3">
            <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('liveChat.fieldSessionArchived') }}</dt>
            <dd class="truncate font-medium text-[#37352F] dark:text-white">{{ sessionArchivedLabel }}</dd>
          </div>
          <div v-if="canAdmin && archiveDateLabel" class="flex justify-between gap-3">
            <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('liveChat.fieldArchiveDate') }}</dt>
            <dd class="truncate font-medium text-[#37352F] dark:text-white">{{ archiveDateLabel }}</dd>
          </div>
          <div v-if="canAdmin" class="flex justify-between gap-3">
            <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('liveChat.fieldExported') }}</dt>
            <dd class="truncate font-medium text-[#37352F] dark:text-white">{{ exportedLabel }}</dd>
          </div>
          <div v-if="canAdmin" class="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              class="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
              :disabled="complianceBusy"
              @click="exportTranscript"
            >
              {{ t('liveChat.exportTranscript') }}
            </button>
            <button
              type="button"
              class="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
              :disabled="complianceBusy"
              @click="toggleArchiveSession"
            >
              {{ effectiveSession?.sessionArchived ? t('liveChat.unarchiveSession') : t('liveChat.archiveSession') }}
            </button>
          </div>
          <p v-if="complianceError" class="text-[12px] text-rose-600 dark:text-rose-300">{{ complianceError }}</p>
        </dl>
      </section>

      <section class="border-b border-[#EBEBEB] dark:border-gray-800">
        <button
          type="button"
          class="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
          :aria-expanded="isSectionExpanded('timing')"
          @click="toggleSection('timing')"
        >
          <h5 class="text-[11px] font-medium uppercase tracking-wide text-[#9B9A97] dark:text-gray-500">
            {{ t('liveChat.contextSectionTiming') }}
          </h5>
          <ChevronDownIcon
            class="h-4 w-4 shrink-0 text-[#9B9A97] transition-transform duration-200 dark:text-gray-500"
            :class="isSectionExpanded('timing') ? 'rotate-180' : ''"
            aria-hidden="true"
          />
        </button>
        <dl v-show="isSectionExpanded('timing')" class="space-y-2 px-4 pb-3 text-[13px]">
          <div v-if="assignedAtLabel" class="flex justify-between gap-3">
            <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('liveChat.fieldAssignedAt') }}</dt>
            <dd class="truncate font-medium text-[#37352F] dark:text-white">{{ assignedAtLabel }}</dd>
          </div>
          <div v-if="firstResponseAtLabel" class="flex justify-between gap-3">
            <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('liveChat.fieldFirstResponseAt') }}</dt>
            <dd class="truncate font-medium text-[#37352F] dark:text-white">{{ firstResponseAtLabel }}</dd>
          </div>
          <div v-if="assignedByLabel" class="flex justify-between gap-3">
            <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('liveChat.fieldAssignedBy') }}</dt>
            <dd class="truncate font-medium text-[#37352F] dark:text-white">{{ assignedByLabel }}</dd>
          </div>
          <div v-if="waitTimeLabel" class="flex justify-between gap-3">
            <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('liveChat.fieldWaitTime') }}</dt>
            <dd class="truncate font-medium tabular-nums text-[#37352F] dark:text-white">{{ waitTimeLabel }}</dd>
          </div>
          <div v-if="firstResponseTimeLabel" class="flex justify-between gap-3">
            <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('liveChat.fieldFirstResponseTime') }}</dt>
            <dd class="truncate font-medium tabular-nums text-[#37352F] dark:text-white">{{ firstResponseTimeLabel }}</dd>
          </div>
          <div v-if="handleTimeLabel" class="flex justify-between gap-3">
            <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('liveChat.fieldHandleTime') }}</dt>
            <dd class="truncate font-medium tabular-nums text-[#37352F] dark:text-white">{{ handleTimeLabel }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('liveChat.fieldTransferCount') }}</dt>
            <dd class="truncate font-medium tabular-nums text-[#37352F] dark:text-white">{{ transferCountLabel }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-[#9B9A97] dark:text-gray-500">{{ t('liveChat.fieldAgentsInvolved') }}</dt>
            <dd class="truncate font-medium text-[#37352F] dark:text-white">{{ agentsInvolvedLabel }}</dd>
          </div>
        </dl>
      </section>

      <section class="border-b border-[#EBEBEB] dark:border-gray-800">
        <button
          type="button"
          class="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
          :aria-expanded="isSectionExpanded('assignmentHistory')"
          @click="toggleSection('assignmentHistory')"
        >
          <h5 class="text-[11px] font-medium uppercase tracking-wide text-[#9B9A97] dark:text-gray-500">
            {{ t('liveChat.assignmentHistoryTitle') }}
            <span v-if="assignmentEvents.length" class="normal-case tracking-normal text-[#787774] dark:text-gray-400">
              ({{ assignmentEvents.length }})
            </span>
          </h5>
          <ChevronDownIcon
            class="h-4 w-4 shrink-0 text-[#9B9A97] transition-transform duration-200 dark:text-gray-500"
            :class="isSectionExpanded('assignmentHistory') ? 'rotate-180' : ''"
            aria-hidden="true"
          />
        </button>
        <div v-show="isSectionExpanded('assignmentHistory')" class="px-4 pb-3">
          <p v-if="assignmentHistoryError" class="text-[12px] text-rose-600 dark:text-rose-300">
            {{ assignmentHistoryError }}
          </p>
          <p v-else-if="!assignmentEvents.length" class="text-[12px] text-[#9B9A97] dark:text-gray-500">
            {{ t('liveChat.assignmentHistoryEmpty') }}
          </p>
          <ul v-else class="space-y-2">
            <li
              v-for="event in assignmentEvents"
              :key="event._id"
              class="rounded-lg border border-[#EBEBEB] bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-950"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="text-[13px] font-medium text-[#37352F] dark:text-white">
                  {{ assignmentActionLabel(event) }}
                </span>
                <span class="shrink-0 text-[11px] text-[#9B9A97] dark:text-gray-500">
                  {{ formatDate(event.createdAt) }}
                </span>
              </div>
              <p class="mt-1 text-[12px] text-[#787774] dark:text-gray-400">
                {{ assignmentEventLine(event) }}
              </p>
            </li>
          </ul>
        </div>
      </section>
    </div>
  </aside>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/vue/24/outline';
import { useAuthStore } from '@/stores/authRegistry';
import { useUserStatus } from '@/composables/useUserStatus';
import { useLiveChatTabNavigation } from '@/composables/useLiveChatTabNavigation';
import AvatarInitials from '@/components/ui/AvatarInitials.vue';
import apiClient from '@/utils/apiClient';
import {
  compareLiveChatModuleKeys,
  liveChatLinkedRecordFallbackLabelKey,
  liveChatLinkedRecordModuleLabelKey,
  liveChatLinkedRecordRoute,
  liveChatLinkedRecordSourceLabelKey,
  normalizeLiveChatModuleKey,
} from '@/utils/liveChatLinkedRecordRoutes';
import {
  liveChatAgentLabel,
  liveChatChannelLabel,
  liveChatLifecycleLabel,
  liveChatOutcomeLabel,
  liveChatQueueLabel,
  liveChatSessionDuration,
  liveChatSessionEndedAt,
  liveChatSessionKeyLabel,
  liveChatSessionStartedAt,
  liveChatSessionSummaryLabel,
  liveChatSessionTagsLabel,
  liveChatCsatLabel,
  liveChatAssignedByLabel,
  liveChatAssignmentActionLabel,
  liveChatSessionWaitTime,
  liveChatSessionFirstResponseTime,
  liveChatSessionHandleTime,
  liveChatAgentsInvolvedLabel,
  liveChatDeviceTypeLabel,
  liveChatJourneyActionLabel,
  liveChatVisitorTypeLabel,
  liveChatSessionPriorityLabel,
  liveChatBotResolutionLabel,
  liveChatYesNoLabel,
  liveChatSentimentLabel,
  liveChatIntentLabel,
  liveChatAiSentimentScoreLabel,
} from '@/utils/liveChatSessionDisplay';
import { canReplyLiveChatSessions, canAdminLiveChat } from '@/utils/liveChatPermissions';

const DEFAULT_EXPANDED_SECTIONS = Object.freeze([
  'details',
  'identity',
  'device',
  'journey',
  'sessionNotes',
  'linkedRecords',
  'previousChats',
  'chatDetails',
  'intelligence',
  'compliance',
  'timing',
  'assignmentHistory',
]);

const VISITOR_TYPE_OPTIONS = Object.freeze(['anonymous', 'known_visitor', 'customer', 'partner']);
const PRIORITY_OPTIONS = Object.freeze(['low', 'normal', 'high', 'urgent']);

const props = defineProps({
  sessionId: { type: String, default: '' },
  session: { type: Object, default: null },
});

const emit = defineEmits(['close']);

const { t, te } = useI18n();
const authStore = useAuthStore();
const { openSession } = useLiveChatTabNavigation();

const loading = ref(false);
const error = ref('');
const sessionDetail = ref(null);
const visitorProfile = ref(null);
const previousSessions = ref([]);
const linkedRecords = ref([]);
const assignmentEvents = ref([]);
const assignmentHistoryError = ref('');
const journeyEvents = ref([]);
const journeyLoading = ref(false);
const sessionNotes = ref([]);
const sessionNotesError = ref('');
const noteDraft = ref('');
const addingNote = ref(false);
const visitorTypeDraft = ref('');
const priorityDraft = ref('');
const internalNotesDraft = ref('');
const internalNotesSaved = ref('');
const savingIdentity = ref(false);
const identityError = ref('');
const complianceBusy = ref(false);
const complianceError = ref('');

let contextLoadGeneration = 0;
const expandedModuleKeys = ref(new Set());
const expandedSections = ref(new Set(DEFAULT_EXPANDED_SECTIONS));

const currentUserId = computed(() => authStore.user?._id || null);
const canReply = computed(() => canReplyLiveChatSessions(authStore.user));
const canAdmin = computed(() => canAdminLiveChat(authStore.user));
const visitorTypeOptions = VISITOR_TYPE_OPTIONS;
const priorityOptions = PRIORITY_OPTIONS;

const effectiveSession = computed(() => {
  const base = props.session || {};
  const detail = sessionDetail.value || {};
  return { ...base, ...detail };
});

const assignedAgentId = computed(() => String(effectiveSession.value?.assignedAgentId || ''));
const { currentPreset: agentStatusPreset } = useUserStatus(
  computed(() => (assignedAgentId.value === String(currentUserId.value || '') ? currentUserId.value : null)),
);

const sessionKeyLabel = computed(() => liveChatSessionKeyLabel(effectiveSession.value));

const lifecycleLabel = computed(() => liveChatLifecycleLabel(effectiveSession.value?.lifecycleStatus, t));

const channelLabel = computed(() => liveChatChannelLabel(effectiveSession.value?.channel, t));

const queueLabel = computed(() => liveChatQueueLabel(effectiveSession.value, t));

const assignedAgentLabel = computed(() => liveChatAgentLabel(effectiveSession.value?.assignedAgent, t));

const handledByLabel = computed(() => liveChatAgentLabel(effectiveSession.value?.handledBy, t));

const assignedAgentOnline = computed(
  () => assignedAgentId.value && assignedAgentId.value === String(currentUserId.value || ''),
);

const outcomeLabel = computed(() => liveChatOutcomeLabel(effectiveSession.value?.outcome, t));

const startedAtLabel = computed(() => liveChatSessionStartedAt(effectiveSession.value) || '—');

const endedAtLabel = computed(() => {
  if (String(effectiveSession.value?.status || '') !== 'closed') return '';
  return liveChatSessionEndedAt(effectiveSession.value) || '';
});

const durationLabel = computed(() => liveChatSessionDuration(effectiveSession.value) || '');

const messageCountLabel = computed(() => String(effectiveSession.value?.messageCount ?? 0));

const visitorMessageCountLabel = computed(() => String(effectiveSession.value?.visitorMessageCount ?? 0));
const agentMessageCountLabel = computed(() => String(effectiveSession.value?.agentMessageCount ?? 0));
const attachmentCountLabel = computed(() => String(effectiveSession.value?.attachmentCount ?? 0));
const agentCountLabel = computed(() => String(effectiveSession.value?.agentCount ?? 0));

const intentLabel = computed(() => liveChatIntentLabel(effectiveSession.value?.intent, t));
const sentimentLabel = computed(() => liveChatSentimentLabel(effectiveSession.value?.sentiment, t));
const aiIntentLabel = computed(() => liveChatIntentLabel(effectiveSession.value?.aiIntent, t));
const aiSentimentScoreLabel = computed(() => liveChatAiSentimentScoreLabel(effectiveSession.value?.aiSentimentScore));
const aiSummaryLabel = computed(() => String(effectiveSession.value?.aiSummary || '').trim());

const hasIntelligenceFields = computed(() => Boolean(
  intentLabel.value
  || sentimentLabel.value
  || aiIntentLabel.value
  || aiSentimentScoreLabel.value
  || aiSummaryLabel.value,
));

const consentGivenLabel = computed(() => liveChatYesNoLabel(Boolean(effectiveSession.value?.consentGiven), t));
const consentTimestampLabel = computed(() => formatDate(effectiveSession.value?.consentTimestamp));
const sessionArchivedLabel = computed(() => liveChatYesNoLabel(Boolean(effectiveSession.value?.sessionArchived), t));
const archiveDateLabel = computed(() => formatDate(effectiveSession.value?.archiveDate));
const exportedLabel = computed(() => liveChatYesNoLabel(Boolean(effectiveSession.value?.exported), t));

const summaryLabel = computed(() => liveChatSessionSummaryLabel(effectiveSession.value));

const tagsLabel = computed(() => liveChatSessionTagsLabel(effectiveSession.value));

const csatLabel = computed(() => liveChatCsatLabel(effectiveSession.value));

const botInvolvedLabel = computed(() => liveChatYesNoLabel(Boolean(effectiveSession.value?.botInvolved), t));
const botEscalatedLabel = computed(() => liveChatYesNoLabel(Boolean(effectiveSession.value?.botEscalated), t));
const botResolutionLabel = computed(() => liveChatBotResolutionLabel(effectiveSession.value?.botResolution, t));
const botMessageCountLabel = computed(() => String(effectiveSession.value?.botMessageCount ?? 0));

const feedbackCommentLabel = computed(() => String(effectiveSession.value?.feedbackComment || '').trim());

const assignedAtLabel = computed(() => formatDate(effectiveSession.value?.assignedAt));

const firstResponseAtLabel = computed(() => formatDate(effectiveSession.value?.firstResponseAt));

const assignedByLabel = computed(() => liveChatAssignedByLabel(effectiveSession.value?.assignedBy, t));

const waitTimeLabel = computed(() => liveChatSessionWaitTime(effectiveSession.value));

const firstResponseTimeLabel = computed(() => liveChatSessionFirstResponseTime(effectiveSession.value));

const handleTimeLabel = computed(() => liveChatSessionHandleTime(effectiveSession.value));

const transferCountLabel = computed(() => String(effectiveSession.value?.transferCount ?? 0));

const agentsInvolvedLabel = computed(() => liveChatAgentsInvolvedLabel(effectiveSession.value, t));

const visitor = computed(() => effectiveSession.value?.visitor || visitorProfile.value || {});
const pageUrl = computed(() => String(
  effectiveSession.value?.pageUrl || effectiveSession.value?.entryPage || visitorProfile.value?.lastPageUrl || '',
).trim());
const referrerUrl = computed(() => String(effectiveSession.value?.referrerUrl || '').trim());
const entryPageUrl = computed(() => String(effectiveSession.value?.entryPage || effectiveSession.value?.pageUrl || '').trim());

const browserLabel = computed(() => String(effectiveSession.value?.browser || '').trim());
const operatingSystemLabel = computed(() => String(effectiveSession.value?.operatingSystem || '').trim());
const deviceTypeLabel = computed(() => liveChatDeviceTypeLabel(effectiveSession.value?.deviceType, t));
const countryLabel = computed(() => String(effectiveSession.value?.country || '').trim());
const languageLabel = computed(() => String(effectiveSession.value?.language || '').trim());

const displayName = computed(() => {
  const name = String(visitor.value?.name || '').trim();
  if (name) return name;
  const email = String(visitor.value?.email || '').trim();
  if (email) return email;
  return t('liveChat.anonymousVisitor');
});

const visitorFirstName = computed(() => {
  const name = String(visitor.value?.name || '').trim();
  if (!name) return '';
  return name.split(/\s+/)[0] || '';
});

const visitorLastName = computed(() => {
  const name = String(visitor.value?.name || '').trim();
  if (!name) return '';
  const parts = name.split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(' ') : '';
});

const visitorSubtitle = computed(() => {
  const email = String(visitor.value?.email || '').trim();
  const parts = [];
  if (email) parts.push(email);
  if (pageUrl.value) parts.push(pagePath.value);
  return parts.join(' · ');
});

const pagePath = computed(() => formatPagePath(pageUrl.value));
const referrerPath = computed(() => formatPagePath(referrerUrl.value));
const entryPagePath = computed(() => formatPagePath(entryPageUrl.value));

function formatPagePath(url) {
  if (!url) return '';
  try {
    return new URL(url).pathname || url;
  } catch {
    return url;
  }
}

const visitorOnline = computed(() => String(effectiveSession.value?.status || 'open') !== 'closed');

const linkedRecordRows = computed(() =>
  linkedRecords.value.map((entry) => mapLinkedRecordRow(entry)),
);

const linkedRecordGroups = computed(() => {
  const groups = new Map();
  for (const row of linkedRecordRows.value) {
    if (!groups.has(row.moduleKey)) {
      groups.set(row.moduleKey, {
        moduleKey: row.moduleKey,
        moduleLabel: row.moduleLabel,
        records: [],
      });
    }
    groups.get(row.moduleKey).records.push(row);
  }
  return [...groups.values()].sort((a, b) => compareLiveChatModuleKeys(a.moduleKey, b.moduleKey));
});

function isSectionExpanded(sectionId) {
  return expandedSections.value.has(sectionId);
}

function toggleSection(sectionId) {
  const next = new Set(expandedSections.value);
  if (next.has(sectionId)) next.delete(sectionId);
  else next.add(sectionId);
  expandedSections.value = next;
}

function isModuleGroupExpanded(moduleKey) {
  return expandedModuleKeys.value.has(moduleKey);
}

function toggleModuleGroup(moduleKey) {
  const next = new Set(expandedModuleKeys.value);
  if (next.has(moduleKey)) next.delete(moduleKey);
  else next.add(moduleKey);
  expandedModuleKeys.value = next;
}

function syncExpandedModuleGroups(groups, { expandNew = true } = {}) {
  const next = new Set(expandedModuleKeys.value);
  const presentKeys = new Set(groups.map((group) => group.moduleKey));

  for (const key of [...next]) {
    if (!presentKeys.has(key)) next.delete(key);
  }

  for (const group of groups) {
    if (expandNew && !next.has(group.moduleKey)) {
      next.add(group.moduleKey);
    }
  }

  if (!next.size && groups.length) {
    for (const group of groups) next.add(group.moduleKey);
  }

  expandedModuleKeys.value = next;
}

function resetPanelExpansion() {
  expandedSections.value = new Set(DEFAULT_EXPANDED_SECTIONS);
  if (pageUrl.value) {
    expandedSections.value.add('journey');
  }
  expandedModuleKeys.value = new Set();
  syncExpandedModuleGroups(linkedRecordGroups.value, { expandNew: true });
}

watch(
  linkedRecordGroups,
  (groups) => syncExpandedModuleGroups(groups, { expandNew: true }),
  { immediate: true },
);

watch(
  () => props.sessionId,
  () => resetPanelExpansion(),
);

function mapLinkedRecordRow(entry) {
  const moduleKey = normalizeLiveChatModuleKey(entry?.moduleKey);
  const recordId = entry?.recordId ? String(entry.recordId) : '';
  const explicitLabel = String(entry?.label || '').trim();
  const source = String(entry?.source || 'session');
  const sourceLabelKey = liveChatLinkedRecordSourceLabelKey(source);
  const sourceLabel = sourceLabelKey ? t(sourceLabelKey) : '';
  const fallbackKey = liveChatLinkedRecordFallbackLabelKey(moduleKey);
  const fallbackLabel = fallbackKey === 'liveChat.linkedCaseLabel'
    ? t(fallbackKey, { id: recordId.slice(-6) })
    : t(fallbackKey);
  const moduleLabelKey = liveChatLinkedRecordModuleLabelKey(moduleKey);
  const moduleLabel = moduleLabelKey && te(moduleLabelKey)
    ? t(moduleLabelKey)
    : t('liveChat.linkedRecordModuleFallback');

  return {
    moduleKey,
    recordId,
    moduleLabel,
    label: explicitLabel || fallbackLabel,
    status: entry?.status || null,
    sourceLabel,
    route: liveChatLinkedRecordRoute(moduleKey, recordId),
  };
}

function syncIdentityDraftsFromSession() {
  const session = effectiveSession.value;
  visitorTypeDraft.value = String(session?.visitorType || '');
  priorityDraft.value = String(session?.priority || '');
  internalNotesDraft.value = String(session?.internalNotes || '');
  internalNotesSaved.value = internalNotesDraft.value;
}

watch(effectiveSession, () => syncIdentityDraftsFromSession(), { immediate: true, deep: true });

async function saveIdentityFields() {
  const sessionId = String(props.sessionId || '').trim();
  if (!sessionId || !canReply.value) return;

  savingIdentity.value = true;
  identityError.value = '';
  try {
    const res = await apiClient.patch(`/live-chat/sessions/${sessionId}`, {
      visitorType: visitorTypeDraft.value || null,
      priority: priorityDraft.value || null,
      internalNotes: internalNotesDraft.value,
    });
    if (res?.data) {
      sessionDetail.value = { ...(sessionDetail.value || {}), ...res.data };
      syncIdentityDraftsFromSession();
    }
  } catch (err) {
    identityError.value = err?.message || t('liveChat.identitySaveFailed');
  } finally {
    savingIdentity.value = false;
  }
}

async function loadSessionNotes() {
  const sessionId = String(props.sessionId || '').trim();
  if (!sessionId) {
    sessionNotes.value = [];
    return;
  }

  try {
    const res = await apiClient.get(`/live-chat/sessions/${sessionId}/notes`);
    sessionNotes.value = Array.isArray(res?.data) ? res.data : [];
    sessionNotesError.value = '';
  } catch {
    sessionNotes.value = [];
    sessionNotesError.value = t('liveChat.sessionNotesLoadFailed');
  }
}

async function submitSessionNote() {
  const sessionId = String(props.sessionId || '').trim();
  const body = String(noteDraft.value || '').trim();
  if (!sessionId || !body || !canReply.value) return;

  addingNote.value = true;
  sessionNotesError.value = '';
  try {
    const res = await apiClient.post(`/live-chat/sessions/${sessionId}/notes`, { body });
    if (res?.data) {
      sessionNotes.value = [res.data, ...sessionNotes.value];
      noteDraft.value = '';
    }
  } catch (err) {
    sessionNotesError.value = err?.message || t('liveChat.sessionNoteAddFailed');
  } finally {
    addingNote.value = false;
  }
}

function sessionNoteMeta(note) {
  const author = liveChatAgentLabel(note?.author, t);
  const when = formatDate(note?.createdAt);
  return [author, when].filter(Boolean).join(' · ');
}

async function loadLinkedRecords() {
  const sessionId = String(props.sessionId || '').trim();
  if (!sessionId) {
    linkedRecords.value = [];
    return;
  }

  try {
    const res = await apiClient.get(`/live-chat/sessions/${sessionId}/linked-records`);
    linkedRecords.value = Array.isArray(res?.data) ? res.data : [];
  } catch {
    linkedRecords.value = [];
  }
}

async function loadJourneyEvents() {
  const sessionId = String(props.sessionId || '').trim();
  if (!sessionId) {
    journeyEvents.value = [];
    return;
  }

  journeyLoading.value = true;
  try {
    const res = await apiClient.get(`/live-chat/sessions/${sessionId}/journey`);
    journeyEvents.value = Array.isArray(res?.data) ? res.data : [];
  } catch {
    journeyEvents.value = [];
  } finally {
    journeyLoading.value = false;
  }
}

function journeyPageLabel(page) {
  const path = formatPagePath(String(page || '').trim());
  return path || String(page || '').trim() || '—';
}

function journeyEventMeta(event) {
  const action = liveChatJourneyActionLabel(event?.action, t);
  const when = formatDate(event?.createdAt);
  return [action, when].filter(Boolean).join(' · ');
}

async function loadAssignmentHistory() {
  const sessionId = String(props.sessionId || '').trim();
  if (!sessionId) {
    assignmentEvents.value = [];
    assignmentHistoryError.value = '';
    return;
  }

  try {
    const res = await apiClient.get(`/live-chat/sessions/${sessionId}/assignment-events`);
    assignmentEvents.value = Array.isArray(res?.data) ? res.data : [];
    assignmentHistoryError.value = '';
  } catch {
    assignmentEvents.value = [];
    assignmentHistoryError.value = t('liveChat.assignmentHistoryLoadFailed');
  }
}

function assignmentActionLabel(event) {
  return liveChatAssignmentActionLabel(event?.action, t);
}

function assignmentEventLine(event) {
  const agent = liveChatAgentLabel(event?.agent, t);
  const performer = liveChatAgentLabel(event?.performedBy, t);
  const assignedBy = liveChatAssignedByLabel(event?.assignedBy, t);
  const parts = [agent];
  if (assignedBy) parts.push(assignedBy);
  if (performer && performer !== agent) parts.push(performer);
  return parts.filter(Boolean).join(' · ');
}

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return '—';
  }
}

function sessionLabel(row) {
  const key = String(row?.sessionKey || '').trim();
  if (key) return key;
  return t('liveChat.visitor');
}

async function loadSessionDetail() {
  const sessionId = String(props.sessionId || '').trim();
  if (!sessionId) {
    sessionDetail.value = null;
    return null;
  }

  try {
    const res = await apiClient.get(`/live-chat/sessions/${sessionId}`);
    sessionDetail.value = res?.data || null;
    return sessionDetail.value;
  } catch {
    sessionDetail.value = null;
    return null;
  }
}

function downloadBlob(blob, filename, mime) {
  const url = URL.createObjectURL(new Blob([blob], { type: mime }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function exportTranscript() {
  const sessionId = String(props.sessionId || '').trim();
  if (!sessionId || !canAdmin.value) return;

  complianceBusy.value = true;
  complianceError.value = '';
  try {
    const res = await fetch(`/api/live-chat/sessions/${encodeURIComponent(sessionId)}/export`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(t('liveChat.exportTranscriptFailed'));
    const text = await res.text();
    const fileKey = String(effectiveSession.value?.sessionKey || sessionId).replace(/[^\w.-]+/g, '_');
    downloadBlob(text, `live-chat-${fileKey}.json`, 'application/json');
    await loadSessionDetail();
  } catch (err) {
    complianceError.value = err?.message || t('liveChat.exportTranscriptFailed');
  } finally {
    complianceBusy.value = false;
  }
}

async function toggleArchiveSession() {
  const sessionId = String(props.sessionId || '').trim();
  if (!sessionId || !canAdmin.value) return;

  complianceBusy.value = true;
  complianceError.value = '';
  try {
    const archived = !Boolean(effectiveSession.value?.sessionArchived);
    await apiClient.post(`/live-chat/sessions/${sessionId}/archive`, { archived });
    await loadSessionDetail();
  } catch (err) {
    complianceError.value = err?.message || t('liveChat.archiveSessionFailed');
  } finally {
    complianceBusy.value = false;
  }
}

async function loadVisitorContext() {
  const sessionId = String(props.sessionId || '').trim();
  const generation = ++contextLoadGeneration;

  if (!sessionId) {
    sessionDetail.value = null;
    visitorProfile.value = null;
    previousSessions.value = [];
    linkedRecords.value = [];
    loading.value = false;
    return;
  }

  loading.value = true;
  error.value = '';

  try {
    const session = await loadSessionDetail();
    if (generation !== contextLoadGeneration) return;

    const visitorId = String(session?.visitorId || props.session?.visitorId || '').trim();

    if (!visitorId) {
      visitorProfile.value = null;
      previousSessions.value = [];
      await Promise.all([
        loadLinkedRecords(),
        loadAssignmentHistory(),
        loadJourneyEvents(),
        loadSessionNotes(),
      ]);
      return;
    }

    await Promise.all([
      (async () => {
        const res = await apiClient.get(`/live-chat/visitors/${visitorId}`);
        if (!res?.success || !res.data) {
          visitorProfile.value = null;
          previousSessions.value = [];
          return;
        }
        visitorProfile.value = res.data;
        const all = Array.isArray(res.data.sessions) ? res.data.sessions : [];
        previousSessions.value = all.filter((row) => String(row._id) !== String(props.sessionId));
      })(),
      loadLinkedRecords(),
      loadAssignmentHistory(),
      loadJourneyEvents(),
      loadSessionNotes(),
    ]);
  } catch (err) {
    if (generation !== contextLoadGeneration) return;
    error.value = err?.message || t('liveChat.visitorLoadFailed');
    visitorProfile.value = null;
    previousSessions.value = [];
  } finally {
    if (generation === contextLoadGeneration) {
      loading.value = false;
    }
  }
}

watch(
  () => props.sessionId,
  () => {
    loadVisitorContext();
  },
  { immediate: true },
);
</script>
