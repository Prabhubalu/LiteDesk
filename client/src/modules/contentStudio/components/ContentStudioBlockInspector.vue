<template>
  <div>
    <header class="border-b border-neutral-200 px-4 py-4 dark:border-neutral-800">
      <div class="flex items-start gap-3">
        <div :class="[ui.inspectorBlockIcon, blockMeta.iconSerif ? 'font-serif text-lg' : 'text-[10px] font-semibold uppercase tracking-wide']">
          {{ blockMeta.icon }}
        </div>
        <div class="min-w-0">
          <p class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{{ t(blockMeta.labelKey) }}</p>
          <p class="mt-0.5 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">{{ t(blockMeta.descriptionKey) }}</p>
        </div>
      </div>
    </header>

    <div class="px-4 pb-4">
      <BuilderDisclosureSection v-if="hasBlockSettings" :title="t(blockMeta.settingsSectionKey)" :bordered="false">
        <div class="space-y-3">
          <ContentStudioInspectorFieldRow v-if="activeBlockType === 'heading'" :label="t('contentStudio.fieldHeadingLevel')">
            <BuilderSelect
              :model-value="headingLevel"
              :options="headingLevelOptions"
              button-class="h-8"
              @update:model-value="setHeadingLevel(Number($event))"
            />
          </ContentStudioInspectorFieldRow>

          <ContentStudioInspectorFieldRow
            v-if="blockMeta.alignment"
            :label="t('contentStudio.fieldAlignment')"
          >
            <ContentStudioInspectorAlignment
              :value="layoutTextAlign"
              :allow-justify="blockMeta.justify"
              @update:value="updateLayoutAttrs({ textAlign: $event })"
            />
          </ContentStudioInspectorFieldRow>

          <ContentStudioInspectorTypography
            v-if="blockMeta.typography"
            :font-size="layoutFontSize"
            :text-color="layoutTextColor"
            :line-height="layoutLineHeight"
            @update:typography="updateLayoutAttrs"
          />

          <ContentStudioInspectorFieldRow v-if="blockMeta.blockWidth" :label="t('contentStudio.fieldBlockWidth')">
            <BuilderSelect
              :model-value="layoutBlockWidth"
              :options="blockWidthOptions"
              button-class="h-8"
              @update:model-value="updateLayoutAttrs({ blockWidth: $event })"
            />
          </ContentStudioInspectorFieldRow>

          <template v-if="activeBlockType === 'image' && !isGalleryContext">
            <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldImageAlt')">
              <input
                :value="imageAlt"
                type="text"
                :class="[ui.input, 'h-8 text-sm']"
                @input="setNodeAttr('image', 'alt', $event.target.value)"
              />
            </ContentStudioInspectorFieldRow>
            <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldImageTitle')">
              <input
                :value="imageTitle"
                type="text"
                :class="[ui.input, 'h-8 text-sm']"
                @input="setNodeAttr('image', 'title', $event.target.value)"
              />
            </ContentStudioInspectorFieldRow>
            <p v-if="imageSrc" class="break-all text-xs text-neutral-500">{{ imageSrc }}</p>
          </template>

          <template v-if="activeBlockType === 'gallery'">
            <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldGalleryLayout')">
              <BuilderSelect
                :model-value="galleryLayout"
                :options="galleryLayoutOptions"
                button-class="h-8"
                @update:model-value="setNodeAttr('gallery', 'layout', $event)"
              />
            </ContentStudioInspectorFieldRow>
            <p class="text-xs text-neutral-500">{{ t('contentStudio.galleryImageCount', { count: galleryImageCount }) }}</p>
            <button type="button" :class="[ui.btnSecondary, 'w-full']" @click="requestGalleryImage('add')">
              {{ t('contentStudio.addGalleryImage') }}
            </button>
            <button
              v-if="hasSelectedGalleryImage"
              type="button"
              :class="[ui.btnSecondary, 'mt-2 w-full']"
              @click="requestGalleryImage('replace')"
            >
              {{ t('contentStudio.replaceGalleryImage') }}
            </button>
            <button
              v-if="hasSelectedGalleryImage"
              type="button"
              :class="[ui.btnSecondary, 'mt-2 w-full text-danger-600 dark:text-danger-400']"
              @click="removeGalleryImageFromBlock"
            >
              {{ t('contentStudio.removeGalleryImage') }}
            </button>
          </template>

          <template v-if="activeBlockType === 'link'">
            <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldLinkUrl')">
              <input
                :value="linkHref"
                type="url"
                :class="[ui.input, 'h-8 text-sm']"
                @change="setLinkHref($event.target.value)"
              />
            </ContentStudioInspectorFieldRow>
            <button type="button" :class="[ui.btnSecondary, 'w-full']" @click="removeLink">
              {{ t('contentStudio.removeLink') }}
            </button>
          </template>

          <template v-if="activeBlockType === 'bulletList' || activeBlockType === 'orderedList'">
            <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldListStyle')">
              <BuilderSelect
                :model-value="activeBlockType === 'orderedList' ? 'ordered' : 'bullet'"
                :options="listStyleOptions"
                button-class="h-8"
                @update:model-value="setListStyle($event)"
              />
            </ContentStudioInspectorFieldRow>
          </template>

          <template v-if="activeBlockType === 'callout'">
            <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldCalloutVariant')">
              <BuilderSelect
                :model-value="calloutVariant"
                :options="calloutVariantOptions"
                button-class="h-8"
                @update:model-value="setNodeAttr('callout', 'variant', $event)"
              />
            </ContentStudioInspectorFieldRow>
          </template>

          <template v-if="activeBlockType === 'embed'">
            <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldMediaTitle')">
              <input :value="embedTitle" type="text" :class="[ui.input, 'h-8 text-sm']" @change="setEmbedAttr('title', $event.target.value)" />
            </ContentStudioInspectorFieldRow>
            <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldMediaUrl')">
              <input :value="embedSrc" type="url" :class="[ui.input, 'h-8 text-sm']" @change="setEmbedAttr('src', $event.target.value)" />
            </ContentStudioInspectorFieldRow>
            <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldMediaInfo')">
              <textarea :value="embedInfo" rows="2" :class="[ui.input, 'text-sm']" @change="setEmbedAttr('info', $event.target.value)" />
            </ContentStudioInspectorFieldRow>
            <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldEmbedWidth')">
              <BuilderSelect
                :model-value="embedWidth"
                :options="embedWidthOptions"
                button-class="h-8"
                @update:model-value="setEmbedAttr('embedWidth', $event)"
              />
            </ContentStudioInspectorFieldRow>
            <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldEmbedHeight')">
              <input
                :value="embedHeight"
                type="number"
                min="180"
                max="900"
                :class="[ui.input, 'h-8 text-sm']"
                @change="setEmbedAttr('height', Number($event.target.value) || 360)"
              />
            </ContentStudioInspectorFieldRow>
          </template>

          <template v-if="activeBlockType === 'audio'">
            <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldMediaTitle')">
              <input :value="audioTitle" type="text" :class="[ui.input, 'h-8 text-sm']" @change="setAudioAttr('title', $event.target.value)" />
            </ContentStudioInspectorFieldRow>
            <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldMediaUrl')">
              <input :value="audioSrc" type="url" :class="[ui.input, 'h-8 text-sm']" @change="setAudioAttr('src', $event.target.value)" />
            </ContentStudioInspectorFieldRow>
            <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldMediaInfo')">
              <textarea :value="audioInfo" rows="2" :class="[ui.input, 'text-sm']" @change="setAudioAttr('info', $event.target.value)" />
            </ContentStudioInspectorFieldRow>
          </template>

          <template v-if="activeBlockType === 'file'">
            <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldMediaTitle')">
              <input :value="fileLabel" type="text" :class="[ui.input, 'h-8 text-sm']" @change="setFileAttr('label', $event.target.value)" />
            </ContentStudioInspectorFieldRow>
            <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldMediaUrl')">
              <input :value="fileHref" type="url" :class="[ui.input, 'h-8 text-sm']" @change="setFileAttr('href', $event.target.value)" />
            </ContentStudioInspectorFieldRow>
            <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldMediaInfo')">
              <textarea :value="fileInfo" rows="2" :class="[ui.input, 'text-sm']" @change="setFileAttr('info', $event.target.value)" />
            </ContentStudioInspectorFieldRow>
          </template>

          <template v-if="activeBlockType === 'codeBlock'">
            <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldCodeLanguage')">
              <input
                :value="codeLanguage"
                type="text"
                :class="[ui.input, 'h-8 text-sm']"
                :placeholder="t('contentStudio.codeLanguagePlaceholder')"
                @input="setNodeAttr('codeBlock', 'language', $event.target.value || null)"
              />
            </ContentStudioInspectorFieldRow>
          </template>

          <template v-if="activeBlockType === 'step'">
            <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldStepTitle')">
              <input
                :value="stepTitle"
                type="text"
                :class="[ui.input, 'h-8 text-sm']"
                @input="setNodeAttr('step', 'title', $event.target.value)"
              />
            </ContentStudioInspectorFieldRow>
            <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldStepsOrientation')">
              <BuilderSelect
                :model-value="stepsOrientation"
                :options="stepsOrientationOptions"
                button-class="h-8"
                @update:model-value="setNodeAttr('steps', 'orientation', $event)"
              />
            </ContentStudioInspectorFieldRow>
            <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldStepsTitleLayout')">
              <BuilderSelect
                :model-value="stepsTitleLayout"
                :options="stepsTitleLayoutOptions"
                button-class="h-8"
                @update:model-value="setNodeAttr('steps', 'titleLayout', $event)"
              />
            </ContentStudioInspectorFieldRow>
            <div
              class="flex items-start justify-between gap-3 rounded-lg border border-neutral-200 px-3 py-2.5 dark:border-neutral-700"
            >
              <span class="text-sm text-neutral-700 dark:text-neutral-300">
                {{ t('contentStudio.fieldStepsHeaderCenter') }}
              </span>
              <HeadlessSwitch
                :model-value="stepsHeaderCentered"
                size="sm"
                @update:model-value="setNodeAttr('steps', 'headerAlign', $event ? 'center' : 'start')"
              />
            </div>
            <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldStepsContentAlign')">
              <BuilderSelect
                :model-value="stepsContentAlign"
                :options="stepsContentAlignOptions"
                button-class="h-8"
                @update:model-value="setNodeAttr('steps', 'contentAlign', $event)"
              />
            </ContentStudioInspectorFieldRow>
            <button type="button" :class="[ui.btnSecondary, 'w-full']" @click="addStep">
              {{ t('contentStudio.addStep') }}
            </button>
            <button
              type="button"
              :class="[ui.btnSecondary, 'mt-2 w-full text-danger-600 dark:text-danger-400']"
              @click="removeStep"
            >
              {{ t('contentStudio.removeStep') }}
            </button>
          </template>

          <template v-if="activeBlockType === 'steps'">
            <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldStepsOrientation')">
              <BuilderSelect
                :model-value="stepsOrientation"
                :options="stepsOrientationOptions"
                button-class="h-8"
                @update:model-value="setNodeAttr('steps', 'orientation', $event)"
              />
            </ContentStudioInspectorFieldRow>
            <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldStepsTitleLayout')">
              <BuilderSelect
                :model-value="stepsTitleLayout"
                :options="stepsTitleLayoutOptions"
                button-class="h-8"
                @update:model-value="setNodeAttr('steps', 'titleLayout', $event)"
              />
            </ContentStudioInspectorFieldRow>
            <div
              class="flex items-start justify-between gap-3 rounded-lg border border-neutral-200 px-3 py-2.5 dark:border-neutral-700"
            >
              <span class="text-sm text-neutral-700 dark:text-neutral-300">
                {{ t('contentStudio.fieldStepsHeaderCenter') }}
              </span>
              <HeadlessSwitch
                :model-value="stepsHeaderCentered"
                size="sm"
                @update:model-value="setNodeAttr('steps', 'headerAlign', $event ? 'center' : 'start')"
              />
            </div>
            <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldStepsContentAlign')">
              <BuilderSelect
                :model-value="stepsContentAlign"
                :options="stepsContentAlignOptions"
                button-class="h-8"
                @update:model-value="setNodeAttr('steps', 'contentAlign', $event)"
              />
            </ContentStudioInspectorFieldRow>
            <button type="button" :class="[ui.btnSecondary, 'w-full']" @click="addStep">
              {{ t('contentStudio.addStep') }}
            </button>
            <button
              type="button"
              :class="[ui.btnSecondary, 'mt-2 w-full text-danger-600 dark:text-danger-400']"
              @click="deleteStepsBlock"
            >
              {{ t('contentStudio.deleteSteps') }}
            </button>
          </template>

          <template v-if="activeBlockType === 'faqItem'">
            <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldFaqQuestion')">
              <input
                :value="faqQuestion"
                type="text"
                :class="[ui.input, 'h-8 text-sm']"
                @input="setNodeAttr('faqItem', 'question', $event.target.value)"
              />
            </ContentStudioInspectorFieldRow>
            <button type="button" :class="[ui.btnSecondary, 'w-full']" @click="addFaqItem">
              {{ t('contentStudio.addFaqItem') }}
            </button>
            <button
              type="button"
              :class="[ui.btnSecondary, 'mt-2 w-full text-danger-600 dark:text-danger-400']"
              @click="removeFaqItem"
            >
              {{ t('contentStudio.removeFaqItem') }}
            </button>
          </template>

          <template v-if="activeBlockType === 'faq'">
            <button type="button" :class="[ui.btnSecondary, 'w-full']" @click="addFaqItem">
              {{ t('contentStudio.addFaqItem') }}
            </button>
            <button
              type="button"
              :class="[ui.btnSecondary, 'mt-2 w-full text-danger-600 dark:text-danger-400']"
              @click="removeFaqBlock"
            >
              {{ t('contentStudio.deleteFaq') }}
            </button>
          </template>

          <template v-if="activeBlockType === 'relatedArticles'">
            <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldRelatedArticlesTitle')">
              <input
                :value="relatedArticlesTitle"
                type="text"
                :class="[ui.input, 'h-8 text-sm']"
                @input="setNodeAttr('relatedArticles', 'title', $event.target.value)"
              />
            </ContentStudioInspectorFieldRow>
            <div class="space-y-2">
              <input
                v-model="relatedArticleSearch"
                type="search"
                :class="[ui.input, 'h-8 text-sm']"
                :placeholder="t('contentStudio.searchArticlesToLink')"
                @input="scheduleRelatedArticleSearch"
              />
              <ul v-if="relatedArticleResults.length" class="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-neutral-200 p-2 dark:border-neutral-700">
                <li v-for="article in relatedArticleResults" :key="article._id">
                  <button
                    type="button"
                    class="w-full rounded px-2 py-1.5 text-left text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    @click="addRelatedArticle(article)"
                  >
                    {{ article.title }}
                  </button>
                </li>
              </ul>
            </div>
            <ul v-if="relatedArticlesItems.length" class="space-y-2">
              <li
                v-for="item in relatedArticlesItems"
                :key="item.id"
                class="flex items-center justify-between gap-2 rounded-lg border border-neutral-200 px-2 py-1.5 text-xs dark:border-neutral-700"
              >
                <span class="truncate text-neutral-800 dark:text-neutral-200">{{ item.title }}</span>
                <button type="button" class="shrink-0 text-danger-600 dark:text-danger-400" @click="removeRelatedArticle(item.id)">
                  {{ t('actions.remove') }}
                </button>
              </li>
            </ul>
            <p v-else class="text-xs text-neutral-500">{{ t('contentStudio.relatedArticlesEmpty') }}</p>
          </template>

          <template v-if="activeBlockType === 'timelineItem'">
            <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldTimelineTitle')">
              <input
                :value="timelineTitle"
                type="text"
                :class="[ui.input, 'h-8 text-sm']"
                @input="setNodeAttr('timelineItem', 'title', $event.target.value)"
              />
            </ContentStudioInspectorFieldRow>
            <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldTimelineDate')">
              <input
                :value="timelineDate"
                type="text"
                :class="[ui.input, 'h-8 text-sm']"
                @input="setNodeAttr('timelineItem', 'date', $event.target.value)"
              />
            </ContentStudioInspectorFieldRow>
            <button type="button" :class="[ui.btnSecondary, 'w-full']" @click="addTimelineItem">
              {{ t('contentStudio.addTimelineItem') }}
            </button>
            <button
              type="button"
              :class="[ui.btnSecondary, 'mt-2 w-full text-danger-600 dark:text-danger-400']"
              @click="removeTimelineItem"
            >
              {{ t('contentStudio.removeTimelineItem') }}
            </button>
          </template>

          <template v-if="activeBlockType === 'timeline'">
            <button type="button" :class="[ui.btnSecondary, 'w-full']" @click="addTimelineItem">
              {{ t('contentStudio.addTimelineItem') }}
            </button>
          </template>

          <template v-if="activeBlockType === 'tabItem' || activeBlockType === 'tabs'">
            <ContentStudioInspectorFieldRow v-if="activeBlockType === 'tabItem'" :label="t('contentStudio.fieldTabLabel')">
              <input :value="tabLabel" type="text" :class="[ui.input, 'h-8 text-sm']" @input="setNodeAttr('tabItem', 'label', $event.target.value)" />
            </ContentStudioInspectorFieldRow>
            <button type="button" :class="[ui.btnSecondary, 'w-full']" @click="addTabItem">
              {{ t('contentStudio.addTab') }}
            </button>
            <button
              v-if="activeBlockType === 'tabItem'"
              type="button"
              :class="[ui.btnSecondary, 'mt-2 w-full']"
              @click="removeTabItem"
            >
              {{ t('contentStudio.removeTab') }}
            </button>
          </template>

          <template v-if="activeBlockType === 'columns'">
            <button type="button" :class="[ui.btnSecondary, 'w-full']" @click="addColumn">
              {{ t('contentStudio.addColumn') }}
            </button>
          </template>

          <template v-if="activeBlockType === 'section'">
            <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldSectionVariant')">
              <BuilderSelect
                :model-value="sectionVariant"
                :options="sectionVariantOptions"
                button-class="h-8"
                @update:model-value="setNodeAttr('section', 'variant', $event)"
              />
            </ContentStudioInspectorFieldRow>
          </template>

          <template v-if="activeBlockType === 'toc'">
            <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldTocTitle')">
              <input :value="tocTitle" type="text" :class="[ui.input, 'h-8 text-sm']" @input="setNodeAttr('toc', 'title', $event.target.value)" />
            </ContentStudioInspectorFieldRow>
            <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldTocMinLevel')">
              <BuilderSelect
                :model-value="tocMinLevel"
                :options="headingLevelOptions"
                button-class="h-8"
                @update:model-value="setNodeAttr('toc', 'minLevel', Number($event))"
              />
            </ContentStudioInspectorFieldRow>
            <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldTocMaxLevel')">
              <BuilderSelect
                :model-value="tocMaxLevel"
                :options="headingLevelOptions"
                button-class="h-8"
                @update:model-value="setNodeAttr('toc', 'maxLevel', Number($event))"
              />
            </ContentStudioInspectorFieldRow>
          </template>

          <template v-if="activeBlockType === 'form'">
            <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldFormTitle')">
              <input :value="formTitle" type="text" :class="[ui.input, 'h-8 text-sm']" @input="setNodeAttr('form', 'title', $event.target.value)" />
            </ContentStudioInspectorFieldRow>
            <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldFormDescription')">
              <input :value="formDescription" type="text" :class="[ui.input, 'h-8 text-sm']" @input="setNodeAttr('form', 'description', $event.target.value)" />
            </ContentStudioInspectorFieldRow>
            <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldFormSubmitLabel')">
              <input :value="formSubmitLabel" type="text" :class="[ui.input, 'h-8 text-sm']" @input="setNodeAttr('form', 'submitLabel', $event.target.value)" />
            </ContentStudioInspectorFieldRow>
          </template>

          <template v-if="activeBlockType === 'social'">
            <ContentStudioInspectorFieldRow label="Twitter">
              <input :value="socialTwitter" type="url" :class="[ui.input, 'h-8 text-sm']" @input="setNodeAttr('social', 'twitter', $event.target.value)" />
            </ContentStudioInspectorFieldRow>
            <ContentStudioInspectorFieldRow label="LinkedIn">
              <input :value="socialLinkedin" type="url" :class="[ui.input, 'h-8 text-sm']" @input="setNodeAttr('social', 'linkedin', $event.target.value)" />
            </ContentStudioInspectorFieldRow>
          </template>

          <template v-if="activeBlockType === 'rating'">
            <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldRatingLabel')">
              <input :value="ratingLabel" type="text" :class="[ui.input, 'h-8 text-sm']" @input="setNodeAttr('rating', 'label', $event.target.value)" />
            </ContentStudioInspectorFieldRow>
            <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldRatingValue')">
              <input :value="ratingValue" type="number" step="0.1" min="0" :class="[ui.input, 'h-8 text-sm']" @change="setNodeAttr('rating', 'value', Number($event.target.value))" />
            </ContentStudioInspectorFieldRow>
          </template>

          <template v-if="activeBlockType === 'progress'">
            <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldProgressLabel')">
              <input :value="progressLabel" type="text" :class="[ui.input, 'h-8 text-sm']" @input="setNodeAttr('progress', 'label', $event.target.value)" />
            </ContentStudioInspectorFieldRow>
            <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldProgressValue')">
              <input :value="progressValue" type="number" min="0" max="100" :class="[ui.input, 'h-8 text-sm']" @change="setNodeAttr('progress', 'value', Number($event.target.value))" />
            </ContentStudioInspectorFieldRow>
          </template>

          <template v-if="activeBlockType === 'hero'">
            <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldHeroTitle')">
              <input :value="heroTitle" type="text" :class="[ui.input, 'h-8 text-sm']" @input="setNodeAttr('hero', 'title', $event.target.value)" />
            </ContentStudioInspectorFieldRow>
            <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldHeroSubtitle')">
              <input :value="heroSubtitle" type="text" :class="[ui.input, 'h-8 text-sm']" @input="setNodeAttr('hero', 'subtitle', $event.target.value)" />
            </ContentStudioInspectorFieldRow>
            <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldHeroImageUrl')">
              <input :value="heroImageUrl" type="url" :class="[ui.input, 'h-8 text-sm']" @input="setNodeAttr('hero', 'imageUrl', $event.target.value)" />
            </ContentStudioInspectorFieldRow>
            <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldHeroButtonLabel')">
              <input :value="heroButtonLabel" type="text" :class="[ui.input, 'h-8 text-sm']" @input="setNodeAttr('hero', 'buttonLabel', $event.target.value)" />
            </ContentStudioInspectorFieldRow>
            <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldHeroButtonHref')">
              <input :value="heroButtonHref" type="url" :class="[ui.input, 'h-8 text-sm']" @input="setNodeAttr('hero', 'buttonHref', $event.target.value)" />
            </ContentStudioInspectorFieldRow>
          </template>

          <template v-if="activeBlockType === 'newsletterSignup'">
            <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldNewsletterTitle')">
              <input :value="newsletterTitle" type="text" :class="[ui.input, 'h-8 text-sm']" @input="setNodeAttr('newsletterSignup', 'title', $event.target.value)" />
            </ContentStudioInspectorFieldRow>
            <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldNewsletterDescription')">
              <input :value="newsletterDescription" type="text" :class="[ui.input, 'h-8 text-sm']" @input="setNodeAttr('newsletterSignup', 'description', $event.target.value)" />
            </ContentStudioInspectorFieldRow>
            <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldNewsletterPlaceholder')">
              <input :value="newsletterPlaceholder" type="text" :class="[ui.input, 'h-8 text-sm']" @input="setNodeAttr('newsletterSignup', 'placeholder', $event.target.value)" />
            </ContentStudioInspectorFieldRow>
            <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldNewsletterButtonLabel')">
              <input :value="newsletterButtonLabel" type="text" :class="[ui.input, 'h-8 text-sm']" @input="setNodeAttr('newsletterSignup', 'buttonLabel', $event.target.value)" />
            </ContentStudioInspectorFieldRow>
          </template>

          <template v-if="activeBlockType === 'table'">
            <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldTableWidth')">
              <input
                :value="tableWidth"
                type="text"
                :placeholder="t('contentStudio.tableWidthPlaceholder')"
                :class="[ui.input, 'h-8 text-sm']"
                @change="updateTableWidth($event.target.value)"
              />
            </ContentStudioInspectorFieldRow>

            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="rounded-md bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                {{ t('contentStudio.tableDimensions', { rows: tableDimensions.rows, cols: tableDimensions.cols }) }}
              </span>
              <div class="flex items-center gap-2">
                <span class="text-xs text-neutral-600 dark:text-neutral-300">
                  {{ t('contentStudio.fieldTableHeaderRow') }}
                </span>
                <HeadlessSwitch
                  :model-value="tableHasHeader"
                  size="sm"
                  @update:model-value="toggleTableHeader($event)"
                />
              </div>
            </div>

            <div class="flex flex-wrap gap-1.5">
              <button type="button" :class="tableActionBtnClass" @click="addTableRow">
                {{ t('contentStudio.addTableRow') }}
              </button>
              <button type="button" :class="tableActionBtnClass" @click="addTableColumn">
                {{ t('contentStudio.addTableColumn') }}
              </button>
              <button type="button" :class="tableDangerBtnClass" @click="removeCurrentTableRow">
                {{ t('contentStudio.deleteTableRow') }}
              </button>
              <button type="button" :class="tableDangerBtnClass" @click="removeCurrentTableColumn">
                {{ t('contentStudio.deleteTableColumn') }}
              </button>
            </div>
            <button type="button" class="text-xs font-medium text-danger-600 hover:text-danger-700 dark:text-danger-400" @click="removeTableBlock">
              {{ t('contentStudio.deleteTable') }}
            </button>
          </template>
        </div>
      </BuilderDisclosureSection>

      <BuilderDisclosureSection
        v-if="activeBlockType === 'table' && tableContext"
        :title="t('contentStudio.sectionTableCellSettings')"
        :bordered="false"
      >
        <div class="space-y-2.5">
          <span class="inline-flex rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
            {{ t('contentStudio.tableCellPosition', { row: tableContext.rowIndex, col: tableContext.colIndex }) }}
          </span>

          <ContentStudioInspectorTypography
            :font-size="tableCellFontSize"
            :text-color="tableCellTextColor"
            :line-height="tableCellLineHeight"
            :background-color="tableCellBackground"
            show-background
            @update:typography="updateTableCellLayout"
          />

          <div class="flex flex-wrap items-center justify-between gap-2">
            <ContentStudioInspectorAlignment
              :value="tableCellTextAlign"
              @update:value="updateTableCellLayout({ textAlign: $event })"
            />
            <div class="flex items-center gap-2">
              <span class="text-xs text-neutral-600 dark:text-neutral-300">
                {{ t('contentStudio.fieldTableCellHeader') }}
              </span>
              <HeadlessSwitch
                :model-value="tableCellIsHeader"
                size="sm"
                @update:model-value="updateTableCellLayout({ isHeader: $event })"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldColspan')">
              <input
                :value="tableCellColspan"
                type="number"
                min="1"
                max="12"
                :class="[ui.input, 'h-7 w-full text-xs']"
                @change="updateTableCellLayout({ colspan: Number($event.target.value) || 1 })"
              />
            </ContentStudioInspectorFieldRow>
            <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldRowspan')">
              <input
                :value="tableCellRowspan"
                type="number"
                min="1"
                max="12"
                :class="[ui.input, 'h-7 w-full text-xs']"
                @change="updateTableCellLayout({ rowspan: Number($event.target.value) || 1 })"
              />
            </ContentStudioInspectorFieldRow>
          </div>

          <div class="border-t border-neutral-100 pt-2.5 dark:border-neutral-800">
            <p class="mb-2 text-[11px] font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
              {{ t('contentStudio.sectionTableRowColumnSettings') }}
            </p>
            <div class="space-y-2">
              <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldRowBackground')" wide>
                <div class="flex w-full items-center gap-1.5">
                  <input
                    type="color"
                    :value="tableRowBackground || '#ffffff'"
                    class="h-7 w-8 shrink-0 cursor-pointer rounded border border-neutral-200 bg-white p-0.5 dark:border-neutral-700 dark:bg-neutral-950"
                    @input="updateTableRowLayout({ backgroundColor: $event.target.value || null })"
                  />
                  <input
                    type="text"
                    :value="tableRowBackground"
                    :placeholder="t('contentStudio.backgroundColorPlaceholder')"
                    :class="[ui.input, 'h-7 min-w-0 flex-1 text-xs']"
                    @change="updateTableRowLayout({ backgroundColor: $event.target.value || null })"
                  />
                </div>
              </ContentStudioInspectorFieldRow>

              <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldColumnBackground')" wide>
                <div class="flex w-full items-center gap-1.5">
                  <input
                    type="color"
                    :value="tableColumnBackground || '#ffffff'"
                    class="h-7 w-8 shrink-0 cursor-pointer rounded border border-neutral-200 bg-white p-0.5 dark:border-neutral-700 dark:bg-neutral-950"
                    @input="updateTableColumnLayout({ backgroundColor: $event.target.value || null })"
                  />
                  <input
                    type="text"
                    :value="tableColumnBackground"
                    :placeholder="t('contentStudio.backgroundColorPlaceholder')"
                    :class="[ui.input, 'h-7 min-w-0 flex-1 text-xs']"
                    @change="updateTableColumnLayout({ backgroundColor: $event.target.value || null })"
                  />
                </div>
              </ContentStudioInspectorFieldRow>

              <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldColumnWidth')">
                <input
                  :value="tableColumnWidth"
                  type="text"
                  :placeholder="t('contentStudio.columnWidthPlaceholder')"
                  :class="[ui.input, 'h-7 text-xs']"
                  @change="updateTableColumnLayout({ colWidth: $event.target.value || null })"
                />
              </ContentStudioInspectorFieldRow>

              <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldAlignment')">
                <ContentStudioInspectorAlignment
                  :value="tableColumnTextAlign"
                  @update:value="updateTableColumnLayout({ textAlign: $event })"
                />
              </ContentStudioInspectorFieldRow>
            </div>
          </div>
        </div>
      </BuilderDisclosureSection>

      <BuilderDisclosureSection
        v-if="blockMeta.spacing"
        :title="t('contentStudio.sectionSpacing')"
        :default-open="activeBlockType !== 'table'"
      >
        <ContentStudioInspectorSpacing
          :margin-top="layoutMarginTop"
          :margin-bottom="layoutMarginBottom"
          :padding="layoutPadding"
          :compact="activeBlockType === 'table'"
          @update:spacing="updateLayoutAttrs"
        />
      </BuilderDisclosureSection>

      <BuilderDisclosureSection
        v-if="blockMeta.advanced"
        :title="t('contentStudio.sectionAdvanced')"
        :default-open="false"
      >
        <div class="space-y-3">
          <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldCssClass')">
            <input
              :value="blockCssClass"
              type="text"
              :class="[ui.input, 'h-8 text-sm']"
              :placeholder="t('contentStudio.cssClassPlaceholder')"
              @input="emit('update:blockAttributes', { cssClass: $event.target.value || null })"
            />
          </ContentStudioInspectorFieldRow>
          <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldAnchorId')">
            <input
              :value="blockAnchorId"
              type="text"
              :class="[ui.input, 'h-8 text-sm']"
              :placeholder="t('contentStudio.anchorPlaceholder')"
              @input="emit('update:blockAttributes', { anchorId: $event.target.value || null })"
            />
          </ContentStudioInspectorFieldRow>
        </div>
      </BuilderDisclosureSection>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useBuilderUi } from '@/composables/useBuilderUi';
import HeadlessSwitch from '@/components/ui/HeadlessSwitch.vue';
import BuilderDisclosureSection from '@/modules/template/components/BuilderDisclosureSection.vue';
import BuilderSelect from '@/modules/template/components/BuilderSelect.vue';
import ContentStudioInspectorFieldRow from './ContentStudioInspectorControls.vue';
import ContentStudioInspectorAlignment from './ContentStudioInspectorAlignment.vue';
import ContentStudioInspectorSpacing from './ContentStudioInspectorSpacing.vue';
import ContentStudioInspectorTypography from './ContentStudioInspectorTypography.vue';
import {
  applyBlockLayoutAttributes,
  normalizeBlockLayoutAttrs,
  runInspectorEditorCommand,
  updateInspectorNodeAttributes,
} from '../editor/blockLayout';
import { BLOCK_INSPECTOR_META } from '../editor/blockInspectorMeta';
import { normalizeGalleryLayout } from '../editor/layoutBlocksExtension';
import {
  addFaqItem as insertFaqItem,
  removeFaqItem as deleteFaqItem,
  deleteFaq as removeFaq,
  addStep as insertStep,
  removeStep as deleteStep,
  deleteSteps as removeSteps,
  addTimelineItem as insertTimelineItem,
  removeTimelineItem as deleteTimelineItem,
  removeGalleryImage as deleteGalleryImage,
  getGalleryImageCount,
  isEditorInGallery,
  addTabItem as insertTabItem,
  removeTabItem as deleteTabItem,
  addColumn as insertColumn,
  addTableColumn as insertTableColumn,
  addTableRow as insertTableRow,
  deleteTable as removeTable,
  deleteTableColumn as removeTableColumn,
  deleteTableRow as removeTableRow,
  getTableDimensions,
  setTableHeaderRow,
  tableHasHeaderRow,
} from '../editor/blockCommands';
import {
  getTableSelectionContext,
  updateActiveTableAttrs,
  updateTableCellAttrs,
  updateTableColumnAttrs,
  updateTableRowAttrs,
} from '../editor/tableAttributes';
import { listContentDocuments } from '../services/contentStudioApi';

const props = defineProps({
  editor: { type: Object, default: null },
  activeBlockType: { type: String, default: 'paragraph' },
  selectionRevision: { type: Number, default: 0 },
  blockAnchorId: { type: String, default: '' },
  blockCssClass: { type: String, default: '' },
});

const emit = defineEmits(['update:blockAttributes', 'structure-change', 'request-image-upload']);

const { t } = useI18n();
const ui = useBuilderUi();
const tableActionBtnClass = `${ui.btnSecondary} h-7 flex-1 px-2 text-xs`;
const tableDangerBtnClass = `${ui.btnSecondary} h-7 flex-1 px-2 text-xs text-danger-600 dark:text-danger-400`;
const layoutRevision = ref(0);
const layoutSelection = ref(null);

const headingLevelOptions = [
  { value: 1, label: 'H1' },
  { value: 2, label: 'H2' },
  { value: 3, label: 'H3' },
  { value: 4, label: 'H4' },
];

const blockWidthOptions = computed(() => [
  { value: 'content', label: t('contentStudio.widthContent') },
  { value: 'wide', label: t('contentStudio.widthWide') },
  { value: 'full', label: t('contentStudio.widthFull') },
]);

const galleryLayoutOptions = computed(() => [
  { value: 'grid', label: t('contentStudio.galleryLayoutGrid') },
  { value: 'scroll', label: t('contentStudio.galleryLayoutScroll') },
  { value: 'carousel', label: t('contentStudio.galleryLayoutCarousel') },
]);

const listStyleOptions = computed(() => [
  { value: 'bullet', label: t('contentStudio.listBullet') },
  { value: 'ordered', label: t('contentStudio.listNumbered') },
]);

const calloutVariantOptions = computed(() => [
  { value: 'info', label: t('contentStudio.calloutInfo') },
  { value: 'tip', label: t('contentStudio.calloutTip') },
  { value: 'warning', label: t('contentStudio.calloutWarning') },
]);

const embedWidthOptions = computed(() => [
  { value: 'small', label: t('contentStudio.embedWidthSmall') },
  { value: 'medium', label: t('contentStudio.embedWidthMedium') },
  { value: 'large', label: t('contentStudio.embedWidthLarge') },
  { value: 'full', label: t('contentStudio.embedWidthFull') },
]);

const stepsOrientationOptions = computed(() => [
  { value: 'vertical', label: t('contentStudio.stepsOrientationVertical') },
  { value: 'horizontal', label: t('contentStudio.stepsOrientationHorizontal') },
]);

const stepsTitleLayoutOptions = computed(() => [
  { value: 'inline', label: t('contentStudio.stepsTitleLayoutInline') },
  { value: 'below', label: t('contentStudio.stepsTitleLayoutBelow') },
]);

const stepsContentAlignOptions = computed(() => [
  { value: 'start', label: t('contentStudio.alignLeft') },
  { value: 'center', label: t('contentStudio.alignCenter') },
  { value: 'end', label: t('contentStudio.alignRight') },
]);

const sectionVariantOptions = computed(() => [
  { value: 'default', label: t('contentStudio.sectionVariantDefault') },
  { value: 'muted', label: t('contentStudio.sectionVariantMuted') },
  { value: 'highlight', label: t('contentStudio.sectionVariantHighlight') },
]);

watch(
  () => [props.selectionRevision, props.editor],
  () => {
    const ed = props.editor;
    if (!ed) return;
    layoutSelection.value = {
      from: ed.state.selection.from,
      to: ed.state.selection.to,
    };
  },
  { immediate: true },
);

const blockMeta = computed(() => BLOCK_INSPECTOR_META[props.activeBlockType] || BLOCK_INSPECTOR_META.paragraph);

const layoutNodeType = computed(() => {
  const ed = props.editor;
  const type = props.activeBlockType || 'paragraph';
  if (type === 'paragraph' && ed?.isActive('heading')) return 'heading';
  return type;
});

const hasBlockSettings = computed(() => {
  const type = props.activeBlockType;
  if (type === 'horizontalRule') return false;
  return true;
});

function editorAttrs(type) {
  void props.selectionRevision;
  void layoutRevision.value;
  return props.editor?.getAttributes(type) || {};
}

function layoutAttrString(key) {
  const value = editorAttrs(layoutNodeType.value)[key];
  return value == null || value === '' ? '' : String(value);
}

const layoutTextAlign = computed(() => editorAttrs(layoutNodeType.value).textAlign || 'left');
const layoutBlockWidth = computed(() => editorAttrs(layoutNodeType.value).blockWidth || 'content');
const layoutFontSize = computed(() => layoutAttrString('fontSize'));
const layoutTextColor = computed(() => layoutAttrString('textColor'));
const layoutLineHeight = computed(() => layoutAttrString('lineHeight'));
const layoutMarginTop = computed(() => Number(editorAttrs(layoutNodeType.value).marginTop || 0));
const layoutMarginBottom = computed(() => Number(editorAttrs(layoutNodeType.value).marginBottom || 0));
const layoutPadding = computed(() => Number(editorAttrs(layoutNodeType.value).padding || 0));

const headingLevel = computed(() => {
  void props.selectionRevision;
  const ed = props.editor;
  if (!ed) return 2;
  for (const level of [1, 2, 3, 4]) {
    if (ed.isActive('heading', { level })) return level;
  }
  return 2;
});

const calloutVariant = computed(() => editorAttrs('callout').variant || 'info');
const imageAlt = computed(() => editorAttrs('image').alt || '');
const imageTitle = computed(() => editorAttrs('image').title || '');
const imageSrc = computed(() => editorAttrs('image').src || '');
const galleryLayout = computed(() => normalizeGalleryLayout(editorAttrs('gallery').layout || 'grid'));
const isGalleryContext = computed(() => {
  void props.selectionRevision;
  return props.activeBlockType === 'gallery' || (props.editor && isEditorInGallery(props.editor));
});
const galleryImageCount = computed(() => {
  void props.selectionRevision;
  if (!props.editor) return 0;
  return getGalleryImageCount(props.editor);
});
const hasSelectedGalleryImage = computed(() => {
  void props.selectionRevision;
  return Boolean(props.editor?.isActive('image') && isEditorInGallery(props.editor));
});
const linkHref = computed(() => editorAttrs('link').href || '');
const embedSrc = computed(() => editorAttrs('embed').src || '');
const embedTitle = computed(() => editorAttrs('embed').title || '');
const embedInfo = computed(() => editorAttrs('embed').info || '');
const embedWidth = computed(() => editorAttrs('embed').embedWidth || 'full');
const embedHeight = computed(() => Number(editorAttrs('embed').height || 360));
const audioSrc = computed(() => editorAttrs('audio').src || '');
const audioTitle = computed(() => editorAttrs('audio').title || '');
const audioInfo = computed(() => editorAttrs('audio').info || '');
const fileLabel = computed(() => editorAttrs('file').label || '');
const fileHref = computed(() => editorAttrs('file').href || '');
const fileInfo = computed(() => editorAttrs('file').info || '');
const stepTitle = computed(() => editorAttrs('step').title || '');
const stepsOrientation = computed(() => editorAttrs('steps').orientation || 'vertical');
const stepsTitleLayout = computed(() => editorAttrs('steps').titleLayout || 'inline');
const stepsHeaderCentered = computed(() => editorAttrs('steps').headerAlign === 'center');
const stepsContentAlign = computed(() => editorAttrs('steps').contentAlign || 'start');
const faqQuestion = computed(() => editorAttrs('faqItem').question || '');
const timelineTitle = computed(() => editorAttrs('timelineItem').title || '');
const timelineDate = computed(() => editorAttrs('timelineItem').date || '');
const codeLanguage = computed(() => editorAttrs('codeBlock').language || '');
const tabLabel = computed(() => editorAttrs('tabItem').label || '');
const sectionVariant = computed(() => editorAttrs('section').variant || 'default');
const tocTitle = computed(() => editorAttrs('toc').title || '');
const tocMinLevel = computed(() => Number(editorAttrs('toc').minLevel || 2));
const tocMaxLevel = computed(() => Number(editorAttrs('toc').maxLevel || 3));
const formTitle = computed(() => editorAttrs('form').title || '');
const formDescription = computed(() => editorAttrs('form').description || '');
const formSubmitLabel = computed(() => editorAttrs('form').submitLabel || '');
const socialTwitter = computed(() => editorAttrs('social').twitter || '');
const socialLinkedin = computed(() => editorAttrs('social').linkedin || '');
const ratingLabel = computed(() => editorAttrs('rating').label || '');
const ratingValue = computed(() => Number(editorAttrs('rating').value || 0));
const progressLabel = computed(() => editorAttrs('progress').label || '');
const progressValue = computed(() => Number(editorAttrs('progress').value || 0));
const heroTitle = computed(() => editorAttrs('hero').title || '');
const heroSubtitle = computed(() => editorAttrs('hero').subtitle || '');
const heroImageUrl = computed(() => editorAttrs('hero').imageUrl || '');
const heroButtonLabel = computed(() => editorAttrs('hero').buttonLabel || '');
const heroButtonHref = computed(() => editorAttrs('hero').buttonHref || '');
const newsletterTitle = computed(() => editorAttrs('newsletterSignup').title || '');
const newsletterDescription = computed(() => editorAttrs('newsletterSignup').description || '');
const newsletterPlaceholder = computed(() => editorAttrs('newsletterSignup').placeholder || '');
const newsletterButtonLabel = computed(() => editorAttrs('newsletterSignup').buttonLabel || '');

const relatedArticlesTitle = computed(() => String(editorAttrs('relatedArticles').title || 'Related articles'));
const relatedArticlesItems = computed(() => {
  const items = editorAttrs('relatedArticles').items;
  return Array.isArray(items) ? items : [];
});
const relatedArticleSearch = ref('');
const relatedArticleResults = ref([]);
let relatedArticleSearchTimer = null;

const tableDimensions = computed(() => {
  void props.selectionRevision;
  if (!props.editor) return { rows: 0, cols: 0 };
  return getTableDimensions(props.editor);
});

const tableWidth = computed(() => {
  void props.selectionRevision;
  void layoutRevision.value;
  const value = editorAttrs('table').tableWidth;
  return value == null || value === '' ? '' : String(value);
});

const tableHasHeader = computed(() => {
  void props.selectionRevision;
  if (!props.editor) return false;
  return tableHasHeaderRow(props.editor);
});

const tableContext = computed(() => {
  void props.selectionRevision;
  void layoutRevision.value;
  if (!props.editor) return null;
  return getTableSelectionContext(props.editor);
});

function tableCellAttrString(key) {
  const value = tableContext.value?.cellAttrs?.[key];
  return value == null || value === '' ? '' : String(value);
}

const tableCellFontSize = computed(() => tableCellAttrString('fontSize'));
const tableCellTextColor = computed(() => tableCellAttrString('textColor'));
const tableCellLineHeight = computed(() => tableCellAttrString('lineHeight'));
const tableCellBackground = computed(() => tableCellAttrString('backgroundColor'));
const tableCellTextAlign = computed(() => tableContext.value?.cellAttrs?.textAlign || 'left');
const tableCellIsHeader = computed(() => tableContext.value?.cellType === 'tableHeader');
const tableCellColspan = computed(() => Number(tableContext.value?.cellAttrs?.colspan || 1));
const tableCellRowspan = computed(() => Number(tableContext.value?.cellAttrs?.rowspan || 1));
const tableRowBackground = computed(() => {
  const value = tableContext.value?.rowAttrs?.backgroundColor;
  return value == null || value === '' ? '' : String(value);
});
const tableColumnBackground = computed(() => tableCellBackground.value);
const tableColumnWidth = computed(() => {
  const colwidth = tableContext.value?.cellAttrs?.colwidth;
  if (Array.isArray(colwidth) && colwidth[0]) return String(colwidth[0]);
  return tableCellAttrString('colWidth');
});
const tableColumnTextAlign = computed(() => tableCellTextAlign.value);

function updateLayoutAttrs(partial) {
  const normalized = normalizeBlockLayoutAttrs(partial);
  applyBlockLayoutAttributes(props.editor, layoutNodeType.value, normalized, layoutSelection.value);
  layoutRevision.value += 1;
  emit('update:blockAttributes', normalized);
}

function setHeadingLevel(level) {
  runInspectorEditorCommand(props.editor, layoutSelection.value, (chain) =>
    chain.setHeading({ level }).run(),
  );
}

function setNodeAttr(type, key, value) {
  const updated = updateInspectorNodeAttributes(props.editor, type, { [key]: value }, layoutSelection.value);
  if (updated && type === 'steps' && (key === 'orientation' || key === 'titleLayout' || key === 'headerAlign' || key === 'contentAlign')) {
    layoutRevision.value += 1;
  }
}

function scheduleRelatedArticleSearch() {
  if (relatedArticleSearchTimer) window.clearTimeout(relatedArticleSearchTimer);
  relatedArticleSearchTimer = window.setTimeout(() => {
    void loadRelatedArticleResults();
  }, 300);
}

async function loadRelatedArticleResults() {
  const query = relatedArticleSearch.value.trim();
  if (query.length < 2) {
    relatedArticleResults.value = [];
    return;
  }
  try {
    const response = await listContentDocuments('articles', { search: query, limit: 8 });
    const selectedIds = new Set(relatedArticlesItems.value.map((item) => String(item.id)));
    relatedArticleResults.value = (response.items || []).filter((item) => !selectedIds.has(String(item._id)));
  } catch {
    relatedArticleResults.value = [];
  }
}

function addRelatedArticle(article) {
  if (!article?._id) return;
  const nextItems = [
    ...relatedArticlesItems.value,
    { id: String(article._id), title: String(article.title || 'Article'), slug: article.slug || '' },
  ];
  setNodeAttr('relatedArticles', 'items', nextItems);
  relatedArticleResults.value = relatedArticleResults.value.filter((row) => String(row._id) !== String(article._id));
}

function removeRelatedArticle(articleId) {
  const nextItems = relatedArticlesItems.value.filter((item) => String(item.id) !== String(articleId));
  setNodeAttr('relatedArticles', 'items', nextItems);
}

function updateTableWidth(value) {
  if (updateActiveTableAttrs(props.editor, { tableWidth: value || null }, layoutSelection.value)) {
    layoutRevision.value += 1;
  }
}

function setEmbedAttr(key, value) {
  if (key === 'src') {
    const nextValue = String(value || '').trim();
    if (!nextValue) return;
    setNodeAttr('embed', key, nextValue);
    return;
  }
  setNodeAttr('embed', key, value);
}

function setAudioAttr(key, value) {
  if (key === 'src') {
    const nextValue = String(value || '').trim();
    if (!nextValue) return;
    setNodeAttr('audio', key, nextValue);
    return;
  }
  setNodeAttr('audio', key, value);
}

function setFileAttr(key, value) {
  if (key === 'href') {
    const nextValue = String(value || '').trim();
    if (!nextValue) return;
    setNodeAttr('file', key, nextValue);
    return;
  }
  setNodeAttr('file', key, value);
}

function setListStyle(style) {
  runInspectorEditorCommand(props.editor, layoutSelection.value, (chain) => {
    if (style === 'ordered') return chain.toggleOrderedList().run();
    return chain.toggleBulletList().run();
  });
}

function setLinkHref(href) {
  if (!href) return;
  runInspectorEditorCommand(props.editor, layoutSelection.value, (chain) =>
    chain.extendMarkRange('link').setLink({ href }).run(),
  );
}

function removeLink() {
  runInspectorEditorCommand(props.editor, layoutSelection.value, (chain) => chain.unsetLink().run());
}

function addStep() {
  if (insertStep(props.editor)) emit('structure-change');
}

function removeStep() {
  if (deleteStep(props.editor)) emit('structure-change');
}

function deleteStepsBlock() {
  if (removeSteps(props.editor)) emit('structure-change');
}

function addFaqItem() {
  if (insertFaqItem(props.editor)) emit('structure-change');
}

function removeFaqItem() {
  if (deleteFaqItem(props.editor)) emit('structure-change');
}

function removeFaqBlock() {
  if (removeFaq(props.editor)) emit('structure-change');
}

function addTimelineItem() {
  if (insertTimelineItem(props.editor)) emit('structure-change');
}

function removeTimelineItem() {
  if (deleteTimelineItem(props.editor)) emit('structure-change');
}

function requestGalleryImage(intent) {
  emit('request-image-upload', intent);
}

function removeGalleryImageFromBlock() {
  if (deleteGalleryImage(props.editor)) emit('structure-change');
}

function addTabItem() {
  if (insertTabItem(props.editor)) emit('structure-change');
}

function removeTabItem() {
  if (deleteTabItem(props.editor)) emit('structure-change');
}

function addColumn() {
  if (insertColumn(props.editor)) emit('structure-change');
}

function addTableRow() {
  if (insertTableRow(props.editor)) emit('structure-change');
}

function addTableColumn() {
  if (insertTableColumn(props.editor)) emit('structure-change');
}

function removeTableBlock() {
  if (removeTable(props.editor)) emit('structure-change');
}

function removeCurrentTableRow() {
  if (removeTableRow(props.editor)) emit('structure-change');
}

function removeCurrentTableColumn() {
  if (removeTableColumn(props.editor)) emit('structure-change');
}

function toggleTableHeader(enabled) {
  if (setTableHeaderRow(props.editor, enabled)) emit('structure-change');
}

function updateTableCellLayout(partial) {
  if (updateTableCellAttrs(props.editor, partial, layoutSelection.value)) {
    layoutRevision.value += 1;
  }
}

function updateTableRowLayout(partial) {
  if (updateTableRowAttrs(props.editor, partial, layoutSelection.value)) {
    layoutRevision.value += 1;
  }
}

function updateTableColumnLayout(partial) {
  if (updateTableColumnAttrs(props.editor, partial, layoutSelection.value)) {
    layoutRevision.value += 1;
  }
}
</script>
