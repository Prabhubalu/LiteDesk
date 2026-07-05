<template>
  <div class="flex flex-wrap items-center gap-2">
    <PermissionButton
      v-if="active !== 'home'"
      module="reports"
      action="view"
      variant="secondary"
      size="compact"
      @click="router.push({ name: 'analytics-home' })"
    >
      {{ t('analytics.homeTitle') }}
    </PermissionButton>
    <PermissionButton
      v-if="active !== 'reports'"
      module="reports"
      action="view"
      variant="secondary"
      size="compact"
      @click="router.push({ name: 'analytics-reports' })"
    >
      {{ t('analytics.listTitle') }}
    </PermissionButton>
    <PermissionButton
      v-if="active !== 'widgets'"
      module="reports"
      action="view"
      variant="secondary"
      size="compact"
      @click="router.push({ name: 'analytics-widgets' })"
    >
      {{ t('analytics.widgetsListTitle') }}
    </PermissionButton>
    <PermissionButton
      v-if="active !== 'dashboards'"
      module="reports"
      action="view"
      variant="secondary"
      size="compact"
      @click="router.push({ name: 'analytics-dashboards' })"
    >
      {{ t('analytics.dashboardsListTitle') }}
    </PermissionButton>
    <PermissionButton
      v-if="showTemplates"
      module="reports"
      action="view"
      variant="secondary"
      size="compact"
      @click="$emit('show-templates')"
    >
      {{ t('analytics.tabTemplates') }}
    </PermissionButton>
    <PermissionButton
      v-if="showList"
      module="reports"
      action="view"
      variant="secondary"
      size="compact"
      @click="$emit('show-list')"
    >
      {{ listLabel }}
    </PermissionButton>
    <ModuleActions
      module="reports"
      :create-label="createLabel"
      :show-import="false"
      :show-export="false"
      @create="$emit('create')"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import ModuleActions from '@/components/common/ModuleActions.vue';
import PermissionButton from '@/components/common/PermissionButton.vue';

const props = defineProps({
  active: {
    type: String,
    required: true,
    validator: (value) => ['home', 'reports', 'widgets', 'dashboards'].includes(value),
  },
  createLabel: {
    type: String,
    required: true,
  },
  showTemplates: {
    type: Boolean,
    default: false,
  },
  showList: {
    type: Boolean,
    default: false,
  },
});

defineEmits(['create', 'show-templates', 'show-list']);

const { t } = useI18n();
const router = useRouter();

const listLabel = computed(() => {
  if (props.active === 'widgets') return t('analytics.widgetsListTitle');
  if (props.active === 'dashboards') return t('analytics.dashboardsListTitle');
  return t('analytics.listTitle');
});
</script>
