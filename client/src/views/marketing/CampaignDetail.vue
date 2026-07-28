<template>
  <div class="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
    <div v-if="loading" class="flex min-h-[40vh] items-center justify-center">
      <div class="text-center">
        <div
          class="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"
          aria-hidden="true"
        />
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ t('marketing.campaignsDetailLoading') }}
        </p>
      </div>
    </div>

    <div v-else-if="error" class="flex min-h-[40vh] items-center justify-center py-16 text-center">
      <div>
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ t('marketing.campaignsDetailError') }}
        </h2>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">{{ error }}</p>
        <button
          type="button"
          class="mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          @click="router.push({ name: 'marketing-campaigns' })"
        >
          {{ t('actions.back') }}
        </button>
      </div>
    </div>

    <template v-else-if="campaign">
      <!-- Hero header -->
      <header
        class="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900"
      >
        <div class="border-b border-gray-100 bg-gradient-to-br from-indigo-50/80 via-white to-white px-5 py-5 dark:border-gray-800 dark:from-indigo-950/30 dark:via-gray-900 dark:to-gray-900 sm:px-6">
          <button
            type="button"
            class="mb-3 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
            @click="router.push({ name: 'marketing-campaigns' })"
          >
            <ChevronLeftIcon class="h-4 w-4" aria-hidden="true" />
            {{ t('actions.back') }}
          </button>

          <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <h1 class="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
                  {{ campaign.name }}
                </h1>
                <BadgeCell
                  :value="formatStatus(campaign.status)"
                  :variant="statusVariantMap[campaign.status] || 'default'"
                />
                <BadgeCell
                  v-if="campaign.approvalStatus && campaign.approvalStatus !== 'none'"
                  :value="formatApprovalStatus(campaign.approvalStatus)"
                  :variant="approvalVariantMap[campaign.approvalStatus] || 'default'"
                />
                <BadgeCell
                  v-if="campaign.abTest?.enabled"
                  :value="t('marketing.campaignsDetailTypeAbTest')"
                  variant="info"
                />
              </div>
              <p v-if="campaign.subject" class="mt-2 text-base text-gray-600 dark:text-gray-300">
                {{ campaign.subject }}
              </p>
              <p
                v-if="campaign.status === 'scheduled' && campaign.scheduledAt"
                class="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-700 dark:text-indigo-300"
              >
                <ClockIcon class="h-4 w-4 shrink-0" aria-hidden="true" />
                {{ t('marketing.campaignsScheduledFor', { date: formatScheduledAt(campaign.scheduledAt) }) }}
              </p>
              <p
                v-else-if="campaignSendFailureMessage"
                class="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200"
              >
                {{ campaignSendFailureMessage }}
              </p>
            </div>

            <!-- Primary actions -->
            <div class="flex shrink-0 flex-wrap items-center gap-2">
              <button
                v-if="canSend && isSendable"
                type="button"
                class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
                @click="openSendDrawer"
              >
                <PaperAirplaneIcon class="h-4 w-4" aria-hidden="true" />
                {{ t('marketing.campaignsActionSend') }}
              </button>
              <button
                v-if="canSend && isSendable"
                type="button"
                class="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                @click="openScheduleDrawer"
              >
                <CalendarDaysIcon class="h-4 w-4" aria-hidden="true" />
                {{ t('marketing.campaignsActionSchedule') }}
              </button>
              <button
                v-if="canSend && canTestSend"
                type="button"
                class="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                @click="showTestModal = true"
              >
                <BeakerIcon class="h-4 w-4" aria-hidden="true" />
                {{ t('marketing.campaignsTestSendAction') }}
              </button>
              <button
                v-if="canEdit && isEditable"
                type="button"
                class="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                @click="goToEdit"
              >
                <PencilSquareIcon class="h-4 w-4" aria-hidden="true" />
                {{ t('marketing.campaignsActionEdit') }}
              </button>
              <button
                v-if="canPreviewEmail"
                type="button"
                class="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                @click="openEmailPreview"
              >
                <EyeIcon class="h-4 w-4" aria-hidden="true" />
                {{ t('marketing.campaignsPreviewEmail') }}
              </button>
              <button
                v-if="hasSent"
                type="button"
                class="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                :disabled="refreshingStats"
                @click="refreshStats"
              >
                <ArrowPathIcon class="h-4 w-4" :class="{ 'animate-spin': refreshingStats }" aria-hidden="true" />
                {{ t('marketing.campaignsActionRefreshStats') }}
              </button>

              <Menu as="div" class="relative">
                <MenuButton
                  class="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white p-2.5 text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                  :aria-label="t('marketing.campaignsDetailMoreActions')"
                >
                  <EllipsisVerticalIcon class="h-5 w-5" aria-hidden="true" />
                </MenuButton>
                <transition
                  enter-active-class="transition duration-100 ease-out"
                  enter-from-class="transform scale-95 opacity-0"
                  enter-to-class="transform scale-100 opacity-100"
                  leave-active-class="transition duration-75 ease-in"
                  leave-from-class="transform scale-100 opacity-100"
                  leave-to-class="transform scale-95 opacity-0"
                >
                  <MenuItems
                    class="absolute right-0 z-20 mt-2 w-52 origin-top-right rounded-xl bg-white py-1 shadow-lg ring-1 ring-black/5 focus:outline-none dark:bg-gray-800 dark:ring-white/10"
                  >
                    <MenuItem v-if="canCreate" v-slot="{ active }">
                      <button
                        type="button"
                        :class="menuItemClass(active)"
                        @click="handleDuplicate"
                      >
                        {{ t('marketing.campaignsActionDuplicate') }}
                      </button>
                    </MenuItem>
                    <MenuItem v-if="canEdit && isArchivable" v-slot="{ active }">
                      <button type="button" :class="menuItemClass(active)" @click="handleArchive">
                        {{ t('marketing.campaignsActionArchive') }}
                      </button>
                    </MenuItem>
                    <MenuItem v-if="canEdit && isCancellable" v-slot="{ active }">
                      <button
                        type="button"
                        :class="[menuItemClass(active), 'text-red-600 dark:text-red-400']"
                        @click="handleCancel"
                      >
                        {{ t('marketing.campaignsActionCancel') }}
                      </button>
                    </MenuItem>
                    <MenuItem v-if="canEdit && isDeletable" v-slot="{ active }">
                      <button
                        type="button"
                        :class="[menuItemClass(active), 'text-red-600 dark:text-red-400']"
                        @click="handleDelete"
                      >
                        {{ t('marketing.campaignsActionDelete') }}
                      </button>
                    </MenuItem>
                  </MenuItems>
                </transition>
              </Menu>
            </div>
          </div>
        </div>

        <!-- Quick meta strip -->
        <dl class="grid gap-px bg-gray-100 sm:grid-cols-2 lg:grid-cols-4 dark:bg-gray-800">
          <div class="bg-white px-5 py-3 dark:bg-gray-900">
            <dt class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {{ t('marketing.campaignsDetailFromLabel') }}
            </dt>
            <dd class="mt-0.5 truncate text-sm font-medium text-gray-900 dark:text-white">
              {{ campaign.fromName ? `${campaign.fromName} · ` : '' }}{{ campaign.fromEmail || '—' }}
            </dd>
          </div>
          <div class="bg-white px-5 py-3 dark:bg-gray-900">
            <dt class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {{ t('marketing.campaignsDetailAudienceLabel') }}
            </dt>
            <dd class="mt-0.5 truncate text-sm font-medium text-gray-900 dark:text-white">
              <template v-if="linkedAudienceName">
                {{ linkedAudienceName }}
                <span class="text-gray-500 dark:text-gray-400">
                  ({{ linkedAudienceMemberCount.toLocaleString() }})
                </span>
              </template>
              <span v-else class="text-gray-400">—</span>
            </dd>
          </div>
          <div class="bg-white px-5 py-3 dark:bg-gray-900">
            <dt class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {{ t('marketing.campaignsDetailTypeLabel') }}
            </dt>
            <dd class="mt-0.5 text-sm font-medium text-gray-900 dark:text-white">
              {{
                campaign.abTest?.enabled
                  ? t('marketing.campaignsDetailTypeAbTest')
                  : t('marketing.campaignsDetailTypeStandard')
              }}
            </dd>
          </div>
          <div class="bg-white px-5 py-3 dark:bg-gray-900">
            <dt class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {{ t('marketing.campaignsDetailTrackingLabel') }}
            </dt>
            <dd class="mt-0.5 text-sm font-medium text-gray-900 dark:text-white">
              {{
                campaign.trackOpens !== false || campaign.trackClicks !== false
                  ? t('marketing.campaignsDetailTrackingOn')
                  : t('marketing.campaignsDetailTrackingOff')
              }}
            </dd>
          </div>
        </dl>
      </header>

      <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <!-- Main column -->
        <main class="min-w-0 space-y-6">
          <CampaignApprovalPanel
            :campaign="campaign"
            :current-user-id="currentUserId"
            :can-edit="canEdit"
            :can-approve="canApprove"
            :can-send="canSend"
            :is-sendable="isSendable"
            :submitting="approvalSubmitting"
            :reviewing="approvalReviewing"
            @submit="handleSubmitForReview"
            @approve="handleApproveCampaign"
            @reject="handleRejectCampaign"
          />

          <!-- Send progress -->
          <section
            v-if="showSendProgress"
            class="overflow-hidden rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white dark:border-indigo-900/50 dark:from-indigo-950/40 dark:to-gray-900"
          >
            <div class="border-b border-indigo-100 px-5 py-4 dark:border-indigo-900/40">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <h2 class="text-base font-semibold text-gray-900 dark:text-white">
                  {{ t('marketing.campaignSendProgressTitle') }}
                </h2>
                <span
                  class="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200"
                >
                  <span class="relative flex h-2 w-2">
                    <span
                      class="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-500 opacity-75"
                    />
                    <span class="relative inline-flex h-2 w-2 rounded-full bg-indigo-600" />
                  </span>
                  {{ sendProgressPhaseLabel }}
                </span>
              </div>
            </div>
            <div class="px-5 py-4">
              <div class="mb-4 flex items-center justify-between text-sm">
                <span class="font-medium text-gray-700 dark:text-gray-300">
                  {{
                    t('marketing.campaignSendProgressPrepared', {
                      prepared: sendProgressPrepared,
                      total: sendProgressTotal,
                      percent: sendProgressPercent
                    })
                  }}
                </span>
                <span class="tabular-nums font-semibold text-indigo-700 dark:text-indigo-300">
                  {{ sendProgressPercent }}%
                </span>
              </div>
              <div
                class="mb-4 h-2.5 overflow-hidden rounded-full bg-indigo-100 dark:bg-indigo-900/50"
                role="progressbar"
                :aria-valuenow="sendProgressPercent"
                aria-valuemin="0"
                aria-valuemax="100"
              >
                <div
                  class="h-full rounded-full bg-indigo-600 transition-all duration-500 ease-out dark:bg-indigo-400"
                  :style="{ width: `${sendProgressPercent}%` }"
                />
              </div>
              <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <div
                  v-if="sendProgress?.queued"
                  class="rounded-lg bg-white/80 px-3 py-2 text-sm dark:bg-gray-900/60"
                >
                  {{
                    t('marketing.campaignSendProgressQueued', {
                      count: formatCount(sendProgress.queued)
                    })
                  }}
                </div>
                <div
                  v-if="sendProgress?.skippedUnsubscribed"
                  class="rounded-lg bg-white/80 px-3 py-2 text-sm dark:bg-gray-900/60"
                >
                  {{
                    t('marketing.campaignSendProgressSkipped', {
                      count: formatCount(sendProgress.skippedUnsubscribed)
                    })
                  }}
                </div>
                <div
                  v-if="sendProgress?.creditsReserved"
                  class="rounded-lg bg-white/80 px-3 py-2 text-sm dark:bg-gray-900/60"
                >
                  {{
                    t('marketing.campaignSendProgressCredits', {
                      count: formatCount(sendProgress.creditsReserved)
                    })
                  }}
                </div>
              </div>
              <p v-if="sendProgressEstimateLabel" class="mt-3 text-sm text-gray-600 dark:text-gray-400">
                {{ sendProgressEstimateLabel }}
              </p>
              <p v-if="sendProgress?.error" class="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
                {{
                  t('marketing.campaignSendProgressFailed', {
                    error: sendProgress.error
                  })
                }}
              </p>
            </div>
          </section>

          <!-- Performance KPIs -->
          <section class="rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
            <div class="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
              <h2 class="text-base font-semibold text-gray-900 dark:text-white">
                {{ t('marketing.campaignsDetailPerformanceTitle') }}
              </h2>
            </div>
            <div class="grid gap-px bg-gray-100 sm:grid-cols-2 lg:grid-cols-4 dark:bg-gray-800">
              <div
                v-for="card in performanceStatCards"
                :key="card.key"
                class="bg-white px-5 py-4 dark:bg-gray-900"
              >
                <p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {{ card.label }}
                </p>
                <p
                  class="mt-1 text-3xl font-bold tabular-nums tracking-tight"
                  :class="statValueClass(card.tone)"
                >
                  {{ card.value }}
                </p>
                <p v-if="card.hint" class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ card.hint }}</p>
              </div>
            </div>
          </section>

          <!-- Delivery pipeline -->
          <section
            v-if="hasSent && deliveryStatCards.length"
            class="rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
          >
            <div class="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
              <h2 class="text-base font-semibold text-gray-900 dark:text-white">
                {{ t('marketing.campaignsDetailDeliveryTitle') }}
              </h2>
            </div>
            <div class="grid gap-3 p-4 sm:grid-cols-3">
              <div
                v-for="card in deliveryStatCards"
                :key="card.key"
                class="rounded-xl border px-4 py-3"
                :class="statCardBorderClass(card.tone)"
              >
                <p class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ card.label }}</p>
                <p class="mt-1 text-2xl font-bold tabular-nums" :class="statValueClass(card.tone)">
                  {{ card.value }}
                </p>
              </div>
            </div>
          </section>

          <!-- Deliverability issues -->
          <section
            v-if="hasSent && issueStatCards.length"
            class="rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
          >
            <div class="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
              <h2 class="text-base font-semibold text-gray-900 dark:text-white">
                {{ t('marketing.campaignsDetailIssuesTitle') }}
              </h2>
            </div>
            <div class="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
              <div
                v-for="card in issueStatCards"
                :key="card.key"
                class="rounded-xl border px-4 py-3"
                :class="statCardBorderClass(card.tone)"
              >
                <p class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ card.label }}</p>
                <p class="mt-1 text-2xl font-bold tabular-nums" :class="statValueClass(card.tone)">
                  {{ card.value }}
                </p>
              </div>
            </div>
          </section>

          <CampaignAbResultsPanel
            v-if="campaign.abTest?.enabled"
            :campaign-id="String(route.params.id || '')"
            :can-send="canSend"
            @updated="loadPage"
          />

          <!-- Recipients -->
          <section class="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
            <div class="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
              <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 class="text-base font-semibold text-gray-900 dark:text-white">
                    {{ t('marketing.campaignsRecipientsTitle') }}
                  </h2>
                  <p
                    v-if="recipientsPagination.total > 0"
                    class="mt-0.5 text-xs text-gray-500 dark:text-gray-400"
                  >
                    {{
                      t('marketing.campaignsDetailRecipientsShowing', {
                        shown: filteredRecipients.length.toLocaleString(),
                        total: recipientsPagination.total.toLocaleString()
                      })
                    }}
                  </p>
                </div>
                <div v-if="recipientsPagination.total > 0" class="flex flex-wrap items-center gap-2">
                  <input
                    v-model="recipientSearch"
                    type="search"
                    :placeholder="t('marketing.campaignsDetailRecipientsSearch')"
                    class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 sm:w-56"
                  />
                  <select
                    v-model="recipientStatusFilter"
                    class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
                  >
                    <option value="">{{ t('marketing.campaignsDetailRecipientsFilterAll') }}</option>
                    <option v-for="status in recipientStatusOptions" :key="status" :value="status">
                      {{ status }}
                    </option>
                  </select>
                </div>
              </div>
            </div>

            <div v-if="recipientsLoading" class="py-12 text-center text-sm text-gray-500">
              {{ t('states.loading') }}
            </div>

            <p
              v-else-if="recipientsPagination.total === 0"
              class="mx-5 my-8 rounded-xl border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500 dark:border-gray-600"
            >
              {{ t('marketing.campaignsRecipientsEmpty') }}
            </p>

            <p
              v-else-if="filteredRecipients.length === 0"
              class="mx-5 my-8 rounded-xl border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500 dark:border-gray-600"
            >
              {{ t('marketing.campaignsDetailRecipientsSearch') }}
            </p>

            <div v-else class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead class="bg-gray-50 dark:bg-gray-800/80">
                  <tr>
                    <th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {{ t('marketing.campaignsColEmail') }}
                    </th>
                    <th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {{ t('marketing.campaignsColDeliveryStatus') }}
                    </th>
                    <th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {{ t('marketing.campaignsColOpens') }}
                    </th>
                    <th class="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {{ t('marketing.campaignsColClicks') }}
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-900">
                  <tr
                    v-for="row in filteredRecipients"
                    :key="row._id"
                    class="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <td class="px-5 py-3.5 text-sm font-medium text-gray-900 dark:text-white">
                      {{ row.email || '—' }}
                    </td>
                    <td class="px-5 py-3.5 text-sm">
                      <BadgeCell
                        :value="row.status"
                        :variant="deliveryVariantMap[row.status] || 'default'"
                      />
                    </td>
                    <td class="px-5 py-3.5 text-sm tabular-nums text-gray-700 dark:text-gray-300">
                      {{ row.openCount || 0 }}
                    </td>
                    <td class="px-5 py-3.5 text-sm tabular-nums text-gray-700 dark:text-gray-300">
                      {{ row.clickCount || 0 }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div
              v-if="recipientsPagination.totalPages > 1"
              class="flex items-center justify-between border-t border-gray-100 px-5 py-3 dark:border-gray-800"
            >
              <button
                type="button"
                class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 disabled:opacity-40 dark:border-gray-600 dark:text-gray-200"
                :disabled="recipientsPagination.currentPage <= 1 || recipientsLoading"
                @click="loadRecipientsPage(recipientsPagination.currentPage - 1)"
              >
                {{ t('actions.previous') }}
              </button>
              <span class="text-sm text-gray-500 dark:text-gray-400">
                {{ recipientsPagination.currentPage }} / {{ recipientsPagination.totalPages }}
              </span>
              <button
                type="button"
                class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 disabled:opacity-40 dark:border-gray-600 dark:text-gray-200"
                :disabled="recipientsPagination.currentPage >= recipientsPagination.totalPages || recipientsLoading"
                @click="loadRecipientsPage(recipientsPagination.currentPage + 1)"
              >
                {{ t('actions.next') }}
              </button>
            </div>
          </section>
        </main>

        <!-- Sidebar -->
        <aside class="space-y-6">
          <section class="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
            <h2 class="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {{ t('marketing.campaignsDetailOverviewTitle') }}
            </h2>
            <dl class="space-y-4">
              <div>
                <dt class="text-xs text-gray-500 dark:text-gray-400">{{ t('marketing.campaignsDetailFromLabel') }}</dt>
                <dd class="mt-0.5 text-sm font-medium text-gray-900 dark:text-white break-all">
                  {{ campaign.fromEmail || '—' }}
                </dd>
              </div>
              <div v-if="linkedAudienceName">
                <dt class="text-xs text-gray-500 dark:text-gray-400">{{ t('marketing.campaignsDetailAudienceLabel') }}</dt>
                <dd class="mt-0.5 text-sm font-medium text-gray-900 dark:text-white">
                  {{ linkedAudienceName }}
                </dd>
                <dd class="text-xs text-gray-500">
                  {{ t('marketing.campaignsSendAudienceCount', { count: linkedAudienceMemberCount }) }}
                </dd>
              </div>
              <div v-if="linkedTemplateName || campaign.templateId">
                <dt class="text-xs text-gray-500 dark:text-gray-400">{{ t('marketing.campaignsDetailTemplateLabel') }}</dt>
                <dd class="mt-0.5 text-sm font-medium text-gray-900 dark:text-white">
                  {{ linkedTemplateName || '—' }}
                </dd>
              </div>
              <div v-if="hasSent">
                <dt class="text-xs text-gray-500 dark:text-gray-400">{{ t('marketing.campaignsStatsDelivered') }}</dt>
                <dd class="mt-0.5 text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                  {{ (campaign.stats?.delivered ?? 0).toLocaleString() }}
                </dd>
              </div>
              <div v-if="hasSent && performanceStatCards.find(c => c.key === 'openRate')">
                <dt class="text-xs text-gray-500 dark:text-gray-400">{{ t('marketing.campaignsStatsOpenRate') }}</dt>
                <dd class="mt-0.5 text-2xl font-bold tabular-nums text-gray-900 dark:text-white">
                  {{ formatRate(campaign.stats?.openRate) }}
                </dd>
              </div>
            </dl>
          </section>

          <CampaignDeliverabilityPanel
            v-if="hasSent"
            :loading="deliverabilityLoading"
            :sender-reputation="senderPolicy?.senderReputation ?? null"
            :sender-delta="senderPolicy?.reputationDelta ?? null"
            :health="campaignHealth"
          />
        </aside>
      </div>
    </template>

    <CampaignSendDrawer
      :is-open="showSendDrawer"
      :initial-delivery-timing="sendDrawerInitialTiming"
      :sending="sending"
      :testing="testing"
      :campaign-id="String(route.params.id || '')"
      :audience-id="linkedAudienceId"
      :audience-name="linkedAudienceName"
      :audience-member-count="linkedAudienceMemberCount"
      :precheck="precheck"
      :precheck-loading="precheckLoading"
      @close="showSendDrawer = false"
      @send="handleSend"
      @schedule="handleSchedule"
      @test-send="handleTestSend"
      @precheck-request="loadPrecheck"
    />

    <CampaignTestSendModal
      :is-open="showTestModal"
      :sending="testing"
      @close="showTestModal = false"
      @submit="handleTestSend"
    />

    <EmailPreviewModal
      :open="showEmailPreview"
      :html="previewHtml"
      :css="previewCss"
      @close="showEmailPreview = false"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue';
import {
  ArrowPathIcon,
  BeakerIcon,
  CalendarDaysIcon,
  ChevronLeftIcon,
  ClockIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  PaperAirplaneIcon,
  PencilSquareIcon
} from '@heroicons/vue/24/outline';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import CampaignSendDrawer from '@/components/marketing/CampaignSendDrawer.vue';
import CampaignTestSendModal from '@/components/marketing/CampaignTestSendModal.vue';
import CampaignApprovalPanel from '@/components/marketing/CampaignApprovalPanel.vue';
import CampaignAbResultsPanel from '@/components/marketing/CampaignAbResultsPanel.vue';
import CampaignDeliverabilityPanel from '@/components/marketing/CampaignDeliverabilityPanel.vue';
import EmailPreviewModal from '@/modules/template/components/html/EmailPreviewModal.vue';
import { useMarketingCampaigns } from '@/composables/useMarketingCampaigns';
import { useMarketingTemplates } from '@/composables/useMarketingTemplates';
import { useAuthStore } from '@/stores/authRegistry';
import { useNotifications } from '@/composables/useNotifications';
import apiClient from '@/utils/apiClient';
import { parseCampaignEmailPreview } from '@/utils/marketingEmailPreview';
import {
  captureMarketingCampaignSendStarted,
  captureMarketingCampaignScheduled,
  captureMarketingCampaignTestSent
} from '@/config/posthogMarketing';

import { confirmAction } from '@/composables/useConfirmAction';
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const notifications = useNotifications();

const {
  campaign,
  recipients,
  recipientsLoading,
  recipientsPagination,
  fetchCampaign,
  fetchCampaignRecipients,
  fetchCampaignAnalytics,
  sendCampaign,
  fetchCampaignSendProgress,
  scheduleCampaign,
  testSendCampaign,
  fetchCampaignPrecheck,
  duplicateCampaign,
  deleteCampaign,
  archiveCampaign,
  cancelCampaign,
  submitCampaignForReview,
  approveCampaign,
  rejectCampaign
} = useMarketingCampaigns();
const { fetchTemplate } = useMarketingTemplates();

const loading = ref(true);
const error = ref('');
const showSendDrawer = ref(false);
const sendDrawerInitialTiming = ref('now');
const showTestModal = ref(false);
const showEmailPreview = ref(false);
const previewHtml = ref('');
const previewCss = ref('');
const linkedTemplateName = ref('');
/** @type {import('vue').Ref<object|null>} */
const linkedTemplateRecord = ref(null);
const sending = ref(false);
const testing = ref(false);
const refreshingStats = ref(false);
const recipientSearch = ref('');
const recipientStatusFilter = ref('');
/** @type {import('vue').Ref<Record<string, unknown>|null>} */
const sendProgress = ref(null);
/** @type {ReturnType<typeof setInterval>|null} */
let sendProgressTimer = null;

const SEND_PROGRESS_POLL_MS = 3000;

const sendProgressPhaseKeys = {
  queued: 'marketing.campaignSendProgressPhaseQueued',
  resolving: 'marketing.campaignSendProgressPhaseResolving',
  preparing: 'marketing.campaignSendProgressPhasePreparing',
  running: 'marketing.campaignSendProgressPhaseRunning',
  submitting: 'marketing.campaignSendProgressPhaseSubmitting',
  completed: 'marketing.campaignSendProgressPhaseCompleted',
  failed: 'marketing.campaignSendProgressPhaseFailed'
};

const showSendProgress = computed(() => {
  if (sendProgress.value?.isActive) return true;
  const phase = campaign.value?.sendState?.phase;
  return ['queued', 'resolving', 'preparing', 'running', 'submitting'].includes(String(phase || ''));
});

const sendProgressPhaseLabel = computed(() => {
  const phase = String(sendProgress.value?.phase || campaign.value?.sendState?.phase || 'queued');
  const key = sendProgressPhaseKeys[phase];
  return key ? t(key) : phase;
});

const sendProgressTotal = computed(() =>
  Number(sendProgress.value?.resolvedCount || campaign.value?.sendState?.resolvedCount || 0)
);

const sendProgressPrepared = computed(() =>
  Number(sendProgress.value?.preparedCount || campaign.value?.sendState?.preparedCount || 0)
);

const sendProgressPercent = computed(() => {
  const fromApi = Number(sendProgress.value?.percentComplete);
  if (Number.isFinite(fromApi)) return Math.min(100, Math.max(0, fromApi));
  const total = sendProgressTotal.value;
  if (total <= 0) return 0;
  return Math.min(100, Math.round((sendProgressPrepared.value / total) * 100));
});

const sendProgressEstimateLabel = computed(() => {
  const seconds = Number(sendProgress.value?.estimate?.estimatedSeconds);
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const minutes = Math.max(1, Math.round(seconds / 60));
  const duration = minutes >= 60 ? `${Math.round(minutes / 60)} h` : `${minutes} min`;
  return t('marketing.campaignSendProgressEstimate', { duration });
});

function formatCount(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0';
  return num.toLocaleString();
}

function stopSendProgressPolling() {
  if (sendProgressTimer) {
    clearInterval(sendProgressTimer);
    sendProgressTimer = null;
  }
}

async function refreshSendProgress() {
  try {
    const data = await fetchCampaignSendProgress(route.params.id);
    sendProgress.value = data;
    if (!data?.isActive) {
      stopSendProgressPolling();
      if (data?.phase === 'completed' || data?.phase === 'failed') {
        await loadPage();
      }
    }
  } catch {
    // Keep polling — transient network errors should not stop tracking.
  }
}

function startSendProgressPolling() {
  stopSendProgressPolling();
  void refreshSendProgress();
  sendProgressTimer = setInterval(refreshSendProgress, SEND_PROGRESS_POLL_MS);
}

const precheck = ref(null);
const precheckLoading = ref(false);
const approvalSubmitting = ref(false);
const approvalReviewing = ref(false);
const deliverabilityLoading = ref(false);
/** @type {import('vue').Ref<Record<string, unknown>|null>} */
const senderPolicy = ref(null);
/** @type {import('vue').Ref<Record<string, unknown>|null>} */
const campaignHealth = ref(null);

const canEdit = computed(() => authStore.can('campaigns', 'edit'));
const canSend = computed(() => authStore.can('campaigns', 'send'));
const canCreate = computed(() => authStore.can('campaigns', 'create'));
const canApprove = computed(() => authStore.can('campaigns', 'approve'));
const currentUserId = computed(() => String(authStore.user?._id || authStore.user?.id || ''));

const statusVariantMap = {
  draft: 'warning',
  scheduled: 'info',
  running: 'primary',
  paused: 'default',
  completed: 'success',
  cancelled: 'default',
  archived: 'default',
  failed: 'danger'
};

const approvalVariantMap = {
  none: 'default',
  pending_review: 'warning',
  approved: 'success',
  rejected: 'danger'
};

const approvalLabelKeys = {
  none: 'marketing.campaignsApprovalStatusNone',
  pending_review: 'marketing.campaignsApprovalStatusPending',
  approved: 'marketing.campaignsApprovalStatusApproved',
  rejected: 'marketing.campaignsApprovalStatusRejected'
};

const deliveryVariantMap = {
  sending: 'warning',
  sent: 'info',
  delivered: 'success',
  opened: 'primary',
  bounced: 'danger',
  failed: 'danger',
  complained: 'danger',
  suppressed: 'warning',
  queued: 'info',
  pending: 'default'
};

const statusLabelKeys = {
  draft: 'marketing.campaignsStatusDraft',
  scheduled: 'marketing.campaignsStatusScheduled',
  running: 'marketing.campaignsStatusRunning',
  paused: 'marketing.campaignsStatusPaused',
  completed: 'marketing.campaignsStatusCompleted',
  cancelled: 'marketing.campaignsStatusCancelled',
  archived: 'marketing.campaignsStatusArchived',
  failed: 'marketing.campaignsStatusFailed'
};

const isOperational = computed(() =>
  ['draft', 'scheduled', 'failed'].includes(campaign.value?.status)
);
const isApprovedForSend = computed(() => campaign.value?.approvalStatus === 'approved');
const isEditable = computed(() =>
  isOperational.value && campaign.value?.approvalStatus !== 'pending_review'
);
const isSendable = computed(() => isOperational.value && isApprovedForSend.value);

const campaignSendFailureMessage = computed(() => {
  if (campaign.value?.status !== 'failed') return '';
  const raw = String(
    sendProgress.value?.error
    || campaign.value?.stats?.sendError
    || campaign.value?.sendState?.error
    || ''
  ).trim();
  if (!raw) return t('marketing.campaignsSendFailedGeneric');
  const code = raw.toLowerCase();
  if (code === 'burst_limit_exceeded' || raw.includes('burst limit')) {
    return t('marketing.campaignsSendFailedBurstLimit');
  }
  if (code === 'hourly_limit_exceeded' || raw.includes('Hourly sending')) {
    return t('marketing.campaignsSendFailedHourlyLimit');
  }
  if (code === 'daily_limit_exceeded' || raw.includes('Daily sending')) {
    return t('marketing.campaignsSendFailedDailyLimit');
  }
  return raw;
});
const canTestSend = computed(() => isOperational.value);
const isArchivable = computed(() => ['completed', 'cancelled', 'failed'].includes(campaign.value?.status));
const isDeletable = computed(() =>
  ['draft', 'completed', 'cancelled', 'failed', 'archived'].includes(campaign.value?.status)
);
const isCancellable = computed(() => ['draft', 'scheduled', 'running', 'paused'].includes(campaign.value?.status));
const hasSent = computed(() => (campaign.value?.stats?.totalRecipients || 0) > 0);

const linkedAudienceId = computed(() =>
  campaign.value?.audienceId ? String(campaign.value.audienceId) : ''
);
const linkedAudienceName = ref('');
const linkedAudienceMemberCount = ref(0);

const canPreviewEmail = computed(() => Boolean(String(campaign.value?.bodyHtml || '').trim()));

async function loadLinkedTemplate() {
  linkedTemplateName.value = '';
  linkedTemplateRecord.value = null;
  const templateId = campaign.value?.templateId;
  if (!templateId) return;
  try {
    const record = await fetchTemplate(String(templateId));
    linkedTemplateRecord.value = record;
    linkedTemplateName.value = record?.name || '';
  } catch {
    /* optional */
  }
}

async function openEmailPreview() {
  let templateRecord = linkedTemplateRecord.value;
  if (!templateRecord && campaign.value?.templateId) {
    try {
      templateRecord = await fetchTemplate(String(campaign.value.templateId));
      linkedTemplateRecord.value = templateRecord;
      linkedTemplateName.value = templateRecord?.name || linkedTemplateName.value;
    } catch {
      /* optional */
    }
  }
  const parsed = parseCampaignEmailPreview(
    campaign.value?.bodyHtml || '',
    templateRecord
  );
  if (!parsed.html && !parsed.css) {
    notifications.error(t('marketing.campaignsPreviewEmailEmpty'));
    return;
  }
  previewHtml.value = parsed.html;
  previewCss.value = parsed.css;
  showEmailPreview.value = true;
}

/** @typedef {{ key: string, label: string, value: string|number, tone?: string, hint?: string }} StatCard */

/** @type {import('vue').ComputedRef<StatCard[]>} */
const allStatCards = computed(() => {
  const stats = campaign.value?.stats || {};
  return [
    {
      key: 'recipients',
      label: t('marketing.campaignsStatsRecipients'),
      value: (stats.totalRecipients ?? stats.queued ?? 0).toLocaleString(),
      tone: 'default',
      group: 'performance'
    },
    {
      key: 'delivered',
      label: t('marketing.campaignsStatsDelivered'),
      value: (stats.delivered ?? 0).toLocaleString(),
      tone: 'success',
      group: 'performance'
    },
    {
      key: 'openRate',
      label: t('marketing.campaignsStatsOpenRate'),
      value: formatRate(stats.openRate),
      tone: 'primary',
      group: 'performance'
    },
    {
      key: 'clickRate',
      label: t('marketing.campaignsStatsClickRate'),
      value: formatRate(stats.clickRate),
      tone: 'primary',
      group: 'performance'
    },
    {
      key: 'queued',
      label: t('marketing.campaignsStatsQueued'),
      value: (stats.queued ?? 0).toLocaleString(),
      tone: 'info',
      group: 'delivery'
    },
    {
      key: 'failed',
      label: t('marketing.campaignsStatsFailed'),
      value: (stats.failed ?? 0).toLocaleString(),
      tone: 'danger',
      group: 'delivery'
    },
    {
      key: 'rejected',
      label: t('marketing.campaignsStatsRejected'),
      value: (stats.rejected ?? 0).toLocaleString(),
      tone: 'warning',
      group: 'delivery'
    },
    {
      key: 'hardBounced',
      label: t('marketing.campaignsStatsHardBounced'),
      value: (stats.hardBounced ?? 0).toLocaleString(),
      tone: 'danger',
      group: 'issues'
    },
    {
      key: 'softBounced',
      label: t('marketing.campaignsStatsSoftBounced'),
      value: (stats.softBounced ?? 0).toLocaleString(),
      tone: 'warning',
      group: 'issues'
    },
    {
      key: 'complaints',
      label: t('marketing.campaignsStatsComplaints'),
      value: (stats.complaints ?? 0).toLocaleString(),
      tone: 'danger',
      group: 'issues'
    },
    {
      key: 'unsubscribed',
      label: t('marketing.campaignsStatsUnsubscribed'),
      value: (stats.skippedUnsubscribed ?? 0).toLocaleString(),
      tone: 'warning',
      group: 'issues'
    },
    {
      key: 'suppressed',
      label: t('marketing.campaignsStatsSuppressed'),
      value: (stats.suppressed ?? 0).toLocaleString(),
      tone: 'warning',
      group: 'issues'
    }
  ];
});

const performanceStatCards = computed(() => {
  const cards = allStatCards.value.filter((card) => card.group === 'performance');
  if (!hasSent.value) {
    return cards.filter((card) => card.key === 'recipients');
  }
  return cards;
});

const deliveryStatCards = computed(() =>
  allStatCards.value.filter((card) => card.group === 'delivery')
);

const issueStatCards = computed(() =>
  allStatCards.value.filter((card) => card.group === 'issues')
);

const recipientStatusOptions = computed(() => {
  const statuses = new Set(
    recipients.value.map((row) => String(row.status || '').trim()).filter(Boolean)
  );
  return [...statuses].sort();
});

const filteredRecipients = computed(() => {
  const query = recipientSearch.value.trim().toLowerCase();
  const status = recipientStatusFilter.value;
  return recipients.value.filter((row) => {
    const email = String(row.email || '').toLowerCase();
    const matchesQuery = !query || email.includes(query);
    const matchesStatus = !status || String(row.status || '') === status;
    return matchesQuery && matchesStatus;
  });
});

function menuItemClass(active) {
  return [
    active ? 'bg-gray-100 dark:bg-gray-700' : '',
    'block w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200'
  ].join(' ');
}

function statValueClass(tone) {
  if (tone === 'success') return 'text-emerald-700 dark:text-emerald-400';
  if (tone === 'danger') return 'text-red-700 dark:text-red-400';
  if (tone === 'warning') return 'text-amber-700 dark:text-amber-400';
  if (tone === 'primary') return 'text-indigo-700 dark:text-indigo-400';
  if (tone === 'info') return 'text-sky-700 dark:text-sky-400';
  return 'text-gray-900 dark:text-white';
}

function statCardBorderClass(tone) {
  if (tone === 'success') return 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20';
  if (tone === 'danger') return 'border-red-200 bg-red-50/40 dark:border-red-900/40 dark:bg-red-950/20';
  if (tone === 'warning') return 'border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/20';
  if (tone === 'info') return 'border-sky-200 bg-sky-50/40 dark:border-sky-900/40 dark:bg-sky-950/20';
  return 'border-gray-200 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/30';
}

function formatStatus(value) {
  const key = statusLabelKeys[value];
  return key ? t(key) : String(value || 'draft');
}

function formatApprovalStatus(value) {
  const key = approvalLabelKeys[value];
  return key ? t(key) : String(value || 'none');
}

function formatRate(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0%';
  return `${Math.round(num * (num <= 1 ? 100 : 1))}%`;
}

function formatScheduledAt(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || '');
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

async function loadPrecheck(recipientCount) {
  precheckLoading.value = true;
  try {
    const count =
      typeof recipientCount === 'number'
        ? recipientCount
        : linkedAudienceMemberCount.value > 0
          ? linkedAudienceMemberCount.value
          : undefined;
    precheck.value = await fetchCampaignPrecheck(route.params.id, {
      ...(count != null ? { recipientCount: count } : {})
    });
  } catch {
    precheck.value = null;
  } finally {
    precheckLoading.value = false;
  }
}

async function openSendDrawer() {
  sendDrawerInitialTiming.value = 'now';
  showSendDrawer.value = true;
  await loadPrecheck();
}

async function openScheduleDrawer() {
  sendDrawerInitialTiming.value = 'schedule';
  showSendDrawer.value = true;
  await loadPrecheck();
}

async function loadLinkedAudience() {
  linkedAudienceName.value = '';
  linkedAudienceMemberCount.value = 0;
  if (!linkedAudienceId.value) return;
  try {
    const res = await apiClient.get(`/marketing/audiences/${linkedAudienceId.value}`, {
      cache: 'no-store'
    });
    if (res?.success && res.data) {
      linkedAudienceName.value = res.data.name || '';
      linkedAudienceMemberCount.value = res.data.memberCount || 0;
    }
  } catch {
    /* optional */
  }
}

async function loadDeliverability() {
  if (!hasSent.value) {
    senderPolicy.value = null;
    campaignHealth.value = null;
    return;
  }

  deliverabilityLoading.value = true;
  try {
    const [policyRes, analytics] = await Promise.all([
      apiClient.get('/marketing/campaigns/send-policy', { cache: 'no-store' }),
      fetchCampaignAnalytics(route.params.id)
    ]);
    senderPolicy.value = policyRes?.data || null;
    campaignHealth.value = analytics?.health || null;
  } catch {
    senderPolicy.value = null;
    campaignHealth.value = null;
  } finally {
    deliverabilityLoading.value = false;
  }
}

async function loadRecipientsPage(page = 1) {
  await fetchCampaignRecipients(route.params.id, { page, limit: recipientsPagination.limit });
}

async function loadPage() {
  loading.value = true;
  error.value = '';
  recipientSearch.value = '';
  recipientStatusFilter.value = '';
  try {
    await fetchCampaign(route.params.id);
    await loadLinkedAudience();
    await loadLinkedTemplate();
    await loadRecipientsPage(1);
    await loadDeliverability();
    const phase = campaign.value?.sendState?.phase;
    if (['queued', 'resolving', 'preparing', 'running', 'submitting'].includes(String(phase || ''))) {
      startSendProgressPolling();
    }
  } catch (err) {
    error.value = err?.message || t('marketing.campaignsDetailError');
  } finally {
    loading.value = false;
  }
}

function goToEdit() {
  router.push({ name: 'marketing-campaign-edit', params: { id: route.params.id } });
}

async function handleSend(payload) {
  if (!campaign.value?.fromEmail?.trim()) {
    notifications.error(t('marketing.campaignsValidationFromRequired'));
    return;
  }
  if (!campaign.value?.bodyHtml?.trim()) {
    notifications.error(t('marketing.campaignsValidationBodyRequired'));
    return;
  }

  sending.value = true;
  try {
    const sendPayload =
      payload?.mode === 'audience'
        ? { audienceId: payload.audienceId || linkedAudienceId.value }
        : { recipients: payload?.recipients || payload };

    await sendCampaign(route.params.id, sendPayload);
    captureMarketingCampaignSendStarted({
      campaign_id: route.params.id,
      send_mode: payload?.mode === 'audience' ? 'audience' : 'manual'
    });
    notifications.success(t('marketing.campaignsSendSuccess'), {
      secondary: t('marketing.campaignsSendStartedHint')
    });
    showSendDrawer.value = false;
    startSendProgressPolling();
    await loadPage();
  } catch (err) {
    notifications.error(err?.message || t('states.genericFailure'));
  } finally {
    sending.value = false;
  }
}

async function handleSchedule(payload) {
  if (!campaign.value?.fromEmail?.trim()) {
    notifications.error(t('marketing.campaignsValidationFromRequired'));
    return;
  }
  if (!campaign.value?.bodyHtml?.trim()) {
    notifications.error(t('marketing.campaignsValidationBodyRequired'));
    return;
  }

  sending.value = true;
  try {
    const schedulePayload = {
      scheduledAt: payload.scheduledAt,
      timezone: payload.timezone,
      quietHours: payload.quietHours,
      ...(payload.mode === 'audience'
        ? { audienceId: payload.audienceId || linkedAudienceId.value }
        : { recipients: payload.recipients || [] })
    };

    await scheduleCampaign(route.params.id, schedulePayload);
    captureMarketingCampaignScheduled({
      campaign_id: route.params.id,
      send_mode: payload?.mode === 'audience' ? 'audience' : 'manual'
    });
    notifications.success(t('marketing.campaignsScheduleSuccess'));
    showSendDrawer.value = false;
    await loadPage();
  } catch (err) {
    notifications.error(err?.message || t('states.genericFailure'));
  } finally {
    sending.value = false;
  }
}

async function handleTestSend(payload) {
  testing.value = true;
  try {
    await testSendCampaign(route.params.id, payload);
    captureMarketingCampaignTestSent({ campaign_id: route.params.id });
    notifications.success(t('marketing.campaignsTestSendSuccess'));
    showTestModal.value = false;
  } catch (err) {
    notifications.error(err?.message || t('states.genericFailure'));
  } finally {
    testing.value = false;
  }
}

async function handleSubmitForReview(payload) {
  approvalSubmitting.value = true;
  try {
    await submitCampaignForReview(route.params.id, payload);
    notifications.success(t('marketing.campaignsApprovalSubmitSuccess'));
    await loadPage();
  } catch (err) {
    notifications.error(err?.message || t('states.genericFailure'));
  } finally {
    approvalSubmitting.value = false;
  }
}

async function handleApproveCampaign(payload) {
  approvalReviewing.value = true;
  try {
    await approveCampaign(route.params.id, payload);
    notifications.success(t('marketing.campaignsApprovalApproveSuccess'));
    await loadPage();
  } catch (err) {
    notifications.error(err?.message || t('states.genericFailure'));
  } finally {
    approvalReviewing.value = false;
  }
}

async function handleRejectCampaign(payload) {
  approvalReviewing.value = true;
  try {
    await rejectCampaign(route.params.id, payload);
    notifications.success(t('marketing.campaignsApprovalRejectSuccess'));
    await loadPage();
  } catch (err) {
    notifications.error(err?.message || t('states.genericFailure'));
  } finally {
    approvalReviewing.value = false;
  }
}

async function handleDuplicate() {
  try {
    const copy = await duplicateCampaign(route.params.id);
    notifications.success(t('marketing.campaignsDuplicateSuccess'));
    const id = copy?._id || copy?.id;
    if (id) router.push({ name: 'marketing-campaign-detail', params: { id } });
  } catch (err) {
    notifications.error(err?.message || t('states.genericFailure'));
  }
}

async function handleDelete() {
  if (!await confirmAction(t('marketing.campaignsDeleteConfirm'))) return;
  try {
    await deleteCampaign(route.params.id);
    notifications.success(t('marketing.campaignsDeleteSuccess'));
    router.push({ name: 'marketing-campaigns' });
  } catch (err) {
    notifications.error(err?.message || t('states.genericFailure'));
  }
}

async function handleArchive() {
  try {
    await archiveCampaign(route.params.id);
    notifications.success(t('marketing.campaignsArchiveSuccess'));
    await loadPage();
  } catch (err) {
    notifications.error(err?.message || t('states.genericFailure'));
  }
}

async function handleCancel() {
  try {
    await cancelCampaign(route.params.id);
    notifications.success(t('marketing.campaignsCancelSuccess'));
    await loadPage();
  } catch (err) {
    notifications.error(err?.message || t('states.genericFailure'));
  }
}

async function refreshStats() {
  refreshingStats.value = true;
  try {
    const data = await fetchCampaignAnalytics(route.params.id);
    if (data?.stats && campaign.value) {
      campaign.value = {
        ...campaign.value,
        stats: data.stats,
        status: data.status || campaign.value.status
      };
    }
    campaignHealth.value = data?.health || campaignHealth.value;
    await loadRecipientsPage(recipientsPagination.currentPage);
  } catch (err) {
    notifications.error(err?.message || t('states.genericFailure'));
  } finally {
    refreshingStats.value = false;
  }
}

onMounted(loadPage);
onUnmounted(stopSendProgressPolling);
</script>
