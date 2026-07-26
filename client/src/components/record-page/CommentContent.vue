<template>
  <span class="comment-content break-words">
    <template v-for="(part, i) in parsedParts" :key="i">
      <button
        v-if="part.type === 'mention' && part.entityType === 'agent'"
        type="button"
        class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap
          bg-violet-100 text-violet-800 hover:bg-violet-200 dark:bg-violet-900/40 dark:text-violet-200 dark:hover:bg-violet-900/60"
        :title="t('liveChat.inAppAiAskWithAgent', { name: part.name })"
        @click="onAgentMentionClick(part)"
      >
        @{{ part.name }}
      </button>
      <span
        v-else-if="part.type === 'mention' && part.entityType === 'all'"
        class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
      >
        @{{ part.name }}
      </span>
      <span
        v-else-if="part.type === 'mention'"
        class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200"
      >
        @{{ part.name }}
      </span>
      <br v-else-if="part.type === 'newline'" />
      <template v-else>{{ part.text }}</template>
    </template>
  </span>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { computed } from 'vue';

/**
 * Parses comment content that may contain @mentions in format: @[Name](type:id)
 * Renders plain text and styled mention spans. Agent mentions open Astra.
 */
const props = defineProps({
  content: {
    type: String,
    default: ''
  }
});

const { t } = useI18n();

const parsedParts = computed(() => {
  if (!props.content) return [];
  const normalizedContent = String(props.content).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const parts = [];
  const mentionRegex = /@\[([^\]]+)\]\((user|group|agent|all):([^)]+)\)/g;
  let lastIndex = 0;
  let match;

  const pushTextWithNewlines = (text) => {
    if (!text) return;
    const segments = text.split('\n');
    segments.forEach((segment, idx) => {
      if (segment) {
        parts.push({ type: 'text', text: segment });
      }
      if (idx < segments.length - 1) {
        parts.push({ type: 'newline' });
      }
    });
  };

  while ((match = mentionRegex.exec(normalizedContent)) !== null) {
    if (match.index > lastIndex) {
      pushTextWithNewlines(normalizedContent.slice(lastIndex, match.index));
    }
    parts.push({
      type: 'mention',
      name: match[1],
      entityType: match[2],
      id: match[3]
    });
    lastIndex = mentionRegex.lastIndex;
  }

  if (lastIndex < normalizedContent.length) {
    pushTextWithNewlines(normalizedContent.slice(lastIndex));
  }

  return parts;
});

function onAgentMentionClick(part) {
  const name = String(part?.name || '').trim();
  if (!name) return;
  window.dispatchEvent(new CustomEvent('arivu:open-assistant', {
    detail: {
      prompt: `@${name}`,
      agentId: String(part?.id || '').trim() || undefined,
      autoAsk: true,
    },
  }));
}
</script>
