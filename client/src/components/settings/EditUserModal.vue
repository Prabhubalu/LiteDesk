<template>
  <TransitionRoot as="template" :show="isOpen && Boolean(user)">
    <Dialog class="relative z-50" @close="close">
      <TransitionChild
        as="template"
        enter="ease-out duration-200"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-200"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-gray-500/75 dark:bg-black/75" />
      </TransitionChild>

      <div class="fixed inset-0 overflow-hidden">
        <div class="absolute inset-0 overflow-hidden">
          <div class="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
            <TransitionChild
              as="template"
              enter="transform transition ease-in-out duration-300 sm:duration-300"
              enter-from="translate-x-full"
              enter-to="translate-x-0"
              leave="transform transition ease-in-out duration-300 sm:duration-300"
              leave-from="translate-x-0"
              leave-to="translate-x-full"
            >
              <div class="pointer-events-auto flex h-full">
                <DialogPanel
                  v-if="user"
                  class="flex h-full w-[min(92vw,42rem)] max-w-[95vw] flex-col bg-white shadow-xl dark:bg-gray-800"
                >
                  <form class="relative flex h-full flex-col divide-y divide-gray-200 dark:divide-gray-700" @submit.prevent="handleSubmit">
                    <div class="shrink-0 bg-indigo-700 px-4 py-5 dark:bg-indigo-800 sm:px-6">
                      <div class="flex items-start justify-between gap-3">
                        <div class="flex min-w-0 items-start gap-3">
                          <div
                            v-if="user.avatar"
                            class="h-11 w-11 shrink-0 overflow-hidden rounded-xl ring-2 ring-white/20"
                          >
                            <img :src="user.avatar" :alt="userDisplayName(user)" class="h-full w-full object-cover" />
                          </div>
                          <div
                            v-else
                            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 text-sm font-bold text-white shadow-lg"
                          >
                            {{ userInitials(user) }}
                          </div>
                          <div class="min-w-0">
                            <DialogTitle class="truncate text-base font-semibold text-white">
                              {{ userDisplayName(user) }}
                            </DialogTitle>
                            <p class="mt-0.5 truncate text-sm text-indigo-200">
                              {{ user.email }}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          class="relative shrink-0 cursor-pointer rounded-md text-indigo-200 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                          @click="close"
                        >
                          <span class="absolute -inset-2.5" />
                          <span class="sr-only">{{ t('common.closePanel') }}</span>
                          <XMarkIcon class="size-6" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <div class="h-0 flex-1 overflow-y-auto">
                      <div class="space-y-8 px-4 py-6 sm:px-6">
                        <div
                          v-if="user.isOwner"
                          class="rounded-lg border border-purple-200 bg-purple-50 px-4 py-3 dark:border-purple-800 dark:bg-purple-900/20"
                        >
                          <p class="text-sm text-purple-900 dark:text-purple-200">
                            {{ t('settings.editUserOwnerNotice') }}
                          </p>
                        </div>

                        <section class="space-y-4">
                          <h4 class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            {{ t('settings.inviteSectionProfile') }}
                          </h4>

                          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div class="space-y-1">
                              <label for="edit-user-first-name" class="block text-sm/6 font-medium text-gray-900 dark:text-white">
                                {{ t('settings.inviteFirstName') }}
                              </label>
                              <input
                                id="edit-user-first-name"
                                v-model="form.firstName"
                                type="text"
                                :readonly="user.isOwner"
                                :class="inputClass(user.isOwner)"
                              />
                            </div>
                            <div class="space-y-1">
                              <label for="edit-user-last-name" class="block text-sm/6 font-medium text-gray-900 dark:text-white">
                                {{ t('settings.inviteLastName') }}
                              </label>
                              <input
                                id="edit-user-last-name"
                                v-model="form.lastName"
                                type="text"
                                :readonly="user.isOwner"
                                :class="inputClass(user.isOwner)"
                              />
                            </div>
                          </div>

                          <div class="space-y-1">
                            <label for="edit-user-email" class="block text-sm/6 font-medium text-gray-900 dark:text-white">
                              {{ t('settings.inviteEmail') }}
                            </label>
                            <input
                              id="edit-user-email"
                              :value="user.email"
                              type="email"
                              readonly
                              :class="inputClass(true)"
                            />
                            <p class="text-xs text-gray-500 dark:text-gray-400">
                              {{ t('settings.editUserEmailReadonlyHint') }}
                            </p>
                          </div>

                          <div class="space-y-1">
                            <label for="edit-user-phone" class="block text-sm/6 font-medium text-gray-900 dark:text-white">
                              {{ t('settings.editUserPhone') }}
                            </label>
                            <input
                              id="edit-user-phone"
                              v-model="form.phoneNumber"
                              type="tel"
                              :readonly="user.isOwner"
                              :placeholder="t('settings.editUserPhonePh')"
                              :class="inputClass(user.isOwner)"
                            />
                          </div>

                          <div class="space-y-1">
                            <span class="block text-sm/6 font-medium text-gray-900 dark:text-white">
                              {{ t('settings.inviteUserType') }}
                            </span>
                            <p class="text-sm text-gray-700 dark:text-gray-300">
                              {{ formatUserTypeLabel(user.userType) }}
                            </p>
                          </div>
                        </section>

                        <section class="space-y-4">
                          <h4 class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            {{ t('settings.inviteSectionAccess') }}
                          </h4>

                          <div v-if="!isExternalUser" class="space-y-1">
                            <label for="edit-user-role" class="block text-sm/6 font-medium text-gray-900 dark:text-white">
                              {{ t('settings.inviteRole') }}
                            </label>
                            <HeadlessSelect
                              v-if="!user.isOwner"
                              id="edit-user-role"
                              v-model="form.roleId"
                              :options="roleSelectOptions"
                              teleport
                              :invalid="Boolean(validationErrors.roleId)"
                            />
                            <p v-else class="text-sm font-medium text-gray-900 dark:text-white">
                              {{ displayRoleName }}
                            </p>
                            <p v-if="rbacV2Enabled && !user.isOwner" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              {{ t('settings.inviteRbacV2RoleHint') }}
                            </p>
                          </div>

                          <div v-else class="space-y-4">
                            <div class="rounded-lg border border-sky-200 bg-sky-50/60 px-4 py-3 dark:border-sky-800 dark:bg-sky-900/20">
                              <p class="text-sm text-sky-900 dark:text-sky-200">
                                {{ t('settings.editUserPortalRolesHint') }}
                              </p>
                              <p class="mt-2 text-xs text-sky-800/80 dark:text-sky-300/80">
                                {{ t('settings.editUserPortalManageOnPeople') }}
                              </p>
                              <RouterLink
                                v-if="peopleRecordLink"
                                :to="peopleRecordLink"
                                class="mt-3 inline-flex items-center text-sm font-medium text-sky-700 hover:text-sky-900 dark:text-sky-300 dark:hover:text-sky-100"
                              >
                                {{ t('settings.editUserPortalOpenPeople') }}
                              </RouterLink>
                            </div>

                            <div v-if="portalRolesLoading" class="text-sm text-gray-500 dark:text-gray-400">
                              {{ t('states.loading') }}
                            </div>

                            <template v-else>
                              <div v-if="defaultPortalName" class="space-y-1">
                                <span class="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                  {{ t('settings.editUserPortalDefaultRole') }}
                                </span>
                                <p class="text-sm text-gray-900 dark:text-white">{{ defaultPortalName }}</p>
                              </div>

                              <div>
                                <span class="block text-sm/6 font-medium text-gray-900 dark:text-white">
                                  {{ t('settings.editUserPortalRoles') }}
                                </span>
                                <ul v-if="assignedPortalRoles.length" class="mt-2 space-y-2">
                                  <li
                                    v-for="role in assignedPortalRoles"
                                    :key="String(role._id)"
                                    class="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700"
                                  >
                                    <div class="min-w-0">
                                      <p class="text-sm font-medium text-gray-900 dark:text-white">{{ role.name }}</p>
                                      <p v-if="role.description" class="text-xs text-gray-500 dark:text-gray-400 truncate">
                                        {{ role.description }}
                                      </p>
                                    </div>
                                    <button
                                      v-if="canManagePortalRoles"
                                      type="button"
                                      class="shrink-0 text-xs font-medium text-red-600 hover:text-red-500 disabled:opacity-50 dark:text-red-400"
                                      :disabled="portalActionLoading || assignedPortalRoles.length <= 1"
                                      @click="removePortalRole(role._id)"
                                    >
                                      {{ t('settings.editUserPortalRemoveRole') }}
                                    </button>
                                  </li>
                                </ul>
                                <p v-else class="mt-2 text-sm text-gray-500 dark:text-gray-400">
                                  {{ t('settings.editUserPortalRolesEmpty') }}
                                </p>
                              </div>

                              <div
                                v-if="!canManagePortalRoles"
                                class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100"
                              >
                                {{ t('settings.editUserPortalNoPeopleLink') }}
                              </div>

                              <button
                                v-else
                                type="button"
                                class="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                                :disabled="portalActionLoading || !unassignedPortalRoles.length"
                                @click="openPortalAssignModal"
                              >
                                {{ t('settings.editUserPortalAssignRoles') }}
                              </button>
                            </template>
                          </div>

                          <div
                            v-if="rbacV2Enabled && selectedRole && !isExternalUser"
                            class="rounded-lg border border-indigo-200 bg-indigo-50/60 p-4 space-y-3 dark:border-indigo-800 dark:bg-indigo-900/20"
                          >
                            <p class="text-xs font-semibold uppercase tracking-wider text-indigo-800 dark:text-indigo-200">
                              {{ t('settings.inviteRbacV2PreviewTitle') }}
                            </p>
                            <p v-if="selectedRole.description" class="text-sm text-gray-700 dark:text-gray-300">
                              {{ selectedRole.description }}
                            </p>
                            <p v-if="selectedRoleProfileName" class="text-xs text-gray-600 dark:text-gray-400">
                              {{ t('settings.inviteRbacV2Profile', { profile: selectedRoleProfileName }) }}
                            </p>
                            <div v-if="selectedRoleAppPreview.length" class="flex flex-wrap gap-2">
                              <span
                                v-for="chip in selectedRoleAppPreview"
                                :key="chip.appKey"
                                class="inline-flex items-center rounded-full border border-indigo-200 bg-white px-2.5 py-1 text-xs font-medium text-indigo-800 dark:border-indigo-700 dark:bg-gray-800 dark:text-indigo-200"
                              >
                                {{ chip.label }}
                              </span>
                            </div>
                            <p v-else class="text-xs text-gray-500 dark:text-gray-400">
                              {{ t('settings.inviteRbacV2NoApps') }}
                            </p>
                          </div>

                          <div class="space-y-1">
                            <label for="edit-user-status" class="block text-sm/6 font-medium text-gray-900 dark:text-white">
                              {{ t('settings.editUserStatus') }}
                            </label>
                            <HeadlessSelect
                              v-if="!user.isOwner"
                              id="edit-user-status"
                              v-model="form.status"
                              :options="statusSelectOptions"
                              teleport
                            />
                            <p v-else class="text-sm text-gray-700 dark:text-gray-300">
                              {{ formatStatusLabel(user.status) }}
                            </p>
                          </div>

                          <div v-if="!rbacV2Enabled && !isExternalUser" class="space-y-3">
                            <span class="block text-sm/6 font-medium text-gray-900 dark:text-white">
                              {{ t('settings.inviteAppAccess') }} <span class="text-red-500">*</span>
                            </span>

                            <div v-if="loadingCapabilities" class="text-sm text-gray-500 dark:text-gray-400">
                              {{ t('settings.inviteLoadingApps') }}
                            </div>
                            <div v-else-if="availableApps.length === 0" class="text-sm text-gray-500 dark:text-gray-400">
                              {{ t('settings.editUserNoAppsType') }}
                            </div>
                            <div v-else class="space-y-2">
                              <div
                                v-for="app in availableApps"
                                :key="app.appKey"
                                class="rounded-lg border transition-colors"
                                :class="[
                                  isAppSelected(app.appKey)
                                    ? 'border-indigo-200 bg-indigo-50/60 dark:border-indigo-800 dark:bg-indigo-900/20'
                                    : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800/50',
                                  !isAppEnabled(app) && 'opacity-60'
                                ]"
                              >
                                <div class="flex items-start gap-3 p-3">
                                  <HeadlessCheckbox
                                    :id="`edit-app-${app.appKey}`"
                                    :checked="isAppSelected(app.appKey)"
                                    :disabled="!isAppEnabled(app)"
                                    checkbox-class="mt-0.5"
                                    @change="toggleApp(app)"
                                  />
                                  <div class="min-w-0 flex-1 space-y-2">
                                    <label
                                      :for="`edit-app-${app.appKey}`"
                                      class="block cursor-pointer"
                                      :class="{ 'cursor-not-allowed': !isAppEnabled(app) }"
                                    >
                                      <span class="text-sm font-medium text-gray-900 dark:text-white">
                                        {{ getAppDisplayName(app.appKey) }}
                                      </span>
                                      <span
                                        v-if="app.seatInfo && app.seatInfo.limit !== null"
                                        class="mt-0.5 block text-xs text-gray-500 dark:text-gray-400"
                                      >
                                        {{ t('settings.inviteSeatsUsed', { used: app.seatInfo.used, limit: app.seatInfo.limit }) }}
                                        <span v-if="app.seatInfo.available === 0" class="font-medium text-red-600 dark:text-red-400">
                                          {{ t('settings.inviteNoSeats') }}
                                        </span>
                                        <span v-else-if="app.seatInfo.available !== null" class="text-green-600 dark:text-green-400">
                                          {{ t('settings.inviteSeatsAvailable', { count: app.seatInfo.available }) }}
                                        </span>
                                      </span>
                                    </label>

                                    <div v-if="isAppSelected(app.appKey)" class="space-y-1">
                                      <label :for="`edit-app-role-${app.appKey}`" class="block text-xs font-medium text-gray-700 dark:text-gray-300">
                                        {{ t('settings.inviteRoleForApp', { app: getAppDisplayName(app.appKey) }) }}
                                      </label>
                                      <HeadlessSelect
                                        :id="`edit-app-role-${app.appKey}`"
                                        :model-value="selectedAppRoles[app.appKey]"
                                        :options="getAppRoleOptions(app)"
                                        teleport
                                        @update:model-value="updateAppRole(app.appKey, $event)"
                                      />
                                    </div>

                                    <p
                                      v-if="!isAppEnabled(app) && app.seatInfo && !app.seatInfo.canAdd"
                                      class="text-xs text-red-600 dark:text-red-400"
                                    >
                                      {{ app.seatInfo.reason }}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <p v-if="validationErrors.appAccess" class="text-xs text-red-600 dark:text-red-400">
                              {{ validationErrors.appAccess }}
                            </p>
                          </div>
                        </section>

                        <section class="space-y-4">
                          <h4 class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            {{ t('settings.editUserSectionAccount') }}
                          </h4>
                          <dl class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                              <dt class="text-xs font-medium text-gray-500 dark:text-gray-400">
                                {{ t('settings.usersColJoined') }}
                              </dt>
                              <dd class="mt-1 text-sm text-gray-900 dark:text-white">
                                {{ formatAbsoluteDate(user.createdAt) }}
                              </dd>
                            </div>
                            <div>
                              <dt class="text-xs font-medium text-gray-500 dark:text-gray-400">
                                {{ t('settings.usersColLastLogin') }}
                              </dt>
                              <dd class="mt-1 text-sm text-gray-900 dark:text-white">
                                {{ formatAbsoluteDate(user.lastLogin) }}
                              </dd>
                            </div>
                            <div>
                              <dt class="text-xs font-medium text-gray-500 dark:text-gray-400">
                                {{ t('settings.inviteEmail') }}
                              </dt>
                              <dd class="mt-1">
                                <span
                                  :class="user.emailVerifiedAt
                                    ? 'inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                    : 'inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'"
                                >
                                  {{ user.emailVerifiedAt ? t('settings.editUserEmailVerifiedYes') : t('settings.editUserEmailVerifiedNo') }}
                                </span>
                              </dd>
                            </div>
                          </dl>
                        </section>

                        <div
                          v-if="!user.isOwner && form.status !== 'active'"
                          class="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 dark:border-yellow-800 dark:bg-yellow-900/20"
                        >
                          <div class="flex gap-3">
                            <ExclamationTriangleIcon class="mt-0.5 h-5 w-5 shrink-0 text-yellow-600 dark:text-yellow-500" aria-hidden="true" />
                            <div>
                              <p class="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                                {{ form.status === 'inactive' ? t('settings.editUserDeactivating') : t('settings.editUserSuspending') }}
                              </p>
                              <p class="mt-1 text-sm text-yellow-700 dark:text-yellow-400">
                                {{ t('settings.editUserStatusWarning') }}
                              </p>
                            </div>
                          </div>
                        </div>

                        <section
                          v-if="canResendInvite"
                          class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/20"
                        >
                          <div class="flex items-center justify-between gap-4">
                            <div class="min-w-0">
                              <p class="text-sm font-medium text-amber-900 dark:text-amber-300">
                                {{ t('settings.editUserResendInvite') }}
                              </p>
                              <p class="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
                                {{ t('settings.editUserResendInviteHint') }}
                              </p>
                            </div>
                            <button
                              type="button"
                              class="shrink-0 rounded-lg bg-amber-100 px-4 py-2 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-amber-900/50 dark:text-amber-300 dark:hover:bg-amber-900/70"
                              :disabled="resendingInvite"
                              @click="resendInvite"
                            >
                              {{ resendingInvite ? t('settings.editUserResendingInvite') : t('settings.editUserResendInviteAction') }}
                            </button>
                          </div>
                        </section>

                        <section
                          v-if="!canResendInvite"
                          class="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-800 dark:bg-blue-900/20"
                        >
                          <div class="flex items-center justify-between gap-4">
                            <div class="min-w-0">
                              <p class="text-sm font-medium text-blue-900 dark:text-blue-300">
                                {{ t('settings.editUserResetPassword') }}
                              </p>
                              <p class="mt-0.5 text-xs text-blue-700 dark:text-blue-400">
                                {{ t('settings.editUserResetPasswordHint') }}
                              </p>
                            </div>
                            <button
                              type="button"
                              class="shrink-0 rounded-lg bg-blue-100 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:hover:bg-blue-900/70"
                              @click="resetPassword"
                            >
                              {{ t('settings.editUserReset') }}
                            </button>
                          </div>
                        </section>

                        <div v-if="error" class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-900/20">
                          <p class="text-sm text-red-800 dark:text-red-300">{{ error }}</p>
                        </div>
                      </div>
                    </div>

                    <div class="flex shrink-0 items-center justify-between gap-3 border-t border-gray-200 bg-white px-4 py-4 dark:border-gray-700 dark:bg-gray-800">
                      <div v-if="!user.isOwner" class="flex flex-wrap items-center gap-2">
                        <button
                          v-if="isActivatable"
                          type="button"
                          class="rounded-md px-3 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                          :disabled="reactivating"
                          @click="reactivateUser"
                        >
                          {{ reactivating ? t('states.saving') : t('settings.editUserReactivate') }}
                        </button>
                        <button
                          v-if="isDeactivatable"
                          type="button"
                          class="rounded-md px-3 py-2 text-sm font-semibold text-amber-700 transition-colors hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20"
                          @click="startLifecycle('deactivate')"
                        >
                          {{ t('settings.editUserDeactivate') }}
                        </button>
                        <template v-else-if="user.status === 'inactive'">
                          <button
                            v-if="openRecordCount > 0"
                            type="button"
                            class="rounded-md px-3 py-2 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/20"
                            @click="startLifecycle('transfer')"
                          >
                            {{ t('settings.editUserTransferRecords') }}
                            <span class="ml-1 text-xs opacity-80">({{ openRecordCount }})</span>
                          </button>
                          <button
                            type="button"
                            class="rounded-md px-3 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                            @click="startLifecycle('delete')"
                          >
                            {{ t('settings.editUserDeleteAccount') }}
                          </button>
                        </template>
                      </div>
                      <div v-else />

                      <div class="flex items-center gap-3">
                        <button
                          type="button"
                          class="cursor-pointer rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:ring-gray-600 dark:hover:bg-gray-700"
                          @click="close"
                        >
                          {{ t('actions.cancel') }}
                        </button>
                        <button
                          v-if="!user.isOwner || !rbacV2Enabled"
                          type="submit"
                          :disabled="saving"
                          class="inline-flex cursor-pointer items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                        >
                          <svg v-if="saving" class="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>{{ saving ? t('settings.editUserSaving') : t('settings.editUserSave') }}</span>
                        </button>
                      </div>
                    </div>
                  </form>
                </DialogPanel>
              </div>
            </TransitionChild>
          </div>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>

  <Teleport to="body">
    <div
      v-if="showPortalAssignModal"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      @click.self="showPortalAssignModal = false"
    >
      <div class="w-full max-w-md rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
        <div class="border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ t('settings.editUserPortalAssignRoles') }}
          </h3>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {{ t('settings.editUserPortalSelectRolesHint') }}
          </p>
        </div>
        <div class="max-h-72 space-y-2 overflow-y-auto px-5 py-4">
          <label
            v-for="role in unassignedPortalRoles"
            :key="String(role._id)"
            class="flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 px-3 py-2 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900/40"
          >
            <HeadlessCheckbox
              :checked="selectedPortalRoleIds.includes(String(role._id))"
              checkbox-class="mt-0.5"
              @change="togglePortalRoleSelection(role._id)"
            />
            <span class="min-w-0">
              <span class="block text-sm font-medium text-gray-900 dark:text-white">{{ role.name }}</span>
              <span v-if="role.description" class="block text-xs text-gray-500 dark:text-gray-400">{{ role.description }}</span>
            </span>
          </label>
          <p v-if="!unassignedPortalRoles.length" class="text-sm text-gray-500 dark:text-gray-400">
            {{ t('settings.editUserPortalNoAvailableRoles') }}
          </p>
        </div>
        <div class="flex justify-end gap-3 border-t border-gray-200 px-5 py-4 dark:border-gray-700">
          <button
            type="button"
            class="rounded-md px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700"
            @click="showPortalAssignModal = false"
          >
            {{ t('actions.cancel') }}
          </button>
          <button
            type="button"
            class="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 dark:bg-indigo-500"
            :disabled="portalActionLoading || !selectedPortalRoleIds.length"
            @click="confirmAssignPortalRoles"
          >
            {{ t('actions.save') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import { ref, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink } from 'vue-router';
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue';
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import { useAuthStore } from '@/stores/authRegistry';
import { useAppShellStore } from '@/stores/appShell';
import { invalidateTenantSchemaCaches } from '@/utils/tenantSchemaApiCache';
import { useNotifications } from '@/composables/useNotifications';
import { isRbacV2Enabled } from '@/utils/rbacFeatureFlags';

const { t } = useI18n();
const { success: notifySuccess, error: notifyError } = useNotifications();

const authStore = useAuthStore();
const appShellStore = useAppShellStore();
const rbacV2Enabled = computed(() => isRbacV2Enabled(authStore.organization));

const props = defineProps({
  isOpen: Boolean,
  user: Object
});

const emit = defineEmits(['close', 'user-updated', 'user-deleted', 'start-lifecycle', 'portal-roles-updated']);

const openRecordCount = ref(0);
const reactivating = ref(false);

const isDeactivatable = computed(() => {
  const status = props.user?.status || 'active';
  return ['active', 'invited', 'suspended'].includes(status);
});

const isActivatable = computed(() => props.user?.status === 'inactive');

async function loadOwnershipHint() {
  openRecordCount.value = 0;
  if (!props.user?._id || props.user.status !== 'inactive') return;
  try {
    const res = await apiClient.get(`/users/${props.user._id}/ownership-summary`);
    openRecordCount.value = Number(res?.data?.openTotal || 0);
  } catch {
    openRecordCount.value = 0;
  }
}

const form = ref({
  firstName: '',
  lastName: '',
  phoneNumber: '',
  roleId: '',
  status: 'active'
});

const saving = ref(false);
const error = ref('');
const resendingInvite = ref(false);
const availableRoles = ref([]);
const capabilities = ref([]);
const loadingCapabilities = ref(false);
const selectedAppRoles = ref({});
const validationErrors = ref({});
const portalRolesLoading = ref(false);
const portalActionLoading = ref(false);
const portalState = ref(null);
const showPortalAssignModal = ref(false);
const selectedPortalRoleIds = ref([]);

const isExternalUser = computed(() =>
  String(props.user?.userType || '').toUpperCase() === 'EXTERNAL'
);

const peopleId = computed(() => {
  const raw = props.user?.peopleId;
  if (!raw) return '';
  if (typeof raw === 'object') return String(raw._id || raw.id || '');
  return String(raw);
});

const canManagePortalRoles = computed(() =>
  Boolean(peopleId.value) && (
    authStore.isAdminLike || authStore.can('settings', 'manageUsers')
  )
);

const canResendInvite = computed(() => {
  if (!props.user || props.user.isOwner) return false;
  return ['invited', 'inactive'].includes(props.user.status);
});

const peopleRecordLink = computed(() =>
  peopleId.value ? { name: 'person-detail', params: { id: peopleId.value } } : null
);

const assignedPortalRoles = computed(() => {
  if (portalState.value?.roles?.length) {
    return portalState.value.roles;
  }
  return Array.isArray(props.user?.externalRoles) ? props.user.externalRoles : [];
});

const availablePortalRoles = computed(() =>
  portalState.value?.availableExternalRoles || []
);

const unassignedPortalRoles = computed(() => {
  const assignedIds = new Set(assignedPortalRoles.value.map((role) => String(role._id)));
  return availablePortalRoles.value.filter((role) => {
    const roleId = String(role.roleId || role._id);
    return !assignedIds.has(roleId);
  });
});

const defaultPortalName = computed(() => {
  const defaultId = portalState.value?.user?.defaultExternalRoleId || props.user?.defaultExternalRoleId;
  if (!defaultId) return '';
  const match = assignedPortalRoles.value.find((role) => String(role._id) === String(defaultId));
  return match?.name || '';
});

const appDisplayNames = {
  SALES: 'SALES',
  CRM: 'CRM',
  AUDIT: 'Audit',
  PORTAL: 'Portal',
  HELPDESK: 'Helpdesk',
  PROJECTS: 'Projects',
  LMS: 'LMS',
  INVENTORY: 'Inventory'
};

const roleDisplayNames = {
  SALES: {
    ADMIN: 'Admin',
    MANAGER: 'Manager',
    USER: 'User'
  },
  HELPDESK: {
    ADMIN: 'Admin',
    MANAGER: 'Manager',
    USER: 'User'
  },
  CRM: {
    ADMIN: 'Admin',
    MANAGER: 'Manager',
    USER: 'User'
  },
  AUDIT: {
    AUDITOR: 'Auditor'
  },
  PORTAL: {
    CUSTOMER: 'Customer',
    VIEWER: 'Viewer'
  }
};

const roleSelectOptions = computed(() => [
  { value: '', label: t('settings.inviteSelectRole') },
  ...availableRoles.value.map((role) => ({
    value: role._id,
    label: rbacV2Enabled.value ? role.name : `${role.name} — ${role.description}`
  }))
]);

const selectedRole = computed(() => {
  const roleId = props.user?.isOwner
    ? resolveRoleIdFromUser(props.user)
    : form.value.roleId;
  return availableRoles.value.find((role) => String(role._id) === String(roleId)) || null;
});

const selectedRoleAppPreview = computed(() => {
  const role = selectedRole.value;
  if (!role || !Array.isArray(role.appEntitlements)) return [];
  return role.appEntitlements
    .filter((entry) => entry.enabled !== false)
    .map((entry) => ({
      appKey: entry.appKey,
      label: `${getAppDisplayName(entry.appKey)} · ${getRoleDisplayName(entry.appKey, entry.appRoleKey)}`
    }));
});

const selectedRoleProfileName = computed(() => {
  const role = selectedRole.value;
  if (!role || role.privilegeMode !== 'profile') return '';
  const profile = role.profileId;
  if (profile && typeof profile === 'object') return profile.name;
  return '';
});

const statusSelectOptions = computed(() => [
  { value: 'active', label: t('settings.editUserStatusActive') },
  { value: 'inactive', label: t('settings.editUserStatusInactive') },
  { value: 'suspended', label: t('settings.editUserStatusSuspended') },
  { value: 'invited', label: t('settings.usersStatusInvited') }
]);

const availableApps = computed(() => {
  const userType = props.user?.userType || 'INTERNAL';
  return capabilities.value.filter((app) => app.userTypesAllowed?.includes(userType));
});

const selectedApps = computed(() => Object.keys(selectedAppRoles.value));

const displayRoleName = computed(() => {
  const roleDoc = props.user?.roleId;
  if (roleDoc && typeof roleDoc === 'object' && roleDoc.name) {
    return roleDoc.name;
  }
  const match = availableRoles.value.find((role) => String(role._id) === String(form.value.roleId));
  if (match?.name) return match.name;
  if (props.user?.role) {
    return props.user.role.charAt(0).toUpperCase() + props.user.role.slice(1);
  }
  return '—';
});

const inputClass = (readOnly) => [
  'block w-full rounded-md px-3 py-2 text-base outline-1 -outline-offset-1 sm:text-sm/6',
  readOnly
    ? 'cursor-default bg-gray-50 text-gray-700 outline-gray-200 dark:bg-gray-900/40 dark:text-gray-300 dark:outline-white/10'
    : 'bg-gray-100 text-gray-900 outline-gray-300/20 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 dark:bg-gray-700 dark:text-white dark:focus:bg-gray-800 dark:outline-white/10 dark:focus:outline-indigo-500'
];

const formatUserTypeLabel = (userType) => {
  if (userType === 'EXTERNAL') return t('settings.inviteExternal');
  if (userType === 'INTERNAL') return t('settings.inviteInternal');
  return userType || t('settings.inviteInternal');
};

const formatStatusLabel = (status) => {
  const normalized = status || 'active';
  const labels = {
    active: t('settings.editUserStatusActive'),
    inactive: t('settings.editUserStatusInactive'),
    suspended: t('settings.editUserStatusSuspended'),
    invited: t('settings.usersStatusInvited')
  };
  return labels[normalized] || normalized;
};

const formatAbsoluteDate = (date) => {
  if (!date) return t('settings.usersLastLoginNever');
  return new Date(date).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const userDisplayName = (user) => `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email || '';

const userInitials = (user) => {
  const first = user?.firstName?.[0] || '';
  const last = user?.lastName?.[0] || '';
  if (first || last) return `${first}${last}`.toUpperCase();
  return (user?.email?.[0] || 'U').toUpperCase();
};

const resolveRoleIdFromUser = (candidateUser) => {
  if (!candidateUser) return '';
  if (String(candidateUser.userType || '').toUpperCase() === 'EXTERNAL') return '';

  const rawRoleId = candidateUser.roleId;

  if (rawRoleId && typeof rawRoleId === 'object') {
    if (rawRoleId._id) return String(rawRoleId._id);
    if (rawRoleId.id) return String(rawRoleId.id);
  }

  if (typeof rawRoleId === 'string' && rawRoleId.trim()) {
    return rawRoleId.trim();
  }

  const legacyRoleName = String(candidateUser.role || '').trim().toLowerCase();
  if (!legacyRoleName) return '';

  const match = availableRoles.value.find(
    (role) => String(role.name || '').trim().toLowerCase() === legacyRoleName
  );
  return match?._id ? String(match._id) : '';
};

const fetchRoles = async () => {
  try {
    const response = await apiClient.get('/roles');
    if (response.success) {
      availableRoles.value = (response.data || []).filter(
        (role) => String(role.userType || 'INTERNAL').toUpperCase() !== 'EXTERNAL'
      );
    }
  } catch (err) {
    console.error('Error fetching roles:', err);
  }
};

const loadExternalPortalState = async () => {
  if (!isExternalUser.value || !peopleId.value) {
    portalState.value = null;
    return;
  }

  portalRolesLoading.value = true;
  try {
    const response = await apiClient.get(`/people/${peopleId.value}/portal`);
    portalState.value = response?.data ?? response;
  } catch (err) {
    const code = err?.response?.data?.code;
    if (code !== 'PORTAL_FRAMEWORK_DISABLED') {
      console.error('Error loading portal state:', err);
    }
    portalState.value = null;
  } finally {
    portalRolesLoading.value = false;
  }
};

const openPortalAssignModal = () => {
  selectedPortalRoleIds.value = [];
  showPortalAssignModal.value = true;
};

const togglePortalRoleSelection = (roleId) => {
  const id = String(roleId);
  const next = new Set(selectedPortalRoleIds.value.map(String));
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  selectedPortalRoleIds.value = [...next];
};

const confirmAssignPortalRoles = async () => {
  if (!peopleId.value || !selectedPortalRoleIds.value.length) return;

  portalActionLoading.value = true;
  error.value = '';
  try {
    await apiClient.post(`/people/${peopleId.value}/portal/roles`, {
      roleIds: selectedPortalRoleIds.value
    });
    notifySuccess(t('settings.editUserPortalRolesAssigned'));
    showPortalAssignModal.value = false;
    await loadExternalPortalState();
    emit('portal-roles-updated');
  } catch (err) {
    console.error('Error assigning portal roles:', err);
    error.value = err.message || t('settings.editUserUpdateFailed');
  } finally {
    portalActionLoading.value = false;
  }
};

const removePortalRole = async (roleId) => {
  if (!peopleId.value) return;
  if (!confirm(t('settings.editUserPortalRemoveConfirm'))) return;

  portalActionLoading.value = true;
  error.value = '';
  try {
    await apiClient.delete(`/people/${peopleId.value}/portal/roles/${roleId}`);
    notifySuccess(t('settings.editUserPortalRoleRemoved'));
    await loadExternalPortalState();
    emit('portal-roles-updated');
  } catch (err) {
    console.error('Error removing portal role:', err);
    error.value = err.message || t('settings.editUserUpdateFailed');
  } finally {
    portalActionLoading.value = false;
  }
};

const fetchCapabilities = async () => {
  loadingCapabilities.value = true;
  try {
    const response = await apiClient.get('/users/add-capabilities');
    if (response.success) {
      capabilities.value = response.data.apps || [];
    }
  } catch (err) {
    console.error('Error fetching capabilities:', err);
    error.value = t('settings.editUserLoadAppsFailed');
  } finally {
    loadingCapabilities.value = false;
  }
};

const initSelectedAppRoles = () => {
  const next = {};
  const entries = props.user?.appAccess || [];
  entries.forEach((entry) => {
    if (entry?.status === 'ACTIVE' && entry?.appKey && entry?.roleKey) {
      next[entry.appKey] = entry.roleKey;
    }
  });
  selectedAppRoles.value = next;
};

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    error.value = '';
    validationErrors.value = {};
    showPortalAssignModal.value = false;
    fetchRoles();
    if (!rbacV2Enabled.value) {
      fetchCapabilities();
    }
    if (props.user) {
      form.value = {
        firstName: props.user.firstName || '',
        lastName: props.user.lastName || '',
        phoneNumber: props.user.phoneNumber || '',
        roleId: resolveRoleIdFromUser(props.user),
        status: props.user.status || 'active'
      };
      initSelectedAppRoles();
    }
    if (isExternalUser.value) {
      void loadExternalPortalState();
    } else {
      portalState.value = null;
    }
    void loadOwnershipHint();
  }
});

watch(() => props.user, (newUser) => {
  if (newUser && props.isOpen) {
    form.value = {
      firstName: newUser.firstName || '',
      lastName: newUser.lastName || '',
      phoneNumber: newUser.phoneNumber || '',
      roleId: resolveRoleIdFromUser(newUser),
      status: newUser.status || 'active'
    };
    initSelectedAppRoles();
  }
});

watch(availableRoles, (roles) => {
  if (!props.isOpen || !props.user || isExternalUser.value || !Array.isArray(roles) || roles.length === 0) return;
  if (form.value.roleId) return;

  const resolvedRoleId = resolveRoleIdFromUser(props.user);
  if (resolvedRoleId) {
    form.value.roleId = resolvedRoleId;
  }
});

const isAppSelected = (appKey) => appKey in selectedAppRoles.value;

const isAppEnabled = (app) => {
  if (!app.seatInfo) return true;
  if (isAppSelected(app.appKey)) return true;
  return app.seatInfo.canAdd;
};

const toggleApp = (app) => {
  const appKey = app.appKey;
  if (isAppSelected(appKey)) {
    delete selectedAppRoles.value[appKey];
  } else {
    const defaultRole = app.defaultRole || app.roles?.[0];
    if (defaultRole) {
      selectedAppRoles.value[appKey] = defaultRole;
    }
  }
  validationErrors.value.appAccess = null;
};

const updateAppRole = (appKey, roleKey) => {
  selectedAppRoles.value[appKey] = roleKey;
};

const getAppRoleOptions = (app) =>
  (app.roles || []).map((roleKey) => ({
    value: roleKey,
    label: getRoleDisplayName(app.appKey, roleKey)
  }));

const getAppDisplayName = (appKey) => appDisplayNames[appKey] || appKey;
const getRoleDisplayName = (appKey, roleKey) => roleDisplayNames[appKey]?.[roleKey] || roleKey;

const validateForm = () => {
  validationErrors.value = {};
  if (rbacV2Enabled.value) {
    return true;
  }
  if (selectedApps.value.length === 0) {
    validationErrors.value.appAccess = t('settings.editUserAppAccessRemain');
    return false;
  }
  for (const appKey of selectedApps.value) {
    const app = availableApps.value.find((a) => a.appKey === appKey);
    if (app && !isAppEnabled(app)) {
      validationErrors.value.appAccess = app.seatInfo?.reason || t('settings.editUserUpdateFailed');
      return false;
    }
  }
  return true;
};

const close = () => {
  if (!saving.value) {
    emit('close');
  }
};

const handleSubmit = async () => {
  saving.value = true;
  error.value = '';
  validationErrors.value = {};

  if (!validateForm()) {
    saving.value = false;
    return;
  }

  try {
    let payload;
    if (rbacV2Enabled.value) {
      payload = {
        firstName: form.value.firstName,
        lastName: form.value.lastName,
        phoneNumber: form.value.phoneNumber,
        status: form.value.status
      };
      if (!isExternalUser.value) {
        payload.roleId = form.value.roleId;
      }
    } else {
      const appAccessPayload = selectedApps.value.map((appKey) => ({
        appKey,
        roleKey: selectedAppRoles.value[appKey]
      }));
      payload = props.user?.isOwner
        ? { appAccess: appAccessPayload }
        : {
            firstName: form.value.firstName,
            lastName: form.value.lastName,
            phoneNumber: form.value.phoneNumber,
            status: form.value.status,
            ...(isExternalUser.value ? {} : { roleId: form.value.roleId }),
            appAccess: appAccessPayload
          };
    }
    const response = await apiClient.put(`/users/${props.user._id}`, payload);

    if (response.success) {
      const editingSelf =
        authStore.user?._id && String(authStore.user._id) === String(props.user?._id);
      if (editingSelf) {
        try {
          appShellStore.invalidateAppRegistryCache();
          invalidateTenantSchemaCaches();
          await authStore.refreshUser({ force: true });
        } catch (refreshErr) {
          console.warn('[EditUserModal] Self-edit refresh failed:', refreshErr);
        }
      }

      notifySuccess(t('settings.editUserUpdatedSuccess'));
      emit('user-updated');
    } else {
      error.value = response.message || t('settings.editUserUpdateFailed');
    }
  } catch (err) {
    console.error('Error updating user:', err);
    error.value = err.message || t('settings.editUserUpdateFailed');
  } finally {
    saving.value = false;
  }
};

const resetPassword = async () => {
  if (!confirm(t('settings.editUserResetConfirm'))) return;

  try {
    const response = await apiClient.post(`/users/${props.user._id}/reset-password`);

    if (response.success) {
      notifySuccess(t('settings.editUserResetSuccess'));
    } else {
      notifyError(t('settings.editUserResetFailed'));
    }
  } catch (err) {
    console.error('Error resetting password:', err);
    notifyError(t('settings.editUserResetFailed'));
  }
};

const resendInvite = async () => {
  if (!confirm(t('settings.editUserResendInviteConfirm'))) return;

  resendingInvite.value = true;
  try {
    const response = await apiClient.post(`/users/${props.user._id}/resend-invite`);

    if (response.success) {
      if (response.data?.emailSent) {
        notifySuccess(t('settings.editUserResendInviteSuccess'));
      } else {
        notifyError(response.data?.emailError || t('settings.editUserResendInviteEmailFailed'));
      }
      emit('user-updated');
    } else {
      notifyError(response.message || t('settings.editUserResendInviteFailed'));
    }
  } catch (err) {
    console.error('Error resending invite:', err);
    notifyError(err.message || t('settings.editUserResendInviteFailed'));
  } finally {
    resendingInvite.value = false;
  }
};

const startLifecycle = (mode) => {
  emit('start-lifecycle', { mode, user: props.user });
};

const reactivateUser = async () => {
  if (!props.user?._id || reactivating.value) return;
  reactivating.value = true;
  try {
    const response = await apiClient.put(`/users/${props.user._id}`, { status: 'active' });
    if (response.success) {
      notifySuccess(t('settings.editUserReactivateSuccess'));
      emit('user-updated');
    } else {
      notifyError(t('settings.editUserReactivateFailed'));
    }
  } catch (err) {
    console.error('Error reactivating user:', err);
    notifyError(t('settings.editUserReactivateFailed'));
  } finally {
    reactivating.value = false;
  }
};
</script>
