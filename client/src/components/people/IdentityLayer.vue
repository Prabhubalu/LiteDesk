<!--
  ============================================================================
  IDENTITYLAYER CONTRACT
  ============================================================================
  
  IdentityLayer is recognition-only:
  - Displays identity information for recognition purposes
  - No primary actions (edit, delete, etc.)
  - No workflow state (status changes, transitions)
  - No inline editing by default
  
  Purpose: Answer "Who is this person?" through recognition, not action.
  
  GUARDRAILS:
  - Do NOT add primary action buttons
  - Do NOT add workflow state indicators
  - Do NOT add inline editing forms
  - Do NOT add status change controls
  
  Links (email, phone, organization) are informational only, not actions.
  ============================================================================
-->

<template>
  <RecognitionOnly>
    <div class="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow border-2 border-gray-200 dark:border-gray-700 overflow-hidden">
    <!-- Header -->
    <div class="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-b-2 border-gray-200 dark:border-gray-700">
      <div class="flex items-center justify-between">
        <div class="flex-1">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{{ t('settings.roleDrawerIdentity') }}</span>
          </div>
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
            Who is this person?
          </h2>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">{{ t('people.identityLayerRecognitionFirstIdentityInformation') }}</p>
        </div>
        
        <!-- Actions -->
        <div class="flex-shrink-0 ml-4 flex items-center gap-2">
          <button
            v-if="personId"
            @click="handleEmail"
            class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>{{ t('settings.settingsAddFieldTypeEmail') }}</button>
          <button
            @click="handleEditProfile"
            class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>{{ t('people.identityLayerEditProfile') }}</button>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="px-6 py-4">
      <div class="flex items-start gap-6">
        <!-- Avatar -->
        <div class="flex-shrink-0">
          <AvatarInitials
            :firstName="firstName"
            :lastName="lastName"
            :email="email"
            :avatar="avatar"
            size="lg"
          />
        </div>

        <!-- Identity Details -->
        <div class="flex-1 min-w-0">
          <dl class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <!-- Full Name -->
            <div v-if="fullName" class="sm:col-span-2">
              <dt class="text-sm text-gray-500 dark:text-gray-400">{{ t('people.identityLayerFullName') }}</dt>
              <dd class="mt-2 text-lg font-semibold text-gray-900 dark:text-white">
                {{ fullName }}
              </dd>
            </div>

            <!-- Primary Contact (Email) -->
            <LabeledValue
              v-if="email"
              :label="t('settings.settingsAddFieldTypeEmail')"
              :value="email"
            >
              <a :href="`mailto:${email}`" class="text-indigo-600 dark:text-indigo-400 hover:underline">
                {{ email }}
              </a>
            </LabeledValue>

            <!-- Primary Contact (Phone) -->
            <LabeledValue
              v-if="phone"
              :label="t('settings.settingsAddFieldTypePhone')"
              :value="phone"
            >
              <a :href="`tel:${phone}`" class="text-indigo-600 dark:text-indigo-400 hover:underline">
                {{ phone }}
              </a>
            </LabeledValue>

            <!-- Organization -->
            <div v-if="organization" class="sm:col-span-2">
              <dt class="text-sm text-gray-500 dark:text-gray-400">{{ t('settings.profileMetaOrg') }}</dt>
              <dd class="mt-2 text-sm text-gray-900 dark:text-white">
                <button
                  v-if="organizationId"
                  @click="viewOrganization"
                  class="text-indigo-600 dark:text-indigo-400 hover:underline text-left"
                >
                  {{ organization }}
                </button>
                <span v-else>{{ organization }}</span>
              </dd>
            </div>

            <!-- Compliance Flags -->
            <div v-if="doNotContact !== undefined" class="sm:col-span-2">
              <dt class="text-sm text-gray-500 dark:text-gray-400 mb-2">{{ t('forms.reportCompliance') }}</dt>
              <dd class="mt-2">
                <StatusFlag
                  :type="doNotContact ? 'danger' : 'success'"
                  :label="doNotContact ? 'Do Not Contact' : 'Contact Allowed'"
                />
              </dd>
            </div>

            <!-- Tags -->
            <div v-if="tags && tags.length > 0" class="sm:col-span-2">
              <dt class="text-sm text-gray-500 dark:text-gray-400 mb-2">{{ t('settings.assignRulesCondFieldTags') }}</dt>
              <dd class="mt-2">
                <TagList :tags="tags" />
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
    </div>
  </RecognitionOnly>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import RecognitionOnly from '@/components/ui/RecognitionOnly.vue';
import AvatarInitials from '@/components/ui/AvatarInitials.vue';
import LabeledValue from '@/components/ui/LabeledValue.vue';
import StatusFlag from '@/components/ui/StatusFlag.vue';
import TagList from '@/components/ui/TagList.vue';
import { useTabs } from '@/composables/useTabs';
import { computed } from 'vue';

const props = defineProps({
  firstName: {
    type: String,
    default: ''
  },
  lastName: {
    type: String,
    default: ''
  },
  email: {
    type: String,
    default: ''
  },
  phone: {
    type: String,
    default: ''
  },
  mobile: {
    type: String,
    default: ''
  },
  organization: {
    type: [String, Object],
    default: null
  },
  organizationId: {
    type: String,
    default: null
  },
  doNotContact: {
    type: Boolean,
    default: undefined
  },
  tags: {
    type: Array,
    default: () => []
  },
  avatar: {
    type: String,
    default: null
  },
  personId: {
    type: String,
    default: null
  }
});

const { t } = useI18n();

const emit = defineEmits(['edit-profile', 'email']);

// Computed: Full name
const fullName = computed(() => {
  const name = [props.firstName, props.lastName].filter(Boolean).join(' ').trim();
  return name || props.email || 'Person';
});

// Computed: Primary phone (prefer phone over mobile)
const phone = computed(() => {
  return props.phone || props.mobile || '';
});

// Computed: Organization name and ID
const organization = computed(() => {
  if (!props.organization) return null;
  if (typeof props.organization === 'object') {
    return props.organization.name || props.organization._id || null;
  }
  return props.organization;
});

const organizationId = computed(() => {
  if (typeof props.organization === 'object' && props.organization._id) {
    return props.organization._id;
  }
  return props.organizationId || null;
});

// Navigation
const { openTab } = useTabs();

const viewOrganization = () => {
  if (organizationId.value) {
    openTab(`/organizations/${organizationId.value}`, {
      title: organization.value || 'Organization',
      icon: 'building',
      insertAdjacent: true
    });
  }
};

// Edit profile action
const handleEditProfile = () => {
  emit('edit-profile', props.personId);
};

// Email action (opens in-product compose modal)
const handleEmail = () => {
  emit('email', props.personId);
};
</script>

