<template>
  <SettingsScrollPanel :save-bar-visible="dirty">
    <template #header>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="flex min-w-0 flex-1 items-start gap-3">
          <button
            type="button"
            class="mt-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            :title="t('settings.addonsBackToHub')"
            @click="emit('back')"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('settings.addonsArticlesSettingsTitle') }}</h2>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.addonsArticlesSettingsDesc') }}</p>
          </div>
        </div>
      </div>
    </template>

    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600"></div>
    </div>

    <div v-else-if="error" class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
      <p class="text-sm text-red-800 dark:text-red-300">{{ error }}</p>
    </div>

    <div v-else class="max-w-3xl space-y-6">
      <div class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.addonsArticlesAppearanceTitle') }}</h3>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.addonsArticlesAppearanceDesc') }}</p>

        <div class="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <label class="block text-sm text-gray-600 dark:text-gray-300 lg:col-span-2">
            {{ t('settings.addonsArticlesLayoutPreset') }}
            <select
              v-model="form.appearance.layoutPreset"
              class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              @change="syncDirty"
            >
              <option value="classic">{{ t('settings.addonsArticlesLayoutClassic') }}</option>
              <option value="help_center">{{ t('settings.addonsArticlesLayoutHelpCenter') }}</option>
              <option value="minimal">{{ t('settings.addonsArticlesLayoutMinimal') }}</option>
            </select>
          </label>

          <label class="block text-sm text-gray-600 dark:text-gray-300">
            {{ t('settings.addonsArticlesPrimaryColor') }}
            <div class="mt-1 flex items-center gap-2">
              <input v-model="form.appearance.primaryColor" type="color" class="h-10 w-12 cursor-pointer rounded border border-gray-300 dark:border-gray-600" @input="syncDirty" />
              <input v-model="form.appearance.primaryColor" type="text" class="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900" @input="syncDirty" />
            </div>
          </label>

          <label class="block text-sm text-gray-600 dark:text-gray-300">
            {{ t('settings.addonsArticlesSecondaryColor') }}
            <div class="mt-1 flex items-center gap-2">
              <input v-model="form.appearance.secondaryColor" type="color" class="h-10 w-12 cursor-pointer rounded border border-gray-300 dark:border-gray-600" @input="syncDirty" />
              <input v-model="form.appearance.secondaryColor" type="text" class="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900" @input="syncDirty" />
            </div>
          </label>

          <label class="block text-sm text-gray-600 dark:text-gray-300">
            {{ t('settings.addonsArticlesBodyFont') }}
            <input v-model="form.appearance.bodyFont" type="text" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900" @input="syncDirty" />
          </label>

          <label class="block text-sm text-gray-600 dark:text-gray-300">
            {{ t('settings.addonsArticlesHeadingFont') }}
            <input v-model="form.appearance.headingFont" type="text" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900" @input="syncDirty" />
          </label>

          <label class="block text-sm text-gray-600 dark:text-gray-300 sm:col-span-2">
            {{ t('settings.addonsArticlesContentWidth') }}
            <select v-model="form.appearance.contentWidth" class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900" @change="syncDirty">
              <option value="narrow">{{ t('settings.contentPublishingWidthNarrow') }}</option>
              <option value="standard">{{ t('settings.contentPublishingWidthStandard') }}</option>
              <option value="wide">{{ t('settings.contentPublishingWidthWide') }}</option>
            </select>
          </label>

          <label class="block text-sm text-gray-600 dark:text-gray-300">
            {{ t('settings.addonsArticlesBorderRadius') }}
            <select v-model="form.appearance.borderRadius" class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900" @change="syncDirty">
              <option value="none">{{ t('settings.contentPublishingRadiusNone') }}</option>
              <option value="sm">{{ t('settings.contentPublishingRadiusSm') }}</option>
              <option value="md">{{ t('settings.contentPublishingRadiusMd') }}</option>
              <option value="lg">{{ t('settings.contentPublishingRadiusLg') }}</option>
            </select>
          </label>

          <label class="block text-sm text-gray-600 dark:text-gray-300">
            {{ t('settings.addonsArticlesDefaultCoverPosition') }}
            <select v-model="form.appearance.defaultCoverPosition" class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900" @change="syncDirty">
              <option value="below-title">{{ t('settings.addonsArticlesCoverBelowTitle') }}</option>
              <option value="above-title">{{ t('settings.addonsArticlesCoverAboveTitle') }}</option>
            </select>
          </label>

          <label class="block text-sm text-gray-600 dark:text-gray-300">
            {{ t('settings.addonsArticlesDefaultSubtitleSize') }}
            <select v-model="form.appearance.defaultSubtitleSize" class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900" @change="syncDirty">
              <option value="sm">{{ t('settings.addonsArticlesSubtitleSm') }}</option>
              <option value="md">{{ t('settings.addonsArticlesSubtitleMd') }}</option>
              <option value="lg">{{ t('settings.addonsArticlesSubtitleLg') }}</option>
              <option value="xl">{{ t('settings.addonsArticlesSubtitleXl') }}</option>
            </select>
          </label>

          <label class="block text-sm text-gray-600 dark:text-gray-300 lg:col-span-2">
            {{ t('settings.addonsArticlesLogoUrl') }}
            <input v-model="form.appearance.logoUrl" type="url" class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900" @input="syncDirty" />
          </label>

          <label class="flex items-center justify-between gap-4 lg:col-span-2">
            <span class="text-sm text-gray-700 dark:text-gray-200">{{ t('settings.addonsArticlesShowLogoInHeader') }}</span>
            <button
              type="button"
              role="switch"
              :aria-checked="form.appearance.showLogoInHeader"
              class="relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors"
              :class="form.appearance.showLogoInHeader ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'"
              @click="form.appearance.showLogoInHeader = !form.appearance.showLogoInHeader; syncDirty()"
            >
              <span
                class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition"
                :class="form.appearance.showLogoInHeader ? 'translate-x-5' : 'translate-x-0'"
              />
            </button>
          </label>
        </div>

        <div
          class="content-studio-article mt-5 rounded-xl border border-dashed border-gray-300 p-4 dark:border-gray-600"
          :class="previewClass"
          :style="previewStyle"
        >
          <div v-if="form.appearance.showLogoInHeader && form.appearance.logoUrl" class="content-studio-article__brand mb-3">
            <img :src="form.appearance.logoUrl" alt="" class="content-studio-article__logo max-h-8" />
          </div>
          <div class="content-studio-article__body">
            <p class="text-xs font-medium uppercase tracking-wide text-gray-500">{{ t('settings.addonsArticlesAppearancePreviewLabel') }}</p>
            <h4 class="mt-2 text-lg font-semibold" :style="{ color: form.appearance.primaryColor, fontFamily: form.appearance.headingFont }">
              {{ t('settings.addonsArticlesAppearancePreviewTitle') }}
            </h4>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-300" :style="{ fontFamily: form.appearance.bodyFont }">
              {{ t('settings.addonsArticlesAppearancePreviewBody') }}
            </p>
            <a href="#" class="mt-2 inline-block text-sm" :style="{ color: form.appearance.secondaryColor }">{{ t('settings.addonsArticlesAppearancePreviewLink') }}</a>
          </div>
        </div>
      </div>

      <div class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.addonsArticlesPublishingTitle') }}</h3>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.addonsArticlesPublishingDesc') }}</p>

        <div class="mt-5 space-y-4">
          <label class="flex items-center justify-between gap-4">
            <span class="text-sm text-gray-700 dark:text-gray-200">{{ t('settings.addonsArticlesPortalPublishing') }}</span>
            <button
              type="button"
              role="switch"
              :aria-checked="form.portalPublishing"
              class="relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors"
              :class="form.portalPublishing ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'"
              @click="form.portalPublishing = !form.portalPublishing; syncDirty()"
            >
              <span
                class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition"
                :class="form.portalPublishing ? 'translate-x-5' : 'translate-x-0'"
              />
            </button>
          </label>
        </div>
      </div>

      <div class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.contentPublishingIntegrationTitle') }}</h3>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.addonsArticlesHeadlessPublishingDesc') }}</p>
        <p
          v-if="integrationUrlsUnavailable"
          class="mt-2 text-sm text-amber-700 dark:text-amber-300"
        >
          {{ t('settings.addonsArticlesIntegrationUrlsUnavailable') }}
        </p>

        <div class="mt-5 space-y-4 text-sm">
          <div v-for="endpoint in integrationEndpoints" :key="endpoint.key">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <p class="font-medium text-gray-900 dark:text-white">{{ endpoint.label }}</p>
                <p class="mt-1 break-all text-gray-600 dark:text-gray-400">{{ endpoint.value || '—' }}</p>
              </div>
              <button
                v-if="endpoint.value"
                type="button"
                class="shrink-0 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                @click="copyText(endpoint.value, endpoint.label)"
              >
                {{ t('settings.addonsArticlesCopyUrl') }}
              </button>
            </div>
          </div>
          <label class="block text-sm text-gray-600 dark:text-gray-300">
            {{ t('settings.contentPublishingWebhookUrl') }}
            <input
              v-model="form.publishWebhookUrl"
              type="url"
              class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
              placeholder="https://example.com/hooks/content-published"
              @input="syncDirty"
            />
            <span class="mt-1 block text-xs text-gray-500 dark:text-gray-400">{{ t('settings.addonsArticlesWebhookDesc') }}</span>
          </label>
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              :disabled="!form.publishWebhookUrl || webhookTesting"
              @click="sendTestWebhook"
            >
              {{ webhookTesting ? t('settings.addonsArticlesWebhookTesting') : t('settings.addonsArticlesSendTestWebhook') }}
            </button>
          </div>
          <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
            <input v-model="form.headlessApiEnabled" type="checkbox" class="rounded border-gray-300 text-indigo-600" @change="syncDirty" />
            {{ t('settings.contentPublishingHeadlessApiEnabled') }}
          </label>
        </div>

        <div class="mt-6 border-t border-gray-200 pt-5 dark:border-gray-700">
          <h4 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('settings.addonsArticlesHelpCenterRoutesTitle') }}</h4>
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.addonsArticlesHelpCenterRoutesDesc') }}</p>
          <div class="mt-3 space-y-3">
            <div
              v-for="route in helpCenterRoutes"
              :key="route.key"
              class="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40"
            >
              <p class="text-sm font-medium text-gray-900 dark:text-white">{{ route.label }}</p>
              <p class="mt-1 break-all font-mono text-xs text-gray-600 dark:text-gray-400">{{ route.customerUrl }}</p>
              <a
                v-if="route.demoUrl"
                :href="route.demoUrl"
                class="mt-2 inline-block text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{ t('settings.addonsArticlesHelpCenterRouteDemo') }}
              </a>
            </div>
          </div>
        </div>
      </div>

      <div class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.addonsArticlesEmbedTitle') }}</h3>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.addonsArticlesEmbedDesc') }}</p>

        <div class="mt-5 space-y-6">
          <div>
            <div class="flex items-center justify-between gap-3">
              <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.addonsArticlesHomeEmbedSnippetLabel') }}</p>
              <button
                type="button"
                class="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                @click="copyText(homeEmbedSnippet, t('settings.addonsArticlesHomeEmbedSnippetLabel'))"
              >
                {{ t('settings.addonsArticlesCopyExample') }}
              </button>
            </div>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.addonsArticlesHomeEmbedDesc') }}</p>
            <pre class="mt-2 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"><code>{{ homeEmbedSnippet }}</code></pre>
          </div>

          <div>
            <div class="flex items-center justify-between gap-3">
              <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.addonsArticlesCategoryEmbedSnippetLabel') }}</p>
              <button
                type="button"
                class="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                @click="copyText(categoryEmbedSnippet, t('settings.addonsArticlesCategoryEmbedSnippetLabel'))"
              >
                {{ t('settings.addonsArticlesCopyExample') }}
              </button>
            </div>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.addonsArticlesCategoryEmbedDesc') }}</p>
            <pre class="mt-2 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"><code>{{ categoryEmbedSnippet }}</code></pre>
          </div>

          <div>
            <div class="flex items-center justify-between gap-3">
              <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.addonsArticlesSectionEmbedSnippetLabel') }}</p>
              <button
                type="button"
                class="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                @click="copyText(sectionEmbedSnippet, t('settings.addonsArticlesSectionEmbedSnippetLabel'))"
              >
                {{ t('settings.addonsArticlesCopyExample') }}
              </button>
            </div>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.addonsArticlesSectionEmbedDesc') }}</p>
            <pre class="mt-2 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"><code>{{ sectionEmbedSnippet }}</code></pre>
          </div>

          <div>
            <div class="flex items-center justify-between gap-3">
              <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.addonsArticlesListEmbedSnippetLabel') }}</p>
              <button
                type="button"
                class="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                @click="copyText(listEmbedSnippet, t('settings.addonsArticlesListEmbedSnippetLabel'))"
              >
                {{ t('settings.addonsArticlesCopyExample') }}
              </button>
            </div>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.addonsArticlesListEmbedDesc') }}</p>
            <pre class="mt-2 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"><code>{{ listEmbedSnippet }}</code></pre>
          </div>

          <div>
            <div class="flex items-center justify-between gap-3">
              <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.addonsArticlesEmbedSnippetLabel') }}</p>
              <button
                type="button"
                class="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                @click="copyText(embedSnippet, t('settings.addonsArticlesEmbedSnippetLabel'))"
              >
                {{ t('settings.addonsArticlesCopyExample') }}
              </button>
            </div>
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('settings.addonsArticlesArticleEmbedDesc') }}</p>
            <pre class="mt-2 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"><code>{{ embedSnippet }}</code></pre>
          </div>
        </div>
      </div>

      <div class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.addonsArticlesIntegrationExamplesTitle') }}</h3>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.addonsArticlesIntegrationExamplesDesc') }}</p>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {{ t('settings.addonsArticlesIntegrationExampleLink') }}
          <a
            :href="headlessHomeExampleUrl"
            class="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ t('settings.addonsArticlesIntegrationHomeExampleLinkLabel') }}
          </a>
          ·
          <a
            :href="headlessCategoryExampleUrl"
            class="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ t('settings.addonsArticlesIntegrationCategoryExampleLinkLabel') }}
          </a>
          ·
          <a
            :href="headlessSectionExampleUrl"
            class="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ t('settings.addonsArticlesIntegrationSectionExampleLinkLabel') }}
          </a>
          ·
          <a
            :href="headlessListExampleUrl"
            class="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ t('settings.addonsArticlesIntegrationListExampleLinkLabel') }}
          </a>
          ·
          <a
            :href="headlessExampleUrl"
            class="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ t('settings.addonsArticlesIntegrationExampleLinkLabel') }}
          </a>
        </p>

        <div class="mt-5 space-y-4">
          <div v-for="example in integrationExamples" :key="example.key">
            <div class="flex items-center justify-between gap-3">
              <p class="text-sm font-medium text-gray-900 dark:text-white">{{ example.label }}</p>
              <button
                type="button"
                class="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                @click="copyText(example.value, example.label)"
              >
                {{ t('settings.addonsArticlesCopyExample') }}
              </button>
            </div>
            <pre class="mt-2 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"><code>{{ example.value }}</code></pre>
          </div>
        </div>
      </div>

      <div class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.addonsArticlesDeflectionTitle') }}</h3>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.addonsArticlesDeflectionDesc') }}</p>

        <label class="mt-5 flex items-center justify-between gap-4">
          <span class="text-sm text-gray-700 dark:text-gray-200">{{ t('settings.addonsArticlesCaseDeflection') }}</span>
          <button
            type="button"
            role="switch"
            :aria-checked="form.caseDeflectionEnabled"
            class="relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors"
            :class="form.caseDeflectionEnabled ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'"
            @click="form.caseDeflectionEnabled = !form.caseDeflectionEnabled; syncDirty()"
          >
            <span
              class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition"
              :class="form.caseDeflectionEnabled ? 'translate-x-5' : 'translate-x-0'"
            />
          </button>
        </label>
      </div>

      <div class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.addonsArticlesDefaultsTitle') }}</h3>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.addonsArticlesDefaultsDesc') }}</p>

        <div class="mt-5 space-y-4">
          <label class="block text-sm text-gray-600 dark:text-gray-300">
            {{ t('settings.addonsArticlesDefaultCollection') }}
            <select
              v-model="form.defaultCollectionId"
              class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              @change="syncDirty()"
            >
              <option :value="null">{{ t('contentStudio.noCollection') }}</option>
              <option v-for="collection in collections" :key="collection._id" :value="collection._id">
                {{ collectionLabel(collection) }}
              </option>
            </select>
          </label>

          <label class="block text-sm text-gray-600 dark:text-gray-300">
            {{ t('settings.addonsArticlesStaleContentDays') }}
            <input
              v-model.number="form.staleContentAlertDays"
              type="number"
              min="7"
              max="365"
              class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              @input="syncDirty()"
            />
          </label>
        </div>
      </div>
    </div>

    <SettingsSaveBar
      :visible="dirty && !loading && !error"
      :saving="saving"
      :show-reset="false"
      @save="save"
    />
  </SettingsScrollPanel>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import SettingsScrollPanel from '@/components/settings/SettingsScrollPanel.vue';
import SettingsSaveBar from '@/components/settings/SettingsSaveBar.vue';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';
import { useAuthStore } from '@/stores/authRegistry';
import { buildHeadlessIntegrationUrls } from '@/modules/contentStudio/headless';
import '@/modules/contentStudio/editor/contentStudioArticleAppearance.css';

const emit = defineEmits(['back']);

const { t } = useI18n();
const notifications = useNotifications();
const authStore = useAuthStore();

const loading = ref(true);
const saving = ref(false);
const webhookTesting = ref(false);
const error = ref('');
const dirty = ref(false);
const initialSnapshot = ref('');
const isInitialLoad = ref(true);
const collections = ref([]);
const integration = reactive({
  headlessApiBase: '',
  articlesListApiUrl: '',
  collectionsApiUrl: '',
  recentArticlesApiUrl: '',
  popularArticlesApiUrl: '',
  exampleArticleApiUrl: '',
  sitemapUrl: '',
});
let autoSaveTimer = null;

const defaultAppearance = {
  layoutPreset: 'classic',
  primaryColor: '#4f46e5',
  secondaryColor: '#6366f1',
  bodyFont: 'Inter, system-ui, sans-serif',
  headingFont: 'Inter, system-ui, sans-serif',
  contentWidth: 'standard',
  borderRadius: 'md',
  defaultCoverPosition: 'below-title',
  defaultSubtitleSize: 'md',
  showLogoInHeader: false,
  logoUrl: '',
};

const form = reactive({
  portalPublishing: true,
  publishWebhookUrl: '',
  headlessApiEnabled: true,
  defaultCollectionId: null,
  caseDeflectionEnabled: true,
  staleContentAlertDays: 90,
  appearance: { ...defaultAppearance },
});

const widthMap = {
  narrow: '680px',
  standard: '768px',
  wide: '960px',
};

const radiusMap = {
  none: '0',
  sm: '4px',
  md: '8px',
  lg: '16px',
};

const previewClass = computed(() => [
  'content-studio-article',
  `content-studio-article--${form.appearance.layoutPreset}`,
  form.appearance.showLogoInHeader ? 'content-studio-article--with-logo' : '',
].filter(Boolean).join(' '));

const previewStyle = computed(() => ({
  '--cs-primary': form.appearance.primaryColor,
  '--cs-secondary': form.appearance.secondaryColor,
  '--cs-body-font': form.appearance.bodyFont,
  '--cs-heading-font': form.appearance.headingFont,
  '--cs-content-max-width': widthMap[form.appearance.contentWidth] || widthMap.standard,
  '--cs-border-radius': radiusMap[form.appearance.borderRadius] || radiusMap.md,
}));

const integrationEndpoints = computed(() => {
  const resolved = resolvedIntegration.value;
  return [
    {
      key: 'headlessApiBase',
      label: t('settings.contentPublishingHeadlessApiBase'),
      value: resolved.headlessApiBase,
    },
    {
      key: 'articlesListApiUrl',
      label: t('settings.contentPublishingArticlesListApi'),
      value: resolved.articlesListApiUrl,
    },
    {
      key: 'collectionsApiUrl',
      label: t('settings.contentPublishingCollectionsApi'),
      value: resolved.collectionsApiUrl,
    },
    {
      key: 'recentArticlesApiUrl',
      label: t('settings.contentPublishingRecentArticlesApi'),
      value: resolved.recentArticlesApiUrl,
    },
    {
      key: 'popularArticlesApiUrl',
      label: t('settings.contentPublishingPopularArticlesApi'),
      value: resolved.popularArticlesApiUrl,
    },
    {
      key: 'exampleArticleApiUrl',
      label: t('settings.contentPublishingExampleArticleApi'),
      value: resolved.exampleArticleApiUrl,
    },
    {
      key: 'sitemapUrl',
      label: t('settings.contentPublishingSitemapUrl'),
      value: resolved.sitemapUrl,
    },
  ];
});

const resolvedIntegration = computed(() => {
  if (integration.headlessApiBase) {
    return integration;
  }
  const orgSlug = authStore.organization?.slug;
  const clientUrls = orgSlug ? buildHeadlessIntegrationUrls(orgSlug) : null;
  return clientUrls ? { ...integration, ...clientUrls } : integration;
});

const integrationUrlsUnavailable = computed(
  () => !resolvedIntegration.value.headlessApiBase && !loading.value && !error.value,
);

const exampleArticleApiUrl = computed(() => {
  const pattern = resolvedIntegration.value.exampleArticleApiUrl || '';
  return pattern.includes('{slug}') ? pattern.replace('{slug}', 'getting-started') : pattern;
});

const headlessExampleUrl = computed(() => {
  const orgSlug = authStore.organization?.slug;
  const params = new URLSearchParams();
  if (orgSlug) params.set('org', orgSlug);
  params.set('slug', 'getting-started');
  const query = params.toString();
  return query ? `/examples/headless-article?${query}` : '/examples/headless-article';
});

const headlessListExampleUrl = computed(() => {
  const orgSlug = authStore.organization?.slug;
  const params = new URLSearchParams();
  if (orgSlug) params.set('org', orgSlug);
  const query = params.toString();
  return query ? `/examples/headless-article-list?${query}` : '/examples/headless-article-list';
});

const headlessHomeExampleUrl = computed(() => {
  const orgSlug = authStore.organization?.slug;
  const params = new URLSearchParams();
  if (orgSlug) params.set('org', orgSlug);
  const query = params.toString();
  return query ? `/examples/headless-help-home?${query}` : '/examples/headless-help-home';
});

const headlessCategoryExampleUrl = computed(() => {
  const orgSlug = authStore.organization?.slug;
  const params = new URLSearchParams();
  if (orgSlug) params.set('org', orgSlug);
  params.set('collection', 'your-category-slug');
  const query = params.toString();
  return query ? `/examples/headless-help-category?${query}` : '/examples/headless-help-category';
});

const headlessSectionExampleUrl = computed(() => {
  const orgSlug = authStore.organization?.slug;
  const params = new URLSearchParams();
  if (orgSlug) params.set('org', orgSlug);
  params.set('section', 'your-section-slug');
  params.set('parent', 'your-category-slug');
  const query = params.toString();
  return query ? `/examples/headless-help-section?${query}` : '/examples/headless-help-section';
});

const homeEmbedSnippet = computed(() => {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://your-app.example.com';
  const orgSlug = authStore.organization?.slug || 'your-org-slug';
  return `<link rel="stylesheet" href="${origin}/embed/headless-blocks.css" />\n<div id="help-home"></div>\n<script\n  src="${origin}/embed/headless-help-home.js"\n  data-org="${orgSlug}"\n  data-target="#help-home"\n  data-link-prefix="/help/"\n  data-title="Help Center"\n><\/script>`;
});

const categoryEmbedSnippet = computed(() => {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://your-app.example.com';
  const orgSlug = authStore.organization?.slug || 'your-org-slug';
  return `<link rel="stylesheet" href="${origin}/embed/headless-blocks.css" />\n<div id="help-category"></div>\n<script src="${origin}/embed/headless-help-common.js"><\/script>\n<script\n  src="${origin}/embed/headless-help-category.js"\n  data-org="${orgSlug}"\n  data-collection="your-category-slug"\n  data-target="#help-category"\n  data-link-prefix="/help/"\n  data-section-prefix="/help/"\n  data-home-prefix="/help/"\n  data-article-prefix="/help/"\n><\/script>`;
});

const sectionEmbedSnippet = computed(() => {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://your-app.example.com';
  const orgSlug = authStore.organization?.slug || 'your-org-slug';
  return `<link rel="stylesheet" href="${origin}/embed/headless-blocks.css" />\n<div id="help-section"></div>\n<script src="${origin}/embed/headless-help-common.js"><\/script>\n<script\n  src="${origin}/embed/headless-help-section.js"\n  data-org="${orgSlug}"\n  data-section="your-section-slug"\n  data-parent="your-category-slug"\n  data-target="#help-section"\n  data-link-prefix="/help/"\n  data-category-prefix="/help/"\n  data-section-prefix="/help/"\n  data-home-prefix="/help/"\n  data-article-prefix="/help/"\n><\/script>`;
});

const listEmbedSnippet = computed(() => {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://your-app.example.com';
  const orgSlug = authStore.organization?.slug || 'your-org-slug';
  return `<link rel="stylesheet" href="${origin}/embed/headless-blocks.css" />\n<div id="help-list"></div>\n<script\n  src="${origin}/embed/headless-article-list.js"\n  data-org="${orgSlug}"\n  data-target="#help-list"\n  data-link-prefix="/help/"\n><\/script>`;
});

const embedSnippet = computed(() => {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://your-app.example.com';
  const orgSlug = authStore.organization?.slug || 'your-org-slug';
  return `<link rel="stylesheet" href="${origin}/embed/headless-blocks.css" />\n<div id="help-article"></div>\n<script\n  src="${origin}/embed/headless-article.js"\n  data-org="${orgSlug}"\n  data-slug="your-article-slug"\n  data-target="#help-article"\n  data-show-sidebar="true"\n  data-show-breadcrumbs="true"\n  data-link-prefix="/help/"\n  data-home-prefix="/help/"\n  data-category-prefix="/help/"\n  data-section-prefix="/help/"\n  data-article-prefix="/help/"\n  data-collection="your-category-slug"\n  data-section="your-section-slug"\n><\/script>`;
});

const helpCenterRoutes = computed(() => [
  {
    key: 'home',
    label: t('settings.addonsArticlesHelpRouteHome'),
    customerUrl: 'https://your-site.com/help/',
    demoUrl: headlessHomeExampleUrl.value,
  },
  {
    key: 'category',
    label: t('settings.addonsArticlesHelpRouteCategory'),
    customerUrl: 'https://your-site.com/help/{category}',
    demoUrl: headlessCategoryExampleUrl.value,
  },
  {
    key: 'section',
    label: t('settings.addonsArticlesHelpRouteSection'),
    customerUrl: 'https://your-site.com/help/{category}/{section}',
    demoUrl: headlessSectionExampleUrl.value,
  },
  {
    key: 'article',
    label: t('settings.addonsArticlesHelpRouteArticle'),
    customerUrl: 'https://your-site.com/help/{category}/{section}/{article}',
    demoUrl: headlessExampleUrl.value,
  },
]);

const integrationExamples = computed(() => {
  const articleUrl = exampleArticleApiUrl.value;
  const collectionsUrl = resolvedIntegration.value.collectionsApiUrl || '';
  if (!articleUrl) return [];

  const examples = [
    {
      key: 'curl',
      label: t('settings.addonsArticlesExampleCurl'),
      value: `curl "${articleUrl}"`,
    },
    {
      key: 'fetch',
      label: t('settings.addonsArticlesExampleFetch'),
      value: `const response = await fetch('${articleUrl}');\nconst { data } = await response.json();\n// data.blocks → render on your site`,
    },
  ];

  if (collectionsUrl) {
    examples.push({
      key: 'collections',
      label: t('settings.addonsArticlesExampleCollections'),
      value: `const response = await fetch('${collectionsUrl}');\nconst { data } = await response.json();\n// data → nested category tree for /help navigation`,
    });
  }

  examples.push({
    key: 'render',
    label: t('settings.addonsArticlesExampleRender'),
    value: `import { renderBlocksToHtml } from '@/modules/contentStudio/headless';\n\nconst html = renderBlocksToHtml(data.blocks, {\n  title: data.title,\n  subtitle: data.subtitle,\n  articleLinkPrefix: '/help/',\n});\ndocument.querySelector('#article').innerHTML = html;`,
  });

  return examples;
});

async function copyText(value, label) {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(String(value));
    notifications.success(t('settings.addonsArticlesCopied', { label }));
  } catch {
    notifications.error(t('settings.addonsArticlesCopyFailed'));
  }
}

async function sendTestWebhook() {
  if (!form.publishWebhookUrl || webhookTesting.value) return;
  webhookTesting.value = true;
  try {
    await apiClient.post('/settings/addons/articles/settings/test-webhook', {}, { cache: 'no-store' });
    notifications.success(t('settings.addonsArticlesWebhookTestSent'));
  } catch (err) {
    notifications.error(err?.message || t('settings.addonsArticlesWebhookTestFailed'));
  } finally {
    webhookTesting.value = false;
  }
}

function collectionLabel(collection) {
  const depth = Number(collection.depth || 0);
  return `${'  '.repeat(depth)}${collection.name}`;
}

function snapshotForm() {
  return JSON.stringify(form);
}

function syncDirty() {
  dirty.value = snapshotForm() !== initialSnapshot.value;
}

function applyAppearance(settingsAppearance = {}) {
  Object.assign(form.appearance, { ...defaultAppearance, ...settingsAppearance });
}

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

async function load() {
  loading.value = true;
  error.value = '';
  isInitialLoad.value = true;
  try {
    const res = await apiClient('/settings/addons/articles/settings', { method: 'GET', cache: 'no-store' });
    applySettings(res);
  } catch (err) {
    error.value = err?.message || t('settings.addonsArticlesSettingsLoadFailed');
  } finally {
    loading.value = false;
    isInitialLoad.value = false;
  }
}

function applySettings(res) {
  const settings = res?.settings || {};
  form.portalPublishing = settings.portalPublishing !== false;
  form.publishWebhookUrl = settings.publishing?.publishWebhookUrl || '';
  form.headlessApiEnabled = settings.publishing?.headlessApiEnabled !== false;
  form.defaultCollectionId = settings.defaultCollectionId || null;
  form.caseDeflectionEnabled = settings.caseDeflectionEnabled !== false;
  form.staleContentAlertDays = Number(settings.staleContentAlertDays) || 90;
  applyAppearance(settings.appearance);
  integration.headlessApiBase = res?.integration?.headlessApiBase || '';
  integration.articlesListApiUrl = res?.integration?.articlesListApiUrl || '';
  integration.collectionsApiUrl = res?.integration?.collectionsApiUrl || '';
  integration.recentArticlesApiUrl = res?.integration?.recentArticlesApiUrl || '';
  integration.popularArticlesApiUrl = res?.integration?.popularArticlesApiUrl || '';
  integration.exampleArticleApiUrl = res?.integration?.exampleArticleApiUrl || '';
  integration.sitemapUrl = res?.integration?.sitemapUrl || '';
  collections.value = buildCollectionTree(Array.isArray(res?.collections) ? res.collections : []);
  initialSnapshot.value = snapshotForm();
  dirty.value = false;
}

async function save({ silent = false } = {}) {
  if (saving.value) return;
  saving.value = true;
  try {
    const res = await apiClient.put('/settings/addons/articles/settings', {
      portalPublishing: form.portalPublishing,
      publishWebhookUrl: form.publishWebhookUrl,
      headlessApiEnabled: form.headlessApiEnabled,
      defaultCollectionId: form.defaultCollectionId,
      caseDeflectionEnabled: form.caseDeflectionEnabled,
      staleContentAlertDays: form.staleContentAlertDays,
      appearance: { ...form.appearance },
    }, { cache: 'no-store' });
    applySettings(res);
    if (!silent) {
      notifications.success(t('settings.addonsArticlesSettingsSaved'));
    }
  } catch (err) {
    notifications.error(err?.message || t('settings.addonsArticlesSettingsSaveFailed'));
  } finally {
    saving.value = false;
  }
}

function scheduleAutoSave() {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    autoSaveTimer = null;
    if (dirty.value && !saving.value && !loading.value) {
      void save({ silent: true });
    }
  }, 800);
}

watch(
  () => ({
    portalPublishing: form.portalPublishing,
    publishWebhookUrl: form.publishWebhookUrl,
    headlessApiEnabled: form.headlessApiEnabled,
    defaultCollectionId: form.defaultCollectionId,
    caseDeflectionEnabled: form.caseDeflectionEnabled,
    staleContentAlertDays: form.staleContentAlertDays,
    appearance: { ...form.appearance },
  }),
  () => {
    if (loading.value || isInitialLoad.value) return;
    syncDirty();
  },
  { deep: true },
);

watch(dirty, (isDirty) => {
  if (!isDirty || loading.value || isInitialLoad.value) return;
  scheduleAutoSave();
});

onBeforeUnmount(() => {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
});

onMounted(() => {
  void load();
});
</script>
