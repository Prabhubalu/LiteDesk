<script setup lang="ts">
import { computed, ref } from 'vue'
import { sanitizeRichHtml } from '@/utils/richHtml'

const props = defineProps<{
  html?: string | null
  emptyText?: string
}>()

const previewSrc = ref('')

const sanitized = computed(() => sanitizeRichHtml(props.html || ''))
const isEmpty = computed(() => !sanitized.value)

function onClick(event: MouseEvent) {
  const target = event.target
  if (!(target instanceof HTMLImageElement)) return
  const src = target.getAttribute('src') || ''
  if (!src) return
  event.preventDefault()
  previewSrc.value = src
}
</script>

<template>
  <div v-if="isEmpty" class="rich-empty">{{ emptyText || 'No description.' }}</div>
  <div v-else class="rich" v-html="sanitized" @click="onClick" />

  <Teleport to="body">
    <button
      v-if="previewSrc"
      type="button"
      class="lightbox"
      aria-label="Close image"
      @click="previewSrc = ''"
    >
      <img :src="previewSrc" alt="" />
    </button>
  </Teleport>
</template>

<style scoped>
.rich-empty {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.95rem;
  font-style: italic;
}

.rich {
  color: var(--text);
  font-size: 0.95rem;
  line-height: 1.75;
  overflow-wrap: anywhere;
}

.rich :deep(p) {
  margin: 0 0 0.65rem;
}

.rich :deep(p:last-child) {
  margin-bottom: 0;
}

.rich :deep(h1),
.rich :deep(h2),
.rich :deep(h3) {
  margin: 1rem 0 0.4rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.3;
  color: var(--text);
}

.rich :deep(h1) {
  font-size: 1.2rem;
}

.rich :deep(h2) {
  font-size: 1.08rem;
}

.rich :deep(h3) {
  font-size: 1rem;
}

.rich :deep(ul),
.rich :deep(ol) {
  margin: 0.4rem 0 0.75rem;
  padding-left: 1.25rem;
}

.rich :deep(ul) {
  list-style: disc;
}

.rich :deep(ol) {
  list-style: decimal;
}

.rich :deep(li) {
  margin: 0.2rem 0;
  padding-left: 0.15rem;
}

.rich :deep(li > p) {
  margin: 0;
}

.rich :deep(strong),
.rich :deep(b) {
  font-weight: 700;
}

.rich :deep(a) {
  color: var(--accent-strong);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.rich :deep(blockquote) {
  margin: 0.7rem 0;
  padding: 0.55rem 0.75rem;
  border-left: 3px solid var(--border);
  background: var(--bg-soft);
  border-radius: 0 8px 8px 0;
  color: var(--text-muted);
}

.rich :deep(img) {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 0.7rem 0;
  border-radius: 10px;
  cursor: zoom-in;
}

.rich :deep(pre),
.rich :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.85em;
}

.rich :deep(pre) {
  margin: 0.7rem 0;
  padding: 0.75rem;
  overflow-x: auto;
  background: var(--bg-soft);
  border-radius: 10px;
}

.lightbox {
  position: fixed;
  inset: 0;
  z-index: 80;
  margin: 0;
  border: none;
  padding: 1.5rem;
  background: rgba(9, 9, 14, 0.82);
  display: grid;
  place-items: center;
}

.lightbox img {
  max-width: 100%;
  max-height: 100%;
  border-radius: 12px;
}
</style>
