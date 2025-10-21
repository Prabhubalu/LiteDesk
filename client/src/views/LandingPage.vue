<script setup>
import { ref } from 'vue';
import { useColorMode } from '@/composables/useColorMode'; // <-- Import the Composable
import LoginForm from '@/components/LoginForm.vue';
import RegistrationForm from '@/components/auth/RegistrationForm.vue';

const currentTab = ref('login'); 
const { colorMode, toggleColorMode } = useColorMode(); // <-- Use it here!

</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4 sm:p-6 
    bg-white text-gray-900 
    dark:bg-gray-900 dark:text-white"
  >
    
    <div class="absolute top-4 right-4 flex space-x-2">
      <button 
        @click="toggleColorMode('light')" 
        :class="{'ring-2 ring-blue-500': colorMode === 'light'}" 
        class="p-2 rounded-full text-gray-700 bg-gray-100 dark:text-gray-300 dark:bg-gray-800"
      >
        ☀️ Light
      </button>
      <button 
        @click="toggleColorMode('dark')" 
        :class="{'ring-2 ring-blue-500': colorMode === 'dark'}" 
        class="p-2 rounded-full text-gray-700 bg-gray-100 dark:text-gray-300 dark:bg-gray-800"
      >
        🌙 Dark
      </button>
      <button 
        @click="toggleColorMode('system')" 
        :class="{'ring-2 ring-blue-500': colorMode === 'system'}" 
        class="p-2 rounded-full text-gray-700 bg-gray-100 dark:text-gray-300 dark:bg-gray-800"
      >
        💻 System
      </button>
    </div>

    <div 
      class="w-full max-w-md p-6 sm:p-8 rounded-xl shadow-2xl border 
        bg-white border-gray-200 shadow-gray-300/50
        dark:bg-gray-800 dark:border-gray-700 dark:shadow-indigo-500/20"
    >

      <div class="app-logo-section flex flex-col items-center mb-8">
        <div class="app-logo">
          <img 
            :src="colorMode === 'dark' || colorMode === 'system' ? './src/assets/nurtura_logo_dark.svg' : './src/assets/nurtura_logo_light.svg'" 
            alt="Nurtura Logo" 
            class="h-12 w-auto" 
          />  
        </div> 
      </div>

      <div class="tab-selector-container flex mb-8 p-1 rounded-lg space-x-1
        bg-gray-100 
        dark:bg-gray-700"
      >
        
        <button 
          class="flex-1 py-2 text-sm font-semibold rounded-md transition-all duration-200 ease-in-out"
          :class="[
            currentTab === 'login' 
              ? 'bg-white shadow text-indigo-600 dark:bg-gray-900 dark:text-indigo-400' /* Active Tab Style */
              : 'text-gray-600 hover:bg-white/50 dark:text-gray-400 dark:hover:bg-gray-600' /* Inactive Tab Style */
          ]" 
          @click="currentTab = 'login'"
        >
          Sign In
        </button>
        
        <button 
          class="flex-1 py-2 text-sm font-semibold rounded-md transition-all duration-200 ease-in-out"
          :class="[
            currentTab === 'register' 
              ? 'bg-white shadow text-indigo-600 dark:bg-gray-900 dark:text-indigo-400' /* Active Tab Style */
              : 'text-gray-600 hover:bg-white/50 dark:text-gray-400 dark:hover:bg-gray-600' /* Inactive Tab Style */
          ]" 
          @click="currentTab = 'register'"
        >
          Sign Up
        </button>
      </div>

      <div class="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
            <component :is="currentTab === 'login' ? LoginForm : RegistrationForm" />
      </div>
    </div>
  </div>
</template>



