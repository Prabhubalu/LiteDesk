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
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('@/views/Dashboard.vue'),
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

// Add debug logging
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()
  console.log('Navigation guard:', {
    to: to.path,
    isAuthenticated: authStore.isAuthenticated,
    user: authStore.user
  })

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    console.log('Blocked: Authentication required')
    next({ name: 'landing' })
  } else if (to.name === 'landing' && authStore.isAuthenticated) {
    console.log('Redirecting: Already authenticated')
    next({ name: 'dashboard' })
  } else {
    console.log('Allowed: Normal navigation')
    next()
  }
})

export default router