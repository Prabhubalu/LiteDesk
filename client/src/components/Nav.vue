<script setup>
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useTabs } from '@/composables/useTabs';
import { computed, ref, watch } from 'vue';
import { useColorMode } from '@/composables/useColorMode';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue'
import { 
  Bars3Icon, 
  BellIcon, 
  XMarkIcon, 
  MagnifyingGlassIcon,
  HomeIcon,
  UsersIcon,
  BuildingOfficeIcon,
  BriefcaseIcon,
  CheckCircleIcon,
  CalendarIcon,
  ArrowDownTrayIcon,
  FolderIcon,
  RectangleStackIcon,
  ServerIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/vue/24/outline'

// Define props and emits
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:modelValue']);

const route = useRoute();
const isCollapsed = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

const isMobileMenuOpen = ref(false);
const isHovering = ref(false);

// Computed to determine if sidebar should show expanded
const shouldShowExpanded = computed(() => {
  return !isCollapsed.value || isHovering.value;
});

const toggleSidebar = () => {
  isCollapsed.value = !isCollapsed.value;
};

const toggleMobileMenu = () => {
  isMobileMenuOpen.value = !isMobileMenuOpen.value;
};

const handleMouseEnter = () => {
  if (isCollapsed.value) {
    isHovering.value = true;
  }
};

const handleMouseLeave = () => {
  isHovering.value = false;
};

// Close mobile menu when route changes
watch(() => route.path, () => {
  isMobileMenuOpen.value = false;
});

// --- Data for the Navigation Array with Icons ---
const navigation = computed(() => {
  const nav = [];
  
  // Dashboard - always visible
  nav.push({ 
    name: 'Dashboard', 
    href: '/dashboard', 
    icon: HomeIcon,
    current: route.path === '/dashboard'
  });
  
  // Contacts - check permission
  if (authStore.can('contacts', 'view')) {
    nav.push({ 
      name: 'Contacts', 
      href: '/contacts', 
      icon: UsersIcon,
      current: route.path.startsWith('/contacts')
    });
  }
  
  // Organizations - check permission
  if (authStore.can('organizations', 'view')) {
    nav.push({ 
      name: 'Organizations', 
      href: '/organizations', 
      icon: BuildingOfficeIcon,
      current: route.path.startsWith('/organizations')
    });
  }
  
  // Deals - check permission
  if (authStore.can('deals', 'view')) {
    nav.push({ 
      name: 'Deals', 
      href: '/deals', 
      icon: BriefcaseIcon,
      current: route.path.startsWith('/deals')
    });
  }
  
  // Tasks - check permission
  if (authStore.can('tasks', 'view')) {
    nav.push({ 
      name: 'Tasks', 
      href: '/tasks', 
      icon: CheckCircleIcon,
      current: route.path.startsWith('/tasks')
    });
  }
  
  // Calendar/Events - check permission
  if (authStore.can('events', 'view')) {
    nav.push({ 
      name: 'Calendar', 
      href: '/calendar', 
      icon: CalendarIcon,
      current: route.path.startsWith('/calendar')
    });
  }
  
  // Imports - check permission
  if (authStore.can('imports', 'view')) {
    nav.push({ 
      name: 'Imports', 
      href: '/imports', 
      icon: ArrowDownTrayIcon,
      current: route.path.startsWith('/imports')
    });
  }
  
  // Projects - check permission
  if (authStore.can('projects', 'view')) {
    nav.push({ 
      name: 'Projects', 
      href: '/items', 
      icon: FolderIcon,
      current: route.path.startsWith('/items')
    });
  }
  
  // Admin-only links for Owners/Admins
  if (authStore.isOwner || authStore.userRole === 'admin') {
    nav.push({ 
      name: 'Demo Requests', 
      href: '/demo-requests', 
      icon: RectangleStackIcon,
      current: route.path.startsWith('/demo-requests')
    });
    nav.push({ 
      name: 'Instances', 
      href: '/instances', 
      icon: ServerIcon,
      current: route.path.startsWith('/instances')
    });
  }
  
  return nav;
});
// ---

const { colorMode, toggleColorMode } = useColorMode();
const authStore = useAuthStore();
const router = useRouter();
const { openTab } = useTabs();

// Handle navigation click - open in tab instead of direct navigation
const handleNavClick = (item) => {
  openTab(item.href, {
    title: item.name
    // Note: Don't pass item.icon (it's a Vue component)
    // Let useTabs.js auto-detect the emoji icon from the path
  });
};

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
  <!-- Sidebar Container -->
  <div 
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
    :class="[
      'fixed left-0 top-0 h-screen transition-all duration-300 ease-in-out',
      'bg-[#6049E7] dark:bg-[#1a1a1a]',
      'flex flex-col',
      // Desktop
      'hidden lg:flex',
      // Width based on expanded state (click or hover)
      shouldShowExpanded ? 'lg:w-64' : 'lg:w-20',
      // Z-index and shadow - higher when hovering for overlay effect
      isHovering ? 'z-50 shadow-2xl' : 'z-40 shadow-lg',
      // Mobile - show when menu is open
      isMobileMenuOpen ? 'flex w-64' : ''
    ]"
  >
    <!-- Logo Section -->
    <div class="flex items-center justify-between p-4 border-b border-white/10 dark:border-gray-800 min-h-[4rem]">
      <transition
        enter-active-class="transition-all duration-300"
        enter-from-class="opacity-0 w-0"
        enter-to-class="opacity-100 w-auto"
        leave-active-class="transition-all duration-300"
        leave-from-class="opacity-100 w-auto"
        leave-to-class="opacity-0 w-0"
      >
        <div v-if="shouldShowExpanded" class="flex items-center space-x-2 overflow-hidden">
          <img 
            class="h-8 w-auto transition-all duration-300" 
            :src="logoSrc" 
            alt="LiteDesk Logo" 
          />
        </div>
      </transition>
      
      <!-- Collapse/Expand Button -->
      <button
        @click="toggleSidebar"
        class="p-2 rounded-lg hover:bg-white/10 dark:hover:bg-gray-800 text-white transition-all duration-300 flex-shrink-0"
        :class="{ 'mx-auto': !shouldShowExpanded }"
      >
        <ChevronLeftIcon v-if="shouldShowExpanded" class="w-5 h-5 transition-transform duration-300" />
        <ChevronRightIcon v-else class="w-5 h-5 transition-transform duration-300" />
      </button>
    </div>

    <!-- Navigation Links -->
    <nav class="flex-1 overflow-y-auto py-4 px-2">
      <div class="space-y-1">
        <a
          v-for="item in navigation"
          :key="item.name"
          :href="item.href"
          @click.prevent="handleNavClick(item)"
          :class="[
            'flex items-center rounded-lg transition-colors duration-200',
            'hover:bg-white/10 dark:hover:bg-gray-800',
            item.current
              ? 'bg-white/20 dark:bg-gray-800 text-white font-semibold'
              : 'text-white/80 dark:text-gray-300',
            shouldShowExpanded ? 'px-3 py-2.5' : 'px-3 py-2.5'
          ]"
          :title="!shouldShowExpanded ? item.name : ''"
        >
          <!-- Icon container with fixed width to prevent shifting -->
          <div :class="['flex items-center justify-center flex-shrink-0', shouldShowExpanded ? 'w-6' : 'w-full']">
            <component 
              :is="item.icon" 
              class="w-6 h-6"
            />
          </div>
          
          <!-- Label with smooth transition -->
          <transition
            enter-active-class="transition-all duration-300 ease-out"
            enter-from-class="opacity-0 max-w-0"
            enter-to-class="opacity-100 max-w-xs"
            leave-active-class="transition-all duration-300 ease-in"
            leave-from-class="opacity-100 max-w-xs"
            leave-to-class="opacity-0 max-w-0"
          >
            <span 
              v-if="shouldShowExpanded" 
              class="ml-3 text-sm font-medium whitespace-nowrap overflow-hidden"
            >
              {{ item.name }}
            </span>
          </transition>
        </a>
      </div>
    </nav>

    <!-- User Section at Bottom -->
    <div class="border-t border-white/10 dark:border-gray-800 p-4 space-y-3">
      <!-- Search - Only show when expanded -->
      <transition
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="opacity-0 max-h-0"
        enter-to-class="opacity-100 max-h-20"
        leave-active-class="transition-all duration-300 ease-in"
        leave-from-class="opacity-100 max-h-20"
        leave-to-class="opacity-0 max-h-0"
      >
        <div v-if="shouldShowExpanded" class="overflow-hidden">
          <div class="relative">
            <MagnifyingGlassIcon class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/60" />
            <input
              type="text"
              placeholder="Search..."
              class="w-full pl-9 pr-3 py-2 text-sm rounded-lg 
                     bg-white/10 dark:bg-gray-800
                     text-white placeholder-white/60
                     border border-white/20 dark:border-gray-700
                     focus:outline-none focus:ring-2 focus:ring-white/40
                     transition-all duration-200"
            />
          </div>
        </div>
      </transition>

      <!-- Notifications - Always in same position, just changes appearance -->
      <button
        :class="[
          'w-full rounded-lg hover:bg-white/10 dark:hover:bg-gray-800 text-white/80 transition-colors duration-200',
          'flex items-center py-2.5 px-3'
        ]"
        :title="!shouldShowExpanded ? 'Notifications' : ''"
      >
        <!-- Icon container with fixed width -->
        <div :class="['flex items-center justify-center flex-shrink-0', shouldShowExpanded ? 'w-6' : 'w-full']">
          <BellIcon class="w-6 h-6" />
        </div>
        
        <!-- Label -->
        <transition
          enter-active-class="transition-all duration-300 ease-out"
          enter-from-class="opacity-0 max-w-0"
          enter-to-class="opacity-100 max-w-xs"
          leave-active-class="transition-all duration-300 ease-in"
          leave-from-class="opacity-100 max-w-xs"
          leave-to-class="opacity-0 max-w-0"
        >
          <span v-if="shouldShowExpanded" class="ml-3 text-sm whitespace-nowrap overflow-hidden">Notifications</span>
        </transition>
      </button>

      <!-- User Menu - Always in same position -->
      <Menu as="div" class="relative">
        <MenuButton
          :class="[
            'w-full flex items-center rounded-lg py-2.5 px-3',
            'hover:bg-white/10 dark:hover:bg-gray-800',
            'text-white transition-colors duration-200'
          ]"
        >
          <!-- Avatar container with fixed width -->
          <div :class="['flex items-center justify-center flex-shrink-0', shouldShowExpanded ? 'w-8' : 'w-full']">
            <img
              class="w-8 h-8 rounded-full ring-2 ring-white/20"
              :src="authStore.user?.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'"
              alt="User avatar"
            />
          </div>
          
          <!-- User info -->
          <transition
            enter-active-class="transition-all duration-300 ease-out"
            enter-from-class="opacity-0 max-w-0"
            enter-to-class="opacity-100 max-w-xs"
            leave-active-class="transition-all duration-300 ease-in"
            leave-from-class="opacity-100 max-w-xs"
            leave-to-class="opacity-0 max-w-0"
          >
            <div v-if="shouldShowExpanded" class="flex-1 ml-3 text-left overflow-hidden">
              <p class="text-sm font-medium text-white truncate">{{ userName }}</p>
              <p class="text-xs text-white/60 truncate">{{ authStore.userRole }}</p>
            </div>
          </transition>
          
          <!-- Menu icon -->
          <transition
            enter-active-class="transition-all duration-300 ease-out"
            enter-from-class="opacity-0 max-w-0"
            enter-to-class="opacity-100 max-w-xs"
            leave-active-class="transition-all duration-300 ease-in"
            leave-from-class="opacity-100 max-w-xs"
            leave-to-class="opacity-0 max-w-0"
          >
            <Bars3Icon v-if="shouldShowExpanded" class="w-5 h-5 text-white/60 flex-shrink-0 ml-2" />
          </transition>
        </MenuButton>

        <transition
          enter-active-class="transition ease-out duration-100"
          enter-from-class="transform opacity-0 scale-95"
          enter-to-class="transform opacity-100 scale-100"
          leave-active-class="transition ease-in duration-75"
          leave-from-class="transform opacity-100 scale-100"
          leave-to-class="transform opacity-0 scale-95"
        >
          <MenuItems
            :class="[
              'absolute bottom-full mb-2 w-48 rounded-lg shadow-xl py-1',
              'bg-white dark:bg-[#191919]',
              'ring-1 ring-black/5 dark:ring-white/10',
              'left-0'
            ]"
          >
            <template v-for="(item, index) in userMenuItems" :key="index">
              <hr v-if="item.divider" class="my-1 border-gray-200 dark:border-gray-800" />
              <MenuItem v-slot="{ active }">
                <button
                  @click="item.action()"
                  :class="[
                    'w-full text-left px-4 py-2 text-sm transition-colors duration-150',
                    active ? 'bg-gray-100 dark:bg-gray-800' : '',
                    item.isLogout
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-700 dark:text-gray-200'
                  ]"
                >
                  {{ item.name }}
                </button>
              </MenuItem>
            </template>
          </MenuItems>
        </transition>
      </Menu>
    </div>
  </div>

  <!-- Top Bar (for mobile) -->
  <div class="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#6049E7] dark:bg-[#1a1a1a] shadow-lg z-30 flex items-center justify-between px-4">
    <button
      @click="toggleMobileMenu"
      class="p-2 rounded-lg hover:bg-white/10 text-white"
    >
      <Bars3Icon v-if="!isMobileMenuOpen" class="w-6 h-6" />
      <XMarkIcon v-else class="w-6 h-6" />
    </button>
    
    <img class="h-8 w-auto" :src="logoSrc" alt="LiteDesk Logo" />
    
    <div class="flex items-center space-x-2">
      <button class="p-2 rounded-full hover:bg-white/10 text-white">
        <BellIcon class="w-6 h-6" />
      </button>
      <img
        class="w-8 h-8 rounded-full ring-2 ring-white/20"
        :src="authStore.user?.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'"
        alt="User avatar"
      />
    </div>
  </div>

  <!-- Mobile Overlay -->
  <transition
    enter-active-class="transition-opacity duration-300"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition-opacity duration-300"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="isMobileMenuOpen"
      @click="toggleMobileMenu"
      class="lg:hidden fixed inset-0 bg-black/50 z-30"
    ></div>
  </transition>
</template>



<!-- <template>

  <nav class="flex items-center justify-between p-2 shadow-md sm:px-6 lg:px-8 
      /* Light Mode: White background, gray text, brand border */
      bg-white text-gray-800 border-b border-brand-200
      /* Dark Mode: Dark background, light text, deeper brand border */
      dark:bg-gray-800 dark:text-gray-100 dark:border-brand-800">

    <div class="flex items-center text-xl font-bold">
      <img
        :src="colorMode === 'dark' || colorMode === 'system' ? '/assets/nurtura_logo_dark.svg' : '/assets/nurtura_logo_light.svg'"
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