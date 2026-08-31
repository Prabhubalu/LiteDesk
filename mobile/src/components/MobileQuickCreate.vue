<script setup lang="ts">
import { computed, type Component } from 'vue'
import {
  BriefcaseIcon,
  BuildingOfficeIcon,
  CheckCircleIcon,
  TicketIcon,
  UserGroupIcon
} from '@heroicons/vue/24/outline'
import { useAuthStore } from '@/stores/auth'
import { hasPermission } from '@/utils/permissions'
import { getModuleAccent, MOBILE_CREATE_ACTIONS } from '@/config/mobileModules'
import { useShellChrome } from '@/composables/useShellChrome'
import { tapHaptic } from '@/utils/haptics'
import MobileBottomSheet from '@/components/MobileBottomSheet.vue'

const CREATE_ICONS: Record<string, Component> = {
  people: UserGroupIcon,
  organizations: BuildingOfficeIcon,
  deals: BriefcaseIcon,
  tasks: CheckCircleIcon,
  cases: TicketIcon
}

const auth = useAuthStore()
const chrome = useShellChrome()

const open = computed({
  get: () => chrome.quickCreateOpen.value,
  set: (value: boolean) => {
    if (!value) chrome.closeQuickCreate()
  }
})

const actions = computed(() =>
  MOBILE_CREATE_ACTIONS.filter((action) => hasPermission(auth.user, action.permission))
)

function iconFor(moduleKey: string): Component | undefined {
  return CREATE_ICONS[moduleKey]
}

function onSelect(moduleKey: string) {
  void tapHaptic()
  chrome.openCreateForm(moduleKey)
}
</script>

<template>
  <MobileBottomSheet :open="open" title="Create" compact @close="chrome.closeQuickCreate()">
    <ul v-if="actions.length" class="create-list" role="list">
      <li v-for="action in actions" :key="action.moduleKey">
        <button type="button" class="create-row" @click="onSelect(action.moduleKey)">
          <span
            class="create-row__icon"
            :style="{
              background: `${getModuleAccent(action.moduleKey)}22`,
              color: getModuleAccent(action.moduleKey)
            }"
            aria-hidden="true"
          >
            <component :is="iconFor(action.moduleKey)" class="create-row__glyph" />
          </span>
          <span class="create-row__label">{{ action.label }}</span>
        </button>
      </li>
    </ul>
  </MobileBottomSheet>
</template>

<style scoped>
.create-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.05rem;
}

.create-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  min-height: 2.85rem;
  padding: 0.55rem 0.2rem;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text);
  text-align: left;
  -webkit-tap-highlight-color: transparent;
}

.create-row:active {
  background: var(--bg-soft);
}

.create-row__icon {
  width: 1.75rem;
  height: 1.75rem;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 0.45rem;
}

.create-row__glyph {
  width: 1rem;
  height: 1rem;
}

.create-row__label {
  flex: 1;
  min-width: 0;
  font-size: 0.9375rem;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
