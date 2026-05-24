<template>
  <span class="comment-content break-words">
    <template v-for="(part, i) in parsedParts" :key="i">
      <span
        v-if="part.type === 'mention'"
        class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-200"
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
 * Renders plain text and styled mention spans.
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
  const mentionRegex = /@\[([^\]]+)\]\((user|group):([^)]+)\)/g;
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
    // Add text before this match
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

  // Add remaining text
  if (lastIndex < normalizedContent.length) {
    pushTextWithNewlines(normalizedContent.slice(lastIndex));
  }

  return parts;
});
</script>
