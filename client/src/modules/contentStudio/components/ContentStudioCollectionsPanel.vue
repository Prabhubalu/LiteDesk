<template>
  <div class="space-y-3">
    <form class="space-y-2" @submit.prevent="handleCreate">
      <input
        v-model="newName"
        type="text"
        :class="ui.input"
        :placeholder="t('contentStudio.collectionNamePlaceholder')"
      />
      <input
        v-model="newEmoji"
        type="text"
        maxlength="8"
        :class="ui.input"
        :placeholder="t('contentStudio.collectionEmojiPlaceholder')"
      />
      <select v-model="newParentId" :class="ui.input">
        <option value="">{{ t('contentStudio.noParentCollection') }}</option>
        <option v-for="collection in flatCollections" :key="collection._id" :value="collection._id">
          {{ collectionLabel(collection) }}
        </option>
      </select>
      <button type="submit" :class="[ui.btnSecondary, 'w-full']" :disabled="creating || !newName.trim()">
        {{ t('contentStudio.createCollection') }}
      </button>
    </form>

    <p v-if="loading" class="text-sm text-neutral-500">{{ t('states.loading') }}</p>
    <ul v-else class="max-h-48 space-y-2 overflow-y-auto">
      <li
        v-for="collection in flatCollections"
        :key="collection._id"
        class="rounded-lg border border-neutral-200 px-3 py-2 dark:border-neutral-700"
        :style="{ marginLeft: `${collection.depth * 12}px` }"
      >
        <p class="text-sm font-medium text-neutral-900 dark:text-neutral-100">
          <span v-if="collection.emoji" class="mr-1.5" aria-hidden="true">{{ collection.emoji }}</span>{{ collection.name }}
        </p>
        <p v-if="collection.description" class="mt-0.5 text-xs text-neutral-500">{{ collection.description }}</p>
        <p class="mt-1 font-mono text-[11px] text-neutral-400">/{{ collection.slug }}</p>
      </li>
    </ul>
    <p v-if="!loading && !flatCollections.length" class="text-sm text-neutral-500">{{ t('contentStudio.emptyCollections') }}</p>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useBuilderUi } from '@/composables/useBuilderUi';
import { createArticleCollection, listArticleCollections } from '../services/contentStudioApi';

const emit = defineEmits(['created']);

const { t } = useI18n();
const ui = useBuilderUi();

const loading = ref(true);
const creating = ref(false);
const collections = ref([]);
const newName = ref('');
const newEmoji = ref('');
const newParentId = ref('');

function buildCollectionTree(rows) {
  const byParent = new Map();
  for (const row of rows) {
    const parentId = row.parentId ? String(row.parentId) : '';
    if (!byParent.has(parentId)) byParent.set(parentId, []);
    byParent.get(parentId).push(row);
  }
  function walk(parentId, depth = 0) {
    const children = byParent.get(parentId) || [];
    return children.flatMap((row) => [{ ...row, depth }, ...walk(String(row._id), depth + 1)]);
  }
  return walk('');
}

const flatCollections = computed(() => buildCollectionTree(collections.value));

function collectionLabel(collection) {
  const depth = Number(collection.depth || 0);
  return `${'— '.repeat(depth)}${collection.name}`;
}

async function loadCollections() {
  loading.value = true;
  try {
    collections.value = await listArticleCollections();
  } finally {
    loading.value = false;
  }
}

async function handleCreate() {
  const name = newName.value.trim();
  if (!name) return;
  creating.value = true;
  try {
    await createArticleCollection({
      name,
      emoji: newEmoji.value.trim() || undefined,
      parentId: newParentId.value || null,
    });
    newName.value = '';
    newEmoji.value = '';
    newParentId.value = '';
    await loadCollections();
    emit('created');
  } finally {
    creating.value = false;
  }
}

onMounted(() => {
  void loadCollections();
});
</script>
