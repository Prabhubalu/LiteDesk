<script setup lang="ts">
import { Capacitor } from '@capacitor/core'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useMobileModules } from '@/composables/useMobileModules'
import ModuleIcon from '@/components/ModuleIcon.vue'
import { getApiOrigin } from '@/config/apiBase'

const auth = useAuthStore()
const router = useRouter()
const { modulesByCategory } = useMobileModules()

async function onLogout() {
  await auth.logout()
  await router.replace('/login')
}
</script>

<template>
  <section class="page apps">
    <div class="profile-card card">
      <div class="avatar">{{ auth.displayName.charAt(0).toUpperCase() }}</div>
      <div class="profile-copy">
        <h2 class="profile-name">{{ auth.displayName }}</h2>
        <p class="muted">{{ auth.organization?.name || 'Workspace' }}</p>
      </div>
    </div>

    <RouterLink to="/notifications" class="card row-link">
      <span class="row-link__label">Notifications</span>
      <span class="row-link__chev" aria-hidden="true">›</span>
    </RouterLink>

    <div v-for="group in modulesByCategory" :key="group.category" class="section">
      <h3 class="section-title">{{ group.label }}</h3>
      <div class="app-grid">
        <RouterLink
          v-for="mod in group.modules"
          :key="mod.key"
          :to="`/modules/${mod.key}`"
          class="app-tile card"
        >
          <span class="app-tile__icon">
            <ModuleIcon :module-key="mod.key" :size="24" />
          </span>
          <span class="app-tile__label">{{ mod.label }}</span>
        </RouterLink>
      </div>
    </div>

    <details class="card settings-panel">
      <summary>Account &amp; diagnostics</summary>
      <div class="settings-rows">
        <div class="row"><span class="muted">App key</span><strong>{{ auth.preferredAppKey }}</strong></div>
        <div class="row"><span class="muted">Platform</span><strong>{{ Capacitor.getPlatform() }}</strong></div>
        <div class="row"><span class="muted">API</span><strong class="mono">{{ getApiOrigin() }}</strong></div>
      </div>
    </details>

    <button class="btn btn-danger" type="button" @click="onLogout">Sign out</button>
  </section>
</template>

<style scoped>
.apps {
  display: grid;
  gap: 1rem;
}

.profile-card {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 1rem;
}

.avatar {
  width: 3rem;
  height: 3rem;
  border-radius: 999px;
  display: grid;
  place-items: center;
  font-weight: 800;
  color: white;
  background: linear-gradient(135deg, var(--accent), var(--accent-strong));
}

.profile-name {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
}

.profile-copy p {
  margin: 0.15rem 0 0;
  font-size: 0.85rem;
}

.row-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.95rem 1rem;
  font-weight: 600;
}

.row-link:active {
  background: var(--bg-soft);
}

.row-link__chev {
  color: var(--text-muted);
  font-size: 1.25rem;
}

.app-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem;
}

.app-tile {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.55rem;
  padding: 0.95rem;
  min-height: 5.5rem;
}

.app-tile:active {
  transform: scale(0.98);
  background: var(--bg-soft);
}

.app-tile__icon {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 10px;
  display: grid;
  place-items: center;
  color: var(--accent-strong);
  background: rgba(96, 73, 231, 0.12);
}

.app-tile__label {
  font-weight: 600;
  font-size: 0.92rem;
}

.settings-panel {
  padding: 0.75rem 1rem;
}

.settings-panel summary {
  cursor: pointer;
  font-weight: 600;
}

.settings-rows {
  margin-top: 0.75rem;
  display: grid;
  gap: 0.65rem;
}

.row {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: baseline;
}

.mono {
  font-size: 0.75rem;
  word-break: break-all;
  text-align: right;
}
</style>
