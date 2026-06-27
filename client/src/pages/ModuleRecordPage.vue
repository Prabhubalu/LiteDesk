<template>
  <div class="module-record-page-root flex w-full min-w-0 flex-1 min-h-0 flex-col overflow-hidden">
    <!-- Deals and tasks use their full-featured pages; all other modules use the generic record page. -->
    <DealRecordPage
      v-if="adapterKey === 'deal'"
      :embed="embed"
      :deal-id="effectiveRecordId"
      @close="$emit('close')"
    />
    <TaskRecordPage
      v-else-if="adapterKey === 'task'"
      :embed="embed"
      :task-id="effectiveRecordId"
      @close="$emit('close')"
    />
    <CaseRecordPage
      v-else-if="adapterKey === 'case'"
      :embed="embed"
      :case-id="effectiveRecordId"
      @close="$emit('close')"
    />
    <ResponseRecordPage
      v-else-if="adapterKey === 'response'"
      :embed="embed"
      :record-id="effectiveRecordId"
      :form-id="effectiveFormId"
      @close="$emit('close')"
    />
    <GenericRecordContent
      v-else
      :module-key="effectiveModuleKey"
      :record-id="effectiveRecordId"
      :embed="embed"
      @close="$emit('close')"
    />
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { computed, defineAsyncComponent } from 'vue';
import { useRoute } from 'vue-router';
import { getRecordAdapterKey } from '@/utils/recordAdapterRegistry';

/** One async chunk per adapter — avoids loading all three for every record route. */
const DealRecordPage = defineAsyncComponent(() => import('@/pages/deals/DealRecordPage.vue'));
const TaskRecordPage = defineAsyncComponent(() => import('@/pages/tasks/TaskRecordPage.vue'));
const CaseRecordPage = defineAsyncComponent(() => import('@/pages/cases/CaseRecordPage.vue'));
const ResponseRecordPage = defineAsyncComponent(() => import('@/pages/responses/ResponseRecordPage.vue'));
const GenericRecordContent = defineAsyncComponent(
  () => import('@/components/record-page/GenericRecordContent.vue')
);

const props = defineProps({
  embed: { type: Boolean, default: false },
  /** When embed, pass record id explicitly; otherwise from route */
  recordId: { type: String, default: null },
  /** When embed, pass module key explicitly (e.g. from QuickPreviewDrawer); otherwise from route */
  moduleKey: { type: String, default: null }
});

const emit = defineEmits(['close']);

const { t } = useI18n();

const route = useRoute();

const effectiveModuleKey = computed(() => {
  if (props.embed && props.moduleKey) return String(props.moduleKey).toLowerCase().trim();
  const meta = route.meta?.moduleKey;
  if (meta) return String(meta).toLowerCase().trim();
  if (route.name === 'deal-detail') return 'deals';
  if (route.name === 'task-detail') return 'tasks';
  if (route.name === 'form-detail') return 'forms';
  const fromParams = route.params?.moduleKey;
  if (fromParams) return String(fromParams).toLowerCase().trim();
  const segment = route.path.split('/').filter(Boolean)[0];
  return segment ? String(segment).toLowerCase().trim() : '';
});

const effectiveRecordId = computed(() => {
  if (props.embed && props.recordId) return props.recordId;
  return route.params?.responseId ?? route.params?.id ?? route.params?.recordId ?? '';
});

const effectiveFormId = computed(() => {
  const name = String(route.name || '');
  if (name === 'form-response-detail' || name === 'audit-form-response-detail') {
    return route.params?.id ?? null;
  }
  const queryFormId = route.query?.formId;
  if (queryFormId) return String(queryFormId);
  return null;
});

const adapterKey = computed(() => getRecordAdapterKey(effectiveModuleKey.value));
</script>
