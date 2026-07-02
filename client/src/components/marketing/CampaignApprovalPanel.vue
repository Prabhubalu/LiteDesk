<template>
  <section class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ t('marketing.campaignsApprovalTitle') }}
        </h2>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {{ t('marketing.campaignsApprovalDescription') }}
        </p>
      </div>
      <BadgeCell
        :value="formatApprovalStatus(campaign.approvalStatus)"
        :variant="approvalVariantMap[campaign.approvalStatus] || 'default'"
      />
    </div>

    <div v-if="canSubmit" class="mb-6 space-y-3 rounded-lg border border-dashed border-gray-300 p-4 dark:border-gray-600">
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">
        {{ t('marketing.campaignsApprovalReviewersLabel') }}
      </label>
      <select
        v-model="selectedReviewerIds"
        multiple
        class="min-h-[6rem] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
      >
        <option v-for="user in users" :key="user._id" :value="String(user._id)">
          {{ userLabel(user) }}
        </option>
      </select>
      <textarea
        v-model="submitComment"
        rows="2"
        :placeholder="t('marketing.campaignsApprovalCommentPlaceholder')"
        class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
      />
      <button
        type="button"
        class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        :disabled="submitting || !selectedReviewerIds.length"
        @click="handleSubmit"
      >
        {{ submitting ? t('states.saving') : t('marketing.campaignsApprovalSubmitAction') }}
      </button>
    </div>

    <div v-if="canReview" class="mb-6 space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
      <textarea
        v-model="reviewComment"
        rows="2"
        :placeholder="t('marketing.campaignsApprovalReviewCommentPlaceholder')"
        class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
      />
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          :disabled="reviewing"
          @click="handleApprove"
        >
          {{ reviewing ? t('states.saving') : t('marketing.campaignsApprovalApproveAction') }}
        </button>
        <button
          type="button"
          class="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-950/30"
          :disabled="reviewing"
          @click="handleReject"
        >
          {{ t('marketing.campaignsApprovalRejectAction') }}
        </button>
      </div>
    </div>

    <div v-if="!isApproved && canSend && isSendable" class="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
      {{ t('marketing.campaignsApprovalSendBlocked') }}
    </div>

    <div v-if="history.length">
      <h3 class="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
        {{ t('marketing.campaignsApprovalHistoryTitle') }}
      </h3>
      <ul class="space-y-3">
        <li
          v-for="entry in history"
          :key="entry._id || `${entry.action}-${entry.at}`"
          class="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700"
        >
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="font-medium text-gray-900 dark:text-white">
              {{ formatHistoryAction(entry.action) }}
            </span>
            <span class="text-xs text-gray-500 dark:text-gray-400">
              {{ formatDate(entry.at) }}
            </span>
          </div>
          <p v-if="entry.comment" class="mt-1 text-gray-600 dark:text-gray-300">{{ entry.comment }}</p>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import { fetchUsersListCached } from '@/utils/recordLookupCache';
import { captureMarketingCampaignApprovalSubmitted } from '@/config/posthogMarketing';

const props = defineProps({
  campaign: { type: Object, required: true },
  currentUserId: { type: String, default: '' },
  canEdit: { type: Boolean, default: false },
  canApprove: { type: Boolean, default: false },
  canSend: { type: Boolean, default: false },
  isSendable: { type: Boolean, default: false },
  submitting: { type: Boolean, default: false },
  reviewing: { type: Boolean, default: false }
});

const emit = defineEmits(['submit', 'approve', 'reject']);

const { t } = useI18n();
const users = ref([]);
const selectedReviewerIds = ref([]);
const submitComment = ref('');
const reviewComment = ref('');

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

const historyActionKeys = {
  submitted: 'marketing.campaignsApprovalActionSubmitted',
  approved: 'marketing.campaignsApprovalActionApproved',
  rejected: 'marketing.campaignsApprovalActionRejected',
  content_updated: 'marketing.campaignsApprovalActionContentUpdated'
};

const isApproved = computed(() => props.campaign?.approvalStatus === 'approved');
const canSubmit = computed(() =>
  props.canEdit
  && ['none', 'rejected'].includes(props.campaign?.approvalStatus)
  && ['draft', 'scheduled'].includes(props.campaign?.status)
);
const canReview = computed(() => {
  if (props.campaign?.approvalStatus !== 'pending_review') return false;
  if (props.canApprove) return true;
  const uid = String(props.currentUserId || '');
  return (props.campaign?.reviewers || []).some((reviewer) => String(reviewer.userId) === uid);
});
const history = computed(() =>
  [...(props.campaign?.approvalHistory || [])].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
  )
);

function formatApprovalStatus(value) {
  const key = approvalLabelKeys[value];
  return key ? t(key) : String(value || 'none');
}

function formatHistoryAction(action) {
  const key = historyActionKeys[action];
  return key ? t(key) : String(action || '');
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function userLabel(user) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || user.email || user.username || user._id;
}

async function loadUsers() {
  try {
    const response = await fetchUsersListCached({ limit: 500 });
    users.value = Array.isArray(response?.data) ? response.data : [];
  } catch {
    users.value = [];
  }
}

function handleSubmit() {
  emit('submit', {
    reviewerIds: [...selectedReviewerIds.value],
    comment: submitComment.value.trim()
  });
  captureMarketingCampaignApprovalSubmitted({ campaign_id: props.campaign?._id });
}

function handleApprove() {
  emit('approve', { comment: reviewComment.value.trim() });
}

function handleReject() {
  emit('reject', { comment: reviewComment.value.trim() });
}

watch(
  () => props.campaign?.reviewers,
  (reviewers) => {
    selectedReviewerIds.value = (reviewers || [])
      .map((reviewer) => String(reviewer.userId))
      .filter(Boolean);
  },
  { immediate: true }
);

onMounted(() => {
  void loadUsers();
});
</script>
