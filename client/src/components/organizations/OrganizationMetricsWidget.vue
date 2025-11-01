<template>
  <div class="flex flex-col h-full w-full">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Metrics</h3>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <div class="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs text-gray-600 dark:text-gray-400 font-medium">Contacts</p>
            <p class="text-xl font-bold text-gray-900 dark:text-white mt-0.5">{{ stats.contacts || 0 }}</p>
          </div>
          <div class="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
            <svg class="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
        </div>
      </div>

      <div class="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs text-gray-600 dark:text-gray-400 font-medium">Users</p>
            <p class="text-xl font-bold text-gray-900 dark:text-white mt-0.5">{{ stats.users || 0 }}</p>
          </div>
          <div class="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
            <svg class="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
        </div>
      </div>

      <div class="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs text-gray-600 dark:text-gray-400 font-medium">Deals</p>
            <p class="text-xl font-bold text-gray-900 dark:text-white mt-0.5">{{ stats.deals || 0 }}</p>
          </div>
          <div class="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
            <svg class="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
        </div>
      </div>

      <div class="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs text-gray-600 dark:text-gray-400 font-medium">Tasks</p>
            <p class="text-xl font-bold text-gray-900 dark:text-white mt-0.5">{{ stats.tasks || 0 }}</p>
          </div>
          <div class="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
            <svg class="w-4 h-4 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  stats: {
    type: Object,
    default: () => ({
      contacts: 0,
      users: 0,
      deals: 0,
      tasks: 0
    })
  }
});
</script>

