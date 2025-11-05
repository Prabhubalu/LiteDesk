import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import LandingPage from '@/views/LandingPage.vue'

const routes = [
  {
    path: '/',
    name: 'landing',
    component: LandingPage
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/Login.vue')
  },
  {
    path: '/demo',
    name: 'demo',
    component: () => import('@/views/Demo.vue')
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('@/views/Dashboard.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/Settings.vue'),
    meta: { requiresAuth: true, hideShell: true } // render without main nav/topbar
  },
  {
    path: '/demo-requests',
    name: 'demo-requests',
    component: () => import('@/views/DemoRequests.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/instances',
    name: 'instances',
    component: () => import('@/views/InstanceManagement.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/people',
    name: 'people',
    component: () => import('@/views/Contacts.vue'),
    meta: { requiresAuth: true, requiresPermission: { module: 'people', action: 'view' } }
  },
  {
    path: '/people/:id',
    name: 'person-detail',
    component: () => import('@/views/PeopleDetail.vue'),
    meta: { requiresAuth: true, requiresPermission: { module: 'people', action: 'view' } }
  },
  // Backward-compat redirects
  { path: '/contacts', redirect: { name: 'people' } },
  { path: '/contacts/:id', redirect: to => ({ name: 'person-detail', params: { id: to.params.id } }) },
  {
    path: '/deals',
    name: 'deals',
    component: () => import('@/views/Deals.vue'),
    meta: { requiresAuth: true, requiresPermission: { module: 'deals', action: 'view' } }
  },
  {
    path: '/deals/:id',
    name: 'deal-detail',
    component: () => import('@/views/DealDetail.vue'),
    meta: { requiresAuth: true, requiresPermission: { module: 'deals', action: 'view' } }
  },
  {
    path: '/tasks',
    name: 'tasks',
    component: () => import('@/views/Tasks.vue'),
    meta: { requiresAuth: true, requiresPermission: { module: 'tasks', action: 'view' } }
  },
  {
    path: '/calendar',
    name: 'calendar',
    component: () => import('@/views/Calendar.vue'),
    meta: { requiresAuth: true, requiresPermission: { module: 'events', action: 'view' } }
  },
  {
    path: '/events/:id',
    name: 'event-detail',
    component: () => import('@/views/EventDetail.vue'),
    meta: { requiresAuth: true, requiresPermission: { module: 'events', action: 'view' } }
  },
  {
    path: '/imports',
    name: 'imports',
    component: () => import('@/views/Imports.vue'),
    meta: { requiresAuth: true, requiresPermission: { module: 'imports', action: 'view' } }
  },
  {
    path: '/imports/:id',
    name: 'import-detail',
    component: () => import('@/views/ImportDetail.vue'),
    meta: { requiresAuth: true, requiresPermission: { module: 'imports', action: 'view' } }
  },
  {
    path: '/organizations',
    name: 'organizations',
    component: () => import('@/views/Organizations.vue'),
    meta: { requiresAuth: true, requiresPermission: { module: 'organizations', action: 'view' } }
  },
  {
    path: '/organizations/:id',
    name: 'organization-detail',
    component: () => import('@/views/OrganizationDetail.vue'),
    meta: { requiresAuth: true, requiresPermission: { module: 'organizations', action: 'view' } }
  },
  {
    path: '/groups',
    name: 'groups',
    component: () => import('@/views/Groups.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/groups/:id',
    name: 'group-detail',
    component: () => import('@/views/GroupDetail.vue'),
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

// Add debug logging and permission checks
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()
  console.log('Navigation guard:', {
    to: to.path,
    isAuthenticated: authStore.isAuthenticated,
    user: authStore.user,
    permissions: authStore.user?.permissions
  })

  // Check authentication
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    console.log('Blocked: Authentication required')
    next({ name: 'landing' })
    return
  }
  
  // Redirect authenticated users from landing page
  if (to.name === 'landing' && authStore.isAuthenticated) {
    console.log('Redirecting: Already authenticated')
    next({ name: 'dashboard' })
    return
  }
  
  // Check permissions if required
  if (to.meta.requiresPermission) {
    const { module, action } = to.meta.requiresPermission
    const hasPermission = authStore.can(module, action)
    
    console.log('Permission check:', {
      module,
      action,
      hasPermission,
      isOwner: authStore.isOwner
    })
    
    if (!hasPermission) {
      console.log('Blocked: Insufficient permissions')
      alert(`You don't have permission to access ${module}. Please contact your administrator.`)
      next({ name: 'dashboard' })
      return
    }
  }
  
  // Ensure dashboard tab exists when navigating to dashboard
  if (to.name === 'dashboard' && authStore.isAuthenticated) {
    // Import useTabs dynamically to avoid circular dependency
    import('@/composables/useTabs.js').then(({ useTabs }) => {
      const { initTabs } = useTabs()
      initTabs()
    })
  }
  
  console.log('Allowed: Normal navigation')
  next()
})

export default router