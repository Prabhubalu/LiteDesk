/**
 * Boot order: `useAuthStore` from authRegistry stays static. `apiClient` is NOT imported at file
 * level — it is dynamically imported in `initializeDynamicRoutes` and in guards that need it, to
 * avoid router → apiClient → auth → router ESM TDZ in production.
 */
import { createRouter, createWebHistory } from 'vue-router'
import { hasAnySettingsAccess } from '@/utils/settingsTabAccess'
import { useAuthStore } from '@/stores/authRegistry'
import auditRoutes from './audit.routes'
import portalRoutes from './portal.routes'
import { loadAndRegisterRoutes } from '@/utils/dynamicRouteLoader'
import { logNavDebug } from '@/config/arivuDebug.js'
import { buildAppAccessProfile, getSalesDashboardRedirect, getSalesModuleRedirect } from '@/router/appAccessGuards'
import {
  canAccessWhileTrialExpired,
  isOrganizationTrialExpired
} from '@/utils/trialStatus'
import { isAuthLifecyclePublicRoute } from '@/utils/standaloneRoutes'

const routes = [
  {
    path: '/',
    name: 'landing',
    component: () => import('@/views/LandingPage.vue')
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/Login.vue')
  },
  {
    path: '/accept-invite',
    name: 'accept-invite',
    component: () => import('@/views/AcceptInvitePage.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/verify-email',
    name: 'verify-email',
    component: () => import('@/views/VerifyEmailPage.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/forgot-password',
    name: 'forgot-password',
    component: () => import('@/views/ForgotPasswordPage.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/reset-password',
    name: 'reset-password',
    component: () => import('@/views/ResetPasswordPage.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/portal/select',
    name: 'portal-select',
    component: () => import('@/views/auth/PortalSelection.vue'),
    meta: { requiresAuth: true, allowWithoutActivePortal: true }
  },
  {
    path: '/portal/set-password',
    name: 'portal-set-password',
    component: () => import('@/views/auth/PortalSetPassword.vue'),
    meta: { requiresAuth: true, allowWithoutActivePortal: true }
  },
  {
    path: '/trial-expired',
    name: 'trial-expired',
    component: () => import('@/views/TrialExpiredPage.vue'),
    meta: { requiresAuth: true, hideShell: true }
  },
  {
    path: '/pay/checkout/razorpay',
    name: 'public-razorpay-checkout',
    component: () => import('@/views/payments/PublicRazorpayCheckoutPage.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/pay/:publicToken',
    name: 'public-payment-link',
    component: () => import('@/views/payments/PublicPaymentLinkPage.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/pay/:publicToken/return',
    name: 'public-payment-link-return',
    component: () => import('@/views/payments/PublicPaymentLinkReturnPage.vue'),
    meta: { requiresAuth: false }
  },
  // Phase 1G: Platform Landing (Tenant Home)
  {
    path: '/platform',
    redirect: '/platform/home'
  },
  {
    path: '/platform/home',
    name: 'platform-home',
    component: () => import('@/views/platform/PlatformHome.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/onboarding',
    name: 'onboarding',
    component: () => import('@/views/Onboarding.vue'),
    meta: { requiresAuth: true }
  },
  // Phase 2F: App Registry (Marketplace-Ready)
  {
    path: '/platform/apps',
    name: 'platform-app-registry',
    component: () => import('@/views/platform/AppRegistry.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/platform/attention',
    name: 'platform-attention',
    component: () => import('@/views/platform/AttentionSurface.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/demo',
    name: 'demo',
    component: () => import('@/views/Demo.vue')
  },
  {
    path: '/tools/email-smoke-test',
    name: 'email-smoke-test',
    component: () => import('@/views/EmailSmokeTest.vue'),
    alias: ['/email-smoke-test'],
    meta: { requiresAuth: true }
  },
  // Phase 1B: Generic App Dashboard (registry-driven)
  // Note: More specific route (/dashboard/:appKey) must come BEFORE less specific (/dashboard)
  // to ensure proper route matching
  {
    path: '/dashboard/:appKey',
    name: 'app-dashboard',
    component: () => import('@/components/dashboard/AppDashboard.vue'),
    props: (route) => ({ 
      appKey: route.params.appKey.toUpperCase() // Convert to uppercase (SALES, HELPDESK, etc.)
    }),
    meta: { requiresAuth: true }
  },
  // Sales Dashboard - specific route to prevent tab switching issues
  {
    path: '/sales/dashboard',
    name: 'sales-dashboard',
    component: () => import('@/components/dashboard/AppDashboard.vue'),
    props: () => ({ 
      appKey: 'SALES'
    }),
    meta: { requiresAuth: true }
  },
  {
    path: '/dashboard/inventory',
    name: 'inventory-dashboard',
    component: () => import('@/views/inventory/InventoryDashboard.vue'),
    meta: {
      requiresAuth: true,
      requiresPermission: { module: 'inventory', action: 'view' },
      appKey: 'INVENTORY'
    }
  },
  {
    path: '/dashboard/marketing',
    name: 'marketing-dashboard',
    component: () => import('@/views/marketing/MarketingDashboard.vue'),
    meta: {
      requiresAuth: true,
      requiresPermission: { module: 'campaigns', action: 'view' },
      appKey: 'MARKETING'
    }
  },
  {
    path: '/marketing/preferences/:token',
    name: 'marketing-preferences',
    component: () => import('@/views/marketing/PreferenceCenter.vue'),
    meta: { requiresAuth: false, hideShell: true }
  },
  {
    path: '/marketing/campaigns',
    name: 'marketing-campaigns',
    component: () => import('@/views/marketing/CampaignsList.vue'),
    meta: {
      requiresAuth: true,
      requiresPermission: { module: 'campaigns', action: 'view' },
      appKey: 'MARKETING'
    }
  },
  {
    path: '/marketing/campaigns/approvals',
    name: 'marketing-campaign-approvals',
    component: () => import('@/views/marketing/CampaignApprovalsList.vue'),
    meta: {
      requiresAuth: true,
      requiresPermission: { module: 'campaigns', action: 'view' },
      appKey: 'MARKETING'
    }
  },
  {
    path: '/marketing/campaigns/new',
    name: 'marketing-campaign-new',
    component: () => import('@/views/marketing/CampaignEditor.vue'),
    meta: {
      requiresAuth: true,
      requiresPermission: { module: 'campaigns', action: 'create' },
      appKey: 'MARKETING'
    }
  },
  {
    path: '/marketing/campaigns/:id/edit',
    name: 'marketing-campaign-edit',
    component: () => import('@/views/marketing/CampaignEditor.vue'),
    props: true,
    meta: {
      requiresAuth: true,
      requiresPermission: { module: 'campaigns', action: 'edit' },
      appKey: 'MARKETING'
    }
  },
  {
    path: '/marketing/campaigns/:id',
    name: 'marketing-campaign-detail',
    component: () => import('@/views/marketing/CampaignDetail.vue'),
    meta: {
      requiresAuth: true,
      requiresPermission: { module: 'campaigns', action: 'view' },
      appKey: 'MARKETING'
    }
  },
  {
    path: '/marketing/audiences',
    name: 'marketing-audiences',
    component: () => import('@/views/marketing/AudiencesList.vue'),
    meta: {
      requiresAuth: true,
      requiresPermission: { module: 'audiences', action: 'view' },
      appKey: 'MARKETING'
    }
  },
  {
    path: '/marketing/audiences/new',
    name: 'marketing-audience-new',
    component: () => import('@/views/marketing/AudienceDetail.vue'),
    meta: {
      requiresAuth: true,
      requiresPermission: { module: 'audiences', action: 'create' },
      appKey: 'MARKETING'
    }
  },
  {
    path: '/marketing/audiences/:id',
    name: 'marketing-audience-detail',
    component: () => import('@/views/marketing/AudienceDetail.vue'),
    props: true,
    meta: {
      requiresAuth: true,
      requiresPermission: { module: 'audiences', action: 'view' },
      appKey: 'MARKETING'
    }
  },
  {
    path: '/marketing/segments',
    name: 'marketing-segments',
    component: () => import('@/views/marketing/SegmentsList.vue'),
    meta: {
      requiresAuth: true,
      requiresPermission: { module: 'segments', action: 'view' },
      appKey: 'MARKETING'
    }
  },
  {
    path: '/marketing/segments/new',
    name: 'marketing-segment-new',
    component: () => import('@/views/marketing/SegmentBuilder.vue'),
    meta: {
      requiresAuth: true,
      requiresPermission: { module: 'segments', action: 'create' },
      appKey: 'MARKETING'
    }
  },
  {
    path: '/marketing/segments/:id',
    name: 'marketing-segment-detail',
    component: () => import('@/views/marketing/SegmentBuilder.vue'),
    props: true,
    beforeEnter: (to) => {
      const reserved = new Set(['new', 'metadata', 'preview', 'explain']);
      if (reserved.has(String(to.params.id || '').toLowerCase())) {
        return { name: 'marketing-segments' };
      }
      return true;
    },
    meta: {
      requiresAuth: true,
      requiresPermission: { module: 'segments', action: 'edit' },
      appKey: 'MARKETING'
    }
  },
  {
    path: '/marketing/assets',
    name: 'marketing-assets',
    component: () => import('@/views/marketing/AssetsLibrary.vue'),
    meta: {
      requiresAuth: true,
      requiresPermission: { module: 'assets', action: 'view' },
      appKey: 'MARKETING'
    }
  },
  {
    path: '/marketing/reports',
    name: 'marketing-reports',
    component: () => import('@/views/marketing/MarketingReports.vue'),
    meta: {
      requiresAuth: true,
      requiresPermission: { module: 'campaigns', action: 'view' },
      appKey: 'MARKETING'
    }
  },
  {
    path: '/marketing/templates',
    redirect: '/templates'
  },
  {
    path: '/marketing/templates/:id',
    redirect: (to) => ({ name: 'template-builder', params: { id: to.params.id } })
  },
  {
    path: '/inventory',
    name: 'inventory-home',
    redirect: '/dashboard/inventory'
  },
  {
    path: '/marketing',
    name: 'marketing-home',
    redirect: '/dashboard/marketing'
  },
  // Backward compatibility: redirect /dashboard to /sales/dashboard
  {
    path: '/dashboard',
    redirect: '/sales/dashboard'
  },
  {
    path: '/inbox',
    name: 'inbox',
    component: () => import('@/views/InboxSurface.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/live-chat/sessions',
    name: 'live-chat-sessions',
    component: () => import('@/views/live-chat/LiveChatSessionsView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/live-chat/sessions/:sessionId',
    name: 'live-chat-session',
    component: () => import('@/views/live-chat/LiveChatSessionsView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/live-chat/closed',
    name: 'live-chat-closed',
    component: () => import('@/views/live-chat/LiveChatClosedSessionsView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/live-chat/closed/:sessionId',
    name: 'live-chat-closed-session',
    component: () => import('@/views/live-chat/LiveChatClosedSessionDetailView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/live-chat/visitors',
    redirect: '/live-chat/closed'
  },
  {
    path: '/live-chat/visitors/:visitorId',
    redirect: '/live-chat/closed'
  },
  {
    path: '/live-chat/reports',
    name: 'live-chat-reports',
    component: () => import('@/views/live-chat/LiveChatReportsView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/live-chat',
    redirect: '/live-chat/sessions'
  },
  {
    path: '/trash',
    name: 'trash',
    component: () => import('@/views/Trash.vue'),
    meta: { requiresAuth: true, requiresPermission: { module: 'settings', action: 'view' } }
  },
  {
    path: '/approvals',
    name: 'approvals',
    component: () => import('@/views/ApprovalInbox.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/approvals/:id',
    name: 'approval-detail',
    component: () => import('@/views/ApprovalDetail.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/Settings.vue'),
    meta: { requiresAuth: true } // render with shell (internal tab, sidebar collapsed by default)
  },
  {
    // The user menu's "Your profile" entry deep-links here. We surface the
    // profile screen inside the Settings shell so users keep the familiar
    // sidebar navigation between personal and workspace settings.
    path: '/profile',
    name: 'profile',
    redirect: () => ({ path: '/settings', query: { tab: 'profile' } }),
    meta: { requiresAuth: true }
  },
  {
    path: '/settings/notifications/overview',
    name: 'notification-overview',
    component: () => import('@/views/settings/NotificationOverview.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/settings/notifications',
    name: 'notification-preferences',
    component: () => import('@/views/settings/NotificationPreferences.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/settings/notifications/rules',
    name: 'notification-rules',
    component: () => import('@/views/settings/NotificationRules.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/settings/notifications/health',
    name: 'notification-health',
    component: () => import('@/views/settings/NotificationHealth.vue'),
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/settings/demo-requests',
    name: 'settings-demo-requests',
    redirect: () => ({ path: '/settings', query: { tab: 'demo-requests' } }),
    meta: { requiresAuth: true, requiresMasterOrganization: true, hideShell: true }
  },
  {
    path: '/settings/instances',
    name: 'settings-instances',
    redirect: () => ({ path: '/settings', query: { tab: 'instances' } }),
    meta: { requiresAuth: true, requiresMasterOrganization: true, hideShell: true }
  },
  // Settings → Automation (org admin tooling)
  {
    path: '/settings/automation/automation-rules',
    name: 'settings-automation-rules',
    component: () => import('@/views/admin/AutomationRules.vue'),
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/settings/automation/processes',
    name: 'settings-automation-processes',
    component: () => import('@/views/admin/Processes.vue'),
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/settings/automation/processes/new',
    name: 'process-designer-new',
    component: () => import('@/views/admin/ProcessSetupView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true, hideShell: false }
  },
  {
    path: '/settings/automation/processes/:id/design',
    name: 'process-designer',
    component: () => import('@/views/admin/ProcessFlowDesigner.vue'),
    meta: { requiresAuth: true, requiresAdmin: true, hideShell: false }
  },
  {
    path: '/settings/automation/flows',
    name: 'settings-automation-flows',
    component: () => import('@/views/admin/BusinessFlows.vue'),
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/settings/automation/flows/create',
    name: 'settings-automation-flows-create',
    component: () => import('@/views/admin/BusinessFlowForm.vue'),
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/settings/automation/flows/:id',
    name: 'settings-automation-flows-detail',
    component: () => import('@/views/admin/BusinessFlowDetail.vue'),
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/settings/automation/flows/:id/health',
    name: 'settings-automation-flows-health',
    component: () => import('@/views/admin/BusinessFlowHealth.vue'),
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/settings/automation/flows/:id/edit',
    name: 'settings-automation-flows-edit',
    component: () => import('@/views/admin/BusinessFlowForm.vue'),
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  {
    path: '/targets/new',
    name: 'target-create',
    component: () => import('@/views/targets/TargetCreationWizard.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/targets/:id',
    name: 'target-detail',
    component: () => import('@/views/targets/TargetDetailView.vue'),
    meta: { requiresAuth: true }
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
  // Control Plane routes (Phase 0H)
  {
    path: '/control',
    name: 'control-plane',
    component: () => import('@/views/ControlPlane.vue'),
    meta: { 
      requiresAuth: true, 
      requiresPlatformAdmin: true,
      hideShell: false 
    }
  },
  {
    path: '/control/demo-requests',
    name: 'control-demo-requests',
    component: () => import('@/views/DemoRequests.vue'),
    meta: { 
      requiresAuth: true, 
      requiresPlatformAdmin: true 
    }
  },
  {
    path: '/control/instances',
    name: 'control-instances',
    component: () => import('@/views/InstanceManagement.vue'),
    meta: { 
      requiresAuth: true, 
      requiresPlatformAdmin: true 
    }
  },
  {
    path: '/control/inbound-parser',
    name: 'control-inbound-parser',
    component: () => import('@/views/ControlPlaneInboundParser.vue'),
    meta: {
      requiresAuth: true,
      requiresPlatformAdmin: true
    }
  },
  {
    path: '/control/amds-infra',
    name: 'control-amds-infra',
    component: () => import('@/views/ControlPlaneAmdsInfra.vue'),
    meta: {
      requiresAuth: true,
      requiresPlatformAdmin: true
    }
  },
  {
    path: '/control/release-notes',
    name: 'control-release-notes',
    component: () => import('@/views/admin/PlatformReleaseNotesList.vue'),
    meta: {
      requiresAuth: true,
      requiresPlatformAdmin: true
    }
  },
  {
    path: '/control/release-notes/new',
    name: 'control-release-note-new',
    component: () => import('@/views/admin/PlatformReleaseNoteEditor.vue'),
    props: { id: 'new' },
    meta: {
      requiresAuth: true,
      requiresPlatformAdmin: true
    }
  },
  {
    path: '/control/release-notes/:id',
    name: 'control-release-note-edit',
    component: () => import('@/views/admin/PlatformReleaseNoteEditor.vue'),
    props: (route) => ({ id: route.params.id }),
    meta: {
      requiresAuth: true,
      requiresPlatformAdmin: true
    }
  },
  {
    path: '/control/automation-rules',
    redirect: '/settings/automation/automation-rules',
  },
  {
    path: '/control/processes',
    redirect: '/settings/automation/processes',
  },
  {
    path: '/control/flows/create',
    redirect: '/settings/automation/flows/create',
  },
  {
    path: '/control/flows/:id/health',
    redirect: to => ({ path: `/settings/automation/flows/${to.params.id}/health` }),
  },
  {
    path: '/control/flows/:id/edit',
    redirect: to => ({ path: `/settings/automation/flows/${to.params.id}/edit` }),
  },
  {
    path: '/control/flows/:id',
    redirect: to => ({ path: `/settings/automation/flows/${to.params.id}` }),
  },
  {
    path: '/control/flows',
    redirect: '/settings/automation/flows',
  },
  {
    path: '/people',
    name: 'people',
    component: () => import('@/views/People.vue'),
    meta: { requiresAuth: true, requiresPermission: { module: 'people', action: 'view' } }
  },
  {
    path: '/people/create',
    name: 'people-create',
    component: () => import('@/views/PeopleCreate.vue'),
    meta: { requiresAuth: true, requiresPermission: { module: 'people', action: 'create' } }
  },
  {
    path: '/people/:id',
    name: 'person-detail',
    component: () => import('@/pages/ModuleRecordPage.vue'),
    meta: { requiresAuth: true, requiresPermission: { module: 'people', action: 'view' }, moduleKey: 'people' }
  },
  // Backward-compat redirects
  { path: '/contacts', redirect: { name: 'people' } },
  { path: '/contacts/:id', redirect: to => ({ name: 'person-detail', params: { id: to.params.id } }) },
  { path: '/sales/people', redirect: { name: 'people' } },
  { path: '/sales/people/:id', redirect: to => ({ name: 'person-detail', params: { id: to.params.id } }) },
  {
    path: '/deals',
    name: 'deals',
    component: () => import('@/views/Deals.vue'),
    meta: { requiresAuth: true, requiresPermission: { module: 'deals', action: 'view' } }
  },
  {
    path: '/deals/:id',
    name: 'deal-detail',
    component: () => import('@/pages/ModuleRecordPage.vue'),
    meta: { requiresAuth: true, requiresPermission: { module: 'deals', action: 'view' }, moduleKey: 'deals' }
  },
  {
    path: '/tasks',
    name: 'tasks',
    component: () => import('@/views/Tasks.vue'),
    meta: { requiresAuth: true, requiresPermission: { module: 'tasks', action: 'view' } }
  },
  {
    path: '/tasks/:id',
    name: 'task-detail',
    component: () => import('@/pages/ModuleRecordPage.vue'),
    meta: { requiresAuth: true, requiresPermission: { module: 'tasks', action: 'view' }, moduleKey: 'tasks' }
  },
  {
    path: '/events',
    name: 'events',
    component: () => import('@/views/Events.vue'),
    meta: { requiresAuth: true, requiresPermission: { module: 'events', action: 'view' } }
  },
  {
    path: '/events/create',
    name: 'events-create',
    component: () => import('@/components/events/GenericEventCreateSurface.vue'),
    meta: { requiresAuth: true, requiresPermission: { module: 'events', action: 'create' } }
  },
  // Backward-compat redirect
  { path: '/calendar', redirect: { name: 'events' } },
  {
    path: '/events/:id',
    name: 'event-detail',
    component: () => import('@/pages/ModuleRecordPage.vue'),
    meta: { requiresAuth: true, requiresPermission: { module: 'events', action: 'view' }, moduleKey: 'events' }
  },
  // Audit workflow execution surface. Generic events redirect to /events/:id (inline panel).
  {
    path: '/events/:id/execute',
    name: 'event-execution',
    component: () => import('@/views/EventExecutionSurface.vue'),
    meta: { requiresAuth: true, requiresPermission: { module: 'events', action: 'view' } }
  },
  {
    path: '/items',
    name: 'items',
    component: () => import('@/views/Items.vue'),
    meta: { requiresAuth: true, requiresPermission: { module: 'items', action: 'view' } }
  },
  {
    path: '/quotes',
    name: 'quotes',
    component: () => import('@/views/Quotes.vue'),
    meta: {
      requiresAuth: true,
      requiresPermission: { module: 'quotes', action: 'view' },
      moduleKey: 'quotes',
      appKey: 'PLATFORM',
      routeType: 'list'
    }
  },
  {
    path: '/quotes/new',
    name: 'quotes-create',
    component: () => import('@/views/Quotes.vue'),
    meta: {
      requiresAuth: true,
      requiresPermission: { module: 'quotes', action: 'create' },
      moduleKey: 'quotes',
      appKey: 'PLATFORM',
      routeType: 'create'
    }
  },
  {
    path: '/quotes/:id/compare',
    name: 'quote-revision-compare',
    component: () => import('@/views/QuoteRevisionCompareView.vue'),
    meta: {
      requiresAuth: true,
      requiresPermission: { module: 'quotes', action: 'view' },
      moduleKey: 'quotes',
      appKey: 'PLATFORM',
      routeType: 'detail'
    }
  },
  {
    path: '/quotes/:id',
    name: 'quote-detail',
    component: () => import('@/pages/ModuleRecordPage.vue'),
    meta: {
      requiresAuth: true,
      requiresPermission: { module: 'quotes', action: 'view' },
      moduleKey: 'quotes',
      appKey: 'PLATFORM',
      routeType: 'detail'
    }
  },
  {
    path: '/analytics',
    name: 'analytics-home',
    component: () => import('@/views/analytics/AnalyticsHome.vue'),
    meta: {
      requiresAuth: true,
      requiresPermission: { module: 'reports', action: 'view' },
      moduleKey: 'analytics',
      appKey: 'PLATFORM',
      routeType: 'list'
    }
  },
  {
    path: '/analytics/settings',
    name: 'analytics-settings',
    component: () => import('@/views/analytics/AnalyticsSettings.vue'),
    meta: {
      requiresAuth: true,
      requiresPermission: { module: 'reports', action: 'edit' },
      moduleKey: 'analytics',
      appKey: 'PLATFORM',
      routeType: 'edit'
    }
  },
  {
    path: '/analytics/folders',
    name: 'analytics-folders',
    component: () => import('@/views/analytics/AnalyticsFolders.vue'),
    meta: {
      requiresAuth: true,
      requiresPermission: { module: 'reports', action: 'view' },
      moduleKey: 'analytics',
      appKey: 'PLATFORM',
      routeType: 'list'
    }
  },
  {
    path: '/analytics/trash',
    name: 'analytics-trash',
    component: () => import('@/views/analytics/AnalyticsTrash.vue'),
    meta: {
      requiresAuth: true,
      requiresPermission: { module: 'reports', action: 'view' },
      moduleKey: 'analytics',
      appKey: 'PLATFORM',
      routeType: 'list'
    }
  },
  {
    path: '/analytics/schedules',
    name: 'analytics-schedules',
    component: () => import('@/views/analytics/AnalyticsScheduleList.vue'),
    meta: {
      requiresAuth: true,
      requiresPermission: { module: 'reports', action: 'view' },
      moduleKey: 'analytics',
      appKey: 'PLATFORM',
      routeType: 'list'
    }
  },
  {
    path: '/analytics/snapshots',
    name: 'analytics-snapshots',
    component: () => import('@/views/analytics/AnalyticsSnapshotList.vue'),
    meta: {
      requiresAuth: true,
      requiresPermission: { module: 'reports', action: 'view' },
      moduleKey: 'analytics',
      appKey: 'PLATFORM',
      routeType: 'list'
    }
  },
  {
    path: '/analytics/alerts',
    name: 'analytics-alerts',
    component: () => import('@/views/analytics/AnalyticsAlertList.vue'),
    meta: {
      requiresAuth: true,
      requiresPermission: { module: 'reports', action: 'view' },
      moduleKey: 'analytics',
      appKey: 'PLATFORM',
      routeType: 'list'
    }
  },
  {
    path: '/analytics/snapshots/:id',
    name: 'analytics-snapshot-detail',
    component: () => import('@/views/analytics/AnalyticsSnapshotList.vue'),
    props: true,
    meta: {
      requiresAuth: true,
      requiresPermission: { module: 'reports', action: 'view' },
      moduleKey: 'analytics',
      appKey: 'PLATFORM',
      routeType: 'detail'
    }
  },
  {
    path: '/analytics/reports',
    name: 'analytics-reports',
    component: () => import('@/views/analytics/AnalyticsReportList.vue'),
    meta: {
      requiresAuth: true,
      requiresPermission: { module: 'reports', action: 'view' },
      moduleKey: 'reports',
      appKey: 'PLATFORM',
      routeType: 'list'
    }
  },
  {
    path: '/analytics/reports/new',
    name: 'analytics-report-create',
    component: () => import('@/views/analytics/AnalyticsReportBuilder.vue'),
    meta: {
      requiresAuth: true,
      requiresPermission: { module: 'reports', action: 'create' },
      moduleKey: 'reports',
      appKey: 'PLATFORM',
      routeType: 'create'
    }
  },
  {
    path: '/analytics/reports/:id/edit',
    name: 'analytics-report-edit',
    component: () => import('@/views/analytics/AnalyticsReportBuilder.vue'),
    meta: {
      requiresAuth: true,
      requiresPermission: { module: 'reports', action: 'edit' },
      moduleKey: 'reports',
      appKey: 'PLATFORM',
      routeType: 'edit'
    }
  },
  {
    path: '/analytics/reports/:id',
    name: 'analytics-report-detail',
    component: () => import('@/views/analytics/AnalyticsReportDetail.vue'),
    meta: {
      requiresAuth: true,
      requiresPermission: { module: 'reports', action: 'view' },
      moduleKey: 'reports',
      appKey: 'PLATFORM',
      routeType: 'detail'
    }
  },
  {
    path: '/analytics/widgets',
    name: 'analytics-widgets',
    component: () => import('@/views/analytics/AnalyticsWidgetList.vue'),
    meta: {
      requiresAuth: true,
      requiresPermission: { module: 'reports', action: 'view' },
      moduleKey: 'reports',
      appKey: 'PLATFORM',
      routeType: 'list'
    }
  },
  {
    path: '/analytics/widgets/new',
    name: 'analytics-widget-create',
    component: () => import('@/views/analytics/AnalyticsWidgetBuilder.vue'),
    meta: {
      requiresAuth: true,
      requiresPermission: { module: 'reports', action: 'create' },
      moduleKey: 'reports',
      appKey: 'PLATFORM',
      routeType: 'create'
    }
  },
  {
    path: '/analytics/widgets/:id/edit',
    name: 'analytics-widget-edit',
    component: () => import('@/views/analytics/AnalyticsWidgetBuilder.vue'),
    meta: {
      requiresAuth: true,
      requiresPermission: { module: 'reports', action: 'edit' },
      moduleKey: 'reports',
      appKey: 'PLATFORM',
      routeType: 'edit'
    }
  },
  {
    path: '/analytics/widgets/:id',
    name: 'analytics-widget-detail',
    component: () => import('@/views/analytics/AnalyticsWidgetDetail.vue'),
    meta: {
      requiresAuth: true,
      requiresPermission: { module: 'reports', action: 'view' },
      moduleKey: 'reports',
      appKey: 'PLATFORM',
      routeType: 'detail'
    }
  },
  {
    path: '/analytics/dashboards',
    name: 'analytics-dashboards',
    component: () => import('@/views/analytics/AnalyticsDashboardList.vue'),
    meta: {
      requiresAuth: true,
      requiresPermission: { module: 'reports', action: 'view' },
      moduleKey: 'reports',
      appKey: 'PLATFORM',
      routeType: 'list'
    }
  },
  {
    path: '/analytics/dashboards/new',
    name: 'analytics-dashboard-create',
    component: () => import('@/views/analytics/AnalyticsDashboardDesigner.vue'),
    meta: {
      requiresAuth: true,
      requiresPermission: { module: 'reports', action: 'create' },
      moduleKey: 'reports',
      appKey: 'PLATFORM',
      routeType: 'create'
    }
  },
  {
    path: '/analytics/dashboards/:id/edit',
    name: 'analytics-dashboard-edit',
    component: () => import('@/views/analytics/AnalyticsDashboardDesigner.vue'),
    meta: {
      requiresAuth: true,
      requiresPermission: { module: 'reports', action: 'edit' },
      moduleKey: 'reports',
      appKey: 'PLATFORM',
      routeType: 'edit'
    }
  },
  {
    path: '/analytics/embed/dashboard',
    name: 'analytics-embed-dashboard',
    component: () => import('@/views/analytics/AnalyticsEmbedDashboardView.vue'),
    meta: {
      requiresAuth: false,
      hideShell: true,
      embed: true,
      moduleKey: 'analytics',
      appKey: 'PLATFORM',
    },
  },
  {
    path: '/analytics/dashboards/:id',
    name: 'analytics-dashboard-view',
    component: () => import('@/views/analytics/AnalyticsDashboardView.vue'),
    meta: {
      requiresAuth: true,
      requiresPermission: { module: 'reports', action: 'view' },
      moduleKey: 'reports',
      appKey: 'PLATFORM',
      routeType: 'detail'
    }
  },
  {
    path: '/sales-orders',
    name: 'sales-orders',
    component: () => import('@/views/GenericModule.vue'),
    meta: {
      requiresAuth: true,
      requiresPermission: { module: 'sales_orders', action: 'view' },
      moduleKey: 'sales_orders',
      appKey: 'PLATFORM',
      routeType: 'list'
    }
  },
  {
    path: '/sales-orders/:id',
    name: 'sales-order-detail',
    component: () => import('@/pages/ModuleRecordPage.vue'),
    meta: {
      requiresAuth: true,
      requiresPermission: { module: 'sales_orders', action: 'view' },
      moduleKey: 'sales_orders',
      appKey: 'PLATFORM',
      routeType: 'detail'
    }
  },
  {
    path: '/invoices',
    name: 'invoices',
    component: () => import('@/views/GenericModule.vue'),
    meta: {
      requiresAuth: true,
      requiresPermission: { module: 'invoices', action: 'view' },
      moduleKey: 'invoices',
      appKey: 'PLATFORM',
      routeType: 'list'
    }
  },
  {
    path: '/invoices/:id',
    name: 'invoice-detail',
    component: () => import('@/pages/ModuleRecordPage.vue'),
    meta: {
      requiresAuth: true,
      requiresPermission: { module: 'invoices', action: 'view' },
      moduleKey: 'invoices',
      appKey: 'PLATFORM',
      routeType: 'detail'
    }
  },
  {
    path: '/payments',
    name: 'payments',
    component: () => import('@/views/GenericModule.vue'),
    meta: {
      requiresAuth: true,
      requiresPermission: { module: 'payments', action: 'view' },
      moduleKey: 'payments',
      appKey: 'PLATFORM',
      routeType: 'list'
    }
  },
  {
    path: '/payments/:id',
    name: 'payment-detail',
    component: () => import('@/pages/ModuleRecordPage.vue'),
    meta: {
      requiresAuth: true,
      requiresPermission: { module: 'payments', action: 'view' },
      moduleKey: 'payments',
      appKey: 'PLATFORM',
      routeType: 'detail'
    }
  },
  {
    path: '/items/:id',
    name: 'item-detail',
    component: () => import('@/pages/ModuleRecordPage.vue'),
    meta: { requiresAuth: true, requiresPermission: { module: 'items', action: 'view' }, moduleKey: 'items' }
  },
  // Helpdesk cases: register statically so /helpdesk/* always resolves. Dynamic /api/ui/routes
  // also emits these (same names); addRoute will skip duplicates. Order: /new before /:id.
  {
    path: '/helpdesk/cases',
    name: 'helpdesk-cases-list',
    component: () => import('@/views/helpdesk/Cases.vue'),
    meta: {
      requiresAuth: true,
      requiresPermission: { module: 'cases', action: 'view' },
      moduleKey: 'cases',
      appKey: 'HELPDESK',
      routeType: 'list'
    }
  },
  {
    path: '/helpdesk/cases/new',
    name: 'helpdesk-cases-create',
    component: () => import('@/views/GenericModule.vue'),
    meta: {
      requiresAuth: true,
      requiresPermission: { module: 'cases', action: 'create' },
      moduleKey: 'cases',
      appKey: 'HELPDESK',
      routeType: 'create'
    }
  },
  {
    path: '/helpdesk/cases/:id',
    name: 'helpdesk-cases-detail',
    component: () => import('@/pages/ModuleRecordPage.vue'),
    meta: {
      requiresAuth: true,
      requiresPermission: { module: 'cases', action: 'view' },
      moduleKey: 'cases',
      appKey: 'HELPDESK',
      routeType: 'detail'
    }
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
    path: '/documents',
    name: 'documents',
    component: () => import('@/views/Documents.vue'),
    meta: { requiresAuth: true, requiresPermission: { module: 'documents', action: 'view' } }
  },
  {
    path: '/documents/:id',
    name: 'document-detail',
    component: () => import('@/pages/ModuleRecordPage.vue'),
    meta: { requiresAuth: true, requiresPermission: { module: 'documents', action: 'view' }, moduleKey: 'documents' }
  },
  {
    path: '/templates',
    name: 'templates',
    component: () => import('@/views/Templates.vue'),
    meta: { requiresAuth: true, requiresPermission: { module: 'templates', action: 'view' } }
  },
  {
    path: '/templates/:id',
    name: 'template-detail',
    component: () => import('@/views/TemplateDetail.vue'),
    meta: { requiresAuth: true, requiresPermission: { module: 'templates', action: 'view' } }
  },
  {
    path: '/templates/:id/builder',
    name: 'template-builder',
    component: () => import('@/views/TemplateBuilder.vue'),
    meta: { requiresAuth: true, requiresPermission: { module: 'templates', action: 'edit' } }
  },
  {
    path: '/content-themes',
    name: 'content-themes',
    component: () => import('@/views/ContentThemes.vue'),
    meta: { requiresAuth: true, requiresPermission: { module: 'templates', action: 'view' } }
  },
  {
    path: '/content-themes/:id',
    name: 'content-theme-detail',
    component: () => import('@/views/ContentThemeDetail.vue'),
    meta: { requiresAuth: true, requiresPermission: { module: 'templates', action: 'view' } }
  },
  {
    path: '/content-assets',
    name: 'content-assets',
    component: () => import('@/views/ContentAssets.vue'),
    meta: { requiresAuth: true, requiresPermission: { module: 'templates', action: 'view' } }
  },
  {
    path: '/templates/email-merge-mappings',
    name: 'email-merge-mappings',
    component: () => import('@/views/EmailMergeTagMappings.vue'),
    meta: { requiresAuth: true, requiresPermission: { module: 'templates', action: 'view' } }
  },
  {
    path: '/organizations',
    name: 'organizations',
    component: () => import('@/views/Organizations.vue'),
    meta: { requiresAuth: true, requiresPermission: { module: 'organizations', action: 'view' } }
  },
  // CreateOrganizationSurface supports both create and edit modes.
  // Create mode: accessed via Command Palette, People contextual actions, or app workflows.
  // Edit mode: accessed via explicit action from OrganizationSurface (e.g., "Edit business details").
  // It must not appear in primary navigation.
  {
    path: '/organizations/new',
    name: 'organizations-create',
    component: () => import('@/views/CreateOrganizationSurface.vue'),
    props: (route) => ({ mode: 'create' }),
    meta: { requiresAuth: true, requiresPermission: { module: 'organizations', action: 'create' } }
  },
  // Edit mode route for CreateOrganizationSurface
  // Accessed via explicit action from OrganizationSurface
  {
    path: '/organizations/:id/edit',
    name: 'organizations-edit',
    component: () => import('@/views/CreateOrganizationSurface.vue'),
    props: (route) => ({ mode: 'edit', organizationId: route.params.id }),
    meta: { requiresAuth: true, requiresPermission: { module: 'organizations', action: 'update' } }
  },
  // Organization detail route uses generic module record page.
  {
    path: '/organizations/:id',
    name: 'organization-detail',
    component: () => import('@/pages/ModuleRecordPage.vue'),
    meta: { requiresAuth: true, requiresPermission: { module: 'organizations', action: 'view' } },
    beforeEnter: async (to, from, next) => {
      const authStore = useAuthStore();
      const orgId = to.params.id;
      
      // Guardrail: Tenant organizations cannot be opened in OrganizationSurface
      // Check if this is the current user's tenant organization
      if (authStore.organization?._id === orgId || authStore.organizationId === orgId) {
        // Redirect tenant orgs to workspace settings
        next({ name: 'settings', query: { tab: 'organization' } });
        return;
      }
      
      // Try to fetch the organization to verify it's a business org (not tenant)
      try {
        const { default: apiClient } = await import('@/utils/apiClient');
        const response = await apiClient.getOptional(`/v2/organization/${orgId}`);

        if (response?.success && response.data?.isTenant === true) {
          next({ name: 'settings', query: { tab: 'organization' } });
          return;
        }

        if (response?.success) {
          next();
          return;
        }

        if (authStore.organization?._id === orgId || authStore.organizationId === orgId) {
          next({ name: 'settings', query: { tab: 'organization' } });
          return;
        }
      } catch (_error) {
        // fall through — component handles load errors
      }

      next();
    }
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
    path: '/forms/create',
    name: 'form-create',
    component: () => import('@/views/FormCreate.vue'),
    meta: { requiresAuth: true, requiresPermission: { module: 'forms', action: 'create' } }
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
    path: '/webforms/staff-preview/:slug',
    name: 'staff-webform-preview',
    component: () => import('@/views/WebformStaffPreviewView.vue'),
    meta: { requiresAuth: false, hideShell: true }
  },
  {
    path: '/webforms/public/:slug',
    name: 'public-webform',
    component: () => import('@/views/WebformPublicView.vue'),
    meta: { requiresAuth: false, hideShell: true }
  },
  {
    path: '/webforms/embed/:slug',
    name: 'public-webform-embed',
    component: () => import('@/views/WebformPublicView.vue'),
    meta: { requiresAuth: false, hideShell: true, embed: true }
  },
  {
    path: '/public/quotes/:token',
    name: 'public-quote',
    component: () => import('@/views/PublicQuoteView.vue'),
    meta: { requiresAuth: false, hideShell: true }
  },
  {
    path: '/book/:slug',
    name: 'public-booking',
    component: () => import('@/views/PublicBookingView.vue'),
    meta: { requiresAuth: false, hideShell: true }
  },
  {
    path: '/book/:slug/embed',
    name: 'public-booking-embed',
    component: () => import('@/views/PublicBookingView.vue'),
    meta: { requiresAuth: false, hideShell: true, embed: true }
  },
  {
    path: '/appointments/manage/:token',
    name: 'public-manage-appointment',
    component: () => import('@/views/PublicManageAppointmentView.vue'),
    meta: { requiresAuth: false, hideShell: true }
  },
  {
    path: '/appointments/pages',
    name: 'appointments-pages',
    component: () => import('@/views/appointments/AppointmentPagesView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/appointments/configure',
    name: 'appointments-configure',
    component: () => import('@/views/appointments/AppointmentConfigureView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/appointments/configure/user/:userId',
    name: 'appointments-configure-user',
    component: () => import('@/views/appointments/AppointmentConfigureView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/appointments/team/configure',
    name: 'appointments-team-configure-new',
    component: () => import('@/views/appointments/TeamAppointmentConfigureView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/appointments/team/configure/:id',
    name: 'appointments-team-configure',
    component: () => import('@/views/appointments/TeamAppointmentConfigureView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/forms/:id/detail',
    name: 'form-detail',
    component: () => import('@/pages/ModuleRecordPage.vue'),
    meta: { requiresAuth: true, requiresPermission: { module: 'forms', action: 'view' }, moduleKey: 'forms' }
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
    component: () => import('@/pages/ModuleRecordPage.vue'),
    meta: {
      requiresAuth: true,
      requiresPermission: { module: 'responses', action: 'view' },
      moduleKey: 'responses',
      appKey: 'PLATFORM'
    }
  },
  {
    path: '/forms/:id/fill',
    name: 'form-fill',
    component: () => import('@/views/FormFill.vue'),
    meta: { requiresAuth: true, requiresPermission: { module: 'forms', action: 'create' } }
  },
  {
    path: '/responses',
    name: 'responses',
    component: () => import('@/views/Responses.vue'),
    meta: {
      requiresAuth: true,
      requiresPermission: { module: 'responses', action: 'view' },
      moduleKey: 'responses',
      appKey: 'PLATFORM'
    }
  },
  // Response Detail (Read-Only)
  {
    path: '/responses/:id',
    name: 'response-detail',
    component: () => import('@/pages/ModuleRecordPage.vue'),
    meta: {
      requiresAuth: true,
      requiresPermission: { module: 'responses', action: 'view' },
      moduleKey: 'responses',
      appKey: 'PLATFORM'
    }
  },
  // Audit App routes
  ...auditRoutes,
  // Portal App routes
  ...portalRoutes
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

// DEV-ONLY: Event Domain Contract Guard
if (import.meta.env.DEV) {
  console.info(
    '[Event Domain]',
    'Event domain is contract-locked. See docs/architecture/event-domain-contract.md'
  );
}

// Helper function to determine the correct dashboard based on user's app access
const getDefaultRoute = (authStore) => {
  if (!authStore.isAuthenticated) {
    return { name: 'login' };
  }

  if (isOrganizationTrialExpired(authStore.organization)) {
    return { name: 'trial-expired' };
  }

  return authStore.resolvePostLoginRoute();
}

// Add debug logging and permission checks
router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore()

  // Invite links must not inherit a stale session — otherwise we briefly route to
  // platform/home, authenticated API calls fail, and the user lands on login.
  if (to.name === 'accept-invite' && String(to.query?.token || '').trim()) {
    authStore.clearUser()
  }

  const logoutRequested = to.name === 'login' && String(to.query?.logout || '') === '1'
  if (logoutRequested) {
    authStore.clearUser()
    next({ name: 'login', query: {} })
    return
  }

  // Locale upgrade runs from authStore.setUser → syncI18nFromOrganization (single owner).
  logNavDebug('Navigation guard:', {
    to: to.path,
    isAuthenticated: authStore.isAuthenticated,
    user: authStore.user,
    permissions: authStore.user?.permissions,
    allowedApps: authStore.user?.allowedApps
  })

  if (to.name === 'landing' && !authStore.isAuthenticated) {
    logNavDebug('Redirecting: Unauthenticated landing to login')
    next({ name: 'login' })
    return
  }

  // Check authentication
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    logNavDebug('Blocked: Authentication required')
    // Preserve intended path so after rehydration (or when user logs in) we can redirect there.
    // Important for new-tab flows (e.g. Settings opened in new tab before auth is ready).
    if (typeof window !== 'undefined' && to.path) {
      try {
        sessionStorage.setItem('arivu_redirect_after_login', to.fullPath || to.path)
      } catch (_) {}
    }
    next({ name: 'login' })
    return
  }

  // Refresh trial subscription from server before redirecting (handles extension by another user)
  if (authStore.isAuthenticated) {
    const onTrial = authStore.organization?.subscription?.status === 'trial';
    const trialLooksExpired = isOrganizationTrialExpired(authStore.organization);
    if (onTrial || trialLooksExpired || to.name === 'trial-expired') {
      await authStore.syncTrialSubscription({
        force: trialLooksExpired || to.name === 'trial-expired'
      });
    }
  }

  // Trial expired takes precedence over onboarding and normal navigation
  if (authStore.isAuthenticated && isOrganizationTrialExpired(authStore.organization)) {
    if (!canAccessWhileTrialExpired(to)) {
      logNavDebug('Redirecting: Trial expired')
      next({ name: 'trial-expired' })
      return
    }
  }

  // External portal session guards (E3)
  if (authStore.isAuthenticated && authStore.isExternalUser) {
    const allowWithoutActivePortal = to.meta.allowWithoutActivePortal === true;

    if (authStore.user?.mustChangePassword && to.name !== 'portal-set-password') {
      logNavDebug('Redirecting: External user must change password');
      next({ name: 'portal-set-password' });
      return;
    }

    if (authStore.needsPortalSelection && !allowWithoutActivePortal && to.name !== 'portal-select') {
      logNavDebug('Redirecting: External user must select portal');
      next({ name: 'portal-select' });
      return;
    }
  }

  // Onboarding redirect for founders with incomplete wizard
  if (authStore.isAuthenticated) {
    const onboardingRedirect = authStore.user?.onboarding?.redirectTo;
    if (onboardingRedirect === '/onboarding' && to.name !== 'onboarding') {
      const allowWhileOnboarding = to.path.startsWith('/settings')
        || to.path.startsWith('/webforms/staff-preview/')
        || to.path.startsWith('/webforms/public/')
        || to.path.startsWith('/webforms/embed/');
      if (!allowWhileOnboarding) {
        logNavDebug('Redirecting: Founder onboarding incomplete');
        next({ name: 'onboarding' });
        return;
      }
    }
    if (to.name === 'onboarding' && onboardingRedirect !== '/onboarding') {
      logNavDebug('Redirecting: Onboarding already complete');
      next(getDefaultRoute(authStore));
      return;
    }
  }

  // Settings / legacy audit forms need deferred locale namespaces in the guard.
  const needsFullLocale =
    to.path.startsWith('/settings')
    || to.path.startsWith('/forms')
    || to.path.startsWith('/templates')
    || to.path.startsWith('/content-themes')
    || to.path.startsWith('/content-assets');

  const needsWebformsLocale =
    to.path.startsWith('/webforms/public/')
    || to.path.startsWith('/webforms/embed/')
    || to.path.startsWith('/webforms/staff-preview/');

  if (needsFullLocale || needsWebformsLocale) {
    // Do not block navigation on deferred locale chunks — public webforms must paint immediately.
    void (async () => {
      try {
        const { ensureFullLocaleLoaded, ensureWebformsNamespaceLoaded, i18n } = await import('@/i18n');
        const lang = i18n.global.locale.value;
        if (needsFullLocale) {
          const full = await ensureFullLocaleLoaded(lang);
          i18n.global.setLocaleMessage(lang, full);
        } else {
          const webforms = await ensureWebformsNamespaceLoaded(lang);
          i18n.global.mergeLocaleMessage(lang, webforms);
        }
      } catch (err) {
        console.warn('[i18n] Failed to preload locale for route', to.path, err);
      }
    })();
  }
  if (authStore.isAuthenticated && to.path.startsWith('/settings')) {
    const settingsCtx = {
      isOwner: !!authStore.user?.isOwner,
      role: authStore.user?.role,
      permissions: authStore.user?.permissions,
    }
    if (!hasAnySettingsAccess(settingsCtx)) {
      logNavDebug('Blocked: No access to any Settings section', { path: to.path })
      alert('You do not have access to Settings. Contact your administrator if you need configuration access.')
      next(getDefaultRoute(authStore))
      return
    }
  }

  // Honoured when opening e.g. Settings in a new tab: open platform/home?redirect=/settings
  // so the server always serves the SPA; then we redirect to /settings (works after clear cache).
  const redirectPath = to.query && typeof to.query.redirect === 'string' ? to.query.redirect : null
  if (authStore.isAuthenticated && redirectPath && redirectPath.startsWith('/') && !redirectPath.startsWith('//')) {
    logNavDebug('Redirecting: query.redirect to', redirectPath)
    next({ path: redirectPath, query: {} })
    return
  }

  // Redirect authenticated users from landing page
  if (to.name === 'landing' && authStore.isAuthenticated) {
    // Prefer saved redirect (e.g. /settings from new tab) over platform home
    let redirect = null
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('arivu_redirect_after_login')
        if (saved && saved.startsWith('/') && !saved.startsWith('//')) {
          sessionStorage.removeItem('arivu_redirect_after_login')
          redirect = saved
        }
      } catch (_) {}
    }
    if (redirect) {
      logNavDebug('Redirecting: Landing with saved redirect to', redirect)
      next(redirect)
      return
    }
    // If the browser URL is /settings (e.g. new tab opened to settings but initial load hit landing), go to settings instead of home
    const pathname = typeof window !== 'undefined' ? window.location.pathname : ''
    if (pathname.startsWith('/settings')) {
      const query = typeof window !== 'undefined' && window.location.search
        ? Object.fromEntries(new URLSearchParams(window.location.search))
        : {}
      logNavDebug('Redirecting: Landing but URL is /settings, preserving settings route')
      next({ path: pathname, query })
      return
    }
    logNavDebug('Redirecting: Already authenticated')
    next(getDefaultRoute(authStore))
    return
  }
  
  // Redirect authenticated users from login page (prevents going back to login)
  if (to.name === 'login' && authStore.isAuthenticated) {
    logNavDebug('Redirecting: Already authenticated, cannot access login')
    next(getDefaultRoute(authStore))
    return
  }

  if (to.name === 'trial-expired' && authStore.isAuthenticated && !isOrganizationTrialExpired(authStore.organization)) {
    logNavDebug('Redirecting: Trial no longer expired')
    next(getDefaultRoute(authStore))
    return
  }

  // Phase 1G: Platform landing route guard
  // /platform is accessible if:
  // - User is authenticated
  // - Instance is not TERMINATED (check organization status)
  if (to.name === 'platform-home') {
    if (!authStore.isAuthenticated) {
      logNavDebug('Blocked: Authentication required for platform landing')
      next({ name: 'login' })
      return
    }
    
    // Check if instance is terminated (via organization status)
    const org = authStore.organization;
    if (org && org.subscription?.status === 'terminated') {
      logNavDebug('Blocked: Instance is terminated')
      alert('This instance has been terminated. Please contact your administrator.')
      next({ name: 'login' })
      return
    }

    const profile = buildAppAccessProfile(authStore.hasAssignedAppAccess);
    if (authStore.isExternalUser) {
      if (authStore.needsPortalSelection) {
        logNavDebug('Redirecting external user to portal role selection')
        next({ name: 'portal-select' })
        return
      }
      if (profile.hasOnlyPortalAccess || authStore.hasAssignedAppAccess('PORTAL')) {
        logNavDebug('Redirecting external portal user away from platform home')
        next({ name: 'portal-dashboard' })
        return
      }
    }
    if (profile.hasOnlyPortalAccess) {
      logNavDebug('Redirecting portal-only user away from platform home')
      next({ name: 'portal-dashboard' })
      return
    }
    
    // Allow access
    next()
    return
  }
  
  // Block audit-only and portal-only users from accessing Sales module routes
  if (to.meta.requiresAuth && !to.meta.requiresAuditApp && !to.meta.requiresPortalApp && to.meta.requiresPermission) {
    const profile = buildAppAccessProfile(authStore.hasAssignedAppAccess);
    const { module } = to.meta.requiresPermission;
    const salesModuleRedirect = getSalesModuleRedirect(profile, module);

    if (salesModuleRedirect === 'audit-dashboard') {
      logNavDebug('Blocked: Sales route accessed by audit-only user', { route: to.path, module })
      alert('You do not have access to Sales features. Redirecting to Audit App.')
      next({ name: 'audit-dashboard' })
      return
    }
    if (salesModuleRedirect === 'portal-dashboard') {
      logNavDebug('Blocked: Sales route accessed by portal-only user', { route: to.path, module })
      alert('You do not have access to Sales features. Redirecting to Portal.')
      next({ name: 'portal-dashboard' })
      return
    }
  }
  
  // Also block direct access to Sales dashboard for audit-only and portal-only users
  if (to.name === 'sales-dashboard' || to.name === 'dashboard') {
    const profile = buildAppAccessProfile(authStore.hasAssignedAppAccess);
    const salesDashboardRedirect = getSalesDashboardRedirect(profile);

    if (salesDashboardRedirect === 'audit-dashboard') {
      logNavDebug('Blocked: Sales dashboard accessed by audit-only user')
      next({ name: 'audit-dashboard' })
      return
    }
    if (salesDashboardRedirect === 'portal-dashboard') {
      logNavDebug('Blocked: Sales dashboard accessed by portal-only user')
      next({ name: 'portal-dashboard' })
      return
    }
  }
  
  // Check if route requires master organization
  if (to.meta.requiresMasterOrganization && !authStore.isMasterOrganization) {
    logNavDebug('Blocked: Master organization required')
    alert('This feature is only available to the application owner.')
    next(getDefaultRoute(authStore))
    return
  }
  
  // Check if route requires platform admin (Phase 0H - Control Plane)
  if (to.meta.requiresPlatformAdmin && !authStore.isPlatformAdmin) {
    logNavDebug('Blocked: Platform admin access required')
    alert('This feature is only available to platform administrators.')
    next(getDefaultRoute(authStore))
    return
  }
  
  // Check if route requires admin (Phase 15)
  if (to.meta.requiresAdmin && !authStore.isAdminLike) {
    logNavDebug('Blocked: Admin access required')
    alert('This feature is only available to administrators.')
    next(getDefaultRoute(authStore))
    return
  }
  
  // Check audit app access if required
  if (to.meta.requiresAuditApp) {
    const hasAuditAccess = authStore.hasAssignedAppAccess('AUDIT');
    
    logNavDebug('Audit app access check:', {
      hasAuditAccess,
      allowedApps: authStore.user?.allowedApps,
      isOwner: authStore.isOwner,
      enabledApps: authStore.organization?.enabledApps,
      user: authStore.user,
      route: to.path
    })
    
    if (!hasAuditAccess) {
      logNavDebug('Blocked: AUDIT app access required')
      alert('You do not have access to the Audit App. Please contact your administrator.')
      next(getDefaultRoute(authStore))
      return
    }
  }
  
  // Check portal app access if required
  if (to.meta.requiresPortalApp) {
    const hasPortalAccess = authStore.hasAssignedAppAccess('PORTAL');
    
    logNavDebug('Portal app access check:', {
      hasPortalAccess,
      allowedApps: authStore.user?.allowedApps,
      isOwner: authStore.isOwner,
      enabledApps: authStore.organization?.enabledApps,
      user: authStore.user,
      route: to.path
    })
    
    if (!hasPortalAccess) {
      logNavDebug('Blocked: PORTAL app access required')
      alert('You do not have access to the Portal. Please contact your administrator.')
      next(getDefaultRoute(authStore))
      return
    }
  }
  
  // Check permissions if required
  if (to.meta.requiresPermission) {
    const { module, action } = to.meta.requiresPermission
    const hasPermission = authStore.can(module, action)
    
    logNavDebug('Permission check:', {
      module,
      action,
      hasPermission,
      isOwner: authStore.isOwner
    })
    
    if (!hasPermission) {
      logNavDebug('Blocked: Insufficient permissions')
      if (to.meta.requiresPortalApp) {
        alert(`You don't have permission to access this portal area. Please contact your administrator.`)
        next({ name: 'portal-dashboard' })
        return
      }
      alert(`You don't have permission to access ${module}. Please contact your administrator.`)
      next(getDefaultRoute(authStore))
      return
    }
  }
  
  // Note: Tab initialization is handled in App.vue onMounted after storage is configured.
  // Do not call initTabs() here as it requires instanceId + userId context.
  
  logNavDebug('Allowed: Normal navigation')
  next()
})

// Phase 1A: Load and register dynamic routes after router is created
// This will be called from App.vue after UI metadata is loaded
export async function initializeDynamicRoutes() {
  const authStore = useAuthStore();
  if (authStore.isAuthenticated) {
    try {
      const { useAppShellStore } = await import('@/stores/appShell');
      const appShellStore = useAppShellStore();
      if (Array.isArray(appShellStore.routes) && appShellStore.routes.length > 0) {
        await loadAndRegisterRoutes(router, null, appShellStore.routes);
        return;
      }

      const { default: apiClient } = await import('@/utils/apiClient')
      await loadAndRegisterRoutes(router, apiClient);
    } catch (error) {
      console.error('[Router] Error initializing dynamic routes:', error);
    }
  }
}

export default router
