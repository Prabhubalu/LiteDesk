<template>
  <LiveChatLinkedSessionCard :fetch-path="fetchPath" />
</template>

<script setup>
import { computed } from 'vue';
import LiveChatLinkedSessionCard from '@/components/live-chat/LiveChatLinkedSessionCard.vue';

const props = defineProps({
  caseId: { type: String, required: true },
});

const fetchPath = computed(() => `/helpdesk/cases/${props.caseId}/live-chat-session`);
</script>
