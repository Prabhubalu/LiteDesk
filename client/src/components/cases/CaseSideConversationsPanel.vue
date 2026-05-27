<template>
  <aside
    class="flex w-72 shrink-0 flex-col border-l border-gray-200 bg-gray-50/90 dark:border-gray-700 dark:bg-gray-900/80"
  >
    <div class="border-b border-gray-200 px-3 py-2 dark:border-gray-700">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
        {{ t('cases.recordSideConversations') }}
      </h3>
      <div class="mt-2 flex gap-1 rounded-lg bg-gray-200/80 p-0.5 dark:bg-gray-800">
        <button
          v-for="tab in sideTabs"
          :key="tab.id"
          type="button"
          class="flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors"
          :class="
            activeSideTab === tab.id
              ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
              : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
          "
          @click="activeSideTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- Thread tab -->
    <div v-if="activeSideTab === 'thread'" class="flex min-h-0 flex-1 flex-col">
      <ul class="flex-1 overflow-y-auto p-3 space-y-2">
        <li
          v-for="person in participants"
          :key="person.id"
          class="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2 py-2 dark:border-gray-700 dark:bg-gray-800"
        >
          <button
            type="button"
            class="flex min-w-0 flex-1 items-center gap-2 text-left"
            :disabled="!person.path"
            @click="person.path && $emit('open-path', person.path)"
          >
            <Avatar :user="person.user" size="sm" />
            <div class="min-w-0">
              <p class="truncate text-sm font-medium text-gray-900 dark:text-white">{{ person.name }}</p>
              <p class="text-[11px] text-gray-500 dark:text-gray-400">{{ person.role }}</p>
            </div>
          </button>
        </li>
        <li v-if="!participants.length" class="py-6 text-center text-xs text-gray-500 dark:text-gray-400">
          {{ t('cases.recordSideNoParticipants') }}
        </li>
      </ul>
    </div>

    <!-- Email tab -->
    <div v-else-if="activeSideTab === 'email'" class="flex min-h-0 flex-1 flex-col">
      <div class="border-b border-gray-200 px-3 py-2 dark:border-gray-700">
        <button
          type="button"
          class="w-full rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
          @click="$emit('compose-email')"
        >
          {{ t('cases.recordSideComposeEmail') }}
        </button>
      </div>
      <div v-if="emailThreadsLoading" class="flex flex-1 items-center justify-center py-8">
        <span class="inline-block h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
      <ul v-else-if="emailThreads.length" class="flex-1 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-700">
        <li v-for="thread in emailThreads" :key="thread.threadId">
          <button
            type="button"
            class="w-full px-3 py-2.5 text-left hover:bg-white dark:hover:bg-gray-800"
            @click="$emit('open-email-thread', thread)"
          >
            <p class="truncate text-xs font-medium text-gray-900 dark:text-white">
              {{ thread.subject || t('cases.recordSideNoSubject') }}
            </p>
            <p class="mt-0.5 truncate text-[11px] text-gray-500 dark:text-gray-400">
              {{ thread.participantDisplay || thread.preview || '' }}
            </p>
          </button>
        </li>
      </ul>
      <p v-else class="flex-1 p-4 text-center text-xs text-gray-500 dark:text-gray-400">
        {{ t('cases.recordSideNoEmails') }}
      </p>
    </div>

    <!-- Child cases tab -->
    <div v-else class="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
      <p class="mb-2 text-xs text-gray-500 dark:text-gray-400">{{ t('cases.recordSideChildHint') }}</p>
      <RelatedRecordsPanel
        v-if="caseRecord?._id"
        app-key="HELPDESK"
        module-key="cases"
        :record-id="caseRecord._id"
      />
    </div>
  </aside>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import Avatar from '@/components/common/Avatar.vue';
import RelatedRecordsPanel from '@/components/relationships/RelatedRecordsPanel.vue';

const props = defineProps({
  caseRecord: { type: Object, default: null },
  emailThreads: { type: Array, default: () => [] },
  emailThreadsLoading: { type: Boolean, default: false }
});

defineEmits(['compose-email', 'open-email-thread', 'open-path']);

const { t } = useI18n();
const activeSideTab = ref('thread');

const sideTabs = computed(() => [
  { id: 'thread', label: t('cases.recordSideThread') },
  { id: 'email', label: t('cases.recordSideEmail') },
  { id: 'child', label: t('cases.recordSideChild') }
]);

const participants = computed(() => {
  const list = [];
  const row = props.caseRecord;
  if (!row) return list;

  const owner = row.caseOwnerId;
  if (owner && typeof owner === 'object') {
    list.push({
      id: `owner-${owner._id}`,
      name: [owner.firstName, owner.lastName].filter(Boolean).join(' ').trim() || owner.email,
      role: t('cases.recordRoleOwner'),
      user: owner,
      path: null
    });
  }

  const contact = row.contactId;
  if (contact && typeof contact === 'object') {
    list.push({
      id: `contact-${contact._id}`,
      name: [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim() || contact.email,
      role: t('cases.recordRoleCustomer'),
      user: {
        firstName: contact.first_name || contact.name,
        lastName: contact.last_name,
        email: contact.email
      },
      path: contact._id ? `/people/${contact._id}` : null
    });
  }

  const org = row.organizationRefId;
  if (org && typeof org === 'object' && org._id) {
    list.push({
      id: `org-${org._id}`,
      name: org.name || 'Organization',
      role: t('cases.recordRoleOrganization'),
      user: { firstName: org.name, lastName: '' },
      path: `/organizations/${org._id}`
    });
  }

  return list;
});
</script>
