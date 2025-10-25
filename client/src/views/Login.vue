<script setup>
import { useColorMode } from '@/composables/useColorMode';
import LoginForm from '@/components/LoginForm.vue';

const { colorMode, toggleColorMode } = useColorMode();
</script>

<template>

  <div class="min-h-screen bg-white dark:bg-gray-900">
    <div class="relative isolate px-6 lg:px-8 pt-14 flex items-center justify-center">
      <div class="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
        aria-hidden="true">
        <div
          class="relative left-[calc(50%-11rem)] aspect-1155/678 w-144.5 -translate-x-1/2 rotate-30 bg-linear-to-tr from-[#ff80b5] to-[#9089fc] dark:from-[#ff80b5] dark:to-[#9089fc] opacity-30 sm:left-[calc(50%-30rem)] sm:w-288.75"
          style="clip-path: polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)" />
      </div>
      <div class="mx-auto max-w-2xl sm:w-full sm:max-w-sm md:min-w-md py-32 sm:py-48 lg:py-32 transition-all duration-300">
        <div class="flex min-h-full flex-1 flex-col justify-center py-12 sm:px-6 lg:px-8">
          <div class="sm:mx-auto sm:w-full sm:max-w-sm">
            <img
              :src="colorMode === 'dark' || colorMode === 'system' ? './src/assets/nurtura_logo_white.svg' : './src/assets/nurtura_logo_plain.svg'"
              alt="Nurtura Logo" class="mx-auto h-10 w-auto brightness-0 dark:brightness-100" />

            <h2 class="mt-6 text-center text-2xl/9 font-bold tracking-tight text-gray-900 dark:text-white">Sign in to
              your account</h2>
          </div>

          <div class="mt-10 sm:mx-auto sm:w-full sm:max-w-sm md:max-w-md">
            <LoginForm />

            <p class="mt-10 text-center text-smd/6 text-gray-500">
              Don't have an account?
              {{ ' ' }}
              <router-link to="/demo" class="font-semibold text-indigo-600 hover:text-indigo-500">Request a
                Demo</router-link>
            </p>
          </div>
        </div>
      </div>
      
      <div
        class="absolute inset-x-0 top-[calc(100%-13rem)] -z-10 transform-gpu overflow-hidden blur-3xl sm:top-[calc(100%-30rem)]"
        aria-hidden="true">
        <div
          class="relative left-[calc(50%+3rem)] aspect-1155/678 w-144.5 -translate-x-1/2 bg-linear-to-tr from-[#ff80b5] to-[#9089fc] opacity-30 sm:left-[calc(50%+36rem)] sm:w-288.75"
          style="clip-path: polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)" />
      </div>
    </div>
  </div>






 
</template>
