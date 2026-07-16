<template>
  <aside class="flex w-80 shrink-0 flex-col border-l border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
    <TabGroup
      as="div"
      class="flex h-full min-h-0 flex-col overflow-hidden"
      :selected-index="selectedTabIndex"
      @change="onTabChange"
    >
      <TabList :class="ui.inspectorTabList">
        <Tab
          v-for="tab in tabs"
          :key="tab.id"
          v-slot="{ selected }"
          :class="[ui.inspectorTab, selected ? ui.inspectorTabActive : ui.inspectorTabIdle]"
        >
          {{ t(tab.labelKey) }}
        </Tab>
      </TabList>

      <TabPanels class="flex min-h-0 flex-1 flex-col overflow-hidden">
        <TabPanel :class="ui.tabPanel" :unmount="false">
          <div class="space-y-1">
            <BuilderDisclosureSection
              :title="t('contentStudio.sectionDocumentAppearance')"
              :default-open="true"
              :bordered="false"
            >
              <div class="space-y-3">
                <div>
                  <label class="mb-1 block" :class="ui.label">{{ t('contentStudio.fieldCoverPosition') }}</label>
                  <BuilderSelect
                    :model-value="coverPosition"
                    :options="coverPositionOptions"
                    @update:model-value="emit('update:coverPosition', $event)"
                  />
                </div>

                <div
                  v-if="coverPosition === 'above-title'"
                  class="flex items-start justify-between gap-3 rounded-lg border border-neutral-200 px-3 py-2.5 dark:border-neutral-700"
                >
                  <span class="text-sm text-neutral-700 dark:text-neutral-300">
                    {{ t('contentStudio.fieldTitleOverlapCover') }}
                  </span>
                  <HeadlessSwitch
                    :model-value="titleOverlapCover"
                    size="sm"
                    @update:model-value="emit('update:titleOverlapCover', $event)"
                  />
                </div>

                <div>
                  <label class="mb-1 block" :class="ui.label">{{ t('contentStudio.fieldSubtitleSize') }}</label>
                  <BuilderSelect
                    :model-value="subtitleSize"
                    :options="subtitleSizeOptions"
                    @update:model-value="emit('update:subtitleSize', $event)"
                  />
                </div>

                <div>
                  <label class="mb-1 block" :class="ui.label">{{ t('contentStudio.fieldHeadingColor') }}</label>
                  <div class="mt-1 flex items-center gap-2">
                    <input
                      :value="headingColor || '#111827'"
                      type="color"
                      class="h-9 w-11 cursor-pointer rounded-md border border-neutral-200 bg-white p-0.5 dark:border-neutral-700 dark:bg-neutral-950"
                      @input="emit('update:headingColor', $event.target.value)"
                    />
                    <input
                      :value="headingColor"
                      type="text"
                      :class="[ui.input, 'flex-1']"
                      placeholder="#111827"
                      @input="emit('update:headingColor', $event.target.value)"
                    />
                  </div>
                </div>

                <div>
                  <label class="mb-1 block" :class="ui.label">{{ t('contentStudio.fieldSubheadingColor') }}</label>
                  <div class="mt-1 flex items-center gap-2">
                    <input
                      :value="subheadingColor || '#4b5563'"
                      type="color"
                      class="h-9 w-11 cursor-pointer rounded-md border border-neutral-200 bg-white p-0.5 dark:border-neutral-700 dark:bg-neutral-950"
                      @input="emit('update:subheadingColor', $event.target.value)"
                    />
                    <input
                      :value="subheadingColor"
                      type="text"
                      :class="[ui.input, 'flex-1']"
                      placeholder="#4b5563"
                      @input="emit('update:subheadingColor', $event.target.value)"
                    />
                  </div>
                </div>
              </div>
            </BuilderDisclosureSection>

            <BuilderDisclosureSection :title="t('contentStudio.sectionDocumentPublishing')">
              <div class="space-y-3">
                <div>
                  <label class="mb-1 block" :class="ui.label">{{ t('contentStudio.fieldVisibility') }}</label>
                  <BuilderSelect
                    :model-value="visibility"
                    :options="visibilitySelectOptions"
                    @update:model-value="emit('update:visibility', $event)"
                  />
                  <p
                    v-if="showHeadlessVisibilityHint"
                    class="mt-2 text-xs text-amber-700 dark:text-amber-300"
                  >
                    {{ mode === 'blog' ? t('contentStudio.visibilityPublicHeadlessHintPost') : t('contentStudio.visibilityPublicHeadlessHint') }}
                  </p>
                </div>

                <div
                  v-if="mode === 'articles' || mode === 'blog'"
                  class="flex items-start justify-between gap-3 rounded-lg border border-neutral-200 px-3 py-2.5 dark:border-neutral-700"
                >
                  <span class="min-w-0">
                    <span class="block text-sm font-medium text-neutral-800 dark:text-neutral-200">
                      {{ mode === 'blog' ? t('contentStudio.fieldFeaturedPost') : t('contentStudio.fieldFeatured') }}
                    </span>
                    <span class="mt-0.5 block text-xs text-neutral-500 dark:text-neutral-400">
                      {{ mode === 'blog' ? t('contentStudio.fieldFeaturedHintPost') : t('contentStudio.fieldFeaturedHint') }}
                    </span>
                  </span>
                  <HeadlessSwitch
                    :model-value="featured"
                    size="sm"
                    switch-class="mt-0.5"
                    @update:model-value="emit('update:featured', $event)"
                  />
                </div>

                <div
                  v-if="mode === 'blog'"
                  class="flex items-start justify-between gap-3 rounded-lg border border-neutral-200 px-3 py-2.5 dark:border-neutral-700"
                >
                  <span class="min-w-0">
                    <span class="block text-sm font-medium text-neutral-800 dark:text-neutral-200">
                      {{ t('contentStudio.fieldSticky') }}
                    </span>
                    <span class="mt-0.5 block text-xs text-neutral-500 dark:text-neutral-400">
                      {{ t('contentStudio.fieldStickyHint') }}
                    </span>
                  </span>
                  <HeadlessSwitch
                    :model-value="sticky"
                    size="sm"
                    switch-class="mt-0.5"
                    @update:model-value="emit('update:sticky', $event)"
                  />
                </div>

                <div v-if="mode === 'blog'">
                  <label class="mb-1 block" :class="ui.label">{{ t('contentStudio.fieldTags') }}</label>
                  <input
                    :value="tagsInput"
                    type="text"
                    :class="ui.input"
                    :placeholder="t('contentStudio.fieldTagsPlaceholder')"
                    @input="onTagsInput"
                  />
                  <p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    {{ t('contentStudio.fieldTagsHint') }}
                  </p>
                </div>

                <div>
                  <label class="mb-1 block" :class="ui.label">{{ t('contentStudio.fieldAuthorName') }}</label>
                  <BuilderSelect
                    :model-value="authorId"
                    :options="authorSelectOptions"
                    :disabled="usersLoading"
                    @update:model-value="handleAuthorSelect"
                  />
                </div>

                <div>
                  <label class="mb-1 block" :class="ui.label">{{ t('contentStudio.fieldSummary') }}</label>
                  <textarea
                    :value="summary"
                    rows="3"
                    :class="ui.input"
                    @input="emit('update:summary', $event.target.value)"
                  />
                </div>

                <div>
                  <label class="mb-1 block" :class="ui.label">{{ t('contentStudio.fieldSlug') }}</label>
                  <input
                    :value="slug"
                    type="text"
                    :class="ui.input"
                    @input="emit('update:slug', $event.target.value)"
                  />
                </div>
              </div>
            </BuilderDisclosureSection>

            <BuilderDisclosureSection :title="t('contentStudio.sectionDocumentSeo')">
              <div class="space-y-3">
                <div>
                  <label class="mb-1 block" :class="ui.label">{{ t('contentStudio.fieldMetaTitle') }}</label>
                  <input
                    :value="seoMetaTitle"
                    type="text"
                    :class="ui.input"
                    @input="emit('update:seoMetaTitle', $event.target.value)"
                  />
                </div>
                <div>
                  <label class="mb-1 block" :class="ui.label">{{ t('contentStudio.fieldMetaDescription') }}</label>
                  <textarea
                    :value="seoMetaDescription"
                    rows="4"
                    :class="ui.input"
                    @input="emit('update:seoMetaDescription', $event.target.value)"
                  />
                </div>
              </div>
            </BuilderDisclosureSection>
          </div>
        </TabPanel>

        <TabPanel class="min-h-0 flex-1 overflow-y-auto focus:outline-none" :unmount="false">
          <ContentStudioBlockInspector
            :editor="editor"
            :active-block-type="activeBlockType"
            :selection-revision="selectionRevision"
            :block-anchor-id="blockAnchorId"
            :block-css-class="blockCssClass"
            @update:block-attributes="emit('update:blockAttributes', $event)"
            @structure-change="emit('structure-change')"
            @request-image-upload="emit('request-image-upload', $event)"
          />
        </TabPanel>
      </TabPanels>
    </TabGroup>
  </aside>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/vue';
import { useBuilderUi } from '@/composables/useBuilderUi';
import { fetchUsersListCached } from '@/utils/recordLookupCache';
import HeadlessSwitch from '@/components/ui/HeadlessSwitch.vue';
import BuilderDisclosureSection from '@/modules/template/components/BuilderDisclosureSection.vue';
import BuilderSelect from '@/modules/template/components/BuilderSelect.vue';
import ContentStudioBlockInspector from './ContentStudioBlockInspector.vue';

function formatUserLabel(user) {
  const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
  return fullName || user?.username || user?.email || String(user?._id || user?.id || '');
}

const props = defineProps({
  editor: { type: Object, default: null },
  mode: { type: String, default: 'articles' },
  activeBlockType: { type: String, default: 'paragraph' },
  selectionRevision: { type: Number, default: 0 },
  summary: { type: String, default: '' },
  slug: { type: String, default: '' },
  visibility: { type: String, default: 'portal' },
  featured: { type: Boolean, default: false },
  sticky: { type: Boolean, default: false },
  tags: { type: Array, default: () => [] },
  authorId: { type: String, default: '' },
  authorName: { type: String, default: '' },
  seoMetaTitle: { type: String, default: '' },
  seoMetaDescription: { type: String, default: '' },
  coverPosition: { type: String, default: 'below-title' },
  titleOverlapCover: { type: Boolean, default: false },
  subtitleSize: { type: String, default: 'md' },
  headingColor: { type: String, default: '' },
  subheadingColor: { type: String, default: '' },
  blockAnchorId: { type: String, default: '' },
  blockCssClass: { type: String, default: '' },
});

const emit = defineEmits([
  'update:summary',
  'update:slug',
  'update:visibility',
  'update:featured',
  'update:sticky',
  'update:tags',
  'update:authorId',
  'update:authorName',
  'update:seoMetaTitle',
  'update:seoMetaDescription',
  'update:coverPosition',
  'update:titleOverlapCover',
  'update:subtitleSize',
  'update:headingColor',
  'update:subheadingColor',
  'update:blockAttributes',
  'structure-change',
  'request-image-upload',
]);

const { t } = useI18n();
const ui = useBuilderUi();
const selectedTabIndex = ref(0);
const usersLoading = ref(false);
const userOptions = ref([]);

const tagsInput = computed(() => (Array.isArray(props.tags) ? props.tags.join(', ') : ''));

function parseTagsInput(value) {
  return String(value || '')
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 20);
}

function onTagsInput(event) {
  emit('update:tags', parseTagsInput(event?.target?.value));
}

const tabs = [
  { id: 'document', labelKey: 'contentStudio.tabDocument' },
  { id: 'block', labelKey: 'contentStudio.tabBlock' },
];

function onTabChange(index) {
  selectedTabIndex.value = index;
}

watch(
  () => props.activeBlockType,
  (type) => {
    if (type === 'table') selectedTabIndex.value = 1;
  },
);

const coverPositionOptions = computed(() => [
  { value: 'below-title', label: t('contentStudio.coverPositionBelowTitle') },
  { value: 'above-title', label: t('contentStudio.coverPositionAboveTitle') },
]);

const subtitleSizeOptions = computed(() => [
  { value: 'sm', label: t('contentStudio.subtitleSizeSmall') },
  { value: 'md', label: t('contentStudio.subtitleSizeMedium') },
  { value: 'lg', label: t('contentStudio.subtitleSizeLarge') },
  { value: 'xl', label: t('contentStudio.subtitleSizeExtraLarge') },
]);

const visibilitySelectOptions = computed(() => {
  if (props.mode === 'blog') {
    return [
      { value: 'internal', label: t('contentStudio.visibilityInternal') },
      { value: 'public', label: t('contentStudio.visibilityPublic') },
    ];
  }
  return [
    { value: 'internal', label: t('contentStudio.visibilityInternal') },
    { value: 'portal', label: t('contentStudio.visibilityPortal') },
    { value: 'public', label: t('contentStudio.visibilityPublic') },
    { value: 'private', label: t('contentStudio.visibilityPrivate') },
  ];
});

const orphanAuthorOption = computed(() => {
  const selectedId = String(props.authorId || '').trim();
  if (!selectedId) return null;
  if (userOptions.value.some((user) => user.id === selectedId)) return null;
  return {
    value: selectedId,
    label: props.authorName || selectedId,
  };
});

const authorSelectOptions = computed(() => {
  const options = userOptions.value.map((user) => ({
    value: user.id,
    label: user.label,
  }));
  if (orphanAuthorOption.value) {
    return [orphanAuthorOption.value, ...options];
  }
  return options;
});

function handleAuthorSelect(nextId) {
  const id = String(nextId || '');
  const selected = authorSelectOptions.value.find((user) => user.value === id);
  emit('update:authorId', id);
  emit('update:authorName', selected?.label || props.authorName || '');
}

async function loadUsers() {
  usersLoading.value = true;
  try {
    const response = await fetchUsersListCached({ limit: 500 });
    let rows = [];
    if (Array.isArray(response)) {
      rows = response;
    } else if (response?.success && Array.isArray(response.data)) {
      rows = response.data;
    } else if (Array.isArray(response?.data)) {
      rows = response.data;
    }
    userOptions.value = rows
      .filter((user) => user && user.status !== 'inactive')
      .map((user) => ({
        id: String(user._id || user.id || ''),
        label: formatUserLabel(user),
      }))
      .filter((user) => user.id)
      .sort((a, b) => a.label.localeCompare(b.label));
  } catch {
    userOptions.value = [];
  } finally {
    usersLoading.value = false;
  }
}

onMounted(() => {
  void loadUsers();
});

const showHeadlessVisibilityHint = computed(
  () => (props.mode === 'articles' || props.mode === 'blog') && props.visibility !== 'public',
);
</script>
