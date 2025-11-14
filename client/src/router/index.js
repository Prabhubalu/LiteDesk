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
    meta: { requiresAuth: true, requiresMasterOrganization: true }
  },
  {
    path: '/instances',
    name: 'instances',
    component: () => import('@/views/InstanceManagement.vue'),
    meta: { requiresAuth: true, requiresMasterOrganization: true }
  },
  {
    path: '/people',
    name: 'people',
    component: () => import('@/views/People.vue'),
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
    path: '/events',
    name: 'events',
    component: () => import('@/views/Events.vue'),
    meta: { requiresAuth: true, requiresPermission: { module: 'events', action: 'view' } }
  },
  // Backward-compat redirect
  { path: '/calendar', redirect: { name: 'events' } },
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
  },
  {
    path: '/forms',
    name: 'forms',
    component: () => import('@/views/Forms.vue'),
    meta: { requiresAuth: true, requiresPermission: { module: 'forms', action: 'view' } }
  },
  {
    path: '/forms/builder',
    name: 'form-builder-new',
    component: () => import('@/views/FormBuilder.vue'),
    meta: { requiresAuth: true, requiresPermission: { module: 'forms', action: 'create' } }
  },
  {
    path: '/forms/builder/:id',
    name: 'form-builder',
    component: () => import('@/views/FormBuilder.vue'),
    meta: { requiresAuth: true, requiresPermission: { module: 'forms', action: 'edit' } }
  },
  {
    path: '/forms/public/:slug',
    name: 'public-form',
    component: () => import('@/views/PublicFormView.vue'),
    meta: { requiresAuth: false, hideShell: true } // Public route - render without app shell (sidebar/tabbar)
  },
  {
    path: '/forms/my-audits',
    name: 'my-audits',
    component: () => import('@/views/MyAudits.vue'),
    meta: { requiresAuth: true, requiresPermission: { module: 'forms', action: 'view' } }
  },
  {
    path: '/forms/:id/detail',
    name: 'form-detail',
    component: () => import('@/views/FormDetail.vue'),
    meta: { requiresAuth: true, requiresPermission: { module: 'forms', action: 'view' } }
  },
  {
    path: '/forms/:id/responses',
    name: 'form-responses',
    component: () => import('@/views/FormResponses.vue'),
    meta: { requiresAuth: true, requiresPermission: { module: 'forms', action: 'view' } }
  },
  {
    path: '/forms/:id/responses/:responseId',
    name: 'form-response-detail',
    component: () => import('@/views/FormResponseDetail.vue'),
    meta: { requiresAuth: true, requiresPermission: { module: 'forms', action: 'view' } }
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
  
  // Redirect authenticated users from login page (prevents going back to login)
  if (to.name === 'login' && authStore.isAuthenticated) {
    console.log('Redirecting: Already authenticated, cannot access login')
    next({ name: 'dashboard' })
    return
  }
  
  // Check if route requires master organization
  if (to.meta.requiresMasterOrganization && !authStore.isMasterOrganization) {
    console.log('Blocked: Master organization required')
    alert('This feature is only available to the application owner.')
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