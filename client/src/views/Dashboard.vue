<script setup>
import { computed } from 'vue';
import { useColorMode } from '@/composables/useColorMode';
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/vue';
import { ChevronDownIcon, MagnifyingGlassIcon, MicrophoneIcon } from '@heroicons/vue/20/solid'; // Using '20/solid' for smaller, filled icons
import { useAuthStore } from '@/stores/auth'; // Assuming you still need auth data for userName

import HeroLightImage from '/src/assets/images/hero-light.jpg'; // Image path for light backgrounds
import HeroDarkImage from '/src/assets/images/hero-dark.jpg';   // Image path for dark backgrounds

const { colorMode } = useColorMode();
const authStore = useAuthStore(); // Assuming auth store is available

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