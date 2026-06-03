<script setup>
import { RouterLink, RouterView } from 'vue-router';
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <header class="border-b border-slate-800 bg-[#121826]/90 backdrop-blur sticky top-0 z-10">
      <div class="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center text-sm font-bold">ATP</div>
          <span class="font-semibold tracking-tight">Arivu Test Platform</span>
        </div>
        <nav class="flex gap-1 text-sm">
          <RouterLink
            v-for="link in links"
            :key="link.to"
            :to="link.to"
            class="px-3 py-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 router-link-active:!text-white router-link-active:!bg-indigo-600/30"
          >
            {{ link.label }}
          </RouterLink>
        </nav>
      </div>
    </header>
    <main class="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
      <RouterView />
    </main>
  </div>
</template>

<script>
export default {
  data() {
    return {
      links: [
        { to: '/', label: 'Home' },
        { to: '/catalog', label: 'Catalog' },
        { to: '/runs', label: 'Runs' },
        { to: '/schedules', label: 'Schedules' },
        { to: '/compare', label: 'Compare' },
      ],
    };
  },
};
</script>
