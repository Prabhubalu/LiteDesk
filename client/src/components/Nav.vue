<script setup>
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useTabs } from '@/composables/useTabs';
import { computed, ref, watch } from 'vue';
import { useColorMode } from '@/composables/useColorMode';
import { Dialog, DialogPanel, TransitionChild, TransitionRoot, Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue'
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

const sidebarOpen = ref(false);
const isHovering = ref(false);

// Computed to determine if sidebar should show expanded
const shouldShowExpanded = computed(() => {
  return !isCollapsed.value || isHovering.value;
});

const toggleSidebar = () => {
  isCollapsed.value = !isCollapsed.value;
  
  // Dispatch custom event so TabBar can react to sidebar state change
  window.dispatchEvent(new CustomEvent('sidebar-toggle', { 
    detail: { collapsed: isCollapsed.value } 
  }));
};

const toggleMobileMenu = () => {
  sidebarOpen.value = !sidebarOpen.value;
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
  sidebarOpen.value = false;
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

const { colorMode, toggleColorMode, clearStoredMode } = useColorMode();
const authStore = useAuthStore();
const router = useRouter();
const { openTab } = useTabs();

// Handle navigation click - open in tab instead of direct navigation
const handleNavClick = (item, event) => {
  // Check if user wants to open in background
  const openInBackground = event && (
    event.button === 1 || // Middle mouse button
    event.metaKey ||      // Cmd on Mac
    event.ctrlKey         // Ctrl on Windows/Linux
  );
  
  openTab(item.href, {
    title: item.name,
    background: openInBackground
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
    const newMode = colorMode.value === 'light' ? 'dark' : 'light';
    console.log('Toggling color mode from', colorMode.value, 'to', newMode);
    toggleColorMode(newMode);
    console.log('Color mode after toggle:', colorMode.value);
    
    // Debug: Check if mode was actually changed
    setTimeout(() => {
        console.log('Color mode after timeout:', colorMode.value);
        console.log('Stored mode:', localStorage.getItem('color-mode'));
    }, 100);
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
        return '/public/assets/nurtura_logo_white.svg'; 
    } else {
        // Use the dark-colored logo for light backgrounds
        // IMPORTANT: Update this path to your actual logo file for light backgrounds
        return '/public/assets/nurtura_logo_plain.svg'; 
    }
});
</script>

<template>
  <div>
    <!-- Mobile sidebar -->
    <TransitionRoot as="template" :show="sidebarOpen">
      <Dialog class="relative z-50 lg:hidden" @close="sidebarOpen = false">
        <TransitionChild as="template" enter="transition-opacity ease-linear duration-300" enter-from="opacity-0" enter-to="opacity-100" leave="transition-opacity ease-linear duration-300" leave-from="opacity-100" leave-to="opacity-0">
          <div class="fixed inset-0 bg-gray-900/80 dark:bg-gray-900/80" />
        </TransitionChild>

        <div class="fixed inset-0 flex">
          <TransitionChild as="template" enter="transition ease-in-out duration-300 transform" enter-from="-translate-x-full" enter-to="translate-x-0" leave="transition ease-in-out duration-300 transform" leave-from="translate-x-0" leave-to="-translate-x-full">
            <DialogPanel class="relative mr-16 flex w-full max-w-xs flex-1">
              <TransitionChild as="template" enter="ease-in-out duration-300" enter-from="opacity-0" enter-to="opacity-100" leave="ease-in-out duration-300" leave-from="opacity-100" leave-to="opacity-0">
                <div class="absolute top-0 left-full flex w-16 justify-center pt-5">
                  <button type="button" class="-m-2.5 p-2.5" @click="sidebarOpen = false">
                    <span class="sr-only">Close sidebar</span>
                    <XMarkIcon class="size-6 text-white dark:text-white" aria-hidden="true" />
                  </button>
                </div>
              </TransitionChild>

              <!-- Mobile Sidebar component -->
              <div class="relative flex grow flex-col gap-y-5 overflow-y-auto bg-white dark:bg-gray-900 px-6 pb-2 ring ring-gray-200 dark:ring-white/10 before:pointer-events-none before:absolute before:inset-0 before:bg-gray-50 dark:before:bg-black/10">
                <div class="relative flex h-16 shrink-0 items-center">
                  <img class="h-8 w-auto" :src="logoSrc" alt="LiteDesk Logo" />
                </div>
                <nav class="relative flex flex-1 flex-col">
                  <ul role="list" class="flex flex-1 flex-col gap-y-7">
                    <li>
                      <ul role="list" class="-mx-2 space-y-1">
                        <li v-for="item in navigation" :key="item.name">
                          <a 
                            :href="item.href" 
                            @click.prevent="handleNavClick(item, $event)"
                            :class="[
                              item.current 
                                ? 'bg-gray-100 dark:bg-white/5 text-gray-900 dark:text-white' 
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white', 
                              'group flex gap-x-3 rounded-md p-2 text-sm/6 font-semibold'
                            ]"
                          >
                            <component 
                              :is="item.icon" 
                              :class="[
                                item.current 
                                  ? 'text-gray-900 dark:text-white' 
                                  : 'text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white', 
                                'size-6 shrink-0'
                              ]" 
                              aria-hidden="true" 
                            />
                            {{ item.name }}
                          </a>
                        </li>
                      </ul>
                    </li>
                  </ul>
                </nav>
                
                <!-- User section at bottom -->
                <div class="-mx-6 mt-auto">
                  <Menu as="div" class="relative">
                    <MenuButton class="flex items-center gap-x-4 px-6 py-3 w-full hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
                      <img 
                        class="size-8 rounded-full bg-gray-200 dark:bg-gray-800 outline -outline-offset-1 outline-gray-300 dark:outline-white/10" 
                        :src="authStore.user?.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'" 
                        alt="" 
                      />
                      <span class="text-sm/6 font-semibold text-gray-900 dark:text-white">{{ userName }}</span>
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
                        class="absolute bottom-full mb-2 w-48 rounded-lg shadow-xl py-1 bg-white dark:bg-gray-800 ring-1 ring-black/5 dark:ring-white/10 left-6"
                      >
                        <template v-for="(item, index) in userMenuItems" :key="index">
                          <hr v-if="item.divider" class="my-1 border-gray-200 dark:border-gray-700" />
                          <MenuItem v-slot="{ active }">
                            <button
                              @click="item.action()"
                              :class="[
                                'w-full text-left px-4 py-2 text-sm transition-colors duration-150',
                                active ? 'bg-gray-100 dark:bg-gray-700' : '',
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
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </TransitionRoot>

    <!-- Desktop Sidebar Container with expand/collapse functionality -->
    <div 
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
      :class="[
        'fixed left-0 top-0 h-screen transition-all duration-300 ease-in-out',
        'bg-white border-r border-gray-200 dark:bg-gray-900 dark:border-white/10',
        'flex flex-col',
        // Desktop
        'hidden lg:flex',
        // Width based on expanded state (click or hover)
        shouldShowExpanded ? 'lg:w-64' : 'lg:w-20',
        // Z-index and shadow - higher when hovering for overlay effect
        isHovering ? 'z-50 shadow-2xl' : 'z-40 shadow-lg'
      ]"
    >
      <!-- Logo Section -->
      <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-white/10 min-h-[4rem]">
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
          class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-600 dark:text-white transition-all duration-300 flex-shrink-0"
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
            @click.prevent="handleNavClick(item, $event)"
            @auxclick.prevent="handleNavClick(item, $event)"
            :class="[
              'flex items-center rounded-lg transition-colors duration-200',
              'hover:bg-gray-100 dark:hover:bg-white/5',
              item.current
                ? 'bg-gray-100 dark:bg-white/5 text-gray-900 dark:text-white font-semibold'
                : 'text-gray-600 dark:text-gray-400',
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
      <div class="border-t border-gray-200 dark:border-white/10 p-4 space-y-3">
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
              <MagnifyingGlassIcon class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                class="w-full pl-9 pr-3 py-2 text-sm rounded-lg 
                       bg-gray-50 dark:bg-white/5
                       text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400
                       border border-gray-200 dark:border-white/10
                       focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-white/20
                       transition-all duration-200"
              />
            </div>
          </div>
        </transition>

        <!-- Notifications - Always in same position, just changes appearance -->
        <button
          :class="[
            'w-full rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-600 dark:text-gray-400 transition-colors duration-200',
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
              'hover:bg-gray-100 dark:hover:bg-white/5',
              'text-gray-900 dark:text-white transition-colors duration-200'
            ]"
          >
            <!-- Avatar container with fixed width -->
            <div :class="['flex items-center justify-center flex-shrink-0', shouldShowExpanded ? 'w-8' : 'w-full']">
              <img
                class="w-8 h-8 rounded-full ring-2 ring-white/10 dark:ring-white/10"
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
                <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ userName }}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400 truncate">{{ authStore.userRole }}</p>
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
              <Bars3Icon v-if="shouldShowExpanded" class="w-5 h-5 text-gray-900 dark:text-gray-400 flex-shrink-0 ml-2" />
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
                'bg-white dark:bg-gray-800',
                'ring-1 ring-black/5 dark:ring-white/10',
                'left-0'
              ]"
            >
              <template v-for="(item, index) in userMenuItems" :key="index">
                <hr v-if="item.divider" class="my-1 border-gray-200 dark:border-gray-700" />
                <MenuItem v-slot="{ active }">
                  <button
                    @click="item.action()"
                    :class="[
                      'w-full text-left px-4 py-2 text-sm transition-colors duration-150',
                      active ? 'bg-gray-100 dark:bg-gray-700' : '',
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

    <!-- Mobile top bar -->
    <div class="fixed top-0 left-0 right-0 z-40 flex items-center gap-x-6 bg-white dark:bg-gray-900 px-4 py-3 h-16 after:pointer-events-none after:absolute after:inset-0 after:border-b after:border-gray-200 dark:after:border-white/10 dark:after:bg-black/10 sm:px-6 lg:hidden">
      <button type="button" class="-m-2.5 p-2.5 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white lg:hidden" @click="sidebarOpen = true">
        <span class="sr-only">Open sidebar</span>
        <Bars3Icon class="size-6 text-gray-900 dark:text-gray-400" aria-hidden="true" />
      </button>
      <div class="flex-1 text-sm/6 font-semibold text-gray-900 dark:text-white">Dashboard</div>
      <div class="flex items-center space-x-2">
        <button class="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-600 dark:text-white">
          <BellIcon class="w-6 h-6" />
        </button>
        
        <!-- User Profile Dropdown -->
        <Menu as="div" class="relative">
          <MenuButton class="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
            <img 
              class="size-8 rounded-full bg-gray-200 dark:bg-gray-800 outline -outline-offset-1 outline-gray-300 dark:outline-white/10" 
              :src="authStore.user?.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80'" 
              alt="" 
            />
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
              class="absolute right-0 top-full mt-2 w-48 rounded-lg shadow-xl py-1 bg-white dark:bg-gray-800 ring-1 ring-black/5 dark:ring-white/10"
            >
              <template v-for="(item, index) in userMenuItems" :key="index">
                <hr v-if="item.divider" class="my-1 border-gray-200 dark:border-gray-700" />
                <MenuItem v-slot="{ active }">
                  <button
                    @click="item.action()"
                    :class="[
                      'w-full text-left px-4 py-2 text-sm transition-colors duration-150',
                      active ? 'bg-gray-100 dark:bg-gray-700' : '',
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
  </div>
</template>