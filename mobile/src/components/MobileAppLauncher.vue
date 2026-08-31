<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useMobileModules } from '@/composables/useMobileModules'
import { useShellChrome } from '@/composables/useShellChrome'
import { getModuleAccent } from '@/config/mobileModules'
import MobileBottomSheet from '@/components/MobileBottomSheet.vue'
import ModuleIcon from '@/components/ModuleIcon.vue'

const router = useRouter()
const chrome = useShellChrome()
const { allowedModules } = useMobileModules()

const open = computed({
  get: () => chrome.launcherOpen.value,
  set: (value: boolean) => {
    if (!value) chrome.closeLauncher()
  }
})

async function openModule(moduleKey: string) {
  chrome.setFooterModuleKey(moduleKey)
  chrome.closeLauncher()
  await router.push(`/modules/${moduleKey}`)
}
</script>

<template>
  <MobileBottomSheet :open="open" title="Apps" @close="chrome.closeLauncher()">
    <div class="launcher-grid">
      <button
        v-for="mod in allowedModules"
        :key="mod.key"
        type="button"
        class="launcher-tile"
        :class="{ 'launcher-tile--selected': mod.key === chrome.footerModuleKey.value }"
        @click="openModule(mod.key)"
      >
        <span class="launcher-tile__icon" :style="{ background: `${getModuleAccent(mod.key)}22`, color: getModuleAccent(mod.key) }">
          <ModuleIcon :module-key="mod.key" :size="22" />
        </span>
        <span class="launcher-tile__label">{{ mod.label }}</span>
      </button>
    </div>
    <button type="button" class="launcher-more" @click="router.push('/apps'); chrome.closeLauncher()">
      Account &amp; all apps →
    </button>
  </MobileBottomSheet>
</template>

<style scoped>
.launcher-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}

.launcher-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.45rem;
  border: none;
  background: transparent;
  color: var(--text);
  padding: 0.35rem;
}

.launcher-tile__icon {
  width: 3.25rem;
  height: 3.25rem;
  border-radius: 16px;
  display: grid;
  place-items: center;
}

.launcher-tile__label {
  font-size: 0.72rem;
  font-weight: 600;
  text-align: center;
  line-height: 1.2;
}

.launcher-tile--selected .launcher-tile__icon {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 45%, transparent);
}

.launcher-more {
  width: 100%;
  margin-top: 0.85rem;
  border: none;
  background: var(--bg-soft);
  color: var(--accent-strong);
  font-weight: 600;
  padding: 0.75rem;
  border-radius: var(--radius-sm);
}
</style>
