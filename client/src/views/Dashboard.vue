<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useColorMode } from '@/composables/useColorMode';
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/vue';
import { ChevronDownIcon, MagnifyingGlassIcon, MicrophoneIcon } from '@heroicons/vue/20/solid'; // Using '20/solid' for smaller, filled icons
import { useAuthStore } from '@/stores/auth'; // Assuming you still need auth data for userName

import HeroLightImage from '/src/assets/images/hero-light.jpg'; // Image path for light backgrounds
import HeroDarkImage from '/src/assets/images/hero-dark.jpg';   // Image path for dark backgrounds

const { colorMode } = useColorMode();
const authStore = useAuthStore(); // Assuming auth store is available
const router = useRouter();

// Trial info
const trialDaysRemaining = ref(0);
const showTrialBanner = computed(() => {
    return authStore.isTrialActive && trialDaysRemaining.value >= 0;
});

const getTrialDaysRemaining = () => {
    if (authStore.organization?.subscription?.trialEndDate) {
        const endDate = new Date(authStore.organization.subscription.trialEndDate);
        const now = new Date();
        const diffTime = endDate - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        trialDaysRemaining.value = Math.max(0, diffDays);
    }
};

const navigateToUpgrade = () => {
    router.push({ name: 'settings', query: { tab: 'subscription' } });
};

onMounted(() => {
    getTrialDaysRemaining();
});

// Determine which logo to show based on colorMode
const logoSrc = computed(() => {
    if (colorMode.value === 'dark' || (colorMode.value === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        return '/src/assets/nurtura_logo_light.svg'; // Your logo for dark backgrounds
    } else {
        return '/src/assets/nurtura_logo_dark.svg'; // Your logo for light backgrounds
    }
});

// User name for the greeting
const userName = computed(() => authStore.user?.username || 'User');

// Computed property for the hero background image based on mode
const heroBackgroundStyleString = computed(() => {
    let imageUrl;
    
    // Use the imported image variables instead of external URLs
    if (colorMode.value === 'dark' || (colorMode.value === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        imageUrl = HeroDarkImage;
    } else {
        imageUrl = HeroLightImage;
    }

    // Wrap the imported path in 'url()' and return the complete CSS string
    return `background-image: url('${imageUrl}'); background-size: cover; background-position: center;`;
});

// Data for the accordion sections
const accordionSections = [
    { title: 'My Apps', content: 'Content for My Apps section...' },
    { title: 'Metrics', content: 'Content for Metrics section...' },
    { title: 'Actions', content: 'Content for Actions section...' },
    { title: 'Marketplace', content: 'Content for Marketplace section...' },
];
</script>

<template>
  <div class="min-h-screen p-8 transition-colors duration-300
              bg-indigo-100
              dark:bg-[#090909]">
    
    <div class="max-w-4xl mx-auto">
      <!-- Trial Banner -->
      <div v-if="showTrialBanner" class="mb-6 p-4 rounded-lg shadow-md transition-colors duration-300"
           :class="trialDaysRemaining <= 3 ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'">
        <div class="flex items-center justify-between">
          <div class="flex items-center">
            <svg class="h-5 w-5 mr-2" :class="trialDaysRemaining <= 3 ? 'text-red-400' : 'text-yellow-400'" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p :class="trialDaysRemaining <= 3 ? 'text-red-800 dark:text-red-200' : 'text-yellow-800 dark:text-yellow-200'" class="font-medium">
                <span v-if="trialDaysRemaining === 0">Your trial expires today!</span>
                <span v-else-if="trialDaysRemaining === 1">Your trial expires in 1 day</span>
                <span v-else>Your trial expires in {{ trialDaysRemaining }} days</span>
              </p>
              <p :class="trialDaysRemaining <= 3 ? 'text-red-600 dark:text-red-300' : 'text-yellow-600 dark:text-yellow-300'" class="text-sm">
                Upgrade now to continue using all features
              </p>
            </div>
          </div>
          <button 
            @click="navigateToUpgrade"
            class="px-4 py-2 rounded-md font-medium transition-colors"
            :class="trialDaysRemaining <= 3 ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-yellow-600 hover:bg-yellow-700 text-white'"
          >
            Upgrade Now
          </button>
        </div>
      </div>
      <div class="flex items-center text-xl font-semibold mb-8 transition-colors duration-300
                  text-gray-900 dark:text-gray-100">
        <!-- <img :src="logoSrc" alt="Logo" class="h-8 w-auto mr-3"/> -->
        Good morning, {{ userName }} 👋
      </div>

      <div class="relative w-full rounded-2xl overflow-hidden shadow-xl mb-12"
           :style="heroBackgroundStyleString">
        <div class="absolute inset-0 bg-black/30 dark:bg-black/50"></div> <div class="relative z-10 flex flex-col items-center justify-center h-64 p-8">
          <p class="text-white text-lg font-medium mb-4 text-center">What do you need help with right now?</p>
          <div class="relative w-full max-w-xl">
            <MagnifyingGlassIcon class="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-gray-300" />
            <input type="text" placeholder="Ask anything..."
                   class="w-full pl-12 pr-12 py-3 rounded-full border-none focus:ring-2 focus:ring-indigo-500 transition-colors duration-300
                          bg-white/20 text-white placeholder-white/70 backdrop-blur-sm
                          dark:bg-white/10 dark:text-gray-100 dark:placeholder-gray-300">
            <MicrophoneIcon class="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/70 hover:text-white cursor-pointer transition-colors duration-300" />
          </div>
        </div>
      </div>

      <div class="space-y-4">
        <Disclosure v-for="(section, index) in accordionSections" :key="index" v-slot="{ open }">
          <DisclosureButton class="flex w-full items-center justify-between rounded-xl p-5 text-left font-medium shadow-md transition-all duration-300
                                 bg-white text-gray-800 hover:bg-gray-50
                                 dark:bg-[#111111] dark:text-gray-100 dark:hover:bg-[#222222]">
            <span>{{ section.title }}</span>
            <ChevronDownIcon
              :class="open ? 'rotate-180 transform' : ''"
              class="h-5 w-5 transition-transform duration-200 text-gray-600 dark:text-gray-300"
            />
          </DisclosureButton>
          <Transition
            enter-active-class="transition duration-100 ease-out"
            enter-from-class="transform scale-95 opacity-0"
            enter-to-class="transform scale-100 opacity-100"
            leave-active-class="transition duration-75 ease-in"
            leave-from-class="transform scale-100 opacity-100"
            leave-to-class="transform scale-95 opacity-0"
          >
            <DisclosurePanel class="px-5 pt-3 pb-4 text-sm transition-colors duration-300
                                  text-gray-600 dark:text-gray-300">
              {{ section.content }}
              <div class="h-16 bg-gray-50 dark:bg-gray-600 rounded-lg mt-2 p-3">
                  This is where the content for "{{ section.title }}" would go.
              </div>
            </DisclosurePanel>
          </Transition>
        </Disclosure>
      </div>
    </div>
  </div>
</template>

<style>
/* You might need to adjust or add these global styles if not already present */
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
}
</style>