<template>
  <div :class="embedded ? 'px-6 pb-6' : 'p-6'">
    <div :class="embedded ? 'mb-4' : 'mb-6'">
      <h3 v-if="!embedded" class="text-lg font-semibold text-gray-900 dark:text-white mb-2">{{ t('settings.organizationParticipationTypesTitle') }}</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">
        {{ t('settings.organizationParticipationTypesIntro') }}
      </p>
      <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 space-y-1">
        <p class="text-xs text-blue-800 dark:text-blue-400">
          {{ t('settings.organizationParticipationTypesHintMinOne') }}
        </p>
        <p class="text-xs text-blue-800 dark:text-blue-400">
          {{ t('settings.organizationParticipationTypesHintDefaultRole') }}
        </p>
        <p class="text-xs text-blue-800 dark:text-blue-400">
          {{ t('settings.organizationParticipationTypesHintColors') }}
        </p>
        <p class="text-xs text-blue-800 dark:text-blue-400">
          {{ t('settings.organizationParticipationTypesHintParticipation') }}
        </p>
      </div>
    </div>

    <div class="flex flex-col sm:flex-row sm:items-end gap-4 mb-6 max-w-3xl">
      <div class="flex-1 min-w-0">
        <label for="organization-types-app" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {{ t('settings.organizationParticipationTypesAppLabel') }}
        </label>
        <HeadlessSelect
          id="organization-types-app"
          v-model="selectedAppKey"
          :options="appOptions"
          teleport
          :teleport-match-width="true"
          wrapper-class="w-full max-w-md"
          button-class="!py-2 !rounded !bg-gray-50 dark:!bg-white/5 dark:!border-white/10"
        />
      </div>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
    </div>

    <div v-else class="space-y-4 max-w-3xl">
      <div
        v-if="clientError"
        class="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-800 dark:text-red-300"
      >
        {{ clientError }}
      </div>

      <div v-if="rows.length > 0">
        <label for="organization-types-default" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {{ t('settings.organizationParticipationTypesDefaultRoleLabel') }}
        </label>
        <HeadlessSelect
          id="organization-types-default"
          v-model="defaultRole"
          :options="orgParticipationTypesDefaultRoleOptions"
          teleport
          :teleport-match-width="true"
          wrapper-class="w-full max-w-md"
          button-class="!py-2 !rounded !bg-gray-50 dark:!bg-white/5 dark:!border-white/10"
        />
      </div>

      <!-- Match ModulesAndFields picklist options block -->
      <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
        <div class="flex items-center justify-between mb-2">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('settings.organizationParticipationTypesRoleTypesLabel') }}</label>
          <button
            type="button"
            class="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="saving || loading"
            @click="openAddRole"
          >
            {{ t('settings.modFieldsAddOption') }}
          </button>
        </div>

        <div
          v-if="rows.length === 0"
          class="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-white/5 border border-dashed border-gray-200 dark:border-white/10 rounded-lg p-4 text-center"
        >
          {{ t('settings.organizationParticipationTypesEmptyRoles') }}
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="(row, index) in rows"
            :key="`row-${index}-${row.value}`"
            class="p-3 bg-gray-50 dark:bg-white/5 rounded border border-gray-200 dark:border-white/10 space-y-3"
            :class="dragOverIdx === index ? 'ring-2 ring-indigo-500 dark:ring-indigo-400' : ''"
            draggable="true"
            @dragstart="onDragStart(index, $event)"
            @dragover.prevent="onDragOver(index, $event)"
            @drop.prevent="onDrop(index)"
            @dragend="onDragEnd"
          >
            <div class="flex items-center gap-3">
            <div class="cursor-grab select-none text-gray-400 dark:text-gray-500" :title="t('settings.modFieldsTitleDragReorder')">⋮⋮</div>

            <label class="inline-flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 shrink-0">
              <span>{{ t('settings.modFieldsColor') }}</span>
              <input
                type="color"
                :value="row.color"
                class="h-7 w-9 cursor-pointer rounded border border-gray-300 bg-white p-0.5 dark:border-gray-600 dark:bg-gray-800"
                :aria-label="t('settings.modFieldsColorForOption', { label: row.value })"
                @input="onRowColorInput(index, $event)"
              />
            </label>

            <div class="flex-1 min-w-0">
              <input
                v-if="editingRowIdx === index"
                v-model="editRowValue"
                class="w-full px-2 py-1 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autofocus
                @blur="saveRowEdit(index)"
                @keyup.enter="saveRowEdit(index)"
                @keyup.esc="cancelRowEdit"
              />
              <template v-else>
                <span class="text-sm font-medium text-gray-900 dark:text-white">{{ row.value }}</span>
                <p v-if="usageCountForDisplay(row.value) > 0" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {{ orgParticipationTypesInUseLabel(usageCountForDisplay(row.value)) }}
                </p>
              </template>
            </div>

            <div
              class="px-3 py-1 rounded-full text-xs font-medium text-white max-w-[140px] truncate shrink-0"
              :style="{ backgroundColor: row.color }"
              :title="row.value"
            >
              {{ row.value }}
            </div>

            <button
              type="button"
              class="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded shrink-0"
              :title="getRowEditTitle(index)"
              @click="editingRowIdx === index ? saveRowEdit(index) : startRowEdit(index)"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </button>

            <button
              type="button"
              class="p-1.5 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200 rounded shrink-0 disabled:opacity-30"
              :title="t('actions.remove')"
              :disabled="rows.length <= 1 || saving"
              @click="requestRemoveRole(index)"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
            </div>

            <div class="ml-7 pl-3 border-l-2 border-gray-200 dark:border-gray-600 space-y-2">
              <div class="flex items-center justify-between gap-2 flex-wrap">
                <span class="text-xs font-medium text-gray-600 dark:text-gray-400">
                  {{ t('settings.organizationParticipationTypesFieldsWhenSelected') }}
                </span>
                <button
                  v-if="row.fields !== undefined"
                  type="button"
                  class="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                  @click="resetFieldsToPlatformDefaults(index)"
                >
                  {{ t('settings.organizationParticipationTypesResetPlatformDefaults') }}
                </button>
              </div>
              <p
                v-if="participationFieldOptions.length === 0 && !fieldsLoadError"
                class="text-xs text-gray-500 dark:text-gray-400"
              >
                {{ t('settings.organizationParticipationTypesNoParticipationFields', { appKey: selectedAppKey }) }}
              </p>
              <p v-if="fieldsLoadError" class="text-xs text-amber-700 dark:text-amber-300">
                {{ fieldsLoadError }}
              </p>
              <p
                v-if="participationFieldOptions.length > 0 && row.fields === undefined && getEffectiveFields(row).length > 0"
                class="text-xs text-gray-500 dark:text-gray-400"
              >
                {{ t('settings.organizationParticipationTypesUsingPlatformDefaults') }}
                <span class="text-gray-400 dark:text-gray-500">{{ t('settings.organizationParticipationTypesInheritedNotSaved') }}</span>
              </p>
              <p
                v-else-if="participationFieldOptions.length > 0 && row.fields === undefined && getEffectiveFields(row).length === 0"
                class="text-xs text-gray-500 dark:text-gray-400"
              >
                {{ t('settings.organizationParticipationTypesPlatformDefaultNoFields') }}
                <span class="text-gray-400 dark:text-gray-500">{{ t('settings.organizationParticipationTypesInheritedNotSaved') }}</span>
              </p>
              <p
                v-else-if="participationFieldOptions.length > 0 && row.fields !== undefined && row.fields.length > 0"
                class="text-xs text-gray-600 dark:text-gray-300"
              >
                {{ t('settings.organizationParticipationTypesCustomFields') }}
              </p>
              <p
                v-else-if="participationFieldOptions.length > 0 && row.fields !== undefined && row.fields.length === 0"
                class="text-xs text-amber-800 dark:text-amber-200/90"
              >
                {{ t('settings.organizationParticipationTypesNoFieldsExplicit') }}
              </p>
              <div
                v-if="participationFieldOptions.length > 0"
                class="flex flex-wrap gap-x-3 gap-y-2 max-h-40 overflow-y-auto pr-1"
              >
                <label
                  v-for="opt in participationFieldOptions"
                  :key="opt.key"
                  class="inline-flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300 cursor-pointer select-none"
                >
                  <HeadlessCheckbox
                    :checked="isFieldSelectedForRow(index, opt.key)"
                    @change="toggleRowField(index, opt.key, $event.target.checked)"
                    checkbox-class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800"
                  />
                  <span>{{ opt.label }}</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      <SettingsSaveBar
        :visible="isDirty"
        :saving="saving"
        :reset-label="t('settings.organizationParticipationTypesReset')"
        :reset-disabled="loading || !isDirty"
        :save-disabled="loading || !canSave"
        @reset="resetLocal"
        @save="save"
      />
    </div>

    <!-- Add Option modal (same pattern as picklist in ModulesAndFields) -->
    <Teleport to="body">
      <div
        v-if="showAddRole"
        class="fixed inset-0 z-[1000] flex items-center justify-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="organization-types-add-title"
      >
        <div class="absolute inset-0 bg-black/50" @click="closeAddRole" />
        <div
          class="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-md mx-4"
          @click.stop
        >
          <div class="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 id="organization-types-add-title" class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('settings.organizationParticipationTypesAddRole') }}</h3>
          </div>
          <div class="p-4 space-y-4">
            <div
              v-if="addRoleError"
              class="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-800 dark:text-red-300"
            >
              {{ addRoleError }}
            </div>
            <div>
              <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('settings.organizationParticipationTypesRoleNameLabel') }}</label>
              <input
                v-model="newRoleValue"
                type="text"
                :placeholder="t('settings.organizationParticipationTypesRoleNamePh')"
                class="w-full px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white"
                @input="addRoleError = ''"
                @keyup.enter="submitAddRole"
              />
            </div>
            <div>
              <label class="block text-xs text-gray-600 dark:text-gray-400 mb-1">{{ t('settings.modFieldsColor') }}</label>
              <div class="flex items-center gap-3 flex-wrap">
                <input
                  v-model="newRoleColor"
                  type="color"
                  class="w-16 h-10 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                />
                <input
                  v-model="newRoleColor"
                  type="text"
                  :placeholder="t('settings.modFieldsColorHexPh')"
                  class="flex-1 min-w-[8rem] px-3 py-2 rounded bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-sm font-mono text-gray-900 dark:text-white"
                  pattern="^#[0-9A-Fa-f]{6}$"
                />
                <div
                  class="px-3 py-1 rounded-full text-xs font-medium text-white shrink-0"
                  :style="{ backgroundColor: peopleTypeColorToHex(newRoleColor) }"
                >
                  {{ t('settings.modFieldsPreview') }}
                </div>
              </div>
            </div>
            <div class="flex justify-end gap-2">
              <button
                type="button"
                class="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 rounded"
                @click="closeAddRole"
              >
                {{ t('actions.cancel') }}
              </button>
              <button
                type="button"
                class="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700"
                @click="submitAddRole"
              >
                {{ t('actions.add') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="deleteConfirmOpen"
        class="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 dark:bg-black/70"
        role="dialog"
        aria-modal="true"
        aria-labelledby="organization-types-delete-title"
        @click.self="cancelDeleteRole"
      >
        <div
          class="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700"
          @click.stop
        >
          <h4 id="organization-types-delete-title" class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {{ t('settings.organizationParticipationTypesDeleteTitle') }}
          </h4>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
            <template v-if="deleteConfirmCount > 0">
              {{ orgParticipationTypesDeleteInUseLabel(deleteConfirmCount) }}
            </template>
            <template v-else>{{ t('settings.organizationParticipationTypesDeleteEmpty') }}</template>
          </p>
          <div class="flex justify-end gap-2">
            <button
              type="button"
              class="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
              @click="cancelDeleteRole"
            >
              {{ t('actions.cancel') }}
            </button>
            <button
              type="button"
              class="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 hover:bg-red-700 text-white"
              @click="confirmRemoveRole"
            >
              {{ t('actions.remove') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
defineProps({
  embedded: {
    type: Boolean,
    default: false
  }
});

import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import SettingsSaveBar from '@/components/settings/SettingsSaveBar.vue';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import { useRoute } from 'vue-router';
import apiClient from '@/utils/apiClient';
import { invalidateOrganizationParticipationTypesCache } from '@/utils/organizationParticipationTypesInvalidate';
import { fetchModuleDefinitionCached } from '@/utils/tenantSchemaApiCache';
import {
  PEOPLE_TYPE_COLOR_OPTIONS,
  coercePeopleTypeColorForSave,
  normalizePeopleTypeHex,
  parsePeopleTypesApiPayload,
  peopleTypeColorToHex,
  typeDefsFromStrings,
  type PeopleTypeDef
} from '@/utils/peopleTypeColors';
import { getOrganizationFieldsForType } from '@/platform/fields/organizationFieldModel';

const { t } = useI18n();

function orgParticipationTypesInUseLabel(count: number) {
  return count === 1
    ? t('settings.organizationParticipationTypesInUseOne', { count })
    : t('settings.organizationParticipationTypesInUseOther', { count });
}

function orgParticipationTypesDeleteInUseLabel(count: number) {
  return count === 1
    ? t('settings.organizationParticipationTypesDeleteInUseOne', { count })
    : t('settings.organizationParticipationTypesDeleteInUseOther', { count });
}

const appOptions = computed(() => [
  { value: 'SALES' as const, label: t('settings.organizationParticipationTypesAppSales') },
  { value: 'HELPDESK' as const, label: t('settings.organizationParticipationTypesAppHelpdesk') },
  { value: 'INVENTORY' as const, label: t('settings.organizationParticipationTypesAppInventory') },
  { value: 'MARKETING' as const, label: t('settings.organizationParticipationTypesAppMarketing') },
  { value: 'PORTAL' as const, label: t('settings.organizationParticipationTypesAppPortal') },
]);

function getRowEditTitle(index: number): string {
  return editingRowIdx.value === index ? t('actions.save') : t('settings.modFieldsRename');
}

const DEFAULTS = {
  SALES: ['Lead', 'Customer'],
  HELPDESK: ['Customer'],
  INVENTORY: ['Vendor'],
  MARKETING: ['Marketing Lead', 'Customer'],
  PORTAL: ['Partner'],
} as const;

const route = useRoute();

type OrgParticipationApp = 'SALES' | 'HELPDESK' | 'INVENTORY' | 'MARKETING' | 'PORTAL';

const ORG_PARTICIPATION_APPS: OrgParticipationApp[] = ['SALES', 'HELPDESK', 'INVENTORY', 'MARKETING', 'PORTAL'];

function appKeyFromRouteQuery(): OrgParticipationApp {
  const s = String(route.query.organizationTypesApp || '').toUpperCase();
  return (ORG_PARTICIPATION_APPS.includes(s as OrgParticipationApp) ? s : 'SALES') as OrgParticipationApp;
}

const selectedAppKey = ref<OrgParticipationApp>(appKeyFromRouteQuery());

watch(
  () => route.query.organizationTypesApp,
  () => {
    const next = appKeyFromRouteQuery();
    if (selectedAppKey.value !== next) {
      selectedAppKey.value = next;
    }
  }
);
const rows = ref<PeopleTypeDef[]>([]);
/** Last saved (or loaded) field state per type — used to omit unchanged `fields` from PUT payload */
const baselineRows = ref<PeopleTypeDef[]>([]);
/** People module fields (`/modules?key=organizations&context=all`) — app-scoped participation fields for checkboxes */
const organizationModuleFields = ref<Array<{ key?: string; label?: string; appKey?: string }>>([]);
/** Set when the module field list request fails */
const fieldsLoadError = ref('');
const defaultRole = ref('');
const snapshotJson = ref('');
const loading = ref(false);
const saving = ref(false);
const clientError = ref('');
const dragFrom = ref<number | null>(null);
const dragOverIdx = ref<number | null>(null);
const usageByRole = ref<Record<string, number>>({});
const deleteConfirmOpen = ref(false);
const pendingDeleteIndex = ref<number | null>(null);
const deleteConfirmCount = ref(0);

const showAddRole = ref(false);
const newRoleValue = ref('');
const newRoleColor = ref('#3b82f6');
const addRoleError = ref('');

const editingRowIdx = ref(-1);
const editRowValue = ref('');

function defaultsFor(key: string): string[] {
  const u = key.toUpperCase();
  const list = (DEFAULTS as Record<string, readonly string[]>)[u] ?? DEFAULTS.SALES;
  return [...list];
}

function defaultRowsFor(key: string): PeopleTypeDef[] {
  return typeDefsFromStrings(defaultsFor(key));
}

const VIRTUAL_ROLE_FIELD_KEYS = new Set(['types', 'type']);

function titleCaseFieldKey(key: string): string {
  return key
    .split('_')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ''))
    .join(' ');
}

/**
 * Options for per-type field checkboxes — union of type-scoped org fields for this app's roles.
 */
const participationFieldOptions = computed(() => {
  const upper = selectedAppKey.value.toUpperCase();
  const moduleList = organizationModuleFields.value || [];
  const byKey = new Map<string, { key: string; label: string }>();

  const roles = (DEFAULTS as Record<string, readonly string[]>)[upper] || ['Customer'];
  const fieldKeysIter = new Set<string>();
  for (const role of roles) {
    for (const fk of getOrganizationFieldsForType(role, undefined)) {
      fieldKeysIter.add(fk);
    }
  }
  for (const fieldKey of fieldKeysIter) {
    const low = fieldKey.toLowerCase();
    if (VIRTUAL_ROLE_FIELD_KEYS.has(low)) continue;
    const modField = moduleList.find((f) => String(f.key || '').toLowerCase() === low);
    const label = modField?.label ? String(modField.label) : titleCaseFieldKey(fieldKey);
    byKey.set(low, { key: modField?.key ?? fieldKey, label });
  }

  for (const f of moduleList) {
    const k = String(f.key ?? '').trim();
    if (!k || VIRTUAL_ROLE_FIELD_KEYS.has(k.toLowerCase())) continue;
    const ak = f.appKey ? String(f.appKey).toUpperCase() : '';
    if (ak === upper && !byKey.has(k.toLowerCase())) {
      byKey.set(k.toLowerCase(), { key: k, label: String(f.label || titleCaseFieldKey(k)) });
    }
  }

  return Array.from(byKey.values()).sort((a, b) => a.label.localeCompare(b.label));
});

function cloneTypeDefsForBaseline(defs: PeopleTypeDef[]): PeopleTypeDef[] {
  return defs.map((d) => {
    const base: PeopleTypeDef = { value: d.value, color: d.color };
    if (d.fields !== undefined) base.fields = [...d.fields];
    return base;
  });
}

function fieldsSignature(f: string[] | undefined): string {
  if (f === undefined) return '__inherit__';
  return JSON.stringify([...f].map((x) => String(x).toLowerCase()).sort());
}

function baselineForRowValue(value: string): PeopleTypeDef | undefined {
  const t = String(value).trim().toLowerCase();
  return baselineRows.value.find((b) => b.value.trim().toLowerCase() === t);
}

function isTypeFieldsModified(current: PeopleTypeDef, baseline: PeopleTypeDef | undefined): boolean {
  if (!baseline) return current.fields !== undefined;
  return fieldsSignature(current.fields) !== fieldsSignature(baseline.fields);
}

/** Effective checkboxes: saved list, or platform default when inheriting */
function getEffectiveFields(row: PeopleTypeDef): string[] {
  if (row.fields !== undefined) return [...row.fields];
  return getOrganizationFieldsForType(row.value, null);
}

function isFieldSelectedForRow(rowIndex: number, fieldKey: string): boolean {
  const row = rows.value[rowIndex];
  if (!row) return false;
  const low = fieldKey.toLowerCase();
  return getEffectiveFields(row).some((k) => String(k).toLowerCase() === low);
}

function toggleRowField(rowIndex: number, fieldKey: string, checked: boolean) {
  const row = rows.value[rowIndex];
  if (!row) return;
  let nextFields =
    row.fields === undefined
      ? [...getOrganizationFieldsForType(row.value, null)]
      : [...row.fields];
  const low = fieldKey.toLowerCase();
  if (checked) {
    if (!nextFields.some((k) => String(k).toLowerCase() === low)) {
      const canon =
        participationFieldOptions.value.find((o) => o.key.toLowerCase() === low)?.key ?? fieldKey;
      nextFields.push(canon);
    }
  } else {
    nextFields = nextFields.filter((k) => String(k).toLowerCase() !== low);
  }
  const updated: PeopleTypeDef =
    nextFields.length === 0 ? { ...row, fields: [] } : { ...row, fields: nextFields };
  const copy = [...rows.value];
  copy[rowIndex] = updated;
  rows.value = copy;
}

function resetFieldsToPlatformDefaults(rowIndex: number) {
  const row = rows.value[rowIndex];
  if (!row) return;
  const { fields: _drop, ...rest } = row;
  const copy = [...rows.value];
  copy[rowIndex] = rest as PeopleTypeDef;
  rows.value = copy;
}

type SnapshotRow = { value: string; color: string; fields: string[] | null };

function snapshotFromState() {
  return JSON.stringify({
    rows: rows.value.map((r): SnapshotRow => {
      return {
        value: String(r.value),
        color: r.color,
        fields: r.fields === undefined ? null : [...r.fields]
      };
    }),
    defaultRole: defaultRole.value
  });
}

function applySnapshot(json: string) {
  try {
    const o = JSON.parse(json) as {
      rows?: SnapshotRow[];
      defaultRole?: string;
      roles?: string[];
    };
    if (Array.isArray(o.rows) && o.rows.length > 0) {
      rows.value = o.rows.map((r, i) => {
        const value = String(r.value ?? '').trim() || `Role ${i + 1}`;
        const row: PeopleTypeDef = { value, color: peopleTypeColorToHex(r.color) };
        if (r.fields !== null && r.fields !== undefined && Array.isArray(r.fields)) {
          row.fields = r.fields.map((x) => String(x));
        }
        return row;
      });
    } else if (Array.isArray(o.roles) && o.roles.length > 0) {
      rows.value = typeDefsFromStrings(o.roles.map((s) => String(s)));
    } else {
      rows.value = defaultRowsFor(selectedAppKey.value);
    }
    defaultRole.value =
      typeof o.defaultRole === 'string' ? o.defaultRole : rows.value[0]?.value || '';
  } catch {
    rows.value = defaultRowsFor(selectedAppKey.value);
    defaultRole.value = rows.value[0]?.value || '';
  }
}

function clearClientError() {
  clientError.value = '';
}

const roleOptionsForDefault = computed(() => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of rows.value) {
    const t = String(r.value).trim();
    if (!t) continue;
    const low = t.toLowerCase();
    if (seen.has(low)) continue;
    seen.add(low);
    out.push(t);
  }
  return out;
});

const orgParticipationTypesDefaultRoleOptions = computed(() =>
  roleOptionsForDefault.value.map((r) => ({ value: r, label: r }))
);

const isDirty = computed(() => snapshotFromState() !== snapshotJson.value);

const canSave = computed(() => {
  if (!isDirty.value) return false;
  const err = validateClient();
  return err === null;
});

watch(roleOptionsForDefault, (opts) => {
  if (opts.length === 0) return;
  const dr = defaultRole.value.trim();
  const ok = opts.some((t) => t.toLowerCase() === dr.toLowerCase());
  if (!ok) {
    const first = opts[0];
    if (first != null) defaultRole.value = first;
  }
});

function usageCountForDisplay(roleLabel: string): number {
  const t = String(roleLabel).trim();
  if (!t) return 0;
  if (usageByRole.value[t] != null) return usageByRole.value[t];
  const keys = Object.keys(usageByRole.value);
  const k = keys.find((x) => x.toLowerCase() === t.toLowerCase());
  if (k == null) return 0;
  return usageByRole.value[k] ?? 0;
}

async function fetchUsage() {
  try {
    const res = (await apiClient.get('/settings/core-modules/organizations/participation-types/usage', {
      params: { appKey: selectedAppKey.value }
    })) as { success?: boolean; data?: { usage?: Record<string, number> } };
    const d = res?.data?.usage;
    usageByRole.value = d && typeof d === 'object' ? { ...d } : {};
  } catch {
    usageByRole.value = {};
  }
}

function openAddRole() {
  addRoleError.value = '';
  newRoleValue.value = '';
  const colorOpt =
    PEOPLE_TYPE_COLOR_OPTIONS[rows.value.length % PEOPLE_TYPE_COLOR_OPTIONS.length] ?? PEOPLE_TYPE_COLOR_OPTIONS[0];
  newRoleColor.value = colorOpt?.hex ?? '#64748b';
  showAddRole.value = true;
}

function closeAddRole() {
  showAddRole.value = false;
  addRoleError.value = '';
  newRoleValue.value = '';
}

function submitAddRole() {
  const v = newRoleValue.value.trim();
  if (!v) {
    addRoleError.value = t('settings.organizationParticipationTypesErrEnterName');
    return;
  }
  const dup = rows.value.some((r) => r.value.trim().toLowerCase() === v.toLowerCase());
  if (dup) {
    addRoleError.value = t('settings.organizationParticipationTypesErrDuplicateExists');
    return;
  }
  addRoleError.value = '';
  rows.value = [...rows.value, { value: v, color: peopleTypeColorToHex(newRoleColor.value) }];
  closeAddRole();
}

function onRowColorInput(index: number, e: Event) {
  const t = e.target as HTMLInputElement;
  const h = normalizePeopleTypeHex(t.value);
  const row = rows.value[index];
  if (h && row) row.color = h;
  clearClientError();
}

function startRowEdit(index: number) {
  editingRowIdx.value = index;
  editRowValue.value = String(rows.value[index]?.value ?? '');
}

function saveRowEdit(index: number) {
  if (editingRowIdx.value !== index) return;
  const next = editRowValue.value.trim();
  if (!next) {
    cancelRowEdit();
    return;
  }
  const low = next.toLowerCase();
  const dup = rows.value.some((r, i) => i !== index && r.value.trim().toLowerCase() === low);
  if (dup) {
    clientError.value = t('settings.organizationParticipationTypesErrDuplicateNames');
    return;
  }
  clearClientError();
  const row = rows.value[index];
  if (row) row.value = next;
  editingRowIdx.value = -1;
  editRowValue.value = '';
}

function cancelRowEdit() {
  editingRowIdx.value = -1;
  editRowValue.value = '';
}

async function load() {
  loading.value = true;
  clientError.value = '';
  try {
    fieldsLoadError.value = '';
    const [typeRes, modRes] = await Promise.all([
      apiClient.get('/settings/core-modules/organizations/participation-types', {
        params: { appKey: selectedAppKey.value }
      }) as Promise<{ success?: boolean; data?: unknown }>,
      fetchModuleDefinitionCached('organizations', { context: 'all' })
        .then((mod) => ({ success: true, data: mod ? [mod] : [] }))
        .catch((e: unknown) => ({ __error: e }))
    ]);
    await fetchUsage();
    if (modRes && typeof modRes === 'object' && '__error' in modRes) {
      fieldsLoadError.value = t('settings.organizationParticipationTypesFieldsLoadConnection');
      organizationModuleFields.value = [];
    } else if (
      modRes &&
      typeof modRes === 'object' &&
      'success' in modRes &&
      (modRes as { success?: boolean }).success &&
      Array.isArray((modRes as { data?: unknown }).data)
    ) {
      const list = (modRes as { data: Array<{ fields?: unknown }> }).data;
      const mod = list.find((m) => String(m && (m as { key?: string }).key || '').toLowerCase() === 'organizations');
      organizationModuleFields.value = Array.isArray(mod?.fields) ? mod.fields : [];
    } else {
      organizationModuleFields.value = [];
      if (modRes && typeof modRes === 'object' && 'success' in modRes && !(modRes as { success?: boolean }).success) {
        fieldsLoadError.value = t('settings.organizationParticipationTypesFieldsLoadFailed');
      }
    }
    const fb = defaultsFor(selectedAppKey.value);
    const parsed = parsePeopleTypesApiPayload(typeRes?.data, fb, fb[0] || '');
    rows.value = parsed.typeDefs.map((d) => {
      const row: PeopleTypeDef = {
        value: d.value,
        color: peopleTypeColorToHex(d.color)
      };
      if (d.fields !== undefined) row.fields = [...d.fields];
      return row;
    });
    defaultRole.value = parsed.defaultRole;
    baselineRows.value = cloneTypeDefsForBaseline(rows.value);
    snapshotJson.value = snapshotFromState();
    editingRowIdx.value = -1;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : t('settings.organizationParticipationTypesFailedLoad');
    clientError.value = msg;
    rows.value = defaultRowsFor(selectedAppKey.value);
    organizationModuleFields.value = [];
    fieldsLoadError.value = '';
    defaultRole.value = rows.value[0]?.value || '';
    baselineRows.value = cloneTypeDefsForBaseline(rows.value);
    snapshotJson.value = snapshotFromState();
    editingRowIdx.value = -1;
  } finally {
    loading.value = false;
  }
}

watch(selectedAppKey, () => {
  load();
});

void load();

function requestRemoveRole(index: number) {
  if (rows.value.length <= 1) return;
  clearClientError();
  const name = String(rows.value[index]?.value).trim();
  const n = usageCountForDisplay(name);
  pendingDeleteIndex.value = index;
  deleteConfirmCount.value = n;
  deleteConfirmOpen.value = true;
}

function cancelDeleteRole() {
  deleteConfirmOpen.value = false;
  pendingDeleteIndex.value = null;
  deleteConfirmCount.value = 0;
}

function confirmRemoveRole() {
  const idx = pendingDeleteIndex.value;
  cancelDeleteRole();
  if (idx === null || idx < 0) return;
  if (rows.value.length <= 1) return;
  const next = rows.value.filter((_, i) => i !== idx);
  rows.value = next;
  if (editingRowIdx.value === idx) cancelRowEdit();
  else if (editingRowIdx.value > idx) editingRowIdx.value -= 1;
}

function onDragStart(index: number, e: DragEvent) {
  dragFrom.value = index;
  e.dataTransfer?.setData('text/plain', String(index));
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
}

function onDragOver(index: number, e: DragEvent) {
  dragOverIdx.value = index;
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
}

function onDragEnd() {
  dragFrom.value = null;
  dragOverIdx.value = null;
}

function onDrop(index: number) {
  const from = dragFrom.value;
  dragFrom.value = null;
  dragOverIdx.value = null;
  if (from === null || from === index) return;
  const next = [...rows.value];
  const [item] = next.splice(from, 1);
  if (!item) return;
  next.splice(index, 0, item);
  rows.value = next;
}

function resetLocal() {
  clearClientError();
  cancelRowEdit();
  applySnapshot(snapshotJson.value);
}

function validateClient(): string | null {
  const trimmed = rows.value.map((r) => String(r.value).trim());
  if (trimmed.some((name) => !name)) {
    return t('settings.organizationParticipationTypesErrEmptyName');
  }
  if (trimmed.length < 1) {
    return t('settings.organizationParticipationTypesErrAtLeastOne');
  }
  const seen = new Set<string>();
  for (const name of trimmed) {
    const low = name.toLowerCase();
    if (seen.has(low)) {
      return t('settings.organizationParticipationTypesErrDuplicateNames');
    }
    seen.add(low);
  }
  return null;
}

function buildTypesPayloadForSave(): Array<{ value: string; color: string; fields?: string[] }> {
  return rows.value.map((r, i) => {
    const base: { value: string; color: string; fields?: string[] } = {
      value: String(r.value).trim(),
      color: coercePeopleTypeColorForSave(r.color, i)
    };
    const orig = baselineForRowValue(base.value);
    if (!isTypeFieldsModified(r, orig)) {
      if (orig?.fields !== undefined) {
        return { ...base, fields: [...orig.fields] };
      }
      return base;
    }
    if (r.fields === undefined) return base;
    return { ...base, fields: [...r.fields] };
  });
}

async function save() {
  const err = validateClient();
  if (err) {
    clientError.value = err;
    return;
  }
  saving.value = true;
  clientError.value = '';
  const typesPayload = buildTypesPayloadForSave();
  const typeNames = typesPayload.map((t) => t.value);
  const want = defaultRole.value.trim();
  const matched = typeNames.find((t) => t.toLowerCase() === want.toLowerCase());
  const dr = matched ?? typeNames[0] ?? '';
  if (dr && dr !== defaultRole.value) {
    defaultRole.value = dr;
  }
  const payload = {
    appKey: selectedAppKey.value,
    types: typesPayload,
    defaultRole: dr
  };
  try {
    const res = (await apiClient.put('/settings/core-modules/organizations/participation-types', payload)) as {
      success?: boolean;
      data?: unknown;
      message?: string;
    };
    if (!res?.success) {
      throw new Error(res?.message || t('settings.organizationParticipationTypesSaveFailed'));
    }
    const d = res.data;
    if (d && typeof d === 'object') {
      const parsed = parsePeopleTypesApiPayload(d, typeNames, dr || typeNames[0] || '');
      rows.value = parsed.typeDefs.map((x) => {
        const row: PeopleTypeDef = {
          value: x.value,
          color: peopleTypeColorToHex(x.color)
        };
        if (x.fields !== undefined) row.fields = [...x.fields];
        return row;
      });
      defaultRole.value = parsed.defaultRole;
    }
    baselineRows.value = cloneTypeDefsForBaseline(rows.value);
    snapshotJson.value = snapshotFromState();
    invalidateOrganizationParticipationTypesCache();
    await fetchUsage();
    cancelRowEdit();
  } catch (e: unknown) {
    const msg =
      e && typeof e === 'object' && 'response' in e && (e as { response?: { data?: { message?: string } } }).response?.data?.message
        ? String((e as { response: { data: { message: string } } }).response.data.message)
        : e instanceof Error
          ? e.message
          : t('settings.organizationParticipationTypesFailedSave');
    clientError.value = msg;
  } finally {
    saving.value = false;
  }
}
</script>
