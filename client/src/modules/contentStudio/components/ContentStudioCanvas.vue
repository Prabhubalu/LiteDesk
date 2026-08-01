<template>
  <div class="relative flex h-full min-h-0 flex-col overflow-hidden">
    <BubbleMenu
      v-if="editor"
      :editor="editor"
      :should-show="shouldShowTextBubbleMenu"
      :tippy-options="bubbleMenuTippyOptions"
    >
      <div :class="bubbleMenuClass" @mousedown.prevent>
        <HoverTooltip
          v-for="heading in headings"
          :key="heading.level"
          :content="t(heading.labelKey)"
          :z-index="bubbleMenuTooltipZIndex"
          preferred-placement="above"
        >
          <button
            type="button"
            :class="[ui.btnIcon, editor.isActive('heading', { level: heading.level }) ? ui.btnIconActive : '']"
            @click="editor.chain().focus().toggleHeading({ level: heading.level }).run()"
          >
            <span class="text-xs font-semibold">{{ heading.label }}</span>
          </button>
        </HoverTooltip>
        <span :class="ui.toolbarDivider" />
        <HoverTooltip :content="t('contentStudio.bubbleBold')" :z-index="bubbleMenuTooltipZIndex" preferred-placement="above">
          <button type="button" :class="[ui.btnIcon, editor.isActive('bold') ? ui.btnIconActive : '']" @click="editor.chain().focus().toggleBold().run()">
            <span class="text-xs font-bold">B</span>
          </button>
        </HoverTooltip>
        <HoverTooltip :content="t('contentStudio.bubbleItalic')" :z-index="bubbleMenuTooltipZIndex" preferred-placement="above">
          <button type="button" :class="[ui.btnIcon, editor.isActive('italic') ? ui.btnIconActive : '']" @click="editor.chain().focus().toggleItalic().run()">
            <span class="text-xs italic">I</span>
          </button>
        </HoverTooltip>
        <HoverTooltip :content="t('contentStudio.bubbleStrike')" :z-index="bubbleMenuTooltipZIndex" preferred-placement="above">
          <button type="button" :class="[ui.btnIcon, editor.isActive('strike') ? ui.btnIconActive : '']" @click="editor.chain().focus().toggleStrike().run()">
            <span class="text-xs line-through">S</span>
          </button>
        </HoverTooltip>
        <HoverTooltip :content="t('contentStudio.bubbleLink')" :z-index="bubbleMenuTooltipZIndex" preferred-placement="above">
          <button type="button" :class="[ui.btnIcon, editor.isActive('link') ? ui.btnIconActive : '']" @click="toggleLink">
            <LinkIcon class="h-4 w-4" />
          </button>
        </HoverTooltip>
      </div>
    </BubbleMenu>

    <BubbleMenu
      v-if="editor"
      :editor="editor"
      :should-show="shouldShowImageBubbleMenu"
      :tippy-options="bubbleMenuTippyOptions"
    >
      <div :class="bubbleMenuClass" @mousedown.prevent>
        <template v-if="isGalleryImageEditor()">
          <HoverTooltip
            :content="t('contentStudio.replaceGalleryImage')"
            :z-index="bubbleMenuTooltipZIndex"
            preferred-placement="above"
          >
            <button type="button" :class="ui.btnIcon" @click="replaceSelectedGalleryImage">
              <ArrowPathIcon class="h-4 w-4" />
            </button>
          </HoverTooltip>
          <span :class="ui.toolbarDivider" />
          <HoverTooltip
            :content="t('contentStudio.removeGalleryImage')"
            :z-index="bubbleMenuTooltipZIndex"
            preferred-placement="above"
          >
            <button
              type="button"
              :class="[ui.btnIcon, 'text-red-600 dark:text-red-400']"
              @click="removeSelectedGalleryImage"
            >
              <TrashIcon class="h-4 w-4" />
            </button>
          </HoverTooltip>
        </template>

        <template v-else>
        <HoverTooltip
          v-for="preset in imageWidthPresets"
          :key="preset.width"
          :content="t(preset.labelKey)"
          :z-index="bubbleMenuTooltipZIndex"
          preferred-placement="above"
        >
          <button
            type="button"
            :class="[ui.btnIcon, isImageWidthActive(preset.width) ? ui.btnIconActive : '']"
            @click="setImageWidth(preset.width)"
          >
            <svg viewBox="0 0 16 16" class="h-4 w-4" aria-hidden="true">
              <rect x="1" y="5" :width="preset.iconWidth" height="6" rx="1" fill="currentColor" />
            </svg>
          </button>
        </HoverTooltip>

        <span :class="ui.toolbarDivider" />

        <HoverTooltip
          v-for="option in imageTextWrapOptions"
          :key="option.value"
          :content="t(option.labelKey)"
          :z-index="bubbleMenuTooltipZIndex"
          preferred-placement="above"
        >
          <button
            type="button"
            :class="[ui.btnIcon, isImageTextWrapActive(option.value) ? ui.btnIconActive : '']"
            @click="setImageTextWrap(option.value)"
          >
            <component :is="option.icon" class="h-4 w-4" />
          </button>
        </HoverTooltip>

        <template v-if="showImagePositionControls()">
          <span :class="ui.toolbarDivider" />
          <HoverTooltip
            v-for="option in imagePositionOptions"
            :key="option.value"
            :content="t(option.labelKey)"
            :z-index="bubbleMenuTooltipZIndex"
            preferred-placement="above"
          >
            <button
              type="button"
              :class="[ui.btnIcon, isImagePositionActive(option.value) ? ui.btnIconActive : '']"
              @click="setImagePosition(option.value)"
            >
              <component :is="option.icon" class="h-4 w-4" />
            </button>
          </HoverTooltip>
        </template>

        <span :class="ui.toolbarDivider" />
        <HoverTooltip
          :content="t('contentStudio.toggleImageCaption')"
          :z-index="bubbleMenuTooltipZIndex"
          preferred-placement="above"
        >
          <button
            type="button"
            :class="[ui.btnIcon, isImageCaptionEnabled() ? ui.btnIconActive : '']"
            @click="toggleImageCaption"
          >
            <DocumentTextIcon class="h-4 w-4" />
          </button>
        </HoverTooltip>

        <span :class="ui.toolbarDivider" />
        <HoverTooltip
          :content="t('contentStudio.removeImage')"
          :z-index="bubbleMenuTooltipZIndex"
          preferred-placement="above"
        >
          <button
            type="button"
            :class="[ui.btnIcon, 'text-red-600 dark:text-red-400']"
            @click="removeSelectedImage"
          >
            <TrashIcon class="h-4 w-4" />
          </button>
        </HoverTooltip>
        </template>
      </div>
    </BubbleMenu>

    <input
      ref="imageInputRef"
      type="file"
      accept="image/*,.heic,.heif,.avif,.tif,.tiff,.bmp,.ico,.svg"
      class="hidden"
      @change="handleImageSelect"
    />

    <BuilderImageAssetPicker
      v-model:open="coverPickerOpen"
      hide-trigger
      allow-upload
      :library="coverAssetLibrary"
      :title="t('contentStudio.coverPickerTitle')"
      :upload-label="t('contentStudio.coverUploadNew')"
      @select="handleCoverAssetSelect"
    />

    <div :class="[ui.canvasOuter, 'content-studio-canvas-outer min-h-0 flex-1 overflow-y-auto']">
      <article
        :class="[ui.canvasPaper, canvasWidthClass, 'px-6 py-8 md:px-10 md:py-10']"
      >
        <div v-if="useHeroOverlap && coverImageUrl" class="group relative mb-4 overflow-hidden rounded-xl">
          <img :src="coverImageUrl" alt="" class="max-h-96 min-h-72 w-full object-cover" />
          <div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
          <div class="absolute inset-x-0 bottom-0 p-5 md:p-6">
            <input
              :value="title"
              type="text"
              :class="CONTENT_STUDIO_TITLE_OVERLAP_CLASS"
              :style="titleStyle"
              :placeholder="titlePlaceholder"
              @input="emit('update:title', $event.target.value)"
            />
            <textarea
              :value="subtitle"
              rows="2"
              :class="subtitleOverlapEditClass"
              :style="subtitleStyle"
              :placeholder="t('contentStudio.subtitlePlaceholder')"
              @input="emit('update:subtitle', $event.target.value)"
            />
          </div>
          <div class="absolute inset-0 flex items-end justify-end gap-2 bg-gradient-to-t from-black/40 to-transparent p-3 opacity-0 transition group-hover:opacity-100">
            <button type="button" class="rounded-lg bg-white/90 px-3 py-1.5 text-xs font-medium text-neutral-900" @click="openCoverPicker">
              {{ t('contentStudio.changeCover') }}
            </button>
            <button type="button" class="rounded-lg bg-white/90 px-3 py-1.5 text-xs font-medium text-red-700" @click="emit('remove-cover')">
              {{ t('contentStudio.removeCover') }}
            </button>
          </div>
        </div>

        <template v-else>
          <input
            v-if="!coverFirst"
            :value="title"
            type="text"
            :class="CONTENT_STUDIO_TITLE_CLASS"
            :style="titleStyle"
            :placeholder="titlePlaceholder"
            @input="emit('update:title', $event.target.value)"
          />

          <textarea
            v-if="!coverFirst"
            :value="subtitle"
            rows="2"
            :class="subtitleEditClass"
            :style="subtitleStyle"
            :placeholder="t('contentStudio.subtitlePlaceholder')"
            @input="emit('update:subtitle', $event.target.value)"
          />

          <div :class="coverFirst ? '' : 'mt-4'">
            <div v-if="coverImageUrl" class="group relative overflow-hidden rounded-xl">
              <img :src="coverImageUrl" alt="" class="max-h-72 w-full object-cover" />
              <div class="absolute inset-0 flex items-end justify-end gap-2 bg-gradient-to-t from-black/40 to-transparent p-3 opacity-0 transition group-hover:opacity-100">
                <button type="button" class="rounded-lg bg-white/90 px-3 py-1.5 text-xs font-medium text-neutral-900" @click="openCoverPicker">
                  {{ t('contentStudio.changeCover') }}
                </button>
                <button type="button" class="rounded-lg bg-white/90 px-3 py-1.5 text-xs font-medium text-red-700" @click="emit('remove-cover')">
                  {{ t('contentStudio.removeCover') }}
                </button>
              </div>
            </div>
            <button
              v-else
              type="button"
              :class="CONTENT_STUDIO_COVER_PLACEHOLDER_CLASS"
              @click="openCoverPicker"
            >
              {{ t('contentStudio.addCover') }}
            </button>
          </div>

          <input
            v-if="coverFirst"
            :value="title"
            type="text"
            :class="[CONTENT_STUDIO_TITLE_CLASS, 'mt-4']"
            :style="titleStyle"
            :placeholder="titlePlaceholder"
            @input="emit('update:title', $event.target.value)"
          />

          <textarea
            v-if="coverFirst"
            :value="subtitle"
            rows="2"
            :class="subtitleEditClass"
            :style="subtitleStyle"
            :placeholder="t('contentStudio.subtitlePlaceholder')"
            @input="emit('update:subtitle', $event.target.value)"
          />
        </template>

        <div :class="CONTENT_STUDIO_META_ROW_CLASS">
          <div class="inline-flex items-center gap-2">
            <span class="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700 dark:bg-primary-950 dark:text-primary-300">
              {{ authorInitials }}
            </span>
            <span>{{ resolvedAuthorName }}</span>
          </div>
          <span>{{ formattedDate }}</span>
          <span>{{ readTimeLabel }}</span>
        </div>

        <EditorContent
          :editor="editor"
          :class="CONTENT_STUDIO_EDITOR_PROSE_CLASS"
        />
      </article>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { EditorContent, BubbleMenu } from '@tiptap/vue-3';
import { LinkIcon, TrashIcon, DocumentTextIcon, Bars3BottomLeftIcon, Bars3BottomRightIcon, Bars3CenterLeftIcon, RectangleStackIcon, ArrowPathIcon } from '@heroicons/vue/24/outline';
import HoverTooltip from '@/components/common/HoverTooltip.vue';
import { useBuilderUi } from '@/composables/useBuilderUi';
import { useContentAssets } from '@/composables/useContentAssets';
import { useMarketingAssets } from '@/composables/useMarketingAssets';
import BuilderImageAssetPicker from '@/components/templates/builder/BuilderImageAssetPicker.vue';
import { consumePendingGalleryIntent, applyGalleryImageFromUpload, setPendingGalleryIntent } from '../editor/slashCommands';
import { isImageFile } from '../editor/imageFileTransfer';
import { isEditorInGallery, removeGalleryImage } from '../editor/blockCommands';
import {
  normalizeImagePosition,
  normalizeImageTextWrap,
  normalizeImageWidth,
} from '../editor/imageExtension';
import {
  CONTENT_STUDIO_COVER_PLACEHOLDER_CLASS,
  CONTENT_STUDIO_EDITOR_PROSE_CLASS,
  CONTENT_STUDIO_META_ROW_CLASS,
  CONTENT_STUDIO_TITLE_CLASS,
  CONTENT_STUDIO_TITLE_OVERLAP_CLASS,
  contentStudioSubtitleEditClass,
  contentStudioSubtitleOverlapEditClass,
  contentStudioSubtitleSizeClass,
  contentStudioSubtitleOverlapSizeClass,
  resolveArticleChromeLayout,
  resolveArticleChromeColors,
} from '../editor/articlePresentation';
import '../editor/contentStudioGallery.css';
import '../editor/contentStudioChecklist.css';
import '../editor/contentStudioFaq.css';
import '../editor/contentStudioSteps.css';
import { formatUserDate } from '@/utils/localeFormat';

const props = defineProps({
  editor: { type: Object, default: null },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  previewDevice: { type: String, default: 'desktop' },
  mode: { type: String, default: 'articles' },
  coverImageUrl: { type: String, default: '' },
  presentation: { type: Object, default: () => ({}) },
  wordCount: { type: Number, default: 0 },
  readMinutes: { type: Number, default: 1 },
  authorName: { type: String, default: '' },
});

const emit = defineEmits([
  'update:title',
  'update:subtitle',
  'image-uploaded',
  'register-image-trigger',
  'register-image-file-handler',
  'cover-uploaded',
  'remove-cover',
]);

const { t } = useI18n();
const ui = useBuilderUi();
const contentAssets = useContentAssets();
const marketingAssets = useMarketingAssets();
const editorAssetLibrary = computed(() => (props.mode === 'blog' ? marketingAssets : contentAssets));
const imageUploading = ref(false);

const bubbleMenuTippyOptions = {
  duration: 100,
  placement: 'top',
  maxWidth: 'none',
};

const bubbleMenuClass =
  'inline-flex max-w-none flex-nowrap items-center gap-0.5 rounded-lg border border-neutral-200 bg-white px-1 py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900';

const bubbleMenuTooltipZIndex = 10050;

const imageInputRef = ref(null);
const coverPickerOpen = ref(false);
const coverAssetLibrary = computed(() => (props.mode === 'blog' ? 'marketing' : 'content'));
const titlePlaceholder = computed(() => (
  props.mode === 'blog'
    ? t('contentStudio.titlePlaceholderBlog')
    : t('contentStudio.titlePlaceholder')
));
const headings = [
  { level: 1, label: 'H1', labelKey: 'contentStudio.bubbleHeading1' },
  { level: 2, label: 'H2', labelKey: 'contentStudio.bubbleHeading2' },
  { level: 3, label: 'H3', labelKey: 'contentStudio.bubbleHeading3' },
];

const imageWidthPresets = [
  { width: '25%', iconWidth: 3, labelKey: 'contentStudio.imageSizeSmall' },
  { width: '50%', iconWidth: 6, labelKey: 'contentStudio.imageSizeMedium' },
  { width: '75%', iconWidth: 9, labelKey: 'contentStudio.imageSizeLarge' },
  { width: '100%', iconWidth: 14, labelKey: 'contentStudio.imageSizeFull' },
];

const imageTextWrapOptions = [
  { value: 'block', labelKey: 'contentStudio.imageTextWrapBlock', icon: RectangleStackIcon },
  { value: 'wrap-left', labelKey: 'contentStudio.imageTextWrapLeft', icon: Bars3BottomRightIcon },
  { value: 'wrap-right', labelKey: 'contentStudio.imageTextWrapRight', icon: Bars3BottomLeftIcon },
];

const imagePositionOptions = [
  { value: 'left', labelKey: 'contentStudio.alignLeft', icon: Bars3BottomLeftIcon },
  { value: 'center', labelKey: 'contentStudio.alignCenter', icon: Bars3CenterLeftIcon },
  { value: 'right', labelKey: 'contentStudio.alignRight', icon: Bars3BottomRightIcon },
];

function shouldShowTextBubbleMenu({ editor: ed }) {
  if (ed.isActive('image')) return false;
  return !ed.state.selection.empty;
}

function shouldShowImageBubbleMenu({ editor: ed }) {
  return ed.isActive('image');
}

function isImageWidthActive(presetWidth) {
  const ed = props.editor;
  if (!ed?.isActive('image')) return false;
  return normalizeImageWidth(ed.getAttributes('image').width) === presetWidth;
}

function setImageWidth(width) {
  props.editor?.chain().focus().updateAttributes('image', { width }).run();
}

function isImageTextWrapActive(value) {
  const ed = props.editor;
  if (!ed?.isActive('image')) return false;
  return normalizeImageTextWrap(ed.getAttributes('image').textWrap) === value;
}

function setImageTextWrap(value) {
  props.editor?.chain().focus().updateAttributes('image', { textWrap: value }).run();
}

const showImagePositionControls = () => {
  const ed = props.editor;
  if (!ed?.isActive('image')) return false;
  return normalizeImageTextWrap(ed.getAttributes('image').textWrap) === 'block';
};

function isImagePositionActive(value) {
  const ed = props.editor;
  if (!ed?.isActive('image')) return false;
  return normalizeImagePosition(ed.getAttributes('image').imagePosition) === value;
}

function setImagePosition(value) {
  props.editor?.chain().focus().updateAttributes('image', { imagePosition: value }).run();
}

function isImageCaptionEnabled() {
  const ed = props.editor;
  if (!ed?.isActive('image')) return false;
  return Boolean(ed.getAttributes('image').captionEnabled);
}

function toggleImageCaption() {
  const ed = props.editor;
  if (!ed?.isActive('image')) return;
  const enabled = Boolean(ed.getAttributes('image').captionEnabled);
  if (enabled) {
    ed.chain().focus().updateAttributes('image', { captionEnabled: false, caption: null }).run();
    return;
  }
  ed.chain().focus().updateAttributes('image', { captionEnabled: true }).run();
}

function isGalleryImageEditor() {
  const ed = props.editor;
  return Boolean(ed?.isActive('image') && isEditorInGallery(ed));
}

function replaceSelectedGalleryImage() {
  if (!props.editor) return;
  setPendingGalleryIntent(props.editor, 'replace');
  openImagePicker();
}

function removeSelectedGalleryImage() {
  if (removeGalleryImage(props.editor)) return;
  props.editor?.chain().focus().deleteSelection().run();
}

function removeSelectedImage() {
  if (isGalleryImageEditor()) {
    removeSelectedGalleryImage();
    return;
  }
  props.editor?.chain().focus().deleteSelection().run();
}

const canvasWidthClass = computed(() => {
  if (props.previewDevice === 'mobile') return 'max-w-[390px]';
  if (props.previewDevice === 'tablet') return 'max-w-[768px]';
  return 'max-w-[920px]';
});

const chromeLayout = computed(() => resolveArticleChromeLayout(props.presentation));
const chromeColors = computed(() => resolveArticleChromeColors(
  props.presentation,
  { heroOverlap: useHeroOverlap.value },
));
const coverFirst = computed(() => chromeLayout.value.coverFirst);
const useHeroOverlap = computed(() => chromeLayout.value.useHeroOverlap && Boolean(props.coverImageUrl));
const titleStyle = computed(() => ({
  color: chromeColors.value.headingColor,
}));
const subtitleStyle = computed(() => ({
  color: chromeColors.value.subheadingColor,
}));
const subtitleEditClass = computed(() => `mt-3 w-full resize-none border-0 bg-transparent ${contentStudioSubtitleSizeClass(chromeLayout.value.subtitleSize)} outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500`);
const subtitleOverlapEditClass = computed(() => `mt-2 w-full resize-none border-0 bg-transparent ${contentStudioSubtitleOverlapSizeClass(chromeLayout.value.subtitleSize)} text-white/90 outline-none placeholder:text-white/60`);

const resolvedAuthorName = computed(() => props.authorName || t('contentStudio.authorFallback'));
const authorInitials = computed(() => {
  const parts = String(resolvedAuthorName.value).trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || 'A';
});
const formattedDate = computed(() => formatUserDate(new Date()));
const readTimeLabel = computed(() => t('contentStudio.readTime', { minutes: props.readMinutes }));

function openImagePicker() {
  imageInputRef.value?.click();
}

function openCoverPicker() {
  coverPickerOpen.value = true;
}

function handleCoverAssetSelect(payload) {
  const asset = payload?.asset;
  const url = payload?.src || asset?.url || asset?.publicUrl || asset?.downloadUrl || '';
  if (!url) return;
  emit('cover-uploaded', { asset, url });
}

async function insertImageFromFile(file) {
  if (!isImageFile(file) || !props.editor || imageUploading.value) return;
  imageUploading.value = true;
  try {
    const asset = await editorAssetLibrary.value.uploadAsset(file, { type: 'image' });
    const url = asset?.downloadUrl || asset?.url || asset?.publicUrl;
    if (!url || !props.editor) return;
    const intent = consumePendingGalleryIntent(props.editor);
    if (intent) {
      applyGalleryImageFromUpload(props.editor, url, file.name, intent);
    } else if (isEditorInGallery(props.editor) || props.editor.isActive('gallery')) {
      applyGalleryImageFromUpload(props.editor, url, file.name, 'add');
    } else {
      props.editor.chain().focus().setImage({ src: url, alt: file.name || '' }).run();
    }
    emit('image-uploaded', url);
  } catch {
    /* handled by composable notifications elsewhere if needed */
  } finally {
    imageUploading.value = false;
  }
}

async function handleImageSelect(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (file) await insertImageFromFile(file);
}

function toggleLink() {
  const ed = props.editor;
  if (!ed) return;
  if (ed.isActive('link')) {
    ed.chain().focus().unsetLink().run();
    return;
  }
  const href = window.prompt(t('contentStudio.linkPrompt'), 'https://');
  if (!href) return;
  ed.chain().focus().extendMarkRange('link').setLink({ href }).run();
}

function registerImageHandlers() {
  emit('register-image-trigger', openImagePicker);
  emit('register-image-file-handler', insertImageFromFile);
}

onMounted(() => {
  registerImageHandlers();
});

watch(
  () => props.editor,
  () => registerImageHandlers(),
);
</script>
