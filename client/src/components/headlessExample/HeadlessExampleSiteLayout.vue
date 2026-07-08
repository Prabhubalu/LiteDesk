<template>
  <div class="hes-root" :class="`hes-root--${layout}`">
    <div class="hes-demo-banner">
      {{ t('contentStudio.headlessExampleSiteDemoBanner') }}
    </div>

    <header class="hes-topnav">
      <div class="hes-container hes-topnav__inner">
        <a class="hes-brand" :href="brandHref">
          <span class="hes-brand__mark" aria-hidden="true">A</span>
          <span class="hes-brand__name">{{ t('contentStudio.headlessExampleSiteBrand') }}</span>
        </a>
        <nav class="hes-topnav__links" aria-label="Primary">
          <a class="hes-topnav__link" href="#">{{ t('contentStudio.headlessExampleSiteNavProduct') }}</a>
          <a class="hes-topnav__link" href="#">{{ t('contentStudio.headlessExampleSiteNavPricing') }}</a>
          <a class="hes-topnav__link" href="#">{{ t('contentStudio.headlessExampleSiteNavDocs') }}</a>
          <a
            class="hes-topnav__link"
            :class="{ 'hes-topnav__link--active': isHelpSection }"
            :href="helpHomeHref"
          >
            {{ t('contentStudio.headlessExampleSiteNavHelp') }}
          </a>
        </nav>
        <div class="hes-topnav__actions">
          <a class="hes-btn hes-btn--ghost" href="#">{{ t('contentStudio.headlessExampleSiteSignIn') }}</a>
          <a class="hes-btn hes-btn--primary" href="#">{{ t('contentStudio.headlessExampleSiteGetStarted') }}</a>
        </div>
      </div>
    </header>

    <div class="hes-page" :class="{ 'hes-page--home': layout === 'home' }">
      <div class="hes-container hes-page__main">
        <main class="hes-main" :class="`hes-main--${layout}`">
          <slot />
        </main>
      </div>
    </div>

    <footer class="hes-footer">
      <div class="hes-container hes-footer__inner">
        <p class="hes-footer__copy">{{ t('contentStudio.headlessExampleSiteFooterCopyright') }}</p>
        <nav class="hes-footer__links" aria-label="Footer">
          <a href="#">{{ t('contentStudio.headlessExampleSiteFooterPrivacy') }}</a>
          <a href="#">{{ t('contentStudio.headlessExampleSiteFooterTerms') }}</a>
          <a href="#">{{ t('contentStudio.headlessExampleSiteFooterStatus') }}</a>
        </nav>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { buildHeadlessExamplePrefixes } from '@/composables/useHeadlessExampleSite';

const props = defineProps({
  orgSlug: {
    type: String,
    default: '',
  },
  showSetup: {
    type: Boolean,
    default: false,
  },
  activeArea: {
    type: String,
    default: 'help',
  },
  layout: {
    type: String,
    default: 'embed',
    validator: (value) => ['home', 'embed'].includes(value),
  },
});

const { t } = useI18n();

const prefixes = computed(() => (props.orgSlug ? buildHeadlessExamplePrefixes(props.orgSlug) : null));
const helpHomeHref = computed(() => prefixes.value?.home || '/examples/headless-help-home');
const brandHref = computed(() => prefixes.value?.home || '#');
const isHelpSection = computed(() => ['help', 'home', 'list'].includes(props.activeArea));
</script>

<style scoped>
.hes-root {
  --hes-accent: #111827;
  --hes-accent-dark: #1f2937;
  --hes-text: #111827;
  --hes-muted: #6b7280;
  --hes-border: #e5e7eb;
  --hes-surface: #ffffff;
  --hes-bg: #ffffff;
  min-height: 100vh;
  background: var(--hes-bg);
  color: var(--hes-text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  line-height: 1.5;
}

.hes-container {
  width: min(72rem, calc(100% - 2.5rem));
  margin-inline: auto;
}

.hes-demo-banner {
  background: #0f172a;
  color: #e2e8f0;
  text-align: center;
  padding: 0.4rem 1rem;
  font-size: 0.75rem;
  letter-spacing: 0.01em;
}

.hes-topnav {
  position: sticky;
  top: 0;
  z-index: 20;
  border-bottom: 1px solid var(--hes-border);
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(10px);
}

.hes-topnav__inner {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  min-height: 4rem;
}

.hes-brand {
  display: inline-flex;
  align-items: center;
  gap: 0.625rem;
  text-decoration: none;
  color: inherit;
  flex-shrink: 0;
}

.hes-brand__mark {
  display: inline-grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border-radius: 0.5rem;
  background: linear-gradient(135deg, var(--hes-accent), #7c3aed);
  color: #fff;
  font-size: 0.875rem;
  font-weight: 700;
}

.hes-brand__name {
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.hes-topnav__links {
  display: none;
  align-items: center;
  gap: 1.25rem;
  margin-inline: auto;
}

.hes-topnav__link {
  color: var(--hes-muted);
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 500;
  transition: color 0.15s ease;
}

.hes-topnav__link:hover,
.hes-topnav__link--active {
  color: var(--hes-text);
}

.hes-topnav__actions {
  display: none;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
}

.hes-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 0.875rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  text-decoration: none;
  transition: background 0.15s ease, color 0.15s ease;
}

.hes-btn--ghost {
  color: var(--hes-text);
}

.hes-btn--ghost:hover {
  background: #f1f5f9;
}

.hes-btn--primary {
  background: var(--hes-accent);
  color: #fff;
}

.hes-btn--primary:hover {
  background: var(--hes-accent-dark);
}

.hes-page {
  padding: 1.5rem 0 4rem;
}

.hes-page--home {
  padding-top: 0.5rem;
}

.hes-page__main {
  min-width: 0;
}

.hes-main {
  min-width: 0;
}

.hes-card,
:slotted(.hes-card) {
  border: 1px solid var(--hes-border);
  border-radius: 0.875rem;
  background: var(--hes-surface);
  padding: 1.5rem;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.hes-main--home :deep([id^="ld-"]),
.hes-main--home :slotted([id^="ld-"]),
.hes-main--embed :deep([id^="ld-"]),
.hes-main--embed :slotted([id^="ld-"]) {
  --ld-accent: #2563eb;
  --ld-border: var(--hes-border);
  --ld-surface: var(--hes-surface);
  --ld-muted: var(--hes-muted);
  --ld-help-sidebar-width: 17.5rem;
  --ld-help-sticky-top: 5.5rem;
}

.hes-main--home :deep(.ld-help-home),
.hes-main--home :slotted(.ld-help-home) {
  max-width: none;
  padding-inline: 0;
}

.hes-footer {
  border-top: 1px solid var(--hes-border);
  background: var(--hes-surface);
  padding: 1.5rem 0 2rem;
}

.hes-footer__inner {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: center;
  text-align: center;
}

.hes-footer__copy {
  margin: 0;
  color: var(--hes-muted);
  font-size: 0.8125rem;
}

.hes-footer__links {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: center;
}

.hes-footer__links a {
  color: var(--hes-muted);
  text-decoration: none;
  font-size: 0.8125rem;
}

.hes-footer__links a:hover {
  color: var(--hes-text);
}

@media (min-width: 768px) {
  .hes-topnav__links,
  .hes-topnav__actions {
    display: flex;
  }

  .hes-footer__inner {
    flex-direction: row;
    justify-content: space-between;
    text-align: left;
  }
}
</style>
