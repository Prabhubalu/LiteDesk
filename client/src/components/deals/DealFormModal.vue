<template>
  <div class="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-[1000] p-8" @click="$emit('close')">
    <div class="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl" @click.stop>
      <div class="sticky top-0 px-8 py-6 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between z-10">
        <h2 class="text-2xl font-semibold text-gray-900 dark:text-white">{{ isEditing ? 'Edit Deal' : 'New Deal' }}</h2>
        <button @click="$emit('close')" class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-2xl">×</button>
      </div>

      <form @submit.prevent="handleSubmit" class="p-8">
        <!-- Basic Information -->
        <div class="mb-8 pb-8 border-b border-gray-200 dark:border-gray-700 last:border-0">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-6">{{ t('deals.dealFormModalDealInformation') }}</h3>
          
          <div class="grid grid-cols-1 gap-6 mb-6">
            <div class="flex flex-col">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('deals.dealFormModalDealName') }}<span class="text-red-600">*</span>
              </label>
              <input 
                v-model="form.name" 
                type="text" 
                :placeholder="t('deals.dealFormModalEGAcmeCorpCrmImplementation')"
                required
                class="px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              />
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div class="flex flex-col">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('settings.assignRulesCondFieldAmount') }}<span class="text-red-600">*</span>
              </label>
              <div class="relative">
                <span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-400 font-medium pointer-events-none">$</span>
                <input 
                  v-model.number="form.amount" 
                  type="number" 
                  min="0"
                  step="0.01"
                  placeholder="50000"
                  required
                  class="w-full pl-8 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                />
              </div>
            </div>

            <div class="flex flex-col">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('deals.dealFormModalExpectedCloseDate') }}<span class="text-red-600">*</span>
              </label>
              <DatePicker
                v-model="form.expectedCloseDate"
                input-class="px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all cursor-pointer w-full"
              />
            </div>
          </div>

          <!-- Pipeline Selector (if config exists) -->
          <div v-if="pipelines.length > 0" class="mb-6">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('settings.assignRulesCondFieldPipeline') }}</label>
            <select 
              v-model="form.pipeline"
              class="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all cursor-pointer"
            >
              <option :value="null">{{ t('deals.dealFormModalSelectPipeline') }}</option>
              <option v-for="p in pipelines" :key="String(p.key)" :value="p.key">
                {{ p.label }}
              </option>
            </select>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Stage: Primary Control (always editable) -->
            <div class="flex flex-col">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('settings.modFieldsStageLabelFallback') }}<span class="text-red-600">*</span>
                <span class="ml-2 text-xs text-gray-500 dark:text-gray-400 font-normal">(Primary control)</span>
              </label>
              <select 
                :key="'stage-' + (form.pipeline || 'none')"
                v-model="form.stage" 
                required
                class="px-4 py-3 bg-white dark:bg-gray-800 border-2 border-indigo-500 dark:border-indigo-400 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all cursor-pointer font-medium"
              >
                <!-- Stages from selected pipeline only -->
                <template v-if="stages.length > 0">
                  <option v-for="stage in stages" :key="stage" :value="stage">
                    {{ stage }}
                  </option>
                </template>
                <template v-else>
                  <option value="" disabled>{{ pipelines.length && !form.pipeline ? 'Select a pipeline first' : 'Configure stages in Settings' }}</option>
                </template>
              </select>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('deals.dealFormModalChangingStageUpdatesStatusAndProbability') }}</p>
            </div>

            <!-- Probability: Read-only when derivedStatus exists -->
            <div class="flex flex-col">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Probability (%)
                <span v-if="isStatusReadOnly" class="ml-2 text-xs text-gray-500 dark:text-gray-400 italic">
                  (System-owned)
                </span>
              </label>
              <!-- Read-only badge when derivedStatus exists -->
              <div
                v-if="isStatusReadOnly"
                class="px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
              >
                <span class="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-info-50 dark:bg-info-900/20 text-info-700 dark:text-info-300 border border-info-200 dark:border-info-800">
                  {{ form.probability }}%
                </span>
              </div>
              <!-- Editable input (legacy mode when derivedStatus is null) -->
              <input 
                v-else
                v-model.number="form.probability" 
                type="number" 
                min="0"
                max="100"
                placeholder="50"
                class="px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              />
            </div>
          </div>
          
          <!-- Status: Read-only badge when derivedStatus exists -->
          <div v-if="isStatusReadOnly" class="mt-4">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('settings.settingsBhFieldStatus') }}<span class="ml-2 text-xs text-gray-500 dark:text-gray-400 italic">(System-owned)</span>
            </label>
            <div class="px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg">
              <span class="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-info-50 dark:bg-info-900/20 text-info-700 dark:text-info-300 border border-info-200 dark:border-info-800">
                {{ form.status || '—' }}
              </span>
            </div>
          </div>
        </div>

        <!-- Classification -->
        <div class="mb-8 pb-8 border-b border-gray-200 dark:border-gray-700 last:border-0">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-6">{{ t('deals.dealFormModalClassification') }}</h3>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="flex flex-col">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('deals.dealFormModalDealType') }}</label>
              <select 
                v-model="form.type"
                class="px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all cursor-pointer"
              >
                <option value="">{{ t('deals.dealFormModalSelectType') }}</option>
                <option value="New Business">{{ t('deals.dealFormModalNewBusiness') }}</option>
                <option value="Existing Customer">{{ t('deals.dealFormModalExistingCustomer') }}</option>
                <option value="Upsell">{{ t('deals.dealFormModalUpsell') }}</option>
                <option value="Renewal">{{ t('deals.dealFormModalRenewal') }}</option>
                <option value="Cross-Sell">{{ t('deals.dealFormModalCrossSell') }}</option>
              </select>
            </div>

            <div class="flex flex-col">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('settings.modFieldsPriorityLabel') }}</label>
              <select 
                v-model="form.priority"
                class="px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all cursor-pointer"
              >
                <option value="Low">{{ t('settings.helpdeskExecPriorityLow') }}</option>
                <option value="Medium">{{ t('settings.helpdeskExecPriorityMedium') }}</option>
                <option value="High">{{ t('settings.helpdeskExecPriorityHigh') }}</option>
                <option value="Urgent">{{ t('deals.dealFormModalUrgent') }}</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="flex flex-col md:col-span-2">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('deals.dealFormModalTagsCommaSeparated') }}</label>
              <input 
                v-model="tagsString" 
                type="text" 
                :placeholder="t('deals.dealFormModalEnterprisePriorityDemo')"
                class="px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              />
            </div>
          </div>
        </div>

        <!-- Relationships -->
        <div class="mb-8 pb-8 border-b border-gray-200 dark:border-gray-700 last:border-0">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-6">{{ t('settings.modFieldsTabRelationships') }}</h3>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="flex flex-col">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('forms.hubLinkedContact') }}</label>
              <select 
                v-model="form.contactId"
                class="px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all cursor-pointer"
              >
                <option value="">{{ t('deals.dealFormModalSelectContact') }}</option>
                <option v-for="contact in contacts" :key="contact._id" :value="contact._id">
                  {{ contact.first_name }} {{ contact.last_name }} ({{ contact.email }})
                </option>
              </select>
              <p class="text-xs text-gray-600 dark:text-gray-400 mt-2">{{ t('deals.dealFormModalLinkThisDealToAContact') }}</p>
            </div>

            <div class="flex flex-col">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('settings.roleUsersOwner') }}</label>
              <select 
                v-model="form.ownerId"
                class="px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all cursor-pointer"
              >
                <option v-for="user in users" :key="user._id" :value="user._id">
                  {{ user.firstName }} {{ user.lastName }}
                </option>
              </select>
            </div>
          </div>
        </div>

        <!-- Additional Details -->
        <div class="mb-8 pb-8 border-b border-gray-200 dark:border-gray-700 last:border-0">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-6">{{ t('deals.dealFormModalAdditionalDetails') }}</h3>
          
          <div class="grid grid-cols-1 gap-6 mb-6">
            <div class="flex flex-col">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('settings.coreModDetailDescription') }}</label>
              <textarea 
                v-model="form.description" 
                rows="4"
                :placeholder="t('deals.dealFormModalAddDetailsAboutThisDealRequirements')"
                class="px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none"
              ></textarea>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="flex flex-col">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{{ t('deals.dealFormModalNextFollowUpDate') }}</label>
              <DatePicker
                v-model="form.nextFollowUpDate"
                input-class="px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all cursor-pointer w-full"
              />
            </div>
          </div>
        </div>

        <!-- Form Actions -->
        <div class="sticky bottom-0 bg-white dark:bg-gray-900 flex justify-end gap-4 pt-6 mt-6 border-t border-gray-200 dark:border-gray-700">
          <button 
            type="button" 
            @click="$emit('close')" 
            class="px-6 py-3 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >{{ t('performance.cancelWizard') }}</button>
          <button 
            type="submit" 
            :disabled="saving" 
            class="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ saving ? 'Saving...' : (isEditing ? 'Update Deal' : 'Create Deal') }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { ref, computed, watch, onMounted } from 'vue';
import apiClient from '@/utils/apiClient';
import DatePicker from '@/components/common/DatePicker.vue';
import { useAuthStore } from '@/stores/authRegistry';

const props = defineProps({
  deal: {
    type: Object,
    default: null
  }
});

const { t } = useI18n();

const emit = defineEmits(['close', 'saved']);
const authStore = useAuthStore();

const isEditing = computed(() => !!props.deal);
const saving = ref(false);
const contacts = ref([]);
const users = ref([]);
const pipelines = ref([]);
const loadingConfig = ref(false);

// Stages derived strictly from the selected pipeline (form.pipeline = pipeline key)
const stages = computed(() => {
  const pipelineKey = form.value.pipeline;
  if (pipelineKey == null || pipelineKey === '' || !pipelines.value.length) return [];
  const key = String(pipelineKey).trim();
  const pipeline = pipelines.value.find((p) => String(p?.key ?? '').trim() === key);
  if (!pipeline || !Array.isArray(pipeline.stages) || !pipeline.stages.length) return [];
  return pipeline.stages.map((s) => (s.name || '').trim()).filter(Boolean);
});

const form = ref({
  name: '',
  amount: 0,
  expectedCloseDate: '',
  stage: 'New',
  probability: 0,
  type: '',
  priority: 'Medium',
  contactId: '',
  ownerId: authStore.user?._id || '',
  description: '',
  nextFollowUpDate: '',
  tags: [],
  status: 'Open',
  derivedStatus: null, // Track derivedStatus to determine if status/probability is read-only
  pipeline: null
});

const tagsString = ref('');

// Watch for tags string changes
watch(tagsString, (newValue) => {
  form.value.tags = newValue.split(',').map(tag => tag.trim()).filter(tag => tag);
});

// NOTE: Probability is now system-owned when derivedStatus exists
// Backend computes probability from stage config, so we don't auto-update here

// Load deal data if editing
if (props.deal) {
  form.value = {
    ...form.value,
    ...props.deal,
    contactId: props.deal.contactId?._id || '',
    ownerId: props.deal.ownerId?._id || authStore.user?._id,
    expectedCloseDate: props.deal.expectedCloseDate ? new Date(props.deal.expectedCloseDate).toISOString().split('T')[0] : '',
    nextFollowUpDate: props.deal.nextFollowUpDate ? new Date(props.deal.nextFollowUpDate).toISOString().split('T')[0] : '',
    status: props.deal.status || 'Open',
    derivedStatus: props.deal.derivedStatus || null,
    pipeline: props.deal.pipeline || null
  };
  
  if (props.deal.tags && Array.isArray(props.deal.tags)) {
    tagsString.value = props.deal.tags.join(', ');
  }
}

// Check if status/probability should be read-only (when derivedStatus exists)
const isStatusReadOnly = computed(() => {
  return form.value.derivedStatus != null && form.value.derivedStatus !== '';
});

// Fetch contacts for dropdown
const fetchContacts = async () => {
  try {
    const data = await apiClient('/contacts?limit=100', {
      method: 'GET'
    });
    
    if (data.success) {
      contacts.value = data.data;
    }
  } catch (error) {
    console.error('Error fetching contacts:', error);
  }
};

// Fetch users for owner dropdown
const fetchUsers = async () => {
  try {
    const data = await apiClient('/users', {
      method: 'GET'
    });
    
    if (data.success) {
      users.value = data.data;
    }
  } catch (error) {
    console.error('Error fetching users:', error);
    // Fallback to current user
    users.value = [authStore.user];
  }
};

// Fetch pipelines and stages from Settings (deals module pipelineSettings only)
const fetchPipelineConfig = async () => {
  try {
    loadingConfig.value = true;
    const response = await apiClient.get('/modules', { params: { key: 'deals' } });
    if (!response?.success || !Array.isArray(response.data) || !response.data[0]) return;
    const mod = response.data[0];
    const raw = mod.pipelineSettings || [];
    if (raw.length === 0) {
      pipelines.value = [];
      return;
    }
    pipelines.value = raw.map((p) => ({
      key: p.key,
      label: p.name || p.key,
      isDefault: p.isDefault === true,
      stages: Array.isArray(p.stages) ? p.stages : []
    }));
    const defaultPipeline = pipelines.value.find((p) => p.isDefault) || pipelines.value[0];
    // New deal: auto-select default pipeline so stage options are available (stages are computed from form.pipeline)
    if (!props.deal && defaultPipeline && defaultPipeline.stages?.length) {
      form.value.pipeline = defaultPipeline.key;
      const firstStageName = (defaultPipeline.stages[0]?.name || '').trim() || 'New';
      form.value.stage = firstStageName;
      form.value.probability = defaultPipeline.stages[0]?.probability ?? 0;
    }
  } catch (error) {
    console.error('Error fetching pipeline config:', error);
    pipelines.value = [];
  } finally {
    loadingConfig.value = false;
  }
};

const handleSubmit = async () => {
  saving.value = true;
  
  try {
    // Clean up empty values and system-owned fields
    const payload = { ...form.value };
    if (!payload.contactId) delete payload.contactId;
    if (!payload.type) delete payload.type;
    delete payload.source;
    if (!payload.description) delete payload.description;
    if (!payload.nextFollowUpDate) delete payload.nextFollowUpDate;
    
    // Remove system-owned fields when derivedStatus exists (backend will compute them)
    if (payload.derivedStatus != null && payload.derivedStatus !== '') {
      delete payload.status;
      delete payload.probability;
      delete payload.derivedStatus; // Don't send derivedStatus, backend computes it
    }
    
    // Use convenience methods that handle JSON.stringify automatically
    const data = isEditing.value 
      ? await apiClient.put(`/deals/${props.deal._id}`, payload)
      : await apiClient.post('/deals', payload);
    
    if (data.success) {
      emit('saved', data.data);
    }
  } catch (error) {
    console.error('Error saving deal:', error);
    alert(error.message || t('deals.dealFormModalToastFailedToSaveDeal'));
  } finally {
    saving.value = false;
  }
};

onMounted(() => {
  fetchContacts();
  fetchUsers();
  fetchPipelineConfig();
});

// When a pipeline is selected, auto-select the first stage in that pipeline
watch(() => form.value.pipeline, (newPipeline) => {
  if (!newPipeline || !pipelines.value.length) return;
  const pipeline = pipelines.value.find(
    (p) => p.key === newPipeline || p.label === newPipeline
  );
  if (!pipeline?.stages?.length) return;
  const firstStage = pipeline.stages[0];
  form.value.stage = (firstStage?.name || '').trim() || 'New';
  form.value.probability = firstStage?.probability ?? 0;
});

// When the stage is selected, set probability from the pipeline's stage config
watch(() => form.value.stage, (newStage) => {
  if (!newStage || !form.value.pipeline || !pipelines.value.length) return;
  const pipeline = pipelines.value.find(
    (p) => p.key === form.value.pipeline || p.label === form.value.pipeline
  );
  if (!pipeline?.stages?.length) return;
  const stageName = (newStage || '').trim();
  const stageConfig = pipeline.stages.find(
    (s) => (s?.name ?? '').trim() === stageName
  );
  if (stageConfig != null && typeof stageConfig.probability === 'number') {
    form.value.probability = stageConfig.probability;
  } else if (stageConfig != null) {
    form.value.probability = stageConfig?.probability ?? 0;
  }
});
</script>

<!-- All styling now uses pure Tailwind (no scoped CSS needed) -->

