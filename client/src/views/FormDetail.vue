<template>
  <div>
    <SummaryView
      :record="formattedForm"
      :record-type="'forms'"
      :loading="loading"
      :error="error"
      :stats="formStats"
      @close="goBack"
      @update="handleUpdate"
      @edit="editForm"
      @delete="showDeleteModal = true"
      @duplicate="duplicateForm"
      @add-relation="handleAddRelation"
      @open-related-record="handleOpenRelatedRecord"
      @record-updated="handleRecordUpdated"
      ref="summaryViewRef"
    />

    <!-- Related Records Panel (Phase 0F.1: Show Responses) -->
    <div v-if="form && !loading && !error" class="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-6">
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ t('forms.hubRelatedRecords') }}</h3>
        <RelatedRecordsPanel
          app-key="PLATFORM"
          module-key="forms"
          :record-id="form._id || route.params.id"
          :read-only="true"
        />
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <DeleteConfirmationModal
      :show="showDeleteModal"
      :record-name="form?.name || ''"
      record-type="forms"
      :deleting="deleting"
      @close="showDeleteModal = false"
      @confirm="deleteForm"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, computed, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useTabs } from '@/composables/useTabs';
import apiClient from '@/utils/apiClient';
import SummaryView from '@/components/common/SummaryView.vue';
import DeleteConfirmationModal from '@/components/common/DeleteConfirmationModal.vue';
import RelatedRecordsPanel from '@/components/relationships/RelatedRecordsPanel.vue';
import { useRecordContext } from '@/composables/useRecordContext';
import { getProjectionTypeLabel, getAppLabel } from '@/utils/projectionLabels';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { findTabByPath, switchToTab, openTab, updateTabTitle, activeTabId, findTabById, closeTab } = useTabs();

const form = ref(null);
const analytics = ref(null);
const loading = ref(false);
const error = ref(null);
const summaryViewRef = ref(null);
const showDeleteModal = ref(false);
const deleting = ref(false);

const { context: recordContext, load: loadRecordContext } = useRecordContext('SALES', 'forms', () => route.params.id);

const projectionTypeLabel = computed(() => {
  if (!recordContext.value?.record?.projection?.currentType) return null;
  const currentType = recordContext.value.record.projection.currentType;
  const appKey = recordContext.value.record.projection.appKey || 'SALES';
  return getProjectionTypeLabel(currentType, appKey);
});

const projectionAppLabel = computed(() => {
  if (!recordContext.value?.record?.projection?.appKey) return null;
  return getAppLabel(recordContext.value.record.projection.appKey);
});

function formStatusLabel(value) {
  const keyByValue = {
    Draft: 'forms.statusDraft',
    Active: 'forms.statusActive',
    Closed: 'forms.statusClosed',
  };
  const key = keyByValue[value];
  return key ? t(key) : value;
}

const formattedForm = computed(() => {
  if (!form.value) return null;

  const sectionsCount = form.value.sections?.length || 0;
  let totalQuestions = 0;
  let scorableQuestionsCount = 0;

  if (form.value.sections) {
    form.value.sections.forEach(section => {
      if (section.questions && Array.isArray(section.questions)) {
        totalQuestions += section.questions.length;
        scorableQuestionsCount += section.questions.filter(q => q.scoring?.enabled || q.scoringLogic?.weightage > 0).length;
      }
      if (section.subsections && Array.isArray(section.subsections)) {
        section.subsections.forEach(subsection => {
          if (subsection.questions && Array.isArray(subsection.questions)) {
            totalQuestions += subsection.questions.length;
            scorableQuestionsCount += subsection.questions.filter(q => q.scoring?.enabled || q.scoringLogic?.weightage > 0).length;
          }
        });
      }
    });
  }

  const typeLabel = projectionTypeLabel.value
    ? (projectionAppLabel.value ? `${projectionTypeLabel.value} (${projectionAppLabel.value})` : projectionTypeLabel.value)
    : (form.value.formType || t('forms.hubTypeFormFallback'));

  const statusLabel = formStatusLabel(form.value.status || 'Draft');

  return {
    ...form.value,
    name: form.value.name || t('forms.hubUntitledForm'),
    subtitle: form.value.description || t('forms.hubSubtitleForm', { typeLabel, status: statusLabel }),
    _sectionsCount: sectionsCount,
    _totalQuestions: totalQuestions,
    _scorableQuestionsCount: scorableQuestionsCount,
    status: form.value.status
  };
});

const formStats = computed(() => {
  if (!form.value || form.value.status !== 'Active') {
    return {};
  }

  return {
    totalResponses: analytics.value?.statistics?.totalResponses || 0,
    avgCompliance: analytics.value?.statistics?.avgCompliance || 0,
    avgRating: analytics.value?.statistics?.avgRating || 0,
    responseRate: analytics.value?.form?.responseRate || 0
  };
});

const fetchForm = async () => {
  loading.value = true;
  error.value = null;

  try {
    const response = await apiClient.get(`/forms/${route.params.id}`);
    if (response.success) {
      form.value = response.data;
    } else {
      error.value = t('forms.hubFormNotFound');
    }
  } catch (err) {
    console.error('Error fetching form:', err);
    error.value = err.message || t('forms.hubLoadFormFailed');
  } finally {
    loading.value = false;
  }
};

const fetchAnalytics = async () => {
  try {
    if (form.value?.status === 'Active') {
      const response = await apiClient.get(`/forms/${route.params.id}/analytics`);
      if (response.success) {
        analytics.value = response.data;
      }
    }
  } catch (err) {
    console.error('Error fetching analytics:', err);
  }
};

const goBack = () => {
  router.push('/forms');
};

const handleUpdate = async (updateData) => {
  try {
    if (form.value) {
      form.value[updateData.field] = updateData.value;
    }

    const response = await apiClient.put(`/forms/${route.params.id}`, {
      [updateData.field]: updateData.value
    });

    if (response.success && response.data && form.value) {
      Object.assign(form.value, response.data);
    }

    if (updateData.onSuccess) {
      await updateData.onSuccess(response.success ? response.data : null);
    }
  } catch (err) {
    console.error('Error updating form:', err);
    fetchForm();
  }
};

const editForm = () => {
  if (!form.value) return;

  if (form.value.status === 'Draft' || form.value.status === 'Ready') {
    const editPath = `/forms/create?editFrom=${form.value._id}`;
    const existingTab = findTabByPath(editPath);

    if (existingTab) {
      switchToTab(existingTab.id);
    } else {
      openTab(editPath, {
        title: t('forms.hubTabEditForm', { name: form.value.name }),
        icon: 'clipboard-document',
        insertAdjacent: true
      });
    }
  }
};

const duplicateForm = () => {
  if (!form.value) return;

  openTab(`/forms/create?duplicateFrom=${form.value._id}`, {
    title: t('forms.hubTabDuplicateForm', { name: form.value.name }),
    icon: 'clipboard-document',
    insertAdjacent: true
  });
};

const deleteForm = async () => {
  deleting.value = true;

  try {
    await apiClient.delete(`/forms/${route.params.id}`);

    showDeleteModal.value = false;

    const currentTabId = activeTabId.value;
    const currentTab = currentTabId ? findTabById(currentTabId) : null;

    const modulePath = '/forms';
    const moduleTab = findTabByPath(modulePath);
    const moduleTitle = t('forms.hubTitle');

    if (moduleTab) {
      switchToTab(moduleTab.id);
      if (moduleTab.title !== moduleTitle) {
        updateTabTitle(moduleTab.id, moduleTitle);
      }
      if (currentTab && currentTab.path !== modulePath) {
        closeTab(currentTab.id);
      }
      await nextTick();
      const refreshPath = `${modulePath}?refresh=${Date.now()}`;
      router.push(refreshPath).then(() => {
        nextTick(() => {
          router.replace(modulePath);
        });
      });
    } else {
      if (currentTab) {
        currentTab.path = modulePath;
        currentTab.title = moduleTitle;
        currentTab.icon = 'clipboard-document';
        currentTab.params = {};
        router.push(modulePath);
      } else {
        openTab(modulePath, {
          title: moduleTitle,
          icon: 'clipboard-document'
        });
      }
    }
  } catch (err) {
    console.error('Error deleting form:', err);
    alert(err.message || t('forms.hubDeleteFormFailed'));
  } finally {
    deleting.value = false;
  }
};

const handleAddRelation = (relationData) => {
  console.log('Add relation:', relationData);
};

const handleOpenRelatedRecord = (relatedRecord) => {
  console.log('Open related record:', relatedRecord);
};

const handleRecordUpdated = (updatedRecord) => {
  if (updatedRecord && form.value) {
    form.value = { ...form.value, ...updatedRecord };
  } else if (updatedRecord) {
    form.value = updatedRecord;
  }
};

onMounted(async () => {
  await fetchForm();
  await fetchAnalytics();
  if (route.params.id) {
    await loadRecordContext();
  }
});
</script>
