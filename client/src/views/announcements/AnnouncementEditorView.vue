<template>
  <div class="flex min-h-0 flex-1 flex-col bg-neutral-50 dark:bg-neutral-950">
    <!-- Header -->
    <div class="shrink-0 border-b border-neutral-200 bg-white px-6 py-2.5 dark:border-neutral-800 dark:bg-neutral-900">
      <div class="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
        <div class="flex min-w-0 shrink-0 items-center gap-3">
          <button
            type="button"
            class="rounded-lg px-2 py-1 text-sm font-medium text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-950/30"
            @click="router.push('/announcements')"
          >
            {{ t('announcements.backToList') }}
          </button>
          <div class="h-5 w-px bg-neutral-200 dark:bg-neutral-800" aria-hidden="true" />
          <h1 class="truncate text-section-title text-neutral-900 dark:text-white">
            {{ editorTitle }}
          </h1>
          <span
            v-if="recordStatus"
            class="rounded-full border border-neutral-200 px-2.5 py-0.5 text-xs font-medium text-neutral-600 dark:border-neutral-700 dark:text-neutral-300"
          >
            {{ statusLabel }}
          </span>
          <span
            v-if="!isReadOnly && saveStatusLabel"
            class="hidden text-helper text-neutral-500 dark:text-neutral-400 sm:inline"
            aria-live="polite"
          >
            {{ saveStatusLabel }}
          </span>
        </div>

        <!-- Step pills -->
        <nav
          class="flex min-w-0 flex-1 justify-start gap-1 overflow-x-auto pb-0.5 lg:justify-end"
          :aria-label="t('announcements.stepsNavLabel')"
        >
        <button
          v-for="step in steps"
          :key="step.id"
          type="button"
          class="shrink-0 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors"
          :class="activeStep === step.id
            ? 'border-primary-600 bg-primary-600 text-white'
            : stepComplete[step.id]
              ? 'border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-800 dark:bg-primary-950/40 dark:text-primary-300'
              : 'border-transparent text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800'"
          @click="goToStep(step.id)"
        >
          <span class="mr-1.5 inline-block w-3 text-center text-meta opacity-70">{{ step.n }}</span>
          {{ step.label }}
        </button>
        </nav>
      </div>
    </div>

    <!-- Body: form + sticky preview -->
    <div class="min-h-0 flex-1 overflow-auto px-6 py-4 lg:overflow-hidden">
      <div class="mx-auto grid max-w-6xl gap-8 lg:h-full lg:grid-cols-[minmax(0,1fr)_380px]">
        <form
          id="announcement-editor-form"
          class="min-h-0 space-y-8 pb-4 lg:overflow-y-auto"
          @submit.prevent="onSaveDraft"
        >
          <div
            v-if="isReadOnly"
            class="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300"
          >
            {{ isLiveLocked ? t('announcements.liveLockedBanner') : t('announcements.readOnlyBanner') }}
          </div>

          <fieldset
            class="space-y-8 border-0 p-0 disabled:opacity-80"
            :disabled="isReadOnly"
          >
            <!-- 1 Message -->
            <section
              :id="STEP_IDS.message"
              ref="sectionMessage"
              class="scroll-mt-4 space-y-5 rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div>
                <h2 class="text-section-title text-neutral-900 dark:text-white">
                  {{ t('announcements.stepMessage') }}
                </h2>
                <p class="text-helper mt-1 text-neutral-500 dark:text-neutral-400">
                  {{ t('announcements.stepMessageHelp') }}
                </p>
              </div>

              <div>
                <label class="text-label text-neutral-600 dark:text-neutral-400">{{ t('announcements.fieldTitle') }}</label>
                <input
                  v-model="form.title"
                  required
                  maxlength="200"
                  class="mt-2 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                >
              </div>

              <div>
                <label class="text-label text-neutral-600 dark:text-neutral-400">{{ t('announcements.fieldShortDescription') }}</label>
                <input
                  v-model="form.shortDescription"
                  maxlength="500"
                  class="mt-2 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                >
              </div>

              <div>
                <label class="text-label text-neutral-600 dark:text-neutral-400">{{ t('announcements.fieldBody') }}</label>
                <textarea
                  v-model="form.content.body"
                  rows="5"
                  class="mt-2 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                />
              </div>

              <div class="space-y-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
                <p class="text-label text-neutral-600 dark:text-neutral-400">{{ t('announcements.fieldMedia') }}</p>
                <div>
                  <label class="text-label text-neutral-600 dark:text-neutral-400">{{ t('announcements.fieldImageUrl') }}</label>
                  <input
                    v-model="form.content.imageUrl"
                    type="url"
                    maxlength="2000"
                    class="mt-2 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                    :placeholder="t('announcements.fieldImageUrlHint')"
                  >
                </div>
                <div>
                  <label class="text-label text-neutral-600 dark:text-neutral-400">{{ t('announcements.fieldYoutubeUrl') }}</label>
                  <input
                    v-model="form.content.youtubeUrl"
                    type="url"
                    maxlength="500"
                    class="mt-2 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                    :placeholder="t('announcements.fieldYoutubeUrlHint')"
                  >
                </div>
                <div>
                  <div class="flex items-center justify-between gap-3">
                    <label class="text-label text-neutral-600 dark:text-neutral-400">{{ t('announcements.fieldAttachments') }}</label>
                    <button
                      type="button"
                      class="text-sm font-medium text-primary-600 hover:text-primary-700 disabled:opacity-50"
                      :disabled="form.content.attachments.length >= 5"
                      @click="addAttachment"
                    >
                      {{ t('announcements.addAttachment') }}
                    </button>
                  </div>
                  <p class="mt-1 text-helper text-neutral-500 dark:text-neutral-400">
                    {{ t('announcements.fieldAttachmentsHint') }}
                  </p>
                  <div
                    v-for="(file, index) in form.content.attachments"
                    :key="index"
                    class="mt-3 grid gap-2 sm:grid-cols-[1fr_2fr_auto]"
                  >
                    <input
                      v-model="file.name"
                      maxlength="200"
                      class="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                      :placeholder="t('announcements.attachmentName')"
                    >
                    <input
                      v-model="file.url"
                      type="url"
                      maxlength="2000"
                      class="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                      :placeholder="t('announcements.attachmentUrl')"
                    >
                    <button
                      type="button"
                      class="rounded-lg px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                      @click="removeAttachment(index)"
                    >
                      {{ t('announcements.removeAttachment') }}
                    </button>
                  </div>
                </div>
                <div>
                  <div class="flex items-center justify-between gap-3">
                    <label class="text-label text-neutral-600 dark:text-neutral-400">{{ t('announcements.fieldCtas') }}</label>
                    <button
                      type="button"
                      class="text-sm font-medium text-primary-600 hover:text-primary-700 disabled:opacity-50"
                      :disabled="form.ctas.length >= 3"
                      @click="addCta"
                    >
                      {{ t('announcements.addCta') }}
                    </button>
                  </div>
                  <p class="mt-1 text-helper text-neutral-500 dark:text-neutral-400">
                    {{ t('announcements.fieldCtasHint') }}
                  </p>
                  <div
                    v-for="(cta, index) in form.ctas"
                    :key="index"
                    class="mt-3 grid gap-2 sm:grid-cols-[1fr_2fr_auto]"
                  >
                    <input
                      v-model="cta.label"
                      maxlength="40"
                      class="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                      :placeholder="t('announcements.ctaLabel')"
                    >
                    <input
                      v-model="cta.target"
                      type="url"
                      maxlength="2000"
                      class="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                      :placeholder="t('announcements.ctaUrl')"
                    >
                    <button
                      type="button"
                      class="rounded-lg px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                      @click="removeCta(index)"
                    >
                      {{ t('announcements.removeAttachment') }}
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <!-- 2 Appearance -->
            <section
              :id="STEP_IDS.appearance"
              ref="sectionAppearance"
              class="scroll-mt-4 space-y-5 rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div>
                <h2 class="text-section-title text-neutral-900 dark:text-white">
                  {{ t('announcements.stepAppearance') }}
                </h2>
                <p class="text-helper mt-1 text-neutral-500 dark:text-neutral-400">
                  {{ t('announcements.stepAppearanceHelp') }}
                </p>
              </div>

              <div>
                <p class="text-label text-neutral-600 dark:text-neutral-400">{{ t('announcements.fieldDisplayType') }}</p>
                <div class="mt-3 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    class="rounded-xl border p-4 text-left transition"
                    :class="form.displayType === 'banner'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30'
                      : 'border-neutral-200 hover:border-neutral-300 dark:border-neutral-700'"
                    @click="form.displayType = 'banner'"
                  >
                    <span class="text-sm font-medium text-neutral-900 dark:text-white">{{ t('announcements.typeBanner') }}</span>
                    <span class="text-helper mt-1 block text-neutral-600 dark:text-neutral-400">{{ t('announcements.displayBannerHelp') }}</span>
                  </button>
                  <button
                    type="button"
                    class="rounded-xl border p-4 text-left transition"
                    :class="form.displayType === 'popover'
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/30'
                      : 'border-neutral-200 hover:border-neutral-300 dark:border-neutral-700'"
                    @click="form.displayType = 'popover'"
                  >
                    <span class="text-sm font-medium text-neutral-900 dark:text-white">{{ t('announcements.typePopover') }}</span>
                    <span class="text-helper mt-1 block text-neutral-600 dark:text-neutral-400">{{ t('announcements.displayPopoverHelp') }}</span>
                  </button>
                </div>
              </div>

              <div>
                <label
                  id="announcement-priority-label"
                  class="text-label text-neutral-600 dark:text-neutral-400"
                >{{ t('announcements.fieldPriority') }}</label>
                <HeadlessSelect
                  id="announcement-priority"
                  v-model="form.priority"
                  :options="priorityOptions"
                  :placeholder="t('announcements.fieldPriority')"
                  :disabled="isReadOnly"
                  teleport
                  wrapper-class="mt-2"
                  button-class="rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                />
              </div>
            </section>

            <!-- 3 Audience -->
            <section
              :id="STEP_IDS.audience"
              ref="sectionAudience"
              class="scroll-mt-4 space-y-5 rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div>
                <h2 class="text-section-title text-neutral-900 dark:text-white">
                  {{ t('announcements.stepAudience') }}
                </h2>
                <p class="text-helper mt-1 text-neutral-500 dark:text-neutral-400">
                  {{ t('announcements.stepAudienceHelp') }}
                </p>
              </div>

              <div>
                <p class="text-label text-neutral-600 dark:text-neutral-400">{{ t('announcements.fieldAudience') }}</p>
                <div class="mt-3 flex flex-wrap gap-3">
                  <label class="inline-flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                    <input
                      v-model="form.audience.mode"
                      type="radio"
                      value="everyone"
                      class="text-primary-600 focus:ring-primary-500"
                    >
                    {{ t('announcements.audienceEveryone') }}
                  </label>
                  <label class="inline-flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                    <input
                      v-model="form.audience.mode"
                      type="radio"
                      value="segment"
                      class="text-primary-600 focus:ring-primary-500"
                    >
                    {{ t('announcements.audienceSpecific') }}
                  </label>
                </div>

                <div
                  v-if="form.audience.mode === 'segment'"
                  class="mt-4 space-y-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-700"
                >
                  <div>
                    <label class="text-label text-neutral-600 dark:text-neutral-400">{{ t('announcements.audienceRoles') }}</label>
                    <select
                      v-model="selectedRoleIds"
                      multiple
                      class="mt-2 h-28 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                    >
                      <option
                        v-for="role in audienceOptions.roles"
                        :key="role.id"
                        :value="role.id"
                      >
                        {{ role.name }}
                      </option>
                    </select>
                  </div>
                  <div>
                    <label class="text-label text-neutral-600 dark:text-neutral-400">{{ t('announcements.audienceTeams') }}</label>
                    <select
                      v-model="selectedTeamIds"
                      multiple
                      class="mt-2 h-28 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                    >
                      <option
                        v-for="team in audienceOptions.teams"
                        :key="team.id"
                        :value="team.id"
                      >
                        {{ team.name }}
                      </option>
                    </select>
                  </div>
                  <div>
                    <label class="text-label text-neutral-600 dark:text-neutral-400">{{ t('announcements.audienceUserTypes') }}</label>
                    <select
                      v-model="selectedUserTypes"
                      multiple
                      class="mt-2 h-20 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                    >
                      <option
                        v-for="ut in audienceOptions.userTypes"
                        :key="ut.value"
                        :value="ut.value"
                      >
                        {{ ut.label }}
                      </option>
                    </select>
                  </div>
                  <p
                    v-if="!audienceSegmentReady"
                    class="text-helper text-warning-700 dark:text-warning-400"
                  >
                    {{ t('announcements.reviewAudienceEmpty') }}
                  </p>
                </div>
              </div>
            </section>

            <!-- 4 Timing -->
            <section
              :id="STEP_IDS.timing"
              ref="sectionTiming"
              class="scroll-mt-4 space-y-5 rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div>
                <h2 class="text-section-title text-neutral-900 dark:text-white">
                  {{ t('announcements.stepTiming') }}
                </h2>
                <p class="text-helper mt-1 text-neutral-500 dark:text-neutral-400">
                  {{ t('announcements.stepTimingHelp') }}
                </p>
              </div>

              <div>
                <label
                  id="announcement-trigger-label"
                  class="text-label text-neutral-600 dark:text-neutral-400"
                >{{ t('announcements.fieldTrigger') }}</label>
                <HeadlessSelect
                  id="announcement-trigger"
                  v-model="form.trigger.type"
                  :options="triggerOptions"
                  :placeholder="t('announcements.fieldTrigger')"
                  :disabled="isReadOnly"
                  teleport
                  wrapper-class="mt-2"
                  button-class="rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-950"
                />
              </div>

              <div class="grid gap-4 sm:grid-cols-2">
                <div v-if="needsScheduleStart">
                  <label class="text-label text-neutral-600 dark:text-neutral-400">{{ t('announcements.fieldStartAt') }}</label>
                  <input
                    v-model="startAtLocal"
                    type="datetime-local"
                    class="mt-2 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                  >
                </div>
                <div v-if="showEndAt || needsScheduleStart">
                  <label class="text-label text-neutral-600 dark:text-neutral-400">{{ t('announcements.fieldEndAt') }}</label>
                  <p class="mt-1 text-helper text-neutral-500 dark:text-neutral-400">
                    {{ t('announcements.fieldEndAtHelp') }}
                  </p>
                  <input
                    v-model="endAtLocal"
                    type="datetime-local"
                    class="mt-2 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                  >
                </div>
              </div>
              <button
                v-if="!showEndAt && !needsScheduleStart"
                type="button"
                class="text-sm font-medium text-primary-600 hover:text-primary-700"
                @click="showEndAt = true"
              >
                {{ t('announcements.addEndDate') }}
              </button>
              <p
                v-if="!needsScheduleStart && !showEndAt"
                class="text-helper text-neutral-500 dark:text-neutral-400"
              >
                {{ t('announcements.timingImmediateHint') }}
              </p>

              <div class="space-y-3 border-t border-neutral-200 pt-5 dark:border-neutral-800">
                <p class="text-label text-neutral-600 dark:text-neutral-400">{{ t('announcements.fieldBehaviour') }}</p>
                <label class="flex items-center gap-3 text-sm text-neutral-700 dark:text-neutral-300">
                  <input
                    v-model="form.userBehaviour.dismissible"
                    type="checkbox"
                    class="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                  >
                  {{ t('announcements.fieldDismissible') }}
                </label>
                <label class="flex items-center gap-3 text-sm text-neutral-700 dark:text-neutral-300">
                  <input
                    v-model="form.userBehaviour.requireAcknowledgement"
                    type="checkbox"
                    class="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                  >
                  {{ t('announcements.fieldRequireAck') }}
                </label>
              </div>
            </section>

            <!-- 5 Review -->
            <section
              :id="STEP_IDS.review"
              ref="sectionReview"
              class="scroll-mt-4 space-y-5 rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
            >
              <div>
                <h2 class="text-section-title text-neutral-900 dark:text-white">
                  {{ t('announcements.stepReview') }}
                </h2>
                <p class="text-helper mt-1 text-neutral-500 dark:text-neutral-400">
                  {{ t('announcements.stepReviewHelp') }}
                </p>
              </div>

              <ul class="space-y-2">
                <li
                  v-for="item in reviewChecklist"
                  :key="item.key"
                  class="flex items-start gap-2 text-sm"
                  :class="item.ok ? 'text-success-700 dark:text-success-400' : 'text-neutral-600 dark:text-neutral-400'"
                >
                  <span
                    class="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                    :class="item.ok
                      ? 'bg-success-100 text-success-700 dark:bg-success-950 dark:text-success-400'
                      : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800'"
                    aria-hidden="true"
                  >
                    {{ item.ok ? '✓' : '·' }}
                  </span>
                  {{ item.label }}
                </li>
              </ul>

              <dl class="grid gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm dark:border-neutral-700 dark:bg-neutral-950 sm:grid-cols-2">
                <div>
                  <dt class="text-meta text-neutral-500">{{ t('announcements.fieldDisplayType') }}</dt>
                  <dd class="mt-0.5 font-medium text-neutral-900 dark:text-white">
                    {{ form.displayType === 'banner' ? t('announcements.typeBanner') : t('announcements.typePopover') }}
                  </dd>
                </div>
                <div>
                  <dt class="text-meta text-neutral-500">{{ t('announcements.fieldPriority') }}</dt>
                  <dd class="mt-0.5 font-medium text-neutral-900 dark:text-white">
                    {{ priorityOptions.find((o) => o.value === form.priority)?.label }}
                  </dd>
                </div>
                <div>
                  <dt class="text-meta text-neutral-500">{{ t('announcements.fieldAudience') }}</dt>
                  <dd class="mt-0.5 font-medium text-neutral-900 dark:text-white">
                    {{ audienceSummary }}
                  </dd>
                </div>
                <div>
                  <dt class="text-meta text-neutral-500">{{ t('announcements.fieldTrigger') }}</dt>
                  <dd class="mt-0.5 font-medium text-neutral-900 dark:text-white">
                    {{ timingSummary }}
                  </dd>
                </div>
              </dl>
            </section>
          </fieldset>
        </form>

        <!-- Desktop sticky preview -->
        <aside class="hidden min-h-0 lg:sticky lg:top-0 lg:flex lg:h-full lg:flex-col lg:self-start lg:overflow-hidden">
          <AnnouncementLivePreview
            :title="form.title"
            :short-description="form.shortDescription"
            :body="form.content.body"
            :display-type="form.displayType"
            :priority="form.priority"
            :image-url="form.content.imageUrl"
            :youtube-url="form.content.youtubeUrl"
            :attachments="form.content.attachments"
            :ctas="form.ctas"
            :dismissible="form.userBehaviour.dismissible"
            :require-acknowledgement="form.userBehaviour.requireAcknowledgement"
          />
        </aside>
      </div>
    </div>

    <!-- Sticky footer -->
    <div class="shrink-0 border-t border-neutral-200 bg-white px-6 py-3 dark:border-neutral-800 dark:bg-neutral-900">
      <div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          class="text-sm font-medium text-primary-600 hover:text-primary-700 lg:hidden"
          @click="mobilePreviewOpen = true"
        >
          {{ t('announcements.previewOpen') }}
        </button>
        <div class="ml-auto flex flex-wrap gap-3">
          <template v-if="isLiveLocked">
            <button
              type="button"
              class="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-800"
              @click="router.push('/announcements')"
            >
              {{ t('announcements.backToList') }}
            </button>
            <button
              type="button"
              class="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
              :disabled="saving"
              @click="onPause"
            >
              {{ t('announcements.pauseToEdit') }}
            </button>
          </template>
          <template v-else-if="isReadOnly">
            <button
              type="button"
              class="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-800"
              @click="router.push('/announcements')"
            >
              {{ t('announcements.backToList') }}
            </button>
            <button
              type="button"
              class="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
              :disabled="saving"
              @click="onDuplicate"
            >
              {{ t('announcements.duplicate') }}
            </button>
          </template>
          <template v-else>
            <button
              type="submit"
              form="announcement-editor-form"
              class="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-800"
              :disabled="saving"
            >
              {{ t('announcements.saveDraft') }}
            </button>
            <button
              type="button"
              class="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
              :disabled="saving || !publishReady"
              :title="publishReady ? undefined : t('announcements.publishBlockedHint')"
              @click="onPublish"
            >
              {{ t('announcements.publish') }}
            </button>
          </template>
        </div>
      </div>
    </div>

    <!-- Mobile preview sheet -->
    <Teleport to="body">
      <div
        v-if="mobilePreviewOpen"
        class="fixed inset-0 z-[80] flex flex-col justify-end bg-neutral-900/50 lg:hidden"
        role="dialog"
        aria-modal="true"
        :aria-label="t('announcements.previewLabel')"
        @click.self="mobilePreviewOpen = false"
      >
        <div class="max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white p-4 dark:bg-neutral-900">
          <div class="mb-3 flex items-center justify-between">
            <p class="text-sm font-medium text-neutral-900 dark:text-white">{{ t('announcements.previewLabel') }}</p>
            <button
              type="button"
              class="rounded-lg px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
              @click="mobilePreviewOpen = false"
            >
              {{ t('announcements.previewClose') }}
            </button>
          </div>
          <AnnouncementLivePreview
            :title="form.title"
            :short-description="form.shortDescription"
            :body="form.content.body"
            :display-type="form.displayType"
            :priority="form.priority"
            :image-url="form.content.imageUrl"
            :youtube-url="form.content.youtubeUrl"
            :attachments="form.content.attachments"
            :ctas="form.ctas"
            :dismissible="form.userBehaviour.dismissible"
            :require-acknowledgement="form.userBehaviour.requireAcknowledgement"
          />
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';
import { useTabs } from '@/composables/useTabs';
import { captureAnnouncementPublished } from '@/config/posthogAnnouncements';
import AnnouncementLivePreview from '@/components/announcements/AnnouncementLivePreview.vue';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';

import { confirmAction } from '@/composables/useConfirmAction';
const STEP_IDS = {
  message: 'step-message',
  appearance: 'step-appearance',
  audience: 'step-audience',
  timing: 'step-timing',
  review: 'step-review',
};

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const notifications = useNotifications();
const { activeTab, findTabByPath } = useTabs();

const AUTOSAVE_MS = 1500;

const priorityOptions = computed(() => [
  { value: 'critical', label: t('announcements.priorityCritical') },
  { value: 'high', label: t('announcements.priorityHigh') },
  { value: 'medium', label: t('announcements.priorityMedium') },
  { value: 'low', label: t('announcements.priorityLow') },
  { value: 'information', label: t('announcements.priorityInformation') },
]);

const triggerOptions = computed(() => [
  { value: 'immediate', label: t('announcements.triggerImmediate') },
  { value: 'scheduled', label: t('announcements.triggerScheduled') },
  { value: 'every_login', label: t('announcements.triggerEveryLogin') },
  { value: 'once_per_user', label: t('announcements.triggerOnce') },
  { value: 'daily', label: t('announcements.triggerDaily') },
  { value: 'until_dismissed', label: t('announcements.triggerUntilDismissed') },
  { value: 'until_acknowledged', label: t('announcements.triggerUntilAck') },
]);

const steps = computed(() => [
  { id: STEP_IDS.message, n: 1, label: t('announcements.stepMessage') },
  { id: STEP_IDS.appearance, n: 2, label: t('announcements.stepAppearance') },
  { id: STEP_IDS.audience, n: 3, label: t('announcements.stepAudience') },
  { id: STEP_IDS.timing, n: 4, label: t('announcements.stepTiming') },
  { id: STEP_IDS.review, n: 5, label: t('announcements.stepReview') },
]);

const saving = ref(false);
const recordStatus = ref('');
const activeStep = ref(STEP_IDS.message);
const mobilePreviewOpen = ref(false);
const showEndAt = ref(false);
const suppressDirty = ref(true);
const savedSnapshot = ref('');
const autosavePhase = ref('idle'); // idle | dirty | saving | saved | error
const lastSavedAt = ref(null);
const allowLeave = ref(false);
let autosaveTimer = null;
let boundTab = null;
const audienceOptions = reactive({
  roles: [],
  teams: [],
  userTypes: [],
});
const selectedRoleIds = ref([]);
const selectedTeamIds = ref([]);
const selectedUserTypes = ref([]);
const startAtLocal = ref('');
const endAtLocal = ref('');

const sectionMessage = ref(null);
const sectionAppearance = ref(null);
const sectionAudience = ref(null);
const sectionTiming = ref(null);
const sectionReview = ref(null);

const form = reactive({
  title: '',
  shortDescription: '',
  displayType: 'banner',
  priority: 'medium',
  content: {
    body: '',
    imageUrl: '',
    youtubeUrl: '',
    attachments: [],
  },
  audience: { mode: 'everyone', segments: [] },
  schedule: {
    publishImmediately: true,
    startAt: new Date().toISOString(),
    endAt: null,
    timezone: 'UTC',
  },
  userBehaviour: {
    dismissible: true,
    stickyBanner: false,
    requireAcknowledgement: false,
  },
  trigger: { type: 'immediate' },
  ctas: [],
});

const isEdit = computed(() => Boolean(route.params.id) && route.params.id !== 'new');
const isLiveLocked = computed(() => recordStatus.value === 'published');
const isReadOnly = computed(() => (
  isLiveLocked.value
  || recordStatus.value === 'archived'
  || recordStatus.value === 'expired'
));
const editorTitle = computed(() => {
  if (isReadOnly.value) return t('announcements.editorTitleView');
  return isEdit.value ? t('announcements.editorTitleEdit') : t('announcements.editorTitleNew');
});

const statusLabel = computed(() => {
  const map = {
    draft: t('announcements.statusDraft'),
    scheduled: t('announcements.statusScheduled'),
    published: t('announcements.statusPublished'),
    active: t('announcements.statusActive'),
    paused: t('announcements.statusPaused'),
    expired: t('announcements.statusExpired'),
    archived: t('announcements.statusArchived'),
  };
  return map[recordStatus.value] || recordStatus.value;
});

const audienceSegmentReady = computed(() => (
  selectedRoleIds.value.length > 0
  || selectedTeamIds.value.length > 0
  || selectedUserTypes.value.length > 0
));

const audienceReady = computed(() => (
  form.audience.mode === 'everyone' || audienceSegmentReady.value
));

const hasTitle = computed(() => String(form.title || '').trim().length > 0);
const needsScheduleStart = computed(() => form.trigger.type === 'scheduled');
const hasStart = computed(() => (
  needsScheduleStart.value ? Boolean(startAtLocal.value) : true
));
const hasDisplayType = computed(() => form.displayType === 'banner' || form.displayType === 'popover');

const publishReady = computed(() => (
  hasTitle.value && hasDisplayType.value && audienceReady.value && hasStart.value
));

const stepComplete = computed(() => ({
  [STEP_IDS.message]: hasTitle.value,
  [STEP_IDS.appearance]: hasDisplayType.value,
  [STEP_IDS.audience]: audienceReady.value,
  [STEP_IDS.timing]: hasStart.value,
  [STEP_IDS.review]: publishReady.value,
}));

const reviewChecklist = computed(() => [
  { key: 'title', ok: hasTitle.value, label: t('announcements.reviewNeedTitle') },
  { key: 'display', ok: hasDisplayType.value, label: t('announcements.reviewNeedDisplay') },
  { key: 'audience', ok: audienceReady.value, label: t('announcements.reviewNeedAudience') },
  {
    key: 'start',
    ok: hasStart.value,
    label: needsScheduleStart.value
      ? t('announcements.reviewNeedStart')
      : t('announcements.reviewTimingOk'),
  },
]);

const audienceSummary = computed(() => {
  if (form.audience.mode === 'everyone') return t('announcements.audienceEveryone');
  const parts = [];
  if (selectedRoleIds.value.length) parts.push(`${selectedRoleIds.value.length} ${t('announcements.audienceRoles').toLowerCase()}`);
  if (selectedTeamIds.value.length) parts.push(`${selectedTeamIds.value.length} ${t('announcements.audienceTeams').toLowerCase()}`);
  if (selectedUserTypes.value.length) parts.push(`${selectedUserTypes.value.length} ${t('announcements.audienceUserTypes').toLowerCase()}`);
  return parts.length ? parts.join(', ') : t('announcements.audienceSpecific');
});

const timingSummary = computed(() => {
  const triggerLabel = triggerOptions.value.find((o) => o.value === form.trigger.type)?.label
    || form.trigger.type;
  if (needsScheduleStart.value) {
    const start = startAtLocal.value || '—';
    const end = endAtLocal.value ? ` → ${endAtLocal.value}` : '';
    return `${triggerLabel}: ${start}${end}`;
  }
  if (endAtLocal.value) {
    return `${triggerLabel} · ${t('announcements.fieldEndAt')}: ${endAtLocal.value}`;
  }
  return triggerLabel;
});

function draftFingerprint() {
  return JSON.stringify({
    title: form.title,
    shortDescription: form.shortDescription,
    displayType: form.displayType,
    priority: form.priority,
    content: form.content,
    audienceMode: form.audience.mode,
    roleIds: selectedRoleIds.value,
    teamIds: selectedTeamIds.value,
    userTypes: selectedUserTypes.value,
    startAtLocal: startAtLocal.value,
    endAtLocal: endAtLocal.value,
    dismissible: form.userBehaviour.dismissible,
    requireAcknowledgement: form.userBehaviour.requireAcknowledgement,
    trigger: form.trigger.type,
    ctas: form.ctas,
  });
}

function markClean() {
  savedSnapshot.value = draftFingerprint();
  autosavePhase.value = 'saved';
  lastSavedAt.value = Date.now();
  suppressDirty.value = false;
}

const isDirty = computed(() => {
  if (isReadOnly.value || suppressDirty.value) return false;
  return draftFingerprint() !== savedSnapshot.value;
});

const saveStatusLabel = computed(() => {
  if (autosavePhase.value === 'saving') return t('announcements.autosaveSaving');
  if (autosavePhase.value === 'error') return t('announcements.autosaveFailed');
  if (autosavePhase.value === 'dirty' || isDirty.value) return t('announcements.autosaveUnsaved');
  if (autosavePhase.value === 'saved' && lastSavedAt.value) {
    const seconds = Math.max(0, Math.round((Date.now() - lastSavedAt.value) / 1000));
    if (seconds < 5) return t('announcements.autosaveSavedJustNow');
    return t('announcements.autosaveSavedAgo', { seconds });
  }
  return '';
});

function scheduleAutosave() {
  if (isReadOnly.value || suppressDirty.value) return;
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    void runAutosave({ quiet: true });
  }, AUTOSAVE_MS);
}

watch(isDirty, (dirty) => {
  if (!dirty || isReadOnly.value) return;
  autosavePhase.value = 'dirty';
  scheduleAutosave();
}, { flush: 'post' });

async function runAutosave({ quiet = true } = {}) {
  if (isReadOnly.value || !hasTitle.value || saving.value) return false;
  if (!isDirty.value && quiet) return true;

  autosavePhase.value = 'saving';
  saving.value = true;
  try {
    if (isEdit.value) {
      await apiClient.put(`/announcements/${route.params.id}`, payload());
    } else {
      const res = await apiClient.post('/announcements', payload());
      const id = res?.data?.id || res?.data?._id;
      if (id) {
        allowLeave.value = true;
        await router.replace(`/announcements/${id}`);
        allowLeave.value = false;
        recordStatus.value = 'draft';
      }
    }
    markClean();
    if (!quiet) notifications.success(t('announcements.saveSuccess'));
    return true;
  } catch (err) {
    autosavePhase.value = 'error';
    if (!quiet) notifications.error(err?.message || t('announcements.saveFailed'));
    return false;
  } finally {
    saving.value = false;
  }
}

async function confirmLeave() {
  if (allowLeave.value || isReadOnly.value) return true;
  clearTimeout(autosaveTimer);
  if (isDirty.value && hasTitle.value) {
    await runAutosave({ quiet: true });
  }
  if (!isDirty.value) return true;
  return await confirmAction(t('announcements.leaveUnsaved'));
}

function handleBeforeUnload(e) {
  if (allowLeave.value || isReadOnly.value || !isDirty.value) return undefined;
  e.preventDefault();
  e.returnValue = '';
  return '';
}

function bindTabLeaveGuard() {
  const tab = activeTab.value
    || findTabByPath(route.fullPath)
    || findTabByPath(route.path);
  if (!tab) return;
  boundTab = tab;
  tab.beforeClose = async () => confirmLeave();
}

function unbindTabLeaveGuard() {
  if (boundTab?.beforeClose) {
    boundTab.beforeClose = null;
  }
  boundTab = null;
}

onBeforeRouteLeave(async () => {
  const ok = await confirmLeave();
  return ok;
});

function goToStep(stepId) {
  activeStep.value = stepId;
  spyLockedUntil = Date.now() + 900;
  const el = document.getElementById(stepId);
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

let stepScrollRoot = null;
let spyLockedUntil = 0;
let scrollRaf = 0;

function sectionNodes() {
  return [
    sectionMessage.value,
    sectionAppearance.value,
    sectionAudience.value,
    sectionTiming.value,
    sectionReview.value,
  ].filter(Boolean);
}

function syncActiveStepFromScroll() {
  if (Date.now() < spyLockedUntil) return;
  const root = stepScrollRoot || document.getElementById('announcement-editor-form');
  if (!root) return;

  const rootTop = root.getBoundingClientRect().top;
  const marker = 48;
  let currentId = sectionNodes()[0]?.id || activeStep.value;

  for (const el of sectionNodes()) {
    const top = el.getBoundingClientRect().top - rootTop;
    if (top <= marker) {
      currentId = el.id;
    }
  }

  if (currentId && activeStep.value !== currentId) {
    activeStep.value = currentId;
  }
}

function onFormScroll() {
  if (scrollRaf) return;
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = 0;
    syncActiveStepFromScroll();
  });
}

function setupStepObserver() {
  stepScrollRoot?.removeEventListener('scroll', onFormScroll);
  stepScrollRoot = document.getElementById('announcement-editor-form');
  if (!stepScrollRoot) return;
  stepScrollRoot.addEventListener('scroll', onFormScroll, { passive: true });
  syncActiveStepFromScroll();
}

function teardownStepSpy() {
  stepScrollRoot?.removeEventListener('scroll', onFormScroll);
  stepScrollRoot = null;
  if (scrollRaf) {
    cancelAnimationFrame(scrollRaf);
    scrollRaf = 0;
  }
}

function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function applyAudienceFromDoc(audience) {
  form.audience.mode = audience?.mode === 'segment' ? 'segment' : 'everyone';
  selectedRoleIds.value = [];
  selectedTeamIds.value = [];
  selectedUserTypes.value = [];
  for (const segment of audience?.segments || []) {
    if (segment.type === 'role') selectedRoleIds.value = [...segment.values];
    if (segment.type === 'team' || segment.type === 'group') selectedTeamIds.value = [...segment.values];
    if (segment.type === 'user_type') selectedUserTypes.value = [...segment.values];
  }
}

function buildAudiencePayload() {
  if (form.audience.mode !== 'segment') {
    return { mode: 'everyone', segments: [] };
  }
  const segments = [];
  if (selectedRoleIds.value.length) {
    segments.push({ type: 'role', values: [...selectedRoleIds.value] });
  }
  if (selectedTeamIds.value.length) {
    segments.push({ type: 'team', values: [...selectedTeamIds.value] });
  }
  if (selectedUserTypes.value.length) {
    segments.push({ type: 'user_type', values: [...selectedUserTypes.value] });
  }
  return { mode: 'segment', segments };
}

watch(
  () => form.trigger.type,
  (type) => {
    form.schedule.publishImmediately = type !== 'scheduled';
    if (type !== 'scheduled') {
      startAtLocal.value = toLocalInput(new Date().toISOString());
    }
  },
);

async function loadAudienceOptions() {
  const res = await apiClient.get('/announcements/meta/audience-options');
  audienceOptions.roles = res?.data?.roles || [];
  audienceOptions.teams = res?.data?.teams || [];
  audienceOptions.userTypes = res?.data?.userTypes || [];
}

async function loadExisting() {
  if (!isEdit.value) return;
  const res = await apiClient.get(`/announcements/${route.params.id}`);
  const data = res?.data;
  if (!data) return;
  recordStatus.value = data.status || '';
  form.title = data.title || '';
  form.shortDescription = data.shortDescription || '';
  form.displayType = data.displayType || 'banner';
  form.priority = data.priority || 'medium';
  form.content.body = data.content?.body || data.detailedDescription || '';
  form.content.imageUrl = data.content?.imageUrl || '';
  form.content.youtubeUrl = data.content?.youtubeUrl || '';
  form.content.attachments = Array.isArray(data.content?.attachments)
    ? data.content.attachments.map((file) => ({
      name: file.name || '',
      url: file.url || '',
    }))
    : [];
  form.ctas = Array.isArray(data.ctas)
    ? data.ctas.map((cta) => ({
      id: cta.id || '',
      label: cta.label || '',
      target: cta.target || '',
      actionType: cta.actionType || 'external_url',
      style: cta.style || 'link',
    }))
    : [];
  form.userBehaviour.dismissible = data.userBehaviour?.dismissible !== false;
  form.userBehaviour.requireAcknowledgement = data.userBehaviour?.requireAcknowledgement === true;
  form.trigger.type = data.trigger?.type || 'immediate';
  form.schedule = {
    publishImmediately: data.schedule?.publishImmediately !== false,
    startAt: data.schedule?.startAt || new Date().toISOString(),
    endAt: data.schedule?.endAt || null,
    timezone: data.schedule?.timezone || 'UTC',
  };
  startAtLocal.value = toLocalInput(form.schedule.startAt);
  endAtLocal.value = toLocalInput(form.schedule.endAt);
  showEndAt.value = Boolean(form.schedule.endAt);
  applyAudienceFromDoc(data.audience);
}

function addAttachment() {
  if (form.content.attachments.length >= 5) return;
  form.content.attachments.push({ name: '', url: '' });
}

function removeAttachment(index) {
  form.content.attachments.splice(index, 1);
}

function addCta() {
  if (form.ctas.length >= 3) return;
  form.ctas.push({
    id: '',
    label: '',
    target: '',
    actionType: 'external_url',
    style: 'link',
  });
}

function removeCta(index) {
  form.ctas.splice(index, 1);
}

function payload() {
  const startAt = needsScheduleStart.value
    ? (fromLocalInput(startAtLocal.value) || form.schedule.startAt || new Date().toISOString())
    : new Date().toISOString();
  const endAt = fromLocalInput(endAtLocal.value);
  return {
    title: form.title,
    shortDescription: form.shortDescription,
    detailedDescription: form.content.body,
    displayType: form.displayType,
    priority: form.priority,
    content: {
      body: form.content.body,
      imageUrl: form.content.imageUrl || null,
      youtubeUrl: form.content.youtubeUrl || null,
      attachments: form.content.attachments
        .filter((file) => String(file.url || '').trim())
        .map((file) => ({
          name: String(file.name || '').trim(),
          url: String(file.url || '').trim(),
        })),
    },
    audience: buildAudiencePayload(),
    schedule: {
      ...form.schedule,
      publishImmediately: form.trigger.type !== 'scheduled',
      startAt,
      endAt,
    },
    userBehaviour: form.userBehaviour,
    trigger: form.trigger,
    ctas: form.ctas
      .filter((cta) => String(cta.label || '').trim() && String(cta.target || '').trim())
      .map((cta, index) => ({
        id: cta.id || undefined,
        label: String(cta.label).trim(),
        target: String(cta.target).trim(),
        actionType: /^https?:\/\//i.test(String(cta.target).trim())
          ? 'external_url'
          : (cta.actionType || 'internal_route'),
        style: cta.style || 'link',
        sortOrder: index,
      })),
  };
}

async function onDuplicate() {
  if (!isEdit.value) return;
  saving.value = true;
  suppressDirty.value = true;
  try {
    const res = await apiClient.post(`/announcements/${route.params.id}/duplicate`);
    const newId = res?.data?.id || res?.data?._id;
    notifications.success(t('announcements.duplicateSuccess'));
    if (newId) {
      allowLeave.value = true;
      await router.replace(`/announcements/${newId}`);
      allowLeave.value = false;
      recordStatus.value = 'draft';
      await loadExisting();
      markClean();
    }
  } catch (err) {
    notifications.error(err?.message || t('announcements.saveFailed'));
    suppressDirty.value = false;
  } finally {
    saving.value = false;
  }
}

async function onPause() {
  if (!isEdit.value || !isLiveLocked.value) return;
  saving.value = true;
  suppressDirty.value = true;
  try {
    await apiClient.post(`/announcements/${route.params.id}/pause`);
    notifications.success(t('announcements.pausedForEdit'));
    await loadExisting();
    markClean();
  } catch (err) {
    notifications.error(err?.message || t('announcements.saveFailed'));
    suppressDirty.value = false;
  } finally {
    saving.value = false;
  }
}

async function onSaveDraft() {
  if (isReadOnly.value) return;
  await runAutosave({ quiet: false });
}

async function onPublish() {
  if (isReadOnly.value || !publishReady.value) {
    if (!publishReady.value) {
      goToStep(STEP_IDS.review);
      notifications.error(t('announcements.publishBlockedHint'));
    }
    return;
  }
  const confirmBody = t('announcements.publishConfirmDetail', {
    audience: audienceSummary.value,
    when: timingSummary.value,
  });
  if (!await confirmAction(`${t('announcements.publishConfirmTitle')}\n\n${confirmBody}`)) {
    return;
  }
  clearTimeout(autosaveTimer);
  saving.value = true;
  try {
    let id = route.params.id;
    if (!isEdit.value) {
      const res = await apiClient.post('/announcements', { ...payload(), publish: true });
      id = res?.data?.id || res?.data?._id;
      if (id) {
        captureAnnouncementPublished(String(id), {
          display_type: form.displayType,
          priority: form.priority,
        });
      }
      notifications.success(t('announcements.publishSuccess'));
      allowLeave.value = true;
      markClean();
      await router.push('/announcements');
      return;
    }
    await apiClient.put(`/announcements/${id}`, payload());
    await apiClient.post(`/announcements/${id}/publish`);
    captureAnnouncementPublished(String(id), {
      display_type: form.displayType,
      priority: form.priority,
    });
    notifications.success(t('announcements.publishSuccess'));
    allowLeave.value = true;
    markClean();
    await router.push('/announcements');
  } catch (err) {
    notifications.error(err?.message || t('announcements.saveFailed'));
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  suppressDirty.value = true;
  startAtLocal.value = toLocalInput(new Date().toISOString());
  window.addEventListener('beforeunload', handleBeforeUnload);
  void Promise.all([loadAudienceOptions(), loadExisting()])
    .then(async () => {
      markClean();
      await nextTick(() => {
        setupStepObserver();
        bindTabLeaveGuard();
      });
    })
    .catch((err) => {
      suppressDirty.value = false;
      notifications.error(err?.message || t('announcements.loadFailed'));
    });
});

onUnmounted(() => {
  clearTimeout(autosaveTimer);
  teardownStepSpy();
  unbindTabLeaveGuard();
  window.removeEventListener('beforeunload', handleBeforeUnload);
});
</script>
