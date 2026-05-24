<template>
  <EmailThreadCard
    v-if="event?.thread"
    :thread="event.thread"
    :compact="true"
    :expanded="ui.expandedTaskEmailThreads.has(event.thread.threadId)"
    :current-user="ui.currentUser"
    :format-date="ui.formatRelativeActivityTime"
    :format-full-date="ui.formatFullTimestamp"
    :on-timestamp-pointer-up="ui.handleTimestampPointerUp"
    @toggle="ui.toggleTaskEmailThread(event.thread.threadId)"
    @create-task="ui.createTaskFromEmailMessage"
    @create-case="ui.createCaseFromEmailMessage"
    @assign-thread="ui.assignEmailThread"
    @unassign-thread="ui.unassignEmailThread"
    @add-tag="ui.addTagToEmailThread"
    @remove-tag="ui.removeTagFromEmailThread"
    @reply="ui.handleReplyToEmailMessage"
    @toggle-done="ui.handleToggleThreadDone"
  />
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import EmailThreadCard from '@/components/communications/EmailThreadCard.vue';

defineProps({
  event: { type: Object, required: true },
  ui: { type: Object, required: true }
});
</script>
