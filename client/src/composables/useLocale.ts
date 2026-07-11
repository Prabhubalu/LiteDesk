import { computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import {
  DEFAULT_LANGUAGE,
  DEFAULT_LOCALE,
  I18N_DEV_PSEUDO_STORAGE_KEY,
  LANGUAGE_TO_DEFAULT_LOCALE,
  PSEUDO_LANGUAGES,
  RTL_LANGUAGES,
  type I18nLanguage,
  type SupportedLanguage,
} from '@/i18n/constants';
import { initI18n, setI18nLanguage } from '@/i18n';
import {
  setLocaleFormatContext,
  formatNumber,
  formatCurrency,
  formatDate,
  formatTime,
  formatRelativeTime,
} from '@/utils/localeFormat';
import { resolveOrgCurrencyCode } from '@/utils/currencyOptions';

export type LocaleResolution = {
  language: I18nLanguage;
  locale: string;
  timeZone: string;
  currency: string;
  isRtl: boolean;
  isPseudo: boolean;
};

function resolveLocaleTag(language: I18nLanguage, orgLocale?: string | null): string {
  if (orgLocale && typeof orgLocale === 'string' && orgLocale.includes('-')) {
    return orgLocale;
  }
  const base = language.split('-')[0] as SupportedLanguage;
  if (base in LANGUAGE_TO_DEFAULT_LOCALE) {
    return LANGUAGE_TO_DEFAULT_LOCALE[base as SupportedLanguage];
  }
  return DEFAULT_LOCALE;
}

function applyDocumentDirection(isRtl: boolean): void {
  const html = document.documentElement;
  html.setAttribute('dir', isRtl ? 'rtl' : 'ltr');
  html.setAttribute('lang', isRtl ? 'ar' : html.lang || 'en');
  if (isRtl) {
    html.classList.add('rtl');
  } else {
    html.classList.remove('rtl');
  }
}

/**
 * Single source of truth for language, locale, timezone, RTL, and formatting context.
 */
export function useLocale() {
  const { locale: i18nLocale } = useI18n();

  const language = computed<I18nLanguage>(() => (i18nLocale.value as I18nLanguage) || DEFAULT_LANGUAGE);

  const authStore = useAuthStore();

  const orgSettings = computed(() => authStore.organization?.settings ?? {});

  const locale = computed(() =>
    resolveLocaleTag(language.value, orgSettings.value?.locale as string | undefined)
  );

  const timeZone = computed(() => (orgSettings.value?.timeZone as string) || 'UTC');
  const currency = computed(() => resolveOrgCurrencyCode(orgSettings.value));

  const isPseudo = computed(() =>
    PSEUDO_LANGUAGES.includes(language.value as (typeof PSEUDO_LANGUAGES)[number])
  );

  const isRtl = computed(() => {
    if (language.value === 'ar-XB') return true;
    const base = language.value.split('-')[0] as SupportedLanguage;
    return RTL_LANGUAGES.has(base);
  });

  const resolution = computed<LocaleResolution>(() => ({
    language: language.value,
    locale: locale.value,
    timeZone: timeZone.value,
    currency: currency.value,
    isRtl: isRtl.value,
    isPseudo: isPseudo.value,
  }));

  watch(
    resolution,
    (r) => {
      setLocaleFormatContext({
        locale: r.locale,
        timeZone: r.timeZone,
        currency: r.currency,
      });
      applyDocumentDirection(r.isRtl);
    },
    { immediate: true, deep: true }
  );

  async function setLanguage(next: I18nLanguage, persistPseudo = false): Promise<void> {
    if (persistPseudo && PSEUDO_LANGUAGES.includes(next as (typeof PSEUDO_LANGUAGES)[number])) {
      try {
        localStorage.setItem(I18N_DEV_PSEUDO_STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
    }
    await setI18nLanguage(next);
  }

  async function clearPseudoLanguage(): Promise<void> {
    try {
      localStorage.removeItem(I18N_DEV_PSEUDO_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    const orgLang = (orgSettings.value?.language as string) || DEFAULT_LANGUAGE;
    await setI18nLanguage(orgLang as I18nLanguage);
  }

  return {
    language,
    locale,
    timeZone,
    currency,
    isRtl,
    isPseudo,
    resolution,
    setLanguage,
    clearPseudoLanguage,
    formatNumber,
    formatCurrency,
    formatDate,
    formatTime,
    formatRelativeTime,
    initFromAuth: async (orgLanguage?: string | null, userLanguage?: string | null) => {
      await initI18n({ orgLanguage, userLanguage });
    },
  };
}
