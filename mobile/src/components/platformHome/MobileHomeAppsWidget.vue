<script setup lang="ts">
import { useRouter } from 'vue-router'
import {
  ArrowRightIcon,
  BriefcaseIcon,
  CubeIcon,
  GlobeAltIcon,
  LifebuoyIcon,
  MegaphoneIcon,
  RectangleStackIcon,
  ShieldCheckIcon,
  Squares2X2Icon
} from '@heroicons/vue/24/outline'
import type { PlatformHomeAppPulse } from '@/types/platformHome'
import { appPillTone, defaultMobileRouteForApp } from '@/utils/platformHomeMobile'
import MobileHomeWidgetShell from '@/components/platformHome/MobileHomeWidgetShell.vue'

defineProps<{
  appPulses: PlatformHomeAppPulse[]
}>()

const router = useRouter()

const APP_ICONS = {
  sales: BriefcaseIcon,
  helpdesk: LifebuoyIcon,
  audit: ShieldCheckIcon,
  projects: RectangleStackIcon,
  portal: GlobeAltIcon,
  inventory: CubeIcon,
  marketing: MegaphoneIcon,
  default: Squares2X2Icon
}

function appIcon(appKey: string) {
  return APP_ICONS[appPillTone(appKey)]
}

function hasUrgentSignal(pulse: PlatformHomeAppPulse): 'danger' | 'warning' | null {
  const urgent = (pulse.signals || []).find(
    (signal) => signal.severity !== 'info' && signal.text && signal.text !== 'No urgent items'
  )
  if (!urgent) return null
  return urgent.severity === 'danger' ? 'danger' : 'warning'
}

function openApp(pulse: PlatformHomeAppPulse) {
  void router.push(defaultMobileRouteForApp(pulse.appKey))
}
</script>

<template>
  <MobileHomeWidgetShell title="Your apps">
    <template #actions>
      <button type="button" class="explore" @click="router.push('/apps')">
        Explore apps
        <ArrowRightIcon class="explore__icon" />
      </button>
    </template>

    <p v-if="!appPulses.length" class="empty">No apps to show yet.</p>
    <div v-else class="apps-scroll">
      <button
        v-for="pulse in appPulses"
        :key="pulse.appKey"
        type="button"
        class="pill"
        :class="`pill--${appPillTone(pulse.appKey)}`"
        @click="openApp(pulse)"
      >
        <span class="pill__icon">
          <component :is="appIcon(pulse.appKey)" />
        </span>
        <span class="pill__name">{{ pulse.name || pulse.appKey }}</span>
        <span
          v-if="hasUrgentSignal(pulse)"
          class="pill__dot"
          :class="`pill__dot--${hasUrgentSignal(pulse)}`"
          aria-hidden="true"
        />
      </button>
    </div>
  </MobileHomeWidgetShell>
</template>

<style scoped>
.explore {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  border: none;
  background: transparent;
  color: var(--accent-strong);
  font-size: 0.75rem;
  font-weight: 500;
}

.explore__icon {
  width: 0.85rem;
  height: 0.85rem;
}

.empty {
  margin: 0;
  padding: 1rem 0.25rem;
  text-align: center;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.apps-scroll {
  display: flex;
  gap: 0.5rem;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  padding-bottom: 0.15rem;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.apps-scroll::-webkit-scrollbar {
  display: none;
}

.pill {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  background: var(--bg-soft);
  color: var(--text);
  font-size: 0.875rem;
  font-weight: 500;
}

.pill__icon {
  display: flex;
  width: 1.75rem;
  height: 1.75rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--border);
}

.pill__icon :deep(svg) {
  width: 0.9rem;
  height: 0.9rem;
}

.pill__name {
  white-space: nowrap;
}

.pill__dot {
  width: 0.375rem;
  height: 0.375rem;
  border-radius: 999px;
}

.pill__dot--danger {
  background: var(--danger);
}

.pill__dot--warning {
  background: var(--warning);
}

.pill--sales {
  background: #eff6ff;
  border-color: #bfdbfe;
  color: #1e3a8a;
}

.pill--sales .pill__icon {
  background: #bfdbfe;
  color: #1e40af;
}

.pill--helpdesk {
  background: #f0fdf4;
  border-color: #bbf7d0;
  color: #14532d;
}

.pill--helpdesk .pill__icon {
  background: #bbf7d0;
  color: #166534;
}

.pill--audit,
.pill--marketing {
  background: #f5f3ff;
  border-color: #ddd6fe;
  color: #2e1872;
}

.pill--audit .pill__icon,
.pill--marketing .pill__icon {
  background: #ddd6fe;
  color: #4c1d95;
}

.pill--projects {
  background: #fffbeb;
  border-color: #fde68a;
  color: #78350f;
}

.pill--projects .pill__icon {
  background: #fde68a;
  color: #92400e;
}

.pill--portal,
.pill--inventory,
.pill--default {
  background: #f9fafb;
  border-color: #e5e7eb;
  color: #1f2937;
}

.pill--portal .pill__icon,
.pill--inventory .pill__icon,
.pill--default .pill__icon {
  background: #e5e7eb;
  color: #374151;
}
</style>
