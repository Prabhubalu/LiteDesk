<template>
  <PortalRecordShell
    :error="error"
    :loading="loading"
    :back-label="t('cases.portalCasesBack')"
    :eyebrow="caseRecord?.caseId"
    :title="caseRecord?.title || ''"
    :compact="true"
    :split-layout="true"
    :wide="true"
    :show-branding="false"
    @back="router.push({ name: 'portal-case-list' })"
  >
    <template v-if="caseRecord" #badges>
      <PortalCaseStatusBadge :status="caseRecord.status" />
      <span
        v-if="caseRecord.priority"
        class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium"
        :class="portalCasePriorityClass(caseRecord.priority)"
      >
        {{ caseRecord.priority }}
      </span>
    </template>

    <template v-if="caseRecord" #header-extra>
      <div
        v-if="statusBanner"
        class="flex items-start gap-3 rounded-xl px-3.5 py-3 text-sm"
        :class="statusBanner.className"
      >
        <component :is="statusBanner.icon" class="mt-0.5 h-5 w-5 shrink-0" />
        <div class="min-w-0">
          <p class="font-medium">{{ statusBanner.title }}</p>
          <p class="mt-0.5 text-[13px] leading-relaxed opacity-90">{{ statusBanner.message }}</p>
        </div>
      </div>
      <p v-if="updatedLabel" class="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
        {{ updatedLabel }}
      </p>
    </template>

    <template v-if="caseRecord">
      <div
        :class="[
          'flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-2xl ring-1 ring-neutral-200/80 dark:ring-neutral-700/80',
          PLATFORM_HOME_CARD_CLASS
        ]"
      >
        <PortalCaseConversation
          ref="conversationRef"
          :activities="activities"
          flex-fill
        />

        <PortalCaseReplyComposer
          v-if="canReply"
          v-model="replyBody"
          :attachments="uploadedAttachments"
          :allow-attachments="allowAttachments"
          :disabled="replying || uploading"
          :sending="replying"
          :upload-error="uploadError"
          :send-error="replyError"
          docked
          @send="submitReply"
          @files-selected="handleFilesSelected"
          @remove-attachment="removeUploaded"
        />

        <section
          v-else
          class="shrink-0 border-t border-neutral-200 bg-neutral-50 px-5 py-4 text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900/50 dark:text-neutral-400"
        >
          {{ t('cases.portalCasesClosedNoReply') }}
        </section>
      </div>

    </template>

    <template v-if="caseRecord?.isClosed" #sidebar>
      <PortalCaseCsat
        :case-id="String(caseRecord._id)"
        :csat-submitted="caseRecord.csatSubmitted"
        :csat-score="caseRecord.csatScore"
        @submitted="handleCsatSubmitted"
      />
    </template>
  </PortalRecordShell>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import {
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  SparklesIcon
} from '@heroicons/vue/24/outline';
import { usePortalCases } from '@/composables/usePortalCases';
import { usePortalCasePolling } from '@/composables/usePortalCasePolling';
import { uploadPortalAttachment } from '@/utils/portalAttachmentUpload';
import portalApiClient from '@/utils/portalApiClient';
import { isPortalCaseClosed, portalCasePriorityClass } from '@/utils/portalCaseUtils';
import { capturePortalCaseReplySent } from '@/config/posthogPortal';
import PortalRecordShell from '@/components/portal/PortalRecordShell.vue';
import PortalCaseStatusBadge from '@/components/portal/PortalCaseStatusBadge.vue';
import PortalCaseConversation from '@/components/portal/PortalCaseConversation.vue';
import PortalCaseReplyComposer from '@/components/portal/PortalCaseReplyComposer.vue';
import PortalCaseCsat from '@/components/portal/PortalCaseCsat.vue';
import { PLATFORM_HOME_CARD_CLASS } from '@/utils/platformHomeLayout';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { getCase, replyToCase, markCaseRead } = usePortalCases();

const loading = ref(true);
const error = ref(null);
const caseRecord = ref(null);
const replyBody = ref('');
const replying = ref(false);
const replyError = ref(null);
const uploading = ref(false);
const uploadError = ref(null);
const uploadedAttachments = ref([]);
const allowReplyByCapability = ref(true);
const allowAttachments = ref(false);
const conversationRef = ref(null);

const activities = computed(() => {
  const list = caseRecord.value?.activities;
  return Array.isArray(list) ? list : [];
});

const canReply = computed(() => {
  const status = caseRecord.value?.status;
  return !isPortalCaseClosed(status) && allowReplyByCapability.value !== false;
});

const updatedLabel = computed(() => {
  const value = caseRecord.value?.updatedAt;
  if (!value) return '';
  return t('cases.portalCasesUpdated', {
    date: new Date(value).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  });
});

const statusBanner = computed(() => {
  const status = String(caseRecord.value?.status || '');
  if (status === 'Waiting for Customer') {
    return {
      icon: ExclamationTriangleIcon,
      title: t('cases.portalCaseStatusWaitingOnYou'),
      message: t('cases.portalCaseHintWaitingOnYou'),
      className: 'bg-warning-50 text-warning-900 ring-1 ring-warning-200 dark:bg-warning-900/20 dark:text-warning-100 dark:ring-warning-500/30'
    };
  }
  if (status === 'In Progress') {
    return {
      icon: ClockIcon,
      title: t('cases.portalCaseStatusInProgress'),
      message: t('cases.portalCaseHintInProgress'),
      className: 'bg-primary-50 text-primary-900 ring-1 ring-primary-200 dark:bg-primary-900/20 dark:text-primary-100 dark:ring-primary-500/30'
    };
  }
  if (status === 'New') {
    return {
      icon: SparklesIcon,
      title: t('cases.portalCaseStatusNew'),
      message: t('cases.portalCaseHintNew'),
      className: 'bg-neutral-50 text-neutral-800 ring-1 ring-neutral-200 dark:bg-neutral-800/60 dark:text-neutral-100 dark:ring-neutral-700'
    };
  }
  if (isPortalCaseClosed(status)) {
    return {
      icon: CheckCircleIcon,
      title: t('cases.portalCaseStatusClosed'),
      message: t('cases.portalCaseHintClosed'),
      className: 'bg-success-50 text-success-900 ring-1 ring-success-200 dark:bg-success-900/20 dark:text-success-100 dark:ring-success-500/30'
    };
  }
  return null;
});

async function loadCase(options = {}) {
  const silent = options.silent === true;
  if (!silent) {
    loading.value = true;
    error.value = null;
  }
  try {
    const res = await getCase(route.params.id);
    if (res.success) {
      const prevCount = activities.value.length;
      caseRecord.value = res.data;
      void markCaseRead(route.params.id);
      if (!silent || activities.value.length > prevCount) {
        conversationRef.value?.scrollToBottom?.();
      }
    } else if (!silent) {
      error.value = res.message || t('cases.portalCasesLoadFailed');
    }
  } catch (err) {
    if (!silent) {
      error.value = err.message || t('cases.portalCasesLoadFailed');
      if (err.status === 404) {
        error.value = t('cases.portalCasesNotFound');
      }
    }
  } finally {
    if (!silent) loading.value = false;
  }
}

function handleCsatSubmitted({ score }) {
  if (!caseRecord.value) return;
  caseRecord.value = {
    ...caseRecord.value,
    csatSubmitted: true,
    csatScore: score
  };
}

async function submitReply() {
  if ((!replyBody.value.trim() && !uploadedAttachments.value.length) || !caseRecord.value?._id) return;
  replying.value = true;
  replyError.value = null;
  try {
    const res = await replyToCase(caseRecord.value._id, {
      body: replyBody.value.trim(),
      subject: `Re: ${caseRecord.value.title || 'Case'}`,
      attachments: uploadedAttachments.value.map((a) => ({ attachmentId: a.attachmentId }))
    });
    if (res.success) {
      capturePortalCaseReplySent({ case_id: String(caseRecord.value._id) });
      replyBody.value = '';
      uploadedAttachments.value = [];
      await loadCase();
    } else {
      replyError.value = res.message || t('cases.portalCasesReplyFailed');
    }
  } catch (err) {
    replyError.value = err.message || t('cases.portalCasesReplyFailed');
  } finally {
    replying.value = false;
  }
}

function removeUploaded(attachmentId) {
  uploadedAttachments.value = uploadedAttachments.value.filter((a) => a.attachmentId !== attachmentId);
}

async function handleFilesSelected(files) {
  if (!allowAttachments.value) return;
  uploading.value = true;
  uploadError.value = null;
  try {
    for (const file of files) {
      const data = await uploadPortalAttachment(file);
      if (!data?.attachmentId) continue;
      uploadedAttachments.value.push(data);
    }
  } catch (err) {
    uploadError.value = err.message || t('cases.portalCasesAttachmentUploadFailed');
  } finally {
    uploading.value = false;
  }
}

async function loadPortalCapabilities() {
  try {
    const res = await portalApiClient.get('/me');
    if (res.success && res.data?.portalCapabilities) {
      allowReplyByCapability.value = res.data.portalCapabilities.allowReply !== false;
      allowAttachments.value = res.data.portalCapabilities.allowAttachments === true;
    }
  } catch {
    allowReplyByCapability.value = true;
  }
}

usePortalCasePolling(() => loadCase({ silent: true }), 30000);

watch(() => route.params.id, () => loadCase());
onMounted(async () => {
  await Promise.all([loadPortalCapabilities(), loadCase()]);
});
</script>
