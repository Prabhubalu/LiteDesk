<script setup lang="ts">
import { Capacitor } from '@capacitor/core'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { getApiOrigin } from '@/config/apiBase'

const auth = useAuthStore()
const router = useRouter()

async function onLogout() {
  await auth.logout()
  await router.replace('/login')
}
</script>

<template>
  <section class="page">
    <header class="page-header">
      <h1>More</h1>
      <p class="muted">Account & app info</p>
    </header>

    <div class="card panel">
      <div class="row">
        <span class="muted">Signed in as</span>
        <strong>{{ auth.displayName }}</strong>
      </div>
      <div class="row">
        <span class="muted">Organization</span>
        <strong>{{ auth.organization?.name || '—' }}</strong>
      </div>
      <div class="row">
        <span class="muted">App key</span>
        <strong>{{ auth.preferredAppKey }}</strong>
      </div>
      <div class="row">
        <span class="muted">Platform</span>
        <strong>{{ Capacitor.getPlatform() }}</strong>
      </div>
      <div class="row">
        <span class="muted">API</span>
        <strong class="mono">{{ getApiOrigin() }}</strong>
      </div>
    </div>

    <button class="btn btn-danger" type="button" @click="onLogout">Sign out</button>
  </section>
</template>

<style scoped>
.page {
  padding: 1rem 1rem 1.5rem;
  display: grid;
  gap: 1rem;
}

.page-header h1 {
  margin: 0;
  font-size: 1.45rem;
}

.panel {
  padding: 1rem;
  display: grid;
  gap: 0.85rem;
}

.row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: baseline;
}

.mono {
  font-size: 0.8rem;
  word-break: break-all;
  text-align: right;
}
</style>
