<template>
  <div class="mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col overflow-hidden px-4 sm:px-6 lg:px-8 py-6">
    <div v-if="loading" class="text-sm text-gray-500 dark:text-gray-400">
      {{ t('states.loading') }}
    </div>

    <div v-else-if="!template" class="text-sm text-gray-500 dark:text-gray-400">
      {{ t('templates.loadFailed') }}
    </div>

    <template v-else>
      <div class="mb-6 flex shrink-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">{{ template.name }}</h1>
          <p v-if="template.description" class="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {{ template.description }}
          </p>
          <div class="mt-3 flex flex-wrap gap-2 text-xs">
            <span class="inline-flex rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-1 text-gray-700 dark:text-gray-300">
              {{ formatStatus(template.status) }}
            </span>
            <span
              v-if="template.moduleScope"
              class="inline-flex rounded-full bg-indigo-50 dark:bg-indigo-900/30 px-2.5 py-1 text-indigo-700 dark:text-indigo-300"
            >
              {{ template.moduleScope }}
            </span>
            <span
              v-if="template.isDefault"
              class="inline-flex rounded-full bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-1 text-emerald-700 dark:text-emerald-300"
            >
              {{ t('templates.defaultBadge') }}
            </span>
            <span class="inline-flex rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-1 uppercase text-gray-700 dark:text-gray-300">
              {{ template.outputFormat || 'pdf' }}
            </span>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            v-if="canEdit"
            type="button"
            class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            @click="openBuilder"
          >
            {{ t('templates.openBuilder') }}
          </button>
          <button
            v-if="canCreate"
            type="button"
            class="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm"
            :disabled="cloneBusy"
            @click="handleDuplicate"
          >
            {{ cloneBusy ? t('states.loading') : t('actions.duplicate') }}
          </button>
          <button
            v-if="canEdit && template.moduleScope && !template.isDefault"
            type="button"
            class="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm"
            :disabled="defaultBusy"
            @click="handleSetDefault(true)"
          >
            {{ defaultBusy ? t('states.loading') : t('templates.setAsDefault') }}
          </button>
          <button
            v-if="canEdit && template.isDefault"
            type="button"
            class="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm"
            :disabled="defaultBusy"
            @click="handleSetDefault(false)"
          >
            {{ defaultBusy ? t('states.loading') : t('templates.clearDefault') }}
          </button>
          <button
            v-if="canEdit"
            type="button"
            class="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm"
            :disabled="validateBusy"
            @click="handleValidate"
          >
            {{ validateBusy ? t('templates.validating') : t('templates.validate') }}
          </button>
          <button
            v-if="canRender && template.latestPublishedVersion && !isEmailFormat"
            type="button"
            class="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm"
            :disabled="renderBusy"
            @click="handlePreviewPdf"
          >
            {{ renderBusy ? t('templates.rendering') : t('templates.previewPdf') }}
          </button>
          <button
            v-if="canPublish && template.status !== 'published'"
            type="button"
            class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            @click="handlePublish"
          >
            {{ t('templates.publish') }}
          </button>
          <button
            v-if="canArchive && template.status !== 'archived'"
            type="button"
            class="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm"
            @click="handleArchive"
          >
            {{ t('templates.archive') }}
          </button>
          <button
            v-if="canDelete"
            type="button"
            class="rounded-lg border border-red-300 dark:border-red-700 px-4 py-2 text-sm text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
            :disabled="deleteBusy"
            @click="handleDelete"
          >
            {{ deleteBusy ? t('states.loading') : t('actions.delete') }}
          </button>
        </div>
      </div>

      <div class="grid min-h-0 flex-1 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.85fr)] lg:items-stretch">
        <!-- Preview (left) -->
        <section class="flex min-h-0 flex-col overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h2 class="mb-3 shrink-0 text-sm font-semibold text-gray-900 dark:text-white">{{ t('templates.previewSection') }}</h2>
          <TemplateHtmlPreviewPanel
            class="min-h-0 flex-1"
            :template-id="String(templateId)"
            :template="template"
          />
        </section>

        <!-- Detail (right) -->
        <div class="flex min-h-0 flex-col gap-6 overflow-y-auto">
          <section class="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <h2 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">{{ t('templates.colPurpose') }}</h2>
            <dl class="space-y-2 text-sm">
              <div>
                <dt class="text-gray-500 dark:text-gray-400">{{ t('templates.fieldPurpose') }}</dt>
                <dd class="text-gray-900 dark:text-white">{{ template.purpose || '—' }}</dd>
              </div>
              <div>
                <dt class="text-gray-500 dark:text-gray-400">{{ t('templates.fieldCategory') }}</dt>
                <dd class="text-gray-900 dark:text-white">{{ template.category || '—' }}</dd>
              </div>
              <div>
                <dt class="text-gray-500 dark:text-gray-400">{{ t('templates.fieldModuleScope') }}</dt>
                <dd class="text-gray-900 dark:text-white">{{ template.moduleScope || '—' }}</dd>
              </div>
            </dl>
          </section>

          <section class="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <h2 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">{{ t('templates.versions') }}</h2>
            <dl class="space-y-2 text-sm">
              <div class="flex justify-between gap-4">
                <dt class="text-gray-500 dark:text-gray-400">{{ t('templates.publishedVersion') }}</dt>
                <dd>{{ template.latestPublishedVersion ? `v${template.latestPublishedVersion}` : '—' }}</dd>
              </div>
              <div class="flex justify-between gap-4">
                <dt class="text-gray-500 dark:text-gray-400">{{ t('templates.colVersion') }}</dt>
                <dd>{{ template.latestVersion ? `v${template.latestVersion}` : '—' }}</dd>
              </div>
            </dl>
            <p v-if="template.draftDefinition" class="mt-3 text-xs text-amber-700 dark:text-amber-300">
              {{ t('templates.draftAvailable') }}
            </p>

            <ul v-if="versions.length" class="mt-4 space-y-2">
              <li
                v-for="version in versions"
                :key="version._id"
                class="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-800/60 px-3 py-2 text-sm"
              >
                <div class="flex items-center gap-3">
                  <span>v{{ version.version }}</span>
                  <span class="text-gray-500 dark:text-gray-400">
                    {{ version.published ? t('templates.statePublished') : t('templates.stateDraft') }}
                  </span>
                </div>
                <button
                  v-if="canEdit && version.published"
                  type="button"
                  class="text-indigo-600 dark:text-indigo-400 hover:underline"
                  :disabled="restoreBusy === version.version"
                  @click="handleRestore(version.version)"
                >
                  {{ restoreBusy === version.version ? t('states.loading') : t('templates.restoreVersion') }}
                </button>
              </li>
            </ul>
          </section>

          <section
            v-if="validationResult"
            class="rounded-xl border border-gray-200 dark:border-gray-700 p-4"
          >
            <h2 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">{{ t('templates.validationSection') }}</h2>

            <p
              class="text-sm mb-3"
              :class="validationResult.valid ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'"
            >
              {{ validationResult.valid ? t('templates.validationPassed') : t('templates.validationFailed') }}
            </p>

            <div v-if="validationResult.errors?.length" class="mb-3">
              <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                {{ t('templates.validationErrors') }}
              </h3>
              <ul class="space-y-1 text-sm text-red-700 dark:text-red-300">
                <li v-for="(issue, index) in validationResult.errors" :key="`error-${index}`">
                  {{ formatValidationIssue(issue) }}
                </li>
              </ul>
            </div>

            <div v-if="validationResult.warnings?.length">
              <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                {{ t('templates.validationWarnings') }}
              </h3>
              <ul class="space-y-1 text-sm text-amber-700 dark:text-amber-300">
                <li v-for="(issue, index) in validationResult.warnings" :key="`warning-${index}`">
                  {{ formatValidationIssue(issue) }}
                </li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    </template>
  </div>

  <CreateTemplateDrawer
    :is-open="showDuplicateDrawer"
    :initial-data="duplicateInitial"
    @close="showDuplicateDrawer = false"
    @create="handleDuplicateCreate"
  />
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import TemplateHtmlPreviewPanel from '@/modules/template/components/TemplateHtmlPreviewPanel.vue';
import CreateTemplateDrawer from '@/components/templates/CreateTemplateDrawer.vue';
import { isEmailOutputFormat } from '@/constants/contentPageSettings';
import { useTemplates } from '@/composables/useTemplates';
import { useAuthStore } from '@/stores/authRegistry';
import { useNotifications } from '@/composables/useNotifications';
import { useTabs } from '@/composables/useTabs';
import { openRecordInTab } from '@/utils/tabNavigation';

import { confirmAction } from '@/composables/useConfirmAction';
const props = defineProps({
  id: { type: String, default: '' }
});

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const authStore = useAuthStore();
const notifications = useNotifications();
const { activeTabId, updateTabTitle, findTabById } = useTabs();

const {
  fetchTemplate,
  updateTemplate,
  publishTemplate,
  archiveTemplate,
  deleteTemplate,
  cloneTemplate,
  listVersions,
  validateTemplate,
  restoreVersion,
  previewRenderedTemplate
} = useTemplates();

const loading = ref(true);
const validateBusy = ref(false);
const deleteBusy = ref(false);
const cloneBusy = ref(false);
const showDuplicateDrawer = ref(false);
const duplicateInitial = ref({});
const defaultBusy = ref(false);
const restoreBusy = ref(null);
const renderBusy = ref(false);
const template = ref(null);
const versions = ref([]);
const validationResult = ref(null);
const recordId = ref('');

const templateId = computed(() => props.id || route.params.id);

const canCreate = computed(() => authStore.can('templates', 'create'));
const canEdit = computed(() => authStore.can('templates', 'edit'));
const canPublish = computed(() => authStore.can('templates', 'publish'));
const canArchive = computed(() => authStore.can('templates', 'archive'));
const canDelete = computed(() => authStore.can('templates', 'delete'));
const canRender = computed(() => authStore.can('templates', 'render'));

const isEmailFormat = computed(() => isEmailOutputFormat(template.value?.outputFormat));

/** PDF download still needs a real record for quote/invoice merges; HTML preview uses sample data. */
const needsRecordContext = computed(() => {
  const scope = String(template.value?.moduleScope || '').toLowerCase();
  return scope === 'quotes' || scope === 'invoices';
});

function formatStatus(value) {
  if (!value) return 'Draft';
  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
}

function formatValidationIssue(issue) {
  if (!issue) return '';
  const path = issue.path ? `${issue.path}: ` : '';
  return `${path}${issue.message || ''}`.trim();
}

function extractValidationDetails(error) {
  const details = error?.response?.data?.details;
  return Array.isArray(details) ? details : [];
}

function openBuilder() {
  const id = templateId.value;
  if (!id) return;
  const name = String(template.value?.name || '').trim() || t('templates.detailTitle');
  openRecordInTab(`/templates/${id}/builder`, {
    title: name,
    icon: 'document-text',
    params: { id, name },
    name: `template-builder-${id}`
  });
}

function handleDuplicate() {
  if (!templateId.value || !template.value) return;
  const name = String(template.value?.name || '').trim();
  duplicateInitial.value = {
    name: name && !/\(copy\)$/i.test(name) ? `${name} (Copy)` : name || '',
    moduleScope: template.value?.moduleScope || '',
    outputFormat: template.value?.outputFormat === 'email' ? 'email' : 'pdf',
    paperSize: template.value?.paperSize || 'A4',
    orientation: template.value?.orientation || 'portrait',
    customPageWidth: template.value?.customPageWidth,
    customPageHeight: template.value?.customPageHeight
  };
  showDuplicateDrawer.value = true;
}

async function handleDuplicateCreate(payload) {
  if (!templateId.value || cloneBusy.value) return;
  cloneBusy.value = true;
  try {
    const created = await cloneTemplate(templateId.value, payload?.name);
    showDuplicateDrawer.value = false;
    notifications.success(t('templates.duplicateSuccess'));
    const id = created?._id || created?.id;
    if (!id) return;
    const name = String(created?.name || payload?.name || '').trim() || t('templates.detailTitle');
    openRecordInTab(`/templates/${id}/builder`, {
      title: name,
      icon: 'document-text',
      params: { id, name },
      name: `template-builder-${id}`
    });
  } catch (error) {
    notifications.error(error?.message || t('templates.duplicateFailed'));
  } finally {
    cloneBusy.value = false;
  }
}

async function loadTemplate() {
  loading.value = true;
  try {
    template.value = await fetchTemplate(templateId.value);
    versions.value = await listVersions(templateId.value);
    validationResult.value = null;
    const tabId = activeTabId.value;
    if (tabId && route.name === 'template-detail') {
      const tab = findTabById(tabId);
      if (tab?.path) {
        const name = String(template.value?.name || '').trim() || t('templates.detailTitle');
        updateTabTitle(tabId, name);
      }
    }
  } catch (error) {
    template.value = null;
    if (!error?.is404 && error?.status !== 404) {
      notifications.error(t('templates.loadFailed'));
    }
  } finally {
    loading.value = false;
  }
}

async function handlePublish() {
  try {
    await publishTemplate(templateId.value);
    notifications.success(t('templates.publishSuccess'));
    await loadTemplate();
  } catch (error) {
    const details = extractValidationDetails(error);
    if (details.length) {
      validationResult.value = {
        valid: false,
        errors: details,
        warnings: []
      };
      notifications.error(t('templates.publishBlocked'));
      return;
    }
    notifications.error(error?.message || t('templates.loadFailed'));
  }
}

async function handleSetDefault(isDefault) {
  if (!templateId.value) return;
  if (isDefault && !template.value?.moduleScope) {
    notifications.error(t('templates.setAsDefaultNeedsModule'));
    return;
  }
  defaultBusy.value = true;
  try {
    template.value = await updateTemplate(templateId.value, { isDefault: Boolean(isDefault) });
    notifications.success(
      isDefault ? t('templates.setAsDefaultSuccess') : t('templates.clearDefaultSuccess')
    );
  } catch (error) {
    notifications.error(error?.message || t('templates.loadFailed'));
  } finally {
    defaultBusy.value = false;
  }
}

async function handleValidate() {
  validateBusy.value = true;
  try {
    validationResult.value = await validateTemplate(templateId.value);
  } catch (error) {
    notifications.error(error?.message || t('templates.loadFailed'));
  } finally {
    validateBusy.value = false;
  }
}

async function handleRestore(version) {
  restoreBusy.value = version;
  try {
    await restoreVersion(templateId.value, version);
    notifications.success(t('templates.restoreSuccess'));
    await loadTemplate();
  } catch (error) {
    notifications.error(error?.message || t('templates.restoreFailed'));
  } finally {
    restoreBusy.value = null;
  }
}

async function handleArchive() {
  try {
    await archiveTemplate(templateId.value);
    await loadTemplate();
  } catch (error) {
    notifications.error(error?.message || t('templates.loadFailed'));
  }
}

async function handleDelete() {
  if (!template.value) return;
  const name = String(template.value.name || '').trim() || t('templates.detailTitle');
  if (!await confirmAction(t('templates.confirmDelete', { name }))) return;

  deleteBusy.value = true;
  try {
    await deleteTemplate(templateId.value);
    notifications.success(t('templates.deleteSuccess'));
    router.push({ name: 'templates' });
  } catch (error) {
    notifications.error(error?.message || t('templates.deleteFailed'));
  } finally {
    deleteBusy.value = false;
  }
}

async function handlePreviewPdf() {
  if (needsRecordContext.value && !recordId.value.trim()) {
    notifications.error(t('templates.recordIdRequired'));
    return;
  }

  renderBusy.value = true;
  try {
    const safeName = String(template.value?.name || 'template')
      .trim()
      .replace(/[^a-zA-Z0-9-_]+/g, '-')
      .slice(0, 80) || 'template';

    await previewRenderedTemplate(templateId.value, {
      recordId: recordId.value.trim() || undefined,
      recordModuleKey: template.value?.moduleScope || undefined,
      fileName: `${safeName}.pdf`
    });

    notifications.success(t('templates.renderSuccess'));
  } catch (error) {
    notifications.error(error?.message || t('templates.renderFailed'));
  } finally {
    renderBusy.value = false;
  }
}

watch(templateId, () => {
  if (templateId.value) loadTemplate();
});

onMounted(() => {
  if (templateId.value) loadTemplate();
});
</script>
