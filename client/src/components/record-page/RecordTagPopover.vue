<template>
  <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
    <div class="flex items-center justify-between gap-2">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('records.tagsTitle') }}</h3>
      <button
        v-if="canEdit"
        type="button"
        class="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
        @click="openCreateTagEditor()"
      >
        {{ t('records.tagsNewTag') }}
      </button>
    </div>

    <div class="mt-2">
      <input
        ref="tagSearchInputRef"
        v-model="tagSearchQuery"
        type="text"
        :placeholder="t('records.tagsSearchPh')"
        class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        :readonly="!canEdit"
        @focus="tagListOpen = true"
        @click="tagListOpen = true"
        @blur="handleTagSearchBlur"
      />
      <p
        v-if="!canEdit"
        class="mt-2 text-xs text-gray-500 dark:text-gray-400"
      >
        {{ t('records.tagsNoPermission') }}
      </p>
      <p
        v-if="tagSaveError"
        class="mt-2 text-xs text-red-600 dark:text-red-400"
      >
        {{ tagSaveError }}
      </p>
    </div>

    <div v-if="record?.tags?.length" class="mt-2 flex flex-wrap gap-1.5">
      <span
        v-for="tagName in record.tags"
        :key="`selected-${tagName}`"
        :class="['inline-flex items-center gap-1.5 rounded px-2 py-1 text-sm leading-none', getTagChipClass(tagName)]"
      >
        <span class="truncate max-w-[180px]">{{ tagName }}</span>
        <Menu v-if="canEdit" as="div" class="relative">
          <MenuButton
            type="button"
            class="inline-flex h-3.5 w-3.5 items-center justify-center self-center text-current/80 hover:text-current"
            @click="prepareMenuPlacement(`selected-${tagName}`, $event)"
          >
            <EllipsisVerticalIcon class="w-3.5 h-3.5" />
          </MenuButton>
          <transition
            enter-active-class="transition ease-out duration-100"
            enter-from-class="transform opacity-0 scale-95"
            enter-to-class="transform opacity-100 scale-100"
            leave-active-class="transition ease-in duration-75"
            leave-from-class="transform opacity-100 scale-100"
            leave-to-class="transform opacity-0 scale-95"
          >
            <MenuItems :class="menuItemsClass(`selected-${tagName}`)">
              <MenuItem v-slot="{ active }">
                <button
                  type="button"
                  :class="['w-full px-3 py-1.5 text-left text-xs text-gray-900 dark:text-gray-100', active ? 'bg-gray-100 dark:bg-gray-800' : '']"
                  @click="removeTagFromRecord(tagName)"
                >
                  {{ t('records.tagsRemoveFromRecord') }}
                </button>
              </MenuItem>
              <MenuItem v-slot="{ active }">
                <button
                  type="button"
                  :class="['w-full px-3 py-1.5 text-left text-xs text-gray-900 dark:text-gray-100', active ? 'bg-gray-100 dark:bg-gray-800' : '']"
                  @click="openTagEditorByName(tagName)"
                >
                  {{ t('records.tagsEditTag') }}
                </button>
              </MenuItem>
              <MenuItem v-slot="{ active }">
                <button
                  type="button"
                  :class="['w-full px-3 py-1.5 text-left text-xs text-red-600 dark:text-red-400', active ? 'bg-gray-100 dark:bg-gray-800' : '']"
                  @click="handleDeleteTagDefinition(tagName)"
                >
                  {{ t('records.tagsDeleteFromModule') }}
                </button>
              </MenuItem>
            </MenuItems>
          </transition>
        </Menu>
      </span>
    </div>
  </div>

  <div class="max-h-72 overflow-visible px-2 py-2">
    <div
      v-if="hasPendingTagRemoval"
      class="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200"
    >
      <div class="flex items-center justify-between gap-2">
        <span>{{ t('common.tagsRemovedNamed', { name: pendingTagRemovalTagName }) }}</span>
        <button type="button" class="font-medium hover:underline" @click="undoPendingTagRemoval">
          {{ t('common.tagsUndoSeconds', { seconds: pendingTagRemovalSecondsLeft }) }}
        </button>
      </div>
    </div>

    <div v-if="!tagListOpen && !isTagEditorOpen" class="px-2 py-3 text-sm text-gray-500 dark:text-gray-400">
      {{ t('records.tagsSearchHint') }}
    </div>

    <div v-else-if="!hasInstanceTags && !isTagEditorOpen" class="px-2 py-3 text-sm text-gray-500 dark:text-gray-400">
      <p>{{ t('records.tagsNoneYet') }}</p>
      <button
        v-if="canEdit"
        type="button"
        class="mt-2 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
        @click="openCreateTagEditor(tagSearchQuery)"
      >
        {{ t('records.tagsCreateFirst') }}
      </button>
    </div>

    <template v-else-if="!isTagEditorOpen">
      <button
        v-if="canCreateTagFromSearch && canEdit"
        type="button"
        class="w-full rounded-lg px-3 py-2 text-left text-sm text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
        @click="openCreateTagEditor(tagSearchQuery)"
      >
        {{ t('common.tagsCreateNamed', { name: normalizedTagSearch }) }}
      </button>

      <div
        v-for="tagDef in filteredInstanceTags"
        :key="tagDef.name"
        class="group flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        <button
          type="button"
          class="min-w-0 flex-1 flex items-center gap-2 text-left"
          @click="canEdit && toggleTagForRecord(tagDef.name)"
        >
          <span :class="['h-2.5 w-2.5 rounded-full', getTagDotClass(tagDef.name)]"></span>
          <span class="flex-1 truncate text-sm text-gray-900 dark:text-white">{{ tagDef.name }}</span>
          <span
            v-if="tagDef.isPublic"
            class="rounded px-1.5 py-0.5 text-[10px] font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
          >
            {{ t('records.tagsPublic') }}
          </span>
          <CheckIcon
            v-if="isTagAssigned(tagDef.name)"
            class="w-4 h-4 text-indigo-600 dark:text-indigo-400"
          />
        </button>
        <button
          v-if="canEdit"
          type="button"
          class="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          @click.stop="openEditTagEditor(tagDef)"
          :aria-label="t('records.tagsEditTag')"
        >
          <PencilSquareIcon class="w-4 h-4" />
        </button>
        <Menu v-if="canEdit" as="div" class="relative">
          <MenuButton
            type="button"
            class="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            @click.stop
            @click="prepareMenuPlacement(`list-${tagDef.name}`, $event)"
            :aria-label="t('records.tagsTagActions')"
          >
            <EllipsisVerticalIcon class="w-4 h-4" />
          </MenuButton>
          <transition
            enter-active-class="transition ease-out duration-100"
            enter-from-class="transform opacity-0 scale-95"
            enter-to-class="transform opacity-100 scale-100"
            leave-active-class="transition ease-in duration-75"
            leave-from-class="transform opacity-100 scale-100"
            leave-to-class="transform opacity-0 scale-95"
          >
              <MenuItems :class="menuItemsClass(`list-${tagDef.name}`)">
              <MenuItem v-slot="{ active }">
                <button
                  type="button"
                  :class="['w-full px-3 py-1.5 text-left text-xs text-gray-900 dark:text-gray-100', active ? 'bg-gray-100 dark:bg-gray-800' : '']"
                  @click.stop="removeTagFromRecord(tagDef.name)"
                >
                  {{ t('records.tagsRemoveFromRecord') }}
                </button>
              </MenuItem>
              <MenuItem v-slot="{ active }">
                <button
                  type="button"
                  :class="['w-full px-3 py-1.5 text-left text-xs text-gray-900 dark:text-gray-100', active ? 'bg-gray-100 dark:bg-gray-800' : '']"
                  @click.stop="openTagEditorByName(tagDef.name)"
                >
                  {{ t('records.tagsEditTag') }}
                </button>
              </MenuItem>
              <MenuItem v-slot="{ active }">
                <button
                  type="button"
                  :class="['w-full px-3 py-1.5 text-left text-xs text-red-600 dark:text-red-400', active ? 'bg-gray-100 dark:bg-gray-800' : '']"
                  @click.stop="handleDeleteTagDefinition(tagDef.name)"
                >
                  {{ t('records.tagsDeleteFromModule') }}
                </button>
              </MenuItem>
            </MenuItems>
          </transition>
        </Menu>
      </div>
    </template>

    <template v-else>
      <div class="px-2 py-2 space-y-3">
        <div>
          <label class="text-xs text-gray-500 dark:text-gray-400">{{ t('records.tagsTagName') }}</label>
          <input
            v-model="tagEditor.name"
            type="text"
            maxlength="50"
            class="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            :placeholder="t('records.tagsNamePh')"
          />
        </div>

        <div>
          <label class="text-xs text-gray-500 dark:text-gray-400">{{ t('records.tagsColor') }}</label>
          <div class="mt-1 flex items-center gap-2">
            <button
              v-for="option in TAG_COLOR_OPTIONS"
              :key="option.key"
              type="button"
              :class="[
                'h-6 w-6 rounded-full border-2 transition-colors',
                option.swatchClass,
                tagEditor.color === option.key ? 'border-gray-900 dark:border-white' : 'border-transparent hover:border-gray-300 dark:hover:border-gray-500'
              ]"
              @click="tagEditor.color = option.key"
            ></button>
          </div>
        </div>

        <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <HeadlessCheckbox
            v-model="tagEditor.isPublic"
            checkbox-class="h-4 w-4"
          />
          {{ t('records.tagsMakePublic') }}
        </label>

        <div class="flex items-center justify-between gap-2 pt-1">
          <div class="ml-auto flex items-center gap-2">
            <button
              type="button"
              class="rounded-md px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              @click="closeTagEditor"
            >
              {{ t('actions.cancel') }}
            </button>
            <button
              type="button"
              class="rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="!canSaveTagEditor || isSavingTagState"
              @click="saveTagEditor"
            >
              {{ tagEditorMode === 'create' ? t('actions.create') : t('actions.save') }}
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue';
import { CheckIcon, PencilSquareIcon, EllipsisVerticalIcon } from '@heroicons/vue/24/outline';
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import { useRecordTags } from './composables/useRecordTags';

const { t } = useI18n();

const props = defineProps({
  /** Reactive record with _id and tags */
  record: { type: Object, default: null },
  /** localStorage key for tag definitions (e.g. from computed tagStorageKey) */
  tagStorageKey: { type: [String, Object], required: true },
  /** Whether the user can edit tags */
  canEdit: { type: Boolean, default: true },
  /** Persist tags to API and update record; receives cleaned string[] */
  persistTags: { type: Function, required: true },
  /** Which API to use for fetching instance tag list */
  instanceTagSource: { type: String, default: 'tasks' },
  /** Optional refetch after persist error */
  fetchRecord: { type: Function, default: null },
  /** When false, component resets search/editor state (e.g. popover closed) */
  open: { type: Boolean, default: false }
});

const recordRef = computed(() => props.record);

const tagStorageKeyValue = computed(() => (
  typeof props.tagStorageKey === 'object' && props.tagStorageKey !== null && 'value' in props.tagStorageKey
    ? props.tagStorageKey.value
    : props.tagStorageKey
));

const tagState = useRecordTags(recordRef, {
  tagStorageKey: tagStorageKeyValue,
  canEdit: computed(() => props.canEdit),
  persistTags: props.persistTags,
  instanceTagSource: props.instanceTagSource,
  fetchRecord: props.fetchRecord || (() => Promise.resolve())
});

const {
  TAG_COLOR_OPTIONS,
  tagSearchInputRef,
  tagListOpen,
  tagSearchQuery,
  instanceTagDefinitions,
  tagEditorMode,
  editingTagName,
  isSavingTagState,
  tagSaveError,
  tagEditor,
  hasInstanceTags,
  normalizedTagSearch,
  filteredInstanceTags,
  canCreateTagFromSearch,
  hasPendingTagRemoval,
  pendingTagRemovalTagName,
  pendingTagRemovalSecondsLeft,
  isTagEditorOpen,
  canSaveTagEditor,
  getTagChipClass,
  getTagDotClass,
  openCreateTagEditor,
  openEditTagEditor,
  getTagDefinitionByName,
  deleteTagDefinition,
  closeTagEditor,
  saveTagEditor,
  deleteEditingTag,
  toggleTagForRecord,
  removeTagFromRecord,
  undoPendingTagRemoval,
  handleTagSearchBlur,
  resetOnClose,
  fetchInstanceTagDefinitions
} = tagState;

const isTagAssigned = (tagName) => Array.isArray(props.record?.tags) && props.record.tags.includes(tagName);
const openTagEditorByName = (tagName) => {
  const tagDef = getTagDefinitionByName(tagName);
  if (tagDef) {
    openEditTagEditor(tagDef);
  } else {
    openCreateTagEditor(tagName);
  }
};
const handleDeleteTagDefinition = async (tagName) => {
  await deleteTagDefinition(tagName);
};
const menuDirectionByKey = ref({});
const prepareMenuPlacement = (menuKey, event) => {
  const target = event?.currentTarget;
  if (!(target instanceof HTMLElement)) return;
  const rect = target.getBoundingClientRect();
  const estimatedMenuHeight = 156;
  const roomAbove = rect.top;
  const roomBelow = window.innerHeight - rect.bottom;
  const direction = roomAbove >= estimatedMenuHeight || roomAbove >= roomBelow ? 'up' : 'down';
  menuDirectionByKey.value = { ...menuDirectionByKey.value, [menuKey]: direction };
};
const menuItemsClass = (menuKey) => {
  const direction = menuDirectionByKey.value?.[menuKey] || 'up';
  return [
    'absolute right-0 z-[220] w-44 rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900',
    direction === 'down' ? 'top-full mt-1' : 'bottom-full mb-1'
  ];
};

watch(() => props.open, async (isOpen) => {
  if (isOpen) {
    // Match header-open UX: show list + refresh suggestions immediately (colors/definitions stay in sync).
    tagListOpen.value = true;
    await fetchInstanceTagDefinitions();
    await nextTick();
    try {
      tagSearchInputRef.value?.focus?.();
    } catch (_) { /* noop */ }
  } else {
    resetOnClose();
  }
});
</script>
