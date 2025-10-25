<template>
  <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Organization</h3>
      <button
        v-if="!organization"
        @click="$emit('link-organization')"
        class="p-1 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded transition-colors"
        title="Link Organization"
      >
        <svg class="w-4 h-4 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>

    <!-- Organization Details -->
    <div v-if="organization" class="space-y-3">
      <div
        @click="$emit('view-organization', organization._id)"
        class="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 cursor-pointer transition-colors"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <h4 class="text-sm font-semibold text-gray-900 dark:text-white truncate">{{ organization.name }}</h4>
            
            <!-- Industry & Size -->
            <div class="flex items-center gap-2 mt-1">
              <span v-if="organization.industry" class="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300 rounded text-xs">
                {{ organization.industry }}
              </span>
              <span v-if="organization.size" class="text-xs text-gray-600 dark:text-gray-400">
                {{ organization.size }}
              </span>
            </div>

            <!-- Contact Info -->
            <div class="space-y-1 mt-2">
              <div v-if="organization.email" class="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span class="truncate">{{ organization.email }}</span>
              </div>
              <div v-if="organization.phone" class="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                {{ organization.phone }}
              </div>
              <div v-if="organization.website" class="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
                <a :href="formatWebsite(organization.website)" target="_blank" @click.stop class="truncate hover:underline">
                  {{ organization.website }}
                </a>
              </div>
            </div>
          </div>

          <!-- Edit/Remove Button -->
          <button
            @click.stop="$emit('unlink-organization')"
            class="p-1 hover:bg-purple-200 dark:hover:bg-purple-800 rounded transition-colors flex-shrink-0"
            title="Unlink Organization"
          >
            <svg class="w-3 h-3 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="text-center py-8">
      <svg class="mx-auto h-10 w-10 text-gray-400 dark:text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
      <p class="text-sm text-gray-500 dark:text-gray-400">No organization linked</p>
      <button
        @click="$emit('link-organization')"
        class="mt-2 text-xs text-brand-600 dark:text-brand-400 hover:underline"
      >
        Link organization
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  organization: {
    type: Object,
    default: null
  }
});

defineEmits(['view-organization', 'link-organization', 'unlink-organization']);

const formatWebsite = (website) => {
  if (!website) return '';
  if (website.startsWith('http://') || website.startsWith('https://')) {
    return website;
  }
  return `https://${website}`;
};
</script>

