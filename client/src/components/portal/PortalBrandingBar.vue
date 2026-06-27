<template>
  <div
    v-if="branding?.orgName || branding?.logoUrl"
    class="flex items-center gap-3 rounded-2xl px-4 py-3"
    :class="[PLATFORM_HOME_CARD_CLASS, PLATFORM_HOME_INTENT_GRADIENT_CLASS]"
  >
    <img
      v-if="branding.logoUrl"
      :src="branding.logoUrl"
      :alt="branding.orgName"
      class="h-8 w-auto max-w-[120px] object-contain"
    />
    <div class="min-w-0">
      <p class="truncate text-sm font-semibold text-neutral-900 dark:text-white">
        {{ branding.orgName }}
      </p>
      <p v-if="branding.supportEmail" class="truncate text-xs text-neutral-500 dark:text-neutral-400">
        {{ t('cases.portalBrandingSupport', { email: branding.supportEmail }) }}
      </p>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { usePortalBranding } from '@/composables/usePortalBranding';
import {
  PLATFORM_HOME_CARD_CLASS,
  PLATFORM_HOME_INTENT_GRADIENT_CLASS
} from '@/utils/platformHomeLayout';

const { t } = useI18n();
const { branding, loadBranding } = usePortalBranding();

onMounted(() => {
  void loadBranding();
});
</script>
