<template>
  <div class="flex h-full flex-col">
    <div class="record-context-panel__header flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
      <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('cases.recordSideThread') }}</h2>
    </div>
    <ul class="flex-1 space-y-2 overflow-y-auto p-4">
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
      <li v-if="!participants.length" class="py-8 text-center text-xs text-gray-500 dark:text-gray-400">
        {{ t('cases.recordSideNoParticipants') }}
      </li>
    </ul>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import Avatar from '@/components/common/Avatar.vue';

const props = defineProps({
  caseRecord: { type: Object, default: null }
});

defineEmits(['open-path']);

const { t } = useI18n();

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
