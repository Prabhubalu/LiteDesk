<script setup>
import { useColorMode } from '@/composables/useColorMode';
import DemoRequestForm from '@/components/DemoRequestForm.vue';

const { colorMode, toggleColorMode } = useColorMode();
</script>

<template>
  <!-- Main Container with Gradient Background -->
  <div class="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-brand-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-900 dark:to-brand-900/20">
    
    <!-- Color Mode Switcher -->
    <div class="absolute top-4 right-4 flex gap-2 animate-fade-in">
      <button 
        @click="toggleColorMode('light')" 
        :class="{'ring-2 ring-brand-500 scale-105': colorMode === 'light'}" 
        class="p-2.5 rounded-lg text-sm font-medium transition-all hover:scale-105 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-sm hover:shadow-md"
      >
        <span class="text-lg">☀️</span>
        <span class="ml-1.5 text-gray-700 dark:text-gray-300">Light</span>
      </button>
      <button 
        @click="toggleColorMode('dark')" 
        :class="{'ring-2 ring-brand-500 scale-105': colorMode === 'dark'}" 
        class="p-2.5 rounded-lg text-sm font-medium transition-all hover:scale-105 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-sm hover:shadow-md"
      >
        <span class="text-lg">🌙</span>
        <span class="ml-1.5 text-gray-700 dark:text-gray-300">Dark</span>
      </button>
      <button 
        @click="toggleColorMode('system')" 
        :class="{'ring-2 ring-brand-500 scale-105': colorMode === 'system'}" 
        class="p-2.5 rounded-lg text-sm font-medium transition-all hover:scale-105 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-sm hover:shadow-md"
      >
        <span class="text-lg">💻</span>
        <span class="ml-1.5 text-gray-700 dark:text-gray-300">Auto</span>
      </button>
    </div>

    <!-- Main Card -->
    <div class="w-full max-w-2xl animate-slide-up">
      <div class="card p-8 shadow-2xl">
        
        <!-- Logo Section -->
        <div class="flex flex-col items-center mb-8">
          <div class="bg-gradient-to-br from-brand-500 to-brand-600 p-3 rounded-2xl shadow-lg mb-4">
            <img 
              :src="colorMode === 'dark' || colorMode === 'system' ? './src/assets/nurtura_logo_dark.svg' : './src/assets/nurtura_logo_light.svg'" 
              alt="LiteDesk Logo" 
              class="h-10 w-auto brightness-0 invert" 
            />  
          </div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Request a Demo</h1>
          <p class="text-gray-600 dark:text-gray-400 mt-1 text-center">See how LiteDesk can transform your business</p>
        </div>

        <!-- Demo Request Form -->
        <div class="transition-all duration-300">
          <DemoRequestForm />
        </div>

        <!-- Cross-navigation -->
        <div class="mt-6 text-center">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Already have an account? 
            <router-link to="/login" class="text-brand-600 dark:text-brand-400 hover:text-brand-500 dark:hover:text-brand-300 font-semibold hover:underline">
              Sign In
            </router-link>
          </p>
        </div>
      </div>

      <!-- Footer -->
      <div class="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
        <p>© 2025 LiteDesk. All rights reserved.</p>
      </div>
    </div>
  </div>
</template>
