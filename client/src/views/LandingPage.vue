<script setup>
import { ref } from 'vue';
import { Dialog, DialogPanel } from '@headlessui/vue';
import { Bars3Icon, XMarkIcon } from '@heroicons/vue/24/outline';
import { useColorMode } from '@/composables/useColorMode'
const navigation = [
  { name: 'Product', href: '#' },
  { name: 'Features', href: '#' },
  { name: 'Pricing', href: '#' },
  { name: 'About Us', href: '#' },
]

const mobileMenuOpen = ref(false);

const { colorMode, toggleColorMode } = useColorMode();
</script>

<template>
  <div class="min-h-screen bg-white dark:bg-gray-900">
    <header class="absolute inset-x-0 top-0 z-50">
      <nav class="flex items-center justify-between p-6 lg:px-8" aria-label="Global">
        <div class="flex lg:flex-1">
          <a href="#" class="-m-1.5 p-1.5">
            <span class="sr-only">Nurtura</span>
            <img 
              :src="colorMode === 'dark' || colorMode === 'system' ? './src/assets/nurtura_logo_dark.svg' : './src/assets/nurtura_logo_light.svg'" 
              alt="LiteDesk Logo" 
              class="h-8 w-auto brightness-0 dark:brightness-100" 
            />  
          </a>
        </div>
        <div class="flex lg:hidden">
          <button type="button" class="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-gray-700 dark:text-gray-200" @click="mobileMenuOpen = true">
            <span class="sr-only">Open main menu</span>
            <Bars3Icon class="size-6" aria-hidden="true" />
          </button>
        </div>
        <div class="hidden lg:flex lg:gap-x-12">
          <a v-for="item in navigation" :key="item.name" :href="item.href" class="text-sm/6 font-semibold text-gray-900 dark:text-white">{{ item.name }}</a>
        </div>
          <div class="hidden lg:flex lg:flex-1 lg:justify-end">
            <router-link to="/login" class="text-sm/6 font-semibold text-gray-900 dark:text-white">Log in <span aria-hidden="true">&rarr;</span></router-link>
          </div>
      </nav>
      <Dialog class="lg:hidden" @close="mobileMenuOpen = false" :open="mobileMenuOpen">
        <div class="fixed inset-0 z-50" />
        <DialogPanel class="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-white dark:bg-gray-900 p-6 sm:max-w-sm sm:ring-1 sm:ring-gray-900/10">
          <div class="flex items-center justify-between">
            <a href="#" class="-m-1.5 p-1.5">
              <span class="sr-only">Nurtura</span>
              <img 
              :src="colorMode === 'dark' || colorMode === 'system' ? './src/assets/nurtura_logo_dark.svg' : './src/assets/nurtura_logo_light.svg'" 
              alt="LiteDesk Logo" 
              class="h-8 w-auto brightness-0 dark:brightness-100" 
            />  
            </a>
            <button type="button" class="-m-2.5 rounded-md p-2.5 text-gray-700 dark:text-gray-200" @click="mobileMenuOpen = false">
              <span class="sr-only">Close menu</span>
              <XMarkIcon class="size-6" aria-hidden="true" />
            </button>
          </div>
          <div class="mt-6 flow-root">
            <div class="-my-6 divide-y divide-gray-500/10 dark:divide-white/10">
              <div class="space-y-2 py-6">
                <a v-for="item in navigation" :key="item.name" :href="item.href" class="-mx-3 block rounded-lg px-3 py-2 text-base/7 font-semibold text-gray-900 hover:bg-gray-50 dark:text-white dark:hover:bg-white/5">{{ item.name }}</a>
              </div>
              <div class="py-6">
                <router-link to="/login" class="-mx-3 block rounded-lg px-3 py-2.5 text-base/7 font-semibold text-gray-900 hover:bg-white/5 dark:text-white">Log in <span aria-hidden="true">→</span></router-link>
              </div>
            </div>
          </div>
        </DialogPanel>
      </Dialog>
    </header>

    <div class="relative isolate px-6 lg:px-8 pt-14 flex items-center justify-center">
      <div class="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80" aria-hidden="true">
        <div class="relative left-[calc(50%-11rem)] aspect-1155/678 w-144.5 -translate-x-1/2 rotate-30 bg-linear-to-tr from-[#ff80b5] to-[#9089fc] dark:from-[#ff80b5] dark:to-[#9089fc] opacity-30 sm:left-[calc(50%-30rem)] sm:w-288.75" style="clip-path: polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)" />
      </div>
      <div class="mx-auto max-w-2xl py-32 sm:py-48 lg:py-56">
          <div class="hidden sm:mb-8 sm:flex sm:justify-center">
            <div class="relative rounded-full px-3 py-1 text-sm/6 text-gray-600 dark:text-gray-400 ring-1 ring-gray-900/10 dark:ring-white/10 hover:ring-gray-900/20 dark:hover:ring-white/20">
              Plug-and-play tool for any vertical. <a href="#" class="font-semibold text-indigo-600 dark:text-indigo-400"><span class="absolute inset-0" aria-hidden="true" />Read more <span aria-hidden="true">&rarr;</span></a>
            </div>
          </div>
          <div class="text-center">
            <h1 class="text-balance text-5xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-7xl">Design Your Perfect Sales Flow.</h1>
            <p class="mt-8 text-lg font-medium text-pretty text-gray-500 dark:text-gray-400 sm:text-xl-8">Stop wrestling with bloated CRM. Plug in, define your process, and automate customer engagement in less than a day.</p>
              <div class="mt-10 flex items-center justify-center gap-x-6">
                <router-link to="/demo" class="rounded-lg bg-indigo-600 dark:bg-indigo-500 px-8 py-3 text-lg font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">Request Demo</router-link>
                <router-link to="/login" class="text-sm-6 font-semibold text-gray-900 dark:text-white">Admin Login <span aria-hidden="true">→</span></router-link>
              </div>
          </div>
      </div>
      <div class="absolute inset-x-0 top-[calc(100%-13rem)] -z-10 transform-gpu overflow-hidden blur-3xl sm:top-[calc(100%-30rem)]" aria-hidden="true">
        <div class="relative left-[calc(50%+3rem)] aspect-1155/678 w-144.5 -translate-x-1/2 bg-linear-to-tr from-[#ff80b5] to-[#9089fc] opacity-30 sm:left-[calc(50%+36rem)] sm:w-288.75" style="clip-path: polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)" />
      </div>
    </div>
  </div>
</template>





<!-- <template>
  <div class="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-gradient-to-br from-brand-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-900 dark:to-brand-900/20">
    
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

 
    <div class="w-full max-w-md animate-slide-up">
      <div class="card p-8 shadow-2xl">
        

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


        <div class="space-y-4 mb-8">
          <router-link 
            to="/demo"
            class="flex w-full justify-center items-center gap-3 py-3 px-6 text-sm font-semibold rounded-lg transition-all duration-200 bg-brand-600 hover:bg-brand-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Request Demo
          </router-link>

          <router-link 
            to="/login"
            class="flex w-full justify-center items-center gap-3 py-3 px-6 text-sm font-semibold rounded-lg transition-all duration-200 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-2 border-gray-300 dark:border-gray-600 hover:border-brand-500 dark:hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-400 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Admin Login
          </router-link>
        </div>
      </div>


      <div class="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
        <p>© 2025 LiteDesk. All rights reserved.</p>
      </div>
    </div>
  </div>
</template> -->



