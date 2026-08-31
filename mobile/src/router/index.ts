import { createRouter, createWebHistory } from 'vue-router'
import { getMobileModule } from '@/config/mobileModules'
import { hasSeenWelcome } from '@/services/onboardingFlags'
import {
  isUnlocked,
  markUnlocked,
  requiresBiometricUnlock
} from '@/services/biometricUnlock'
import { isNativeSimulator } from '@/utils/nativePlatform'
import { hasPermission } from '@/utils/permissions'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/welcome',
      name: 'welcome',
      component: () => import('@/views/WelcomeView.vue'),
      meta: { public: true }
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true }
    },
    {
      path: '/',
      component: () => import('@/views/ShellView.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'home',
          component: () => import('@/views/HomeView.vue'),
          meta: { title: 'Home' }
        },
        {
          path: 'inbox',
          name: 'inbox',
          component: () => import('@/views/InboxListView.vue'),
          meta: { title: 'Inbox' }
        },
        {
          path: 'inbox/:threadId',
          name: 'inbox-thread',
          components: {
            default: () => import('@/views/InboxListView.vue'),
            drawer: () => import('@/views/InboxThreadView.vue')
          },
          props: { drawer: true },
          meta: { title: 'Thread', hideTabBar: true }
        },
        {
          path: 'tasks',
          name: 'tasks',
          component: () => import('@/views/TasksListView.vue'),
          meta: { title: 'Tasks' }
        },
        {
          path: 'tasks/:taskId',
          name: 'task-detail',
          components: {
            default: () => import('@/views/TasksListView.vue'),
            drawer: () => import('@/views/TaskDetailView.vue')
          },
          props: { drawer: true },
          meta: { title: 'Task', hideTabBar: true }
        },
        {
          path: 'search',
          name: 'search',
          component: () => import('@/views/SearchView.vue'),
          meta: { title: 'Search' }
        },
        {
          path: 'apps',
          name: 'apps',
          component: () => import('@/views/AppsView.vue'),
          meta: { title: 'Apps' }
        },
        {
          path: 'more',
          redirect: { name: 'apps' }
        },
        {
          path: 'notifications',
          name: 'notifications',
          component: () => import('@/views/NotificationsView.vue'),
          meta: { title: 'Notifications' }
        },
        {
          path: 'modules/people',
          name: 'people-list',
          component: () => import('@/views/PeopleListView.vue'),
          meta: { title: 'People' }
        },
        {
          path: 'modules/people/:recordId',
          name: 'people-detail',
          components: {
            default: () => import('@/views/PeopleListView.vue'),
            drawer: () => import('@/views/PeopleDetailView.vue')
          },
          props: {
            default: false,
            drawer: (route) => ({ personId: route.params.recordId })
          },
          meta: { title: 'Person', hideTabBar: true }
        },
        {
          path: 'modules/:moduleKey',
          name: 'module-list',
          component: () => import('@/views/ModuleListView.vue'),
          props: true,
          meta: { title: 'Module' }
        },
        {
          path: 'modules/:moduleKey/:recordId',
          name: 'module-detail',
          components: {
            default: () => import('@/views/ModuleListView.vue'),
            drawer: () => import('@/views/ModuleDetailView.vue')
          },
          props: { default: true, drawer: true },
          meta: { title: 'Detail', hideTabBar: true }
        }
      ]
    }
  ]
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!auth.bootstrapped) {
    await auth.bootstrap()
  }

  if (isNativeSimulator() && auth.isAuthenticated && !isUnlocked()) {
    markUnlocked()
  }

  if (to.meta.public) {
    if (auth.isAuthenticated && (to.name === 'login' || to.name === 'welcome')) {
      const needsUnlock = await requiresBiometricUnlock(auth.isAuthenticated)
      if (!needsUnlock || isUnlocked()) {
        return { name: 'home' }
      }
      if (to.name === 'login' && to.query.unlock !== '1') {
        return {
          name: 'login',
          query: { ...to.query, unlock: '1', redirect: String(to.query.redirect || '/') }
        }
      }
    }
    return true
  }

  if (auth.isAuthenticated) {
    const needsUnlock = await requiresBiometricUnlock(auth.isAuthenticated)
    if (needsUnlock && !isUnlocked()) {
      if (isNativeSimulator()) {
        markUnlocked()
      } else {
        return {
          name: 'login',
          query: { ...to.query, redirect: to.fullPath, unlock: '1' }
        }
      }
    }
  }

  if (!auth.isAuthenticated) {
    const seenWelcome = await hasSeenWelcome()
    if (!seenWelcome && to.name !== 'welcome') {
      return { name: 'welcome', query: { redirect: to.fullPath } }
    }
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (
    to.name === 'module-list' ||
    to.name === 'module-detail' ||
    to.name === 'people-list' ||
    to.name === 'people-detail'
  ) {
    const moduleKey =
      to.name === 'people-list' || to.name === 'people-detail'
        ? 'people'
        : String(to.params.moduleKey || '')
    const mod = getMobileModule(moduleKey)
    if (!mod || !hasPermission(auth.user, mod.permission)) {
      return { name: 'apps' }
    }
  }

  return true
})

export default router
