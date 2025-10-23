<script setup>
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { computed } from 'vue';
import { useColorMode } from '@/composables/useColorMode';
import { Disclosure, DisclosureButton, DisclosurePanel, Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue'
import { Bars3Icon, BellIcon, XMarkIcon, MagnifyingGlassIcon } from '@heroicons/vue/24/outline' // Added MagnifyingGlassIcon

// --- Data for the Navigation Array ---
const navigation = computed(() => {
  const baseNav = [
    { name: 'Dashboard', href: '/dashboard', current: true },
    { name: 'Contacts', href: '/contacts', current: false },
    { name: 'Deals', href: '/deals', current: false },
    { name: 'Tasks', href: '/tasks', current: false },
    { name: 'Imports', href: '/imports', current: false },
    { name: 'Projects', href: '/items', current: false },
    { name: 'Calendar', href: '/events', current: false },
  ];
  
  // Add Admin-only links for Owners/Admins
  if (authStore.isOwner || authStore.userRole === 'admin') {
    baseNav.push({ name: 'Organizations', href: '/organizations', current: false });
    baseNav.push({ name: 'Demo Requests', href: '/demo-requests', current: false });
    baseNav.push({ name: 'Instances', href: '/instances', current: false });
  }
  
  return baseNav;
});
// ---

const { colorMode, toggleColorMode } = useColorMode();
const authStore = useAuthStore();
const router = useRouter();

const userName = computed(() => authStore.user?.username || 'User');
const userVertical = computed(() => authStore.user?.vertical || 'N/A');

const handleLogout = () => {
  authStore.logout();
  router.push('/');
  authStore.error = null;
};

// Required function for the Mode Toggle menu item
const toggleColorModeFromMenu = () => {
    toggleColorMode(colorMode.value === 'light' ? 'dark' : 'light');
};

// Menu items for the user dropdown
const userMenuItems = computed(() => [
    { name: 'Your Profile', action: () => router.push('/profile') },
    { name: 'Settings', action: () => router.push('/settings') },
    { 
        name: `Mode: ${colorMode.value === 'light' ? '🌙 Light' : '☀️ Dark'}`, 
        action: toggleColorModeFromMenu, 
        isModeToggle: true 
    },
    { name: 'Sign out', action: handleLogout, divider: true, isLogout: true },
]);

const logoSrc = computed(() => {
    // If colorMode is 'dark' or 'system' (and system is dark), use the light-colored logo
    if (colorMode.value === 'dark' || (colorMode.value === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        // IMPORTANT: Update this path to your actual logo file for dark backgrounds
        return '/src/assets/nurtura_logo_plain.svg'; 
    } else {
        // Use the dark-colored logo for light backgrounds
        // IMPORTANT: Update this path to your actual logo file for light backgrounds
        return '/src/assets/nurtura_logo_white.svg'; 
    }
});
</script>

<template>
  <Disclosure as="nav" class="relative shadow-2xl transition-colors duration-300
                             bg-[#6049E7] dark:bg-[#222222]" 
               v-slot="{ open }">

    <div class="mx-auto px-2 sm:px-6 lg:px-8">
      <div class="relative flex h-12 items-center justify-between">
        
        <div class="absolute inset-y-0 left-0 flex items-center sm:hidden">
          <DisclosureButton class="relative inline-flex items-center justify-center rounded-md p-2 text-white/80 hover:bg-white/10 focus:outline-2 focus:outline-offset-1 focus:outline-white">
            <span class="absolute -inset-0.5" />
            <span class="sr-only">Open main menu</span>
            <Bars3Icon v-if="!open" class="block size-6" aria-hidden="true" />
            <XMarkIcon v-else class="block size-6" aria-hidden="true" />
          </DisclosureButton>
        </div>
        
        <div class="flex flex-1 items-center justify-center sm:items-stretch sm:justify-start">
          
          <div class="flex shrink-0 items-center">
            <img class="h-6 w-auto" 
                  :src="logoSrc" 
                  alt="Nurtura Logo" 
             />
             <!-- <svg class="h-8 w-auto text-white dark:text-[#5E50F8]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                 <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79l4.59 4.59c.35.35.84.55 1.35.55s1.01-.2 1.36-.55l4.59-4.59c.13.58.21 1.17.21 1.79 0 4.08-3.05 7.44-7 7.93zM8.5 12c.83 0 1.5-.67 1.5-1.5S9.33 9 8.5 9 7 9.67 7 10.5s.67 1.5 1.5 1.5zm7 0c.83 0 1.5-.67 1.5-1.5S16.33 9 15.5 9 14 9.67 14 10.5s.67 1.5 1.5 1.5zm4.04-3.13l-1.95 1.95c-.35.35-.84.55-1.35.55s-1.01-.2-1.36-.55L12 8.5l-2.88 2.87c-.35.35-.84.55-1.36.55s-1.01-.2-1.36-.55L4.46 8.87C5.58 5.75 8.52 3.4 12 3.05v.02c3.48.35 6.42 2.7 7.54 5.82z"/>
          </svg> -->

          </div>
          
          <div class="hidden sm:ml-6 sm:block">
            <div class="flex space-x-2 h-full">
              <router-link 
                  v-for="item in navigation" 
                  :key="item.name" 
                  :to="item.href" 
                  :class="[
                    item.current
                      ? 'bg-[#523ED4] text-white dark:bg-[#353941] dark:text-white' // Active Tab
                      : 'text-white/80 hover:bg-[#523ED4] hover:text-white dark:text-gray-300 dark:hover:bg-[#353941] dark:hover:text-white', // Inactive Tab
                    'rounded-md px-3 py-2 text-sm font-medium flex items-center transition-colors duration-150'
                  ]" 
                  :aria-current="item.current ? 'page' : undefined"
              >
                {{ item.name }}
              </router-link>
            </div>
          </div>
        </div>
        
        <div class="absolute inset-y-0 right-0 flex items-center pr-2 sm:static sm:inset-auto sm:ml-6 sm:pr-0">
          
          <div class="relative hidden lg:block mr-4">
              <MagnifyingGlassIcon class="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white dark:text-gray-400" aria-hidden="true" />
              <input type="text" placeholder="Search"
                  class="w-64 h-8 p-2 pl-10 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-white transition 
                         bg-[#7663F0] text-white placeholder-white border-none
                         dark:bg-[#3F3F3F] dark:text-gray-200 dark:placeholder-gray-400 dark:border dark:border-gray-600"/>
          </div>
          
          <button type="button" class="relative rounded-full p-1 text-white hover:text-white/80 dark:text-gray-400 dark:hover:text-white focus:outline-2 focus:outline-offset-2 focus:outline-white dark:focus:outline-brand-500 transition duration-150">
            <span class="absolute -inset-1.5" />
            <span class="sr-only">View notifications</span>
            <BellIcon class="size-6" aria-hidden="true" />
          </button>

          <Menu as="div" class="relative ml-3">
            <MenuButton class="relative flex rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white dark:focus-visible:outline-brand-500">
              <span class="absolute -inset-1.5" />
              <span class="sr-only">Open user menu</span>
              <img class="size-8 rounded-full bg-gray-800 outline -outline-offset-1 outline-white/10 dark:outline-transparent" 
                   :src="authStore.user?.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'" 
                   alt="" />
            </MenuButton>

            <transition enter-active-class="transition ease-out duration-100" enter-from-class="transform opacity-0 scale-95" enter-to-class="transform opacity-100 scale-100" leave-active-class="transition ease-in duration-75" leave-from-class="transform opacity-100 scale-100" leave-to-class="transform opacity-0 scale-95">
              <MenuItems 
                  class="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md shadow-lg outline outline-black/5 py-1 transition-colors duration-300
                         bg-white dark:bg-[#191919] dark:outline-white/10">
                
                <template v-for="(item, index) in userMenuItems" :key="index">
                    <hr v-if="item.divider" class="my-1 border-gray-200 dark:border-gray-950">
                    
                    <MenuItem v-slot="{ active }">
                        <button @click="item.action()"
                            :class="[
                                active ? 'bg-gray-100 dark:bg-gray-600' : '',
                                item.isLogout 
                                  ? 'text-red-600 dark:text-red-400' 
                                  : 'text-gray-700 dark:text-gray-200',
                                'block w-full text-left px-4 py-2 text-sm transition duration-100'
                            ]">
                            {{ item.name }}
                        </button>
                    </MenuItem>
                </template>
              </MenuItems>
            </transition>
          </Menu>
        </div>
      </div>
    </div>

    <DisclosurePanel class="sm:hidden transition-colors duration-300 bg-[#523ED4] dark:bg-[#353941]">
      <div class="space-y-1 px-2 pt-2 pb-3">
        <router-link 
            v-for="item in navigation" 
            :key="item.name" 
            :to="item.href" 
            as="a" 
            :class="[
                item.current 
                    ? 'bg-[#523ED4] text-white dark:bg-[#20232A]' // Active
                    : 'text-white/80 hover:bg-white/10 dark:text-gray-300 dark:hover:bg-gray-700', // Inactive
                'block rounded-md px-3 py-2 text-base font-medium transition-colors duration-150'
            ]" 
            :aria-current="item.current ? 'page' : undefined"
        >
          {{ item.name }}
        </router-link>
      </div>
    </DisclosurePanel>
  </Disclosure>
</template>



<!-- <template>

  <nav class="flex items-center justify-between p-2 shadow-md sm:px-6 lg:px-8 
      /* Light Mode: White background, gray text, brand border */
      bg-white text-gray-800 border-b border-brand-200
      /* Dark Mode: Dark background, light text, deeper brand border */
      dark:bg-gray-800 dark:text-gray-100 dark:border-brand-800">

    <div class="flex items-center text-xl font-bold">
      <img
        :src="colorMode === 'dark' || colorMode === 'system' ? './src/assets/nurtura_logo_dark.svg' : './src/assets/nurtura_logo_light.svg'"
        alt="Nurtura Logo" class="h-10 w-auto" />
    </div>

    <div class="hidden md:flex space-x-6">

      <router-link to="/dashboard" class="pb-1 text-base transition duration-200 
          /* Active Link Styles */
          text-brand-600 font-bold border-b-2 border-brand-400 
          /* Hover Link Styles */
          hover:text-brand-500
          /* Dark Mode Overrides */
          dark:text-brand-400 dark:border-brand-400 dark:hover:text-brand-300">
        Dashboard
      </router-link>

      <router-link to="/contacts" class="text-base font-medium pb-1 transition duration-200 
          /* Light Mode: */
          text-gray-600 hover:text-brand-600
          /* Dark Mode: */
          dark:text-gray-300 dark:hover:text-brand-400">
        Contacts
      </router-link>

      <router-link to="/items" class="text-base font-medium pb-1 transition duration-200 
          text-gray-600 hover:text-brand-600
          dark:text-gray-300 dark:hover:text-brand-400">
        Items/Products
      </router-link>
      <router-link to="/events" class="text-base font-medium pb-1 transition duration-200 
          text-gray-600 hover:text-brand-600
          dark:text-gray-300 dark:hover:text-brand-400">
        Events/Tasks
      </router-link>
      <router-link to="/designer" class="text-base font-medium pb-1 transition duration-200 
          text-gray-600 hover:text-brand-600
          dark:text-gray-300 dark:hover:text-brand-400">
        Process Designer
      </router-link>
    </div>

    <div class="flex items-center space-x-4">

      <button @click="toggleColorMode(colorMode === 'light' ? 'dark' : 'light')" class="text-xl p-1 rounded-full 
          /* Light Mode: Hover effect */
          hover:bg-gray-100 
          /* Dark Mode: Hover effect */
          dark:hover:bg-gray-700">
        {{ colorMode === 'light' ? '🌙' : '☀️' }}
      </button>

      <span class="text-sm hidden sm:block">Hello, {{ userName }}!</span>

      <button @click="handleLogout"
        class="py-2 px-4 bg-red-600 text-white border-none rounded cursor-pointer font-semibold transition duration-200 hover:bg-red-700">
        Logout
      </button>
      
    </div>
  </nav>
</template> -->