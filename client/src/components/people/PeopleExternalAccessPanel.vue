<script setup>
import { computed, toRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { resolvePeoplePortalAccess } from '@/composables/usePeoplePortalAccess';

const props = defineProps({
  peopleId: { type: String, required: true },
  display: {
    type: String,
    default: 'full',
    validator: (v) => v === 'full' || v === 'compact'
  },
  embedded: { type: Boolean, default: false }
});

const emit = defineEmits(['manage']);

const { t } = useI18n();
const access = resolvePeoplePortalAccess(toRef(() => props.peopleId));

const portalAccess = computed(() => access.value);

const isCompact = computed(() => props.display === 'compact');
const sectionClass = computed(() => {
  if (props.embedded) return 'space-y-4';
  if (isCompact.value) return '';
  return 'record-state-section mb-8 mt-4 rounded-lg border border-gray-200/80 dark:border-gray-700/80 bg-gray-50/60 dark:bg-gray-800/40';
});
</script>

<template>
  <template v-if="portalAccess?.visible">
    <!-- Compact summary row -->
    <div
      v-if="isCompact"
      class="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5 dark:border-gray-700 dark:bg-gray-900"
    >
      <div class="min-w-0">
        <p class="text-xs font-medium text-gray-500 dark:text-gray-400">
          {{ t('people.externalAccessTitle') }}
        </p>
        <p class="mt-0.5 truncate text-sm text-gray-900 dark:text-white">
          {{ portalAccess.compactSummary }}
        </p>
      </div>
      <button
        type="button"
        class="shrink-0 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
        @click="emit('manage')"
      >
        {{ t('people.accessManage') }}
      </button>
    </div>

    <!-- Full panel -->
    <section
      v-else
      :class="sectionClass"
      aria-labelledby="external-access-heading"
    >
      <div
        v-if="!embedded"
        class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200/80 px-4 py-3 dark:border-gray-700/80"
      >
        <div>
          <p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {{ t('people.externalAccessBadge') }}
          </p>
          <h3 id="external-access-heading" class="text-base font-semibold text-gray-900 dark:text-white">
            {{ t('people.externalAccessTitle') }}
          </h3>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {{ t('people.externalAccessSubtitle') }}
          </p>
        </div>
        <div v-if="portalAccess.portalEnabled" class="inline-flex items-center gap-2">
          <span
            class="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-200"
          >
            {{ t('people.externalAccessEnabled') }}
          </span>
        </div>
      </div>

      <div :class="embedded ? 'space-y-4' : 'space-y-4 px-4 py-4'">
        <div
          v-if="portalAccess.error"
          class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200"
        >
          {{ portalAccess.error }}
        </div>
        <div
          v-if="portalAccess.notice"
          class="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200"
        >
          {{ portalAccess.notice }}
        </div>

        <div v-if="portalAccess.loading" class="text-sm text-gray-500 dark:text-gray-400">
          {{ t('people.externalAccessLoading') }}
        </div>

        <template v-else-if="portalAccess.state">
          <div
            v-if="portalAccess.eligibility && !portalAccess.eligibility.eligible"
            class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100"
          >
            {{ t('people.externalAccessIneligible') }}
            <span
              v-if="portalAccess.eligibility.reason"
              class="mt-1 block text-xs opacity-80"
            >{{ portalAccess.eligibility.reason }}</span>
          </div>

          <div
            v-if="portalAccess.usage"
            class="rounded-lg border border-gray-200/80 bg-white/60 px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-200"
          >
            {{ t('people.externalAccessUsageActive', { count: portalAccess.activeExternalUsers }) }}
          </div>

          <div v-if="!portalAccess.portalEnabled" class="flex flex-wrap items-center justify-between gap-3">
            <p class="text-sm text-gray-600 dark:text-gray-300">
              {{ t('people.externalAccessDisabledHint') }}
            </p>
            <button
              type="button"
              class="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
              :disabled="portalAccess.actionLoading || (portalAccess.eligibility && !portalAccess.eligibility.eligible)"
              @click="portalAccess.openEnableModal()"
            >
              {{ t('people.externalAccessEnable') }}
            </button>
          </div>

          <template v-else>
            <dl class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <dt class="text-xs text-gray-500 dark:text-gray-400">{{ t('people.externalAccessUserId') }}</dt>
                <dd class="mt-1 break-all font-mono text-sm text-gray-900 dark:text-white">
                  {{ portalAccess.portalUser?._id || '—' }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-gray-500 dark:text-gray-400">{{ t('people.externalAccessUserStatus') }}</dt>
                <dd class="mt-1">
                  <span
                    class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                    :class="portalAccess.statusBadgeClass(portalAccess.portalUser?.status)"
                  >
                    {{ portalAccess.portalUser?.status || '—' }}
                  </span>
                </dd>
              </div>
              <div>
                <dt class="text-xs text-gray-500 dark:text-gray-400">{{ t('people.externalAccessLastLogin') }}</dt>
                <dd class="mt-1 text-sm text-gray-900 dark:text-white">
                  {{ portalAccess.formatDate(portalAccess.portalUser?.lastLogin) }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-gray-500 dark:text-gray-400">{{ t('people.externalAccessDefaultPortal') }}</dt>
                <dd class="mt-1 text-sm text-gray-900 dark:text-white">
                  {{ portalAccess.defaultPortalName || '—' }}
                </dd>
              </div>
            </dl>

            <div>
              <h4 class="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
                {{ t('people.externalAccessAssignedRoles') }}
              </h4>
              <ul v-if="portalAccess.assignedRoles.length" class="space-y-2">
                <li
                  v-for="role in portalAccess.assignedRoles"
                  :key="String(role._id)"
                  class="flex items-center justify-between gap-3 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700"
                >
                  <span class="text-sm text-gray-900 dark:text-white">{{ role.name }}</span>
                  <button
                    type="button"
                    class="text-xs font-medium text-red-600 hover:text-red-500 dark:text-red-400"
                    :disabled="portalAccess.actionLoading || portalAccess.assignedRoles.length <= 1"
                    @click="portalAccess.removeRole(role._id)"
                  >
                    {{ t('people.externalAccessRemoveRole') }}
                  </button>
                </li>
              </ul>
              <p v-else class="text-sm text-gray-500 dark:text-gray-400">
                {{ t('people.externalAccessNoRoles') }}
              </p>
            </div>

            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 disabled:opacity-60"
                :disabled="portalAccess.actionLoading || !portalAccess.unassignedRoles.length"
                @click="portalAccess.openAssignModal()"
              >
                {{ t('people.externalAccessAssignRoles') }}
              </button>
              <button
                type="button"
                class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 disabled:opacity-60"
                :disabled="portalAccess.actionLoading"
                @click="portalAccess.resendInvite()"
              >
                {{ t('people.externalAccessResendInvite') }}
              </button>
              <button
                type="button"
                class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 disabled:opacity-60"
                :disabled="portalAccess.actionLoading"
                @click="portalAccess.resetPassword()"
              >
                {{ t('people.externalAccessResetPassword') }}
              </button>
              <button
                type="button"
                class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 disabled:opacity-60"
                :disabled="portalAccess.actionLoading"
                @click="portalAccess.terminateSessions()"
              >
                {{ t('people.externalAccessTerminateSessions') }}
              </button>
              <button
                type="button"
                class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 disabled:opacity-60"
                :disabled="portalAccess.actionLoading"
                @click="portalAccess.toggleAuditHistory()"
              >
                {{ portalAccess.showAuditHistory ? t('people.externalAccessHideHistory') : t('people.externalAccessViewHistory') }}
              </button>
              <button
                type="button"
                class="rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:bg-gray-900 dark:text-red-300 dark:hover:bg-red-900/20 disabled:opacity-60"
                :disabled="portalAccess.actionLoading"
                @click="portalAccess.disablePortal()"
              >
                {{ t('people.externalAccessDisable') }}
              </button>
            </div>

            <div
              v-if="portalAccess.showAuditHistory"
              class="border-t border-gray-200 pt-3 dark:border-gray-700"
            >
              <h4 class="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
                {{ t('people.externalAccessLoginHistory') }}
              </h4>
              <p v-if="portalAccess.auditLoading" class="text-sm text-gray-500 dark:text-gray-400">
                {{ t('people.externalAccessLoading') }}
              </p>
              <ul v-else-if="portalAccess.auditEvents.length" class="max-h-56 space-y-2 overflow-y-auto">
                <li
                  v-for="event in portalAccess.auditEvents"
                  :key="String(event._id)"
                  class="rounded-md border border-gray-200 px-3 py-2 text-sm dark:border-gray-700"
                >
                  <div class="flex items-center justify-between gap-2">
                    <span class="font-medium text-gray-900 dark:text-white">{{ event.type }}</span>
                    <span class="text-xs text-gray-500 dark:text-gray-400">
                      {{ portalAccess.formatDate(event.timestamp) }}
                    </span>
                  </div>
                  <p v-if="event.description" class="mt-1 text-xs text-gray-600 dark:text-gray-300">
                    {{ event.description }}
                  </p>
                </li>
              </ul>
              <p v-else class="text-sm text-gray-500 dark:text-gray-400">
                {{ t('people.externalAccessNoHistory') }}
              </p>
            </div>
          </template>
        </template>
      </div>

      <Teleport to="body">
        <div
          v-if="portalAccess.showEnableModal || portalAccess.showAssignModal"
          class="fixed inset-0 z-[9100] flex items-center justify-center bg-black/50 p-4"
          @click.self="portalAccess.showEnableModal = false; portalAccess.showAssignModal = false"
        >
          <div class="w-full max-w-md rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
            <div class="border-b border-gray-200 px-5 py-4 dark:border-gray-700">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ portalAccess.showEnableModal ? t('people.externalAccessEnable') : t('people.externalAccessAssignRoles') }}
              </h3>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {{ t('people.externalAccessSelectRolesHint') }}
              </p>
            </div>
            <div class="max-h-72 space-y-2 overflow-y-auto px-5 py-4">
              <label
                v-for="role in (portalAccess.showEnableModal ? portalAccess.availableRoles : portalAccess.unassignedRoles)"
                :key="String(role.roleId || role._id)"
                class="flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 px-3 py-2 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900/40"
              >
                <input
                  type="checkbox"
                  class="mt-1 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  :checked="portalAccess.selectedRoleIds.includes(String(role.roleId || role._id))"
                  @change="portalAccess.toggleRoleSelection(role.roleId || role._id)"
                />
                <span>
                  <span class="block text-sm font-medium text-gray-900 dark:text-white">{{ role.name }}</span>
                  <span
                    v-if="role.description"
                    class="mt-0.5 block text-xs text-gray-500 dark:text-gray-400"
                  >{{ role.description }}</span>
                </span>
              </label>
              <p
                v-if="!(portalAccess.showEnableModal ? portalAccess.availableRoles : portalAccess.unassignedRoles).length"
                class="text-sm text-gray-500 dark:text-gray-400"
              >
                {{ t('people.externalAccessNoAvailableRoles') }}
              </p>
            </div>
            <div class="flex justify-end gap-2 border-t border-gray-200 px-5 py-4 dark:border-gray-700">
              <button
                type="button"
                class="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 dark:border-gray-600 dark:text-gray-200"
                @click="portalAccess.showEnableModal = false; portalAccess.showAssignModal = false"
              >
                {{ t('people.externalAccessCancel') }}
              </button>
              <button
                type="button"
                class="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
                :disabled="!portalAccess.selectedRoleIds.length || portalAccess.actionLoading"
                @click="portalAccess.showEnableModal ? portalAccess.confirmEnable() : portalAccess.confirmAssignRoles()"
              >
                {{ portalAccess.showEnableModal ? t('people.externalAccessEnable') : t('people.externalAccessAssignRoles') }}
              </button>
            </div>
          </div>
        </div>
      </Teleport>
    </section>
  </template>
</template>
