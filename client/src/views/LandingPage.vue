<script setup>
import { ref } from 'vue';
import { useColorMode } from '@/composables/useColorMode'; // <-- Import the Composable
import LoginForm from '@/components/LoginForm.vue';
import DemoRequestForm from '@/components/DemoRequestForm.vue';

const currentTab = ref('demo'); // Default to demo request
const { colorMode, toggleColorMode } = useColorMode(); // <-- Use it here!

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
    <div class="w-full max-w-md animate-slide-up">
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
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Welcome to LiteDesk</h1>
          <p class="text-gray-600 dark:text-gray-400 mt-1 text-center">Your complete CRM solution</p>
        </div>

        <!-- Tab Selector -->
        <div class="flex gap-2 p-1.5 rounded-xl bg-gray-100 dark:bg-gray-700/50 mb-8">
          <button 
            @click="currentTab = 'demo'"
            :class="[
              currentTab === 'demo' 
                ? 'bg-white dark:bg-gray-800 text-brand-600 dark:text-brand-400 shadow-md' 
                : 'text-gray-600 dark:text-gray-400 hover:bg-white/60 dark:hover:bg-gray-800/60'
            ]" 
            class="flex-1 py-2.5 px-4 text-sm font-semibold rounded-lg transition-all duration-200"
          >
            <span class="flex items-center justify-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Request Demo
            </span>
          </button>

          <button 
            @click="currentTab = 'login'"
            :class="[
              currentTab === 'login' 
                ? 'bg-white dark:bg-gray-800 text-brand-600 dark:text-brand-400 shadow-md' 
                : 'text-gray-600 dark:text-gray-400 hover:bg-white/60 dark:hover:bg-gray-800/60'
            ]" 
            class="flex-1 py-2.5 px-4 text-sm font-semibold rounded-lg transition-all duration-200"
          >
            <span class="flex items-center justify-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Admin Login
            </span>
          </button>
        </div>

        <!-- Form Content -->
        <div class="transition-all duration-300">
          <component :is="currentTab === 'login' ? LoginForm : DemoRequestForm" />
        </div>
      </div>

      <!-- Footer -->
      <div class="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
        <p>© 2025 LiteDesk. All rights reserved.</p>
      </div>
    </div>
  </div>
</template>



