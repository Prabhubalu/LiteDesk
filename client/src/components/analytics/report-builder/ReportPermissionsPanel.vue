<template>
  <div class="space-y-3 border-t border-zinc-200/80 pt-4 dark:border-zinc-800">
    <p :class="rbOverline">{{ t('analytics.builderPermissionMatrix') }}</p>
    <div class="grid gap-3 sm:grid-cols-2">
      <div v-for="field in permissionFields" :key="field.key">
        <label :class="rbLabel" :for="`perm-${field.key}`">{{ field.label }}</label>
        <HeadlessSelect
          :id="`perm-${field.key}`"
          :model-value="permissions[field.key] || 'viewers'"
          :options="levelOptions"
          wrapper-class="mt-0"
          teleport
          @update:model-value="updatePermission(field.key, $event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { rbLabel, rbOverline } from '@/components/analytics/report-builder/reportBuilderUi';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import type {
  AnalyticsReportPermissionLevel,
  AnalyticsReportPermissions,
} from '@/types/analytics.types';

const props = defineProps<{
  permissions: AnalyticsReportPermissions;
}>();

const emit = defineEmits<{
  (e: 'update:permissions', value: AnalyticsReportPermissions): void;
}>();

const { t } = useI18n();

const permissionFields = computed(() => [
  { key: 'view' as const, label: t('analytics.builderPermView') },
  { key: 'edit' as const, label: t('analytics.builderPermEdit') },
  { key: 'clone' as const, label: t('analytics.builderPermClone') },
  { key: 'export' as const, label: t('analytics.builderPermExport') },
  { key: 'share' as const, label: t('analytics.builderPermShare') },
]);

const levelOptions = computed(() => [
  { value: 'viewers', label: t('analytics.builderPermLevelViewers') },
  { value: 'editors', label: t('analytics.builderPermLevelEditors') },
  { value: 'owner', label: t('analytics.builderPermLevelOwner') },
]);

function updatePermission(key: keyof AnalyticsReportPermissions, value: string) {
  emit('update:permissions', {
    ...props.permissions,
    [key]: value as AnalyticsReportPermissionLevel,
  });
}
</script>
