<template>
  <div class="flex items-center gap-2">
    <img
      v-if="markUrl"
      :src="markUrl"
      alt=""
      class="shrink-0 rounded object-contain"
      :class="compact ? 'h-4 w-4' : 'h-5 w-5'"
      loading="lazy"
    >
    <span
      v-else
      class="inline-flex shrink-0 items-center justify-center rounded bg-neutral-200 font-semibold uppercase text-neutral-700 dark:bg-neutral-700 dark:text-neutral-100"
      :class="compact ? 'h-4 w-4 text-[9px]' : 'h-5 w-5 text-[10px]'"
      aria-hidden="true"
    >
      {{ initials }}
    </span>
    <p
      class="text-neutral-500 dark:text-neutral-400"
      :class="compact ? 'truncate text-xs' : 'text-meta'"
    >
      {{ label }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/authRegistry';
import {
  resolveAssetDownloadUrl,
  useCompanyLogoAsset,
} from '@/modules/template/composables/useCompanyLogoAsset';
import platformMarkUrl from '/assets/logo/Logo_light.svg';

const props = defineProps<{
  isPlatform?: boolean;
  compact?: boolean;
}>();

const { t } = useI18n();
const authStore = useAuthStore();
const {
  asset: companyLogoAsset,
  organizationLogoUrl,
  organizationName,
  ensureCompanyLogo,
} = useCompanyLogoAsset();

const orgName = computed(() => (
  organizationName.value
  || authStore.user?.organization?.name
  || authStore.organization?.name
  || 'Organization'
));

const label = computed(() => (
  props.isPlatform
    ? t('announcements.fromPlatform')
    : t('announcements.fromOrg', { orgName: orgName.value })
));

const markUrl = computed(() => {
  if (props.isPlatform) return platformMarkUrl;
  const assetUrl = resolveAssetDownloadUrl(companyLogoAsset.value?.downloadUrl);
  if (assetUrl) return assetUrl;
  const fallback = String(organizationLogoUrl.value || '').trim();
  return fallback || '';
});

const initials = computed(() => {
  const name = String(orgName.value || 'O').trim();
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || 'O';
});

onMounted(() => {
  if (!props.isPlatform) {
    void ensureCompanyLogo();
  }
});
</script>
